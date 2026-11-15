begin;

create table public.field_team_pricing (
  id boolean primary key default true check (id),
  prices jsonb not null default '{}',
  porta_royal_prices jsonb not null default '{}',
  vat numeric not null default 20 check (vat between 0 and 100),
  vat_mode text not null default 'exclusive' check (vat_mode in ('exclusive', 'inclusive', 'none')),
  revision bigint not null default 0
);
insert into public.field_team_pricing default values;
alter table public.field_team_pricing enable row level security;
revoke all on public.field_team_pricing from public, anon, authenticated;
grant select on public.field_team_pricing to authenticated;
create policy field_team_pricing_read on public.field_team_pricing for select to authenticated
using ((select field_team_private.member_role()) in ('manager', 'worker'));

create function public.field_team_save_pricing(p_prices jsonb, p_porta_royal_prices jsonb,
  p_vat numeric, p_vat_mode text, p_revision bigint)
returns public.field_team_pricing language plpgsql security definer set search_path = '' as $$
declare saved public.field_team_pricing;
begin
  if field_team_private.member_role() is distinct from 'manager' then
    raise exception 'Cene može da menja samo administrator.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_prices) is distinct from 'object' or jsonb_typeof(p_porta_royal_prices) is distinct from 'object'
    or length(p_prices::text) + length(p_porta_royal_prices::text) > 16000
    or p_vat is null or p_vat not between 0 and 100
    or p_vat_mode is null or p_vat_mode not in ('exclusive', 'inclusive', 'none') then
    raise exception 'Proverite vrednosti u cenovniku.' using errcode = '22023';
  end if;
  if exists (
    select 1 from (
      select value from jsonb_each(p_prices) union all select value from jsonb_each(p_porta_royal_prices)
    ) rates where case when jsonb_typeof(value) = 'number' then value::numeric not between 0 and 100000000 else true end
  ) then
    raise exception 'Cene moraju biti pozitivni iznosi ili nula.' using errcode = '22023';
  end if;
  update public.field_team_pricing
    set prices = p_prices, porta_royal_prices = p_porta_royal_prices, vat = p_vat,
        vat_mode = p_vat_mode, revision = revision + 1
    where id and revision = p_revision returning * into saved;
  if not found then
    raise exception 'Cenovnik je u međuvremenu izmenjen. Učitajte poslednje cene.' using errcode = '40001';
  end if;
  return saved;
end
$$;

create function field_team_private.position_price_fields(p_position jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_array(p_position->'manualPrice', coalesce(nullif(p_position->'extraCost', 'null'), '0'))
$$;

create function field_team_private.guard_job_prices()
returns trigger language plpgsql set search_path = '' as $$
declare previous jsonb;
        previous_positions jsonb := '[]';
        actor_role text;
        field text;
        transport jsonb;
begin
  if auth.uid() is null then return new; end if;
  actor_role := field_team_private.member_role();
  if actor_role = 'manager' then return new; end if;
  if actor_role is distinct from 'worker' then
    raise exception 'Nalog nema pristup timu.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    select prices->'transport' into transport from public.field_team_pricing where id;
    new.data := jsonb_set(new.data, '{transport}', coalesce(transport, '35'));
    previous := jsonb_build_object('package', 'Standard', 'discount', 0, 'extraCost', 0, 'transport', new.data->'transport');
  else
    previous := old.data;
    previous_positions := old.data->'positions';
  end if;

  foreach field in array array['package', 'discount', 'discountMode', 'surcharge', 'surchargeMode',
    'manualTotal', 'transport', 'extraCost', 'vat', 'vatMode'] loop
    if nullif(new.data->field, 'null') is distinct from nullif(previous->field, 'null') then
      raise exception 'Cene može da menja samo administrator.' using errcode = '42501';
    end if;
  end loop;
  if new.data->'positions' is not distinct from previous_positions then return new; end if;
  if exists (
    select 1 from jsonb_array_elements(new.data->'positions') position
    group by position->>'id' having position->>'id' is null or count(*) > 1
  ) then
    raise exception 'Pozicije moraju imati različite oznake.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.data->'positions') next_position
    full join jsonb_array_elements(previous_positions) old_position on next_position->>'id' = old_position->>'id'
    where field_team_private.position_price_fields(next_position)
      is distinct from field_team_private.position_price_fields(old_position)
  ) then
    raise exception 'Cene može da menja samo administrator.' using errcode = '42501';
  end if;
  return new;
end
$$;
-- The existing job RPCs invoke the trigger as their owner, while auth.uid() identifies the caller.
create trigger field_team_guard_job_prices before insert or update of data on public.field_team_jobs
for each row execute function field_team_private.guard_job_prices();

create function public.field_team_list_accounts()
returns table (id uuid, name text, role text, active boolean, email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if field_team_private.member_role() is distinct from 'manager' then
    raise exception 'Korisnicima upravlja samo administrator.' using errcode = '42501';
  end if;
  return query select member.id, member.name, member.role, member.active, account.email::text
    from public.field_team_members member join auth.users account using (id)
    where account.deleted_at is null order by lower(member.name), member.id;
end
$$;

-- Auth writes app_metadata in the account creation transaction. Only the server can set it.
create function field_team_private.register_staff_account()
returns trigger language plpgsql security definer set search_path = '' as $$
declare administrator uuid := (new.raw_app_meta_data->>'field_team_created_by')::uuid;
begin
  if administrator is null then return new; end if;
  if tg_op = 'UPDATE' and new.raw_app_meta_data->>'field_team_created_by' is not distinct from
    old.raw_app_meta_data->>'field_team_created_by' then return new; end if;
  perform 1 from public.field_team_members where id = administrator and active and role = 'manager' for share;
  if not found then
    raise exception 'Korisnicima upravlja samo administrator.' using errcode = '42501';
  end if;
  insert into public.field_team_members(id, name, role)
    values (new.id, btrim(new.raw_user_meta_data->>'full_name'), 'worker');
  return new;
end
$$;
create trigger field_team_register_staff after insert or update of raw_app_meta_data on auth.users
for each row execute function field_team_private.register_staff_account();

-- Revoke database access before removing the Auth credentials, including for existing JWTs.
create function public.field_team_deactivate_account(p_actor uuid, p_target uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(20261115, 1);
  if not exists (select 1 from public.field_team_members where id = p_actor and active and role = 'manager') then
    raise exception 'Korisnicima upravlja samo administrator.' using errcode = '42501';
  end if;
  if p_actor = p_target then
    raise exception 'Ne možete obrisati svoj nalog.' using errcode = '22023';
  end if;
  update public.field_team_members set active = false where id = p_target;
  if not found then raise exception 'Nalog nije pronađen.' using errcode = 'P0002'; end if;
end
$$;

revoke all on function field_team_private.position_price_fields(jsonb), field_team_private.guard_job_prices(),
  field_team_private.register_staff_account() from public, anon, authenticated;
revoke all on function public.field_team_save_pricing(jsonb,jsonb,numeric,text,bigint),
  public.field_team_list_accounts(), public.field_team_deactivate_account(uuid,uuid) from public, anon, authenticated;
grant execute on function public.field_team_save_pricing(jsonb,jsonb,numeric,text,bigint),
  public.field_team_list_accounts() to authenticated;
grant execute on function public.field_team_deactivate_account(uuid,uuid) to service_role;

notify pgrst, 'reload schema';
commit;
