import { expect, test } from '@playwright/test';
import type { TeamPricingRow } from '../src/services/team-api';

for(const role of ['manager','worker'] as const)test(`Cenovnik bez nove kolone za vidljivost cena: ${role}`,async({page})=>{
 const member={id:'10000000-0000-4000-8000-000000000001',name:'Test',role,active:true};
 let pricing:TeamPricingRow={prices:{mosquitoMotor:75},porta_royal_prices:{},vat:20,vat_mode:'exclusive',revision:0};
 await page.route('https://team-tests.invalid/**',async route=>{
  const request=route.request(),url=new URL(request.url()),endpoint=url.pathname.split('/').at(-1);
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
  const reply=(json:unknown)=>route.fulfill({headers,json});
  if(request.method()==='OPTIONS')return route.fulfill({headers,status:204});
  if(endpoint==='token'){
   const encode=(value:object)=>Buffer.from(JSON.stringify(value)).toString('base64url');
   const token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:member.id,exp:Math.floor(Date.now()/1000)+3600})}.test`;
   return reply({access_token:token,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user:{id:member.id,email:'test@example.test',aud:'authenticated'}});
  }
  if(endpoint==='user')return reply({id:member.id,email:'test@example.test',aud:'authenticated'});
  if(endpoint==='field_team_my_profile')return reply(request.headers().accept?.includes('vnd.pgrst.object')?member:[member]);
  if(endpoint==='field_team_pricing'){
   if(url.searchParams.get('select')?.split(',').includes('worker_prices_visible'))return route.fulfill({headers,status:400,json:{code:'42703',message:'column field_team_pricing.worker_prices_visible does not exist'}});
   return reply(pricing);
  }
  if(endpoint==='field_team_save_pricing'){
   expect(role).toBe('manager');const body=request.postDataJSON();expect(body.p_revision).toBe(pricing.revision);
   pricing={prices:body.p_prices,porta_royal_prices:body.p_porta_royal_prices,vat:body.p_vat,vat_mode:body.p_vat_mode,revision:pricing.revision+1};
   return reply(pricing);
  }
  return reply([]);
 });
 await page.goto('/prijava');
 await page.getByLabel('E-mail ili korisničko ime').fill('test@example.test');
 await page.getByLabel('Lozinka',{exact:true}).fill('test-password');
 await page.getByRole('button',{name:'Prijavi se',exact:true}).click();
 await expect(page).not.toHaveURL(/\/prijava$/);
 if(role==='manager'){
  await page.goto('/cenovnik');
  const motor=page.getByLabel('Motor za komarnik (€/kom.)',{exact:true});
  await expect(motor).toHaveValue('75');await motor.fill('85');
  await page.getByRole('button',{name:'Sačuvaj cenovnik',exact:true}).click();
  await expect.poll(()=>pricing.prices.mosquitoMotor).toBe(85);
  await expect(page.getByText('Cene su sačuvane za ceo tim.',{exact:true})).toBeVisible();
  await page.reload();await expect(motor).toHaveValue('85');
  await page.goto('/podesavanja');
  await expect(page.getByRole('checkbox',{name:/Prikaži cene majstorima/})).toBeDisabled();
  await expect(page.getByText('Za podešavanje prikaza cena majstorima potrebno je ažuriranje baze.',{exact:true})).toBeVisible();
 }else{
  await page.goto('/cenovnik');await expect(page).toHaveURL(/\/podesavanja$/);
  await expect(page.getByText('Podešavanje prikaza cena još nije dostupno u bazi. Obratite se šefu.',{exact:true})).toBeVisible();
 }
 await expect(page.getByText('Zajednički cenovnik trenutno nije dostupan.',{exact:true})).toHaveCount(0);
});
