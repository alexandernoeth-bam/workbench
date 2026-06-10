// WorkBench Service Worker v5.21.4 · Build 20260611-0430
const BUILD = '20260611-0430';
const IDB_NAME = 'WorkBenchDB';

// ── IDB öffnen (lesend) ──────────────────────────────
function swIdbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Notifications aus Queue senden ───────────────────
async function processNotifQueue() {
  let db;
  try { db = await swIdbOpen(); } catch(e) { return; }

  const now = Date.now();
  const tx    = db.transaction('notif-queue', 'readwrite');
  const store = tx.objectStore('notif-queue');

  const all = await new Promise(r => {
    const req = store.getAll();
    req.onsuccess = e => r(e.target.result || []);
    req.onerror   = () => r([]);
  });

  for (const item of all) {
    if (item.shown) continue;
    if (item.fireAt > now) continue;

    try {
      await self.registration.showNotification(item.title, {
        body:    item.body || '',
        icon:    './icon-192.svg',
        badge:   './icon-192.svg',
        tag:     item.id,
        vibrate: item.important ? [300, 100, 300, 100, 300] : [200, 100, 200],
        data:    { url: item.url || './' },
      });
      // Als gesendet markieren
      item.shown = true;
      store.put(item);
    } catch(e) {
      console.warn('[SW Notif]', e);
    }
  }
  db.close();
}

// ── Install + Activate ────────────────────────────────
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

// ── Notification-Click ────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || './';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const existing = cs.find(c => c.url.includes('workbench'));
      if (existing) { existing.focus(); return; }
      clients.openWindow(url);
    })
  );
});

// ── Message von App: CHECK_NOTIFICATIONS ─────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'CHECK_NOTIFICATIONS') {
    e.waitUntil(processNotifQueue());
  }
});

// ── Periodic Background Sync ──────────────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'wb-notifications') {
    e.waitUntil(processNotifQueue());
  }
});

// ── Fetch: Network-first, kein Cache ─────────────────
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
