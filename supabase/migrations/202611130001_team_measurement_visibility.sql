begin;

-- Keep one editable set of measurements. Only the assigned worker sees it while measuring.
create function field_team_private.visible_job(job public.field_team_jobs, viewer_role text)
returns public.field_team_jobs language plpgsql immutable set search_path = '' as $$
begin
  if viewer_role = 'manager' and job.assigned_to is not null and job.data->>'status' = 'Merenje' then
    job.data := jsonb_set(job.data, '{positions}', '[]'::jsonb);
  end if;
  return job;
end
$$;
revoke all on function field_team_private.visible_job(public.field_team_jobs,text) from public, anon, authenticated;

create view public.field_team_visible_jobs with (security_barrier = true) as
select job.id, (field_team_private.visible_job(job,viewer.role)).data,
       job.assigned_to, job.assigned_by, job.revision
from public.field_team_jobs job
cross join (select field_team_private.member_role() as role) viewer
where viewer.role = 'manager' or (viewer.role = 'worker' and job.assigned_to = (select auth.uid()));

revoke select on public.field_team_jobs from authenticated;
revoke all on public.field_team_visible_jobs from public, anon, authenticated;
grant select on public.field_team_visible_jobs to authenticated;
grant execute on function field_team_private.visible_job(public.field_team_jobs,text) to authenticated;

-- Reuse the existing transactional mutations and notifications through guarded public entry points.
alter function public.field_team_create_job(jsonb,uuid,text) set schema field_team_private;
alter function public.field_team_update_job(text,jsonb,jsonb) set schema field_team_private;
alter function public.field_team_delete_job(text,jsonb) set schema field_team_private;
alter function public.field_team_assign(text,uuid,text) set schema field_team_private;
revoke all on function field_team_private.field_team_create_job(jsonb,uuid,text),
  field_team_private.field_team_update_job(text,jsonb,jsonb), field_team_private.field_team_delete_job(text,jsonb),
  field_team_private.field_team_assign(text,uuid,text) from public, anon, authenticated;

create function public.field_team_create_job(p_job jsonb, p_assignee uuid default null, p_message text default '')
returns public.field_team_jobs language sql security definer set search_path = '' as $$
  select field_team_private.visible_job(field_team_private.field_team_create_job(
    case when field_team_private.member_role() = 'worker' then jsonb_set(p_job,'{status}','"Merenje"') else p_job end,
    p_assignee,p_message),
    field_team_private.member_role())
$$;

create function public.field_team_update_job(p_id text, p_patch jsonb, p_expected jsonb)
returns public.field_team_jobs language plpgsql security definer set search_path = '' as $$
declare actor public.field_team_members := field_team_private.require_member();
        job public.field_team_jobs;
        next_status text;
begin
  select * into job from public.field_team_jobs where id = p_id for update;
  if not found or (actor.role <> 'manager' and job.assigned_to is distinct from actor.id) then
    raise exception 'Nemate pristup poslu.' using errcode = '42501';
  end if;
  if job.assigned_to is not null and job.data->>'status' = 'Merenje' then
    next_status := coalesce(p_patch->>'status', 'Merenje');
    if actor.role = 'manager' and (p_patch ? 'positions' or next_status <> 'Merenje') then
      raise exception 'Sačekajte da majstor završi merenje.' using errcode = '42501';
    end if;
    if actor.role = 'worker' and next_status <> 'Merenje' and (
        next_status <> 'Poslati ponudu' or jsonb_array_length(job.data->'positions') = 0 or p_patch ? 'positions'
      ) then
      raise exception 'Sačuvajte elemente i završite merenje pre promene statusa.' using errcode = '22023';
    end if;
  end if;
  return field_team_private.visible_job(field_team_private.field_team_update_job(p_id,p_patch,p_expected),actor.role);
end
$$;

create function public.field_team_delete_job(p_id text, p_expected jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare actor public.field_team_members := field_team_private.require_member();
        job public.field_team_jobs;
        visible public.field_team_jobs;
begin
  if actor.role <> 'manager' then raise exception 'Posao može da obriše samo šef.' using errcode = '42501'; end if;
  select * into job from public.field_team_jobs where id = p_id for update;
  if not found then return; end if;
  visible := field_team_private.visible_job(job,actor.role);
  if visible.data - 'updated' is distinct from p_expected - 'updated' then
    raise exception 'Posao je u međuvremenu izmenjen.' using errcode = '40001';
  end if;
  perform field_team_private.field_team_delete_job(p_id,job.data);
end
$$;

create function public.field_team_assign(p_id text, p_assignee uuid, p_message text default '')
returns public.field_team_jobs language sql security definer set search_path = '' as $$
  select field_team_private.visible_job(field_team_private.field_team_assign(p_id,p_assignee,p_message),
    field_team_private.member_role())
$$;

revoke all on function public.field_team_create_job(jsonb,uuid,text), public.field_team_update_job(text,jsonb,jsonb),
  public.field_team_delete_job(text,jsonb), public.field_team_assign(text,uuid,text) from public, anon, authenticated;
grant execute on function public.field_team_create_job(jsonb,uuid,text), public.field_team_update_job(text,jsonb,jsonb),
  public.field_team_delete_job(text,jsonb), public.field_team_assign(text,uuid,text) to authenticated;

notify pgrst, 'reload schema';
commit;
