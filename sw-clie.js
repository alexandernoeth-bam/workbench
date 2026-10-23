/* ============================================================
   Service Worker von CLIE

   Wie bei der Workbench: erst das Netz, dann der Vorrat. Eine neue
   Fassung kommt beim nächsten Start von selbst an.

   Eigener Bereich (./clie…) und eigener Vorrat: Liegt CLIE
   neben der Workbench, bleibt deren Service Worker
   unberührt — aufgeräumt werden nur Vorräte, die mit „clie-"
   beginnen.
   ============================================================ */

'use strict';

var VORRAT = 'clie-vorrat-2';   /* 2: neues App-Symbol (CLIE 0.47.3) */
var PRAEFIX = 'clie-';
var GRUNDLAGE = [
  './clie.html',
  './clie.webmanifest',
  './clie-192.png',
  './clie-512.png',
  './clie-512-maskierbar.png'
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
        if (n.indexOf(PRAEFIX) !== 0 || n === VORRAT) { return null; }
        return caches.delete(n);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (ereignis) {
  var anfrage = ereignis.request;
  if (anfrage.method !== 'GET') { return; }
  var adresse;
  try { adresse = new URL(anfrage.url); } catch (e) { return; }
  /* Fremde Adressen — Google-Anmeldung, Drive, Schriften — nie aus dem Vorrat. */
  if (adresse.origin !== self.location.origin) { return; }

  ereignis.respondWith(
    fetch(anfrage).then(function (antwort) {
      if (antwort && antwort.status === 200 && antwort.type === 'basic') {
        var abschrift = antwort.clone();
        caches.open(VORRAT).then(function (vorrat) { vorrat.put(anfrage, abschrift); });
      }
      return antwort;
    }).catch(function () {
      return caches.match(anfrage).then(function (gefunden) {
        if (gefunden) { return gefunden; }
        return caches.match('./clie.html');
      });
    })
  );
});
