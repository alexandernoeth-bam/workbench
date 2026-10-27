/* ============================================================
   Palm-Modell (seit 0.80)

   Wie Date Book, To Do und Memo Pad am Palm — nur um das Nötigste
   ergänzt:

   To Do     Eine flache Liste. Jede Aufgabe ist ein Satz in
             DB.aufgaben: Titel, Priorität 1–5, Kategorie, ein Datum
             (planung), Erinnerung (uhrzeit), Notiz (beschreibung),
             privat. Routinen sind dieselben Sätze mit „wiederholung“.
             Sichten Alle · Datum · Kategorie, dazu „Show…“.
   Memo Pad  Text mit Fett, Unterstrichen, Durchgestrichen, Punkt und
             Kästchen — als Knöpfe, ohne sichtbare Zeichen. Kürzel
             P (Projekt), Z (Ziel), A (Ablauf), – (alles andere).
             Vorlagen, Archiv. Eine Kästchen-Zeile kann Aufgabe werden:
             Am Zeilenende steht dann unsichtbar „ ⟦Kennung⟧“ — die
             Kennung der Aufgabe. Gemeinsam ist nur der Haken.
             Ein ganzes Memo kann Aufgabe oder Termin werden.
   Date Book Termine, darunter die Aufgaben des Tages (Agenda).

   Die Umstellung („Umstellen…“ im Menü ≡) macht aus Listen
   Kategorien, aus ihren offenen Punkten, dem Sammler und allem
   Eingeplanten Aufgaben. Danach pflegt pmNachpflegen nach, was die
   Workbench noch auf die alte Art anlegt.
   ============================================================ */

cl.pm = { tab: 'datum', datum: 'woche', wahl: '', frisch: {}, fenster: null, zeile: -1, memoWahl: '', terminFuer: '',
          showF: null, mf: null, zuAlle: false, zuTermin: false, edZeile: null, mshow: null, umst: null, vorlage: '', privat: 0, marke: '' };

var PM_MARKE = /\s?⟦([A-Za-z0-9_-]{4,40})⟧\s*$/;
var PM_SHOW_KEY = 'clie-pm-show';
var PM_TAB_KEY = 'clie-pm-tab';
var PM_SHOW_STD = { sort: 'prio', erl: false, faellig: false, datum: true, prio: true, kat: false };
var PM_SORT = [['prio', 'Priorität, Datum'], ['datum', 'Datum, Priorität'], ['kat', 'Kategorie, Priorität'], ['abc', 'Alphabetisch']];
var PM_DATUM = [['woche', 'Diese Woche'], ['heute', 'Heute'], ['7', 'Nächste 7 Tage'], ['ueber', 'Überfällig'], ['alle', 'Alle mit Datum']];
/* Seit 0.94: T = ToDo-Liste (nur Kennzeichen — die Kästchen bleiben im Memo).
   Seit 0.94.1 in dieser Reihenfolge — für Balken, Sortierung, Show… und Details */
var PM_KUERZEL = ['T', 'A', 'P', 'Z', '–'];
/* Das To-Do-Symbol im Kleinen: ein Blatt mit zwei Haken-Zeilen */
var PM_TODO_SVG = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2.5 1.5h11v13h-11z" fill="none" stroke="currentColor" stroke-width="1.5"/>'
  + '<path d="M4.5 4.5h2.5v2.5h-2.5zM4.5 9.5h2.5v2.5h-2.5z" fill="none" stroke="currentColor" stroke-width="1.2"/>'
  + '<path d="M8.5 5.75h3.5M8.5 10.75h3.5" stroke="currentColor" stroke-width="1.5"/></svg>';

/* ---------- Grundlagen ---------- */

function pmAn() { return !!(DB.einstellungen && DB.einstellungen.palm); }

function pmIstDatum(d) { return /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')); }

function pmIstZeit(z) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(z || '')); }

function pmAufgabeFinden(id) {
  var l = DB.aufgaben || [];
  var i;
  for (i = 0; i < l.length; i++) { if (l[i] && l[i].id === id) { return l[i]; } }
  return null;
}

function pmPrio(a) {
  var p = Math.round(Number(a && a.prio));
  return (p >= 1 && p <= 5) ? p : 3;
}

function pmTitel(a) { return String((a && a.titel) || '').trim() || '(ohne Titel)'; }

/* Das Datum einer Aufgabe — bei Routinen die nächste offene Ausführung */
function pmDatum(a) {
  if (!a) { return ''; }
  if (a.wiederholung) { return a.pausiert ? '' : rtDiesmalTag(a); }
  return pmIstDatum(a.planung) ? a.planung : '';
}

/* Erledigt, wie die Liste es zeigt: Routinen nur, solange gerade abgehakt */
function pmErledigtJetzt(a) {
  if (!a) { return false; }
  if (a.wiederholung) {
    var tag = cl.pm.frisch[a.id];
    return pmIstDatum(tag) && istErledigtAn(a, tag);
  }
  return a.status === 'erledigt';
}

function pmDatumText(d) {
  if (!d) { return ''; }
  var h = isoDatum();
  if (d === h) { return 'heute'; }
  if (d === tagePlus(h, 1)) { return 'morgen'; }
  return clKurzDatum(d) + (d < h ? '!' : '');
}

function pmKatName(id) { return id ? (katName(id) === 'Alle' ? 'Nicht abgelegt' : katName(id)) : 'Nicht abgelegt'; }

function pmKatRang(a) {
  var k = clKategorieVon(a);
  var l = kgAlle();
  var i;
  for (i = 0; i < l.length; i++) { if (l[i].id === k) { return i; } }
  return 9999;
}

/* Eine neue Aufgabe — dieselbe Gestalt wie in der Workbench */
function pmNeueAufgabe(f) {
  var a = { id: neueKennung(), titel: String(f.titel || '').trim().slice(0, 300), beschreibung: String(f.notiz || ''), kontext: 'privat',
            themaId: null, projektId: null, frist: '', planung: pmIstDatum(f.datum) ? f.datum : 'backlog',
            uhrzeit: pmIstZeit(f.zeit) && pmIstDatum(f.datum) ? f.zeit : '', art: 'haupt', wiederholung: null, status: 'offen',
            erledigtAm: null, zuletztErledigt: null, ablaufSchritt: null, ab: '', prio: (f.prio >= 1 && f.prio <= 5) ? f.prio : 3,
            geaendert: jetzt() };
  katPrivatSchreiben(a, { bereich: f.bereich || '', privat: !!f.privat });
  if (!a.bereich) { a.kontext = (f.kontext === 'beruflich') ? 'beruflich' : 'privat'; }
  if (f.memo && f.memo.id) { a.memo = { id: f.memo.id }; if (f.memo.zeile) { a.memo.zeile = f.memo.zeile; } }
  if (!Array.isArray(DB.aufgaben)) { DB.aufgaben = []; }
  DB.aufgaben.push(a);
  return a;
}

/* ---------- Verbindung Memo-Zeile ↔ Aufgabe ---------- */

function pmMarke(zeile) {
  var m = String(zeile || '').match(PM_MARKE);
  return m ? m[1] : '';
}

function pmOhneMarke(zeile) { return String(zeile || '').replace(PM_MARKE, ''); }

function pmOhneMarken(text) { return String(text || '').split('\n').map(pmOhneMarke).join('\n'); }

function pmZeileMitMarke(s, mid) {
  if (!s || !mid) { return -1; }
  var zeilen = String(s.text || '').split('\n');
  var i;
  for (i = 0; i < zeilen.length; i++) { if (pmMarke(zeilen[i]) === mid && kpAufgabe(zeilen[i])) { return i; } }
  return -1;
}

function pmMemoVon(a) { return (a && a.memo && a.memo.id) ? kpSeiteFinden(a.memo.id) : null; }

/* Die Aufgabe zu einer Marke: Die Marke ist die Kennung der Aufgabe */
function pmAufgabeZurMarke(mid) {
  var a = pmAufgabeFinden(mid);
  return (a && a.memo && a.memo.zeile === mid) ? a : null;
}

/* Haken der Aufgabe → Haken der Zeile */
function pmZeileAngleichen(a) {
  var s = pmMemoVon(a);
  if (!s || !a.memo.zeile) { return false; }
  var nr = pmZeileMitMarke(s, a.memo.zeile);
  if (nr < 0) { return false; }
  var k = kpAufgabe(String(s.text || '').split('\n')[nr]);
  var soll = a.status === 'erledigt';
  if (!k || k.erledigt === soll) { return false; }
  return kpKastenSetzen(s, nr, soll);
}

/* Eine Aufgabe abhaken. Routinen: an „tag“ oder an ihrer nächsten Ausführung. */
function pmHaken(id, tag) {
  var a = pmAufgabeFinden(id);
  if (!a) { return; }
  if (a.wiederholung) {
    var d = pmIstDatum(tag) ? tag : (pmIstDatum(cl.pm.frisch[id]) ? cl.pm.frisch[id] : rtDiesmalTag(a));
    if (!d) { return; }
    var jetztErl = !istErledigtAn(a, d);
    wiederholungSetzen(a, d, jetztErl);
    if (!pmIstDatum(tag)) { if (jetztErl) { cl.pm.frisch[id] = d; } else { delete cl.pm.frisch[id]; } }
  } else {
    if (a.status === 'erledigt') { a.status = 'offen'; a.erledigtAm = null; }
    else { a.status = 'erledigt'; a.erledigtAm = isoDatum(); }
    cl.pm.frisch[id] = true;
    pmZeileAngleichen(a);
  }
  a.geaendert = jetzt();
  spaeterSichern();
  zeichne();
}

/* Haken im Memo: die Zeile und — wenn sie eine ist — die Aufgabe */
function pmMemoHaken(seiteId, nr) {
  var s = kpSeiteFinden(seiteId);
  if (!s || !kpSeiteKastenUmKern(s, nr)) { return; }
  var z = String(s.text || '').split('\n')[nr] || '';
  var a = pmAufgabeZurMarke(pmMarke(z));
  var k = kpAufgabe(z);
  if (a && k && !a.wiederholung) {
    a.status = k.erledigt ? 'erledigt' : 'offen';
    a.erledigtAm = k.erledigt ? isoDatum() : null;
    a.geaendert = jetzt();
  }
  spaeterSichern();
  zeichne();
}

/* ---------- To Do: Anzeige ---------- */

function pmShow() {
  var w = null;
  try { w = JSON.parse(window.localStorage.getItem(PM_SHOW_KEY) || 'null'); } catch (e) { w = null; }
  var s = {};
  Object.keys(PM_SHOW_STD).forEach(function (k) { s[k] = (w && typeof w[k] === typeof PM_SHOW_STD[k]) ? w[k] : PM_SHOW_STD[k]; });
  if (!PM_SORT.some(function (x) { return x[0] === s.sort; })) { s.sort = 'prio'; }
  return s;
}

function pmTabLaden() {
  var t = '';
  try { t = window.localStorage.getItem(PM_TAB_KEY) || ''; } catch (e) { t = ''; }
  /* Seit 0.95.0 ist Datum der Start, danach Kategorie und Alle */
  cl.pm.tab = (t === 'alle' || t === 'kategorie') ? t : 'datum';
}

function pmTab(t) {
  if (['alle', 'datum', 'kategorie'].indexOf(t) < 0) { return; }
  cl.pm.tab = t;
  try { window.localStorage.setItem(PM_TAB_KEY, t); } catch (e) { /* nur für jetzt */ }
  var el = document.getElementById('inhalt');
  if (el) { el.scrollTop = 0; }
  zeichne();
}

/* Alles, was die Liste zeigen darf (▼, privat, erledigt, Show only due) */
function pmTodoAlle() {
  var h = isoDatum();
  var show = pmShow();
  cl.pm.privat = 0;
  return (DB.aufgaben || []).filter(function (a) {
    if (!a || typeof a !== 'object' || !a.id || !clPasst(a)) { return false; }
    if (a.wiederholung && a.pausiert) { return false; }
    if (prPrivatVerborgen(null, a)) { if (prModus() === 'maskieren') { cl.pm.privat++; } return false; }
    if (pmErledigtJetzt(a) && !show.erl && !cl.pm.frisch[a.id]) { return false; }
    var d = pmDatum(a);
    if (show.faellig && d && d > h && !cl.pm.frisch[a.id]) { return false; }
    return true;
  });
}

function pmSortieren(l, art) {
  var dat = function (x) { return pmDatum(x) || '9999-99-99'; };
  var vgl = function (x, y) { return x < y ? -1 : (x > y ? 1 : 0); };
  return l.slice().sort(function (a, b) {
    var ea = pmErledigtJetzt(a) ? 1 : 0;
    var eb = pmErledigtJetzt(b) ? 1 : 0;
    var r = ea - eb;
    if (!r) {
      if (art === 'datum') { r = vgl(dat(a), dat(b)) || (pmPrio(a) - pmPrio(b)); }
      else if (art === 'abc') { r = 0; }
      else if (art === 'kat') { r = (pmKatRang(a) - pmKatRang(b)) || (pmPrio(a) - pmPrio(b)) || vgl(dat(a), dat(b)); }
      else { r = (pmPrio(a) - pmPrio(b)) || vgl(dat(a), dat(b)); }
    }
    return r || pmTitel(a).localeCompare(pmTitel(b), 'de');
  });
}

/* Eine Zeile: Kästchen · Priorität · Titel (ein- oder zweizeilig) · Zeichen · Datum */
function pmZeileHtml(a, opt) {
  var o = opt || {};
  var show = o.show || pmShow();
  var tag = o.tag || '';
  var erl = tag ? (a.wiederholung ? istErledigtAn(a, tag) : a.status === 'erledigt') : pmErledigtJetzt(a);
  var d = a.wiederholung ? (tag || (pmIstDatum(cl.pm.frisch[a.id]) ? cl.pm.frisch[a.id] : pmDatum(a))) : pmDatum(a);
  var titel = pmTitel(a);
  /* Zweizeilig nur bei Bedarf — am schmalen Bildschirm ab gut 18 Zeichen */
  var lang = titel.length > 18;
  var gew = !tag && cl.pm.wahl === a.id;
  var id = esc(a.id);
  var sym = '';
  if (pmIstZeit(a.uhrzeit)) { sym += '<span class="pm-sym" aria-label="Erinnerung">◉' + (o.zeit ? ' ' + esc(clZeitText(a.uhrzeit)) : '') + '</span>'; }
  if (a.wiederholung) { sym += '<span class="pm-sym" aria-label="Wiederholung">↻</span>'; }
  if (a.memo && a.memo.id) { sym += '<button type="button" class="pm-sym" onclick="pmMemoVonAufgabe(\'' + id + '\')" aria-label="Memo öffnen">▤</button>'; }
  else if (String(a.beschreibung || '').trim()) { sym += '<button type="button" class="pm-sym" onclick="pmDetails(\'' + id + '\')" aria-label="Notiz">▤</button>'; }
  var datum = '';
  if (o.mitDatum !== false && show.datum && d) {
    datum = '<span class="dt' + (d < isoDatum() && !erl ? ' ue' : '') + '">' + esc(pmDatumText(d)) + '</span>';
  }
  var html = '<div class="aufg palm pm' + (erl ? ' erl' : '') + (gew ? ' gewaehlt' : '') + (lang ? ' ausf' : '') + '" id="pmA' + id + '">'
    + clKastenHtml(erl, 'pmHaken(\'' + id + '\'' + (tag ? ',\'' + esc(tag) + '\'' : '') + ')')
    + (show.prio ? '<button type="button" class="pd" onclick="pmPrioUm(\'' + id + '\')" aria-label="Priorität">' + pmPrio(a) + '</button>' : '')
    + '<button type="button" class="tx' + (lang ? ' lang' : '') + '" onclick="' + (tag ? 'pmDetails' : 'pmTippen') + '(\'' + id + '\')"><span class="tt">' + esc(titel) + '</span></button>'
    + sym + datum
    + (show.kat && o.mitKat !== false ? '<span class="kt">' + esc(pmKatName(clKategorieVon(a))) + '</span>' : '')
    + '</div>';
  return prZeile(null, a, html);
}

function pmBannerHtml() {
  if (pmAn()) { return ''; }
  return '<div class="pm-banner">Noch nicht umgestellt: Listen, Sammler und Eingeplantes werden erst mit '
    + '<button type="button" class="verweis" onclick="pmUmstellenFragen()">Umstellen…</button> zu Aufgaben.</div>';
}

/* Ende der laufenden Woche (Sonntag) für „Diese Woche“ (seit 0.95.0) */
function pmWocheBis() {
  var h = isoDatum();
  return tagePlus(h, (7 - ausIso(h).getDay()) % 7);
}

function pmTodoHtml() {
  var h = pmBannerHtml();
  var show = pmShow();
  var heute = isoDatum();
  var l = pmTodoAlle();
  if (cl.pm.privat) { h += '<button type="button" class="pr-maske" onclick="prFreigeben()">— ' + cl.pm.privat + ' private —</button>'; }
  if (cl.pm.tab === 'datum') {
    var art = cl.pm.datum;
    var bis = art === '7' ? tagePlus(heute, 7) : (art === 'woche' ? pmWocheBis() : heute);
    h += '<button type="button" class="pm-datwahl" onclick="pmDatumWahlAuf()">▼ ' + esc((PM_DATUM.filter(function (x) { return x[0] === art; })[0] || PM_DATUM[0])[1]) + '</button>';
    l = l.filter(function (a) {
      var d = pmDatum(a);
      if (a.wiederholung && pmIstDatum(cl.pm.frisch[a.id])) { d = cl.pm.frisch[a.id]; }
      if (!d) { return false; }
      /* „Diese Woche“ zeigt Offenes bis Sonntag (dazu Überfälliges); Erledigtes bleibt ausgeblendet */
      if (art === 'woche' && pmErledigtJetzt(a)) { return false; }
      if (art === 'ueber') { return d < heute; }
      if (art === 'alle') { return true; }
      return d <= bis;
    });
    if (!l.length) { return h + '<p class="leise">Nichts mit diesem Datum.</p>'; }
    var gruppen = {};
    var reihe = [];
    pmSortieren(l, 'datum').forEach(function (a) {
      var d = (a.wiederholung && pmIstDatum(cl.pm.frisch[a.id])) ? cl.pm.frisch[a.id] : pmDatum(a);
      var k = (d < heute && !pmErledigtJetzt(a)) ? 'ueber' : d;
      if (!gruppen[k]) { gruppen[k] = []; reihe.push(k); }
      gruppen[k].push(a);
    });
    reihe.sort(function (x, y) { return x === 'ueber' ? -1 : (y === 'ueber' ? 1 : (x < y ? -1 : 1)); });
    reihe.forEach(function (k) {
      h += '<div class="pm-gr">' + (k === 'ueber' ? 'Überfällig' : esc(clWt(k) + ' ' + clKurzDatum(k)) + (k === heute ? ' · heute' : '')) + '</div>'
        + pmSortieren(gruppen[k], show.sort === 'datum' ? 'prio' : show.sort).map(function (a) { return pmZeileHtml(a, { show: show, mitDatum: k === 'ueber' }); }).join('');
    });
    return h;
  }
  if (!l.length) { return h + '<p class="leise">' + (show.faellig ? 'Nichts fällig.' : 'Keine Aufgaben — „Neu“ tippen.') + '</p>'; }
  if (cl.pm.tab === 'kategorie') {
    var nachKat = {};
    var folge = [];
    pmSortieren(l, 'kat').forEach(function (a) {
      var k = clKategorieVon(a) || '';
      if (!nachKat[k]) { nachKat[k] = []; folge.push(k); }
      nachKat[k].push(a);
    });
    folge.forEach(function (k) {
      /* Seit 0.93: Kategorie als Balken mit Anzahl */
      h += '<div class="pm-bal">' + esc(pmKatName(k)) + '<small>' + nachKat[k].length + '</small></div>'
        + pmSortieren(nachKat[k], show.sort === 'kat' ? 'prio' : show.sort).map(function (a) { return pmZeileHtml(a, { show: show, mitKat: false }); }).join('');
    });
    return h;
  }
  return h + pmSortieren(l, show.sort).map(function (a) { return pmZeileHtml(a, { show: show }); }).join('');
}

function pmTodoFussHtml() {
  return '<button type="button" class="knopf" onclick="pmNeu(\'\',\'\')">Neu</button>'
    + '<button type="button" class="knopf" onclick="pmDetailsGewaehlt()">Details…</button>'
    + '<button type="button" class="knopf" onclick="pmShowAuf()">Show…</button>'
    + '<div class="pm-tabs">' + [['datum', 'Datum'], ['kategorie', 'Kategorie'], ['alle', 'Alle']].map(function (t) {
      return '<button type="button"' + (cl.pm.tab === t[0] ? ' class="an"' : '') + ' onclick="pmTab(\'' + t[0] + '\')">' + t[1] + '</button>';
    }).join('') + '</div>';
}

/* Erster Tipp wählt, zweiter öffnet die Details */
function pmTippen(id) {
  if (cl.pm.wahl === id) { pmDetails(id); return; }
  cl.pm.wahl = id;
  inhaltZeichnen();
}

function pmDetailsGewaehlt() {
  if (!pmAufgabeFinden(cl.pm.wahl)) { melde('Erst eine Aufgabe antippen, dann „Details…“.', null); return; }
  pmDetails(cl.pm.wahl);
}

/* Priorität antippen: 1 → 2 → … → 5 → 1 */
function pmPrioUm(id) {
  var a = pmAufgabeFinden(id);
  if (!a) { return; }
  a.prio = pmPrio(a) % 5 + 1;
  a.geaendert = jetzt();
  spaeterSichern();
  zeichne();
}

function pmDatumWahlAuf() {
  cl.aufklapp = (cl.aufklapp === 'pmdatum') ? '' : 'pmdatum';
  aufklappNeu();
}

function pmDatumWahlHtml() {
  return '<div class="aufklapp liste-aufklapp todo-wahl" style="top:84px;left:6px">' + PM_DATUM.map(function (x) {
    return '<button type="button"' + (cl.pm.datum === x[0] ? ' class="an"' : '') + ' onclick="pmDatumWahl(\'' + x[0] + '\')">' + x[1] + '</button>';
  }).join('') + '</div>';
}

function pmDatumWahl(w) {
  if (!PM_DATUM.some(function (x) { return x[0] === w; })) { return; }
  cl.pm.datum = w;
  cl.aufklapp = '';
  zeichne();
}

/* ---- Show… ---- */

function pmShowAuf() {
  cl.pm.showF = pmShow();
  cl.aufklapp = 'pmshow';
  aufklappNeu();
}

function pmShowLesen() {
  var f = cl.pm.showF;
  if (!f) { return null; }
  var s = document.getElementById('pmShowSort');
  if (s && typeof s.value === 'string' && PM_SORT.some(function (x) { return x[0] === s.value; })) { f.sort = s.value; }
  [['erl', 'pmShowErl'], ['faellig', 'pmShowFaellig'], ['datum', 'pmShowDatum'], ['prio', 'pmShowPrio'], ['kat', 'pmShowKat']].forEach(function (k) {
    var el = document.getElementById(k[1]);
    if (el && typeof el.checked === 'boolean') { f[k[0]] = el.checked; }
  });
  return f;
}

function pmShowHtml() {
  var f = cl.pm.showF;
  if (!f) { return ''; }
  var haken = function (id, an, text) { return '<label class="haken"><input id="' + id + '" type="checkbox"' + (an ? ' checked' : '') + '> ' + text + '</label>'; };
  return '<div class="fenster"><div class="titel">Show</div><div class="rumpf">'
    + '<label for="pmShowSort">Sortieren:</label><select id="pmShowSort" class="eingabe">' + PM_SORT.map(function (s) {
      return '<option value="' + s[0] + '"' + (f.sort === s[0] ? ' selected' : '') + '>' + s[1] + '</option>';
    }).join('') + '</select>'
    + haken('pmShowErl', f.erl, 'Erledigte zeigen')
    + haken('pmShowFaellig', f.faellig, 'Nur Fälliges (ohne Künftiges)')
    + haken('pmShowDatum', f.datum, 'Datum zeigen')
    + haken('pmShowPrio', f.prio, 'Priorität zeigen')
    + haken('pmShowKat', f.kat, 'Kategorie zeigen')
    + '<div class="knoepfe"><button type="button" class="knopf voll" onclick="pmShowOk()">OK</button>'
    + '<button type="button" class="knopf" onclick="aufklappZu()">Abbrechen</button></div></div></div>';
}

function pmShowOk() {
  var f = pmShowLesen();
  if (f) { try { window.localStorage.setItem(PM_SHOW_KEY, JSON.stringify(f)); } catch (e) { /* nur für jetzt */ } }
  cl.pm.showF = null;
  aufklappZu();
  zeichne();
}

/* ---------- Aufgabe: Neu und Details ---------- */

/* Neu — aus dem Date Book mit Tag (und Uhrzeit als Erinnerung) */
function pmNeu(datum, zeit) {
  var d = pmIstDatum(datum) ? datum : ((cl.app === 'aufgaben' && cl.pm.tab === 'datum' && cl.pm.datum !== 'ueber') ? isoDatum() : '');
  cl.pm.fenster = { modus: 'neu', id: '', titel: '', prio: 3, bereich: clNeuBereich(), privat: false, datum: d,
                    zeit: pmIstZeit(zeit) ? zeit : '', notiz: '', memo: null, kontext: clNeuKontext() };
  cl.aufklapp = 'pmaufgabe';
  aufklappNeu();
  var t = document.getElementById('pmTitel');
  if (t && t.focus) { t.focus(); }
}

function pmDetails(id) {
  var a = pmAufgabeFinden(id);
  if (!a) { return; }
  cl.pm.wahl = a.wiederholung ? cl.pm.wahl : id;
  cl.pm.fenster = { modus: 'details', id: a.id, titel: a.titel || '', prio: pmPrio(a), bereich: clKategorieVon(a), privat: !!a.privat,
                    datum: a.wiederholung ? '' : pmDatum(a), zeit: a.uhrzeit || '', notiz: a.beschreibung || '',
                    memo: a.memo ? { id: a.memo.id, zeile: a.memo.zeile || '' } : null };
  cl.aufklapp = 'pmaufgabe';
  aufklappNeu();
}

function pmFensterLesen() {
  var f = cl.pm.fenster;
  if (!f) { return null; }
  var wert = function (id) { var e = document.getElementById(id); return (e && typeof e.value === 'string') ? e.value : null; };
  var t = wert('pmTitel'); if (t !== null) { f.titel = t; }
  var d = wert('pmDatum'); if (d !== null) { f.datum = d; }
  var z = wert('pmZeit'); if (z !== null) { f.zeit = z; }
  var n = wert('pmNotiz'); if (n !== null) { f.notiz = n; }
  katPrivatLesen('pm', f);
  return f;
}

function pmPrioWahl(p) {
  var f = pmFensterLesen();
  if (!f || !(p >= 1 && p <= 5)) { return; }
  f.prio = p;
  aufklappNeu();
}

/* Fällig: kein Datum, heute, morgen, in einer Woche */
function pmTagWahl(w) {
  var f = pmFensterLesen();
  if (!f) { return; }
  var h = isoDatum();
  f.datum = (w === 'heute') ? h : (w === 'morgen') ? tagePlus(h, 1) : (w === 'woche') ? tagePlus(h, 7) : '';
  if (!f.datum) { f.zeit = ''; }
  aufklappNeu();
}

function pmFensterHtml() {
  var f = cl.pm.fenster;
  if (!f) { return ''; }
  var a = f.id ? pmAufgabeFinden(f.id) : null;
  if (f.modus === 'loeschen' && a) {
    return '<div class="fenster"><div class="titel">Aufgabe löschen</div><div class="rumpf">'
      + '<p>„' + esc(pmTitel(a)) + '“ löschen?' + (a.wiederholung ? ' Auch ihre erledigten Tage verschwinden.' : '') + '</p>'
      + (a.memo && a.memo.zeile ? '<p class="leise">Die Zeile im Memo bleibt stehen.</p>' : '')
      + '<div class="knoepfe"><button type="button" class="knopf voll" onclick="pmLoeschen()">Löschen</button>'
      + '<button type="button" class="knopf" onclick="pmDetails(\'' + esc(a.id) + '\')">Abbrechen</button></div></div></div>';
  }
  var h = isoDatum();
  var chip = function (w, text, an) { return '<button type="button"' + (an ? ' class="an"' : '') + ' onclick="pmTagWahl(\'' + w + '\')">' + text + '</button>'; };
  var memo = f.memo ? kpSeiteFinden(f.memo.id) : null;
  var x = '<div class="fenster"><div class="titel">' + (f.modus === 'neu' ? 'Neue Aufgabe' : (a && a.wiederholung ? 'Routine' : 'Aufgabe')) + '</div><div class="rumpf pm-det">'
    + '<label for="pmTitel">Titel:</label><textarea id="pmTitel" class="eingabe" rows="2" autocomplete="off">' + esc(f.titel) + '</textarea>'
    + '<label>Priorität:</label><div class="wahlreihe">' + [1, 2, 3, 4, 5].map(function (p) {
      return '<button type="button"' + (f.prio === p ? ' class="an"' : '') + ' onclick="pmPrioWahl(' + p + ')">' + p + '</button>';
    }).join('') + '</div>'
    + katPrivatHtml('pm', f.bereich || '', f.privat);
  if (a && a.wiederholung) {
    x += '<label>Wiederholung:</label><div class="pm-zeile"><span>' + esc(kpFrequenz(a.wiederholung)) + (pmDatum(a) ? ' · nächste ' + esc(pmDatumText(pmDatum(a))) : '') + '</span>'
      + '<button type="button" class="knopf" onclick="pmWiederholung()">Ändern…</button></div>'
      + '<label for="pmZeit">Erinnerung (Uhrzeit):</label><input id="pmZeit" class="eingabe zeitfeld" type="time" value="' + esc(f.zeit) + '">';
  } else {
    x += '<label>Fällig:</label><div class="wahlreihe">'
      + chip('kein', 'Kein Datum', !f.datum) + chip('heute', 'Heute', f.datum === h) + chip('morgen', 'Morgen', f.datum === tagePlus(h, 1))
      + chip('woche', '+1 Woche', f.datum === tagePlus(h, 7)) + '</div>'
      + '<div class="zeitpaar"><input id="pmDatum" class="eingabe" type="date" value="' + esc(f.datum) + '" aria-label="Datum">'
      + '<span>◉</span><input id="pmZeit" class="eingabe zeitfeld" type="time" value="' + esc(f.zeit) + '" aria-label="Erinnerung (Uhrzeit am Fälligkeitstag)"></div>'
      + '<label>Wiederholung:</label><div class="pm-zeile"><span>keine</span><button type="button" class="knopf" onclick="pmWiederholung()">Einrichten…</button></div>';
  }
  x += '<label for="pmNotiz">Notiz:</label><textarea id="pmNotiz" class="eingabe" rows="3">' + esc(f.notiz) + '</textarea>';
  /* Seit 0.81: nachträglich einem Memo zuordnen oder lösen */
  if (memo) {
    x += '<label>Memo:</label><div class="pm-zeile"><button type="button" class="verweis" onclick="pmMemoAusFenster()">' + esc(memo.titel) + (f.memo.zeile ? ' · Zeile' : '') + '</button>'
      + (a ? '<button type="button" class="knopf" onclick="pmMemoLoesen()">Lösen</button>' : '') + '</div>';
  } else if (a) {
    x += '<label>Memo:</label><div class="pm-zeile"><span>–</span><button type="button" class="knopf" onclick="pmZuordnenAuf()">Zuordnen…</button></div>';
  }
  return x + '<div class="knoepfe"><button type="button" class="knopf voll" onclick="pmSpeichern()">OK</button>'
    + '<button type="button" class="knopf" onclick="aufklappZu()">Abbrechen</button>'
    + (a ? '<button type="button" class="knopf" onclick="pmLoeschenFragen()">Löschen…</button>' : '') + '</div></div></div>';
}

/* Prüft und schreibt das Fenster. Gibt die Aufgabe zurück — oder null. */
function pmUebernehmen() {
  var f = pmFensterLesen();
  if (!f) { return null; }
  var titel = String(f.titel || '').replace(/\s+/g, ' ').trim();
  if (!titel) { melde('Bitte einen Titel eingeben.', 'warn'); return null; }
  if (f.datum && !pmIstDatum(f.datum)) { melde('Das Datum ist ungültig.', 'warn'); return null; }
  if (f.zeit && !pmIstZeit(f.zeit)) { melde('Die Uhrzeit ist ungültig.', 'warn'); return null; }
  var a = f.id ? pmAufgabeFinden(f.id) : null;
  if (!a) {
    a = pmNeueAufgabe({ titel: titel, prio: f.prio, bereich: f.bereich, privat: f.privat, datum: f.datum, zeit: f.zeit, notiz: f.notiz,
                        memo: f.memo, kontext: f.kontext });
    if (f.memoZeile) { pmMarkeSetzen(f.memoZeile.id, f.memoZeile.nr, f.memoZeile.text, a); }
    f.id = a.id;
    f.modus = 'details';
    cl.pm.wahl = a.id;
    return a;
  }
  a.titel = titel.slice(0, 300);
  a.prio = f.prio;
  a.beschreibung = String(f.notiz || '');
  katPrivatSchreiben(a, { bereich: f.bereich || '', privat: !!f.privat });
  if (a.wiederholung) { a.uhrzeit = f.zeit || ''; }
  else {
    a.planung = f.datum || 'backlog';
    a.uhrzeit = f.datum ? (f.zeit || '') : '';
  }
  a.geaendert = jetzt();
  return a;
}

function pmSpeichern() {
  var neu = !!(cl.pm.fenster && !cl.pm.fenster.id);
  var a = pmUebernehmen();
  if (!a) { return; }
  spaeterSichern();
  cl.pm.fenster = null;
  aufklappZu();
  zeichne();
  /* Wie bisher: bei Prio 1/2 oder vollem Tag fragt der Coach nach */
  if (neu && !a.wiederholung && coVorabNoetig(pmCoachText(a), pmDatum(a))) {
    coVorabAuf({ art: 'aufgabe', text: pmCoachText(a), aufgabe: a.id, seite: '', datum: pmDatum(a), frist: '' });
  }
}

/* ---------- Coach: die Aufgaben des Tages ---------- */

/* Der Text, wie der Coach ihn kennt: „P1 Titel“ (ohne Kürzel = 3) */
function pmCoachText(a) {
  var p = pmPrio(a);
  return (p !== 3 ? 'P' + p + ' ' : '') + pmTitel(a);
}

/* Zeilen im Format von coTagDaten: { a: { text, erledigt }, pm } */
function pmCoachZeilen(is) {
  return pmAmTag(is).filter(function (a) { return !a.wiederholung; }).map(function (a) {
    return { nr: -1, roh: '', a: { text: pmCoachText(a), erledigt: a.status === 'erledigt', nichtRelevant: false }, zeit: pmIstZeit(a.uhrzeit) ? a.uhrzeit : '', pm: a.id, quelle: '', cls: '' };
  });
}

/* Verschieben: an „is“ fällige Aufgabe mit diesem Text (oder Kennung) → neuer Tag oder ohne Datum */
function pmCoachVerschieben(is, text, ziel) {
  var a = pmAufgabeFinden(text);
  if (!a || a.wiederholung) {
    a = null;
    (is ? pmAmTag(is) : []).forEach(function (x) { if (!a && !x.wiederholung && x.status !== 'erledigt' && pmCoachText(x) === text) { a = x; } });
  }
  if (!a) { return false; }
  a.planung = pmIstDatum(ziel) ? ziel : 'backlog';
  if (!pmIstDatum(ziel)) { a.uhrzeit = ''; }
  a.geaendert = jetzt();
  spaeterSichern();
  return true;
}

function pmCoachStreichen(id) {
  var a = pmAufgabeFinden(id);
  if (!a) { return false; }
  DB.aufgaben.splice(DB.aufgaben.indexOf(a), 1);
  grabsteinSetzen('aufgaben', a.id);
  spaeterSichern();
  return true;
}

/* Wiederholung: aus der Aufgabe wird eine Routine — Regel im Routinen-Fenster */
function pmWiederholung() {
  var a = pmUebernehmen();
  if (!a) { return; }
  if (!a.wiederholung) {
    var d = pmIstDatum(a.planung) ? a.planung : isoDatum();
    a.wiederholung = { takt: 'woche', intervall: 1, tage: [ausIso(d).getDay()], tag: Number(d.slice(8, 10)) };
    a.ab = d;
    a.planung = 'backlog';
    a.status = 'offen';
    a.erledigtAm = null;
    a.geaendert = jetzt();
  }
  spaeterSichern();
  cl.pm.fenster = null;
  rtDetails(a.id);
}

function pmLoeschenFragen() {
  var f = pmFensterLesen();
  if (!f || !f.id) { return; }
  f.modus = 'loeschen';
  aufklappNeu();
}

function pmLoeschen() {
  var f = cl.pm.fenster;
  var a = f ? pmAufgabeFinden(f.id) : null;
  if (!a) { aufklappZu(); return; }
  var s = pmMemoVon(a);
  if (s && a.memo.zeile) {
    var nr = pmZeileMitMarke(s, a.memo.zeile);
    if (nr >= 0) {
      var zeilen = String(s.text || '').split('\n');
      zeilen[nr] = pmOhneMarke(zeilen[nr]);
      s.text = zeilen.join('\n');
      s.geaendert = jetzt();
    }
  }
  DB.aufgaben.splice(DB.aufgaben.indexOf(a), 1);
  grabsteinSetzen('aufgaben', a.id);
  if (cl.pm.wahl === a.id) { cl.pm.wahl = ''; }
  spaeterSichern();
  cl.pm.fenster = null;
  aufklappZu();
  melde('Aufgabe gelöscht.', null);
}

/* ---- Aufgabe nachträglich einem Memo zuordnen (seit 0.81) ---- */

/* Getipptes bleibt im Fenster; die Liste der Memos (eigene Kategorie oben) */
function pmZuordnenAuf() {
  var f = pmFensterLesen();
  if (!f || !pmAufgabeFinden(f.id)) { return; }
  cl.pm.zuAlle = false;
  cl.pm.zuTermin = false;
  cl.aufklapp = 'pmzuordnen';
  aufklappNeu();
}

/* Seit 0.83.1: alle Memos statt nur derselben Seite (Arbeit / Privat) */
function pmZuordnenAlle() {
  cl.pm.zuAlle = true;
  aufklappNeu();
}

/* Seit 0.90 auch für einen bestehenden Termin: dann ist cl.pm.zuTermin an und cl.termin.t der Termin */
function pmZuordnenHtml() {
  var t = cl.pm.zuTermin && cl.termin ? cl.termin.t : null;
  var f = cl.pm.fenster;
  var a = (!t && f) ? pmAufgabeFinden(f.id) : null;
  if (!a && !t) { return ''; }
  var kat = t ? '' : (f.bereich || clKategorieVon(a));
  /* Seit 0.83.1: kein Archiv; vorgefiltert nach Arbeit oder Privat — wie die Aufgabe (der Termin: nach seinem Kalender) */
  var arbeit = t ? t.kontext === 'beruflich' : clIstArbeit(kat);
  var alle = kpSeitenAlle().filter(function (s) {
    if (pmIstVorlage(s) || ckIstKorb(s) || pmArchiviert(s) || prPrivatVerborgen(s, null)) { return false; }
    return cl.pm.zuAlle || clIstArbeit(clKategorieVon(s)) === arbeit;
  });
  var rang = function (s) { return clKategorieVon(s) === kat ? 0 : 1; };
  alle.sort(function (x, y) {
    return (rang(x) - rang(y)) || (PM_KUERZEL.indexOf(pmKuerzel(x)) - PM_KUERZEL.indexOf(pmKuerzel(y))) || String(x.titel).localeCompare(String(y.titel), 'de');
  });
  return '<div class="fenster"><div class="titel">Memo zuordnen</div><div class="rumpf">'
    + (t ? '<p class="leise">„' + esc(t.titel) + '“ wird mit dem ganzen Memo verknüpft — der Google-Termin bleibt, wie er ist.</p>'
         : '<p class="leise">„' + esc(pmTitel(a)) + '“ kommt als Kästchen-Zeile ans Ende des Memos — der Haken gilt dann in beiden.</p>')
    + (alle.length ? alle.map(function (s) {
      return '<button type="button" class="wahl" onclick="' + (t ? 'pmTerminZuordnen' : 'pmZuordnen') + '(\'' + esc(s.id) + '\')"><b>' + pmKuerzel(s) + '</b> ' + esc(s.titel) + '</button>';
    }).join('') : '<p class="leise">Kein passendes Memo.</p>')
    + '<div class="knoepfe">' + (cl.pm.zuAlle ? '' : '<button type="button" class="knopf" onclick="pmZuordnenAlle()">' + (arbeit ? 'Auch Privates…' : 'Auch Arbeit…') + '</button>')
    + '<button type="button" class="knopf" onclick="pmZuordnenZurueck()">Abbrechen</button></div></div></div>';
}

function pmZuordnenZurueck() {
  if (cl.pm.zuTermin) {
    cl.pm.zuTermin = false;
    cl.aufklapp = cl.termin ? 'termin' : '';
    aufklappNeu();
    return;
  }
  cl.aufklapp = cl.pm.fenster ? 'pmaufgabe' : '';
  aufklappNeu();
}

/* Marke aus der Zeile nehmen — Zeile und Aufgabe bleiben */
function pmMarkeWeg(a) {
  var s = pmMemoVon(a);
  if (!s || !a.memo.zeile) { return; }
  var nr = pmZeileMitMarke(s, a.memo.zeile);
  if (nr < 0) { return; }
  var zeilen = String(s.text || '').split('\n');
  zeilen[nr] = pmOhneMarke(zeilen[nr]);
  s.text = zeilen.join('\n');
  s.geaendert = jetzt();
}

function pmZuordnen(memoId) {
  var f = cl.pm.fenster;
  var a = f ? pmAufgabeFinden(f.id) : null;
  var s = kpSeiteFinden(memoId);
  if (!a || !s) { pmZuordnenZurueck(); return; }
  pmMarkeWeg(a);
  var zeilen = String(s.text || '').split('\n');
  while (zeilen.length && !zeilen[zeilen.length - 1].trim()) { zeilen.pop(); }
  zeilen.push((a.status === 'erledigt' ? '[x] ' : '[] ') + pmTitel(a).replace(/\s+/g, ' ') + ' ⟦' + a.id + '⟧');
  s.text = zeilen.join('\n');
  s.geaendert = jetzt();
  a.memo = { id: s.id, zeile: a.id };
  a.geaendert = jetzt();
  f.memo = { id: s.id, zeile: a.id };
  spaeterSichern();
  melde('Steht jetzt in „' + s.titel + '“.', 'gut');
  pmZuordnenZurueck();
}

function pmMemoLoesen() {
  var f = pmFensterLesen();
  var a = f ? pmAufgabeFinden(f.id) : null;
  if (!a || !a.memo) { return; }
  pmMarkeWeg(a);
  delete a.memo;
  a.geaendert = jetzt();
  f.memo = null;
  spaeterSichern();
  aufklappNeu();
}

function pmMemoAusFenster() {
  var f = pmFensterLesen();
  var m = f && f.memo;
  if (!m) { return; }
  aufklappZu();
  pmMemoOeffnen(m.id, m.zeile || '');
}

function pmMemoVonAufgabe(id) {
  var a = pmAufgabeFinden(id);
  if (!a || !a.memo) { return; }
  if (!kpSeiteFinden(a.memo.id)) { melde('Das Memo gibt es nicht mehr.', null); return; }
  pmMemoOeffnen(a.memo.id, a.memo.zeile || '');
}

/* ---------- Date Book: die Aufgaben eines Tages ---------- */

/* Was an „is“ dran ist: heute auch Überfälliges; Routinen des Tages */
function pmAmTag(is) {
  var heute = isoDatum();
  return (DB.aufgaben || []).filter(function (a) {
    if (!a || !a.id || !clPasst(a)) { return false; }
    if (a.wiederholung) { return !a.pausiert && (aufgabeFaelligAn(a, is) || istErledigtAn(a, is)); }
    if (a.status === 'erledigt') { return a.erledigtAm === is; }
    var d = pmDatum(a);
    if (!d) { return false; }
    return is === heute ? d <= is : d === is;
  });
}

/* { html, weg: Zahl verborgener erledigter } */
function pmAgenda(is, erlZeigen) {
  var show = { datum: true, prio: true, kat: false, sort: 'prio' };
  var weg = 0;
  var l = pmAmTag(is).filter(function (a) {
    var erl = a.wiederholung ? istErledigtAn(a, is) : a.status === 'erledigt';
    if (erl && !erlZeigen) { weg++; return false; }
    return true;
  });
  l.sort(function (x, y) {
    var zx = x.wiederholung ? aufgabeZeitAn(x, is) : x.uhrzeit;
    var zy = y.wiederholung ? aufgabeZeitAn(y, is) : y.uhrzeit;
    zx = pmIstZeit(zx) ? zx : '99:99';
    zy = pmIstZeit(zy) ? zy : '99:99';
    return (zx < zy ? -1 : (zx > zy ? 1 : 0)) || (pmPrio(x) - pmPrio(y)) || pmTitel(x).localeCompare(pmTitel(y), 'de');
  });
  return { html: l.map(function (a) {
    return pmZeileHtml(a, { show: show, tag: is, zeit: true, mitDatum: !a.wiederholung && pmDatum(a) !== is });
  }).join(''), weg: weg, zahl: l.length };
}

/* ▤ an einem Termin, der aus einem Memo kam */
function pmTerminMemo(terminId) {
  if (!terminId) { return null; }
  var l = kpSeitenAlle();
  var i;
  for (i = 0; i < l.length; i++) {
    var t = l[i].__satz && l[i].__satz.termine;
    if (Array.isArray(t) && t.some(function (x) { return x && x.id === terminId; })) { return l[i]; }
  }
  return null;
}

function pmTerminMarke(terminId) {
  var s = pmTerminMemo(terminId);
  return s ? '<button type="button" class="pm-sym" onclick="pmMemoOeffnen(\'' + esc(s.id) + '\',\'\')" aria-label="Memo öffnen">▤</button>' : '';
}

/* ---------- Memo Pad ---------- */

function pmKuerzel(s) {
  if (!s) { return '–'; }
  if (s.art === 'vorhaben') { return s.typ === 'ziel' ? 'Z' : 'P'; }
  var x = s.__satz || {};
  if (s.art === 'notiz' && x.checkliste && x.art === 'aufgaben') { return 'A'; }
  if (s.art === 'notiz' && x.todoListe === true) { return 'T'; }
  return '–';
}

function pmIstVorlage(s) {
  var x = s && s.__satz;
  return !!(x && (x.istVorlage === true || x.checkliste === 'vorlage'));
}

function pmArchiviert(s) {
  var x = s && s.__satz;
  if (!x) { return false; }
  if (x.archiv === true) { return true; }
  if (s.art === 'vorhaben') { return s.zustand === 'erledigt'; }
  if (s.art === 'liste') { return !!x.abgeschlossen; }
  return x.checkliste === 'fertig';
}

/* Die Memos einer Sicht: '' (laufend), 'vorlagen', 'archiv' — nach Kürzel, dann Titel */
function pmMemos(sicht) {
  var l = kpSeitenAlle().filter(function (s) {
    if (!clPasst(s) && !ckIstKorb(s)) { return false; }
    if (ckIstKorb(s)) { return sicht !== 'vorlagen' && sicht !== 'archiv' && kpOffeneZahl(s) > 0; }
    var v = pmIstVorlage(s);
    if (sicht === 'vorlagen') { return v; }
    if (v) { return false; }
    if (!sicht && pmKzAus().indexOf(pmKuerzel(s)) >= 0) { return false; }
    if (!sicht && pmIstAusgeblendet(s) && !pmAusgeblZeigen()) { return false; }
    return (sicht === 'archiv') === pmArchiviert(s);
  });
  /* Seit 0.84: alphabetisch — nach Typ nur, wenn „Gruppiert“ an ist */
  /* Seit 0.93 nach Kategorie (ohne Kategorie zuletzt) oder nach Typ — innerhalb alphabetisch */
  var nachKat = pmGruppiert() && pmGruppeArt() === 'kat';
  var katName = function (s) { var k = clKategorieVon(s); return k ? pmKatName(k) : '\uffff'; };
  return l.sort(function (a, b) {
    var g = !pmGruppiert() ? 0 : (nachKat ? katName(a).localeCompare(katName(b), 'de') : PM_KUERZEL.indexOf(pmKuerzel(a)) - PM_KUERZEL.indexOf(pmKuerzel(b)));
    return g || String(a.titel).localeCompare(String(b.titel), 'de');
  });
}

/* ---- Kürzel als Ausschalter und „Gruppiert“ (seit 0.84) ----
   T · A · P · Z · – sind an; ein Tipp schaltet einen Typ aus, noch einer wieder an. */

var PM_KZAUS_KEY = 'clie-memo-kzaus';
var PM_GRUPPE_KEY = 'clie-memo-gruppiert';
var PM_GRUPPEN = { P: 'Projekte', Z: 'Ziele', A: 'Abläufe', T: 'ToDo-Listen', '–': 'Sonstiges' };

/* Die ausgeschalteten Kürzel, etwa „–“ oder „Z–“ */
function pmKzAus() {
  var k = '';
  try { k = window.localStorage.getItem(PM_KZAUS_KEY) || ''; } catch (e) { k = ''; }
  return PM_KUERZEL.filter(function (x) { return k.indexOf(x) >= 0; }).join('');
}

/* Seit 0.93: Balken sind Standard („Gruppiert“ unter Show… schaltet sie ab) */
function pmGruppiert() {
  try { return window.localStorage.getItem(PM_GRUPPE_KEY) !== '0'; } catch (e) { return true; }
}

/* Seit 0.93: bei mehreren Kategorien (▼ Alle, Privat, Arbeit) nach Kategorie oder nach Typ — seit 0.95.0 ist Typ Standard */
var PM_GRUPPE_ART_KEY = 'clie-memo-gruppe-art';

function pmMehrereKat() {
  var f = clFilter();
  return f === 'alle' || f === CL_PRIVAT || f === CL_ARBEIT;
}

function pmGruppeArt() {
  if (!pmMehrereKat() || pmMemoSicht()) { return 'typ'; }
  var w = '';
  try { w = window.localStorage.getItem(PM_GRUPPE_ART_KEY) || ''; } catch (e) { w = ''; }
  return w === 'kat' ? 'kat' : 'typ';
}

function pmGruppeArtSetzen(w) {
  try { window.localStorage.setItem(PM_GRUPPE_ART_KEY, w === 'typ' ? 'typ' : 'kat'); } catch (e) { /* nur für jetzt */ }
  var el = document.getElementById('inhalt');
  if (el) { el.scrollTop = 0; }
  zeichne();
}

/* Seit 0.85: Kürzel-Spalte zeigen (Standard) und ausgeblendete Memos zeigen (Standard: nein) */
var PM_SPALTE_KEY = 'clie-memo-spalte';
var PM_AUSGEBL_KEY = 'clie-memo-ausgebl';

function pmSpalte() {
  try { return window.localStorage.getItem(PM_SPALTE_KEY) !== '0'; } catch (e) { return true; }
}

function pmAusgeblZeigen() {
  try { return window.localStorage.getItem(PM_AUSGEBL_KEY) === '1'; } catch (e) { return false; }
}

function pmIstAusgeblendet(s) { return !!(s && s.__satz && s.__satz.ausgeblendet === true); }

/* ---- Show… im Memo Pad (seit 0.85): Typen, Kürzel-Spalte, Gruppiert, Ausgeblendete ---- */

function pmMShowAuf() {
  cl.pm.mshow = { kzaus: pmKzAus(), spalte: pmSpalte(), gruppiert: pmGruppiert(), aus: pmAusgeblZeigen() };
  cl.aufklapp = 'pmmshow';
  aufklappNeu();
}

function pmMShowLesen() {
  var f = cl.pm.mshow;
  if (!f) { return null; }
  [['spalte', 'pmMsSpalte'], ['gruppiert', 'pmMsGruppe'], ['aus', 'pmMsAus']].forEach(function (k) {
    var el = document.getElementById(k[1]);
    if (el && typeof el.checked === 'boolean') { f[k[0]] = el.checked; }
  });
  return f;
}

function pmMShowKz(k) {
  var f = pmMShowLesen();
  if (!f || PM_KUERZEL.indexOf(k) < 0) { return; }
  f.kzaus = f.kzaus.indexOf(k) >= 0 ? f.kzaus.replace(k, '') : f.kzaus + k;
  aufklappNeu();
}

function pmMShowHtml() {
  var f = cl.pm.mshow;
  if (!f) { return ''; }
  var haken = function (id, an, text) { return '<label class="haken"><input id="' + id + '" type="checkbox"' + (an ? ' checked' : '') + '> ' + text + '</label>'; };
  return '<div class="fenster"><div class="titel">Show</div><div class="rumpf">'
    + '<label>Typen zeigen:</label><div class="wahlreihe pm-kz">' + PM_KUERZEL.map(function (k) {
      return '<button type="button"' + (f.kzaus.indexOf(k) < 0 ? ' class="an"' : '') + ' onclick="pmMShowKz(\'' + k + '\')" aria-label="' + PM_GRUPPEN[k] + '">' + k + '</button>';
    }).join('') + '</div>'
    + haken('pmMsSpalte', f.spalte, 'Kürzel-Spalte zeigen')
    + haken('pmMsGruppe', f.gruppiert, 'Gruppiert (Balken nach Typ oder Kategorie)')
    + haken('pmMsAus', f.aus, 'Ausgeblendete zeigen')
    + '<div class="knoepfe"><button type="button" class="knopf voll" onclick="pmMShowOk()">OK</button>'
    + '<button type="button" class="knopf" onclick="aufklappZu()">Abbrechen</button></div></div></div>';
}

function pmMShowOk() {
  var f = pmMShowLesen();
  if (f) {
    try {
      window.localStorage.setItem(PM_KZAUS_KEY, PM_KUERZEL.filter(function (x) { return f.kzaus.indexOf(x) >= 0; }).join(''));
      window.localStorage.setItem(PM_SPALTE_KEY, f.spalte ? '1' : '0');
      window.localStorage.setItem(PM_GRUPPE_KEY, f.gruppiert ? '1' : '0');
      window.localStorage.setItem(PM_AUSGEBL_KEY, f.aus ? '1' : '0');
    } catch (e) { /* nur für jetzt */ }
  }
  cl.pm.mshow = null;
  aufklappZu();
  var el = document.getElementById('inhalt');
  if (el) { el.scrollTop = 0; }
  zeichne();
}

function pmMemoNeu() {
  memoNeuArt('notiz');
}

function pmMemoSicht() { return (cl.memo.sicht === 'vorlagen' || cl.memo.sicht === 'archiv') ? cl.memo.sicht : ''; }

function pmMemoListeHtml() {
  var sicht = pmMemoSicht();
  var l = pmMemos(sicht);
  var h = sicht ? '' : pmBannerHtml();
  if (!l.length) {
    if (!sicht && pmKzAus()) { return h + '<p class="leise">Nichts zu zeigen — ausgeschaltet: ' + pmKzAus().split('').join(' ') + '.</p>'; }
    return h + '<p class="leise">' + (sicht === 'vorlagen' ? 'Noch keine Vorlage — im Memo Menü ≡ „Als Vorlage speichern“.'
      : sicht === 'archiv' ? 'Das Archiv ist leer.' : 'Noch kein Memo — „Neu“ tippen.') + '</p>';
  }
  var gruppe = pmGruppiert();
  /* Seit 0.93: Balken mit Anzahl — nach Typ oder nach Kategorie */
  var nachKat = gruppe && pmGruppeArt() === 'kat';
  var schluessel = function (s) { return nachKat ? (clKategorieVon(s) || '') : pmKuerzel(s); };
  var zahl = {};
  l.forEach(function (s) { var g = schluessel(s); zahl[g] = (zahl[g] || 0) + 1; });
  var letzte = null;
  return h + l.map(function (s) {
    var gew = sicht === 'archiv' && cl.pm.memoWahl === s.id;
    var k = pmKuerzel(s);
    var g = schluessel(s);
    var kopf = (gruppe && g !== letzte) ? '<div class="pm-bal">' + esc(nachKat ? pmKatName(g) : PM_GRUPPEN[k]) + '<small>' + zahl[g] + '</small></div>' : '';
    letzte = g;
    var aus = pmIstAusgeblendet(s);
    return kopf + prZeile(s, null, '<button type="button" class="memo-zeile pm' + (gew ? ' gewaehlt' : '') + (aus ? ' aus' : '') + '" onclick="pmMemoTipp(\'' + esc(s.id) + '\')">'
      + (((gruppe && !nachKat) || !pmSpalte()) ? '' : '<span class="mz kz">' + k + '</span>') + '<span class="tx">' + esc(s.titel) + '</span>'
      + (aus ? '<small class="pm-ausgebl">ausgebl.</small>' : '') + '</button>');
  }).join('');
}

function pmMemoTipp(id) {
  var sicht = pmMemoSicht();
  if (sicht === 'vorlagen') { pmVorlageTipp(id); return; }
  if (sicht === 'archiv' && cl.pm.memoWahl !== id) { cl.pm.memoWahl = id; inhaltZeichnen(); return; }
  pmMemoOeffnen(id, '');
}

/* Öffnet ein Memo — auf Wunsch mit hervorgehobener Zeile (Marke) */
function pmMemoOeffnen(id, marke) {
  var s = kpSeiteFinden(id);
  if (!s) { return; }
  aufklappZuStill();
  if (cl.app !== 'memo') { oeffne('memo'); }
  memoSeitenModus();
  cl.memo.id = s.id;
  cl.memo.schreiben = false;
  cl.memo.hervor = '';
  cl.memo.ausListe = '';
  cl.memo.ausProjekt = '';
  cl.memo.ausZiel = '';
  cl.pm.zeile = -1;
  cl.pm.marke = marke || '';
  var el = document.getElementById('inhalt');
  if (el) { el.scrollTop = 0; }
  zeichne();
  if (marke) {
    var z = document.getElementById('memoZ' + pmZeileMitMarke(s, marke));
    if (z && z.scrollIntoView) { z.scrollIntoView({ block: 'center' }); }
  }
}

function pmMemoZuListe() {
  cl.memo.id = '';
  cl.memo.schreiben = false;
  cl.memo.hervor = '';
  cl.pm.zeile = -1;
  cl.pm.marke = '';
  zeichne();
}

/* Inline: **fett**, __unterstrichen__, ~~durchgestrichen~~ — sonst nur Text */
function pmInlineHtml(text) { return pmAuszeichnungNach(esc(text)); }

/* Text mit Verweisen und Links (kpAuszeichnen aus der Workbench) — dazu verschachtelte Auszeichnung (seit 0.91.2) */
function pmAuszeichnen(text) { return pmAuszeichnungNach(kpAuszeichnen(text)); }

/* **fett**, __unterstrichen__, ~~durchgestrichen~~ in schon maskiertem Text */
function pmAuszeichnungNach(t) {
  /* Seit 0.91.2: verschachtelt in jeder Reihenfolge (etwa __**fett unterstrichen**__) — die Zeichen der anderen Auszeichnungen gelten als Grenze */
  t = t.replace(/(^|[\s(>_~])\*\*([^*\n\s](?:[^*\n]{0,398}[^*\n\s])?)\*\*(?=$|[\s.,;:!?)<_~])/g, '$1<b>$2</b>');
  t = t.replace(/(^|[\s(>*~])__([^_\n\s](?:[^_\n]{0,398}[^_\n\s])?)__(?=$|[\s.,;:!?)<*~])/g, '$1<u>$2</u>');
  t = t.replace(/(^|[\s(>*_])~~([^~\n\s](?:[^~\n]{0,398}[^~\n\s])?)~~(?=$|[\s.,;:!?)<*_])/g, '$1<s>$2</s>');
  return t;
}

function pmMemoSeiteHtml(s) {
  if (prPrivatVerborgen(s, null)) { return '<p class="leise">Dieser Eintrag ist privat.</p>' + prMaskeHtml(); }
  if (cl.memo.schreiben) { return pmEditorHtml(s); }
  var zeilen = String(s.text || '').split('\n');
  var blaetter = nbAnhaengeHtml('seite', s.id);
  if (!zeilen.join('').trim()) { return blaetter || '<p class="leise">Noch leer — „Schreiben“ tippen.</p>'; }
  var h = '';
  var tabelle = [];
  var tabelleAus = function () { if (tabelle.length) { h += memoTabelleHtml(tabelle); tabelle = []; } };
  var id = esc(s.id);
  zeilen.forEach(function (z, nr) {
    if (/^\s*\|.*\|\s*$/.test(z)) { tabelle.push(z); return; }
    tabelleAus();
    var sk = z.match(HS_MUSTER);
    if (sk) { h += hsSkizzeHtml(sk[1]); return; }
    var mid = pmMarke(z);
    var a = kpAufgabe(pmOhneMarke(z));
    if (a) {
      var rest = (pmOhneMarke(z).match(KP_KASTEN) || ['', '', '', ''])[3];
      var hervor = (mid && mid === cl.pm.marke) || (cl.memo.hervor && a.text === cl.memo.hervor);
      h += '<div class="aufg pm-z' + (a.erledigt ? ' erl' : '') + (cl.pm.zeile === nr ? ' gewaehlt' : '') + (hervor ? ' hervor' : '') + '" id="memoZ' + nr + '">'
        + clKastenHtml(a.erledigt, 'pmMemoHaken(\'' + id + '\',' + nr + ')')
        + '<button type="button" class="tx umbruch" onclick="pmZeileTipp(' + nr + ')">' + (pmInlineHtml(rest) || ' ') + '</button>'
        + (mid ? '<button type="button" class="pm-todo" onclick="pmAufgabeZurZeile(\'' + esc(mid) + '\')" aria-label="Aufgabe im To Do">' + PM_TODO_SVG + '</button>' : '')
        + '</div>';
      return;
    }
    var m = z.match(/^\s*(#{1,3})\s+(.*)$/);
    if (m) { h += '<div class="memo-h' + m[1].length + '">' + pmInlineHtml(m[2]) + '</div>'; return; }
    if (/^\s*(---+|\*\*\*+)\s*$/.test(z)) { h += '<div class="memo-trenn"></div>'; return; }
    var p = z.match(/^(\s*)[-•*]\s+(.*)$/);
    if (p) { h += '<div class="memo-punkt" style="padding-left:' + Math.min(4, Math.floor(p[1].length / 2)) * 16 + 'px">• ' + pmInlineHtml(p[2]) + '</div>'; return; }
    var n = z.match(/^(\s*)(\d{1,3})[.)]\s+(.*)$/);
    if (n) { h += '<div class="memo-punkt" style="padding-left:' + Math.min(4, Math.floor(n[1].length / 2)) * 16 + 'px"><span class="nr">' + n[2] + '.</span> ' + pmInlineHtml(n[3]) + '</div>'; return; }
    h += z.trim() ? '<div class="memo-text">' + pmAuszeichnen(z) + '</div>' : '<div class="memo-leer"></div>';
  });
  tabelleAus();
  return h + blaetter;
}

/* Eine Kästchen-Zeile antippen wählt sie (für „Zeile → Aufgabe…“) */
function pmZeileTipp(nr) {
  cl.pm.zeile = (cl.pm.zeile === nr) ? -1 : nr;
  cl.pm.marke = '';
  inhaltZeichnen();
}

function pmAufgabeZurZeile(mid) {
  var a = pmAufgabeZurMarke(mid);
  if (!a) { melde('Die Aufgabe gibt es nicht mehr.', null); return; }
  pmDetails(a.id);
}

function pmMemoHtml() {
  var s = cl.memo.id ? kpSeiteFinden(cl.memo.id) : null;
  return s ? pmMemoSeiteHtml(s) : pmMemoListeHtml();
}

function pmMemoFussHtml() {
  var s = cl.memo.id ? kpSeiteFinden(cl.memo.id) : null;
  var sicht = pmMemoSicht();
  if (!s) {
    if (sicht === 'archiv') {
      return '<button type="button" class="knopf" onclick="pmArchivUm(\'\')">Zurückholen</button>'
        + '<button type="button" class="knopf" onclick="pmMemoLoeschenFragen(\'\')">Löschen…</button>';
    }
    if (sicht === 'vorlagen') { return '<button type="button" class="knopf" onclick="memoArtSetzen(\'alles\')">Fertig</button>'; }
    return '<button type="button" class="knopf" onclick="pmMemoNeu()">Neu</button>'
      + '<button type="button" class="knopf" onclick="memoArtSetzen(\'vorlagen\')">Vorlage…</button>'
      /* gefüllt, solange von der Standardsicht abgewichen wird: Typ aus oder Ausgeblendete an */
      + '<button type="button" class="knopf' + ((pmKzAus() || pmAusgeblZeigen()) ? ' voll' : '') + '" onclick="pmMShowAuf()">Show…</button>'
      /* Seit 0.93: bei mehreren Kategorien umschalten — Kategorie ist Standard */
      + ((pmGruppiert() && pmMehrereKat()) ? '<div class="pm-tabs">' + [['typ', 'Typ'], ['kat', 'Kategorie']].map(function (t) {
          return '<button type="button"' + (pmGruppeArt() === t[0] ? ' class="an"' : '') + ' onclick="pmGruppeArtSetzen(\'' + t[0] + '\')">' + t[1] + '</button>';
        }).join('') + '</div>' : '');
  }
  if (cl.memo.schreiben) { return '<button type="button" class="knopf voll" onclick="pmSchreibenUm()">Fertig</button>'; }
  return '<button type="button" class="knopf" onclick="pmMemoZuListe()">Fertig</button>'
    + (pmArchiviert(s) && !pmIstVorlage(s) ? '<button type="button" class="knopf" onclick="pmArchivUm(\'' + esc(s.id) + '\')">Zurückholen</button>'
      : '<button type="button" class="knopf" onclick="pmSchreibenUm()">Schreiben</button>')
    + '<button type="button" class="knopf" onclick="pmMemoDetails()">Details…</button>';
}

/* ---- Schreiben: echte Knöpfe statt Zeichen ----
   Jede Zeile ist ein <div>. Die Art der Zeile steht in data-vor (genau der
   Anfang der Textzeile: „[] “, „[x] “, „- “, „## “ …), die Marke in data-m.
   Was nicht bearbeitbar ist (Tabelle, Skizze, Trenner), steht in data-roh. */

function pmEdZeileHtml(z) {
  var roh = function () { return '<div class="pm-roh" contenteditable="false" data-roh="' + esc(z) + '">' + esc(z) + '</div>'; };
  if (/^\s*\|.*\|\s*$/.test(z) || HS_MUSTER.test(z) || /^\s*(---+|\*\*\*+)\s*$/.test(z)) { return roh(); }
  var einzug = function (e) { return e ? ' style="margin-left:' + Math.min(4, Math.floor(e.length / 2)) * 16 + 'px"' : ''; };
  var inhalt = function (t) { return pmInlineHtml(t) || '<br>'; };
  var mid = pmMarke(z);
  var ohne = pmOhneMarke(z);
  var k = ohne.match(KP_KASTEN);
  if (k) {
    var st = (k[2] === 'x' || k[2] === 'X') ? 'x' : (k[2] === '-' ? '-' : '');
    return '<div class="pm-k' + (st ? ' x' : '') + '" data-vor="' + esc(k[1] + '[' + st + '] ') + '"' + (mid ? ' data-m="' + esc(mid) + '"' : '') + einzug(k[1]) + '>' + inhalt(k[3]) + '</div>';
  }
  var p = z.match(/^(\s*)[-•*]\s+(.*)$/);
  if (p) { return '<div class="pm-p" data-vor="' + esc(p[1] + '- ') + '"' + einzug(p[1]) + '>' + inhalt(p[2]) + '</div>'; }
  var h = z.match(/^(\s*)(#{1,3})\s+(.*)$/);
  if (h) { return '<div class="pm-h" data-vor="' + esc(h[1] + h[2] + ' ') + '">' + inhalt(h[3]) + '</div>'; }
  var n = z.match(/^(\s*)(\d{1,3}[.)])\s+(.*)$/);
  if (n) { return '<div class="pm-n" data-vor="' + esc(n[1] + n[2] + ' ') + '"' + einzug(n[1]) + '>' + inhalt(n[3]) + '</div>'; }
  var e = (z.match(/^\s*/) || [''])[0];
  return '<div class="pm-t"' + (e ? ' data-vor="' + esc(e) + '"' : '') + einzug(e) + '>' + inhalt(z.slice(e.length)) + '</div>';
}

function pmEditorHtml(s) {
  var knopf = function (was, bild, name) {
    return '<button type="button" onmousedown="event.preventDefault()" onclick="pmFormat(\'' + was + '\')" aria-label="' + name + '">' + bild + '</button>';
  };
  return '<div class="pm-leiste">' + knopf('fett', '<b>B</b>', 'fett') + knopf('unter', '<u>U</u>', 'unterstrichen') + knopf('durch', '<s>S</s>', 'durchgestrichen')
    + knopf('punkt', '•', 'Aufzählung') + knopf('kasten', '☐', 'Kästchen') + '</div>'
    + '<div id="pmEditor" class="pm-editor" contenteditable="true" spellcheck="true" oninput="pmEdGetippt()" onkeyup="pmEdMarkeMerken()" onmouseup="pmEdMarkeMerken()" ontouchend="pmEdMarkeMerken()" onkeydown="pmEdTaste(event)" onpaste="pmEdEinfuegen(event)">'
    + String(s.text || '').split('\n').map(pmEdZeileHtml).join('') + '</div>';
}

function pmTag(n) { return String((n && (n.nodeName || n.tagName)) || '').toUpperCase(); }

function pmAttr(n, name) {
  if (!n || typeof n.getAttribute !== 'function') { return null; }
  return n.getAttribute(name);
}

/* Auszeichnung um einen Inhalt — Leerzeichen bleiben außen */
function pmUmschliessen(zeichen, inhalt) {
  return String(inhalt).split('\n').map(function (teil) {
    if (!teil.trim()) { return teil; }
    var m = teil.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return m[1] + zeichen + m[2] + zeichen + m[3];
  }).join('\n');
}

/* Inhalt eines Knotens als Text mit **, __, ~~ — Zeilenwechsel als \n */
function pmEdInline(n) {
  if (!n) { return ''; }
  if (n.nodeType === 3) { return String(n.nodeValue || '').replace(/ /g, ' '); }
  if (n.nodeType !== 1) { return ''; }
  var tag = pmTag(n);
  if (tag === 'BR') { return '\n'; }
  if (pmAttr(n, 'contenteditable') === 'false') { return ''; }
  var innen = '';
  var k = n.childNodes || [];
  var i;
  for (i = 0; i < k.length; i++) { innen += pmEdInline(k[i]); }
  if (tag === 'B' || tag === 'STRONG') { return pmUmschliessen('**', innen); }
  if (tag === 'U') { return pmUmschliessen('__', innen); }
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') { return pmUmschliessen('~~', innen); }
  if (tag === 'DIV' || tag === 'P') { return '\n' + innen.replace(/\n$/, ''); }
  if (tag === 'SPAN' && n.style) {
    var st = n.style;
    if (/^(bold|[6-9]00)$/.test(String(st.fontWeight || ''))) { innen = pmUmschliessen('**', innen); }
    var deko = String(st.textDecoration || '') + ' ' + String(st.textDecorationLine || '');
    if (/underline/.test(deko)) { innen = pmUmschliessen('__', innen); }
    if (/line-through/.test(deko)) { innen = pmUmschliessen('~~', innen); }
  }
  return innen;
}

/* Die Art der nächsten Zeile: ein Kästchen bleibt Kästchen (offen, ohne Marke) */
function pmVorWeiter(vor) {
  var v = String(vor || '');
  var k = v.match(/^(\s*)\[[ xX-]?\]\s*$/);
  if (k) { return k[1] + '[] '; }
  var n = v.match(/^(\s*)(\d{1,3})([.)])\s*$/);
  if (n) { return n[1] + (Number(n[2]) + 1) + n[3] + ' '; }
  if (/^\s*#{1,3}\s*$/.test(v)) { return ''; }
  return v;
}

/* Der Editor als Text der Seite */
function pmEdLesen(root) {
  var zeilen = [];
  var marken = {};
  var lauf = null;
  var ausLauf = function () {
    if (lauf === null) { return; }
    lauf.replace(/\n$/, '').split('\n').forEach(function (t) { zeilen.push(t); });
    lauf = null;
  };
  var k = (root && root.childNodes) || [];
  var i;
  for (i = 0; i < k.length; i++) {
    var n = k[i];
    var tag = pmTag(n);
    if (n.nodeType === 1 && (tag === 'DIV' || tag === 'P')) {
      ausLauf();
      var roh = pmAttr(n, 'data-roh');
      if (roh !== null) { zeilen.push(roh); continue; }
      var vor = pmAttr(n, 'data-vor') || '';
      var m = pmAttr(n, 'data-m') || '';
      var innen = '';
      var kk = n.childNodes || [];
      var j;
      for (j = 0; j < kk.length; j++) { innen += pmEdInline(kk[j]); }
      innen = innen.replace(/^\n/, '').replace(/\n$/, '');
      var teile = innen.split('\n');
      var istKasten = /^\s*\[[ xX-]?\]\s*$/.test(vor);
      teile.forEach(function (t, nr) {
        var v = nr ? pmVorWeiter(vor) : vor;
        var z = v + t;
        if (!nr && istKasten && m && !marken[m]) { marken[m] = true; z = z.replace(/\s+$/, '') + ' ⟦' + m + '⟧'; }
        zeilen.push(z);
      });
    } else {
      lauf = (lauf === null ? '' : lauf) + pmEdInline(n);
    }
  }
  ausLauf();
  return zeilen.join('\n');
}

function pmEdGetippt() {
  var s = cl.memo.id ? kpSeiteFinden(cl.memo.id) : null;
  var el = document.getElementById('pmEditor');
  if (!s || !el || !el.childNodes) { return; }
  var t = pmEdLesen(el);
  if (t === String(s.text || '')) { return; }
  s.text = t;
  s.geaendert = jetzt();
  spaeterSichern();
}

/* Seit 0.91.1: die Zeile mit der Schreibmarke merken — ein Klick ins Menü kann die Auswahl verlieren */
function pmEdMarkeMerken() {
  var sel = window.getSelection ? window.getSelection() : null;
  var z = (sel && sel.anchorNode) ? pmEdZeileVon(sel.anchorNode) : null;
  if (z) { cl.pm.edZeile = z; }
}

/* Nummer der Textzeile, in der die Schreibmarke steht (oder zuletzt stand) — sonst -1 */
function pmEdZeileNr() {
  var ed = document.getElementById('pmEditor');
  if (!ed || !ed.childNodes) { return -1; }
  var sel = window.getSelection ? window.getSelection() : null;
  var z = (sel && sel.anchorNode) ? pmEdZeileVon(sel.anchorNode) : null;
  if (!z && cl.pm.edZeile && cl.pm.edZeile.parentNode === ed) { z = cl.pm.edZeile; }
  var k = Array.prototype.slice.call(ed.childNodes);
  var i = z ? k.indexOf(z) : -1;
  if (i <= 0) { return i; }
  return pmEdLesen({ childNodes: k.slice(0, i) }).split('\n').length;
}

/* Die Zeile (direktes Kind des Editors), in der die Schreibmarke steht */
function pmEdZeileVon(knoten) {
  var ed = document.getElementById('pmEditor');
  var n = knoten;
  while (n && n.parentNode && n.parentNode !== ed) { n = n.parentNode; }
  return (n && n.parentNode === ed && n.nodeType === 1) ? n : null;
}

function pmEdArt(zeile, art) {
  var vor = pmAttr(zeile, 'data-vor') || '';
  var einzug = (vor.match(/^\s*/) || [''])[0];
  var neu = art === 'kasten' ? einzug + '[] ' : art === 'punkt' ? einzug + '- ' : einzug;
  zeile.setAttribute('data-vor', neu);
  zeile.className = art === 'kasten' ? 'pm-k' : art === 'punkt' ? 'pm-p' : 'pm-t';
  if (art !== 'kasten' && zeile.removeAttribute) { zeile.removeAttribute('data-m'); }
}

function pmEdIstArt(zeile, art) {
  var vor = pmAttr(zeile, 'data-vor') || '';
  return art === 'kasten' ? /^\s*\[[ xX-]?\]\s*$/.test(vor) : /^\s*-\s*$/.test(vor);
}

/* Knöpfe B U S • ☐ */
function pmFormat(was) {
  var ed = document.getElementById('pmEditor');
  if (!ed) { return; }
  if (ed.focus) { ed.focus(); }
  var befehl = { fett: 'bold', unter: 'underline', durch: 'strikeThrough' }[was];
  if (befehl) {
    try { document.execCommand('styleWithCSS', false, false); } catch (e) { /* ältere Browser */ }
    document.execCommand(befehl, false, null);
    pmEdGetippt();
    return;
  }
  if (was !== 'punkt' && was !== 'kasten') { return; }
  var sel = window.getSelection ? window.getSelection() : null;
  if (!sel || !sel.rangeCount) { return; }
  var r = sel.getRangeAt(0);
  var von = pmEdZeileVon(r.startContainer);
  var bis = pmEdZeileVon(r.endContainer) || von;
  if (!von) {
    /* Text ohne Zeile (leerer Editor): erst eine Zeile daraus machen */
    document.execCommand('formatBlock', false, 'div');
    von = pmEdZeileVon(sel.getRangeAt(0).startContainer);
    bis = von;
    if (!von) { return; }
  }
  var zeilen = [];
  var n = von;
  while (n) { if (n.nodeType === 1) { zeilen.push(n); } if (n === bis) { break; } n = n.nextSibling; }
  var alle = zeilen.every(function (z) { return pmEdIstArt(z, was); });
  zeilen.forEach(function (z) { if (pmAttr(z, 'data-roh') === null) { pmEdArt(z, alle ? 'text' : was); } });
  pmEdGetippt();
}

/* Enter: neue Zeile derselben Art; auf leerer Kästchen-/Punktzeile endet die Liste.
   Rücktaste am Zeilenanfang: aus Kästchen/Punkt wird Text. */
function pmEdTaste(ev) {
  if (!ev) { return; }
  var sel = window.getSelection ? window.getSelection() : null;
  if (!sel || !sel.rangeCount) { return; }
  var r = sel.getRangeAt(0);
  var zeile = pmEdZeileVon(r.startContainer);
  if (ev.key === 'Enter' && !ev.shiftKey) {
    if (!zeile || pmAttr(zeile, 'data-roh') !== null) { return; }
    if (ev.preventDefault) { ev.preventDefault(); }
    var vor = pmAttr(zeile, 'data-vor') || '';
    var leer = !String(zeile.textContent || '').trim();
    if (leer && (pmEdIstArt(zeile, 'kasten') || pmEdIstArt(zeile, 'punkt') || /^\s*\d/.test(vor))) {
      pmEdArt(zeile, 'text');
      pmEdGetippt();
      return;
    }
    r.deleteContents();
    var rest = document.createRange();
    rest.setStart(r.startContainer, r.startOffset);
    rest.setEnd(zeile, zeile.childNodes.length);
    var teil = rest.extractContents();
    var neu = document.createElement('div');
    var nv = pmVorWeiter(vor);
    neu.className = /\[/.test(nv) ? 'pm-k' : /^\s*-/.test(nv) ? 'pm-p' : /^\s*\d/.test(nv) ? 'pm-n' : 'pm-t';
    if (nv) { neu.setAttribute('data-vor', nv); }
    neu.appendChild(teil);
    if (!String(neu.textContent || '')) { neu.innerHTML = '<br>'; }
    if (!String(zeile.textContent || '') && !zeile.querySelector('br')) { zeile.innerHTML = '<br>'; }
    zeile.parentNode.insertBefore(neu, zeile.nextSibling);
    var stelle = document.createRange();
    stelle.setStart(neu, 0);
    stelle.collapse(true);
    sel.removeAllRanges();
    sel.addRange(stelle);
    pmEdGetippt();
    return;
  }
  if (ev.key === 'Backspace' && r.collapsed && zeile && (pmEdIstArt(zeile, 'kasten') || pmEdIstArt(zeile, 'punkt'))) {
    var davor = document.createRange();
    davor.setStart(zeile, 0);
    davor.setEnd(r.startContainer, r.startOffset);
    if (!davor.toString()) {
      if (ev.preventDefault) { ev.preventDefault(); }
      pmEdArt(zeile, 'text');
      pmEdGetippt();
    }
  }
}

/* Einfügen nur als Text — keine fremden Formate */
function pmEdEinfuegen(ev) {
  var d = ev && ev.clipboardData;
  if (!d) { return; }
  if (ev.preventDefault) { ev.preventDefault(); }
  document.execCommand('insertText', false, String(d.getData('text/plain') || ''));
  pmEdGetippt();
}

function pmSchreibenUm() {
  var s = cl.memo.id ? kpSeiteFinden(cl.memo.id) : null;
  if (!s) { return; }
  /* Aus Projekt, Ziel oder Liste zum Schreiben geöffnet: „Fertig“ führt dorthin zurück */
  if (cl.memo.schreiben && (cl.memo.ausListe || cl.memo.ausProjekt || cl.memo.ausZiel)) { pmEdGetippt(); memoSchreibenUm(); return; }
  if (cl.memo.schreiben) {
    pmEdGetippt();
    cl.memo.schreiben = false;
    pmMarkenPruefen();
    zeichne();
    return;
  }
  cl.memo.schreiben = true;
  cl.pm.zeile = -1;
  zeichne();
  var ed = document.getElementById('pmEditor');
  if (ed && ed.focus) { ed.focus(); }
}

/* ---- Memo: Details (Titel, Kürzel, Kategorie, privat, Verbindungen) ---- */

function pmMemoDetails() {
  var s = cl.memo.id ? kpSeiteFinden(cl.memo.id) : null;
  if (!s) { return; }
  cl.pm.mf = { id: s.id, titel: s.titel, k: pmIstVorlage(s) ? 'V' : pmKuerzel(s), bereich: clKategorieVon(s), privat: !!(s.__satz && s.__satz.privat), ausgeblendet: pmIstAusgeblendet(s) };
  cl.aufklapp = 'pmmemo';
  aufklappNeu();
}

function pmMemoFensterLesen() {
  var f = cl.pm.mf;
  if (!f) { return null; }
  var t = document.getElementById('pmMTitel');
  if (t && typeof t.value === 'string') { f.titel = t.value; }
  katPrivatLesen('pmM', f);
  var a = document.getElementById('pmMAus');
  if (a && typeof a.checked === 'boolean') { f.ausgeblendet = a.checked; }
  return f;
}

function pmKuerzelWahl(k) {
  var f = pmMemoFensterLesen();
  if (!f || (PM_KUERZEL.indexOf(k) < 0 && k !== 'V')) { return; }
  f.k = k;
  aufklappNeu();
}

/* Aufgaben und Termine zum ganzen Memo */
function pmMemoAufgaben(id) {
  return (DB.aufgaben || []).filter(function (a) { return a && a.memo && a.memo.id === id && !a.memo.zeile; });
}

function pmMemoFensterHtml() {
  var f = cl.pm.mf;
  var s = f ? kpSeiteFinden(f.id) : null;
  if (!f || !s) { return ''; }
  if (f.modus === 'loeschen') {
    var zahl = pmMemoAufgaben(s.id).length + (DB.aufgaben || []).filter(function (a) { return a && a.memo && a.memo.id === s.id && a.memo.zeile; }).length;
    return '<div class="fenster"><div class="titel">Memo löschen</div><div class="rumpf">'
      + '<p>„' + esc(s.titel) + '“ löschen?</p>'
      + (zahl ? '<p class="leise">' + zahl + ' Aufgabe' + (zahl === 1 ? '' : 'n') + ' im To Do bleiben, ohne Verbindung.</p>' : '')
      + '<p class="leise">Das Memo verschwindet auch in der Workbench.</p>'
      + '<div class="knoepfe"><button type="button" class="knopf voll" onclick="pmMemoLoeschen()">Löschen</button>'
      + '<button type="button" class="knopf" onclick="aufklappZu()">Abbrechen</button></div></div></div>';
  }
  var h = '<div class="fenster"><div class="titel">Details</div><div class="rumpf">'
    + '<label for="pmMTitel">Titel:</label><input id="pmMTitel" class="eingabe" type="text" autocomplete="off" value="' + esc(f.titel) + '">'
    /* Seit 0.93: V = Vorlage — nicht in der Liste, nur unter „Vorlage…“ */
    + '<label>Kürzel:</label><div class="wahlreihe pm-kz">' + PM_KUERZEL.concat(['V']).map(function (k) {
      return '<button type="button"' + (f.k === k ? ' class="an"' : '') + (ckIstKorb(s) && k !== '–' ? ' disabled' : '') + ' onclick="pmKuerzelWahl(\'' + k + '\')">' + k + '</button>';
    }).join('') + '</div><p class="leise">T ToDo-Liste · A Ablauf · P Projekt · Z Ziel · – alles andere · V Vorlage</p>'
    + katPrivatHtml('pmM', f.bereich || '', f.privat)
    + '<label class="haken"><input id="pmMAus" type="checkbox"' + (f.ausgeblendet ? ' checked' : '') + '> ausblenden <small class="leise">(nicht in der Liste)</small></label>';
  var auf = pmMemoAufgaben(s.id);
  var ter = Array.isArray(s.__satz.termine) ? s.__satz.termine.filter(function (t) { return t && t.id; }) : [];
  if (auf.length || ter.length) {
    h += '<div class="pm-verb">'
      + auf.map(function (a) {
        return '<label>Aufgabe:</label><button type="button" class="verweis" onclick="aufklappZu();pmDetails(\'' + esc(a.id) + '\')">' + esc(pmTitel(a)) + (pmDatum(a) ? ' · ' + esc(pmDatumText(pmDatum(a))) : '') + '</button>';
      }).join('')
      + ter.map(function (t) {
        return '<label>Termin:</label><button type="button" class="verweis" onclick="pmTerminOeffnen(\'' + esc(t.datum || '') + '\',\'' + esc(t.id) + '\')">'
          + esc((pmIstDatum(t.datum) ? clWt(t.datum) + ' ' + clKurzDatum(t.datum) : 'Termin') + (t.von ? ' ' + clZeitText(t.von) : '') + (t.titel ? ' · ' + t.titel : '')) + '</button>';
      }).join('') + '</div>';
  }
  return h + '<div class="knoepfe"><button type="button" class="knopf voll" onclick="pmMemoSpeichern()">OK</button>'
    + '<button type="button" class="knopf" onclick="aufklappZu()">Abbrechen</button></div></div></div>';
}

function pmMemoSpeichern() {
  var f = pmMemoFensterLesen();
  var s = f ? kpSeiteFinden(f.id) : null;
  if (!s) { aufklappZu(); return; }
  var titel = String(f.titel || '').trim();
  if (!titel) { melde('Bitte einen Titel eingeben.', 'warn'); return; }
  s.titel = titel.slice(0, 200);
  katPrivatSchreiben(s.__satz, f);
  if (f.ausgeblendet) { s.__satz.ausgeblendet = true; } else { delete s.__satz.ausgeblendet; }
  s.geaendert = jetzt();
  var warVorlage = pmIstVorlage(s);
  var n = null;
  if (f.k === 'V') { pmVorlageSetzen(s, true); }
  else { pmVorlageSetzen(s, false); n = pmKuerzelSetzen(s, f.k); }
  if (f.k === 'V' && !warVorlage) { melde('„' + s.titel + '“ ist jetzt eine Vorlage — zu finden unter „Vorlage…“.', 'gut'); }
  spaeterSichern();
  cl.pm.mf = null;
  aufklappZu();
  if (n) { cl.memo.id = n.id; }
  zeichne();
}

/* Kürzel ändern: zwischen Notiz/Ablauf in „gedanken“ wechselt nur die Art;
   zu Projekt oder Ziel zieht der Satz um — mit derselben Kennung. */
/* Vorlage an/aus (seit 0.93: Kürzel V) — das Memo selbst, keine Kopie */
function pmVorlageSetzen(s, an) {
  var x = s && s.__satz;
  if (!x || ckIstKorb(s) || pmIstVorlage(s) === !!an) { return; }
  if (an) { x.istVorlage = true; }
  else {
    delete x.istVorlage;
    if (x.checkliste === 'vorlage') { x.checkliste = 'lauf'; }
  }
  x.geaendert = jetzt();
}

function pmKuerzelSetzen(s, k) {
  if (!s || PM_KUERZEL.indexOf(k) < 0) { return s; }
  var alt = pmKuerzel(s);
  if (alt === k) { return s; }
  /* Seit 0.80.1: auch eine alte Liste wird P, Z oder A (zieht um wie eine Notiz) — nur der Sammler nicht */
  if (ckIstKorb(s)) { melde('Der Sammler bleibt, wie er ist.', null); return s; }
  var x = s.__satz;
  if (s.art === 'notiz' && (k === 'A' || k === '–' || k === 'T')) {
    if (k === 'A') {
      if (!x.checkliste || x.checkliste === 'fertig') { x.checkliste = 'lauf'; x.gestartet = x.gestartet || isoDatum(); }
      x.art = 'aufgaben';
      delete x.todoListe;
    } else if (k === 'T') {
      if (x.art === 'aufgaben') { delete x.art; }
      x.todoListe = true;
    } else { delete x.art; delete x.todoListe; }
    x.geaendert = jetzt();
    return s;
  }
  var von = kpSammlungVon(s);
  var n = (k === 'P' || k === 'Z') ? kpSeiteAnlegen('vorhaben', s.titel, s.kontext || 'privat', k === 'Z' ? 'ziel' : '')
                                    : kpSeiteAnlegen('notiz', s.titel, s.kontext || 'privat', '');
  if (!n) { return s; }
  var ny = n.__satz;
  var ziel = kpSammlungVon(n);
  n.text = s.text;
  ['bereich', 'privat', 'termine', 'archiv', 'ordnung', 'zusatz', 'ausgeblendet'].forEach(function (f) { if (x[f] !== undefined) { ny[f] = x[f]; } else { delete ny[f]; } });
  if (k === 'A') { ny.checkliste = 'lauf'; ny.art = 'aufgaben'; ny.gestartet = isoDatum(); }
  if (k === 'T') { ny.todoListe = true; }
  if (k === '–' && x.checkliste) { ny.checkliste = (x.checkliste === 'fertig') ? 'fertig' : 'lauf'; }
  if (pmArchiviert(s)) { ny.archiv = true; }
  DB[von] = (DB[von] || []).filter(function (y) { return y !== x; });
  grabsteinSetzen(von, x.id);
  ny.id = x.id;
  grabsteinWeg(ziel, ny.id);
  ny.geaendert = jetzt();
  return kpSeiteFinden(ny.id);
}

/* ---- Kategorie eines offenen Memos (▼ oben rechts) ---- */

function pmMemoKatHtml() {
  var s = cl.memo.id ? kpSeiteFinden(cl.memo.id) : null;
  var an = s ? clKategorieVon(s) : '';
  return '<div class="aufklapp liste-aufklapp todo-wahl" style="top:49px;right:6px">'
    + [{ id: '', name: 'Nicht abgelegt' }].concat(kgAlle()).map(function (b) {
      return '<button type="button"' + (an === b.id ? ' class="an"' : '') + ' onclick="pmMemoKatSetzen(\'' + esc(b.id) + '\')">' + esc(b.name) + '</button>';
    }).join('') + '</div>';
}

function pmMemoKatSetzen(id) {
  var s = cl.memo.id ? kpSeiteFinden(cl.memo.id) : null;
  if (!s) { return; }
  katPrivatSchreiben(s.__satz, { bereich: id });
  s.geaendert = jetzt();
  spaeterSichern();
  cl.aufklapp = '';
  zeichne();
}

/* ▼ der Liste: Kategorie wählen (gilt in allen Apps) */
function pmMemoKat(f) {
  cl.memo.sicht = 'alles';
  try { window.localStorage.setItem(MEMO_SICHT_KEY, 'alles'); } catch (e) { /* nur für jetzt */ }
  if (cl.memo.art) { memoArtSetzen('alles'); }
  katSetzen(f);
}

/* ---- Archiv ---- */

function pmArchivUm(id) {
  var s = kpSeiteFinden(id || cl.pm.memoWahl);
  if (!s) { melde('Erst ein Memo antippen.', null); return; }
  var x = s.__satz;
  if (pmArchiviert(s)) {
    delete x.archiv;
    /* Seit 0.81: auch eine Liste kommt zurück ins Memo Pad */
    if (s.art === 'liste') { delete x.abgeschlossen; }
    if (s.art === 'vorhaben' && s.zustand === 'erledigt') { s.zustand = 'laeuft'; }
    if (x.checkliste === 'fertig') { x.checkliste = 'lauf'; delete x.abgeschlossen; }
    melde('„' + s.titel + '“ zurückgeholt.', 'gut');
  } else {
    x.archiv = true;
    melde('„' + s.titel + '“ archiviert.', null);
  }
  x.geaendert = jetzt();
  cl.pm.memoWahl = '';
  spaeterSichern();
  if (cl.memo.id === s.id) { cl.memo.id = ''; cl.memo.schreiben = false; }
  zeichne();
}

/* ---- Löschen ---- */

function pmMemoLoeschenFragen(id) {
  var s = kpSeiteFinden(id || cl.memo.id || cl.pm.memoWahl);
  if (!s) { melde('Erst ein Memo antippen.', null); return; }
  cl.pm.mf = { id: s.id, modus: 'loeschen' };
  cl.aufklapp = 'pmmemo';
  aufklappNeu();
}

function pmMemoLoeschen() {
  var s = cl.pm.mf ? kpSeiteFinden(cl.pm.mf.id) : null;
  if (!s) { aufklappZu(); return; }
  String(s.text || '').split('\n').forEach(function (z) {
    var a = kpAufgabe(z);
    if (a && a.text) { kpEintraegeFinden(s.id, a.text).forEach(function (f) { kpAusplanenKern(f.woche.id, f.eintrag.id); }); }
  });
  (DB.aufgaben || []).forEach(function (a) { if (a && a.memo && a.memo.id === s.id) { delete a.memo; a.geaendert = jetzt(); } });
  var von = kpSammlungVon(s);
  DB[von] = (DB[von] || []).filter(function (y) { return y !== s.__satz; });
  grabsteinSetzen(von, s.id);
  spaeterSichern();
  melde('„' + s.titel + '“ gelöscht.', null);
  cl.pm.mf = null;
  cl.pm.memoWahl = '';
  aufklappZu();
  pmMemoZuListe();
}

/* ---- Vorlagen ---- */

/* Kopie eines Memos — als Vorlage oder aus einer Vorlage; ohne Haken, ohne Marken */
function pmKopieren(s, titel, vorlage) {
  var k = pmKuerzel(s);
  var x = s.__satz || {};
  var n = (k === 'P' || k === 'Z') ? kpSeiteAnlegen('vorhaben', titel, s.kontext || 'privat', k === 'Z' ? 'ziel' : '')
                                    : kpSeiteAnlegen('notiz', titel, s.kontext || 'privat', '');
  if (!n) { return null; }
  var ny = n.__satz;
  n.text = memoTextLeer(pmOhneMarken(s.text));
  katPrivatSchreiben(ny, { bereich: x.bereich || '', privat: !!x.privat });
  if (k === 'A') { ny.art = 'aufgaben'; }
  if (k === 'A' || (s.art === 'notiz' && x.checkliste)) { ny.checkliste = vorlage ? 'vorlage' : 'lauf'; }
  if (vorlage) { ny.istVorlage = true; if (n.art === 'vorhaben') { n.zustand = 'ruht'; } }
  else {
    delete ny.istVorlage;
    if (n.art === 'vorhaben') { n.zustand = 'laeuft'; ny.start = isoDatum(); }
    if (ny.checkliste) { ny.vorlage = s.id; ny.gestartet = isoDatum(); }
  }
  ny.geaendert = jetzt();
  return n;
}

function pmAlsVorlage() {
  var s = cl.memo.id ? kpSeiteFinden(cl.memo.id) : null;
  if (!s || pmIstVorlage(s)) { melde('Erst ein Memo öffnen.', null); return; }
  var v = pmKopieren(s, s.titel, true);
  if (!v) { return; }
  spaeterSichern();
  melde('Als Vorlage „' + v.titel + '“ gespeichert.', 'gut');
}

function pmVorlageTipp(id) {
  cl.pm.vorlage = id;
  cl.aufklapp = 'pmvorlage';
  aufklappNeu();
}

function pmVorlageHtml() {
  var s = kpSeiteFinden(cl.pm.vorlage);
  if (!s) { return ''; }
  return '<div class="fenster"><div class="titel">Vorlage</div><div class="rumpf">'
    + '<p>' + pmKuerzel(s) + ' · „' + esc(s.titel) + '“</p>'
    + '<label for="pmVName">Titel des neuen Memos:</label><input id="pmVName" class="eingabe" type="text" autocomplete="off" value="' + esc(s.titel) + '">'
    + '<div class="knoepfe"><button type="button" class="knopf voll" onclick="pmVorlageStarten()">Neu daraus</button>'
    + '<button type="button" class="knopf" onclick="pmVorlageBearbeiten()">Bearbeiten</button>'
    + '<button type="button" class="knopf" onclick="aufklappZu()">Abbrechen</button></div></div></div>';
}

function pmVorlageStarten() {
  var s = kpSeiteFinden(cl.pm.vorlage);
  var el = document.getElementById('pmVName');
  var titel = (el && typeof el.value === 'string' && el.value.trim()) ? el.value.trim() : (s ? s.titel : '');
  if (!s) { aufklappZu(); return; }
  var n = pmKopieren(s, titel.slice(0, 200), false);
  cl.pm.vorlage = '';
  aufklappZu();
  if (!n) { return; }
  spaeterSichern();
  cl.memo.sicht = 'alles';
  melde('„' + n.titel + '“ aus der Vorlage angelegt.', 'gut');
  pmMemoOeffnen(n.id, '');
}

function pmVorlageBearbeiten() {
  var id = cl.pm.vorlage;
  cl.pm.vorlage = '';
  aufklappZu();
  pmMemoOeffnen(id, '');
}

/* ---- Memo → Aufgabe, Zeile → Aufgabe, Memo → Termin ---- */

function pmMemoAlsAufgabe() {
  var s = cl.memo.id ? kpSeiteFinden(cl.memo.id) : null;
  if (!s) { return; }
  pmNeu('', '');
  var f = cl.pm.fenster;
  f.titel = s.titel;
  f.bereich = clKategorieVon(s);
  f.privat = !!(s.__satz && s.__satz.privat);
  f.memo = { id: s.id, zeile: '' };
  aufklappNeu();
}

function pmZeileAlsAufgabe() {
  var s = cl.memo.id ? kpSeiteFinden(cl.memo.id) : null;
  /* Seit 0.91.1: beim Schreiben gilt die Zeile mit der Schreibmarke — das Schreiben endet dafür,
     sonst ginge die neue Marke beim nächsten Tippen wieder verloren */
  if (s && cl.memo.schreiben && !cl.memo.ausListe && !cl.memo.ausProjekt && !cl.memo.ausZiel) {
    var nrEd = pmEdZeileNr();
    pmSchreibenUm();
    cl.pm.zeile = nrEd;
  }
  var zeilen = s ? String(s.text || '').split('\n') : [];
  var nr = cl.pm.zeile;
  var z = (nr >= 0 && nr < zeilen.length) ? zeilen[nr] : '';
  var a = kpAufgabe(pmOhneMarke(z));
  if (!s || !a) { melde('Erst in eine Zeile mit Kästchen tippen (die Schreibmarke dorthin setzen), dann „Zeile → Aufgabe…“.', null); return; }
  var mid = pmMarke(z);
  if (mid && pmAufgabeZurMarke(mid)) { pmDetails(mid); return; }
  pmNeu('', '');
  var f = cl.pm.fenster;
  f.titel = clSchlicht(kpPrio(a.text).text);
  f.prio = kpPrio(a.text).p || 3;
  f.bereich = clKategorieVon(s);
  f.privat = !!(s.__satz && s.__satz.privat);
  f.memo = { id: s.id, zeile: 'neu' };
  f.memoZeile = { id: s.id, nr: nr, text: z };
  aufklappNeu();
}

/* Hängt die Marke an die Zeile — sie muss noch dieselbe sein */
function pmMarkeSetzen(seiteId, nr, text, a) {
  var s = kpSeiteFinden(seiteId);
  var zeilen = s ? String(s.text || '').split('\n') : [];
  var i = (zeilen[nr] === text) ? nr : zeilen.indexOf(text);
  if (!s || i < 0) { delete a.memo.zeile; return false; }
  zeilen[i] = pmOhneMarke(zeilen[i]).replace(/\s+$/, '') + ' ⟦' + a.id + '⟧';
  s.text = zeilen.join('\n');
  s.geaendert = jetzt();
  a.memo.zeile = a.id;
  var k = kpAufgabe(zeilen[i]);
  if (k && k.erledigt) { a.status = 'erledigt'; a.erledigtAm = isoDatum(); }
  return true;
}

/* Text fürs Termin-Notizfeld: ohne Zeichen, Kästchen als ☐/☑ */
function pmSchlichtText(text) {
  return pmOhneMarken(text).split('\n').map(function (z) {
    var k = z.match(KP_KASTEN);
    if (k) { return k[1] + ((k[2] === 'x' || k[2] === 'X') ? '☑ ' : '☐ ') + clSchlicht(k[3]); }
    return clSchlicht(z.replace(/^(\s*)#{1,3}\s+/, '$1').replace(/^(\s*)[-*]\s+/, '$1• '));
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function pmMemoAlsTermin() {
  var s = cl.memo.id ? kpSeiteFinden(cl.memo.id) : null;
  if (!s) { return; }
  if (!tokenGueltig()) { melde('Termine gehen nur mit Verbindung zu Google.', null); return; }
  terminNeu(isoDatum(), '');
  if (!cl.termin || cl.termin.modus !== 'neu') { return; }
  cl.pm.terminFuer = s.id;
  cl.termin.vorschlag.titel = s.titel;
  cl.termin.vorschlag.notiz = pmSchlichtText(s.text);
  clTerminFensterNeu();
}

/* Aus terminSpeichern: der neue Termin gehört zum Memo */
function pmTerminAngelegt(id, kalId, datum, titel, von) {
  var s = cl.pm.terminFuer ? kpSeiteFinden(cl.pm.terminFuer) : null;
  cl.pm.terminFuer = '';
  if (!s || !id) { return false; }
  var x = s.__satz;
  if (!Array.isArray(x.termine)) { x.termine = []; }
  x.termine.push({ id: id, kalId: kalId || '', datum: datum || '', titel: String(titel || '').slice(0, 120), von: von || '' });
  x.geaendert = jetzt();
  spaeterSichern();
  return true;
}

/* ---- Bestehenden Termin einem Memo zuordnen (seit 0.90) ----
   Nur eine Verknüpfung im Memo (termine[]) — wie bei „Als Termin…“; Google bleibt unverändert. */

/* Das Memo, mit dem der Termin verknüpft ist — oder null */
function pmMemoZuTermin(id) {
  if (!id) { return null; }
  return kpSeitenAlle().filter(function (s) {
    var l = s.__satz && Array.isArray(s.__satz.termine) ? s.__satz.termine : [];
    return l.some(function (x) { return x && x.id === id; });
  })[0] || null;
}

/* Zeile im Fenster „Termin“ */
function pmTerminMemoHtml(t) {
  if (!t || !t.id) { return ''; }
  var s = pmMemoZuTermin(t.id);
  return '<div class="feld"><b>Memo:</b><span class="pm-zeile">'
    + (s ? '<button type="button" class="verweis" onclick="pmMemoOeffnen(\'' + esc(s.id) + '\')">' + esc(s.titel) + '</button>'
         + '<button type="button" class="knopf" onclick="pmTerminLoesen()">Lösen</button>'
         : '<span>–</span><button type="button" class="knopf" onclick="pmTerminZuordnenAuf()">Zuordnen…</button>')
    + '</span></div>';
}

function pmTerminZuordnenAuf() {
  if (!cl.termin || !cl.termin.t) { return; }
  cl.pm.zuAlle = false;
  cl.pm.zuTermin = true;
  cl.aufklapp = 'pmzuordnen';
  aufklappNeu();
}

function pmTerminZuordnen(memoId) {
  var o = cl.termin;
  var t = o ? o.t : null;
  var s = kpSeiteFinden(memoId);
  if (!t || !t.id || !s) { pmZuordnenZurueck(); return; }
  /* Ein Termin gehört zu höchstens einem Memo */
  var alt = pmMemoZuTermin(t.id);
  if (alt) { alt.__satz.termine = alt.__satz.termine.filter(function (x) { return !x || x.id !== t.id; }); alt.__satz.geaendert = jetzt(); }
  var x = s.__satz;
  if (!Array.isArray(x.termine)) { x.termine = []; }
  x.termine.push({ id: t.id, kalId: t.kalId || '', datum: o.tag || '', titel: String(t.titel || '').slice(0, 120), von: t.zeit || '' });
  x.geaendert = jetzt();
  spaeterSichern();
  melde('Termin mit „' + s.titel + '“ verknüpft.', 'gut');
  pmZuordnenZurueck();
}

function pmTerminLoesen() {
  var t = cl.termin ? cl.termin.t : null;
  var s = t ? pmMemoZuTermin(t.id) : null;
  if (!s) { return; }
  s.__satz.termine = s.__satz.termine.filter(function (x) { return !x || x.id !== t.id; });
  s.__satz.geaendert = jetzt();
  spaeterSichern();
  aufklappNeu();
}

function pmTerminOeffnen(datum, id) {
  aufklappZu();
  if (!pmIstDatum(datum)) { return; }
  oeffne('kalender');
  clKalGehe(datum, 'tag');
  if (clTerminFinden(datum, id)) { terminZeigen(datum, id); }
}

/* ---------- Menü ≡ ---------- */

function pmMenueHtml() {
  var k = function (was, text) { return '<button type="button" onclick="menueWahl(\'' + was + '\')">' + text + '</button>'; };
  var h = '';
  if (cl.app === 'aufgaben') { h += k('pmShow', 'Show…'); }
  if (cl.app === 'memo' && !cl.memo.art && cl.memo.id) {
    var s = kpSeiteFinden(cl.memo.id);
    if (s) {
      h += k('pmDetails', 'Details…');
      if (!pmIstVorlage(s)) {
        h += k('pmAlsAufgabe', 'Als Aufgabe…') + k('pmAlsTermin', 'Als Termin…') + k('pmZeile', 'Zeile → Aufgabe…')
          + '<div class="trenn"></div>' + k('pmVorlage', 'Als Vorlage speichern')
          + k('pmArchiv', pmArchiviert(s) ? 'Zurückholen' : 'Archivieren');
      }
      h += k('pmLoeschen', 'Löschen…');
    }
  }
  if ((cl.app === 'aufgaben' || (cl.app === 'memo' && !cl.memo.art)) && !pmAn()) { h += '<div class="trenn"></div>' + k('pmUmstellen', 'Umstellen…'); }
  return h ? '<div class="trenn"></div>' + h : '';
}

function pmMenueWahl(was) {
  var f = {
    pmShow: pmShowAuf, pmDetails: pmMemoDetails, pmAlsAufgabe: pmMemoAlsAufgabe, pmAlsTermin: pmMemoAlsTermin,
    pmZeile: pmZeileAlsAufgabe, pmVorlage: pmAlsVorlage, pmUmstellen: pmUmstellenFragen,
    pmArchiv: function () { pmArchivUm(cl.memo.id); }, pmLoeschen: function () { pmMemoLoeschenFragen(cl.memo.id); }
  }[was];
  if (!f) { return false; }
  cl.aufklapp = '';
  aufklappZeichnen();
  f();
  return true;
}

/* ---------- Aufklappen ---------- */

function pmAufklapp(el) {
  var a = cl.aufklapp;
  if (a === 'pmaufgabe') {
    if (el.innerHTML.indexOf('pmTitel') >= 0) { return true; }
    el.innerHTML = pmFensterHtml();
    return true;
  }
  if (a === 'pmmemo') {
    if (el.innerHTML.indexOf('pmMTitel') >= 0) { return true; }
    el.innerHTML = pmMemoFensterHtml();
    return true;
  }
  if (a === 'pmshow') {
    if (el.innerHTML.indexOf('pmShowSort') >= 0) { return true; }
    el.innerHTML = pmShowHtml();
    return true;
  }
  if (a === 'pmdatum') { el.innerHTML = pmDatumWahlHtml(); return true; }
  if (a === 'pmmemokat') { el.innerHTML = pmMemoKatHtml(); return true; }
  if (a === 'pmvorlage') {
    if (el.innerHTML.indexOf('pmVName') >= 0) { return true; }
    el.innerHTML = pmVorlageHtml();
    return true;
  }
  if (a === 'pmumstellen') { el.innerHTML = pmUmstellenHtml(); return true; }
  if (a === 'pmzuordnen') { el.innerHTML = pmZuordnenHtml(); return true; }
  if (a === 'pmmshow') {
    if (el.innerHTML.indexOf('pmMsSpalte') >= 0) { return true; }
    el.innerHTML = pmMShowHtml();
    return true;
  }
  return false;
}

/* ---------- Umstellung ---------- */

/* Offene Kästchen-Zeilen einer Seite: { nr, a, mid } */
function pmOffeneZeilen(s) {
  var aus = [];
  String((s && s.text) || '').split('\n').forEach(function (z, nr) {
    var a = kpAufgabe(pmOhneMarke(z));
    /* voll: der Text mit Marke — so steht er im Tag, wenn die Workbench die Zeile einplant */
    if (a && a.text && !a.erledigt) { aus.push({ nr: nr, a: a, mid: pmMarke(z), voll: (kpAufgabe(z) || a).text }); }
  });
  return aus;
}

/* Der Tag eines Behälters: Tag = sein Datum, Woche = ihr Sonntag (nicht vor heute) */
function pmBehaelterTag(b) {
  if (b && pmIstDatum(b.datum)) { return b.datum; }
  if (b && pmIstDatum(b.montag)) {
    var so = tagePlus(b.montag, 6);
    return so < isoDatum() ? isoDatum() : so;
  }
  return '';
}

/* Eingeplant: das früheste Datum (mit Uhrzeit vom Tag) und alle Fundstellen */
function pmEingeplant(s, text) {
  var f = kpEintraegeFinden(s.id, text);
  var beste = null;
  f.forEach(function (x) {
    var d = pmBehaelterTag(x.woche);
    if (d && (!beste || d < beste.datum)) { beste = { datum: d, zeit: pmIstDatum(x.woche.datum) && pmIstZeit(x.eintrag.zeit) ? x.eintrag.zeit : '' }; }
  });
  return { datum: beste ? beste.datum : '', zeit: beste ? beste.zeit : '', fund: f };
}

function pmAusplanen(fund) {
  fund.forEach(function (x) { kpAusplanenKern(x.woche.id, x.eintrag.id); });
}

/* Zeilen aus einer Seite nehmen (von hinten, damit die Nummern stimmen) */
function pmZeilenWeg(s, nummern) {
  if (!nummern.length) { return; }
  var zeilen = String(s.text || '').split('\n');
  nummern.slice().sort(function (a, b) { return b - a; }).forEach(function (nr) { zeilen.splice(nr, 1); });
  s.text = zeilen.join('\n');
  s.geaendert = jetzt();
}

/* Eine Zeile einer Liste/des Sammlers wird Aufgabe */
function pmAusZeile(s, x, bereich, kontext) {
  var zu = ckZusatz(s, x.a.text);
  var p = kpPrio(x.a.text);
  var plan = pmEingeplant(s, x.a.text);
  var d = plan.datum || (pmIstDatum(zu.frist) ? zu.frist : '');
  pmAusplanen(plan.fund);
  return pmNeueAufgabe({ titel: p.text, prio: p.p || 3, bereich: bereich, kontext: kontext, privat: !!(zu.privat || (s.__satz && s.__satz.privat)),
                         datum: d, zeit: plan.datum ? plan.zeit : '', notiz: zu.notiz || '' });
}

/* Der Kern — echt=false zählt nur. Gibt die Zahlen zurück. */
function pmUmstellenKern(echt) {
  var n = { listen: 0, listenPunkte: 0, sammler: 0, memo: 0, frei: 0, archiv: 0 };
  kpSeitenAlle().forEach(function (s) {
    var x = s.__satz;
    if (!x) { return; }
    if (s.art === 'liste') {
      if (pmArchiviert(s) && !ckIstKorb(s)) { return; }
      var offen = pmOffeneZeilen(s).filter(function (z) { return !z.mid; });
      if (ckIstKorb(s)) {
        n.sammler += offen.length;
        if (echt && offen.length) {
          offen.forEach(function (z) { pmAusZeile(s, z, '', ''); });
          pmZeilenWeg(s, offen.map(function (z) { return z.nr; }));
        }
        return;
      }
      /* Seit 0.81: Listen bleiben Memos, wie sie sind — keine Kategorie, kein Archiv, ihre Punkte bleiben stehen.
         Wie in jedem Memo werden nur Punkte mit Tag zu verbundenen Aufgaben (unten). */
    }
    if (pmIstVorlage(s)) { return; }
    if (pmArchiviert(s)) { n.archiv++; return; }
    /* Memo: Zeilen mit Tag (eingeplant oder ⚑ Frist) werden verbundene Aufgaben */
    pmOffeneZeilen(s).forEach(function (z) {
      var plan = pmEingeplant(s, z.mid ? z.voll : z.a.text);
      if (z.mid) {
        var da = pmAufgabeZurMarke(z.mid);
        if (echt && da && plan.datum && !da.wiederholung) { da.planung = plan.datum; if (plan.zeit) { da.uhrzeit = plan.zeit; } da.geaendert = jetzt(); }
        if (plan.fund.length) { n.memo++; if (echt) { pmAusplanen(plan.fund); } }
        return;
      }
      var zu = ckZusatz(s, z.a.text);
      var d = plan.datum || (pmIstDatum(zu.frist) ? zu.frist : '');
      if (!d) { return; }
      n.memo++;
      if (!echt) { return; }
      var p = kpPrio(z.a.text);
      var a = pmNeueAufgabe({ titel: clSchlicht(p.text), prio: p.p || 3, bereich: clKategorieVon(s), kontext: s.kontext,
                              privat: !!(zu.privat || x.privat), datum: d, zeit: plan.datum ? plan.zeit : '', notiz: zu.notiz || '',
                              memo: { id: s.id, zeile: 'neu' } });
      pmAusplanen(plan.fund);
      var zeilen = String(s.text || '').split('\n');
      pmMarkeSetzen(s.id, z.nr, zeilen[z.nr], a);
    });
  });
  /* Freie Zeilen in Tag und Woche (ohne Quelle) */
  kpBehaelterAb().forEach(function (b) {
    var weg = [];
    String(b.text || '').split('\n').forEach(function (zeile, nr) {
      var a = kpAufgabe(zeile);
      if (!a || !a.text || a.erledigt) { return; }
      var e = kpWocheEintrag(b, a.text);
      if (e) { return; }
      n.frei++;
      if (!echt) { return; }
      var p = kpPrio(a.text);
      var roh = (b.eintraege || []).filter(function (y) { return y && y.text === a.text; })[0];
      pmNeueAufgabe({ titel: p.text, prio: p.p || 3, datum: pmBehaelterTag(b), zeit: (roh && pmIstDatum(b.datum) && pmIstZeit(roh.zeit)) ? roh.zeit : '' });
      weg.push(nr);
      if (roh) { b.eintraege = b.eintraege.filter(function (y) { return y !== roh; }); }
    });
    if (echt && weg.length) { pmZeilenWeg(b, weg); }
  });
  if (echt) { pmMarkenPruefen(); }
  return n;
}

/* Verbundene Zeilen: der Haken der Zeile gilt; fehlt die Zeile, bleibt nur das Memo */
/* Seit 0.90.1: Fehlt die Marke (etwa weil ein älterer Stand eines anderen Geräts das Memo überschrieben hat),
   sucht der CLIE die Kästchen-Zeile mit demselben Text und hängt die Marke wieder an. Gibt die Zeilennummer oder -1. */
function pmMarkeWiederfinden(s, a) {
  var gleich = function (x) { return String(x || '').replace(/\s+/g, ' ').trim(); };
  var titel = gleich(pmTitel(a));
  if (!s || !titel) { return -1; }
  var zeilen = String(s.text || '').split('\n');
  var i;
  for (i = 0; i < zeilen.length; i++) {
    if (pmMarke(zeilen[i])) { continue; }
    var k = zeilen[i].match(KP_KASTEN);
    if (!k) { continue; }
    var text = gleich(k[3]);
    if (text === titel || gleich(kpPrio(text).text) === titel) {
      zeilen[i] = zeilen[i].replace(/\s+$/, '') + ' ⟦' + a.id + '⟧';
      s.text = zeilen.join('\n');
      s.geaendert = jetzt();
      a.memo.zeile = a.id;
      a.geaendert = jetzt();
      return i;
    }
  }
  return -1;
}

function pmMarkenPruefen() {
  var n = 0;
  (DB.aufgaben || []).forEach(function (a) {
    if (!a || !a.memo) { return; }
    /* Früher verlorene Zeile (zeile fehlt ganz — „Als Aufgabe…“ hat zeile '' und bleibt so): neu suchen */
    if (a.memo.zeile === undefined) { if (pmMarkeWiederfinden(pmMemoVon(a), a) >= 0) { n++; } return; }
    if (!a.memo.zeile) { return; }
    var s = pmMemoVon(a);
    if (!s) { delete a.memo; a.geaendert = jetzt(); n++; return; }
    var nr = pmZeileMitMarke(s, a.memo.zeile);
    if (nr < 0) { nr = pmMarkeWiederfinden(s, a); }
    if (nr < 0) { delete a.memo.zeile; a.geaendert = jetzt(); n++; return; }
    var k = kpAufgabe(String(s.text || '').split('\n')[nr]);
    if (k && !a.wiederholung && k.erledigt !== (a.status === 'erledigt')) {
      a.status = k.erledigt ? 'erledigt' : 'offen';
      a.erledigtAm = k.erledigt ? (a.erledigtAm || isoDatum()) : null;
      a.geaendert = jetzt();
      n++;
    }
  });
  return n;
}

function pmUmstellenFragen() {
  cl.pm.umst = pmUmstellenKern(false);
  cl.aufklapp = 'pmumstellen';
  aufklappNeu();
}

function pmUmstellenHtml() {
  var n = cl.pm.umst;
  if (!n) { return ''; }
  return '<div class="fenster"><div class="titel">Umstellen</div><div class="rumpf">'
    + '<p>Wie am Palm: Aufgaben stehen im To Do, Text im Memo Pad.</p>'
    + '<p>Listen bleiben Memos, wie sie sind.<br>'
    + n.sammler + ' aus dem Sammler → Aufgaben<br>'
    + n.memo + ' Memo- und Listenzeile' + (n.memo === 1 ? '' : 'n') + ' mit Tag → Aufgaben, mit dem Memo verbunden<br>'
    + n.frei + ' freie Zeile' + (n.frei === 1 ? '' : 'n') + ' aus Tag und Woche → Aufgaben<br>'
    + n.archiv + ' Abgeschlossene stehen im Archiv</p>'
    + '<p class="leise">Vorher wird eine Sicherung der workbench.json bereitgestellt.</p>'
    + '<div class="knoepfe"><button type="button" class="knopf voll" onclick="pmUmstellen()">Sichern und umstellen</button>'
    + '<button type="button" class="knopf" onclick="aufklappZu()">Abbrechen</button></div></div></div>';
}

function pmUmstellen() {
  sicherungLaden();
  var n = pmUmstellenKern(true);
  if (!DB.einstellungen || typeof DB.einstellungen !== 'object') { DB.einstellungen = {}; }
  DB.einstellungen.palm = { seit: isoDatum(), version: APP_VERSION };
  DB.einstellungen.aktivitaetenUmgestellt = true;
  cl.pm.umst = null;
  spaeterSichern();
  aufklappZu();
  melde('Umgestellt: ' + (n.sammler + n.memo + n.frei) + ' Aufgaben.', 'gut');
  zeichne();
}

/* Nach Laden und Abgleich: was die Workbench noch auf die alte Art anlegt */
function pmNachpflegen() {
  if (!pmAn()) { return 0; }
  var n = pmUmstellenKern(true);
  var z = n.listenPunkte + n.sammler + n.memo + n.frei + n.listen + pmMarkenPruefen();
  if (z) { spaeterSichern(); }
  return z;
}
