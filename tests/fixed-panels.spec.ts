import { expect, test } from '@playwright/test';

const job='/posao/AT-2026-012';

test('Pravougaoni nacrt zadržava prave uglove pri izmeni gornje i donje mere',async({page})=>{
 await page.goto(job+'/nov/nacrtaj');
 await page.getByRole('button',{name:'Pravougaoni prozor',exact:true}).click();
 for(const [id,width] of [['e0','1500'],['e2','1600']]){
  await page.locator(`[data-dimension="${id}"]`).click();
  await page.getByLabel('Dužina (mm)',{exact:true}).fill(width);
  await page.getByRole('button',{name:'Potvrdi meru',exact:true}).click();
  await expect(page.locator('[data-dimension="e0"]')).toContainText(width+' mm');
  await expect(page.locator('[data-dimension="e2"]')).toContainText(width+' mm');
  await expect(page.locator('[data-dimension="e1"]')).toContainText('1600 mm');
  await expect(page.locator('[data-dimension="e3"]')).toContainText('1600 mm');
 }
});

test('Ranije iskrivljen pravougaoni šablon može da se ispravi u istom nacrtu',async({page})=>{
 await page.goto(job+'/nov/nacrtaj');
 await page.getByRole('button',{name:'Pravougaoni prozor',exact:true}).click();
 await page.evaluate(()=>{
  const key='alu-custom-draft-v1:AT-2026-012:new';
  const draft=JSON.parse(sessionStorage.getItem(key)!);
  draft.customGeometry.preset='free';
  draft.customGeometry.points[2].x+=900;
  draft.customGeometry.points[3].x+=900;
  sessionStorage.setItem(key,JSON.stringify(draft));
 });
 await page.reload();
 await page.locator('[data-dimension="e2"]').click();
 await page.getByLabel('Dužina (mm)',{exact:true}).fill('1500');
 await page.getByRole('button',{name:'Vrati pravougaonik'}).click();
 await expect(page.locator('[data-dimension="e0"]')).toContainText('1500 mm');
 await expect(page.locator('[data-dimension="e1"]')).toContainText('1600 mm');
 const points=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('alu-custom-draft-v1:AT-2026-012:new')!).customGeometry.points);
 expect(points[0].x).toBe(points[3].x);
 expect(points[1].x).toBe(points[2].x);
});

for(const mode of ['prozor','vrata']){
 test(`Fiksna polja se čuvaju uz element ${mode}`,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(job+'/nov/'+mode);
  await page.getByRole('button',{name:'Raspored fiksnih polja'}).click();
  const dialog=page.getByRole('dialog',{name:'Raspored fiksnih polja'});
  for(const label of ['Fiksno gore','Fiksno levo','Fiksno desno'])await dialog.getByRole('checkbox',{name:label,exact:true}).check();
  await dialog.getByRole('spinbutton',{name:'Fiksno gore (mm)'}).fill('250');
  if(mode==='prozor'){
   await dialog.getByRole('checkbox',{name:'Fiksno dole',exact:true}).check();
   await dialog.getByRole('checkbox',{name:/fiksnim poljem u sredini/}).check();
  }else await expect(dialog.getByRole('checkbox',{name:'Fiksno dole',exact:true})).toHaveCount(0);
  await dialog.getByRole('button',{name:'Primeni raspored'}).click();
  await page.getByLabel('Širina (mm)',{exact:true}).fill('2000');
  await page.getByRole('button',{name:'Dodaj u posao',exact:true}).click();
  await page.getByRole('link',{name:'Izmeni element 4',exact:true}).click();
  await expect(page.locator('.field-drawing [data-fixed-panel]')).toHaveCount(mode==='prozor'?4:3);
  if(mode==='prozor')await expect(page.getByRole('button',{name:'Krilo 2, Fiksno'})).toBeVisible();
  await page.getByRole('button',{name:'Raspored fiksnih polja'}).click();
  await expect(dialog.getByRole('spinbutton',{name:'Fiksno gore (mm)'})).toHaveValue('250');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(mode==='prozor'){
   await dialog.getByRole('button',{name:'Zatvori',exact:true}).click();
   await page.getByRole('link',{name:'Nazad',exact:true}).click();
   await page.getByRole('link',{name:/Podeli dokument/i}).click();
   await page.getByRole('button',{name:'Specifikacija za kancelariju',exact:true}).click();
   const download=page.waitForEvent('download');
   await page.getByRole('button',{name:'Preuzmi PDF',exact:true}).click();
   expect((await download).suggestedFilename()).toContain('specifikacija.pdf');
  }
 });
}
