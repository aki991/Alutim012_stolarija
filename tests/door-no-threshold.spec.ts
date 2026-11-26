import {expect,test} from '@playwright/test';
import {pdfText} from './helpers/pdf';

const job='/posao/AT-2026-012';
for(const width of [390,800,1366])test(`Bez praga uklanja donji ram i ostaje sačuvano: ${width}`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});await page.goto(`${job}/nov/vrata`);
 const group=page.getByRole('group',{name:'Donji deo vrata',exact:true}),drawing=page.locator('.field-drawing svg');
 await group.getByRole('button',{name:'ALU prag 24 mm',exact:true}).click();await expect(drawing.locator('[data-threshold-mm]')).toHaveCount(1);
 await group.getByRole('button',{name:'Bez praga',exact:true}).click();
 await expect(group.getByRole('button',{name:'Bez praga',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(drawing.locator('[data-threshold-mm]')).toHaveCount(0);await expect(drawing.locator('[data-open-door-frame]')).toHaveCount(1);
 await expect(page.getByLabel('Visina (mm)',{exact:true})).toHaveValue('2100');
 const d=await drawing.locator('[data-open-door-frame]').getAttribute('d');expect(d).toMatch(/^M[\d.]+ [\d.]+V[\d.]+H[\d.]+V[\d.]+$/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.measurement-canvas').scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath(`bez-praga-${width}.png`)});
 await page.reload();await expect(group.getByRole('button',{name:'Bez praga',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Dodaj u posao',exact:true}).click();await expect(page.locator('.job-line').last()).toContainText('Bez praga');
 await page.locator('.job-line').last().getByRole('link',{name:/Izmeni element/}).click();
 await expect(group.getByRole('button',{name:'Bez praga',exact:true})).toHaveAttribute('aria-pressed','true');
 await group.getByRole('button',{name:'Ram u krug',exact:true}).click();await expect(drawing.locator('[data-open-door-frame]')).toHaveCount(0);
 await group.getByRole('button',{name:'Bez praga',exact:true}).click();await page.getByRole('button',{name:'Sačuvaj izmene',exact:true}).click();
 if(width!==1366)return;
 await page.getByRole('link',{name:/Podeli dokument/i}).click();await expect(page.locator('.price-line').last()).toContainText('Bez praga');
 for(const title of ['Ponuda za kupca','Specifikacija za kancelariju']){
  await page.getByRole('button',{name:title,exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Preuzmi PDF'}).click();
  const path=testInfo.outputPath(title==='Ponuda za kupca'?'bez-praga-ponuda.pdf':'bez-praga-specifikacija.pdf');await (await download).saveAs(path);
  const text=await pdfText(page,path);expect(text).toContain('Donji deo vrata: Bez praga');expect(text).not.toContain('uključuje prag od 24 mm');
  await page.getByRole('dialog',{name:/Pregled:/}).getByRole('button',{name:'Zatvori',exact:true}).click();
 }
});

test('Bez praga radi za balkonska, klizna, kombinovana i kataloška vrata sa fiksnim poljima',async({page})=>{
 await page.setViewportSize({width:800,height:1000});
 for(const [route,count] of [['balkonska',1],['klizni',1],['kombinacija',1],['model?model=d-interior-panel-plain-l',1],['model?model=d-balcony-panel-sides-double',2]] as const){
  await page.goto(`${job}/nov/${route}`);
  await page.getByRole('group',{name:'Donji deo vrata',exact:true}).getByRole('button',{name:'Bez praga',exact:true}).click();
  const drawing=page.locator('.field-drawing svg');await expect(drawing.locator('[data-open-door-frame]')).toHaveCount(count);await expect(drawing.locator('[data-threshold-mm]')).toHaveCount(0);
  if(route==='kombinacija')await expect(drawing.locator('[data-combination-part="window"]')).toHaveAttribute('stroke','#1f2529');
 }
});

test('Nacrtana vrata bez praga čuvaju konturu i izostavljaju donji profil iz krojne liste',async({page},testInfo)=>{
 await page.setViewportSize({width:800,height:1000});await page.goto(`${job}/nov/nacrtaj`);
 const shape=page.getByRole('button',{name:'Trapezni prozor',exact:true});if(!await shape.isVisible())await page.getByRole('button',{name:'Početni oblici',exact:true}).click();await shape.click();
 await page.getByLabel('Namena elementa',{exact:true}).selectOption('door');
 await page.getByRole('group',{name:'Donji deo vrata',exact:true}).getByRole('button',{name:'Bez praga',exact:true}).click();
 await expect(page.locator('.custom-canvas [data-open-door-frame]')).toHaveCount(1);await expect(page.locator('.custom-canvas [data-threshold-mm]')).toHaveCount(0);
 const list=page.getByRole('region',{name:/Krojna lista:/});await expect(list.locator('tbody tr')).toHaveCount(3);await expect(list).toContainText('Slobodan kraj bez praga');
 await page.getByRole('button',{name:'Sačuvaj',exact:true}).click();await expect(page).toHaveURL(/\/element\//);await page.reload();
 await expect(page.locator('.custom-canvas [data-open-door-frame]')).toHaveCount(1);await expect(page.getByRole('button',{name:'Bez praga',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.screenshot({path:testInfo.outputPath('nacrtana-vrata-bez-praga.png')});
});

test('Porta Royal nudi Bez praga i isključuje ranije izabran padajući prag',async({page})=>{
 await page.route('https://portaroyal.rs/wp-content/uploads/**',route=>route.abort());await page.goto(`${job}/nov/sobna-vrata?serija=siena&dekor=lipa&tip=s`);
 await page.getByLabel('Padajući prag',{exact:true}).check();
 const group=page.getByRole('group',{name:'Donji deo vrata',exact:true});await group.getByRole('button',{name:'Bez praga',exact:true}).click();
 await expect(page.getByLabel('Padajući prag',{exact:true})).not.toBeChecked();await expect(page.locator('.porta-bottom-preview [data-open-door-frame]')).toHaveCount(1);
 await page.reload();await expect(group.getByRole('button',{name:'Bez praga',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByLabel('Padajući prag',{exact:true}).check();await expect(group.getByRole('button',{name:'Bez praga',exact:true})).toHaveAttribute('aria-pressed','false');
});
