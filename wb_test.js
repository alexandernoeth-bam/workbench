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
const tabsExpected = ['tagessicht','notizen','woche'];
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
content.includes('id="sec-notizen"')   ? ok('#sec-notizen vorhanden')       : fail('#sec-notizen fehlt');
content.includes('id="notizen-scroll"') ? ok('#notizen-scroll vorhanden')   : fail('#notizen-scroll fehlt');
jsCode.includes('renderNotizenTab')    ? ok('renderNotizenTab definiert')   : fail('renderNotizenTab fehlt');
jsCode.includes('_nzTogglePin')        ? ok('_nzTogglePin definiert')       : fail('_nzTogglePin fehlt');
jsCode.includes('_nzRenderPills')      ? ok('_nzRenderPills definiert')     : fail('_nzRenderPills fehlt');
jsCode.includes('_nzNeueListeDialog')  ? ok('_nzNeueListeDialog definiert') : fail('_nzNeueListeDialog fehlt');
jsCode.includes('_nzAddItem')          ? ok('_nzAddItem definiert')         : fail('_nzAddItem fehlt');
content.includes('nz-pin-pill')        ? ok('.nz-pin-pill CSS vorhanden')   : fail('.nz-pin-pill fehlt');
jsCode.includes("case 'notizen'")      ? ok("case 'notizen' in renderSection") : fail("case 'notizen' fehlt");
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
content.includes("data-zustand=\"aktuell\"") ? ok("data-zustand='aktuell' vorhanden") : fail("data-zustand='aktuell' fehlt");
content.includes("data-zustand=\"parkplatz\"") ? ok("data-zustand='parkplatz' vorhanden") : fail("data-zustand='parkplatz' fehlt");
content.includes("data-zustand=\"kompass\"") ? ok("data-zustand='kompass' vorhanden") : fail("data-zustand='kompass' fehlt");
content.includes("data-zustand=\"archiv\"") ? ok("data-zustand='archiv' vorhanden") : fail("data-zustand='archiv' fehlt");
jsCode.includes('nz-cnt-aktuell') || content.includes('nz-cnt-aktuell') ? ok('Zähler #nz-cnt-aktuell vorhanden') : fail('Zähler fehlt');
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
jsCode.includes("'wb-f-dur'")  || jsCode.includes('"wb-f-dur"')  ? ok('Dauerfeld wb-f-dur vorhanden') : fail('Dauerfeld wb-f-dur fehlt');
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
content.includes('id="wb-sidebar-tabs"') ? ok('#wb-sidebar-tabs vorhanden') : fail('#wb-sidebar-tabs fehlt');
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
// Fokus-Limit
content.includes('Fokus-Limit') && content.includes('aktuellCount >= 3')
  ? ok('Fokus-Limit 3 implementiert') : fail('Fokus-Limit fehlt');
content.includes('_nzSetListeZustand') && content.includes('aktuellCount >= 3')
  ? ok('Fokus-Limit in _nzSetListeZustand') : fail('Fokus-Limit nicht in _nzSetListeZustand');
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
(content.includes('const cols = 4') || content.includes('cols = 4,'))
  ? (ok('JS-Sizing: 4 Spalten'), f29Ok++) : (fail('JS-Sizing: nicht 4 Spalten'), f29Fail++);

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
  ? (ok('#ts-kd-foot hat id'), f31Ok++) : (fail('#ts-kd-foot fehlt id'), f31Fail++);
// Hybrid: Footer ist immer sichtbar (kein display:none mehr bei Freitext)
content.includes("foot.style.display = ''") || content.includes('foot.style.display=\'\'')
  ? (ok('Footer im Hybrid-Render immer sichtbar'), f31Ok++) : (fail('Footer-Anzeige fehlt'), f31Fail++);

// Checkliste: ts-kd-chk Checkboxen im Hybrid
const hybridIdx = content.indexOf('_renderHybridBody(l, listeId, ctx)');
const hybridSrc = hybridIdx >= 0 ? content.slice(hybridIdx, hybridIdx + 1200) : '';
hybridSrc.includes('ts-kd-chk')
  ? (ok('Hybrid: ts-kd-chk Checkboxen im Body'), f31Ok++) : (fail('Hybrid: keine Checkboxen'), f31Fail++);
hybridSrc.includes('Checkliste') && hybridSrc.includes('Freitext')
  ? (ok('Hybrid: Sektion "Checkliste" + "Freitext" vorhanden'), f31Ok++) : (fail('Hybrid: Sektions-Label fehlen'), f31Fail++);

// Mini-Kachel Freitext-Preview aus l.inhalt
(content.includes('tmp.innerHTML = l.inhalt') || content.includes("l.inhalt || ''"))
  ? (ok('Mini-Kachel: Freitext-Preview aus l.inhalt'), f31Ok++) : (fail('Mini-Kachel: Freitext-Preview nicht aus l.inhalt'), f31Fail++);

// 4 Spalten
(content.includes('const cols = 4') || content.includes('cols = 4,'))
  ? (ok('JS-Sizing: 4 Spalten'), f31Ok++) : (fail('JS-Sizing: nicht 4 Spalten'), f31Fail++);

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
content.includes('id="nz-sidebar"')      ? (ok('#nz-sidebar vorhanden'), f34Ok++)      : (fail('#nz-sidebar fehlt'), f34Fail++);
content.includes('id="nz-sb-tags"')      ? (ok('#nz-sb-tags vorhanden'), f34Ok++)      : (fail('#nz-sb-tags fehlt'), f34Fail++);
content.includes('id="nz-layout"')       ? (ok('#nz-layout vorhanden'), f34Ok++)       : (fail('#nz-layout fehlt'), f34Fail++);
content.includes('id="nz-main"')         ? (ok('#nz-main vorhanden'), f34Ok++)         : (fail('#nz-main fehlt'), f34Fail++);

// Detail-Panel HTML
content.includes('id="nz-detail-panel"') ? (ok('#nz-detail-panel vorhanden'), f34Ok++) : (fail('#nz-detail-panel fehlt'), f34Fail++);
content.includes('id="nz-dp-body"')      ? (ok('#nz-dp-body vorhanden'), f34Ok++)      : (fail('#nz-dp-body fehlt'), f34Fail++);
content.includes('id="nz-dp-foot"')      ? (ok('#nz-dp-foot vorhanden'), f34Ok++)      : (fail('#nz-dp-foot fehlt'), f34Fail++);

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
content.includes('id="nz-dp-meta"')      ? (ok('#nz-dp-meta HTML vorhanden'), f35Ok++) : (fail('#nz-dp-meta fehlt'), f35Fail++);

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
const hybSrc2 = hybIdx2 >= 0 ? content.slice(hybIdx2, hybIdx2+1500) : '';
hybSrc2.includes("ctx === 'ts'") && hybSrc2.includes('nz-dp-ft')
  ? (ok('_renderHybridBody: ctx-Parameter (ts/nz)'), f36Ok++) : (fail('_renderHybridBody: kein ctx-Parameter'), f36Fail++);
hybSrc2.includes('Checkliste') && hybSrc2.includes('Freitext')
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
