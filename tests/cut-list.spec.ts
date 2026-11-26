import { test,expect,type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pdfText } from './helpers/pdf';

const route='/posao/AT-2026-012/nov/nacrtaj';
async function shape(page:Page,label:string){
 const button=page.getByRole('button',{name:label,exact:true});
 if(!await button.isVisible())await page.getByRole('button',{name:'Početni oblici',exact:true}).click();
 await button.click();
}

test('Krojna lista prati uglove elementa, čuva se uz element i izvozi PDF bez cena',async({page},testInfo)=>{
 await page.goto(route);await shape(page,'Pravougaoni prozor');
 await expect(page.getByRole('region',{name:/^Krojna lista:/})).toHaveCount(0);
 await shape(page,'Trapezni prozor');
 const list=page.getByRole('region',{name:/^Krojna lista:/});
 await expect(list).toBeVisible();await expect(list.locator('tbody tr')).toHaveCount(4);
 await expect(list.locator('tbody tr').nth(0)).toContainText('49,73°');
 await expect(list.locator('tbody tr').nth(1)).toContainText('40,27°');
 await expect(list.locator('tbody tr').nth(0)).toContainText('Testera 40,27°');
 await expect(list.locator('tbody tr').nth(1)).toContainText('2.433,1');
 const frame=await page.locator('.custom-canvas').boundingBox();expect(frame!.height).toBeGreaterThan(200);
 await page.screenshot({path:testInfo.outputPath('desktop.png')});
 await page.getByLabel('Visina oblika (mm)',{exact:true}).fill('2000');
 await page.getByRole('button',{name:'Primeni mere oblika',exact:true}).click();
 await expect(list.locator('tbody tr').nth(0)).toContainText('50,88°');
 const downloading=page.waitForEvent('download');
 await list.getByRole('button',{name:'Preuzmi krojnu listu (PDF)',exact:true}).click();
 const download=await downloading,path=testInfo.outputPath('krojna-lista.pdf');
 expect(download.suggestedFilename()).toContain('-krojna-lista-');await download.saveAs(path);
 expect((await readFile(path)).subarray(0,5).toString()).toBe('%PDF-');
 const text=await pdfText(page,path);
 expect(text).toContain('Krojna lista - ram elementa');expect(text).toContain('50,88°');expect(text).toContain('Testera: 39,12°');
 expect(text).toContain('Porodica Petrović');expect(text).not.toContain('€');expect(text).toContain('bez dodataka za varenje');
 await page.getByRole('button',{name:'Dodaj u posao',exact:true}).click();
 await expect(page).toHaveURL('/posao/AT-2026-012');
 await expect(list).toHaveCount(1);await expect(list).toContainText('50,88°');
 await page.reload();await expect(list).toContainText('50,88°');
});

test('Krojna lista na telefonu ostaje ispod skice, može da se sklopi i sačuva',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await page.goto(route);await shape(page,'Trapezni prozor');
 const list=page.getByRole('region',{name:/^Krojna lista:/});
 await expect(list).toBeVisible();await expect(list.locator('tbody tr')).toHaveCount(4);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const drawing=await page.locator('.custom-canvas-region').boundingBox(),box=await list.boundingBox();
 expect(box!.y).toBeGreaterThanOrEqual(drawing!.y);await page.screenshot({path:testInfo.outputPath('mobile.png')});
 const toggle=list.getByRole('button',{name:/^Krojna lista/});
 await toggle.click();await expect(list.locator('table')).toHaveCount(0);
 await expect(list.getByRole('button',{name:'Preuzmi krojnu listu (PDF)',exact:true})).toBeVisible();
 await toggle.click();await expect(list.locator('table')).toBeVisible();
 const downloading=page.waitForEvent('download');await list.getByRole('button',{name:'Preuzmi krojnu listu (PDF)',exact:true}).click();
 await (await downloading).saveAs(testInfo.outputPath('mobilna-krojna-lista.pdf'));
});
