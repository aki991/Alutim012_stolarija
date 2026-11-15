begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('alutim-job-documents', 'alutim-job-documents', false, 20971520, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create function field_team_private.can_access_document(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_path ~ '^stolarija/AT-[A-Za-z0-9-]{1,80}/(kupac|kancelarija)/[a-f0-9-]{36}_(cene|bez-cena)_[a-f0-9]{64}\.pdf$'
    and exists (
      select 1
      from public.field_team_jobs job
      cross join (select field_team_private.member_role() as role) viewer
      where job.id = split_part(p_path, '/', 2)
        and (
          (viewer.role = 'manager' and (job.assigned_to is null or job.data->>'status' <> 'Merenje'))
          or (viewer.role = 'worker' and job.assigned_to = auth.uid())
        )
    )
$$;
revoke all on function field_team_private.can_access_document(text) from public, anon, authenticated;
grant execute on function field_team_private.can_access_document(text) to authenticated;

create policy field_team_documents_read on storage.objects for select to authenticated
using (bucket_id = 'alutim-job-documents' and field_team_private.can_access_document(name));
create policy field_team_documents_create on storage.objects for insert to authenticated
with check (
  bucket_id = 'alutim-job-documents'
  and field_team_private.can_access_document(name)
  and split_part(split_part(name, '/', 4), '_', 1) = (select auth.uid())::text
);

commit;
