-- Run after 202611250005_salon_requests.sql. Every fixture and role change rolls back.
begin;
do $$
declare salon uuid; worker uuid; boss uuid; other_boss uuid; result public.field_team_jobs; payload jsonb;
begin
 select id into salon from public.field_team_members where active and role='worker' order by id limit 1;
 select id into worker from public.field_team_members where active and role='worker' and id<>salon order by id limit 1;
 select id into boss from public.field_team_members where active and role='manager' and not field_team_private.is_app_admin(id) order by id limit 1;
 select id into other_boss from public.field_team_members where active and role='manager' and id<>boss order by id limit 1;
 if salon is null or worker is null or boss is null or other_boss is null then raise exception 'Need two workers and two bosses for this rollback test.'; end if;
 perform set_config('test.salon',salon::text,true);perform set_config('test.worker',worker::text,true);
 perform set_config('test.boss',boss::text,true);perform set_config('test.other_boss',other_boss::text,true);
 perform set_config('test.prices',(select md5(row_to_json(p)::text) from public.field_team_pricing p where id),true);
 if public.field_team_prepare_account(boss,'salon-rollback-test@alutim012.local','salon') is null then raise exception 'Salon registration unavailable';end if;
 update public.field_team_members set role='salon' where id=salon;
 perform public.field_team_link_account(boss,(select email from auth.users where id=salon),'salon');
 perform set_config('request.jwt.claim.sub',salon::text,true);
 payload:=jsonb_build_object('id','AT-CODEX-VERIFY-SALON','customer',jsonb_build_object('name','Salon test','address','Test address','phone','060000000'),
  'manualTotal',9999,'siteCosts',jsonb_build_object('travel',999),'positions',jsonb_build_array(jsonb_build_object(
   'id','salon-door','name','Classic','category','Sobna vrata','width',890,'height',2060,'quantity',1,'manualPrice',999,
   'portaRoyal',jsonb_build_object('series','eko-furnir-lux-classic','decor','bela','type','s','direction','left','fill','honeycomb','price',999))));
 result:=public.field_team_salon_request(payload,boss,'Test merenje');
 if result.data ?| array['manualTotal','siteCosts','transport','discount','extraCost','vat']
  or result.data#>'{positions,0}' ? 'manualPrice' or result.data#>'{positions,0,portaRoyal}' ? 'price' then
  raise exception 'Price leak on creation';
 end if;
 if result.assigned_to<>boss or result.created_by<>salon or result.data#>>'{positions,0,measurementPending}'<>'true' then raise exception 'Wrong request routing'; end if;
 result:=public.field_team_salon_request(payload,boss,'Test merenje');
 if (select count(*) from public.field_team_notifications where job_id=result.id)<>1 then raise exception 'Retry duplicated notification'; end if;
 begin perform public.field_team_create_job(payload||'{"id":"AT-CODEX-VERIFY-SALON-ORDINARY","status":"Merenje"}'::jsonb,null,'',false);raise exception 'Salon created ordinary job';exception when insufficient_privilege then null;end;
 begin perform public.field_team_update_job(result.id,'{"siteCosts":{"travel":999}}','{}');raise exception 'Salon edited job';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
do $$
declare data jsonb;
begin
 if exists(select 1 from public.field_team_pricing) then raise exception 'Salon read shared pricing';end if;
 begin if exists(select 1 from public.field_team_jobs) then raise exception 'Salon read raw job financials';end if;exception when insufficient_privilege then null;end;
 if exists(select 1 from public.field_team_members where role='worker') then raise exception 'Salon enumerated workers';end if;
 if not exists(select 1 from public.field_team_members where id=current_setting('test.boss')::uuid) then raise exception 'Boss picker unavailable';end if;
 select v.data into data from public.field_team_visible_jobs v where id='AT-CODEX-VERIFY-SALON';
 if data is null or jsonb_array_length(data->'positions')<>1 then raise exception 'Own request unavailable';end if;
 begin perform public.field_team_list_accounts();raise exception 'Salon managed accounts';exception when insufficient_privilege then null;end;
 begin perform public.field_team_set_worker_prices(true,1);raise exception 'Salon changed price visibility';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.field_team_visible_messages where job_id='AT-CODEX-VERIFY-SALON') then raise exception 'Salon read internal conversation';end if;
 if field_team_private.can_access_document('stolarija/AT-CODEX-VERIFY-SALON/kupac/10000000-0000-4000-8000-000000000001_cene_'||repeat('a',64)||'.pdf') then raise exception 'Salon read quote PDF';end if;
end $$;
reset role;
do $$begin
 perform set_config('request.jwt.claim.sub','',true);
 update public.field_team_members set role='salon' where id=current_setting('test.worker')::uuid;
 perform set_config('request.jwt.claim.sub',current_setting('test.worker'),true);
end $$;
set local role authenticated;
do $$begin
 if exists(select 1 from public.field_team_visible_jobs where id='AT-CODEX-VERIFY-SALON') then raise exception 'Other salon read request';end if;
end $$;
reset role;
do $$
declare result public.field_team_jobs; positions jsonb;
begin
 perform set_config('request.jwt.claim.sub','',true);
 update public.field_team_members set role='worker' where id=current_setting('test.worker')::uuid;
 perform set_config('request.jwt.claim.sub',current_setting('test.other_boss'),true);
 begin perform public.field_team_assign('AT-CODEX-VERIFY-SALON',current_setting('test.worker')::uuid,'',true,null);raise exception 'Other boss took salon request';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',current_setting('test.boss'),true);
 if not (select can_reassign from public.field_team_visible_jobs where id='AT-CODEX-VERIFY-SALON') then raise exception 'Receiving boss cannot forward';end if;
 result:=public.field_team_assign('AT-CODEX-VERIFY-SALON',current_setting('test.worker')::uuid,'Izmeri izabrani model',true,null);
 if result.assigned_by<>current_setting('test.boss')::uuid or result.created_by<>current_setting('test.salon')::uuid
  or jsonb_array_length(result.data->'positions')<>1 then raise exception 'Forwarding lost model or provenance';end if;
 begin perform public.field_team_update_job(result.id,'{"positions":[]}',jsonb_build_object('positions',result.data->'positions'));raise exception 'Boss edited worker measurement';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',current_setting('test.worker'),true);
 begin perform public.field_team_update_job(result.id,'{"status":"Poslati ponudu"}','{"status":"Merenje"}');raise exception 'Unmeasured door finished';exception when invalid_parameter_value then null;end;
 positions:=jsonb_set(jsonb_set(jsonb_set(jsonb_set(result.data->'positions','{0,width}','915'),'{0,height}','2070'),'{0,portaRoyal,wall}','230'),'{0,measurementPending}','false');
 result:=public.field_team_update_job(result.id,jsonb_build_object('positions',positions),jsonb_build_object('positions',result.data->'positions'));
 result:=public.field_team_update_job(result.id,'{"status":"Poslati ponudu"}','{"status":"Merenje"}');
 perform set_config('request.jwt.claim.sub',current_setting('test.boss'),true);
 result:=public.field_team_update_job(result.id,'{"manualTotal":999,"siteCosts":{"installation":100,"travel":100}}','{}');
 perform set_config('request.jwt.claim.sub',current_setting('test.salon'),true);
end $$;
set local role authenticated;
do $$declare data jsonb;begin
 select v.data into data from public.field_team_visible_jobs v where id='AT-CODEX-VERIFY-SALON';
 if data is null or data#>>'{positions,0,width}'<>'915' or data#>>'{positions,0,portaRoyal,wall}'<>'230' then raise exception 'Measured model not preserved';end if;
 if data ?| array['manualTotal','siteCosts','transport','discount','extraCost','vat','package','payment']
  or data#>'{positions,0}' ?| array['manualPrice','extraCost','notes','photos'] then raise exception 'Price leak after boss pricing';end if;
end $$;
reset role;
do $$begin
 if current_setting('test.prices')<>(select md5(row_to_json(p)::text) from public.field_team_pricing p where id) then raise exception 'Pricing was modified';end if;
end $$;
rollback;
select 'Salon routing, measurement, isolation and financial privacy passed; fixtures rolled back.' as result;
