begin;

-- Managers can schedule measurements for any active team member they can see.

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

-- During measurement, assignee identity controls access for both staff roles.

create or replace function field_team_private.visible_job(job public.field_team_jobs, viewer_role text)
returns public.field_team_jobs language plpgsql stable set search_path = '' as $$
begin
  if job.assigned_to is not null and job.data->>'status' = 'Merenje'
    and job.assigned_to is distinct from auth.uid() then
    job.data := jsonb_set(job.data,'{positions}','[]'::jsonb);
  end if;
  if not field_team_private.can_view_member(job.created_by) then job.created_by := null; end if;
  if not field_team_private.can_view_member(job.assigned_by) then job.assigned_by := null; end if;
  return job;
end
$$;

create or replace function public.field_team_update_job(p_id text, p_patch jsonb, p_expected jsonb)
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

create or replace function field_team_private.can_access_document(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_path ~ '^stolarija/AT-[A-Za-z0-9-]{1,80}/(kupac|kancelarija)/[a-f0-9-]{36}_(cene|bez-cena)_[a-f0-9]{64}\.pdf$'
    and exists (
      select 1 from public.field_team_jobs job
      cross join (select field_team_private.member_role() as role) viewer
      where job.id = split_part(p_path, '/', 2)
        and field_team_private.can_browse_job(job.assigned_to,job.assignee_only,viewer.role)
        and (job.assigned_to is null or job.data->>'status' <> 'Merenje'
          or job.assigned_to = auth.uid())
    )
$$;

-- Replies from the assignee go to the manager who assigned the job.

create or replace function public.field_team_send_message(p_id text, p_message_id uuid, p_body text)
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
