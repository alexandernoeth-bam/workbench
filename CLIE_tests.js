/* ============================================================
   CLIE_tests.js — Regressionstests für CLIE
   Aufruf:  node CLIE_tests.js [clie.html] [workbench.html]

   Mit dem zweiten Pfad wird zusätzlich geprüft, dass Unterbau,
   Kalender und Aktivitäten-Kern wörtlich der Workbench entsprechen.
   Ohne ihn wird das als „warn“ übersprungen. CLIE arbeitet auf
   derselben workbench.json wie die Workbench.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATEI = process.argv[2] || path.join(__dirname, 'clie.html');
const WB_DATEI = process.argv[3] || path.join(path.dirname(path.resolve(DATEI)), 'workbench.html');

if (!fs.existsSync(DATEI)) {
  console.log('FEHLER: Datei nicht gefunden: ' + DATEI);
  process.exit(1);
}

const QUELLE = fs.readFileSync(DATEI, 'utf8');
const ORDNER = path.dirname(path.resolve(DATEI));
const WB_QUELLE = fs.existsSync(WB_DATEI) ? fs.readFileSync(WB_DATEI, 'utf8') : '';
const SW_PFAD = path.join(ORDNER, 'sw-clie.js');
const SW_QUELLE = fs.existsSync(SW_PFAD) ? fs.readFileSync(SW_PFAD, 'utf8') : '';
const MANIFEST_PFAD = path.join(ORDNER, 'clie.webmanifest');

let anzOk = 0, anzFail = 0, anzWarn = 0;
function ok(text)   { console.log('  ok   ' + text); anzOk++; }
function fail(text) { console.log('  FAIL ' + text); anzFail++; }
function warn(text) { console.log('  warn ' + text); anzWarn++; }
function pruefe(bedingung, text) { if (bedingung) { ok(text); } else { fail(text); } }

function letztesSkript(html) {
  const b = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
  return b.length ? b[b.length - 1].replace(/^<script>/, '').replace(/<\/script>$/, '') : '';
}
const SKRIPT = letztesSkript(QUELLE);
const WB_SKRIPT = WB_QUELLE ? letztesSkript(WB_QUELLE) : '';

function funktionText(skript, name) {
  const eine = skript.match(new RegExp('\\nfunction ' + name + '\\([^)]*\\)\\s*\\{[^\\n]*\\}\\s*\\n'));
  if (eine) { return eine[0].trim(); }
  const m = skript.match(new RegExp('\\nfunction ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n'));
  return m ? m[0].trim() : null;
}

function umgebung() {
  const elemente = {};
  const element = function (id) {
    const klassen = new Set();
    return {
      id: id, innerHTML: '', textContent: '', value: '', className: '', style: {}, scrollTop: 0,
      classList: { add(k) { klassen.add(k); }, remove(k) { klassen.delete(k); }, toggle() {}, contains(k) { return klassen.has(k); } },
      addEventListener() {}, removeEventListener() {}, focus() {}, blur() {}, click() {},
      appendChild() {}, removeChild() {}, setAttribute() {}, getAttribute() { return null; },
      querySelectorAll() { return []; }, querySelector() { return null; }
    };
  };
  const ablage = {};
  const speicher = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(ablage, k) ? ablage[k] : null; },
    setItem(k, v) { ablage[k] = String(v); }, removeItem(k) { delete ablage[k]; }
  };
  const ctx = {
    console, Promise, Date, Math, JSON, Object, Array, String, Number, RegExp, Error, Boolean, isNaN,
    parseInt, parseFloat, encodeURIComponent, decodeURIComponent, setTimeout() { return 0; }, clearTimeout() {},
    setInterval() { return 0; }, clearInterval() {},
    localStorage: speicher, sessionStorage: speicher, indexedDB: null, innerWidth: 412, innerHeight: 915,
    location: { protocol: 'file:', hash: '', search: '', href: 'file:///test' },
    matchMedia() { return { matches: false, addEventListener() {} }; },
    fetch() { return Promise.reject(new Error('kein Netz im Test')); },
    google: null, caches: null, addEventListener() {}, removeEventListener() {},
    navigator: { storage: null, serviceWorker: null, onLine: true },
    document: {
      title: '', hidden: false, activeElement: null,
      getElementById(id) { if (!elemente[id]) { elemente[id] = element(id); } return elemente[id]; },
      querySelector() { return null; }, querySelectorAll() { return []; },
      createElement() { return element('neu'); },
      head: { appendChild() {} },
      body: { classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, appendChild() {}, removeChild() {} },
      documentElement: { style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} } },
      addEventListener() {}
    }
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  ctx.__ablage = ablage;
  return ctx;
}

function ladeIn(skript, name) {
  const ctx = umgebung();
  try {
    vm.runInContext(skript, ctx, { filename: name });
    return ctx;
  } catch (e) {
    fail(name + ' ließ sich nicht auswerten: ' + e.message);
    return null;
  }
}

/* ============================================================
   1. Aufbau der Datei
   ============================================================ */
console.log('\n1. Aufbau der Datei');
{
  const ohneSkript = QUELLE.replace(/<script>[\s\S]*?<\/script>/g, '');
  const auf = (ohneSkript.match(/<div\b/g) || []).length;
  const zu = (ohneSkript.match(/<\/div>/g) || []).length;
  pruefe(auf === zu, 'DIV-Balance stimmt (' + auf + '/' + zu + ')');
  try { new vm.Script(SKRIPT); ok('das Skript ist syntaktisch korrekt'); }
  catch (e) { fail('Syntaxfehler im Skript: ' + e.message); }
  const version = (SKRIPT.match(/var APP_VERSION = '([\d.]+)';/) || [])[1];
  const titel = (QUELLE.match(/<title>CLIE ([\d.]+)<\/title>/) || [])[1];
  pruefe(version && version === titel, 'Version steht gleich im Titel und in APP_VERSION (' + version + ')');
  pruefe(/class="fassung">CLIE v' \+ esc\(APP_VERSION\)/.test(SKRIPT), 'die Übersicht zeigt die Version im Hauptfenster');
  pruefe(/document\.title = 'CLIE ' \+ APP_VERSION/.test(SKRIPT), 'der Fenstertitel trägt die Version');
  pruefe(!/@media/.test(QUELLE), 'keine @media-Regeln');
  const fns = [...SKRIPT.matchAll(/\nfunction (\w+)\s*\(/g)].map(m => m[1]);
  const doppelt = [...new Set(fns.filter((f, i) => fns.indexOf(f) !== i))];
  pruefe(doppelt.length === 0, 'keine doppelt definierten Funktionen' + (doppelt.length ? ' — gefunden: ' + doppelt.join(', ') : ''));

  /* Aufrufe nicht definierter Funktionen: im Code und in den Bedienelementen */
  const definiert = new Set(fns);
  const vars = new Set([...SKRIPT.matchAll(/\bvar\s+(\w+)/g)].map(m => m[1]));
  const ohne = SKRIPT.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const bekannt = new Set(('if for while switch return function typeof catch String Number Boolean Array Object JSON Math Date RegExp '
    + 'Error Promise parseInt parseFloat isNaN encodeURIComponent decodeURIComponent setTimeout clearTimeout setInterval '
    + 'clearInterval fetch Blob URL new fehler fertig').split(' '));
  const code = ohne.replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
  const fremdCode = [...new Set([...code.matchAll(/(^|[^.\w$])([A-Za-z_]\w*)\s*\(/g)].map(m => m[2]))]
    .filter(n => !definiert.has(n) && !vars.has(n) && !bekannt.has(n));
  pruefe(fremdCode.length === 0, 'der Code ruft nur Funktionen, die es gibt' + (fremdCode.length ? ' — fehlt: ' + fremdCode.join(', ') : ''));
  const griffe = [...ohne.matchAll(/on(?:click|input|change|keydown|mousedown)=\\?["']([A-Za-z_]\w*)\(/g)].map(m => m[1])
    .concat([...QUELLE.replace(/<script>[\s\S]*?<\/script>/g, '').matchAll(/on(?:click|input|change|keydown|mousedown)="([A-Za-z_]\w*)\(/g)].map(m => m[1]));
  const fremd = [...new Set(griffe)].filter(a => !definiert.has(a) && a !== 'event');
  pruefe(fremd.length === 0, 'Bedienelemente rufen nur Funktionen, die es gibt' + (fremd.length ? ' — fehlt: ' + fremd.join(', ') : ''));
}

const CL = ladeIn(SKRIPT, 'clie.html');
if (CL) { ok('CLIE lässt sich außerhalb des Browsers auswerten'); }

function frisch() {
  CL.DB = CL.leereDatenbank();
  CL.cl.app = 'uebersicht'; CL.cl.filter = 'alle'; CL.cl.aufklapp = '';
  CL.termineNachTag = {};
  CL.zugriffToken = null; CL.tokenAblauf = 0;
  CL.kalenderListe = []; CL.kalenderLaeuft = false; CL.kalenderFehler = '';
}
function inhalt() { return CL.document.getElementById('inhalt').innerHTML; }

/* ============================================================
   2. Unterbau: wörtlich aus der Workbench — dieselbe Datei
   Grund: CLIE schreibt in die workbench.json. Jede Abweichung im
   Unterbau, beim Kalender oder im Kern würde Daten der anderen Apps
   verderben oder Termine anders zeigen.
   ============================================================ */
console.log('\n2. Unterbau, Kalender und Kern wörtlich aus der Workbench');
if (!WB_SKRIPT) {
  warn('workbench.html nicht gefunden — Vergleich übersprungen');
} else {
  const WOERTLICH = ['zusammenfuehren', 'alsText', 'uebernehmen', 'speichern', 'laden', 'leereDatenbank',
    'grabsteinSetzen', 'grabsteinZeit', 'grabsteineAufraeumen', 'textZuBestand', 'abgleichen', 'abgleichPlanen',
    'driveSuchen', 'driveAnlegen', 'driveHochladen', 'driveHerunterladen', 'antwortPruefen',
    'tokenMerken', 'tokenGueltig', 'klientVorbereiten', 'anmelden', 'anmeldeVersuch', 'abmelden',
    'erneuerungPlanen', 'erneuerungPruefen', 'taktPruefen', 'klickErneuern', 'dateiWaehlen', 'opfsSchreiben', 'opfsLesen',
    'montagVon', 'kalenderwoche', 'neueKennung', 'esc',
    'kalenderListeHolen', 'kalenderGewaehlt', 'kalenderKontext', 'einenKalenderHolen', 'eintraegeEinsortieren',
    'merkeTermin', 'praktischGanztags', 'titelOhneArt', 'terminKontextUeber', 'termineFuerTag'];
  const abweichend = WOERTLICH.filter(n => {
    const a = funktionText(SKRIPT, n), b = funktionText(WB_SKRIPT, n);
    return !a || !b || a !== b;
  });
  pruefe(abweichend.length === 0, WOERTLICH.length + ' Funktionen gleichen der Workbench Wort für Wort'
    + (abweichend.length ? ' — abweichend: ' + abweichend.join(', ') : ''));
  const kern = [...SKRIPT.matchAll(/\nfunction (kp\w+)\s*\(/g)].map(m => m[1]);
  const kernAb = kern.filter(n => funktionText(SKRIPT, n) !== funktionText(WB_SKRIPT, n));
  pruefe(kern.length > 30 && kernAb.length === 0, 'der Aktivitäten-Kern (' + kern.length + ' Funktionen) gleicht der Workbench'
    + (kernAb.length ? ' — abweichend: ' + kernAb.join(', ') : ''));
  const samm = (s) => (s.match(/var SAMMLUNGEN = \[[\s\S]*?\];/) || [''])[0];
  pruefe(samm(SKRIPT) && samm(SKRIPT) === samm(WB_SKRIPT), 'dieselben Sammlungen wie die Workbench — beim Abgleich geht nichts verloren');
  const wb = (n) => (WB_SKRIPT.match(new RegExp("var " + n + "\\s*=\\s*'([^']*)';")) || [])[1];
  const cl = (n) => (SKRIPT.match(new RegExp("var " + n + "\\s*=\\s*'([^']*)';")) || [])[1];
  pruefe(cl('CLIENT_ID') === wb('CLIENT_ID') && cl('DRIVE_DATEI') === wb('DRIVE_DATEI'),
    'dieselbe Google-Anwendung und dieselbe Drive-Datei wie die Workbench');
}

/* ============================================================
   3. Eigene Speicherschlüssel
   Grund: Liegen Workbench, Wochenkompass und CLIE unter derselben
   Adresse, dürfen sie sich Gerätespeicher und Anmeldung nicht teilen.
   ============================================================ */
console.log('\n3. Eigene Speicherschlüssel');
{
  const werte = ['IDB_NAME', 'LS_KEY', 'OPFS_NAME', 'TOKEN_KEY', 'ANMELDE_MERKER']
    .map(n => (SKRIPT.match(new RegExp("var " + n + "\\s*=\\s*'([^']*)';")) || [])[1] || '');
  pruefe(werte.every(w => /^clie-/.test(w)), 'alle Gerätespeicher und Merker beginnen mit „clie-“ (' + werte.join(', ') + ')');
  pruefe(/var DATEINAME\s*=\s*'workbench\.json'/.test(SKRIPT), 'gearbeitet wird auf workbench.json');
  pruefe(/var CL_FILTER_KEY = 'clie-filter'/.test(SKRIPT), 'die Kategorie wird unter eigenem Namen gemerkt');
}

/* ============================================================
   4. Google: Drive und Kalender
   ============================================================ */
console.log('\n4. Google: Drive und Kalender');
if (CL) {
  pruefe(/calendar\.readonly/.test(CL.SCOPES) && /drive\.file/.test(CL.SCOPES), 'die Anmeldung fragt Drive und das Lesen des Kalenders an');
  const a = funktionText(SKRIPT, 'anmeldeAnfragen') || '';
  pruefe(/clTermineHolen\(false\)/.test(a) && !/\btermineHolen\(/.test(a), 'nach der Anmeldung holt CLIE die Termine selbst');
  pruefe(!/^function termineHolen\(/m.test(SKRIPT), 'termineHolen der Workbench (mit Tag und Jahresarchiv) ist nicht dabei');
}

/* ============================================================
   5. Termine holen
   Grund: Termine gehören Google und bleiben im Arbeitsspeicher —
   sie dürfen nie in die workbench.json geraten.
   ============================================================ */
console.log('\n5. Termine holen');
const warte = () => new Promise(r => setImmediate(r));
async function terminTest() {
  if (!CL) { return; }
  frisch();
  const heute = CL.isoDatum();
  CL.zugriffToken = 'test'; CL.tokenAblauf = Date.now() + 3600000;
  CL.DB.einstellungen.kalender = [{ id: 'b', name: 'Büro', aktiv: true, kontext: 'beruflich' }, { id: 'x', name: 'Aus', aktiv: false }];
  const abrufe = [];
  CL.fetch = function (adresse) {
    abrufe.push(adresse);
    let d;
    if (/calendarList/.test(adresse)) { d = { items: [{ id: 'b', summary: 'Büro' }, { id: 'x', summary: 'Aus' }] }; }
    else {
      d = { items: [{ id: 'e1', summary: 'Rückruf Becker', start: { dateTime: heute + 'T23:58:00' }, end: { dateTime: heute + 'T23:59:00' } },
                    { id: 'e2', summary: 'Abgesagt', status: 'cancelled', start: { dateTime: heute + 'T10:00:00' } }] };
    }
    return Promise.resolve({ ok: true, status: 200, url: adresse, json() { return Promise.resolve(d); } });
  };
  const vorher = CL.alsText();
  const erg = await CL.clTermineHolen(false);
  pruefe(erg === true && CL.kalenderStand, 'die Termine werden geholt');
  pruefe(!abrufe.some(a => /calendars\/x\//.test(a)), 'abgewählte Kalender werden nicht gelesen');
  const t = (CL.termineNachTag[heute] || []);
  pruefe(t.length === 1 && t[0].titel === 'Rückruf Becker' && t[0].kontext === 'beruflich', 'abgesagte fallen weg, der Kontext kommt vom Kalender');
  pruefe(CL.alsText() === vorher, 'die Termine landen nicht in der workbench.json');
  CL.fetch = function () { return Promise.reject(new Error('kein Netz im Test')); };
  CL.zugriffToken = null;
  const ohne = await CL.clTermineHolen(false);
  pruefe(ohne === false, 'ohne Anmeldung wird nichts geholt');
}

/* ============================================================
   6. Übersicht
   ============================================================ */
function uebersichtTest() {
  console.log('\n6. Übersicht');
  if (!CL) { return; }
  frisch();
  const heute = CL.isoDatum();
  CL.DB.einstellungen.leitsatz = '- Erst das *Wichtige*\n\nUm 17 Uhr ist Schluss <b>';
  CL.DB.projekte.push({ id: 'p1', name: 'Büro', flaeche: '[] A\n[x] B\n[-] C\n[ ] D', status: 'laufend', kontext: 'beruflich', geaendert: 1 });
  CL.DB.projekte.push({ id: 'p2', name: 'Alt', flaeche: '[] Ruht', status: 'ruht', kontext: 'beruflich', geaendert: 1 });
  CL.DB.projekte.push({ id: 'p3', name: 'Umbau', flaeche: '[] Statik', status: 'laufend', kontext: 'privat', geaendert: 1 });
  CL.DB.themen.push({ id: 't1', name: 'Liste', text: '[] L1', kontext: 'privat', geaendert: 1 });
  CL.DB.gedanken.push({ id: 'g1', titel: 'Notiz', text: '[] zählt nicht', geaendert: 1 });
  CL.DB.gedanken.push({ id: 'g2', titel: 'Kompass', text: '', kompass: true, geaendert: 1 });
  CL.termineNachTag[heute] = [{ id: 'a', zeit: '00:00', bis: '00:01', titel: 'Vorbei', kontext: 'privat' },
                              { id: 'b', zeit: '23:58', bis: '23:59', titel: 'Becker', kontext: 'beruflich' }];
  CL.zeichne();
  const h = inhalt();
  pruefe(CL.clOffeneAufgaben() === 4, 'offene Aufgaben: nur [] aus laufenden Projekten und Listen, nicht [x], [-], Ruhendes oder Notizen');
  pruefe(/class="zahl">4</.test(h), 'die Zahl steht am Symbol der Aufgaben');
  pruefe(CL.clAppZahl('kalender') === 1 && /oeffne\('kalender'\)"><span class="sym"><svg[^]*?<span class="zahl">1</.test(h),
    'am Kalender steht die Zahl der heute noch kommenden Termine — Vergangenes zählt nicht');
  pruefe((h.match(/class="app"/g) || []).length === 5, 'fünf Apps im Raster');
  /* Seit 0.1.2 gewünscht: „Jeden Tag im Blick“ gehört in den Tag der Workbench, nicht auf das Handy. */
  pruefe(!/Erst das Wichtige/.test(h) && !/class="blick"/.test(h) && !/function blickHtml\(/.test(SKRIPT),
    '„Jeden Tag im Blick“ erscheint in CLIE nicht — auch wenn Leitsätze gepflegt sind');
  pruefe(CL.DB.einstellungen.leitsatz.indexOf('Erst das') >= 0, 'die Leitsätze selbst bleiben unangetastet in der Datei');

  CL.katSetzen('privat');
  const p = inhalt();
  pruefe(CL.cl.filter === 'privat' && CL.__ablage['clie-filter'] === 'privat', 'die Kategorie wird gesetzt und gemerkt');
  pruefe(CL.clOffeneAufgaben() === 2 && !/Becker/.test(p), 'Privat zeigt nur private Aufgaben und Termine');
  pruefe(/▼ Privat/.test(CL.document.getElementById('katKnopf').textContent), 'oben rechts steht die Kategorie');
  CL.katSetzen('quatsch');
  pruefe(CL.cl.filter === 'privat', 'unbekannte Kategorien werden ignoriert');
  CL.katSetzen('alle');
}

/* ============================================================
   7. Apps, Menü und Tasten
   ============================================================ */
function bedienTest() {
  console.log('\n7. Apps, Menü und Tasten');
  if (!CL) { return; }
  frisch();
  CL.oeffne('kalender');
  pruefe(CL.document.getElementById('reiter').textContent === 'Kalender' && /kommt mit CLIE 0\.2/.test(inhalt()),
    'eine spätere App zeigt, mit welcher Fassung sie kommt');
  CL.oeffne('gibtsnicht');
  pruefe(CL.cl.app === 'uebersicht' && CL.document.getElementById('reiter').textContent === 'Übersicht', 'Unbekanntes führt zur Übersicht');
  CL.oeffne('abgleich');
  const a = inhalt();
  pruefe(/hs-knopf/.test(a) && /Mit Google verbinden/.test(a) && /onclick="anmelden\(false\)"/.test(a), 'Abgleich ohne Anmeldung bietet „Anmelden“');
  pruefe(/CLIE \d+\.\d+\.\d+/.test(a) && /workbench\.json/.test(a), 'Abgleich zeigt Fassung und Datei');
  CL.zugriffToken = 'test'; CL.tokenAblauf = Date.now() + 3600000;
  CL.zeichne();
  const b = inhalt();
  pruefe(/>Abgleichen</.test(b) && /clTermineHolen\(true\)/.test(b) && /abmelden\(\)/.test(b), 'angemeldet: Abgleichen, Termine holen, Abmelden');
  CL.zugriffToken = null;
  CL.menueUm();
  pruefe(CL.cl.aufklapp === 'menue' && /Auf neue Fassung prüfen/.test(CL.document.getElementById('aufklapp').innerHTML), 'der Reiter öffnet das Menü');
  CL.katUm();
  pruefe(CL.cl.aufklapp === 'kat' && /katSetzen\('beruflich'\)/.test(CL.document.getElementById('aufklapp').innerHTML), 'die Kategorie öffnet ihre Liste');
  CL.aufklappZu();
  pruefe(CL.cl.aufklapp === '' && CL.document.getElementById('aufklapp').innerHTML === '', 'ein Tipp daneben schließt');
  CL.menueUm();
  CL.oeffne('uebersicht');
  pruefe(CL.cl.aufklapp === '', 'Öffnen einer App schließt offene Listen');
  pruefe(/onclick="oeffne\('uebersicht'\)"/.test(QUELLE) && /onclick="menueUm\(\)"/.test(QUELLE) && /onclick="oeffne\('abgleich'\)"/.test(QUELLE),
    'die festen Tasten: Übersicht, Menü, Abgleich');
}

/* ============================================================
   8. Verbindung: Banner, stilles Neuverbinden, neue Fassung
   ============================================================ */
function verbindungTest() {
  console.log('\n8. Verbindung und neue Fassung');
  if (!CL) { return; }
  frisch();
  CL.anmeldebannerZeichnen();
  pruefe(CL.document.getElementById('anmeldeStreifen').classList.contains('sichtbar'), 'ohne Anmeldung erscheint der Streifen mit „Verbinden“');
  CL.zugriffToken = 'test'; CL.tokenAblauf = Date.now() + 3600000; CL.verbindungOk = true;
  CL.anmeldebannerZeichnen();
  pruefe(!CL.document.getElementById('anmeldeStreifen').classList.contains('sichtbar'), 'verbunden verschwindet er');
  CL.verbindungOk = false;
  CL.anmeldebannerZeichnen();
  pruefe(CL.document.getElementById('anmeldeStreifen').classList.contains('sichtbar'), 'bei Verbindungsverlust kommt er wieder');
  pruefe(/stillAnmelden\('start'\)/.test(SKRIPT) && /stillAnmelden\('rueckkehr'\)/.test(SKRIPT) && /stillAnmelden\('verbindung'\)/.test(SKRIPT),
    'still neu verbunden wird beim Start, beim Zurückkehren und bei Verbindungsverlust');
  pruefe(/\.\/clie\.html\?stand=/.test(SKRIPT) && /versionTaktStarten\(\)/.test(SKRIPT), 'nach neuer Fassung wird gefragt — beim Start und alle 15 Minuten');
  CL.neuStreifenZeigen('9.9.9');
  pruefe(/9\.9\.9/.test(CL.document.getElementById('neuText').textContent), 'eine neue Fassung wird oben angezeigt');
}

/* ============================================================
   9. Service Worker und Manifest
   ============================================================ */
function swTest() {
  console.log('\n9. Service Worker und Manifest');
  if (!SW_QUELLE) { warn('sw-clie.js fehlt'); } else {
    try { new vm.Script(SW_QUELLE); ok('sw-clie.js ist syntaktisch korrekt'); } catch (e) { fail('Syntaxfehler in sw-clie.js: ' + e.message); }
    pruefe(/var PRAEFIX = 'clie-'/.test(SW_QUELLE) && /'\.\/clie\.html'/.test(SW_QUELLE), 'eigener Vorrat — fremde Vorräte bleiben unberührt');
  }
  pruefe(/register\('\.\/sw-clie\.js', \{ scope: '\.\/clie' \}\)/.test(SKRIPT), 'eigener Bereich ./clie — die Service Worker der anderen Apps bleiben unberührt');
  if (!fs.existsSync(MANIFEST_PFAD)) { warn('clie.webmanifest fehlt'); } else {
    let m = null;
    try { m = JSON.parse(fs.readFileSync(MANIFEST_PFAD, 'utf8')); ok('das Manifest ist gültiges JSON'); } catch (e) { fail('Manifest: ' + e.message); }
    if (m) {
      pruefe(m.start_url === './clie.html' && m.scope === './clie' && m.name === 'CLIE', 'Manifest: Name, Start und Bereich');
      pruefe((m.icons || []).every(i => fs.existsSync(path.join(ORDNER, i.src))), 'alle Symbole des Manifests liegen bei');
    }
  }
}

/* ============================================================
   10. Schriftgrößen
   Grund: In 0.1.0 bis 0.1.2 war die Schrift am Pixel zu klein
   (Wunsch: dreimal +10 %). Keine Schrift unter 15,5 px, Grundschrift
   mindestens 21 px, Zeilen mindestens 19 px, App-Namen 20 px.
   ============================================================ */
function schriftTest() {
  console.log('\n10. Schriftgrößen');
  const css = (QUELLE.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
  const groessen = [...css.matchAll(/font-size:([\d.]+)px/g)].map(m => Number(m[1]));
  pruefe(groessen.length > 20 && Math.min.apply(null, groessen) >= 15.5,
    'keine Schrift kleiner als 15,5 px (kleinste: ' + Math.min.apply(null, groessen) + ' px)');
  const grund = Number((css.match(/body\{[^}]*font-size:([\d.]+)px/) || [])[1]);
  pruefe(grund >= 21, 'Grundschrift mindestens 21 px (' + grund + ' px)');
  const regel = (sel) => Number((css.match(new RegExp('(?:^|\\n)' + sel.replace(/\./g, '\\.') + '\\{[^}]*font-size:([\\d.]+)px')) || [])[1]);
  pruefe(regel('.reihe') >= 19 && regel('.app') >= 20 && regel('.reiter') >= 22.5,
    'Zeilen, App-Namen und Reiter groß genug (' + [regel('.reihe'), regel('.app'), regel('.reiter')].join(' / ') + ' px)');
  pruefe(/class="aufklapp" style="top:49px/.test(SKRIPT), 'die Kategorieliste sitzt unter dem höheren Kopf');
}

/* ============================================================
   11. Übersicht wie am Palm
   Grund: Gewünscht ist die Reduktion des Palm (0.1.3): nur Kalender,
   Aufgaben, Memo, Routinen und Abgleich; Symbole als dunkle Scheibe
   mit hellem Bildzeichen; keine Unterzeile unter den Apps.
   Projekte, Ziele und Listen sind keine eigenen Apps — sie liegen im
   Memo und sind Kategorien der Aufgaben.
   ============================================================ */
function palmTest() {
  console.log('\n11. Übersicht wie am Palm');
  if (!CL) { return; }
  frisch();
  CL.zeichne();
  const h = inhalt();
  pruefe(JSON.stringify(CL.CL_APPS.map(a => a.id)) === '["kalender","aufgaben","memo","routinen","abgleich"]',
    'genau fünf Apps: Kalender, Aufgaben, Memo, Routinen, Abgleich');
  pruefe(!/oeffne\('(projekte|ziele|listen|woche)'\)/.test(h), 'keine eigenen Apps für Projekte, Ziele, Listen oder Woche');
  pruefe(!/unterz/.test(h) && !/unterz/.test(QUELLE), 'keine Unterzeile unter den Apps');
  const syms = (h.match(/<span class="sym"><svg viewBox="0 0 64 64"[^>]*><circle cx="32" cy="32" r="30" fill="#3B4433"/g) || []).length;
  pruefe(syms === 5, 'jede App hat ein Symbol als dunkle runde Scheibe (' + syms + '/5)');
  pruefe(CL.CL_APPS.every(a => CL.CL_BILD[a.id] && CL.CL_BILD[a.id].length > 40), 'zu jeder App gibt es ein eigenes Bildzeichen');
  pruefe(!/[▦◫☑◎◇≡✎↻]<span|"sym">[▦◫☑◎◇≡✎↻⇅]/.test(h), 'keine Schriftzeichen mehr als Symbol');
  CL.oeffne('memo');
  pruefe(/class="gross"><svg/.test(inhalt()), 'auch die Seite einer späteren App zeigt das Symbol');
  CL.oeffne('uebersicht');
}

(async function () {
  try { await terminTest(); } catch (e) { fail('Termine holen warf: ' + e.message); }
  try { uebersichtTest(); } catch (e) { fail('Übersicht warf: ' + e.message); }
  try { bedienTest(); } catch (e) { fail('Bedienen warf: ' + e.message); }
  try { verbindungTest(); } catch (e) { fail('Verbindung warf: ' + e.message); }
  swTest();
  schriftTest();
  palmTest();

  /* ============================================================
     ERGEBNIS
     ============================================================ */
  console.log('\nERGEBNIS: ' + anzOk + ' ok, ' + anzFail + ' fehlgeschlagen, ' + anzWarn + ' Warnungen');
  process.exit(anzFail ? 1 : 0);
})();
