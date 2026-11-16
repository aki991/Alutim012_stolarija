begin;

alter table public.field_team_jobs add column deleted_at timestamptz;
create index field_team_jobs_trash_order on public.field_team_jobs(deleted_at desc,id) where deleted_at is not null;

create view public.field_team_trashed_jobs with (security_barrier = true) as
select job.id, job.data #>> '{customer,name}' as name, job.data #>> '{customer,address}' as address, job.deleted_at
from public.field_team_jobs job
where job.deleted_at is not null and (select field_team_private.member_role()) = 'manager';

revoke all on public.field_team_trashed_jobs from public, anon, authenticated;
grant select on public.field_team_trashed_jobs to authenticated;

-- Retain the row and its related messages, notifications and stored documents.
create function field_team_private.move_job_to_trash(p_id text, p_expected jsonb, p_revision bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare actor public.field_team_members := field_team_private.require_member();
        job public.field_team_jobs;
        visible public.field_team_jobs;
begin
  if actor.role <> 'manager' then raise exception 'Posao može da obriše samo šef.' using errcode = '42501'; end if;
  select * into job from public.field_team_jobs where id = p_id for update;
  if not found or job.deleted_at is not null then return; end if;
  visible := field_team_private.visible_job(job,actor.role);
  if (p_revision is not null and job.revision <> p_revision)
    or visible.data - 'updated' is distinct from p_expected - 'updated' then
    raise exception 'Posao je u međuvremenu izmenjen.' using errcode = '40001';
  end if;
  update public.field_team_jobs
  set deleted_at = clock_timestamp(), updated_at = now(), revision = revision + 1
  where id = p_id;
  if to_regclass('field_team_private.push_deliveries') is not null then
    delete from field_team_private.push_deliveries delivery using public.field_team_notifications notice
    where delivery.notice_id = notice.id and notice.job_id = p_id;
  end if;
end
$$;
revoke all on function field_team_private.move_job_to_trash(text,jsonb,bigint) from public, anon, authenticated;

-- Keep the existing signature for older app versions.
create or replace function public.field_team_delete_job(p_id text, p_expected jsonb)
returns void language sql security definer set search_path = '' as $$
  select field_team_private.move_job_to_trash(p_id,p_expected,null)
$$;

create function public.field_team_delete_job(p_id text, p_expected jsonb, p_revision bigint)
returns void language sql security definer set search_path = '' as $$
  select field_team_private.move_job_to_trash(p_id,p_expected,p_revision)
$$;

create function public.field_team_restore_job(p_id text, p_deleted_at timestamptz)
returns public.field_team_jobs language plpgsql security definer set search_path = '' as $$
declare actor public.field_team_members := field_team_private.require_member();
        job public.field_team_jobs;
begin
  if actor.role <> 'manager' then raise exception 'Posao iz korpe može da vrati samo šef.' using errcode = '42501'; end if;
  select * into job from public.field_team_jobs where id = p_id for update;
  if not found then raise exception 'Posao nije pronađen.' using errcode = '22023'; end if;
  if job.deleted_at is not null then
    if job.deleted_at is distinct from p_deleted_at then
      raise exception 'Posao je u međuvremenu ponovo premešten u korpu.' using errcode = '40001';
    end if;
    update public.field_team_jobs set deleted_at = null, updated_at = now(), revision = revision + 1
    where id = p_id returning * into job;
  end if;
  return field_team_private.visible_job(job,actor.role);
end
$$;

revoke all on function public.field_team_delete_job(text,jsonb,bigint), public.field_team_restore_job(text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.field_team_delete_job(text,jsonb,bigint), public.field_team_restore_job(text,timestamptz)
  to authenticated;

-- Archived rows are excluded from active jobs, messages, notices and documents.

create or replace function field_team_private.can_read_job(p_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.field_team_jobs
    where id = p_id and deleted_at is null and (
      field_team_private.member_role() = 'manager'
      or (field_team_private.member_role() = 'worker' and assigned_to = auth.uid())
    )
  )
$$;

create or replace view public.field_team_visible_jobs with (security_barrier = true) as
select job.id, visible.data, job.assigned_to, visible.assigned_by, job.revision, job.assignee_only
from public.field_team_jobs job
cross join (select field_team_private.member_role() as role) viewer
cross join lateral field_team_private.visible_job(job,viewer.role) visible
where job.deleted_at is null and field_team_private.can_browse_job(job.assigned_to,job.assignee_only,viewer.role);

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
where job.deleted_at is null and (viewer.role = 'manager' or (viewer.role = 'worker' and job.assigned_to = (select auth.uid())));

create or replace function field_team_private.can_access_document(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_path ~ '^stolarija/AT-[A-Za-z0-9-]{1,80}/(kupac|kancelarija)/[a-f0-9-]{36}_(cene|bez-cena)_[a-f0-9]{64}\.pdf$'
    and exists (
      select 1 from public.field_team_jobs job
      cross join (select field_team_private.member_role() as role) viewer
      where job.id = split_part(p_path, '/', 2) and job.deleted_at is null
        and field_team_private.can_browse_job(job.assigned_to,job.assignee_only,viewer.role)
        and (job.assigned_to is null or job.data->>'status' <> 'Merenje'
          or job.assigned_to = auth.uid())
    )
$$;

-- Existing mutations continue to lock the active row before changing it.

create or replace function field_team_private.field_team_create_job(p_job jsonb, p_assignee uuid, p_message text, p_assignee_only boolean)
returns public.field_team_jobs language plpgsql security definer set search_path = '' as $$
declare actor public.field_team_members := field_team_private.require_member();
        result public.field_team_jobs;
        note text := btrim(coalesce(p_message,''));
begin
  if p_assignee is not null then
    if actor.role <> 'manager' then raise exception 'Dodelu može da izvrši samo šef.' using errcode = '42501'; end if;
    if not exists(select 1 from public.field_team_members where id = p_assignee and active
      and field_team_private.can_view_member(id)) then
      raise exception 'Izaberite aktivnog zaposlenog.' using errcode = '22023';
    end if;
    if length(btrim(coalesce(p_job#>>'{customer,address}', ''))) = 0 then
      raise exception 'Unesite adresu merenja.' using errcode = '22023';
    end if;
    p_job := jsonb_set(p_job, '{status}', '"Merenje"');
  end if;
  perform field_team_private.validate_job(p_job);
  if length(note) > 4000 then raise exception 'Poruka može imati najviše 4000 znakova.' using errcode = '22023'; end if;
  insert into public.field_team_jobs(id,data,created_by,assigned_to,assigned_by,assignee_only)
  values (p_job->>'id',p_job,actor.id,case when actor.role = 'worker' then actor.id else p_assignee end,
          case when p_assignee is not null then actor.id end,
          p_assignee is null or coalesce(p_assignee_only,false))
  on conflict(id) do nothing returning * into result;
  if not found then
    select * into result from public.field_team_jobs where id = p_job->>'id' and created_by = actor.id and deleted_at is null
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

create or replace function field_team_private.field_team_assign(p_id text, p_assignee uuid, p_message text, p_date text)
returns public.field_team_jobs language plpgsql security definer set search_path = '' as $$
declare actor public.field_team_members := field_team_private.require_member();
        result public.field_team_jobs;
        note text := btrim(coalesce(p_message,''));
begin
  if actor.role <> 'manager' then raise exception 'Dodelu može da izvrši samo šef.' using errcode = '42501'; end if;
  if not exists(select 1 from public.field_team_members where id = p_assignee and active
      and field_team_private.can_view_member(id)) then
    raise exception 'Izaberite aktivnog zaposlenog.' using errcode = '22023';
  end if;
  if length(note) > 4000 then raise exception 'Poruka može imati najviše 4000 znakova.' using errcode = '22023'; end if;
  select * into result from public.field_team_jobs where id = p_id and deleted_at is null for update;
  if not found then raise exception 'Posao nije pronađen.' using errcode = '22023'; end if;
  if result.assigned_to = p_assignee then return result; end if;
  update public.field_team_jobs set assigned_to = p_assignee, assigned_by = actor.id,
    data = case when p_date is null then data else jsonb_set(data,'{date}',to_jsonb(p_date)) end,
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

create or replace function public.field_team_update_job(p_id text, p_patch jsonb, p_expected jsonb)
returns public.field_team_jobs language plpgsql security definer set search_path = '' as $$
declare actor public.field_team_members := field_team_private.require_member();
        job public.field_team_jobs;
        next_status text;
begin
  select * into job from public.field_team_jobs where id = p_id and deleted_at is null for update;
  if not found or (actor.role <> 'manager' and job.assigned_to is distinct from actor.id) then
    raise exception 'Nemate pristup poslu.' using errcode = '42501';
  end if;
  if job.assigned_to is not null and job.data->>'status' = 'Merenje' then
    next_status := coalesce(p_patch->>'status', 'Merenje');
    if actor.id is distinct from job.assigned_to and (p_patch ? 'positions' or next_status <> 'Merenje') then
      raise exception 'Sačekajte da zadužena osoba završi merenje.' using errcode = '42501';
    end if;
    if actor.id = job.assigned_to and next_status <> 'Merenje' and (
        next_status <> 'Poslati ponudu' or jsonb_array_length(job.data->'positions') = 0 or p_patch ? 'positions'
      ) then
      raise exception 'Sačuvajte elemente i završite merenje pre promene statusa.' using errcode = '22023';
    end if;
  end if;
  return field_team_private.visible_job(field_team_private.field_team_update_job(p_id,p_patch,p_expected),actor.role);
end
$$;

create or replace function public.field_team_send_message(p_id text, p_message_id uuid, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor public.field_team_members := field_team_private.require_member();
        job public.field_team_jobs;
        note text := btrim(coalesce(p_body,''));
begin
  select * into job from public.field_team_jobs where id = p_id and deleted_at is null for share;
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
    (actor.id is distinct from job.assigned_to and id = job.assigned_to)
    or (actor.id = job.assigned_to and role = 'manager' and (
      id = job.assigned_by or not exists(
        select 1 from public.field_team_members where id = job.assigned_by and id <> actor.id and active and role = 'manager'
      )
    ))
  );
end
$$;

notify pgrst, 'reload schema';

commit;
