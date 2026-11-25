begin;

alter table public.field_team_pricing add column worker_prices_visible boolean not null default true;

create function public.field_team_set_worker_prices(p_visible boolean, p_revision bigint)
returns public.field_team_pricing language plpgsql security definer set search_path = '' as $$
declare saved public.field_team_pricing;
begin
  if field_team_private.member_role() is distinct from 'manager' then
    raise exception 'Prikaz cena majstorima podešava samo šef.' using errcode = '42501';
  end if;
  if p_visible is null then
    raise exception 'Izaberite da li se cene prikazuju majstorima.' using errcode = '22023';
  end if;
  update public.field_team_pricing
  set worker_prices_visible = p_visible, revision = revision + 1
  where id and revision = p_revision returning * into saved;
  if not found then
    raise exception 'Podešavanja su u međuvremenu izmenjena. Osvežite podatke i pokušajte ponovo.' using errcode = '40001';
  end if;
  return saved;
end
$$;
revoke all on function public.field_team_set_worker_prices(boolean,bigint) from public, anon, authenticated;
grant execute on function public.field_team_set_worker_prices(boolean,bigint) to authenticated;

notify pgrst, 'reload schema';
commit;
