// WorkBench Service Worker v3.71.8 · Build 20260601-2300
const BUILD = '20260601-2300';

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
