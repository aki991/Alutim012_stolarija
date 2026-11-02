import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
 plugins:[react(),tailwindcss(),VitePWA({
  // A single static manifest also works while using the development server.
  manifest:false,injectRegister:false,registerType:'prompt',
  includeAssets:['manifest.json','icons/*.png','icons/*.svg'],
  workbox:{
   globPatterns:['**/*.{js,css,html,png,jpg,ttf,svg,json}'],
   maximumFileSizeToCacheInBytes:4*1024*1024,
   navigateFallback:'/index.html',cleanupOutdatedCaches:true,
   clientsClaim:true,skipWaiting:false,
  },
 })],
 server:{host:'0.0.0.0',port:5187,strictPort:true},
 preview:{port:4187,strictPort:true},
 build:{rollupOptions:{output:{manualChunks:{'react-vendor':['react','react-dom','react-router-dom'],'pdf-render':['react-dom/server']}}}},
});
