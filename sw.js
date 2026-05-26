// WorkBench Service Worker v3.23.1 · Build 20260526-0829
// Beim Aktivieren sofort alle Clients zur Aktualisierung zwingen

const BUILD = '20260526-0829';

self.addEventListener('install', e => {
  self.skipWaiting(); // sofort installieren
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => {
        // Alle offenen Clients zur Aktualisierung zwingen
        return self.clients.matchAll({ type: 'window' });
      })
      .then(clients => {
        clients.forEach(client => {
          // Client sagen: bitte neu laden
          client.postMessage({ type: 'SW_UPDATED', build: BUILD });
        });
      })
  );
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
