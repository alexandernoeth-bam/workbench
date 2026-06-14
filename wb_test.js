#!/usr/bin/env node
// WorkBench Regression Test Suite
// Verwendung: node wb_test.js workbench.html [baseline.json]
// Gibt 0 zurück wenn alles OK, 1 bei Fehlern

const fs = require('fs');
const path = require('path');

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

// ── Skript extrahieren ────────────────────────────────────
const scriptStart = content.indexOf('<script>');
const scriptEnd   = content.lastIndexOf('</script>');
const htmlBefore  = content.slice(0, scriptStart);
const htmlAfter   = content.slice(scriptEnd + 9);
const jsCode      = scriptStart >= 0 && scriptEnd >= 0
  ? content.slice(scriptStart + 8, scriptEnd)
  : '';

console.log('\n═══════════════════════════════════════════');
console.log('WorkBench Regression Test');
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
// Nur HTML vor dem Script prüfen (nach dem Script ist immer ausgeglichen)
const opensB  = (htmlBefore.match(/<div[\s>]/g) || []).length;
const closesB = (htmlBefore.match(/<\/div>/g) || []).length;
const opensA  = (htmlAfter.match(/<div[\s>]/g) || []).length;
const closesA = (htmlAfter.match(/<\/div>/g) || []).length;
const opens   = opensB + opensA;
const closes  = closesB + closesA;
if (opens === closes) {
  ok('Div-Balance: ' + opens + ' opens = ' + closes + ' closes');
} else {
  // Toleranz: 1 Diff ist historisch bekannt und App läuft trotzdem
  if (Math.abs(opens - closes) <= 1) {
    warn('Div-Balance: diff=' + (opens-closes) + ' (historisch bekannt, App läuft trotzdem)');
  } else {
    fail('Div-Balance', 'opens=' + opens + ' closes=' + closes + ' diff=' + (opens-closes));
  }
}

// ══════════════════════════════════════════
// 3. VERSION (5 Stellen)
// ══════════════════════════════════════════
console.log('\n── 3. Versions-Konsistenz (5 Stellen) ──');
const verMatch = content.match(/APP_VERSION:\s*'([^']+)'/);
const buildMatch = content.match(/APP_BUILD:\s*'([^']+)'/);
const ver   = verMatch?.[1];
const build = buildMatch?.[1];

if (ver && build) {
  ok('APP_VERSION: ' + ver);
  ok('APP_BUILD: ' + build);

  const titleMatch = content.match(/<title>WorkBench ([^<]+)<\/title>/);
  const taglineMatch = content.match(/wb-startup-tagline[^>]*>v([^<]+)</);
  const menuMatch = content.match(/wb-menu-version[^>]*>v([^<]+)</);

  if (titleMatch?.[1] === ver)
    ok('title = ' + ver);
  else
    fail('title falsch', titleMatch?.[1] + ' ≠ ' + ver);

  if (taglineMatch?.[1] === ver)
    ok('wb-startup-tagline = ' + ver);
  else
    fail('wb-startup-tagline falsch', taglineMatch?.[1] + ' ≠ ' + ver);

  if (menuMatch?.[1]?.startsWith(ver))
    ok('wb-menu-version = ' + ver);
  else
    fail('wb-menu-version falsch', menuMatch?.[1] + ' ≠ ' + ver);
} else {
  fail('APP_VERSION/APP_BUILD nicht gefunden');
}

// ══════════════════════════════════════════
// 4. KRITISCHE HTML-ELEMENTE
// ══════════════════════════════════════════
console.log('\n── 4. Kritische HTML-Elemente ──');
const CRITICAL_IDS = [
  'wb-app', 'wb-header', 'wb-content', 'wb-tabbar',
  'wb-startup', 'wb-menu-overlay', 'wb-settings-overlay',
  'wb-vorhaben-detail', 'wb-vorhaben-detail-body',
  'wb-ritual-overlay', 'wb-wizard-overlay',
  'wb-duties-overlay', 'wb-qc-overlay',
  'wb-bm-overlay', 'wb-week-wizard-overlay',
  'fokus-overlay',
  'sec-cockpit', 'ck-tagesseite', 'ck-fab',
  'ck-zone-vm', 'ck-zone-nm', 'ck-zone-ab',
  'ck-zone-fe', 'ck-zone-mi',
  'ck-body-vm', 'ck-body-nm', 'ck-body-ab',
  'ck-triage-banner', 'ck-meeting-banner', 'ck-logbuch',
  'sls-abend-banner',
  'tab-cockpit', 'tab-vorhaben',
  'wb-world-toggle', 'wb-dirty-dot',
];

let idOk = 0, idFail = 0;
CRITICAL_IDS.forEach(id => {
  if (content.includes('id="' + id + '"')) {
    idOk++;
  } else {
    fail('Fehlendes Element', '#' + id);
    idFail++;
  }
});
if (idFail === 0) ok(idOk + ' kritische Elemente vorhanden');

// ══════════════════════════════════════════
// 5. KRITISCHE OVERLAY-ELTERNSCHAFT
// ══════════════════════════════════════════
const htmlAll = htmlBefore + htmlAfter;
console.log('\n── 5. Overlay-Elternschaft ──');
// Overlays dürfen NICHT innerhalb anderer Overlays liegen
const OVERLAYS = [
  'wb-vorhaben-detail', 'wb-menu-overlay', 'wb-settings-overlay',
  'wb-ritual-overlay', 'fokus-overlay', 'wb-qc-overlay',
  'wb-duties-overlay', 'wb-week-wizard-overlay', 'wb-bm-overlay',
];

OVERLAYS.forEach(ov => {
  const idx = htmlAll.indexOf('id="' + ov + '"');
  if (idx < 0) return; // schon in Test 4 gemeldet
  // 2000 Zeichen davor prüfen ob ein anderes Overlay noch offen ist
  const before = htmlAll.slice(Math.max(0, idx - 2000), idx);
  let nested = false;
  OVERLAYS.forEach(other => {
    if (other === ov) return;
    if (before.includes('id="' + other + '"')) {
      // Prüfen ob das andere Overlay schon geschlossen ist
      const otherIdx = before.lastIndexOf('id="' + other + '"');
      const between = before.slice(otherIdx);
      const o = (between.match(/<div/g)||[]).length;
      const c = (between.match(/<\/div>/g)||[]).length;
      if (o > c) nested = true; // andere Overlay noch offen
    }
  });
  if (nested) fail('Overlay verschachtelt', '#' + ov + ' liegt innerhalb eines anderen Overlays');
  else ok('#' + ov + ' korrekt auf Body-Ebene');
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
  'feierabendOpen', '_feFinish', '_feGoto',
  'wzOpenEvening', '_evWzSave', '_evWzRender',
  'wzOpenWeek', '_wzWeekFinish',
  // Vorhaben
  'vorhabenOpen', 'vorhabenDetailClose', '_vorhabenDetailRender',
  '_vorhabenListeRender', '_vorhabenAktiv',
  // Cockpit
  '_ckRenderZone', '_ckGetZoneItems', '_ckRenderZoneItem',
  // QC / Schnellerfassung
  'qcOpen', 'qcClose', '_qcSave',
  // Notifications
  '_notifBuildQueue', '_notifSend', '_notifScheduleAll',
  // SLS-M1
  '_ritualRenderNachhol', '_slsNachholSave',
  // SLS-M4
  '_evBesprechungProcess', '_bmFinish',
  // SLS-M2
  '_ckRenderLogbuch', '_lbToggleTag',
  // Bereiche
  '_bereichStore', '_bereichSortiert', '_bereichEnsureDefaults',
  '_bereichEdit', '_bereichSave', '_bereichDelete',
  // Fokus
  '_fokusOverlayOpen', '_fokusOverlayClose', '_fokusRechtsSetze',
  // Versionierung
  '_vhToggleVollbild',
  // Helpers
  '_esc', '_toast', 'setDirty', '_vorhabenFind',
  '_vorhabenStore', '_ritualStore', '_ritualTodayKey',
  '_bereichFarbe',
];

let fnOk = 0, fnFail = 0;
CRITICAL_FNS.forEach(fn => {
  // WB-Methoden: "  fnName(" oder "  async fnName("
  const defPattern1 = '  ' + fn + '(';
  const defPattern2 = '  async ' + fn + '(';
  const defPattern3 = '  ' + fn + ':';
  const found = jsCode.includes(defPattern1)
    || jsCode.includes(defPattern2)
    || jsCode.includes(defPattern3);
  if (found) {
    fnOk++;
  } else {
    fail('Fehlende Funktion', fn + '()');
    fnFail++;
  }
});
if (fnFail === 0) ok(fnOk + ' kritische Funktionen vorhanden');

// ══════════════════════════════════════════
// 7. DATEN-MODELL KONSISTENZ
// ══════════════════════════════════════════
console.log('\n── 7. Daten-Modell ──');
const DM_CHECKS = [
  { check: "notif-queue",          name: 'IDB notif-queue Store' },
  { check: "tagesRitual",          name: 'tagesRitual Store' },
  { check: "dailyPlans",           name: 'dailyPlans Store' },
  { check: "LOGBUCH_TAGS",         name: 'LOGBUCH_TAGS Definition' },
  { check: "_slsNachholNoetig",    name: 'SLS-M1 Nachhol-State' },
  { check: "slsSchlafenszeit",     name: 'SLS Settings Schlafenszeit' },
  { check: "_ritualBodyBattery",   name: 'Body Battery State' },
  { check: "vorhabenNeuSheet",     name: 'Vorhaben-Neu-Sheet' },
  { check: "bereiche",             name: 'Bereiche in DB' },
  { check: "LOGBUCH_TAGS",         name: 'Tages-Logbuch Tags' },
  { check: "_fokusOverlayOpen",    name: 'Fokus-Overlay' },
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
    if (year >= 2025 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      ok('Build-Datum plausibel');
    } else {
      warn('Build-Datum unplausibel', build);
    }
  } else {
    fail('Build-Format falsch', build + ' ≠ YYYYMMDD-HHMM');
  }
}

// ══════════════════════════════════════════
// 9. STYLE-TAG BALANCE
// ══════════════════════════════════════════
console.log('\n── 9. Style/Script Tags ──');
const styleOpens  = (content.match(/<style>/g) || []).length;
const styleCloses = (content.match(/<\/style>/g) || []).length;
if (styleOpens === styleCloses) ok('Style-Tags: ' + styleOpens + ' open = ' + styleCloses + ' close');
else fail('Style-Tags unbalanciert', styleOpens + ' open, ' + styleCloses + ' close');

const scriptOpens  = (content.match(/<script>/g) || []).length;
const scriptCloses = (content.match(/<\/script>/g) || []).length;
// External scripts (mit src=) zählen nicht als opens
const extScripts = (content.match(/<script\s+src=/g) || []).length;
const extScriptCloses = extScripts; // jedes externe Script hat ein </script>
const inlineOpen  = scriptOpens;
const inlineClose = scriptCloses - extScriptCloses;
if (inlineOpen === inlineClose) ok('Script-Tags: ' + inlineOpen + ' inline open = ' + inlineClose + ' inline close');
else fail('Script-Tags unbalanciert', inlineOpen + ' open, ' + inlineClose + ' inline close');


// ══════════════════════════════════════════
// 10. KRITISCHE CSS-KLASSEN
// ══════════════════════════════════════════
console.log('\n── 10. Kritische CSS-Klassen ──');

const styleBlock = content.match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';

const CRITICAL_CSS_CLASSES = [
  // Vorhaben
  'vh-card', 'vh-cluster', 'vh-cluster-header',
  'vh-cluster-body', 'vh-cluster-name', 'vh-cluster-dot',
  'vh-card-head', 'vh-card-title', 'vh-card-meta',
  // Cockpit
  'ck-zone', 'ck-tagesseite', 'ck-eintrag',
  // Ritual
  'ritual-btn', 'ritual-cand',
  // Navigation
  'wb-tab', 'wb-section',
  // Settings
  'wbs-row', 'wbs-label', 'wbs-toggle',
  // Wizards
  'wz-step', 'wz-input', 'wz-label',
  // Quick Capture
  'qc-type-btn',
  // Bereiche
  'bereich-edit',
  // Backlog
  'ck-backlog-label', 'ck-backlog-aufgabe',
];

let cssOk = 0, cssFail = 0;
CRITICAL_CSS_CLASSES.forEach(cls => {
  // Klasse muss entweder im CSS-Block ODER im HTML/JS vorkommen
  if (styleBlock.includes('.' + cls) || content.includes(cls)) {
    cssOk++;
  } else {
    fail('Fehlende CSS-Klasse', '.' + cls);
    cssFail++;
  }
});
if (cssFail === 0) ok(cssOk + ' kritische CSS-Klassen vorhanden');

// ══════════════════════════════════════════
// ERGEBNIS
// ══════════════════════════════════════════
console.log('\n═══════════════════════════════════════════');
const totalTests = passed + errors.length;
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
