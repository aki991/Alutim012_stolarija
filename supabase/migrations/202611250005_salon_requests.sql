begin;

alter table public.field_team_members drop constraint field_team_members_role_check;
alter table public.field_team_members add constraint field_team_members_role_check check(role in ('manager','worker','salon'));
alter table field_team_private.staff_registrations drop constraint staff_registrations_role_check;
alter table field_team_private.staff_registrations add constraint staff_registrations_role_check check(role in ('manager','worker','salon'));
alter table public.field_team_jobs add column salon_manager uuid references public.field_team_members(id);

-- A salon can choose a public boss but cannot enumerate workers, admins or other salons.
alter policy field_team_members_read on public.field_team_members
using(active and (id=auth.uid() or field_team_private.member_role()='manager'
 or (field_team_private.member_role()='salon' and role='manager'))
 and field_team_private.can_view_member(id));

create or replace function public.field_team_link_account(p_actor uuid, p_email text, p_role text default 'worker')
returns void language plpgsql security definer set search_path = '' as $$
declare account_id uuid;
        account_name text;
        linked public.field_team_members;
begin
  perform 1 from public.field_team_members where id = p_actor and active and role = 'manager' for share;
  if not found then raise exception 'Korisnicima upravlja šef ili admin.' using errcode = '42501'; end if;
  if p_role is null or p_role not in ('worker','manager','salon') then
    raise exception 'Izaberite ulogu šefa, majstora ili salona.' using errcode = '22023';
  end if;

  select id, left(coalesce(nullif(btrim(raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(raw_user_meta_data->>'name'), ''),split_part(email,'@',1)),100)
  into account_id, account_name from auth.users
  where email = lower(btrim(p_email)) and email_confirmed_at is not null and deleted_at is null
    and not field_team_private.is_app_admin(id)
  for key share;
  if not found then raise exception 'Nalog nije pronađen.' using errcode = 'P0002'; end if;

  insert into public.field_team_members(id,name,role) values (account_id,account_name,p_role)
  on conflict (id) do nothing;
  select * into linked from public.field_team_members where id = account_id for share;
  if field_team_private.is_app_admin(account_id) then
    raise exception 'Nalog nije pronađen.' using errcode = 'P0002';
  end if;
  if not linked.active then raise exception 'Pristup ovom nalogu je ukinut.' using errcode = '22023'; end if;
  if linked.role <> p_role then raise exception 'Nalog već ima ulogu u Stolariji.' using errcode = 'P2001'; end if;
end
$$;

create or replace function field_team_private.guard_job_prices()
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
  if actor_role = 'salon' and tg_op = 'INSERT' and new.salon_manager is not null then return new; end if;
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

-- Explicit projections keep every financial field (including future ones) out of salon responses.
create function field_team_private.salon_position(p jsonb)
returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) || jsonb_build_object('portaRoyal',
  (select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(p->'portaRoyal')
   where key=any(array['series','decor','type','direction','wall','ral','fill','hinge','lock','handle','cutout','glazing','threshold','vent'])))
 from jsonb_each(p) where key=any(array['id','name','category','elementType','width','height','quantity','measurementPending']);
$$;
revoke all on function field_team_private.salon_position(jsonb) from public,anon,authenticated;
grant execute on function field_team_private.salon_position(jsonb) to authenticated;

create or replace function field_team_private.visible_job(job public.field_team_jobs,viewer_role text)
returns public.field_team_jobs language plpgsql stable set search_path='' as $$
declare safe_positions jsonb;
begin
 if viewer_role='salon' then
  if job.created_by is distinct from auth.uid() or job.salon_manager is null then
   raise exception 'Nemate pristup zahtevu.' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(field_team_private.salon_position(p)),'[]'::jsonb) into safe_positions
   from jsonb_array_elements(job.data->'positions') p;
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into job.data
   from jsonb_each(job.data) where key=any(array['id','customer','date','createdAt','technician','status','updated',
    'measuredOn','completedOn','installedOn','completionDeadline','salonRequest']);
  job.data:=job.data||jsonb_build_object('positions',safe_positions,'customer',jsonb_build_object(
   'name',job.data#>>'{customer,name}','address',job.data#>>'{customer,address}',
   'phone',job.data#>>'{customer,phone}','email',job.data#>>'{customer,email}'));

 elsif job.assigned_to is not null and job.data->>'status'='Merenje'
  and job.assigned_to is distinct from auth.uid()
  and job.salon_manager is distinct from auth.uid() then
  job.data:=jsonb_set(job.data,'{positions}','[]'::jsonb);
 end if;
 if not field_team_private.can_view_member(job.created_by) then job.created_by:=null; end if;
 if not field_team_private.can_view_member(job.assigned_by) then job.assigned_by:=null; end if;
 return job;
end
$$;

create or replace function field_team_private.guard_assignment_owner()
returns trigger language plpgsql set search_path='' as $$
declare recipient_name text;
begin
 if auth.uid() is null then return new; end if;
 if new.assigned_to is not distinct from old.assigned_to and new.assigned_by is not distinct from old.assigned_by
  and new.assignee_only is not distinct from old.assignee_only then return new; end if;
 if field_team_private.member_role() is distinct from 'manager' or
  (old.salon_manager is not null and old.salon_manager is distinct from auth.uid()) or
  (old.salon_manager is null and old.assigned_by is not null and old.assigned_by is distinct from auth.uid()) then
  raise exception 'Dodelu može da promeni samo šef koji vodi zahtev.' using errcode='42501';
 end if;
 if new.assigned_to is not null then
  if not exists(select 1 from public.field_team_members where id=new.assigned_to and active
   and role in ('manager','worker') and field_team_private.can_view_member(id)
   and (old.salon_manager is null or role='worker' or id=auth.uid())) then
   raise exception 'Izaberite aktivnog majstora za ovaj zahtev.' using errcode='22023';
  end if;
 end if;
 if new.assigned_to is distinct from old.assigned_to or new.assigned_by is distinct from old.assigned_by then
  new.assigned_by:=auth.uid();
 end if;
 if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
  select name into recipient_name from public.field_team_members where id=new.assigned_to;
  new.data:=jsonb_set(new.data,'{technician}',to_jsonb(recipient_name));
 end if;
 return new;
end
$$;

create function field_team_private.guard_salon_request()
returns trigger language plpgsql set search_path='' as $$
begin
 if auth.uid() is null then return new; end if;
 if tg_op='INSERT' then
  if new.assigned_to is not null and exists(select 1 from public.field_team_members where id=new.assigned_to and role='salon') then
   raise exception 'Merenje se dodeljuje šefu ili majstoru, ne salonu.' using errcode='22023';
  end if;
  if field_team_private.member_role()='salon' then
   if new.salon_manager is null or new.created_by is distinct from auth.uid()
    or new.assigned_by is distinct from auth.uid() or new.assigned_to is distinct from new.salon_manager
    or new.data->>'status' is distinct from 'Merenje' then
    raise exception 'Salon šalje zahtev šefu kroz izbor sobnih vrata.' using errcode='42501';
   end if;
  elsif new.salon_manager is not null or new.data ? 'salonRequest' then
   raise exception 'Zahtev salona može da kreira samo salon.' using errcode='42501';
  end if;
 else
  if field_team_private.member_role()='salon' then
   raise exception 'Poslati zahtev salona menja zaduženi šef ili majstor.' using errcode='42501';
  end if;
  if new.salon_manager is distinct from old.salon_manager or new.created_by is distinct from old.created_by
   or new.data->'salonRequest' is distinct from old.data->'salonRequest' then
   raise exception 'Poreklo zahteva ne može da se promeni.' using errcode='42501';
  end if;
 end if;
 if new.salon_manager is not null then new.assignee_only:=true; end if;
 if new.salon_manager is not null and new.data->>'status' not in ('Merenje','Odbijeno')
  and (jsonb_array_length(new.data->'positions')=0 or exists(
   select 1 from jsonb_array_elements(new.data->'positions') p where p->>'measurementPending'='true')) then
  raise exception 'Unesite i sačuvajte mere svih izabranih vrata.' using errcode='22023';
 end if;
 return new;
end
$$;
revoke all on function field_team_private.guard_salon_request() from public,anon,authenticated;
create trigger field_team_guard_salon_request before insert or update on public.field_team_jobs
 for each row execute function field_team_private.guard_salon_request();

create function public.field_team_salon_request(p_job jsonb,p_manager uuid,p_instructions text default '')
returns public.field_team_jobs language plpgsql security definer set search_path='' as $$
declare actor public.field_team_members:=field_team_private.require_member();
 boss public.field_team_members; result public.field_team_jobs; p jsonb; positions jsonb:='[]'; clean jsonb;
 note text:=btrim(coalesce(p_instructions,'')); quantity integer;
begin
 if actor.role<>'salon' then raise exception 'Zahtev šalje salon.' using errcode='42501'; end if;
 select * into boss from public.field_team_members where id=p_manager and active and role='manager'
  and field_team_private.can_view_member(id) for share;
 if not found then raise exception 'Izaberite aktivnog šefa.' using errcode='22023'; end if;
 if jsonb_typeof(p_job->'positions') is distinct from 'array' then
  raise exception 'Izaberite modele sobnih vrata.' using errcode='22023';
 end if;
 if jsonb_array_length(p_job->'positions') not between 1 and 100 or length(note)>4000
  or length(btrim(coalesce(p_job#>>'{customer,address}',''))) not between 1 and 250 then
  raise exception 'Unesite adresu, izaberite vrata i uputstvo do 4000 znakova.' using errcode='22023';
 end if;
 for p in select * from jsonb_array_elements(p_job->'positions') loop
  if jsonb_typeof(p->'portaRoyal') is distinct from 'object'
   or length(coalesce(p#>>'{portaRoyal,series}','')) not between 1 and 100
   or length(coalesce(p#>>'{portaRoyal,decor}','')) not between 1 and 100
   or coalesce(p#>>'{portaRoyal,type}','') not in ('s','s-01','s-02','s-03','n','n-01','n-02','n-03','d','d-01','d-02','d-03','dn-03','dk','k','t-02','4l')
   or coalesce(p->>'id','') !~ '^[A-Za-z0-9-]{1,100}$'
   or coalesce(p->>'quantity','') !~ '^[0-9]{1,3}$'
   or coalesce(p->>'width','') !~ '^[0-9]{1,5}$' or coalesce(p->>'height','') !~ '^[0-9]{1,5}$'
   or length(coalesce(p->>'name','')) not between 1 and 200 then
   raise exception 'Izbor sobnih vrata nije ispravan.' using errcode='22023';
  end if;
  if (p->>'width')::integer not between 1 and 20000 or (p->>'height')::integer not between 1 and 20000 then
   raise exception 'Mere modela nisu ispravne.' using errcode='22023';
  end if;
  quantity:=(p->>'quantity')::integer;
  if quantity not between 1 and 100 then raise exception 'Količina mora biti od 1 do 100.' using errcode='22023'; end if;
  positions:=positions||jsonb_build_array(field_team_private.salon_position(p)||jsonb_build_object(
   'category','Sobna vrata','elementType','sobna-vrata','measurementPending',true,
   'material','PVC','color','Bela','glass','Dvoslojno','hardware','Standardni','segments','[]'::jsonb,
   'shutter',false,'mosquito',false,'sill',false,'installation',false,'removal',false,
   'notes','','access','','extraWork','','extraCost',0,'photos','[]'::jsonb,'manualPrice',null));
 end loop;
 if exists(select 1 from jsonb_array_elements(positions) item group by item->>'id' having count(*)>1) then
  raise exception 'Modeli moraju imati različite oznake.' using errcode='22023';
 end if;
 clean:=jsonb_build_object('id',p_job->>'id','customer',jsonb_build_object('name',p_job#>>'{customer,name}',
  'address',p_job#>>'{customer,address}','phone',left(coalesce(p_job#>>'{customer,phone}',''),50),'email','','building',''),
  'date',to_char(statement_timestamp() at time zone 'Europe/Belgrade','YYYY-MM-DD'),
  'createdAt',now(),'updated',now(),'technician',boss.name,'notes','','status','Merenje','positions',positions,
  'salonRequest',jsonb_build_object('salonName',actor.name,'managerName',boss.name,'instructions',note),
  'package','Standard','discount',0,'transport',0,'extraCost',0,'extraWork','','validity','','delivery','','payment','');
 perform field_team_private.validate_job(clean);
 insert into public.field_team_jobs(id,data,created_by,assigned_by,assigned_to,assignee_only,salon_manager)
  values(clean->>'id',clean,actor.id,actor.id,boss.id,true,boss.id) on conflict(id) do nothing returning * into result;
 if not found then
  select * into result from public.field_team_jobs where id=clean->>'id' and created_by=actor.id
   and salon_manager=p_manager and deleted_at is null;
  if not found then raise exception 'Broj zahteva već postoji.' using errcode='23505'; end if;
 else
  if note<>'' then insert into public.field_team_messages(id,job_id,sender_id,sender_name,body)
   values(gen_random_uuid(),result.id,actor.id,actor.name,note); end if;
  insert into public.field_team_notifications(recipient_id,job_id,kind,actor_name,job_name,body)
   values(boss.id,result.id,'assignment',actor.name,clean#>>'{customer,name}','Salon je poslao modele sobnih vrata za merenje.');
 end if;
 return field_team_private.visible_job(result,actor.role);
end
$$;
revoke all on function public.field_team_salon_request(jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.field_team_salon_request(jsonb,uuid,text) to authenticated;

-- Base-table, pricing, conversation and document policies continue to reject salons.
-- Only this view exposes a salon's own requests, through the safe projection above.
create or replace view public.field_team_visible_jobs with(security_barrier=true) as
select job.id,visible.data,job.assigned_to,visible.assigned_by,job.revision,job.assignee_only,
 visible.created_by,
 coalesce(creator.name,case when job.created_by is not null then 'Administrator' end) as created_by_name,
 coalesce(sender.name,case when job.assigned_by is not null then 'Administrator' end) as assigned_by_name,
 recipient.name as assigned_to_name,
 (viewer.role='manager' and (job.salon_manager=auth.uid() or (job.salon_manager is null
  and (job.assigned_by is null or job.assigned_by=auth.uid())))) as can_reassign
from public.field_team_jobs job
cross join(select field_team_private.member_role() as role)viewer
cross join lateral field_team_private.visible_job(job,viewer.role)visible
left join public.field_team_members creator on creator.id=visible.created_by
left join public.field_team_members sender on sender.id=visible.assigned_by
left join public.field_team_members recipient on recipient.id=job.assigned_to
where job.deleted_at is null and (field_team_private.can_browse_job(job.assigned_to,job.assignee_only,viewer.role)
 or (viewer.role='salon' and job.created_by=auth.uid() and job.salon_manager is not null));

notify pgrst,'reload schema';
commit;
