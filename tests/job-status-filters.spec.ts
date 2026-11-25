import { expect, test } from '@playwright/test';

for(const width of [390,1366])test(`Više statusa prikazuje uniju poslova i pamti izbor: ${width}`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});await page.goto('/poslovi');
 const filters=page.getByRole('group',{name:'Status posla',exact:true});
 await expect(page.locator('.job-card')).toHaveCount(4);
 await filters.getByRole('button',{name:'U izradi',exact:true}).click();
 await expect(page.locator('.job-card')).toHaveCount(1);
 await filters.getByRole('button',{name:'Ponuda',exact:true}).click();
 await expect(page.locator('.job-card')).toHaveCount(3);
 expect(new URL(page.url()).searchParams.getAll('status')).toEqual(expect.arrayContaining(['U izradi','Ponuda']));
 await page.reload();
 for(const name of ['U izradi','Ponuda'])await expect(filters.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.job-card')).toHaveCount(3);
 await page.getByLabel('Pretraži poslove').fill('Petrović');
 await expect(page.locator('.job-card')).toHaveCount(1);
 await page.getByLabel('Pretraži poslove').fill('');
 await page.screenshot({path:testInfo.outputPath('poslovi-vise-statusa.png'),fullPage:true});
 await filters.getByRole('button',{name:'U izradi',exact:true}).click();
 await expect(page.locator('.job-card')).toHaveCount(2);
 await filters.getByRole('button',{name:'Svi',exact:true}).click();
 await expect(page.locator('.job-card')).toHaveCount(4);
 expect(new URL(page.url()).searchParams.has('status')).toBe(false);
 await page.goto('/poslovi?status=Ponuda');await expect(page.locator('.job-card')).toHaveCount(2);
 await page.goto('/poslovi?status=nepoznat');await expect(page.locator('.job-card')).toHaveCount(4);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
