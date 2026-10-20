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
  pruefe(/class="fassung" onclick="oeffne\(\\'statistik\\'\)">CLIE v' \+ esc\(APP_VERSION\)/.test(SKRIPT), 'die Übersicht zeigt die Version im Hauptfenster (seit 0.7.1 mit Weg zur Statistik)');
  pruefe(/document\.title = 'CLIE ' \+ APP_VERSION/.test(SKRIPT), 'der Fenstertitel trägt die Version');
  pruefe(!/@media/.test(QUELLE), 'keine @media-Regeln');
  const fns = [...SKRIPT.matchAll(/\nfunction (\w+)\s*\(/g)].map(m => m[1]);
  const doppelt = [...new Set(fns.filter((f, i) => fns.indexOf(f) !== i))];
  pruefe(doppelt.length === 0, 'keine doppelt definierten Funktionen' + (doppelt.length ? ' — gefunden: ' + doppelt.join(', ') : ''));

  /* Aufrufe nicht definierter Funktionen: im Code und in den Bedienelementen */
  /* Seit 0.8.2 auch innere Funktionen (feiertageVon der Workbench hat „verschoben“) */
  const innere = [...SKRIPT.matchAll(/\n[ \t]+function (\w+)\s*\(/g)].map(m => m[1]);
  const definiert = new Set(fns.concat(innere));
  const vars = new Set([...SKRIPT.matchAll(/\bvar\s+(\w+)/g)].map(m => m[1]));
  const ohne = SKRIPT.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const bekannt = new Set(('if for while switch return function typeof catch String Number Boolean Array Object JSON Math Date RegExp '
    + 'Error Promise parseInt parseFloat isNaN encodeURIComponent decodeURIComponent setTimeout clearTimeout setInterval '
    + 'clearInterval fetch Blob URL new fehler fertig isFinite __').split(' '));
  /* „__(“ steht in einem regulären Ausdruck von kpAuszeichnen (Workbench), ist kein Aufruf. */
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
  /* Anschlüsse gehören jeder App selbst (seit 0.6: kpVerweisHtml öffnet in CLIE das Memo) */
  const ANSCHLUESSE = ['kpVerweisHtml', 'kpTextSetzen', 'kpBzUm', 'kpBzSprung', 'kpKastenUm', 'kpZelleUm', 'kpAbschnittUm'];
  const kernAb = kern.filter(n => ANSCHLUESSE.indexOf(n) < 0 && funktionText(SKRIPT, n) !== funktionText(WB_SKRIPT, n));
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
  pruefe((h.match(/class="zahl"/g) || []).length === 1 && /oeffne\('heute'\)"><span class="sym"><svg[^]*?<span class="zahl">\d+</.test(h) && typeof CL.clAppZahl === 'undefined',
    'eine Zahl nur an „Heute“ (seit 0.9), sonst keine Zahlen an den Symbolen');
  pruefe(CL.clTermineRest().length === 1, 'heute noch kommende Termine — Vergangenes zählt nicht');
  pruefe((h.match(/class="app"/g) || []).length === 10, 'zehn Apps im Raster (seit 0.9 mit Heute)');
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
  pruefe(/>Abgleichen</.test(b) && /clTermineHolen\(true\)/.test(b) && /clAbmelden\(\)/.test(b), 'angemeldet: Abgleichen, Termine holen, Abmelden');
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
  pruefe(/onclick="menueUm\(\)"/.test(QUELLE) && CL.CL_APPS.some(x => x.id === 'abgleich'),
    'seit 0.7.2: Menü über den Reiter, Abgleich als App, Übersicht über die Taste Zurück');
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
  pruefe(JSON.stringify(CL.CL_APPS.map(a => a.id)) === '["kalender","heute","aufgaben","memo","checklisten","sammlungen","routinen","einkauf","rechner","abgleich"]',
    'genau zehn Apps: Kalender, Heute, Aufgaben, Memo, Checklisten, Sammlungen, Routinen, Einkauf, Rechner, Abgleich');
  pruefe(!/oeffne\('(projekte|ziele|listen|woche)'\)/.test(h), 'keine eigenen Apps für Projekte, Ziele, Listen oder Woche');
  pruefe(!/unterz/.test(h) && !/unterz/.test(QUELLE), 'keine Unterzeile unter den Apps');
  const syms = (h.match(/<span class="sym"><svg viewBox="0 0 64 64"[^>]*><circle cx="32" cy="32" r="30" fill="#3B4433"/g) || []).length;
  pruefe(syms === 10, 'jede App hat ein Symbol als dunkle runde Scheibe (' + syms + '/10)');
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
  pruefe((h.match(/class="z">/g) || []).length - (h.match(/class="std ende"/g) || []).length === 4 && /class="z">5:15</.test(h) && /class="z">7:30</.test(h) && !/class="z">9:00</.test(h),
    'seit 0.6 nur Belegtes: Termine, Aufgaben und Routinen mit Uhrzeit — keine leeren Stunden');
  pruefe(/class="z">11:00<\/span><span class="t"><button type="button" class="k" onclick="clTagZeileUm/.test(h),
    'eine mit Uhrzeit eingeplante Aufgabe steht an ihrer Stunde, mit Kästchen');
  const vorg = h.slice(h.indexOf('>Vorgenommen<'));
  pruefe(/Rechnung prüfen/.test(vorg) && !/Offering beschreiben/.test(vorg) && /Nur ein Gedanke/.test(vorg) && !/class="q"/.test(vorg),
    'Vorgenommen zeigt Aufgaben ohne Uhrzeit (seit 0.6.2 ohne ihre Liste), dazu freien Text');
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
  pruefe(!anfragen.length && /Verbindung/.test(CL.document.getElementById('toastText').textContent) && CL.cl.aufklapp === 'aufgabe',
    'ohne Anmeldung: kein Termin, stattdessen das Fenster für eine Aufgabe');
  CL.terminStatt();
  pruefe(CL.cl.aufklapp === 'aufgabe' && /Verbinden/.test(CL.document.getElementById('toastText').textContent), '„Termin“ geht dann nicht — mit Hinweis');
  CL.aufklappZu();
  CL.zugriffToken = 'test'; CL.tokenAblauf = Date.now() + 3600000;
  CL.DB.einstellungen.kalender = [{ id: 'buero@x', kontext: 'beruflich' }];
  CL.katSetzen('beruflich');
  CL.terminNeu(heute, '15:00');
  await warte(); await warte();
  let f = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(CL.cl.aufklapp === 'termin' && /class="an">Termin<\/button><button type="button" onclick="aufgabeStatt\(\)">Aufgabe/.test(f) && /value="15:00"/.test(f) && /value="16:00"/.test(f),
    '„Neu“: Termin ist vorgewählt, Aufgabe wählbar; die Stunde ist vorgeschlagen, eine Stunde lang');
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
   23. Keine Zustandsklasse als eigene Regel
   Grund (0.6): Die Marke „heute“ an Aufgaben hatte die Regel .heute{…}
   mit Rahmen — dieselbe Klasse steht als Zustand an der heutigen
   Spalte, Kopfzeile und Monatszelle. Ergebnis: ein Rahmen um die ganze
   heutige Spalte der Wochenblöcke. Eine Klasse, die irgendwo als Zusatz
   (.a.b) benutzt wird, darf keine eigene Regel (.b{…}) haben.
   ============================================================ */
function zustandsklassenTest() {
  console.log('\n23. Keine Zustandsklasse als eigene Regel');
  const css = (QUELLE.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
  const bare = new Set([...css.matchAll(/(?:^|\})\s*\.([a-z][\w-]*)\{/gm)].map(m => m[1]));
  const zusatz = new Set([...css.matchAll(/\.[a-z][\w-]*\.([a-z][\w-]*)/g)].map(m => m[1]));
  const beides = [...bare].filter(x => zusatz.has(x));
  pruefe(beides.length === 0, 'keine Klasse ist zugleich eigene Regel und Zustand' + (beides.length ? ' — gefunden: ' + beides.join(', ') : ''));
  pruefe(!/^\.heute\{/m.test(css) && /\.plan-marke\{/.test(css), 'die Planungsmarke heißt plan-marke');
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
  const morgen = CL.tagePlus(heute, 1);
  CL.termineNachTag[morgen] = CL.termineNachTag[heute];
  CL.oeffne('kalender');
  CL.clKalGehe(morgen, 'tag');
  const h = inhalt();
  const stunden = (h.match(/class="z">(\d+:\d+)</g) || []).map(x => x.replace(/class="z">|</g, ''));
  pruefe(stunden.indexOf('10:00') < 0 && stunden.indexOf('16:00') < 0 && stunden.indexOf('17:00') < 0,
    'leere Stunden mitten in einem Termin entfallen (10:00, 16:00, 17:00) — ' + stunden.join(' '));
  pruefe(stunden.join(' ') === '9:00 10:30 11:00 12:00 13:00 13:30 15:00 18:00', 'keine freien Stunden — nur Beginn und (seit 0.6.2) Ende der Termine — ' + stunden.join(' '));
  const reihen = h.split('<div class="std').slice(1);
  const zeile = (zeit) => reihen.filter(r => r.indexOf('class="z">' + zeit + '<') >= 0)[0] || '';
  pruefe(/class="kl"><i class="oben"><\/i>/.test(zeile('9:00')) && /class="kl"><i class="unten"><\/i>/.test(zeile('11:00')), 'Workshop 9–11: Klammer von 9:00 bis zur Endzeile 11:00');
  pruefe(/class="kl"><i class="mitte"><\/i><i class="oben"><\/i>/.test(zeile('10:30')) && /<i class="mitte"><\/i>/.test(zeile('11:00')) && /class="kl"><i class=""><\/i><i class="unten"><\/i>/.test(zeile('12:00')),
    'der parallele Termin bekommt eine zweite Klammer daneben, bis 12:00');
  pruefe(/class="kl"><i class="oben"><\/i>/.test(zeile('13:00')) && /class="kl"><i class="unten"><\/i>/.test(zeile('13:30')), 'seit 0.6.2 auch kurze Termine mit Endzeile und Klammer (wie am Palm)');
  pruefe(/class="kl"><i class="oben"><\/i>/.test(zeile('15:00')) && /class="kl"><i class="unten"><\/i>/.test(zeile('18:00')), 'ein langer Termin ohne weitere Zeilen: Klammer bis zur Endzeile');
  CL.clKalGehe(heute, 'tag');
  delete CL.termineNachTag[morgen];

  CL.clKalAnsicht('bloecke');
  let b = inhalt();
  pruefe(/^KW \d+$/.test(CL.document.getElementById('reiter').textContent), 'Blöcke: KW im Reiter');
  pruefe((b.match(/class="wb-blk/g) || []).length === 4, 'jeder Termin ist ein Block');
  pruefe(/>Workshop<\/button>/.test(b) && />Lang<\/button>/.test(b), 'seit 0.6 mit Titel im Block (gekürzt, so viel hineinpasst)');
  const blk = (id) => (b.match(new RegExp('<button type="button" class="wb-blk ([^"]*)" style="([^"]*)" onclick="terminZeigen\\(\'[^\']+\',\'' + id + '\'\\)')) || []);
  pruefe(/s1/.test(blk('a')[1]) && /s2/.test(blk('b')[1]) && /width:calc\(50%/.test(blk('a')[2]) && /left:calc\(50%/.test(blk('b')[2]),
    'Überschneidungen: nebeneinander, halbe Breite, abgestuft (s1/s2)');
  pruefe(/s1/.test(blk('d')[1]) && /width:calc\(100%/.test(blk('d')[2]), 'ein Termin ohne Überschneidung: volle Breite, dunkel');
  pruefe(/terminZeigen\('[^']+','a'\)/.test(b), 'ein Tipp auf einen Block öffnet den Termin');
  CL.clWocheTageSetzen(5);
  b = inhalt();
  pruefe(CL.cl.kal.tage === 5 && (b.match(/class="kz[^"]*" onclick/g) || []).length === 5 && CL.__ablage['clie-woche-tage'] === '5', 'Mo–Fr: fünf Spalten, gemerkt');
  CL.clWocheTageSetzen(7);
  pruefe((inhalt().match(/class="kz[^"]*" onclick/g) || []).length === 7, 'Mo–So: sieben Spalten');
  pruefe(/>3 Tage</.test(inhalt()) && />Arbeitswoche</.test(inhalt()) && /class="an" onclick="clWocheTageSetzen\(7\)">Woche</.test(inhalt()), 'Auswahl 3 Tage | Arbeitswoche | Woche');
  CL.clKalGehe(heute, 'bloecke');
  CL.clWocheTageSetzen(3);
  const drei = (inhalt().match(/class="kz[^"]*" onclick="clKalGehe\('([^']+)'/g) || []).map(x => x.slice(-11, -1));
  pruefe(drei.length === 3 && drei[0] === heute && drei[2] === CL.tagePlus(heute, 2) && CL.document.getElementById('reiter').textContent.indexOf('–') > 0,
    '3 Tage: heute und die zwei folgenden');
  CL.clBlaettern(1);
  pruefe(CL.clKalDatum() === CL.tagePlus(heute, 3), 'Blättern bei 3 Tagen springt drei Tage');
  CL.clKalGehe(heute, 'bloecke');
  CL.clWocheTageSetzen(7);
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
  pruefe(/<div class="gruppe">◎ Büro<\/div>/.test(h) && /<div class="gruppe">≡ Garten<\/div>/.test(h) && !/class="q">/.test(h),
    'seit 0.6 nach Liste gruppiert — keine zweite Spalte, der Titel hat die volle Breite');
  pruefe(/class="tx umbruch"/.test(h), 'lange Titel brechen um');
  CL.aufKategorienUm();
  pruefe(!/class="gruppe"/.test(inhalt()) && CL.__ablage['clie-aufgaben-kategorien'] === 'aus' && /Kategorien an/.test(CL.document.getElementById('fuss').innerHTML),
    '„Kategorien aus“: flache Liste ohne Herkunft, gemerkt');
  CL.aufKategorienUm();
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
  CL.document.getElementById('aufDatum').value = '';
  CL.aufUhrzeitUm();
  pruefe(CL.cl.auf.fenster.datum === heute && CL.cl.auf.fenster.mitZeit && /id="aufZeit"/.test(CL.document.getElementById('aufklapp').innerHTML)
    && new RegExp('id="aufDatum"[^>]*value="' + heute).test(CL.document.getElementById('aufklapp').innerHTML),
    '„Uhrzeit“ blendet das Zeitfeld ein — ohne Datum gilt heute');
  /* Die Testumgebung übernimmt Werte nicht aus dem HTML — wie getippt setzen */
  CL.document.getElementById('aufDatum').value = heute;
  CL.document.getElementById('aufZeit').value = '15:00';
  CL.aufSpeichern();
  const garten = CL.DB.themen[0];
  pruefe(/\n\[\] Winterreifen$/.test(garten.text), 'die neue Aufgabe steht am Ende der Liste');
  const tag = CL.kpTagFinden(heute);
  const e = tag && tag.eintraege.filter(x => x.text === 'Winterreifen')[0];
  pruefe(e && e.quelle === 't1' && e.zeit === '15:00' && /\[\] Winterreifen/.test(tag.text), 'für heute um 15:00 eingeplant — im selben Tag wie die Workbench');
  pruefe(/Winterreifen<\/button><span class="plan-marke">15:00<\/span>/.test(inhalt()) && inhalt().indexOf('≡ Garten') < inhalt().indexOf('Winterreifen'),
    'Eingeplantes steht bei seiner Liste, mit Uhrzeit als Marke');
  CL.oeffne('kalender');
  pruefe(/class="z">15:00<\/span><span class="t"><button type="button" class="k" onclick="clTagZeileUm[^>]*><\/button><span class="tx">Winterreifen/.test(inhalt()),
    'und steht im Kalender an seiner Stunde');
  CL.oeffne('aufgaben');

  /* Details: Text ändern, verschieben, ausplanen */
  const nr = garten.text.split('\n').indexOf('[] Winterreifen');
  CL.aufDetails('t1', nr);
  f = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(/>Aufgabe</.test(f) && /id="aufDatum"[^>]*value="/.test(f) && /value="15:00"/.test(f) && /Liste zeigen/.test(f) && /Löschen/.test(f),
    'Details zeigen Datum, Uhrzeit, „Liste zeigen“ und Löschen');
  CL.document.getElementById('aufText').value = 'Winterreifen wechseln';
  CL.cl.auf.fenster.seite = 'p2';
  CL.aufUhrzeitUm();
  CL.aufSpeichern();
  const umbau = CL.DB.projekte[1];
  const e2 = CL.kpTagFinden(heute).eintraege.filter(x => /Winterreifen/.test(x.text))[0];
  pruefe(!/Winterreifen/.test(garten.text) && /\n\[\] Winterreifen wechseln$/.test(umbau.flaeche), 'neuer Text und in die andere Liste verschoben');
  pruefe(e2 && e2.text === 'Winterreifen wechseln' && e2.quelle === 'p2' && !e2.zeit && /\[\] Winterreifen wechseln/.test(CL.kpTagFinden(heute).text),
    'die Planung zieht mit — jetzt „heute“ ohne Uhrzeit');
  const nr2 = umbau.flaeche.split('\n').indexOf('[] Winterreifen wechseln');
  const uebermorgen = CL.tagePlus(heute, 2);
  CL.aufDetails('p2', nr2);
  CL.document.getElementById('aufDatum').value = uebermorgen;
  CL.aufSpeichern();
  const spaeter = CL.kpTagFinden(uebermorgen);
  pruefe(!/Winterreifen/.test(CL.kpTagFinden(heute).text) && spaeter && /\[\] Winterreifen wechseln/.test(spaeter.text) && spaeter.eintraege.some(x => x.quelle === 'p2'),
    'ein anderes Datum: aus heute heraus, in den neuen Tag hinein');
  pruefe(new RegExp('<span class="plan-marke">' + CL.clWt(uebermorgen) + ' ' + CL.clKurzDatum(uebermorgen).replace(/\./g, '\\.') + '</span>').test(inhalt()),
    'in der Liste steht der Tag, etwa „Mi 21.10.“');
  CL.aufDetails('p2', nr2);
  CL.document.getElementById('aufDatum').value = CL.tagePlus(heute, -1);
  CL.aufSpeichern();
  pruefe(/späteren Tag/.test(CL.document.getElementById('toastText').textContent), 'ein vergangener Tag wird abgelehnt');
  CL.aufDatumWeg();
  pruefe(CL.cl.auf.fenster.datum === '' && !/id="aufZeit"/.test(CL.document.getElementById('aufklapp').innerHTML)
    && /id="aufDatum"[^>]*value=""/.test(CL.document.getElementById('aufklapp').innerHTML), '✕ leert Datum und Uhrzeit im Fenster');
  CL.document.getElementById('aufDatum').value = '';
  CL.aufSpeichern();
  pruefe(!/Winterreifen/.test(spaeter.text) && !spaeter.eintraege.some(x => /Winterreifen/.test(x.text)), '✕ beim Datum nimmt sie wieder heraus');
  CL.aufDetails('p2', nr2);
  CL.aufLoeschenFragen();
  pruefe(/wirklich|löschen\?/.test(CL.document.getElementById('aufklapp').innerHTML) && /Winterreifen/.test(umbau.flaeche), 'Löschen fragt erst nach');
  CL.aufLoeschen();
  pruefe(!/Winterreifen/.test(umbau.flaeche), 'dann ist die Zeile aus der Seite weg');

  /* Auswahl per Tippen, zweiter Tipp öffnet Details */
  /* Neue Liste aus der Auswahl */
  CL.listenwahlOeffnen('filter');
  pruefe(/neueListeOeffnen/.test(CL.document.getElementById('aufklapp').innerHTML), '„Weitere…“ bietet „Neue Liste…“');
  CL.neueListeOeffnen();
  CL.document.getElementById('listeTitel').value = 'Geschenkideen';
  CL.neueListeKontext('privat');
  CL.neueListeSpeichern();
  const gesch = CL.DB.themen[CL.DB.themen.length - 1];
  pruefe(gesch.name === 'Geschenkideen' && gesch.kontext === 'privat' && CL.cl.auf.liste === gesch.id, 'die neue Liste liegt in „themen“ und ist gleich gewählt');
  CL.katUm();
  pruefe(/listeBearbeiten/.test(CL.document.getElementById('aufklapp').innerHTML), 'eine gewählte Liste lässt sich bearbeiten');
  CL.listeBearbeiten();
  CL.document.getElementById('listeTitel').value = 'Geschenke';
  CL.neueListeSpeichern();
  pruefe(gesch.name === 'Geschenke', 'umbenannt');
  CL.aufListeSetzen('');
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
  pruefe(/>Projekte</.test(h) && />Ziele</.test(h) && !/>Listen</.test(h) && />Notizen</.test(h) && !/Garten/.test(h),
    'gruppiert: Projekte, Ziele, Notizen — seit 0.6 ohne Listen');
  pruefe(/Büro/.test(h) && /Halbmarathon/.test(h) && !/Packliste/.test(h) && h.indexOf('>Ruhend<') >= 0 && h.indexOf('Ruht') > h.indexOf('>Ruhend<'),
    'laufende Seiten oben, Ruhendes (seit 0.12.2) in eigener Gruppe, keine Checklisten');
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
  pruefe(CL.cl.memo.id === '' && inhalt().indexOf('Büro neu') > inhalt().indexOf('>Ruhend<'), 'eine ruhende Seite wandert in die Gruppe „Ruhend“ (seit 0.12.2)');

  CL.memoNeu();
  pruefe(!/memoWahl\('art','liste'\)/.test(CL.document.getElementById('aufklapp').innerHTML), 'Neu bietet keine Liste mehr an');
  CL.memoWahl('art', 'notiz');
  CL.document.getElementById('memoTitel').value = '';
  CL.memoSpeichern();
  const zahl = CL.DB.gedanken.length;
  pruefe(/Namen/.test(CL.document.getElementById('toastText').textContent), 'ohne Namen kein neues Memo');
  CL.document.getElementById('memoTitel').value = 'Geschenkideen';
  CL.memoWahl('kontext', 'privat');
  CL.memoSpeichern();
  const neu = CL.DB.gedanken[CL.DB.gedanken.length - 1];
  pruefe(CL.DB.gedanken.length === zahl + 1 && neu.titel === 'Geschenkideen' && neu.kontext === 'privat', 'Neu legt eine Notiz an');
  pruefe(CL.cl.memo.id === neu.id && CL.cl.memo.schreiben, 'und öffnet sie gleich zum Schreiben');
  CL.memoSchreibenUm();

  CL.DB.projekte[1].flaeche = '[] Fenster messen';
  CL.memoZeile('p2', 0);
  pruefe(CL.cl.app === 'memo' && CL.cl.memo.id === 'p2' && /class="aufg hervor"/.test(inhalt()), '„Im Memo zeigen“ öffnet die Seite an der Zeile');
  CL.memoZeile('t1', 0);
  pruefe(CL.cl.app === 'aufgaben' && CL.cl.auf.liste === 't1', '„Liste zeigen“ öffnet bei Listen die Aufgaben');
  CL.aufListeSetzen('');
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
  pruefe(CL.clsAlle('lauf').length === 0, 'keine laufende Checkliste');

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

/* ============================================================
   22. Memo-Auszeichnungen und „Neu“ im Kalender
   Grund (0.6): Das Memo zeigte keine Auszeichnungen — **fett**,
   _kursiv_, Links, Verweise, Tabellen und Nummern blieben roher Text.
   Seit 0.6 mit kpAuszeichnen der Workbench (wörtlich). Dazu legt
   „Neu“ im Kalender wahlweise eine Aufgabe für den gezeigten Tag an.
   ============================================================ */
function auszeichnungTest() {
  console.log('\n22. Memo-Auszeichnungen und „Neu“ im Kalender');
  if (!CL) { return; }
  aufgabenDaten();
  CL.DB.gedanken.push({ id: 'g9', titel: 'Notizen', ordnung: 90, geaendert: 1, text:
    '**fett** und _kursiv_ und ~~weg~~\nSiehe [Doku](https://example.org/x) und [[projekt:p2|Umbau]]\n1. eins\n2. zwei\n'
    + '| Was | Wann |\n|---|---|\n| Statik | Mo |\n<script>alert(1)</script>\n[] **Wichtig** anrufen' });
  CL.oeffne('memo');
  CL.memoOeffnen('g9');
  const h = inhalt();
  pruefe(/<b>fett<\/b>/.test(h) && /<i>kursiv<\/i>/.test(h) && /<s>weg<\/s>/.test(h), 'fett, kursiv, durchgestrichen werden gezeigt');
  pruefe(/<a href="https:\/\/example\.org\/x" target="_blank" rel="noopener">Doku<\/a>/.test(h), 'Links öffnen sich in neuem Fenster');
  pruefe(/<button type="button" class="verweis" onclick="memoVerweis\('p2'\)">Umbau<\/button>/.test(h), 'Verweise auf Seiten sind antippbar');
  pruefe(/<span class="nr">1\.<\/span> eins/.test(h) && /<span class="nr">2\.<\/span> zwei/.test(h), 'nummerierte Zeilen');
  pruefe(/<table><tr><th>Was<\/th><th>Wann<\/th><\/tr><tr><td>Statik<\/td><td>Mo<\/td><\/tr><\/table>/.test(h), 'Tabellen mit Kopfzeile, die Trennzeile fällt weg');
  pruefe(!/<script>/.test(h) && /&lt;script&gt;/.test(h), 'HTML im Text wird nicht ausgeführt');
  pruefe(/class="tx umbruch"[^>]*>Wichtig anrufen<\/button>/.test(h), 'in Aufgabenzeilen ohne Sternchen — schlicht lesbar');
  CL.memoVerweis('p2');
  pruefe(CL.cl.app === 'memo' && CL.cl.memo.id === 'p2', 'ein Tipp auf den Verweis öffnet die Seite');
  CL.memoVerweis('t1');
  pruefe(CL.cl.app === 'aufgaben' && CL.cl.auf.liste === 't1', 'ein Verweis auf eine Liste öffnet sie in den Aufgaben');
  CL.aufListeSetzen('');

  /* Kalender → Neu → Aufgabe */
  const morgen = CL.tagePlus(CL.isoDatum(), 1);
  CL.zugriffToken = 'test'; CL.tokenAblauf = Date.now() + 3600000;
  CL.schreibKalender = [{ id: 'k', name: 'Privat', primary: true }];
  CL.oeffne('kalender');
  CL.clKalGehe(morgen, 'tag');
  CL.terminNeu('', '');
  CL.document.getElementById('terminDatum').value = morgen;
  CL.aufgabeStatt();
  let f = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(CL.cl.aufklapp === 'aufgabe' && /onclick="terminStatt\(\)">Termin<\/button><button type="button" class="an">Aufgabe/.test(f)
    && new RegExp('id="aufDatum"[^>]*value="' + morgen).test(f), '„Aufgabe“: dasselbe Fenster, für den gezeigten Tag');
  CL.cl.auf.fenster.seite = 't1';
  CL.document.getElementById('aufText').value = 'Blumenzwiebeln setzen';
  CL.document.getElementById('aufDatum').value = morgen;
  CL.aufSpeichern();
  const tag = CL.kpTagFinden(morgen);
  pruefe(/\[\] Blumenzwiebeln setzen$/.test(CL.DB.themen[0].text) && tag && /Blumenzwiebeln/.test(tag.text), 'gespeichert in der Liste und für den Tag eingeplant');
  pruefe(CL.cl.app === 'kalender' && /Blumenzwiebeln/.test(inhalt()), 'zurück im Kalender steht sie unter „Vorgenommen“');
  CL.terminNeu('', '');
  CL.aufgabeStatt();
  CL.terminStatt();
  pruefe(CL.cl.aufklapp === 'termin' && /Neu/.test(CL.document.getElementById('aufklapp').innerHTML), 'und zurück zum Termin');
  CL.aufklappZu();
  CL.zugriffToken = null;
  CL.clKalGehe(CL.isoDatum(), 'tag');
  CL.oeffne('uebersicht');
}

/* ============================================================
   24. Feinschliff 0.6.1
   Grund: „Geplant“ als eigene Gruppe in „Alle Aufgaben“ war doppelt
   (die Marke steht ohnehin an der Aufgabe); die Uhrzeit im Kopf der
   App-Seiten war überflüssig; in den Wochenblöcken fehlte Ganztägiges
   (nur ein leerer Rahmen ohne Titel).
   ============================================================ */
function feinschliffTest() {
  console.log('\n24. Feinschliff 0.6.1');
  if (!CL) { return; }
  aufgabenDaten();
  const heute = CL.isoDatum();
  CL.DB.tage.push({ id: 'tag-' + heute, datum: heute, text: '[] Laub', geaendert: 1, eintraege: [{ id: 'e1', abschnitt: 'h', text: 'Laub', quelle: 't1', erledigt: false }] });
  CL.oeffne('aufgaben');
  const h = inhalt();
  pruefe(!/>Geplant</.test(h) && /≡ Garten<\/div><div class="aufg[^"]*">[\s\S]*?Laub<\/button><span class="plan-marke">heute<\/span>/.test(h),
    'keine Gruppe „Geplant“ — die Aufgabe steht bei ihrer Liste mit der Marke „heute“');
  pruefe(CL.document.getElementById('uhr').textContent === '', 'auf App-Seiten keine Uhrzeit im Kopf');
  CL.oeffne('uebersicht');
  pruefe(/^\d{2}:\d{2}$/.test(CL.document.getElementById('uhr').textContent), 'auf der Übersicht bleibt die Uhr');

  CL.termineNachTag[heute] = [{ id: 'g1', titel: 'Geburtstag Oma', ganztags: true, zeit: '', bis: '', kontext: 'privat' },
                              { id: 't1', zeit: '09:00', bis: '10:00', titel: 'Termin', kontext: 'privat' }];
  CL.oeffne('kalender');
  CL.clKalAnsicht('bloecke');
  let b = inhalt();
  pruefe(/class="wb-ganz" onclick="terminZeigen\('[^']+','g1'\)">Geburtstag Oma<\/button>/.test(b), 'Ganztägiges steht in den Blöcken — mit Titel, antippbar');
  pruefe((b.match(/class="wb-ganz-sp"/g) || []).length === CL.cl.kal.tage, 'eine Zeile für Ganztägiges, eine Zelle je Tag');
  CL.termineNachTag[heute] = [{ id: 't1', zeit: '09:00', bis: '10:00', titel: 'Termin', kontext: 'privat' }];
  CL.zeichne();
  pruefe(!/wb-ganz-sp/.test(inhalt()), 'ohne Ganztägiges keine leere Zeile');
  CL.clKalGehe(heute, 'tag');
  CL.oeffne('uebersicht');
}

/* ============================================================
   25. Tag wie im Datebook (0.6.2)
   Grund: Die Klammer endete an der nächsten Zeile statt an der echten
   Endzeit; der Strich „jetzt“ und die Liste bei „Vorgenommen“ störten.
   Vergangene Termine sollen einzeilig und ohne Klammer stehen.
   Erkennt: fehlende/doppelte Endzeilen, Klammern an Vergangenem oder an
   Aufgaben, zurückgekehrten „jetzt“-Strich oder Listennamen.
   ============================================================ */
function datebookTest() {
  console.log('\n25. Tag wie im Datebook (0.6.2)');
  if (!CL) { return; }
  frisch();
  const heute = CL.isoDatum();
  const morgen = CL.tagePlus(heute, 1);
  const gestern = CL.tagePlus(heute, -1);
  const liste = [
    { id: 'a', zeit: '07:30', bis: '16:00', titel: 'Reisekosten', kontext: 'beruflich', kalId: 'k' },
    { id: 'b', zeit: '08:00', bis: '09:00', titel: 'Ma5080', kontext: 'beruflich', kalId: 'k' },
    { id: 'c', zeit: '13:00', bis: '15:00', titel: 'Block', kontext: 'beruflich', kalId: 'k' },
    { id: 'd', zeit: '15:00', bis: '15:30', titel: 'Zahnarzt', kontext: 'beruflich', kalId: 'k' },
    { id: 'e', zeit: '17:00', bis: '19:00', titel: 'Meeting', kontext: 'beruflich', kalId: 'k' },
    { id: 'f', zeit: '18:00', bis: '19:00', titel: 'Parallel', kontext: 'beruflich', kalId: 'k' }];
  CL.termineNachTag[morgen] = liste;
  CL.termineNachTag[gestern] = liste;
  CL.DB.projekte.push({ id: 'p1', name: 'Büro', flaeche: '[] Offering\n[] Rechnung', status: 'laufend', kontext: 'beruflich', geaendert: 1 });
  CL.DB.tage.push({ id: 'tag-' + morgen, datum: morgen, text: '[] Offering\n[] Rechnung', geaendert: 1,
    eintraege: [{ id: 'e1', abschnitt: 'h', text: 'Offering', quelle: 'p1', erledigt: false, zeit: '11:00' },
                { id: 'e2', abschnitt: 'h', text: 'Rechnung', quelle: 'p1', erledigt: false }] });
  CL.oeffne('kalender');
  CL.clKalGehe(morgen, 'tag');
  const h = inhalt();
  const reihen = h.split('<div class="std').slice(1);
  const z = reihen.map(r => (r.match(/class="z">([^<]*)</) || [])[1]);
  pruefe(z.join(' ') === '7:30 8:00 9:00 11:00 13:00 15:00 15:30 16:00 17:00 18:00 19:00',
    'Endzeilen 9:00, 15:30, 16:00, 19:00 — keine bei 15:00 (dort beginnt der Zahnarzt), 19:00 nur einmal — ' + z.join(' '));
  const zeile = (zeit) => reihen[z.indexOf(zeit)] || '';
  pruefe(/^ ende"/.test(zeile('9:00')) && /^ ende"/.test(zeile('19:00')) && !/^ ende"/.test(zeile('15:00')), 'Endzeilen tragen die Klasse „ende“');
  pruefe(/class="kl"><i class="oben"><\/i><i class=""><\/i>/.test(zeile('7:30')) && /class="kl"><i class="unten"><\/i>/.test(zeile('16:00')),
    'äußere Klammer 7:30 bis 16:00');
  pruefe(/class="kl"><i class="mitte"><\/i><i class="oben"><\/i>/.test(zeile('8:00')) && /<i class="mitte"><\/i><i class="unten"><\/i>/.test(zeile('9:00')),
    'innere Klammer 8:00 bis 9:00 daneben');
  pruefe(/class="kl"><i class="mitte"><\/i><i class="unten"><\/i>/.test(zeile('15:00')),
    '13–15 endet in der Zeile des Zahnarzts');
  pruefe(/class="kl"><i class="mitte"><\/i><i class=""><\/i><\/span><span class="z">11:00/.test(zeile('11:00')) && /clTagZeileUm/.test(zeile('11:00')),
    'eingeplante Aufgabe: eine Zeile, keine eigene Klammer');
  pruefe(!/ jetzt/.test(h) && !/class="std jetzt/.test(h), 'kein Strich „jetzt“ mehr');
  const vorg = h.slice(h.indexOf('>Vorgenommen<'));
  pruefe(/Rechnung/.test(vorg) && !/class="q"/.test(vorg), 'Vorgenommen ohne Listen-/Projektnamen');

  CL.clKalGehe(gestern, 'tag');
  const g = inhalt();
  pruefe(!/class="std ende"/.test(g) && !/<i class="(oben|mitte|unten|einzel)">/.test(g),
    'vergangene Termine: keine Endzeile, keine Klammer');
  pruefe((g.match(/class="std vorbei"/g) || []).length === 6, 'vergangene Termine einzeilig, je eine Zeile');
  pruefe(!/\.std\.jetzt/.test(QUELLE), 'die Regel .std.jetzt ist entfernt');
  CL.clKalGehe(heute, 'tag');
  CL.oeffne('uebersicht');
}

/* ============================================================
   26. Sammlungen (0.7)
   Grund: neue App mit eigenen Feldern, Summen und Auswertungen. Die
   Daten liegen in zwei neuen Bereichen der workbench.json — fehlen
   sie in SAMMLUNGEN, verwirft der Abgleich sie still.
   Erkennt: falsch gelesene oder gezeigte Beträge, falsche Summen und
   Umrechnungen, Kopien mit falschem Inhalt, fehlende Löschvermerke,
   ES2015-Aufrufe (padStart, repeat) im ES5-Code, fehlende Bereiche.
   ============================================================ */
function sammlungenTest() {
  console.log('\n26. Sammlungen (0.7)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  pruefe(/var SAMMLUNGEN = \[[\s\S]*'sammlungen','datensaetze'\]/.test(QUELLE) && Array.isArray(S.DB.sammlungen) && Array.isArray(S.DB.datensaetze),
    'die Bereiche sammlungen und datensaetze kommen aus der Workbench (6.2.3) — sonst gingen sie beim Abgleich verloren');
  const code = (QUELLE.match(/\/\* ---------- Sammlungen \(seit 0\.7\)[\s\S]*?\/\* ---------- Routinen \(seit 0\.5\)/) || [''])[0];
  pruefe(code.length > 1000 && !/padStart|\.repeat\(|=>/.test(code), 'Sammlungen: nur ES5 — kein padStart, repeat oder Pfeilfunktionen');

  pruefe(S.saZahlLesen('1.234,56') === 1234.56 && S.saZahlLesen('14,90') === 14.9 && S.saZahlLesen('14.90') === 14.9
    && S.saZahlLesen('19 €') === 19 && S.saZahlLesen('') === null && S.saZahlLesen('abc') === null, 'Beträge lesen: 1.234,56 · 14,90 · 14.90 · 19 € · leer');
  pruefe(S.saZahlText(1234.5, 2) === '1.234,50' && S.saZahlText(-1870, 0) === '−1.870' && S.saBetragText(8500) === '8.500' && S.saBetragText(14.9) === '14,90',
    'Beträge zeigen: 1.234,50 · −1.870 · 8.500 · 14,90');
  pruefe(S.saMonatePlus('2026-01-31', 1) === '2026-02-28' && S.saMonatePlus('2026-11-15', 2) === '2027-01-15' && S.saMonatePlus('2026-03-10', -3) === '2025-12-10',
    'Monate rechnen: Monatsende, Jahreswechsel, rückwärts');

  /* Budget */
  const b = S.saAusVorlage(S.SA_VORLAGEN.budget, 'Carport', false, [
    { posten: 'Fundament', gewerk: 'Arbeit', plan: 1600, ist: 1890 },
    { posten: 'Bausatz', gewerk: 'Material', plan: 3500, ist: 3580 },
    { posten: 'Dach', gewerk: 'Material', plan: 1900 }]);
  const bu = S.saBudget(b, S.saSaetze(b));
  pruefe(bu.plan === 7000 && bu.ist === 5470 && bu.rest === 1530 && bu.proz === 78, 'Budget: Plan, Ist, Rest und Prozent');
  S.cl.app = 'sammlungen'; S.cl.sa.id = b.id; S.cl.sa.ansicht = 'tabelle';
  S.zeichne();
  let h = inhalt();
  pruefe(/<tr class="sa-gr"><td>Material<\/td><td class="r">5\.400<\/td><td class="r">3\.580<\/td><\/tr>/.test(h), 'Gruppe mit Zwischensumme (Material 5.400 / 3.580)');
  pruefe(/<tr class="sa-sum"><td>Σ 3<\/td><td class="r">7\.000<\/td><td class="r">5\.470<\/td><\/tr>/.test(h), 'Summenzeile unter den Betragsspalten');
  pruefe(/Arbeit \+290 € über Plan/.test(h) && /78 % verbraucht/.test(h), 'Überschreitung je Gruppe und Verbrauch in Prozent');
  pruefe(S.document.getElementById('reiter').textContent === 'Carport', 'der Reiter zeigt den Namen der Sammlung');

  /* Abos */
  const heute = S.isoDatum();
  const a = S.saAusVorlage(S.SA_VORLAGEN.abos, 'Abos', false, [
    { name: 'Kfz', betrag: 312, takt: 'jährlich', status: 'aktiv' },
    { name: 'Handy', betrag: 19.99, takt: 'monatlich', status: 'aktiv', naechste: S.saMonatePlus(heute, -3) },
    { name: 'Zeitung', betrag: 14.9, takt: 'monatlich', status: 'aktiv', laufzeit: S.saMonatePlus(S.tagePlus(heute, 10), 2), frist: 2 },
    { name: 'Alt', betrag: 50, takt: 'monatlich', status: 'gekündigt' }]);
  const da = S.saSaetze(a);
  pruefe(Math.abs(S.saAboMonat(a, da[0]) - 26) < 1e-9, 'Abo: 312 € jährlich = 26 € im Monat');
  pruefe(S.saKennzahl(a) === '60,89 €/Mon', 'Kennzahl pro Monat ohne gekündigte Abos (26 + 19,99 + 14,90)');
  const n = S.saAboNaechste(a, da[1]);
  pruefe(n >= heute && n < S.saMonatePlus(heute, 1) && n.slice(8) === heute.slice(8).replace(/^(29|30|31)$/, n.slice(8)), 'nächste Abbuchung rollt mit dem Takt in die Zukunft');
  pruefe(S.saAboKuendbar(a, da[2]) === S.tagePlus(heute, 10), 'kündbar bis = Laufzeitende minus Frist');
  const hw = S.saHinweise();
  pruefe(hw.length === 1 && hw[0].name === 'Zeitung', 'Hinweis nur für das Abo, das in 30 Tagen kündbar endet');
  S.cl.sa.wahl = {};
  pruefe(S.saFilterWahl(a) === 'aktiv' && S.saGefiltert(a).length === 3, 'Abos zeigen zuerst nur die aktiven');
  S.cl.sa.id = a.id; S.zeichne(); h = inhalt();
  pruefe(/<td class="r">312,00 J<\/td><td class="r">26,00<\/td>/.test(h) && /pro Jahr<\/span><span>730,68 €/.test(h), 'Abo-Liste: Betrag mit Takt, Spalte /Mon, Jahressumme');
  pruefe(/▼ Aktiv/.test(S.document.getElementById('katKnopf').textContent), 'oben rechts steht der Filter der Sammlung');
  S.zeichne();
  pruefe(S.saHinweise().length === 1, 'genau ein Kündigungshinweis');

  /* Bücher und Filter */
  const k = S.saAusVorlage(S.SA_VORLAGEN.buecher, 'Bücher', false, [
    { titel: 'Deep Work', autor: 'Newport', status: 'Gelesen', gelesen: heute, bewertung: 5 },
    { titel: 'Slow', autor: 'Newport', status: 'Gelesen', gelesen: heute, bewertung: 4 },
    { titel: 'Alt', autor: 'Clear', status: 'Gelesen', gelesen: '2019-05-01', bewertung: 3 },
    { titel: 'Wunsch', autor: 'Seneca', status: 'Wunschliste', preis: 24.9 }]);
  S.cl.app = 'sammlungen'; S.cl.sa.id = k.id; S.zeichne(); h = inhalt();
  pruefe(new RegExp('gelesen ' + heute.slice(0, 4) + '</span><span>2<').test(h) && /Ø Bewertung<\/span><span>4,0</.test(h) && /Wunschliste<\/span><span>1 · 24,90 €/.test(h),
    'Bücher: gelesen im Jahr, Ø Bewertung, Wunschliste mit Preis');
  pruefe(/Meistgelesen[\s\S]*Newport[\s\S]*>2</.test(h), 'meistgelesener Autor');
  S.saFilterSetzen('jahr');
  pruefe(S.saGefiltert(k).length === 2 && /▼ Gelesen \d{4}/.test(S.document.getElementById('katKnopf').textContent), 'Filter „Gelesen dieses Jahr“');
  const f0 = { feld: 'titel', op: 'enthaelt', wert: 'EEP' };
  pruefe(S.saPasst(k, S.saSaetze(k)[0], f0) && !S.saPasst(k, S.saSaetze(k)[3], f0), 'Filter „enthält“ ohne Groß/Klein');

  /* Eintrag über das Formular */
  S.saEintrag('');
  const feld = (id, w) => { S.document.getElementById(id).value = w; };
  ['titel', 'autor', 'status', 'gelesen', 'bewertung', 'preis', 'verliehen', 'notiz'].forEach(x => feld('saF_' + x, ''));
  feld('saF_titel', '  Neu  '); feld('saF_preis', '1.234,5'); feld('saF_bewertung', '0');
  S.saEintragSpeichern();
  const neu = S.saSaetze(k).filter(d => d.werte.titel === 'Neu')[0];
  pruefe(neu && neu.werte.preis === 1234.5 && !('bewertung' in neu.werte) && S.cl.aufklapp === '', 'Formular: Text gekürzt, Betrag gelesen, leere Felder bleiben weg');

  /* Kopieren als Vorlage mit Gerüst, dann daraus anlegen */
  S.cl.sa.id = b.id;
  S.saKopierenOeffnen();
  feld('saName', 'Bauprojekt');
  S.saKopieren();
  const v = S.DB.sammlungen.filter(x => x.vorlage)[0];
  pruefe(v && v.name === 'Bauprojekt' && v.saetze.length === 3 && !('plan' in v.saetze[0]) && v.saetze[0].posten === 'Fundament'
    && !S.DB.datensaetze.some(d => d.sammlung === v.id), 'als Vorlage: Gerüst ohne Beträge, keine eigenen Datensätze');
  pruefe(S.saAlle(false).every(x => !x.vorlage), 'Vorlagen stehen nicht in der Liste der Sammlungen');
  S.saNeu(); S.saNeuWahl(v.id); feld('saName', 'Terrasse'); S.saAnlegen();
  const t = S.DB.sammlungen.filter(x => x.name === 'Terrasse')[0];
  pruefe(t && !t.vorlage && t.art === 'budget' && S.saSaetze(t).length === 3 && t.rollen.plan === 'plan', 'aus eigener Vorlage: Budget mit Gerüst und Auswertung');

  /* Felder */
  S.cl.sa.id = t.id;
  S.saFeldNeu();
  feld('saFeldName', 'Menge'); feld('saFeldTyp', 'zahl'); feld('saFeldWerte', ''); feld('saFeldSumme', 'summe');
  S.document.getElementById('saFeldSpalte').checked = false; S.document.getElementById('saFeldGruppe').checked = false;
  S.saFeldSpeichern();
  const fm = t.felder[t.felder.length - 1];
  pruefe(fm.name === 'Menge' && fm.typ === 'zahl' && fm.summe === 'summe' && /^f/.test(fm.id), 'neues Feld mit Typ und Summe');
  S.saFeldSchieben(t.felder.length - 1, -1);
  pruefe(t.felder[t.felder.length - 2] === fm, 'Feld nach oben schieben');

  /* Löschen mit Vermerk */
  const d1 = S.saSaetze(t)[0];
  S.saFensterAuf({ modus: 'eintrag', id: d1.id }); S.saEintragLoeschen();
  pruefe(!S.saSatzFinden(d1.id) && S.DB.grabsteine.some(g => g.s === 'datensaetze' && g.id === d1.id), 'Eintrag löschen setzt einen Löschvermerk');
  S.saSammlungLoeschen();
  pruefe(!S.saFinden(t.id) && !S.DB.datensaetze.some(d => d.sammlung === t.id) && S.DB.grabsteine.some(g => g.s === 'sammlungen' && g.id === t.id),
    'Sammlung löschen nimmt ihre Einträge mit — mit Löschvermerken');
  S.cl.app = 'sammlungen'; S.cl.sa.id = b.id; S.cl.aufklapp = 'menue'; S.aufklappZeichnen();
  const menue = S.document.getElementById('aufklapp').innerHTML;
  pruefe(/menueWahl\('saFelder'\)">Felder…/.test(menue) && /menueWahl\('saKopieren'\)">Kopieren \/ als Vorlage…/.test(menue), 'im Menü einer Sammlung: Felder… und Kopieren / als Vorlage…');
  S.cl.sa.id = ''; S.cl.aufklapp = '';
  S.oeffne('uebersicht');
}

/* ============================================================
   27. Anmeldung über Neustarts und Statistik (0.7.1)
   Grund: Mit zwei Google-Konten auf dem Handy kam bei jedem Start die
   Kontoauswahl. Die Zahlen an den Symbolen sollten einer Statistik
   weichen. Erkennt: Anfragen ohne Kontohinweis, verlorene oder zu alte
   Schlüssel nach einem Neustart, Abmelden ohne Aufräumen, Zahlen an
   den Symbolen, fehlende Blöcke der Statistik.
   ============================================================ */
async function neustartTest() {
  console.log('\n27. Anmeldung über Neustarts und Statistik (0.7.1)');
  if (!CL) { return; }
  frisch();
  const ls = CL.window.localStorage;
  const a = funktionText(SKRIPT, 'anmeldeAnfragen') || '';
  pruefe(/tokenMerken\([^\n]*\n\s*clTokenSichern\(\);\n\s*clKontoMerken\(\);/.test(a), 'nach jeder Anmeldung: Schlüssel sichern und Konto merken');
  pruefe(/klient\.requestAccessToken\(clAnfrage\(aufforderung\)\)/.test(a), 'jede Anfrage an Google geht über clAnfrage (mit Kontohinweis)');
  ls.removeItem('clie-konto');
  let q = CL.clAnfrage('');
  pruefe(q.prompt === '' && !('hint' in q), 'ohne gemerktes Konto: kein Hinweis');
  ls.setItem('clie-konto', 'ich@example.org');
  q = CL.clAnfrage('consent');
  pruefe(q.prompt === 'consent' && q.hint === 'ich@example.org' && q.login_hint === 'ich@example.org', 'mit gemerktem Konto: Hinweis an Google');

  ls.removeItem(CL.TOKEN_KEY);
  ls.setItem('clie-zugriff-lang', JSON.stringify({ t: 'alt', a: Date.now() + 30 * 60000 }));
  pruefe(CL.clTokenHolen() === true && CL.tokenAusSitzung() === true && CL.zugriffToken === 'alt', 'Neustart: ein noch gültiger Schlüssel wird übernommen');
  ls.removeItem(CL.TOKEN_KEY);
  ls.setItem('clie-zugriff-lang', JSON.stringify({ t: 'fast', a: Date.now() + 60000 }));
  pruefe(CL.clTokenHolen() === false && ls.getItem('clie-zugriff-lang') === null, 'ein Schlüssel mit weniger als 2 Minuten wird verworfen');
  CL.zugriffToken = 'neu'; CL.tokenAblauf = Date.now() + 3600000;
  CL.clTokenSichern();
  pruefe(JSON.parse(ls.getItem('clie-zugriff-lang')).t === 'neu', 'ein neuer Schlüssel wird gesichert');

  ls.removeItem('clie-konto');
  CL.fetch = function (adresse) {
    return Promise.resolve({ ok: /drive\/v3\/about\?fields=user\(emailAddress\)/.test(adresse), json() { return Promise.resolve({ user: { emailAddress: 'konto@example.org' } }); } });
  };
  const m = await CL.clKontoMerken();
  pruefe(m === 'konto@example.org' && ls.getItem('clie-konto') === 'konto@example.org', 'das Konto kommt aus Drive (about) und wird gemerkt');
  CL.fetch = function () { return Promise.reject(new Error('kein Netz im Test')); };
  pruefe((await CL.clKontoMerken()) === '' && ls.getItem('clie-konto') === 'konto@example.org', 'ohne Netz bleibt das gemerkte Konto');
  CL.cl.app = 'abgleich'; CL.zeichne();
  pruefe(/Konto<\/span><span>konto@example\.org/.test(inhalt()), 'die Abgleich-App zeigt das Konto');
  CL.clAbmelden();
  pruefe(ls.getItem('clie-konto') === null && ls.getItem('clie-zugriff-lang') === null && !CL.tokenGueltig(), 'Abmelden vergisst Schlüssel und Konto');

  /* Statistik */
  frisch();
  const heute = CL.isoDatum();
  CL.DB.projekte.push({ id: 'p1', name: 'Büro', flaeche: '[] A\n[] B\n[x] C', status: 'laufend', kontext: 'beruflich', geaendert: 1 });
  CL.DB.gedanken.push({ id: 'c1', titel: 'Packen', text: '[] x', checkliste: 'vorlage', kontext: 'privat', geaendert: 1 });
  CL.termineNachTag[heute] = [{ id: 't', zeit: '10:00', bis: '11:00', titel: 'T', kontext: 'privat' }];
  CL.oeffne('uebersicht');
  let h = inhalt();
  /* Seit 0.9 darf an „Heute“ eine Zahl stehen — je nach Uhrzeit; sonst nirgends */
  const ohneHeute = h.replace(/oeffne\('heute'\)"><span class="sym">[\s\S]*?<\/button>/, '');
  pruefe(!/class="zahl"/.test(ohneHeute) && /onclick="oeffne\('statistik'\)">CLIE v[\d.]+ · <u>Statistik<\/u>/.test(h), 'Übersicht ohne Zahlen (außer an „Heute“), die Versionszeile führt zur Statistik');
  CL.cl.aufklapp = 'menue'; CL.aufklappZeichnen();
  pruefe(/menueWahl\('statistik'\)">Statistik/.test(CL.document.getElementById('aufklapp').innerHTML), 'im Menü: Statistik');
  CL.cl.aufklapp = '';
  CL.oeffne('statistik');
  h = inhalt();
  pruefe(CL.document.getElementById('reiter').textContent === 'Statistik', 'der Reiter heißt Statistik');
  ['kalender', 'aufgaben', 'memo', 'checklisten', 'sammlungen', 'routinen', 'abgleich'].forEach(id => {
    pruefe(new RegExp('class="st-kopf" onclick="oeffne\\(\'' + id + '\'\\)">').test(h), 'Block ' + id + ' öffnet die App');
  });
  pruefe(/offen · davon eingeplant<\/span><span>2 · 0</.test(h), 'Aufgaben: offen zählt nur [] — nicht [x]');
  pruefe(/Vorlagen · laufend · erledigt<\/span><span>1 · 0 · 0</.test(h), 'Checklisten gezählt');
  pruefe(/Termine heute · diese Woche<\/span><span>1 · 1</.test(h), 'Termine heute und in der Woche');
  pruefe(/workbench\.json<\/span><span>\d+ KB</.test(h), 'Größe der Datei');
  CL.oeffne('uebersicht');
}

/* ============================================================
   28. Android-Taste Zurück (0.7.2, Leiste seit 0.8 wieder da)
   Grund: Die Leiste unten (Übersicht, Menü, Suchen, Abgleich) kostete
   Platz; Suchen war nur ein Platzhalter. Zurück übernimmt die Taste ◀
   von Android, das Menü der Reiter. Erkennt: zurückgekehrte Leiste,
   Zurück, das Ebenen überspringt oder die App zu früh verlässt.
   ============================================================ */
function zurueckTest() {
  console.log('\n28. Android-Taste Zurück (0.7.2, Leiste seit 0.8 wieder da)');
  if (!CL) { return; }
  frisch();
  pruefe(/<nav class="silk"/.test(QUELLE) && /onclick="oeffne\('uebersicht'\)"><b>⌂<\/b>Übersicht/.test(QUELLE) && /onclick="oeffne\('abgleich'\)"><b>⇅<\/b>Abgleich/.test(QUELLE),
    'seit 0.8 ist die Tastenleiste unten wieder da (Übersicht, Menü, Suchen, Abgleich)');
  pruefe(/id="reiter" onclick="menueUm\(\)"/.test(QUELLE) && /\.reiter::after\{content:" ▾"/.test(QUELLE), 'der Reiter öffnet das Menü und trägt ein ▾');
  pruefe(/addEventListener\('popstate', zurueckGedrueckt\)/.test(SKRIPT), 'die Android-Taste Zurück wird abgefangen');
  let gepusht = 0, zurueck = 0;
  CL.window.history = { pushState() { gepusht++; }, back() { zurueck++; } };
  const s = CL.saAusVorlage(CL.SA_VORLAGEN.frei, 'Test', false, [{ name: 'a' }]);
  CL.oeffne('sammlungen'); CL.saOeffnen(s.id); CL.saAnsicht('felder'); CL.saFeldOeffnen('name');
  const schritte = [];
  const merke = () => schritte.push((CL.cl.aufklapp ? 'fenster' : '') + '|' + CL.cl.app + '|' + (CL.cl.sa.id ? CL.cl.sa.ansicht : 'liste'));
  merke();
  for (let i = 0; i < 4; i++) { CL.zurueckGedrueckt(); merke(); }
  pruefe(schritte.join(' > ') === 'fenster|sammlungen|felder > |sammlungen|felder > |sammlungen|tabelle > |sammlungen|liste > |uebersicht|liste',
    'Zurück: Fenster → Felder → Tabelle → Liste → Übersicht — ' + schritte.join(' > '));
  pruefe(gepusht === 4 && zurueck === 0, 'nach jedem Schritt wird die Taste wieder abgefangen');
  CL.zurueckGedrueckt();
  pruefe(zurueck === 1 && CL.cl.app === 'uebersicht', 'auf der Übersicht verlässt Zurück die App');
  CL.DB.gedanken.push({ id: 'm1', titel: 'Notiz', text: 'x', geaendert: 1 });
  CL.oeffne('memo'); CL.memoOeffnen('m1'); CL.memoSchreibenUm();
  CL.zurueckGedrueckt();
  pruefe(CL.cl.app === 'memo' && CL.cl.memo.id === 'm1' && !CL.cl.memo.schreiben, 'Memo: Zurück beendet zuerst das Schreiben');
  CL.zurueckGedrueckt();
  pruefe(CL.cl.app === 'memo' && !CL.cl.memo.id, 'Memo: dann zur Liste');
  CL.oeffne('kalender'); CL.cl.aufklapp = 'menue';
  CL.tasteGlobal({ key: 'Escape' });
  pruefe(CL.cl.app === 'kalender' && !CL.cl.aufklapp, 'Escape schließt wie Zurück zuerst das Menü');
  CL.tasteGlobal({ key: 'Escape' });
  pruefe(CL.cl.app === 'uebersicht', 'Escape geht dann zur Übersicht');
  CL.window.history = undefined;
}

/* ============================================================
   29. Feste Werte, Formeln und Standardwerte (0.8)
   Grund: Sammlungen brauchen Werte, die als Variable dienen (etwa ein
   Zielgewicht), Felder, die damit rechnen, und Vorbelegungen bei Neu.
   Erkennt: falsche Rechenregeln (Punkt vor Strich, Klammern, Minus),
   Formeln, die Code ausführen könnten, leere statt fehlerhafter Werte,
   Formelwerte in den Daten, falsche Vorbelegung.
   ============================================================ */
function formelTest() {
  console.log('\n29. Feste Werte, Formeln und Standardwerte (0.8)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const r = (t, w) => S.saFormelAuswerten(t, w || (() => null));
  pruefe(r('2 + 3 * 4') === 14 && r('(2 + 3) * 4') === 20 && r('10 - 4 - 3') === 3 && r('-3 + 5') === 2 && r('2 × 3 ÷ 4') === 1.5 && r('1,5 + 1') === 2.5,
    'Rechenregeln: Punkt vor Strich, Klammern, Minus, × ÷, Komma');
  pruefe(r('5 / 0') === null && r('[x] + 1') === null, 'Division durch 0 und fehlende Werte ergeben leer');
  let wirft = 0;
  ['2 +', '(2', 'alert(1)', '2 ** 3', '[a', 'window.x'].forEach(t => { try { r(t); } catch (e) { wirft++; } });
  pruefe(wirft === 6, 'falsche Schreibweise und fremde Zeichen werden abgewiesen (kein Code)');
  pruefe(!/\beval\(|new Function/.test(SKRIPT.slice(SKRIPT.indexOf('---- Formeln (seit 0.8)'), SKRIPT.indexOf('---- Filter, Sortierung, Summen'))), 'das Rechenwerk benutzt weder eval noch Function');

  /* Gewichtstagebuch */
  const g = S.saAusVorlage(S.SA_VORLAGEN.frei, 'Gewicht', false, []);
  g.felder = [{ id: 'dat', name: 'Datum', typ: 'datum', spalte: true, standard: 'heute' },
              { id: 'kg', name: 'kg', typ: 'zahl', spalte: true, summe: 'schnitt', standard: 'zuletzt' },
              { id: 'dz', name: 'Δ Ziel', typ: 'formel', formel: '[kg] - [Zielgewicht]', dez: 1, vorzeichen: true, spalte: true, summe: 'schnitt' },
              { id: 'ort', name: 'Ort', typ: 'text', standard: 'fest', standardWert: 'Bad' }];
  g.werte = [{ id: 'w1', name: 'Zielgewicht', wert: 82, einheit: 'kg' }];
  const neu = (dat, kg, t) => S.DB.datensaetze.push({ id: 'd' + dat, sammlung: g.id, werte: { dat: dat, kg: kg }, angelegt: t, geaendert: t });
  neu('2026-10-12', 86, 1); neu('2026-10-19', 84.6, 3); neu('2026-10-17', 85.3, 2);
  const d = S.saSaetze(g).filter(x => x.id === 'd2026-10-19')[0];
  pruefe(Math.abs(S.saRoh(g, d, g.felder[2]) - 2.6) < 1e-9 && S.saWertText(g.felder[2], S.saRoh(g, d, g.felder[2])) === '+2,6', 'Formel mit festem Wert: 84,6 − 82 = +2,6');
  S.cl.app = 'sammlungen'; S.cl.sa.id = g.id; S.cl.sa.ansicht = 'tabelle'; S.zeichne();
  let h = inhalt();
  pruefe(/<td class="r">84,6<\/td><td class="r">\+2,6<\/td>/.test(h), 'die Formel steht als Spalte in der Tabelle');
  pruefe(/<tr class="sa-sum"><td>Σ 3<\/td><td class="r">85,3<\/td><td class="r">\+3,3<\/td>/.test(h), 'Ø unter Zahl und Formel');
  pruefe(/Feste Werte[\s\S]*Zielgewicht<\/span><span>82 kg/.test(h), 'die festen Werte stehen unter der Tabelle');
  g.werte[0].wert = 84;
  pruefe(Math.abs(S.saRoh(g, d, g.felder[2]) - 0.6) < 1e-9, 'ein neuer fester Wert rechnet sofort neu');
  pruefe(!('dz' in d.werte), 'Formelwerte werden nicht gespeichert');

  /* Standardwerte */
  const st = S.saStandardWerte(g);
  pruefe(st.dat === S.isoDatum() && st.kg === 84.6 && st.ort === 'Bad' && !('dz' in st), 'Neu: Datum heute, kg wie zuletzt angelegt, Ort fest, Formel nicht');
  S.saEintrag('');
  pruefe(/Neu · Gewicht/.test(S.saFensterHtml()) && !/saF_dz/.test(S.saFensterHtml()), 'das Formular für Neu hat kein Eingabefeld für die Formel');

  /* Feld-Editor */
  S.saFensterAuf({ modus: 'feld', id: '' });
  const feld = (id, w) => { S.document.getElementById(id).value = w; };
  ['saFeldWerte', 'saFeldSumme', 'saFeldStd', 'saFeldStdWert'].forEach(x => feld(x, ''));
  S.document.getElementById('saFeldSpalte').checked = false; S.document.getElementById('saFeldGruppe').checked = false; S.document.getElementById('saFeldVz').checked = false;
  feld('saFeldName', 'BMI'); feld('saFeldTyp', 'formel'); feld('saFeldFormel', '[kg] / [Größe] ^ 2'); feld('saFeldDez', '1');
  const vorher = g.felder.length;
  S.saFeldSpeichern();
  pruefe(g.felder.length === vorher && S.cl.aufklapp === 'sa', 'eine falsche Formel wird nicht gespeichert');
  feld('saFeldFormel', '[kg] / ([Größe] * [Größe])');
  S.saFeldSpeichern();
  pruefe(g.felder.length === vorher, 'eine Formel mit unbekanntem Namen wird nicht gespeichert');
  S.saFensterAuf({ modus: 'wert', id: '' });
  feld('saWertName', 'Größe'); feld('saWertZahl', '1,82'); feld('saWertEinheit', 'm');
  S.saWertSpeichern();
  pruefe(g.werte.length === 2 && g.werte[1].wert === 1.82, 'fester Wert über das Fenster angelegt');
  S.saFensterAuf({ modus: 'feld', id: '' });
  ['saFeldWerte', 'saFeldSumme', 'saFeldStd', 'saFeldStdWert'].forEach(x => feld(x, ''));
  feld('saFeldName', 'BMI'); feld('saFeldTyp', 'formel'); feld('saFeldFormel', '[kg] / ([Größe] * [Größe])'); feld('saFeldDez', '1');
  S.saFeldSpeichern();
  const bmi = g.felder[g.felder.length - 1];
  pruefe(bmi.typ === 'formel' && bmi.dez === 1 && S.saWertText(bmi, S.saRoh(g, d, bmi)) === '25,5', 'Formel-Feld mit zwei festen Werten: BMI 25,5');
  S.saFensterAuf({ modus: 'wert', id: '' });
  feld('saWertName', 'kg'); feld('saWertZahl', '1'); feld('saWertEinheit', '');
  S.saWertSpeichern();
  pruefe(g.werte.length === 2, 'ein fester Wert darf nicht heißen wie ein Feld');
  S.cl.aufklapp = '';

  /* Kopie und Vorlage nehmen feste Werte mit */
  const k = S.saAusVorlage(g, 'Kopie', true, []);
  pruefe(k.werte.length === 2 && k.werte !== g.werte && k.felder.some(f => f.typ === 'formel'), 'Kopie/Vorlage übernimmt feste Werte und Formeln');
  S.cl.sa.ansicht = 'werte'; S.zeichne();
  pruefe(S.document.getElementById('reiter').textContent === 'Feste Werte' && /saWertOeffnen/.test(inhalt()) && /\+ Wert/.test(S.document.getElementById('fuss').innerHTML), 'Ansicht „Feste Werte“ mit „+ Wert“');
  S.cl.aufklapp = 'menue'; S.aufklappZeichnen();
  pruefe(/menueWahl\('saWerte'\)">Feste Werte…/.test(S.document.getElementById('aufklapp').innerHTML), 'im Menü: Feste Werte…');
  S.cl.aufklapp = ''; S.cl.sa.id = ''; S.cl.sa.ansicht = 'tabelle';
  S.oeffne('uebersicht');
}

/* ============================================================
   30. Kennzahl und Gruppe in der Liste (0.8.1)
   Grund: Kennzahl und Überschrift hingen fest an der Vorlage — beim
   Gewichtstagebuch stand rechts nur die Zahl der Einträge.
   Erkennt: falsche Kennzahl, verlorene Wahl beim Umschalten im Fenster,
   eigene Gruppen, die nicht oder doppelt erscheinen.
   ============================================================ */
function kennzahlTest() {
  console.log('\n30. Kennzahl und Gruppe in der Liste (0.8.1)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const g = S.saAusVorlage(S.SA_VORLAGEN.frei, 'Gewicht', false, []);
  g.felder = [{ id: 'dat', name: 'Datum', typ: 'datum' }, { id: 'kg', name: 'kg', typ: 'zahl' },
              { id: 'dz', name: 'Δ Ziel', typ: 'formel', formel: '[kg] - [Ziel]', dez: 1, vorzeichen: true }];
  g.werte = [{ id: 'w1', name: 'Ziel', wert: 82, einheit: 'kg' }];
  [[86, 1], [84.6, 3], [85.3, 2]].forEach(x => S.DB.datensaetze.push({ id: 'd' + x[1], sammlung: g.id, werte: { kg: x[0] }, angelegt: x[1], geaendert: 9 }));
  pruefe(S.saKennzahl(g) === '3', 'ohne Wahl: wie die Vorlage (Anzahl)');
  g.kennzahl = { art: 'letzter', feld: 'kg' };
  pruefe(S.saKennzahl(g) === '84,6', 'letzter Wert: aus dem zuletzt angelegten Eintrag');
  g.kennzahl = { art: 'letzter', feld: 'dz' };
  pruefe(S.saKennzahl(g) === '+2,6', 'letzter Wert eines Formelfelds');
  g.kennzahl = { art: 'min', feld: 'kg' };
  pruefe(S.saKennzahl(g) === '84,6', 'Min eines Felds');
  g.kennzahl = { art: 'schnitt', feld: 'dz' };
  pruefe(S.saKennzahl(g) === '+3,3', 'Ø eines Formelfelds');
  g.kennzahl = { art: 'wert', wert: 'w1' };
  pruefe(S.saKennzahl(g) === '82 kg', 'ein fester Wert mit Einheit');
  g.kennzahl = { art: 'letzter', feld: 'weg' };
  pruefe(S.saKennzahl(g) === '3', 'ein gelöschtes Feld fällt auf die Vorlage zurück');

  /* Über das Fenster */
  S.cl.app = 'sammlungen'; S.cl.sa.id = g.id; S.cl.sa.ansicht = 'tabelle';
  S.saDetailsOeffnen();
  const feld = (id, w) => { S.document.getElementById(id).value = w; };
  feld('saName', 'Gewicht'); feld('saGruppe', 'Gesundheit'); feld('saKzArt', 'letzter'); feld('saKzFeld', 'kg'); feld('saKzWert', 'w1');
  S.saKontext('privat');
  pruefe(S.cl.sa.fenster.gruppe === 'Gesundheit' && S.cl.sa.fenster.kzArt === 'letzter', 'Umschalten Beruf/Privat behält die übrige Wahl');
  pruefe(/value="Gesundheit"/.test(S.saFensterHtml()) && /<option value="letzter" selected>/.test(S.saFensterHtml()), 'das Fenster zeigt die Wahl nach dem Neuzeichnen');
  S.saDetailsSpeichern();
  pruefe(g.gruppeName === 'Gesundheit' && g.kennzahl.art === 'letzter' && g.kennzahl.feld === 'kg' && !('wert' in g.kennzahl), 'gespeichert: Gruppe und Kennzahl');
  const b = S.saAusVorlage(S.SA_VORLAGEN.budget, 'Carport', false, []);
  const a = S.saAusVorlage(S.SA_VORLAGEN.abos, 'Abos', false, []);
  a.gruppeName = 'Gesundheit';
  S.cl.sa.id = ''; S.zeichne();
  const h = inhalt();
  pruefe((h.match(/class="gruppe">Gesundheit</g) || []).length === 1 && h.indexOf('>Budgets<') < h.indexOf('>Gesundheit<'), 'eigene Gruppe einmal, nach den Gruppen der Vorlagen');
  const gr = h.slice(h.indexOf('>Gesundheit<'));
  pruefe(/>Abos</.test(gr) && /Gewicht<\/span><span class="sa-kz">84,6</.test(gr), 'beide Sammlungen in ihrer Gruppe, mit eigener Kennzahl');
  pruefe(!/>Verwaltung</.test(h), 'die leere Vorlagen-Gruppe verschwindet');
  S.cl.sa.id = b.id; S.saDetailsOeffnen();
  feld('saName', 'Carport'); feld('saGruppe', 'Budgets'); feld('saKzArt', '');
  S.saDetailsSpeichern();
  pruefe(!('gruppeName' in b) && !('kennzahl' in b), 'Gruppe wie die Vorlage und „wie die Vorlage“ speichern nichts Eigenes');
  S.cl.sa.id = ''; S.cl.aufklapp = '';
  S.oeffne('uebersicht');
}

/* ============================================================
   31. Jahrestermine, Feiertage und Ferien der Workbench (0.8.2)
   Grund: CLIE zeigte nur Google-Termine; im Jahreskalender der
   Workbench stehen dazu eigene Jahrestermine, Feiertage und Ferien.
   Erkennt: fehlende Quellen, falsche Jahreswiederholung, Doppelte,
   falsche Zuordnung Beruf/Privat, Antippen öffnet ein falsches Fenster.
   ============================================================ */
function jahrTest() {
  console.log('\n31. Jahrestermine, Feiertage und Ferien der Workbench (0.8.2)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  ['ostern', 'feiertageVon', 'feiertagAn', 'ferienEintragAn', 'ferienAn', 'woerterVon', 'aehnlichkeit', 'jtDoppelt', 'jtKontext'].forEach(n => {
    pruefe(typeof S[n] === 'function', n + ' ist da (aus der Workbench)');
  });
  if (WB_QUELLE) {
    const wb = WB_QUELLE;
    const gleich = ['feiertageVon', 'feiertagAn', 'ferienAn', 'aehnlichkeit', 'jtKontext'].every(n => funktionText(SKRIPT, n) === funktionText(wb, n));
    pruefe(gleich, 'wörtlich wie in der Workbench');
  }
  pruefe(S.feiertagAn('2026-11-01') === 'Allerheiligen' && S.feiertagAn('2026-06-04') === 'Fronleichnam' && S.feiertagAn('2026-08-15') === 'Mariä Himmelfahrt',
    'Feiertage in Bayern berechnet (Allerheiligen, Fronleichnam 2026, Mariä Himmelfahrt)');
  S.DB.jahrestermine = [
    { id: 'j1', titel: 'Geburtstag Oma', von: '2020-11-03', jaehrlich: true, art: 'geburtstag', geaendert: 1 },
    { id: 'j2', titel: 'Urlaub Borkum', von: '2026-11-02', bis: '2026-11-06', art: 'urlaub', geaendert: 1 },
    { id: 'j3', titel: 'Dienstreise Fürth', von: '2026-11-04', art: 'dienstreise', geaendert: 1 }];
  S.DB.ferien = [{ id: 'f1', titel: 'Herbstferien', von: '2026-11-02', bis: '2026-11-06', art: 'ferien', geaendert: 1 }];
  const titel = (is) => S.clTermineAm(is).ganztags.map(x => (x.zeichen || '◆') + x.titel).join(' | ');
  pruefe(titel('2026-11-03') === '◆Geburtstag Oma | ◆Urlaub Borkum | ·Herbstferien', 'jährlicher Geburtstag, mehrtägiger Urlaub, Ferien — ' + titel('2026-11-03'));
  pruefe(/Geburtstag Oma/.test(titel('2031-11-03')) && !/Geburtstag Oma/.test(titel('2026-11-04')), 'jährlich: jedes Jahr am selben Tag, sonst nicht');
  pruefe(titel('2026-11-01') === '★Allerheiligen', 'Feiertag mit ★');
  S.cl.filter = 'beruflich';
  pruefe(titel('2026-11-04') === '◆Dienstreise Fürth | ·Herbstferien', 'Filter Beruf: nur die Dienstreise (Urlaub ist privat), Ferien bleiben');
  S.cl.filter = 'alle';
  S.termineNachTag['2026-11-03'] = [{ id: 'g1', titel: 'Geburtstag Oma', ganztags: true, zeit: '', bis: '', kontext: 'privat' }];
  S.termineNachTag['2026-11-01'] = [{ id: 'g2', titel: 'Allerheiligen', ganztags: true, zeit: '', bis: '', kontext: 'privat' }];
  pruefe((titel('2026-11-03').match(/Geburtstag Oma/g) || []).length === 1 && S.clTermineAm('2026-11-03').ganztags.some(x => x.id === 'jt-j1'),
    'doppelt in Google und Workbench: nur einmal — die eigene Fassung bleibt (Voreinstellung)');
  S.DB.einstellungen.doppelBehalten = 'kalender';
  pruefe(S.clTermineAm('2026-11-03').ganztags.some(x => x.id === 'g1') && !S.clTermineAm('2026-11-03').ganztags.some(x => x.id === 'jt-j1'),
    'mit „doppelBehalten: kalender“ bleibt die Google-Fassung');
  delete S.DB.einstellungen.doppelBehalten;
  pruefe(titel('2026-11-01') === '★Allerheiligen', 'ein Feiertag aus einem Google-Feiertagskalender erscheint nicht doppelt');

  /* Anzeige */
  S.oeffne('kalender'); S.clKalGehe('2026-11-03', 'tag');
  let h = inhalt();
  pruefe(/class="ganztags gz-jahrestermin" onclick="clJahrZeigen\('2026-11-03','jt-j1'\)">◆ Geburtstag Oma/.test(h), 'Tag: Jahrestermin antippbar, ohne Terminfenster');
  pruefe(/class="ganztags gz-ferien"[^>]*>· Herbstferien/.test(h), 'Tag: Ferien als leise Zeile');
  S.clJahrZeigen('2026-11-03', 'jt-j2');
  pruefe(/Urlaub Borkum\n02\.11\. – 06\.11\.\nJahrestermin aus der Workbench/.test(S.document.getElementById('toastText').textContent), 'Antippen zeigt Titel, Zeitraum und Herkunft');
  S.clKalGehe('2026-11-01', 'tag');
  pruefe(/class="ganztags gz-feiertag"[^>]*>★ Allerheiligen/.test(inhalt()), 'Tag: Feiertag mit ★');
  S.clKalGehe('2026-10-28', 'woche');
  const w1 = inhalt();
  S.clKalGehe('2026-11-02', 'woche');
  pruefe(/<div>★ Allerheiligen<\/div>/.test(w1) && /<div>· Herbstferien<\/div>/.test(inhalt()), 'Woche: Feiertag und Ferien mit Zeichen');
  S.clKalGehe('2026-11-03', 'bloecke');
  pruefe(/class="wb-ganz" onclick="clJahrZeigen\('2026-11-03','jt-j1'\)">Geburtstag Oma/.test(inhalt()), 'Wochenblöcke: Jahrestermine in der Ganztags-Zeile');
  S.clKalGehe(S.isoDatum(), 'tag');
  S.oeffne('uebersicht');
}

/* ============================================================
   32. Heute (0.9)
   Grund: eine Ansicht nur für das, was heute noch offen ist, mit einer
   Zahl an der App und unten in der Leiste (statt „Menü“).
   Erkennt: falsch Gezähltes (Ganztägiges, begonnene oder vorbeie
   Termine), fehlende Abschnitte, Zahl, die nach dem Abhaken nicht sinkt.
   ============================================================ */
function heuteTest() {
  console.log('\n32. Heute (0.9)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const altUhr = S.clUhrzeit;
  S.clUhrzeit = () => '14:35';
  const heute = S.isoDatum();
  const wt = S.ausIso(heute).getDay();
  S.termineNachTag[heute] = [
    { id: 'a', zeit: '09:00', bis: '11:00', titel: 'Vorbei', kontext: 'privat' },
    { id: 'b', zeit: '14:00', bis: '15:30', titel: 'Läuft gerade', kontext: 'privat' },
    { id: 'c', zeit: '15:00', bis: '16:00', titel: 'Zahnarzt', kontext: 'privat' },
    { id: 'd', zeit: '19:30', bis: '21:00', titel: 'Elternabend', kontext: 'beruflich' },
    { id: 'g', zeit: '', bis: '', titel: 'Geburtstag Oma', ganztags: true, kontext: 'privat' }];
  S.DB.projekte.push({ id: 'p1', name: 'Büro', flaeche: '[] Rechnung prüfen\n[] Offering\n[] Rückruf Becker\n[x] Fertig', status: 'laufend', kontext: 'privat', geaendert: 1 });
  S.DB.tage.push({ id: 'tag-' + heute, datum: heute, text: '[] Rechnung prüfen\n[] Offering\n[] Rückruf Becker\n[x] Fertig', geaendert: 1, eintraege: [
    { id: 'e1', abschnitt: 'h', text: 'Rechnung prüfen', quelle: 'p1', erledigt: false },
    { id: 'e2', abschnitt: 'h', text: 'Offering', quelle: 'p1', erledigt: false },
    { id: 'e3', abschnitt: 'h', text: 'Rückruf Becker', quelle: 'p1', erledigt: false, zeit: '17:00' },
    { id: 'e4', abschnitt: 'h', text: 'Fertig', quelle: 'p1', erledigt: true }] });
  S.DB.aufgaben.push({ id: 'r1', titel: 'Oskar laufen lassen', wiederholung: { takt: 'woche', tage: [wt], intervall: 1 }, kontext: 'privat', geaendert: 1 });
  S.DB.aufgaben.push({ id: 'r2', titel: 'Pausiert', wiederholung: { takt: 'woche', tage: [wt], intervall: 1 }, pausiert: true, geaendert: 1 });
  S.DB.gedanken.push({ id: 'c1', titel: 'Packliste', text: '[x] a\n[] b', checkliste: 'lauf', kontext: 'privat', geaendert: 1 });
  const d = S.clHeuteDaten();
  pruefe(d.zahl === 6, 'gezählt: 2 kommende Termine, 1 Aufgabe mit Uhrzeit, 2 vorgenommene, 1 Routine = 6 (ist ' + d.zahl + ')');
  pruefe(d.posten.map(p => p.titel).join(' | ') === 'Zahnarzt | Rückruf Becker | Elternabend', 'Als Nächstes: nach Zeit, ohne Begonnenes und Vorbei');
  pruefe(!d.posten.some(p => /Vorbei|Läuft/.test(p.titel)), 'begonnene und beendete Termine fehlen');
  S.oeffne('heute');
  let h = inhalt();
  pruefe(S.document.getElementById('reiter').textContent === 'Heute ' + S.clWt(heute) + ' ' + S.clKurzDatum(heute), 'Reiter: Heute mit Datum');
  pruefe(/class="heute-kopf">Als Nächstes: Zahnarzt <b>in 25 Min\.<\/b>/.test(h), 'oben: als Nächstes mit Countdown');
  pruefe(/◆ Geburtstag Oma/.test(h), 'Ganztägiges steht oben, ungezählt');
  pruefe(/>Vorgenommen</.test(h) && /Rechnung prüfen/.test(h) && />Routinen</.test(h) && /Oskar laufen lassen/.test(h) && !/Pausiert/.test(h), 'Vorgenommen und Routinen, ohne Pausiertes');
  pruefe(/>Hinweise</.test(h) && /☑ Packliste · 1\/2/.test(h), 'Hinweise: laufende Checkliste');
  pruefe(/1 erledigt · zeigen/.test(h) && !/>Fertig</.test(h), 'Erledigtes ist eingeklappt');
  pruefe(S.document.getElementById('heuteZahl').textContent === '6', 'die Zahl steht unten in der Leiste');
  pruefe(S.clCountdown('19:30', '14:35') === 'um 19:30' && S.clCountdown('14:35', '14:35') === 'jetzt', 'ab einer Stunde die Uhrzeit, sonst Minuten');
  S.clTagZeileUm(heute, 0);
  pruefe(S.clHeuteZahl() === 5 && S.document.getElementById('heuteZahl').textContent === '5' && /2 erledigt · zeigen/.test(inhalt()), 'Abhaken senkt die Zahl sofort');
  S.clHeuteErlUm();
  pruefe(/>Erledigt</.test(inhalt()) && /class="hz erl"/.test(inhalt()), 'Erledigtes lässt sich zeigen');
  S.clHeuteErlUm();
  S.katSetzen('beruflich');
  pruefe(S.clHeuteDaten().posten.map(p => p.titel).join(' | ') === 'Elternabend', 'der Filter ▼ gilt auch hier');
  S.katSetzen('alle');
  S.oeffne('uebersicht');
  pruefe(/oeffne\('heute'\)"><span class="sym"><svg[^]*?<span class="zahl">5</.test(inhalt()), 'auf der Übersicht dieselbe Zahl an „Heute“');
  pruefe(/onclick="oeffne\('heute'\)"><b>◉<\/b>Heute<span id="heuteZahl"/.test(QUELLE) && !/<nav class="silk"[^]*?menueUm\(\)[^]*?<\/nav>/.test(QUELLE) && /⌕<\/b>Suchen/.test(QUELLE),
    'Leiste unten: Heute statt Menü, Suchen bleibt');
  pruefe(/onclick="aufNeuAm\(isoDatum\(\),\\?'\\?'\)">Neu/.test(SKRIPT) || /aufNeuAm\(isoDatum\(\)/.test(SKRIPT), 'unten: Neu für heute');
  S.clUhrzeit = altUhr;
  S.zeichne();
}

/* ============================================================
   33. Vorlage Training (0.9.1)
   Grund: Trainingsplan für Multisport mit Plan, Ist und Ergebnis
   (geschafft / teilweise / ausgefallen) und eigener Wochenauswertung.
   Erkennt: falsche Wochensummen, Einheiten außerhalb der Woche, falsche
   Quote, falsch gerechnete Formeln, fehlender Filter „Diese Woche“.
   ============================================================ */
function trainingTest() {
  console.log('\n33. Vorlage Training (0.9.1)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const mo = S.montagVon(S.isoDatum());
  const t = S.saAusVorlage(S.SA_VORLAGEN.training, 'Training', false, [
    { dat: mo, sport: 'Lauf', einheit: 'GA1', pmin: 60, imin: 50, pkm: 10, ikm: 9, ergebnis: 'geschafft' },
    { dat: S.tagePlus(mo, 1), sport: 'Schwimmen', einheit: '6×200', pmin: 50, imin: 40, pkm: 2.2, ikm: 1.8, ergebnis: 'teilweise' },
    { dat: S.tagePlus(mo, 2), sport: 'Rad', einheit: 'Rolle', pmin: 60, ergebnis: 'ausgefallen' },
    { dat: S.tagePlus(mo, 5), sport: 'Lauf', einheit: 'lang', pmin: 100, pkm: 18 },
    { dat: S.tagePlus(mo, -3), sport: 'Lauf', einheit: 'Vorwoche', pmin: 45, imin: 45, ergebnis: 'geschafft' }]);
  pruefe(t.art === 'training' && t.werte.length === 1 && t.werte[0].name === 'Wochenziel' && t.rollen.wochenziel === 'wziel', 'Vorlage mit festem Wert „Wochenziel“');
  pruefe(t.felder.filter(f => f.spalte).map(f => f.name).join(',') === 'Datum,Einheit,Ergebnis', 'Spalten: Datum, Einheit, Ergebnis');
  const w = S.saTrainingWoche(t);
  pruefe(w.plan === 270 && w.ist === 90 && w.reihe.join(',') === 'Schwimmen,Rad,Lauf', 'Woche: Plan 4:30 h, Ist 1:30 h, Sportarten in fester Reihenfolge — ohne die Vorwoche');
  pruefe(w.sport.Lauf.plan === 160 && w.sport.Lauf.km === 9, 'je Sportart summiert');
  pruefe(w.erg.geschafft === 1 && w.erg.teilweise === 1 && w.erg.ausgefallen === 1 && w.erg.offen === 1, 'Ergebnisse der Woche gezählt');
  pruefe(S.saStunden(90) === '1:30' && S.saStunden(5) === '0:05', 'Minuten als Stunden');
  const sch = S.saSaetze(t).filter(d => d.werte.sport === 'Schwimmen')[0];
  pruefe(S.saWertText(S.saFeld(t, 'erf'), S.saRoh(t, sch, S.saFeld(t, 'erf'))) === '82' && S.saWertText(S.saFeld(t, 'pace'), S.saRoh(t, sch, S.saFeld(t, 'pace'))) === '22,22',
    'Formeln: Erfüllung 82 %, Pace 22,22 min/km');
  S.cl.app = 'sammlungen'; S.cl.sa.id = t.id; S.cl.sa.ansicht = 'tabelle'; S.cl.sa.wahl = {};
  S.zeichne();
  let h = inhalt();
  pruefe(/Schwimmen · 6×200<\/td><td class="">◐<\/td>/.test(h), 'Tabelle: Sportart vor der Einheit, Ergebnis als Zeichen' + (/Schwimmen · 6×200/.test(h) ? '' : ' — ' + (h.match(/<tr class="sa-z"[^]*?<\/tr>/) || [''])[0]));
  pruefe(/<table class="sa-tab sa-dat">/.test(h) && new RegExp('<td class="">' + S.clKurzDatum(mo) + '</td>').test(h), 'Datum kurz (ohne Jahr) und schmale Datumsspalte');
  pruefe(/Diese Woche · KW \d+/.test(h) && /Lauf<\/span><span>0:50 \/ 2:40 h · 9 km/.test(h), 'Auswertung: Lauf Ist / Plan und km');
  pruefe(/1:30 von 8:00 h Wochenziel · 19 %/.test(h), 'Balken gegen das Wochenziel');
  pruefe(/✓ 1 · ◐ 1 · ✗ 1 · offen 1<\/span><span>Quote 50 %/.test(h), 'Verteilung und Quote (2 von 4 bewerteten in der Liste)');
  S.saFilterSetzen('woche');
  pruefe(S.saGefiltert(t).length === 4, 'Filter „Diese Woche“');
  S.saFilterSetzen('offen');
  pruefe(S.saGefiltert(t).length === 1, 'Filter „Offen“: noch ohne Ergebnis');
  pruefe(S.saKennzahl(t) === '1:30 h/Wo', 'Kennzahl in der Liste: Ist-Stunden der Woche');
  pruefe(S.saStandardWerte(t).dat === S.isoDatum(), 'Neu: Datum heute');
  pruefe(/saNeuWahl\('training'\)/.test((S.saNeu(), S.saFensterHtml())), '„Training“ steht bei Neu… unter den Vorlagen');
  S.cl.aufklapp = ''; S.cl.sa.fenster = null; S.cl.sa.id = '';
  S.oeffne('uebersicht');
}

/* ============================================================
   34. Suchen (0.10)
   Grund: „Suchen“ war ein Platzhalter. Jetzt durchsucht es alle Apps,
   gruppiert und sortiert die Treffer und öffnet sie.
   Erkennt: Treffer, die fehlen (Umlaute, Groß/klein, Filter ▼),
   doppelte mehrtägige Termine, falsche Reihenfolge, Erledigtes ohne
   Schalter, Treffer, die das Falsche öffnen.
   ============================================================ */
function suchenTest() {
  console.log('\n34. Suchen (0.10)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  const plus = n => S.tagePlus(heute, n);
  pruefe(S.suNorm('Größe Übung') === 'groesse uebung', 'vereinheitlicht: klein, ä/ö/ü, ß');
  const f = S.suFinde('Die Größe', 'groesse');
  pruefe(f && f.a === 4 && f.e === 9 && f.wort, 'Treffer im Original: „Größe“ für „groesse“, am Wortanfang');
  pruefe(S.suMarkiert('Fahrrad putzen', 'RAD', false) === 'Fahr<mark>rad</mark> putzen', 'Hervorhebung im Original, Groß/klein egal');
  pruefe(S.suTreffer('c').length === 0, 'erst ab 2 Zeichen');

  S.termineNachTag[plus(-5)] = [{ id: 't1', zeit: '10:00', bis: '11:00', titel: 'Bauamt wegen Carport', kontext: 'privat' }];
  S.termineNachTag[plus(3)] = [{ id: 't2', zeit: '16:00', bis: '17:00', titel: 'Angebot Carport', kontext: 'beruflich' }];
  S.termineNachTag[plus(1)] = [{ id: 't3', zeit: '', bis: '', titel: 'Urlaub', beschreibung: 'Carport-Bau beaufsichtigen', ganztags: true, kontext: 'privat' }];
  S.termineNachTag[plus(2)] = [{ id: 't3', zeit: '', bis: '', titel: 'Urlaub', beschreibung: 'Carport-Bau beaufsichtigen', ganztags: true, kontext: 'privat' }];
  S.DB.themen.push({ id: 'l1', name: 'Haus', text: '[] Statik für Carport anfragen\n[x] Carport vermessen\n[] Rasen', kontext: 'privat', geaendert: 1 });
  S.DB.projekte.push({ id: 'p1', name: 'Baulücke', flaeche: 'Fundament für den Carport mit Punktfundamenten', status: 'laufend', kontext: 'privat', geaendert: 5 });
  S.DB.gedanken.push({ id: 'c1', titel: 'Carport-Abnahme', text: '[] Dach', checkliste: 'vorlage', kontext: 'privat', geaendert: 1 });
  const sa = S.saAusVorlage(S.SA_VORLAGEN.budget, 'Carport', false, [{ posten: 'Bausatz', gewerk: 'Material', plan: 3500 }, { posten: 'Lasur', notiz: 'für Carport-Holz', plan: 300 }]);
  S.DB.aufgaben.push({ id: 'r1', titel: 'Carport fegen', wiederholung: { takt: 'woche', tage: [1], intervall: 1 }, geaendert: 1 });
  S.cl.filter = 'beruflich';
  const t = S.suTreffer('carport');
  const g = n => t.filter(x => x.gruppe === n);
  pruefe(g('termine').length === 3, 'Termine: drei — der mehrtägige nur einmal');
  pruefe(g('termine').map(x => x.unter.indexOf('vorbei') >= 0 ? 'v' : 'k').join('') === 'kkv', 'Termine: kommende zuerst, Vergangenes zuletzt');
  pruefe(/Urlaub/.test(g('termine')[0].titel) && /Angebot/.test(g('termine')[1].titel), 'Termine: der nächste oben (morgen vor in drei Tagen)');
  pruefe(/<mark>Carport<\/mark>-Bau/.test(g('termine')[0].unter), 'Treffer in der Beschreibung: Ausschnitt darunter');
  pruefe(g('aufgaben').length === 1 && /Statik/.test(g('aufgaben')[0].titel), 'Aufgaben: Erledigtes ohne Schalter nicht');
  pruefe(g('memo').length === 1 && /Baulücke/.test(g('memo')[0].titel) && /<mark>Carport<\/mark>/.test(g('memo')[0].unter), 'Memo: Treffer im Text mit Ausschnitt');
  pruefe(g('checklisten').length === 1 && g('routinen').length === 1, 'Checklisten und Routinen');
  pruefe(g('sammlungen').length === 2 && /Sammlung · 2 Einträge/.test(g('sammlungen')[0].unter) && /Lasur/.test(g('sammlungen')[1].titel),
    'Sammlungen: erst die Sammlung, dann der Eintrag (Treffer in der Notiz)');
  pruefe(t.length === 9, 'der Filter ▼ (Beruf) gilt bei der Suche nicht — alles wird gefunden');
  S.cl.filter = 'alle';
  S.cl.su.erl = true;
  pruefe(S.suTreffer('carport').filter(x => x.gruppe === 'aufgaben').length === 2, '„auch Erledigtes“ zeigt die erledigte Aufgabe');
  S.cl.su.erl = false;
  pruefe(S.suTreffer('rad').length === 0 && S.suTreffer('ARPO').length === 9, 'mitten im Wort und in Großbuchstaben');

  /* Bedienen */
  S.oeffne('suchen');
  pruefe(S.document.getElementById('reiter').textContent === 'Suchen' && /id="suchFeld"/.test(inhalt()), 'Suchen: Reiter und Feld');
  S.document.getElementById('suchFeld').value = 'carport';
  S.suGetippt();
  let h = S.document.getElementById('suchErgebnis').innerHTML;
  pruefe(/class="su-gruppe"><span>Termine<\/span><span>3<\/span>/.test(h) && /\+0 weitere/.test(h) === false, 'Gruppe mit Anzahl');
  const gruppen = (h.match(/class="su-gruppe"><span>([^<]+)/g) || []).map(x => x.replace(/.*<span>/, ''));
  pruefe(gruppen.join(',') === 'Termine,Aufgaben,Memo,Checklisten,Sammlungen,Routinen', 'Gruppen in fester Reihenfolge — ' + gruppen.join(','));
  for (let i = 0; i < 3; i++) { S.DB.themen[0].text += '\n[] Carport Punkt ' + i; }
  S.suGetippt();
  h = S.document.getElementById('suchErgebnis').innerHTML;
  pruefe((h.match(/class="su-treffer"/g) || []).length === 3 + 3 + 1 + 1 + 2 + 1 && /\+1 weitere/.test(h), 'je Gruppe höchstens 3, dazu „+1 weitere“');
  S.suGruppeAuf('aufgaben');
  pruefe(!/\+1 weitere/.test(S.document.getElementById('suchErgebnis').innerHTML), '„weitere“ klappt die Gruppe auf');
  S.suMerken('carport'); S.suMerken('Becker'); S.suMerken('CARPORT');
  pruefe(S.cl.su.zuletzt.join(',') === 'CARPORT,Becker', 'zuletzt gesucht: ohne Doppelte, Neuestes vorn');
  S.document.getElementById('suchFeld').value = '';
  S.suGetippt();
  pruefe(/su-chip" onclick="suZuletzt\(0\)">CARPORT/.test(S.document.getElementById('suchErgebnis').innerHTML), 'leeres Feld: die letzten Suchbegriffe');

  /* Öffnen */
  S.suSammlung(sa.id, S.saSaetze(sa)[1].id);
  pruefe(S.cl.app === 'sammlungen' && S.cl.sa.id === sa.id && S.cl.aufklapp === 'sa' && S.cl.sa.fenster.id === S.saSaetze(sa)[1].id, 'Sammlungs-Treffer öffnet den Eintrag');
  S.aufklappZu();
  S.suMemo('p1');
  pruefe(S.cl.app === 'memo' && S.cl.memo.id === 'p1', 'Memo-Treffer öffnet die Seite');
  S.suAufgabe('l1', 0);
  pruefe(S.cl.app === 'aufgaben' && S.cl.aufklapp === 'aufgabe', 'Aufgaben-Treffer öffnet die Aufgabe');
  S.aufklappZu();
  S.suRoutine('r1');
  pruefe(S.cl.app === 'routinen' && S.cl.aufklapp === 'routine', 'Routinen-Treffer öffnet die Routine');
  S.aufklappZu();
  pruefe(/onclick="oeffne\('suchen'\)"><b>⌕<\/b>Suchen/.test(QUELLE) && !/disabled title="Kommt später"/.test(QUELLE), 'Suchen unten ist kein Platzhalter mehr');
  S.cl.su = { text: '', erl: false, auf: {}, zuletzt: [] };
  S.oeffne('uebersicht');
}

/* ============================================================
   35. Trend und Feldtyp Link (0.11)
   Grund: Werte sollen sich mit dem vorigen Eintrag vergleichen lassen
   (vorher[Feld]), und Sammlungen brauchen Links.
   Erkennt: falscher Vorgänger (Reihenfolge nach Datum, nicht nach
   Eingabe), Trend ohne Vorgänger, Links mit javascript: oder ohne
   Schema, Link-Adresse im onclick, Zeile öffnet statt Link.
   ============================================================ */
function trendTest() {
  console.log('\n35. Trend und Feldtyp Link (0.11)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  pruefe(S.saFormelAuswerten('[a] - vorher[a]', (n, v) => v ? 3 : 5) === 2 && S.saFormelAuswerten('vorher [a]', (n, v) => v ? 7 : 0) === 7,
    'vorher[…] und vorher […] werden erkannt');
  const g = S.saAusVorlage(S.SA_VORLAGEN.frei, 'Gewicht', false, []);
  g.felder = [{ id: 'dat', name: 'Datum', typ: 'datum', spalte: true }, { id: 'kg', name: 'kg', typ: 'zahl', spalte: true },
              { id: 'tr', name: 'Trend', typ: 'formel', formel: '[kg] - vorher[kg]', dez: 1, trend: true, spalte: true }];
  /* Absichtlich nicht in Datumsfolge angelegt */
  const neu = (id, dat, kg, t) => S.DB.datensaetze.push({ id: id, sammlung: g.id, werte: { dat: dat, kg: kg }, angelegt: t, geaendert: t });
  neu('a', '2026-10-17', 85.1, 1); neu('b', '2026-10-19', 84.6, 2); neu('c', '2026-10-12', 86.0, 3); neu('d', '2026-10-18', 85.3, 4); neu('e', '2026-10-16', 85.1, 5);
  const satz = id => S.saSatzFinden(id);
  pruefe(S.saVorher(g, satz('b')).id === 'd' && S.saVorher(g, satz('a')).id === 'e' && S.saVorher(g, satz('c')) === null, 'Vorgänger nach Datum, nicht nach Eingabe; der älteste hat keinen');
  const tr = g.felder[2];
  const txt = id => S.saWertText(tr, S.saRoh(g, satz(id), tr));
  pruefe(txt('b') === '▼ −0,7' && txt('d') === '▲ +0,2' && txt('a') === '► 0,0' && txt('c') === '', 'als Trend: ▼ −0,7 · ▲ +0,2 · ► 0,0 · ohne Vorgänger leer — ' + [txt('b'), txt('d'), txt('a'), txt('c')].join(' | '));
  satz('c').werte.dat = '2026-10-20'; satz('c').geaendert = 9;
  pruefe(S.saVorher(g, satz('c')).id === 'b' && txt('e') === '', 'nach einer Datumsänderung stimmt die Reihenfolge wieder (kein alter Zwischenspeicher)');
  satz('c').werte.dat = '2026-10-12'; satz('c').geaendert = 10;
  g.kennzahl = { art: 'letzter', feld: 'tr' };
  pruefe(S.saKennzahl(g) === '▼ −0,7', 'Kennzahl „letzter Wert“: der jüngste Eintrag nach Datum (19.10.), nicht der zuletzt angelegte');
  pruefe(S.saFormelPruefen(g, '[kg] - vorher[kg]', tr) === '' && S.saFormelPruefen(g, 'vorher[Trend]', tr) === '' && /gibt es nicht/.test(S.saFormelPruefen(g, 'vorher[Gewicht]', tr)),
    'Prüfen: vorher[…] kennt alle Felder, auch das eigene; Unbekanntes wird abgewiesen');
  const pz = { id: 'pz', name: 'Prozent', typ: 'formel', formel: '([kg] - vorher[kg]) / vorher[kg] * 100', dez: 1, vorzeichen: true };
  g.felder.push(pz);
  pruefe(S.saWertText(pz, S.saRoh(g, satz('d'), pz)) === '+0,2', 'Veränderung in Prozent mit vorher[…]');

  /* Link */
  pruefe(S.saLinkGueltig('https://www.thalia.de/buch?id=1') && S.saLinkGueltig('http://x.de') && !S.saLinkGueltig('javascript:alert(1)') && !S.saLinkGueltig('www.thalia.de') && !S.saLinkGueltig('https://a.de/"onmouseover=x'),
    'Links: nur http/https, keine Anführungszeichen');
  pruefe(S.saLinkKurz('https://www.thalia.de/buch?id=1') === 'thalia.de', 'in der Liste nur der Rechnername');
  const b = S.saAusVorlage(S.SA_VORLAGEN.frei, 'Bücher', false, [{ name: 'Deep Work', url: 'https://www.thalia.de/deep' }, { name: 'Ohne' }]);
  b.felder.push({ id: 'url', name: 'Link', typ: 'link', spalte: true });
  S.cl.app = 'sammlungen'; S.cl.sa.id = b.id; S.cl.sa.ansicht = 'tabelle'; S.zeichne();
  const h = inhalt();
  pruefe(/<button type="button" class="sa-link" onclick="event\.stopPropagation\(\);saLinkOeffnen\('[^']+','url'\)">↗ thalia\.de<\/button>/.test(h) && !/thalia\.de\/deep/.test(h),
    'Liste: ↗ thalia.de, öffnet über Kennungen (die Adresse steht nicht im onclick), ohne die Zeile zu öffnen');
  let geoeffnet = [];
  const altOpen = S.window.open;
  S.window.open = (u, z) => { geoeffnet.push(u + '|' + z); return {}; };
  S.saLinkOeffnen(S.saSaetze(b)[0].id, 'url');
  pruefe(geoeffnet.join() === 'https://www.thalia.de/deep|_blank', 'Antippen öffnet die Adresse in einem neuen Tab');
  S.saEintrag(S.saSaetze(b)[0].id);
  pruefe(/type="url"[^>]*value="https:\/\/www\.thalia\.de\/deep"/.test(S.saFensterHtml()) && /saFormLinkOeffnen\('url'\)">↗ Öffnen/.test(S.saFensterHtml()), 'Formular: Adressfeld mit „↗ Öffnen“');
  S.document.getElementById('saF_name').value = 'Deep Work';
  S.document.getElementById('saF_notiz').value = '';
  S.document.getElementById('saF_url').value = 'javascript:alert(1)';
  S.saEintragSpeichern();
  pruefe(S.saSaetze(b)[0].werte.url === 'https://www.thalia.de/deep' && S.cl.aufklapp === 'sa', 'eine ungültige Adresse wird nicht gespeichert');
  S.saFormLinkOeffnen('url');
  pruefe(geoeffnet.length === 1, 'auch „Öffnen“ öffnet keine ungültige Adresse');
  S.window.open = altOpen;
  S.cl.aufklapp = ''; S.cl.sa.fenster = null;
  pruefe(S.suTreffer('thalia').some(x => x.gruppe === 'sammlungen'), 'die Suche findet Links über die volle Adresse');
  S.cl.sa.id = '';
  S.oeffne('uebersicht');
}

/* ============================================================
   36. Zwei Kennzahlen und vier Spalten (0.11.1)
   Grund: In der Liste der Sammlungen sollen zwei Werte stehen, in der
   Tabelle bis zu vier Spalten.
   Erkennt: Kennzahl 2 ohne Wahl sichtbar, Wahl geht im Fenster verloren,
   mehr als vier oder nur drei Spalten, „/Mon“ der Abos verdrängt.
   ============================================================ */
function vierTest() {
  console.log('\n36. Zwei Kennzahlen und vier Spalten (0.11.1)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const g = S.saAusVorlage(S.SA_VORLAGEN.frei, 'Gewicht', false, []);
  g.felder = [{ id: 'dat', name: 'Datum', typ: 'datum', spalte: true }, { id: 'kg', name: 'kg', typ: 'zahl', spalte: true },
              { id: 'tr', name: 'Trend', typ: 'formel', formel: '[kg] - vorher[kg]', dez: 1, trend: true, spalte: true },
              { id: 'dz', name: 'Δ Ziel', typ: 'formel', formel: '[kg] - 82', dez: 1, vorzeichen: true, spalte: true },
              { id: 'n', name: 'Notiz', typ: 'text', spalte: true }];
  [['2026-10-18', 85.3, 1], ['2026-10-19', 84.6, 2]].forEach(x => S.DB.datensaetze.push({ id: 'd' + x[2], sammlung: g.id, werte: { dat: x[0], kg: x[1] }, angelegt: x[2], geaendert: x[2] }));
  pruefe(S.saSpalten(g).map(f => f.name).join(',') === 'Datum,kg,Trend,Δ Ziel', 'höchstens vier Spalten — die fünfte bleibt weg');
  S.cl.app = 'sammlungen'; S.cl.sa.id = g.id; S.cl.sa.ansicht = 'tabelle'; S.zeichne();
  pruefe(/<table class="sa-tab sa-dat sa-vier">/.test(inhalt()) && /<td class="r">▼ −0,7<\/td><td class="r">\+2,6<\/td>/.test(inhalt()), 'Tabelle mit vier Spalten, schmaler gesetzt');
  const ab = S.saAusVorlage(S.SA_VORLAGEN.abos, 'Abos', false, []);
  ab.felder.forEach(f => { if (f.id === 'takt' || f.id === 'naechste') { f.spalte = true; } });
  pruefe(S.saSpalten(ab).map(f => f.id).join(',') === 'name,betrag,takt,_mon', 'Abos: drei Felder und „/Mon“ als letzte Spalte');
  S.saFensterAuf({ modus: 'feld', id: 'n' });
  pruefe(/id="saFeldSpalte" type="checkbox" checked>/.test(S.saFensterHtml()), 'eine fünfte markierte Spalte bleibt im Editor sichtbar markiert');
  S.saFensterAuf({ modus: 'feld', id: '' });
  pruefe(/disabled> als Spalte in der Liste \(schon 4\)/.test(S.saFensterHtml()), 'Editor: mehr als vier gehen nicht („schon 4“)');
  g.felder[4].spalte = false;
  S.saFensterAuf({ modus: 'feld', id: '' });
  pruefe(/disabled> als Spalte in der Liste \(schon 4\)/.test(S.saFensterHtml()), 'bei vier markierten ist Schluss');
  S.cl.aufklapp = '';

  /* Zwei Kennzahlen */
  pruefe(S.saKennzahl2(g) === '', 'ohne Wahl keine Kennzahl 2');
  S.saDetailsOeffnen();
  const feld = (id, w) => { S.document.getElementById(id).value = w; };
  feld('saName', 'Gewicht'); feld('saGruppe', ''); feld('saKzArt', 'letzter'); feld('saKzFeld', 'kg'); feld('saKzWert', '');
  feld('saKz2Art', 'letzter'); feld('saKz2Feld', 'tr'); feld('saKz2Wert', '');
  S.saKontext('beruflich');
  pruefe(S.cl.sa.fenster.kz2Art === 'letzter' && S.cl.sa.fenster.kz2Feld === 'tr' && /<option value="tr" selected>/.test(S.saFensterHtml()), 'Kennzahl 2 bleibt beim Umschalten im Fenster erhalten');
  pruefe(/<select id="saKz2Art" class="eingabe"><option value="">keine<\/option>/.test(S.saFensterHtml()), 'Kennzahl 2 kann „keine“ sein');
  S.saDetailsSpeichern();
  pruefe(g.kennzahl.feld === 'kg' && g.kennzahl2.art === 'letzter' && g.kennzahl2.feld === 'tr', 'beide Kennzahlen gespeichert');
  S.cl.sa.id = ''; S.zeichne();
  pruefe(/Gewicht<\/span><span class="sa-kz">84,6<small>▼ −0,7<\/small><\/span>/.test(inhalt()), 'Liste: Kennzahl 1 groß, Kennzahl 2 klein darunter');
  pruefe(!/Abos<\/span><span class="sa-kz">[^<]*<small>/.test(inhalt()), 'ohne Kennzahl 2 nur ein Wert');
  S.cl.sa.id = g.id; S.saDetailsOeffnen();
  feld('saName', 'Gewicht'); feld('saGruppe', ''); feld('saKzArt', 'letzter'); feld('saKzFeld', 'kg'); feld('saKz2Art', ''); feld('saKz2Feld', 'tr');
  S.saDetailsSpeichern();
  pruefe(!('kennzahl2' in g), '„keine“ entfernt Kennzahl 2 wieder');
  S.cl.sa.id = '';
  S.oeffne('uebersicht');
}

/* ============================================================
   37. Prioritäten P1–P3 (0.12, gemeinsam mit Workbench 6.3.0)
   Grund: Aufgaben bekommen eine Priorität als Kürzel „P1 “ vor dem Text.
   Erkennt: Kürzel sichtbar statt Zeichen, Einplanung verloren beim
   Ändern, falsche Sortierung, Kürzel doppelt beim Speichern, Funktionen
   nicht aus der Workbench.
   ============================================================ */
function prioTest() {
  console.log('\n37. Prioritäten P1–P3 (0.12)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  if (WB_QUELLE) {
    pruefe(['kpPrio', 'kpPrioText', 'kpPrioSetzenKern'].every(n => funktionText(SKRIPT, n) === funktionText(WB_QUELLE, n)), 'Kern-Funktionen wörtlich wie in der Workbench');
  }
  const heute = S.isoDatum();
  S.DB.themen.push({ id: 'l1', name: 'Haus', text: '[] Keller aufräumen\n[] P2 Rasen vertikutieren\n[] P1 Statik anfragen\n[] P3 Ablage', kontext: 'privat', geaendert: 1 });
  S.DB.tage.push({ id: 'tag-' + heute, datum: heute, text: '[] Keller aufräumen\n[] P2 Rasen vertikutieren', geaendert: 1, eintraege: [
    { id: 'e1', abschnitt: 'h', text: 'Keller aufräumen', quelle: 'l1', erledigt: false },
    { id: 'e2', abschnitt: 'h', text: 'P2 Rasen vertikutieren', quelle: 'l1', erledigt: false }] });
  S.cl.auf.prioSort = true;
  S.oeffne('aufgaben');
  let h = inhalt();
  const reihe = (h.match(/class="tx umbruch"[^>]*>([^<]+)</g) || []).map(x => x.replace(/.*>/, '').replace(/<$/, ''));
  pruefe(reihe.join(' | ') === 'Statik anfragen | Rasen vertikutieren | Ablage | Keller aufräumen', 'nach Priorität sortiert, ohne Kürzel im Text — ' + reihe.join(' | '));
  pruefe(/class="prio p1" onclick="aufPrioUm\('l1',2\)"[^>]*>1</.test(h) && /class="prio p0" onclick="aufPrioUm\('l1',0\)"[^>]*><\/button>/.test(h), 'Zeichen 1 … und ein leerer Platz zum Setzen');
  S.aufPrioSortUm();
  const reihe2 = (inhalt().match(/class="tx umbruch"[^>]*>([^<]+)</g) || []).map(x => x.replace(/.*>/, '').replace(/<$/, ''));
  pruefe(reihe2[0] === 'Keller aufräumen' && !S.cl.auf.prioSort, '„↕ Liste“: Reihenfolge wie in der Liste');
  S.aufPrioSortUm();

  /* Antippen schaltet weiter — die Einplanung im Tag zieht mit */
  S.aufPrioUm('l1', 0);
  pruefe(/\[\] P1 Keller aufräumen/.test(S.DB.themen[0].text) && /\[\] P1 Keller aufräumen/.test(S.DB.tage[0].text) && S.DB.tage[0].eintraege[0].text === 'P1 Keller aufräumen',
    'Antippen: – → 1, auch im eingeplanten Tag');
  S.aufPrioUm('l1', 1); S.aufPrioUm('l1', 1);
  pruefe(/\[\] Rasen vertikutieren/.test(S.DB.themen[0].text) && S.DB.tage[0].eintraege[1].text === 'Rasen vertikutieren', '2 → 3 → – entfernt das Kürzel wieder');

  /* Fenster */
  S.aufDetails('l1', 2);
  pruefe(S.cl.auf.fenster.text === 'Statik anfragen' && S.cl.auf.fenster.prio === 1 && /onclick="aufPrioWahl\(1\)">1/.test(S.aufFensterHtml()) && /class="an" onclick="aufPrioWahl\(1\)"/.test(S.aufFensterHtml()),
    'Details: Text ohne Kürzel, Priorität als Wahl');
  S.document.getElementById('aufText').value = 'Statik anfragen';
  S.aufPrioWahl(3);
  S.document.getElementById('aufText').value = 'Statik anfragen';
  S.aufSpeichern();
  pruefe(/\[\] P3 Statik anfragen/.test(S.DB.themen[0].text) && !/P1 Statik/.test(S.DB.themen[0].text), 'Speichern setzt die gewählte Priorität — ohne doppeltes Kürzel');
  S.aufNeu();
  S.cl.auf.fenster.seite = 'l1';
  S.document.getElementById('aufText').value = 'P2 Hecke schneiden';
  S.aufSpeichern();
  pruefe(/\[\] P2 Hecke schneiden$/.test(S.DB.themen[0].text), 'getipptes „P2 …“ wird als Priorität übernommen');

  /* Anzeige anderswo */
  S.oeffne('heute');
  h = inhalt();
  pruefe(/<span class="prio p1">1<\/span>Keller aufräumen/.test(h) && !/P1 Keller/.test(h), 'Heute: Zeichen statt Kürzel');
  const vg = h.slice(h.indexOf('>Vorgenommen<'));
  pruefe(vg.indexOf('Keller') < vg.indexOf('Rasen'), 'Heute: Vorgenommenes nach Priorität');
  S.oeffne('kalender'); S.clKalGehe(heute, 'tag');
  pruefe(/<span class="prio p1">1<\/span>Keller aufräumen/.test(inhalt()), 'Kalender-Tag: Zeichen statt Kürzel');
  pruefe(S.suTreffer('keller').some(x => /<span class="prio p1">1<\/span><mark>Keller<\/mark>/.test(x.titel)), 'Suche: Zeichen und Treffer im Text ohne Kürzel');
  S.oeffne('uebersicht');
}

/* ============================================================
   38. Memo-Liste zweizeilig (0.12.1)
   Grund: lange Seitentitel wurden nach einer Zeile abgeschnitten.
   Erkennt: Rückfall auf einzeilig, unbegrenzte Höhe.
   ============================================================ */
function memoZweiTest() {
  console.log('\n38. Memo-Liste zweizeilig (0.12.1)');
  const css = (QUELLE.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
  const regel = (css.match(/\.memo-zeile \.tx\{[^}]*\}/) || [''])[0];
  pruefe(/white-space:normal/.test(regel) && /-webkit-line-clamp:2/.test(regel) && /max-height:2\.5em/.test(regel) && !/nowrap/.test(regel),
    'Titel in der Memo-Liste: bis zu zwei Zeilen, dann abgeschnitten');
}

/* ============================================================
   39. Ruhende Projekte im Memo (0.12.2)
   Grund: Die Memo-Liste blendete alles aus, was nicht läuft — ruhende
   Projekte und Ziele waren nicht zu sehen.
   Erkennt: wieder ausgeblendete ruhende Seiten, Abgeschlossenes, das
   offen statt eingeklappt steht.
   ============================================================ */
function memoRuhtTest() {
  console.log('\n39. Ruhende Projekte im Memo (0.12.2)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.DB.projekte.push({ id: 'p1', name: 'Läuft', flaeche: '', status: 'laufend', geaendert: 1 });
  S.DB.projekte.push({ id: 'p2', name: 'Carport', flaeche: '', status: 'ruht', geaendert: 1 });
  S.DB.ziele.push({ id: 'z1', name: 'Marathon', flaeche: '', status: 'ruht', geaendert: 1 });
  S.DB.projekte.push({ id: 'p3', name: 'Altes Projekt', flaeche: '', status: 'abgeschlossen', geaendert: 1 });
  S.oeffne('memo');
  let h = inhalt();
  const ruhend = h.slice(h.indexOf('>Ruhend<'), h.indexOf('Abgeschlossen'));
  pruefe(/Carport/.test(ruhend) && /Marathon/.test(ruhend) && !/Läuft/.test(ruhend), 'ruhende Projekte und Ziele in eigener Gruppe „Ruhend“');
  pruefe(/› Abgeschlossen · 1/.test(h) && !/Altes Projekt/.test(h), 'Abgeschlossenes eingeklappt');
  S.memoFertigUm();
  pruefe(/▾ Abgeschlossen · 1/.test(inhalt()) && /Altes Projekt/.test(inhalt()), 'aufgeklappt sichtbar');
  S.memoFertigUm();
  S.oeffne('uebersicht');
}

/* ============================================================
   40. Feste Werte als Datum, Tage in Formeln (0.13)
   Grund: Feste Werte sollen auch ein Datum sein können, und Formeln
   sollen Tage zwischen zwei Daten rechnen (auch bis/seit heute).
   Erkennt: falsche Tageszahl (Zeitumstellung, Schaltjahr), Datum als
   Zahl angezeigt, „heute“ nicht erkannt, Wechsel Zahl/Datum kaputt.
   ============================================================ */
function datumTest() {
  console.log('\n40. Feste Werte als Datum, Tage in Formeln (0.13)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  pruefe(S.saTagNr('2026-10-25') - S.saTagNr('2026-10-24') === 1 && S.saTagNr('2026-03-30') - S.saTagNr('2026-03-28') === 2, 'Tage über die Zeitumstellung hinweg');
  pruefe(S.saTagNr('2028-03-01') - S.saTagNr('2028-02-28') === 2 && S.saTagNr('2026-13-01') === null && S.saTagNr('') === null, 'Schaltjahr, ungültige Daten leer');
  const heute = S.isoDatum();
  pruefe(S.saFormelAuswerten('heute - 1', () => null) === S.saTagNr(heute) - 1 && S.saFormelAuswerten('HEUTE', () => null) === S.saTagNr(heute), '„heute“ in Formeln (Groß/klein egal)');
  const g = S.saAusVorlage(S.SA_VORLAGEN.frei, 'Projekt', false, []);
  g.felder = [{ id: 'dat', name: 'Datum', typ: 'datum', spalte: true }, { id: 'fae', name: 'Fällig', typ: 'datum' },
              { id: 'tage', name: 'Tag', typ: 'formel', formel: '[Datum] - [Start]', dez: 0, spalte: true },
              { id: 'rest', name: 'Rest', typ: 'formel', formel: '[Ziel] - heute', dez: 0, vorzeichen: true },
              { id: 'verz', name: 'Verzug', typ: 'formel', formel: '[Datum] - [Fällig]', dez: 0 },
              { id: 'abst', name: 'Abstand', typ: 'formel', formel: '[Datum] - vorher[Datum]', dez: 0 }];
  g.werte = [{ id: 'w1', name: 'Start', typ: 'datum', wert: '2026-10-01' }, { id: 'w2', name: 'Ziel', typ: 'datum', wert: S.tagePlus(heute, 72) }];
  S.DB.datensaetze.push({ id: 'a', sammlung: g.id, werte: { dat: '2026-10-11', fae: '2026-10-08' }, angelegt: 1, geaendert: 1 });
  S.DB.datensaetze.push({ id: 'b', sammlung: g.id, werte: { dat: '2026-10-20' }, angelegt: 2, geaendert: 2 });
  const w = (id, f) => S.saWertText(S.saFeld(g, f), S.saRoh(g, S.saSatzFinden(id), S.saFeld(g, f)));
  pruefe(w('a', 'tage') === '10' && w('b', 'tage') === '19', 'Datum minus fester Datumswert = Tage seit dem Start');
  pruefe(w('a', 'rest') === '+72', 'fester Datumswert minus heute = Tage bis dahin');
  pruefe(w('a', 'verz') === '3' && w('b', 'verz') === '', 'zwei Datumsfelder: Verzug — fehlt eines, bleibt es leer');
  pruefe(w('b', 'abst') === '9' && w('a', 'abst') === '', 'Tage seit dem vorigen Eintrag');
  S.cl.app = 'sammlungen'; S.cl.sa.id = g.id; S.cl.sa.ansicht = 'tabelle'; S.zeichne();
  pruefe(/Start<\/span><span>01\.10\.2026</.test(inhalt()), 'fester Datumswert unter der Tabelle als Datum');
  g.kennzahl = { art: 'wert', wert: 'w1' };
  pruefe(S.saKennzahl(g) === '01.10.2026', 'auch als Kennzahl');
  pruefe(S.saFormelPruefen(g, '[Ziel] - heute', S.saFeld(g, 'rest')) === '', 'Prüfen kennt „heute“');

  /* Fenster: Art wechseln, speichern */
  S.saWertOeffnen('');
  const feld = (id, v) => { S.document.getElementById(id).value = v; };
  feld('saWertName', 'Abgabe');
  S.saWertArt('datum');
  pruefe(S.cl.sa.fenster.name === 'Abgabe' && /id="saWertDatum" class="eingabe" type="date"/.test(S.saFensterHtml()) && !/saWertZahl/.test(S.saFensterHtml()), 'Art „Datum“: Datumsfeld statt Zahl — der Name bleibt');
  feld('saWertName', 'Abgabe'); feld('saWertDatum', '');
  S.saWertSpeichern();
  pruefe(g.werte.length === 2 && S.cl.aufklapp === 'sa', 'ohne Datum wird nicht gespeichert');
  feld('saWertDatum', '2026-12-31');
  S.saWertSpeichern();
  const ab = g.werte[2];
  pruefe(ab && ab.typ === 'datum' && ab.wert === '2026-12-31' && !('einheit' in ab), 'Datumswert gespeichert');
  S.saWertOeffnen(ab.id);
  pruefe(/class="an" onclick="saWertArt\('datum'\)"/.test(S.saFensterHtml()) && /value="2026-12-31"/.test(S.saFensterHtml()), 'beim Öffnen steht die Art auf Datum');
  feld('saWertName', 'Abgabe');
  S.saWertArt('zahl');
  feld('saWertName', 'Abgabe'); feld('saWertZahl', '5'); feld('saWertEinheit', 'Tage');
  S.saWertSpeichern();
  pruefe(!('typ' in ab) && ab.wert === 5 && ab.einheit === 'Tage', 'zurück auf Zahl');
  S.cl.aufklapp = ''; S.cl.sa.id = '';
  S.oeffne('uebersicht');
}

/* ============================================================
   41. Kopfwerte und fester Kopf (0.14)
   Grund: Bei vielen Einträgen rutschten Werte und Überschrift aus dem
   Bild. Jetzt stehen bis zu 4 Kopfwerte und die Spaltenüberschrift fest,
   nur die Einträge scrollen.
   Erkennt: Kopf nicht mehr fest (sticky), Überschrift und Spalten nicht
   bündig, falscher Zeitraum, mehr als 6 Kopfwerte (seit 0.14.1).
   ============================================================ */
function kopfTest() {
  console.log('\n41. Kopfwerte und fester Kopf (0.14)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const css = (QUELLE.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
  pruefe(/\.sa-fest\{position:sticky;top:-6px/.test(css), 'der Kopf steht fest (sticky im Inhaltsbereich)');
  const heute = S.isoDatum();
  const g = S.saAusVorlage(S.SA_VORLAGEN.frei, 'Gewicht', false, []);
  g.felder = [{ id: 'dat', name: 'Datum', typ: 'datum', spalte: true }, { id: 'kg', name: 'kg', typ: 'zahl', spalte: true }];
  g.werte = [{ id: 'w1', name: 'Ziel', wert: 82, einheit: 'kg' }];
  [[0, 84], [-3, 85], [-10, 86], [-40, 90]].forEach((x, i) => S.DB.datensaetze.push({ id: 'd' + i, sammlung: g.id, werte: { dat: S.tagePlus(heute, x[0]), kg: x[1] }, angelegt: 10 - i, geaendert: 1 }));
  pruefe(S.saZeitraumListe(g, '').length === 4 && S.saZeitraumListe(g, '7').length === 2 && S.saZeitraumListe(g, '30').length === 3, 'Zeiträume: alle 4, letzte 7 Tage 2, letzte 30 Tage 3');
  pruefe(S.saKopfwertText(g, { art: 'schnitt', feld: 'kg', zeitraum: '30' }) === '85,0' && S.saKopfwertText(g, { art: 'schnitt', feld: 'kg' }) === '86,3',
    'Ø über den Zeitraum — und über alle');
  pruefe(S.saKopfwertText(g, { art: 'letzter', feld: 'kg' }) === '84' && S.saKopfwertText(g, { art: 'wert', wert: 'w1', zeitraum: '7' }) === '82 kg', 'letzter Wert; fester Wert ohne Zeitraum');
  pruefe(S.saKopfwertName(g, { art: 'schnitt', feld: 'kg', zeitraum: '30' }) === 'Ø kg · letzte 30 Tage' && S.saKopfwertName(g, { name: 'aktuell', art: 'letzter', feld: 'kg' }) === 'aktuell',
    'Bezeichnung automatisch oder eigene');

  /* Fenster */
  S.cl.app = 'sammlungen'; S.cl.sa.id = g.id; S.cl.sa.ansicht = 'kopf'; S.zeichne();
  pruefe(S.document.getElementById('reiter').textContent === 'Kopfwerte' && /saKopfOeffnen\(-1\)">\+ Kopfwert/.test(S.document.getElementById('fuss').innerHTML), 'Ansicht Kopfwerte mit „+ Kopfwert“');
  const feld = (id, v) => { S.document.getElementById(id).value = v; };
  for (let i = 0; i < 7; i++) {
    S.saKopfOeffnen(-1);
    feld('saKwName', 'K' + i); feld('saKwArt', 'letzter'); feld('saKwFeld', 'kg'); feld('saKwWert', 'w1'); feld('saKwZr', '');
    S.saKopfSpeichern();
  }
  pruefe(g.kopfwerte.length === 6 && g.kopfwerte[5].name === 'K5', 'höchstens sechs Kopfwerte (seit 0.14.1)');
  S.zeichne();
  pruefe(/saKopfOeffnen\(-1\)" disabled>\+ Kopfwert/.test(S.document.getElementById('fuss').innerHTML), 'bei sechs ist „+ Kopfwert“ gesperrt');
  pruefe(/<div class="sa-kw sa-kw3">/.test(S.saKopfwerteHtml(g)), 'ab fünf Kacheln drei nebeneinander');
  S.saKopfOeffnen(0);
  feld('saKwName', ''); feld('saKwArt', 'schnitt'); feld('saKwFeld', 'kg'); feld('saKwZr', '30');
  S.saKopfSpeichern();
  pruefe(g.kopfwerte[0].art === 'schnitt' && g.kopfwerte[0].zeitraum === '30' && !g.kopfwerte[0].name, 'Kopfwert ändern');
  S.saKopfSchieben(0, 1);
  pruefe(g.kopfwerte[1].art === 'schnitt', 'Reihenfolge ändern');
  S.saKopfOeffnen(5); S.saKopfLoeschen(); S.saKopfOeffnen(4); S.saKopfLoeschen(); S.saKopfOeffnen(3); S.saKopfLoeschen();
  pruefe(g.kopfwerte.length === 3 && /<div class="sa-kw">/.test(S.saKopfwerteHtml(g)), 'Kopfwert löschen — bis vier wieder zwei nebeneinander');

  /* Tabelle: fester Kopf und bündige Spalten */
  S.saAnsicht('tabelle');
  const h = inhalt();
  pruefe(/^<div class="sa-fest"><div class="sa-kw">/.test(h) && /<small>Ø kg · letzte 30 Tage<\/small><b>85,0<\/b>/.test(h), 'Kacheln oben im festen Kopf');
  pruefe(/<table class="sa-tab sa-dat sa-kopf"><tr><th class="">Datum<\/th><th class="r">kg<\/th><\/tr><\/table><\/div><table class="sa-tab sa-dat">/.test(h),
    'Überschrift im festen Kopf, Einträge in einer zweiten Tabelle mit gleichen Spalten');
  const k = S.saAusVorlage(g, 'Kopie', true, []);
  pruefe(k.kopfwerte.length === 3 && k.kopfwerte !== g.kopfwerte, 'Kopie und Vorlage übernehmen die Kopfwerte');
  S.cl.aufklapp = 'menue'; S.aufklappZeichnen();
  pruefe(/menueWahl\('saKopf'\)">Kopfwerte…/.test(S.document.getElementById('aufklapp').innerHTML), 'im Menü: Kopfwerte…');
  S.cl.aufklapp = ''; S.cl.sa.id = '';
  S.oeffne('uebersicht');
}

/* ============================================================
   42. Liste als Text bearbeiten (0.15)
   Grund: Eigene Schritte unter einer Aufgabe (freie Textzeilen in der
   Listenseite) ließen sich in CLIE nicht anlegen — die Aufgabenansicht
   zeigt nur Kästchen-Zeilen.
   Erkennt: Menüeintrag fehlt oder steht auch ohne Liste, Schreibfeld
   zeigt nicht die ganze Seite, Textzeilen oder Aufgaben gehen beim
   Speichern verloren, „Fertig“/Zurück landen nicht wieder in der Liste.
   ============================================================ */
function listeTextTest() {
  console.log('\n42. Liste als Text bearbeiten (0.15)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.DB.themen.push({ id: 'lh', name: 'Haus', kontext: 'privat', text: '[] Fenster warten – Magnat anrufen\n[] Lampe tauschen', geaendert: 1 });
  S.oeffne('aufgaben');
  S.aufListeSetzen('');
  S.katUm();
  pruefe(!/listeAlsText/.test(S.document.getElementById('aufklapp').innerHTML), 'ohne gewählte Liste kein „als Text bearbeiten“');
  S.aufklappZu();
  S.aufListeSetzen('lh');
  S.katUm();
  pruefe(/onclick="listeAlsText\(\)">„Haus“ als Text bearbeiten …/.test(S.document.getElementById('aufklapp').innerHTML), 'im Reiter-Menü: „Haus“ als Text bearbeiten …');
  S.listeAlsText();
  pruefe(S.cl.app === 'memo' && S.cl.memo.schreiben && S.cl.aufklapp === ''
    && inhalt().indexOf('<textarea id="memoFeld" class="memo-feld" spellcheck="true" oninput="memoTextGetippt()">' + S.esc(S.DB.themen[0].text) + '</textarea>') >= 0,
    'Schreibfeld zeigt die ganze Listenseite');
  const feld = S.document.getElementById('memoFeld');
  feld.value = '[] Fenster warten – Magnat anrufen\n    › Auftrag ausfüllen\n    › Wartung einplanen\n[] Lampe tauschen';
  S.memoTextGetippt();
  pruefe(/› Auftrag ausfüllen/.test(S.DB.themen[0].text) && S.kpOffeneZahl(S.kpSeiteFinden('lh')) === 2, 'Textzeilen gespeichert, beide Aufgaben bleiben');
  pruefe(/memoSchreibenUm\(\)">Fertig/.test(S.document.getElementById('fuss').innerHTML), 'unten „Fertig“');
  S.memoSchreibenUm();
  pruefe(S.cl.app === 'aufgaben' && S.cl.auf.liste === 'lh' && !S.cl.memo.id && !S.cl.memo.ausListe, '„Fertig“ führt zurück zur Liste „Haus“');
  pruefe(/Fenster warten/.test(inhalt()) && !/Auftrag ausfüllen/.test(inhalt()), 'Aufgabenansicht zeigt weiter nur die Aufgaben');
  S.listeAlsText();
  S.clZurueck();
  pruefe(S.cl.app === 'aufgaben' && S.cl.auf.liste === 'lh' && !S.cl.memo.schreiben, 'Zurück-Taste führt ebenfalls zur Liste');
  S.listeAlsText();
  S.oeffne('uebersicht'); S.oeffne('memo');
  pruefe(!S.cl.memo.ausListe && !S.cl.memo.id && /Noch keine Seiten|memo-zeile/.test(inhalt()), 'später im Memo: normale Übersicht, keine Liste');
  S.oeffne('uebersicht');
}

/* ============================================================
   43. Zeichen ▶ „läuft“ in der Schreibleiste (0.15.2)
   Grund: Eine Oberzeile („- P2 Fenster warten“) soll sichtbar als laufend
   markiert werden — nur ein Zeichen wie „-“, ohne weitere Funktion.
   (Die Automatik aus 0.15.1 ist zurückgenommen.)
   Erkennt: Knopf fehlt, ▶ wird nicht gesetzt/entfernt, „-“ bleibt stehen,
   Zeilen darunter verändert, Automatik-▶ wieder in Liste oder Heute.
   ============================================================ */
function laufZeichenTest() {
  console.log('\n43. Zeichen ▶ „läuft“ in der Schreibleiste (0.15.2)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const unten = '\n  [] P2 Magnat und Eckert Georg anrufen\n  - Angebot vergeben\n  - Termin machen';
  S.DB.themen.push({ id: 'lh', name: 'Haus', kontext: 'privat', text: '- P2 Fenster und Türen warten lassen' + unten, geaendert: 1 });
  S.oeffne('aufgaben'); S.aufListeSetzen('lh');
  S.listeAlsText();
  pruefe(/onclick="memoZeichen\('lauf'\)" aria-label="läuft">▶<\/button><\/div>/.test(inhalt()), 'Schreibleiste: Knopf ▶ nach •');
  const feld = S.document.getElementById('memoFeld');
  feld.value = S.DB.themen[0].text; feld.selectionStart = 3;
  S.memoZeichen('lauf');
  pruefe(S.DB.themen[0].text === '▶ P2 Fenster und Türen warten lassen' + unten, 'ein Tipp: „-“ wird zu „▶“, die Zeilen darunter bleiben');
  feld.selectionStart = 3;
  S.memoZeichen('lauf');
  pruefe(S.DB.themen[0].text === 'P2 Fenster und Türen warten lassen' + unten, 'zweiter Tipp nimmt ▶ wieder weg');
  feld.selectionStart = 3;
  S.memoZeichen('lauf'); S.memoZeichen('punkt');
  pruefe(S.DB.themen[0].text === '- P2 Fenster und Türen warten lassen' + unten, '• ersetzt ▶ wieder durch „-“');
  S.memoZeichen('lauf');
  S.memoSchreibenUm();
  const h = inhalt();
  pruefe(/Magnat und Eckert Georg anrufen/.test(h) && !/▶/.test(h) && !/Fenster und Türen/.test(h), 'Liste: nur die Aufgabe, ohne ▶ und ohne Oberzeile');
  pruefe(typeof S.clHauptaufgabe === 'undefined' && !/\.lf\{/.test(QUELLE), 'Automatik aus 0.15.1 entfernt');
  S.oeffne('uebersicht');
}

/* ============================================================
   44. Checklisten-Punkte einplanen (0.16, Stufe 1)
   Grund: Einzelne Punkte einer laufenden Checkliste sollen als Aufgabe in
   Heute und im Kalender erscheinen — optional, nur einige.
   Erkennt: Punkt lässt sich nicht einplanen/ausplanen, Marke fehlt,
   Herkunft fehlt in Heute/Kalender, Abhaken in Heute zählt nicht in der
   Checkliste (oder umgekehrt), Zurücksetzen/Löschen lassen Reste im Tag,
   Vorlagen lassen sich einplanen.
   ============================================================ */
function clsPlanTest() {
  console.log('\n44. Checklisten-Punkte einplanen (0.16, Stufe 1)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  const morgen = S.tagePlus(heute, 1);
  const feld = (id, v) => { S.document.getElementById(id).value = v; };
  S.cl.cls.id = ''; S.cl.cls.schreiben = false; S.cl.cls.fenster = null;
  S.DB.gedanken.push({ id: 'c1', titel: 'Urlaub Borkum', text: '## Vorher\n[] Koffer packen\n[] Müll rausstellen\n[] Ladekabel', kontext: 'privat', checkliste: 'lauf', gestartet: heute, ordnung: 1, geaendert: 1 });
  S.DB.gedanken.push({ id: 'v1', titel: 'Vorlage', text: '[] Punkt', kontext: 'privat', checkliste: 'vorlage', ordnung: 2, geaendert: 1 });
  const c = S.DB.gedanken[0];
  S.oeffne('checklisten'); S.clsOeffnen('c1');
  pruefe(/onclick="clsPlanOeffnen\('c1',1\)">Koffer packen<\/button>/.test(inhalt()), 'laufende Checkliste: Tipp auf den Text öffnet „Punkt einplanen“');
  S.clsOeffnen('v1');
  pruefe(!/clsPlanOeffnen/.test(inhalt()), 'Vorlage: nichts einzuplanen');
  S.clsOeffnen('c1');
  S.clsPlanOeffnen('c1', 1);
  let a = S.document.getElementById('aufklapp').innerHTML;
  pruefe(/Punkt einplanen/.test(a) && /id="clsDatum"/.test(a) && /clsPlanZeitUm/.test(a), 'Fenster mit Datum und Uhrzeit');
  feld('clsDatum', morgen);
  S.clsPlanOk();
  pruefe(S.aufGeplant(S.kpSeiteFinden('c1'), 'Koffer packen').datum === morgen && /\[\] Koffer packen/.test(S.kpTagFinden(morgen).text), 'eingeplant: im Tag der Workbench (morgen)');
  pruefe(new RegExp('<span class="plan-marke">' + S.clWt(morgen) + ' ').test(inhalt()), 'Marke rechts am Punkt');
  S.clsPlanOeffnen('c1', 2);
  feld('clsDatum', heute);
  S.clsPlanZeitUm();
  feld('clsDatum', heute); feld('clsZeit', '07:00');
  S.clsPlanOk();
  const e = S.kpEintraegeFinden('c1', 'Müll rausstellen')[0];
  pruefe(e && e.woche.datum === heute && e.eintrag.zeit === '07:00', 'mit Uhrzeit eingeplant');
  S.clsPlanOeffnen('c1', 3);
  feld('clsDatum', S.tagePlus(heute, -1));
  S.clsPlanOk();
  pruefe(!S.kpEintraegeFinden('c1', 'Ladekabel').length, 'ein vergangener Tag wird abgelehnt');
  S.aufklappZu();
  /* Heute und Kalender */
  S.oeffne('heute');
  let h = inhalt();
  pruefe(/Müll rausstellen<small class="herkunft">☑ Urlaub Borkum<\/small>/.test(h), 'Heute: mit Herkunft „☑ Urlaub Borkum“');
  S.oeffne('kalender'); S.clKalGehe(heute, 'tag');
  pruefe(/Müll rausstellen<small class="herkunft">☑ Urlaub Borkum<\/small>/.test(inhalt()), 'Kalender-Tag: mit Herkunft');
  const tag = S.kpTagFinden(heute);
  const nr = String(tag.text).split('\n').findIndex(z => /Müll rausstellen/.test(z));
  S.clTagZeileUm(heute, nr);
  pruefe(/\[x\] Müll rausstellen/.test(c.text), 'in Heute/Kalender abgehakt → in der Checkliste erledigt');
  S.oeffne('checklisten'); S.clsOeffnen('c1');
  pruefe(/1\/3/.test(inhalt()), 'der Zähler zählt mit (1/3)');
  S.clsHaken('c1', 1);
  pruefe(/\[x\] Koffer packen/.test(S.kpTagFinden(morgen).text), 'in der Checkliste abgehakt → im Tag erledigt');
  /* Ausplanen mit ✕ */
  S.clsHaken('c1', 1);
  S.clsPlanOeffnen('c1', 1);
  S.clsPlanWeg();
  pruefe(!/id="clsDatum"[^>]*value="2/.test(S.document.getElementById('aufklapp').innerHTML), '✕ leert das Datum');
  feld('clsDatum', '');
  S.clsPlanOk();
  pruefe(!S.kpEintraegeFinden('c1', 'Koffer packen').length && !/Koffer/.test(S.kpTagFinden(morgen).text), 'OK ohne Datum nimmt ihn heraus');
  /* Zurücksetzen und Löschen */
  S.cl.cls.id = 'c1';
  S.clsZuruecksetzen();
  pruefe(/\[\] Müll rausstellen/.test(S.kpTagFinden(heute).text) && !/\[x\]/.test(c.text), 'Zurücksetzen: auch im Tag wieder offen');
  S.cl.cls.id = 'c1';
  S.clsLoeschen();
  pruefe(!/Müll/.test(S.kpTagFinden(heute).text) && !S.kpEintraegeFinden('c1', 'Müll rausstellen').length, 'Löschen nimmt Eingeplantes aus dem Tag');
  S.aufklappZu();
  S.oeffne('uebersicht');
}

/* ============================================================
   45. Abstände in der Vorlage, Stichtag beim Start (0.16, Stufe 2)
   Grund: Wiederkehrende Abläufe (Urlaub …) sollen beim Start ihre Punkte
   gleich passend vor/nach dem Stichtag einplanen.
   Erkennt: @-Angabe falsch gelesen, Vorschau falsch, Vergangenes nicht auf
   heute, „@…“ bleibt im Lauf stehen, „Ohne Termine“ plant trotzdem,
   Vorlage ohne @ fragt unnötig nach.
   ============================================================ */
function clsStichtagTest() {
  console.log('\n45. Abstände in der Vorlage, Stichtag beim Start (0.16, Stufe 2)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  const feld = (id, v) => { S.document.getElementById(id).value = v; };
  S.cl.cls.id = ''; S.cl.cls.schreiben = false; S.cl.cls.fenster = null;
  const ab = S.clsAbstand('Koffer packen @-1 18:00');
  pruefe(ab && ab.text === 'Koffer packen' && ab.tage === -1 && ab.zeit === '18:00', '„@-1 18:00“ gelesen');
  pruefe(S.clsAbstand('Müll @0').tage === 0 && S.clsAbstand('Post @+2 7:30').zeit === '07:30', '„@0“ und „@+2 7:30“');
  pruefe(S.clsAbstand('Mail an a@b.de') === null && S.clsAbstand('Punkt @-1 25:00') === null && S.clsAbstand('Punkt @-400') === null, 'keine Fehldeutung (E-Mail, 25:00, zu weit)');
  const text = '## Vorher\n[] Fähre buchen @-30\n[] Koffer packen @-1 18:00\n[] Ladekabel\n## Abreisetag\n[] Müll rausstellen @0 07:00';
  S.DB.gedanken.push({ id: 'v1', titel: 'Urlaub', text: text, kontext: 'privat', checkliste: 'vorlage', ordnung: 1, geaendert: 1 });
  S.DB.gedanken.push({ id: 'v2', titel: 'Ohne', text: '[] A\n[] B', kontext: 'privat', checkliste: 'vorlage', ordnung: 2, geaendert: 1 });
  const stich = S.tagePlus(heute, 10);
  const vs = S.clsPlanVorschau(text, stich);
  pruefe(vs.length === 3 && vs[0].datum === heute && vs[1].datum === S.tagePlus(heute, 9) && vs[1].zeit === '18:00' && vs[2].datum === stich,
    'Vorschau: 3 Punkte, „@-30“ liegt zurück → heute');
  S.oeffne('checklisten'); S.clsOeffnen('v1');
  pruefe(/Koffer packen<\/span><span class="plan-marke">−1 T\. 18:00<\/span>/.test(inhalt()) && /Müll rausstellen<\/span><span class="plan-marke">Stichtag 7:00/.test(inhalt()),
    'Vorlage zeigt den Abstand als Marke');
  S.clsStarten('v2');
  pruefe(S.cl.cls.fenster === null && S.DB.gedanken.some(g => g.checkliste === 'lauf' && g.titel === 'Ohne'), 'Vorlage ohne @: startet wie bisher sofort');
  S.clsStarten('v1');
  let a = S.document.getElementById('aufklapp').innerHTML;
  pruefe(S.cl.cls.fenster.modus === 'start' && /id="clsStichtag"/.test(a) && /Wird eingeplant \(3 von 4\)/.test(a), 'mit @: Fenster fragt nach dem Stichtag, Vorschau 3 von 4');
  feld('clsTitel', 'Urlaub Borkum'); feld('clsStichtag', stich);
  S.clsStartVorschau();
  a = S.document.getElementById('aufklapp').innerHTML;
  pruefe(new RegExp('<b>' + S.clWt(stich) + ' [^<]* 7:00</b>Müll rausstellen').test(a), 'Vorschau folgt dem Stichtag');
  feld('clsTitel', 'Urlaub Borkum'); feld('clsStichtag', stich);
  S.clsStartOk(true);
  const lauf = S.DB.gedanken.filter(g => g.checkliste === 'lauf' && g.titel === 'Urlaub Borkum')[0];
  pruefe(lauf && lauf.text === '## Vorher\n[] Fähre buchen\n[] Koffer packen\n[] Ladekabel\n## Abreisetag\n[] Müll rausstellen' && lauf.stichtag === stich,
    'laufende Checkliste ohne „@…“, mit Stichtag');
  const seite = S.kpSeiteFinden(lauf.id);
  pruefe(S.aufGeplant(seite, 'Fähre buchen').datum === heute && S.aufGeplant(seite, 'Koffer packen').zeit === '18:00'
    && S.aufGeplant(seite, 'Müll rausstellen').datum === stich && !S.aufGeplant(seite, 'Ladekabel'), 'die drei Punkte sind eingeplant, Ladekabel nicht');
  pruefe(S.DB.gedanken[0].text === text, 'die Vorlage behält ihre @-Angaben');
  S.clsStarten('v1');
  feld('clsTitel', 'Urlaub ohne'); feld('clsStichtag', stich);
  S.clsStartOk(false);
  const ohne = S.DB.gedanken.filter(g => g.titel === 'Urlaub ohne')[0];
  pruefe(ohne && !/@/.test(ohne.text) && !S.aufGeplant(S.kpSeiteFinden(ohne.id), 'Fähre buchen'), '„Ohne Termine“: kein @, nichts eingeplant');
  S.clsStarten('v1');
  feld('clsTitel', 'X'); feld('clsStichtag', '');
  S.clsStartOk(true);
  pruefe(/Stichtag/.test(S.document.getElementById('toastText').textContent) && !S.DB.gedanken.some(g => g.titel === 'X'), 'ohne Stichtag: Hinweis, kein Start');
  S.aufklappZu();
  S.oeffne('uebersicht');
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
  try { auszeichnungTest(); } catch (e) { fail('Auszeichnungen warf: ' + e.message); }
  zustandsklassenTest();
  try { feinschliffTest(); } catch (e) { fail('Feinschliff 0.6.1 warf: ' + e.message); }
  try { datebookTest(); } catch (e) { fail('Tag wie im Datebook warf: ' + e.message); }
  try { sammlungenTest(); } catch (e) { fail('Sammlungen warf: ' + e.message); }
  try { await neustartTest(); } catch (e) { fail('Neustart/Statistik warf: ' + e.message); }
  try { zurueckTest(); } catch (e) { fail('Zurück warf: ' + e.message); }
  try { formelTest(); } catch (e) { fail('Formeln warf: ' + e.message); }
  try { kennzahlTest(); } catch (e) { fail('Kennzahl warf: ' + e.message); }
  try { jahrTest(); } catch (e) { fail('Jahrestermine warf: ' + e.message); }
  try { heuteTest(); } catch (e) { fail('Heute warf: ' + e.message); }
  try { trainingTest(); } catch (e) { fail('Training warf: ' + e.message); }
  try { suchenTest(); } catch (e) { fail('Suchen warf: ' + e.message); }
  try { trendTest(); } catch (e) { fail('Trend/Link warf: ' + e.message); }
  try { vierTest(); } catch (e) { fail('Vier Spalten warf: ' + e.message); }
  try { prioTest(); } catch (e) { fail('Prioritäten warf: ' + e.message); }
  memoZweiTest();
  try { memoRuhtTest(); } catch (e) { fail('Ruhende im Memo warf: ' + e.message); }
  try { datumTest(); } catch (e) { fail('Datumswerte warf: ' + e.message); }
  try { kopfTest(); } catch (e) { fail('Kopfwerte warf: ' + e.message); }
  try { listeTextTest(); } catch (e) { fail('Liste als Text warf: ' + e.message); }
  try { laufZeichenTest(); } catch (e) { fail('Zeichen ▶ warf: ' + e.message); }
  try { clsPlanTest(); } catch (e) { fail('Checklisten einplanen warf: ' + e.message); }
  try { clsStichtagTest(); } catch (e) { fail('Stichtag warf: ' + e.message); }

  /* ============================================================
     ERGEBNIS
     ============================================================ */
  console.log('\nERGEBNIS: ' + anzOk + ' ok, ' + anzFail + ' fehlgeschlagen, ' + anzWarn + ' Warnungen');
  process.exit(anzFail ? 1 : 0);
})();
