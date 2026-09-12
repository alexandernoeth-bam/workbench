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

/* Der Service Worker liegt neben der HTML-Datei. Er gehört zur
   Auslieferung, also wird er mitgeprüft — fehlt er, sagen die
   betroffenen Prüfungen das, statt stillzuschweigen. */
const SW_PFAD = path.join(path.dirname(path.resolve(DATEI)), 'sw.js');
const SW_QUELLE = fs.existsSync(SW_PFAD) ? fs.readFileSync(SW_PFAD, 'utf8') : '';

/* Für Prüfungen auf „kommt dieser Aufruf vor" zählt nur echter Code.
   Ein Wort in einem Kommentar ist kein Aufruf — sonst schlägt eine
   Prüfung an, weil jemand erklärt hat, warum er etwas gerade NICHT
   tut. */
const SW_CODE = SW_QUELLE
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n')
  .map(function (z) {
    const stelle = z.indexOf('//');
    return (stelle >= 0 && !/:\/\//.test(z.slice(0, stelle + 3))) ? z.slice(0, stelle) : z;
  })
  .join('\n');

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
  /* Nicht jeder Bildschirm gehört in die Leiste: Die Migration wird
     einmal gebraucht, die Vorhabenseite gehört zu „Vorhaben" und wird
     von dort geöffnet. Beide müssen aber erreichbar bleiben. */
  const VERSTECKT = ['Migration', 'Seite'];
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
  const OHNE_KNOPF = ['Migration', 'Seite'];
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
                    'durchlaeufe', 'jahrestermine', 'ferien', 'einfaelle',
                    'kalenderzuordnung'];

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
  pruefe(planen && /setTimeout/.test(planen[0]) && /erneuerungLaufen/.test(planen[0]),
         'erneuerungPlanen stößt den Erneuerungslauf an');
  pruefe(planen && /clearTimeout/.test(planen[0]),
         'erneuerungPlanen räumt eine alte Uhr ab (keine doppelten Timer)');
  const lauf = skript.match(/function erneuerungLaufen\([\s\S]*?\n\}/);
  pruefe(lauf && /anmelden\(true\)/.test(lauf[0]), 'der Lauf meldet still an');
  pruefe(/requestAccessToken\(\{ prompt: aufforderung \}\)/.test(skript),
         'die Art der Nachfrage wird durchgereicht');

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
    indexedDB: null, innerHeight: 800, innerWidth: 1400,
    setInterval, clearInterval, caches: null,
    matchMedia() { return { matches: false }; },
    fetch() { return Promise.reject(new Error('kein Netz im Test')); },
    google: null
  };
  /* Ein Platzhalter für die Zeichenfläche. Früher gab er für jede
     Kennung null zurück; dann scheiterte jede Prüfung, die eine
     Zeichenfunktion aufruft, an einem Fehler in der Umgebung statt an
     der Sache. Jetzt liefert er ein taugliches Element und merkt es
     sich, damit man hinterher hineinsehen kann. */
  const flaeche = {};
  const platzhalterElement = function (id) {
    return {
      id: id, innerHTML: '', textContent: '', value: '', href: '',
      style: {}, scrollTop: 0, scrollHeight: 100, clientHeight: 800,
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener() {}, removeEventListener() {}, focus() {}, click() {},
      appendChild() {}, removeChild() {}, setAttribute() {},
      getBoundingClientRect() { return { top: 0, bottom: 800, height: 800 }; },
      querySelectorAll() { return []; }
    };
  };
  global.document = {
    title: '',
    getElementById(id) {
      if (!flaeche[id]) { flaeche[id] = platzhalterElement(id); }
      return flaeche[id];
    },
    createElement() { return platzhalterElement('neu'); },
    head: { appendChild() {} },
    body: { classList: { add() {}, remove() {} }, appendChild() {}, removeChild() {} },
    documentElement: { style: { setProperty() {} } },
    addEventListener() {}
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
                 + 'globalThis.__abAnlageApi = {'
                 + ' pruefeAnlagen: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   DB.ablaeufe = [{ id:\'v1\', name:\'Bauantrag\','
                 + '     kontext:\'privat\', schritte:[{ id:\'s1\', titel:\'A\','
                 + '     auf:false }], anlagen:[{ id:\'an1\', name:\'Checkliste\','
                 + '     url:\'https://drive.example/x\' }], wiederholung:null,'
                 + '     anlassAufgabeId:null, projektId:null, zielId:null,'
                 + '     zuletzt:\'\', zuletztGestartet:\'\' }];'
                 + '   durchlaufStarten(\'v1\', true);'
                 + '   var d = DB.durchlaeufe[0];'
                 + '   var r = { anVorlage: abAnlagen(DB.ablaeufe[0]).length,'
                 + '             imDurchlauf: abAnlagen(d).length,'
                 + '             name: abAnlagen(d)[0].name };'
                 + '   abDetail = d.id; abDetailArt = \'durchlauf\';'
                 + '   abAnlageWeg(0);'
                 + '   r.nachEntfernen = abAnlagen(d).length;'
                 + '   r.vorlageUnberuehrt = abAnlagen(DB.ablaeufe[0]).length;'
                 + '   r.eigeneListe = (r.vorlageUnberuehrt === 1);'
                 + '   abDetail = \'\'; abDetailArt = \'\'; DB = alt;'
                 + '   return r;'
                 + ' } };'
                 + 'globalThis.__seiteApi = {'
                 + ' pruefeSeite: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   var p = { id:\'p1\', name:\'Garage\', kontext:\'privat\','
                 + '     status:\'laufend\', zielzustaende:[], festlegungen:[],'
                 + '     anlagen:[{ name:\'Plan.pdf\', quelle:\'Drive\' }],'
                 + '     meilensteine:[{ titel:\'Antrag\', datum:\'2026-10-01\','
                 + '       erreicht:true }, { titel:\'Platte\', datum:\'\','
                 + '       erreicht:false }] };'
                 + '   DB.projekte = [p];'
                 + '   DB.aufgaben = ['
                 + '     { id:\'a1\', titel:\'Angebote\', kontext:\'privat\','
                 + '       projektId:\'p1\', status:\'offen\', planung:\'woche\','
                 + '       art:\'haupt\' },'
                 + '     { id:\'a2\', titel:\'Massband\', kontext:\'privat\','
                 + '       projektId:\'p1\', status:\'offen\', planung:\'backlog\','
                 + '       art:\'klein\' },'
                 + '     { id:\'a3\', titel:\'Vermesser\', kontext:\'privat\','
                 + '       projektId:\'p1\', status:\'erledigt\', planung:\'backlog\','
                 + '       art:\'haupt\' } ];'
                 + '   DB.durchlaeufe = [{ id:\'d1\', name:\'Antrag\','
                 + '     kontext:\'privat\', projektId:\'p1\','
                 + '     schritte:[{ titel:\'F\', fertig:false }] }];'
                 + '   zustandSetzen(p, \'Bodenplatte ist gegossen\');'
                 + '   seiteFuer = \'p1\'; seiteArt = \'projekt\'; seiteZu = {};'
                 + '   p.festlegungen.push({ id:\'f1\', stichwort:\'Grundfläche\','
                 + '     inhalt:\'6 x 9 m\', seit: isoDatum() });'
                 + '   p.festlegungen.push({ id:\'f2\', stichwort:\'Torbreite\','
                 + '     inhalt:\'3,50 m\', seit: isoDatum() });'
                 + '   seiteZeichnen();'
                 + '   var h = document.getElementById(\'seiteBlatt\').innerHTML;'
                 + '   var namen = [];'
                 + '   (h.match(/sa-name">([^<]*)/g) || []).forEach(function(x){'
                 + '     namen.push(x.replace(/.*">/, \'\')); });'
                 + '   var zahlen = [];'
                 + '   (h.match(/sa-zahl">([^<]*)/g) || []).forEach(function(x){'
                 + '     zahlen.push(x.replace(/.*">/, \'\')); });'
                 + '   var r = { abschnitte: namen,'
                 + '             erledigtSichtbar: (h.indexOf(\'Vermesser\') >= 0),'
                 + '             msStand: zahlen[0],'
                 + '             zustand: (h.match(/sk-zustand">([^<]*)/) || [])[1],'
                 + '             festGesetzt: festlegungen(p).length };'
                 + '   festlegungSetzen(\'f2\', \'inhalt\', \'4,00 m\');'
                 + '   r.festGeaendert = festlegungen(p)[1].inhalt;'
                 + '   r.festAnzahlBleibt = festlegungen(p).length;'
                 + '   seiteZu[\'Festlegungen\'] = true;'
                 + '   seiteZeichnen();'
                 + '   r.nachEinklappen = (document.getElementById(\'seiteBlatt\')'
                 + '     .innerHTML.indexOf(\'Grundfläche\') >= 0);'
                 + '   seiteAufgabeHaken(\'a1\');'
                 + '   r.hakenWirkt = DB.aufgaben[0].status;'
                 + '   seiteFuer = \'\'; seiteArt = \'\'; seiteZu = {}; DB = alt;'
                 + '   return r;'
                 + ' } };'
                 + 'globalThis.__klammerApi = {'
                 + ' pruefeKlammer: function(){'
                 + '   var alt = DB; var merkTag = tagOffen; DB = leereDatenbank();'
                 + '   var heute = isoDatum(); tagOffen = heute;'
                 + '   DB.aufgaben = ['
                 + '     { id:\'a1\', titel:\'Muster besprechen\', kontext:\'privat\','
                 + '       status:\'offen\', planung: heute, art:\'haupt\' },'
                 + '     { id:\'a2\', titel:\'Fenster ausmessen\', kontext:\'privat\','
                 + '       status:\'offen\', planung:\'backlog\', art:\'haupt\' } ];'
                 + '   DB.durchlaeufe = ['
                 + '     { id:\'d1\', name:\'Haustür erneuern\', kontext:\'privat\','
                 + '       frist: heute, schritte:[{ titel:\'x\', aufgabeId:\'a1\' },'
                 + '         { titel:\'y\', aufgabeId:\'a2\' },'
                 + '         { titel:\'Angebot\', fertig:false }] },'
                 + '     { id:\'d2\', name:\'Ruht\', kontext:\'privat\','
                 + '       frist: tagePlus(heute,30), schritte:[{ titel:\'Spaeter\','
                 + '         fertig:false, ab: tagePlus(heute,5) }] } ];'
                 + '   var l = durchlaeufeHeute(heute);'
                 + '   var namen = l.map(function(d){ return d.name; });'
                 + '   tagAblaufAuf = {};'
                 + '   var zu = ablaufKlammerHtml(DB.durchlaeufe[0], heute);'
                 + '   tagAblaufAuf[\'d1\'] = true;'
                 + '   var auf = ablaufKlammerHtml(DB.durchlaeufe[0], heute);'
                 + '   var titel = [];'
                 + '   var m = auf.match(/ttitel">([^<]*)/g) || [];'
                 + '   m.forEach(function(x){ titel.push(x.replace(/.*">/, \'\')); });'
                 + '   var r = { imTag: namen[0],'
                 + '             ruhenderDraussen: (namen.indexOf(\'Ruht\') < 0),'
                 + '             eingeklapptOhneSchritte: (zu.match(/tzeile kompakt/g) || []).length,'
                 + '             aufgeklappt: (auf.match(/tzeile kompakt/g) || []).length,'
                 + '             mitAufgabeDrin: (titel.indexOf(\'Muster besprechen\') >= 0),'
                 + '             vermerk: (auf.match(/tmeta">([^<]*)/) || [])[1],'
                 + '             stand: (zu.match(/tablauf-stand">([^<]*)/) || [])[1],'
                 + '             fristText: (zu.match(/tablauf-meta[^>]*>([^<]*)/) || [])[1] };'
                 + '   tagAblaufAuf = {}; tagOffen = merkTag; DB = alt;'
                 + '   return r;'
                 + ' } };'
                 + 'globalThis.__einfallApi = {'
                 + ' pruefeEinfaelle: function(){'
                 + '   var alt = DB; var merkTag = tagOffen; DB = leereDatenbank();'
                 + '   var heute = isoDatum(); tagOffen = heute;'
                 + '   [\'Toskana mit dem Rad p\', \'Schweissen lernen p\','
                 + '    \'Tauchschein p\'].forEach(function(t){ einfallNeu(t); });'
                 + '   var erster = DB.einfaelle[0];'
                 + '   var ohneDatum = Object.keys(erster).filter(function(k){'
                 + '     return /frist|planung|uhrzeit/.test(k); }).length === 0;'
                 + '   einfallDetail = erster.id;'
                 + '   einfallWirdVorhaben(\'projekt\');'
                 + '   einfallStand(DB.einfaelle[1].id, \'verworfen\');'
                 + '   var e = tagesEintraege(heute);'
                 + '   var imTag = e.haupt.length + e.klein.length'
                 + '             + e.wieder.length + e.verlauf.length;'
                 + '   var r = { gemerkt: DB.einfaelle.length,'
                 + '             kontextGedeutet: erster.kontext,'
                 + '             titelSauber: erster.titel,'
                 + '             ohneDatumsfelder: ohneDatum,'
                 + '             nachProjekt: DB.projekte.length,'
                 + '             standVerfolgt: erster.stand,'
                 + '             bleibtErhalten: DB.einfaelle.length,'
                 + '             offen: einfaelleSichtbar(\'offen\').length,'
                 + '             verfolgt: einfaelleSichtbar(\'verfolgt\').length,'
                 + '             verworfen: einfaelleSichtbar(\'verworfen\').length,'
                 + '             imTagesplan: imTag, amSymbol: offeneHeute() };'
                 + '   einfallDetail = \'\'; tagOffen = merkTag; DB = alt;'
                 + '   return r;'
                 + ' } };'
                 + 'globalThis.__dublettenApi = {'
                 + ' pruefeDubletten: function(){'
                 + '   var alt = DB; var merkTag = tagOffen; DB = leereDatenbank();'
                 + '   var heute = isoDatum();'
                 + '   tagOffen = heute;'
                 + '   DB.aufgaben = ['
                 + '     { id:\'a1\', titel:\'Offerings anlegen\', kontext:\'beruflich\','
                 + '       status:\'offen\', planung: heute, art:\'haupt\' },'
                 + '     { id:\'a2\', titel:\'Ungeplant\', kontext:\'beruflich\','
                 + '       status:\'offen\', planung:\'backlog\', art:\'haupt\' } ];'
                 + '   DB.durchlaeufe = ['
                 + '     { id:\'d1\', name:\'SMAX Teil 1\', kontext:\'beruflich\','
                 + '       schritte:[{ titel:\'x\', aufgabeId:\'a1\' }] },'
                 + '     { id:\'d2\', name:\'SMAX Teil 2\', kontext:\'beruflich\','
                 + '       schritte:[{ titel:\'y\', aufgabeId:\'a2\' }] },'
                 + '     { id:\'d3\', name:\'Eigener\', kontext:\'beruflich\','
                 + '       schritte:[{ titel:\'Reiner Schritt\', fertig:false }] } ];'
                 + '   var e = tagesEintraege(heute);'
                 + '   var imTag = e.haupt.map(function(x){ return x.titel; });'
                 + '   var schritte = ablaufSchritteHeute(heute).map(function(x){'
                 + '     return schrittTitel(x.satz); });'
                 + '   var vermerk = ablaufVermerk(DB.aufgaben[0]);'
                 + '   var zahl = offeneHeute();'
                 + '   DB.durchlaeufe[1].schritte[0].aufgabeId = \'a1\';'
                 + '   var zwei = ablaufVermerk(DB.aufgaben[0]);'
                 + '   tagOffen = merkTag; DB = alt;'
                 + '   var zaehl = function(t){'
                 + '     var n = 0;'
                 + '     if (imTag.indexOf(t) >= 0) { n++; }'
                 + '     if (schritte.indexOf(t) >= 0) { n++; }'
                 + '     return n; };'
                 + '   return { geplantEinmal: zaehl(\'Offerings anlegen\'),'
                 + '            ungeplantUeberAblauf: zaehl(\'Ungeplant\'),'
                 + '            reinerSchritt: zaehl(\'Reiner Schritt\'),'
                 + '            vermerk: vermerk, zweiAblaeufe: zwei,'
                 + '            zahlAmSymbol: zahl };'
                 + ' } };'
                 + 'globalThis.__vorausApi = {'
                 + ' pruefeVoraus: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   var heute = isoDatum();'
                 + '   tagOffen = heute; tagFilter = \'beruflich\';'
                 + '   DB.aufgaben = ['
                 + '     { id:\'a1\', titel:\'Heute\', kontext:\'beruflich\','
                 + '       status:\'offen\', planung: heute, art:\'haupt\' },'
                 + '     { id:\'a2\', titel:\'Morgen\', kontext:\'beruflich\','
                 + '       status:\'offen\', planung: tagePlus(heute,1), art:\'haupt\' },'
                 + '     { id:\'a4\', titel:\'Spaet\', kontext:\'beruflich\','
                 + '       status:\'offen\', planung: tagePlus(heute,30), art:\'haupt\' } ];'
                 + '   var t = vorausRechnen();'
                 + '   var r = { tage: Object.keys(t).length, heute: t[heute],'
                 + '             morgen: t[tagePlus(heute,1)],'
                 + '             leererTag: t[tagePlus(heute,5)],'
                 + '             weitDrausen: t[tagePlus(heute,30)],'
                 + '             tagUnveraendert: (tagOffen === heute),'
                 + '             filterUnveraendert: tagFilter };'
                 + '   tagFilter = \'alle\'; DB = alt;'
                 + '   return r;'
                 + ' } };'
                 + 'globalThis.__badgeApi = {'
                 + ' pruefeBadge: function(){'
                 + '   var alt = DB; var merkTag = tagOffen; var merkF = tagFilter;'
                 + '   DB = leereDatenbank();'
                 + '   var heute = isoDatum();'
                 + '   var std = Number(uhrzeitJetzt().slice(0,2));'
                 + '   var f = String(Math.max(0, std - 2)); if (f.length < 2) { f = \'0\' + f; }'
                 + '   var s = String(Math.min(23, std + 2)); if (s.length < 2) { s = \'0\' + s; }'
                 + '   f += \':00\'; s += \':00\';'
                 + '   tagOffen = heute; tagFilter = \'alle\';'
                 + '   DB.aufgaben = ['
                 + '     { id:\'a1\', titel:\'Haupt\', kontext:\'beruflich\','
                 + '       status:\'offen\', planung: heute, art:\'haupt\' },'
                 + '     { id:\'a2\', titel:\'Klein\', kontext:\'privat\','
                 + '       status:\'offen\', planung: heute, art:\'klein\' },'
                 + '     { id:\'a3\', titel:\'Fertig\', kontext:\'beruflich\','
                 + '       status:\'erledigt\', erledigtAm: heute, planung: heute, art:\'haupt\' },'
                 + '     { id:\'a4\', titel:\'Woechentlich\', kontext:\'beruflich\','
                 + '       status:\'offen\', planung:\'backlog\', art:\'haupt\','
                 + '       wiederholung:{ takt:\'woche\', intervall:1,'
                 + '       tage:[0,1,2,3,4,5,6], tag:1 } },'
                 + '     { id:\'a5\', titel:\'Spaeter\', kontext:\'beruflich\','
                 + '       status:\'offen\', planung:\'2099-01-01\', art:\'haupt\' } ];'
                 + '   DB.durchlaeufe = [{ id:\'d1\', name:\'Ablauf\','
                 + '     kontext:\'beruflich\', schritte:[{ titel:\'S\', fertig:false }] }];'
                 + '   termineNachTag = {};'
                 + '   merkeTermin(heute, { id:\'g1\', titel:\'Vorbei\', zeit:f, bis:f,'
                 + '     ort:\'\', ganztags:false, quelle:\'A\', kontext:\'beruflich\' });'
                 + '   merkeTermin(heute, { id:\'g2\', titel:\'Kommt\', zeit:s, bis:s,'
                 + '     ort:\'\', ganztags:false, quelle:\'A\', kontext:\'beruflich\' });'
                 + '   var gesamt = offeneHeute();'
                 + '   tagFilter = \'beruflich\';'
                 + '   var egal = offeneHeute();'
                 + '   tagFilter = \'alle\';'
                 + '   aufgabeErledigen(\'a1\'); aufgabeErledigen(\'a2\');'
                 + '   badgeSetzen();'
                 + '   var nach = offeneHeute();'
                 + '   var titel = document.title;'
                 + '   termineNachTag = {}; tagOffen = merkTag; tagFilter = merkF; DB = alt;'
                 + '   return { gesamt:gesamt, erledigtZaehltNicht:(gesamt === 5),'
                 + '            andererTagZaehltNicht:(gesamt === 5),'
                 + '            vorbeiZaehltNicht:(gesamt === 5), filterEgal:egal,'
                 + '            nachHaken:nach, titel:titel, version:APP_VERSION };'
                 + ' } };'
                 + 'globalThis.__abhakApi = {'
                 + ' pruefeAbhaken: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   var heute = isoDatum();'
                 + '   DB.aufgaben = [{ id:\'a1\', titel:\'Offerings anlegen\','
                 + '     kontext:\'beruflich\', status:\'offen\', planung:\'backlog\','
                 + '     art:\'haupt\' }];'
                 + '   DB.durchlaeufe = [{ id:\'d1\', name:\'Besprechung\','
                 + '     kontext:\'beruflich\', terminTag: heute, schritte:['
                 + '       { titel:\'Agenda\', fertig:true },'
                 + '       { titel:\'x\', aufgabeId:\'a1\' },'
                 + '       { titel:\'Protokoll\', fertig:false } ] }];'
                 + '   abhakFuer = \'d1\';'
                 + '   var h = abhakHtml();'
                 + '   var zeilen = (h.match(/class="tzeile/g) || []).length;'
                 + '   var stand = (h.match(/as-meta">([^<·]*)/) || [])[1];'
                 + '   var r = { zeilen: zeilen, stand: stand.trim(),'
                 + '             titelAusAufgabe: h.indexOf(\'Offerings anlegen\') >= 0,'
                 + '             ohneFelder: h.indexOf(\'<textarea\') < 0'
                 + '                         && h.indexOf(\'<input\') < 0 };'
                 + '   schrittUm(\'d1\', 1);'
                 + '   var h2 = abhakHtml();'
                 + '   r.nachHaken = ((h2.match(/as-meta">([^<·]*)/) || [])[1] || \'\').trim();'
                 + '   r.aufgabeErledigt = DB.aufgaben[0].status;'
                 + '   abhakFuer = \'\'; DB = alt;'
                 + '   return r;'
                 + ' } };'
                 + 'globalThis.__traegerApi = {'
                 + ' pruefeTraeger: function(){'
                 + '   var alt = DB; var merkAkt = aktionFuer; DB = leereDatenbank();'
                 + '   DB.aufgaben = [{ id:\'a1\', titel:\'Offerings anlegen\','
                 + '     kontext:\'beruflich\', status:\'offen\', planung:\'backlog\','
                 + '     art:\'haupt\' }];'
                 + '   DB.durchlaeufe = ['
                 + '     { id:\'d1\', name:\'Teil 1\', kontext:\'beruflich\','
                 + '       schritte:[{ titel:\'x\', aufgabeId:\'a1\' },'
                 + '                 { titel:\'Eigener\', fertig:false }] },'
                 + '     { id:\'d2\', name:\'Teil 2\', kontext:\'beruflich\','
                 + '       schritte:[{ titel:\'y\', aufgabeId:\'a1\' }] },'
                 + '     { id:\'d3\', name:\'Besprechung\', kontext:\'beruflich\','
                 + '       schritte:[{ titel:\'z\', aufgabeId:\'a1\' }] } ];'
                 + '   var stand = function(){ return DB.durchlaeufe.map(function(d){'
                 + '     return schritteFertig(d); }).join(\',\'); };'
                 + '   var titel = schrittTitel(DB.durchlaeufe[0].schritte[0]);'
                 + '   var vorher = stand();'
                 + '   schrittUm(\'d1\', 0);'
                 + '   var nachHaken = stand();'
                 + '   var status = DB.aufgaben[0].status;'
                 + '   var eigener = schrittFertig(DB.durchlaeufe[0].schritte[1]);'
                 + '   schrittUm(\'d3\', 0);'
                 + '   var zurueck = stand();'
                 + '   aufgabeErledigen(\'a1\');'
                 + '   var ueberTag = stand();'
                 + '   var weiss = durchlaeufeZuAufgabe(\'a1\').length;'
                 + '   aktionFuer = \'a1\';'
                 + '   aufgabeLoeschen();'
                 + '   var nachTitel = DB.durchlaeufe[0].schritte[0].titel;'
                 + '   var nachStand = stand();'
                 + '   DB.aufgaben.push({ id:\'k1\', titel:\'Ordner holen\','
                 + '     kontext:\'beruflich\', status:\'offen\', planung:\'backlog\','
                 + '     art:\'klein\' });'
                 + '   DB.durchlaeufe[1].schritte.push({ titel:\'q\', aufgabeId:\'k1\' });'
                 + '   aufgabeErledigen(\'k1\');'
                 + '   var kleinTraegt = schrittFertig('
                 + '     DB.durchlaeufe[1].schritte[DB.durchlaeufe[1].schritte.length - 1]);'
                 + '   aktionFuer = merkAkt; zurueckHolen = null; DB = alt;'
                 + '   return { titelAusAufgabe:titel, vorher:vorher, nachHaken:nachHaken,'
                 + '            aufgabeErledigt:status, nachRuecknahme:zurueck,'
                 + '            ueberTagesplan:ueberTag,'
                 + '            eigenerSchrittUnberuehrt:eigener, weissVon:weiss,'
                 + '            nachLoeschenTitel:nachTitel, nachLoeschenStand:nachStand,'
                 + '            kleinigkeitTraegt:kleinTraegt };'
                 + ' } };'
                 + 'globalThis.__artApi = {'
                 + ' pruefeArten: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   kalenderListe = [{ id:\'a\', name:\'Familie\' }];'
                 + '   termineNachTag = {};'
                 + '   eintraegeEinsortieren(['
                 + '     { id:\'g1\', summary:\'Kreta #urlaub\','
                 + '       start:{ date:\'2026-08-03\' }, end:{ date:\'2026-08-04\' } },'
                 + '     { id:\'g2\', summary:\'Werksbesuch\','
                 + '       description:\'Anreise #dienstreise\','
                 + '       start:{ date:\'2026-08-10\' }, end:{ date:\'2026-08-11\' } },'
                 + '     { id:\'g3\', summary:\'Kur #kur\','
                 + '       start:{ date:\'2026-08-12\' }, end:{ date:\'2026-08-13\' } },'
                 + '     { id:\'g4\', summary:\'Ohne alles\','
                 + '       start:{ date:\'2026-08-14\' }, end:{ date:\'2026-08-15\' } } ],'
                 + '     \'Familie\', \'privat\');'
                 + '   var r = {'
                 + '     ausTitel: jtAn(\'2026-08-03\')[0].art,'
                 + '     ausBeschreibung: jtAn(\'2026-08-10\')[0].art,'
                 + '     titelSauber: jtAn(\'2026-08-03\')[0].titel,'
                 + '     neueArt: jtAn(\'2026-08-12\')[0].art,'
                 + '     neueArtName: artName(\'kur\'),'
                 + '     neueArtFarbe: artFarbe(\'kur\'),'
                 + '     farbeStabil: (artFarbeAus(\'kur\') === artFarbeAus(\'kur\')),'
                 + '     ohneKuerzel: jtAn(\'2026-08-14\')[0].art,'
                 + '     inArtenListe: (artenAlle().indexOf(\'kur\') >= 0),'
                 + '     urlaubMachtFrei: tagesform(\'2026-08-03\').form,'
                 + '     keineDublette: tagesEintraege(\'2026-08-03\').ganztags.length };'
                 + '   zuordnungSetzen(\'g1\', \'krank\');'
                 + '   r.zuordnungGewinnt = jtAn(\'2026-08-03\')[0].art;'
                 + '   termineNachTag = {}; kalenderListe = []; DB = alt;'
                 + '   return r;'
                 + ' } };'
                 + 'globalThis.__terminVerbindungApi = {'
                 + ' pruefeVerbindung: function(){'
                 + '   var alt = DB; var merkTag = tagOffen; DB = leereDatenbank();'
                 + '   var heute = isoDatum();'
                 + '   termineNachTag = {};'
                 + '   merkeTermin(heute, { id:\'g1\', titel:\'Abstimmung\', zeit:\'14:00\','
                 + '     bis:\'15:00\', ort:\'\', ganztags:false, quelle:\'Alex\','
                 + '     kontext:\'beruflich\' });'
                 + '   merkeTermin(heute, { id:\'g2\', titel:\'Zweiter\', zeit:\'16:00\','
                 + '     bis:\'17:00\', ort:\'\', ganztags:false, quelle:\'Alex\','
                 + '     kontext:\'beruflich\' });'
                 + '   DB.durchlaeufe = ['
                 + '     { id:\'d1\', name:\'ALM\', kontext:\'beruflich\', ablaufId:null,'
                 + '       terminId:null, frist:\'\','
                 + '       schritte:[{ titel:\'A\', fertig:true }, { titel:\'B\', fertig:false }] },'
                 + '     { id:\'d2\', name:\'Mit Frist\', kontext:\'beruflich\', ablaufId:null,'
                 + '       terminId:null, frist:\'2026-12-24\','
                 + '       schritte:[{ titel:\'C\', fertig:false }] } ];'
                 + '   tagOffen = heute;'
                 + '   terminDurchlaufAnhaengen(\'d1\', \'g1\', heute);'
                 + '   var d = durchlaufZuTermin(\'g1\');'
                 + '   var stand = d.schritte[0].fertig === true && d.schritte[1].fertig === false;'
                 + '   var ohneRuhen = !d.schritte[1].ab;'
                 + '   var fristGesetzt = (d.frist === heute);'
                 + '   terminDurchlaufAnhaengen(\'d2\', \'g2\', heute);'
                 + '   var fristBleibt = durchlaufFinden(\'d2\').frist;'
                 + '   terminAblaufLoesen(\'d1\');'
                 + '   var nachLoesen = durchlaufZuTermin(\'g1\');'
                 + '   var bleibt = !!durchlaufFinden(\'d1\');'
                 + '   DB.durchlaeufe.push({ id:\'d3\', name:\'Workshop\','
                 + '     kontext:\'beruflich\', ablaufId:null, terminId:\'g1\','
                 + '     terminTag:heute, frist:heute, schritte:[] });'
                 + '   var neu = durchlaufZuTermin(\'g1\');'
                 + '   termineNachTag = {}; tagOffen = merkTag; DB = alt;'
                 + '   return { verknuepft: d.name, standBleibt: stand, ohneRuhen: ohneRuhen,'
                 + '            fristGesetzt: fristGesetzt, fristBleibt: fristBleibt,'
                 + '            nachLoesen: nachLoesen, bleibtErhalten: bleibt,'
                 + '            neuerName: neu.name, neuerOhneVorlage: (neu.ablaufId === null),'
                 + '            neuerAmTermin: (neu.terminId === \'g1\') };'
                 + ' } };'
                 + 'globalThis.__kleinApi = {'
                 + ' pruefeKlein: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   var heute = isoDatum();'
                 + '   var mo = montagVon(heute);'
                 + '   DB.aufgaben = ['
                 + '     { id:\'k1\', titel:\'Batterien\', kontext:\'privat\','
                 + '       status:\'offen\', planung:\'woche\', art:\'klein\', frist: heute },'
                 + '     { id:\'k2\', titel:\'Ablegen\', kontext:\'beruflich\','
                 + '       status:\'offen\', planung: tagePlus(mo,2), art:\'klein\' },'
                 + '     { id:\'k3\', titel:\'Fertig\', kontext:\'beruflich\','
                 + '       status:\'erledigt\', planung: mo, art:\'klein\' },'
                 + '     { id:\'k4\', titel:\'Naechste\', kontext:\'beruflich\','
                 + '       status:\'offen\', planung:\'naechste\', art:\'klein\' },'
                 + '     { id:\'k5\', titel:\'Woechentlich\', kontext:\'beruflich\','
                 + '       status:\'offen\', planung: mo, art:\'klein\','
                 + '       wiederholung:{ takt:\'woche\', intervall:1, tage:[1], tag:1 } },'
                 + '     { id:\'a1\', titel:\'Hauptaufgabe\', kontext:\'beruflich\','
                 + '       status:\'offen\', planung:\'woche\', art:\'haupt\' } ];'
                 + '   var l = wochenKleinigkeiten(mo);'
                 + '   var titel = l.map(function(x){ return x.titel; });'
                 + '   var r = { anzahl:l.length, offen:wochenKleinOffen(mo),'
                 + '             mitFristZuerst: titel[0],'
                 + '             hauptNichtDrin: titel.indexOf(\'Hauptaufgabe\') < 0,'
                 + '             naechsteNichtDrin: titel.indexOf(\'Naechste\') < 0,'
                 + '             erledigtDrin: titel.indexOf(\'Fertig\') >= 0,'
                 + '             wiederkehrendDrin: titel.indexOf(\'Woechentlich\') >= 0 };'
                 + '   DB = alt; return r;'
                 + ' } };'
                 + 'globalThis.__monatSpaltenApi = {'
                 + ' pruefeMonatSpalten: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   var h = monatHtml(\'2026-09-01\');'
                 + '   var teile = h.split(\'mhaelfte-rechts\');'
                 + '   var links = (teile[0].match(/class="mtag/g) || []).length;'
                 + '   var rechts = (teile[1].match(/class="mtag/g) || []).length;'
                 + '   var auf = (h.match(/<div/g) || []).length;'
                 + '   var zu = (h.match(/<\\/div>/g) || []).length;'
                 + '   var lang = monatHtml(\'2026-01-01\');'
                 + '   var alleTage = (lang.match(/class="mtag/g) || []).length;'
                 + '   DB = alt;'
                 + '   return { h28: monatsHaelfte(28), h29: monatsHaelfte(29),'
                 + '            h30: monatsHaelfte(30), h31: monatsHaelfte(31),'
                 + '            linksSeptember: links, rechtsSeptember: rechts,'
                 + '            ausgeglichen: (auf === zu), alleTageDa: alleTage };'
                 + ' } };'
                 + 'globalThis.__terminAblaufApi = {'
                 + ' pruefeTermin: function(){'
                 + '   var alt = DB; var merkTag = tagOffen; DB = leereDatenbank();'
                 + '   var heute = isoDatum();'
                 + '   var std = Number(uhrzeitJetzt().slice(0,2));'
                 + '   var spaet = String(Math.min(23, std + 3));'
                 + '   if (spaet.length < 2) { spaet = \'0\' + spaet; }'
                 + '   spaet = spaet + \':00\';'
                 + '   DB.ablaeufe = [{ id:\'v1\', name:\'Besprechung\','
                 + '     kontext:\'beruflich\', schritte:['
                 + '       { id:\'s1\', titel:\'Agenda\', auf:false, wann:\'davor\' },'
                 + '       { id:\'s2\', titel:\'Protokoll\', auf:false, wann:\'danach\' } ],'
                 + '     wiederholung:null, anlassAufgabeId:null, projektId:null,'
                 + '     zielId:null, zuletzt:\'\', zuletztGestartet:\'\' }];'
                 + '   termineNachTag = {};'
                 + '   merkeTermin(heute, { id:\'g1\', titel:\'JF-Weekly\', zeit:spaet,'
                 + '     bis:spaet, ort:\'\', ganztags:false, quelle:\'Alex\','
                 + '     kontext:\'beruflich\' });'
                 + '   tagOffen = heute;'
                 + '   terminDurchlaufStarten(\'v1\', { id:\'g1\', titel:\'JF-Weekly\','
                 + '     zeit:spaet, bis:spaet }, heute);'
                 + '   var d = durchlaufZuTermin(\'g1\');'
                 + '   var danachZeit = d.schritte[1].abZeit;'
                 + '   var vor = ablaufSchritteHeute(heute).map(function(x){ return x.satz.titel; }).join(\',\');'
                 + '   schrittUm(d.id, 0);'
                 + '   var nachAgenda = ablaufSchritteHeute(heute).map(function(x){ return x.satz.titel; }).join(\',\');'
                 + '   d.schritte[1].abZeit = \'00:01\';'
                 + '   var nachTermin = ablaufSchritteHeute(heute).map(function(x){ return x.satz.titel; }).join(\',\');'
                 + '   var schon = durchlaufZuTermin(\'g1\') ? 1 : 0;'
                 + '   var r = { name:d.name, terminId:d.terminId,'
                 + '             davorOhneRuhen: !d.schritte[0].ab,'
                 + '             danachMitZeit: danachZeit, terminEnde: spaet,'
                 + '             vorDemTermin: vor, nachDerAgenda: nachAgenda,'
                 + '             nachDemTermin: nachTermin, zweiterAmTermin: schon };'
                 + '   termineNachTag = {}; tagOffen = merkTag; DB = alt;'
                 + '   return r;'
                 + ' } };'
                 + 'globalThis.__wocheApi = {'
                 + ' pruefeWoche: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   var mo = montagVon(\'2026-09-09\');'
                 + '   DB.aufgaben = ['
                 + '     { id:\'a1\', titel:\'Am Dienstag\', kontext:\'beruflich\','
                 + '       status:\'offen\', planung: tagePlus(mo,1), art:\'haupt\' },'
                 + '     { id:\'a2\', titel:\'Nur diese Woche\', kontext:\'beruflich\','
                 + '       status:\'offen\', planung:\'woche\', art:\'haupt\' },'
                 + '     { id:\'a3\', titel:\'Am Montag, erledigt\', kontext:\'beruflich\','
                 + '       status:\'erledigt\', planung: mo, art:\'haupt\' },'
                 + '     { id:\'a4\', titel:\'Kleinigkeit\', kontext:\'beruflich\','
                 + '       status:\'offen\', planung: mo, art:\'klein\' },'
                 + '     { id:\'a5\', titel:\'Naechste Woche\', kontext:\'beruflich\','
                 + '       status:\'offen\', planung: tagePlus(mo,9), art:\'haupt\' },'
                 + '     { id:\'a6\', titel:\'Im Backlog\', kontext:\'beruflich\','
                 + '       status:\'offen\', planung:\'backlog\', art:\'haupt\' },'
                 + '     { id:\'a7\', titel:\'Woechentlich\', kontext:\'beruflich\','
                 + '       status:\'offen\', planung: mo, art:\'haupt\','
                 + '       wiederholung:{ takt:\'woche\', intervall:1, tage:[1], tag:1 } } ];'
                 + '   var l = wochenAufgaben(mo);'
                 + '   var titel = l.map(function(x){ return x.titel; });'
                 + '   DB = alt;'
                 + '   return { anzahl:l.length, titel:titel.join(\',\'),'
                 + '            kleinigkeitDrin: titel.indexOf(\'Kleinigkeit\') >= 0,'
                 + '            naechsteWocheDrin: titel.indexOf(\'Naechste Woche\') >= 0,'
                 + '            backlogDrin: titel.indexOf(\'Im Backlog\') >= 0,'
                 + '            erledigtDrin: titel.indexOf(\'Am Montag, erledigt\') >= 0,'
                 + '            wiederkehrendDrin: titel.indexOf(\'Woechentlich\') >= 0 };'
                 + ' } };'
                 + 'globalThis.__googleKalApi = {'
                 + ' pruefeAdresse: function(){'
                 + '   var merkA = kalAnker; var merkS = kalStufe;'
                 + '   kalAnker = \'2026-08-10\';'
                 + '   kalStufe = \'woche\'; var w = googleKalenderAdresse();'
                 + '   kalStufe = \'monat\'; var m = googleKalenderAdresse();'
                 + '   kalStufe = \'jahr\';  var j = googleKalenderAdresse();'
                 + '   kalStufe = \'woche\'; var hd = googleKalenderAdresse(true);'
                 + '   var ai = androidKalenderAdresse(\'2026-08-10\');'
                 + '   var ms = Number(ai.match(/time\\/(\\d+)/)[1]);'
                 + '   var ad = new Date(ms);'
                 + '   var zwei = function(n){ return (n < 10 ? \'0\' : \'\') + n; };'
                 + '   var atag = ad.getFullYear() + \'-\' + zwei(ad.getMonth() + 1)'
                 + '            + \'-\' + zwei(ad.getDate());'
                 + '   kalAnker = merkA; kalStufe = merkS;'
                 + '   return { woche:w, monat:m, jahr:j, handy:hd,'
                 + '            androidTag:atag, name:GOOGLE_FENSTER };'
                 + ' } };'
                 + 'globalThis.__abGruppeApi = {'
                 + ' pruefeGruppen: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   DB.projekte = [{ id:\'p1\', name:\'Garage\', kontext:\'privat\','
                 + '     status:\'laufend\', meilensteine:[], zielzustaende:[], anlagen:[] }];'
                 + '   DB.ziele = [{ id:\'z1\', name:\'Gewicht\', kontext:\'privat\','
                 + '     status:\'laufend\', zielzustaende:[], einzahler:[] }];'
                 + '   DB.aufgaben = [{ id:\'a1\', titel:\'Einkauf\', kontext:\'privat\','
                 + '     status:\'offen\', wiederholung:{ takt:\'woche\', intervall:1,'
                 + '     tage:[6], tag:1 } }];'
                 + '   var merk = abGruppierung;'
                 + '   abGruppierung = \'projekt\';'
                 + '   var p = abGruppeVon({ projektId:\'p1\' });'
                 + '   var op = abGruppeVon({});'
                 + '   var weg = abGruppeVon({ projektId:\'gibtesnicht\' });'
                 + '   var liste = [{ id:1 }, { id:2, projektId:\'p1\' }];'
                 + '   var h = abGruppenHtml(liste, function(){ return \'\'; });'
                 + '   var keinZuletzt = h.indexOf(\'Kein Projekt\') > h.indexOf(\'Garage\');'
                 + '   abGruppierung = \'ziel\';'
                 + '   var z = abGruppeVon({ zielId:\'z1\' });'
                 + '   var oz = abGruppeVon({});'
                 + '   abGruppierung = \'aufgabe\';'
                 + '   var a = abGruppeVon({ anlassAufgabeId:\'a1\' });'
                 + '   abGruppierung = \'keine\';'
                 + '   var kg = abGruppeVon({ projektId:\'p1\' });'
                 + '   var flach = abGruppenHtml(liste, function(){ return \'<i></i>\'; });'
                 + '   var ohneKoepfe = flach.indexOf(\'gruppenkopf\') < 0;'
                 + '   abGruppierung = merk; DB = alt;'
                 + '   return { projekt:p, ziel:z, aufgabe:a, ohneProjekt:op,'
                 + '            ohneZiel:oz, gelöschtesProjekt:weg,'
                 + '            keineGruppierung:kg, flachOhneKoepfe:ohneKoepfe,'
                 + '            keinZuletzt:keinZuletzt };'
                 + ' } };'
                 + 'globalThis.__routineApi = {'
                 + ' pruefeRoutine: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   var heute = isoDatum();'
                 + '   var wt = ausIso(heute).getDay();'
                 + '   DB.projekte = [{ id:\'p1\', name:\'P\', kontext:\'beruflich\','
                 + '     status:\'laufend\', meilensteine:[], zielzustaende:[], anlagen:[] }];'
                 + '   DB.ablaeufe = ['
                 + '     { id:\'v1\', name:\'Tagesabschluss\', kontext:\'beruflich\','
                 + '       schritte:[{ id:\'s1\', titel:\'A\', auf:false }],'
                 + '       wiederholung:{ takt:\'woche\', intervall:1, tage:[wt], tag:1 },'
                 + '       anlassAufgabeId:null, projektId:\'p1\', zielId:null,'
                 + '       zuletzt:\'\', zuletztGestartet:\'\' },'
                 + '     { id:\'v2\', name:\'Nach Einkauf\', kontext:\'privat\','
                 + '       schritte:[{ id:\'s2\', titel:\'B\', auf:false }],'
                 + '       wiederholung:null, anlassAufgabeId:\'a1\','
                 + '       projektId:null, zielId:null, zuletzt:\'\', zuletztGestartet:\'\' } ];'
                 + '   DB.aufgaben = [{ id:\'a1\', titel:\'Einkauf\', kontext:\'privat\','
                 + '     status:\'offen\', planung:\'backlog\','
                 + '     wiederholung:{ takt:\'woche\', intervall:1, tage:[6], tag:1 } }];'
                 + '   var faellig = vorlagenFaellig().length;'
                 + '   var gestartet = faelligeStarten();'
                 + '   var geerbt = DB.durchlaeufe[0].projektId;'
                 + '   var zweit = faelligeStarten();'
                 + '   DB.durchlaeufe[0].schritte.forEach(function(s){ s.fertig = true; });'
                 + '   var trotz = faelligeStarten();'
                 + '   var d0 = DB.durchlaeufe[0].id;'
                 + '   durchlaufBeenden(d0);'
                 + '   var nachBeenden = faelligeStarten();'
                 + '   DB.ablaeufe[0].zuletztGestartet = tagePlus(heute, -1);'
                 + '   var morgen = faelligeStarten();'
                 + '   var vorher = DB.durchlaeufe.filter(function(d){ return d.ablaufId === \'v2\'; }).length;'
                 + '   aufgabeErledigen(\'a1\');'
                 + '   var nachAufgabe = DB.durchlaeufe.filter(function(d){ return d.ablaufId === \'v2\'; }).length;'
                 + '   aufgabeErledigen(\'a1\');'
                 + '   var nochmal = DB.durchlaeufe.filter(function(d){ return d.ablaufId === \'v2\'; }).length;'
                 + '   zurueckHolen = null; DB = alt;'
                 + '   return { faelligHeute:faellig, gestartet:gestartet, zweiterLauf:zweit,'
                 + '            trotzErledigt:trotz, nachBeenden:nachBeenden,'
                 + '            amNaechstenTag:morgen, nachAufgabe:nachAufgabe - vorher,'
                 + '            nochmalAbhaken:nochmal, geerbt:geerbt };'
                 + ' } };'
                 + 'globalThis.__jtDateiApi = {'
                 + ' pruefeAustausch: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   var datei = { art: JT_DATEI_ART, eintraege: ['
                 + '     { id:\'a\', titel:\'Kreta\', art:\'urlaub\', kontext:\'privat\','
                 + '       von:\'2026-08-03\', bis:\'2026-08-21\', jaehrlich:true },'
                 + '     { id:\'b\', titel:\'Geburtstag Anna\', art:\'geburtstag\','
                 + '       von:\'2008-03-26\', bis:\'2008-03-26\', jaehrlich:true },'
                 + '     { id:\'c\', titel:\'Werksbesuch\', art:\'dienstreise\','
                 + '       von:\'2026-04-01\', bis:\'2026-04-01\' } ] };'
                 + '   var erst = jtUebernehmen(datei);'
                 + '   var zweit = jtUebernehmen(datei);'
                 + '   var bestand = DB.jahrestermine.length;'
                 + '   var anders = jtUebernehmen({ art: JT_DATEI_ART, eintraege: ['
                 + '     { id:\'ganz-anders\', titel:\'Kreta\', art:\'urlaub\','
                 + '       von:\'2026-08-03\', bis:\'2026-08-21\' } ] });'
                 + '   var fremd = jtUebernehmen({ art:\'etwas-anderes\' });'
                 + '   var leer = jtUebernehmen(null);'
                 + '   DB.jahrestermine[0].titel = \'Mein eigener\';'
                 + '   jtUebernehmen(datei);'
                 + '   var eigenes = DB.jahrestermine[0].titel;'
                 + '   var erster = DB.jahrestermine[0];'
                 + '   var felder = erster.art + \'|\' + erster.kontext + \'|\' + erster.jaehrlich;'
                 + '   DB = alt;'
                 + '   return { erst:erst, zweit:zweit, bestand:bestand,'
                 + '            andereKennung:anders, fremd:fremd, leer:leer,'
                 + '            eigenesBleibt:eigenes, felder:felder };'
                 + ' } };'
                 + 'globalThis.__aufArtApi = {'
                 + ' pruefeArt: function(){'
                 + '   var merkStand = aufGruppeStand; var merkArt = aufArt;'
                 + '   aufGruppeStand = {};'
                 + '   var ohneZu = gruppeOffen(\'Ohne Thema\');'
                 + '   var mitOffen = gruppeOffen(\'Reisen 2026\');'
                 + '   gruppeUm(\'Ohne Thema\');'
                 + '   var nachTippen = gruppeOffen(\'Ohne Thema\');'
                 + '   gruppeUm(\'Ohne Thema\');'
                 + '   var nochmal = gruppeOffen(\'Ohne Thema\');'
                 + '   gruppeUm(\'Reisen 2026\');'
                 + '   var benannt = gruppeOffen(\'Reisen 2026\');'
                 + '   aufArt = \'alle\';'
                 + '   var liste = [{ art:\'haupt\' }, { art:\'klein\' }, {}];'
                 + '   var alleN = liste.filter(passtZurArt).length;'
                 + '   aufArt = \'haupt\';'
                 + '   var hauptN = liste.filter(passtZurArt).length;'
                 + '   var ohneArt = passtZurArt({});'
                 + '   aufArt = \'klein\';'
                 + '   var kleinN = liste.filter(passtZurArt).length;'
                 + '   aufGruppeStand = merkStand; aufArt = merkArt;'
                 + '   return { ohneZu:ohneZu, mitOffen:mitOffen, nachTippen:nachTippen,'
                 + '            nochmal:nochmal, auchBenannteZu:benannt,'
                 + '            alle:alleN, haupt:hauptN, klein:kleinN,'
                 + '            ohneArtGiltAlsAufgabe:ohneArt };'
                 + ' } };'
                 + 'globalThis.__ganztagsApi = {'
                 + ' pruefeGanztags: function(){'
                 + '   var alt = DB; var merk = tagFilter; DB = leereDatenbank();'
                 + '   DB.jahrestermine = [{ id:\'j1\', titel:\'Kreta\', art:\'urlaub\','
                 + '     von:\'2026-01-01\', bis:\'2026-01-01\', kontext:\'privat\' }];'
                 + '   DB.ferien = [{ id:\'f1\', titel:\'Weihnachtsferien\', art:\'ferien\','
                 + '     von:\'2026-01-01\', bis:\'2026-01-01\' }];'
                 + '   kalenderListe = [{ id:\'k\', name:\'Familie\' }];'
                 + '   termineNachTag = {};'
                 + '   eintraegeEinsortieren([{ id:\'g1\', summary:\'Vorort\','
                 + '     start:{ date:\'2026-01-01\' }, end:{ date:\'2026-01-02\' } }],'
                 + '     \'Familie\', \'privat\');'
                 + '   tagFilter = \'alle\';'
                 + '   var e = tagesEintraege(\'2026-01-01\');'
                 + '   var quellen = e.ganztags.map(function(x){ return x.quelle; }).join(\',\');'
                 + '   var mitFarbe = e.ganztags.filter(function(x){ return !!x.farbe; }).length;'
                 + '   tagFilter = \'beruflich\';'
                 + '   var b = tagesEintraege(\'2026-01-01\').ganztags.filter('
                 + '     function(x){ return x.kontext === \'privat\'; }).length;'
                 + '   tagFilter = merk; termineNachTag = {}; kalenderListe = []; DB = alt;'
                 + '   return { anzahl:e.ganztags.length, quellen:quellen,'
                 + '            beruflichNur:b, mitFarbe:mitFarbe };'
                 + ' } };'
                 + 'globalThis.__abSchrittApi = {'
                 + ' pruefeSchritt: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   DB.durchlaeufe = [{ id:\'d1\', name:\'D\', kontext:\'beruflich\','
                 + '     ablaufId:null, start:\'\', frist:\'\', schritte:['
                 + '       { titel:\'Erster\', fertig:true, ab:\'\' },'
                 + '       { titel:\'Zweiter\', fertig:false, ab:\'2026-10-01\' },'
                 + '       { titel:\'\', fertig:false, ab:\'\' } ] }];'
                 + '   abDetail = \'d1\'; abDetailArt = \'durchlauf\';'
                 + '   abSchrittAlsAufgabe(1);'
                 + '   var angelegt = DB.aufgaben.length;'
                 + '   var neu = DB.aufgaben[0];'
                 + '   var verkn = DB.durchlaeufe[0].schritte[1].aufgabeId === neu.id'
                 + '               && neu.ablaufSchritt === \'d1#1\';'
                 + '   abSchrittAlsAufgabe(2);'
                 + '   var ohneTitel = DB.aufgaben.length;'
                 + '   abDetail = \'\'; abDetailArt = \'\'; DB = alt;'
                 + '   return { angelegt:angelegt, titel:neu.titel, planung:neu.planung,'
                 + '            verknuepft:verkn, ohneTitel:ohneTitel };'
                 + ' } };'
                 + 'globalThis.__projektApi = {'
                 + ' pruefeProjekt: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   DB.projekte = [{ id:\'p1\', name:\'Garage\', kontext:\'privat\','
                 + '     status:\'laufend\', zielzustaende:[], anlagen:[],'
                 + '     meilensteine:[{ titel:\'Fundament\', datum:\'2026-05-04\','
                 + '                     erreicht:false }] }];'
                 + '   vhDetail = \'p1\'; vhDetailArt = \'projekt\';'
                 + '   vhMsAlsAufgabe(0);'
                 + '   var eins = aufgabenZuProjekt(\'p1\');'
                 + '   DB.aufgaben.push({ id:\'x9\', titel:\'Extra\', kontext:\'privat\','
                 + '     projektId:\'p1\', status:\'offen\', planung:\'backlog\' });'
                 + '   var zwei = aufgabenZuProjekt(\'p1\').length;'
                 + '   vhAufgabeLoesen(\'x9\');'
                 + '   var nachLoesen = aufgabenZuProjekt(\'p1\').length;'
                 + '   var bleibt = !!aufgabeFinden(\'x9\');'
                 + '   vhAufgabeZuordnen(\'x9\');'
                 + '   var nachZu = aufgabenZuProjekt(\'p1\').length;'
                 + '   vhDetail = \'\'; vhDetailArt = \'\'; DB = alt;'
                 + '   return { ausMeilenstein: eins.length,'
                 + '            titelUebernommen: eins[0].titel,'
                 + '            fristUebernommen: eins[0].frist,'
                 + '            kontextUebernommen: eins[0].kontext,'
                 + '            nachAnlegen: zwei, nachLoesen: nachLoesen,'
                 + '            bleibtErhalten: bleibt, nachZuordnen: nachZu };'
                 + ' } };'
                 + 'globalThis.__vorbeiApi = {'
                 + ' pruefeVorbei: function(){'
                 + '   var heute = isoDatum();'
                 + '   var gestern = tagePlus(heute, -1);'
                 + '   var frueh = { art:\'termin\', zeit:\'00:01\','
                 + '     t:{ von:\'00:01\', bis:\'00:02\' } };'
                 + '   var laeuft = { art:\'termin\', zeit:\'00:01\','
                 + '     t:{ von:\'00:01\', bis:\'23:59\' } };'
                 + '   var spaet = { art:\'termin\', zeit:\'23:58\','
                 + '     t:{ von:\'23:58\', bis:\'23:59\' } };'
                 + '   var ohne = { art:\'termin\', zeit:\'\', t:{ von:\'\', bis:\'\' } };'
                 + '   var aufg = { art:\'aufgabe\', zeit:\'00:01\', a:{ titel:\'x\' } };'
                 + '   return {'
                 + '     frueherTermin: eintragVorbei(frueh, heute),'
                 + '     laufenderTermin: eintragVorbei(laeuft, heute),'
                 + '     spaeterTermin: eintragVorbei(spaet, heute),'
                 + '     andererTag: eintragVorbei(frueh, gestern),'
                 + '     ohneZeit: eintragVorbei(ohne, heute),'
                 + '     aufgabeFrueh: eintragVorbei(aufg, heute) };'
                 + ' } };'
                 + 'globalThis.__feiApi = {'
                 + ' pruefeFeiertage: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   var l = feiertageImJahr(2026);'
                 + '   var sortiert = true;'
                 + '   var i;'
                 + '   for (i = 1; i < l.length; i++) {'
                 + '     if (l[i].von < l[i-1].von) { sortiert = false; }'
                 + '   }'
                 + '   var mitNamen = l.every(function(x){ return x.titel.length > 0; });'
                 + '   DB.ferien = [{ id:\'f1\', titel:\'Eigener Name\', art:\'feiertag\','
                 + '                  von:\'2026-01-01\', bis:\'2026-01-01\' }];'
                 + '   var eigen = feiertagAn(\'2026-01-01\');'
                 + '   DB = alt;'
                 + '   return { anzahl:l.length, erster:l[0].von, letzter:l[l.length-1].von,'
                 + '            sortiert:sortiert, mitNamen:mitNamen, eingelesenGewinnt:eigen };'
                 + ' } };'
                 + 'globalThis.__nzApi = {'
                 + ' pruefeNachzuegler: function(){'
                 + '   var alt = DB; var merkTag = tagOffen; DB = leereDatenbank();'
                 + '   var heute = isoDatum();'
                 + '   var morgen = tagePlus(heute, 1);'
                 + '   tagOffen = heute;'
                 + '   DB.aufgaben = ['
                 + '     { id:\'a1\', titel:\'Neu\', planung: tagePlus(heute,-1),'
                 + '       status:\'offen\', kontext:\'beruflich\' },'
                 + '     { id:\'a2\', titel:\'Alt\', planung: tagePlus(heute,-9),'
                 + '       status:\'offen\', kontext:\'beruflich\' },'
                 + '     { id:\'a3\', titel:\'Heute\', planung: heute,'
                 + '       status:\'offen\', kontext:\'beruflich\' },'
                 + '     { id:\'a4\', titel:\'Backlog\', planung:\'backlog\','
                 + '       status:\'offen\', kontext:\'beruflich\' },'
                 + '     { id:\'a5\', titel:\'Fertig\', planung: tagePlus(heute,-3),'
                 + '       status:\'erledigt\', kontext:\'beruflich\' } ];'
                 + '   var liste = liegengeblieben(heute);'
                 + '   var anzahl = liste.length;'
                 + '   var reihe = liste.map(function(x){ return x.titel; }).join(\',\');'
                 + '   var titel = liste.map(function(x){ return x.titel; });'
                 + '   var heuteNicht = titel.indexOf(\'Heute\') < 0;'
                 + '   var backlogNicht = titel.indexOf(\'Backlog\') < 0;'
                 + '   var erledigtNicht = titel.indexOf(\'Fertig\') < 0;'
                 + '   var wHeute = nzWert(\'heute\');'
                 + '   var wMorgen = nzWert(\'morgen\');'
                 + '   var wWoche = nzWert(\'woche\');'
                 + '   DB.aufgaben[0].planung = heute;'
                 + '   DB.aufgaben[1].planung = heute;'
                 + '   var nachHeute = liegengeblieben(heute).length;'
                 + '   DB.aufgaben[0].planung = tagePlus(heute,-1);'
                 + '   DB.aufgaben[1].planung = tagePlus(heute,-9);'
                 + '   nzAlle(\'backlog\');'
                 + '   var alleWeg = liegengeblieben(heute).length;'
                 + '   var gerufen = [];'
                 + '   var merkBl = tagBlaettern;'
                 + '   tagBlaettern = function(n){ gerufen.push(n); };'
                 + '   wischBeginn({ touches:[{ clientX:300, clientY:100 }] });'
                 + '   wischEnde({ changedTouches:[{ clientX:200, clientY:110 }] });'
                 + '   var links = gerufen.length ? gerufen[gerufen.length-1] : 0;'
                 + '   wischBeginn({ touches:[{ clientX:100, clientY:100 }] });'
                 + '   wischEnde({ changedTouches:[{ clientX:220, clientY:110 }] });'
                 + '   var rechts = gerufen[gerufen.length-1];'
                 + '   var vorher = gerufen.length;'
                 + '   wischBeginn({ touches:[{ clientX:100, clientY:100 }] });'
                 + '   wischEnde({ changedTouches:[{ clientX:180, clientY:400 }] });'
                 + '   var schraeg = gerufen.length - vorher;'
                 + '   tagBlaettern = merkBl;'
                 + '   tagOffen = merkTag; DB = alt;'
                 + '   return { anzahl:anzahl, reihenfolge:reihe, heuteNicht:heuteNicht,'
                 + '            backlogNicht:backlogNicht, erledigtNicht:erledigtNicht,'
                 + '            nachHeute:nachHeute, wertHeute:wHeute, wertMorgen:wMorgen,'
                 + '            wertWoche:wWoche, heute:heute, morgen:morgen,'
                 + '            alleWeg:alleWeg, wischLinks:links, wischRechts:rechts,'
                 + '            wischSchraeg:schraeg };'
                 + ' } };'
                 + 'globalThis.__darstellungApi = {'
                 + ' pruefeDarstellung: function(){'
                 + '   var alt = DB; DB = leereDatenbank();'
                 + '   var merk = window.innerWidth;'
                 + '   DB.einstellungen.darstellung = \'automatisch\';'
                 + '   window.innerWidth = 400; var a = istBreit();'
                 + '   window.innerWidth = 1400; var b = istBreit();'
                 + '   DB.einstellungen.darstellung = \'breit\';'
                 + '   window.innerWidth = 400; var c = istBreit();'
                 + '   DB.einstellungen.darstellung = \'schmal\';'
                 + '   window.innerWidth = 1400; var e = istBreit();'
                 + '   DB.einstellungen.darstellung = \'unsinn\';'
                 + '   var f = darstellungGewaehlt();'
                 + '   window.innerWidth = merk; DB = alt;'
                 + '   return { autoSchmal:a, autoBreit:b, erzwungenBreit:c,'
                 + '            erzwungenSchmal:e, unsinnFaelltZurueck:f };'
                 + ' } };'
                 + 'globalThis.__ruhtApi = {'
                 + ' pruefeRuhen: function(){'
                 + '   var alt = DB; var merkTag = tagOffen; DB = leereDatenbank();'
                 + '   var heute = isoDatum();'
                 + '   var morgen = tagePlus(heute, 1);'
                 + '   var woche = tagePlus(heute, 7);'
                 + '   var gestern = tagePlus(heute, -1);'
                 + '   var a1 = schrittRuht({ ab: \'\' }, heute) === false;'
                 + '   var a2 = schrittRuht({ ab: heute }, heute) === false;'
                 + '   var a3 = schrittRuht({ ab: gestern }, heute) === false;'
                 + '   var a4 = schrittRuht({ ab: morgen }, heute) === false;'
                 + '   DB.durchlaeufe = [{ id:\'d1\', name:\'D\', kontext:\'beruflich\','
                 + '     schritte:[{ titel:\'Eins\', fertig:false, ab:\'\' }] }];'
                 + '   tagOffen = heute;'
                 + '   var vorher = ablaufSchritteHeute(heute).length;'
                 + '   schrittAbSetzen(\'d1\', 0, morgen);'
                 + '   var nachher = ablaufSchritteHeute(heute).length;'
                 + '   var amZielTag = ablaufSchritteHeute(morgen).length;'
                 + '   var liste = abSichtbar(DB.durchlaeufe).length;'
                 + '   var bis = ruhtBis(DB.durchlaeufe[0]);'
                 + '   schrittAbSetzen(\'d1\', 0, \'\');'
                 + '   var folge = [];'
                 + '   schrittAbWeiter(\'d1\', 0); folge.push(DB.durchlaeufe[0].schritte[0].ab);'
                 + '   schrittAbWeiter(\'d1\', 0); folge.push(DB.durchlaeufe[0].schritte[0].ab);'
                 + '   schrittAbWeiter(\'d1\', 0); folge.push(DB.durchlaeufe[0].schritte[0].ab);'
                 + '   tagOffen = merkTag; DB = alt;'
                 + '   return { ohneAb:a1, heute:a2, gestern:a3, morgen:a4,'
                 + '            imTagVorher:vorher, imTagNachher:nachher,'
                 + '            spaeterAmZielTag:amZielTag, inDerListe:liste,'
                 + '            ruhtBisWert:bis, morgenWert:morgen,'
                 + '            folge:folge, erwarteteFolge:[morgen, woche, \'\'] };'
                 + ' } };'
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
  const anm = skript.match(/function anmeldeVersuch\([\s\S]*?\n\}\n/);
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
      pruefe(maskierbar.every(function (i) {
        return (m.icons || []).some(function (j) {
          return j.src !== i.src && String(j.purpose || '').indexOf('any') >= 0;
        });
      }), 'das maskierbare ist eine eigene Datei — sonst wird der Inhalt beschnitten');
      pruefe(Array.isArray(m.shortcuts) && m.shortcuts.length >= 3,
             'es gibt Verknüpfungen für das lange Drücken');
      pruefe((m.shortcuts || []).every(function (s) {
        return /workbench\.html#/.test(s.url || '');
      }), 'jede Verknüpfung zeigt auf einen Bildschirm');
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

  /* Ein einfaches Abstreifen mit Ersetzungen scheitert zuverlässig:
     Ein // in einer Adresse sieht aus wie ein Kommentar, ein
     Apostroph in einem Kommentar wie ein Zeichenkettenbeginn, ein /
     in einem regulären Ausdruck wie eine Division. Deshalb läuft hier
     ein kleiner Leser einmal durch den Text und weiß jederzeit, worin
     er steckt. Übrig bleibt nur echter Code. */
  function nurCode(text) {
    let aus = '';
    let i = 0;
    let zuletzt = '';
    while (i < text.length) {
      const z = text[i];
      const zwei = text.slice(i, i + 2);

      if (zwei === '//') {
        while (i < text.length && text[i] !== '\n') { i++; }
        continue;
      }
      if (zwei === '/*') {
        i += 2;
        while (i < text.length && text.slice(i, i + 2) !== '*/') { i++; }
        i += 2;
        aus += ' ';
        continue;
      }
      if (z === '"' || z === "'" || z === '`') {
        const ende = z;
        i++;
        while (i < text.length && text[i] !== ende) {
          if (text[i] === '\\') { i++; }
          i++;
        }
        i++;
        aus += '""';
        zuletzt = '"';
        continue;
      }
      if (z === '/' && /[(,=:[!&|?{};+\n]/.test(zuletzt || '\n')) {
        i++;
        while (i < text.length && text[i] !== '/') {
          if (text[i] === '\\') { i++; }
          if (text[i] === '[') {
            while (i < text.length && text[i] !== ']') {
              if (text[i] === '\\') { i++; }
              i++;
            }
          }
          i++;
        }
        i++;
        while (i < text.length && /[gimsuy]/.test(text[i])) { i++; }
        aus += 'RE';
        zuletzt = 'E';
        continue;
      }
      aus += z;
      if (!/\s/.test(z)) { zuletzt = z; }
      i++;
    }
    return aus;
  }

  const skript = nurCode(roh);

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
                  'kalenderNeuLesen', 'zeichneKalender',
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
  /* Ganztägiges steht seit v0.21.0 im Tagesverlauf, nicht mehr als
     eigene Zeile über dem Kopf. */
  pruefe(eintraege && /passtZumTag\(jtKontext\(jt\[i\]\)\)/.test(eintraege[0]),
         'der Filter greift auf Jahrestermine und Ganztägiges');

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
  const anv = skript.match(/function anmeldeVersuch\([\s\S]*?\n\}\n/);
  pruefe(anv && /verbindungPruefen\(\)/.test(anv[0]),
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
  /* Seit v0.27.0 zeigen die Spalten nur, was feststeht; die Aufgaben
     stehen gesammelt in der Wochenliste darunter. */
  pruefe(woche && !/ktag-aufgaben/.test(woche[0]),
         'in den Tagesspalten stehen keine Aufgaben mehr');
  pruefe(woche && /wochenListeHtml\(mo\)/.test(woche[0]),
         'die Wochenliste hängt darunter');
  const wliste = hauptSkript().match(/function wochenAufgaben\([\s\S]*?\n\}/);
  pruefe(wliste && /a\.art === 'klein'/.test(wliste[0]),
         'Kleinigkeiten stehen nicht in der Wochenliste');
  pruefe(woche && (woche[0].match(/passtZumKalender\(/g) || []).length >= 2,
         'der Filter greift auf Termine und Ganztägiges');
  pruefe(wliste && /passtZumKalender\(a\.kontext\)/.test(wliste[0]),
         'und auf die Wochenliste');

  /* Seit v0.16.1 steuert eine Klasse am Körper die Darstellung, damit
     sie sich auch von Hand festlegen lässt. */
  pruefe(/body\.breit /.test(QUELLE), 'am großen Bildschirm gilt ein eigenes Bild');
  pruefe(!/@media/.test(QUELLE),
         'die Darstellung hängt nicht mehr an Media-Abfragen');
  pruefe(/body\.breit \.woche-raster\{display:grid;[\s\S]{0,60}repeat\(7,/.test(QUELLE),
         'dort stehen sieben Spalten');
  pruefe(/--wochenspalte:\s*\d+px/.test(QUELLE),
         'ihre Breite ist fest, nicht vom Fenster abhängig');
  /* Seit v0.32.1 gilt der Umbruch auf jedem Gerät — am Handy schob ein
     langer Titel sonst die Ablaufpille aus dem Bild. */
  const ktitel = QUELLE.match(/\n\.ktitel\{[^}]*\}/);
  pruefe(ktitel && !/white-space:nowrap/.test(ktitel[0]),
         'lange Termintitel brechen um, statt abgeschnitten zu werden');
  pruefe(ktitel && /overflow-wrap:anywhere/.test(ktitel[0]),
         'auch ein sehr langes Wort bricht');
  pruefe(!/body\.breit \.ktag \.ktitel/.test(QUELLE),
         'es gibt keine Sonderregel mehr für den großen Bildschirm');
  pruefe(/\.kzeile\{[^}]*align-items:flex-start/.test(QUELLE),
         'die Uhrzeit bleibt oben stehen, wenn der Titel umbricht');
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
                  'abLoeschen', 'ablaufSchritteHeute', 'ablaufKlammerHtml',
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
  pruefe(tag && /laeufe\.length\) \{/.test(tag[0]),
         'ohne anstehenden Durchlauf bleibt der Abschnitt weg');

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
   46. Ruhende Ablaufschritte
   Grund: Ein Durchlauf hing im Tag, obwohl sein naechster Schritt
   erst spaeter dran war. Ruhen muss den Durchlauf aus dem Tag
   nehmen, ohne ihn aus der Ablaufliste verschwinden zu lassen.
   ============================================================ */
console.log('\n46. Ruhende Ablaufschritte');
{
  const skript = hauptSkript();
  const r = globalThis.__ruhtApi;

  ['schrittRuht', 'ruhtBis', 'schrittAbSetzen', 'schrittAbWeiter',
   'abSchrittAb'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  const heute = skript.match(/function ablaufSchritteHeute\([\s\S]*?\n\}/);
  pruefe(heute && /schrittRuht\(s\.satz, tag\)/.test(heute[0]),
         'ein ruhender Schritt bleibt aus dem Tag');
  pruefe(heute && /is \|\| tagOffen/.test(heute[0]),
         'gemessen wird am angezeigten Tag, nicht an heute');

  const zeile = skript.match(/function ablaufKlammerHtml\([\s\S]*?\n\}\n/);
  pruefe(zeile && /schrittAbWeiter\(/.test(zeile[0]),
         'in der Tageszeile lässt sich der Schritt wegschieben');

  const karte = skript.match(/function durchlaufKarteHtml\([\s\S]*?\n\}\n/);
  pruefe(karte && /ruht bis /.test(karte[0]),
         'die Ablaufliste zeigt, bis wann ein Durchlauf ruht');

  const detail = skript.match(/function abDetailHtml\([\s\S]*?\n\}\n/);
  pruefe(detail && /abSchrittAb\(/.test(detail[0]),
         'im Detail steht je Schritt ein Datumsfeld');
  pruefe(detail && /!istVorlage/.test(detail[0]),
         'eine Vorlage hat kein Ruhen — sie läuft ja nicht');

  const starten = skript.match(/function durchlaufStarten\([\s\S]*?\n\}/);
  pruefe(starten && /ab: ''/.test(starten[0]),
         'ein gestarteter Durchlauf beginnt ohne Ruhen');

  if (!r) {
    warn('Ruhefunktionen nicht auswertbar');
  } else {
    const e = r.pruefeRuhen();
    pruefe(e.ohneAb === true, 'ohne Datum ist ein Schritt fällig');
    pruefe(e.heute === true, 'am Tag selbst ist er fällig');
    pruefe(e.gestern === true, 'ein vergangenes Datum hält nicht mehr auf');
    pruefe(e.morgen === false, 'ein künftiges Datum lässt ihn ruhen');

    pruefe(e.imTagVorher === 1, 'vor dem Wegschieben steht er im Tag');
    pruefe(e.imTagNachher === 0, 'danach nicht mehr');
    pruefe(e.spaeterAmZielTag === 1,
           'am Tag, ab dem er wieder gilt, steht er wieder da');
    pruefe(e.inDerListe === 1, 'in der Ablaufliste bleibt der Durchlauf sichtbar');
    pruefe(e.ruhtBisWert === e.morgenWert, 'die Liste nennt das richtige Datum');

    pruefe(e.folge.join(',') === e.erwarteteFolge.join(','),
           'der Knopf schaltet morgen → in einer Woche → wieder heute');
  }
}

/* ============================================================
   47. Blaetter schliessen und Darstellung waehlen
   Grund: Ein bildschirmfuellendes Blatt liess sich am Handy nicht
   mehr schliessen — es gab nur den Hintergrund, und der war weg.
   Und die Darstellung hing an zwei verschiedenen Schwellen.
   ============================================================ */
console.log('\n47. Blätter und Darstellung');
{
  const skript = hauptSkript();
  const d = globalThis.__darstellungApi;

  /* Jedes Blatt hat denselben Kopf mit Kreuz */
  pruefe(new RegExp('function\\s+blattKopf\\s*\\(').test(skript),
         'Funktion blattKopf ist definiert');
  const kopf = skript.match(/function blattKopf\([\s\S]*?\n\}/);
  pruefe(kopf && /onclick="aktionenSchliessen\(\)"/.test(kopf[0]),
         'der Kopf trägt einen Schließknopf');
  pruefe(kopf && /aria-label="Schließen"/.test(kopf[0]), 'er ist beschriftet');
  /* Nur den Rumpf ansehen — die Kopfzeile enthält den Namen naturgemäß. */
  const rumpf = kopf ? kopf[0].replace(/^function blattKopf\(\)\s*\{/, '') : '';
  pruefe(!/blattKopf\(/.test(rumpf),
         'die Hilfsfunktion ruft sich nicht selbst auf');

  const aufrufe = (skript.match(/blattKopf\(\)/g) || []).length - 1;
  pruefe(aufrufe >= 12, 'alle Blätter benutzen den Kopf (gefunden: ' + aufrufe + ')');
  pruefe(!/'<div class="as-griff"><\/div>'/.test(skript),
         'kein Blatt baut den Griff mehr selbst');

  pruefe(/\.as-oben\{[^}]*position:sticky/.test(QUELLE),
         'der Kopf bleibt beim Blättern stehen');
  pruefe(/\.aktion-sheet\{[^}]*max-height/.test(QUELLE),
         'ein Blatt kann nicht höher werden als der Bildschirm');
  pruefe(/\.aktion-sheet\{[^}]*overflow-y:auto/.test(QUELLE),
         'ein langes Blatt lässt sich rollen');

  /* Darstellung */
  ['darstellungGewaehlt', 'istBreit', 'darstellungAnwenden',
   'darstellungSetzen', 'zeichneDarstellung'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });
  pruefe(/id="darstellungWahl"/.test(QUELLE), 'die Diagnose hat die Wahl');
  const start = skript.match(/function starten\(\)[\s\S]*?\n\}/);
  pruefe(start && /addEventListener\('resize', darstellungAnwenden\)/.test(start[0]),
         'bei geänderter Fenstergröße wird nachgezogen');

  if (!d) {
    warn('Darstellungsfunktionen nicht auswertbar');
  } else {
    const e = d.pruefeDarstellung();
    pruefe(e.autoSchmal === false, 'automatisch: ein schmales Fenster gilt als Handy');
    pruefe(e.autoBreit === true, 'automatisch: ein breites gilt als großer Bildschirm');
    pruefe(e.erzwungenBreit === true, 'festgelegt auf groß gilt auch im schmalen Fenster');
    pruefe(e.erzwungenSchmal === false, 'festgelegt auf Handy gilt auch im breiten Fenster');
    pruefe(e.unsinnFaelltZurueck === 'automatisch',
           'ein unbrauchbarer Wert fällt auf automatisch zurück');
  }
}

/* ============================================================
   48. Liegengebliebenes und Wischen
   Grund: Eine Aufgabe mit vergangenem Datum stand in keinem Tag
   mehr — nicht im gestrigen, weil er vorbei ist, und nicht im
   heutigen, weil ihr Datum nicht stimmt. Sie war unsichtbar.
   ============================================================ */
console.log('\n48. Liegengebliebenes und Wischen');
{
  const skript = hauptSkript();
  const n = globalThis.__nzApi;

  ['liegengeblieben', 'nachzueglerZeichnen', 'nachzueglerOeffnen', 'nachzueglerHtml',
   'nzWert', 'nzSetzen', 'nzAlle', 'nzErledigen',
   'wischBeginn', 'wischEnde', 'wischenAnmelden'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  pruefe(/id="tkNachzuegler"/.test(QUELLE), 'die Hinweiszeile liegt im Tageskopf');
  pruefe(/\.tk-nachzuegler\{[^}]*display:none/.test(QUELLE),
         'ohne Liegengebliebenes bleibt sie weg');

  const l = skript.match(/function liegengeblieben\([\s\S]*?\n\}/);
  pruefe(l && /a\.planung === 'backlog'.*continue/s.test(l[0]),
         'was im Backlog liegt, gilt nicht als liegengeblieben');
  pruefe(l && /a\.planung === 'woche'/.test(l[0]),
         'was auf der Woche liegt, ebenfalls nicht');
  pruefe(l && /a\.wiederholung.*continue/s.test(l[0]),
         'wiederkehrende Aufgaben zählen nicht');
  pruefe(l && /passtZumTag\(a\.kontext\)/.test(l[0]),
         'der Kontextfilter des Tages greift');
  pruefe(l && /a\.planung >= tag/.test(l[0]),
         'gemessen wird am angezeigten Tag');

  const blatt = skript.match(/function nachzueglerHtml\([\s\S]*?\n\}\n/);
  pruefe(blatt && /nzSetzen\(/.test(blatt[0]), 'jeder Eintrag lässt sich neu einordnen');
  pruefe(blatt && /Alle auf heute/.test(blatt[0]), 'es gibt einen Weg für alle auf einmal');

  const wisch = skript.match(/function wischRichtung\([\s\S]*?\n\}/);
  pruefe(wisch && /Math\.abs\(dx\) < WISCH_WEITE/.test(wisch[0]),
         'eine zu kurze Bewegung zählt nicht');
  pruefe(wisch && /Math\.abs\(dy\) \* 2/.test(wisch[0]),
         'eine eher senkrechte Bewegung zählt nicht — das Rollen bleibt frei');
  const an = skript.match(/function wischenAnHeften\([\s\S]*?\n\}/);
  pruefe(an && /passive: true/.test(an[0]), 'die Zuhörer stören das Rollen nicht');
  pruefe(new RegExp('function\\s+rolltWaagerecht\\s*\\(').test(skript),
         'Funktion rolltWaagerecht ist definiert');
  const beginn = skript.match(/function wischBeginn\([\s\S]*?\n\}/);
  pruefe(beginn && /rolltWaagerecht\(ereignis\.target\)/.test(beginn[0]),
         'über einer waagerecht rollenden Fläche wird nicht gewischt');
  const roll = skript.match(/function rolltWaagerecht\([\s\S]*?\n\}/);
  pruefe(roll && /scrollWidth > el\.clientWidth/.test(roll[0]),
         'erkannt wird sie am Überhang');
  pruefe(roll && /tiefe < 8/.test(roll[0]),
         'die Suche nach oben ist begrenzt');
  const anm = skript.match(/function wischenAnmelden\([\s\S]*?\n\}/);
  pruefe(anm && /schirmTag/.test(anm[0]), 'im Tagesplan wird gewischt');
  pruefe(anm && /schirmKalender/.test(anm[0]), 'im Kalender ebenfalls');
  pruefe(anm && !/schirmAufgaben/.test(anm[0]),
         'in Listen ohne Zeitachse nicht — dort gibt es kein Vor und Zurück');

  if (!n) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = n.pruefeNachzuegler();
    pruefe(e.anzahl === 2, 'zwei vergangene Einträge werden gefunden');
    pruefe(e.reihenfolge === 'Alt,Neu', 'das Älteste steht oben');
    pruefe(e.heuteNicht === true, 'ein Eintrag von heute zählt nicht');
    pruefe(e.backlogNicht === true, 'einer im Backlog zählt nicht');
    pruefe(e.erledigtNicht === true, 'ein erledigter zählt nicht');
    pruefe(e.nachHeute === 0, 'auf heute gesetzt verschwindet er aus der Liste');
    pruefe(e.wertHeute === e.heute, 'Heute setzt das heutige Datum');
    pruefe(e.wertMorgen === e.morgen, 'Morgen setzt den Folgetag');
    pruefe(e.wertWoche === 'woche', 'Woche setzt die Wochenliste');
    pruefe(e.alleWeg === 0, 'alle auf einmal räumt die Liste');
    pruefe(e.wischLinks === 1 && e.wischRechts === -1,
           'links wischen geht vor, rechts zurück');
    pruefe(e.wischSchraeg === 0, 'eine schräge Bewegung blättert nicht');
  }
}

/* ============================================================
   49. Wischen im Kalender und Feiertage im Jahr
   Grund: Der Feiertagspunkt im Raster sagt nicht, welcher Feiertag
   gemeint ist. Und Blaettern per Wischen soll ueberall gelten, wo
   es ein Vor und Zurueck gibt.
   ============================================================ */
console.log('\n49. Wischen im Kalender, Feiertagsliste');
{
  const skript = hauptSkript();
  const f = globalThis.__feiApi;

  ['wischRichtung', 'wischEndeKalender', 'wischenAnHeften',
   'feiertageImJahr'].forEach(function (n) {
    pruefe(new RegExp('function\\s+' + n + '\\s*\\(').test(skript),
           'Funktion ' + n + ' ist definiert');
  });

  const kal = skript.match(/function wischEndeKalender\([\s\S]*?\n\}/);
  pruefe(kal && /kalBlaettern\(richtung\)/.test(kal[0]),
         'im Kalender blättert das Wischen die gewählte Stufe');
  const tag = skript.match(/function wischEnde\([\s\S]*?\n\}/);
  pruefe(tag && /tagBlaettern\(richtung\)/.test(tag[0]),
         'im Tag blättert es den Tag');

  const jahr = skript.match(/function jahrHtml\([\s\S]*?\n\}\n/);
  pruefe(jahr && /Nur Feiertage/.test(jahr[0]), 'es gibt eine Summenzeile für Feiertage');
  pruefe(jahr && /Feiertage ' \+ jahr/.test(jahr[0]),
         'gefiltert erscheint eine Liste mit Namen und Datum');
  const passt = skript.match(/function jtPasst\([\s\S]*?\n\}/);
  pruefe(passt && /jahrFilter === 'feiertage'/.test(passt[0]),
         'bei „nur Feiertage" verschwinden die Jahrestermine');

  if (!f) {
    warn('Feiertagsfunktion nicht auswertbar');
  } else {
    const e = f.pruefeFeiertage();
    pruefe(e.anzahl === 13, '2026 hat dreizehn bayerische Feiertage (ist: ' + e.anzahl + ')');
    pruefe(e.erster === '2026-01-01', 'der erste ist Neujahr');
    pruefe(e.letzter === '2026-12-26', 'der letzte der zweite Weihnachtstag');
    pruefe(e.sortiert === true, 'die Liste ist chronologisch');
    pruefe(e.mitNamen === true, 'jeder Eintrag trägt seinen Namen');
    pruefe(e.eingelesenGewinnt === 'Eigener Name',
           'ein eingelesener Feiertag geht vor die Berechnung');
  }
}

/* ============================================================
   50. Spalten auf dem grossen Bildschirm
   Grund: Tag und Vorhaben blieben einspaltig, obwohl die Entwuerfe
   dort Spalten vorsahen. Auf einem breiten Bildschirm entsteht sonst
   eine schmale Saeule mit viel leerem Raum daneben.
   ============================================================ */
console.log('\n50. Spalten auf dem großen Bildschirm');
{
  /* Tag: zwei Spalten mit fester Zuordnung je Abschnitt */
  pruefe(/body\.breit \.tagblatt\{display:grid/.test(QUELLE),
         'der Tag steht im breiten Bild in einem Raster');
  pruefe(/body\.breit \.tagblatt\{[^}]*grid-template-columns:1fr 1fr/.test(QUELLE),
         'es sind zwei Spalten');

  /* Die Spalten sind eigene Behälter — in einem reinen Raster teilen
     sich Nachbarn die Zeilenhöhe, wodurch oben rechts eine Lücke
     entstand. */
  pruefe(/body\.breit \.tspalte-links\{grid-column:1\}/.test(QUELLE),
         'die linke Spalte sitzt links');
  pruefe(/body\.breit \.tspalte-rechts\{grid-column:2\}/.test(QUELLE),
         'die rechte Spalte sitzt rechts');
  pruefe(/\.tspalte\{display:contents\}/.test(QUELLE),
         'im schmalen Bild lösen sich die Behälter auf');
  pruefe(/body\.breit \.tspalte\{display:block\}/.test(QUELLE),
         'im breiten Bild werden sie zu Spalten');
  pruefe(/body\.breit \.tagblatt\{[^}]*align-items:start/.test(QUELLE),
         'die Spalten beginnen beide oben');
  pruefe(/body\.breit \.tabschnitt\[data-kurz="Erledigt"\]\{grid-column:1 \/ -1\}/.test(QUELLE),
         'Erledigtes geht über beide Spalten');

  /* Jeder Abschnitt liegt in genau einer Spalte */
  const tag = hauptSkript().match(/function tagZeichnen\([\s\S]*?\n\}\n/);
  const folge = tag ? [...tag[0].matchAll(/tspalte tspalte-(\w+)|data-kurz="([^"]+)"/g)]
                       .map(m => m[1] ? ('[' + m[1] + ']') : m[2]) : [];
  const erwarteteFolge = ['[links]', 'Tagesverlauf', 'Wiederkehrend', 'Abläufe',
                          '[rechts]', 'Aufgaben', 'Kleinigkeiten', 'Erledigt'];
  pruefe(folge.join(',') === erwarteteFolge.join(','),
         'die Abschnitte stehen in der vereinbarten Folge und Spalte'
         + (folge.join(',') === erwarteteFolge.join(',') ? '' : ' — ist: ' + folge.join(' → ')));

  /* Vorhaben und Abläufe als Kacheln */
  pruefe(/body\.breit \.vhblatt\{display:grid/.test(QUELLE),
         'Vorhaben und Abläufe stehen als Kacheln');
  pruefe(/repeat\(auto-fill,minmax\(300px,1fr\)\)/.test(QUELLE),
         'die Zahl der Spalten richtet sich nach der Breite');
  pruefe(/body\.breit \.vh-gruppe\{grid-column:1 \/ -1\}/.test(QUELLE),
         'die Gruppenüberschrift geht über alle Spalten');
  pruefe(/body\.breit \.vkarte\{[^}]*align-self:start/.test(QUELLE),
         'eine Karte wächst nicht auf die Höhe ihrer Nachbarin');

  /* Im schmalen Bild bleibt es einspaltig */
  pruefe(!/\.tagblatt\{[^}]*display:grid/.test(QUELLE.replace(/body\.breit [^\n]*/g, '')),
         'im schmalen Bild bleibt der Tag einspaltig');
}

/* ============================================================
   51. Vergangene Termine einklappen
   Grund: Der Entwurf versteckt am Handy, was schon vorbei ist,
   hinter einer Faltzeile. Am grossen Bildschirm ist Platz genug.
   Ein noch laufender Termin darf nicht als vorbei gelten.
   ============================================================ */
console.log('\n51. Vergangene Termine');
{
  const skript = hauptSkript();
  const v = globalThis.__vorbeiApi;

  const fn = hauptSkript().match(/function eintragVorbei\([\s\S]*?\n\}/);
  pruefe(fn && /eintrag\.art !== 'termin'/.test(fn[0]),
         'nur Termine können vorbei sein');

  ['eintragVorbei', 'vorbeiUm', 'uhrzeitJetzt'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  const tag = skript.match(/function tagZeichnen\([\s\S]*?\n\}\n/);
  pruefe(tag && /vorbei-falt/.test(tag[0]), 'es gibt eine Faltzeile');
  pruefe(tag && /Termine vorbei/.test(tag[0]), 'sie nennt die Zahl');
  pruefe(tag && /vorbeiZahl\) \{/.test(tag[0]),
         'ohne Vergangenes bleibt sie weg');

  pruefe(/\n\.tverlauf\.vorbei\{display:none\}/.test(QUELLE),
         'Vergangenes ist eingeklappt');
  pruefe(/\.tabschnitt\.aufgeklappt \.tverlauf\.vorbei\{display:flex;opacity/.test(QUELLE),
         'aufgeklappt steht es zurückgenommen da');
  pruefe(!/body\.(breit|schmal) [^\n]*vorbei/.test(QUELLE),
         'die Regel gilt auf jedem Gerät gleich');
  pruefe(!/body\.breit \.vorbei-falt/.test(QUELLE),
         'die Faltzeile bleibt auch am großen Bildschirm');

  if (!v) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = v.pruefeVorbei();
    pruefe(e.frueherTermin === true, 'ein beendeter Termin gilt als vorbei');
    pruefe(e.laufenderTermin === false,
           'ein noch laufender Termin gilt nicht als vorbei');
    pruefe(e.spaeterTermin === false, 'ein späterer erst recht nicht');
    pruefe(e.andererTag === false, 'an einem anderen Tag gibt es kein Vorbei');
    pruefe(e.ohneZeit === false, 'ohne Zeitangabe gilt nichts als vorbei');
    pruefe(e.aufgabeFrueh === false,
           'eine Aufgabe ist nie vorbei — sie verschwindet erst mit dem Haken');
  }
}

/* ============================================================
   52. Erneuerung, die nicht beim ersten Fehlschlag aufgibt
   Grund: Ein einziger Versuch fuenf Minuten vor Ablauf. Schlug er
   fehl — schlafender Rechner, kurz kein Netz, blockierte Cookies —,
   war die Sitzung verloren und niemand erfuhr den Grund.
   ============================================================ */
console.log('\n52. Erneuerung mit Nachsetzen');
{
  const skript = hauptSkript();

  ['erneuerungLaufen', 'erneuerungPruefen', 'anmeldeVersuch'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  const lauf = skript.match(/function erneuerungLaufen\([\s\S]*?\n\}/);
  pruefe(lauf && /erneuerungVersuche >= ERNEUERUNG_MAX/.test(lauf[0]),
         'nach genügend Versuchen wird aufgegeben');
  pruefe(lauf && /ERNEUERUNG_ABSTAND/.test(lauf[0]),
         'zwischen den Versuchen liegt ein Abstand');
  const max = skript.match(/ERNEUERUNG_MAX\s*=\s*(\d+)/);
  pruefe(max && Number(max[1]) >= 3 && Number(max[1]) <= 12,
         'die Zahl der Versuche liegt zwischen drei und zwölf');
  const abstand = skript.match(/ERNEUERUNG_ABSTAND\s*=\s*(\d+)/);
  pruefe(abstand && Number(abstand[1]) >= 20000,
         'der Abstand ist nicht kürzer als zwanzig Sekunden');

  const pruef = skript.match(/function erneuerungPruefen\([\s\S]*?\n\}/);
  pruefe(pruef && /restMinuten\(\) > 10/.test(pruef[0]),
         'beim Zurückkehren wird nur erneuert, wenn es bald abläuft');
  pruefe(pruef && /erneuerungsUhr\) \{ return/.test(pruef[0]),
         'eine laufende Erneuerung wird nicht überholt');
  const start = skript.match(/function starten\(\)[\s\S]*?\n\}/);
  pruefe(start && /addEventListener\('focus', erneuerungPruefen\)/.test(start[0]),
         'die Rückkehr an den Rechner löst die Prüfung aus');
  const rueck = skript.match(/function rueckkehrPruefen\([\s\S]*?\n\}/);
  pruefe(rueck && /erneuerungPruefen\(\)/.test(rueck[0]),
         'auch die Rückkehr zur Fläche');

  /* Der Grund eines Fehlschlags muss ablesbar sein */
  pruefe(/letzteErneuerung = \{ zeit/.test(skript),
         'jeder Versuch hinterlässt Zeitpunkt und Ergebnis');
  const google = skript.match(/function zeichneGoogle\([\s\S]*?\n\}/);
  pruefe(google && /letzteErneuerung\.grund/.test(google[0]),
         'die Diagnose nennt den Grund des Fehlschlags');
  pruefe(google && /Versuche in Folge/.test(google[0]),
         'sie nennt auch die Zahl der Versuche');

  /* Von Hand: erst still, dann mit Rückfrage */
  const anm = skript.match(/function anmelden\([\s\S]*?\n\}/);
  pruefe(anm && /anmeldeVersuch\(still, still \? '' : ''\)/.test(anm[0]),
         'auch von Hand wird zuerst ohne Rückfrage versucht');
  pruefe(anm && /anmeldeVersuch\(false, 'consent'\)/.test(anm[0]),
         'erst danach mit Rückfrage');
  pruefe(anm && /gut \|\| still/.test(anm[0]),
         'ein stiller Versuch führt nie zu einer Rückfrage');
}

/* ============================================================
   53. Aufgaben am Projekt, lesbare Meilensteine
   Grund: Ein Projekt konnte Aufgaben haben, aber aus seinem Dialog
   fuehrte kein Weg dorthin. Und die Meilensteinzeile war ein
   einzeiliges Feld mit Knoepfen, die nur aus Zeichen bestanden.
   ============================================================ */
console.log('\n53. Aufgaben am Projekt');
{
  const skript = hauptSkript();
  const p = globalThis.__projektApi;

  ['vhMsAlsAufgabe', 'vhAufgabeAnlegen', 'vhAufgabeTaste', 'vhAufgabeErledigen',
   'vhAufgabeLoesen', 'vhAufgabeWahl', 'vhAufgabeZuordnen'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  const detail = skript.match(/function vhDetailHtml\([\s\S]*?\n\}\n/);
  pruefe(detail && /s-abschnitt">Aufgaben/.test(detail[0]),
         'das Projektdetail hat einen Aufgabenabschnitt');
  pruefe(detail && /vhAufgabeWahl\(\)/.test(detail[0]),
         'eine vorhandene Aufgabe lässt sich zuordnen');
  pruefe(detail && /id="vhAufgabeNeu"/.test(detail[0]),
         'eine neue lässt sich direkt anlegen');
  pruefe(detail && /vhMsAlsAufgabe\(/.test(detail[0]),
         'aus einem Meilenstein lässt sich eine Aufgabe machen');

  /* Knöpfe mit Wörtern statt Zeichen */
  pruefe(detail && /Nach oben<\/button>/.test(detail[0]),
         'der Hochschiebeknopf trägt ein Wort statt eines Pfeils');
  pruefe(detail && /Entfernen<\/button>/.test(detail[0]),
         'der Entfernenknopf ebenfalls');
  pruefe(detail && /title="Diesen Meilenstein nach oben schieben"/.test(detail[0]),
         'zusätzlich erklärt ein Hinweis, was er tut');
  pruefe(detail && /class="ms-titel" rows="2"/.test(detail[0]),
         'der Meilensteintitel ist ein mehrzeiliges Feld');
  pruefe(/\.ms-titel\{[^}]*resize:vertical/.test(QUELLE),
         'es lässt sich aufziehen');

  /* Lösen heißt nicht löschen */
  const loesen = skript.match(/function vhAufgabeLoesen\([\s\S]*?\n\}/);
  pruefe(loesen && /projektId = null/.test(loesen[0]),
         'Lösen entfernt nur die Zuordnung');
  pruefe(loesen && !/splice/.test(loesen[0]), 'die Aufgabe selbst bleibt');

  /* Die Auswahl zeigt nur freie Aufgaben desselben Kontexts */
  const wahl = skript.match(/function vhAufgabeWahl\([\s\S]*?\n\}\n/);
  pruefe(wahl && /l\[i\]\.projektId\) \{ continue/.test(wahl[0]),
         'schon zugeordnete Aufgaben stehen nicht zur Wahl');
  pruefe(wahl && /kontext !== v\.kontext/.test(wahl[0]),
         'nur Aufgaben desselben Kontexts');

  if (!p) {
    warn('Projektfunktionen nicht auswertbar');
  } else {
    const e = p.pruefeProjekt();
    pruefe(e.ausMeilenstein === 1, 'aus einem Meilenstein entsteht eine Aufgabe');
    pruefe(e.titelUebernommen === 'Fundament', 'sie trägt seinen Titel');
    pruefe(e.fristUebernommen === '2026-05-04', 'und sein Datum als Frist');
    pruefe(e.kontextUebernommen === 'privat', 'und den Kontext des Projekts');
    pruefe(e.nachAnlegen === 2, 'eine neue Aufgabe lässt sich anlegen');
    pruefe(e.nachLoesen === 1, 'Lösen nimmt sie aus dem Projekt');
    pruefe(e.bleibtErhalten === true, 'sie bleibt im Bestand');
    pruefe(e.nachZuordnen === 2, 'und lässt sich wieder zuordnen');
  }
}

/* ============================================================
   54. Ablaufdialog: lesbare Schritte, echte Aufgaben
   Grund: Dieselben Maengel wie beim Projektdialog — einzeilige
   Felder, Knoepfe aus Zeichen, kein Weg zu einer echten Aufgabe.
   ============================================================ */
console.log('\n54. Ablaufdialog');
{
  const skript = hauptSkript();
  const a = globalThis.__abSchrittApi;

  pruefe(new RegExp('function\\s+abSchrittAlsAufgabe\\s*\\(').test(skript),
         'Funktion abSchrittAlsAufgabe ist definiert');

  const detail = skript.match(/function abDetailHtml\([\s\S]*?\n\}\n/);
  pruefe(detail && /class="ms-titel" rows="2"/.test(detail[0]),
         'der Schritttitel ist ein mehrzeiliges Feld');
  pruefe(detail && /Nach oben<\/button>/.test(detail[0]),
         'der Hochschiebeknopf trägt ein Wort');
  pruefe(detail && /Entfernen<\/button>/.test(detail[0]), 'der Entfernenknopf ebenfalls');
  pruefe(detail && /title="Diesen Schritt nach oben schieben"/.test(detail[0]),
         'ein Hinweis erklärt ihn');
  pruefe(detail && /ms-marke">frühestens ab/.test(detail[0]),
         'das Datumsfeld ist beschriftet');
  pruefe(detail && /abSchrittAlsAufgabe\(/.test(detail[0]),
         'aus einem Schritt lässt sich eine Aufgabe machen');
  pruefe(detail && /'Aufgabe: '\s*\n?\s*\+ esc\(planungText/.test(detail[0])
         || (detail && /Aufgabe: '[\s\S]{0,40}planungText/.test(detail[0])),
         'ein Schritt mit Aufgabe zeigt deren Stand');
  pruefe(detail && /verknuepft \? /.test(detail[0]) === false
         && /if \(verknuepft\)/.test(detail[0]),
         'nur ein Schritt ohne Aufgabe bietet das Anlegen an');

  /* Eine Vorlage kennt weder Ruhen noch Aufgaben */
  pruefe(detail && /if \(!istVorlage\)/.test(detail[0]),
         'bei einer Vorlage bleiben Datum und Aufgabe weg');

  const alsAuf = skript.match(/function abSchrittAlsAufgabe\([\s\S]*?\n\}/);
  pruefe(alsAuf && /ablaufSchritt: a\.id \+ '#' \+ i/.test(alsAuf[0]),
         'die Aufgabe merkt sich, aus welchem Schritt sie kam');
  pruefe(alsAuf && /a\.schritte\[i\]\.aufgabeId = neu\.id/.test(alsAuf[0]),
         'und der Schritt merkt sich die Aufgabe');
  pruefe(alsAuf && /planung: a\.schritte\[i\]\.ab \|\| 'backlog'/.test(alsAuf[0]),
         'ein ruhender Schritt gibt sein Datum als Planung weiter');
  pruefe(alsAuf && /kontext: a\.kontext/.test(alsAuf[0]),
         'der Kontext des Durchlaufs gilt');

  if (!a) {
    warn('Ablauffunktionen nicht auswertbar');
  } else {
    const e = a.pruefeSchritt();
    pruefe(e.angelegt === 1, 'aus einem Schritt entsteht genau eine Aufgabe');
    pruefe(e.titel === 'Zweiter', 'sie trägt seinen Titel');
    pruefe(e.planung === '2026-10-01', 'ein Ruhedatum wird zur Planung');
    pruefe(e.verknuepft === true, 'Schritt und Aufgabe kennen einander');
    pruefe(e.ohneTitel === 1, 'ein Schritt ohne Titel erzeugt keine Aufgabe');
  }
}

/* ============================================================
   55. Ganztaegiges im Tagesverlauf
   Grund: Ganztaegige Google-Termine standen als eigene Zeile ueber
   dem Kopf, Jahrestermine erschienen im Tag gar nicht. Beides praegt
   den Tag und gehoert an dessen Anfang.
   ============================================================ */
console.log('\n55. Ganztägiges im Tagesverlauf');
{
  const skript = hauptSkript();
  const g = globalThis.__ganztagsApi;

  pruefe(!/id="tkGanztags"/.test(QUELLE), 'die eigene Zeile über dem Kopf ist entfallen');
  pruefe(!/function ganztagsZeichnen/.test(skript), 'ihre Funktion ebenfalls');

  const eintraege = skript.match(/function tagesEintraege\([\s\S]*?\n\}\n/);
  pruefe(eintraege && /var ganztags = \[\]/.test(eintraege[0]),
         'die Tageseinträge führen Ganztägiges');
  pruefe(eintraege && /jtAn\(is\)/.test(eintraege[0]), 'Jahrestermine kommen hinein');
  pruefe(eintraege && /feiertagAn\(is\)/.test(eintraege[0]), 'Feiertage ebenfalls');
  pruefe(eintraege && /ferienAn\(is\)/.test(eintraege[0]), 'Ferien ebenfalls');
  /* Seit v0.33.0 kommen die ganztägigen Kalendertermine über jtAn —
     sie sind Jahresterminen gleichgestellt. */
  const kjt = skript.match(/function kalenderJahrestermine\([\s\S]*?\n\}/);
  pruefe(kjt && /ganztags/.test(kjt[0]),
         'die ganztägigen Termine aus Google werden zu Jahresterminen');
  const jtan = skript.match(/function jtAn\([\s\S]*?\n\}/);
  pruefe(jtan && /kalenderJahrestermine\(is\)/.test(jtan[0]),
         'und erscheinen überall dort, wo Jahrestermine erscheinen');
  pruefe(eintraege && !/ausGoogle\.ganztags/.test(eintraege[0]),
         'sie werden nicht zusätzlich angehängt — das gäbe Dubletten');

  const tag = skript.match(/function tagZeichnen\([\s\S]*?\n\}\n/);
  pruefe(tag && /class="tganz/.test(tag[0]),
         'sie stehen als schlichte Zeilen, nicht an der Zeitschiene');
  pruefe(tag && !/tverlauf ganztags/.test(tag[0]),
         'sie sind keine Verlaufszeile mehr');
  pruefe(!/\.tganz\{[^}]*tv-schiene/.test(QUELLE) && /\.tganz\{display:flex/.test(QUELLE),
         'sie tragen keine Zeitspalte');
  const stelleGanz = tag ? tag[0].indexOf('class="tganz') : -1;
  const stelleFalt = tag ? tag[0].indexOf('vorbei-falt') : -1;
  pruefe(stelleGanz > -1 && stelleFalt > -1 && stelleGanz < stelleFalt,
         'sie stehen ganz oben, vor allem mit Uhrzeit');

  if (!g) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = g.pruefeGanztags();
    pruefe(e.anzahl === 4, 'vier ganztägige Einträge an diesem Tag');
    pruefe(e.quellen === 'ohne Art,Urlaub,Feiertag,Ferien',
           'jede Herkunft wird benannt (ist: ' + e.quellen + ')');
    pruefe(e.beruflichNur === 0,
           'auf Beruf gefiltert bleibt von diesen privaten nichts');
    pruefe(e.mitFarbe === 2,
           'jeder Eintrag bringt eine Farbe mit — die Artfarbe oder den neutralen Ton');
  }
}

/* ============================================================
   56. Gruppen einklappen, nach Art filtern
   Grund: „Ohne Thema" ist die groesste Gruppe und schob alles
   andere aus dem Blick. Und eine Kleinigkeit ist etwas anderes
   als eine Aufgabe — manchmal will man nur das eine sehen.
   ============================================================ */
console.log('\n56. Gruppen und Art');
{
  const skript = hauptSkript();
  const a = globalThis.__aufArtApi;

  ['setAufArt', 'passtZurArt', 'gruppeOffen', 'gruppeUm'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  pruefe(/id="aArtAlle"/.test(QUELLE) && /id="aArtHaupt"/.test(QUELLE)
         && /id="aArtKlein"/.test(QUELLE), 'die drei Pillen für die Art sind da');

  const zeichnen = skript.match(/function aufZeichnen\([\s\S]*?\n\}\n/);
  pruefe(zeichnen && /passtZurArt\(alle\[i\]\)/.test(zeichnen[0]),
         'der Artfilter greift auf die Liste');
  pruefe(zeichnen && /gruppeUm\(/.test(zeichnen[0]),
         'der Gruppenkopf ist antippbar');
  pruefe(zeichnen && /if \(!offen\) \{ continue; \}/.test(zeichnen[0]),
         'eine zugeklappte Gruppe zeigt ihre Einträge nicht');
  pruefe(zeichnen && /drin\.length/.test(zeichnen[0]),
         'die Zahl steht auch im zugeklappten Kopf');

  const offen = skript.match(/function gruppeOffen\([\s\S]*?\n\}/);
  pruefe(offen && /indexOf\('Ohne '\) !== 0/.test(offen[0]),
         'Gruppen ohne Zuordnung beginnen eingeklappt');
  pruefe(offen && /stand === 'auf'/.test(offen[0]),
         'eine von Hand geöffnete Gruppe bleibt offen');

  if (!a) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = a.pruefeArt();
    pruefe(e.ohneZu === false, '„Ohne Thema" ist zunächst zu');
    pruefe(e.mitOffen === true, 'eine benannte Gruppe ist offen');
    pruefe(e.nachTippen === true, 'ein Tippen klappt sie auf');
    pruefe(e.nochmal === false, 'ein zweites Tippen wieder zu');
    pruefe(e.auchBenannteZu === false,
           'auch eine benannte Gruppe lässt sich zuklappen');

    pruefe(e.alle === 3, 'ohne Artfilter alle drei');
    pruefe(e.haupt === 2, 'nur Aufgaben: zwei');
    pruefe(e.klein === 1, 'nur Kleinigkeiten: eine');
    pruefe(e.ohneArtGiltAlsAufgabe === true,
           'eine Aufgabe ohne Artangabe zählt als Aufgabe, nicht als Kleinigkeit');
  }
}

/* ============================================================
   57. Jahrestermine austauschen
   Grund: Zwei Bestaende brauchen eine Erstbestueckung. Ein Einlesen
   darf nichts ueberschreiben und beim zweiten Mal nichts doppeln —
   auch dann nicht, wenn dieselbe Sache andere Kennungen traegt.
   ============================================================ */
console.log('\n57. Jahrestermine austauschen');
{
  const skript = hauptSkript();
  const j = globalThis.__jtDateiApi;

  ['jtAusgeben', 'jtUebernehmen', 'jtKennzeichen', 'jtEinlesen',
   'jtDateiGemerkt', 'dateiAnbieten', 'zeichneJtDatei'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  pruefe(/id="jtDatei"/.test(QUELLE), 'es gibt ein Feld für die Datei');
  pruefe(/id="knopfJtLesen"/.test(QUELLE) && /disabled>/.test(QUELLE),
         'der Einleseknopf ist ohne Auswahl gesperrt');
  pruefe(/jtAusgeben\(\)/.test(QUELLE), 'es gibt einen Knopf zum Ausgeben');

  const aus = skript.match(/function jtAusgeben\([\s\S]*?\n\}/);
  pruefe(aus && /JT_DATEI_ART/.test(aus[0]), 'die Datei nennt ihre Art');
  pruefe(aus && /DB\.jahrestermine/.test(aus[0]) && !/DB\.aufgaben/.test(aus[0]),
         'sie enthält nur Jahrestermine, nichts sonst');

  const ueb = skript.match(/function jtUebernehmen\([\s\S]*?\n\}\n/);
  pruefe(ueb && /inhalt\.art !== JT_DATEI_ART/.test(ueb[0]),
         'eine fremde Datei wird abgewiesen');
  pruefe(ueb && /bericht\.vorhanden\+\+/.test(ueb[0]),
         'Vorhandenes wird gezählt, nicht überschrieben');
  pruefe(ueb && !/splice/.test(ueb[0]), 'nichts wird entfernt');

  if (!j) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = j.pruefeAustausch();
    pruefe(e.erst.neu === 3 && e.erst.vorhanden === 0,
           'die Erstbestückung übernimmt alles');
    pruefe(e.zweit.neu === 0 && e.zweit.vorhanden === 3,
           'ein zweites Einlesen doppelt nichts');
    pruefe(e.bestand === 3, 'der Bestand bleibt bei drei');
    pruefe(e.andereKennung.neu === 0,
           'dieselbe Sache mit anderer Kennung wird erkannt');
    pruefe(e.fremd.fehler.length > 0, 'eine fremde Datei meldet einen Fehler');
    pruefe(e.leer.fehler.length > 0, 'ein leerer Inhalt ebenfalls');
    pruefe(e.eigenesBleibt === 'Mein eigener',
           'ein eigener Eintrag mit gleicher Kennung wird nicht überschrieben');
    pruefe(e.felder === 'urlaub|privat|true',
           'Art, Kontext und Wiederholung kommen mit');
  }
}

/* ============================================================
   58. Wiederkehrende Ablaeufe und ihre Zuordnung
   Grund: Tages- und Wochenplanung sind Routinen. Sie muessen von
   selbst anlaufen, duerfen sich aber nicht haeufen — und ein Ablauf
   gehoert oft zu einem Projekt oder Ziel.
   ============================================================ */
console.log('\n58. Wiederkehrende Abläufe');
{
  const skript = hauptSkript();
  const r = globalThis.__routineApi;

  ['offenerDurchlaufVon', 'vorlagenFaellig', 'faelligeStarten',
   'durchlaufAusAufgabe', 'abWdh', 'abWdhTag', 'abWdhMonatstag',
   'abAnlassWahl', 'abAnlassSetzen', 'abAnlassWeg',
   'vhAblaeufeHtml', 'vhAblaufStarten'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  /* Kein Wuchern */
  const faellig = skript.match(/function vorlagenFaellig\([\s\S]*?\n\}/);
  pruefe(faellig && /offenerDurchlaufVon\(v\.id\)/.test(faellig[0]),
         'aus einer Vorlage mit offenem Durchlauf wird kein zweiter gestartet');
  pruefe(faellig && /zuletztGestartet === heute/.test(faellig[0]),
         'auch nicht zweimal am selben Tag');
  pruefe(faellig && /faelligAn\(v\.wiederholung, heute\)/.test(faellig[0]),
         'die Regel entscheidet über die Fälligkeit');

  /* Zwei Anlässe schließen einander aus */
  const wdh = skript.match(/function abWdh\([\s\S]*?\n\}/);
  pruefe(wdh && /anlassAufgabeId = null/.test(wdh[0]),
         'ein Takt löscht eine auslösende Aufgabe');
  const anl = skript.match(/function abAnlassSetzen\([\s\S]*?\n\}/);
  pruefe(anl && /wiederholung = null/.test(anl[0]),
         'eine auslösende Aufgabe löscht den Takt');

  /* Anlass über eine Aufgabe */
  const erl = skript.match(/function aufgabeErledigen\([\s\S]*?\n\}/);
  pruefe(erl && /durchlaufAusAufgabe\(a\.id\)/.test(erl[0]),
         'das Abhaken einer wiederkehrenden Aufgabe kann einen Ablauf starten');

  /* Anlaufen beim Start und beim Sprung auf heute */
  const start = skript.match(/function starten\(\)[\s\S]*?\n\}/);
  pruefe(start && /faelligeStarten\(\)/.test(start[0]), 'beim Start wird geprüft');
  const heute = skript.match(/function tagHeute\([\s\S]*?\n\}/);
  pruefe(heute && /faelligeStarten\(\)/.test(heute[0]),
         'beim Sprung auf heute ebenfalls');

  /* Zuordnung */
  const detail = skript.match(/function abDetailHtml\([\s\S]*?\n\}\n/);
  pruefe(detail && /abFeldSetzen\(\\'projektId\\'/.test(detail[0]),
         'ein Ablauf lässt sich einem Projekt zuordnen');
  pruefe(detail && /abFeldSetzen\(\\'zielId\\'/.test(detail[0]), 'und einem Ziel');
  const vh = skript.match(/function vhDetailHtml\([\s\S]*?\n\}\n/);
  pruefe(vh && /vhAblaeufeHtml\(v\.id, 'projekt'\)/.test(vh[0]),
         'das Projekt zeigt seine Abläufe');
  pruefe(vh && /vhAblaeufeHtml\(v\.id, 'ziel'\)/.test(vh[0]), 'das Ziel ebenfalls');

  const startenAusVorlage = skript.match(/function durchlaufStarten\([\s\S]*?\n\}/);
  pruefe(startenAusVorlage && /projektId: v\.projektId/.test(startenAusVorlage[0]),
         'ein Durchlauf erbt die Zuordnung seiner Vorlage');

  /* Löschen löst, es löscht nicht mit */
  const loe = skript.match(/function vhLoeschen\([\s\S]*?\n\}/);
  pruefe(loe && /samml\[s\]\[k\]\[feld\] = null/.test(loe[0]),
         'ein gelöschtes Vorhaben nimmt keine Abläufe mit');

  if (!r) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = r.pruefeRoutine();
    pruefe(e.faelligHeute === 1, 'eine für heute getaktete Vorlage ist fällig');
    pruefe(e.gestartet === 1, 'sie läuft an');
    pruefe(e.zweiterLauf === 0, 'ein zweiter Lauf am selben Tag startet nichts');
    pruefe(e.trotzErledigt === 0, 'auch mit erledigten Schritten nicht');
    pruefe(e.nachBeenden === 0, 'nach dem Beenden am selben Tag ebenfalls nicht');
    pruefe(e.amNaechstenTag === 1, 'am nächsten Tag wieder');
    pruefe(e.nachAufgabe === 1, 'das Abhaken der Anlassaufgabe startet den Ablauf');
    pruefe(e.nochmalAbhaken === 1, 'ein zweites Abhaken doppelt ihn nicht');
    pruefe(e.geerbt === 'p1', 'der Durchlauf erbt das Projekt der Vorlage');
  }
}

/* ============================================================
   59. Kompakte Ablaufkarten mit Gruppierung
   Grund: Zehn Karten mit allen Schritten fuellten den Bildschirm.
   Eingeklappt zeigt eine Karte nur, was sie ist und wie weit sie
   ist — und die Gruppierung sagt, wozu sie gehoert.
   ============================================================ */
console.log('\n59. Ablaufkarten');
{
  const skript = hauptSkript();
  const a = globalThis.__abGruppeApi;

  ['ablaufAnlassText', 'abGruppeVon', 'abGruppeOffen', 'abGruppeUm',
   'abGruppenHtml'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  /* Eingeklappt nur Titel und Zahl */
  const vk = skript.match(/function vorlageKarteHtml\([\s\S]*?\n\}\n/);
  pruefe(vk && /vk-mehr/.test(vk[0]), 'die Schritte stecken im aufklappbaren Teil');
  pruefe(vk && vk[0].indexOf('vk-mehr') < vk[0].indexOf('vk-ms-titel'),
         'sie stehen nicht im Kopf');
  pruefe(vk && !/vk-satz/.test(vk[0]),
         'die Vorlagenkarte trägt keine zusätzliche Satzzeile mehr');

  const dk = skript.match(/function durchlaufKarteHtml\([\s\S]*?\n\}\n/);
  pruefe(dk && !/vk-satz/.test(dk[0]),
         'auch die Durchlaufkarte nicht');
  pruefe(dk && /fertig \+ ' von ' \+ l\.length/.test(dk[0]),
         'der Kopf nennt den Stand');
  pruefe(dk && /vk-ruht/.test(dk[0]),
         'ein ruhender Durchlauf sagt es trotzdem — sonst wirkte er verschwunden');

  /* Nichts klappt von selbst auf */
  const starten = skript.match(/function durchlaufStarten\([\s\S]*?\n\}/);
  pruefe(starten && !/abOffen\[neu\.id\] = true/.test(starten[0]),
         'ein gestarteter Durchlauf klappt nicht von selbst auf');

  /* Gruppierung */
  /* Seit v0.25.0 wählt der Mensch, wonach gruppiert wird. */
  ['setAbStufe', 'setAbGruppierung', 'istKeinGruppe'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });
  pruefe(/id="abStufeLaufend"/.test(QUELLE) && /id="abStufeVorlagen"/.test(QUELLE),
         'es gibt zwei Reiter');
  pruefe(/id="abGrKeine"/.test(QUELLE) && /id="abGrAufgabe"/.test(QUELLE)
         && /id="abGrProjekt"/.test(QUELLE) && /id="abGrZiel"/.test(QUELLE),
         'die Gruppierung ist über Pillen wählbar');

  const von = skript.match(/function abGruppeVon\([\s\S]*?\n\}/);
  pruefe(von && /abGruppierung === 'projekt'/.test(von[0]), 'nach Projekt lässt sich gruppieren');
  pruefe(von && /abGruppierung === 'ziel'/.test(von[0]), 'nach Ziel ebenfalls');
  pruefe(von && /abGruppierung === 'aufgabe'/.test(von[0]),
         'und nach der auslösenden Aufgabe');
  pruefe(von && /'Kein Projekt'/.test(von[0]) && /'Kein Ziel'/.test(von[0])
         && /'Keine Aufgabe'/.test(von[0]),
         'was die gewählte Zuordnung nicht hat, sammelt sich getrennt');

  const gruppen = skript.match(/function abGruppenHtml\([\s\S]*?\n\}\n/);
  pruefe(gruppen && /abGruppierung === 'keine'/.test(gruppen[0]),
         'ohne Gruppierung bleibt die Liste flach, ganz ohne Köpfe');

  const offen = skript.match(/function abGruppeOffen\([\s\S]*?\n\}/);
  pruefe(offen && /!istKeinGruppe\(name\)/.test(offen[0]),
         'die Kein-Gruppe beginnt eingeklappt');

  const zeichnen = skript.match(/function abZeichnen\([\s\S]*?\n\}\n/);
  pruefe(zeichnen && /abStufe === 'laufend'/.test(zeichnen[0]),
         'gezeigt wird nur der gewählte Reiter');
  pruefe(zeichnen && /Läuft gerade · '/.test(zeichnen[0]),
         'die Reiter tragen ihre Zahl');

  if (!a) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = a.pruefeGruppen();
    pruefe(e.projekt === 'Garage', 'nach Projekt gruppiert trägt die Gruppe seinen Namen');
    pruefe(e.ziel === 'Gewicht', 'nach Ziel ebenso');
    pruefe(e.aufgabe === 'Einkauf', 'nach Aufgabe ebenso');
    pruefe(e.ohneProjekt === 'Kein Projekt', 'ohne Projekt heißt die Gruppe so');
    pruefe(e.ohneZiel === 'Kein Ziel', 'ohne Ziel ebenso');
    pruefe(e.gelöschtesProjekt === 'Kein Projekt',
           'zeigt die Zuordnung ins Leere, gilt sie als keine');
    pruefe(e.keineGruppierung === '', 'ohne Gruppierung gibt es keinen Namen');
    pruefe(e.flachOhneKoepfe === true, 'und keine Gruppenköpfe');
    pruefe(e.keinZuletzt === true, 'die Kein-Gruppe steht am Ende');
  }
}

/* ============================================================
   60. Weg in den Google-Kalender
   Grund: Zum Eintragen und Aendern von Terminen braucht es Google
   selbst. Der Sprung soll an der Stelle landen, die hier zu sehen
   ist — und nicht bei jedem Tippen ein neues Fenster oeffnen.
   ============================================================ */
console.log('\n60. Weg in den Google-Kalender');
{
  const skript = hauptSkript();
  const g = globalThis.__googleKalApi;

  ['googleKalenderAdresse', 'googleKalenderOeffnen'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });
  pruefe(/onclick="googleKalenderOeffnen\(\)"/.test(QUELLE),
         'der Kalenderkopf hat einen Knopf dafür');

  const oeffnen = skript.match(/function googleKalenderOeffnen\([\s\S]*?\n\}/);
  pruefe(oeffnen && /GOOGLE_FENSTER/.test(oeffnen[0]),
         'das Fenster ist benannt, damit es wiederverwendet wird');
  pruefe(oeffnen && /fenster\.focus\(\)/.test(oeffnen[0]),
         'ein schon offenes Fenster wird nach vorn geholt');
  pruefe(oeffnen && /blockiert/.test(oeffnen[0]),
         'wird es vom Browser blockiert, wird das gesagt');

  const adresse = skript.match(/function googleKalenderAdresse\([\s\S]*?\n\}/);
  pruefe(adresse && /kalStufe === 'monat'/.test(adresse[0]),
         'die gezeigte Stufe bestimmt die Ansicht drüben');
  pruefe(adresse && /if \(handy\) \{ stufe = 'day'/.test(adresse[0]),
         'am Handy führt der Weg auf den Tag — Woche und Jahr kommen dort '
         + 'im Schreibtischformat');
  const oeffnen2 = skript.match(/function googleKalenderOeffnen\([\s\S]*?\n\}/);
  pruefe(oeffnen2 && /'_blank'/.test(oeffnen2[0]),
         'am Handy ohne Fensternamen');

  /* Unter Android führt nur der Weg über die App: Google liefert im
     Browser stets die Schreibtischfassung. */
  ['istAndroid', 'androidKalenderAdresse', 'adresseAnklicken'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });
  const andr = skript.match(/function androidKalenderAdresse\([\s\S]*?\n\}/);
  pruefe(andr && /package=com\.google\.android\.calendar/.test(andr[0]),
         'die Adresse spricht die Kalender-App unmittelbar an');
  pruefe(andr && /intent:\/\/com\.android\.calendar\/time\//.test(andr[0]),
         'sie nennt den Anbieter com.android.calendar — ohne ihn zeigt sie ins Leere');
  pruefe(new RegExp('function\\s+kalenderWeg\\s*\\(').test(skript),
         'der Weg lässt sich umstellen');
  const weg = skript.match(/function kalenderWeg\([\s\S]*?\n\}/);
  pruefe(weg && /istHandy\(\) \? 'mobil' : 'voll'/.test(weg[0]),
         'voreingestellt ist am Handy die mobile Seite, am Rechner die volle');
  pruefe(weg && /w === 'app' \|\| w === 'mobil' \|\| w === 'voll'/.test(weg[0]),
         'drei Wege stehen zur Wahl');
  pruefe(new RegExp('function\\s+mobilKalenderAdresse\\s*\\(').test(skript),
         'die mobile Seite hat eine eigene Adresse');
  const mob = skript.match(/function mobilKalenderAdresse\([\s\S]*?\n\}/);
  pruefe(mob && /calendar\/gp/.test(mob[0]),
         'sie zeigt auf die mobile Fassung von Google');
  pruefe(oeffnen2 && /weg === 'mobil'/.test(oeffnen2[0]),
         'der gewählte Weg entscheidet über die Adresse');
  pruefe(oeffnen2 && /istAndroid\(\) && weg === 'app'/.test(oeffnen2[0]),
         'der Weg über die App gilt nur unter Android');
  pruefe(andr && /browser_fallback_url/.test(andr[0]),
         'fehlt die App, greift eine Rückfalladresse');
  pruefe(andr && /12, 0, 0/.test(andr[0]),
         'gerechnet wird auf Mittag — sonst kippt der Tag über die Zeitzone');
  const klick = skript.match(/function adresseAnklicken\([\s\S]*?\n\}/);
  pruefe(klick && /a\.click\(\)/.test(klick[0]),
         'geöffnet wird über einen angeklickten Verweis, nicht über window.open');
  pruefe(oeffnen2 && /istAndroid\(\)/.test(oeffnen2[0]),
         'unter Android wird dieser Weg gewählt');
  pruefe(new RegExp('function\\s+istHandy\\s*\\(').test(skript),
         'Funktion istHandy ist definiert');
  const handy = skript.match(/function istHandy\([\s\S]*?\n\}/);
  pruefe(handy && /pointer: coarse/.test(handy[0]),
         'erkannt wird es am Zeigegerät, nicht nur an der Breite');
  pruefe(adresse && /kalAnker \|\| isoDatum\(\)/.test(adresse[0]),
         'und der gezeigte Tag das Datum');

  if (!g) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = g.pruefeAdresse();
    pruefe(e.woche === 'https://calendar.google.com/calendar/u/0/r/week/2026/8/10',
           'die Woche führt am großen Bildschirm zur Wochenansicht');
    pruefe(e.handy.indexOf('/day/2026/8/10') > 0,
           'am Handy dagegen zum Tag, mit demselben Datum');
    pruefe(e.monat.indexOf('/month/2026/8/10') > 0, 'der Monat zur Monatsansicht');
    pruefe(e.jahr.indexOf('/year/2026/8/10') > 0, 'das Jahr zur Jahresansicht');
    pruefe(e.name === 'workbench-google-kalender',
           'immer dasselbe Fenster, nie ein zweites');
    pruefe(e.androidTag === '2026-08-10',
           'die Android-Adresse trifft denselben Tag');
  }
}

/* ============================================================
   61. Wochensicht: Termine oben, Aufgaben gesammelt
   Grund: Eine auf einen Tag gelegte Aufgabe stand in der Tagesspalte
   und fehlte in der Wochenliste — die Woche zeigte nie, was sie
   insgesamt vorhat. Und Erledigtes verschwand spurlos.
   ============================================================ */
console.log('\n61. Wochensicht');
{
  const skript = hauptSkript();
  const w = globalThis.__wocheApi;

  ['wochenAufgaben', 'wochenListeHtml'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  const liste = skript.match(/function wochenAufgaben\([\s\S]*?\n\}/);
  pruefe(liste && /p === 'woche'/.test(liste[0]) && /p >= mo && p <= so/.test(liste[0]),
         'die Liste fasst Wochenliste und Tagesplanung zusammen');
  pruefe(liste && /p === 'naechste'/.test(liste[0]),
         'auch was auf die nächste Woche gelegt ist');
  pruefe(liste && /montagVon\(isoDatum\(\)\)/.test(liste[0]),
         '„diese" und „nächste" messen sich an heute, nicht an der gezeigten Woche');
  pruefe(liste && !/status === 'erledigt'/.test(liste[0]),
         'Erledigtes bleibt in der Liste');
  pruefe(liste && /a\.wiederholung.*continue/s.test(liste[0]),
         'Wiederkehrendes gehört nicht hinein');

  const html = skript.match(/function wochenListeHtml\([\s\S]*?\n\}\n/);
  pruefe(html && /ttitel' \+ \(fertig \? ' fertig' : ''\)/.test(html[0]),
         'Erledigtes steht durchgestrichen da');
  pruefe(html && /aufgabeWiederOeffnen\(/.test(html[0]),
         'ein Haken lässt sich zurücknehmen');
  pruefe(html && /offen \+ ' offen von '/.test(html[0]),
         'der Kopf nennt offen und gesamt');
  pruefe(html && /planungText\(w\)/.test(html[0]),
         'jede Zeile zeigt ihren Tag oder „Woche"');

  if (!w) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = w.pruefeWoche();
    pruefe(e.anzahl === 3, 'drei Einträge: zwei mit Tag, einer für die Woche');
    pruefe(e.titel === 'Am Montag, erledigt,Am Dienstag,Nur diese Woche',
           'sortiert nach Tag, Undatiertes zuletzt');
    pruefe(e.kleinigkeitDrin === false, 'eine Kleinigkeit steht nicht darin');
    pruefe(e.naechsteWocheDrin === false, 'eine Aufgabe der Folgewoche auch nicht');
    pruefe(e.backlogDrin === false, 'und nichts aus dem Backlog');
    pruefe(e.erledigtDrin === true, 'Erledigtes dieser Woche bleibt');
    pruefe(e.wiederkehrendDrin === false, 'Wiederkehrendes nicht');
  }
}

/* ============================================================
   62. Ablauf an einem Termin, Planung auf die naechste Woche
   Grund: Bei den meisten Besprechungen sind es dieselben Handgriffe.
   Sie sollen sich an den einzelnen Termin heften lassen — und die
   Nachbereitung darf nicht schon am Morgen dastehen.
   ============================================================ */
console.log('\n62. Termin-Abläufe und nächste Woche');
{
  const skript = hauptSkript();
  const t = globalThis.__terminAblaufApi;

  ['durchlaufZuTermin', 'terminDurchlaufStarten', 'terminAblaufWahl',
   'terminAblaufSetzen', 'terminFuerKennung', 'abSchrittWann'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  const zeile = skript.match(/function verlaufHtml\([\s\S]*?\n\}\n/);
  pruefe(zeile && /terminAblaufWahl\(/.test(zeile[0]),
         'jede Terminzeile bietet das Anheften an');
  pruefe(zeile && /t-ablauf an[\s\S]{0,200}schritteFertig\(lauf\)/.test(zeile[0]),
         'ein angehefteter Ablauf zeigt seinen Stand in der Zeile');
  pruefe(/\.t-ablauf\{[^}]*font-size:calc\(var\(--fs\)\*0\.6/.test(QUELLE),
         'die Pille ist kleiner gesetzt als der Termintitel');
  pruefe(/\.t-ablauf\{[^}]*align-self:flex-start/.test(QUELLE),
         'sie sitzt oben, nicht auf halber Höhe der Beschreibung');

  const starten = skript.match(/function terminDurchlaufStarten\([\s\S]*?\n\}\n/);
  pruefe(starten && /terminId: termin\.id/.test(starten[0]),
         'der Durchlauf merkt sich das Vorkommen, nicht die Serie');
  pruefe(starten && /v\.name \+ ': ' \+ \(termin\.titel/.test(starten[0]),
         'sein Name nennt Vorlage und Termin');
  pruefe(starten && /wann === 'danach'/.test(starten[0]),
         'Danach-Schritte bekommen ein Ruhen');

  const ruht = skript.match(/function schrittRuht\([\s\S]*?\n\}/);
  pruefe(ruht && /s\.abZeit > uhrzeitJetzt\(\)/.test(ruht[0]),
         'am Tag selbst entscheidet zusätzlich die Uhrzeit');
  pruefe(ruht && /tag === isoDatum\(\)/.test(ruht[0]),
         'die Uhrzeit gilt nur für heute — an anderen Tagen sagt sie nichts');

  const detail = skript.match(/function abDetailHtml\([\s\S]*?\n\}\n/);
  pruefe(detail && /abSchrittWann\(/.test(detail[0]),
         'in der Vorlage lässt sich davor und danach setzen');

  /* Nächste Woche */
  pruefe(/planung === 'naechste'/.test(skript), 'die Planungsstufe „nächste Woche" gibt es');
  const weiter = skript.match(/function planungWeiter\([\s\S]*?\n\}/);
  pruefe(weiter && /jetztWert === 'woche'.*'naechste'/s.test(weiter[0]),
         'der Knopf schaltet von dieser auf die nächste Woche');
  const text = skript.match(/function planungText\([\s\S]*?\n\}/);
  pruefe(text && /Nächste Woche/.test(text[0]), 'sie ist beschriftet');
  const gr = skript.match(/function gruppeVonPlanung\([\s\S]*?\n\}/);
  pruefe(gr && /'Nächste Woche'/.test(gr[0]), 'sie hat eine eigene Gruppe');

  if (!t) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = t.pruefeTermin();
    pruefe(e.name === 'Besprechung: JF-Weekly', 'der Durchlauf trägt beide Namen');
    pruefe(e.terminId === 'g1', 'die Terminkennung ist vermerkt');
    pruefe(e.davorOhneRuhen === true, 'Davor-Schritte ruhen nicht');
    pruefe(e.danachMitZeit === e.terminEnde,
           'Danach-Schritte ruhen bis zum Terminende');
    pruefe(e.vorDemTermin === 'Agenda', 'vor dem Termin steht nur die Vorbereitung an');
    pruefe(e.nachDerAgenda === '', 'danach ruht der nächste Schritt noch');
    pruefe(e.nachDemTermin === 'Protokoll', 'nach dem Termin erscheint er');
    pruefe(e.zweiterAmTermin === 1, 'an denselben Termin wird nichts Zweites geheftet');
  }
}

/* ============================================================
   63. Monat in zwei Spalten
   Grund: Dreissig Zeilen mit je zwei Ebenen fuellen am grossen
   Bildschirm mehr als eine Seite, waehrend rechts die halbe Breite
   leer bleibt. Der Monat soll auf einen Blick passen.
   ============================================================ */
console.log('\n63. Monat in zwei Spalten');
{
  const skript = hauptSkript();
  const m = globalThis.__monatSpaltenApi;

  pruefe(new RegExp('function\\s+monatsHaelfte\\s*\\(').test(skript),
         'Funktion monatsHaelfte ist definiert');

  const monat = skript.match(/function monatHtml\([\s\S]*?\n\}\n/);
  pruefe(monat && /mhaelfte-links/.test(monat[0]) && /mhaelfte-rechts/.test(monat[0]),
         'der Monat wird in zwei Hälften gelegt');
  pruefe(monat && /t === grenze \+ 1/.test(monat[0]),
         'die zweite Hälfte beginnt an der berechneten Grenze');

  pruefe(/\.mhaelfte\{display:contents\}/.test(QUELLE),
         'im schmalen Bild lösen sich die Hälften auf');
  pruefe(/body\.breit \.mhaelfte\{display:block\}/.test(QUELLE),
         'im breiten Bild werden sie zu Spalten');
  pruefe(/body\.breit \.monatsraster\{[^}]*repeat\(2,minmax\(0,1fr\)\)/.test(QUELLE),
         'es sind genau zwei gleich breite Spalten');
  pruefe(/body\.breit \.monatsraster\{[^}]*align-items:start/.test(QUELLE),
         'beide Spalten beginnen oben');

  const zeichnen = skript.match(/function kalZeichnen\([\s\S]*?\n\}\n/);
  pruefe(zeichnen && /monatsraster/.test(zeichnen[0]),
         'der Monat bekommt seinen Behälter');

  if (!m) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = m.pruefeMonatSpalten();
    pruefe(e.h28 === 14, 'der Februar wird 14 zu 14 geteilt');
    pruefe(e.h29 === 15, 'ein Schaltjahr 15 zu 14');
    pruefe(e.h30 === 15, 'ein dreißigtägiger Monat 15 zu 15');
    pruefe(e.h31 === 16, 'ein einunddreißigtägiger 16 zu 15');
    pruefe(e.linksSeptember === 15 && e.rechtsSeptember === 15,
           'im September stehen fünfzehn Tage je Spalte');
    pruefe(e.ausgeglichen === true, 'die erzeugten Elemente sind ausgeglichen');
    pruefe(e.alleTageDa === 31, 'kein Tag geht bei der Teilung verloren');
  }
}

/* ============================================================
   64. Kleinigkeiten in der Wochensicht
   Grund: Eine Kleinigkeit auf „Woche" hat keinen Tag — kein
   Tagesplan zeigte sie, und aus der Wochenliste war sie
   ausgeschlossen. Sie fiel durch alle Raster.
   ============================================================ */
console.log('\n64. Kleinigkeiten in der Woche');
{
  const skript = hauptSkript();
  const k = globalThis.__kleinApi;

  ['wochenKleinigkeiten', 'wochenKleinOffen', 'wochenKleinUm',
   'wochenKleinBanner', 'wochenKleinHtml'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  const woche = skript.match(/function wocheHtml\([\s\S]*?\n\}\n/);
  pruefe(woche && /wochenKleinBanner\(mo\)/.test(woche[0]),
         'oben steht ein Hinweis, wenn welche offen sind');
  pruefe(woche && /wochenKleinHtml\(mo\)/.test(woche[0]),
         'der Block hängt ganz unten');

  const liste = skript.match(/function wochenKleinigkeiten\([\s\S]*?\n\}/);
  pruefe(liste && /a\.art !== 'klein'/.test(liste[0]), 'nur Kleinigkeiten');
  pruefe(liste && /p === 'woche'/.test(liste[0]) && /p === 'naechste'/.test(liste[0]),
         'auch die ohne festen Tag');
  pruefe(liste && /x\.frist \|\| '9999-12-31'/.test(liste[0]),
         'sortiert nach Frist — die mit Frist zuerst');

  const banner = skript.match(/function wochenKleinBanner\([\s\S]*?\n\}/);
  pruefe(banner && /!offen \|\| wochenKleinAuf/.test(banner[0]),
         'der Hinweis verschwindet, sobald aufgeklappt ist oder nichts offen');

  const um = skript.match(/function wochenKleinUm\([\s\S]*?\n\}/);
  pruefe(um && /scrollTop = blatt\.scrollHeight/.test(um[0]),
         'beim Aufklappen wird ans Ende gerollt');

  const html = skript.match(/function wochenKleinHtml\([\s\S]*?\n\}\n/);
  pruefe(html && /offen \+ ' offen von '/.test(html[0]),
         'der Kopf nennt offen und gesamt');
  pruefe(html && /aufgabeWiederOeffnen\(/.test(html[0]),
         'ein Haken lässt sich zurücknehmen');

  if (!k) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = k.pruefeKlein();
    pruefe(e.anzahl === 3, 'drei Kleinigkeiten in dieser Woche');
    pruefe(e.offen === 2, 'zwei davon offen');
    pruefe(e.mitFristZuerst === 'Batterien', 'die mit Frist steht oben');
    pruefe(e.hauptNichtDrin === true, 'eine Hauptaufgabe steht nicht darin');
    pruefe(e.naechsteNichtDrin === true,
           'eine für die nächste Woche gehört nicht in diese');
    pruefe(e.erledigtDrin === true, 'Erledigtes bleibt sichtbar');
    pruefe(e.wiederkehrendDrin === false, 'Wiederkehrendes nicht');
  }
}

/* ============================================================
   65. Laufenden Ablauf an einen Termin haengen
   Grund: Ein einmaliger Durchlauf und sein Termin standen
   nebeneinander, ohne voneinander zu wissen. Und fuer eine Sache
   ohne Vorlage musste man den Bildschirm wechseln.
   ============================================================ */
console.log('\n65. Ablauf und Termin verbinden');
{
  const skript = hauptSkript();
  const v = globalThis.__terminVerbindungApi;

  ['terminDurchlaufAnhaengen', 'terminAblaufNeu',
   'terminAblaufLoesen'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  const wahl = skript.match(/function terminAblaufWahl\([\s\S]*?\n\}\n/);
  pruefe(wahl && /Aus einer Vorlage/.test(wahl[0]), 'der erste Weg führt über eine Vorlage');
  pruefe(wahl && /Oder einen laufenden Ablauf/.test(wahl[0]),
         'der zweite über einen laufenden Durchlauf');
  pruefe(wahl && /Oder einen einmaligen anlegen/.test(wahl[0]),
         'der dritte legt einen einmaligen an');
  pruefe(wahl && /d\[i\]\.terminId\) \{ continue/.test(wahl[0]),
         'schon verbundene Durchläufe stehen nicht zur Wahl');
  pruefe(wahl && /!offenerSchritt\(d\[i\]\)/.test(wahl[0]),
         'ein durchgelaufener auch nicht');
  pruefe(wahl && /value="' \+ esc\(t\.titel\)/.test(wahl[0]),
         'der Name des neuen ist mit dem Termintitel vorbelegt');

  const anh = skript.match(/function terminDurchlaufAnhaengen\([\s\S]*?\n\}/);
  pruefe(anh && !/schritte/.test(anh[0]),
         'ein laufender Durchlauf wird nur verknüpft, seine Schritte bleiben unberührt');
  pruefe(anh && /if \(!d\.frist\)/.test(anh[0]),
         'eine schon gesetzte Frist wird nicht überschrieben');

  const loesen = skript.match(/function terminAblaufLoesen\([\s\S]*?\n\}/);
  pruefe(loesen && /terminId = null/.test(loesen[0]), 'Lösen trennt nur die Verbindung');
  pruefe(loesen && !/splice/.test(loesen[0]), 'der Durchlauf bleibt bestehen');

  const zeile = skript.match(/function verlaufHtml\([\s\S]*?\n\}\n/);
  pruefe(zeile && /terminAblaufLoesen\(/.test(zeile[0]),
         'in der Tageszeile lässt sich die Verbindung lösen');
  const detail = skript.match(/function abDetailHtml\([\s\S]*?\n\}\n/);
  pruefe(detail && /a\.terminId/.test(detail[0]),
         'der Durchlauf nennt seinen Termin');

  if (!v) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = v.pruefeVerbindung();
    pruefe(e.verknuepft === 'ALM', 'ein laufender Durchlauf lässt sich anhängen');
    pruefe(e.standBleibt === true, 'sein Stand bleibt erhalten');
    pruefe(e.ohneRuhen === true, 'seine Schritte bekommen kein Ruhen');
    pruefe(e.fristGesetzt === true, 'eine fehlende Frist wird auf den Termintag gesetzt');
    pruefe(e.fristBleibt === '2026-12-24',
           'eine vorhandene Frist bleibt unangetastet');
    pruefe(e.nachLoesen === null, 'Lösen trennt die Verbindung');
    pruefe(e.bleibtErhalten === true, 'der Durchlauf bleibt im Bestand');
    pruefe(e.neuerName === 'Workshop', 'ein einmaliger lässt sich anlegen');
    pruefe(e.neuerOhneVorlage === true, 'er hat keine Vorlage');
    pruefe(e.neuerAmTermin === true, 'und hängt am Termin');
  }
}

/* ============================================================
   66. Arten aus dem Kalender
   Grund: Ein gemeinsamer Kalender loest das Problem zweier Bestaende,
   aber ein Google-Termin kennt keine Art. Sie steht deshalb als
   Kuerzel im Termin selbst — dort gilt sie fuer alle, die ihn sehen.
   ============================================================ */
console.log('\n66. Arten aus dem Kalender');
{
  const skript = hauptSkript();
  const a = globalThis.__artApi;

  ['artAusText', 'titelOhneArt', 'terminArt', 'zuordnungArt', 'zuordnungSetzen',
   'artenAlle', 'artName', 'artFarbe', 'artFarbeAus', 'kalenderJahrestermine',
   'jahrestermineUndKalender', 'artWahlOeffnen', 'artWahlSetzen', 'artWahlNeu',
   'jtAlsIcs'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  /* Am Kalender wird nichts geändert */
  pruefe(/calendar\.readonly/.test(QUELLE), 'das Kalenderrecht bleibt nur lesend');
  const setzen = skript.match(/function zuordnungSetzen\([\s\S]*?\n\}/);
  pruefe(setzen && /DB\.kalenderzuordnung/.test(setzen[0]),
         'die eigene Zuordnung landet in der eigenen Datei');

  /* Vorrang */
  const art = skript.match(/function terminArt\([\s\S]*?\n\}/);
  pruefe(art && art[0].indexOf('zuordnungArt') < art[0].indexOf('artAusText'),
         'die eigene Zuordnung geht vor das Kürzel im Termin');

  /* Beschreibung wird mitgelesen */
  pruefe(/items\(id,summary,description/.test(QUELLE),
         'die Beschreibung wird von Google mitgeholt');

  /* ICS-Ausgabe */
  const ics = skript.match(/function jtAlsIcs\([\s\S]*?\n\}\n/);
  pruefe(ics && /DESCRIPTION:' \+ icsZeile\('#' \+ e\.art\)/.test(ics[0]),
         'die Ausgabe schreibt die Art als Kürzel in die Beschreibung');
  pruefe(ics && /SUMMARY:' \+ icsZeile\(e\.titel\)/.test(ics[0]),
         'der Titel bleibt unberührt');
  pruefe(ics && /RRULE:FREQ=YEARLY/.test(ics[0]),
         'jährliche Termine werden als Serie ausgegeben');
  pruefe(ics && /tagePlus\(bis, 1\)/.test(ics[0]),
         'das Ende wird um einen Tag verschoben, wie ICS es verlangt');

  if (!a) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = a.pruefeArten();
    pruefe(e.ausTitel === 'urlaub', 'das Kürzel im Titel wird gelesen');
    pruefe(e.ausBeschreibung === 'dienstreise', 'auch das in der Beschreibung');
    pruefe(e.titelSauber === 'Kreta', 'der Titel erscheint ohne das Kürzel');
    pruefe(e.neueArt === 'kur', 'eine unbekannte Art wird übernommen');
    pruefe(e.neueArtName === 'Kur', 'sie bekommt einen lesbaren Namen');
    pruefe(e.neueArtFarbe.indexOf('hsl(') === 0,
           'und eine Farbe, die sich aus ihrem Namen ergibt');
    pruefe(e.farbeStabil === true, 'derselbe Name ergibt immer dieselbe Farbe');
    pruefe(e.ohneKuerzel === '', 'ohne Kürzel bleibt die Art leer');
    pruefe(e.inArtenListe === true, 'die neue Art steht in der Auswahl');
    pruefe(e.zuordnungGewinnt === 'krank',
           'die eigene Zuordnung schlägt das Kürzel im Termin');
    pruefe(e.urlaubMachtFrei === 'Freizeittag',
           'ein Urlaub aus dem Kalender macht den Tag frei');
    pruefe(e.keineDublette === 1,
           'ein ganztägiger Kalendertermin erscheint im Tag genau einmal');
  }
}

/* ============================================================
   67. Ein Schritt als Fenster auf seine Aufgabe
   Grund: Derselbe Handgriff kommt in mehreren Ablaeufen vor. Statt
   Haken zwischen Schritten nachzuziehen — mit Ringen, halben
   Zustaenden und Loechern beim Loeschen — gibt es nur eine Wahrheit:
   die Aufgabe. Der Schritt zeigt sie an.
   ============================================================ */
console.log('\n67. Schritt und Aufgabe');
{
  const skript = hauptSkript();
  const s = globalThis.__traegerApi;

  ['schrittAufgabe', 'schrittFertig', 'schrittTitel', 'durchlaeufeZuAufgabe',
   'abSchrittWahl', 'abSchrittVerknuepfen', 'abSchrittLoesen'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  /* Der Stand kommt von der Aufgabe, nicht vom Schritt */
  const fertig = skript.match(/function schrittFertig\([\s\S]*?\n\}/);
  pruefe(fertig && /a\.status === 'erledigt'/.test(fertig[0]),
         'trägt eine Aufgabe den Schritt, gilt ihr Stand');
  pruefe(fertig && /!!s\.fertig/.test(fertig[0]),
         'ohne Aufgabe gilt der eigene Stand des Schritts');

  const um = skript.match(/function schrittUm\([\s\S]*?\n\}/);
  pruefe(um && /aufgabeErledigen\(a\.id\)/.test(um[0]),
         'ein Haken am Schritt hakt die Aufgabe ab');
  pruefe(um && /aufgabeWiederOeffnen\(a\.id\)/.test(um[0]),
         'und nimmt ihn auch wieder zurück');
  pruefe(um && !/nachziehen|synchron/i.test(um[0]),
         'es wird nichts nachgezogen — es gibt nur eine Sache');

  /* Der Titel gehört der Aufgabe */
  const detail = skript.match(/function abDetailHtml\([\s\S]*?\n\}\n/);
  pruefe(detail && /ms-fest/.test(detail[0]),
         'der Titel eines getragenen Schritts ist nicht doppelt änderbar');
  pruefe(detail && /abSchrittWahl\(/.test(detail[0]),
         'eine vorhandene Aufgabe lässt sich verknüpfen');
  pruefe(detail && /abSchrittLoesen\(/.test(detail[0]), 'und wieder lösen');

  /* Was nicht tragen darf */
  const wahl = skript.match(/function abSchrittWahl\([\s\S]*?\n\}\n/);
  pruefe(wahl && /l\[k\]\.wiederholung.*continue/s.test(wahl[0]),
         'Wiederkehrendes trägt keinen Schritt');
  pruefe(wahl && !/l\[k\]\.art === 'klein'\) \{ continue/.test(wahl[0]),
         'eine Kleinigkeit darf tragen');
  pruefe(wahl && /Kleinigkeit'/.test(wahl[0]),
         'sie ist in der Auswahl als solche gekennzeichnet');

  /* Lösen und Löschen hinterlassen keine Lücke */
  const loesen = skript.match(/function abSchrittLoesen\([\s\S]*?\n\}/);
  pruefe(loesen && /a\.schritte\[i\]\.titel = traeger\.titel/.test(loesen[0]),
         'beim Lösen übernimmt der Schritt Titel und Stand');
  const loeschen = skript.match(/function aufgabeLoeschen\([\s\S]*?\n\}/);
  pruefe(loeschen && /durchlaeufeZuAufgabe\(id\)/.test(loeschen[0]),
         'beim Löschen einer Aufgabe werden ihre Schritte versorgt');

  /* Die Aufgabe weiß, wo sie vorkommt */
  const aufg = skript.match(/function detailHtml\([\s\S]*?\n\}\n/);
  pruefe(aufg && /Trägt Schritte in/.test(aufg[0]),
         'die Aufgabe nennt die Abläufe, in denen sie vorkommt');

  if (!s) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = s.pruefeTraeger();
    pruefe(e.titelAusAufgabe === 'Offerings anlegen', 'der Schritt zeigt ihren Titel');
    pruefe(e.vorher === '0,0,0', 'zu Beginn ist nichts erledigt');
    pruefe(e.nachHaken === '1,1,1',
           'ein Haken in einem Ablauf gilt sofort in allen dreien');
    pruefe(e.aufgabeErledigt === 'erledigt', 'die Aufgabe ist erledigt');
    pruefe(e.nachRuecknahme === '0,0,0', 'die Rücknahme gilt ebenso überall');
    pruefe(e.ueberTagesplan === '1,1,1',
           'ein Haken im Tagesplan wirkt genauso');
    pruefe(e.eigenerSchrittUnberuehrt === false,
           'ein Schritt ohne Aufgabe bleibt davon unberührt');
    pruefe(e.weissVon === 3, 'die Aufgabe kennt alle drei Abläufe');
    pruefe(e.kleinigkeitTraegt === true, 'auch eine Kleinigkeit kann tragen');
    pruefe(e.nachLoeschenTitel === 'Offerings anlegen',
           'nach dem Löschen behalten die Schritte den Titel');
    pruefe(e.nachLoeschenStand === '1,1,1', 'und ihren Stand');
  }
}

/* ============================================================
   68. Kompaktes Abhakblatt
   Grund: Aus dem Tag und dem Kalender heraus zaehlt nur das Abhaken.
   Die volle Pflegeflaeche mit Textfeldern, Kontextwahl und Loeschen
   ist dort ein Hindernis — gepflegt wird ein Ablauf in seiner Flaeche.
   ============================================================ */
console.log('\n68. Abhakblatt');
{
  const skript = hauptSkript();
  const a = globalThis.__abhakApi;

  ['durchlaufAbhakenOeffnen', 'abhakHtml', 'abhakUm', 'abhakNeu'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  const blatt = skript.match(/function abhakHtml\([\s\S]*?\n\}\n/);
  pruefe(blatt && /abhakUm\(/.test(blatt[0]), 'jeder Schritt lässt sich abhaken');
  pruefe(blatt && /schrittTitel\(/.test(blatt[0]),
         'der Titel kommt von der tragenden Aufgabe, wenn es eine gibt');
  pruefe(blatt && /schrittRuht\(/.test(blatt[0]), 'ein ruhender Schritt sagt es');
  pruefe(blatt && !/textarea/.test(blatt[0]), 'es gibt kein Feld zum Ändern');
  pruefe(blatt && !/gefahr/.test(blatt[0]), 'und keinen Löschknopf');
  pruefe(blatt && /abDetailOeffnen\(/.test(blatt[0]),
         'ein Knopf führt in die Pflegefläche');

  /* Die Aufrufe aus Tag und Kalender gehen aufs Abhakblatt */
  const verlauf = skript.match(/function verlaufHtml\([\s\S]*?\n\}\n/);
  pruefe(verlauf && /durchlaufAbhakenOeffnen\(/.test(verlauf[0]),
         'die Terminzeile im Tag führt zum Abhaken');
  const klammer = skript.match(/function ablaufKlammerHtml\([\s\S]*?\n\}\n/);
  pruefe(klammer && /durchlaufAbhakenOeffnen\(/.test(klammer[0]),
         'der Abschnitt Abläufe im Tag ebenso');
  const kal = skript.match(/function kAblaufKnopfHtml\([\s\S]*?\n\}/);
  pruefe(kal && /durchlaufAbhakenOeffnen\(/.test(kal[0]),
         'und die Wochensicht');

  /* Beim ersten Anlegen bleibt die volle Fläche */
  const neu = skript.match(/function terminAblaufNeu\([\s\S]*?\n\}/);
  pruefe(neu && /abDetailOeffnen\(neu\.id/.test(neu[0]),
         'ein frisch angelegter Ablauf öffnet die Pflegefläche — dort fehlen '
         + 'ja noch die Schritte');

  if (!a) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = a.pruefeAbhaken();
    pruefe(e.zeilen === 3, 'alle Schritte stehen im Blatt');
    pruefe(e.stand === '1 von 3', 'der Kopf nennt den Stand');
    pruefe(e.titelAusAufgabe === true,
           'ein getragener Schritt zeigt den Titel seiner Aufgabe');
    pruefe(e.ohneFelder === true, 'es gibt keine Eingabefelder');
    pruefe(e.nachHaken === '2 von 3', 'ein Haken zählt sofort mit');
    pruefe(e.aufgabeErledigt === 'erledigt',
           'und wirkt auf die tragende Aufgabe');
  }
}

/* ============================================================
   69. Die Zahl am App-Symbol
   Grund: Auf dem Startbildschirm soll ohne Oeffnen sichtbar sein,
   was heute noch aussteht. Sie muss den ganzen Tag meinen, nicht
   den gerade gefilterten Ausschnitt — und ohne Unterstuetzung des
   Geraets still ausbleiben.
   ============================================================ */
console.log('\n69. Zahl am App-Symbol');
{
  const skript = hauptSkript();
  const b = globalThis.__badgeApi;

  ['offeneHeute', 'badgeSetzen', 'badgeTaktStarten'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  const offen = skript.match(/function offeneHeute\([\s\S]*?\n\}/);
  pruefe(offen && /tagFilter = 'alle'/.test(offen[0]),
         'der Filter des Tagesplans wird für die Zählung übergangen');
  pruefe(offen && /tagFilter = merk/.test(offen[0]),
         'und danach wiederhergestellt');
  pruefe(offen && /eintragVorbei/.test(offen[0]),
         'ein vorbeigegangener Termin zählt nicht mehr');
  pruefe(offen && /ablaufSchritteHeute/.test(offen[0]),
         'offene Ablaufschritte zählen mit');

  const setzen = skript.match(/function badgeSetzen\([\s\S]*?\n\}/);
  pruefe(setzen && /typeof navigator\.setAppBadge !== 'function'/.test(setzen[0]),
         'ohne Unterstützung geschieht nichts');
  pruefe(setzen && /catch/.test(setzen[0]),
         'ein Fehler des Geräts bricht nichts ab');
  pruefe(setzen && /clearAppBadge/.test(setzen[0]),
         'bei null wird die Zahl entfernt');
  pruefe(setzen && /document\.title/.test(setzen[0]),
         'der Fenstertitel trägt sie mit — der Weg, der überall wirkt');
  pruefe(setzen && /APP_VERSION/.test(setzen[0]),
         'die Version bleibt im Titel stehen');
  pruefe(setzen && /n === badgeZahl/.test(setzen[0]),
         'ohne Änderung wird nichts gesetzt');

  const takt = skript.match(/function badgeTaktStarten\([\s\S]*?\n\}/);
  pruefe(takt && /setInterval/.test(takt[0]),
         'regelmäßig wird nachgesehen — ein Termin wird ohne Zutun vorbei');

  if (!b) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = b.pruefeBadge();
    pruefe(e.gesamt === 5, 'alle fünf offenen Dinge des Tages zählen');
    pruefe(e.erledigtZaehltNicht === true, 'Erledigtes zählt nicht mit');
    pruefe(e.andererTagZaehltNicht === true, 'was auf einen anderen Tag liegt, auch nicht');
    pruefe(e.vorbeiZaehltNicht === true, 'ein vorbeigegangener Termin nicht');
    pruefe(e.filterEgal === 5, 'der Kontextfilter ändert die Zahl nicht');
    pruefe(e.nachHaken === 3, 'zwei Haken senken sie um zwei');
    pruefe(e.titel === '(3) Workbench ' + e.version,
           'der Titel trägt Zahl und Version');
  }
}

/* ============================================================
   70. Die Zahl auch bei geschlossener App
   Grund: setAppBadge wirkt nur, solange die App laeuft — danach
   veraltet die Zahl. Der Service Worker kann sie nachziehen, kennt
   aber den Bestand nicht und kann localStorage nicht lesen. Deshalb
   legt die App eine Vorausschau in den Vorrat.
   ============================================================ */
console.log('\n70. Zahl bei geschlossener App');
{
  const skript = hauptSkript();
  const v = globalThis.__vorausApi;

  ['vorausRechnen', 'vorausAblegen', 'hintergrundAnmelden'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  const rechnen = skript.match(/function vorausRechnen\([\s\S]*?\n\}/);
  pruefe(rechnen && /tagOffen = merkTag/.test(rechnen[0]),
         'der angezeigte Tag wird hinterher wiederhergestellt');
  pruefe(rechnen && /tagFilter = merkFilter/.test(rechnen[0]),
         'der Filter ebenso');
  pruefe(rechnen && /VORAUS_TAGE/.test(rechnen[0]),
         'die Vorausschau reicht über mehrere Tage');

  const ablegen = skript.match(/function vorausAblegen\([\s\S]*?\n\}\n/);
  pruefe(ablegen && /caches\.open\(VORAUS_SCHLUESSEL\)/.test(ablegen[0]),
         'sie landet im Vorrat — nur dort kommt der Service Worker heran');
  pruefe(ablegen && /localStorage\.setItem/.test(ablegen[0]),
         'zusätzlich im localStorage für die Diagnose');

  const anmelden = skript.match(/function hintergrundAnmelden\([\s\S]*?\n\}\n/);
  pruefe(anmelden && /periodicSync/.test(anmelden[0]),
         'der Hintergrundtermin wird angemeldet');
  pruefe(anmelden && /catch/.test(anmelden[0]),
         'lehnt der Browser ab, bricht nichts');

  /* Der Service Worker */
  if (typeof SW_QUELLE === 'string' && SW_QUELLE.length) {
    pruefe(/periodicsync/.test(SW_QUELLE),
           'der Service Worker horcht auf den Hintergrundtermin');
    pruefe(/function badgeNachziehen/.test(SW_QUELLE),
           'er kann die Zahl nachziehen');
    pruefe(/caches\.open\(VORAUS_SCHLUESSEL\)/.test(SW_QUELLE),
           'er liest die Vorausschau aus dem Vorrat');
    pruefe(!/localStorage/.test(SW_CODE),
           'er greift nicht auf localStorage zu — das gäbe es dort nicht');
    pruefe(/n === VORRAT \|\| n === VORAUS_SCHLUESSEL/.test(SW_QUELLE),
           'beim Aufräumen bleibt der Vorrat der Vorausschau verschont');
    pruefe(/addEventListener\('activate'[\s\S]{0,120}badgeNachziehen/.test(SW_QUELLE),
           'auch beim Aktivieren wird nachgezogen');
  } else {
    warn('sw.js nicht gelesen');
  }

  if (!v) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = v.pruefeVoraus();
    pruefe(e.tage === 21, 'die Vorausschau umfasst einundzwanzig Tage');
    pruefe(e.heute === 1, 'für heute wird richtig gezählt');
    pruefe(e.morgen === 1, 'für morgen ebenso');
    pruefe(e.leererTag === 0, 'ein Tag ohne Offenes steht auf null');
    pruefe(e.weitDrausen === undefined, 'weit Entferntes steht nicht darin');
    pruefe(e.tagUnveraendert === true,
           'das Rechnen verstellt den angezeigten Tag nicht');
    pruefe(e.filterUnveraendert === 'beruflich',
           'und auch den Filter nicht');
  }
}

/* ============================================================
   71. Eine Sache steht einmal im Tag
   Grund: Eine Aufgabe, die einen Ablaufschritt traegt und selbst auf
   heute geplant ist, stand zweimal im Tagesplan — einmal als Aufgabe,
   einmal als Schritt. Es ist dieselbe Sache.
   ============================================================ */
console.log('\n71. Keine Dublette im Tag');
{
  const skript = hauptSkript();
  const d = globalThis.__dublettenApi;

  ['aufgabeStehtImTag', 'ablaufVermerk'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  const schritte = skript.match(/function ablaufSchritteHeute\([\s\S]*?\n\}/);
  pruefe(schritte && /aufgabeStehtImTag\(schrittAufgabe\(s\.satz\), tag\)/.test(schritte[0]),
         'ein Schritt entfällt, wenn seine Aufgabe schon im Tag steht');

  const steht = skript.match(/function aufgabeStehtImTag\([\s\S]*?\n\}/);
  pruefe(steht && /a\.planung === tag/.test(steht[0]),
         'entschieden wird an der Tagesplanung der Aufgabe');
  pruefe(steht && /faelligAn\(a\.wiederholung, tag\)/.test(steht[0]),
         'bei einer wiederkehrenden entscheidet ihre Regel');
  pruefe(steht && /status === 'erledigt'/.test(steht[0]),
         'eine erledigte steht nicht mehr im Tag — dann darf der Schritt wieder');

  const zeile = skript.match(/function zeileHtml\([\s\S]*?\n\}/);
  pruefe(zeile && /ablaufVermerk\(a\)/.test(zeile[0]),
         'die Aufgabe nennt dafür ihren Ablauf');

  if (!d) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = d.pruefeDubletten();
    pruefe(e.geplantEinmal === 1,
           'eine auf heute geplante Aufgabe mit Schritt steht genau einmal da');
    pruefe(e.ungeplantUeberAblauf === 1,
           'eine ungeplante erscheint über ihren Ablaufschritt');
    pruefe(e.reinerSchritt === 1, 'ein Schritt ohne Aufgabe steht wie bisher da');
    pruefe(e.vermerk === 'SMAX Teil 1', 'die Aufgabenzeile nennt den Ablauf');
    pruefe(e.zweiAblaeufe === '2 Abläufe',
           'trägt sie Schritte in mehreren, wird gezählt statt aufgezählt');
    pruefe(e.zahlAmSymbol === 3,
           'die Zahl am Symbol zählt sie ebenfalls nur einmal');
  }
}

/* ============================================================
   72. Einfaelle
   Grund: Was man irgendwann einmal tun moechte, darf nicht mahnen.
   Alles andere im System draengt — Tag, Woche, Fristen, die Zahl am
   Symbol. Ein Einfall muss davon unberuehrt bleiben, sonst wird er
   zum Vorwurf und man schreibt keine mehr auf.
   ============================================================ */
console.log('\n72. Einfälle');
{
  const skript = hauptSkript();
  const e = globalThis.__einfallApi;

  ['einfallFinden', 'einfaelleSichtbar', 'einfallNeu', 'einfallStand',
   'einfallFeld', 'einfallWirdVorhaben', 'einfallLoeschen', 'einfaelleZeichnen',
   'einfallOeffnen', 'einfallDetailHtml', 'setVhStufe'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  /* Sie mahnen nicht */
  const tag = skript.match(/function tagesEintraege\([\s\S]*?\n\}\n/);
  pruefe(tag && !/einfaelle/.test(tag[0]),
         'im Tagesplan kommen Einfälle nicht vor');
  const badge = skript.match(/function offeneHeute\([\s\S]*?\n\}/);
  pruefe(badge && !/einfaelle/.test(badge[0]),
         'die Zahl am Symbol zählt sie nicht');
  const woche = skript.match(/function wochenAufgaben\([\s\S]*?\n\}/);
  pruefe(woche && !/einfaelle/.test(woche[0]),
         'die Wochenliste ebenfalls nicht');

  /* Kein Datum, keine Planung */
  const neu = skript.match(/function einfallNeu\([\s\S]*?\n\}/);
  pruefe(neu && !/frist|planung|uhrzeit/.test(neu[0]),
         'ein Einfall bekommt weder Frist noch Planung noch Uhrzeit');

  /* Der Weg hinaus */
  const wird = skript.match(/function einfallWirdVorhaben\([\s\S]*?\n\}\n/);
  pruefe(wird && /e\.stand = 'verfolgt'/.test(wird[0]),
         'wird etwas daraus, gilt er als verfolgt');
  pruefe(wird && /e\.wurdeId = id/.test(wird[0]),
         'er merkt sich, was aus ihm wurde');
  pruefe(wird && !/splice/.test(wird[0]),
         'er verschwindet dabei nicht — die Geschichte bleibt');

  /* Abgleich */
  pruefe(/'ferien','einfaelle'/.test(skript) || /'einfaelle'/.test(skript),
         'die Sammlung wird mit abgeglichen');
  const loeschen = skript.match(/function einfallLoeschen\([\s\S]*?\n\}/);
  pruefe(loeschen && /grabsteinSetzen\('einfaelle'/.test(loeschen[0]),
         'Löschen hinterlässt einen Grabstein');
  pruefe(loeschen && /zurueckHolen/.test(loeschen[0]),
         'und lässt sich rückgängig machen');

  /* Der Reiter */
  const stufe = skript.match(/function setVhStufe\([\s\S]*?\n\}\n/);
  pruefe(stufe && /einfaelleGesehen = isoDatum\(\)/.test(stufe[0]),
         'beim Öffnen wird vermerkt, wann zuletzt hingesehen wurde');
  pruefe(stufe && /plus\.style\.display/.test(stufe[0]),
         'der Plusknopf für Vorhaben verschwindet im Einfallreiter');

  if (!e) {
    warn('Funktionen nicht auswertbar');
  } else {
    const r = e.pruefeEinfaelle();
    pruefe(r.gemerkt === 3, 'drei Einfälle gemerkt');
    pruefe(r.kontextGedeutet === 'privat', 'das p wird als privat gelesen');
    pruefe(r.titelSauber === 'Toskana mit dem Rad', 'und aus dem Titel entfernt');
    pruefe(r.ohneDatumsfelder === true,
           'kein Feld für Frist, Planung oder Uhrzeit');
    pruefe(r.nachProjekt === 1, 'aus einem Einfall wird ein Projekt');
    pruefe(r.standVerfolgt === 'verfolgt', 'er gilt dann als verfolgt');
    pruefe(r.bleibtErhalten === 3, 'alle drei stehen weiterhin da');
    pruefe(r.offen === 1 && r.verfolgt === 1 && r.verworfen === 1,
           'offen, verfolgt und verworfen werden getrennt geführt');
    pruefe(r.imTagesplan === 0, 'im Tagesplan steht nichts davon');
    pruefe(r.amSymbol === 0, 'die Zahl am Symbol bleibt unberührt');
  }
}

/* ============================================================
   73. Der Ablauf als Klammer im Tag
   Grund: Standen die Aufgaben eines Durchlaufs einzeln im Tag, sah man
   nicht mehr, dass sie zusammengehoeren und dass der Ablauf faellig
   ist. Die Klammer fehlte — und sie ist gerade das Wesentliche.
   ============================================================ */
console.log('\n73. Ablauf als Klammer');
{
  const skript = hauptSkript();
  const k = globalThis.__klammerApi;

  ['durchlaufImTag', 'durchlaeufeHeute', 'schritteOffen', 'ablaufKlammerHtml',
   'tagAblaufUm'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  const imTag = skript.match(/function durchlaufImTag\([\s\S]*?\n\}/);
  pruefe(imTag && /d\.terminTag === tag/.test(imTag[0]),
         'ein Durchlauf mit Termin heute steht im Tag');
  pruefe(imTag && /d\.frist <= tag/.test(imTag[0]),
         'einer mit erreichter oder verstrichener Frist ebenso');
  pruefe(imTag && /!schrittRuht/.test(imTag[0]),
         'und einer mit fälligem Schritt');
  pruefe(imTag && /!offenerSchritt\(d\)/.test(imTag[0]),
         'ein durchgelaufener nicht mehr');

  const offen = skript.match(/function schritteOffen\([\s\S]*?\n\}/);
  pruefe(offen && /anderswo: aufgabeStehtImTag/.test(offen[0]),
         'ein Schritt, dessen Aufgabe oben steht, wird gekennzeichnet');
  pruefe(offen && !/if \(aufgabeStehtImTag[\s\S]{0,40}continue/.test(offen[0]),
         'aber nicht weggelassen — sonst fehlte der Zusammenhang');

  const klammer2 = skript.match(/function ablaufKlammerHtml\([\s\S]*?\n\}\n/);
  pruefe(klammer2 && /steht oben/.test(klammer2[0]),
         'der Vermerk sagt, dass es dieselbe Sache ist');
  pruefe(klammer2 && /Frist heute/.test(klammer2[0]), 'die Frist wird benannt');
  pruefe(klammer2 && /Frist war/.test(klammer2[0]),
         'eine verstrichene Frist wird als solche gezeigt');
  pruefe(klammer2 && /tablauf-meta' \+\s*\n?\s*\(\(d\.frist && d\.frist < tag\) \? ' warn'/
         .test(klammer2[0]) || (klammer2 && /' warn'/.test(klammer2[0])),
         'und hervorgehoben');
  pruefe(klammer2 && /fertig \+ '\/' \+ alle/.test(klammer2[0]),
         'der Kopf nennt den Stand');

  if (!k) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = k.pruefeKlammer();
    pruefe(e.imTag === 'Haustür erneuern',
           'der fällige Durchlauf steht im Tag');
    pruefe(e.ruhenderDraussen === true, 'ein ruhender bleibt draußen');
    pruefe(e.eingeklapptOhneSchritte === 0,
           'eingeklappt stehen keine Schritte da');
    pruefe(e.aufgeklappt === 3, 'aufgeklappt alle drei offenen');
    pruefe(e.mitAufgabeDrin === true,
           'auch der Schritt, dessen Aufgabe oben im Tag steht');
    pruefe(e.vermerk === 'steht oben', 'er trägt den Vermerk');
    pruefe(e.stand === '0/3', 'der Kopf zeigt den Stand');
    pruefe(e.fristText === 'Frist heute', 'und die Frist');
  }
}

/* ============================================================
   74. Die Vorhabenseite
   Grund: Das Detailblatt ist ein Formular zum Aendern einzelner
   Felder. Zum Nachschlagen braucht es eine Seite: Meilensteine,
   Festlegungen, Aufgaben, Ablaeufe, Anlagen an einer Stelle. Und es
   fehlte eine Ablage fuer das, was man nachschlaegt statt abhakt.
   ============================================================ */
console.log('\n74. Vorhabenseite');
{
  const skript = hauptSkript();
  const s = globalThis.__seiteApi;

  ['seiteOeffnen', 'seiteZeichnen', 'seiteAbschnitt', 'seiteAbschnittUm',
   'festlegungen', 'festlegungNeu', 'festlegungSetzen', 'festlegungWeg',
   'festlegungenHtml', 'seiteAufgabeHaken', 'seiteBearbeiten', 'seiteZurueck',
   'alleAufgabenZuProjekt'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  pruefe(/id="schirmSeite"/.test(QUELLE), 'es gibt einen eigenen Bildschirm');
  pruefe(!/id="navSeite"/.test(QUELLE),
         'aber keinen Knopf in der Leiste — die Seite gehört zu Vorhaben');
  pruefe(/seiteOeffnen\(/.test(QUELLE), 'sie ist von den Karten aus erreichbar');

  /* Festlegungen werden geändert, nicht ergänzt */
  const setzen = skript.match(/function festlegungSetzen\([\s\S]*?\n\}/);
  pruefe(setzen && /l\[i\]\[feld\] = wert/.test(setzen[0]),
         'eine Festlegung wird überschrieben');
  pruefe(setzen && !/push/.test(setzen[0]),
         'nicht ein zweites Mal hingeschrieben — sonst stehen drei Torbreiten da');
  pruefe(setzen && /l\[i\]\.seit = isoDatum\(\)/.test(setzen[0]),
         'jede Änderung setzt das Datum neu');
  pruefe(setzen && /l\[i\]\[feld\] === wert\) \{ return/.test(setzen[0]),
         'ohne echte Änderung bleibt das Datum stehen');

  /* Erledigtes gehört auf eine Nachschlageseite */
  const alle = skript.match(/function alleAufgabenZuProjekt\([\s\S]*?\n\}/);
  pruefe(alle && !/erledigt/.test(alle[0]),
         'die Seite zeigt auch Erledigtes');
  const zeichnen = skript.match(/function seiteZeichnen\([\s\S]*?\n\}\n/);
  pruefe(zeichnen && /alleAufgabenZuProjekt\(v\.id\)/.test(zeichnen[0]),
         'sie holt es sich entsprechend');

  /* Festlegungen hängen am Vorhaben, werden also mit abgeglichen */
  pruefe(/v\.festlegungen/.test(skript),
         'Festlegungen liegen im Vorhaben — sie brauchen keine eigene Sammlung');

  if (!s) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = s.pruefeSeite();
    pruefe(e.abschnitte.indexOf('Meilensteine') >= 0, 'Meilensteine stehen auf der Seite');
    pruefe(e.abschnitte.indexOf('Festlegungen') >= 0, 'Festlegungen ebenso');
    pruefe(e.abschnitte.indexOf('Aufgaben') >= 0, 'Aufgaben ebenso');
    pruefe(e.abschnitte.indexOf('Kleinigkeiten') >= 0, 'Kleinigkeiten ebenso');
    pruefe(e.abschnitte.indexOf('Abläufe') >= 0, 'Abläufe ebenso');
    pruefe(e.abschnitte.indexOf('Anlagen') >= 0, 'Anlagen ebenso');
    pruefe(e.erledigtSichtbar === true, 'Erledigtes steht in einem eigenen Abschnitt');
    pruefe(e.msStand === '1 von 2', 'die Meilensteine nennen ihren Stand');
    pruefe(e.zustand === 'Bodenplatte ist gegossen',
           'der Zielzustand der Woche steht oben');
    pruefe(e.festGesetzt === 2, 'zwei Festlegungen angelegt');
    pruefe(e.festGeaendert === '4,00 m', 'eine Änderung überschreibt');
    pruefe(e.festAnzahlBleibt === 2, 'ohne eine zweite anzulegen');
    pruefe(e.nachEinklappen === false, 'ein eingeklappter Abschnitt zeigt nichts');
    pruefe(e.hakenWirkt === 'erledigt', 'Abhaken wirkt von der Seite aus');
  }
}

/* ============================================================
   75. Anlagen am Ablauf
   Grund: Zu einem Ablauf gehoeren Unterlagen — die Checkliste, das
   Protokollmuster, der Verweis ins Laufwerk. Sie lagen bisher nur an
   Vorhaben, wo man sie im Durchlauf nicht zur Hand hat.
   ============================================================ */
console.log('\n75. Anlagen am Ablauf');
{
  const skript = hauptSkript();
  const a = globalThis.__abAnlageApi;

  ['abAnlagen', 'abAnlageFormular', 'abAnlageSpeichern', 'abAnlageWeg',
   'abAnlagenHtml'].forEach(function (f) {
    pruefe(new RegExp('function\\s+' + f + '\\s*\\(').test(skript),
           'Funktion ' + f + ' ist definiert');
  });

  const detail = skript.match(/function abDetailHtml\([\s\S]*?\n\}\n/);
  pruefe(detail && /abAnlagenHtml\(a\)/.test(detail[0]),
         'Vorlage wie Durchlauf zeigen ihre Anlagen');

  /* Vererbung */
  const starten = skript.match(/function durchlaufStarten\([\s\S]*?\n\}/);
  pruefe(starten && /anlagen: abAnlagen\(v\)\.slice\(\)/.test(starten[0]),
         'ein Durchlauf erbt die Anlagen seiner Vorlage');
  pruefe(starten && /\.slice\(\)/.test(starten[0]),
         'als eigene Liste — sonst änderte ein Durchlauf die Vorlage mit');
  const termin = skript.match(/function terminDurchlaufStarten\([\s\S]*?\n\}/);
  pruefe(termin && /anlagen: abAnlagen\(v\)\.slice\(\)/.test(termin[0]),
         'auch ein Durchlauf an einem Termin');
  const zurueck = skript.match(/function vorlageAusDurchlauf\([\s\S]*?\n\}/);
  pruefe(zurueck && /anlagen: abAnlagen\(d\)\.slice\(\)/.test(zurueck[0]),
         'und beim Sichern als Vorlage geht es zurück');

  /* Im Abhakblatt sichtbar, aber nicht änderbar */
  const abhak = skript.match(/function abhakHtml\([\s\S]*?\n\}\n/);
  pruefe(abhak && /abAnlagen\(d\)/.test(abhak[0]),
         'beim Abhaken stehen die Anlagen zur Hand');
  pruefe(abhak && !/abAnlageWeg/.test(abhak[0]),
         'dort aber ohne Möglichkeit, sie zu entfernen');

  /* Abgleich */
  pruefe(/anlagen: \[\]/.test(skript),
         'neue Vorlagen und Durchläufe beginnen mit einer leeren Liste');

  if (!a) {
    warn('Funktionen nicht auswertbar');
  } else {
    const e = a.pruefeAnlagen();
    pruefe(e.anVorlage === 1, 'eine Anlage an der Vorlage');
    pruefe(e.imDurchlauf === 1, 'der gestartete Durchlauf hat sie');
    pruefe(e.name === 'Checkliste', 'mit Namen');
    pruefe(e.eigeneListe === true,
           'eine Änderung am Durchlauf berührt die Vorlage nicht');
    pruefe(e.nachEntfernen === 0, 'entfernen geht');
    pruefe(e.vorlageUnberuehrt === 1, 'die Vorlage behält ihre');
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
