begin;

create schema if not exists field_team_private;
revoke all on schema field_team_private from public, anon, authenticated;
grant usage on schema field_team_private to authenticated;

create table public.field_team_members (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  role text not null check (role in ('manager', 'worker')),
  active boolean not null default true
);

create table public.field_team_jobs (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object' and data->>'id' = id),
  created_by uuid references public.field_team_members(id) on delete set null,
  assigned_to uuid references public.field_team_members(id) on delete set null,
  assigned_by uuid references public.field_team_members(id) on delete set null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
create index field_team_jobs_assignment on public.field_team_jobs(assigned_to);

create table public.field_team_messages (
  id uuid primary key,
  job_id text not null references public.field_team_jobs(id) on delete cascade,
  sender_id uuid references public.field_team_members(id) on delete set null,
  sender_name text not null,
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index field_team_messages_job_date on public.field_team_messages(job_id, created_at, id);

create table public.field_team_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.field_team_members(id) on delete cascade,
  job_id text not null references public.field_team_jobs(id) on delete cascade,
  kind text not null check (kind in ('assignment', 'message', 'status')),
  actor_name text not null,
  job_name text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index field_team_notifications_recipient_date on public.field_team_notifications(recipient_id, created_at desc);

alter table public.field_team_members enable row level security;
alter table public.field_team_jobs enable row level security;
alter table public.field_team_messages enable row level security;
alter table public.field_team_notifications enable row level security;
revoke all on public.field_team_members, public.field_team_jobs, public.field_team_messages, public.field_team_notifications from public, anon, authenticated;
grant select on public.field_team_members, public.field_team_jobs, public.field_team_messages, public.field_team_notifications to authenticated;
grant all on public.field_team_members, public.field_team_jobs, public.field_team_messages, public.field_team_notifications to service_role;

create function field_team_private.member_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.field_team_members where id = auth.uid() and active
$$;
create function field_team_private.can_read_job(p_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.field_team_jobs
    where id = p_id and (
      field_team_private.member_role() = 'manager'
      or (field_team_private.member_role() = 'worker' and assigned_to = auth.uid())
    )
  )
$$;
revoke all on function field_team_private.member_role(), field_team_private.can_read_job(text) from public, anon, authenticated;
grant execute on function field_team_private.member_role(), field_team_private.can_read_job(text) to authenticated;

create policy field_team_members_read on public.field_team_members for select to authenticated
using (active and (id = (select auth.uid()) or (select field_team_private.member_role()) = 'manager'));
create policy field_team_jobs_read on public.field_team_jobs for select to authenticated
using ((select field_team_private.member_role()) = 'manager'
  or ((select field_team_private.member_role()) = 'worker' and assigned_to = (select auth.uid())));
create policy field_team_messages_read on public.field_team_messages for select to authenticated
using (field_team_private.can_read_job(job_id));
create policy field_team_notifications_read on public.field_team_notifications for select to authenticated
using (recipient_id = (select auth.uid()) and field_team_private.can_read_job(job_id));

create function field_team_private.require_member()
returns public.field_team_members language plpgsql stable security definer set search_path = '' as $$
declare member public.field_team_members;
begin
  select * into member from public.field_team_members where id = auth.uid() and active;
  if not found then raise exception 'Nalog nema pristup timu.' using errcode = '42501'; end if;
  return member;
end
$$;

create function field_team_private.validate_job(p_data jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  if jsonb_typeof(p_data) is distinct from 'object'
    or coalesce(p_data->>'id', '') !~ '^AT-[A-Za-z0-9-]{1,80}$'
    or length(btrim(coalesce(p_data#>>'{customer,name}', ''))) not between 1 and 150
    or jsonb_typeof(p_data->'positions') is distinct from 'array'
    or coalesce(p_data->>'status','') not in ('Merenje','Poslati ponudu','Ponuda','Prihvaćeno','Odbijeno','U izradi','Završeno') then
    raise exception 'Podaci posla nisu ispravni.' using errcode = '22023';
  end if;
end
$$;

create function public.field_team_create_job(p_job jsonb, p_assignee uuid default null, p_message text default '')
returns public.field_team_jobs language plpgsql security definer set search_path = '' as $$
declare actor public.field_team_members := field_team_private.require_member();
        result public.field_team_jobs;
        note text := btrim(coalesce(p_message, ''));
begin
  if p_assignee is not null then
    if actor.role <> 'manager' then raise exception 'Dodelu može da izvrši samo šef.' using errcode = '42501'; end if;
    if not exists(select 1 from public.field_team_members where id = p_assignee and active and role = 'worker') then
      raise exception 'Izaberite aktivnog majstora.' using errcode = '22023';
    end if;
    if length(btrim(coalesce(p_job#>>'{customer,address}', ''))) = 0 then
      raise exception 'Unesite adresu merenja.' using errcode = '22023';
    end if;
    p_job := jsonb_set(p_job, '{status}', '"Merenje"');
  end if;
  perform field_team_private.validate_job(p_job);
  if length(note) > 4000 then raise exception 'Poruka može imati najviše 4000 znakova.' using errcode = '22023'; end if;
  insert into public.field_team_jobs(id,data,created_by,assigned_to,assigned_by)
  values (p_job->>'id',p_job,actor.id,case when actor.role = 'worker' then actor.id else p_assignee end,
          case when p_assignee is not null then actor.id end)
  on conflict(id) do nothing returning * into result;
  if not found then
    select * into result from public.field_team_jobs where id = p_job->>'id' and created_by = actor.id
      and (actor.role = 'manager' or assigned_to = actor.id);
    if not found then raise exception 'Broj posla već postoji.' using errcode = '23505'; end if;
    return result;
  end if;
  if p_assignee is not null then
    if note <> '' then
      insert into public.field_team_messages(id,job_id,sender_id,sender_name,body)
      values (gen_random_uuid(),result.id,actor.id,actor.name,note);
    end if;
    insert into public.field_team_notifications(recipient_id,job_id,kind,actor_name,job_name,body)
    values (p_assignee,result.id,'assignment',actor.name,result.data#>>'{customer,name}',coalesce(nullif(note,''),'Dodeljeno vam je merenje.'));
  end if;
  return result;
end
$$;

create function public.field_team_update_job(p_id text, p_patch jsonb, p_expected jsonb)
returns public.field_team_jobs language plpgsql security definer set search_path = '' as $$
declare actor public.field_team_members := field_team_private.require_member();
        current_job public.field_team_jobs;
        next_data jsonb;
        field text;
        previous_status text;
        next_status text;
begin
  if jsonb_typeof(p_patch) is distinct from 'object' or jsonb_typeof(p_expected) is distinct from 'object'
    or p_patch ?| array['id','updated'] then
    raise exception 'Izmena posla nije ispravna.' using errcode = '22023';
  end if;
  select * into current_job from public.field_team_jobs where id = p_id for update;
  if not found or (actor.role <> 'manager' and current_job.assigned_to is distinct from actor.id) then
    raise exception 'Nemate pristup poslu.' using errcode = '42501';
  end if;
  for field in select jsonb_object_keys(p_patch) loop
    if current_job.data->field is distinct from p_expected->field
      and current_job.data->field is distinct from p_patch->field then
      raise exception 'Posao je u međuvremenu izmenjen. Osvežite podatke pre ponovnog unosa.' using errcode = '40001';
    end if;
  end loop;
  next_data := current_job.data || p_patch;
  if next_data = current_job.data then return current_job; end if;
  perform field_team_private.validate_job(next_data);
  previous_status := current_job.data->>'status';
  next_status := next_data->>'status';
  update public.field_team_jobs
    set data = jsonb_set(next_data,'{updated}',to_jsonb(now())),
        updated_at = now(), revision = revision + 1
    where id = p_id returning * into current_job;
  if previous_status is distinct from next_status then
    insert into public.field_team_notifications(recipient_id,job_id,kind,actor_name,job_name,body)
    select id,p_id,'status',actor.name,next_data#>>'{customer,name}',
      case when previous_status = 'Merenje' and next_status = 'Poslati ponudu'
        then 'Merenje je završeno. Novi status: Poslati ponudu.'
        when next_status = 'Prihvaćeno' then 'Klijent je prihvatio ponudu. Posao je spreman za izradu.'
        else 'Novi status: ' || next_status || '.' end
    from public.field_team_members
    where active and id <> actor.id and (role = 'manager' or id = current_job.assigned_to);
  end if;
  return current_job;
end
$$;

create function public.field_team_delete_job(p_id text, p_expected jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare actor public.field_team_members := field_team_private.require_member();
begin
  if actor.role <> 'manager' then raise exception 'Posao može da obriše samo šef.' using errcode = '42501'; end if;
  delete from public.field_team_jobs where id = p_id and data - 'updated' = p_expected - 'updated';
  if not found and exists(select 1 from public.field_team_jobs where id = p_id) then
    raise exception 'Posao je u međuvremenu izmenjen.' using errcode = '40001';
  end if;
end
$$;

create function public.field_team_assign(p_id text, p_assignee uuid, p_message text default '')
returns public.field_team_jobs language plpgsql security definer set search_path = '' as $$
declare actor public.field_team_members := field_team_private.require_member();
        result public.field_team_jobs;
        note text := btrim(coalesce(p_message,''));
begin
  if actor.role <> 'manager' then raise exception 'Dodelu može da izvrši samo šef.' using errcode = '42501'; end if;
  if not exists(select 1 from public.field_team_members where id = p_assignee and active and role = 'worker') then
    raise exception 'Izaberite aktivnog majstora.' using errcode = '22023';
  end if;
  if length(note) > 4000 then raise exception 'Poruka može imati najviše 4000 znakova.' using errcode = '22023'; end if;
  select * into result from public.field_team_jobs where id = p_id for update;
  if not found then raise exception 'Posao nije pronađen.' using errcode = '22023'; end if;
  if result.assigned_to = p_assignee then return result; end if;
  update public.field_team_jobs set assigned_to = p_assignee, assigned_by = actor.id,
    updated_at = now(), revision = revision + 1 where id = p_id returning * into result;
  if note <> '' then
    insert into public.field_team_messages(id,job_id,sender_id,sender_name,body)
    values (gen_random_uuid(),p_id,actor.id,actor.name,note);
  end if;
  insert into public.field_team_notifications(recipient_id,job_id,kind,actor_name,job_name,body)
  values (p_assignee,p_id,'assignment',actor.name,result.data#>>'{customer,name}',coalesce(nullif(note,''),'Dodeljen vam je posao.'));
  return result;
end
$$;

create function public.field_team_send_message(p_id text, p_message_id uuid, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor public.field_team_members := field_team_private.require_member();
        job public.field_team_jobs;
        note text := btrim(coalesce(p_body,''));
begin
  select * into job from public.field_team_jobs where id = p_id for share;
  if not found or (actor.role <> 'manager' and job.assigned_to is distinct from actor.id) then
    raise exception 'Nemate pristup razgovoru.' using errcode = '42501';
  end if;
  if length(note) not between 1 and 4000 then raise exception 'Unesite poruku do 4000 znakova.' using errcode = '22023'; end if;
  insert into public.field_team_messages(id,job_id,sender_id,sender_name,body)
  values (p_message_id,p_id,actor.id,actor.name,note) on conflict(id) do nothing;
  if not found then return; end if;
  insert into public.field_team_notifications(recipient_id,job_id,kind,actor_name,job_name,body)
  select id,p_id,'message',actor.name,job.data#>>'{customer,name}',note
  from public.field_team_members
  where active and id <> actor.id and (
    (actor.role = 'manager' and id = job.assigned_to)
    or (actor.role = 'worker' and role = 'manager' and (
      id = job.assigned_by or not exists(
        select 1 from public.field_team_members where id = job.assigned_by and active and role = 'manager'
      )
    ))
  );
end
$$;

create function public.field_team_read_notification(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.field_team_notifications set read_at = coalesce(read_at,now())
  where id = p_id and recipient_id = auth.uid() and field_team_private.can_read_job(job_id)
$$;

revoke all on function field_team_private.require_member(), field_team_private.validate_job(jsonb) from public, anon, authenticated;
revoke all on function public.field_team_create_job(jsonb,uuid,text), public.field_team_update_job(text,jsonb,jsonb),
  public.field_team_delete_job(text,jsonb), public.field_team_assign(text,uuid,text),
  public.field_team_send_message(text,uuid,text), public.field_team_read_notification(uuid)
  from public, anon, authenticated;
grant execute on function public.field_team_create_job(jsonb,uuid,text), public.field_team_update_job(text,jsonb,jsonb),
  public.field_team_delete_job(text,jsonb), public.field_team_assign(text,uuid,text),
  public.field_team_send_message(text,uuid,text), public.field_team_read_notification(uuid) to authenticated;

commit;
