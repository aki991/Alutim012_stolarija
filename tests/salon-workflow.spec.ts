import { test,expect,type Page } from '@playwright/test';
import type { Job } from '../src/models';
import type { TeamJob,TeamMember } from '../src/services/team-api';

test('Salon bira modele, šef prosleđuje, majstor meri iste pozicije; salon ne dobija cene',async({browser,page})=>{
 test.setTimeout(100000);page.setDefaultTimeout(12000);
 const salon:TeamMember={id:'10000000-0000-4000-8000-000000000001',name:'Salon Vrata',role:'salon',active:true};
 const boss:TeamMember={id:'10000000-0000-4000-8000-000000000002',name:'Šef Petar',role:'manager',active:true};
 const worker:TeamMember={id:'10000000-0000-4000-8000-000000000003',name:'Majstor Miloš',role:'worker',active:true};
 const people=[salon,boss,worker],jobs=new Map<string,TeamJob>();let pricingReadsBySalon=0,requests=0;
 function visible(row:TeamJob,member:TeamMember){
  const data=structuredClone(row.data);
  if(member.role==='salon'){
   for(const key of ['siteCosts','manualTotal','discount','transport','package','extraCost','vat','payment'])delete (data as unknown as Record<string,unknown>)[key];
   data.positions=data.positions.map(p=>{const next={...p};delete (next as Partial<typeof p>).manualPrice;delete (next as Partial<typeof p>).extraCost;return next;});
  }
  return {...row,data,created_by_name:salon.name,assigned_by_name:row.assigned_by===salon.id?salon.name:boss.name,
   assigned_to_name:people.find(p=>p.id===row.assigned_to)?.name,can_reassign:member.id===boss.id};
 }
 async function mock(target:Page,member:TeamMember){
  await target.route('https://team-tests.invalid/**',async route=>{
   const req=route.request(),url=new URL(req.url()),endpoint=url.pathname.split('/').at(-1);
   const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
   const reply=(json:unknown)=>route.fulfill({headers,json});
   if(req.method()==='OPTIONS')return route.fulfill({headers,status:204});
   if(endpoint==='token'){
    const encode=(value:object)=>Buffer.from(JSON.stringify(value)).toString('base64url');
    const token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:member.id,exp:Math.floor(Date.now()/1000)+3600})}.test`;
    return reply({access_token:token,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user:{id:member.id,email:'test@example.test',aud:'authenticated'}});
   }
   if(endpoint==='user')return reply({id:member.id,email:'test@example.test',aud:'authenticated'});
   if(endpoint==='field_team_my_profile')return reply(req.headers().accept?.includes('vnd.pgrst.object')?member:[member]);
   if(endpoint==='field_team_members')return reply(member.role==='salon'?[boss]:people);
   if(endpoint==='field_team_pricing'){if(member.role==='salon')pricingReadsBySalon++;return reply({prices:{},porta_royal_prices:{},vat:20,vat_mode:'exclusive',worker_prices_visible:true,revision:1});}
   if(endpoint==='field_team_visible_jobs'){
    const list=[...jobs.values()].map(row=>visible(row,member));
    return reply(url.searchParams.get('select')==='id,revision'?list.map(({id,revision})=>({id,revision})):list);
   }
   const body=req.postDataJSON()??{};
   if(endpoint==='field_team_salon_request'){
    expect(member.role).toBe('salon');expect(body.p_manager).toBe(boss.id);requests++;
    const data:Job={...body.p_job,siteCosts:undefined,salonRequest:{salonName:salon.name,managerName:boss.name,instructions:body.p_instructions},positions:body.p_job.positions.map((p:Job['positions'][number])=>({...p,measurementPending:true,manualPrice:null,extraCost:0}))};
    const row:TeamJob={id:data.id,data,created_by:salon.id,assigned_by:salon.id,assigned_to:boss.id,assignee_only:true,revision:1};
    jobs.set(row.id,row);return reply(visible(row,member));
   }
   if(endpoint==='field_team_assign'){
    expect(member.id).toBe(boss.id);const row=jobs.get(body.p_id)!;
    row.assigned_to=body.p_assignee;row.assigned_by=boss.id;row.data.technician=worker.name;row.revision++;
    return reply(visible(row,member));
   }
   if(endpoint==='field_team_update_job'){
    const row=jobs.get(body.p_id)!;expect(member.id===worker.id||member.id===boss.id).toBe(true);
    row.data={...row.data,...body.p_patch};row.revision++;return reply(visible(row,member));
   }
   if(endpoint==='field_team_list_accounts')return reply(people.map(p=>({...p,email:`${p.id}@example.test`})));
   return reply([]);
  });
 }
 async function login(target:Page,member:TeamMember){
  target.setDefaultTimeout(12000);await mock(target,member);await target.goto('/prijava');
  await target.getByLabel('E-mail ili korisničko ime').fill('test@example.test');await target.getByLabel('Lozinka',{exact:true}).fill('test-password');
  await target.getByRole('button',{name:'Prijavi se',exact:true}).click();await expect(target).not.toHaveURL(/\/prijava$/);
 }
 await login(page,salon);
 await expect(page.getByRole('heading',{name:'Salon Vrata',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Novi zahtev',exact:true}).click();
 await page.getByLabel('Pretraži sobna vrata',{exact:true}).fill('Classic');
 await page.locator('.porta-series-card').first().click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 await dialog.getByLabel('Tip vrata',{exact:true}).selectOption('s-01');
 await dialog.getByRole('button',{name:'Dodaj model u zahtev',exact:true}).click();
 await page.getByLabel('Količina',{exact:true}).fill('2');
 await page.getByLabel('Pretraži sobna vrata',{exact:true}).fill('Classic');
 await page.locator('.porta-series-card').first().click();await dialog.getByRole('button',{name:'Dodaj model u zahtev',exact:true}).click();
 await page.getByLabel('Šef',{exact:true}).selectOption(boss.id);
 await page.getByLabel('Ime kupca',{exact:true}).fill('Kupac iz salona');await page.getByLabel('Adresa merenja',{exact:true}).fill('Glavna 15');
 await page.getByLabel('Telefon kupca',{exact:true}).fill('060123456');await page.getByLabel('Uputstvo za merenje',{exact:true}).fill('Dva izabrana modela, pozvati kupca.');
 await page.setViewportSize({width:390,height:844});
 await expect(page.getByRole('button',{name:'Pošalji zahtev šefu',exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/salon-mobile-request.png',fullPage:true});
 await page.locator('#salon-request-form').screenshot({path:'test-results/salon-mobile-form.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Pošalji zahtev šefu',exact:true}).click();
 await expect(page).toHaveURL(/\/posao\/AT-/);expect(requests).toBe(1);
 const row=[...jobs.values()][0],id=row.id,originalIds=row.data.positions.map(p=>p.id),models=row.data.positions.map(p=>p.portaRoyal);
 expect(row.data.positions[0].quantity).toBe(2);expect(models[0]?.type).toBe('s-01');
 await expect(page.getByText('Čeka merenje',{exact:true})).toHaveCount(2);
 await page.goto('/katalog');
 await expect(page.getByLabel('Izabrani modeli',{exact:true}).locator('article')).toHaveCount(0);
 await page.goto(`/posao/${id}`);
 const bossContext=await browser.newContext(),workerContext=await browser.newContext();
 const bossPage=await bossContext.newPage(),workerPage=await workerContext.newPage();
 await login(bossPage,boss);await bossPage.goto(`/posao/${id}`);
 await expect(bossPage.getByRole('heading',{name:'Zahtev salona: Salon Vrata',exact:true})).toBeVisible();
 await bossPage.getByRole('link',{name:'Prosledi majstoru',exact:true}).click();
 await bossPage.getByLabel('Zadužena osoba',{exact:true}).selectOption(worker.id);
 await expect(bossPage.getByLabel('Zadužena osoba').getByRole('option',{name:salon.name,exact:true})).toHaveCount(0);
 await bossPage.getByRole('button',{name:'Potvrdi dodelu',exact:true}).click();
 await expect.poll(()=>row.assigned_to).toBe(worker.id);
 await login(workerPage,worker);await workerPage.goto(`/posao/${id}`);
 await expect(workerPage.getByRole('button',{name:'Merenje završeno',exact:true})).toBeDisabled();
 for(let i=0;i<originalIds.length;i++){
  await workerPage.getByRole('link',{name:`Izmeni element ${i+1}`,exact:true}).click();
  await expect(workerPage.getByText('Model je izabran u salonu.',{exact:false})).toBeVisible();
  await workerPage.getByLabel('Širina (mm)',{exact:true}).fill(String(900+i*100));await workerPage.getByLabel('Visina (mm)',{exact:true}).fill('2100');
  await workerPage.getByLabel('Debljina zida (mm)',{exact:true}).fill('220');
  await workerPage.getByRole('button',{name:'Sačuvaj izmene',exact:true}).click();
  await expect.poll(()=>row.data.positions[i].measurementPending).toBe(false);
  if(i===0)await expect(workerPage.getByRole('button',{name:'Merenje završeno',exact:true})).toBeDisabled();
 }
 await workerPage.getByRole('button',{name:'Merenje završeno',exact:true}).click();await expect.poll(()=>row.data.status).toBe('Poslati ponudu');
 expect(row.data.positions.map(p=>p.id)).toEqual(originalIds);expect(row.data.positions.map(p=>({...p.portaRoyal,wall:undefined}))).toEqual(models.map(p=>({...p,wall:undefined})));
 row.data.manualTotal=999;row.data.siteCosts={installation:150,travel:50};row.revision++;
 await page.reload();await expect(page.getByText('Izmereno: 900 × 2100 mm',{exact:true})).toBeVisible();
 await expect(page.getByText('Cena montaže (€)',{exact:true})).toHaveCount(0);await expect(page.locator('body')).not.toContainText('€');
 await page.goto('/cenovnik');await expect(page).toHaveURL(/\/poslovi$/);
 await page.goto(`/posao/${id}/ponuda`);await expect(page).toHaveURL(/\/poslovi$/);
 await page.getByRole('button',{name:'Više',exact:true}).click();await expect(page.getByRole('link',{name:'Cenovnik',exact:true})).toHaveCount(0);
 expect(pricingReadsBySalon).toBe(0);
 await bossPage.goto('/podesavanja/korisnici');await expect(bossPage.locator('select[name="role"] option[value="salon"]')).toHaveText('Salon');
 await bossContext.close();await workerContext.close();
});
