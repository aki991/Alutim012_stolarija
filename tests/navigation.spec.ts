import { test, expect, type Page } from '@playwright/test';
const job='/posao/AT-2026-012';

test('Završeni posao se ne nudi za nastavak merenja', async ({page}) => {
 await page.goto(job);
 await expect(page.locator('.sidebar-resume')).toHaveAttribute('href', job);
 const status = page.getByRole('combobox', {name: /Status posla/});
 await status.selectOption('Završeno');
 await expect(page.locator('.sidebar-resume')).toHaveCount(0);
 await page.reload();
 await expect(status).toHaveValue('Završeno');
 await expect(page.locator('.sidebar-resume')).toHaveCount(0);

 await page.setViewportSize({width:390,height:844});
 await page.goto('/poslovi');
 await expect(page.locator('.resume-strip')).toHaveCount(0);
 await page.getByRole('button', {name:'Više',exact:true}).click();
 await expect(page.getByRole('dialog', {name:'Više'}).getByRole('link', {name:/Nastavi merenje/})).toHaveCount(0);
 await page.goto('/katalog');
 await page.getByRole('button', {name:'Prozor',exact:true}).click();
 await expect(page.getByRole('dialog', {name:'Novi posao'})).toBeVisible();

 await page.goto(job);
 await status.selectOption('U izradi');
 await page.goto('/poslovi');
 await expect(page.locator('.resume-strip').getByRole('link', {name:/Nastavi merenje/})).toHaveAttribute('href', job);
});

async function globalLink(page:Page,label:string){
 const mobile=page.viewportSize()!.width<=700;
 if(mobile&&['Ponude','Cenovnik','Podešavanja'].includes(label)){
  await page.getByRole('navigation',{name:'Donja navigacija'}).getByRole('button',{name:'Više',exact:true}).click();
  return page.getByRole('dialog',{name:'Više'}).getByRole('link',{name:label,exact:true});
 }
 return page.getByRole('navigation',{name:mobile?'Donja navigacija':'Glavna navigacija'}).getByRole('link',{name:label,exact:true});
}
for(const width of [390,768,1024,1280]){
 test(`Trajna navigacija, katalog i povratak na posao: ${width}`,async({page})=>{
  await page.setViewportSize({width,height:width===390?844:900});await page.goto('/');
  await (await globalLink(page,'Poslovi')).click();await expect(page.getByRole('heading',{name:'Svi poslovi'})).toBeVisible();
  await page.locator('.job-card').filter({hasText:'Porodica Petrović'}).locator('.job-card-info').click();await expect(page.getByRole('heading',{name:'Posao: Porodica Petrović'})).toBeVisible();
  await (await globalLink(page,'Katalog')).click();await expect(page.locator('.quick-catalog-tile')).toHaveCount(10);await expect(page.getByRole('link',{name:'Sobna vrata',exact:true})).toBeVisible();await page.getByRole('link',{name:'Pregled posla',exact:true}).count().then(async count=>{if(count)await page.getByRole('link',{name:'Pregled posla',exact:true}).click();else await page.locator('.resume-strip').getByRole('link',{name:/Nastavi merenje/}).click();});
  await expect(page.getByRole('heading',{name:'Posao: Porodica Petrović'})).toBeVisible();
  await (await globalLink(page,'Katalog')).click();await page.getByRole('button',{name:'Prozor',exact:true}).click();await expect(page.getByLabel('Širina (mm)',{exact:true})).toHaveValue('1600');await expect(page.getByRole('button',{name:'Dodaj u posao'})).toBeVisible();
  const nav=page.getByRole('navigation',{name:width<=700?'Donja navigacija':'Glavna navigacija'});await expect(nav).toBeVisible();await expect(nav.getByRole('link',{name:'Poslovi',exact:true})).toHaveAttribute('aria-current','page');await page.getByLabel('Širina (mm)',{exact:true}).fill('1850');
  await page.getByRole('button',{name:'Dodatne opcije'}).click();await page.locator('.options-section>summary').filter({hasText:'Napomena'}).click();await page.getByLabel('Napomena',{exact:true}).fill('Nacrt sačuvan pri navigaciji.');await page.getByRole('button',{name:'Antracit',exact:true}).click();await page.getByRole('button',{name:'Gotovo',exact:true}).click();
  await (await globalLink(page,'Poslovi')).click();await page.locator('.resume-strip').getByRole('link',{name:/Nastavi merenje/}).click();await expect(page.getByLabel('Širina (mm)',{exact:true})).toHaveValue('1850');
  await page.getByRole('button',{name:'Dodatne opcije'}).click();await expect(page.getByLabel('Napomena',{exact:true})).toHaveValue('Nacrt sačuvan pri navigaciji.');await expect(page.getByRole('button',{name:'Antracit',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'Gotovo',exact:true}).click();
  await page.getByRole('link',{name:'Nazad',exact:true}).click();await page.getByRole('link',{name:'Nazad',exact:true}).click();await expect(page.locator('.job-line')).toHaveCount(3);
 });
}
test('Katalog bez otvorenog posla traži samo naziv i direktno otvara konfigurator',async({page})=>{
 await page.goto('/katalog');await page.getByRole('button',{name:'Prozor',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Novi posao'});await expect(dialog.locator('input')).toHaveCount(1);await dialog.getByLabel('Naziv posla ili prezime kupca').fill('Katalog test');await dialog.getByRole('button',{name:'Započni merenje'}).click();await expect(page.getByLabel('Širina (mm)',{exact:true})).toHaveValue('1600');await expect(page.locator('.type-grid')).toHaveCount(0);
});
test('Novi posao, fotografija i mere se čuvaju pri izlasku u globalnu navigaciju',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Novi posao',exact:true}).click();await page.getByLabel('Naziv posla ili prezime kupca').fill('Novi nacrt');await page.getByRole('button',{name:'Započni merenje'}).click();await page.getByRole('link',{name:'Prozor',exact:true}).click();const draftUrl=page.url();
 await page.getByLabel('Širina (mm)',{exact:true}).fill('1920');await page.getByRole('button',{name:'Dodatne opcije'}).click();await page.locator('.options-section>summary').filter({hasText:'Fotografije'}).click();await page.locator('input[type=file]').setInputFiles('public/assets/house.jpg');await expect(page.locator('.field-photos img')).toHaveCount(1);
 await (await globalLink(page,'Katalog')).click();await page.locator('.resume-strip').getByRole('link',{name:/Nastavi merenje/}).click();expect(page.url()).toBe(draftUrl);await expect(page.getByLabel('Širina (mm)',{exact:true})).toHaveValue('1920');await page.getByRole('button',{name:'Dodatne opcije'}).click();await expect(page.locator('.field-photos img')).toHaveCount(1);
 const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('alu-tim-teren-v1')!).jobs.find((j:any)=>j.customer.name==='Novi nacrt'));expect(data.positions).toHaveLength(0);
});
test('Donja traka ostaje dostupna i u proširenom 2D prikazu i ne prekriva akcije',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(job+'/nov/prozor');const nav=page.getByRole('navigation',{name:'Donja navigacija'});await expect(nav).toBeVisible();const footer=await page.locator('.measurement-footer').boundingBox(),bar=await nav.boundingBox();expect(footer!.y+footer!.height).toBeLessThanOrEqual(bar!.y+1);
 await page.getByRole('button',{name:'Proširi prikaz',exact:true}).click();await expect(nav).toBeVisible();const expanded=await page.getByRole('dialog',{name:'Prošireni crtež'}).boundingBox();expect(expanded!.y+expanded!.height).toBeLessThanOrEqual(bar!.y+1);const modal=page.getByRole('dialog',{name:'Prošireni crtež'});await modal.getByLabel('Širina (mm)',{exact:true}).fill('1720');await modal.getByRole('button',{name:'Zatvori',exact:true}).click();await expect(nav).toBeVisible();await expect(page.getByLabel('Širina (mm)',{exact:true})).toHaveValue('1720');
});
test('Sidebar može da se proširi i skupi unutar konfiguratora',async({page})=>{
 await page.setViewportSize({width:1024,height:768});await page.goto(job+'/nov/prozor');await page.getByRole('button',{name:'Proširi navigaciju'}).click();await expect(page.getByRole('button',{name:'Skupi navigaciju'})).toBeVisible();expect(await page.getByLabel('Širina (mm)',{exact:true}).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBeTruthy();await page.getByRole('button',{name:'Skupi navigaciju'}).click();await expect(page.getByRole('button',{name:'Proširi navigaciju'})).toBeVisible();await expect(page.getByLabel('Širina (mm)',{exact:true})).toHaveValue('1600');
});
test('Podešavanja su podeljena i cenovnik se trajno čuva',async({page})=>{
 await page.goto('/podesavanja');await expect(page.locator('.settings-categories>a')).toHaveCount(5);await expect(page.getByRole('checkbox',{name:/Prikaži cene/})).toBeChecked();await page.getByRole('link',{name:/Cenovnik Cene profila/}).click();const field=page.getByLabel('PVC profil (€/m²)',{exact:true});await expect(field).toHaveValue('110');await field.fill('123');await expect(page.locator('.settings-save')).toContainText('Sačuvano lokalno');await page.reload();await expect(page.getByLabel('PVC profil (€/m²)',{exact:true})).toHaveValue('123');
});
test('Novi podrazumevani materijali i uslovi ne menjaju stare poslove',async({page})=>{
 await page.goto('/podesavanja/profili');const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('alu-tim-teren-v1')!).jobs);await page.getByLabel('Materijal',{exact:true}).selectOption('ALU');await page.getByLabel('Boja',{exact:true}).selectOption('Antracit');await page.goto('/podesavanja/dokumenti');await page.getByLabel('Važenje ponude',{exact:true}).fill('30 dana');await page.waitForTimeout(450);await page.goto('/');await page.getByRole('button',{name:'Novi posao',exact:true}).click();await page.getByLabel('Naziv posla ili prezime kupca').fill('Novi sa opcijama');await page.getByRole('button',{name:'Započni merenje'}).click();await page.getByRole('link',{name:'Prozor',exact:true}).click();await expect(page.getByRole('button',{name:'ALU',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'Dodatne opcije'}).click();await expect(page.getByRole('button',{name:'Antracit',exact:true})).toHaveAttribute('aria-pressed','true');await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('alu-tim-teren-v1')!).jobs[0].customer.name)).toBe('Novi sa opcijama');const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('alu-tim-teren-v1')!).jobs);expect(after.slice(1)).toEqual(before);expect(after[0].validity).toBe('30 dana');
});
for(const width of [390,768,1024,1280]){
 test(`Snimci preuređenih modula i dubokih ruta: ${width}`,async({page})=>{
  await page.setViewportSize({width,height:width===390?844:900});
  for(const [route,label] of [['/katalog','katalog'],['/poslovi','poslovi'],['/podesavanja','podesavanja'],['/cenovnik','cenovnik'],['/ponude','ponude'],['/podesavanja/profili','profili'],['/podesavanja/pdv','pdv'],['/podesavanja/dokumenti','dokumenti'],['/podesavanja/podaci','podaci'],[job,'posao'],[job+'/nov/prozor','merenje'],[job+'/ponuda','cena']]){
   await page.goto(route);await page.evaluate(()=>document.fonts.ready);await expect(page.locator('h1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();if(width<=700){const bar=await page.getByRole('navigation',{name:'Donja navigacija'}).boundingBox();const action=page.locator('.measurement-footer,.field-bottom-actions');if(await action.count()){const box=await action.boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(bar!.y+1);}}await page.screenshot({path:`test-results/navigation-${width}-${label}.png`,fullPage:true});
  }
 });
}
