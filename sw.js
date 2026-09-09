/* ============================================================
   Service Worker der Workbench

   Grundsatz: erst das Netz, dann der Vorrat. Eine neue Fassung
   erreicht das Gerät damit beim nächsten Start von selbst — das
   Deinstallieren entfällt. Der Vorrat springt nur ein, wenn keine
   Verbindung besteht.
   ============================================================ */

'use strict';

var VORRAT = 'workbench-vorrat-2';
var GRUNDLAGE = [
  './workbench.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (ereignis) {
  self.skipWaiting();
  ereignis.waitUntil(
    caches.open(VORRAT).then(function (vorrat) {
      return vorrat.addAll(GRUNDLAGE).catch(function () { return null; });
    })
  );
});

self.addEventListener('activate', function (ereignis) {
  ereignis.waitUntil(
    caches.keys().then(function (namen) {
      return Promise.all(namen.map(function (n) {
        return (n === VORRAT) ? null : caches.delete(n);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('message', function (ereignis) {
  if (ereignis && ereignis.data === 'sofort-uebernehmen') { self.skipWaiting(); }
});

self.addEventListener('fetch', function (ereignis) {
  var anfrage = ereignis.request;
  if (anfrage.method !== 'GET') { return; }

  var adresse;
  try { adresse = new URL(anfrage.url); } catch (e) { return; }

  /* Fremde Adressen bleiben unangetastet: Google-Anmeldung, Drive und
     Schriften dürfen nie aus einem Vorrat bedient werden. */
  if (adresse.origin !== self.location.origin) { return; }

  ereignis.respondWith(
    fetch(anfrage).then(function (antwort) {
      if (antwort && antwort.status === 200 && antwort.type === 'basic') {
        var abschrift = antwort.clone();
        caches.open(VORRAT).then(function (vorrat) {
          vorrat.put(anfrage, abschrift);
        });
      }
      return antwort;
    }).catch(function () {
      return caches.match(anfrage).then(function (gefunden) {
        if (gefunden) { return gefunden; }
        return caches.match('./workbench.html');
      });
    })
  );
});
