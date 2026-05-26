// WorkBench Service Worker v3.23.0 — Minimal, kein aggressives Caching
const CACHE = 'wb-v3230';

self.addEventListener('install', () => {
  self.skipWaiting(); // sofort aktivieren
});

self.addEventListener('activate', e => {
  // alle alten Caches löschen
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Kein fetch-Handler = Browser holt immer frisch vom Server
// Service Worker nur für PWA-Installierbarkeit nötig
