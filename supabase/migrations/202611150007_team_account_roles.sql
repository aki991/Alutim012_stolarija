begin;

-- App admins use the existing manager permissions. Only the database operator marks an admin.
create table field_team_private.app_admins (
  member_id uuid primary key references public.field_team_members(id) on delete cascade
);

create table field_team_private.staff_registrations (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.field_team_members(id) on delete cascade,
  email text not null,
  role text not null check (role in ('manager','worker')),
  expires_at timestamptz not null default now() + interval '15 minutes'
);
create index field_team_staff_registrations_expiry on field_team_private.staff_registrations(expires_at);
revoke all on field_team_private.app_admins, field_team_private.staff_registrations from public, anon, authenticated, service_role;

create function field_team_private.is_app_admin(p_member uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists(select 1 from field_team_private.app_admins where member_id = p_member)
$$;
revoke all on function field_team_private.is_app_admin(uuid) from public, anon, authenticated, service_role;

create function field_team_private.can_view_member(p_target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not field_team_private.is_app_admin(p_target)
    or p_target = auth.uid()
    or (field_team_private.member_role() = 'manager' and field_team_private.is_app_admin(auth.uid()))
$$;
revoke all on function field_team_private.can_view_member(uuid) from public, anon, authenticated;
grant execute on function field_team_private.can_view_member(uuid) to authenticated;

alter policy field_team_members_read on public.field_team_members
using (active and (id = (select auth.uid()) or (select field_team_private.member_role()) = 'manager')
  and field_team_private.can_view_member(id));

create or replace function public.field_team_list_accounts()
returns table (id uuid, name text, role text, active boolean, email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if field_team_private.member_role() is distinct from 'manager' then
    raise exception 'Korisnicima upravlja šef ili admin.' using errcode = '42501';
  end if;
  return query select member.id, member.name,
    case when field_team_private.is_app_admin(member.id) then 'admin' else member.role end,
    member.active, account.email::text
    from public.field_team_members member join auth.users account using (id)
    where account.deleted_at is null and field_team_private.can_view_member(member.id)
    order by lower(member.name), member.id;
end
$$;

-- A short-lived registration token keeps the creator's identity out of the new user's JWT.
create function public.field_team_prepare_account(p_actor uuid, p_email text, p_role text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare registration uuid;
begin
  if not exists (select 1 from public.field_team_members where id = p_actor and active and role = 'manager') then
    raise exception 'Korisnicima upravlja šef ili admin.' using errcode = '42501';
  end if;
  delete from field_team_private.staff_registrations where expires_at <= now();
  insert into field_team_private.staff_registrations(actor_id,email,role)
    values (p_actor,lower(btrim(p_email)),p_role) returning id into registration;
  return registration;
end
$$;
revoke all on function public.field_team_prepare_account(uuid,text,text) from public, anon, authenticated, service_role;
grant execute on function public.field_team_prepare_account(uuid,text,text) to service_role;

create or replace function field_team_private.register_staff_account()
returns trigger language plpgsql security definer set search_path = '' as $$
declare registration text := new.raw_app_meta_data->>'field_team_registration';
        creator text := new.raw_app_meta_data->>'field_team_created_by';
        actor_id uuid;
        staff_role text := 'worker';
begin
  if registration is null and creator is null then return new; end if;
  if tg_op = 'UPDATE' and registration is not distinct from old.raw_app_meta_data->>'field_team_registration'
    and creator is not distinct from old.raw_app_meta_data->>'field_team_created_by' then return new; end if;
  if registration is not null then
    delete from field_team_private.staff_registrations r
    where r.id = registration::uuid and r.email = lower(new.email) and r.expires_at > now()
    returning r.actor_id, r.role into actor_id, staff_role;
  else
    actor_id := creator::uuid;
  end if;
  perform 1 from public.field_team_members where id = actor_id and active and role = 'manager' for share;
  if not found then raise exception 'Korisnicima upravlja šef ili admin.' using errcode = '42501'; end if;
  insert into public.field_team_members(id,name,role)
    values (new.id,btrim(new.raw_user_meta_data->>'full_name'),staff_role);
  return new;
end
$$;

drop function public.field_team_link_account(uuid,text);
create function public.field_team_link_account(p_actor uuid, p_email text, p_role text default 'worker')
returns void language plpgsql security definer set search_path = '' as $$
declare account_id uuid;
        account_name text;
        linked public.field_team_members;
begin
  perform 1 from public.field_team_members where id = p_actor and active and role = 'manager' for share;
  if not found then raise exception 'Korisnicima upravlja šef ili admin.' using errcode = '42501'; end if;
  if p_role is null or p_role not in ('worker','manager') then
    raise exception 'Izaberite ulogu šefa ili majstora.' using errcode = '22023';
  end if;

  select id, left(coalesce(nullif(btrim(raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(raw_user_meta_data->>'name'), ''),split_part(email,'@',1)),100)
  into account_id, account_name from auth.users
  where email = lower(btrim(p_email)) and email_confirmed_at is not null and deleted_at is null
    and not field_team_private.is_app_admin(id)
  for key share;
  if not found then raise exception 'Nalog nije pronađen.' using errcode = 'P0002'; end if;

  insert into public.field_team_members(id,name,role) values (account_id,account_name,p_role)
  on conflict (id) do nothing;
  select * into linked from public.field_team_members where id = account_id for share;
  if field_team_private.is_app_admin(account_id) then
    raise exception 'Nalog nije pronađen.' using errcode = 'P0002';
  end if;
  if not linked.active then raise exception 'Pristup ovom nalogu je ukinut.' using errcode = '22023'; end if;
  if linked.role <> p_role then raise exception 'Nalog već ima ulogu u Stolariji.' using errcode = 'P2001'; end if;
end
$$;
revoke all on function public.field_team_link_account(uuid,text,text) from public, anon, authenticated;
grant execute on function public.field_team_link_account(uuid,text,text) to service_role;

create or replace function public.field_team_deactivate_account(p_actor uuid, p_target uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(20261115,1);
  if not exists (select 1 from public.field_team_members where id = p_actor and active and role = 'manager') then
    raise exception 'Korisnicima upravlja šef ili admin.' using errcode = '42501';
  end if;
  if p_actor = p_target then raise exception 'Ne možete obrisati svoj nalog.' using errcode = '22023'; end if;
  update public.field_team_members set active = false where id = p_target and not field_team_private.is_app_admin(id);
  if not found then raise exception 'Nalog nije pronađen.' using errcode = 'P0002'; end if;
end
$$;

-- Keep the actual actor ID for delivery and access checks, and use a team name in shared notices.
create or replace function field_team_private.require_member()
returns public.field_team_members language plpgsql stable security definer set search_path = '' as $$
declare member public.field_team_members;
begin
  select * into member from public.field_team_members where id = auth.uid() and active;
  if not found then raise exception 'Nalog nema pristup timu.' using errcode = '42501'; end if;
  if field_team_private.is_app_admin(member.id) then member.name := 'ALU TIM 012'; end if;
  return member;
end
$$;

create or replace function field_team_private.visible_job(job public.field_team_jobs, viewer_role text)
returns public.field_team_jobs language plpgsql stable set search_path = '' as $$
begin
  if job.assigned_to is not null and job.data->>'status' = 'Merenje'
    and (viewer_role = 'manager' or job.assigned_to is distinct from auth.uid()) then
    job.data := jsonb_set(job.data,'{positions}','[]'::jsonb);
  end if;
  if not field_team_private.can_view_member(job.created_by) then job.created_by := null; end if;
  if not field_team_private.can_view_member(job.assigned_by) then job.assigned_by := null; end if;
  return job;
end
$$;

create or replace view public.field_team_visible_jobs with (security_barrier = true) as
select job.id, visible.data, job.assigned_to, visible.assigned_by, job.revision, job.assignee_only
from public.field_team_jobs job
cross join (select field_team_private.member_role() as role) viewer
cross join lateral field_team_private.visible_job(job,viewer.role) visible
where field_team_private.can_browse_job(job.assigned_to,job.assignee_only,viewer.role);

alter policy field_team_messages_read on public.field_team_messages
using (field_team_private.can_read_job(job_id) and field_team_private.can_view_member(sender_id));

create view public.field_team_visible_messages with (security_barrier = true) as
select id, job_id,
       case when field_team_private.can_view_member(sender_id) then sender_id end as sender_id,
       case when field_team_private.can_view_member(sender_id) then sender_name else 'ALU TIM 012' end as sender_name,
       body, created_at
from public.field_team_messages where field_team_private.can_read_job(job_id);
revoke all on public.field_team_visible_messages from public, anon, authenticated;
grant select on public.field_team_visible_messages to authenticated;

create or replace view public.field_team_message_inbox with (security_barrier = true) as
select last_message.id, last_message.job_id,
       case when field_team_private.can_view_member(last_message.sender_id) then last_message.sender_id end as sender_id,
       case when field_team_private.can_view_member(last_message.sender_id) then last_message.sender_name else 'ALU TIM 012' end as sender_name,
       last_message.body, last_message.created_at, job.data #>> '{customer,name}' as job_name,
       last_message.sender_id is distinct from (select auth.uid()) and
         (seen.message_id is null or (seen.message_at,seen.message_id) < (last_message.created_at,last_message.id)) as unread
from public.field_team_jobs job
cross join (select field_team_private.member_role() as role) viewer
cross join lateral (
  select m.* from public.field_team_messages m where m.job_id = job.id
  order by m.created_at desc, m.id desc limit 1
) last_message
left join field_team_private.message_reads seen on seen.job_id = job.id and seen.member_id = (select auth.uid())
where viewer.role = 'manager' or (viewer.role = 'worker' and job.assigned_to = (select auth.uid()));

create function field_team_private.document_author()
returns uuid language sql stable security definer set search_path = '' as $$
  select case when field_team_private.is_app_admin(auth.uid()) then '00000000-0000-4000-8000-000000000000'::uuid else auth.uid() end
$$;
revoke all on function field_team_private.document_author() from public, anon, authenticated;
grant execute on function field_team_private.document_author() to authenticated;

create function public.field_team_my_profile()
returns table (id uuid, name text, role text, active boolean, is_admin boolean, document_author uuid)
language sql stable security definer set search_path = '' as $$
  select m.id,m.name,m.role,m.active,field_team_private.is_app_admin(m.id),field_team_private.document_author()
  from public.field_team_members m where m.id = auth.uid() and m.active
$$;
revoke all on function public.field_team_my_profile() from public, anon, authenticated;
grant execute on function public.field_team_my_profile() to authenticated;

alter policy field_team_documents_create on storage.objects
with check (
  bucket_id = 'alutim-job-documents'
  and field_team_private.can_access_document(name)
  and field_team_private.can_read_job(split_part(name,'/',2))
  and split_part(split_part(name,'/',4),'_',1) = (select field_team_private.document_author())::text
);

notify pgrst, 'reload schema';
commit;
