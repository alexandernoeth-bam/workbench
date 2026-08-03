// ═══════════════════════════════════════════════════════════════════════════
//  Service Worker für die Werkbank                                     v3
//  Gemeinsam genutzt von workassist.html, smallassist.html und
//  planviewer.html – alle drei liegen im selben Verzeichnis, ein Worker
//  mit dem Scope dieses Verzeichnisses deckt sie ab.
//
//  Warum die frühere Fassung nicht funktionierte:
//  1. Sie wurde als Blob registriert. Ein Blob-Worker darf keinen Scope
//     außerhalb seiner eigenen blob:-Adresse beanspruchen – die
//     Registrierung schlug still fehl.
//  2. Sie lieferte aus dem Cache zuerst. Nach einem Update lief dadurch
//     tagelang eine veraltete Fassung weiter.
//  3. Ein Zweig konnte undefined zurückgeben, was zu
//     "Failed to convert value to 'Response'" führte.
//
//  Diese Fassung: Netz zuerst, Cache nur als Rückfall, und jeder Zweig
//  liefert garantiert eine echte Response.
// ═══════════════════════════════════════════════════════════════════════════

const CACHE = 'werkbank-v3';

self.addEventListener('install', () => {
  // Nichts vorab laden – der Cache füllt sich beim ersten erfolgreichen Abruf.
  // Ein addAll() würde die Installation scheitern lassen, sobald eine einzige
  // Datei fehlt, und dann greift gar kein Worker.
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

// Erlaubt jeder der drei Apps, den Cache gezielt zu leeren
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'CACHE_LEEREN') {
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => { if (e.source) e.source.postMessage({ type: 'CACHE_GELEERT' }); })
      .catch(() => {});
  }
});
