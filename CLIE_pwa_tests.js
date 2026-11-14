/* ============================================================
   CLIE_pwa_tests.js — Regressionstests für die Einzel-Apps
   Desk, To Do und Date Book als eigene PWA (1.1.0)
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
  try { m = JSON.parse(lies(a.key + '.webmanifest')); } catch (e) { fail(a.name + ': Manifest fehlt oder ist kein JSON'); return; }
  ids.push(m.id);
  pruefe(m.name === a.name && m.short_name === a.name, a.name + ': Name „' + m.name + '“');
  pruefe(m.start_url === './' + a.key + '.html' && m.scope === './' + a.key + '.html', a.name + ': startet auf der eigenen Seite, eigener Bereich');
  pruefe(m.display === 'standalone', a.name + ': eigenständiges Fenster');
  const groessen = (m.icons || []).map(function (i) { return i.sizes + (i.purpose ? '/' + i.purpose : ''); });
  pruefe(groessen.indexOf('192x192') >= 0 && groessen.indexOf('512x512') >= 0 && groessen.indexOf('512x512/maskable') >= 0, a.name + ': Symbole 192, 512, 512 maskierbar');
  pruefe((m.icons || []).every(function (i) { return gibt(i.src.replace(/^\.\//, '')); }), a.name + ': alle Symboldateien vorhanden');
  pruefe(new RegExp("\\{ id: '" + a.anker + "'").test(CLIE), a.name + ': CLIE kennt die App #' + a.anker);
});
pruefe(new Set(ids).size === APPS.length && ids.indexOf('./clie.html') < 0, 'jede App hat eine eigene Kennung, keine gleicht CLIE');

/* P-05 Fehlerart aus 1.0.0: Die Startadresse lag im Bereich der installierten
   CLIE-App (./clie…). Chrome hielt die App für schon installiert und legte nur
   eine Verknüpfung mit Chrome-Zeichen an. Keine andere App darf einen engeren
   Bereich haben, der die Startadresse einschließt. */
console.log('\nP-05  Kein fremder Bereich über der Startadresse');
{
  const andere = fs.readdirSync(ORDNER).filter(function (n) { return /\.webmanifest$|^manifest.*\.json$/.test(n); })
    .filter(function (n) { return APPS.every(function (a) { return n !== a.key + '.webmanifest'; }); })
    .map(function (n) { try { const m = JSON.parse(lies(n)); return { n: n, scope: String(m.scope || './').replace(/^\/workbench\//, './') }; } catch (e) { return null; } })
    .filter(Boolean);
  pruefe(andere.some(function (x) { return x.n === 'clie.webmanifest'; }), 'CLIE-Manifest liegt zum Vergleich vor (' + andere.length + ' fremde Manifeste)');
  APPS.forEach(function (a) {
    const start = './' + a.key + '.html';
    const eng = andere.filter(function (x) { return start.indexOf(x.scope) === 0 && x.scope.length >= start.length; });
    pruefe(!eng.length, a.name + ': kein engerer fremder Bereich' + (eng.length ? ' — ' + eng.map(function (x) { return x.n; }).join(', ') : ''));
    pruefe(start.indexOf('./clie') !== 0, a.name + ': Startadresse liegt nicht im Bereich von CLIE (./clie)');
  });
}

console.log('\nP-02  App-Seiten');
APPS.forEach(function (a) {
  const s = lies(a.key + '.html');
  pruefe(s.indexOf('<link rel="manifest" href="./' + a.key + '.webmanifest') > 0, a.name + ': verweist auf ihr Manifest');
  pruefe(/<title>[^<]*\d+\.\d+\.\d+[^<]*<\/title>/.test(s), a.name + ': Version im Titel');
  pruefe(s.indexOf('src="./clie.html#' + a.anker + '"') > 0, a.name + ': bettet CLIE in #' + a.anker + ' ein');
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
    await p.goto(basis + a.key + '.html');
    await p.waitForTimeout(800);
    const cdp = await ctx.newCDPSession(p);
    const man = await cdp.send('Page.getAppManifest');
    pruefe(!man.errors.length && man.url.indexOf(a.key + '.webmanifest') > 0, 'Chrome liest das Manifest (' + man.url.replace(basis, '') + ')');
    let fehlerListe = [];
    try { fehlerListe = (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors.map(function (x) { return x.errorId; }); }
    catch (e) { fehlerListe = ['nicht abfragbar']; }
    pruefe(!fehlerListe.length, 'installierbar' + (fehlerListe.length ? ' — ' + fehlerListe.join(', ') : ''));
    const rahmen = p.frame({ url: /clie\.html/ });
    pruefe(!!rahmen, 'CLIE läuft eingebettet');
    const app = rahmen ? await rahmen.evaluate(function () { return cl.app; }) : '';
    const reiter = rahmen ? (await rahmen.textContent('#reiter')).trim() : '';
    pruefe(app === a.anker, 'CLIE steht in „' + reiter + '“');
    const box = await p.$eval('#clie', function (f) { const r = f.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.bottom)]; });
    pruefe(box[0] === 412 && box[1] === 860, 'CLIE füllt den Bildschirm (' + box.join(' × ') + ')');
    pruefe(await p.$eval('#hinweis', function (h) { return !h.hidden; }), 'im Browser-Tab: Hinweis zum Installieren');
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
