begin;

-- Retain the visibility of jobs already saved. Sharing is the default when assigning a new job.
alter table public.field_team_jobs add column assignee_only boolean not null default true;

create function field_team_private.can_browse_job(p_assignee uuid, p_assignee_only boolean, p_role text)
returns boolean language sql stable set search_path = '' as $$
  select p_role = 'manager' or (p_role = 'worker' and (not p_assignee_only or p_assignee = auth.uid()))
$$;
revoke all on function field_team_private.can_browse_job(uuid,boolean,text) from public, anon, authenticated;
grant execute on function field_team_private.can_browse_job(uuid,boolean,text) to authenticated;

create or replace function field_team_private.visible_job(job public.field_team_jobs, viewer_role text)
returns public.field_team_jobs language plpgsql stable set search_path = '' as $$
begin
  if job.assigned_to is not null and job.data->>'status' = 'Merenje'
    and (viewer_role = 'manager' or job.assigned_to is distinct from auth.uid()) then
    job.data := jsonb_set(job.data, '{positions}', '[]'::jsonb);
  end if;
  return job;
end
$$;

create or replace view public.field_team_visible_jobs with (security_barrier = true) as
select job.id, (field_team_private.visible_job(job,viewer.role)).data,
       job.assigned_to, job.assigned_by, job.revision, job.assignee_only
from public.field_team_jobs job
cross join (select field_team_private.member_role() as role) viewer
where field_team_private.can_browse_job(job.assigned_to,job.assignee_only,viewer.role);

drop function public.field_team_create_job(jsonb,uuid,text);
drop function field_team_private.field_team_create_job(jsonb,uuid,text);
create function field_team_private.field_team_create_job(p_job jsonb, p_assignee uuid, p_message text, p_assignee_only boolean)
returns public.field_team_jobs language plpgsql security definer set search_path = '' as $$
declare actor public.field_team_members := field_team_private.require_member();
        result public.field_team_jobs;
        note text := btrim(coalesce(p_message,''));
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
  insert into public.field_team_jobs(id,data,created_by,assigned_to,assigned_by,assignee_only)
  values (p_job->>'id',p_job,actor.id,case when actor.role = 'worker' then actor.id else p_assignee end,
          case when p_assignee is not null then actor.id end,
          p_assignee is null or coalesce(p_assignee_only,false))
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
revoke all on function field_team_private.field_team_create_job(jsonb,uuid,text,boolean) from public, anon, authenticated;

create function public.field_team_create_job(p_job jsonb, p_assignee uuid default null, p_message text default '', p_assignee_only boolean default false)
returns public.field_team_jobs language sql security definer set search_path = '' as $$
  select field_team_private.visible_job(field_team_private.field_team_create_job(
    case when field_team_private.member_role() = 'worker' then jsonb_set(p_job,'{status}','"Merenje"') else p_job end,
    p_assignee,p_message,p_assignee_only),
    field_team_private.member_role())
$$;

drop function public.field_team_assign(text,uuid,text);
create function public.field_team_assign(p_id text, p_assignee uuid, p_message text default '', p_assignee_only boolean default null)
returns public.field_team_jobs language plpgsql security definer set search_path = '' as $$
declare result public.field_team_jobs;
begin
  -- The private assignment function authorizes the manager and locks the job through this transaction.
  result := field_team_private.field_team_assign(p_id,p_assignee,p_message);
  if p_assignee_only is not null and result.assignee_only is distinct from p_assignee_only then
    update public.field_team_jobs set assignee_only = p_assignee_only,
      updated_at = now(), revision = revision + 1 where id = p_id returning * into result;
  end if;
  return field_team_private.visible_job(result,'manager');
end
$$;

revoke all on function public.field_team_create_job(jsonb,uuid,text,boolean), public.field_team_assign(text,uuid,text,boolean)
  from public, anon, authenticated;
grant execute on function public.field_team_create_job(jsonb,uuid,text,boolean), public.field_team_assign(text,uuid,text,boolean)
  to authenticated;

create or replace function field_team_private.can_access_document(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_path ~ '^stolarija/AT-[A-Za-z0-9-]{1,80}/(kupac|kancelarija)/[a-f0-9-]{36}_(cene|bez-cena)_[a-f0-9]{64}\.pdf$'
    and exists (
      select 1 from public.field_team_jobs job
      cross join (select field_team_private.member_role() as role) viewer
      where job.id = split_part(p_path, '/', 2)
        and field_team_private.can_browse_job(job.assigned_to,job.assignee_only,viewer.role)
        and (job.assigned_to is null or job.data->>'status' <> 'Merenje'
          or (viewer.role = 'worker' and job.assigned_to = auth.uid()))
    )
$$;
alter policy field_team_documents_create on storage.objects
with check (
  bucket_id = 'alutim-job-documents'
  and field_team_private.can_access_document(name)
  and field_team_private.can_read_job(split_part(name, '/', 2))
  and split_part(split_part(name, '/', 4), '_', 1) = (select auth.uid())::text
);

notify pgrst, 'reload schema';
commit;
