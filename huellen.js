/* ============================================================
   huellen.js — kleine Hüllen für einzelne CLIE-Apps      1.2.0

     node huellen.js lesezeichen desk sammlungen

   Erzeugt je App:
     <name>.html             die Hülle
     <name>.webmanifest      damit Chrome sie als eigene App installiert
     <name>-192.png          Symbol
     <name>-512.png
     <name>-512-maskierbar.png

   Nach dem Muster von todo.html / desk.html / datebook.html (1.1.0),
   die auf dem Pixel nachweislich installierbar sind. Zwei Dinge daran
   sind nicht Geschmack, sondern die Bedingung dafür:

   1. Der Bereich ist die Datei selbst („./bookmarks.html“), nicht der
      Ordner. Ein Bereich „./“ verschluckt clie.html — dann hält Chrome
      die Hülle für eine Seite der schon installierten App und bietet
      kein Installieren an. Umgekehrt darf die Hülle auch nicht im
      Bereich von CLIE („./clie…“) liegen; genau daran scheiterte 1.0.0,
      als die Dateien noch clie-todo.html hießen.

   2. CLIE läuft im iframe, es wird nicht dorthin gesprungen. So
      verlässt die App ihren Bereich nie und bleibt im eigenen Fenster
      ohne Adresszeile. Gesprungen hieße: Chrome öffnet einen Tab.

   Name und Symbol holt das Skript aus CL_APPS und CL_BILD der gebauten
   clie.html — nichts wird doppelt gepflegt, und eine App, die es nicht
   gibt, bricht den Lauf ab, statt eine Hülle ins Leere zu bauen.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const V = '1.2.0';
const HIER = __dirname;
const QUELLE = path.join(HIER, 'clie.html');

/* Aus „To Do List“ wird „todolist“ — ein Dateiname ohne Überraschungen. */
function slug(name) {
  return String(name).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '');
}

function huelleHtml(app, datei) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1C2116">
<title>${app.name} ${V}</title>
<link rel="manifest" href="./${datei}.webmanifest?v=${V}">
<link rel="icon" href="./${datei}-192.png?v=${V}">
<link rel="apple-touch-icon" href="./${datei}-192.png?v=${V}">
<!--
  ${app.name} als eigene App (Hülle ${V}).
  Die Seite liegt bewusst außerhalb des Bereichs von CLIE (./clie…) und ihr
  eigener Bereich ist nur diese Datei. Darin läuft CLIE eingebettet, direkt
  in ${app.name} — dieselbe Adresse, dieselben Daten.
-->
<style>
html,body{height:100%;margin:0;background:#B9C4A6;overflow:hidden}
body{display:flex;flex-direction:column}
#hinweis{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:8px 12px;
  background:#1C2116;color:#DCE4CC;font:15px/1.35 ui-monospace,"Courier New",monospace}
#hinweis span{flex:1}
#hinweis button{font:inherit;color:#1C2116;background:#DCE4CC;border:0;border-radius:12px;padding:4px 12px}
#clie{flex:1 1 auto;width:100%;border:0;display:block}
[hidden]{display:none !important}
</style>
</head>
<body>
<div id="hinweis" hidden><span>${app.name} als App: Chrome-Menü ⋮ › Zum Startbildschirm hinzufügen › Installieren</span><button type="button" id="installieren" hidden>Installieren</button></div>
<iframe id="clie" title="${app.name}" src="./clie.html#${app.id}" allow="clipboard-read; clipboard-write; fullscreen; screen-wake-lock; autoplay"></iframe>
<script>
'use strict';
var aufschub = null;

function alsApp() {
  try {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true;
  } catch (e) { return false; }
}

function installieren() {
  if (!aufschub) { return; }
  aufschub.prompt();
  aufschub.userChoice.then(function () {
    aufschub = null;
    document.getElementById('hinweis').hidden = true;
  });
}

function startSeite() {
  /* Als installierte App ist nichts zu zeigen — nur CLIE. */
  if (!alsApp()) {
    document.getElementById('hinweis').hidden = false;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      aufschub = e;
      document.getElementById('installieren').hidden = false;
    });
    document.getElementById('installieren').addEventListener('click', installieren);
  }
  /* Derselbe Service Worker und Bereich wie CLIE — die Hülle legt keinen eigenen an. */
  if (navigator.serviceWorker && /^https?:/.test(window.location.protocol)) {
    navigator.serviceWorker.register('./sw-clie.js', { scope: './clie' }).catch(function () { return null; });
  }
}
startSeite();
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
    description: app.was || (app.name + ' aus CLIE als eigene App — dieselben Daten wie CLIE.'),
    lang: 'de',
    start_url: './' + datei + '.html',
    /* Nur diese eine Datei. Ein weiterer Bereich verschluckt clie.html und
       Chrome hält die Hülle dann für CLIE selbst — dann kein Installieren. */
    scope: './' + datei + '.html',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#B9C4A6',
    theme_color: '#1C2116',
    icons: [
      { src: './' + datei + '-192.png?v=' + V, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: './' + datei + '-512.png?v=' + V, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: './' + datei + '-512-maskierbar.png?v=' + V, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
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
  /* Eine Hülle, die „clie…“ hieße, läge im Bereich von CLIE — der Fehler
     aus 1.0.0. Lieber hier abbrechen als auf dem Gerät scheitern. */
  const imBereich = wunsch.filter(id => /^clie/.test(slug(apps.filter(a => a.id === id)[0].name)));
  if (imBereich.length) {
    console.log('Abbruch: der Dateiname läge im Bereich von CLIE: ' + imBereich.join(', '));
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
    console.log('  ' + datei + '.html  ·  ' + datei + '.webmanifest  ·  3 Symbole   -> #' + id + '  (Hülle ' + V + ')');
  }

  await b.close();
})();
