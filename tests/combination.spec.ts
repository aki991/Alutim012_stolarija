import { test, expect } from '@playwright/test';

test('Vrata i prozor su jedna pozicija sa zasebnim merama i otvaranjem',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/posao/AT-2026-012/dodaj');
 await page.getByRole('link',{name:'Kombinacija',exact:true}).click();
 const field=(name:string)=>page.getByLabel(name,{exact:true});
 await field('Širina (vrata, mm)').fill('950');
 await field('Visina (vrata, mm)').fill('2150');
 await field('Širina (prozor, mm)').fill('1100');
 await field('Visina (prozor, mm)').fill('1250');
 await field('Otvaranje (prozor)').selectOption('Fiksno');
 await field('Položaj prozora').selectOption('left');
 await field('Poravnanje').selectOption('top');
 const window=page.locator('[data-combination-part="window"]');
 const door=page.locator('[data-combination-part="door"]');
 expect(Number(await window.getAttribute('height'))).toBeLessThan(Number(await door.getAttribute('height')));
 expect(Number(await window.getAttribute('x'))).toBeLessThan(Number(await door.getAttribute('x')));
 expect(await window.getAttribute('y')).toBe(await door.getAttribute('y'));
 await page.getByRole('button',{name:'Dodaj u posao',exact:true}).click();
 await expect(page.locator('.job-line').last()).toContainText('2050 × 2150');
 await page.getByRole('link',{name:'Izmeni element 4',exact:true}).click();
 await page.reload();
 await expect(field('Visina (prozor, mm)')).toHaveValue('1250');
 await expect(field('Otvaranje (prozor)')).toHaveValue('Fiksno');
 await expect(field('Položaj prozora')).toHaveValue('left');
 await expect(field('Poravnanje')).toHaveValue('top');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('link',{name:'Nazad',exact:true}).click();
 await page.getByRole('link',{name:/Podeli dokument/i}).click();
 await page.getByRole('button',{name:'Specifikacija za kancelariju',exact:true}).click();
 const downloading=page.waitForEvent('download');
 await page.getByRole('button',{name:'Preuzmi PDF',exact:true}).click();
 expect((await downloading).suggestedFilename()).toContain('specifikacija.pdf');
});

test('Katalog otvara isti konfigurator kombinacije',async({page})=>{
 await page.setViewportSize({width:768,height:1024});
 await page.goto('/katalog');
 await page.getByRole('button',{name:'Kombinacija',exact:true}).click();
 await page.getByLabel('Naziv posla ili prezime kupca').fill('Kombinacija iz kataloga');
 await page.getByRole('button',{name:'Započni merenje'}).click();
 await expect(page).toHaveURL(/\/nov\/kombinacija$/);
 await expect(page.getByLabel('Visina (prozor, mm)',{exact:true})).toHaveValue('1400');
 await expect(page.getByLabel('Visina (vrata, mm)',{exact:true})).toHaveValue('2100');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
