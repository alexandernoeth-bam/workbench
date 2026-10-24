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
  pruefe(/<div class="fassung">CLIE v' \+ esc\(APP_VERSION\)/.test(SKRIPT) && /oeffne\(\\'statistik\\'\)"><u>Statistik<\/u>/.test(SKRIPT), 'die Übersicht zeigt die Version im Hauptfenster (seit 0.7.1 mit Weg zur Statistik)');
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
    + 'clearInterval fetch Blob URL new fehler fertig isFinite __ Uint8Array').split(' '));
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
  /* Morgengruß (0.56.1) in den übrigen Tests aus — sonst hinge das Ergebnis von der Uhrzeit ab */
  try { CL.localStorage.setItem('clie-morgengruss', CL.isoDatum()); } catch (e) { /* egal */ }
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
  /* Seit 0.49 bewusst angepasst (bauen.py): Priorität in fünf Stufen */
  const ANGEPASST = ['kpPrioText'];
  const kernAb = kern.filter(n => ANSCHLUESSE.indexOf(n) < 0 && ANGEPASST.indexOf(n) < 0 && funktionText(SKRIPT, n) !== funktionText(WB_SKRIPT, n));
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
  /* Seit 0.28 steht „Heute“ nur noch unten in der Leiste — dort trägt es die Zahl, das Raster hat keine (ohne laufende Checklisten) */
  pruefe(!/class="zahl"/.test(h) && !/class="app" onclick="oeffne\('heute'\)"/.test(h) && typeof CL.clAppZahl === 'undefined',
    '„Heute“ nicht mehr im Raster (seit 0.28), keine Zahlen an den Symbolen');
  pruefe(CL.clTermineRest().length === 1, 'heute noch kommende Termine — Vergangenes zählt nicht');
  pruefe((h.match(/class="app"/g) || []).length === 12 && CL.CL_APPS.length === 27, 'zwölf Felder im Raster (3×4), Lesezeichen in der Leiste, der Rest in drei Ordnern (seit 0.38; Projekte seit 0.43, Ziele seit 0.44, Invasion seit 0.45)');
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
      pruefe((m.icons || []).every(i => fs.existsSync(path.join(ORDNER, i.src.replace(/\?.*$/, '')))), 'alle Symbole des Manifests liegen bei (ohne ?v=…)');
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
  pruefe(JSON.stringify(CL.CL_APPS.filter(a => a.raster !== false).map(a => a.id)) === '["kalender","aufgaben","sammlungen","projekte","memo","einkauf","vorlesen","rechner","ziele","planung","lernen","spiele"]'
    && !CL.clApp('heute') && CL.clApp('coach').raster === false,
    'Start 3×4 (seit 0.62): Kalender, To Do, Sammlungen / Projekte, Notizen, Einkauf / Vorlesen, Rechner, Ziele / Planung ▸, Lernen ▸, Spiele ▸');
  pruefe(!/oeffne\('(listen|woche|kurs)'\)/.test(h) && /oeffne\('ziele'\)/.test(h), 'Ziele seit 0.62 auf der Startseite; keine Apps für Listen, Woche; Kurs nicht im Raster');
  pruefe(!/unterz/.test(h) && !/unterz/.test(QUELLE), 'keine Unterzeile unter den Apps');
  const syms = (h.match(/<span class="sym"><svg viewBox="0 0 64 64"[^>]*><circle cx="32" cy="32" r="30" fill="#3B4433"/g) || []).length;
  pruefe(syms === 12, 'jede App im Raster hat ein Symbol als dunkle runde Scheibe (' + syms + '/12)');
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
  console.log('\n12. Rechner (seit 0.39 wie ein Schulrechner)');
  if (!CL) { return; }
  frisch();
  const R = CL.rt;
  R.grad = true; R.zweit = false; R.ans = 0;
  const tippe = (folge) => { CL.rtTaste('C'); folge.split(' ').forEach(t => CL.rtTaste(t)); CL.rtTaste('='); return R.fehler ? R.fehler : CL.rtText(R.ergebnis); };
  pruefe(tippe('2 4 9 , 9 0 * 3') === '749,7', '249,90 × 3 = 749,7 — mit Komma');
  pruefe(tippe('0 , 1 + 0 , 2') === '0,3', '0,1 + 0,2 = 0,3 — ohne Rundungsrest');
  pruefe(tippe('2 + 3 * 4') === '14', 'Punkt vor Strich: 2 + 3 × 4 = 14');
  pruefe(tippe('( 2 + 3 ) * 4') === '20', 'Klammern: (2 + 3) × 4 = 20');
  pruefe(tippe('2 * sin 3 0 ) + sqrt 1 6 ) - 3 quadrat') === '-4', '2·sin(30)+√(16)−3² = −4 (Grad)');
  pruefe(tippe('neg 3 quadrat') === '-9' && tippe('( neg 3 ) quadrat') === '9', '−3² = −9, (−3)² = 9');
  pruefe(tippe('2 hoch 1 0') === '1024' && tippe('2 hoch neg 1') === '0,5', 'Potenzen: 2^10 = 1024, 2^−1 = 0,5');
  pruefe(tippe('cos 6 0') === '0,5' && tippe('tan 4 5') === '1' && tippe('sin 1 8 0') === '0', 'cos 60 = 0,5, tan 45 = 1, sin 180 = 0 (kein Rundungsrest)');
  pruefe(tippe('asin 0 , 5') === '30' && tippe('atan 1') === '45', 'Umkehrfunktionen in Grad');
  pruefe(tippe('tan 9 0') === 'tan nicht definiert', 'tan 90 ist nicht definiert');
  pruefe(tippe('asin 2') === 'Wert außerhalb von −1 … 1', 'sin⁻¹(2): Fehler in Worten');
  CL.rtTaste('winkel');
  pruefe(!R.grad && tippe('sin pi / 2') === '1' && tippe('cos pi') === '-1', 'RAD: sin(π/2) = 1, cos π = −1');
  CL.rtTaste('winkel');
  pruefe(tippe('log 1 0 0 0') === '3' && tippe('ln e') === '1' && tippe('zehnhoch 2') === '100' && tippe('ehoch 0') === '1', 'log, ln, 10ˣ, eˣ');
  pruefe(tippe('log 0') === 'Logarithmus nur für Zahlen über 0' && tippe('sqrt neg 4') === 'Wurzel aus negativer Zahl', 'log 0 und √−4: Fehler in Worten');
  pruefe(tippe('3 wurzeln 2 7') === '3' && tippe('3 wurzeln neg 8') === '-2', 'n-te Wurzel: ³√27 = 3, ³√−8 = −2');
  pruefe(tippe('5 fak') === '120' && tippe('4 9 ncr 6') === '13.983.816' && tippe('5 npr 2') === '20', 'n!, nCr (Lotto: 13.983.816), nPr');
  pruefe(tippe('2 , 5 fak') === 'n! nur für ganze Zahlen ab 0' && tippe('3 ncr 5') === 'nCr: r größer als n', 'n! und nCr prüfen ihre Zahlen');
  pruefe(tippe('7 / 0') === 'Division durch 0' && tippe('( 2 + 3') === '5' && tippe('2 + 3 )') === 'Klammer zu viel', 'Division durch 0; fehlende Klammer am Ende ergänzt; Klammer zu viel');
  pruefe(tippe('2 pi') === CL.rtText(2 * Math.PI) && tippe('3 ( 4 + 1 )') === '15', 'ohne ×: 2π, 3(4+1)');
  pruefe(tippe('6 , 0 2 ee 2 3') === '6,02E23' && tippe('1 ee neg 3') === '0,001', 'EE: 6,02E23, 1E−3');
  pruefe(tippe('2 0 0 * 1 0 prozent') === '20' && tippe('4 kehrwert') === '0,25' && tippe('2 kubik') === '8', '%, 1/x, x³');
  /* Ans */
  tippe('1 0');
  CL.rtTaste('*'); CL.rtTaste('3'); CL.rtTaste('=');
  pruefe(CL.rtEingabeText() === 'Ans×3' && CL.rtText(R.ergebnis) === '30', 'nach einem Ergebnis rechnet × mit Ans weiter');
  CL.rtTaste('5');
  pruefe(CL.rtEingabeText() === '5', 'eine Ziffer beginnt neu');
  /* Bruch */
  tippe('1 / 3 + 1 / 4');
  CL.rtTaste('bruch');
  pruefe(R.bruch && /7\/12/.test(CL.rtErgebnisText()) && /≈ 0,583333</.test(CL.rtErgebnisText()), '→Bruch: 1/3 + 1/4 = 7/12');
  pruefe(CL.rtBruch(Math.PI) === '' && CL.rtBruch(-0.75) === '−3/4' && CL.rtBruch(2) === '', 'π ist kein Bruch, −0,75 = −3/4');
  /* ←, 2nd */
  CL.rtTaste('C'); CL.rtTaste('sin'); CL.rtTaste('3');
  pruefe(CL.rtEingabeText() === 'sin(3', 'Eingabe sichtbar: sin(3');
  CL.rtTaste('zurueck'); CL.rtTaste('zurueck');
  pruefe(CL.rtEingabeText() === '', '← löscht ganze Bausteine (sin( auf einmal)');
  CL.rtTaste('2nd');
  pruefe(R.zweit, '2nd an');
  CL.rtTaste('sin');
  pruefe(CL.rtEingabeText() === 'sin(' && !R.zweit, 'die Taste unter 2nd heißt jetzt sin⁻¹ — Taste „sin“ liefert sin, 2nd geht wieder aus');
  CL.oeffne('rechner');
  CL.rtTaste('C'); CL.rtTaste('2nd');
  pruefe(/rtTaste\('asin'\)">sin⁻¹/.test(inhalt()) && /rtTaste\('kubik'\)">x³/.test(inhalt()) && /rtTaste\('M\+'\)">M−/.test(inhalt()), '2nd zeigt sin⁻¹ … x³ und M−');
  CL.rtTaste('2nd');
  /* ⌫ und CE (seit 0.40.1) */
  CL.rtTaste('C'); ['1', '2', '+', '3', '4', '5'].forEach(k => CL.rtTaste(k));
  CL.rtTaste('zurueck');
  pruefe(CL.rtEingabeText() === '12+34', '⌫ löscht das letzte Zeichen');
  CL.rtTaste('CE');
  pruefe(CL.rtEingabeText() === '12+', 'CE löscht die letzte Eingabe (die Zahl 34)');
  CL.rtTaste('sqrt'); CL.rtTaste('CE');
  pruefe(CL.rtEingabeText() === '12+', 'CE nach einer Funktion: den Baustein');
  ['±', '7', ',', '5'].forEach(k => CL.rtTaste(k)); CL.rtTaste('CE');
  pruefe(CL.rtEingabeText() === '12+', 'CE nimmt auch das Vorzeichen der Zahl mit');
  CL.rtTaste('9'); CL.rtTaste('='); CL.rtTaste('CE');
  pruefe(CL.rtEingabeText() === '' && R.ergebnis === null, 'CE nach „=“: alles leer');
  /* Speicher und Verlauf */
  R.speicher = 0;
  tippe('1 0'); CL.rtTaste('M+'); tippe('5'); CL.rtTaste('M+'); tippe('3'); CL.rtTaste('2nd'); CL.rtTaste('M+');
  pruefe(R.speicher === 12 && /"speicher":12/.test(CL.__ablage['clie-rechner'] || ''), 'Speicher M+ / M− rechnet und bleibt auf dem Gerät');
  CL.rtTaste('C'); CL.rtTaste('MR'); CL.rtTaste('=');
  pruefe(CL.rtText(R.ergebnis) === '12', 'MR holt den Speicher');
  pruefe(R.verlauf.some(v => /^4 9 nCr 6 = 13\.983\.816$|^49 nCr 6 = 13\.983\.816$/.test(v)), 'Rechnungen landen im Verlauf („49 nCr 6 = 13.983.816“)');
  pruefe(R.verlauf.length <= 20, 'der Verlauf hat höchstens 20 Einträge');
  const vorher = CL.alsText().replace(/"gespeichert": "[^"]*"/, '');
  tippe('9 + 1');
  pruefe(CL.alsText().replace(/"gespeichert": "[^"]*"/, '') === vorher, 'der Rechner schreibt nichts in die workbench.json');
  CL.oeffne('rechner');
  const h = inhalt();
  pruefe(/rtTaste\('='\)/.test(h) && /rtTaste\('sin'\)/.test(h) && /rtTaste\('ncr'\)/.test(h) && (h.match(/class="taste[ "]/g) || []).length === 43, 'der Rechner zeigt 18 Funktions- und 25 Zahlentasten');
  pruefe(/rtTaste\('zurueck'\)">⌫/.test(h) && /rtTaste\('CE'\)">CE/.test(h) && /rtTaste\('C'\)">C/.test(h) && h.indexOf("rtTaste('zurueck')") > h.indexOf('rt-zahlen'), '⌫, CE und C groß im Zahlenblock (seit 0.40.1)');
  pruefe(CL.document.getElementById('katKnopf').textContent === 'DEG', 'oben rechts: DEG');
  CL.katUm();
  pruefe(!R.grad && CL.document.getElementById('katKnopf').textContent === 'RAD' && /"grad":false/.test(CL.__ablage['clie-rechner']), 'Tipp oben rechts: RAD, gemerkt');
  CL.katUm();
  CL.rtVerlaufUm();
  pruefe(/rt-verlauf/.test(inhalt()) && /9\+1 = 10/.test(inhalt()), '„Verlauf…“ zeigt die letzten Rechnungen');
  CL.rtVerlaufUm();
  let gedrueckt = false;
  CL.rtTaste('C');
  CL.tasteGlobal({ key: '7', preventDefault() { gedrueckt = true; } });
  CL.tasteGlobal({ key: '^', preventDefault() {} }); CL.tasteGlobal({ key: '2', preventDefault() {} }); CL.tasteGlobal({ key: 'Enter', preventDefault() {} });
  pruefe(gedrueckt && CL.rtText(R.ergebnis) === '49', 'am PC tippt die Tastatur mit (7^2 Enter = 49)');
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
  pruefe(/class="gruppe klick" onclick="aufGanzUm\('p1'\)"><span>◎ Büro<\/span><small>1<\/small><\/button>/.test(h) && /<span>≡ Garten<\/span>/.test(h) && !/class="q">/.test(h),
    'nach Liste gruppiert (Überschrift mit Zahl, seit 0.17) — keine zweite Spalte, der Titel hat die volle Breite');
  pruefe(/class="tx umbruch"/.test(h), 'lange Titel brechen um');
  CL.aufAnsicht('prio');
  pruefe(!/class="gruppe/.test(inhalt()) && CL.__ablage['clie-aufgaben-ansicht'] === 'prio' && /<small class="herkunft">◎ Büro<\/small>/.test(inhalt()),
    'Ansicht Prio (seit 0.17 statt „Kategorien aus“): flach, mit Herkunft, gemerkt');
  CL.aufAnsicht('gruppiert');
  CL.aufFilter('beruflich');
  pruefe(/Angebot einholen/.test(inhalt()) && !/Fenster messen/.test(inhalt()), 'der Filter Beruf zeigt nur berufliche Seiten');
  CL.aufFilter('alle');

  /* Auswahl oben rechts */
  CL.katUm();
  let a = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(CL.cl.aufklapp === 'liste' && /aufFilter\('beruflich'\)/.test(a) && /todoAlle\(\)/.test(a) && /todoListe\('cl-korb'\)/.test(a) && /todoSicht\('vorlage'\)/.test(a) && !/Weitere/.test(a),
    'das ▼ (seit 0.61): Beruf/Privat, Alle, Sammler, Listen, Ruhende/Fertige/Vorlagen');
  CL.todoBereichAuf();
  pruefe(CL.cl.aufklapp === 'todobereich' && /aufBereichSetzen\('kb-haus'\)/.test(CL.document.getElementById('aufklapp').innerHTML), 'Bereich wird über „Bereich: … ▾“ gewählt');
  CL.aufklappZu();
  CL.listenwahlOeffnen('filter');
  a = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(/Umbau/.test(a) && /Garten/.test(a) && !/Halbmarathon/.test(a) && !/Ruht/.test(a) && !/>◎ Leer/.test(a),
    '„Weitere…“: Projekte und Listen mit offenen Aufgaben — keine Ziele, nichts Ruhendes, nichts ohne Offenes');
  CL.listeGewaehlt('p2');
  pruefe(CL.cl.auf.liste === 'p2' && /Fenster messen/.test(inhalt()) && !/Angebot einholen/.test(inhalt()), 'eine Liste gewählt: nur ihre Aufgaben');
  pruefe(/▼ Umbau/.test(CL.document.getElementById('katKnopf').textContent), 'oben rechts steht die Liste');
  pruefe(JSON.parse(CL.__ablage['clie-zuletzt'])[0] === 'p2' && CL.__ablage['clie-aufgaben-liste'] === 'p2', 'zuletzt benutzt und die Wahl werden gemerkt');
  CL.katUm();
  pruefe(!/Zuletzt benutzt/.test(CL.document.getElementById('aufklapp').innerHTML) && !/aufListeSetzen\('p2'\)/.test(CL.document.getElementById('aufklapp').innerHTML),
    'seit 0.49 keine einzelnen Listen mehr oben rechts (die stehen in Checklisten)');
  CL.aufListeSetzen('');

  /* Abhaken */
  CL.aufHaken('p2', 0);
  pruefe(/^\[x\] Fenster messen/.test(CL.DB.projekte[1].flaeche) && /class="aufg erl/.test(inhalt()), 'abhaken: in der Seite erledigt, bleibt kurz durchgestrichen stehen');
  CL.oeffne('uebersicht'); CL.oeffne('aufgaben');
  pruefe(!/Fenster messen/.test(inhalt()), 'nach dem Verlassen ist es weg');
  CL.aufErlUm();
  pruefe(/Fenster messen/.test(inhalt()) && /Pläne/.test(inhalt()), '„Erledigte“ zeigt es wieder');
  CL.aufErlUm();

  /* Neu: ohne Wahl in den Sammler (seit 0.49 statt „Liste ist Pflicht“) */
  CL.aufNeu();
  let f = CL.document.getElementById('aufklapp').innerHTML;
  pruefe(/Neue Aufgabe/.test(f) && /id="aufOk" class="knopf voll" disabled/.test(f) && /▼ Sammler</.test(f) && /Checkliste:/.test(f), 'Neu: „Checkliste: ▼ Sammler“, OK erst mit Text');
  CL.document.getElementById('aufText').value = 'Winterreifen';
  CL.aufSpeichern();
  const korb0 = CL.DB.themen.filter(x => x.id === 'cl-korb')[0];
  pruefe(korb0 && korb0.korb && /\[\] Winterreifen/.test(korb0.text), 'ohne Wahl landet die Aufgabe im Sammler — er wird dabei angelegt');
  CL.DB.themen = CL.DB.themen.filter(x => x.id !== 'cl-korb');
  CL.aufNeu();
  CL.document.getElementById('aufText').value = 'Winterreifen';
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
  pruefe(gesch.name === 'Geschenkideen' && gesch.kontext === 'privat' && CL.cl.app === 'checklisten' && CL.cl.cls.id === gesch.id, 'die neue Liste liegt in „themen“ und ist gleich offen (seit 0.61 in To Do)');
  pruefe(/clsDetails\(\)/.test(CL.document.getElementById('fuss').innerHTML), 'eine offene Liste lässt sich bearbeiten (Details…)');
  CL.listeBearbeiten();
  CL.document.getElementById('listeTitel').value = 'Geschenke';
  CL.neueListeSpeichern();
  pruefe(gesch.name === 'Geschenke', 'umbenannt');
  CL.todoAlle();
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
  pruefe(CL.document.getElementById('reiter').textContent === 'Notizen' && !/Büro|Halbmarathon|Packliste/.test(h) && typeof CL.MEMO_BEREICHE === 'undefined',
    'Notizen (seit 0.43): ohne Projekte, Ziele, Listen und Checklisten — keine Bereichsauswahl mehr');
  /* Das Schreibfeld der Notizen dient auch den Projekten (Reiter „Memo“ → Schreiben) */
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
  pruefe(CL.cl.memo.id === '' && !/Büro neu/.test(inhalt()), 'eine ruhende Seite verlässt die Seite (zurück zur Liste)');

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
  pruefe(CL.cl.app === 'projekte' && CL.cl.pj.id === 'p2' && CL.cl.pj.reiter === 'aufgaben' && /class="aufg hervor" id="pjZ0"/.test(inhalt()), '„Im Projekt zeigen“ öffnet das Projekt (seit 0.43) an der Zeile');
  CL.memoZeile('t1', 0);
  pruefe(CL.cl.app === 'checklisten' && CL.cl.cls.id === 't1', '„Liste zeigen“ öffnet Listen seit 0.49 in Checklisten');
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
  CL.todoSicht('vorlage');
  let h = inhalt();
  pruefe(/Packliste Urlaub/.test(h) && /Monatsabschluss/.test(h) && !/clsStarten\(/.test(h) && /Vorlagen…<\/span><small>2/.test(CL.listeAufklappHtml()), '„Vorlagen…“ im ▼ mit Zahl, ohne Startknopf in der Liste');
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
  pruefe(lauf.checkliste === 'fertig' && lauf.abgeschlossen === CL.isoDatum() && CL.cl.cls.id === '', 'abgeschlossen: ins Archiv');
  pruefe(CL.cl.app === 'aufgaben' && /Fertige…<\/span><small>1/.test(CL.listeAufklappHtml()), 'danach „Alle“; „Fertige…“ im ▼ zählt sie');

  /* Neu: aus einem Memo, als Kopie, leer */
  CL.clsNeu();
  pruefe(/Aus einer Notiz übernehmen/.test(CL.document.getElementById('aufklapp').innerHTML), 'Neu bietet: leer, Kopie, aus Notiz, einmalig');
  CL.clsFensterSchritt('memo');
  pruefe(!/clsAnlegen\('memo','p1'\)/.test(CL.document.getElementById('aufklapp').innerHTML), 'zur Wahl stehen seit 0.53.4 nur Notizen, keine Projekte');
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
  /* Nächster Di/Do/Sa ab heute — unabhängig vom Wochentag des Testlaufs (seit 0.26; vorher je nach Tag falsch) */
  let naechster = heute; while ([2, 4, 6].indexOf(CL.ausIso(naechster).getDay()) < 0) { naechster = CL.tagePlus(naechster, 1); }
  pruefe(CL.aufgabeFaelligAn(neu, naechster), 'und ist an ihren Tagen fällig');

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
  pruefe(CL.cl.app === 'projekte' && CL.cl.pj.id === 'p2', 'ein Tipp auf den Verweis öffnet die Seite (Projekte seit 0.43 in Projekte)');
  CL.memoVerweis('t1');
  pruefe(CL.cl.app === 'checklisten' && CL.cl.cls.id === 't1', 'ein Verweis auf eine Liste öffnet sie in Checklisten (0.49)');
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
  pruefe(!/class="zw"/.test(h) && /≡ Garten<\/span><small>[^<]*<\/small><\/button><div class="aufg[^"]*">[\s\S]*?Laub<\/button><span class="plan-marke">heute<\/span>/.test(h),
    'Gruppiert: keine Gruppe „Geplant“ — die Aufgabe steht bei ihrer Liste mit der Marke „heute“');
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
  pruefe(/class="kl"><i class="mitte"><\/i><i class="wechsel"><\/i>/.test(zeile('15:00')) && /class="kl"><i class="mitte"><\/i><i class="unten"><\/i>/.test(zeile('15:30')),
    '13–15 endet in der Zeile des Zahnarzts — dort öffnet sich dessen Klammer in derselben Spalte (seit 0.45.1)');
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
  pruefe(/var SAMMLUNGEN = \[[\s\S]*'sammlungen','datensaetze'[,\]]/.test(QUELLE) && Array.isArray(S.DB.sammlungen) && Array.isArray(S.DB.datensaetze),
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
  pruefe(!/class="zahl"/.test(ohneHeute) && /<div class="fassung">CLIE v[\d.]+ · <button type="button" onclick="oeffne\('abgleich'\)"><u>(abgeglichen \d\d:\d\d|nicht abgeglichen)<\/u><\/button> · <button type="button" onclick="oeffne\('statistik'\)"><u>Statistik<\/u>/.test(h), 'Übersicht ohne Zahlen (außer an „Heute“), die Versionszeile führt zu Abgleich (seit 0.46) und Statistik');
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
  pruefe(/<nav class="silk"/.test(QUELLE) && /onclick="oeffne\('uebersicht'\)"><b>⌂<\/b>Übersicht/.test(QUELLE) && /onclick="menueUm\(\)" id="menueTaste"><b>≡<\/b>Menü/.test(QUELLE) && !/<b>⇅<\/b>Abgleich/.test(QUELLE),
    'Tastenleiste unten (seit 0.8); seit 0.46 rechts ≡ Menü statt Abgleich');
  pruefe(/<span class="reiter" id="reiter">/.test(QUELLE) && !/id="reiter" onclick/.test(QUELLE) && !/\.reiter::after/.test(QUELLE), 'seit 0.46 ist der Reiter nur der Titel — ohne ▾ und ohne Menü');
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
   93. Alles ist eine Checkliste: Zustand, Bereich, Art, Wecken (0.49)
   Grund: Endlose Listen wie „Haus“ führen nicht zum Ziel. Seit 0.49 sind
   Aufgabenlisten und Checklisten eins: laufend · ruhend · abgeschlossen,
   gruppiert nach Lebensbereich aus Kurs, Art Aufgaben oder Abhaken. Eine
   ruhende Checkliste wacht auf, sobald ein Punkt heute fällig ist.
   Erkennt: Ruhendes in Aufgaben, Wecken bleibt aus oder weckt ohne
   Fälliges, Bereich/Art/Zustand gehen beim Speichern verloren, Listen
   öffnen nicht in Checklisten, ★ mehr als dreimal.
   ============================================================ */
function ckZustandTest() {
  console.log('\n93. Alles ist eine Checkliste: Zustand, Bereich, Art, Wecken (0.49)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  S.cl.cls.id = ''; S.cl.cls.fenster = null; S.cl.aufklapp = ''; S.cl.auf.liste = ''; S.cl.auf.bereich = '';
  S.localStorage.removeItem('clie-cls-klapp');
  S.DB.themen = [{ id: 'th', name: 'Haus', text: '[] Dachrinne\n[x] Keller', kontext: 'privat', bereich: 'kb-haus', ordnung: 1, geaendert: 1 },
                 { id: 'tr', name: 'Carport Angebote', text: '[] Maier nachfassen\n[] Bauamt', kontext: 'privat', bereich: 'kb-haus', ruht: true, ordnung: 2, geaendert: 1 },
                 { id: 'ta', name: 'Altes', text: '[x] fertig', kontext: 'privat', abgeschlossen: '2026-10-01', ordnung: 3, geaendert: 1 }];
  S.DB.gedanken.push({ id: 'gp', titel: 'Packen Borkum', text: '[] Koffer\n[] Ladekabel', kontext: 'privat', checkliste: 'lauf', bereich: 'kb-beziehungen', gestartet: heute, ordnung: 4, geaendert: 1 });
  S.DB.gedanken.push({ id: 'ga', titel: 'Jahresgespräche', text: '[] Termine\n[] Bögen', kontext: 'beruflich', checkliste: 'lauf', art: 'aufgaben', bereich: 'kb-arbeit', gestartet: heute, ordnung: 5, geaendert: 1 });
  /* Seit 0.61: statt der Checklisten-Übersicht das ▼ von To Do */
  S.oeffne('aufgaben');
  S.katUm();
  let h = S.document.getElementById('aufklapp').innerHTML;
  pruefe(S.cl.aufklapp === 'liste' && h.indexOf("todoListe('cl-korb')") < h.indexOf("todoListe('th')") && !/<div class="zw">/.test(h),
    '▼: oben Alle und Sammler, darunter die laufenden Listen nach Bereich — ohne Überschriften (0.62)');
  pruefe(/Haus<\/span><small>1\/2</.test(h), 'rechts nur x/y');
  pruefe(/☑ Packen Borkum/.test(h) && !/☑ Jahresgespräche/.test(h) && !/☑ Haus/.test(h), '☑ nur vor Listen zum Abhaken');
  pruefe(!/Carport Angebote/.test(h) && !/>Altes</.test(h) && /Ruhende…<\/span><small>1</.test(h) && /Fertige…<\/span><small>1</.test(h), 'Ruhende und Fertige nur gezählt, unter dem Strich');
  /* Bereich: grenzt „Alle“ und das ▼ ein */
  S.aufBereichSetzen('kb-arbeit');
  S.katUm();
  h = S.document.getElementById('aufklapp').innerHTML;
  pruefe(/Jahresgespräche/.test(h) && !/todoListe\('th'\)/.test(h) && /▼ Alle · Arbeit/.test(S.document.getElementById('katKnopf').textContent) && S.localStorage.getItem('clie-aufgaben-bereich') === 'kb-arbeit',
    'Bereich gewählt: nur dessen Listen, oben „▼ Alle · Arbeit“, gemerkt');
  S.aufBereichSetzen('');
  S.todoSicht('ruht');
  pruefe(S.cl.app === 'checklisten' && /Carport Angebote/.test(inhalt()) && !/>Haus</.test(inhalt()) && /▼ Ruhende/.test(S.document.getElementById('katKnopf').textContent), '„Ruhende…“ zeigt nur die ruhenden Listen');
  S.todoSicht('fertig');
  pruefe(/Altes/.test(inhalt()) && !/Carport/.test(inhalt()), '„Fertige…“ zeigt nur die abgeschlossenen');
  /* Aufgaben: ruhende Liste nicht, Abhak-Checkliste nur Eingeplantes, Art Aufgaben ganz */
  S.cl.auf.ansicht = 'gruppiert'; S.cl.auf.naechste = false;
  S.oeffne('aufgaben');
  h = inhalt();
  pruefe(/Dachrinne/.test(h) && !/Maier nachfassen/.test(h) && !/Koffer/.test(h) && /Termine/.test(h) && /Bögen/.test(h),
    'Aufgaben: ruhende Liste nicht, Abhaken nur Eingeplantes, Art „Aufgaben“ mit allen Punkten');
  /* Wecken: ein Punkt der ruhenden Liste wird für heute eingeplant */
  S.aufPlanAnwenden(S.kpSeiteFinden('tr'), 0, heute, '');
  const n = S.ckWecken();
  const tr = S.DB.themen[1];
  pruefe(n === 1 && !tr.ruht && tr.geweckt === heute && /Aufgewacht: „Carport Angebote“/.test(S.document.getElementById('toastText').textContent), 'fälliger Punkt weckt die ruhende Checkliste, mit Meldung');
  S.oeffne('checklisten');
  pruefe(/Carport Angebote<\/span><span class="cls-geweckt">geweckt<\/span>/.test(inhalt()), 'bei den laufenden Listen mit der Marke „geweckt“');
  pruefe(S.ckWecken() === 0, 'nichts mehr zu wecken: keine weitere Meldung');
  /* Liste in Checklisten öffnen, Zeilen wie in Aufgaben */
  S.clsOeffnen('th');
  h = inhalt();
  pruefe(S.cl.cls.id === 'th' && /aufHaken\('th',0\)/.test(h) && /aufPrioUm\('th',0\)/.test(h) && /Erledigt · 1/.test(h) && /aufNeu\(\)/.test(S.document.getElementById('fuss').innerHTML),
    'eine Liste öffnet in Checklisten: Zeilen mit Haken und Priorität, Erledigte eingeklappt, unten „Neu“');
  /* Details: Bereich, Zustand, ★ */
  S.clsDetails();
  let f = S.clsFensterHtml();
  pruefe(/id="clsKat"/.test(f) && /<option value="kb-haus" selected>/.test(f) && /clsDetailWahl\('zustand','ruht'\)/.test(f) && /★ Wesentlich/.test(f) && !/clsDetailWahl\('art'/.test(f),
    'Details einer Liste: Bereich, Zustand, ★ — keine Art (Listen sind immer „Aufgaben“)');
  S.document.getElementById('clsKat').value = 'kb-freizeit';
  S.clsDetailWahl('stern', '');
  S.clsSpeichern();
  pruefe(S.DB.themen[0].bereich === 'kb-freizeit' && S.DB.themen[0].stern === true, 'Bereich und ★ gespeichert');
  S.clsDetails(); S.clsDetailWahl('zustand', 'ruht'); S.clsSpeichern();
  pruefe(S.DB.themen[0].ruht === true && !S.DB.themen[0].stern, 'ruhend: ★ fällt weg');
  S.clsDetails(); S.clsDetailWahl('zustand', 'lauf'); S.clsSpeichern();
  /* ★ höchstens drei */
  ['tr', 'th'].forEach(id => { S.kpSeiteFinden(id).__satz.stern = true; });
  S.DB.gedanken.filter(g => g.id === 'gp')[0].stern = true;
  S.clsOeffnen('ga'); S.clsDetails(); S.clsDetailWahl('stern', ''); S.clsSpeichern();
  pruefe(!S.DB.gedanken.filter(g => g.id === 'ga')[0].stern && /Höchstens drei/.test(S.document.getElementById('toastText').textContent), 'ein vierter ★ wird abgelehnt');
  S.aufklappZu();
  /* Art einer Checkliste umschalten */
  S.clsOeffnen('gp'); S.clsDetails();
  pruefe(/clsDetailWahl\('art','aufgaben'\)/.test(S.clsFensterHtml()), 'Checkliste: Art wählbar');
  S.clsDetailWahl('art', 'aufgaben'); S.clsSpeichern();
  pruefe(S.DB.gedanken.filter(g => g.id === 'gp')[0].art === 'aufgaben', 'Art „Aufgaben“ gespeichert');
  /* Vorlage vererbt Art und Bereich */
  S.DB.gedanken.push({ id: 'vv', titel: 'DFÜ-Test', text: '[] A', kontext: 'beruflich', checkliste: 'vorlage', art: 'aufgaben', bereich: 'kb-arbeit', ordnung: 9, geaendert: 1 });
  S.clsStarten('vv');
  const neu = S.DB.gedanken.filter(g => g.vorlage === 'vv')[0];
  pruefe(neu && neu.art === 'aufgaben' && neu.bereich === 'kb-arbeit', 'Starten aus der Vorlage übernimmt Art und Bereich');
  S.clsZurListe();
  S.oeffne('uebersicht');
}

/* ============================================================
   94. Sammler und Aufgaben als Gesamtsicht (0.49)
   Grund: Lose Einzelaufgaben brauchen keine eigene Liste — sie landen im
   Sammler, der einzigen Liste ohne Ende. „Neue Aufgabe“ hat keine Pflicht-
   Liste mehr. Aufgaben zeigt nur noch an und filtert nach Lebensbereich.
   Erkennt: Sammler doppelt angelegt, Aufgabe ohne Wahl geht verloren, Sammler
   ruht oder lässt sich löschen, Filter nach Bereich wirkungslos.
   ============================================================ */
function ckKorbTest() {
  console.log('\n94. Sammler und Aufgaben als Gesamtsicht (0.49)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.cl.cls.id = ''; S.cl.cls.fenster = null; S.cl.aufklapp = ''; S.cl.auf.liste = ''; S.cl.auf.bereich = '';
  S.DB.themen = [{ id: 'tg', name: 'Garten', text: '[] Hecke', kontext: 'privat', bereich: 'kb-haus', ordnung: 1, geaendert: 1 },
                 { id: 'tb', name: 'Büro', text: '[] Ablage', kontext: 'beruflich', bereich: 'kb-arbeit', ordnung: 2, geaendert: 1 }];
  pruefe(S.ckKorb(false) === null, 'ohne Gebrauch kein Sammler');
  S.oeffne('aufgaben');
  S.aufNeu();
  S.document.getElementById('aufText').value = 'Dachrinne reinigen';
  S.aufSpeichern();
  S.aufNeu();
  S.document.getElementById('aufText').value = 'Fenster abdichten';
  S.aufSpeichern();
  const korb = S.DB.themen.filter(x => x.id === 'cl-korb');
  pruefe(korb.length === 1 && korb[0].korb && korb[0].text === '[] Dachrinne reinigen\n[] Fenster abdichten' && korb[0].kontext === '', 'ohne Wahl in den Sammler — genau ein Sammler (feste Kennung), passt zu Beruf und Privat');
  S.katUm();
  pruefe(/todoListe\('cl-korb'\)"><span>Sammler<\/span><small>2</.test(S.document.getElementById('aufklapp').innerHTML) && (S.document.getElementById('aufklapp').innerHTML.match(/todoListe\('cl-korb'\)/g) || []).length === 1, '▼: Sammler oben mit Zahl, nicht noch einmal bei den Listen');
  S.aufklappZu();
  S.todoListe('cl-korb');
  pruefe(S.cl.cls.id === 'cl-korb' && /Lose Einzelaufgaben/.test(inhalt()) && /Dachrinne reinigen/.test(inhalt()), 'der Sammler öffnet sich wie eine Checkliste');
  S.clsDetails();
  const f = S.clsFensterHtml();
  pruefe(!/clsDetailWahl\('zustand'/.test(f) && !/ckListeLoeschenFragen/.test(f) && !/id="clsTitel"/.test(f), 'Sammler: kein Zustand, kein Löschen, kein Umbenennen');
  S.aufklappZu();
  /* Neu aus einer geöffneten Checkliste landet dort */
  S.clsOeffnen('tg');
  S.aufNeu();
  pruefe(S.cl.auf.fenster.seite === 'tg' && /▼ ≡ Garten/.test(S.aufFensterHtml()), 'Neu in einer geöffneten Checkliste: dort vorgewählt');
  S.document.getElementById('aufText').value = 'Rasen mähen';
  S.aufSpeichern();
  pruefe(/\[\] Rasen mähen$/.test(S.DB.themen[0].text), 'und dort angelegt');
  /* Auswahl im Fenster: Sammler, Checklisten, Projekte */
  S.clsZurListe();
  S.aufNeu(); S.listenwahlOeffnen('aufgabe');
  const w = S.listenwahlHtml();
  pruefe(/Checkliste wählen/.test(w) && w.indexOf('>Sammler<') < w.indexOf('>Checklisten<') && /Neue Checkliste …/.test(w), 'Auswahl: zuerst Sammler, dann Checklisten, „Neue Checkliste …“');
  S.aufklappZu();
  /* Aufgaben nach Lebensbereich */
  S.oeffne('aufgaben');
  S.aufBereichSetzen('kb-arbeit');
  pruefe(/Ablage/.test(inhalt()) && !/Hecke/.test(inhalt()) && !/Dachrinne/.test(inhalt()) && S.localStorage.getItem('clie-aufgaben-bereich') === 'kb-arbeit', 'Filter nach Bereich: nur Arbeit, gemerkt');
  S.aufBereichSetzen('');
  pruefe(/Ablage/.test(inhalt()) && /Hecke/.test(inhalt()) && /Dachrinne/.test(inhalt()), 'Alle Aufgaben: wieder alles, auch der Sammler');
  S.oeffne('uebersicht');
}

/* ============================================================
   97. Coach und Sammler (0.52)
   Grund: Der Sammler funktioniert nur, wenn er leer wird. Der Coach fragt
   nach Punkten, die zu lange liegen, bietet Aufräumen an (zu voll oder
   am gewählten Wochentag), schlägt bei gleichem Thema eine Checkliste
   vor und fragt nach Checklisten, die seit 30 Tagen ruhen.
   Erkennt: Alter wird nicht gestempelt, Punkte mit Termin/⚑ werden als
   „zu lange“ gefragt, Thema-Vorschlag verschiebt nicht, Aufräumen ohne
   Wirkung, Quelle lässt sich nicht abschalten.
   ============================================================ */
function coKorbTest() {
  console.log('\n97. Coach und Sammler (0.52)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  const vor = n => S.tagePlus(heute, -n);
  S.localStorage.removeItem('clie-coach-gesehen');
  S.cl.co.tag = ''; S.cl.co.ansicht = 'verlauf';
  S.termineNachTag = {};
  S.krSpeichern({ id: 'kc-einstellungen', typ: 'coach', max: 12, frist: 7, korbGrenze: 5, korbTag: S.ausIso(heute).getDay() });
  S.DB.themen = [{ id: 'cl-korb', name: 'Sammler', kontext: '', korb: true, ordnung: 0, geaendert: 1,
    text: '[] Dachrinne reinigen\n[] Carport Fundament klären\n[] Carport Bauamt anrufen\n[] Angebot Carport Maier\n[] Fenster abdichten\n[] Steuer',
    korbSeit: { 'Dachrinne reinigen': vor(9), 'Fenster abdichten': vor(12) } },
    { id: 'tr', name: 'Jahresgespräche', text: '[] Bögen', kontext: 'privat', ruht: true, ruhtSeit: vor(34), ordnung: 1, geaendert: 1 }];
  S.ckStempeln(heute);
  pruefe(S.DB.themen[0].korbSeit['Steuer'] === heute && S.DB.themen[0].korbSeit['Dachrinne reinigen'] === vor(9), 'neue Sammler-Punkte werden gestempelt, alte behalten ihr Datum');
  S.ckZusatzSetzen(S.kpSeiteFinden('cl-korb'), 'Fenster abdichten', S.tagePlus(heute, 5), '');
  let l = S.coFaellige('20:45', heute);
  const ka = l.filter(f => /^ka:/.test(f.id));
  pruefe(ka.length === 1 && ka[0].id === 'ka:Dachrinne reinigen' && /seit 9 Tagen im Sammler/.test(ka[0].text) && ka[0].antworten.map(a => a[0]).join() === 'heute,einplanen,checkliste,loeschen',
    'zu lange im Sammler: nur ohne ⚑/Termin, mit Heute · Einplanen · In Checkliste · Löschen');
  pruefe(l.some(f => /^kv:/.test(f.id) && /6 Punkte/.test(f.text)), 'zu voll (ab 5): Aufräumen wird angeboten');
  pruefe(l.some(f => /^kw:/.test(f.id) && /Sammler leeren\?/.test(f.text)), 'am gewählten Wochentag abends: „Sammler leeren?“');
  const kt = l.filter(f => /^kt:/.test(f.id))[0];
  pruefe(kt && kt.id === 'kt:carport' && /3 Punkte im Sammler betreffen „Carport“/.test(kt.text), 'gleiches Thema in drei Punkten: Checkliste vorschlagen');
  const cr = l.filter(f => /^cr:/.test(f.id))[0];
  pruefe(cr && /ruht seit 34 Tagen/.test(cr.text) && cr.antworten.map(a => a[0]).join() === 'abschliessen,wecken,weiter', 'seit 30 Tagen ruhend: Abschließen · Wecken · Weiter ruhen');
  /* Antworten */
  S.coAntwort('kt:carport', 'anlegen', 0, '20:45');
  const neu = S.DB.themen.filter(x => x.name === 'Carport')[0];
  pruefe(neu && (neu.text.match(/\[\] /g) || []).length === 3 && !/Carport/.test(S.DB.themen[0].text), 'Thema: Checkliste „Carport“ angelegt, drei Punkte aus dem Sammler hineingelegt');
  S.coAntwort('ka:Dachrinne reinigen', 'heute', 0, '20:45');
  pruefe(S.aufGeplant(S.kpSeiteFinden('cl-korb'), 'Dachrinne reinigen').datum === heute, '„Heute“ plant den Sammler-Punkt für heute');
  S.coAntwort('cr:tr', 'weiter', 2, '20:45');
  pruefe(S.DB.themen[1].ruht && S.DB.themen[1].ruhtSeit === heute, '„Weiter ruhen“: der Coach fragt erst in 30 Tagen wieder');
  /* Aufräumen Punkt für Punkt, mit Einsortieren (0.53) */
  S.coKorbAufraeumen();
  pruefe(S.cl.app === 'coach' && S.cl.co.ansicht === 'korb' && /Sammler aufräumen · noch 2 von 3/.test(inhalt()) && /Fenster abdichten/.test(inhalt()), 'Aufräumen: ein Punkt nach dem anderen (ohne Termin)');
  S.coKorbPrio(2);
  pruefe(/\[\] P2 Fenster abdichten/.test(S.DB.themen[0].text), 'Priorität im Aufräumen setzen');
  S.coKorbTun('spaeter');
  pruefe(/Steuer/.test(inhalt()) && /Fenster abdichten<\/span><span class="leise">→ später/.test(inhalt()), '„Später“: weiter zum nächsten, unten „Schon entschieden“');
  S.coKorbTun('loeschen');
  pruefe(!/Steuer/.test(S.DB.themen[0].text) && /Alles entschieden/.test(inhalt()), 'Löschen nimmt den Punkt heraus — dann ist alles entschieden');
  S.coKorbFertig();
  /* Quelle abschaltbar */
  S.krFinden('kc-einstellungen').quellen = { korb: false };
  pruefe(!S.coFaellige('20:45', heute).some(f => /^(ka|kv|kw|kt|cr):/.test(f.id)), 'Quelle „Sammler“ ausgeschaltet: keine Sammler-Fragen');
  S.oeffne('uebersicht');
}

/* ============================================================
   115. Agenda im Kalender (0.66.0)
   Grund: Wie die „Agenda View“ im Date Book: Termine und To Dos von
   heute auf einen Blick, Überfälliges, morgen in einer Zeile.
   Erkennt: Abschnitt fehlt, ⚑ heute doppelt (wenn auch eingeplant),
   Überfälliges fehlt, Erledigtes steht drin, Blättern ins Leere.
   ============================================================ */
function agendaTest() {
  console.log('\n115. Agenda im Kalender (0.66.0)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  const altUhr = S.clUhrzeit;
  S.clUhrzeit = () => '11:10';
  S.termineNachTag[heute] = [{ id: 'm1', zeit: '12:30', bis: '14:00', titel: 'Mittag bei Eltern', kontext: 'privat' },
                             { id: 'g1', zeit: '', bis: '', titel: 'Geburtstag Anna', ganztags: true, kontext: 'privat' }];
  const s = S.kpSeiteAnlegen('liste', 'Haus', 'privat', '');
  ['P1 ZEO Solar Auftrag', 'Netflix kündigen', 'Steuer sortieren', 'Geplant und Frist'].forEach(x => S.aufZeileAnhaengen(s, x));
  S.aufPlanAnwenden(s, 0, heute, '');
  S.aufPlanAnwenden(s, 3, heute, '');
  S.ckZusatzSetzen(s, 'Netflix kündigen', heute, '');
  S.ckZusatzSetzen(s, 'Steuer sortieren', S.tagePlus(heute, -2), '');
  S.ckZusatzSetzen(s, 'Geplant und Frist', heute, '');
  S.oeffne('kalender');
  S.clKalAnsicht('agenda');
  const h = inhalt();
  pruefe(/Als Nächstes: Mittag bei Eltern · in 1 Std\. 20/.test(h), 'oben: als Nächstes mit Abstand');
  pruefe(/Termine heute/.test(h) && /Geburtstag Anna/.test(h) && /Mittag bei Eltern/.test(h), 'Termine heute, auch ganztägige');
  pruefe(/To Do · heute/.test(h) && /ZEO Solar Auftrag/.test(h) && /Netflix kündigen<\/span><span class="frist-marke">⚑ heute/.test(h), 'To Dos: eingeplante und ⚑ heute fällige');
  pruefe((h.match(/Geplant und Frist/g) || []).length === 1, 'eingeplant und fällig: nur einmal');
  pruefe(/Überfällig/.test(h) && /Steuer sortieren/.test(h), 'Überfälliges (⚑ vor heute)');
  pruefe(/Morgen ›/.test(h) && /clKalGehe\('[^']+','tag'\)/.test(h), 'eine Zeile für morgen, antippen öffnet den Tag');
  pruefe(/^Agenda /.test(S.document.getElementById('reiter').textContent) && /clKalAnsicht\('agenda'\)">A</.test(S.document.getElementById('fuss').innerHTML), 'Reiter „Agenda …“, unten A als erste Ansicht');
  S.aufHaken(s.id, 1);
  pruefe(!/Netflix kündigen/.test(inhalt()), 'abgehakt direkt in der Agenda');
  S.clBlaettern(1);
  pruefe(S.cl.kal.ansicht === 'tag' && S.clKalDatum() === S.tagePlus(heute, 1), 'Blättern führt in den Tag danach');
  S.clUhrzeit = altUhr;
  S.clKalAnsicht('tag'); S.clKalGehe(heute, 'tag');
  S.oeffne('uebersicht');
}

/* ============================================================
   116. Notiz an einer Aufgabe (0.66.0)
   Grund: Wie die „Note“ im Palm To Do: Hintergrund zu einer Aufgabe.
   Erkennt: Notiz geht beim Speichern/Umbenennen/Verschieben verloren,
   ⚑ Frist wird überschrieben, ▤ fehlt, Suche findet sie nicht, beim
   Löschen bleibt sie hängen.
   ============================================================ */
function aufgabenNotizTest() {
  console.log('\n116. Notiz an einer Aufgabe (0.66.0)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const s = S.kpSeiteAnlegen('liste', 'Haus', 'privat', '');
  S.aufZeileAnhaengen(s, 'ZEO Solar Auftrag');
  S.ckZusatzSetzen(s, 'ZEO Solar Auftrag', '2026-12-01', '');
  S.oeffne('aufgaben');
  S.aufDetails(s.id, 0);
  pruefe(/id="aufNotiz"/.test(S.document.getElementById('aufklapp').innerHTML), 'Details: Feld „Notiz“');
  S.document.getElementById('aufText').value = 'ZEO Solar Auftrag';
  S.document.getElementById('aufFrist').value = '2026-12-01';
  S.document.getElementById('aufNotiz').value = 'Angebot vom 12.10.\nNotstrom ja/nein?';
  S.aufSpeichern();
  let z = S.ckZusatz(s, 'ZEO Solar Auftrag');
  pruefe(z.notiz === 'Angebot vom 12.10.\nNotstrom ja/nein?' && z.frist === '2026-12-01', 'Notiz gespeichert, ⚑ Frist bleibt');
  S.ckZusatzSetzen(s, 'ZEO Solar Auftrag', '2026-12-05', '');
  pruefe(S.ckZusatz(s, 'ZEO Solar Auftrag').notiz === 'Angebot vom 12.10.\nNotstrom ja/nein?', 'Frist ändern (ohne Notiz-Angabe): Notiz bleibt');
  pruefe(/class="notiz-marke" onclick="aufDetails\('/.test(S.ckListeHtml(s)), 'in der Liste: ▤ zum Antippen');
  S.oeffne('suchen');
  pruefe(S.suTreffer('notstrom').some(x => x.gruppe === 'aufgaben' && /▤ Angebot/.test(x.unter)), 'die Suche findet Text in der Notiz');
  /* Umbenennen: Notiz zieht mit */
  S.oeffne('aufgaben');
  S.aufDetails(s.id, 0);
  S.document.getElementById('aufText').value = 'ZEO Auftrag schreiben';
  S.document.getElementById('aufFrist').value = '';
  S.document.getElementById('aufNotiz').value = 'Angebot vom 12.10.\nNotstrom ja/nein?';
  S.aufSpeichern();
  pruefe(S.ckZusatz(s, 'ZEO Auftrag schreiben').notiz && !S.ckZusatz(s, 'ZEO Solar Auftrag').notiz, 'umbenannt: Notiz zieht mit');
  S.ckZusatzSetzen(s, 'ZEO Auftrag schreiben', '', '', '');
  pruefe(!S.ckZusatz(s, 'ZEO Auftrag schreiben').notiz && !s.__satz.zusatz, 'leer: nichts bleibt übrig');
  S.oeffne('uebersicht');
}

/* ============================================================
   117. Kategorien quer durch alles, mit Gesamtsicht (0.66.0)
   Grund: Eine frei definierbare Kategorienliste für To Dos, Notizen,
   Projekte, Ziele, Ideen, Sammlungen und Blätter — und eine Sicht auf
   alles, was zu einer Kategorie gehört.
   Erkennt: neue Kategorie landet im Kurs-Rad, Zuordnung geht beim
   Speichern verloren, Gesamtsicht unvollständig, Löschen lässt
   Zuordnungen stehen, Lebensbereich lässt sich löschen.
   ============================================================ */
function kategorienTest() {
  console.log('\n117. Kategorien quer durch alles, mit Gesamtsicht (0.66.0)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.cl.auf.bereich = '';
  const k = S.katNeuAnlegen('PV-Anlage');
  pruefe(k && k.nurKategorie && S.ckBereichName(k.id) === 'PV-Anlage' && !S.krBereiche(false).some(b => b.id === k.id) && S.krBereiche(false).length === 7,
    'neue Kategorie: wählbar überall, aber nicht im Kurs-Rad (7 Lebensbereiche bleiben)');
  pruefe(S.katNeuAnlegen('pv-anlage').id === k.id, 'gleicher Name: keine zweite');
  /* Zuordnen: Liste, Notiz, Projekt, Ziel, Sammlung, Blatt, Idee */
  const li = S.kpSeiteAnlegen('liste', 'Zählerschrank', 'privat', ''); S.aufZeileAnhaengen(li, 'Foto machen');
  S.oeffne('checklisten'); S.clsOeffnen(li.id); S.clsDetails();
  pruefe(/id="clsKat"/.test(S.clsFensterHtml()) && /🔒 privat/.test(S.clsFensterHtml()), 'Details einer Liste: Kategorie ▼ und 🔒 privat');
  S.document.getElementById('clsTitel').value = 'Zählerschrank';
  S.document.getElementById('clsKat').value = k.id; S.clsSpeichern();
  pruefe(li.__satz.bereich === k.id, 'Liste zugeordnet');
  const no = S.kpSeiteAnlegen('notiz', 'Angebote Vergleich', 'privat', '');
  S.oeffne('memo'); S.memoOeffnen(no.id); S.memoDetails();
  pruefe(/id="memoKat"/.test(S.memoFensterHtml()) && /Beruf \/ Privat:/.test(S.memoFensterHtml()), 'Details einer Notiz: Kategorie ▼ (Beruf/Privat heißt jetzt so)');
  S.document.getElementById('memoTitel').value = 'Angebote Vergleich';
  S.document.getElementById('memoKat').value = k.id; S.memoSpeichern();
  pruefe(no.__satz.bereich === k.id, 'Notiz zugeordnet');
  const pj = S.kpSeiteAnlegen('vorhaben', 'PV-Anlage Haus', 'privat', '');
  S.oeffne('projekte'); S.pjOeffnen(pj.id, 'allgemein');
  pruefe(/id="pjKat"[^>]*onchange="pjFeld\('kategorie'\)"/.test(inhalt()), 'Projekt „Allgemein“: Kategorie wirkt sofort');
  S.document.getElementById('pjKat').value = k.id; S.pjFeld('kategorie');
  pruefe(pj.__satz.bereich === k.id, 'Projekt zugeordnet');
  const sa = S.saAusVorlage(S.SA_VORLAGEN.frei, 'PV-Angebote', false, []);
  S.oeffne('sammlungen'); S.saOeffnen(sa.id); S.saDetailsOeffnen();
  S.document.getElementById('saName').value = 'PV-Angebote';
  S.document.getElementById('saKat').value = k.id; S.saDetailsSpeichern();
  pruefe(sa.bereich === k.id, 'Sammlung zugeordnet');
  S.oeffne('memo'); S.memoArtSetzen('notizblock'); S.nbNeu();
  const b = S.nbFinden(S.cl.nb.id); b.striche = ['1 1,1,5 9,9,5'];
  S.nbDetails(); S.document.getElementById('nbTitel').value = 'Dachskizze'; S.document.getElementById('nbKat').value = k.id; S.nbSpeichern();
  pruefe(b.bereich === k.id, 'Blatt zugeordnet');
  S.memoArtSetzen('');
  S.iwSpeichern({ id: 'iw-pv', titel: 'Speicher nachrüsten', stufe: 1, status: 'aktiv', bereich: k.id, varianten: [], meilensteine: [], schritte: [], wochen: [] });
  /* Gesamtsicht */
  S.oeffne('kategorien');
  pruefe(S.CL_ORDNER.planung.apps.indexOf('kategorien') < 0 && /katOeffnen\('[^']+'\)"><span class="tx">PV-Anlage<\/span><span class="kat-zahl">7</.test(inhalt()), 'App „Kategorien“: „PV-Anlage · 7“');
  S.katOeffnen(k.id);
  const g = inhalt();
  pruefe(/To Do · offen/.test(g) && /Foto machen/.test(g) && /Listen/.test(g) && /Zählerschrank/.test(g) && /Projekte · Ziele/.test(g) && /PV-Anlage Haus/.test(g)
    && /Notizen/.test(g) && /Angebote Vergleich/.test(g) && /Dachskizze/.test(g) && /Speicher nachrüsten/.test(g) && /PV-Angebote/.test(g), 'Gesamtsicht: To Dos, Listen, Projekte, Notizen, Blätter, Ideen, Sammlungen');
  pruefe(S.document.getElementById('reiter').textContent === 'PV-Anlage', 'Reiter: Name der Kategorie');
  S.katNeuIn(); S.document.getElementById('katNeuName').value = 'Fragen an ZEO'; S.katNeuAnlegenIn('notiz');
  const neu = S.kpSeitenAlle().filter(x => x.titel === 'Fragen an ZEO')[0];
  pruefe(neu && neu.__satz.bereich === k.id && S.cl.app === 'memo', 'Neu… in der Gesamtsicht: mit dieser Kategorie');
  /* Reihenfolge, Umbenennen, Löschen */
  S.oeffne('kategorien'); S.katSchieben(k.id, -1);
  pruefe(S.ckBereiche()[S.ckBereiche().length - 2].id === k.id, 'verschieben ▲');
  S.katDetails('kb-haus');
  pruefe(!/katLoeschenFragen/.test(S.katFensterHtml()), 'Lebensbereich aus Kurs: kein Löschen');
  S.aufklappZu();
  S.katDetails(k.id); S.document.getElementById('katName').value = 'Photovoltaik'; S.katSpeichern();
  pruefe(S.ckBereichName(k.id) === 'Photovoltaik', 'umbenennen');
  S.katDetails(k.id); S.katLoeschenFragen(); S.katLoeschen();
  pruefe(!S.ckBereichName(k.id) && !li.__satz.bereich && !no.__satz.bereich && !sa.bereich && !b.bereich && !S.iwFinden('iw-pv').bereich, 'löschen: Kategorie weg, Einträge nicht zugeordnet');
  S.oeffne('uebersicht');
}

/* ============================================================
   120. Kategorien im ▼ der Übersicht (0.66.2)
   Grund: Im Ordner Planung war die App „Kategorien“ kaum zu finden.
   Wie am Palm gehören Kategorien ins ▼ oben rechts.
   Erkennt: Kategorien fehlen im ▼, Tipp öffnet nicht die Gesamtsicht,
   „bearbeiten…“ führt nicht zum Bearbeiten, Eintrag doch im Ordner.
   ============================================================ */
function katUebersichtTest() {
  console.log('\n120. Kategorien im ▼ der Übersicht (0.66.2)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const k = S.katNeuAnlegen('PV-Anlage');
  S.oeffne('uebersicht');
  S.katUm();
  const h = S.document.getElementById('aufklapp').innerHTML;
  pruefe(S.cl.aufklapp === 'kat' && /katSetzen\('beruflich'\)/.test(h) && /<div class="zw">Kategorien<\/div>/.test(h) && /katVonUebersicht\('[^']+'\)">PV-Anlage</.test(h) && /Kategorien bearbeiten…/.test(h),
    '▼ auf der Übersicht: Alle/Beruf/Privat, darunter die Kategorien und „bearbeiten…“');
  S.katVonUebersicht(k.id);
  pruefe(S.cl.app === 'kategorien' && S.cl.kat.id === k.id && S.document.getElementById('reiter').textContent === 'PV-Anlage', 'Tipp: Gesamtsicht der Kategorie');
  S.katVonUebersicht('');
  pruefe(S.cl.app === 'kategorien' && S.cl.kat.bearbeiten && /katSchieben/.test(inhalt()), '„Kategorien bearbeiten…“: Liste zum Sortieren und Umbenennen');
  pruefe(S.CL_ORDNER.planung.apps.indexOf('kategorien') < 0, 'nicht mehr im Ordner Planung — ein Weg');
  S.oeffne('aufgaben'); S.katUm();
  pruefe(!/katVonUebersicht/.test(S.document.getElementById('aufklapp').innerHTML), 'in anderen Apps bleibt ihr eigenes ▼');
  S.aufklappZu();
  S.oeffne('uebersicht');
}

/* ============================================================
   119. Seiten in „Notizen“ trotz ▼ Notizblock/Handschrift (0.66.1)
   Grund: Projekte → Inhalt → „Schreiben“ landete im Notizblock, weil
   Notizen zuletzt auf ▼ Notizblock stand.
   Erkennt: Schreiben/Öffnen einer Seite (Projekt, Ziel, Liste, Notiz)
   zeigt statt der Seite den Notizblock oder die Handschrift.
   ============================================================ */
function memoSeiteStattArtTest() {
  console.log('\n119. Seiten in „Notizen“ trotz ▼ Notizblock/Handschrift (0.66.1)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const pj = S.kpSeiteAnlegen('vorhaben', 'Carport', 'privat', '');
  pj.text = 'Statik klären';
  const zi = S.kpSeiteAnlegen('vorhaben', 'Autark 60 %', 'privat', 'ziel');
  const li = S.kpSeiteAnlegen('liste', 'Haus', 'privat', '');
  const no = S.kpSeiteAnlegen('notiz', 'Angebote', 'privat', '');
  const pruefeSeite = (wie, tun) => {
    S.oeffne('memo'); S.memoArtSetzen('notizblock'); S.nbNeu();
    tun();
    const h = inhalt();
    pruefe(S.cl.app === 'memo' && !/nbFlaeche|hs-zeile|Noch kein Blatt/.test(h) && S.cl.memo.art === '' && !/Notizblock/.test(S.document.getElementById('katKnopf').textContent), wie);
  };
  pruefeSeite('Projekt → Inhalt → Schreiben: das Schreibfeld des Projekts', () => { S.oeffne('projekte'); S.pjOeffnen(pj.id, 'inhalt'); S.pjSchreiben(); });
  pruefe(/id="memoFeld"/.test(inhalt()) && /Statik klären/.test(inhalt()), '… mit dem Text des Projekts');
  pruefeSeite('Ziel → Schreiben: das Schreibfeld des Ziels', () => { S.oeffne('ziele'); S.ziOeffnen(zi.id); S.ziSchreiben(); });
  pruefeSeite('Liste → Schreiben: das Schreibfeld der Liste', () => { S.todoListe(li.id); S.listeAlsText(); });
  pruefeSeite('Notiz öffnen (z. B. aus Suche oder Kategorie): die Notiz', () => { S.seiteOeffnen(no.id); });
  pruefe(!S.kpSeitenAlle().some(s => s.__satz && s.__satz.typ === 'notizblock') && S.nbAlle().length === 0, 'die leeren Blätter von eben sind wieder weg');
  S.oeffne('uebersicht');
}

/* ============================================================
   118. Private Einträge (0.66.0)
   Grund: Wie „Security“ am Palm: Privates maskieren oder verbergen,
   zeigen nur mit PIN.
   Erkennt: Privates sichtbar trotz Maske (Liste, To Do, Suche, Agenda,
   Coach, geöffnete Seite), falsche PIN zeigt es, vorübergehende Freigabe
   bleibt nach dem Verlassen bestehen.
   ============================================================ */
function privatTest() {
  console.log('\n118. Private Einträge (0.66.0)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  S.localStorage.removeItem('clie-privat'); S.localStorage.removeItem('clie-pin');
  const n1 = S.kpSeiteAnlegen('notiz', 'Tagebuch', 'privat', ''); n1.__satz.privat = true;
  const n2 = S.kpSeiteAnlegen('notiz', 'Einkauf', 'privat', '');
  const li = S.kpSeiteAnlegen('liste', 'Haus', 'privat', '');
  S.aufZeileAnhaengen(li, 'Geschenk Anna kaufen'); S.aufZeileAnhaengen(li, 'Dachrinne');
  S.ckZusatzPrivat(li, 'Geschenk Anna kaufen', true);
  S.aufPlanAnwenden(li, 0, heute, '');
  pruefe(S.prModus() === 'zeigen' && !S.prPrivatVerborgen(n1, null), 'Vorgabe: zeigen');
  S.oeffne('memo');
  S.menueUm();
  pruefe(/prModusSetzen\('maskieren'\)/.test(S.document.getElementById('aufklapp').innerHTML), 'Menü ≡: Private Einträge zeigen | maskieren | verbergen');
  S.prModusSetzen('maskieren');
  let h = inhalt();
  pruefe(/— privat — 🔒/.test(h) && !/Tagebuch/.test(h) && /Einkauf/.test(h), 'maskiert: „— privat —“ statt des Titels');
  S.memoOeffnen(n1.id);
  pruefe(/Dieser Eintrag ist privat/.test(inhalt()) && !/Tagebuch/.test(S.memoSeiteHtml(n1)), 'geöffnet: nur die Maske');
  S.memoZurListe();
  S.oeffne('aufgaben');
  h = inhalt();
  pruefe(/— 1 private — 🔒/.test(h) && !/Geschenk Anna/.test(h) && /Dachrinne/.test(h), 'To Do: private Aufgabe maskiert gezählt');
  S.oeffne('suchen');
  pruefe(!S.suTreffer('tagebuch').length && !S.suTreffer('geschenk').length && S.suTreffer('einkauf').length, 'Suche findet Privates nicht');
  pruefe(!S.clTagZeilen(heute).some(z => /Geschenk/.test(z.roh)), 'Kalender und Agenda: private eingeplante Aufgabe fehlt');
  pruefe(S.prCoachFilter([{ text: '„Geschenk Anna kaufen“ wartet.' }, { text: 'Dachrinne?' }]).length === 1, 'Coach nennt Privates nicht');
  S.prModusSetzen('verbergen');
  S.oeffne('memo');
  pruefe(!/privat/.test(inhalt()) && /Einkauf/.test(inhalt()), 'verborgen: gar nicht zu sehen');
  /* PIN */
  S.prPinFestlegen(); S.document.getElementById('prPin').value = '4711'; S.prPinSpeichern();
  pruefe(S.prPinDa() && S.localStorage.getItem('clie-pin') !== '4711', 'PIN festgelegt (nicht im Klartext)');
  S.prModusSetzen('zeigen');
  pruefe(S.cl.aufklapp === 'privat' && S.prModus() === 'verbergen', 'zeigen fragt nach der PIN');
  S.document.getElementById('prPin').value = '1234'; S.prPinPruefen();
  pruefe(S.prModus() === 'verbergen' && /stimmt nicht/.test(S.document.getElementById('toastText').textContent), 'falsche PIN: bleibt verborgen');
  S.document.getElementById('prPin').value = '4711'; S.prPinPruefen();
  pruefe(S.prModus() === 'zeigen' && /Tagebuch/.test(inhalt()), 'richtige PIN: gezeigt');
  /* Vorübergehend freigeben (Antippen der Maske) — beim Verlassen wieder wie vorher */
  S.prModusSetzen('maskieren');
  S.prFreigeben(); S.document.getElementById('prPin').value = '4711'; S.prPinPruefen();
  pruefe(S.prModus() === 'zeigen', 'Maske antippen + PIN: gezeigt');
  S.prVerlassen();
  pruefe(S.prModus() === 'maskieren', 'beim Verlassen von CLIE: wieder maskiert');
  /* privat setzen in den Details */
  S.oeffne('aufgaben'); S.prModusSetzen('zeigen');
  S.document.getElementById('prPin').value = '4711'; S.prPinPruefen();
  S.aufDetails(li.id, 1);
  S.document.getElementById('aufText').value = 'Dachrinne';
  S.document.getElementById('aufPrivat').checked = true;
  S.aufSpeichern();
  pruefe(S.ckZusatz(li, 'Dachrinne').privat === true, 'Aufgaben-Details: 🔒 privat');
  S.document.getElementById('aufPrivat').checked = false;
  S.localStorage.removeItem('clie-privat'); S.localStorage.removeItem('clie-pin');
  S.oeffne('uebersicht');
}

/* ============================================================
   114. Notizblock: mit Stift oder Finger schreiben (0.65.0)
   Grund: Am iPad mit dem Apple Pencil, am Pixel mit dem Finger direkt in
   CLIE von Hand schreiben und skizzieren — wie der Note Pad am Palm.
   Erkennt: Striche falsch gespeichert (Format, Druck, Stärke), Finger
   zeichnet trotz erkanntem Stift, Radierer/Rückgängig kaputt, leere
   Blätter bleiben liegen, Ablegen schreibt in den Seitentext (würde die
   Workbench stören), Blätter zu groß für die workbench.json.
   ============================================================ */
function notizblockTest() {
  console.log('\n114. Notizblock: mit Stift oder Finger schreiben (0.65.0)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.cl.nb.stift = false; S.cl.nb.schieben = false; S.cl.nb.werkzeug = 1;
  S.oeffne('memo');
  pruefe(/memoArtSetzen\('notizblock'\)">\<span>Notizblock/.test(S.memoWahlHtml()), '▼ in Notizen: Notizblock');
  S.memoArtSetzen('notizblock');
  pruefe(/Noch kein Blatt/.test(inhalt()) && /nbNeu\(\)/.test(S.document.getElementById('fuss').innerHTML), 'leer: Hinweis und „Neu“');
  S.nbNeu();
  const b = S.nbFinden(S.cl.nb.id);
  pruefe(b && b.typ === 'notizblock' && /^nb-/.test(b.id) && /id="nbFlaeche"/.test(inhalt()) && /hsAblegenFragen\(\)/.test(S.document.getElementById('fuss').innerHTML), 'Neu: Blatt in DB.kurs, Fläche, „Ablegen…“');
  pruefe(/^✎ Notiz \d\d\.\d\d\. \d\d:\d\d$/.test(S.document.getElementById('reiter').textContent), 'Titel ohne Eingabe: „Notiz TT.MM. HH:MM“');
  const ev = (art, x, y, pr) => ({ pointerType: art, pressure: pr, clientX: x, clientY: y, pointerId: 1, preventDefault() {} });
  const strich = (art, punkte, pr) => { S.nbRunter(ev(art, punkte[0][0], punkte[0][1], pr)); punkte.slice(1).forEach(q => S.nbZiehen(ev(art, q[0], q[1], pr))); S.nbHoch(); };
  /* Finger (Pixel) */
  strich('touch', [[100, 100], [150, 120], [151, 120], [200, 140]], 0.5);
  pruefe(b.striche.length === 1 && b.striche[0] === '1 100,100,5 150,120,5 200,140,5', 'Finger: ein Strich, fein, Druck 5 — dicht beieinander liegende Punkte fallen weg');
  S.nbWerkzeug(2);
  strich('touch', [[300, 300], [320, 340]], 0.5);
  pruefe(/^2 300,300,5 320,340,5$/.test(b.striche[1]), 'kräftig: Stärke 2');
  /* Stift (iPad): Druck, danach zeichnet der Finger nicht mehr */
  S.nbWerkzeug(1);
  strich('pen', [[400, 400], [420, 410], [440, 430]], 0.9);
  pruefe(S.cl.nb.stift && /^1 400,400,8 420,410,8 440,430,8$/.test(b.striche[2]), 'Stift: Druck 0,9 → 8; Stift erkannt');
  strich('touch', [[600, 600], [650, 650]], 0.5);
  pruefe(b.striche.length === 3 && !/nbSchiebenUm/.test(S.nbLeisteHtml()) && /Finger scrollt/.test(S.nbHinweisText()), 'nach dem Stift zeichnet der Finger nicht (Hand stört nicht), ✋ entfällt');
  /* Radierer und Rückgängig */
  S.nbWerkzeug('radierer');
  S.nbRunter(ev('pen', 151, 121, 0.5)); S.nbHoch();
  pruefe(b.striche.length === 2 && !/^1 100,100/.test(b.striche[0]), 'Radierer nimmt den berührten Strich ganz weg');
  S.nbRueckgaengig();
  pruefe(b.striche.length === 3 && /^1 100,100/.test(b.striche[0]), 'Rückgängig holt ihn zurück (an seinen Platz)');
  S.nbRueckgaengig();
  pruefe(b.striche.length === 2, 'Rückgängig nimmt den letzten Strich weg');
  S.nbWerkzeug(1);
  /* Lesen */
  const g = S.nbStrichLesen('2 10,20,3 30,40,9');
  pruefe(g.s === 2 && g.punkte.length === 2 && g.punkte[1].p === 9 && S.nbStrichText(g) === '2 10,20,3 30,40,9', 'Format liest und schreibt sich gleich');
  /* Größe: eine volle Seite Handschrift */
  const voll = [];
  for (let i = 0; i < 60; i++) { let s = '1'; for (let k = 0; k < 60; k++) { s += ' ' + (100 + k * 7) + ',' + (100 + i * 20) + ',' + (5 + (k % 4)); } voll.push(s); }
  const kb = JSON.stringify(voll).length / 1024;
  pruefe(kb < 45, 'eine volle Seite (60 Striche à 60 Punkte) bleibt klein: ' + kb.toFixed(1) + ' KB');
  /* Ablegen im Projekt: Text bleibt sauber, Blatt merkt sich den Ort */
  S.DB.projekte.push({ id: 'pjn', name: 'Gartenhaus', flaeche: 'Idee', status: 'laufend', kontext: 'privat', ordnung: 1, geaendert: 1 });
  S.document.getElementById('hsPunkt').value = 'Holz bestellen';
  S.hsPunktDazu();
  S.hsAblegenFragen();
  pruefe(S.cl.aufklapp === 'handschrift', 'Ablegen… wie bei der Handschrift aus Drive');
  S.hsAblegen('seite', 'pjn');
  pruefe(b.bei && b.bei.seite === 'pjn' && S.DB.projekte[0].flaeche === 'Idee\n[] Holz bestellen' && S.cl.nb.id === '', 'im Projekt: Punkt dort, kein „!skizze“ im Text, Blatt merkt sich den Ort');
  pruefe(/class="hs-anhang" onclick="nbOeffnen\('/.test(S.memoSeiteHtml(S.kpSeiteFinden('pjn'), true)), 'das Projekt zeigt das Blatt als Anhang');
  pruefe(/Abgelegt/.test(inhalt()) && /→ ◎ Gartenhaus/.test(inhalt()), 'Liste: unter „Abgelegt“ mit Ort');
  /* Leeres Blatt verschwindet */
  S.nbNeu();
  const leerId = S.cl.nb.id;
  S.nbZurListe();
  pruefe(!S.nbFinden(leerId), 'ein leeres Blatt bleibt nicht liegen');
  /* Nur ablegen, als Idee */
  S.nbNeu(); const b2 = S.nbFinden(S.cl.nb.id); strich('pen', [[10, 10], [60, 60]], 0.5);
  S.hsAblegen('nur', '');
  pruefe(b2.bei && b2.bei.nur, '„nur ablegen“');
  S.nbNeu(); const b3 = S.nbFinden(S.cl.nb.id); strich('pen', [[10, 10], [60, 60]], 0.5);
  S.hsAblegen('idee', '');
  const idee = S.iwFinden(b3.bei && b3.bei.idee);
  pruefe(idee && /nbOeffnen/.test(S.nbAnhaengeHtml('idee', idee.id)), 'als Idee: die Idee zeigt das Blatt');
  /* Details: Titel, Löschen */
  S.nbOeffnen(b2.id);
  S.nbDetails();
  S.document.getElementById('nbTitel').value = 'Gartenhaus Skizze';
  S.nbSpeichern();
  pruefe(b2.titel === 'Gartenhaus Skizze' && S.nbTitel(b2) === 'Gartenhaus Skizze', 'Details: Titel');
  S.nbDetails(); S.nbLoeschenFragen(); S.nbLoeschen();
  pruefe(!S.nbFinden(b2.id) && S.DB.grabsteine.some(x => x.id === b2.id), 'Löschen mit Grabstein (kommt per Abgleich nicht zurück)');
  S.memoArtSetzen('');
  S.oeffne('uebersicht');
}

/* ============================================================
   113. Handschrift aus Drive in Notizen (0.64.0)
   Grund: Private Notizen und Ideen entstehen auf dem reMarkable Move oder
   dem iPad als PDF im Drive-Ordner der Workbench. CLIE zeigt den Eingang,
   lässt Punkte herausschreiben und legt die Notiz ab — als Zeile
   „!skizze:<ID>“, die auch die Workbench versteht.
   Erkennt: falscher Ordner/fehlende Anmeldung beim Holen, Abgelegtes im
   Eingang, Punkte gehen verloren oder landen falsch, Zeile doppelt,
   „!skizze“ roh im Text statt Vorschau, Coach drängt ohne Stau.
   ============================================================ */
function handschriftTest() {
  console.log('\n113. Handschrift aus Drive in Notizen (0.64.0)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  S.oeffne('memo');
  S.memoArtSetzen('handschrift');
  pruefe(/Noch kein Ordner/.test(inhalt()) && /▼ Handschrift/.test(S.document.getElementById('katKnopf').textContent), 'ohne Ordner: Hinweis auf die Workbench, oben „▼ Handschrift“');
  /* Holen: mit Anmeldung, ohne öffentlichen Schlüssel */
  S.DB.einstellungen.skizzenOrdner = 'ORDNER123';
  S.zugriffToken = 'test'; S.tokenAblauf = Date.now() + 3600000;
  const rufe = [];
  S.fetch = function (adresse, o) { rufe.push({ adresse, o: o || {} }); return new Promise(function () {}); };
  S.cl.hs.laeuft = false;
  S.hsHolen(true);
  pruefe(rufe.length === 1 && decodeURIComponent(rufe[0].adresse).indexOf("'ORDNER123' in parents") > 0 && !/&key=/.test(rufe[0].adresse) && /Bearer test/.test(JSON.stringify(rufe[0].o.headers)),
    'holt den Ordner der Workbench mit der Anmeldung (ohne Freigabe-Schlüssel)');
  S.cl.hs.laeuft = false;
  S.cl.hs.fehler = 'Der Ordner ließ sich nicht lesen (Antwort 403).';
  pruefe(/hsErlauben\(\)">Drive lesen erlauben/.test(S.hsListeHtml()), 'fehlt das Drive-Recht: „Drive lesen erlauben“');
  pruefe(/VL_DRIVE_KEY, 'an'/.test(QUELLE.slice(QUELLE.indexOf('function hsErlauben'), QUELLE.indexOf('function hsErlauben') + 300)), 'Erlauben fordert drive.readonly an (wie Vorlesen)');
  S.cl.hs.fehler = '';
  S.zugriffToken = null; S.tokenAblauf = 0;
  /* Liste: zwei im Eingang, eine schon im Projekt */
  const alt = S.tagePlus(heute, -10) + 'T08:00:00Z';
  S.cl.hs.liste = [{ id: 'f1aaaaaa', name: 'Ideen Carport.pdf', mimeType: 'application/pdf', modifiedTime: heute + 'T07:52:00Z' },
                   { id: 'f2aaaaaa', name: 'Notizbuch-23.pdf', mimeType: 'application/pdf', modifiedTime: alt },
                   { id: 'f3aaaaaa', name: 'PV Fragen.png', mimeType: 'image/png', modifiedTime: alt }];
  S.DB.projekte.push({ id: 'pj1', name: 'Carport', flaeche: 'Text\n!skizze:f3aaaaaa', status: 'laufend', kontext: 'privat', ordnung: 1, geaendert: 1 });
  S.zeichne();
  let h = inhalt();
  pruefe(/Eingang · 2/.test(h) && /Ideen Carport/.test(h) && /seit 10 T\./.test(h) && /Zuletzt abgelegt/.test(h) && /→ ◎ Carport/.test(h), 'Eingang · 2 (alte mit „seit 10 T.“), darunter Abgelegtes mit Ort');
  S.katUm();
  pruefe(S.cl.aufklapp === 'memowahl' && /memoArtSetzen\('handschrift'\)"><span>Handschrift<\/span><small>2 neu/.test(S.document.getElementById('aufklapp').innerHTML), '▼: Notizen | Handschrift (2 neu) | Alle Handschriften');
  S.aufklappZu();
  /* Ansehen: ohne Recht die Vorschau und „Erlauben“; Punkte sammeln */
  S.hsOeffnen('f1aaaaaa');
  h = inhalt();
  pruefe(/Erlauben/.test(h) && /id="hsPunkt"/.test(h) && /hsAblegenFragen\(\)/.test(S.document.getElementById('fuss').innerHTML) && /✎ Ideen Carport/.test(S.document.getElementById('reiter').textContent),
    'Ansehen: Vorschau, „Erlauben“ für alle Seiten, Feld zum Herausschreiben, „Ablegen…“');
  S.document.getElementById('hsPunkt').value = 'Statiker fragen';
  S.hsPunktDazu();
  S.document.getElementById('hsPunkt').value = 'Pultdach vergleichen';
  S.hsPunktTaste({ key: 'Enter', preventDefault() {} });
  pruefe(S.cl.hs.gesammelt.length === 2 && /Gesammelt: /.test(inhalt()), 'zwei Punkte gesammelt');
  /* Ablegen im Projekt: Zeile und Punkte dort */
  S.hsAblegenFragen();
  pruefe(S.cl.aufklapp === 'handschrift' && /Ideenwerkstatt/.test(S.hsFensterHtml()) && /2 gesammelte Punkte/.test(S.hsFensterHtml()), 'Ablegen: Seite, Idee oder nur ablegen — Punkte gehen mit');
  S.hsFensterSchritt('ziel');
  pruefe(/hsAblegen\('seite','pj1'\)">◎ Carport/.test(S.hsFensterHtml()), 'zur Wahl: Projekte, Ziele, Listen, Notizen');
  S.hsAblegen('seite', 'pj1');
  const pj = S.DB.projekte[0].flaeche;
  pruefe(/!skizze:f1aaaaaa/.test(pj) && /\[\] Statiker fragen/.test(pj) && /\[\] Pultdach vergleichen/.test(pj) && S.cl.hs.offen === '' && S.cl.hs.gesammelt.length === 0, 'im Projekt: Zeile „!skizze:…“ und die Punkte');
  S.hsOeffnen('f1aaaaaa'); S.hsAblegen('seite', 'pj1');
  pruefe((S.DB.projekte[0].flaeche.match(/!skizze:f1aaaaaa/g) || []).length === 1, 'nochmal ablegen: keine doppelte Zeile');
  /* Die Seite zeigt die Vorschau, nicht die rohe Zeile */
  const sh = S.memoSeiteHtml(S.kpSeiteFinden('pj1'), true);
  pruefe(/class="hs-anhang" onclick="hsOeffnen\('f1aaaaaa'\)"/.test(sh) && !/!skizze/.test(sh), 'auf der Seite: Vorschau „✎ …“ zum Antippen statt „!skizze:…“');
  /* Nur ablegen: Punkte in den Sammler */
  S.hsOeffnen('f2aaaaaa');
  S.document.getElementById('hsPunkt').value = 'Garten planen';
  S.hsPunktDazu();
  S.hsAblegen('nur', '');
  pruefe(S.krFinden('hs-f2aaaaaa') && S.krFinden('hs-f2aaaaaa').abgelegt === heute && /\[\] Garten planen/.test(S.ckKorb(false).text), '„nur ablegen“: gemerkt, Punkte im Sammler');
  pruefe(S.hsEingang().length === 0 && /Alles verarbeitet/.test(inhalt()), 'Eingang leer');
  /* Als Idee */
  S.cl.hs.liste.push({ id: 'f4aaaaaa', name: 'Hochbeet.pdf', mimeType: 'application/pdf', modifiedTime: alt });
  S.hsOeffnen('f4aaaaaa'); S.hsAblegen('idee', '');
  const idee = S.iwAlle().filter(x => x.titel === 'Hochbeet')[0];
  pruefe(idee && JSON.stringify(idee.skizzen) === '["f4aaaaaa"]', 'als neue Idee: Titel aus dem Dateinamen, Handschrift hängt daran');
  /* Liste zeigt die Zeile ebenfalls */
  S.DB.themen.push({ id: 'lx', name: 'Haus', text: '[] a\n!skizze:f4aaaaaa', kontext: 'privat', ordnung: 1, geaendert: 1 });
  pruefe(/hs-anhang/.test(S.ckListeHtml(S.kpSeiteFinden('lx'))), 'auch in einer Liste als Vorschau');
  /* Coach: erst bei Stau (≥ 5, älteste ≥ 7 Tage), dann eine Woche Ruhe */
  S.cl.hs.liste = [1, 2, 3, 4].map(i => ({ id: 'n' + i + 'aaaaaa', name: 'N' + i + '.pdf', mimeType: 'application/pdf', modifiedTime: alt }));
  pruefe(S.coHandschriftFragen(heute).length === 0, 'vier im Eingang: der Coach schweigt');
  S.cl.hs.liste.push({ id: 'n5aaaaaa', name: 'N5.pdf', mimeType: 'application/pdf', modifiedTime: alt });
  const q = S.coHandschriftFragen(heute);
  pruefe(q.length === 1 && /5 Handschriften im Eingang, die älteste seit 10 Tagen/.test(q[0].text), 'fünf, älteste seit 10 Tagen: eine ruhige Frage');
  S.coRuheSetzen(q[0].id, S.tagePlus(heute, 7));
  pruefe(S.coHandschriftFragen(heute).length === 0, '„Später“: eine Woche Ruhe');
  S.memoArtSetzen('');
  pruefe(!/hs-zeile/.test(inhalt()) && S.localStorage.getItem('clie-memo-art') === '', '▼ Notizen: wieder die Notizen, gemerkt auf dem Gerät');
  S.oeffne('uebersicht');
}

/* ============================================================
   112. Keine Zahlen an Symbolen, keine App „Heute“ (0.63.0)
   Grund: Der Palm kannte keine Badges; die App „Heute“ doppelte Kalender
   und Coach.
   Erkennt: Zahl an einem Symbol, „Heute“ wieder in Apps/Ordner, Aufrufe
   ins Leere (oeffne('heute'), heuteHtml, clHeuteZahl …), Coach „einzeln“
   führt nicht in den Kalender.
   ============================================================ */
function ohneHeuteTest() {
  console.log('\n112. Keine Zahlen an Symbolen, keine App „Heute“ (0.63.0)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.DB.gedanken.push({ id: 'c1', titel: 'Urlaub', text: '[] a', checkliste: 'lauf', geaendert: 1 });
  S.oeffne('uebersicht');
  pruefe(!/class="zahl"/.test(inhalt()) && !/\.zahl\{/.test(QUELLE), 'keine Zahlen an Symbolen, auch kein Stil dafür');
  pruefe(!S.clApp('heute') && Object.keys(S.CL_ORDNER).every(k => S.CL_ORDNER[k].apps.indexOf('heute') < 0) && !S.CL_BILD.heute, 'keine App „Heute“, auch in keinem Ordner');
  pruefe(!/oeffne\('heute'\)|oeffne\(\\'heute\\'\)|function heuteHtml|function clHeuteZahl|function silkZeichnen|heuteZahl|cl\.app === 'heute'/.test(QUELLE), 'keine Reste: kein Aufruf ins Leere');
  S.oeffne('heute');
  pruefe(S.cl.app === 'uebersicht', 'ein alter Verweis auf „Heute“ landet auf der Übersicht');
  pruefe(/if \(code === 'einzeln'\) \{ oeffne\('kalender'\); clKalGehe\(isoDatum\(\), 'tag'\)/.test(QUELLE), 'Coach „einzeln“ öffnet den Tag im Kalender');
}

/* ============================================================
   111. Sammler statt Korb, ▼ ohne Überschriften, Ziele auf dem Start (0.62.0)
   Grund: „Sammler“ passt besser als „Korb“; die Bereichsüberschriften im ▼
   machten es unruhig; Ziele gehören auf die Startseite.
   Erkennt: irgendwo in der Oberfläche steht noch „Korb“, ein alter
   „Korb“ wird nicht umbenannt (oder bekommt eine neue Kennung),
   Überschriften im ▼, Ziele fehlt auf dem Start.
   ============================================================ */
function sammlerTest() {
  console.log('\n111. Sammler statt Korb, ▼ ohne Überschriften, Ziele auf dem Start (0.62.0)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  /* Kein „Korb“ mehr in Texten des Programms — Bezeichner (coKorb…, ckKorb…) zählen nicht */
  /* Ausgenommen: die Umbenennung selbst (0.62) */
  const reste = QUELLE.split('\n').filter(z => !/0\.62/.test(z) && !/x\.name === 'Korb'/.test(z)).join('\n').match(/(^|[^A-Za-z_])Korb(?![A-Za-z_])/g);
  const restZahl = (reste || []).length;
  pruefe(restZahl === 0, 'nirgends mehr „Korb“ in der Oberfläche (' + restZahl + ' Reste)');
  /* Alter Korb wird umbenannt, Kennung bleibt */
  S.DB.themen = [{ id: 'cl-korb', name: 'Korb', kontext: '', text: '[] Dachrinne', korb: true, ordnung: 0, geaendert: 1 },
                 { id: 'lh', name: 'Haus', text: '[] Fenster', kontext: 'privat', bereich: 'kb-haus', ordnung: 1, geaendert: 1 }];
  const k = S.ckKorb(false);
  pruefe(k && k.id === 'cl-korb' && k.titel === 'Sammler' && S.DB.themen[0].name === 'Sammler' && S.DB.themen[0].geaendert > 1 && S.DB.themen.length === 2,
    'alter „Korb“ heißt jetzt „Sammler“ — gleiche Kennung, kein zweiter');
  S.oeffne('aufgaben');
  S.katUm();
  const dd = S.document.getElementById('aufklapp').innerHTML;
  pruefe(/<span>Sammler<\/span><small>1</.test(dd) && !/class="zw"/.test(dd) && /todoListe\('lh'\)/.test(dd), '▼: „Sammler“ mit Zahl, Listen ohne Bereichsüberschriften');
  S.aufklappZu();
  S.aufNeu();
  pruefe(/▼ Sammler/.test(S.aufFensterHtml()), 'Neu: „Checkliste: ▼ Sammler“');
  S.aufklappZu();
  const start = S.CL_APPS.filter(a => a.raster !== false).map(a => a.id);
  pruefe(start.indexOf('ziele') >= 0 && start.indexOf('kurs') < 0 && start.length === 12 && S.CL_ORDNER.planung.apps.indexOf('ziele') < 0, 'Start: Ziele statt Kurs, weiter 12 Felder');
  S.oeffne('uebersicht');
}

/* ============================================================
   110. Aufgaben und Checklisten sind eine App „To Do“ (0.61.0)
   Grund: Beide Apps zeigten zu 90 % dieselben Daten. Wie am Palm gibt es
   jetzt eine App mit ▼ oben rechts: Alle, Sammler, jede laufende Liste,
   Ruhende/Fertige/Vorlagen.
   Erkennt: „Checklisten“ wieder im Raster, Reiter nicht „To Do“, ▼ fehlt
   in der Listen-Ansicht, „Fertig“/Zurück führen ins Leere, Abhak-Punkte
   fluten „Alle“, Vorlage-Start bleibt unter „Vorlagen…“ hängen.
   ============================================================ */
function toDoTest() {
  console.log('\n110. Aufgaben und Checklisten sind eine App „To Do“ (0.61.0)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.cl.auf.bereich = ''; S.cl.auf.liste = '';
  S.DB.themen = [{ id: 'lh', name: 'Haus', text: '[] Dachrinne', kontext: 'privat', bereich: 'kb-haus', ordnung: 1, geaendert: 1 }];
  S.DB.gedanken.push({ id: 'gp', titel: 'Packen', text: '[] Koffer\n[] Ladekabel', kontext: 'privat', checkliste: 'lauf', gestartet: S.isoDatum(), ordnung: 2, geaendert: 1 });
  S.DB.gedanken.push({ id: 'gv', titel: 'Packliste Urlaub', text: '[] Pass', kontext: 'privat', checkliste: 'vorlage', ordnung: 3, geaendert: 1 });
  const raster = S.CL_APPS.filter(a => a.raster !== false).map(a => a.id);
  pruefe(raster.indexOf('checklisten') < 0 && S.clApp('aufgaben').name === 'To Do', 'eine App „To Do“ im Raster, „Checklisten“ nicht mehr');
  S.oeffne('aufgaben');
  pruefe(S.document.getElementById('reiter').textContent === 'To Do' && /▼ Alle/.test(S.document.getElementById('katKnopf').textContent), 'Reiter „To Do“, oben rechts „▼ Alle“');
  pruefe(/Dachrinne/.test(inhalt()) && !/Koffer/.test(inhalt()), '„Alle“: Aufgaben ja, Punkte der Abhak-Liste nicht (nur geplant oder mit Frist)');
  S.katUm();
  const dd = S.document.getElementById('aufklapp').innerHTML;
  pruefe(/todoListe\('lh'\)/.test(dd) && /☑ Packen/.test(dd) && !/todoListe\('gv'\)/.test(dd), '▼: laufende Listen, ☑ vor der Abhak-Liste, Vorlagen nicht einzeln');
  S.todoListe('gp');
  pruefe(S.cl.app === 'checklisten' && S.cl.aufklapp === '' && S.document.getElementById('reiter').textContent === 'To Do' && /▼ Packen/.test(S.document.getElementById('katKnopf').textContent), 'Liste gewählt: Reiter bleibt „To Do“, oben „▼ Packen“');
  pruefe(!/clsZurListe\(\)">Fertig/.test(S.document.getElementById('fuss').innerHTML), 'aus dem ▼ geöffnet: kein „Fertig“ — das ▼ führt weiter');
  S.katUm();
  pruefe(S.cl.aufklapp === 'liste' && /todoAlle\(\)/.test(S.document.getElementById('aufklapp').innerHTML), 'auch in der Liste dasselbe ▼');
  S.aufklappZu();
  S.zurueckGedrueckt();
  pruefe(S.cl.app === 'aufgaben', 'Zurück aus einer Liste: „Alle“');
  /* Vorlagen… */
  S.todoSicht('vorlage');
  pruefe(S.cl.app === 'checklisten' && /Packliste Urlaub/.test(inhalt()) && /▼ Vorlagen/.test(S.document.getElementById('katKnopf').textContent), '„Vorlagen…“ zeigt die Vorlagen');
  S.clsOeffnen('gv');
  pruefe(/clsZurListe\(\)">Fertig/.test(S.document.getElementById('fuss').innerHTML) && /▼ Vorlage: Packliste Urlaub/.test(S.document.getElementById('katKnopf').textContent), 'Vorlage aus „Vorlagen…“: mit „Fertig“');
  S.clsZurListe();
  pruefe(S.cl.cls.sicht === 'vorlage' && S.cl.cls.id === '' && S.cl.app === 'checklisten', '„Fertig“ führt zurück zu „Vorlagen…“');
  S.clsOeffnen('gv');
  S.clsStarten('gv');
  pruefe(S.cl.cls.sicht === '' && S.ckZustand(S.kpSeiteFinden(S.cl.cls.id)) === 'lauf', 'gestartet: die Liste läuft, nicht mehr unter „Vorlagen…“');
  /* Neue Liste öffnet in To Do; ein Projekt filtert weiter „Alle“ */
  S.todoNeueListe();
  pruefe(S.cl.aufklapp === 'checkliste', '„+ Neue Liste…“ öffnet „Neu“');
  S.aufklappZu();
  S.DB.projekte.push({ id: 'pj', name: 'Umbau', flaeche: '[] Statik', status: 'laufend', kontext: 'privat', ordnung: 9, geaendert: 1 });
  S.oeffne('aufgaben');
  S.cl.auf.wahlFuer = 'filter';
  S.listeGewaehlt('pj');
  pruefe(S.cl.app === 'aufgaben' && S.cl.auf.liste === 'pj', 'ein Projekt bleibt ein Filter in „Alle“');
  S.todoAlle();
  pruefe(S.cl.auf.liste === '' && S.cl.app === 'aufgaben', '„Alle“ hebt ihn auf');
  pruefe(!/function clsWahlHtml|function clsBereichSetzen|function clsKorbOeffnen|function ckKlapp/.test(QUELLE), 'alte Checklisten-Übersicht ist ganz entfernt');
  S.oeffne('uebersicht');
}

/* ============================================================
   109. Sammlung: Filter mit zwei Bedingungen (0.60.0)
   Grund: Filter brauchen manchmal zwei Kriterien, verknüpft mit „und“,
   „oder“ oder „und nicht“.
   Erkennt: Verknüpfung falsch gerechnet, alte Filter (ohne zweite
   Bedingung) ändern sich, „—“ speichert trotzdem eine zweite Bedingung,
   Dialog/Übersicht zeigen die zweite Bedingung nicht.
   ============================================================ */
function filterZweiTest() {
  console.log('\n109. Sammlung: Filter mit zwei Bedingungen (0.60.0)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const s = S.saAusVorlage(S.SA_VORLAGEN.frei, 'Zwei', false, []);
  s.felder = [{ id: 'name', name: 'Name', typ: 'text', spalte: true }, { id: 'sport', name: 'Sport', typ: 'text', spalte: true },
    { id: 'km', name: 'km', typ: 'zahl', spalte: true }];
  const neu = (id, w) => S.DB.datensaetze.push({ id: id, sammlung: s.id, werte: w, angelegt: 1, geaendert: 1 });
  neu('a', { name: 'A', sport: 'Lauf', km: 5 });
  neu('b', { name: 'B', sport: 'Lauf', km: 12 });
  neu('c', { name: 'C', sport: 'Rad', km: 40 });
  neu('d', { name: 'D', sport: 'Rad', km: 8 });
  const mit = (zwei) => { s.filter = [{ id: 'f', name: 'F', feld: 'sport', op: 'gleich', wert: 'Lauf', zwei: zwei }]; S.cl.sa.wahl[s.id] = 'f'; return S.saGefiltert(s).map(d => d.id).sort().join(','); };
  pruefe(mit(undefined) === 'a,b', 'ohne zweite Bedingung wie bisher');
  pruefe(mit({ verkn: 'und', feld: 'km', op: 'groessergleich', wert: '10' }) === 'b', 'Lauf und km ≥ 10');
  pruefe(mit({ verkn: 'oder', feld: 'km', op: 'groessergleich', wert: '10' }) === 'a,b,c', 'Lauf oder km ≥ 10');
  pruefe(mit({ verkn: 'undnicht', feld: 'km', op: 'groessergleich', wert: '10' }) === 'a', 'Lauf und nicht km ≥ 10');
  pruefe(mit({ verkn: '', feld: 'km', op: 'groessergleich', wert: '10' }) === 'a,b', 'Verknüpfung „—“: nur die erste Bedingung');
  pruefe(mit({ verkn: 'und', feld: 'weg', op: 'gleich', wert: 'x' }) === 'a,b', 'gelöschtes Feld in der 2. Bedingung: ignoriert');
  /* Dialog und Speichern */
  S.oeffne('sammlungen'); S.saOeffnen(s.id); S.saFilterOeffnen('f');
  const h = S.saFensterHtml();
  pruefe(/2\. Bedingung/.test(h) && /id="saFiVerkn"/.test(h) && /id="saFiFeld2"/.test(h) && /id="saFiOp2"/.test(h) && /id="saFiWert2"/.test(h), 'Dialog: Verknüpfung, Feld, Bedingung und Wert der 2. Bedingung');
  const setze = (id, v) => { S.document.getElementById(id).value = v; };
  setze('saFiName', 'Lange Läufe'); setze('saFiFeld', 'sport'); setze('saFiOp', 'gleich'); setze('saFiWert', 'Lauf');
  setze('saFiVerkn', 'und'); setze('saFiFeld2', 'km'); setze('saFiOp2', 'groessergleich'); setze('saFiWert2', '10');
  S.saFilterSpeichern();
  const fi = s.filter[0];
  pruefe(fi.zwei && fi.zwei.verkn === 'und' && fi.zwei.feld === 'km' && fi.zwei.op === 'groessergleich' && fi.zwei.wert === '10', 'zweite Bedingung gespeichert');
  pruefe(/Sport ist „Lauf“ und km ist größer\/gleich „10“/.test(S.saFilterText(s, fi)), 'Übersicht: ' + S.saFilterText(s, fi));
  S.saFilterOeffnen('f');
  setze('saFiName', 'Lange Läufe'); setze('saFiFeld', 'sport'); setze('saFiOp', 'gleich'); setze('saFiWert', 'Lauf');
  setze('saFiVerkn', ''); setze('saFiFeld2', 'km'); setze('saFiOp2', 'groessergleich'); setze('saFiWert2', '10');
  S.saFilterSpeichern();
  pruefe(!('zwei' in s.filter[0]), '„—“ gewählt: zweite Bedingung wird entfernt');
  S.saZurListe(); S.oeffne('uebersicht');
}

/* ============================================================
   108. Aus einem Sammlungseintrag eine Aufgabe oder einen Termin (0.59.0)
   Grund: Vieles in Sammlungen ist eine Erinnerung (Abo kündigen,
   Trainingseinheit) — sie soll ohne Abtippen in den Sammler oder Kalender.
   Erkennt: Knopf fehlt / erscheint bei „Neu“, Vorbelegung falsch (Text,
   Frist aus „kündbar bis“, Datum in der Vergangenheit), Getipptes geht
   verloren, Aufgabe landet nicht im Sammler, Termin ohne Titel/Dauer.
   ============================================================ */
function sammlungPlanenTest() {
  console.log('\n108. Aus einem Sammlungseintrag eine Aufgabe oder einen Termin (0.59.0)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  const ab = S.saAusVorlage(S.SA_VORLAGEN.abos, 'Abos', false, []);
  const r = ab.rollen;
  const w = { betrag: '13,99' }; w[ab.felder[0].id] = 'Netflix'; w[r.takt] = 'monatlich'; w[r.laufzeit] = S.tagePlus(heute, 40); w[r.frist] = '0'; w[r.status] = 'aktiv';
  S.DB.datensaetze.push({ id: 'ab1', sammlung: ab.id, werte: w, angelegt: 1, geaendert: 1 });
  S.oeffne('sammlungen'); S.saOeffnen(ab.id);
  S.saFensterAuf({ modus: 'eintrag', id: null });
  pruefe(!/saPlanen\(\)/.test(S.saFensterHtml()), 'bei „Neu“ noch kein „→ Aufgabe oder Termin…“');
  S.saEintrag('ab1');
  pruefe(/saPlanen\(\)">→ Aufgabe oder Termin…/.test(S.saFensterHtml()), 'im gespeicherten Eintrag: „→ Aufgabe oder Termin…“');
  const v = S.saPlanVorschlag(ab, S.saSatzFinden('ab1'));
  pruefe(v.text === 'Netflix kündigen' && v.frist === S.tagePlus(heute, 40) && v.aus === 'Netflix', 'Abo: „Netflix kündigen“, ⚑ Frist = kündbar bis — ' + JSON.stringify(v));
  /* Training: Einheit, Datum, Dauer aus Plan Min */
  const tr = S.saAusVorlage(S.SA_VORLAGEN.training, 'Training', false, []);
  const tw = {}; tw[tr.rollen.datum] = S.tagePlus(heute, 3); tw[tr.rollen.sport] = 'Lauf'; tw[tr.rollen.einheit] = 'Intervalle'; tw[tr.rollen.pmin] = 45;
  S.DB.datensaetze.push({ id: 'tr1', sammlung: tr.id, werte: tw, angelegt: 1, geaendert: 1 });
  const vt = S.saPlanVorschlag(tr, S.saSatzFinden('tr1'));
  pruefe(vt.text === 'Lauf · Intervalle' && vt.datum === S.tagePlus(heute, 3) && vt.terminMin === 45, 'Training: „Lauf · Intervalle“, Datum der Einheit, 45 Min — ' + JSON.stringify(vt));
  S.saFinden(tr.id) && (S.saSatzFinden('tr1').werte[tr.rollen.datum] = S.tagePlus(heute, -2));
  pruefe(S.saPlanVorschlag(tr, S.saSatzFinden('tr1')).datum === '', 'Datum in der Vergangenheit wird nicht vorgeschlagen');
  /* Öffnen: Getipptes wird gesichert, dann das Fenster „Neu“ mit Termin | Aufgabe */
  /* Im Test gibt es kein echtes Formular: Felder wie im Browser füllen */
  const fuellen = (s, d) => s.felder.forEach(f => { const el = S.document.getElementById('saF_' + f.id); el.value = d.werte[f.id] === undefined ? '' : String(d.werte[f.id]); });
  S.saEintrag('ab1');
  fuellen(ab, S.saSatzFinden('ab1'));
  S.document.getElementById('saF_' + ab.felder[0].id).value = 'Netflix Premium';
  S.saPlanen();
  pruefe(S.saSatzFinden('ab1').werte[ab.felder[0].id] === 'Netflix Premium', 'Getipptes im Eintrag wird vorher gesichert');
  pruefe(S.cl.aufklapp === 'aufgabe' && S.cl.auf.fenster && S.cl.auf.fenster.text === 'Netflix Premium kündigen' && S.cl.auf.fenster.ausKalender, 'Fenster „Neu“ mit Termin | Aufgabe, vorbelegt');
  const fh = S.document.getElementById('aufklapp').innerHTML;
  pruefe(/Aus „Netflix Premium“/.test(fh) && /terminStatt\(\)/.test(fh), 'Titel „Aus „…““ und Wahl „Termin“');
  pruefe(fh.includes('id="aufFrist" class="eingabe" type="date" value="' + S.tagePlus(heute, 40) + '"') && /id="aufDatum"[^>]*value=""/.test(fh), 'Abo: Frist vorbelegt, kein Tag');
  S.document.getElementById('aufText').value = S.cl.auf.fenster.text;
  S.document.getElementById('aufDatum').value = '';
  S.document.getElementById('aufFrist').value = S.cl.auf.fenster.frist;
  S.aufSpeichern();
  const korb = S.ckKorb(false);
  pruefe(korb && /\[\] Netflix Premium kündigen/.test(korb.text) && S.ckZusatz(korb, 'Netflix Premium kündigen').frist === S.tagePlus(heute, 40), 'ohne Wahl: in den Sammler, mit ⚑ Frist');
  pruefe(S.cl.app === 'sammlungen' && S.cl.sa.id === ab.id, 'danach bleibt man in der Sammlung');
  /* Termin: Titel und Dauer übernehmen */
  S.aufklappZu();
  S.zugriffToken = 'test'; S.tokenAblauf = Date.now() + 3600000;
  S.fetch = function () { return Promise.resolve({ ok: true, status: 200, json() { return Promise.resolve({ items: [] }); } }); };
  S.saSatzFinden('tr1').werte[tr.rollen.datum] = S.tagePlus(heute, 3);
  S.saOeffnen(tr.id); S.saEintrag('tr1');
  fuellen(tr, S.saSatzFinden('tr1'));
  S.saPlanen();
  pruefe(S.document.getElementById('aufklapp').innerHTML.includes('value="' + S.tagePlus(heute, 3) + '"'), 'Training: Tag der Einheit vorbelegt');
  S.document.getElementById('aufText').value = 'Lauf · Intervalle';
  S.document.getElementById('aufDatum').value = S.tagePlus(heute, 3);
  S.terminStatt();
  const tv = S.cl.termin && S.cl.termin.vorschlag;
  pruefe(tv && tv.titel === 'Lauf · Intervalle' && tv.datum === S.tagePlus(heute, 3), 'Termin: Titel und Datum aus dem Eintrag');
  pruefe(tv && S.clMinuten(tv.bis) - S.clMinuten(tv.von) === 45, 'Termin: „bis“ aus Plan Min (45) — ' + (tv ? tv.von + '–' + tv.bis : ''));
  S.aufklappZu();
  S.zugriffToken = null; S.tokenAblauf = 0;
  S.oeffne('uebersicht');
}

/* ============================================================
   107. Training: Sportart nicht doppelt (0.58.1)
   Grund: Die Spalte „Einheit“ bekam die Sportart vorangestellt
   („Laufen · Lauf locker“) — auch wenn „Sport“ selbst als Spalte steht.
   Doppelt und verschenkter Platz.
   Erkennt: Präfix trotz Sport-Spalte; Präfix fehlt, wenn Sport keine
   Spalte ist.
   ============================================================ */
function trainingSportDoppeltTest() {
  console.log('\n107. Training: Sportart nicht doppelt (0.58.1)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const s = S.saAusVorlage(S.SA_VORLAGEN.training, 'Training', false, []);
  const r = s.rollen || {};
  const w = {}; w[r.sport || 'sport'] = 'Lauf'; w[r.einheit || 'einheit'] = 'Lauf locker';
  const d = { id: 'tr1', sammlung: s.id, werte: w, angelegt: 1, geaendert: 1 };
  S.DB.datensaetze.push(d);
  const ein = S.saFeld(s, r.einheit || 'einheit');
  const sport = S.saFeld(s, r.sport || 'sport');
  sport.spalte = false;
  pruefe(S.saZelle(s, ein, d) === 'Lauf · Lauf locker', 'Sport keine Spalte: Einheit mit Sportart davor — ' + S.saZelle(s, ein, d));
  sport.spalte = true;
  pruefe(S.saZelle(s, ein, d) === 'Lauf locker', 'Sport als Spalte: Einheit ohne Sportart — ' + S.saZelle(s, ein, d));
  pruefe(/<td class="">Lauf<\/td>/.test(S.saTabelleHtml(s)) && !/Lauf · Lauf locker/.test(S.saTabelleHtml(s)), 'Tabelle: Sportart nur einmal');
}

/* ============================================================
   106. Sammlung: Spaltenbreiten Auto und von Hand (0.58.0)
   Grund: Feste Anteile — „Ergebnis“ bekam viel Platz für ein ✓, die
   Einheit wurde nach wenigen Zeichen abgeschnitten.
   Erkennt: kurze Spalten nicht schmal, Breiten ergeben nicht 100 %,
   Kopf und Einträge verschieden breit (nicht mehr bündig), Ausreißer
   verdrängt alles, Breite von Hand ohne Vorrang / nicht gespeichert,
   alte feste Breiten im CSS stehen noch.
   ============================================================ */
function spaltenBreitenTest() {
  console.log('\n106. Sammlung: Spaltenbreiten Auto und von Hand (0.58.0)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const s = S.saAusVorlage(S.SA_VORLAGEN.frei, 'Breiten', false, []);
  s.felder = [{ id: 'tag', name: 'Datum', typ: 'datum', spalte: true }, { id: 'einheit', name: 'Einheit', typ: 'text', spalte: true },
    { id: 'ok', name: 'OK', typ: 'janein', spalte: true }];
  const neu = (id, w) => S.DB.datensaetze.push({ id: id, sammlung: s.id, werte: w, angelegt: 1, geaendert: 1 });
  neu('b1', { tag: '2026-10-24', einheit: 'Laufen · Lauf locker 45 min Zone 2', ok: true });
  neu('b2', { tag: '2026-10-25', einheit: 'Cardio · Grundlage', ok: false });
  const sp = S.saSpalten(s);
  const b = S.saSpaltenBreiten(s, sp, S.saGefiltert(s));
  const summe = Math.round(b.reduce((a, x) => a + x, 0) * 10) / 10;
  pruefe(b.length === 3 && summe === 100, 'drei Breiten, zusammen 100 % — ' + b.join(' / '));
  pruefe(b[1] > 55 && b[0] < 25 && b[2] < 25, 'Auto: Textspalte breit, Datum und Ja/Nein schmal — ' + b.join(' / '));
  neu('b3', { tag: '2026-10-26', einheit: 'x'.repeat(300), ok: true });
  const b2 = S.saSpaltenBreiten(s, sp, S.saGefiltert(s));
  pruefe(b2[0] >= 10 && b2[2] >= 10, 'ein Ausreißer (300 Zeichen) verdrängt die anderen nicht — ' + b2.join(' / '));
  const h = S.saTabelleHtml(s);
  const cg = h.match(/<colgroup>.*?<\/colgroup>/g) || [];
  pruefe(cg.length === 2 && cg[0] === cg[1], 'Kopf und Einträge mit gleichen Breiten (bleiben bündig)');
  s.felder[1].breite = 'schmal'; s.felder[2].breite = 'breit';
  const b3 = S.saSpaltenBreiten(s, sp, S.saGefiltert(s));
  pruefe(b3[2] > b3[1], 'von Hand: „breit“ und „schmal“ haben Vorrang vor Auto — ' + b3.join(' / '));
  pruefe(S.SA_BREITEN[0][0] === '' && S.SA_BREITEN[0][1] === 'Auto', 'Voreinstellung: Auto');
  S.oeffne('sammlungen'); S.saOeffnen(s.id); S.saFeldOeffnen('einheit');
  pruefe(/id="saFeldBreite"/.test(S.saFensterHtml()), 'Feld-Details: Auswahl „Spaltenbreite“');
  S.document.getElementById('saFeldName').value = 'Einheit';
  S.document.getElementById('saFeldTyp').value = 'text';
  S.document.getElementById('saFeldSpalte').checked = true;
  S.document.getElementById('saFeldBreite').value = 'mittel';
  S.saFeldSpeichern();
  pruefe(S.saFeld(s, 'einheit').breite === 'mittel', 'Breite wird im Feld gespeichert');
  S.saFeldOeffnen('einheit');
  S.document.getElementById('saFeldName').value = 'Einheit';
  S.document.getElementById('saFeldTyp').value = 'text';
  S.document.getElementById('saFeldSpalte').checked = true;
  S.document.getElementById('saFeldBreite').value = '';
  S.saFeldSpeichern();
  pruefe(!('breite' in S.saFeld(s, 'einheit')), 'zurück auf Auto: kein Feld „breite“ mehr');
  pruefe(!/td:first-child\{width:\d+%\}/.test(QUELLE), 'keine festen Breiten mehr im CSS');
  S.saZurListe(); S.oeffne('uebersicht');
}

/* ============================================================
   105. Sammlung: Suchen und Filter ≤ / ≥ (0.57.0)
   Grund: In Sammlungen fehlte eine Suche und Filter mit „kleiner/gleich“
   und „größer/gleich“.
   Erkennt: Suche findet nicht in allen Feldern / ignoriert den Filter /
   bleibt beim Wechsel der Sammlung stehen; ≤/≥ vergleicht Zahlen als Text
   („9“ > „10“), liest „12,50“ oder „1.10.2026“ nicht, lässt leere Werte
   durch, Bedingungen fehlen im Filter-Dialog.
   ============================================================ */
function sammlungSucheTest() {
  console.log('\n105. Sammlung: Suchen und Filter ≤ / ≥ (0.57.0)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const s = S.saAusVorlage(S.SA_VORLAGEN.frei, 'Suchtest', false, []);
  s.felder = [{ id: 'name', name: 'Name', typ: 'text', spalte: true }, { id: 'notiz', name: 'Notiz', typ: 'text' },
    { id: 'preis', name: 'Preis', typ: 'betrag', spalte: true }, { id: 'tag', name: 'Datum', typ: 'datum', spalte: true }];
  const neu = (id, w) => S.DB.datensaetze.push({ id: id, sammlung: s.id, werte: w, angelegt: 1, geaendert: 1 });
  neu('d1', { name: 'Netflix', notiz: 'Streaming', preis: 9, tag: '2026-09-15' });
  neu('d2', { name: 'Spotify', notiz: 'Musik', preis: 10.5, tag: '2026-10-01' });
  neu('d3', { name: 'Zeitung', notiz: 'netz-Abo', preis: 25, tag: '2026-11-20' });
  neu('d4', { name: 'Leer', notiz: '', preis: '', tag: '' });
  const ids = () => S.saGefiltert(s).map(d => d.id).sort().join(',');
  S.oeffne('sammlungen'); S.saOeffnen(s.id);
  pruefe(/id="saSuche"/.test(S.saTabelleHtml(s)), 'Suchfeld über der Tabelle');
  S.saSucheSetzen('NET');
  pruefe(ids() === 'd1,d3', 'Suche über alle Felder, ohne Groß/Klein (Name „Netflix“, Notiz „netz-Abo“) — ' + ids());
  pruefe(/Suche leeren/.test(S.saTabelleHtml(s)), '✕ zum Leeren erscheint');
  S.saSucheSetzen('xyz');
  pruefe(/Keine Einträge zu „xyz“/.test(S.saTabelleHtml(s)), 'ohne Treffer: „Keine Einträge zu …“');
  S.saSucheSetzen('10,5');
  pruefe(ids() === 'd2', 'Suche findet auch den angezeigten Wert (Betrag „10,5“)');
  S.saSucheLeeren();
  pruefe(ids() === 'd1,d2,d3,d4', 'leere Suche: alles');
  /* ≤ / ≥ */
  const op = (feld, o, wert) => s.felder.some(f => f.id === feld) && S.saSaetze(s).filter(d => S.saPasst(s, d, { feld: feld, op: o, wert: wert })).map(d => d.id).sort().join(',');
  pruefe(op('preis', 'kleinergleich', '10') === 'd1', 'Betrag ≤ 10: als Zahl (9 ja, 10,5 nein, leer nein) — ' + op('preis', 'kleinergleich', '10'));
  pruefe(op('preis', 'groessergleich', '10,50') === 'd2,d3', 'Betrag ≥ 10,50: Dezimalkomma gelesen');
  pruefe(op('preis', 'groessergleich', 'abc') === '', 'unlesbarer Vergleichswert: nichts passt');
  pruefe(op('tag', 'groessergleich', '1.10.2026') === 'd2,d3', 'Datum ≥ 1.10.2026 (deutsch eingegeben)');
  pruefe(op('tag', 'kleinergleich', '2026-10-01') === 'd1,d2', 'Datum ≤ 2026-10-01 (inklusive)');
  pruefe(op('name', 'kleinergleich', 'spotify') === 'd1,d4,d2'.split(',').sort().join(','), 'Text ≤: alphabetisch, ohne Groß/Klein');
  pruefe(S.SA_BEDINGUNGEN.some(b => b[0] === 'kleinergleich') && S.SA_BEDINGUNGEN.some(b => b[0] === 'groessergleich'), 'Bedingungen im Filter-Dialog');
  /* Suche wirkt zusätzlich zum gespeicherten Filter */
  s.filter = [{ id: 'teuer', name: 'Teuer', feld: 'preis', op: 'groessergleich', wert: '10' }];
  S.saFilterSetzen('teuer');
  S.saSucheSetzen('a');
  pruefe(ids() === 'd3', 'Filter „≥ 10“ und Suche „a“ zusammen — ' + ids());
  S.saZurListe();
  pruefe(S.cl.sa.suche === '', 'Suche wird beim Verlassen geleert');
  S.saOeffnen(s.id); S.saSucheSetzen('x'); S.saOeffnen(s.id);
  pruefe(S.cl.sa.suche === '', 'Suche beginnt beim Öffnen leer');
  pruefe(!/suche/.test(JSON.stringify(s)), 'Suchbegriff wird nicht in der Sammlung gespeichert');
  S.saFilterSetzen('');
  S.oeffne('uebersicht');
}

/* ============================================================
   104. Morgengruß statt Routine (0.56.1)
   Grund: Die Borkum-Morgenroutine als Checkliste machte morgens Druck.
   Stattdessen nur ein ruhiger Satz bis 10 Uhr — ohne Abhaken, ohne
   Zählen, ohne Erinnerung aufs Handy.
   Erkennt: Gruß fehlt morgens oder bleibt nach 10 Uhr/„Danke“, wird in
   der workbench.json gezählt, verdrängt nicht die Coach-Frage, lässt sich
   nicht ausschalten.
   ============================================================ */
function morgengrussTest() {
  console.log('\n104. Morgengruß statt Routine (0.56.1)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  S.localStorage.removeItem('clie-morgengruss');
  const g = S.coMorgengruss('07:10', heute);
  pruefe(g && S.CO_MORGENGRUSS.indexOf(g) >= 0, 'morgens ein Satz aus der Liste');
  pruefe(S.coMorgengruss('10:00', heute) === '' && S.coMorgengruss('03:30', heute) === '', 'nur von 4 bis 10 Uhr');
  pruefe(S.coMorgengruss('07:10', heute) !== S.coMorgengruss('07:10', S.tagePlus(heute, 1)) || S.CO_MORGENGRUSS.length === 1, 'wechselt täglich');
  const vorher = JSON.stringify(S.DB);
  S.coMorgengrussWeg();
  pruefe(S.coMorgengruss('07:10', heute) === '' && JSON.stringify(S.DB) === vorher, '„Danke“: für heute weg — nur auf dem Gerät, nichts in der workbench.json');
  S.localStorage.removeItem('clie-morgengruss');
  pruefe(/Danke/.test(S.coMorgengrussHtml()) || S.clUhrzeit() >= '10:00' || S.clUhrzeit() < '04:00', 'Coach-Zeile zeigt morgens den Gruß mit „Danke“');
  pruefe(!/coAntwort|Kalender/.test(S.coMorgengrussHtml()) && !/co-ant/.test(S.coMorgengrussHtml()), 'keine Frage, kein Abhaken');
  S.krSpeichern({ id: 'kc-einstellungen', typ: 'coach', morgengruss: [] });
  pruefe(S.coMorgengruss('07:10', heute) === '', 'leere Liste: ausgeschaltet');
  S.krFinden('kc-einstellungen').morgengruss = ['Nur atmen.'];
  pruefe(S.coMorgengruss('07:10', heute) === 'Nur atmen.', 'eigene Sätze');
  S.oeffne('uebersicht');
}

/* ============================================================
   103. Kampagne, Regel-Check, Pre-Commitment, 7-Tage-Schnitt (0.56)
   Grund: Alexanders 12-Wochen-Kampagne — Phasen mit Meilensteinen am
   7-Tage-Schnitt, Do's und Don'ts (mit Ausnahme-Kontingent) und der
   Abend-Check. Dazu: vor Terminen mit Essen vorher festlegen, und nach dem
   Eintragen des Gewichts den 7-Tage-Schnitt nennen.
   Erkennt: Phasen/Regeln falsch gelesen, Regeln aus der Notiz fehlen,
   Meilenstein am Tageswert statt am Schnitt, Kontingent überschritten,
   Serie/Quote falsch, Pre-Commitment fehlt oder wird nicht erinnert.
   ============================================================ */
function kampagneTest() {
  console.log('\n103. Kampagne, Regel-Check, Pre-Commitment, 7-Tage-Schnitt (0.56)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  const vor = n => S.tagePlus(heute, -n);
  S.localStorage.removeItem('clie-coach-gesehen');
  S.cl.co.tag = ''; S.cl.co.ansicht = 'verlauf'; S.termineNachTag = {};
  S.krSpeichern({ id: 'kc-einstellungen', typ: 'coach', max: 12, morgen: '07:30', nachmittag: '16:30', abend: '20:30' });
  const ph = S.kkPhaseLesen('28.09.2026 – 25.10.2026 | 102,9 erste Bastion | Fundament legen', 1);
  pruefe(ph && ph.von === '2026-09-28' && ph.bis === '2026-10-25' && ph.ziel === 102.9 && ph.zielName === 'erste Bastion' && ph.fokus === 'Fundament legen', 'Phase lesen: von – bis | Ziel Name | Fokus');
  const r = S.kkRegelLesen('✗ Alkohol 0,0 (max 1/Woche)');
  pruefe(r && r.art === 'dont' && r.kontingent === 1 && r.text === 'Alkohol 0,0' && S.kkRegelText(r) === '✗ Alkohol 0,0 (max 1/Woche)', 'Regel lesen: Don\'t mit Ausnahme-Kontingent — und zurück als Text');
  const notiz = 'I. Die 6 unumstößlichen Don\'ts (Messbare Verbote)\n1. Alkohol-Regel:\n▪ 0,0\n2. Keine flüssigen Kalorien:\nII. Die 6 unumstößlichen Do\'s (Tägliche Standards)\n1. Proteinanker bei jeder Hauptmahlzeit setzen\n2. Hydrations-Pflicht: 2,5 bis 3 Liter täglich';
  const ausN = S.kkRegelnAusNotiz(notiz);
  pruefe(ausN.length === 4 && ausN[0].art === 'dont' && ausN[0].text === 'Alkohol-Regel' && ausN[2].art === 'do' && ausN[3].text === 'Hydrations-Pflicht: 2,5 bis 3 Liter täglich', 'Regeln aus der Notiz: Don\'ts und Do\'s nach Abschnitt');
  /* Sammlung Gewicht: 7 Tage um 102,0, Vorwoche um 102,5 */
  S.DB.sammlungen.push({ id: 'sg', name: 'Gewicht', art: 'frei', kontext: 'privat', felder: [{ id: 'fd', name: 'Datum', typ: 'datum' }, { id: 'fk', name: 'kg', typ: 'zahl' }], rollen: {}, geaendert: 1 });
  [0, 1, 2, 3, 4, 5, 6].forEach(n => S.DB.datensaetze.push({ id: 'a' + n, sammlung: 'sg', werte: { fd: vor(n), fk: 102 }, geaendert: 1 }));
  [7, 8, 9].forEach(n => S.DB.datensaetze.push({ id: 'b' + n, sammlung: 'sg', werte: { fd: vor(n), fk: 102.5 }, geaendert: 1 }));
  pruefe(Math.abs(S.coSchnitt(S.saFinden('sg'), 'fk', heute, 7) - 102) < 0.001, '7-Tage-Schnitt');
  /* Kampagne über das Fenster anlegen */
  S.oeffne('kurs'); S.krAnsicht('kampagne');
  S.krFensterAuf('kampagne');
  const set = (id, v) => { S.document.getElementById(id).value = v; };
  set('kkName', 'Abnehmen'); set('kkStart', vor(30)); set('kkEnde', S.tagePlus(heute, 53)); set('kkSammlung', 'sg'); set('kkFeld', 'fk'); set('kkRichtung', 'runter');
  set('kkPhasen', S.clKurzDatum(vor(30)) + vor(30).slice(0, 4) + ' – ' + S.clKurzDatum(vor(1)) + vor(1).slice(0, 4) + ' | 102,9 erste Bastion | Fundament\n'
    + S.clKurzDatum(heute) + heute.slice(0, 4) + ' – ' + S.clKurzDatum(S.tagePlus(heute, 53)) + S.tagePlus(heute, 53).slice(0, 4) + ' | 101,5 Halbzeit-Bastion | Ausdauer');
  set('kkRegeln', '✗ Alkohol 0,0 (max 1/Woche)\nProteinanker');
  S.krKampagneSpeichern();
  const k = S.kkAktiv(false);
  pruefe(k && k.name === 'Abnehmen' && k.phasen.length === 2 && k.regeln.length === 2 && k.regeln[0].kontingent === 1 && k.regeln[0].id, 'Kampagne gespeichert: Phasen und Regeln mit Kennung');
  const kopf = S.kkKopfText(k, heute);
  pruefe(/Woche 5 von 12/.test(kopf) && /Phase 2 \(Ausdauer\)/.test(kopf) && /7-Tage-Schnitt kg 102 — noch 0,5 bis „Halbzeit-Bastion“ \(101,5\)/.test(kopf), 'Kopf: Woche, Phase mit Fokus, Schnitt und nächster Meilenstein (erste Bastion schon erreicht)');
  /* Coach: morgens Kampagne, abends Regel-Check */
  pruefe(S.coFaellige('07:40', heute).some(f => f.id === 'kk:' + heute), 'morgens: Kampagne im Coach');
  pruefe(S.coFaellige('21:00', heute).some(f => f.id === 'rc:' + heute), 'abends: Regel-Check');
  S.krRegelCheckAuf();
  pruefe(S.cl.kr.ansicht === 'regelcheck' && /Ausnahme \(1\)/.test(inhalt()), 'Regel-Check: ✓ / ✗ / Ausnahme (1 frei)');
  S.krRegelSetzen(k.regeln[0].id, 'aus'); S.krRegelSetzen(k.regeln[1].id, 'ok');
  S.krRegelCheckSpeichern();
  pruefe(k.tage[heute][k.regeln[0].id] === 'aus' && S.kkAusnahmen(k, k.regeln[0].id, heute) === 1, 'gespeichert, Ausnahme gezählt');
  pruefe(!S.coFaellige('21:05', heute).some(f => f.id === 'rc:' + heute), 'nach dem Check fragt der Coach nicht mehr');
  k.tage[vor(1)] = {}; k.tage[vor(1)][k.regeln[0].id] = 'ok';
  if (S.montagVon(vor(1)) === S.montagVon(heute)) {
    k.tage[vor(1)][k.regeln[0].id] = 'aus';
    S.cl.kr.rc = {}; S.cl.kr.rc[k.regeln[0].id] = 'aus';
    S.cl.kr.ansicht = 'regelcheck';
    S.krRegelCheckSpeichern();
    pruefe(/keine Ausnahme mehr frei/.test(S.document.getElementById('toastText').textContent), 'zweite Ausnahme in derselben Woche wird abgelehnt');
    k.tage[vor(1)][k.regeln[0].id] = 'ok';
  }
  pruefe(S.kkSerie(k, k.regeln[1].id) === 1 && S.kkSerie(k, k.regeln[0].id) === 2, 'Serie: gehaltene Tage am Stück (Ausnahme zählt als gehalten)');
  /* Pre-Commitment */
  const morgen = S.tagePlus(heute, 1);
  S.termineNachTag[morgen] = [{ id: 't9', zeit: '19:00', bis: '22:00', titel: 'Abendessen Restaurant Krone', kontext: 'privat' }];
  const pc = S.coFaellige('17:00', heute).filter(f => f.id === 'pc:t9')[0];
  pruefe(pc && /Was isst und trinkst du dort\?/.test(pc.text) && pc.eingabeText, 'am Vortag: Termin mit Essen → jetzt festlegen');
  S.coAntwort('pc:t9', 'festlegen', 0, '17:00', 'Salat, Wasser');
  pruefe(S.krFinden('kpc-t9') && S.krFinden('kpc-t9').text === 'Salat, Wasser', 'Festgelegtes gespeichert');
  S.termineNachTag[heute] = [{ id: 't9', zeit: '19:00', bis: '22:00', titel: 'Abendessen Restaurant Krone', kontext: 'privat' }];
  const tv = S.coFaellige('18:30', heute).filter(f => f.id === 'tv:t9')[0];
  pruefe(tv && /Festgelegt: „Salat, Wasser“/.test(tv.text), 'vor dem Termin erinnert der Coach daran');
  /* Gewicht eintragen: 7-Tage-Schnitt in der Antwort */
  S.cl.co.tag = '';
  S.krFinden('kc-einstellungen').sammlungen = { sg: { takt: 'taeglich', ab: '07:00' } };
  S.DB.datensaetze = S.DB.datensaetze.filter(d => d.id !== 'a0');
  const se = S.coFaellige('08:00', heute).filter(f => f.id === 'se:sg')[0];
  pruefe(!!se, 'Coach fragt nach dem Gewicht');
  S.coAntwort('se:sg', 'eintragen', 0, '08:00', '101,3');
  pruefe(/7-Tage-Schnitt 101,9 \(−0,6 zur Vorwoche\)/.test(S.document.getElementById('toastText').textContent), 'Antwort mit 7-Tage-Schnitt und Vergleich zur Vorwoche — ' + S.document.getElementById('toastText').textContent);
  S.oeffne('uebersicht');
}

/* ============================================================
   102. Substanz, Verbindlichkeit, Routine im Coach (0.55)
   Grund: Alexanders „Einordnung substanzieller Aufgaben“ — Substanz
   (bleibendes Ergebnis, Hebel) = P1/P2, Verbindlichkeit = ⚑, Routine =
   Routinen, Rest = Organisation. Der Coach fragt beim Einsortieren mit den
   Prüffragen, macht den Nachher-Test, legt morgens einen Stein vor und
   fragt bei ★-Checklisten, ob sie sich bewegen oder nur verwaltet werden.
   Erkennt: Prüffragen ergeben falsche Stufe, Nachher-Test fehlt oder fragt
   bei P3, Umformulieren ändert den Text nicht (oder verliert P), Bilanz
   ohne Routinen, ★-Check fehlt.
   ============================================================ */
function coSubstanzTest() {
  console.log('\n102. Substanz, Verbindlichkeit, Routine im Coach (0.55)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  S.localStorage.removeItem('clie-coach-gesehen');
  S.cl.co.tag = ''; S.cl.co.ansicht = 'verlauf'; S.termineNachTag = {};
  S.krSpeichern({ id: 'kc-einstellungen', typ: 'coach', max: 12, morgen: '07:30', abend: '20:30' });
  pruefe(S.coSubstanzStufe(true, true) === 1 && S.coSubstanzStufe(true, false) === 2 && S.coSubstanzStufe(false, true) === 2 && S.coSubstanzStufe(false, false) === 3, 'Prüffragen: zweimal Ja → P1, einmal → P2, keinmal → P3');
  pruefe(S.coOrgaKlang('P1 Carport Angebote anschauen') && S.coOrgaKlang('Testdaten-Thema mit Team besprechen') && !S.coOrgaKlang('Carport: Angebotsvergleich abgeschlossen & Favorit gewählt') && !S.coOrgaKlang('Fachbuchkapitel durcharbeiten'),
    'Nachher-Test erkennt Organisatorisches an typischen Verben');
  /* Sammler aufräumen mit Prüffragen */
  S.DB.themen = [{ id: 'cl-korb', name: 'Sammler', kontext: '', korb: true, ordnung: 0, geaendert: 1, text: '[] Fundamentplan zeichnen' },
    { id: 'tc', name: 'Carport', kontext: 'privat', stern: true, ordnung: 1, geaendert: 1, text: '[] P1 Carport Angebote anschauen\n[] Ordner anlegen' }];
  S.coKorbAufraeumen();
  pruefe(/coKorbPruef\('ergebnis',true\)/.test(inhalt()) && /coKorbPruef\('hebel',false\)/.test(inhalt()) && /1–2 Substanz/.test(inhalt()), 'Aufräumen: zwei Prüffragen, Hinweis „1–2 Substanz“');
  S.coKorbPruef('ergebnis', true);
  pruefe(/\[\] Fundamentplan zeichnen/.test(S.DB.themen[0].text), 'nach der ersten Antwort noch nichts geändert');
  S.coKorbPruef('hebel', true);
  pruefe(/\[\] P1 Fundamentplan zeichnen/.test(S.DB.themen[0].text) && /Substanz — P1/.test(S.document.getElementById('toastText').textContent), 'beide Ja: P1 (Substanz)');
  S.coKorbFertig();
  /* Nachher-Test */
  const l = S.coFaellige('09:00', heute);
  const nt = l.filter(f => /^nt:/.test(f.id));
  pruefe(nt.length === 2 && nt[0].id === 'nt:P1 Carport Angebote anschauen' && nt[0].eingabe && nt[0].eingabeText && nt.some(f => f.id === 'nt:Ordner anlegen'),
    'Nachher-Test: P1 und Punkte aus ★-Checklisten, die nach Organisation klingen — mit Textfeld');
  S.coAntwort('nt:P1 Carport Angebote anschauen', 'umformulieren', 0, '09:00', 'Carport: Angebotsvergleich abgeschlossen & Favorit gewählt');
  pruefe(/\[\] P1 Carport: Angebotsvergleich abgeschlossen & Favorit gewählt/.test(S.DB.themen[1].text) && !/anschauen/.test(S.DB.themen[1].text), 'Umformulieren: neuer Text, P1 bleibt');
  S.coAntwort('nt:Ordner anlegen', 'orga', 1, '09:00');
  pruefe(/\[\] Ordner anlegen/.test(S.DB.themen[1].text), '„Ist Organisation“: P3');
  /* Morgen: der Stein */
  S.DB.themen[1].text += '\n[] P2 Fundamentplan freigeben';
  const mo = S.coFaellige('07:40', heute).filter(f => f.id === 'morgen')[0];
  pruefe(mo && /Dein Stein fürs Mauerwerk heute: „/.test(mo.text), 'Morgen: zuerst ein Stein fürs Mauerwerk');
  /* Bilanz mit Routinen, ★-Check */
  S.DB.aufgaben.push({ id: 'r1', titel: 'Tabletten', wiederholung: { art: 'taeglich' }, erledigtTage: [heute], geaendert: 1 });
  S.kpTagAnlegen(heute);
  const tg = S.kpTagFinden(heute);
  tg.text = '[x] Termin ausmachen\n[x] Ordner anlegen';
  tg.eintraege = [{ id: 'e1', abschnitt: 'h', text: 'Termin ausmachen', quelle: 'tc', erledigt: true }, { id: 'e2', abschnitt: 'h', text: 'Ordner anlegen', quelle: 'tc', erledigt: true }];
  const b = S.coWochenBilanz(heute);
  pruefe(b.routine === 1 && b.orga === 2 && b.substanz === 0, 'Bilanz: Routinen aus der App Routinen, Organisation gezählt');
  const sb = S.coFaellige('21:00', heute).filter(f => /^sb:tc:/.test(f.id))[0];
  pruefe(sb && /2× Organisation, kein Baustein/.test(sb.text) && sb.antworten[0][0] === 'baustein', '★-Check: nur Organisation erledigt → „Bewegt es sich, oder wird es nur verwaltet?“');
  S.oeffne('uebersicht');
}

/* ============================================================
   101. Vorlesen: Initialen, Abkürzungen, Suche in PDFs (0.54)
   Grund: PDFs mit abgesetzten Initialen lasen „W enn“ statt „Wenn“, und
   „z. B.“ wurde buchstabiert. Außerdem soll die Suche auf Wunsch auch den
   Text der PDFs durchsuchen.
   Erkennt: Initialen nicht zusammengefügt (oder echte Wörter wie „A“
   verschluckt), Abkürzungen nicht ausgesprochen oder im angezeigten Text
   verändert, PDF-Treffer fehlen, Schalter wird nicht gemerkt.
   ============================================================ */
function vlAusspracheTest() {
  console.log('\n101. Vorlesen: Initialen, Abkürzungen, Suche in PDFs (0.54)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  pruefe(S.vlInitialen('W enn es regnet. D ann gehen wir. „Ü ber alles“') === 'Wenn es regnet. Dann gehen wir. „Über alles“', '„W enn“ → „Wenn“ am Absatz- und Satzanfang, auch „Ü ber“');
  pruefe(S.vlInitialen('A bis Z und O je') === 'A bis Z und O je' && S.vlInitialen('Herr K sagte') === 'Herr K sagte', '„A“, „O“ und Buchstaben mitten im Satz bleiben');
  pruefe(S.vlAussprache('Obst, z. B. Äpfel, d.h. gesund, usw.') === 'Obst, zum Beispiel Äpfel, das heißt gesund, und so weiter', 'z. B., d.h., usw. werden ausgesprochen');
  pruefe(S.vlAussprache('Z. B. hier, siehe S. 12 und Abb. 3, ca. 5 Mio. Euro, o. Ä.') === 'Zum Beispiel hier, siehe Seite 12 und Abbildung 3, circa 5 Millionen Euro, oder Ähnliches', 'Satzanfang groß, Seite nur vor Zahl, Abb., ca., Mio., o. Ä.');
  pruefe(S.vlAussprache('Das S.-Bahn-Netz') === 'Das S.-Bahn-Netz' && S.vlAussprache('Kaffee usw') === 'Kaffee usw', 'ohne passenden Punkt/Zahl bleibt alles');
  pruefe(/zum Beispiel/.test(S.vlSprechText('Etwa z.B. so.')) && /^Wenn/.test(S.vlSprechText('W enn das so ist.')), 'beim Sprechen greift beides — auch für schon eingelesene Dokumente');
  const auf = S.vlAufbereiten([{ zeilen: [{ t: 'W enn man z. B. liest, klappt es.', y: 700, h: 10 }] }]);
  pruefe(auf.saetze[0] === 'Wenn man z. B. liest, klappt es.', 'beim Einlesen: Initiale zusammen, Abkürzung bleibt im Text');
  /* Suche in PDFs */
  S.localStorage.removeItem('clie-suche-pdf');
  S.suLaden();
  S.oeffne('suchen');
  pruefe(/suPdfUm\(\)">☐ auch in PDFs/.test(S.suchenFussHtml()), 'unten: „auch in PDFs“');
  S.cl.su.text = 'Photovoltaik';
  pruefe(!S.suTreffer('Photovoltaik').some(x => x.gruppe === 'vorlesen'), 'aus: keine PDF-Treffer');
  S.suPdfUm();
  pruefe(S.cl.su.pdf && S.localStorage.getItem('clie-suche-pdf') === 'an', 'an — auf dem Gerät gemerkt');
  S.cl.su.vl = { d1: { titel: 'Energiebuch', saetze: ['Einleitung.', 'Die Photovoltaik wandelt Licht um.', 'Mehr zur Photovoltaik.'], seite: [1, 12, 13] } };
  const tr = S.suTreffer('Photovoltaik').filter(x => x.gruppe === 'vorlesen');
  pruefe(tr.length === 2 && /<mark>Photovoltaik<\/mark>/.test(tr[0].titel) && /Energiebuch · S\. 12/.test(tr[0].unter) && /suVorlesen\('d1',1\)/.test(tr[0].aufruf), 'Treffer im PDF: Satz markiert, Dokument und Seite, Sprung an den Satz');
  pruefe(/Vorlesen \(PDFs\)/.test(S.suErgebnisHtml()), 'eigene Gruppe „Vorlesen (PDFs)“');
  S.suPdfUm();
  S.cl.su.text = '';
  S.oeffne('uebersicht');
}

/* ============================================================
   100. Checkliste aus einer Notiz (0.53.3, nur Notizen und „- [ ]“ 0.53.4)
   Grund: „Aus einem Memo“ hieß noch nach dem alten App-Namen und fand nur
   Notizen mit Kästchen — Notizen mit Aufzählungen („- Punkt“) fehlten.
   Erkennt: alter Name, Aufzählungen nicht übernommen, Fließtext landet in
   der Checkliste, „Einmalig“ fehlt, die Notiz wird verändert.
   ============================================================ */
function clsAusNotizTest() {
  console.log('\n100. Checkliste aus einer Notiz (0.53.3)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.katSetzen('alle');
  const text = '# Packen\nText dazu\n- Koffer\n* Ladekabel\n• Pass\n1. Tickets\n  - Bahn\n[x] Brille\nEnde';
  S.DB.gedanken.push({ id: 'na', titel: 'Urlaub', text: text, kontext: 'privat', ordnung: 1, geaendert: 1 });
  S.DB.gedanken.push({ id: 'nb', titel: 'Nur Text', text: 'Gedanken ohne Liste', kontext: 'privat', ordnung: 2, geaendert: 1 });
  S.DB.projekte.push({ id: 'pz', name: 'Projekt', flaeche: '[] Aufgabe', status: 'laufend', kontext: 'privat', ordnung: 3, geaendert: 1 });
  pruefe(S.clsAusNotiz(text) === '# Packen\n[] Koffer\n[] Ladekabel\n[] Pass\n[] Tickets\n  [] Bahn\n[] Brille', 'Aufzählungen (-, *, •, 1.) und Kästchen werden leere Punkte, Überschriften bleiben, Text fällt weg');
  S.oeffne('checklisten'); S.clsNeu();
  pruefe(/Aus einer Notiz übernehmen/.test(S.clsFensterHtml()) && !/Memo/.test(S.clsFensterHtml()), 'heißt „Aus einer Notiz übernehmen …“');
  S.clsFensterSchritt('memo');
  const h = S.clsFensterHtml();
  pruefe(/clsAnlegen\('memo','na'\)/.test(h) && !/'nb'/.test(h) && /clsAlsWahl\('lauf'\)/.test(h), 'Notiz mit Aufzählung steht zur Wahl, reiner Text nicht; „Vorlage | Einmalig“');
  pruefe(S.clsAusNotiz('- [ ] Brot\n* [x] Milch\n1. [ ] Eier') === '[] Brot\n[] Milch\n[] Eier', 'Markdown-Aufgaben „- [ ] …“ werden Punkte (0.53.4)');
  pruefe(!/clsAnlegen\('memo','pz'\)/.test(h), 'nur Notizen — keine Projekte (0.53.4)');
  S.clsAlsWahl('lauf');
  S.clsAnlegen('memo', 'na');
  const g = S.DB.gedanken[S.DB.gedanken.length - 1];
  pruefe(g.checkliste === 'lauf' && g.art === 'aufgaben' && g.titel === 'Urlaub' && /\[\] Tickets/.test(g.text), 'Einmalig: laufende Checkliste (Art Aufgaben) mit allen Punkten');
  pruefe(S.DB.gedanken.filter(x => x.id === 'na')[0].text === text, 'die Notiz bleibt unverändert');
  S.clsZurListe();
  S.oeffne('uebersicht');
}

/* ============================================================
   99. Notiz löschen (0.53.1)
   Grund: Notizen ließen sich in CLIE nicht löschen — im Details-Fenster
   fehlte „Löschen…“.
   Erkennt: kein Knopf, Löschen ohne Rückfrage, kein Löschvermerk (käme per
   Abgleich zurück), Eingeplantes bleibt im Tag, Checklisten/Projekte
   über diesen Weg löschbar.
   ============================================================ */
function memoLoeschenTest() {
  console.log('\n99. Notiz löschen (0.53.1)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  S.DB.gedanken.push({ id: 'n1', titel: 'Alte Notiz', text: 'Text\n[] Anrufen', kontext: 'privat', ordnung: 1, geaendert: 1 });
  S.aufPlanAnwenden(S.kpSeiteFinden('n1'), 1, heute, '');
  S.oeffne('memo'); S.memoOeffnen('n1'); S.memoDetails();
  pruefe(/memoLoeschenFragen\(\)">Löschen…/.test(S.memoFensterHtml()), 'Details einer Notiz: „Löschen…“');
  S.memoLoeschenFragen();
  pruefe(/Notiz löschen/.test(S.memoFensterHtml()) && /1 offene Aufgabe/.test(S.memoFensterHtml()) && S.DB.gedanken.some(g => g.id === 'n1'), 'erst die Rückfrage, mit Hinweis auf Offenes');
  S.memoLoeschen();
  pruefe(!S.DB.gedanken.some(g => g.id === 'n1') && S.DB.grabsteine.some(x => x.s === 'gedanken' && x.id === 'n1') && !S.cl.memo.id, 'gelöscht, mit Löschvermerk, zurück zur Liste');
  pruefe(!/Anrufen/.test((S.kpTagFinden(heute) || {}).text || ''), 'Eingeplantes ist aus dem Tag genommen');
  S.DB.gedanken.push({ id: 'c1', titel: 'Liste', text: '[] a', kontext: 'privat', checkliste: 'lauf', ordnung: 2, geaendert: 1 });
  S.cl.memo.id = 'c1'; S.memoDetails();
  pruefe(!/memoLoeschenFragen/.test(S.memoFensterHtml()), 'Checklisten löschen sich nicht über die Notiz-Details');
  S.memoLoeschen();
  pruefe(S.DB.gedanken.some(g => g.id === 'c1'), 'auch per Aufruf nicht');
  S.aufklappZu(); S.cl.memo.id = '';
  S.oeffne('uebersicht');
}

/* ============================================================
   98. Coach und Prioritäten (0.53)
   Grund: P1 kam bisher erst, wenn es brannte. Der Coach hilft jetzt im
   richtigen Moment: morgens „Muss und Will“ nach freier Zeit, ⚑ Frist
   naht, zu viele P1, P5 seit 30 Tagen, sonntags ★ Wesentlich mit Bilanz
   „fremd / eigen“, Vorab-Check bei ⚑ von außen.
   Erkennt: Warteschlange missachtet P/★/Zeit, Frist-Frage fehlt oder
   kommt bei Eingeplantem, P1-Grenze rechnet falsch, ★ mehr als drei,
   Bilanz zählt falsch.
   ============================================================ */
function coPrioTest() {
  console.log('\n98. Coach und Prioritäten (0.53)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  S.localStorage.removeItem('clie-coach-gesehen');
  S.cl.co.tag = ''; S.cl.co.ansicht = 'verlauf';
  S.termineNachTag = {};
  S.krSpeichern({ id: 'kc-einstellungen', typ: 'coach', max: 12, morgen: '07:30', abend: '20:30' });
  S.DB.kurs.push({ id: 'kp1', typ: 'prinzip', text: 'Erst das Wichtige, dann das Dringende.', rang: 1, geaendert: 1 });
  S.DB.themen = [
    { id: 'ta', name: 'Q4', kontext: 'privat', ordnung: 1, geaendert: 1, text: '[] Zahlen an Controlling\n[] P2 Präsentation\n[] P1 Lange Analyse\n[] P5 Keller',
      zusatz: { 'Zahlen an Controlling': { frist: heute }, 'Präsentation': { frist: S.tagePlus(heute, 2), dauer: 120 }, 'Lange Analyse': { dauer: 240 } },
      p5Seit: { Keller: S.tagePlus(heute, -40) } },
    { id: 'tb', name: 'PV-Anlage', kontext: 'privat', stern: true, ordnung: 2, geaendert: 1, text: '[] P1 ZEO-Auftrag', zusatz: { 'ZEO-Auftrag': { dauer: 30 } } }];
  /* Warteschlange: P1 mit ★ zuerst, Zeitgrenze */
  const w = S.coWarteschlange(heute, 300, 3);
  pruefe(w.map(x => S.kpPrio(x.text).text).join(' | ') === 'ZEO-Auftrag | Lange Analyse', 'Warteschlange: P1 ★ zuerst, dann P1 — nur so viel, wie in 5 Std passt (P2 mit 2 Std nicht mehr)');
  pruefe(S.coWarteschlange(heute, 0, 3).length === 0, 'keine freie Zeit: kein Vorschlag');
  const mo = S.coFaellige('07:40', heute).filter(f => f.id === 'morgen')[0];
  pruefe(mo && /^Guten Morgen\. „Erst das Wichtige, dann das Dringende\.“ Frei heute: etwa/.test(mo.text) && /Muss ⚑: „Zahlen an Controlling“ \(heute\)/.test(mo.text) && /„ZEO-Auftrag“ \(1 ★ · 30 Min\)/.test(mo.text),
    'Morgen: dein Vorsatz, freie Zeit, Muss ⚑ getrennt, Will nach Priorität mit ★ und Dauer');
  /* ⚑ Frist naht */
  let l = S.coFaellige('09:00', heute);
  const fn = l.filter(f => /^fn:/.test(f.id));
  pruefe(fn.length === 1 && fn[0].id === 'fn:P2 Präsentation' && fn[0].rang === 1 && /noch nicht eingeplant/.test(fn[0].text), '⚑ Frist in 2 Tagen, nicht eingeplant: der Coach fragt (Rang 1)');
  S.coAntwort('fn:P2 Präsentation', 'morgen', 1, '09:00');
  pruefe(S.aufGeplant(S.kpSeiteFinden('ta'), 'P2 Präsentation').datum === S.tagePlus(heute, 1), '„Morgen“ plant sie ein');
  pruefe(!S.coFaellige('09:05', heute).some(f => f.id === 'fn:P2 Präsentation'), 'eingeplant: keine Frist-Frage mehr');
  /* P1-Grenze: 4,5 Std P1 */
  S.krFinden('kc-einstellungen').abend = '09:30';
  const pg = S.coFaellige('08:00', heute).filter(f => /^pg:/.test(f.id))[0];
  pruefe(pg && /P1 für 4,5 Std, frei bis morgen Abend 3 Std/.test(pg.text), 'zu viele P1 für die freie Zeit: der Coach fragt nach dem Richtungsweisenden');
  /* P5 seit 40 Tagen */
  const p5 = S.coFaellige('08:00', heute).filter(f => /^p5:/.test(f.id))[0];
  pruefe(p5 && /seit 40 Tagen auf P5/.test(p5.text), 'P5 seit über 30 Tagen: löschen?');
  S.coAntwort(p5.id, 'loeschen', 0, '08:00');
  pruefe(!/Keller/.test(S.DB.themen[0].text), 'gelöscht');
  /* ★ Wesentlich und Bilanz */
  S.kpTagAnlegen(heute);
  const tg = S.kpTagFinden(heute);
  tg.text = '[x] Zahlen an Controlling\n[x] P1 ZEO-Auftrag\n[x] Rasen';
  tg.eintraege = [{ id: 'e1', abschnitt: 'h', text: 'Zahlen an Controlling', quelle: 'ta', erledigt: true }, { id: 'e2', abschnitt: 'h', text: 'P1 ZEO-Auftrag', quelle: 'tb', erledigt: true }, { id: 'e3', abschnitt: 'h', text: 'Rasen', quelle: 'ta', erledigt: true }];
  const b = S.coWochenBilanz(heute);
  pruefe(b.verbindlichkeit === 1 && b.substanz === 1 && b.orga === 1, 'Bilanz der Woche (seit 0.55): Verbindlichkeit 1, Substanz 1, Organisation 1');
  S.DB.themen.push({ id: 'tc', name: 'Carport', text: '[] a', kontext: 'privat', ordnung: 3, geaendert: 1 }, { id: 'td', name: 'Garten', text: '[] b', kontext: 'privat', ordnung: 4, geaendert: 1 },
                   { id: 'te', name: 'Keller', text: '[] c', kontext: 'privat', ordnung: 5, geaendert: 1 });
  S.coWesentlichAuf();
  pruefe(S.cl.co.ansicht === 'wesentlich' && S.cl.co.sterne.join() === 'tb' && /Substanz/.test(inhalt()) && /Verbindl/.test(inhalt()) && /1 von 3/.test(inhalt()), '★-Wahl: vorbelegt mit dem bisherigen ★, Bilanz oben');
  S.coSternUm('tc'); S.coSternUm('td'); S.coSternUm('te');
  pruefe(S.cl.co.sterne.length === 3 && /Höchstens drei/.test(S.document.getElementById('toastText').textContent), 'höchstens drei');
  S.coSternUm('tb'); S.coSternUm('te');
  S.coWesentlichFertig();
  pruefe(!S.DB.themen.filter(x => x.id === 'tb')[0].stern && ['tc', 'td', 'te'].every(id => S.DB.themen.filter(x => x.id === id)[0].stern), 'Fertig: genau die gewählten haben ★');
  /* Sonntagsfrage */
  const so = S.coPrioFragen('21:00', '2026-10-25', S.coEinst()).filter(f => /^sw:/.test(f.id))[0];
  pruefe(so && /bis zu drei bekommen ★/i.test(so.text), 'Sonntagabend: „Welche Checklisten sind wesentlich?“');
  /* Vorab-Check bei ⚑ von außen */
  S.oeffne('aufgaben');
  S.aufNeu();
  S.document.getElementById('aufText').value = 'Bericht für Chef';
  S.document.getElementById('aufFrist').value = S.tagePlus(heute, 4);
  S.aufSpeichern();
  pruefe(S.cl.aufklapp === 'covorab' && /Jemand erwartet es bis/.test(S.coVorabHtml()), 'neue Aufgabe mit ⚑: der Vorab-Check fragt nach');
  S.aufklappZu();
  S.oeffne('uebersicht');
}

/* ============================================================
   96. Sammlung aus einer Notiz-Tabelle (0.49.1)
   Grund: Manche Notizen sind eigentlich Sammlungen — ihre Daten stehen
   als Markdown-Tabelle darin. Seit 0.49.1 lassen sie sich als neue
   Sammlung anlegen oder an eine bestehende anhängen.
   Erkennt: Tabellen werden nicht gefunden (ohne Randstriche, \|, mehrere
   Tabellen), Feldart falsch erkannt, Zahlen/Daten falsch umgewandelt,
   Probleme verschwiegen, Doppelte beim zweiten Anhängen, Notiz verändert.
   ============================================================ */
function saImportTest() {
  console.log('\n96. Sammlung aus einer Notiz-Tabelle (0.49.1)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.katSetzen('alle');
  const wein = '# Weinkeller\nText davor\n\n| Wein | Jahrgang | Preis | Lage | getrunken | Web |\n|---|---:|---|:---:|---|---|\n'
    + '| **Riesling GG** | 2019 | 24,90 € | Mosel | x | [Shop](https://wein.de/a) |\n| Spätburgunder \\| alt | 2015 | ca. 20 | Ahr |  | https://wein.de/b |\n|  |  |  |  |  |  |\n'
    + '| Silvaner | 2021 | 1.234,50 € | Franken | nein | https://wein.de/c |\n\nText danach';
  const gew = 'Datum | Gewicht | Notiz\n--- | --- | ---\n21.10.2026 | 84,6 | nach Urlaub\n22.10.26 | 84,1 |\n\n| A | B |\n|---|---|\n| 1 | 2 |';
  S.DB.gedanken.push({ id: 'nw', titel: 'Weinkeller', text: wein, kontext: 'privat', ordnung: 1, geaendert: 1 });
  S.DB.gedanken.push({ id: 'ng', titel: 'Gewicht 2026', text: gew, kontext: 'privat', ordnung: 2, geaendert: 1 });
  S.DB.gedanken.push({ id: 'nx', titel: 'Ohne Tabelle', text: 'nur | ein Strich', kontext: 'privat', ordnung: 3, geaendert: 1 });
  const tw = S.saMdTabellen(wein);
  pruefe(tw.length === 1 && tw[0].kopf.join(',') === 'Wein,Jahrgang,Preis,Lage,getrunken,Web' && tw[0].zeilen.length === 3, 'Tabelle gefunden: Kopf, Zeilen — leere Zeile übersprungen');
  pruefe(tw[0].zeilen[1][0] === 'Spätburgunder | alt', '\\| bleibt ein Strich im Text');
  pruefe(S.saMdTabellen(gew).length === 2 && S.saMdTabellen(gew)[0].zeilen.length === 2, 'ohne Randstriche und zwei Tabellen in einer Notiz');
  pruefe(['text', 'zahl', 'betrag', 'text', 'janein', 'link'].join() === tw[0].kopf.map((k, i) => S.saImpTyp(k, tw[0].zeilen.map(z => z[i]))).join(), 'Feldart erkannt: Text, Zahl, Betrag, Text, Ja/Nein, Link');
  pruefe(S.saImpWert('datum', '22.10.26') === '2026-10-22' && S.saImpWert('betrag', '1.234,50 €') === 1234.5 && S.saImpWert('zahl', 'ca. 20') === null && S.saImpWert('link', '[Shop](https://wein.de/a)') === 'https://wein.de/a',
    'Umwandlung: Datum, Betrag mit Tausenderpunkt, Unpassendes wird null, Link aus [Text](Link)');
  /* Neue Sammlung */
  S.oeffne('sammlungen');
  S.saNeu();
  pruefe(/saImpStart\('neu'\)/.test(S.saFensterHtml()), 'Neu bietet „Aus einer Notiz-Tabelle …“');
  S.saImpStart('neu');
  let h = S.saFensterHtml();
  pruefe(/Weinkeller/.test(h) && /Tabelle 2: A · B — 1 Zeilen/.test(h) && !/Ohne Tabelle/.test(h), 'Wahl: nur Notizen mit Tabellen, mehrere Tabellen einzeln');
  S.saImpWahl('nw', 0);
  h = S.saFensterHtml();
  pruefe(/Neu aus „Weinkeller“/.test(h) && /<option value="betrag" selected>/.test(h) && /3 Zeilen/.test(h) && /1 Wert in „Preis“ ist kein Betrag \(z\. B\. „ca\. 20“\)/.test(h), 'Vorschau: Feldart je Spalte, Probleme gezählt');
  /* Die Testumgebung übernimmt Werte nicht aus dem HTML — wie gewählt setzen */
  S.cl.sa.fenster.typen.forEach((ty, i) => { S.document.getElementById('saImp_' + i).value = ty; });
  S.document.getElementById('saImpName').value = 'Weinkeller';
  pruefe(!/<td class="(k|b)"/.test(h) && /<td class="ik">/.test(h), 'eigene Klassen in der Spaltentabelle — „k“ ist das Kästchen (Klassenkollision)');
  S.document.getElementById('saImp_3').value = '';
  S.saImpGeaendert();
  S.saImpAnlegen();
  const s = S.DB.sammlungen[S.DB.sammlungen.length - 1];
  const sae = S.saSaetze(s);
  pruefe(s.name === 'Weinkeller' && s.felder.length === 5 && !s.felder.some(f => f.name === 'Lage') && s.felder.filter(f => f.spalte).length === 3, 'neue Sammlung: Felder aus den Spalten, „Lage“ ausgelassen, drei als Spalte');
  const fid = n => s.felder.filter(f => f.name === n)[0].id;
  pruefe(sae.length === 3 && sae[0].werte[fid('Wein')] === 'Riesling GG' && sae[0].werte[fid('Preis')] === 24.9 && sae[0].werte[fid('getrunken')] === true && !(fid('Preis') in sae[1].werte) && sae[2].werte[fid('Preis')] === 1234.5,
    'Einträge mit umgewandelten Werten, Unpassendes leer');
  pruefe(S.DB.gedanken.filter(g => g.id === 'nw')[0].text === wein, 'die Notiz bleibt unverändert');
  /* Anhängen */
  S.DB.sammlungen.push({ id: 'sg', name: 'Gewicht', art: 'frei', kontext: 'privat', felder: [{ id: 'fd', name: 'Datum', typ: 'datum', spalte: true }, { id: 'fk', name: 'kg', typ: 'zahl', spalte: true }], rollen: {}, geaendert: 1 });
  S.DB.datensaetze.push({ id: 'd0', sammlung: 'sg', werte: { fd: '2026-10-21', fk: 84.6 }, geaendert: 1 });
  S.saOeffnen('sg');
  S.cl.aufklapp = 'menue'; S.aufklappZeichnen();
  pruefe(/menueWahl\('saImport'\)/.test(S.document.getElementById('aufklapp').innerHTML), 'im ≡ Menü: „Aus Notiz-Tabelle anhängen…“');
  S.menueWahl('saImport');
  S.saImpWahl('ng', 0);
  h = S.saFensterHtml();
  pruefe(/<option value="fd" selected>Datum/.test(h) && !/<option value="fk" selected>/.test(h), 'Zuordnung über den Namen (Datum), Unbekanntes leer');
  S.document.getElementById('saImp_0').value = 'fd';
  S.document.getElementById('saImp_1').value = 'fk';
  S.document.getElementById('saImp_2').value = '';
  S.saImpGeaendert();
  h = S.saFensterHtml();
  pruefe(/2 Zeilen: 1 neu, 1 schon vorhanden/.test(h) && /1 anhängen/.test(h), 'Gleiche Zeilen werden erkannt und gezählt');
  S.saImpAnhaengen();
  pruefe(S.saSaetze(S.saFinden('sg')).length === 2 && S.saSaetze(S.saFinden('sg')).some(d => d.werte.fd === '2026-10-22' && d.werte.fk === 84.1), 'nur die neue Zeile angehängt');
  S.saZurListe();
  S.oeffne('uebersicht');
}

/* ============================================================
   95. Prioritäten 1–5, ⚑ Frist, ◷ Dauer, ★ in Aufgaben (0.49)
   Grund: P1 war nur ein Alarmsignal. Seit 0.49 fünf Stufen (3 = Vorgabe
   ohne Kürzel), die Frist von außen ist eine eigene Marke statt P1, die
   grobe Dauer hilft beim Planen, ★ markiert die wesentlichen Checklisten.
   Erkennt: P4/P5 werden nicht erkannt, Frist/Dauer gehen beim Umbenennen
   oder Verschieben verloren, Sortierung ohne „heute fällig zuerst“,
   Frist weckt eine ruhende Checkliste nicht.
   ============================================================ */
function ckPrioTest() {
  console.log('\n95. Prioritäten 1–5, ⚑ Frist, ◷ Dauer, ★ in Aufgaben (0.49)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  S.cl.cls.id = ''; S.cl.aufklapp = ''; S.cl.auf.liste = ''; S.cl.auf.bereich = ''; S.cl.auf.frisch = {}; S.cl.auf.wahl = '';
  S.cl.auf.ansicht = 'prio'; S.cl.auf.naechste = false;
  S.DB.themen = [{ id: 'tq', name: 'Q4', text: '[] P5 Keller\n[] P4 Ablage\n[] Präsentation\n[] P1 ZEO-Auftrag', kontext: 'privat', ordnung: 1, geaendert: 1 },
                 { id: 'ts', name: 'PV-Anlage', text: '[] P1 Angebot prüfen', kontext: 'privat', stern: true, ordnung: 2, geaendert: 1 }];
  pruefe(S.kpPrio('P4 Ablage').p === 4 && S.kpPrio('P5 Keller').p === 5 && S.kpPrioText('x', 5) === 'P5 x' && S.kpPrioText('P2 x', 0) === 'x', 'P4 und P5 werden erkannt und geschrieben');
  S.oeffne('aufgaben');
  const zeilen = (x) => (x.match(/class="tx umbruch[^"]*"[^>]*>([^<]+)</g) || []).map(y => y.replace(/.*>/, '').replace(/<$/, ''));
  pruefe(zeilen(inhalt()).join(' | ') === 'Angebot prüfen | ZEO-Auftrag | Präsentation | Ablage | Keller', 'Prio: P1 mit ★ zuerst, dann P1, 3, 4, 5 — ' + zeilen(inhalt()).join(' | '));
  pruefe(/Angebot prüfen<small class="herkunft">≡ ★ PV-Anlage<\/small>/.test(inhalt()), '★ steht in der Herkunft');
  /* Frist und Dauer im Fenster */
  S.aufDetails('tq', 2);
  let f = S.aufFensterHtml();
  pruefe(/id="aufFrist"/.test(f) && /aufDauerWahl\(60\)">1 Std/.test(f) && /class="an" onclick="aufPrioWahl\(3\)"/.test(f) && /aufPrioWahl\(5\)/.test(f), 'Fenster: Priorität 1–5 (3 vorgewählt), ⚑ Frist, ◷ Dauer');
  S.document.getElementById('aufFrist').value = heute;
  S.aufDauerWahl(60);
  S.document.getElementById('aufText').value = 'Präsentation Q4';
  S.document.getElementById('aufFrist').value = heute;
  S.aufSpeichern();
  const zq = S.DB.themen[0].zusatz;
  pruefe(zq && zq['Präsentation Q4'] && zq['Präsentation Q4'].frist === heute && zq['Präsentation Q4'].dauer === 60 && !zq['Präsentation'], 'Frist und Dauer am Satz — beim Umbenennen umgezogen');
  const h = inhalt();
  pruefe(zeilen(h)[0] === 'Präsentation Q4' && /<span class="frist-marke">⚑ heute<\/span>/.test(h) && /◷ 1 Std/.test(h), 'heute fällige Frist steht ganz oben, mit ⚑ und ◷');
  /* Verschieben nimmt den Zusatz mit */
  const nr = S.DB.themen[0].text.split('\n').indexOf('[] Präsentation Q4');
  S.aufDetails('tq', nr);
  S.cl.auf.fenster.seite = 'ts';
  S.aufSpeichern();
  pruefe(!S.DB.themen[0].zusatz && S.DB.themen[1].zusatz && S.DB.themen[1].zusatz['Präsentation Q4'].frist === heute, 'in eine andere Checkliste verschoben: Frist und Dauer ziehen mit');
  /* Frist weckt eine ruhende Checkliste */
  S.DB.themen.push({ id: 'tw', name: 'Steuer', text: '[] Belege', kontext: 'privat', ruht: true, zusatz: { Belege: { frist: S.tagePlus(heute, -1) } }, ordnung: 3, geaendert: 1 });
  pruefe(S.ckWecken() === 1 && !S.DB.themen[2].ruht, 'eine überfällige ⚑ Frist weckt die ruhende Checkliste');
  /* Löschen räumt den Zusatz auf */
  const nr2 = S.DB.themen[1].text.split('\n').indexOf('[] Präsentation Q4');
  S.aufDetails('ts', nr2); S.aufLoeschenFragen(); S.aufLoeschen();
  pruefe(!S.DB.themen[1].zusatz, 'gelöschte Aufgabe: Zusatz weg');
  S.oeffne('uebersicht');
}

/* ============================================================
   92. Neue Checkliste aus einer Aufgabenliste (0.48.3, einmalig 0.48.4)
   Grund: Bei „Neu“ ließ sich eine Vorlage nur leer, als Kopie oder aus
   einem Memo anlegen. Seit 0.48.3 auch aus einer Aufgabenliste — mit
   allen Punkten, egal ob offen, erledigt oder nicht relevant.
   Erkennt: erledigte oder nicht relevante Punkte fehlen, Haken werden
   mitkopiert, „P1“ landet im Text, die Liste selbst wird verändert,
   Listen ohne Punkte oder vom anderen Bereich stehen zur Wahl.
   ============================================================ */
function clsAusListeTest() {
  console.log('\n92. Neue Checkliste aus einer Aufgabenliste (0.48.3)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const quelle = '## Vorbereitung\n[] P1 Server prüfen\n[x] Zugang holen\n[-] Altes Protokoll\nFließtext\n  [] Unterpunkt';
  S.DB.themen = [{ id: 't1', name: 'Auslieferung', text: quelle, kontext: 'beruflich', geaendert: 1 },
                 { id: 't2', name: 'Leer', text: 'nur Text', kontext: 'beruflich', geaendert: 1 },
                 { id: 't3', name: 'Garten', text: '[] Rasen', kontext: 'privat', geaendert: 1 }];
  S.katSetzen('beruflich');
  S.oeffne('checklisten');
  S.clsNeu();
  pruefe(/clsFensterSchritt\('liste'\)/.test(S.clsFensterHtml()), 'Neu bietet „Aus einer Aufgabenliste …“');
  S.clsFensterSchritt('liste');
  const h = S.clsFensterHtml();
  pruefe(/Auslieferung/.test(h) && !/>≡ Leer</.test(h) && !/Garten/.test(h), 'zur Wahl: Listen mit Punkten, passend zu Beruf/Privat');
  const vorher = S.DB.gedanken.length;
  S.clsAnlegen('liste', 't1');
  const v = S.DB.gedanken[S.DB.gedanken.length - 1];
  pruefe(S.DB.gedanken.length === vorher + 1 && v.checkliste === 'vorlage' && v.titel === 'Auslieferung' && v.kontext === 'beruflich', 'neue Vorlage mit Namen und Bereich der Liste');
  pruefe(v.text === '## Vorbereitung\n[] Server prüfen\n[] Zugang holen\n[] Altes Protokoll\n  [] Unterpunkt', 'alle Punkte (offen, erledigt, nicht relevant) leer übernommen, ohne „P1“ und Fließtext');
  pruefe(S.DB.themen[0].text === quelle, 'die Aufgabenliste bleibt unverändert');
  /* 0.48.4: wahlweise gleich als einmalige Checkliste */
  S.cl.cls.id = ''; S.clsNeu(); S.clsFensterSchritt('liste');
  pruefe(/clsAlsWahl\('lauf'\)/.test(S.clsFensterHtml()) && /class="an" onclick="clsAlsWahl\('vorlage'\)"/.test(S.clsFensterHtml()), 'Umschalter Vorlage / Einmalig — Vorlage vorgewählt');
  S.clsAlsWahl('lauf');
  S.clsAnlegen('liste', 't1');
  const e = S.DB.gedanken[S.DB.gedanken.length - 1];
  pruefe(e.checkliste === 'lauf' && e.gestartet === S.isoDatum() && e.titel === 'Auslieferung' && !('benutzt' in e) && /\[\] Zugang holen/.test(e.text), 'Einmalig: laufende Checkliste mit leeren Punkten, ab heute');
  pruefe(S.DB.gedanken.filter(x => x.checkliste === 'vorlage' && x.titel === 'Auslieferung').length === 1, 'dabei entsteht keine weitere Vorlage');
  S.katSetzen('alle');
  S.cl.cls.id = ''; S.cl.cls.schreiben = false; S.cl.cls.fenster = null; S.cl.aufklapp = '';
  S.oeffne('uebersicht');
}

/* ============================================================
   91. Checklisten kompakt, Name zweizeilig, Fassung bei Fokus (0.48.2)
   Grund: Die Übersicht brauchte je Eintrag zwei bis drei Zeilen; der
   Startknopf in der Liste ist überflüssig (gestartet wird in der Vorlage).
   Lange Namen ließen sich im einzeiligen Feld nicht pflegen. Am PC kam
   die Meldung „Neue Fassung“ erst nach einem Klick, weil das Fenster beim
   Wechsel zu anderen Programmen sichtbar bleibt.
   Erkennt: Startknopf oder Zusatzzeilen wieder in der Liste, Name wieder
   einzeilig, Zeilenumbruch landet im Namen, keine Prüfung beim Fokus.
   ============================================================ */
function clsKompaktTest() {
  console.log('\n91. Checklisten kompakt, Name zweizeilig, Fassung bei Fokus (0.48.2)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.DB.gedanken.push({ id: 'v9', titel: 'Durchführung des DFÜ-Abruftest für eine Auslieferung', text: '[] A\n[] B', kontext: 'beruflich', checkliste: 'vorlage', benutzt: 3, ordnung: 1, geaendert: 1 });
  S.DB.gedanken.push({ id: 'l9', titel: 'Durchführung des DFÜ-Abruftest 29.10.2026', text: '[x] A\n[] B', kontext: 'beruflich', checkliste: 'lauf', gestartet: S.isoDatum(), ordnung: 2, geaendert: 1 });
  S.localStorage.setItem('clie-cls-klapp', JSON.stringify({ vorl: true }));
  S.oeffne('checklisten');
  const hl = S.checklistenListeHtml();
  S.todoSicht('vorlage');
  const h = S.checklistenListeHtml();
  pruefe(!/clsStarten\(/.test(h) && !/Starten</.test(h), 'kein Startknopf in „Vorlagen…“');
  pruefe(!/× benutzt|<small>seit /.test(h + hl), 'keine Zusatzzeilen (seit … / benutzt)');
  pruefe(/class="cls-zeile vorl"/.test(h) && /class="cls-zeile lauf"[^>]*>.*1\/2/.test(hl), 'Vorlage einzeilig, Laufend mit 1/2');
  pruefe(/\.cls-zeile\.vorl \.tx\{white-space:nowrap\}/.test(QUELLE) && /\.cls-zeile\.lauf \.tx,\.cls-zeile\.erl \.tx\{white-space:nowrap\}/.test(QUELLE), 'CSS: alle Zeilen einzeilig (seit 0.53.2)');
  S.clsOeffnen('v9');
  pruefe(/clsStarten\(/.test(S.checklistenFussHtml()), 'gestartet wird in der geöffneten Vorlage');
  const feld = S.clsNameFeldHtml('Durchführung des DFÜ-Abruftest für eine Auslieferung');
  pruefe(/<textarea id="clsTitel"/.test(feld) && Number((feld.match(/rows="(\d+)"/) || [])[1]) >= 2, 'Name ist mindestens zweizeilig');
  S.cl.cls.fenster = { modus: 'details', titel: '' };
  S.document.getElementById('clsTitel').value = 'Zeile eins\n  Zeile zwei';
  S.clsFensterLesen();
  pruefe(S.cl.cls.fenster.titel === 'Zeile eins Zeile zwei', 'Zeilenumbruch wird zum Leerzeichen');
  pruefe(/addEventListener\('focus', versionBeiFokus\)/.test(SKRIPT), 'neue Fassung wird auch beim Zurückholen des Fensters geprüft');
  S.versionZuletztMs = Date.now();
  S.versionBeiFokus();
  pruefe(Date.now() - S.versionZuletztMs < 1000, 'höchstens einmal je Minute');
  S.cl.cls.fenster = null; S.cl.cls.id = '';
  S.oeffne('uebersicht');
}

/* ============================================================
   90. Symbole für Sammlungen (0.48.0)
   Grund: Sammlungen bekamen nur ein Zeichen je Vorlage (≡, €, ↻ …) —
   viele sahen gleich aus. Seit 0.48 gibt es 64 runde Pixel-Symbole,
   gewählt in „Details…“ und gespeichert als „symbol“ an der Sammlung.
   Erkennt: kaputte Symbol-Bilder, doppelte Schlüssel, Wahl geht verloren,
   „Wie Vorlage“ entfernt nicht, Symbol fehlt in Liste/Suche/Lesezeichen,
   unbekannter Schlüssel bricht die Anzeige.
   ============================================================ */
function saSymbolTest() {
  console.log('\n90. Symbole für Sammlungen (0.48.0)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const ik = S.SA_IKONEN || [];
  pruefe(ik.length === 128 && new Set(ik.map(i => i[0])).size === 128, '128 Symbole mit eindeutigem Schlüssel');
  /* gespeicherte Schlüssel müssen gültig bleiben — Symbole nie umbenennen oder entfernen (0.48.1) */
  const ALTE = ['waage','herz','laufen','rad','schwimmen','apfel','wasser','schlaf','zahn','medizin','hantel','puls','euro','sparschwein','karte','geldbeutel','rechnung','prozent','tresor','wachstum','haus','werkzeug','schluessel','lampe','blitz','flamme','pflanze','baum','sonne','auto','tanken','muell','buch','musik','film','kamera','spiel','schach','koffer','flugzeug','berg','ball','kochen','kaffee','tasche','uhr','kalender','brief','telefon','laptop','ordner','stift','haken','stern','flagge','schild','person','gruppe','kind','katze','hund','geschenk','kuchen','glas'];
  const fehlen = ALTE.filter(k => !S.saIkone(k));
  pruefe(fehlen.length === 0 && ik.slice(0, 64).map(i => i[0]).join() === ALTE.join(), 'die 64 Symbole aus 0.48.0 sind unverändert vorn' + (fehlen.length ? ' — fehlen: ' + fehlen.join(', ') : ''));
  pruefe(S.saIkone('wolke') && S.saIkone('kompass') && /<rect/.test(S.saIkoneSvg('kompass')), 'neue Symbole (Wolke … Kompass) werden gezeichnet');
  pruefe(ik.every(i => i[2].length === 12 && i[2].every(r => /^[#.]{12}$/.test(r)) && i[2].join('').indexOf('#') >= 0), 'jedes Bild 12 × 12 und nicht leer');
  S.DB.sammlungen = [{ id: 'sa1', name: 'Gewicht', art: 'frei', felder: [{ id: 'f1', name: 'kg', typ: 'zahl' }], rollen: {}, geaendert: 1 }];
  S.DB.datensaetze = [];
  const s = S.DB.sammlungen[0];
  pruefe(S.saSymbolHtml(s) === '≡' && S.saSymbolHtml({ art: 'frei', symbol: 'gibtsnicht' }) === '≡', 'ohne (oder mit unbekanntem) Symbol: Zeichen der Vorlage');
  S.oeffne('sammlungen'); S.saOeffnen('sa1');
  S.saDetailsOeffnen();
  pruefe(/Details…/.test(S.saFensterHtml() + SKRIPT) && SKRIPT.indexOf('Umbenennen / Löschen…') < 0, 'Menüpunkt heißt „Details…“');
  pruefe(/saSymbolWahl\(\)/.test(S.saFensterHtml()), 'Details zeigen die Zeile „Symbol“');
  S.document.getElementById('saName').value = 'Körpergewicht';
  S.saSymbolWahl();
  pruefe(S.cl.sa.fenster.modus === 'symbol' && (S.saFensterHtml().match(/saSymbolTipp\(/g) || []).length === 128, 'Raster mit 128 Symbolen');
  S.saSymbolTipp('waage');
  pruefe(/Gewählt: <b>Waage/.test(S.saFensterHtml()), 'Tipp zeigt den Namen des Symbols');
  S.saSymbolZurueck(true, false);
  pruefe(S.cl.sa.fenster.modus === 'details' && S.cl.sa.fenster.name === 'Körpergewicht', 'OK: zurück in Details, getippter Name bleibt');
  S.saDetailsSpeichern();
  pruefe(s.symbol === 'waage' && s.name === 'Körpergewicht', 'Speichern legt „symbol“ an der Sammlung ab');
  S.saZurListe();
  pruefe(/sa-sym"><svg class="sa-ikone"/.test(inhalt('inhalt') + inhalt('app')) || /<svg class="sa-ikone"/.test(S.saListeHtml ? S.saListeHtml() : ''), 'Liste zeigt das Pixel-Symbol');
  const t = S.suTreffer('Körper').filter(x => x.gruppe === 'sammlungen')[0];
  pruefe(t && /<svg class="sa-ikone-text"/.test(t.titel), 'Suche zeigt das Symbol');
  const z = S.lzZiel({ art: 'sammlung', zielId: 'sa1' });
  pruefe(z && /<svg class="sa-ikone-text"/.test(z.symbol), 'Lesezeichen zeigt das Symbol');
  S.saOeffnen('sa1'); S.saDetailsOeffnen(); S.saSymbolWahl();
  S.saSymbolZurueck(false, true); S.saDetailsSpeichern();
  pruefe(!('symbol' in s) && S.saSymbolHtml(s) === '≡', '„Wie Vorlage“ entfernt das Symbol wieder');
  S.saZurListe();
  S.oeffne('uebersicht');
}

/* ============================================================
   89. Neues App-Symbol: kleiner Organizer (0.47.3)
   Grund: Das alte Symbol (Schriftzug „CLIE“ auf Grün) wurde auf dem
   Pixel rund ausgeschnitten und war kaum lesbar. Neu: ein Palm-
   Organizer — als „any“ (abgerundet) und „maskable“ (randlos, Gerät in
   der sicheren Zone). Damit Android das neue Bild holt, tragen die
   Adressen ?v=…, und der Vorrat des Service Workers ist neu.
   Erkennt: falsche Bildgrößen, maskierbares Symbol fehlt, Manifest und
   Seite verweisen auf unterschiedliche Fassungen, alter Vorrat bleibt.
   ============================================================ */
function appSymbolTest() {
  console.log('\n89. Neues App-Symbol: kleiner Organizer (0.47.3)');
  if (!fs.existsSync(MANIFEST_PFAD)) { warn('clie.webmanifest fehlt'); return; }
  const m = JSON.parse(fs.readFileSync(MANIFEST_PFAD, 'utf8'));
  const groesse = f => { const b = fs.readFileSync(path.join(ORDNER, f)); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); };
  const icons = m.icons || [];
  pruefe(icons.length === 3 && icons.every(i => /\?v=\d+$/.test(i.src)), 'drei Symbole, jedes mit ?v=… (neues Bild wird geholt)');
  pruefe(icons.every(i => groesse(i.src.replace(/\?.*$/, '')) === i.sizes), 'Bildgrößen stimmen mit dem Manifest: ' + icons.map(i => i.sizes).join(', '));
  pruefe(icons.some(i => i.purpose === 'maskable'), 'eine randlose „maskable“-Fassung für Android');
  const v = (icons[0].src.match(/\?v=(\d+)/) || [])[1];
  pruefe(QUELLE.indexOf('href="./clie-192.png?v=' + v + '"') >= 0, 'die Seite verweist auf dieselbe Fassung des Symbols (v=' + v + ')');
  const sw = fs.existsSync(path.join(ORDNER, 'sw-clie.js')) ? fs.readFileSync(path.join(ORDNER, 'sw-clie.js'), 'utf8') : '';
  pruefe(/var VORRAT = 'clie-vorrat-([2-9]|\d\d+)'/.test(sw), 'neuer Vorrat im Service Worker (alter wird aufgeräumt)');
}

/* ============================================================
   88. Diagramm-Zeitraum wird gemerkt (0.47.2)
   Grund: Diagramme starteten immer bei „3 M“ — wer „1 M“ will, musste
   jedes Mal umschalten. Seit 0.47.2 merkt sich das Gerät den Zeitraum
   je Sammlung (localStorage, nicht in der workbench.json).
   Erkennt: Zeitraum nach Neustart wieder 3 M, Zeitraum gilt für alle
   Sammlungen statt je Sammlung, kaputter Speicher bricht die Anzeige.
   ============================================================ */
function diaZeitraumTest() {
  console.log('\n88. Diagramm-Zeitraum wird gemerkt (0.47.2)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.localStorage.removeItem('clie-sa-zeitraum');
  S.cl.sa.dzr = null;
  S.DB.sammlungen = [{ id: 'sa1', name: 'Gewicht', felder: [{ id: 'f1', name: 'kg', typ: 'zahl' }], diagramme: [{ art: 'linie', feld: 'f1', wie: 'eintrag' }], rollen: {}, geaendert: 1 },
    { id: 'sa2', name: 'Budget', felder: [{ id: 'f2', name: 'Betrag', typ: 'betrag' }], diagramme: [{ art: 'zeit', feld: 'f2', wie: 'summe', takt: 'monat' }], rollen: {}, geaendert: 1 }];
  S.DB.datensaetze = [];
  S.oeffne('sammlungen'); S.saOeffnen('sa1'); S.saAnsicht('diagramm');
  pruefe(S.saDiaZr(S.DB.sammlungen[0]) === '90', 'ohne Gemerktes: 3 M');
  S.saDiaZrUm(-1);
  pruefe(S.saDiaZr(S.DB.sammlungen[0]) === '30' && JSON.parse(S.localStorage.getItem('clie-sa-zeitraum')).sa1 === '30', '◀ auf 1 M — auf dem Gerät gemerkt');
  S.cl.sa.dzr = null;   /* wie nach einem Neustart */
  pruefe(S.saDiaZr(S.DB.sammlungen[0]) === '30' && S.saDiaZr(S.DB.sammlungen[1]) === '90', 'nach Neustart: Gewicht bleibt 1 M, Budget hat eigenen Zeitraum');
  pruefe(!('dzr' in S.DB.sammlungen[0]) && !/clie-sa-zeitraum/.test(JSON.stringify(S.DB)), 'nicht in der workbench.json');
  S.localStorage.setItem('clie-sa-zeitraum', 'kaputt'); S.cl.sa.dzr = null;
  pruefe(S.saDiaZr(S.DB.sammlungen[0]) === '90', 'kaputter Speicher: wieder 3 M, kein Fehler');
  S.localStorage.removeItem('clie-sa-zeitraum'); S.cl.sa.dzr = null;
  S.saZurListe();
  S.oeffne('uebersicht');
}

/* ============================================================
   87. Sortieren über die Spaltenköpfe (0.47.1)
   Grund: „Sortieren“ unten war ein eigener Knopf mit Auswahlliste — es
   gehört an die Werte. Ein Tipp auf die Überschrift sortiert, ein
   zweiter dreht um; ▲/▼ zeigt die aktive Spalte. Unten ist so Platz
   für „Diagramm“ bzw. „Tabelle“.
   Erkennt: Spaltenköpfe ohne Wirkung, Richtung dreht nicht, Pfeil an
   falscher Spalte, Knopf „Sortieren“ wieder da.
   ============================================================ */
function spaltenSortTest() {
  console.log('\n87. Sortieren über die Spaltenköpfe (0.47.1)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.DB.sammlungen = [{ id: 'sb', name: 'Bücher', felder: [{ id: 'bt', name: 'Titel', typ: 'text', spalte: true }, { id: 'bs', name: 'Seiten', typ: 'zahl', spalte: true }], rollen: {}, geaendert: 1 }];
  S.DB.datensaetze = [{ id: 'b1', sammlung: 'sb', werte: { bt: 'Momo', bs: 280 }, angelegt: 1, geaendert: 1 }, { id: 'b2', sammlung: 'sb', werte: { bt: 'Atomic Habits', bs: 350 }, angelegt: 2, geaendert: 2 },
    { id: 'b3', sammlung: 'sb', werte: { bt: 'Essentialismus', bs: 300 }, angelegt: 3, geaendert: 3 }];
  S.oeffne('sammlungen'); S.saOeffnen('sb');
  let h = inhalt();
  const reihe = x => (x.match(/(Momo|Atomic Habits|Essentialismus)/g) || []).join(',');
  pruefe(/onclick="saSortSetzen\('bt'\)">Titel<span class="sa-pfeil"> ▲<\/span><\/th>/.test(h) && reihe(h.slice(h.indexOf('</table></div>'))) === 'Atomic Habits,Essentialismus,Momo', 'ohne Wahl: nach der ersten Spalte aufsteigend, ▲ an „Titel“');
  S.saSortSetzen('bs');
  h = inhalt();
  pruefe(/>Seiten<span class="sa-pfeil"> ▲<\/span>/.test(h) && !/>Titel<span/.test(h) && reihe(h.slice(h.indexOf('</table></div>'))) === 'Momo,Essentialismus,Atomic Habits', 'Tipp auf „Seiten“: nach Seiten aufsteigend');
  S.saSortSetzen('bs');
  h = inhalt();
  pruefe(/>Seiten<span class="sa-pfeil"> ▼<\/span>/.test(h) && reihe(h.slice(h.indexOf('</table></div>'))) === 'Atomic Habits,Essentialismus,Momo' && S.DB.sammlungen[0].sort.ab === true, 'zweiter Tipp: absteigend ▼, an der Sammlung gespeichert');
  pruefe(!/Sortieren/.test(S.document.getElementById('fuss').innerHTML) && typeof S.saSortOeffnen === 'undefined' && !/Diagramm/.test(S.document.getElementById('fuss').innerHTML), 'unten kein „Sortieren“; ohne Diagramme auch kein „Diagramm“');
  S.saZurListe();
  S.oeffne('uebersicht');
}

/* ============================================================
   86. Diagramme in Sammlungen (0.47)
   Grund: Sammlungen sollen einfache Diagramme zeigen: Linie (Verlauf,
   optional Ziellinie), Balken je Zeit, Balken je Gruppe, Torte — bis zu
   drei je Sammlung, umschaltbar „Tabelle | Diagramm“, Zeitraum ◀ ▶,
   dazu eine Mini-Kurve in Kopfwert-Kacheln.
   Erkennt: krumme Achsenwerte, falsche Summen/Ø je Monat oder Gruppe,
   Zeitraum wirkungslos, Torte ohne Anteile, Einrichten speichert falsch,
   mehr als drei Diagramme, Umschalter ohne Diagramme sichtbar.
   ============================================================ */
function diagrammeTest() {
  console.log('\n86. Diagramme in Sammlungen (0.47)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  pruefe(JSON.stringify(S.saDiaSkala(0, 6290, 3)) === JSON.stringify({ lo: 0, hi: 7500, schritt: 2500 }) && S.saDiaZahl(2500, 2500) === '2,5k' && S.saDiaZahl(77.5, 2.5) === '77,5' && S.saDiaZahl(0, 2500) === '0',
    'Achsen mit runden Schritten (2.500 statt 2.097) und passender Genauigkeit');
  S.DB.sammlungen = [{ id: 'sg', name: 'Gewicht', felder: [{ id: 'fd', name: 'Datum', typ: 'datum' }, { id: 'fk', name: 'kg', typ: 'zahl' }, { id: 'fn', name: 'Notiz', typ: 'text' }],
    werte: [{ id: 'wz', name: 'Ziel', typ: 'zahl', wert: 73 }], kopfwerte: [{ art: 'letzter', feld: 'fk' }, { art: 'wert', wert: 'wz' }], rollen: {}, geaendert: 1 }];
  S.DB.datensaetze = [];
  [[-100, 85], [-20, 80], [-10, 79], [-3, 78.5], [0, 78]].forEach((x, i) => S.DB.datensaetze.push({ id: 'g' + i, sammlung: 'sg', werte: { fd: S.tagePlus(heute, x[0]), fk: x[1], fn: i % 2 ? 'A' : 'B' }, angelegt: 1, geaendert: 1 }));
  const sg = S.DB.sammlungen[0];
  S.oeffne('sammlungen'); S.saOeffnen('sg');
  pruefe(!/class="sa-dia-um"/.test(inhalt()), 'ohne Diagramm kein Umschalter');
  pruefe(/<small>kg<\/small><b>78<\/b><\/div>/.test(inhalt()) && !/sa-mini|<svg/.test(inhalt()), 'Kopfwert-Kacheln ohne Mini-Kurve (seit 0.47.1 entfernt)');
  S.menueUm();
  pruefe(/menueWahl\('saDiagramme'\)">Diagramme…/.test(S.document.getElementById('aufklapp').innerHTML), 'Menü der Sammlung: „Diagramme…“');
  S.menueWahl('saDiagramme');
  pruefe(S.cl.sa.ansicht === 'diagramme' && S.document.getElementById('reiter').textContent === 'Diagramme' && /saDiaNeu\(\)">\+ Diagramm/.test(S.document.getElementById('fuss').innerHTML), 'Einrichten: Liste mit „+ Diagramm“');
  /* Linie mit Ziel anlegen */
  S.saDiaNeu();
  let a = S.document.getElementById('aufklapp').innerHTML;
  pruefe(/saDiaArt\('torte'\)">Torte/.test(a) && /id="saDiaZiel"/.test(a) && !/id="saDiaGruppe"/.test(a), 'Fenster: vier Arten; bei Linie die Ziellinie, keine Gruppe');
  S.document.getElementById('saDiaFeld').value = 'fk'; S.document.getElementById('saDiaWie').value = 'eintrag'; S.document.getElementById('saDiaZiel').value = 'wz'; S.document.getElementById('saDiaName').value = '';
  S.saDiaSpeichern();
  pruefe(JSON.stringify(sg.diagramme) === JSON.stringify([{ art: 'linie', wie: 'eintrag', feld: 'fk', ziel: 'wz' }]), 'Linie gespeichert (an der Sammlung, Feld „diagramme“)');
  /* Torte: Art wechseln, Werte bleiben */
  S.saDiaNeu();
  S.document.getElementById('saDiaFeld').value = 'fk';
  S.saDiaArt('torte');
  a = S.document.getElementById('aufklapp').innerHTML;
  pruefe(/id="saDiaGruppe"/.test(a) && !/value="schnitt"/.test(a) && !/id="saDiaZiel"/.test(a), 'Torte: Gruppe wählbar, kein Ø, keine Ziellinie');
  S.document.getElementById('saDiaGruppe').value = 'fn'; S.document.getElementById('saDiaWie').value = 'anzahl';
  S.saDiaSpeichern();
  S.saDiaNeu();
  S.saDiaArt('zeit');
  S.document.getElementById('saDiaFeld').value = 'fk'; S.document.getElementById('saDiaWie').value = 'summe'; S.document.getElementById('saDiaTakt').value = 'monat';
  S.saDiaSpeichern();
  pruefe(sg.diagramme.length === 3 && sg.diagramme[1].art === 'torte' && sg.diagramme[1].gruppe === 'fn' && !sg.diagramme[1].feld && sg.diagramme[2].takt === 'monat', 'Torte (Anzahl je Notiz) und Balken je Monat gespeichert');
  S.saDiaNeu();
  pruefe(S.cl.aufklapp !== 'sa' && /disabled>\+ Diagramm/.test(S.document.getElementById('fuss').innerHTML), 'höchstens drei Diagramme');
  /* Anzeige */
  S.saAnsicht('tabelle');
  pruefe(!/sa-dia-um/.test(inhalt()) && /onclick="saAnsicht\('diagramm'\)">Diagramm<\/button>/.test(S.document.getElementById('fuss').innerHTML) && !/Sortieren/.test(S.document.getElementById('fuss').innerHTML),
    'mit Diagrammen: unten „Diagramm“ (seit 0.47.1), kein „Sortieren“ mehr');
  S.saAnsicht('diagramm');
  let h = inhalt();
  pruefe((h.match(/class="sa-dia"/g) || []).length === 3 && /<span>kg<\/span><small>▼ −2<\/small>/.test(h) && />Ziel 73<\/text>/.test(h), 'Diagramm-Ansicht: drei Diagramme, Linie mit Veränderung und Ziellinie');
  pruefe(/Anteile Einträge je Notiz/.test(h) && /<pattern id="saSchr1"/.test(h) && /50 %<\/text>/.test(h), 'Torte mit Schraffur und Anteilen');
  pruefe(/saDiaPunkt\('/.test(h) && /saAnsicht\('tabelle'\)">Tabelle<\/button>/.test(S.document.getElementById('fuss').innerHTML) && /saDiaZrUm\(1\)/.test(S.document.getElementById('fuss').innerHTML) && />3 M</.test(S.document.getElementById('fuss').innerHTML), 'Punkte antippbar; unten „Tabelle“ und der Zeitraum (Standard 3 M)');
  pruefe(S.saDiaLinieDaten(sg, sg.diagramme[0]).length === 4, '3 Monate: der Eintrag von vor 100 Tagen fällt heraus');
  S.saDiaZrUm(1); S.saDiaZrUm(1);
  pruefe(S.saDiaZr(sg) === '' && S.saDiaLinieDaten(sg, sg.diagramme[0]).length === 5, '▶ ▶: „alles“ — alle fünf Einträge');
  S.saDiaZrUm(1);
  pruefe(S.saDiaZr(sg) === '30', 'danach wieder 1 Monat');
  const mon = S.saDiaZeitDaten(sg, { art: 'zeit', feld: 'fk', wie: 'summe', takt: 'monat' });
  pruefe(mon.length >= 1 && mon[mon.length - 1].k === heute.slice(0, 8) + '01' && mon.every(m => typeof m.v === 'number'), 'Balken je Monat: Monate bis heute, leere mit 0');
  const gr = S.saDiaGruppenDaten(sg, { art: 'gruppe', feld: 'fk', gruppe: 'fn', wie: 'summe' }, 8);
  pruefe(gr.length === 2 && gr[0].v >= gr[1].v, 'Balken je Gruppe: absteigend');
  const viele = S.saDiaGruppenDaten(sg, { art: 'torte', gruppe: 'fd', wie: 'anzahl' }, 3);
  pruefe(viele.length === 3 && viele[2].name === 'Übrige', 'mehr Gruppen als Platz: der Rest als „Übrige“');
  S.saDiaPunkt('23.10.2026: 78');
  pruefe(/23\.10\.2026: 78/.test(S.document.getElementById('toastText').textContent), 'Tipp auf einen Punkt: Datum und Wert');
  /* Löschen */
  S.saAnsicht('diagramme');
  S.saDiaOeffnen(0); S.saDiaLoeschen(); S.saDiaOeffnen(0); S.saDiaLoeschen(); S.saDiaOeffnen(0); S.saDiaLoeschen();
  pruefe(!('diagramme' in sg), 'alle gelöscht: Feld wieder weg');
  S.saZurListe();
  S.oeffne('uebersicht');
}

/* ============================================================
   85. Kopfwert „letzter Wert“ heißt wie das Feld (0.46.3)
   Grund: Kopfwerte zeigten „letzter Wert Taille“ — abgeschnitten zu
   „letzter Wert Ta…“, das Wichtige fehlte. Seit 0.46.3 steht nur der
   Feldname. Alte Verweise „Sammlung: letzter Wert Feld“ gelten weiter.
   Erkennt: Vorsatz wieder da, andere Arten (Summe, Ø) ohne Vorsatz,
   alte Verweise rechnen nicht mehr.
   ============================================================ */
function kopfwertNameTest() {
  console.log('\n85. Kopfwert „letzter Wert“ heißt wie das Feld (0.46.3)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const k = S.saAusVorlage(S.SA_VORLAGEN.frei, 'Körpermaße', false, []);
  k.felder = [{ id: 'kd', name: 'Datum', typ: 'datum' }, { id: 'kt', name: 'Taille', typ: 'zahl' }];
  k.kopfwerte = [{ art: 'letzter', feld: 'kt' }, { art: 'schnitt', feld: 'kt' }, { art: 'letzter', feld: 'kt', name: 'Bauch' }];
  S.DB.datensaetze.push({ id: 'x1', sammlung: k.id, werte: { kd: '2026-10-01', kt: 106 }, angelegt: 1, geaendert: 1 });
  S.DB.datensaetze.push({ id: 'x2', sammlung: k.id, werte: { kd: '2026-10-20', kt: 104 }, angelegt: 2, geaendert: 2 });
  pruefe(S.saKopfwertName(k, k.kopfwerte[0]) === 'Taille', '„letzter Wert“ heißt nur wie das Feld: „Taille“');
  pruefe(S.saKopfwertName(k, k.kopfwerte[1]) === 'Ø Taille' && S.saKopfwertName(k, k.kopfwerte[2]) === 'Bauch', 'Ø behält den Vorsatz, ein eigener Name bleibt');
  pruefe(!/letzter Wert/.test(S.saKopfwerteHtml(k)) && /<small>Taille<\/small><b>104<\/b>/.test(S.saKopfwerteHtml(k)), 'Kachel: „Taille 104“');
  pruefe(S.saFremdZahl('Körpermaße: Taille', '', 0) === 104 && S.saFremdZahl('Körpermaße: letzter Wert Taille', '', 0) === 104, 'Verweise: neuer Name und alter Name „letzter Wert Taille“ gelten');
}

/* ============================================================
   84. Blättern mit Pfeilen in Woche, Blöcken, Monat (0.46.2)
   Grund: Am PC (Maus) lässt sich nicht wischen — in Woche, Blöcken und
   Monat gab es keinen Weg vor und zurück. Jetzt ◀ ▶: in Woche und Monat
   in einer Zeile über dem Inhalt, in Blöcken rechts neben der Tagwahl.
   Erkennt: fehlende Pfeile, Pfeile blättern falsch weit, Blöcke-Zeile
   ohne Pfeile.
   ============================================================ */
function blattTest() {
  console.log('\n84. Blättern mit Pfeilen in Woche, Blöcken, Monat (0.46.2)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const pfeile = h => /onclick="clBlaettern\(-1\)" aria-label="zurück">◀/.test(h) && /onclick="clBlaettern\(1\)" aria-label="vor">▶/.test(h);
  S.oeffne('kalender');
  S.clKalGehe('2026-10-21', 'woche');
  let h = inhalt();
  pruefe(pfeile(h) && /class="blatt">.*<span>19\.10\. – 25\.10\.<\/span>/.test(h), 'Woche: ◀ 19.10. – 25.10. ▶');
  S.clBlaettern(1);
  pruefe(S.clKalDatum() === '2026-10-28' && /26\.10\. – 01\.11\.|26\.10\. – 1\.11\./.test(inhalt()), '▶ blättert eine Woche weiter');
  S.clKalGehe('2026-10-21', 'monat');
  h = inhalt();
  pruefe(pfeile(h) && /<span>Oktober 2026<\/span>/.test(h), 'Monat: ◀ Oktober 2026 ▶');
  S.clBlaettern(-1);
  pruefe(S.clKalDatum().slice(0, 7) === '2026-09' && /<span>September 2026<\/span>/.test(inhalt()), '◀ blättert einen Monat zurück');
  S.clKalGehe('2026-10-21', 'bloecke');
  h = inhalt();
  pruefe(/class="blatt-zeile"><div class="tagwahl">[\s\S]*<\/div><span class="blatt-pfeile">/.test(h) && pfeile(h), 'Blöcke: ◀ ▶ rechts neben der Tagwahl');
  S.clKalAnsicht('tag');
  S.clKalGehe(S.isoDatum(), 'tag');
  S.oeffne('uebersicht');
}

/* ============================================================
   83. Menü-Taste unten, Titel nur Text, Info je Sammlung (0.46)
   Grund: Der Titel oben mit ▾ war zugleich das Menü — er wechselt je
   nach Seite („So–Di“, „Gewicht“) und weckte falsche Erwartungen. Jetzt
   ist er nur Titel; das Menü sitzt wie am Palm als Taste ≡ unten rechts
   (statt Abgleich). Dazu ein eigener Hinweis je Sammlung („i“), dessen
   erster Absatz beim Eintragen oben steht.
   Erkennt: Titel wieder anklickbar, Menü-Taste fehlt, Menü ohne
   Abgleich/Fassung oben, Info nicht gespeichert oder nicht angezeigt,
   „i“ ohne Info, Hinweis fehlt beim Eintragen.
   ============================================================ */
function menueInfoTest() {
  console.log('\n83. Menü-Taste unten, Titel nur Text, Info je Sammlung (0.46)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  pruefe(/<span class="reiter" id="reiter">/.test(QUELLE) && /onclick="menueUm\(\)" id="menueTaste"><b>≡<\/b>Menü<\/button>\s*<\/nav>/.test(QUELLE), 'oben nur der Titel, unten rechts die Taste ≡ Menü');
  S.oeffne('kalender');
  S.menueUm();
  const m = S.document.getElementById('aufklapp').innerHTML;
  pruefe(/class="aufklapp menue-unten"/.test(m) && m.indexOf('Abgleich…') < m.indexOf('Auf neue Fassung prüfen') && m.indexOf('Auf neue Fassung prüfen') < m.indexOf('Termine holen') && m.indexOf('Termine holen') < m.indexOf('Statistik'),
    'Menü über der Leiste: Abgleich…, Auf neue Fassung prüfen, Termine holen … Statistik, Info');
  S.menueWahl('abgleich');
  pruefe(S.cl.app === 'abgleich' && !S.cl.aufklapp, '„Abgleich…“ öffnet die App Abgleich');
  S.oeffne('uebersicht');
  /* Info je Sammlung */
  S.DB.sammlungen = [{ id: 'sg', name: 'Gewicht', felder: [{ id: 'fd', name: 'Datum', typ: 'datum', spalte: true }, { id: 'fk', name: 'kg', typ: 'zahl', spalte: true }], rollen: {}, geaendert: 1 }];
  S.DB.datensaetze = [];
  S.oeffne('sammlungen'); S.saOeffnen('sg');
  pruefe(!/class="sa-info"/.test(inhalt()), 'ohne Hinweis kein „i“');
  S.menueUm();
  pruefe(/menueWahl\('saInfo'\)">Info…/.test(S.document.getElementById('aufklapp').innerHTML), 'im Menü der Sammlung: „Info…“');
  S.menueWahl('saInfo');
  pruefe(S.cl.aufklapp === 'sa' && /id="saInfoFeld"/.test(S.document.getElementById('aufklapp').innerHTML), '„Info…“ öffnet das Textfeld');
  S.document.getElementById('saInfoFeld').value = 'Immer morgens wiegen: nüchtern, nackt.\nNach dem Klo.\n\nGleiche Waage, gleicher Platz.';
  S.saInfoSpeichern();
  const sg = S.DB.sammlungen[0];
  pruefe(/^Immer morgens/.test(sg.info) && sg.geaendert > 1 && !S.cl.aufklapp, 'Hinweis gespeichert (Feld „info“ der Sammlung, geht in die workbench.json)');
  pruefe(/class="sa-info" onclick="saInfoZeigen\(\)"/.test(inhalt()), 'mit Hinweis: „i“ neben den Kopfwerten');
  S.saInfoZeigen();
  let a = S.document.getElementById('aufklapp').innerHTML;
  pruefe(/Info · Gewicht/.test(a) && /<p>Immer morgens wiegen: nüchtern, nackt\.<br>Nach dem Klo\.<\/p><p>Gleiche Waage/.test(a) && /saInfoBearbeiten\(\)">Bearbeiten/.test(a), '„i“ zeigt den Hinweis mit Absätzen, dazu „Bearbeiten“');
  S.aufklappZu();
  S.saEintrag('');
  a = S.document.getElementById('aufklapp').innerHTML;
  pruefe(/class="sa-infohinweis">ⓘ Immer morgens wiegen: nüchtern, nackt\.<br>Nach dem Klo\.<\/div>/.test(a) && !/Gleiche Waage/.test(a), 'Neuer Eintrag: der erste Absatz steht oben');
  S.aufklappZu();
  S.saInfoBearbeiten();
  S.document.getElementById('saInfoFeld').value = '   ';
  S.saInfoSpeichern();
  pruefe(!('info' in S.DB.sammlungen[0]) && !/class="sa-info"/.test(inhalt()), 'Text geleert: Hinweis und „i“ wieder weg');
  pruefe((QUELLE.match(/\.sa-hinweis\{/g) || []).length === 1, 'eigene Klasse für den Info-Hinweis — die Abo-Warnung „sa-hinweis“ bleibt unberührt');
  S.saZurListe();
  S.oeffne('uebersicht');
}

/* ============================================================
   82. Zeitklammern: Ende und Beginn in einer Zeile (0.45.1)
   Grund: Endete ein Termin genau, wenn der nächste begann (11:05–12:00,
   12:00–12:45), überlappten sich links die Klammern — die zweite rückte
   in eine eigene Spalte. Jetzt schließt die erste und die zweite öffnet
   sich in derselben Spalte.
   Erkennt: zweite Spalte bei Anschlussterminen, fehlender Wechsel,
   Wechsel auch bei echter Überschneidung.
   ============================================================ */
function klammerWechselTest() {
  console.log('\n82. Zeitklammern: Ende und Beginn in einer Zeile (0.45.1)');
  if (!CL) { return; }
  frisch();
  const tag = CL.tagePlus(CL.isoDatum(), 1);
  CL.termineNachTag[tag] = [
    { id: 'a', zeit: '11:05', bis: '12:00', titel: 'WFT-Sync', kontext: 'beruflich', kalId: 'k' },
    { id: 'b', zeit: '12:00', bis: '12:45', titel: 'Mittagessen', kontext: 'beruflich', kalId: 'k' },
    { id: 'c', zeit: '13:00', bis: '14:00', titel: 'O-Töne', kontext: 'beruflich', kalId: 'k' },
    { id: 'd', zeit: '13:05', bis: '13:30', titel: 'Austausch', kontext: 'beruflich', kalId: 'k' },
    { id: 'e', zeit: '14:00', bis: '15:45', titel: 'Fokus', kontext: 'beruflich', kalId: 'k' },
    { id: 'f', zeit: '15:45', bis: '16:00', titel: 'Tagesabschluss', kontext: 'beruflich', kalId: 'k' }];
  CL.oeffne('kalender');
  CL.clKalGehe(tag, 'tag');
  const reihen = inhalt().split('<div class="std').slice(1);
  const zeile = (zeit) => reihen.filter(r => r.indexOf('class="z">' + zeit + '<') >= 0)[0] || '';
  pruefe(/class="kl"><i class="oben"><\/i><i class=""><\/i>/.test(zeile('11:05')) && /class="kl"><i class="wechsel"><\/i><i class=""><\/i>/.test(zeile('12:00')) && /class="kl"><i class="unten"><\/i><i class=""><\/i>/.test(zeile('12:45')),
    '11:05–12:00 und 12:00–12:45: eine Spalte — bei 12:00 schließt die eine, die andere öffnet sich');
  pruefe(/class="kl"><i class="oben"><\/i><i class=""><\/i>/.test(zeile('13:00')) && /class="kl"><i class="mitte"><\/i><i class="oben"><\/i>/.test(zeile('13:05')),
    'echte Überschneidung (13:05 in 13–14) bleibt daneben in der zweiten Spalte');
  pruefe(/class="kl"><i class="wechsel"><\/i><i class=""><\/i>/.test(zeile('14:00')) && /class="kl"><i class="wechsel"><\/i><i class=""><\/i>/.test(zeile('15:45')) && /class="kl"><i class="unten"><\/i>/.test(zeile('16:00')),
    'Kette 13–14 → 14–15:45 → 15:45–16: jeweils Wechsel in derselben Spalte');
  /* Seit 0.45.2: zwei enden zugleich, und dann beginnt ein neuer */
  CL.termineNachTag[tag] = [
    { id: 'g', zeit: '11:00', bis: '12:00', titel: 'Gruppenmeeting', kontext: 'beruflich', kalId: 'k' },
    { id: 'h', zeit: '11:30', bis: '12:00', titel: 'UJQS', kontext: 'beruflich', kalId: 'k' },
    { id: 'i', zeit: '12:00', bis: '12:45', titel: 'Mittagessen', kontext: 'beruflich', kalId: 'k' }];
  CL.clKalGehe(tag, 'tag');
  const reihen2 = inhalt().split('<div class="std').slice(1);
  const zeile2 = (zeit) => reihen2.filter(r => r.indexOf('class="z">' + zeit + '<') >= 0)[0] || '';
  pruefe(/class="kl"><i class="mitte"><\/i><i class="oben"><\/i>/.test(zeile2('11:30')) && /class="kl"><i class="wechsel"><\/i><i class="schluss"><\/i>/.test(zeile2('12:00')) && /class="kl"><i class="unten"><\/i><i class=""><\/i>/.test(zeile2('12:45')),
    'zwei enden um 12:00, Mittagessen beginnt: Wechsel links, die innere Klammer schließt auf derselben Höhe (seit 0.45.2)');
  pruefe(/\.kl i\.wechsel::before,\.kl i\.schluss::before\{[^}]*border-bottom/.test(QUELLE), '„schluss“ schließt wie der Wechsel in der Mitte der Zeile');
  pruefe(/\.kl i\.wechsel::before\{[^}]*border-bottom/.test(QUELLE) || /\.kl i\.wechsel::before,/.test(QUELLE) && /\.kl i\.wechsel::after\{[^}]*border-top/.test(QUELLE), 'Wechsel gezeichnet: oben schließen, unten öffnen');
  delete CL.termineNachTag[tag];
  CL.clKalGehe(CL.isoDatum(), 'tag');
  CL.oeffne('uebersicht');
}

/* ============================================================
   81. Invasion (0.45)
   Grund: Ein Spiel nach dem Prinzip von Space Invaders: Formation rückt
   seitlich und stufenweise vor, Bunker zerbröseln, Schiff folgt dem
   Daumen und schießt von selbst; Loslassen und App-Wechsel halten an;
   Spielstand und Bestenliste nur auf dem Gerät.
   Erkennt: falsche Punkte je Reihe, Formation kehrt am Rand nicht um,
   Tempo steigt nicht, Bunker unverwundbar, Treffer kostet kein Leben,
   kein Spielende, kein neues Level, Pause ohne Spielstand, Spielstand
   nicht wieder geladen, App-Wechsel läuft weiter.
   ============================================================ */
function invasionTest() {
  console.log('\n81. Invasion (0.45)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  ['clie-invasion', 'clie-invasion-beste', 'clie-invasion-spiele'].forEach(k => S.localStorage.removeItem(k));
  S.cl.iv.zustand = 'start'; S.cl.iv.geladen = false; S.cl.iv.level = 1; S.cl.iv.punkte = 0; S.cl.iv.leben = 3;
  pruefe(S.CL_ORDNER.spiele.apps.indexOf('invasion') >= 0 && S.clApp('invasion').raster === false && /M24 16h4v4h-4z/.test(S.clSymbol('invasion')), 'Invasion im Ordner Spiele, Pixel-Gegner als Symbol');
  S.oeffne('invasion');
  let h = inhalt();
  pruefe(/<canvas id="ivFeld"[^>]*ontouchstart="ivDaumenAuf\(event\)"[^>]*ontouchend="ivDaumenWeg\(event\)"/.test(h) && /Daumen aufs Feld legen/.test(h) && /Punkte 0/.test(h) && /♥♥♥/.test(h), 'Start: Feld für den Daumen, Hinweis, Punkte und drei Leben');
  S.ivNeuesSpiel();
  const iv = S.cl.iv;
  pruefe(iv.zustand === 'laeuft' && iv.gegner.length === 40 && iv.bunker.length === 3 && iv.fy === 24 && S.document.getElementById('katKnopf').textContent === 'Level 1', 'Neues Spiel: 5 × 8 Gegner, 3 Bunker, Level 1');
  /* Schießen: das Schiff unter die unterste Reihe, Spalte 0 */
  iv.bomben = []; iv.bombUhr = -1e9; iv.ufoUhr = -1e9;
  S.ivSchiffAuf(S.ivGegnerX(iv.gegner[32]) + 5);
  let n = 0;
  while (iv.punkte === 0 && n++ < 200) { iv.schritt = 0; S.ivTakt(16); }
  pruefe(iv.punkte === 10 && !iv.gegner[32].lebt && iv.gegner.filter(g => !g.lebt).length === 1, 'der Schuss geht von selbst los: unterste Reihe 10 Punkte');
  iv.gegner[32].lebt = true; iv.punkte = 0;
  pruefe(S.IV_REIHE_PUNKTE.join() === '30,20,20,10,10', 'Punkte je Reihe: 30, 20, 20, 10, 10');
  /* Formation */
  const voll = S.ivSchrittMs();
  iv.gegner.slice(0, 30).forEach(g => { g.lebt = false; });
  pruefe(S.ivSchrittMs() < voll, 'weniger Gegner: schneller');
  iv.gegner.forEach(g => { g.lebt = true; });
  const fx = iv.fx; S.ivFormationSchritt();
  pruefe(iv.fx === fx + 3 && iv.bild === 1, 'ein Schritt seitwärts, mit Gangbild');
  iv.fx = 160 - 2 - 10 - 7 * 16; const fy = iv.fy; S.ivFormationSchritt();
  pruefe(iv.fy === fy + 6 && iv.richtung === -1, 'am Rand: eine Stufe tiefer und umkehren');
  /* Bunker */
  const vorher = iv.bunker[0].reduce((a, z) => a + z.reduce((x, y) => x + y, 0), 0);
  pruefe(S.ivBunkerTreffer(24 + 8, 170 + 4) && iv.bunker[0].reduce((a, z) => a + z.reduce((x, y) => x + y, 0), 0) < vorher, 'Treffer im Bunker: ein Loch');
  /* Bombe trifft das Schiff */
  iv.bomben = [{ x: iv.schiff, y: S.IV_SCHIFF_Y + 1 }]; iv.schuss = null;
  S.ivBombenPruefen();
  pruefe(iv.leben === 2 && iv.treffer > 0 && /♥♥♡/.test(S.ivStandZeile()), 'Bombe trifft: ein Leben weniger, das Schiff blinkt');
  const fxStill = iv.fx; S.ivTakt(500);
  pruefe(iv.fx === fxStill, 'nach einem Treffer kurz Ruhe');
  iv.treffer = 0;
  /* Bonusschiff */
  iv.ufoUhr = 22000; iv.schritt = 0; S.ivTakt(1);
  pruefe(!!iv.ufo, 'das Bonusschiff kommt von Zeit zu Zeit');
  iv.ufo = null; iv.ufoUhr = -1e9;
  /* Alle weg: nächstes Level */
  iv.gegner.forEach(g => { g.lebt = false; }); iv.schritt = 0;
  S.ivTakt(1);
  pruefe(iv.level === 2 && S.ivLebende().length === 40 && iv.fy === 30, 'alle weg: Level 2, eine Stufe tiefer');
  /* Loslassen hält an und merkt sich den Stand */
  iv.punkte = 340; iv.gegner[5].lebt = false;
  S.ivDaumenWeg({ touches: [] });
  const st = JSON.parse(S.localStorage.getItem('clie-invasion') || 'null');
  pruefe(iv.zustand === 'pause' && st && st.punkte === 340 && st.level === 2 && st.gegner[5] === 0, 'Loslassen: Pause, Spielstand auf dem Gerät');
  pruefe(/Pause/.test(inhalt()) && /ivWeiter\(\)">Weiter/.test(S.document.getElementById('fuss').innerHTML), 'Pause-Fenster, unten „Weiter“');
  /* Neu laden: das angefangene Spiel steht pausiert bereit */
  iv.geladen = false; iv.zustand = 'start'; iv.punkte = 0; iv.level = 1;
  S.ivLaden();
  pruefe(iv.zustand === 'pause' && iv.punkte === 340 && iv.level === 2 && !iv.gegner[5].lebt, 'beim nächsten Öffnen: Spielstand wieder da');
  pruefe(/pausiert · Level 2/.test(S.ordnerStandText('invasion')), 'im Ordner: „pausiert · Level 2“');
  S.ivDaumenAuf({ touches: [] });
  pruefe(iv.zustand === 'laeuft', 'Daumen wieder auf: weiter');
  S.oeffne('uebersicht');
  pruefe(iv.zustand === 'pause', 'App gewechselt: angehalten');
  S.oeffne('invasion'); S.ivWeiter();
  /* Formation unten: gelandet */
  iv.fy = 200; S.ivFormationSchritt();
  const beste = S.ivBeste();
  pruefe(iv.zustand === 'vorbei' && beste.length === 1 && beste[0].p === 340 && beste[0].l === 2 && S.ivSpiele() === 1 && !S.localStorage.getItem('clie-invasion'), 'Gegner unten: Spielende, Bestenliste, Spielstand gelöscht');
  pruefe(/Gelandet!/.test(inhalt()) && /class="neu"/.test(inhalt()) && /ivNeuesSpiel\(\)">Neues Spiel/.test(inhalt()), 'Fenster „Gelandet!“ mit markiertem Ergebnis');
  /* Letztes Leben */
  S.ivNeuesSpiel(); iv.leben = 1;
  iv.bomben = [{ x: iv.schiff, y: S.IV_SCHIFF_Y + 2 }];
  S.ivBombenPruefen();
  pruefe(iv.zustand === 'vorbei' && S.ivSpiele() === 2, 'letztes Leben weg: Spielende');
  pruefe(S.IV_TASTEN.ArrowLeft === 'links' && S.IV_TASTEN[' '] === 'start', 'am PC: Pfeile und Leertaste');
  S.oeffne('uebersicht');
}

/* ============================================================
   80. Ziele als eigene App im Ordner Planung (0.44)
   Grund: Ziele sind keine Projekte — eine einfache eigene App mit Name,
   Zieltermin, Zustand und freiem Text; Projekte zeigen nur Projekte.
   Erkennt: Ziele wieder in Projekte, falsche Sortierung nach Termin,
   Restzeit falsch, „erreicht“ nicht als abgeschlossen gespeichert,
   Schreiben führt nicht zurück, Neu ohne Ziel-Kennzeichen, App fehlt im
   Ordner Planung.
   ============================================================ */
function zieleTest() {
  console.log('\n80. Ziele als eigene App im Ordner Planung (0.44)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  S.DB.projekte.push({ id: 'p1', name: 'Carport', kontext: 'privat', status: 'laufend', flaeche: '', ordnung: 1, geaendert: 1 });
  S.DB.ziele.push({ id: 'z1', name: 'Haus auf Stand', kontext: 'privat', status: 'laufend', zieltermin: S.tagePlus(heute, 400), flaeche: '', ordnung: 1, geaendert: 1 });
  S.DB.ziele.push({ id: 'z2', name: 'Gewicht 73 kg', kontext: 'privat', status: 'laufend', zieltermin: S.tagePlus(heute, 30), flaeche: '## Warum\nKnie entlasten\n[] Waage kaufen', ordnung: 2, geaendert: 1 });
  S.DB.ziele.push({ id: 'z3', name: 'Italienisch A2', kontext: 'privat', status: 'laufend', zieltermin: '', flaeche: '', ordnung: 3, geaendert: 1 });
  S.DB.ziele.push({ id: 'z4', name: 'Alter Vorsatz', kontext: 'privat', status: 'abgeschlossen', zieltermin: '2025-01-01', flaeche: '', ordnung: 4, geaendert: 1 });
  pruefe(S.CL_ORDNER.planung.apps.indexOf('ziele') < 0 && S.clApp('ziele').raster !== false && /M20 17h22/.test(S.clSymbol('ziele')), 'Ziele seit 0.62 auf der Startseite (nicht mehr im Ordner), mit Fahne als Symbol');
  pruefe(/2 laufen|3 laufen/.test(S.ordnerStandText('ziele')) && /nächstes in 30 Tage/.test(S.ordnerStandText('ziele')), 'Stand im Ordner: Anzahl und nächstes Ziel');
  S.oeffne('projekte');
  pruefe(!/Haus auf Stand|Gewicht/.test(inhalt()) && /Carport/.test(inhalt()), 'Projekte zeigt keine Ziele mehr');
  S.pjNeu();
  pruefe(!/◇ Ziel|pjNeuWahl\('typ'/.test(S.document.getElementById('aufklapp').innerHTML), 'Neues Projekt fragt nicht mehr nach der Art');
  S.aufklappZu();
  S.oeffne('ziele');
  let h = inhalt();
  pruefe(S.document.getElementById('reiter').textContent === 'Ziele' && /pjZustandFilter|ziZustandFilter\('laeuft'\)">Laufend/.test(h) && /ziZustandFilter\('erledigt'\)">Erreicht/.test(h), 'drei Schalter Laufend · Ruhend · Erreicht');
  pruefe(h.indexOf('Gewicht') < h.indexOf('Haus auf Stand') && h.indexOf('Haus auf Stand') < h.indexOf('Italienisch') && !/Alter Vorsatz/.test(h), 'nächster Zieltermin zuerst, ohne Termin unten');
  pruefe(/Gewicht 73 kg<\/span><span class="pj-p">30 Tage/.test(h) && /Haus auf Stand<\/span><span class="pj-p">13 Mon\./.test(h) && /Italienisch A2<\/span><span class="pj-p">—/.test(h), 'rechts die Restzeit: Tage, Monate oder —');
  S.ziZustandFilter('erledigt');
  pruefe(/Alter Vorsatz/.test(inhalt()) && !/Gewicht/.test(inhalt()), 'Erreicht: abgeschlossene Ziele');
  S.ziOeffnen('z2');
  h = inhalt();
  pruefe(/noch 30 Tage/.test(h) && /memo-h1">Warum|memo-h2">Warum/.test(h) && /Waage kaufen/.test(h) && !/memo-kopf/.test(h), 'Ein Ziel: Zieltermin mit Restzeit, darunter der Text (mit Aufgaben)');
  pruefe(/ziSchreiben\(\)/.test(S.document.getElementById('fuss').innerHTML) && /ziDetails\(\)/.test(S.document.getElementById('fuss').innerHTML), 'unten Fertig, Schreiben, Details…');
  S.ziSchreiben();
  pruefe(S.cl.app === 'memo' && S.cl.memo.schreiben && S.cl.memo.ausZiel === 'z2', '„Schreiben“ im Schreibfeld');
  S.memoSchreibenUm();
  pruefe(S.cl.app === 'ziele' && S.cl.zi.id === 'z2' && !S.cl.memo.ausZiel, '„Fertig“ führt zurück ins Ziel');
  S.ziDetails();
  S.document.getElementById('ziTitel').value = 'Gewicht 72 kg';
  S.document.getElementById('ziTermin').value = '2027-06-30';
  S.ziWahl('zustand', 'erledigt');
  S.ziSpeichern();
  const z2 = S.DB.ziele[1];
  pruefe(z2.name === 'Gewicht 72 kg' && z2.zieltermin === '2027-06-30' && z2.status === 'abgeschlossen', 'Details: Name, Zieltermin; „erreicht“ = abgeschlossen in der Workbench');
  S.ziZurListe();
  pruefe(S.cl.zi.zustand === 'erledigt' && /Gewicht 72 kg/.test(inhalt()), 'zurück: Liste „Erreicht“');
  S.ziNeu();
  pruefe(/Neues Ziel/.test(S.document.getElementById('aufklapp').innerHTML) && !/ziWahl\('zustand'/.test(S.document.getElementById('aufklapp').innerHTML), 'Neu: Name, Zieltermin, Kategorie');
  S.document.getElementById('ziTitel').value = 'Halbmarathon';
  S.document.getElementById('ziTermin').value = '2027-06-20';
  S.ziSpeichern();
  const neu = S.DB.ziele[S.DB.ziele.length - 1];
  pruefe(neu.name === 'Halbmarathon' && neu.zieltermin === '2027-06-20' && neu.status === 'laufend' && S.cl.zi.id === neu.id, 'Neu legt ein Ziel in DB.ziele an und öffnet es');
  S.clZurueck();
  pruefe(S.cl.app === 'ziele' && !S.cl.zi.id, 'Zurück: vom Ziel zur Liste');
  S.clZurueck();
  pruefe(S.cl.app === 'uebersicht' && S.cl.aufklapp !== 'ordner', 'noch einmal Zurück: zur Übersicht (seit 0.62 nicht mehr im Ordner)');
  S.aufklappZu();
  S.seiteOeffnen('z1');
  pruefe(S.cl.app === 'ziele' && S.cl.zi.id === 'z1', 'Lesezeichen, Suche und Verweise öffnen Ziele in Ziele');
  S.oeffne('uebersicht');
}

/* ============================================================
   79. Projekte wie „Projects“ am Palm (0.43)
   Grund: Ein Projekt mit Angeboten, Rückmeldungen, Notizen, Meilensteinen
   und Aufgaben war als eine lange Memo-Seite nicht mehr zu ordnen. Seit
   0.43 eine eigene App: Liste mit Priorität, erledigt/gesamt, Zustand,
   ✎ — und je Projekt drei Reiter Allgemein · Aufgaben · Memo. Daten der
   Workbench (start, ende, meilensteine, flaeche); neu nur „prio“.
   Erkennt: falsche Sortierung, Priorität nicht gespeichert, Beginn/Ende
   im falschen Feld, Meilensteine nicht im Workbench-Format, Aufgaben im
   Memo-Reiter, Schreiben führt nicht zurück ins Projekt, Ziele mit
   Meilensteinen, Coach nicht im Ordner Planung, Symbol fehlt.
   ============================================================ */
function projekteTest() {
  console.log('\n79. Projekte wie „Projects“ am Palm (0.43)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.DB.projekte.push({ id: 'p1', name: 'Carport', kontext: 'privat', status: 'laufend', start: '2026-09-01', ende: '2027-04-30', ordnung: 1,
    meilensteine: [{ id: 'm1', titel: 'Vermessung', datum: '2026-09-12', erreicht: true }],
    flaeche: '## Angebote\nHuber 14.200\n[] Huber nachfassen\n[x] Angebote anfragen\n[] Statik klären', geaendert: 1 });
  S.DB.projekte.push({ id: 'p2', name: 'Heizung', kontext: 'privat', status: 'laufend', flaeche: '[] Termin', ordnung: 2, prio: 1, geaendert: 1 });
  S.DB.projekte.push({ id: 'p3', name: 'Keller', kontext: 'privat', status: 'ruht', flaeche: '', ordnung: 3, geaendert: 1 });
  S.DB.ziele.push({ id: 'z1', name: 'Fit bis Sommer', kontext: 'privat', status: 'laufend', zieltermin: '2027-06-30', flaeche: '', ordnung: 4, geaendert: 1 });
  S.oeffne('projekte');
  let h = inhalt();
  pruefe(S.document.getElementById('reiter').textContent === 'Projekte' && h.indexOf('Heizung') < h.indexOf('Carport') && !/Keller/.test(h) && !/Fit bis Sommer/.test(h),
    'Liste „Laufend“: P1 zuerst, Ruhendes nicht, Ziele nicht (seit 0.44 eigene App)');
  /* Seit 0.43.2 schlicht: nur der Name, die Priorität nur wenn gesetzt */
  pruefe(/<button type="button" class="pj-zeile" onclick="pjOeffnen\('p1','inhalt'\)"><span class="pj-n">Carport<\/span><\/button>/.test(h)
    && /<span class="pj-n">Heizung<\/span><span class="pj-p">P1<\/span>/.test(h) && !/◇|✎|<small>\d+\/\d+|·</.test(h.replace(/<p class="leise">[\s\S]*$/, '')),
    'Zeile nur mit Namen — ohne Punkt, Zeichen, Aufgabenzahl und ✎; „P1“ nur wenn gesetzt');
  pruefe(/pjOeffnen\('p2','inhalt'\)/.test(h) && !/'aufgaben'\)">/.test(h), 'Tipp auf ein Projekt öffnet „Inhalt“ (seit 0.46.1)');
  S.seiteOeffnen('p2');
  pruefe(S.cl.app === 'projekte' && S.cl.pj.reiter === 'inhalt', 'auch Lesezeichen, Suche und Verweise landen bei „Inhalt“');
  S.oeffne('projekte');
  S.pjOeffnen('p1', 'allgemein'); S.pjWahl('prio', '1');
  pruefe(S.DB.projekte[0].prio === 1, 'Priorität im Reiter Allgemein (am Satz als „prio“)');
  S.pjWahl('prio', '0');
  pruefe(!('prio' in S.DB.projekte[0]), '„–“: Feld wieder weg');
  /* Reiter Aufgaben */
  S.pjOeffnen('p1', 'aufgaben');
  h = inhalt();
  pruefe(/class="pj-reiter"><button type="button" onclick="pjReiter\('inhalt'\)">Inhalt<\/button><button type="button" onclick="pjReiter\('meilensteine'\)">Meilensteine<\/button><button type="button" class="an" onclick="pjReiter\('aufgaben'\)">Aufgaben<\/button><button type="button" onclick="pjReiter\('allgemein'\)">Allgemein<\/button><\/div>/.test(h),
    'vier Reiter (seit 0.46.1): Inhalt · Meilensteine · Aufgaben · Allgemein — Aufgaben gewählt');
  pruefe(h.indexOf('Huber nachfassen') < h.indexOf('Statik klären') && h.indexOf('Statik klären') < h.indexOf('Angebote anfragen') && !/Huber 14\.200/.test(h),
    'Aufgaben: offene oben, erledigte darunter, kein Text');
  S.memoHaken('p1', 2);
  pruefe(/\[x\] Huber nachfassen/.test(S.DB.projekte[0].flaeche), 'abhaken im Reiter Aufgaben');
  S.pjAufgabeNeu();
  pruefe(S.cl.aufklapp === 'aufgabe' && S.cl.auf.fenster.seite === 'p1', '„Neu“: Aufgabe gleich im Projekt');
  S.aufklappZu();
  /* Reiter Memo */
  S.pjReiter('inhalt');
  h = inhalt();
  pruefe(/Huber 14\.200/.test(h) && /memo-h2">Angebote/.test(h) && !/nachfassen|Statik/.test(h) && /pjSchreiben\(\)">Schreiben/.test(S.document.getElementById('fuss').innerHTML), 'Inhalt: Text und Überschriften, ohne Aufgaben; unten „Schreiben“');
  S.pjSchreiben();
  pruefe(S.cl.app === 'memo' && S.cl.memo.schreiben && /id="memoFeld"[^>]*>[^<]*Statik klären/.test(inhalt()), '„Schreiben“: ganzer Text im Schreibfeld');
  S.memoSchreibenUm();
  pruefe(S.cl.app === 'projekte' && S.cl.pj.id === 'p1' && S.cl.pj.reiter === 'inhalt' && !S.cl.memo.ausProjekt, '„Fertig“ führt zurück in den Reiter Inhalt');
  /* Reiter Allgemein */
  S.pjReiter('allgemein');
  h = inhalt();
  pruefe(/id="pjBeginn"[^>]*value="2026-09-01"/.test(h) && /Ende:<input id="pjEnde"[^>]*value="2027-04-30"/.test(h) && !/Vermessung|Meilensteine <span>/.test(h) && !/pjMsAuf/.test(S.document.getElementById('fuss').innerHTML),
    'Allgemein: Beginn und Ende aus den Workbench-Feldern — Meilensteine seit 0.46.1 im eigenen Reiter');
  S.document.getElementById('pjBeginn').value = '2026-10-01'; S.pjFeld('beginn');
  S.document.getElementById('pjEnde').value = '2027-05-15'; S.pjFeld('ende');
  S.document.getElementById('pjEnde').value = 'kaputt'; S.pjFeld('ende');
  pruefe(S.DB.projekte[0].start === '2026-10-01' && S.DB.projekte[0].ende === '2027-05-15', 'Beginn → start, Ende → ende; Unlesbares wird nicht übernommen');
  S.pjWahl('zustand', 'ruht'); S.pjWahl('kontext', 'beruflich'); S.pjWahl('prio', '2');
  pruefe(S.DB.projekte[0].status === 'ruht' && S.DB.projekte[0].kontext === 'beruflich' && S.DB.projekte[0].prio === 2, 'Zustand, Kategorie, Priorität');
  S.pjWahl('zustand', 'laeuft'); S.pjWahl('kontext', 'privat');
  S.pjReiter('meilensteine');
  pruefe(/Vermessung/.test(inhalt()) && /Meilensteine <span>1\/1/.test(inhalt()) && /pjMsAuf\(''\)">\+ Meilenstein/.test(S.document.getElementById('fuss').innerHTML), 'Reiter Meilensteine: Liste und „+ Meilenstein“');
  S.pjMsAuf('');
  S.document.getElementById('pjMsTitel').value = 'Auftrag vergeben'; S.document.getElementById('pjMsDatum').value = '2026-11-15';
  S.pjMsSpeichern();
  const ms = S.DB.projekte[0].meilensteine;
  pruefe(ms.length === 2 && ms[1].titel === 'Auftrag vergeben' && ms[1].datum === '2026-11-15' && ms[1].erreicht === false && !!ms[1].id, 'Meilenstein im Format der Workbench (id, titel, datum, erreicht)');
  S.pjMsUm(ms[1].id);
  pruefe(ms[1].erreicht === true && /Meilensteine <span>2\/2/.test(inhalt()), 'Tipp auf ◆: erreicht');
  S.pjMsAuf(ms[1].id);
  S.pjMsLoeschen();
  pruefe(S.DB.projekte[0].meilensteine.length === 1, 'Meilenstein löschen');
  /* Ziel: seit 0.44 in der App Ziele */
  S.pjOeffnen('z1', 'allgemein');
  pruefe(S.cl.app === 'ziele' && S.cl.zi.id === 'z1', 'ein Ziel öffnet in der App Ziele');
  S.pjOeffnen('p1', 'allgemein');
  /* Zurück und Neu */
  S.clZurueck();
  pruefe(S.cl.app === 'projekte' && !S.cl.pj.id, 'Zurück: vom Projekt zur Liste');
  S.pjNeu();
  S.document.getElementById('pjNeuTitel').value = 'Terrassendach';
  S.pjNeuSpeichern();
  const neu = S.DB.projekte[S.DB.projekte.length - 1];
  pruefe(neu.name === 'Terrassendach' && neu.start === S.isoDatum() && S.cl.pj.id === neu.id && S.cl.pj.reiter === 'allgemein', 'Neu: Beginn heute, öffnet Allgemein');
  /* Start, Ordner, Symbol */
  pruefe(S.CL_ORDNER.planung.apps.indexOf('coach') >= 0 && S.clOrdnerVon('coach') === 'planung', 'Coach im Ordner Planung');
  pruefe(/<rect x="15" y="18" width="16" height="6"/.test(S.clSymbol('projekte')), 'Symbol „Zeitplan“ (drei versetzte Balken)');
  S.oeffne('uebersicht');
  pruefe(/oeffne\('projekte'\)/.test(inhalt()) && />Notizen<\/button>/.test(inhalt()), 'Übersicht: Projekte und „Notizen“ statt Memo');
}

/* ============================================================
   78. Lesezeichen hinzufügen: Gruppen als Dropdown (0.42)
   Grund: Die Auswahl war eine Endlosliste über alle Gruppen — jetzt
   wie im Memo ein Knopf „▼ Gruppe“, darunter nur deren Einträge.
   Erkennt: wieder alle Gruppen untereinander, leere Gruppen wählbar,
   Wahl wirkt nicht, Häkchen fehlen, Endlosliste bei offenem Dropdown.
   ============================================================ */
function lzGruppenTest() {
  console.log('\n78. Lesezeichen hinzufügen: Gruppen als Dropdown (0.42)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.DB.projekte.push({ id: 'p1', name: 'Carport', flaeche: '', status: 'laufend', kontext: 'privat', geaendert: 1 });
  S.DB.themen.push({ id: 'l1', name: 'Haus', kontext: 'privat', text: '[] x', geaendert: 1 });
  S.DB.sammlungen = [{ id: 's1', name: 'Abos', felder: [], rollen: {}, geaendert: 1 }];
  S.DB.pinnwand = [];
  S.oeffne('lesezeichen'); S.lzNeuAuf();
  let f = S.document.getElementById('aufklapp').innerHTML;
  pruefe(/onclick="lzGruppeUm\(\)">▼ Projekte/.test(f) && /☐ ◎ Carport/.test(f) && !/Haus|Abos/.test(f), 'ein Dropdown-Knopf, darunter nur die Einträge der ersten Gruppe');
  pruefe(!/class="gruppe"/.test(f), 'keine Endlosliste mit Zwischenüberschriften mehr');
  S.lzGruppeUm();
  f = S.document.getElementById('aufklapp').innerHTML;
  const namen = S.lzNeuGruppen().map(g => g[1]);
  pruefe(/lzGruppeSetzen\('listen'\)/.test(f) && /lzGruppeSetzen\('sammlungen'\)/.test(f) && !/Carport/.test(f), 'offen: Gruppenwahl statt Einträge');
  pruefe(namen.indexOf('Ziele') < 0 && S.lzNeuGruppen().every(g => g[2].length > 0), 'leere Gruppen (hier Ziele) erscheinen nicht');
  S.lzGruppeSetzen('listen');
  f = S.document.getElementById('aufklapp').innerHTML;
  pruefe(/▼ Listen/.test(f) && /☐ ≡ Haus/.test(f) && !/Carport/.test(f) && !S.cl.lzGruppeOffen, 'Wahl „Listen“ zeigt die Listen');
  S.lzUm('liste', 'l1');
  f = S.document.getElementById('aufklapp').innerHTML;
  pruefe(/☑ ≡ Haus/.test(f) && /▼ Listen/.test(f), 'Antippen hakt an, Gruppe bleibt gewählt');
  S.lzGruppeUm();
  pruefe(/Listen <span class="leise">1 · 1 ☆/.test(S.document.getElementById('aufklapp').innerHTML), 'Gruppenwahl zeigt, wie viele schon Lesezeichen sind');
  S.lzGruppeSetzen('gibtsnicht');
  pruefe(/▼ Projekte/.test(S.document.getElementById('aufklapp').innerHTML), 'unbekannte Gruppe fällt auf die erste zurück');
  S.aufklappZu();
  S.oeffne('uebersicht');
}

/* ============================================================
   77. Bildlaufleiste wie am Palm (0.41)
   Grund: Lange Seiten sollen rechts eine sichtbare Leiste haben (▲,
   Schieber, ▼) — Android zeigt nur kurz eine dünne. Rollen mit dem
   Finger und seitliches Wischen bleiben.
   Erkennt: Leiste bei kurzen Seiten, keine Leiste bei langen, Schieber
   an falscher Stelle, ▲/▼ blättern nicht, Inhalt nicht eingerückt.
   ============================================================ */
function rollbarTest() {
  console.log('\n77. Bildlaufleiste wie am Palm (0.41)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const el = S.document.getElementById('inhalt');
  const rb = S.document.getElementById('rollbar');
  const bahn = S.document.getElementById('rbBahn');
  const sch = S.document.getElementById('rbSchieber');
  pruefe(/<div class="rollbar" id="rollbar"[^>]*><button[^>]*onclick="rbSeite\(-1\)"[^>]*>▲<\/button><div class="rb-bahn" id="rbBahn"[^>]*><i id="rbSchieber"[^>]*><\/i><\/div><button[^>]*onclick="rbSeite\(1\)"[^>]*>▼<\/button><\/div>/.test(QUELLE), 'Leiste in der Hülle: ▲, Bahn mit Schieber, ▼');
  el.scrollHeight = 500; el.clientHeight = 600; el.scrollTop = 0; el.offsetTop = 110;
  S.rbAktualisieren();
  pruefe(!rb.classList.contains('auf') && !el.classList.contains('mitbar'), 'kurze Seite: keine Leiste');
  el.scrollHeight = 2400; bahn.clientHeight = 544;
  S.rbAktualisieren();
  pruefe(rb.classList.contains('auf') && el.classList.contains('mitbar') && rb.style.top === '110px' && rb.style.height === '600px', 'lange Seite: Leiste neben dem Inhalt, Inhalt rückt ein');
  pruefe(sch.style.height === '136px' && sch.style.top === '0px', 'Schieber oben, Größe ~ sichtbarer Anteil (600 von 2400)');
  S.rbSeite(1);
  pruefe(el.scrollTop === 560 && sch.style.top === Math.round((544 - 136) * 560 / 1800) + 'px', '▼ blättert eine Seite (abzüglich einer Zeile Überlappung)');
  S.rbSeite(-1); S.rbSeite(-1);
  pruefe(el.scrollTop === 0, '▲ blättert zurück, nicht über den Anfang');
  el.scrollTop = 1800; S.rbAktualisieren();
  pruefe(sch.style.top === (544 - 136) + 'px', 'am Ende: Schieber unten');
  /* Ziehen */
  el.scrollTop = 0; sch.offsetHeight = 136;
  S.rbZiehenStart({ clientY: 200, preventDefault() {}, stopPropagation() {} });
  S.rbZiehen({ clientY: 302 });
  S.rbZiehenEnde();
  pruefe(Math.round(el.scrollTop) === Math.round(102 * 1800 / 408) && S.rbZieht === null, 'Schieber ziehen rollt mit');
  pruefe(/\.inhalt\.mitbar\{padding-right:26px/.test(QUELLE) && /wischAnfang|ontouchstart/.test(SKRIPT), 'Inhalt eingerückt; Wischen bleibt unberührt');
  el.scrollHeight = 0; el.clientHeight = 0; S.rbAktualisieren();
}

/* ============================================================
   76. Arten im Termin-Fenster (0.40)
   Grund: Beim Anlegen oder Ändern eines Google-Termins sollen die Arten
   für den Jahreskalender (mehrere) direkt wählbar sein — als #Kürzel in
   der Notiz, damit sie in Google, CLIE und Workbench gelten.
   Erkennt: Knöpfe fehlen, Kürzel nicht geschrieben/entfernt, Mehrzahl-
   Kürzel (#Besuch) nicht erkannt, Notiztext beschädigt, Kürzel landet
   nicht in der Beschreibung des Termins.
   ============================================================ */
function terminArtenTest() {
  console.log('\n76. Arten im Termin-Fenster (0.40)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.schreibKalender = [{ id: 'k', name: 'Privat', primary: true }];
  S.oeffne('kalender');
  S.cl.termin = { modus: 'neu', t: null, vorschlag: { titel: '', datum: S.isoDatum(), von: '10:00', bis: '11:00', ganztags: false, kalId: 'k', ort: '', notiz: '' } };
  S.cl.aufklapp = 'termin'; S.aufklappNeu();
  const f = S.document.getElementById('aufklapp').innerHTML;
  pruefe(/Arten \(Jahreskalender\)/.test(f) && /terminArtUm\('besuche'\)/.test(f) && /terminArtUm\('geburtstag'\)/.test(f), 'Termin-Fenster: Arten als Knöpfe');
  const notiz = S.document.getElementById('terminNotiz');
  const titel = S.document.getElementById('terminTitel');
  titel.value = 'Brunch bei Sabine'; notiz.value = 'Bitte Kuchen mitbringen';
  S.terminArtUm('besuche');
  pruefe(notiz.value === 'Bitte Kuchen mitbringen\n#Besuche', 'Besuche an: #Besuche in einer neuen Zeile');
  S.terminArtUm('feier');
  pruefe(notiz.value === 'Bitte Kuchen mitbringen\n#Besuche #Feier', 'zweite Art dazu: #Besuche #Feier');
  pruefe(/class="an" onclick="terminArtUm\('besuche'\)"/.test(S.document.getElementById('terminArten').innerHTML) && /class="an" onclick="terminArtUm\('feier'\)"/.test(S.document.getElementById('terminArten').innerHTML), 'beide Knöpfe an');
  S.terminArtUm('besuche');
  pruefe(notiz.value === 'Bitte Kuchen mitbringen\n#Feier', 'Besuche aus: Kürzel heraus, Text bleibt');
  notiz.value = 'alt #Besuch'; S.terminArtenNeu();
  pruefe(/class="an" onclick="terminArtUm\('besuche'\)"/.test(S.document.getElementById('terminArten').innerHTML), '#Besuch (Einzahl) gilt als Besuche');
  S.terminArtUm('besuche');
  pruefe(notiz.value === 'alt', '… und lässt sich ebenso abschalten');
  titel.value = 'Urlaub #Urlaub'; notiz.value = '';
  S.terminArtUm('urlaub');
  pruefe(notiz.value === '', 'steht die Art schon im Titel, wird sie nicht doppelt eingetragen');
  /* Was an Google geht */
  titel.value = 'Kino'; notiz.value = 'mit Petra'; S.terminArtUm('besuche');
  const e = S.terminAusFenster();
  pruefe(e.koerper.description === 'mit Petra\n#Besuche' && S.jaTerminArten({ titel: 'Kino', beschreibung: e.koerper.description }).join() === 'besuche', 'die Beschreibung des Termins trägt das Kürzel — der Jahreskalender erkennt es');
  S.aufklappZu();
  S.oeffne('uebersicht');
}

/* ============================================================
   75. Lesezeichen, Schreibleiste, Jahr in Graustufen (0.38)
   Grund: Die Pinnwand der Workbench war der Direktzugriff — in CLIE als
   „Lesezeichen“ (Liste, ohne Pins und Farben) unten in der Leiste statt
   „Heute“. Die Schreibleiste im Memo bekam alles, was die Workbench
   konnte (aber nicht mehr). Der Jahreskalender ohne Farben.
   Erkennt: Lesezeichen ohne Ziel sichtbar, Workbench-Zettel (g:) nicht
   erkannt, Reihenfolge/Entfernen wirkungslos, Grabstein fehlt,
   Schreibleiste setzt falsche Zeichen, Farben im Jahr.
   ============================================================ */
function lesezeichenTest() {
  console.log('\n75. Lesezeichen, Schreibleiste, Jahr in Graustufen (0.38)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.cl.lz.bearbeiten = false;
  S.DB.projekte.push({ id: 'p1', name: 'Carport', flaeche: '[] a\n[] b\n[] c', status: 'laufend', kontext: 'privat', geaendert: 1 });
  S.DB.gedanken.push({ id: 'n1', titel: 'WLAN, Zugänge', text: 'x', ordnung: 1, kontext: 'privat', geaendert: 1 });
  S.DB.gedanken.push({ id: 'c1', titel: 'Urlaub packen', text: '[x] a\n[] b', checkliste: 'lauf', ordnung: 2, kontext: 'privat', geaendert: 1 });
  S.DB.themen.push({ id: 'l1', name: 'Haus', kontext: 'beruflich', text: '[] x', geaendert: 1 });
  S.DB.sammlungen = [{ id: 's1', name: 'Abos', felder: [], rollen: {}, geaendert: 1 }];
  S.DB.datensaetze = [{ id: 'd1', sammlung: 's1', werte: {}, angelegt: 1, geaendert: 1 }];
  /* Bestand der Workbench-Pinnwand: Notiz mit g:-Kennung, Projekt, eine unbekannte Aufgabe */
  S.DB.pinnwand = [{ id: 'w1', art: 'flaeche', zielId: 'g:n1', farbe: 'gelb', ordnung: 20, geaendert: 1 },
                   { id: 'w2', art: 'projekt', zielId: 'p1', farbe: 'blau', ordnung: 10, geaendert: 1 },
                   { id: 'w3', art: 'aufgabe', zielId: 'xx', farbe: 'gelb', ordnung: 5, geaendert: 1 }];
  S.oeffne('lesezeichen');
  let h = inhalt();
  pruefe(/Carport/.test(h) && /WLAN, Zugänge/.test(h) && h.indexOf('Carport') < h.indexOf('WLAN') && !/xx/.test(h), 'Workbench-Zettel erscheinen als Lesezeichen (Reihenfolge übernommen, Unbekanntes still weg)');
  pruefe(/3 offen/.test(h) && !/farbe|zettel|z-nadel/i.test(h), 'schlichte Liste mit Stand, ohne Pins und Farben');
  pruefe(S.document.getElementById('reiter').textContent === 'Lesezeichen' && /lzBearbeitenUm/.test(S.document.getElementById('fuss').innerHTML), 'App „Lesezeichen“ mit „Bearbeiten“');
  /* Hinzufügen */
  S.lzBearbeitenUm(); S.lzNeuAuf();
  const f = S.document.getElementById('aufklapp').innerHTML;
  pruefe(/▼ Projekte/.test(f) && /☑ ◎ Carport/.test(f), 'Hinzufügen: erste Gruppe (Projekte) — Vorhandenes angehakt (Gruppen-Dropdown: Kategorie 78)');
  S.lzUm('liste', 'l1'); S.lzUm('flaeche', 'c1'); S.lzUm('sammlung', 's1'); S.lzUm('jahrliste', 'geburtstag');
  S.aufklappZu(); S.lzBearbeitenUm();
  h = inhalt();
  pruefe(/Haus/.test(h) && /Urlaub packen/.test(h) && /1\/2/.test(h) && /Abos/.test(h) && /Geburtstag/.test(h) && /Jahr ▸ Liste/.test(h), 'Liste, Checkliste (1/2), Sammlung und Jahresliste als Lesezeichen');
  pruefe(S.DB.pinnwand.filter(p => p.art === 'flaeche' && p.zielId === 'g:c1').length === 1, 'Checkliste wie in der Workbench als „flaeche“ mit g:-Kennung');
  S.lzUm('liste', 'l1'); S.lzUm('liste', 'l1');
  pruefe(S.DB.pinnwand.filter(p => p.art === 'liste').length === 1, 'zweimal tippen: entfernen und wieder hinzufügen');
  /* Filter Beruf/Privat */
  S.katSetzen('privat');
  pruefe(!/Haus/.test(inhalt()) && /Carport/.test(inhalt()), 'Filter ▼: Privat zeigt keine beruflichen Lesezeichen');
  S.katSetzen('alle');
  /* Öffnen */
  const id = n => S.DB.pinnwand.filter(p => p.zielId === n)[0].id;
  S.lzOeffnen(id('l1')); pruefe(S.cl.app === 'checklisten' && S.cl.cls.id === 'l1', 'Liste öffnet in Checklisten (0.49)');
  S.lzOeffnen(id('g:c1')); pruefe(S.cl.app === 'checklisten' && S.cl.cls.id === 'c1', 'Checkliste öffnet in Checklisten');
  S.lzOeffnen(id('p1')); pruefe(S.cl.app === 'projekte' && S.cl.pj.id === 'p1', 'Projekt öffnet in Projekte (seit 0.43)');
  S.lzOeffnen(id('s1')); pruefe(S.cl.app === 'sammlungen' && S.cl.sa.id === 's1', 'Sammlung öffnet');
  S.lzOeffnen(id('geburtstag')); pruefe(S.cl.app === 'kalender' && S.cl.kal.ansicht === 'jahr' && S.cl.ja.ansicht === 'liste' && S.cl.ja.filter === 'geburtstag', 'Jahresliste öffnet den Kalender bei „Geburtstag“');
  S.clKalAnsicht('tag');
  /* Bearbeiten: schieben, entfernen */
  S.oeffne('lesezeichen'); S.lzBearbeitenUm();
  const erste = S.lzSichtbar()[0].id; const zweite = S.lzSichtbar()[1].id;
  S.lzSchieben(erste, 1);
  pruefe(S.lzSichtbar()[0].id === zweite && S.lzSichtbar()[1].id === erste, '▼ verschiebt nach unten');
  S.lzWeg(erste);
  pruefe(!S.DB.pinnwand.some(p => p.id === erste) && (S.DB.grabsteine || []).some(g => g.s === 'pinnwand' && g.id === erste), '✕ entfernt (mit Grabstein)');
  S.lzBearbeitenUm();
  /* Schreibleiste */
  S.oeffne('memo'); S.memoOeffnen('n1'); S.memoSchreibenUm();
  const leiste = inhalt();
  pruefe(S.MEMO_LEISTE.length === 13 && S.MEMO_LEISTE.every(k => leiste.indexOf("memoZeichen('" + k[0] + "')") >= 0), 'Schreibleiste mit 13 Knöpfen');
  const feld = S.document.getElementById('memoFeld');
  const satz = (text, a, e) => { feld.value = text; feld.selectionStart = a; feld.selectionEnd = e === undefined ? a : e; };
  satz('Zeile', 2); S.memoZeichen('nicht'); pruefe(feld.value === '[-] Zeile', '[–]: nicht relevant');
  S.memoZeichen('kasten'); pruefe(feld.value === '[] Zeile', '[ ] macht aus [-] eine Aufgabe');
  satz('Zeile', 0); S.memoZeichen('zahl'); pruefe(feld.value === '1. Zeile', '1.: Nummerierung');
  satz('- Punkt', 3); S.memoZeichen('ein'); pruefe(feld.value === '  - Punkt', '→ rückt ein');
  S.memoZeichen('aus'); pruefe(feld.value === '- Punkt', '← rückt aus');
  satz('ein Wort hier', 4, 8); S.memoZeichen('fett'); pruefe(feld.value === 'ein **Wort** hier', 'F: fett um die Auswahl');
  satz('ein Wort hier', 4, 8); S.memoZeichen('unter'); pruefe(feld.value === 'ein __Wort__ hier', 'U: unterstrichen');
  satz('ein Wort hier', 4, 8); S.memoZeichen('durch'); pruefe(feld.value === 'ein ~~Wort~~ hier', 'S: durchgestrichen');
  satz('Angebot', 0, 7); S.memoZeichen('link'); pruefe(feld.value === '[Angebot](https://)', 'Link: [Text](https://)');
  satz('oben', 4); S.memoZeichen('trenner'); pruefe(feld.value === 'oben\n---', 'Trenner');
  satz('oben', 4); S.memoZeichen('tabelle'); pruefe(/^oben\n\| Spalte 1 \| Spalte 2 \|\n\|---\|---\|\n\|  \|  \|$/.test(feld.value), 'Tabelle als Vorlage');
  pruefe(S.DB.gedanken.filter(g => g.id === 'n1')[0].text === feld.value, 'das Getippte landet in der Seite');
  satz('x', 1); let verhindert = false; S.memoTaste({ key: 'Tab', shiftKey: false, preventDefault() { verhindert = true; } });
  pruefe(verhindert && feld.value === '  x', 'Tab rückt ein (am PC)');
  pruefe(/\.geraet\.schreibbreit\{max-width:900px\}/.test(QUELLE) && /classList\.add\('schreibbreit'\)/.test(QUELLE), 'am PC beim Schreiben breiter');
  S.memoSchreibenUm();
  /* Jahr ohne Farben */
  pruefe(Object.keys(S.JA_ARTEN).every(k => ['#1C2116', '#56604A', '#8E9A7C'].indexOf(S.JA_ARTEN[k].f) >= 0) && S.jaArtFarbe('training') === '#56604A', 'Jahr: nur drei Graustufen, keine Farben');
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
  pruefe(gruppen.join(',') === 'Termine,Aufgaben,Projekte & Notizen,Checklisten,Sammlungen,Routinen', 'Gruppen in fester Reihenfolge — ' + gruppen.join(','));
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
  pruefe(S.cl.app === 'projekte' && S.cl.pj.id === 'p1', 'Projekt-Treffer öffnet das Projekt (seit 0.43)');
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
    pruefe(['kpPrio', 'kpPrioSetzenKern'].every(n => funktionText(SKRIPT, n) === funktionText(WB_QUELLE, n)), 'Kern-Funktionen wörtlich wie in der Workbench (kpPrioText seit 0.49 mit fünf Stufen)');
    pruefe(/var KP_PRIO = \/\^\[P\]\(\[1-5\]\)/.test(SKRIPT) && /p <= 5\) \? 'P' \+ p/.test(SKRIPT), 'fünf Stufen: P1 … P5 werden erkannt und geschrieben (0.49)');
  }
  const heute = S.isoDatum();
  S.DB.themen.push({ id: 'l1', name: 'Haus', text: '[] Keller aufräumen\n[] P2 Rasen vertikutieren\n[] P1 Statik anfragen\n[] P3 Ablage', kontext: 'privat', geaendert: 1 });
  S.DB.tage.push({ id: 'tag-' + heute, datum: heute, text: '[] Keller aufräumen\n[] P2 Rasen vertikutieren', geaendert: 1, eintraege: [
    { id: 'e1', abschnitt: 'h', text: 'Keller aufräumen', quelle: 'l1', erledigt: false },
    { id: 'e2', abschnitt: 'h', text: 'P2 Rasen vertikutieren', quelle: 'l1', erledigt: false }] });
  S.cl.auf.ansicht = 'prio'; S.cl.auf.naechste = false;
  S.oeffne('aufgaben');
  let h = inhalt();
  const reihe = (h.match(/class="tx umbruch[^"]*"[^>]*>([^<]+)</g) || []).map(x => x.replace(/.*>/, '').replace(/<$/, ''));
  /* seit 0.49: heute Eingeplantes zuerst, dann P (ohne Kürzel = 3) */
  pruefe(reihe.join(' | ') === 'Rasen vertikutieren | Keller aufräumen | Statik anfragen | Ablage', 'nach Priorität sortiert (heute Geplantes zuerst), ohne Kürzel im Text — ' + reihe.join(' | '));
  pruefe(/class="prio p1" onclick="aufPrioUm\('l1',2\)"[^>]*>1</.test(h) && /class="prio p3 still" onclick="aufPrioUm\('l1',0\)"[^>]*>3<\/button>/.test(h), 'Zeichen 1 … und ohne Kürzel eine leise 3');
  S.aufAnsicht('gruppiert');
  const reihe2 = (inhalt().match(/class="tx umbruch[^"]*"[^>]*>([^<]+)</g) || []).map(x => x.replace(/.*>/, '').replace(/<$/, ''));
  pruefe(reihe2[0] === 'Keller aufräumen' && S.cl.auf.ansicht === 'gruppiert', 'Gruppiert (seit 0.17 statt „↕ Liste“): Reihenfolge wie in der Liste');
  S.aufAnsicht('prio');

  /* Antippen schaltet weiter — die Einplanung im Tag zieht mit */
  S.aufPrioUm('l1', 0);
  pruefe(/\[\] P4 Keller aufräumen/.test(S.DB.themen[0].text) && S.DB.tage[0].eintraege[0].text === 'P4 Keller aufräumen', 'Antippen: 3 → 4, auch im eingeplanten Tag (0.49)');
  S.aufPrioUm('l1', 0); S.aufPrioUm('l1', 0);
  pruefe(/\[\] P1 Keller aufräumen/.test(S.DB.themen[0].text) && /\[\] P1 Keller aufräumen/.test(S.DB.tage[0].text) && S.DB.tage[0].eintraege[0].text === 'P1 Keller aufräumen',
    '4 → 5 → 1: rundum, auch im eingeplanten Tag');
  S.aufPrioUm('l1', 1);
  pruefe(/\[\] Rasen vertikutieren/.test(S.DB.themen[0].text) && S.DB.tage[0].eintraege[1].text === 'Rasen vertikutieren', '2 → 3 entfernt das Kürzel (3 ist die Vorgabe)');

  /* Fenster */
  S.aufDetails('l1', 2);
  pruefe(S.cl.auf.fenster.text === 'Statik anfragen' && S.cl.auf.fenster.prio === 1 && /onclick="aufPrioWahl\(1\)">1/.test(S.aufFensterHtml()) && /class="an" onclick="aufPrioWahl\(1\)"/.test(S.aufFensterHtml()),
    'Details: Text ohne Kürzel, Priorität als Wahl');
  S.document.getElementById('aufText').value = 'Statik anfragen';
  S.aufPrioWahl(3);
  S.document.getElementById('aufText').value = 'Statik anfragen';
  S.aufSpeichern();
  pruefe(/\[\] Statik anfragen/.test(S.DB.themen[0].text) && !/P\d Statik/.test(S.DB.themen[0].text), 'Speichern mit 3 (Vorgabe): ohne Kürzel, ohne doppeltes Kürzel');
  S.aufNeu();
  S.cl.auf.fenster.seite = 'l1';
  S.document.getElementById('aufText').value = 'P2 Hecke schneiden';
  S.aufSpeichern();
  pruefe(/\[\] P2 Hecke schneiden$/.test(S.DB.themen[0].text), 'getipptes „P2 …“ wird als Priorität übernommen');

  /* Anzeige anderswo */
  S.oeffne('kalender'); S.clKalGehe(S.isoDatum(), 'tag');
  h = inhalt();
  pruefe(/<span class="prio p1">1<\/span>Keller aufräumen/.test(h) && !/P1 Keller/.test(h), 'Kalender-Tag: Zeichen statt Kürzel');
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
   39. Projekte nach Zustand (0.12.2; seit 0.43.1 drei Schalter in Projekte)
   Grund: Die Memo-Liste blendete alles aus, was nicht läuft — ruhende
   Projekte und Ziele waren nicht zu sehen.
   Erkennt: wieder ausgeblendete ruhende Seiten, Abgeschlossenes, das
   offen statt eingeklappt steht.
   ============================================================ */
function memoRuhtTest() {
  console.log('\n39. Projekte nach Zustand (0.12.2, seit 0.43.1 drei Schalter)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.DB.projekte.push({ id: 'p1', name: 'Läuft', flaeche: '', status: 'laufend', geaendert: 1 });
  S.DB.projekte.push({ id: 'p2', name: 'Carport', flaeche: '', status: 'ruht', geaendert: 1 });
  S.DB.ziele.push({ id: 'z1', name: 'Marathon', flaeche: '', status: 'ruht', geaendert: 1 });
  S.DB.projekte.push({ id: 'p3', name: 'Altes Projekt', flaeche: '', status: 'abgeschlossen', geaendert: 1 });
  /* Seit 0.43.1 in der App Projekte: drei Schalter Laufend · Ruhend · Abgeschlossen, je nur ein Zustand */
  S.oeffne('projekte');
  let h = inhalt();
  pruefe(/class="pj-filter"><button type="button" class="an" onclick="pjZustandFilter\('laeuft'\)">Laufend<\/button><button type="button" onclick="pjZustandFilter\('ruht'\)">Ruhend<\/button><button type="button" onclick="pjZustandFilter\('erledigt'\)">Abgeschlossen<\/button><\/div>/.test(h),
    'drei Schalter über der Liste, ohne Anzahl; Laufend ist gewählt');
  pruefe(/Läuft/.test(h) && !/Carport|Marathon|Altes Projekt/.test(h), 'Laufend: nur laufende');
  S.pjZustandFilter('ruht');
  h = inhalt();
  pruefe(/Carport/.test(h) && !/Marathon/.test(h) && !/Läuft|Altes Projekt/.test(h), 'Ruhend: ruhende Projekte (Ziele seit 0.44 in eigener App)');
  S.pjZustandFilter('erledigt');
  h = inhalt();
  pruefe(/Altes Projekt/.test(h) && !/Läuft|Carport/.test(h) && /pj-liste fertig/.test(h) && !/pj-p/.test(h), 'Abgeschlossen: grau, ohne Priorität');
  S.pjZustandFilter('quatsch');
  pruefe(S.cl.pj.zustand === 'erledigt' && !/pjAbgeschlossene|class="pj-z"/.test(S.document.getElementById('fuss').innerHTML + h), 'Unbekanntes wird ignoriert; kein Knopf „Abgeschlossene“, kein L/R/A mehr');
  S.pjOeffnen('p2', 'allgemein'); S.pjZurListe();
  pruefe(S.cl.pj.zustand === 'ruht', 'zurück aus einem ruhenden Projekt: Liste „Ruhend“');
  S.pjZustandFilter('laeuft');
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
  pruefe(/<table class="sa-tab sa-dat sa-kopf">(<colgroup>.*?<\/colgroup>)<tr><th class=" sort" onclick="saSortSetzen\('[^']+'\)">Datum(<span class="sa-pfeil"> [▲▼]<\/span>)?<\/th><th class="r sort" onclick="saSortSetzen\('[^']+'\)">kg(<span class="sa-pfeil"> [▲▼]<\/span>)?<\/th><\/tr><\/table><\/div><table class="sa-tab sa-dat">\1/.test(h),
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
  pruefe(!/listeAlsText/.test(S.document.getElementById('fuss').innerHTML), 'in „Alle“ kein „als Text bearbeiten“');
  S.todoListe('lh');
  pruefe(/onclick="listeAlsText\(\)">Schreiben/.test(S.document.getElementById('fuss').innerHTML), 'in der offenen Liste: „Schreiben“ bearbeitet sie als Text');
  S.listeAlsText();
  pruefe(S.cl.app === 'memo' && S.cl.memo.schreiben && S.cl.aufklapp === ''
    && inhalt().indexOf('<textarea id="memoFeld" class="memo-feld" spellcheck="true" oninput="memoTextGetippt()" onkeydown="memoTaste(event)">' + S.esc(S.DB.themen[0].text) + '</textarea>') >= 0,
    'Schreibfeld zeigt die ganze Listenseite');
  const feld = S.document.getElementById('memoFeld');
  feld.value = '[] Fenster warten – Magnat anrufen\n    › Auftrag ausfüllen\n    › Wartung einplanen\n[] Lampe tauschen';
  S.memoTextGetippt();
  pruefe(/› Auftrag ausfüllen/.test(S.DB.themen[0].text) && S.kpOffeneZahl(S.kpSeiteFinden('lh')) === 2, 'Textzeilen gespeichert, beide Aufgaben bleiben');
  pruefe(/memoSchreibenUm\(\)">Fertig/.test(S.document.getElementById('fuss').innerHTML), 'unten „Fertig“');
  S.memoSchreibenUm();
  pruefe(S.cl.app === 'checklisten' && S.cl.cls.id === 'lh' && !S.cl.memo.id && !S.cl.memo.ausListe, '„Fertig“ führt zurück zur Liste „Haus“ (seit 0.49 in Checklisten)');
  pruefe(/Fenster warten/.test(inhalt()) && !/Auftrag ausfüllen/.test(inhalt()), 'Aufgabenansicht zeigt weiter nur die Aufgaben');
  S.listeAlsText();
  S.clZurueck();
  pruefe(S.cl.app === 'checklisten' && S.cl.cls.id === 'lh' && !S.cl.memo.schreiben, 'Zurück-Taste führt ebenfalls zur Liste');
  S.listeAlsText();
  S.oeffne('uebersicht'); S.oeffne('memo');
  pruefe(!S.cl.memo.ausListe && !S.cl.memo.id && /Noch keine Notizen|memo-zeile/.test(inhalt()), 'später im Memo: normale Übersicht, keine Liste');
  S.oeffne('uebersicht');
}

/* ============================================================
   43. Kein ▶-Knopf mehr (0.15.2 eingeführt, 0.17.0 zurückgebaut)
   Grund: Aufgaben mit Unteraufgaben bekommen eine eigene Liste; das
   Zeichen ▶ wurde dafür nicht mehr gebraucht.
   Erkennt: ▶-Knopf oder seine Sonderbehandlung kehren zurück, die
   Schreibleiste verliert [ ] H •.
   ============================================================ */
function laufZeichenTest() {
  console.log('\n43. Kein ▶-Knopf mehr (zurückgebaut in 0.17.0)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.DB.themen.push({ id: 'lh', name: 'Haus', kontext: 'privat', text: '- Fenster warten\n[] Lampe', geaendert: 1 });
  S.oeffne('aufgaben'); S.aufListeSetzen('lh');
  S.listeAlsText();
  const h = inhalt();
  pruefe(/memoZeichen\('kasten'\)/.test(h) && /memoZeichen\('h'\)/.test(h) && /memoZeichen\('tabelle'\)" aria-label="Tabelle">⊞<\/button><\/div>/.test(h), 'Schreibleiste: [ ] … ⊞ — und nichts danach (seit 0.38 die volle Leiste)');
  pruefe(!/memoZeichen\('lauf'\)/.test(h) && !/'lauf'|▶ '/.test(funktionText(SKRIPT, 'memoZeichen')), 'kein ▶-Knopf, keine ▶-Sonderbehandlung');
  S.memoSchreibenUm();
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
  S.oeffne('kalender'); S.clKalGehe(S.isoDatum(), 'tag');
  let h = inhalt();
  pruefe(/Müll rausstellen<small class="herkunft">☑ Urlaub Borkum<\/small>/.test(h), 'Kalender-Tag: mit Herkunft „☑ Urlaub Borkum“');
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

/* ============================================================
   46. Aufgabensicht: Gruppiert | Prio | Geplant, „1. Nächste“ (0.17)
   Grund: „Alle Aufgaben“ soll Projekte, Listen und laufende Checklisten
   (nur Eingeplantes) zeigen — gruppiert oder flach nach Prio bzw. Tag —
   und auf Wunsch je Gruppe nur die nächste Aufgabe.
   Erkennt: falsche Quellen (Ruhendes, ungeplante Checklisten-Punkte),
   falsche Gruppenfolge, Sortierfehler, fehlende Tageszeilen/Herkunft,
   „Nächste“ zeigt mehr/weniger oder falsches „+n“, Wahl nicht gemerkt,
   alter Knopf „↕ Prio“/„Kategorien“ wieder da.
   ============================================================ */
function ansichtTest() {
  console.log('\n46. Aufgabensicht: Gruppiert | Prio | Geplant, „1. Nächste“ (0.17)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  const morgen = S.tagePlus(heute, 1);
  S.cl.auf.liste = ''; S.cl.auf.frisch = {}; S.cl.auf.erlZeigen = false; S.cl.auf.ganz = {}; S.cl.auf.wahl = '';
  S.cl.auf.ansicht = 'gruppiert'; S.cl.auf.naechste = false;
  S.DB.themen.push({ id: 'lh', name: 'Haus', text: '[] Lampe tauschen\n[] P1 Steckdose\n[] Dach prüfen', kontext: 'privat', ordnung: 1, geaendert: 1 });
  S.DB.projekte.push({ id: 'pc', name: 'Carport', flaeche: '[] P2 Statik anfragen\n[] Nachbar informieren', status: 'laufend', kontext: 'privat', ordnung: 50, geaendert: 1 });
  S.DB.projekte.push({ id: 'pr', name: 'Ruht', flaeche: '[] unsichtbar', status: 'ruht', kontext: 'privat', ordnung: 60, geaendert: 1 });
  S.DB.gedanken.push({ id: 'cb', titel: 'Urlaub Borkum', text: '[] Fähre buchen\n[] Koffer packen\n[] Ladekabel\n[x] Hotel', kontext: 'privat', checkliste: 'lauf', gestartet: heute, ordnung: 70, geaendert: 1 });
  S.DB.gedanken.push({ id: 'cv', titel: 'Vorlage', text: '[] nie', kontext: 'privat', checkliste: 'vorlage', ordnung: 80, geaendert: 1 });
  const plane = (id, nr, d, z) => S.aufPlanAnwenden(S.kpSeiteFinden(id), nr, d, z || '');
  plane('cb', 1, morgen, '18:00'); plane('cb', 0, heute); plane('pc', 1, heute, '09:00'); plane('lh', 2, morgen);
  S.oeffne('aufgaben');
  let h = inhalt();
  const titel = (x) => (x.match(/class="gruppe klick"[^>]*><span>([^<]+)<\/span>/g) || []).map(y => y.replace(/.*<span>/, '').replace(/<\/span>$/, ''));
  pruefe(titel(h).join(' | ') === '◎ Carport | ≡ Haus | ☑ Urlaub Borkum', 'Gruppen: erst Projekte, dann Listen, dann laufende Checklisten — ' + titel(h).join(' | '));
  pruefe(!/unsichtbar/.test(h) && !/>nie</.test(h), 'nicht: ruhende Projekte, Vorlagen');
  pruefe(/Fähre buchen/.test(h) && /Koffer packen/.test(h) && !/Ladekabel/.test(h) && !/Hotel/.test(h), 'Checkliste: nur eingeplante, offene Punkte');
  pruefe(/<span>☑ Urlaub Borkum<\/span><small>1\/4 · 2 geplant<\/small>/.test(h) && /<span>≡ Haus<\/span><small>3<\/small>/.test(h), 'Gruppenzahl: offen bzw. Stand · geplant');
  const zeilen = (x) => (x.match(/class="tx umbruch[^"]*"[^>]*>([^<]+)</g) || []).map(y => y.replace(/.*>/, '').replace(/<$/, ''));
  pruefe(zeilen(h).slice(2, 5).join(' | ') === 'Lampe tauschen | Steckdose | Dach prüfen', 'Gruppiert: Reihenfolge der Seite');
  pruefe(!/aufPrioSortUm|aufKategorienUm|↕/.test(S.document.getElementById('fuss').innerHTML), 'unten nur noch Neu und Details…');
  pruefe(/class="an" onclick="aufAnsicht\('gruppiert'\)">Gruppiert/.test(h) && /onclick="aufNaechsteUm\(\)">1\. Nächste/.test(h), 'oben der Schalter und „1. Nächste“');

  S.aufAnsicht('prio');
  h = inhalt();
  pruefe(zeilen(h).join(' | ') === 'Nachbar informieren | Fähre buchen | Steckdose | Statik anfragen | Koffer packen | Dach prüfen | Lampe tauschen',
    'Prio (seit 0.49): heute Fälliges zuerst, dann P1, P2, dann 3 — bei gleicher Prio früher Geplantes zuerst — ' + zeilen(h).join(' | '));
  pruefe(/Steckdose<small class="herkunft">≡ Haus<\/small>/.test(h) && /Fähre buchen<small class="herkunft">☑ Urlaub Borkum<\/small>/.test(h) && !/class="gruppe/.test(h), 'Prio: flach, Herkunft unter jeder Aufgabe');
  pruefe(S.__ablage['clie-aufgaben-ansicht'] === 'prio', 'die Wahl wird gemerkt');

  S.aufAnsicht('geplant');
  h = inhalt();
  const zw = (h.match(/<div class="zw">([^<]+)<\/div>/g) || []).map(y => y.replace(/<[^>]+>/g, ''));
  pruefe(zw.join(' | ') === 'Heute | ' + S.clWt(morgen) + ' ' + S.clKurzDatum(morgen) + ' | Ohne Datum', 'Geplant: Zwischenzeilen Heute, morgen, Ohne Datum — ' + zw.join(' | '));
  pruefe(zeilen(h).join(' | ') === 'Nachbar informieren | Fähre buchen | Koffer packen | Dach prüfen | Steckdose | Statik anfragen | Lampe tauschen',
    'Geplant: Uhrzeit vor ohne, ohne Datum nach Prio — ' + zeilen(h).join(' | '));
  pruefe(/Koffer packen<small class="herkunft">☑ Urlaub Borkum<\/small><\/button><span class="plan-marke">18:00<\/span>/.test(h), 'Geplant: Marke nur noch Uhrzeit');

  /* 1. Nächste */
  S.aufAnsicht('gruppiert');
  S.aufNaechsteUm();
  h = inhalt();
  /* Seit 0.29.1: in jeder Gruppe die am frühesten fällige, ohne Daten die oberste */
  pruefe(zeilen(h).join(' | ') === 'Nachbar informieren | Dach prüfen | Fähre buchen', 'Nächste: je Gruppe die nächste fällige — ' + zeilen(h).join(' | '));
  pruefe(/Nachbar informieren<small[^]*?<button type="button" class="mehr" onclick="aufGanzUm\('pc'\)"[^>]*>\+1</.test(h) || /Nachbar informieren<\/button>[^]*?aufGanzUm\('pc'\)"[^>]*>\+1</.test(h) && /aufGanzUm\('lh'\)"[^>]*>\+2</.test(h), '„+n“ zeigt, wie viele warten');
  pruefe(S.__ablage['clie-aufgaben-naechste'] === 'an', '„1. Nächste“ wird gemerkt');
  S.aufGanzUm('lh');
  pruefe(zeilen(inhalt()).filter(t => /Lampe|Steckdose|Dach/.test(t)).length === 3 && !/aufGanzUm\('lh'\)"[^>]*>\+/.test(inhalt()), 'Tipp: die Gruppe ganz zeigen');
  S.aufGanzUm('lh');
  S.aufHaken('lh', 0);
  h = inhalt();
  pruefe(/class="aufg erl[^"]*"[\s\S]*?Lampe tauschen/.test(h) && /Dach prüfen/.test(h) && !/Steckdose/.test(h), 'abgehakt: bleibt durchgestrichen, die nächste fällige bleibt vorn');
  S.aufAnsicht('prio');
  h = inhalt();
  pruefe(/Nachbar informieren/.test(h) && /Dach prüfen/.test(h) && /Fähre buchen/.test(h) && !/Statik|Koffer|Steckdose/.test(h), 'Nächste wirkt auch bei Prio');
  S.aufNaechsteUm();

  /* Eine Liste gewählt: keine Gruppen, keine Herkunft */
  S.aufListeSetzen('lh');
  h = inhalt();
  pruefe(!/class="gruppe/.test(h) && !/class="herkunft"/.test(h) && /Steckdose/.test(h), 'einzelne Liste: ohne Überschrift und Herkunft');
  S.aufListeSetzen('');
  /* Details zu einem Checklisten-Punkt: in die Checkliste */
  S.aufDetails('cb', 0);
  pruefe(S.cl.app === 'checklisten' && S.cl.cls.id === 'cb' && S.cl.aufklapp === '', 'Details zu einem Checklisten-Punkt öffnen die Checkliste');
  S.cl.auf.ansicht = 'gruppiert'; S.cl.auf.frisch = {};
  S.oeffne('uebersicht');
}

/* ============================================================
   47. Stones (0.18)
   Grund: Neues Spiel im LCD-Stil — Steine müssen sich korrekt bewegen,
   drehen, landen, Reihen räumen, zählen; beim App-Wechsel pausieren;
   die Bestenliste bleibt auf dem Gerät.
   Erkennt: Steine durch Wände/Boden, falsche Drehung, Reihen nicht
   geräumt, Punkte/Level falsch, kein Spielende, Bestenliste falsch
   sortiert/zu lang, keine Pause beim Verlassen, Tasten/Feld fehlen.
   ============================================================ */
function stonesTest() {
  console.log('\n47. Stones (0.18)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  delete S.__ablage['clie-stones-beste']; delete S.__ablage['clie-stones-spiele'];
  const zellen = (st) => JSON.stringify(S.stoZellen(st).map(z => z.join(',')).sort());
  pruefe(zellen({ typ: 'O', rot: 0, x: 0, y: 0 }) === zellen({ typ: 'O', rot: 1, x: 0, y: 0 }), 'O bleibt beim Drehen gleich');
  pruefe(JSON.stringify(S.stoZellen({ typ: 'I', rot: 1, x: 0, y: 0 }).map(z => z[0])) === '[2,2,2,2]', 'I gedreht steht senkrecht');
  pruefe(Object.keys(S.STO_FORMEN).length === 7 && S.STO_FORMEN[Object.keys(S.STO_FORMEN)[0]].z.length === 4, 'sieben Formen aus je vier Steinen');

  S.oeffne('stones');
  pruefe(S.cl.sto.zustand === 'start' && /Spielen/.test(inhalt()) && /Bestenliste/.test(inhalt()), 'Start: Fenster mit „Spielen“ und „Bestenliste“');
  S.stoNeuesSpiel();
  pruefe(S.cl.sto.zustand === 'laeuft' && S.cl.sto.stein && S.cl.sto.naechster && S.cl.sto.punkte === 0, 'neues Spiel: Stein, nächster Stein, 0 Punkte');
  const h = inhalt();
  pruefe((h.match(/<i/g) || []).length === 180 + 8 && /class="g"/.test(h) && /class="s"/.test(h), 'Feld 10 × 18 mit Stein und Umriss, Vorschau 4 × 2');
  pruefe(/stoTaste\('links'\)[\s\S]*stoTaste\('drehen'\)[\s\S]*stoTaste\('rechts'\)[\s\S]*stoTaste\('fallen'\)/.test(S.document.getElementById('fuss').innerHTML), 'unten vier Tasten ◀ ⟳ ▶ ▼');
  pruefe(S.document.getElementById('katKnopf').textContent === 'Level 1', 'oben rechts: Level');

  /* Wände und Boden */
  S.cl.sto.stein = { typ: 'O', rot: 0, x: 4, y: 0 };
  let n = 0; while (S.stoVersuch(-1, 0, 0)) { n++; }
  pruefe(n === 4 && S.cl.sto.stein.x === 0, 'links bis an die Wand, nicht hindurch');
  S.cl.sto.stein = { typ: 'I', rot: 1, x: -2, y: 2 };
  pruefe(S.stoVersuch(0, 0, 1) && S.stoZellen(S.cl.sto.stein).every(z => z[0] >= 0), 'Drehen an der Wand weicht aus');
  S.cl.sto.stein = { typ: 'O', rot: 0, x: 4, y: 0 };
  S.stoTaste('fallen');
  pruefe(S.cl.sto.feld[17][4] === 1 && S.cl.sto.feld[16][5] === 1 && S.cl.sto.punkte === 32, 'fallen lassen: landet am Boden, 2 Punkte je Zeile');

  /* Reihe räumen */
  S.cl.sto.feld = S.stoLeeresFeld();
  S.cl.sto.feld[17] = [1, 1, 1, 0, 0, 0, 0, 1, 1, 1];
  S.cl.sto.feld[16] = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  S.cl.sto.punkte = 0; S.cl.sto.reihen = 9; S.cl.sto.level = 1;
  S.cl.sto.stein = { typ: 'I', rot: 0, x: 3, y: 15 };
  S.stoTaste('fallen');
  pruefe(S.cl.sto.reihen === 10 && S.cl.sto.level === 2 && S.cl.sto.punkte === 40 + 2 && JSON.stringify(S.cl.sto.feld[17]) === '[1,0,0,0,0,0,0,0,0,0]',
    'volle Reihe geräumt, darüber rutscht nach; 10 Reihen → Level 2');
  pruefe(S.stoTakt() < 800, 'höheres Level: schneller');
  /* Uhr: ein Schritt tiefer */
  S.cl.sto.stein = { typ: 'T', rot: 0, x: 4, y: 0 };
  S.stoSchritt();
  pruefe(S.cl.sto.stein.y === 1, 'ein Takt: eine Zeile tiefer');

  /* Pause beim Verlassen */
  S.oeffne('uebersicht');
  pruefe(S.cl.sto.zustand === 'pause', 'App gewechselt: Pause');
  S.oeffne('stones');
  pruefe(/Weiter/.test(inhalt()) && /class="sto-spiel ruht"/.test(inhalt()), 'zurück: „Weiter“, Feld gedämpft');
  S.stoTaste('links');
  pruefe(S.cl.sto.stein.x === 4, 'in der Pause bewegt sich nichts');
  S.stoWeiter();
  pruefe(S.cl.sto.zustand === 'laeuft', 'Weiter');

  /* Spielende und Bestenliste */
  S.__ablage['clie-stones-beste'] = JSON.stringify([{ p: 900, r: 9, d: '2026-10-01' }, { p: 500, r: 5, d: '2026-10-02' }, { p: 400, r: 4, d: '2026-10-03' }, { p: 300, r: 3, d: '2026-10-04' }, { p: 100, r: 1, d: '2026-10-05' }]);
  S.cl.sto.punkte = 650;
  S.cl.sto.feld = S.stoLeeresFeld();
  for (let r = 0; r < 18; r++) { S.cl.sto.feld[r][4] = 1; S.cl.sto.feld[r][5] = 1; }
  S.cl.sto.naechster = 'O';
  S.stoNeuerStein();
  const beste = S.stoBeste();
  pruefe(S.cl.sto.zustand === 'vorbei' && /Spiel vorbei/.test(inhalt()), 'kein Platz mehr: Spiel vorbei');
  pruefe(beste.length === 5 && beste[1].p === 650 && beste[4].p === 300 && S.cl.sto.neu === 1, 'Bestenliste: sortiert, höchstens 5, neuer Platz 2');
  pruefe(/<div class="neu"><span>2\. heute<\/span>/.test(inhalt()), 'der neue Eintrag ist hervorgehoben');
  pruefe(S.stoSpiele() === 1 && !/stones/.test(JSON.stringify(S.DB)), 'gezählt nur auf dem Gerät — nichts in der workbench.json');
  pruefe(S.stoZahl(12480) === '12 480', 'Tausender mit schmalem Abstand');
  pruefe(S.STO_TASTEN.ArrowLeft === 'links' && S.STO_TASTEN[' '] === 'fallen', 'Pfeiltasten und Leertaste');
  S.oeffne('statistik');
  pruefe(/Stones/.test(inhalt()) && /900 · 1/.test(inhalt()), 'Statistik: Bester und Spiele');
  S.oeffne('uebersicht');
}

/* ============================================================
   48. Drive (0.19)
   Grund: Dokumente aus Google Drive finden und öffnen — Ordner, Zuletzt,
   Favoriten (abgeglichen), Suche — mit nur dem Recht, die Dateiliste
   zu sehen.
   Erkennt: falsche Anfragen an die API, fehlender Hinweis bei fehlendem
   Recht/fehlender Anmeldung, Ordner-Navigation/Zurück kaputt, Favoriten
   nicht in DB.drivefavoriten oder ohne Grabstein gelöscht, Datei öffnet
   nicht in neuem Fenster, Suchfeld wird beim Neuzeichnen geleert.
   ============================================================ */
async function driveTest() {
  console.log('\n48. Drive (0.19)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const warte = () => new Promise(r => setImmediate(r));
  const heute = S.isoDatum();
  S.cl.drv.tab = 'ordner'; S.cl.drv.stapel = [{ id: 'root', name: 'Meine Ablage' }]; S.cl.drv.cache = {}; S.cl.drv.fehler = ''; S.cl.drv.q = '';
  pruefe(/'drivefavoriten'[\],]/.test(QUELLE) && Array.isArray(S.DB.drivefavoriten), 'Bereich drivefavoriten kommt aus der Workbench (6.3.1)');
  pruefe(!/drive\.metadata\.readonly'?\s*;/.test(funktionText(SKRIPT, 'clAnfrage')) && /var SCOPES = 'https:\/\/www\.googleapis\.com\/auth\/drive\.file '/.test(QUELLE) && !/SCOPES = [^;]*metadata/.test(QUELLE),
    'das Listenrecht ist nicht Teil der normalen Anmeldung');
  delete S.__ablage['clie-drive-recht'];
  pruefe(!S.clAnfrage('').scope, 'ohne Erlauben: keine Zusatzrechte bei der Anfrage');
  S.__ablage['clie-drive-recht'] = 'an';
  const an = S.clAnfrage('');
  pruefe(/drive\.metadata\.readonly/.test(an.scope) && /drive\.file/.test(an.scope) && an.include_granted_scopes === true, 'nach Erlauben: Listenrecht wird mit angefragt');

  /* Ohne Anmeldung */
  S.oeffne('drive');
  pruefe(/Verbinden/.test(inhalt()) && /drvTab\('zuletzt'\)/.test(inhalt()), 'ohne Anmeldung: Hinweis „Verbinden“, Reiter da');
  /* Mit Anmeldung: eine kleine Drive */
  S.zugriffToken = 'test'; S.tokenAblauf = Date.now() + 3600000;
  const anfragen = [];
  const dateien = {
    root: [{ id: 'fh', name: 'Haus', mimeType: 'application/vnd.google-apps.folder', modifiedTime: heute + 'T08:00:00Z' },
           { id: 'd1', name: 'Budget Haus 2026', mimeType: 'application/vnd.google-apps.spreadsheet', modifiedTime: '2026-10-02T08:00:00Z', webViewLink: 'https://docs.google.com/x/d1' }],
    fh: [{ id: 'p1', name: "Angebot Magnat's Fenster", mimeType: 'application/pdf', modifiedTime: heute + 'T07:00:00Z', webViewLink: 'https://drive.google.com/p1' }]
  };
  let recht = true;
  S.fetch = function (adresse) {
    if (/tokeninfo/.test(adresse)) { return Promise.resolve({ ok: true, json() { return Promise.resolve({ scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly' }); } }); }
    anfragen.push(decodeURIComponent(adresse));
    if (!recht) { return Promise.resolve({ ok: false, status: 403, json() { return Promise.resolve({}); } }); }
    const q = decodeURIComponent(adresse);
    let files = [];
    const m = q.match(/q='([^']+)' in parents/);
    if (m) { files = dateien[m[1]] || []; }
    else if (/name contains/.test(q)) { files = dateien.fh; }
    else { files = dateien.root.concat(dateien.fh).filter(f => !/folder/.test(f.mimeType)); }
    return Promise.resolve({ ok: true, status: 200, json() { return Promise.resolve({ files: files }); } });
  };
  S.drvAktualisieren();
  S.cl.drv.recht = { token: 'test', stand: 'ja' };
  S.drvZeichnen();
  pruefe(/Wird geholt/.test(inhalt()), 'erst „Wird geholt …“');
  await warte(); await warte();
  let h = inhalt();
  pruefe(/q='root' in parents and trashed=false/.test(anfragen[0]) && /fields=files\(id,name,mimeType,modifiedTime,webViewLink\)/.test(anfragen[0]) && /orderBy=folder,name/.test(anfragen[0]),
    'Ordner: nur Namen und Metadaten, Ordner zuerst');
  pruefe(/Meine Ablage/.test(h) && /▤<\/span><span class="tx">Haus<small>Ordner<\/small>/.test(h) && /▦<\/span><span class="tx">Budget Haus 2026<small>Google Tabellen · 02\.10\.<\/small>/.test(h),
    'Zeilen mit Zeichen, Art und Datum');
  S.drvOeffnen(0);
  await warte(); await warte();
  h = inhalt();
  pruefe(S.cl.drv.stapel.length === 2 && /Meine Ablage › Haus/.test(h) && /zurück zu „Meine Ablage“/.test(h) && /Angebot Magnat&#39;s Fenster|Angebot Magnat's Fenster/.test(h),
    'Ordner öffnen: Pfad und „zurück“');
  pruefe(/'fh' in parents/.test(anfragen[anfragen.length - 1]), 'Unterordner wird nach seiner Kennung gefragt');
  const geoeffnet = [];
  S.open = function (u) { geoeffnet.push(u); return {}; };
  S.drvOeffnen(0);
  pruefe(geoeffnet[0] === 'https://drive.google.com/p1' && !/noopener/.test(funktionText(SKRIPT, 'drvOeffnen').replace(/\/\*[\s\S]*?\*\//g, '')), 'Datei: öffnet in neuem Fenster (ohne noopener)');
  /* Favorit */
  S.drvFavUm(0);
  const fav = S.DB.drivefavoriten[0];
  pruefe(fav && fav.datei === 'p1' && fav.pfad === 'Meine Ablage › Haus' && fav.mime === 'application/pdf' && fav.link && fav.geaendert, 'Favorit: in drivefavoriten mit Pfad und Link');
  pruefe(/drv-stern an[^>]*>★/.test(inhalt()), 'Stern gefüllt');
  S.clZurueck();
  pruefe(S.cl.drv.stapel.length === 1 && S.cl.app === 'drive', 'Zurück-Taste: eine Ordnerebene hoch');
  S.drvTab('favoriten');
  h = inhalt();
  pruefe(/Angebot Magnat/.test(h) && /PDF · Meine Ablage › Haus/.test(h), 'Favoriten: mit Fundort');
  S.drvFavUm(0);
  pruefe(!S.DB.drivefavoriten.length && S.DB.grabsteine.some(g => g.s === 'drivefavoriten' && g.id === fav.id), 'Favorit aus: gelöscht mit Grabstein (kommt beim Abgleich nicht zurück)');
  /* Zuletzt */
  S.drvTab('zuletzt');
  await warte(); await warte();
  pruefe(/pageSize=20/.test(anfragen[anfragen.length - 1]) && /orderBy=modifiedTime desc/.test(anfragen[anfragen.length - 1]) && /Budget Haus 2026/.test(inhalt()) && !/>Haus<small>Ordner/.test(inhalt()),
    'Zuletzt: 20 zuletzt geänderte Dateien, ohne Ordner');
  /* Suche */
  S.drvSucheOeffnen();
  pruefe(/id="drvFeld"/.test(inhalt()) && /drvSucheZu\(\)">Fertig/.test(S.document.getElementById('fuss').innerHTML), 'Suche: Feld und „Fertig“');
  S.document.getElementById('drvFeld').value = "magnat's";
  S.drvSuchen();
  await warte(); await warte();
  pruefe(/name contains 'magnat\\'s'/.test(anfragen[anfragen.length - 1]), 'Suchbegriff sicher in die Anfrage (Apostroph maskiert)');
  pruefe(/<mark>/.test(S.document.getElementById('drvListe').innerHTML), 'Treffer markiert');
  S.clZurueck();
  pruefe(S.cl.drv.tab === 'zuletzt', 'Zurück: Suche zu, wieder im vorigen Reiter');
  /* Ohne Recht */
  recht = false;
  S.drvTab('ordner');
  S.drvAktualisieren();
  await warte(); await warte(); await warte(); await warte();
  pruefe(/darf deine Drive-Liste noch nicht sehen/.test(inhalt()) && /drvErlauben\(\)/.test(inhalt()), 'fehlendes Recht: Hinweis und „Erlauben“');
  S.oeffne('statistik');
  pruefe(/Drive/.test(inhalt()), 'Statistik: Drive');
  S.fetch = function () { return Promise.reject(new Error('kein Netz im Test')); };
  S.zugriffToken = null; S.tokenAblauf = 0;
  delete S.__ablage['clie-drive-recht'];
  S.oeffne('uebersicht');
}

/* ============================================================
   49. Drive: Listenrecht wirklich prüfen (0.19.1, Fehler aus 0.19.0)
   Grund: Ohne drive.metadata.readonly meldet Drive keinen Fehler,
   sondern liefert nur die Dateien, die CLIE/Workbench angelegt haben.
   „Erlauben“ erschien deshalb nie — man sah nur Workbench-Dateien.
   Erkennt: Liste wird ohne erteiltes Recht geholt, kein „Erlauben“ beim
   ersten Öffnen, abgelehntes Recht wird als erteilt behandelt.
   ============================================================ */
async function driveRechtTest() {
  console.log('\n49. Drive: Listenrecht wirklich prüfen (0.19.1)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const warte = () => new Promise(r => setImmediate(r));
  S.cl.drv.tab = 'ordner'; S.cl.drv.stapel = [{ id: 'root', name: 'Meine Ablage' }]; S.cl.drv.cache = {}; S.cl.drv.fehler = ''; S.cl.drv.recht = { token: '', stand: '' };
  S.zugriffToken = 'nur-drive-file'; S.tokenAblauf = Date.now() + 3600000;
  delete S.__ablage['clie-drive-recht'];
  const listen = [];
  let rechte = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events';
  S.fetch = function (adresse) {
    if (/tokeninfo/.test(adresse)) { return Promise.resolve({ ok: true, json() { return Promise.resolve({ scope: rechte }); } }); }
    listen.push(adresse);
    /* So antwortet Drive mit nur drive.file: kein Fehler, nur eigene Dateien */
    return Promise.resolve({ ok: true, status: 200, json() { return Promise.resolve({ files: [{ id: 'w', name: 'workbench.json', mimeType: 'application/json' }] }); } });
  };
  S.oeffne('drive');
  await warte(); await warte();
  pruefe(/darf deine Drive-Liste noch nicht sehen/.test(inhalt()) && /drvErlauben\(\)/.test(inhalt()) && !listen.length, 'erstes Öffnen: gleich „Erlauben“ — keine Liste ohne Recht');
  S.__ablage['clie-drive-recht'] = 'an';
  S.drvZeichnen();
  pruefe(/Prüfe die Berechtigung/.test(inhalt()), 'nach Erlauben: CLIE prüft das Recht bei Google');
  await warte(); await warte(); await warte();
  pruefe(S.cl.drv.recht.stand === 'nein' && /nicht erteilt/.test(inhalt()) && /drvErlauben\(\)/.test(inhalt()) && !listen.length,
    'Recht nicht erteilt: wieder „Erlauben“ mit Hinweis — keine (falsche) Liste');
  rechte += ' https://www.googleapis.com/auth/drive.metadata.readonly';
  S.zugriffToken = 'mit-liste';
  S.drvZeichnen();
  await warte(); await warte(); await warte(); await warte();
  pruefe(S.cl.drv.recht.stand === 'ja' && listen.length === 1 && /workbench\.json/.test(inhalt()), 'Recht erteilt (neuer Schlüssel): jetzt wird die Liste geholt');
  S.fetch = function () { return Promise.resolve({ ok: false, status: 500 }); };
  S.drvAktualisieren();
  await warte(); await warte(); await warte();
  pruefe(/ließ sich nicht nach der Berechtigung fragen/.test(inhalt()), 'Prüfung schlägt fehl: Hinweis und „Nochmal“');
  S.fetch = function () { return Promise.reject(new Error('kein Netz im Test')); };
  S.zugriffToken = null; S.tokenAblauf = 0;
  delete S.__ablage['clie-drive-recht'];
  S.oeffne('uebersicht');
}

/* ============================================================
   50. Schach (0.20)
   Grund: Neues Spiel mit allen Regeln und CLIE als Gegner. Fehler in
   den Regeln merkt man oft erst spät — darum zählt der Test alle
   Zugfolgen bekannter Prüfstellungen (perft) und prüft Sonderregeln,
   Kurzschrift, Spielende, Bedienung, Zurücknehmen und Speichern.
   Erkennt: falsche/fehlende Züge (Rochade, en passant, Umwandlung,
   Fesselung), falsche Kurzschrift, kein Matt/Patt/Remis, CLIE übersieht
   Matt in 1, Partie geht beim Neustart verloren.
   ============================================================ */
function schachTest() {
  console.log('\n50. Schach (0.20)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  delete S.__ablage['clie-schach']; delete S.__ablage['clie-schach-bilanz'];
  const perft = (fen, erw) => erw.every((e, d) => S.schPerft(S.schAusFen(fen), d + 1) === e);
  pruefe(perft('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902]), 'perft Grundstellung 20 / 400 / 8902');
  pruefe(perft('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039]), 'perft „Kiwipete“ 48 / 2039 (Rochaden, en passant, Fesselung)');
  pruefe(perft('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812]), 'perft Endspiel 14 / 191 / 2812 (en passant mit Fesselung)');
  pruefe(perft('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264]), 'perft Stellung 4: 6 / 264 (Umwandlung, Schach)');
  pruefe(perft('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486]), 'perft Stellung 5: 44 / 1486');

  /* Kurzschrift */
  const kurz = (fen, f, t, pr) => { const p = S.schAusFen(fen); const m = S.schZuege(p).filter(x => S.schFeldName(x.f) === f && S.schFeldName(x.t) === t && (x.pr || '') === (pr || ''))[0]; return m ? S.schKurz(p, m) : '—'; };
  pruefe(kurz('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1', 'g1') === 'O-O' && kurz('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1', 'c1') === 'O-O-O', 'Rochade: O-O und O-O-O');
  pruefe(kurz('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', 'e5', 'd6') === 'exd6', 'en passant: exd6');
  pruefe(kurz('8/1P2k3/8/8/8/8/8/4K3 w - - 0 1', 'b7', 'b8', 'Q') === 'b8=D' && kurz('8/1P2k3/8/8/8/8/8/4K3 w - - 0 1', 'b7', 'b8', 'N') === 'b8=S', 'Umwandlung: b8=D, b8=S');
  pruefe(kurz('4k3/8/8/8/8/8/8/R4RK1 w - - 0 1', 'a1', 'd1') === 'Tad1' && kurz('4k3/8/8/8/R7/8/8/R3K3 w - - 0 1', 'a1', 'a2') === 'T1a2', 'Mehrdeutigkeit: Tad1, T1a2');
  pruefe(kurz('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'a1', 'a8') === 'Ta8#' && kurz('4k3/8/8/8/8/8/8/4K2Q w - - 0 1', 'h1', 'h5') === 'Dh5+', 'Schach „+“ und Matt „#“');
  pruefe(!S.schZuege(S.schAusFen('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1')).some(x => S.schFeldName(x.t) === 'e1') && S.schZuege(S.schAusFen('r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1')).every(x => Math.abs(x.t - x.f) !== 2 || S.schFeldName(x.f) !== 'e1'),
    'keine Rochade ohne Recht');
  pruefe(!S.schZuege(S.schAusFen('4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1')).some(x => S.schFeldName(x.f) === 'e1' && S.schFeldName(x.t) === 'g1'), 'keine Rochade durch ein angegriffenes Feld');

  /* Spielende */
  S.oeffne('schach');
  const lade = (fen) => { S.cl.sch.p = S.schAusFen(fen); S.cl.sch.schluessel = [S.schSchluessel(S.cl.sch.p)]; S.cl.sch.zuege = []; S.cl.sch.geschlagen = []; return S.schEndeText(); };
  pruefe(/^Schachmatt — Weiß gewinnt/.test(lade('R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1')), 'Matt erkannt');
  pruefe(/^Patt/.test(lade('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')), 'Patt erkannt');
  pruefe(/zu wenig Material/.test(lade('8/8/4k3/8/8/2B5/4K3/8 w - - 0 1')) && !lade('8/8/4k3/8/8/2R5/4K3/8 w - - 0 1'), 'zu wenig Material (K+L gegen K) — mit Turm nicht');
  pruefe(/50-Züge/.test(lade('8/8/4k3/8/8/2R5/4K3/8 w - - 100 80')), '50-Züge-Regel');
  S.schAufbauen([]);
  const z = (f, t) => { const m = S.schZuege(S.cl.sch.p).filter(x => S.schFeldName(x.f) === f && S.schFeldName(x.t) === t)[0]; S.schZugAusfuehren(m, true); };
  ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'].forEach(x => z(x.slice(0, 2), x.slice(2)));
  pruefe(/dreifache Wiederholung/.test(S.cl.sch.ende), 'dreifache Wiederholung');

  /* Bedienung gegen CLIE */
  S.cl.sch.gegner = 'clie'; S.cl.sch.farbe = 'w'; S.cl.sch.stufe = 'mittel'; S.cl.sch.dreh = false; S.cl.sch.fenster = ''; S.cl.sch.denkt = false;
  S.schAufbauen([]);
  S.zeichne();
  let h = inhalt();
  pruefe((h.match(/class="sch-f /g) || []).length === 64 && /<svg viewBox="0 0 12 12"/.test(h) && /Du \(Weiß\) am Zug/.test(h), 'Brett mit 64 Feldern und Pixel-Figuren');
  pruefe(S.document.getElementById('katKnopf').textContent === 'Mittel', 'oben rechts: Stufe');
  S.schTipp(52);
  h = inhalt();
  pruefe(S.cl.sch.wahl === 52 && (h.match(/sch-ziel/g) || []).length === 2, 'Figur antippen: zwei Ziele für e2');
  S.schTipp(36);
  pruefe(S.cl.sch.zuege.length === 1 && S.cl.sch.zuege[0].kurz === 'e4' && S.cl.sch.denkt === true, 'Ziel antippen: e4 — dann denkt CLIE');
  S.schTipp(51);
  pruefe(S.cl.sch.wahl === -1, 'während CLIE denkt: keine Eingabe');
  S.cl.sch.denkt = false;
  S.schZugAusfuehren(S.schKiZug(S.cl.sch.p, 'mittel', 0), false);
  pruefe(S.cl.sch.zuege.length === 2 && JSON.parse(S.__ablage['clie-schach']).zuege.length === 2, 'CLIE zieht, die Partie wird gespeichert');
  S.schZurueckNehmen();
  pruefe(S.cl.sch.zuege.length === 0 || (S.cl.sch.zuege.length % 2 === 0), 'Zurück gegen CLIE: bis du wieder am Zug bist');
  /* Laden nach Neustart */
  S.__ablage['clie-schach'] = JSON.stringify({ zuege: [{ f: 52, t: 36, pr: '' }, { f: 12, t: 28, pr: '' }, { f: 62, t: 45, pr: '' }], gegner: 'zwei', stufe: 'stark', farbe: 'w', dreh: true });
  S.cl.sch.p = null;
  S.schLaden();
  pruefe(S.cl.sch.zuege.map(x => x.kurz).join(' ') === 'e4 e5 Sf3' && S.cl.sch.gegner === 'zwei' && !S.cl.sch.p.w && S.schGedreht(), 'Neustart: Partie, Gegner und Drehung kommen wieder');
  S.zeichne();
  pruefe(/Schwarz am Zug/.test(inhalt()) && /<span>1\.<\/span><span>e4 e5<\/span>/.test(inhalt()) && /aria-label="h1"/.test(inhalt().slice(0, inhalt().indexOf('aria-label="a1"'))), 'zu zweit: „Schwarz am Zug“, Zugliste, Brett gedreht');
  /* Umwandlung über das Fenster */
  S.cl.sch.gegner = 'zwei';
  lade('8/1P2k3/8/8/8/8/8/4K3 w - - 0 1');
  S.cl.sch.ende = ''; S.cl.sch.wahl = -1;
  S.schTipp(9); S.schTipp(1);
  pruefe(S.cl.sch.fenster === 'umwandeln' && /Umwandeln in/.test(inhalt()), 'Umwandlung: Fenster zur Wahl');
  S.schUmwandeln('n');
  pruefe(S.cl.sch.p.b[1] === 'N' && S.cl.sch.zuege[0].kurz === 'b8=S' && !S.cl.sch.fenster, 'gewählt: Springer');
  /* Neue Partie */
  S.schNeuOeffnen();
  pruefe(/Neue Partie/.test(inhalt()) && /schNeuWahl\('stufe','stark'\)/.test(inhalt()) === false, 'Neue Partie: bei 2 Spielern keine Stufe');
  S.schNeuWahl('gegner', 'clie'); S.schNeuWahl('stufe', 'stark'); S.schNeuWahl('farbe', 'b');
  pruefe(/schNeuWahl\('stufe','stark'\)/.test(inhalt()), 'gegen CLIE: Stufe wählbar');
  S.schNeuLos();
  pruefe(S.cl.sch.farbe === 'b' && S.cl.sch.stufe === 'stark' && S.cl.sch.denkt === true && S.schGedreht(), 'du spielst Schwarz: CLIE beginnt, Brett von Schwarz aus');
  S.cl.sch.denkt = false;
  /* CLIE übersieht kein Matt in 1 */
  const pm = S.schAusFen('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1');
  pruefe(['leicht', 'mittel', 'stark'].every(st => S.schKurz(pm, S.schKiZug(pm, st, 0)) === 'Dxf7#'), 'alle Stufen finden Matt in 1');
  /* Bilanz */
  S.cl.sch.gegner = 'clie'; S.cl.sch.farbe = 'w';
  lade('R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1');
  S.cl.sch.ende = S.schEndeText(); S.schBilanz();
  S.oeffne('statistik');
  pruefe(/Schach/.test(inhalt()) && /1 · 0 · 0/.test(inhalt()), 'Statistik: gewonnen · verloren · remis');
  S.oeffne('uebersicht');
  delete S.__ablage['clie-schach'];
  S.cl.sch.p = null;
}

/* ============================================================
   51. Schach: Bereiche, Partien speichern, Nachspielen, PGN, Analyse, Tipp, Buch (0.22)
   Grund: Partien sollen bleiben, nachgespielt, geteilt und auf Fehler
   geprüft werden; CLIE spielt am Anfang Buchzüge und gibt Tipps.
   Erkennt: Speichern/Laden kaputt, falsche PGN, Nachspielen springt
   falsch, „Ab hier spielen“ verliert Züge, Analyse erkennt groben Fehler
   nicht, Kapitel 7 bekommt keine eigenen Fehler, Buch falsch erkannt.
   ============================================================ */
function schachPartienTest() {
  console.log('\n51. Schach: Partien, Nachspielen, PGN, Analyse, Tipp, Buch (0.22)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  delete S.__ablage['clie-schach']; delete S.__ablage['clie-schach-partien']; delete S.__ablage['clie-schach-schule'];
  S.cl.sch.p = null; S.cl.sch.bereich = 'spielen'; S.cl.sch.fenster = ''; S.cl.sch.pv = { id: '', k: 0, laeuft: false, stand: 0 }; S.cl.sch.ue = null;
  S.oeffne('schach');
  let h = inhalt();
  pruefe(/schBereich\('spielen'\)[\s\S]*schBereich\('partien'\)[\s\S]*schBereich\('schule'\)[\s\S]*schBereich\('eroeffnungen'\)/.test(h), 'vier Bereiche: Spielen, Partien, Schule, Eröffnungen');
  pruefe(/schTippZeigen\(\)">Tipp/.test(S.document.getElementById('fuss').innerHTML), 'Spielen: Knopf „Tipp“');
  /* Buch */
  pruefe(S.schBuchName(['e4', 'e5', 'Sf3', 'Sc6', 'Lc4']) === 'Italienische Partie' && S.schBuchName(['e4', 'c5']) === 'Sizilianische Verteidigung' && S.schBuchName(['a3']) === '',
    'Eröffnung wird erkannt');
  const fort = S.schBuchFortsetzungen(['e4', 'e5', 'Sf3', 'Sc6']);
  pruefe(fort.indexOf('Lc4') >= 0 && fort.indexOf('Lb5') >= 0 && fort.indexOf('d4') >= 0, 'Buchzüge zur Auswahl: Lc4, Lb5, d4');
  /* Partie zu zweit spielen und speichern */
  S.cl.sch.gegner = 'zwei'; S.cl.sch.farbe = 'w'; S.cl.sch.stufe = 'mittel'; S.cl.sch.dreh = false;
  S.schAufbauen([]);
  ['e4', 'e5', 'Sf3', 'Sc6', 'Lc4'].forEach(k => S.schZugAusfuehren(S.schAusKurz(S.cl.sch.p, k), false));
  S.zeichne();
  pruefe(/Italienische Partie · Schwarz am Zug/.test(inhalt()), 'Statuszeile nennt die Eröffnung');
  S.schTippZeigen();
  pruefe(/^Tipp: CLIE würde \S+ spielen\.$/.test(S.cl.sch.tipp) && S.cl.sch.wahl >= 0 && /class="sch-hinweis"/.test(inhalt()), 'Tipp zeigt den Zug von CLIE und markiert die Figur');
  S.schSpeichernOeffnen();
  pruefe(/Partie speichern/.test(inhalt()) && /id="schName"[^>]*value="2 Spieler"/.test(inhalt()), 'Speichern: Fenster mit Namensvorschlag');
  S.document.getElementById('schName').value = 'Testpartie';
  S.schSpeichernOk();
  let l = JSON.parse(S.__ablage['clie-schach-partien']);
  pruefe(l.length === 1 && l[0].name === 'Testpartie' && l[0].zuege.length === 5 && l[0].kurz.join(' ') === 'e4 e5 Sf3 Sc6 Lc4' && l[0].ergebnis === '*' && l[0].eroeffnung === 'Italienische Partie',
    'gespeichert: Name, Züge, Kurzschrift, Ergebnis, Eröffnung — nur auf dem Gerät');
  pruefe(!/Testpartie/.test(JSON.stringify(S.DB)), 'nicht in der workbench.json');
  const pgn = S.schPgn(l[0]);
  pruefe(/\[Event "Testpartie"\]/.test(pgn) && /\[Result "\*"\]/.test(pgn) && /1\. e4 e5 2\. Nf3 Nc6 3\. Bc4 \*/.test(pgn), 'PGN mit englischen Figurenbuchstaben');
  /* Nachspielen */
  S.schBereich('partien');
  pruefe(/Testpartie/.test(inhalt()) && /Italienische Partie · 3 Züge/.test(inhalt()) && S.document.getElementById('katKnopf').textContent === '1', 'Liste der Partien');
  S.schPartieOeffnen(l[0].id);
  pruefe(/0 \/ 5/.test(inhalt()) && /schAbHier\(\)/.test(S.document.getElementById('fuss').innerHTML), 'Nachspielen: Anfang, Knöpfe');
  S.schNachSchritt(1); S.schNachSchritt(1);
  pruefe(S.cl.sch.pv.k === 2 && /2 \/ 5/.test(inhalt()) && /<b>e5<\/b>/.test(inhalt()), '▶ zweimal: nach 1… e5, Zug hervorgehoben');
  S.schNachSchritt(99);
  pruefe(S.cl.sch.pv.k === 5, '⏭ ans Ende');
  S.schNachGehe(3);
  S.schAbHier();
  pruefe(S.cl.sch.bereich === 'spielen' && S.cl.sch.zuege.map(z => z.kurz).join(' ') === 'e4 e5 Sf3', '„Ab hier spielen“ übernimmt die ersten drei Halbzüge');
  /* Umbenennen und Löschen */
  S.schBereich('partien'); S.schPartieOeffnen(l[0].id); S.schMehrOeffnen();
  S.document.getElementById('schName').value = 'Neu benannt';
  S.schUmbenennen();
  pruefe(JSON.parse(S.__ablage['clie-schach-partien'])[0].name === 'Neu benannt', 'umbenennen');
  /* Analyse */
  const pb = S.schAusFen('rnbqkbnr/ppp2ppp/3p4/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3');
  const ana = S.schAnalyseZug(pb, S.schAusKurz(pb, 'Dg4'));
  pruefe(ana && ana.verlust >= 600 && ana.besser && ana.besser !== 'Dg4', 'Analyse erkennt den groben Fehler Dg4?? (' + (ana && ana.verlust) + ')');
  S.schAnalyseFertig(l[0].id, [{ ply: 2, kurz: 'Dg4', besser: 'Sf3', verlust: 900, fen: S.schFen(pb) }]);
  S.zeichne();
  pruefe(/Dg4\?\?<small>besser: Sf3<\/small>/.test(inhalt()) && /−9,0/.test(inhalt()), 'Analyse-Ergebnis: ?? mit besserem Zug und Bauernwert');
  const eig = S.schEigeneAufgaben();
  pruefe(eig.length === 1 && eig[0].typ === 'beste' && S.schKapitelListe().slice(-1)[0].id === 'k7' && S.schKapitelListe().slice(-1)[0].lektionen[0].aufgaben.length === 1,
    'Kapitel 7: der Fehler wird zur Aufgabe');
  pruefe(S.schFen(S.schAusFen(S.SCH_START)) === S.SCH_START, 'FEN hin und zurück');
  S.schEbeneHoch();
  pruefe(!S.cl.sch.pv.id && /Neu benannt/.test(inhalt()), 'Fertig/Zurück: wieder zur Liste');
  S.schPartieOeffnen(l[0].id); S.schPartieLoeschen();
  pruefe(JSON.parse(S.__ablage['clie-schach-partien']).length === 0, 'löschen');
  /* Spielende bietet Speichern */
  S.schBereich('spielen');
  S.cl.sch.gegner = 'zwei';
  S.schAufbauen([]);
  ['f3', 'e5', 'g4', 'Dh4'].forEach(k => S.schZugAusfuehren(S.schAusKurz(S.cl.sch.p, k), true));
  S.cl.sch.fenster = '';
  S.zeichne();
  pruefe(/Schachmatt/.test(inhalt()) && /schSpeichernOeffnen\(\)">Speichern/.test(inhalt()), 'Spielende: „Speichern“ im Fenster');
  delete S.__ablage['clie-schach'];
  S.cl.sch.p = null;
  S.oeffne('uebersicht');
}

/* ============================================================
   52. Schachschule und Eröffnungen (0.22)
   Grund: Lernen mit Lektionen, Aufgaben, Endspielen und Eröffnungen.
   Falsche Inhalte (unmögliche Züge, Matt ohne Matt, „Gewinn“ ohne
   Gewinn) würden falsch lehren — darum wird jede Aufgabe nachgerechnet.
   Erkennt: inhaltliche Fehler, Aufgabe nimmt richtige Züge nicht an
   oder falsche an, Fortschritt geht verloren, Endspiel-/Übungsablauf
   kaputt, Weiterlernen springt falsch.
   ============================================================ */
function schuleTest() {
  console.log('\n52. Schachschule und Eröffnungen (0.22)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  delete S.__ablage['clie-schach-schule']; delete S.__ablage['clie-schach-partien'];
  /* Inhalte nachrechnen */
  let lekt = 0, aufg = 0, fehlerL = [];
  const ids = {};
  const pruefStellung = (x) => { const p = S.schStellungAus(x); return S.schKoenig(p, true) >= 0 && S.schKoenig(p, false) >= 0 && !S.schAngegriffen(p, S.schKoenig(p, !p.w), p.w) ? p : null; };
  S.SCH_SCHULE.forEach(k => k.lektionen.forEach(l => {
    lekt++;
    l.schritte.forEach(sc => { if (!pruefStellung(sc)) { fehlerL.push(l.id + ' Schritt'); } (sc.marken || []).forEach(m => { if (!/^[a-h][1-8]$/.test(m)) { fehlerL.push(l.id + ' Marke'); } }); });
    (l.aufgaben || []).forEach(a => {
      aufg++;
      if (ids[a.id]) { fehlerL.push(a.id + ' doppelt'); } ids[a.id] = 1;
      if (a.vorher) { let q = S.schAusFen(S.SCH_START); a.vorher.split(' ').forEach(z => { const m = S.schAusKurz(q, z); if (!m) { fehlerL.push(a.id + ' vorher ' + z); } else { S.schMachen(q, m); } }); }
      const p = pruefStellung(a);
      if (!p) { fehlerL.push(a.id + ' Stellung'); return; }
      const typ = a.typ || 'zug';
      if (typ === 'frage') { if (!(a.optionen && a.richtig >= 0 && a.richtig < a.optionen.length)) { fehlerL.push(a.id + ' Frage'); } return; }
      if (typ === 'endspiel') { if (['matt', 'umwandeln', 'remis'].indexOf(a.ziel) < 0 || !(a.limit > 0)) { fehlerL.push(a.id + ' Ziel'); } return; }
      if (typ === 'beste') { if (!S.schZuege(p).length) { fehlerL.push(a.id + ' keine Züge'); } return; }
      const ich = p.w ? 'w' : 'b';
      const vor = S.schMaterial(p, ich);
      for (const z of a.loesung) { const m = S.schAusKurz(p, z); if (!m) { fehlerL.push(a.id + ' Zug ' + z); return; } S.schMachen(p, m); }
      if (a.matt && !(S.schImSchach(p) && !S.schZuege(p).length)) { fehlerL.push(a.id + ' kein Matt'); }
      if (a.gewinn > 0 && S.schMaterial(p, ich) - vor < a.gewinn) { fehlerL.push(a.id + ' kein Gewinn'); }
    });
  }));
  pruefe(lekt >= 38 && aufg >= 100, 'Umfang: ' + lekt + ' Lektionen, ' + aufg + ' Aufgaben');
  pruefe(!fehlerL.length, 'alle Stellungen legal, alle Lösungen spielbar, jedes Matt ist Matt, jeder Gewinn ist Gewinn' + (fehlerL.length ? ' — ' + fehlerL.join(', ') : ''));
  const ef = [];
  S.SCH_EROEFFNUNGEN.forEach(e => {
    const p = S.schAusFen(S.SCH_START); const z = S.schBuchListe(e);
    z.forEach(k => { const m = S.schAusKurz(p, k); if (!m) { ef.push(e.id + ' ' + k); } else { S.schMachen(p, m); } });
    Object.keys(e.erkl || {}).forEach(n => { if (+n < 1 || +n > z.length) { ef.push(e.id + ' erkl ' + n); } });
    if (!e.idee || !e.falle) { ef.push(e.id + ' Text'); }
  });
  pruefe(S.SCH_EROEFFNUNGEN.length === 10 && !ef.length, '10 Eröffnungen, alle Züge spielbar' + (ef.length ? ' — ' + ef.join(', ') : ''));

  /* Oberfläche */
  S.cl.sch.p = null; S.cl.sch.bereich = 'schule'; S.cl.sch.sv = { kapitel: '', lektion: '', schritt: 0, aufgabe: -1 }; S.cl.sch.ue = null; S.cl.sch.fenster = '';
  S.oeffne('schach');
  let h = inhalt();
  pruefe((h.match(/schKapitelOeffnen\('/g) || []).length === 7 && /Aus eigenen Partien lernen/.test(h) && /schWeiterlernen\(\)/.test(S.document.getElementById('fuss').innerHTML), 'Schule: 7 Kapitel und „Weiterlernen“');
  pruefe(/^0 \/ \d+$/.test(S.document.getElementById('katKnopf').textContent), 'oben rechts: erledigte Lektionen');
  S.schWeiterlernen();
  pruefe(S.cl.sch.sv.lektion === 'rochade' && /Rochade/.test(inhalt()) && /sch-f [hd][^"]*feldmarke/.test(inhalt()), 'Weiterlernen öffnet die erste Lektion, Felder markiert');
  S.schSchrittGehe(1);
  pruefe(S.cl.sch.sv.schritt === 1 && /verboten/.test(inhalt()), 'Schritt weiter');
  const zieh = (k) => { const m = S.schAusKurz(S.cl.sch.ue.p, k); S.schUeTipp(m.f); S.schUeTipp(m.t); };
  S.schAufgabeOeffnen(0);
  pruefe(S.cl.sch.ue && /Bring deinen König/.test(inhalt()), 'Aufgabe 1 offen');
  zieh('O-O');
  pruefe(S.cl.sch.ue.ok === true && JSON.parse(S.__ablage['clie-schach-schule']).a.r1 === 1 && /schUeWeiter\(\)">Nächste/.test(S.document.getElementById('fuss').innerHTML), 'richtig gelöst: gemerkt, „Nächste“');
  S.schUeWeiter();
  pruefe(S.cl.sch.sv.aufgabe === 1 && /Welche Rochade darf/.test(inhalt()) && /schUeAntwort\(1\)/.test(inhalt()), 'nächste Aufgabe: Frage mit Auswahl');
  S.schUeAntwort(0);
  pruefe(S.cl.sch.ue.ok === false && S.cl.sch.ue.fehler === 1 && /class="knopf falsch"/.test(inhalt()), 'falsche Antwort: markiert, Fehler gezählt');
  S.schUeAntwort(1);
  pruefe(S.cl.sch.ue.ok === true && /Läufer a6/.test(inhalt()), 'richtige Antwort mit Erklärung');
  /* Kombination mit Antwort des Gegners, falscher Zug */
  S.cl.sch.sv = { kapitel: 'k2', lektion: 'sst', schritt: 0, aufgabe: -1 };
  S.schAufgabeOeffnen(0);
  zieh('Dd8+');
  pruefe(S.cl.sch.ue.ok === false && /^Nicht ganz\./.test(S.cl.sch.ue.meldung) && S.cl.sch.ue.p.b.join('') === S.schStellungAus(S.cl.sch.ue.a).b.join(''), 'falscher Zug: „Nicht ganz“, Stellung bleibt');
  zieh('Da4+');
  pruefe(S.cl.sch.ue.idx === 2 && S.cl.sch.ue.ok === null && /Gut! Weiter/.test(S.cl.sch.ue.meldung), 'richtiger Zug, Gegner antwortet aus der Lösung');
  zieh('Dxe4');
  pruefe(S.cl.sch.ue.ok === true, 'Kombination gelöst');
  /* Matt mit Umwandlung: jedes Matt zählt */
  S.cl.sch.sv = { kapitel: 'k1', lektion: 'umwandlung', schritt: 0, aufgabe: -1 };
  S.schAufgabeOeffnen(1);
  const mu = S.schZuege(S.cl.sch.ue.p).filter(m => m.pr === 'R')[0];
  S.schUeTipp(mu.f); S.schUeTipp(mu.t);
  pruefe(S.cl.sch.fenster === 'umwandeln' && /Umwandeln in/.test(inhalt()), 'Umwandlung im Übungsbrett: Auswahl');
  S.schUmwandeln('r');
  pruefe(S.cl.sch.ue.ok === true, 'auch c8=T ist Matt — wird angenommen');
  /* Beste-Aufgabe */
  S.cl.sch.sv = { kapitel: 'k2', lektion: 'patzer', schritt: 0, aufgabe: -1 };
  S.schAufgabeOeffnen(0);
  zieh('h3');
  pruefe(S.cl.sch.ue.ok === false && /kostet/.test(S.cl.sch.ue.meldung), 'beste: schlechter Zug wird abgelehnt');
  zieh('Df3');
  pruefe(S.cl.sch.ue.ok === false, 'beste: Df3?? (Lxf3) wird abgelehnt');
  zieh('g3');
  pruefe(S.cl.sch.ue.ok === true, 'beste: g3 verteidigt — angenommen');
  /* Endspiel gegen CLIE */
  S.cl.sch.sv = { kapitel: 'k6', lektion: 'opposition', schritt: 0, aufgabe: -1 };
  S.schAufgabeOeffnen(0);
  pruefe(/Zug 0 \/ 12/.test(inhalt()) && /schUeZurueck\(\)/.test(S.document.getElementById('fuss').innerHTML), 'Endspiel: Zugzähler, Zurück, Neu starten');
  zieh('Kd6');
  pruefe(S.cl.sch.ue.denkt === true && S.cl.sch.ue.zugZahl === 1, 'nach deinem Zug denkt CLIE');
  S.schUeClieZug();
  pruefe(!S.cl.sch.ue.denkt && S.cl.sch.ue.p.w && S.cl.sch.ue.verlauf.length === 2, 'CLIE antwortet');
  S.schUeZurueck();
  pruefe(S.cl.sch.ue.verlauf.length === 0 && S.cl.sch.ue.zugZahl === 0, 'Zurück nimmt beide Halbzüge zurück');
  /* Ziel erreicht: Umwandlung gesichert */
  S.cl.sch.ue.p = S.schAusFen('8/4P1k1/4K3/8/8/8/8/8 w - - 0 1'); S.cl.sch.ue.schl = [S.schSchluessel(S.cl.sch.ue.p)];
  const mp = S.schAusKurz(S.cl.sch.ue.p, 'e8=D');
  S.schUeTipp(mp.f); S.schUeTipp(mp.t); S.schUmwandeln('q');
  S.schUeClieZug();
  pruefe(S.cl.sch.ue.ok === true && /gewonnen/.test(S.cl.sch.ue.meldung), 'Umwandlung gesichert: Ziel erreicht');
  /* Eröffnung üben */
  S.cl.sch.ue = null;
  S.schBereich('eroeffnungen');
  pruefe((inhalt().match(/schEroeffnungOeffnen\('/g) || []).length === 10, 'Eröffnungen: 10 in der Liste');
  S.schEroeffnungOeffnen('italienisch');
  S.schEroeffnungGehe(5);
  pruefe(/3\. Lc4<\/b> — Der Läufer zielt auf f7/.test(inhalt()) && /Idee:/.test(inhalt()), 'Durchspielen: Zug 3. Lc4 mit Erklärung, Idee');
  S.schEroeffnungUeben();
  zieh('e4');
  pruefe(S.cl.sch.ue.idx === 2 && S.cl.sch.ue.ok === null, 'Üben: e4 richtig, CLIE antwortet e5');
  zieh('d4');
  pruefe(S.cl.sch.ue.ok === false && /Hier spielt man Sf3/.test(S.cl.sch.ue.meldung), 'Üben: falscher Zug — Hinweis auf den Buchzug');
  ['Sf3', 'Lc4', 'c3', 'd3', 'O-O'].forEach(zieh);
  pruefe(S.cl.sch.ue.ok === true && JSON.parse(S.__ablage['clie-schach-schule']).e.italienisch === undefined, 'durchgespielt — mit Fehler noch kein ★');
  S.schEroeffnungUeben();
  ['e4', 'Sf3', 'Lc4', 'c3', 'd3', 'O-O'].forEach(zieh);
  pruefe(JSON.parse(S.__ablage['clie-schach-schule']).e.italienisch === 1, 'fehlerfrei: ★ geübt');
  S.cl.sch.ue = null; S.cl.sch.ev.id = '';
  S.zeichne();
  pruefe(/Italienische Partie<small>[^<]*<\/small><\/span><b>★<\/b>/.test(inhalt()), 'in der Liste mit ★');
  S.schEroeffnungOeffnen('sizilianisch');
  S.schEroeffnungUeben();
  pruefe(S.cl.sch.ue.ich === 'b' && S.cl.sch.ue.idx === 1 && !S.cl.sch.ue.p.w, 'Schwarz üben: CLIE spielt den ersten Zug');
  S.cl.sch.ue = null; S.cl.sch.ev.id = ''; S.cl.sch.bereich = 'spielen';
  delete S.__ablage['clie-schach-schule'];
  S.oeffne('uebersicht');
}

/* ============================================================
   74. Jahreskalender und Listen nach Art (0.37)
   Grund: Das Jahresraster mit Arten und Ferien war das Highlight der
   Workbench. Use Cases: alle Geburtstage als Liste, alle Treffen mit
   einer Freundin rückwärts.
   Erkennt: Arten aus #Kürzel/Zuordnung nicht erkannt, Raster ohne Farbe,
   jährliche Termine im falschen Jahr, Liste falsch sortiert, Suche
   wirkungslos, Jahrestermin nicht gespeichert/gelöscht, Zuordnung ohne
   Grabstein beim Aufheben.
   ============================================================ */
function jahrTest() {
  console.log('\n74. Jahreskalender und Listen nach Art (0.37)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  const j = Number(heute.slice(0, 4));
  S.cl.ja = Object.assign(S.cl.ja, { jahr: 0, filter: '', ansicht: 'raster', suche: '', tag: '', jt: null, termine: {}, geladen: {}, ab: 0 });
  S.termineNachTag = {};
  const vor = n => S.tagePlus(heute, -n);
  S.DB.jahrestermine = [
    { id: 'g1', titel: 'Moni', von: '1974-' + S.tagePlus(heute, 10).slice(5), jaehrlich: true, art: 'geburtstag', kontext: 'privat', jahrgang: '1974', geaendert: 1 },
    { id: 'g2', titel: 'Papa *1948', von: '2020-' + S.tagePlus(heute, 3).slice(5), jaehrlich: true, art: 'geburtstag', kontext: 'privat', geaendert: 1 },
    { id: 'u1', titel: 'Ostsee', von: S.tagePlus(heute, 20), bis: S.tagePlus(heute, 27), art: 'urlaub', kontext: 'privat', geaendert: 1 }];
  S.cl.ja.termine[vor(18)] = [{ id: 'b1', titel: 'Brunch bei Sabine #Besuch', rohTitel: 'Brunch bei Sabine #Besuch', zeit: '10:00', ganztags: false, kontext: 'privat', kalId: 'k' }];
  S.cl.ja.termine[vor(120)] = [{ id: 'b2', titel: 'Grillen mit Sabine und Tom', rohTitel: 'Grillen mit Sabine und Tom', zeit: '18:00', ganztags: false, kontext: 'privat', kalId: 'k' }];
  S.cl.ja.termine[vor(60)] = [{ id: 'b3', titel: 'Kino', rohTitel: 'Kino', beschreibung: 'mit Petra #besuche', zeit: '20:00', ganztags: false, kontext: 'privat', kalId: 'k' }];
  pruefe(S.jaArtenAusText('Brunch #Besuch und #Feiern').join() === 'besuche,feier' && S.jaTerminArten(S.cl.ja.termine[vor(60)][0]).join() === 'besuche', 'Arten aus #Kürzel im Titel oder in der Beschreibung (Einzahl = Mehrzahl)');
  /* Ansicht J */
  S.oeffne('kalender'); S.clKalAnsicht('jahr');
  pruefe(S.cl.kal.ansicht === 'jahr' && /ja-raster/.test(inhalt()) && S.document.getElementById('reiter').textContent === 'Jahr', 'Kalender: Ansicht „J“ zeigt das Jahresraster');
  pruefe(/clKalAnsicht\('jahr'\)/.test(S.document.getElementById('fuss').innerHTML) && /jaAnsicht\('liste'\)/.test(S.document.getElementById('fuss').innerHTML), 'unten: J und „Als Liste“');
  const zellen = (inhalt().match(/onclick="jaTagOeffnen\('\d{4}-\d{2}-\d{2}'\)"/g) || []).length;
  const schalt = (j % 4 === 0 && (j % 100 !== 0 || j % 400 === 0)) ? 366 : 365;
  pruefe(zellen === schalt, 'jeder Tag des Jahres genau einmal (' + zellen + ')');
  const tagG = S.tagePlus(heute, 10);
  pruefe(S.jaAn(tagG).some(x => x.id === 'g1') && new RegExp('class="art[^"]*" style="background:#8E9A7C" onclick="jaTagOeffnen\\(\'' + tagG + '\'\\)"').test(inhalt().replace(/class="([^"]*)"/g, (m, c) => 'class="' + c.split(' ').filter(k => k === 'art').join(' ') + '"')),
    'jährlicher Geburtstag im aktuellen Jahr, in seiner Abstufung (seit 0.38 ohne Farben)');
  S.jaFilter('urlaub');
  pruefe(!S.jaAn(tagG).filter(S.jaPasst).length && S.jaAn(S.tagePlus(heute, 22)).filter(S.jaPasst).length === 1, 'Filter nach Art');
  /* Liste Geburtstage */
  S.jaFilter('geburtstag'); S.jaAnsicht('liste');
  let h = inhalt();
  pruefe(h.indexOf('Papa') < h.indexOf('Moni') && /Moni \(\d+\)/.test(h) && /Papa \*1948 \(\d+\)/.test(h) && /in 3 T\./.test(h), 'Geburtstage: nach dem nächsten Datum, mit Alter (Jahrgang oder Jahreszahl im Titel)');
  const alterMoni = Number(S.tagePlus(heute, 10).slice(0, 4)) - 1974;
  pruefe(new RegExp('Moni \\(' + alterMoni + '\\)').test(h), 'Alter stimmt (' + alterMoni + ')');
  /* Liste Besuche rückwärts mit Suche */
  S.jaFilter('besuche'); S.jaAnsicht('liste');
  h = inhalt();
  pruefe(/Brunch bei Sabine/.test(h) && /Kino/.test(h) && !/Grillen/.test(h) && h.indexOf('Brunch') < h.indexOf('Kino'), 'Besuche: neueste oben, nur mit Art');
  S.jaZuordnen('b2', 'besuche');
  pruefe(S.DB.kalenderzuordnung.b2.art === 'besuche' && /Grillen mit Sabine/.test(inhalt()), 'Art zuordnen: Grillen zählt jetzt zu Besuche');
  S.document.getElementById('jaSuche').value = 'sabine'; S.jaSucheGetippt();
  h = S.document.getElementById('jaTreffer').innerHTML;
  pruefe(/Brunch/.test(h) && /Grillen/.test(h) && !/Kino/.test(h), 'Suche „sabine“: wann wir Sabine getroffen haben');
  pruefe(/vor 18 T\./.test(h) && /vor \d Mon\./.test(h), 'Abstand: „vor 18 T.“, „vor 4 Mon.“');
  S.jaZuordnen('b2', 'besuche');
  pruefe(!S.DB.kalenderzuordnung.b2 && (S.DB.grabsteine || []).some(g => g.s === 'kalenderzuordnung' && g.id === 'b2'), 'dieselbe Art nochmals: Zuordnung aufgehoben, mit Grabstein');
  S.cl.ja.suche = '';
  /* Jahrestermin anlegen, ändern, löschen */
  S.jaJtNeu(heute);
  pruefe(S.cl.aufklapp === 'jahr' && /jaTitel/.test(S.document.getElementById('aufklapp').innerHTML) && S.cl.ja.jt.art === 'besuche', 'Neuer Jahrestermin: Fenster, Art vom Filter');
  S.document.getElementById('jaTitel').value = 'Anna'; S.document.getElementById('jaVon').value = '2014-03-03'; S.document.getElementById('jaBis').value = '';
  S.document.getElementById('jaJaehrlich').checked = true; S.document.getElementById('jaJahrgang').value = '2014';
  S.jaJtSetzen('art', 'geburtstag');
  S.jaJtSpeichern();
  const anna = S.DB.jahrestermine.filter(e => e.titel === 'Anna')[0];
  pruefe(anna && anna.jaehrlich && anna.art === 'geburtstag' && anna.jahrgang === '2014' && anna.bis === '2014-03-03' && !S.cl.aufklapp, 'gespeichert: jährlich, Art, Jahrgang');
  S.jaJtOeffnen(anna.id);
  S.document.getElementById('jaTitel').value = ''; S.jaJtSpeichern();
  pruefe(S.cl.aufklapp === 'jahr' && anna.titel === 'Anna', 'ohne Bezeichnung kein Speichern');
  S.jaJtLoeschen();
  pruefe(!S.DB.jahrestermine.some(e => e.id === anna.id) && (S.DB.grabsteine || []).some(g => g.s === 'jahrestermine' && g.id === anna.id), 'Löschen mit Grabstein');
  /* Tag antippen */
  S.jaAnsicht('raster'); S.jaFilter('');
  S.jaTagOeffnen(vor(18));
  const f = S.document.getElementById('aufklapp').innerHTML;
  pruefe(/Brunch bei Sabine/.test(f) && /jaZuordnen\('b1','besuche'\)/.test(f) && /clKalGehe/.test(f), 'Tag antippen: Termine mit Art-Auswahl, „Zum Tag“');
  S.jaFensterZu();
  /* Blättern und Kontext */
  pruefe(!/ja-kopf|jaJahrUm\(-1\)/.test(inhalt()) && S.document.getElementById('katKnopf').textContent === '▼ ' + j && S.document.getElementById('reiter').textContent === 'Jahr', 'das Jahr steht nur oben (seit 0.38.1 kein zweiter Wähler)');
  pruefe(!/class="ja-chips"/.test(inhalt()) && /onclick="jaArtAuf\(\)">.*▼ Alle Arten/.test(inhalt()), 'Arten als Knopf ▼ statt einer Reihe (seit 0.38.2)');
  const zahlen = (inhalt().match(/<b>(\d{1,2})<\/b>/g) || []).map(x => Number(x.replace(/\D/g, '')));
  pruefe(zahlen.length === 31 && zahlen.every((z, i) => z === i + 1), 'links alle Tage 1–31');
  S.jaArtAuf();
  const aw = S.document.getElementById('aufklapp').innerHTML;
  pruefe(S.cl.aufklapp === 'jahrart' && /jaFilter\('besuche'\)/.test(aw) && /jaFilter\('ferien'\)/.test(aw) && /Alle Arten/.test(aw), 'Auswahl: alle Arten, Ferien');
  S.jaFilter('besuche');
  pruefe(!S.cl.aufklapp && /▼ <i style="background:#56604A"><\/i>Besuche/.test(inhalt()), 'gewählt: Knopf zeigt die Art mit ihrer Abstufung');
  S.jaFilter('');
  S.katUm();
  const jw = S.document.getElementById('aufklapp').innerHTML;
  pruefe(S.cl.aufklapp === 'jahrwahl' && new RegExp('jaJahrSetzen\\(' + (j - 1) + '\\)').test(jw) && /katSetzen\('privat'\)/.test(jw), 'oben rechts: Jahre und Beruf/Privat');
  S.jaJahrSetzen(j - 1);
  pruefe(S.cl.ja.jahr === j - 1 && !S.cl.aufklapp && S.document.getElementById('katKnopf').textContent === '▼ ' + (j - 1), 'Jahr gewählt');
  S.cl.ja.jahr = j;
  S.clBlaettern(1);
  pruefe(S.cl.ja.jahr === j + 1, 'Wischen blättert das Jahr');
  S.cl.ja.jahr = j;
  S.katSetzen('beruflich');
  pruefe(!S.jaAn(tagG).some(x => x.id === 'g1'), 'Filter Beruf/Privat gilt auch im Jahr');
  S.katSetzen('alle');
  S.clKalAnsicht('tag');
  S.oeffne('uebersicht');
}

/* ============================================================
   73. Notizen wie das Memo Pad (0.43; vorher Bereichsauswahl 0.36)
   Grund: Seit 0.43 stehen Projekte und Ziele in eigener App; Memo heißt
   „Notizen“ und ist eine schlichte, nummerierte Liste der Notizen — die
   Bereichsauswahl von 0.36 ist damit gestrichen.
   Erkennt: Projekte/Ziele/Checklisten wieder in Notizen, Bereichsknopf
   wieder da, Nummern fehlen, Filter Beruf/Privat wirkungslos.
   ============================================================ */
function memoBereichTest() {
  console.log('\n73. Notizen wie das Memo Pad (0.43)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.DB.projekte.push({ id: 'p1', name: 'Carport', flaeche: '[] Angebot', status: 'laufend', geaendert: 1 });
  S.DB.ziele.push({ id: 'z1', name: 'Marathon', flaeche: '', status: 'laufend', geaendert: 1 });
  S.DB.gedanken.push({ id: 'n1', titel: 'Ideen Garten', text: 'x', kontext: 'privat', ordnung: 1, geaendert: 1 });
  S.DB.gedanken.push({ id: 'n2', titel: 'Teamregeln', text: 'y', kontext: 'beruflich', ordnung: 2, geaendert: 1 });
  S.DB.gedanken.push({ id: 'c1', titel: 'Packliste', text: '[] a', checkliste: 'vorlage', ordnung: 3, geaendert: 1 });
  S.oeffne('memo');
  let h = inhalt();
  pruefe(/<span class="mz nr">1\.<\/span><span class="tx">Ideen Garten/.test(h) && /<span class="mz nr">2\.<\/span><span class="tx">Teamregeln/.test(h), 'nummerierte Notizen wie am Palm');
  pruefe(!/Carport|Marathon|Packliste/.test(h) && !/memo-bereich/.test(h) && !/function memoBereich/.test(SKRIPT), 'keine Projekte, Ziele, Checklisten — und keine Bereichsauswahl mehr');
  S.memoNeu();
  pruefe(/Neue Notiz/.test(S.document.getElementById('aufklapp').innerHTML) && !/◎ Projekt/.test(S.document.getElementById('aufklapp').innerHTML), 'Neu legt nur Notizen an');
  S.aufklappZu();
  S.katSetzen('beruflich');
  pruefe(/Teamregeln/.test(inhalt()) && !/Ideen Garten/.test(inhalt()), 'Filter ▼ Beruf/Privat oben rechts gilt weiter');
  S.katSetzen('alle');
  S.oeffne('uebersicht');
}

/* ============================================================
   72. Start mit Ordnern (0.35)
   Grund: Zu viele Apps auf dem Start verwässerten CLIE. Seit 0.35 ein
   3×4-Raster mit dem, was ständig gebraucht wird, dazu drei Ordner:
   Planung (Routinen, Ideenwerkstatt), Lernen (Lernkartei, Drive),
   Spiele (Sudoku, Solitär, Stones, Schach).
   Erkennt: App in keinem Ordner und nicht im Raster (unerreichbar),
   App doppelt, Ordner öffnet nicht, Zurück führt nicht in den Ordner.
   ============================================================ */
function startOrdnerTest() {
  console.log('\n72. Start mit Ordnern (0.35)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const raster = S.CL_APPS.filter(a => a.raster !== false).map(a => a.id);
  const imOrdner = [].concat(...Object.keys(S.CL_ORDNER).map(k => S.CL_ORDNER[k].apps));
  /* „checklisten“ ist seit 0.61 die Listen-Ansicht von To Do — erreichbar über dessen ▼ */
  /* „kategorien“ seit 0.66.2 über das ▼ der Übersicht */
  const leiste = ['lesezeichen', 'abgleich', 'kurs', 'checklisten', 'kategorien'];
  const weg = S.CL_APPS.map(a => a.id).filter(id => !S.CL_ORDNER[id] && raster.indexOf(id) < 0 && imOrdner.indexOf(id) < 0 && leiste.indexOf(id) < 0);
  pruefe(weg.length === 0, 'jede App ist erreichbar: im Raster, in einem Ordner oder in der Leiste' + (weg.length ? ' — fehlt: ' + weg.join(', ') : ''));
  const doppelt = imOrdner.filter((id, i) => imOrdner.indexOf(id) !== i || raster.indexOf(id) >= 0);
  pruefe(doppelt.length === 0, 'keine App doppelt (Raster und Ordner)');
  pruefe(raster.length === 12 && Object.keys(S.CL_ORDNER).every(k => raster.indexOf(k) >= 0 && S.CL_BILD[k]), 'drei Ordner im Raster, mit eigenem Symbol');
  S.oeffne('uebersicht');
  pruefe((inhalt().match(/class="ord">▸/g) || []).length === 3, 'Ordner am ▸ erkennbar');
  pruefe(/clsLaufZahlHtml|class="sym"/.test(inhalt()) && !/oeffne\('routinen'\)|oeffne\('drive'\)/.test(inhalt()), 'Routinen und Drive nicht mehr auf dem Start');
  [['planung', ['routinen', 'ideen']], ['lernen', ['lernkartei', 'drive']]].forEach(([o, apps]) => {
    S.oeffne(o);
    const h = S.document.getElementById('aufklapp').innerHTML;
    pruefe(S.cl.aufklapp === 'ordner' && S.cl.ordner === o && apps.every(id => new RegExp("ordnerWahl\\('" + id + "'\\)").test(h)) && /Schließen/.test(h), 'Ordner ' + o + ': ' + apps.join(', '));
    S.ordnerWahl(apps[0]);
    pruefe(S.cl.app === apps[0] && !S.cl.aufklapp, apps[0] + ' öffnet aus dem Ordner');
    S.clZurueck();
    pruefe(S.cl.app === 'uebersicht' && S.cl.ordner === o && S.cl.aufklapp === 'ordner', 'Zurück aus ' + apps[0] + ': wieder im Ordner ' + o);
    S.clZurueck();
    pruefe(!S.cl.aufklapp, 'nochmal Zurück: Ordner zu');
  });
  S.oeffne('planung');
  pruefe(/Routinen: /.test(S.document.getElementById('aufklapp').innerHTML) && /Ideenwerkstatt: \d+ in Umsetzung/.test(S.document.getElementById('aufklapp').innerHTML), 'Ordner zeigt den Stand je App');
  S.aufklappZu();
  pruefe(/oeffne\('rechner'\)/.test((S.oeffne('uebersicht'), inhalt())) && /oeffne\('vorlesen'\)/.test(inhalt()) && /oeffne\('memo'\)/.test(inhalt()), 'Rechner, Vorlesen und Memo direkt auf dem Start');
}

/* ============================================================
   71. Coach mit allen Quellen (0.34)
   Grund: Der Coach soll auch Aufgaben-Listen, Kalender, Routinen,
   Ideenwerkstatt und Sammlungen kennen — mit Rang, Obergrenze und
   Schaltern je Quelle.
   Erkennt: Vorschläge fehlen bei leerem Tag, Dauerschieber/Überfälliges
   nicht erkannt, Antworten ohne Wirkung (einplanen, Routine abhaken,
   Wert eintragen, Kündigungs-Aufgabe), Obergrenze/Rang verletzt,
   abgeschaltete Quelle fragt trotzdem, Ruhe wird nicht eingehalten.
   ============================================================ */
function coachQuellenTest() {
  console.log('\n71. Coach mit allen Quellen (0.34)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  const gestern = S.tagePlus(heute, -1);
  const morgen = S.tagePlus(heute, 1);
  S.localStorage.removeItem('clie-coach-gesehen');
  S.cl.co.tag = ''; S.cl.co.ansicht = 'verlauf';
  S.termineNachTag = {};
  S.krSpeichern({ id: 'kc-einstellungen', typ: 'coach', max: 12 });
  /* Aufgaben: Vorschläge bei leerem Tag */
  const s = S.kpSeiteAnlegen('liste', 'Büro', 'beruflich', '');
  s.text = '[] P1 Angebot Müller\n[] P1 Heizung Termin\n[] P3 Ablage\n[] Steuer-Unterlagen';
  const mo = S.coFaellige('07:40', heute).filter(f => f.id === 'morgen')[0];
  /* seit 0.53: „Muss und Will“ — Warteschlange nach Priorität, so viel wie in die freie Zeit passt */
  pruefe(mo && /Frei heute: etwa/.test(mo.text) && /Will — nach deinen Prioritäten: „Angebot Müller“ \(1 · 30 Min\), „Heizung Termin“ \(1 · 30 Min\), „Ablage“ \(3 · 30 Min\)/.test(mo.text)
    && mo.antworten.map(a => a[0]).join() === 'nehmen,nehmen,nehmen,alle,selbst,vornehmen' && mo.quelle === '☑ Aufgaben',
    'leerer Tag: Vorschläge aus der Warteschlange (P1 zuerst), Quelle sichtbar');
  S.coAntwort('morgen', 'nehmen', 1, '07:40');
  pruefe(S.coTagDaten(heute).offen.some(z => /Heizung Termin/.test(z.a.text)), '„Heizung Termin“ antippen: für heute vorgenommen');
  /* Dauerschieber: drei vergangene Tage liegen gelassen */
  const st = 'Steuer-Unterlagen';
  [3, 2, 1].forEach(n => { const tg = S.kpTagAnlegen(S.tagePlus(heute, -n)); tg.text = '[] ' + st; tg.eintraege = [{ id: 'e' + n, abschnitt: 'h', text: st, quelle: s.id, erledigt: false }]; });
  S.aufPlanAnwenden(s, 3, heute, '');
  pruefe(S.coSchiebeZahl(st, heute) === 3, 'Verschiebungen gezählt (liegen gelassene Tage)');
  const ds = S.coFaellige('08:00', heute).filter(f => f.id === 'ds:' + st)[0];
  pruefe(ds && /3-mal verschoben/.test(ds.text) && ds.antworten.map(a => a[0]).join() === 'klein,fest,p4,streichen' && /Ist das wirklich eine 3\?/.test(ds.text), 'Dauerschieber: „3-mal verschoben. Ist das wirklich eine 3?“ — mit „Auf P4“ (0.53)');
  S.coAntwort('ds:' + st, 'streichen', 2, '08:00');
  pruefe(/\[-\] Steuer-Unterlagen/.test(s.text) && !S.coTagDaten(heute).offen.some(z => z.a.text === st), 'Streichen: als „nicht relevant“ markiert, aus dem Tag');
  /* Überfälliges */
  s.text += '\n[] Rechnung prüfen';
  const tg2 = S.kpTagFinden(gestern); tg2.text += '\n[] Rechnung prüfen'; tg2.eintraege.push({ id: 'eR', abschnitt: 'h', text: 'Rechnung prüfen', quelle: s.id, erledigt: false });
  const ue = S.coFaellige('08:00', heute).filter(f => f.id === 'ue:Rechnung prüfen')[0];
  pruefe(ue && /war für .* geplant und ist noch offen/.test(ue.text), 'Überfälliges: gestern geplant, noch offen, nicht neu eingeplant');
  S.coAntwort('ue:Rechnung prüfen', 'heute', 0, '08:00');
  pruefe(S.coTagDaten(heute).offen.some(z => z.a.text === 'Rechnung prüfen') && !S.coUeberfaellig(heute).some(u => u.text === 'Rechnung prüfen'), '„Heute“: eingeplant, nicht mehr überfällig');
  /* Kalender: voller Tag morgen, nach dem Termin */
  S.termineNachTag[morgen] = [9, 11, 14].map((h, i) => ({ id: 'm' + i, titel: 'T' + i, rohTitel: 'T' + i, zeit: S.zwei(h) + ':00', bis: S.zwei(h + 2) + ':00', ganztags: false, kontext: '' }));
  ['A', 'B'].forEach(x => { const nr = S.aufZeileAnhaengen(s, 'Morgen ' + x); S.aufPlanAnwenden(s, nr, morgen, ''); });
  const kv = S.coFaellige('16:40', heute).filter(f => f.id === 'kv:' + morgen)[0];
  pruefe(kv && /Morgen 6 Std\. Termine — für deine 2 Aufgaben/.test(kv.text) && !S.coFaellige('12:00', heute).some(f => /^kv:/.test(f.id)), 'Kalender: voller Tag morgen (ab Nachmittag)');
  S.termineNachTag[heute] = [{ id: 'tr', titel: 'Team-Runde', rohTitel: 'Team-Runde', zeit: '10:00', bis: '11:00', ganztags: false, kontext: '' }];
  pruefe(S.coFaellige('11:20', heute).some(f => f.id === 'tn:tr' && /„Team-Runde“ ist vorbei\. Ergibt sich daraus etwas zu tun\?/.test(f.text)) && !S.coFaellige('13:30', heute).some(f => f.id === 'tn:tr'),
    'Kalender: nach dem Termin (bis zwei Stunden danach)');
  S.coAntwort('tn:tr', 'ja', 0, '11:20');
  pruefe(S.cl.aufklapp === 'aufgabe' && S.cl.auf.fenster && S.cl.auf.fenster.modus === 'neu', '„Ja → Aufgabe“ öffnet „Neue Aufgabe“');
  S.aufklappZu();
  /* Routinen */
  const wt = S.ausIso(heute).getDay();
  S.DB.aufgaben.push({ id: 'rj', titel: 'Joggen', wiederholung: { takt: 'woche', tage: [0, 1, 2, 3, 4, 5, 6], intervall: 1 }, ab: S.tagePlus(heute, -10), kontext: '', geaendert: 1 });
  const rr = S.coFaellige('08:00', heute).filter(f => f.id === 'rr:rj')[0];
  pruefe(rr && /jetzt 10-mal ausgelassen/.test(rr.text), 'Routine: Reihe ausgelassen erkannt');
  pruefe(!S.coFaellige('12:00', heute).some(f => f.id === 'ro:rj') && S.coFaellige('20:40', heute).some(f => f.id === 'ro:rj' && /steht heute noch aus/.test(f.text)), 'Routine: abends „steht heute noch aus“');
  S.coAntwort('ro:rj', 'ja', 0, '20:40');
  const rj = S.DB.aufgaben.filter(a => a.id === 'rj')[0];
  pruefe(S.istErledigtAn(rj, heute), '„Erledigt“: Routine für heute abgehakt');
  S.coAntwort('rr:rj', 'pause', 2, '20:41');
  pruefe(rj.pausiert === true, '„Pausieren“: Routine pausiert');
  /* Ideenwerkstatt: Stillstand */
  S.DB.ideen = [{ id: 'iw-x', titel: 'Fotobuch', stufe: 6, status: 'aktiv', zuletzt: S.tagePlus(heute, -12), schritte: [{ id: 's1', text: 'Bilder sichten', erledigt: false }], varianten: [], meilensteine: [], wochen: [] }];
  const is = S.coFaellige('20:45', heute).filter(f => f.id === 'is:iw-x')[0];
  pruefe(is && /Seit 12 Tagen nichts an „Fotobuch“/.test(is.text) && !S.coFaellige('12:00', heute).some(f => f.id === 'is:iw-x'), 'Idee steht still: abends nachgefragt');
  S.coAntwort('is:iw-x', 'pause', 1, '20:45');
  pruefe(S.iwFinden('iw-x').status === 'spaeter' && S.iwFinden('iw-x').wiedervorlage === S.tagePlus(heute, 14), '„Pausieren“: kommt in zwei Wochen wieder');
  /* Sammlungen: regelmäßig, Eintrag in der Antwort, Trend, Frist */
  S.DB.sammlungen = [{ id: 'sg', name: 'Gewicht', felder: [{ id: 'fd', name: 'Datum', typ: 'datum' }, { id: 'fk', name: 'kg', typ: 'zahl' }], rollen: {}, geaendert: 1 },
    { id: 'sab', name: 'Abos', art: 'abos', felder: [{ id: 'an', name: 'Name', typ: 'text' }, { id: 'alz', name: 'Laufzeit', typ: 'datum' }, { id: 'afr', name: 'Frist', typ: 'zahl' }], rollen: { laufzeit: 'alz', frist: 'afr' }, geaendert: 1 }];
  S.DB.datensaetze = [];
  [20, 16, 12, 8, 4].forEach((n, i) => S.DB.datensaetze.push({ id: 'g' + n, sammlung: 'sg', werte: { fd: S.tagePlus(heute, -n), fk: 78 + i * 0.6 }, angelegt: 1, geaendert: 1 }));
  const e = S.krFinden('kc-einstellungen') || { id: 'kc-einstellungen', typ: 'coach' };
  e.sammlungen = { sg: { takt: 'taeglich', ab: '18:00' } }; S.krSpeichern(e);
  pruefe(!S.coFaellige('17:00', heute).some(f => f.id === 'se:sg') && S.coFaellige('18:05', heute).some(f => f.id === 'se:sg' && f.eingabe === 'kg'), 'Sammlung täglich: ab 18:00 „heute noch nicht eingetragen“ mit Eingabefeld');
  const tr = S.coFaellige('18:05', heute).filter(f => f.id === 'st:sg')[0];
  pruefe(tr && /seit drei Wochen steigend \(78 → 80,4\)/.test(tr.text), 'Trend erkannt: steigend');
  S.coAntwort('se:sg', 'eintragen', 0, '18:05', '80,4');
  const neu = S.DB.datensaetze.filter(d => d.sammlung === 'sg' && d.werte.fd === heute)[0];
  pruefe(neu && neu.werte.fk === 80.4 && !S.coFaellige('18:10', heute).some(f => f.id === 'se:sg'), '„Eintragen“: Wert mit heutigem Datum gespeichert, Frage erledigt');
  pruefe(S.coTag(false, heute).coach.verlauf.some(f => f.id === 'se:sg' && /Eintragen: 80,4/.test(f.antwortText)), 'Antwort zeigt den Wert');
  S.DB.datensaetze.push({ id: 'ab1', sammlung: 'sab', werte: { an: 'Netflix', alz: S.saMonatePlus(S.tagePlus(heute, 6), 1), afr: 1 }, angelegt: 1, geaendert: 1 });
  const sf = S.coFaellige('09:00', heute).filter(f => f.id === 'sf:ab1')[0];
  pruefe(sf && /„Netflix“ ist bis .* kündbar — noch \d+ Tage/.test(sf.text) && sf.rang === 1, 'Kündigungsfrist: Rang 1');
  S.coAntwort('sf:ab1', 'kuendigen', 0, '09:00');
  const coachL = S.kpSeitenAlle().filter(x => x.titel === 'Coach')[0];
  pruefe(coachL && /Kündigen: Netflix/.test(coachL.text) && !S.coFaellige('09:05', heute).some(f => f.id === 'sf:ab1') && S.coRuhig('sf:ab1', heute), '„Kündigen“: Aufgabe für heute, Frage ruht bis zur Frist');
  /* Obergrenze und Rang */
  S.localStorage.removeItem('clie-coach-gesehen');
  e.max = 4; S.krSpeichern(e);
  const v = S.coVerlauf('20:50', heute);
  const beantwortet = S.coTag(false, heute).coach.verlauf.length;
  pruefe(v.length === Math.max(4, beantwortet), 'Obergrenze: höchstens ' + 4 + ' Fragen am Tag (' + v.length + ')');
  e.max = 12; S.krSpeichern(e);
  S.localStorage.removeItem('clie-coach-gesehen');
  const alle = S.coFaellige('20:50', heute).filter(f => !S.coTag(false, heute).coach.verlauf.some(x => x.id === f.id));
  e.max = beantwortet + 1; S.krSpeichern(e);
  S.localStorage.removeItem('clie-coach-gesehen');
  const eine = S.coVerlauf('20:50', heute).filter(f => !f.antwort);
  const besterRang = Math.min.apply(null, alle.map(f => f.rang));
  pruefe(eine.length === 1 && eine[0].rang === besterRang, 'bei knapper Grenze gewinnt der beste Rang');
  S.termineNachTag[heute] = [{ id: 'spaet', titel: 'Elternabend', rohTitel: 'Elternabend', zeit: '21:15', bis: '22:00', ganztags: false, kontext: '' }];
  e.max = 1; S.krSpeichern(e);
  pruefe(S.coVerlauf('20:50', heute).some(f => f.id === 'tv:spaet' && !f.antwort), 'Termine (Rang 1) kommen auch über der Grenze');
  S.termineNachTag[heute] = [];
  e.max = 8; S.krSpeichern(e);
  /* Schalter je Quelle */
  e.quellen = { aufgaben: true, kalender: true, routinen: false, ideen: true, sammlungen: false }; S.krSpeichern(e);
  rj.pausiert = false;
  pruefe(!S.coFaellige('20:50', heute).some(f => /^(ro|rr|se|st|sf):/.test(f.id)), 'abgeschaltete Quellen (Routinen, Sammlungen) fragen nicht');
  e.quellen = {}; S.krSpeichern(e);
  /* Einstellungen */
  S.oeffne('coach'); S.coEinstOeffnen();
  pruefe(/coQ-routinen/.test(inhalt()) && /coS-sg/.test(inhalt()) && /coMax/.test(inhalt()) && /coFrist/.test(inhalt()), 'Einstellungen: Quellen, Sammlungen (Takt, ab), Obergrenze, Fristen');
  ['morgen', 'mittag', 'nachmittag', 'abend'].forEach((z, i) => { S.document.getElementById('coZ-' + z).value = ['07:30', '12:30', '16:30', '20:30'][i]; });
  S.document.getElementById('coVorlauf').value = '45'; S.document.getElementById('coKal').checked = false;
  S.document.getElementById('coQ-ideen').checked = false; ['aufgaben', 'kalender', 'routinen', 'sammlungen'].forEach(q => { S.document.getElementById('coQ-' + q).checked = true; });
  S.document.getElementById('coMax').value = '6'; S.document.getElementById('coFrist').value = '14';
  S.document.getElementById('coS-sg').value = 'woechentlich'; S.document.getElementById('coSab-sg').value = '19:00';
  S.document.getElementById('coS-sab').value = '';
  S.coEinstSpeichern();
  const e2 = S.coEinst();
  pruefe(e2.quellen.ideen === false && e2.max === 6 && e2.frist === 14 && e2.sammlungen.sg.takt === 'woechentlich' && e2.sammlungen.sg.ab === '19:00' && !e2.sammlungen.sab, 'Einstellungen gespeichert');
  pruefe(!S.coFaellige('19:30', heute).some(f => f.id === 'se:sg'), 'wöchentlich: Eintrag dieser Woche genügt');
  /* Anzeige und Tippen */
  S.oeffne('uebersicht');
  pruefe(/co-q|Coach · \d/.test(inhalt()) || /co-zeile-still/.test(inhalt()), 'Übersicht zeigt die Quelle der Frage');
  S.document.activeElement = { id: 'coIn0', value: '80' };
  const vorher = inhalt(); S.document.getElementById('inhalt').innerHTML = vorher + '<!--tippt-->'; S.inhaltZeichnen();
  pruefe(/<!--tippt-->/.test(inhalt()), 'beim Tippen einer Antwort wird nicht neu gezeichnet');
  S.document.activeElement = null;
  S.oeffne('uebersicht');
}

/* ============================================================
   69. Coach (0.33)
   Grund: Kurs war eine Doku-App mit Fragebogen am Morgen. Gewünscht ist
   ein Assistent, der von sich aus anspricht: „Du hast dir X vorgenommen —
   wie steht es?“, Termine vorbereiten lässt, an Vorsätze erinnert und
   abends Bilanz zieht. Antworten wirken (verschieben, aus dem Tag nehmen,
   Vorbereitungs-Aufgabe anlegen).
   Erkennt: Fragen zur falschen Zeit, Erledigtes wird weiter abgefragt,
   Antworten ohne Wirkung, bloßes Anzeigen schreibt in die workbench.json,
   Coach-Termine erscheinen in CLIE, Energie-Frage taucht wieder auf.
   ============================================================ */
function coachTest() {
  console.log('\n69. Coach (0.33)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  const morgen = S.tagePlus(heute, 1);
  S.localStorage.removeItem('clie-coach-gesehen');
  S.cl.co.tag = ''; S.cl.co.ansicht = 'verlauf';
  const s = S.kpSeiteAnlegen('liste', 'Haus', 'privat', '');
  ['Steuer-Unterlagen sortieren', 'P1 Angebot Müller', 'Keller aufräumen', 'Fahrrad flicken'].forEach(x => { const nr = S.aufZeileAnhaengen(s, x); S.aufPlanAnwenden(s, nr, heute, ''); });
  S.termineNachTag = {}; S.termineNachTag[heute] = [{ id: 'tr1', titel: 'Team-Runde', rohTitel: 'Team-Runde', zeit: '10:00', bis: '11:00', ganztags: false, kontext: '' },
    { id: 'tc1', titel: 'Coach: Halbzeit', rohTitel: 'Coach: Halbzeit', zeit: '12:30', bis: '12:35', ganztags: false, kontext: '' }];
  pruefe(S.clApp('coach') && S.CL_BILD.coach && S.clApp('kurs').raster === false, 'App „Coach“ da, Kurs liegt darunter (seit 0.62 wieder nicht im Raster)');
  pruefe(S.clTermineAm(heute).zeit.length === 1 && S.coTagDaten(heute).termine.length === 1, 'Coach-Termine („Coach: …“) sind in CLIE ausgeblendet');
  /* Morgen */
  const m = S.coFaellige('07:45', heute);
  const mo = m.filter(f => f.id === 'morgen')[0];
  pruefe(mo && /Vorgenommen für heute/.test(mo.text) && /Angebot Müller/.test(mo.text) && /Team-Runde|Termine: 1/.test(mo.text) && /Womit fängst du an\?/.test(mo.text), 'morgens: was vorgenommen ist, die Termine, „Womit fängst du an?“');
  pruefe(mo.antworten[0][1] === 'Angebot Müller' && mo.antworten.some(a => a[0] === 'vornehmen'), 'Antworten: die Aufgaben (P1 zuerst) und „+ Vornehmen“');
  pruefe(!m.some(f => /Energie/.test(f.text)) && !S.coFaellige('07:00', heute).some(f => f.id === 'morgen'), 'keine Energie-Frage; vor 7:30 noch still');
  /* Termin vorbereiten */
  const tv = S.coFaellige('09:20', heute).filter(f => /^tv:/.test(f.id))[0];
  pruefe(tv && /In 40 Min\.: „Team-Runde“/.test(tv.text) && !S.coFaellige('09:00', heute).some(f => /^tv:/.test(f.id)), 'Termin: 45 Min. vorher „Ist alles vorbereitet?“');
  const vorher = S.alsText().replace(/"gespeichert": "[^"]*"/, '');
  const v1 = S.coVerlauf('09:20', heute);
  pruefe(S.alsText().replace(/"gespeichert": "[^"]*"/, '') === vorher && v1.length >= 2, 'Anzeigen allein schreibt nichts in die workbench.json');
  S.coAntwort(tv.id, 'nein', 1, '09:20');
  const coachListe = S.kpSeitenAlle().filter(x => x.titel === 'Coach')[0];
  pruefe(coachListe && /Vorbereiten: Team-Runde/.test(coachListe.text) && S.coTagDaten(heute).offen.some(z => /Vorbereiten: Team-Runde/.test(z.a.text)), '„Noch nicht“: Aufgabe „Vorbereiten: Team-Runde“ für heute');
  pruefe(S.coTag(false, heute).coach.verlauf.filter(f => f.id === tv.id && f.antwort === 'nein').length === 1, 'die Antwort ist im Tag gespeichert');
  pruefe(!S.coVerlauf('09:25', heute).some(f => f.id === tv.id && !f.antwort), 'beantwortet: wird nicht erneut gefragt');
  /* Mittag */
  const steuerNr = S.clTagZeilen(heute).filter(z => z.a && /Angebot/.test(z.a.text))[0].nr;
  S.clTagZeileUm(heute, steuerNr);
  const mi = S.coFaellige('12:40', heute).filter(f => f.id === 'mittag')[0];
  pruefe(mi && /Halbzeit: „Angebot Müller“ ✓/.test(mi.text) && /schaffst du das heute noch\?/.test(mi.text) && mi.antworten.map(a => a[0]).join() === 'ja,morgen,lass', 'Halbzeit: Erledigtes ✓, nächstes Offenes mit Ja / Morgen / Lass ich');
  const offen1 = mi.bezug.text;
  S.coAntwort('mittag', 'morgen', 1, '12:40');
  pruefe(!S.coTagDaten(heute).offen.some(z => z.a.text === offen1) && S.clTagZeilen(morgen).some(z => z.a && z.a.text === offen1), '„Morgen“: Aufgabe auf morgen verschoben');
  /* Nachmittag: je offene Aufgabe, Erledigtes fällt heraus */
  const nm = S.coFaellige('16:40', heute).filter(f => /^nm:/.test(f.id));
  pruefe(nm.length >= 2 && nm.length <= 3 && !nm.some(f => /Angebot/.test(f.id)), 'Nachmittag: nur noch Offenes, höchstens drei');
  const kel = nm.filter(f => /Keller/.test(f.id))[0];
  S.coAntwort(kel.id, 'lass', 2, '16:40');
  const kz = S.kpZeileSuchen(s, 'Keller aufräumen');
  pruefe(!S.coTagDaten(heute).offen.some(z => /Keller/.test(z.a.text)) && kz && !kz.erledigt, '„Lass ich“: aus dem Tag genommen, bleibt in der Liste');
  /* Vorsätze */
  S.krSpeichern({ id: 'kp-t1', typ: 'prinzip', rang: 1, text: 'Kein Handy', konkret: 'ins Regal legen', zeit: '21:00', zeitArt: 'ab' });
  S.krSpeichern({ id: 'kp-t2', typ: 'prinzip', rang: 2, text: '20 Min. spazieren', zeit: '18:00', zeitArt: 'bis' });
  pruefe(!S.coFaellige('20:30', heute).some(f => f.id === 'vs:kp-t1') && S.coFaellige('20:46', heute).some(f => f.id === 'vs:kp-t1' && /Ab 21:00 gilt dein Vorsatz: „Kein Handy“ — ins Regal legen/.test(f.text)), 'Vorsatz „ab“: eine Viertelstunde vorher');
  const sp = S.coFaellige('17:10', heute).filter(f => f.id === 'vs:kp-t2')[0];
  pruefe(sp && /Bis 18:00 wolltest du/.test(sp.text) && sp.antworten.length === 3 && !S.coFaellige('16:50', heute).some(f => f.id === 'vs:kp-t2'), 'Vorsatz „bis“: eine Stunde vorher „Schon geschafft?“');
  /* Abend */
  const ab = S.coFaellige('20:35', heute).filter(f => f.id === 'abend')[0];
  pruefe(ab && /Heute erledigt: 1 von/.test(ab.text) && ab.antworten[0][0] === 'alle-morgen', 'Abend: Bilanz und „Alles auf morgen“');
  S.coAntwort('abend', 'alle-morgen', 0, '20:35');
  pruefe(S.coTagDaten(heute).offen.length === 0 && S.clTagZeilen(morgen).filter(z => z.a && !z.a.erledigt).length >= 3, 'Alles Offene steht morgen an');
  pruefe(S.coFaellige('20:40', heute).filter(f => f.id === 'abend')[0].antworten[0][0] === 'ok', 'danach: „Alles erledigt“');
  /* Übersicht, App, Tag-Auswahl, Zurück */
  S.localStorage.removeItem('clie-coach-gesehen');
  S.oeffne('uebersicht');
  pruefe(/co-oben|co-zeile-still/.test(inhalt()) && /oeffne\('coach'\)/.test(inhalt()), 'Übersicht: oben spricht der Coach');
  S.oeffne('coach');
  pruefe(/co-verlauf/.test(inhalt()) && /Team-Runde/.test(inhalt()) && /co-msg ich/.test(inhalt()), 'Coach-App: Tagesverlauf mit Fragen und Antworten');
  pruefe(/aufNeuAm\(isoDatum\(\)/.test(S.document.getElementById('fuss').innerHTML) && /coMehr\('prinzipien'\)/.test(S.document.getElementById('fuss').innerHTML), 'unten: + Vornehmen, Vorsätze, Mehr…');
  S.katUm();
  pruefe(S.cl.aufklapp === 'cotag' && /Gestern/.test(S.document.getElementById('aufklapp').innerHTML), '▾: die letzten Tage');
  S.coTagWahl(S.tagePlus(heute, -1));
  pruefe(S.cl.co.tag && /still/.test(inhalt()), 'gestern ohne Coach: „still“');
  S.clZurueck();
  pruefe(S.cl.co.tag === '' && S.cl.app === 'coach', 'Zurück: wieder heute');
  S.coMehrAuf();
  pruefe(/coMehr\('bilanz'\)/.test(S.document.getElementById('aufklapp').innerHTML) && /coMehr\('woche'\)/.test(S.document.getElementById('aufklapp').innerHTML) && /coEinstOeffnen/.test(S.document.getElementById('aufklapp').innerHTML), 'Mehr: Einstellungen, Fokus & Bereiche, Woche & Rückblick, Pfade');
  S.coMehr('bilanz');
  pruefe(S.cl.app === 'kurs' && S.cl.kr.ansicht === 'bilanz', 'Mehr → Kurs-Bilanz');
  S.clZurueck();
  pruefe(S.cl.app === 'coach', 'aus Kurs zurück zum Coach');
  /* Einstellungen */
  S.coEinstOeffnen();
  pruefe(/coZ-mittag/.test(inhalt()) && /coKal/.test(inhalt()), 'Einstellungen: Zeiten, Vorlauf, Kalender');
  S.document.getElementById('coZ-morgen').value = '07:30'; S.document.getElementById('coZ-mittag').value = '13:00';
  S.document.getElementById('coZ-nachmittag').value = '16:30'; S.document.getElementById('coZ-abend').value = '21:00';
  S.document.getElementById('coVorlauf').value = '30'; S.document.getElementById('coKal').checked = false;
  S.coEinstSpeichern();
  const e = S.coEinst();
  pruefe(e.mittag === '13:00' && e.abend === '21:00' && e.vorlauf === 30 && e.kalender === false && S.cl.co.ansicht === 'verlauf', 'Einstellungen gespeichert (synchronisiert über „kurs“)');
  pruefe(!S.coFaellige('12:40', heute).some(f => f.id === 'mittag'), 'Mittag jetzt erst ab 13:00');
  /* Vorsatz mit Uhrzeit im Prinzip-Fenster */
  S.oeffne('kurs'); S.krAnsicht('prinzipien'); S.krPrinzipOeffnen('kp-t1');
  pruefe(/krPZeit/.test(inhalt()) && /krPArt/.test(inhalt()), 'Prinzip/Vorsatz: Uhrzeit „ab“ / „bis“');
  S.document.getElementById('krPText').value = 'Kein Handy'; S.document.getElementById('krPKonkret').value = '';
  S.document.getElementById('krPArt').value = 'bis'; S.document.getElementById('krPZeit').value = '22:15';
  S.krPrinzipSpeichern();
  pruefe(S.krFinden('kp-t1').zeit === '22:15' && S.krFinden('kp-t1').zeitArt === 'bis', 'Uhrzeit am Vorsatz gespeichert');
  S.oeffne('uebersicht');
}

/* ============================================================
   70. Coach: Vorab hinterfragen und Kalender-Erinnerungen (0.33)
   Grund: Neues soll vorab hinterfragt werden („Was fällt dafür weg?“);
   der Coach soll sich über den Kalender aufs Handy melden.
   Erkennt: Nachfrage bei Kleinkram, keine Nachfrage bei P1 oder vollem
   Tag, „Lass ich“ löscht nicht, „Bis Sonntag“ ohne Wiedervorlage,
   doppelte Kalender-Termine, Erinnerungen ohne Aufräumen.
   ============================================================ */
async function coachVorabTest() {
  console.log('\n70. Coach: Vorab hinterfragen und Kalender-Erinnerungen (0.33)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const heute = S.isoDatum();
  const s = S.kpSeiteAnlegen('liste', 'Verein', 'privat', '');
  S.termineNachTag = {};
  pruefe(!S.coVorabNoetig('Batterien kaufen', '') && S.coVorabNoetig('P1 Vereinsfest mitorganisieren', '') && S.coVorabNoetig('P2 Steuer', ''), 'Nachfrage bei Prio 1/2, nicht bei Kleinkram');
  ['A', 'B', 'C'].forEach(x => { const nr = S.aufZeileAnhaengen(s, x); S.aufPlanAnwenden(s, nr, heute, ''); });
  pruefe(S.coVorabNoetig('Noch etwas', heute) && !S.coVorabNoetig('Noch etwas', S.tagePlus(heute, 3)), 'Nachfrage, wenn der Tag schon drei offene Aufgaben hat');
  /* Neue Aufgabe über das Fenster */
  S.oeffne('aufgaben'); S.aufNeuAm(heute, '');
  S.cl.auf.fenster.seite = s.id; S.cl.auf.fenster.text = 'P1 Vereinsfest mitorganisieren';
  S.document.getElementById('aufText').value = 'P1 Vereinsfest mitorganisieren';
  S.aufSpeichern();
  pruefe(S.cl.aufklapp === 'covorab' && /Was fällt dafür weg\?/.test(S.document.getElementById('aufklapp').innerHTML) && /Vereinsfest/.test(S.document.getElementById('aufklapp').innerHTML), 'neue P1-Aufgabe: „Coach fragt nach“');
  S.document.getElementById('coWeg').value = 'Dienstag-Training';
  S.coVorabEntscheiden('spaeter');
  const o = S.krAlle('coachoffen')[0];
  const so = S.coSonntag(heute);
  pruefe(o && o.text === 'Vereinsfest mitorganisieren' && o.faellig === so && S.ausIso(so).getDay() === 0 && so > heute && o.weg === 'Dienstag-Training', '„Bis Sonntag überlegen“: Wiedervorlage am Sonntag, „fällt weg“ gemerkt');
  pruefe(!S.coTagDaten(heute).offen.some(z => /Vereinsfest/.test(z.a.text)) && /Vereinsfest/.test(s.text), 'bis dahin nicht für heute geplant, bleibt in der Liste');
  pruefe(S.krEntscheidungen('').some(x => x.quelle === 'coach' && /Dienstag-Training/.test(x.antwort)), 'Entscheidung im Buch (Kurs)');
  const oe = S.coFaellige('10:00', so).filter(f => f.id === 'oe:' + o.id)[0];
  pruefe(oe && /Du wolltest entscheiden: „Vereinsfest mitorganisieren“ \(dafür fiele weg: Dienstag-Training\)/.test(oe.text) && !S.coFaellige('10:00', heute).some(f => f.id === 'oe:' + o.id), 'am Sonntag fragt der Coach nach');
  S.cl.co.tag = ''; S.localStorage.removeItem('clie-coach-gesehen');
  S.coOffenEntscheiden(o.id, false);
  pruefe(!/Vereinsfest/.test(s.text) && S.krFinden(o.id).erledigt === 'nein', '„Lass ich“: Aufgabe gestrichen');
  /* Lass ich sofort */
  S.coVorabAuf({ art: 'aufgabe', text: 'P2 Grillabend', seite: s.id, datum: '' });
  S.aufZeileAnhaengen(s, 'P2 Grillabend');
  S.document.getElementById('coWeg').value = '';
  S.coVorabEntscheiden('lass');
  pruefe(!/Grillabend/.test(s.text) && !S.cl.aufklapp, 'sofort „Lass ich“: gelöscht, Fenster zu');
  /* Kalender-Erinnerungen */
  const abrufe = [];
  let nr = 0;
  S.zugriffToken = 'test'; S.tokenAblauf = Date.now() + 3600000;
  S.schreibKalender = [{ id: 'haupt', name: 'Privat', primary: true }, { id: 'coachkal', name: 'Coach', primary: false }];
  S.fetch = function (adresse, opt) {
    abrufe.push((opt && opt.method || 'GET') + ' ' + adresse + ' ' + ((opt && opt.body) || ''));
    nr++;
    return Promise.resolve({ ok: true, status: 200, json() { return Promise.resolve({ id: 'ev' + nr }); }, text() { return Promise.resolve(''); } });
  };
  S.cl.co.kalZuletzt = 0; S.cl.co.kalLaeuft = false;
  await S.coKalenderPlanen(true, '08:00', heute);
  const posts = abrufe.filter(a => /^POST /.test(a));
  pruefe(posts.length >= 3 && posts.every(a => /calendars\/coachkal\/events/.test(a)) && posts.every(a => /"summary":"Coach: /.test(a)) && posts.some(a => /Halbzeit/.test(a)),
    'Erinnerungen als „Coach: …“-Termine im Kalender „Coach“ (' + posts.length + ')');
  pruefe(posts.every(a => /"overrides":\[\{"method":"popup","minutes":0\}\]/.test(a)) && posts.every(a => /#coach/.test(a)), 'mit Benachrichtigung zur Zeit und Link zurück zum Coach');
  const kal = S.coTag(false, heute).coach.kal;
  pruefe(Object.keys(kal).length === posts.length && kal.mittag && kal.mittag.id, 'Termin-Kennungen im Tag gemerkt');
  abrufe.length = 0;
  await S.coKalenderPlanen(true, '08:00', heute);
  pruefe(abrufe.filter(a => /^(POST|PATCH|DELETE) /.test(a)).length === 0, 'unverändert: kein zweiter Termin');
  /* Alles erledigt: Mittag/Nachmittag fallen weg, Abend-Text ändert sich */
  S.clTagZeilen(heute).forEach(z => { if (z.a && !z.a.erledigt) { S.clTagZeileUm(heute, z.nr); } });
  abrufe.length = 0;
  await S.coKalenderPlanen(true, '08:00', heute);
  pruefe(abrufe.filter(a => /^DELETE /.test(a)).length === 2 && abrufe.some(a => /^PATCH .*Tagesrückblick/.test(a)) && !S.coTag(false, heute).coach.kal.mittag, 'nicht mehr nötig: gelöscht; geänderter Text: angepasst');
  /* Ohne Kalender „Coach“: Hauptkalender */
  S.schreibKalender = [{ id: 'haupt', name: 'Privat', primary: true }];
  let ziel = await S.coKalenderZiel();
  pruefe(ziel === 'haupt', 'ohne Kalender „Coach“: im Hauptkalender');
  /* Termin ab einer Stunde */
  pruefe(/dauer >= 60/.test(QUELLE) && /coVorabAuf\(\{ art: 'termin'/.test(QUELLE), 'neuer Termin ab einer Stunde: der Coach fragt nach');
  S.coVorabAuf({ art: 'termin', text: 'Vereinssitzung', dauer: '2 Std.', kalId: 'haupt', terminId: 'evX', datum: heute });
  abrufe.length = 0;
  S.coVorabEntscheiden('lass');
  await new Promise(r => setImmediate(r));
  pruefe(abrufe.some(a => /^DELETE .*calendars\/haupt\/events\/evX/.test(a)), 'Termin „Lass ich“: im Kalender gelöscht');
  S.fetch = function () { return Promise.reject(new Error('kein Netz im Test')); };
  S.zugriffToken = null; S.tokenAblauf = 0;
  S.oeffne('uebersicht');
}

/* ============================================================
   67. Spiele-Fenster und Sudoku (0.32)
   Grund: Neue App „Spiele“: ein Fenster mit Sudoku, Solitär und Stones.
   Sudoku mit drei Stufen, eindeutig lösbar, Notizen, Rückgängig, Tipp,
   Bestzeit; Spielstand nur auf dem Gerät.
   Erkennt: Rätsel mit mehreren Lösungen, Eingabe in vorgegebene Felder,
   Notizen nicht entfernt, Rückgängig/Tipp ohne Wirkung, Bestzeit trotz
   Tipp, Spielstand in der workbench.json, Zurück nicht ins Fenster.
   ============================================================ */
function spieleSudokuTest() {
  console.log('\n67. Spiele-Fenster und Sudoku (0.32)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.localStorage.removeItem('clie-sudoku'); S.localStorage.removeItem('clie-sudoku-beste');
  S.cl.sd.spiel = null; S.cl.sd.notiz = false; S.cl.sd.fehler = false;
  pruefe(S.CL_BILD.spiele && S.CL_BILD.sudoku && S.CL_BILD.solitaer, 'Symbole für Spiele, Sudoku und Solitär');
  S.oeffne('spiele');
  const fen = S.document.getElementById('aufklapp').innerHTML;
  pruefe(S.cl.app === 'uebersicht' && S.cl.aufklapp === 'ordner' && S.cl.ordner === 'spiele' && /ordnerWahl\('sudoku'\)/.test(fen) && /ordnerWahl\('solitaer'\)/.test(fen) && /ordnerWahl\('stones'\)/.test(fen) && /ordnerWahl\('schach'\)/.test(fen) && /ordnerWahl\('invasion'\)/.test(fen) && (fen.match(/class="sym"/g) || []).length === 5,
    'Spiele öffnet einen Ordner mit Sudoku, Solitär, Stones, Schach und Invasion (seit 0.35/0.45)');
  pruefe(/Sudoku: neues Rätsel/.test(fen) && /Solitär:/.test(fen) && /Stones:/.test(fen), 'Fenster zeigt den Stand je Spiel');
  /* Erzeuger: eindeutig lösbar */
  const stufen = { leicht: 0, mittel: 0, schwer: 0 };
  let eindeutig = true; let gueltig = true;
  Object.keys(stufen).forEach(st => {
    const e = S.sdErzeugen(st);
    const g = e.aufgabe.split('').map(Number);
    stufen[st] = g.filter(x => x).length;
    if (S.sdLoesen(g.slice(), 2, false) !== 1) { eindeutig = false; }
    const l = e.loesung.split('').map(Number);
    for (let i = 0; i < 81; i++) { if (!S.sdPasst(l, i, l[i]) || (g[i] && g[i] !== l[i])) { gueltig = false; } }
  });
  pruefe(eindeutig && gueltig, 'jedes Rätsel hat genau eine Lösung, die Lösung ist gültig');
  pruefe(stufen.leicht > stufen.mittel && stufen.mittel > stufen.schwer && stufen.schwer >= 22, 'Stufen: leicht hat mehr Vorgaben als mittel, mittel mehr als schwer (' + stufen.leicht + '/' + stufen.mittel + '/' + stufen.schwer + ')');
  S.ordnerWahl('sudoku');
  pruefe(S.cl.app === 'sudoku' && !S.cl.aufklapp && S.cl.sd.spiel && S.cl.sd.spiel.stufe === 'mittel' && /sd-gitter/.test(inhalt()) && (inhalt().match(/onclick="sdFeld\(/g) || []).length === 81,
    'Sudoku startet mit einem mittleren Rätsel, 81 Felder');
  const s = S.cl.sd.spiel;
  const gi = s.aufgabe.split('').findIndex(c => c !== '0');
  const li = s.aufgabe.split('').findIndex(c => c === '0');
  S.sdFeld(gi); S.sdZiffer(5);
  pruefe(s.werte[gi] === 0, 'vorgegebene Felder lassen sich nicht ändern');
  /* Notizen */
  S.sdFeld(li); S.sdNotizUm(); S.sdZiffer(3); S.sdZiffer(7);
  pruefe(s.notizen[li] === ((1 << 3) | (1 << 7)) && s.werte[li] === 0 && /<i>3<\/i>/.test(inhalt()), 'Notiz-Modus: kleine Merker-Ziffern');
  S.sdNotizUm();
  const nb = [...Array(81).keys()].find(k => k !== li && S.sdNachbar(li, k) && s.aufgabe[k] === '0');
  const richtig = Number(s.loesung[nb]);
  s.notizen[li] = (1 << richtig);
  S.cl.sd.wahl = nb; S.sdZiffer(richtig);
  pruefe(s.werte[nb] === richtig && !(s.notizen[li] & (1 << richtig)), 'Ziffer setzen entfernt sie aus den Notizen der Nachbarn');
  pruefe(/class="[^"]*\bf\b/.test(inhalt()) && /class="[^"]*\bg\b/.test(inhalt()), 'gewähltes Feld und Zeile/Spalte/Kasten hervorgehoben');
  S.sdRueck();
  pruefe(s.werte[nb] === 0, 'Rückgängig nimmt die Ziffer zurück');
  /* Fehler zeigen */
  const falsch = (Number(s.loesung[nb]) % 9) + 1;
  S.cl.sd.wahl = nb; S.sdZiffer(falsch);
  pruefe(!/class="[^"]*\bx\b/.test(inhalt()), 'Fehler bleiben ohne Wunsch unsichtbar');
  S.sdFehlerUm();
  pruefe(S.cl.sd.fehler && /class="[^"]*\bx\b/.test(inhalt()) && /passt nicht/.test(inhalt()), '„Fehler zeigen“ markiert falsche Ziffern');
  S.sdFehlerUm();
  /* Tipp */
  S.cl.sd.wahl = nb; S.sdTipp();
  pruefe(s.werte[nb] === Number(s.loesung[nb]) && s.tipps === 1, 'Tipp deckt das gewählte (falsche) Feld auf');
  /* Spielstand nur auf dem Gerät */
  pruefe(S.localStorage.getItem('clie-sudoku') && JSON.parse(S.localStorage.getItem('clie-sudoku')).werte[nb] === s.werte[nb] && !S.DB.sudoku && !/'sudoku'/.test((QUELLE.match(/var SAMMLUNGEN = \[[^\]]*\]/) || [''])[0]),
    'Spielstand im Gerät gespeichert, nicht in der workbench.json');
  S.cl.sd.spiel = null;
  pruefe(S.sdSpiel().werte[nb] === s.werte[nb], 'angefangenes Rätsel wird wieder geladen');
  /* Lösen: Bestzeit nur ohne Tipp */
  const t = S.cl.sd.spiel;
  for (let i = 0; i < 81; i++) { if (t.aufgabe[i] === '0') { t.werte[i] = Number(t.loesung[i]); } }
  t.werte[nb] = 0; S.cl.sd.wahl = nb; S.sdZiffer(Number(t.loesung[nb]));
  pruefe(t.fertig && /Gelöst/.test(inhalt()) && !(JSON.parse(S.localStorage.getItem('clie-sudoku-beste') || '{}').mittel), 'gelöst; mit Tipp keine Bestzeit');
  S.sdNeu('leicht');
  const u = S.cl.sd.spiel;
  pruefe(u.stufe === 'leicht' && !u.fertig && u.tipps === 0, 'Neu: leichtes Rätsel');
  for (let i = 0; i < 81; i++) { if (u.aufgabe[i] === '0') { u.werte[i] = Number(u.loesung[i]); } }
  const letzt = u.aufgabe.indexOf('0'); u.werte[letzt] = 0; S.cl.sd.wahl = letzt; S.sdZiffer(Number(u.loesung[letzt]));
  pruefe(u.fertig && typeof JSON.parse(S.localStorage.getItem('clie-sudoku-beste')).leicht === 'number' && /—/.test(S.sdStatZeile()), 'ohne Tipp: Bestzeit je Stufe für die Statistik');
  /* Kopf und Auswahl */
  pruefe(S.document.getElementById('katKnopf').textContent === '▼ Leicht', 'Kopf zeigt die Stufe');
  S.katUm();
  pruefe(S.cl.aufklapp === 'sdwahl' && /sdNeu\('schwer'\)/.test(S.document.getElementById('aufklapp').innerHTML), '▼ bietet neue Rätsel je Stufe');
  S.aufklappZu();
  /* Zeit: Pausen über eine Minute zählen nicht */
  const z = { zeitMs: 0, letzte: Date.now() - 5 * 60000 };
  S.spZug(z);
  pruefe(z.zeitMs === 60000 && S.spZeitText(75) === '1:15' && S.spZeitText(3725) === '1:02:05', 'Spielzeit: Pausen höchstens eine Minute, Anzeige m:ss');
  /* Zurück */
  S.clZurueck();
  pruefe(S.cl.app === 'uebersicht' && S.cl.aufklapp === 'ordner' && S.cl.ordner === 'spiele', 'Zurück aus dem Spiel: in den Ordner Spiele');
  S.clZurueck();
  pruefe(!S.cl.aufklapp, 'nochmal Zurück: Fenster zu');
  pruefe(/Sudoku/.test(S.statistikHtml()) && /Solitär/.test(S.statistikHtml()), 'Statistik zeigt Sudoku und Solitär');
}

/* ============================================================
   68. Solitär (0.32)
   Grund: Klondike mit 1 oder 3 Karten, Tippen statt Ziehen, Doppeltipp
   auf die Ablage, Rückgängig, Tipp, „Fertig legen“, Bilanz.
   Erkennt: falsche Anlegeregeln (Farbe, Wert, König auf leere Spalte),
   Stapel nicht wieder aufgefüllt, verdeckte Karte nicht aufgedeckt,
   Rückgängig ohne Wirkung, Sieg nicht gezählt.
   ============================================================ */
function solitaerTest() {
  console.log('\n68. Solitär (0.32)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.localStorage.removeItem('clie-solitaer'); S.localStorage.removeItem('clie-solitaer-bilanz');
  S.cl.so.spiel = null;
  S.oeffne('solitaer');
  const s = S.cl.so.spiel;
  const alle = s.stapel.length + s.spalten.reduce((a, sp) => a + sp.length, 0);
  pruefe(alle === 52 && s.spalten.every((sp, i) => sp.length === i + 1 && sp[i].o && sp.slice(0, i).every(k => !k.o)) && s.stapel.length === 24,
    'Austeilen: 7 Spalten (1–7 Karten, oberste offen), 24 im Stapel');
  pruefe(new Set(s.stapel.concat(...s.spalten).map(k => k.f + k.w)).size === 52, '52 verschiedene Karten');
  pruefe(S.soBilanz().spiele === 1 && S.document.getElementById('katKnopf').textContent === '▼ 1 Karte', 'Bilanz zählt das Spiel; Kopf „▼ 1 Karte“');
  const bild = [11, 12, 13].map(w => S.soName({ f: 'H', w: w }));
  pruefe(bild.join() === 'Bu♥,Da♥,Kö♥' && bild.every(n => !/^[0-9B]♥$/.test(n)), 'Bildkarten Bu/Da/Kö — nicht mit Zahlen zu verwechseln (B sah aus wie 8, seit 0.41.1)');
  /* Regeln */
  const K = (f, w, o) => ({ f: f, w: w, o: o !== false });
  pruefe(S.soAufSpalteOk(K('H', 8), [K('P', 9)]) && !S.soAufSpalteOk(K('K', 8), [K('H', 9)]) && !S.soAufSpalteOk(K('H', 7), [K('P', 9)]), 'Spalte: abwechselnd Farbe, eins kleiner');
  pruefe(S.soAufSpalteOk(K('T', 13), []) && !S.soAufSpalteOk(K('T', 12), []), 'leere Spalte: nur ein König');
  pruefe(S.soAufAblageOk(K('P', 1), []) && S.soAufAblageOk(K('P', 2), [K('P', 1)]) && !S.soAufAblageOk(K('H', 2), [K('P', 1)]), 'Ablage: ab As, gleiche Farbe aufwärts');
  /* Gestellte Lage */
  s.spalten = [[K('P', 9)], [K('T', 4, false), K('H', 8)], [], [K('K', 1)], [K('T', 13)], [K('H', 2)], [K('P', 5)]];
  s.ablage = [[], [], [], []]; s.stapel = [K('K', 3, false), K('T', 6, false)]; s.abwurf = [];
  S.cl.so.verlauf = [];
  S.soTippen('spalte', 1, 1);
  pruefe(S.cl.so.wahl && S.cl.so.wahl.s === 1 && /so-k[^"]*gew/.test(inhalt()), 'Karte antippen: ausgewählt');
  S.soTippen('spalte', 0, 0);
  pruefe(s.spalten[0].length === 2 && s.spalten[0][1].w === 8 && s.spalten[1].length === 1 && s.spalten[1][0].o, 'Ziel antippen: Herz 8 auf Pik 9, verdeckte Karte aufgedeckt');
  S.soRueck();
  pruefe(S.cl.so.spiel.spalten[1].length === 2 && !S.cl.so.spiel.spalten[1][0].o, 'Rückgängig: Zug und Aufdecken zurück');
  const t = S.cl.so.spiel;
  S.soTippen('spalte', 3, 0); S.soTippen('spalte', 3, 0);
  pruefe(t.ablage.some(a => a.length === 1 && a[0].w === 1) && t.spalten[3].length === 0, 'Doppeltipp: As auf die Ablage');
  S.soTippen('spalte', 4, 0); S.soTippen('leer', 3, 0);
  pruefe(t.spalten[3].length === 1 && t.spalten[3][0].w === 13 && t.spalten[4].length === 0, 'König auf leere Spalte');
  S.soTippen('spalte', 6, 0); S.soTippen('leer', 4, 0);
  pruefe(t.spalten[6].length === 1 && t.spalten[4].length === 0, 'Pik 5 nicht auf leere Spalte');
  S.cl.so.wahl = null;
  S.soZiehen();
  pruefe(t.abwurf.length === 1 && t.abwurf[0].o && t.stapel.length === 1, 'Stapel antippen: eine Karte aufgedeckt');
  S.soZiehen(); S.soZiehen();
  pruefe(t.stapel.length === 2 && t.abwurf.length === 0 && t.stapel.every(k => !k.o), 'leerer Stapel: Abwurf wird wieder Stapel');
  t.ziehen = 3; S.soZiehen();
  pruefe(t.abwurf.length === 2 && t.stapel.length === 0, '3 Karten ziehen (so viele da sind)');
  const tipp = S.soTippSuchen(t);
  pruefe(tipp && /Ablage|auf|ziehen|Spalten/.test(tipp.text), 'Tipp findet einen Zug: ' + (tipp ? tipp.text : '—'));
  /* Fertig legen und Sieg */
  const farben = ['P', 'H', 'K', 'T'];
  t.ablage = farben.map(f => [...Array(12).keys()].map(i => K(f, i + 1)));
  t.spalten = [[K('P', 13)], [K('H', 13)], [K('K', 13)], [K('T', 13)], [], [], []];
  t.stapel = []; t.abwurf = []; t.fertig = false;
  pruefe(S.soKannFertig(t) && /soFertigLegen\(\)/.test(S.document.getElementById('fuss').innerHTML.concat(S.solitaerFussHtml())), '„Fertig legen“, wenn alles offen und der Stapel leer ist');
  S.soFertigLegen();
  pruefe(t.fertig && t.ablage.every(a => a.length === 13) && S.soBilanz().siege === 1 && S.soBilanz().beste >= 0 && /Gewonnen/.test(inhalt()), 'gewonnen: Sieg und Bestzeit in der Bilanz');
  pruefe(/^1 · 1 · /.test(S.soStatZeile()), 'Statistik: Spiele · gewonnen · Bestzeit');
  S.katUm();
  pruefe(S.cl.aufklapp === 'sowahl' && /soNeu\(3\)/.test(S.document.getElementById('aufklapp').innerHTML), '▼: neues Spiel mit 1 oder 3 Karten');
  S.soNeu(3);
  pruefe(S.cl.so.spiel.ziehen === 3 && S.soBilanz().spiele === 2 && !S.cl.aufklapp, 'neues Spiel mit 3 Karten');
  S.cl.so.spiel = null;
  pruefe(S.soSpiel().ziehen === 3 && S.soSpiel().stapel.length === 24, 'angefangenes Spiel wird wieder geladen');
  S.clZurueck();
  pruefe(S.cl.aufklapp === 'ordner' && S.cl.ordner === 'spiele', 'Zurück: in den Ordner Spiele');
  S.aufklappZu();
  pruefe(/\.so-k\.zu\{/.test(QUELLE) && /\.sd-gitter\{/.test(QUELLE), 'Gestaltung für Sudoku und Solitär vorhanden');
}

/* ============================================================
   66. Getipptes bleibt stehen · Liste löschen (0.31.1)
   Grund: Ein Neuzeichnen im Hintergrund (Abgleich, Kalender) leerte das
   Formular der Ideenwerkstatt — Getipptes war weg. Listen ließen sich in
   CLIE nicht löschen.
   Erkennt: Hintergrund-Neuzeichnen überschreibt Eingaben (Ideen, Kurs),
   Nutzer-Aktionen zeichnen nicht mehr neu, Löschen ohne Rückfrage, ohne
   Grabstein, Liste bleibt gewählt.
   ============================================================ */
function eingabeTest() {
  console.log('\n66. Getipptes bleibt stehen · Liste löschen (0.31.1)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const el = S.document.getElementById('inhalt');
  S.oeffne('ideen'); S.iwNeu();
  pruefe(/iwTitel/.test(el.innerHTML), 'Ideen: Formular steht');
  el.innerHTML = el.innerHTML + '<!--getippt-->';
  S.zeichne();
  pruefe(/<!--getippt-->/.test(el.innerHTML), 'Ideen: Neuzeichnen im Hintergrund lässt das Formular stehen');
  S.iwZeichnen();
  pruefe(!/<!--getippt-->/.test(el.innerHTML) && /iwTitel/.test(el.innerHTML), 'Ideen: eigene Aktion zeichnet neu');
  S.iwZurListe();
  el.innerHTML = el.innerHTML + '<!--alt-->'; S.zeichne();
  pruefe(!/<!--alt-->/.test(el.innerHTML), 'Ideen: Liste ohne Eingabefelder wird im Hintergrund neu gezeichnet');
  S.oeffne('kurs'); S.krMorgenStarten(); S.krRundeSetzen('energie', 3); S.krRundeSchritt(1); S.krRundeSchritt(1);
  pruefe(/krWennDann/.test(el.innerHTML), 'Kurs: Morgen-Runde mit Eingabefeld');
  el.innerHTML = el.innerHTML + '<!--getippt-->'; S.zeichne();
  pruefe(/<!--getippt-->/.test(el.innerHTML), 'Kurs: Neuzeichnen im Hintergrund lässt das Formular stehen');
  S.krZeichnen();
  pruefe(!/<!--getippt-->/.test(el.innerHTML), 'Kurs: eigene Aktion zeichnet neu');
  S.cl.kr.runde = null; S.cl.kr.ansicht = 'heute';
  S.oeffne('ideen'); el.innerHTML = '<div class="kr-form kr-app"><input class="eingabe"></div>'; S.zeichne();
  pruefe(/iw-form/.test(el.innerHTML), 'App-Wechsel: fremdes Formular wird nicht festgehalten');
  /* Liste löschen */
  S.cl.filter = 'alle';
  const s = S.kpSeiteAnlegen('liste', 'Wegwerfliste', 'privat', '');
  s.text = '[x] erledigt';
  S.oeffne('aufgaben'); S.aufListeSetzen(s.id);
  S.listeBearbeiten();
  pruefe(/listeLoeschenFragen\(\)/.test(S.document.getElementById('aufklapp').innerHTML), 'Liste bearbeiten: Knopf „Löschen…“');
  S.document.getElementById('listeTitel').value = 'Wegwerfliste';
  S.listeLoeschenFragen();
  const h = S.document.getElementById('aufklapp').innerHTML;
  pruefe(S.cl.aufklapp === 'liste-loeschen' && /Wegwerfliste/.test(h) && /Alle Aufgaben sind erledigt/.test(h) && S.kpSeiteFinden(s.id), 'Rückfrage vor dem Löschen, Liste noch da');
  S.listeLoeschen();
  pruefe(!S.kpSeiteFinden(s.id) && S.cl.auf.liste === '' && !S.cl.aufklapp, 'gelöscht, Auswahl zurück auf „Alle Aufgaben“');
  pruefe((S.DB.grabsteine || []).some(g => g.s === 'themen' && g.id === s.id), 'Grabstein gesetzt (Löschen kommt in die Workbench)');
  const s2 = S.kpSeiteAnlegen('liste', 'Noch offen', 'privat', ''); s2.text = '[] offen';
  S.aufListeSetzen(s2.id); S.listeBearbeiten(); S.document.getElementById('listeTitel').value = 'Noch offen'; S.listeLoeschenFragen();
  pruefe(/1 offene Aufgabe\./.test(S.document.getElementById('aufklapp').innerHTML), 'Rückfrage nennt offene Aufgaben');
  S.listeBearbeiten();
  pruefe(S.cl.aufklapp === 'liste-neu' && S.kpSeiteFinden(s2.id), 'Abbrechen: Liste bleibt');
  S.aufklappZu(); S.oeffne('uebersicht');
}

/* ============================================================
   65. Ideenwerkstatt: von der Idee zur Umsetzung (0.31)
   Grund: Neue App. Eine Idee läuft durch sechs Stufen; Entscheidungen
   (Go/Später/Verwerfen), Plan, Projekt in der Workbench, nächster Schritt
   als Vorschlag in der Kurs-Morgen-Runde, Hinweise unter „Heute“.
   Erkennt: Stufen überspringbar, Weiter ohne Pflichtangaben, „Später“
   ohne Wiedervorlage, Projekt ohne Aufgaben, Kurs-Haken ohne Wirkung,
   fehlende Felder in iwSetzen (z. B. „zulasten“), Zurück-Taste, Raster.
   ============================================================ */
function ideenTest() {
  console.log('\n65. Ideenwerkstatt: von der Idee zur Umsetzung (0.31)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const setz = (o) => Object.keys(o).forEach(k => { S.document.getElementById(k).value = o[k]; });
  const leer = (l) => l.forEach(k => { S.document.getElementById(k).value = ''; });
  pruefe(S.clApp('ideen') && /Ideen-<br>werkstatt/.test((S.oeffne('planung'), S.document.getElementById('aufklapp').innerHTML)) && S.CL_BILD.ideen, 'App „Ideenwerkstatt“ im Ordner Planung (zweizeilig) mit eigenem Symbol');
  S.aufklappZu();
  pruefe(Array.isArray(S.DB.ideen) && /'ideen'[\],]/.test(QUELLE), 'Bereich „ideen“ kommt aus der Workbench (6.3.5)');
  S.oeffne('ideen');
  pruefe(/Noch keine Idee/.test(inhalt()) && /iwNeu\(\)/.test(S.document.getElementById('fuss').innerHTML), 'leere Liste mit „+ Idee“');
  S.iwNeu();
  setz({ iwTitel: '', iwWarum: '', iwBereich: '' });
  S.iwWeiter();
  pruefe(S.iwAlle().length === 0 && S.cl.iw.stufe === 1, 'ohne Satz keine Idee');
  setz({ iwTitel: 'Fotobuch für die Großeltern', iwWarum: 'Weihnachten', iwBereich: 'kb-beziehungen' });
  S.iwWeiter();
  const x = S.iwAlle()[0];
  pruefe(x && x.titel === 'Fotobuch für die Großeltern' && x.bereich === 'kb-beziehungen' && S.cl.iw.stufe === 2 && x.stufe === 2, 'Einfangen: gespeichert, weiter zu „Klären“');
  S.iwStufeZeigen(5);
  pruefe(S.cl.iw.stufe === 2, 'Stufen lassen sich nicht überspringen');
  setz({ iwErgebnis: '', iwFuerWen: '', iwErfolg: '', iwNicht: '' });
  S.iwWeiter();
  pruefe(S.cl.iw.stufe === 2, 'ohne Ergebnisbild kein Weiter');
  setz({ iwErgebnis: 'Ein Buch' });
  S.iwLesen();
  const hw = S.iwHinweiseKlaeren(x);
  pruefe(hw.some(h => /kein Datum/.test(h)) && hw.some(h => /NICHT/.test(h)) && hw.some(h => /Erfolg|gelungen/.test(h)), 'Klären: Hinweise auf Datum/Zahl, Grenzen und Erfolg');
  setz({ iwErgebnis: 'Bis 20.12. liegen drei gedruckte Fotobücher unterm Baum.', iwFuerWen: 'Oma und Opa', iwErfolg: 'Sie blättern es durch', iwNicht: 'kein Kalender' });
  S.iwWeiter();
  pruefe(S.iwHinweiseKlaeren(x).length === 0 && S.cl.iw.stufe === 3, 'gutes Ergebnisbild: keine Hinweise, weiter zu „Ausloten“');
  setz({ iwVS: '', iwVM: '', iwVL: '', iwKS: '', iwKM: '', iwKL: '', iwAS: '', iwAM: '', iwAL: '', iwZulasten: '' });
  S.iwWeiter();
  pruefe(S.cl.iw.stufe === 3, 'ohne Variante kein Weiter');
  setz({ iwVS: 'ein Buch online', iwKS: '40 €', iwAS: '1 Abend', iwVM: 'drei Bücher', iwKM: '120 €', iwAM: '3 Abende' });
  S.iwSetzen('risiko', 'M:gering');
  const vm = x.varianten.filter(v => v.groesse === 'M')[0];
  pruefe(x.varianten.length === 2 && vm && vm.risiko === 'gering' && vm.kosten === '120 €', 'Varianten S und M mit Kosten und Risiko');
  S.iwSetzen('gewaehlt', vm.id); S.iwSetzen('wollen', 8);
  S.iwSetzen('zulasten', 'kb-haus');
  pruefe(x.zulasten === 'kb-haus', 'iwSetzen kennt „zulasten“');
  const c = S.iwCheck(x);
  pruefe(c && c.v === vm && /Wollen 8\/10/.test(c.text) && typeof c.wahl === 'string', 'Vorab-Check aus Kurs auf den Favoriten');
  S.iwWeiter();
  pruefe(S.cl.iw.stufe === 4, 'weiter zu „Entscheiden“');
  S.iwWeiter();
  pruefe(S.cl.iw.stufe === 4 && !x.entscheidDatum, 'ohne Entscheidung bleibt es bei „Entscheiden“');
  /* Später → Wiedervorlage */
  S.iwSetzen('entscheidung', 'spaeter');
  pruefe(/iwWiedervorlage/.test(inhalt()), 'Später: Feld für die Wiedervorlage');
  setz({ iwWiedervorlage: S.tagePlus(S.isoDatum(), -1) });
  S.iwWeiter();
  pruefe(x.status === 'spaeter' && x.wiedervorlage === S.tagePlus(S.isoDatum(), -1) && S.cl.iw.ansicht === 'liste', 'Später: Status und Datum gespeichert, zurück zur Liste');
  pruefe(S.iwGruppe(x) === 'reifen' && S.iwHinweise().indexOf(x) >= 0, 'fällige Wiedervorlage: Idee ist „wieder da“ und Hinweis unter Heute');
  S.oeffne('heute');
  pruefe(!/Idee wieder da: Fotobuch/.test(inhalt()) && S.coFaellige('09:00', S.isoDatum()).some(f => f.id === 'iw:' + x.id), 'seit 0.34 fragt der Coach „Idee ist wieder da“ (nicht mehr unter Heute)');
  S.oeffne('ideen');
  S.iwOeffnen(x.id);
  pruefe(S.cl.iw.stufe === 4, 'wieder da → öffnet bei „Entscheiden“');
  S.iwSetzen('entscheidung', 'go'); S.iwWeiter();
  pruefe(x.status === 'aktiv' && x.stufe === 5 && S.cl.iw.stufe === 5 && S.iwHinweise().indexOf(x) < 0, 'Go: weiter zu „Planen“, Hinweis weg');
  /* Planen */
  setz({ iwMsText: '', iwMsDatum: '', iwSchrittText: '' });
  S.iwWeiter();
  pruefe(S.cl.iw.stufe === 5, 'ohne nächsten Schritt kein Weiter');
  setz({ iwMsText: 'Bilder ausgewählt', iwMsDatum: '2026-11-15', iwSchrittText: 'Ordner „Fotobuch“ anlegen' });
  S.iwLesen(); leer(['iwMsText', 'iwMsDatum', 'iwSchrittText']);
  setz({ iwSchrittText: 'Anbieter heraussuchen' }); S.iwLesen(); leer(['iwSchrittText']);
  pruefe(x.meilensteine.length === 1 && x.schritte.length === 2, 'Meilenstein und zwei Schritte eingetragen');
  pruefe(/kleiner/.test(S.iwHinweisSchritt('Alles organisieren und planen')) && S.iwHinweisSchritt('Ordner anlegen') === '', 'Hinweis bei zu großem ersten Schritt');
  S.iwWeiter();
  pruefe(S.cl.iw.stufe === 6 && S.iwGruppe(x) === 'umsetzung', 'Umsetzen erreicht');
  pruefe(/Steckbrief/.test(inhalt()) && /Ergebnis: Bis 20\.12\./.test(S.iwSteckbriefText(x)) && /Nächster Schritt: Ordner/.test(S.iwSteckbriefText(x)), 'Steckbrief mit Ergebnis und nächstem Schritt');
  /* Kurs-Haken */
  const v = S.krEinesVorschlaege(3).filter(y => y.idee === x.id)[0];
  pruefe(v && v.text === 'Ordner „Fotobuch“ anlegen' && /Idee: Fotobuch/.test(v.quelle), 'nächster Schritt erscheint in der Kurs-Morgen-Runde');
  S.krMorgenStarten(); S.krRundeSetzen('energie', 3); S.krRundeSchritt(1); S.krRundeSchritt(1);
  S.krRundeSetzen('wahl', String(S.krEinesVorschlaege(3).findIndex(y => y.idee === x.id)));
  S.document.getElementById('krAufgabe').checked = false; S.document.getElementById('krWennDann').value = '';
  S.krRundeSchritt(1);
  pruefe(S.krTag(false).eines && S.krTag(false).eines.idee === x.id, '„das Eine“ merkt sich die Idee');
  S.krEinesErledigt();
  pruefe(x.schritte[0].erledigt && S.iwNaechsterSchritt(x).text === 'Anbieter heraussuchen', 'in Kurs erledigt → Schritt in der Idee abgehakt');
  S.cl.kr.runde = null; S.cl.kr.ansicht = 'heute';
  S.oeffne('ideen'); S.iwOeffnen(x.id);
  /* Projekt in der Workbench */
  S.iwProjektAnlegen();
  const pr = S.kpSeiteFinden(x.projekt);
  pruefe(pr && pr.titel === 'Fotobuch für die Großeltern' && /^Ziel: Bis 20\.12\./.test(pr.text) && /\[\] Anbieter heraussuchen/.test(pr.text) && /\[\] Bilder ausgewählt \(bis /.test(pr.text) && !/Ordner/.test(pr.text),
    'Projekt angelegt: Ziel, offene Schritte und Meilensteine als Aufgaben');
  const anz = S.DB.projekte.length; S.iwProjektAnlegen();
  pruefe(S.DB.projekte.length === anz, 'kein zweites Projekt');
  pruefe(S.iwNaechsterSchritt(x).projekt && S.iwNaechsterSchritt(x).text === 'Anbieter heraussuchen', 'nächster Schritt kommt jetzt aus dem Projekt');
  S.iwNaechsterErledigt();
  pruefe(/\[x\] Anbieter heraussuchen/.test(pr.text) && S.iwNaechsterSchritt(x).text.indexOf('Bilder ausgewählt') === 0, 'Schritt erledigt → im Projekt abgehakt');
  /* Wochen-Check */
  pruefe(S.iwWocheFaellig(x) === (new Date().getDay() === 0), 'Wochen-Check nur sonntags fällig');
  S.iwSetzen('woche', 'kurs');
  pruefe(x.wochen.length === 1 && x.wochen[0].kw === S.krWochenId() && !S.iwWocheFaellig(x), 'Wochen-Check gespeichert');
  S.iwSetzen('woche', 'kurs');
  pruefe(x.wochen.length === 1, 'pro Woche nur ein Eintrag');
  /* Zurück-Taste und Statistik */
  pruefe(S.cl.iw.ansicht === 'stufe' && S.clZurueck() !== false && S.cl.iw.ansicht === 'liste', 'Zurück: von der Idee zur Liste');
  pruefe(/In Umsetzung/.test(inhalt()) && /nächster Schritt: Bilder/.test(inhalt()), 'Liste: Gruppe „In Umsetzung“ mit nächstem Schritt');
  S.iwSetzen && S.iwOeffnen(x.id); S.iwSetzen('woche', 'fertig');
  pruefe(x.status === 'fertig' && S.iwGruppe(x) === 'fertig' && S.iwVorschlaege().length === 0, 'abgeschlossen: kein Vorschlag mehr in Kurs');
  pruefe(S.iwStatZeile() === '1 · 0 · 1', 'Statistik: Ideen · in Umsetzung · abgeschlossen');
  /* Verwerfen */
  S.iwNeu(); setz({ iwTitel: 'Zweite Idee', iwWarum: '', iwBereich: '' }); S.iwWeiter();
  const y = S.iwFinden(S.cl.iw.id);
  y.stufe = 4; S.cl.iw.stufe = 4; S.iwSetzen('entscheidung', 'verwerfen'); S.iwWeiter();
  pruefe(y.status === 'verworfen' && S.cl.iw.ansicht === 'liste' && !/Zweite Idee/.test(inhalt()), 'Verwerfen: aus der offenen Liste');
  S.iwAlleUm();
  pruefe(/Verworfen/.test(inhalt()) && /Zweite Idee/.test(inhalt()), '„Abgeschlossene“ zeigt auch Verworfenes');
  pruefe(/\.iw-stufen button\.hier/.test(QUELLE) && /\.iw-var\{/.test(QUELLE), 'Gestaltung für die Ideenwerkstatt vorhanden');
  S.oeffne('uebersicht');
}

/* ============================================================
   64. Kurs 2.0: der Tag (0.30)
   Grund: Kurs soll täglich führen — Morgen-Runde, das Eine, Plan B,
   Abend-Runde mit Vorschlag, Pfade, die nur bei getanem Schritt weiterrücken.
   Erkennt: Runde ohne Pflichtangaben, kleine Form bei wenig Energie fehlt,
   „das Eine“ nicht gespeichert oder nicht als Aufgabe für heute, Plan B fehlt,
   Pfad rückt ohne Schritt oder doppelt weiter, Kette falsch, Hinweise fehlen,
   Pfadinhalte unvollständig.
   ============================================================ */
function kurs2Test() {
  console.log('\n64. Kurs 2.0: der Tag (0.30)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const fehlt = [];
  pruefe(S.KR_PFADE.length === 3 && S.KR_PFADE.every(p => p.schritte.length >= 20 && p.schritte.every(x => x.titel && x.impuls && x.uebung && x.eines && x.klein) && S.KR_BEREICHE.some(b => b[0] === p.bereich)),
    'drei Pfade mit je ≥ 20 vollständigen Schritten, jeder an einem Bereich');
  S.oeffne('kurs');
  pruefe(S.cl.kr.ansicht === 'heute' && /Morgen-Runde/.test(inhalt()) && /Abend-Runde/.test(inhalt()) && /krAnsicht\('pfade'\)/.test(S.document.getElementById('fuss').innerHTML),
    'Start: „Heute im Kurs“ mit Morgen- und Abend-Karte, unten Pfade');
  S.krPfadStarten('bewegung-schlaf');
  pruefe(S.krAktiverPfad().pfad.id === 'bewegung-schlaf' && S.krAktiverPfad().nr === 1, 'Pfad gestartet, Tag 1');
  S.krPfadStarten('familie');
  pruefe(S.krPfadStaende().filter(x => x.aktiv).length === 1 && S.krAktiverPfad().pfad.id === 'familie', 'nur ein Pfad aktiv');
  S.krPfadStarten('bewegung-schlaf');
  /* Morgen-Runde */
  S.krMorgenStarten(); S.krRundeSchritt(1);
  pruefe(S.cl.kr.runde.schritt === 1, 'ohne Energie kein Weiter');
  S.krRundeSetzen('energie', 2); S.krRundeSchritt(1);
  const sch = S.KR_PFADE[0].schritte[0];
  pruefe(inhalt().indexOf(S.esc(sch.titel)) >= 0, 'Impuls des Tages aus dem Pfad');
  S.krRundeSchritt(1);
  const v = S.krEinesVorschlaege(2);
  pruefe(v[0].text === sch.klein && /kleine Form/.test(v[0].quelle), 'Energie 2 → die kleine Form des Pfadschritts');
  S.krRundeSchritt(1);
  pruefe(S.cl.kr.runde.schritt === 3, 'ohne Wahl kein Weiter');
  S.krRundeSetzen('wahl', '0'); S.document.getElementById('krWennDann').value = 'Wenn ich heimkomme, dann gehe ich direkt los.';
  S.document.getElementById('krAufgabe').checked = true; S.krRundeSchritt(1);
  const tag = S.krTag(false);
  const liste = S.kpSeitenAlle().filter(x => x.titel === 'Kurs')[0];
  pruefe(tag.eines.text === sch.klein && /heimkomme/.test(tag.eines.wennDann) && liste && liste.text.indexOf(sch.klein) >= 0, '„das Eine“ mit Wenn-dann gespeichert und als Aufgabe in der Liste „Kurs“');
  pruefe(S.kpEintraegeFinden(liste.id, sch.klein).some(x => x.woche.datum === S.isoDatum()), 'die Aufgabe ist für heute eingeplant');
  S.krRundeSetzen('hindernis', 'zeit');
  pruefe(/Mini-Version/.test(S.cl.kr.runde.planB) && S.cl.kr.runde.planB.indexOf(sch.klein) >= 0, 'Hindernis → Plan B vorgeschlagen');
  S.document.getElementById('krPlanB').value = S.cl.kr.runde.planB;
  S.krRundeSchritt(1);
  S.krPrinzipOeffnen(''); S.document.getElementById('krPText').value = 'Weniger, aber besser'; S.document.getElementById('krPKonkret').value = ''; S.krPrinzipSpeichern();
  S.krMorgenFertig();
  pruefe(S.krTag(false).morgenAm && S.krTag(false).planB && S.krTag(false).energie === 2 && S.krTag(false).regel && S.cl.kr.ansicht === 'heute', 'Morgen-Runde gespeichert (Energie, Plan B, Regel des Tages)');
  pruefe(/Das Eine heute/.test(inhalt()) && /krEinesErledigt/.test(inhalt()), 'Heute zeigt „das Eine“ mit Erledigt');
  /* Abend: Nein → Grund → Vorschlag, Pfad rückt nicht */
  S.krAbendStarten(); S.krAbendSetzen('ergebnis', 'nein'); S.krAbendSetzen('grund', 'lust');
  pruefe(/Vorschlag für morgen/.test(inhalt()) && /zwei Minuten/.test(inhalt()), 'Nein + „keine Lust“ → konkreter Vorschlag');
  S.document.getElementById('krNotiz').value = 'Abends zu müde'; S.krAbendSpeichern();
  pruefe(S.krAktiverPfad().nr === 1 && S.krTag(false).abend.ergebnis === 'nein' && /zwei Minuten/.test(S.krTag(false).abend.vorschlag), 'nicht geschafft: Pfad bleibt bei Tag 1');
  /* Abend erneut: Ja → Pfad rückt einmal */
  S.krAbendStarten(); S.krAbendSetzen('ergebnis', 'ja'); S.krAbendSpeichern();
  S.krAbendStarten(); S.krAbendSetzen('ergebnis', 'ja'); S.krAbendSpeichern();
  pruefe(S.krAktiverPfad().nr === 2 && S.krTag(false).eines.erledigt === true, 'geschafft: Pfad rückt genau einen Tag weiter (auch bei zweimal Speichern)');
  const k = S.krKette();
  pruefe(k.length === 7 && k[6].e === 'ja' && k[6].heute, 'Kette: heute ✓');
  pruefe(/class="an heute">✓/.test(inhalt()), 'Kette auf „Heute im Kurs“');
  /* Hinweise unter Heute */
  pruefe(!/krTagesHinweis\(\) \?/.test(QUELLE) && !/Morgen-Runde/.test((S.oeffne('heute'), inhalt())), 'seit 0.33 keine Morgen-/Abend-Runde mehr unter „Heute“ — der Coach fragt selbst');
  S.oeffne('kurs');
  /* Zurück */
  S.krMorgenStarten(); S.krRundeSchritt(1); S.krRundeSchritt(1);
  S.clZurueck(); pruefe(S.cl.kr.runde.schritt === 2, 'Zurück in der Morgen-Runde: ein Schritt');
  S.clZurueck(); S.clZurueck(); pruefe(S.cl.app === 'coach', 'dann zum Coach (seit 0.33)');
  S.oeffne('kurs'); S.krAnsicht('prinzipien'); S.clZurueck(); pruefe(S.cl.kr.ansicht === 'bilanz', 'Prinzipien → zurück zur Bilanz');
  S.oeffne('uebersicht');
}

/* ============================================================
   63. Aufgaben „1. Nächste“: die nächste fällige (0.29.1)
   Grund: Hat eine Liste Aufgaben mit Datum, soll „1. Nächste“ die am
   frühesten fällige zeigen — sonst die oberste. Bisher galt das nur für
   Checklisten, Listen zeigten immer die oberste.
   Erkennt: oberste statt fälliger, Uhrzeit am selben Tag ignoriert,
   ohne Datum nicht die oberste, Erledigte gezählt.
   ============================================================ */
function naechsteFaelligTest() {
  console.log('\n63. Aufgaben „1. Nächste“: die nächste fällige (0.29.1)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const x = (seite, nr, datum, zeit, erl) => ({ seite: { id: seite }, nr: nr, datum: datum || '', zeit: zeit || '', a: { erledigt: !!erl, text: 'A' + nr }, key: seite + nr });
  S.cl.auf.ganz = {};
  const l = [x('L1', 1), x('L1', 2, '2026-11-05'), x('L1', 3, '2026-10-30', '18:00'), x('L1', 4, '2026-10-30', '09:00'), x('L1', 5, '2026-10-01', '', true),
             x('L2', 1), x('L2', 2), x('L2', 3)];
  const n = S.aufNaechste(l);
  const z = id => n.zeilen.filter(y => y.seite.id === id && !y.a.erledigt).map(y => y.nr);
  pruefe(JSON.stringify(z('L1')) === '[4]', 'Liste mit Daten: die am frühesten fällige (30.10. 09:00 vor 18:00 und vor der obersten ohne Datum)');
  pruefe(JSON.stringify(z('L2')) === '[1]', 'Liste ohne Daten: die oberste');
  pruefe(n.rest.L1 === 3 && n.rest.L2 === 2, '„+n“ zählt die übrigen offenen (Erledigte nicht)');
}

/* ============================================================
   62. Vorlesen: Lesezeichen (0.29)
   Grund: Wichtige Stücke eines Buchs sollen sich merken und wieder
   anhören lassen — auf allen Geräten und auch nach neuem Auslesen.
   Erkennt: Merken hält das Vorlesen an, Umfang falsch, Lesezeichen nicht
   in der Datenbank, Stück wird nicht am Ende angehalten, „Alle anhören“
   springt nicht weiter, verschobene Satznummern nicht wiedergefunden.
   ============================================================ */
function vlMarkenTest() {
  console.log('\n62. Vorlesen: Lesezeichen (0.29)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const gesagt = [];
  S.speechSynthesis = { getVoices() { return [{ name: 'Anna', lang: 'de-DE', voiceURI: 'anna' }]; }, speak(u) { gesagt.push(u); }, cancel() {} };
  S.SpeechSynthesisUtterance = function (x) { this.text = x; };
  const doc = { saetze: ['A1.', 'A2.', 'A3.', 'B1.', 'B2.', 'C1.', 'C2.', 'C3.', 'D1.'], seite: [1, 1, 1, 1, 2, 2, 2, 2, 3], absatz: [0, 0, 0, 1, 1, 2, 2, 2, 3], kapitel: [], titel: 'T', seiten: 3 };
  S.DB.vorlesen = [{ id: 'vl-t', titel: 'T', art: 'pdf', satz: 0, saetze: 9, seiten: 3, geaendert: 1 }];
  S.oeffne('vorlesen'); S.vlOeffnen('vl-t', doc);
  S.vlGehe(1); S.vlStarten();
  S.vlMerkenDruck(); S.vlMerkenTipp();
  const d = S.vlDokument('vl-t');
  pruefe(S.cl.vl.laeuft && d.marken.length === 1 && d.marken[0].von === 0 && d.marken[0].bis === 2 && d.marken[0].anfang === 'A1.', 'kurzer Tipp: Absatz gemerkt, Vorlesen läuft weiter');
  S.vlMerkenTipp();
  pruefe(d.marken.length === 1, 'derselbe Absatz nicht doppelt');
  S.vlGehe(7); S.cl.vl.druck = Date.now() - 800; S.vlMerkenTipp();
  pruefe(S.cl.vl.fenster === 'marke' && S.cl.vl.marke.anker === 7, 'langer Tipp öffnet das Fenster');
  S.vlMarkeUmfang('davor'); S.document.getElementById('vlNotiz').value = 'Wichtig!'; S.vlMarkeSpeichern();
  const m2 = d.marken.filter(x => x.notiz === 'Wichtig!')[0];
  pruefe(m2 && m2.von === 5 && m2.bis === 7 && d.geaendert > 1, '„+ die 2 davor“ mit Notiz, in der Datenbank');
  S.vlAnhalten();
  pruefe(/vl-mark/.test(inhalt()) || S.cl.vl.doc.seite[S.cl.vl.i] === 2, 'markierter Absatz im Text erkennbar');
  /* Ein Stück anhören */
  S.vlMarkeHoeren(d.marken[0].id);
  pruefe(S.cl.vl.i === 0 && S.cl.vl.bis === 2 && S.cl.vl.laeuft, 'Stück startet am Anfang des Lesezeichens');
  gesagt[gesagt.length - 1].onend(); gesagt[gesagt.length - 1].onend(); gesagt[gesagt.length - 1].onend();
  pruefe(!S.cl.vl.laeuft && S.cl.vl.i === 2, 'am Ende des Stücks wird angehalten');
  /* Alle anhören */
  S.vlMarkenAlle();
  gesagt[gesagt.length - 1].onend(); gesagt[gesagt.length - 1].onend(); gesagt[gesagt.length - 1].onend();
  pruefe(S.cl.vl.laeuft && S.cl.vl.i === 5 && S.cl.vl.bis === 7, '„Alle anhören“ springt zum nächsten Lesezeichen');
  gesagt[gesagt.length - 1].onend(); gesagt[gesagt.length - 1].onend(); gesagt[gesagt.length - 1].onend();
  pruefe(!S.cl.vl.laeuft, 'nach dem letzten Lesezeichen Schluss');
  /* Neu ausgelesen: Satznummern verschoben */
  const neu = { saetze: ['Vorwort.', 'Noch etwas.'].concat(doc.saetze), seite: [1, 1].concat(doc.seite), absatz: [9, 9].concat(doc.absatz), kapitel: [], titel: 'T', seiten: 3 };
  S.vlMarkenAnpassen(d, neu);
  pruefe(d.marken[0].von === 2 && d.marken[0].bis === 4 && m2.von === 7, 'verschobene Lesezeichen über den Satzanfang wiedergefunden');
  S.cl.vl.ansicht = 'marken'; S.zeichne();
  pruefe(/vlMarkeHoeren/.test(inhalt()) && /Wichtig!/.test(inhalt()) && /vlMarkenAlle/.test(S.document.getElementById('fuss').innerHTML), 'Liste mit ▶, Notiz und „Alle anhören“');
  S.clZurueck(); pruefe(S.cl.vl.ansicht === 'lesen', 'Zurück aus der Liste zum Lesen');
  delete S.speechSynthesis; delete S.SpeechSynthesisUtterance;
  S.oeffne('uebersicht');
}

/* ============================================================
   61. Vorlesen: ein Dokument bleibt ein Eintrag (0.28.1)
   Grund: Dasselbe PDF erschien zweimal, weil die Kennung am ausgelesenen
   Text hing — nach besserer Aufbereitung (0.27) ergab sich eine andere.
   Erkennt: Kennung nicht aus dem Fingerabdruck, Doppelte bleiben, falscher
   Eintrag behalten, Lesestelle springt bei geänderter Satzzahl falsch,
   Doppelte ohne Grabstein (kämen vom anderen Gerät zurück).
   ============================================================ */
async function vlDoppeltTest() {
  console.log('\n61. Vorlesen: ein Dokument bleibt ein Eintrag (0.28.1)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  S.DB.vorlesen = [
    { id: 'vl-alt-pc', titel: 'Mein Weg bis 2046', art: 'pdf', satz: 40, seite: 5, saetze: 300, seiten: 45, zuletzt: '2026-10-21T09:00', geaendert: 1 },
    { id: 'vl-alt-pixel', titel: 'Mein Weg bis 2046', art: 'pdf', satz: 0, seite: 1, saetze: 310, seiten: 45, zuletzt: '2026-10-21T11:58', geaendert: 2 },
    { id: 'vl-anderes', titel: 'Anderes Buch', art: 'pdf', satz: 3, seite: 1, saetze: 50, seiten: 45, geaendert: 3 }];
  const saetze = [], seite = [], absatz = [];
  for (let i = 0; i < 400; i++) { saetze.push('Satz ' + i + '.'); seite.push(Math.floor(i / 9) + 1); absatz.push(i); }
  const t = { saetze, seite, absatz, kapitel: [], titel: 'Mein Weg bis 2046', seiten: 45, fp: 'abc123fingerabdruck' };
  await S.vlUebernehmen(t, 'pdf', {});
  const l = S.DB.vorlesen.filter(d => /Mein Weg/.test(d.titel));
  pruefe(l.length === 1 && l[0].id === 'vl-alt-pc', 'Doppelte zusammengeführt — behalten wird die weiteste Lesestelle (Seite 5)');
  pruefe(l[0].fp === 'abc123fingerabdruck' && l[0].saetze === 400 && S.DB.vorlesen.some(d => d.id === 'vl-anderes'), 'Fingerabdruck gemerkt, Satzzahl neu, anderes Buch unberührt');
  pruefe(seite[l[0].satz] === 5 && seite[l[0].satz - 1] === 4, 'geänderte Satzzahl: weiter am Anfang der gemerkten Seite 5');
  pruefe(S.DB.grabsteine.some(g => g.s === 'vorlesen' && g.id === 'vl-alt-pixel'), 'der doppelte Eintrag bekommt einen Grabstein (kommt nicht vom anderen Gerät zurück)');
  /* Ganz neu: Kennung aus dem Fingerabdruck, unabhängig vom Text */
  const t2 = { saetze: ['A.', 'B.'], seite: [1, 2], absatz: [0, 1], kapitel: [], titel: 'Neu', seiten: 2, fp: 'xyz' };
  const t3 = { saetze: ['A anders.', 'B.', 'C.'], seite: [1, 1, 2], absatz: [0, 0, 1], kapitel: [], titel: 'Neu', seiten: 2, fp: 'xyz' };
  await S.vlUebernehmen(t2, 'pdf', {}); const id2 = t2.id;
  await S.vlUebernehmen(t3, 'pdf', {});
  pruefe(/^vl-f/.test(id2) && t3.id === id2 && S.DB.vorlesen.filter(d => d.titel === 'Neu').length === 1, 'gleiche Datei, anders ausgelesen → dieselbe Kennung, ein Eintrag');
  pruefe(/-webkit-line-clamp:2/.test(QUELLE), 'lange Titel in der Bibliothek auf zwei Zeilen');
  S.oeffne('uebersicht');
}

/* ============================================================
   60. Kurs (0.28)
   Grund: Lebensbereiche, Prinzipien, Vorab-Check und Wochenrückblick
   sollen bewusstere Entscheidungen stützen. Falsche Empfehlung, doppelte
   Bereiche auf zwei Geräten oder verlorene Rückblicke würden das Werkzeug
   unglaubwürdig machen.
   Erkennt: Bereiche ohne feste Kennung, Fokus falsch, Empfehlung
   widerspricht der Regel, Entscheidung nicht gemerkt, mehr als drei
   Wesentliche, Rückblick ohne Verlauf, Heute-Hinweis fehlt, Zurück.
   ============================================================ */
function kursTest() {
  console.log('\n60. Kurs (0.28)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  pruefe(/'kurs'[\],]/.test(QUELLE) && Array.isArray(S.DB.kurs), 'Bereich „kurs“ kommt aus der Workbench (6.3.4)');
  S.oeffne('kurs');
  const b = S.krBereiche(false);
  pruefe(b.length === 7 && b[0].id === 'kb-gesundheit' && b.every(x => /^kb-/.test(x.id)), 'beim ersten Öffnen sieben Bereiche mit festen Kennungen (keine Doppelten auf zwei Geräten)');
  S.krAnfangen();
  pruefe(S.krBereiche(true).length === 7, 'kein zweites Anlegen');
  /* Ist/Soll setzen: Gesundheit 4→8 (Rang 1), Familie 5→9 (Rang 2), Haus 8→6 */
  const setze = (id, ist, soll) => { const x = S.krFinden(id); x.ist = ist; x.soll = soll; };
  b.forEach(x => { x.ist = 7; x.soll = 7; });
  setze('kb-gesundheit', 4, 8); setze('kb-beziehungen', 5, 9); setze('kb-haus', 8, 6); setze('kb-finanzen', 5, 7);
  pruefe(JSON.stringify(S.krFokus()) === '["kb-gesundheit","kb-beziehungen"]', 'Fokus: wichtig und große Lücke (Gesundheit, Familie), nicht Haus (über Soll)');
  S.krAnsicht('bilanz');
  pruefe((inhalt().match(/kr-fokus/g) || []).length === 2 && /kr-skala/.test(inhalt()), 'Bilanz zeigt Ist/Soll und zweimal „Fokus“');
  S.krRang('kb-finanzen', -1);
  pruefe(S.krBereiche(false).map(x => x.id).indexOf('kb-finanzen') === 5, 'Rang verschieben');
  /* Prinzipien */
  S.krVorschlagNehmen(7);
  S.krPrinzipOeffnen(''); S.document.getElementById('krPText').value = 'Abends gehört der Familie'; S.document.getElementById('krPKonkret').value = 'Nach 18 Uhr keine Arbeit'; S.krPrinzipSpeichern();
  const p = S.krPrinzipien();
  pruefe(p.length === 2 && p[0].text === 'Kein Ja aus schlechtem Gewissen.' && p[1].konkret === 'Nach 18 Uhr keine Arbeit', 'Prinzipien: Vorschlag übernommen und eigenes angelegt');
  /* Vorab-Check */
  S.krCheckNeu();
  S.document.getElementById('krWas').value = '';
  S.krCheckSchritt(1);
  pruefe(S.cl.kr.check.schritt === 1, 'ohne Beschreibung kein Weiter');
  S.document.getElementById('krWas').value = 'Vereinsvorstand übernehmen'; S.krCheckSetzen('bereich', 'kb-freizeit'); S.krCheckSchritt(1);
  S.document.getElementById('krStunden').value = '3'; S.document.getElementById('krGeld').value = ''; S.document.getElementById('krZulasten').value = 'kb-beziehungen'; S.krCheckSchritt(1);
  S.krCheckSetzen('regel', p[1].id); S.krCheckSetzen('regel', p[1].id);
  pruefe(S.cl.kr.check.regeln[p[1].id] === 'nein' && S.cl.kr.check.zulasten === 'kb-beziehungen', 'Regel per Tipp: passt → verletzt; Felder werden übernommen');
  S.krCheckSchritt(1);
  pruefe(S.cl.kr.check.schritt === 3, 'ohne „Wollen“ kein Weiter');
  S.krCheckSetzen('wollen', 6); S.krCheckSchritt(1);
  const c = S.cl.kr.check;
  pruefe(c.schritt === 4 && c.wahl === 'nein' && /deshalb sage ich bei „Vereinsvorstand übernehmen“ diesmal ab/.test(S.krAntwortText(c)) && /Abends gehört der Familie/.test(S.krAntwortText(c)),
    'Regel verletzt und kein klares Ja → Empfehlung Nein, Absage nennt die Regel');
  pruefe(S.krEmpfehlung({ regeln: {}, wollen: 10, zulasten: 'kb-gesundheit', fokus: ['kb-gesundheit'] }).wahl === 'kleiner'
    && S.krEmpfehlung({ regeln: {}, wollen: 10, zulasten: '', fokus: [] }).wahl === 'ja'
    && S.krEmpfehlung({ regeln: {}, wollen: 3, zulasten: '', fokus: [] }).wahl === 'nein'
    && S.krEmpfehlung({ regeln: {}, wollen: 7, zulasten: '', fokus: [] }).wahl === 'kleiner', 'Empfehlung: Fokus belastet → kleiner, klares Ja → Ja, wenig Wollen → Nein, mittel → kleiner');
  S.krCheckSetzen('wahl', 'spaeter');
  pruefe(/in ein paar Wochen/.test(S.krAntwortText(S.cl.kr.check)), 'eigene Wahl „Später“ ändert den Text');
  S.krCheckMerken();
  const e = S.krEntscheidungen('')[0];
  pruefe(e && e.wahl === 'spaeter' && e.empfehlung === 'nein' && e.datum === S.isoDatum() && S.cl.kr.ansicht === 'heute', 'Entscheidung im Buch: Wahl, Empfehlung, Datum (zurück zu „Heute im Kurs“)');
  /* Woche */
  S.krAnsicht('woche');
  for (let i = 0; i < 4; i++) { S.krWesentlichOeffnen(); S.document.getElementById('krWText').value = 'Ding ' + i; S.krWesentlichSpeichern(); }
  const w = S.krWoche(false);
  pruefe(w.wesentliche.length === 3 && w.wesentliche[0].bereich === 'kb-gesundheit', 'höchstens drei Wesentliche, Vorschlag aus dem Fokus');
  S.krWesentlichUm(w.wesentliche[0].id);
  pruefe(S.krWoche(false).wesentliche[0].erledigt === true && /Vereinsvorstand/.test(inhalt()), 'abhaken; Entscheidungsbuch der Woche sichtbar');
  S.krFensterAuf('rueckblick'); S.document.getElementById('krRb-kb-gesundheit').value = '5';
  S.krBereiche(false).forEach(x => { if (x.id !== 'kb-gesundheit') { S.document.getElementById('krRb-' + x.id).value = String(x.ist); } });
  S.krRueckblickSpeichern();
  pruefe(S.krFinden('kb-gesundheit').ist === 5 && JSON.stringify(S.krVerlauf('kb-gesundheit')) === '[5]' && /^kw-\d{4}-\d{2}$/.test(S.krWoche(false).id), 'Rückblick: Ist aktualisiert, Verlauf je Woche');
  pruefe(S.krKurveSvg([4, 5, 6], 8, false).indexOf('polyline') > 0 && /kr-leer/.test(S.krKurveSvg([], 8, false)), 'Kurve je Bereich');
  /* Heute-Hinweis (nur sonntags, solange kein Rückblick) */
  const w2 = S.krWoche(false); const rb = w2.rueckblick; w2.rueckblick = null;
  const sonntag = new Date().getDay() === 0;
  pruefe(S.krRueckblickFaellig() === sonntag, 'Rückblick-Hinweis nur sonntags');
  w2.rueckblick = rb;
  pruefe(/if \(krRueckblickFaellig\(\)\) \{/.test(QUELLE.slice(QUELLE.indexOf('function coFaellige'))), 'Hinweis kommt seit 0.63 vom Coach (keine App „Heute“ mehr)');
  /* Zurück */
  S.krCheckNeu(); S.document.getElementById('krWas').value = 'x'; S.krCheckSchritt(1);
  S.clZurueck(); pruefe(S.cl.kr.check.schritt === 1, 'Zurück im Check: ein Schritt zurück');
  S.clZurueck(); pruefe(S.cl.app === 'coach' && !S.cl.kr.check, 'dann zum Coach (seit 0.33)');
  S.oeffne('kurs');
  S.oeffne('uebersicht');
}

/* ============================================================
   59. Vorlesen besser, Checklisten-Zahl, Verweise zwischen Sammlungen (0.27)
   Grund: Beim Vorlesen rissen Sätze an Zeilenumbrüchen (zerteilte Zeilen,
   Überschrift-Erkennung an jedem großgeschriebenen Wort), WÖRTER IN
   GROSSBUCHSTABEN wurden buchstabiert, der markierte Satz rollte aus dem
   Bild. Sammlungen sollen Werte anderer Sammlungen nutzen (Gewicht).
   Erkennt: versetzte Stücke einer Zeile ergeben zwei Zeilen, Satz endet
   an kurzer Zeile mit großem Wortanfang, Großbuchstaben bleiben, echte
   Abkürzungen werden verändert, Rollen über offsetTop, Zahl an
   Checklisten fehlt, Verweis rechnet mit dem falschen Stand.
   ============================================================ */
function neu027Test() {
  console.log('\n59. Vorlesen besser, Checklisten-Zahl, Sammlungs-Verweise (0.27)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  /* Zeilen: kursiv/fett minimal versetzt bleibt eine Zeile, auch in ungünstiger Reihenfolge */
  const z = S.vlZeilenAusStuecken([
    { str: 'wichtig', transform: [10, 0, 0, 10, 120, 501.8], height: 10 }, { str: 'Das ist', transform: [10, 0, 0, 10, 50, 500], height: 10 },
    { str: 'Folgezeile', transform: [10, 0, 0, 10, 50, 487], height: 10 }, { str: 'hier.', transform: [10, 0, 0, 10, 180, 499.2], height: 10 }]);
  pruefe(z.length === 2 && z[0].t === 'Das ist wichtig hier.' && z[1].t === 'Folgezeile', 'versetzte Stücke (fett/kursiv) bleiben eine Zeile, von links nach rechts');
  const fn = S.vlZeilenAusStuecken([{ str: 'Ende des Satzes.', transform: [10, 0, 0, 10, 50, 500], height: 10 }, { str: '1', transform: [6, 0, 0, 6, 140, 504], height: 6 },
    { str: 'Danach weiter', transform: [10, 0, 0, 10, 150, 500], height: 10 }]);
  pruefe(fn.length === 1 && fn[0].t === 'Ende des Satzes. Danach weiter', 'hochgestellte Fußnotenziffer wird nicht mitgelesen');
  /* Kurze Zeile + großes Substantiv am nächsten Zeilenanfang: kein neuer Absatz */
  const zl = (t, y, h) => ({ t: t, y: y, h: h || 10 });
  const a = S.vlAufbereiten([{ zeilen: [zl('Eine ganz normale lange Zeile mit sehr viel Text darin, wie im Buch', 700), zl('und eine kurze', 687), zl('Zeile, die im Satz weitergeht und dann endet.', 674),
    zl('Überschrift', 640, 14), zl('Danach kommt wieder der normale Text des Absatzes hier.', 620)] }]);
  pruefe(a.saetze[0] === 'Eine ganz normale lange Zeile mit sehr viel Text darin, wie im Buch und eine kurze Zeile, die im Satz weitergeht und dann endet.',
    'kurze Zeile vor großem Wortanfang reißt den Satz nicht mehr');
  pruefe(a.saetze[1] === 'Überschrift' && a.absatz[1] !== a.absatz[0] && a.absatz[2] !== a.absatz[1], 'echte Überschrift (größere Schrift) bleibt eigener Absatz');
  const b = S.vlAufbereiten([{ zeilen: [zl('Ein Satz geht über die', 700), zl('', 0)].filter(x => x.t) }, { zeilen: [zl('Seite hinaus und endet hier.', 700)] }]);
  pruefe(b.saetze.length === 1, 'Satz über den Seitenwechsel bleibt ein Satz');
  /* Großbuchstaben */
  pruefe(S.vlSprechText('E S IST DIE FÄHIGKEIT ZU WÄHLEN.') === 'Es Ist Die Fähigkeit Zu Wählen.', 'Großbuchstaben-Satz und Initiale: normal gesprochen');
  pruefe(S.vlSprechText('C ONSTANTIN Z ÖLLER') === 'Constantin Zöller' && S.vlSprechText('Nicht-Essentialist DENKT: Essentialist WEIß:') === 'Nicht-Essentialist Denkt: Essentialist Weiß:',
    'Kapitälchen-Anfänge zusammengefügt, Wörter in Großbuchstaben normal');
  pruefe(S.vlSprechText('Die ISTQB-Prüfung und die EU sind wichtig.') === 'Die ISTQB-Prüfung und die EU sind wichtig.', 'echte Abkürzungen bleiben');
  pruefe(/vlSprechText\(text\)/.test(QUELLE) && /getBoundingClientRect/.test(QUELLE.slice(QUELLE.indexOf('function vlTextRollen'), QUELLE.indexOf('function vlTextRollen') + 900)),
    'Stimme bekommt den Sprechtext; Mitrollen über Bildschirm-Rechtecke');
  /* Checklisten-Zahl */
  S.DB.gedanken.push({ id: 'c1', titel: 'Urlaub', text: '[] a', checkliste: 'lauf', geaendert: 1 }, { id: 'c2', titel: 'Fenster', text: '[] b', checkliste: 'lauf', geaendert: 1 },
    { id: 'c3', titel: 'Vorlage', text: '[] c', checkliste: 'vorlage', geaendert: 1 });
  S.oeffne('uebersicht');
  pruefe(!/class="zahl"/.test(inhalt()), 'seit 0.63 keine Zahl am To-Do-Symbol (wie am Palm)');
  S.DB.gedanken = []; S.zeichne();
  pruefe(!/oeffne\('checklisten'\)"><span class="sym"><svg[^<]*?(<[^b][^]*?)?<span class="zahl">/.test(inhalt().replace(/oeffne\('heute'\)[\s\S]*?<\/button>/, '')), 'ohne laufende keine Zahl');
  /* Verweise zwischen Sammlungen */
  const k = S.saAusVorlage(S.SA_VORLAGEN.frei, 'Körper', false, []);
  k.felder = [{ id: 'kd', name: 'Datum', typ: 'datum' }, { id: 'kg', name: 'Gewicht', typ: 'zahl' }];
  k.kopfwerte = [{ name: 'Gewicht', art: 'letzter', feld: 'kg' }];
  const e = S.saAusVorlage(S.SA_VORLAGEN.frei, 'Essen', false, []);
  e.felder = [{ id: 'ed', name: 'Tag', typ: 'datum' }, { id: 'kc', name: 'kcal', typ: 'zahl' }, { id: 'pk', name: 'kcal je kg', typ: 'formel', formel: '[kcal] / [Körper: Gewicht]', dez: 1 }];
  [['2026-10-01', 90], ['2026-10-10', 88], ['2026-10-20', 86]].forEach((x, i) => S.DB.datensaetze.push({ id: 'k' + i, sammlung: k.id, werte: { kd: x[0], kg: x[1] }, angelegt: i + 1, geaendert: i + 1 }));
  S.DB.datensaetze.push({ id: 'e1', sammlung: e.id, werte: { ed: '2026-10-05', kc: 1800 }, angelegt: 5, geaendert: 5 });
  S.DB.datensaetze.push({ id: 'e2', sammlung: e.id, werte: { ed: '2026-10-21', kc: 1720 }, angelegt: 6, geaendert: 6 });
  const pk = e.felder[2];
  pruefe(S.saFormelWert(e, S.saSatzFinden('e1'), pk, 0) === 20 && S.saFormelWert(e, S.saSatzFinden('e2'), pk, 0) === 20,
    'Eintrag rechnet mit dem Gewicht zu seinem Datum (5.10. → 90 kg, 21.10. → 86 kg)');
  pruefe(S.saFremdZahl('Körper: Gewicht', '', 0) === 86 && S.saFremdZahl('körper : gewicht', '2026-10-12', 0) === 88, 'Verweis: Groß-/Kleinschreibung egal, Stand je Datum');
  pruefe(S.saFormelPruefen(e, '[kcal] / [Körper: Gewicht]', pk) === '' && /gibt es nicht/.test(S.saFormelPruefen(e, '[kcal] / [Körper: Puls]', pk)), 'Formel-Prüfung kennt Verweise und meldet unbekannte');
  pruefe(S.saVerweisListe(e).indexOf('Körper: Gewicht') >= 0 && S.saVerweisListe(e).every(x => x.indexOf('Essen:') !== 0), 'Auswahlliste: Werte der anderen Sammlungen, nicht der eigenen');
  e.kopfwerte = [{ art: 'fremd', ref: 'Körper: Gewicht' }];
  pruefe(S.saKopfwertText(e, e.kopfwerte[0]) === '86' && S.saKopfwertName(e, e.kopfwerte[0]) === 'Gewicht', 'Kopfwert „aus anderer Sammlung“ zeigt den aktuellen Stand');
  k.felder.push({ id: 'ix', name: 'Index', typ: 'formel', formel: '[Essen: kcal je kg]' });
  e.felder[2].formel = '[kcal] / [Körper: Index]';
  pruefe(S.saFormelWert(e, S.saSatzFinden('e1'), e.felder[2], 0) === null, 'gegenseitige Verweise laufen nicht endlos (leer statt Absturz)');
  S.DB.datensaetze = []; S.DB.sammlungen = [];
  S.oeffne('uebersicht');
}

/* ============================================================
   58. Vorlesen (0.26)
   Grund: PDFs werden vorgelesen — Text muss sauber aufbereitet sein
   (keine Kopfzeilen, Seitenzahlen, Trennstriche), Sätze richtig geteilt,
   die Lesestelle darf nicht verloren gehen und muss auf das andere Gerät
   reisen; Schlaftimer und Sperre müssen greifen.
   Erkennt: Abkürzungen/Ordnungszahlen zerreißen Sätze, Kopfzeilen oder
   Seitenzahlen werden mitgelesen, Silbentrennung bleibt, Wasserzeichen
   stört, Kennung nicht stabil, Vorlesen springt nicht weiter, Stelle nicht
   gemerkt, Timer/Kapitelende stoppt nicht, Sperre lässt „Zurück“ durch,
   Drive-Recht fehlt in der Anmeldung.
   ============================================================ */
function vorlesenTest() {
  console.log('\n58. Vorlesen (0.26)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  /* Sätze */
  const s1 = S.vlSaetze('Das ist z. B. gut. Am 3. Mai kam er. Siehe Kapitel 2.7.3 dazu. Er sagte („Wir sitzen alle in einem Boot.“) und ging. Fertig!');
  pruefe(s1.length === 5 && s1[0] === 'Das ist z. B. gut.' && s1[1] === 'Am 3. Mai kam er.' && /2\.7\.3/.test(s1[2]) && /Boot\.“\) und ging\./.test(s1[3]),
    'Sätze: Abkürzungen, Ordnungszahlen, Kapitelnummern und Klammerzitate bleiben heil (' + s1.length + ')');
  const lang = S.vlSaetze(('Dies ist ein sehr langer Satz, der immer weiter geht, ' ).repeat(12) + 'und endet.');
  pruefe(lang.length > 1 && lang.every(x => x.length <= 280), 'überlange Sätze werden an Satzzeichen geteilt (für die Stimme)');
  pruefe(S.vlSaetze('Motivation ( kurz ) ist wichtig .')[0] === 'Motivation (kurz) ist wichtig.', 'Leerzeichen vor Satzzeichen und in Klammern werden bereinigt');
  /* Zeilen aus pdf.js-Stücken */
  const z = S.vlZeilenAusStuecken([
    { str: 'Hallo', transform: [10, 0, 0, 10, 50, 500], height: 10 }, { str: 'Welt', transform: [10, 0, 0, 10, 80, 500], height: 10 },
    { str: 'Wasserzeichen', transform: [0, 5, -5, 0, 10, 300], height: 5 }, { str: 'Zweite Zeile', transform: [10, 0, 0, 10, 50, 487], height: 10 }]);
  pruefe(z.length === 2 && z[0].t === 'Hallo Welt' && z[1].t === 'Zweite Zeile', 'Zeilen: Stücke einer Höhe verbunden, gedrehter Text (Wasserzeichen) weg');
  /* Aufbereiten: Kopfzeile, Seitenzahl, Trennung, Absätze */
  const seite = (n, zeilen) => ({ zeilen: [{ t: 'Das Buch der Gewohnheiten', y: 800, h: 9 }].concat(zeilen.map((t, i) => ({ t: t, y: 700 - i * 13, h: 10 })), [{ t: String(n), y: 40, h: 9 }]) });
  const seiten = [
    seite(1, ['Erste Zeile eines langen Absatzes mit einem Verhal‐', 'tensmuster, das wir kennen. Dann geht es weiter mit', 'einem zweiten Satz ohne Ende']),
    seite(2, ['und hier endet er auf der nächsten Seite.']),
    seite(3, ['Neuer Gedanke auf Seite drei.']),
    seite(4, ['Noch ein Absatz.']),
    seite(5, ['Und der letzte Satz.'])
  ];
  seiten[2].zeilen.splice(2, 0, { t: 'Neuer Absatz nach großer Lücke.', y: 640, h: 10 });
  const a = S.vlAufbereiten(seiten);
  const alles = a.saetze.join(' | ');
  pruefe(!/Das Buch der Gewohnheiten/.test(alles) && !/\| ?\d \|/.test(' | ' + alles + ' | '), 'Kopfzeile (wiederkehrend) und Seitenzahlen werden nicht vorgelesen');
  pruefe(/Verhaltensmuster/.test(alles), 'Silbentrennung am Zeilenende zusammengefügt');
  pruefe(a.saetze.some(x => /^Dann geht es weiter mit einem zweiten Satz ohne Ende und hier endet er auf der nächsten Seite\.$/.test(x)), 'Satz über den Seitenwechsel bleibt ein Satz');
  const iL = a.saetze.findIndex(x => /^Neuer Absatz nach großer Lücke/.test(x));
  pruefe(iL > 0 && a.absatz[iL] !== a.absatz[iL - 1] && a.seite[iL] === 3, 'große Lücke = neuer Absatz, Seitenzahl je Satz stimmt');
  /* Kennung */
  pruefe(S.vlKennung(a.saetze) === S.vlKennung(a.saetze.slice()) && S.vlKennung(a.saetze) !== S.vlKennung(a.saetze.concat(['x'])) && /^vl-/.test(S.vlKennung(a.saetze)),
    'Kennung aus dem Text: gleich für denselben Text, anders für anderen');
  /* Memo-Text */
  const m = S.vlAusText('# Überschrift\n- [ ] Aufgabe eins\n[x] erledigt\n- Punkt mit **fett**\n\nAbsatz. Zweiter Satz.');
  pruefe(m.saetze[0] === 'Überschrift' && m.saetze[1] === 'Aufgabe eins' && m.saetze[3] === 'Punkt mit fett' && m.saetze.length === 6, 'Memo: Überschriften, Kästchen, Aufzählungen und ** werden nicht mitgelesen');
  /* Vorlesen mit nachgebauter Sprachausgabe */
  const gesagt = [];
  S.speechSynthesis = { getVoices() { return [{ name: 'Anna', lang: 'de-DE', voiceURI: 'anna', localService: true }, { name: 'Samantha', lang: 'en-US', voiceURI: 'sam' }, { name: 'Martin', lang: 'de-DE', voiceURI: 'martin' }]; },
    speak(u) { gesagt.push(u); }, cancel() {} };
  S.SpeechSynthesisUtterance = function (t) { this.text = t; };
  delete S.__ablage['clie-vorlesen-stimme']; delete S.__ablage['clie-vorlesen-lokal'];
  pruefe(S.vlStimmen().length === 2 && S.vlStimme().voiceURI === 'anna', 'nur deutsche Stimmen zur Auswahl');
  S.vlStimmeWahl('martin'); S.vlTimerWahl(0);
  const doc = { saetze: ['Eins.', 'Zwei.', 'Drei.', 'Vier.', 'Fünf.', 'Sechs.'], seite: [1, 1, 1, 2, 2, 2], absatz: [0, 0, 1, 2, 2, 3], kapitel: [{ t: 'Teil 2', i: 3, ebene: 0 }], titel: 'Test', seiten: 2 };
  const id = S.vlKennung(doc.saetze);
  S.vlEintragen({ id: id, titel: 'Test', art: 'pdf', saetze: 6, seiten: 2 });
  S.oeffne('vorlesen'); S.vlOeffnen(id, doc);
  pruefe(S.cl.vl.ansicht === 'lesen' && inhalt().indexOf('vls0') >= 0 && inhalt().indexOf('vls3') < 0, 'Lesen zeigt die Sätze der aktuellen Seite');
  S.vlStarten();
  pruefe(gesagt.length === 1 && gesagt[0].text === 'Eins.' && gesagt[0].voice.voiceURI === 'martin' && gesagt[0].lang === 'de-DE', 'Vorlesen startet mit der gewählten deutschen Stimme');
  gesagt[0].onend();
  pruefe(S.cl.vl.i === 1 && gesagt[1].text === 'Zwei.', 'nach dem Satz geht es von selbst weiter');
  S.vlSchritt('absatz+');
  pruefe(S.cl.vl.i === 2 && gesagt[gesagt.length - 1].text === 'Drei.', 'Absatz vor springt an den nächsten Absatz und liest dort');
  const alt = gesagt[gesagt.length - 2]; alt.onend();
  pruefe(S.cl.vl.i === 2, 'ein überholter Satz (nach Sprung) schiebt nicht weiter');
  S.vlAnhalten();
  const d1 = S.vlDokument(id);
  pruefe(!S.cl.vl.laeuft && d1.satz === 2 && d1.geraet && d1.zuletzt && d1.geaendert > 0, 'Anhalten merkt die Lesestelle in der Datenbank (mit Gerät und Zeit)');
  /* Kapitel-Schlaftimer */
  S.vlTimerWahl(-1); S.vlStarten();
  gesagt[gesagt.length - 1].onend();
  pruefe(!S.cl.vl.laeuft && S.cl.vl.i === 3, 'Schlaftimer „Kapitel“ hält am Kapitelende an');
  /* Minuten-Schlaftimer */
  S.vlTimerWahl(15); S.vlStarten(); S.cl.vl.timerBis = 1;
  gesagt[gesagt.length - 1].onend();
  pruefe(!S.cl.vl.laeuft, 'Minuten-Schlaftimer hält nach Ablauf an');
  /* Ende */
  S.vlTimerWahl(0); S.vlGehe(5); S.vlStarten(); gesagt[gesagt.length - 1].onend();
  pruefe(!S.cl.vl.laeuft && S.vlDokument(id).fertig === true, 'am Ende: fertig und angehalten');
  /* Sperre */
  S.vlGehe(0); S.vlStarten(); S.vlSperren();
  const vorher = S.cl.app;
  pruefe(S.clZurueck() === true && S.cl.app === vorher && S.cl.vl.gesperrt && S.cl.vl.laeuft, 'gesperrt: „Zurück“ tut nichts, das Vorlesen läuft weiter');
  S.vlEntsperren(); S.vlAnhalten();
  pruefe(!S.cl.vl.gesperrt, 'Wisch entsperrt');
  pruefe(/vl-wisch/.test(QUELLE) && /touchmove/.test(QUELLE) && /wakeLock\.request\('screen'\)/.test(QUELLE), 'Sperre mit Wischleiste und wach gehaltenem Bildschirm');
  /* Anderes Gerät ohne Text */
  S.__ablage['clie-vorlesen-lokal'] = '{}';
  S.cl.vl.doc = null; S.cl.vl.ansicht = 'lesen'; S.vlZeichnen();
  pruefe(/Lesestelle \(Seite/.test(inhalt()) && /vlDateiWaehlen/.test(inhalt()), 'ohne Text auf dem Gerät: Lesestelle da, „PDF laden …“ angeboten');
  S.vlEbeneHoch();
  pruefe(/PDF auf diesem Gerät noch laden/.test(inhalt()), 'Bibliothek zeigt fehlende Texte');
  /* Drive */
  const zeile = S.drvZeileHtml({ id: 'f1', name: 'Buch.pdf', mimeType: 'application/pdf' }, 0, false);
  pruefe(/vlAusDriveZeile\(0\)/.test(zeile) && !/vlAusDriveZeile/.test(S.drvZeileHtml({ id: 'f2', name: 'Text', mimeType: 'text/plain' }, 1, false)), 'Drive: „🔊“ nur bei PDFs');
  S.__ablage['clie-drive-lesen'] = 'an';
  pruefe(S.clAnfrage('').scope.indexOf(S.VL_DRIVE_SCOPE) >= 0, 'Anmeldung fragt das Recht drive.readonly mit an, sobald erlaubt');
  delete S.__ablage['clie-drive-lesen'];
  /* Entfernen */
  S.cl.vl.id = id; S.vlEntfernen();
  pruefe(!S.vlDokument(id) && S.DB.grabsteine.some(g => g.s === 'vorlesen' && g.id === id), 'Entfernen: weg mit Grabstein (auf allen Geräten)');
  delete S.speechSynthesis; delete S.SpeechSynthesisUtterance;
  S.oeffne('uebersicht');
}

/* ============================================================
   57. Schach: Fehler erklären (0.25)
   Grund: „besser: Sf3“ allein lehrt wenig — die Analyse soll sagen,
   WARUM ein Zug schlecht und der andere besser ist.
   Erkennt: Erklärung fehlt oder benennt das Motiv falsch (hängende
   Figur, Gabel, verpasstes Matt, zugelassenes Matt), Variante nicht
   spielbar, Erklärung wird nicht gemerkt, Anzeige in Partien und
   Kapitel 7 fehlt.
   ============================================================ */
function schErklTest() {
  console.log('\n57. Schach: Fehler erklären (0.25)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const fall = (fen, gespielt, besser, muster, was) => {
    const e = S.schErklaeren(fen, gespielt, besser);
    const ok = e && muster.every(m => m.test(e.text));
    pruefe(ok, was + (ok ? '' : ' — ' + (e ? e.text.replace(/\n/g, ' | ') : 'keine Erklärung')));
    return e;
  };
  fall('rnbqkbnr/1ppp1ppp/p7/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3', 'Lb5', 'Lc4', [/Läufer/, /b5/, /Merke/], 'hängende Figur: gezogener Läufer auf b5');
  fall('r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1', 'Kd2', 'Sc7+', [/Gabel/, /Turm/, /König/], 'verpasste Gabel Sc7+ (König und Turm)');
  fall('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 'h3', 'Ta8#', [/matt/i], 'verpasstes Matt Ta8#');
  fall('r5k1/5ppp/8/8/8/8/5PPP/1R4K1 w - - 0 1', 'Tb7', 'h3', [/mattsetzen/, /Ta1/, /Drohungen/], 'zugelassenes Grundreihenmatt');
  const e = S.schErklaeren('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'a3', 'e4');
  pruefe(e && /Stellung, nicht in einer direkten Taktik/.test(e.text), 'ohne Taktik: ehrliche Aussage statt erfundener Begründung');
  pruefe(S.schErklaeren('8/8/8/8/8/8/8/K6k w - - 0 1', 'Zz9', 'Kb1') === null, 'unspielbarer Zug → keine Erklärung, kein Absturz');
  /* Anzeige in „Partien“ und Merken */
  delete S.__ablage['clie-schach-partien'];
  const fen = 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1';
  const pt = { id: 'p1', name: 'Test', datum: S.isoDatum(), farbe: 'w', gegner: 'clie', zuege: [], kurz: [], analyse: [{ ply: 0, kurz: 'Kd2', besser: 'Sc7+', verlust: 500, fen: fen }] };
  S.__ablage['clie-schach-partien'] = JSON.stringify([pt]);
  const t1 = S.schFundErklaerung('p1', S.schPartienLesen()[0].analyse[0]);
  pruefe(/Gabel/.test(t1) && /Gabel/.test(S.schPartienLesen()[0].analyse[0].erkl || ''), 'Erklärung wird beim ersten Mal berechnet und in der Partie gemerkt');
  const a = S.schEigeneAufgaben()[0];
  pruefe(a && a.partie === 'p1' && /Gabel/.test(S.schAufgabeErkl(a)), 'Kapitel 7: eigene Fehler-Aufgabe bringt die Erklärung mit');
  pruefe(/clAuszeichnungKurz\(ue\.meldung\)/.test(QUELLE), 'Meldungen zeigen **fett** und Zeilen statt Sternchen');
  pruefe(/schFundErklaerung\(pt\.id, fund\)/.test(QUELLE), 'Partien: Brett vor dem Fehler zeigt den Erklärkasten');
  pruefe(S.schVerlustText(100990) === 'Matt' && S.schVerlustText(280) === '−2,8', 'Verlust: „Matt“ statt −1009,1, sonst Bauern');
  delete S.__ablage['clie-schach-partien'];
}

/* ============================================================
   56. Lernkartei: Fenster beim Rollen sichtbar (0.24.1)
   Grund: Weit unten in der Kartenliste öffnete „Bearbeiten“ das Fenster
   oben im Inhalt — außerhalb des sichtbaren Bereichs.
   Erkennt: Fenster öffnet ohne Hochrollen, Rollposition geht nach dem
   Schließen verloren.
   ============================================================ */
function lkRollTest() {
  console.log('\n56. Lernkartei: Fenster beim Rollen sichtbar (0.24.1)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  delete S.__ablage['clie-lernkartei-pakete']; S.DB.lernkaesten = []; S.DB.lernstand = [];
  const id = S.lkKastenNeu('Rollen');
  const d = S.lkDaten(); S.lkKasten(d, id).karten = S.lkKartenAusText('A\n1\n\nB\n2\n\nC\n3'); S.lkSichern(d);
  S.oeffne('lernkartei'); S.lkKastenOeffnen(id); S.lkKartenZeigen();
  const el = S.document.getElementById('inhalt');
  el.scrollTop = 900;
  const kid = S.lkDaten().kaesten[0].karten[2].id;
  S.lkKarteOeffnen(kid);
  pruefe(el.scrollTop === 0 && inhalt().indexOf('lkV') >= 0, 'Bearbeiten weit unten: Inhalt rollt nach oben, Fenster sichtbar');
  S.lkFensterZu();
  pruefe(el.scrollTop === 900, 'nach dem Schließen wieder an der alten Stelle');
  el.scrollTop = 500; S.lkKarteOeffnen(kid); S.document.getElementById('lkV').value = 'C neu'; S.document.getElementById('lkR').value = '3'; S.lkKarteSpeichern();
  pruefe(el.scrollTop === 500 && S.lkDaten().kaesten[0].karten[2].v === 'C neu', 'auch nach Speichern zurück an die Stelle');
  S.DB.lernkaesten = []; S.DB.lernstand = [];
  S.oeffne('uebersicht');
}

/* ============================================================
   55. Lernkartei in der workbench.json (0.24)
   Grund: Pixel und iPad lernen mit demselben Stand. Der Lernstand
   liegt je Karte in der Datenbank, die großen Paketinhalte bleiben auf
   dem Gerät. Fehler hier kosten Wochen an Lernstand.
   Erkennt: Lernstand/Kästen nicht in der DB, Paketinhalte blähen die
   DB auf, zweites Gerät legt doppelten Kasten an oder verliert den
   Stand, Abgleich nicht je Karte, Neu-pro-Tag nicht geräteübergreifend,
   Übernahme aus 0.23 verliert Karten, Löschen ohne Grabstein.
   ============================================================ */
function lkSyncTest() {
  console.log('\n55. Lernkartei in der workbench.json (0.24)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  const leeren = () => { delete S.__ablage['clie-lernkartei']; delete S.__ablage['clie-lernkartei-pakete']; S.DB.lernkaesten = []; S.DB.lernstand = []; S.DB.grabsteine = []; };
  leeren();
  const heute = S.isoDatum();
  pruefe(Array.isArray(S.leereDatenbank().lernkaesten) && Array.isArray(S.leereDatenbank().lernstand), 'Workbench-Unterbau kennt lernkaesten und lernstand (6.3.2)');
  pruefe(S.SAMMLUNGEN.indexOf('lernkaesten') >= 0 && S.SAMMLUNGEN.indexOf('lernstand') >= 0, 'beide Bereiche werden abgeglichen');
  const karten = []; for (let i = 1; i <= 30; i++) { karten.push({ id: 'x-' + i, v: 'Frage ' + i, r: 'Langer geheimer Antworttext Nummer ' + i }); }
  const paket = { format: 'clie-lernkartei', paket: { id: 'sync-paket', name: 'Sync', version: 1 }, karten: karten };
  S.lkPaketPruefen(JSON.stringify(paket), 'sync.json'); S.lkPaketUebernehmen();
  let d = S.lkDaten(); const k = d.kaesten[0];
  pruefe(S.DB.lernkaesten.length === 1 && S.DB.lernkaesten[0].paket.id === 'sync-paket', 'Kasten steht in der Datenbank');
  pruefe(JSON.stringify(S.DB).indexOf('geheimer Antworttext') < 0 && String(S.__ablage['clie-lernkartei-pakete']).indexOf('geheimer Antworttext') >= 0,
    'Paketinhalte bleiben auf dem Gerät, nicht in der workbench.json');
  k.neuProTag = 5; S.lkSichern(d);
  S.lkLernen(k.id); S.lkUmdrehen(); S.lkBewerten('g'); S.lkUmdrehen(); S.lkBewerten('g');
  pruefe(S.DB.lernstand.length === 2 && S.DB.lernstand.every(s => s.f === 2 && s.e === heute && s.geaendert > 0 && s.id.indexOf(k.id + '|x-') === 0),
    'Lernstand je Karte in der DB (Fach, Termin, Tag der Einführung, Zeitstempel)');
  pruefe(JSON.stringify(S.DB.lernstand[0]).length < 140, 'ein Lernstand-Eintrag ist klein (' + JSON.stringify(S.DB.lernstand[0]).length + ' Zeichen)');
  /* Zweites Gerät: gleiche DB, aber Paket noch nicht geladen */
  const dbPixel = JSON.parse(JSON.stringify(S.DB));
  delete S.__ablage['clie-lernkartei-pakete'];
  d = S.lkDaten();
  pruefe(d.kaesten.length === 1 && d.kaesten[0].fehlt, 'iPad ohne Paket: Kasten da, als „Paket fehlt“ markiert');
  S.oeffne('lernkartei'); S.lkWechseln(k.id);
  pruefe(inhalt().indexOf('lk-hinweis') >= 0 && inhalt().indexOf('lkPaketWaehlen') >= 0, 'Hinweis mit „Paket laden …“');
  S.lkSichern(S.lkDaten());
  pruefe(S.DB.lernstand.length === 2, 'Sichern ohne Paket löscht keinen Lernstand');
  pruefe(S.lkNeuFrei(S.lkDaten(), S.lkDaten().kaesten[0]) === 0, 'ohne Paketkarten keine neuen');
  S.lkPaketPruefen(JSON.stringify(paket), 'sync.json'); S.lkPaketUebernehmen();
  d = S.lkDaten();
  pruefe(d.kaesten.length === 1 && !d.kaesten[0].fehlt && d.kaesten[0].karten.filter(c => c.fach === 2).length === 2, 'Paket auf dem iPad geladen: kein zweiter Kasten, Lernstand da');
  pruefe(S.lkNeuFrei(d, d.kaesten[0]) === 3, 'Neu pro Tag zählt über Geräte (5 − 2 schon eingeführt)');
  /* Beide Geräte lernen dieselbe Karte — je Karte gewinnt der jüngere Stand */
  const ipad = JSON.parse(JSON.stringify(S.DB));
  const id1 = dbPixel.lernstand[0].id, id2 = dbPixel.lernstand[1].id;
  dbPixel.lernstand[0].f = 3; dbPixel.lernstand[0].geaendert += 1000;
  ipad.lernstand.filter(s => s.id === id2)[0].f = 1; ipad.lernstand.filter(s => s.id === id2)[0].geaendert += 2000;
  const m = S.zusammenfuehren(dbPixel, ipad); const db = m.db || m.ergebnis || m;
  pruefe(db.lernstand.filter(s => s.id === id1)[0].f === 3 && db.lernstand.filter(s => s.id === id2)[0].f === 1, 'Abgleich: Karte 1 vom Pixel, Karte 2 vom iPad');
  /* Eigene Karte und Bearbeitung einer Paketkarte reisen mit */
  S.DB = db; d = S.lkDaten(); const kk = d.kaesten[0];
  kk.karten.push({ id: 'eig1', v: 'Eigene', r: 'Karte', w: '', p: false, eigen: true, fach: 0, faellig: '', e: '', gesehen: 0 });
  kk.karten.filter(c => c.id === 'x-5')[0].r = 'korrigiert'; kk.karten.filter(c => c.id === 'x-5')[0].eigen = true;
  S.lkSichern(d);
  const satz = S.DB.lernkaesten[0];
  pruefe(satz.karten.length === 2 && satz.karten.some(c => c.id === 'x-5' && c.r === 'korrigiert'), 'eigene Karte und bearbeitete Paketkarte stehen im Kasten (DB)');
  delete S.__ablage['clie-lernkartei-pakete'];
  pruefe(S.lkDaten().kaesten[0].karten.length === 2, 'auf einem Gerät ohne Paket sind sie trotzdem da');
  S.lkPaketPruefen(JSON.stringify(paket), 'sync.json'); S.lkPaketUebernehmen();
  d = S.lkDaten();
  pruefe(d.kaesten[0].karten.length === 31 && d.kaesten[0].karten.filter(c => c.id === 'x-5')[0].r === 'korrigiert', 'mit Paket: Bearbeitung überdeckt den Paketinhalt');
  /* Paketkarte löschen → merkt sich der Kasten */
  S.cl.lk.id = d.kaesten[0].id; S.cl.lk.karte = 'x-7'; S.lkKarteLoeschen();
  pruefe(S.DB.lernkaesten[0].weg.indexOf('x-7') >= 0 && S.lkDaten().kaesten[0].karten.length === 30, 'gelöschte Paketkarte bleibt weg (auch nach Neuladen)');
  /* Kasten löschen → Grabsteine */
  const kid = S.DB.lernkaesten[0].id;
  S.cl.lk.id = kid; S.lkKastenLoeschen();
  pruefe(!S.DB.lernkaesten.length && !S.DB.lernstand.length && S.DB.grabsteine.some(g => g.s === 'lernkaesten' && g.id === kid) && S.DB.grabsteine.some(g => g.s === 'lernstand'),
    'Kasten löschen: Kasten und Lernstand mit Grabstein weg');
  /* Übernahme aus 0.23 */
  leeren();
  S.__ablage['clie-lernkartei'] = JSON.stringify({ kaesten: [
    { id: 'alt1', name: 'Italienisch', paket: { id: 'it', version: 1 }, neuProTag: 10, richtung: 'rueck', karten: [
      { id: 'q1', q: 'it-0001', v: 'il pane', r: 'das Brot', w: 'das Brot', fach: 3, faellig: '2026-12-01', gesehen: 4 },
      { id: 'q2', q: 'it-0002', v: 'la casa', r: 'das Haus', w: 'das Haus', fach: 0, faellig: '' },
      { id: 'own', v: 'Eigene', r: 'Karte', fach: 2, faellig: '2026-11-11', gesehen: 1 }] }], neu: { datum: heute, z: {} } });
  const n = S.lkAltUebernehmen();
  d = S.lkDaten();
  const ka = d.kaesten[0];
  pruefe(n === 1 && ka && ka.name === 'Italienisch' && ka.richtung === 'rueck' && ka.neuProTag === 10 && ka.karten.length === 3, 'Übernahme aus 0.23: Kasten mit allen Karten und Einstellungen');
  pruefe(ka.karten.filter(c => c.id === 'it-0001')[0].fach === 3 && ka.karten.filter(c => c.id === 'own')[0].fach === 2 && S.DB.lernstand.length === 2, 'Übernahme: Lernstand bleibt, Schlüssel = Paket-Karten-ID');
  pruefe(!S.__ablage['clie-lernkartei'] && !!S.__ablage['clie-lernkartei-alt'] && S.lkAltUebernehmen() === 0, 'Übernahme nur einmal, alter Stand als Sicherung behalten');
  pruefe(QUELLE.indexOf('lkAltUebernehmen();') >= 0, 'Übernahme läuft nach dem Laden der Datenbank');
  leeren();
  S.oeffne('uebersicht');
}

/* ============================================================
   54. Lernkartei umschalten (0.23.1)
   Grund: Mit mehreren Paketen muss der Kasten schnell wechselbar sein.
   Erkennt: Kopf zeigt nicht den offenen Kasten, Aufklappliste fehlt
   oder ohne Fälligkeit, Wechsel lässt alte Sitzung/Fenster offen.
   ============================================================ */
function lkWahlTest() {
  console.log('\n54. Lernkartei umschalten (0.23.1)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  delete S.__ablage['clie-lernkartei']; delete S.__ablage['clie-lernkartei-pakete']; S.DB.lernkaesten = []; S.DB.lernstand = [];
  const a = S.lkKastenNeu('Italienisch'); const b = S.lkKastenNeu('Ein sehr langer Kastenname für den Kopf');
  let d = S.lkDaten(); S.lkKasten(d, a).karten = S.lkKartenAusText('A\n1\n\nB\n2'); S.lkSichern(d);
  S.oeffne('lernkartei');
  pruefe(S.lkKopfText() === 'Alle Kästen', 'Kopf zeigt „Alle Kästen“ in der Liste');
  S.katUm();
  pruefe(S.cl.aufklapp === 'lkwahl', 'Tipp auf den Kopf öffnet die Kastenwahl');
  const h = S.lkWahlHtml();
  pruefe(h.indexOf("lkWechseln('" + a + "')") >= 0 && h.indexOf("lkWechseln('" + b + "')") >= 0 && h.indexOf("lkWechseln('')") >= 0, 'Wahl listet alle Kästen und „Alle“');
  pruefe(/Italienisch<\/span><b>2<\/b>/.test(h), 'Wahl zeigt die heute fälligen/neuen Karten je Kasten');
  S.lkLernen(a); S.cl.lk.fenster = 'details';
  S.lkWechseln(b);
  pruefe(S.cl.lk.id === b && S.cl.lk.ansicht === 'kasten' && !S.cl.lk.sitzung && !S.cl.lk.fenster && !S.cl.aufklapp, 'Wechsel öffnet den Kasten, beendet Sitzung und Fenster');
  pruefe(S.lkKopfText().length <= 18 && /…$/.test(S.lkKopfText()), 'langer Name im Kopf gekürzt');
  S.lkWechseln('');
  pruefe(S.cl.lk.id === '' && S.cl.lk.ansicht === 'liste', '„Alle Kästen“ führt zur Liste');
  S.lkWechseln('gibtsnicht');
  pruefe(S.cl.lk.ansicht === 'liste', 'unbekannter Kasten → Liste statt Fehler');
  delete S.__ablage['clie-lernkartei']; delete S.__ablage['clie-lernkartei-pakete']; S.DB.lernkaesten = []; S.DB.lernstand = [];
  S.oeffne('uebersicht');
}

/* ============================================================
   53. Lernkartei (0.23)
   Grund: Lernstand ist Arbeit von Wochen. Falsch einsortierte Karten,
   ein Paket-Update, das den Lernstand löscht, oder Listen, die sich nicht
   aufdecken lassen, würden das Lernen kaputt machen.
   Erkennt: falsche Fächer/Intervalle, Neu-pro-Tag-Grenze, Einfügen und
   Memo-Übernahme, Paket-Update ohne Verlust, Rückrichtung, Punkt-für-
   Punkt-Aufdecken, Heute-Hinweis, Zurück-Taste.
   ============================================================ */
function lernkarteiTest() {
  console.log('\n53. Lernkartei (0.23)');
  if (!CL) { return; }
  frisch();
  const S = CL;
  delete S.__ablage['clie-lernkartei']; delete S.__ablage['clie-lernkartei-pakete']; S.DB.lernkaesten = []; S.DB.lernstand = [];
  const heute = S.isoDatum();
  pruefe(S.lkDaten().kaesten.length === 0, 'leerer Anfang ohne Fehler');
  /* Text einfügen */
  const k = S.lkKartenAusText('Haus\nla casa\n\nBrot\nil pane\n\n\nISTQB Teststufen\n- Komponententest\n- Integrationstest\n- Systemtest\n- Abnahmetest');
  pruefe(k.length === 3 && k[2].r.split('\n').length === 4 && k[0].v === 'Haus', 'Einfügen: Leerzeile trennt, 1. Zeile Vorderseite, Rest Rückseite');
  const m = S.lkKartenAusMemo('Einleitung ohne Überschrift\n# Begriff A\nErklärung A\n## Begriff B\n[ ] Punkt 1\n[x] Punkt 2\n# Leer\n');
  pruefe(m.length === 2 && m[1].r === '- Punkt 1\n- Punkt 2', 'Memo: Überschrift → Karte, Kästchen werden Aufzählung, leere fallen weg');
  /* Kasten mit Karten */
  const id = S.lkKastenNeu('Test');
  let d = S.lkDaten();
  const ka = S.lkKasten(d, id);
  ka.karten = k; ka.neuProTag = 2;
  S.lkSichern(d);
  d = S.lkDaten();
  pruefe(S.lkNeuFrei(d, S.lkKasten(d, id)) === 2 && S.lkHeuteZahl(d, S.lkKasten(d, id)) === 2, 'Neu pro Tag begrenzt (2 von 3)');
  /* Lernen: Karte 1 gewusst, Karte 2 nicht */
  S.oeffne('lernkartei');
  S.lkKastenOeffnen(id);
  S.cl.lk.sitzung = null;
  S.lkLernen(id);
  pruefe(S.cl.lk.ansicht === 'lernen' && S.cl.lk.sitzung.schlange.length === 2, 'Sitzung mit 2 Karten');
  pruefe(inhalt().indexOf('lkUmdrehen') >= 0 && inhalt().indexOf('lkBewerten') < 0, 'erst Frage, Bewerten erst nach Umdrehen');
  S.lkUmdrehen();
  pruefe(inhalt().indexOf("lkBewerten('g')") >= 0, 'nach Umdrehen: Gewusst / Teilweise / Nicht');
  const erste = S.cl.lk.sitzung.schlange[0].c;
  S.lkBewerten('g');
  let c1 = S.lkDaten().kaesten[0].karten.filter(x => x.id === erste)[0];
  pruefe(c1.fach === 2 && c1.faellig === S.tagePlus(heute, 2), 'neue Karte gewusst → Fach 2, fällig in 2 Tagen');
  const zweite = S.cl.lk.sitzung.schlange[1].c;
  S.lkUmdrehen(); S.lkBewerten('n');
  let c2 = S.lkDaten().kaesten[0].karten.filter(x => x.id === zweite)[0];
  pruefe(c2.fach === 1 && S.cl.lk.sitzung.schlange.length === 3, 'nicht gewusst → Fach 1 und heute noch einmal');
  S.lkUmdrehen(); S.lkBewerten('n');
  pruefe(S.cl.lk.sitzung.schlange.length === 3 && inhalt().indexOf('Geschafft') >= 0, 'nur einmal wiederholt, dann Ende mit Bilanz');
  d = S.lkDaten();
  pruefe(S.lkNeuFrei(d, S.lkKasten(d, id)) === 0, 'Neu-Grenze für heute verbraucht');
  /* Fach 5 bleibt Fach 5, Teilweise bleibt */
  c1 = S.lkKasten(d, id).karten.filter(x => x.id === erste)[0];
  c1.fach = 5; c1.faellig = heute; S.lkSichern(d);
  S.lkLernen(id);
  const pos = S.cl.lk.sitzung.schlange.findIndex(e => e.c === erste);
  S.cl.lk.sitzung.i = pos; S.lkUmdrehen(); S.lkBewerten('g');
  c1 = S.lkDaten().kaesten[0].karten.filter(x => x.id === erste)[0];
  pruefe(c1.fach === 5 && c1.faellig === S.tagePlus(heute, 16), 'Fach 5 gewusst → bleibt, 16 Tage');
  d = S.lkDaten(); c1 = S.lkKasten(d, id).karten.filter(x => x.id === erste)[0]; c1.fach = 3; c1.faellig = heute; S.lkSichern(d);
  S.lkLernen(id); S.cl.lk.sitzung.i = S.cl.lk.sitzung.schlange.findIndex(e => e.c === erste); S.lkUmdrehen(); S.lkBewerten('t');
  c1 = S.lkDaten().kaesten[0].karten.filter(x => x.id === erste)[0];
  pruefe(c1.fach === 3 && c1.faellig === S.tagePlus(heute, 1), 'Teilweise → bleibt im Fach, morgen wieder');
  /* Liste Punkt für Punkt */
  const html0 = S.lkTextHtml('Teststufen:\n- A\n- **B**\n- C', 1);
  pruefe((html0.match(/lk-punkt zu/g) || []).length === 2 && html0.indexOf('>A<') >= 0, 'Liste: 1 von 3 Punkten aufgedeckt');
  pruefe(S.lkTextHtml('**fett** <x>', -1).indexOf('<b>fett</b> &lt;x&gt;') >= 0, 'fett erlaubt, sonst kein HTML');
  pruefe(S.lkPunkte('a\n1. x\n2) y\n• z') === 3, 'Aufzählungen mit -, •, 1. und 2) erkannt');
  /* Rückrichtung */
  const r = S.lkSeiten({ v: 'il pane', r: 'das Brot\n[il PA-ne]', w: 'das Brot' }, true);
  pruefe(r.frage === 'das Brot' && r.antwort.indexOf('il pane') === 0, 'Rückrichtung: deutsche Seite fragt, Fremdwort ist Antwort');
  /* Paket laden und aktualisieren */
  const paket = { format: 'clie-lernkartei', paket: { id: 'test-paket', name: 'Testpaket', version: 1 }, karten: [{ id: 'a', v: 'A', r: 'eins' }, { id: 'b', v: 'B', r: 'zwei' }] };
  pruefe(!S.lkPaketPruefen('{"x":1}', 'f.json') && S.lkPaketPruefen(JSON.stringify(paket), 'p.json') && S.cl.lk.fenster === 'paket', 'falsches Format abgelehnt, Paket zeigt Vorschau');
  S.lkPaketUebernehmen();
  d = S.lkDaten();
  let pk = d.kaesten.filter(x => x.paket && x.paket.id === 'test-paket')[0];
  pruefe(pk && pk.karten.length === 2, 'Paket wird neuer Kasten');
  pk.karten[0].fach = 4; pk.karten[0].faellig = '2099-01-01'; S.lkSichern(d);
  paket.paket.version = 2; paket.karten[1].r = 'zwei (neu)'; paket.karten.push({ id: 'c', v: 'C', r: 'drei' });
  S.lkPaketPruefen(JSON.stringify(paket), 'p.json'); S.lkPaketUebernehmen();
  d = S.lkDaten();
  pk = d.kaesten.filter(x => x.paket && x.paket.id === 'test-paket');
  pruefe(pk.length === 1 && pk[0].karten.length === 3 && pk[0].karten[0].fach === 4 && pk[0].karten[1].r === 'zwei (neu)' && pk[0].paket.version === 2,
    'Update: kein zweiter Kasten, neue Karte dazu, Text aktualisiert, Lernstand bleibt');
  /* Heute-Hinweis und Zurück */
  pruefe(/Karten fällig/.test(S.ordnerStandText('lernkartei')), 'fällige Lernkarten stehen im Ordner Lernen (seit 0.63 keine App „Heute“) — ' + S.ordnerStandText('lernkartei'));
  S.oeffne('lernkartei'); S.lkKastenOeffnen(id); S.lkKartenZeigen();
  pruefe(inhalt().indexOf('lkSuche') >= 0, 'Kartenliste mit Suche');
  S.clZurueck(); pruefe(S.cl.lk.ansicht === 'kasten', 'Zurück: Karten → Kasten');
  S.clZurueck(); pruefe(S.cl.lk.ansicht === 'liste' && S.cl.app === 'lernkartei', 'Zurück: Kasten → Liste');
  /* Karte bearbeiten und Kasten löschen */
  S.lkKastenOeffnen(id); S.lkKarteOeffnen('');
  S.document.getElementById('lkV').value = 'Neu'; S.document.getElementById('lkR').value = 'Rück';
  S.lkKarteSpeichern();
  pruefe(S.lkKasten(S.lkDaten(), id).karten.length === 4, 'neue Karte gespeichert');
  S.lkFensterAuf('details'); S.lkKastenLoeschen();
  pruefe(!S.lkKasten(S.lkDaten(), id) && S.cl.lk.ansicht === 'liste', 'Kasten gelöscht');
  delete S.__ablage['clie-lernkartei']; delete S.__ablage['clie-lernkartei-pakete']; S.DB.lernkaesten = []; S.DB.lernstand = [];
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
  try { rollbarTest(); } catch (e) { fail('Bildlaufleiste warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { terminArtenTest(); } catch (e) { fail('Arten im Termin warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { lesezeichenTest(); } catch (e) { fail('Lesezeichen warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { jahrTest(); } catch (e) { fail('Jahrestermine warf: ' + e.message); }
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
  try { ansichtTest(); } catch (e) { fail('Aufgabensicht warf: ' + e.message); }
  try { stonesTest(); } catch (e) { fail('Stones warf: ' + e.message); }
  try { await driveTest(); } catch (e) { fail('Drive warf: ' + e.message); }
  try { await driveRechtTest(); } catch (e) { fail('Drive-Recht warf: ' + e.message); }
  try { schachTest(); } catch (e) { fail('Schach warf: ' + e.message); }
  try { schachPartienTest(); } catch (e) { fail('Schach-Partien warf: ' + e.message); }
  try { schuleTest(); } catch (e) { fail('Schachschule warf: ' + e.message); }
  try { katUebersichtTest(); } catch (e) { fail('Kategorien-▼ warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { memoSeiteStattArtTest(); } catch (e) { fail('Seite statt Notizblock warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { privatTest(); } catch (e) { fail('Privat warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { kategorienTest(); } catch (e) { fail('Kategorien warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { aufgabenNotizTest(); } catch (e) { fail('Aufgaben-Notiz warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { agendaTest(); } catch (e) { fail('Agenda warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { notizblockTest(); } catch (e) { fail('Notizblock warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { handschriftTest(); } catch (e) { fail('Handschrift warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { ohneHeuteTest(); } catch (e) { fail('Ohne Heute warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { sammlerTest(); } catch (e) { fail('Sammler warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { toDoTest(); } catch (e) { fail('To Do warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { filterZweiTest(); } catch (e) { fail('Filter zwei warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { sammlungPlanenTest(); } catch (e) { fail('Sammlung planen warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { trainingSportDoppeltTest(); } catch (e) { fail('Training Sport doppelt warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { spaltenBreitenTest(); } catch (e) { fail('Spaltenbreiten warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { sammlungSucheTest(); } catch (e) { fail('Sammlung-Suche warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { morgengrussTest(); } catch (e) { fail('Morgengruß warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { kampagneTest(); } catch (e) { fail('Kampagne warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { coSubstanzTest(); } catch (e) { fail('Substanz warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { vlAusspracheTest(); } catch (e) { fail('Vorlesen-Aussprache warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { clsAusNotizTest(); } catch (e) { fail('Checkliste aus Notiz warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { memoLoeschenTest(); } catch (e) { fail('Notiz löschen warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { coPrioTest(); } catch (e) { fail('Coach-Prioritäten warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { coKorbTest(); } catch (e) { fail('Coach-Sammler warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { saImportTest(); } catch (e) { fail('Tabellen-Import warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { ckPrioTest(); } catch (e) { fail('Prioritäten 1–5 warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { ckKorbTest(); } catch (e) { fail('Sammler warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { ckZustandTest(); } catch (e) { fail('Checklisten-Zustand warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { clsAusListeTest(); } catch (e) { fail('Checkliste aus Liste warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { clsKompaktTest(); } catch (e) { fail('Checklisten kompakt warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { saSymbolTest(); } catch (e) { fail('Sammlung-Symbole warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { appSymbolTest(); } catch (e) { fail('App-Symbol warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { diaZeitraumTest(); } catch (e) { fail('Diagramm-Zeitraum warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { spaltenSortTest(); } catch (e) { fail('Spalten-Sortieren warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { diagrammeTest(); } catch (e) { fail('Diagramme warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { kopfwertNameTest(); } catch (e) { fail('Kopfwert-Name warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { blattTest(); } catch (e) { fail('Blättern warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { menueInfoTest(); } catch (e) { fail('Menü/Info warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { klammerWechselTest(); } catch (e) { fail('Klammer-Wechsel warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { invasionTest(); } catch (e) { fail('Invasion warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { zieleTest(); } catch (e) { fail('Ziele warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { projekteTest(); } catch (e) { fail('Projekte warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { lzGruppenTest(); } catch (e) { fail('Lesezeichen-Gruppen warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { rollbarTest(); } catch (e) { fail('Bildlaufleiste warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { terminArtenTest(); } catch (e) { fail('Arten im Termin warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { lesezeichenTest(); } catch (e) { fail('Lesezeichen warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { jahrTest(); } catch (e) { fail('Jahr warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { memoBereichTest(); } catch (e) { fail('Memo-Bereich warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { startOrdnerTest(); } catch (e) { fail('Start mit Ordnern warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { coachQuellenTest(); } catch (e) { fail('Coach-Quellen warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { coachTest(); } catch (e) { fail('Coach warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { await coachVorabTest(); } catch (e) { fail('Coach vorab warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { spieleSudokuTest(); } catch (e) { fail('Sudoku warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { solitaerTest(); } catch (e) { fail('Solitär warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { eingabeTest(); } catch (e) { fail('Getipptes/Liste löschen warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { ideenTest(); } catch (e) { fail('Ideenwerkstatt warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { kurs2Test(); } catch (e) { fail('Kurs 2.0 warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { naechsteFaelligTest(); } catch (e) { fail('1. Nächste warf: ' + e.message); }
  try { vlMarkenTest(); } catch (e) { fail('Lesezeichen warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { await vlDoppeltTest(); } catch (e) { fail('Vorlesen doppelt warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { kursTest(); } catch (e) { fail('Kurs warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { neu027Test(); } catch (e) { fail('0.27 warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { vorlesenTest(); } catch (e) { fail('Vorlesen warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { schErklTest(); } catch (e) { fail('Schach erklären warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { lkRollTest(); } catch (e) { fail('Lernkartei rollen warf: ' + e.message); }
  try { lkSyncTest(); } catch (e) { fail('Lernkartei-Abgleich warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  try { lkWahlTest(); } catch (e) { fail('Lernkartei umschalten warf: ' + e.message); }
  try { lernkarteiTest(); } catch (e) { fail('Lernkartei warf: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }

  /* ============================================================
     ERGEBNIS
     ============================================================ */
  console.log('\nERGEBNIS: ' + anzOk + ' ok, ' + anzFail + ' fehlgeschlagen, ' + anzWarn + ' Warnungen');
  process.exit(anzFail ? 1 : 0);
})();
