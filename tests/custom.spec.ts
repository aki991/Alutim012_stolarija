import {test,expect,type Page} from '@playwright/test';
import path from 'node:path';
const route='/posao/AT-2026-012/nov/nacrtaj';
async function shape(page:Page,label:string){if(page.viewportSize()!.width<=700)await page.getByRole('button',{name:'Početni oblici',exact:true}).click();await page.getByRole('button',{name:label,exact:true}).click();}
async function draft(page:Page){return page.evaluate(()=>{const match=location.pathname.match(/^\/posao\/([^/]+)\/(?:element\/([^/]+)|nov\/nacrtaj)/)!;const key=`alu-custom-draft-v1:${match[1]}:${match[2]||'new'}`;return JSON.parse(sessionStorage.getItem(key)!);});}
async function xy(page:Page,x:number,y:number){return page.locator('.custom-canvas').evaluate((el,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform((el as SVGSVGElement).getScreenCTM()!);return{x:q.x,y:q.y};},{x,y});}
async function drag(page:Page,a:[number,number],b:[number,number]){const from=await xy(page,...a),to=await xy(page,...b);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.mouse.up();}
async function selectEdge(page:Page,n=1){const details=page.locator('.custom-measures');if(!await details.getAttribute('open'))await details.locator('summary').click();await details.getByRole('button',{name:new RegExp(`Stranica ${n}`)}).click();}
test('Otvaranje se upisuje po poljima i ostaje u sačuvanom elementu',async({page},testInfo)=>{
 await page.goto(route);
 await shape(page,'Trapezni prozor');
 await page.getByRole('button',{name:'Dodaj prečku',exact:true}).click();
 await drag(page,[1200,200],[1200,1600]);
 await page.getByRole('button',{name:'Označi otvaranje',exact:true}).click();
 const side=page.getByLabel('Strana otvaranja',{exact:true});
 const left=await xy(page,600,900);
 await page.mouse.click(left.x,left.y);
 await side.selectOption('left');
 const right=await xy(page,1800,900);
 await page.mouse.click(right.x,right.y);
 await side.selectOption('right');
 await expect(page.locator('.custom-canvas [data-opening-side]')).toHaveCount(2);
 await page.getByRole('button',{name:'Dodaj u posao',exact:true}).click();
 await page.getByRole('link',{name:'Izmeni element 4',exact:true}).click();
 await expect(page.locator('.custom-canvas [data-opening-side="left"]')).toHaveCount(1);
 await expect(page.locator('.custom-canvas [data-opening-side="right"]')).toHaveCount(1);
 await page.screenshot({path:testInfo.outputPath('otvaranje.png')});
 await page.getByRole('link',{name:'Nazad',exact:true}).click();
 await page.getByRole('link',{name:/Podeli dokument/i}).click();
 await page.getByRole('button',{name:'Specifikacija za kancelariju',exact:true}).click();
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Preuzmi PDF',exact:true}).click();
 await (await download).saveAs(testInfo.outputPath('otvaranje-specifikacija.pdf'));
});
test('Lučni prozor na telefonu zadržava fiksni luk i otvaranje donjeg polja',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto(route);
 await shape(page,'Polukružni prozor');
 await page.getByRole('button',{name:'Podeli prozor',exact:true}).click();
 const layout=page.getByRole('dialog',{name:'Podeli prozor'});
 await expect(layout.getByLabel('Fiksno gore (mm)')).toHaveValue('1200');
 await layout.getByRole('button',{name:'Primeni raspored'}).click();
 const lower=await xy(page,1200,1400);
 await page.mouse.click(lower.x,lower.y);
 await page.getByLabel('Strana otvaranja',{exact:true}).selectOption('right');
 const marks=page.locator('.custom-canvas [data-opening-side]');
 await expect(marks).toHaveCount(1);
 expect((await draft(page)).customGeometry.openings[0].region).toContain('layout-top');
 await page.getByRole('button',{name:'Dodaj u posao',exact:true}).click();
 await page.getByRole('link',{name:'Izmeni element 4',exact:true}).click();
 await expect(marks).toHaveCount(1);
 await expect(marks).toHaveAttribute('data-opening-side','right');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:testInfo.outputPath('lucni-raspored.png')});
});
for(const size of [{width:390,height:844},{width:1024,height:768},{width:768,height:1024},{width:1440,height:900}]){
 test(`Nacrtaj po meri: stvarna izmena, nacrt i čuvanje ${size.width}`,async({page})=>{
  await page.setViewportSize(size);await page.goto(route);await expect(page.getByRole('heading',{name:'Nacrtaj element',exact:true})).toBeVisible();await shape(page,'Trouglasti prozor');const before=await draft(page);await selectEdge(page);await page.getByLabel('Dužina (mm)',{exact:true}).fill('1900');await page.getByRole('button',{name:'Potvrdi meru'}).click();const after=await draft(page);expect(after.customGeometry.points[0]).toEqual(before.customGeometry.points[0]);expect(after.customGeometry.points[1].y).toBeCloseTo(-300);expect(after.height).toBeCloseTo(1900);await page.getByRole('button',{name:'Undo',exact:true}).click();expect((await draft(page)).height).toBeCloseTo(1600);await page.getByRole('button',{name:'Redo',exact:true}).click();expect((await draft(page)).height).toBeCloseTo(1900);await page.reload();expect((await draft(page)).height).toBeCloseTo(1900);
  await page.getByRole('button',{name:'Dodatne opcije',exact:true}).click();const options=page.getByRole('dialog',{name:'Dodatne opcije'});await options.getByLabel('Naziv elementa',{exact:true}).fill('Trougao za proveru');await options.getByRole('button',{name:'Antracit',exact:true}).click();await expect(options.getByLabel('Okov',{exact:true})).toHaveCount(0);await options.getByRole('button',{name:'Gotovo',exact:true}).click();await page.getByRole('button',{name:'Uklopi ceo nacrt'}).click();await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:`test-results/custom-${size.width}-merenje.png`});
  if(size.width<=700){await expect(page.getByRole('navigation',{name:'Donja navigacija'})).toBeVisible();await page.getByRole('button',{name:'Fullscreen crtanje'}).click();await expect(page.locator('.custom-page')).toHaveClass(/custom-fullscreen/);await page.screenshot({path:'test-results/custom-390-fullscreen.png'});await page.getByRole('button',{name:'Zatvori fullscreen'}).click();}
  await page.getByRole('button',{name:'Dodaj u posao',exact:true}).click();await expect(page.locator('.job-line')).toHaveCount(4);await expect(page.locator('.job-line').last()).toContainText('Za proveru');await expect(page.locator('.summary-price')).toContainText('Zbir poznatih stavki');await page.getByRole('link',{name:'Izmeni element 4',exact:true}).click();await expect(page.getByRole('heading',{name:'Nacrtaj element'})).toBeVisible();expect((await draft(page)).customGeometry.points).toEqual(after.customGeometry.points);
 });
}
test('Slobodne linije se spajaju, čvor se pomera, a zumiranje ne menja mere',async({page})=>{
 await page.setViewportSize({width:1024,height:768});await page.goto(route);await drag(page,[0,0],[1600,0]);await drag(page,[1600,0],[1600,1200]);await drag(page,[1600,1200],[0,1200]);await drag(page,[0,1200],[2,2]);let g=(await draft(page)).customGeometry;expect(g.points).toHaveLength(4);expect(g.edges[3].to).toBe(g.edges[0].from);await expect(page.getByRole('button',{name:'Dodaj u posao',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Dodaj prečku',exact:true}).click();await drag(page,[800,0],[800,1200]);g=(await draft(page)).customGeometry;expect(g.bars).toHaveLength(1);await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Izaberi / Pomeri',exact:true}).click();await drag(page,[1600,0],[1750,-100]);const moved=(await draft(page)).customGeometry;expect(moved.points[1].x).toBeCloseTo(1750);expect(moved.points[1].y).toBeCloseTo(-100);await page.getByRole('button',{name:'Uvećaj nacrt'}).click();await page.getByRole('button',{name:'Umanji nacrt'}).click();expect((await draft(page)).customGeometry).toEqual(moved);
});
test('Kružni luk kroz tri tačke, potvrda konture i izmena radijusa',async({page})=>{
 await page.setViewportSize({width:1024,height:768});await page.goto(route);await page.getByRole('button',{name:'Luk',exact:true}).click();await drag(page,[0,1000],[1600,1000]);const via=await xy(page,800,200);await page.mouse.click(via.x,via.y);expect((await draft(page)).customGeometry.edges[0].kind).toBe('arc');await expect(page.getByRole('button',{name:'Dodaj u posao',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Završi oblik',exact:true}).click();await expect(page.getByRole('button',{name:'Dodaj u posao',exact:true})).toBeEnabled();await selectEdge(page);await page.getByLabel('Radijus R (mm)',{exact:true}).fill('700');await page.getByRole('button',{name:'Potvrdi meru'}).click();await expect(page.getByRole('alert')).toContainText('polovina tetive');await page.getByLabel('Radijus R (mm)',{exact:true}).fill('1000');await page.getByRole('button',{name:'Potvrdi meru'}).click();await expect(page.getByRole('alert')).toHaveCount(0);expect((await draft(page)).customGeometry.edges[0].via.y).toBeCloseTo(600);
});
test('Dva prsta zumiraju platno bez pomeranja čvorova',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(route);await shape(page,'Trouglasti prozor');await page.getByRole('button',{name:'Fullscreen crtanje'}).click();const before=(await draft(page)).customGeometry,box=await page.locator('.custom-canvas').boundingBox(),x=box!.x+box!.width/2,y=box!.y+box!.height/2,client=await page.context().newCDPSession(page);await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-65,y,id:1},{x:x+65,y,id:2}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});expect((await draft(page)).customGeometry).toEqual(before);await page.getByRole('button',{name:'Uklopi ceo nacrt'}).click();await page.getByRole('button',{name:'Zatvori fullscreen'}).click();
});
test('Početni lučni i okrugli oblik poštuju ukupne mere i prečnik',async({page})=>{
 await page.setViewportSize({width:1024,height:768});await page.goto(route);await shape(page,'Polukružni prozor');await page.getByLabel('Širina oblika (mm)',{exact:true}).fill('1800');await page.getByLabel('Visina oblika (mm)',{exact:true}).fill('800');await page.getByRole('button',{name:'Primeni mere oblika'}).click();await expect(page.getByRole('alert')).toContainText('polovina širine');await page.getByLabel('Visina oblika (mm)',{exact:true}).fill('2200');await page.getByRole('button',{name:'Primeni mere oblika'}).click();expect((await draft(page)).height).toBe(2200);await shape(page,'Okrugli prozor');await page.getByLabel('Prečnik (mm)',{exact:true}).fill('1200');await page.getByRole('button',{name:'Primeni mere oblika'}).click();const p=await draft(page);expect(p.width).toBe(1200);expect(p.height).toBe(1200);
});
test('Nacrtaj iz kataloga, dupliranje, brisanje i PDF sa geometrijom i cenom za proveru',async({page})=>{
 await page.goto('/katalog');await page.getByRole('button',{name:'Nacrtaj',exact:true}).click();await page.getByLabel('Naziv posla ili prezime kupca').fill('Nacrt po meri');await page.getByRole('button',{name:'Započni merenje'}).click();await expect(page.getByRole('heading',{name:'Nacrtaj element',exact:true})).toBeVisible();await shape(page,'Polukružni prozor');await page.getByRole('button',{name:'Dodatne opcije',exact:true}).click();const options=page.getByRole('dialog');await options.locator('summary').filter({hasText:'Napomena'}).click();await options.getByLabel('Napomena',{exact:true}).fill('Proveriti savijanje profila i šablon na objektu.');await options.locator('summary').filter({hasText:'Fotografije'}).click();await options.locator('input[type=file]').setInputFiles('public/assets/house.jpg');await expect(options.locator('.field-photos img')).toHaveCount(1);await options.getByRole('button',{name:'Gotovo',exact:true}).click();await page.getByRole('button',{name:'Sačuvaj',exact:true}).click();await expect(page.getByRole('status')).toContainText('sačuvan');await page.getByRole('button',{name:'Sačuvaj u poslu',exact:true}).click();await expect(page.locator('.job-line')).toHaveCount(1);await page.getByLabel('Meni elementa 1',{exact:true}).click();await page.locator('.line-menu[open]').getByRole('button',{name:'Dupliraj',exact:true}).click();await expect(page.locator('.job-line')).toHaveCount(2);await page.getByLabel('Meni elementa 2',{exact:true}).click();await page.locator('.line-menu[open]').getByRole('button',{name:'Obriši',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Obriši element',exact:true}).click();await expect(page.locator('.job-line')).toHaveCount(1);
 await page.getByRole('link',{name:'Pogledaj cenu i podeli dokument',exact:true}).click();await expect(page.locator('.price-total')).toContainText('Cena zahteva proveru u kancelariji');for(const [label,name] of [['Ponuda za kupca','custom-ponuda.pdf'],['Specifikacija za kancelariju','custom-specifikacija.pdf']]){const downloading=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('button',{name:'Preuzmi PDF',exact:true}).click();await page.getByRole('dialog',{name:/Pregled:/}).getByRole('button',{name:'Zatvori'}).click();await(await downloading).saveAs(path.resolve('output/pdf',name));}await page.getByRole('link',{name:'Nazad',exact:true}).click();await page.getByRole('link',{name:'Izmeni element 1',exact:true}).click();await page.getByLabel('Ručna okvirna cena po komadu (€)',{exact:true}).fill('750');await page.getByRole('button',{name:'Sačuvaj u poslu',exact:true}).click();await expect(page.locator('.job-line')).toContainText('750,00');
});
test('Dodir crta liniju; rotacija i sačuvani element ne zagađuju novi nacrt',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(route);await page.getByRole('button',{name:'Fullscreen crtanje'}).click();const client=await page.context().newCDPSession(page),a=await xy(page,0,0),b=await xy(page,1600,0);await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x,y:a.y,id:1}]});for(let i=1;i<=8;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8,id:1}]});await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});expect((await draft(page)).customGeometry.edges).toHaveLength(1);const before=(await draft(page)).customGeometry;await page.setViewportSize({width:844,height:390});await expect(page.getByRole('button',{name:'Zatvori fullscreen'})).toBeVisible();expect((await draft(page)).customGeometry).toEqual(before);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.getByRole('button',{name:'Zatvori fullscreen'}).click();await page.setViewportSize({width:1024,height:768});await shape(page,'Trapezni prozor');await page.getByRole('button',{name:'Sačuvaj',exact:true}).click();await expect(page).toHaveURL(/\/element\//);await expect(page.getByRole('status')).toContainText('sačuvan');await page.goto(route);expect((await draft(page)).customGeometry.edges).toHaveLength(0);await expect(page.getByRole('button',{name:'Dodaj u posao',exact:true})).toBeDisabled();
});
