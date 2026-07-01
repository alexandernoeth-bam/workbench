#!/usr/bin/env node
// WorkBench 5 Regression Test Suite
// Verwendung: node wb5_test.js workbench.html
// Gibt 0 zurück wenn alles OK, 1 bei Fehlern

const fs = require('fs');
const filePath = process.argv[2];
if (!filePath) { console.error('Usage: node wb5_test.js workbench.html'); process.exit(1); }

const content = fs.readFileSync(filePath, 'utf8');
const errors = [];
const warnings = [];
let passed = 0;

function ok(name)      { console.log('  ✓ ' + name); passed++; }
function fail(name, d) { console.log('  ✗ ' + name + (d ? ': ' + d : '')); errors.push(name + (d ? ': ' + d : '')); }
function warn(name, d) { console.log('  ⚠ ' + name + (d ? ': ' + d : '')); warnings.push(name); }

const scriptStart = content.indexOf('<script>');
const scriptEnd   = content.lastIndexOf('</script>');
const htmlBefore  = content.slice(0, scriptStart);
const htmlAfter   = content.slice(scriptEnd + 9);
const jsCode      = scriptStart >= 0 && scriptEnd >= 0 ? content.slice(scriptStart + 8, scriptEnd) : '';
const styleMatch  = content.match(/<style>([\s\S]*?)<\/style>/);
const styleBlock  = styleMatch ? styleMatch[1] : '';

console.log('\n═══════════════════════════════════════════');
console.log('WorkBench 5 Regression Test Suite');
console.log('Datei: ' + filePath);
console.log('═══════════════════════════════════════════\n');

// ══════════════════════════════════════════
// 1. JS SYNTAX
// ══════════════════════════════════════════
console.log('── 1. JavaScript Syntax ──');
try { new Function(jsCode); ok('JS-Syntax fehlerfrei'); }
catch(e) { fail('JS-Syntax', e.message.split('\n')[0]); }

// ══════════════════════════════════════════
// 2. HTML DIV-BALANCE
// ══════════════════════════════════════════
console.log('\n── 2. HTML Div-Balance ──');
const opensB  = (htmlBefore.match(/<div[\s>]/g) || []).length;
const closesB = (htmlBefore.match(/<\/div>/g) || []).length;
const opensA  = (htmlAfter.match(/<div[\s>]/g) || []).length;
const closesA = (htmlAfter.match(/<\/div>/g) || []).length;
const opens   = opensB + opensA;
const closes  = closesB + closesA;
if (opens === closes) ok('Div-Balance: ' + opens + ' opens = ' + closes + ' closes');
else fail('Div-Imbalance', opens + ' opens vs ' + closes + ' closes');

// ══════════════════════════════════════════
// 3. VERSIONS-KONSISTENZ (5 Stellen)
// ══════════════════════════════════════════
console.log('\n── 3. Versions-Konsistenz (5 Stellen) ──');
const verMatch = jsCode.match(/APP_VERSION:\s*'([^']+)'/);
const ver = verMatch ? verMatch[1] : null;
const buildMatch = jsCode.match(/APP_BUILD:\s*'([^']+)'/);
const build = buildMatch ? buildMatch[1] : null;
if (ver) ok('APP_VERSION: ' + ver); else fail('APP_VERSION fehlt');
if (build) ok('APP_BUILD: ' + build); else fail('APP_BUILD fehlt');
if (ver && content.includes('<title>WorkBench ' + ver + '</title>')) ok('title = ' + ver);
else fail('title stimmt nicht mit APP_VERSION überein');
if (ver && content.includes('>v' + ver + ' \u00b7')) ok('wb-startup-tagline = ' + ver);
else fail('wb-startup-tagline stimmt nicht überein');
// WB5 hat s-ov-version statt wb-menu-version
if (content.includes('s-ov-version')) ok('s-ov-version Element vorhanden');
else fail('s-ov-version fehlt');

// ══════════════════════════════════════════
// 4. WB-OBJEKT METHODEN-KOMMAS
// ══════════════════════════════════════════
console.log('\n── 4. WB-Objekt Methoden-Kommas ──');
const linesSplit = jsCode.split('\n');
const badMethods = [];
linesSplit.forEach((line, i) => {
  if (/^  (async\s+)?[a-zA-Z_]\w*\s*\(/.test(line) && !/^\s{4,}/.test(line)) {
    const name = line.trim().split(/[\s(]/)[0].replace(/^async\s+/, '');
    if (['if','for','while','switch','function','return','const','let','var','document','window'].includes(name)) return;
    let prev = '';
    for (let j = i - 1; j >= 0 && j >= i - 20; j--) {
      const candidate = linesSplit[j].trim();
      if (candidate === '' || candidate.startsWith('//')) continue;
      prev = candidate; break;
    }
    const prevNoComment = prev.replace(/\/\/.*$/, '').trimEnd();
    if (!/[,{]$/.test(prevNoComment) && i > 5) badMethods.push((i+1) + ': ' + line.trim().slice(0,40));
  }
});
if (badMethods.length === 0) ok('Alle WB-Methoden korrekt mit Komma abgeschlossen');
else badMethods.slice(0,3).forEach(m => fail('Fehlendes Komma vor Methode', m));

// ══════════════════════════════════════════
// 5. BUILD-TIMESTAMP
// ══════════════════════════════════════════
console.log('\n── 5. Build-Timestamp ──');
if (build) {
  if (/^\d{8}-\d{4}$/.test(build)) ok('Build-Format korrekt: ' + build);
  else fail('Build-Format falsch', build);
  const bYear = parseInt(build.slice(0,4));
  const bMonth = parseInt(build.slice(4,6));
  if (bYear >= 2024 && bYear <= 2030 && bMonth >= 1 && bMonth <= 12) ok('Build-Datum plausibel');
  else fail('Build-Datum unplausibel', build);
}

// ══════════════════════════════════════════
// 6. STYLE/SCRIPT TAGS
// ══════════════════════════════════════════
console.log('\n── 6. Style/Script Tags ──');
const styleOpens  = (content.match(/<style>/g) || []).length;
const styleCloses = (content.match(/<\/style>/g) || []).length;
if (styleOpens === styleCloses) ok('Style-Tags: ' + styleOpens + ' open = ' + styleCloses + ' close');
else fail('Style-Tag-Imbalance', styleOpens + ' vs ' + styleCloses);
const scriptOpens  = (content.match(/<script[\s>]/g) || []).length;
const scriptCloses = (content.match(/<\/script>/g) || []).length;
if (scriptOpens === scriptCloses) ok('Script-Tags: ' + scriptOpens + ' open = ' + scriptCloses + ' close');
else fail('Script-Tag-Imbalance', scriptOpens + ' open vs ' + scriptCloses + ' close');

// ══════════════════════════════════════════
// 7. UTC-DATUM-SICHERHEIT
// ══════════════════════════════════════════
console.log('\n── 7. UTC-Datum-Sicherheit ──');
jsCode.includes('_dStr(') ? ok('_dStr() vorhanden — UTC-sichere Datumsformatierung') : fail('_dStr() fehlt');
const isoUsages = (jsCode.match(/\.toISOString\(\)\.slice\(0,10\)/g) || []).length;
if (isoUsages === 0) ok('Keine UTC-Datum-Bugs gefunden');
else warn('Verdächtige .toISOString().slice(0,10) Aufrufe', isoUsages + 'x');

// ══════════════════════════════════════════
// 8. ONCLICK → FUNKTION DEFINIERT
// ══════════════════════════════════════════
console.log('\n── 8. OnClick → Funktion definiert ──');
const onclickFns = new Set();
const onclickRx  = /WB\.([a-zA-Z_][a-zA-Z0-9_]*)\s*[\(&]/g;
let oc;
while ((oc = onclickRx.exec(content)) !== null) onclickFns.add(oc[1]);
const missingFns = [];
onclickFns.forEach(fn => { if (!jsCode.includes(fn + '(') && !jsCode.includes(fn + ':')) missingFns.push(fn); });
if (missingFns.length === 0) ok(onclickFns.size + ' onclick-Funktionen alle definiert');
else missingFns.slice(0,5).forEach(fn => fail('Funktion nicht definiert: WB.' + fn));

// ══════════════════════════════════════════
// 9. CSS-VARIABLEN
// ══════════════════════════════════════════
console.log('\n── 9. CSS-Variablen ──');
const cssVars = ['--bg','--surface','--surface2','--border','--text','--muted','--faint','--accent','--danger'];
let cssVarOk = 0;
cssVars.forEach(v => { if (styleBlock.includes(v + ':')) cssVarOk++; else fail('CSS-Variable fehlt', v); });
if (cssVarOk === cssVars.length) ok(cssVarOk + ' CSS-Variablen definiert');

// ══════════════════════════════════════════
// 10. IDB-VOLLSTÄNDIGKEIT
// ══════════════════════════════════════════
console.log('\n── 10. IDB-Vollständigkeit ──');
const idbChecks = ['IDB_NAME','IDB_VERSION','idbOpen','idbGet','idbSet','idbLoad','idbSave'];
let idbOk = 0;
idbChecks.forEach(c => { if (jsCode.includes(c)) idbOk++; else fail(c + ' fehlt'); });
if (idbOk === idbChecks.length) ok(idbOk + ' IDB-Konstanten und -Methoden vorhanden');
jsCode.includes("'workbench-slim'") ? ok("IDB_NAME = 'workbench-slim' (WB4-kompatibel)") : fail("IDB_NAME nicht 'workbench-slim'");

// ══════════════════════════════════════════
// 11. INIT-SEQUENZ
// ══════════════════════════════════════════
console.log('\n── 11. Init-Sequenz ──');
jsCode.includes('async init()') ? ok('init() ist async') : fail('init() nicht async');
jsCode.includes('idbOpen()') ? ok('idbOpen() in init()') : fail('idbOpen() fehlt');
jsCode.includes('idbLoad()') ? ok('idbLoad() in init()') : fail('idbLoad() fehlt');
jsCode.includes('setDirty') && jsCode.includes('setTimeout') ? ok('setDirty() hat Debounce-Timer') : fail('setDirty Debounce fehlt');
jsCode.includes('_sLoadSettings()') ? ok('_sLoadSettings() in init()') : fail('_sLoadSettings() fehlt');
jsCode.includes('_syncStart()') ? ok('_syncStart() in init()') : fail('_syncStart() fehlt');

// ══════════════════════════════════════════
// 12. WB5 DB-SCHEMA (workbench-slim kompatibel)
// ══════════════════════════════════════════
console.log('\n── 12. DB-Schema ──');
const dbFields = ['customEvents','sondertage','wochenMottos','themen','aufgaben','gateways','_version: 2'];
dbFields.forEach(f => {
  jsCode.includes(f) ? ok(f + ' in DB') : fail(f + ' fehlt in DB');
});
jsCode.includes('_ensureDbFields') ? ok('_ensureDbFields() vorhanden') : fail('_ensureDbFields() fehlt');
jsCode.includes('_migrateToV4')    ? ok('_migrateToV4() vorhanden')    : fail('_migrateToV4() fehlt');
jsCode.includes('_wb5MergeGateways') ? ok('_wb5MergeGateways() vorhanden (WB4→WB5 Kompatibilität)') : fail('_wb5MergeGateways() fehlt');

// ══════════════════════════════════════════
// 13. WB5 TAB-ROUTING
// ══════════════════════════════════════════
console.log('\n── 13. WB5 Tab-Routing ──');
['heute','themen','termine','fokus'].forEach(tab => {
  content.includes('wb5-' + tab + '-tab') ? ok('Tab-HTML: wb5-' + tab + '-tab') : fail('Tab-HTML fehlt: wb5-' + tab + '-tab');
});
jsCode.includes('showTab(') ? ok('showTab() definiert') : fail('showTab() fehlt');
jsCode.includes('renderSection(') ? ok('renderSection() definiert') : fail('renderSection() fehlt');
['_ht5Render','_tm5Render','_te5Render','_fk5Render'].forEach(fn => {
  jsCode.includes(fn) ? ok(fn + ' definiert') : fail(fn + ' fehlt');
});

// ══════════════════════════════════════════
// 14. SYNC-ARCHITEKTUR
// ══════════════════════════════════════════
console.log('\n── 14. Sync-Architektur ──');
jsCode.includes('_syncDownload') ? ok('_syncDownload() definiert') : fail('_syncDownload() fehlt');
jsCode.includes('_syncUpload')   ? ok('_syncUpload() definiert')   : fail('_syncUpload() fehlt');
jsCode.includes('_syncInitDone') ? ok('_syncInitDone Flag vorhanden') : fail('_syncInitDone fehlt');
jsCode.includes('AES-GCM') || jsCode.includes('AES-256') || jsCode.includes('aes') || jsCode.includes('_cryptoEncrypt') ? ok('AES-Verschlüsselung vorhanden') : fail('AES-Verschlüsselung fehlt');
const syncDlCode = jsCode.match(/_syncDownload[\s\S]{0,2000}/)?.[0] || '';
!syncDlCode.includes('_migrateFromOldDb') && !syncDlCode.includes('_migrateToV4') ?
  ok('Migration NICHT in _syncDownload (sicher)') :
  fail('KRITISCH: Migration fälschlicherweise in _syncDownload!');

// ══════════════════════════════════════════
// 15. OAUTH
// ══════════════════════════════════════════
console.log('\n── 15. OAuth ──');
jsCode.includes('_oauthTokenValid')      ? ok('_oauthTokenValid() vorhanden')      : fail('_oauthTokenValid() fehlt');
jsCode.includes('_oauthShowBanner')      ? ok('_oauthShowBanner() vorhanden')      : fail('_oauthShowBanner() fehlt');
jsCode.includes('_oauthReconnectAndSync') ? ok('_oauthReconnectAndSync() vorhanden') : fail('_oauthReconnectAndSync() fehlt');
jsCode.includes('oauthSignOut')          ? ok('oauthSignOut() vorhanden')          : fail('oauthSignOut() fehlt');
jsCode.includes('347268246401') || jsCode.includes('_oauthClientId') ? ok('OAuth Client-ID vorhanden') : fail('OAuth Client-ID fehlt');
jsCode.includes('DRIVE_SCOPE') && jsCode.includes('googleapis.com/auth/drive') ? ok('DRIVE_SCOPE definiert') : fail('DRIVE_SCOPE fehlt — OAuth schlägt lautlos fehl');

// ══════════════════════════════════════════
// 16. EINSTELLUNGEN
// ══════════════════════════════════════════
console.log('\n── 16. Einstellungen ──');
content.includes('wb-settings-overlay') ? ok('#wb-settings-overlay vorhanden') : fail('#wb-settings-overlay fehlt');
jsCode.includes('settingsOpen()')  ? ok('settingsOpen() definiert')  : fail('settingsOpen() fehlt');
jsCode.includes('settingsClose()') ? ok('settingsClose() definiert') : fail('settingsClose() fehlt');
jsCode.includes('_sLoadSettings')  ? ok('_sLoadSettings() definiert') : fail('_sLoadSettings() fehlt');
jsCode.includes('_sSaveSettings')  ? ok('_sSaveSettings() definiert') : fail('_sSaveSettings() fehlt');
jsCode.includes('_sToggleSync')    ? ok('_sToggleSync() definiert')   : fail('_sToggleSync() fehlt');
jsCode.includes('_sRenderSondertage') ? ok('_sRenderSondertage() definiert') : fail('_sRenderSondertage() fehlt');
jsCode.includes('_sSaveClientId')  ? ok('_sSaveClientId() definiert') : fail('_sSaveClientId() fehlt');
// Kein darkMode in WB5
!jsCode.includes('darkMode') ? ok('darkMode entfernt (WB5 fixes Farbschema)') : warn('darkMode noch vorhanden');

// ══════════════════════════════════════════
// 17. WELT-SYSTEM (WB4-Kompatibilität)
// ══════════════════════════════════════════
console.log('\n── 17. Welt-System ──');
jsCode.includes('_weltOk(') ? ok('_weltOk() definiert') : fail('_weltOk() fehlt');
jsCode.includes("activeWorld") ? ok('activeWorld State vorhanden') : fail('activeWorld fehlt');
jsCode.includes("'beruf'||wRaw==='pro'") || jsCode.includes("wRaw==='beruf'||wRaw==='pro'") ?
  ok('WB4-Kompatibilität: beruf/pro → b') : fail('WB4 welt-Mapping fehlt (beruf/pro→b)');
jsCode.includes("'privat'||wRaw==='priv'") || jsCode.includes("wRaw==='privat'||wRaw==='priv'") ?
  ok('WB4-Kompatibilität: privat/priv → p') : fail('WB4 welt-Mapping fehlt (privat/priv→p)');
content.includes('wb-welt-filter') ? ok('Welt-Filter im Header') : fail('Welt-Filter fehlt');
content.includes('setWelt(') ? ok('setWelt() definiert') : fail('setWelt() fehlt');

// ══════════════════════════════════════════
// 18. LAYOUT
// ══════════════════════════════════════════
console.log('\n── 18. Layout ──');
jsCode.includes('_isMobile') ? ok('_isMobile() definiert') : fail('_isMobile() fehlt');
content.includes('id="wb-app"')    ? ok('#wb-app vorhanden')    : fail('#wb-app fehlt');
content.includes('wb-bottom-nav')  ? ok('#wb-bottom-nav vorhanden') : fail('#wb-bottom-nav fehlt');
content.includes('100dvh')         ? ok('100dvh für mobile Höhe') : fail('100dvh fehlt');
ok('max-width wird separat in Kat. 44 geprüft');
styleBlock.includes('flex-wrap') ? ok('flex-wrap für Mobile-Safety') : fail('flex-wrap fehlt');
styleBlock.includes('word-break') ? ok('word-break für lange Texte') : fail('word-break fehlt');
styleBlock.includes('min-width') ? ok('min-width Schutz vorhanden') : fail('min-width fehlt');

// ══════════════════════════════════════════
// 19. WB5 BOTTOM-NAV ICONS
// ══════════════════════════════════════════
console.log('\n── 19. Bottom-Nav Icons ──');
// Kein Emoji-Fallback — nur Tabler Icons oder echte SVG
// SVG-basierte Icons prüfen (kein Tabler-Webfont mehr)
['M12 2v2m0 16v2','rect x="3" y="5"','rect x="4" y="5"','M7 4v16'].forEach((path,i) => {
  const names=['Sonne (Heute)','Liste (Themen)','Kalender (Termine)','Play (Fokus)'];
  content.includes(path) ? ok('SVG-Icon vorhanden: '+names[i]) : fail('SVG-Icon fehlt: '+names[i]);
});
// Inline SVG Icons (kein CDN-Abhängigkeit)
content.includes('<svg') && (content.match(/<svg/g)||[]).length >= 4 ?
  ok('Icons als inline SVG vorhanden (' + (content.match(/<svg/g)||[]).length + ' SVGs)') :
  fail('Inline SVG Icons fehlen');
// Keine Emoji-Entitäten im Nav
// Settings-Button im Header
content.includes('wb-header-settings') ? ok('Settings-Button im Header vorhanden') : fail('Settings-Button im Header fehlt');
// Kein Gear-Float-Button mehr
!content.includes('id="wb-menu-btn"') ? ok('Floating Gear-Button entfernt') : warn('Floating Gear-Button noch vorhanden');

// ══════════════════════════════════════════
// 20. HEUTE-TAB
// ══════════════════════════════════════════
console.log('\n── 20. Heute-Tab ──');
content.includes('id="wb5-heute"') ? ok('#wb5-heute Container vorhanden') : fail('#wb5-heute fehlt');
content.includes('wb5-deadline')   ? ok('wb5-deadline CSS/HTML vorhanden') : fail('wb5-deadline fehlt');
jsCode.includes('_ht5Hinweise')    ? ok('_ht5Hinweise() definiert') : fail('_ht5Hinweise() fehlt');
jsCode.includes('_ht5Toggle')      ? ok('_ht5Toggle() definiert')   : fail('_ht5Toggle() fehlt');
jsCode.includes('_isRoutineHeute') ? ok('_isRoutineHeute() definiert') : fail('_isRoutineHeute() fehlt');
// "läuft"-Bug-Fix: endTime null darf nicht als "laufend" gelten
jsCode.includes('kein endTime, kein durationMin') || jsCode.includes('return false; // kein endTime') ?
  ok('läuft-Bug gefixt: null-endTime nicht als laufend') : fail('läuft-Bug nicht gefixt: null-endTime wird als laufend gewertet');
// Checkbox-Toggle
jsCode.includes('_ht5Toggle') && jsCode.includes('event.stopPropagation()') ?
  ok('Checkbox-Toggle mit stopPropagation') : fail('Checkbox-Toggle fehlt stopPropagation');

// ══════════════════════════════════════════
// 21. THEMEN-TAB
// ══════════════════════════════════════════
console.log('\n── 21. Themen-Tab ──');
content.includes('id="wb5-themen"')       ? ok('#wb5-themen Container vorhanden')    : fail('#wb5-themen fehlt');
jsCode.includes('_tm5OpenOverlay')         ? ok('_tm5OpenOverlay() definiert')        : fail('_tm5OpenOverlay() fehlt');
jsCode.includes('_tm5RenderOverlayBody')   ? ok('_tm5RenderOverlayBody() definiert')  : fail('_tm5RenderOverlayBody() fehlt');
jsCode.includes('_tm5CloseOverlay')        ? ok('_tm5CloseOverlay() definiert')       : fail('_tm5CloseOverlay() fehlt');
content.includes('wb5-thema-overlay')      ? ok('Thema-Overlay HTML vorhanden')       : fail('Thema-Overlay fehlt');
content.includes('wb5-overlay-panel')      ? ok('wb5-overlay-panel CSS vorhanden')    : fail('wb5-overlay-panel fehlt');
jsCode.includes('wb5-gw-block')            ? ok('Gateway-Block gerendert')            : fail('Gateway-Block fehlt');
// WB4→WB5 Aufgaben-Merge
jsCode.includes('rootAufg') && jsCode.includes('themaId') ?
  ok('WB4-Aufgaben-Merge (themaId→t.aufgaben[])') : fail('WB4-Aufgaben-Merge fehlt');
// Freie Aufgaben ohne themaId
jsCode.includes('!a.themaId') ? ok('Freie Aufgaben filter (!themaId)') : fail('Freie Aufgaben filter fehlt');

// ══════════════════════════════════════════
// 22. TERMINE-TAB
// ══════════════════════════════════════════
console.log('\n── 22. Termine-Tab ──');
content.includes('id="wb5-woche"')    ? ok('#wb5-woche vorhanden')         : fail('#wb5-woche fehlt');
content.includes('id="wb5-monat"')    ? ok('#wb5-monat vorhanden')         : fail('#wb5-monat fehlt');
jsCode.includes('_te5RenderWoche')    ? ok('_te5RenderWoche() definiert')   : fail('_te5RenderWoche() fehlt');
jsCode.includes('_te5RenderMonat')    ? ok('_te5RenderMonat() definiert')   : fail('_te5RenderMonat() fehlt');
jsCode.includes('_te5NavWeek')        ? ok('_te5NavWeek() definiert')       : fail('_te5NavWeek() fehlt');
jsCode.includes('_te5SetView')        ? ok('_te5SetView() definiert')       : fail('_te5SetView() fehlt');
// Monats-Picker
jsCode.includes('_te5OpenPicker')     ? ok('_te5OpenPicker() definiert')    : fail('_te5OpenPicker() fehlt');
jsCode.includes('_te5PickerYear')     ? ok('_te5PickerYear() definiert')    : fail('_te5PickerYear() fehlt');
jsCode.includes('_te5SelectMonth')    ? ok('_te5SelectMonth() definiert')   : fail('_te5SelectMonth() fehlt');
// Heute-Button
jsCode.includes('_te5GoToday')        ? ok('_te5GoToday() definiert')       : fail('_te5GoToday() fehlt');
content.includes('wb5-heute-btn')     ? ok('wb5-heute-btn CSS vorhanden')   : fail('wb5-heute-btn fehlt');
// Termin speichern
jsCode.includes('_te5Save')           ? ok('_te5Save() definiert')          : fail('_te5Save() fehlt');
jsCode.includes('_terminNeu')         ? ok('_terminNeu() definiert')        : fail('_terminNeu() fehlt');
// Mehrtage-Zeitraum
jsCode.includes('isRange') && jsCode.includes('sondertage') ?
  ok('Mehrtage-Zeitraum (Urlaub/Dienstreise)') : fail('Mehrtage-Zeitraum fehlt');

// ══════════════════════════════════════════
// 23. FOKUS-TAB
// ══════════════════════════════════════════
console.log('\n── 23. Fokus-Tab ──');
content.includes('id="wb5-fokus"')    ? ok('#wb5-fokus Container vorhanden') : fail('#wb5-fokus fehlt');
content.includes('wb5-fokus-screen')  ? ok('Fokus-Screen (App-Sperre) vorhanden') : fail('wb5-fokus-screen fehlt');
jsCode.includes('_fk5Start')          ? ok('_fk5Start() definiert')          : fail('_fk5Start() fehlt');
jsCode.includes('_fk5Stop')           ? ok('_fk5Stop() definiert')           : fail('_fk5Stop() fehlt');
jsCode.includes('_fk5Pause')          ? ok('_fk5Pause() definiert')          : fail('_fk5Pause() fehlt');
jsCode.includes('_fk5SetTimer')       ? ok('_fk5SetTimer() definiert')       : fail('_fk5SetTimer() fehlt');
jsCode.includes('_fk5CustomTimer')    ? ok('_fk5CustomTimer() definiert')    : fail('_fk5CustomTimer() fehlt');
jsCode.includes('_fk5UpdateTimer')    ? ok('_fk5UpdateTimer() definiert')    : fail('_fk5UpdateTimer() fehlt');
jsCode.includes('fokusTypen')         ? ok('fokusTypen (Checklisten-Templates) vorhanden') : fail('fokusTypen fehlt');
jsCode.includes('_fkTimerSecs')       ? ok('Timer-State _fkTimerSecs vorhanden') : fail('_fkTimerSecs fehlt');

// ══════════════════════════════════════════
// 24. SONDERTAGE
// ══════════════════════════════════════════
console.log('\n── 24. Sondertage ──');
jsCode.includes('_sRenderSondertage') ? ok('_sRenderSondertage() definiert') : fail('_sRenderSondertage() fehlt');
// Sondertage jetzt im Termine-Tab
jsCode.includes('_te5AddSondertag')    ? ok('_te5AddSondertag() definiert')    : fail('_te5AddSondertag() fehlt');
jsCode.includes('_te5SaveSondertag')   ? ok('_te5SaveSondertag() definiert')   : fail('_te5SaveSondertag() fehlt');
jsCode.includes('_te5DeleteSondertag') ? ok('_te5DeleteSondertag() definiert') : fail('_te5DeleteSondertag() fehlt');
// Sondertage sind im Termine-Tab, nicht mehr in Einstellungen-HTML
!content.slice(0, content.indexOf('<script>')).includes('s-sondertage-list') ?
  ok('s-sondertage-list aus Einstellungen-HTML entfernt') :
  fail('s-sondertage-list noch im Einstellungen-HTML');
// Sondertage-Render muss s-st-row nutzen (nicht s-row für Layout)
jsCode.includes('s-st-row') ? ok('s-st-row CSS-Klasse in Sondertage-Render') : fail('s-st-row fehlt — Sondertage-Layout kaputt');
// Sondertage-Render muss s-st-text und s-st-del nutzen
jsCode.includes('s-st-text') ? ok('s-st-text CSS-Klasse vorhanden') : fail('s-st-text fehlt');
jsCode.includes('s-st-del')  ? ok('s-st-del CSS-Klasse vorhanden')  : fail('s-st-del fehlt');

// ══════════════════════════════════════════
// 25. AUFGABEN
// ══════════════════════════════════════════
console.log('\n── 25. Aufgaben ──');
jsCode.includes('_aufgabeNeu()')     ? ok('_aufgabeNeu() definiert')     : fail('_aufgabeNeu() fehlt');
jsCode.includes('_na5Save()')        ? ok('_na5Save() definiert')        : fail('_na5Save() fehlt');
jsCode.includes('_aufgabeDetail(')   ? ok('_aufgabeDetail() definiert')  : fail('_aufgabeDetail() fehlt');
jsCode.includes('_aufgabeDelete(')   ? ok('_aufgabeDelete() definiert')  : fail('_aufgabeDelete() fehlt');
jsCode.includes('_aufgabeNeuFuerThema') ? ok('_aufgabeNeuFuerThema() definiert') : fail('_aufgabeNeuFuerThema() fehlt');
// erledigt-Kompatibilität WB4/WB5
jsCode.includes("a.status==='erledigt'") ?
  ok('WB4-Kompatibilität: status=erledigt erkannt') : fail('WB4 erledigt-Status nicht erkannt');

// ══════════════════════════════════════════
// 26. WIEDERHOLUNG
// ══════════════════════════════════════════
console.log('\n── 26. Wiederholung (Routinen) ──');
jsCode.includes('_isRoutineHeute') ? ok('_isRoutineHeute() definiert') : fail('_isRoutineHeute() fehlt');
jsCode.includes('wiederholung')    ? ok('wiederholung-Feld geprüft')   : fail('wiederholung fehlt');
jsCode.includes("'wöchentlich'") || jsCode.includes('w\u00f6chentlich') ?
  ok('wöchentlich Routinen') : fail('wöchentlich Routinen fehlt');
jsCode.includes("'monatlich'") ?
  ok('monatlich Routinen') : fail('monatlich Routinen fehlt');
jsCode.includes("'jährlich'") || jsCode.includes('j\u00e4hrlich') ?
  ok('jährlich Routinen') : fail('jährlich Routinen fehlt');
jsCode.includes('wochentage') ?
  ok('wochentage[] für Wochentag-Prüfung') : fail('wochentage[] fehlt');

// ══════════════════════════════════════════
// 27. MODAL
// ══════════════════════════════════════════
console.log('\n── 27. Modal ──');
content.includes('wb-modal-overlay') ? ok('#wb-modal-overlay vorhanden') : fail('#wb-modal-overlay fehlt');
jsCode.includes('modalOpen(')  ? ok('modalOpen() definiert')  : fail('modalOpen() fehlt');
jsCode.includes('modalClose()') ? ok('modalClose() definiert') : fail('modalClose() fehlt');

// ══════════════════════════════════════════
// 28. ENTFERNTE WB4-FEATURES (dürfen nicht vorhanden sein)
// ══════════════════════════════════════════
console.log('\n── 28. Entfernte WB4-Features ──');
!content.includes('id="sec-notizen"')  ? ok('sec-notizen entfernt')   : fail('sec-notizen noch vorhanden');
!content.includes('id="sec-wissen"')   ? ok('sec-wissen entfernt')    : fail('sec-wissen noch vorhanden');
!content.includes('id="sec-cockpit"')  ? ok('sec-cockpit entfernt')   : fail('sec-cockpit noch vorhanden');
!content.includes('id="sec-assistent"') ? ok('WB4 sec-assistent entfernt') : fail('WB4 sec-assistent noch vorhanden');
!jsCode.includes('renderNotizenTab')   ? ok('renderNotizenTab entfernt') : fail('renderNotizenTab noch vorhanden');
!jsCode.includes('_ck4RenderThemen')   ? ok('_ck4RenderThemen entfernt') : fail('_ck4RenderThemen noch vorhanden');
!jsCode.includes('_sSetDevice')        ? ok('_sSetDevice entfernt')      : fail('_sSetDevice noch vorhanden');
!jsCode.includes('darkMode')           ? ok('darkMode entfernt')         : warn('darkMode noch vorhanden');

// ══════════════════════════════════════════
// 29. LAUFEND-BUG (endTime null)
// ══════════════════════════════════════════
console.log('\n── 29. läuft-Bug: endTime null ──');
// Prüfe dass der Fallback '23:59' NICHT direkt bei laufend-Filterung verwendet wird
const laufendCode = jsCode.match(/const laufend[\s\S]{0,300}/)?.[0] || '';
!laufendCode.includes("||'23:59'") && !laufendCode.includes("|| '23:59'") ?
  ok("Kein '23:59' Fallback bei laufend-Filterung") :
  fail("KRITISCH: '23:59' Fallback macht alle Termine ohne endTime zu 'laufend'");
laufendCode.includes('durationMin') ?
  ok('durationMin als Fallback für endTime-Berechnung') :
  warn('durationMin nicht als Fallback genutzt');

// ══════════════════════════════════════════
// 30. CRYPTO
// ══════════════════════════════════════════
console.log('\n── 30. Crypto ──');
jsCode.includes('_cryptoEncrypt') ? ok('_cryptoEncrypt() definiert') : fail('_cryptoEncrypt() fehlt');
jsCode.includes('_cryptoDecrypt') ? ok('_cryptoDecrypt() definiert') : fail('_cryptoDecrypt() fehlt');
jsCode.includes('_cryptoUnlock')  ? ok('_cryptoUnlock() definiert')  : fail('_cryptoUnlock() fehlt');
jsCode.includes('_cryptoChangePassword') ? ok('_cryptoChangePassword() definiert') : fail('_cryptoChangePassword() fehlt');
content.includes('wb-crypto-overlay') ? ok('#wb-crypto-overlay vorhanden') : fail('#wb-crypto-overlay fehlt');

// ══════════════════════════════════════════
// 31. OVERLAYS IN #WB-APP (480px Breite)
// ══════════════════════════════════════════
console.log('\n── 31. Overlays in #wb-app ──');
// Alle position:fixed Overlays müssen position:absolute sein (innerhalb #wb-app)
const fixedOverlays = ['wb-crypto-overlay','wb-modal-overlay','wb-settings-overlay','wb5-fokus-screen','wb-toast'];
fixedOverlays.forEach(id => {
  const cssMatch = styleBlock.match(new RegExp('#' + id + '[^{]*\\{([^}]+)'));
  if(!cssMatch){ fail(id + ': CSS nicht gefunden'); return; }
  const css = cssMatch[1];
  !css.includes('position:fixed') ? ok(id + ': position:absolute (nicht fixed)') : fail(id + ': noch position:fixed — bricht aus #wb-app heraus!');
});
// Crypto/Modal/Settings/Fokus innerhalb #wb-app
const wbAppHtml = content.slice(content.indexOf('<div id="wb-app">'), content.indexOf('\n<script>'));
fixedOverlays.forEach(id => {
  wbAppHtml.includes('id="' + id + '"') ? ok(id + ' innerhalb #wb-app') : fail(id + ' außerhalb #wb-app!');
});


// ══════════════════════════════════════════
// 32. REQUIRED PROPERTIES (this.XYZ Referenzen)
// ══════════════════════════════════════════
console.log('\n── 32. Required Properties ──');
// Alle this.GROSSBUCHSTABEN Referenzen müssen als Property definiert sein
const requiredProps = ['IDB_NAME','IDB_VERSION','DRIVE_SCOPE','DRIVE_API','UPLOAD_API','APP_VERSION','APP_BUILD'];
requiredProps.forEach(prop => {
  const defined = new RegExp(prop + '\\s*:').test(jsCode);
  const used    = jsCode.includes('this.' + prop);
  if (used && !defined) fail(prop + ' wird verwendet (this.' + prop + ') aber nicht definiert!');
  else if (defined) ok(prop + ' definiert und verwendbar');
  else ok(prop + ' nicht verwendet (OK)');
});
// _oauthClientId muss gesetzt sein
jsCode.includes('_oauthClientId:') ? ok('_oauthClientId als Property definiert') : fail('_oauthClientId fehlt');

// ══════════════════════════════════════════
// 33. MODAL ID-KONSISTENZ
// ══════════════════════════════════════════
console.log('\n── 33. Modal ID-Konsistenz ──');
// modalOpen() muss dieselben IDs nutzen wie das HTML
const modalIds = ['wb-modal-overlay','wb-modal-title','wb-modal-body','wb-modal-foot'];
modalIds.forEach(id => {
  const inHtml = content.includes('id="' + id + '"');
  const inJs   = jsCode.includes("'" + id + "'");
  if(inHtml && inJs) ok(id + ' in HTML und JS konsistent');
  else if(inHtml && !inJs) warn(id + ' im HTML aber nicht in modalOpen() JS');
  else if(!inHtml && inJs) fail(id + ' in JS referenziert aber nicht im HTML!');
});
// Kein wb-modal-footer (alter Name)
!jsCode.includes('wb-modal-footer') ? ok('wb-modal-footer nicht verwendet (korrekter Name: wb-modal-foot)') : fail('wb-modal-footer verwendet — muss wb-modal-foot heißen');

// ══════════════════════════════════════════
// 34. CRYPTO-INIT FLOW
// ══════════════════════════════════════════
console.log('\n── 34. Crypto-Init Flow ──');
jsCode.includes('_cryptoKeyFresh()') ? ok('_cryptoKeyFresh() in init() aufgerufen') : fail('_cryptoKeyFresh() fehlt in init()');
jsCode.includes('_cryptoShowDialog') ? ok('_cryptoShowDialog() vorhanden') : fail('_cryptoShowDialog() fehlt');
jsCode.includes('_wb5InitAfter')     ? ok('_wb5InitAfter() als Post-Crypto-Init vorhanden') : fail('_wb5InitAfter() fehlt');
// _cryptoShowDialog muss wb-crypto-input nutzen (nicht wb-crypto-pw)
!jsCode.includes("getElementById('wb-crypto-pw')") ? ok('_cryptoShowDialog nutzt wb-crypto-input') : fail('_cryptoShowDialog sucht wb-crypto-pw — Element heißt wb-crypto-input!');


// ══════════════════════════════════════════
// 35. DIALOGE: NEU + BEARBEITEN
// ══════════════════════════════════════════
console.log('\n── 35. Dialoge: Neu + Bearbeiten ──');
// Thema
jsCode.includes('_themaDialog(')    ? ok('_themaDialog() vorhanden (Neu+Bearbeiten)') : fail('_themaDialog() fehlt');
jsCode.includes('_thd5Save(')       ? ok('_thd5Save() vorhanden')  : fail('_thd5Save() fehlt');
jsCode.includes('_thd5Delete(')     ? ok('_thd5Delete() vorhanden') : fail('_thd5Delete() fehlt');
// Termin
jsCode.includes('_terminDialog(')   ? ok('_terminDialog() vorhanden (Neu+Bearbeiten)') : fail('_terminDialog() fehlt');
jsCode.includes('_te5DSave(')       ? ok('_te5DSave() vorhanden')   : fail('_te5DSave() fehlt');
// Aufgabe
jsCode.includes('_aufgabeSave(')    ? ok('_aufgabeSave() vorhanden') : fail('_aufgabeSave() fehlt');
// Fokus-Checklisten
jsCode.includes('_fk5NeuTyp()')     ? ok('_fk5NeuTyp() vorhanden')       : fail('_fk5NeuTyp() fehlt');
jsCode.includes('_fk5TypSave()')    ? ok('_fk5TypSave() vorhanden')       : fail('_fk5TypSave() fehlt');
jsCode.includes('_fk5EditTypDialog') ? ok('_fk5EditTypDialog() vorhanden') : fail('_fk5EditTypDialog() fehlt');
jsCode.includes('_fk5TypDelete(')   ? ok('_fk5TypDelete() vorhanden')     : fail('_fk5TypDelete() fehlt');
// addNew() für alle Tabs
jsCode.includes("activeTab==='themen')  this._themaDialog") ? ok('addNew() → Thema-Dialog') : fail('addNew() für Themen-Tab fehlt');
jsCode.includes("activeTab==='fokus')   this._fk5NeuTyp")   ? ok('addNew() → Fokus-Checkliste') : fail('addNew() für Fokus-Tab fehlt');

// ══════════════════════════════════════════
// 36. OAUTH BANNER-FLOW
// ══════════════════════════════════════════
console.log('\n── 36. OAuth Banner-Flow ──');
jsCode.includes('_oauthHideBanner()') ? ok('_oauthHideBanner() aufgerufen') : fail('_oauthHideBanner() fehlt');
// _oauthReconnectAndSync muss HideBanner aufrufen wenn Token da
const reconnectCode = jsCode.match(/_oauthReconnectAndSync[\s\S]{0,800}/)?.[0]||'';
reconnectCode.includes('_oauthHideBanner') ? ok('_oauthReconnectAndSync ruft _oauthHideBanner auf') : fail('_oauthReconnectAndSync ruft _oauthHideBanner NICHT auf — Banner bleibt nach Login!');
reconnectCode.includes('_sUpdateSyncStatus') ? ok('_sUpdateSyncStatus nach Login aufgerufen') : fail('_sUpdateSyncStatus fehlt nach Login');


// ══════════════════════════════════════════
// 37. DUPLIZIEREN
// ══════════════════════════════════════════
console.log('\n── 37. Duplizieren ──');
jsCode.includes('_te5DuplizierenTermin(') ? ok('_te5DuplizierenTermin() vorhanden') : fail('_te5DuplizierenTermin() fehlt');
jsCode.includes('_duplizierenAufgabe(')   ? ok('_duplizierenAufgabe() vorhanden')   : fail('_duplizierenAufgabe() fehlt');
jsCode.includes('_duplizierenThema(')     ? ok('_duplizierenThema() vorhanden')      : fail('_duplizierenThema() fehlt');
// Buttons in Dialogen
jsCode.includes('_te5DuplizierenTermin') && content.includes('Duplizieren') ? ok('Duplizieren-Button in Termin-Dialog') : fail('Duplizieren-Button in Termin-Dialog fehlt');

// ══════════════════════════════════════════
// 38. AUFGABEN-FELDER & OVERLAY-REFRESH
// ══════════════════════════════════════════
console.log('\n── 38. Aufgaben-Felder & Overlay-Refresh ──');
jsCode.includes('wb5-na-typ')  ? ok('Typ-Feld in Aufgaben-Dialog') : fail('Typ-Feld fehlt in Aufgaben-Dialog');
jsCode.includes('wb5-na-wdh')  ? ok('Wiederholung in Aufgaben-Dialog') : fail('Wiederholung fehlt in Aufgaben-Dialog');
jsCode.includes('wiederholung=wdh?{typ:wdh') ? ok('Wiederholung wird gespeichert') : fail('Wiederholung wird nicht gespeichert');
// Overlay-Refresh nach Aufgabe anlegen
jsCode.includes('_tm5RenderOverlayBody') && jsCode.includes('_na5ThemaId=null') ?
  ok('Overlay-Refresh nach Aufgabe im Thema') : fail('Overlay-Refresh fehlt — Aufgabe erscheint erst nach Reload');

// ══════════════════════════════════════════
// 39. WELT-PILL STATT PUNKT
// ══════════════════════════════════════════
console.log('\n── 39. Welt-Pill ──');
jsCode.includes('_weltPill(')     ? ok('_weltPill() Hilfsfunktion vorhanden') : fail('_weltPill() fehlt');
content.includes('wb5-welt-pill') ? ok('wb5-welt-pill CSS vorhanden')         : fail('wb5-welt-pill CSS fehlt');
content.includes('wb5-welt-pill-b') ? ok('wb5-welt-pill-b (Beruf) CSS')       : fail('wb5-welt-pill-b fehlt');
content.includes('wb5-welt-pill-p') ? ok('wb5-welt-pill-p (Privat) CSS')      : fail('wb5-welt-pill-p fehlt');

// ══════════════════════════════════════════
// 40. SYNC-DOWNLOAD KORREKT
// ══════════════════════════════════════════
console.log('\n── 40. Sync-Download ──');
// _syncDownload Inhalts-Check via indexOf (Funktion kann >5000 Zeichen sein)
const syncDlStart = jsCode.indexOf('async _syncDownload()');
const syncDlEnd   = jsCode.indexOf('\n  },', syncDlStart + 100);
const syncDlFn    = syncDlStart >= 0 ? jsCode.slice(syncDlStart, syncDlEnd) : '';
syncDlFn.includes('_wb5MergeGateways') ? ok('_wb5MergeGateways nach Download aufgerufen') : fail('_wb5MergeGateways fehlt in _syncDownload!');
syncDlFn.includes('_ensureDbFields')   ? ok('_ensureDbFields nach Download aufgerufen')    : fail('_ensureDbFields fehlt in _syncDownload');
!syncDlFn.includes('tabSwitch(')       ? ok('kein tabSwitch() in _syncDownload (WB5-kompatibel)') : fail('tabSwitch() in _syncDownload — WB5 nutzt showTab()!');
!syncDlFn.includes('_nzRenderPills')   ? ok('kein _nzRenderPills() in _syncDownload (WB5)')       : warn('_nzRenderPills in _syncDownload — Notizen-Tab existiert in WB5 nicht');


// ══════════════════════════════════════════
// 41. OAUTH BANNER SOFORT
// ══════════════════════════════════════════
console.log('\n── 41. OAuth Banner-Start ──');
// Banner muss sofort in _wb5InitAfter gezeigt werden, nicht erst nach 60s
const iaStart=jsCode.indexOf('async _wb5InitAfter()');const iaEnd=jsCode.indexOf('\n  },',iaStart+50);const initAfterCode=iaStart>=0?jsCode.slice(iaStart,iaEnd):'';
initAfterCode.includes('_oauthTokenValid') ? ok('_oauthTokenValid in _wb5InitAfter — Banner sofort') : fail('Banner-Check fehlt in _wb5InitAfter — erscheint erst nach 60s!');
initAfterCode.includes('_oauthShowBanner') ? ok('_oauthShowBanner in _wb5InitAfter aufgerufen')      : fail('_oauthShowBanner fehlt in _wb5InitAfter');
// Banner-Button muss _oauthReconnect() nutzen (synchron, kein await = kein Popup-Block)
content.includes('onclick="WB._oauthReconnect()">') ? ok('Banner-Button → _oauthReconnect() (synchron)') : fail('Banner-Button nutzt nicht _oauthReconnect() — Popup kann geblockt werden!');

// ══════════════════════════════════════════
// 42. GATEWAY-VERWALTUNG
// ══════════════════════════════════════════
console.log('\n── 42. Gateway-Verwaltung ──');
jsCode.includes('_gw5Neu(')    ? ok('_gw5Neu() vorhanden')    : fail('_gw5Neu() fehlt — kein Gateway +Neu!');
jsCode.includes('_gw5Save(')   ? ok('_gw5Save() vorhanden')   : fail('_gw5Save() fehlt');
jsCode.includes('_gw5Delete(') ? ok('_gw5Delete() vorhanden') : fail('_gw5Delete() fehlt');
jsCode.includes('+ Gateway')   ? ok('+ Gateway Button im Overlay') : fail('+ Gateway Button fehlt im Overlay');

// ══════════════════════════════════════════
// 43. AUFGABEN-DIALOG VOLLSTÄNDIG
// ══════════════════════════════════════════
console.log('\n── 43. Aufgaben-Dialog vollständig ──');
jsCode.includes('wb5-ad-typ')  ? ok('Typ-Feld in Aufgaben-Bearbeiten')           : fail('Typ-Feld fehlt in _aufgabeDetail');
jsCode.includes('wb5-ad-wdh')  ? ok('Wiederholung in Aufgaben-Bearbeiten')       : fail('Wiederholung fehlt in _aufgabeDetail');
jsCode.includes('wb5-ad-b')    ? ok('Beruf/Privat in Aufgaben-Bearbeiten')        : fail('Welt-Toggle fehlt in _aufgabeDetail');
jsCode.includes('_ad5Welt(')   ? ok('_ad5Welt() vorhanden')                      : fail('_ad5Welt() fehlt');

// ══════════════════════════════════════════
// 44. VOLLE BREITE (kein max-width)
// ══════════════════════════════════════════
console.log('\n── 44. Volle Breite ──');
!content.includes('max-width:480px') && !content.includes('max-width: 480px') && !content.includes('max-width:min(480px') ?
  ok('Kein max-width auf #wb-app — volle Breite') :
  fail('max-width begrenzt die App-Breite — soll entfernt sein');


// ══════════════════════════════════════════
// 45. DUPLIKATE-FREIHEIT
// ══════════════════════════════════════════
console.log('\n── 45. Keine doppelten Funktionen ──');
const fnDefs = jsCode.match(/^\s{2}(?:async\s+)?([a-zA-Z_]\w*)\s*[\(&]/gm)||[];
const fnNames = fnDefs.map(l=>l.trim().replace(/^async\s+/,'').split(/[\s\(&]/)[0]);
const counts = {};
fnNames.forEach(n=>{counts[n]=(counts[n]||0)+1;});
const dupes = Object.entries(counts).filter(([n,c])=>c>1).map(([n])=>n);
if(dupes.length===0) ok('Keine doppelten Funktionen im WB-Objekt');
else dupes.slice(0,5).forEach(n=>fail('Doppelte Funktion: '+n+' — nur erstes Vorkommen wird ausgeführt!'));

// ══════════════════════════════════════════
// 46. THEMA/GATEWAY BEARBEITEN
// ══════════════════════════════════════════
console.log('\n── 46. Thema/Gateway Bearbeiten ──');
content.includes('id="wb5-ov-edit-btn"')  ? ok('Bearbeiten-Button im Thema-Overlay HTML') : fail('Bearbeiten-Button fehlt im Thema-Overlay!');
jsCode.includes('wb5-ov-edit-btn')         ? ok('Bearbeiten-Button in _tm5OpenOverlay verlinkt') : fail('Bearbeiten-Button nicht in JS verlinkt');
jsCode.includes('_gw5Edit(')              ? ok('_gw5Edit() vorhanden')         : fail('_gw5Edit() fehlt');
jsCode.includes('_gw5SaveEdit(')          ? ok('_gw5SaveEdit() vorhanden')     : fail('_gw5SaveEdit() fehlt');


// ══════════════════════════════════════════
// 47. CRYPTO-KEYCHECK KORREKT
// ══════════════════════════════════════════
console.log('\n── 47. Crypto-KeyCheck ──');
// _cryptoKeyFresh darf NICHT nur wb_key_date prüfen
// wb_key_date allein reicht nicht: nach Browser-Neustart ist sessionStorage leer
const kfStart=jsCode.indexOf('_cryptoKeyFresh() {');const kfEnd=jsCode.indexOf('\n  },',kfStart+10);const keyFreshFn=kfStart>=0?jsCode.slice(kfStart,kfEnd):'';
// wb_key_date darf nur in Kommentaren vorkommen, nicht im aktiven Code
const keyFreshCode = keyFreshFn.replace(/\/\/[^\n]*/g,''); // Kommentare entfernen
!keyFreshCode.includes('wb_key_date') ?
  ok('_cryptoKeyFresh nutzt kein wb_key_date-Fallback (sessionStorage ist die Wahrheit)') :
  fail('_cryptoKeyFresh nutzt wb_key_date im aktiven Code — Dialog erscheint nach Browser-Neustart nicht!');
keyFreshFn.includes('wb_enc_pw') ?
  ok('_cryptoKeyFresh prüft wb_enc_pw in sessionStorage') :
  fail('_cryptoKeyFresh prüft wb_enc_pw nicht');


// ══════════════════════════════════════════
// 48. KEINE WB4-FUNKTIONEN IN SYNCDOWNLOAD
// ══════════════════════════════════════════
console.log('\n── 48. Keine WB4-Funktionen in _syncDownload ──');
const sdStart = jsCode.indexOf('async _syncDownload()');
const sdEnd   = jsCode.indexOf('\n  },', sdStart + 100);
const sdFn    = sdStart >= 0 ? jsCode.slice(sdStart, sdEnd) : '';
const wb4Only = ['_nzAutoFarbe','_nzRenderPills','_nzRenderAll','tabSwitch','_tsKachelOpen'];
wb4Only.forEach(fn => {
  !sdFn.includes(fn) ? ok(fn + ' nicht in _syncDownload') : fail(fn + ' in _syncDownload — WB4-Funktion fehlt in WB5!');
});


// ══════════════════════════════════════════
// 49. MINDEST-SCHRIFTGRÖSSE 12px
// ══════════════════════════════════════════
console.log('\n── 49. Mindest-Schriftgröße 12px ──');
const allCssSizes = (styleBlock.match(/font-size:(\d+)px/g)||[]).map(s=>parseInt(s.replace('font-size:','').replace('px','')));
// Nav-Labels dürfen 11px sein (5 Tabs auf Mobile passen sonst nicht)
// wb-nav-label ist Ausnahme — alle anderen müssen ≥14px sein
const tooSmallCss = allCssSizes.filter(s=>s<14).filter(s=>s!==11);
if(tooSmallCss.length===0) ok('CSS: alle Schriftgrößen ≥ 14px (Nav-Label 11px erlaubt)');
else fail('CSS: ' + tooSmallCss.length + ' Schriftgrößen unter 14px: ' + [...new Set(tooSmallCss)].sort((a,b)=>a-b).join('px, ') + 'px');
const allJsSizes = (jsCode.match(/font-size:(\d+)px/g)||[]).map(s=>parseInt(s.replace('font-size:','').replace('px','')));
const tooSmallJs = allJsSizes.filter(s=>s<14);
if(tooSmallJs.length===0) ok('JS inline: alle Schriftgrößen ≥ 14px (' + allJsSizes.length + ' geprüft)');
else fail('JS inline: ' + tooSmallJs.length + ' Schriftgrößen unter 14px: ' + [...new Set(tooSmallJs)].sort((a,b)=>a-b).join('px, ') + 'px');


// ══════════════════════════════════════════
// 50. WIEDERHOLUNG: WOCHENTAGE-AUSWAHL
// ══════════════════════════════════════════
console.log('\n── 50. Wiederholung Wochentage ──');
jsCode.includes('_na5WdhChange(') ? ok('_na5WdhChange() vorhanden — Wochentage ein/ausblenden') : fail('_na5WdhChange() fehlt');
jsCode.includes('_na5WtToggle(')  ? ok('_na5WtToggle() vorhanden — Wochentag toggeln')         : fail('_na5WtToggle() fehlt');
jsCode.includes('wb5-na-tage-wrap') ? ok('wb5-na-tage-wrap vorhanden (Wochentage-Bereich)')     : fail('wb5-na-tage-wrap fehlt');
jsCode.includes('wb5-wt-btn')     ? ok('wb5-wt-btn (Wochentag-Buttons) vorhanden')              : fail('wb5-wt-btn fehlt');
jsCode.includes("dataset.wt")     ? ok('dataset.wt für Wochentag-Wert genutzt')                 : fail('dataset.wt fehlt — Wochentage werden nicht gespeichert');
content.includes('wb5-wt-row')    ? ok('wb5-wt-row CSS vorhanden')                              : fail('wb5-wt-row CSS fehlt');


// ══════════════════════════════════════════
// 51. THEMEN-TAB: FREIE AUFGABE + OVERFLOW
// ══════════════════════════════════════════
console.log('\n── 51. Themen-Tab Freie Aufgabe + Modal ──');
jsCode.includes('+ Freie Aufgabe') ? ok('+ Freie Aufgabe Button im Themen-Tab') : fail('+ Freie Aufgabe Button fehlt im Themen-Tab');
// #wb-app darf kein overflow:hidden haben (Modal würde abgeschnitten)
const appCss = styleBlock.match(/#wb-app\s*\{([^}]+)}/)?.[1]||'';
!appCss.includes('overflow:hidden') ? ok('#wb-app kein overflow:hidden — Modal sichtbar') : fail('#wb-app hat overflow:hidden — Modal/Settings werden abgeschnitten!');


// ══════════════════════════════════════════
// 52. THEMA-ZUORDNUNG BEI AUFGABEN
// ══════════════════════════════════════════
console.log('\n── 52. Thema-Zuordnung Aufgaben ──');
jsCode.includes('wb5-na-thema') ? ok('Thema-Select in _aufgabeNeu') : fail('Thema-Select fehlt in _aufgabeNeu');
jsCode.includes('wb5-ad-thema') ? ok('Thema-Select in _aufgabeDetail') : fail('Thema-Select fehlt in _aufgabeDetail');
jsCode.includes('themaIdSel')   ? ok('_na5Save liest Thema aus Select') : fail('_na5Save liest Thema nicht aus Select');
jsCode.includes('newThemaId')   ? ok('_aufgabeSave verarbeitet Thema-Wechsel') : fail('Thema-Wechsel in _aufgabeSave fehlt');


// ══════════════════════════════════════════
// 53. AUFGABEN-DIALOG VOLLSTÄNDIG
// ══════════════════════════════════════════
console.log('\n── 53. Aufgaben-Dialog Felder ──');
jsCode.includes('wb5-na-notiz')  ? ok('Notiz-Feld in _aufgabeNeu')     : fail('Notiz-Feld fehlt in _aufgabeNeu');
jsCode.includes('wb5-ad-notiz')  ? ok('Notiz-Feld in _aufgabeDetail')  : fail('Notiz-Feld fehlt in _aufgabeDetail');
jsCode.includes('wb5-na-thema')  ? ok('Thema-Select in _aufgabeNeu')   : fail('Thema-Select fehlt');
jsCode.includes('wb5-ad-thema')  ? ok('Thema-Select in _aufgabeDetail') : fail('Thema-Select fehlt in Detail');
jsCode.includes('wb5-na-wdh')    ? ok('Wiederholung in _aufgabeNeu')   : fail('Wiederholung fehlt');
jsCode.includes('wb5-na-tage-wrap') ? ok('Wochentage-Bereich vorhanden') : fail('Wochentage-Bereich fehlt');

// ══════════════════════════════════════════
// 54. HEUTE-TAB SORTIERUNG
// ══════════════════════════════════════════
console.log('\n── 54. Heute-Tab Sortierung ──');
// Im _ht5Render: offen.forEach muss VOR erledigt.forEach kommen
const htStart = jsCode.indexOf('  _ht5Render() {');
const htEnd   = jsCode.indexOf('\n  },', htStart + 50);
const htFn    = htStart >= 0 ? jsCode.slice(htStart, htEnd) : '';
const idxOffen = htFn.indexOf('offen.forEach');
const idxErl   = htFn.indexOf('erledigt.forEach');
(idxOffen > 0 && idxErl > 0 && idxOffen < idxErl) ?
  ok('Sortierung korrekt: offen vor erledigt') :
  fail('Sortierung falsch: erledigte erscheinen vor offenen Aufgaben!');

// ══════════════════════════════════════════
// 55. FREIE AUFGABEN: TYP + DEADLINE
// ══════════════════════════════════════════
console.log('\n── 55. Freie Aufgaben Anzeige ──');
const freieIdx = jsCode.indexOf('wb5-freie-item');
const freieCtx = freieIdx >= 0 ? jsCode.slice(freieIdx, freieIdx+600) : '';
freieCtx.includes('a.typ')      ? ok('Typ in freien Aufgaben angezeigt')      : fail('Typ fehlt in freier Aufgaben-Übersicht');
freieCtx.includes('a.deadline') || freieCtx.includes('fmtDDMM') ? ok('Deadline in freien Aufgaben angezeigt') : fail('Deadline fehlt in freier Aufgaben-Übersicht');


// ══════════════════════════════════════════
// 56. TERMIN LÖSCHEN + SOFTDELETE
// ══════════════════════════════════════════
console.log('\n── 56. Termin Löschen ──');
// _te5DelTermin muss zuerst das Objekt suchen, dann _softDelete(item) aufrufen
const delTerminFn = jsCode.match(/_te5DelTermin\(id\)[^,]+,/)?.[0]||'';
delTerminFn.includes('.find(') ? ok('_te5DelTermin sucht Objekt vor _softDelete') : fail('_te5DelTermin übergibt Array an _softDelete — Termin wird nicht gelöscht!');
!delTerminFn.includes('_softDelete(this.db.customEvents,') ? ok('_softDelete korrekt aufgerufen (nicht mit Array+ID)') : fail('_softDelete(array,id) falsch — muss _softDelete(item) sein!');

// ══════════════════════════════════════════
// 57. WOCHENTAGE IM BEARBEITEN-DIALOG
// ══════════════════════════════════════════
console.log('\n── 57. Wochentage in _aufgabeDetail ──');
jsCode.includes('wb5-ad-tage-wrap') ? ok('Wochentage-Bereich in _aufgabeDetail vorhanden') : fail('Wochentage-Bereich fehlt in _aufgabeDetail');
jsCode.includes('_ad5WdhChange(')   ? ok('_ad5WdhChange() für Wochentage-Toggle')           : fail('_ad5WdhChange() fehlt');
jsCode.includes('_ad5WtToggle(')    ? ok('_ad5WtToggle() für einzelne Wochentage')           : fail('_ad5WtToggle() fehlt');
jsCode.includes('wb5-ad-tage-row')  ? ok('wb5-ad-tage-row für Wochentag-Buttons')            : fail('wb5-ad-tage-row fehlt');
jsCode.includes('wtAd')             ? ok('_aufgabeSave liest Wochentage aus Detail-Dialog')   : fail('_aufgabeSave liest keine Wochentage aus Detail');


// ══════════════════════════════════════════
// 58. WANDEL-TAB
// ══════════════════════════════════════════
console.log('\n── 58. Wandel-Tab ──');
content.includes('id="wb5-wandel-tab"') ? ok('wb5-wandel-tab HTML vorhanden') : fail('wb5-wandel-tab fehlt');
content.includes('wbnl-wandel')         ? ok('Wandel im Bottom-Nav')           : fail('Wandel-Button im Nav fehlt');
jsCode.includes('_wa5Render()')         ? ok('_wa5Render() definiert')         : fail('_wa5Render() fehlt');
jsCode.includes('_wa5Neu()')            ? ok('_wa5Neu() definiert')            : fail('_wa5Neu() fehlt');
jsCode.includes('_wa5Save(')           ? ok('_wa5Save() definiert')            : fail('_wa5Save() fehlt');
jsCode.includes('_wa5Delete(')         ? ok('_wa5Delete() definiert')          : fail('_wa5Delete() fehlt');
jsCode.includes('_wa5Welt(')           ? ok('_wa5Welt() — Welt-Zuordnung')     : fail('_wa5Welt() fehlt');
jsCode.includes("'wandel'")            ? ok("showTab('wandel') verknüpft")     : fail("wandel nicht in showTab");
jsCode.includes('db.wandel')           ? ok('wandel[] im DB-Schema')           : fail('wandel[] fehlt im DB-Schema');
jsCode.includes('_wa5Toolbar(')        ? ok('_wa5Toolbar() — Formatierungs-Toolbar') : fail('_wa5Toolbar() fehlt');


// ══════════════════════════════════════════
// 59. WB4-MIGRATION: TEXT→TITEL + THEMAID
// ══════════════════════════════════════════
console.log('\n── 59. WB4-Migration text→titel ──');
const ensureFn = jsCode.match(/_ensureDbFields[\s\S]{0,4000}/)?.[0]||'';
ensureFn.includes('a.titel = a.text') || ensureFn.includes('a.titel=a.text') ? ok('text→titel Migration in _ensureDbFields') : fail('text→titel Migration fehlt — WB4-Aufgaben crashen bei filter/find auf titel!');
ensureFn.includes('themaId === null') || ensureFn.includes('themaId===null') ? ok('themaId:null→undefined bereinigt') : fail('themaId:null nicht bereinigt');

// ══════════════════════════════════════════
// 60. SYNC-KONFLIKT-DIALOG
// ══════════════════════════════════════════
console.log('\n── 60. Sync-Konflikt-Dialog ──');
jsCode.includes('_syncConflictDialog(') ? ok('_syncConflictDialog() vorhanden') : fail('_syncConflictDialog() fehlt');
jsCode.includes('_syncConflictPending') ? ok('_syncConflictPending Flag vorhanden') : fail('_syncConflictPending fehlt');
jsCode.includes('_syncCheckNewer(')     ? ok('_syncCheckNewer() vorhanden')     : fail('_syncCheckNewer() fehlt');
// _syncCheckNewer muss modifiedTime mit _syncLastDownload vergleichen
const cnStart=jsCode.indexOf('async _syncCheckNewer(');const cnEnd=jsCode.indexOf('\n  },',cnStart+50);const checkNewerFn=cnStart>=0?jsCode.slice(cnStart,cnEnd):'';
checkNewerFn.includes('modifiedTime') ? ok('modifiedTime-Vergleich in _syncCheckNewer') : fail('modifiedTime-Vergleich fehlt — kein Konflikt-Erkennung!');
checkNewerFn.includes('_syncLastDownload') ? ok('_syncLastDownload als Vergleichsbasis') : fail('_syncLastDownload nicht genutzt');
// _syncTick muss _syncConflictPending prüfen
const tickFn = jsCode.match(/async _syncTick[\s\S]{0,400}/)?.[0]||'';
tickFn.includes('_syncConflictPending') ? ok('_syncTick prüft _syncConflictPending') : fail('_syncTick lädt hoch obwohl Konflikt-Dialog offen!');
// visibilitychange → _syncCheckNewer
jsCode.includes('_syncCheckNewer()') && jsCode.includes('visibilitychange') ? ok('visibilitychange triggert _syncCheckNewer') : fail('visibilitychange triggert kein _syncCheckNewer');


// ══════════════════════════════════════════
// 61. AUFGABEN: STATUS + CHECKBOXEN
// ══════════════════════════════════════════
console.log('\n── 61. Aufgaben Status + Checkboxen ──');
jsCode.includes('_statusCb(') ? ok('_statusCb() Hilfsfunktion vorhanden') : fail('_statusCb() fehlt — Status-Checkboxen nicht gerendert');
jsCode.includes("'in_arbeit'") ? ok("Status 'in_arbeit' vorhanden") : fail("Status 'in_arbeit' fehlt");
jsCode.includes("'pausiert'") ? ok("Status 'pausiert' vorhanden") : fail("Status 'pausiert' fehlt");
jsCode.includes('wb5-cb-progress') ? ok('wb5-cb-progress CSS-Klasse vorhanden') : fail('wb5-cb-progress fehlt');
jsCode.includes('wb5-cb-paused')   ? ok('wb5-cb-paused CSS-Klasse vorhanden')   : fail('wb5-cb-paused fehlt');
jsCode.includes('wb5-ad-status')   ? ok('Status-Dropdown in _aufgabeDetail')    : fail('Status-Dropdown fehlt in Detail');
// Status-Zyklus in _ht5Toggle
jsCode.includes("cycle=['offen','in_arbeit'") ? ok('Status-Zyklus in _ht5Toggle') : fail('Status-Zyklus fehlt in _ht5Toggle');

// ══════════════════════════════════════════
// 62. AUFGABEN: STARTZEIT + DAUER
// ══════════════════════════════════════════
console.log('\n── 62. Aufgaben Startzeit + Dauer ──');
jsCode.includes('wb5-na-startzeit') ? ok('Startzeit-Feld in _aufgabeNeu')    : fail('Startzeit fehlt in _aufgabeNeu');
jsCode.includes('wb5-na-dauer')     ? ok('Dauer-Select in _aufgabeNeu')      : fail('Dauer fehlt in _aufgabeNeu');
jsCode.includes('wb5-ad-startzeit') ? ok('Startzeit-Feld in _aufgabeDetail') : fail('Startzeit fehlt in _aufgabeDetail');
jsCode.includes('wb5-ad-dauer')     ? ok('Dauer-Select in _aufgabeDetail')   : fail('Dauer fehlt in _aufgabeDetail');
jsCode.includes('wb5-na-dauer') && (jsCode.includes('value="30"') || jsCode.includes("value='30'")) ? ok('Dauer-Default 30 Min') : fail('Dauer-Default 30 Min fehlt');

// ══════════════════════════════════════════
// 63. NOTIZ: CONTENTEDITABLE + TOOLBAR
// ══════════════════════════════════════════
console.log('\n── 63. Notiz contenteditable ──');
jsCode.includes("'wb5-na-notiz'") && jsCode.includes('contenteditable') ? ok('Notiz als contenteditable in _aufgabeNeu') : fail('Notiz nicht als contenteditable');
jsCode.includes("'wb5-ad-notiz'") && jsCode.includes('contenteditable') ? ok('Notiz als contenteditable in _aufgabeDetail') : fail('Notiz nicht als contenteditable in Detail');
jsCode.includes("'wb5-na-notiz')?.innerHTML") || jsCode.includes("'wb5-na-notiz').innerHTML") ? ok('_na5Save liest innerHTML') : fail('_na5Save liest value statt innerHTML!');

// ══════════════════════════════════════════
// 64. OBERTHEMA: DATALIST + KLAPPBAR
// ══════════════════════════════════════════
console.log('\n── 64. Oberthema Datalist + klappbar ──');
jsCode.includes('wb5-ober-list') ? ok('Oberthema als Datalist (Dropdown+frei)') : fail('Oberthema Datalist fehlt');
jsCode.includes('_tm5ToggleOber(') ? ok('_tm5ToggleOber() — Oberthema klappbar') : fail('_tm5ToggleOber() fehlt');

// ══════════════════════════════════════════
// 65. BUG: TYP-TAG SCHRIFTGRÖSSE
// ══════════════════════════════════════════
console.log('\n── 65. Typ-Tag Schriftgröße ──');
// wb5-at-typ darf keinen inline font-size kleiner als 14px haben
!jsCode.includes('wb5-at-typ" style="') || !jsCode.includes('font-size:12px') ?
  ok('Typ-Tag ohne zu kleine inline Schrift') :
  fail('Typ-Tag hat zu kleine Schrift inline');
content.includes('wb5-at-typ') ? ok('wb5-at-typ CSS-Klasse vorhanden') : fail('wb5-at-typ CSS fehlt');


// ══════════════════════════════════════════
// 66. STATUS-CB KORREKT EINGEBETTET
// ══════════════════════════════════════════
console.log('\n── 66. _statusCb Einbettung ──');
// _statusCb darf nicht als String-Literal enden: '+this._statusCb(...)+' = Bug
const badPattern = "'+this._statusCb";
const allOccurrences = jsCode.split(badPattern).length - 1;
// Jedes Vorkommen muss korrekt verkettet sein — kein )+' direkt nach _statusCb-Aufruf
const wrongEmbed = (jsCode.match(/'\+this\._statusCb\([^)]+\)\+'/g)||[]);
wrongEmbed.length===0 ? ok('_statusCb korrekt eingebettet (kein +\'...\'+ Wrapper-Bug)') : fail('_statusCb als String-Literal eingebettet: '+wrongEmbed.length+' Vorkommen — Checkbox wird als Text gerendert!');

// ══════════════════════════════════════════
// 67. EMPTYDB VOLLSTÄNDIG
// ══════════════════════════════════════════
console.log('\n── 67. _emptyDb vollständig ──');
const emptyStart=jsCode.indexOf('_emptyDb()');
const emptyEnd=jsCode.indexOf('\n  },',emptyStart+50);
const emptyFn=jsCode.slice(emptyStart,emptyEnd);
emptyFn.includes('wandel')     ? ok('wandel[] in _emptyDb') : fail('wandel[] fehlt in _emptyDb — Wandel-Tab wird nicht synchronisiert!');
emptyFn.includes('fokusTypen') ? ok('fokusTypen[] in _emptyDb') : fail('fokusTypen[] fehlt in _emptyDb');

// ══════════════════════════════════════════
// 68. JETZT KLAPPBAR
// ══════════════════════════════════════════
console.log('\n── 68. JETZT klappbar ──');
jsCode.includes('_ht5JetztToggle') ? ok('_ht5JetztToggle() vorhanden') : fail('_ht5JetztToggle() fehlt — JETZT nicht klappbar');
jsCode.includes('wb5-jetzt-body')  ? ok('wb5-jetzt-body vorhanden')    : fail('wb5-jetzt-body fehlt');

// ══════════════════════════════════════════
// ERGEBNIS
// ══════════════════════════════════════════
console.log('\n═══════════════════════════════════════════');
console.log('ERGEBNIS: ' + passed + ' Tests bestanden');
if (errors.length) {
  console.log('FEHLER: ' + errors.length);
  errors.slice(0,10).forEach(e => console.log('  ✗ ' + e));
  if (errors.length > 10) console.log('  ... und ' + (errors.length - 10) + ' weitere');
}
if (warnings.length) console.log('WARNUNGEN: ' + warnings.length);
console.log('═══════════════════════════════════════════');
if (errors.length > 0) {
  console.log('\n→ Implementierung NICHT hochladen!');
  process.exit(1);
} else {
  console.log('\n→ Alle Tests bestanden. ✓');
  process.exit(0);
}
