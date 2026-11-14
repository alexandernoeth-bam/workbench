/* ============================================================
   CLIE_pwa_tests.js — Regressionstests für die Einzel-Apps
   Desk, To Do und Date Book als eigene PWA (seit 14.11.2026, 1.0.0)
   Aufruf:  node CLIE_pwa_tests.js [ordner]   (Standard: Ordner der Datei)

   Teil A prüft Manifeste, Seiten und Symbole statisch.
   Teil B startet einen kleinen Server auf localhost und fragt Chrome
   über das DevTools-Protokoll, ob jede App installierbar ist und mit
   ihrem Anker in der richtigen CLIE-App landet. Ohne Playwright: warn.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

const ORDNER = path.resolve(process.argv[2] || __dirname);
const APPS = [
  { key: 'desk', name: 'Desk', anker: 'desk' },
  { key: 'todo', name: 'To Do', anker: 'aufgaben' },
  { key: 'datebook', name: 'Date Book', anker: 'kalender' }
];

let anzOk = 0, anzFail = 0, anzWarn = 0;
function ok(t) { console.log('  ok   ' + t); anzOk++; }
function fail(t) { console.log('  FAIL ' + t); anzFail++; }
function warn(t) { console.log('  warn ' + t); anzWarn++; }
function pruefe(b, t) { if (b) { ok(t); } else { fail(t); } }
function lies(n) { return fs.readFileSync(path.join(ORDNER, n), 'utf8'); }
function gibt(n) { return fs.existsSync(path.join(ORDNER, n.split('?')[0])); }

const CLIE = gibt('clie.html') ? lies('clie.html') : '';

/* ---------------------------------------------------------------- A */
console.log('\nP-01  Manifeste');
const ids = [];
APPS.forEach(function (a) {
  let m = null;
  try { m = JSON.parse(lies('clie-' + a.key + '.webmanifest')); } catch (e) { fail(a.name + ': Manifest fehlt oder ist kein JSON'); return; }
  ids.push(m.id);
  pruefe(m.name === a.name && m.short_name === a.name, a.name + ': Name „' + m.name + '“');
  pruefe(m.start_url === './clie.html#' + a.anker, a.name + ': startet in ' + m.start_url);
  pruefe(m.scope === './clie', a.name + ': Bereich ./clie wie CLIE');
  pruefe(m.display === 'standalone', a.name + ': eigenständiges Fenster');
  const groessen = (m.icons || []).map(function (i) { return i.sizes + (i.purpose ? '/' + i.purpose : ''); });
  pruefe(groessen.indexOf('192x192') >= 0 && groessen.indexOf('512x512') >= 0 && groessen.indexOf('512x512/maskable') >= 0, a.name + ': Symbole 192, 512, 512 maskierbar');
  pruefe((m.icons || []).every(function (i) { return gibt(i.src.replace(/^\.\//, '')); }), a.name + ': alle Symboldateien vorhanden');
  pruefe(new RegExp("\\{ id: '" + a.anker + "'").test(CLIE) || a.anker === 'desk' && /\{ id: 'desk'/.test(CLIE), a.name + ': CLIE kennt die App #' + a.anker);
});
pruefe(new Set(ids).size === APPS.length && ids.indexOf('./clie.html') < 0, 'jede App hat eine eigene Kennung, keine gleicht CLIE');

console.log('\nP-02  Installationsseiten');
APPS.forEach(function (a) {
  const s = lies('clie-' + a.key + '.html');
  pruefe(s.indexOf('<link rel="manifest" href="./clie-' + a.key + '.webmanifest') > 0, a.name + ': verweist auf ihr Manifest');
  pruefe(/<title>[^<]*\d+\.\d+\.\d+[^<]*<\/title>/.test(s), a.name + ': Version im Titel');
  pruefe(s.indexOf("register('./sw-clie.js', { scope: './clie' })") > 0, a.name + ': derselbe Service Worker wie CLIE');
  pruefe(s.indexOf('href="./clie.html#' + a.anker + '"') > 0, a.name + ': Link „ohne Installieren“ führt in die richtige App');
  const markup = s.replace(/<script>[\s\S]*?<\/script>/g, '');
  pruefe((markup.match(/<div[\s>]/g) || []).length === (markup.match(/<\/div>/g) || []).length, a.name + ': DIV-Balance');
  const js = (s.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || '';
  const tmp = path.join(require('os').tmpdir(), 'pwa_' + a.key + '_' + process.pid + '.js');
  fs.writeFileSync(tmp, js);
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); ok(a.name + ': Skript syntaktisch korrekt'); }
  catch (e) { fail(a.name + ': Syntaxfehler'); }
  fs.unlinkSync(tmp);
  const ids2 = [...js.matchAll(/getElementById\('(\w+)'\)/g)].map(function (x) { return x[1]; });
  pruefe(ids2.every(function (i) { return markup.indexOf('id="' + i + '"') > 0; }), a.name + ': alle angesprochenen Elemente vorhanden');
});

/* ---------------------------------------------------------------- B */
let playwright = null;
try { playwright = require('playwright'); } catch (e) {
  try { playwright = require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright')); } catch (e2) { playwright = null; }
}

function server() {
  const typen = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
  return new Promise(function (ok2) {
    const s = http.createServer(function (q, r) {
      const n = decodeURIComponent(q.url.split('?')[0].replace(/^\/workbench\//, ''));
      const f = path.join(ORDNER, n);
      if (!f.startsWith(ORDNER) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'Content-Type': typen[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(r);
    });
    s.listen(0, '127.0.0.1', function () { ok2(s); });
  });
}

async function browserTests() {
  let browser;
  try { browser = await playwright.chromium.launch(); }
  catch (e) { try { browser = await playwright.chromium.launch({ executablePath: '/usr/bin/google-chrome' }); } catch (e2) { warn('kein Browser — Teil B übersprungen'); return; } }
  const s = await server();
  const basis = 'http://localhost:' + s.address().port + '/workbench/';
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, function (r) { return r.abort(); });
  const fehler = [];
  for (const a of APPS) {
    console.log('\nP-03  ' + a.name + ': installierbar und startet richtig');
    const p = await ctx.newPage();
    p.on('pageerror', function (e) { fehler.push(a.name + ': ' + e.message); });
    await p.goto(basis + 'clie-' + a.key + '.html');
    await p.waitForTimeout(800);
    const cdp = await ctx.newCDPSession(p);
    const man = await cdp.send('Page.getAppManifest');
    pruefe(!man.errors.length && /clie-/.test(man.url), 'Chrome liest das Manifest (' + man.url.replace(basis, '') + ')');
    let fehlerListe = [];
    try { fehlerListe = (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors.map(function (x) { return x.errorId; }); }
    catch (e) { fehlerListe = ['nicht abfragbar']; }
    pruefe(!fehlerListe.length, 'installierbar' + (fehlerListe.length ? ' — ' + fehlerListe.join(', ') : ''));
    const m = JSON.parse(lies('clie-' + a.key + '.webmanifest'));
    await p.goto(new URL(m.start_url, basis + 'clie-' + a.key + '.webmanifest').href);
    await p.waitForTimeout(700);
    const reiter = (await p.textContent('#reiter').catch(function () { return ''; })).trim();
    pruefe(await p.evaluate(function () { return cl.app; }) === a.anker, 'Startadresse öffnet CLIE in „' + reiter + '“');
    await p.close();
  }
  console.log('\nP-04  Keine Laufzeitfehler');
  pruefe(!fehler.length, fehler.length ? fehler.join(' | ') : 'keine JS-Fehler');
  await browser.close();
  s.close();
}

(async function () {
  if (playwright) { try { await browserTests(); } catch (e) { fail('Browsertest abgebrochen: ' + String(e.message).split('\n')[0]); } }
  else { warn('Playwright fehlt — Teil B übersprungen'); }
  /* ============================================================
     ERGEBNIS
     ============================================================ */
  console.log('\nERGEBNIS: ' + anzOk + ' ok, ' + anzFail + ' fehlgeschlagen, ' + anzWarn + ' Warnungen');
  process.exit(anzFail ? 1 : 0);
})();
