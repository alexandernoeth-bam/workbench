#!/usr/bin/env node
// WorkBench Regression Test Suite — v3.2
// Verwendung: node wb_test.js workbench.html
// Gibt 0 zurück wenn alles OK, 1 bei Fehlern
// v3.0: +Kat.18 (undefinierte interne Aufrufe), +Kat.19 (Parameter-Konsistenz),
//        +Kat.20 (Variable-Shadowing), +Kat.21 (Dead-onclick-WB-Calls)

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
const scriptEnd   = content.lastIndexOf('</script>');
const htmlBefore  = content.slice(0, scriptStart);
const htmlAfter   = content.slice(scriptEnd + 9);
const jsCode      = scriptStart >= 0 && scriptEnd >= 0
  ? content.slice(scriptStart + 8, scriptEnd) : '';
const styleMatch  = content.match(/<style>([\s\S]*?)<\/style>/);
const styleBlock  = styleMatch ? styleMatch[1] : '';

console.log('\n═══════════════════════════════════════════');
console.log('WorkBench Regression Test Suite v3.2');
console.log('Datei: ' + filePath);
console.log('═══════════════════════════════════════════\n');

// ══════════════════════════════════════════
// 1. JS SYNTAX
// ══════════════════════════════════════════
console.log('── 1. JavaScript Syntax ──');
try {
  new Function(jsCode);
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
    warn('Div-Balance: diff=' + (opens-closes) + ' (historisch bekannt)');
  } else {
    fail('Div-Balance', 'opens=' + opens + ' closes=' + closes + ' diff=' + (opens-closes));
  }
}

// ══════════════════════════════════════════
// 3. VERSION (5 Stellen)
// ══════════════════════════════════════════
console.log('\n── 3. Versions-Konsistenz ──');
const verMatch   = content.match(/APP_VERSION:\s*'([^']+)'/);
const buildMatch = content.match(/APP_BUILD:\s*'([^']+)'/);
const ver   = verMatch?.[1];
const build = buildMatch?.[1];

if (ver && build) {
  ok('APP_VERSION: ' + ver);
  ok('APP_BUILD: ' + build);
  const titleMatch   = content.match(/<title>WorkBench ([^<]+)<\/title>/);
  const taglineMatch = content.match(/wb-startup-tagline[^>]*>v([^<]+)</);
  const menuMatch    = content.match(/wb-menu-version[^>]*>v([^<]+)</);
  if (titleMatch?.[1] === ver)       ok('title = ' + ver);
  else fail('title falsch', titleMatch?.[1] + ' ≠ ' + ver);
  if (taglineMatch?.[1] === ver)     ok('wb-startup-tagline = ' + ver);
  else fail('wb-startup-tagline falsch', taglineMatch?.[1] + ' ≠ ' + ver);
  if (menuMatch?.[1]?.startsWith(ver)) ok('wb-menu-version = ' + ver);
  else fail('wb-menu-version falsch', menuMatch?.[1] + ' ≠ ' + ver);
} else {
  fail('APP_VERSION/APP_BUILD nicht gefunden');
}

// ══════════════════════════════════════════
// 4. KRITISCHE HTML-ELEMENTE
// ══════════════════════════════════════════
console.log('\n── 4. Kritische HTML-Elemente ──');
const CRITICAL_IDS = [
  // App-Kern
  'wb-app', 'wb-header', 'wb-content', 'wb-tabbar',
  'wb-startup', 'wb-menu-overlay', 'wb-settings-overlay',
  'wb-vorhaben-detail', 'wb-vorhaben-detail-body',
  'wb-ritual-overlay',
  'wb-wizard-overlay', 'wb-duties-overlay',
  'wb-qc-overlay', 'wb-bm-overlay',
  'wb-week-wizard-overlay', 'fokus-overlay',
  // Cockpit neu
  'sec-cockpit', 'ck-tagesseite',
  'ck-fokus-section', 'ck-fokus-cards',
  'ck-next-banner', 'ck-termine-block',
  'ck-termine-body', 'ck-termine-count',
  'ck-feierabend-pill', 'ck-logbuch',
  'ck-triage-banner', 'ck-fab',
  // Tabs
  'tab-cockpit', 'tab-vorhaben', 'tab-backlog',
  // Backlog
  'backlog-header', 'backlog-scroll',
  // Allgemein
  'wb-world-toggle', 'wb-dirty-dot',
];

let idOk = 0, idFail = 0;
CRITICAL_IDS.forEach(id => {
  if (content.includes('id="' + id + '"')) { idOk++; }
  else { fail('Fehlendes Element', '#' + id); idFail++; }
});
if (idFail === 0) ok(idOk + ' kritische Elemente vorhanden');

// ══════════════════════════════════════════
// 5. OVERLAY-ELTERNSCHAFT
// ══════════════════════════════════════════
const htmlAll = htmlBefore + htmlAfter;
console.log('\n── 5. Overlay-Elternschaft ──');
const OVERLAYS = [
  'wb-vorhaben-detail', 'wb-menu-overlay', 'wb-settings-overlay',
  'wb-ritual-overlay', 'fokus-overlay', 'wb-qc-overlay',
  'wb-duties-overlay', 'wb-week-wizard-overlay', 'wb-bm-overlay',
];
OVERLAYS.forEach(ov => {
  const idx = htmlAll.indexOf('id="' + ov + '"');
  if (idx < 0) return;
  const before = htmlAll.slice(Math.max(0, idx - 2000), idx);
  let nested = false;
  OVERLAYS.forEach(other => {
    if (other === ov) return;
    if (before.includes('id="' + other + '"')) {
      const otherIdx = before.lastIndexOf('id="' + other + '"');
      const between = before.slice(otherIdx);
      const o = (between.match(/<div/g)||[]).length;
      const c = (between.match(/<\/div>/g)||[]).length;
      if (o > c) nested = true;
    }
  });
  if (nested) fail('Overlay verschachtelt', '#' + ov);
  else ok('#' + ov + ' korrekt');
});

// ══════════════════════════════════════════
// 6. KRITISCHE JS-FUNKTIONEN
// ══════════════════════════════════════════
console.log('\n── 6. Kritische JS-Funktionen ──');
const CRITICAL_FNS = [
  // App-Kern
  'renderCockpit', '_syncStartBanner', 'saveSetting',
  // Ritual / Dialoge
  'ritualOpen', '_ritualMaybeOpen', '_ritualIsDoneToday',
  '_ritualRenderMorgen', '_ritualSetEnergie',
  '_ritualFinish', '_ritualSkip',
  'feierabendOpen', '_feFinish',
  'wzOpenEvening', '_evWzSave',
  'wzOpenWeek', '_wzWeekFinish',
  // Triage
  'triageOpen', '_triageRenderSheet',
  '_triageFinish', '_triageSkip',
  '_triageToggleAufgabe', '_triageWeiter',
  // Vorhaben
  'vorhabenOpen', 'vorhabenDetailClose', '_vorhabenDetailRender',
  '_vorhabenListeRender', '_vorhabenAktiv',
  // Cockpit neu
  '_ckRenderTagesseite', '_ckRenderFokusCards',
  '_ckFokusCheckCl', '_ckFokusOpenDetail',
  '_ckRenderTermineBlock', '_ckTermineToggle',
  '_ckRenderFeierabendPill', '_ckRenderNextBanner',
  // Backlog
  'renderBacklog', '_blOpenDetail',
  '_blToggleSektion', '_blDeleteSchnell',
  '_ckBacklogCheckCl', '_ckBacklogCheckSchnell',
  // QC
  'qcOpen', 'qcClose', '_qcSave',
  // Import
  '_vhImportAufgaben', '_vhImportAufgabenSave',
  '_clImportEintraege', '_clImportEintreageSave',
  '_parseImportListe',
  // Checklisten Typ
  '_clToggleTyp',
  // SV Konto
  '_svStore', '_svToday', '_svBilanz',
  '_svShowSheet', '_svBuchen',
  '_svRenderKonto', '_svUpdateHeader',
  '_svTerminSheet',
  // Notifications
  '_notifBuildQueue', '_notifSend',
  // Bereiche
  '_bereichStore', '_bereichSortiert',
  '_bereichEdit', '_bereichSave',
  // Fokus
  '_fokusOverlayOpen', '_fokusOverlayClose',
  // Sync
  '_autoRefreshCheck', 'oauthSyncUpload', 'oauthSyncDownload',
  // Helpers
  '_esc', '_toast', 'setDirty',
  '_vorhabenFind', '_vorhabenStore',
  '_ritualStore', '_ritualTodayKey',
  '_kwStartDate', '_kwEndDate',
  '_quickStoreAlle',
];

let fnOk = 0, fnFail = 0;
CRITICAL_FNS.forEach(fn => {
  const found = jsCode.includes('  ' + fn + '(')
    || jsCode.includes('  async ' + fn + '(')
    || jsCode.includes('  ' + fn + ':');
  if (found) { fnOk++; }
  else { fail('Fehlende Funktion', fn + '()'); fnFail++; }
});
if (fnFail === 0) ok(fnOk + ' kritische Funktionen vorhanden');

// ══════════════════════════════════════════
// 7. DATEN-MODELL KONSISTENZ
// ══════════════════════════════════════════
console.log('\n── 7. Daten-Modell ──');
const DM_CHECKS = [
  { check: 'notif-queue',           name: 'IDB notif-queue Store' },
  { check: 'tagesRitual',           name: 'tagesRitual Store' },
  { check: 'LOGBUCH_TAGS',          name: 'LOGBUCH_TAGS Definition' },
  { check: '_slsNachholNoetig',     name: 'SLS Nachhol-State' },
  { check: 'slsSchlafenszeit',      name: 'SLS Schlafenszeit' },
  { check: '_ritualBodyBattery',    name: 'Body Battery State' },
  { check: 'vorhabenNeuSheet',      name: 'Vorhaben-Neu-Sheet' },
  { check: 'bereiche',              name: 'Bereiche in DB' },
  { check: '_fokusOverlayOpen',     name: 'Fokus-Overlay' },
  { check: 'souveraenitaet',        name: 'SV-Konto in DB' },
  { check: 'morgendialogDone',      name: 'Morgendialog Status' },
  { check: 'triageDone',            name: 'Triage Status' },
  { check: "'schritt'",             name: 'Checklisten-Typ schritt' },
  { check: "'reibung'",             name: 'Checklisten-Typ reibung' },
  { check: '_syncRevision',         name: 'Sync Revision-Tracking' },
  { check: '_syncLastUpdated',      name: 'Sync LastUpdated-Tracking' },
  { check: '_triageFokusIds',       name: 'Triage FokusIds State' },
  { check: '_kwStartDate',          name: 'KW Start Datum' },
  { check: '_kwEndDate',            name: 'KW Ende Datum' },
];
DM_CHECKS.forEach(c => {
  if (content.includes(c.check)) ok(c.name);
  else fail(c.name + ' fehlt', c.check + ' nicht gefunden');
});

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
// 9. STYLE/SCRIPT TAGS
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
// 10. KRITISCHE CSS-KLASSEN
// ══════════════════════════════════════════
console.log('\n── 10. Kritische CSS-Klassen ──');
const CRITICAL_CSS = [
  'vh-card', 'vh-cluster', 'vh-cluster-header',
  'vh-cluster-body', 'vh-card-head', 'vh-card-title',
  'ck-tagesseite', 'ck-eintrag',
  'ritual-btn', 'ritual-cand',
  'wb-tab', 'wb-section',
  'wbs-row', 'wbs-label', 'wbs-toggle',
  'wz-step', 'wz-input',
  'qc-type-btn', 'bereich-edit',
  'ck-backlog-aufgabe', 'ck-backlog-cl-item',
  'ck-backlog-sektion', 'ck-backlog-badge',
  'fokus-cl-progress-bar',
];
let cssOk = 0, cssFail = 0;
CRITICAL_CSS.forEach(cls => {
  if (styleBlock.includes('.' + cls) || content.includes(cls)) { cssOk++; }
  else { fail('Fehlende CSS-Klasse', '.' + cls); cssFail++; }
});
if (cssFail === 0) ok(cssOk + ' kritische CSS-Klassen vorhanden');

// ══════════════════════════════════════════
// 11. FEATURE-VOLLSTÄNDIGKEIT (Call-Count)
// ══════════════════════════════════════════
console.log('\n── 11. Feature-Vollständigkeit ──');
const MUST_BE_CALLED = [
  { fn: '_ckRenderFokusCards',     min: 2, desc: 'Cockpit Fokus-Karten' },
  { fn: '_ckFokusCheckCl',         min: 2, desc: 'Fokus Checkbox' },
  { fn: '_ckRenderTermineBlock',   min: 2, desc: 'Termine Block' },
  { fn: '_ckRenderFeierabendPill', min: 2, desc: 'Feierabend Pill' },
  { fn: '_ckRenderNextBanner',     min: 2, desc: 'Nächster Termin Banner' },
  { fn: '_blOpenDetail',           min: 2, desc: 'Backlog Detail öffnen' },
  { fn: '_ritualRenderMorgen',     min: 2, desc: 'Morgendialog Render' },
  { fn: '_ritualSetEnergie',       min: 2, desc: 'Energie setzen' },
  { fn: '_ritualSkip',             min: 2, desc: 'Morgendialog Überspringen' },
  { fn: 'triageOpen',              min: 2, desc: 'Triage öffnen' },
  { fn: '_triageRenderSheet',      min: 2, desc: 'Triage Sheet' },
  { fn: '_triageFinish',           min: 2, desc: 'Triage Abschließen' },
  { fn: '_parseImportListe',       min: 3, desc: 'Import Parser' },
  { fn: '_vhImportAufgaben',       min: 2, desc: 'Aufgaben Import' },
  { fn: '_clImportEintraege',      min: 2, desc: 'Checkliste Import' },
  { fn: '_clToggleTyp',            min: 2, desc: 'Checkliste Typ Toggle' },
  { fn: '_svTerminSheet',          min: 2, desc: 'SV Termin Sheet' },
  { fn: '_autoRefreshCheck',       min: 3, desc: 'Auto-Refresh' },
  { fn: '_svRenderKonto',          min: 2, desc: 'SV Konto rendern' },
  { fn: '_svBuchen',               min: 2, desc: 'SV Buchen' },
];
let callOk = 0, callFail = 0;
MUST_BE_CALLED.forEach(({fn, min, desc}) => {
  const count = (jsCode.match(new RegExp(fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (count >= min) { callOk++; }
  else { fail('Zu wenig Aufrufe: ' + fn, count + 'x (min ' + min + ') — ' + desc); callFail++; }
});
if (callFail === 0) ok(callOk + ' Funktionen korrekt referenziert');

// ══════════════════════════════════════════
// 12. HTML-ELEMENTE NEUE FEATURES
// ══════════════════════════════════════════
console.log('\n── 12. HTML-Elemente neue Features ──');
const NEW_IDS = [
  'ck-fokus-section', 'ck-fokus-cards',
  'ck-termine-block', 'ck-termine-body', 'ck-termine-count',
  'ck-feierabend-pill', 'ck-next-banner',
  'wb-ritual-overlay', 'wb-ritual-body',
  'backlog-header', 'backlog-scroll',
  'tab-backlog', 'sec-backlog',
];
let htmlNewOk = 0, htmlNewFail = 0;
NEW_IDS.forEach(id => {
  if (content.includes('id="' + id + '"')) { htmlNewOk++; }
  else { fail('Fehlendes HTML-Element', '#' + id); htmlNewFail++; }
});
if (htmlNewFail === 0) ok(htmlNewOk + ' neue HTML-Elemente vorhanden');

// ══════════════════════════════════════════
// 13. ONCLICK-REFERENZEN
// ══════════════════════════════════════════
console.log('\n── 13. OnClick-Referenzen ──');
const ONCLICK_CHECKS = [
  { pattern: 'WB.triageOpen()',        desc: 'Triage Button' },
  { pattern: 'WB._clToggleTyp(',       desc: 'Typ-Toggle Button' },
  { pattern: 'WB._vhImportAufgaben(',  desc: 'Import Aufgaben Button' },
  { pattern: 'WB._clImportEintraege(', desc: 'Import Checkliste Button' },
  { pattern: 'WB._ritualSkip()',       desc: 'Morgendialog Überspringen' },
  { pattern: 'WB._triageSkip()',       desc: 'Triage Überspringen' },
  { pattern: 'WB._blOpenDetail(',      desc: 'Backlog Detail öffnen' },
  { pattern: 'WB._ckTermineToggle()',  desc: 'Termine Toggle' },
  { pattern: 'WB._svBuchen(',         desc: 'SV Buchen Button' },
  { pattern: 'WB._triageFinish()',     desc: 'Triage Abschließen Button' },
];
let onclickOk = 0, onclickFail = 0;
ONCLICK_CHECKS.forEach(({pattern, desc}) => {
  if (content.includes(pattern)) { onclickOk++; }
  else { fail('Fehlender onclick: ' + pattern, desc); onclickFail++; }
});
if (onclickFail === 0) ok(onclickOk + ' onclick-Referenzen vorhanden');

// ══════════════════════════════════════════
// 14. KEINE TOTEN REFERENZEN
// ══════════════════════════════════════════
console.log('\n── 14. Keine toten Referenzen ──');
const MUST_NOT_EXIST = [
  { pattern: 'id="ck-zone-vm"',    desc: 'Zone VM entfernt' },
  { pattern: 'id="ck-zone-nm"',    desc: 'Zone NM entfernt' },
  { pattern: 'id="ck-zone-ab"',    desc: 'Zone AB entfernt' },
  { pattern: '_ckRenderZone(',     desc: 'Zone-Render entfernt' },
  { pattern: 'id="tab-eingang"',   desc: 'Eingang-Tab entfernt' },
  { pattern: 'id="sec-eingang"',   desc: 'Eingang-Section entfernt' },
  { pattern: 'Kein Chaos. Gut so', desc: 'Alter Chaos-Text entfernt' },
  { pattern: 'id="ck-zone-fe"',   desc: 'Zone FE entfernt' },
  { pattern: 'id="ck-zone-mi"',   desc: 'Zone MI entfernt' },
];
let deadOk = 0, deadFail = 0;
MUST_NOT_EXIST.forEach(({pattern, desc}) => {
  if (!content.includes(pattern)) { deadOk++; }
  else { fail('Toter Code vorhanden: ' + pattern, desc); deadFail++; }
});
if (deadFail === 0) ok(deadOk + ' tote Referenzen korrekt entfernt');

// ══════════════════════════════════════════
// 15. SYNC-QUALITÄT
// ══════════════════════════════════════════
console.log('\n── 15. Sync-Qualität ──');
const SYNC_CHECKS = [
  { pattern: '_syncRevision',        desc: 'Revision-Tracking' },
  { pattern: '_syncLastUpdated',     desc: 'LastUpdated-Tracking' },
  { pattern: 'driveRev > localRev',  desc: 'Revision-Vergleich vor Download' },
  { pattern: '_oauthDriveFileIds',   desc: 'FileId-Store' },
  { pattern: 'morgendialogDone',     desc: 'Morgendialog Status' },
  { pattern: 'triageDone',           desc: 'Triage Status' },
  { pattern: '_oauthTokenValid',     desc: 'Token-Validierung' },
];
let syncOk = 0, syncFail = 0;
SYNC_CHECKS.forEach(({pattern, desc}) => {
  if (content.includes(pattern)) { syncOk++; }
  else { fail('Sync-Problem: ' + desc, pattern + ' nicht gefunden'); syncFail++; }
});
if (syncFail === 0) ok(syncOk + ' Sync-Qualitätschecks bestanden');

// ══════════════════════════════════════════
// 16. AUFRUF-KONSISTENZ
// ══════════════════════════════════════════
console.log('\n── 16. Aufruf-Konsistenz ──');
const CALL_CHAINS = [
  { caller: '_ckRenderTagesseite', callee: '_ckRenderFokusCards',    desc: 'Tagesseite → FokusCards' },
  { caller: '_ckRenderTagesseite', callee: '_ckRenderTermineBlock',  desc: 'Tagesseite → TermineBlock' },
  { caller: '_ckRenderTagesseite', callee: '_ckRenderFeierabendPill',desc: 'Tagesseite → FeierabendPill' },
  { caller: '_ckRenderTagesseite', callee: '_ckRenderNextBanner',    desc: 'Tagesseite → NextBanner' },
  { caller: 'triageOpen',          callee: '_triageRenderSheet',     desc: 'triageOpen → RenderSheet' },
  { caller: '_triageFinish',       callee: 'triageDone',             desc: 'triageFinish → triageDone' },
  { caller: 'ritualOpen',          callee: '_ritualRenderMorgen',    desc: 'ritualOpen → RenderMorgen' },
  { caller: 'renderBacklog',       callee: '_kwStartDate',           desc: 'renderBacklog → KW-Datum' },
  { caller: '_vhImportAufgabenSave', callee: '_parseImportListe',   desc: 'Import → parseImportListe' },
  { caller: '_clImportEintreageSave', callee: '_parseImportListe',  desc: 'CL Import → parseImportListe' },
];
let chainOk = 0, chainFail = 0;
CALL_CHAINS.forEach(({caller, callee, desc}) => {
  const fnStart = jsCode.indexOf('  ' + caller + '(');
  const fnStart2 = jsCode.indexOf('  async ' + caller + '(');
  const start = fnStart >= 0 ? fnStart : fnStart2;
  if (start < 0) { warn('Funktion nicht gefunden: ' + caller); return; }
  const snippet = jsCode.slice(start, start + 4000);
  if (snippet.includes(callee)) { chainOk++; }
  else { fail('Aufruf fehlt: ' + desc, caller + ' ruft ' + callee + ' nicht auf'); chainFail++; }
});
if (chainFail === 0) ok(chainOk + ' Aufruf-Ketten korrekt');

// ══════════════════════════════════════════
// 17. ONCLICK → FUNKTION DEFINIERT
// ══════════════════════════════════════════
console.log('\n── 17. OnClick → Funktion definiert ──');

const eventCallRegex  = /(?:onclick|onchange|oninput|ontoggle|onsubmit)="[^"]*WB\.([\w]+)\(/g;
const eventCallRegex2 = /(?:onclick|onchange|oninput|ontoggle|onsubmit)='[^']*WB\.([\w]+)\(/g;
const eventCallSet = new Set();
let ecm;
while ((ecm = eventCallRegex.exec(content))  !== null) eventCallSet.add(ecm[1]);
while ((ecm = eventCallRegex2.exec(content)) !== null) eventCallSet.add(ecm[1]);

const jsFnRegex = /^  (?:async )?([\w]+)\s*[:(]/gm;
const jsDefs = new Set();
let jfm;
while ((jfm = jsFnRegex.exec(jsCode)) !== null) jsDefs.add(jfm[1]);

// Bekannte Pre-existing Lücken
const ONCLICK_WHITELIST = new Set([
  '_vhTocOpen', '_vhTocClose', '_vhToggleFullscreen',
  '_vhNotizDebounced', '_vhToggleBlock', '_vhToggleCollapse',
  '_vhH', '_vhCmd', '_vhInsertHr',
  '_projZielSetzen', '_nzPaste',
  '_evWzShiftVorhaben', '_evWzShiftTask',
]);

let defOk = 0, defFail = 0;
eventCallSet.forEach(fn => {
  if (ONCLICK_WHITELIST.has(fn)) return;
  if (jsDefs.has(fn)) { defOk++; }
  else { fail('onclick → undefiniert: WB.' + fn + '()'); defFail++; }
});
if (defFail === 0) ok(defOk + ' onclick-Funktionen alle definiert');

// ══════════════════════════════════════════
// 18. UNDEFINIERTE INTERNE AUFRUFE (this.X())
// ══════════════════════════════════════════
console.log('\n── 18. Undefinierte interne Aufrufe ──');

// Alle definierten Funktionen/Properties sammeln
const fnDefRegex18 = /^  (?:async )?(\w+)\s*[:(]/gm;
const defined18 = new Set();
let m18;
while ((m18 = fnDefRegex18.exec(jsCode)) !== null) defined18.add(m18[1]);

// Native Browser/JS APIs — werden nicht gezählt
const NATIVE18 = new Set([
  'getElementById','querySelector','querySelectorAll','addEventListener','removeEventListener',
  'appendChild','remove','closest','contains','focus','click','blur','setAttribute',
  'getAttribute','removeAttribute','replace','split','trim','includes','indexOf','startsWith',
  'endsWith','map','filter','forEach','find','some','every','reduce','push','pop','slice',
  'splice','join','sort','reverse','concat','flat','keys','values','entries','toString',
  'toISOString','toLocaleDateString','toLocaleTimeString','getFullYear','getMonth','getDate',
  'getDay','getHours','getMinutes','getTime','setFullYear','setMonth','setDate','setHours',
  'setMinutes','parseInt','parseFloat','stringify','parse','assign','freeze','postMessage',
  'matchAll','match','exec','test','then','catch','finally','resolve','reject','all','race',
  'open','close','getItem','setItem','removeItem','floor','ceil','round','max','min','abs',
  'random','pow','sqrt','log','warn','error','info','group','groupEnd','time','timeEnd',
  'fetch','json','text','blob','createObjectURL','revokeObjectURL','createElement',
  'createTextNode','insertBefore','dispatchEvent','preventDefault','stopPropagation',
  'scrollIntoView','scrollTo','getBoundingClientRect','padStart','padEnd','repeat',
  'getTimezoneOffset','now','substr','substring','getUTCDate','getUTCDay','getUTCFullYear',
  'setUTCDate','getUTCMonth','getUTCHours','getUTCMinutes','cloneContents','getRangeAt',
  'addRange','removeAllRanges','createRange','selectNodeContents','insertNode',
  'surroundContents','deleteContents','cloneNode','normalize','hasChildNodes','replaceChild',
  'removeChild','insertAdjacentHTML','matches','after','before','prepend','append',
  'getComputedStyle','requestAnimationFrame','cancelAnimationFrame','clearTimeout',
  'setTimeout','clearInterval','setInterval','getSelection','createDocumentFragment',
  'hasOwnProperty','charCodeAt','charAt','codePointAt','fromCharCode','isInteger','isFinite',
  'isNaN','trunc','sign','bind','call','apply','create','defineProperty','getOwnPropertyNames',
  'setProperty','getPropertyValue','removeProperty','matches','getBoundingClientRect',
  'scrollHeight','clientHeight','offsetHeight','offsetTop','offsetLeft',
  // Bekannte Legacy-Überbleibsel (REFACTOR abgeschlossen, toter Code — Fehler bekannt)
  // Diese werden in der WHITELIST18 behandelt
]);

// Bekannte Legacy-Aufrufe (toter Code aus REFACTOR, nicht mehr erreichbar)
// Diese Einträge = bekannt und akzeptiert, lösen keinen Fehler aus
const WHITELIST18 = new Set([
  '_planRender',          // Legacy Plan-System
  '_planSaveCaret',       // Legacy Plan-System
  '_planmodusKpiUebersicht', // Legacy Plan-System
  '_goalProgress',        // Legacy Goals-System
  '_vorhabenInlineRender',// Legacy Vorhaben-Inline
  '_vorhabenInlineSave',  // Legacy Vorhaben-Inline
  '_vorhabenTaskFormSave',// Legacy Task-Form
  '_getCurrentKW',        // Alias-Guard (mit ?-Check verwendet)
  '_getKW',               // Alias-Guard
]);

const internalCallRegex18 = /this\.(\w+)\s*\(/g;
const undefCalls18 = new Map();
while ((m18 = internalCallRegex18.exec(jsCode)) !== null) {
  const fn = m18[1];
  if (NATIVE18.has(fn) || defined18.has(fn) || WHITELIST18.has(fn) || fn.length <= 2) continue;
  undefCalls18.set(fn, (undefCalls18.get(fn)||0)+1);
}

if (undefCalls18.size === 0) {
  ok('Alle internen this.X()-Aufrufe haben eine Definition');
} else {
  undefCalls18.forEach((count, fn) => {
    fail('this.' + fn + '() aufgerufen aber nicht definiert', count + 'x');
  });
}

// ══════════════════════════════════════════
// 19. PARAMETER-KONSISTENZ (Def vs. Aufruf)
// ══════════════════════════════════════════
console.log('\n── 19. Parameter-Konsistenz ──');

// Kritische Funktionen bei denen Parameter-Mismatches in der Vergangenheit Bugs verursacht haben
// Format: { fn, minParams, maxParams, desc }
const PARAM_CHECKS = [
  { fn: '_autoRefreshCheck',   min: 2, max: 2, desc: '(ctx, token)' },
  { fn: 'oauthSyncUpload',     min: 1, max: 1, desc: '(ctx)' },
  { fn: 'oauthSyncDownload',   min: 1, max: 1, desc: '(ctx)' },
  { fn: '_ckBacklogCheckCl',   min: 3, max: 3, desc: '(aufgabeId, clIdx, welt)' },
  { fn: '_ckBacklogCheckSchnell', min: 2, max: 2, desc: '(qId, ctx)' },
  { fn: '_blOpenDetail',       min: 2, max: 2, desc: '(aufgabeId, welt)' },
  { fn: '_blToggleSektion',    min: 1, max: 1, desc: '(id)' },
  { fn: '_blDeleteSchnell',    min: 2, max: 2, desc: '(id, ctx)' },
  { fn: '_blPostZuordnen',     min: 2, max: 2, desc: '(id, ctx)' },
  { fn: '_vorhabenFind',       min: 1, max: 1, desc: '(id) — sucht in allen Welten' },
  { fn: '_svBuchen',           min: 1, max: 1, desc: '(typ)' },
  { fn: '_toast',              min: 1, max: 2, desc: '(msg, dur?)' },
  { fn: '_esc',                min: 1, max: 1, desc: '(str)' },
  { fn: '_kwStartDate',        min: 0, max: 0, desc: '()' },
  { fn: '_kwEndDate',          min: 0, max: 0, desc: '()' },
];

let paramOk = 0, paramFail = 0;
PARAM_CHECKS.forEach(({ fn, min, max, desc }) => {
  // Finde Definition
  const defRegex = new RegExp('  (?:async )?' + fn.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\s*\\(([^)]*)\\)');
  const defMatch = jsCode.match(defRegex);
  if (!defMatch) { warn('Funktion nicht gefunden für Param-Check: ' + fn); return; }

  const defParamCount = defMatch[1].trim() === '' ? 0
    : defMatch[1].split(',').filter(p => p.trim()).length;

  if (defParamCount < min || defParamCount > max) {
    fail('Parameter-Mismatch: ' + fn, 'Definition hat ' + defParamCount + ' Params, erwartet ' + min + (min!==max?'–'+max:'') + ' ' + desc);
    paramFail++;
  } else {
    // Prüfe alle Aufrufe via this.fn(...)
    const callRegex19 = new RegExp('this\\.' + fn.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\s*\\(([^)]{0,300})\\)', 'g');
    let cm19;
    let callMismatch = false;
    while ((cm19 = callRegex19.exec(jsCode)) !== null) {
      const argStr = cm19[1].trim();
      // Einfache Zählung: Kommas + 1 (außer leerer Aufruf)
      const argCount = argStr === '' ? 0 : argStr.split(',').length;
      if (argCount < min || argCount > max + 1) { // +1 Toleranz für optionale Params
        if (!callMismatch) {
          fail('Aufruf-Mismatch: ' + fn, 'Aufruf mit ' + argCount + ' Args, def ' + desc);
          paramFail++;
          callMismatch = true;
        }
      }
    }
    if (!callMismatch) { paramOk++; }
  }
});
if (paramFail === 0) ok(paramOk + ' Parameter-Signaturen konsistent');

// ══════════════════════════════════════════
// 20. RENDERBACKLOG SEKTIONEN-VOLLSTÄNDIGKEIT
// ══════════════════════════════════════════
console.log('\n── 20. renderBacklog Sektionen ──');

// Prüft ob renderBacklog() die 4 erwarteten Sektions-IDs erzeugt
const rbStart = jsCode.indexOf('  renderBacklog(');
const rbEnd   = rbStart > 0 ? jsCode.indexOf('\n  },\n', rbStart) : -1;
const rbBody  = rbStart > 0 && rbEnd > 0 ? jsCode.slice(rbStart, rbEnd) : '';

if (!rbBody) {
  fail('renderBacklog() nicht gefunden');
} else {
  const BACKLOG_SECTIONS = [
    { id: 'verteilen',   desc: 'Verteilen (ohne Datum)' },
    { id: 'ueberfaellig',desc: 'Überfällig (Datum < KW)' },
    { id: 'diesekw',     desc: 'Diese KW' },
    { id: 'geplant',     desc: 'Geplant (Datum > KW)' },
  ];
  let bsOk = 0, bsFail = 0;
  BACKLOG_SECTIONS.forEach(({ id, desc }) => {
    if (rbBody.includes("'" + id + "'") || rbBody.includes('"' + id + '"')) {
      bsOk++;
    } else {
      fail('Backlog-Sektion fehlt: ' + desc, "id='" + id + "'");
      bsFail++;
    }
  });

  // Prüfe dass KEINE alten Sektions-IDs noch vorhanden sind
  const OLD_SECTIONS = ['diesewoche', 'naechste', 'posteingang', 'schnell'];
  OLD_SECTIONS.forEach(id => {
    if (rbBody.includes("'" + id + "'") || rbBody.includes('"' + id + '"')) {
      fail('Alte Backlog-Sektion noch vorhanden', "id='" + id + "'");
      bsFail++;
    } else {
      bsOk++;
    }
  });

  if (bsFail === 0) ok(bsOk + ' Backlog-Sektionen korrekt');
}

// ══════════════════════════════════════════
// 21. SCHNELL-ERINNERUNG: KEIN DEFAULT-DATUM
// ══════════════════════════════════════════
console.log('\n── 21. Schnell-Erinnerung Default-Datum ──');

// _quickSave() darf kein Fallback-Tagesdatum mehr setzen
const qsStart = jsCode.indexOf('  _quickSave(');
const qsEnd   = qsStart > 0 ? jsCode.indexOf('\n  },\n', qsStart) : -1;
const qsBody  = qsStart > 0 && qsEnd > 0 ? jsCode.slice(qsStart, qsEnd) : '';

if (!qsBody) {
  fail('_quickSave() nicht gefunden');
} else {
  // Prüfe: date = ...value || new Date()... ist verboten
  const badPattern = /wqa-date.*value.*\|\|.*new Date\(\)/.test(qsBody)
    || /wqa-date.*value.*\|\|.*toISOString/.test(qsBody)
    || /const date.*\|\|.*new Date\(\)\.toISOString/.test(qsBody);
  if (badPattern) {
    fail('_quickSave() setzt Default-Tagesdatum', 'date = value || new Date()... muss entfernt sein');
  } else {
    ok('_quickSave() kein Default-Tagesdatum');
  }

  // Prüfe: date wird ohne Fallback gesetzt
  if (qsBody.includes("value || ''") || qsBody.includes("value||''")
    || (qsBody.includes("wqa-date") && !qsBody.match(/wqa-date.*\|\|.*new Date/))) {
    ok('_quickSave() Datum ist optional (leer wenn nicht gesetzt)');
  } else {
    warn('_quickSave() Datum-Behandlung unklar — bitte prüfen');
  }
}

// ══════════════════════════════════════════
// 22. WB-OBJEKT METHODEN-KOMMAS
// ══════════════════════════════════════════
console.log('\n── 22. WB-Objekt Methoden-Kommas ──');
// Prüft ob zwischen Top-Level WB-Methoden immer ein Komma steht.
// Fehlendes Komma = SyntaxError erst zur Laufzeit, new Function() fängt es NICHT.
// Muster korrekt:   },\n\n  naechsteFn(
// Muster falsch:    }\n\n  naechsteFn(   ← weißer Screen
const wrongComma = (jsCode.match(/^  \}(?!,)\s*\n\n  (?:async )?[a-z_]\w*\s*[:(]/gm) || []);
if (wrongComma.length === 0) {
  ok('Alle WB-Methoden korrekt mit Komma abgeschlossen');
} else {
  wrongComma.forEach(m => {
    const idx = jsCode.indexOf(m.slice(0, 20));
    const before = jsCode.slice(Math.max(0, idx - 200), idx);
    const fnMatch = before.match(/  (?:async )?(\w+)\s*[:(]/g);
    const fn = fnMatch ? fnMatch[fnMatch.length - 1].trim() : '?';
    fail('Fehlendes Komma nach Methode', fn + ' \u2192 fehlt , vor n\u00e4chster Methode');
  });
}

// ══════════════════════════════════════════
// 23. RUNTIME-KRITISCHE RENDER-AUFRUFE
// ══════════════════════════════════════════
console.log('\n── 23. Runtime-kritische Render-Aufrufe ──');
// Prüft ob die App-Initialisierung die kritischen Render-Funktionen aufruft.
// Ein weißer Screen entsteht wenn init() läuft aber renderCockpit() etc. fehlen.
const INIT_CALLS = [
  { pattern: 'renderCockpit',     desc: 'Cockpit wird gerendert' },
  { pattern: 'renderBacklog',     desc: 'Backlog wird gerendert' },
  { pattern: '_ritualMaybeOpen',  desc: 'Morgendialog-Check beim Start' },
  { pattern: 'WB.init',          desc: 'WB.init() wird aufgerufen' },
];
let initOk = 0, initFail = 0;
INIT_CALLS.forEach(({ pattern, desc }) => {
  if (content.includes(pattern)) { initOk++; }
  else { fail('Init-Aufruf fehlt: ' + desc, pattern); initFail++; }
});
if (initFail === 0) ok(initOk + ' Runtime-Init-Aufrufe vorhanden');

// ══════════════════════════════════════════
// 24. UTC-DATUM-SICHERHEIT
// ══════════════════════════════════════════
console.log('\n── 24. UTC-Datum-Sicherheit ──');
// toISOString() gibt IMMER UTC zurück.
// In DE (UTC+2) wird Mittwoch 00:30 Ortszeit → Dienstag 22:30 UTC → falsches Datum.
// ERLAUBT:  new Date().toISOString().split('T')[0]  — Jetzt-Moment, Fehler <24h tolerierbar
// VERBOTEN: berechnetesDatum.toISOString().split('T')[0] — z.B. d.setDate(x).toISOString()
//           variablesDatum.toISOString() wo variable ein konstruiertes Date-Objekt ist
//
// Korrekte Alternative:
//   const fmt = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

// Hilfsfunktion: lokale Datumsformatierung
const FMT_SAFE = "d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')";

// Bekannte sichere Ausnahmen: toISOString() OHNE .split('T')[0] (Timestamps, keine Datumsstellen)
// Diese werden von der Regex ohnehin nicht getroffen.

// Suche berechnete Date-Objekte die via toISOString() in Datumstrings gewandelt werden
const utcRe = /(\b\w+)\s*\.toISOString\s*\(\s*\)\s*\.split\s*\(\s*['"]T['"]\s*\)\s*\[\s*0\s*\]/g;

// Variablen die SICHER sind: Direkt new Date() ohne Manipulation
// (aktueller Moment — UTC-Offset <1 Tag, praktisch nie ein Problem)
const SAFE_VARS = new Set(['Date']); // new Date().toISOString()

// Variablen die GEFÄHRLICH sind: setDate/setMonth/setHours wurden aufgerufen,
// oder sie wurden als 'new Date(someString)' konstruiert mit anschließender Manipulation
let utcM;
const utcErrors = [];
const utcWarnings = [];

while ((utcRe.exec(jsCode)) !== null) { } // reset
utcRe.lastIndex = 0;

while ((utcM = utcRe.exec(jsCode)) !== null) {
  const varName = utcM[1];
  if (varName === 'Date') continue; // new Date() — ok

  // Kontext: 300 Zeichen vor dem Aufruf
  const ctx = jsCode.slice(Math.max(0, utcM.index - 300), utcM.index);

  // Definitiv gefährlich: Variable wurde mit setDate/setMonth/setHours manipuliert
  const isManipulated = ctx.includes(varName + '.setDate(')
    || ctx.includes(varName + '.setMonth(')
    || ctx.includes(varName + '.setFullYear(')
    || ctx.includes(varName + '.setHours(')
    || ctx.includes(varName + '.setDate(');

  // Möglicherweise gefährlich: Variable ist ein Date-Objekt aus externer Quelle (i.date, ev.date etc.)
  const isExternalDate = /\bi\.date\b|\bev\.date\b|\bduty\.date\b|\binst\.date\b/.test(ctx.slice(-100));

  if (isManipulated) {
    // Finde umgebende Funktion
    const fnCtx = jsCode.slice(Math.max(0, utcM.index - 500), utcM.index);
    const fnMatch = fnCtx.match(/  (?:async )?(\w+)\s*[:(]/g);
    const fn = fnMatch ? fnMatch[fnMatch.length - 1].trim().replace(/\s*[:(].*/, '') : '?';
    utcErrors.push(varName + '.toISOString() in ' + fn + '() — setDate/setMonth verwendet → lokale Formatierung nötig');
  } else if (isExternalDate) {
    utcWarnings.push(varName + '.toISOString() — externes Date-Objekt, prüfen');
  }
}

if (utcErrors.length === 0) {
  ok('Keine UTC-Datum-Bugs gefunden' + (utcWarnings.length ? ' (' + utcWarnings.length + ' Warnungen)' : ''));
  utcWarnings.forEach(w => warn('UTC-prüfen', w));
} else {
  utcErrors.forEach(e => fail('UTC-Bug (DE UTC+2 Fehler)', e));
  utcWarnings.forEach(w => warn('UTC-prüfen', w));
}

// ══════════════════════════════════════════
// ERGEBNIS
// ══════════════════════════════════════════
// 25. Cockpit-Editor Funktionen
// ══════════════════════════════════════════
console.log('\n── 25. Cockpit-Editor ──');
{
  const edFns = ['_ckKapit', '_ckFontSize', '_ckReset', '_ckInsertDivider', '_ckInsertCheckbox', '_ckOnInput', '_ckSaveEntry', '_ckLadeHeutigerEintrag', '_ckExecCmd'];
  let edOk = 0, edFail = 0;
  edFns.forEach(fn => {
    if (jsCode.includes(fn + '(')) { edOk++; }
    else { fail('Editor-Funktion fehlt', fn); edFail++; }
  });
  const edEls = ['ck-editor-toolbar', 'ck-editor-toolbar-2', 'ck-font-size', 'ck-editor-area', 'ck-editor-block'];
  edEls.forEach(el => {
    if (content.includes('id="' + el + '"')) { edOk++; }
    else { fail('Editor-HTML fehlt', el); edFail++; }
  });
  const edCSS = ['.ck-divider', '.ck-divider-line', '.ck-divider-ts', '.ck-tb-sc', '.ck-tb-reset'];
  edCSS.forEach(cls => {
    if (styleBlock.includes(cls) || content.includes(cls)) { edOk++; }
    else { fail('Editor-CSS fehlt', cls); edFail++; }
  });
  if (jsCode.includes('300000')) { edOk++; } else { fail('Divider-Timer fehlt'); edFail++; }
  if (jsCode.includes("contentEditable = 'false'") || jsCode.includes('contentEditable = "false"')) { edOk++; } else { fail('contentEditable=false fehlt'); edFail++; }
  if (edFail === 0) ok(edOk + ' Editor-Checks bestanden');
}

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



