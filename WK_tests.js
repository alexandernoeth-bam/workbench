/* ============================================================
   WK_tests.js — Regressionstests für den Wochenkompass
   Aufruf:  node WK_tests.js [wochenkompass.html] [workbench.html]

   Mit dem zweiten Pfad wird zusätzlich geprüft, dass der Unterbau
   wörtlich der Workbench entspricht und dass beide Apps über
   workbench.json zusammenarbeiten. Ohne ihn werden diese Prüfungen
   als „warn“ übersprungen — der Wochenkompass arbeitet auch allein.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATEI = process.argv[2] || path.join(__dirname, 'wochenkompass.html');
const WB_DATEI = process.argv[3] || path.join(path.dirname(path.resolve(DATEI)), 'workbench.html');

if (!fs.existsSync(DATEI)) {
  console.log('FEHLER: Datei nicht gefunden: ' + DATEI);
  process.exit(1);
}

const QUELLE = fs.readFileSync(DATEI, 'utf8');
const ORDNER = path.dirname(path.resolve(DATEI));
const WB_QUELLE = fs.existsSync(WB_DATEI) ? fs.readFileSync(WB_DATEI, 'utf8') : '';
const SW_PFAD = path.join(ORDNER, 'sw-wochenkompass.js');
const SW_QUELLE = fs.existsSync(SW_PFAD) ? fs.readFileSync(SW_PFAD, 'utf8') : '';
const MANIFEST_PFAD = path.join(ORDNER, 'wochenkompass.webmanifest');

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

/* Eine eigene Umgebung je App: So laufen Wochenkompass und Workbench
   nebeneinander, ohne sich Variablen zu teilen. */
function umgebung() {
  const elemente = {};
  const element = function (id) {
    return {
      id: id, innerHTML: '', textContent: '', value: '', className: '', style: {}, scrollTop: 0,
      selectionStart: 0, selectionEnd: 0,
      setSelectionRange(a, b) { this.selectionStart = a; this.selectionEnd = b; },
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener() {}, removeEventListener() {}, focus() {}, blur() {}, click() {},
      appendChild() {}, removeChild() {}, setAttribute() {}, getAttribute() { return null; },
      getBoundingClientRect() { return { top: 0, bottom: 800, height: 800, width: 800 }; },
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
    localStorage: speicher, sessionStorage: speicher, indexedDB: null, innerWidth: 1280, innerHeight: 800,
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
  ctx.__elemente = elemente;
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
  const titel = (QUELLE.match(/<title>Wochenkompass ([\d.]+)<\/title>/) || [])[1];
  const kopf = (QUELLE.match(/Wochenkompass <small>v([\d.]+)<\/small>/) || [])[1];
  pruefe(version && version === titel && version === kopf, 'Version steht gleich in Titel, Kopf und APP_VERSION (' + version + ')');
  pruefe(!/@media/.test(QUELLE), 'keine @media-Regeln — Breite über body.breit');
  pruefe(/body\.breit \.leiste\{position:static/.test(QUELLE), 'am großen Bildschirm steht die Seitenleiste fest, am Handy ist sie eine Schublade');
  const fns = [...SKRIPT.matchAll(/\nfunction (\w+)\s*\(/g)].map(m => m[1]);
  const doppelt = [...new Set(fns.filter((f, i) => fns.indexOf(f) !== i))];
  pruefe(doppelt.length === 0, 'keine doppelt definierten Funktionen' + (doppelt.length ? ' — gefunden: ' + doppelt.join(', ') : ''));

  const code = SKRIPT.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const definiert = new Set(fns);
  const aufrufe = new Set([...code.matchAll(/on(?:click|input|change|keydown|mousedown)=\\?["'](?:[^"']*?;)?\s*([A-Za-z_]\w*)\(/g)].map(m => m[1])
    .concat([...QUELLE.replace(/<script>[\s\S]*?<\/script>/g, '').matchAll(/on(?:click|input|change|keydown|mousedown)="([A-Za-z_]\w*)\(/g)].map(m => m[1])));
  const fremd = [...aufrufe].filter(a => !definiert.has(a) && ['event', 'if'].indexOf(a) < 0);
  pruefe(fremd.length === 0, 'Bedienelemente rufen nur Funktionen, die es gibt' + (fremd.length ? ' — fehlt: ' + fremd.join(', ') : ''));
}

/* ============================================================
   2. Werkzeugleiste — wie die Gedankenfläche, ohne Kästchen und Datum
   ============================================================ */
console.log('\n2. Werkzeugleiste');
{
  const w = (SKRIPT.match(/var KP_WERKZEUG = \[([\s\S]*?)\n\];/) || [])[1] || '';
  pruefe(/umschliessen\(\\'~~\\'\)/.test(w) && /<s>S<\/s>/.test(w) && /Durchstreichen/.test(w), 'Durchstreichen ist ein eigener, deutlicher Knopf');
  pruefe(/zeilenArt\(\\'h1\\'\)/.test(w) && /zeilenArt\(\\'h2\\'\)/.test(w) && /zeilenArt\(\\'punkt\\'\)/.test(w) && /zeilenArt\(\\'nummer\\'\)/.test(w),
         'Überschriften, Aufzählung und Nummern sind da');
  pruefe(!/kasten|☐|\[\]/.test(w) && !/datum|📅/i.test(w), 'kein Kästchen und kein Datum in der Leiste');
  pruefe(/onmousedown="event\.preventDefault\(\)"/.test(SKRIPT), 'die Knöpfe nehmen dem Schreibfeld die Auswahl nicht weg');
}

/* ============================================================
   3. Unterbau: wörtlich aus der Workbench
   Grund: Speicher, Anmeldung und Abgleich müssen in beiden Apps gleich
   arbeiten, sonst verschmilzt Drive die Daten nicht verlässlich.
   ============================================================ */
console.log('\n3. Unterbau aus der Workbench');
{
  const WOERTLICH = ['leereDatenbank', 'zusammenfuehren', 'alsText', 'uebernehmen', 'speichern', 'laden',
    'grabsteinSetzen', 'grabsteinZeit', 'grabsteineAufraeumen', 'textZuBestand', 'abgleichen', 'abgleichPlanen',
    'driveSuchen', 'driveAnlegen', 'driveHochladen', 'driveHerunterladen', 'antwortPruefen',
    'tokenMerken', 'tokenGueltig', 'klientVorbereiten', 'anmelden', 'anmeldeVersuch', 'abmelden',
    'erneuerungPlanen', 'erneuerungPruefen', 'dateiWaehlen', 'dateiAnlegen', 'opfsSchreiben', 'opfsLesen',
    'montagVon', 'kalenderwoche', 'neueKennung', 'esc'];
  if (!WB_SKRIPT) {
    warn('workbench.html nicht neben dem Wochenkompass — Vergleich übersprungen');
  } else {
    const abweichend = WOERTLICH.filter(n => funktionText(SKRIPT, n) === null || funktionText(SKRIPT, n) !== funktionText(WB_SKRIPT, n));
    pruefe(abweichend.length === 0, WOERTLICH.length + ' Funktionen stimmen wörtlich mit der Workbench überein'
           + (abweichend.length ? ' — abweichend: ' + abweichend.join(', ') : ''));
    const a1 = funktionText(SKRIPT, 'anmeldeAnfragen') || '';
    const a2 = (funktionText(WB_SKRIPT, 'anmeldeAnfragen') || '').replace('      termineHolen(false);\n', '');
    pruefe(a1 && a1 === a2, 'die Anmeldung weicht nur um das Holen der Termine ab');
    const s1 = (SKRIPT.match(/var SAMMLUNGEN = (\[[\s\S]*?\]);/) || [])[1];
    const s2 = (WB_SKRIPT.match(/var SAMMLUNGEN = (\[[\s\S]*?\]);/) || [])[1];
    pruefe(s1 && s1 === s2, 'dieselben Sammlungen — auch, was der Wochenkompass nicht zeigt, geht unverändert durch');
    const wert = (s, n) => (s.match(new RegExp("var " + n + "\\s*=\\s*'([^']*)';")) || [])[1];
    pruefe(wert(SKRIPT, 'CLIENT_ID') === wert(WB_SKRIPT, 'CLIENT_ID'), 'dieselbe Google-Anwendung — nur so ist dieselbe workbench.json sichtbar');
  }
  const wert = n => (SKRIPT.match(new RegExp("var " + n + "\\s*=\\s*'([^']*)';")) || [])[1];
  pruefe(wert('DRIVE_DATEI') === 'workbench.json' && wert('DATEINAME') === 'workbench.json', 'Drive-Datei und Dateiname: workbench.json');
  pruefe(['LS_KEY', 'OPFS_NAME', 'IDB_NAME', 'TOKEN_KEY', 'ANMELDE_MERKER'].every(n => /^wochenkompass/.test(wert(n) || '')),
         'eigene Namen für Gerätespeicher und Anmeldung — beide Apps überschreiben einander nicht');
  pruefe(wert('SCOPES') === 'https://www.googleapis.com/auth/drive.file', 'nur das Recht drive.file — kein Kalender');
}

const WK = ladeIn(SKRIPT, 'wochenkompass.html');
if (WK) { ok('der Wochenkompass lässt sich außerhalb des Browsers auswerten'); }

function frisch() {
  WK.DB = WK.leereDatenbank();
  WK.kp.art = 'woche'; WK.kp.id = ''; WK.kp.va = ''; WK.kp.frage = ''; WK.kp.modus = 'ansicht';
  WK.zurueckHolen = null;
}

/* ============================================================
   4. ★ Diese Woche und das Archiv
   ============================================================ */
console.log('\n4. Wochenseiten');
if (WK) {
  frisch();
  const mo = WK.kpHeuteMontag();
  pruefe(WK.ausIso(mo).getDay() === 1, 'die laufende Woche beginnt am Montag');
  const g = WK.kpWocheAnlegen(mo);
  pruefe(g && g.id === 'kw-' + mo && g.kompass === 'woche' && g.woche === mo, 'eine Wochenseite hat die feste Kennung kw-<Montag>');
  pruefe(/^# Woche \d+/.test(g.text) && /## Was diese Woche Substanz schafft\n- /.test(g.text) && /## Verbindlichkeiten\n- /.test(g.text),
         'sie beginnt mit dem Gerüst: Substanz und Verbindlichkeiten');
  WK.kpWocheAnlegen(mo);
  pruefe(WK.DB.gedanken.length === 1, 'dieselbe Woche zweimal angelegt ergibt eine Seite');
  pruefe(WK.kpWocheAnlegen('kaputt') === null, 'ein ungültiger Montag wird abgewiesen');
  WK.kpWocheAnlegen(WK.tagePlus(mo, -7));
  WK.kpWocheAnlegen(WK.tagePlus(mo, -14));
  WK.kpWocheAnlegen(WK.tagePlus(mo, 7));
  pruefe(WK.kpWochen().map(x => x.woche).join(',') === [7, 0, -7, -14].map(n => WK.tagePlus(mo, n)).join(','), 'Wochen stehen neueste zuerst');
  WK.kp.art = 'woche'; WK.kp.id = '';
  WK.seiteZeichnen(true);
  let h = WK.document.getElementById('seite').innerHTML;
  pruefe(/Frühere Wochen · 2/.test(h), 'frühere Wochen bleiben im Archiv');
  pruefe(!/naechsteWocheAufsetzen\(\)/.test(h), 'gibt es die nächste Woche schon, wird sie nicht noch einmal angeboten');
  WK.leisteZeichnen();
  pruefe(/Nächste Woche/.test(WK.document.getElementById('leiste').innerHTML), 'eine aufgesetzte nächste Woche steht in der Seitenleiste');
  pruefe(WK.kpWochenTitel('2026-10-12') === 'KW 42 · 12.10. – 18.10.', 'der Titel nennt KW und Zeitraum');
}

/* ============================================================
   5. Projekte, Ziele, stille Listen — anlegen und pflegen ohne Workbench
   ============================================================ */
console.log('\n5. Anlegen und pflegen');
if (WK) {
  frisch();
  const p = WK.kpVorhabenAnlegen('projekt', '  Carport bauen  ', 'privat');
  pruefe(p && p.name === 'Carport bauen' && p.status === 'laufend' && p.kontext === 'privat' && p.flaeche === ''
         && Array.isArray(p.meilensteine) && Array.isArray(p.zielzustaende) && 'ende' in p,
         'ein Projekt hat dieselben Felder wie eins aus der Workbench');
  const z = WK.kpVorhabenAnlegen('ziel', 'Gewicht 73 kg', 'beruflich');
  pruefe(z && WK.DB.ziele.length === 1 && 'zieltermin' in z && Array.isArray(z.einzahler), 'Ziele lassen sich ebenso anlegen');
  pruefe(WK.kpVorhabenAnlegen('projekt', '   ', 'privat') === null && WK.kpVorhabenAnlegen('aufgabe', 'x', 'privat') === null,
         'ohne Namen oder mit falscher Art wird nichts angelegt');
  WK.kp.art = 'vorhaben'; WK.kp.id = p.id; WK.kp.va = 'projekt';
  WK.kpFeld('kontext', 'beruflich'); WK.kpFeld('termin', '2027-05-31'); WK.kpFeld('status', 'ruht');
  pruefe(p.kontext === 'beruflich' && p.ende === '2027-05-31' && p.status === 'ruht', 'Kontext, Termin und Status sind auf der Seite pflegbar');
  WK.kpFeld('termin', '31.05.2027'); WK.kpFeld('status', 'unsinn');
  pruefe(p.ende === '2027-05-31' && p.status === 'ruht', 'ein falsches Datum oder ein unbekannter Status wird abgewiesen');
  WK.kp.id = z.id; WK.kp.va = 'ziel'; WK.kpFeld('termin', '2027-06-30');
  pruefe(z.zieltermin === '2027-06-30', 'bei Zielen heißt der Termin Zieltermin');
  WK.kpTextSetzen('## Aktuelle Phase\nLäuft.');
  pruefe(z.flaeche === '## Aktuelle Phase\nLäuft.' && z.geaendert > 0, 'die Seite eines Vorhabens ist seine Gedankenfläche (flaeche)');
  WK.kpTitelSetzen('Gewicht 72 kg');
  pruefe(z.name === 'Gewicht 72 kg', 'der Name lässt sich umbenennen');
  WK.kpVorschlaegeAnlegen();
  pruefe(WK.kpListen().map(l => l.titel).join('|') === 'Haus & Werkstatt|Büro & Admin|Routinen' && WK.kpListen().every(l => l.kompass === 'liste'),
         'die drei vorgeschlagenen stillen Listen entstehen auf Knopfdruck, in Reihenfolge');
  pruefe(WK.kpListeAnlegen('') === null, 'eine Liste ohne Namen wird nicht angelegt');
  WK.kp.art = 'vorhaben'; WK.kp.id = p.id; WK.kp.va = 'projekt';
  WK.geruestEinfuegen();
  pruefe(/^## Aktuelle Phase/.test(p.flaeche) && /## Etappen\n1\. /.test(p.flaeche) && /## Kontakte & Angebote/.test(p.flaeche),
         'eine leere Projektseite bekommt auf Wunsch das Gerüst');
}

/* ============================================================
   6. Abschließen, Löschen, Rückgängig
   ============================================================ */
console.log('\n6. Abschließen und Löschen');
if (WK) {
  frisch();
  const p = WK.kpVorhabenAnlegen('projekt', 'Carport', 'privat');
  WK.DB.aufgaben.push({ id: 'a1', titel: 'Angebot', projektId: p.id, geaendert: 1 });
  WK.kp.art = 'vorhaben'; WK.kp.id = p.id; WK.kp.va = 'projekt';
  WK.kpAbschliessen();
  pruefe(p.status === 'abgeschlossen' && WK.kp.art === 'woche', 'Abschließen setzt den Status und führt zur Woche');
  WK.rueckgaengig();
  pruefe(p.status === 'laufend', 'Rückgängig holt den alten Status zurück');
  WK.kp.art = 'vorhaben'; WK.kp.id = p.id; WK.kp.va = 'projekt';
  WK.kpLoeschen();
  pruefe(WK.DB.projekte.length === 0 && WK.DB.grabsteine.some(g => g.s === 'projekte' && g.id === p.id), 'gelöscht bekommt das Projekt einen Löschvermerk');
  pruefe(WK.DB.aufgaben[0].projektId === null, 'Aufgaben verlieren nur ihre Zuordnung — wie in der Workbench');
  WK.rueckgaengig();
  pruefe(WK.DB.projekte.length === 1 && WK.DB.aufgaben[0].projektId === p.id && !WK.DB.grabsteine.some(g => g.id === p.id),
         'Rückgängig holt Projekt und Zuordnung zurück und nimmt den Löschvermerk weg');
  const mo = WK.kpHeuteMontag();
  WK.kpWocheAnlegen(mo); WK.kpWocheAnlegen(WK.tagePlus(mo, -7));
  WK.kp.art = 'woche'; WK.kp.id = '';
  WK.kpLoeschen();
  pruefe(WK.kpWochen().length === 2, 'die laufende Woche lässt sich nicht löschen');
  WK.kp.art = 'woche'; WK.kp.id = 'kw-' + WK.tagePlus(mo, -7);
  WK.kpLoeschen();
  pruefe(WK.kpWochen().length === 1 && WK.DB.grabsteine.some(g => g.s === 'gedanken'), 'eine frühere Woche lässt sich löschen');
}

/* ============================================================
   7. Schreiben: Leiste und Listen
   ============================================================ */
console.log('\n7. Schreiben');
if (WK) {
  frisch();
  const l = WK.kpListeAnlegen('Routinen');
  WK.kp.art = 'liste'; WK.kp.id = l.id;
  const f = WK.document.getElementById('kpFeld');
  const setze = function (text, von, bis) { f.value = text; f.selectionStart = von; f.selectionEnd = (bis === undefined ? von : bis); };
  setze('Tabletten\nMobilität', 0, 19); WK.zeilenArt('punkt');
  pruefe(f.value === '- Tabletten\n- Mobilität' && l.text === f.value, 'Aufzählung für die markierten Zeilen — und die Seite merkt es');
  setze(f.value, 0, f.value.length); WK.zeilenArt('punkt');
  pruefe(f.value === 'Tabletten\nMobilität', 'ein zweiter Tipp nimmt sie zurück');
  setze('Eins\nZwei\n\nDrei', 0, 15); WK.zeilenArt('nummer');
  pruefe(f.value === '1. Eins\n2. Zwei\n\n3. Drei', 'Nummern zählen fortlaufend, leere Zeilen bleiben leer');
  setze('- Geschenk besorgen', 5); WK.umschliessen('~~');
  pruefe(f.value === '- ~~Geschenk besorgen~~', 'Durchstreichen ohne Auswahl hakt die ganze Zeile ab');
  setze(f.value, 5); WK.umschliessen('~~');
  pruefe(f.value === '- Geschenk besorgen', 'ein zweiter Tipp hebt es wieder auf');
  setze('Budget freigeben', 0, 6); WK.umschliessen('**');
  pruefe(f.value === '**Budget** freigeben', 'Fett wirkt auf die Auswahl');
  setze('Konfigurator', 0, 12); WK.verweisEinfuegen();
  pruefe(f.value === '[Konfigurator](https://)' && f.selectionStart === 15 && f.selectionEnd === 23, 'ein Link entsteht mit markierter Adresse zum Überschreiben');
  const taste = function (text) {
    setze(text, text.length);
    let verhindert = false;
    WK.feldTaste({ key: 'Enter', shiftKey: false, target: f, preventDefault() { verhindert = true; } });
    return verhindert ? f.value : '(normal)';
  };
  pruefe(taste('- Tabletten') === '- Tabletten\n- ', 'Enter setzt eine Aufzählung fort');
  pruefe(taste('2. Zwei') === '2. Zwei\n3. ', 'und eine nummerierte Liste mit der nächsten Nummer');
  pruefe(taste('Text\n- ') === 'Text\n', 'ein leerer Punkt beendet die Liste');
  pruefe(taste('Fließtext') === '(normal)', 'außerhalb einer Liste bleibt Enter normal');
}

/* ============================================================
   8. Ansicht: Markdown wie auf der Gedankenfläche
   ============================================================ */
console.log('\n8. Ansicht');
if (WK) {
  const t = '# Woche 42\n\n## Was diese Woche Substanz schafft\n- [Beruf] Workshop\n- [Laufen]: 3× laufen\n- ~~Carport~~\n- Vierte Zeile\n\n'
          + '## Verbindlichkeiten\n- Freigabe (bis Fr)\n- \n\n### Anderes\n1. Eins\n1. Zwei\n[x] Erledigt aus der Workbench\n---\n'
          + '| A | B |\n|---|---|\n| 1 | 2 |\n[Link](https://example.org) und <script>alert(1)</script>';
  const h = WK.kpAnsichtHtml(t, true);
  pruefe(/<h1>Woche 42<\/h1>/.test(h) && /<h2>Was diese Woche Substanz schafft<span class="zaehler voll"[^>]*>4 von 3<\/span><\/h2>/.test(h),
         'Überschriften, und der Zähler warnt ab der vierten Zeile');
  pruefe(/<span class="zaehler"[^>]*>1 von 3<\/span>/.test(h), 'ein leerer Punkt zählt nicht mit');
  pruefe(/<span class="kontext">Beruf<\/span>Workshop/.test(h) && /<span class="kontext">Laufen<\/span>3× laufen/.test(h), '[Beruf] wird zur Marke');
  pruefe(/<del>Carport<\/del>/.test(h) && /<del>Erledigt aus der Workbench<\/del>/.test(h), 'Durchgestrichenes und abgehakte Kästchen aus der Workbench erscheinen durchgestrichen');
  pruefe(/<span class="frist">bis Fr<\/span>/.test(h), 'Fristen in Klammern werden hervorgehoben');
  pruefe(/<span class="nr">1\.<\/span><span class="t">Eins/.test(h) && /<span class="nr">2\.<\/span><span class="t">Zwei/.test(h), 'Nummern zählen fortlaufend');
  pruefe(/<table>/.test(h) && /<th>A<\/th>/.test(h) && /<td>2<\/td>/.test(h) && !/---/.test(h.replace(/<hr>/g, '')), 'Tabellen aus der Workbench werden als Tabelle gezeigt');
  pruefe(/<a href="https:\/\/example\.org" target="_blank" rel="noopener">Link<\/a>/.test(h), 'Links öffnen sich in einem neuen Fenster');
  pruefe(!/<script>/.test(h) && /&lt;script&gt;/.test(h), 'eingegebenes HTML wird nicht ausgeführt');
  pruefe(!/zaehler/.test(WK.kpAnsichtHtml('## Abschnitt\n- a', false)), 'Zähler gibt es nur auf Wochenseiten');
}

/* ============================================================
   9. Zusammen mit der Workbench über workbench.json
   Grund: Beide Apps lesen und schreiben dieselbe Datei. Was die eine
   anlegt, muss in der anderen ankommen — ohne dass etwas verloren geht.
   ============================================================ */
console.log('\n9. Zusammen mit der Workbench');
if (!WK) {
  warn('Wochenkompass nicht ausgewertet');
} else if (!WB_SKRIPT) {
  warn('workbench.html nicht gefunden — Zusammenspiel übersprungen');
} else {
  const WB = ladeIn(WB_SKRIPT, 'workbench.html');
  if (WB) {
    frisch();
    WB.DB = WB.leereDatenbank();
    WB.DB.aufgaben.push({ id: 'wb1', titel: 'Firmen anschreiben', kontext: 'privat', status: 'offen', planung: 'backlog', art: 'haupt', geaendert: 5 });
    WB.DB.projekte.push({ id: 'p-carport', name: 'Carport', kontext: 'privat', status: 'laufend', zielzustaende: [], flaeche: 'aus der Workbench', geaendert: 5 });
    WB.DB.aufgaben[0].projektId = 'p-carport';

    /* Workbench → Wochenkompass */
    const ausWb = WB.alsText();
    const fremd1 = WK.textZuBestand(ausWb);
    WK.DB = WK.zusammenfuehren(WK.DB, fremd1).db;
    const pc = WK.kpVorhabenFinden('p-carport', 'projekt');
    pruefe(pc && pc.flaeche === 'aus der Workbench', 'Gedanken eines Vorhabens aus der Workbench erscheinen als Projektseite');
    pruefe(WK.DB.aufgaben.length === 1 && WK.DB.aufgaben[0].titel === 'Firmen anschreiben', 'Aufgaben gehen unverändert durch den Wochenkompass');

    /* Wochenkompass legt an und ändert */
    const mo = WK.kpHeuteMontag();
    const woche = WK.kpWocheAnlegen(mo);
    woche.text += '\n- [Beruf] Workshop'; woche.geaendert = Date.now() + 1000;
    const liste = WK.kpListeAnlegen('Haus & Werkstatt');
    const neu = WK.kpVorhabenAnlegen('ziel', 'Halbmarathon', 'privat');
    pc.flaeche = '## Aktuelle Phase\nAngebote vergleichen'; pc.status = 'ruht'; pc.geaendert = Date.now() + 1000;

    /* Wochenkompass → Workbench */
    const fremd2 = WB.textZuBestand(WK.alsText());
    const erg = WB.zusammenfuehren(WB.DB, fremd2);
    WB.DB = erg.db;
    const wbWoche = WB.DB.gedanken.find(g => g.id === 'kw-' + mo);
    pruefe(wbWoche && wbWoche.kompass === 'woche' && wbWoche.woche === mo && /Workshop/.test(wbWoche.text),
           'die Wochenseite kommt in der Workbench an — mit ihren Kennzeichen');
    const wbListe = WB.DB.gedanken.find(g => g.id === liste.id);
    pruefe(wbListe && wbListe.kompass === 'liste' && wbListe.titel === 'Haus & Werkstatt', 'die stille Liste ebenso');
    pruefe(WB.DB.ziele.some(z => z.id === neu.id && z.name === 'Halbmarathon'), 'ein im Wochenkompass angelegtes Ziel steht in der Workbench');
    const wbP = WB.DB.projekte.find(p => p.id === 'p-carport');
    pruefe(wbP && /Angebote vergleichen/.test(wbP.flaeche) && wbP.status === 'ruht', 'Projektseite und Status kommen in der Workbench an');
    pruefe(WB.DB.aufgaben.length === 1 && WB.DB.aufgaben[0].projektId === 'p-carport', 'die Aufgaben der Workbench bleiben unberührt');
    pruefe(typeof WB.flaecheText === 'function' && WB.flaecheText('p-carport') === wbP.flaeche, 'die Workbench zeigt die Seite als Gedanken des Vorhabens');

    /* Löschen im Wochenkompass kommt in der Workbench an */
    WK.kp.art = 'liste'; WK.kp.id = liste.id;
    WK.kpLoeschen();
    WB.DB = WB.zusammenfuehren(WB.DB, WB.textZuBestand(WK.alsText())).db;
    pruefe(!WB.DB.gedanken.some(g => g.id === liste.id), 'eine im Wochenkompass gelöschte Liste verschwindet auch in der Workbench');

    /* Dieselbe Woche auf zwei Geräten: keine Doppelten */
    const geraet2 = WK.leereDatenbank();
    geraet2.gedanken.push({ id: 'kw-' + mo, titel: 'x', text: 'Gerät 2', kompass: 'woche', woche: mo, geaendert: Date.now() + 5000 });
    const zwei = WK.zusammenfuehren(WK.DB, geraet2).db;
    pruefe(zwei.gedanken.filter(g => g.kompass === 'woche' && g.woche === mo).length === 1, 'dieselbe Woche auf zwei Geräten ergibt eine Seite, der jüngere Stand gewinnt');

    /* Leere Datei: der Wochenkompass legt den Bestand allein an */
    const allein = WK.textZuBestand(JSON.stringify(WK.leereDatenbank()));
    pruefe(allein && Array.isArray(allein.gedanken) && Array.isArray(allein.projekte) && Array.isArray(allein.aufgaben),
           'ohne Workbench entsteht ein vollständiger Bestand, den die Workbench später lesen kann');
  }
}

/* ============================================================
   10. Installation: Service Worker und Manifest
   Grund: Liegen beide Apps nebeneinander, darf der Wochenkompass den
   Service Worker und den Vorrat der Workbench nicht ersetzen.
   ============================================================ */
console.log('\n10. Service Worker und Manifest');
{
  pruefe(/register\('\.\/sw-wochenkompass\.js', \{ scope: '\.\/wochenkompass' \}\)/.test(SKRIPT),
         'eigener Service Worker mit eigenem Bereich ./wochenkompass');
  if (!SW_QUELLE) {
    fail('sw-wochenkompass.js liegt nicht neben der App');
  } else {
    try { new vm.Script(SW_QUELLE); ok('sw-wochenkompass.js ist syntaktisch korrekt'); }
    catch (e) { fail('Syntaxfehler im Service Worker: ' + e.message); }
    pruefe(/var PRAEFIX = 'wochenkompass-';/.test(SW_QUELLE) && /n\.indexOf\(PRAEFIX\) !== 0 \|\| n === VORRAT/.test(SW_QUELLE),
           'aufgeräumt werden nur eigene Vorräte — der der Workbench bleibt');
    pruefe(/adresse\.origin !== self\.location\.origin/.test(SW_QUELLE), 'Google-Anmeldung und Drive gehen nie durch den Vorrat');
  }
  if (!fs.existsSync(MANIFEST_PFAD)) {
    fail('wochenkompass.webmanifest liegt nicht neben der App');
  } else {
    let m = null;
    try { m = JSON.parse(fs.readFileSync(MANIFEST_PFAD, 'utf8')); ok('das Manifest ist gültiges JSON'); }
    catch (e) { fail('Manifest ungültig: ' + e.message); }
    if (m) {
      pruefe(m.id === './wochenkompass.html' && m.scope === './wochenkompass' && m.start_url === './wochenkompass.html',
             'eigene Kennung und eigener Bereich — am Handy eine eigene App neben der Workbench');
      const fehlend = (m.icons || []).filter(i => !fs.existsSync(path.join(ORDNER, i.src)));
      pruefe((m.icons || []).length >= 3 && fehlend.length === 0, 'alle Symbole liegen neben der App');
    }
  }
}

/* ============================================================
   11. Schmale Bildschirme: kein Überlauf durch Rasterspalten
   Eine Rasterspalte ohne minmax(0, …) wächst auf die Mindestbreite
   ihres Inhalts (Kopfzeile) — am Pixel wurde die Seite so 498 px breit.
   ============================================================ */
console.log('\n11. Schmale Bildschirme');
{
  const css = (QUELLE.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
  const regeln = css.match(/[^{}]+\{[^{}]*display\s*:\s*grid[^{}]*\}/g) || [];
  pruefe(regeln.length > 0, 'Rasterregeln gefunden');
  regeln.forEach(function (r) {
    const sel = r.split('{')[0].trim();
    const spalten = (r.match(/grid-template-columns\s*:\s*([^;}]+)/) || [])[1];
    if (!spalten) { fail(sel + ': Raster ohne grid-template-columns — die Spalte wächst mit dem Inhalt'); return; }
    if (/(^|\s)1fr/.test(spalten) || /\bauto\b/.test(spalten)) { fail(sel + ': Spalte „' + spalten.trim() + '" ohne minmax(0, …)'); }
    else { ok(sel + ': Spalten schrumpfen mit (' + spalten.trim() + ')'); }
  });
  const breit = css.match(/body\.breit\s+[^{]+\{[^}]*grid-template-columns\s*:\s*([^;}]+)/g) || [];
  breit.forEach(function (r) {
    const sp = r.split('grid-template-columns')[1];
    pruefe(!/(^|[\s:])1fr/.test(sp), 'auch breit: ' + r.split('{')[0].trim() + ' mit minmax(0, …)');
  });
  const stand = (css.match(/\.stand\{[^}]*\}/) || [''])[0];
  pruefe(/min-width\s*:\s*0/.test(stand), 'die Standpille darf in der Kopfzeile schrumpfen');
  const marke = (css.match(/\.marke\{[^}]*\}/) || [''])[0];
  pruefe(/min-width\s*:\s*0/.test(marke), 'die Marke darf in der Kopfzeile schrumpfen');
}

/* ============================================================
   ERGEBNIS
   ============================================================ */
console.log('\nERGEBNIS   ok: ' + anzOk + '   FAIL: ' + anzFail + '   warn: ' + anzWarn);
process.exitCode = anzFail ? 1 : 0;
