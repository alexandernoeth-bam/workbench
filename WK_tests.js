/* ============================================================
   WK_tests.js — Regressionstests für den Wochenkompass
   Aufruf:  node WK_tests.js [wochenkompass.html] [workbench.html]

   Mit dem zweiten Pfad wird zusätzlich geprüft, dass Unterbau und
   Aktivitäten-Kern wörtlich der Workbench entsprechen. Ohne ihn wird
   das als „warn“ übersprungen. Seit 3.0 arbeiten beide Apps auf
   derselben workbench.json.
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
  pruefe(version && Number(version.split('.')[0]) >= 3, 'Hauptversion 3 — dieselben Daten wie die Workbench');
  pruefe(!/@media/.test(QUELLE), 'keine @media-Regeln — Breite über body.breit');
  pruefe(/body\.breit \.leiste\{position:static/.test(QUELLE), 'am großen Bildschirm steht die Seitenleiste fest, am Handy ist sie eine Schublade');
  const fns = [...SKRIPT.matchAll(/\nfunction (\w+)\s*\(/g)].map(m => m[1]);
  const doppelt = [...new Set(fns.filter((f, i) => fns.indexOf(f) !== i))];
  pruefe(doppelt.length === 0, 'keine doppelt definierten Funktionen' + (doppelt.length ? ' — gefunden: ' + doppelt.join(', ') : ''));

  const code = SKRIPT.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const definiert = new Set(fns);
  const aufrufe = new Set([...code.matchAll(/on(?:click|input|change|keydown|mousedown|beforeinput|dragstart|dragover|dragleave|drop|dragend)=\\?["'](?:[^"']*?;)?\s*([A-Za-z_]\w*)\(/g)].map(m => m[1])
    .concat([...QUELLE.replace(/<script>[\s\S]*?<\/script>/g, '').matchAll(/on(?:click|input|change|keydown|mousedown)="([A-Za-z_]\w*)\(/g)].map(m => m[1])));
  const fremd = [...aufrufe].filter(a => !definiert.has(a) && ['event', 'if'].indexOf(a) < 0);
  pruefe(fremd.length === 0, 'Bedienelemente rufen nur Funktionen, die es gibt' + (fremd.length ? ' — fehlt: ' + fremd.join(', ') : ''));
  pruefe(!/onclick="[^"]*\bif\s*\(/.test(code), 'keine Bedingungen in onclick-Attributen');
}

/* ============================================================
   2. Werkzeugleiste — dieselbe wie auf der Fläche der Workbench
   ============================================================ */
console.log('\n2. Werkzeugleiste wie in der Workbench');
const WK = ladeIn(SKRIPT, 'wochenkompass.html');
if (WK) { ok('der Wochenkompass lässt sich außerhalb des Browsers auswerten'); }

function frisch() {
  WK.DB = WK.leereDatenbank();
  WK.kp.art = 'woche'; WK.kp.id = ''; WK.kp.frage = ''; WK.kp.modus = 'ansicht'; WK.kp.hervor = '';
  WK.kp.zielWoche = 'diese'; WK.kp.neuIn = '';
  WK.DB.einstellungen.aktivitaetenUmgestellt = '2026-10-16 12:00:00';
  WK.zurueckHolen = null;
}
function seiteHtml() { return WK.document.getElementById('seite').innerHTML; }
/* Seit 3.0 legt kpSeiteAnlegen (aus der Workbench) mit Beruf/Privat an,
   nicht mit Text — der kommt danach. */
function neueSeite(art, name, text) {
  const s = WK.kpSeiteAnlegen(art, name, WK.kp.filter);
  if (s && text) { s.text = text; }
  return s;
}
function wochenKennung() { return WK.kpWocheKennung(WK.kpOffenerMontag()); }
function feld(text, a, b) {
  const f = WK.document.getElementById('kpFeld');
  f.value = text; f.selectionStart = a; f.selectionEnd = (b === undefined) ? a : b;
  return f;
}

if (WK) {
  const l = WK.kpLeisteHtml();
  pruefe(/kpZeichen\('kasten'\)/.test(l), 'das Kästchen ist da — es macht eine Zeile zur Aufgabe');
  pruefe(/kpZeichen\('datum'\)/.test(l), 'Datum einfügen ist da');
  pruefe(['h1', 'h2', 'h3', 'punkt', 'einzug', 'ausrueck', 'trenner'].every(a => l.indexOf("kpZeichen('" + a + "')") >= 0)
         && /kpNummerieren\(\)/.test(l) && /kpTabelle\(\)/.test(l), 'Überschriften, Aufzählung, Nummern, Einzug, Tabelle, Trennlinie');
  pruefe(['*', '_', '~', '+', '^'].every(z => l.indexOf("kpUmschliessen('" + z + "')") >= 0), 'Fett, Kursiv, Durch, Unter, Kapitälchen — wie in der Workbench');
  pruefe((l.match(/onmousedown="event\.preventDefault\(\)"/g) || []).length === (l.match(/class="fl-knopf"/g) || []).length,
         'kein Knopf nimmt dem Schreibfeld die Auswahl weg');
  pruefe(!/>\?<\/text>/.test(l), 'jedes Sinnbild ist bekannt — kein Fragezeichen-Knopf');
}

/* ============================================================
   3. Unterbau: wörtlich aus der Workbench — dieselbe Datei
   Grund: Seit 3.0 arbeiten Workbench und Wochenkompass auf der
   workbench.json. Jede Abweichung im Unterbau oder im Kern (kp…)
   würde Daten der anderen App verderben.
   ============================================================ */
console.log('\n3. Unterbau und gemeinsame Datei');
{
  const WOERTLICH = ['zusammenfuehren', 'alsText', 'uebernehmen', 'speichern', 'laden', 'leereDatenbank',
    'grabsteinSetzen', 'grabsteinZeit', 'grabsteineAufraeumen', 'textZuBestand', 'abgleichen', 'abgleichPlanen',
    'driveSuchen', 'driveAnlegen', 'driveHochladen', 'driveHerunterladen', 'antwortPruefen',
    'tokenMerken', 'tokenGueltig', 'klientVorbereiten', 'anmelden', 'anmeldeVersuch', 'abmelden',
    'erneuerungPlanen', 'erneuerungPruefen', 'dateiWaehlen', 'dateiAnlegen', 'opfsSchreiben', 'opfsLesen',
    'montagVon', 'kalenderwoche', 'neueKennung', 'esc',
    'feldErsetzen', 'wortUmDieMarke', 'flaecheSinnbild', 'tabellenZellen', 'listenNummern', 'langDatum'];
  /* Der Kern steht als eigener Abschnitt im Unterbau; die Anschlüsse
     (kpBzUm, kpTextSetzen …) gehören jeder App selbst. */
  const kernStart = SKRIPT.indexOf('/* ---------- Aktivitäten-Kern der Workbench ---------- */');
  const kernEnde = SKRIPT.indexOf('Wochenkompass 3 — eigener Teil');
  const KERN = (kernStart >= 0 && kernEnde > kernStart)
    ? [...SKRIPT.slice(kernStart, kernEnde).matchAll(/\nfunction (kp\w+)\s*\(/g)].map(m => m[1]) : [];
  if (!WB_SKRIPT) {
    warn('workbench.html nicht neben dem Wochenkompass — Vergleich übersprungen');
  } else {
    const abweichend = WOERTLICH.filter(n => funktionText(SKRIPT, n) === null || funktionText(SKRIPT, n) !== funktionText(WB_SKRIPT, n));
    pruefe(abweichend.length === 0, WOERTLICH.length + ' Funktionen stimmen wörtlich mit der Workbench überein'
           + (abweichend.length ? ' — abweichend: ' + abweichend.join(', ') : ''));
    const kernAnders = KERN.filter(n => funktionText(SKRIPT, n) !== funktionText(WB_SKRIPT, n));
    pruefe(KERN.length >= 60 && kernAnders.length === 0, KERN.length + ' Kernfunktionen (kp…) stimmen wörtlich mit der Workbench überein'
           + (kernAnders.length ? ' — abweichend: ' + kernAnders.join(', ') : ''));
    const wertW = (s, n) => (s.match(new RegExp("var " + n + "\\s*=\\s*'([^']*)';")) || [])[1];
    pruefe(wertW(SKRIPT, 'CLIENT_ID') === wertW(WB_SKRIPT, 'CLIENT_ID'), 'dieselbe Google-Anwendung — nur so ist die workbench.json sichtbar');
    pruefe(wertW(SKRIPT, 'DRIVE_DATEI') === wertW(WB_SKRIPT, 'DRIVE_DATEI'), 'dieselbe Datei in Drive wie die Workbench');
    const sa = s => (s.match(/var SAMMLUNGEN = \[[\s\S]*?\];/) || [''])[0];
    pruefe(sa(SKRIPT) !== '' && sa(SKRIPT) === sa(WB_SKRIPT), 'dieselben Sammlungen wie die Workbench — beim Abgleich geht nichts verloren');
    ['KP_ARTEN', 'KP_ABSCHNITTE', 'KP_KASTEN', 'KP_VERWEIS', 'KP_ZUSTAENDE'].forEach(function (n) {
      const v = s => (s.match(new RegExp('\\nvar ' + n + '\\b[\\s\\S]*?;\\n')) || [''])[0];
      pruefe(v(SKRIPT) !== '' && v(SKRIPT) === v(WB_SKRIPT), n + ' gleicht der Workbench');
    });
  }
  const wert = n => (SKRIPT.match(new RegExp("var " + n + "\\s*=\\s*'([^']*)';")) || [])[1];
  pruefe(wert('DRIVE_DATEI') === 'workbench.json' && wert('DATEINAME') === 'workbench.json', 'Datei ist die workbench.json');
  pruefe(['wochenkompass-speicher', 'kompass-speicher', 'workbench-speicher'].indexOf(wert('IDB_NAME')) < 0
         && ['wochenkompass-daten', 'kompass-daten', 'workbench-daten'].indexOf(wert('LS_KEY')) < 0
         && ['wochenkompass.json', 'kompass.json', 'workbench.json'].indexOf(wert('OPFS_NAME')) < 0,
         'eigener Gerätespeicher — kein alter Dateigriff auf kompass.json, kein Zugriff auf den Speicher der Workbench');
  pruefe(wert('SCOPES') === 'https://www.googleapis.com/auth/drive.file', 'nur das Recht drive.file');
  if (WK) {
    const db = WK.leereDatenbank();
    pruefe(Array.isArray(db.projekte) && Array.isArray(db.themen) && Array.isArray(db.gedanken) && Array.isArray(db.aufgaben)
           && Array.isArray(db.wochen) && Array.isArray(db.tage) && !db.seiten, 'ein leerer Bestand hat die Sammlungen der Workbench');
    /* Fehlerart: Die Kalenderzuordnung ist ein Verzeichnis. Würde sie
       zur Liste, verlöre die Workbench ihre Zuordnungen. */
    const b = WK.leereDatenbank();
    b.kalenderzuordnung = { 'abc': 'urlaub' };
    WK.bestandStempeln(b);
    pruefe(!Array.isArray(b.kalenderzuordnung) && b.kalenderzuordnung.abc && b.kalenderzuordnung.abc.art === 'urlaub',
           'die Kalenderzuordnung bleibt ein Verzeichnis');
    const r = WK.zusammenfuehren({ projekte: [{ id: 'a', name: 'alt', geaendert: 1 }], aufgaben: [{ id: 'r', titel: 'Routine', geaendert: 5 }], grabsteine: [] },
                                 { projekte: [{ id: 'a', name: 'neu', geaendert: 2 }], notizbuecher: [{ id: 'n', geaendert: 1 }], grabsteine: [] });
    pruefe(r.db.projekte[0].name === 'neu' && r.db.aufgaben.length === 1 && r.db.notizbuecher.length === 1,
           'der Abgleich führt alles zusammen — auch, was nur die Workbench zeigt');
  }
}

/* ============================================================
   4. Seiten: Liste, Vorhaben, Notiz — eine Art Seite
   ============================================================ */
console.log('\n4. Seiten');
if (WK) {
  frisch();
  const v = neueSeite('vorhaben', 'Umzug Büro', '');
  const l = neueSeite('liste', 'Büro', '');
  const n = neueSeite('notiz', 'Ideen', '');
  pruefe(v && l && n && WK.kpSeitenAlle().length === 3, 'alle drei Arten lassen sich anlegen');
  pruefe(v.zustand === 'laeuft' && l.zustand === undefined && n.zustand === undefined, 'nur das Vorhaben hat einen Zustand');
  pruefe(WK.kpSeiteAnlegen('termin', 'x', '') === null && neueSeite('liste', '  ', '') === null, 'unbekannte Art und leerer Name werden abgewiesen');
  pruefe(l.rang > v.rang && n.rang > l.rang, 'neue Seiten stehen hinten');
  v.text = 'Wir ziehen um.\nDas wird [] kein Kästchen.\n[] Firma anfragen\n  [ ] Angebote vergleichen\n[x] Adresse melden\n- [] Punkt mit Klammern\n[]   ';
  pruefe(WK.kpOffeneZahl(v) === 2, 'offene Aufgaben: nur Zeilen, die mit [] oder [ ] beginnen — Fließtext zählt nicht, [x] nicht, leeres Kästchen nicht');
  pruefe(WK.kpAufgabe('[] Firma  anfragen ').text === 'Firma anfragen' && WK.kpAufgabe('[X] a').erledigt === true && WK.kpAufgabe('Text') === null,
         'eine Aufgabenzeile wird gelesen: Text ohne doppelten Leerraum, [x] und [X] sind erledigt');
  WK.kp.art = 'seite'; WK.kp.id = v.id;
  WK.kpZustand('ruht');
  pruefe(v.zustand === 'ruht', 'der Zustand eines Vorhabens lässt sich setzen');
  WK.kpZustand('quatsch');
  pruefe(v.zustand === 'ruht', 'ein unbekannter Zustand wird abgewiesen');
  WK.kp.id = l.id; WK.kpZustand('erledigt');
  pruefe(l.zustand === undefined, 'eine Liste bekommt keinen Zustand');
  WK.leisteZeichnen();
  const le = WK.document.getElementById('leiste').innerHTML;
  pruefe(/Vorhaben/.test(le) && /Listen/.test(le) && /Notizen/.test(le) && /Ruht/.test(le), 'die Seitenleiste hat Vorhaben (mit „Ruht“), Listen und Notizen');
  pruefe(!/class="zahl"/.test(le), 'die Seitenleiste zählt keine offenen Aufgaben');
  WK.kp.art = 'seite'; WK.kp.id = v.id; WK.kp.modus = 'ansicht';
  WK.seiteZeichnen(true);
  let h = seiteHtml();
  pruefe(/kpZustand\('laeuft'\)/.test(h) && /kpZustand\('ruht'\)/.test(h) && /kpZustand\('erledigt'\)/.test(h), 'die Vorhaben-Seite zeigt läuft · ruht · erledigt');
  WK.kp.id = l.id; WK.seiteZeichnen(true);
  pruefe(!/kpZustand\(/.test(seiteHtml()), 'eine Liste zeigt keinen Zustand');
}

/* ============================================================
   5. Planen auf der Seite: S und V
   ============================================================ */
console.log('\n5. Planen mit S und V');
if (WK) {
  frisch();
  const s = neueSeite('liste', 'Büro', 'Einleitung\n[] Reisekosten einreichen\n[] Steuerberater anrufen\n[x] Erledigtes');
  WK.kp.art = 'seite'; WK.kp.id = s.id; WK.kp.modus = 'ansicht'; WK.kp.oaAuf = false;
  WK.seiteZeichnen(true);
  let h = seiteHtml();
  pruefe(!/kpEinplanen\(/.test(h) && !/class="drin"/.test(h), 'der Text bleibt ruhig: kein S/V und keine Marke in den Zeilen');
  pruefe(/onclick="kpOaUm\(\)"/.test(h) && /Offene Aufgaben<\/button>/.test(h), 'über dem Text der Knopf „Offene Aufgaben“ — ohne Zahl');
  WK.kpOaUm();
  h = seiteHtml();
  pruefe(/class="oa-fenster" role="dialog"/.test(h), 'der Knopf öffnet das Fenster');
  pruefe((h.match(/kpEinplanen\(\d+,'s'\)/g) || []).length === 2 && (h.match(/kpEinplanen\(\d+,'v'\)/g) || []).length === 2,
         'im Fenster hat jede offene Aufgabe S und V — erledigte und Fließtext stehen nicht drin');
  pruefe(/kpEinplanen\(1,'s'\)/.test(h), 'S und V tragen die Zeilennummer der Aufgabe');
  WK.kpEinplanen(1, 's');
  const mo = WK.kpHeuteMontag();
  const w = WK.kpWocheFinden(mo);
  pruefe(w && w.eintraege.length === 1 && w.eintraege[0].abschnitt === 's' && w.eintraege[0].text === 'Reisekosten einreichen'
         && w.eintraege[0].quelle === s.id, 'S gibt die Aufgabe als Substanz in die laufende Woche — mit Text und Quelle');
  WK.kpEinplanen(1, 'v');
  pruefe(w.eintraege.length === 1, 'dieselbe Aufgabe kommt nicht zweimal in die Woche');
  h = seiteHtml();
  pruefe(WK.kp.oaAuf === true && /oa-fenster/.test(h), 'nach S bleibt das Fenster offen — man plant weiter');
  pruefe(new RegExp('class="drin"[^>]*>KW ' + WK.kalenderwoche(mo) + ' · S ×<').test(h), 'im Fenster steht danach „KW nn · S ×“');
  pruefe((h.match(/kpEinplanen\(\d+,'s'\)/g) || []).length === 1, 'die eingeplante Aufgabe hat kein S und V mehr');
  pruefe(/kpZielWocheSetzen\('naechste'\)/.test(h) && /kpOaSprung\(1\)/.test(h), 'im Fenster: Wahl der Woche und ↘ zur Zeile');
  WK.kpAusplanen(WK.kpWocheKennung(mo), w.eintraege[0].id);
  pruefe(w.eintraege.length === 0 && /\[\] Reisekosten/.test(s.text), 'ein Tipp auf die Marke nimmt sie aus der Woche — die Zeile in der Quelle bleibt');
  WK.kp.art = 'seite'; WK.kp.id = s.id;
  WK.kpZielWocheSetzen('naechste');
  WK.kpEinplanen(2, 'v');
  const wn = WK.kpWocheFinden(WK.tagePlus(mo, 7));
  pruefe(wn && wn.eintraege.length === 1 && wn.eintraege[0].abschnitt === 'v', 'mit „KW nächste“ wird in die nächste Woche geplant');
  pruefe(WK.kpEintragFinden(s.id, 'Steuerberater anrufen') !== null, 'auch die nächste Woche zählt für die Marke');
  WK.kpEinplanen(0, 's');
  WK.kpEinplanen(3, 's');
  pruefe(wn.eintraege.length === 1 && (WK.kpWocheFinden(mo) || { eintraege: [] }).eintraege.length === 0, 'Fließtext und erledigte Zeilen lassen sich nicht einplanen');
  WK.kp.zielWoche = 'quatsch'; WK.kpZielWocheSetzen('quatsch');
  pruefe(WK.kpZielMontag() === mo, 'eine unbekannte Zielwoche fällt auf die laufende zurück');
}

/* ============================================================
   6. Die Woche als Notiz
   Grund: Die Woche ist frei beschreibbar. Eingeplante Aufgaben sind
   Zeilen unter „Bringt mich substanziell weiter“ und „Verbindlichkeiten“;
   ein Klick streicht durch und hakt in der Quelle ab, ↗ springt dorthin.
   ============================================================ */
console.log('\n6. Woche als Notiz');
if (WK) {
  frisch();
  const s = neueSeite('vorhaben', 'Umzug', 'Notiz\n[] Firma anfragen\n[] Lager kündigen');
  WK.kp.art = 'seite'; WK.kp.id = s.id;
  WK.kpEinplanen(1, 's');
  WK.kpEinplanen(2, 'v');
  const mo = WK.kpHeuteMontag();
  const w = WK.kpWocheFinden(mo);
  pruefe(w.text === '## Bringt mich substanziell weiter\n[] Firma anfragen\n\n## Verbindlichkeiten\n[] Lager kündigen\n',
         'S und V hängen die Aufgabe als Zeile unter die passende Überschrift');
  WK.kp.art = 'woche'; WK.kp.id = ''; WK.kp.modus = 'ansicht';
  WK.seiteZeichnen(true);
  let h = seiteHtml();
  pruefe(/>Bringt mich substanziell weiter</.test(h) && />Verbindlichkeiten</.test(h) && !/>Substanz</.test(h), 'die Überschrift heißt „Bringt mich substanziell weiter“');
  pruefe(!/tkasten/.test(h) && !/<textarea/.test(h) && /modusSetzen\('schreiben'\)/.test(h), 'in der Ansicht keine Kästchen und kein Feld — aber „Schreiben“');
  pruefe((h.match(/kpBzSprung\(/g) || []).length === 2 && /title="Zu „Umzug“"/.test(h), 'hinter eingeplanten Aufgaben ein ↗ zur Quelle');
  WK.kpBzUm(wochenKennung(), 1);
  pruefe(/\[x\] Firma anfragen/.test(s.text) && /\[x\] Firma anfragen/.test(w.text), 'ein Klick streicht durch — und hakt die Zeile in der Quelle ab');
  WK.seiteZeichnen(true);
  pruefe(/class="wz erl"/.test(seiteHtml()), 'die Zeile steht in der Woche durchgestrichen');
  WK.kpBzUm(wochenKennung(), 1);
  pruefe(/\[\] Firma anfragen/.test(s.text) && /\[\] Firma anfragen/.test(w.text), 'ein zweiter Klick nimmt beides zurück');

  WK.modusSetzen('schreiben');
  h = seiteHtml();
  pruefe(/<textarea id="kpFeld"/.test(h) && /fl-leiste/.test(h), 'im Schreiben-Modus Feld und Werkzeugleiste wie bei Notizen');
  WK.kpTextSetzen('Messe am Mittwoch.\n\n' + w.text.replace('[] Lager kündigen', '[] Lager kündigen\nFreitag: Reisekosten\n[] Reifen wechseln'));
  WK.modusSetzen('ansicht');
  h = seiteHtml();
  pruefe(/Messe am Mittwoch/.test(h) && /Freitag: Reisekosten/.test(h), 'frei Geschriebenes steht in der Woche — auch zwischen den Aufgaben');
  pruefe(/kpBzUm\('kw-[\d-]+',\d+\)[^>]*>Reifen wechseln/.test(h) && (h.match(/kpBzSprung\(/g) || []).length === 2,
         'eine selbst geschriebene Aufgabe lässt sich durchstreichen — ohne ↗');
  const zeilen = w.text.split('\n');
  const nrR = zeilen.indexOf('[] Reifen wechseln');
  WK.kpBzUm(wochenKennung(), nrR);
  pruefe(w.text.indexOf('[x] Reifen wechseln') >= 0, 'und wird durchgestrichen');

  WK.kpBzSprung(wochenKennung(), w.text.split('\n').indexOf('[] Firma anfragen'));
  pruefe(WK.kp.art === 'seite' && WK.kp.id === s.id && WK.kp.hervor === 'Firma anfragen', '↗ öffnet die Quelle');
  pruefe((seiteHtml().match(/id="kpHervor"/g) || []).length === 1, 'die Zeile ist dort hervorgehoben');

  s.text = 'Notiz\n[] Firma anrufen\n[] Lager kündigen';
  WK.kp.art = 'woche'; WK.kp.id = '';
  WK.kpBzUm(wochenKennung(), w.text.split('\n').indexOf('[] Firma anfragen'));
  pruefe(w.text.indexOf('[x] Firma anfragen') >= 0 && s.text.indexOf('[x]') < 0, 'umformuliert: Durchstreichen wirkt nur in der Woche, die Quelle bleibt');
  WK.DB.projekte = []; WK.DB.ziele = []; WK.DB.themen = []; WK.DB.gedanken = [];
  WK.seiteZeichnen(true);
  pruefe(!/kpBzSprung\(/.test(seiteHtml()) && /Lager kündigen/.test(seiteHtml()), 'ohne Quelle bleibt die Aufgabe stehen — ohne ↗');

  frisch();
  const q = neueSeite('liste', 'L', '[] eins');
  WK.kp.art = 'seite'; WK.kp.id = q.id;
  WK.kpEinplanen(0, 'v');
  const w2 = WK.kpWocheFinden(mo);
  w2.text = w2.text.replace('[] eins\n', '');
  pruefe(WK.kpEintragFinden(q.id, 'eins') === null, 'in der Woche gelöscht: die Marke an der Quelle verschwindet');
  WK.kp.art = 'seite'; WK.kp.id = q.id;
  WK.kpEinplanen(0, 's');
  pruefe(w2.eintraege.length === 1 && /## Bringt mich substanziell weiter\n\[\] eins/.test(w2.text), 'und sie lässt sich neu einplanen — ohne verwaisten Eintrag');
  WK.kpAusplanen(WK.kpWocheKennung(mo), w2.eintraege[0].id);
  pruefe(w2.eintraege.length === 0 && w2.text.indexOf('eins') < 0 && q.text === '[] eins', '„KW · S ×“ nimmt die Zeile aus der Woche, die Quelle bleibt');
  w2.text = 'Eigenes\n## Ohne Abschnitte';
  WK.kp.art = 'seite'; WK.kp.id = q.id;
  WK.kpEinplanen(0, 'v');
  pruefe(/## Ohne Abschnitte\n\n## Verbindlichkeiten\n\[\] eins$/.test(w2.text), 'fehlt die Überschrift, wird sie angelegt');
  w2.text = '## Mein substanzielles Zeug\nx\n\n## Termine';
  w2.eintraege = [];
  WK.kpEinplanen(0, 's');
  pruefe(w2.text === '## Mein substanzielles Zeug\nx\n[] eins\n\n## Termine', 'eine umbenannte Überschrift wird an „substanz“ erkannt');

  frisch();
  WK.kp.art = 'woche'; WK.kp.id = ''; WK.kp.modus = 'ansicht';
  WK.seiteZeichnen(true);
  pruefe(WK.DB.wochen.length === 0, 'eine Woche ansehen legt sie nicht an');
  pruefe(/S oder V/.test(seiteHtml()) && !/oeffne\('einst',''\)/.test(seiteHtml()), 'eine leere Woche sagt, wo geplant wird — eine Übernahme gibt es nicht mehr');
  pruefe(!/um-hinweis/.test(seiteHtml()), 'nach der Umstellung in der Workbench kein Hinweis');
  delete WK.DB.einstellungen.aktivitaetenUmgestellt;
  WK.seiteZeichnen(true);
  pruefe(/um-hinweis/.test(seiteHtml()) && /Erst in der Workbench umstellen/.test(seiteHtml()), 'vorher sagt die Woche, dass erst die Workbench umstellt');
  WK.DB.einstellungen.aktivitaetenUmgestellt = '2026-10-16 12:00:00';
  WK.kp.modus = 'schreiben';
  WK.kpTextSetzen('Hallo');
  pruefe(WK.kpWocheFinden(mo) && WK.kpWocheFinden(mo).text === 'Hallo', 'wer in der Woche schreibt, legt sie an');
}

/* ============================================================
   7. Kästchen auf der Seite — die Woche zieht mit
   ============================================================ */
console.log('\n7. Abhaken auf der Seite');
if (WK) {
  frisch();
  const s = neueSeite('notiz', 'Telefonat', '[] Unterlagen schicken');
  WK.kp.art = 'seite'; WK.kp.id = s.id;
  WK.kpEinplanen(0, 'v');
  const mo = WK.kpHeuteMontag();
  const e = WK.kpWocheFinden(mo).eintraege[0];
  WK.kp.art = 'seite'; WK.kp.id = s.id;
  WK.kpKastenUm(0);
  pruefe(s.text === '[x] Unterlagen schicken' && e.erledigt === true && /\[x\] Unterlagen schicken/.test(WK.kpWocheFinden(mo).text),
         'abhaken auf der Seite streicht auch in der Woche durch');
  WK.kpKastenUm(0);
  pruefe(s.text === '[] Unterlagen schicken' && e.erledigt === false && /\[\] Unterlagen schicken/.test(WK.kpWocheFinden(mo).text), 'und zurück');
  s.text = '  [ ] eingerückt';
  WK.kpKastenUm(0);
  pruefe(s.text === '  [x] eingerückt', 'die Einrückung bleibt beim Abhaken');
}

/* ============================================================
   8. Ansicht und Schreiben wie in der Workbench
   ============================================================ */
console.log('\n8. Ansicht und Schreiben');
if (WK) {
  frisch();
  const a = WK.kpAuszeichnen('*fett* _kursiv_ ~durch~ +unter+ ^kap^ **auch** ~~so~~');
  pruefe(/<b>fett<\/b>/.test(a) && /<i>kursiv<\/i>/.test(a) && /<s>durch<\/s>/.test(a) && /<u>unter<\/u>/.test(a)
         && /fl-kap">kap</.test(a) && /<b>auch<\/b>/.test(a) && /<s>so<\/s>/.test(a), 'Auszeichnungen der Workbench und aus Markdown');
  pruefe(/<a href="https:\/\/x\.de"/.test(WK.kpAuszeichnen('[Seite](https://x.de)')), 'Verweise ins Netz');
  pruefe(WK.kpAuszeichnen('<script>').indexOf('<script>') < 0, 'fremdes HTML bleibt maskiert');
  const v = neueSeite('vorhaben', 'Ziel', '');
  pruefe(/oeffne\('seite','/.test(WK.kpAuszeichnen('[[projekt:' + v.id + '|Alt]]')) && /wb-tot/.test(WK.kpAuszeichnen('[[projekt:weg|Alt]]')),
         'Workbench-Verweise führen zur Seite, wenn es sie hier gibt');
  const s = neueSeite('notiz', 'N', '# Titel\n## Abschnitt\nText\n- Punkt\n1. eins\n2. zwei\n---\n| A | B |\n|---|---|\n| [] x | y |\n!skizze:abcdefgh');
  const h = WK.kpAnsichtHtml(s);
  pruefe(/fl-h1/.test(h) && /fl-h2/.test(h) && /fl-punkt/.test(h) && /fl-nr">2\./.test(h) && /fl-trenner/.test(h), 'Überschriften, Punkte, Nummern, Trennlinie');
  pruefe(/fl-tab/.test(h) && /kpZelleUm\(9,0\)/.test(h), 'Tabellen mit Kästchen in Zellen');
  pruefe(/Workbench zu sehen/.test(h), 'eine Skizze verschwindet nicht kommentarlos');
  WK.kp.art = 'seite'; WK.kp.id = s.id;
  WK.kpZelleUm(9, 0);
  pruefe(/\| \[x\] x \| y \|/.test(s.text), 'ein Kästchen in einer Zelle lässt sich abhaken');

  WK.kp.modus = 'schreiben';
  WK.seiteZeichnen(true);
  const hs = seiteHtml();
  pruefe(/<textarea id="kpFeld"/.test(hs) && /fl-leiste/.test(hs) && /onkeydown="kpTaste\(event\)"/.test(hs) && /onbeforeinput="kpVorEingabe\(event\)"/.test(hs),
         'Schreiben: Werkzeugleiste und Feld mit Enter-Fortsetzung');
  let f = feld('[] erste', 8);
  WK.kpListeWeiter(f);
  pruefe(f.value === '[] erste\n[] ', 'Enter nach einer Aufgabe beginnt die nächste — immer offen');
  f = feld('[x] fertig', 10);
  WK.kpListeWeiter(f);
  pruefe(f.value === '[x] fertig\n[] ', 'auch nach einer erledigten Aufgabe kommt ein offenes Kästchen');
  f = feld('a\n[] ', 5);
  WK.kpListeWeiter(f);
  pruefe(f.value === 'a\n', 'Enter in einem leeren Kästchen beendet die Liste');
  f = feld('Text', 2);
  WK.kpZeichen('kasten');
  pruefe(f.value === '[] Text' && s.text === '[] Text', 'der Kästchen-Knopf macht die Zeile zur Aufgabe und speichert');
  f = feld('- Punkt', 3);
  WK.kpZeichen('kasten');
  pruefe(f.value === '[] Punkt', 'aus einem Punkt wird ein Kästchen, kein doppeltes Zeichen');
  f = feld('Hallo', 2);
  WK.kpUmschliessen('*');
  pruefe(f.value === '*Hallo*', 'Fett ohne Auswahl wirkt auf das Wort');
  f = feld('x', 1);
  WK.kpZeichen('datum');
  pruefe(/^(Mo|Di|Mi|Do|Fr|Sa|So), \d\d\.\d\d\.\d{4} — x$/.test(f.value), 'Datum einfügen wie in der Workbench');
  f = feld('a\nb', 0, 3);
  WK.kpNummerieren();
  pruefe(f.value === '1. a\n2. b', 'Nummerieren über die Auswahl');
}

/* ============================================================
   10. Löschen und Rückgängig
   ============================================================ */
console.log('\n10. Löschen und Rückgängig');
if (WK) {
  frisch();
  const s = neueSeite('liste', 'Weg damit', '[] a');
  WK.kp.art = 'seite'; WK.kp.id = s.id;
  WK.kpEinplanen(0, 's');
  WK.kp.art = 'seite'; WK.kp.id = s.id;
  WK.kpLoeschen();
  pruefe(!WK.kpSeiteFinden(s.id) && WK.DB.grabsteine.some(g => g.s === 'themen' && g.id === s.id), 'gelöscht mit Löschvermerk — in der Sammlung der Workbench');
  pruefe(WK.kpWocheFinden(WK.kpHeuteMontag()).eintraege.length === 1, 'was sie in die Woche gegeben hat, bleibt dort');
  WK.rueckgaengig();
  pruefe(WK.kpSeiteFinden(s.id) && !WK.DB.grabsteine.some(g => g.id === s.id), 'Rückgängig holt die Seite zurück');
  WK.kp.art = 'woche'; WK.kp.id = '';
  WK.kpLoeschen();
  pruefe(WK.kpWocheFinden(WK.kpHeuteMontag()) !== null, 'die laufende Woche lässt sich nicht löschen');
  const alt = WK.tagePlus(WK.kpHeuteMontag(), -7);
  WK.kpWocheAnlegen(alt);
  WK.kp.art = 'woche'; WK.kp.id = alt;
  WK.kpLoeschen();
  pruefe(!WK.kpWocheFinden(alt), 'eine frühere Woche lässt sich löschen');
}


/* ============================================================
   11. Installation: Service Worker und Manifest
   Grund: Liegen beide Apps nebeneinander, darf der Wochenkompass den
   Service Worker und den Vorrat der Workbench nicht ersetzen.
   ============================================================ */
console.log('\n11. Service Worker und Manifest');
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
   12. Schmale Bildschirme: kein Überlauf durch Rasterspalten
   Eine Rasterspalte ohne minmax(0, …) wächst auf die Mindestbreite
   ihres Inhalts (Kopfzeile) — am Pixel wurde die Seite so 498 px breit.
   ============================================================ */
console.log('\n12. Schmale Bildschirme');
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
   13. Beruf und Privat
   Grund: 2.0 hatte die Zuordnung verloren. Listen, Vorhaben und
   Notizen tragen sie wieder, die Seitenleiste filtert danach.
   ============================================================ */
console.log('\n13. Beruf und Privat');
if (WK) {
  frisch();
  WK.kp.filter = 'alle';
  const a = neueSeite('liste', 'Offen', '');
  WK.kpFilterSetzen('beruflich');
  const b = neueSeite('vorhaben', 'Angebot Nord', '');
  WK.kpFilterSetzen('privat');
  const c = neueSeite('notiz', 'Garten', '');
  pruefe(a.kontext === 'beruflich' && b.kontext === 'beruflich' && c.kontext === 'privat',
         'eine neue Seite bekommt den gerade gewählten Filter — ohne Filter beruflich wie in der Workbench');
  a.kontext = '';
  pruefe(WK.localStorage.getItem('kompass-filter') === 'privat', 'der Filter wird auf dem Gerät gemerkt');
  WK.kp.filter = 'alle'; WK.kpFilterLaden(); WK.kp.notizenAuf = true;
  pruefe(WK.kp.filter === 'privat', 'und beim Start wieder geladen');
  WK.leisteZeichnen();
  let le = WK.document.getElementById('leiste').innerHTML;
  pruefe(/Garten/.test(le) && /Offen/.test(le) && !/Angebot Nord/.test(le), 'Privat zeigt private Seiten und solche ohne Zuordnung');
  pruefe(/Keine Vorhaben unter diesem Filter/.test(le), 'ein leerer Bereich sagt, dass der Filter greift');
  WK.kpFilterSetzen('alle');
  le = WK.document.getElementById('leiste').innerHTML;
  pruefe(/Garten/.test(le) && /Offen/.test(le) && /Angebot Nord/.test(le), 'Alle zeigt alles');
  pruefe(/kpFilterSetzen\('beruflich'\)/.test(le) && /kpFilterSetzen\('privat'\)/.test(le), 'der Filter steht in der Seitenleiste');
  WK.kpFilterSetzen('quatsch');
  pruefe(WK.kp.filter === 'alle', 'ein unbekannter Filter wird abgewiesen');
  WK.kp.art = 'seite'; WK.kp.id = a.id;
  WK.seiteZeichnen(true);
  pruefe(/kpKontext\('beruflich'\)/.test(seiteHtml()) && /kpKontext\('privat'\)/.test(seiteHtml()), 'jede Seite hat im Kopf Beruf/Privat');
  WK.kpKontext('beruflich');
  pruefe(a.kontext === 'beruflich', 'die Zuordnung lässt sich setzen');
  WK.kpKontext('anders');
  pruefe(a.kontext === 'beruflich', 'eine unbekannte Zuordnung wird abgewiesen');
  WK.kp.id = c.id; WK.seiteZeichnen(true);
  pruefe(/kpKontext\(/.test(seiteHtml()), 'auch Notizen haben Beruf/Privat');
}

/* ============================================================
   14. Sprung an die Zeile, Schreibmarke beim Wechsel
   Grund: ↗ öffnet die Ansicht — die Schreibmarke steht danach beim
   Wechsel auf „Schreiben“ genau in dieser Zeile.
   ============================================================ */
console.log('\n14. Sprung und Schreibmarke');
if (WK) {
  frisch();
  const s = neueSeite('vorhaben', 'Umzug', 'Erste Zeile\n\n[] Firma anfragen\n[] Lager kündigen');
  WK.kp.art = 'seite'; WK.kp.id = s.id;
  WK.kpEinplanen(3, 'v');
  const mo = WK.kpHeuteMontag();
  WK.kp.art = 'woche'; WK.kp.id = '';
  WK.kpBzSprung(wochenKennung(), WK.kpWocheFinden(mo).text.split('\n').indexOf('[] Lager kündigen'));
  pruefe(WK.kp.modus === 'ansicht' && WK.kp.hervor === 'Lager kündigen', '↗ öffnet die Seite in der Ansicht, nicht im Schreiben-Modus');
  const f = WK.document.getElementById('kpFeld');
  f.value = s.text; f.selectionStart = 0; f.selectionEnd = 0;
  WK.modusSetzen('schreiben');
  pruefe(f.selectionStart === 'Erste Zeile\n\n[] Firma anfragen\n'.length && f.selectionEnd === s.text.length,
         'beim Wechsel auf „Schreiben“ steht die Schreibmarke in der Zeile, die Zeile ist markiert');
  pruefe(WK.kp.hervor === '', 'danach ist die Hervorhebung verbraucht');
  WK.kp.modus = 'ansicht';
  f.selectionStart = 0; f.selectionEnd = 0;
  WK.modusSetzen('schreiben');
  pruefe(f.selectionStart === 0, 'ohne Sprung bleibt die Schreibmarke, wo sie war');
  WK.kp.modus = 'ansicht'; WK.kp.oaAuf = true;
  WK.kpOaSprung(2);
  pruefe(WK.kp.oaAuf === false && WK.kp.hervor === 'Firma anfragen' && /id="kpHervor"/.test(seiteHtml()), '↘ im Fenster schließt es und hebt die Zeile im Text hervor');
  WK.kp.oaAuf = true; WK.kp.modus = 'schreiben';
  f.value = s.text;
  WK.kpOaSprung(3);
  pruefe(WK.kp.oaAuf === false && f.selectionStart === 'Erste Zeile\n\n[] Firma anfragen\n'.length, 'im Schreiben-Modus setzt ↘ die Schreibmarke direkt');
  WK.kp.oaAuf = true;
  WK.kpOaSchleier({ target: 1, currentTarget: 2 });
  pruefe(WK.kp.oaAuf === true, 'ein Klick ins Fenster schließt es nicht');
  WK.kpOaSchleier({ target: 1, currentTarget: 1 });
  pruefe(WK.kp.oaAuf === false, 'ein Klick daneben schließt es');
  WK.kp.oaAuf = true;
  WK.tasteGlobal({ key: 'Escape' });
  pruefe(WK.kp.oaAuf === false, 'Escape schließt das Fenster');
  WK.kp.oaAuf = true;
  WK.oeffne('woche', '');
  pruefe(WK.kp.oaAuf === false, 'beim Seitenwechsel ist das Fenster zu');
}

/* ============================================================
   16. Wochen aus 2.0/2.1 werden zu Text
   ============================================================ */
console.log('\n16. Alte Wochen umstellen');
if (WK) {
  frisch();
  const mo = WK.kpHeuteMontag();
  WK.DB.wochen.push({ id: 'kw-' + mo, montag: mo, geaendert: 1, eintraege: [
    { id: 'e1', abschnitt: 's', text: 'Konzept', quelle: 'x', erledigt: false },
    { id: 'e2', abschnitt: 'v', text: 'Becker', quelle: '', erledigt: true }] });
  WK.DB.wochen.push({ id: 'kw-2026-01-05', montag: '2026-01-05', geaendert: 1, eintraege: [] });
  const n = WK.kpWochenUmstellen();
  pruefe(n === 2 && WK.kpWocheFinden(mo).text === '## Bringt mich substanziell weiter\n[] Konzept\n\n## Verbindlichkeiten\n[x] Becker\n',
         'die Einträge werden einmal zu Text — Erledigtes mit [x]');
  pruefe(WK.kpWocheFinden(mo).geaendert > 1, 'mit neuem Stempel, damit der Abgleich es mitnimmt');
  pruefe(WK.kpWochenUmstellen() === 0, 'ein zweites Mal ändert nichts');
}

/* ============================================================
   17. Seitenleiste: eingeklappt und ohne Zählung
   ============================================================ */
console.log('\n17. Seitenleiste eingeklappt');
if (WK) {
  frisch();
  WK.kp.filter = 'alle'; WK.kp.notizenAuf = false; WK.kp.ruhtAuf = false; WK.kp.fertigAuf = false;
  const n = neueSeite('notiz', 'Geheime Notiz', '[] a\n[] b');
  const r = neueSeite('vorhaben', 'Ruhendes', '');
  r.zustand = 'ruht';
  const f = neueSeite('vorhaben', 'Fertiges', '');
  f.zustand = 'erledigt';
  WK.kp.art = 'woche'; WK.kp.id = '';
  WK.leisteZeichnen();
  let le = WK.document.getElementById('leiste').innerHTML;
  pruefe(!/Geheime Notiz/.test(le) && /klappUm\('notiz'\)/.test(le), 'Notizen sind beim Start eingeklappt — der Kopf klappt auf');
  pruefe(!/Ruhendes/.test(le) && /› Ruht · 1/.test(le), '„Ruht“ ist eingeklappt wie „Erledigt“');
  pruefe(!/Fertiges/.test(le) && /› Erledigt · 1/.test(le), '„Erledigt“ bleibt eingeklappt');
  WK.klappUm('notiz'); WK.klappUm('ruht');
  le = WK.document.getElementById('leiste').innerHTML;
  pruefe(/Geheime Notiz/.test(le) && /Ruhendes/.test(le), 'aufgeklappt zeigen sie ihre Seiten');
  WK.kp.notizenAuf = false; WK.kp.ruhtAuf = false;
  WK.kp.art = 'seite'; WK.kp.id = n.id;
  WK.leisteZeichnen();
  pruefe(/Geheime Notiz/.test(WK.document.getElementById('leiste').innerHTML), 'ist eine Notiz offen, sind die Notizen aufgeklappt');
  WK.klappUm('quatsch');
  pruefe(!/class="zahl"/.test(WK.document.getElementById('leiste').innerHTML), 'keine Zählung offener Aufgaben in der Seitenleiste');
  WK.seiteZeichnen(true);
  pruefe(!/Offene Aufgaben<b>/.test(seiteHtml()), 'keine Zählung am Knopf „Offene Aufgaben“');
}

/* ============================================================
   19. Automatische Anmeldung und Streifen — wie in der Workbench
   Grund: Beim Öffnen und sobald die App merkt, dass sie nicht verbunden
   ist, meldet sie sich still neu an; misslingt das, zeigt der Streifen
   „Neu verbinden“.
   ============================================================ */
console.log('\n19. Automatische Anmeldung');
if (WK) {
  pruefe(/id="anmeldeStreifen"[\s\S]*?onclick="anmelden\(false\)">Neu verbinden/.test(QUELLE), 'der Streifen „Neu verbinden“ steht in der Seite');
  pruefe(/\.app>\.anmeldebanner\{grid-row:2\}/.test(QUELLE), 'er hat seine eigene Rasterzeile');
  pruefe(/stillAnmelden\('start'\)/.test(funktionText(SKRIPT, 'start') || ''), 'beim Öffnen wird still angemeldet');
  pruefe(/stillAnmelden\(/.test(funktionText(SKRIPT, 'rueckkehrPruefen') || '') && /stillAnmelden\(/.test(funktionText(SKRIPT, 'verbindungPruefen') || ''),
         'auch beim Zurückkehren und wenn die Verbindung verloren geht');
  if (WB_SKRIPT) {
    pruefe(funktionText(SKRIPT, 'klickErneuern') === funktionText(WB_SKRIPT, 'klickErneuern'), 'der nächste Klick erneuert wie in der Workbench');
  }
  const alt = WK.anmelden;
  const rufe = [];
  let antwort = true;
  WK.anmelden = function (still) { rufe.push(still); return Promise.resolve(antwort); };
  const kl = [];
  WK.document.getElementById('anmeldeStreifen').classList = { add(k) { kl.push('+' + k); }, remove(k) { kl.push('-' + k); } };
  WK.localStorage.setItem(WK.ANMELDE_MERKER, '1');
  WK.zugriffToken = null; WK.tokenAblauf = 0; WK.stillVersuchtMs = 0; WK.anmeldungLaeuft = false;
  WK.stillAnmelden('start').then(function (gut) {
    pruefe(gut === true && rufe.length === 1 && rufe[0] === true, 'still heißt: ohne Fenster, wenn die Google-Sitzung besteht');
    return WK.stillAnmelden('verbindung');
  }).then(function (gut) {
    pruefe(gut === false && rufe.length === 1, 'höchstens einmal je Minute — kein flackerndes Fenster');
    WK.stillVersuchtMs = 0; antwort = false;
    return WK.stillAnmelden('verbindung');
  }).then(function (gut) {
    pruefe(gut === false && WK.verbindungOk === false && kl[kl.length - 1] === '+sichtbar'
           && /abgelaufen/.test(WK.document.getElementById('anmeldeText').textContent), 'misslingt es, zeigt der Streifen „abgelaufen — bitte neu anmelden“');
    WK.localStorage.removeItem(WK.ANMELDE_MERKER);
    WK.stillVersuchtMs = 0;
    return WK.stillAnmelden('start');
  }).then(function (gut) {
    pruefe(gut === false && rufe.length === 2, 'wer nie angemeldet war, wird nicht gefragt');
    WK.anmeldebannerZeichnen();
    pruefe(/Noch nicht bei Google angemeldet/.test(WK.document.getElementById('anmeldeText').textContent), 'dann sagt der Streifen: nur lokal gespeichert');
    WK.zugriffToken = 'x'; WK.tokenAblauf = Date.now() + 3600000; WK.verbindungOk = true;
    WK.anmeldebannerZeichnen();
    pruefe(kl[kl.length - 1] === '-sichtbar', 'verbunden: kein Streifen');
    WK.zugriffToken = null; WK.tokenAblauf = 0;
    WK.anmelden = alt;
  });
}

/* ============================================================
   20. Manuell sortieren — nur innerhalb einer Gruppe
   ============================================================ */
console.log('\n20. Manuell sortieren');
if (WK) {
  frisch();
  WK.kp.filter = 'alle'; WK.kp.sortieren = ''; WK.kp.ruhtAuf = false; WK.kp.notizenAuf = false;
  const a = neueSeite('liste', 'A', '');
  const b = neueSeite('vorhaben', 'V1', '');
  const c = neueSeite('liste', 'B', '');
  const d = neueSeite('liste', 'C', '');
  const namen = schl => WK.kpGruppe(schl).map(x => x.titel).join(',');
  pruefe(namen('liste') === 'A,B,C', 'Ausgang: A, B, C');
  pruefe(WK.kpVerschieben(d.id, a.id, 'vor') && namen('liste') === 'C,A,B', 'ziehen vor einen Eintrag');
  WK.kpVerschieben(d.id, b.id, 'nach');
  pruefe(namen('liste') === 'C,A,B' && WK.kpVerschieben(d.id, b.id, 'nach') === false, 'zwischen Gruppen wird nicht verschoben');
  WK.kpVerschieben(d.id, c.id, 'nach');
  pruefe(namen('liste') === 'A,B,C', 'ziehen hinter einen Eintrag');
  const rB = b.rang;
  pruefe(WK.kpGruppe('vorhaben-laeuft')[0].rang === rB, 'die andere Gruppe behält ihren Rang');
  WK.kpSchieben(d.id, -1);
  pruefe(namen('liste') === 'A,C,B', '▲ tauscht mit dem Nachbarn darüber');
  WK.kpSchieben(a.id, -1);
  pruefe(namen('liste') === 'A,C,B', 'ganz oben bleibt ▲ ohne Wirkung');
  c.kontext = 'beruflich'; a.kontext = 'privat'; d.kontext = 'privat';
  WK.kp.filter = 'privat';
  WK.kpSchieben(d.id, -1);
  pruefe(namen('liste') === 'C,A,B', 'unter einem Filter wird mit dem nächsten sichtbaren getauscht');
  pruefe(WK.kpGruppe('liste').filter(x => x.kontext === 'beruflich').length === 1, 'ausgeblendete Einträge bleiben erhalten');
  WK.kp.filter = 'alle';
  const g1 = neueSeite('notiz', 'N1', ''); g1.rang = 5;
  const g2 = neueSeite('notiz', 'N2', ''); g2.rang = 5;
  pruefe(WK.kpVerschieben(g2.id, g1.id, 'vor') && namen('notiz') === 'N2,N1', 'auch alte Daten mit gleichem Rang lassen sich sortieren');
  WK.kp.art = 'seite'; WK.kp.id = b.id;
  const v2 = neueSeite('vorhaben', 'V2', '');
  const v3 = neueSeite('vorhaben', 'V3', '');
  v3.zustand = 'ruht';
  WK.kp.id = v2.id; WK.kpZustand('ruht');
  pruefe(namen('vorhaben-ruht') === 'V3,V2', 'wer den Zustand wechselt, steht in der neuen Gruppe unten');

  WK.kp.art = 'woche'; WK.kp.id = '';
  WK.leisteZeichnen();
  let le = WK.document.getElementById('leiste').innerHTML;
  pruefe(/draggable="true" data-id="[^"]+" ondragstart="kpZiehStart\(event,'/.test(le) && /ondrop="kpZiehAb\(event,'/.test(le), 'am PC lässt sich jeder Eintrag ziehen');
  pruefe(/kpSortierenUm\('liste'\)/.test(le) && !/kpSortierenUm\('vorhaben-laeuft'\)/.test(le) && !/kpSortierenUm\('notiz'\)/.test(le)
         && !/kpSortierenUm\('vorhaben-ruht'\)/.test(le),
         'jede Gruppe mit mehreren Einträgen hat „Sortieren“ — mit einem Eintrag oder eingeklappt nicht');
  WK.klappUm('ruht');
  pruefe(/kpSortierenUm\('vorhaben-ruht'\)/.test(WK.document.getElementById('leiste').innerHTML), 'aufgeklappt hat auch „Ruht“ seinen Knopf');
  WK.klappUm('ruht');
  WK.kpSortierenUm('liste');
  le = WK.document.getElementById('leiste').innerHTML;
  pruefe((le.match(/kpSchieben\('[^']+',-1\)/g) || []).length === 3 && /Fertig/.test(le), 'im Sortiermodus haben die Einträge der Gruppe ▲ ▼');
  pruefe(!new RegExp("kpSchieben\\('" + b.id + "'").test(le), 'die anderen Gruppen nicht');
  WK.kpSortierenUm('liste');
  pruefe(WK.kp.sortieren === '', '„Fertig“ beendet den Sortiermodus');
  pruefe(/body\.breit \.sortier-knopf\{display:none\}/.test(QUELLE), 'am PC wird gezogen, der Knopf „Sortieren“ ist dem Handy vorbehalten');

  const marken = [];
  const ziel = { classList: { add(k) { marken.push(k); }, remove() {} }, getBoundingClientRect() { return { top: 100, height: 30 }; } };
  let verhindert = false;
  WK.kpZiehStart({ dataTransfer: { setData() {} } }, a.id);
  WK.kpZiehUeber({ currentTarget: ziel, clientY: 105, preventDefault() { verhindert = true; } }, d.id);
  pruefe(verhindert && marken[0] === 'zieh-vor', 'über der oberen Hälfte zeigt die Linie „davor“');
  verhindert = false;
  WK.kpZiehUeber({ currentTarget: ziel, clientY: 105, preventDefault() { verhindert = true; } }, b.id);
  pruefe(!verhindert, 'über einer anderen Gruppe darf nicht abgelegt werden');
  WK.kpZiehAb({ currentTarget: ziel, clientY: 125, preventDefault() {} }, d.id);
  const l = namen('liste').split(',');
  pruefe(l.indexOf('A') === l.indexOf('C') + 1 && WK.kpGezogen === '', 'ablegen in der unteren Hälfte setzt dahinter');
}

/* ============================================================
   21. Ergänzte Zeilen bleiben verbunden
   Grund: Aus „… beschreiben“ wurde in der Woche „… beschreiben (Fr)“
   — und ↗ war weg. Hinten Angehängtes hält jetzt die Verbindung, in
   der Woche wie in der Quelle.
   ============================================================ */
console.log('\n21. Ergänzte Zeilen');
if (WK) {
  pruefe(WK.kpPasst('Offering beschreiben', 'Offering beschreiben') === 2, 'wörtlich gleich');
  pruefe(WK.kpPasst('Offering beschreiben (Fr)', 'Offering beschreiben') === 1 && WK.kpPasst('Anrufen – bis 12 Uhr', 'Anrufen') === 1
         && WK.kpPasst('Anrufen ✔', 'Anrufen') === 1 && WK.kpPasst('Anrufen, dann mailen', 'Anrufen') === 1, 'hinten angehängt passt');
  pruefe(WK.kpPasst('Anrufer', 'Anrufen') === 0 && WK.kpPasst('Anrufens', 'Anrufen') === 0 && WK.kpPasst('Bitte Anrufen', 'Anrufen') === 0,
         'mitten im Wort oder vorne geändert passt nicht');
  frisch();
  const s = neueSeite('liste', 'Büro', '[] Anrufen\n[] Offering beschreiben');
  WK.kp.art = 'seite'; WK.kp.id = s.id;
  WK.kpEinplanen(1, 'v');
  const mo = WK.kpHeuteMontag();
  const w = WK.kpWocheFinden(mo);
  w.text = w.text.replace('[] Offering beschreiben', '[] Offering beschreiben (Fr)');
  WK.kp.art = 'woche'; WK.kp.id = ''; WK.kp.modus = 'ansicht';
  WK.seiteZeichnen(true);
  pruefe(/kpBzSprung\(/.test(seiteHtml()), 'in der Woche um „(Fr)“ ergänzt: ↗ bleibt');
  const nr = w.text.split('\n').indexOf('[] Offering beschreiben (Fr)');
  WK.kpBzUm(wochenKennung(), nr);
  pruefe(/\[x\] Offering beschreiben \(Fr\)/.test(w.text) && /\[x\] Offering beschreiben$/.test(s.text), 'Durchstreichen hakt die Quelle weiter ab');
  WK.kpBzUm(wochenKennung(), nr);
  WK.kp.art = 'seite'; WK.kp.id = s.id;
  pruefe(WK.kpEintragFinden(s.id, 'Offering beschreiben') !== null, 'an der Quelle bleibt die Marke „KW“');
  s.text = '[] Anrufen\n[] Offering beschreiben – Entwurf an Jana';
  pruefe(WK.kpEintragFinden(s.id, 'Offering beschreiben – Entwurf an Jana') !== null, 'auch in der Quelle darf hinten etwas dazukommen');
  WK.kpKastenUm(1);
  pruefe(/\[x\] Offering beschreiben \(Fr\)/.test(w.text), 'abhaken in der Quelle streicht die ergänzte Zeile in der Woche durch');
  WK.kpKastenUm(1);
  WK.kp.art = 'woche'; WK.kp.id = '';
  WK.kpBzSprung(wochenKennung(), nr);
  pruefe(WK.kp.art === 'seite' && /id="kpHervor"[^>]*>|class="fl-zeile aufgabe hervor" id="kpHervor"/.test(seiteHtml())
         && (seiteHtml().match(/id="kpHervor"/g) || []).length === 1, '↗ hebt die ergänzte Zeile in der Quelle hervor');
  frisch();
  const q = neueSeite('liste', 'L', '[] Anrufen\n[] Anrufen Becker');
  WK.kp.art = 'seite'; WK.kp.id = q.id;
  WK.kpEinplanen(0, 's');
  WK.kp.art = 'seite'; WK.kp.id = q.id;
  WK.kpEinplanen(1, 's');
  const w2 = WK.kpWocheFinden(mo);
  pruefe(w2.eintraege.length === 2, '„Anrufen Becker“ ist nicht schon durch „Anrufen“ eingeplant');
  const nrB = w2.text.split('\n').indexOf('[] Anrufen Becker');
  WK.kp.art = 'woche'; WK.kp.id = '';
  WK.kpBzUm(wochenKennung(), nrB);
  pruefe(/\[x\] Anrufen Becker/.test(q.text) && /\[\] Anrufen$/m.test(q.text), 'wörtlich gleiche Zeilen gehen vor — die richtige wird abgehakt');
  pruefe(WK.kpWocheEintrag(w2, 'Anrufen Becker').text === 'Anrufen Becker', 'zur Zeile gehört der genaueste Eintrag');
}

/* ============================================================
   22. Gemeinsame Daten mit der Workbench (3.0)
   Grund: Vorhaben, Listen, Notizen, Wochen und Tage sind Sätze der
   Workbench. Was die eine App plant oder abhakt, muss die andere
   genauso sehen — und keine darf Sätze der anderen verlieren.
   ============================================================ */
console.log('\n22. Gemeinsame Daten mit der Workbench');
if (WK) {
  frisch();
  const heute = WK.isoDatum();
  const mo = WK.kpHeuteMontag();
  WK.DB.projekte.push({ id: 'p1', name: 'Umbau', kontext: 'beruflich', status: 'laufend', flaeche: 'Text\n[] Angebot\n[] Statik', ordnung: 10, geaendert: 1 });
  WK.DB.themen.push({ id: 't1', name: 'Einkauf', kontext: 'privat', text: '[] Milch', ordnung: 20, geaendert: 1 });
  WK.DB.gedanken.push({ id: 'g1', titel: 'Idee', text: 'frei', kontext: 'beruflich', geaendert: 1 });
  WK.DB.gedanken.push({ id: 'g2', titel: 'Alte Kompass-Woche', kompass: 'woche', text: '', geaendert: 1 });
  WK.DB.aufgaben.push({ id: 'r1', titel: 'Joggen', wiederholung: { takt: 'woche', intervall: 1, tage: [1] }, geaendert: 1 });
  const titel = WK.kpSeitenAlle().map(x => x.art + ':' + x.titel).sort().join(',');
  pruefe(titel === 'liste:Einkauf,notiz:Idee,vorhaben:Umbau', 'Projekte, Themen und Gedanken sind Vorhaben, Listen und Notizen — Kompass-1.0-Reste und Routinen nicht');
  const v = WK.kpSeiteFinden('p1');
  pruefe(v.text === 'Text\n[] Angebot\n[] Statik' && v.zustand === 'laeuft', 'der Text eines Vorhabens ist seine Fläche, „laufend“ heißt läuft');

  /* In der Workbench für heute vorgenommen: hier als Marke „Heute ×“. */
  WK.kpPlanenKern(v, 1, 'h', heute);
  WK.kp.art = 'seite'; WK.kp.id = 'p1'; WK.kp.oaAuf = true; WK.kp.modus = 'ansicht';
  WK.seiteZeichnen(true);
  let h = seiteHtml();
  pruefe(/class="drin h"[^>]*>Heute ×</.test(h), 'was die Workbench für heute vorgenommen hat, zeigt der Kompass als „Heute ×“');
  pruefe(/kpEinplanen\(1,'s'\)/.test(h), 'eine Aufgabe für heute lässt sich trotzdem in die Woche planen');
  WK.kpEinplanen(1, 's');
  const w = WK.kpWocheFinden(mo);
  pruefe(w && w.id === 'kw-' + mo && /\[\] Angebot/.test(w.text), 'die Woche ist derselbe Satz wie im Tag der Workbench');

  /* Durchstreichen in der Woche hakt auch im Tag der Workbench ab. */
  const nr = w.text.split('\n').indexOf('[] Angebot');
  WK.kp.art = 'woche'; WK.kp.id = '';
  WK.kpBzUm(w.id, nr);
  pruefe(/\[x\] Angebot/.test(v.text) && /\[x\] Angebot/.test(WK.kpTagFinden(heute).text), 'abgehakt in der Woche: in der Seite und im Tag der Workbench ebenso');

  /* Anlegen über die Seitenleiste: in der Sammlung der Workbench. */
  WK.kp.filter = 'privat'; WK.kp.neuIn = 'vorhaben';
  WK.document.getElementById('neuName').value = 'Garten';
  WK.anlegen();
  const neu = WK.DB.projekte.filter(p => p.name === 'Garten')[0];
  pruefe(neu && neu.kontext === 'privat' && neu.status === 'laufend' && typeof neu.ordnung === 'number',
         'ein neues Vorhaben ist ein Projekt der Workbench — mit Kontext, Status und Rang');
  WK.kp.filter = 'alle';

  /* Löschen: der Vermerk nennt die Sammlung der Workbench. */
  WK.kp.art = 'seite'; WK.kp.id = 'p1';
  WK.kpLoeschen();
  pruefe(!WK.DB.projekte.some(p => p.id === 'p1') && WK.DB.grabsteine.some(g => g.s === 'projekte' && g.id === 'p1'), 'ein gelöschtes Vorhaben hinterlässt den Vermerk unter „projekte“');
  WK.rueckgaengig();
  pruefe(WK.DB.projekte.some(p => p.id === 'p1') && !WK.DB.grabsteine.some(g => g.id === 'p1'), 'Rückgängig holt das Projekt zurück');
  pruefe(WK.DB.aufgaben.length === 1 && WK.DB.aufgaben[0].id === 'r1', 'Routinen der Workbench bleiben unberührt');

  /* Alte Wochenziele werden erst nach der Umstellung Text. */
  const st = funktionText(SKRIPT, 'start');
  pruefe(st && /if \(kpUmgestellt\(\)\) \{ kpWochenUmstellen\(\); \}/.test(st), 'alte Wochen werden erst nach der Umstellung in der Workbench zu Text');
  pruefe(!/kpMig|kompass\.json/.test(SKRIPT.replace(/\/\*[\s\S]*?\*\//g, '')), 'keine eigene Übernahme und keine kompass.json mehr');
}

/* ============================================================
   23. Aufzählungspunkt als kleines schwarzes Quadrat (3.0.1)
   Grund: Der Punkt war ein umrandetes Kästchen und stand nicht in
   einer Flucht mit den Aufgabenkästchen.
   ============================================================ */
console.log('\n23. Aufzählungspunkt');
{
  const punkt = QUELLE.match(/\.fl-punkt\{[^}]*\}/);
  const kern = QUELLE.match(/\.fl-punkt::before\{[^}]*\}/);
  const kasten = QUELLE.match(/\n\.tkasten\{[^}]*\}/);
  const z = kern ? kern[0] : '';
  const w = Number((z.match(/width:(\d+)px/) || [])[1]);
  const l = Number((z.match(/left:(\d+)px/) || [])[1]);
  const t = Number((z.match(/top:(\d+)px/) || [])[1]);
  pruefe(punkt && !/border:/.test(punkt[0]) && /flex:0 0 17px/.test(punkt[0]) && /height:17px/.test(punkt[0])
         && kasten && /flex:0 0 17px/.test(kasten[0]), 'der Punkt hat keinen Rahmen und ein Feld so groß wie ein Aufgabenkästchen');
  pruefe(punkt && kasten && (punkt[0].match(/margin-top:[^;}]*/) || [''])[0] === (kasten[0].match(/margin-top:[^;}]*/) || ['x'])[0],
         'er steht auf derselben Höhe wie das Kästchen');
  pruefe(kern && /background:var\(--tinte\)/.test(z) && w > 0 && w < 7, 'das Quadrat ist gefüllt, dunkel und kleiner als vorher (7 px)');
  pruefe(kern && Math.abs((l + w / 2) - 8.5) <= 0.5 && Math.abs((t + w / 2) - 8.5) <= 0.5, 'es steht mittig in Höhe und Breite');
}

/* ============================================================
   18. Neue Fassung suchen und laden — wie in der Workbench
   ============================================================ */
console.log('\n18. Neue Fassung');
if (WK) {
  pruefe(/id="neuStreifen"[^>]*onclick="neuLaden\(\)"/.test(QUELLE) && /id="neuText"/.test(QUELLE), 'der Streifen „Neue Fassung“ steht in der Seite');
  pruefe(/\.app>\.rumpf\{grid-row:4\}/.test(QUELLE) && /\.app>\.neustreifen\{grid-row:3\}/.test(QUELLE), 'der versteckte Streifen verschiebt das Raster nicht');
  pruefe(/'\.\/wochenkompass\.html\?stand='/.test(SKRIPT) && /cache: 'no-store'/.test(SKRIPT), 'gefragt wird die eigene Datei, am Vorrat vorbei');
  pruefe(/getRegistration\('\.\/wochenkompass'\)/.test(SKRIPT), 'neu geladen wird über den eigenen Service Worker');
  pruefe(/versionPruefen\(false\);\n  versionTaktStarten\(\);/.test(SKRIPT), 'geprüft wird beim Start und danach im Takt');
  pruefe(/function rueckkehrPruefen\(\) \{[\s\S]*?versionPruefen\(false\)/.test(SKRIPT), 'und beim Zurückkehren zur App');
  pruefe(/'sofort-uebernehmen'/.test(SW_QUELLE) && /skipWaiting/.test(SW_QUELLE), 'der Service Worker übernimmt auf Zuruf sofort');
  const alt = WK.fetch;
  const klassen = [];
  WK.document.getElementById('neuStreifen').classList = { add(k) { klassen.push('+' + k); }, remove(k) { klassen.push('-' + k); } };
  WK.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve("var APP_VERSION = '9.9.9';") });
  WK.versionPruefen(false).then(function (v) {
    pruefe(v === '9.9.9' && WK.neueVersion === '9.9.9' && klassen.indexOf('+sichtbar') >= 0, 'eine neuere Fassung zeigt den Streifen');
    pruefe(/Neue Fassung 9\.9\.9 verfügbar/.test(WK.document.getElementById('neuText').textContent), 'mit beiden Versionsnummern');
    WK.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve("var APP_VERSION = '" + WK.APP_VERSION + "';") });
    return WK.versionPruefen(false);
  }).then(function () {
    pruefe(WK.neueVersion === '' && klassen[klassen.length - 1] === '-sichtbar', 'die laufende Fassung blendet ihn wieder aus');
    WK.kp.art = 'einst';
    WK.seiteZeichnen(true);
    pruefe(/versionPruefen\(true\)/.test(seiteHtml()), 'in den Einstellungen: „Auf neue Fassung prüfen“');
    WK.fetch = alt;
    /* Erst wenn auch die übrigen Prüfungen mit Versprechen durch sind. */
    setTimeout(function () {
      console.log('\nERGEBNIS   ok: ' + anzOk + '   FAIL: ' + anzFail + '   warn: ' + anzWarn);
      process.exitCode = anzFail ? 1 : 0;
    }, 50);
  });
}

/* ============================================================
   ERGEBNIS
   ============================================================ */
if (!WK) {
  console.log('\nERGEBNIS   ok: ' + anzOk + '   FAIL: ' + anzFail + '   warn: ' + anzWarn);
  process.exitCode = anzFail ? 1 : 0;
}
