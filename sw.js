// WorkBench Service Worker v3.71.4 · Build 20260601-2130
const BUILD = '20260601-2130';

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
        const formData = await e.request.formData();
        const image    = formData.get('share_image');
        const title    = formData.get('share_title') || '';
        const text     = formData.get('share_text')  || '';
        const shareUrl = formData.get('share_url')   || '';

        let imageData = null;
        if (image && image instanceof File && image.size > 0) {
          const ab = await image.arrayBuffer();
          const u8 = new Uint8Array(ab);
          let bin  = '';
          const CHUNK = 8192;
          for (let i = 0; i < u8.length; i += CHUNK) {
            bin += String.fromCharCode(...u8.slice(i, i + CHUNK));
          }
          imageData = 'data:' + image.type + ';base64,' + btoa(bin);
        }

        // In Cache speichern
        const cache = await caches.open('wb-share-v1');
        const payload = JSON.stringify({ title, text, url: shareUrl, imageData, ts: Date.now() });
        await cache.put('/__share_data__', new Response(payload, {
          headers: { 'Content-Type': 'application/json' }
        }));

      } catch(err) {
        console.error('[SW Share Error]', err);
      }

      return Response.redirect('/workbench/workbench.html?wb_share=1', 303);
    })());
    return;
  }
});

// Notification-Click
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
