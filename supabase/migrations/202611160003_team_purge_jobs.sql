begin;

alter table public.field_team_jobs add column purge_started boolean not null default false;

create or replace view public.field_team_trashed_jobs with (security_barrier = true) as
select job.id, job.data #>> '{customer,name}' as name, job.data #>> '{customer,address}' as address,
       job.deleted_at, job.purge_started
from public.field_team_jobs job
where job.deleted_at is not null and (select field_team_private.member_role()) = 'manager';

-- Lock in a consistent order and compare the exact deletion the manager selected.
create function field_team_private.lock_jobs_for_purge(p_jobs jsonb, p_finish boolean)
returns text[] language plpgsql security definer set search_path = '' as $$
declare actor public.field_team_members := field_team_private.require_member();
        job record;
        ids text[] := '{}';
begin
  if actor.role <> 'manager' then raise exception 'Posao može trajno da obriše samo šef.' using errcode = '42501'; end if;
  if jsonb_typeof(p_jobs) is distinct from 'array' then
    raise exception 'Izaberite poslove iz korpe.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_jobs) = 0 or exists (
    select 1 from jsonb_to_recordset(p_jobs) as selected(id text, deleted_at timestamptz)
    where selected.id is null or selected.deleted_at is null
  ) then
    raise exception 'Izaberite poslove iz korpe.' using errcode = '22023';
  end if;
  for job in
    select existing.id, existing.deleted_at, existing.purge_started, selected.deleted_at as expected
    from jsonb_to_recordset(p_jobs) as selected(id text, deleted_at timestamptz)
    join public.field_team_jobs existing using (id)
    order by existing.id for update of existing
  loop
    if job.deleted_at is distinct from job.expected or (p_finish and not job.purge_started) then
      raise exception 'Korpa je izmenjena. Učitajte je ponovo.' using errcode = '40001';
    end if;
    ids := array_append(ids,job.id);
  end loop;
  return ids;
end
$$;

create function field_team_private.purge_document_paths(p_ids text[])
returns setof text language sql stable set search_path = '' as $$
  select name from storage.objects where bucket_id = 'alutim-job-documents'
    and split_part(name,'/',1) = 'stolarija' and split_part(name,'/',2) = any(p_ids)
$$;

create function public.field_team_begin_job_purge(p_jobs jsonb)
returns text[] language plpgsql security definer set search_path = '' as $$
declare ids text[] := field_team_private.lock_jobs_for_purge(p_jobs,false);
begin
  update public.field_team_jobs set purge_started = true where id = any(ids) and not purge_started;
  return array(select field_team_private.purge_document_paths(ids));
end
$$;

create function public.field_team_finish_job_purge(p_jobs jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare ids text[] := field_team_private.lock_jobs_for_purge(p_jobs,true);
begin
  if exists(select 1 from field_team_private.purge_document_paths(ids)) then
    raise exception 'Dokumenti još nisu obrisani. Ponovite trajno brisanje.' using errcode = '40001';
  end if;
  delete from public.field_team_jobs where id = any(ids);
end
$$;

-- The Storage API can remove files after the database has reserved the job for deletion.
create function field_team_private.can_purge_job_document(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select split_part(p_path,'/',1) = 'stolarija' and field_team_private.member_role() = 'manager'
    and exists(select 1 from public.field_team_jobs
      where id = split_part(p_path,'/',2) and deleted_at is not null and purge_started)
$$;

create policy field_team_purging_documents_read on storage.objects for select to authenticated
using (bucket_id = 'alutim-job-documents' and field_team_private.can_purge_job_document(name));
create policy field_team_purging_documents_delete on storage.objects for delete to authenticated
using (bucket_id = 'alutim-job-documents' and field_team_private.can_purge_job_document(name));

create or replace function public.field_team_restore_job(p_id text, p_deleted_at timestamptz)
returns public.field_team_jobs language plpgsql security definer set search_path = '' as $$
declare actor public.field_team_members := field_team_private.require_member();
        job public.field_team_jobs;
begin
  if actor.role <> 'manager' then raise exception 'Posao iz korpe može da vrati samo šef.' using errcode = '42501'; end if;
  select * into job from public.field_team_jobs where id = p_id for update;
  if not found then raise exception 'Posao nije pronađen.' using errcode = '22023'; end if;
  if job.purge_started then raise exception 'Trajno brisanje ovog posla je pokrenuto.' using errcode = '40001'; end if;
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

revoke all on function field_team_private.lock_jobs_for_purge(jsonb,boolean), field_team_private.purge_document_paths(text[]),
  field_team_private.can_purge_job_document(text), public.field_team_begin_job_purge(jsonb), public.field_team_finish_job_purge(jsonb)
  from public, anon, authenticated;
grant execute on function field_team_private.can_purge_job_document(text), public.field_team_begin_job_purge(jsonb),
  public.field_team_finish_job_purge(jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
