/* ============================================================
   Service Worker des Schreibtischs

   Wie bei CLIE und der Workbench: erst das Netz, dann der Vorrat. Eine
   neue Fassung kommt beim nächsten Start von selbst an.

   Eigener Vorrat mit eigenem Präfix: Liegt der Schreibtisch neben CLIE
   oder der Workbench auf demselben Webspace, bleiben deren Vorräte
   unberührt — aufgeräumt wird nur, was mit „schreibtisch-" beginnt.

   Der Vorrat trägt die Fassung im Namen. Damit bekommt jede neue
   Fassung einen neuen Vorrat, und der alte wird beim Aktivieren
   weggeräumt — ohne dass man eine Zahl von Hand hochzählen muss.
   ============================================================ */

'use strict';

var FASSUNG = '0.6.0';
var VORRAT = 'schreibtisch-vorrat-' + FASSUNG;
var PRAEFIX = 'schreibtisch-';
var GRUNDLAGE = [
  './schreibtisch.html',
  './schreibtisch.webmanifest',
  './schreibtisch-192.png',
  './schreibtisch-512.png',
  './schreibtisch-512-maskierbar.png'
];

self.addEventListener('install', function (ereignis) {
  self.skipWaiting();
  ereignis.waitUntil(
    caches.open(VORRAT).then(function (vorrat) {
      return vorrat.addAll(GRUNDLAGE).catch(function () { return null; });
    })
  );
});

/* „Jetzt laden“ in der App: eine wartende Fassung sofort übernehmen. */
self.addEventListener('message', function (ereignis) {
  if (ereignis.data === 'sofort-uebernehmen') { self.skipWaiting(); }
});

self.addEventListener('activate', function (ereignis) {
  ereignis.waitUntil(
    caches.keys().then(function (namen) {
      return Promise.all(namen.map(function (n) {
        if (n.indexOf(PRAEFIX) === 0 && n !== VORRAT) { return caches.delete(n); }
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (ereignis) {
  var anfrage = ereignis.request;
  if (anfrage.method !== 'GET') { return; }
  /* Google und Drive gehen nie in den Vorrat: Eine zwischengespeicherte
     Antwort auf eine Anmeldung oder einen Abgleich wäre falsch. */
  if (anfrage.url.indexOf('googleapis.com') >= 0
      || anfrage.url.indexOf('accounts.google.com') >= 0) { return; }

  ereignis.respondWith(
    fetch(anfrage).then(function (antwort) {
      if (antwort && antwort.ok && anfrage.url.indexOf('http') === 0) {
        var kopie = antwort.clone();
        caches.open(VORRAT).then(function (v) { v.put(anfrage, kopie); }).catch(function () { return null; });
      }
      return antwort;
    }).catch(function () {
      return caches.match(anfrage).then(function (treffer) {
        if (treffer) { return treffer; }
        /* Beim Aufruf der Seite selbst: lieber die gespeicherte Fassung
           als eine Fehlerseite. */
        if (anfrage.mode === 'navigate') { return caches.match('./schreibtisch.html'); }
        return Response.error();
      });
    })
  );
});
