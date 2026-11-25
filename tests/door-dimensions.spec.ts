import { expect, test } from '@playwright/test';
import { pdfText } from './helpers/pdf';

test('Ukupna kota na prikazu sobnih vrata otvara izmenu trenutne mere',async({page})=>{
 await page.route('https://portaroyal.rs/wp-content/uploads/**',route=>route.abort());
 await page.goto('/posao/AT-2026-012/nov/sobna-vrata?serija=eko-furnir-lux-classic');
 const width=page.getByLabel('Širina (mm)',{exact:true});
 const current=await width.inputValue();
 await page.getByRole('button',{name:`Ukupna širina: ${current} mm`,exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Izmeni kotu: Ukupna širina',exact:true});
 await expect(dialog.getByLabel('Dimenzija (mm)')).toHaveValue(current);
 await dialog.getByLabel('Dimenzija (mm)').fill('925');await dialog.getByRole('button',{name:'Primeni meru'}).click();
 await expect(width).toHaveValue('925');
 await page.reload();await expect(width).toHaveValue('925');
});

for(const width of [390,800,1366])test(`Kote vrata otvaraju unos i menjaju crtež, bez spiska mera: ${width}`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});
 await page.goto('/posao/AT-2026-012/nov/model?model=d-balcony-panel-top-sides-double');
 const drawing=page.locator('.field-drawing');
 const dimension=(id:string)=>drawing.locator(`[data-position-dimension="${id}"] [role=button]`);
 const panel=drawing.locator('[data-model-panel="1.1"]');
 const before=Number(await panel.getAttribute('height'));
 await dimension('panel:1:1').click();
 const dialog=page.getByRole('dialog',{name:'Izmeni kotu: Visina parapeta 2.2',exact:true});
 const input=dialog.getByLabel('Dimenzija (mm)',{exact:true});
 await expect(input).toHaveValue('798');await expect(dialog.getByRole('spinbutton')).toHaveCount(1);
 await input.fill('550');
 await expect(dialog.locator('[data-position-dimension="glass:1:1"]')).toContainText('1550');
 expect(Number(await dialog.locator('[data-model-panel="1.1"]').getAttribute('height'))).toBeLessThan(before);
 await input.fill('0');await expect(dialog.getByRole('button',{name:'Primeni meru'})).toBeDisabled();
 await expect(dialog.getByRole('alert')).toBeVisible();
 await input.fill('550');await dialog.getByRole('button',{name:'Otkaži',exact:true}).click();
 expect(Number(await panel.getAttribute('height'))).toBe(before);
 await dimension('panel:1:1').press('Enter');await expect(input).toHaveValue('798');
 await input.fill('550');await dialog.getByRole('button',{name:'Primeni meru',exact:true}).click();
 await expect(dimension('panel:1:1')).toHaveAttribute('aria-label','Visina parapeta 2.2: 550 mm');
 expect(Number(await panel.getAttribute('height'))).toBeLessThan(before);
 await dimension('row:0').click();
 const edit=page.getByRole('dialog',{name:'Izmeni kotu: Visina reda 1',exact:true});
 await edit.getByLabel('Dimenzija (mm)').fill('400');await edit.getByRole('button',{name:'Primeni meru'}).click();
 await expect(dimension('row:1')).toHaveAttribute('aria-label','Visina reda 2: 2050 mm');
 await expect(dimension('glass:1:1')).toHaveAttribute('aria-label','Visina stakla 2.2: 1500 mm');
 await page.getByText('Otvaranje, raspored i mere polja',{exact:true}).click();
 await expect(page.getByLabel('Širina polja 2.2 (mm)',{exact:true})).toHaveCount(0);
 await expect(page.getByLabel('Visina reda 1 (mm)',{exact:true})).toHaveCount(0);
 await page.getByText('Otvaranje, raspored i mere polja',{exact:true}).click();
 await page.reload();await expect(dimension('panel:1:1')).toHaveAttribute('aria-label','Visina parapeta 2.2: 550 mm');
 await page.getByRole('button',{name:'Dodaj u posao',exact:true}).click();
 await page.locator('.job-line').last().getByRole('link',{name:/Izmeni element/}).click();
 await expect(dimension('panel:1:1')).toHaveAttribute('aria-label','Visina parapeta 2.2: 550 mm');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width!==1366)return;
 await page.getByRole('button',{name:'Sačuvaj izmene',exact:true}).click();
 await page.getByRole('link',{name:/Podeli dokument/i}).click();
 for(const title of ['Ponuda za kupca','Specifikacija za kancelariju']){
  await page.getByRole('button',{name:title,exact:true}).click();
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Preuzmi PDF'}).click();
  const path=testInfo.outputPath(title==='Ponuda za kupca'?'kote-ponuda.pdf':'kote-specifikacija.pdf');
  await (await downloading).saveAs(path);const text=await pdfText(page,path);
  expect(text).toContain('Staklo: 850 × 1500 mm');expect(text).toContain('Parapet: 850 × 550 mm');
  await page.getByRole('dialog',{name:/Pregled:/}).getByRole('button',{name:'Zatvori',exact:true}).click();
 }
});

test('Kota u proširenom crtežu i fiksna polja vrata koriste isti prozor',async({page})=>{
 await page.goto('/posao/AT-2026-012/nov/vrata');
 await page.getByRole('button',{name:'Proširi prikaz',exact:true}).click();
 const expanded=page.getByRole('dialog',{name:'Prošireni crtež',exact:true});
 await expanded.getByRole('button',{name:'Ukupna visina: 2100 mm',exact:true}).click();
 const edit=page.getByRole('dialog',{name:'Izmeni kotu: Ukupna visina',exact:true});
 await edit.getByLabel('Dimenzija (mm)').fill('2200');await edit.getByRole('button',{name:'Primeni meru'}).click();
 await expect(expanded.getByRole('button',{name:'Ukupna visina: 2200 mm',exact:true})).toBeVisible();
 await expanded.getByRole('button',{name:'Zatvori',exact:true}).click();
 await page.getByRole('button',{name:'Raspored fiksnih polja',exact:true}).click();
 const layout=page.getByRole('dialog',{name:'Raspored fiksnih polja',exact:true});
 await layout.getByRole('checkbox',{name:'Fiksno gore',exact:true}).check();
 await layout.locator('[data-position-dimension="fixed:top"] [role=button]').click();
 const top=page.getByRole('dialog',{name:'Izmeni kotu: Fiksno gore',exact:true});
 await top.getByLabel('Dimenzija (mm)').fill('400');await top.getByRole('button',{name:'Primeni meru'}).click();
 await layout.getByRole('button',{name:'Primeni raspored',exact:true}).click();
 await expect(page.locator('.field-drawing [data-position-dimension="fixed:top"]')).toContainText('400');
 await expect(page.getByLabel('Visina (mm)',{exact:true})).toHaveValue('2200');
});
