import { expect, test, type Page } from '@playwright/test';

const job='/posao/AT-2026-012';

async function shutterOptions(page:Page){
 await page.getByRole('button',{name:'Dodatne opcije',exact:true}).click();
 await page.getByText('Dodatna oprema',{exact:true}).click();
 return page.getByRole('checkbox',{name:'Roletna',exact:true});
}

test('Kutija u otvoru ima svoju kotu i ostaje uz element u ponudi i PDF-u',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto(`${job}/nov/prozor`);
 const originalPrice=await page.locator('.measurement-amount strong').innerText();
 await (await shutterOptions(page)).check();
 await page.getByLabel('Tip roletne',{exact:true}).selectOption('top');
 await expect(page.locator('.shutter-measure-note')).toHaveText('Otvor 1400 mm = ram 1200 mm + kutija 200 mm.');
 await page.getByRole('button',{name:'Gotovo',exact:true}).click();
 const height=page.getByLabel('Visina otvora (mm)',{exact:true});
 const box=page.locator('[data-shutter-box="top"]');
 await expect(height).toHaveValue('1400');
 await expect(box).toBeVisible();
 await expect(page.locator('[data-shutter-dimension="box"]')).toHaveText('200 mm');
 await expect(page.locator('[data-shutter-dimension="frame"]')).toHaveText('1200 mm');
 await expect(page.locator('.measurement-amount strong')).not.toHaveText(originalPrice);
 await height.fill('1500');
 await shutterOptions(page);
 await page.getByLabel('Visina kutije (mm)',{exact:true}).fill('180');
 await page.getByRole('button',{name:'Gotovo',exact:true}).click();
 await expect(page.locator('[data-shutter-dimension="frame"]')).toHaveText('1320 mm');
 await page.reload();
 await expect(height).toHaveValue('1500');
 await expect(page.locator('[data-shutter-dimension="box"]')).toHaveText('180 mm');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Dodaj u posao',exact:true}).click();
 const line=page.locator('.job-line').last();
 await expect(line).toContainText('1600 × 1500');
 await expect(line.locator('[data-shutter-box="top"]')).toBeVisible();
 await page.getByRole('link',{name:/Podeli dokument/i}).click();
 await expect(page.locator('.price-line').last()).toContainText('1600 × 1500 mm');
 await page.getByRole('button',{name:'Specifikacija za kancelariju',exact:true}).click();
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Preuzmi PDF',exact:true}).click();
 await (await download).saveAs(testInfo.outputPath('roletna-specifikacija.pdf'));
});

test('Kombinacija razlikuje kutiju u otvoru, ispred rama i iznad otvora',async({page})=>{
 await page.goto(`${job}/nov/kombinacija`);
 await (await shutterOptions(page)).check();
 const type=page.getByLabel('Tip roletne',{exact:true});
 await expect(type.locator('option')).toHaveCount(5);
 await type.selectOption('flush');
 await page.getByLabel('Položaj kutije',{exact:true}).selectOption('inside');
 await page.getByRole('button',{name:'Gotovo',exact:true}).click();
 await expect(page.getByLabel('Visina otvora (prozor, mm)',{exact:true})).toHaveValue('1400');
 await expect(page.locator('[data-shutter-dimension="frame"]')).toHaveText('1220 mm');
 await shutterOptions(page);
 await page.getByLabel('Položaj kutije',{exact:true}).selectOption('overlay');
 await expect(page.locator('.shutter-measure-note')).toContainText('Ram 1400 mm · roletna 900 × 1400 mm');
 await type.selectOption('facade');
 await page.getByLabel('Širina roletne (mm)',{exact:true}).fill('950');
 await expect(page.locator('.shutter-measure-note')).toContainText('Ram 1400 mm · roletna 950 × 1565 mm');
 await page.getByRole('button',{name:'Gotovo',exact:true}).click();
 await expect(page.getByLabel('Visina (prozor, mm)',{exact:true})).toHaveValue('1400');
 const box=page.locator('[data-shutter-box="facade"]');
 const window=page.locator('[data-combination-part="window"]');
 expect(Number(await box.getAttribute('y'))).toBeLessThan(Number(await window.getAttribute('y')));
 expect(Number(await box.getAttribute('width'))).toBeGreaterThan(Number(await window.getAttribute('width')));
 await expect(page.locator('[data-shutter-dimension="frame"]')).toHaveCount(0);
 await (await shutterOptions(page)).uncheck();
 await page.getByRole('button',{name:'Gotovo',exact:true}).click();
 await expect(box).toHaveCount(0);
 await expect(page.getByLabel('Visina (prozor, mm)',{exact:true})).toHaveValue('1400');
});

test('Samostalna roletna koristi cenu tipa i prikazuje kutiju, a ručna skica prikazuje podfasadnu kutiju',async({page})=>{
 await page.goto('/cenovnik');
 await page.getByLabel('Spoljna na ramu / u špaletni (€/m²)',{exact:true}).fill('70');
 await page.goto(`${job}/nov/roletna`);
 await expect(page.locator('[data-shutter-box="reveal"]')).toBeVisible();
 await expect(page.locator('.shutter-measure-note')).toContainText('Ukupna visina roletne 1400 mm uključuje kutiju');
 const price=await page.locator('.measurement-amount strong').innerText();
 await page.getByLabel('Tip roletne',{exact:true}).selectOption('lintel');
 await expect(page.locator('[data-shutter-box="lintel"]')).toBeVisible();
 await expect(page.locator('.measurement-amount strong')).not.toHaveText(price);
 await page.goto(`${job}/nov/nacrtaj`);
 await page.getByRole('button',{name:'Trapezni prozor',exact:true}).click();
 await (await shutterOptions(page)).check();
 await page.getByLabel('Tip roletne',{exact:true}).selectOption('flush');
 await page.getByRole('button',{name:'Gotovo',exact:true}).click();
 await expect(page.locator('.custom-canvas [data-shutter-box="flush"]')).toBeVisible();
 await expect(page.locator('.custom-canvas [data-contour-angle]')).toHaveCount(2);
 await expect(page.getByRole('button',{name:'Dodaj u posao',exact:true})).toBeEnabled();
});
