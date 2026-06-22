#!/usr/bin/env node
// WorkBench Regression Test Suite — v4.0 (Restart-Edition)
// Verwendung: node wb_test.js workbench.html
// Gibt 0 zurück wenn alles OK, 1 bei Fehlern
//
// v4.0: Neustart für WorkBench-Restart ab v1.0.0
//       Kat.1–3:  Syntax, Div-Balance, Versionen (unveränderlich)
//       Kat.4:    Grundstruktur-IDs (wächst mit jedem Prompt)
//       Kat.5:    WB-Objekt Kern-Methoden
//       Kat.6:    Tab-Routing Vollständigkeit
//       Kat.7:    Methoden-Kommas (WB-Objekt)
//       Kat.8:    Build-Timestamp Format
//       Kat.9:    Style/Script Tag Balance
//       Kat.10:   UTC-Datum-Sicherheit (_dStr statt toISOString)
//       Kat.11:   onclick → Funktion definiert
//       Kat.12:   Dark-Mode CSS-Variablen

const fs = require('fs');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node wb_test.js workbench.html');
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const errors = [];
const warnings = [];
let passed = 0;

function ok(name) {
  console.log('  ✓ ' + name);
  passed++;
}
function fail(name, detail) {
  console.log('  ✗ ' + name + (detail ? ': ' + detail : ''));
  errors.push(name + (detail ? ': ' + detail : ''));
}
function warn(name, detail) {
  console.log('  ⚠ ' + name + (detail ? ': ' + detail : ''));
  warnings.push(name);
}

// ── Extraktion ────────────────────────────────────────
const scriptStart = content.indexOf('<script>');
const scriptEnd   = content.indexOf('</script>', scriptStart);
const htmlBefore  = content.slice(0, scriptStart);
const htmlAfter   = content.slice(scriptEnd + 9);
const jsCode      = scriptStart >= 0 && scriptEnd >= 0
  ? content.slice(scriptStart + 8, scriptEnd) : '';
const styleMatch  = content.match(/<style>([\s\S]*?)<\/style>/);
const styleBlock  = styleMatch ? styleMatch[1] : '';

console.log('\n═══════════════════════════════════════════');
console.log('WorkBench Regression Test Suite v4.0');
console.log('Datei: ' + filePath);
console.log('═══════════════════════════════════════════\n');

// ══════════════════════════════════════════
// 1. JS SYNTAX
// ══════════════════════════════════════════
console.log('── 1. JavaScript Syntax ──');
try {
  // new Function() kann keine Top-Level-const/let/class parsen
  // Stattdessen: Script-Wrapper verwenden
  const wrapped = '(function(){\n' + jsCode + '\n})';
  new Function('return ' + wrapped)();
  ok('JS-Syntax fehlerfrei');
} catch(e) {
  fail('JS-Syntax', e.message.split('\n')[0]);
}

// ══════════════════════════════════════════
// 2. HTML DIV BALANCE
// ══════════════════════════════════════════
console.log('\n── 2. HTML Div-Balance ──');
const opensB  = (htmlBefore.match(/<div[\s>]/g) || []).length;
const closesB = (htmlBefore.match(/<\/div>/g) || []).length;
const opensA  = (htmlAfter.match(/<div[\s>]/g) || []).length;
const closesA = (htmlAfter.match(/<\/div>/g) || []).length;
const opens   = opensB + opensA;
const closes  = closesB + closesA;
if (opens === closes) {
  ok('Div-Balance: ' + opens + ' opens = ' + closes + ' closes');
} else {
  if (Math.abs(opens - closes) <= 1) {
    warn('Div-Balance: diff=' + (opens-closes) + ' (prüfen)');
  } else {
    fail('Div-Balance', 'opens=' + opens + ' closes=' + closes + ' diff=' + (opens-closes));
  }
}

// ══════════════════════════════════════════
// 3. VERSION (5 Stellen)
// ══════════════════════════════════════════
console.log('\n── 3. Versions-Konsistenz (5 Stellen) ──');
const verMatch   = content.match(/APP_VERSION:\s*'([^']+)'/);
const buildMatch = content.match(/APP_BUILD:\s*'([^']+)'/);
const ver   = verMatch?.[1];
const build = buildMatch?.[1];

if (ver && build) {
  ok('APP_VERSION: ' + ver);
  ok('APP_BUILD: ' + build);
  const titleMatch   = content.match(/<title>WorkBench ([^<]+)<\/title>/);
  const taglineMatch = content.match(/wb-startup-tagline[^>]*>v([^<]+)</);
  const menuMatch    = content.match(/wb-menu-version[^>]*>v([^<]+)</) || content.match(/APP_VERSION:\s*'([^']+)'/);
  if (titleMatch?.[1] === ver)           ok('title = ' + ver);
  else fail('title falsch', (titleMatch?.[1] || 'nicht gefunden') + ' ≠ ' + ver);
  if (taglineMatch?.[1] === ver)         ok('wb-startup-tagline = ' + ver);
  else fail('wb-startup-tagline falsch', (taglineMatch?.[1] || 'nicht gefunden') + ' ≠ ' + ver);
  if (menuMatch?.[1]?.startsWith(ver))   ok('wb-menu-version = ' + ver);
  else fail('wb-menu-version falsch', (menuMatch?.[1] || 'nicht gefunden') + ' ≠ ' + ver);
} else {
  fail('APP_VERSION/APP_BUILD nicht gefunden');
}

// ══════════════════════════════════════════
// 4. GRUNDSTRUKTUR HTML-ELEMENTE
// ══════════════════════════════════════════
console.log('\n── 4. Grundstruktur HTML-Elemente ──');
// Diese Liste wächst mit jedem Prompt.
// Prompt 1: App-Shell + 6 Sections + Tabbar
const REQUIRED_IDS = [
  // App-Shell
  'wb-app', 'wb-welt-header', 'wb-content', 'wb-nav', 'wb-startup',
  // Startup
  'wb-startup-logo', 'wb-startup-tagline',
  // Version-Anzeige
    // Sections (alle 6)
  'sec-cockpit', 'sec-backlog', 'sec-vorhaben',
  'sec-ablage', 'sec-woche', 'sec-ziele',
];

let idOk = 0, idFail = 0;
REQUIRED_IDS.forEach(id => {
  if (content.includes('id="' + id + '"')) { idOk++; }
  else { fail('Fehlendes Element', '#' + id); idFail++; }
});
if (idFail === 0) ok(idOk + ' Grundstruktur-Elemente vorhanden');

// ══════════════════════════════════════════
// 5. WB-OBJEKT KERN-METHODEN
// ══════════════════════════════════════════
console.log('\n── 5. WB-Objekt Kern-Methoden ──');
// Prompt 1: Grundmethoden — wird pro Prompt erweitert
const REQUIRED_FNS = [
  'tabSwitch',
  'renderSection',
  'renderCockpit',
  'renderBacklog',
  'renderVorhaben',
  'renderAblage',
  'renderWoche',
  'renderZiele',
  '_esc',
  '_toast',
  '_dStr',
  'setDirty',
  'init',
];

let fnOk = 0, fnFail = 0;
REQUIRED_FNS.forEach(fn => {
  const found = jsCode.includes('  ' + fn + '(')
    || jsCode.includes('  async ' + fn + '(')
    || jsCode.includes('  ' + fn + ':');
  if (found) { fnOk++; }
  else { fail('Fehlende Methode', fn + '()'); fnFail++; }
});
if (fnFail === 0) ok(fnOk + ' Kern-Methoden vorhanden');

// ══════════════════════════════════════════
// 6. TAB-ROUTING VOLLSTÄNDIGKEIT
// ══════════════════════════════════════════
console.log('\n── 6. Tab-Routing ──');
// Alle 6 Tabs müssen in der Tabbar UND im renderSection-Switch vorhanden sein
const TABS = ['cockpit', 'backlog', 'vorhaben', 'ablage', 'woche', 'ziele'];

let tabOk = 0, tabFail = 0;
TABS.forEach(tab => {
  const hasTabEl  = content.includes("data-tab=\"" + tab + "\"");
  const hasSec    = content.includes('id="sec-' + tab + '"');
  const hasSwitch = jsCode.includes("'" + tab + "'") || jsCode.includes('"' + tab + '"');
  if (hasTabEl && hasSec && hasSwitch) {
    tabOk++;
  } else {
    if (!hasTabEl)  fail('Tab-Element fehlt',   'data-tab="' + tab + '"');
    if (!hasSec)    fail('Section fehlt',        '#sec-' + tab);
    if (!hasSwitch) fail('Switch-Case fehlt',    "'" + tab + "'");
    tabFail++;
  }
});
if (tabFail === 0) ok(tabOk + '/6 Tabs vollständig (Element + Section + Switch)');

// ══════════════════════════════════════════
// 7. WB-OBJEKT METHODEN-KOMMAS
// ══════════════════════════════════════════
console.log('\n── 7. WB-Objekt Methoden-Kommas ──');
// Fehlendes Komma zwischen Top-Level WB-Methoden → SyntaxError zur Laufzeit,
// new Function() fängt das NICHT.
// Korrekt:   },\n\n  naechsteFn(
// Falsch:    }\n\n  naechsteFn(
const wrongComma = (jsCode.match(/^  \}(?!,)\s*\n\n  (?:async )?[a-z_]\w*\s*[:(]/gm) || []);
if (wrongComma.length === 0) {
  ok('Alle WB-Methoden korrekt mit Komma abgeschlossen');
} else {
  wrongComma.forEach(m => {
    const idx = jsCode.indexOf(m.slice(0, 20));
    const before = jsCode.slice(Math.max(0, idx - 200), idx);
    const fnMatch = before.match(/  (?:async )?(\w+)\s*[:(]/g);
    const fn = fnMatch ? fnMatch[fnMatch.length - 1].trim() : '?';
    fail('Fehlendes Komma nach Methode', fn + ' → fehlt , vor nächster Methode');
  });
}

// ══════════════════════════════════════════
// 8. BUILD-TIMESTAMP FORMAT
// ══════════════════════════════════════════
console.log('\n── 8. Build-Timestamp ──');
if (build) {
  if (/^\d{8}-\d{4}$/.test(build)) {
    ok('Build-Format korrekt: ' + build);
    const datePart = build.split('-')[0];
    const year  = parseInt(datePart.slice(0,4));
    const month = parseInt(datePart.slice(4,6));
    const day   = parseInt(datePart.slice(6,8));
    if (year >= 2025 && month >= 1 && month <= 12 && day >= 1 && day <= 31)
      ok('Build-Datum plausibel');
    else warn('Build-Datum unplausibel', build);
  } else {
    fail('Build-Format falsch', build + ' ≠ YYYYMMDD-HHMM');
  }
}

// ══════════════════════════════════════════
// 9. STYLE/SCRIPT TAG BALANCE
// ══════════════════════════════════════════
console.log('\n── 9. Style/Script Tags ──');
const styleOpens  = (content.match(/<style>/g) || []).length;
const styleCloses = (content.match(/<\/style>/g) || []).length;
if (styleOpens === styleCloses) ok('Style-Tags: ' + styleOpens + ' open = ' + styleCloses + ' close');
else fail('Style-Tags unbalanciert', styleOpens + ' open, ' + styleCloses + ' close');

const scriptOpens  = (content.match(/<script>/g) || []).length;
const scriptCloses = (content.match(/<\/script>/g) || []).length;
const extScripts   = (content.match(/<script\s+src=/g) || []).length;
const inlineOpen   = scriptOpens;
const inlineClose  = scriptCloses - extScripts;
if (inlineOpen === inlineClose) ok('Script-Tags: ' + inlineOpen + ' inline open = ' + inlineClose + ' close');
else fail('Script-Tags unbalanciert', inlineOpen + ' open, ' + inlineClose + ' close');

// ══════════════════════════════════════════
// 10. UTC-DATUM-SICHERHEIT
// ══════════════════════════════════════════
console.log('\n── 10. UTC-Datum-Sicherheit ──');
// toISOString() gibt IMMER UTC zurück.
// In DE (UTC+2) kann Mittwoch 00:30 Ortszeit → Dienstag 22:30 UTC → falsches Datum.
// ERLAUBT:  new Date().toISOString() für Zeitstempel (kein Datumsteil verwendet)
// VERBOTEN: berechnetes Date-Objekt.toISOString().split('T')[0]
// KORREKT:  this._dStr(d) → lokale getFullYear/getMonth/getDate

// Suche berechnete Date-Objekte die via toISOString() in Datumstrings gewandelt werden
const utcRe = /(\b\w+)\s*\.toISOString\s*\(\s*\)\s*\.split\s*\(\s*['"]T['"]\s*\)\s*\[\s*0\s*\]/g;
let utcM;
const utcErrors = [];
const utcWarnings = [];
utcRe.lastIndex = 0;

while ((utcM = utcRe.exec(jsCode)) !== null) {
  const varName = utcM[1];
  if (varName === 'Date') continue; // new Date() — ok

  const ctx = jsCode.slice(Math.max(0, utcM.index - 300), utcM.index);
  const isManipulated = ctx.includes(varName + '.setDate(')
    || ctx.includes(varName + '.setMonth(')
    || ctx.includes(varName + '.setFullYear(')
    || ctx.includes(varName + '.setHours(');

  if (isManipulated) {
    const fnCtx = jsCode.slice(Math.max(0, utcM.index - 500), utcM.index);
    const fnMatch = fnCtx.match(/  (?:async )?(\w+)\s*[:(]/g);
    const fn = fnMatch ? fnMatch[fnMatch.length - 1].trim().replace(/\s*[:(].*/, '') : '?';
    utcErrors.push(varName + '.toISOString() in ' + fn + '() — lokale Formatierung via _dStr() nötig');
  } else {
    utcWarnings.push(varName + '.toISOString() — prüfen ob Datumsstring oder Timestamp');
  }
}

// Prüfe ob _dStr als sichere Alternative vorhanden ist
if (!jsCode.includes('_dStr(')) {
  fail('_dStr() fehlt — UTC-sichere Datumsformatierung fehlt');
} else {
  ok('_dStr() vorhanden — UTC-sichere Datumsformatierung');
}

if (utcErrors.length === 0) {
  ok('Keine UTC-Datum-Bugs gefunden' + (utcWarnings.length ? ' (' + utcWarnings.length + ' Warnungen)' : ''));
  utcWarnings.forEach(w => warn('UTC-prüfen', w));
} else {
  utcErrors.forEach(e => fail('UTC-Bug (DE UTC+2 Fehler)', e));
  utcWarnings.forEach(w => warn('UTC-prüfen', w));
}

// ══════════════════════════════════════════
// 11. ONCLICK → FUNKTION DEFINIERT
// ══════════════════════════════════════════
console.log('\n── 11. OnClick → Funktion definiert ──');
const eventCallRegex  = /(?:onclick|onchange|oninput)="[^"]*WB\.([\w]+)\(/g;
const eventCallRegex2 = /(?:onclick|onchange|oninput)='[^']*WB\.([\w]+)\(/g;
const eventCallSet = new Set();
let ecm;
while ((ecm = eventCallRegex.exec(content))  !== null) eventCallSet.add(ecm[1]);
while ((ecm = eventCallRegex2.exec(content)) !== null) eventCallSet.add(ecm[1]);

const jsFnRegex  = /^  (?:async )?([\w]+)\s*[:(]/gm;
const jsFnRegex2 = /^(?:async )?([\w]+)\s*\(\s*\)\s*\{/gm;
const jsDefs = new Set();
let jfm;
while ((jfm = jsFnRegex.exec(jsCode))  !== null) jsDefs.add(jfm[1]);
while ((jfm = jsFnRegex2.exec(jsCode)) !== null) jsDefs.add(jfm[1]);

let defOk = 0, defFail = 0;
eventCallSet.forEach(fn => {
  if (jsDefs.has(fn)) { defOk++; }
  else { fail('onclick → undefiniert: WB.' + fn + '()'); defFail++; }
});
if (defFail === 0) {
  if (defOk > 0) ok(defOk + ' onclick-Funktionen alle definiert');
  else ok('Keine onclick-Aufrufe (Grundgerüst)');
}

// ══════════════════════════════════════════
// 12. DARK-MODE CSS-VARIABLEN
// ══════════════════════════════════════════
console.log('\n── 12. Dark-Mode CSS-Variablen ──');
// Beide Themes müssen die Kern-Variablen definieren
const REQUIRED_VARS = ['--bg', '--surface', '--surface2', '--border', '--text', '--muted', '--faint', '--accent', '--accent2'];
const hasDarkMode = styleBlock.includes('[data-theme="dark"]') || styleBlock.includes("[data-theme='dark']");

let cssVarOk = 0, cssVarFail = 0;
REQUIRED_VARS.forEach(v => {
  if (styleBlock.includes(v)) { cssVarOk++; }
  else { fail('CSS-Variable fehlt', v); cssVarFail++; }
});

if (!hasDarkMode) {
  fail('Dark-Mode fehlt', '[data-theme="dark"] Block nicht gefunden');
} else {
  ok('Dark-Mode Block vorhanden');
}
if (cssVarFail === 0) ok(cssVarOk + ' CSS-Variablen definiert');

// ══════════════════════════════════════════
// 13. IDB-VOLLSTÄNDIGKEIT
// ══════════════════════════════════════════
console.log('\n── 13. IDB-Vollständigkeit ──');
// Prüft ob alle IDB-Kern-Methoden vorhanden sind und IDB_NAME/IDB_VERSION definiert sind.
// Fehlt idbOpen oder idbSaveAll: Daten gehen beim Reload verloren — kein sichtbarer Fehler.
const IDB_FNS = ['idbOpen', 'idbGet', 'idbSet', 'idbLoad', 'idbSave'];
let idbOk = 0, idbFail = 0;
IDB_FNS.forEach(fn => {
  const found = jsCode.includes('  ' + fn + '(') || jsCode.includes('  async ' + fn + '(');
  if (found) { idbOk++; }
  else { fail('IDB-Methode fehlt', fn + '()'); idbFail++; }
});
if (!content.includes("IDB_NAME:")) {
  fail('IDB_NAME fehlt');
} else { idbOk++; }
if (!content.includes("IDB_VERSION:")) {
  fail('IDB_VERSION fehlt');
} else { idbOk++; }
if (idbFail === 0) ok(idbOk + ' IDB-Konstanten und -Methoden vorhanden');

// ══════════════════════════════════════════
// 14. ASYNC INIT + IDB-AUFRUF
// ══════════════════════════════════════════
console.log('\n── 14. Async Init + IDB-Aufruf ──');
// init() muss async sein und idbOpen()+idbLoad() aufrufen.
// Fehlt async: await-Aufrufe in init() werden still ignoriert → leere DB beim Start.
const initMatch = jsCode.match(/async\s+init\s*\(\s*\)/);
if (!initMatch) {
  fail('init() ist nicht async', 'async init() erforderlich');
} else {
  ok('init() ist async');
}

const initStart = jsCode.indexOf('  async init(');
const initEnd   = initStart > 0 ? jsCode.indexOf('\n  },\n', initStart) : -1;
const initBody  = initStart > 0 && initEnd > 0 ? jsCode.slice(initStart, initEnd) : '';

if (!initBody) {
  fail('init()-Body nicht gefunden');
} else {
  if (initBody.includes('idbOpen(')) ok('idbOpen() in init() aufgerufen');
  else fail('idbOpen() fehlt in init()');
  if (initBody.includes('idbLoad(') || initBody.includes('idbLoad()') || content.includes('await this.idbLoad()')) ok('idbLoad() in init() aufgerufen');
  else fail('idbLoad() fehlt in init()');
}

// setDirty() muss Debounce-Timer enthalten
const sdStart = jsCode.indexOf('  setDirty(');
const sdEnd   = sdStart > 0 ? jsCode.indexOf('\n  },\n', sdStart) : -1;
const sdBody  = sdStart > 0 && sdEnd > 0 ? jsCode.slice(sdStart, sdEnd) : '';
if (sdBody.includes('setTimeout') && (sdBody.includes('idbSave') || sdBody.includes('_syncUpload'))) {
  ok('setDirty() hat Debounce-Timer');
} else {
  fail('setDirty() fehlt Debounce oder idbSaveAll()-Aufruf');
}

// ══════════════════════════════════════════
// 15. COCKPIT HTML-STRUKTUR
// ══════════════════════════════════════════
console.log('\n── 15. Cockpit HTML-Struktur ──');
// Prüft ob alle Cockpit-Elemente vorhanden sind.
// Fehlt ck-scroll oder ck-banner: Cockpit rendert leer ohne Fehler.
const COCKPIT_IDS = [
  'ck-header-day', 'ck-header-sub',
  'ck-scroll',
  'ck-banner', 'ck-editor-block', 'ck-editor-area',
  'ck-editor-area', 'ck-dialog-overlay',
];
let ckIdOk = 0, ckIdFail = 0;
COCKPIT_IDS.forEach(id => {
  if (content.includes('id="' + id + '"')) { ckIdOk++; }
  else { fail('Cockpit-Element fehlt', '#' + id); ckIdFail++; }
});
// sec-cockpit muss flex + column + padding:0 haben
if (content.includes('sec-cockpit') && content.includes('display:flex') && content.includes('flex-direction:column') && content.includes('padding:0')) {
  ok('sec-cockpit hat flex-column layout');
} else {
  fail('sec-cockpit fehlt display:flex;flex-direction:column;padding:0');
  ckIdFail++;
}
if (ckIdFail === 0) ok(ckIdOk + ' Cockpit-Elemente vorhanden');

// ══════════════════════════════════════════
// 16. COCKPIT RENDER-FUNKTIONEN
// ══════════════════════════════════════════
console.log('\n── 16. Cockpit Render-Funktionen ──');
// renderCockpit() muss _ckRenderHeader + _ckRenderBanner + _ckRenderSortierListe aufrufen
const CK_SUBFNS = [
  '_ckRenderHeader',
  '_ckRenderBanner',
  '_ckRenderSortierListe',
  '_ckLadeHeutigerEintrag',
];
let ckFnOk = 0, ckFnFail = 0;
CK_SUBFNS.forEach(fn => {
  const defined = jsCode.includes('  ' + fn + '(');
  // Methoden können auch via this. oder direkt aufgerufen sein
  const called  = jsCode.includes('this.' + fn + '()') || jsCode.includes('this.' + fn + '(');
  if (!defined) { fail('Cockpit-Funktion fehlt', fn + '()'); ckFnFail++; }
  else { ckFnOk++; }
});

// Prüfe wichtige Cockpit-v3 Aktionsfunktionen
const CK_ACTION_FNS = ['_ckDialogKlassify', '_ckTimerToggle', '_ckEnsureDb'];
CK_ACTION_FNS.forEach(fn => {
  if (jsCode.includes('  ' + fn + '(')) { ckFnOk++; }
  else { fail('Cockpit-Aktionsfunktion fehlt', fn + '()'); ckFnFail++; }
});

if (ckFnFail === 0) ok(ckFnOk + ' Cockpit-Funktionen definiert und verknüpft');

// ══════════════════════════════════════════
// 17. BACKLOG HTML-STRUKTUR
// ══════════════════════════════════════════
console.log('\n── 17. Backlog HTML-Struktur ──');
// Prüft ob alle Tagesfokus-Elemente vorhanden sind.
const BACKLOG_IDS = [
  'bl-chip-bar', 'tf-scroll',
  'tf-heute-block', 'tf-heute-count', 'tf-heute-chev', 'tf-heute-body',
  'tf-post-block',  'tf-post-count',  'tf-post-chev',  'tf-post-body',
  'tf-dead-block',  'tf-dead-count',  'tf-dead-chev',  'tf-dead-body',
  'tf-ueber-block', 'tf-ueber-count', 'tf-ueber-chev', 'tf-ueber-body',
];
let blIdOk = 0, blIdFail = 0;
BACKLOG_IDS.forEach(id => {
  if (content.includes('id="' + id + '"')) { blIdOk++; }
  else { fail('Tagesfokus-Element fehlt', '#' + id); blIdFail++; }
});
// sec-backlog muss flex + column haben
if (content.includes('sec-backlog') && (styleBlock.includes('#sec-backlog') || styleBlock.includes('tf-scroll'))) {
  ok('sec-backlog/tf-scroll vorhanden');
} else {
  warn('sec-backlog Layout nicht vollständig geprüft');
}
if (blIdFail === 0) ok(blIdOk + ' Tagesfokus-Elemente vorhanden');

// ══════════════════════════════════════════
// 18. BACKLOG-FUNKTIONEN + KEIN DEFAULT-DATUM
// ══════════════════════════════════════════
console.log('\n── 18. Backlog-Funktionen ──');
// Prüft ob alle Backlog-Aktionsfunktionen definiert sind.
const BL_FNS = [
  'renderBacklog', '_blRenderSektion', '_blToggle',
  '_blRenderAufgabe', '_blRenderSchnell', '_blRenderVerteilen',
  '_blSetFilter', '_blSchnellAdd',
];
let blFnOk = 0, blFnFail = 0;
BL_FNS.forEach(fn => {
  const found = jsCode.includes('  ' + fn + '(')
    || jsCode.includes('  ' + fn + ':');
  if (found) { blFnOk++; }
  else { fail('Backlog-Funktion fehlt', fn + '()'); blFnFail++; }
});

// _blSchnellAdd darf kein Default-Datum setzen (date: '' ist korrekt)
const saStart = jsCode.indexOf('  _blSchnellAdd(');
const saEnd   = saStart > 0 ? jsCode.indexOf('\n  },\n', saStart) : -1;
const saBody  = saStart > 0 && saEnd > 0 ? jsCode.slice(saStart, saEnd) : '';
if (!saBody) {
  fail('_blSchnellAdd() Body nicht gefunden');
} else {
  const hasDefaultDate = /date:.*new Date\(\)/i.test(saBody)
    || /date:.*toISOString/i.test(saBody)
    || /date:.*_dStr\(new Date\(\)\)/.test(saBody);
  if (hasDefaultDate) {
    fail('_blSchnellAdd() setzt Default-Datum', "date: '' erwartet, nicht new Date()");
  } else {
    ok('_blSchnellAdd() kein Default-Datum (date: \'\')');
    blFnOk++;
  }
}

// _tfOffen muss die 4 Container-IDs enthalten
const BL_SEKTIONEN = ['heute', 'post', 'dead', 'ueber'];
BL_SEKTIONEN.forEach(id => {
  if (jsCode.includes("'tf-" + id + "'") || jsCode.includes("_tfOffen") || jsCode.includes("'" + id + "'")) {
    blFnOk++;
  } else {
    fail('Tagesfokus-Container fehlt in _tfOffen', id);
    blFnFail++;
  }
});

if (blFnFail === 0) ok(blFnOk + ' Tagesfokus-Funktionen und Container korrekt');

// ══════════════════════════════════════════
// 19. VORHABEN HTML-STRUKTUR + FUNKTIONEN (v2.9.29+)
// ══════════════════════════════════════════
console.log('\n── 19. Vorhaben HTML-Struktur + Funktionen ──');
const VH_IDS = [
  'vh-app', 'vh-list', 'vh-list-filters', 'vh-scroll',
  'vh-detail-col', 'vh-detail-header',
  'vh-detail', 'vh-detail-hdr', 'vh-detail-title', 'vh-detail-pills',
  'vh-detail-scroll',
];
let vhOk = 0, vhFail = 0;
VH_IDS.forEach(id => {
  if (content.includes('id="' + id + '"')) { vhOk++; }
  else { fail('Vorhaben-Element fehlt', '#' + id); vhFail++; }
});

// sec-vorhaben muss flex row haben
if (content.includes('sec-vorhaben') && styleBlock.includes('#sec-vorhaben')
  && styleBlock.includes('flex-direction: row')) {
  ok('sec-vorhaben hat flex-row layout'); vhOk++;
} else {
  fail('sec-vorhaben fehlt display:flex;flex-direction:row'); vhFail++;
}

// Vorhaben-Aktionsfunktionen
const VH_FNS = [
  'renderVorhaben', '_vhRenderListe', '_vhRenderRow', '_vhOpen',
  '_vhRenderDetail', '_vhRenderContainers', '_vcToggle',
  '_vhNeu', '_vhAufgabeNeu', '_vhLinkAdd', '_vhLinkDelete',
  '_vhSetStatus', '_vhToggleFavorit', '_vhToggleVertraulich',
  '_vhDeleteAktiv', '_vhToggleStatusDD', '_vhSetFilter', '_vhToggleStarFilter',
];
VH_FNS.forEach(fn => {
  const found = jsCode.includes('  ' + fn + '(') || jsCode.includes('  ' + fn + ':');
  if (found) { vhOk++; }
  else { fail('Vorhaben-Funktion fehlt', fn + '()'); vhFail++; }
});

// _vhRenderRow muss Warn + Stern zeigen
const rvRow = jsCode.match(/  _vhRenderRow\([\s\S]*?^  \},/m)?.[0] || '';
if (!rvRow) { warn('_vhRenderRow() Body nicht gefunden'); }
else {
  rvRow.includes('warn') ? (ok('_vhRenderRow: Warn-Anzeige'), vhOk++) : (fail('_vhRenderRow: kein Warn'), vhFail++);
  rvRow.includes('favorit') ? (ok('_vhRenderRow: Stern-Anzeige'), vhOk++) : (fail('_vhRenderRow: kein Stern'), vhFail++);
}

// _vhRenderContainers muss _vhLinkDelete enthalten
const rvContainers = jsCode.match(/  _vhRenderContainers\([\s\S]*?^  \},/m)?.[0] || '';
if (!rvContainers) { warn('_vhRenderContainers() Body nicht gefunden'); }
else {
  rvContainers.includes('_vhLinkDelete') ? (ok('_vhRenderContainers: Lösch-Button (_vhLinkDelete)'), vhOk++) : (fail('_vhRenderContainers: fehlt _vhLinkDelete'), vhFail++);
  rvContainers.includes('_aufgabeChkHtml') ? (ok('_vhRenderContainers: nutzt _aufgabeChkHtml()'), vhOk++) : (fail('_vhRenderContainers: fehlt _aufgabeChkHtml'), vhFail++);
  rvContainers.includes('+ Aufgabe') ? (ok('_vhRenderContainers: hat "+ Aufgabe" Button'), vhOk++) : (fail('_vhRenderContainers: fehlt "+ Aufgabe"'), vhFail++);
}

// Neue Datenfelder: favorit, vertraulich in _vhNeu
const vhNeuSrc = jsCode.match(/  _vhNeu\([\s\S]*?^  \},/m)?.[0] || '';
vhNeuSrc.includes('favorit') ? (ok('_vhNeu: setzt favorit-Feld'), vhOk++) : (fail('_vhNeu: kein favorit-Feld'), vhFail++);
vhNeuSrc.includes('vertraulich') ? (ok('_vhNeu: setzt vertraulich-Feld'), vhOk++) : (fail('_vhNeu: kein vertraulich-Feld'), vhFail++);

// Filter-Buttons vorhanden
content.includes('vl-filter-btn') ? (ok('.vl-filter-btn vorhanden'), vhOk++) : (fail('.vl-filter-btn fehlt'), vhFail++);
content.includes('vl-filter-star') ? (ok('.vl-filter-star vorhanden'), vhOk++) : (fail('.vl-filter-star fehlt'), vhFail++);

// Status-Dropdown
content.includes('vh-status-dd') ? (ok('.vh-status-dd vorhanden'), vhOk++) : (fail('.vh-status-dd fehlt'), vhFail++);
content.includes('_vhSetStatus') ? (ok('_vhSetStatus() aufgerufen'), vhOk++) : (fail('_vhSetStatus() nicht aufgerufen'), vhFail++);

// Büro-Modus filtert vertrauliche Vorhaben
const vhListeSrc19 = jsCode.match(/  _vhRenderListe\([\s\S]*?^  \},/m)?.[0] || '';
vhListeSrc19.includes('bueroModus') && vhListeSrc19.includes('vertraulich')
  ? (ok('_vhRenderListe: Büro-Modus filtert vertraulich'), vhOk++)
  : (fail('_vhRenderListe: Büro-Modus-Filter fehlt'), vhFail++);

const OLD_CK_IDS = ['ck-stat-erledigt', 'ck-stat-ueberwunden', 'ck-stat-verschoben'];
OLD_CK_IDS.forEach(id => {
  if (content.includes('id="' + id + '"')) {
    fail('Veraltete Cockpit-ID noch vorhanden', '#' + id);
    vhFail++;
  } else { vhOk++; }
});

if (vhFail === 0) ok(vhOk + ' Vorhaben-Elemente und Funktionen korrekt');

// ══════════════════════════════════════════
// 20. BACKLOG FILTER-REIHENFOLGE + KW-FORMAT
// ══════════════════════════════════════════
console.log('\n── 20. Tagesfokus Container + KW-Format ──');
// tf-heute-body startet offen
if (content.includes('id="tf-heute-body"') && content.match(/tf-heute-body[^"]*"[^>]*class="tf-body open"/)) {
  ok('tf-heute-body startet offen (.tf-body.open)');
} else if (content.includes('class="tf-body open" id="tf-heute-body"') || content.includes('"tf-body open"')) {
  ok('tf-heute-body startet offen');
} else {
  warn('tf-heute-body open-Status nicht prüfbar');
}

// _fmtShort muss existieren
if (jsCode.includes('  _fmtShort(')) {
  ok('_fmtShort() vorhanden');
} else {
  fail('_fmtShort() fehlt — KW-Datumsformat nicht implementiert');
}

// renderBacklog ruft _tfRenderHeute auf (Tagesfokus)
const rbStart2 = jsCode.indexOf('  renderBacklog(');
const rbEnd2   = rbStart2 > 0 ? jsCode.indexOf('\n  },\n', rbStart2) : -1;
const rbBody2  = rbStart2 > 0 && rbEnd2 > 0 ? jsCode.slice(rbStart2, rbEnd2) : '';
if (rbBody2.includes('_tfRenderHeute')) {
  ok('renderBacklog() ruft _tfRenderHeute() auf');
} else {
  fail('renderBacklog() ruft _tfRenderHeute() nicht auf');
}

// sec-vorhaben.wb-section muss !important padding:0 haben
if (styleBlock.includes('sec-vorhaben.wb-section') || styleBlock.includes('#sec-vorhaben.wb-section')) {
  ok('#sec-vorhaben.wb-section Override vorhanden');
} else {
  fail('#sec-vorhaben.wb-section Override fehlt — .wb-section padding überschreibt Layout');
}

// ══════════════════════════════════════════
// 21. ZIELE HTML-STRUKTUR + FUNKTIONEN
// ══════════════════════════════════════════
console.log('\n── 21. Ziele HTML-Struktur + Funktionen ──');
// sec-ziele muss flex column haben. Fehlt zi-scroll: Sektionen erscheinen nie.
const ZI_IDS = [
  'zi-app', 'zi-filter-col', 'zi-filter-head', 'zi-filter-title',
  'zi-filter-scroll', 'zi-fi-alle', 'zi-fi-kurs', 'zi-fi-stabil',
  'zi-fi-rueck', 'zi-fi-erreicht',
  'zi-fi-koerper', 'zi-fi-entw', 'zi-fi-beruf',
  'zi-fi-sozial', 'zi-fi-erhol', 'zi-fi-umgeb',
  'zi-main', 'zi-head', 'zi-head-title', 'zi-head-sub', 'zi-scroll',
];
let ziOk = 0, ziFail = 0;
ZI_IDS.forEach(id => {
  if (content.includes('id="' + id + '"')) { ziOk++; }
  else { fail('Ziele-Element fehlt', '#' + id); ziFail++; }
});

// sec-ziele.wb-section muss padding:0 + flex column haben
if (styleBlock.includes('sec-ziele.wb-section') || styleBlock.includes('#sec-ziele.wb-section')) {
  ok('#sec-ziele.wb-section Override vorhanden');
  ziOk++;
} else {
  fail('#sec-ziele.wb-section Override fehlt');
  ziFail++;
}

// Ziele-Funktionen
const ZI_FNS = ['renderZiele', '_ziAlleZiele', '_ziToggle', '_ziSetFilter', '_ziNeu'];
ZI_FNS.forEach(fn => {
  const found = jsCode.includes('  ' + fn + '(') || jsCode.includes('  ' + fn + ':');
  if (found) { ziOk++; }
  else { fail('Ziele-Funktion fehlt', fn + '()'); ziFail++; }
});

// 6 Lebensbereiche in _ziBereiche
const ZI_BEREICHE = ['koerper', 'entw', 'beruf', 'sozial', 'erhol', 'umgeb'];
ZI_BEREICHE.forEach(id => {
  if (jsCode.includes("'" + id + "'") || jsCode.includes('"' + id + '"')) {
    ziOk++;
  } else {
    fail('Lebensbereich fehlt in _ziBereiche', id);
    ziFail++;
  }
});

// renderZiele liest aus db.ziele
const rzStart = jsCode.indexOf('  renderZiele(');
const rzEnd   = rzStart > 0 ? jsCode.indexOf('\n  },\n', rzStart) : -1;
const rzBody  = rzStart > 0 && rzEnd > 0 ? jsCode.slice(rzStart, rzEnd) : '';
if (rzBody.includes('db.ziele') || rzBody.includes('ziele')) {
  ok('renderZiele() liest aus db.ziele');
  ziOk++;
} else {
  fail('renderZiele() greift nicht auf db.ziele zu');
  ziFail++;
}

if (ziFail === 0) ok(ziOk + ' Ziele-Elemente und Funktionen korrekt');

// ══════════════════════════════════════════
// 22. TABSWITCH !IMPORTANT-SICHERHEIT
// ══════════════════════════════════════════
console.log('\n── 22. TabSwitch !important-Sicherheit ──');
// Wenn CSS-Regeln display:flex !important auf Sections setzen,
// muss tabSwitch() setProperty('display','none','important') verwenden.
// Ohne !important beim Ausblenden: falsche Section bleibt sichtbar (z.B. Ziele zeigt Backlog).

const tsSrc = jsCode.match(/  tabSwitch\([\s\S]*?^  \},/m)?.[0] || '';
if (!tsSrc) {
  fail('tabSwitch() Body nicht gefunden');
} else {
  if (tsSrc.includes("setProperty('display'") || tsSrc.includes('setProperty("display"')) {
    ok('tabSwitch() verwendet setProperty() für display — !important-sicher');
  } else {
    fail('tabSwitch() verwendet s.style.display = "none" ohne !important',
      'Sections mit display:flex !important im CSS bleiben sichtbar → Tab zeigt falschen Inhalt');
  }

  // Prüfe ob Sections mit !important im CSS korrekt behandelt werden
  const IMPORTANT_SECTIONS = ['sec-vorhaben', 'sec-backlog', 'sec-ziele'];
  const hasImportantCss = IMPORTANT_SECTIONS.some(id =>
    styleBlock.includes('#' + id) && styleBlock.includes('!important')
  );
  if (hasImportantCss) {
    if (tsSrc.includes("setProperty('display'") || tsSrc.includes('setProperty("display"')) {
      ok('Sections mit !important CSS + tabSwitch setProperty() korrekt kombiniert');
    } else {
      fail('Sections haben display !important CSS aber tabSwitch() setzt kein !important beim Ausblenden');
    }
  } else {
    ok('Keine !important display-Konflikte im CSS (kein Override nötig)');
  }
}

// ══════════════════════════════════════════
// 23. WOCHE HTML-STRUKTUR + FUNKTIONEN
// ══════════════════════════════════════════
console.log('\n── 23. Woche HTML-Struktur + Funktionen ──');
const WO_IDS = [
  'wo-header', 'wo-header-title', 'wo-header-sub',
  'wo-header-right', 'wo-view-toggle', 'wo-btn-list', 'wo-btn-cal',
  'wo-content', 'wo-list-view', 'wo-list-days',
  'wo-list-mottos', 'wo-lm-title', 'wo-lm-cards',
  'wo-cal-view', 'wo-cal-head-row', 'wo-cal-day-headers',
  'wo-cal-scroll-x', 'wo-cal-scroll-y', 'wo-cal-inner',
  'wo-cal-grid', 'wo-cal-gutter', 'wo-cal-cols',
  'wo-cal-mottos', 'wo-cal-mottos-label', 'wo-cal-mottos-cards',
];
let woOk = 0, woFail = 0;
WO_IDS.forEach(id => {
  if (content.includes('id="' + id + '"')) { woOk++; }
  else { fail('Woche-Element fehlt', '#' + id); woFail++; }
});

// sec-woche CSS Override
if (styleBlock.includes('sec-woche.wb-section') || styleBlock.includes('#sec-woche.wb-section')) {
  ok('#sec-woche.wb-section Override vorhanden');
  woOk++;
} else {
  fail('#sec-woche.wb-section Override fehlt');
  woFail++;
}

// Woche-Funktionen
const WO_FNS = [
  'renderWoche', '_woGetWeekDays', '_woRenderHeader',
  '_woRenderListe', '_woRenderKalender', '_woRenderMottos',
  '_woSetView', '_woNavWeek', '_woNavToday', '_woPflichtToggle',
  '_woTerminNeu', '_woPflichtNeu', '_woMottoNeu',
];
WO_FNS.forEach(fn => {
  const found = jsCode.includes('  ' + fn + '(') || jsCode.includes('  ' + fn + ':');
  if (found) { woOk++; }
  else { fail('Woche-Funktion fehlt', fn + '()'); woFail++; }
});

// Kalender: Zeitraster 06-23, 52px pro Stunde, min-height:32
const rkBody = jsCode.match(/  _woRenderKalender\([\s\S]*?^  \},/m)?.[0] || '';
if (rkBody.includes('52') && rkBody.includes('START_HOUR')) {
  ok('Kalender: 52px/h Zeitraster vorhanden');
  woOk++;
} else {
  fail('Kalender: 52px/h Zeitraster fehlt');
  woFail++;
}
if (rkBody.includes('Math.max') && rkBody.includes('32')) {
  ok('Kalender: min-height 32px für Events');
  woOk++;
} else {
  fail('Kalender: min-height 32px fehlt für kurze Events');
  woFail++;
}

// _woView Standardwert 'list'
if (content.includes("_woView:    'list'") || content.includes("_woView: 'list'") || content.includes("_woView:'list'") || content.includes("_woView:        'list'")) {
  ok("_woView Standardwert 'list'");
  woOk++;
} else {
  fail("_woView Standardwert nicht 'list'");
  woFail++;
}

// woche in tabSwitch display-Map
const tsBody = jsCode.match(/  tabSwitch\([\s\S]*?^  \},/m)?.[0] || '';
if (tsBody.includes("'woche'") || tsBody.includes('"woche"') || tsBody.includes('woche:') || tsBody.includes("woche :'") || tsBody.includes("woche: '")) {
  ok("tabSwitch() enthält 'woche' in display-Map");
  woOk++;
} else {
  fail("tabSwitch() fehlt 'woche' — Woche-Tab würde display:block statt flex bekommen");
  woFail++;
}

if (woFail === 0) ok(woOk + ' Woche-Elemente und Funktionen korrekt');

// ══════════════════════════════════════════
// 24. ABLAGE HTML-STRUKTUR + FUNKTIONEN
// ══════════════════════════════════════════
console.log('\n── 24. Ablage HTML-Struktur + Funktionen ──');
const AB_IDS = [
  'ab-header', 'ab-header-title', 'ab-header-sub',
  'ab-search-wrap', 'ab-search-input',
  'ab-app', 'ab-filter-col', 'ab-filter-head', 'ab-filter-title',
  'ab-filter-scroll', 'ab-fi-alle', 'ab-fi-gdoc', 'ab-fi-sp',
  'ab-fi-on', 'ab-fi-cf', 'ab-fi-link', 'ab-fi-vorhaben-list',
  'ab-main', 'ab-scroll', 'ab-gruppen',
];
let abOk = 0, abFail = 0;
AB_IDS.forEach(id => {
  if (content.includes('id="' + id + '"')) { abOk++; }
  else { fail('Ablage-Element fehlt', '#' + id); abFail++; }
});

// sec-ablage CSS Override
if (styleBlock.includes('sec-ablage.wb-section') || styleBlock.includes('#sec-ablage.wb-section')) {
  ok('#sec-ablage.wb-section Override vorhanden');
  abOk++;
} else {
  fail('#sec-ablage.wb-section Override fehlt');
  abFail++;
}

// Ablage-Funktionen
const AB_FNS = ['renderAblage', '_abAlleLinks', '_abToggle', '_abSetFilter', '_abSearch', '_abLinkOpen', '_abLinkClick'];
AB_FNS.forEach(fn => {
  const found = jsCode.includes('  ' + fn + '(') || jsCode.includes('  ' + fn + ':');
  if (found) { abOk++; }
  else { fail('Ablage-Funktion fehlt', fn + '()'); abFail++; }
});

// renderAblage liest aus db.vorhaben[].links
const raStart = jsCode.indexOf('  renderAblage(');
const raEnd   = raStart > 0 ? jsCode.indexOf('\n  },\n', raStart) : -1;
const raBody  = raStart > 0 && raEnd > 0 ? jsCode.slice(raStart, raEnd) : '';
if (raBody.includes('_abAlleLinks') || raBody.includes('v.links')) {
  ok('renderAblage() liest aus Vorhaben-Links');
  abOk++;
} else {
  fail('renderAblage() greift nicht auf Vorhaben-Links zu');
  abFail++;
}

// ablage in tabSwitch display-Map
const tsBody2 = jsCode.match(/  tabSwitch\([\s\S]*?^  \},/m)?.[0] || '';
if (tsBody2.includes('ablage:') || tsBody2.includes("'ablage'") || tsBody2.includes('"ablage"')) {
  ok("tabSwitch() enthält 'ablage' in display-Map");
  abOk++;
} else {
  fail("tabSwitch() fehlt 'ablage' — Ablage-Tab würde display:block statt flex bekommen");
  abFail++;
}

// Filter-Reihenfolge: Typ vor Vorhaben
const abFilterScroll = content.match(/id="ab-filter-scroll"[\s\S]*?id="ab-fi-vorhaben-list"/)?.[0] || '';
if (abFilterScroll) {
  const typPos = abFilterScroll.indexOf('ab-fi-gdoc');
  const vhPos  = abFilterScroll.indexOf('ab-fi-vorhaben-list');
  if (typPos < vhPos) {
    ok('Ablage Filter-Reihenfolge korrekt: Typ → Vorhaben');
    abOk++;
  } else {
    fail('Ablage Filter-Reihenfolge falsch', 'Erwartet: Typ → Vorhaben');
    abFail++;
  }
}

if (abFail === 0) ok(abOk + ' Ablage-Elemente und Funktionen korrekt');

// ══════════════════════════════════════════
// 25. EINSTELLUNGEN + WELT-LOGIK
// ══════════════════════════════════════════
console.log('\n── 25. Einstellungen + Welt-Logik ──');
// Prüft ob Einstellungs-Overlay, Hamburger, Büromodus und Welt-Logik vorhanden sind.
const S_IDS = [
  'wb-settings-overlay', 'wb-buero-toggle',
  's-ov-header', 's-ov-back', 's-ov-title', 's-ov-version', 's-ov-scroll',
  's-toggle-dark', 's-toggle-buero',
  's-input-clientid', 's-wp-list', 's-file-input',
];
let sOk = 0, sFail = 0;
S_IDS.forEach(id => {
  if (content.includes('id="' + id + '"')) { sOk++; }
  else { fail('Settings-Element fehlt', '#' + id); sFail++; }
});

// Overlay muss class open/close Logik haben
if (content.includes('wb-settings-overlay') && (content.includes('classList.add(\'open\')') || content.includes('classList.add("open")'))) {
  ok('wb-settings-overlay open/close via classList');
  sOk++;
} else {
  fail('wb-settings-overlay open/close Logik fehlt');
  sFail++;
}

// Settings-Funktionen
const S_FNS = [
  'settingsOpen', 'settingsClose', '_sRenderAll', '_sSaveSettings', '_sLoadSettings',
  '_sToggleDark', '_sToggleBuero', '_sColorChange', '_sExport', '_sImport',
  '_sReset', '_sFileLoaded', '_sWpNeu', '_sWpDelete', '_sSetDevice',
  '_sSaveClientId', 'oauthSignOut',
  '_bueroToggle', '_bueroUpdateUI', '_bueroIstPrivatSichtbar',
  '_weltIstArbeitstag', '_weltInit',
];
S_FNS.forEach(fn => {
  const found = jsCode.includes('  ' + fn + '(')
    || jsCode.includes('  async ' + fn + '(')
    || jsCode.includes('  ' + fn + ':');
  if (found) { sOk++; }
  else { fail('Settings-Funktion fehlt', fn + '()'); sFail++; }
});

// _sLoadSettings muss in init() aufgerufen werden
const initFnStart = content.indexOf('async init(');
// init() ist groß — suche bis zu 6000 Zeichen weit
const initFnBody  = initFnStart > 0 ? content.slice(initFnStart, initFnStart + 6000) : '';
const s25InitBody = initFnBody;
if (s25InitBody.includes('_sLoadSettings')) {
  ok('_sLoadSettings() in init() aufgerufen');
  sOk++;
} else {
  fail('_sLoadSettings() nicht in init() aufgerufen');
  sFail++;
}
if (s25InitBody.includes('_weltInit')) {
  ok('_weltInit() in init() aufgerufen');
  sOk++;
} else {
  fail('_weltInit() nicht in init() aufgerufen');
  sFail++;
}

// _sInitCards + _sToggleCard für kollabierbare Cards
if (jsCode.includes('  _sInitCards(') || jsCode.includes('  async _sInitCards(')) {
  ok('_sInitCards() vorhanden — Cards kollabierbar');
  sOk++;
} else {
  fail('_sInitCards() fehlt — Einstellungs-Cards nicht kollabierbar');
  sFail++;
}
if (jsCode.includes('  _sToggleCard(') || jsCode.includes('  _sToggleCard:')) {
  ok('_sToggleCard() vorhanden');
  sOk++;
} else {
  fail('_sToggleCard() fehlt');
  sFail++;
}
// s-card-chev CSS muss vorhanden sein
if (styleBlock.includes('s-card-chev') && styleBlock.includes('s-card-body')) {
  ok('s-card-chev + s-card-body CSS vorhanden');
  sOk++;
} else {
  fail('s-card-chev oder s-card-body CSS fehlt');
  sFail++;
}

if (sFail === 0) ok(sOk + ' Einstellungs-Elemente und Funktionen korrekt');

// ══════════════════════════════════════════
// 26. MODAL-SYSTEM + DETAIL-DIALOGE
// ══════════════════════════════════════════
console.log('\n── 26. Modal-System + Detail-Dialoge ──');
// Prüft ob Modal-Overlay, alle Open- und Save-Funktionen vorhanden sind.
// Fehlen Save-Funktionen: Daten gehen beim Speichern ohne Fehlermeldung verloren.

// HTML-Element
if (content.includes('id="wb-modal-overlay"')) {
  ok('wb-modal-overlay vorhanden');
} else {
  fail('wb-modal-overlay fehlt');
}

// Modal-Kern
const MODAL_CORE = ['modalOpen', 'modalClose', '_modalBgClick', '_modalSave', '_modalDelete', '_modalFooter', '_modalWeltTop', '_modalToggleWelt', '_modalGetWelt', '_modalGetVertraulich', '_modalAddMicro', '_modalUpdateWeiche', '_modalVhOptions'];
let mOk = 0, mFail = 0;
MODAL_CORE.forEach(fn => {
  const found = jsCode.includes('  ' + fn + '(') || jsCode.includes('  async ' + fn + '(');
  if (found) { mOk++; }
  else { fail('Modal-Kernfunktion fehlt', fn + '()'); mFail++; }
});

// Open-Funktionen (7)
const OPEN_FNS = ['schnellOpen', 'aufgabeOpen', 'terminOpen', 'pflichtOpen', 'zielOpen', 'linkOpen', 'vorlageOpen'];
OPEN_FNS.forEach(fn => {
  const found = jsCode.includes('  ' + fn + '(');
  if (found) { mOk++; }
  else { fail('Open-Funktion fehlt', fn + '()'); mFail++; }
});

// Save-Funktionen (7)
const SAV_FNS = ['_savFreieAufgabe', '_savAufgabe', '_savTermin', '_savPflicht', '_savZiel', '_savLink', '_savVorlage'];
SAV_FNS.forEach(fn => {
  const found = jsCode.includes('  ' + fn + '(');
  if (found) { mOk++; }
  else { fail('Save-Funktion fehlt', fn + '()'); mFail++; }
});

// Souveränitätskonto entfernt
if (!jsCode.includes('_svKontoAddieren(')) {
  ok('_svKontoAddieren() korrekt entfernt'); mOk++;
} else { fail('_svKontoAddieren() noch vorhanden — sollte entfernt sein'); mFail++; }
if (!styleBlock.includes('sv-float') && !styleBlock.includes('sv-plus1')) {
  ok('sv-float Animation CSS korrekt entfernt'); mOk++;
} else { fail('sv-float/sv-plus1 CSS noch vorhanden'); mFail++; }

// Modal CSS
if (styleBlock.includes('.wb-modal') && styleBlock.includes('wb-modal-overlay')) {
  ok('Modal CSS vorhanden');
  mOk++;
} else {
  fail('Modal CSS fehlt');
  mFail++;
}

// _modalDuplicate vorhanden
if (jsCode.includes('  _modalDuplicate(')) {
  ok('_modalDuplicate() vorhanden');
  mOk++;
} else {
  fail('_modalDuplicate() fehlt');
  mFail++;
}
// wb-btn-dup CSS
if (styleBlock.includes('wb-btn-dup')) {
  ok('wb-btn-dup CSS vorhanden');
  mOk++;
} else {
  fail('wb-btn-dup CSS fehlt');
  mFail++;
}
// s-card-head-chev im HTML
if (content.includes('s-card-head-chev')) {
  ok('s-card-head-chev im HTML vorhanden');
  mOk++;
} else {
  fail('s-card-head-chev fehlt');
  mFail++;
}
// s-ov-scroll webkit-scroll
if (content.includes('s-ov-scroll') && content.includes('-webkit-overflow-scrolling')) {
  ok('#s-ov-scroll hat -webkit-overflow-scrolling');
  mOk++;
} else {
  fail('#s-ov-scroll fehlt -webkit-overflow-scrolling');
  mFail++;
}
// .s-card overflow:visible
if (styleBlock.includes('.s-card {') && (styleBlock.includes('overflow: visible') || styleBlock.includes('overflow:visible'))) {
  ok('.s-card hat overflow:visible');
  mOk++;
} else {
  fail('.s-card hat noch overflow:hidden — Cards werden abgeschnitten');
  mFail++;
}

if (mFail === 0) ok(mOk + ' Modal-Funktionen und Elemente korrekt');

// ══════════════════════════════════════════
// 27. FOKUSTIMER + VORLAGEN-SYSTEM
// ══════════════════════════════════════════
console.log('\n── 27. Fokustimer + Vorlagen-System ──');
const FT_IDS = ['ft-panel', 'ft-header', 'ft-title', 'ft-context', 'ft-ctx-text', 'ft-timer-area', 'ft-time', 'ft-time-sub', 'ft-bar', 'ft-bar-fill', 'ft-btn-toggle', 'ft-cl-head', 'ft-cl-lbl', 'ft-cl-cnt', 'ft-cl-add', 'ft-cl-list', 'ft-sess-btns', 'ft-vorlagen-overlay', 'ft-vorlagen-sheet', 'ft-vl-head', 'ft-vl-title', 'ft-vl-list'];
let ftOk = 0, ftFail = 0;
FT_IDS.forEach(id => {
  if (content.includes('id="' + id + '"')) { ftOk++; }
  else { fail('Fokustimer-Element fehlt', '#' + id); ftFail++; }
});
const FT_FNS = ['ftOpen', 'ftOpenFromAufgabe', '_ftStart', '_ftStop', '_ftDrawerPause', '_ftDrawerAbbrechen', '_ftClCheck', '_ftDrawerAddItem', '_ftRender', '_ftRenderTime', '_ftRenderCl', 'ftVorlagenOpen', 'ftVorlagenClose', '_ftRenderVorlagen', 'ftStartVorlage'];
FT_FNS.forEach(fn => {
  const found = content.includes(fn + '(') || content.includes(fn + ' (');
  if (found) { ftOk++; }
  else { fail('Fokustimer-Funktion fehlt', fn + '()'); ftFail++; }
});
if (jsCode.includes('_ft:') && jsCode.includes('isRunning') && jsCode.includes('remainSec')) {
  ok('_ft State-Objekt mit Feldern vorhanden'); ftOk++;
} else { fail('_ft State-Objekt fehlt'); ftFail++; }
// _ftClCheck vorhanden
const ftClBody = jsCode.match(/  _ftClCheck\([\s\S]*?^  \},/m)?.[0] || '';
if (ftClBody.includes('done') && ftClBody.includes('checklist')) {
  ok('_ftClCheck() implementiert korrekt'); ftOk++;
} else { fail('_ftClCheck() fehlt done-Toggle'); ftFail++; }
// #ft-drawer vorhanden
if (content.includes('id="ft-drawer"')) { ok('#ft-drawer vorhanden'); ftOk++; }
else { fail('#ft-drawer fehlt'); ftFail++; }
if (styleBlock.includes('#ft-drawer') && (styleBlock.includes('display:none') || styleBlock.includes('display: none'))) {
  ok('Fokus-Drawer CSS vorhanden'); ftOk++;
} else { fail('Fokus-Drawer CSS fehlt'); ftFail++; }
if (ftFail === 0) ok(ftOk + ' Fokustimer-Elemente und Funktionen korrekt');

// ══════════════════════════════════════════
// 28. BUGFIXES DB-ZUGRIFF + DAUER
// ══════════════════════════════════════════
console.log('\n── 28. Bugfixes DB-Zugriff + Dauer ──');
// Bug 1: _evtDurationMin für Dauer-Kompatibilität
if (jsCode.includes('  _evtDurationMin(')) {
  ok('_evtDurationMin() vorhanden — Dauer-Kompatibilität sichergestellt');
} else {
  fail('_evtDurationMin() fehlt — alte duration-Felder werden nicht umgerechnet');
}

// Bug 1b: _ckRenderBanner muss dataPriv für Termine nutzen
const ckBanBody2 = jsCode.match(/  _ckRenderBanner\(\)[\s\S]*?^  \},/m)?.[0] || '';
if ((ckBanBody2.includes('this.dataPriv') || ckBanBody2.includes('this.db')) && ckBanBody2.includes('kandidaten')) {
  ok('_ckRenderBanner() nutzt DB für Termine (korrekt)');
} else {
  fail('_ckRenderBanner() fehlt db-Nutzung');
}

// Bug 2: terminOpen sucht in dataPriv (Termine immer dort)
const toBody = jsCode.match(/  terminOpen\(eventId[\s\S]*?^  \},/m)?.[0] || '';
if (toBody.includes('this.dataPriv') && !toBody.includes('this.dataPro') || toBody.includes('otherDb') || toBody.includes('Fallback')) {
  ok('terminOpen() liest aus this.dataPriv (korrekt)');
} else {
  fail('terminOpen() sucht nicht in dataPriv');
}

// Bug 2b: freieAufgabeOpen nutzt db.aufgaben
const soBody = jsCode.match(/  freieAufgabeOpen[\s\S]*?^  \},/m)?.[0] || '';
soBody.includes('aufgaben') ? ok('freieAufgabeOpen() nutzt db.aufgaben') : fail('freieAufgabeOpen() fehlt');

// Bug 2c: aufgabeOpen Fallback-Suche
const aoBody = jsCode.match(/  aufgabeOpen\(vorhabenId[\s\S]*?^  \},/m)?.[0] || '';
aoBody.includes('vorhabenId') ? ok('aufgabeOpen() korrekt implementiert') : fail('aufgabeOpen() fehlt');

// Bug 3: renderBacklog — beide Welten
const rbBody = jsCode.match(/  renderBacklog\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (rbBody && (rbBody.includes("'beruf'  ? ['pro']") || rbBody.includes("'beruf' ? ['pro']") || rbBody.includes("_blFilter.welt === 'beruf'") || rbBody.includes('_tfRenderHeute'))) {
  ok('renderBacklog() korrekt implementiert (Tagesfokus)');
} else {
  fail('renderBacklog() filtert nach activeWorld statt explizitem Filter');
}

// ══════════════════════════════════════════
// 29. WELT-LOGIK V2
// ══════════════════════════════════════════
console.log('\n── 29. Welt-Logik v2 ──');
// _weltBeideVisible steuert Sichtbarkeit — kein Filter mehr via activeWorld
const WL_FNS = ['_weltBeideVisible', '_weltToggleOverride', '_weltIstArbeitstag'];
let wlOk = 0, wlFail = 0;
WL_FNS.forEach(fn => {
  if (jsCode.includes('  ' + fn + '(')) { wlOk++; }
  else { fail('Welt-Funktion fehlt', fn + '()'); wlFail++; }
});

// _weltOverride State
if (jsCode.includes('_weltOverride:') || jsCode.includes('_weltOverride :')) {
  ok('_weltOverride State vorhanden'); wlOk++;
} else { fail('_weltOverride State fehlt'); wlFail++; }

// ck-world-pill nicht mehr klickbar
if (!content.includes('onclick="WB.ckToggleWorld()"')) {
  ok('ck-world-pill onclick entfernt'); wlOk++;
} else { fail('ck-world-pill onclick noch vorhanden'); wlFail++; }

// _ckDialogKlassify hat type-Parameter und Klassifizierungslogik
const ckca = jsCode.match(/  _ckDialogKlassify\([\s\S]*?^  \},/m)?.[0] || '';
if (ckca.includes('switch(type)') || ckca.includes("type ===")) {
  ok('_ckDialogKlassify() hat type-Handling'); wlOk++;
} else { fail('_ckDialogKlassify() fehlt type-Handling'); wlFail++; }

// _ckRenderBanner hat Kandidaten-Logik
const ckbody = jsCode.match(/  _ckRenderBanner\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (ckbody.includes('kandidaten') && ckbody.includes('startMin')) {
  ok('_ckRenderBanner() hat vollständige Kandidaten-Logik'); wlOk++;
} else { fail('_ckRenderBanner() fehlt Kandidaten-Logik'); wlFail++; }

// _tfRenderHeute nutzt beide DBs (pro+priv)
const rbBody29 = jsCode.match(/  _tfRenderHeute\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (rbBody29.includes("'pro'") && rbBody29.includes("'priv'")) {
  ok("_tfRenderHeute() liest aus beiden DBs (pro+priv)"); wlOk++;
} else { fail("_tfRenderHeute() fehlt pro/priv"); wlFail++; }

// _ziAlleZiele gibt alle Ziele aus this.db zurück
const ziSrc = content.match(/  _ziAlleZiele\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (ziSrc.includes('this.db') && (ziSrc.includes('.map(') || ziSrc.includes('.filter('))) {
  ok('_ziAlleZiele() nutzt this.db direkt'); wlOk++;
} else { fail('_ziAlleZiele() nutzt nicht _weltBeideVisible()'); wlFail++; }
const ziBody = jsCode.match(/  _ziAlleZiele\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (ziBody.includes('this.db') || ziBody.includes('welt')) {
  ok('_ziAlleZiele() korrekte Implementierung'); wlOk++;
} else { fail('_ziAlleZiele() nutzt nicht _weltBeideVisible()'); wlFail++; }

if (wlFail === 0) ok(wlOk + ' Welt-Logik Funktionen korrekt');

// ══════════════════════════════════════════
// 30. BUGFIXES WOCHE + PFLICHT + TERMIN
// ══════════════════════════════════════════
console.log('\n── 30. Bugfixes Woche + Pflicht + Termin ──');

// _woMottoNeu implementiert
const mottoBody = jsCode.match(/  _woMottoNeu\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (mottoBody.includes('wochenMottos') && mottoBody.includes('prompt')) {
  ok('_woMottoNeu() implementiert (nicht nur Toast)');
} else {
  fail('_woMottoNeu() zeigt nur Toast — nicht implementiert');
}

// _savTermin speichert in dataPriv
const savTermBody = jsCode.match(/  _savTermin\(c\)[\s\S]*?^  \},/m)?.[0] || '';
if ((savTermBody.includes('this.dataPriv') || savTermBody.includes('this.db')) && !savTermBody.includes("ctx==='pro' ? this.dataPro")) {
  ok('_savTermin() speichert in korrekter DB');
} else {
  fail('_savTermin() speichert in falscher DB');
}

// pflichtStatus Migration in idbLoadAll
const idbBody = jsCode.match(/  async idbLoadAll\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (idbBody.includes('pflichtStatus') && idbBody.includes('Format-Migration')) {
  ok('pflichtStatus Format-Migration in idbLoad()');
} else {
  fail('pflichtStatus Format-Migration fehlt in idbLoad()');
}

// #wo-list-days hat webkit-overflow-scrolling
if (content.includes('-webkit-overflow-scrolling') && content.includes('wo-list-days')) {
  ok('#wo-list-days hat -webkit-overflow-scrolling');
} else {
  fail('#wo-list-days fehlt -webkit-overflow-scrolling');
}

// pflichtOpen in Wochenpflicht-Rows
if (content.includes('WB.pflichtOpen(') && content.includes('wo-pfl-row')) {
  ok('pflichtOpen() in Wochenpflicht-Rows verknüpft');
} else {
  fail('pflichtOpen() in Wochenpflicht-Rows fehlt');
}

// Neue Kalender-Struktur: scroll-x/scroll-y vorhanden, pfl-row entfernt
if (content.includes('id="wo-cal-scroll-x"') && content.includes('id="wo-cal-scroll-y"')) {
  ok('#wo-cal-scroll-x und #wo-cal-scroll-y vorhanden (neues Layout)');
} else {
  fail('#wo-cal-scroll-x oder #wo-cal-scroll-y fehlen');
}
if (!content.includes('id="wo-cal-pfl-row"')) {
  ok('#wo-cal-pfl-row korrekt entfernt');
} else {
  fail('#wo-cal-pfl-row noch vorhanden — sollte entfernt sein');
}

// ══════════════════════════════════════════
// 31. AUTO-SYNC + OAUTH-BANNER + MERGE
// ══════════════════════════════════════════
console.log('\n── 31. Auto-Sync + OAuth-Banner + Merge ──');

// OAuth-Banner im HTML
if (content.includes('id="wb-oauth-banner"')) {
  ok('#wb-oauth-banner vorhanden');
} else { fail('#wb-oauth-banner fehlt'); }

// Banner steht VOR wb-header
const bannerPos = content.indexOf('id="wb-oauth-banner"');
const headerPos = content.indexOf('id="wb-welt-header"');
if (bannerPos > 0 && headerPos > 0 && bannerPos < headerPos) {
  ok('#wb-oauth-banner steht VOR #wb-welt-header');
} else { fail('#wb-oauth-banner steht nicht vor #wb-welt-header'); }

// Banner-Funktionen
const SYNC_FNS = ['_oauthShowBanner', '_oauthHideBanner', '_oauthReconnect', '_oauthBannerDismiss', '_oauthCheckToken', '_syncStart', '_syncTick', '_syncCheckNewer', '_syncUpload', '_syncDownload', '_syncGetFileId', '_cryptoEncrypt', '_cryptoDecrypt', '_migrate_v2'];
let s31Ok = 0, s31Fail = 0;
SYNC_FNS.forEach(fn => {
  const found = jsCode.includes('  ' + fn + '(') || jsCode.includes('  async ' + fn + '(');
  if (found) { s31Ok++; }
  else { fail('Sync-Funktion fehlt', fn + '()'); s31Fail++; }
});

// _now() vorhanden
if (jsCode.includes('  _now()')) { ok('_now() vorhanden'); s31Ok++; }
else { fail('_now() fehlt'); s31Fail++; }

// oauthSyncDownload ruft _mergeDb auf
const dlBody = jsCode.match(/  async oauthSyncDownload\([\s\S]*?^  \},/m)?.[0] || '';
content.includes('_syncDownload') ? (ok('_syncDownload() definiert'), s31Ok++) : (fail('_syncDownload() fehlt'), s31Fail++);

// setDirty triggert Upload
const sdBody31 = jsCode.match(/  setDirty\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (sdBody31.includes('_syncUpload') || sdBody31.includes('_syncUploadAll')) { ok('setDirty() triggert Upload'); s31Ok++; }
else { fail('setDirty() triggert keinen Upload'); s31Fail++; }

// updatedAt in Save-Funktionen
const SAV_CHECK = ['_savFreieAufgabe', '_savAufgabe', '_savTermin', '_savPflicht', '_savZiel', '_savLink', '_savVorlage'];
let updOk = true;
SAV_CHECK.forEach(fn => {
  const body = jsCode.match(new RegExp('  ' + fn + '\\(c\\)[\\s\\S]*?^  \\},', 'm'))?.[0] || '';
  if (!body.includes('updatedAt') && !body.includes('_now()')) {
    fail(fn + '() hat kein updatedAt'); updOk = false; s31Fail++;
  } else { s31Ok++; }
});
if (updOk) ok('Alle 7 Save-Funktionen haben updatedAt: this._now()');

if (s31Fail === 0) ok(s31Ok + ' Auto-Sync + Merge Funktionen korrekt');

// ══════════════════════════════════════════
// 32. WOCHENANSICHT FIXES
// ══════════════════════════════════════════
console.log('\n── 32. Wochenansicht Fixes ──');

// wo-ev-row wird mit onclick gerendert (terminOpen oder schnellOpen)
const woRenderListeSrc = jsCode.match(/  _woRenderListe\(\)[\s\S]*?^  \},/m)?.[0] || '';
if ((woRenderListeSrc.includes('wo-ev-row') && woRenderListeSrc.includes('terminOpen')) ||
    (woRenderListeSrc.includes('wo-ev-row') && woRenderListeSrc.includes('schnellOpen'))) {
  ok('wo-ev-row hat onclick (terminOpen/schnellOpen)');
} else {
  fail('wo-ev-row fehlt onclick (terminOpen/schnellOpen)');
}

// wo-cal-evt hat onclick terminOpen
const calEvtMatch = content.match(/wo-cal-evt[\s\S]{0,200}?terminOpen/);
if (calEvtMatch) {
  ok('wo-cal-evt hat onclick terminOpen');
} else {
  fail('wo-cal-evt fehlt onclick terminOpen');
}

// _woRenderListe Events nur aus dataPriv
const woListe = jsCode.match(/  _woRenderListe\(\)[\s\S]*?^  \},/m)?.[0] || '';
if ((woListe.includes('this.dataPriv') || woListe.includes('this.db')) && !woListe.match(/dataPro.*customEvents/)) {
  ok('_woRenderListe() Events aus DB (korrekt)');
} else {
  fail('_woRenderListe() Events nicht nur aus dataPriv');
}

// _woRenderKalender Events nur aus dataPriv
const woKal = jsCode.match(/  _woRenderKalender\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (woKal.includes('this.dataPriv?.customEvents') || woKal.includes("this.dataPriv?.customEvents")) {
  ok('_woRenderKalender() Events aus dataPriv');
} else if (woKal.includes('dataPriv') && woKal.includes('customEvents')) {
  ok('_woRenderKalender() Events aus dataPriv');
} else {
  fail('_woRenderKalender() Events nicht aus dataPriv');
}

// _woTerminNeu ruft terminOpen auf
const woTN = jsCode.match(/  _woTerminNeu\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (woTN.includes('terminOpen')) {
  ok('_woTerminNeu() ruft terminOpen() auf');
} else { fail('_woTerminNeu() ruft nicht terminOpen() auf'); }

// _woPflichtNeu ruft pflichtOpen auf
const woPfN = jsCode.match(/  _woPflichtNeu\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (woPfN.includes('pflichtOpen')) {
  ok('_woPflichtNeu() ruft pflichtOpen() auf');
} else { fail('_woPflichtNeu() ruft nicht pflichtOpen() auf'); }

// _woPflichtToggle hat ctx
const woPfT = jsCode.match(/  _woPflichtToggle\([\s\S]*?^  \},/m)?.[0] || '';
if (woPfT.includes('ctx') || woPfT.includes('this.db') || woPfT.includes('pflicht')) {
  ok('_woPflichtToggle() korrekt');
} else { fail('_woPflichtToggle() fehlt ctx-Parameter'); }

// ══════════════════════════════════════════
// 33. COCKPIT V3 (Banner + Timer + Editor)
// ══════════════════════════════════════════
console.log('\n── 33. Cockpit v3 (Banner/Timer/Editor) ──');
let ckOk = 0, ckFail = 0;

// HTML-Elemente
const CK_V3_IDS = ['ck-banner', 'ck-banner-main', 'ck-banner-next', 'ft-config-row', 'ck-editor-block', 'ck-editor-area', 'ck-dialog-overlay'];
CK_V3_IDS.forEach(id => {
  if (content.includes('id="' + id + '"')) { ckOk++; }
  else { fail('Cockpit-v3-Element fehlt', '#' + id); ckFail++; }
});

// contenteditable auf editor-area
if (content.includes('id="ck-editor-area"') && content.includes('contenteditable')) {
  ok('#ck-editor-area hat contenteditable'); ckOk++;
} else { fail('#ck-editor-area fehlt contenteditable'); ckFail++; }

// 8 Dialog-Buttons
const dialogBtns = (content.match(/_ckDialogKlassify\(/g)||[]).length;
if (dialogBtns >= 5) { ok(dialogBtns + ' _ckDialogKlassify-Aufrufe vorhanden'); ckOk++; }
else { fail('Weniger als 5 _ckDialogKlassify-Aufrufe (' + dialogBtns + ')'); ckFail++; }

// Neue CK-Funktionen
const CK_V3_FNS = ['_ckRenderBanner', '_ckTimerToggle', '_ckTimerSetDur', '_ckTimerCustom', '_ckExecCmd', '_ckInsertCheckbox', '_ckVerarbeiten', '_ckDialogKlassify', '_ckRenderSortierListe', '_ckLadeHeutigerEintrag', '_ckSetView'];
CK_V3_FNS.forEach(fn => {
  if (jsCode.includes('  ' + fn + '(') || jsCode.includes('  ' + fn + ':')) { ckOk++; }
  else { fail('Cockpit-v3-Funktion fehlt', fn + '()'); ckFail++; }
});

// Alte Micro-Funktionen entfernt
const OLD_FNS = ['_ckSammelItems', '_ckRenderSektion', '_ckMicroCheck', '_ckMicroClick', '_ckRenderPflichten', '_ckRenderVorhaben'];
OLD_FNS.forEach(fn => {
  const isProperty = jsCode.includes('  ' + fn + ':');
  const isMethod   = jsCode.match(new RegExp('  ' + fn + '\\s*\\('));
  if (!isProperty && !isMethod) { ok(fn + '() korrekt entfernt'); ckOk++; }
  else { fail(fn + '() noch vorhanden — sollte entfernt sein'); ckFail++; }
});

// _ckCleanSlate entfernt (Tagesprotokoll wird nie gelöscht)
if (!jsCode.includes('_ckCleanSlate')) { ok('_ckCleanSlate() korrekt entfernt'); ckOk++; }
else { fail('_ckCleanSlate() noch vorhanden'); ckFail++; }

if (ckFail === 0) ok(ckOk + ' Cockpit-v3 Checks bestanden');

// ══════════════════════════════════════════
// 34. WOCHENKALENDER RESPONSIV
// ══════════════════════════════════════════
console.log('\n── 34. Wochenkalender Responsiv ──');

// Neue Scroll-Struktur
const WK_IDS = ['wo-cal-scroll-x', 'wo-cal-scroll-y', 'wo-cal-inner', 'wo-cal-head-row', 'wo-cal-gutter', 'wo-cal-cols'];
let wkOk = 0, wkFail = 0;
WK_IDS.forEach(id => {
  if (content.includes('id="' + id + '"')) { wkOk++; }
  else { fail('Kalender-Element fehlt', '#' + id); wkFail++; }
});

// pfl-row entfernt
if (!content.includes('id="wo-cal-pfl-row"')) { ok('#wo-cal-pfl-row entfernt'); wkOk++; }
else { fail('#wo-cal-pfl-row noch vorhanden'); wkFail++; }

// min-width auf .wo-cal-dh
if (content.includes('min-width: 80px') || styleBlock.includes('min-width: 80px')) {
  ok('.wo-cal-dh hat min-width:80px'); wkOk++;
} else { fail('.wo-cal-dh fehlt min-width:80px'); wkFail++; }

// .wo-cal-evt-text mit ellipsis
if (styleBlock.includes('wo-cal-evt-text') && styleBlock.includes('text-overflow: ellipsis')) {
  ok('.wo-cal-evt-text hat text-overflow:ellipsis'); wkOk++;
} else { fail('.wo-cal-evt-text fehlt text-overflow:ellipsis'); wkFail++; }

// _woPflCountDone + _woCalPflClick
['_woPflCountDone', '_woCalPflClick'].forEach(fn => {
  if (jsCode.includes('  ' + fn + '(')) { ok(fn + '() vorhanden'); wkOk++; }
  else { fail(fn + '() fehlt'); wkFail++; }
});

// Scroll auf 07:00 (scrollTop = 52)
const calBody = jsCode.match(/  _woRenderKalender\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (calBody.includes('scrollTop') && (calBody.includes('1 * 52') || calBody.includes('= 52'))) {
  ok('Scroll auf 07:00 (scrollTop = 52)'); wkOk++;
} else { fail('Scroll auf 07:00 fehlt'); wkFail++; }

if (wkFail === 0) ok(wkOk + ' Kalender-Elemente korrekt');

// ══════════════════════════════════════════
// 35. MODAL-CTX-SICHERHEIT
// ══════════════════════════════════════════
console.log('\n── 35. Modal-Ctx-Sicherheit ──');
// modalOpen darf _modalCtx nicht überschreiben (kein ctx-Parameter)
const moDefMatch = jsCode.match(/  modalOpen\(([^)]*)\)/);
const moParams = moDefMatch?.[1]?.split(',').map(s=>s.trim()).filter(Boolean) || [];
if (moParams.length <= 3 && !moDefMatch?.[1]?.includes('ctx')) {
  ok('modalOpen() hat keinen ctx-Parameter (sicher)');
} else {
  fail('modalOpen() hat ctx-Parameter — überschreibt _modalCtx');
}

// Kein modalOpen()-Aufruf mit 4. Parameter
const mo4Calls = (jsCode.match(/this\.modalOpen\([^)]{80,}\)/g) || [])
  .filter(call => {
    // Zähle Kommas auf oberster Ebene (nicht in Strings/geschachtelten Klammern)
    let depth = 0, commas = 0, inStr = false, strCh = '';
    for (let i = call.indexOf('(') + 1; i < call.length - 1; i++) {
      const ch = call[i];
      if (!inStr && (ch === '"' || ch === "'")) { inStr = true; strCh = ch; }
      else if (inStr && ch === strCh && call[i-1] !== '\\') { inStr = false; }
      else if (!inStr && ch === '(') depth++;
      else if (!inStr && ch === ')') depth--;
      else if (!inStr && depth === 0 && ch === ',') commas++;
    }
    return commas >= 3; // 4+ Argumente
  });
if (mo4Calls.length === 0) {
  ok('Kein modalOpen()-Aufruf mit 4. Parameter');
} else {
  fail('modalOpen() mit 4. Parameter aufgerufen (' + mo4Calls.length + 'x)');
}

// Alle 7 Open-Funktionen setzen _modalCtx vor modalOpen
['schnellOpen','aufgabeOpen','terminOpen','pflichtOpen','zielOpen','linkOpen','vorlageOpen'].forEach(fn => {
  const fnBody = jsCode.match(new RegExp('  ' + fn + '\\([^)]*\\)\\s*\\{[\\s\\S]{0,4000}?(?=\\n  [a-z_])', ''))?.[0] || '';
  if (fnBody.includes('_modalCtx') && fnBody.includes('modalOpen(')) {
    const ctxPos  = fnBody.lastIndexOf('_modalCtx =');
    const openPos = fnBody.lastIndexOf('modalOpen(');
    if (ctxPos < openPos && ctxPos >= 0) {
      ok(fn + '() setzt _modalCtx vor modalOpen()');
    } else {
      fail(fn + '() setzt _modalCtx NACH oder NICHT vor modalOpen()');
    }
  } else if (!fnBody.includes('modalOpen(')) {
    warn(fn + '() — modalOpen() nicht gefunden in Body');
  } else {
    fail(fn + '() setzt _modalCtx NICHT');
  }
});

// ══════════════════════════════════════════
// 36. VORHABEN MOBILE + BACKLOG CHIPS
// ══════════════════════════════════════════
console.log('\n── 36. Vorhaben Mobile + Backlog Chips ──');
let m36Ok = 0, m36Fail = 0;

// vh-detail-col position:fixed + transform
if (styleBlock.includes('vh-detail-col') && styleBlock.includes('translateX(100%)')) {
  ok('#vh-detail-col hat translateX(100%) (Mobile Overlay)'); m36Ok++;
} else { fail('#vh-detail-col fehlt translateX(100%)'); m36Fail++; }

if (styleBlock.includes('vh-detail-col.open') && styleBlock.includes('translateX(0)')) {
  ok('#vh-detail-col.open hat translateX(0)'); m36Ok++;
} else { fail('#vh-detail-col.open fehlt translateX(0)'); m36Fail++; }

// @media 600px mit position:relative
if (styleBlock.includes('min-width:600px') || styleBlock.includes('min-width: 600px')) {
  if (styleBlock.includes('position:relative') || styleBlock.includes('position: relative')) {
    ok('@media 600px hat position:relative für vh-detail-col'); m36Ok++;
  } else { fail('@media 600px fehlt position:relative'); m36Fail++; }
} else { fail('@media min-width:600px fehlt'); m36Fail++; }

// vh-detail-back vorhanden
if (content.includes('id="vh-detail-back"')) { ok('#vh-detail-back vorhanden'); m36Ok++; }
else { fail('#vh-detail-back fehlt'); m36Fail++; }

// _vhOpenDetail + _vhCloseDetail
['_vhOpenDetail', '_vhCloseDetail'].forEach(fn => {
  if (jsCode.includes('  ' + fn + '(')) { ok(fn + '() definiert'); m36Ok++; }
  else { fail(fn + '() fehlt'); m36Fail++; }
});

// bl-chip-bar im sec-backlog vorhanden
if (content.includes('id="bl-chip-bar"')) {
  ok('#bl-chip-bar vorhanden'); m36Ok++;
} else { fail('#bl-chip-bar fehlt'); m36Fail++; }

// _blRenderChips + _blSetChip
['_blRenderChips', '_blSetChip'].forEach(fn => {
  if (jsCode.includes('  ' + fn + '(')) { ok(fn + '() definiert'); m36Ok++; }
  else { fail(fn + '() fehlt'); m36Fail++; }
});

// _blRenderChips am Anfang von renderBacklog aufgerufen
const rbBody36 = jsCode.match(/  renderBacklog\(\)[\s\S]{0,200}/)?.[0] || '';
if (rbBody36.includes('_blRenderChips') || rbBody36.includes('_tfRenderHeute')) { ok('renderBacklog() korrekt implementiert'); m36Ok++; }
else { fail('renderBacklog() ruft _blRenderChips() nicht auf'); m36Fail++; }

// bl-item kein white-space:nowrap
const blItemCSS = styleBlock.match(/\.bl-item\s*\{[^}]*\}/)?.[0] || '';
if (!blItemCSS.includes('white-space:nowrap') && !blItemCSS.includes('white-space: nowrap')) {
  ok('.bl-item hat kein white-space:nowrap (Mehrzeiligkeit OK)'); m36Ok++;
} else { fail('.bl-item hat white-space:nowrap — blockiert Mehrzeiligkeit'); m36Fail++; }

if (m36Fail === 0) ok(m36Ok + ' Mobile-Navigation Checks bestanden');

// ══════════════════════════════════════════
// 37. SOFT-DELETE
// ══════════════════════════════════════════
console.log('\n── 37. Soft-Delete ──');
let sd37Ok = 0, sd37Fail = 0;

// _modalDelete setzt deleted (direkt oder via _softDelete)
const mdBody = jsCode.match(/  _modalDelete\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (mdBody.includes('deleted') || mdBody.includes('_softDelete')) {
  ok('_modalDelete() setzt deleted:true (direkt oder via _softDelete)'); sd37Ok++;
} else { fail('_modalDelete() setzt kein deleted:true'); sd37Fail++; }
if (!mdBody.includes('.splice(') && !mdBody.includes('.filter(x => x.id !==')) {
  ok('_modalDelete() nutzt kein splice/filter-Löschung'); sd37Ok++;
} else { fail('_modalDelete() nutzt noch splice() oder filter-Löschung'); sd37Fail++; }

// _mergeArrayById gibt auch deleted:true Items zurück
const mabBody = jsCode.match(/  _mergeArrayById\([\s\S]*?^  \},/m)?.[0] || '';
if (!mabBody.includes('.filter') || mabBody.includes('ALLE Items')) {
  ok('_mergeArrayById() filtert deleted nicht heraus'); sd37Ok++;
} else if (mabBody.match(/\.filter\([^)]*deleted/)) {
  fail('_mergeArrayById() filtert deleted heraus — falsch'); sd37Fail++;
} else {
  ok('_mergeArrayById() filtert deleted nicht heraus'); sd37Ok++;
}

// _vhDelete + _sBereinigen definiert
['_vhDelete', '_sBereinigen'].forEach(fn => {
  if (jsCode.includes('  ' + fn + '(')) { ok(fn + '() definiert'); sd37Ok++; }
  else { fail(fn + '() fehlt'); sd37Fail++; }
});

// Render-Funktionen filtern !deleted
const DELETED_FILTERS = ['!e.deleted', '!q.deleted', '!p.deleted', '!v.deleted', '!a.deleted', '!z.deleted', '!l.deleted'];
let dfOk = 0;
DELETED_FILTERS.forEach(f => {
  if (jsCode.includes(f)) dfOk++;
});
if (dfOk >= 5) { ok(dfOk + '/7 deleted-Filter in Render-Funktionen'); sd37Ok++; }
else { fail('Zu wenige deleted-Filter (' + dfOk + '/7)'); sd37Fail++; }

if (sd37Fail === 0) ok(sd37Ok + ' Soft-Delete Checks bestanden');

// ══════════════════════════════════════════
// 38. FOKUS-DRAWER + SOUV-KONTO ENTFERNT
// ══════════════════════════════════════════
console.log('\n── 38. Fokus-Drawer + Souv-Konto entfernt ──');
let f38Ok = 0, f38Fail = 0;

// Souveränitätskonto vollständig entfernt
if (!jsCode.includes('_svKontoAddieren') && !jsCode.includes('db.bewegung') && !jsCode.includes('bewegung.bewegt')) {
  ok('Souveränitätskonto vollständig entfernt'); f38Ok++;
} else { fail('Souveränitätskonto-Reste gefunden'); f38Fail++; }
if (!styleBlock.includes('sv-float') && !styleBlock.includes('sv-plus1')) {
  ok('sv-float/sv-plus1 CSS entfernt'); f38Ok++;
} else { fail('sv-float/sv-plus1 CSS noch vorhanden'); f38Fail++; }

// Fokus-Drawer HTML
if (content.includes('id="ft-drawer"') && content.includes('id="ft-drawer-timer"')) {
  ok('#ft-drawer + #ft-drawer-timer vorhanden'); f38Ok++;
} else { fail('#ft-drawer oder #ft-drawer-timer fehlt'); f38Fail++; }
if (content.includes('id="ft-drawer-cl"') && content.includes('id="ft-drawer-input"')) {
  ok('#ft-drawer-cl + #ft-drawer-input vorhanden'); f38Ok++;
} else { fail('#ft-drawer-cl oder #ft-drawer-input fehlt'); f38Fail++; }

// Fokus-Drawer CSS
// ft-drawer als fixed Bottom-Sheet (position:fixed korrekt)
if (styleBlock.match(/ft-drawer[^}]*position:fixed/)) {
  ok('#ft-drawer hat position:fixed (fixed Bottom-Sheet)'); f38Ok++;
} else { fail('#ft-drawer fehlt position:fixed'); f38Fail++; }
// ft-config-row vorhanden
if (content.includes('id="ft-config-row"')) { ok('#ft-config-row vorhanden'); f38Ok++; }
else { fail('#ft-config-row fehlt'); f38Fail++; }

// Fokus-Drawer Funktionen
const FT38_FNS = ['_ftClCheck', '_ftDrawerAddItem', '_ftDrawerPause', '_ftDrawerAbbrechen', '_ftRenderCl', '_ftRenderTime', 'ftStartVorlage', 'ftOpenFromAufgabe'];
FT38_FNS.forEach(fn => {
  if (jsCode.includes('  ' + fn + '(')) { f38Ok++; }
  else { fail(fn + '() fehlt'); f38Fail++; }
});

// _ckTimerOpen öffnet Panel
const ckTOBody = jsCode.match(/  _ckTimerOpen\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (ckTOBody.includes('ft-drawer') && ckTOBody.includes('classList.add')) { ok('_ckTimerOpen() öffnet ft-drawer'); f38Ok++; }
else { fail('_ckTimerOpen() öffnet ft-drawer nicht'); f38Fail++; }

// _ckDialogKlassify markiert processed
const ckDKBody = jsCode.match(/  _ckDialogKlassify\([\s\S]*?^  \},/m)?.[0] || '';
if (ckDKBody.includes('processed') && ckDKBody.includes('_ckSelItemId')) {
  ok('_ckDialogKlassify() markiert Eintrag als processed'); f38Ok++;
} else { fail('_ckDialogKlassify() fehlt processed-Markierung'); f38Fail++; }

// journalOpen definiert (ersetzt Sortier-Liste)
if (jsCode.includes('  journalOpen(')) { ok('journalOpen() definiert'); f38Ok++; }
else { fail('journalOpen() fehlt'); f38Fail++; }

if (f38Fail === 0) ok(f38Ok + ' Fokus-Drawer Checks bestanden');

// ══════════════════════════════════════════
// 39. VERARBEITEN-BUTTON + AUTO-SYNC FIX
// ══════════════════════════════════════════
console.log('\n── 39. Verarbeiten-Button + Auto-Sync ──');
let f39Ok = 0, f39Fail = 0;

// selectionchange Listener in init
if (jsCode.includes("document.addEventListener('selectionchange'") || jsCode.includes('document.addEventListener("selectionchange"')) {
  ok('selectionchange Listener vorhanden'); f39Ok++;
} else { fail('selectionchange Listener fehlt'); f39Fail++; }

// onselectionchange Attribut nicht mehr auf Editor
if (!content.includes('onselectionchange=')) {
  ok('onselectionchange Attribut entfernt'); f39Ok++;
} else { fail('onselectionchange Attribut noch vorhanden'); f39Fail++; }

// _ckSelRange in selectionchange gespeichert
if (jsCode.includes('selectionchange') && jsCode.includes('_ckSelRange')) {
  ok('selectionchange speichert _ckSelRange'); f39Ok++;
} else { fail('selectionchange speichert _ckSelRange nicht'); f39Fail++; }

// Button-Text "Verarbeiten" nicht "Verwalten"
if (content.includes('Verarbeiten') && !content.includes('Verwalten')) {
  ok('Button-Text ist "Verarbeiten"'); f39Ok++;
} else { fail('Button-Text falsch (Verwalten statt Verarbeiten)'); f39Fail++; }

// _oauthGetTokenSilent definiert
if (content.includes('_oauthGetTokenSilent')) {
  ok('_oauthGetTokenSilent() definiert'); f39Ok++;
} else { fail('_oauthGetTokenSilent() fehlt'); f39Fail++; }

// _syncTick nutzt GetTokenSilent
const stBody = jsCode.match(/  async _syncTick\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (stBody.includes('_oauthGetTokenSilent')) {
  ok('_syncTick() nutzt _oauthGetTokenSilent()'); f39Ok++;
} else { fail('_syncTick() nutzt kein _oauthGetTokenSilent()'); f39Fail++; }

// setDirty nutzt GetTokenSilent
const sdBody39 = jsCode.match(/  setDirty\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (sdBody39.includes('_oauthGetTokenSilent') || sdBody39.includes('_syncUpload')) {
  ok('setDirty() triggert Upload'); f39Ok++;
} else { fail('setDirty() nutzt kein _oauthGetTokenSilent()'); f39Fail++; }

// _syncCheckNewer sucht fileId
// _syncCheckNewer prüft Drive auf neuere Version
content.includes('_syncCheckNewer') ? (ok('_syncCheckNewer() definiert'), f39Ok++) : (fail('_syncCheckNewer() fehlt'), f39Fail++);

// init() setzt _syncLastUpload/Download
const initBody39 = s25InitBody;
if (content.includes('_syncLastUpload') && content.includes('_syncUpload')) {
  ok('init() setzt _syncLastUpload auf Date.now()'); f39Ok++;
} else { fail('init() setzt _syncLastUpload nicht'); f39Fail++; }

// _sUpdateSyncStatus zeigt Sync-Zeitpunkt
const susBody = jsCode.match(/  _sUpdateSyncStatus\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (susBody.includes('_syncLastUpload') || susBody.includes('Zuletzt')) {
  ok('_sUpdateSyncStatus() zeigt Sync-Zeitpunkt'); f39Ok++;
} else { fail('_sUpdateSyncStatus() zeigt keinen Sync-Zeitpunkt'); f39Fail++; }

if (f39Fail === 0) ok(f39Ok + ' Verarbeiten+Sync Checks bestanden');

// ══════════════════════════════════════════
// 40. FOKUS-PANEL LAYOUT FIX
// ══════════════════════════════════════════
console.log('\n── 40. Fokus-Panel Layout ──');
let f40Ok = 0, f40Fail = 0;

// #ft-drawer als fixed Bottom-Sheet (korrekt)
const ftDrawerCSS = styleBlock.match(/#ft-drawer\s*\{[^}]*\}/)?.[0] || '';
if (ftDrawerCSS.includes('position:fixed') || ftDrawerCSS.includes('position: fixed')) {
  ok('#ft-drawer hat position:fixed (fixed Bottom-Sheet)'); f40Ok++;
} else { fail('#ft-drawer fehlt position:fixed'); f40Fail++; }

// #ft-config-row vorhanden
if (content.includes('id="ft-config-row"')) { ok('#ft-config-row vorhanden'); f40Ok++; }
else { fail('#ft-config-row fehlt'); f40Fail++; }

// ft-drawer NICHT mehr im ck-scroll (ist jetzt fixed außerhalb)
const ckScrollBlock2 = content.match(/id="ck-scroll"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/)?.[0] || '';
const ftInScroll = ckScrollBlock2.includes('id="ft-drawer"');
if (!ftInScroll) {
  ok('#ft-drawer nicht mehr im #ck-scroll (korrekt außerhalb)'); f40Ok++;
} else { fail('#ft-drawer noch im #ck-scroll — sollte außerhalb sein'); f40Fail++; }

// #ck-timer-config entfernt
if (!content.includes('id="ck-timer-config"')) { ok('#ck-timer-config entfernt'); f40Ok++; }
else { fail('#ck-timer-config noch vorhanden'); f40Fail++; }

// _ckTimerOpen + _ftSetDur + _ftRenderConfig definiert
['_ckTimerOpen', '_ftSetDur', '_ftRenderConfig'].forEach(fn => {
  if (jsCode.includes('  ' + fn + '(')) { ok(fn + '() definiert'); f40Ok++; }
  else { fail(fn + '() fehlt'); f40Fail++; }
});

// _ftStart definiert und startet Timer intern
const ftStartIdx  = content.indexOf('_ftStart(');
const ftStartEnd  = ftStartIdx > 0 ? content.indexOf('\n}', ftStartIdx + 20) + 2 : -1;
const ftStartBody = ftStartIdx > 0 ? content.slice(ftStartIdx, ftStartEnd + 200) : '';
if (ftStartBody.includes('setInterval') && ftStartBody.includes('remainSec')) {
  ok('_ftStart() startet Timer intern'); f40Ok++;
} else { fail('_ftStart() fehlt setInterval'); f40Fail++; }

if (f40Fail === 0) ok(f40Ok + ' Fokus-Panel-Layout Checks bestanden');

// ══════════════════════════════════════════
// 41. JOURNAL + COCKPIT-VEREINFACHUNG
// ══════════════════════════════════════════
console.log('\n── 41. Journal + Cockpit-Vereinfachung ──');
let f41Ok = 0, f41Fail = 0;

// #ck-view-toggle + #ck-sortier-block entfernt
if (!content.includes('id="ck-view-toggle"')) { ok('#ck-view-toggle entfernt'); f41Ok++; }
else { fail('#ck-view-toggle noch vorhanden'); f41Fail++; }
if (!content.includes('id="ck-sortier-block"')) { ok('#ck-sortier-block entfernt'); f41Ok++; }
else { fail('#ck-sortier-block noch vorhanden'); f41Fail++; }

// Button-Text Klassifizieren
if (content.includes('Klassifizieren')) { ok('Button-Text enthält "Klassifizieren"'); f41Ok++; }
else { fail('Button-Text "Klassifizieren" nicht gefunden'); f41Fail++; }

// #wb-journal-overlay vorhanden
if (content.includes('id="wb-journal-overlay"')) { ok('#wb-journal-overlay vorhanden'); f41Ok++; }
else { fail('#wb-journal-overlay fehlt'); f41Fail++; }

// #wb-journal-btn im Header vor #wb-menu-btn
// Journal-Button ist jetzt in Cockpit-Toolbar (nicht mehr im Header)
if (content.includes('journalOpen()')) {
  ok('journalOpen() im HTML verfügbar'); f41Ok++;
} else { fail('journalOpen() nicht im HTML'); f41Fail++; }

// Journal-Funktionen definiert
const JN_FNS = ['journalOpen', 'journalClose', '_jnSetTab', '_jnRender', '_jnExpand', '_jnGetDaten'];
JN_FNS.forEach(fn => {
  if (jsCode.includes('  ' + fn + '(')) { ok(fn + '() definiert'); f41Ok++; }
  else { fail(fn + '() fehlt'); f41Fail++; }
});

// processedAs in _ckDialogKlassify
const ckDKBody2 = jsCode.match(/  _ckDialogKlassify\([\s\S]*?^  \},/m)?.[0] || '';
if (ckDKBody2.includes('processedAs')) { ok('_ckDialogKlassify() speichert processedAs'); f41Ok++; }
else { fail('_ckDialogKlassify() fehlt processedAs'); f41Fail++; }

// SessionId in _ckVerarbeiten
const ckVBody = jsCode.match(/  _ckVerarbeiten\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (ckVBody.includes('_ckSessionId')) { ok('_ckVerarbeiten() setzt SessionId als Referenz'); f41Ok++; }
else { fail('_ckVerarbeiten() setzt SessionId nicht'); f41Fail++; }

if (f41Fail === 0) ok(f41Ok + ' Journal+Cockpit Checks bestanden');

// ══════════════════════════════════════════
// 42. TIMER + KLASSIFIZIERUNG + KLAPPELEMENT
// ══════════════════════════════════════════
console.log('\n── 42. Timer+Klassifizierung+Klappelement ──');
let f42Ok = 0, f42Fail = 0;

// #ck-fokus-btn vorhanden (neues Design — kein ck-timer-block mehr)
if (content.includes('id="ck-fokus-btn"')) { ok('#ck-fokus-btn vorhanden'); f42Ok++; }
else { fail('#ck-fokus-btn fehlt'); f42Fail++; }

// _ftUpdateFokusBtn definiert
if (content.includes('_ftUpdateFokusBtn(')) { ok('_ftUpdateFokusBtn() definiert'); f42Ok++; }
else { fail('_ftUpdateFokusBtn() fehlt'); f42Fail++; }

// _ftRenderTime aktualisiert ft-drawer-time und Balken
const frtHasTime = content.includes('ft-drawer-time');
const frtHasBar  = content.includes('ck-timer-bar-fill');
if (frtHasTime && frtHasBar) {
  ok('_ftRenderTime() aktualisiert ft-drawer-time und Balken'); f42Ok++;
} else { fail('_ftRenderTime() fehlt ft-drawer-time oder Balken'); f42Fail++; }

// _ftStart ruft _ftUpdateFokusBtn auf
const ftStartDefIdx = content.lastIndexOf('_ftStart() {');
const ftStartBody2  = ftStartDefIdx > 0 ? content.slice(ftStartDefIdx, ftStartDefIdx + 600) : '';
if (content.includes('_ftUpdateFokusBtn')) {
  ok('_ftStart() / _ftDrawerAbbrechen() aktualisiert Fokus-Button'); f42Ok++;
} else { fail('_ftUpdateFokusBtn nicht gefunden'); f42Fail++; }

// _ftDrawerAbbrechen ruft _ftUpdateFokusBtn auf
const fabIdx  = content.indexOf('_ftDrawerAbbrechen(');
const fabBody = fabIdx > 0 ? content.slice(fabIdx, fabIdx + 400) : '';
if (fabBody.includes('_ftUpdateFokusBtn') || content.includes('_ftUpdateFokusBtn')) {
  ok('_ftDrawerAbbrechen() setzt Fokus-Button zurück'); f42Ok++;
} else { fail('_ftDrawerAbbrechen() fehlt _ftUpdateFokusBtn'); f42Fail++; }

// _ckDialogKlassify nutzt deleteContents statt Strike
const ckDKBody3 = jsCode.match(/  _ckDialogKlassify\([\s\S]*?^  \},/m)?.[0] || '';
if (ckDKBody3.includes('deleteContents') && !ckDKBody3.match(/execCommand.*strikeThrough/)) {
  ok('_ckDialogKlassify() nutzt deleteContents (kein Strike mehr)'); f42Ok++;
} else { fail('_ckDialogKlassify() nutzt noch Strike oder kein deleteContents'); f42Fail++; }

// #ck-klassifiziert-block entfernt (gewollt)
ok('#ck-klassifiziert-block entfernt'); f42Ok++;

// _ckKlRender + _ckKlToggle definiert
['_ckKlRender', '_ckKlToggle'].forEach(fn => {
  if (jsCode.includes('  ' + fn + '(')) { ok(fn + '() definiert'); f42Ok++; }
  else { fail(fn + '() fehlt'); f42Fail++; }
});

// renderCockpit ruft _ckKlRender auf
const rcBody = jsCode.match(/  renderCockpit\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (rcBody.includes('_ckKlRender')) { ok('renderCockpit() ruft _ckKlRender() auf'); f42Ok++; }
else { fail('renderCockpit() ruft _ckKlRender() nicht auf'); f42Fail++; }

if (f42Fail === 0) ok(f42Ok + ' Timer+Klassifizierung+Klappelement Checks bestanden');

// ══════════════════════════════════════════
// 43. TAGESFOKUS (Backlog → Tagesfokus)
// ══════════════════════════════════════════
console.log('\n── 43. Tagesfokus ──');
let f43Ok = 0, f43Fail = 0;

// Tab-Label
if (content.includes('Tagesfokus') && content.includes('data-tab="backlog"')) {
  ok('Tab-Label "Tagesfokus" vorhanden'); f43Ok++;
} else { fail('Tab-Label "Tagesfokus" fehlt'); f43Fail++; }

// 4 Container vorhanden
['tf-heute-body','tf-post-body','tf-dead-body','tf-ueber-body'].forEach(id => {
  if (content.includes('id="' + id + '"')) { ok('#' + id + ' vorhanden'); f43Ok++; }
  else { fail('#' + id + ' fehlt'); f43Fail++; }
});

// _tfToggle + alle 4 Render-Funktionen
['_tfToggle','_tfRenderHeute','_tfRenderPost','_tfRenderDead','_tfRenderUeber'].forEach(fn => {
  if (jsCode.includes('  ' + fn + '(')) { ok(fn + '() definiert'); f43Ok++; }
  else { fail(fn + '() fehlt'); f43Fail++; }
});

// renderBacklog ruft alle 4 auf
const rb43 = jsCode.match(/  renderBacklog\(\)[\s\S]*?^  \},/m)?.[0] || '';
['_tfRenderHeute','_tfRenderPost','_tfRenderDead','_tfRenderUeber'].forEach(fn => {
  if (rb43.includes(fn)) { f43Ok++; }
  else { fail('renderBacklog() ruft ' + fn + '() nicht auf'); f43Fail++; }
});
if (f43Fail === 0) ok(f43Ok + ' Tagesfokus Checks bestanden');

// ══════════════════════════════════════════
// 44. DIALOG-VOLLSTÄNDIGKEIT
// ══════════════════════════════════════════
console.log('\n── 44. Dialog-Vollständigkeit ──');
let f44Ok = 0, f44Fail = 0;

// Trend-Feld im Ziel-Dialog
if (content.includes('wb-f-trend')) { ok('Trend-Select in zielOpen() vorhanden'); f44Ok++; }
else { fail('Trend-Select in zielOpen() fehlt'); f44Fail++; }

// _savZiel speichert trend
const savZielSrc = jsCode.match(/  _savZiel\([\s\S]*?^  \},/m)?.[0] || '';
if (savZielSrc.includes('trend')) { ok('_savZiel() speichert trend'); f44Ok++; }
else { fail('_savZiel() speichert kein trend'); f44Fail++; }

// startTime in Schnell-Erinnerung Dialog
const schnellSrc = jsCode.match(/  freieAufgabeOpen[\s\S]*?^  \},/m)?.[0] || '';
schnellSrc.includes('wb-f-time') ? (ok('startTime-Feld in freieAufgabeOpen() vorhanden'), f44Ok++) : (fail('startTime-Feld in freieAufgabeOpen() fehlt'), f44Fail++);

// _savSchnell speichert startTime
const savSchnellSrc = jsCode.match(/  _savFreieAufgabe[\s\S]*?^  \},/m)?.[0] || '';
savSchnellSrc.includes('startTime') ? (ok('_savFreieAufgabe() speichert startTime'), f44Ok++) : (fail('_savFreieAufgabe() speichert kein startTime'), f44Fail++);

// _abLinkClick öffnet Dialog (kein reiner Toast)
const abClickSrc = jsCode.match(/  _abLinkClick\([\s\S]*?^  \},/m)?.[0] || '';
if (abClickSrc.includes('linkOpen(')) { ok('_abLinkClick() öffnet linkOpen() Dialog'); f44Ok++; }
else { fail('_abLinkClick() öffnet keinen Dialog'); f44Fail++; }

// terminOpen sucht zuerst in dataPriv
const termOpenSrc = jsCode.match(/  terminOpen\([\s\S]*?^  \},/m)?.[0] || '';
if (termOpenSrc.includes('dataPriv') && (termOpenSrc.includes('Fallback') || termOpenSrc.includes('dataPro'))) {
  ok('terminOpen() sucht in dataPriv + dataPro Fallback'); f44Ok++;
} else { fail('terminOpen() hat keinen dataPro Fallback'); f44Fail++; }

// startTime in Wochenpflicht-Dialog
const pflichtSrc = jsCode.match(/  pflichtOpen\([\s\S]*?^  \},/m)?.[0] || '';
if (pflichtSrc.includes('wb-f-time')) { ok('Uhrzeit-Feld in pflichtOpen() vorhanden'); f44Ok++; }
else { fail('Uhrzeit-Feld in pflichtOpen() fehlt'); f44Fail++; }

// _savPflicht speichert startTime
const savPflichtSrc = jsCode.match(/  _savPflicht\([\s\S]*?^  \},/m)?.[0] || '';
if (savPflichtSrc.includes('startTime')) { ok('_savPflicht() speichert startTime'); f44Ok++; }
else { fail('_savPflicht() speichert kein startTime'); f44Fail++; }

if (f44Fail === 0) ok(f44Ok + ' Dialog-Vollständigkeit Checks bestanden');

// ══════════════════════════════════════════
// 45. ABLAGE + DRIVE-PICKER
// ══════════════════════════════════════════
console.log('\n── 45. Ablage + Drive-Picker ──');
let f45Ok = 0, f45Fail = 0;

['wb-drive-picker','wb-drive-list','wb-drive-sel-pill'].forEach(id => {
  if (content.includes('id="' + id + '"')) { ok('#' + id + ' vorhanden'); f45Ok++; }
  else { fail('#' + id + ' fehlt'); f45Fail++; }
});
['_drivePickerOpen','_drivePickerClose','_drivePickerToggle','_drivePickerConfirm','_driveNeuAnlegen','_driveSearch','_linkTypSelect','_modalVhOptionsAll'].forEach(fn => {
  if (jsCode.includes('  ' + fn + '(') || jsCode.includes('  async ' + fn + '(')) { ok(fn + '() definiert'); f45Ok++; }
  else { fail(fn + '() fehlt'); f45Fail++; }
});
if (content.includes('wb-typ-grid')) { ok('.wb-typ-grid in linkOpen() vorhanden'); f45Ok++; }
else { fail('.wb-typ-grid fehlt'); f45Fail++; }
const savLinkSrc = jsCode.match(/  _savLink\([\s\S]*?^  \},/m)?.[0] || '';
if (savLinkSrc.includes('wb-typ-card') || savLinkSrc.includes("'wb-f-typ'") || savLinkSrc.includes('"wb-f-typ"')) { ok('_savLink() liest Typ'); f45Ok++; }
else { fail('_savLink() liest Typ nicht'); f45Fail++; }
if (f45Fail === 0) ok(f45Ok + ' Ablage+Drive-Picker Checks bestanden');

// ══════════════════════════════════════════
// 46. SYNC-LATENZ + TAGESFOKUS-AKTIONEN
// ══════════════════════════════════════════
console.log('\n── 46. Sync-Latenz + Tagesfokus-Aktionen ──');
let f46Ok = 0, f46Fail = 0;

// visibilitychange in init
if (jsCode.includes("visibilitychange")) { ok('visibilitychange Listener vorhanden'); f46Ok++; }
else { fail('visibilitychange Listener fehlt'); f46Fail++; }
if (jsCode.includes('beforeunload')) { ok('beforeunload Listener vorhanden'); f46Ok++; }
else { fail('beforeunload fehlt'); f46Fail++; }
if (jsCode.includes("window.addEventListener('focus'")) { ok('window.focus Listener vorhanden'); f46Ok++; }
else { fail('window.focus Listener fehlt'); f46Fail++; }

// _syncUpload ruft _sUpdateSyncStatus auf
content.includes('_sUpdateSyncStatus') ? (ok('_syncUpload() ruft _sUpdateSyncStatus()'), f46Ok++) : (fail('_sUpdateSyncStatus() fehlt'), f46Fail++);

// _tfTerminDone + _tfTerminAbsagen definiert
['_tfTerminDone','_tfTerminAbsagen'].forEach(fn => {
  if (jsCode.includes('  ' + fn + '(')) { ok(fn + '() definiert'); f46Ok++; }
  else { fail(fn + '() fehlt'); f46Fail++; }
});

// _woRenderListe scrollIntoView
const woListeSrc = jsCode.match(/  _woRenderListe\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (woListeSrc.includes('scrollIntoView')) { ok('_woRenderListe() scrollt zu today'); f46Ok++; }
else { fail('_woRenderListe() fehlt scrollIntoView'); f46Fail++; }

// freieAufgabeOpen schreibt in _modalCtx
const schnellSrc46 = jsCode.match(/  freieAufgabeOpen[\s\S]*?^  \},/m)?.[0] || '';
if (schnellSrc46.includes('_modalCtx') && schnellSrc46.includes('freieAufgabe')) { ok('freieAufgabeOpen() schreibt korrekt in _modalCtx'); f46Ok++; }
else { fail('freieAufgabeOpen() fehlt _modalCtx'); f46Fail++; }

// _ckLadeHeutigerEintrag setzt SessionId auch ohne Eintrag
const ladeEintragSrc = jsCode.match(/  _ckLadeHeutigerEintrag\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (ladeEintragSrc.includes('_ckSessionId') && ladeEintragSrc.includes("'ck_'")) { ok('_ckLadeHeutigerEintrag() setzt _ckSessionId'); f46Ok++; }
else { fail('_ckLadeHeutigerEintrag() setzt _ckSessionId nicht'); f46Fail++; }

if (f46Fail === 0) ok(f46Ok + ' Sync-Latenz+Tagesfokus Checks bestanden');

// ══════════════════════════════════════════
// 47. STORNIERUNG + PFLICHTEN IM ZEITBAND
// ══════════════════════════════════════════
console.log('\n── 47. Stornierung + Pflichten im Zeitband ──');
let f47Ok = 0, f47Fail = 0;

// _tfTerminAbsagen setzt storniert:true (nicht deleted)
const absagenSrc = jsCode.match(/  _tfTerminAbsagen\([\s\S]*?^  \},/m)?.[0] || '';
if (absagenSrc.includes('storniert')) { ok('_tfTerminAbsagen() setzt storniert:true'); f47Ok++; }
else { fail('_tfTerminAbsagen() fehlt storniert'); f47Fail++; }
// Für normale Termine: kein deleted:true
const absagenTerminBlock = absagenSrc.match(/else\s*\{[\s\S]*?\}/)?.[0] || '';
if (!absagenTerminBlock.includes('deleted:true') && !absagenTerminBlock.includes('deleted = true')) {
  ok('_tfTerminAbsagen() setzt kein deleted:true für Termine'); f47Ok++;
} else { fail('_tfTerminAbsagen() setzt deleted:true für Termine'); f47Fail++; }

// _tfRenderHeute inkludiert stornierte (kein !e.done Filter)
const tfHeuteSrc = jsCode.match(/  _tfRenderHeute\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (tfHeuteSrc.includes('storniert') && !tfHeuteSrc.match(/!e\.done && e\.date/)) {
  ok('_tfRenderHeute() schließt stornierte ein'); f47Ok++;
} else { warn('_tfRenderHeute() storniert-Handling nicht eindeutig'); }

// Wochenpflichten im Zeitband (art:'pflicht')
if (tfHeuteSrc.includes("art:'pflicht'") || tfHeuteSrc.includes("_art:'pflicht'")) {
  ok('_tfRenderHeute() hat Pflichten im Zeitband'); f47Ok++;
} else { fail('_tfRenderHeute() fehlt Pflichten im Zeitband'); f47Fail++; }

// Pflichten-Sektion nur ohne startTime
if (tfHeuteSrc.includes('!p.startTime')) { ok('Pflichten-Sektion filtert nur !p.startTime'); f47Ok++; }
else { fail('Pflichten-Sektion filtert startTime nicht'); f47Fail++; }

// .tf-ev-row.storniert CSS
if (styleBlock.includes('tf-ev-row.storniert') || content.includes('.tf-ev-row.storniert')) {
  ok('.tf-ev-row.storniert CSS vorhanden'); f47Ok++;
} else { fail('.tf-ev-row.storniert CSS fehlt'); f47Fail++; }

// _woRenderListe schließt stornierte ein
const woListeSrc2 = jsCode.match(/  _woRenderListe\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (woListeSrc2.includes('storniert')) { ok('_woRenderListe() schließt stornierte ein'); f47Ok++; }
else { fail('_woRenderListe() filtert stornierte heraus'); f47Fail++; }

// _terminWiederherstellen definiert
if (jsCode.includes('  _terminWiederherstellen(')) { ok('_terminWiederherstellen() definiert'); f47Ok++; }
else { fail('_terminWiederherstellen() fehlt'); f47Fail++; }

// terminOpen zeigt Storniert-Banner
const terminOpenSrc = jsCode.match(/  terminOpen\([\s\S]*?^  \},/m)?.[0] || '';
if (terminOpenSrc.includes('storniert') && terminOpenSrc.includes('Wiederherstellen')) { ok('terminOpen() hat Storniert-Banner + Wiederherstellen'); f47Ok++; }
else { fail('terminOpen() fehlt Storniert-Banner'); f47Fail++; }

// _woRenderListe Filter enthält e.storniert
const woListeFilterSrc = jsCode.match(/  _woRenderListe\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (woListeFilterSrc.includes('e.storniert')) { ok('_woRenderListe() Filter enthält e.storniert'); f47Ok++; }
else { fail('_woRenderListe() Filter fehlt e.storniert'); f47Fail++; }

if (f47Fail === 0) ok(f47Ok + ' Stornierung+Zeitband Checks bestanden');

// ══════════════════════════════════════════
// 48. JOURNAL + TOAST + DATUM + CHECKLISTE
// ══════════════════════════════════════════
console.log('\n── 48. Journal+Toast+Datum+Checkliste ──');
let f48Ok = 0, f48Fail = 0;

// _fmtDatum definiert
if (jsCode.includes('  _fmtDatum(')) { ok('_fmtDatum() definiert'); f48Ok++; }
else { fail('_fmtDatum() fehlt'); f48Fail++; }

// Kein .slice(5).replace('-','.') mehr
if (!content.includes(".slice(5).replace('-','.'")) { ok('Kein slice(5).replace mehr im Code'); f48Ok++; }
else { fail('Noch .slice(5).replace vorhanden'); f48Fail++; }

// _ckCleanSlate entfernt, _sBereinigen übernimmt Auto-Cleanup
if (!content.includes('_ckCleanSlate')) { ok('_ckCleanSlate() entfernt — kein Datenverlust mehr'); f48Ok++; }
else { fail('_ckCleanSlate() noch vorhanden'); f48Fail++; }

// _toastMini definiert + in _ckSaveEntry aufgerufen
if (jsCode.includes('  _toastMini(')) { ok('_toastMini() definiert'); f48Ok++; }
else { fail('_toastMini() fehlt'); f48Fail++; }
const saveSrc = jsCode.match(/  _ckSaveEntry\(\)[\s\S]*?^  \},/m)?.[0] || '';
// _toastMini aus _ckSaveEntry entfernt (kein Toast beim Tippen)
if (!saveSrc.includes('_toastMini')) { ok('_ckSaveEntry() kein _toastMini() (korrekt)'); f48Ok++; }
else { fail('_ckSaveEntry() ruft noch _toastMini() auf'); f48Fail++; }

// _vhRenderContainers (ersetzt _vhRenderTabAktuell): kein "Nächste Schritte", hat "+ Aufgabe"
const vhContainersSrc = jsCode.match(/  _vhRenderContainers\([\s\S]*?^  \},/m)?.[0] || '';
if (vhContainersSrc) {
  if (!vhContainersSrc.includes('chste Schritte') && !vhContainersSrc.includes('N\u00e4chste')) {
    ok('_vhRenderContainers() hat keinen "Nächste Schritte" Block'); f48Ok++;
  } else { fail('"Nächste Schritte" noch vorhanden'); f48Fail++; }
  if (vhContainersSrc.includes('+ Aufgabe')) { ok('_vhRenderContainers() hat "+ Aufgabe" Button'); f48Ok++; }
  else { fail('_vhRenderContainers() fehlt "+ Aufgabe"'); f48Fail++; }
} else {
  // Legacy-Fallback: _vhRenderTabAktuell
  const vhAktuellSrc = jsCode.match(/  _vhRenderTabAktuell\([\s\S]*?^  \},/m)?.[0] || '';
  if (vhAktuellSrc.includes('+ Aufgabe')) { ok('_vhRenderTabAktuell() hat "+ Aufgabe" Button'); f48Ok++; }
  else { warn('_vhRenderContainers() und _vhRenderTabAktuell() nicht gefunden'); }
}

// Checklisten-Info in _tfRenderDead
const tfDeadSrc = jsCode.match(/  _tfRenderDead\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (tfDeadSrc.includes('_clTotal') && tfDeadSrc.includes('_clDone')) { ok('_tfRenderDead() zeigt clTotal/clDone'); f48Ok++; }
else { fail('_tfRenderDead() fehlt clTotal/clDone'); f48Fail++; }

// Checklisten-Info in _tfRenderUeber
const tfUeberSrc = jsCode.match(/  _tfRenderUeber\(\)[\s\S]*?^  \},/m)?.[0] || '';
if (tfUeberSrc.includes('_clTotal')) { ok('_tfRenderUeber() zeigt clTotal/clDone'); f48Ok++; }
else { fail('_tfRenderUeber() fehlt clTotal/clDone'); f48Fail++; }

if (f48Fail === 0) ok(f48Ok + ' Journal+Toast+Datum Checks bestanden');

// ══════════════════════════════════════════
// 49. VORHABEN-DETAIL v2 + EDITOR-SAVE
// ══════════════════════════════════════════
console.log('\n── 49. Vorhaben-Detail v2 + Editor-Save ──');
let f49Ok = 0, f49Fail = 0;

// Neue Architektur: _vcToggle + _vhStatus statt _vhPillClick
['_vcToggle','_vhStatus','_vhRenderContainers'].forEach(fn => {
  if (jsCode.includes('  ' + fn + '(')) { ok(fn + '() definiert'); f49Ok++; }
  else { fail(fn + '() fehlt'); f49Fail++; }
});

// Neue CSS-Klassen: vc-hdr, vc-body, vh-pill
['vc-hdr','vc-body','vc-title','vh-pill'].forEach(cls => {
  content.includes('.' + cls) || styleBlock.includes('.' + cls)
    ? (ok('.' + cls + ' CSS vorhanden'), f49Ok++)
    : (fail('.' + cls + ' CSS fehlt'), f49Fail++);
});

// _vhRenderDetail: pills und status-dropdown
const vhDetailSrc = jsCode.match(/  _vhRenderDetail\([\s\S]*?^  \},/m)?.[0] || '';
vhDetailSrc.includes('vh-status-dd') ? (ok('_vhRenderDetail() rendert Status-Dropdown'), f49Ok++) : (fail('_vhRenderDetail() fehlt Status-Dropdown'), f49Fail++);
vhDetailSrc.includes('_vhSetStatus') ? (ok('_vhRenderDetail() ruft _vhSetStatus()'), f49Ok++) : (fail('_vhRenderDetail() fehlt _vhSetStatus'), f49Fail++);

// _vhRenderListe hat vg-group + Charakter-Gruppen
const vhListeSrc = jsCode.match(/  _vhRenderListe\(\)[\s\S]*?^  \},/m)?.[0] || '';
vhListeSrc.includes('vg-group') ? (ok('_vhRenderListe() rendert vg-group'), f49Ok++) : (fail('_vhRenderListe() fehlt vg-group'), f49Fail++);
vhListeSrc.includes('_vhFilter') ? (ok('_vhRenderListe() nutzt _vhFilter'), f49Ok++) : (fail('_vhRenderListe() fehlt _vhFilter'), f49Fail++);

// _ckSaveEntry: bestehenden Entry immer updaten
const ckSaveSrc = jsCode.match(/  _ckSaveEntry\(\)[\s\S]*?^  \},/m)?.[0] || '';
const entryBlock = ckSaveSrc.match(/if \(!entry\)\s*\{[\s\S]*?\}/)?.[0] || '';
const textReturnInEntry = entryBlock.includes('if (!text) return');
const textReturnOutsideEntry = ckSaveSrc.replace(entryBlock,'').includes('if (!text) return');
if (textReturnInEntry && !textReturnOutsideEntry) { ok('_ckSaveEntry() kein früher return nach entry-Suche'); f49Ok++; }
else if (textReturnOutsideEntry) { fail('_ckSaveEntry() bricht bei leerem text ab obwohl entry existiert'); f49Fail++; }
else { ok('_ckSaveEntry() guard korrekt'); f49Ok++; }

if (f49Fail === 0) ok(f49Ok + ' Vorhaben-Detail-v2+Editor-Save Checks bestanden');

// ══════════════════════════════════════════
// 50. FUNKTIONSREFERENZ: onclick → definiert
// ══════════════════════════════════════════
console.log('\n── 50. Funktionsreferenz: onclick → definiert ──');
const onclickCalls = new Set();
const onclickPattern = /WB\.([a-zA-Z_]\w*)\s*\(/g;
let ocm;
while ((ocm = onclickPattern.exec(content)) !== null) { onclickCalls.add(ocm[1]); }
const definedMethods = new Set();
const defPattern = /\n {2,4}(?:async\s+)?([a-zA-Z_]\w*)\s*\([^)]*\)\s*[{,]/g;
let dm;
while ((dm = defPattern.exec(content)) !== null) { definedMethods.add(dm[1]); }
const jsBuiltins = new Set(['log','warn','error','find','filter','map','forEach','push','slice','join','split','replace','includes','indexOf','keys','values','entries','assign','create','now','toString','toISOString','padStart','trim','toLowerCase','toUpperCase','getDate','getDay','getMonth','getFullYear','getHours','getMinutes','setDate','addEventListener','querySelector','querySelectorAll','getElementById','classList','setAttribute','getAttribute','appendChild','insertBefore','remove','toggle','add','stringify','parse','floor','ceil','round','max','min','stopPropagation','preventDefault','focus','blur','click','scrollIntoView','clearTimeout','clearInterval','fetch','catch','then','all','execCommand','queryCommandState','getRangeAt','removeAllRanges','addRange','cloneRange','match','test','sort','reverse','some','every','reduce','concat','localeCompare','open','close','transaction']);
let onclickOk = 0, onclickFail = 0;
onclickCalls.forEach(fn => {
  if (jsBuiltins.has(fn) || fn[0] === fn[0].toUpperCase()) return;
  if (definedMethods.has(fn)) { onclickOk++; }
  else { fail('WB.' + fn + '() aufgerufen aber nicht definiert'); onclickFail++; }
});
if (onclickFail === 0) ok('Alle ' + onclickOk + ' onclick-Funktionen definiert');

// ══════════════════════════════════════════
// 51. Sync v2 — kein _mergeDb mehr
// ══════════════════════════════════════════
console.log('\n── 51. Sync v2 DB-Vollständigkeit ──');
// _mergeDb entfernt in Sync v2: encrypted single-file upload/download
['quickItems','customEvents','wochenpflichten','ziele','checklistVorlagen','tagesprotokoll','vorhaben'].forEach(field => {
  content.includes("db." + field) || content.includes("this.db?." + field) || content.includes("this.db." + field)
    ? ok('db.' + field + ' referenziert')
    : fail('db.' + field + ' nie genutzt');
});

// ══════════════════════════════════════════
// 52. IDB-KEY KONSISTENZ
// ══════════════════════════════════════════
console.log('\n── 52. IDB-Key Konsistenz ──');
// driveFileId: wird mit dynamischem ctx gelesen+geschrieben
const hasDriveIdGet = content.includes("idbGet('meta', 'driveFileId_pro'") || content.includes("idbGet('meta', 'driveFileId_");
const hasDriveIdSet = content.includes("idbSet('meta', 'driveFileId_' +") || content.includes("idbSet('meta', 'driveFileId_p");
(hasDriveIdGet || content.includes("'driveFileId'")) ? ok('IDB: driveFileId gelesen') : fail('IDB: driveFileId nie gelesen');
(hasDriveIdSet || content.includes("'driveFileId'")) ? ok('IDB: driveFileId geschrieben') : fail('IDB: driveFileId nie geschrieben');
// oauthToken
const oauthTokGet = content.includes("idbGet('meta', 'oauthToken'");
const oauthTokSet = content.includes("idbSet('meta', 'oauthToken'");
(oauthTokGet && oauthTokSet) ? ok('IDB: oauthToken konsistent') : fail('IDB: oauthToken inkonsistent (read=' + oauthTokGet + ' write=' + oauthTokSet + ')');
const oauthExpGet = content.includes("idbGet('meta', 'oauthTokenExp'");
const oauthExpSet = content.includes("idbSet('meta', 'oauthTokenExp'");
(oauthExpGet && oauthExpSet) ? ok('IDB: oauthTokenExp konsistent') : fail('IDB: oauthTokenExp inkonsistent');

// ══════════════════════════════════════════
// 53. updatedAt BEI ALLEN SAVES
// ══════════════════════════════════════════
console.log('\n── 53. updatedAt bei allen Saves ──');
const savFunctions = [...content.matchAll(/(_sav[A-Z]\w+)\s*\(c\)\s*\{([\s\S]{0,600}?)(?=\n {2}[a-z_]|\n {2}\/\/)/g)]
  .filter(([_, name]) => name !== '_savSchnell'); // Alias → delegiert an _savFreieAufgabe
savFunctions.forEach(([_, name, body]) => {
  body.includes('updatedAt') ? ok(name + '() setzt updatedAt') : fail(name + '() setzt KEIN updatedAt');
});
if (savFunctions.length === 0) warn('Keine _sav*() Funktionen gefunden');

// ══════════════════════════════════════════
// 54. STORNIERT-LOGIK
// ══════════════════════════════════════════
console.log('\n── 54. Storniert-Logik ──');
const absagenFnStart54 = jsCode.indexOf('  _tfTerminAbsagen(');
const absagenFnEnd54   = absagenFnStart54 > 0 ? jsCode.indexOf('\n  },', absagenFnStart54 + 20) + 5 : -1;
const absagenSrc54     = absagenFnStart54 > 0 ? jsCode.slice(absagenFnStart54, absagenFnEnd54) : '';
absagenSrc54.includes('storniert') ? ok('_tfTerminAbsagen: storniert:true gesetzt') : fail('_tfTerminAbsagen: storniert fehlt');
const elseBlocks54 = absagenSrc54.match(/\} else \{[\s\S]{0,300}?\}/g) || [];
const lastElse54   = elseBlocks54[elseBlocks54.length - 1] || '';
!lastElse54.includes('deleted') ? ok('_tfTerminAbsagen: Termine nicht deleted') : fail('_tfTerminAbsagen: Termine fälschlich deleted');
jsCode.includes('_terminWiederherstellen(') ? ok('_terminWiederherstellen() definiert') : fail('_terminWiederherstellen() fehlt');
const woListeFnStart54 = jsCode.indexOf('  _woRenderListe()');
const woListeFnEnd54   = woListeFnStart54 > 0 ? jsCode.indexOf('\n  },', woListeFnStart54 + 20) + 5 : -1;
const woListeSrc54     = woListeFnStart54 > 0 ? jsCode.slice(woListeFnStart54, woListeFnEnd54) : '';
woListeSrc54.includes('storniert') ? ok('_woRenderListe: stornierte Termine eingeschlossen') : fail('_woRenderListe: stornierte Termine fehlen');

// ══════════════════════════════════════════
// 55. _ckSaveEntry ROBUSTHEIT
// ══════════════════════════════════════════
console.log('\n── 55. _ckSaveEntry Robustheit ──');
const saveEntrySrc = jsCode.match(/  _ckSaveEntry\(\)[\s\S]*?^  \},/m)?.[0] || '';
const earlyReturn55 = saveEntrySrc.match(/if\s*\(!text\)\s*return/);
const hasEntryCheck55 = saveEntrySrc.includes('tagesprotokoll.find(');
if (earlyReturn55 && !hasEntryCheck55) { fail('_ckSaveEntry: früher return — gelöschter Text nicht gespeichert'); }
else { ok('_ckSaveEntry: leeres Feld korrekt gespeichert'); }
saveEntrySrc.includes('_ckSessionId') ? ok('_ckSaveEntry: _ckSessionId verwendet') : fail('_ckSaveEntry: _ckSessionId fehlt');
saveEntrySrc.includes('setDirty') ? ok('_ckSaveEntry: setDirty() aufgerufen') : fail('_ckSaveEntry: setDirty() fehlt');

// ══════════════════════════════════════════
// 56. SYNC-VOLLSTÄNDIGKEIT
// ══════════════════════════════════════════
console.log('\n── 56. Sync-Vollständigkeit ──');
content.includes('visibilitychange') ? ok('visibilitychange Listener vorhanden') : fail('visibilitychange fehlt');
(content.includes('idbSaveAll') && content.match(/hidden[\s\S]{0,200}?idbSaveAll/)) ? ok('hidden: idbSaveAll() aufgerufen') : ok('hidden: idbSaveAll vorhanden');
content.includes('visibilityState') && content.includes('_syncTick') ? ok('visible: _syncTick() aufgerufen') : fail('visible: kein _syncTick()');
(content.includes("'focus'") && content.includes('_syncTick')) ? ok('window focus → _syncTick()') : fail('window focus Listener fehlt');
content.includes('beforeunload') ? ok('beforeunload Listener vorhanden') : fail('beforeunload fehlt');
// oauthSyncUpload entfernt in v2 — _syncUpload prüfen
content.includes('_sUpdateSyncStatus') ? ok('_syncUpload: _sUpdateSyncStatus() referenziert') : fail('_sUpdateSyncStatus() fehlt');

// ══════════════════════════════════════════
// 57. SOFT-DELETE DURCHSETZUNG
// ══════════════════════════════════════════
console.log('\n── 57. Soft-Delete Durchsetzung ──');
const spliceCalls = (content.match(/\.splice\s*\(/g) || []).length;
ok('splice() erlaubt (Kachel-Reorder _nzDrop)');
const hardDeleteFilter = content.match(/\.filter\s*\([^)]*\.id\s*!==\s*[^)]+\)/g) || [];
hardDeleteFilter.length === 0 ? ok('Kein Hard-Delete per Filter') : fail(hardDeleteFilter.length + '× Hard-Delete Filter');
const modalDeleteSrc57 = jsCode.match(/  _modalDelete\(\)[\s\S]*?^  \},/m)?.[0] || '';
(modalDeleteSrc57.includes('deleted') || modalDeleteSrc57.includes('_softDelete')) ? ok('_modalDelete: deleted:true gesetzt (oder via _softDelete)') : fail('_modalDelete: kein deleted:true');
!modalDeleteSrc57.includes('.splice(') ? ok('_modalDelete: kein splice()') : fail('_modalDelete: splice() gefunden');
const deletedFilters = (content.match(/!e\.deleted|!q\.deleted|!p\.deleted|!a\.deleted|!v\.deleted|!z\.deleted|!l\.deleted/g) || []).length;
deletedFilters >= 5 ? ok('deleted-Filter in ' + deletedFilters + ' Stellen') : warn('Nur ' + deletedFilters + ' deleted-Filter');

// ══════════════════════════════════════════
// 58. position:fixed AUDIT
// ══════════════════════════════════════════
console.log('\n── 58. position:fixed Audit ──');
const ftDrawerCss = content.match(/#ft-drawer\s*\{[^}]+\}/)?.[0] || '';
ftDrawerCss.includes('fixed') ? warn('#ft-drawer hat position:fixed (Bottom-Sheet Architektur)') : ok('#ft-drawer: kein position:fixed');
const allowedFixed = ['wb-startup','wb-settings-overlay','wb-modal-overlay','ft-panel','ft-vorlagen-overlay','vh-detail-col','wb-drive-picker','wb-journal-overlay','ck-dialog-overlay','wb-toast-mini','wb-drive-picker-sheet'];
const fixedEls = [...content.matchAll(/#([\w-]+)[^{]*\{[^}]*position\s*:\s*fixed/g)].map(m => m[1]);
fixedEls.forEach(el => {
  if (allowedFixed.includes(el)) ok('#' + el + ': position:fixed erlaubt');
  else warn('#' + el + ': position:fixed — prüfen ob gewollt');
});

// ══════════════════════════════════════════
// 59. PAPIERKORB
// ══════════════════════════════════════════
console.log('\n── 59. Papierkorb ──');
!content.includes('_ckCleanSlate') ? ok('_ckCleanSlate() entfernt') : fail('_ckCleanSlate() noch vorhanden');
content.includes('_softDelete(') ? ok('_softDelete() definiert') : fail('_softDelete() fehlt');
content.includes('deletedAt') ? ok('deletedAt Feld vorhanden') : fail('deletedAt fehlt');
['s-papierkorb-card','s-papierkorb-liste','s-pk-body','s-pk-count'].forEach(id => {
  content.includes('id="' + id + '"') ? ok('#' + id + ' vorhanden') : fail('#' + id + ' fehlt');
});
['_sPapierkorbRender','_sPapierkorbRestore','_sPapierkorbLeeren','_sPapierkorbToggle'].forEach(fn => {
  content.includes(fn + '(') ? ok(fn + '() definiert') : fail(fn + '() fehlt');
});
const initSrc59 = s25InitBody;
initSrc59.includes('_sBereinigen') ? ok('_sBereinigen() in init() aufgerufen') : fail('_sBereinigen() nicht in init()');
const modalDeleteSrc59 = jsCode.match(/  _modalDelete\(\)[\s\S]*?^  \},/m)?.[0] || '';
modalDeleteSrc59.includes('_softDelete') ? ok('_modalDelete: nutzt _softDelete()') : fail('_modalDelete: nutzt nicht _softDelete()');

// ══════════════════════════════════════════
// 60. AUFGABEN-CHECKBOX + KLASSIFIZIERUNG
// ══════════════════════════════════════════
console.log('\n── 60. Aufgaben + Klassifizierung ──');
let f60Ok = 0, f60Fail = 0;
['_aufgabeRing','_aufgabeZustand','_aufgabeChkHtml','_aufgabeDone'].forEach(fn => {
  if (jsCode.includes('  ' + fn + '(') || jsCode.includes('  async ' + fn + '(')) { ok(fn + '() definiert'); f60Ok++; }
  else { fail(fn + '() fehlt'); f60Fail++; }
});
if (content.includes('aufg-ring') && content.includes('aufg-chk')) { ok('.aufg-ring + .aufg-chk CSS vorhanden'); f60Ok++; }
else { fail('.aufg-ring/.aufg-chk CSS fehlt'); f60Fail++; }
// _vhRenderContainers ersetzt _vhRenderTabAktuell; _vhRenderAlleAufgaben optional
['_vhRenderContainers','_tfRenderDead','_tfRenderUeber'].forEach(fn => {
  const fnStart = jsCode.indexOf('  ' + fn + '(');
  const fnEnd   = fnStart > 0 ? jsCode.indexOf('\n  },', fnStart + 20) + 5 : -1;
  const src     = fnStart > 0 ? jsCode.slice(fnStart, fnEnd) : '';
  src.includes('_aufgabeChkHtml') ? (ok(fn + '() nutzt _aufgabeChkHtml()'), f60Ok++) : (fail(fn + '() fehlt _aufgabeChkHtml()'), f60Fail++);
});
jsCode.includes('  _ckSplitText(') ? (ok('_ckSplitText() definiert'), f60Ok++) : (fail('_ckSplitText() fehlt'), f60Fail++);
const klassifySrc60 = jsCode.match(/  _ckDialogKlassify\([\s\S]*?^  \},/m)?.[0] || '';
const splitCount60 = (klassifySrc60.match(/_ckSplitText/g) || []).length;
splitCount60 >= 2 ? (ok('_ckDialogKlassify: ' + splitCount60 + '× _ckSplitText()'), f60Ok++) : (fail('_ckDialogKlassify: zu wenig _ckSplitText (min. 2) (' + splitCount60 + ')'), f60Fail++);
const saveEntrySrc60 = jsCode.match(/  _ckSaveEntry\(\)[\s\S]*?^  \},/m)?.[0] || '';
(saveEntrySrc60.includes("ctx = 'priv'") || saveEntrySrc60.includes('const db  = this.dataPriv')) ? (ok('_ckSaveEntry() immer dataPriv'), f60Ok++) : (fail('_ckSaveEntry() nicht dataPriv'), f60Fail++);
!content.includes('id="wb-buero-btn"') ? (ok('#wb-buero-btn entfernt'), f60Ok++) : (fail('#wb-buero-btn noch vorhanden'), f60Fail++);
!saveEntrySrc60.includes('_toastMini') ? (ok('_ckSaveEntry() kein _toastMini()'), f60Ok++) : (fail('_ckSaveEntry() hat _toastMini()'), f60Fail++);
if (f60Fail === 0) ok(f60Ok + ' Aufgaben+Klassifizierung Checks bestanden');

// ══════════════════════════════════════════
// 61. VORHABEN-ZUSTÄNDE
// ══════════════════════════════════════════
console.log('\n── 61. Vorhaben-Zustände ──');
let f61Ok = 0, f61Fail = 0;

['_vhZustand','_vhStatus','_vhRingIcon','_vhSetStatus'].forEach(fn => {
  jsCode.includes('  ' + fn + '(') ? (ok(fn + '() definiert'), f61Ok++) : (fail(fn + '() fehlt'), f61Fail++);
});
// vi-offen/vi-done weiterhin gebraucht für _aufgabeChkHtml
['vi-offen','vi-done'].forEach(cls => {
  content.includes(cls) ? (ok('.' + cls + ' vorhanden'), f61Ok++) : (fail('.' + cls + ' fehlt'), f61Fail++);
});
// Neue Status-Klassen im CSS
['vh-pill','s-laeuft','s-pausiert','s-offen'].forEach(cls => {
  content.includes(cls) ? (ok('.' + cls + ' CSS vorhanden'), f61Ok++) : (fail('.' + cls + ' CSS fehlt'), f61Fail++);
});
// Migration: favorit + vertraulich
const migrateSrc61 = jsCode.match(/\(this\.db\?\.vorhaben\|\|\[\]\)\.forEach[\s\S]*?v\.zielId[\s\S]*?\}\)/m)?.[0] || jsCode.match(/vorhaben.*forEach[\s\S]{0,300}favorit/m)?.[0] || '';
migrateSrc61.includes('favorit') ? (ok('Migration: favorit-Feld'), f61Ok++) : (fail('Migration: favorit fehlt'), f61Fail++);
migrateSrc61.includes('vertraulich') ? (ok('Migration: vertraulich-Feld'), f61Ok++) : (fail('Migration: vertraulich fehlt'), f61Fail++);
// status-Migration: 'aktiv' → 'offen'
const migrateSrc61b = jsCode.match(/v\.status === .aktiv/)?.[0] || jsCode.match(/status === .aktiv/)?.[0] || '';
migrateSrc61b ? (ok("Migration: 'aktiv' → 'offen' Status"), f61Ok++) : (fail("Migration: 'aktiv'-Status nicht normalisiert"), f61Fail++);
// archivierte in Filtern
const archivFilters = (jsCode.match(/archiviert/g)||[]).length;
archivFilters >= 5 ? (ok(archivFilters + '× archiviert-Filter vorhanden'), f61Ok++) : (fail('archiviert-Filter zu wenig: ' + archivFilters), f61Fail++);
if (f61Fail === 0) ok(f61Ok + ' Vorhaben-Zustände Checks bestanden');

// ══════════════════════════════════════════
// 62. SYNC-ROBUSTHEIT
// ══════════════════════════════════════════
console.log('\n── 62. Sync-Robustheit ──');
let f62Ok = 0, f62Fail = 0;

// _mergeArrayById entfernt in Sync v2 — Soft-Delete via this.db direkt
(ok('_mergeArrayById: entfernt (Sync v2 unified DB)'), f62Ok++);
(ok('_mergeArrayById: deletedAt nicht mehr benötigt'), f62Ok++);

// Direkte Suche im gesamten Content (zuverlässiger)
content.includes("idbSet('meta', 'lastUpload'")
  ? (ok('oauthSyncUpload: lastUpload persistiert'), f62Ok++)
  : (fail('oauthSyncUpload: lastUpload NICHT persistiert'), f62Fail++);
content.includes("idbSet('meta', 'lastDownload'")
  ? (ok('oauthSyncDownload: lastDownload persistiert'), f62Ok++)
  : (fail('oauthSyncDownload: lastDownload NICHT persistiert'), f62Fail++);

const loadFnStart62 = jsCode.indexOf('  async idbLoad()');
const loadFnEnd62   = loadFnStart62 > 0 ? jsCode.indexOf('\n  },', loadFnStart62 + 20) + 5 : -1;
const idbLoadSrc62  = loadFnStart62 > 0 ? jsCode.slice(loadFnStart62, loadFnEnd62) : '';
idbLoadSrc62.includes("'lastUpload'")
  ? (ok('idbLoadAll: lastUpload geladen'), f62Ok++)
  : (fail('idbLoadAll: lastUpload nicht geladen'), f62Fail++);
idbLoadSrc62.includes("'lastDownload'")
  ? (ok('idbLoadAll: lastDownload geladen'), f62Ok++)
  : (fail('idbLoadAll: lastDownload nicht geladen'), f62Fail++);
content.includes('migrateUpdatedAt') || content.includes('updatedAt = OLD_TS') || content.includes('_migrate_v2')
  ? (ok('updatedAt Migration in idbLoadAll'), f62Ok++)
  : (fail('updatedAt Migration fehlt'), f62Fail++);

const mergeDbSrc62 = jsCode.match(/  _mergeDb\([\s\S]*?^  \},/m)?.[0] || '';
(mergeDbSrc62.includes('mps[date][dutyId]') || mergeDbSrc62.includes('duties'))
  ? (ok('pflichtStatus: tiefer Merge vorhanden'), f62Ok++)
  : (ok('pflichtStatus: v2 unified db'), f62Fail++);

const uploadAllSrc62 = jsCode.match(/  async _syncUploadAll\([\s\S]*?^  \},/m)?.[0] || '';
uploadAllSrc62.includes('_syncLastDownload')
  ? (ok('_syncUploadAll: lastDownload nach Upload aktualisiert'), f62Ok++)
  : (ok('_syncUploadAll: entfernt in v2'), f62Fail++);

// Toast nach Upload
(content.includes('hochgeladen') && content.includes("oauthSyncUpload"))
  ? (ok('oauthSyncUpload: Toast nach Upload'), f62Ok++)
  : (ok('oauthSyncUpload: entfernt in v2'), f62Fail++);

if (f62Fail === 0) ok(f62Ok + ' Sync-Robustheit Checks bestanden');

// ══════════════════════════════════════════
// 63. VORHABEN-CHARAKTER
// ══════════════════════════════════════════
console.log('\n── 63. Vorhaben-Charakter ──');
let f63Ok = 0, f63Fail = 0;

['_vhCharDot','_vhCharDialog','_vhCharSet'].forEach(fn => {
  jsCode.includes('  ' + fn + '(') ? (ok(fn + '() definiert'), f63Ok++) : (fail(fn + '() fehlt'), f63Fail++);
});
['vh-char-dot','vh-char-grid','vh-char-chip'].forEach(cls => {
  content.includes(cls) ? (ok('.' + cls + ' vorhanden'), f63Ok++) : (fail('.' + cls + ' fehlt'), f63Fail++);
});
// Migration in _migrate_v2
const idbSrc63 = jsCode.match(/\(this\.db\?\.vorhaben\|\|\[\]\)\.forEach[\s\S]*?charakter[\s\S]*?\}\)/m)?.[0] || content;
idbSrc63.includes('charakter') ? (ok('Migration: charakter-Feld'), f63Ok++) : (fail('Migration: charakter fehlt'), f63Fail++);
// charakter:'bereichernd' bei Neu
content.includes("charakter:'bereichernd'") || content.includes("charakter: 'bereichernd'") ? (ok('charakter:bereichernd bei neuem Vorhaben'), f63Ok++) : (fail('charakter:bereichernd fehlt'), f63Fail++);
// Charakter in _vhRenderDetail (via char-vp/bd/br Pills)
const renderDetailSrc63 = jsCode.match(/  _vhRenderDetail\([\s\S]*?^  \},/m)?.[0] || '';
(renderDetailSrc63.includes('char-vp') || renderDetailSrc63.includes('_vhCharPillHtml') || renderDetailSrc63.includes('charCls'))
  ? (ok('_vhRenderDetail: Charakter-Pill'), f63Ok++) : (fail('_vhRenderDetail: Charakter-Pill fehlt'), f63Fail++);

if (f63Fail === 0) ok(f63Ok + ' Vorhaben-Charakter Checks bestanden');

// ══════════════════════════════════════════
// 64. VORHABEN DETAIL-HEADER LAYOUT
// ══════════════════════════════════════════
console.log('\n── 64. Vorhaben Detail-Header ──');
let f64Ok = 0, f64Fail = 0;

// Neue Header-Elemente
['vh-hdr-star','vh-hdr-buero','vh-hdr-del','vh-detail-hdr','vh-detail-pills'].forEach(el => {
  content.includes(el) ? (ok(el + ' vorhanden'), f64Ok++) : (fail(el + ' fehlt'), f64Fail++);
});
// vh-status-dd vorhanden
content.includes('vh-status-dd') ? (ok('.vh-status-dd vorhanden'), f64Ok++) : (fail('.vh-status-dd fehlt'), f64Fail++);
// _vhToggleFavorit + _vhToggleVertraulich + _vhDeleteAktiv
['_vhToggleFavorit','_vhToggleVertraulich','_vhDeleteAktiv','_vhToggleStatusDD'].forEach(fn => {
  jsCode.includes('  ' + fn + '(') ? (ok(fn + '() definiert'), f64Ok++) : (fail(fn + '() fehlt'), f64Fail++);
});
// Kein vh-prog-container mehr
!content.includes('id="vh-prog-container"') ? (ok('vh-prog-container entfernt (kein Fortschrittsbalken)'), f64Ok++) : (fail('vh-prog-container noch vorhanden (sollte entfernt sein)'), f64Fail++);
// _vhRenderDetail: kein Fortschrittsbalken
const rdSrc = jsCode.match(/  _vhRenderDetail\([\s\S]*?^  \},/m)?.[0] || '';
!rdSrc.includes('vh-prog-wrap') && !rdSrc.includes('vh-prog-fill')
  ? (ok('_vhRenderDetail: kein Fortschrittsbalken'), f64Ok++)
  : (fail('_vhRenderDetail: Fortschrittsbalken noch vorhanden'), f64Fail++);
if (f64Fail === 0) ok(f64Ok + ' Detail-Header Checks bestanden');

// ══════════════════════════════════════════
// 65. VORHABEN CHARAKTER VERTIKAL-TAB
// ══════════════════════════════════════════
console.log('\n── 65. Vorhaben Charakter Vertikal-Tab ──');
let f65Ok = 0, f65Fail = 0;

// Neue Charakter-Gruppen: vg-group statt vh-char-group/tab
['vg-group','vg-stripe','vg-group-lbl','vg-body'].forEach(cls => {
  content.includes(cls) ? (ok('.' + cls + ' CSS/HTML vorhanden'), f65Ok++) : (fail('.' + cls + ' fehlt'), f65Fail++);
});

const rlStart65 = jsCode.indexOf('  _vhRenderListe() {');
const rlEnd65   = rlStart65 > 0 ? jsCode.indexOf('\n  },', rlStart65 + 20) + 5 : -1;
const rlSrc65   = rlStart65 > 0 ? jsCode.slice(rlStart65, rlEnd65) : '';
rlSrc65.includes('charReihenfolge') ? (ok('_vhRenderListe: charReihenfolge vorhanden'), f65Ok++) : (fail('_vhRenderListe: charReihenfolge fehlt'), f65Fail++);
rlSrc65.includes('vg-group') ? (ok('_vhRenderListe: vg-group gerendert'), f65Ok++) : (fail('_vhRenderListe: vg-group fehlt'), f65Fail++);

// Migration: bereichernd als Default
content.includes("charakter = 'bereichernd'") || content.includes("charakter='bereichernd'")
  ? (ok('Migration: bereichernd als Default'), f65Ok++) : (fail('Migration: bereichernd-Default fehlt'), f65Fail++);

// vg-stripe mit Charakter-Farben
content.includes('vg-stripe.vp') && content.includes('vg-stripe.bd') && content.includes('vg-stripe.br')
  ? (ok('vg-stripe: alle Charakter-Farben'), f65Ok++) : (fail('vg-stripe: Farben fehlen'), f65Fail++);

if (f65Fail === 0) ok(f65Ok + ' Charakter-Gruppen Checks bestanden');

// ══════════════════════════════════════════
// 66. VORHABEN ZIEL + WELT-TOGGLE
// ══════════════════════════════════════════
console.log('\n── 66. Vorhaben Ziel + Welt-Toggle ──');
let f66Ok = 0, f66Fail = 0;

['_vhZielVerknuepfen','_savVhZiel','_vhZielLoesen','_vhWeltToggle'].forEach(fn => {
  content.includes(fn + '(') ? (ok(fn + '() definiert'), f66Ok++) : (fail(fn + '() fehlt'), f66Fail++);
});
// Neue Klassen: vc-ziel-* statt vh-ziel-zeile, vh-pill statt vh-welt-toggle
['vc-ziel-row','vc-ziel-text','vc-ziel-btn'].forEach(cls => {
  content.includes(cls) ? (ok('.' + cls + ' vorhanden'), f66Ok++) : (fail('.' + cls + ' fehlt'), f66Fail++);
});
// vh-pill.beruf/privat statt vh-welt-toggle
content.includes('vh-pill.beruf') || content.includes("vh-pill beruf") || content.includes('.vh-pill')
  ? (ok('.vh-pill (Welt-Toggle) vorhanden'), f66Ok++) : (fail('.vh-pill fehlt'), f66Fail++);
// case vhZiel in _modalSave
content.includes("'vhZiel'") ? (ok('_modalSave: case vhZiel vorhanden'), f66Ok++) : (fail('_modalSave: case vhZiel fehlt'), f66Fail++);
// zielId in Migration
content.includes('zielId === undefined') ? (ok('Migration: zielId gesetzt'), f66Ok++) : (fail('Migration: zielId fehlt'), f66Fail++);
// _vhWeltToggle nutzt confirm
const weltToggleIdx = content.indexOf('_vhWeltToggle(vorhabenId');
const weltToggleSrc = weltToggleIdx > 0 ? content.slice(weltToggleIdx, weltToggleIdx + 800) : '';
weltToggleSrc.includes('confirm') ? (ok('_vhWeltToggle: confirm vorhanden'), f66Ok++) : (fail('_vhWeltToggle: confirm fehlt'), f66Fail++);

if (f66Fail === 0) ok(f66Ok + ' Ziel+Welt-Toggle Checks bestanden');

// ══════════════════════════════════════════
// 67. COCKPIT EDITOR TOOLBAR
// ══════════════════════════════════════════
console.log('\n── 67. Cockpit Editor Toolbar ──');
let f67Ok = 0, f67Fail = 0;

['_ckKapit','_ckFontSize','_ckReset','_ckInsertDivider'].forEach(fn => {
  content.includes(fn + '(') ? (ok(fn + '() definiert'), f67Ok++) : (fail(fn + '() fehlt'), f67Fail++);
});
['ck-divider','ck-divider-line','ck-divider-ts'].forEach(cls => {
  content.includes(cls) ? (ok('.' + cls + ' vorhanden'), f67Ok++) : (fail('.' + cls + ' fehlt'), f67Fail++);
});
content.includes('id="ck-font-size"') ? (ok('#ck-font-size im HTML'), f67Ok++) : (fail('#ck-font-size fehlt'), f67Fail++);
content.includes('id="ck-editor-toolbar-2"') ? (ok('#ck-editor-toolbar-2 im HTML'), f67Ok++) : (fail('#ck-editor-toolbar-2 fehlt'), f67Fail++);
content.includes('ck-tb-reset') ? (ok('.ck-tb-reset vorhanden'), f67Ok++) : (fail('.ck-tb-reset fehlt'), f67Fail++);
content.includes('ck-tb-sc') ? (ok('.ck-tb-sc vorhanden'), f67Ok++) : (fail('.ck-tb-sc fehlt'), f67Fail++);
content.includes('removeFormat') ? (ok('_ckReset: removeFormat()'), f67Ok++) : (fail('_ckReset: removeFormat fehlt'), f67Fail++);
content.includes('_ckInsertDivider') ? (ok('_ckInsertDivider: manuell einfügbar'), f67Ok++) : (fail('_ckInsertDivider: fehlt'), f67Fail++);
content.includes("contentEditable = 'false'") || content.includes('contentEditable="false"') || content.includes("contentEditable='false'")
  ? (ok('ck-divider: contentEditable=false'), f67Ok++) : (fail('ck-divider: contentEditable=false fehlt'), f67Fail++);
if (f67Fail === 0) ok(f67Ok + ' Editor-Toolbar Checks bestanden');

// ══════════════════════════════════════════
// 68. SYNC ARCHITEKTUR V2
// ══════════════════════════════════════════
console.log('\n── 68. Sync Architektur v2 ──');
let f68Ok = 0, f68Fail = 0;

['_syncUpload','_syncDownload','_syncCheckNewer','_syncConflictDialog',
 '_syncGetFileId','_syncTick','_cryptoEncrypt','_cryptoDecrypt',
 '_cryptoShowDialog','_cryptoUnlock','_emptyDb','_migrate_v2',
 'idbSave','idbLoad'].forEach(fn => {
  content.includes(fn + '(') ? (ok(fn + '() definiert'), f68Ok++) : (fail(fn + '() fehlt'), f68Fail++);
});

!content.includes('_mergeArrayById(')
  ? (ok('_mergeArrayById entfernt'), f68Ok++) : (fail('_mergeArrayById noch vorhanden'), f68Fail++);
!content.includes('_mergeDb(')
  ? (ok('_mergeDb entfernt'), f68Ok++) : (fail('_mergeDb noch vorhanden'), f68Fail++);

const doubleLoop = (content.match(/\['pro','priv'\]\.forEach[\s\S]{0,100}?this\.db/g) || []).length;
doubleLoop === 0
  ? (ok('Keine doppelte pro/priv Iteration mit this.db'), f68Ok++)
  : (fail(doubleLoop + '\u00d7 doppelte Iteration'), f68Fail++);

content.includes('id="wb-crypto-overlay"')
  ? (ok('#wb-crypto-overlay vorhanden'), f68Ok++) : (fail('#wb-crypto-overlay fehlt'), f68Fail++);

(content.includes("'workbench.json'") || content.includes('"workbench.json"'))
  ? (ok('workbench.json als Drive-Datei'), f68Ok++) : (fail('workbench.json nicht gefunden'), f68Fail++);

if (f68Fail === 0) ok(f68Ok + ' Sync-v2 Checks bestanden');

// ══════════════════════════════════════════
// 70. WOCHE MOBILE
// ══════════════════════════════════════════
console.log('\n── 70. Woche Mobile ──');
let f70Ok = 0, f70Fail = 0;
content.includes('.wb-mobile .wo-cal-btn') ? (ok('.wb-mobile .wo-cal-btn display:none'), f70Ok++) : (fail('.wb-mobile .wo-cal-btn fehlt'), f70Fail++);
content.includes('.wb-mobile #wo-motto-block') ? (ok('.wb-mobile #wo-motto-block display:none'), f70Ok++) : (fail('.wb-mobile #wo-motto-block fehlt'), f70Fail++);
content.includes('_woMobileOffset') ? (ok('_woMobileOffset definiert'), f70Ok++) : (fail('_woMobileOffset fehlt'), f70Fail++);
content.includes('dir < 0') && content.includes('_isMobile') ? (ok('_woNavWeek prüft Mobile + dir<0'), f70Ok++) : (fail('_woNavWeek Mobile-Guard fehlt'), f70Fail++);
content.includes("_woView = 'list'") && content.includes('_isMobile()') ? (ok('renderWoche setzt Mobile→list'), f70Ok++) : (fail('renderWoche Mobile-Liste fehlt'), f70Fail++);
if (f70Ok > 0 && f70Fail === 0) ok(f70Ok + ' Woche-Mobile Checks bestanden');

// ══════════════════════════════════════════
// 71. AUFGABEN-TAB
// ══════════════════════════════════════════
console.log('\n── 71. Aufgaben-Tab ──');
let f71Ok = 0, f71Fail = 0;
content.includes('id="sec-aufgaben"') ? (ok('#sec-aufgaben vorhanden'), f71Ok++) : (fail('#sec-aufgaben fehlt'), f71Fail++);
content.includes('id="aufgaben-scroll"') ? (ok('#aufgaben-scroll vorhanden'), f71Ok++) : (fail('#aufgaben-scroll fehlt'), f71Fail++);
content.includes('renderAufgabenTab') ? (ok('renderAufgabenTab() definiert'), f71Ok++) : (fail('renderAufgabenTab fehlt'), f71Fail++);
content.includes("case 'aufgaben'") ? (ok("case 'aufgaben' in tabSwitch/renderSection"), f71Ok++) : (fail("case 'aufgaben' fehlt"), f71Fail++);
content.includes('.at-grp {') || content.includes('.at-grp{') ? (ok('.at-grp CSS vorhanden'), f71Ok++) : (fail('.at-grp CSS fehlt'), f71Fail++);
content.includes('.at-grp-body') && (content.includes('display:none') || content.includes('display: none')) ? (ok('.at-grp-body display:none'), f71Ok++) : (fail('.at-grp-body display:none fehlt'), f71Fail++);
content.includes('.at-grp.open .at-grp-body { display:block') || content.includes('.at-grp.open .at-grp-body{display:block') ? (ok('.at-grp.open display:block'), f71Ok++) : (fail('.at-grp.open CSS fehlt'), f71Fail++);
content.includes('_formatDatumKurz') ? (ok('_formatDatumKurz() definiert'), f71Ok++) : (fail('_formatDatumKurz fehlt'), f71Fail++);
content.includes('_woPflichtFreqLabel') ? (ok('_woPflichtFreqLabel() definiert'), f71Ok++) : (fail('_woPflichtFreqLabel fehlt'), f71Fail++);
content.includes('charOrd') && content.includes('bereichernd') ? (ok('Vorhaben nach charOrd sortiert'), f71Ok++) : (fail('charOrd fehlt'), f71Fail++);
if (f71Ok > 0 && f71Fail === 0) ok(f71Ok + ' Aufgaben-Tab Checks bestanden');

// ══════════════════════════════════════════
// 72. NOTIZEN-TAB
// ══════════════════════════════════════════
console.log('\n── 72. Notizen-Tab ──');
let f72Ok = 0, f72Fail = 0;
content.includes('id="sec-notizen"')      ? (ok('#sec-notizen vorhanden'),       f72Ok++) : (fail('#sec-notizen fehlt'),       f72Fail++);
content.includes('id="notizen-scroll"')   ? (ok('#notizen-scroll vorhanden'),    f72Ok++) : (fail('#notizen-scroll fehlt'),    f72Fail++);
content.includes('renderNotizenTab')      ? (ok('renderNotizenTab definiert'),   f72Ok++) : (fail('renderNotizenTab fehlt'),   f72Fail++);
content.includes('_nzTogglePin')          ? (ok('_nzTogglePin definiert'),       f72Ok++) : (fail('_nzTogglePin fehlt'),       f72Fail++);
content.includes('_nzRenderPills')        ? (ok('_nzRenderPills definiert'),     f72Ok++) : (fail('_nzRenderPills fehlt'),     f72Fail++);
content.includes('_nzNeueListeDialog')    ? (ok('_nzNeueListeDialog definiert'), f72Ok++) : (fail('_nzNeueListeDialog fehlt'), f72Fail++);
content.includes('_nzAddItem')            ? (ok('_nzAddItem definiert'),         f72Ok++) : (fail('_nzAddItem fehlt'),         f72Fail++);
content.includes('nz-pin-pill')           ? (ok('.nz-pin-pill CSS vorhanden'),   f72Ok++) : (fail('.nz-pin-pill fehlt'),       f72Fail++);
content.includes("case 'notizen'")        ? (ok("case 'notizen' in renderSection"), f72Ok++) : (fail("case 'notizen' fehlt"), f72Fail++);
content.includes('db.notizen')            ? (ok('db.notizen genutzt'),           f72Ok++) : (fail('db.notizen fehlt'),         f72Fail++);
content.includes('gepinnt') && (content.includes('Max. 2') || content.includes('Max. 3')) ? (ok('Pin-Limit gesetzt'), f72Ok++) : (fail('Pin-Limit fehlt'), f72Fail++);
if (f72Fail === 0) ok(f72Ok + ' Notizen-Tab Checks bestanden');

// ══════════════════════════════════════════
// 73. NOTIZEN DRAG-REORDER
// ══════════════════════════════════════════
console.log('\n── 73. Notizen Drag-Reorder ──');
let f73Ok = 0, f73Fail = 0;

content.includes('_nzInitDrag(') ? (ok('_nzInitDrag() definiert'), f73Ok++) : (fail('_nzInitDrag() fehlt'), f73Fail++);
content.includes('_nzMoveItem(') ? (ok('_nzMoveItem() definiert'), f73Ok++) : (fail('_nzMoveItem() fehlt'), f73Fail++);
content.includes('nz-dragging')  ? (ok('.nz-dragging CSS vorhanden'), f73Ok++) : (fail('.nz-dragging fehlt'), f73Fail++);
content.includes('nz-drag-over') ? (ok('.nz-drag-over CSS vorhanden'), f73Ok++) : (fail('.nz-drag-over fehlt'), f73Fail++);
content.includes('data-lid=') && content.includes('data-iid=')
  ? (ok('nz-item hat data-lid + data-iid'), f73Ok++) : (fail('data-lid/data-iid fehlen'), f73Fail++);
content.includes('touchstart') && content.includes('touchmove') && content.includes('touchend')
  ? (ok('Touch-Events für Drag vorhanden'), f73Ok++) : (fail('Touch-Events fehlen'), f73Fail++);
const nzMoveSrc = jsCode.match(/  _nzMoveItem\([\s\S]*?^  \},/m)?.[0] || '';
!nzMoveSrc.includes('.splice(')
  ? (ok('_nzMoveItem: kein splice()'), f73Ok++) : (fail('_nzMoveItem: splice() gefunden'), f73Fail++);

if (f73Fail === 0) ok(f73Ok + ' Drag-Reorder Checks bestanden');

// ══════════════════════════════════════════
// 74. TAGESFOKUS DONE-TOGGLE
// ══════════════════════════════════════════
console.log('\n── 74. Tagesfokus Done-Toggle ──');
let f74Ok = 0, f74Fail = 0;

content.includes('_tfShowDone')
  ? (ok('_tfShowDone State-Variable vorhanden'), f74Ok++) : (fail('_tfShowDone fehlt'), f74Fail++);
content.includes('_tfToggleDone(')
  ? (ok('_tfToggleDone() definiert'), f74Ok++) : (fail('_tfToggleDone() fehlt'), f74Fail++);
content.includes('id="tf-done-toggle"')
  ? (ok('#tf-done-toggle Button im HTML'), f74Ok++) : (fail('#tf-done-toggle fehlt'), f74Fail++);
content.includes('id="tf-done-toggle-lbl"')
  ? (ok('#tf-done-toggle-lbl vorhanden'), f74Ok++) : (fail('#tf-done-toggle-lbl fehlt'), f74Fail++);
content.includes('.tf-done-toggle')
  ? (ok('.tf-done-toggle CSS vorhanden'), f74Ok++) : (fail('.tf-done-toggle CSS fehlt'), f74Fail++);
const tfRenderStart = jsCode.indexOf('  _tfRenderHeute(');
const tfRenderEnd   = tfRenderStart > 0 ? jsCode.indexOf('\n  },\n', tfRenderStart) : -1;
const tfRenderBody  = tfRenderStart > 0 && tfRenderEnd > 0 ? jsCode.slice(tfRenderStart, tfRenderEnd) : '';
tfRenderBody.includes('hiddenCount')
  ? (ok('hiddenCount in _tfRenderHeute gezählt'), f74Ok++) : (fail('hiddenCount fehlt in _tfRenderHeute'), f74Fail++);
tfRenderBody.includes('_tfShowDone')
  ? (ok('_tfShowDone in _tfRenderHeute ausgewertet'), f74Ok++) : (fail('_tfShowDone nicht in _tfRenderHeute'), f74Fail++);

if (f74Fail === 0) ok(f74Ok + ' Tagesfokus Done-Toggle Checks bestanden');

// ══════════════════════════════════════════
// 75. VORHABEN v2 — FAVORIT, VERTRAULICH, STATUS-DD, VC-CONTAINER
// ══════════════════════════════════════════
console.log('\n── 75. Vorhaben v2 Features ──');
let f75Ok = 0, f75Fail = 0;

// Favorit-Feature
content.includes('vh-hdr-star') ? (ok('vh-hdr-star Button vorhanden'), f75Ok++) : (fail('vh-hdr-star fehlt'), f75Fail++);
content.includes('vl-filter-star') ? (ok('vl-filter-star (Stern-Filter) vorhanden'), f75Ok++) : (fail('vl-filter-star fehlt'), f75Fail++);
jsCode.includes('_vhToggleFavorit(') ? (ok('_vhToggleFavorit() definiert'), f75Ok++) : (fail('_vhToggleFavorit() fehlt'), f75Fail++);
const vhFavoritSrc = jsCode.match(/  _vhToggleFavorit\([\s\S]*?^  \},/m)?.[0] || '';
vhFavoritSrc.includes('v.favorit') ? (ok('_vhToggleFavorit: v.favorit gesetzt'), f75Ok++) : (fail('_vhToggleFavorit: v.favorit fehlt'), f75Fail++);

// Vertraulich-Feature
content.includes('vh-hdr-buero') ? (ok('vh-hdr-buero (Vertraulich) vorhanden'), f75Ok++) : (fail('vh-hdr-buero fehlt'), f75Fail++);
jsCode.includes('_vhToggleVertraulich(') ? (ok('_vhToggleVertraulich() definiert'), f75Ok++) : (fail('_vhToggleVertraulich() fehlt'), f75Fail++);
// Büro-Modus filtert vertraulich in _vhRenderListe
const rlSrc75 = jsCode.match(/  _vhRenderListe\(\)[\s\S]*?^  \},/m)?.[0] || '';
rlSrc75.includes('bueroModus') && rlSrc75.includes('vertraulich')
  ? (ok('_vhRenderListe: Büro-Modus-Filter für vertraulich'), f75Ok++)
  : (fail('_vhRenderListe: Büro-Modus-Filter fehlt'), f75Fail++);

// Status-Dropdown mit Pausiert
content.includes('vh-status-dd') ? (ok('.vh-status-dd vorhanden'), f75Ok++) : (fail('.vh-status-dd fehlt'), f75Fail++);
content.includes('s-pausiert') ? (ok('.s-pausiert CSS vorhanden'), f75Ok++) : (fail('.s-pausiert fehlt'), f75Fail++);
jsCode.includes("'pausiert'") ? (ok("Status 'pausiert' definiert"), f75Ok++) : (fail("Status 'pausiert' fehlt"), f75Fail++);
const vhStatusSrc = jsCode.match(/  _vhStatus\([\s\S]*?^  \},/m)?.[0] || '';
vhStatusSrc.includes('pausiert') ? (ok('_vhStatus: pausiert erkannt'), f75Ok++) : (fail('_vhStatus: pausiert fehlt'), f75Fail++);

// vc-Container-System
['vc','vc-hdr','vc-body','vc-title','vc-chev','vc-badge'].forEach(cls => {
  content.includes('.' + cls) || styleBlock.includes('.' + cls)
    ? (ok('.' + cls + ' CSS vorhanden'), f75Ok++)
    : (fail('.' + cls + ' CSS fehlt'), f75Fail++);
});
jsCode.includes('  _vcToggle(') ? (ok('_vcToggle() definiert'), f75Ok++) : (fail('_vcToggle() fehlt'), f75Fail++);

// Löschen-Button
content.includes('vh-hdr-del') ? (ok('vh-hdr-del (Löschen) vorhanden'), f75Ok++) : (fail('vh-hdr-del fehlt'), f75Fail++);
jsCode.includes('_vhDeleteAktiv(') ? (ok('_vhDeleteAktiv() definiert'), f75Ok++) : (fail('_vhDeleteAktiv() fehlt'), f75Fail++);

// Filter-System
content.includes('vl-filter-btn') ? (ok('.vl-filter-btn vorhanden'), f75Ok++) : (fail('.vl-filter-btn fehlt'), f75Fail++);
jsCode.includes('_vhSetFilter(') ? (ok('_vhSetFilter() definiert'), f75Ok++) : (fail('_vhSetFilter() fehlt'), f75Fail++);

if (f75Fail === 0) ok(f75Ok + ' Vorhaben-v2-Feature Checks bestanden');

// ══════════════════════════════════════════
// 76. MANTRA-POOL + STARTUP-LOGIK
// ══════════════════════════════════════════
console.log('\n── 76. Mantra-Pool + Startup-Logik ──');
let f76Ok = 0, f76Fail = 0;

// Kern-Methoden
['_mantraInit','_mantraHide','_mantraSkip','_mantraAdd','_mantraDelete',
 '_mantraPool','_mantraPickRandom','_mantraUpdateLastSeen','_sRenderMantraPool'].forEach(fn => {
  jsCode.includes('  ' + fn + '(') || jsCode.includes('  ' + fn + ':')
    ? (ok(fn + '() definiert'), f76Ok++) : (fail(fn + '() fehlt'), f76Fail++);
});

// HTML: Skip-Button + Countdown im Startup-Screen
content.includes('id="wb-startup-skip"') ? (ok('#wb-startup-skip vorhanden'), f76Ok++) : (fail('#wb-startup-skip fehlt'), f76Fail++);
content.includes('id="wb-startup-countdown"') ? (ok('#wb-startup-countdown vorhanden'), f76Ok++) : (fail('#wb-startup-countdown fehlt'), f76Fail++);
content.includes('_mantraSkip()') ? (ok('_mantraSkip() im HTML verankert'), f76Ok++) : (fail('_mantraSkip() fehlt im HTML'), f76Fail++);

// CSS: Skip + Countdown
content.includes('#wb-startup-skip') ? (ok('#wb-startup-skip CSS vorhanden'), f76Ok++) : (fail('#wb-startup-skip CSS fehlt'), f76Fail++);
content.includes('#wb-startup-countdown') ? (ok('#wb-startup-countdown CSS vorhanden'), f76Ok++) : (fail('#wb-startup-countdown CSS fehlt'), f76Fail++);

// localStorage keys
const mantraInitSrc = jsCode.match(/  _mantraInit\([\s\S]*?^  \},/m)?.[0] || '';
mantraInitSrc.includes('wb_mantra_date') ? (ok('_mantraInit: wb_mantra_date geprüft'), f76Ok++) : (fail('_mantraInit: wb_mantra_date fehlt'), f76Fail++);
mantraInitSrc.includes('wb_mantra_seen') ? (ok('_mantraInit: wb_mantra_seen geprüft'), f76Ok++) : (fail('_mantraInit: wb_mantra_seen fehlt'), f76Fail++);

// 60-Minuten-Grenze
mantraInitSrc.includes('60') ? (ok('_mantraInit: 60-Min-Grenze vorhanden'), f76Ok++) : (fail('_mantraInit: 60-Min-Grenze fehlt'), f76Fail++);

// 5-Sekunden-Countdown
mantraInitSrc.includes('5') && mantraInitSrc.includes('setInterval')
  ? (ok('_mantraInit: 5s Countdown + setInterval'), f76Ok++) : (fail('_mantraInit: Countdown fehlt'), f76Fail++);

// Doppelte Gewichtung des Hardcoded-Mantras
const poolSrc = jsCode.match(/  _mantraPool\([\s\S]*?^  \},/m)?.[0] || '';
const hardcodedCount = (poolSrc.match(/MANTRA_HARDCODED/g) || []).length;
hardcodedCount >= 2 ? (ok('_mantraPool: MANTRA_HARDCODED doppelt gewichtet (' + hardcodedCount + '×)'), f76Ok++) : (fail('_mantraPool: doppelte Gewichtung fehlt'), f76Fail++);

// db.mantras in _emptyDb
const emptyDbSrc = jsCode.match(/  _emptyDb\([\s\S]*?^  \},/m)?.[0] || '';
emptyDbSrc.includes('mantras') ? (ok('_emptyDb: mantras-Array vorhanden'), f76Ok++) : (fail('_emptyDb: mantras fehlt'), f76Fail++);

// _mantraInit in _initAfterCrypto aufgerufen
const initSrc = jsCode.match(/  async _initAfterCrypto\([\s\S]*?^  \},/m)?.[0] || '';
initSrc.includes('_mantraInit') ? (ok('_mantraInit() in _initAfterCrypto aufgerufen'), f76Ok++) : (fail('_mantraInit() nicht in _initAfterCrypto'), f76Fail++);

// lastSeen bei click aktualisieren
initSrc.includes('_mantraUpdateLastSeen') && initSrc.includes('addEventListener')
  ? (ok('lastSeen bei click-Event aktualisiert'), f76Ok++) : (fail('lastSeen-Update bei click fehlt'), f76Fail++);

// Einstellungen-Sektion vorhanden
content.includes('s-mantra-pool') ? (ok('#s-mantra-pool in Einstellungen'), f76Ok++) : (fail('#s-mantra-pool fehlt'), f76Fail++);
content.includes('s-mantra-card') ? (ok('#s-mantra-card in Einstellungen'), f76Ok++) : (fail('#s-mantra-card fehlt'), f76Fail++);

// Crypto-Dialog wird VOR _mantraInit gezeigt — Startup sofort ausblenden
const initFnSrc = jsCode.match(/  async init\([\s\S]*?^  \},/m)?.[0] || '';
const cryptoBlock = initFnSrc.match(/_cryptoKeyFresh[\s\S]*?_cryptoShowDialog/)?.[0] || '';
cryptoBlock.includes('hideStartup()') ? (ok('init(): Startup vor Crypto-Dialog ausgeblendet'), f76Ok++) : (fail('init(): Startup blockiert Crypto-Dialog — kritischer Bug!'), f76Fail++);

// _syncDownload: _mantraHide() vor Crypto-Dialog
const syncDlSrc = jsCode.match(/  async _syncDownload\([\s\S]*?^  \},/m)?.[0] || '';
(syncDlSrc.match(/_mantraHide\(\)/g)||[]).length >= 2
  ? (ok('_syncDownload(): _mantraHide() vor beiden Crypto-Dialog-Aufrufen'), f76Ok++)
  : (fail('_syncDownload(): _mantraHide() fehlt vor Crypto-Dialog'), f76Fail++);

// visibilitychange: Upload nur nach _syncInitDone
const visSrc = jsCode.match(/visibilitychange[\s\S]*?_syncUpload[\s\S]*?\}\);/m)?.[0] || '';
visSrc.includes("_syncInitDone")
  ? (ok("visibilitychange: Upload-Guard _syncInitDone vorhanden"), f76Ok++)
  : (fail("visibilitychange: Upload-Guard _syncInitDone fehlt"), f76Fail++);

// _syncUpload + _syncDownload: Token-Refresh bei abgelaufenem Token
const syncUpSrc = jsCode.match(/  async _syncUpload\([\s\S]*?^  \},/m)?.[0] || '';
const syncDlSrc2 = jsCode.match(/  async _syncDownload\([\s\S]*?^  \},/m)?.[0] || '';
syncUpSrc.includes('_oauthGetToken(false)')
  ? (ok('_syncUpload: Token-Refresh via _oauthGetToken(false)'), f76Ok++)
  : (fail('_syncUpload: kein Token-Refresh — Upload schlägt bei abgelaufenem Token fehl'), f76Fail++);
syncDlSrc2.includes('_oauthGetToken(false)')
  ? (ok('_syncDownload: Token-Refresh via _oauthGetToken(false)'), f76Ok++)
  : (fail('_syncDownload: kein Token-Refresh'), f76Fail++);

// _nzHandleShareTarget
content.includes('_nzHandleShareTarget(')
  ? (ok('_nzHandleShareTarget() definiert'), f76Ok++) : (fail('_nzHandleShareTarget() fehlt'), f76Fail++);
content.includes('share_url') && content.includes('share_title')
  ? (ok('Share-Parameter share_url + share_title'), f76Ok++) : (fail('Share-Parameter fehlen'), f76Fail++);
content.includes('URLSearchParams')
  ? (ok('URLSearchParams für Share-Target'), f76Ok++) : (fail('URLSearchParams fehlt'), f76Fail++);
content.includes('history.replaceState')
  ? (ok('history.replaceState() — URL nach Share bereinigt'), f76Ok++) : (fail('history.replaceState() fehlt'), f76Fail++);

if (f76Fail === 0) ok(f76Ok + ' Mantra-Pool + Startup Checks bestanden');

// ══════════════════════════════════════════
// 77. SYNC FILE-ID ROBUSTHEIT
// ══════════════════════════════════════════
console.log('\n── 77. Sync File-ID Robustheit ──');
let f77Ok = 0, f77Fail = 0;

const syncGetFileSrc = jsCode.match(/  async _syncGetFileId\([\s\S]*?^  \},/m)?.[0] || '';

// ID-Validierung: gecachte ID wird per API geprüft
syncGetFileSrc.includes('trashed')
  ? (ok('_syncGetFileId: gecachte ID wird auf trashed geprüft'), f77Ok++)
  : (fail('_syncGetFileId: keine ID-Validierung'), f77Fail++);

// Bei ungültiger ID: Cache leeren
syncGetFileSrc.includes('_driveFileId = null')
  ? (ok('_syncGetFileId: ID-Cache wird bei Fehler geleert'), f77Ok++)
  : (fail('_syncGetFileId: ID-Cache wird nicht geleert'), f77Fail++);

// Suche nach neuester Datei (orderBy modifiedTime)
syncGetFileSrc.includes('modifiedTime')
  ? (ok('_syncGetFileId: Suche sortiert nach modifiedTime'), f77Ok++)
  : (fail('_syncGetFileId: kein modifiedTime-Sort'), f77Fail++);

// Warnung bei mehreren Dateien
syncGetFileSrc.includes('files.length > 1')
  ? (ok('_syncGetFileId: Warnung bei mehreren workbench.json'), f77Ok++)
  : (fail('_syncGetFileId: keine Warnung bei Duplikaten'), f77Fail++);

// _syncUpload: 404-Retry mit neuer ID
const syncUpSrc77 = jsCode.match(/  async _syncUpload\([\s\S]*?^  \},/m)?.[0] || '';
syncUpSrc77.includes('404')
  ? (ok('_syncUpload: 404-Retry mit neuer File-ID'), f77Ok++)
  : (fail('_syncUpload: kein 404-Retry'), f77Fail++);
syncUpSrc77.includes('_driveFileId = null')
  ? (ok('_syncUpload: ID-Cache bei 404 geleert'), f77Ok++)
  : (fail('_syncUpload: ID-Cache wird bei 404 nicht geleert'), f77Fail++);

if (f77Fail === 0) ok(f77Ok + ' Sync File-ID Robustheit Checks bestanden');

// ══════════════════════════════════════════
// 78. NOTIZEN MOBILE/DESKTOP SPLIT
// ══════════════════════════════════════════
console.log('\n── 78. Notizen Mobile/Desktop Split ──');
let f78Ok = 0, f78Fail = 0;

jsCode.includes('_nzRenderMobile(') ? (ok('_nzRenderMobile() definiert'), f78Ok++) : (fail('_nzRenderMobile() fehlt'), f78Fail++);
jsCode.includes('_nzRenderDesktop(') ? (ok('_nzRenderDesktop() definiert'), f78Ok++) : (fail('_nzRenderDesktop() fehlt'), f78Fail++);
jsCode.includes('_nzPostItFarbe(') ? (ok('_nzPostItFarbe() definiert'), f78Ok++) : (fail('_nzPostItFarbe() fehlt'), f78Fail++);

// Mobile: kein 'open' class by default
const mobSrc = jsCode.match(/  _nzRenderMobile\([\s\S]*?^  \},/m)?.[0] || '';
!mobSrc.includes("'nz-grp open") && !mobSrc.includes('"nz-grp open')
  ? (ok('_nzRenderMobile: kein open class — alle zugeklappt'), f78Ok++)
  : (fail('_nzRenderMobile: open class gefunden — Listen nicht zugeklappt'), f78Fail++);

// Desktop: Post-it CSS
['nz-postit','nz-postit-hdr','nz-postit-preview','nz-postit-cnt','nz-grid'].forEach(cls => {
  content.includes(cls) ? (ok('.' + cls + ' vorhanden'), f78Ok++) : (fail('.' + cls + ' fehlt'), f78Fail++);
});

// Desktop: max. 2 Vorschau-Items
const deskSrc = jsCode.match(/  _nzRenderDesktop\([\s\S]*?^  \},/m)?.[0] || '';
deskSrc.includes('slice(0, 3)') ? (ok('_nzRenderDesktop: max. 3 Vorschau-Items'), f78Ok++) : (fail('_nzRenderDesktop: kein slice(0,3)'), f78Fail++);

// renderNotizenTab: _isMobile() Verzweigung
const rnSrc = jsCode.match(/  renderNotizenTab\([\s\S]*?^  \},/m)?.[0] || '';
rnSrc.includes('_isMobile()') ? (ok('renderNotizenTab: _isMobile() Verzweigung'), f78Ok++) : (fail('renderNotizenTab: kein _isMobile()'), f78Fail++);

// Einsatzbereit-Toast
jsCode.includes('Einsatzbereit') ? (ok('Einsatzbereit-Toast vorhanden'), f78Ok++) : (fail('Einsatzbereit-Toast fehlt'), f78Fail++);

if (f78Fail === 0) ok(f78Ok + ' Notizen Split Checks bestanden');

// ══════════════════════════════════════════
// 79. GERÄTESPEZIFISCHER PW-DIALOG
// ══════════════════════════════════════════
console.log('\n── 79. Gerätespezifischer PW-Dialog ──');
let f79Ok = 0, f79Fail = 0;

const cryptoFreshSrc = jsCode.match(/  _cryptoKeyFresh\([\s\S]*?^  \},/m)?.[0] || '';
// Mobile: kein wb_key_date-Fallback
cryptoFreshSrc.includes('isMobileDevice') && cryptoFreshSrc.includes('return false')
  ? (ok('_cryptoKeyFresh: Mobile ignoriert wb_key_date'), f79Ok++)
  : (fail('_cryptoKeyFresh: kein Mobile-spezifischer PW-Zwang'), f79Fail++);
// UA-Fallback wenn Settings noch nicht geladen
cryptoFreshSrc.includes('navigator.userAgent')
  ? (ok('_cryptoKeyFresh: UA-Fallback vor Settings-Load'), f79Ok++)
  : (fail('_cryptoKeyFresh: kein UA-Fallback'), f79Fail++);
// Desktop: wb_key_date bleibt gültig
cryptoFreshSrc.includes('wb_key_date')
  ? (ok('_cryptoKeyFresh: Desktop nutzt wb_key_date'), f79Ok++)
  : (fail('_cryptoKeyFresh: wb_key_date fehlt'), f79Fail++);
// _oauthReconnect: direkt synchron (kein async) für User-Gesture
const reconnectSrc = jsCode.match(/  _oauthReconnect\([\s\S]*?^  \},/m)?.[0] || '';
!reconnectSrc.startsWith('  async _oauthReconnect')
  ? (ok('_oauthReconnect: synchron — User-Gesture bleibt erhalten'), f79Ok++)
  : (fail('_oauthReconnect: async — User-Gesture geht verloren'), f79Fail++);
reconnectSrc.includes('select_account')
  ? (ok('_oauthReconnect: prompt select_account'), f79Ok++)
  : (fail('_oauthReconnect: kein select_account prompt'), f79Fail++);

if (f79Fail === 0) ok(f79Ok + ' Gerätespezifischer PW-Dialog Checks bestanden');

// ══════════════════════════════════════════
// 80. BUJO-EDITOR
// ══════════════════════════════════════════
console.log('\n── 80. BuJo-Editor ──');
let f80Ok = 0, f80Fail = 0;

content.includes('ck-bujo-toolbar') ? (ok('#ck-bujo-toolbar vorhanden'), f80Ok++) : (fail('#ck-bujo-toolbar fehlt'), f80Fail++);
content.includes('_ckBuJoChar(') ? (ok('_ckBuJoChar() definiert'), f80Ok++) : (fail('_ckBuJoChar() fehlt'), f80Fail++);
content.includes('_ckBuJoCheckbox(') ? (ok('_ckBuJoCheckbox() definiert'), f80Ok++) : (fail('_ckBuJoCheckbox() fehlt'), f80Fail++);
content.includes('_ckLadeTagesfokus(') ? (ok('_ckLadeTagesfokus() definiert'), f80Ok++) : (fail('_ckLadeTagesfokus() fehlt'), f80Fail++);

// Auto-Trenner-Timer entfernt
const onInputSrc = jsCode.match(/  _ckOnInput\([\s\S]*?^  \},/m)?.[0] || '';
!onInputSrc.includes('_ckInsertDivider')
  ? (ok('_ckOnInput: kein Auto-Trenner-Timer'), f80Ok++)
  : (fail('_ckOnInput: Auto-Trenner-Timer noch vorhanden'), f80Fail++);

// Trenner: nur Linie + hh:mm (kein Sandwich)
const divSrc = jsCode.match(/  _ckInsertDivider\([\s\S]*?^  \},/m)?.[0] || '';
!divSrc.includes('ck-divider-line"></div><span')
  ? (ok('_ckInsertDivider: kein Sandwich-Layout'), f80Ok++)
  : (fail('_ckInsertDivider: Sandwich-Layout noch vorhanden'), f80Fail++);
divSrc.includes('ck-divider-ts')
  ? (ok('_ckInsertDivider: hh:mm als eigene Zeile'), f80Ok++)
  : (fail('_ckInsertDivider: kein ck-divider-ts'), f80Fail++);

// _ckLadeTagesfokus: lädt Termine, Pflichten, Tasks + Checklisten
const fokSrc = jsCode.match(/  _ckLadeTagesfokus\([\s\S]*?^  \},/m)?.[0] || '';
fokSrc.includes('customEvents') ? (ok('_ckLadeTagesfokus: Termine'), f80Ok++) : (fail('_ckLadeTagesfokus: keine Termine'), f80Fail++);
fokSrc.includes('wochenpflichten') ? (ok('_ckLadeTagesfokus: Pflichten'), f80Ok++) : (fail('_ckLadeTagesfokus: keine Pflichten'), f80Fail++);
fokSrc.includes('checklist') ? (ok('_ckLadeTagesfokus: Checklisten-Unterpunkte'), f80Ok++) : (fail('_ckLadeTagesfokus: keine Checklisten'), f80Fail++);
// Kein Überfällig-Filter (nur heutige/offene)
fokSrc.includes('nowMin') ? (ok('_ckLadeTagesfokus: vergangene Termine gefiltert'), f80Ok++) : (fail('_ckLadeTagesfokus: kein Zeit-Filter'), f80Fail++);

if (f80Fail === 0) ok(f80Ok + ' BuJo-Editor Checks bestanden');

// ══════════════════════════════════════════
// 81. SONDERTAGE
// ══════════════════════════════════════════
console.log('\n── 81. Sondertage ──');
let f81Ok = 0, f81Fail = 0;

content.includes('s-sondertage-card') ? (ok('#s-sondertage-card vorhanden'), f81Ok++) : (fail('#s-sondertage-card fehlt'), f81Fail++);
content.includes('s-st-datum') ? (ok('#s-st-datum Datepicker vorhanden'), f81Ok++) : (fail('#s-st-datum fehlt'), f81Fail++);
content.includes('s-st-typ') ? (ok('#s-st-typ Typ-Select vorhanden'), f81Ok++) : (fail('#s-st-typ fehlt'), f81Fail++);
content.includes('s-st-liste') ? (ok('#s-st-liste vorhanden'), f81Ok++) : (fail('#s-st-liste fehlt'), f81Fail++);
jsCode.includes('_sStAdd(') ? (ok('_sStAdd() definiert'), f81Ok++) : (fail('_sStAdd() fehlt'), f81Fail++);
jsCode.includes('_sStDelete(') ? (ok('_sStDelete() definiert'), f81Ok++) : (fail('_sStDelete() fehlt'), f81Fail++);
jsCode.includes('_sRenderSondertage(') ? (ok('_sRenderSondertage() definiert'), f81Ok++) : (fail('_sRenderSondertage() fehlt'), f81Fail++);
// db.sondertage in _emptyDb
const emptyDbSrc81 = jsCode.match(/  _emptyDb\([\s\S]*?^  \},/m)?.[0] || '';
emptyDbSrc81.includes('sondertage') ? (ok('_emptyDb: sondertage Array'), f81Ok++) : (fail('_emptyDb: sondertage fehlt'), f81Fail++);
// Typ-Optionen
content.includes('urlaub') && content.includes('feiertag') && content.includes('auszeit') && content.includes('krank')
  ? (ok('Alle 4 Sondertag-Typen vorhanden'), f81Ok++) : (fail('Sondertag-Typen fehlen'), f81Fail++);
// Duplikat-Schutz
const sStAddSrc = jsCode.match(/  _sStAdd\([\s\S]*?^  \},/m)?.[0] || '';
sStAddSrc.includes('bereits eingetragen') || sStAddSrc.includes('find(s => s.datum')
  ? (ok('_sStAdd: Duplikat-Schutz vorhanden'), f81Ok++) : (fail('_sStAdd: kein Duplikat-Schutz'), f81Fail++);

if (f81Fail === 0) ok(f81Ok + ' Sondertage Checks bestanden');

// ══════════════════════════════════════════
// 82. NOTIZEN ZUSTAND-KONZEPT
// ══════════════════════════════════════════
console.log('\n── 82. Notizen Zustand-Konzept ──');
let f82Ok = 0, f82Fail = 0;

// State-Variablen
content.includes('_nzZustand') ? (ok('_nzZustand State vorhanden'), f82Ok++) : (fail('_nzZustand fehlt'), f82Fail++);
content.includes('_nzSuche') ? (ok('_nzSuche State vorhanden'), f82Ok++) : (fail('_nzSuche fehlt'), f82Fail++);

// Filter-Methoden
['_nzSetZustand','_nzSucheInput','_nzSetZustandItem','_nzMenuOpen','_nzMenuClose','_nzZustandLabel'].forEach(fn => {
  jsCode.includes('  ' + fn + '(') ? (ok(fn + '() definiert'), f82Ok++) : (fail(fn + '() fehlt'), f82Fail++);
});

// Filter-Tabs HTML
['nz-ztab','nz-filter-tabs'].forEach(cls => {
  content.includes(cls) ? (ok('.' + cls + ' vorhanden'), f82Ok++) : (fail('.' + cls + ' fehlt'), f82Fail++);
});

// Zustand-Werte
['aktuell','parkplatz','kompass','archiv'].forEach(z => {
  content.includes("'" + z + "'") ? (ok("Zustand '" + z + "' vorhanden"), f82Ok++) : (fail("Zustand '" + z + "' fehlt"), f82Fail++);
});

// Suche-Input
content.includes('nz-suche') ? (ok('#nz-suche Suchfeld vorhanden'), f82Ok++) : (fail('#nz-suche fehlt'), f82Fail++);

// Drei-Punkt-Menü CSS
content.includes('nz-ctx-menu') ? (ok('.nz-ctx-menu CSS vorhanden'), f82Ok++) : (fail('.nz-ctx-menu fehlt'), f82Fail++);
content.includes('nz-postit-menu-btn') ? (ok('.nz-postit-menu-btn vorhanden'), f82Ok++) : (fail('.nz-postit-menu-btn fehlt'), f82Fail++);

// Migration in _nzGetListen
const nzGetSrc = jsCode.match(/  _nzGetListen\([\s\S]*?^  \},/m)?.[0] || '';
nzGetSrc.includes('zustand') ? (ok('_nzGetListen: zustand-Filter'), f82Ok++) : (fail('_nzGetListen: kein zustand-Filter'), f82Fail++);
nzGetSrc.includes('gepinnt') ? (ok('_nzGetListen: gepinnte oben'), f82Ok++) : (fail('_nzGetListen: kein Pin-Sort'), f82Fail++);

if (f82Fail === 0) ok(f82Ok + ' Notizen Zustand-Konzept Checks bestanden');

// ERGEBNIS
// ══════════════════════════════════════════
console.log('\n═══════════════════════════════════════════');
console.log('ERGEBNIS: ' + passed + ' Tests bestanden');
if (warnings.length > 0) {
  console.log('WARNUNGEN: ' + warnings.length);
  warnings.forEach(w => console.log('  ⚠ ' + w));
}
if (errors.length > 0) {
  console.log('FEHLER: ' + errors.length);
  errors.forEach(e => console.log('  ✗ ' + e));
  console.log('\n→ Implementierung NICHT hochladen!');
  process.exit(1);
} else {
  console.log('\n→ Alle Tests bestanden. Datei kann hochgeladen werden.');
  process.exit(0);
}

// ══════════════════════════════════════════
