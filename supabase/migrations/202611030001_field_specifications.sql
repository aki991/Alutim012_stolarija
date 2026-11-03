begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('field-specifications', 'field-specifications', false, 20971520, array['application/pdf'])
on conflict (id) do update set public=false, file_size_limit=20971520, allowed_mime_types=array['application/pdf'];

create table if not exists public.field_specifications (
 id uuid primary key,
 created_at timestamptz not null default now(),
 status text not null default 'received' check (status in ('received', 'processing', 'processed', 'rejected')),
 source_app text not null default 'alu-tim-012-teren',
 format_version integer not null default 1,
 job_id text not null,
 job_updated_at text not null,
 customer_name text not null,
 technician text not null default '',
 position_count integer not null check (position_count > 0),
 total_amount numeric not null check (total_amount >= 0),
 currency text not null default 'EUR',
 has_unpriced boolean not null default false,
 bucket_id text not null default 'field-specifications',
 storage_path text not null unique,
 file_name text not null,
 file_size integer not null check (file_size between 5 and 20971520),
 content_sha256 text not null
);
create index if not exists field_specifications_created_at_idx on public.field_specifications (created_at desc);
alter table public.field_specifications enable row level security;
revoke all on public.field_specifications from anon, authenticated;
grant all on public.field_specifications to service_role;
-- No public SELECT / Storage policies. The office app must add its own authorized access.

create table if not exists public.field_submission_limits (
 key text primary key,
 hits integer not null,
 expires_at timestamptz not null
);
alter table public.field_submission_limits enable row level security;
revoke all on public.field_submission_limits from anon, authenticated;

-- Atomic quotas, shared across Edge Function instances: 30 requests / 10 min / IP,
-- and 2000 requests / UTC day for the endpoint. No raw IP addresses are stored.
create or replace function public.claim_field_submission_slot(ip_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed text; window_start bigint; day_start bigint;
begin
 if length(ip_hash) <> 64 then return false; end if;
 window_start := floor(extract(epoch from now()) / 600)::bigint;
 day_start := floor(extract(epoch from now()) / 86400)::bigint;
 delete from public.field_submission_limits where expires_at < now() - interval '1 day';
 insert into public.field_submission_limits as l (key,hits,expires_at)
 values ('ip:' || ip_hash || ':' || window_start,1,to_timestamp((window_start+1)*600))
 on conflict (key) do update set hits=l.hits+1 where l.hits<30
 returning key into claimed;
 if claimed is null then return false; end if;
 claimed := null;
 insert into public.field_submission_limits as l (key,hits,expires_at)
 values ('day:' || day_start,1,to_timestamp((day_start+1)*86400))
 on conflict (key) do update set hits=l.hits+1 where l.hits<2000
 returning key into claimed;
 return claimed is not null;
end;
$$;
revoke all on function public.claim_field_submission_slot(text) from public, anon, authenticated;
grant execute on function public.claim_field_submission_slot(text) to service_role;
commit;
