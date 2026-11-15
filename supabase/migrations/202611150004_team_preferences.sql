begin;

create table public.field_team_preferences (
  member_id uuid primary key references public.field_team_members(id) on delete cascade,
  data jsonb not null default '{}',
  revision bigint not null default 1
);
alter table public.field_team_preferences enable row level security;
revoke all on public.field_team_preferences from public, anon, authenticated;
grant select on public.field_team_preferences to authenticated;
create policy field_team_preferences_read on public.field_team_preferences for select to authenticated
using (member_id = (select auth.uid()) and (select field_team_private.member_role()) is not null);

create function public.field_team_save_preferences(p_patch jsonb)
returns public.field_team_preferences language plpgsql security definer set search_path = '' as $$
declare actor public.field_team_members := field_team_private.require_member();
        saved public.field_team_preferences;
        item record;
begin
  if jsonb_typeof(p_patch) is distinct from 'object'
    or p_patch - array['showPrices','elementDefaults','documentDefaults'] <> '{}'
    or length(p_patch::text) > 2200
    or (p_patch ? 'showPrices' and jsonb_typeof(p_patch->'showPrices') <> 'boolean') then
    raise exception 'Podešavanja nisu ispravna.' using errcode = '22023';
  end if;
  if p_patch ? 'elementDefaults' then
    if jsonb_typeof(p_patch->'elementDefaults') <> 'object'
      or not ((p_patch->'elementDefaults') ?& array['material','profile','color','glass','hardware'])
      or (p_patch->'elementDefaults') - array['material','profile','color','glass','hardware'] <> '{}' then
      raise exception 'Podešavanja elemenata nisu ispravna.' using errcode = '22023';
    end if;
    for item in select key, value from jsonb_each(p_patch->'elementDefaults') loop
      if jsonb_typeof(item.value) <> 'string' or length(item.value #>> '{}') > 200
        or (item.key = 'material' and item.value #>> '{}' not in ('PVC','ALU'))
        or (item.key = 'glass' and item.value #>> '{}' not in ('Dvoslojno','Troslojno','Sigurnosno'))
        or (item.key = 'hardware' and item.value #>> '{}' not in ('Standardni','Sigurnosni')) then
        raise exception 'Podešavanja elemenata nisu ispravna.' using errcode = '22023';
      end if;
    end loop;
  end if;
  if p_patch ? 'documentDefaults' then
    if jsonb_typeof(p_patch->'documentDefaults') <> 'object'
      or not ((p_patch->'documentDefaults') ?& array['validity','delivery','payment'])
      or (p_patch->'documentDefaults') - array['validity','delivery','payment'] <> '{}' then
      raise exception 'Uslovi ponude nisu ispravni.' using errcode = '22023';
    end if;
    for item in select key, value from jsonb_each(p_patch->'documentDefaults') loop
      if jsonb_typeof(item.value) <> 'string' or length(item.value #>> '{}') > 300 then
        raise exception 'Uslovi ponude nisu ispravni.' using errcode = '22023';
      end if;
    end loop;
  end if;

  insert into public.field_team_preferences as preferences(member_id,data)
  values (actor.id,p_patch)
  on conflict (member_id) do update
    set data = preferences.data || excluded.data, revision = preferences.revision + 1
    where preferences.data is distinct from preferences.data || excluded.data
  returning * into saved;
  if not found then
    select * into saved from public.field_team_preferences where member_id = actor.id;
  end if;
  return saved;
end
$$;
revoke all on function public.field_team_save_preferences(jsonb) from public, anon, authenticated;
grant execute on function public.field_team_save_preferences(jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
