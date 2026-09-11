/* ============================================================
   Service Worker der Workbench

   Grundsatz: erst das Netz, dann der Vorrat. Eine neue Fassung
   erreicht das Gerät damit beim nächsten Start von selbst — das
   Deinstallieren entfällt. Der Vorrat springt nur ein, wenn keine
   Verbindung besteht.
   ============================================================ */

'use strict';

/* Der Vorratsname wandert mit: Ein neuer Name wirft beim Aktivieren
   den alten Vorrat weg — sonst hielte er die alten Symbole fest. */
var VORRAT = 'workbench-vorrat-3';
var GRUNDLAGE = [
  './workbench.html',
  './manifest.webmanifest',
  './icon-192-v2.png',
  './icon-512-v2.png',
  './icon-512-maskierbar-v2.png'
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
        if (n === VORRAT || n === VORAUS_SCHLUESSEL) { return null; }
        return caches.delete(n);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('message', function (ereignis) {
  if (ereignis && ereignis.data === 'sofort-uebernehmen') { self.skipWaiting(); }
});

/* ------------------------------------------------------------
   Die Zahl am App-Symbol bei geschlossener App

   Der Service Worker kennt den Bestand nicht — er liest deshalb die
   Vorausschau, die die App bei jedem Lauf ablegt: je Tag die Zahl der
   offenen Dinge. Wann er laufen darf, entscheidet der Browser.
   ------------------------------------------------------------ */
var VORAUS_SCHLUESSEL = 'workbench-voraus';

function heuteIso() {
  var d = new Date();
  var zwei = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + zwei(d.getMonth() + 1) + '-' + zwei(d.getDate());
}

/* localStorage ist im Service Worker nicht erreichbar, deshalb liegt
   die Vorausschau zusätzlich im Vorrat — als abgelegte Antwort. */
function vorausLesen() {
  return caches.open(VORAUS_SCHLUESSEL).then(function (vorrat) {
    return vorrat.match('voraus');
  }).then(function (antwort) {
    if (!antwort) { return null; }
    return antwort.json();
  }).catch(function () {
    return null;
  });
}

function badgeNachziehen() {
  if (!self.navigator || typeof self.navigator.setAppBadge !== 'function') {
    return Promise.resolve(false);
  }
  return vorausLesen().then(function (voraus) {
    if (!voraus || !voraus.tage) { return false; }
    var n = voraus.tage[heuteIso()];
    if (typeof n !== 'number') { return false; }
    if (n > 0) { self.navigator.setAppBadge(n); }
    else if (typeof self.navigator.clearAppBadge === 'function') {
      self.navigator.clearAppBadge();
    }
    return true;
  }).catch(function () {
    return false;
  });
}

self.addEventListener('periodicsync', function (ereignis) {
  if (ereignis.tag !== 'badge') { return; }
  ereignis.waitUntil(badgeNachziehen());
});

self.addEventListener('activate', function (ereignis) {
  ereignis.waitUntil(badgeNachziehen());
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
