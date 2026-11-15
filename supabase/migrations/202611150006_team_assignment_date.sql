begin;

create function field_team_private.check_assignment_date()
returns trigger language plpgsql set search_path = '' as $$
declare measurement_date text := new.data->>'date';
begin
  if new.assigned_to is null or new.assigned_by is null then return new; end if;
  if tg_op = 'UPDATE' and new.assigned_to is not distinct from old.assigned_to then return new; end if;
  if measurement_date is null or measurement_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or measurement_date::date < (statement_timestamp() at time zone 'Europe/Belgrade')::date then
    raise exception 'Datum merenja mora biti današnji ili budući.' using errcode = '22007';
  end if;
  return new;
end
$$;
revoke all on function field_team_private.check_assignment_date() from public, anon, authenticated;

create trigger field_team_check_assignment_date
after insert or update of assigned_to on public.field_team_jobs
for each row execute function field_team_private.check_assignment_date();

drop function public.field_team_assign(text,uuid,text,boolean);
drop function field_team_private.field_team_assign(text,uuid,text);

create function field_team_private.field_team_assign(p_id text, p_assignee uuid, p_message text, p_date text)
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
revoke all on function field_team_private.field_team_assign(text,uuid,text,text) from public, anon, authenticated;

create function public.field_team_assign(p_id text, p_assignee uuid, p_message text default '',
  p_assignee_only boolean default null, p_date text default null)
returns public.field_team_jobs language plpgsql security definer set search_path = '' as $$
declare result public.field_team_jobs;
begin
  result := field_team_private.field_team_assign(p_id,p_assignee,p_message,p_date);
  if p_assignee_only is not null and result.assignee_only is distinct from p_assignee_only then
    update public.field_team_jobs set assignee_only = p_assignee_only,
      updated_at = now(), revision = revision + 1 where id = p_id returning * into result;
  end if;
  return field_team_private.visible_job(result,'manager');
end
$$;
revoke all on function public.field_team_assign(text,uuid,text,boolean,text) from public, anon, authenticated;
grant execute on function public.field_team_assign(text,uuid,text,boolean,text) to authenticated;

notify pgrst, 'reload schema';
commit;
