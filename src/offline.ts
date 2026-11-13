const listeners = new Set<() => void>();
let registration: ServiceWorkerRegistration | undefined;
let updateReady = false;
let reloadOnActivation = false;

export const hasAppUpdate = () => updateReady;
export function subscribeToAppUpdate(listener: () => void) {
 listeners.add(listener);
 return () => { listeners.delete(listener); };
}

function announceUpdate() {
 if (updateReady) return;
 updateReady = true;
 listeners.forEach(listener => listener());
}

export function applyAppUpdate() {
 if (reloadOnActivation) return;
 const waiting = registration?.waiting;
 if (waiting) {
  reloadOnActivation = true;
  waiting.postMessage({ type: 'SKIP_WAITING' });
 } else {
  window.location.reload();
 }
}

async function register() {
 const workers = navigator.serviceWorker;
 try {
  const registered = await workers.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  registration = registered;
  const checkWaiting = () => { if (registered.active && registered.waiting) announceUpdate(); };
  const watchInstalling = () => {
   const worker = registered.installing;
   worker?.addEventListener('statechange', () => {
    if (worker.state === 'installed' && registered.active) announceUpdate();
   });
   checkWaiting();
  };
  registered.addEventListener('updatefound', watchInstalling);
  watchInstalling();
  workers.addEventListener('controllerchange', () => {
   if (reloadOnActivation) window.location.reload();
  });

  let checking = false;
  const checkForUpdate = async () => {
   if (checking || !navigator.onLine || document.visibilityState !== 'visible') return;
   checking = true;
   try { await registered.update(); }
   catch { /* The next online or visible check will retry. */ }
   finally { checking = false; }
  };
  window.addEventListener('online', checkForUpdate);
  document.addEventListener('visibilitychange', checkForUpdate);
  window.setInterval(checkForUpdate, 5 * 60_000);
  void checkForUpdate();
 } catch (error) {
  console.warn('Offline režim nije dostupan:', error);
 }
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
 if (document.readyState === 'complete') void register();
 else window.addEventListener('load', register, { once: true });
}
