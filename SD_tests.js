/* ============================================================
   SD_tests.js — Regressionstests für den Schreibtisch
   Aufruf:  node SD_tests.js [schreibtisch-beruf.html] [schreibtisch.html]

   Der erste Pfad ist die berufliche Fassung und wird immer geprüft.
   Der zweite ist die private; fehlt er, werden die Prüfungen, die
   beide Fassungen vergleichen, als „warn“ übersprungen.

   Die Kategorien folgen den Abnahmekriterien SD-01 bis SD-13 aus der
   Spezifikation. SD-14 ist dazugekommen: die berufliche Fassung darf
   keinen Cloud-Code enthalten.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATEI = process.argv[2] || path.join(__dirname, 'schreibtisch-beruf.html');
const PRIVAT_DATEI = process.argv[3] || path.join(path.dirname(path.resolve(DATEI)), 'schreibtisch.html');

if (!fs.existsSync(DATEI)) {
  console.log('FEHLER: Datei nicht gefunden: ' + DATEI);
  process.exit(1);
}

const QUELLE = fs.readFileSync(DATEI, 'utf8');
const PRIVAT_QUELLE = fs.existsSync(PRIVAT_DATEI) ? fs.readFileSync(PRIVAT_DATEI, 'utf8') : '';

let anzOk = 0, anzFail = 0, anzWarn = 0;
function ok(text) { console.log('  ok   ' + text); anzOk++; }
function fail(text) { console.log('  FAIL ' + text); anzFail++; }
function warn(text) { console.log('  warn ' + text); anzWarn++; }
function pruefe(bedingung, text) { if (bedingung) { ok(text); } else { fail(text); } }

function letztesSkript(text) {
  const b = text.match(/<script>[\s\S]*?<\/script>/g) || [];
  return b.length ? b[b.length - 1].replace(/^<script>/, '').replace(/<\/script>$/, '') : '';
}
const SKRIPT = letztesSkript(QUELLE);

/* ------------------------------------------------------------
   Eine schlanke Umgebung: genug DOM, damit das Skript läuft und
   man den erzeugten HTML-Text ansehen kann.
   ------------------------------------------------------------ */
function umgebung(breite) {
  const elemente = {};
  function element(id) {
    const kinder = [];
    return {
      id: id, innerHTML: '', textContent: '', value: '', className: '', hidden: false,
      style: {}, files: null, type: '', accept: '', href: '', download: '',
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener() {}, removeEventListener() {}, focus() {}, blur() {}, click() {},
      appendChild(k) { kinder.push(k); }, removeChild() {}, setAttribute() {},
      getAttribute() { return null; }, closest() { return null; },
      querySelector() { return null; }, querySelectorAll() { return []; }
    };
  }
  const ablage = {};
  const speicher = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(ablage, k) ? ablage[k] : null; },
    setItem(k, v) { ablage[k] = String(v); }, removeItem(k) { delete ablage[k]; }
  };
  const koerper = element('body');
  koerper.className = 'b-weit';
  const ctx = {
    /* self und top gehören dazu: sdImRahmen vergleicht sie. Fehlen beide,
       wäre der Vergleich undefined !== undefined und die Rahmenprüfung
       liefe zufällig richtig, statt geprüft zu werden. */
    console, Promise, Date, Math, JSON, Object, Array, String, Number, RegExp, Error, Boolean,
    isNaN, isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
    localStorage: speicher, sessionStorage: speicher, indexedDB: null,
    innerWidth: breite || 1280, innerHeight: 900,
    location: { protocol: 'file:', hash: '', search: '', href: 'file:///test' },
    matchMedia() { return { matches: false, addEventListener() {} }; },
    fetch() { return Promise.reject(new Error('kein Netz im Test')); },
    addEventListener() {}, removeEventListener() {}, open() { return null; },
    URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    Blob: function () { return {}; },
    navigator: { onLine: true },
    document: {
      title: '', hidden: false,
      getElementById(id) { if (!elemente[id]) { elemente[id] = element(id); } return elemente[id]; },
      querySelector() { return null; }, querySelectorAll() { return []; },
      createElement() { return element('neu'); },
      head: { appendChild() {} },
      body: koerper,
      documentElement: { style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} } },
      addEventListener() {}
    }
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.self = ctx;
  ctx.top = ctx;
  vm.createContext(ctx);
  return ctx;
}

function ladeIn(skript, name, breite) {
  const ctx = umgebung(breite);
  try {
    vm.runInContext(skript, ctx, { filename: name });
    return ctx;
  } catch (e) {
    fail(name + ' ließ sich nicht auswerten: ' + e.message);
    return null;
  }
}

const SD = ladeIn(SKRIPT, path.basename(DATEI), 1280);
if (!SD) {
  console.log('\nERGEBNIS: Abbruch, das Skript läuft nicht.');
  process.exit(1);
}

function frisch() {
  SD.DB = SD.sdLeer();
  SD.sd.sicht = 'tisch';
  SD.sd.fachId = '';
  SD.sd.seiteId = '';
  SD.sd.bearbeiten = false;
  SD.sd.fenster = null;
  SD.document.body.className = 'b-weit';
}
function flaeche() { return SD.document.getElementById('flaeche').innerHTML; }
function mappe() { return SD.document.getElementById('mappe').innerHTML; }
function planung() { return SD.document.getElementById('planung').innerHTML; }

/* ============================================================
   0. Aufbau der Datei
   ============================================================ */
console.log('\n0. Aufbau der Datei');
{
  const ohneSkript = QUELLE.replace(/<script>[\s\S]*?<\/script>/g, '');
  const auf = (ohneSkript.match(/<div\b/g) || []).length;
  const zu = (ohneSkript.match(/<\/div>/g) || []).length;
  pruefe(auf === zu, 'DIV-Balance stimmt (' + auf + '/' + zu + ')');
  try { new vm.Script(SKRIPT); ok('das Skript ist syntaktisch korrekt'); }
  catch (e) { fail('Syntaxfehler im Skript: ' + e.message); }

  const fassung = (SKRIPT.match(/var SD_FASSUNG = '([\d.]+)';/) || [])[1];
  const titel = (QUELLE.match(/<title>Schreibtisch ([\d.]+) (\w+)<\/title>/) || []);
  pruefe(!!fassung && fassung === titel[1],
    'die Fassung steht gleich im Titel und in SD_FASSUNG (' + fassung + ')');
  pruefe(titel[2] === 'Beruf' || titel[2] === 'Privat',
    'der Titel nennt die Welt im Hauptfenster (' + (titel[2] || '—') + ')');
  pruefe(!/__FASSUNG__|__VERSION__|__SKRIPT__/.test(QUELLE), 'keine Platzhalter mehr in der Datei');

  const fns = [...SKRIPT.matchAll(/\nfunction (\w+)\s*\(/g)].map(m => m[1]);
  const doppelt = [...new Set(fns.filter((f, i) => fns.indexOf(f) !== i))];
  pruefe(doppelt.length === 0,
    'keine doppelt definierten Funktionen' + (doppelt.length ? ' — gefunden: ' + doppelt.join(', ') : ''));

  /* Aufrufe ins Leere: im Code und in den Bedienelementen der Hülle */
  const innere = [...SKRIPT.matchAll(/\n[ \t]+function (\w+)\s*\(/g)].map(m => m[1]);
  const definiert = new Set(fns.concat(innere));
  const vars = new Set([...SKRIPT.matchAll(/\bvar\s+(\w+)/g)].map(m => m[1]));
  /* Auch Parameter sind benannt und dürfen gerufen werden — etwa die beiden
     Auflöser eines Promise. Ohne sie meldet der Prüfer sie als Ruf ins Leere. */
  [...SKRIPT.matchAll(/\bfunction\s*\w*\s*\(([^)]*)\)/g)].forEach(m => {
    m[1].split(',').map(t => t.trim()).filter(Boolean).forEach(t => vars.add(t));
  });
  const bekannt = new Set(('if for while switch return function typeof catch new String Number Boolean '
    + 'Array Object JSON Math Date RegExp Error Promise parseInt parseFloat isNaN isFinite '
    + 'encodeURIComponent decodeURIComponent setTimeout clearTimeout setInterval clearInterval '
    + 'fetch Blob URL indexedDB').split(' '));
  const ohne = SKRIPT.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const code = ohne.replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
  const fremdCode = [...new Set([...code.matchAll(/(^|[^.\w$])([A-Za-z_]\w*)\s*\(/g)].map(m => m[2]))]
    .filter(n => !definiert.has(n) && !vars.has(n) && !bekannt.has(n));
  pruefe(fremdCode.length === 0,
    'der Code ruft nur Funktionen, die es gibt' + (fremdCode.length ? ' — fehlt: ' + fremdCode.join(', ') : ''));

  const griffe = [...ohne.matchAll(/on(?:click|dblclick|input|change|keydown)=\\?["']([A-Za-z_]\w*)\(/g)].map(m => m[1])
    .concat([...ohneSkript.matchAll(/on(?:click|dblclick|input|change|keydown)="([A-Za-z_]\w*)\(/g)].map(m => m[1]));
  const fremd = [...new Set(griffe)].filter(a => !definiert.has(a) && a !== 'event');
  pruefe(fremd.length === 0,
    'Bedienelemente rufen nur Funktionen, die es gibt' + (fremd.length ? ' — fehlt: ' + fremd.join(', ') : ''));
}

/* ============================================================
   SD-01  Der Tisch zeigt zwei Reihen: eigene Fächer und Zusammenarbeit
   ============================================================ */
console.log('\nSD-01  Zwei Reihen auf dem Tisch');
{
  frisch();
  SD.sdFachNeu('Testmanagement', 'eigen', '#3B8EDE', 'onenote:///Test', 'Arbeit');
  SD.sdFachNeu('Projekt Nord', 'zusammen', '#85C440', 'https://x.example/n', 'Team');
  SD.zeichne();
  const h = flaeche();
  pruefe(/Eigene Fächer/.test(h), 'die Reihe „Eigene Fächer“ steht auf dem Tisch');
  pruefe(/Zusammenarbeit/.test(h), 'die Reihe „Zusammenarbeit“ steht auf dem Tisch');
  pruefe(h.indexOf('Eigene Fächer') < h.indexOf('Zusammenarbeit'), 'die eigenen Fächer stehen zuerst');
  pruefe(/Testmanagement/.test(h) && /Projekt Nord/.test(h), 'beide Fächer werden gezeigt');
  pruefe(SD.sdFaecher('eigen').length === 1 && SD.sdFaecher('zusammen').length === 1,
    'jedes Fach liegt in seiner Reihe');
  pruefe(/class="trenner"/.test(h), 'zwischen den Reihen liegt eine Trennlinie');
}

/* ============================================================
   SD-02  Ein Fach ist ein liegender Stapel mit Farbreiter und Namen
   ============================================================ */
console.log('\nSD-02  Der Stapel: Farbreiter, Name, Herkunft');
{
  frisch();
  SD.sdFachNeu('Testmanagement', 'eigen', '#3B8EDE', '', 'Arbeitsnotizbuch');
  SD.zeichne();
  const h = flaeche();
  pruefe(/class="lager"/.test(h), 'der Stapel hat ein Lager für die Blätter');
  pruefe((h.match(/class="lage"/g) || []).length === 4, 'der Stapel liegt mit vier Blättern');
  pruefe(/class="reiter" style="background:#3B8EDE"/.test(h), 'der Reiter trägt die Farbe des Abschnitts');
  pruefe(/class="name">Testmanagement</.test(h), 'der Name steht unter dem Stapel');
  pruefe(/class="wohin">Arbeitsnotizbuch</.test(h), 'das Notizbuch steht als Herkunft dabei');
  /* Keine Zähler, keine Abzeichen — ausdrücklich nicht gewollt */
  pruefe(!/Verweise?<|badge|zaehler|Zähler/i.test(h), 'keine Zähler und keine Abzeichen am Stapel');
}

/* ============================================================
   SD-03  Ein Fach wählen zeigt seine Verweise
   ============================================================ */
console.log('\nSD-03  Fach wählen zeigt die Verweise');
{
  frisch();
  const f = SD.sdFachNeu('Testmanagement', 'eigen', '#3B8EDE', 'onenote:///Test', '');
  SD.zeichne();
  pruefe(/Ein Fach antippen/.test(mappe()), 'ohne Wahl steht in der Mappe ein ruhiger Hinweis');
  SD.sdFachWaehlen(f.id);
  const m = mappe();
  pruefe(/Testmanagement/.test(m), 'die Mappe nennt das gewählte Fach');
  pruefe(/Aufgaben/.test(m) && /Offene Fragen/.test(m) && /Erkenntnisse/.test(m),
    'die Mappe zeigt die drei Verweise des Faches');
  pruefe(/class="fleck" style="background:#3B8EDE"/.test(m), 'die Mappe trägt die Farbe des Faches');
  pruefe(/gewaehlt/.test(flaeche()), 'der gewählte Stapel ist auf dem Tisch hervorgehoben');
  pruefe(/Abschnitt öffnen/.test(m), 'die Mappe bietet den Weg in den Abschnitt');
}

/* ============================================================
   SD-04  Dritte Ebene: Seiten des Faches, Unterseiten klappen auf
   ============================================================ */
console.log('\nSD-04  Seiten und Unterseiten');
{
  frisch();
  const f = SD.sdFachNeu('Testmanagement', 'eigen', '#3B8EDE', '', '');
  const s = SD.sdSeiteNeu(f, 'Teststrategie', 'onenote:///Strategie');
  SD.sdSeiteNeu(f, 'Testdaten', '');
  SD.sdUnterNeu(s, 'Risikoklassen', 'onenote:///Risiko');
  SD.sdFachOeffnen(f.id);
  let h = flaeche();
  pruefe(/class="fachkopf"/.test(h), 'die Fachansicht hat einen eigenen Kopf');
  pruefe(/Teststrategie/.test(h) && /Testdaten/.test(h), 'beide Seiten des Faches werden gezeigt');
  pruefe((h.match(/class="seite/g) || []).length >= 2, 'jede Seite ist ein eigenes Blatt');
  pruefe(/seite leer/.test(h), 'eine Seite ohne Link bleibt blass');
  pruefe(!/Risikoklassen/.test(h), 'die Unterseiten sind zunächst zugeklappt');
  SD.sdSeiteUm(s.id);
  h = flaeche();
  pruefe(/Risikoklassen/.test(h), 'ein Tipp auf die Seite klappt ihre Unterseiten auf');
  pruefe(/Seite öffnen/.test(h), 'die aufgeklappte Seite bietet den Weg nach OneNote');
  SD.sdSeiteUm(s.id);
  pruefe(!/Risikoklassen/.test(flaeche()), 'noch ein Tipp klappt wieder zu');
  pruefe(/zurück zum Tisch/.test(flaeche()), 'aus der Fachansicht führt ein Weg zurück');
  SD.sdZumTisch();
  pruefe(/Eigene Fächer/.test(flaeche()), 'der Weg zurück landet auf dem Tisch');
}

/* ============================================================
   SD-05  Jedes Fach hat die Leiste „Immer dabei“
   ============================================================ */
console.log('\nSD-05  Immer dabei: Aufgaben, Offene Fragen, Erkenntnisse');
{
  frisch();
  const f = SD.sdFachNeu('Neues Fach', 'eigen', '#E8A33D', '', '');
  const namen = f.leiste.map(p => p.name);
  pruefe(namen.length === 3, 'ein neues Fach bekommt genau drei Verweise');
  pruefe(namen.join('|') === 'Aufgaben|Offene Fragen|Erkenntnisse',
    'es sind Aufgaben, Offene Fragen, Erkenntnisse — in dieser Reihenfolge');
  pruefe(f.leiste.every(p => p.link === ''), 'die drei kommen ohne Link und werden nachgetragen');
  pruefe(f.leiste.every(p => !!p.id), 'jeder Verweis hat eine eigene Kennung');
  SD.sdFachOeffnen(f.id);
  pruefe(/Immer dabei/.test(flaeche()), 'die Fachansicht zeigt die Leiste unter den Seiten');
  const g = SD.sdFachNeu('Zweites Fach', 'zusammen', '#9B6BC9', '', '');
  pruefe(g.leiste[0].id !== f.leiste[0].id, 'zwei Fächer teilen sich keine Verweise');
}

/* ============================================================
   SD-06  Bearbeiten: anlegen, ändern, sortieren, entfernen
   ============================================================ */
console.log('\nSD-06  Bearbeiten-Modus');
{
  frisch();
  SD.zeichne();
  pruefe(/Bearbeiten/.test(planung()), 'der Schalter „Bearbeiten“ steht in der Planungsleiste');
  pruefe(!/Fach anlegen/.test(flaeche()), 'ohne Bearbeiten gibt es keine Werkzeuge');
  SD.sdBearbeitenUm();
  pruefe(/Fertig/.test(planung()), 'eingeschaltet heißt der Schalter „Fertig“');
  pruefe(/Fach anlegen/.test(flaeche()), 'eingeschaltet erscheinen die Werkzeuge');
  pruefe(/bearbeiten/.test(SD.document.body.className), 'der Körper trägt die Klasse bearbeiten');

  const f = SD.sdFachNeu('Eins', 'eigen', '#3B8EDE', '', '');
  SD.sdSeiteNeu(f, 'A', '');
  SD.sdSeiteNeu(f, 'B', '');
  SD.sdSeiteNeu(f, 'C', '');
  pruefe(SD.sdSchieben(f.seiten, f.seiten[2].id, -1) === true, 'eine Seite lässt sich höher schieben');
  pruefe(f.seiten.map(s => s.name).join('') === 'ACB', 'das Schieben vertauscht genau zwei Stellen');
  pruefe(SD.sdSchieben(f.seiten, f.seiten[0].id, -1) === false, 'die oberste lässt sich nicht weiter hoch');
  pruefe(SD.sdSchieben(f.seiten, f.seiten[2].id, 1) === false, 'die unterste lässt sich nicht weiter runter');
  pruefe(SD.sdEntfernen(f.seiten, f.seiten[1].id) === true && f.seiten.length === 2,
    'eine Seite lässt sich entfernen');
  pruefe(SD.sdEntfernen(f.seiten, 'gibtsnicht') === false, 'was es nicht gibt, wird nicht entfernt');

  SD.sdFachOeffnen(f.id);
  const h = flaeche();
  pruefe(/class="steller"/.test(h), 'im Bearbeiten-Modus stehen die Steller neben den Einträgen');
  pruefe((h.match(/steller/g) || []).length >= 2, 'jeder Eintrag bekommt seine eigenen Steller');
  SD.sdBearbeitenUm();
  pruefe(!/class="steller"/.test(flaeche()), 'ausgeschaltet sind die Steller wieder weg');
}

/* ============================================================
   SD-07  Die Planungsleiste oben
   ============================================================ */
console.log('\nSD-07  Planungsleiste');
{
  frisch();
  SD.DB.planung = [];
  SD.sdPlanungSichern();
  const namen = SD.DB.planung.map(p => p.name);
  pruefe(namen.length === 5, 'die Planungsleiste bringt fünf Einträge mit');
  pruefe(namen.join('|') === 'Woche|Erinnerungen|Stundenplan|Block|Meetings',
    'es sind Woche, Erinnerungen, Stundenplan, Block, Meetings');
  SD.zeichne();
  const p = planung();
  pruefe(/Woche/.test(p) && /Meetings/.test(p), 'die Einträge stehen oben in der Leiste');
  pruefe(/class="ohne"/.test(p), 'ein Eintrag ohne Link ist als solcher zu erkennen');
  /* Einmal gefüllt, wird nicht wieder überschrieben */
  SD.DB.planung = [{ id: 'pl-x', name: 'Nur einer', link: '' }];
  SD.sdPlanungSichern();
  pruefe(SD.DB.planung.length === 1, 'eine vorhandene Planungsleiste wird nicht überschrieben');
}

/* ============================================================
   SD-08  Nur onenote: und https: werden gespeichert
   ============================================================ */
console.log('\nSD-08  Links werden geprüft');
{
  pruefe(SD.sdLinkOk('onenote:///C:/x/Notizbuch') === true, 'onenote: ist erlaubt');
  pruefe(SD.sdLinkOk('OneNote:https://x') === true, 'onenote: auch groß geschrieben');
  pruefe(SD.sdLinkOk('https://meinefirma.sharepoint.com/x') === true, 'https: ist erlaubt');
  pruefe(SD.sdLinkOk('') === true, 'leer ist erlaubt — der Link wird später nachgetragen');
  pruefe(SD.sdLinkOk('   ') === true, 'nur Leerzeichen gilt als leer');
  pruefe(SD.sdLinkOk('http://unsicher.example') === false, 'http: wird abgelehnt');
  pruefe(SD.sdLinkOk('javascript:alert(1)') === false, 'javascript: wird abgelehnt');
  pruefe(SD.sdLinkOk('file:///C:/geheim.txt') === false, 'file: wird abgelehnt');
  pruefe(SD.sdLinkOk('data:text/html,<b>x') === false, 'data: wird abgelehnt');
  pruefe(SD.sdLinkOk('einfach text') === false, 'freier Text wird abgelehnt');
  pruefe(SD.sdLinkOk('https://') === false, 'https ohne Ziel wird abgelehnt');
  /* Namen und Links werden beim Zeichnen entschärft */
  frisch();
  SD.sdFachNeu('<script>böse</script>', 'eigen', '#3B8EDE', '', '');
  SD.zeichne();
  pruefe(!/<script>böse/.test(flaeche()), 'spitze Klammern in Namen werden entschärft');
}

/* ============================================================
   SD-09  Die Ablage: eine Datei, und nichts geht von selbst ins Netz
   ============================================================ */
console.log('\nSD-09  Ablage auf dem Rechner');
{
  frisch();
  SD.sdFachNeu('Testmanagement', 'eigen', '#3B8EDE', 'onenote:///T', 'Arbeit');
  const text = SD.sdAlsText();
  const wieder = SD.sdAusText(text);
  pruefe(!!wieder && wieder.faecher.length === 1, 'der Bestand überlebt Schreiben und Lesen');
  pruefe(wieder.faecher[0].name === 'Testmanagement', 'die Namen bleiben erhalten');
  pruefe(wieder.fassung === SD.SD_DATEI_FASSUNG, 'die Datei trägt ihre Fassung');
  pruefe(SD.sdAusText('kein json') === null, 'eine kaputte Datei wird erkannt, nicht übernommen');
  pruefe(SD.sdAusText('null') === null, 'leeres JSON wird erkannt');
  const halb = SD.sdAusText('{"faecher":[{"id":"x","name":"X"}]}');
  pruefe(!!halb && Array.isArray(halb.faecher[0].seiten) && Array.isArray(halb.faecher[0].leiste),
    'eine unvollständige Datei wird ergänzt, nicht abgewiesen');
  pruefe(Array.isArray(halb.planung), 'auch eine fehlende Planungsleiste wird ergänzt');
  SD.zeichne();
  pruefe(/Datei öffnen|Datei laden/.test(mappe()), 'die Ablage bietet einen Weg zu einer Datei');
}

/* ============================================================
   SD-10  Drei Breiten: PC, Pixel, schmal
   ============================================================ */
console.log('\nSD-10  Breiten');
{
  frisch();
  pruefe(SD.sdBreite(1280) === 'weit', 'am PC ist die Ansicht weit');
  pruefe(SD.sdBreite(1024) === 'weit', 'auf dem Tablet quer noch weit');
  pruefe(SD.sdBreite(412) === 'schmal', 'auf dem Pixel ist sie schmal');
  pruefe(SD.sdBreite(360) === 'schmal', 'auf schmalen Geräten ebenso');
  pruefe(SD.sdBreite(819) === 'schmal' && SD.sdBreite(820) === 'weit',
    'die Grenze liegt bei ' + SD.SD_SCHMAL + ' Pixeln');

  const f = SD.sdFachNeu('Testmanagement', 'eigen', '#3B8EDE', 'onenote:///T', '');
  /* zeichne() holt die Breite selbst aus dem Fenster — also das Fenster ändern,
     nicht die Klasse am Körper, sonst prüft der Test an der App vorbei. */
  SD.innerWidth = 412;
  SD.sd.fachId = '';
  SD.zeichne();
  pruefe(mappe() === '', 'schmal gibt es keine Mappe an der Seite');
  SD.sdFachWaehlen(f.id);
  const h = flaeche();
  pruefe(/class="aufklapp"/.test(h), 'schmal klappen die Verweise unter dem Fach auf');
  pruefe(/Aufgaben/.test(h), 'die drei Verweise stehen im Aufklapp');
  pruefe(/Seiten</.test(h), 'der Weg zu den Seiten steht im Aufklapp');
  SD.sdFachWaehlen(f.id);
  pruefe(!/class="aufklapp"/.test(flaeche()), 'noch ein Tipp klappt schmal wieder zu');
  SD.innerWidth = 1280;
  SD.sdFachWaehlen(f.id);
  SD.zeichne();
  pruefe(!/class="aufklapp"/.test(flaeche()), 'weit klappt nichts unter dem Stapel auf');
  pruefe(/Testmanagement/.test(mappe()), 'weit stehen die Verweise wieder in der Mappe');
}

/* ============================================================
   SD-11  Nur Verweise: keine Inhalte, keine Aufgaben, keine Zähler
   ============================================================ */
console.log('\nSD-11  Der Schreibtisch bleibt eine Übersicht');
{
  const verboten = [
    ['contenteditable', 'kein Feld zum Schreiben von Inhalten'],
    ['erledigt', 'keine Aufgabenverwaltung'],
    ['Suche', 'keine Suche'],
    ['Notification', 'keine Benachrichtigungen'],
    ['graph.microsoft.com', 'keine OneNote-API'],
    ['Statistik', 'keine Statistiken']
  ];
  verboten.forEach(([wort, text]) => pruefe(SKRIPT.indexOf(wort) < 0, text));
  frisch();
  const f = SD.sdFachNeu('X', 'eigen', '#3B8EDE', '', '');
  SD.sdSeiteNeu(f, 'A', '');
  SD.sdSeiteNeu(f, 'B', '');
  SD.zeichne();
  pruefe(!/\b2 Seiten\b|\(2\)/.test(flaeche()), 'am Stapel steht keine Anzahl');
  /* Das Feld für spätere Miniaturen ist da, bleibt aber leer */
  pruefe(f.seiten[0].bild === '', 'jede Seite hat ein leeres Feld für eine spätere Miniatur');
}

/* ============================================================
   SD-12  Die Datei bleibt lesbar: unbekannte Felder überleben
   ============================================================ */
console.log('\nSD-12  Unbekannte Felder gehen nicht verloren');
{
  const roh = JSON.stringify({
    fassung: 99, geaendert: 123, spaeter: 'etwas Neues',
    faecher: [{ id: 'f1', name: 'X', reihe: 'eigen', farbe: '#3B8EDE', link: '', quelle: '',
      seiten: [{ id: 's1', name: 'A', link: '', bild: 'miniatur.png', unter: [], notiz: 'bleibt' }],
      leiste: [], stempel: 4711 }],
    planung: []
  });
  const g = SD.sdAusText(roh);
  pruefe(g.spaeter === 'etwas Neues', 'ein unbekanntes Feld oben bleibt stehen');
  pruefe(g.faecher[0].stempel === 4711, 'ein unbekanntes Feld am Fach bleibt stehen');
  pruefe(g.faecher[0].seiten[0].notiz === 'bleibt', 'ein unbekanntes Feld an der Seite bleibt stehen');
  pruefe(g.faecher[0].seiten[0].bild === 'miniatur.png', 'eine spätere Miniatur überlebt diese Fassung');
  SD.DB = g;
  const zurueck = SD.sdAusText(SD.sdAlsText());
  pruefe(zurueck.spaeter === 'etwas Neues' && zurueck.faecher[0].stempel === 4711,
    'auch nach dem Zurückschreiben sind sie noch da');
}

/* ============================================================
   SD-13  Der Sprung nach OneNote
   ============================================================ */
console.log('\nSD-13  In OneNote springen');
{
  frisch();
  SD.DB.planung = [
    { id: 'p1', name: 'Woche', link: 'onenote:///C:/N/Woche' },
    { id: 'p2', name: 'Meetings', link: 'https://x.sharepoint.com/M' },
    { id: 'p3', name: 'Ohne', link: '' }
  ];
  SD.zeichne();
  const p = planung();
  const onenote = p.match(/<a href="onenote:[^>]*>/)[0];
  const web = p.match(/<a href="https:[^>]*>/)[0];
  pruefe(onenote.indexOf('target=') < 0, 'ein onenote:-Link bleibt im selben Fenster — die App bleibt stehen');
  pruefe(web.indexOf('target="_blank"') >= 0, 'ein https-Link geht in ein neues Fenster');
  pruefe(web.indexOf('rel="noopener"') >= 0, 'der neue Tab bekommt kein Fenster zurück');
  pruefe(/class="ohne"/.test(p), 'ein Eintrag ohne Link ist kein Link');
  pruefe(/aria-disabled="true"/.test(p), 'und wird auch so angesagt');
  /* Derselbe Weg aus dem Fach heraus */
  const f = SD.sdFachNeu('X', 'eigen', '#3B8EDE', 'onenote:///Abschnitt', '');
  SD.sdFachWaehlen(f.id);
  pruefe(/href="onenote:\/\/\/Abschnitt"/.test(mappe()), 'auch der Abschnitt wird über onenote: geöffnet');
  pruefe(typeof SD.sdGehe === 'function', 'es gibt einen gemeinsamen Weg für den Sprung');
}

/* ============================================================
   SD-14  Die berufliche Fassung enthält keinen Cloud-Code
   Grund: Berufliche Daten dürfen nie in Google Drive oder einen
   anderen privaten Speicher gelangen. Nicht abgeschaltet — nicht da.
   ============================================================ */
console.log('\nSD-14  Beruflich: kein Weg ins Netz');
{
  const WOLKE = ['googleapis', 'google.accounts', 'gapi', 'drive.google', 'drive/v3',
    'oauth', 'client_id', 'access_token', 'refresh_token', 'Bearer ',
    'driveHochladen', 'driveHerunterladen', 'driveSuchen', 'anmelden(', 'abgleichen('];
  /* Der Zeichensatz liegt bei fonts.googleapis.com. Diese beiden Adressen
     werden vorher herausgenommen, damit „googleapis“ danach wieder etwas
     bedeutet — etwa www.googleapis.com/drive/v3. */
  const ohneSchrift = QUELLE.replace(/fonts\.(googleapis|gstatic)\.com/g, 'schriftdienst');
  const gefunden = WOLKE.filter(w => ohneSchrift.toLowerCase().indexOf(w.toLowerCase()) >= 0);
  pruefe(gefunden.length === 0,
    'in der beruflichen Fassung steht kein Cloud-Code' + (gefunden.length ? ' — gefunden: ' + gefunden.join(', ') : ''));
  /* fetch und XMLHttpRequest wären der Weg dorthin, auch ohne die Wörter oben */
  pruefe(!/\bfetch\s*\(/.test(SKRIPT), 'die berufliche Fassung ruft kein fetch');
  pruefe(SKRIPT.indexOf('XMLHttpRequest') < 0, 'und auch kein XMLHttpRequest');
  pruefe(!/<script[^>]+src=/.test(QUELLE), 'die Datei lädt kein fremdes Skript nach');
  /* Erlaubt bleibt der Zeichensatz: der lädt nur Schrift, keine Daten hinaus */
  const fremdeZiele = [...QUELLE.matchAll(/https:\/\/([a-z0-9.-]+)/gi)].map(m => m[1].toLowerCase());
  const erlaubt = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
  const draussen = [...new Set(fremdeZiele)].filter(z => !erlaubt.has(z));
  pruefe(draussen.length === 0,
    'die Datei kennt keine fremden Adressen außer dem Zeichensatz'
    + (draussen.length ? ' — gefunden: ' + draussen.join(', ') : ''));
  pruefe(/<title>Schreibtisch [\d.]+ Beruf<\/title>/.test(QUELLE),
    'der Titel sagt im Hauptfenster, dass dies die berufliche Fassung ist');

  if (!PRIVAT_QUELLE) {
    warn('die private Fassung gibt es noch nicht — der Vergleich wird übersprungen');
  } else {
    pruefe(/<title>Schreibtisch [\d.]+ Privat<\/title>/.test(PRIVAT_QUELLE),
      'die private Fassung nennt sich im Titel „Privat“');
    pruefe(PRIVAT_QUELLE.length > QUELLE.length,
      'die private Fassung ist die größere — sie hat den Abgleich zusätzlich');
  }
}

/* ============================================================
   SD-15  Ein fremder Rahmen wird erkannt
   Grund: Am 13.11.2026 bot die App in der Chat-Vorschau „Neue Datei“ an.
   Der Knopf war da, die Funktion war da — der Browser verbietet in einem
   fremden Rahmen aber jede Dateiauswahl. Eine Fähigkeit abzufragen, ohne
   zu prüfen, ob man sie benutzen darf, ist genau dieser Fehler.
   ============================================================ */
console.log('\nSD-15  Vorschau und Rahmen');
{
  pruefe(/window\.self !== window\.top/.test(SKRIPT), 'die App fragt, ob sie in einem Rahmen läuft');
  pruefe(/function sdFsApiDa/.test(SKRIPT) && /sdImRahmen\(\)/.test(SKRIPT),
    'und die Prüfung der Dateiauswahl zieht das heran');
  pruefe(/showSaveFilePicker/.test(SKRIPT.match(/function sdFsApiDa[\s\S]*?\n}/)[0]),
    'sdFsApiDa fragt beide Dialoge ab, nicht nur einen');

  pruefe(SD.sdImRahmen() === false, 'ohne Rahmen ist die Antwort nein');

  /* Im Rahmen: der Knopf heißt anders und der Weg ist ein anderer */
  const imRahmen = ladeIn(SKRIPT, 'rahmen', 1280);
  imRahmen.top = { fremd: true };     /* self !== top */
  imRahmen.showOpenFilePicker = function () { return Promise.resolve([]); };
  imRahmen.showSaveFilePicker = function () { return Promise.resolve({}); };
  imRahmen.DB = imRahmen.sdLeer();
  imRahmen.sdPlanungSichern();
  imRahmen.zeichne();
  const mr = imRahmen.document.getElementById('mappe').innerHTML;
  pruefe(imRahmen.sdImRahmen() === true, 'der Rahmen wird erkannt');
  pruefe(imRahmen.sdFsApiDa() === false, 'im Rahmen gilt die Dateiauswahl als nicht verfügbar');
  pruefe(/Herunterladen/.test(mr) && !/Neue Datei/.test(mr),
    'im Rahmen heißt der Knopf „Herunterladen“, nicht „Neue Datei“');
  pruefe(/Vorschau/.test(mr), 'und eine Zeile sagt, warum');

  /* Wirft der Zugriff auf window.top, ist die Antwort erst recht ja.
     Der Getter wird im Zusammenhang selbst gesetzt — von außen käme er
     nicht an den Stellvertreter der VM heran. */
  const zu = ladeIn(SKRIPT, 'zu', 1280);
  vm.runInContext(
    "Object.defineProperty(window, 'top', { get: function () { throw new Error('cross origin'); } });",
    zu);
  pruefe(zu.sdImRahmen() === true, 'ein fremder Ursprung, der beim Nachsehen wirft, gilt als Rahmen');
  pruefe(zu.sdFsApiDa() === false, 'und dann gibt es auch keine Dateiauswahl');
}

/* ============================================================
   SD-16  Die Ablagezeile behauptet nichts
   Grund: Sie meldete „Zuletzt gesichert 17:23“, obwohl nur der
   Browserspeicher gegriffen hatte. Eine Zeile, die Sicherheit
   vortäuscht, ist schlimmer als gar keine.
   ============================================================ */
console.log('\nSD-16  Die Ablage sagt die Wahrheit');
{
  frisch();
  SD.sd.weg = 'datei'; SD.sd.dateiName = 'schreibtisch.json'; SD.sd.gesichert = '09:14';
  let h = SD.sdAblageHtml(false);
  pruefe(/Datei: schreibtisch\.json/.test(h), 'mit Datei nennt sie die Datei');
  pruefe(/Zuletzt gesichert 09:14/.test(h), 'und die Uhrzeit');

  SD.sd.weg = 'lokal';
  h = SD.sdAblageHtml(false);
  pruefe(/nicht in einer Datei/.test(h), 'ohne Datei sagt sie ausdrücklich, dass keine Datei dahintersteht');

  SD.sd.weg = 'nichts'; SD.sd.gesichert = '';
  h = SD.sdAblageHtml(false);
  pruefe(/Nichts wird gespeichert/.test(h), 'wenn nichts geht, sagt sie das deutlich');
  pruefe(!/Zuletzt gesichert/.test(h), 'und nennt dann keine Uhrzeit');
  pruefe(/alarm/.test(h), 'und wird hervorgehoben');

  /* Scheitert der Browserspeicher, darf keine Uhrzeit entstehen.
     Ohne Dateigriff läuft sdSichern synchron durch — danach steht der
     Zustand schon fest. */
  const eng = ladeIn(SKRIPT, 'eng', 1280);
  eng.localStorage.setItem = function () { throw new Error('voll'); };
  eng.DB = eng.sdLeer();
  eng.sdSichern();
  pruefe(eng.sd.weg === 'nichts', 'ohne Browserspeicher und ohne Datei ist der Weg „nichts“');
  pruefe(eng.sd.gesichert === '', 'und es gibt keine Uhrzeit dazu');
}

/* ============================================================
   SD-17  Gestempelt wird nur, was der Benutzer ändert
   Grund: Die Ursache des Datenverlusts im CLIE am 13.11.2026. Ein lange
   nicht benutztes Gerät las seine alten Werte, leitete daraus etwas ab
   und stempelte es mit „jetzt“ — womit der alte Stand den Abgleich
   gewann. Was die App von selbst tut, darf keinen Stempel setzen.
   ============================================================ */
console.log('\nSD-17  Stempel nur bei Benutzeränderung');
{
  frisch();
  const f = SD.sdFachNeu('Testmanagement', 'eigen', '#3B8EDE', '', '');
  pruefe(f.geaendert > 0, 'ein angelegtes Fach trägt einen Stempel');
  pruefe(typeof f.ordnung === 'number', 'und eine Stelle in der Liste');
  pruefe(f.leiste.every(p => p.geaendert > 0), 'die drei Verweise auch');

  /* Lesen und Ergänzen stempelt nicht */
  const alt = JSON.stringify({ fassung: 1, planung: [], grabsteine: {},
    faecher: [{ id: 'fa-1', name: 'Alt', reihe: 'eigen', farbe: '#3B8EDE', link: '', quelle: '' }] });
  const g = SD.sdAusText(alt);
  pruefe(g.faecher[0].geaendert === 0, 'eine Datei ohne Stempel bekommt 0, nicht „jetzt“');
  pruefe(Array.isArray(g.faecher[0].seiten), 'fehlende Listen werden ergänzt');
  pruefe(g.faecher[0].geaendert === 0, 'das Ergänzen selbst stempelt nicht');

  /* Die Planungsleiste: feste Kennungen, Stempel 0 */
  SD.DB = SD.sdLeer();
  SD.sdPlanungSichern();
  pruefe(SD.DB.planung.every(p => p.geaendert === 0), 'die Voreinstellung der Planungsleiste trägt Stempel 0');
  pruefe(SD.DB.planung[0].id === 'pl-woche', 'ihre Kennungen sind fest, nicht gewürfelt');
  pruefe(SD.DB.planung[1].id === 'pl-erinnerungen', 'auch mit Umlauten und Leerzeichen im Namen');
  const einmal = SD.DB.planung.map(p => p.id).join(',');
  SD.DB.planung = [];
  SD.sdPlanungSichern();
  pruefe(SD.DB.planung.map(p => p.id).join(',') === einmal,
    'zweimal angelegt ergibt dieselben Kennungen — sonst stünden nach dem Abgleich zehn Einträge da');

  /* Verschieben stempelt genau zwei Datensätze, nicht die ganze Liste */
  frisch();
  const h = SD.sdFachNeu('X', 'eigen', '#3B8EDE', '', '');
  ['A', 'B', 'C', 'D'].forEach(n => SD.sdSeiteNeu(h, n, ''));
  h.seiten.forEach(s => { s.geaendert = 1000; });
  SD.sdSchieben(h.seiten, h.seiten[3].id, -1);
  const frischGestempelt = h.seiten.filter(s => s.geaendert > 1000).length;
  pruefe(frischGestempelt === 2, 'Verschieben stempelt genau zwei Datensätze (waren ' + frischGestempelt + ')');
  pruefe(h.seiten.map(s => s.name).join('') === 'ACDB'.slice(0, 0) + 'ABDC',
    'und tauscht genau zwei Stellen');

  /* Entfernen setzt einen Grabstein */
  const weg = h.seiten[0].id;
  SD.sdEntfernen(h.seiten, weg);
  pruefe(!!SD.DB.grabsteine[weg], 'Entfernen hinterlässt einen Grabstein');
  pruefe(SD.DB.grabsteine[weg] > 0, 'mit dem Zeitpunkt des Todes');
}

/* ============================================================
   SD-18  Zusammenführen je Datensatz
   ============================================================ */
console.log('\nSD-18  Abgleich: der jüngere Stempel gewinnt');
{
  function fach(id, name, zeit, seiten) {
    return { id: id, name: name, reihe: 'eigen', farbe: '#3B8EDE', link: '', quelle: '',
      seiten: seiten || [], leiste: [], ordnung: 0, geaendert: zeit };
  }
  function bestand(faecher, grabsteine) {
    return { fassung: 1, faecher: faecher, planung: [], grabsteine: grabsteine || {}, geaendert: 0 };
  }

  let e = SD.sdZusammenfuehren(
    bestand([fach('fa-1', 'Alt', 1000)]),
    bestand([fach('fa-1', 'Neu', 2000)]));
  pruefe(e.db.faecher[0].name === 'Neu', 'der jüngere Stempel gewinnt');
  pruefe(e.bericht.ersetzt === 1, 'und wird als ersetzt gezählt');

  e = SD.sdZusammenfuehren(
    bestand([fach('fa-1', 'Meins', 3000)]),
    bestand([fach('fa-1', 'Fremd', 1000)]));
  pruefe(e.db.faecher[0].name === 'Meins', 'der ältere verliert, auch wenn er von außen kommt');

  e = SD.sdZusammenfuehren(
    bestand([fach('fa-1', 'Gleich', 2000)]),
    bestand([fach('fa-1', 'Gleich', 2000)]));
  pruefe(e.bericht.ersetzt === 0 && e.bericht.behalten === 1,
    'Gleichstand heißt gleiche Fassung und ist kein Ersetzen');

  e = SD.sdZusammenfuehren(
    bestand([fach('fa-1', 'Meins', 1000)]),
    bestand([fach('fa-2', 'Fremd', 1000)]));
  pruefe(e.db.faecher.length === 2, 'was nur eine Seite kennt, kommt mit');
  pruefe(e.bericht.neu === 2, 'beide zählen als neu');

  /* Fehlen heißt nicht gelöscht — das ist die Regel, die Daten rettet */
  e = SD.sdZusammenfuehren(
    bestand([fach('fa-1', 'Meins', 5000)]),
    bestand([]));
  pruefe(e.db.faecher.length === 1, 'ein Fach, das die Gegenseite nicht kennt, überlebt');

  /* Verschachtelt: ein neuerer Fachname darf keine Seiten wegwerfen */
  e = SD.sdZusammenfuehren(
    bestand([fach('fa-1', 'Neuer Name', 9000, [
      { id: 'se-1', name: 'Meine Seite', link: '', bild: '', unter: [], ordnung: 0, geaendert: 100 }])]),
    bestand([fach('fa-1', 'Alter Name', 1000, [
      { id: 'se-2', name: 'Fremde Seite', link: '', bild: '', unter: [], ordnung: 1, geaendert: 8000 }])]));
  pruefe(e.db.faecher[0].name === 'Neuer Name', 'der neuere Fachname gewinnt');
  pruefe(e.db.faecher[0].seiten.length === 2,
    'aber die Seiten beider Seiten bleiben — ein Name überschreibt keine Seiten');

  /* Dritte Ebene ebenso */
  e = SD.sdZusammenfuehren(
    bestand([fach('fa-1', 'X', 1000, [
      { id: 'se-1', name: 'S', link: '', bild: '', unter: [
        { id: 'un-1', name: 'Meine', link: '', ordnung: 0, geaendert: 100 }], ordnung: 0, geaendert: 500 }])]),
    bestand([fach('fa-1', 'X', 1000, [
      { id: 'se-1', name: 'S', link: '', bild: '', unter: [
        { id: 'un-2', name: 'Fremde', link: '', ordnung: 1, geaendert: 100 }], ordnung: 0, geaendert: 500 }])]));
  pruefe(e.db.faecher[0].seiten[0].unter.length === 2, 'auch Unterseiten werden zusammengeführt');

  /* Die Stelle in der Liste überlebt den Abgleich */
  const a1 = fach('fa-1', 'Erst', 1000); a1.ordnung = 2;
  const a2 = fach('fa-2', 'Dann', 1000); a2.ordnung = 0;
  e = SD.sdZusammenfuehren(bestand([a1, a2]), bestand([]));
  pruefe(e.db.faecher[0].id === 'fa-2', 'nach dem Abgleich steht die Liste nach ordnung');
}

/* ============================================================
   SD-19  Grabsteine
   ============================================================ */
console.log('\nSD-19  Löschen hält, Ändern gewinnt gegen altes Löschen');
{
  /* Echte Zeitpunkte, keine kleinen Zahlen: Ein Grabstein aus dem Jahr
     1970 wird vom Aufräumen sofort weggeworfen, und der Test prüfte
     dann etwas anderes, als er behauptet. */
  const jetzt = Date.now();
  const vorhin = jetzt - 60000;
  const gestern = jetzt - 86400000;

  function fach(id, name, zeit) {
    return { id: id, name: name, reihe: 'eigen', farbe: '#3B8EDE', link: '', quelle: '',
      seiten: [], leiste: [], ordnung: 0, geaendert: zeit };
  }
  function bestand(faecher, grabsteine) {
    return { fassung: 1, faecher: faecher, planung: [], grabsteine: grabsteine || {}, geaendert: 0 };
  }

  let e = SD.sdZusammenfuehren(
    bestand([], { 'fa-1': vorhin }),
    bestand([fach('fa-1', 'Gelöscht', gestern)]));
  pruefe(e.db.faecher.length === 0, 'ein Grabstein, der jünger ist als der Datensatz, löscht ihn');
  pruefe(e.bericht.entfernt === 1, 'und wird gezählt');

  e = SD.sdZusammenfuehren(
    bestand([], { 'fa-1': gestern }),
    bestand([fach('fa-1', 'Wieder bearbeitet', vorhin)]));
  pruefe(e.db.faecher.length === 1,
    'eine spätere Änderung gewinnt gegen eine frühere Löschung — sonst verschwände Arbeit');

  e = SD.sdZusammenfuehren(
    bestand([fach('fa-1', 'Da', gestern)], {}),
    bestand([], { 'fa-1': vorhin }));
  pruefe(e.db.faecher.length === 0, 'der Grabstein der Gegenseite zählt genauso');
  pruefe(!!e.db.grabsteine['fa-1'], 'und bleibt erhalten, damit er auch das dritte Gerät erreicht');

  /* Aufräumen nach einem halben Jahr */
  const alt = Date.now() - 200 * 86400000;
  const neu = Date.now() - 10 * 86400000;
  const b = bestand([], { 'fa-alt': alt, 'fa-neu': neu });
  SD.sdGrabsteineAufraeumen(b);
  pruefe(!b.grabsteine['fa-alt'], 'ein Grabstein älter als ' + SD.SD_GRABSTEIN_TAGE + ' Tage fällt weg');
  pruefe(!!b.grabsteine['fa-neu'], 'ein jüngerer bleibt');
}

/* ============================================================
   SD-20  Der Abgleich selbst läuft ohne Knopf und nicht im Kreis
   ============================================================ */
console.log('\nSD-20  Nahtlos, ohne Rückkopplung');
{
  pruefe(/sdHaken/.test(SKRIPT), 'es gibt die Haken für die private Fassung');
  pruefe(/function sdSichernOhneHaken/.test(SKRIPT),
    'und einen Weg zu sichern, ohne den Haken auszulösen');
  pruefe((SKRIPT.match(/!sdHakenAus/g) || []).length === 2,
    'beide Ausgänge von sdSichern sind gegen die Rückkopplung abgesichert');

  frisch();
  SD.sdHakenAus = false;
  let gerufen = 0;
  SD.sdHaken.nachSichern = function () { gerufen++; };
  SD.sdSichern();
  pruefe(gerufen === 1, 'normales Sichern löst den Haken aus');
  SD.sdSichernOhneHaken();
  pruefe(gerufen === 1, 'Sichern nach einem Abgleich löst ihn nicht aus — sonst drehte es sich im Kreis');
  SD.sdHaken.nachSichern = null;
}

/* ============================================================
   SD-21  Die PWA-Teile passen zur Fassung
   ============================================================ */
console.log('\nSD-21  PWA');
{
  const ordner = path.dirname(path.resolve(DATEI));
  const fassung = (SKRIPT.match(/var SD_FASSUNG = '([\d.]+)';/) || [])[1];
  const mPfad = path.join(ordner, 'schreibtisch.webmanifest');
  const swPfad = path.join(ordner, 'sw-schreibtisch.js');

  if (!PRIVAT_QUELLE) {
    warn('die private Fassung gibt es nicht — die PWA-Prüfungen brauchen sie');
  } else {
    pruefe(/<link rel="manifest"/.test(PRIVAT_QUELLE), 'die private Fassung verweist auf das Manifest');
    pruefe(/name="theme-color"/.test(PRIVAT_QUELLE), 'und nennt eine Farbe für die Fensterleiste');
    pruefe(/serviceWorker\.register/.test(PRIVAT_QUELLE), 'und meldet einen Service Worker an');
    pruefe(/spMoeglich/.test(PRIVAT_QUELLE) && /sdImRahmen\(\)/.test(PRIVAT_QUELLE),
      'die Anmeldung ist gegen Rahmen und file:// abgesichert');
    pruefe(/Jetzt laden/.test(PRIVAT_QUELLE), 'eine neue Fassung wird angeboten, nicht aufgedrängt');

    if (!fs.existsSync(mPfad)) { fail('schreibtisch.webmanifest fehlt'); }
    else {
      let m = null;
      try { m = JSON.parse(fs.readFileSync(mPfad, 'utf8')); } catch (e) { m = null; }
      pruefe(!!m, 'das Manifest ist gültiges JSON');
      if (m) {
        pruefe(m.start_url === './schreibtisch.html', 'es startet in der privaten Fassung');
        pruefe(m.display === 'standalone', 'und öffnet im eigenen Fenster');
        pruefe((m.icons || []).length === 3, 'es nennt drei Symbole');
        pruefe((m.icons || []).some(i => i.purpose === 'maskable'), 'darunter ein maskierbares');
        pruefe((m.icons || []).every(i => i.src.indexOf('?v=' + fassung) > 0),
          'alle Symbole tragen die Fassung ' + fassung + ' — sonst bliebe das alte im Cache');
        pruefe((m.icons || []).every(i => fs.existsSync(path.join(ordner, i.src.split('?')[0]))),
          'und alle Symboldateien gibt es wirklich');
      }
    }

    if (!fs.existsSync(swPfad)) { fail('sw-schreibtisch.js fehlt'); }
    else {
      const sw = fs.readFileSync(swPfad, 'utf8');
      try { new vm.Script(sw); ok('der Service Worker ist syntaktisch korrekt'); }
      catch (e) { fail('Syntaxfehler im Service Worker: ' + e.message); }
      pruefe(sw.indexOf("var FASSUNG = '" + fassung + "'") >= 0,
        'er trägt dieselbe Fassung wie die App');
      pruefe(/schreibtisch-vorrat-/.test(sw), 'sein Vorrat heißt nach der Fassung');
      pruefe(/googleapis\.com/.test(sw) && /return;/.test(sw),
        'Google und Drive gehen nie in den Vorrat');
      pruefe(sw.indexOf('__FASSUNG__') < 0, 'kein Platzhalter mehr darin');
    }
  }

  /* Die berufliche Fassung ist eine Datei und hat nichts nachzuladen */
  pruefe(!/<link rel="manifest"/.test(QUELLE), 'die berufliche Fassung verweist auf kein Manifest');
  pruefe(QUELLE.indexOf('serviceWorker') < 0, 'und meldet keinen Service Worker an');
}

/* ============================================================
   SD-22  Einen OneNote-Link lesen
   Die Beispiele sind echt: aus der Probe vom 13.11.2026 (OneDrive)
   und nach demselben Muster für SharePoint und die lokale Form.
   ============================================================ */
console.log('\nSD-22  Linkzerlegung');
{
  /* Genau das, was „Link kopieren“ am 13.11.2026 geliefert hat */
  const ECHT =
    'https://onedrive.live.com/view.aspx?resid=AD87807F8BD4DCEB%21sb0f9cda22ce746199938e9f45ca5aef5'
    + '&id=documents&wd=target%28Projekte.one%7C96625D7B-3212-3F48-A9E8-9B3BF44A951A%2FAufgaben'
    + '%7C1F772C00-1FE5-4AFE-AB68-478C72A50C06%2F%29&wdpartid={CEB4A1DF-BB6A-0C4A-26A1-4035A1DD848D}{1}'
    + '&wdsectionfileid=AD87807F8BD4DCEB!s69380a8d65764b8680cd3c568c89f31b&end\n'
    + 'onenote:https://d.docs.live.net/ad87807f8bd4dceb/Dokumente/Mein%20Gehirn%202026/Projekte.one'
    + '#Aufgaben&section-id={96625D7B-3212-3F48-A9E8-9B3BF44A951A}'
    + '&page-id={1F772C00-1FE5-4AFE-AB68-478C72A50C06}&end';

  let e = SD.sdLinkLesen(ECHT);
  pruefe(e.onenote.indexOf('onenote:') === 0, 'die onenote:-Adresse wird erkannt');
  pruefe(e.web.indexOf('https://onedrive.live.com') === 0, 'die Web-Adresse auch');
  pruefe(e.web.indexOf('onenote:') < 0,
    'die Web-Adresse enthält nicht die onenote:-Adresse — die trägt selbst ein https:// in sich');
  pruefe(e.name === 'Aufgaben', 'der Name kommt aus dem Stück hinter der Raute (' + e.name + ')');
  pruefe(e.notizbuch === 'Mein Gehirn 2026', 'das Notizbuch aus dem Pfad (' + e.notizbuch + ')');
  pruefe(e.abschnitt === 'Projekte', 'der Abschnitt aus dem Dateinamen (' + e.abschnitt + ')');
  pruefe(e.abschnittId === '96625D7B-3212-3F48-A9E8-9B3BF44A951A', 'die Kennung des Abschnitts');
  pruefe(e.seiteId === '1F772C00-1FE5-4AFE-AB68-478C72A50C06', 'die Kennung der Seite');
  pruefe(e.art === 'seite', 'eine page-id bedeutet: eine Seite');

  /* Nur die Web-Zeile — SharePoint liefert dieselbe wd=target-Form */
  const SP = 'https://meinefirma.sharepoint.com/sites/QS/_layouts/15/Doc.aspx?sourcedoc=%7B123%7D'
    + '&wd=target%28Testmanagement.one%7CAB12CD34-1111-2222-3333-444455556666%2FTeststrategie'
    + '%7C99887766-AAAA-BBBB-CCCC-DDDDEEEEFFFF%2F%29';
  e = SD.sdLinkLesen(SP);
  pruefe(e.onenote === '', 'ohne onenote:-Zeile bleibt die leer');
  pruefe(e.name === 'Teststrategie', 'der Name kommt dann aus wd=target (' + e.name + ')');
  pruefe(e.abschnitt === 'Testmanagement', 'der Abschnitt ebenso');
  pruefe(e.abschnittId === 'AB12CD34-1111-2222-3333-444455556666', 'die Kennung des Abschnitts auch');
  pruefe(e.art === 'seite', 'und es ist eine Seite');

  /* Ein Abschnitt: keine page-id */
  e = SD.sdLinkLesen('onenote:///C:/Notizbuecher/Arbeit/Testmanagement.one'
    + '#section-id={AB12CD34-1111-2222-3333-444455556666}&end');
  pruefe(e.art === 'abschnitt', 'ohne page-id ist es ein Abschnitt');
  pruefe(e.abschnitt === 'Testmanagement', 'auch bei der örtlichen Form wird der Abschnitt gelesen');
  pruefe(e.name === 'Testmanagement', 'und der Name fällt auf den Abschnittsnamen zurück');
  pruefe(e.notizbuch === 'Arbeit', 'das Notizbuch kommt aus dem Ordner darüber');

  /* Nichts Brauchbares: nicht raten */
  e = SD.sdLinkLesen('Nur Fließtext ohne Adresse');
  pruefe(e.onenote === '' && e.web === '', 'aus Fließtext wird kein Link gemacht');
  pruefe(e.name === '' && e.art === '', 'und nichts geraten');
  e = SD.sdLinkLesen('');
  pruefe(e.onenote === '' && e.name === '', 'eine leere Zwischenablage ergibt leere Felder');

  /* Umlaute im Namen */
  e = SD.sdLinkLesen('onenote:///C:/N/Abschnitt.one#Offene%20Fragen&section-id={AB12CD34-1111-2222-3333-444455556666}'
    + '&page-id={99887766-AAAA-BBBB-CCCC-DDDDEEEEFFFF}&end');
  pruefe(e.name === 'Offene Fragen', 'Leerzeichen im Namen werden entschlüsselt');
}

/* ============================================================
   SD-23  Zwei Adressen je Eintrag
   ============================================================ */
console.log('\nSD-23  onenote: zuerst, Web als zweiter Weg');
{
  frisch();
  const f = SD.sdFachNeu('Testmanagement', 'eigen', '#3B8EDE',
    'onenote:///C:/N/T.one#x', 'Arbeit', 'https://x.sharepoint.com/T');
  pruefe(f.link_web === 'https://x.sharepoint.com/T', 'ein Fach merkt sich beide Adressen');
  pruefe(SD.sdZiel(f) === 'onenote:///C:/N/T.one#x', 'gesprungen wird über onenote:');
  pruefe(SD.sdHatBeide(f) === true, 'und es weiß, dass es beide hat');

  const nurWeb = { name: 'X', link: '', link_web: 'https://x.example/y' };
  pruefe(SD.sdZiel(nurWeb) === 'https://x.example/y', 'ohne onenote: gilt die Web-Adresse');
  pruefe(SD.sdHatBeide(nurWeb) === false, 'dann gibt es keinen zweiten Weg');

  SD.sdFachWaehlen(f.id);
  const m = mappe();
  pruefe(/href="onenote:\/\/\/C:\/N\/T\.one#x"/.test(m), 'die Mappe öffnet den Abschnitt über onenote:');
  pruefe(/zweitweg/.test(m) && /Im Browser/.test(m), 'und bietet daneben „Im Browser“');
  pruefe(/target="_blank"[^>]*>Im Browser|Im Browser/.test(m), 'der Web-Weg geht in ein neues Fenster');

  /* In der Verweisliste der kleine Pfeil */
  f.leiste[0].link = 'onenote:///C:/N/T.one#a';
  f.leiste[0].link_web = 'https://x.sharepoint.com/a';
  SD.sdFachWaehlen(f.id);
  pruefe(/class="imweb"/.test(mappe()), 'ein Verweis mit beiden Adressen bekommt den kleinen Pfeil');

  /* Eine Seite ohne jede Adresse bleibt blass */
  const s = SD.sdSeiteNeu(f, 'Ohne', '', '');
  SD.sdFachOeffnen(f.id);
  pruefe(/seite leer/.test(flaeche()), 'eine Seite ganz ohne Adresse bleibt blass');
  pruefe(!!s, 'und wird trotzdem angelegt');
}

/* ============================================================
   SD-24  Zusammenarbeit bekommt die Projektseite
   ============================================================ */
console.log('\nSD-24  Projektseite statt der drei');
{
  frisch();
  const eigen = SD.sdFachNeu('Testmanagement', 'eigen', '#3B8EDE', '', '');
  const team = SD.sdFachNeu('Projekt Nordlicht', 'zusammen', '#9B6BC9', '', 'Team');
  pruefe(eigen.leiste.length === 3, 'ein eigenes Fach behält die drei Sammelseiten');
  pruefe(team.leiste.length === 1, 'ein Zusammenarbeit-Fach bekommt einen Verweis');
  pruefe(team.leiste[0].name === 'Projektseite', 'und der heißt „Projektseite“');
  pruefe(team.leiste[0].link === '' && team.leiste[0].geaendert > 0,
    'zunächst ohne Link, aber mit Stempel');
  SD.sdFachWaehlen(team.id);
  pruefe(/Projektseite/.test(mappe()) && !/Offene Fragen/.test(mappe()),
    'die Mappe zeigt nur die Projektseite');
}

/* ============================================================
   SD-25  Einfügen legt an
   ============================================================ */
console.log('\nSD-25  Strg+V');
{
  /* Die Prüfumgebung liest kein HTML — das Namensfeld im Fenster muss
     also von Hand gefüllt werden, so wie es im Browser vorbelegt ist. */
  const nameEintragen = () => {
    SD.document.getElementById('sdEiName').value = SD.sd.fenster.info.name;
  };
  const SEITE = 'onenote:///C:/N/Arbeit/Testmanagement.one#Teststrategie'
    + '&section-id={AB12CD34-1111-2222-3333-444455556666}'
    + '&page-id={99887766-AAAA-BBBB-CCCC-DDDDEEEEFFFF}&end';
  const ABSCHNITT = 'onenote:///C:/N/Arbeit/Releaseplanung.one'
    + '#section-id={11112222-3333-4444-5555-666677778888}&end';

  /* Ohne jedes Fach: nur Fach oder Zusammenarbeit */
  frisch();
  SD.sdEinfuegenFenster(SD.sdLinkLesen(ABSCHNITT));
  let w = SD.document.getElementById('fenster').innerHTML;
  pruefe(/Eingefügt: Releaseplanung/.test(w), 'der Name steht schon im Titel');
  pruefe(/OneNote sagt: ein Abschnitt/.test(w), 'die Art wird genannt');
  pruefe(/Eigenes Fach/.test(w) && /Zusammenarbeit/.test(w), 'beide Fachreihen stehen zur Wahl');
  pruefe(!/Unterseite/.test(w), 'ein Abschnitt wird keine Unterseite');
  nameEintragen();
  SD.sdEinfuegenAnlegen();
  pruefe(SD.DB.faecher.length === 1, 'Anlegen erzeugt das Fach');
  pruefe(SD.DB.faecher[0].name === 'Releaseplanung', 'mit dem Namen aus dem Link');
  pruefe(SD.DB.faecher[0].link === ABSCHNITT, 'und dem Link daran');

  /* Jetzt ein Seitenlink aus einem anderen Abschnitt: kein Treffer */
  SD.sdEinfuegenFenster(SD.sdLinkLesen(SEITE));
  pruefe(SD.sd.fenster.getroffen === false, 'eine fremde Abschnittskennung trifft kein Fach');

  /* Ein Fach mit genau diesem Abschnitt anlegen — dann trifft es */
  frisch();
  const fach = SD.sdFachNeu('Testmanagement', 'eigen', '#3B8EDE',
    'onenote:///C:/N/Arbeit/Testmanagement.one#section-id={AB12CD34-1111-2222-3333-444455556666}&end', 'Arbeit');
  SD.sdEinfuegenFenster(SD.sdLinkLesen(SEITE));
  pruefe(SD.sd.fenster.getroffen === true,
    'die Seite findet ihr Fach über die Abschnittskennung, nicht über den Namen');
  pruefe(SD.sd.fenster.fachId === fach.id, 'und zwar das richtige');
  w = SD.document.getElementById('fenster').innerHTML;
  pruefe(/Seite in „Testmanagement“/.test(w), 'der Knopf nennt das gefundene Fach');
  pruefe(!/In welches Fach/.test(w), 'nach einem Treffer wird nicht mehr nach dem Fach gefragt');
  nameEintragen();
  SD.sdEinfuegenAnlegen();
  pruefe(fach.seiten.length === 1 && fach.seiten[0].name === 'Teststrategie',
    'die Seite landet im getroffenen Fach');

  /* Unterseite: das Ziel steht in keinem Link, also wird gefragt */
  SD.sdEinfuegenFenster(SD.sdLinkLesen(SEITE));
  SD.sdEinfuegenWahl('unter');
  w = SD.document.getElementById('fenster').innerHTML;
  pruefe(/Unter welcher Seite/.test(w),
    'für eine Unterseite wird nach der Seite gefragt — die steht in keinem OneNote-Link');
  pruefe(/Teststrategie/.test(w), 'und die vorhandenen Seiten stehen zur Wahl');
  SD.sd.fenster.seiteId = fach.seiten[0].id;
  nameEintragen();
  SD.sdEinfuegenAnlegen();
  pruefe(fach.seiten[0].unter.length === 1, 'die Unterseite hängt unter der gewählten Seite');

  /* Beide Adressen kommen mit */
  frisch();
  SD.sdEinfuegenFenster(SD.sdLinkLesen(SEITE + '\nhttps://x.sharepoint.com/t'));
  nameEintragen();
  SD.sdEinfuegenAnlegen();
  pruefe(SD.DB.faecher[0].link_web === 'https://x.sharepoint.com/t',
    'die Web-Adresse wird mit angelegt');

  /* Der Griff am Fenster */
  pruefe(/document\.addEventListener\('paste', sdEingefuegt\)/.test(SKRIPT),
    'Strg+V ist am Fenster angemeldet');
  const ohne = SKRIPT.match(/function sdEingefuegt[\s\S]*?\n}/)[0];
  pruefe(/if \(sd\.fenster\) \{ return; \}/.test(ohne),
    'bei offenem Fenster greift es nicht');
  pruefe(/'input'|textarea/.test(ohne), 'und in einem Eingabefeld auch nicht');
  pruefe(SKRIPT.indexOf("addEventListener('drop'") < 0,
    'kein Ablegen: OneNote gibt beim Ziehen nichts heraus (13.11.2026 nachgemessen)');
}

/* ============================================================
   SD-26  Die Kopfzeile: keine Stelle als Schlüssel
   Grund: Am 13.11.2026 öffnete ein Klick auf „Stundenplan“ den Eintrag
   „Block“. Der „Im Browser“-Pfeil aus 0.3.0 ist ein eigenes <a>, und
   der Klickgriff zählte die <a> durch und griff über diesen Index in
   DB.planung. Derselbe Fehlertyp wie beim Datenverlust: eine Position
   als Schlüssel statt einer Kennung. Diese Kategorie prüft, dass in
   der Kopfzeile nirgends mehr gezählt wird.
   ============================================================ */
console.log('\nSD-26  Kopfzeile');
{
  frisch();
  SD.DB.planung = [];
  SD.sdPlanungSichern();
  /* Der erste Eintrag bekommt beide Adressen — das war der Auslöser */
  SD.DB.planung[0].name = 'Wochenplan';
  SD.DB.planung[0].link = 'onenote:///C:/N/W.one#Woche';
  SD.DB.planung[0].link_web = 'https://x.example/woche';
  SD.zeichne();

  let p = planung();
  const anker = (p.match(/<a /g) || []).length;
  pruefe(anker === SD.DB.planung.length,
    'je Eintrag genau ein <a> in der Kopfzeile (' + anker + ' bei ' + SD.DB.planung.length + ' Einträgen)');
  pruefe(!/class="imweb"/.test(p),
    'kein „Im Browser“-Pfeil in der Kopfzeile — dort sähe er aus wie ein Menüpunkt');
  pruefe(/class="imweb"/.test(SKRIPT), 'in den Verweislisten gibt es ihn weiterhin');
  pruefe(/data-id="pl-woche"/.test(p), 'jeder Eintrag trägt seine Kennung im Markup');

  /* Der alte Klickgriff darf es nicht mehr geben */
  pruefe(SKRIPT.indexOf('querySelectorAll(\'a\')') < 0,
    'die Kopfzeile zählt keine <a> mehr durch');
  pruefe(!/indexOf\.call\([^)]*querySelectorAll/.test(SKRIPT),
    'und greift nirgends über eine Stelle in DB.planung');

  /* Bearbeiten: Namen sind Knöpfe mit Kennung, keine Links */
  SD.sdBearbeitenUm();
  p = planung();
  pruefe((p.match(/<a /g) || []).length === 0, 'im Bearbeiten-Modus gibt es gar keine Links mehr');
  pruefe((p.match(/class="pl-name"/g) || []).length === 5, 'sondern fünf Namensknöpfe');
  pruefe(/sdPlanungFenster\('pl-stundenplan'\)/.test(p),
    'und jeder ruft seinen Eintrag über die Kennung auf, nicht über die Stelle');
  pruefe((p.match(/class="pl-pfeil"/g) || []).length === 10, 'dazu je zwei Pfeile');

  /* Verschieben */
  const vorher = SD.DB.planung.map(x => x.name).join('|');
  SD.DB.planung.forEach(x => { x.geaendert = 1000; });
  SD.sdPlanungStellen('pl-meetings', 'vor');
  pruefe(SD.DB.planung.map(x => x.name).join('|') === 'Wochenplan|Erinnerungen|Stundenplan|Meetings|Block',
    '◀ zieht einen Eintrag nach vorn');
  const frischGestempelt = SD.DB.planung.filter(x => x.geaendert > 1000).length;
  pruefe(frischGestempelt === 2,
    'dabei werden genau zwei Einträge gestempelt, nicht die ganze Leiste (waren ' + frischGestempelt + ')');
  SD.sdPlanungStellen('pl-meetings', 'zurueck');
  pruefe(SD.DB.planung.map(x => x.name).join('|') === vorher, '▶ schiebt ihn wieder zurück');
  SD.sdPlanungStellen('pl-wochenplan', 'vor');
  pruefe(SD.DB.planung[0].name === 'Wochenplan', 'der erste lässt sich nicht weiter nach vorn schieben');
  SD.sdPlanungStellen('pl-meetings', 'zurueck');
  pruefe(SD.DB.planung[4].name === 'Meetings', 'und der letzte nicht weiter nach hinten');

  /* Die Reihenfolge übersteht den Abgleich */
  const a = JSON.parse(SD.sdAlsText());
  SD.sdPlanungStellen('pl-block', 'vor');
  const b = JSON.parse(SD.sdAlsText());
  const e = SD.sdZusammenfuehren(b, a);
  pruefe(e.db.planung.map(x => x.name).join('|') === b.planung.map(x => x.name).join('|'),
    'nach dem Abgleich steht die Leiste in der zuletzt gewählten Reihenfolge');
  SD.sdBearbeitenUm();
}

/* ============================================================
   ERGEBNIS
   ============================================================ */
console.log('\nERGEBNIS: ' + anzOk + ' ok, ' + anzFail + ' fehlgeschlagen, ' + anzWarn + ' Warnungen');
process.exit(anzFail ? 1 : 0);
