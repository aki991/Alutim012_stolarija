self.addEventListener('push', event => {
 let notice;
 try { notice = event.data?.json(); } catch { /* Use the generic notification for unexpected payloads. */ }
 event.waitUntil(self.registration.showNotification(notice?.title || 'ALU TIM 012', {
  body: notice?.body || 'Imate novo obaveštenje.',
  icon: '/icons/alu-tim-192.png',
  tag: notice?.tag,
  data: { path: notice?.path },
 }));
});

self.addEventListener('notificationclick', event => {
 event.notification.close();
 const path = event.notification.data?.path;
 const target = new URL(typeof path === 'string' && /^\/(obavestenja|poruke(?:\/AT-[\w-]+)?)$/.test(path) ? path : '/obavestenja', self.location.origin);
 event.waitUntil((async () => {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const matching = windows.find(client => client.url === target.href);
  if (matching) await matching.focus();
  else await self.clients.openWindow(target.href);
 })());
});
