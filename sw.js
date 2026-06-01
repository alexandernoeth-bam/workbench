// WorkBench Service Worker v3.71.0 · Build 20260601-1945
const BUILD = '20260601-1945';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => {
        clients.forEach(c => c.postMessage({ type: 'SW_UPDATED', build: BUILD }));
      })
  );
});

// Share Target: POST mit Bild
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (e.request.method === 'POST' && url.pathname.includes('workbench.html')) {
    e.respondWith((async () => {
      try {
        const formData  = await e.request.formData();
        const image     = formData.get('share_image');
        const title     = formData.get('share_title') || '';
        const text      = formData.get('share_text')  || '';
        const shareUrl  = formData.get('share_url')   || '';

        let imageData = null;
        if (image && image instanceof File && image.size > 0) {
          const ab  = await image.arrayBuffer();
          const u8  = new Uint8Array(ab);
          let bin   = '';
          u8.forEach(b => bin += String.fromCharCode(b));
          imageData = 'data:' + image.type + ';base64,' + btoa(bin);
        }

        // An alle offenen Clients schicken
        const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of allClients) {
          client.postMessage({ type: 'SHARE_TARGET', title, text, url: shareUrl, imageData });
        }
      } catch(err) {
        console.error('[SW Share]', err);
      }

      return Response.redirect('/workbench/workbench.html', 303);
    })());
    return;
  }
});

// Notification-Click: App öffnen
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const c of clientList) {
          if (c.url.includes('workbench') && 'focus' in c) return c.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow('./workbench.html');
      })
  );
});
