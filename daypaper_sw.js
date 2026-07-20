// DayPaper Service Worker
// Achtung: dieser SW ist nur für DayPaper.
// Wenn du bereits einen SW für WorkAssist/SmallAssist hast,
// ergänze dort die DayPaper-Assets statt diese Datei zu verwenden.
const CACHE_NAME = 'daypaper-v0.1.7';
const ASSETS = [
  './daypaper.html',
  './daypaper_manifest.json',
  './icons/icon-daypaper-192.png',
  './icons/icon-daypaper-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // Fonts: Network-first
  if (event.request.url.includes('fonts.googleapis.com') || event.request.url.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request).then(r => {
        const c = r.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, c));
        return r;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  // Eigene Assets: Cache-first
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
