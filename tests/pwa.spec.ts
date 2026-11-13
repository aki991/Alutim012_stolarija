import {mkdtempSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {test,expect,chromium} from '@playwright/test';
test('PWA manifest, stvarne ikone i Service Worker sa offline PDF-om',async({page,context})=>{
 await page.goto('http://127.0.0.1:4187/');await expect(page.locator('link[rel=manifest]')).toHaveAttribute('href','/manifest.json');const manifest=await(await page.request.get('http://127.0.0.1:4187/manifest.json')).json();expect(manifest.name).toBe('ALU TIM 012');expect(manifest.short_name).toBe('ALU TIM 012');expect(manifest.start_url).toBe('/');expect(manifest.display).toBe('standalone');expect(manifest.scope).toBe('/');
 for(const size of [192,512]){const icon=manifest.icons.find((i:any)=>i.sizes===`${size}x${size}`&&i.purpose==='any');expect(icon.src).toBe(`/icons/alu-tim-${size}.png`);expect(await page.evaluate(async(src)=>{const image=new Image();image.src=src;await image.decode();return[image.naturalWidth,image.naturalHeight];},icon.src)).toEqual([size,size]);}
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:'Brza ponuda na terenu',exact:true})).toBeVisible();await page.goto('http://127.0.0.1:4187/posao/AT-2026-012/ponuda');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Ponuda za kupca',exact:true}).click();await page.getByRole('button',{name:'Preuzmi PDF',exact:true}).click();await page.getByRole('dialog',{name:/Pregled:/}).getByRole('button',{name:'Zatvori'}).click();expect((await download).suggestedFilename()).toBe('AT-2026-012-ponuda.pdf');const iconResponse=await page.evaluate(async()=>{const r=await fetch('/icons/alu-tim-maskable-512.png');return r.ok;});expect(iconResponse).toBe(true);await context.setOffline(false);
});
test('Google Chrome ne prijavljuje greške za PWA instalaciju',async()=>{
 const profile=mkdtempSync(path.resolve('test-results/chrome-pwa-'));const browser=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true});try{const page=await browser.newPage();await page.goto('http://127.0.0.1:4187/');await page.evaluate(()=>navigator.serviceWorker.ready);const cdp=await page.context().newCDPSession(page);await cdp.send('Page.enable');const result=await cdp.send('Page.getAppManifest');expect(result.errors).toEqual([]);await expect.poll(async()=>(await cdp.send('Page.getInstallabilityErrors')).installabilityErrors,{timeout:15000}).toEqual([]);await page.goto('http://127.0.0.1:5187/');expect((await cdp.send('Page.getAppManifest')).errors).toEqual([]);await expect.poll(async()=>(await cdp.send('Page.getInstallabilityErrors')).installabilityErrors,{timeout:15000}).toEqual([]);}finally{await browser.close();}
});

test('Chrome preuzima novi deploy dok je stari tab otvoren i zadržava offline pristup', async () => {
 const preview = 'http://127.0.0.1:4187';
 let release = 1;
 const server = createServer(async (request, response) => {
  const version = release;
  try {
   const upstream = await fetch(new URL(request.url!, preview));
   const mime = upstream.headers.get('content-type') ?? '';
   let body: string | Buffer;
   if (mime.startsWith('text/html')) {
    body = (await upstream.text()).replace('</head>', `<meta name="test-release" content="${version}"></head>`);
   } else if (new URL(request.url!, preview).pathname === '/sw.js') {
    body = `${await upstream.text()}\n// Test release ${version}`;
   } else {
    body = Buffer.from(await upstream.arrayBuffer());
   }
   response.writeHead(upstream.status, { 'content-type': mime, 'cache-control': 'no-cache' }).end(body);
  } catch { response.writeHead(502).end(); }
 });
 await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
 const address = server.address();
 if (!address || typeof address === 'string') throw new Error('Test server address unavailable');
 const origin = `http://127.0.0.1:${address.port}`;
 const browser = await chromium.launch({ channel: 'chrome' });
 try {
  const context = await browser.newContext();
  const oldTab = await context.newPage();
  await oldTab.goto(origin);
  await expect.poll(() => oldTab.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const version = (page: typeof oldTab) => page.locator('meta[name="test-release"]');
  await expect(version(oldTab)).toHaveAttribute('content', '1');

  release = 2;
  await oldTab.evaluate(async () => { await (await navigator.serviceWorker.ready).update(); });
  const update = oldTab.getByRole('button', { name: 'Ažuriraj', exact: true });
  await expect(update).toBeVisible();
  await expect(version(oldTab)).toHaveAttribute('content', '1');

  const newTab = await context.newPage();
  await newTab.goto(origin);
  await expect(version(newTab)).toHaveAttribute('content', '2');
  await update.click();
  await expect(version(oldTab)).toHaveAttribute('content', '2');
  await context.setOffline(true);
  await oldTab.goto(`${origin}/posao/AT-2026-012`);
  await expect(oldTab.getByRole('heading', { name: /Porodica Petrović/ })).toBeVisible();
 } finally {
  await browser.close();
  await new Promise<void>(resolve => server.close(() => resolve()));
 }
});
