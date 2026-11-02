// The production build precaches the app, PDF chunks, fonts, manifest and icons.
// Keep Vite's development modules uncached and never reload an active form for an update.
if(import.meta.env.PROD&&'serviceWorker' in navigator){
 const register=()=>navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(error=>console.warn('Offline režim nije dostupan:',error));
 if(document.readyState==='complete')void register();else window.addEventListener('load',register,{once:true});
}
