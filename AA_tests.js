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

  /* Absichtlich versteckte Bildschirme: kein Knopf in der Leiste, aber
     nachweislich anders erreichbar. */
  const VERSTECKT = ['Migration'];
  schirme.forEach(function (s) {
    if (VERSTECKT.indexOf(s) >= 0) {
      pruefe(navs.indexOf(s) < 0,
             'Bildschirm "' + s + '" steht bewusst nicht in der Leiste');
      pruefe(QUELLE.indexOf("zeigeSchirm('" + s + "')") >= 0,
             'Bildschirm "' + s + '" bleibt anders erreichbar');
      return;
    }
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
  /* Tag und Kalender melden über eigene Wege (Standzeile, Banner) und
     bleiben im Normalfall bewusst stumm. Die übrigen Flächen führen
     Vorgänge aus, deren Ergebnis benannt werden muss. */
  const mitMelder = ['Diagnose', 'Migration', 'Aufgaben'];
  mitMelder.forEach(function (s) {
    if (schirme.indexOf(s) < 0) { return; }
    const block = QUELLE.match(new RegExp('id="schirm' + s + '"[\\s\\S]*?\\n</div>'));
    pruefe(!block || /class="melder"/.test(block[0]),
           'Bildschirm "' + s + '" hat eine eigene Meldezeile');
  });
  const kalBlock = QUELLE.match(/id="schirmKalender"[\s\S]*?\n<\/div>/);
  pruefe(!kalBlock || !/class="melder"/.test(kalBlock[0]),
         'der Kalender bleibt bewusst ohne Meldezeile');
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
  const OHNE_KNOPF = ['Migration'];
  schirme.forEach(function (s) {
    if (OHNE_KNOPF.indexOf(s) >= 0) {
      pruefe(imHtml.has('schirm' + s), 'ID schirm' + s + ' existiert (ohne Knopf)');
      return;
    }
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
  /* „termine" ist mit v0.15.0 entfallen: berufliche Termine stehen im
     Google-Kalender, eine zweite Wahrheit soll es nicht geben. */
  const erwartet = ['aufgaben', 'ziele', 'themen', 'projekte', 'ablaeufe',
                    'durchlaeufe', 'jahrestermine', 'ferien', 'kalenderzuordnung'];

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
  pruefe(/' · v' \+ APP_VERSION/.test(QUELLE),
         'Version steht sichtbar im Tageskopf');
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
                 + ' tagesEintraege, ausIso, tagePlus,'
                 + ' pruefeVerlauf: function(){'
                 + '   var alt = DB;'
                 + '   DB = leereDatenbank();'
                 + '   var regel = { takt:\'woche\', intervall:1, tage:[0,1,2,3,4,5,6], tag:1 };'
                 + '   DB.aufgaben = ['
                 + '     { id:\'r1\', titel:\'Mit Zeit\', kontext:\'beruflich\', uhrzeit:\'07:30\','
                 + '       wiederholung: regel, status:\'offen\', planung:\'backlog\' },'
                 + '     { id:\'r2\', titel:\'Ohne Zeit\', kontext:\'beruflich\', uhrzeit:\'\','
                 + '       wiederholung: regel, status:\'offen\', planung:\'backlog\' } ];'
                 + '   var e = tagesEintraege(isoDatum());'
                 + '   DB = alt;'
                 + '   return { mitZeit: e.verlauf.length, ohneZeit: e.wieder.length };'
                 + ' } };'
                 + 'globalThis.__aufApi = { gruppeVonPlanung, gruppeVonFrist, wochenEnde,'
                 + ' regelText, planungText, planungKlasse, isoDatum, tagePlus,'
                 + ' themenFuer, projekteFuer };'
                 + 'globalThis.__kalApi = { eintraegeEinsortieren, termineFuerTag, termineZahl,'
                 + ' zeitAusEintrag, tagAusEintrag,'
                 + ' zuruecksetzen: function(){ termineNachTag = {}; } };'
                 + 'globalThis.__fehlerApi = { dienstAusAdresse, antwortPruefen };'
                 + 'globalThis.__filterApi = { passtZumTag, setTagFilter, kalenderKontext,'
                 + ' passtZumKalender, setKalFilter };'
                 + 'globalThis.__jtApi = { jtKuerzel };'
                 + 'globalThis.__msApi = {'
                 + ' pruefeMs: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   DB.projekte = [{ id:\'p1\', name:\'P\', kontext:\'privat\','
                 + '     status:\'laufend\', zielzustaende:[], anlagen:[], meilensteine:['
                 + '       { titel:\'A\', datum:\'2026-01-10\', erreicht:false },'
                 + '       { titel:\'B\', datum:\'\', erreicht:false },'
                 + '       { titel:\'C\', datum:\'2026-02-20\', erreicht:false } ] }];'
                 + '   vhDetail = \'p1\'; vhDetailArt = \'projekt\';'
                 + '   vhMsHoch(1);'
                 + '   var nachHoch = DB.projekte[0].meilensteine[0].titel;'
                 + '   vhMsHoch(0);'
                 + '   var erstes = DB.projekte[0].meilensteine[0].titel;'
                 + '   vhMsOrdnen();'
                 + '   var reihe = DB.projekte[0].meilensteine.map(function(x){ return x.titel; }).join(\',\');'
                 + '   var letztes = DB.projekte[0].meilensteine[2].titel;'
                 + '   var db2 = leereDatenbank();'
                 + '   db2.projekte = [{ id:\'p2\', meilensteine:['
                 + '     { titel:\'Fertig\', datum:\'7.3.2026\' },'
                 + '     { titel:\'Abnahme\', datum:\'kurz vor Ostern\' } ] }];'
                 + '   bestandStempeln(db2);'
                 + '   var deutsch = db2.projekte[0].meilensteine[0].datum;'
                 + '   var gerettet = db2.projekte[0].meilensteine[1].titel;'
                 + '   var gerettetDatum = db2.projekte[0].meilensteine[1].datum;'
                 + '   vhDetail = \'\'; vhDetailArt = \'\'; DB = alt;'
                 + '   return { nachHoch:nachHoch, erstesBleibt:erstes, geordnet:reihe,'
                 + '            ohneDatumHinten:letztes, deutsch:deutsch,'
                 + '            gerettet:gerettet, gerettetDatum:gerettetDatum };'
                 + ' } };'
                 + 'globalThis.__abApi = {'
                 + ' pruefeAblauf: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   DB.ablaeufe = [{ id:\'v1\', name:\'Vorlage\', kontext:\'beruflich\','
                 + '     schritte:[{id:\'s1\',titel:\'Eins\',auf:false},'
                 + '               {id:\'s2\',titel:\'Zwei\',auf:false}], zuletzt:\'\' }];'
                 + '   durchlaufStarten(\'v1\');'
                 + '   var d = DB.durchlaeufe[0];'
                 + '   var vorher = ablaufSchritteHeute().length;'
                 + '   schrittUm(d.id, 0);'
                 + '   var ersterOffen = offenerSchritt(d).satz.titel;'
                 + '   schrittUm(d.id, 1);'
                 + '   var nachher = ablaufSchritteHeute().length;'
                 + '   var kopiert = (DB.ablaeufe[0].schritte[0].fertig === undefined);'
                 + '   durchlaufBeenden(d.id);'
                 + '   var nachBeenden = DB.durchlaeufe.length;'
                 + '   var steine = DB.grabsteine.length;'
                 + '   rueckgaengig();'
                 + '   var nachZurueck = DB.durchlaeufe.length;'
                 + '   var steineDanach = DB.grabsteine.length;'
                 + '   DB.ablaeufe = [];'
                 + '   abDetail = DB.durchlaeufe[0].id; abDetailArt = \'durchlauf\';'
                 + '   vorlageAusDurchlauf();'
                 + '   var vorlagen = DB.ablaeufe.length;'
                 + '   abDetail = \'\'; abDetailArt = \'\'; zurueckHolen = null; DB = alt;'
                 + '   return { ersterOffen:ersterOffen, imTagVorher:vorher,'
                 + '            imTagNachher:nachher, kopiert:kopiert,'
                 + '            nachBeenden:nachBeenden, grabsteine:steine,'
                 + '            nachZurueck:nachZurueck, grabsteineDanach:steineDanach,'
                 + '            vorlagenNachSichern:vorlagen };'
                 + ' } };'
                 + 'globalThis.__vhApi = {'
                 + ' pruefeVorhaben: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   var p = { id:\'p1\', name:\'Garage\', kontext:\'privat\','
                 + '     status:\'laufend\', meilensteine:[], zielzustaende:[], anlagen:[] };'
                 + '   DB.projekte = [p];'
                 + '   DB.aufgaben = ['
                 + '     { id:\'a1\', titel:\'Angebot\', projektId:\'p1\', status:\'offen\' },'
                 + '     { id:\'a2\', titel:\'Bagger\', projektId:\'p1\', status:\'offen\' } ];'
                 + '   zustandSetzen(p, \'Fundament steht\');'
                 + '   var satz = zustandText(p);'
                 + '   zustandSetzen(p, \'Fundament steht\');'
                 + '   var zweimal = p.zielzustaende.length;'
                 + '   var leer = fruehereZustaende(p).length;'
                 + '   p.zielzustaende.push({ jahr:2025, kw:40, satz:\'alt\', erreicht:false });'
                 + '   p.zielzustaende.push({ jahr:2025, kw:12, satz:\'aelter\', erreicht:false });'
                 + '   var nach = fruehereZustaende(p).length;'
                 + '   var erste = fruehereZustaende(p)[0].kw;'
                 + '   p.meilensteine = [ { titel:\'Erster\', erreicht:true },'
                 + '                      { titel:\'Zweiter\', erreicht:false } ];'
                 + '   var ms = naechsterMeilenstein(p).titel;'
                 + '   var alleFertig = naechsterMeilenstein({ meilensteine:[{titel:\'x\',erreicht:true}] });'
                 + '   vhDetail = \'p1\'; vhDetailArt = \'projekt\';'
                 + '   vhLoeschen();'
                 + '   var anzahl = DB.aufgaben.length;'
                 + '   var ohne = DB.aufgaben.filter(function(a){ return !a.projektId; }).length;'
                 + '   vhDetail = \'\'; vhDetailArt = \'\'; DB = alt;'
                 + '   return { satzDieseWoche:satz, zweitesMalGleicheWoche:zweimal,'
                 + '            frueherLeer:leer, frueherNach:nach - 1, reihenfolge:erste,'
                 + '            naechsterMs:ms, ohneOffenen:alleFertig,'
                 + '            aufgabenNachLoeschen:anzahl, ohneProjekt:ohne };'
                 + ' } };'
                 + 'globalThis.__jtKontextApi = { jtKontext,'
                 + ' pruefeFilter: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   DB.jahrestermine = ['
                 + '     { id:\'a\', titel:\'Werksbesuch\', art:\'dienstreise\','
                 + '       von:\'2026-03-10\', bis:\'2026-03-10\' },'
                 + '     { id:\'b\', titel:\'Geburtstag Anna\', art:\'geburtstag\','
                 + '       von:\'2026-03-10\', bis:\'2026-03-10\' },'
                 + '     { id:\'c\', titel:\'Kreta\', art:\'urlaub\','
                 + '       von:\'2026-03-10\', bis:\'2026-03-10\' } ];'
                 + '   var merk = kalFilter; var merkJ = jahrFilter; jahrFilter = null;'
                 + '   kalFilter = \'alle\';'
                 + '   var a = jtAn(\'2026-03-10\').filter(jtPasst).length;'
                 + '   kalFilter = \'beruflich\';'
                 + '   var b = jtAn(\'2026-03-10\').filter(jtPasst).length;'
                 + '   kalFilter = \'privat\';'
                 + '   var c = jtAn(\'2026-03-10\').filter(jtPasst).length;'
                 + '   kalFilter = merk; jahrFilter = merkJ; DB = alt;'
                 + '   return { alle:a, beruf:b, privat:c };'
                 + ' } };'
                 + 'globalThis.__monatApi = {'
                 + ' pruefeMonat: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   kalenderListe = [{id:\'a\',name:\'Alex\'},{id:\'b\',name:\'Familie\'}];'
                 + '   termineNachTag = {};'
                 + '   eintraegeEinsortieren(['
                 + '     {id:\'e1\',summary:\'A\',start:{dateTime:\'2026-09-08T08:30:00+02:00\'},end:{dateTime:\'2026-09-08T09:00:00+02:00\'}},'
                 + '     {id:\'e2\',summary:\'B\',start:{dateTime:\'2026-09-08T10:00:00+02:00\'},end:{dateTime:\'2026-09-08T11:00:00+02:00\'}},'
                 + '     {id:\'e3\',summary:\'C\',start:{dateTime:\'2026-09-08T13:00:00+02:00\'},end:{dateTime:\'2026-09-08T14:00:00+02:00\'}},'
                 + '     {id:\'e4\',summary:\'D\',start:{dateTime:\'2026-09-08T16:00:00+02:00\'},end:{dateTime:\'2026-09-08T17:00:00+02:00\'}}'
                 + '   ], \'Alex\', \'beruflich\');'
                 + '   eintraegeEinsortieren([{id:\'f1\',summary:\'Elternabend\','
                 + '     start:{dateTime:\'2026-09-08T19:00:00+02:00\'},end:{dateTime:\'2026-09-08T20:00:00+02:00\'}}],'
                 + '     \'Familie\', \'privat\');'
                 + '   monatArten = null; monatKalender = null; monatOffeneTage = {};'
                 + '   var h = monatHtml(\'2026-09-01\');'
                 + '   var spalten = (h.match(/mt-oben/g) || []).length;'
                 + '   var t8 = h.split(\'mtag\')[8];'
                 + '   var sichtbar = (t8.match(/mt-termin/g) || []).length;'
                 + '   var mehr = t8.indexOf(\'Termine</button>\') >= 0;'
                 + '   monatOffeneTage[\'2026-09-08\'] = true;'
                 + '   var h2 = monatHtml(\'2026-09-01\');'
                 + '   var auf = (h2.split(\'mtag\')[8].match(/mt-termin/g) || []).length;'
                 + '   monatKalender = { Alex:true, Familie:false };'
                 + '   var h3 = monatHtml(\'2026-09-01\');'
                 + '   var weg = h3.indexOf(\'Elternabend\') < 0;'
                 + '   var zahl = monatFilterZahl();'
                 + '   monatArten = null; monatKalender = null; monatOffeneTage = {};'
                 + '   var zurueck = monatFilterZahl();'
                 + '   monatFilterAllesAus();'
                 + '   var allesAus = monatFilterZahl();'
                 + '   monatGruppeSetzen(\'arten\', true);'
                 + '   var nachGruppe = monatFilterZahl();'
                 + '   monatArten = null; monatKalender = null;'
                 + '   termineNachTag = {}; kalenderListe = []; DB = alt;'
                 + '   return { spalten:spalten, sichtbar:sichtbar, mehrKnopf:mehr,'
                 + '            aufgeklappt:auf, nachAbwahl:weg, zahlNachAbwahl:zahl,'
                 + '            zurueckgesetzt:zurueck, allesAus:allesAus,'
                 + '            nachGruppe:nachGruppe };'
                 + ' } };'
                 + 'globalThis.__jahrApi = { ferienImJahr,'
                 + ' pruefeFerien: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   DB.jahrestermine = [{ id:\'u1\', titel:\'Sommerurlaub\', art:\'urlaub\','
                 + '     von:\'2026-08-03\', bis:\'2026-08-21\', jaehrlich:false }];'
                 + '   DB.ferien = ['
                 + '     { id:\'f1\', titel:\'Frühjahrsferien\', art:\'ferien\','
                 + '       von:\'2026-02-16\', bis:\'2026-02-20\' },'
                 + '     { id:\'f2\', titel:\'Sommerferien\', art:\'ferien\','
                 + '       von:\'2026-08-03\', bis:\'2026-09-14\' },'
                 + '     { id:\'f3\', titel:\'Herbstferien\', art:\'ferien\','
                 + '       von:\'2026-11-02\', bis:\'2026-11-06\' } ];'
                 + '   var merkFilter = jahrFilter;'
                 + '   jahrFilter = null;'
                 + '   var a = (jahrHtml(\'2026-01-01\').match(/<i style="background:/g) || []).length;'
                 + '   jahrFilter = \'ferien\';'
                 + '   var hf = jahrHtml(\'2026-01-01\');'
                 + '   var b = (hf.match(/<i style="background:/g) || []).length;'
                 + '   var l = (hf.match(/jl-zeile/g) || []).length;'
                 + '   jahrFilter = \'urlaub\';'
                 + '   var hu = jahrHtml(\'2026-01-01\');'
                 + '   var c = (hu.match(/<i style="background:/g) || []).length;'
                 + '   var t = hu.indexOf(\'ferien"\') < 0;'
                 + '   var s = ferienImJahr(2026);'
                 + '   jahrFilter = merkFilter; DB = alt;'
                 + '   return { ohneFilter:a, nurFerien:b, ferienListe:l,'
                 + '            andererFilter:c, toenungAus:t, summe:s };'
                 + ' } };'
                 + 'globalThis.__ferienApi = { icsLesen, ferienUebernehmen, ferienAn,'
                 + ' feiertagAn, leereDatenbank, setDB: function(d){ DB = d; } };'
                 + 'globalThis.__kalenderApi = { montagVon, jtAn,'
                 + ' pruefeJaehrlich: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   DB.jahrestermine = ['
                 + '     { id:\'j1\', titel:\'Geburtstag\', art:\'geburtstag\','
                 + '       von:\'2008-03-26\', bis:\'2008-03-26\', jaehrlich:true },'
                 + '     { id:\'j2\', titel:\'Einmalig\', art:\'termin\','
                 + '       von:\'2026-04-01\', bis:\'2026-04-01\', jaehrlich:false },'
                 + '     { id:\'j3\', titel:\'Urlaub\', art:\'urlaub\','
                 + '       von:\'2026-08-03\', bis:\'2026-08-21\', jaehrlich:false } ];'
                 + '   var r = {'
                 + '     imJahr: jtAn(\'2008-03-26\').length > 0,'
                 + '     spaeter: jtAn(\'2030-03-26\').length > 0,'
                 + '     einmalSpaeter: jtAn(\'2030-04-01\').length > 0,'
                 + '     zeitraumMitte: jtAn(\'2026-08-10\').length > 0,'
                 + '     zeitraumDanach: jtAn(\'2026-08-22\').length > 0 };'
                 + '   DB = alt; return r;'
                 + ' } };';
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
  pruefe(/id="knopfAbgleich"/.test(QUELLE),
         'ein Abgleich von Hand ist über die Diagnose erreichbar');

  const stand = skript.match(/function standZeichnen\([\s\S]*?\n\}/);
  pruefe(stand && /anmeldeStreifenPruefen\(\)/.test(stand[0]),
         'die fehlende Anmeldung meldet der eigene Streifen');
  pruefe(stand && /abgleichFehler/.test(stand[0]),
         'ein fehlgeschlagener Abgleich wird angezeigt');
  pruefe(stand && /kalenderFehler/.test(stand[0]),
         'ein Kalenderfehler wird angezeigt');
  pruefe(stand && /standSetzen\(''/.test(stand[0]),
         'im ungestörten Betrieb bleibt die Zeile leer');

  const google = skript.match(/function zeichneGoogle\([\s\S]*?\n\}/);
  pruefe(google && /grabsteine/.test(google[0]),
         'die Zahl der Löschvermerke steht in der Diagnose');
  pruefe(google && /letzterAbgleich/.test(google[0]),
         'der Zeitpunkt des letzten Abgleichs steht in der Diagnose');

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

  /* Zuweisungen an nie erklärte Namen: in strenger Betriebsart ein
     Abbruch. rueckSatz = … war genau so ein Fall. */
  const zuweisung = /(?:^|\n)\s*([a-zA-Z_$][\w$]*)\s*=[^=]/g;
  const ohneErklaerung = [];
  const gesehenZ = new Set();
  let z;
  while ((z = zuweisung.exec(skript)) !== null) {
    const name = z[1];
    if (gesehenZ.has(name)) { continue; }
    gesehenZ.add(name);
    if (definiert.has(name) || zugewiesen.has(name) || parameter.has(name)
        || bekannt.has(name)) { continue; }
    ohneErklaerung.push(name);
  }
  pruefe(ohneErklaerung.length === 0,
         'keine Zuweisung an eine nie erklärte Variable'
         + (ohneErklaerung.length ? ' — gefunden: ' + ohneErklaerung.join(', ') : ''));
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
   29. Sichtbarkeit und Lesbarkeit
   Grund: Eine abgelaufene Anmeldung blieb unbemerkt, weil der
   Hinweis nur in der Diagnose stand. Und graue Schrift auf hellem
   Papier war auf dem Handy im Freien kaum zu lesen.
   ============================================================ */
console.log('\n29. Sichtbarkeit und Lesbarkeit');
{
  const skript = hauptSkript();

  pruefe(new RegExp('function\\s+anmeldeStreifenPruefen\\s*\\(').test(skript),
         'Funktion anmeldeStreifenPruefen ist definiert');
  pruefe(/id="anmeldeStreifen"/.test(QUELLE), 'der Anmeldestreifen liegt im HTML');
  pruefe(/onclick="anmelden\(\)"/.test(QUELLE), 'der Streifen führt zur Anmeldung');

  /* Er muss auf jedem Bildschirm greifen, nicht nur in der Diagnose */
  /* Er muss ganz oben stehen — unten am Bildschirmrand wird er übersehen. */
  const bannerStelle = QUELLE.indexOf('id="anmeldeStreifen"');
  const ersterSchirm = QUELLE.indexOf('<div class="schirm');
  pruefe(bannerStelle > -1 && ersterSchirm > -1 && bannerStelle < ersterSchirm,
         'das Banner steht über allen Bildschirmen');
  pruefe(/<button type="button" onclick="anmelden\(\)">/.test(QUELLE),
         'es trägt einen eigenen Knopf zum Neuverbinden');
  const zeichnen = skript.match(/function zeichne\(\)[\s\S]*?\n\}/);
  pruefe(zeichnen && /anmeldeStreifenPruefen\(\)/.test(zeichnen[0]),
         'die Diagnose frischt ihn auf');
  const stand = skript.match(/function standZeichnen\([\s\S]*?\n\}/);
  pruefe(stand && /anmeldeStreifenPruefen\(\)/.test(stand[0]),
         'der Tagesplan frischt ihn auf');
  const takt = skript.match(/function taktPruefen\([\s\S]*?\n\}/);
  pruefe(takt && /anmeldeStreifenPruefen\(\)/.test(takt[0]),
         'ein zwischenzeitlich abgelaufener Zugriff fällt beim nächsten Takt auf');

  const pruef = skript.match(/function anmeldeStreifenPruefen\([\s\S]*?\n\}/);
  pruefe(pruef && /warAngemeldet\(\)/.test(pruef[0]),
         'der Text unterscheidet abgelaufen von noch nie angemeldet');
  pruefe(pruef && /tokenGueltig\(\)/.test(pruef[0]),
         'bei gültigem Zugriff verschwindet er');

  /* Lesbarkeit: Kontrast der Textfarben gegen den Papierton */
  function leuchte(hex) {
    const h = hex.replace('#', '');
    const teile = [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16) / 255; });
    const f = function (c) { return (c <= 0.03928) ? (c / 12.92) : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(teile[0]) + 0.7152 * f(teile[1]) + 0.0722 * f(teile[2]);
  }
  function kontrast(a, b) {
    let la = leuchte(a), lb = leuchte(b);
    if (la < lb) { const m = la; la = lb; lb = m; }
    return (la + 0.05) / (lb + 0.05);
  }
  function farbe(name) {
    const t = QUELLE.match(new RegExp('--' + name + ':\\s*(#[0-9A-Fa-f]{6})'));
    return t ? t[1] : null;
  }

  const papier = farbe('papier');
  const grau = farbe('grau');
  const tinte = farbe('tinte');
  const weinrot = farbe('weinrot');
  const petrol = farbe('petrol');

  pruefe(!!papier && !!grau && !!tinte, 'die Grundfarben sind definiert');
  if (papier && grau) {
    pruefe(kontrast(grau, papier) >= 4.5,
           'Nebentext hat mindestens Kontrast 4.5 (ist: ' + kontrast(grau, papier).toFixed(2) + ')');
  }
  if (papier && tinte) {
    pruefe(kontrast(tinte, papier) >= 7,
           'Haupttext hat mindestens Kontrast 7 (ist: ' + kontrast(tinte, papier).toFixed(2) + ')');
  }
  if (papier && weinrot) {
    pruefe(kontrast(weinrot, papier) >= 4.5,
           'Weinrot hat mindestens Kontrast 4.5 (ist: ' + kontrast(weinrot, papier).toFixed(2) + ')');
  }
  if (papier && petrol) {
    pruefe(kontrast(petrol, papier) >= 4.5,
           'Petrol hat mindestens Kontrast 4.5 (ist: ' + kontrast(petrol, papier).toFixed(2) + ')');
  }

  const fs = QUELLE.match(/--fs:\s*([\d.]+)px/);
  pruefe(fs && Number(fs[1]) >= 17,
         'die Grundschriftgröße liegt bei mindestens 17 px (ist: ' + (fs ? fs[1] : '?') + ')');
  pruefe(!/#B3AEA6/.test(QUELLE), 'der blasse Platzhalterton ist ersetzt');
}

/* ============================================================
   30. Fehlermeldungen von Google
   Grund: Ein Kalenderfehler wurde als „Drive antwortete mit 403"
   gemeldet — falscher Dienst, und die eigentliche Ursache (eine
   nicht freigeschaltete Schnittstelle) blieb unerkannt.
   ============================================================ */
console.log('\n30. Fehlermeldungen von Google');
{
  const skript = hauptSkript();
  const t = globalThis.__fehlerApi;

  pruefe(new RegExp('function\\s+dienstAusAdresse\\s*\\(').test(skript),
         'Funktion dienstAusAdresse ist definiert');

  const pruef = skript.match(/function antwortPruefen\([\s\S]*?\n\}/);
  pruefe(pruef && !/'Drive antwortete mit '/.test(pruef[0]),
         'die Meldung nennt nicht mehr pauschal Drive');
  pruefe(pruef && /SERVICE_DISABLED|has not been used/.test(pruef[0]),
         'eine nicht freigeschaltete Schnittstelle wird erkannt');
  pruefe(pruef && /a\.url/.test(pruef[0]),
         'der Dienst wird aus der Adresse abgeleitet');

  const stand = skript.match(/function standZeichnen\([\s\S]*?\n\}/);
  pruefe(stand && /kalenderFehler/.test(stand[0]),
         'ein Kalenderfehler steht auch im Tagesplan');

  if (!t) {
    warn('Fehlerfunktionen nicht auswertbar');
  } else {
    pruefe(t.dienstAusAdresse('https://www.googleapis.com/calendar/v3/x') === 'Der Kalender',
           'eine Kalenderadresse wird als Kalender erkannt');
    pruefe(t.dienstAusAdresse('https://www.googleapis.com/drive/v3/files') === 'Drive',
           'eine Drive-Adresse wird als Drive erkannt');
    pruefe(t.dienstAusAdresse('https://www.googleapis.com/upload/drive/v3/files/1') === 'Drive',
           'auch der Hochladeweg zählt zu Drive');
    pruefe(t.dienstAusAdresse('https://example.org/x') === 'Google',
           'Unbekanntes bekommt einen neutralen Namen');
  }
}

/* ============================================================
   31. Kalenderkennzeichnung und Tagesfilter
   Grund: Berufliche Termine kommen jetzt aus einem eigens
   gekennzeichneten Google-Kalender. Faellt die Kennzeichnung weg
   oder greift der Filter nicht, steht Berufliches als privat da.
   ============================================================ */
console.log('\n31. Kalenderkennzeichnung und Tagesfilter');
{
  const skript = hauptSkript();
  const api = globalThis.__filterApi;

  ['kalenderKontext', 'kalenderEintrag', 'kalenderKontextUm',
   'passtZumTag', 'setTagFilter'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });
  pruefe(/id="tAlle"/.test(QUELLE) && /id="tBeruf"/.test(QUELLE) && /id="tPrivat"/.test(QUELLE),
         'der Tagesplan hat die drei Filterpillen');

  /* Die Kennzeichnung liegt in der eigenen Datei, nicht bei Google */
  const kontext = skript.match(/function kalenderKontext\([\s\S]*?\n\}/);
  pruefe(kontext && /DB\.einstellungen/.test(kontext[0]),
         'die Kennzeichnung steht in den eigenen Einstellungen');
  pruefe(kontext && /'privat'/.test(kontext[0]),
         'ein nicht gekennzeichneter Kalender gilt als privat');

  const um = skript.match(/function kalenderKontextUm\([\s\S]*?\n\}/);
  pruefe(um && /DB\.einstellungen\.stempel = jetzt\(\)/.test(um[0]),
         'eine Änderung der Kennzeichnung wird abgeglichen');

  /* Der gelesene Termin trägt seinen Kontext */
  const holen = skript.match(/function einenKalenderHolen\([\s\S]*?\n\}/);
  pruefe(holen && /kalenderKontext\(kal\.id\)/.test(holen[0]),
         'beim Einlesen bekommt jeder Termin den Kontext seines Kalenders');

  /* Der Filter greift auf alles, nicht nur auf Termine */
  const eintraege = skript.match(/function tagesEintraege\([\s\S]*?\n\}\n/);
  pruefe(eintraege && /passtZumTag\(a\.kontext\)/.test(eintraege[0]),
         'der Filter greift auf Aufgaben');
  pruefe(eintraege && /passtZumTag\(g\.kontext\)/.test(eintraege[0]),
         'der Filter greift auf Termine');
  const ganz = skript.match(/function ganztagsZeichnen\([\s\S]*?\n\}/);
  pruefe(ganz && /passtZumTag/.test(ganz[0]),
         'der Filter greift auch auf Ganztägiges');

  if (!api) {
    warn('Filterfunktionen nicht auswertbar');
  } else {
    api.setTagFilter('alle');
    pruefe(api.passtZumTag('beruflich') && api.passtZumTag('privat'),
           'Alle zeigt beides');
    api.setTagFilter('beruflich');
    pruefe(api.passtZumTag('beruflich') && !api.passtZumTag('privat'),
           'Beruf zeigt nur Berufliches');
    api.setTagFilter('privat');
    pruefe(!api.passtZumTag('beruflich') && api.passtZumTag('privat'),
           'Privat zeigt nur Privates');
    api.setTagFilter('alle');

    /* Ein Termin ohne Kennzeichnung darf nicht verschwinden */
    api.setTagFilter('beruflich');
    pruefe(api.passtZumTag('') === true,
           'ein Eintrag ohne Kontext fällt nicht durch den Filter');
    api.setTagFilter('alle');
  }
}

/* ============================================================
   32. Verdichteter Tagesplan
   Grund: Auf dem Handy zaehlt jede Zeile. Ueberschriften, die den
   Bildschirm nur benennen, und Betriebsmeldungen im Normalfall
   kosten Platz, den die Eintraege brauchen.
   ============================================================ */
console.log('\n32. Verdichteter Tagesplan');
{
  const skript = hauptSkript();
  const api = globalThis.__tagApi;

  pruefe(!/id="kopfTitel"/.test(QUELLE), 'die Bildschirmüberschrift ist entfallen');
  pruefe(!/id="kopfVersion"/.test(QUELLE), 'die getrennte Versionszeile ist entfallen');
  pruefe(!/id="tkAbgleich"/.test(QUELLE), 'der Abgleich-Knopf im Tag ist entfallen');
  pruefe(/id="tAlle"/.test(QUELLE) && /class="tk-leiste"/.test(QUELLE),
         'die Filterpillen stehen in der Blätterleiste');
  pruefe(/tk-luecke/.test(QUELLE), 'Blättern und Filter teilen sich eine Zeile');
  pruefe(!/class="pillen tk-pillen"/.test(QUELLE), 'die eigene Pillenzeile ist entfallen');

  /* Der Aufgabenbildschirm behält seine Zahl */
  pruefe(/id="aufZahl"/.test(QUELLE), 'die Aufgabenfläche zeigt weiterhin die Zahl der Offenen');

  /* Der Anmeldezustand wird auch ohne Standzeile geprüft */
  const zeichnen = skript.match(/function tagZeichnen\([\s\S]*?\n\}\n/);
  pruefe(zeichnen && /anmeldeStreifenPruefen\(\)/.test(zeichnen[0]),
         'der Tagesplan prüft den Anmeldezustand selbst');
  const start = skript.match(/function starten\(\)[\s\S]*?\n\}/);
  pruefe(start && /addEventListener\('focus', anmeldeStreifenPruefen\)/.test(start[0]),
         'beim Zurückkehren ins Fenster wird geprüft');
  pruefe(start && /setInterval\(anmeldeStreifenPruefen/.test(start[0]),
         'zusätzlich wird regelmäßig geprüft');

  /* Wiederkehrendes mit Uhrzeit gehört in den Tagesverlauf */
  const eintraege = skript.match(/function tagesEintraege\([\s\S]*?\n\}\n/);
  pruefe(eintraege && /else if \(a\.uhrzeit\) \{ verlauf\.push/.test(eintraege[0]),
         'eine wiederkehrende Aufgabe mit Uhrzeit steht im Tagesverlauf');

  if (api && api.pruefeVerlauf) {
    const e = api.pruefeVerlauf();
    pruefe(e.mitZeit === 1, 'die wiederkehrende Aufgabe mit Uhrzeit liegt im Verlauf');
    pruefe(e.ohneZeit === 1, 'die ohne Uhrzeit steht weiterhin unter Wiederkehrend');
  } else {
    warn('Verlaufsprüfung nicht auswertbar');
  }
}

/* ============================================================
   33. Verbindung und Kalenderfenster
   Grund: Die Warnung hing an der Uhr statt an der Wirklichkeit —
   ein laengst verworfener Zugriff galt bis zum Ablauf als gueltig.
   Und beim Blaettern ueber das geholte Fenster hinaus stand der Tag
   ohne Termine da, ohne dass es auffiel.
   ============================================================ */
console.log('\n33. Verbindung und Kalenderfenster');
{
  const skript = hauptSkript();

  ['verbindungPruefen', 'verbindungTaktStarten', 'fensterPruefen'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  /* Die Verbindung wird wirklich ausprobiert */
  const pruef = skript.match(/function verbindungPruefen\([\s\S]*?\n\}\n/);
  pruefe(pruef && /window\.fetch\(/.test(pruef[0]),
         'die Prüfung ruft Google wirklich auf');
  pruefe(pruef && /drive\/v3\/about/.test(pruef[0]),
         'dafür genügt ein kleiner Aufruf');
  pruefe(pruef && /401 \|\| a\.status === 403/.test(pruef[0]),
         'ein verworfener Zugriff wird erkannt');
  pruefe(pruef && /tokenVergessen\(\)/.test(pruef[0]),
         'der Schlüssel wird dann verworfen');
  pruefe(pruef && /catch\(/.test(pruef[0]),
         'auch fehlendes Netz wird bemerkt');

  const streifen = skript.match(/function anmeldeStreifenPruefen\([\s\S]*?\n\}/);
  pruefe(streifen && /verbindungOk !== false/.test(streifen[0]),
         'der Streifen erscheint auch bei gültiger Uhr, aber toter Verbindung');
  pruefe(streifen && /Keine Verbindung zu Google/.test(streifen[0]),
         'die drei Fälle werden unterschieden');

  const start = skript.match(/function starten\(\)[\s\S]*?\n\}/);
  pruefe(start && /verbindungTaktStarten\(\)/.test(start[0]),
         'die Verbindungsprüfung läuft regelmäßig');
  pruefe(start && /\n  verbindungPruefen\(\);/.test(start[0]),
         'beim Start wird sofort geprüft');
  pruefe(start && /^\s*anmeldeStreifenPruefen\(\);/m.test(start[0]),
         'das Banner wird schon vor allen Abrufen gesetzt');

  const takt = skript.match(/VERBINDUNG_TAKT\s*=\s*(\d+)/);
  pruefe(takt && Number(takt[1]) >= 20000 && Number(takt[1]) <= 300000,
         'der Takt liegt zwischen 20 Sekunden und fünf Minuten');

  /* Erfolgreiche Aufrufe setzen den Zustand zurück */
  pruefe(/verbindungOk = true/.test(skript), 'ein erfolgreicher Aufruf meldet die Verbindung als gut');

  /* Kalenderfenster */
  const fenster = skript.match(/function fensterPruefen\([\s\S]*?\n\}/);
  pruefe(fenster && /kalVon/.test(fenster[0]) && /kalBis/.test(fenster[0]),
         'das geholte Fenster wird gemerkt');
  pruefe(fenster && /termineHolen\(false\)/.test(fenster[0]),
         'außerhalb des Fensters wird nachgeholt');
  const blaettern = skript.match(/function tagBlaettern\([\s\S]*?\n\}/);
  pruefe(blaettern && /fensterPruefen\(\)/.test(blaettern[0]),
         'beim Blättern wird das Fenster geprüft');
  const heute = skript.match(/function tagHeute\([\s\S]*?\n\}/);
  pruefe(heute && /fensterPruefen\(\)/.test(heute[0]),
         'auch der Sprung auf heute prüft es');

  const holen = skript.match(/function termineHolen\([\s\S]*?\n\}\n/);
  pruefe(holen && /tagOffen \|\| isoDatum\(\)/.test(holen[0]),
         'das Fenster legt sich um den angezeigten Tag, nicht um heute');

  const kaltakt = skript.match(/KAL_TAKT\s*=\s*([\d\s*]+);/);
  if (kaltakt) {
    const wert = Function('"use strict";return (' + kaltakt[1] + ')')();
    pruefe(wert <= 5 * 60 * 1000,
           'der Kalender wird höchstens alle fünf Minuten geholt (ist: '
           + Math.round(wert / 60000) + ' Minuten)');
  }
}

/* ============================================================
   34. Banner bei fehlender Verbindung
   Grund: Nach einem Neuladen war die Anmeldung weg, ohne dass es
   irgendwo stand. Ein Hinweis am unteren Rand wird auf dem Handy
   uebersehen — er gehoert nach oben und braucht einen Knopf.
   ============================================================ */
console.log('\n34. Banner bei fehlender Verbindung');
{
  const skript = hauptSkript();

  pruefe(/class="anmeldebanner"/.test(QUELLE), 'das Banner ist als solches gestaltet');
  pruefe(/id="anmeldeStreifen"/.test(QUELLE), 'es hat eine Kennung');
  pruefe(/id="anmeldeText"/.test(QUELLE), 'der Text ist austauschbar');

  const bannerStelle = QUELLE.indexOf('id="anmeldeStreifen"');
  const bodyStelle = QUELLE.indexOf('<body>');
  const ersterSchirm = QUELLE.indexOf('<div class="schirm');
  pruefe(bannerStelle > bodyStelle && bannerStelle < ersterSchirm,
         'es steht als Erstes im Fenster, über allen Bildschirmen');

  pruefe(/\.anmeldebanner\{[^}]*display:none/.test(QUELLE),
         'im Normalfall ist es unsichtbar');
  pruefe(/\.anmeldebanner\.sichtbar\{display:flex\}/.test(QUELLE),
         'bei Störung wird es eingeblendet');
  pruefe(/\.anmeldebanner\{[^}]*safe-area-inset-top/.test(QUELLE),
         'es respektiert den oberen Rand des Geräts');
  pruefe(/\.anmeldebanner button\{/.test(QUELLE),
         'der Knopf ist eigens gestaltet');
  pruefe(/>Neu verbinden</.test(QUELLE), 'der Knopf heißt „Neu verbinden"');

  const start = skript.match(/function starten\(\)[\s\S]*?\n\}/);
  pruefe(start && start[0].indexOf('anmeldeStreifenPruefen()') < start[0].indexOf('tokenAusSitzung()'),
         'das Banner wird vor jedem Abruf gesetzt');

  const streifen = skript.match(/function anmeldeStreifenPruefen\([\s\S]*?\n\}/);
  pruefe(streifen && /verbindungOk !== false/.test(streifen[0]),
         'es erscheint auch bei gültiger Uhr, aber toter Verbindung');

  /* Nach der Anmeldung muss es verschwinden */
  const anm = skript.match(/function anmelden\([\s\S]*?\n\}\n/);
  pruefe(anm && /verbindungPruefen\(\)/.test(anm[0]),
         'nach erfolgreicher Anmeldung wird die Verbindung geprüft und das Banner geräumt');

  /* Und nach einer misslungenen stillen Erneuerung stehen bleiben */
  pruefe(start && /verbindungOk = false/.test(start[0]),
         'eine misslungene stille Erneuerung setzt den Zustand auf getrennt');
}

/* ============================================================
   35. Termine beim Start holen
   Grund: Mit bestehender Sitzung wurde nicht neu angemeldet — und
   da die Termine nur nach einer Anmeldung geholt wurden, blieb der
   Tagesverlauf leer, ohne dass irgendwo ein Fehler stand.
   ============================================================ */
console.log('\n35. Termine beim Start holen');
{
  const skript = hauptSkript();

  pruefe(new RegExp('function\\s+kalenderNachholen\\s*\\(').test(skript),
         'Funktion kalenderNachholen ist definiert');

  const nach = skript.match(/function kalenderNachholen\([\s\S]*?\n\}/);
  pruefe(nach && /kalenderStand/.test(nach[0]),
         'sie holt nur, wenn in dieser Sitzung noch nichts geholt wurde');
  pruefe(nach && /kalenderLaeuft/.test(nach[0]),
         'ein laufender Abruf wird nicht doppelt angestoßen');
  pruefe(nach && /tokenGueltig\(\)/.test(nach[0]),
         'ohne Anmeldung wird nichts geholt');

  const start = skript.match(/function starten\(\)[\s\S]*?\n\}/);
  pruefe(start && /kalenderNachholen\(\)/.test(start[0]),
         'beim Start wird nachgeholt, auch ohne neue Anmeldung');

  const zeigen = skript.match(/function zeigeSchirm\([\s\S]*?\n\}/);
  pruefe(zeigen && /kalenderNachholen\(\)/.test(zeigen[0]),
         'auch das Öffnen des Tages holt nach');

  const verb = skript.match(/function verbindungPruefen\([\s\S]*?\n\}\n/);
  pruefe(verb && /kalenderNachholen\(\)/.test(verb[0]),
         'nach geglückter Verbindungsprüfung wird nachgeholt');

  /* Ein leerer Kalender darf nicht stumm bleiben */
  const stand = skript.match(/function standZeichnen\([\s\S]*?\n\}/);
  pruefe(stand && /!kalenderStand/.test(stand[0]),
         'noch nicht geholte Termine werden im Tagesplan gemeldet');
  pruefe(stand && /Termine wurden noch nicht geholt/.test(stand[0]),
         'der Text sagt, was fehlt');

  const kal = skript.match(/function zeichneKalender\([\s\S]*?\n\}/);
  pruefe(kal && /kalenderStand \? '' : 'nein'/.test(kal[0]),
         'in der Diagnose ist „noch nie" als Störung ausgezeichnet');
  pruefe(kal && /Holt gerade/.test(kal[0]),
         'ein laufender Abruf ist erkennbar');
}

/* ============================================================
   36. Kalender: Woche, Monat, Jahr
   Grund: Die Jahrestermine waren bisher unsichtbar. Und
   jaehrliche Eintraege muessen ueber Jahresgrenzen hinweg gelten,
   sonst verschwinden 85 Geburtstage im naechsten Januar.
   ============================================================ */
console.log('\n36. Kalender');
{
  const skript = hauptSkript();
  const api = globalThis.__kalenderApi;

  const noetig = ['kalZeichnen', 'setKalStufe', 'kalBlaettern', 'kalJetzt',
                  'wocheHtml', 'monatHtml', 'jahrHtml', 'jtAn', 'jtFarbe', 'jtPasst',
                  'jahrFilterSetzen', 'montagVon', 'zumTag', 'fensterPruefenFuer'];
  noetig.forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  pruefe(/id="schirmKalender"/.test(QUELLE), 'der Kalenderbildschirm liegt im HTML');
  pruefe(/id="sWoche"/.test(QUELLE) && /id="sMonat"/.test(QUELLE) && /id="sJahr"/.test(QUELLE),
         'alle drei Stufen haben einen Knopf');
  pruefe(/id="navKalender"/.test(QUELLE), 'der Kalender hat einen Navigationsknopf');

  /* Die Artfarben sind dieselben wie in TimeAssist */
  pruefe(/urlaub:\s*\{ n: 'Urlaub'/.test(skript), 'die Arten sind übernommen');
  const arten = skript.match(/var JT_REIHE = \[([\s\S]*?)\];/);
  pruefe(arten && (arten[1].match(/'/g) || []).length / 2 === 9,
         'es sind neun Arten');

  if (!api) {
    warn('Kalenderfunktionen nicht auswertbar');
  } else {
    /* Montag einer Woche */
    pruefe(api.montagVon('2026-09-08') === '2026-09-07', 'der Dienstag gehört zu seinem Montag');
    pruefe(api.montagVon('2026-09-13') === '2026-09-07', 'der Sonntag ebenfalls');
    pruefe(api.montagVon('2026-09-07') === '2026-09-07', 'der Montag zu sich selbst');

    /* Jährliche Einträge gelten in jedem Jahr */
    const e = api.pruefeJaehrlich();
    pruefe(e.imJahr === true, 'ein jährlicher Eintrag gilt im Ursprungsjahr');
    pruefe(e.spaeter === true, 'und auch viele Jahre später');
    pruefe(e.einmalSpaeter === false, 'ein einmaliger Eintrag gilt nur in seinem Jahr');

    /* Zeitraum über mehrere Tage */
    pruefe(e.zeitraumMitte === true, 'ein Zeitraum gilt auch an seinen mittleren Tagen');
    pruefe(e.zeitraumDanach === false, 'nach dem Ende nicht mehr');
  }

  /* Beim Blättern wird das Terminfenster nachgezogen */
  const blaettern = skript.match(/function kalBlaettern\([\s\S]*?\n\}/);
  pruefe(blaettern && /fensterPruefenFuer\(/.test(blaettern[0]),
         'beim Blättern wird das Terminfenster geprüft');

  /* Der Sprung in den Tag */
  const zum = skript.match(/function zumTag\([\s\S]*?\n\}/);
  pruefe(zum && /zeigeSchirm\('Tag'\)/.test(zum[0]),
         'ein Tag im Kalender führt in die Tagesansicht');
}

/* ============================================================
   37. Wochensicht als Spalten
   Grund: Am grossen Bildschirm soll die Woche wie ein Stundenplan
   lesbar sein — sieben Spalten, oben Termine, unten Hauptaufgaben.
   Kleinigkeiten gehoeren in den Tag, nicht in die Wochenuebersicht.
   ============================================================ */
console.log('\n37. Wochensicht als Spalten');
{
  const skript = hauptSkript();
  const api = globalThis.__filterApi;

  pruefe(new RegExp('function\\s+passtZumKalender\\s*\\(').test(skript),
         'Funktion passtZumKalender ist definiert');
  pruefe(new RegExp('function\\s+setKalFilter\\s*\\(').test(skript),
         'Funktion setKalFilter ist definiert');
  pruefe(/id="kAlle"/.test(QUELLE) && /id="kBeruf"/.test(QUELLE) && /id="kPrivat"/.test(QUELLE),
         'der Kalender hat die drei Filterpillen');

  const woche = skript.match(/function wocheHtml\([\s\S]*?\n\}\n/);
  pruefe(woche && /class="woche-raster"/.test(woche[0]), 'die Woche steht in einem Raster');
  pruefe(woche && /class="ktag-termine"/.test(woche[0]), 'jeder Tag hat einen Terminblock');
  pruefe(woche && /class="ktag-aufgaben"/.test(woche[0]), 'und einen Aufgabenblock');
  pruefe(woche && /a\.art === 'klein'.*continue/s.test(woche[0]),
         'Kleinigkeiten stehen nicht in der Wochensicht');
  pruefe(woche && (woche[0].match(/passtZumKalender\(/g) || []).length >= 4,
         'der Filter greift auf Termine, Ganztägiges, Aufgaben und die Wochenliste');

  pruefe(/@media \(min-width:900px\)/.test(QUELLE), 'am großen Bildschirm gilt ein eigenes Bild');
  pruefe(/grid-template-columns:repeat\(7,1fr\)/.test(QUELLE), 'dort stehen sieben Spalten');
  pruefe(/\.ktag-termine\{min-height/.test(QUELLE),
         'der Terminblock hat eine feste Mindesthöhe, damit die zweite Zeile fluchtet');

  const monat = skript.match(/function monatHtml\([\s\S]*?\n\}/);
  pruefe(monat && /passtZumKalender/.test(monat[0]), 'der Filter greift auch im Monat');

  if (api && api.passtZumKalender) {
    api.setKalFilter('beruflich');
    pruefe(api.passtZumKalender('beruflich') && !api.passtZumKalender('privat'),
           'Beruf zeigt nur Berufliches');
    api.setKalFilter('alle');
    pruefe(api.passtZumKalender('privat'), 'Alle zeigt wieder alles');
  } else {
    warn('Kalenderfilter nicht auswertbar');
  }
}

/* ============================================================
   38. Ferien, Feiertage und Jahresterminpflege
   Grund: Feiertage lassen sich rechnen, Ferien nicht. Und ein
   Jahrestermin, den man nur ansehen kann, ist keiner — im Raster
   fuehrte bisher jeder Klick nur in die Tagesansicht.
   ============================================================ */
console.log('\n38. Ferien, Feiertage und Jahrestermine');
{
  const skript = hauptSkript();
  const f = globalThis.__ferienApi;

  const noetig = ['icsLesen', 'icsDatum', 'icsEntfalten', 'ferienUebernehmen',
                  'ferienDateiGemerkt', 'ferienEinlesen', 'ferienAn', 'ferienEintragAn', 'zeichneFerien',
                  'jtTagOeffnen', 'jtTagHtml', 'jtAnlegen', 'jtLoeschen',
                  'jtArtSetzen', 'jtTitelSetzen', 'jtJaehrlichUm', 'jtFinden'];
  noetig.forEach(function (n) {
    pruefe(new RegExp('function\\s+' + n + '\\s*\\(').test(skript),
           'Funktion ' + n + ' ist definiert');
  });

  pruefe(/id="ferienDatei"/.test(QUELLE), 'die Diagnose hat ein Feld zum Einlesen');
  const samm = skript.match(/var SAMMLUNGEN = \[([\s\S]*?)\];/);
  pruefe(samm && /'ferien'/.test(samm[1]), 'Ferien sind eine eigene Sammlung und werden abgeglichen');

  /* Das Ende eines Ganztagstermins ist bei ICS der Folgetag */
  const lesen = skript.match(/function icsLesen\([\s\S]*?\n\}/);
  pruefe(lesen && /tagePlus\(bis, -1\)/.test(lesen[0]),
         'beim Einlesen wird das Ende um einen Tag zurückgesetzt');

  /* Eingelesene Feiertage haben Vorrang vor der Berechnung */
  const fei = skript.match(/function feiertagAn\([\s\S]*?\n\}/);
  pruefe(fei && /ferienEintragAn\(is, 'feiertag'\)/.test(fei[0]),
         'eingelesene Feiertage gehen vor die Berechnung');

  /* Das Raster führt in die Pflege, nicht in den Tag */
  const jahr = skript.match(/function jahrHtml\([\s\S]*?\n\}\n/);
  pruefe(jahr && /onclick="jtTagOeffnen\(/.test(jahr[0]),
         'eine Zelle im Jahresraster öffnet die Pflege');
  pruefe(jahr && /class="jwt"/.test(jahr[0]),
         'jede Zelle nennt ihren Wochentag in einer eigenen Spalte');
  pruefe(jahr && /ferienAn\(iso\)/.test(jahr[0]),
         'Ferienzeiträume werden im Raster getönt');
  pruefe(/\.jwt\{/.test(QUELLE), 'der Wochentag ist eigens gestaltet');
  pruefe(/\.jzelle\{[^}]*inset:0/.test(QUELLE),
         'die Zelle wird vollständig ausgefüllt');
  pruefe(/\.jwt\{[^}]*flex:0 0/.test(QUELLE),
         'der Wochentag hat eine feste eigene Spalte');
  pruefe(/\.jwt\{[^}]*justify-content:flex-start/.test(QUELLE),
         'der Wochentag steht linksbündig');
  pruefe(/\.jbalken\{[^}]*flex:1/.test(QUELLE),
         'der Rest der Zelle gehört den Terminen');
  pruefe(/\.jbalken i\{[^}]*flex:1/.test(QUELLE),
         'mehrere Termine teilen sich diesen Rest zu gleichen Teilen');

  const sheet = skript.match(/function jtTagHtml\([\s\S]*?\n\}\n/);
  pruefe(sheet && /jtNeuOeffnen\(\)/.test(sheet[0]),
         'das Tagesblatt führt zum getrennten Anlegeblatt');
  pruefe(sheet && !/jtNeuTitel/.test(sheet[0]),
         'im Tagesblatt steht kein Anlegeformular');
  const neuBlatt = skript.match(/function jtNeuHtml\([\s\S]*?\n\}/);
  pruefe(neuBlatt && /jtAnlegen\(\)/.test(neuBlatt[0]),
         'im Anlegeblatt lässt sich ein Jahrestermin anlegen');
  pruefe(neuBlatt && /jtTagOeffnen\(/.test(neuBlatt[0]),
         'ein Rückweg ins Tagesblatt ist vorhanden');
  pruefe(sheet && /jtLoeschen\(/.test(sheet[0]), 'ein bestehender lässt sich löschen');
  pruefe(sheet && /jtJaehrlichUm\(/.test(sheet[0]), 'jährlich lässt sich umschalten');
  pruefe(sheet && /zumTagAusJahr\(\)/.test(sheet[0]), 'der Weg in den Tag bleibt erhalten');

  const loe = skript.match(/function jtLoeschen\([\s\S]*?\n\}/);
  pruefe(loe && /grabsteinSetzen\('jahrestermine'/.test(loe[0]),
         'das Löschen hinterlässt einen Löschvermerk');

  if (!f) {
    warn('ICS-Funktionen nicht auswertbar');
  } else {
    f.setDB(f.leereDatenbank());
    const text = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x1@test\r\n'
               + 'DTSTART;VALUE=DATE:20260803\r\nDTEND;VALUE=DATE:20260915\r\n'
               + 'SUMMARY:Sommerferien Bayern\r\nCATEGORIES:SCHULFERIEN\r\n'
               + 'END:VEVENT\r\nEND:VCALENDAR\r\n';
    const roh = f.icsLesen(text);
    pruefe(roh.length === 1, 'ein Ereignis wird gelesen');
    pruefe(roh[0].von === '2026-08-03', 'der Beginn stimmt');
    pruefe(roh[0].bis === '2026-09-14', 'das Ende ist der letzte Ferientag, nicht der Folgetag');
    pruefe(roh[0].art === 'ferien', 'die Kategorie wird erkannt');

    const b1 = f.ferienUebernehmen(text, 'test.ics');
    const b2 = f.ferienUebernehmen(text, 'test.ics');
    pruefe(b1.neu === 1 && b2.neu === 0 && b2.ersetzt === 1,
           'zweimal einlesen erzeugt keine Dublette');

    pruefe(f.ferienAn('2026-08-10') === 'Sommerferien Bayern', 'mitten drin gilt es');
    pruefe(f.ferienAn('2026-09-14') === 'Sommerferien Bayern', 'am letzten Tag auch');
    pruefe(f.ferienAn('2026-09-15') === '', 'am Folgetag nicht mehr');

    /* Zusammengeklebte Zeilen */
    const gefaltet = 'BEGIN:VEVENT\r\nSUMMARY:Sehr langer\r\n  Titel\r\n'
                   + 'DTSTART;VALUE=DATE:20260101\r\nEND:VEVENT\r\n';
    const g = f.icsLesen(gefaltet);
    /* Nach der Norm ist genau ein Leerzeichen die Faltmarke, weitere
       gehören zum Text. */
    pruefe(g.length === 1 && g[0].titel === 'Sehr langer Titel',
           'umbrochene Zeilen werden wieder zusammengefügt');
  }
}

/* ============================================================
   39. Einlesen auf Knopfdruck und Kuerzel im Jahresraster
   Grund: Ein Dateifeld, das beim Auswaehlen sofort einliest, tut
   es unbemerkt. Und ein farbiger Balken ohne Beschriftung sagt
   nur die Art, nicht welcher Eintrag gemeint ist.
   ============================================================ */
console.log('\n39. Einlesen und Kürzel');
{
  const skript = hauptSkript();
  const j = globalThis.__jtApi;

  pruefe(new RegExp('function\\s+jtKuerzel\\s*\\(').test(skript), 'Funktion jtKuerzel ist definiert');
  pruefe(new RegExp('function\\s+jtKuerzelSetzen\\s*\\(').test(skript),
         'Funktion jtKuerzelSetzen ist definiert');
  pruefe(/id="knopfFerien"/.test(QUELLE), 'es gibt einen Einlesen-Knopf');
  pruefe(/onchange="ferienDateiGemerkt\(\)"/.test(QUELLE),
         'das Auswählen merkt nur vor');
  pruefe(/disabled>Einlesen</.test(QUELLE),
         'der Knopf ist ohne Auswahl gesperrt');

  const fertig = skript.match(/function ferienFertig\([\s\S]*?\n\}/);
  pruefe(fertig && /feld\.value = ''/.test(fertig[0]),
         'nach dem Einlesen wird die Auswahl geräumt');

  const jahr = skript.match(/function jahrHtml\([\s\S]*?\n\}\n/);
  pruefe(jahr && /jtKuerzel\(treffer\[b\]\)/.test(jahr[0]),
         'jeder Terminbereich trägt sein eigenes Kürzel');
  pruefe(/\.jbalken i\{[^}]*color:rgba\(255/.test(QUELLE),
         'das Kürzel steht hell auf der Artfarbe');

  const blatt = skript.match(/function jtTagHtml\([\s\S]*?\n\}\n/);
  pruefe(blatt && /jtKuerzelSetzen\(/.test(blatt[0]),
         'das Kürzel lässt sich von Hand überschreiben');
  pruefe(blatt && /maxlength="3"/.test(blatt[0]), 'höchstens drei Zeichen');

  if (!j) {
    warn('Kürzelfunktion nicht auswertbar');
  } else {
    pruefe(j.jtKuerzel({ titel: 'Skiwoche' }) === 'Ski', 'ein Wort ergibt seine ersten drei Zeichen');
    pruefe(j.jtKuerzel({ titel: 'Geburtstag Anita Müller (1937)' }) === 'Ani',
           'ein Gattungswort wird übersprungen');
    pruefe(j.jtKuerzel({ titel: 'Urlaub Familie' }) === 'Fam',
           'auch „Urlaub" zählt als Gattungswort');
    pruefe(j.jtKuerzel({ titel: 'Werksbesuch Hamburg' }) === 'Wer',
           'ein zusammengesetztes Wort bleibt stehen');
    pruefe(j.jtKuerzel({ titel: 'Urlaub' }) === 'Url',
           'steht nur das Gattungswort da, wird es benutzt');
    pruefe(j.jtKuerzel({ titel: 'x', kuerzel: 'ABC' }) === 'ABC',
           'ein von Hand gesetztes Kürzel gewinnt');
    pruefe(j.jtKuerzel({ titel: 'x', kuerzel: 'ABCDE' }) === 'ABC',
           'es wird auf drei Zeichen gekürzt');
    pruefe(j.jtKuerzel({ titel: '' }) === '···', 'ohne Titel bleibt ein Platzhalter');
  }
}

/* ============================================================
   40. Filter „nur Ferien"
   Grund: Ferien waren nur Hintergrundton und tauchten in keiner
   Summe auf. Als Gegenpart zu „Alle" braucht es eine Sicht, die
   ausschliesslich die Ferientage zeigt.
   ============================================================ */
console.log('\n40. Filter „nur Ferien"');
{
  const skript = hauptSkript();
  const f = globalThis.__jahrApi;

  ['ferienZeigen', 'ferienImJahr'].forEach(function (n) {
    pruefe(new RegExp('function\\s+' + n + '\\s*\\(').test(skript),
           'Funktion ' + n + ' ist definiert');
  });

  const passt = skript.match(/function jtPasst\([\s\S]*?\n\}/);
  pruefe(passt && /jahrFilter === 'ferien'.*return false/s.test(passt[0]),
         'bei „nur Ferien" verschwinden die Jahrestermine');
  pruefe(passt && /jahrFilter === null/.test(passt[0]),
         'ohne Filter wird weiterhin alles gezeigt');

  const zeigen = skript.match(/function ferienZeigen\([\s\S]*?\n\}/);
  pruefe(zeigen && /jahrFilter === null \|\| jahrFilter === 'ferien'/.test(zeigen[0]),
         'die Ferientönung erscheint nur ohne Filter oder bei „nur Ferien"');

  const jahr = skript.match(/function jahrHtml\([\s\S]*?\n\}\n/);
  pruefe(jahr && /ferienZeigen\(\) && ferienAn\(iso\)/.test(jahr[0]),
         'das Raster folgt dem Filter auch bei der Tönung');
  pruefe(jahr && /Nur Ferien/.test(jahr[0]), 'es gibt eine eigene Summenzeile');
  pruefe(jahr && /Ferien ' \+ jahr/.test(jahr[0]),
         'die Eintragsliste zeigt dann die Ferienzeiträume');

  if (!f) {
    warn('Jahresfunktionen nicht auswertbar');
  } else {
    const e = f.pruefeFerien();
    pruefe(e.ohneFilter > 0, 'ohne Filter stehen Jahrestermine im Raster');
    pruefe(e.nurFerien === 0, 'bei „nur Ferien" steht kein Jahrestermin mehr im Raster');
    pruefe(e.ferienListe === 3, 'die Ferienliste nennt die Zeiträume');
    pruefe(e.andererFilter > 0, 'ein anderer Filter zeigt weiterhin seine Art');
    pruefe(e.toenungAus === true,
           'bei einem anderen Filter ist auch die Ferientönung aus');
    /* 5 + 43 + 5 Tage aus den drei Zeiträumen des Prüfbeispiels */
    pruefe(e.summe.n === 3 && e.summe.tage === 53,
           'die Ferientage des Jahres werden richtig gezählt (ist: '
           + e.summe.n + ' Zeiträume, ' + e.summe.tage + ' Tage)');
  }
}

/* ============================================================
   41. Monatssicht in zwei Spalten
   Grund: Links praegt den Tag (Jahrestermine, Feiertag, Ferien),
   rechts findet er statt (Kalendertermine). Ohne Begrenzung wuerde
   ein voller Tag die Monatsuebersicht sprengen.
   ============================================================ */
console.log('\n41. Monatssicht');
{
  const skript = hauptSkript();
  const m = globalThis.__monatApi;

  ['monatArtErlaubt', 'monatKalenderErlaubt', 'monatTagUm', 'monatFilterZahl',
   'monatFilterOeffnen', 'monatFilterHtml', 'monatArtUm', 'monatKalenderUm',
   'monatFilterZuruecksetzen'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  const monat = skript.match(/function monatHtml\([\s\S]*?\n\}\n/);
  pruefe(monat && /class="mt-oben"/.test(monat[0]), 'jeder Tag hat eine obere Zeile');
  pruefe(monat && /class="mt-unten"/.test(monat[0]), 'und eine untere Zeile');
  pruefe(/\.mt-unten\{[^}]*border-top/.test(QUELLE),
         'eine Trennlinie scheidet die beiden Zeilen');
  pruefe(monat && !/mt-bal/.test(monat[0]),
         'die Jahrestermine stehen ohne Farbfläche da');
  pruefe(monat && /style="color:' \+ jtFarbe/.test(monat[0]),
         'ihre Art zeigt sich in der Schriftfarbe');
  pruefe(monat && /MONAT_ZEIGEN/.test(monat[0]), 'die Zahl der gezeigten Termine ist begrenzt');
  pruefe(monat && /Termine<\/button>/.test(monat[0]), 'darüber hinaus gibt es einen Mehr-Knopf');
  pruefe(monat && /monatArtErlaubt/.test(monat[0]) && /monatKalenderErlaubt/.test(monat[0]),
         'beide Filter greifen');

  const grenze = skript.match(/MONAT_ZEIGEN\s*=\s*(\d+)/);
  pruefe(grenze && Number(grenze[1]) >= 1 && Number(grenze[1]) <= 5,
         'die Grenze liegt zwischen einem und fünf Terminen');

  pruefe(/id="kalFilterKnopf"/.test(QUELLE), 'der Filterknopf liegt im Kalenderkopf');
  const zeichnen = skript.match(/function kalZeichnen\([\s\S]*?\n\}\n/);
  pruefe(zeichnen && /kalStufe === 'monat'/.test(zeichnen[0]),
         'er erscheint nur in der Monatsstufe');
  pruefe(zeichnen && /Filter · '/.test(zeichnen[0]),
         'er nennt die Zahl der abgeschalteten Einträge');

  const blatt = skript.match(/function monatFilterHtml\([\s\S]*?\n\}\n/);
  pruefe(blatt && /Kategorien/.test(blatt[0]) && /Kalender/.test(blatt[0]),
         'das Filterblatt trennt Kategorien und Kalender');
  pruefe(blatt && /mf-haken/.test(blatt[0]), 'jede Zeile trägt ein Häkchen');
  pruefe(blatt && /monatFilterAllesAus\(\)/.test(blatt[0]),
         'es gibt einen Knopf, der alles ausblendet');
  pruefe(blatt && /monatFilterZuruecksetzen\(\)/.test(blatt[0]),
         'und einen, der alles wieder zeigt');
  pruefe(blatt && (blatt[0].match(/monatGruppeSetzen\(/g) || []).length === 4,
         'jede Gruppe lässt sich für sich an- und abschalten');

  ['monatGruppeSetzen', 'monatFilterAllesAus'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });
  const aus = skript.match(/function monatFilterAllesAus\([\s\S]*?\n\}/);
  pruefe(aus && /'arten', false/.test(aus[0]) && /'kalender', false/.test(aus[0]),
         'Alles ausblenden trifft beide Gruppen');

  if (!m) {
    warn('Monatsfunktionen nicht auswertbar');
  } else {
    const e = m.pruefeMonat();
    pruefe(e.spalten === 30, 'jeder Tag des Monats hat beide Zeilen');
    pruefe(e.sichtbar === 2, 'zunächst sind zwei Termine zu sehen');
    pruefe(e.mehrKnopf === true, 'der Rest steckt hinter dem Mehr-Knopf');
    pruefe(e.aufgeklappt === 5, 'aufgeklappt sind alle zu sehen');
    pruefe(e.nachAbwahl === true, 'ein abgewählter Kalender verschwindet');
    pruefe(e.zahlNachAbwahl === 1, 'der Knopf zählt die Abwahl');
    pruefe(e.zurueckgesetzt === 0, 'zurücksetzen räumt alle Filter ab');
    pruefe(e.allesAus === 11, 'Alles ausblenden schaltet neun Arten und zwei Kalender ab');
    pruefe(e.nachGruppe === 2, 'eine Gruppe lässt sich wieder einschalten, ohne die andere');
  }
}

/* ============================================================
   42. Kontext der Jahrestermine
   Grund: Die Filterpillen im Kalender griffen nicht auf Jahrestermine.
   Eine Dienstreise ist beruflich, ein Geburtstag privat — ohne diese
   Unterscheidung zeigt „nur Beruf" weiterhin alle Geburtstage.
   ============================================================ */
console.log('\n42. Kontext der Jahrestermine');
{
  const skript = hauptSkript();
  const j = globalThis.__jtKontextApi;

  ['jtKontext', 'jtKontextSetzen', 'jtNeuKontextSetzen'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  const passt = skript.match(/function jtPasst\([\s\S]*?\n\}/);
  pruefe(passt && /passtZumKalender\(jtKontext\(e\)\)/.test(passt[0]),
         'die Filterpillen greifen jetzt auch auf Jahrestermine');

  const jahr = skript.match(/function jahrHtml\([\s\S]*?\n\}\n/);
  pruefe(jahr && /passtZumKalender\(jtKontext\(e\)\)/.test(jahr[0]),
         'auch die Summen folgen dem Kontextfilter');

  const blatt = skript.match(/function jtTagHtml\([\s\S]*?\n\}\n/);
  pruefe(blatt && /jtKontextSetzen\(/.test(blatt[0]),
         'im Tagesblatt lässt sich der Kontext umschalten');
  const neu = skript.match(/function jtNeuHtml\([\s\S]*?\n\}\n/);
  pruefe(neu && /jtNeuKontextSetzen\(/.test(neu[0]),
         'beim Anlegen ist er wählbar');

  const anlegen = skript.match(/function jtAnlegen\([\s\S]*?\n\}/);
  pruefe(anlegen && /kontext: jtNeuKontext/.test(anlegen[0]),
         'der gewählte Kontext wird gespeichert');

  const mig = skript.match(/function migrationRechnen\([\s\S]*?\n\}\n/);
  pruefe(mig && /'dienstreise', 'abwesend', 'termin'/.test(mig[0]),
         'die Migration gibt jedem Jahrestermin einen Kontext');

  if (!j) {
    warn('Kontextfunktion nicht auswertbar');
  } else {
    pruefe(j.jtKontext({ art: 'dienstreise' }) === 'beruflich', 'Dienstreise ist beruflich');
    pruefe(j.jtKontext({ art: 'abwesend' }) === 'beruflich', 'Abwesend ist beruflich');
    pruefe(j.jtKontext({ art: 'termin' }) === 'beruflich', 'Termin ist beruflich');
    pruefe(j.jtKontext({ art: 'besuche' }) === 'privat', 'Besuche sind privat');
    pruefe(j.jtKontext({ art: 'geburtstag' }) === 'privat', 'Geburtstage sind privat');
    pruefe(j.jtKontext({ art: 'urlaub' }) === 'privat', 'Urlaub ist privat');
    pruefe(j.jtKontext({ art: 'krank' }) === 'privat', 'Krankheit ist privat');
    pruefe(j.jtKontext({ art: 'dienstreise', kontext: 'privat' }) === 'privat',
           'ein gesetzter Kontext gewinnt gegen die Ableitung');
    pruefe(j.jtKontext({ art: 'geburtstag', kontext: 'beruflich' }) === 'beruflich',
           'auch andersherum');
    pruefe(j.jtKontext({ art: 'sonstiges', kontext: 'unsinn' }) === 'privat',
           'ein unbrauchbarer Wert fällt auf die Ableitung zurück');

    const e = j.pruefeFilter();
    pruefe(e.alle === 3, 'ohne Filter stehen alle drei im Raster');
    pruefe(e.beruf === 1, 'nur Beruf zeigt die Dienstreise');
    pruefe(e.privat === 2, 'nur Privat zeigt Geburtstag und Urlaub');
  }
}

/* ============================================================
   43. Vorhaben: Ziele und Projekte
   Grund: Ein Projekt liefert und hat ein Ende, ein Ziel wird
   gehalten. Beide tragen einen Zielzustand je Woche. Wird ein
   Projekt geloescht, duerfen seine Aufgaben nicht mitverschwinden.
   ============================================================ */
console.log('\n43. Vorhaben');
{
  const skript = hauptSkript();
  const v = globalThis.__vhApi;

  const noetig = ['vhZeichnen', 'setVhFilter', 'vhKarteUm', 'zielKarteHtml',
                  'projektKarteHtml', 'vorhabenNeu', 'vorhabenAnlegen',
                  'vhDetailOeffnen', 'vhDetailHtml', 'vhNameSetzen', 'vhKontextSetzen',
                  'vhFeldSetzen', 'vhZustandSetzen', 'vhHistorieUm', 'vhErreichtUm',
                  'vhMsNeu', 'vhMsUm', 'vhMsTitel', 'vhMsDatum', 'vhMsWeg',
                  'vhAnlageSpeichern', 'vhAnlageWeg', 'vhEinzahlerWahl',
                  'vhEinzahlerDazu', 'vhEinzahlerWeg', 'vhAbschliessen', 'vhLoeschen',
                  'zustandDieseWoche', 'zustandSetzen', 'zustandText',
                  'fruehereZustaende', 'wochenSchluessel', 'naechsterMeilenstein',
                  'aufgabenZuProjekt', 'einzahlerAufgaben'];
  noetig.forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  pruefe(/id="schirmVorhaben"/.test(QUELLE), 'der Vorhabenbildschirm liegt im HTML');
  pruefe(/id="navVorhaben"/.test(QUELLE), 'er hat einen Navigationsknopf');
  pruefe(/id="vAlle"/.test(QUELLE) && /id="vBeruf"/.test(QUELLE) && /id="vPrivat"/.test(QUELLE),
         'die drei Filterpillen sind da');

  /* Der Unterschied zwischen Ziel und Projekt muss sichtbar bleiben */
  const neu = skript.match(/function vorhabenNeu\([\s\S]*?\n\}/);
  pruefe(neu && /Ein Projekt liefert und hat ein Ende/.test(neu[0]),
         'beim Anlegen wird der Unterschied benannt');
  const anlegen = skript.match(/function vorhabenAnlegen\([\s\S]*?\n\}/);
  pruefe(anlegen && /zieltermin/.test(anlegen[0]) && /meilensteine/.test(anlegen[0]),
         'Ziel und Projekt bekommen verschiedene Felder');

  /* Ein gelöschtes Projekt darf keine Aufgaben mitreißen */
  const loe = skript.match(/function vhLoeschen\([\s\S]*?\n\}/);
  pruefe(loe && /projektId = null/.test(loe[0]),
         'beim Löschen eines Projekts verlieren die Aufgaben nur ihre Zuordnung');
  pruefe(loe && /grabsteinSetzen\(/.test(loe[0]), 'ein Löschvermerk entsteht');
  pruefe(loe && !/DB\.aufgaben\.splice/.test(loe[0]),
         'keine Aufgabe wird mitgelöscht');

  const schliessen = skript.match(/function aktionenSchliessen\([\s\S]*?\n\}/);
  pruefe(schliessen && /vhFrischAngelegt/.test(schliessen[0]),
         'ein namenlos gebliebenes Vorhaben verschwindet wieder');

  if (!v) {
    warn('Vorhabenfunktionen nicht auswertbar');
  } else {
    const e = v.pruefeVorhaben();
    pruefe(e.satzDieseWoche === 'Fundament steht',
           'der Zielzustand dieser Woche wird gehalten');
    pruefe(e.zweitesMalGleicheWoche === 1,
           'ein zweiter Satz derselben Woche überschreibt, statt zu ergänzen');
    pruefe(e.frueherLeer === 0, 'die laufende Woche steht nicht in der Historie');
    pruefe(e.frueherNach === 1, 'eine vergangene Woche schon');
    pruefe(e.reihenfolge === 40, 'die Historie beginnt bei der jüngsten Woche');
    pruefe(e.naechsterMs === 'Zweiter',
           'als nächster Meilenstein gilt der erste noch offene');
    pruefe(e.ohneOffenen === null, 'sind alle erreicht, gibt es keinen nächsten');
    pruefe(e.aufgabenNachLoeschen === 2,
           'nach dem Löschen eines Projekts bestehen seine Aufgaben weiter');
    pruefe(e.ohneProjekt === 2, 'sie tragen danach kein Projekt mehr');
  }
}

/* ============================================================
   44. Ablaeufe, Abläufe im Tag und Wochenrueckblick
   Grund: Eine Vorlage wiederholt sich, ein Durchlauf gilt einem
   Fall. Im Tag darf nur der naechste offene Schritt stehen, nicht
   der ganze Ablauf. Und ein beendeter Durchlauf muss zurueckholbar
   sein — die Rueckgaengig-Ablage kannte bisher nur Aufgaben.
   ============================================================ */
console.log('\n44. Abläufe und Wochenrückblick');
{
  const skript = hauptSkript();
  const a = globalThis.__abApi;

  const noetig = ['abZeichnen', 'setAbFilter', 'abKarteUm', 'vorlageKarteHtml',
                  'durchlaufKarteHtml', 'vorlageFinden', 'durchlaufFinden', 'ablaufFinden',
                  'schritteFertig', 'offenerSchritt', 'laufendeDurchlaeufe',
                  'schrittUm', 'durchlaufStarten', 'durchlaufBeenden',
                  'ablaufNeu', 'ablaufAnlegen', 'abDetailOeffnen', 'abDetailHtml',
                  'abSchrittNeu', 'abSchrittHoch', 'abSchrittWeg', 'vorlageAusDurchlauf',
                  'abLoeschen', 'ablaufSchritteHeute', 'ablaufZeileHtml',
                  'rueckblickOeffnen', 'rueckblickHtml', 'rbErreicht', 'rbSatz',
                  'letzteWoche', 'zustandVonWoche', 'alleVorhaben'];
  noetig.forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  pruefe(/id="schirmAblaeufe"/.test(QUELLE), 'der Ablaufbildschirm liegt im HTML');
  pruefe(/id="navAblaeufe"/.test(QUELLE), 'er hat einen Navigationsknopf');
  pruefe(/rueckblickOeffnen\(\)/.test(QUELLE), 'der Wochenrückblick ist erreichbar');

  /* Nur der nächste offene Schritt gehört in den Tag */
  const heute = skript.match(/function ablaufSchritteHeute\([\s\S]*?\n\}/);
  pruefe(heute && /offenerSchritt\(/.test(heute[0]),
         'im Tag steht je Durchlauf nur der nächste offene Schritt');
  pruefe(heute && /passtZumTag\(/.test(heute[0]),
         'der Kontextfilter des Tages greift auch darauf');
  const tag = skript.match(/function tagZeichnen\([\s\S]*?\n\}\n/);
  pruefe(tag && /data-kurz="Abläufe"/.test(tag[0]), 'der Tag hat einen Abschnitt dafür');
  pruefe(tag && /schritte\.length\) \{/.test(tag[0]),
         'ohne offenen Schritt bleibt der Abschnitt weg');

  /* Starten erzeugt eine Kopie, keine Verknüpfung */
  const starten = skript.match(/function durchlaufStarten\([\s\S]*?\n\}/);
  pruefe(starten && /schritte\.push\(\{ titel: l\[i\]\.titel/.test(starten[0]),
         'beim Starten werden die Schritte kopiert, nicht geteilt');
  pruefe(starten && /ablaufId: v\.id/.test(starten[0]), 'der Durchlauf merkt sich seine Vorlage');
  pruefe(starten && /v\.zuletzt = isoDatum\(\)/.test(starten[0]),
         'die Vorlage merkt sich, wann sie zuletzt lief');

  /* Beenden ist zurückholbar */
  const beenden = skript.match(/function durchlaufBeenden\([\s\S]*?\n\}/);
  pruefe(beenden && /zurueckHolen = \{ sammlung: 'durchlaeufe'/.test(beenden[0]),
         'ein beendeter Durchlauf landet in der Rückgängig-Ablage');
  const zurueck = skript.match(/function rueckgaengig\([\s\S]*?\n\}/);
  pruefe(zurueck && /zurueckHolen\.sammlung/.test(zurueck[0]),
         'die Ablage gilt für jede Sammlung, nicht nur für Aufgaben');
  pruefe(zurueck && /steine\[i\]\.s === sammlung/.test(zurueck[0]),
         'der Löschvermerk der richtigen Sammlung wird entfernt');

  if (!a) {
    warn('Ablauffunktionen nicht auswertbar');
  } else {
    const e = a.pruefeAblauf();
    pruefe(e.ersterOffen === 'Zwei',
           'nach dem Abhaken rückt der nächste Schritt nach');
    pruefe(e.imTagVorher === 1 && e.imTagNachher === 0,
           'ein vollständig abgehakter Durchlauf verschwindet aus dem Tag');
    pruefe(e.kopiert === true,
           'ein Schritt der Vorlage bleibt unberührt, wenn der Durchlauf abgehakt wird');
    pruefe(e.nachBeenden === 0 && e.grabsteine === 1, 'Beenden entfernt und vermerkt');
    pruefe(e.nachZurueck === 1 && e.grabsteineDanach === 0,
           'Rückgängig holt zurück und räumt den Vermerk weg');
    pruefe(e.vorlagenNachSichern === 1,
           'aus einem einmaligen Durchlauf lässt sich eine Vorlage sichern');
  }
}

/* ============================================================
   45. Meilensteine: Datum, Reihenfolge, Ordnen
   Grund: Das Datum war ein freies Textfeld, die Reihenfolge liess
   sich nicht aendern. Ein Datumsfeld wuerde einen alten Freitext
   stillschweigend verwerfen — das darf nicht geschehen.
   ============================================================ */
console.log('\n45. Meilensteine');
{
  const skript = hauptSkript();
  const m = globalThis.__msApi;

  ['vhMsHoch', 'vhMsOrdnen'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  const detail = skript.match(/function vhDetailHtml\([\s\S]*?\n\}\n/);
  pruefe(detail && /type="date"[\s\S]{0,40}esc\(ms\[m\]\.datum/.test(detail[0]),
         'das Meilensteindatum ist ein echtes Datumsfeld');
  pruefe(detail && !/placeholder="wann"/.test(detail[0]),
         'das alte Freitextfeld ist verschwunden');
  pruefe(detail && /onchange="vhMsDatum/.test(detail[0]),
         'es meldet erst beim Verlassen, nicht bei jedem Zeichen');
  pruefe(detail && /vhMsHoch\(/.test(detail[0]), 'jeder Meilenstein lässt sich hochschieben');
  pruefe(detail && /Nach Datum ordnen/.test(detail[0]),
         'ordnen geschieht auf Knopfdruck');
  pruefe(detail && /ms\.length > 1/.test(detail[0]),
         'bei nur einem Meilenstein bleibt der Knopf weg');

  /* Nicht von selbst sortieren */
  const setzen = skript.match(/function vhMsDatum\([\s\S]*?\n\}/);
  pruefe(setzen && !/sort\(/.test(setzen[0]),
         'ein eingetragenes Datum sortiert die Liste nicht von selbst um');

  const ordnen = skript.match(/function vhMsOrdnen\([\s\S]*?\n\}/);
  pruefe(ordnen && /ohne\.push/.test(ordnen[0]),
         'Meilensteine ohne Datum behalten ihre Stelle am Ende');

  /* Altbestand */
  const stempeln = skript.match(/function bestandStempeln\([\s\S]*?\n\}\n/);
  pruefe(stempeln && /mss\[mi\]\.datum = d\[3\]/.test(stempeln[0]),
         'ein Datum in deutscher Schreibweise wird umgerechnet');
  pruefe(stempeln && /titel = \(mss\[mi\]\.titel \|\| ''\) \+ ' \('/.test(stempeln[0]),
         'ein unlesbarer Wert wird in den Titel gerettet statt verworfen');

  const karte = skript.match(/function projektKarteHtml\([\s\S]*?\n\}\n/);
  pruefe(karte && /erreicht \+ ' von ' \+ alleMs\.length/.test(karte[0]),
         'die Karte zeigt alle Meilensteine mit Stand');

  if (!m) {
    warn('Meilensteinfunktionen nicht auswertbar');
  } else {
    const e = m.pruefeMs();
    pruefe(e.nachHoch === 'B', 'hochschieben vertauscht mit dem Vorgänger');
    pruefe(e.erstesBleibt === 'B', 'das oberste lässt sich nicht weiter hochschieben');
    pruefe(e.geordnet === 'A,C,B', 'nach Datum geordnet stehen sie in Datumsfolge');
    pruefe(e.ohneDatumHinten === 'B', 'das ohne Datum steht am Ende');
    pruefe(e.deutsch === '2026-03-07', 'ein Datum wie 7.3.2026 wird umgerechnet');
    pruefe(e.gerettet === 'Abnahme (kurz vor Ostern)',
           'ein Freitext landet im Titel');
    pruefe(e.gerettetDatum === '', 'und das Feld bleibt leer');
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
