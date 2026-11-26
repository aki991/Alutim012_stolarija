-- Run after 202611260001_team_roles_and_profiles.sql in SQL Editor.
-- All test accounts and changes roll back.
begin;

do $$
declare boss uuid:=gen_random_uuid(); worker uuid:=gen_random_uuid(); salon uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid();
begin
 perform set_config('test.roles.boss',boss::text,true);
 perform set_config('test.roles.worker',worker::text,true);
 perform set_config('test.roles.salon',salon::text,true);
 perform set_config('test.roles.admin',admin_id::text,true);
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data)
 select id,id::text||'@alutim012.local',now(),'{}'::jsonb,'{}'::jsonb from unnest(array[boss,worker,salon,admin_id]) id;
 insert into public.field_team_members(id,name,role) values
  (boss,'Test šef','manager'),(worker,'Test majstor','worker'),(salon,'Test salon','salon'),(admin_id,'Test admin','manager');
 insert into field_team_private.app_admins(member_id) values(admin_id);
end $$;

set local role authenticated;
do $$
declare boss uuid:=current_setting('test.roles.boss')::uuid;
 worker uuid:=current_setting('test.roles.worker')::uuid;
 salon uuid:=current_setting('test.roles.salon')::uuid;
 admin_id uuid:=current_setting('test.roles.admin')::uuid;
begin
 perform set_config('request.jwt.claim.sub',boss::text,true);
 perform public.field_team_set_account_role(worker,'salon');
 perform public.field_team_set_account_role(worker,'manager');
 perform public.field_team_set_account_role(worker,'worker');
 perform public.field_team_set_account_role(worker,'worker');
 begin perform public.field_team_set_account_role(worker,'admin');raise exception 'Granted admin through team roles';exception when invalid_parameter_value then null;end;
 begin perform public.field_team_set_account_role(admin_id,'worker');raise exception 'Changed admin role';exception when insufficient_privilege then null;end;
 begin perform public.field_team_authorize_profile_edit(boss,worker);raise exception 'Profile authorization exposed to client';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',worker::text,true);
 begin perform public.field_team_set_account_role(boss,'worker');raise exception 'Worker changed role';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',salon::text,true);
 begin perform public.field_team_set_account_role(boss,'worker');raise exception 'Salon changed role';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.field_team_set_account_role(worker,'salon');
 perform public.field_team_set_account_role(worker,'worker');
end $$;
reset role;

do $$
declare boss uuid:=current_setting('test.roles.boss')::uuid;
 worker uuid:=current_setting('test.roles.worker')::uuid;
 admin_id uuid:=current_setting('test.roles.admin')::uuid;
 new_email text:=worker::text||'.new@alutim012.local';
begin
 update auth.users set email=new_email,raw_user_meta_data=jsonb_build_object('full_name','Novo ime'),
  raw_app_meta_data=jsonb_build_object('field_team_profile_edit',jsonb_build_object('actor_id',boss,'name','Novo ime','previous_email',email,'email',new_email)) where id=worker;
 if (select name from public.field_team_members where id=worker)<>'Novo ime' then raise exception 'Profile name not saved';end if;
 if (select raw_app_meta_data ? 'field_team_profile_edit' from auth.users where id=worker) then raise exception 'Profile marker leaked';end if;
 begin
  update auth.users set raw_app_meta_data=jsonb_build_object('field_team_profile_edit',jsonb_build_object('actor_id',worker,'name','Forbidden')) where id=worker;
  raise exception 'Worker edited profile through marker';
 exception when insufficient_privilege then null;end;
 begin
  update auth.users set email='role-profile-test@example.com',raw_app_meta_data=jsonb_build_object('field_team_profile_edit',jsonb_build_object('actor_id',boss,'name','Forbidden','previous_email',email,'email','role-profile-test@example.com')) where id=worker;
  raise exception 'Boss changed real email';
 exception when insufficient_privilege then null;end;
 if (select email from auth.users where id=worker)<>new_email then raise exception 'Forbidden edit partially saved';end if;
 -- Test the last-boss guard in a subtransaction, restoring everyone immediately.
 begin
  update public.field_team_members set active=false where role='manager' and id<>boss;
  perform set_config('request.jwt.claim.sub',boss::text,true);
  begin perform public.field_team_set_account_role(boss,'worker');raise exception 'Removed last boss';exception when invalid_parameter_value then null;end;
  raise exception 'Restore test changes' using errcode='P9999';
 exception when sqlstate 'P9999' then null;end;
end $$;

rollback;
