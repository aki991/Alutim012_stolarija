import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
const route='/posao/AT-2026-012';
const folder=path.resolve('output/design/workflow');
mkdirSync(folder,{recursive:true});
const saved=(page:any)=>page.evaluate(()=>JSON.parse(localStorage.getItem('alu-tim-teren-v1')!).jobs.find((j:any)=>j.id==='AT-2026-012'));

for(const width of [320,390,620,768,1024,1440]){
 test(`Brzi status i podaci kupca ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1024});await page.goto(route);
  const price=await page.getByTestId('job-total').innerText();
  await page.getByRole('combobox',{name:/Status posla/}).selectOption('Prihvaćeno');
  expect((await saved(page)).status).toBe('Prihvaćeno');expect(await page.getByTestId('job-total').innerText()).toBe(price);
  await page.reload();await expect(page.getByRole('combobox',{name:/Status posla/})).toHaveValue('Prihvaćeno');
  await page.screenshot({path:path.join(folder,`posao-${width}.png`)});
  await page.goto('/poslovi');const card=page.locator('.job-card').filter({hasText:'Porodica Petrović'});
  await card.getByRole('combobox',{name:/Status posla/}).selectOption('Odbijeno');expect(page.url()).toContain('/poslovi');expect((await saved(page)).status).toBe('Odbijeno');
  await card.getByRole('combobox',{name:/Status posla/}).selectOption('Ponuda');
  await page.screenshot({path:path.join(folder,`poslovi-${width}.png`)});
  await card.locator('.job-card-info').click();await page.getByRole('button',{name:'Podaci o kupcu',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Podaci o kupcu'});
  await expect(dialog.locator('input[required]')).toHaveCount(1);
  await dialog.getByLabel('Naziv kupca',{exact:true}).fill('Izmenjen kupac');
  await dialog.getByLabel('Telefon',{exact:true}).fill('064 123 456');await expect(dialog.getByRole('link',{name:'Pozovi'})).toHaveAttribute('href','tel:064123456');
  await dialog.getByLabel('Email',{exact:true}).fill('kupac@example.com');await expect(dialog.getByRole('link',{name:'Pošalji email'})).toHaveAttribute('href','mailto:kupac@example.com');
  await expect(dialog.getByLabel('Datum merenja')).toBeHidden();await dialog.getByText('Dodatni podaci',{exact:true}).click();await dialog.getByLabel('Datum merenja').fill('');
  await dialog.getByLabel('Adresa objekta').fill('Nova adresa');await dialog.getByLabel('Opšte napomene').fill('Provera uslova montaže');
  await dialog.getByText('Dodatni podaci',{exact:true}).click();await dialog.evaluate(el=>el.scrollTo(0,0));await page.screenshot({path:path.join(folder,`kupac-${width}.png`)});
  await dialog.getByRole('button',{name:'Sačuvaj podatke'}).click();await expect(dialog).toBeHidden();await page.waitForTimeout(450);await page.reload();
  expect(await saved(page)).toMatchObject({customer:{name:'Izmenjen kupac',address:'Nova adresa'},date:'',notes:'Provera uslova montaže',status:'Ponuda'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 });

 test(`Korekcija, PDV, čuvanje i PDF ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1024});await page.goto(route);
  await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('alu-tim-teren-v1')!);const j=data.jobs.find((j:any)=>j.id==='AT-2026-012');j.positions=[{...j.positions[0],quantity:2,manualPrice:100}];j.transport=0;j.extraCost=0;j.discount=0;j.status='Prihvaćeno';localStorage.setItem('alu-tim-teren-v1',JSON.stringify(data));});await page.reload();
  await page.getByRole('link',{name:'Korekcija cene',exact:true}).click();await expect(page.locator('.correction-advanced')).not.toHaveAttribute('open');
  await page.getByRole('spinbutton',{name:'Ručna cena 1',exact:true}).fill('100');await page.getByLabel('Popust',{exact:true}).fill('10');await page.getByLabel('Uvećanje',{exact:true}).fill('20');
  await expect(page.getByTestId('correction-total')).toContainText('259,20');
  await page.getByLabel('Vrsta popusta').selectOption('amount');await page.getByLabel('Popust',{exact:true}).fill('30');await page.getByLabel('Vrsta uvećanja').selectOption('amount');await page.getByLabel('Uvećanje',{exact:true}).fill('10');
  await expect(page.getByTestId('correction-total')).toContainText('216,00');
  await page.getByLabel('Ručna ukupna cena',{exact:true}).check();await page.getByLabel('Konačna cena sa PDV-om (€)').fill('600');await expect(page.getByLabel('Popust',{exact:true})).toBeDisabled();
  await expect(page.getByTestId('correction-total')).toContainText('600,00');
  await page.getByText('Napredne opcije',{exact:true}).click();await page.getByLabel('Poreski režim').selectOption('none');await expect(page.getByTestId('correction-total')).toContainText('600,00');await page.getByLabel('Poreski režim').selectOption('inclusive');await expect(page.getByTestId('correction-total')).toContainText('600,00');await page.getByLabel('Poreski režim').selectOption('exclusive');await page.getByText('Napredne opcije',{exact:true}).click();
  await page.getByRole('button',{name:'Sačuvaj cenu',exact:true}).click();expect((await saved(page)).status).toBe('Prihvaćeno');
  await page.reload();await expect(page.getByLabel('Konačna cena sa PDV-om (€)')).toHaveValue('600');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:path.join(folder,`korekcija-${width}.png`)});
  await page.getByRole('link',{name:'Nazad na posao',exact:true}).click();await expect(page.getByTestId('job-total')).toContainText('600,00');
  await expect(page.getByRole('button',{name:'Ponuda za kupca',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Specifikacija za kancelariju',exact:true})).toHaveCount(0);const next=page.getByRole('link',{name:'Pogledaj cenu i podeli dokument',exact:true});const nextBox=await next.boundingBox(),actionsBox=await page.locator('.job-quick-actions').boundingBox();expect(nextBox!.width).toBeGreaterThan(actionsBox!.width-50);await next.click();await expect(page).toHaveURL(/\/ponuda$/);
  if(width===390||width===1024){for(const label of ['Ponuda za kupca','Specifikacija za kancelariju']){const waiting=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('button',{name:'Preuzmi PDF',exact:true}).click();await page.getByRole('dialog',{name:/Pregled:/}).getByRole('button',{name:'Zatvori'}).click();const file=await waiting;await file.saveAs(path.resolve('output/pdf',`workflow-${width}-${file.suggestedFilename()}`));}expect((await saved(page)).status).toBe('Prihvaćeno');}
  const nav=page.getByRole('navigation',{name:width<=700?'Donja navigacija':'Glavna navigacija'});await expect(nav).toBeVisible();
 });
}
