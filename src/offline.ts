// Production cache includes the app, PDF chunks, fonts and illustration assets.
// Development deliberately avoids caching Vite's hot-reload modules.
if(import.meta.env.PROD&&'serviceWorker' in navigator){
 window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{/* Local editing remains available; offline reload requires HTTPS or localhost. */});});
}
