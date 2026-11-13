import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const folder=path.resolve('output/design/office-send');mkdirSync(folder,{recursive:true});
async function mockClient(page:any){
 // Only the client boundary is replaced. The real PDF generator and form uploader run.
 // This test never uploads customer data to the live Supabase project.
 await page.route('**/src/services/supabase.ts*',(route:any)=>route.fulfill({contentType:'application/javascript',body:`
 export const isSupabaseConfigured=true;
 export function getSupabase(){return {auth:{onAuthStateChange(callback){queueMicrotask(()=>callback('INITIAL_SESSION',null));return {data:{subscription:{unsubscribe(){}}}};}},functions:{invoke:async(name,options)=>{try{const r=await fetch('/mock-office-submit',{method:'POST',body:options.body});if(!r.ok)return {data:null,error:{context:r}};return {data:await r.json(),error:null};}catch(e){return {data:null,error:e};}}}};}
 `}));
}
for(const width of [390,620,1024])test(`Slanje kancelarijske specifikacije bez prijave ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await mockClient(page);
 const received:any[]=[];
 await page.route('**/mock-office-submit',async route=>{
  const req=route.request(),body=await new Request(req.url(),{method:'POST',headers:req.headers(),body:req.postDataBuffer()!}).formData();
  const file=body.get('file') as File,m=JSON.parse(String(body.get('metadata')));
  expect(file.name).toBe('AT-2026-012-specifikacija.pdf');expect(file.type).toBe('application/pdf');expect(new TextDecoder().decode((await file.arrayBuffer()).slice(0,5))).toBe('%PDF-');received.push(m);
  await route.fulfill({status:201,json:{id:m.id,status:'received',created_at:'2026-11-03T12:00:00Z'}});
 });
 await page.goto('/posao/AT-2026-012/ponuda');
 const original=await page.evaluate(()=>localStorage.getItem('alu-tim-teren-v1'));
 await page.getByRole('button',{name:'Podeli dokument',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Podeli dokument'});
 await expect(dialog.getByRole('link',{name:'Pripremi email'})).toHaveCount(0);
 const send=dialog.getByRole('button',{name:'Pošalji u app',exact:true});await expect(send.getByAltText('ALU TIM 012')).toBeVisible();
 await expect(dialog.locator('input')).toHaveCount(0);
 await send.click();await expect(dialog.getByRole('status')).toHaveText('Sačuvano');
 await expect(dialog.getByRole('status')).toHaveClass(/office-notice-success/);await expect(page.locator('.price-workspace [role=status]')).toHaveCount(0);await expect(dialog).not.toContainText('Broj prijema');
 expect(received).toHaveLength(1);expect(received[0]).toMatchObject({job_id:'AT-2026-012',customer_name:'Porodica Petrović',position_count:3});
 await send.click();await expect(dialog.getByRole('status')).toHaveText('Sačuvano');expect(received).toHaveLength(2);expect(received[0].id).toBe(received[1].id);
 expect(await page.evaluate(()=>localStorage.getItem('alu-tim-teren-v1'))).toBe(original);
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy();await page.screenshot({path:path.join(folder,`poslato-${width}.png`)});await dialog.getByRole('button',{name:'Zatvori',exact:true}).click();await expect(page.getByRole('status')).toHaveCount(0);await page.getByRole('button',{name:'Podeli dokument',exact:true}).click();await expect(page.getByRole('status')).toHaveCount(0);
});

test('Greška i offline ne prikazuju lažnu potvrdu i omogućavaju ponovno slanje',async({page,context})=>{
 await page.setViewportSize({width:390,height:1000});await mockClient(page);let attempts=0;const ids:string[]=[];
 await page.route('**/mock-office-submit',async route=>{attempts++;const req=route.request(),body=await new Request(req.url(),{method:'POST',headers:req.headers(),body:req.postDataBuffer()!}).formData();const m=JSON.parse(String(body.get('metadata')));ids.push(m.id);await route.fulfill(attempts===1?{status:503,json:{error:'Baza trenutno nije dostupna. Pokušajte ponovo.'}}:{status:201,json:{id:m.id,status:'received'}});});
 await page.goto('/posao/AT-2026-012/ponuda');await page.getByRole('button',{name:'Podeli dokument',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Podeli dokument'}),send=dialog.getByRole('button',{name:'Pošalji u app',exact:true});
 await context.setOffline(true);await send.click();await expect(dialog.getByRole('status')).toContainText('potreban je internet');expect(attempts).toBe(0);await context.setOffline(false);
 await send.click();await expect(dialog.getByRole('status')).toContainText('Baza trenutno nije dostupna');await expect(send).toBeEnabled();
 await send.click();await expect(dialog.getByRole('status')).toHaveText('Sačuvano');expect(ids[0]).toBe(ids[1]);
});
