/* ============================================================
   huellen.js — kleine Hüllen für einzelne CLIE-Apps

     node huellen.js lesezeichen desk sammlungen

   Erzeugt je App:
     <name>.html             die Hülle
     <name>.webmanifest      damit Chrome sie als eigene App installiert
     <name>-192.png          Symbol
     <name>-512.png
     <name>-512-maskierbar.png

   Danach lässt sie sich wie jede PWA installieren und ins Dock ziehen.

   Name und Symbol holt das Skript aus CL_APPS und CL_BILD der gebauten
   clie.html — nichts wird doppelt gepflegt, und eine App, die es nicht
   gibt, bricht den Lauf ab, statt eine Hülle ins Leere zu bauen.

   Warum die Hülle nicht sofort weiterleitet: Dann käme man nie zum
   Installieren, weil Chrome die Seite schon verlassen hätte, bevor man
   das Menü öffnen kann. Sie springt nur weiter, wenn sie bereits als
   App gestartet wurde; im Browser zeigt sie einen Knopf und sagt, wie
   man sie auf den Startbildschirm legt.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const HIER = __dirname;
const QUELLE = path.join(HIER, 'clie.html');

/* Aus „To Do List“ wird „todolist“ — ein Dateiname ohne Überraschungen. */
function slug(name) {
  return String(name).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '');
}

function huelleHtml(app, datei) {
  const ziel = './clie.html#' + app.id;
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${app.name}</title>
<link rel="manifest" href="./${datei}.webmanifest">
<meta name="theme-color" content="#1C2116">
<link rel="apple-touch-icon" href="./${datei}-192.png">
<style>
html,body{height:100%;margin:0}
body{background:#B9C4A6;color:#1C2116;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:18px;padding:24px;
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center}
img{width:112px;height:112px}
h1{font-size:25px;font-weight:600;margin:0}
a.knopf{display:inline-block;background:#1C2116;color:#B9C4A6;text-decoration:none;
  font-size:18px;padding:12px 26px;border-radius:3px}
p{font-size:16px;line-height:1.4;max-width:34ch;color:#3B4433;margin:0}
</style>
</head>
<body>
  <img src="./${datei}-512.png" alt="">
  <h1>${app.name}</h1>
  <a class="knopf" href="${ziel}">Öffnen</a>
  <p>Diese Seite ist nur die Hülle. Über das Chrome-Menü
     „Zum Startbildschirm hinzufügen“ wird daraus ein eigenes Symbol,
     das sich ins Dock ziehen lässt.</p>
<script>
/* Als installierte App: gleich durchspringen. Im Browser stehen
   bleiben, sonst käme man nie zum Installieren. */
(function () {
  var alsApp = false;
  try {
    alsApp = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true;
  } catch (e) { alsApp = false; }
  if (alsApp) { window.location.replace('${ziel}'); }
}());
</script>
</body>
</html>
`;
}

function manifest(app, datei) {
  return JSON.stringify({
    id: './' + datei + '.html',
    name: app.name,
    short_name: app.name,
    description: app.was || ('CLIE — ' + app.name),
    lang: 'de',
    start_url: './' + datei + '.html',
    /* Muss clie.html einschließen, sonst verlässt der Sprung die App
       und landet in einem Browser-Tab mit Adresszeile. */
    scope: './',
    display: 'standalone',
    background_color: '#B9C4A6',
    theme_color: '#1C2116',
    icons: [
      { src: './' + datei + '-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: './' + datei + '-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: './' + datei + '-512-maskierbar.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  }, null, 2) + '\n';
}

(async () => {
  const wunsch = process.argv.slice(2);
  if (!wunsch.length) {
    console.log('Aufruf: node huellen.js <app> [<app> …]   z. B. lesezeichen desk');
    process.exit(1);
  }
  if (!fs.existsSync(QUELLE)) {
    console.log('clie.html fehlt — erst bauen.');
    process.exit(1);
  }

  const b = await chromium.launch();
  const seite = await b.newContext({ viewport: { width: 600, height: 600 } }).then(c => c.newPage());
  await seite.goto('file://' + QUELLE);
  await seite.waitForTimeout(900);

  const apps = await seite.evaluate(() => CL_APPS.map(a => ({ id: a.id, name: a.name, was: a.was || '' })));
  const bilder = await seite.evaluate(() => Object.keys(CL_BILD));

  /* Erst alle prüfen, dann bauen: ein Tippfehler soll nicht die Hälfte
     der Hüllen anlegen und dann abbrechen. */
  const fehlt = wunsch.filter(id => !apps.filter(a => a.id === id)[0]);
  if (fehlt.length) {
    console.log('Abbruch: diese Apps gibt es nicht: ' + fehlt.join(', '));
    await b.close();
    process.exit(1);
  }
  const ohneBild = wunsch.filter(id => bilder.indexOf(id) < 0);
  if (ohneBild.length) {
    console.log('Abbruch: für diese Apps gibt es kein Symbol: ' + ohneBild.join(', '));
    await b.close();
    process.exit(1);
  }

  await seite.evaluate(() => {
    document.documentElement.className = 'schema-wb';
    document.body.innerHTML = '<div id="buehne" style="width:512px;height:512px;display:flex;'
      + 'align-items:center;justify-content:center;background:transparent"></div>';
    document.body.style.background = 'transparent';
    document.body.style.margin = '0';
  });

  for (const id of wunsch) {
    const app = apps.filter(a => a.id === id)[0];
    const datei = slug(app.name);

    for (const [groesse, anteil, zusatz] of [[192, 0.92, ''], [512, 0.92, ''], [512, 0.72, '-maskierbar']]) {
      await seite.setViewportSize({ width: groesse, height: groesse });
      await seite.evaluate(([i, g, a]) => {
        const bu = document.getElementById('buehne');
        bu.style.width = g + 'px';
        bu.style.height = g + 'px';
        const k = Math.round(g * a);
        bu.innerHTML = '<div style="width:' + k + 'px;height:' + k + 'px">'
          + clSymbol(i).replace('<svg ', '<svg style="width:100%;height:100%" ') + '</div>';
      }, [id, groesse, anteil]);
      await seite.waitForTimeout(70);
      const el = await seite.$('#buehne');
      await el.screenshot({ path: path.join(HIER, datei + '-' + groesse + zusatz + '.png'),
        omitBackground: true });
    }

    fs.writeFileSync(path.join(HIER, datei + '.html'), huelleHtml(app, datei), 'utf8');
    fs.writeFileSync(path.join(HIER, datei + '.webmanifest'), manifest(app, datei), 'utf8');
    console.log('  ' + datei + '.html  ·  ' + datei + '.webmanifest  ·  3 Symbole   -> #' + id);
  }

  await b.close();
})();
