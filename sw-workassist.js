// ═══════════════════════════════════════════════════════════════════════════
//  Service Worker für WorkAssist                                    v1.5.260
//
//  Wichtig gegenüber der alten Fassung:
//  1. NETZ ZUERST. Die alte Fassung lieferte zuerst aus dem Cache – dadurch
//     konnte nach einem Update tagelang eine veraltete workassist.html laufen.
//  2. Jeder Zweig liefert eine echte Response. Die alte Fassung konnte
//     undefined zurückgeben, was zu
//     "Failed to convert value to 'Response'" führte.
//  3. Nur GET und nur eigene Herkunft werden angefasst.
//
//  Diese Datei gehört neben die workassist.html auf GitHub Pages.
// ═══════════════════════════════════════════════════════════════════════════

const CACHE = 'wa-v1_5_260';

self.addEventListener('install', () => {
  // Nichts vorab laden – der Cache füllt sich beim ersten erfolgreichen Abruf
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;   // CDN und Fremdes durchlassen

  e.respondWith(
    fetch(req)
      .then(res => {
        // Erfolgreiche Antworten für den Offline-Fall ablegen
        if (res && res.ok && res.type === 'basic') {
          const kopie = res.clone();
          caches.open(CACHE).then(c => c.put(req, kopie)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(treffer =>
          // Ohne Treffer eine echte Response liefern, niemals undefined
          treffer || new Response('Offline und nicht im Cache', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          })
        )
      )
  );
});

// Erlaubt der Seite, den Cache gezielt zu leeren
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'CACHE_LEEREN') {
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => { if (e.source) e.source.postMessage({ type: 'CACHE_GELEERT' }); })
      .catch(() => {});
  }
});
