// WorkBench Service Worker v3.23.1
// Minimal — nur PWA + Notifications, kein Caching

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Notification-Click: App öffnen
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Offenen Tab fokussieren
        for (const c of clientList) {
          if (c.url.includes('workbench') && 'focus' in c) return c.focus();
        }
        // Neuen Tab öffnen
        if (clients.openWindow) return clients.openWindow('./workbench.html');
      })
  );
});
