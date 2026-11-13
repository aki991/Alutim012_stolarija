begin;

create table field_team_private.message_reads (
  member_id uuid not null references public.field_team_members(id) on delete cascade,
  job_id text not null references public.field_team_jobs(id) on delete cascade,
  message_at timestamptz not null,
  message_id uuid not null,
  primary key (member_id, job_id)
);
revoke all on field_team_private.message_reads from public, anon, authenticated;

create function field_team_private.read_through(p_member uuid, p_job text, p_at timestamptz, p_message uuid)
returns void language sql set search_path = '' as $$
  insert into field_team_private.message_reads as previous (member_id, job_id, message_at, message_id)
  values (p_member, p_job, p_at, p_message)
  on conflict (member_id, job_id) do update
    set message_at = excluded.message_at, message_id = excluded.message_id
    where (previous.message_at, previous.message_id) < (excluded.message_at, excluded.message_id)
$$;
revoke all on function field_team_private.read_through(uuid,text,timestamptz,uuid) from public, anon, authenticated;

-- Previous replies and read marks carry over to the separate conversations.
with seen as (
  select sender_id as member_id, job_id, created_at, id from public.field_team_messages where sender_id is not null
  union all
  select n.recipient_id, m.job_id, m.created_at, m.id
  from public.field_team_notifications n
  join public.field_team_messages m on m.job_id = n.job_id and m.created_at = n.created_at and m.body = n.body
  where n.kind = 'message' and n.read_at is not null
)
insert into field_team_private.message_reads (member_id, job_id, message_at, message_id)
select distinct on (member_id, job_id) member_id, job_id, created_at, id
from seen order by member_id, job_id, created_at desc, id desc;

create function field_team_private.read_on_reply()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.sender_id is not null then
    perform field_team_private.read_through(new.sender_id, new.job_id, new.created_at, new.id);
  end if;
  return new;
end
$$;
revoke all on function field_team_private.read_on_reply() from public, anon, authenticated;
create trigger field_team_read_on_reply after insert on public.field_team_messages
for each row execute function field_team_private.read_on_reply();

create function public.field_team_read_messages(p_job_id text, p_message_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare message_at timestamptz;
begin
  if not field_team_private.can_read_job(p_job_id) then
    raise exception 'Nemate pristup razgovoru.' using errcode = '42501';
  end if;
  select created_at into message_at from public.field_team_messages where job_id = p_job_id and id = p_message_id;
  if not found then raise exception 'Poruka nije pronađena.' using errcode = '22023'; end if;
  perform field_team_private.read_through(auth.uid(), p_job_id, message_at, p_message_id);
end
$$;
revoke all on function public.field_team_read_messages(text,uuid) from public, anon, authenticated;
grant execute on function public.field_team_read_messages(text,uuid) to authenticated;

create view public.field_team_message_inbox with (security_barrier = true) as
select last_message.id, last_message.job_id, last_message.sender_id, last_message.sender_name,
       last_message.body, last_message.created_at, job.data #>> '{customer,name}' as job_name,
       last_message.sender_id is distinct from (select auth.uid()) and
         (seen.message_id is null or (seen.message_at, seen.message_id) < (last_message.created_at, last_message.id)) as unread
from public.field_team_jobs job
cross join (select field_team_private.member_role() as role) viewer
cross join lateral (
  select m.* from public.field_team_messages m where m.job_id = job.id
  order by m.created_at desc, m.id desc limit 1
) last_message
left join field_team_private.message_reads seen on seen.job_id = job.id and seen.member_id = (select auth.uid())
where viewer.role = 'manager' or (viewer.role = 'worker' and job.assigned_to = (select auth.uid()));

revoke all on public.field_team_message_inbox from public, anon, authenticated;
grant select on public.field_team_message_inbox to authenticated;
notify pgrst, 'reload schema';

commit;
