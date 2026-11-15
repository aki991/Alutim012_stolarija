begin;

create function public.field_team_link_account(p_actor uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare account_id uuid;
        account_name text;
begin
  perform 1 from public.field_team_members where id = p_actor and active and role = 'manager' for share;
  if not found then
    raise exception 'Korisnicima upravlja samo administrator.' using errcode = '42501';
  end if;

  select id, left(coalesce(nullif(btrim(raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(raw_user_meta_data->>'name'), ''), split_part(email, '@', 1)), 100)
  into account_id, account_name
  from auth.users
  where email = lower(btrim(p_email)) and email_confirmed_at is not null and deleted_at is null
  for key share;
  if not found then
    raise exception 'Postojeći nalog nije pronađen.' using errcode = 'P0002';
  end if;

  insert into public.field_team_members as member (id, name, role)
    values (account_id, account_name, 'worker')
    on conflict (id) do nothing;
  if exists (select 1 from public.field_team_members where id = account_id and not active) then
    raise exception 'Pristup ovom nalogu je ukinut.' using errcode = '22023';
  end if;
end
$$;
revoke all on function public.field_team_link_account(uuid,text) from public, anon, authenticated;
grant execute on function public.field_team_link_account(uuid,text) to service_role;

notify pgrst, 'reload schema';
commit;
