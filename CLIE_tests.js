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
    + 'clearInterval fetch Blob URL new fehler fertig isFinite').split(' '));
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
    'merkeTermin', 'praktischGanztags', 'titelOhneArt', 'terminKontextUeber', 'termineFuerTag',
    'aufgabeFaelligAn', 'faelligAn', 'istErledigtAn', 'wiederholungSetzen', 'aufgabeZeitAn', 'wochenIndex', 'monatsIndex', 'monatsende'];
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
  pruefe(/calendar\.events/.test(CL.SCOPES), 'seit 0.2 auch das Schreiben von Terminen (calendar.events)');
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
  /* alsText stempelt die Uhrzeit hinein — die darf sich unterscheiden. */
  const ohneZeit = () => CL.alsText().replace(/"gespeichert": "[^"]*"/, '');
  const vorher = ohneZeit();
  const erg = await CL.clTermineHolen(false);
  pruefe(erg === true && CL.kalenderStand, 'die Termine werden geholt');
  pruefe(!abrufe.some(a => /calendars\/x\//.test(a)), 'abgewählte Kalender werden nicht gelesen');
  const t = (CL.termineNachTag[heute] || []);
  pruefe(t.length === 1 && t[0].titel === 'Rückruf Becker' && t[0].kontext === 'beruflich', 'abgesagte fallen weg, der Kontext kommt vom Kalender');
  pruefe(ohneZeit() === vorher, 'die Termine landen nicht in der workbench.json');
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
  pruefe((h.match(/class="app"/g) || []).length === 8, 'acht Apps im Raster');
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
  CL.oeffne('routinen');
  pruefe(CL.document.getElementById('reiter').textContent === 'Routinen' && !/kommt mit CLIE/.test(inhalt()),
    'seit 0.5 sind alle Apps fertig — keine zeigt mehr „kommt mit …“');
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
   Grund: Gewünscht ist die Reduktion des Palm (0.1.3): Kalender,
   Aufgaben, Memo, Routinen, dazu Einkauf und Rechner (0.1.4),
   Checklisten (0.4) und Abgleich; Symbole als dunkle Scheibe
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
  pruefe(JSON.stringify(CL.CL_APPS.map(a => a.id)) === '["kalender","aufgaben","memo","checklisten","routinen","einkauf","rechner","abgleich"]',
    'genau acht Apps: Kalender, Aufgaben, Memo, Checklisten, Routinen, Einkauf, Rechner, Abgleich');
  pruefe(!/oeffne\('(projekte|ziele|listen|woche)'\)/.test(h), 'keine eigenen Apps für Projekte, Ziele, Listen oder Woche');
  pruefe(!/unterz/.test(h) && !/unterz/.test(QUELLE), 'keine Unterzeile unter den Apps');
  const syms = (h.match(/<span class="sym"><svg viewBox="0 0 64 64"[^>]*><circle cx="32" cy="32" r="30" fill="#3B4433"/g) || []).length;
  pruefe(syms === 8, 'jede App hat ein Symbol als dunkle runde Scheibe (' + syms + '/8)');
  pruefe(CL.CL_APPS.every(a => CL.CL_BILD[a.id] && CL.CL_BILD[a.id].length > 40), 'zu jeder App gibt es ein eigenes Bildzeichen');
  pruefe(!/[▦◫☑◎◇≡✎↻]<span|"sym">[▦◫☑◎◇≡✎↻⇅]/.test(h), 'keine Schriftzeichen mehr als Symbol');
  pruefe(CL.CL_APPS.every(a => a.stufe === ''), 'keine App ist mehr als „kommt noch“ gekennzeichnet');
  CL.oeffne('uebersicht');
}

/* ============================================================
   12. Rechner
   Grund: Ein Rechner, der falsch rechnet, ist schlimmer als keiner.
   Geprüft werden Grundrechenarten, Punkt vor Kette (wie am Palm:
   der Reihe nach), Prozent, Speicher, Division durch null,
   Rundungsreste und die deutsche Schreibweise.
   ============================================================ */
function rechnerTest() {
  console.log('\n12. Rechner');
  if (!CL) { return; }
  frisch();
  const tippe = (folge) => { CL.rtTaste('C'); folge.split(' ').forEach(t => CL.rtTaste(t)); return CL.rt.anzeige; };
  pruefe(tippe('2 4 9 , 9 0 * 3 =') === '749,7', '249,90 × 3 = 749,7 — mit Komma');
  pruefe(tippe('0 , 1 + 0 , 2 =') === '0,3', '0,1 + 0,2 = 0,3 — ohne Rundungsrest');
  pruefe(tippe('7 / 0 =') === 'Fehler' && CL.rt.fehler, 'durch null ergibt „Fehler“');
  CL.rtTaste('5');
  pruefe(CL.rt.anzeige === 'Fehler', 'nach einem Fehler hilft nur C');
  pruefe(tippe('2 + 3 * 4 =') === '20', 'der Reihe nach gerechnet wie am Palm: 2 + 3 × 4 = 20');
  pruefe(tippe('2 0 0 + 1 0 % =') === '220', '200 + 10 % = 220');
  pruefe(tippe('2 0 0 * 1 0 % =') === '20', '200 × 10 % = 20');
  pruefe(tippe('5 ± - 3 =') === '-8', 'Vorzeichen: −5 − 3 = −8');
  pruefe(tippe('1 2 3 zurueck') === '12', 'die Rücktaste löscht die letzte Ziffer');
  CL.rtTaste('C'); CL.rtTaste('MC');
  tippe('1 0 M+'); tippe('5 M+'); tippe('3 M-');
  pruefe(CL.rt.speicher === 12 && /"speicher":12/.test(CL.__ablage['clie-rechner'] || ''), 'Speicher M+ / M− rechnet und bleibt auf dem Gerät');
  tippe('MR');
  pruefe(CL.rt.anzeige === '12', 'MR holt den Speicher');
  pruefe(CL.rt.verlauf.indexOf('-5 − 3 = -8') >= 0, 'Rechnungen landen im Verlauf („-5 − 3 = -8“)');
  pruefe(CL.rt.verlauf.length <= 20, 'der Verlauf hat höchstens 20 Einträge');
  const vorher = CL.alsText().replace(/"gespeichert": "[^"]*"/, '');
  tippe('9 + 1 =');
  pruefe(CL.alsText().replace(/"gespeichert": "[^"]*"/, '') === vorher, 'der Rechner schreibt nichts in die workbench.json');
  CL.oeffne('rechner');
  const h = inhalt();
  pruefe(/rtTaste\('='\)/.test(h) && /rtTaste\('M\+'\)/.test(h) && (h.match(/class="taste[ "]/g) || []).length === 24, 'der Rechner zeigt 24 Tasten');
  CL.rtVerlaufUm();
  pruefe(/rt-verlauf/.test(inhalt()) && /9 \+ 1 = 10/.test(inhalt()), '„Verlauf…“ zeigt die letzten Rechnungen');
  CL.rtVerlaufUm();
  let gedrueckt = false;
  CL.tasteGlobal({ key: '7', preventDefault() { gedrueckt = true; } });
  pruefe(gedrueckt && /7$/.test(CL.rt.anzeige), 'am PC tippt die Tastatur mit');
  CL.oeffne('uebersicht');
}

/* ============================================================
   13. Einkauf: geteilte Keep-Notiz
   Grund: Keep hat für normale Google-Konten keine Schnittstelle.
   CLIE öffnet nur die gewählte Notiz — und darf dabei keine
   fremden Adressen öffnen.
   ============================================================ */
function einkaufTest() {
  console.log('\n13. Einkauf');
  if (!CL) { return; }
  frisch();
  const geoeffnet = [];
  CL.open = function (u) { geoeffnet.push(u); return {}; };
  CL.oeffne('einkauf');
  pruefe(CL.cl.aufklapp === 'einkauf' && /einkaufFeld/.test(CL.document.getElementById('aufklapp').innerHTML) && !geoeffnet.length,
    'ohne Verknüpfung fragt Einkauf nach dem Link');
  pruefe(CL.cl.app === 'uebersicht', 'Einkauf ist keine eigene Seite');
  CL.document.getElementById('einkaufFeld').value = 'https://boese.example/keep.google.com';
  CL.einkaufSpeichern();
  pruefe(!CL.DB.einstellungen.clieEinkauf && CL.cl.aufklapp === 'einkauf', 'fremde Adressen werden abgelehnt');
  CL.document.getElementById('einkaufFeld').value = 'javascript:alert(1)';
  CL.einkaufSpeichern();
  pruefe(!CL.DB.einstellungen.clieEinkauf, 'auch javascript:-Adressen');
  const vorStempel = CL.DB.einstellungen.stempel || 0;
  CL.document.getElementById('einkaufFeld').value = '  https://keep.google.com/#NOTE/abc123  ';
  CL.einkaufSpeichern();
  pruefe(CL.DB.einstellungen.clieEinkauf === 'https://keep.google.com/#NOTE/abc123' && CL.cl.aufklapp === '',
    'ein Keep-Link wird gespeichert (ohne Leerzeichen)');
  pruefe(CL.DB.einstellungen.stempel >= vorStempel && CL.DB.einstellungen.stempel > 0, 'der Stempel der Einstellungen wird gesetzt — so kommt der Link auf die anderen Geräte');
  CL.oeffne('einkauf');
  pruefe(geoeffnet[0] === 'https://keep.google.com/#NOTE/abc123' && CL.cl.aufklapp === '', 'danach öffnet Einkauf direkt die Notiz');
  /* Fehler aus 0.1.4-Entwurf: mit „noopener“ liefert window.open immer null — CLIE ersetzte sich dann selbst durch Keep. */
  pruefe(!/window\.open\([^)]*noopener/.test(SKRIPT) && !/location\.href = link/.test(SKRIPT),
    'Einkauf öffnet ein neues Fenster und ersetzt nie CLIE selbst');
  CL.open = function (u) { geoeffnet.push(u); return null; };
  CL.oeffne('einkauf');
  pruefe(CL.location.href === 'file:///test' && /Pop-ups/.test(CL.document.getElementById('toastText').textContent),
    'blockiert der Browser das Fenster, bleibt CLIE offen und sagt es');
  CL.open = function (u) { geoeffnet.push(u); return {}; };
  geoeffnet.length = 1;
  CL.DB.einstellungen.clieEinkauf = 'https://anders.example/';
  CL.oeffne('einkauf');
  pruefe(geoeffnet.length === 1 && CL.cl.aufklapp === 'einkauf', 'ein untergeschobener fremder Link (etwa per Abgleich) wird nicht geöffnet');
  CL.aufklappZu();
  CL.menueUm();
  pruefe(/menueWahl\('einkauf'\)/.test(CL.document.getElementById('aufklapp').innerHTML), 'im Menü: „Einkauf verknüpfen…“');
  CL.aufklappZu();
  CL.DB.einstellungen.clieEinkauf = 'https://keep.google.com/x" onmouseover="alert(1)';
  pruefe(!/onmouseover="alert/.test(CL.einkaufDialogHtml()), 'der Link wird im Fenster maskiert');
}

/* ============================================================
   14. Kalender: Tag, Woche, Monat
   Grund: Der Kalender zeigt Daten aus zwei Quellen — Google und die
   workbench.json. Abhaken muss in der Seite ankommen, Routinen müssen
   an denselben Tagen stehen wie in der Workbench, und Beruf/Privat
   muss beides filtern.
   ============================================================ */
function kalenderTest() {
  console.log('\n14. Kalender: Tag, Woche, Monat');
  if (!CL) { return; }
  frisch();
  const heute = CL.isoDatum();
  const wt = CL.ausIso(heute).getDay();
  CL.DB.projekte.push({ id: 'p1', name: 'Büro', flaeche: '[] Offering beschreiben\n[] Rechnung prüfen', status: 'laufend', kontext: 'beruflich', geaendert: 1 });
  CL.DB.tage.push({ id: 'tag-' + heute, datum: heute, text: '[] Offering beschreiben\n[] Rechnung prüfen\nNur ein Gedanke', geaendert: 1,
    eintraege: [{ id: 'e1', abschnitt: 'h', text: 'Offering beschreiben', quelle: 'p1', erledigt: false, zeit: '11:00' },
                { id: 'e2', abschnitt: 'h', text: 'Rechnung prüfen', quelle: 'p1', erledigt: false }] });
  CL.DB.aufgaben.push({ id: 'r1', titel: 'Oskar laufen lassen', wiederholung: { takt: 'woche', tage: [wt], intervall: 1 }, kontext: 'privat', geaendert: 1 });
  CL.DB.aufgaben.push({ id: 'r2', titel: 'Tabletten', wiederholung: { takt: 'woche', tage: [wt], intervall: 1 }, uhrzeit: '07:30', kontext: 'privat', geaendert: 1 });
  CL.DB.aufgaben.push({ id: 'r3', titel: 'Morgen erst', wiederholung: { takt: 'woche', tage: [(wt + 1) % 7], intervall: 1 }, geaendert: 1 });
  CL.DB.aufgaben.push({ id: 'r4', titel: 'Pausiert', wiederholung: { takt: 'woche', tage: [wt], intervall: 1 }, pausiert: true, geaendert: 1 });
  CL.termineNachTag[heute] = [
    { id: 't1', zeit: '16:30', bis: '17:00', titel: 'Rückruf Becker', kontext: 'beruflich', kalId: 'buero' },
    { id: 't2', zeit: '', bis: '', titel: 'Geburtstag Oma', ganztags: true, kontext: 'privat', kalId: 'privat' },
    { id: 't3', zeit: '05:15', bis: '05:45', titel: 'Frühflug', kontext: 'privat', kalId: 'privat' }];
  CL.oeffne('kalender');
  let h = inhalt();
  pruefe(CL.document.getElementById('reiter').textContent === CL.clWt(heute) + ' ' + CL.clKurzDatum(heute), 'der Reiter zeigt den Tag');
  pruefe(/◆ Geburtstag Oma/.test(h) && /Rückruf Becker/.test(h), 'Termine und Ganztägiges stehen im Tag');
  pruefe((h.match(/class="z">\d+:00</g) || []).length >= 10 && /class="z">5:15</.test(h) && /class="z">7:30</.test(h),
    'Stunden 8–18 immer, frühere Termine und Routinen mit Uhrzeit kommen dazu');
  pruefe(/class="z">11:00<\/span><span class="t"><button type="button" class="k" onclick="clTagZeileUm/.test(h),
    'eine mit Uhrzeit eingeplante Aufgabe steht an ihrer Stunde, mit Kästchen');
  const vorg = h.slice(h.indexOf('>Vorgenommen<'));
  pruefe(/Rechnung prüfen/.test(vorg) && !/Offering beschreiben/.test(vorg) && /Nur ein Gedanke/.test(vorg) && /class="q">Büro</.test(vorg),
    'Vorgenommen zeigt Aufgaben ohne Uhrzeit mit ihrer Seite, dazu freien Text');
  const rout = h.slice(h.indexOf('>Routinen<'));
  pruefe(/Oskar laufen lassen/.test(rout) && !/Tabletten/.test(rout) && !/Morgen erst/.test(h) && !/Pausiert/.test(h),
    'Routinen: fällige ohne Uhrzeit unten, mit Uhrzeit im Raster, nicht fällige und pausierte gar nicht');

  CL.clTagZeileUm(heute, 1);
  pruefe(/\[x\] Rechnung prüfen/.test(CL.DB.tage[0].text) && /\[x\] Rechnung prüfen/.test(CL.DB.projekte[0].flaeche),
    'Abhaken im Tag hakt auch in der Seite ab');
  pruefe(!/Rechnung prüfen/.test(inhalt().slice(inhalt().indexOf('>Vorgenommen<'))) && /1 erledigt · zeigen/.test(inhalt()),
    'Erledigtes verschwindet aus dem Tag — „1 erledigt · zeigen“');
  CL.clErlUm();
  pruefe(/class="aufg erl"/.test(inhalt()), '„zeigen“ holt es durchgestrichen zurück');
  CL.clErlUm();
  CL.clRoutineUm('r1', heute);
  const r1 = CL.DB.aufgaben[0];
  pruefe(CL.istErledigtAn(r1, heute) && r1.geaendert > 1, 'eine Routine wird für heute abgehakt — wie in der Workbench');
  CL.clRoutineUm('r1', heute);
  pruefe(!CL.istErledigtAn(r1, heute), 'und wieder zurück');

  CL.katSetzen('beruflich');
  h = inhalt();
  pruefe(/Rückruf Becker/.test(h) && !/Geburtstag Oma/.test(h) && !/Oskar laufen lassen/.test(h), 'Beruf zeigt nur berufliche Termine und Routinen');
  CL.katSetzen('privat');
  h = inhalt();
  pruefe(!/Rückruf Becker/.test(h) && !/Offering beschreiben/.test(h), 'Privat blendet berufliche Termine und Aufgaben aus beruflichen Seiten aus');
  CL.katSetzen('alle');

  CL.clBlaettern(1);
  pruefe(CL.clKalDatum() === CL.tagePlus(heute, 1) && /Morgen erst/.test(inhalt()), 'blättern: der nächste Tag mit seinen Routinen');
  CL.clBlaettern(-1);
  pruefe(CL.cl.kal.datum === '', 'zurück auf heute');

  const montag = CL.montagVon(heute);
  CL.DB.wochen.push({ id: 'kw-' + montag, montag: montag, geaendert: 1, eintraege: [],
    text: '## Bringt mich dauerhaft weiter\n[] CTS mit Testdaten\n[x] Workshop halten\n\n## Habe ich mich verpflichtet zu\n[] Angebot Statik' });
  CL.clKalAnsicht('woche');
  h = inhalt();
  pruefe(/^KW \d+$/.test(CL.document.getElementById('reiter').textContent) && (h.match(/class="wtag/g) || []).length === 7, 'die Woche: KW im Reiter, sieben Tage');
  pruefe(/>Bringt mich dauerhaft weiter</.test(h) && /class="aufg erl"/.test(h) && /clWocheZeileUm/.test(h), 'darunter die Abschnitte der Woche, abhakbar');
  CL.clWocheZeileUm(montag, 5);
  pruefe(/\[x\] Angebot Statik/.test(CL.DB.wochen[0].text), 'Abhaken in der Woche landet in der Woche');
  CL.clKalAnsicht('monat');
  h = inhalt();
  pruefe((h.match(/class="mt/g) || []).length >= 28 && /class="mt[^"]* heute/.test(h), 'der Monat: alle Tage, heute hervorgehoben');
  pruefe(/◆/.test(h), 'Ganztägiges als Raute');
  CL.clKalGehe(heute, 'tag');
  pruefe(CL.cl.kal.ansicht === 'tag', 'ein Tipp auf einen Tag öffnet ihn');
  const fuss = CL.document.getElementById('fuss').innerHTML;
  pruefe(/terminNeu/.test(fuss) && /clGeheZuOeffnen/.test(fuss) && /clKalAnsicht\('monat'\)/.test(fuss), 'unten: Neu, Gehe zu, T / W / M');
  CL.clKalGehe('kaputt', 'woche');
  pruefe(CL.cl.kal.ansicht === 'tag', 'ein ungültiges Datum wird ignoriert');
  CL.oeffne('rechner');
  pruefe(CL.document.getElementById('fuss').innerHTML === '', 'andere Apps haben keine Kalender-Knöpfe');
  CL.oeffne('uebersicht');
}

/* ============================================================
   15. Termine schreiben: direkt im Google-Kalender
   Grund: Ein falsch geschickter Termin landet in deinem echten
   Kalender. Geprüft wird, was an Google geht — Adresse, Methode,
   Zeitangaben — und dass ohne Verbindung nichts verloren geht.
   ============================================================ */
async function schreibTest() {
  console.log('\n15. Termine schreiben');
  if (!CL) { return; }
  frisch();
  const heute = CL.isoDatum();
  const anfragen = [];
  CL.fetch = function (adresse, o) {
    anfragen.push({ adresse, o: o || {} });
    if (/minAccessRole=writer/.test(adresse)) {
      return Promise.resolve({ ok: true, status: 200, url: adresse, json() { return Promise.resolve({ items: [{ id: 'privat@x', summary: 'Privat', primary: true }, { id: 'buero@x', summary: 'Büro' }] }); } });
    }
    return Promise.resolve({ ok: true, status: 200, url: adresse, json() { return Promise.resolve({ items: [] }); } });
  };
  CL.terminNeu(heute, '15:00');
  pruefe(!anfragen.length && /Verbindung/.test(CL.document.getElementById('toastText').textContent), 'ohne Anmeldung: kein Fenster, ein Hinweis');
  CL.zugriffToken = 'test'; CL.tokenAblauf = Date.now() + 3600000;
  CL.DB.einstellungen.kalender = [{ id: 'buero@x', kontext: 'beruflich' }];
  CL.katSetzen('beruflich');
  CL.terminNeu(heute, '15:00');
  await warte(); await warte();
  let f = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(CL.cl.aufklapp === 'termin' && /Neuer Termin/.test(f) && /value="15:00"/.test(f) && /value="16:00"/.test(f), '„Neu“ schlägt die getippte Stunde vor, eine Stunde lang');
  pruefe(/<option value="buero@x" selected>/.test(f), 'vorgewählt ist ein Kalender, der zu Beruf passt');
  const feld = (id, w) => { CL.document.getElementById(id).value = w; };
  feld('terminTitel', ''); feld('terminDatum', heute); feld('terminVon', '15:00'); feld('terminBis', '16:00'); feld('terminKal', 'buero@x');
  feld('terminOrt', ''); feld('terminNotiz', '');
  CL.document.getElementById('terminGanz').checked = false;
  const n = anfragen.length;
  CL.terminSpeichern();
  pruefe(anfragen.length === n && /Titel/.test(CL.document.getElementById('toastText').textContent), 'ohne Titel wird nichts geschickt');
  feld('terminTitel', 'Zahnarzt'); feld('terminBis', '14:00');
  CL.terminSpeichern();
  pruefe(anfragen.length === n && /Ende/.test(CL.document.getElementById('toastText').textContent), 'Ende vor Beginn wird abgefangen');
  feld('terminBis', '16:00'); feld('terminOrt', 'Fürth');
  await CL.terminSpeichern();
  const post = anfragen.filter(a => a.o.method === 'POST')[0];
  const k = post ? JSON.parse(post.o.body) : {};
  pruefe(post && /calendars\/buero%40x\/events$/.test(post.adresse), 'POST an den gewählten Kalender');
  pruefe(k.summary === 'Zahnarzt' && k.start.dateTime === heute + 'T15:00:00' && k.end.dateTime === heute + 'T16:00:00' && k.start.timeZone && k.location === 'Fürth',
    'Titel, Beginn, Ende, Zeitzone und Ort gehen mit');
  pruefe(post && post.o.headers['Content-Type'] === 'application/json' && /^Bearer /.test(post.o.headers.Authorization), 'mit Anmeldung und als JSON');
  pruefe(CL.cl.aufklapp === '' && CL.__ablage['clie-kalender-zuletzt'] === 'buero@x', 'danach schließt das Fenster, der Kalender wird gemerkt');

  CL.terminNeu(heute, '09:00');
  await warte(); await warte();
  feld('terminTitel', 'Urlaub'); feld('terminDatum', heute); feld('terminKal', 'privat@x'); feld('terminOrt', ''); feld('terminNotiz', '');
  CL.document.getElementById('terminGanz').checked = true;
  await CL.terminSpeichern();
  const ganz = JSON.parse(anfragen.filter(a => a.o.method === 'POST').pop().o.body);
  pruefe(ganz.start.date === heute && ganz.end.date === CL.tagePlus(heute, 1), 'ganztägig: Ende ist bei Google der Folgetag');

  CL.termineNachTag[heute] = [{ id: 'ev 1', zeit: '16:30', bis: '17:00', titel: 'Becker', rohTitel: 'Becker #Telefon', kontext: 'beruflich', kalId: 'buero@x', serieId: 's1' }];
  CL.terminZeigen(heute, 'ev 1');
  f = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(/Ändern/.test(f) && /Löschen…/.test(f) && /Serientermin/.test(f), 'Details zeigen Ändern, Löschen und den Hinweis zur Serie');
  CL.terminAendern();
  f = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(/Termin ändern/.test(f) && /value="Becker #Telefon"/.test(f), 'Ändern übernimmt den Titel samt Kürzel — es geht nichts verloren');
  feld('terminTitel', 'Becker #Telefon'); feld('terminDatum', heute); feld('terminVon', '17:00'); feld('terminBis', '17:30');
  CL.document.getElementById('terminGanz').checked = false;
  await CL.terminSpeichern();
  const patch = anfragen.filter(a => a.o.method === 'PATCH')[0];
  pruefe(patch && /calendars\/buero%40x\/events\/ev%201$/.test(patch.adresse) && JSON.parse(patch.o.body).start.dateTime === heute + 'T17:00:00',
    'Ändern schickt PATCH an genau diesen Termin');
  const becker = () => { CL.termineNachTag[heute] = [{ id: 'ev 1', zeit: '17:00', bis: '17:30', titel: 'Becker', kontext: 'beruflich', kalId: 'buero@x' }]; };
  becker();
  CL.terminZeigen(heute, 'ev 1');
  CL.terminLoeschenFragen();
  pruefe(/wirklich/.test(CL.document.getElementById('aufklapp').innerHTML) && !anfragen.some(a => a.o.method === 'DELETE'), 'Löschen fragt erst nach');
  await CL.terminLoeschen();
  pruefe(anfragen.some(a => a.o.method === 'DELETE' && /events\/ev%201$/.test(a.adresse)), 'dann DELETE an genau diesen Termin');

  /* Ohne Schreibrecht (Anmeldung noch aus 0.1): neu verbinden */
  let angemeldet = 0;
  const altAnmelden = CL.anmelden;
  CL.anmelden = function () { angemeldet++; return Promise.resolve(false); };
  CL.fetch = function (adresse) { return Promise.resolve({ ok: false, status: 403, url: adresse, text() { return Promise.resolve('insufficientPermissions'); } }); };
  becker();
  CL.terminZeigen(heute, 'ev 1');
  await CL.terminLoeschen();
  pruefe(angemeldet === 1 && /neu verbinden/.test(CL.document.getElementById('toastText').textContent), 'fehlt das Schreibrecht, fragt CLIE einmal neu bei Google an');
  CL.anmelden = altAnmelden;
  CL.fetch = function () { return Promise.reject(new Error('kein Netz im Test')); };
  CL.katSetzen('alle');
}

/* ============================================================
   16. Lesbare Ziffern
   Grund: In der Pixelschrift sah 5 wie S, 2 wie Z und 7 wie ⌐ aus —
   die Uhrzeit „12:58“ las sich wie „12:S8“ (0.2.0). Seit 0.2.1 kommen
   0–9 und „:“ aus VT323, eingebettet, damit es auch ohne Netz gilt.
   ============================================================ */
function zifferTest() {
  console.log('\n16. Lesbare Ziffern');
  const css = (QUELLE.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
  const ff = css.match(/@font-face\{font-family:"CLIE Ziffern";src:url\(data:font\/woff2;base64,([A-Za-z0-9+\/=]+)\)[^}]*unicode-range:U\+0030-0039,U\+003A/);
  pruefe(!!ff, 'die Ziffernschrift ist eingebettet und gilt nur für 0–9 und „:“');
  pruefe(ff && ff[1].length > 500 && ff[1].length < 20000, 'eingebettet als kleine Datei (' + (ff ? ff[1].length : 0) + ' Zeichen)');
  pruefe(ff && Buffer.from(ff[1], 'base64').slice(0, 4).toString('latin1') === 'wOF2', 'es ist eine gültige WOFF2-Schrift');
  pruefe(/body\{[^}]*font-family:"CLIE Ziffern","Pixelify Sans"/.test(css), 'sie steht vor der Pixelschrift — für alle Texte der App');
  pruefe(!/__ZIFFERN__|__ZGROESSE__/.test(QUELLE), 'keine Platzhalter des Bauskripts übrig');
}

/* ============================================================
   17. Zeitklammern und Wochenblöcke
   Grund (0.2.2): Stunden, die mitten in einem Termin liegen, sollen im
   Tag nicht als leere Zeile erscheinen (9–11 Uhr: kein 10:00). Lange
   Termine bekommen links eine Klammer, Überschneidungen eine zweite.
   Die Woche als Blöcke zeigt keine Titel und kennt Mo–Fr und Mo–So.
   ============================================================ */
function bloeckeTest() {
  console.log('\n17. Zeitklammern und Wochenblöcke');
  if (!CL) { return; }
  frisch();
  const heute = CL.isoDatum();
  CL.termineNachTag[heute] = [
    { id: 'a', zeit: '09:00', bis: '11:00', titel: 'Workshop', kontext: 'beruflich', kalId: 'k' },
    { id: 'b', zeit: '10:30', bis: '12:00', titel: 'Parallel', kontext: 'beruflich', kalId: 'k' },
    { id: 'c', zeit: '13:00', bis: '13:30', titel: 'Kurz', kontext: 'beruflich', kalId: 'k' },
    { id: 'd', zeit: '15:00', bis: '18:00', titel: 'Lang', kontext: 'beruflich', kalId: 'k' }];
  CL.oeffne('kalender');
  CL.clKalAnsicht('tag');
  const h = inhalt();
  const stunden = (h.match(/class="z">(\d+:\d+)</g) || []).map(x => x.replace(/class="z">|</g, ''));
  pruefe(stunden.indexOf('10:00') < 0 && stunden.indexOf('16:00') < 0 && stunden.indexOf('17:00') < 0,
    'leere Stunden mitten in einem Termin entfallen (10:00, 16:00, 17:00) — ' + stunden.join(' '));
  pruefe(stunden.indexOf('11:00') < 0 && stunden.indexOf('12:00') >= 0 && stunden.indexOf('14:00') >= 0 && stunden.indexOf('18:00') >= 0,
    'Stunden am Ende eines Termins und freie Stunden dazwischen bleiben');
  const reihen = h.split('<div class="std').slice(1);
  const zeile = (zeit) => reihen.filter(r => r.indexOf('class="z">' + zeit + '<') >= 0)[0] || '';
  pruefe(/class="kl"><i class="oben"><\/i>/.test(zeile('9:00')) && /<i class="unten"><\/i>/.test(zeile('10:30')), 'Workshop 9–11: Klammer von 9:00 bis 10:30');
  pruefe(/<i class="(oben|einzel)"><\/i>/.test(zeile('10:30').replace(/<i class="unten"><\/i>/, '')) || /<i class="unten"><\/i><i class="oben"><\/i>/.test(zeile('10:30')),
    'der parallele Termin bekommt eine zweite Klammer daneben');
  pruefe(/class="kl"><i class=""><\/i><i class=""><\/i>/.test(zeile('13:00')), 'kurze Termine (unter 1 Std.) ohne Klammer');
  pruefe(/<i class="einzel"><\/i>/.test(zeile('15:00')), 'ein langer Termin ohne weitere Zeilen bekommt eine einzelne Klammer');

  CL.clKalAnsicht('bloecke');
  let b = inhalt();
  pruefe(/^KW \d+$/.test(CL.document.getElementById('reiter').textContent), 'Blöcke: KW im Reiter');
  pruefe((b.match(/class="wb-blk/g) || []).length === 4, 'jeder Termin ist ein Block');
  pruefe(!/Workshop|Parallel|Lang</.test(b.replace(/aria-label="[^"]*"/g, '')), 'ohne Titel in den Blöcken (nur für Vorlesehilfen)');
  pruefe(/terminZeigen\('[^']+','a'\)/.test(b), 'ein Tipp auf einen Block öffnet den Termin');
  CL.clWocheTageSetzen(5);
  b = inhalt();
  pruefe(CL.cl.kal.tage === 5 && (b.match(/class="kz[^"]*" onclick/g) || []).length === 5 && CL.__ablage['clie-woche-tage'] === '5', 'Mo–Fr: fünf Spalten, gemerkt');
  CL.clWocheTageSetzen(7);
  pruefe((inhalt().match(/class="kz[^"]*" onclick/g) || []).length === 7, 'Mo–So: sieben Spalten');
  const vor = CL.clKalDatum();
  CL.clBlaettern(1);
  pruefe(CL.clKalDatum() === CL.tagePlus(vor, 7), 'Blättern springt eine Woche');
  pruefe(/clKalAnsicht\('bloecke'\)/.test(CL.document.getElementById('fuss').innerHTML), 'unten der Knopf ▥');
  CL.clKalGehe(heute, 'tag');
  CL.oeffne('uebersicht');
}

/* ============================================================
   18. Aufgaben
   Grund: Aufgaben sind Zeilen in Seiten. Abhaken, Anlegen, Ändern,
   Verschieben, Einplanen und Löschen müssen Seite, Tag und Woche
   gemeinsam ändern — sonst zeigen CLIE und Workbench Verschiedenes.
   Neu ohne Liste darf nicht gehen; Ziele stehen nicht in der Auswahl.
   ============================================================ */
function aufgabenDaten() {
  frisch();
  CL.cl.auf.liste = ''; CL.cl.auf.frisch = {}; CL.cl.auf.erlZeigen = false; CL.cl.auf.fenster = null; CL.cl.auf.wahl = '';
  CL.DB.projekte.push({ id: 'p1', name: 'Büro', flaeche: '## Statik\n[] Angebot einholen\n[x] Pläne\nText dazu', status: 'laufend', kontext: 'beruflich', ordnung: 10, geaendert: 1 });
  CL.DB.projekte.push({ id: 'p2', name: 'Umbau', flaeche: '[] Fenster messen', status: 'laufend', kontext: 'privat', ordnung: 20, geaendert: 1 });
  CL.DB.projekte.push({ id: 'p3', name: 'Ruht', flaeche: '[] versteckt', status: 'ruht', kontext: 'privat', ordnung: 30, geaendert: 1 });
  CL.DB.projekte.push({ id: 'p4', name: 'Leer', flaeche: '[x] alles erledigt', status: 'laufend', kontext: 'privat', ordnung: 35, geaendert: 1 });
  CL.DB.ziele.push({ id: 'z1', name: 'Halbmarathon', flaeche: '[] 10 km laufen', status: 'laufend', kontext: 'privat', ordnung: 40, geaendert: 1 });
  CL.DB.themen.push({ id: 't1', name: 'Garten', text: '[] Laub\n[-] Teich', kontext: 'privat', ordnung: 50, geaendert: 1 });
  CL.DB.gedanken.push({ id: 'g1', titel: 'Notiz', text: '[] in einer Notiz', ordnung: 60, geaendert: 1 });
  CL.__ablage['clie-zuletzt'] = '[]';
}

function aufgabenTest() {
  console.log('\n18. Aufgaben');
  if (!CL) { return; }
  aufgabenDaten();
  const heute = CL.isoDatum();
  CL.oeffne('aufgaben');
  let h = inhalt();
  pruefe(/Angebot einholen/.test(h) && /Fenster messen/.test(h) && /Laub/.test(h) && /10 km laufen/.test(h),
    'alle offenen Aufgaben aus laufenden Projekten, Zielen und Listen');
  pruefe(!/versteckt/.test(h) && !/Pläne/.test(h) && !/Teich/.test(h) && !/in einer Notiz/.test(h),
    'nicht: Ruhendes, Erledigtes, nicht Relevantes, Notizen');
  pruefe(/class="q">Büro</.test(h), 'rechts steht, woher die Aufgabe kommt');
  CL.aufFilter('beruflich');
  pruefe(/Angebot einholen/.test(inhalt()) && !/Fenster messen/.test(inhalt()), 'der Filter Beruf zeigt nur berufliche Seiten');
  CL.aufFilter('alle');

  /* Auswahl oben rechts */
  CL.katUm();
  let a = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(CL.cl.aufklapp === 'liste' && /aufFilter\('beruflich'\)/.test(a) && /Alle Aufgaben/.test(a) && /Weitere/.test(a),
    'die Aufklappliste: Filter, Alle Aufgaben, Weitere…');
  CL.listenwahlOeffnen('filter');
  a = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(/Umbau/.test(a) && /Garten/.test(a) && !/Halbmarathon/.test(a) && !/Ruht/.test(a) && !/>◎ Leer/.test(a),
    '„Weitere…“: Projekte und Listen mit offenen Aufgaben — keine Ziele, nichts Ruhendes, nichts ohne Offenes');
  CL.listeGewaehlt('p2');
  pruefe(CL.cl.auf.liste === 'p2' && /Fenster messen/.test(inhalt()) && !/Angebot einholen/.test(inhalt()), 'eine Liste gewählt: nur ihre Aufgaben');
  pruefe(/▼ Umbau/.test(CL.document.getElementById('katKnopf').textContent), 'oben rechts steht die Liste');
  pruefe(JSON.parse(CL.__ablage['clie-zuletzt'])[0] === 'p2' && CL.__ablage['clie-aufgaben-liste'] === 'p2', 'zuletzt benutzt und die Wahl werden gemerkt');
  CL.katUm();
  pruefe(/Zuletzt benutzt/.test(CL.document.getElementById('aufklapp').innerHTML) && /aufListeSetzen\('p2'\)/.test(CL.document.getElementById('aufklapp').innerHTML),
    'die zuletzt benutzte Liste steht oben in der Auswahl');
  CL.aufListeSetzen('');

  /* Abhaken */
  CL.aufHaken('p2', 0);
  pruefe(/^\[x\] Fenster messen/.test(CL.DB.projekte[1].flaeche) && /class="aufg erl/.test(inhalt()), 'abhaken: in der Seite erledigt, bleibt kurz durchgestrichen stehen');
  CL.oeffne('uebersicht'); CL.oeffne('aufgaben');
  pruefe(!/Fenster messen/.test(inhalt()), 'nach dem Verlassen ist es weg');
  CL.aufErlUm();
  pruefe(/Fenster messen/.test(inhalt()) && /Pläne/.test(inhalt()), '„Erledigte“ zeigt es wieder');
  CL.aufErlUm();

  /* Neu: Liste ist Pflicht */
  CL.aufNeu();
  let f = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(/Neue Aufgabe/.test(f) && /id="aufOk" class="knopf voll" disabled/.test(f) && /bitte wählen/.test(f), 'Neu ohne Liste: OK ist gesperrt');
  CL.document.getElementById('aufText').value = 'Winterreifen';
  CL.aufSpeichern();
  pruefe(!/Winterreifen/.test(JSON.stringify(CL.DB)) && /Liste/.test(CL.document.getElementById('toastText').textContent), 'auch per Aufruf: ohne Liste wird nichts gespeichert');
  CL.listenwahlOeffnen('aufgabe');
  a = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(/Leer \(keine offenen\)/.test(a) && !/Halbmarathon/.test(a), 'bei Neu stehen alle laufenden Listen zur Wahl, auch ohne offene Aufgaben');
  CL.listeGewaehlt('t1');
  f = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(CL.cl.aufklapp === 'aufgabe' && /≡ Garten/.test(f) && /value="Winterreifen"/.test(f), 'zurück im Fenster: Liste gewählt, Getipptes noch da');
  CL.aufPlanSetzen('um');
  CL.document.getElementById('aufZeit').value = '15:00';
  CL.aufSpeichern();
  const garten = CL.DB.themen[0];
  pruefe(/\n\[\] Winterreifen$/.test(garten.text), 'die neue Aufgabe steht am Ende der Liste');
  const tag = CL.kpTagFinden(heute);
  const e = tag && tag.eintraege.filter(x => x.text === 'Winterreifen')[0];
  pruefe(e && e.quelle === 't1' && e.zeit === '15:00' && /\[\] Winterreifen/.test(tag.text), 'für heute um 15:00 eingeplant — im selben Tag wie die Workbench');
  pruefe(/<span class="heute">15:00<\/span>/.test(inhalt()) && inhalt().indexOf('Winterreifen') < inhalt().indexOf('Angebot einholen'),
    'Eingeplantes steht oben, mit Uhrzeit');
  CL.oeffne('kalender');
  pruefe(/class="z">15:00<\/span><span class="t"><button type="button" class="k" onclick="clTagZeileUm[^>]*><\/button><span class="tx">Winterreifen/.test(inhalt()),
    'und steht im Kalender an seiner Stunde');
  CL.oeffne('aufgaben');

  /* Details: Text ändern, verschieben, ausplanen */
  const nr = garten.text.split('\n').indexOf('[] Winterreifen');
  CL.aufDetails('t1', nr);
  f = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(/>Aufgabe</.test(f) && /heute um/.test(f) && /value="15:00"/.test(f) && /Im Memo zeigen/.test(f) && /Löschen/.test(f), 'Details zeigen Planung, Memo und Löschen');
  CL.document.getElementById('aufText').value = 'Winterreifen wechseln';
  CL.cl.auf.fenster.seite = 'p2';
  CL.cl.auf.fenster.plan = 'heute';
  CL.document.getElementById('aufZeit').value = '';
  CL.aufSpeichern();
  const umbau = CL.DB.projekte[1];
  const e2 = CL.kpTagFinden(heute).eintraege.filter(x => /Winterreifen/.test(x.text))[0];
  pruefe(!/Winterreifen/.test(garten.text) && /\n\[\] Winterreifen wechseln$/.test(umbau.flaeche), 'neuer Text und in die andere Liste verschoben');
  pruefe(e2 && e2.text === 'Winterreifen wechseln' && e2.quelle === 'p2' && !e2.zeit && /\[\] Winterreifen wechseln/.test(CL.kpTagFinden(heute).text),
    'die Planung zieht mit — jetzt „heute“ ohne Uhrzeit');
  const nr2 = umbau.flaeche.split('\n').indexOf('[] Winterreifen wechseln');
  CL.aufDetails('p2', nr2);
  CL.aufPlanSetzen('nicht');
  CL.aufSpeichern();
  pruefe(!/Winterreifen/.test(CL.kpTagFinden(heute).text) && !CL.kpTagFinden(heute).eintraege.some(x => /Winterreifen/.test(x.text)), '„nicht“ nimmt sie aus dem Tag');
  CL.aufDetails('p2', nr2);
  CL.aufLoeschenFragen();
  pruefe(/wirklich|löschen\?/.test(CL.document.getElementById('aufklapp').innerHTML) && /Winterreifen/.test(umbau.flaeche), 'Löschen fragt erst nach');
  CL.aufLoeschen();
  pruefe(!/Winterreifen/.test(umbau.flaeche), 'dann ist die Zeile aus der Seite weg');

  /* Auswahl per Tippen, zweiter Tipp öffnet Details */
  CL.aufTippen('p1', 1);
  pruefe(CL.cl.auf.wahl === 'p1|1' && /class="aufg gewaehlt"/.test(inhalt()) && CL.cl.aufklapp === '', 'erster Tipp wählt aus');
  CL.aufTippen('p1', 1);
  pruefe(CL.cl.aufklapp === 'aufgabe' && /value="Angebot einholen"/.test(CL.document.getElementById('aufklapp').innerHTML), 'zweiter Tipp öffnet die Details');
  CL.aufklappZu();
  CL.oeffne('uebersicht');
}

/* ============================================================
   19. Memo
   Grund: Im Memo liegen die Seiten selbst. Lesen, Abhaken und Schreiben
   ändern denselben Text wie die Workbench; beim Schreiben darf ein
   Abgleich im Hintergrund das Getippte nicht überschreiben.
   ============================================================ */
function memoTest() {
  console.log('\n19. Memo');
  if (!CL) { return; }
  aufgabenDaten();
  CL.DB.gedanken.push({ id: 'c1', titel: 'Packliste', text: '[] Zahnbürste', checkliste: 'vorlage', ordnung: 70, geaendert: 1 });
  CL.oeffne('memo');
  let h = inhalt();
  pruefe(/>Projekte</.test(h) && />Ziele</.test(h) && />Listen</.test(h) && />Notizen</.test(h), 'gruppiert: Projekte, Ziele, Listen, Notizen');
  pruefe(/Büro/.test(h) && /Halbmarathon/.test(h) && !/Ruht/.test(h) && !/Packliste/.test(h), 'laufende Seiten — nichts Ruhendes, keine Checklisten');
  CL.memoOeffnen('p1');
  h = inhalt();
  pruefe(/◎ Büro/.test(CL.document.getElementById('reiter').textContent), 'der Reiter zeigt die Seite');
  pruefe(/class="memo-h2">Statik</.test(h) && /class="aufg erl"/.test(h) && /class="memo-text">Text dazu</.test(h), 'Überschriften, erledigte Aufgaben und Text');
  CL.memoHaken('p1', 1);
  pruefe(/\[x\] Angebot einholen/.test(CL.DB.projekte[0].flaeche), 'abhaken im Memo');
  CL.memoSchreibenUm();
  pruefe(/id="memoFeld"/.test(inhalt()) && /Fertig/.test(CL.document.getElementById('fuss').innerHTML), '„Schreiben“ öffnet das Textfeld');
  const feld = CL.document.getElementById('memoFeld');
  feld.value = '## Statik\n[x] Angebot einholen\nneu'; feld.selectionStart = feld.value.length;
  CL.memoTextGetippt();
  pruefe(CL.DB.projekte[0].flaeche === '## Statik\n[x] Angebot einholen\nneu', 'das Getippte landet in der Seite');
  CL.memoZeichen('kasten');
  pruefe(/\n\[\] neu$/.test(CL.DB.projekte[0].flaeche), '[ ] macht die Zeile zur Aufgabe');
  const vorher = inhalt();
  CL.zeichne();
  pruefe(inhalt() === vorher, 'ein Neuzeichnen (etwa nach dem Abgleich) lässt das Textfeld in Ruhe');
  CL.memoSchreibenUm();
  pruefe(/class="aufg"/.test(inhalt()) && /neu/.test(inhalt()), '„Fertig“ zeigt die Seite wieder');

  CL.memoDetails();
  let f = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(/Details/.test(f) && /memoWahl\('zustand','ruht'\)/.test(f) && /Ende:/.test(f), 'Details eines Projekts: Name, Kategorie, Zustand, Ende');
  CL.document.getElementById('memoTitel').value = 'Büro neu';
  CL.document.getElementById('memoTermin').value = '2027-03-31';
  CL.memoWahl('zustand', 'ruht');
  CL.memoSpeichern();
  const p1 = CL.DB.projekte[0];
  pruefe(p1.name === 'Büro neu' && p1.ende === '2027-03-31' && p1.status === 'ruht', 'Name, Ende und Zustand werden gespeichert');
  pruefe(CL.cl.memo.id === '' && !/Büro neu/.test(inhalt()), 'eine ruhende Seite verschwindet aus der Liste');

  CL.memoNeu();
  CL.memoWahl('art', 'liste');
  CL.document.getElementById('memoTitel').value = '';
  CL.memoSpeichern();
  const zahl = CL.DB.themen.length;
  pruefe(/Namen/.test(CL.document.getElementById('toastText').textContent), 'ohne Namen kein neues Memo');
  CL.document.getElementById('memoTitel').value = 'Geschenkideen';
  CL.memoWahl('kontext', 'privat');
  CL.memoSpeichern();
  const neu = CL.DB.themen[CL.DB.themen.length - 1];
  pruefe(CL.DB.themen.length === zahl + 1 && neu.name === 'Geschenkideen' && neu.kontext === 'privat', 'Neu legt eine Liste an — in der Workbench unter „themen“');
  pruefe(CL.cl.memo.id === neu.id && CL.cl.memo.schreiben, 'und öffnet sie gleich zum Schreiben');
  CL.memoSchreibenUm();

  CL.memoZeile('t1', 0);
  pruefe(CL.cl.app === 'memo' && CL.cl.memo.id === 't1' && /class="aufg hervor"/.test(inhalt()), '„Im Memo zeigen“ öffnet die Seite an der Zeile');
  CL.oeffne('uebersicht');
  CL.oeffne('memo');
  pruefe(CL.cl.memo.id === '' && /memoOeffnen/.test(inhalt()), 'von der Übersicht aus beginnt Memo mit der Liste');
  CL.oeffne('uebersicht');
}

/* ============================================================
   20. Checklisten
   Grund: Vorlagen dürfen beim Starten nie verändert werden; laufende
   Checklisten starten leer. Gespeichert wird als gekennzeichnete
   Notiz — sie darf weder im Memo noch in den Aufgaben auftauchen, und
   Löschen braucht einen Löschvermerk, sonst käme sie per Abgleich zurück.
   ============================================================ */
function checklistenTest() {
  console.log('\n20. Checklisten');
  if (!CL) { return; }
  frisch();
  CL.cl.cls.id = ''; CL.cl.cls.schreiben = false; CL.cl.cls.fenster = null;
  CL.DB.gedanken.push({ id: 'v1', titel: 'Packliste Urlaub', text: '## Kleidung\n[x] Regenjacke\n[] Badesachen\n## Technik\n[-] Kabel', kontext: 'privat', checkliste: 'vorlage', benutzt: 2, ordnung: 1, geaendert: 1 });
  CL.DB.gedanken.push({ id: 'v2', titel: 'Monatsabschluss', text: '[] Belege', kontext: 'beruflich', checkliste: 'vorlage', ordnung: 2, geaendert: 1 });
  CL.DB.projekte.push({ id: 'p1', name: 'Umbau', flaeche: '## Statik\n[x] Pläne\nText\n[] Angebot', status: 'laufend', kontext: 'privat', ordnung: 3, geaendert: 1 });
  CL.oeffne('checklisten');
  let h = inhalt();
  pruefe(/>Laufend</.test(h) && />Vorlagen</.test(h) && /Packliste Urlaub/.test(h) && /3 Punkte · 2× benutzt/.test(h), 'Übersicht: Laufend und Vorlagen mit Punkten und Nutzung');
  CL.katSetzen('beruflich');
  pruefe(!/Packliste/.test(inhalt()) && /Monatsabschluss/.test(inhalt()), 'Beruf / Privat filtert');
  CL.katSetzen('alle');

  const vorText = CL.DB.gedanken[0].text;
  CL.clsStarten('v1');
  const lauf = CL.DB.gedanken.filter(g => g.checkliste === 'lauf')[0];
  pruefe(lauf && lauf.vorlage === 'v1' && lauf.gestartet === CL.isoDatum() && lauf.kontext === 'privat', 'Starten legt eine laufende Checkliste an — mit Datum');
  pruefe(lauf && lauf.text === '## Kleidung\n[] Regenjacke\n[] Badesachen\n## Technik\n[] Kabel', 'sie beginnt mit leeren Kästchen');
  pruefe(CL.DB.gedanken[0].text === vorText && CL.DB.gedanken[0].benutzt === 3, 'die Vorlage bleibt unverändert, zählt nur mit');
  pruefe(CL.cl.cls.id === lauf.id && /0\/3/.test(inhalt()), 'und ist gleich offen, Stand 0/3');
  CL.clsHaken(lauf.id, 1);
  pruefe(/\[x\] Regenjacke/.test(lauf.text) && /1\/3/.test(inhalt()), 'abhaken zählt den Fortschritt');
  CL.clsHaken('v1', 2);
  pruefe(CL.DB.gedanken[0].text === vorText, 'in einer Vorlage lässt sich nichts abhaken');
  CL.clsHaken(lauf.id, 2); CL.clsHaken(lauf.id, 4);
  pruefe(/Alles erledigt/.test(inhalt()) && /clsAbschliessen/.test(inhalt()), 'alles erledigt: „Abschließen“ wird angeboten');
  CL.clsAbschliessen();
  pruefe(lauf.checkliste === 'fertig' && lauf.abgeschlossen === CL.isoDatum() && CL.cl.cls.id === '', 'abgeschlossen: ins Archiv, zurück zur Übersicht');
  pruefe(/Erledigt · 1/.test(inhalt()), 'die Übersicht zählt Erledigte (eingeklappt)');

  /* Neu: aus einem Memo, als Kopie, leer */
  CL.clsNeu();
  pruefe(/Aus einem Memo/.test(CL.document.getElementById('aufklapp').innerHTML), 'Neu bietet: leer, Kopie, aus Memo, einmalig');
  CL.clsFensterSchritt('memo');
  pruefe(/clsAnlegen\('memo','p1'\)/.test(CL.document.getElementById('aufklapp').innerHTML), 'Memos mit Punkten stehen zur Wahl');
  CL.clsAnlegen('memo', 'p1');
  const ausMemo = CL.DB.gedanken[CL.DB.gedanken.length - 1];
  pruefe(ausMemo.checkliste === 'vorlage' && ausMemo.titel === 'Umbau' && ausMemo.text === '## Statik\n[] Pläne\n[] Angebot', 'aus dem Memo: nur Punkte und Überschriften, leer');
  pruefe(/\[x\] Pläne/.test(CL.DB.projekte[0].flaeche) && /Text/.test(CL.DB.projekte[0].flaeche), 'das Memo bleibt, wie es ist');
  CL.clsAnlegen('kopie', 'v2');
  pruefe(CL.DB.gedanken[CL.DB.gedanken.length - 1].titel === 'Kopie von Monatsabschluss', 'Kopie einer Vorlage');
  CL.clsAnlegen('leer', '');
  const leer = CL.DB.gedanken[CL.DB.gedanken.length - 1];
  pruefe(CL.cl.cls.schreiben && CL.cl.aufklapp === 'checkliste' && /clsTitel/.test(CL.document.getElementById('aufklapp').innerHTML), 'leere Vorlage: gleich Name vergeben und schreiben');
  CL.document.getElementById('clsTitel').value = 'Auto Winter';
  CL.clsSpeichern();
  pruefe(leer.titel === 'Auto Winter', 'der Name wird gespeichert');
  const feld = CL.document.getElementById('memoFeld');
  feld.value = '[] Reifen\nScheibenfrost'; feld.selectionStart = feld.value.length;
  CL.clsTextGetippt();
  CL.memoZeichen('kasten');
  pruefe(leer.text === '[] Reifen\n[] Scheibenfrost', 'Schreiben mit [ ] wie im Memo');

  /* Wo Checklisten nicht erscheinen */
  CL.oeffne('memo');
  pruefe(!/Packliste|Auto Winter|Monatsabschluss/.test(inhalt()), 'nicht im Memo');
  CL.oeffne('aufgaben');
  pruefe(!/Badesachen|Reifen|Belege/.test(inhalt()), 'nicht in den Aufgaben');
  CL.oeffne('uebersicht');
  pruefe(CL.clAppZahl('checklisten') === 0, 'die Zahl an der App zählt laufende Checklisten');

  /* Löschen mit Löschvermerk */
  CL.oeffne('checklisten');
  CL.clsOeffnen('v2');
  CL.clsDetails();
  CL.clsFensterSchritt('loeschen');
  pruefe(/wirklich löschen/.test(CL.document.getElementById('aufklapp').innerHTML) && CL.clsFinden('v2'), 'Löschen fragt nach');
  CL.clsLoeschen();
  pruefe(!CL.clsFinden('v2') && CL.DB.grabsteine.some(g => g.s === 'gedanken' && g.id === 'v2'), 'gelöscht — mit Löschvermerk für den Abgleich');
  CL.oeffne('uebersicht');
}

/* ============================================================
   21. Routinen
   Grund: Routinen liegen in DB.aufgaben und werden von der Workbench
   ausgewertet. Was CLIE anlegt oder ändert, muss dieselbe Gestalt haben
   (wiederholung: takt, intervall, tage, tag) — sonst sind Routinen in
   der Workbench falsch fällig. „Nur diesmal“ darf die Regel nie ändern.
   ============================================================ */
function routinenTest() {
  console.log('\n21. Routinen');
  if (!CL) { return; }
  frisch();
  CL.cl.rt.wahl = ''; CL.cl.rt.fenster = null; CL.cl.rt.pausiertAuf = false;
  const heute = CL.isoDatum();
  const wt = CL.ausIso(heute).getDay();
  CL.DB.aufgaben.push({ id: 'r1', titel: 'Oskar laufen lassen', wiederholung: { takt: 'woche', intervall: 1, tage: [0,1,2,3,4,5,6], tag: 1 }, kontext: 'privat', geaendert: 1 });
  CL.DB.aufgaben.push({ id: 'r2', titel: 'Monatsabschluss', wiederholung: { takt: 'monat', intervall: 3, tage: [], tag: 15 }, uhrzeit: '09:00', kontext: 'beruflich', geaendert: 1 });
  CL.DB.aufgaben.push({ id: 'r3', titel: 'Alt', wiederholung: { takt: 'woche', intervall: 1, tage: [wt], tag: 1 }, pausiert: true, kontext: 'privat', geaendert: 1 });
  CL.DB.aufgaben.push({ id: 'a1', titel: 'Keine Routine', status: 'offen', geaendert: 1 });
  CL.oeffne('routinen');
  let h = inhalt();
  pruefe(/>Heute</.test(h) && /clRoutineUm\('r1'/.test(h) && !/clRoutineUm\('r3'/.test(h), 'Heute: fällige zum Abhaken, pausierte nicht');
  pruefe(/täglich/.test(h) && /alle 3 Monate am 15\. · 9:00/.test(h), 'der Rhythmus in Worten — wie in der Workbench');
  pruefe(/Pausiert · 1/.test(h) && !/rtTippen\('r3'\)/.test(h) && !/Keine Routine/.test(h), 'Pausierte eingeklappt, gewöhnliche Aufgaben gar nicht');

  CL.rtNeu();
  let f = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(/Neue Routine/.test(f) && /rtWahl\('takt','monat'\)/.test(f) && /rtIntervall/.test(f), 'Neu: Name, Rhythmus, Tage, alle n Wochen');
  CL.document.getElementById('rtName').value = 'Joggen';
  CL.rtWahl('tag', String(wt));
  CL.rtSpeichern();
  pruefe(/Wochentag/.test(CL.document.getElementById('toastText').textContent) && CL.DB.aufgaben.length === 4, 'ohne Wochentag wird nichts gespeichert');
  CL.rtWahl('tag', '2'); CL.rtWahl('tag', '4'); CL.rtWahl('tag', '6');
  CL.document.getElementById('rtIntervall').value = '1';
  CL.document.getElementById('rtZeit').value = '18:00';
  CL.document.getElementById('rtAb').value = heute;
  CL.rtSpeichern();
  const neu = CL.DB.aufgaben[CL.DB.aufgaben.length - 1];
  pruefe(neu.titel === 'Joggen' && JSON.stringify(neu.wiederholung) === JSON.stringify({ takt: 'woche', intervall: 1, tage: [2, 4, 6], tag: neu.wiederholung.tag })
    && neu.uhrzeit === '18:00' && neu.ab === heute && neu.art === 'haupt' && neu.planung === 'backlog' && neu.status === 'offen',
    'die neue Routine hat die Gestalt der Workbench');
  pruefe(CL.aufgabeFaelligAn(neu, CL.tagePlus(CL.montagVon(heute), 1)) || CL.montagVon(heute) > heute, 'und ist an ihren Tagen fällig');

  CL.rtTippen('r2'); CL.rtTippen('r2');
  f = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(/value="Monatsabschluss"/.test(f) && /id="rtTag"[^>]*value="15"/.test(f) && /id="rtIntervall"[^>]*value="3"/.test(f), 'Details zeigen den Monatsrhythmus');
  CL.document.getElementById('rtTag').value = '31';
  CL.rtWahl('pausiert', '');
  CL.rtSpeichern();
  const r2 = CL.DB.aufgaben[1];
  pruefe(r2.wiederholung.tag === 31 && r2.wiederholung.takt === 'monat' && r2.pausiert === true, 'ändern: Tag 31 und pausiert');
  pruefe(CL.faelligAn({ takt: 'monat', intervall: 1, tag: 31 }, '2026-11-30'), 'der 31. gilt im November am 30. — wie in der Workbench');
  CL.rtDetails('r2'); CL.rtWahl('pausiert', ''); CL.rtSpeichern();
  pruefe(!('pausiert' in r2), 'Pause wieder aus');

  /* Nur diesmal */
  CL.cl.rt.wahl = 'r1';
  CL.rtDiesmal();
  f = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(/Nur diesmal/.test(f) && /die Regel bleibt/.test(f) && new RegExp(CL.clKurzDatum(heute).replace(/\./g, '\\.')).test(f), 'Nur diesmal betrifft heute');
  const regel = JSON.stringify(CL.DB.aufgaben[0].wiederholung);
  CL.rtAuslassen(heute);
  pruefe(!CL.aufgabeFaelligAn(CL.DB.aufgaben[0], heute) && JSON.stringify(CL.DB.aufgaben[0].wiederholung) === regel, 'Auslassen: heute nicht fällig, die Regel unverändert');
  CL.rtDiesmal();
  pruefe(new RegExp(CL.clKurzDatum(CL.tagePlus(heute, 1)).replace(/\./g, '\\.')).test(CL.document.getElementById('aufklapp').innerHTML), 'danach gilt „nur diesmal“ für die nächste Ausführung');
  const morgen = CL.tagePlus(heute, 1), weiter = CL.tagePlus(heute, 2);
  CL.document.getElementById('rtZu').value = weiter;
  CL.document.getElementById('rtZuZeit').value = '07:15';
  CL.rtVerlegen(morgen);
  pruefe(CL.DB.aufgaben[0].zeitAusnahmen[weiter] === '07:15' && CL.aufgabeZeitAn(CL.DB.aufgaben[0], weiter) === '07:15', 'Verlegen mit eigener Uhrzeit');

  /* Löschen */
  CL.rtDetails('r1');
  CL.rtLoeschenFragen();
  pruefe(/wirklich löschen/.test(CL.document.getElementById('aufklapp').innerHTML), 'Löschen fragt nach');
  CL.rtLoeschen();
  pruefe(!CL.rtFinden('r1') && CL.DB.grabsteine.some(g => g.s === 'aufgaben' && g.id === 'r1'), 'gelöscht — mit Löschvermerk');
  pruefe(CL.rtFinden('r2') && CL.DB.aufgaben.some(a => a.id === 'a1'), 'andere bleiben unberührt');
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
  rechnerTest();
  einkaufTest();
  try { kalenderTest(); } catch (e) { fail('Kalender warf: ' + e.message); }
  try { await schreibTest(); } catch (e) { fail('Termine schreiben warf: ' + e.message); }
  zifferTest();
  try { bloeckeTest(); } catch (e) { fail('Zeitklammern/Blöcke warf: ' + e.message); }
  try { aufgabenTest(); } catch (e) { fail('Aufgaben warf: ' + e.message); }
  try { memoTest(); } catch (e) { fail('Memo warf: ' + e.message); }
  try { checklistenTest(); } catch (e) { fail('Checklisten warf: ' + e.message); }
  try { routinenTest(); } catch (e) { fail('Routinen warf: ' + e.message); }

  /* ============================================================
     ERGEBNIS
     ============================================================ */
  console.log('\nERGEBNIS: ' + anzOk + ' ok, ' + anzFail + ' fehlgeschlagen, ' + anzWarn + ' Warnungen');
  process.exit(anzFail ? 1 : 0);
})();
