begin;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table field_team_private.push_config (
  singleton boolean primary key default true check (singleton),
  function_url text not null,
  public_key text not null
);

create table field_team_private.push_devices (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.field_team_members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null
);
create index field_team_push_member on field_team_private.push_devices(member_id);

create table field_team_private.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.field_team_notifications(id) on delete cascade,
  device_id uuid not null references field_team_private.push_devices(id) on delete cascade,
  due_at timestamptz not null default now(),
  attempts integer not null default 0,
  unique (notice_id,device_id)
);
create index field_team_push_due on field_team_private.push_deliveries(due_at);
revoke all on field_team_private.push_config, field_team_private.push_devices, field_team_private.push_deliveries from public, anon, authenticated;

create function public.field_team_push_key()
returns text language sql stable security definer set search_path = '' as $$
  select public_key from field_team_private.push_config where field_team_private.member_role() is not null
$$;

create function public.field_team_push_device(p_endpoint text, p_p256dh text default null, p_auth text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor public.field_team_members := field_team_private.require_member();
begin
  if p_p256dh is null and p_auth is null then
    delete from field_team_private.push_devices where endpoint = p_endpoint and member_id = actor.id;
    return false;
  end if;
  if p_endpoint is null or length(p_endpoint) > 2048 or p_endpoint !~
    '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*web\.push\.apple\.com|([a-z0-9-]+\.)+notify\.windows\.com)/[^[:space:]#]+$'
    or coalesce(p_p256dh,'') !~ '^[A-Za-z0-9_-]{87}$' or coalesce(p_auth,'') !~ '^[A-Za-z0-9_-]{22}$' then
    raise exception 'Pretplata za obaveštenja nije ispravna.' using errcode = '22023';
  end if;
  insert into field_team_private.push_devices as old (member_id,endpoint,p256dh,auth_secret)
  values (actor.id,p_endpoint,p_p256dh,p_auth)
  on conflict (endpoint) do update set member_id = excluded.member_id
    where old.p256dh = excluded.p256dh and old.auth_secret = excluded.auth_secret;
  if not found then raise exception 'Pretplata za obaveštenja nije ispravna.' using errcode = '22023'; end if;
  return true;
end
$$;

create function public.field_team_push_enabled(p_endpoint text)
returns boolean language sql stable security definer set search_path = '' as $$
  select field_team_private.member_role() is not null and exists (
    select 1 from field_team_private.push_devices where endpoint = p_endpoint and member_id = auth.uid()
  )
$$;

create function field_team_private.dispatch_push()
returns void language plpgsql security definer set search_path = '' as $$
declare target text;
        secret text;
begin
  if not exists(select 1 from field_team_private.push_deliveries where due_at <= now()) then return; end if;
  select function_url into target from field_team_private.push_config;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'field_team_push_dispatch';
  if target is null or secret is null then return; end if;
  perform net.http_post(url := target, headers := jsonb_build_object('Content-Type','application/json','X-Team-Push-Token',secret), timeout_milliseconds := 20000);
end
$$;

create function field_team_private.enqueue_push()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into field_team_private.push_deliveries(notice_id,device_id)
  select new.id, id from field_team_private.push_devices where member_id = new.recipient_id;
  if found then
    begin
      perform field_team_private.dispatch_push();
    exception when others then
      -- Keep the committed delivery for the scheduled retry.
      raise warning 'Push dispatch unavailable; delivery retained';
    end;
  end if;
  return new;
end
$$;
revoke all on function field_team_private.dispatch_push(), field_team_private.enqueue_push() from public, anon, authenticated;
create trigger field_team_enqueue_push after insert on public.field_team_notifications
for each row execute function field_team_private.enqueue_push();

create function public.field_team_push_claim()
returns table (delivery_id uuid, lease integer, device_id uuid, endpoint text, p256dh text, auth_secret text, kind text, job_id text)
language plpgsql security definer set search_path = '' as $$
begin
  delete from field_team_private.push_deliveries d using public.field_team_notifications n
  where n.id = d.notice_id and (n.created_at < now() - interval '1 day' or (d.due_at <= now() and d.attempts >= 6));
  delete from field_team_private.push_deliveries d using public.field_team_notifications n, field_team_private.push_devices p,
    public.field_team_members m, public.field_team_jobs j
  where d.notice_id = n.id and d.device_id = p.id and p.member_id = m.id and n.job_id = j.id
    and (p.member_id <> n.recipient_id or not m.active or (m.role = 'worker' and j.assigned_to is distinct from m.id) or n.read_at is not null
      or (n.kind = 'message' and not exists (
        select 1 from public.field_team_messages message
        left join field_team_private.message_reads seen on seen.member_id = m.id and seen.job_id = j.id
        where message.job_id = n.job_id and message.created_at = n.created_at and message.body = n.body
          and (seen.message_id is null or (seen.message_at,seen.message_id) < (message.created_at,message.id))
      )));
  return query with pending as (
    select d.id from field_team_private.push_deliveries d where d.due_at <= now()
    order by d.due_at,d.id limit 25 for update skip locked
  ), leased as (
    update field_team_private.push_deliveries d set due_at = now() + interval '2 minutes', attempts = d.attempts + 1
    from pending where d.id = pending.id returning d.*
  )
  select d.id,d.attempts,p.id,p.endpoint,p.p256dh,p.auth_secret,n.kind,n.job_id
  from leased d join field_team_private.push_devices p on p.id = d.device_id
  join public.field_team_notifications n on n.id = d.notice_id;
end
$$;

create function public.field_team_push_finish(p_id uuid,p_lease integer,p_result text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_result = 'expired' then
    delete from field_team_private.push_devices p using field_team_private.push_deliveries d
    where d.id = p_id and d.attempts = p_lease and d.device_id = p.id;
  elsif p_result = 'done' then
    delete from field_team_private.push_deliveries where id = p_id and attempts = p_lease;
  end if;
end
$$;

revoke all on function public.field_team_push_key(), public.field_team_push_device(text,text,text), public.field_team_push_enabled(text),
  public.field_team_push_claim(), public.field_team_push_finish(uuid,integer,text) from public, anon, authenticated, service_role;
grant execute on function public.field_team_push_key(), public.field_team_push_device(text,text,text), public.field_team_push_enabled(text) to authenticated;
grant execute on function public.field_team_push_claim(), public.field_team_push_finish(uuid,integer,text) to service_role;

select cron.schedule('field-team-web-push', '* * * * *', 'select field_team_private.dispatch_push()');
notify pgrst, 'reload schema';
commit;
