begin;

create function public.field_team_authorize_profile_edit(p_actor uuid, p_target uuid)
returns table (is_admin boolean, email text)
language plpgsql security definer set search_path = '' as $$
declare actor_is_admin boolean;
begin
  perform 1 from public.field_team_members where id = p_actor and active and role = 'manager' for share;
  if not found then raise exception 'Korisnicima upravlja šef ili admin.' using errcode = '42501'; end if;
  actor_is_admin := field_team_private.is_app_admin(p_actor);
  if field_team_private.is_app_admin(p_target) and not actor_is_admin then
    raise exception 'Nalog nije pronađen.' using errcode = 'P0002';
  end if;
  return query select actor_is_admin, account.email::text
    from auth.users account join public.field_team_members member using (id)
    where account.id = p_target and account.deleted_at is null;
  if not found then raise exception 'Nalog nije pronađen.' using errcode = 'P0002'; end if;
end
$$;
revoke all on function public.field_team_authorize_profile_edit(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.field_team_authorize_profile_edit(uuid,uuid) to service_role;

-- Auth writes app_metadata and the login data in one transaction. The marker may
-- only be set by the Auth admin API and is removed before it reaches a session.
create function field_team_private.apply_profile_edit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare edit jsonb := new.raw_app_meta_data->'field_team_profile_edit';
        actor_id uuid;
        actor_is_admin boolean;
        edited_name text;
        edited_email text;
        previous_email text;
begin
  if edit is null then return new; end if;
  actor_id := (edit->>'actor_id')::uuid;
  edited_name := btrim(coalesce(edit->>'name',''));
  edited_email := edit->>'email';
  previous_email := edit->>'previous_email';

  select permission.is_admin into actor_is_admin
  from public.field_team_authorize_profile_edit(actor_id, new.id) permission;
  if length(edited_name) not between 1 and 100 then
    raise exception 'Podaci profila nisu ispravni.' using errcode = '22023';
  end if;
  if edited_email is not null and (
      new.email is distinct from edited_email or
      (not actor_is_admin and not coalesce(
        previous_email like '%@alutim012.local' and edited_email like '%@alutim012.local', false))
    ) then
    raise exception 'Stvarnu e-mail adresu za prijavu može da promeni samo admin.' using errcode = '42501';
  end if;

  update public.field_team_members set name = edited_name where id = new.id;
  if not found then raise exception 'Nalog nije pronađen.' using errcode = 'P0002'; end if;
  new.raw_app_meta_data := new.raw_app_meta_data - 'field_team_profile_edit';
  return new;
end
$$;
revoke all on function field_team_private.apply_profile_edit() from public, anon, authenticated, service_role;

create trigger field_team_apply_profile_edit
before update of raw_app_meta_data on auth.users
for each row execute function field_team_private.apply_profile_edit();

notify pgrst, 'reload schema';
commit;
