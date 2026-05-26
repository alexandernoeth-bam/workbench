// WorkBench Service Worker v3.22.3
// Network-first Strategie: immer zuerst vom Server laden
const CACHE = 'workbench-v3223';

self.addEventListener('install', e => {
  // Sofort aktivieren ohne auf alte Clients zu warten
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Alle alten Caches löschen
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Nur eigene Requests behandeln
  if (!e.request.url.startsWith(self.location.origin)) return;
  
  // Network-first: immer zuerst vom Server
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Erfolgreiche Antwort cachen
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        // Nur bei Netzwerkfehler aus Cache laden (Offline)
        caches.match(e.request)
      )
  );
});
