import {test,expect,type Page} from '@playwright/test';

const route='/posao/AT-2026-012/nov/nacrtaj';
async function draft(page:Page){return page.evaluate(()=>{const match=location.pathname.match(/^\/posao\/([^/]+)\/(?:element\/([^/]+)|nov\/nacrtaj)/)!;return JSON.parse(sessionStorage.getItem(`alu-custom-draft-v1:${match[1]}:${match[2]||'new'}`)!);});}
async function dimension(page:Page,id:string){
 const close=page.getByRole('button',{name:'Zatvori meru',exact:true});if(await close.isVisible())await close.click();
 await page.locator(`.custom-canvas [data-dimension="${id}"]`).click();
}
async function shape(page:Page,name:string){
 const button=page.getByRole('button',{name,exact:true});if(!await button.isVisible())await page.getByRole('button',{name:'Početni oblici',exact:true}).click();await button.click();
}
async function drag(page:Page,from:{x:number;y:number},to:{x:number;y:number}){
 const screen=async(p:{x:number;y:number})=>page.locator('.custom-canvas').evaluate((el,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform((el as SVGSVGElement).getScreenCTM()!);return{x:q.x,y:q.y};},p);
 const a=await screen(from),b=await screen(to);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();
}

for(const width of [390,1024])test(`Zaključani pravci, prevlačenje i čuvanje: ${width}`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:900});await page.goto(route);await shape(page,'Višougaoni prozor');await page.getByRole('button',{name:'Uklopi ceo nacrt'}).click();
 await dimension(page,'e4');await page.getByRole('button',{name:'Zaključaj vodoravno',exact:true}).click();
 await expect(page.getByRole('button',{name:'Otključaj vodoravno',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Zaključaj uspravno',exact:true})).toBeDisabled();
 await expect(page.getByLabel('Dužina (mm)',{exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Zaključaj liniju',exact:true}).click();
 await dimension(page,'e0');await page.getByRole('button',{name:'Zaključaj uspravno',exact:true}).click();
 await expect(page.getByRole('button',{name:'Otključaj uspravno',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Poravnaj vodoravno',exact:true})).toBeDisabled();
 await expect(page.locator('.custom-canvas [data-axis-lock="horizontal"]')).toHaveCount(1);
 await expect(page.locator('.custom-canvas [data-axis-lock="vertical"]')).toHaveCount(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath(`pravac-${width}.png`)});
 await page.getByRole('button',{name:'Zatvori meru'}).click();
 const locked=(await draft(page)).customGeometry;
 await drag(page,{x:2400,y:1600},{x:2200,y:1450});
 expect((await draft(page)).customGeometry).toEqual(locked);
 await dimension(page,'e4');await page.getByRole('button',{name:'Otključaj liniju',exact:true}).click();
 await expect(page.getByRole('button',{name:'Otključaj vodoravno',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Zatvori meru'}).click();
 await drag(page,{x:2400,y:1600},{x:2200,y:1450});
 const moved=(await draft(page)).customGeometry;
 expect(moved.points[4].x).toBeCloseTo(2200,3);expect(moved.points[4].y).toBe(1600);expect(moved.points[0]).toEqual(locked.points[0]);
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect((await draft(page)).customGeometry.points).toEqual(locked.points);
 await page.getByRole('button',{name:'Redo',exact:true}).click();expect((await draft(page)).customGeometry).toEqual(moved);
 await page.reload();expect((await draft(page)).customGeometry).toEqual(moved);
 await page.getByRole('button',{name:'Sačuvaj',exact:true}).click();await expect(page).toHaveURL(/\/element\//);await page.reload();
 await expect(page.locator('.custom-canvas [data-axis-lock]')).toHaveCount(2);
 await dimension(page,'e4');await page.getByRole('button',{name:'Otključaj vodoravno',exact:true}).click();
 await expect(page.locator('.custom-canvas [data-axis-lock="horizontal"]')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Zaključaj vodoravno',exact:true})).toHaveAttribute('aria-pressed','false');
});

test('Zaključavanje kose stranice poravna je i čuva postojeću zaključanu meru',async({page})=>{
 await page.goto(route);await shape(page,'Višougaoni prozor');await dimension(page,'e1');
 await page.getByRole('button',{name:'Zaključaj liniju',exact:true}).click();const before=(await draft(page)).customGeometry;
 await page.getByRole('button',{name:'Zaključaj vodoravno',exact:true}).click();
 const next=(await draft(page)).customGeometry;expect(next.points[1].y).toBe(next.points[2].y);expect(next.edges[1].locked).toEqual(before.edges[1].locked);
 await expect(page.getByRole('button',{name:'Otključaj vodoravno',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Otključaj vodoravno',exact:true}).click();await expect(page.getByLabel('Dužina (mm)',{exact:true})).toBeDisabled();
});
