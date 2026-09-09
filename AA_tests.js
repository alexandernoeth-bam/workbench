/* ============================================================
   AA_tests.js — Regressionstests für Workbench
   Aufruf:  node AA_tests.js [pfad/zur/workbench.html]
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const DATEI = process.argv[2] || path.join(__dirname, 'workbench.html');

if (!fs.existsSync(DATEI)) {
  console.log('FEHLER: Datei nicht gefunden: ' + DATEI);
  process.exit(1);
}

const QUELLE = fs.readFileSync(DATEI, 'utf8');

let anzOk = 0, anzFail = 0, anzWarn = 0;

function ok(text)   { console.log('  ok   ' + text); anzOk++; }
function fail(text) { console.log('  FAIL ' + text); anzFail++; }
function warn(text) { console.log('  warn ' + text); anzWarn++; }
function pruefe(bedingung, text) { if (bedingung) { ok(text); } else { fail(text); } }

function skriptBloecke() {
  const treffer = QUELLE.match(/<script>[\s\S]*?<\/script>/g) || [];
  return treffer.map(b => b.replace(/^<script>/, '').replace(/<\/script>$/, ''));
}

function hauptSkript() {
  const bloecke = skriptBloecke();
  return bloecke.length ? bloecke[bloecke.length - 1] : '';
}

/* ============================================================
   1. Struktur: Bildschirme und Navigation
   ============================================================ */
console.log('\n1. Bildschirme und Navigation');
{
  const schirme = [...QUELLE.matchAll(/id="schirm([A-Za-zÄÖÜäöü]+)"/g)].map(m => m[1]);
  const navs    = [...QUELLE.matchAll(/id="nav([A-Za-zÄÖÜäöü]+)"/g)].map(m => m[1]);

  pruefe(schirme.length > 0, 'mindestens ein Bildschirm vorhanden (' + schirme.length + ')');

  schirme.forEach(function (s) {
    pruefe(navs.indexOf(s) >= 0, 'Bildschirm "' + s + '" hat einen Navigationsknopf');
  });
  navs.forEach(function (n) {
    pruefe(schirme.indexOf(n) >= 0, 'Navigationsknopf "' + n + '" hat einen Bildschirm');
  });

  const liste = hauptSkript().match(/var alle = \[([^\]]*)\]/);
  if (liste) {
    const genannt = [...liste[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
    schirme.forEach(function (s) {
      pruefe(genannt.indexOf(s) >= 0, 'Bildschirm "' + s + '" steht in der Umschaltliste');
    });
  } else {
    warn('Umschaltliste in zeigeSchirm nicht gefunden');
  }

  pruefe(/\.schirm\{display:none !important/.test(QUELLE),
         '.schirm ist mit !important ausgeblendet');
  pruefe(/\.schirm\.aktiv\{display:flex !important/.test(QUELLE),
         '.schirm.aktiv ist mit !important eingeblendet');
}

/* ============================================================
   2. Kritische Funktionen
   ============================================================ */
console.log('\n2. Kritische Funktionen');
{
  const pflicht = [
    'leereDatenbank', 'isoDatum', 'isoZeit',
    'idbOeffnen', 'idbSchreiben', 'idbLesen', 'idbLoeschen',
    'rechtePruefen', 'rechteAnfragen',
    'dateiSchreiben', 'dateiLesen',
    'opfsSchreiben', 'opfsLesen',
    'localSchreiben', 'localLesen',
    'speichern', 'laden', 'uebernehmen', 'alsText',
    'dateiWaehlen', 'dateiAnlegen', 'zugriffErlauben', 'handleVergessen',
    'zeigeSchirm', 'zeichne', 'starten'
  ];
  const skript = hauptSkript();
  pflicht.forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });
}

/* ============================================================
   3. Keine doppelten Funktionen
   ============================================================ */
console.log('\n3. Doppelte Funktionen');
{
  const skript = hauptSkript();
  const namen = [...skript.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]);
  const zaehl = {};
  namen.forEach(n => { zaehl[n] = (zaehl[n] || 0) + 1; });
  const doppelt = Object.keys(zaehl).filter(n => zaehl[n] > 1);
  pruefe(doppelt.length === 0,
         'keine doppelt definierten Funktionen' + (doppelt.length ? ' — gefunden: ' + doppelt.join(', ') : ''));
}

/* ============================================================
   4. Aufrufe undefinierter Funktionen
   ============================================================ */
console.log('\n4. Aufrufe im HTML');
{
  const skript = hauptSkript();
  const definiert = new Set([...skript.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]));
  const aufgerufen = new Set(
    [...QUELLE.matchAll(/on(?:click|input|change|scroll)="([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1])
  );
  aufgerufen.forEach(function (f) {
    pruefe(definiert.has(f), 'im HTML aufgerufene Funktion ' + f + ' ist definiert');
  });
}

/* ============================================================
   5. IDs: im Skript angesprochen, im HTML vorhanden
   ============================================================ */
console.log('\n5. Element-IDs');
{
  const skript = hauptSkript();
  const imHtml = new Set([...QUELLE.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  /* Zur Laufzeit erzeugte Elemente stehen naturgemäß nicht im HTML. */
  const erzeugt = new Set([...skript.matchAll(/\.id\s*=\s*'([A-Za-z][\w-]*)'/g)].map(m => m[1]));
  const feste = new Set([...skript.matchAll(/getElementById\('([A-Za-z][\w-]*)'\)/g)].map(m => m[1]));
  feste.forEach(function (id) {
    if (erzeugt.has(id)) {
      ok('ID "' + id + '" wird zur Laufzeit erzeugt');
      return;
    }
    pruefe(imHtml.has(id), 'ID "' + id + '" wird angesprochen und existiert');
  });

  /* Zusammengesetzte IDs wie 'schirm' + name */
  const schirme = [...QUELLE.matchAll(/id="schirm([A-Za-zÄÖÜäöü]+)"/g)].map(m => m[1]);
  schirme.forEach(function (s) {
    pruefe(imHtml.has('schirm' + s) && imHtml.has('nav' + s),
           'zusammengesetzte IDs schirm' + s + ' und nav' + s + ' existieren');
  });
}

/* ============================================================
   6. Datenmodell vollständig
   ============================================================ */
console.log('\n6. Datenmodell');
{
  const skript = hauptSkript();
  const erwartet = ['aufgaben', 'ziele', 'themen', 'projekte', 'ablaeufe',
                    'durchlaeufe', 'jahrestermine', 'kalenderzuordnung', 'termine'];

  const leer = skript.match(/function leereDatenbank\(\)[\s\S]*?\n\}/);
  pruefe(!!leer, 'leereDatenbank ist auslesbar');
  if (leer) {
    erwartet.forEach(function (s) {
      pruefe(new RegExp('\\b' + s + '\\s*:').test(leer[0]),
             'Sammlung "' + s + '" steht in leereDatenbank');
    });
    pruefe(/einstellungen\s*:/.test(leer[0]), 'Einstellungen stehen in leereDatenbank');
    pruefe(/version\s*:\s*APP_VERSION/.test(leer[0]), 'Version wird aus APP_VERSION gesetzt');
  }

  const samm = skript.match(/var SAMMLUNGEN = \[([\s\S]*?)\];/);
  pruefe(!!samm, 'SAMMLUNGEN ist definiert');
  if (samm) {
    const genannt = [...samm[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
    erwartet.forEach(function (s) {
      pruefe(genannt.indexOf(s) >= 0, 'Sammlung "' + s + '" steht in SAMMLUNGEN');
    });
    pruefe(genannt.length === erwartet.length,
           'SAMMLUNGEN enthält genau ' + erwartet.length + ' Einträge (ist: ' + genannt.length + ')');
  }
}

/* ============================================================
   7. Versionierung an allen drei Stellen
   ============================================================ */
console.log('\n7. Versionierung');
{
  const ausTitel = QUELLE.match(/<title>Workbench ([\d.]+)<\/title>/);
  const ausKonst = QUELLE.match(/APP_VERSION\s*=\s*'([\d.]+)'/);

  pruefe(!!ausTitel, 'Version steht im title-Tag');
  pruefe(!!ausKonst, 'APP_VERSION ist gesetzt');
  if (ausTitel && ausKonst) {
    pruefe(ausTitel[1] === ausKonst[1],
           'title und APP_VERSION stimmen überein (' + ausTitel[1] + ' / ' + ausKonst[1] + ')');
  }
  pruefe(/kopfVersion/.test(QUELLE) && /'v' \+ APP_VERSION/.test(QUELLE),
         'Version wird im Kopf sichtbar ausgegeben');
}

/* ============================================================
   8. Speicherwege vollständig verdrahtet
   ============================================================ */
console.log('\n8. Speicherwege');
{
  const skript = hauptSkript();
  pruefe(/showOpenFilePicker/.test(skript), 'Datei-Schnittstelle wird benutzt');
  pruefe(/navigator\.storage\.getDirectory/.test(skript), 'geräteeigener Speicher wird benutzt');
  pruefe(/localStorage/.test(skript), 'lokaler Speicher als letzter Rückfall');
  pruefe(/indexedDB/.test(skript), 'IndexedDB bewahrt den Datei-Handle');

  pruefe(/function notwegSchreiben/.test(skript), 'Schreiben hat einen Notweg');
  pruefe(/function notwegLesen/.test(skript), 'Lesen hat einen Notweg');

  /* Berechtigungen dürfen nur auf Geste angefragt werden. requestPermission
     darf deshalb nicht in starten() oder laden() stehen. */
  const start = skript.match(/function starten\(\)[\s\S]*?\n\}/);
  pruefe(start && !/requestPermission/.test(start[0]),
         'starten() fragt keine Berechtigung an (nur queryPermission)');
  const ladenFn = skript.match(/function laden\(\)[\s\S]*?\n\}/);
  pruefe(ladenFn && !/requestPermission/.test(ladenFn[0]),
         'laden() fragt keine Berechtigung an');
  pruefe(/function zugriffErlauben[\s\S]{0,400}rechteAnfragen/.test(skript),
         'zugriffErlauben fragt die Berechtigung an (Nutzergeste)');
}

/* ============================================================
   9. Bekannte Fallstricke
   ============================================================ */
console.log('\n9. Bekannte Fallstricke');
{
  const ohneKommentare = QUELLE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  pruefe(!/100vh/.test(QUELLE),
         'kein 100vh (bricht die Zoom-Darstellung in der PWA)');
  pruefe(/html,body\{height:100%/.test(QUELLE),
         'html und body mit height:100%');
  pruefe(QUELLE.indexOf('--app-h') < QUELLE.indexOf('</head>'),
         '--app-h wird vor dem Rendern gesetzt');
  pruefe(!/toISOString/.test(ohneKommentare),
         'kein toISOString für Datumswerte (Zeitzonenversatz)');
  pruefe(/function isoDatum/.test(QUELLE),
         'isoDatum rechnet lokal');
  pruefe(!/onclick="if\(/.test(QUELLE),
         'kein onclick="if(X)return;" (ungültige Syntax)');
  pruefe(!/document\.documentElement\.style\.setProperty\('zoom'/.test(QUELLE),
         'kein CSS-zoom über setProperty');

  /* Der 0-||-Fehler: ein gültiger Wert 0 oder '' wertet sich als falsch aus. */
  const verdaechtig = [...QUELLE.matchAll(/if\s*\(\s*!\s*(filter|art|wert|index|stand)\s*\)/g)];
  if (verdaechtig.length) {
    warn('Prüfung mit ! auf möglicherweise gültige leere Werte: '
         + verdaechtig.map(m => m[1]).join(', ') + ' — auf === null prüfen');
  } else {
    ok('keine Falsy-Prüfung auf Werte, die leer gültig sein können');
  }
}

/* ============================================================
   10. HTML-Struktur
   ============================================================ */
console.log('\n10. HTML-Struktur');
{
  const paare = ['div', 'button', 'span', 'svg', 'script', 'style', 'select', 'table'];
  paare.forEach(function (t) {
    const auf = (QUELLE.match(new RegExp('<' + t + '\\b', 'g')) || []).length;
    const zu  = (QUELLE.match(new RegExp('</' + t + '>', 'g')) || []).length;
    if (auf === 0 && zu === 0) { return; }
    pruefe(auf === zu, t + '-Balance (' + auf + '/' + zu + ')');
  });

  pruefe(/<!DOCTYPE html>/i.test(QUELLE), 'DOCTYPE vorhanden');
  pruefe(/<html lang="de">/.test(QUELLE), 'Sprache ist Deutsch');
  pruefe(/viewport-fit=cover/.test(QUELLE), 'viewport-fit=cover für die PWA');
}

/* ============================================================
   11. Google-Anbindung vorbereitet
   ============================================================ */
console.log('\n11. Google-Anbindung');
{
  const skript = hauptSkript();
  const id = skript.match(/CLIENT_ID\s*=\s*'([^']+)'/);
  const uri = skript.match(/REDIRECT_URI\s*=\s*'([^']+)'/);
  pruefe(!!id, 'CLIENT_ID ist hinterlegt');
  pruefe(!!uri, 'REDIRECT_URI ist hinterlegt');
  if (uri) {
    const datei = path.basename(DATEI);
    pruefe(uri[1].endsWith(datei) || uri[1].endsWith('workbench.html'),
           'REDIRECT_URI endet auf den Dateinamen der App (' + uri[1] + ')');
  }
  pruefe(!/client_secret/i.test(QUELLE), 'kein Client-Secret im Quelltext');
}

/* ============================================================
   12. Google-Anmeldung und Drive
   Grund: Der Zugriff läuft nach 60 Minuten ab. Ohne stille Erneuerung
   reißt jede laufende Arbeit ab. Und der Schlüssel darf niemals in der
   Datendatei landen, die bei Drive liegt.
   ============================================================ */
console.log('\n12. Google-Anmeldung und Drive');
{
  const skript = hauptSkript();

  const pflicht = [
    'gisLaden', 'klientVorbereiten', 'anmelden', 'abmelden',
    'tokenMerken', 'tokenAusSitzung', 'tokenVergessen', 'tokenGueltig',
    'erneuerungPlanen', 'restMinuten',
    'driveKopf', 'antwortPruefen', 'driveSuchen', 'driveAnlegen',
    'driveHochladen', 'driveHerunterladen',
    'driveLadenJetzt', 'driveSpeichernJetzt', 'zeichneGoogle'
  ];
  pflicht.forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  /* Rechte: nur lesen beim Kalender, nur eigene Dateien bei Drive */
  pruefe(/auth\/drive\.file/.test(skript), 'Drive-Recht ist auf eigene Dateien beschränkt');
  pruefe(/auth\/calendar\.readonly/.test(skript), 'Kalender-Recht ist nur lesend');
  pruefe(!/auth\/drive['" ]/.test(skript), 'kein Drive-Vollzugriff angefordert');
  pruefe(!/auth\/calendar['" ]/.test(skript), 'kein schreibender Kalenderzugriff angefordert');

  /* Der Schlüssel darf nie in die Datendatei */
  const leer = skript.match(/function leereDatenbank\(\)[\s\S]*?\n\}/);
  if (leer) {
    pruefe(!/token/i.test(leer[0]), 'leereDatenbank enthält kein Schlüsselfeld');
  }
  const samm = skript.match(/var SAMMLUNGEN = \[([\s\S]*?)\];/);
  if (samm) {
    pruefe(!/token/i.test(samm[1]), 'SAMMLUNGEN enthält kein Schlüsselfeld');
  }
  pruefe(/sessionStorage\.setItem\(TOKEN_KEY/.test(skript),
         'Schlüssel liegt in sessionStorage, nicht dauerhaft');
  pruefe(!/localStorage\.setItem\(TOKEN_KEY/.test(skript),
         'Schlüssel wird nicht in localStorage geschrieben');
  const alsTextFn = skript.match(/function alsText\(\)[\s\S]*?\n\}/);
  if (alsTextFn) {
    pruefe(!/zugriffToken/.test(alsTextFn[0]),
           'alsText schreibt den Schlüssel nicht in die Datei');
  }

  /* Stille Erneuerung */
  pruefe(/VORLAUF_MS/.test(skript), 'Vorlauf für die Erneuerung ist definiert');
  const vorlauf = skript.match(/VORLAUF_MS\s*=\s*([\d\s*]+);/);
  if (vorlauf) {
    const wert = Function('"use strict";return (' + vorlauf[1] + ')')();
    pruefe(wert > 0 && wert < 3600000,
           'Vorlauf liegt zwischen 0 und einer Stunde (' + Math.round(wert / 60000) + ' Minuten)');
  }
  const merken = skript.match(/function tokenMerken\([\s\S]*?\n\}/);
  pruefe(merken && /erneuerungPlanen\(\)/.test(merken[0]),
         'tokenMerken plant die Erneuerung ein');
  const planen = skript.match(/function erneuerungPlanen\([\s\S]*?\n\}/);
  pruefe(planen && /setTimeout/.test(planen[0]) && /anmelden\(true\)/.test(planen[0]),
         'erneuerungPlanen ruft die stille Anmeldung auf');
  pruefe(planen && /clearTimeout/.test(planen[0]),
         'erneuerungPlanen räumt eine alte Uhr ab (keine doppelten Timer)');
  pruefe(/requestAccessToken\(\{ prompt: still \? '' : 'consent' \}\)/.test(skript),
         'stille Anmeldung fragt ohne Nachfrage, laute mit');

  /* Abgelaufener Zugriff wird erkannt */
  const pruefFn = skript.match(/function antwortPruefen\([\s\S]*?\n\}/);
  pruefe(pruefFn && /401/.test(pruefFn[0]) && /tokenVergessen\(\)/.test(pruefFn[0]),
         'Antwort 401 verwirft den Schlüssel statt still zu scheitern');

  /* Offline-Vorrang: Drive ist Transport, nicht Arbeitsspeicher */
  const startFn = skript.match(/function starten\(\)[\s\S]*?\n\}/);
  pruefe(startFn && !/drive(Suchen|Herunterladen|Hochladen)/.test(startFn[0]),
         'starten() greift nicht auf Drive zu (App läuft ohne Netz an)');
  const ladenDrive = skript.match(/function driveLadenJetzt\([\s\S]*?\n\}/);
  pruefe(ladenDrive && /speichern\(\)/.test(ladenDrive[0]),
         'von Drive Geladenes wird sofort lokal gesichert');

  /* Anmeldebibliothek wird nicht doppelt eingehängt */
  const gis = skript.match(/function gisLaden\([\s\S]*?\n\}/);
  pruefe(gis && /getElementById\('gisSkript'\)/.test(gis[0]),
         'gisLaden hängt das Skript nur einmal ein');
}

/* ============================================================
   13. Abgleich zwischen zwei Geraeten
   Grund: Zwei Geraete aendern denselben Bestand. Ohne datensatzweises
   Zusammenfuehren verliert der zweite Speichervorgang die Arbeit des
   ersten. Diese Kategorie fuehrt den Abgleich wirklich aus.
   ============================================================ */
console.log('\n13. Abgleich zwischen zwei Geräten');
{
  const skript = hauptSkript();
  let api = null;

  const stummeListe = { setItem() {}, getItem() { return null; }, removeItem() {} };
  global.window = {
    addEventListener() {}, setTimeout, clearTimeout,
    localStorage: stummeListe, sessionStorage: stummeListe,
    indexedDB: null, innerHeight: 800,
    matchMedia() { return { matches: false }; },
    fetch() { return Promise.reject(new Error('kein Netz im Test')); },
    google: null
  };
  global.document = {
    getElementById() { return null; },
    createElement() { return { addEventListener() {} }; },
    head: { appendChild() {} },
    documentElement: { style: { setProperty() {} } }
  };
  /* navigator ist in neueren Node-Fassungen schreibgeschützt */
  try {
    Object.defineProperty(global, 'navigator', {
      value: { storage: null }, configurable: true, writable: true
    });
  } catch (e) {
    warn('navigator ließ sich nicht ersetzen: ' + e.message);
  }

  try {
    const anhang = ';globalThis.__api = { zusammenfuehren, leereDatenbank, bestandStempeln,'
                 + ' grabsteineAufraeumen, textZuBestand, neueKennung };';
    (0, eval)(skript + anhang);
    api = globalThis.__api;
    ok('Skript lässt sich außerhalb des Browsers auswerten');
  } catch (e) {
    fail('Skript ließ sich nicht auswerten: ' + e.message);
  }

  if (api) {
    /* Realistische Zeitpunkte: Löschvermerke älter als die Frist werden
       aufgeräumt, ein Stempel aus 1970 fiele darunter. */
    const T0 = Date.now() - (24 * 60 * 60 * 1000);
    function bestand(aufgaben, steine) {
      const db = api.leereDatenbank();
      db.aufgaben = aufgaben || [];
      db.grabsteine = steine || [];
      return db;
    }
    function finde(liste, id) { return liste.filter(x => x.id === id)[0] || null; }

    /* A — derselbe Datensatz auf beiden Seiten geaendert */
    let r = api.zusammenfuehren(
      bestand([{ id: 'a1', titel: 'lokal', geaendert: T0 + 100 }]),
      bestand([{ id: 'a1', titel: 'fremd', geaendert: T0 + 200 }])
    );
    let t = finde(r.db.aufgaben, 'a1');
    pruefe(t && t.titel === 'fremd', 'A: der jüngere Stand gewinnt');
    pruefe(r.bericht.konflikte.length === 1, 'A: der Konflikt wird gemeldet');

    /* B — umgekehrte Richtung */
    r = api.zusammenfuehren(
      bestand([{ id: 'a1', titel: 'lokal', geaendert: T0 + 300 }]),
      bestand([{ id: 'a1', titel: 'fremd', geaendert: T0 + 200 }])
    );
    t = finde(r.db.aufgaben, 'a1');
    pruefe(t && t.titel === 'lokal', 'B: auch andersherum gewinnt der jüngere Stand');

    /* C — Aufgabe des einen Geraets darf nicht verschwinden */
    r = api.zusammenfuehren(
      bestand([{ id: 'beruf', titel: 'Abendplanung', geaendert: T0 + 10 }]),
      bestand([{ id: 'privat', titel: 'Einkauf', geaendert: T0 + 20 }])
    );
    pruefe(r.db.aufgaben.length === 2, 'C: beide Geräte behalten ihre eigenen Aufgaben');
    pruefe(r.bericht.neu === 1 && r.bericht.behalten === 1, 'C: Bericht zählt richtig');

    /* D — geloescht bleibt geloescht */
    r = api.zusammenfuehren(
      bestand([], [{ s: 'aufgaben', id: 'a1', z: T0 + 500 }]),
      bestand([{ id: 'a1', titel: 'kommt zurück', geaendert: T0 + 100 }])
    );
    pruefe(r.db.aufgaben.length === 0, 'D: Gelöschtes kommt nicht vom anderen Gerät zurück');
    pruefe(r.bericht.entfernt === 1, 'D: die Entfernung steht im Bericht');

    /* E — nach dem Loeschen wieder bearbeitet: der Datensatz lebt */
    r = api.zusammenfuehren(
      bestand([], [{ s: 'aufgaben', id: 'a1', z: T0 + 100 }]),
      bestand([{ id: 'a1', titel: 'danach bearbeitet', geaendert: T0 + 500 }])
    );
    pruefe(r.db.aufgaben.length === 1,
           'E: eine nach dem Löschen bearbeitete Aufgabe überlebt');

    /* F — Loeschvermerk wandert mit */
    r = api.zusammenfuehren(
      bestand([], [{ s: 'aufgaben', id: 'a1', z: T0 + 500 }]),
      bestand([])
    );
    pruefe(r.db.grabsteine.length === 1, 'F: der Löschvermerk bleibt erhalten');

    /* G — doppelte Vermerke werden auf den juengsten zusammengezogen */
    r = api.zusammenfuehren(
      bestand([], [{ s: 'aufgaben', id: 'a1', z: T0 + 100 }]),
      bestand([], [{ s: 'aufgaben', id: 'a1', z: T0 + 900 }])
    );
    pruefe(r.db.grabsteine.length === 1, 'G: doppelte Vermerke werden zusammengezogen');
    pruefe(r.db.grabsteine[0].z === T0 + 900, 'G: der jüngste Zeitpunkt bleibt stehen');

    /* H — alte Vermerke werden aufgeraeumt */
    const uralt = Date.now() - (400 * 24 * 60 * 60 * 1000);
    const geputzt = api.grabsteineAufraeumen([
      { s: 'aufgaben', id: 'alt', z: uralt },
      { s: 'aufgaben', id: 'neu', z: Date.now() }
    ]);
    pruefe(geputzt.length === 1 && geputzt[0].id === 'neu',
           'H: Vermerke älter als die Frist werden entfernt');

    /* I — Kalenderzuordnung wird schluesselweise zusammengefuehrt */
    let a = api.leereDatenbank(); a.kalenderzuordnung = { g1: { art: 'urlaub', geaendert: T0 + 10 } };
    let b = api.leereDatenbank(); b.kalenderzuordnung = { g1: { art: 'krank', geaendert: T0 + 99 },
                                                          g2: { art: 'feier', geaendert: T0 + 5 } };
    r = api.zusammenfuehren(a, b);
    pruefe(r.db.kalenderzuordnung.g1 && r.db.kalenderzuordnung.g1.art === 'krank',
           'I: bei der Kalenderzuordnung gewinnt der jüngere Eintrag');
    pruefe(!!r.db.kalenderzuordnung.g2, 'I: fremde Zuordnungen kommen dazu');

    /* J — Altbestand ohne Kennung und Stempel wird nachgetragen */
    const alt = api.leereDatenbank();
    alt.aufgaben = [{ titel: 'ohne alles' }, { titel: 'auch ohne' }];
    const nachgetragen = api.bestandStempeln(alt);
    pruefe(nachgetragen >= 4, 'J: Kennung und Stempel werden nachgetragen');
    pruefe(!!alt.aufgaben[0].id && alt.aufgaben[0].id !== alt.aufgaben[1].id,
           'J: die nachgetragenen Kennungen sind verschieden');

    /* K — Kennungen sind eindeutig */
    const gesehen = {};
    let doppelt = 0;
    let n;
    for (n = 0; n < 500; n++) {
      const kk = api.neueKennung();
      if (gesehen[kk]) { doppelt++; }
      gesehen[kk] = true;
    }
    pruefe(doppelt === 0, 'K: 500 Kennungen ohne Dublette');

    /* L — Stempel sind Zahlen, keine Datumstexte */
    pruefe(!/geaendert\s*[:=]\s*isoZeit\(\)/.test(skript),
           'L: der Änderungsstempel ist kein Datumstext');
    pruefe(/function jetzt\(\)\s*\{\s*return Date\.now\(\)/.test(skript),
           'L: der Stempel kommt aus Date.now()');

    /* L2 — die Aufräumfrist hat eine Kehrseite, die bewusst hingenommen wird:
       war ein Gerät länger als die Frist offline, kann Gelöschtes zurückkommen. */
    const laengstVorbei = Date.now() - (400 * 24 * 60 * 60 * 1000);
    r = api.zusammenfuehren(
      bestand([], [{ s: 'aufgaben', id: 'a1', z: laengstVorbei }]),
      bestand([{ id: 'a1', titel: 'sehr alt', geaendert: laengstVorbei - 1000 }])
    );
    pruefe(r.db.aufgaben.length === 1,
           'L2: nach Ablauf der Vermerkfrist kehrt Gelöschtes zurück (bewusst so)');

    /* M — der Abgleich schreibt das Ergebnis lokal, bevor er hochlaedt */
    const abgl = skript.match(/function abgleichen\(\)[\s\S]*?\n\}/);
    pruefe(abgl && /speichern\(\)[\s\S]*driveHochladen\(\)/.test(abgl[0]),
           'M: erst lokal sichern, dann hochladen');
    pruefe(abgl && /zusammenfuehren\(DB, fremd\)/.test(abgl[0]),
           'M: der Abgleich benutzt das Zusammenführen');
  }
}

/* ============================================================
   ERGEBNIS
   ============================================================ */
console.log('\n============================================================');
console.log('ERGEBNIS   ok: ' + anzOk + '   FAIL: ' + anzFail + '   warn: ' + anzWarn);
console.log('Datei: ' + DATEI);
console.log('============================================================\n');

process.exit(anzFail > 0 ? 1 : 0);
