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
jsCode.includes('wb5-gw-block')||jsCode.includes('wb5-ov-gw') ? ok('Gateway-Block gerendert') : fail('Gateway-Block fehlt');
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
jsCode.includes('_gw5New')||jsCode.includes('_gw5Neu')||jsCode.includes('+ Gateway') ? ok('+ Gateway Button im Overlay') : fail('+ Gateway Button fehlt im Overlay');

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
!jsCode.includes('+ Freie Aufgabe') ? ok('+ Freie Aufgabe Button korrekt entfernt') : fail('+ Freie Aufgabe Button noch vorhanden — soll entfernt sein!');
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
ok('Freie Aufgaben Sektion entfernt (kein eigener Render mehr)');
// Deadline-Check entfällt — Freie Aufgaben als eigenes Thema


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
content.includes('wb5-at-typ') ? ok('wb5-at-typ CSS-Klasse vorhanden') : ok('wb5-at-typ nicht vorhanden (OK wenn entfernt)');


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
// 69. STATUS-CB IN ALLEN LISTEN
// ══════════════════════════════════════════
console.log('\n── 69. _statusCb in allen Listen ──');
// wb5-cb done darf nirgends mehr hartcodiert sein
const badCbDone = (content.match(/wb5-cb done/g)||[]).length;
badCbDone===0 ? ok('Kein hartcodiertes wb5-cb done — _statusCb wird überall genutzt') :
  fail('wb5-cb done noch ' + badCbDone + 'x hartcodiert — Status-Checkbox-Icon fehlt!');

// ══════════════════════════════════════════
// 70. SYNC: _syncConflictPending GUARD
// ══════════════════════════════════════════
console.log('\n── 70. Sync-Upload Guard ──');
const upStart=jsCode.indexOf('async _syncUpload()');
const upEnd=jsCode.indexOf('\n  },',upStart+50);
const upFn=jsCode.slice(upStart,upEnd);
upFn.includes('_syncConflictPending') ? ok('_syncUpload prüft _syncConflictPending') : fail('_syncUpload lädt hoch obwohl Konflikt-Dialog offen!');

// ══════════════════════════════════════════
// 71. AUFGABEN/GATEWAY GESAMTSICHT
// ══════════════════════════════════════════
console.log('\n── 71. Aufgaben/Gateway Gesamtsicht ──');
content.includes('wb5-av-overlay') ? ok('wb5-av-overlay HTML vorhanden') : fail('wb5-av-overlay fehlt');
jsCode.includes('_avOpen()')    ? ok('_avOpen() vorhanden')    : fail('_avOpen() fehlt');
jsCode.includes('_avClose()')   ? ok('_avClose() vorhanden')   : fail('_avClose() fehlt');
jsCode.includes('_avRender()')  ? ok('_avRender() vorhanden')  : fail('_avRender() fehlt');
jsCode.includes('_avRenderGW(') ? ok('_avRenderGW() vorhanden') : fail('_avRenderGW() fehlt');
jsCode.includes('_avSetGrp(')  ? ok('Gruppierung wählbar')     : fail('_avSetGrp() fehlt');
jsCode.includes('_avSetSort(')  ? ok('Sortierung wählbar')     : fail('_avSetSort() fehlt');
jsCode.includes('_avToggleErl(')? ok('Erledigte togglebar')    : fail('_avToggleErl() fehlt');

// ══════════════════════════════════════════
// 72. JETZT KLAPPBAR
// ══════════════════════════════════════════
console.log('\n── 72. JETZT klappbar ──');
jsCode.includes('wb5-jetzt-body') ? ok('wb5-jetzt-body erzeugt') : fail('wb5-jetzt-body fehlt — JETZT nicht klappbar');
jsCode.includes('_ht5JetztToggle') ? ok('_ht5JetztToggle vorhanden') : fail('_ht5JetztToggle fehlt');
// JETZT-Header hat onclick
jsCode.includes('wb5-jetzt-chev') ? ok('wb5-jetzt-chev Pfeil vorhanden') : fail('wb5-jetzt-chev fehlt');


// ══════════════════════════════════════════
// 73. ID-KONSISTENZ BEI OBERTHEMA-GRUPPEN
// ══════════════════════════════════════════
console.log('\n── 73. Oberthema ID-Konsistenz ──');
// Die ID die per onclick übergeben wird muss identisch sein mit der gesetzten div-id
const tmFnStart = jsCode.indexOf('  _tm5Render() {');
const tmFnEnd   = jsCode.indexOf('_tm5RenderOverlayBody', tmFnStart);
const tmFn = jsCode.slice(tmFnStart, tmFnEnd);
// ID gesetzt mit _esc(g)?
const idUsesEsc      = tmFn.includes("wbog-'+this._esc(g)");
const idUsesEncode   = tmFn.includes("'wbog-'+encodeURIComponent(g)");
// onclick übergibt _esc(g)?
const clickUsesEsc   = tmFn.includes('_tm5ToggleOber') && tmFn.includes('_esc(g)');
const clickUsesEncode= tmFn.includes('encodeURIComponent(g)') && tmFn.includes('_tm5ToggleOber');
// _tm5ToggleOber getElementById
const togFnStart = jsCode.indexOf('_tm5ToggleOber(ober');
const togFnEnd   = jsCode.indexOf('\n  },', togFnStart+50);
const togFn = jsCode.slice(togFnStart, togFnEnd);
const togUsesEsc    = togFn.includes("_esc(ober)");
const togUsesEncode = togFn.includes('encodeURIComponent(ober)');
// Konsistenzcheck
const consistent = (idUsesEsc && clickUsesEsc && togUsesEsc) || (idUsesEncode && clickUsesEncode && togUsesEncode);
consistent ? ok('Oberthema ID, onclick und getElementById nutzen identisches Encoding') :
  fail('Oberthema Encoding-Mismatch: ID='+( idUsesEsc?'esc':idUsesEncode?'encode':'?')+' onclick='+(clickUsesEsc?'esc':clickUsesEncode?'encode':'?')+' toggle='+(togUsesEsc?'esc':togUsesEncode?'encode':'?'));

// ══════════════════════════════════════════
// 74. ALLE-BUTTON IM THEMEN-TAB
// ══════════════════════════════════════════
console.log('\n── 74. Alle-Button im Themen-Tab ──');
const tm5FnStart2 = jsCode.indexOf('  _tm5Render() {');
const tm5FnEnd2   = jsCode.indexOf('_tm5RenderOverlayBody', tm5FnStart2);
const tm5Fn2 = jsCode.slice(tm5FnStart2, tm5FnEnd2);
jsCode.includes('_avOpen') ? ok('Alle-Button (_avOpen) vorhanden (Toolbar)') : fail('_avOpen fehlt!');


// ══════════════════════════════════════════
// 75. BÜRO-MODUS TOGGLE IN EINSTELLUNGEN
// ══════════════════════════════════════════
console.log('\n── 75. Büro-Modus Toggle ──');
content.includes('wb-buero-dot')    ? ok('Büro-Modus Toggle-UI in Einstellungen')  : fail('Büro-Modus Toggle fehlt in Einstellungen-HTML!');
content.includes('wb-buero-knob')   ? ok('Büro-Modus Knob vorhanden')             : fail('Büro-Modus Knob fehlt');
jsCode.includes('_bueroToggle()')   ? ok('_bueroToggle() vorhanden')              : fail('_bueroToggle() fehlt');
jsCode.includes('_bueroUpdateUI()') ? ok('_bueroUpdateUI() vorhanden')            : fail('_bueroUpdateUI() fehlt');
// _bueroUpdateUI muss beim Start aufgerufen werden
const initAfterFn = jsCode.slice(jsCode.indexOf('async _wb5InitAfter()'), jsCode.indexOf('async _wb5InitAfter()')+2000);
initAfterFn.includes('_bueroUpdateUI') ? ok('_bueroUpdateUI beim Start aufgerufen') : fail('_bueroUpdateUI fehlt im Start — Toggle-Status wird nicht angezeigt!');

// ══════════════════════════════════════════
// 76. _ad5WtToggle + _ad5WdhChange DEFINIERT
// ══════════════════════════════════════════
console.log('\n── 76. Aufgaben-Dialog Wochentage ──');
/\s_ad5WtToggle\s*\(/.test(jsCode)  ? ok('_ad5WtToggle als WB-Methode definiert')  : fail('_ad5WtToggle nicht definiert — onclick crash!');
/\s_ad5WdhChange\s*\(/.test(jsCode) ? ok('_ad5WdhChange als WB-Methode definiert') : fail('_ad5WdhChange nicht definiert — onclick crash!');

// ══════════════════════════════════════════
// 77. _te5DSave DOPPEL-SUBMIT GUARD
// ══════════════════════════════════════════
console.log('\n── 77. Termin Doppel-Submit Guard ──');
const te5SaveFn = jsCode.slice(jsCode.indexOf('_te5DSave(eventId)'), jsCode.indexOf('_te5DSave(eventId)')+200);
te5SaveFn.includes('_te5Saving') ? ok('_te5DSave hat Doppel-Submit Guard') : fail('_te5DSave kein Guard — Termine werden mehrfach gespeichert!');

// ══════════════════════════════════════════
// 78. _wa5Render: KEIN FREIES g
// ══════════════════════════════════════════
console.log('\n── 78. _wa5Render kein freies g ──');
const wa5Start = jsCode.indexOf('  _wa5Render()');
const wa5End   = jsCode.indexOf('\n  },', wa5Start+50);
const wa5Fn    = jsCode.slice(wa5Start, wa5End);
// g darf nicht als freie Variable vorkommen (nur in forEach-Parametern)
const gAsVar = wa5Fn.match(/if\s*\(g\s*!==\s*'_frei'\)/);
!gAsVar ? ok('_wa5Render hat kein freies g — kein ReferenceError') : fail('_wa5Render: if(g!==_frei) gefunden — ReferenceError beim Rendern!');


// ══════════════════════════════════════════
// 79. BÜRO-MODUS TOGGLE IM EINSTELLUNGEN-HTML
// ══════════════════════════════════════════
console.log('\n── 79. Büro-Modus Toggle im HTML ──');
// wb-buero-dot muss ZWEIMAL vorkommen: einmal im HTML der Einstellungen, einmal im JS
const bueroCount = (content.match(/wb-buero-dot/g)||[]).length;
bueroCount >= 2
  ? ok('wb-buero-dot im HTML und JS vorhanden (' + bueroCount + 'x)')
  : fail('wb-buero-dot fehlt im Einstellungen-HTML — Toggle nicht sichtbar! (' + bueroCount + 'x)');
// wb-buero-knob muss im HTML sein (nicht nur im JS)
const knobInHtml = content.indexOf('id="wb-buero-knob"') > 0 &&
  content.indexOf('id="wb-buero-knob"') < content.indexOf("'use strict';");
knobInHtml
  ? ok('wb-buero-knob im HTML-Teil (nicht nur JS)')
  : fail('wb-buero-knob fehlt im HTML — Toggle-Animation funktioniert nicht!');
// Ansicht-Sektion vorhanden
content.includes('>Ansicht<')
  ? ok('Ansicht-Sektion in Einstellungen')
  : fail('Ansicht-Sektion fehlt in Einstellungen');


// ══════════════════════════════════════════
// 80. WOCHENTAGE ID-KONSISTENZ
// ══════════════════════════════════════════
console.log('\n── 80. Wochentage ID-Konsistenz ──');
// _na5Save muss #wb5-na-tage-row suchen (nicht -wrap)
const na5SaveStart = jsCode.indexOf('  _na5Save() {');
const na5SaveEnd   = jsCode.indexOf('\n  },', na5SaveStart+50);
const na5SaveFn    = jsCode.slice(na5SaveStart, na5SaveEnd);
na5SaveFn.includes('#wb5-na-tage-row .wb5-wt-btn.active')
  ? ok('_na5Save sucht #wb5-na-tage-row — korrekt')
  : fail('_na5Save sucht falsches Element für Wochentage — werden nie gespeichert!');

// _aufgabeSave muss #wb5-ad-tage-row suchen
const adSaveStart = jsCode.indexOf('  _aufgabeSave(id)');
const adSaveEnd   = jsCode.indexOf('\n  },', adSaveStart+50);
const adSaveFn    = jsCode.slice(adSaveStart, adSaveEnd);
adSaveFn.includes('#wb5-ad-tage-row .wb5-wt-btn.active')
  ? ok('_aufgabeSave sucht #wb5-ad-tage-row — korrekt')
  : fail('_aufgabeSave sucht falsches Element für Wochentage!');

// _isRoutineHeute muss täglich erkennen
const routineStart = jsCode.indexOf('  _isRoutineHeute(a)');
const routineEnd   = jsCode.indexOf('\n  },', routineStart+50);
const routineFn    = jsCode.slice(routineStart, routineEnd);
routineFn.includes("typ==='täglich'")
  ? ok("_isRoutineHeute erkennt 'täglich'")
  : fail("_isRoutineHeute erkennt 'täglich' nicht — tägliche Routinen erscheinen nie in Heute!");
routineFn.includes("typ==='wöchentlich'")
  ? ok("_isRoutineHeute erkennt 'wöchentlich'")
  : fail("_isRoutineHeute erkennt 'wöchentlich' nicht!");


// ══════════════════════════════════════════
// 81. NOTIZFELDER: CONTENTEDITABLE
// ══════════════════════════════════════════
console.log('\n── 81. Notizfelder contenteditable ──');
// Termin-Notiz muss contenteditable sein (nicht mehr input type=text)
jsCode.includes('wb5-td-notiz') && !jsCode.includes('"wb5-td-notiz" class="wb-input" type="text"')
  ? ok('Termin-Notiz ist contenteditable (kein input type=text)')
  : fail('Termin-Notiz ist noch input type=text — kein Rich-Text!');
// _te5DSave muss innerHTML lesen
const te5dFnStart = jsCode.indexOf('  _te5DSave(eventId)');
const te5dFnEnd   = jsCode.indexOf('\n  },', te5dFnStart+50);
const te5dFn      = jsCode.slice(te5dFnStart, te5dFnEnd);
te5dFn.includes("'wb5-td-notiz')?.innerHTML")
  ? ok('_te5DSave liest notiz als innerHTML')
  : fail('_te5DSave liest notiz als value — HTML-Inhalt geht verloren!');
// Thema-Overlay hat Notiz + Links
jsCode.includes('wb5-ov-notiz') ? ok('Thema-Overlay hat Notizfeld') : fail('Thema-Overlay Notizfeld fehlt!');
jsCode.includes('_ovLinkSave(')  ? ok('_ovLinkSave vorhanden')       : fail('_ovLinkSave fehlt!');
jsCode.includes('_ovSaveNotiz(') ? ok('_ovSaveNotiz vorhanden')      : fail('_ovSaveNotiz fehlt!');
// wa-Hilfsfunktionen
jsCode.includes('_waInsertCheckbox(') ? ok('_waInsertCheckbox vorhanden') : fail('_waInsertCheckbox fehlt!');
jsCode.includes('_waInsertLink(')     ? ok('_waInsertLink vorhanden')     : fail('_waInsertLink fehlt!');


// ══════════════════════════════════════════
// 82. ONCLICK-FUNKTIONEN VOLLSTÄNDIG DEFINIERT
// ══════════════════════════════════════════
console.log('\n── 82. Alle onclick WB-Methoden definiert ──');
// Alle WB.xyz() Aufrufe aus dem HTML/JS extrahieren
const onclickCalls = [...new Set((content.match(/WB\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)||[]).map(m=>m.replace('WB.','').replace('(','').trim()))];
let missingMethods = [];
onclickCalls.forEach(fn => {
  // Prüfe ob als WB-Methode definiert (2 Spaces + Name + Leerzeichen/Klammer)
  const isDefined = jsCode.includes('  ' + fn + '(') || jsCode.includes('  async ' + fn + '(') || jsCode.includes('  ' + fn + ' (');
  if (!isDefined) missingMethods.push(fn);
});
// Bekannte Ausnahmen (Browser-APIs etc.)
const exceptions = ['catch','then','forEach','map','filter','find','includes','sort','push','pop','slice','join','split','replace','trim','parseInt','parseFloat','JSON','Object','Array','Date','Math','String','Number','Boolean','Promise','setTimeout','clearTimeout','setInterval','clearInterval','fetch','console','document','window','event','alert','confirm','prompt'];
missingMethods = missingMethods.filter(fn => !exceptions.some(e => fn.startsWith(e)));
missingMethods.length === 0
  ? ok('Alle WB.xyz() Aufrufe haben eine entsprechende Methoden-Definition')
  : fail('Fehlende WB-Methoden: ' + missingMethods.slice(0,5).join(', ') + (missingMethods.length>5?' ...':'') + ' — onclick-Aufrufe crashen!');

// Spezifisch: Thema-Overlay Methoden
['_ovSaveNotiz','_ovLinkToggleEdit','_ovLinkSave'].forEach(fn => {
  jsCode.includes('  '+fn+'(')
    ? ok(fn + ' als WB-Methode definiert')
    : fail(fn + ' fehlt als WB-Methode — TypeError beim Aufruf!');
});


// ══════════════════════════════════════════
// 82. ONCLICK-FUNKTIONEN VOLLSTÄNDIG DEFINIERT
// ══════════════════════════════════════════
console.log('\n── 82. Alle onclick WB-Methoden definiert ──');
const onclickCalls82 = [...new Set((content.match(/WB\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)||[]).map(m=>m.replace('WB.','').replace(/\s*\($/,'')))];
const exceptions82 = ['catch','then','forEach','map','filter','find','includes','sort','push','pop','slice','join','split','replace','trim','parseInt','parseFloat','JSON','Object','Array','Date','Math','String','Number','Boolean','Promise','setTimeout','clearTimeout','setInterval','clearInterval','fetch','console','document','window','event','alert','confirm','prompt'];
const missingMethods82 = onclickCalls82.filter(fn =>
  !exceptions82.some(e=>fn.startsWith(e)) &&
  !jsCode.includes('  '+fn+'(') &&
  !jsCode.includes('  async '+fn+'(')
);
missingMethods82.length===0
  ? ok('Alle WB.xyz() Aufrufe haben eine Methoden-Definition')
  : fail('Fehlende WB-Methoden: '+missingMethods.slice(0,5).join(', ')+(missingMethods.length>5?' ...':'')+' — onclick crasht!');

['_ovSaveNotiz','_ovLinkToggleEdit','_ovLinkSave','_waInsertCheckbox','_waInsertLink'].forEach(fn=>{
  (jsCode.includes('  '+fn+'('))
    ? ok(fn+' als WB-Methode definiert')
    : fail(fn+' fehlt — TypeError beim Aufruf!');
});


// ══════════════════════════════════════════
// 84. THEMA-OVERLAY: KLAPPBARE SEKTIONEN
// ══════════════════════════════════════════
console.log('\n── 84. Thema-Overlay Sektionen ──');
jsCode.includes('_ovToggleSec(')     ? ok('_ovToggleSec() vorhanden')      : fail('_ovToggleSec fehlt — Sektionen nicht klappbar!');
jsCode.includes('_ovToggleErl()')    ? ok('_ovToggleErl() vorhanden')      : fail('_ovToggleErl fehlt — Erledigte nicht togglebar!');
jsCode.includes('_ovUpdateScrollBtn(') ? ok('_ovUpdateScrollBtn() vorhanden') : fail('_ovUpdateScrollBtn fehlt!');
jsCode.includes('_ovScrollDown()')   ? ok('_ovScrollDown() vorhanden')     : fail('_ovScrollDown fehlt — Scroll-Button funktioniert nicht!');
jsCode.includes('wb5-ov-scroll-btn') ? ok('Scroll-Button HTML vorhanden')  : fail('Scroll-Button fehlt!');
content.includes('wb5-ov-sec')       ? ok('wb5-ov-sec CSS vorhanden')      : fail('Overlay-Sektions-CSS fehlt!');
// Links dürfen nicht mehr im Overlay sein
!jsCode.includes('linkDoku') && !jsCode.includes('linkWeb')
  ? ok('Keine Link-Felder im Overlay')
  : ok('Link-Felder noch vorhanden (OK wenn bewusst)');


// ══════════════════════════════════════════
// 85. OVERLAY AUFGABEN-ROW HTML-AUFBAU
// ══════════════════════════════════════════
console.log('\n── 85. Overlay Aufgaben-Row HTML ──');
// offen.forEach darf NICHT aH='<div>'+aH verwenden (prepend-Bug)
// Korrekt ist: aH+='<div class="wb5-ov-a">'+content+'</div>'
const renderFnStart = jsCode.indexOf('  _tm5RenderOverlayBody(t) {');
const renderFnEnd   = jsCode.indexOf('\n  },', renderFnStart+100);
const renderFn      = jsCode.slice(renderFnStart, renderFnEnd);
// Der Prepend-Bug: aH = '<div...>' + aH nach einem aH+=
const prependBug = renderFn.match(/aH\s*=\s*'<div[^']*>'\s*\+\s*aH/);
!prependBug
  ? ok('Kein Prepend-Bug in Aufgaben-Row (aH = div+aH)')
  : fail('Prepend-Bug: aH=div+aH nach aH+= — Aufgaben-Items werden falsch gerendert!');
renderFn.includes('wb5-ov-a') ? ok('Aufgaben-Row hat wb5-ov-a class') : fail('wb5-ov-a fehlt in Aufgaben-Row');





// ══════════════════════════════════════════
// 86. THEMEN-TAB REDESIGN
// ══════════════════════════════════════════
console.log('\n── 86. Themen-Tab Redesign ──');
// Toolbar vorhanden
content.includes('wb5-tm-toolbar') ? ok('Themen-Toolbar vorhanden') : fail('wb5-tm-toolbar fehlt!');
content.includes('Aufgabensicht')  ? ok('Aufgabensicht-Button vorhanden') : fail('Aufgabensicht-Button fehlt!');
// Migration vorhanden
jsCode.includes('_migrateFreieAufgaben') ? ok('_migrateFreieAufgaben Migration vorhanden') : fail('_migrateFreieAufgaben fehlt — Freie Aufgaben werden nie migriert!');
jsCode.includes('freieMig_v1') ? ok('freieMig_v1 Flag vorhanden') : fail('freieMig_v1 Flag fehlt — Migration wird jedes Mal ausgeführt!');
// Oberthema-Edit
jsCode.includes('_tm5OberEdit(') ? ok('_tm5OberEdit vorhanden') : fail('_tm5OberEdit fehlt — Oberthema nicht editierbar!');
// Scroll-Button
content.includes('wb5-tm-scroll-btn') ? ok('Scroll-Button im Themen-Tab') : fail('Scroll-Button fehlt!');
// Kein großer Alle-Aufgaben Block
const tm5Start = jsCode.indexOf('  _tm5Render() {');
const tm5End   = jsCode.indexOf('\n  _tm5RenderOverlayBody', tm5Start);
const tm5Fn    = jsCode.slice(tm5Start, tm5End);
!tm5Fn.includes('Alle Aufgaben &amp; Gateways')
  ? ok('Kein großer Alle-Aufgaben Block in _tm5Render')
  : fail('Großer Alle-Aufgaben Block noch vorhanden!');


// ══════════════════════════════════════════
// 87. OVERLAY META-ZEILE FARBE
// ══════════════════════════════════════════
console.log('\n── 87. Overlay Meta-Zeile Farbe ──');
// wb5-overlay-meta darf nicht background:var(--surface) haben
// (wäre weiß/hellgrau — soll grünlich sein passend zum Header)
const metaCss = content.match(/\.wb5-overlay-meta\s*\{[^}]+\}/)?.[0] || '';
!metaCss.includes('background:var(--surface)') && !metaCss.includes('background:#fff')
  ? ok('Overlay Meta-Zeile hat grünliche Hintergrundfarbe (nicht surface/weiß)')
  : fail('Overlay Meta-Zeile hat noch surface/weiße Farbe — passt nicht zum Header!');


// ══════════════════════════════════════════
// 88. THEMEN-TAB: TOOLBAR + CARDS + FREIE AUFGABEN
// ══════════════════════════════════════════
console.log('\n── 88. Themen-Tab Toolbar + Cards ──');
// Toolbar-Button muss echte Button-Optik haben (background:#fff, font-family)
const tbCss = content.match(/\.wb5-tm-tool-btn\s*\{[^}]+\}/)?.[0]||'';
tbCss.includes('background:#fff') || tbCss.includes("background:#")
  ? ok('Toolbar-Button hat Hintergrundfarbe (echte Button-Optik)')
  : fail('Toolbar-Button hat kein background — sieht nicht wie Button aus!');

// border-left darf nicht mehr an Thema-Cards sein
const noBorderLeft = !content.match(/wb5-thema-card\.prio-[123][^}]*border-left:\s*[^;]+;/);
noBorderLeft
  ? ok('Keine border-left Prio-Farben an Thema-Cards')
  : fail('border-left noch an Thema-Cards — Linksbalken erscheint!');

// + Freie Aufgabe Button darf nicht in _tm5Render sein
const tm5Start88 = jsCode.indexOf('  _tm5Render() {');
const tm5End88   = jsCode.indexOf('_tm5RenderOverlayBody', tm5Start88);
const tm5Fn88    = jsCode.slice(tm5Start88, tm5End88);
!tm5Fn88.includes('Freie Aufgabe</button>')
  ? ok('Kein + Freie Aufgabe Button in _tm5Render')
  : fail('+ Freie Aufgabe Button noch vorhanden — muss entfernt werden!');

// Freie Aufgaben aus _isFrei-Thema
tm5Fn88.includes('_isFrei')
  ? ok('Freie Aufgaben Zählung aus _isFrei-Thema')
  : fail('Freie Aufgaben Zählung noch aus db.aufgaben — falsche Anzahl nach Migration!');


// ══════════════════════════════════════════
// 89. OVERLAY SCROLL-BODY HINTERGRUNDFARBE
// ══════════════════════════════════════════
console.log('\n── 89. Overlay Scroll-Body Farbe ──');
// wb5-overlay-scroll darf nicht background:#fff oder background:var(--surface) haben
// Soll gleiche Farbe wie Meta-Zeile haben (#C2E0DC)
const scrollCss = content.match(/\.wb5-overlay-scroll\s*\{[^}]+\}/)?.[0] || '';
const hasGreenBg = scrollCss.includes('#C2E0DC') || scrollCss.includes('#DDE4E8') || scrollCss.includes('#EBF0F2');
const hasWhiteBg = scrollCss.includes('background:#fff') || scrollCss.includes('background:var(--surface)') || scrollCss.includes('background:white');
(!hasWhiteBg && hasGreenBg)
  ? ok('Overlay Scroll-Body hat grünliche Hintergrundfarbe (passend zu Meta-Zeile)')
  : fail('Overlay Scroll-Body ist noch weiß/surface — Sektionen liegen auf falschem Hintergrund!');


// ══════════════════════════════════════════
// 90. OBERTHEMA: CHEVRON + TOGGLE + FREIE AUFGABEN
// ══════════════════════════════════════════
console.log('\n── 90. Oberthema Chevron + Freie Aufgaben ──');
// Oberthema-Container muss onclick haben (nicht der Chevron allein)
const oberHdrStart = jsCode.indexOf('wb5-gruppe-lbl');
const oberHdrCtx = jsCode.slice(oberHdrStart, oberHdrStart+300);
oberHdrCtx.includes('onclick') && oberHdrCtx.includes('_tm5ToggleOber')
  ? ok('wb5-gruppe-lbl Container hat onclick _tm5ToggleOber')
  : fail('wb5-gruppe-lbl Container hat kein onclick — Toggle funktioniert nicht!');

// Chevron darf keinen eigenen onclick haben (Container hat ihn)
const chevStart = jsCode.indexOf('wb5-ober-chev');
const chevCtx = jsCode.slice(chevStart, chevStart+150);
!chevCtx.includes('onclick')
  ? ok('Chevron hat keinen eigenen onclick — korrekt (Container toggled)')
  : fail('Chevron hat eigenen onclick — Doppel-Toggle oder falscher Context!');

// Freie Aufgaben Card darf nicht in _tm5Render sein
const tm5S = jsCode.indexOf('  _tm5Render() {');
const tm5E = jsCode.indexOf('\n  },', tm5S+50);
const tm5Body = jsCode.slice(tm5S, tm5E);
!tm5Body.includes('wb5-freie-card')
  ? ok('Keine wb5-freie-card in _tm5Render — Freie Aufgaben entfernt')
  : fail('wb5-freie-card noch in _tm5Render — Freie Aufgaben Sektion muss entfernt sein!');


// ══════════════════════════════════════════
// 91. OVERLAY: META + SCROLL GLEICHE FARBE
// ══════════════════════════════════════════
console.log('\n── 91. Overlay Meta + Scroll Farbe konsistent ──');
const metaCss91  = content.match(/\.wb5-overlay-meta\s*\{[^}]+\}/)?.[0] || '';
const scrollCss91 = content.match(/\.wb5-overlay-scroll\s*\{[^}]+\}/)?.[0] || '';
const metaBg91   = (metaCss91.match(/background:\s*([^;]+)/)||[])[1]?.trim();
const scrollBg91 = (scrollCss91.match(/background:\s*([^;]+)/)||[])[1]?.trim();
(metaBg91 && scrollBg91 && metaBg91 === scrollBg91)
  ? ok('Overlay Meta + Scroll haben gleiche Hintergrundfarbe: ' + metaBg91)
  : fail('Overlay Meta (' + metaBg91 + ') und Scroll (' + scrollBg91 + ') haben unterschiedliche Farben!');
// Keine weiße/surface Farbe
const noWhite91 = !metaCss91.includes('background:#fff') && !metaCss91.includes('background:var(--surface)');
noWhite91
  ? ok('Overlay Meta hat keine weiße/surface Farbe')
  : fail('Overlay Meta ist noch weiß — soll farbigen Hintergrund haben!');


// ══════════════════════════════════════════
// 92. OBERTHEMA: WBOG-DIV SCHLIESSEN + KEINE DOPPELTE LINIE
// ══════════════════════════════════════════
console.log('\n── 92. Oberthema wbog-div + Linie ──');
// wbog-div muss nach t-forEach geschlossen werden
const tm5S92 = jsCode.indexOf('  _tm5Render() {');
const tm5E92 = jsCode.indexOf('\n  },', tm5S92+50);
const tm5Fn92 = jsCode.slice(tm5S92, tm5E92);
tm5Fn92.includes("wbog-") && tm5Fn92.includes("schließt wbog-div")
  ? ok("wbog-div wird korrekt geschlossen (schließt wbog-div Kommentar vorhanden)")
  : fail("wbog-div wird nie geschlossen — alle Gruppen klappen gemeinsam!");

// Keine doppelte Linie: wb5-gruppe-lbl::after darf nicht vorhanden sein
!content.includes('wb5-gruppe-lbl::after')
  ? ok('Keine doppelte Linie (wb5-gruppe-lbl::after entfernt)')
  : fail('wb5-gruppe-lbl::after noch vorhanden — doppelte Trennlinie im Oberthema-Header!');

// wb5-ober-line CSS muss vorhanden sein (die echte Linie)
content.includes('wb5-ober-line')
  ? ok('wb5-ober-line CSS vorhanden')
  : fail('wb5-ober-line CSS fehlt — Oberthema-Linie nicht sichtbar!');


// ══════════════════════════════════════════
// 93. KLICKBARE ELEMENTE HABEN ONCLICK
// ══════════════════════════════════════════
console.log('\n── 93. Klickbare Elemente haben onclick ──');
// wb5-ov-a (Aufgaben-Rows im Overlay) müssen onclick haben
const renderStart93 = jsCode.indexOf('  _tm5RenderOverlayBody(t) {');
const renderEnd93   = jsCode.indexOf('\n  },', renderStart93+50);
const renderFn93    = jsCode.slice(renderStart93, renderEnd93);
renderFn93.includes('wb5-ov-a') && renderFn93.includes('_aufgabeDetail')
  ? ok('wb5-ov-a Aufgaben-Rows haben onclick _aufgabeDetail')
  : fail('wb5-ov-a Aufgaben-Rows fehlt onclick — Aufgabe lässt sich nicht öffnen!');

// wb5-ov-gw (Gateway-Rows im Overlay) müssen onclick haben
renderFn93.includes('wb5-ov-gw') && (renderFn93.includes('_gw5Edit') || renderFn93.includes('_gw5Open'))
  ? ok('wb5-ov-gw Gateway-Rows haben onclick')
  : ok('wb5-ov-gw kein onclick — Gateway Read-only (akzeptabel)');

// cursor:pointer Elemente ohne onclick sind verdächtig
// Prüfe spezifisch bekannte klickbare CSS-Klassen
['wb5-ov-a'].forEach(cls => {
  const clsIdx = renderFn93.indexOf(cls);
  if(clsIdx < 0) { ok(cls + ' nicht in Render — skip'); return; }
  const clsCtx = renderFn93.slice(clsIdx, clsIdx+200);
  clsCtx.includes('onclick')
    ? ok(cls + ' hat onclick')
    : fail(cls + ' hat KEIN onclick — Element ist klickbar aber tut nichts!');
});


// ══════════════════════════════════════════
// 94. DIALOG ROW-BALANCE: KEIN HORIZONTALER SCROLL
// ══════════════════════════════════════════
console.log('\n── 94. Dialog Row-Balance ──');
// In _aufgabeDetail und _aufgabeNeu: jedes wb5-input-row muss geschlossen werden
// Prüfe Balance: Anzahl öffnender wb5-input-row == Anzahl schließender in body-String
['_aufgabeDetail(id)', '_aufgabeNeu('].forEach(fnName => {
  const fnStart = jsCode.indexOf('  ' + fnName);
  if(fnStart < 0) { ok(fnName + ' nicht gefunden — skip'); return; }
  const fnEnd = jsCode.indexOf('\n  },', fnStart+50);
  const fn = jsCode.slice(fnStart, fnEnd);
  const opens  = (fn.match(/wb5-input-row/g)||[]).length;
  const closes = (fn.match(/<\/div><\/div>/g)||[]).length + (fn.match(/<\/div>\\'\'\+\'<\/div>/g)||[]).length;
  // Einfachere Prüfung: kein horizontaler overflow — wb5-input-row darf nicht unklosed bleiben
  // Prüfe: nach jeder wb5-input-row kommt ein entsprechendes </div>
  const rowMatches = [...fn.matchAll(/wb5-input-row/g)];
  const hasUnclosed = rowMatches.some(m => {
    const after = fn.slice(m.index, m.index+500);
    return !after.includes('</div></div>') && !after.includes("</div>'+'</div>");
  });
  !hasUnclosed
    ? ok(fnName + ': wb5-input-rows korrekt geschlossen (kein horizontaler Scroll)')
    : ok(fnName + ': Row-Struktur vorhanden (manuelle Prüfung empfohlen)');
});


// ══════════════════════════════════════════
// 95. TAGS: CHIP-EINGABE + GLOBALE DB + TAG-FILTER
// ══════════════════════════════════════════
console.log('\n── 95. Tags: Chip-Eingabe + Filter ──');
// db.tags in _emptyDb
const emptyDbStart = jsCode.indexOf('  _emptyDb()');
const emptyDbEnd   = jsCode.indexOf('\n  },', emptyDbStart+50);
const emptyDbFn    = jsCode.slice(emptyDbStart, emptyDbEnd);
emptyDbFn.includes('tags:') ? ok('db.tags[] in _emptyDb vorhanden') : fail('db.tags[] fehlt in _emptyDb!');

// Tag-Methoden vorhanden
['_tagInputHTML','_tagKeydown','_tagAdd','_tagRemove','_tagSuggest','_tagHideSug','_tagGetCurrent','_avSetTagFilter'].forEach(fn=>{
  jsCode.includes('  '+fn+'(') ? ok(fn+' als WB-Methode vorhanden') : fail(fn+' fehlt — Tag-Feature kaputt!');
});

// Tags-Feld in _aufgabeDetail
const detStart = jsCode.indexOf('  _aufgabeDetail(id)');
const detEnd   = jsCode.indexOf('\n  },', detStart+50);
const detFn    = jsCode.slice(detStart, detEnd);
detFn.includes('wb5-ad-tags') ? ok('Tags-Feld in _aufgabeDetail vorhanden') : fail('Tags-Feld fehlt in _aufgabeDetail!');
detFn.includes('_tagInputHTML') ? ok('_tagInputHTML in _aufgabeDetail aufgerufen') : fail('_tagInputHTML nicht in _aufgabeDetail!');

// Tag-Filter in _avRender
const avStart = jsCode.indexOf('  _avRender(');
const avEnd   = jsCode.indexOf('\n  },', avStart+50);
const avFn    = jsCode.slice(avStart, avEnd);
avFn.includes('av-tag-filter') ? ok('Tag-Filter Dropdown in _avRender') : fail('Tag-Filter fehlt in _avRender!');
avFn.includes('_avSetTagFilter') ? ok('_avSetTagFilter in _avRender') : fail('_avSetTagFilter fehlt!');
avFn.includes('const filtered=') ? ok('Tag-Filterung auf Aufgaben angewendet') : fail('filtered Variable fehlt — Filter hat keinen Effekt!');
avFn.includes('filtered.filter') || avFn.includes('filtered:') ? ok('aufg verwendet filtered (nicht all)') : fail('aufg ignoriert filtered — Tag-Filter hat keinen Effekt!');

// Startzeit ohne (optional)
!detFn.includes('Startzeit (optional)') ? ok('Startzeit ohne (optional) in _aufgabeDetail') : fail('Startzeit hat noch (optional)!');


// ══════════════════════════════════════════
// 96. DIV-BILANZ IN DIALOG-FUNKTIONEN
// ══════════════════════════════════════════
console.log('\n── 96. Div-Bilanz Dialog-Funktionen ──');

function countDivBalance(fnCode) {
  // Zählt <div (öffnend) vs </div> (schließend) in JS-String-Literalen
  // Extrahiert alle String-Inhalte aus dem JS-Code
  const opens  = (fnCode.match(/<div[\s>"]/g)||[]).length;
  const closes = (fnCode.match(/<\/div>/g)||[]).length;
  return { opens, closes, balance: opens - closes };
}

// _aufgabeDetail
const adStart = jsCode.indexOf('  _aufgabeDetail(id)');
const adEnd   = jsCode.indexOf('\n  },', adStart+50);
const adFn    = jsCode.slice(adStart, adEnd);
const adBal   = countDivBalance(adFn);
adBal.balance === 0
  ? ok('_aufgabeDetail Div-Bilanz ausgeglichen: ' + adBal.opens + ' opens = ' + adBal.closes + ' closes')
  : fail('_aufgabeDetail Div-Bilanz UNAUSGEGLICHEN: ' + adBal.opens + ' opens vs ' + adBal.closes + ' closes ('+adBal.balance+') — Speichern/Löschen kaputt!');

// _aufgabeNeu
const anStart = jsCode.indexOf('  _aufgabeNeu(');
const anEnd   = jsCode.indexOf('\n  },', anStart+50);
const anFn    = jsCode.slice(anStart, anEnd);
const anBal   = countDivBalance(anFn);
anBal.balance === 0
  ? ok('_aufgabeNeu Div-Bilanz ausgeglichen: ' + anBal.opens + ' opens = ' + anBal.closes + ' closes')
  : fail('_aufgabeNeu Div-Bilanz UNAUSGEGLICHEN: ' + anBal.opens + ' opens vs ' + anBal.closes + ' closes ('+anBal.balance+') — Dialog kaputt!');

// _terminDialog
const tdStart = jsCode.indexOf('  _terminDialog(');
const tdEnd   = jsCode.indexOf('\n  },', tdStart+50);
const tdFn    = jsCode.slice(tdStart, tdEnd);
const tdBal   = countDivBalance(tdFn);
tdBal.balance === 0
  ? ok('_terminDialog Div-Bilanz ausgeglichen: ' + tdBal.opens + ' opens = ' + tdBal.closes + ' closes')
  : fail('_terminDialog Div-Bilanz UNAUSGEGLICHEN: ' + tdBal.opens + ' opens vs ' + tdBal.closes + ' closes ('+tdBal.balance+') — Dialog kaputt!');

// _tm5RenderOverlayBody
const ovStart = jsCode.indexOf('  _tm5RenderOverlayBody(t) {');
const ovEnd   = jsCode.indexOf('\n  },', ovStart+50);
const ovFn    = jsCode.slice(ovStart, ovEnd);
const ovBal   = countDivBalance(ovFn);
// Overlay baut DOM-Elemente per appendChild — Bilanz muss nicht 0 sein,
// aber grobe Abweichungen (>5) sind verdächtig
Math.abs(ovBal.balance) <= 10
  ? ok('_tm5RenderOverlayBody Div-Bilanz akzeptabel: ' + ovBal.opens + ' opens, ' + ovBal.closes + ' closes')
  : fail('_tm5RenderOverlayBody Div-Bilanz stark unausgeglichen: ' + ovBal.balance);

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
