import { expect, test } from '@playwright/test';
import { pdfText } from './helpers/pdf';

test('Prag prati vrata u kombinaciji i zaobilazi bočna fiksna polja modela',async({page})=>{
 await page.setViewportSize({width:800,height:1000});
 await page.goto('/posao/AT-2026-012/nov/kombinacija');
 await page.getByRole('group',{name:'Donji deo vrata',exact:true}).getByRole('button',{name:'ALU prag 24 mm',exact:true}).click();
 const drawing=page.locator('.field-drawing svg'),door=drawing.locator('[data-combination-part="door"]'),threshold=drawing.locator('[data-threshold-mm="24"]');
 const oldX=await door.getAttribute('x');
 await page.getByLabel('Položaj prozora',{exact:true}).selectOption('left');
 await expect(door).not.toHaveAttribute('x',oldX!);
 await expect(threshold).toHaveAttribute('x',(await door.getAttribute('x'))!);
 await expect(threshold).toHaveAttribute('width',(await door.getAttribute('width'))!);
 await expect(page.getByLabel('Visina (vrata, mm)',{exact:true})).toHaveValue('2100');
 await page.goto('/posao/AT-2026-012/nov/model?model=d-balcony-panel-sides-double');
 await page.getByRole('group',{name:'Donji deo vrata',exact:true}).getByRole('button',{name:'ALU prag 24 mm',exact:true}).click();
 await expect(threshold).toHaveCount(2);
 const positions=await threshold.evaluateAll(nodes=>nodes.map(node=>({x:Number(node.getAttribute('x')),width:Number(node.getAttribute('width'))})));
 expect(positions[0].x).toBeLessThan(positions[1].x);
 expect(positions[0].width).toBeCloseTo(positions[1].width);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for(const width of [390,800,1366])test(`Donji deo vrata, ukupna visina i čuvanje: ${width}`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});
 await page.goto('/posao/AT-2026-012/nov/vrata');
 const group=page.getByRole('group',{name:'Donji deo vrata',exact:true});
 await group.getByRole('button',{name:'ALU prag 24 mm',exact:true}).click();
 await expect(page.getByLabel('Visina (mm)',{exact:true})).toHaveValue('2100');
 await expect(page.getByText('Ukupna visina vrata uključuje ALU prag od 24 mm.',{exact:true})).toBeVisible();
 const drawing=page.locator('.field-drawing svg');
 await expect(drawing.locator('[data-threshold-mm="24"]')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.reload();
 await expect(group.getByRole('button',{name:'ALU prag 24 mm',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Dodaj u posao',exact:true}).click();
 await expect(page.locator('.job-line').last()).toContainText('ALU prag 24 mm');
 await page.locator('.job-line').last().getByRole('link',{name:/Izmeni element/}).click();
 await expect(group.getByRole('button',{name:'ALU prag 24 mm',exact:true})).toHaveAttribute('aria-pressed','true');
 await group.getByRole('button',{name:'Ram u krug',exact:true}).click();
 await expect(drawing.locator('[data-threshold-mm="24"]')).toHaveCount(0);
 await expect(page.getByLabel('Visina (mm)',{exact:true})).toHaveValue('2100');
 await page.getByRole('button',{name:'Sačuvaj izmene',exact:true}).click();
 await expect(page.locator('.job-line').last()).toContainText('Ram u krug');
 if(width!==1366)return;
 await page.locator('.job-line').last().getByRole('link',{name:/Izmeni element/}).click();
 await group.getByRole('button',{name:'ALU prag 24 mm',exact:true}).click();
 await page.getByRole('button',{name:'Sačuvaj izmene',exact:true}).click();
 await page.getByRole('link',{name:/Podeli dokument/i}).click();
 await expect(page.locator('.price-line').last()).toContainText('ALU prag 24 mm');
 for(const title of ['Ponuda za kupca','Specifikacija za kancelariju']){
  await page.getByRole('button',{name:title,exact:true}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Preuzmi PDF'}).click();
  const path=testInfo.outputPath(title==='Ponuda za kupca'?'prag-ponuda.pdf':'prag-specifikacija.pdf');
  await (await download).saveAs(path);const text=await pdfText(page,path);
  expect(text).toContain('Donji deo vrata: ALU prag 24 mm');
  expect(text).toContain('Ukupna visina vrata 2100 mm uključuje prag od 24 mm.');
  expect(text).not.toContain('2124');
  await page.getByRole('dialog',{name:/Pregled:/}).getByRole('button',{name:'Zatvori',exact:true}).click();
 }
});
