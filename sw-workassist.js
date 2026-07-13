// WorkAssist Service Worker v1.5.129 · Build 20260713
const BUILD      = '20260713-1';
const CACHE_NAME = 'workassist-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        // Nur WorkAssist-Caches löschen, Backlog-Caches unberührt lassen
        keys.filter(k => k.startsWith('workassist-')).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => {
        clients.forEach(c => c.postMessage({ type: 'SW_UPDATED', build: BUILD }));
      })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/workbench/workassist.html'));
});

// Network-first, kein Cache (Backlog.json soll immer aktuell sein)
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
