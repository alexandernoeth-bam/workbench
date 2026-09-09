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
                 + ' tagesEintraege, ausIso, tagePlus };';
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
  pruefe(!/onclick="aufgabeLoeschen\(/.test(QUELLE.replace(/as-knopf gefahr[\s\S]{0,120}/g, '')),
         'Löschen steht nur in der Aktionsfläche, nicht in der Liste');
  const akt = skript.match(/function aufgabeAktionen\([\s\S]*?\n\}/);
  pruefe(akt && /as-knopf gefahr/.test(akt[0]),
         'der Löschknopf ist als gefährlich ausgezeichnet');

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
   ERGEBNIS
   ============================================================ */
console.log('\n============================================================');
console.log('ERGEBNIS   ok: ' + anzOk + '   FAIL: ' + anzFail + '   warn: ' + anzWarn);
console.log('Datei: ' + DATEI);
console.log('============================================================\n');

process.exit(anzFail > 0 ? 1 : 0);
