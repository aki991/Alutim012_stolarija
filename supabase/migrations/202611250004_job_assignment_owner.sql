begin;

-- The sender owns an existing measurement request, regardless of other staff roles.
create function field_team_private.guard_assignment_owner()
returns trigger language plpgsql set search_path = '' as $$
declare recipient_name text;
begin
 if auth.uid() is null then return new; end if;
 if new.assigned_to is not distinct from old.assigned_to
    and new.assigned_by is not distinct from old.assigned_by
    and new.assignee_only is not distinct from old.assignee_only then return new; end if;
 if field_team_private.member_role() is distinct from 'manager' then
  raise exception 'Dodelu merenja može da promeni samo šef koji je poslao zahtev.' using errcode='42501';
 end if;
 if old.assigned_by is not null and old.assigned_by is distinct from auth.uid() then
  raise exception 'Dodelu merenja može da promeni samo osoba koja je poslala zahtev.' using errcode='42501';
 end if;
 if new.assigned_to is distinct from old.assigned_to or new.assigned_by is distinct from old.assigned_by then
  new.assigned_by := auth.uid();
 end if;
 if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
  select name into recipient_name from public.field_team_members where id=new.assigned_to;
  if recipient_name is not null then new.data:=jsonb_set(new.data,'{technician}',to_jsonb(recipient_name)); end if;
 end if;
 return new;
end
$$;
revoke all on function field_team_private.guard_assignment_owner() from public,anon,authenticated;
create trigger field_team_guard_assignment_owner
before update of assigned_to,assigned_by,assignee_only on public.field_team_jobs
for each row execute function field_team_private.guard_assignment_owner();

-- Keep existing columns in place so older clients remain compatible.
create or replace view public.field_team_visible_jobs with (security_barrier=true) as
select job.id,visible.data,job.assigned_to,visible.assigned_by,job.revision,job.assignee_only,
 visible.created_by,
 coalesce(creator.name,case when job.created_by is not null then 'Administrator' end) as created_by_name,
 coalesce(sender.name,case when job.assigned_by is not null then 'Administrator' end) as assigned_by_name,
 recipient.name as assigned_to_name,
 (viewer.role='manager' and (job.assigned_by is null or job.assigned_by=auth.uid())) as can_reassign
from public.field_team_jobs job
cross join (select field_team_private.member_role() as role) viewer
cross join lateral field_team_private.visible_job(job,viewer.role) visible
left join public.field_team_members creator on creator.id=visible.created_by
left join public.field_team_members sender on sender.id=visible.assigned_by
left join public.field_team_members recipient on recipient.id=job.assigned_to
where job.deleted_at is null
 and field_team_private.can_browse_job(job.assigned_to,job.assignee_only,viewer.role);

notify pgrst,'reload schema';
commit;
