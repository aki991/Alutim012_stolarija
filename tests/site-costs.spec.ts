import { expect, test } from '@playwright/test';
import { pdfText } from './helpers/pdf';

for(const width of [390,1366])test(`Montaža i put su uključeni u elemente i PDF: ${width}`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});
 const path='/posao/AT-2026-012';await page.goto(path);
 await page.evaluate(()=>{
  const data=JSON.parse(localStorage.getItem('alu-tim-teren-v1')!);
  const j=data.jobs.find((job:{id:string})=>job.id==='AT-2026-012');
  j.positions=[{...j.positions[0],name:'Prozor',quantity:1,manualPrice:400,photos:[]},{...j.positions[2],name:'Vrata',quantity:1,manualPrice:500,photos:[]}];
  j.status='Merenje';j.vatMode='none';j.discount=0;j.transport=35;j.extraCost=0;delete j.siteCosts;
  localStorage.setItem('alu-tim-teren-v1',JSON.stringify(data));
 });await page.reload();
 await page.getByLabel('Cena montaže za ceo posao (€)',{exact:true}).fill('100');
 await page.getByLabel('Cena puta za ceo posao (€)',{exact:true}).fill('100');
 await expect(page.locator('.job-line').nth(0).locator('.line-price')).toContainText('500,00');
 await expect(page.locator('.job-line').nth(1).locator('.line-price')).toContainText('600,00');
 await expect(page.getByTestId('job-total')).toContainText('1.100,00');
 await page.reload();
 await expect(page.getByLabel('Cena montaže za ceo posao (€)',{exact:true})).toHaveValue('100');
 await expect(page.getByLabel('Cena puta za ceo posao (€)',{exact:true})).toHaveValue('100');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('link',{name:/Podeli dokument/i}).click();
 const price=page.getByRole('textbox',{name:'Cena po komadu za Prozor',exact:true});
 await expect(price).toHaveValue('500,00');
 await expect(page.getByRole('textbox',{name:'Cena po komadu za Vrata',exact:true})).toHaveValue('600,00');
 await expect(page.locator('.price-total')).not.toContainText(/Transport|Montaža|Put/);
 await price.fill('550');await price.blur();await page.reload();await expect(price).toHaveValue('550,00');
 await price.fill('500');await price.blur();await page.reload();await expect(price).toHaveValue('500,00');
 if(width===1366)for(const title of ['Ponuda za kupca','Specifikacija za kancelariju']){
  await page.getByRole('button',{name:title,exact:true}).click();
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Preuzmi PDF'}).click();
  const filePath=testInfo.outputPath(title==='Ponuda za kupca'?'ukljuceni-troskovi-ponuda.pdf':'ukljuceni-troskovi-specifikacija.pdf');
  await (await downloading).saveAs(filePath);const text=await pdfText(page,filePath);
  expect(text).toContain('500,00');expect(text).toContain('600,00');expect(text).toContain('1.100,00');
  expect(text).not.toContain('Transport:');expect(text).not.toContain('Cena montaže');expect(text).not.toContain('Cena puta');
  await page.getByRole('dialog',{name:/Pregled:/}).getByRole('button',{name:'Zatvori',exact:true}).click();
 }
 await page.goto('/podesavanja');await page.getByRole('checkbox',{name:/Prikaži cene/}).uncheck();
 await page.goto(path);
 await expect(page.locator('.line-price')).toHaveCount(0);
 await expect(page.getByLabel('Cena montaže za ceo posao (€)',{exact:true})).toHaveValue('100');
});
