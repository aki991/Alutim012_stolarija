import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createHash } from 'node:crypto';
export default defineConfig({ plugins: [react(), tailwindcss(),{
 name:'alu-offline-cache',apply:'build',enforce:'post',generateBundle(_,bundle){
  const urls=[...new Set(['/index.html','/assets/reference.png','/assets/reference-phone.png','/assets/house.jpg','/assets/arial.ttf','/assets/arial-bold.ttf','/assets/arial-narrow.ttf','/assets/arial-narrow-bold.ttf','/assets/arial-narrow-bold-italic.ttf',...Object.keys(bundle).map(x=>'/'+x)])];
  const cache='alu-teren-'+createHash('sha256').update(JSON.stringify(urls)).digest('hex').slice(0,12);
  this.emitFile({type:'asset',fileName:'sw.js',source:`const CACHE=${JSON.stringify(cache)},URLS=${JSON.stringify(urls)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(URLS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('alu-teren-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.open(CACHE).then(c=>c.match('/index.html'))));return;}e.respondWith(caches.open(CACHE).then(c=>c.match(e.request,{ignoreVary:true})).then(c=>c||fetch(e.request)));});`});
 } }], server: { host:'0.0.0.0', port: 5187, strictPort: true }, preview:{port:4187,strictPort:true},build:{rollupOptions:{output:{manualChunks:{'react-vendor':['react','react-dom','react-router-dom'],'pdf-render':['react-dom/server']}}}} });
