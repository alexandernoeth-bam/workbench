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
  const feste = new Set([...skript.matchAll(/getElementById\('([A-Za-z][\w-]*)'\)/g)].map(m => m[1]));
  feste.forEach(function (id) {
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
   ERGEBNIS
   ============================================================ */
console.log('\n============================================================');
console.log('ERGEBNIS   ok: ' + anzOk + '   FAIL: ' + anzFail + '   warn: ' + anzWarn);
console.log('Datei: ' + DATEI);
console.log('============================================================\n');

process.exit(anzFail > 0 ? 1 : 0);
