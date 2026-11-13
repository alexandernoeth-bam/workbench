/* ============================================================
   CLIE_desk_tests.js — Regressionstests für Desk in CLIE (seit 0.125.0)
   Aufruf:  node CLIE_desk_tests.js [clie.html]

   Teil A (statisch) läuft immer. Teil B öffnet clie.html in einem
   Browser (Playwright); Google und Drive werden dabei nachgestellt.
   Fehlt Playwright, wird Teil B als „warn“ übersprungen.

   Eigene Datei, weil CLIE_tests.js im Repository noch auf dem Stand vor
   0.124.0 steht und bei Kategorie 13 (Einkauf) abbricht.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const DATEI = path.resolve(process.argv[2] || path.join(__dirname, 'clie.html'));
const QUELLE = fs.readFileSync(DATEI, 'utf8');
const SKRIPT = (QUELLE.match(/<script>([\s\S]*?)<\/script>/g) || []).pop().replace(/^<script>|<\/script>$/g, '');

let anzOk = 0, anzFail = 0, anzWarn = 0;
function ok(text) { console.log('  ok   ' + text); anzOk++; }
function fail(text) { console.log('  FAIL ' + text); anzFail++; }
function warn(text) { console.log('  warn ' + text); anzWarn++; }
function pruefe(bedingung, text) { if (bedingung) { ok(text); } else { fail(text); } }

/* ---------------------------------------------------------------- A */
console.log('\nD-01  Code: Syntax, keine doppelten Funktionen, DIV-Balance');
{
  const tmp = path.join(os.tmpdir(), 'clie_desk_' + process.pid + '.js');
  fs.writeFileSync(tmp, SKRIPT);
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); ok('Skript syntaktisch korrekt'); }
  catch (e) { fail('Syntaxfehler: ' + String(e.stderr).split('\n').slice(0, 3).join(' | ')); }
  fs.unlinkSync(tmp);
  const namen = [...SKRIPT.matchAll(/^function (\w+)\(/gm)].map(m => m[1]);
  const doppelt = namen.filter((n, i) => namen.indexOf(n) !== i);
  pruefe(!doppelt.length, doppelt.length ? 'doppelt: ' + doppelt.join(', ') : namen.length + ' Funktionen, alle eindeutig');
  const markup = QUELLE.replace(/<script>[\s\S]*?<\/script>/g, '');
  pruefe((markup.match(/<div[\s>]/g) || []).length === (markup.match(/<\/div>/g) || []).length, 'Markup: DIV-Balance');
  const modul = SKRIPT.slice(SKRIPT.indexOf('/* ---------- Desk (seit 0.125.0)'), SKRIPT.indexOf('/* ---------- Vom Server holen'));
  pruefe(modul.length > 1000, 'Desk-Modul gefunden');
  pruefe((modul.match(/<div[\s>]/g) || []).length === (modul.match(/<\/div>/g) || []).length, 'Desk-Modul: DIV-Balance');
  const gerufen = [...modul.matchAll(/onclick="(\w+)\(/g)].map(m => m[1]);
  const fehlt = gerufen.filter(n => namen.indexOf(n) < 0);
  pruefe(!fehlt.length, fehlt.length ? 'onclick ohne Funktion: ' + fehlt.join(', ') : 'alle onclick-Funktionen definiert (' + [...new Set(gerufen)].join(', ') + ')');
}

console.log('\nD-02  Version und Anmeldung im Raster');
{
  const v = (SKRIPT.match(/var APP_VERSION = '([\d.]+)'/) || [])[1];
  pruefe(v === '0.125.1', 'APP_VERSION 0.125.1');
  pruefe(QUELLE.indexOf('<title>CLIE ' + v + '</title>') >= 0, 'Titel trägt die Version');
  pruefe(/\{ id: 'desk', name: 'Desk'/.test(SKRIPT), 'Desk steht in CL_APPS');
  pruefe(/\n  desk: '/.test(SKRIPT), 'Desk hat ein Symbol in CL_BILD');
}

console.log('\nD-03  Desk schreibt nie und lässt die workbench.json in Ruhe');
{
  const modul = SKRIPT.slice(SKRIPT.indexOf('/* ---------- Desk (seit 0.125.0)'), SKRIPT.indexOf('/* ---------- Vom Server holen'));
  pruefe(!/method\s*:/.test(modul), 'kein POST/PATCH/DELETE im Desk-Modul');
  pruefe(!/driveDateiId|driveStand/.test(modul.replace(/\/\*[\s\S]*?\*\//g, '')), 'driveDateiId und driveStand bleiben unberührt');
  pruefe(/var SDK_DATEI = 'schreibtisch\.json';/.test(modul), 'gelesen wird nur schreibtisch.json (private Fassung)');
  pruefe(!/beruf/i.test(modul.replace(/\/\*[\s\S]*?\*\//g, '')), 'keine Spur einer beruflichen Datei');
  pruefe(!/farbe/.test(modul.replace(/\/\*[\s\S]*?\*\//g, '')), 'keine Abschnittsfarben (CLIE zeigt Graustufen)');
}

/* ---------------------------------------------------------------- B */
let playwright = null;
try { playwright = require('playwright'); } catch (e) {
  try { playwright = require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } catch (e2) { playwright = null; }
}

const BESTAND = {
  fassung: 1, geaendert: 5, grabsteine: {},
  planung: [
    { id: 'p2', name: 'Erinnerungen', link: 'onenote:https://x/Planung.one#Erinnerungen&page-id={2}&end', link_web: '', ordnung: 1 },
    { id: 'p1', name: 'Woche', link: 'onenote:https://x/Planung.one#Woche&page-id={1}&end', link_web: 'https://onedrive.live.com/edit?woche', ordnung: 0 },
    { id: 'p3', name: 'Böse', link: 'javascript:alert(1)', link_web: '', ordnung: 2 }
  ],
  faecher: [
    { id: 'f2', name: 'Garten', reihe: 'eigen', farbe: '#85C440', ordnung: 1, link: 'onenote:https://x/Garten.one', link_web: '', leiste: [], seiten: [] },
    { id: 'f1', name: 'Haus', reihe: 'eigen', farbe: '#3B8EDE', ordnung: 0,
      link: 'onenote:https://x/Haus.one#section-id={A}&end', link_web: 'https://onedrive.live.com/edit?haus',
      leiste: [
        { id: 'l2', name: 'Offene Fragen', link: '', link_web: '', ordnung: 1 },
        { id: 'l1', name: 'Aufgaben', link: 'onenote:https://x/Haus.one#Aufgaben&page-id={L1}&end', link_web: 'https://onedrive.live.com/edit?aufg', ordnung: 0 }
      ],
      seiten: [
        { id: 's1', name: 'Carport', link: 'onenote:https://x/Haus.one#Carport&page-id={S1}&end', link_web: '', ordnung: 0,
          unter: [{ id: 'u1', name: 'Projektplanung', link: 'onenote:https://x/Haus.one#PP&page-id={U1}&end', link_web: '', ordnung: 0 }] }
      ] },
    { id: 'z1', name: 'Verein', reihe: 'zusammen', farbe: '#9B6BC9', ordnung: 0, link: 'https://example.sharepoint.com/verein', link_web: '', leiste: [{ id: 'zl', name: 'Projektseite', link: '', link_web: '', ordnung: 0 }], seiten: [] }
  ]
};

/* So liest Android einen intent:-Link (Intent.parseUri, URI_INTENT_SCHEME):
   der letzte „#“ trennt den Intent-Teil ab, davor steht der Rest. */
function androidDaten(href) {
  const i = href.lastIndexOf('#');
  if (i < 0 || href.indexOf('#Intent;', i) !== i) { return null; }
  const teile = href.slice(i + 8).split(';');
  const schema = (teile.find(x => x.indexOf('scheme=') === 0) || '').slice(7);
  let daten = href.slice(0, i);
  if (daten.indexOf('intent:') !== 0) { return null; }
  return schema + ':' + daten.slice(7);
}

async function browserTests() {
  let browser;
  try { browser = await playwright.chromium.launch(); }
  catch (e) {
    try { browser = await playwright.chromium.launch({ executablePath: '/usr/bin/google-chrome' }); }
    catch (e2) { warn('kein Browser startbar — Teil B übersprungen'); return; }
  }
  const anfragen = [];
  async function kontext(ua) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, userAgent: ua, serviceWorkers: 'block' });
    await ctx.route('**/*', route => {
      const u = route.request().url();
      if (/googleapis\.com\/drive\/v3\/files\?/.test(u)) {
        anfragen.push(route.request().method() + ' ' + u);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ files: [{ id: 'SDK1', modifiedTime: '2026-11-13T20:00:00Z' }] }) });
      }
      if (/googleapis\.com\/drive\/v3\/files\/SDK1\?alt=media/.test(u)) {
        anfragen.push(route.request().method() + ' ' + u);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BESTAND) });
      }
      if (/^file:/.test(u)) { return route.continue(); }
      anfragen.push(route.request().method() + ' ' + u);
      return route.abort();
    });
    return ctx;
  }
  const fehlerLog = [];

  /* --- Android (Pixel) --- */
  const ctxA = await kontext('Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36');
  const p = await ctxA.newPage();
  p.on('pageerror', e => fehlerLog.push(e.message));
  await p.goto('file://' + DATEI);
  await p.waitForTimeout(500);
  await p.evaluate(() => { window.__echtToken = tokenGueltig; tokenGueltig = function () { return false; }; oeffne('uebersicht'); });

  console.log('\nD-04  Start: Desk im Raster');
  const apps = await p.$$eval('.apps .app', e => e.map(x => x.textContent.trim()));
  pruefe(apps.indexOf('Desk') === apps.indexOf('Casestudies') + 1, 'Desk steht direkt nach Casestudies (' + apps.length + ' Apps)');
  pruefe(apps.length <= 15, 'das Raster 3×5 reicht noch');
  pruefe(await p.$$eval('.apps .app', e => { const d = e.find(x => x.textContent.trim() === 'Desk'); return !!(d && d.querySelector('svg circle')); }), 'Desk hat die runde Palm-Scheibe');

  console.log('\nD-05  Ohne Anmeldung: Hinweis statt leerer Seite');
  await p.evaluate(() => oeffne('desk'));
  pruefe((await p.textContent('#reiter')).trim() === 'Desk', 'Reiter „Desk“');
  pruefe((await p.textContent('#katKnopf')).trim() === 'Privat', 'oben rechts steht „Privat“ — kein ▼');
  await p.click('#katKnopf');
  pruefe(await p.evaluate(() => cl.aufklapp === ''), 'der Knopf oben rechts öffnet nichts');
  pruefe(/mit Google verbinden/i.test(await p.textContent('#inhalt')), 'Desk bittet um Verbindung');
  pruefe(anfragen.filter(a => /drive/.test(a)).length === 0, 'ohne Anmeldung keine Drive-Anfrage');

  console.log('\nD-06  Mit Anmeldung: Fächer, Planung, Reihenfolge');
  const idVorher = await p.evaluate(() => [typeof driveDateiId === 'undefined' ? 'u' : driveDateiId, typeof driveStand === 'undefined' ? 'u' : driveStand]);
  await p.evaluate(() => { tokenGueltig = function () { return true; }; zugriffToken = 'TEST'; cl.sdk.geholt = 0; return sdkLaden(); });
  await p.waitForTimeout(200);
  const gruppen = await p.$$eval('#inhalt .gruppe', e => e.map(x => x.textContent));
  pruefe(JSON.stringify(gruppen) === '["Planung","Eigene Fächer","Zusammenarbeit"]', 'Gruppen: ' + gruppen.join(' | '));
  const faecher = await p.$$eval('.sdk-fach .tx', e => e.map(x => x.textContent));
  pruefe(JSON.stringify(faecher) === '["Haus","Garten","Verein"]', 'Fächer nach „ordnung“: ' + faecher.join(', '));
  const plan = await p.$$eval('#inhalt > .sdk-seite .tx', e => e.map(x => x.textContent));
  pruefe(plan.slice(0, 2).join() === 'Woche,Erinnerungen', 'Planung nach „ordnung“: ' + plan.join(', '));
  pruefe(await p.$$eval('a[href^="javascript"]', e => e.length) === 0, 'ein javascript:-Link wird nie zum Anker');
  pruefe(/Böse[\s\S]*kein Link/.test(await p.textContent('#inhalt')), 'er erscheint als „kein Link“');
  pruefe(!/style="[^"]*#(3B8EDE|85C440|9B6BC9)/i.test(await p.innerHTML('#inhalt')), 'keine Abschnittsfarben');
  pruefe(anfragen.every(a => /^GET /.test(a)), 'nur lesende Anfragen (' + anfragen.length + ' × GET)');
  const idNachher = await p.evaluate(() => [typeof driveDateiId === 'undefined' ? 'u' : driveDateiId, typeof driveStand === 'undefined' ? 'u' : driveStand]);
  pruefe(JSON.stringify(idVorher) === JSON.stringify(idNachher), 'driveDateiId/driveStand der workbench.json unverändert');

  console.log('\nD-07  Fach antippen: Stapel klappt auf, Seiten als einzelnes Blatt');
  await p.click('.sdk-fach:has-text("Haus")');
  pruefe(await p.$$eval('.sdk-fach.an', e => e.length) === 1, 'genau ein Fach ist offen');
  const auf = await p.$$eval('.sdk-auf .sdk-seite .tx', e => e.map(x => x.textContent));
  pruefe(auf.join() === 'Aufgaben,Offene Fragen,Carport,Projektplanung', 'Leiste, Seiten, Unterseite: ' + auf.join(', '));
  pruefe(await p.$$eval('.sdk-auf .sdk-seite svg path', e => e.length) === 8, 'jede Seite trägt ein einzelnes Blatt (Umriss + Eselsohr)');
  pruefe(await p.$$eval('.sdk-fach .sdk-sym svg path', e => e.length) === 3 && await p.$$eval('.sdk-fach .sdk-sym svg rect', e => e.length) === 3, 'Fächer tragen einen Stapel (hinten zwei Blätter, vorn ein volles)');
  pruefe(await p.$$eval('.sdk-auf a.knopf', e => e.every(x => getComputedStyle(x).textDecorationLine === 'none')), '„Abschnitt öffnen“ sieht aus wie ein Knopf, nicht wie ein Link');
  pruefe(await p.$$eval('.sdk-seite.tief', e => e.length) === 1, 'die Unterseite ist eingerückt');
  pruefe(/kein Link/.test(await p.textContent('.sdk-auf')), '„Offene Fragen“ ohne Link ist als solche erkennbar');
  await p.click('.sdk-fach:has-text("Haus")');
  pruefe(await p.$$eval('.sdk-auf', e => e.length) === 0, 'zweiter Tipp klappt wieder zu');
  await p.click('.sdk-fach:has-text("Haus")');

  console.log('\nD-08  Pixel: in die OneNote-App, nicht in den Browser (Fehler in 0.125.0)');
  const hA = await p.getAttribute('.sdk-auf a.knopf', 'href');
  pruefe(/^intent:/.test(hA), '„Abschnitt öffnen“ geht am Pixel als Intent an die App');
  pruefe(/#Intent;scheme=onenote;package=com\.microsoft\.office\.onenote;/.test(hA), 'Schema onenote, Paket der OneNote-App');
  pruefe(androidDaten(hA) === BESTAND.faecher[1].link, 'Android setzt daraus genau den onenote:-Link zusammen');
  pruefe(hA.indexOf('S.browser_fallback_url=' + encodeURIComponent('https://onedrive.live.com/edit?haus') + ';') > 0, 'die Web-Adresse ist der Ausweichweg');
  pruefe(await p.getAttribute('.sdk-auf a.knopf', 'target') === null, 'ohne target — kein leerer Browser-Tab');
  const hC = await p.getAttribute('.sdk-auf a.sdk-seite:has-text("Carport")', 'href');
  pruefe(/^intent:/.test(hC) && hC.indexOf('browser_fallback_url') < 0, 'ohne Web-Adresse: Intent ohne Ausweichweg');
  pruefe(androidDaten(hC) === 'onenote:https://x/Haus.one#Carport&page-id={S1}&end', 'auch mit Abschnittsmarke (#) im Link: ' + androidDaten(hC));
  await p.screenshot({ path: path.join(os.tmpdir(), 'desk-pixel.png') });

  console.log('\nD-09  Ohne Netz: der zuletzt geholte Stand');
  await p.reload();
  await p.waitForTimeout(400);
  await p.evaluate(() => { tokenGueltig = function () { return false; }; oeffne('desk'); });
  pruefe(await p.$$eval('.sdk-fach', e => e.length) === 3, 'nach Neuladen ohne Anmeldung: alle drei Fächer aus dem Zwischenstand');
  pruefe(/Stand \d\d:\d\d/.test(await p.textContent('#inhalt')), 'mit der Uhrzeit des Stands');
  console.log('\nD-12  Pixel: Kennungen in Klammern, nur-Web bleibt Web');
  const roh = await p.evaluate(() => sdkKlammern('onenote:https://x/A.one#S&section-id=0ABCDEF1-2345-6789-ABCD-EF0123456789&page-id={11111111-2222-3333-4444-555555555555}&end'));
  pruefe(roh === 'onenote:https://x/A.one#S&section-id={0ABCDEF1-2345-6789-ABCD-EF0123456789}&page-id={11111111-2222-3333-4444-555555555555}&end', 'fehlende Klammern ergänzt, vorhandene nicht verdoppelt');
  await p.click('.sdk-fach:has-text("Verein")');
  pruefe(await p.getAttribute('.sdk-auf a.knopf', 'href') === 'https://example.sharepoint.com/verein' && await p.getAttribute('.sdk-auf a.knopf', 'target') === '_blank', 'nur eine Web-Adresse: bleibt https in neuem Fenster');
  const ziele = await p.$$eval('a[href]', e => e.map(a => a.getAttribute('href')));
  pruefe(ziele.every(h => /^(intent:|https:)/.test(h)), 'am Pixel keine nackten onenote:-Links mehr');
  await ctxA.close();

  /* --- PC --- */
  console.log('\nD-10  PC: onenote: zuerst, ohne neues Fenster');
  const ctxP = await kontext('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36');
  const q = await ctxP.newPage();
  q.on('pageerror', e => fehlerLog.push(e.message));
  await q.goto('file://' + DATEI);
  await q.waitForTimeout(400);
  await q.evaluate(() => { tokenGueltig = function () { return true; }; zugriffToken = 'TEST'; oeffne('desk'); });
  await q.waitForTimeout(300);
  await q.click('.sdk-fach:has-text("Haus")');
  const h = await q.getAttribute('.sdk-auf a.knopf', 'href');
  pruefe(/^onenote:/.test(h), '„Abschnitt öffnen“ nimmt am PC onenote:');
  pruefe(await q.getAttribute('.sdk-auf a.knopf', 'target') === null, 'onenote: ohne target');
  await q.click('.sdk-fach:has-text("Verein")');
  pruefe(await q.getAttribute('.sdk-auf a.knopf', 'href') === 'https://example.sharepoint.com/verein', 'Zusammenarbeit: SharePoint-Link als Rückfall');
  await ctxP.close();

  console.log('\nD-11  Keine Laufzeitfehler');
  pruefe(!fehlerLog.length, fehlerLog.length ? fehlerLog.join(' | ') : 'keine JS-Fehler');
  await browser.close();
}

(async () => {
  if (playwright) {
    try { await browserTests(); } catch (e) { fail('Browsertest abgebrochen: ' + String(e.message).split('\n')[0]); }
  } else { warn('Playwright fehlt — Teil B übersprungen'); }
  /* ============================================================
     ERGEBNIS
     ============================================================ */
  console.log('\nERGEBNIS: ' + anzOk + ' ok, ' + anzFail + ' fehlgeschlagen, ' + anzWarn + ' Warnungen');
  process.exit(anzFail ? 1 : 0);
})();
