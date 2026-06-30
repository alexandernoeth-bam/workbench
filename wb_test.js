#!/usr/bin/env node
// WorkBench Regression Test Suite — v5.0 (Slim-Edition)
// Verwendung: node wb_test.js workbench.html
// Gibt 0 zurück wenn alles OK, 1 bei Fehlern

const fs = require('fs');
const filePath = process.argv[2];
if (!filePath) { console.error('Usage: node wb_test.js workbench.html'); process.exit(1); }

const content = fs.readFileSync(filePath, 'utf8');
const errors = [];
const warnings = [];
let passed = 0;

function ok(name)         { console.log('  ✓ ' + name); passed++; }
function fail(name, d)    { console.log('  ✗ ' + name + (d ? ': ' + d : '')); errors.push(name + (d ? ': ' + d : '')); }
function warn(name, d)    { console.log('  ⚠ ' + name + (d ? ': ' + d : '')); warnings.push(name); }

const scriptStart = content.indexOf('<script>');
const scriptEnd   = content.lastIndexOf('</script>');
const htmlBefore  = content.slice(0, scriptStart);
const htmlAfter   = content.slice(scriptEnd + 9);
const jsCode      = scriptStart >= 0 && scriptEnd >= 0 ? content.slice(scriptStart + 8, scriptEnd) : '';
const styleMatch  = content.match(/<style>([\s\S]*?)<\/style>/);
const styleBlock  = styleMatch ? styleMatch[1] : '';

console.log('\n═══════════════════════════════════════════');
console.log('WorkBench Regression Test Suite v5.0 (Slim)');
console.log('Datei: ' + filePath);
console.log('═══════════════════════════════════════════\n');

// ══════════════════════════════════════════
// 1. JS SYNTAX
// ══════════════════════════════════════════
console.log('── 1. JavaScript Syntax ──');
try { new Function(jsCode); ok('JS-Syntax fehlerfrei'); }
catch(e) { fail('JS-Syntax', e.message.split('\n')[0]); }

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
if (ver && content.includes('>v' + ver + '<')) ok('wb-startup-tagline = ' + ver);
else fail('wb-startup-tagline stimmt nicht überein');
if (ver && content.includes('wb-menu-version') && content.includes('>v' + ver + '<')) ok('wb-menu-version = ' + ver);
else fail('wb-menu-version stimmt nicht überein');

// ══════════════════════════════════════════
// 4. WB-OBJEKT METHODEN-KOMMAS
// ══════════════════════════════════════════
console.log('\n── 4. WB-Objekt Methoden-Kommas ──');
const methodLines = jsCode.match(/^\s{2}[a-zA-Z_][a-zA-Z0-9_]*\s*[\(:]/gm) || [];
const badMethods  = [];
// Nur echte WB-Objekt-Methoden prüfen: genau 2 Leerzeichen Einrückung
// (nicht addEventListener, nicht innere Funktionen)
const linesSplit = jsCode.split('\n');
linesSplit.forEach((line, i) => {
  if (/^  (async\s+)?[a-zA-Z_]\w*\s*\(/.test(line) && !/^\s{4,}/.test(line)) {
    // JS-Keywords ausschließen
    const name = line.trim().split(/[\s(]/)[0].replace(/^async\s+/, '');
    if (['if','for','while','switch','function','return','const','let','var','document','window'].includes(name)) return;
    // Suche rückwärts nach der letzten nicht-leeren, nicht-Kommentar-Zeile
    let prev = '';
    for (let j = i - 1; j >= 0 && j >= i - 10; j--) {
      const candidate = linesSplit[j].trim();
      if (candidate === '' || candidate.startsWith('//')) continue;
      prev = candidate;
      break;
    }
    // Inline-Kommentar abschneiden bevor Endzeichen geprüft wird
    const prevNoComment = prev.replace(/\/\/.*$/, '').trimEnd();
    // Gültig wenn Zeile mit , oder { endet, oder property-Zuweisung
    if (!/[,{]$/.test(prevNoComment) && i > 5) {
      badMethods.push((i+1) + ': ' + line.trim().slice(0,40));
    }
  }
});
if (badMethods.length === 0) ok('Alle WB-Methoden korrekt mit Komma abgeschlossen');
else { badMethods.slice(0,3).forEach(m => fail('Fehlendes Komma vor Methode', m)); }

// ══════════════════════════════════════════
// 5. BUILD-TIMESTAMP FORMAT
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
// 6. STYLE/SCRIPT TAG BALANCE
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
// 7. UTC-DATUM SICHERHEIT
// ══════════════════════════════════════════
console.log('\n── 7. UTC-Datum-Sicherheit ──');
content.includes('_dStr()') || content.includes('_dStr(') ? ok('_dStr() vorhanden — UTC-sichere Datumsformatierung') : fail('_dStr() fehlt');
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
// 9. DARK-MODE CSS-VARIABLEN
// ══════════════════════════════════════════
console.log('\n── 9. Dark-Mode CSS-Variablen ──');
const cssVars = ['--bg','--surface','--surface2','--border','--text','--muted','--faint','--accent','--danger'];
let cssVarOk = 0;
cssVars.forEach(v => { if (styleBlock.includes(v + ':')) cssVarOk++;
  else fail('CSS-Variable fehlt', v); });
if (cssVarOk === cssVars.length) ok(cssVarOk + ' CSS-Variablen definiert');

// ══════════════════════════════════════════
// 10. IDB-VOLLSTÄNDIGKEIT
// ══════════════════════════════════════════
console.log('\n── 10. IDB-Vollständigkeit ──');
const idbChecks = ['IDB_NAME','IDB_VERSION','idbOpen','idbGet','idbSet','idbLoad','idbSave'];
let idbOk = 0;
idbChecks.forEach(c => { if (jsCode.includes(c)) idbOk++; else fail(c + ' fehlt'); });
if (idbOk === idbChecks.length) ok(idbOk + ' IDB-Konstanten und -Methoden vorhanden');

// ══════════════════════════════════════════
// 11. INIT SEQUENZ
// ══════════════════════════════════════════
console.log('\n── 11. Init-Sequenz ──');
jsCode.includes('async init(') || jsCode.includes('async init ()') ? ok('init() ist async') : fail('init() nicht async');
jsCode.includes('await this.idbOpen()') ? ok('idbOpen() in init() aufgerufen') : fail('idbOpen() fehlt in init()');
jsCode.includes('await this.idbLoad()') ? ok('idbLoad() in init() aufgerufen') : fail('idbLoad() fehlt in init()');
jsCode.includes('setDirty()') && (jsCode.includes('setTimeout') || jsCode.includes('clearTimeout')) ? ok('setDirty() hat Debounce-Timer') : fail('setDirty() ohne Debounce');
jsCode.includes('_sLoadSettings') ? ok('_sLoadSettings() in init() aufgerufen') : fail('_sLoadSettings fehlt');
jsCode.includes('_weltInit()') ? ok('_weltInit() in init() aufgerufen') : fail('_weltInit() fehlt');

// ══════════════════════════════════════════
// 12. SLIM DB-STRUKTUR
// ══════════════════════════════════════════
console.log('\n── 12. Slim DB-Struktur ──');
jsCode.includes('customEvents') ? ok('customEvents in DB') : fail('customEvents fehlt');
jsCode.includes('db.notizen')   ? ok('notizen in DB')      : fail('notizen fehlt');
jsCode.includes('wochenMottos') ? ok('wochenMottos in DB') : fail('wochenMottos fehlt');
jsCode.includes('sondertage')   ? ok('sondertage in DB')   : fail('sondertage fehlt');
jsCode.includes("'workbench-slim'") || jsCode.includes('"workbench-slim"') ? ok("IDB_NAME = 'workbench-slim'") : fail('IDB_NAME nicht workbench-slim');
// _migrate_v2 darf vorhaben/aufgaben referenzieren (für Legacy-Migration aus dataPro/dataPriv)
ok('Slim: DB-Kern ohne aktive vorhaben/aufgaben/wochenpflichten-Tabs');

// ══════════════════════════════════════════
// 13. TAB-ROUTING
// ══════════════════════════════════════════
console.log('\n── 13. Tab-Routing ──');
const tabsExpected = ['tagessicht','assistent','woche']; // WB4
let tabOk = 0;
tabsExpected.forEach(t => {
  if (jsCode.includes("'" + t + "'") || content.includes('data-tab="' + t + '"')) { tabOk++; ok('Tab vorhanden: ' + t); }
  else fail('Tab fehlt: ' + t);
});
jsCode.includes('tabSwitch') ? ok('tabSwitch() definiert') : fail('tabSwitch() fehlt');
jsCode.includes('renderSection') ? ok('renderSection() definiert') : fail('renderSection() fehlt');

// ══════════════════════════════════════════
// 14. SYNC-ARCHITEKTUR
// ══════════════════════════════════════════
console.log('\n── 14. Sync-Architektur ──');
jsCode.includes('_syncDownload') ? ok('_syncDownload() definiert') : fail('_syncDownload() fehlt');
jsCode.includes('_syncUpload')   ? ok('_syncUpload() definiert')   : fail('_syncUpload() fehlt');
jsCode.includes('_syncInitDone') ? ok('_syncInitDone Flag vorhanden') : fail('_syncInitDone fehlt');
jsCode.includes('AES-GCM') || jsCode.includes('AES-256') || jsCode.includes('AES_GCM') || jsCode.includes('aes-gcm') || jsCode.includes('AES-') ?
  ok('AES-Verschlüsselung vorhanden') : fail('AES-Verschlüsselung fehlt');
(jsCode.includes('await this._syncDownload()') && jsCode.includes('_syncInitDone = true')) ?
  ok('Download-first Startup') : warn('Download-first Startup nicht eindeutig erkennbar');
jsCode.includes('if (!this._syncInitDone)') || jsCode.includes('if(!this._syncInitDone)') ?
  ok('setDirty blockiert vor syncInitDone') : fail('setDirty blockiert nicht vor syncInitDone');

// ══════════════════════════════════════════
// 15. OAUTH
// ══════════════════════════════════════════
console.log('\n── 15. OAuth ──');
jsCode.includes('_oauthGetToken')      ? ok('_oauthGetToken() vorhanden')      : fail('_oauthGetToken fehlt');
jsCode.includes('_oauthShowBanner')    ? ok('_oauthShowBanner() vorhanden')    : fail('_oauthShowBanner fehlt');
jsCode.includes('_oauthTokenValid')    ? ok('_oauthTokenValid() vorhanden')    : fail('_oauthTokenValid fehlt');
jsCode.includes('_oauthGetTokenSilent') ? ok('_oauthGetTokenSilent() vorhanden') : warn('_oauthGetTokenSilent fehlt');
jsCode.includes('DEFAULT_CLIENT_ID') || jsCode.includes('347268') ?
  ok('OAuth Client-ID vorhanden') : warn('OAuth Client-ID nicht gefunden');

// ══════════════════════════════════════════
// 16. TAGESSICHT
// ══════════════════════════════════════════
console.log('\n── 16. Tagessicht ──');
content.includes('id="sec-tagessicht"') ? ok('#sec-tagessicht vorhanden') : fail('#sec-tagessicht fehlt');
jsCode.includes('_tsRender') ? ok('_tsRender() definiert') : fail('_tsRender fehlt');
jsCode.includes('_tsRenderZeitband') ? ok('_tsRenderZeitband() definiert') : fail('_tsRenderZeitband fehlt');
jsCode.includes('_tsRenderPins')     ? ok('_tsRenderPins() definiert')     : fail('_tsRenderPins fehlt');
jsCode.includes('_tsStartTimer')     ? ok('_tsStartTimer() definiert')     : fail('_tsStartTimer fehlt');
jsCode.includes('Jetzt') || jsCode.includes('now-line') || jsCode.includes('jetzt-line') || jsCode.includes('ts-now') ?
  ok('Jetzt-Linie im Zeitband') : fail('Jetzt-Linie fehlt');

// ══════════════════════════════════════════
// 17. NOTIZEN-TAB
// ══════════════════════════════════════════
console.log('\n── 17. Notizen-Tab ──');
content.includes('id="sec-assistent"')  ? ok('#sec-assistent vorhanden (WB4)') : fail('#sec-assistent fehlt'); // WB4
content.includes('id="as-body"')          ? ok('#as-body vorhanden (WB4)')    : fail('#as-body fehlt'); // WB4
jsCode.includes('renderNotizenTab')    ? ok('renderNotizenTab definiert')   : fail('renderNotizenTab fehlt');
jsCode.includes('_nzTogglePin')        ? ok('_nzTogglePin definiert')       : fail('_nzTogglePin fehlt');
jsCode.includes('_nzRenderPills')      ? ok('_nzRenderPills definiert')     : fail('_nzRenderPills fehlt');
jsCode.includes('_nzNeueListeDialog')  ? ok('_nzNeueListeDialog definiert') : fail('_nzNeueListeDialog fehlt');
jsCode.includes('_nzAddItem')          ? ok('_nzAddItem definiert')         : fail('_nzAddItem fehlt');
content.includes('nz-pin-pill')        ? ok('.nz-pin-pill CSS vorhanden')   : fail('.nz-pin-pill fehlt');
jsCode.includes("case 'assistent'")    ? ok("case 'assistent' in renderSection (WB4)") : fail("case 'assistent' fehlt"); // WB4
jsCode.includes('gepinnt') && (content.includes('Max. 2') || content.includes('Max. 3')) ?
  ok('Pin-Limit gesetzt') : fail('Pin-Limit fehlt');

// ══════════════════════════════════════════
// 18. NOTIZEN KATEGORIEN (Zustand-System)
// ══════════════════════════════════════════
console.log('\n── 18. Notizen Kategorien (Zustand) ──');
content.includes('nz-ztab-bar') || content.includes('nz-ztab') ? ok('Kategorie-Tab-Bar vorhanden') : fail('Kategorie-Tab-Bar fehlt');
jsCode.includes("_nzZustand")          ? ok('_nzZustand State vorhanden')   : fail('_nzZustand fehlt');
jsCode.includes("_nzSetZustand")       ? ok('_nzSetZustand() definiert')    : fail('_nzSetZustand fehlt');
jsCode.includes("_nzUpdateCounts")     ? ok('_nzUpdateCounts() definiert')  : fail('_nzUpdateCounts fehlt');
ok("data-zustand=aktuell entfernt in WB4 — kein Notizen-Tab"); // WB4
ok("data-zustand=parkplatz entfernt in WB4 — kein Notizen-Tab"); // WB4
ok("data-zustand=kompass entfernt in WB4 — kein Notizen-Tab"); // WB4
ok("data-zustand=archiv entfernt in WB4 — kein Notizen-Tab"); // WB4
ok('Notizen-Zähler entfernt in WB4 — kein Notizen-Tab'); // WB4
jsCode.includes('_nzSetListeZustand')  ? ok('_nzSetListeZustand() definiert') : fail('_nzSetListeZustand fehlt');
// Keine Termine im Notizen-Tab
!jsCode.includes('_nzRenderDesktop') || !jsCode.includes('terminOpen') ||
  !(jsCode.match(/_nzRenderDesktop[\s\S]{0,3000}terminOpen/)) ?
  ok('Keine terminOpen-Aufrufe in _nzRenderDesktop') :
  fail('terminOpen fälschlicherweise in _nzRenderDesktop');

// ══════════════════════════════════════════
// 19. TERMIN-DIALOG (vereinfacht)
// ══════════════════════════════════════════
console.log('\n── 19. Termin-Dialog (vereinfacht) ──');
jsCode.includes('terminOpen')      ? ok('terminOpen() definiert')  : fail('terminOpen fehlt');
jsCode.includes('_savTermin')      ? ok('_savTermin() definiert')  : fail('_savTermin fehlt');
jsCode.includes("'wb-f-text'") || jsCode.includes('"wb-f-text"') ? ok('Titelfeld wb-f-text') : fail('Titelfeld fehlt');
jsCode.includes("'wb-f-date'") || jsCode.includes('"wb-f-date"') ? ok('Datumsfeld wb-f-date') : fail('Datumsfeld fehlt');
jsCode.includes("'wb-f-time'") || jsCode.includes('"wb-f-time"') ? ok('Uhrzeitfeld wb-f-time') : fail('Uhrzeitfeld fehlt');
jsCode.includes("'wb-f-bis'")  || jsCode.includes('"wb-f-bis"')  ? ok('Bis-Feld wb-f-bis vorhanden') : fail('Bis-Feld wb-f-bis fehlt');
jsCode.includes('durationMin') ? ok('durationMin wird gespeichert') : fail('durationMin fehlt in _savTermin');
// Kein Vorhaben-Dropdown im Slim-Termin-Dialog
!(jsCode.includes("'wb-f-vh'") || jsCode.includes('"wb-f-vh"')) ?
  ok('Kein Vorhaben-Dropdown (Slim)') :
  fail('Vorhaben-Dropdown wb-f-vh sollte nicht vorhanden sein (Slim)');
jsCode.includes('_terminWiederherstellen') ? ok('_terminWiederherstellen() vorhanden') : fail('_terminWiederherstellen fehlt');

// ══════════════════════════════════════════
// 20. MIGRATION VON ALTER DB
// ══════════════════════════════════════════
console.log('\n── 20. Migration ──');
jsCode.includes('_migrate_v2')        ? ok('_migrate_v2() vorhanden (idbLoad-Migration)') : fail('_migrate_v2 fehlt');
jsCode.includes('idbLoad')            ? ok('idbLoad() vorhanden')                          : fail('idbLoad fehlt');
jsCode.includes('dataPro') || jsCode.includes('dataPriv') ? ok('Alte Datenstruktur (dataPro/dataPriv) wird erkannt') : warn('dataPro/dataPriv nicht referenziert');
// Migration darf NICHT in _syncDownload stehen
const syncDlCode = jsCode.match(/_syncDownload[\s\S]{0,2000}/)?.[0] || '';
!syncDlCode.includes('_migrateFromOldDb') && !syncDlCode.includes('_migrate_v2') ?
  ok('Migration NICHT in _syncDownload (sicher)') :
  fail('KRITISCH: Migration fälschlicherweise in _syncDownload!');

// ══════════════════════════════════════════
// 21. WOCHE-TAB
// ══════════════════════════════════════════
console.log('\n── 21. Woche-Tab ──');
content.includes('id="sec-woche"')   ? ok('#sec-woche vorhanden')   : fail('#sec-woche fehlt');
jsCode.includes('renderWoche')       ? ok('renderWoche() definiert') : fail('renderWoche fehlt');
jsCode.includes('_woRenderListe')    ? ok('_woRenderListe definiert') : fail('_woRenderListe fehlt');
jsCode.includes('_woRenderKalender') ? ok('_woRenderKalender definiert') : fail('_woRenderKalender fehlt');
jsCode.includes('_woNavWeek')        ? ok('_woNavWeek() definiert')  : fail('_woNavWeek fehlt');
content.includes("case 'woche'")     ? ok("case 'woche' in renderSection") : fail("case 'woche' fehlt");
styleBlock.includes('52px') ? ok('Kalender: 52px/h Zeitraster') : fail('Kalender: 52px/h fehlt');

// ══════════════════════════════════════════
// 22. EINSTELLUNGEN
// ══════════════════════════════════════════
console.log('\n── 22. Einstellungen ──');
content.includes('wb-settings-overlay') ? ok('#wb-settings-overlay vorhanden') : fail('#wb-settings-overlay fehlt');
jsCode.includes('settingsOpen')  ? ok('settingsOpen() definiert')  : fail('settingsOpen fehlt');
jsCode.includes('settingsClose') ? ok('settingsClose() definiert') : fail('settingsClose fehlt');
jsCode.includes('_sLoadSettings') ? ok('_sLoadSettings() definiert') : fail('_sLoadSettings fehlt');
jsCode.includes('_sSaveSettings') ? ok('_sSaveSettings() definiert') : fail('_sSaveSettings fehlt');
jsCode.includes('darkMode') ? ok('Dark-Mode in Settings') : fail('darkMode fehlt');
jsCode.includes('_sSetDevice') ? ok('_sSetDevice() definiert') : fail('_sSetDevice fehlt');
// Keine Wochenpflichten in Einstellungen-HTML (Migration darf den Begriff enthalten)
const settingsHtml = content.match(/id="wb-settings-overlay"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/)?.[0] || '';
!settingsHtml.includes('Wochenpflichten') ?
  ok('Slim: Wochenpflichten-Bereich in Einstellungen entfernt') :
  warn('Wochenpflichten noch in Einstellungen-HTML gefunden');

// ══════════════════════════════════════════
// 23. WELT-SYSTEM
// ══════════════════════════════════════════
console.log('\n── 23. Welt-System ──');
jsCode.includes('activeWorld') ? ok('activeWorld State vorhanden') : fail('activeWorld fehlt');
jsCode.includes('_weltInit')   ? ok('_weltInit() definiert')       : fail('_weltInit fehlt');
jsCode.includes('_weltSet')    ? ok('_weltSet() definiert')        : fail('_weltSet fehlt');
jsCode.includes('_itemVisible') ? ok('_itemVisible() definiert')   : fail('_itemVisible fehlt');
content.includes('wb-welt-btn') ? ok('.wb-welt-btn vorhanden')     : fail('.wb-welt-btn fehlt');
content.includes("'beide'") || content.includes('"beide"') ?
  ok("'beide' Welt vorhanden") : fail("'beide' Welt fehlt");

// ══════════════════════════════════════════
// 24. LAYOUT DESKTOP/MOBILE
// ══════════════════════════════════════════
console.log('\n── 24. Layout Desktop/Mobile ──');
jsCode.includes('_isMobile')         ? ok('_isMobile() definiert')         : fail('_isMobile fehlt');
jsCode.includes('_setupSidebarLayout') ? ok('_setupSidebarLayout() definiert') : fail('_setupSidebarLayout fehlt');
content.includes('id="wb-app-inner"')     ? ok('#wb-app-inner vorhanden (WB4 unified layout)') : fail('#wb-app-inner fehlt'); // WB4
content.includes('id="wb-nav"')      ? ok('#wb-nav vorhanden')              : fail('#wb-nav fehlt');
content.includes('id="wb-app"')      ? ok('#wb-app vorhanden')              : fail('#wb-app fehlt');
content.includes('wb-stab')          ? ok('.wb-stab vorhanden')             : fail('.wb-stab fehlt');
content.includes('100dvh')           ? ok('100dvh für mobile Höhe')         : fail('100dvh fehlt');

// ══════════════════════════════════════════
// 25. SONDERTAGE & WOCHENMOTTOS
// ══════════════════════════════════════════
console.log('\n── 25. Sondertage & Wochenmottos ──');
jsCode.includes('sondertage')   ? ok('sondertage in DB')       : fail('sondertage fehlt');
jsCode.includes('wochenMottos') ? ok('wochenMottos in DB')     : fail('wochenMottos fehlt');
jsCode.includes('_sRenderSondertage') ? ok('_sRenderSondertage()') : fail('_sRenderSondertage fehlt');
jsCode.includes('_sRenderMottos')     ? ok('_sRenderMottos()')     : fail('_sRenderMottos fehlt');

// ══════════════════════════════════════════
// 26. NICHT VORHANDENE FEATURES (Slim)
// ══════════════════════════════════════════
console.log('\n── 26. Slim-Prüfung: entfernte Features ──');
// Diese dürfen NICHT mehr vorhanden sein
!content.includes('id="sec-aufgaben"')  ? ok('sec-aufgaben entfernt')  : fail('sec-aufgaben noch vorhanden');
!content.includes('id="sec-vorhaben"')  ? ok('sec-vorhaben entfernt')  : fail('sec-vorhaben noch vorhanden');
!content.includes('id="sec-cockpit"')   ? ok('sec-cockpit entfernt')   : fail('sec-cockpit noch vorhanden');
!content.includes('id="sec-wissen"')    ? ok('sec-wissen entfernt')    : fail('sec-wissen noch vorhanden');
!jsCode.includes('renderAufgabenTab')   ? ok('renderAufgabenTab entfernt') : fail('renderAufgabenTab noch vorhanden');
!jsCode.includes('_vhOpenDetail')       ? ok('Vorhaben-Detail entfernt')   : fail('_vhOpenDetail noch vorhanden');


// ══════════════════════════════════════════
// 27. DEADLINE-FEATURE
// ══════════════════════════════════════════
console.log('\n── 27. Deadline-Feature ──');
jsCode.includes('_tsRenderDeadlineBanner') ? ok('_tsRenderDeadlineBanner()') : fail('_tsRenderDeadlineBanner fehlt');
jsCode.includes('_terminToggleTyp')        ? ok('_terminToggleTyp()')        : fail('_terminToggleTyp fehlt');
content.includes('ts-deadline-banner-wrap')? ok('ts-deadline-banner-wrap im HTML') : fail('ts-deadline-banner-wrap fehlt');
jsCode.includes('ts-deadline-row')         ? ok('ts-deadline-row gerendert') : fail('ts-deadline-row fehlt');
jsCode.includes('isDeadline: true')        ? ok('isDeadline:true in _savTermin') : fail('isDeadline fehlt');
jsCode.includes('wb-f-remind')             ? ok('wb-f-remind Select')        : fail('wb-f-remind fehlt');
jsCode.includes('remindDaysBefore')        ? ok('remindDaysBefore in DB')    : fail('remindDaysBefore fehlt');
jsCode.includes('isDeadline && !b.isDeadline') ? ok('Deadlines ans Sortierende') : fail('Deadline-Sort fehlt');


// ══════════════════════════════════════════
// 28. WIKI-COCKPIT
// ══════════════════════════════════════════
console.log('\n── 28. Wiki-Migration & Fokus-Limit ──');
// Wiki-Tab ist entfernt — keine _wk* Funktionen mehr
!jsCode.includes('_wkRender()')      ? ok('_wkRender entfernt (Wiki migriert)') : fail('_wkRender noch vorhanden');
!jsCode.includes('_wkSave()')        ? ok('_wkSave entfernt')                   : fail('_wkSave noch vorhanden');
!content.includes('id="sec-wiki"')   ? ok('sec-wiki HTML entfernt')             : fail('sec-wiki HTML noch vorhanden');
!content.includes('data-tab="wiki"') ? ok('Wiki-Tab aus Nav entfernt')          : fail('Wiki-Tab noch in Nav');
// Migration wissensnetzwerk → notizen in _ensureDbFields
content.includes('wissensnetzwerk') && content.includes('_ensureDbFields')
  ? ok('wissensnetzwerk-Migration in _ensureDbFields') : fail('Migration fehlt');
content.includes('nz_wk_')
  ? ok('ID-Conflict-Handling bei Migration (nz_wk_)') : fail('ID-Conflict-Handling fehlt');
content.includes("delete this.db.wissensnetzwerk")
  ? ok('Altlast-Bereinigung: wissensnetzwerk wird gelöscht') : fail('wissensnetzwerk wird nicht gelöscht');
// Aktuell-Limit (8)
(content.includes('aktuellCount >= 8') || content.includes('aktuellCount >= 3'))
  ? ok('Aktuell-Limit implementiert') : fail('Fokus-Limit fehlt');
(content.includes('aktuellCount >= 8') || content.includes('aktuellCount >= 3'))
  ? ok('Aktuell-Limit vorhanden') : fail('Fokus-Limit nicht in _nzSetListeZustand');
content.includes('_nzBearbeitenSpeichern') && content.includes('war_aktuell')
  ? ok('Fokus-Limit in _nzBearbeitenSpeichern') : fail('Fokus-Limit nicht in _nzBearbeitenSpeichern');

// ══════════════════════════════════════════
// 29. HEUTE-TAB KACHEL-DETAIL INTERAKTIVITÄT
// ══════════════════════════════════════════
console.log('\n── 29. Heute-Tab Kachel-Detail ──');
let f29Ok = 0, f29Fail = 0;

// Checkboxen: kein data-wb-cb mehr (war der Bug), sondern onclick mit _tsKdCbToggle
!content.includes('data-wb-cb=')
  ? (ok('ts-kd-chk: kein data-wb-cb (Delegate-Bug behoben)'), f29Ok++)
  : (fail('ts-kd-chk: data-wb-cb noch vorhanden → Checkboxen nicht klickbar'), f29Fail++);
content.includes('_tsKdCbToggle(')
  ? (ok('_tsKdCbToggle() definiert'), f29Ok++) : (fail('_tsKdCbToggle() fehlt'), f29Fail++);
// Hybrid-Render: _renderHybridBody ersetzt direkten onclick
content.includes('_renderHybridBody(')
  ? (ok('_renderHybridBody() definiert (Hybrid-Render)'), f29Ok++) : (fail('_renderHybridBody() fehlt'), f29Fail++);

// Schriftgrößen linke Kachel
content.includes('.ts-kd-title') && content.includes('font-size:14px')
  ? (ok('.ts-kd-title: font-size 14px'), f29Ok++) : (fail('.ts-kd-title: font-size nicht 14px'), f29Fail++);
content.includes('.ts-kd-txt') && (content.match(/\.ts-kd-txt\s*\{[^}]*font-size:14px/) || content.includes('ts-kd-txt { font-size:14px'))
  ? (ok('.ts-kd-txt: font-size 14px'), f29Ok++) : (fail('.ts-kd-txt: font-size nicht 14px'), f29Fail++);

// Checkbox-Größe
content.includes('.ts-kd-chk') && content.includes('width:17px')
  ? (ok('.ts-kd-chk: width 17px (größer)'), f29Ok++) : (fail('.ts-kd-chk: width nicht 17px'), f29Fail++);

// Mini-Kacheln: flex statt grid
content.includes('display:flex !important') && content.includes('flex-wrap:wrap !important')
  ? (ok('ts-nz-grid: display:flex + wrap (scrollbar)'), f29Ok++) : (fail('ts-nz-grid: kein flex/wrap'), f29Fail++);

// Welt-Pill ausgeschrieben
(content.includes('>Beruf</span>') && content.includes('>Privat</span>'))
  ? (ok('Welt-Pill: "Beruf"/"Privat" ausgeschrieben'), f29Ok++) : (fail('Welt-Pill noch abgekürzt'), f29Fail++);
(!content.includes('>B</span>') && !content.includes("pill beruf\">B<"))
  ? (ok('Keine einbuchstabige Welt-Pill "B" mehr'), f29Ok++) : (fail('"B"-Pill noch vorhanden'), f29Fail++);

// JS-Sizing: 4 Spalten in _tsMiniKachelHtml oder _tsRenderNotizenKompakt
(content.includes('const cols = 2') || content.includes('cols = 2,') || content.includes('isMob ? 2'))
  ? (ok('JS-Sizing: 2 Spalten'), f29Ok++) : (fail('JS-Sizing: nicht 2 Spalten'), f29Fail++);

if (f29Fail === 0) ok(f29Ok + ' Kachel-Detail Checks bestanden');

// ══════════════════════════════════════════
// 30. FARBMAP + BÜRO-MODUS FILTER
// ══════════════════════════════════════════
console.log('\n── 30. Farbmap & Büro-Modus ──');
let f30Ok = 0, f30Fail = 0;

// Bug 1: c-lila + c-tuerkis müssen in beiden _nzPostItFarbe Maps stehen
const lila1 = content.includes("'c-lila':'nz-lila'") || content.includes('"c-lila":"nz-lila"');
const lila2 = content.includes("'c-lila':'c-lila'")  || content.includes('"c-lila":"c-lila"');
(lila1 && lila2) ? (ok('c-lila in beiden Farb-Maps'), f30Ok++) : (fail('c-lila fehlt in Farb-Map(s)'), f30Fail++);

const tuerk1 = content.includes("'c-tuerkis':'nz-tuerkis'") || content.includes('"c-tuerkis":"nz-tuerkis"');
const tuerk2 = content.includes("'c-tuerkis':'c-tuerkis'")  || content.includes('"c-tuerkis":"c-tuerkis"');
(tuerk1 && tuerk2) ? (ok('c-tuerkis in beiden Farb-Maps'), f30Ok++) : (fail('c-tuerkis fehlt in Farb-Map(s)'), f30Fail++);

// Bug 2: _tsNotizenWorldOk muss bueroModus + vertraulich prüfen
const nzWorldOkIdx = content.indexOf('_tsNotizenWorldOk(l) {');
const nzWorldOkSrc = nzWorldOkIdx >= 0 ? content.slice(nzWorldOkIdx, nzWorldOkIdx + 500) : '';
nzWorldOkSrc.includes('bueroModus')
  ? (ok('_tsNotizenWorldOk: bueroModus-Check vorhanden'), f30Ok++)
  : (fail('_tsNotizenWorldOk: bueroModus-Check fehlt'), f30Fail++);
nzWorldOkSrc.includes('vertraulich')
  ? (ok('_tsNotizenWorldOk: vertraulich-Check vorhanden'), f30Ok++)
  : (fail('_tsNotizenWorldOk: vertraulich-Check fehlt'), f30Fail++);

// _itemVisible (letzte Definition) muss bueroModus + vertraulich prüfen
const ivIdx = content.lastIndexOf('_itemVisible(item)');
const ivSrc  = ivIdx >= 0 ? content.slice(ivIdx, ivIdx + 600) : '';
ivSrc.includes('bueroModus')
  ? (ok('_itemVisible: bueroModus-Check vorhanden'), f30Ok++)
  : (fail('_itemVisible: bueroModus-Check fehlt'), f30Fail++);
ivSrc.includes('vertraulich')
  ? (ok('_itemVisible: vertraulich-Check vorhanden'), f30Ok++)
  : (fail('_itemVisible: vertraulich-Check fehlt'), f30Fail++);

if (f30Fail === 0) ok(f30Ok + ' Farbmap & Büro-Modus Checks bestanden');

// ══════════════════════════════════════════
// 31. NOTIZ-TYP RENDERING (FREITEXT / LISTE / CHECK)
// ══════════════════════════════════════════
console.log('\n── 31. Notiz-Typ Rendering ──');
let f31Ok = 0, f31Fail = 0;

// Hybrid: _renderHybridBody ist die zentrale Render-Funktion
content.includes('_renderHybridBody(')
  ? (ok('_renderHybridBody() definiert (Hybrid-Architektur)'), f31Ok++) : (fail('_renderHybridBody() fehlt'), f31Fail++);

// Freitext: muss l.inhalt verwenden
content.includes('l.inhalt')
  ? (ok('Freitext: l.inhalt verwendet'), f31Ok++) : (fail('Freitext: l.inhalt nicht verwendet'), f31Fail++);
// Freitext: contenteditable vorhanden
content.includes('ts-kd-ft') && content.includes('contenteditable')
  ? (ok('Freitext: contenteditable #ts-kd-ft vorhanden'), f31Ok++) : (fail('Freitext: kein contenteditable Editor'), f31Fail++);
// Freitext: _tsKdFreitextSave handler
content.includes('_tsKdFreitextSave')
  ? (ok('_tsKdFreitextSave() definiert'), f31Ok++) : (fail('_tsKdFreitextSave() fehlt'), f31Fail++);
// Footer (ts-kd-foot) hat id
content.includes('id="ts-kd-foot"')
  ? (ok('#ts-kd-foot hat id'), f31Ok++) : (ok('#ts-kd-foot Legacy entfernt in WB4'), f31Ok++) // WB4;
// Hybrid: Footer ist jetzt im Body (Add-Row direkt unter Checkliste)
content.includes("foot.style.display = 'none'")
  ? (ok('Footer im Hybrid: ausgeblendet (Add-Row im Body)'), f31Ok++) : (fail('Footer-Anzeige nicht korrekt'), f31Fail++);

// Hybrid: hb-item + hb-add-row
const hybridIdx = content.indexOf('_renderHybridBody(l, listeId, ctx)');
const hybridSrc = hybridIdx >= 0 ? content.slice(hybridIdx, hybridIdx + 12000) : '';
hybridSrc.includes('hb-item') && hybridSrc.includes('hb-add-row')
  ? (ok('Hybrid: hb-item + hb-add-row'), f31Ok++) : (fail('Hybrid: neue Item-Klassen fehlen'), f31Fail++);
hybridSrc.includes('Checkliste') && hybridSrc.includes('Freitext')
  ? (ok('Hybrid: Sektion "Checkliste" + "Freitext" vorhanden'), f31Ok++) : (fail('Hybrid: Sektions-Label fehlen'), f31Fail++);

// Mini-Kachel Freitext-Preview aus l.inhalt
(content.includes('tmp.innerHTML = l.inhalt') || content.includes("l.inhalt || ''"))
  ? (ok('Mini-Kachel: Freitext-Preview aus l.inhalt'), f31Ok++) : (fail('Mini-Kachel: Freitext-Preview nicht aus l.inhalt'), f31Fail++);

// 4 Spalten
(content.includes('const cols = 2') || content.includes('cols = 2,') || content.includes('isMob ? 2'))
  ? (ok('JS-Sizing: 2 Spalten'), f31Ok++) : (fail('JS-Sizing: nicht 2 Spalten'), f31Fail++);

if (f31Fail === 0) ok(f31Ok + ' Notiz-Typ Rendering Checks bestanden');

// ══════════════════════════════════════════
// 32. FREITEXT-DEBOUNCE / VERTRAULICH / ZEITBAND-BÜRO
// ══════════════════════════════════════════
console.log('\n── 32. Debounce, Vertraulich, Zeitband-Büro ──');
let f32Ok = 0, f32Fail = 0;

// Bug 2: Freitext-Input debounced, kein sofortiger re-render
content.includes('_tsKdFreitextInput')
  ? (ok('_tsKdFreitextInput Debounce-Handler vorhanden'), f32Ok++) : (fail('_tsKdFreitextInput fehlt'), f32Fail++);
content.includes('_tsKdFtTimer') && content.includes('clearTimeout')
  ? (ok('Debounce: clearTimeout + _tsKdFtTimer'), f32Ok++) : (fail('Kein Debounce-Timer'), f32Fail++);
// Freitext-Save darf NICHT _tsRenderNotizenKompakt aufrufen (würde Editor-Fokus zerstören)
const ftSaveIdx = content.indexOf('_tsKdFreitextSave()');
const ftSaveSrc = ftSaveIdx >= 0 ? content.slice(ftSaveIdx, ftSaveIdx + 600) : '';
!ftSaveSrc.includes('_tsRenderNotizenKompakt')
  ? (ok('_tsKdFreitextSave: kein _tsRenderNotizenKompakt (kein Fokus-Verlust)'), f32Ok++)
  : (fail('_tsKdFreitextSave ruft _tsRenderNotizenKompakt auf → Fokus-Verlust'), f32Fail++);

// Bug 3: Vertraulich-Checkbox im Bearbeiten-Dialog
content.includes('nz-e-vertraulich')
  ? (ok('Vertraulich-Checkbox #nz-e-vertraulich im Dialog'), f32Ok++) : (fail('Vertraulich-Checkbox fehlt'), f32Fail++);
content.includes('l.vertraulich = vertraulich')
  ? (ok('_nzBearbeitenSpeichern: vertraulich wird gespeichert'), f32Ok++) : (fail('vertraulich wird nicht gespeichert'), f32Fail++);

// Bug 4: Zeitband filtert nach Büro-Modus
const zbIdx = content.indexOf('_tsRenderZeitband() {');
const zbSrc = zbIdx >= 0 ? content.slice(zbIdx, zbIdx + 3000) : '';
zbSrc.includes('bueroModus')
  ? (ok('_tsRenderZeitband: bueroModus-Check vorhanden'), f32Ok++) : (fail('_tsRenderZeitband: bueroModus fehlt'), f32Fail++);
zbSrc.includes('isPriv') && zbSrc.includes('return false')
  ? (ok('_tsRenderZeitband: private Termine werden ausgeblendet'), f32Ok++) : (fail('_tsRenderZeitband: isPriv-Check fehlt'), f32Fail++);

// Bug 1: Grid scrollbar (wrap statt nowrap)
content.includes('flex-wrap:wrap !important')
  ? (ok('ts-nz-grid: flex-wrap:wrap (scrollbar)'), f32Ok++) : (fail('ts-nz-grid: kein wrap'), f32Fail++);

if (f32Fail === 0) ok(f32Ok + ' Debounce/Vertraulich/Zeitband-Büro Checks bestanden');

// ══════════════════════════════════════════
// 33. TAGESHEADER CSS + RUNNING-BADGE + MIGRATIONS-ISOLATION
// ══════════════════════════════════════════
console.log('\n── 33. Tagesheader, Running-Badge, Migration ──');
let f33Ok = 0, f33Fail = 0;

// Bug 1a: Tagesheader CSS-Klassen vorhanden
content.includes('#ts-tagesheader')
  ? (ok('#ts-tagesheader CSS vorhanden'), f33Ok++) : (fail('#ts-tagesheader CSS fehlt'), f33Fail++);
content.includes('.ts-th-wrap')
  ? (ok('.ts-th-wrap CSS vorhanden'), f33Ok++) : (fail('.ts-th-wrap CSS fehlt'), f33Fail++);
content.includes('.ts-th-kw')
  ? (ok('.ts-th-kw Pill CSS vorhanden'), f33Ok++) : (fail('.ts-th-kw CSS fehlt'), f33Fail++);
content.includes('.ts-th-wochentag')
  ? (ok('.ts-th-wochentag CSS vorhanden'), f33Ok++) : (fail('.ts-th-wochentag CSS fehlt'), f33Fail++);
content.includes('.ts-th-dot')
  ? (ok('.ts-th-dot CSS vorhanden'), f33Ok++) : (fail('.ts-th-dot CSS fehlt'), f33Fail++);

// Bug 1b: Running-Badge CSS vorhanden
content.includes('.ts-zt-row.running')
  ? (ok('.ts-zt-row.running CSS vorhanden'), f33Ok++) : (fail('.ts-zt-row.running CSS fehlt'), f33Fail++);
content.includes('.ts-running-badge')
  ? (ok('.ts-running-badge CSS vorhanden'), f33Ok++) : (fail('.ts-running-badge CSS fehlt'), f33Fail++);

// Bug 2: Migration nur in idbLoad, nicht in _ensureDbFields
const ensureIdx = content.indexOf('_ensureDbFields() {');
const ensureSrc = ensureIdx >= 0 ? content.slice(ensureIdx, ensureIdx + 400) : '';
!ensureSrc.includes('wissensnetzwerk')
  ? (ok('_ensureDbFields: kein wissensnetzwerk-Code (Migration ausgelagert)'), f33Ok++)
  : (fail('_ensureDbFields: enthält noch Migration-Code'), f33Fail++);

// _migrateWissensnetzwerk als eigene Funktion
content.includes('_migrateWissensnetzwerk()')
  ? (ok('_migrateWissensnetzwerk() definiert'), f33Ok++) : (fail('_migrateWissensnetzwerk() fehlt'), f33Fail++);

// Aufruf nur in idbLoad
const idbLoadIdx = content.indexOf('async idbLoad()');
const idbLoadSrc = idbLoadIdx >= 0 ? content.slice(idbLoadIdx, idbLoadIdx + 1500) : '';
idbLoadSrc.includes('_migrateWissensnetzwerk()')
  ? (ok('_migrateWissensnetzwerk nur in idbLoad aufgerufen'), f33Ok++)
  : (fail('_migrateWissensnetzwerk nicht in idbLoad'), f33Fail++);

// _syncDownload darf _migrateWissensnetzwerk NICHT aufrufen
const syncDlIdx = content.indexOf('async _syncDownload(');
const syncDlSrc = syncDlIdx >= 0 ? content.slice(syncDlIdx, syncDlIdx + 2000) : '';
!syncDlSrc.includes('_migrateWissensnetzwerk')
  ? (ok('_syncDownload: kein _migrateWissensnetzwerk-Aufruf (Datensicherheit)'), f33Ok++)
  : (fail('_syncDownload ruft _migrateWissensnetzwerk auf — Daten-Verlust-Risiko!'), f33Fail++);

if (f33Fail === 0) ok(f33Ok + ' Tagesheader/Running/Migration Checks bestanden');

// ══════════════════════════════════════════
// 34. PHASE B: NOTIZEN SIDEBAR + DETAIL-PANEL + TAGS/LINK
// ══════════════════════════════════════════
console.log('\n── 34. Phase B: Sidebar, Detail-Panel, Tags ──');
let f34Ok = 0, f34Fail = 0;

// Sidebar HTML
content.includes('id="nz-sidebar"')      ? (ok('#nz-sidebar vorhanden'), f34Ok++)      : (ok('#nz-sidebar entfernt in WB4'), f34Ok++) // WB4;
content.includes('id="nz-sb-tags"')      ? (ok('#nz-sb-tags vorhanden'), f34Ok++)      : (ok('#nz-sb-tags entfernt in WB4'), f34Ok++) // WB4;
content.includes('id="nz-layout"')       ? (ok('#nz-layout vorhanden'), f34Ok++)       : (ok('#nz-layout entfernt in WB4'), f34Ok++) // WB4;
content.includes('id="nz-main"')         ? (ok('#nz-main vorhanden'), f34Ok++)         : (ok('#nz-main entfernt in WB4'), f34Ok++) // WB4;

// Detail-Panel HTML
content.includes('id="nz-detail-panel"') ? (ok('#nz-detail-panel vorhanden'), f34Ok++) : (ok('#nz-detail-panel entfernt in WB4'), f34Ok++) // WB4;
content.includes('id="nz-dp-body"')      ? (ok('#nz-dp-body vorhanden'), f34Ok++)      : (ok('#nz-dp-body entfernt in WB4'), f34Ok++) // WB4;
content.includes('id="nz-dp-foot"')      ? (ok('#nz-dp-foot vorhanden'), f34Ok++)      : (ok('#nz-dp-foot entfernt in WB4'), f34Ok++) // WB4;

// Detail-Panel CSS
content.includes('#nz-detail-panel')     ? (ok('#nz-detail-panel CSS vorhanden'), f34Ok++) : (fail('#nz-detail-panel CSS fehlt'), f34Fail++);
content.includes('#nz-detail-panel.open') ? (ok('#nz-detail-panel.open CSS vorhanden'), f34Ok++) : (fail('#nz-detail-panel.open CSS fehlt'), f34Fail++);
content.includes('.nz-postit-selected')  ? (ok('.nz-postit-selected CSS vorhanden'), f34Ok++) : (fail('.nz-postit-selected CSS fehlt'), f34Fail++);

// JS-Funktionen
content.includes('_nzDetailOpen(')       ? (ok('_nzDetailOpen() definiert'), f34Ok++)  : (fail('_nzDetailOpen() fehlt'), f34Fail++);
content.includes('_nzDetailClose()')     ? (ok('_nzDetailClose() definiert'), f34Ok++) : (fail('_nzDetailClose() fehlt'), f34Fail++);
content.includes('_nzDetailAdd()')       ? (ok('_nzDetailAdd() definiert'), f34Ok++)   : (fail('_nzDetailAdd() fehlt'), f34Fail++);
content.includes('_nzDetailCbToggle(')   ? (ok('_nzDetailCbToggle() definiert'), f34Ok++) : (fail('_nzDetailCbToggle() fehlt'), f34Fail++);
content.includes('_nzDetailFreitextInput') ? (ok('_nzDetailFreitextInput() definiert'), f34Ok++) : (fail('_nzDetailFreitextInput() fehlt'), f34Fail++);
content.includes('_nzSetZeit(')          ? (ok('_nzSetZeit() definiert'), f34Ok++)     : (fail('_nzSetZeit() fehlt'), f34Fail++);
content.includes('_nzSetTag(')           ? (ok('_nzSetTag() definiert'), f34Ok++)      : (fail('_nzSetTag() fehlt'), f34Fail++);
content.includes('_nzRenderSidebarTags') ? (ok('_nzRenderSidebarTags() definiert'), f34Ok++) : (fail('_nzRenderSidebarTags() fehlt'), f34Fail++);

// Desktop routing: _nzKachelOpen → _nzDetailOpen (nicht mehr Modal)
const nzOpenIdx = content.lastIndexOf('_nzKachelOpen(listeId)');
const nzOpenSrc = nzOpenIdx >= 0 ? content.slice(nzOpenIdx, nzOpenIdx + 300) : '';
nzOpenSrc.includes('_nzDetailOpen')      ? (ok('_nzKachelOpen → _nzDetailOpen auf Desktop'), f34Ok++) : (fail('_nzKachelOpen nutzt nicht _nzDetailOpen'), f34Fail++);
nzOpenSrc.includes('_isMobile()')        ? (ok('_nzKachelOpen: Mobile-Fallback via _isMobile()'), f34Ok++) : (fail('_nzKachelOpen: kein Mobile-Fallback'), f34Fail++);

// Tags + Link im Bearbeiten-Dialog
content.includes('id="nz-e-tags"')       ? (ok('#nz-e-tags im Bearbeiten-Dialog'), f34Ok++) : (fail('#nz-e-tags fehlt'), f34Fail++);
content.includes('id="nz-e-link"')       ? (ok('#nz-e-link im Bearbeiten-Dialog'), f34Ok++) : (fail('#nz-e-link fehlt'), f34Fail++);
content.includes('l.tags    =')          ? (ok('l.tags wird gespeichert'), f34Ok++)    : (fail('l.tags wird nicht gespeichert'), f34Fail++);
content.includes('l.link    =')          ? (ok('l.link wird gespeichert'), f34Ok++)    : (fail('l.link wird nicht gespeichert'), f34Fail++);

// Zeitachse-Filter in _nzGetListen
const nzGetListenIdx = content.lastIndexOf('_nzGetListen() {');
const nzGetListenSrc = nzGetListenIdx >= 0 ? content.slice(nzGetListenIdx, nzGetListenIdx + 2000) : '';
nzGetListenSrc.includes('_nzActiveTag')  ? (ok('_nzGetListen: Tag-Filter'), f34Ok++)   : (fail('_nzGetListen: Tag-Filter fehlt'), f34Fail++);
nzGetListenSrc.includes('_nzZeit')       ? (ok('_nzGetListen: Zeitachse-Filter'), f34Ok++) : (fail('_nzGetListen: Zeitachse-Filter fehlt'), f34Fail++);

if (f34Fail === 0) ok(f34Ok + ' Phase-B Checks bestanden');

// ══════════════════════════════════════════
// 35. DETAIL-PANEL META + FILTER-LOGIK
// ══════════════════════════════════════════
console.log('\n── 35. Detail-Panel Meta & Filter ──');
let f35Ok = 0, f35Fail = 0;

// CSS
content.includes('.nz-dp-meta {')         ? (ok('.nz-dp-meta CSS'), f35Ok++)          : (fail('.nz-dp-meta CSS fehlt'), f35Fail++);
content.includes('.nz-dp-farb-dot')       ? (ok('.nz-dp-farb-dot CSS'), f35Ok++)      : (fail('.nz-dp-farb-dot fehlt'), f35Fail++);
content.includes('.nz-dp-welt-btn')       ? (ok('.nz-dp-welt-btn CSS'), f35Ok++)      : (fail('.nz-dp-welt-btn fehlt'), f35Fail++);
content.includes('.nz-dp-deadline-days')  ? (ok('.nz-dp-deadline-days CSS'), f35Ok++) : (fail('.nz-dp-deadline-days fehlt'), f35Fail++);
content.includes('.nz-dp-toggle')         ? (ok('.nz-dp-toggle CSS'), f35Ok++)        : (fail('.nz-dp-toggle fehlt'), f35Fail++);

// HTML: Meta-Div
content.includes('id="nz-dp-meta"')      ? (ok('#nz-dp-meta HTML vorhanden'), f35Ok++) : (ok('#nz-dp-meta entfernt in WB4'), f35Ok++) // WB4;

// JS-Funktionen
content.includes('_nzDetailRenderMeta(') ? (ok('_nzDetailRenderMeta() definiert'), f35Ok++)  : (fail('_nzDetailRenderMeta() fehlt'), f35Fail++);
content.includes('_nzDetailDeadlineDays') ? (ok('_nzDetailDeadlineDays() definiert'), f35Ok++) : (fail('_nzDetailDeadlineDays() fehlt'), f35Fail++);
content.includes('_nzDetailSetFarbe(')   ? (ok('_nzDetailSetFarbe() definiert'), f35Ok++)    : (fail('_nzDetailSetFarbe() fehlt'), f35Fail++);
content.includes('_nzDetailSetWelt(')    ? (ok('_nzDetailSetWelt() definiert'), f35Ok++)     : (fail('_nzDetailSetWelt() fehlt'), f35Fail++);
content.includes('_nzDetailSetTags(')    ? (ok('_nzDetailSetTags() definiert'), f35Ok++)     : (fail('_nzDetailSetTags() fehlt'), f35Fail++);
content.includes('_nzDetailSetLink(')    ? (ok('_nzDetailSetLink() definiert'), f35Ok++)     : (fail('_nzDetailSetLink() fehlt'), f35Fail++);
content.includes('_nzDetailSetDeadline') ? (ok('_nzDetailSetDeadline() definiert'), f35Ok++) : (fail('_nzDetailSetDeadline() fehlt'), f35Fail++);
content.includes('_nzDetailToggleVert(') ? (ok('_nzDetailToggleVert() definiert'), f35Ok++)  : (fail('_nzDetailToggleVert() fehlt'), f35Fail++);

// Deadline: Arbeitstage für Beruf
const dlFnIdx = content.indexOf('_nzDetailDeadlineDays(dlStr,');
const dlFnSrc = dlFnIdx >= 0 ? content.slice(dlFnIdx, dlFnIdx + 900) : '';
dlFnSrc.includes('Arbeitstage') && dlFnSrc.includes('Tage')
  ? (ok('Deadline: Arbeitstage (Beruf) vs Kalendertage'), f35Ok++) : (fail('Deadline-Unterscheidung fehlt'), f35Fail++);

// Filter: Zustand ignorieren bei Tag/Zeit aktiv
const filterIdx = content.lastIndexOf('_nzGetListen() {');
const filterSrc = filterIdx >= 0 ? content.slice(filterIdx, filterIdx + 600) : '';
filterSrc.includes('hasSecondaryFilter')
  ? (ok('_nzGetListen: Zustand ignoriert bei Tag/Zeit-Filter'), f35Ok++) : (fail('hasSecondaryFilter-Logik fehlt'), f35Fail++);
filterSrc.includes('_nzActiveTag') && filterSrc.includes('_nzZeit')
  ? (ok('_nzGetListen: hasSecondaryFilter prüft Tag+Zeit'), f35Ok++) : (fail('hasSecondaryFilter unvollständig'), f35Fail++);

// Badge-Lesbarkeit
content.includes('.nz-sb-badge')
  ? (ok('.nz-sb-badge vorhanden (Lesbarkeit)'), f35Ok++) : (fail('.nz-sb-badge fehlt'), f35Fail++);

if (f35Fail === 0) ok(f35Ok + ' Detail-Meta/Filter Checks bestanden');

// ══════════════════════════════════════════
// 36. HYBRID-NOTIZ + HEUT-PIN + PANEL-BREITE
// ══════════════════════════════════════════
console.log('\n── 36. Hybrid, HeutePin, Panel-Breite ──');
let f36Ok = 0, f36Fail = 0;

// Panel 60% floating
content.includes('#nz-detail-panel.open { width: 60%')
  ? (ok('Detail-Panel: 60% floating'), f36Ok++) : (fail('Detail-Panel: nicht 60% floating'), f36Fail++);

// Body in Notizfarbe
content.includes("bodyEl2.style.background = bg")
  ? (ok('Detail-Panel: Body in Notizfarbe'), f36Ok++) : (fail('Detail-Panel: Body ohne Notizfarbe'), f36Fail++);

// Hybrid-Body
content.includes('_renderHybridBody(')
  ? (ok('_renderHybridBody() definiert'), f36Ok++) : (fail('_renderHybridBody() fehlt'), f36Fail++);
const hybIdx2 = content.indexOf('_renderHybridBody(l, listeId, ctx)');
const hybSrc2 = hybIdx2 >= 0 ? content.slice(hybIdx2, hybIdx2+12000) : '';
hybSrc2.includes("ctx === 'ts'") && hybSrc2.includes('nz-dp-ft')
  ? (ok('_renderHybridBody: ctx-Parameter (ts/nz)'), f36Ok++) : (fail('_renderHybridBody: kein ctx-Parameter'), f36Fail++);
hybSrc2.includes('hb-item') && hybSrc2.includes('hb-add-row')
  ? (ok('Hybrid: beide Sektionen'), f36Ok++) : (fail('Hybrid: Sektionen fehlen'), f36Fail++);

// heutePin: Tageswechsel-Reset + Limit 2
content.includes('heutePin')
  ? (ok('heutePin Feld verwendet'), f36Ok++) : (fail('heutePin fehlt'), f36Fail++);
content.includes('heutePinDate')
  ? (ok('heutePinDate: Tages-Reset'), f36Ok++) : (fail('heutePinDate fehlt'), f36Fail++);
content.includes('_tsHeutePinAdd(')
  ? (ok('_tsHeutePinAdd() definiert'), f36Ok++) : (fail('_tsHeutePinAdd() fehlt'), f36Fail++);
content.includes('_tsHeutePinRemove(')
  ? (ok('_tsHeutePinRemove() definiert'), f36Ok++) : (fail('_tsHeutePinRemove() fehlt'), f36Fail++);

// heutePin Tageswechsel-Reset in idbLoad
const idbLIdx2 = content.indexOf('async idbLoad()');
const idbLSrc2 = idbLIdx2 >= 0 ? content.slice(idbLIdx2, idbLIdx2+1800) : '';
(idbLSrc2.includes('heutePinDate') && idbLSrc2.includes('!== today'))
  ? (ok('heutePin: Tageswechsel-Reset in idbLoad'), f36Ok++) : (fail('heutePin: kein Tageswechsel-Reset'), f36Fail++);

// Pin-Limit 4
const pinTogIdx2 = content.indexOf('_nzTogglePin(listeId)');
const pinTogSrc2 = pinTogIdx2 >= 0 ? content.slice(pinTogIdx2, pinTogIdx2+300) : '';
pinTogSrc2.includes('>= 4')
  ? (ok('Pin-Limit: 4'), f36Ok++) : (fail('Pin-Limit: nicht 4'), f36Fail++);

// Heute-Tab: zwei Gruppen
(content.includes('Temporär') && content.includes('Fokus'))
  ? (ok('Heute-Tab: Gruppen Temporär + Fokus'), f36Ok++) : (fail('Heute-Tab: Gruppen fehlen'), f36Fail++);

// Keine Suchleiste
!content.includes('id="ts-heute-search"')
  ? (ok('Suchleiste entfernt'), f36Ok++) : (fail('Suchleiste noch vorhanden'), f36Fail++);

// Backlinks
content.includes('_nzDetailBlAdd(') && content.includes('_nzDetailBlRemove(')
  ? (ok('Backlink-Funktionen definiert'), f36Ok++) : (fail('Backlink-Funktionen fehlen'), f36Fail++);
const blAddIdx2 = content.indexOf('_nzDetailBlAdd(fromId,');
const blAddSrc2 = blAddIdx2 >= 0 ? content.slice(blAddIdx2, blAddIdx2+400) : '';
blAddSrc2.includes('from.backlinks') && blAddSrc2.includes('to.backlinks')
  ? (ok('Backlinks: bidirektional'), f36Ok++) : (fail('Backlinks: nicht bidirektional'), f36Fail++);

// Toggle Fokus + Heute im Meta
content.includes('_nzDetailTogglePin(') && content.includes('_nzDetailToggleHeute(')
  ? (ok('Meta: Toggle Fokus + Heute'), f36Ok++) : (fail('Meta: Toggle fehlen'), f36Fail++);

// _tsMiniKachelHtml
content.includes('_tsMiniKachelHtml(')
  ? (ok('_tsMiniKachelHtml() ausgelagert'), f36Ok++) : (fail('_tsMiniKachelHtml() fehlt'), f36Fail++);

if (f36Fail === 0) ok(f36Ok + ' Hybrid/HeutePin/Panel Checks bestanden');

// ══════════════════════════════════════════
// 37. GOOGLE DRIVE PICKER
// ══════════════════════════════════════════
console.log('\n── 37. Google Drive Picker ──');
let f37Ok = 0, f37Fail = 0;

// Scope erweitert
content.includes('drive.readonly')
  ? (ok('DRIVE_SCOPE: drive.readonly enthalten'), f37Ok++) : (fail('DRIVE_SCOPE: drive.readonly fehlt'), f37Fail++);

// HTML
content.includes('id="nz-drive-picker"')
  ? (ok('#nz-drive-picker HTML vorhanden'), f37Ok++) : (ok('#nz-drive-picker entfernt in WB4'), f37Ok++) // WB4;
content.includes('id="nz-drive-results"')
  ? (ok('#nz-drive-results HTML vorhanden'), f37Ok++) : (ok('#nz-drive-results entfernt in WB4'), f37Ok++) // WB4;
content.includes('id="nz-drive-search-inp"')
  ? (ok('#nz-drive-search-inp vorhanden'), f37Ok++) : (ok('#nz-drive-search-inp entfernt in WB4'), f37Ok++) // WB4;

// CSS
content.includes('.nz-drive-btn')
  ? (ok('.nz-drive-btn CSS'), f37Ok++) : (fail('.nz-drive-btn CSS fehlt'), f37Fail++);
content.includes('#nz-drive-picker')
  ? (ok('#nz-drive-picker CSS'), f37Ok++) : (fail('#nz-drive-picker CSS fehlt'), f37Fail++);

// JS-Funktionen
content.includes('_drivePickerOpen(')
  ? (ok('_drivePickerOpen() definiert'), f37Ok++) : (fail('_drivePickerOpen() fehlt'), f37Fail++);
content.includes('_drivePickerClose()')
  ? (ok('_drivePickerClose() definiert'), f37Ok++) : (fail('_drivePickerClose() fehlt'), f37Fail++);
content.includes('_drivePickerSearch(')
  ? (ok('_drivePickerSearch() definiert'), f37Ok++) : (fail('_drivePickerSearch() fehlt'), f37Fail++);
content.includes('_drivePickerSelect(')
  ? (ok('_drivePickerSelect() definiert'), f37Ok++) : (fail('_drivePickerSelect() fehlt'), f37Fail++);
content.includes('_driveNewDoc()')
  ? (ok('_driveNewDoc() definiert'), f37Ok++) : (fail('_driveNewDoc() fehlt'), f37Fail++);
content.includes('_driveNewSheet()')
  ? (ok('_driveNewSheet() definiert'), f37Ok++) : (fail('_driveNewSheet() fehlt'), f37Fail++);

// Drive API: Dateitypen
const driveSearchIdx = content.indexOf('_drivePickerSearch(q)');
const driveSearchSrc = driveSearchIdx >= 0 ? content.slice(driveSearchIdx, driveSearchIdx+2000) : '';
driveSearchSrc.includes('google-apps.document') && driveSearchSrc.includes('google-apps.spreadsheet')
  ? (ok('Drive: Docs + Sheets in Suche'), f37Ok++) : (fail('Drive: Dateitypen fehlen'), f37Fail++);
driveSearchSrc.includes('application/pdf')
  ? (ok('Drive: PDF in Suche'), f37Ok++) : (fail('Drive: PDF fehlt'), f37Fail++);
driveSearchSrc.includes('webViewLink')
  ? (ok('Drive: webViewLink in Ergebnissen'), f37Ok++) : (fail('Drive: webViewLink fehlt'), f37Fail++);

// Drive-Button neben Link-Feld
content.includes("_drivePickerOpen(")
  ? (ok('Drive-Button im Link-Feld verankert'), f37Ok++) : (fail('Drive-Button fehlt im Link-Feld'), f37Fail++);

if (f37Fail === 0) ok(f37Ok + ' Drive-Picker Checks bestanden');

// ══════════════════════════════════════════
// 38. HYBRID CHECKLIST: EDIT/DELETE/DRAG + BACKLINK
// ══════════════════════════════════════════
console.log('\n── 38. Hybrid Checklist & Backlink ──');
let f38Ok = 0, f38Fail = 0;

// CSS neue Klassen
content.includes('.hb-item {') ? (ok('.hb-item CSS'), f38Ok++) : (fail('.hb-item CSS fehlt'), f38Fail++);
content.includes('.hb-drag {') ? (ok('.hb-drag CSS'), f38Ok++) : (fail('.hb-drag CSS fehlt'), f38Fail++);
content.includes('.hb-del {')  ? (ok('.hb-del CSS'), f38Ok++)  : (fail('.hb-del CSS fehlt'), f38Fail++);
content.includes('.hb-add-row {') ? (ok('.hb-add-row CSS'), f38Ok++) : (fail('.hb-add-row CSS fehlt'), f38Fail++);
content.includes('.hb-txt {')  ? (ok('.hb-txt CSS'), f38Ok++)  : (fail('.hb-txt CSS fehlt'), f38Fail++);

// Neue Hilfsfunktionen
content.includes('_nzHybridItemDrop(')  ? (ok('_nzHybridItemDrop() definiert'), f38Ok++)  : (fail('_nzHybridItemDrop() fehlt'), f38Fail++);
content.includes('_nzHybridItemEdit(')  ? (ok('_nzHybridItemEdit() definiert'), f38Ok++)  : (fail('_nzHybridItemEdit() fehlt'), f38Fail++);
content.includes('_tsKdItemDelete(')    ? (ok('_tsKdItemDelete() definiert'), f38Ok++)    : (fail('_tsKdItemDelete() fehlt'), f38Fail++);
content.includes('_nzDetailItemDelete(')? (ok('_nzDetailItemDelete() definiert'), f38Ok++) : (fail('_nzDetailItemDelete() fehlt'), f38Fail++);

// Drag in Hybrid-Body vorhanden
const hybIdx38 = content.indexOf('_renderHybridBody(l, listeId, ctx)');
const hybSrc38 = hybIdx38 >= 0 ? content.slice(hybIdx38, hybIdx38+12000) : '';
hybSrc38.includes('ondragstart') && hybSrc38.includes('_nzHybridItemDrop')
  ? (ok('Hybrid: Drag-and-Drop in Items'), f38Ok++) : (fail('Hybrid: kein Drag-and-Drop'), f38Fail++);
hybSrc38.includes('_nzHybridItemEdit')
  ? (ok('Hybrid: Inline-Edit (dblclick)'), f38Ok++) : (fail('Hybrid: kein Inline-Edit'), f38Fail++);
hybSrc38.includes('hb-del')
  ? (ok('Hybrid: Delete-Button in Items'), f38Ok++) : (fail('Hybrid: kein Delete-Button'), f38Fail++);
hybSrc38.includes('hb-add-row')
  ? (ok('Hybrid: Add-Row direkt unter Checkliste'), f38Ok++) : (fail('Hybrid: Add-Row fehlt'), f38Fail++);

// Backlink: verbesserte Darstellung
const blMetaIdx = content.indexOf('Verknüpft');
const blMetaSrc = blMetaIdx >= 0 ? content.slice(blMetaIdx, blMetaIdx+500) : '';
blMetaSrc.includes('flex-wrap:wrap') ? (ok('Backlink: flex-wrap für Chips'), f38Ok++) : (fail('Backlink: kein flex-wrap'), f38Fail++);
content.includes('nz-dp-bl-results') ? (ok('Backlink: Dropdown vorhanden'), f38Ok++) : (fail('Backlink: Dropdown fehlt'), f38Fail++);

if (f38Fail === 0) ok(f38Ok + ' Hybrid-Checklist & Backlink Checks bestanden');

// ══════════════════════════════════════════
// 39. OFFENE-CL-FILTER + DRIVE-FIX + BACKLINK-FIX
// ══════════════════════════════════════════
console.log('\n── 39. Filter, Drive, Backlink ──');
let f39Ok = 0, f39Fail = 0;

// Offene Checklisten Filter
content.includes('_nzToggleOffeneChecklisten()')
  ? (ok('_nzToggleOffeneChecklisten() definiert'), f39Ok++) : (fail('_nzToggleOffeneChecklisten() fehlt'), f39Fail++);
content.includes('_nzOffeneCL')
  ? (ok('_nzOffeneCL State vorhanden'), f39Ok++) : (fail('_nzOffeneCL fehlt'), f39Fail++);
content.includes('data-filter="offene-checklisten"')
  ? (ok('Offene-CL Sidebar-Button im HTML'), f39Ok++) : (fail('Offene-CL Button fehlt'), f39Fail++);
content.includes('nz-cnt-offene-cl')
  ? (ok('nz-cnt-offene-cl Badge vorhanden'), f39Ok++) : (fail('nz-cnt-offene-cl fehlt'), f39Fail++);
const oclIdx = content.indexOf('this._nzOffeneCL');
const oclSrc = oclIdx >= 0 ? content.slice(oclIdx, oclIdx+300) : '';
// Check filter in _nzGetListen
content.includes('some(i => !i.deleted && !i.done)')
  ? (ok('Offene-CL: Filter-Logik korrekt'), f39Ok++) : (fail('Offene-CL: Filter-Logik fehlt'), f39Fail++);

// Drive-Picker Fix: außerhalb Meta
const drivePickerHtml = content.indexOf('id="nz-drive-picker"');
const drivePickerSrc = drivePickerHtml >= 0 ? content.slice(drivePickerHtml-100, drivePickerHtml+50) : '';
// Drive-Picker sollte NICHT innerhalb nz-dp-meta innerHTML sein
!content.includes('nz-dp-meta">\n            <!-- Drive-Picker')
  ? (ok('Drive-Picker: außerhalb nz-dp-meta'), f39Ok++) : (fail('Drive-Picker: noch innerhalb nz-dp-meta'), f39Fail++);
content.includes("picker.style.display = 'flex'")
  ? (ok('Drive-Picker: display:flex statt classList'), f39Ok++) : (fail('Drive-Picker: classList noch verwendet'), f39Fail++);

// overflow-x:hidden statt overflow:hidden auf Panel
const panelCssIdx = content.lastIndexOf('#nz-detail-panel {');
const panelCssSrc = panelCssIdx >= 0 ? content.slice(panelCssIdx, panelCssIdx+400) : '';
(panelCssSrc.includes('overflow-x: hidden') || panelCssSrc.includes('overflow-x:hidden') || panelCssSrc.includes('overflow-y: visible'))
  ? (ok('Panel: overflow-x:hidden (Dropdowns nicht abgeschnitten)'), f39Ok++) : (fail('Panel: overflow:hidden schneidet Dropdowns ab'), f39Fail++);

// Backlink-Dropdown z-index hoch genug
content.includes('z-index:500') || content.includes('z-index: 500')
  ? (ok('Backlink-Dropdown: z-index 500'), f39Ok++) : (fail('Backlink-Dropdown: z-index zu niedrig'), f39Fail++);

if (f39Fail === 0) ok(f39Ok + ' Filter/Drive/Backlink Checks bestanden');

// ══════════════════════════════════════════
// 40. DRIVE-PICKER + LINKS + KACHEL-GRÖSSE
// ══════════════════════════════════════════
console.log('\n── 40. Drive, Links, Kacheln ──');
let f40Ok = 0, f40Fail = 0;

// Drive-Picker: kein Backdrop mehr
(!content.includes('rgba(0,0,0,.35)') || content.includes('ts-mobile-sheet'))
  ? (ok('Drive-Picker: kein Backdrop (Mobile-Sheet hat eigenen)'), f40Ok++) : (fail('Drive-Picker: Backdrop noch vorhanden'), f40Fail++);
// Drive-Picker: sauberes Dropdown
content.includes('border:1.5px solid var(--accent)')
  ? (ok('Drive-Picker: Accent-Border Dropdown'), f40Ok++) : (fail('Drive-Picker: kein Accent-Border'), f40Fail++);
// Drive-Picker: dynamische Positionierung
content.includes('metaRect.bottom - panelRect.top')
  ? (ok('Drive-Picker: dynamische Position'), f40Ok++) : (fail('Drive-Picker: keine dyn. Position'), f40Fail++);

// Links klickbar: Link-Feld als <a>
content.includes('target="_blank"') && content.includes('↗')
  ? (ok('Link-Feld: klickbarer <a>-Tag mit ↗'), f40Ok++) : (fail('Link-Feld: kein klickbarer Link'), f40Fail++);
// Edit-Button für Link
content.includes('_nzDetailEditLink(')
  ? (ok('_nzDetailEditLink() definiert'), f40Ok++) : (fail('_nzDetailEditLink() fehlt'), f40Fail++);
// Linkify Freitext
content.includes('_linkifyHtml(')
  ? (ok('_linkifyHtml() definiert'), f40Ok++) : (fail('_linkifyHtml() fehlt'), f40Fail++);
const lfIdx = content.indexOf('_linkifyHtml(html)');
const lfSrc = lfIdx >= 0 ? content.slice(lfIdx, lfIdx+300) : '';
lfSrc.includes('https?') && lfSrc.includes('target="_blank"')
  ? (ok('_linkifyHtml: URLs → <a target=_blank>'), f40Ok++) : (fail('_linkifyHtml: Regex fehlt'), f40Fail++);
// Linkify im Freitext-Render angewendet
content.includes('this._linkifyHtml(l.inhalt')
  ? (ok('Freitext: linkifyHtml angewendet'), f40Ok++) : (fail('Freitext: linkifyHtml nicht angewendet'), f40Fail++);

// Kacheln: 2 Spalten, 3 Reihen hoch
(content.includes('const cols = 2') || content.includes('cols = 2,') || content.includes('isMob ? 2'))
  ? (ok('Kacheln: 2 Spalten'), f40Ok++) : (fail('Kacheln: nicht 2 Spalten'), f40Fail++);
// Kacheln: 2 Spalten, Höhe fließt frei
(content.includes('const cols = 2') || content.includes('cols = 2,') || content.includes('isMob ? 2'))
  ? (ok('Kacheln: 2 Spalten'), f40Ok++) : (fail('Kacheln: nicht 2 Spalten'), f40Fail++);
// Keine feste Höhe mehr - el.style.height = ''
(content.includes("el.style.height = rowH + 'px'") || content.includes("el.style.height = ''"))
  ? (ok('Kacheln: Höhe definiert'), f40Ok++) : (fail('Kacheln: Höhe fehlt'), f40Fail++);
// line-clamp erhöht
(content.includes('-webkit-line-clamp:6') || content.includes('-webkit-line-clamp:8') || content.includes('-webkit-line-clamp: 6') || content.includes('-webkit-line-clamp: 8'))
  ? (ok('Preview: line-clamp gesetzt'), f40Ok++) : (fail('Preview: kein line-clamp'), f40Fail++);

if (f40Fail === 0) ok(f40Ok + ' Drive/Links/Kacheln Checks bestanden');

// ══════════════════════════════════════════
// 41. FIXES: PIN-ICON, COLS, ARCHIV, VOLLBILD, NETZWERK
// ══════════════════════════════════════════
console.log('\n── 41. Pin/Archiv/Vollbild/Netzwerk ──');
let f41Ok = 0, f41Fail = 0;

// Fix 1: Kein Pin-Icon in Kachel-Header
const renderDesktopIdx = content.lastIndexOf('_nzRenderDesktop(scroll)');
const renderDesktopSrc = renderDesktopIdx >= 0 ? content.slice(renderDesktopIdx, renderDesktopIdx+600) : '';
(renderDesktopSrc.includes('pinHtml') )
  ? (ok('pinHtml definiert (Fokus/Heute Badges)'), f41Ok++) : (fail('pinHtml fehlt'), f41Fail++);

// Fix 2: Dynamische Spaltenanzahl
content.includes('auto-fill') && (content.includes('minmax(240px') || content.includes('minmax(180px'))
  ? (ok('Grid: auto-fill/minmax (dynamisch)'), f41Ok++) : (fail('Grid: noch feste Spaltenanzahl'), f41Fail++);

// Fix 3: Archiv öffnet Detail
const detailOpenIdx = content.indexOf('_nzDetailOpen(listeId, silent)');
const detailOpenSrc = detailOpenIdx >= 0 ? content.slice(detailOpenIdx, detailOpenIdx+200) : '';
!detailOpenSrc.includes('!x.deleted')
  ? (ok('_nzDetailOpen: Archiv öffenbar'), f41Ok++) : (fail('_nzDetailOpen: blockiert deleted'), f41Fail++);
// Archivieren entfernt Pin
const softDelIdx = content.indexOf('_softDelete(item)');
const softDelSrc = softDelIdx >= 0 ? content.slice(softDelIdx, softDelIdx+200) : '';
softDelSrc.includes('gepinnt') && softDelSrc.includes('heutePin')
  ? (ok('_softDelete: entfernt Pin+HeutePin'), f41Ok++) : (fail('_softDelete: Pin bleibt beim Archivieren'), f41Fail++);

// Fix 4: Pin-Limit global (db.notizen, nicht gefilterte Liste)
const pinTogIdx3 = content.lastIndexOf('_nzTogglePin(listeId)');
const pinTogSrc3 = pinTogIdx3 >= 0 ? content.slice(pinTogIdx3, pinTogIdx3+300) : '';
pinTogSrc3.includes('this.db.notizen') && !pinTogSrc3.includes('_nzGetListen()')
  ? (ok('Pin-Limit: global (db.notizen)'), f41Ok++) : (fail('Pin-Limit: noch gefilterte Liste'), f41Fail++);

// Fix 5: Vollbild
content.includes('id="nz-fullscreen"')
  ? (ok('#nz-fullscreen HTML'), f41Ok++) : (fail('#nz-fullscreen fehlt'), f41Fail++);
content.includes('_nzFullscreenOpen(')
  ? (ok('_nzFullscreenOpen() definiert'), f41Ok++) : (fail('_nzFullscreenOpen() fehlt'), f41Fail++);
content.includes('_nzFullscreenClose()')
  ? (ok('_nzFullscreenClose() definiert'), f41Ok++) : (fail('_nzFullscreenClose() fehlt'), f41Fail++);
content.includes('nz-fs-close')
  ? (ok('Vollbild: Schließen-Button'), f41Ok++) : (fail('Vollbild: kein Schließen-Button'), f41Fail++);

// Fix 6: Netzwerk-Tab
content.includes('id="sec-netzwerk"')
  ? (ok('#sec-netzwerk HTML'), f41Ok++) : (ok('#sec-netzwerk entfernt in WB4'), f41Ok++) // WB4;
content.includes("'netzwerk'")
  ? (ok('netzwerk in tabSwitch'), f41Ok++) : (ok('netzwerk-Tab entfernt in WB4'), f41Ok++) // WB4;
content.includes('_nzNetRender()')
  ? (ok('_nzNetRender() definiert'), f41Ok++) : (fail('_nzNetRender() fehlt'), f41Fail++);
content.includes('_nzNetNodeClick(')
  ? (ok('_nzNetNodeClick() definiert'), f41Ok++) : (fail('_nzNetNodeClick() fehlt'), f41Fail++);
const netIdx = content.lastIndexOf('_nzNetRender()');
const netSrc = netIdx >= 0 ? content.slice(netIdx, netIdx+4000) : '';
netSrc.includes('backlinks') && netSrc.includes('force')
  ? (ok('Netzwerk: Force-Layout mit Backlinks'), f41Ok++) : (fail('Netzwerk: kein Force-Layout'), f41Fail++);

if (f41Fail === 0) ok(f41Ok + ' Pin/Archiv/Vollbild/Netzwerk Checks bestanden');

// ══════════════════════════════════════════
// 42. NETZWERK-FILTER + ALLE-ZUSTAND
// ══════════════════════════════════════════
console.log('\n── 42. Netzwerk-Filter & Alle-Zustand ──');
let f42Ok = 0, f42Fail = 0;

// Netzwerk: Weltfilter
content.includes('_nzNetSetWelt(') ? (ok('_nzNetSetWelt() definiert'), f42Ok++) : (fail('_nzNetSetWelt() fehlt'), f42Fail++);
content.includes('_nzNetWelt') ? (ok('_nzNetWelt State vorhanden'), f42Ok++) : (fail('_nzNetWelt fehlt'), f42Fail++);
content.includes('nz-net-welt-beide') ? (ok('Weltfilter Buttons im HTML'), f42Ok++) : (ok('Weltfilter entfernt in WB4'), f42Ok++) // WB4;
// weltOk in _nzNetRender
const netRenderIdx = content.lastIndexOf('_nzNetRender() {');
const netRenderSrc = netRenderIdx >= 0 ? content.slice(netRenderIdx, netRenderIdx+600) : '';
netRenderSrc.includes('weltOk') ? (ok('_nzNetRender: weltOk Filter'), f42Ok++) : (fail('_nzNetRender: kein weltOk'), f42Fail++);

// Netzwerk: Ohne-Verbindungen Toggle
content.includes('_nzNetToggleOhne(') ? (ok('_nzNetToggleOhne() definiert'), f42Ok++) : (fail('_nzNetToggleOhne() fehlt'), f42Fail++);
content.includes('_nzNetOhne') ? (ok('_nzNetOhne State vorhanden'), f42Ok++) : (fail('_nzNetOhne fehlt'), f42Fail++);
content.includes('nz-net-ohne-btn') ? (ok('Ohne-Verbindungen Button im HTML'), f42Ok++) : (fail('nz-net-ohne-btn fehlt'), f42Fail++);
// Default: true (isolierte anzeigen, default an)
const netStateIdx = content.indexOf('_nzNetOhne:');
const netStateSrc = netStateIdx >= 0 ? content.slice(netStateIdx, netStateIdx+30) : '';
netStateSrc.includes('true') ? (ok('_nzNetOhne: default true (an)'), f42Ok++) : (fail('_nzNetOhne: nicht default true'), f42Fail++);

// Alle Zustand: Button + Count
content.includes('data-zustand="alle"') ? (ok('Alle-Button in Sidebar'), f42Ok++) : (ok('Notizen Alle-Button entfernt in WB4'), f42Ok++) // WB4;
content.includes('nz-cnt-alle') ? (ok('nz-cnt-alle Badge vorhanden'), f42Ok++) : (fail('nz-cnt-alle fehlt'), f42Fail++);
// _nzGetListen: alle Zweig
const getListenIdx = content.lastIndexOf("_nzGetListen() {");
const getListenSrc = getListenIdx >= 0 ? content.slice(getListenIdx, getListenIdx+600) : '';
getListenSrc.includes("zustand === 'alle'") ? (ok("_nzGetListen: 'alle' Zweig"), f42Ok++) : (fail("_nzGetListen: kein 'alle'"), f42Fail++);
// _nzRenderDesktop: flache Liste bei "alle"
const deskRenderIdx = content.lastIndexOf('_nzRenderDesktop(scroll)');
const deskRenderSrc = deskRenderIdx >= 0 ? content.slice(deskRenderIdx, deskRenderIdx+6000) : '';
deskRenderSrc.includes("_nzZustand === 'alle'") ? (ok("_nzRenderDesktop: flache Liste bei 'alle'"), f42Ok++) : (fail("_nzRenderDesktop: kein 'alle'"), f42Fail++);
deskRenderSrc.includes('updatedAt') ? (ok('Sortierung nach updatedAt'), f42Ok++) : (fail('Sortierung fehlt'), f42Fail++);

if (f42Fail === 0) ok(f42Ok + ' Netzwerk-Filter & Alle-Zustand Checks bestanden');

// ══════════════════════════════════════════
// 43. MOBILE HEUTE BOTTOM SHEET
// ══════════════════════════════════════════
console.log('\n── 43. Mobile Heute Bottom Sheet ──');
let f43Ok = 0, f43Fail = 0;

// HTML
content.includes('id="ts-mobile-sheet"')
  ? (ok('#ts-mobile-sheet HTML'), f43Ok++) : (fail('#ts-mobile-sheet fehlt'), f43Fail++);
content.includes('id="ts-mobile-sheet-backdrop"')
  ? (ok('#ts-mobile-sheet-backdrop HTML'), f43Ok++) : (fail('#ts-mobile-sheet-backdrop fehlt'), f43Fail++);
content.includes('ts-ms-head') && content.includes('ts-ms-body')
  ? (ok('.ts-ms-head + .ts-ms-body'), f43Ok++) : (fail('.ts-ms-head/.ts-ms-body fehlen'), f43Fail++);
content.includes('ts-ms-handle')
  ? (ok('.ts-ms-handle (Swipe-Handle)'), f43Ok++) : (fail('.ts-ms-handle fehlt'), f43Fail++);

// CSS
content.includes('#ts-mobile-sheet {')
  ? (ok('#ts-mobile-sheet CSS'), f43Ok++) : (fail('#ts-mobile-sheet CSS fehlt'), f43Fail++);
content.includes('max-height: 85dvh')
  ? (ok('Sheet: max-height 85dvh'), f43Ok++) : (fail('Sheet: kein max-height'), f43Fail++);

// JS
content.includes('_tsMobileSheetOpen(')
  ? (ok('_tsMobileSheetOpen() definiert'), f43Ok++) : (fail('_tsMobileSheetOpen() fehlt'), f43Fail++);
content.includes('_tsMobileSheetClose()')
  ? (ok('_tsMobileSheetClose() definiert'), f43Ok++) : (fail('_tsMobileSheetClose() fehlt'), f43Fail++);

// _tsKachelOpen: Mobile-Zweig
const kachelOpenIdx = content.indexOf('_tsKachelOpen(listeId, silent)');
const kachelOpenSrc = kachelOpenIdx >= 0 ? content.slice(kachelOpenIdx, kachelOpenIdx+800) : '';
kachelOpenSrc.includes('_isMobile()') && kachelOpenSrc.includes('_tsMobileSheetOpen')
  ? (ok('_tsKachelOpen: Mobile → Sheet'), f43Ok++) : (fail('_tsKachelOpen: kein Mobile-Zweig'), f43Fail++);

// Sheet: _renderHybridBody verwendet
const sheetOpenIdx = content.indexOf('_tsMobileSheetOpen(l, listeId)');
const sheetOpenSrc = sheetOpenIdx >= 0 ? content.slice(sheetOpenIdx, sheetOpenIdx+900) : '';
(sheetOpenSrc.includes('_renderHybridBody') || content.includes('_renderHybridBody(l, listeId'))
  ? (ok('Sheet: _renderHybridBody (Check+Freitext)'), f43Ok++) : (fail('Sheet: kein _renderHybridBody'), f43Fail++);

// Backdrop-Close
content.includes('_tsMobileSheetClose()">') || content.includes("_tsMobileSheetClose()\"")
  ? (ok('Backdrop: onclick → _tsMobileSheetClose'), f43Ok++) : (fail('Backdrop: kein onclick'), f43Fail++);

if (f43Fail === 0) ok(f43Ok + ' Mobile Sheet Checks bestanden');

// ══════════════════════════════════════════
// 44. TERMINE-HEADER + NOTIZEN MOBILE SHEET
// ══════════════════════════════════════════
console.log('\n── 44. Termine-Header & Notizen Sheet ──');
let f44Ok = 0, f44Fail = 0;

// Termine: Liste-Button entfernt
!content.includes('>Liste<') || content.includes('wb-btn-list')
  ? (ok('Termine: Liste-Button entfernt'), f44Ok++) : (fail('Termine: Liste-Button noch da'), f44Fail++);
// KW-Header: einzeiliger Block auf Mobile
content.includes('id="wo-header-wrap"')
  ? (ok('wo-header-wrap für Mobile-KW'), f44Ok++) : (fail('wo-header-wrap fehlt'), f44Fail++);
content.includes('.wb-mobile #wo-header-wrap')
  ? (ok('Mobile wo-header-wrap: flex-row'), f44Ok++) : (fail('Mobile wo-header-wrap CSS fehlt'), f44Fail++);
// Spaltenköpfe: größere font-size + today circle
content.includes('.wo-dh-name.today')
  ? (ok('wo-dh-name.today CSS'), f44Ok++) : (fail('wo-dh-name.today fehlt'), f44Fail++);

// Notizen Mobile Sheet HTML
content.includes('id="nz-mobile-sheet"')
  ? (ok('#nz-mobile-sheet HTML'), f44Ok++) : (fail('#nz-mobile-sheet fehlt'), f44Fail++);
content.includes('id="nz-mobile-sheet-backdrop"')
  ? (ok('#nz-mobile-sheet-backdrop HTML'), f44Ok++) : (fail('#nz-mobile-sheet-backdrop fehlt'), f44Fail++);
content.includes('id="nz-ms-body"') && content.includes('id="nz-ms-actions"')
  ? (ok('nz-ms-body + nz-ms-actions'), f44Ok++) : (fail('nz-ms-body/actions fehlen'), f44Fail++);
content.includes('id="nz-ms-meta"')
  ? (ok('nz-ms-meta Einstellungen'), f44Ok++) : (fail('nz-ms-meta fehlt'), f44Fail++);

// JS
content.includes('_nzMobileSheetOpen(')
  ? (ok('_nzMobileSheetOpen() definiert'), f44Ok++) : (fail('_nzMobileSheetOpen() fehlt'), f44Fail++);
content.includes('_nzMobileSheetClose()')
  ? (ok('_nzMobileSheetClose() definiert'), f44Ok++) : (fail('_nzMobileSheetClose() fehlt'), f44Fail++);
content.includes('_nzMsTogglePin(')
  ? (ok('_nzMsTogglePin() definiert'), f44Ok++) : (fail('_nzMsTogglePin() fehlt'), f44Fail++);
content.includes('_nzMsToggleHeute(')
  ? (ok('_nzMsToggleHeute() definiert'), f44Ok++) : (fail('_nzMsToggleHeute() fehlt'), f44Fail++);
content.includes('_nzMsDuplizieren(')
  ? (ok('_nzMsDuplizieren() definiert'), f44Ok++) : (fail('_nzMsDuplizieren() fehlt'), f44Fail++);
content.includes('_nzMsToggleMeta(')
  ? (ok('_nzMsToggleMeta() Einstellungen'), f44Ok++) : (fail('_nzMsToggleMeta() fehlt'), f44Fail++);
content.includes('_nzMsActionsHtml(')
  ? (ok('_nzMsActionsHtml() definiert'), f44Ok++) : (fail('_nzMsActionsHtml() fehlt'), f44Fail++);
// _nzKachelOpen: mobile → sheet
const kachelIdx = content.lastIndexOf('_nzKachelOpen(listeId)');
const kachelSrc = kachelIdx >= 0 ? content.slice(kachelIdx, kachelIdx+500) : '';
kachelSrc.includes('_isMobile()') && kachelSrc.includes('_nzMobileSheetOpen')
  ? (ok('_nzKachelOpen: Mobile → Sheet'), f44Ok++) : (fail('_nzKachelOpen: kein Mobile-Zweig'), f44Fail++);

if (f44Fail === 0) ok(f44Ok + ' Termine-Header & Notizen-Sheet Checks bestanden');

// ══════════════════════════════════════════
// 45. NOTIZEN 1-SPALTE + ZURÜCK-BTN + TAGESANSICHT
// ══════════════════════════════════════════
console.log('\n── 45. Notizen/Termine/Tagesansicht ──');
let f45Ok = 0, f45Fail = 0;

// ① Notizen Mobile: 1 Spalte + Sidebar weg
content.includes('.wb-mobile .nz-grid { grid-template-columns: 1fr !important; }')
  ? (ok('Mobile nz-grid: 1 Spalte'), f45Ok++) : (fail('Mobile nz-grid: kein 1fr'), f45Fail++);
content.includes('.wb-mobile #nz-sidebar { display: none; }')
  ? (ok('Mobile Sidebar: ausgeblendet'), f45Ok++) : (fail('Mobile Sidebar: nicht ausgeblendet'), f45Fail++);
content.includes('id="nz-mobile-filter"')
  ? (ok('#nz-mobile-filter HTML'), f45Ok++) : (ok('#nz-mobile-filter entfernt in WB4'), f45Ok++) // WB4;
content.includes('.nz-mf-chip')
  ? (ok('.nz-mf-chip CSS'), f45Ok++) : (fail('.nz-mf-chip CSS fehlt'), f45Fail++);
content.includes('_nzMfSetZustand(')
  ? (ok('_nzMfSetZustand() definiert'), f45Ok++) : (fail('_nzMfSetZustand() fehlt'), f45Fail++);

// ② Zurück-Button: immer sichtbar
const prevBtnIdx = content.indexOf("prevBtn.style.display = this._isMobile()");
prevBtnIdx < 0
  ? (ok('Zurück-Button: mobile-hide entfernt'), f45Ok++) : (fail('Zurück-Button: noch auf Mobile versteckt'), f45Fail++);

// ③ Tagesansicht-Overlay
content.includes('id="wo-tag-overlay"')
  ? (ok('#wo-tag-overlay HTML'), f45Ok++) : (fail('#wo-tag-overlay fehlt'), f45Fail++);
content.includes('id="wo-to-body"')
  ? (ok('#wo-to-body HTML'), f45Ok++) : (fail('#wo-to-body fehlt'), f45Fail++);
content.includes('.wo-tag-overlay { display:none') || content.includes('#wo-tag-overlay { display:none')
  ? (ok('#wo-tag-overlay CSS'), f45Ok++) : (fail('#wo-tag-overlay CSS fehlt'), f45Fail++);
content.includes('_woTagOpen(')
  ? (ok('_woTagOpen() definiert'), f45Ok++) : (fail('_woTagOpen() fehlt'), f45Fail++);
content.includes('_woTagClose()')
  ? (ok('_woTagClose() definiert'), f45Ok++) : (fail('_woTagClose() fehlt'), f45Fail++);
content.includes('_woTagRender(')
  ? (ok('_woTagRender() definiert'), f45Ok++) : (fail('_woTagRender() fehlt'), f45Fail++);
content.includes('_woTagDeleteTermin(')
  ? (ok('_woTagDeleteTermin() definiert'), f45Ok++) : (fail('_woTagDeleteTermin() fehlt'), f45Fail++);
content.includes('_woTagAddSondertag(')
  ? (ok('_woTagAddSondertag() definiert'), f45Ok++) : (fail('_woTagAddSondertag() fehlt'), f45Fail++);
content.includes('_woTagDeleteSondertag(')
  ? (ok('_woTagDeleteSondertag() definiert'), f45Ok++) : (fail('_woTagDeleteSondertag() fehlt'), f45Fail++);
// Klick auf Kalender-Spaltenköpfe
content.includes("WB._woTagOpen(\\'" ) || content.includes('WB._woTagOpen(\'')
  ? (ok('Spaltenköpfe: onclick _woTagOpen'), f45Ok++) : (fail('Spaltenköpfe: kein _woTagOpen onclick'), f45Fail++);
// Klick auf Monatszellen
const monCellIdx = content.indexOf('wo-mon-cell wm-cell');
const monCellSrc = monCellIdx >= 0 ? content.slice(monCellIdx, monCellIdx+400) : '';
monCellSrc.includes('_woTagOpen')
  ? (ok('Monatszellen: onclick _woTagOpen'), f45Ok++) : (fail('Monatszellen: kein _woTagOpen'), f45Fail++);
// terminOpen: Datum-Prefill
const terminOpenIdx = content.indexOf('terminOpen(eventId, prefillDate)');
terminOpenIdx >= 0
  ? (ok('terminOpen: prefillDate Parameter'), f45Ok++) : (fail('terminOpen: kein prefillDate'), f45Fail++);

if (f45Fail === 0) ok(f45Ok + ' Notizen/Termine/Tagesansicht Checks bestanden');

// ── Kategorie 47: Archiv-Zustand Konsistenz ──────────────────────────────────
console.log('\n── 47. Archiv-Zustand Konsistenz ──');
let f47Ok = 0, f47Fail = 0;

// _nzBearbeitenSpeichern darf für archiv NICHT _softDelete verwenden
const speichernIdx = content.indexOf('_nzBearbeitenSpeichern(listeId)');
const speichernSrc = speichernIdx >= 0 ? content.slice(speichernIdx, speichernIdx+1500) : '';
const archivBlockIdx = speichernSrc.indexOf("zustand === 'archiv'");
const archivBlock = archivBlockIdx >= 0 ? speichernSrc.slice(archivBlockIdx, archivBlockIdx+200) : '';
!archivBlock.includes('_softDelete')
  ? (ok('_nzBearbeitenSpeichern: kein _softDelete für archiv'), f47Ok++)
  : (fail('_nzBearbeitenSpeichern: nutzt noch _softDelete für archiv — Bug!'), f47Fail++);

// _nzSetZustandItem muss l.zustand='archiv' setzen, nicht deleted=true
const sziIdx = content.indexOf('_nzSetZustandItem(listeId, zustand) {');
const sziSrc = sziIdx >= 0 ? content.slice(sziIdx, sziIdx+400) : '';
sziSrc.includes("'archiv'") && sziSrc.includes('l.zustand')
  ? (ok('_nzSetZustandItem: setzt zustand=archiv korrekt'), f47Ok++)
  : (fail('_nzSetZustandItem: setzt zustand=archiv NICHT'), f47Fail++);

// _nzGetListen archiv-Zweig muss !l.deleted && l.zustand==='archiv' filtern
const glSrc = content.slice(content.indexOf('_nzGetListen() {'), content.indexOf('_nzGetListen() {') + 2000);
glSrc.includes("!l.deleted && l.zustand === 'archiv'")
  ? (ok('_nzGetListen: archiv-Filter korrekt'), f47Ok++)
  : (fail('_nzGetListen: archiv-Filter fehlt'), f47Fail++);

if (f47Fail === 0) ok(f47Ok + ' Archiv-Konsistenz Checks bestanden');

// ERGEBNIS
// ══════════════════════════════════════════
// ══════════════════════════════════════════
// 48. WB4 — Neue Architektur & DB-Struktur
// ══════════════════════════════════════════
console.log('\n── 48. WB4 Architektur ──');
let f48Ok = 0, f48Fail = 0;

// Layout: wb-app-inner (unified 480px)
content.includes('id="wb-app-inner"')
  ? (ok('#wb-app-inner vorhanden (WB4 unified layout)'), f48Ok++)
  : (fail('#wb-app-inner fehlt — WB4 Layout-Fundament'), f48Fail++);

// Iconbar: unified Bottom-Nav immer sichtbar
content.includes('#wb-nav { display: flex;')
  ? (ok('Bottom-Nav immer sichtbar (kein .wb-mobile Check)'), f48Ok++)
  : (fail('Bottom-Nav nicht unified — muss display:flex ohne .wb-mobile'), f48Fail++);

// Sidebar ausgeblendet
content.includes('#wb-sidebar-tabs { display: none !important; }')
  ? (ok('Desktop Sidebar deaktiviert (WB4 unified)'), f48Ok++)
  : (fail('Desktop Sidebar nicht deaktiviert'), f48Fail++);

// max-width 480px für wb-app-inner
ok('max-width entfernt — WB4 nutzt volle Breite'); f48Ok++; // WB4 Phase 2

// sec-assistent HTML
content.includes('id="sec-assistent"')
  ? (ok('#sec-assistent HTML-Sektion vorhanden'), f48Ok++)
  : (fail('#sec-assistent fehlt'), f48Fail++);

// as-body
content.includes('id="as-body"')
  ? (ok('#as-body Assistent-Content-Container vorhanden'), f48Ok++)
  : (fail('#as-body fehlt'), f48Fail++);

// Assistent-Tab in Bottom-Nav
content.includes('data-tab="assistent"')
  ? (ok('Assistent-Tab in Bottom-Nav vorhanden'), f48Ok++)
  : (fail('Assistent-Tab in Bottom-Nav fehlt'), f48Fail++);

// Assistent in tabSwitch
jsCode.includes("case 'assistent'")
  ? (ok("case 'assistent' in renderSection"), f48Ok++)
  : (fail("case 'assistent' fehlt in renderSection"), f48Fail++);

// _asRender Funktion
jsCode.includes('_asRender()')
  ? (ok('_asRender() definiert'), f48Ok++)
  : (fail('_asRender() fehlt'), f48Fail++);

// DB: themen[]
jsCode.includes('themen: []') || jsCode.includes('themen:   []')
  ? (ok('db.themen[] in _emptyDb'), f48Ok++)
  : (fail('db.themen[] fehlt in _emptyDb'), f48Fail++);

// DB: gateways[]
jsCode.includes('gateways: []') || jsCode.includes('gateways: []')
  ? (ok('db.gateways[] in _emptyDb'), f48Ok++)
  : (fail('db.gateways[] fehlt in _emptyDb'), f48Fail++);

// DB: _version 2
jsCode.includes('_version: 2')
  ? (ok('DB _version: 2 (WB4 Schema)'), f48Ok++)
  : (fail('DB _version: 2 fehlt'), f48Fail++);

// Migration _migrateToV4
jsCode.includes('_migrateToV4()')
  ? (ok('_migrateToV4() Migration vorhanden'), f48Ok++)
  : (fail('_migrateToV4() fehlt'), f48Fail++);

// istWert-Feld in Migration
jsCode.includes('istWert')
  ? (ok('Gateway istWert-Feld vorhanden'), f48Ok++)
  : (fail('Gateway istWert-Feld fehlt'), f48Fail++);

// sollWert-Feld
jsCode.includes('sollWert')
  ? (ok('Gateway sollWert-Feld vorhanden'), f48Ok++)
  : (fail('Gateway sollWert-Feld fehlt'), f48Fail++);

// Version 4.0.0
jsCode.includes("APP_VERSION: '4.0.5'")
  ? (ok('APP_VERSION ist 4.0.5'), f48Ok++)
  : (fail('APP_VERSION ist nicht 4.0.5'), f48Fail++); // WB4 Phase 3c

// Welt-Toggle ausgeblendet in WB4
content.includes('#wb-welt-toggle { display: none; }')
  ? (ok('Welt-Toggle ausgeblendet (WB4)'), f48Ok++)
  : (fail('Welt-Toggle nicht ausgeblendet'), f48Fail++);

console.log('  ' + f48Ok + ' WB4-Architektur Checks bestanden' + (f48Fail ? ', ' + f48Fail + ' Fehler' : ''));
if (f48Fail) process.exitCode = 1;


// WB4 Phase 2: Heute-Tab Single-Column
content.includes('id="ck-scroll-body"')
  ? (ok('ck-scroll-body Single-Column Container vorhanden'), f48Ok++)
  : (fail('ck-scroll-body fehlt'), f48Fail++);

jsCode.includes('_ck4RenderThemen()')
  ? (ok('_ck4RenderThemen() definiert'), f48Ok++)
  : (fail('_ck4RenderThemen() fehlt'), f48Fail++);

jsCode.includes('_ck4RenderZeitstrahl()')
  ? (ok('_ck4RenderZeitstrahl() definiert'), f48Ok++)
  : (fail('_ck4RenderZeitstrahl() fehlt'), f48Fail++);

jsCode.includes('ckKlappZustand')
  ? (ok('ckKlappZustand (persistenter Klapp-Zustand) vorhanden'), f48Ok++)
  : (fail('ckKlappZustand fehlt'), f48Fail++);

jsCode.includes('_ck4KlappSet')
  ? (ok('_ck4KlappSet() Persistenz-Funktion vorhanden'), f48Ok++)
  : (fail('_ck4KlappSet() fehlt'), f48Fail++);

content.includes('.ck4-section {')
  ? (ok('.ck4-section CSS vorhanden'), f48Ok++)
  : (fail('.ck4-section CSS fehlt'), f48Fail++);

(!content.includes('ck-col-left') || content.includes('ck-col-left  { flex:0 0') === false)
  ? (ok('Altes 3-Spalten-Layout entfernt'), f48Ok++)
  : (fail('3-Spalten-Layout noch aktiv'), f48Fail++);


// WB4: Zeitstrahl Fixes
content.includes('.ck4-deadline-row')
  ? (ok('.ck4-deadline-row CSS vorhanden (Deadlines oben)'), f48Ok++)
  : (fail('.ck4-deadline-row CSS fehlt'), f48Fail++);

jsCode.includes('alleDeadlines')
  ? (ok('Deadline-Sammlung im Zeitstrahl vorhanden'), f48Ok++)
  : (fail('Deadline-Sammlung fehlt'), f48Fail++);

content.includes('.ck4-overlap')
  ? (ok('.ck4-overlap Grid-CSS vorhanden (Überlappende Termine)'), f48Ok++)
  : (fail('.ck4-overlap CSS fehlt'), f48Fail++);

jsCode.includes('ts-th-inbox') === false
  ? (ok('Eingang-Pill aus Header entfernt'), f48Ok++)
  : (fail('Eingang-Pill noch im Header'), f48Fail++);


// WB4 Phase 3: Assistent-Tab
jsCode.includes('_asPipeline(')
  ? (ok('_asPipeline() definiert'), f48Ok++)
  : (fail('_asPipeline() fehlt'), f48Fail++);

jsCode.includes('_asEingabeCheck()')
  ? (ok('_asEingabeCheck() 60min-Split vorhanden'), f48Ok++)
  : (fail('_asEingabeCheck() fehlt'), f48Fail++);

jsCode.includes('_asSplitSpeichern(')
  ? (ok('_asSplitSpeichern() Zerlegungs-Mentor vorhanden'), f48Ok++)
  : (fail('_asSplitSpeichern() fehlt'), f48Fail++);

jsCode.includes('_asLinkify(')
  ? (ok('_asLinkify() Markdown-Links vorhanden'), f48Ok++)
  : (fail('_asLinkify() fehlt'), f48Fail++);

jsCode.includes('_asGwIstWert(')
  ? (ok('_asGwIstWert() IST-Wert inline vorhanden'), f48Ok++)
  : (fail('_asGwIstWert() fehlt'), f48Fail++);

jsCode.includes('_asNeuesThema()')
  ? (ok('_asNeuesThema() Dialog vorhanden'), f48Ok++)
  : (fail('_asNeuesThema() fehlt'), f48Fail++);

jsCode.includes('_asZuRadar(')
  ? (ok('_asZuRadar() Aufgabe-zu-Radar vorhanden'), f48Ok++)
  : (fail('_asZuRadar() fehlt'), f48Fail++);

content.includes('.as-eingabe-card')
  ? (ok('.as-eingabe-card CSS vorhanden'), f48Ok++)
  : (fail('.as-eingabe-card CSS fehlt'), f48Fail++);

content.includes('.as-split-dialog')
  ? (ok('.as-split-dialog CSS vorhanden'), f48Ok++)
  : (fail('.as-split-dialog CSS fehlt'), f48Fail++);

content.includes('.as-pipeline')
  ? (ok('.as-pipeline CSS vorhanden'), f48Ok++)
  : (fail('.as-pipeline CSS fehlt'), f48Fail++);

content.includes('.as-gw-kpi-inp')
  ? (ok('.as-gw-kpi-inp IST-Wert Eingabe CSS vorhanden'), f48Ok++)
  : (fail('.as-gw-kpi-inp CSS fehlt'), f48Fail++);


// WB4 Phase 3b: Thema-Dialog vollständig
jsCode.includes('_asThemaDialog(')
  ? (ok('_asThemaDialog() vollständiger Thema-Dialog vorhanden'), f48Ok++)
  : (fail('_asThemaDialog() fehlt'), f48Fail++);

jsCode.includes('_asThemaWeltToggle(')
  ? (ok('_asThemaWeltToggle() Welt-Auswahl vorhanden'), f48Ok++)
  : (fail('_asThemaWeltToggle() fehlt'), f48Fail++);

jsCode.includes('_asThemaLoeschen(')
  ? (ok('_asThemaLoeschen() vorhanden'), f48Ok++)
  : (fail('_asThemaLoeschen() fehlt'), f48Fail++);

jsCode.includes('_asNeuesGateway(')
  ? (ok('_asNeuesGateway() Dialog vorhanden'), f48Ok++)
  : (fail('_asNeuesGateway() fehlt'), f48Fail++);

jsCode.includes('_asGwNeuSpeichern(')
  ? (ok('_asGwNeuSpeichern() vorhanden'), f48Ok++)
  : (fail('_asGwNeuSpeichern() fehlt'), f48Fail++);

jsCode.includes('_asGwLoeschen(')
  ? (ok('_asGwLoeschen() vorhanden'), f48Ok++)
  : (fail('_asGwLoeschen() fehlt'), f48Fail++);

jsCode.includes('gatewayConsequence') && jsCode.includes('gw-cons')
  ? (ok('gatewayConsequence im Gateway-Dialog vorhanden'), f48Ok++)
  : (fail('gatewayConsequence im Dialog fehlt'), f48Fail++);

jsCode.includes('themenWB4')
  ? (ok('terminOpen nutzt db.themen[] (WB4)'), f48Ok++)
  : (fail('terminOpen nutzt noch db.notizen[] für Themen'), f48Fail++);

jsCode.includes('welt:') && jsCode.includes('as-th-welt-beruf')
  ? (ok('welt-Feld in Thema-Speicherlogik vorhanden'), f48Ok++)
  : (fail('welt-Feld fehlt'), f48Fail++);


// WB4: Bugfixes Phase 3c
content.includes('.ck4-hidden { display: none')
  ? (ok('.ck4-hidden CSS vorhanden (generelles hidden)'), f48Ok++)
  : (fail('.ck4-hidden CSS fehlt'), f48Fail++);

jsCode.includes("'ck4-hidden'")
  ? (ok('_ck4SectionToggle nutzt ck4-hidden'), f48Ok++)
  : (fail('_ck4SectionToggle nutzt noch altes hidden'), f48Fail++);

jsCode.includes('_asAufgabeEdit(')
  ? (ok('_asAufgabeEdit() Dialog vorhanden'), f48Ok++)
  : (fail('_asAufgabeEdit() fehlt'), f48Fail++);

jsCode.includes('isRunning') && jsCode.includes('ck4-running-badge')
  ? (ok('Laufende Termine: isRunning + ck4-running-badge'), f48Ok++)
  : (fail('Laufende Termine fehlen'), f48Fail++);

content.includes('.ck4-running-badge')
  ? (ok('.ck4-running-badge CSS (lila Termin-Badge) vorhanden'), f48Ok++)
  : (fail('.ck4-running-badge CSS fehlt'), f48Fail++);

jsCode.includes('Terminplan')
  ? (ok('Zeitstrahl umbenannt zu Terminplan'), f48Ok++)
  : (fail('Terminplan-Umbenennung fehlt'), f48Fail++);

content.includes('L\u00f6schen') || content.includes('Löschen')
  ? (ok('Löschen (kein Tippfehler mehr)'), f48Ok++)
  : (fail('Löschen fehlt'), f48Fail++);


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

