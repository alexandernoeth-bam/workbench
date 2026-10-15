/* ============================================================
   WK_tests.js — Regressionstests für den Wochenkompass
   Aufruf:  node WK_tests.js [wochenkompass.html] [workbench.html]

   Mit dem zweiten Pfad wird zusätzlich geprüft, dass der Unterbau
   wörtlich der Workbench entspricht. Ohne ihn wird das als „warn“
   übersprungen — der Wochenkompass arbeitet allein (kompass.json).
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
  pruefe(version && Number(version.split('.')[0]) >= 2, 'Hauptversion 2 — eigene Datei, neues Datenmodell');
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
  WK.kp.zielWoche = 'diese'; WK.kp.mig = null; WK.kp.neuIn = '';
  WK.zurueckHolen = null;
}
function seiteHtml() { return WK.document.getElementById('seite').innerHTML; }
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
   3. Unterbau: wörtlich aus der Workbench — aber eigene Datei
   Grund: Kompass 1.0 schrieb in die workbench.json. 2.0 hat seine
   eigene Datei und darf die der Workbench nie anfassen.
   ============================================================ */
console.log('\n3. Unterbau und eigene Datei');
{
  const WOERTLICH = ['zusammenfuehren', 'alsText', 'uebernehmen', 'speichern', 'laden',
    'grabsteinSetzen', 'grabsteinZeit', 'grabsteineAufraeumen', 'textZuBestand', 'abgleichen', 'abgleichPlanen',
    'driveSuchen', 'driveAnlegen', 'driveHochladen', 'driveHerunterladen', 'antwortPruefen',
    'tokenMerken', 'tokenGueltig', 'klientVorbereiten', 'anmelden', 'anmeldeVersuch', 'abmelden',
    'erneuerungPlanen', 'erneuerungPruefen', 'dateiWaehlen', 'dateiAnlegen', 'opfsSchreiben', 'opfsLesen',
    'montagVon', 'kalenderwoche', 'neueKennung', 'esc',
    'feldErsetzen', 'wortUmDieMarke', 'flaecheSinnbild', 'tabelleHtml', 'tabellenZellen', 'listenNummern', 'langDatum'];
  if (!WB_SKRIPT) {
    warn('workbench.html nicht neben dem Wochenkompass — Vergleich übersprungen');
  } else {
    const abweichend = WOERTLICH.filter(n => funktionText(SKRIPT, n) === null || funktionText(SKRIPT, n) !== funktionText(WB_SKRIPT, n));
    pruefe(abweichend.length === 0, WOERTLICH.length + ' Funktionen stimmen wörtlich mit der Workbench überein'
           + (abweichend.length ? ' — abweichend: ' + abweichend.join(', ') : ''));
    const wertW = (s, n) => (s.match(new RegExp("var " + n + "\\s*=\\s*'([^']*)';")) || [])[1];
    pruefe(wertW(SKRIPT, 'CLIENT_ID') === wertW(WB_SKRIPT, 'CLIENT_ID'), 'dieselbe Google-Anwendung — nur so ist die workbench.json für die Übernahme sichtbar');
  }
  const wert = n => (SKRIPT.match(new RegExp("var " + n + "\\s*=\\s*'([^']*)';")) || [])[1];
  pruefe(wert('DRIVE_DATEI') === 'kompass.json' && wert('DATEINAME') === 'kompass.json' && wert('OPFS_NAME') === 'kompass.json',
         'eigene Datei kompass.json — in Drive, als Datei und im Gerätespeicher');
  pruefe(wert('IDB_NAME') !== 'wochenkompass-speicher' && wert('LS_KEY') !== 'wochenkompass-daten',
         'nicht der Dateigriff von Kompass 1.0 — der zeigte auf die workbench.json');
  pruefe(!/workbench\.json/.test(wert('DRIVE_DATEI') + wert('DATEINAME') + wert('OPFS_NAME') + wert('LS_KEY')), 'kein Speicherweg führt in die workbench.json');
  pruefe(/var SAMMLUNGEN = \['seiten', 'wochen'\];/.test(SKRIPT), 'eigene Sammlungen: seiten und wochen');
  pruefe(wert('SCOPES') === 'https://www.googleapis.com/auth/drive.file', 'nur das Recht drive.file');
  if (WK) {
    const db = WK.leereDatenbank();
    pruefe(Array.isArray(db.seiten) && Array.isArray(db.wochen) && !db.aufgaben && !db.gedanken, 'ein leerer Bestand hat nur Seiten und Wochen');
    const r = WK.zusammenfuehren({ seiten: [{ id: 'a', titel: 'alt', geaendert: 1 }], wochen: [], grabsteine: [] },
                                 { seiten: [{ id: 'a', titel: 'neu', geaendert: 2 }, { id: 'b', geaendert: 1 }], wochen: [], grabsteine: [] });
    pruefe(r.db.seiten.length === 2 && r.db.seiten.filter(s => s.id === 'a')[0].titel === 'neu', 'der Abgleich führt Seiten nach Stempel zusammen');
  }
}

/* ============================================================
   4. Seiten: Liste, Vorhaben, Notiz — eine Art Seite
   ============================================================ */
console.log('\n4. Seiten');
if (WK) {
  frisch();
  const v = WK.kpSeiteAnlegen('vorhaben', 'Umzug Büro', '');
  const l = WK.kpSeiteAnlegen('liste', 'Büro', '');
  const n = WK.kpSeiteAnlegen('notiz', 'Ideen', '');
  pruefe(v && l && n && WK.DB.seiten.length === 3, 'alle drei Arten lassen sich anlegen');
  pruefe(v.zustand === 'laeuft' && l.zustand === undefined && n.zustand === undefined, 'nur das Vorhaben hat einen Zustand');
  pruefe(WK.kpSeiteAnlegen('termin', 'x', '') === null && WK.kpSeiteAnlegen('liste', '  ', '') === null, 'unbekannte Art und leerer Name werden abgewiesen');
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
  const s = WK.kpSeiteAnlegen('liste', 'Büro', 'Einleitung\n[] Reisekosten einreichen\n[] Steuerberater anrufen\n[x] Erledigtes');
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
  WK.kpAusplanen(mo, w.eintraege[0].id);
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
  const s = WK.kpSeiteAnlegen('vorhaben', 'Umzug', 'Notiz\n[] Firma anfragen\n[] Lager kündigen');
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
  pruefe((h.match(/kpWocheSprung\(/g) || []).length === 2 && /title="Zu „Umzug“"/.test(h), 'hinter eingeplanten Aufgaben ein ↗ zur Quelle');
  WK.kpWocheZeileUm(1);
  pruefe(/\[x\] Firma anfragen/.test(s.text) && /\[x\] Firma anfragen/.test(w.text), 'ein Klick streicht durch — und hakt die Zeile in der Quelle ab');
  WK.seiteZeichnen(true);
  pruefe(/class="wz erl"/.test(seiteHtml()), 'die Zeile steht in der Woche durchgestrichen');
  WK.kpWocheZeileUm(1);
  pruefe(/\[\] Firma anfragen/.test(s.text) && /\[\] Firma anfragen/.test(w.text), 'ein zweiter Klick nimmt beides zurück');

  WK.modusSetzen('schreiben');
  h = seiteHtml();
  pruefe(/<textarea id="kpFeld"/.test(h) && /fl-leiste/.test(h), 'im Schreiben-Modus Feld und Werkzeugleiste wie bei Notizen');
  WK.kpTextSetzen('Messe am Mittwoch.\n\n' + w.text.replace('[] Lager kündigen', '[] Lager kündigen\nFreitag: Reisekosten\n[] Reifen wechseln'));
  WK.modusSetzen('ansicht');
  h = seiteHtml();
  pruefe(/Messe am Mittwoch/.test(h) && /Freitag: Reisekosten/.test(h), 'frei Geschriebenes steht in der Woche — auch zwischen den Aufgaben');
  pruefe(/kpWocheZeileUm\(\d+\)[^>]*>Reifen wechseln/.test(h) && (h.match(/kpWocheSprung\(/g) || []).length === 2,
         'eine selbst geschriebene Aufgabe lässt sich durchstreichen — ohne ↗');
  const zeilen = w.text.split('\n');
  const nrR = zeilen.indexOf('[] Reifen wechseln');
  WK.kpWocheZeileUm(nrR);
  pruefe(w.text.indexOf('[x] Reifen wechseln') >= 0, 'und wird durchgestrichen');

  WK.kpWocheSprung(w.text.split('\n').indexOf('[] Firma anfragen'));
  pruefe(WK.kp.art === 'seite' && WK.kp.id === s.id && WK.kp.hervor === 'Firma anfragen', '↗ öffnet die Quelle');
  pruefe((seiteHtml().match(/id="kpHervor"/g) || []).length === 1, 'die Zeile ist dort hervorgehoben');

  s.text = 'Notiz\n[] Firma anrufen\n[] Lager kündigen';
  WK.kp.art = 'woche'; WK.kp.id = '';
  WK.kpWocheZeileUm(w.text.split('\n').indexOf('[] Firma anfragen'));
  pruefe(w.text.indexOf('[x] Firma anfragen') >= 0 && s.text.indexOf('[x]') < 0, 'umformuliert: Durchstreichen wirkt nur in der Woche, die Quelle bleibt');
  WK.DB.seiten = [];
  WK.seiteZeichnen(true);
  pruefe(!/kpWocheSprung\(/.test(seiteHtml()) && /Lager kündigen/.test(seiteHtml()), 'ohne Quelle bleibt die Aufgabe stehen — ohne ↗');

  frisch();
  const q = WK.kpSeiteAnlegen('liste', 'L', '[] eins');
  WK.kp.art = 'seite'; WK.kp.id = q.id;
  WK.kpEinplanen(0, 'v');
  const w2 = WK.kpWocheFinden(mo);
  w2.text = w2.text.replace('[] eins\n', '');
  pruefe(WK.kpEintragFinden(q.id, 'eins') === null, 'in der Woche gelöscht: die Marke an der Quelle verschwindet');
  WK.kp.art = 'seite'; WK.kp.id = q.id;
  WK.kpEinplanen(0, 's');
  pruefe(w2.eintraege.length === 1 && /## Bringt mich substanziell weiter\n\[\] eins/.test(w2.text), 'und sie lässt sich neu einplanen — ohne verwaisten Eintrag');
  WK.kpAusplanen(mo, w2.eintraege[0].id);
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
  pruefe(/S oder V/.test(seiteHtml()) && /oeffne\('einst',''\)/.test(seiteHtml()), 'eine leere Woche sagt, wo geplant wird — und bietet die Übernahme an');
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
  const s = WK.kpSeiteAnlegen('notiz', 'Telefonat', '[] Unterlagen schicken');
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
  const v = WK.kpSeiteAnlegen('vorhaben', 'Ziel', '');
  pruefe(/oeffne\('seite','/.test(WK.kpAuszeichnen('[[projekt:' + v.id + '|Alt]]')) && /wb-tot/.test(WK.kpAuszeichnen('[[projekt:weg|Alt]]')),
         'Workbench-Verweise führen zur Seite, wenn es sie hier gibt');
  const s = WK.kpSeiteAnlegen('notiz', 'N', '# Titel\n## Abschnitt\nText\n- Punkt\n1. eins\n2. zwei\n---\n| A | B |\n|---|---|\n| [] x | y |\n!skizze:abcdefgh');
  const h = WK.kpAnsichtHtml(s);
  pruefe(/fl-h1/.test(h) && /fl-h2/.test(h) && /fl-punkt/.test(h) && /fl-nr">2\./.test(h) && /fl-trenner/.test(h), 'Überschriften, Punkte, Nummern, Trennlinie');
  pruefe(/fl-tab/.test(h) && /zellenKastenUm\(9,0\)/.test(h), 'Tabellen mit Kästchen in Zellen');
  pruefe(/nur in der Workbench/.test(h), 'eine Skizze verschwindet nicht kommentarlos');
  WK.kp.art = 'seite'; WK.kp.id = s.id;
  WK.zellenKastenUm(9, 0);
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
   9. Übernahme aus der Workbench
   Grund: Vorhaben, Verteilen und Routine müssen genau so entstehen,
   wie es vereinbart ist — und eine zweite Übernahme legt nichts doppelt an.
   ============================================================ */
console.log('\n9. Übernahme aus der Workbench');
if (WK) {
  frisch();
  const mo = WK.kpHeuteMontag();
  const wb = {
    projekte: [{ id: 'p1', name: 'Umzug Büro', status: 'laufend', kontext: 'beruflich', flaeche: 'Bis Ende November.\n\n', ende: '2026-11-30', ordnung: 2 },
               { id: 'p2', name: 'Website', status: 'ruht', flaeche: '', ordnung: 1 }],
    ziele: [{ id: 'z1', name: 'Fit', status: 'erreicht', flaeche: '[[projekt:p1|Umzug]]', zieltermin: '2026-12-31' }],
    themen: [{ id: 't1', name: 'Büro' }, { id: 't2', name: 'Haus' }, { id: 't3', name: 'Leer' }],
    aufgaben: [
      { id: 'a1', titel: 'Firma anfragen', status: 'offen', projektId: 'p1' },
      { id: 'a2', titel: 'Erledigt', status: 'erledigt', projektId: 'p1' },
      { id: 'a3', titel: 'Laufen', status: 'offen', zielId: 'z1' },
      { id: 'a4', titel: 'Reisekosten', status: 'offen', themaId: 't1', kontext: 'beruflich' },
      { id: 'a5', titel: 'Dachrinne', status: 'offen', themaId: 't2' },
      { id: 'a6', titel: 'Lose\nZeile', status: 'offen' },
      { id: 'a7', titel: 'Verloren', status: 'offen', projektId: 'gibtsnicht' },
      { id: 'a8', titel: 'Steuerunterlagen sortieren', status: 'offen', projektId: 'p1', kontext: 'beruflich',
        wiederholung: { takt: 'woche', intervall: 1, tage: [1, 3, 5, 0], tag: 1 } },
      { id: 'a9', titel: 'Blumen', status: 'offen', wiederholung: { takt: 'woche', intervall: 2, tage: [4, 1], tag: 1 } },
      { id: 'a10', titel: 'Miete', status: 'offen', wiederholung: { takt: 'monat', intervall: 1, tage: [], tag: 15 } },
      { id: 'a11', titel: 'Filter', status: 'offen', wiederholung: { takt: 'monat', intervall: 3, tage: [], tag: 1 } },
      { id: 'a12', titel: 'Alt', status: 'erledigt', wiederholung: { takt: 'woche', intervall: 1, tage: [1], tag: 1 } },
      { id: 'a13', titel: 'Weg', status: 'cancelled', themaId: 't1' }
    ],
    gedanken: [
      { id: 'g1', titel: 'Ideen Kundentag', text: 'Termin 21.11.\n[] Raum anfragen' },
      { id: 'g2', titel: '', text: '# Kopf\nmehr' },
      { id: 'g3', titel: 'leer', text: '' },
      { id: 'kw-' + mo, kompass: 'woche', woche: mo, text: '# Woche\n\n## Was diese Woche Substanz schafft\n- Angebot Nord\n- ~~Fertig~~\n- \n\n## Verbindlichkeiten\n1. Becker anrufen' },
      { id: 'L1', kompass: 'liste', titel: 'Lesestapel', text: '- Buch' }
    ]
  };
  const ok1 = WK.kpMigAusText(JSON.stringify(wb), 'Test');
  pruefe(ok1 && WK.kp.mig && WK.kp.art === 'einst', 'eine Workbench-Datei ergibt eine Vorschau in den Einstellungen');
  const p = WK.kp.mig.plan;
  const vh = id => p.vorhaben.seiten.filter(s => s.id === id)[0];
  pruefe(p.vorhaben.seiten.map(s => s.id).join(',') === 'p2,p1,z1', 'Vorhaben in der Reihenfolge der Workbench, Kennung bleibt');
  pruefe(vh('p1').text === 'Bis Ende November.\n\n## Aufgaben\n[] Firma anfragen', 'Vorhaben: erst der Notiztext, dann die offenen Aufgaben als Zeilen');
  pruefe(vh('p2').text === '' && vh('p2').zustand === 'ruht' && vh('z1').zustand === 'erledigt' && vh('p1').zustand === 'laeuft',
         'der Zustand kommt mit: läuft · ruht · erledigt');
  pruefe(vh('z1').text === '[[projekt:p1|Umzug]]\n\n## Aufgaben\n[] Laufen' && vh('z1').typ === 'ziel' && vh('p1').termin === '2026-11-30',
         'Ziele mit ihren Aufgaben; Art und Termin werden gemerkt');
  pruefe(p.vorhaben.aufgaben === 2 && !/Erledigt|Steuer/.test(vh('p1').text), 'erledigte und wiederkehrende Aufgaben stehen nicht im Vorhaben');
  const vt = p.verteilen.seiten.filter(x => x.id === 'wb-verteilen-privat')[0];
  const vb = p.verteilen.seiten.filter(x => x.id === 'wb-verteilen-beruf')[0];
  pruefe(vt && vt.titel === 'Verteilen · Privat' && vt.kontext === 'privat' && vt.art === 'liste'
         && vb && vb.titel === 'Verteilen · Beruf' && vb.kontext === 'beruflich', '„Verteilen“ je für Beruf und Privat');
  pruefe(vt.text === '## Haus\n[] Dachrinne\n\n## Ohne Liste\n[] Lose Zeile\n[] Verloren',
         'Verteilen: alle Aufgaben ohne Vorhaben, mit dem Listennamen als Überschrift — leere Listen ohne Überschrift');
  pruefe(vb.text === '## Büro\n[] Reisekosten', 'die Zuordnung kommt von der einzelnen Aufgabe');
  const rt = p.routine.seiten.filter(x => x.id === 'wb-routine-privat')[0];
  const rb = p.routine.seiten.filter(x => x.id === 'wb-routine-beruf')[0];
  pruefe(rt && rt.titel === 'Routine · Privat' && rb && rb.titel === 'Routine · Beruf', '„Routine“ je für Beruf und Privat');
  pruefe(rt.text === 'Blumen\nalle 2 Wochen: Mo, Do\n\nMiete\nmonatlich am 15.\n\nFilter\nalle 3 Monate am 1.'
         && rb.text === 'Steuerunterlagen sortieren\nMo, Mi, Fr, So',
         'Routine: Name und darunter die Frequenz — auch aus Vorhaben, ohne beendete');
  pruefe(WK.kpFrequenz({ typ: 'woechentlich', intervall: 1, wochentage: [7, 2] }) === 'Di, So', 'auch die alte Schreibweise der Wiederholung');
  pruefe(p.notizen.seiten.map(s => s.titel).join('|') === 'Ideen Kundentag|Kopf', 'freie Notizen — ohne Titel heißt sie wie ihre erste Zeile, leere fallen weg');
  pruefe(p.listen.seiten.length === 1 && p.listen.seiten[0].id === 'L1', 'Listen aus Kompass 1.0');
  const ww = p.wochen.wochen[0];
  pruefe(ww && ww.montag === mo && ww.eintraege.length === 3 && ww.eintraege[0].abschnitt === 's' && ww.eintraege[1].erledigt === true
         && ww.eintraege[1].text === 'Fertig' && ww.eintraege[2].abschnitt === 'v' && ww.eintraege[2].text === 'Becker anrufen',
         'Wochen aus Kompass 1.0: Substanz und Verbindlichkeiten, Durchgestrichenes erledigt, leere Punkte weg');
  WK.seiteZeichnen(true);
  const hv = seiteHtml();
  pruefe(/kpMigAusfuehren\(\)/.test(hv) && (hv.match(/kpMigWahlUm\(/g) || []).length === 6, 'die Vorschau zeigt alle Teile zum Abwählen');
  WK.kpMigWahlUm('notizen');
  const z = WK.kpMigAusfuehren();
  pruefe(z.seiten === 3 + 2 + 2 + 1 && z.wochen === 1 && WK.kp.mig === null, 'übernommen wird, was gewählt ist — Notizen abgewählt');
  pruefe(!WK.kpSeiteFinden('g1') && WK.kpSeiteFinden('p1').art === 'vorhaben' && WK.kpSeiteFinden('wb-routine-beruf'), 'die Seiten stehen im Kompass');
  pruefe(WK.kpSeiteFinden('p1').kontext === 'beruflich' && WK.kpSeiteFinden('p2').kontext === '', 'Beruf/Privat kommt mit — ohne Angabe bleibt es offen');
  pruefe(WK.kpOffeneZahl(WK.kpSeiteFinden('wb-verteilen-privat')) === 3, 'die übernommenen Aufgaben sind offene Aufgaben im Kompass');
  WK.kpMigAusText(JSON.stringify(wb), 'Test');
  const z2 = WK.kpMigAusfuehren();
  pruefe(z2.seiten === 2 && z2.wochen === 0, 'eine zweite Übernahme legt nur an, was noch fehlt (hier die Notizen)');
  pruefe(WK.DB.seiten.length === 10, 'keine Doppelten');
  pruefe(/\[x\] Fertig/.test(WK.kpWocheFinden(mo).text) && /## Verbindlichkeiten\n\[\] Becker anrufen/.test(WK.kpWocheFinden(mo).text),
         'eine Woche aus Kompass 1.0 kommt als Text an');
  pruefe(WK.kpMigAusText('{"x":1}', 'Test') === false && WK.kpMigAusText('kein json', 'Test') === false, 'fremde Dateien werden abgewiesen');
  pruefe(Array.isArray(wb.aufgaben) && wb.aufgaben.length === 13 && wb.projekte[0].flaeche === 'Bis Ende November.\n\n', 'die Workbench-Daten bleiben unverändert');
  WK.kp.art = 'einst';
  WK.seiteZeichnen(true);
  const he = seiteHtml();
  pruefe(/kpMigDrive\(\)/.test(he) && /onchange="kpMigDatei\(this\)"/.test(he) && /kpMigGeraet\(\)/.test(he), 'drei Quellen: Drive, Datei, Kompass 1.0 auf dem Gerät');
}

/* ============================================================
   10. Löschen und Rückgängig
   ============================================================ */
console.log('\n10. Löschen und Rückgängig');
if (WK) {
  frisch();
  const s = WK.kpSeiteAnlegen('liste', 'Weg damit', '[] a');
  WK.kp.art = 'seite'; WK.kp.id = s.id;
  WK.kpEinplanen(0, 's');
  WK.kp.art = 'seite'; WK.kp.id = s.id;
  WK.kpLoeschen();
  pruefe(!WK.kpSeiteFinden(s.id) && WK.DB.grabsteine.some(g => g.s === 'seiten' && g.id === s.id), 'gelöscht mit Löschvermerk');
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
  const a = WK.kpSeiteAnlegen('liste', 'Offen', '');
  WK.kpFilterSetzen('beruflich');
  const b = WK.kpSeiteAnlegen('vorhaben', 'Angebot Nord', '');
  WK.kpFilterSetzen('privat');
  const c = WK.kpSeiteAnlegen('notiz', 'Garten', '');
  pruefe(a.kontext === '' && b.kontext === 'beruflich' && c.kontext === 'privat', 'eine neue Seite bekommt den gerade gewählten Filter');
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
  const s = WK.kpSeiteAnlegen('vorhaben', 'Umzug', 'Erste Zeile\n\n[] Firma anfragen\n[] Lager kündigen');
  WK.kp.art = 'seite'; WK.kp.id = s.id;
  WK.kpEinplanen(3, 'v');
  const mo = WK.kpHeuteMontag();
  WK.kp.art = 'woche'; WK.kp.id = '';
  WK.kpWocheSprung(WK.kpWocheFinden(mo).text.split('\n').indexOf('[] Lager kündigen'));
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
   15. Übernahme nach 2.0: nachtragen statt doppelt anlegen
   Grund: Wer mit 2.0 schon übernommen hat, bekommt Beruf/Privat
   nachgetragen — und „Verteilen“ steht nicht doppelt da.
   ============================================================ */
console.log('\n15. Übernahme nach 2.0');
if (WK) {
  frisch();
  WK.DB.seiten.push({ id: 'p1', art: 'vorhaben', titel: 'Umzug', text: 'eigener Text', rang: 1, zustand: 'laeuft', geaendert: 1 });
  WK.DB.seiten.push({ id: 'wb-verteilen', art: 'liste', titel: 'Verteilen', text: '[] a', rang: 2, geaendert: 1 });
  const wb = { projekte: [{ id: 'p1', name: 'Umzug', kontext: 'beruflich', flaeche: 'alt' }],
               aufgaben: [{ id: 'a', titel: 'a', status: 'offen', kontext: 'privat' }, { id: 'r', titel: 'R', status: 'offen', wiederholung: { takt: 'woche', intervall: 1, tage: [1] } }] };
  WK.kpMigAusText(JSON.stringify(wb), 'Test');
  WK.seiteZeichnen(true);
  pruefe(/ungeteilte Liste aus 2\.0 besteht noch/.test(seiteHtml()), 'die Vorschau sagt, dass „Verteilen“ aus 2.0 noch besteht');
  const z = WK.kpMigAusfuehren();
  pruefe(WK.kpSeiteFinden('p1').kontext === 'beruflich' && WK.kpSeiteFinden('p1').text === 'eigener Text' && z.kontext === 1,
         'Beruf/Privat wird nachgetragen — der eigene Text bleibt');
  pruefe(!WK.kpSeiteFinden('wb-verteilen-privat') && z.alt === 1, 'neben dem alten „Verteilen“ entsteht kein zweites');
  pruefe(!!WK.kpSeiteFinden('wb-routine-privat'), 'ohne alte „Routine“ wird sie geteilt angelegt');
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
  const n = WK.kpSeiteAnlegen('notiz', 'Geheime Notiz', '[] a\n[] b');
  const r = WK.kpSeiteAnlegen('vorhaben', 'Ruhendes', '');
  r.zustand = 'ruht';
  const f = WK.kpSeiteAnlegen('vorhaben', 'Fertiges', '');
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
  const a = WK.kpSeiteAnlegen('liste', 'A', '');
  const b = WK.kpSeiteAnlegen('vorhaben', 'V1', '');
  const c = WK.kpSeiteAnlegen('liste', 'B', '');
  const d = WK.kpSeiteAnlegen('liste', 'C', '');
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
  const g1 = WK.kpSeiteAnlegen('notiz', 'N1', ''); g1.rang = 5;
  const g2 = WK.kpSeiteAnlegen('notiz', 'N2', ''); g2.rang = 5;
  pruefe(WK.kpVerschieben(g2.id, g1.id, 'vor') && namen('notiz') === 'N2,N1', 'auch alte Daten mit gleichem Rang lassen sich sortieren');
  WK.kp.art = 'seite'; WK.kp.id = b.id;
  const v2 = WK.kpSeiteAnlegen('vorhaben', 'V2', '');
  const v3 = WK.kpSeiteAnlegen('vorhaben', 'V3', '');
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
  const s = WK.kpSeiteAnlegen('liste', 'Büro', '[] Anrufen\n[] Offering beschreiben');
  WK.kp.art = 'seite'; WK.kp.id = s.id;
  WK.kpEinplanen(1, 'v');
  const mo = WK.kpHeuteMontag();
  const w = WK.kpWocheFinden(mo);
  w.text = w.text.replace('[] Offering beschreiben', '[] Offering beschreiben (Fr)');
  WK.kp.art = 'woche'; WK.kp.id = ''; WK.kp.modus = 'ansicht';
  WK.seiteZeichnen(true);
  pruefe(/kpWocheSprung\(/.test(seiteHtml()), 'in der Woche um „(Fr)“ ergänzt: ↗ bleibt');
  const nr = w.text.split('\n').indexOf('[] Offering beschreiben (Fr)');
  WK.kpWocheZeileUm(nr);
  pruefe(/\[x\] Offering beschreiben \(Fr\)/.test(w.text) && /\[x\] Offering beschreiben$/.test(s.text), 'Durchstreichen hakt die Quelle weiter ab');
  WK.kpWocheZeileUm(nr);
  WK.kp.art = 'seite'; WK.kp.id = s.id;
  pruefe(WK.kpEintragFinden(s.id, 'Offering beschreiben') !== null, 'an der Quelle bleibt die Marke „KW“');
  s.text = '[] Anrufen\n[] Offering beschreiben – Entwurf an Jana';
  pruefe(WK.kpEintragFinden(s.id, 'Offering beschreiben – Entwurf an Jana') !== null, 'auch in der Quelle darf hinten etwas dazukommen');
  WK.kpKastenUm(1);
  pruefe(/\[x\] Offering beschreiben \(Fr\)/.test(w.text), 'abhaken in der Quelle streicht die ergänzte Zeile in der Woche durch');
  WK.kpKastenUm(1);
  WK.kp.art = 'woche'; WK.kp.id = '';
  WK.kpWocheSprung(nr);
  pruefe(WK.kp.art === 'seite' && /id="kpHervor"[^>]*>|class="fl-zeile aufgabe hervor" id="kpHervor"/.test(seiteHtml())
         && (seiteHtml().match(/id="kpHervor"/g) || []).length === 1, '↗ hebt die ergänzte Zeile in der Quelle hervor');
  frisch();
  const q = WK.kpSeiteAnlegen('liste', 'L', '[] Anrufen\n[] Anrufen Becker');
  WK.kp.art = 'seite'; WK.kp.id = q.id;
  WK.kpEinplanen(0, 's');
  WK.kp.art = 'seite'; WK.kp.id = q.id;
  WK.kpEinplanen(1, 's');
  const w2 = WK.kpWocheFinden(mo);
  pruefe(w2.eintraege.length === 2, '„Anrufen Becker“ ist nicht schon durch „Anrufen“ eingeplant');
  const nrB = w2.text.split('\n').indexOf('[] Anrufen Becker');
  WK.kp.art = 'woche'; WK.kp.id = '';
  WK.kpWocheZeileUm(nrB);
  pruefe(/\[x\] Anrufen Becker/.test(q.text) && /\[\] Anrufen$/m.test(q.text), 'wörtlich gleiche Zeilen gehen vor — die richtige wird abgehakt');
  pruefe(WK.kpWocheEintrag(w2, 'Anrufen Becker').text === 'Anrufen Becker', 'zur Zeile gehört der genaueste Eintrag');
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
