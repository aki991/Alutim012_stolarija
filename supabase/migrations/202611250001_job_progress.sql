begin;

create or replace function field_team_private.validate_job(p_data jsonb)
returns void language plpgsql set search_path = '' as $$
declare field text; value text;
begin
  if jsonb_typeof(p_data) is distinct from 'object'
    or coalesce(p_data->>'id', '') !~ '^AT-[A-Za-z0-9-]{1,80}$'
    or length(btrim(coalesce(p_data#>>'{customer,name}', ''))) not between 1 and 150
    or jsonb_typeof(p_data->'positions') is distinct from 'array'
    or coalesce(p_data->>'status','') not in ('Merenje','Poslati ponudu','Ponuda','Prihvaćeno','Odbijeno','U izradi','Završeno','Ugrađeno') then
    raise exception 'Podaci posla nisu ispravni.' using errcode = '22023';
  end if;
  foreach field in array array['completionDeadline','measuredOn','completedOn','installedOn'] loop
    if not (p_data ? field) then continue; end if;
    value := p_data->>field;
    if jsonb_typeof(p_data->field) is distinct from 'string' then
      raise exception 'Datum posla nije ispravan.' using errcode = '22023';
    end if;
    if value = '' then continue; end if;
    if value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char(value::date,'YYYY-MM-DD') <> value then
      raise exception 'Datum posla nije ispravan.' using errcode = '22023';
    end if;
  end loop;
end
$$;

-- Keep the displayed assignee in sync when a job is reassigned, including old jobs.
update public.field_team_jobs job
set data = jsonb_set(job.data,'{technician}',to_jsonb(member.name)),
    revision = job.revision + 1, updated_at = now()
from public.field_team_members member
where member.id = job.assigned_to and job.data->>'technician' is distinct from member.name;

create function field_team_private.record_job_progress()
returns trigger language plpgsql security definer set search_path = '' as $$
declare today text := to_char(statement_timestamp() at time zone 'Europe/Belgrade','YYYY-MM-DD');
        field text; assignee_name text; next_status text := new.data->>'status';
begin
  if new.assigned_to is not null then
    select name into assignee_name from public.field_team_members where id = new.assigned_to;
    if assignee_name is not null then
      new.data := jsonb_set(new.data,'{technician}',to_jsonb(assignee_name));
    end if;
  end if;
  if tg_op = 'UPDATE' then
    -- Once recorded, milestone dates survive later status changes and retries.
    foreach field in array array['measuredOn','completedOn','installedOn'] loop
      if coalesce(old.data->>field,'') <> '' then
        new.data := jsonb_set(new.data,array[field],old.data->field);
      else
        new.data := new.data - field;
      end if;
    end loop;
    if old.data->>'status' = 'Merenje' and next_status not in ('Merenje','Odbijeno') then
      if coalesce(new.data->>'measuredOn','') = '' then
        new.data := jsonb_set(new.data,'{measuredOn}',to_jsonb(today));
      end if;
      if coalesce(new.data->>'completionDeadline','') = ''
        or (new.data->>'completionDeadline')::date < (new.data->>'measuredOn')::date then
        raise exception 'Unesite rok završetka, od dana merenja nadalje.' using errcode = '22023';
      end if;
    end if;
  end if;
  if (tg_op = 'INSERT' or next_status is distinct from old.data->>'status') then
    if next_status in ('Završeno','Ugrađeno') and coalesce(new.data->>'completedOn','') = '' then
      new.data := jsonb_set(new.data,'{completedOn}',to_jsonb(today));
    end if;
    if next_status = 'Ugrađeno' and coalesce(new.data->>'installedOn','') = '' then
      new.data := jsonb_set(new.data,'{installedOn}',to_jsonb(today));
    end if;
  end if;
  perform field_team_private.validate_job(new.data);
  return new;
end
$$;
revoke all on function field_team_private.record_job_progress() from public, anon, authenticated;

create trigger field_team_record_job_progress
before insert or update of data, assigned_to on public.field_team_jobs
for each row execute function field_team_private.record_job_progress();

notify pgrst, 'reload schema';
commit;
