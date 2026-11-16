'use strict';

/* ============================================================
   Schreibtisch — eine ruhige Übersicht über ein OneNote-Notizbuch.

   Die App speichert keine Inhalte, nur Namen, Farben und Links.
   Geschrieben wird in OneNote; ein Verweis springt dorthin.

   Drei Ebenen:
     Fach    = ein Abschnitt im Notizbuch, auf dem Tisch ein Stapel
     Seite   = eine Seite in diesem Abschnitt, ein einzelnes Blatt
     Unter   = eine Unterseite, klappt unter ihrer Seite auf

   Dazu je Fach die Leiste „Immer dabei“ (Aufgaben, Offene Fragen,
   Erkenntnisse) und oben die Planungsleiste.

   Diese Fassung ist die berufliche: Die Ablage ist eine Datei auf
   dem Rechner. Es gibt keinen Weg ins Netz — nicht abgeschaltet,
   sondern nicht vorhanden. Die private Fassung entsteht aus
   derselben Quelle und bekommt den Drive-Teil dazu.
   ============================================================ */

var SD_FASSUNG = '__FASSUNG__';
var SD_VERSION = '__VERSION__';
var SD_DATEI_FASSUNG = 1;

var SD_SCHMAL = 820;
var SD_GRABSTEIN_TAGE = 180;
var SD_IDB_NAME = 'schreibtisch-speicher';
var SD_IDB_STORE = 'griffe';
var SD_IDB_KEY = 'datendatei';
var SD_LS_KEY = 'schreibtisch-daten-' + SD_FASSUNG;

/* Die Abschnittsfarben, wie OneNote sie anbietet. */
var SD_FARBEN = ['#3B8EDE', '#85C440', '#E8A33D', '#9B6BC9', '#D4564F', '#3FA9A4', '#C8679F', '#7A8794'];

/* Was ein neues Fach immer mitbekommt (SD-05). */
var SD_LEISTE_VOR = ['Aufgaben', 'Offene Fragen', 'Erkenntnisse'];
/* Zusammenarbeit zeigt nicht auf eigene Sammelseiten, sondern auf die
   gemeinsame Projektseite — ein Verweis genügt dort. */
var SD_LEISTE_ZUSAMMEN = ['Projektseite'];
/* Was in der Planungsleiste steht, solange nichts geändert wurde (SD-07). */
var SD_PLANUNG_VOR = ['Woche', 'Erinnerungen', 'Stundenplan', 'Block', 'Meetings'];

/* ---------- Haken für die private Fassung ----------
   Der einzige Unterschied zwischen den beiden Fassungen. In der
   beruflichen bleiben diese drei null und werden nie gerufen; es gibt
   dort keinen Cloud-Code, der sie füllen könnte. In der privaten hängt
   sd_wolke.js sich hier ein. Kein Schalter in der Oberfläche, keine
   Abfrage „welche Welt“ — die Fassung ist, was sie enthält. */
var sdHaken = { beimStart: null, nachSichern: null, ablageZeile: null };

var DB = sdLeer();
var sd = {
  sicht: 'tisch',      /* tisch | fach */
  fachId: '',
  seiteId: '',         /* welche Seite ihre Unterseiten zeigt */
  bearbeiten: false,
  fenster: null,
  dateiName: '',
  gesichert: '',
  weg: 'keiner'        /* keiner | datei | lokal */
};

/* ---------- Grundlagen ---------- */

function sdLeer() {
  return { fassung: SD_DATEI_FASSUNG, faecher: [], planung: [], grabsteine: {}, geaendert: 0 };
}

/* ---------- Stempel ----------
   Hier entscheidet sich beim Abgleich alles. Ein Stempel bedeutet: Der
   Benutzer hat diesen Datensatz geändert. Er bedeutet NICHT: Die App hat
   ihn angefasst. Aufräumen, Ergänzen beim Laden, Nachziehen beim Zeichnen
   stempeln nicht — sonst gewinnt ein altes Gerät mit frischen Stempeln
   gegen zwei Wochen Arbeit. Genau das ist im CLIE am 13.11.2026 passiert. */
function sdStempeln(satz) {
  if (satz) { satz.geaendert = Date.now(); }
  return satz;
}

/* Die Stelle in der Liste gehört zum Datensatz, nicht zur Liste — sonst
   ließe sie sich nicht zusammenführen. Beim Verschieben tauschen genau
   zwei Datensätze ihre Stelle, nicht die ganze Liste. */
function sdOrdnung(liste) {
  var hoechste = -1;
  liste.forEach(function (x) {
    if (typeof x.ordnung === 'number' && x.ordnung > hoechste) { hoechste = x.ordnung; }
  });
  return hoechste + 1;
}

function sdGrabsteinSetzen(id) {
  if (!DB.grabsteine) { DB.grabsteine = {}; }
  DB.grabsteine[id] = Date.now();
}

/* Ein Löschvermerk hält ein halbes Jahr. Danach ist jedes Gerät, das den
   Datensatz noch kannte, längst einmal online gewesen. */
function sdGrabsteineAufraeumen(bestand) {
  var grenze = Date.now() - SD_GRABSTEIN_TAGE * 86400000;
  var alt = bestand.grabsteine || {};
  var neu = {};
  Object.keys(alt).forEach(function (id) {
    if (alt[id] >= grenze) { neu[id] = alt[id]; }
  });
  bestand.grabsteine = neu;
  return bestand;
}

function sdKennung() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function esc(t) {
  return String(t === null || t === undefined ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function zwei(n) { return (n < 10 ? '0' : '') + n; }

function sdUhrzeit() {
  var d = new Date();
  return zwei(d.getHours()) + ':' + zwei(d.getMinutes());
}

/* Nur onenote: und https: werden gespeichert (SD-08). Alles andere wird
   beim Speichern abgelehnt — ein Link, der nirgendwohin führt, ist
   schlimmer als gar keiner, weil man es erst beim Antippen merkt. */
function sdLinkOk(link) {
  var t = String(link || '').trim();
  if (!t) { return true; }          /* leer ist erlaubt: Link nachtragbar */
  return /^onenote:/i.test(t) || /^https:\/\/./i.test(t);
}

function sdLinkSauber(link) {
  return String(link || '').trim();
}

/* ============================================================
   Einen OneNote-Link lesen

   „Link kopieren“ legt in Windows zwei Zeilen in die Zwischenablage:
   die Web-Adresse und die onenote:-Adresse. Beide tragen mehr, als man
   ihnen ansieht. Aus

     onenote:<Serveradresse>/…/Mein%20Gehirn%202026/Projekte.one
             #Aufgaben&section-id={96625D7B-…}&page-id={1F772C00-…}&end

   lassen sich Name, Notizbuch, Abschnitt und — am wichtigsten — die
   Kennungen von Abschnitt und Seite ablesen. Die page-id entscheidet,
   ob eine Seite oder ein Abschnitt kopiert wurde, und die section-id
   sagt später, in welches Fach die Seite gehört.

   Die Web-Adresse trägt dasselbe in der Form
     wd=target(Projekte.one|<abschnitt-id>/Aufgaben|<seiten-id>/)
   Das gilt auch für SharePoint, deshalb wird sie als zweiter Weg
   gelesen, wenn keine onenote:-Adresse dabei ist.

   Was nicht erkannt wird, bleibt leer. Die App rät nicht — ein falscher
   Name ist lästiger als ein leeres Feld.
   ============================================================ */

function sdEntspannen(t) {
  try { return decodeURIComponent(String(t || '')).replace(/\+/g, ' '); }
  catch (e) { return String(t || ''); }
}

function sdKennungAus(text, feld) {
  var m = String(text || '').match(new RegExp(feld + '=\\{?([0-9A-Fa-f-]{36})\\}?'));
  return m ? m[1].toUpperCase() : '';
}

/* Zerlegt den Pfad einer OneNote-Adresse: …/<Notizbuch>/<Abschnitt>.one */
function sdPfadLesen(adresse, ergebnis) {
  var ohneFrage = String(adresse || '').split('?')[0].split('#')[0];
  var teile = ohneFrage.split('/');
  var i;
  for (i = teile.length - 1; i >= 0; i--) {
    if (/\.one$/i.test(teile[i])) {
      ergebnis.abschnitt = sdEntspannen(teile[i].replace(/\.one$/i, ''));
      if (i > 0) { ergebnis.notizbuch = sdEntspannen(teile[i - 1]); }
      return;
    }
  }
}

function sdLinkLesen(text) {
  var roh = String(text || '');
  var e = { onenote: '', web: '', name: '', notizbuch: '', abschnitt: '',
    abschnittId: '', seiteId: '', art: '' };

  /* Erst die onenote:-Adresse herausnehmen — sie enthält selbst ein
     https://, das sonst als Web-Adresse durchginge. */
  var m = roh.match(/onenote:\S+/i);
  var rest = roh;
  if (m) { e.onenote = m[0]; rest = roh.replace(m[0], ' '); }
  var w = rest.match(/https?:\/\/\S+/i);
  if (w) { e.web = w[0]; }

  var quelle = e.onenote || e.web;
  if (!quelle) { return e; }

  e.abschnittId = sdKennungAus(quelle, 'section-id');
  e.seiteId = sdKennungAus(quelle, 'page-id');

  /* Der Name steht hinter dem # bis zum ersten & — aber nur, wenn dort
     wirklich ein Name steht. Ein Abschnittslink hat keinen, und sein
     Bruchstück beginnt gleich mit „section-id=…“. Enthält das erste
     Stück ein Gleichheitszeichen, ist es ein Feld und kein Name. */
  var raute = quelle.indexOf('#');
  if (raute >= 0) {
    var erstes = quelle.slice(raute + 1).split('&')[0];
    if (erstes && erstes.indexOf('=') < 0) { e.name = sdEntspannen(erstes); }
  }
  sdPfadLesen(quelle, e);

  /* Web-Adresse: wd=target(Abschnitt.one|<id>/Seite|<id>/) — so sieht es
     bei OneDrive und bei SharePoint aus. */
  var t = e.web.match(/[?&]wd=([^&]+)/i);
  if (t) {
    var ziel = sdEntspannen(t[1]).replace(/^target\(|\)$/g, '');
    var stuecke = ziel.split('|');
    if (!e.abschnitt && stuecke[0]) { e.abschnitt = stuecke[0].replace(/\.one$/i, ''); }
    if (stuecke[1]) {
      var schraeg = stuecke[1].split('/');
      if (!e.abschnittId && /^[0-9A-Fa-f-]{36}$/.test(schraeg[0])) {
        e.abschnittId = schraeg[0].toUpperCase();
      }
      if (!e.name && schraeg[1]) { e.name = schraeg[1]; }
    }
    if (stuecke[2] && !e.seiteId) {
      var p = stuecke[2].split('/')[0];
      if (/^[0-9A-Fa-f-]{36}$/.test(p)) { e.seiteId = p.toUpperCase(); }
    }
  }

  if (e.seiteId) { e.art = 'seite'; }
  else if (e.abschnittId) { e.art = 'abschnitt'; }

  /* Ein Abschnittslink ohne Raute trägt seinen Namen im Dateinamen. */
  if (!e.name && e.art === 'abschnitt') { e.name = e.abschnitt; }
  return e;
}

/* Sucht das Fach, in dessen Abschnitt diese Seite liegt — über die
   Kennung des Abschnitts, nicht über den Namen. Die Kennung steht im
   Link, den das Fach ohnehin schon trägt; es muss nichts nachgetragen
   werden, auch nicht bei von Hand angelegten Fächern. */
function sdFachZuAbschnitt(abschnittId) {
  if (!abschnittId) { return null; }
  var treffer = null;
  (DB.faecher || []).forEach(function (f) {
    if (treffer) { return; }
    var k = sdKennungAus(f.link || '', 'section-id')
         || sdKennungAus(f.link_web || '', 'section-id');
    if (k && k === abschnittId) { treffer = f; }
  });
  return treffer;
}

/* ---------- Lesen aus dem Bestand ---------- */

function sdFaecher(reihe) {
  return (DB.faecher || []).filter(function (f) { return !reihe || f.reihe === reihe; });
}

function sdFach(id) {
  return (DB.faecher || []).filter(function (f) { return f.id === id; })[0] || null;
}

function sdSeite(fach, id) {
  if (!fach) { return null; }
  return (fach.seiten || []).filter(function (s) { return s.id === id; })[0] || null;
}

/* ---------- Schreiben ---------- */

function sdGeaendert() {
  DB.geaendert = Date.now();
  sdSpaeterSichern();
}

function sdFachNeu(name, reihe, farbe, link, quelle, web) {
  var jetzt = Date.now();
  var zusammen = (reihe === 'zusammen');
  var f = {
    id: 'fa-' + sdKennung(),
    name: String(name || '').trim().slice(0, 60),
    reihe: zusammen ? 'zusammen' : 'eigen',
    farbe: SD_FARBEN.indexOf(farbe) >= 0 ? farbe : SD_FARBEN[0],
    link: sdLinkSauber(link),
    link_web: sdLinkSauber(web),
    quelle: String(quelle || '').trim().slice(0, 60),
    seiten: [],
    /* Eigene Fächer bekommen die drei Sammelseiten (SD-05),
       Zusammenarbeit die eine Projektseite — beide zunächst ohne Link. */
    leiste: (zusammen ? SD_LEISTE_ZUSAMMEN : SD_LEISTE_VOR).map(function (n, i) {
      return { id: 'lk-' + sdKennung(), name: n, link: '', link_web: '', ordnung: i, geaendert: jetzt };
    }),
    ordnung: sdOrdnung(DB.faecher),
    geaendert: jetzt
  };
  DB.faecher.push(f);
  sdGeaendert();
  return f;
}

function sdSeiteNeu(fach, name, link, web) {
  if (!fach) { return null; }
  var s = { id: 'se-' + sdKennung(), name: String(name || '').trim().slice(0, 80),
    link: sdLinkSauber(link), link_web: sdLinkSauber(web), bild: '', unter: [],
    ordnung: sdOrdnung(fach.seiten), geaendert: Date.now() };
  fach.seiten.push(s);
  sdGeaendert();
  return s;
}

function sdUnterNeu(seite, name, link, web) {
  if (!seite) { return null; }
  var u = { id: 'un-' + sdKennung(), name: String(name || '').trim().slice(0, 80),
    link: sdLinkSauber(link), link_web: sdLinkSauber(web),
    ordnung: sdOrdnung(seite.unter), geaendert: Date.now() };
  seite.unter.push(u);
  sdGeaendert();
  return u;
}

/* Verschiebt einen Eintrag in seiner Liste um eine Stelle (SD-06).
   Es tauschen genau zwei Datensätze ihre Stelle — nicht die ganze Liste
   wird neu durchnummeriert. Sonst trüge jedes Verschieben alle übrigen
   Datensätze mit frischem Stempel in den Abgleich. */
function sdSchieben(liste, id, richtung) {
  var i = liste.map(function (x) { return x.id; }).indexOf(id);
  var j = i + (richtung < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= liste.length) { return false; }
  var a = liste[i], b = liste[j];
  var o = a.ordnung;
  a.ordnung = b.ordnung;
  b.ordnung = o;
  sdStempeln(a);
  sdStempeln(b);
  liste[i] = b;
  liste[j] = a;
  sdGeaendert();
  return true;
}

function sdEntfernen(liste, id) {
  var i = liste.map(function (x) { return x.id; }).indexOf(id);
  if (i < 0) { return false; }
  sdGrabsteinSetzen(id);
  liste.splice(i, 1);
  sdGeaendert();
  return true;
}

/* ---------- Ablage: eine Datei auf dem Rechner ---------- */

/* Läuft die Seite in einem fremden Rahmen — etwa einer Vorschau?
   Dort verbietet der Browser jede Dateiauswahl, egal was die App will.
   Der Zugriff auf window.top wirft bei fremdem Ursprung; dann ist die
   Antwort erst recht ja. */
function sdImRahmen() {
  if (typeof window === 'undefined') { return false; }
  try { return window.self !== window.top; } catch (e) { return true; }
}

/* Ein Rahmen allein ist kein Grund (seit 0.7.0). Verboten ist die
   Dateiauswahl nur in einem Rahmen FREMDER Herkunft — in einem Rahmen
   derselben Herkunft erlaubt der Browser sie, nachgemessen in Chrome:
   dort kommt AbortError, nicht SecurityError. Erst das macht es möglich,
   dass der Schreibtisch im Desk von CLIE läuft, beide vom selben Ort.
   Lässt sich die Herkunft nicht vergleichen, gilt der Rahmen als fremd —
   lieber ein Knopf weniger als einer, der nie funktioniert. */
function sdFremderRahmen() {
  if (!sdImRahmen()) { return false; }
  try {
    var hier = window.location.origin;
    var oben = window.top.location.origin;
    if (!hier || hier === 'null' || !oben || oben === 'null') { return true; }
    return hier !== oben;
  } catch (e) { return true; }
}

/* Es genügt nicht zu fragen, ob es die Dateiauswahl GIBT. Im fremden Rahmen
   gibt es sie und sie darf nicht — dann bietet die App einen Knopf an, der
   nie funktionieren kann. Also beides fragen: vorhanden und erlaubt. */
function sdFsApiDa() {
  if (typeof window === 'undefined') { return false; }
  if (typeof window.showOpenFilePicker !== 'function') { return false; }
  if (typeof window.showSaveFilePicker !== 'function') { return false; }
  if (sdFremderRahmen()) { return false; }
  return true;
}

function sdIdb() {
  return new Promise(function (ja, nein) {
    if (typeof indexedDB === 'undefined') { nein(new Error('kein IndexedDB')); return; }
    var a = indexedDB.open(SD_IDB_NAME, 1);
    a.onupgradeneeded = function () { a.result.createObjectStore(SD_IDB_STORE); };
    a.onsuccess = function () { ja(a.result); };
    a.onerror = function () { nein(a.error); };
  });
}

function sdGriffMerken(griff) {
  return sdIdb().then(function (db) {
    return new Promise(function (ja, nein) {
      var t = db.transaction(SD_IDB_STORE, 'readwrite');
      t.objectStore(SD_IDB_STORE).put(griff, SD_IDB_KEY);
      t.oncomplete = function () { ja(true); };
      t.onerror = function () { nein(t.error); };
    });
  }).catch(function () { return false; });
}

function sdGriffHolen() {
  return sdIdb().then(function (db) {
    return new Promise(function (ja) {
      var t = db.transaction(SD_IDB_STORE, 'readonly');
      var a = t.objectStore(SD_IDB_STORE).get(SD_IDB_KEY);
      a.onsuccess = function () { ja(a.result || null); };
      a.onerror = function () { ja(null); };
    });
  }).catch(function () { return null; });
}

var sdGriff = null;
var sdSicherUhr = null;

function sdAlsText() {
  return JSON.stringify(DB, null, 1);
}

/* Aus Text wird Bestand. Unbekannte Felder bleiben stehen — eine ältere
   Fassung darf nicht löschen, was sie nur nicht versteht. */
function sdAusText(text) {
  var roh;
  try { roh = JSON.parse(text); } catch (e) { return null; }
  if (!roh || typeof roh !== 'object') { return null; }
  if (!Array.isArray(roh.faecher)) { roh.faecher = []; }
  if (!Array.isArray(roh.planung)) { roh.planung = []; }
  if (!roh.grabsteine || typeof roh.grabsteine !== 'object') { roh.grabsteine = {}; }
  /* Ein fehlender Stempel wird 0, nicht „jetzt“. Eine alte Datei darf beim
     Einlesen nicht jünger werden, als sie ist — sonst gewinnt sie gegen
     alles, was seitdem woanders entstanden ist. */
  sdStempelFuellen(roh.planung);
  roh.faecher.forEach(function (f) {
    if (!Array.isArray(f.seiten)) { f.seiten = []; }
    if (!Array.isArray(f.leiste)) { f.leiste = []; }
    f.seiten.forEach(function (s) {
      if (!Array.isArray(s.unter)) { s.unter = []; }
      if (typeof s.bild !== 'string') { s.bild = ''; }
      sdStempelFuellen(s.unter);
    });
    sdStempelFuellen(f.seiten);
    sdStempelFuellen(f.leiste);
  });
  sdStempelFuellen(roh.faecher);
  return roh;
}

function sdStempelFuellen(liste) {
  liste.forEach(function (x, i) {
    if (typeof x.geaendert !== 'number') { x.geaendert = 0; }
    if (typeof x.ordnung !== 'number') { x.ordnung = i; }
  });
  return liste;
}

function sdSpaeterSichern() {
  if (sdSicherUhr) { window.clearTimeout(sdSicherUhr); }
  sdSicherUhr = window.setTimeout(function () { sdSichern(); }, 700);
}

/* Schreibt den Bestand weg und sagt hinterher die Wahrheit darüber.
   Die alte Fassung meldete „Zuletzt gesichert 17:23" auch dann, wenn nur
   der Browserspeicher gegriffen hatte oder gar nichts — eine Zeile, die
   Sicherheit vortäuscht, ist schlimmer als keine Zeile. */
function sdSichern() {
  var text = sdAlsText();
  var lokal = false;
  try { window.localStorage.setItem(SD_LS_KEY, text); lokal = true; } catch (e) { lokal = false; }

  function ohneDatei(f) {
    sd.weg = lokal ? 'lokal' : 'nichts';
    sd.gesichert = lokal ? sdUhrzeit() : '';
    if (f) { sdFehlerZeigen('In die Datei schreiben ging nicht', f); }
    sdAblageNachziehen();
    /* Auch ohne Datei soll der Abgleich laufen: In der privaten Fassung
       ist Drive die Ablage, die Datei nur die Bequemlichkeit. */
    if (sdHaken.nachSichern && !sdHakenAus) { sdHaken.nachSichern(); }
    return false;
  }

  if (!sdGriff) { return Promise.resolve(ohneDatei(null)); }

  return sdGriff.createWritable().then(function (w) {
    return w.write(text).then(function () { return w.close(); });
  }).then(function () {
    sd.weg = 'datei';
    sd.gesichert = sdUhrzeit();
    sdAblageNachziehen();
    if (sdHaken.nachSichern && !sdHakenAus) { sdHaken.nachSichern(); }
    return true;
  }).catch(ohneDatei);
}

/* Sichert, ohne den Haken auszulösen. Nach einem Abgleich muss der
   Bestand weggeschrieben werden — aber er darf nicht sofort den nächsten
   Abgleich anstoßen, sonst dreht sich das im Kreis. */
var sdHakenAus = false;

function sdSichernOhneHaken() {
  sdHakenAus = true;
  function fertig(x) { sdHakenAus = false; return x; }
  return sdSichern().then(fertig, function (f) { fertig(null); throw f; });
}

/* Die Ablagezeile steht je nach Ansicht in der Mappe oder auf dem Tisch.
   Nach dem Sichern muss die nachgezogen werden, die gerade da ist. */
function sdAblageNachziehen() {
  if (sd.sicht === 'fach' || sdIstSchmal()) { sdFlaecheZeichnen(); }
  else { sdMappeZeichnen(); }
}

/* Nach dem Anlegen einmal zurücklesen. Erst wenn das, was in der Datei
   steht, dem entspricht, was hineingeschrieben wurde, ist die Ablage
   wirklich da. Sonst meldet die App es, statt es zu glauben. */
function sdDateiPruefen() {
  if (!sdGriff) { return Promise.resolve(false); }
  var soll = sdAlsText();
  return sdGriff.getFile().then(function (d) { return d.text(); }).then(function (ist) {
    if (ist === soll) { return true; }
    melde('Die Datei wurde angelegt, enthält aber nicht, was hineingeschrieben wurde '
      + '(' + (ist ? ist.length : 0) + ' statt ' + soll.length + ' Zeichen). '
      + 'Verlass dich nicht darauf — nimm „Herunterladen“.', 'warn');
    return false;
  }).catch(function (f) {
    sdFehlerZeigen('Die angelegte Datei ließ sich nicht zurücklesen', f);
    return false;
  });
}

/* Ein abgebrochener Dialog ist keine Störung. Alles andere schon — und
   dann wird nicht nur gemeckert, sondern der Weg gezeigt, der noch geht. */
function sdPickerGescheitert(wobei, f, rueckfall) {
  if (f && f.name === 'AbortError') { return; }
  sdFehlerZeigen(wobei, f);
  sdFsGesperrt = true;
  zeichne();
  if (rueckfall) { rueckfall(); }
}

var sdFsGesperrt = false;

function sdDateiWaehlen() {
  if (!sdFsApiDa() || sdFsGesperrt) { sdDateiHochladen(); return; }
  window.showOpenFilePicker({
    types: [{ description: 'Schreibtisch', accept: { 'application/json': ['.json'] } }],
    multiple: false
  }).then(function (l) {
    var griff = l[0];
    return griff.getFile().then(function (d) { return d.text(); }).then(function (text) {
      var frisch = sdAusText(text);
      if (!frisch) { throw new Error('Die Datei ist nicht lesbar.'); }
      sdGriff = griff;
      sd.dateiName = griff.name;
      DB = frisch;
      sd.weg = 'datei';
      return sdGriffMerken(griff);
    });
  }).then(function () {
    sd.sicht = 'tisch';
    sd.fachId = '';
    melde('Datei geöffnet: ' + sd.dateiName, 'gut');
    zeichne();
  }).catch(function (f) {
    sdPickerGescheitert('Die Datei ließ sich nicht öffnen', f, null);
  });
}

function sdDateiAnlegen() {
  if (!sdFsApiDa() || sdFsGesperrt) { sdDateiHerunterladen(); return; }
  window.showSaveFilePicker({
    suggestedName: 'schreibtisch.json',
    types: [{ description: 'Schreibtisch', accept: { 'application/json': ['.json'] } }]
  }).then(function (griff) {
    sdGriff = griff;
    sd.dateiName = griff.name;
    /* Erst schreiben, dann den Griff merken: Das Merken ist eine
       Bequemlichkeit, das Schreiben ist der Zweck. Scheitert IndexedDB,
       darf das die Ablage nicht aufhalten. */
    return sdSichern().then(function (gut) {
      return gut ? sdDateiPruefen() : false;
    }).then(function (geprueft) {
      return sdGriffMerken(griff).then(function () { return geprueft; });
    });
  }).then(function (geprueft) {
    if (geprueft) { melde('Datei angelegt und geprüft: ' + sd.dateiName, 'gut'); }
    zeichne();
  }).catch(function (f) {
    sdGriff = null;
    sd.dateiName = '';
    sdPickerGescheitert('Die Datei ließ sich nicht anlegen', f, null);
  });
}

/* Für Safari, das keinen Dateigriff kennt: herunterladen und hochladen. */
function sdDateiHerunterladen() {
  var b = new Blob([sdAlsText()], { type: 'application/json' });
  var u = URL.createObjectURL(b);
  var a = document.createElement('a');
  a.href = u;
  a.download = 'schreibtisch-' + SD_FASSUNG + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
}

function sdDateiHochladen() {
  var e = document.createElement('input');
  e.type = 'file';
  e.accept = 'application/json,.json';
  e.onchange = function () {
    var d = e.files && e.files[0];
    if (!d) { return; }
    d.text().then(function (text) {
      var frisch = sdAusText(text);
      if (!frisch) { melde('Die Datei ist nicht lesbar.', 'warn'); return; }
      DB = frisch;
      sd.dateiName = d.name;
      sd.weg = 'lokal';
      sd.sicht = 'tisch';
      sd.fachId = '';
      sdSichern();
      melde('Datei geladen: ' + d.name, 'gut');
      zeichne();
    });
  };
  e.click();
}

function sdLaden() {
  return sdGriffHolen().then(function (griff) {
    if (!griff) { return null; }
    if (!griff.queryPermission) { return null; }
    return griff.queryPermission({ mode: 'readwrite' }).then(function (r) {
      if (r !== 'granted') { return null; }
      sdGriff = griff;
      sd.dateiName = griff.name;
      return griff.getFile().then(function (d) { return d.text(); });
    }).catch(function () { return null; });
  }).then(function (text) {
    if (text) {
      var frisch = sdAusText(text);
      if (frisch) { DB = frisch; sd.weg = 'datei'; return true; }
    }
    var roh = null;
    try { roh = window.localStorage.getItem(SD_LS_KEY); } catch (e) { roh = null; }
    if (roh) {
      var l = sdAusText(roh);
      if (l) { DB = l; sd.weg = 'lokal'; return true; }
    }
    return false;
  }).catch(function () { return false; });
}

/* ============================================================
   Zusammenführen — je Datensatz, nicht je Datei

   Die Regeln, Wort für Wort aus der Workbench übernommen, weil sie sich
   dort bewährt haben:
     · Verglichen wird je Kennung, nicht je Liste.
     · Der jüngere Stempel gewinnt. Gleichstand heißt gleiche Fassung und
       ist kein Konflikt — dann bleibt, was da ist.
     · Ein Datensatz, den nur eine Seite kennt, kommt mit. Fehlen heißt
       „noch nicht gesehen“, nicht „gelöscht“.
     · Gelöscht wird nur gegen einen Grabstein, und nur wenn der Tod
       jünger ist als beide Fassungen. Sonst gewinnt eine spätere
       Änderung gegen eine frühere Löschung.
     · Verschachtelt wird mitgeführt: Ein neuerer Fachname überschreibt
       nicht die Seiten, die währenddessen woanders entstanden sind.
   ============================================================ */

function sdPaare(a, b) {
  var nach = {};
  var reihe = [];
  function dazu(x, wo) {
    if (!x || !x.id) { return; }
    if (!nach[x.id]) { nach[x.id] = { id: x.id }; reihe.push(nach[x.id]); }
    nach[x.id][wo] = x;
  }
  (a || []).forEach(function (x) { dazu(x, 'a'); });
  (b || []).forEach(function (x) { dazu(x, 'b'); });
  return reihe;
}

function sdTot(grabsteine, id, za, zb) {
  var t = grabsteine[id];
  if (!t) { return false; }
  return t >= Math.max(za || 0, zb || 0);
}

function sdSortieren(liste) {
  return liste.sort(function (x, y) {
    var o = (x.ordnung || 0) - (y.ordnung || 0);
    return o !== 0 ? o : (x.id < y.id ? -1 : (x.id > y.id ? 1 : 0));
  });
}

/* Führt eine flache Liste zusammen. tiefer darf den Gewinner noch
   ergänzen — dort hängen die Seiten und Unterseiten dran. */
function sdListeZusammen(a, b, grabsteine, bericht, tiefer) {
  var raus = [];
  sdPaare(a, b).forEach(function (paar) {
    var x = paar.a, y = paar.b;
    var zx = x ? (x.geaendert || 0) : 0;
    var zy = y ? (y.geaendert || 0) : 0;
    if (sdTot(grabsteine, paar.id, zx, zy)) { bericht.entfernt++; return; }
    if (x && y) {
      var sieger = (zy > zx) ? y : x;
      var verlierer = (sieger === y) ? x : y;
      if (zy > zx) { bericht.ersetzt++; } else { bericht.behalten++; }
      raus.push(tiefer ? tiefer(sieger, verlierer, grabsteine, bericht) : sieger);
    } else {
      var einer = x || y;
      bericht.neu++;
      raus.push(tiefer ? tiefer(einer, null, grabsteine, bericht) : einer);
    }
  });
  return sdSortieren(raus);
}

function sdSeiteZusammen(sieger, verlierer, grabsteine, bericht) {
  var z = {};
  Object.keys(sieger).forEach(function (k) { z[k] = sieger[k]; });
  z.unter = sdListeZusammen(sieger.unter || [], verlierer ? (verlierer.unter || []) : [],
    grabsteine, bericht, null);
  return z;
}

function sdFachZusammen(sieger, verlierer, grabsteine, bericht) {
  var z = {};
  Object.keys(sieger).forEach(function (k) { z[k] = sieger[k]; });
  z.seiten = sdListeZusammen(sieger.seiten || [], verlierer ? (verlierer.seiten || []) : [],
    grabsteine, bericht, sdSeiteZusammen);
  z.leiste = sdListeZusammen(sieger.leiste || [], verlierer ? (verlierer.leiste || []) : [],
    grabsteine, bericht, null);
  return z;
}

function sdZusammenfuehren(lokal, fremd) {
  var bericht = { neu: 0, ersetzt: 0, behalten: 0, entfernt: 0 };
  var grabsteine = {};
  [lokal.grabsteine || {}, fremd.grabsteine || {}].forEach(function (g) {
    Object.keys(g).forEach(function (id) {
      if (!grabsteine[id] || g[id] > grabsteine[id]) { grabsteine[id] = g[id]; }
    });
  });
  var ergebnis = {
    fassung: SD_DATEI_FASSUNG,
    faecher: sdListeZusammen(lokal.faecher, fremd.faecher, grabsteine, bericht, sdFachZusammen),
    planung: sdListeZusammen(lokal.planung, fremd.planung, grabsteine, bericht, null),
    grabsteine: grabsteine,
    geaendert: Math.max(lokal.geaendert || 0, fremd.geaendert || 0)
  };
  /* Unbekannte Felder oben: beide Seiten durchreichen, die lokale zuletzt. */
  [fremd, lokal].forEach(function (q) {
    Object.keys(q).forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(ergebnis, k)) { ergebnis[k] = q[k]; }
    });
  });
  sdGrabsteineAufraeumen(ergebnis);
  return { db: ergebnis, bericht: bericht };
}

/* ---------- Zoom ----------
   Wie groß die Papierstapel sind, ist eine Ansichtssache und gehört
   zum Gerät, nicht zum Bestand: Der PC und das Pixel wollen
   verschiedene Größen. Deshalb steht die Stufe im Browserspeicher und
   nicht in schreibtisch.json — sonst schöbe der Abgleich dir die
   PC-Einstellung aufs Handy.

   Gezoomt wird nur das Papier, nicht die Schrift. Auf der kleinsten
   Stufe wären die Namen sonst bei 13 Pixeln und nicht mehr lesbar. */

var SD_ZOOM = [0.78, 1, 1.26, 1.58];
var SD_ZOOM_KEY = 'schreibtisch-zoom';
var sdZoomStufe = 1;

function sdZoomLesen() {
  try {
    var v = parseInt(window.localStorage.getItem(SD_ZOOM_KEY), 10);
    if (!isNaN(v) && v >= 0 && v < SD_ZOOM.length) { sdZoomStufe = v; }
  } catch (e) { /* gesperrt oder leer: dann die mittlere Stufe */ }
  sdZoomAnwenden();
}

function sdZoomAnwenden() {
  var w = document.documentElement;
  if (w && w.style && w.style.setProperty) {
    w.style.setProperty('--z', String(SD_ZOOM[sdZoomStufe]));
  }
}

function sdZoomSetzen(richtung) {
  var n = sdZoomStufe + richtung;
  if (n < 0 || n >= SD_ZOOM.length) { return false; }
  sdZoomStufe = n;
  try { window.localStorage.setItem(SD_ZOOM_KEY, String(n)); } catch (e) { /* egal */ }
  sdZoomAnwenden();
  sdPlanungZeichnen();
  return true;
}

/* ---------- Breite ---------- */

function sdBreite(w) {
  var b = (typeof w === 'number') ? w : (typeof window !== 'undefined' ? window.innerWidth : 1200);
  var schmal = b < SD_SCHMAL;
  if (typeof document !== 'undefined' && document.body) {
    document.body.className = (schmal ? 'b-schmal' : 'b-weit') + (sd.bearbeiten ? ' bearbeiten' : '');
  }
  return schmal ? 'schmal' : 'weit';
}

function sdIstSchmal() {
  return typeof document !== 'undefined' && document.body
    && document.body.className.indexOf('b-schmal') >= 0;
}

/* ---------- Meldung ---------- */

var sdMeldeUhr = null;

/* Eine gute Nachricht darf gehen. Eine schlechte bleibt stehen, bis man
   sie wegklickt: Ein Fehler, der sich nach fünf Sekunden selbst wegräumt,
   ist genau dann weg, wenn man ihn vorlesen will. */
function melde(text, art) {
  var el = document.getElementById('meldung');
  if (!el) { return; }
  var warn = (art === 'warn');
  el.innerHTML = '<span class="wort">' + esc(text).replace(/\n/g, '<br>') + '</span>'
    + (warn ? '<button type="button" class="zu" onclick="sdMeldungZu()" aria-label="Meldung schließen">&#215;</button>' : '');
  el.className = 'meldung' + (warn ? ' warn' : '');
  el.hidden = false;
  if (sdMeldeUhr) { window.clearTimeout(sdMeldeUhr); sdMeldeUhr = null; }
  if (!warn) { sdMeldeUhr = window.setTimeout(function () { el.hidden = true; }, 2800); }
}

function sdMeldungZu() {
  var el = document.getElementById('meldung');
  if (el) { el.hidden = true; }
}

/* Fehler im Klartext: der Name des Fehlers sagt mehr als sein Satz.
   NotAllowedError heißt Richtlinie, SecurityError heißt Rahmen oder
   Ursprung, NotFoundError heißt die Datei ist weg. */
function sdFehlerZeigen(wobei, f) {
  var name = (f && f.name) ? f.name : 'Fehler';
  var satz = (f && f.message) ? f.message : 'kein Grund genannt';
  var rat = '';
  if (name === 'SecurityError' && sdFremderRahmen()) {
    rat = '\nDie Seite läuft in einer Vorschau. Lade die Datei herunter und öffne sie von deinem Rechner.';
  } else if (name === 'NotAllowedError') {
    rat = '\nDer Browser oder eine Richtlinie verweigert den Zugriff. Nimm „Herunterladen“.';
  } else if (name === 'NotFoundError') {
    rat = '\nDie Datei gibt es nicht mehr. Wähle sie neu oder lege eine neue an.';
  }
  melde(wobei + ': ' + name + ' — ' + satz + rat, 'warn');
}

/* ---------- Zeichnen ---------- */

function zeichne() {
  sdBreite();
  sdPlanungZeichnen();
  sdFlaecheZeichnen();
  sdMappeZeichnen();
}

function sdPlanungZeichnen() {
  var el = document.getElementById('planung');
  if (!el) { return; }
  /* Im Bearbeiten-Modus ist ein Eintrag kein Link mehr, sondern sein
     Name als Knopf plus zwei Pfeile. Damit gibt es keinen Klickgriff
     mehr, der die <a> durchzählt und sich am „Im Browser“-Pfeil
     verzählt — am 13.11.2026 öffnete ein Klick auf „Stundenplan“ den
     Eintrag „Block“. Gesucht wird nach Kennung, nicht nach Stelle. */
  var links = (DB.planung || []).map(function (p) {
    if (!sd.bearbeiten) { return sdVerweisHtml(p, 'planung'); }
    var s = esc(p.id);
    return '<span class="pl-halter">'
      + '<button type="button" class="pl-name" onclick="sdPlanungFenster(\'' + s + '\')"'
      + ' title="ändern oder entfernen">' + esc(p.name) + '</button>'
      + '<button type="button" class="pl-pfeil" onclick="sdPlanungStellen(\'' + s + '\',\'vor\')"'
      + ' aria-label="weiter nach vorn">&#9664;</button>'
      + '<button type="button" class="pl-pfeil" onclick="sdPlanungStellen(\'' + s + '\',\'zurueck\')"'
      + ' aria-label="weiter nach hinten">&#9654;</button>'
      + '</span>';
  }).join('');
  el.innerHTML = links
    + '<span class="luecke"></span>'
    + '<span class="zoom">'
    + '<button type="button" class="stift"' + (sdZoomStufe === 0 ? ' disabled' : '')
    + ' onclick="sdZoomSetzen(-1)" title="Stapel kleiner" aria-label="Stapel kleiner">&#8722;</button>'
    + '<button type="button" class="stift"' + (sdZoomStufe === SD_ZOOM.length - 1 ? ' disabled' : '')
    + ' onclick="sdZoomSetzen(1)" title="Stapel größer" aria-label="Stapel größer">+</button>'
    + '</span>'
    + (sd.bearbeiten ? '<button type="button" class="stift" onclick="sdPlanungNeu()">+ Link</button>' : '')
    + '<button type="button" class="stift' + (sd.bearbeiten ? ' an' : '') + '" onclick="sdBearbeitenUm()">'
    + (sd.bearbeiten ? 'Fertig' : 'Bearbeiten') + '</button>';
}

/* Der Weg, den ein Verweis zuerst nimmt: onenote: öffnet OneNote selbst
   und lässt den Schreibtisch stehen. Die Web-Adresse ist der Rückfall —
   und auf dem iPad, wo onenote: nicht immer greift, der zweite Knopf. */
function sdZiel(p) {
  return sdLinkSauber(p.link) || sdLinkSauber(p.link_web);
}

function sdHatBeide(p) {
  return !!sdLinkSauber(p.link) && !!sdLinkSauber(p.link_web);
}

/* ============================================================
   Woran erkennt man, was hinter einem Verweis liegt?

   OneNote wird NICHT gekennzeichnet: Es ist die Regel, nicht die
   Ausnahme, und ein Zeichen an jedem Blatt wäre Rauschen. Gezeigt wird
   nur, was anders ist — eine Tabelle, ein eingescannter Plan, eine
   Confluence-Seite.

   Erkannt wird aus der Adresse, nicht aus einem Feld: Nichts zu pflegen
   heißt nichts, was veralten kann. SharePoint und OneDrive tragen die
   Art im Pfad (/:w:/ Word, /:x:/ Excel, /:p:/ PowerPoint, /:b:/ PDF,
   /:i:/ Bild, /:o:/ OneNote) — das ist zuverlässiger als die Endung,
   die dort oft gar nicht in der Adresse steht. Die Endung ist der
   zweite Weg, Confluence der dritte.

   Was sich nicht sicher erkennen lässt, bekommt kein Zeichen. Lieber
   nichts sagen als etwas Falsches — dieselbe Regel wie beim Lesen der
   OneNote-Links.
   ============================================================ */

/* Die Kürzel bleiben bei vier Zeichen: Auf der kleinsten Zoomstufe ist
   das Blatt 81 Pixel breit, da passt „confluence“ nicht hin. */
var SD_MARKEN = [
  { muster: /\/:w:\//i,  marke: 'docx' },
  { muster: /\/:x:\//i,  marke: 'xlsx' },
  { muster: /\/:p:\//i,  marke: 'pptx' },
  { muster: /\/:b:\//i,  marke: 'pdf' },
  { muster: /\/:i:\//i,  marke: 'bild' },
  { muster: /\/:v:\//i,  marke: 'film' },
  { muster: /\.pdf(\b|$)/i,                              marke: 'pdf' },
  { muster: /\.(docx?|docm|dotx|rtf)(\b|$)/i,            marke: 'docx' },
  { muster: /\.(xlsx?|xlsm|xlsb|csv)(\b|$)/i,            marke: 'xlsx' },
  { muster: /\.(pptx?|ppsx|pptm)(\b|$)/i,                marke: 'pptx' },
  { muster: /\.(png|jpe?g|gif|svg|webp|bmp|tiff?|heic)(\b|$)/i, marke: 'bild' },
  { muster: /\.(mp4|mov|avi|mkv|webm)(\b|$)/i,           marke: 'film' },
  { muster: /atlassian\.net\/wiki\//i,                   marke: 'wiki' },
  { muster: /\/(confluence|wiki)\//i,                    marke: 'wiki' },
  { muster: /\/display\/|\/pages\/viewpage\.action/i,    marke: 'wiki' }
];

function sdIstOneNote(adresse) {
  var a = String(adresse || '');
  if (/^onenote:/i.test(a)) { return true; }
  if (/\/:o:\//i.test(a)) { return true; }
  if (/\.one(\b|$)/i.test(a)) { return true; }
  if (/[?&]wd=target/i.test(a)) { return true; }
  if (/onenote\.com/i.test(a)) { return true; }
  return false;
}

function sdMarkeAus(adresse) {
  /* Nur der Pfad zählt; in den Parametern stehen Kennungen und
     Dateinamen anderer Dinge, die sonst falsch anschlügen. */
  var ganz = String(adresse || '');
  var pfad = ganz.split('#')[0].split('?')[0];
  var i;
  for (i = 0; i < SD_MARKEN.length; i++) {
    if (SD_MARKEN[i].muster.test(pfad)) { return SD_MARKEN[i].marke; }
  }
  return '';
}

function sdArtAusLink(p) {
  var beide = [sdLinkSauber(p && p.link), sdLinkSauber(p && p.link_web)]
    .filter(function (x) { return !!x; });
  var i, m;
  for (i = 0; i < beide.length; i++) {
    if (sdIstOneNote(beide[i])) { return ''; }
  }
  for (i = 0; i < beide.length; i++) {
    m = sdMarkeAus(beide[i]);
    if (m) { return m; }
  }
  return '';
}

function sdMarkeHtml(p, klasse) {
  var m = sdArtAusLink(p);
  return m ? '<span class="' + klasse + '">' + esc(m) + '</span>' : '';
}

/* Ein Öffnen-Knopf, überall gleich gebaut: der Hauptweg über onenote:,
   daneben „Im Browser“, sobald beide Adressen da sind. */
function sdOeffnenHtml(p, klasse, text) {
  var ziel = sdZiel(p);
  if (!ziel) { return ''; }
  var neu = /^https:/i.test(ziel) ? ' target="_blank" rel="noopener"' : '';
  return '<a class="' + klasse + '" href="' + esc(ziel) + '"' + neu + '>' + esc(text) + '</a>'
    + (sdHatBeide(p)
      ? '<a class="' + klasse + ' zweitweg" href="' + esc(p.link_web) + '"'
        + ' target="_blank" rel="noopener">Im Browser</a>'
      : '');
}

/* Ein Verweis. onenote: lässt die App stehen; https: geht in ein neues
   Fenster, sonst wäre der Schreibtisch weg (SD-13). */
function sdVerweisHtml(p, wo) {
  var ziel = sdZiel(p);
  var neu = /^https:/i.test(ziel) ? ' target="_blank" rel="noopener"' : '';
  if (!ziel) {
    return '<a class="ohne" aria-disabled="true" title="kein Link">' + esc(p.name) + '</a>';
  }
  /* Der kleine Pfeil gehört in eine Verweisliste, nicht in eine
     Navigationsleiste: Dort sähe er aus wie ein weiterer Menüpunkt,
     und der Platz ist ohnehin knapp. */
  var pfeil = (sdHatBeide(p) && wo !== 'planung')
    ? '<a class="imweb" href="' + esc(p.link_web) + '" target="_blank" rel="noopener"'
      + ' title="im Browser öffnen" aria-label="im Browser öffnen">&#8599;</a>'
    : '';
  return '<a href="' + esc(ziel) + '"' + neu + ' data-wo="' + esc(wo) + '"'
    + ' data-id="' + esc(p.id || '') + '">' + esc(p.name) + '</a>'
    + (wo === 'planung' ? '' : sdMarkeHtml(p, 'marke-zeile')) + pfeil;
}

function sdFlaecheZeichnen() {
  var el = document.getElementById('flaeche');
  if (!el) { return; }
  el.innerHTML = (sd.sicht === 'fach' && sdFach(sd.fachId)) ? sdFachHtml() : sdTischHtml();
}

function sdTischHtml() {
  var h = '';
  if (!DB.faecher.length) {
    h += '<p class="reihe-titel">Noch kein Fach. Im Bearbeiten-Modus legst du das erste an.</p>';
  }
  h += sdReiheHtml('eigen', 'Eigene Fächer');
  h += '<div class="trenner"></div>';
  h += sdReiheHtml('zusammen', 'Zusammenarbeit');
  if (sd.bearbeiten) {
    h += '<div class="werkzeug"><button type="button" onclick="sdFachFenster(\'\',\'eigen\')">Fach anlegen</button>'
      + '<button type="button" onclick="sdFachFenster(\'\',\'zusammen\')">Zusammenarbeit anlegen</button></div>';
  }
  if (sdIstSchmal()) { h += sdAblageHtml(true); }
  return h;
}

function sdReiheHtml(reihe, titel) {
  var l = sdFaecher(reihe);
  var h = '<p class="reihe-titel">' + esc(titel) + '</p><div class="stapel-reihe">';
  h += l.map(function (f) { return sdStapelHtml(f); }).join('');
  h += '</div>';
  /* In der schmalen Ansicht klappt die Leiste unter dem gewählten Fach auf (SD-10) */
  return h;
}

function sdStapelHtml(f) {
  var gewaehlt = (f.id === sd.fachId);
  var h = '<div class="stapel-halter">';
  h += '<button type="button" class="stapel' + (gewaehlt ? ' gewaehlt' : '') + '"'
    + ' onclick="sdFachWaehlen(\'' + esc(f.id) + '\')"'
    + ' ondblclick="sdFachOeffnen(\'' + esc(f.id) + '\')">'
    + '<span class="lager"><span class="lage"></span><span class="lage"></span>'
    + '<span class="lage"></span><span class="lage">'
    + '<span class="reiter" style="background:' + esc(f.farbe) + '"></span></span></span>'
    + '<span class="beschriftung"><span class="name">' + esc(f.name) + '</span>'
    + (f.quelle ? '<span class="wohin">' + esc(f.quelle) + '</span>' : '')
    + '</span></button>';
  if (sd.bearbeiten) { h += sdStellerHtml('sdFachStellen', f.id, !sdIstSchmal()); }
  if (gewaehlt && sdIstSchmal()) { h += sdAufklappHtml(f); }
  h += '</div>';
  return h;
}

/* Was in der schmalen Ansicht unter dem Fach aufklappt. */
function sdAufklappHtml(f) {
  var h = '<div class="aufklapp">';
  h += '<ul class="verweise">'
    + f.leiste.map(function (p) { return '<li>' + sdVerweisHtml(p, 'leiste') + '</li>'; }).join('')
    + '</ul>';
  h += '<div class="knoepfe">'
    + '<button type="button" class="knopf" onclick="sdFachOeffnen(\'' + esc(f.id) + '\')">Seiten</button>'
    + sdOeffnenHtml(f, 'knopf', 'Abschnitt öffnen')
    + '</div></div>';
  return h;
}

function sdFachHtml() {
  var f = sdFach(sd.fachId);
  var h = '<div class="fachkopf"><h3>' + esc(f.name) + '</h3>'
    + '<button type="button" class="zur" onclick="sdZumTisch()">zurück zum Tisch</button>'
    + '<span class="luecke"></span>'
    + sdOeffnenHtml(f, 'aufheben', 'Abschnitt öffnen')
    + '</div>';

  h += '<div class="seiten">';
  h += f.seiten.map(function (s) { return sdSeiteHtml(f, s); }).join('');
  h += '</div>';
  if (!f.seiten.length) { h += '<p class="reihe-titel">Noch keine Seite. Im Bearbeiten-Modus trägst du die erste ein.</p>'; }
  if (sd.bearbeiten) {
    h += '<div class="werkzeug"><button type="button" onclick="sdSeiteFenster(\'\')">Seite anlegen</button></div>';
  }

  h += '<div class="fest"><p class="reihe-titel">Immer dabei</p><div class="seiten">';
  h += f.leiste.map(function (p) { return sdLeisteBlattHtml(f, p); }).join('');
  h += '</div>';
  if (sd.bearbeiten) {
    h += '<div class="werkzeug"><button type="button" onclick="sdLeisteFenster(\'\')">Verweis anlegen</button></div>';
  }
  h += '</div>';
  /* Die Fachansicht liegt immer auf dem Tisch, also immer die helle Schrift. */
  h += sdAblageHtml(true);
  return h;
}

function sdBlattHtml(klasse, name, aufruf, p) {
  return '<button type="button" class="seite' + klasse + '" ' + aufruf + '>'
    + '<span class="s-lager"><span class="s-blatt unten"></span>'
    + '<span class="s-blatt">' + sdMarkeHtml(p, 'marke') + '</span></span>'
    + '<span class="st">' + esc(name) + '</span></button>';
}

function sdSeiteHtml(f, s) {
  var offen = (s.id === sd.seiteId);
  var zusatz = '';
  if (offen) {
    zusatz = '<div class="unterseiten">';
    if (sdZiel(s)) {
      zusatz += '<div class="knoepfe">' + sdOeffnenHtml(s, 'knopf voll', 'Seite öffnen') + '</div>';
    } else {
      zusatz += '<p class="leise">Diese Seite hat noch keinen Link.</p>';
    }
    zusatz += '<ul class="verweise">'
      + s.unter.map(function (u) {
        return '<li>' + sdVerweisHtml(u, 'unter')
          + (sd.bearbeiten ? sdStellerHtml('sdUnterStellen', f.id + '|' + s.id + '|' + u.id) : '')
          + '</li>';
      }).join('')
      + '</ul>';
    if (!s.unter.length) { zusatz += '<p class="leise">Keine Unterseiten.</p>'; }
    if (sd.bearbeiten) {
      zusatz += '<div class="werkzeug">'
        + '<button type="button" onclick="sdUnterFenster(\'' + esc(s.id) + '\',\'\')">Unterseite anlegen</button>'
        + '<button type="button" onclick="sdSeiteFenster(\'' + esc(s.id) + '\')">Seite ändern</button>'
        + '</div>';
    }
    zusatz += '</div>';
  }
  var k = (offen ? ' offen' : '') + (sdZiel(s) ? '' : ' leer');
  var h = '<div class="seite-halter">'
    + sdBlattHtml(k, s.name, 'onclick="sdSeiteUm(\'' + esc(s.id) + '\')"', s)
    + (sd.bearbeiten ? sdStellerHtml('sdSeiteStellen', f.id + '|' + s.id, true) : '')
    + '</div>';
  return h + zusatz;
}

function sdLeisteBlattHtml(f, p) {
  var ziel = sdZiel(p);
  var auf = ziel
    ? 'onclick="sdGehe(\'' + esc(ziel) + '\')"'
    : 'onclick="melde(\'Für diesen Verweis ist noch kein Link eingetragen.\', null)"';
  return '<div class="seite-halter">'
    + sdBlattHtml(ziel ? '' : ' leer', p.name, auf, p)
    + (sd.bearbeiten ? sdStellerHtml('sdLeisteStellen', f.id + '|' + p.id, true) : '')
    + '</div>';
}

/* Die kleinen Steller im Bearbeiten-Modus: verschieben, ändern, weg.
   Was nebeneinander liegt, bekommt ◀ ▶; was untereinander steht, ↑ ↓.
   Ein Pfeil, der in eine andere Richtung zeigt als die Bewegung, die er
   auslöst, ist eine kleine Lüge — und man probiert ihn jedes Mal neu. */
function sdStellerHtml(ruf, schluessel, quer) {
  var s = esc(schluessel);
  return '<span class="steller">'
    + '<button type="button" onclick="' + ruf + '(\'' + s + '\',\'hoch\')"'
    + ' aria-label="' + (quer ? 'weiter nach vorn' : 'höher') + '">'
    + (quer ? '&#9664;' : '&#8593;') + '</button>'
    + '<button type="button" onclick="' + ruf + '(\'' + s + '\',\'runter\')"'
    + ' aria-label="' + (quer ? 'weiter nach hinten' : 'tiefer') + '">'
    + (quer ? '&#9654;' : '&#8595;') + '</button>'
    + '<button type="button" onclick="' + ruf + '(\'' + s + '\',\'aendern\')" aria-label="ändern">&#9998;</button>'
    + '<button type="button" onclick="' + ruf + '(\'' + s + '\',\'weg\')" aria-label="entfernen">&#215;</button>'
    + '</span>';
}

function sdMappeZeichnen() {
  var el = document.getElementById('mappe');
  if (!el) { return; }
  if (sdIstSchmal() || sd.sicht === 'fach') { el.innerHTML = ''; return; }
  var f = sdFach(sd.fachId);
  if (!f) {
    el.innerHTML = '<p class="leise">Ein Fach antippen zeigt hier seine Verweise.</p>' + sdAblageHtml(false);
    return;
  }
  var h = '<div class="mappe-kopf"><span class="fleck" style="background:' + esc(f.farbe) + '"></span>'
    + '<div><h3>' + esc(f.name) + '</h3>'
    + (f.quelle ? '<div class="quelle">' + esc(f.quelle) + '</div>' : '') + '</div></div>';
  h += '<ul class="verweise">'
    + f.leiste.map(function (p) {
      return '<li>' + sdVerweisHtml(p, 'leiste')
        + (sd.bearbeiten ? sdStellerHtml('sdLeisteStellen', f.id + '|' + p.id) : '') + '</li>';
    }).join('')
    + '</ul>';
  h += '<div class="knoepfe">'
    + '<button type="button" class="knopf" onclick="sdFachOeffnen(\'' + esc(f.id) + '\')">Seiten</button>'
    + (sd.bearbeiten ? '<button type="button" class="knopf" onclick="sdLeisteFenster(\'\')">+ Verweis</button>'
      + '<button type="button" class="knopf" onclick="sdFachFenster(\'' + esc(f.id) + '\',\'\')">Fach ändern</button>' : '')
    + '</div>';
  if (sdZiel(f)) {
    h += '<div class="oeffnen">' + sdOeffnenHtml(f, '', 'Abschnitt öffnen') + '</div>';
  }
  h += sdAblageHtml(false);
  el.innerHTML = h;
}

/* Sagt in einem Satz, wo der Bestand steht — und sagt „nicht gesichert“,
   wenn er nirgends steht, statt eine Uhrzeit zu zeigen. */
function sdAblageText() {
  if (sd.weg === 'datei') { return 'Datei: ' + esc(sd.dateiName || 'unbenannt'); }
  if (sd.weg === 'lokal') { return 'Nur in diesem Browser — nicht in einer Datei'; }
  if (sd.weg === 'nichts') { return '<b>Nichts wird gespeichert.</b> Beim Schließen ist alles weg.'; }
  return 'Noch keine Ablage gewählt';
}

function sdAblageHtml(hell) {
  var dateiweg = sdFsApiDa() && !sdFsGesperrt;
  var h = '<p class="ablage' + (hell ? ' hell' : '') + (sd.weg === 'nichts' ? ' alarm' : '') + '">'
    + sdAblageText()
    + (sd.gesichert ? '<br>Zuletzt gesichert ' + esc(sd.gesichert) : '');
  if (sdFremderRahmen()) {
    h += '<br>Diese Seite läuft in einer fremden Vorschau. Der Browser verbietet dort '
      + 'jede Dateiauswahl — lade die Datei herunter und öffne sie von deinem Rechner.';
  }
  h += '<br>'
    + '<button type="button" onclick="' + (dateiweg ? 'sdDateiWaehlen()' : 'sdDateiHochladen()') + '">'
    + (dateiweg ? 'Datei öffnen' : 'Datei laden') + '</button>'
    + ' · <button type="button" onclick="' + (dateiweg ? 'sdDateiAnlegen()' : 'sdDateiHerunterladen()') + '">'
    + (dateiweg ? 'Neue Datei' : 'Herunterladen') + '</button>';
  if (sdHaken.ablageZeile) { h += sdHaken.ablageZeile(); }
  return h + '</p>';
}

/* ---------- Wege ---------- */

function sdFachWaehlen(id) {
  sd.fachId = (sd.fachId === id && sdIstSchmal()) ? '' : id;
  sd.seiteId = '';
  sdFlaecheZeichnen();
  sdMappeZeichnen();
}

function sdFachOeffnen(id) {
  sd.fachId = id;
  sd.sicht = 'fach';
  sd.seiteId = '';
  zeichne();
}

function sdZumTisch() {
  sd.sicht = 'tisch';
  sd.seiteId = '';
  zeichne();
}

function sdSeiteUm(id) {
  sd.seiteId = (sd.seiteId === id) ? '' : id;
  sdFlaecheZeichnen();
}

/* Ein Sprung nach OneNote. onenote: nimmt das Betriebssystem an, ohne
   dass die Seite verlassen wird; https: geht in ein neues Fenster. */
function sdGehe(ziel) {
  if (!ziel) { return; }
  if (/^https:/i.test(ziel)) { window.open(ziel, '_blank', 'noopener'); return; }
  window.location.href = ziel;
}

function sdBearbeitenUm() {
  sd.bearbeiten = !sd.bearbeiten;
  zeichne();
}

/* ---------- Fenster ---------- */

function sdFensterZu() {
  sd.fenster = null;
  var f = document.getElementById('fenster');
  var s = document.getElementById('schleier');
  if (f) { f.hidden = true; f.innerHTML = ''; }
  if (s) { s.hidden = true; }
}

function sdFensterAuf(html) {
  var f = document.getElementById('fenster');
  var s = document.getElementById('schleier');
  if (!f || !s) { return; }
  f.innerHTML = html;
  f.hidden = false;
  s.hidden = false;
  var e = f.querySelector('input');
  if (e && e.focus) { e.focus(); }
}

function sdFeld(id) {
  var e = document.getElementById(id);
  return e ? String(e.value || '') : '';
}

/* Ein Feld für beide Adressen statt zweier Felder: „Link kopieren“ legt
   zwei Zeilen in die Zwischenablage, du fügst sie einmal ein, die App
   sortiert sie auseinander. */
function sdLinkFeldHtml(id, p) {
  var beide = [sdLinkSauber(p && p.link), sdLinkSauber(p && p.link_web)]
    .filter(function (x) { return !!x; }).join('\n');
  return '<label for="' + id + '">Link — aus OneNote „Link kopieren“, beide Zeilen einfügen</label>'
    + '<textarea id="' + id + '" class="eingabe linkfeld" rows="3" spellcheck="false"'
    + ' placeholder="onenote:…&#10;https://…">' + esc(beide) + '</textarea>';
}

/* Liest das Feld und sagt nein, statt stillschweigend nichts zu
   speichern: Ein Feld, in dem etwas steht, das aber leer gespeichert
   wird, merkt man erst Wochen später. */
function sdLinkFeldLesen(id) {
  var roh = sdFeld(id).trim();
  var e = sdLinkLesen(roh);
  if (roh && !e.onenote && !e.web) {
    melde('Darin steht keine onenote:- oder https-Adresse. Nimm in OneNote '
      + '„Link kopieren“ und füge beide Zeilen hier ein.', 'warn');
    return null;
  }
  if (!sdLinkOk(e.onenote) || !sdLinkOk(e.web)) {
    melde('Nur onenote:- und https-Adressen werden gespeichert.', 'warn');
    return null;
  }
  return e;
}

function sdFachFenster(id, reihe) {
  var f = id ? sdFach(id) : null;
  sd.fenster = { art: 'fach', id: id || '', reihe: f ? f.reihe : (reihe || 'eigen'),
    farbe: f ? f.farbe : SD_FARBEN[0] };
  sdFachFensterZeichnen();
}

function sdFachFensterZeichnen() {
  var w = sd.fenster;
  var f = w.id ? sdFach(w.id) : null;
  var farben = SD_FARBEN.map(function (c) {
    return '<button type="button" class="' + (c === w.farbe ? 'an' : '') + '"'
      + ' style="background:' + c + '" onclick="sdFachFarbe(\'' + c + '\')" aria-label="Farbe"></button>';
  }).join('');
  sdFensterAuf('<div class="titel">' + (f ? 'Fach ändern' : 'Neues Fach') + '</div><div class="rumpf">'
    + '<label for="sdFaName">Name</label>'
    + '<input id="sdFaName" class="eingabe" type="text" maxlength="60" value="' + esc(f ? f.name : '') + '">'
    + '<label>Reihe</label><div class="reihewahl">'
    + '<button type="button" class="' + (w.reihe === 'eigen' ? 'an' : '') + '" onclick="sdFachReihe(\'eigen\')">Eigenes Fach</button>'
    + '<button type="button" class="' + (w.reihe === 'zusammen' ? 'an' : '') + '" onclick="sdFachReihe(\'zusammen\')">Zusammenarbeit</button>'
    + '</div>'
    + '<label>Farbe des Abschnitts</label><div class="farbwahl">' + farben + '</div>'
    + '<label for="sdFaQuelle">Notizbuch (kann leer bleiben)</label>'
    + '<input id="sdFaQuelle" class="eingabe" type="text" maxlength="60" value="' + esc(f ? f.quelle : '') + '">'
    + sdLinkFeldHtml('sdFaLink', f)
    + '<div class="knoepfe"><button type="button" class="knopf voll" onclick="sdFachSpeichern()">OK</button>'
    + '<button type="button" class="knopf" onclick="sdFensterZu()">Abbrechen</button>'
    + (f ? '<button type="button" class="knopf weg" onclick="sdFachWeg()">Fach entfernen</button>' : '')
    + '</div></div>');
}

function sdFachFarbe(c) { sd.fenster.farbe = c; sdFachFensterZeichnen(); }
function sdFachReihe(r) { sd.fenster.reihe = r; sdFachFensterZeichnen(); }

function sdFachSpeichern() {
  var w = sd.fenster;
  var name = sdFeld('sdFaName').trim();
  var quelle = sdFeld('sdFaQuelle').trim();
  if (!name) { melde('Das Fach braucht einen Namen.', 'warn'); return; }
  var e = sdLinkFeldLesen('sdFaLink');
  if (!e) { return; }
  var f = w.id ? sdFach(w.id) : null;
  if (f) {
    f.name = name.slice(0, 60);
    f.reihe = w.reihe;
    f.farbe = w.farbe;
    f.link = e.onenote;
    f.link_web = e.web;
    f.quelle = quelle.slice(0, 60);
    sdStempeln(f);
    sdGeaendert();
  } else {
    f = sdFachNeu(name, w.reihe, w.farbe, e.onenote, quelle, e.web);
    sd.fachId = f.id;
  }
  sdFensterZu();
  zeichne();
}

function sdFachWeg() {
  var f = sdFach(sd.fenster.id);
  if (!f) { return; }
  sdEntfernen(DB.faecher, f.id);
  if (sd.fachId === f.id) { sd.fachId = ''; sd.sicht = 'tisch'; }
  sdFensterZu();
  zeichne();
}

function sdSeiteFenster(id) {
  var f = sdFach(sd.fachId);
  var s = id ? sdSeite(f, id) : null;
  sd.fenster = { art: 'seite', id: id || '' };
  sdFensterAuf('<div class="titel">' + (s ? 'Seite ändern' : 'Neue Seite') + '</div><div class="rumpf">'
    + '<label for="sdSeName">Name der Seite</label>'
    + '<input id="sdSeName" class="eingabe" type="text" maxlength="80" value="' + esc(s ? s.name : '') + '">'
    + sdLinkFeldHtml('sdSeLink', s)
    + '<div class="knoepfe"><button type="button" class="knopf voll" onclick="sdSeiteSpeichern()">OK</button>'
    + '<button type="button" class="knopf" onclick="sdFensterZu()">Abbrechen</button></div></div>');
}

function sdSeiteSpeichern() {
  var f = sdFach(sd.fachId);
  var name = sdFeld('sdSeName').trim();
  if (!f) { return; }
  if (!name) { melde('Die Seite braucht einen Namen.', 'warn'); return; }
  var e = sdLinkFeldLesen('sdSeLink');
  if (!e) { return; }
  var s = sd.fenster.id ? sdSeite(f, sd.fenster.id) : null;
  if (s) { s.name = name.slice(0, 80); s.link = e.onenote; s.link_web = e.web; sdStempeln(s); sdGeaendert(); }
  else { s = sdSeiteNeu(f, name, e.onenote, e.web); sd.seiteId = s.id; }
  sdFensterZu();
  sdFlaecheZeichnen();
}

function sdUnterFenster(seiteId, id) {
  var f = sdFach(sd.fachId);
  var s = sdSeite(f, seiteId);
  var u = id ? (s.unter || []).filter(function (x) { return x.id === id; })[0] : null;
  sd.fenster = { art: 'unter', seiteId: seiteId, id: id || '' };
  sdFensterAuf('<div class="titel">' + (u ? 'Unterseite ändern' : 'Neue Unterseite') + '</div><div class="rumpf">'
    + '<label for="sdUnName">Name</label>'
    + '<input id="sdUnName" class="eingabe" type="text" maxlength="80" value="' + esc(u ? u.name : '') + '">'
    + sdLinkFeldHtml('sdUnLink', u)
    + '<div class="knoepfe"><button type="button" class="knopf voll" onclick="sdUnterSpeichern()">OK</button>'
    + '<button type="button" class="knopf" onclick="sdFensterZu()">Abbrechen</button></div></div>');
}

function sdUnterSpeichern() {
  var f = sdFach(sd.fachId);
  var s = sdSeite(f, sd.fenster.seiteId);
  var name = sdFeld('sdUnName').trim();
  if (!s) { return; }
  if (!name) { melde('Die Unterseite braucht einen Namen.', 'warn'); return; }
  var e = sdLinkFeldLesen('sdUnLink');
  if (!e) { return; }
  var u = sd.fenster.id ? s.unter.filter(function (x) { return x.id === sd.fenster.id; })[0] : null;
  if (u) { u.name = name.slice(0, 80); u.link = e.onenote; u.link_web = e.web; sdStempeln(u); sdGeaendert(); }
  else { sdUnterNeu(s, name, e.onenote, e.web); }
  sdFensterZu();
  sdFlaecheZeichnen();
}

function sdLeisteFenster(id) {
  var f = sdFach(sd.fachId);
  var p = id ? f.leiste.filter(function (x) { return x.id === id; })[0] : null;
  sd.fenster = { art: 'leiste', id: id || '' };
  sdFensterAuf('<div class="titel">' + (p ? 'Verweis ändern' : 'Neuer Verweis') + '</div><div class="rumpf">'
    + '<label for="sdLeName">Name</label>'
    + '<input id="sdLeName" class="eingabe" type="text" maxlength="60" value="' + esc(p ? p.name : '') + '">'
    + sdLinkFeldHtml('sdLeLink', p)
    + '<div class="knoepfe"><button type="button" class="knopf voll" onclick="sdLeisteSpeichern()">OK</button>'
    + '<button type="button" class="knopf" onclick="sdFensterZu()">Abbrechen</button></div></div>');
}

function sdLeisteSpeichern() {
  var f = sdFach(sd.fachId);
  var name = sdFeld('sdLeName').trim();
  if (!f) { return; }
  if (!name) { melde('Der Verweis braucht einen Namen.', 'warn'); return; }
  var e = sdLinkFeldLesen('sdLeLink');
  if (!e) { return; }
  var p = sd.fenster.id ? f.leiste.filter(function (x) { return x.id === sd.fenster.id; })[0] : null;
  if (p) { p.name = name.slice(0, 60); p.link = e.onenote; p.link_web = e.web; sdStempeln(p); sdGeaendert(); }
  else {
    f.leiste.push({ id: 'lk-' + sdKennung(), name: name.slice(0, 60),
      link: e.onenote, link_web: e.web,
      ordnung: sdOrdnung(f.leiste), geaendert: Date.now() });
    sdGeaendert();
  }
  sdFensterZu();
  zeichne();
}

function sdPlanungNeu() {
  sd.fenster = { art: 'planung', id: '' };
  sdPlanungFensterZeichnen(null);
}

function sdPlanungFenster(id) {
  var p = (DB.planung || []).filter(function (x) { return x.id === id; })[0];
  sd.fenster = { art: 'planung', id: id };
  sdPlanungFensterZeichnen(p);
}

function sdPlanungFensterZeichnen(p) {
  sdFensterAuf('<div class="titel">' + (p ? 'Link ändern' : 'Neuer Link in der Planungsleiste') + '</div><div class="rumpf">'
    + '<label for="sdPlName">Name</label>'
    + '<input id="sdPlName" class="eingabe" type="text" maxlength="40" value="' + esc(p ? p.name : '') + '">'
    + sdLinkFeldHtml('sdPlLink', p)
    + '<div class="knoepfe"><button type="button" class="knopf voll" onclick="sdPlanungSpeichern()">OK</button>'
    + '<button type="button" class="knopf" onclick="sdFensterZu()">Abbrechen</button>'
    + (p ? '<button type="button" class="knopf weg" onclick="sdPlanungWeg()">Entfernen</button>' : '')
    + '</div></div>');
}

function sdPlanungSpeichern() {
  var name = sdFeld('sdPlName').trim();
  if (!name) { melde('Der Link braucht einen Namen.', 'warn'); return; }
  var e = sdLinkFeldLesen('sdPlLink');
  if (!e) { return; }
  var p = sd.fenster.id ? (DB.planung || []).filter(function (x) { return x.id === sd.fenster.id; })[0] : null;
  if (p) { p.name = name.slice(0, 40); p.link = e.onenote; p.link_web = e.web; sdStempeln(p); sdGeaendert(); }
  else {
    DB.planung.push({ id: 'pl-' + sdKennung(), name: name.slice(0, 40),
      link: e.onenote, link_web: e.web,
      ordnung: sdOrdnung(DB.planung), geaendert: Date.now() });
    sdGeaendert();
  }
  sdFensterZu();
  zeichne();
}

/* Verschiebt einen Eintrag der Kopfzeile. Dieselbe Mechanik wie bei
   Fächern und Seiten: Es tauschen genau zwei ihre Stelle, und nur die
   beiden bekommen einen frischen Stempel. */
function sdPlanungStellen(id, was) {
  sdSchieben(DB.planung, id, was === 'vor' ? -1 : 1);
  sdPlanungZeichnen();
}

function sdPlanungWeg() {
  sdEntfernen(DB.planung, sd.fenster.id);
  sdFensterZu();
  zeichne();
}

/* ============================================================
   Einfügen legt an

   Strg+V irgendwo auf dem Tisch. Aus dem Link weiß die App schon, wie
   das Ding heißt, aus welchem Notizbuch und welchem Abschnitt es kommt
   und ob es eine Seite oder ein Abschnitt ist. Gefragt wird nur noch,
   was nicht im Link steht — und das ist bei einer Unterseite genau
   eines: unter welcher Seite sie hängen soll. Das sagt kein OneNote-
   Link, auch bei echten Unterseiten nicht.

   Ziehen geht nicht: OneNote gibt beim Ziehen nichts heraus, der
   Mauszeiger zeigt ein Verbotszeichen. Am 13.11.2026 nachgemessen.
   ============================================================ */

function sdEinfuegenFenster(info) {
  var fach = sdFachZuAbschnitt(info.abschnittId);
  /* Kein Treffer über die Kennung: dann das Fach, das gerade offen ist. */
  if (!fach && sd.fachId) { fach = sdFach(sd.fachId); }
  var seite = fach ? sdSeite(fach, sd.seiteId) : null;
  var wahl = (info.art === 'abschnitt' || !fach) ? 'fach' : 'seite';
  sd.fenster = {
    art: 'einfuegen', info: info, wahl: wahl,
    fachId: fach ? fach.id : '',
    seiteId: seite ? seite.id : '',
    getroffen: !!sdFachZuAbschnitt(info.abschnittId)
  };
  sdEinfuegenZeichnen();
}

function sdEinfuegenWahl(w) { sd.fenster.wahl = w; sdEinfuegenZeichnen(); }
function sdEinfuegenFach() { sd.fenster.fachId = sdFeld('sdEiFach'); sdEinfuegenZeichnen(); }
function sdEinfuegenSeite() { sd.fenster.seiteId = sdFeld('sdEiSeite'); sdEinfuegenZeichnen(); }

function sdAuswahlHtml(id, ruf, liste, gewaehlt, leer) {
  return '<select id="' + id + '" class="eingabe" onchange="' + ruf + '">'
    + (leer ? '<option value="">' + esc(leer) + '</option>' : '')
    + liste.map(function (x) {
      return '<option value="' + esc(x.id) + '"' + (x.id === gewaehlt ? ' selected' : '') + '>'
        + esc(x.name) + '</option>';
    }).join('')
    + '</select>';
}

function sdEinfuegenZeichnen() {
  var w = sd.fenster;
  var i = w.info;
  var fach = w.fachId ? sdFach(w.fachId) : null;
  var herkunft = [i.notizbuch, i.abschnitt].filter(function (x) { return !!x; }).join(' › ');

  var arten = [
    { s: 'seite', t: 'Seite' + (fach ? ' in „' + fach.name + '“' : '') },
    { s: 'unter', t: 'Unterseite' },
    { s: 'fach', t: 'Eigenes Fach' },
    { s: 'zusammen', t: 'Zusammenarbeit' }
  ];
  /* Ein Abschnitt wird kein Unterpunkt einer Seite. */
  if (i.art === 'abschnitt') { arten = arten.filter(function (a) { return a.s !== 'unter'; }); }
  if (!DB.faecher.length) { arten = arten.filter(function (a) { return a.s === 'fach' || a.s === 'zusammen'; }); }

  var h = '<div class="titel">Eingefügt: ' + esc(i.name || 'Link') + '</div><div class="rumpf">';
  if (herkunft) { h += '<p class="herkunft">aus ' + esc(herkunft) + '</p>'; }
  h += '<p class="herkunft">' + (i.art === 'seite' ? 'OneNote sagt: eine Seite'
    : (i.art === 'abschnitt' ? 'OneNote sagt: ein Abschnitt' : 'Die Art steht nicht im Link'))
    + (w.getroffen && fach ? ' · Abschnitt gehört zu „' + esc(fach.name) + '“' : '') + '</p>';

  h += '<label>Was soll daraus werden?</label><div class="reihewahl wickeln">'
    + arten.map(function (a) {
      return '<button type="button" class="' + (w.wahl === a.s ? 'an' : '') + '"'
        + ' onclick="sdEinfuegenWahl(\'' + a.s + '\')">' + esc(a.t) + '</button>';
    }).join('') + '</div>';

  /* Nur fragen, was nicht schon feststeht. */
  if ((w.wahl === 'seite' || w.wahl === 'unter') && !w.getroffen && DB.faecher.length) {
    h += '<label for="sdEiFach">In welches Fach?</label>'
      + sdAuswahlHtml('sdEiFach', 'sdEinfuegenFach()', DB.faecher, w.fachId, '');
  }
  if (w.wahl === 'unter') {
    var seiten = fach ? fach.seiten : [];
    if (!seiten.length) {
      h += '<p class="herkunft warnton">Dieses Fach hat noch keine Seite, '
        + 'unter die eine Unterseite passen könnte.</p>';
    } else {
      h += '<label for="sdEiSeite">Unter welcher Seite?</label>'
        + sdAuswahlHtml('sdEiSeite', 'sdEinfuegenSeite()', seiten, w.seiteId, '');
    }
  }

  h += '<label for="sdEiName">Name</label>'
    + '<input id="sdEiName" class="eingabe" type="text" maxlength="80" value="' + esc(i.name) + '">'
    + '<div class="knoepfe"><button type="button" class="knopf voll" onclick="sdEinfuegenAnlegen()">Anlegen</button>'
    + '<button type="button" class="knopf" onclick="sdFensterZu()">Abbrechen</button></div></div>';
  sdFensterAuf(h);
}

function sdEinfuegenAnlegen() {
  var w = sd.fenster;
  var i = w.info;
  var name = sdFeld('sdEiName').trim();
  if (!name) { melde('Der Eintrag braucht einen Namen.', 'warn'); return; }

  if (w.wahl === 'fach' || w.wahl === 'zusammen') {
    var neu = sdFachNeu(name, w.wahl === 'zusammen' ? 'zusammen' : 'eigen',
      SD_FARBEN[DB.faecher.length % SD_FARBEN.length], i.onenote, i.notizbuch, i.web);
    sd.fachId = neu.id;
    sd.sicht = 'tisch';
    sdFensterZu();
    zeichne();
    melde('Fach „' + name + '“ angelegt.', 'gut');
    return;
  }

  var fach = sdFach(w.fachId);
  if (!fach) { melde('Kein Fach gewählt.', 'warn'); return; }

  if (w.wahl === 'seite') {
    var s = sdSeiteNeu(fach, name, i.onenote, i.web);
    sd.fachId = fach.id;
    sd.sicht = 'fach';
    sd.seiteId = s.id;
    sdFensterZu();
    zeichne();
    melde('Seite „' + name + '“ in „' + fach.name + '“ angelegt.', 'gut');
    return;
  }

  var seite = sdSeite(fach, w.seiteId);
  if (!seite) { melde('Keine Seite gewählt, unter die die Unterseite gehört.', 'warn'); return; }
  sdUnterNeu(seite, name, i.onenote, i.web);
  sd.fachId = fach.id;
  sd.sicht = 'fach';
  sd.seiteId = seite.id;
  sdFensterZu();
  zeichne();
  melde('Unterseite „' + name + '“ unter „' + seite.name + '“ angelegt.', 'gut');
}

/* Der Griff am Fenster: Strg+V. Nicht, während ein Fenster offen ist
   oder in einem Eingabefeld — dort soll Einfügen einfügen. */
function sdEingefuegt(ereignis) {
  if (sd.fenster) { return; }
  var z = ereignis.target;
  var tag = z && z.tagName ? String(z.tagName).toLowerCase() : '';
  if (tag === 'input' || tag === 'textarea' || (z && z.isContentEditable)) { return; }
  var daten = ereignis.clipboardData;
  if (!daten) { return; }
  var text = '';
  try { text = daten.getData('text/plain') || daten.getData('text/uri-list') || ''; }
  catch (e) { text = ''; }
  var i = sdLinkLesen(text);
  if (!i.onenote && !i.web) {
    melde('In der Zwischenablage steht keine onenote:- oder https-Adresse.', 'warn');
    return;
  }
  ereignis.preventDefault();
  sdEinfuegenFenster(i);
}

/* ---------- Steller ---------- */

function sdTeile(schluessel) { return String(schluessel || '').split('|'); }

/* Fächer verschieben — innerhalb ihrer Reihe. „Eigene Fächer“ und
   „Zusammenarbeit“ sind zwei Reihen, aber eine Liste: Geschoben wird
   gegen den Nachbarn derselben Reihe, sonst spränge ein Fach beim
   Verschieben unversehens in die andere Reihe. */
function sdFachStellen(id, was) {
  var f = sdFach(id);
  if (!f) { return; }
  if (was === 'aendern') { sdFachFenster(id, ''); return; }
  if (was === 'weg') {
    sdEntfernen(DB.faecher, id);
    if (sd.fachId === id) { sd.fachId = ''; sd.sicht = 'tisch'; }
    zeichne();
    return;
  }
  var reihe = sdFaecher(f.reihe);
  var i = reihe.map(function (x) { return x.id; }).indexOf(id);
  var j = i + (was === 'hoch' ? -1 : 1);
  if (j < 0 || j >= reihe.length) { return; }
  var g = reihe[j];
  /* Getauscht wird mit dem Nachbarn derselben Reihe, auch wenn in der
     Gesamtliste eines der anderen Reihe dazwischenliegt. Darum hier
     nicht sdSchieben: das bewegt immer nur eine Stelle in der ganzen
     Liste und träfe dann den falschen. */
  var o = f.ordnung;
  f.ordnung = g.ordnung;
  g.ordnung = o;
  sdStempeln(f);
  sdStempeln(g);
  var ia = DB.faecher.indexOf(f);
  var ib = DB.faecher.indexOf(g);
  DB.faecher[ia] = g;
  DB.faecher[ib] = f;
  sdGeaendert();
  zeichne();
}

function sdSeiteStellen(schluessel, was) {
  var t = sdTeile(schluessel);
  var f = sdFach(t[0]);
  if (!f) { return; }
  if (was === 'aendern') { sdSeiteFenster(t[1]); return; }
  if (was === 'weg') { sdEntfernen(f.seiten, t[1]); if (sd.seiteId === t[1]) { sd.seiteId = ''; } }
  else { sdSchieben(f.seiten, t[1], was === 'hoch' ? -1 : 1); }
  sdFlaecheZeichnen();
}

function sdUnterStellen(schluessel, was) {
  var t = sdTeile(schluessel);
  var f = sdFach(t[0]);
  var s = sdSeite(f, t[1]);
  if (!s) { return; }
  if (was === 'aendern') { sdUnterFenster(t[1], t[2]); return; }
  if (was === 'weg') { sdEntfernen(s.unter, t[2]); }
  else { sdSchieben(s.unter, t[2], was === 'hoch' ? -1 : 1); }
  sdFlaecheZeichnen();
}

function sdLeisteStellen(schluessel, was) {
  var t = sdTeile(schluessel);
  var f = sdFach(t[0]);
  if (!f) { return; }
  if (was === 'aendern') { sdLeisteFenster(t[1]); return; }
  if (was === 'weg') { sdEntfernen(f.leiste, t[1]); }
  else { sdSchieben(f.leiste, t[1], was === 'hoch' ? -1 : 1); }
  zeichne();
}

/* ---------- Start ---------- */

/* Die fünf Einträge der Planungsleiste bekommen feste Kennungen statt
   gewürfelter. Sonst legte jedes Gerät beim ersten Start seine eigenen
   fünf an, und der Abgleich hätte am Ende zehn. Und sie tragen den
   Stempel 0: Sie sind eine Voreinstellung, keine Eingabe — ein von Hand
   eingetragener Link gewinnt deshalb immer gegen sie. Einen gelöschten
   Eintrag legt die App nicht wieder an; dafür ist der Grabstein da. */
function sdPlanungSichern() {
  if (DB.planung.length) { return; }
  var tot = DB.grabsteine || {};
  DB.planung = SD_PLANUNG_VOR.filter(function (n) {
    return !tot['pl-' + sdSchluessel(n)];
  }).map(function (n, i) {
    return { id: 'pl-' + sdSchluessel(n), name: n, link: '', ordnung: i, geaendert: 0 };
  });
}

/* Aus „Offene Fragen“ wird „offene-fragen“ — eine feste, lesbare Kennung. */
function sdSchluessel(text) {
  return String(text).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function sdStart() {
  sdZoomLesen();
  sdBreite();
  return sdLaden().then(function () {
    sdPlanungSichern();
    zeichne();
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', function () { sdBreite(); zeichne(); });
      window.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { sdFensterZu(); }
      });
      document.addEventListener('paste', sdEingefuegt);
    }
    if (sdHaken.beimStart) { sdHaken.beimStart(); }
    return true;
  });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.getElementById('flaeche')) {
  sdStart();
}
