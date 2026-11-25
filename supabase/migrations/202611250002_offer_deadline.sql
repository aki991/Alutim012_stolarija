begin;

-- Measurement can finish without a deadline. Leaving Ponuda requires a selected date.
create or replace function field_team_private.record_job_progress()
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
  if tg_op = 'UPDATE' and old.data->>'status' = 'Ponuda' and next_status <> 'Ponuda' then
    if coalesce(new.data->>'completionDeadline','') = ''
      or (nullif(new.data->>'measuredOn','') is not null
        and (new.data->>'completionDeadline')::date < (new.data->>'measuredOn')::date) then
      raise exception 'Izaberite rok završetka pre promene statusa ponude.' using errcode = '22023';
    end if;
  end if;
  return new;
end
$$;
notify pgrst, 'reload schema';
commit;
