import { test, expect, type Request } from '@playwright/test';
import type { OfficeSubmission } from '../src/services/office-submission';

const officeEndpoint='https://team-tests.invalid/functions/v1/submit-field-specification';
const corsHeaders={
 'access-control-allow-origin':'*',
 'access-control-allow-headers':'*',
 'access-control-allow-methods':'POST, OPTIONS',
};
async function readSubmission(request:Request){
 const form=await new globalThis.Request(request.url(),{method:'POST',headers:request.headers(),body:request.postDataBuffer()!}).formData();
 return {file:form.get('file') as File,metadata:JSON.parse(String(form.get('metadata'))) as OfficeSubmission['metadata']};
}
for(const width of [390,620,1024])test(`Slanje kancelarijske specifikacije bez prijave ${width}`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 const received:OfficeSubmission['metadata'][]=[];
 await page.route(officeEndpoint,async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:corsHeaders});
  const {file,metadata:m}=await readSubmission(route.request());
  expect(file.name).toBe('AT-2026-012-specifikacija.pdf');expect(file.type).toBe('application/pdf');expect(new TextDecoder().decode((await file.arrayBuffer()).slice(0,5))).toBe('%PDF-');received.push(m);
  await route.fulfill({status:201,headers:corsHeaders,json:{id:m.id,status:'received',created_at:'2026-11-03T12:00:00Z'}});
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
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy();await page.screenshot({path:test.info().outputPath(`poslato-${width}.png`)});await dialog.getByRole('button',{name:'Zatvori',exact:true}).click();await expect(page.getByRole('status')).toHaveCount(0);await page.getByRole('button',{name:'Podeli dokument',exact:true}).click();await expect(page.getByRole('status')).toHaveCount(0);
});

test('Greška i offline ne prikazuju lažnu potvrdu i omogućavaju ponovno slanje',async({page,context})=>{
 await page.setViewportSize({width:390,height:1000});let attempts=0;const ids:string[]=[];
 await page.route(officeEndpoint,async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:corsHeaders});
  const {metadata}=await readSubmission(route.request());
  ids.push(metadata.id);
  attempts++;
  await route.fulfill(attempts===1
   ?{status:503,headers:corsHeaders,json:{error:'Baza trenutno nije dostupna. Pokušajte ponovo.'}}
   :{status:201,headers:corsHeaders,json:{id:metadata.id,status:'received'}});
 });
 await page.goto('/posao/AT-2026-012/ponuda');await page.getByRole('button',{name:'Podeli dokument',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Podeli dokument'}),send=dialog.getByRole('button',{name:'Pošalji u app',exact:true});
 await context.setOffline(true);await send.click();await expect(dialog.getByRole('status')).toContainText('potreban je internet');expect(attempts).toBe(0);await context.setOffline(false);
 await send.click();await expect(dialog.getByRole('status')).toContainText('Baza trenutno nije dostupna');await expect(send).toBeEnabled();
 await send.click();await expect(dialog.getByRole('status')).toHaveText('Sačuvano');expect(ids[0]).toBe(ids[1]);
});
