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

  /* Rückmeldungen müssen auf dem Bildschirm stehen, auf dem gearbeitet wird.
     Eine Meldezeile allein auf der Diagnose bleibt sonst ungesehen. */
  const meldeFn = hauptSkript().match(/function melde\([\s\S]*?\n\}/);
  const meldeStellen = meldeFn
    ? [...meldeFn[0].matchAll(/'([a-zA-Z][\w-]*)'/g)].map(m => m[1]).filter(x => /melder/i.test(x))
    : [];
  pruefe(meldeStellen.length >= 2, 'melde() bedient mehr als eine Meldezeile');
  meldeStellen.forEach(function (id) {
    pruefe(new RegExp('id="' + id + '"').test(QUELLE),
           'Meldezeile "' + id + '" existiert im HTML');
  });
  schirme.forEach(function (s) {
    if (s === 'Tag') { return; }
    const block = QUELLE.match(new RegExp('id="schirm' + s + '"[\\s\\S]*?\\n</div>'));
    pruefe(!block || /class="melder"/.test(block[0]),
           'Bildschirm "' + s + '" hat eine eigene Meldezeile');
  });
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
                 + ' grabsteineAufraeumen, textZuBestand, neueKennung,'
                 + ' migrationRechnen, quelleErkennen, kontextRaten, gruppenKontext,'
                 + ' wiederholungUmschreiben, wochentagUmrechnen, schluesselId, deutschZuIso };'
                 + 'globalThis.__tagApi = { tagesform, faelligAn, feiertagAn, monatsende,'
                 + ' kalenderwoche, wochenIndex, eingabeDeuten, esc, istErledigtAn,'
                 + ' tagesEintraege, ausIso, tagePlus };'
                 + 'globalThis.__aufApi = { gruppeVonPlanung, gruppeVonFrist, wochenEnde,'
                 + ' regelText, planungText, planungKlasse, isoDatum, tagePlus,'
                 + ' themenFuer, projekteFuer };'
                 + 'globalThis.__kalApi = { eintraegeEinsortieren, termineFuerTag, termineZahl,'
                 + ' zeitAusEintrag, tagAusEintrag,'
                 + ' zuruecksetzen: function(){ termineNachTag = {}; } };';
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
   14. Migration der Altbestände
   Grund: Die Migration laeuft einmal ueber Jahre gewachsene Daten.
   Was sie falsch einordnet oder verliert, faellt erst spaeter auf.
   Sie muss ausserdem wiederholbar sein, sonst entstehen Dubletten.
   ============================================================ */
console.log('\n14. Migration der Altbestände');
{
  const api = globalThis.__api;
  const skript = hauptSkript();

  const noetig = ['migrationRechnen', 'wiederholungUmschreiben', 'wochentagUmrechnen',
                  'schluesselId', 'quelleErkennen', 'kontextRaten', 'gruppenKontext',
                  'deutschZuIso', 'migVorschau', 'migUebernehmen', 'migZeichne'];
  noetig.forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript), 'Funktion ' + f + ' ist definiert');
  });

  if (!api || !api.migrationRechnen) {
    /* Die Sandkasten-Auswertung aus Kategorie 13 liefert die Funktionen mit. */
    warn('Migrationsfunktionen nicht auswertbar — Kategorie 13 muss vorher laufen');
  } else {
    /* Wochentage: alt 1=Mo..7=So, neu 0=So..6=Sa */
    const umrechnen = api.wochentagUmrechnen;
    pruefe(umrechnen(1) === 1 && umrechnen(5) === 5, 'Montag und Freitag bleiben unverändert');
    pruefe(umrechnen(7) === 0, 'Sonntag wird von 7 auf 0 umgerechnet');
    pruefe(umrechnen(0) === -1 && umrechnen(9) === -1, 'ungültige Wochentage werden verworfen');

    const umschreiben = api.wiederholungUmschreiben;
    let regel = umschreiben({ typ: 'woechentlich', intervall: 1, wochentage: [7, 1, 3, 5] }, '');
    pruefe(regel && regel.takt === 'woche', 'wöchentlich wird zu Takt Woche');
    pruefe(regel && JSON.stringify(regel.tage) === '[0,1,3,5]',
           'die Wochentage werden umgerechnet und sortiert');

    regel = umschreiben({ typ: 'woechentlich', intervall: 4, wochentage: [] }, '');
    pruefe(regel === null, 'eine Regel ohne Wochentag wird abgeschaltet');

    regel = umschreiben({ typ: 'monatlich' }, '2026-09-04');
    pruefe(regel && regel.takt === 'monat' && regel.tag === 4,
           'monatlich übernimmt den Tag aus dem Fälligkeitsdatum');

    regel = umschreiben({ typ: 'woechentlich', intervall: 12, wochentage: [1] }, '');
    pruefe(regel && regel.intervall === 4, 'zu große Intervalle werden auf 4 begrenzt');

    pruefe(umschreiben(null, '') === null, 'ohne Altregel entsteht keine Regel');

    /* Wiederholbarkeit: gleiche Eingabe, gleiche Kennungen */
    const quelle = {
      name: 'test.json', art: 'workassist', kontext: 'beruflich',
      daten: {
        bereiche: [{ id: 'b1', name: 'Organisatorische Aufgaben' },
                   { id: 'b2', name: 'Einführung Windows 11 26H2' },
                   { id: 'b3', name: 'Sonstiges (Einzelaufgaben)' },
                   { id: 'b4', name: 'Etwas ganz Neues' }],
        aufgaben: [
          { id: 'a1', titel: 'Einzelaufgabe', bereichId: 'b1', status: 'offen' },
          { id: 'a2', titel: 'Wiederkehrend', bereichId: 'b1', status: 'erledigt',
            erledigtAm: '2026-09-01',
            wiederholung: { typ: 'woechentlich', intervall: 1, wochentage: [1] } },
          { id: 'a3', titel: 'Wiederkehrend', bereichId: 'b1', status: 'erledigt',
            erledigtAm: '2026-09-08',
            wiederholung: { typ: 'woechentlich', intervall: 1, wochentage: [1] } }
        ],
        plaene: [{ id: 'p1', titel: 'Mein Tag', schritte: [] },
                 { id: 'p2', titel: 'Irgendein Vorhaben',
                   schritte: [{ titel: 'Schritt A' }, { titel: 'Schritt B' }] },
                 { id: 'p3', titel: 'Workflowtest Testdurchführung',
                   schritte: [{ titel: 'Vorbereiten' }] }],
        jahrestermine: [{ t: 'Urlaub', art: 'urlaub', von: '2026-08-03', bis: '2026-08-21' },
                        { t: 'Neujahr', art: 'feiertag', von: '2026-01-01', bis: '2026-01-01' },
                        { t: 'Urlaub', art: 'urlaub', von: '2026-08-03', bis: '2026-08-21' }]
      }
    };

    const e1 = api.migrationRechnen([quelle]);
    const e2 = api.migrationRechnen([quelle]);

    pruefe(e1.ziel.themen.length === 2, 'bekannte und unbekannte Bereiche werden Themen (2)');
    pruefe(e1.bericht.unbekannteBereiche.length === 1,
           'der unbekannte Bereich wird im Bericht ausgewiesen');
    pruefe(e1.ziel.projekte.length === 1, 'ein Bereich wird zum Projekt');
    pruefe(e1.bericht.verworfen >= 2, 'Sammelbecken und Feiertag werden verworfen');

    const wdh = e1.ziel.aufgaben.filter(a => a.titel === 'Wiederkehrend');
    pruefe(wdh.length === 1, 'erzeugte Wiederholungen werden zu einer Aufgabe zusammengezogen');
    pruefe(wdh[0] && wdh[0].zuletztErledigt === '2026-09-08',
           'das jüngste Erledigtdatum bleibt erhalten');

    pruefe(e1.ziel.ablaeufe.length === 1, 'die wiederverwendbare Vorlage wird als Ablauf angelegt');
    pruefe(e1.ziel.durchlaeufe.length === 1, 'einmalige Vorhaben werden Durchläufe ohne Vorlage');
    pruefe(e1.ziel.durchlaeufe[0] && e1.ziel.durchlaeufe[0].ablaufId === null,
           'ein einmaliger Durchlauf hat keine Vorlage');

    pruefe(e1.ziel.jahrestermine.length === 1, 'doppelte Jahrestermine werden zusammengezogen');
    pruefe(e1.ziel.jahrestermine[0].art === 'urlaub', 'Feiertage sind nicht dabei');

    const ids1 = e1.ziel.aufgaben.map(a => a.id).sort().join(',');
    const ids2 = e2.ziel.aufgaben.map(a => a.id).sort().join(',');
    pruefe(ids1 === ids2, 'zweimal gerechnet ergibt dieselben Kennungen');

    const zus = api.zusammenfuehren(e1.ziel, e2.ziel);
    pruefe(zus.db.aufgaben.length === e1.ziel.aufgaben.length,
           'zweimal übernommen ergibt keine Dubletten');
    pruefe(zus.db.themen.length === e1.ziel.themen.length,
           'auch bei Themen entstehen keine Dubletten');

    /* Alle Aufgaben tragen Kennung, Stempel und Kontext */
    const ohneKennung = e1.ziel.aufgaben.filter(a => !a.id).length;
    const ohneStempel = e1.ziel.aufgaben.filter(a => typeof a.geaendert !== 'number').length;
    const ohneKontext = e1.ziel.aufgaben.filter(a => !a.kontext).length;
    pruefe(ohneKennung === 0, 'alle Aufgaben haben eine Kennung');
    pruefe(ohneStempel === 0, 'alle Aufgaben haben einen Änderungsstempel');
    pruefe(ohneKontext === 0, 'alle Aufgaben haben einen Kontext');

    /* Datumsformat aus TimeAssist */
    const deutsch = api.deutschZuIso;
    pruefe(deutsch('10.12.2026') === '2026-12-10', 'TT.MM.JJJJ wird zu JJJJ-MM-TT');
    pruefe(deutsch('') === '', 'ein leeres Datum bleibt leer');

    /* Die Migration darf nicht von selbst loslaufen */
    const startFn = skript.match(/function starten\(\)[\s\S]*?\n\}/);
    pruefe(startFn && !/migrationRechnen|migUebernehmen/.test(startFn[0]),
           'die Migration läuft nicht beim Start');
    const uebern = skript.match(/function migUebernehmen\([\s\S]*?\n\}/);
    pruefe(uebern && /migErgebnis/.test(uebern[0]),
           'Übernehmen setzt eine berechnete Vorschau voraus');
    pruefe(uebern && /zusammenfuehren\(DB, neu\)/.test(uebern[0]),
           'Übernehmen führt zusammen statt zu überschreiben');
  }
}

/* ============================================================
   15. Tagesplan
   Grund: Der Tagesplan entscheidet, was ueberhaupt erscheint.
   Eine falsche Wiederholungsrechnung zeigt Dinge am falschen Tag
   oder gar nicht — und faellt im Alltag erst spaet auf.
   ============================================================ */
console.log('\n15. Tagesplan');
{
  const api = globalThis.__tagApi;
  const skript = hauptSkript();

  const noetig = ['tagZeichnen', 'tagBlaettern', 'tagHeute', 'tagesform', 'faelligAn',
                  'tagesEintraege', 'aufgabeHaken', 'schnellAnlegen', 'eingabeDeuten',
                  'feiertagAn', 'urlaubAn', 'monatsende', 'kalenderwoche', 'wochenIndex',
                  'streifenPruefen', 'istErledigtAn', 'esc'];
  noetig.forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript), 'Funktion ' + f + ' ist definiert');
  });

  if (!api) {
    warn('Tagesfunktionen nicht auswertbar');
  } else {
    /* Monatsende: nie über den Ersten des Folgemonats rechnen */
    pruefe(api.monatsende(2026, 2) === 28, 'Februar 2026 hat 28 Tage');
    pruefe(api.monatsende(2024, 2) === 29, 'Februar 2024 hat 29 Tage');
    pruefe(api.monatsende(2026, 12) === 31, 'Dezember hat 31 Tage');

    /* Feiertage */
    pruefe(api.feiertagAn('2026-01-01') === 'Neujahr', 'Neujahr wird erkannt');
    pruefe(api.feiertagAn('2026-06-04') === 'Fronleichnam', 'Fronleichnam 2026 stimmt');
    pruefe(api.feiertagAn('2026-09-08') === '', 'ein normaler Dienstag ist kein Feiertag');
    pruefe(api.feiertagAn('2027-03-26') === 'Karfreitag', 'Karfreitag 2027 stimmt');

    /* Tagesform */
    pruefe(api.tagesform('2026-09-08').form === 'Arbeitstag', 'Dienstag ist ein Arbeitstag');
    pruefe(api.tagesform('2026-09-12').form === 'Freizeittag', 'Samstag ist ein Freizeittag');
    pruefe(api.tagesform('2026-01-01').form === 'Freizeittag', 'Neujahr ist ein Freizeittag');

    /* Wochenregel */
    const woche = { takt: 'woche', intervall: 1, tage: [1, 5], tag: 1 };
    pruefe(api.faelligAn(woche, '2026-09-07') === true, 'Montag trifft die Regel Mo+Fr');
    pruefe(api.faelligAn(woche, '2026-09-11') === true, 'Freitag trifft die Regel Mo+Fr');
    pruefe(api.faelligAn(woche, '2026-09-08') === false, 'Dienstag trifft sie nicht');

    const leer = { takt: 'woche', intervall: 1, tage: [], tag: 1 };
    pruefe(api.faelligAn(leer, '2026-09-07') === false, 'ohne Wochentag trifft nichts zu');

    /* Zweiwöchentlich: genau jede zweite Woche */
    const zwei = { takt: 'woche', intervall: 2, tage: [1], tag: 1 };
    const m1 = api.faelligAn(zwei, '2026-09-07');
    const m2 = api.faelligAn(zwei, '2026-09-14');
    const m3 = api.faelligAn(zwei, '2026-09-21');
    pruefe(m1 !== m2, 'zweiwöchentlich trifft nicht in zwei Wochen hintereinander');
    pruefe(m1 === m3, 'aber wieder zwei Wochen später');

    /* Monatsregel und der Monatsletzte */
    const monat = { takt: 'monat', intervall: 1, tage: [], tag: 31 };
    pruefe(api.faelligAn(monat, '2026-01-31') === true, 'der 31. trifft im Januar');
    pruefe(api.faelligAn(monat, '2026-02-28') === true,
           'im Februar rückt der 31. auf den Monatsletzten');
    pruefe(api.faelligAn(monat, '2026-02-27') === false, 'der 27. Februar trifft nicht');

    /* Kalenderwoche */
    pruefe(api.kalenderwoche('2026-09-08') === 37, 'die Kalenderwoche wird richtig gerechnet');

    /* Deutung der Schnelleingabe */
    let d = api.eingabeDeuten('Rückruf Bergmann');
    pruefe(d.art === 'klein' && d.kontext === 'beruflich',
           'ohne Zusatz entsteht eine berufliche Kleinigkeit');
    d = api.eingabeDeuten('!Präsentation schreiben');
    pruefe(d.art === 'haupt' && d.titel === 'Präsentation schreiben',
           'das Ausrufezeichen macht eine Hauptaufgabe und verschwindet aus dem Titel');
    d = api.eingabeDeuten('Tisch reservieren p');
    pruefe(d.kontext === 'privat' && d.titel === 'Tisch reservieren',
           'das angehängte p macht es privat und verschwindet');
    d = api.eingabeDeuten('!Zisterne vergleichen privat');
    pruefe(d.art === 'haupt' && d.kontext === 'privat' && d.titel === 'Zisterne vergleichen',
           'beide Kürzel zusammen werden verstanden');

    /* Maskierung gegen eingeschleustes Markup */
    pruefe(api.esc('<b>x</b>').indexOf('<') < 0, 'Titel werden maskiert');
  }
}

/* ============================================================
   16. Automatischer Abgleich
   Grund: Ohne selbsttaetigen Abgleich bleibt jede Aenderung auf dem
   Geraet liegen, auf dem sie entstand. Genau das ist passiert:
   drei am PC erfasste Kleinigkeiten erschienen nie auf dem Handy.
   ============================================================ */
console.log('\n16. Automatischer Abgleich');
{
  const skript = hauptSkript();

  ['abgleichPlanen', 'abgleichStill', 'rueckkehrPruefen', 'warAngemeldet'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript), 'Funktion ' + f + ' ist definiert');
  });

  /* Nach dem lokalen Sichern muss der Abgleich angestoßen werden */
  const sichern = skript.match(/function spaeterSichern\([\s\S]*?\n\}/);
  pruefe(sichern && /abgleichPlanen\(/.test(sichern[0]),
         'nach dem lokalen Sichern wird ein Abgleich eingeplant');

  /* Nach der Anmeldung ebenso */
  const anm = skript.match(/function anmelden\([\s\S]*?\n\}\n/);
  pruefe(anm && /abgleichPlanen\(true\)/.test(anm[0]),
         'nach erfolgreicher Anmeldung wird sofort abgeglichen');

  /* Rückkehr zur App */
  const start = skript.match(/function starten\(\)[\s\S]*?\n\}/);
  pruefe(start && /visibilitychange/.test(start[0]),
         'die Rückkehr zur App wird beobachtet');
  const rueck = skript.match(/function rueckkehrPruefen\([\s\S]*?\n\}/);
  pruefe(rueck && /document\.hidden/.test(rueck[0]),
         'beim Verlassen wird nicht abgeglichen');
  pruefe(rueck && /ABGLEICH_MINDEST/.test(rueck[0]),
         'ein Mindestabstand verhindert dauerndes Abgleichen');

  /* Kein doppelter Lauf, keine doppelte Uhr */
  const still = skript.match(/function abgleichStill\([\s\S]*?\n\}/);
  pruefe(still && /abgleichLaeuft/.test(still[0]),
         'ein laufender Abgleich wird nicht ein zweites Mal gestartet');
  const planen = skript.match(/function abgleichPlanen\([\s\S]*?\n\}/);
  pruefe(planen && /clearTimeout/.test(planen[0]),
         'eine bereits geplante Uhr wird abgeräumt');
  pruefe(planen && /tokenGueltig\(\)/.test(planen[0]),
         'ohne Anmeldung wird kein Abgleich geplant');

  /* Stille Wiederanmeldung beim Start */
  pruefe(start && /warAngemeldet\(\)/.test(start[0]),
         'beim Start wird geprüft, ob früher angemeldet war');
  pruefe(start && /anmelden\(true\)/.test(start[0]),
         'die Wiederanmeldung läuft zunächst ohne Nachfrage');
  pruefe(/localStorage\.setItem\(ANMELDE_MERKER/.test(skript),
         'der Merker steht in localStorage, nicht der Schlüssel selbst');
  pruefe(!/localStorage\.setItem\(TOKEN_KEY/.test(skript),
         'der Zugriffsschlüssel wird weiterhin nicht dauerhaft abgelegt');
  const ab = skript.match(/function abmelden\([\s\S]*?\n\}/);
  pruefe(ab && /removeItem\(ANMELDE_MERKER\)/.test(ab[0]),
         'Abmelden löscht den Merker');

  /* Verzögerungen plausibel */
  const verzug = skript.match(/ABGLEICH_VERZUG\s*=\s*(\d+)/);
  const mindest = skript.match(/ABGLEICH_MINDEST\s*=\s*(\d+)/);
  pruefe(verzug && Number(verzug[1]) >= 1000 && Number(verzug[1]) <= 15000,
         'die Wartezeit nach einer Änderung liegt zwischen 1 und 15 Sekunden');
  pruefe(mindest && Number(mindest[1]) > Number(verzug[1]),
         'der Mindestabstand ist größer als die Wartezeit');
}

/* ============================================================
   17. Löschen und Rückgängig
   Grund: Loeschen ohne Loeschvermerk holt der naechste Abgleich
   vom anderen Geraet zurueck. Und ein Rueckgaengig, das den Vermerk
   stehen laesst, loescht den Eintrag beim naechsten Abgleich erneut.
   ============================================================ */
console.log('\n17. Löschen und Rückgängig');
{
  const skript = hauptSkript();

  ['aufgabeAktionen', 'aktionenSchliessen', 'aufgabeLoeschen', 'rueckgaengig',
   'rueckZeigen', 'rueckVerbergen', 'aufgabeSchieben', 'aufgabeInsBacklog'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript), 'Funktion ' + f + ' ist definiert');
  });

  const loe = skript.match(/function aufgabeLoeschen\([\s\S]*?\n\}/);
  pruefe(loe && /grabsteinSetzen\('aufgaben'/.test(loe[0]),
         'Löschen setzt einen Löschvermerk');
  pruefe(loe && /zurueckHolen\s*=/.test(loe[0]),
         'Löschen bewahrt den Satz für das Rückgängig auf');
  pruefe(loe && /rueckZeigen\(/.test(loe[0]),
         'nach dem Löschen erscheint der Rückweg');
  pruefe(loe && /spaeterSichern\(\)/.test(loe[0]),
         'die Löschung wird gesichert und abgeglichen');

  const rueck = skript.match(/function rueckgaengig\([\s\S]*?\n\}/);
  pruefe(rueck && /splice\(/.test(rueck[0]), 'Rückgängig setzt den Satz wieder ein');
  pruefe(rueck && /grabsteine/.test(rueck[0]) && /splice\(i, 1\)/.test(rueck[0]),
         'Rückgängig entfernt den Löschvermerk wieder');
  pruefe(rueck && /geaendert = jetzt\(\)/.test(rueck[0]),
         'der wiederhergestellte Satz bekommt einen frischen Stempel');

  const verb = skript.match(/function rueckVerbergen\([\s\S]*?\n\}/);
  pruefe(verb && /zurueckHolen = null/.test(verb[0]),
         'nach Ablauf der Frist ist das Rückgängig endgültig vorbei');

  const zeit = skript.match(/RUECK_ZEIT\s*=\s*(\d+)/);
  pruefe(zeit && Number(zeit[1]) >= 4000 && Number(zeit[1]) <= 20000,
         'die Rückgängig-Frist liegt zwischen 4 und 20 Sekunden');

  /* Löschen braucht Reibung: kein Knopf direkt in der Zeile */
  const detail = skript.match(/function detailHtml\([\s\S]*?\n\}\n/);
  pruefe(detail && /gefahr" onclick="aufgabeLoeschen\(\)/.test(detail[0]),
         'der Löschknopf steht in der Detailfläche und ist als gefährlich ausgezeichnet');
  const zeichnen = skript.match(/function aufZeichnen\([\s\S]*?\n\}\n/);
  pruefe(zeichnen && !/aufgabeLoeschen/.test(zeichnen[0]),
         'in der Liste selbst gibt es keinen Löschknopf');
  const tagFn = skript.match(/function zeileHtml\([\s\S]*?\n\}/);
  pruefe(tagFn && !/aufgabeLoeschen/.test(tagFn[0]),
         'auch im Tagesplan nicht');

  /* Wiederkehrendes darf nicht einfach verschoben werden */
  const schieben = skript.match(/function aufgabeSchieben\([\s\S]*?\n\}/);
  pruefe(schieben && /wiederholung/.test(schieben[0]),
         'eine wiederkehrende Aufgabe wird beim Verschieben abgewiesen');

  /* Die Aktionsfläche gehört zum Tagesbildschirm */
  pruefe(/id="aktionSheet"/.test(QUELLE) && /id="aktionHg"/.test(QUELLE),
         'Aktionsfläche und Hintergrund liegen im HTML');
  pruefe(/id="rueckStreifen"/.test(QUELLE), 'der Rückgängig-Streifen liegt im HTML');
}

/* ============================================================
   18. Sichtbarer Abgleichstand
   Grund: Ein Abgleich, der still scheitert, sieht aus wie einer,
   der nie lief. Genau daran ist eine Loeschung haengengeblieben,
   ohne dass es jemand bemerken konnte.
   ============================================================ */
console.log('\n18. Sichtbarer Abgleichstand');
{
  const skript = hauptSkript();

  ['standSetzen', 'standZeichnen'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript), 'Funktion ' + f + ' ist definiert');
  });
  pruefe(/id="tkStand"/.test(QUELLE), 'die Standzeile liegt im Tagesbildschirm');
  pruefe(/id="tkAbgleich"/.test(QUELLE), 'der Tagesbildschirm hat einen Abgleich-Knopf');

  const stand = skript.match(/function standZeichnen\([\s\S]*?\n\}/);
  pruefe(stand && /tokenGueltig\(\)/.test(stand[0]),
         'ohne Anmeldung wird das ausdrücklich gesagt');
  pruefe(stand && /abgleichFehler/.test(stand[0]),
         'ein fehlgeschlagener Abgleich wird angezeigt');
  pruefe(stand && /grabsteine/.test(stand[0]),
         'die Zahl der Löschvermerke steht im Stand');
  pruefe(stand && /letzterAbgleich/.test(stand[0]),
         'der Zeitpunkt des letzten Abgleichs steht im Stand');

  const still = skript.match(/function abgleichStill\([\s\S]*?\n\}\n/);
  pruefe(still && /abgleichFehler = /.test(still[0]),
         'der stille Abgleich merkt sich seinen Fehler statt ihn zu verschlucken');

  const zeichnen = skript.match(/function tagZeichnen\([\s\S]*?\n\}\n/);
  pruefe(zeichnen && /standZeichnen\(\)/.test(zeichnen[0]),
         'der Stand wird bei jedem Zeichnen des Tages aufgefrischt');

  /* Die Aktionsfläche darf am großen Bildschirm nicht die volle Breite nehmen */
  pruefe(/\.aktion-sheet\{[^}]*max-width/.test(QUELLE),
         'die Aktionsfläche ist in der Breite begrenzt');
  pruefe(/\.aktion-sheet\{[^}]*translateX\(-50%\)/.test(QUELLE),
         'die Aktionsfläche steht mittig');
}

/* ============================================================
   19. Regelmaessiges Nachsehen bei Drive
   Grund: Eine Seite, die nur offen liegt, erfaehrt sonst nie von
   Aenderungen anderer Geraete. Genau so blieb eine geloeschte
   Kleinigkeit auf dem Handy stehen.
   ============================================================ */
console.log('\n19. Regelmäßiges Nachsehen bei Drive');
{
  const skript = hauptSkript();

  ['taktPruefen', 'taktStarten'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript), 'Funktion ' + f + ' ist definiert');
  });

  const takt = skript.match(/function taktPruefen\([\s\S]*?\n\}/);
  pruefe(takt && /document\.hidden/.test(takt[0]),
         'im Hintergrund wird nicht nachgesehen');
  pruefe(takt && /tokenGueltig\(\)/.test(takt[0]),
         'ohne Anmeldung wird nicht nachgesehen');
  pruefe(takt && /abgleichLaeuft/.test(takt[0]),
         'während eines laufenden Abgleichs wird nicht erneut angestoßen');
  pruefe(takt && /driveSuchen\(\)/.test(takt[0]),
         'zuerst wird nur der Stand bei Drive geholt');
  pruefe(takt && /modifiedTime/.test(takt[0]),
         'der Vergleich läuft über den Änderungszeitpunkt bei Drive');
  pruefe(takt && /lokalOffen/.test(takt[0]),
         'eine wartende lokale Änderung stößt den Abgleich sofort an');

  const start = skript.match(/function starten\(\)[\s\S]*?\n\}/);
  pruefe(start && /taktStarten\(\)/.test(start[0]), 'der Takt wird beim Start angeworfen');

  const starten2 = skript.match(/function taktStarten\([\s\S]*?\n\}/);
  pruefe(starten2 && /clearInterval/.test(starten2[0]),
         'ein alter Takt wird abgeräumt (keine doppelten Uhren)');
  pruefe(starten2 && /setInterval/.test(starten2[0]), 'der Takt läuft über setInterval');

  const wert = skript.match(/ABGLEICH_TAKT\s*=\s*(\d+)/);
  pruefe(wert && Number(wert[1]) >= 15000 && Number(wert[1]) <= 600000,
         'der Takt liegt zwischen 15 Sekunden und zehn Minuten');

  const sichern = skript.match(/function spaeterSichern\([\s\S]*?\n\}/);
  pruefe(sichern && /lokalOffen = true/.test(sichern[0]),
         'eine Änderung setzt den Merker für Unerledigtes');
  const still = skript.match(/function abgleichStill\([\s\S]*?\n\}\n/);
  pruefe(still && /lokalOffen = false/.test(still[0]),
         'ein erfolgreicher Abgleich löscht den Merker');
}

/* ============================================================
   20. Installierbare App und Versionswechsel
   Grund: Ein zu gieriger Service Worker bedient den Neustart mit der
   alten Fassung. Genau daran scheiterte die Aktualisierung frueher,
   bis hin zum Deinstallieren.
   ============================================================ */
console.log('\n20. Installierbare App und Versionswechsel');
{
  const skript = hauptSkript();
  const pfad = require('path').dirname(DATEI);
  const swPfad = require('path').join(pfad, 'sw.js');
  const manifestPfad = require('path').join(pfad, 'manifest.webmanifest');

  pruefe(/<link rel="manifest"/.test(QUELLE), 'das Manifest ist verknüpft');
  pruefe(/apple-touch-icon/.test(QUELLE), 'ein Symbol für iOS ist hinterlegt');
  ['swAnmelden', 'versionPruefen', 'neuLaden', 'neuStreifenZeigen',
   'neuStreifenVerbergen', 'versionTaktStarten'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });
  pruefe(/id="neuStreifen"/.test(QUELLE), 'der Hinweisstreifen liegt im HTML');

  const pruef = skript.match(/function versionPruefen\([\s\S]*?\n\}/);
  pruefe(pruef && /cache: 'no-store'/.test(pruef[0]),
         'die Versionsprüfung geht am Zwischenspeicher vorbei');
  pruefe(pruef && /stand=' \+ Date\.now\(\)/.test(pruef[0]),
         'der Abruf trägt einen Zeitstempel gegen zwischengespeicherte Antworten');
  pruefe(pruef && /APP_VERSION/.test(pruef[0]),
         'verglichen wird gegen die laufende Version');

  const laden = skript.match(/function neuLaden\([\s\S]*?\n\}/);
  pruefe(laden && /speichern\(\)/.test(laden[0]),
         'vor dem Neuladen wird gesichert');
  pruefe(laden && /sofort-uebernehmen/.test(laden[0]),
         'ein wartender Service Worker wird zur Übernahme aufgefordert');
  pruefe(laden && /location\.reload\(\)/.test(laden[0]), 'danach wird neu geladen');

  const start = skript.match(/function starten\(\)[\s\S]*?\n\}/);
  pruefe(start && /swAnmelden\(\)/.test(start[0]), 'der Service Worker wird beim Start angemeldet');
  pruefe(start && /versionPruefen\(false\)/.test(start[0]),
         'beim Start wird still auf eine neue Fassung geprüft');

  if (!fs.existsSync(swPfad)) {
    fail('sw.js liegt nicht neben der App');
  } else {
    const sw = fs.readFileSync(swPfad, 'utf8');
    ok('sw.js liegt neben der App');
    pruefe(/fetch\(anfrage\)\.then/.test(sw) && /catch\(function \(\) \{\s*return caches\.match/.test(sw),
           'der Service Worker fragt erst das Netz und den Vorrat nur ersatzweise');
    pruefe(/skipWaiting\(\)/.test(sw), 'eine neue Fassung übernimmt sofort');
    pruefe(/clients\.claim\(\)/.test(sw), 'die neue Fassung übernimmt offene Fenster');
    pruefe(/adresse\.origin !== self\.location\.origin/.test(sw),
           'fremde Adressen werden nicht abgefangen (Google bleibt unberührt)');
    pruefe(/caches\.delete/.test(sw), 'alte Vorräte werden aufgeräumt');
    pruefe(!/caches\.match\(anfrage\)\.then\(function \(gefunden\) \{\s*if \(gefunden\) \{ return gefunden; \}\s*return fetch/.test(sw),
           'kein Vorrat-zuerst für die App selbst');
  }

  if (!fs.existsSync(manifestPfad)) {
    fail('manifest.webmanifest liegt nicht neben der App');
  } else {
    let m = null;
    try { m = JSON.parse(fs.readFileSync(manifestPfad, 'utf8')); } catch (e) { m = null; }
    pruefe(!!m, 'das Manifest ist gültiges JSON');
    if (m) {
      pruefe(m.display === 'standalone', 'die App startet als eigenes Fenster');
      pruefe(/workbench\.html$/.test(m.start_url || ''),
             'die Startadresse zeigt auf die App');
      const groessen = (m.icons || []).map(function (i) { return i.sizes; });
      pruefe(groessen.indexOf('192x192') >= 0 && groessen.indexOf('512x512') >= 0,
             'beide für die Installation nötigen Symbolgrößen sind vorhanden');
      const maskierbar = (m.icons || []).filter(function (i) {
        return String(i.purpose || '').indexOf('maskable') >= 0;
      });
      pruefe(maskierbar.length > 0, 'ein maskierbares Symbol für Android ist dabei');
      (m.icons || []).forEach(function (i) {
        const p = require('path').join(pfad, String(i.src).replace('./', ''));
        pruefe(fs.existsSync(p), 'Symboldatei ' + i.src + ' liegt vor');
      });
    }
  }
}

/* ============================================================
   21. Titel aendern
   Grund: Ein Vertipper darf kein Loeschen und Neuanlegen erfordern.
   Und ein leergeraeumtes Feld darf keine namenlose Aufgabe hinterlassen.
   ============================================================ */
console.log('\n21. Titel ändern');
{
  const skript = hauptSkript();

  ['titelAendern', 'titelTaste'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });
  pruefe(/id="asTitel"/.test(skript), 'die Aktionsfläche enthält ein Titelfeld');
  pruefe(/class="as-titelfeld"/.test(skript), 'das Titelfeld ist als solches gestaltet');

  const aendern = skript.match(/function titelAendern\([\s\S]*?\n\}/);
  pruefe(aendern && /geaendert = jetzt\(\)/.test(aendern[0]),
         'eine Titeländerung setzt den Änderungsstempel');
  pruefe(aendern && /spaeterSichern\(\)/.test(aendern[0]),
         'die Änderung wird gesichert und abgeglichen');

  const schliessen = skript.match(/function aktionenSchliessen\([\s\S]*?\n\}/);
  pruefe(schliessen && /titelVorher/.test(schliessen[0]),
         'ein leerer Titel fällt auf den vorherigen zurück');
  pruefe(schliessen && /trim\(\)\.length === 0/.test(schliessen[0]),
         'geprüft wird auf einen leeren Titel, nicht auf einen falschen Wert');
  pruefe(schliessen && /tagZeichnen\(\)/.test(schliessen[0]),
         'nach dem Schließen wird der Tag neu gezeichnet');

  const taste = skript.match(/function titelTaste\([\s\S]*?\n\}/);
  pruefe(taste && /'Enter'/.test(taste[0]), 'die Eingabetaste schließt die Fläche');

  /* Kein doppeltes Zeichnen mehr in den Aktionen */
  const schieben = skript.match(/function aufgabeSchieben\([\s\S]*?\n\}/);
  pruefe(schieben && (schieben[0].match(/tagZeichnen\(\)/g) || []).length <= 1,
         'Verschieben zeichnet den Tag nicht doppelt');
}

/* ============================================================
   22. Aufgabenflaeche und Detailflaeche
   Grund: Hier liegt der gesamte Bestand. Eine falsche Gruppierung
   oder ein Feld, das nicht speichert, faellt erst auf, wenn Arbeit
   verlorengegangen ist.
   ============================================================ */
console.log('\n22. Aufgabenfläche und Detailfläche');
{
  const api = globalThis.__aufApi;
  const skript = hauptSkript();

  const noetig = ['aufZeichnen', 'setAufGruppe', 'setAufFilter', 'aufGruppeVon',
                  'aufReihenfolge', 'aufMetaText', 'regelText', 'planungText',
                  'planungKlasse', 'planungWeiter', 'aufgabeErledigen', 'aufgabeNeu',
                  'themenFuer', 'projekteFuer', 'wochenEnde',
                  'detailHtml', 'detailNeuZeichnen', 'detailGeaendert',
                  'dKontext', 'dArt', 'dThema', 'dProjekt', 'dFrist', 'dPlanung',
                  'dZeit', 'dBeschreibung', 'dWdh', 'dWdhIntervall', 'dWdhTag',
                  'dWdhMonatstag', 'themaNeuZeigen', 'themaAnlegen',
                  'teilenZeigen', 'teilenTippen', 'teilenUebernehmen',
                  'themaKontext', 'projektKontext'];
  noetig.forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript), 'Funktion ' + f + ' ist definiert');
  });

  pruefe(/id="schirmAufgaben"/.test(QUELLE), 'der Aufgabenbildschirm liegt im HTML');
  pruefe(/id="aufBlatt"/.test(QUELLE), 'die Liste hat einen Behälter');
  pruefe(/id="gPlanung"/.test(QUELLE) && /id="gThema"/.test(QUELLE)
         && /id="gProjekt"/.test(QUELLE) && /id="gFrist"/.test(QUELLE),
         'alle vier Gruppierungen haben einen Knopf');

  if (!api) {
    warn('Aufgabenfunktionen nicht auswertbar');
  } else {
    const heute = api.isoDatum();
    const gestern = api.tagePlus(heute, -1);
    const morgen = api.tagePlus(heute, 1);

    /* Gruppierung nach Planung */
    pruefe(api.gruppeVonPlanung({ planung: 'backlog' }) === 'Backlog', 'Backlog wird erkannt');
    pruefe(api.gruppeVonPlanung({ planung: 'woche' }) === 'Diese Woche', 'Woche wird erkannt');
    pruefe(api.gruppeVonPlanung({ planung: heute }) === 'Heute', 'Heute wird erkannt');
    pruefe(api.gruppeVonPlanung({ planung: morgen }) === 'Fest geplant', 'Späteres wird erkannt');
    pruefe(api.gruppeVonPlanung({ planung: gestern }) === 'Liegengeblieben',
           'ein vergangener Tag heißt liegengeblieben, nicht heute');

    /* Gruppierung nach Frist */
    pruefe(api.gruppeVonFrist({ frist: '' }) === 'Ohne Frist', 'ohne Frist');
    pruefe(api.gruppeVonFrist({ frist: gestern }) === 'Überfällig', 'überfällig');
    pruefe(api.gruppeVonFrist({ frist: '2099-01-01' }) === 'Später fällig', 'später fällig');

    /* Wochenende: Sonntag bleibt in derselben Woche */
    pruefe(api.wochenEnde('2026-09-08') === '2026-09-13', 'die Woche endet am Sonntag');
    pruefe(api.wochenEnde('2026-09-13') === '2026-09-13', 'ein Sonntag endet an sich selbst');

    /* Regeltext */
    pruefe(api.regelText({ takt: 'woche', intervall: 1, tage: [1, 5], tag: 1 })
             === 'jede Woche · Mo Fr',
           'die Wochenregel wird lesbar beschrieben');
    pruefe(api.regelText({ takt: 'woche', intervall: 1, tage: [0, 1], tag: 1 })
             === 'jede Woche · Mo So',
           'Sonntag steht am Ende der Woche');
    pruefe(api.regelText({ takt: 'monat', intervall: 2, tage: [], tag: 15 })
             === 'jeden 2. Monat · am 15.',
           'die Monatsregel wird lesbar beschrieben');

    /* Planung weiterschalten */
    pruefe(api.planungText({ planung: 'backlog' }) === 'Backlog', 'Beschriftung Backlog');
    pruefe(api.planungText({ planung: 'woche' }) === 'Woche', 'Beschriftung Woche');
    pruefe(api.planungKlasse({ planung: heute }) === ' tag', 'ein Tag wird hervorgehoben');
  }

  /* Jede Änderung muss stempeln und sichern */
  const geaendert = skript.match(/function detailGeaendert\([\s\S]*?\n\}/);
  pruefe(geaendert && /geaendert = jetzt\(\)/.test(geaendert[0]),
         'jede Feldänderung setzt den Änderungsstempel');
  pruefe(geaendert && /spaeterSichern\(\)/.test(geaendert[0]),
         'jede Feldänderung wird gesichert und abgeglichen');

  /* Kontextwechsel räumt fremde Zuordnungen weg */
  const kontext = skript.match(/function dKontext\([\s\S]*?\n\}/);
  pruefe(kontext && /themaId = null/.test(kontext[0]) && /projektId = null/.test(kontext[0]),
         'ein Kontextwechsel entfernt Thema und Projekt des anderen Kontexts');

  /* Regel ohne Wochentag schaltet sich ab */
  const wdhTag = skript.match(/function dWdhTag\([\s\S]*?\n\}/);
  pruefe(wdhTag && /tage\.length === 0/.test(wdhTag[0]) && /wiederholung = null/.test(wdhTag[0]),
         'der letzte abgewählte Wochentag schaltet die Regel ab');

  /* Aufteilen hinterlässt einen Löschvermerk */
  const teilen = skript.match(/function teilenUebernehmen\([\s\S]*?\n\}/);
  pruefe(teilen && /grabsteinSetzen\('aufgaben'/.test(teilen[0]),
         'beim Aufteilen bekommt die ursprüngliche Aufgabe einen Löschvermerk');
  pruefe(teilen && /vorlage\.kontext/.test(teilen[0]),
         'die neuen Aufgaben erben den Kontext');

  /* Erledigtes verschwindet aus der Liste */
  const zeichnen = skript.match(/function aufZeichnen\([\s\S]*?\n\}\n/);
  pruefe(zeichnen && /status === 'erledigt'/.test(zeichnen[0]),
         'erledigte Aufgaben stehen nicht in der Liste');
}

/* ============================================================
   23. Aufrufe im Skript selbst
   Grund: markiere() wurde aufgerufen, aber nie definiert — die App
   waere beim ersten Umschalten stehengeblieben. Die bisherige
   Pruefung sah nur Aufrufe aus dem HTML.
   ============================================================ */
console.log('\n23. Aufrufe im Skript selbst');
{
  const roh = hauptSkript();

  /* Kommentare und Zeichenketten heraus, sonst gelten Wörter aus Texten
     wie „Konflikt(e)" als Funktionsaufruf. */
  const skript = roh
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');

  const definiert = new Set([...roh.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]));
  const zugewiesen = new Set([...roh.matchAll(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]));

  /* Parameternamen zählen als bekannt */
  const parameter = new Set();
  [...roh.matchAll(/function\s*[A-Za-z_$\w]*\s*\(([^)]*)\)/g)].forEach(function (m) {
    String(m[1]).split(',').forEach(function (p) {
      const name = p.trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) { parameter.add(name); }
    });
  });

  const bekannt = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function', 'else', 'do',
    'Promise', 'Date', 'Number', 'String', 'Boolean', 'Array', 'Object', 'JSON', 'Math',
    'Error', 'RegExp', 'Set', 'Map', 'URL', 'FileReader', 'parseInt', 'parseFloat',
    'isNaN', 'encodeURIComponent', 'decodeURIComponent', 'fetch', 'caches', 'eval'
  ]);

  const fehlend = [];
  const gesehen = new Set();
  const muster = /(^|[^\w$.])([a-zA-Z_$][\w$]*)\s*\(/g;
  let treffer;
  while ((treffer = muster.exec(skript)) !== null) {
    const name = treffer[2];
    if (gesehen.has(name)) { continue; }
    gesehen.add(name);
    if (definiert.has(name) || zugewiesen.has(name) || parameter.has(name)
        || bekannt.has(name)) { continue; }
    fehlend.push(name);
  }

  pruefe(fehlend.length === 0,
         'keine Aufrufe undefinierter Funktionen'
         + (fehlend.length ? ' — gefunden: ' + fehlend.join(', ') : ''));
  ok(gesehen.size + ' verschiedene Aufrufe geprüft');
}

/* ============================================================
   24. Wiederkehrende Aufgaben haben keinen Erledigt-Status
   Grund: Aus dem Altbestand trugen sie „erledigt" und verschwanden
   damit fuer immer aus der Liste — obwohl sie jede Woche wiederkehren.
   ============================================================ */
console.log('\n24. Status wiederkehrender Aufgaben');
{
  const skript = hauptSkript();

  const mig = skript.match(/function migrationRechnen\([\s\S]*?\n\}\n/);
  pruefe(mig && /a\.wiederholung \|\| a\.status !== 'erledigt'/.test(mig[0]),
         'die Migration setzt wiederkehrende Aufgaben auf offen');

  const stempeln = skript.match(/function bestandStempeln\([\s\S]*?\n\}/);
  pruefe(stempeln && /wiederholung && aufg\[w\]\.status === 'erledigt'/.test(stempeln[0]),
         'ein vorhandener Bestand wird beim Laden richtiggestellt');
  pruefe(stempeln && /zuletztErledigt/.test(stempeln[0]),
         'das Erledigtdatum wandert dabei nach zuletztErledigt');

  const zeichnen = skript.match(/function aufZeichnen\([\s\S]*?\n\}\n/);
  pruefe(zeichnen && /!alle\[i\]\.wiederholung && alle\[i\]\.status === 'erledigt'/.test(zeichnen[0]),
         'die Liste blendet nur einmalige erledigte Aufgaben aus');

  const api = globalThis.__aufApi;
  if (globalThis.__api && globalThis.__api.migrationRechnen) {
    const quelle = {
      name: 't.json', art: 'workassist', kontext: 'beruflich',
      daten: {
        bereiche: [], plaene: [], jahrestermine: [],
        aufgaben: [{ id: 'w1', titel: 'Wöchentlich', status: 'erledigt',
                     erledigtAm: '2026-09-01',
                     wiederholung: { typ: 'woechentlich', intervall: 1, wochentage: [1] } },
                   { id: 'e1', titel: 'Einmalig', status: 'erledigt', erledigtAm: '2026-09-01' }]
      }
    };
    const e = globalThis.__api.migrationRechnen([quelle]);
    const w = e.ziel.aufgaben.filter(a => a.titel === 'Wöchentlich')[0];
    const einmal = e.ziel.aufgaben.filter(a => a.titel === 'Einmalig')[0];
    pruefe(w && w.status === 'offen', 'die wiederkehrende Aufgabe kommt als offen an');
    pruefe(einmal && einmal.status === 'erledigt', 'die einmalige bleibt erledigt');
  } else {
    warn('Migrationsfunktionen nicht auswertbar');
  }
}

/* ============================================================
   25. Wiederkehrende Aufgaben haben keine Frist
   Grund: In WorkAssist war „faellig" bei wiederkehrenden Aufgaben
   das naechste Vorkommen der Instanz. Als Frist uebernommen ergibt
   das einen falschen und irrefuehrenden Termin.
   ============================================================ */
console.log('\n25. Frist bei wiederkehrenden Aufgaben');
{
  const skript = hauptSkript();

  const mig = skript.match(/function migrationRechnen\([\s\S]*?\n\}\n/);
  pruefe(mig && /a\.wiederholung \? '' : \(a\.faellig/.test(mig[0]),
         'die Migration übernimmt bei wiederkehrenden Aufgaben keine Frist');

  const stempeln = skript.match(/function bestandStempeln\([\s\S]*?\n\}/);
  pruefe(stempeln && /wiederholung && aufg\[w\]\.frist/.test(stempeln[0]),
         'ein bereits übernommener Bestand wird beim Laden bereinigt');

  const detail = skript.match(/function detailHtml\([\s\S]*?\n\}\n/);
  pruefe(detail && /entscheidet die Regel/.test(detail[0]),
         'die Detailfläche zeigt statt eines Fristfeldes den Hinweis auf die Regel');

  const wdh = skript.match(/function dWdh\([\s\S]*?\n\}/);
  pruefe(wdh && /a\.frist = ''/.test(wdh[0]),
         'das Einschalten einer Regel räumt eine bestehende Frist weg');

  const meta = skript.match(/function aufMetaText\([\s\S]*?\n\}/);
  pruefe(meta && /a\.frist && !a\.wiederholung/.test(meta[0]),
         'die Liste zeigt bei wiederkehrenden Aufgaben keine Frist');
  const metaTag = skript.match(/function metaZeile\([\s\S]*?\n\}/);
  pruefe(metaTag && /a\.frist && !a\.wiederholung/.test(metaTag[0]),
         'auch der Tagesplan zeigt dort keine Frist');

  const frist = skript.match(/function gruppeVonFrist\([\s\S]*?\n\}/);
  pruefe(frist && /a\.wiederholung.*'Wiederkehrend'/s.test(frist[0]),
         'nach Frist gruppiert stehen sie in einer eigenen Gruppe');

  if (globalThis.__api && globalThis.__api.migrationRechnen) {
    const e = globalThis.__api.migrationRechnen([{
      name: 't.json', art: 'workassist', kontext: 'beruflich',
      daten: { bereiche: [], plaene: [], jahrestermine: [], aufgaben: [
        { id: 'w1', titel: 'Wöchentlich', status: 'offen', faellig: '2026-09-14',
          wiederholung: { typ: 'woechentlich', intervall: 1, wochentage: [1] } },
        { id: 'e1', titel: 'Einmalig', status: 'offen', faellig: '2026-09-14' } ] }
    }]);
    const w = e.ziel.aufgaben.filter(a => a.titel === 'Wöchentlich')[0];
    const einmal = e.ziel.aufgaben.filter(a => a.titel === 'Einmalig')[0];
    pruefe(w && w.frist === '', 'die wiederkehrende Aufgabe kommt ohne Frist an');
    pruefe(einmal && einmal.frist === '2026-09-14', 'die einmalige behält ihre Frist');
  }
}

/* ============================================================
   26. Erledigtes in der Aufgabenflaeche
   Grund: Erledigtes gehoert nicht in die Arbeitsliste, darf aber
   auch nicht spurlos verschwinden — und es darf die Liste nicht
   ueberschwemmen.
   ============================================================ */
console.log('\n26. Erledigtes in der Aufgabenfläche');
{
  const skript = hauptSkript();

  ['erledigteSammeln', 'erledigtBlockHtml', 'aufErledigtUm',
   'aufgabeWiederOeffnen'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  const sammeln = skript.match(/function erledigteSammeln\([\s\S]*?\n\}/);
  pruefe(sammeln && /a\.wiederholung.*continue/s.test(sammeln[0]),
         'wiederkehrende Aufgaben stehen nie im Erledigt-Block');
  pruefe(sammeln && /aufFilter/.test(sammeln[0]),
         'der Kontextfilter wirkt auch auf Erledigtes');
  pruefe(sammeln && /erledigtAm/.test(sammeln[0]),
         'sortiert wird nach dem Erledigtdatum');

  const block = skript.match(/function erledigtBlockHtml\([\s\S]*?\n\}\n/);
  pruefe(block && /ERLEDIGT_ZEIGEN/.test(block[0]),
         'die Zahl der gezeigten Einträge ist begrenzt');
  pruefe(block && /aufErledigtAuf/.test(block[0]),
         'der Block ist ein- und ausklappbar');
  pruefe(block && /weitere, ältere/.test(block[0]),
         'bei Überlänge wird gesagt, wie viele fehlen');

  const zeichnen = skript.match(/function aufZeichnen\([\s\S]*?\n\}\n/);
  pruefe(zeichnen && /erledigtBlockHtml\(\)/.test(zeichnen[0]),
         'der Block hängt in jeder Gruppierung am Ende');

  const wieder = skript.match(/function aufgabeWiederOeffnen\([\s\S]*?\n\}/);
  pruefe(wieder && /status = 'offen'/.test(wieder[0]) && /erledigtAm = null/.test(wieder[0]),
         'ein Häkchen im Erledigt-Block öffnet die Aufgabe wieder');
  pruefe(wieder && /geaendert = jetzt\(\)/.test(wieder[0]),
         'das Wiederöffnen stempelt und wird abgeglichen');

  const grenze = skript.match(/ERLEDIGT_ZEIGEN\s*=\s*(\d+)/);
  pruefe(grenze && Number(grenze[1]) >= 10 && Number(grenze[1]) <= 200,
         'die Grenze liegt zwischen 10 und 200 Einträgen');
}

/* ============================================================
   27. Aufgabe anlegen ueber den Plusknopf
   Grund: Ein Eingabefeld ohne Rahmen wurde als Ueberschrift gelesen.
   Und eine ueber den Knopf angelegte Aufgabe darf nicht namenlos
   zurueckbleiben, wenn der Dialog ohne Eingabe geschlossen wird.
   ============================================================ */
console.log('\n27. Aufgabe anlegen');
{
  const skript = hauptSkript();

  pruefe(new RegExp('function\\s+aufgabeNeu\\s*\\(').test(skript), 'Funktion aufgabeNeu ist definiert');
  pruefe(/class="plusknopf"/.test(QUELLE), 'der Plusknopf liegt im Aufgabenbildschirm');
  pruefe(/onclick="aufgabeNeu\(\)"/.test(QUELLE), 'der Plusknopf legt eine Aufgabe an');
  pruefe(/aria-label="Neue Aufgabe"/.test(QUELLE), 'der Knopf ist beschriftet');
  pruefe(/\.plusknopf\{[^}]*position:fixed/.test(QUELLE), 'der Knopf liegt fest über der Liste');

  const neu = skript.match(/function aufgabeNeu\([\s\S]*?\n\}/);
  pruefe(neu && /aufgabeAktionen\(/.test(neu[0]),
         'nach dem Anlegen öffnet sich sofort die Detailfläche');
  pruefe(neu && /frischAngelegt = /.test(neu[0]),
         'die Neuanlage wird vermerkt');
  pruefe(neu && /planung: 'backlog'/.test(neu[0]),
         'eine neue Aufgabe landet im Backlog');
  pruefe(neu && /aufFilter === 'privat'/.test(neu[0]),
         'der gewählte Filter bestimmt den Kontext');
  pruefe(neu && /focus\(\)/.test(neu[0]),
         'der Schreibbalken steht im Titelfeld');

  const schliessen = skript.match(/function aktionenSchliessen\([\s\S]*?\n\}/);
  pruefe(schliessen && /aktionFuer === frischAngelegt/.test(schliessen[0]),
         'beim Schließen wird die Neuanlage erkannt');
  pruefe(schliessen && /splice\(stelle, 1\)/.test(schliessen[0]),
         'eine namenlos gebliebene Neuanlage wird entfernt');
  pruefe(schliessen && /grabsteinSetzen\('aufgaben'/.test(schliessen[0]),
         'dabei entsteht ein Löschvermerk, damit sie nicht zurückkehrt');
  pruefe(schliessen && /frischAngelegt = ''/.test(schliessen[0]),
         'der Vermerk wird danach zurückgesetzt');

  /* Im Tagesplan bleibt die Schnelleingabe */
  pruefe(/id="schnellFeld"/.test(QUELLE), 'der Tagesplan behält seine Schnelleingabe');
  pruefe(!/id="aufFeld"/.test(QUELLE), 'die Aufgabenfläche hat keine Schnelleingabe mehr');
}

/* ============================================================
   28. Google Kalender lesen
   Grund: Termine gehoeren Google. Sie duerfen nie in die eigene
   Datei geraten — sonst gibt es zwei Wahrheiten. Und ein einzelner
   unlesbarer Kalender darf nicht alle anderen verhindern.
   ============================================================ */
console.log('\n28. Google Kalender lesen');
{
  const skript = hauptSkript();
  const api = globalThis.__kalApi;

  const noetig = ['kalenderListeHolen', 'termineHolen', 'einenKalenderHolen',
                  'termineFuerTag', 'eintraegeEinsortieren', 'merkeTermin',
                  'zeitAusEintrag', 'tagAusEintrag', 'kalenderUm', 'kalenderGewaehlt',
                  'kalenderNeuLesen', 'zeichneKalender', 'ganztagsZeichnen',
                  'kalenderTaktStarten', 'termineZahl'];
  noetig.forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  /* Nur lesend */
  pruefe(!/calendar\/v3[^']*'\s*,\s*\{\s*method:\s*'(POST|PATCH|PUT|DELETE)/.test(skript),
         'am Kalender wird nichts geschrieben');
  const holen = skript.match(/function einenKalenderHolen\([\s\S]*?\n\}/);
  pruefe(holen && /singleEvents=true/.test(holen[0]),
         'Serien werden zu einzelnen Vorkommen aufgelöst');
  pruefe(holen && /catch\(/.test(holen[0]),
         'ein unlesbarer Kalender verhindert die anderen nicht');

  /* Termine niemals in die eigene Datei */
  const leer = skript.match(/function leereDatenbank\([\s\S]*?\n\}/);
  pruefe(leer && !/termineNachTag/.test(leer[0]),
         'die gelesenen Termine stehen nicht im Datenmodell');
  const alsText = skript.match(/function alsText\([\s\S]*?\n\}/);
  pruefe(alsText && !/termineNachTag/.test(alsText[0]),
         'sie werden nicht in die Datei geschrieben');
  const samm = skript.match(/var SAMMLUNGEN = \[([\s\S]*?)\];/);
  /* kalenderzuordnung ist erlaubt — sie speichert die Artzuordnung,
     nicht die Termine selbst. */
  pruefe(samm && !/termine[A-Za-zÄÖÜäöü]/.test(samm[1]),
         'keine Sammlung führt gelesene Termine');
  const zuo = skript.match(/function zusammenfuehren\([\s\S]*?\n\}\n/);
  pruefe(zuo && !/termineNachTag/.test(zuo[0]),
         'der Abgleich fasst gelesene Termine nicht an');

  if (!api) {
    warn('Kalenderfunktionen nicht auswertbar');
  } else {
    api.zuruecksetzen();

    /* Ganztägig: Google nennt als Ende den Folgetag */
    api.eintraegeEinsortieren([{
      id: 'g1', summary: 'Urlaub', start: { date: '2026-08-03' }, end: { date: '2026-08-06' }
    }], 'Familie');
    pruefe(api.termineFuerTag('2026-08-03').ganztags.length === 1, 'der erste Urlaubstag zählt');
    pruefe(api.termineFuerTag('2026-08-05').ganztags.length === 1, 'der letzte Urlaubstag zählt');
    pruefe(api.termineFuerTag('2026-08-06').ganztags.length === 0,
           'der Folgetag des Endes zählt nicht mehr');

    /* Abgesagtes wird übergangen */
    api.eintraegeEinsortieren([{
      id: 'g2', summary: 'Abgesagt', status: 'cancelled',
      start: { dateTime: '2026-09-08T10:00:00+02:00' }, end: { dateTime: '2026-09-08T11:00:00+02:00' }
    }], 'Beruf');
    pruefe(api.termineFuerTag('2026-09-08').zeit.length === 0, 'abgesagte Termine erscheinen nicht');

    /* Zeiten und Sortierung */
    api.eintraegeEinsortieren([
      { id: 'g4', summary: 'Spät', start: { dateTime: '2026-09-08T14:00:00+02:00' },
        end: { dateTime: '2026-09-08T15:00:00+02:00' } },
      { id: 'g3', summary: 'Früh', start: { dateTime: '2026-09-08T09:00:00+02:00' },
        end: { dateTime: '2026-09-08T09:30:00+02:00' }, location: 'Raum 2.14' }
    ], 'Beruf');
    const t = api.termineFuerTag('2026-09-08').zeit;
    pruefe(t.length === 2, 'beide Termine sind da');
    pruefe(t[0].titel === 'Früh', 'sortiert wird nach der Uhrzeit');
    pruefe(t[0].ort === 'Raum 2.14', 'der Ort wird übernommen');
    pruefe(t[0].quelle === 'Beruf', 'der Kalendername wird mitgeführt');

    /* Derselbe Termin zweimal geliefert: nur einmal merken */
    api.eintraegeEinsortieren([
      { id: 'g3', summary: 'Früh', start: { dateTime: '2026-09-08T09:00:00+02:00' },
        end: { dateTime: '2026-09-08T09:30:00+02:00' } }
    ], 'Beruf');
    pruefe(api.termineFuerTag('2026-09-08').zeit.length === 2, 'Dubletten werden nicht doppelt geführt');

    /* Ohne Startzeit wird übergangen */
    api.eintraegeEinsortieren([{ id: 'g9', summary: 'Kaputt' }], 'Beruf');
    pruefe(api.termineFuerTag('2026-09-08').zeit.length === 2, 'ein Eintrag ohne Start wird übergangen');
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
