/* ═══════════════════════════════════════════════════════════════════════
   AA_tests.js — Regressionstests TimeAssist
   Aufruf:  node AA_tests.js [pfad/timeassist.html]
   Schema:  console.log + ok/fail/warn, ERGEBNIS-Block am Ende.
   Neue Kategorien werden hinten vor dem ERGEBNIS-Block angehängt.
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const PFAD = process.argv[2] || 'timeassist.html';

let nOk = 0, nFail = 0, nWarn = 0;
function ok(t)   { console.log('  ok    ' + t); nOk++; }
function fail(t) { console.log('  FAIL  ' + t); nFail++; }
function warn(t) { console.log('  warn  ' + t); nWarn++; }
function kat(t)  { console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 60 - t.length))); }

if (!fs.existsSync(PFAD)) { console.log('Datei nicht gefunden: ' + PFAD); process.exit(1); }
const H = fs.readFileSync(PFAD, 'utf8');
const mS = H.match(/<script>\n'use strict';([\s\S]*)<\/script>/);
const JS = mS ? mS[1] : '';
const HTMLTEIL = H.replace(/<script>[\s\S]*?<\/script>/g, '');
/* Zeilenkommentare entfernen, aber nicht in Zeichenketten: 'PRODID:-//DE'
   ist kein Kommentar. Deshalb nur schneiden, wenn vor den beiden
   Schraegstrichen kein ungerades Anfuehrungszeichen offen steht.      */
const JSK = JS.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(function (z) {
  let inStr = null, esc = false;
  for (let i = 0; i < z.length; i++) {
    const c = z[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (inStr) { if (c === inStr) { inStr = null; } continue; }
    if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
    if (c === '/' && z[i + 1] === '/') { return z.slice(0, i); }
  }
  return z;
}).join('\n');

/* ═══ 1 · Strukturelle Integrität ═══════════════════════════════════════ */
kat('1 · Strukturelle Integrität');
{
  const auf = (HTMLTEIL.match(/<div\b/g) || []).length;
  const zu  = (HTMLTEIL.match(/<\/div>/g) || []).length;
  if (auf === zu) { ok('div-Balance ausgeglichen (' + auf + ')'); }
  else { fail('div-Balance verletzt: ' + auf + '/' + zu); }
  ['nav', 'section', 'html', 'body', 'style', 'script', 'table', 'thead', 'tbody']
    .forEach(function (t) {
      const a = (H.match(new RegExp('<' + t + '\\b', 'g')) || []).length;
      const z = (H.match(new RegExp('</' + t + '>', 'g')) || []).length;
      if (a === z) { ok('<' + t + '> ausgeglichen (' + a + ')'); }
      else { fail('<' + t + '> unausgeglichen: ' + a + '/' + z); }
    });
}

/* ═══ 2 · Keine Funktionsduplikate ══════════════════════════════════════ */
kat('2 · Funktionsduplikate');
{
  const namen = (JSK.match(/^function\s+(\w+)/gm) || [])
    .map(s => s.replace(/^function\s+/, ''));
  const dup = Array.from(new Set(namen.filter((n, i) => namen.indexOf(n) !== i)));
  if (!dup.length) { ok(namen.length + ' Funktionen, keine Duplikate'); }
  else { fail('Doppelt definiert: ' + dup.join(', ')); }
}

/* ═══ 3 · Undefinierte Aufrufe aus Ereignis-Attributen ══════════════════ */
kat('3 · Ereignis-Handler definiert');
{
  const def = new Set();
  (JSK.match(/function\s+(\w+)/g) || []).forEach(s => def.add(s.replace(/function\s+/, '')));
  (JSK.match(/(?:const|let)\s+(\w+)\s*=\s*(?:\w+\s*=>|function|\()/g) || [])
    .forEach(s => def.add(s.match(/(?:const|let)\s+(\w+)/)[1]));
  const eingebaut = new Set(['if', 'stopPropagation', 'preventDefault', 'parseInt', 'String']);
  const ziele = new Set();
  /* Nur freistehende Aufrufe zaehlen — document.getElementById(...) ist
     eine DOM-Methode, keine Funktion dieser Datei.                     */
  const sammle = t => (t.match(/(?:^|[^.\w])([A-Za-z_]\w*)\s*\(/g) || [])
    .forEach(s => ziele.add(s.replace(/^[^A-Za-z_]*/, '').replace(/\s*\($/, '')));
  (H.match(/on(?:click|keydown|blur|change)="([^"]*)"/g) || []).forEach(sammle);
  (JS.match(/on(?:click|keydown|blur|change)=\\?['"][^'"\\]*/g) || []).forEach(sammle);
  const fehlt = Array.from(ziele).filter(z => !def.has(z) && !eingebaut.has(z));
  if (!fehlt.length) { ok(ziele.size + ' Handler-Ziele, alle definiert'); }
  else { fail('Undefinierte Handler: ' + fehlt.join(', ')); }
}

/* ═══ 4 · Verbotene Muster ══════════════════════════════════════════════ */
kat('4 · Verbotene Muster');
{
  if (!/onclick="[^"]*\breturn\b[^"]*"/.test(HTMLTEIL)) { ok('kein return in Inline-Handlern'); }
  else { fail('onclick enthält return'); }
  if (!/\bheight:\s*100vh\b/.test(H)) { ok('kein height:100vh'); }
  else { fail('height:100vh gefunden'); }
  if (!/localStorage|sessionStorage/.test(JS)) { ok('kein localStorage/sessionStorage'); }
  else { fail('localStorage/sessionStorage gefunden — Speicher ist IndexedDB'); }
  const sel = (H.match(/^(\.[a-z][\w.-]*) \{/gm) || []).map(s => s.replace(' {', ''));
  const dupCss = Array.from(new Set(sel.filter((x, i) => sel.indexOf(x) !== i)));
  if (!dupCss.length) { ok(sel.length + ' CSS-Regeln, keine Doppelten'); }
  else { fail('Mehrfach definierte CSS-Regeln: ' + dupCss.join(', ')); }
}

/* ═══ 5 · Versionskonsistenz ════════════════════════════════════════════ */
kat('5 · Versionskonsistenz');
{
  const mT = H.match(/<title>([^<]*)<\/title>/);
  const mV = JS.match(/APP_VERSION\s*=\s*'([^']+)'/);
  if (!mT || !mV) { fail('Titel oder APP_VERSION fehlt'); }
  else {
    if (mT[1].indexOf(mV[1]) !== -1) { ok('Titel enthält APP_VERSION ' + mV[1]); }
    else { fail('Titel "' + mT[1] + '" passt nicht zu ' + mV[1]); }
    if (/bf-mitte'\)\.textContent\s*=.*APP_VERSION/.test(JS)) {
      ok('Anzeige im Blattfuß an APP_VERSION gekoppelt');
    } else { fail('Versionsanzeige nicht gekoppelt'); }
    /* Die Schemaversion darf nie hinter dem zurückliegen, was die
       Migration bereits kann — sonst läuft sie nicht an.            */
    const mSV = JS.match(/const DB_VERSION = (\d+)/);
    const stufen = (JS.match(/Version \d+ → (\d+):/g) || [])
      .map(x => parseInt(/→ (\d+)/.exec(x)[1], 10));
    const hoechste = stufen.length ? Math.max.apply(null, stufen) : 0;
    if (mSV && parseInt(mSV[1], 10) >= hoechste) {
      ok('DB_VERSION ' + mSV[1] + ' deckt alle ' + stufen.length + ' Migrationsstufen');
    } else {
      fail('DB_VERSION ' + (mSV ? mSV[1] : '?') + ' liegt hinter Stufe ' + hoechste);
    }
  }
}

/* ═══ 6 · Registerstruktur und Dispatcher ═══════════════════════════════ */
kat('6 · Registerstruktur');
{
  /* Planung ist in Monat und Jahr aufgeteilt — die Zeitebenen stehen
     jetzt als eigene Laschen beieinander.                            */
  const SOLL = ['tag', 'woche', 'monat', 'jahr', 'akt', 'plaene', 'ziele',
                'db', 'journal', 'info'];
  const mR = JS.match(/const REGISTER = \[([\s\S]*?)\n\];/);
  if (!mR) { fail('REGISTER nicht gefunden'); }
  else {
    const keys = (mR[1].match(/k:'(\w+)'/g) || []).map(s => s.match(/k:'(\w+)'/)[1]);
    const fehlt = SOLL.filter(s => keys.indexOf(s) === -1);
    if (!fehlt.length) { ok('alle ' + SOLL.length + ' Hauptregister vorhanden'); }
    else { fail('Register fehlen: ' + fehlt.join(', ')); }
    /* Die Zeitebenen gehören in der richtigen Folge beieinander */
    const zeit = ['tag', 'woche', 'monat', 'jahr'].map(x => keys.indexOf(x));
    if (zeit.every((v, i) => i === 0 || v === zeit[i - 1] + 1)) {
      ok('Tag, Woche, Monat, Jahr stehen in Folge');
    } else { fail('die Zeitebenen sind auseinandergerissen'); }
  }
  /* Fehlerart: 'uebersicht' ist bei Plänen wie Zielen derselbe Unterschlüssel.
     Verzweigt der Dispatcher darüber statt über reg, zeichnet er das falsche
     Blatt — genau der Fehler aus 0.19.0.                                    */
  const mD = JS.match(/function renderBlatt\(\) \{([\s\S]*?)\n\}/);
  if (!mD) { fail('renderBlatt nicht gefunden'); }
  else {
    const d = mD[1];
    const vorn = d.indexOf("reg === 'plaene'");
    const key = d.indexOf('const k = blattKey()');
    if (vorn !== -1 && key !== -1 && vorn < key) {
      ok('Pläne/Ziele werden vor blattKey über reg verzweigt');
    } else { fail('Dispatcher verzweigt Pläne/Ziele nicht vor blattKey'); }
    if (!/\n  blattPlaene\(\);\n\}/.test(JS)) { ok('kein stiller Rückfall am Dispatcher-Ende'); }
    else { fail('Dispatcher fällt still auf blattPlaene zurück'); }
  }
  /* akt, wied und gew laufen seit den Gruppen über reg === 'akt' */
  /* notiz und archiv laufen seit den Notizgruppen über reg === 'db' */
  /* monat und jahr laufen jetzt über reg, nicht über blattKey */
  const BL = ['tag', 'woche'];
  const ohne = BL.filter(b => JS.indexOf("k === '" + b + "'") === -1);
  /* Es gibt mehrere Stellen mit reg === 'akt' — gemeint ist die im
     Dispatcher.                                                       */
  const mDis = JSK.match(/function renderBlatt\(\) \{([\s\S]*?)\n\}/);
  const uA = mDis ? mDis[1].match(/if \(reg === 'akt'\) \{([\s\S]*?)\n  \}/) : null;
  if (uA && /blattWieder\(\)/.test(uA[1]) && /blattGewohnheit\(\)/.test(uA[1]) &&
      /blattAktivitaeten\(\)/.test(uA[1])) {
    ok('Aktivitäten-Zweig erreicht alle drei Blätter');
  } else { fail('Aktivitäten-Zweig unvollständig'); }
  const uD = mDis ? mDis[1].match(/if \(reg === 'db'\) \{([\s\S]*?)\n  \}/) : null;
  if (uD && /blattArchiv\(\)/.test(uD[1]) && /blattNotiz\(\)/.test(uD[1])) {
    ok('Datenbank-Zweig erreicht Notizen und Archiv');
  } else { fail('Datenbank-Zweig unvollständig'); }
  if (!ohne.length) { ok(BL.length + ' Blätter im Dispatcher erreichbar'); }
  else { fail('Kein Dispatcher-Zweig für: ' + ohne.join(', ')); }
}

/* ═══ 7 · Minimales Datenmodell ═════════════════════════════════════════ */
kat('7 · Datenmodell minimal');
{
  const mA = JS.match(/const SAAT_AKTIVITAETEN = \[([\s\S]*?)\n\];/);
  if (!mA) { fail('SAAT_AKTIVITAETEN nicht gefunden'); }
  else {
    const ERLAUBT = ['id', 't', 'b', 'prio', 'min', 'wer', 'beginn', 'ende', 'glyph',
                     'geplant', 'verschoben', 'archiviert', 'pos', 'planId', 'zielId'];
    const felder = Array.from(new Set((mA[1].match(/[{,]\s*(\w+):/g) || [])
      .map(s => s.replace(/[{,]\s*/, '').replace(':', ''))));
    const zuviel = felder.filter(f => ERLAUBT.indexOf(f) === -1);
    if (!zuviel.length) { ok('Aktivität hat nur erlaubte Felder (' + felder.length + ')'); }
    else { fail('Unerlaubte Felder in Aktivität: ' + zuviel.join(', ')); }
  }
  /* archiviert ist seit dem Übertrag ein eigenes Feld mit Datum und
     steht deshalb nicht mehr auf der Verbotsliste.                   */
  const VERBOTEN = ['erstellt', 'geaendert', 'status', 'tags', 'imFokus',
                    'groesse', 'ressourcen', 'horizont', 'sphaere'];
  const drin = VERBOTEN.filter(v => new RegExp('\\b' + v.replace(':', '') + ':').test(
    JS.slice(JS.indexOf('const SAAT_AKTIVITAETEN'), JS.indexOf('const SAAT_TERMINE'))));
  if (!drin.length) { ok('keine WorkAssist-Altfelder an der Aktivität'); }
  else { fail('Altfelder zurückgekehrt: ' + drin.join(', ')); }
  if (!/\bq:\s*'(outlook|google)'/.test(JS)) { ok('kein Terminimport-Quellenfeld'); }
  else { fail('Quellenfeld für Terminimport zurück'); }
  /* Der Import liest p.schritte aus dem WorkAssist-Quellformat — das ist
     erlaubt. Verboten ist das Feld nur am TimeAssist-Plan selbst.      */
  const iA = JSK.indexOf('function waUmwandeln');
  const iE = JSK.indexOf('let waErgebnis');
  const ohneImport = (iA !== -1 && iE > iA)
    ? JSK.slice(0, iA) + JSK.slice(iE)
    : JSK;
  /* Gesucht ist der Zugriff auf ein Planfeld (p.schritte, plan.schritte)
     oder dessen Deklaration — nicht der Zaehler b.schritte im Bericht. */
  if (!/\b(?:p|plan|x)\.schritte\b|schritte\s*:\s*\[/.test(ohneImport)) {
    ok('keine Plan-schritte[] am TimeAssist-Plan');
  }
  else { fail('Plan-schritte[] zurück — zweiter Mechanismus neben den Aktivitäten'); }
}

/* ═══ 8 · Hochformat-Geometrie ══════════════════════════════════════════ */
kat('8 · Hochformat-Geometrie');
{
  const mG = H.match(/\.geraet \{[^}]*width: (\d+)px; height: (\d+)px/);
  if (!mG) { fail('Geräterahmen-Maße nicht gefunden'); }
  else {
    const b = parseInt(mG[1], 10), ho = parseInt(mG[2], 10);
    if (b === 820 && ho === 1180) { ok('Rahmen 820 × 1180 (iPad Air hochkant)'); }
    else { fail('Rahmen ' + b + ' × ' + ho); }
    if (ho > b) { ok('Hochformat'); } else { fail('Querformat erkannt'); }
  }
  /* Fehlerart aus 0.22.0: visualViewport schrumpft bei offener Tastatur und
     rechnet den Maßstab auf etwa 60 % herunter.                            */
  const mSk = JSK.match(/function skaliere\(\) \{([\s\S]*?)\n\}/);
  if (!mSk) { fail('skaliere nicht gefunden'); }
  else if (/visualViewport/.test(mSk[1])) {
    fail('skaliere nutzt visualViewport — Tastatur verkleinert das Formular');
  } else { ok('Maßstab aus dem Layout-Viewport, tastaturfest'); }
}

/* ═══ 9 · Kalenderrechnung ══════════════════════════════════════════════ */
kat('9 · Kalenderrechnung');
{
  const mO = JS.match(/function ostersonntag\(jahr\) \{[\s\S]*?\n\}/);
  if (!mO) { fail('ostersonntag nicht gefunden'); }
  else {
    let ostern;
    try { ostern = eval('(' + mO[0].replace('function ostersonntag', 'function') + ')'); }
    catch (e) { ostern = null; }
    if (!ostern) { fail('ostersonntag nicht auswertbar'); }
    else {
      const SOLL = { 2024:'2024-03-31', 2025:'2025-04-20', 2026:'2026-04-05',
                     2027:'2027-03-28', 2028:'2028-04-16', 2030:'2030-04-21' };
      let f = 0;
      Object.keys(SOLL).forEach(function (j) {
        const d = new Date(ostern(parseInt(j, 10))).toISOString().slice(0, 10);
        if (d !== SOLL[j]) { f++; fail('Ostern ' + j + ': ' + d + ' statt ' + SOLL[j]); }
      });
      if (!f) { ok('Ostersonntag über sechs Jahre korrekt'); }
    }
  }
  const mF = JS.match(/const FERIEN_BAYERN = \[([\s\S]*?)\n\];/);
  if (!mF) { fail('FERIEN_BAYERN nicht gefunden'); }
  else {
    const paare = mF[1].match(/von:'(\d{4}-\d{2}-\d{2})', bis:'(\d{4}-\d{2}-\d{2})'/g) || [];
    let f = 0;
    paare.forEach(function (p) {
      const m = /von:'([^']+)', bis:'([^']+)'/.exec(p);
      if (m[2] < m[1]) { f++; fail('Ferien mit Ende vor Anfang: ' + p); }
    });
    if (!f) { ok(paare.length + ' Ferienzeiträume, alle plausibel'); }
  }
}

/* ═══ 10 · Datenschicht und Speicher (S1) ═══════════════════════════════
   Fehlerart: Bestände werden als const angelegt und lassen sich nach dem
   Laden aus dem Speicher nicht mehr ersetzen — die App zeigt dann ewig
   die Saat. Ebenso: eine Änderung ohne anschließendes Speichern.
   ═══════════════════════════════════════════════════════════════════════ */
kat('10 · Datenschicht und Speicher');
{
  const BESTAENDE = ['GRUPPEN', 'BEREICHE', 'AKTIVITAETEN', 'TERMINE', 'JAHRESTERMINE',
                     'WIEDER', 'GEWOHNHEIT', 'PLAENE', 'ZIELE', 'NOTIZEN',
                     'WOCHENBLAETTER', 'MONATSBLAETTER', 'KONTAKTE', 'TAGESBLAETTER'];
  const alsConst = BESTAENDE.filter(b => new RegExp('const ' + b + '\\s*=\\s*DB\\.').test(JS));
  if (!alsConst.length) { ok('alle Bestände als let — nach dem Laden ersetzbar'); }
  else { fail('Als const gebunden, nicht ersetzbar: ' + alsConst.join(', ')); }

  const mU = JS.match(/function dbUebernehmen\(neu\) \{([\s\S]*?)\n\}/);
  if (!mU) { fail('dbUebernehmen nicht gefunden'); }
  else {
    const fehlt = BESTAENDE.filter(b => mU[1].indexOf(b + ' ') === -1 &&
                                        mU[1].indexOf(b + '=') === -1);
    if (!fehlt.length) { ok('dbUebernehmen setzt alle ' + BESTAENDE.length + ' Aliase neu'); }
    else { fail('Alias nicht neu gesetzt: ' + fehlt.join(', ')); }
  }

  const mSaat = JS.match(/function saatDB\(\) \{([\s\S]*?)\n\}/);
  if (mSaat) {
    const fehlt = BESTAENDE.filter(function (b) {
      const k = { GRUPPEN:'gruppen', BEREICHE:'bereiche', AKTIVITAETEN:'aktivitaeten',
        TERMINE:'termine', JAHRESTERMINE:'jahrestermine', WIEDER:'wieder',
        GEWOHNHEIT:'gewohnheiten', PLAENE:'plaene', ZIELE:'ziele', NOTIZEN:'notizen',
        WOCHENBLAETTER:'wochenblaetter', MONATSBLAETTER:'monatsblaetter',
        KONTAKTE:'kontakte', TAGESBLAETTER:'tagesblaetter' }[b];
      return mSaat[1].indexOf(k + ':') === -1;
    });
    if (!fehlt.length) { ok('saatDB enthält alle Bestände'); }
    else { fail('saatDB unvollständig: ' + fehlt.join(', ')); }
  } else { fail('saatDB nicht gefunden'); }

  if (/function migriereDB/.test(JS)) { ok('migriereDB vorhanden'); }
  else { fail('migriereDB fehlt — fremde Stände könnten die App zerlegen'); }

  const mR = JS.match(/function renderAlles\(\) \{([\s\S]*?)\n\}/);
  if (mR && /speichern\(\)/.test(mR[1])) { ok('jede Neuzeichnung speichert'); }
  else { fail('renderAlles speichert nicht — Änderungen gehen verloren'); }

  ['spOeffnen', 'spLesen', 'spSchreiben', 'datenExport', 'datenImport']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  const mI = JS.match(/function datenImport\(ev\) \{([\s\S]*?)\n\}/);
  if (mI && /Array\.isArray\(neu\.aktivitaeten\)/.test(mI[1])) {
    ok('Import prüft den Inhalt, bevor er übernimmt');
  } else { fail('Import übernimmt ungeprüft — eine falsche Datei zerlegt den Bestand'); }

  if (/spLesen\(\)\.then/.test(JS)) { ok('Start lädt aus dem Speicher'); }
  else { fail('Start lädt nicht aus dem Speicher'); }
  if (/catch\(?\s*function \(e\) \{[\s\S]*?fluechtig/.test(JS) ||
      /spZustand = 'fluechtig'/.test(JS)) {
    ok('Speicherausfall wird abgefangen und angezeigt');
  } else { fail('Kein Rückfall bei Speicherausfall'); }
}

/* ═══ 11 · WorkAssist-Import (S7) ═══════════════════════════════════════
   Fehlerarten: erledigte Aufgaben werden mitgeschleppt; ein zweiter
   Dateiimport ersetzt statt hinzuzufügen; Wochentage werden nicht von
   Sonntag-Null auf Montag-Null gedreht; ein fehlender Wochentag wird zu
   sieben erfundenen Tagen.
   ═══════════════════════════════════════════════════════════════════════ */
kat('11 · WorkAssist-Import');
{
  ['istWorkAssist', 'waUmwandeln', 'waVorschau', 'waUebernehmen', 'waDatum']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  const mU = JSK.match(/function waUmwandeln\(d\) \{([\s\S]*?)\n\}/);
  if (!mU) { fail('waUmwandeln nicht auswertbar'); }
  else {
    const u = mU[1];
    if (/status === 'erledigt'/.test(u)) { ok('Erledigtes wird übersprungen'); }
    else { fail('Erledigte Aufgaben werden mitgeschleppt'); }
    if (/\(t \+ 6\) % 7/.test(u)) { ok('Wochentage von Sonntag-Null auf Montag-Null gedreht'); }
    else { fail('Wochentagsdrehung fehlt — Rhythmen landen falsch'); }
    if (/tage = \[0, 1, 2, 3, 4, 5, 6\]/.test(u.split('wieder.push')[0] || '')) {
      fail('Fehlender Wochentag wird zu sieben erfundenen Tagen');
    } else { ok('kein erfundener Wochenrhythmus bei leerer Angabe'); }
    if (/BEREICHE\.find\(x => x\.name === 'Ohne Bereich'\)/.test(u)) {
      ok('"Ohne Bereich" wird beim zweiten Import wiederverwendet');
    } else { fail('Zweiter Import erzeugt ein zweites "Ohne Bereich"'); }
    if (/hatKinder\[b\.id\]/.test(u)) { ok('Oberbereiche entfallen als Ebene'); }
    else { fail('Bereichshierarchie wird nicht abgeflacht'); }
    if (/zeitnah === true \? 'A' : 'B'/.test(JSK)) { ok('zeitnah → Priorität A'); }
    else { fail('Prioritätsabbildung fehlt'); }
  }

  const mUeb = JSK.match(/function waUebernehmen\(\) \{([\s\S]*?)\n\}/);
  if (!mUeb) { fail('waUebernehmen nicht auswertbar'); }
  else if (/\.push\(/.test(mUeb[1]) && !/dbUebernehmen/.test(mUeb[1])) {
    ok('Import fügt hinzu, statt zu ersetzen');
  } else { fail('Import ersetzt den Bestand — die zweite Datei löscht die erste'); }

  const mImp = JSK.match(/function datenImport\(ev\) \{([\s\S]*?)\n\}/);
  if (mImp && /istWorkAssist\(neu\)/.test(mImp[1])) {
    ok('Import erkennt das WorkAssist-Format');
  } else { fail('WorkAssist-Dateien werden nicht erkannt'); }
}

/* ═══ 12 · Löschen und leerer Bestand ═══════════════════════════════════
   Fehlerarten: Löschen ohne Rückfrage kostet den Bestand bei einem
   Fehlgriff; ein leerer Bestand bringt die App zum Absturz, weil
   BEREICHE[0] vorausgesetzt wird; leereDB hat eine andere Form als saatDB
   und lässt beim Übernehmen Felder fehlen.
   ═══════════════════════════════════════════════════════════════════════ */
kat('12 · Löschen und leerer Bestand');
{
  if (/function leereDB/.test(JS)) { ok('leereDB vorhanden'); }
  else { fail('leereDB fehlt'); }

  const mL = JSK.match(/function leereDB\(\) \{([\s\S]*?)\n\}/);
  const mS = JSK.match(/function saatDB\(\) \{([\s\S]*?)\n\}/);
  if (mL && mS) {
    const felder = t => (t.match(/(\w+):/g) || []).map(x => x.replace(':', '')).sort();
    const a = felder(mL[1]), b = felder(mS[1]);
    const fehlt = b.filter(x => a.indexOf(x) === -1);
    if (!fehlt.length) { ok('leereDB hat dieselbe Form wie saatDB'); }
    else { fail('leereDB fehlen Felder: ' + fehlt.join(', ')); }
  } else { fail('leereDB oder saatDB nicht auswertbar'); }

  /* In ersterBereichId selbst ist der Zugriff nach dem Anlegen sicher —
     nur ausserhalb waere er ungeschuetzt.                             */
  const iF = JSK.indexOf('function ersterBereichId');
  let ohneFallback = JSK;
  if (iF !== -1) {
    const iZ = JSK.indexOf('\n}', iF);
    ohneFallback = JSK.slice(0, iF) + JSK.slice(iZ);
  }
  if (!/BEREICHE\[0\]\.id/.test(ohneFallback)) {
    ok('kein ungeschützter Zugriff auf BEREICHE[0]');
  } else { fail('BEREICHE[0].id ohne Schutz — leerer Bestand stürzt ab'); }
  if (/function ersterBereichId/.test(JS)) { ok('ersterBereichId als Rückfall vorhanden'); }
  else { fail('ersterBereichId fehlt'); }

  const mD = JSK.match(/function datenLoeschenFragen\(\) \{([\s\S]*?)\n\}/);
  if (!mD) { fail('datenLoeschenFragen fehlt'); }
  else if (/if \(!loeschFrage\)/.test(mD[1]) && /dbUebernehmen\(leereDB\(\)\)/.test(mD[1])) {
    ok('Löschen erst nach Rückfrage');
  } else { fail('Löschen ohne zweistufige Rückfrage'); }
  if (/loeschFrage = false/.test(JSK.match(/function datenZu\(\)[^\n]*/)[0] || '')) {
    ok('Schließen bricht die Löschabfrage ab');
  } else { warn('Löschabfrage wird beim Schließen nicht zurückgesetzt'); }
}

/* ═══ 13 · Gruppen als Registerebene ════════════════════════════════════
   Fehlerarten: Gruppen fehlen in saatDB/leereDB und gehen beim Übernehmen
   verloren; die Migration lässt bestehende Bereiche ohne gruppeId und die
   App stolpert darüber; der Import wirft die Oberbereiche weg, statt sie
   zu Gruppen zu machen; das Löschen einer Gruppe reißt die Bereiche mit.
   ═══════════════════════════════════════════════════════════════════════ */
kat('13 · Gruppen als Registerebene');
{
  const mS = JSK.match(/function saatDB\(\) \{([\s\S]*?)\n\}/);
  const mL = JSK.match(/function leereDB\(\) \{([\s\S]*?)\n\}/);
  if (mS && /gruppen:/.test(mS[1])) { ok('saatDB kennt gruppen'); }
  else { fail('gruppen fehlt in saatDB'); }
  if (mL && /gruppen:/.test(mL[1])) { ok('leereDB kennt gruppen'); }
  else { fail('gruppen fehlt in leereDB'); }

  const mU = JSK.match(/function dbUebernehmen\(neu\) \{([\s\S]*?)\n\}/);
  if (mU && /GRUPPEN\s*=\s*DB\.gruppen/.test(mU[1])) { ok('dbUebernehmen setzt GRUPPEN'); }
  else { fail('GRUPPEN wird beim Übernehmen nicht neu gesetzt'); }

  const mM = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}/);
  if (mM && /gruppeId === undefined/.test(mM[1])) {
    ok('Migration ergänzt gruppeId an bestehenden Bereichen');
  } else { fail('Migration lässt Bereiche ohne gruppeId'); }
  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 2) { ok('Schemaversion auf ' + mV[1] + ' erhöht'); }
  else { fail('Schemaversion nicht erhöht — Migration greift nicht'); }

  const mUL = JSK.match(/if \(d\.unter === 'akt'\) \{([\s\S]*?)\n  \}/);
  if (mUL && /GRUPPEN\.forEach/.test(mUL[1]) && /'wied'/.test(mUL[1])) {
    ok('Aktivitäten-Register führt Gruppen plus Wiederkehrend und Gewohnheiten');
  } else { fail('Registerliste der Aktivitäten unvollständig'); }
  if (/reg !== 'plaene' && reg !== 'ziele' && reg !== 'akt'/.test(JSK)) {
    ok('Aktivitäten nutzen die innere Reiterspalte');
  } else { fail('Aktivitäten-Reiter nicht in der inneren Spalte'); }

  const mG = JSK.match(/function gruppeLoeschen\(id\) \{([\s\S]*?)\n\}/);
  if (mG && /b\.gruppeId = null/.test(mG[1])) {
    ok('Gruppe löschen lässt die Bereiche stehen');
  } else { fail('Gruppe löschen reißt Bereiche mit'); }

  const mW = JSK.match(/function waUmwandeln\(d\) \{([\s\S]*?)\n\}/);
  if (mW && /gruppeFuer/.test(mW[1])) { ok('Import macht Oberbereiche zu Gruppen'); }
  else { fail('Import verwirft die Oberbereichsebene'); }
  if (mW && /GRUPPEN\.concat\(gruppen\)\.find/.test(mW[1])) {
    ok('Gleichnamige Gruppen werden wiederverwendet');
  } else { fail('Zweiter Import erzeugt doppelte Gruppen'); }

  ['gruppenAuf', 'gruppeNeu', 'gruppeLoeschen', 'bereichGruppe', 'gruppenRender']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });
}

/* ═══ 14 · Feste Maße in Tabellenzellen ═════════════════════════════════
   Fehlerart, zweimal aufgetreten: ein Element bekommt seine Breite nur
   über flex-basis. In einer Tabellenzelle greift die Flex-Angabe nicht,
   und das Element fällt auf null Breite zusammen — beim Kästchen wurde
   daraus ein Strich, beim Bereichspunkt verschwand er ganz.
   ═══════════════════════════════════════════════════════════════════════ */
kat('14 · Feste Maße in Tabellenzellen');
{
  const css = H.slice(H.indexOf('<style>'), H.indexOf('</style>'));
  /* Klassen, die im Code in einer Tabellenzelle landen */
  const inZelle = [];
  (JS.match(/<td[^>]*>[^']*?class="([\w -]+)"/g) || []).forEach(function (t) {
    const m = /class="([\w -]+)"/.exec(t);
    if (m) { m[1].split(/\s+/).forEach(k => { if (k) { inZelle.push(k); } }); }
  });
  ['tz-punkt', 'hak'].forEach(k => { if (inZelle.indexOf(k) === -1) { inZelle.push(k); } });

  let f = 0, g = 0;
  Array.from(new Set(inZelle)).forEach(function (k) {
    const m = new RegExp('^\\.' + k + ' \\{([^}]*)\\}', 'm').exec(css);
    if (!m) { return; }
    const d = m[1];
    if (/flex:\s*0 0 \d+px/.test(d) && !/width:\s*\d/.test(d)) {
      f++; fail('.' + k + ' hat nur flex-basis, keine width — fällt in der Zelle zusammen');
    } else if (/flex:\s*0 0 \d+px/.test(d)) { g++; }
  });
  if (!f) { ok(g + ' Zellenelemente mit fester Breite, keines nur mit flex-basis'); }
}

/* ═══ 15 · Datumslogik (S2) ═════════════════════════════════════════════
   Fehlerarten: Wochentagsziffern statt Datum — ein log{0..6} überschreibt
   sich jede Woche selbst, ein Termin mit tag:2 liegt in jeder Woche am
   Mittwoch, und eine Aktivität mit heute:true bleibt ewig auf heute.
   Ebenso: fest verdrahtete Beispieldaten wie der 19. August 2026.
   ═══════════════════════════════════════════════════════════════════════ */
kat('15 · Datumslogik');
{
  ['isoHeute', 'isoPlus', 'isoWt', 'isoMontag', 'tagBlatt', 'tagBlaettern', 'tagHeute']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  if (!/HEUTE_ISO|HEUTE_WT|HEUTE_DMY/.test(JSK)) { ok('keine fest verdrahtete Gegenwart'); }
  else { fail('HEUTE_-Konstanten noch vorhanden'); }
  if (!/=== 19\)|t === 19/.test(JSK)) { ok('kein fest verdrahteter Tag 19'); }
  else { fail('Tag 19 noch fest verdrahtet'); }
  if (!/tag:\s*isoWt|tag:\s*[0-6]\s*,/.test(JSK.slice(JSK.indexOf('function terminNeu'),
      JSK.indexOf('function terminOeffnen')))) {
    ok('neue Termine bekommen ein Datum, keine Wochentagsziffer');
  } else { fail('Termin wird mit Wochentagsziffer angelegt'); }

  const mSt = JSK.match(/function streifen\([\s\S]*?\n\}/);
  if (mSt && /isoMontag\(tagOffen\)/.test(mSt[0]) && /obj\.log\[iso\]/.test(mSt[0])) {
    ok('Wochenstreifen schreibt in Datumsschlüssel');
  } else { fail('Wochenstreifen schreibt in Wochentagsziffern — überschreibt sich wöchentlich'); }

  const mM = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}/);
  if (mM) {
    const m = mM[1];
    let f = 0;
    if (!/t\.datum = isoPlus/.test(m)) { f++; fail('Migration wandelt Termin-Wochentage nicht um'); }
    if (!/\/\^\\d\$\//.test(m)) { f++; fail('Migration wandelt log-Wochentage nicht um'); }
    if (!/a\.geplant =/.test(m)) { f++; fail('Migration wandelt heute nicht in geplant um'); }
    if (!f) { ok('Migration wandelt Termine, log und heute um'); }
  } else { fail('migriereDB nicht auswertbar'); }
  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 3) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht auf 3 erhöht'); }

  if (/geplant === tagOffen/.test(JSK)) { ok('Tagesliste filtert über das Datum'); }
  else { fail('Tagesliste filtert nicht über geplant'); }
}

/* ═══ 16 · Wochen- und Monatsblatt am Datum (S3) ════════════════════════
   Fehlerarten: ein Monatseintrag am 31. Februar wird angenommen, obwohl
   die Zeile nicht existiert; man kommt vom Wochen- oder Monatsblatt nicht
   auf den Tag; ohne Heute-Knopf verliert man sich beim Blättern.
   ═══════════════════════════════════════════════════════════════════════ */
kat('16 · Wochen- und Monatsblatt am Datum');
{
  ['tagSpringen', 'wocheHeute', 'monatHeute']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  const mW = JSK.match(/function blattWoche\(\) \{([\s\S]*?)\n\}/);
  if (!mW) { fail('blattWoche nicht auswertbar'); }
  else {
    const w = mW[1];
    if (/tagSpringen/.test(w)) { ok('Wochenblatt führt auf das Tagesblatt'); }
    else { fail('kein Weg vom Wochenblatt zum Tag'); }
    if (/feiertagAn\(iso\)/.test(w) && /ferienAn\(iso\)/.test(w)) {
      ok('Wochenblatt zeigt Feiertage und Ferien');
    } else { fail('Wochenblatt ohne Feiertage/Ferien'); }
    if (/JAHRESTERMINE\.filter/.test(w)) { ok('mehrtägige Jahrestermine laufen durch die Woche'); }
    else { fail('Jahrestermine fehlen im Wochenblatt'); }
    if (/isoMontag\(isoHeute\(\)\)/.test(w)) { ok('Wochenblatt erkennt die laufende Woche'); }
    else { fail('laufende Woche wird nicht erkannt'); }
  }

  const mM = JSK.match(/function blattMonat\(\) \{([\s\S]*?)\n\}/);
  if (mM && /tagSpringen/.test(mM[1])) { ok('Monatsblatt führt auf das Tagesblatt'); }
  else { fail('kein Weg vom Monatsblatt zum Tag'); }
  if (mM && /monatZurWoche/.test(mM[1])) { ok('Monatsblatt führt auf das Wochenblatt'); }
  else { fail('kein Weg vom Monatsblatt zur Woche'); }

  const mR = JSK.match(/function eintragRender\(\) \{([\s\S]*?)\n\}/);
  if (mR && /isoPlus\(mo, d\)/.test(mR[1])) { ok('Wochentagsknöpfe zeigen das Datum'); }
  else { fail('Wochentagsknöpfe ohne Datum'); }
}

/* ═══ 17 · Bearbeitbarkeit und Datumsprüfung (S4) ═══════════════════════
   Fehlerarten: ein Plan- oder Zieltitel lässt sich nirgends ändern, weil
   er nur im Blattkopf steht; ein Bereich lässt sich nur bei Aktivitäten
   umhängen; ein Datumsfeld nimmt "31.02.2026" an und der Balken landet
   im Nichts.
   ═══════════════════════════════════════════════════════════════════════ */
kat('17 · Bearbeitbarkeit und Datumsprüfung');
{
  ['dmyZuIso', 'istDatum', 'bereichWahl', 'planZielWahl', 'planZielSetzen']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  /* Die Umwandlung muss echte Kalendertage prüfen, nicht nur die Form */
  const mD = JSK.match(/function dmyZuIso\(t\) \{[\s\S]*?\n\}/);
  if (mD) {
    let fn = null;
    try { fn = eval('(' + mD[0].replace('function dmyZuIso', 'function') + ')'); }
    catch (e) { fn = null; }
    if (!fn) { fail('dmyZuIso nicht auswertbar'); }
    else {
      const FAELLE = [['17.08.2026', '2026-08-17'], ['1.9.2026', '2026-09-01'],
                      ['29.02.2028', '2028-02-29'], ['29.02.2027', null],
                      ['31.02.2026', null], ['32.01.2026', null],
                      ['17.13.2026', null], ['', null], ['2026-08-17', null]];
      let f = 0;
      FAELLE.forEach(function (x) {
        const r = fn(x[0]);
        if (r !== x[1]) { f++; fail('dmyZuIso("' + x[0] + '") = ' + r + ' statt ' + x[1]); }
      });
      if (!f) { ok(FAELLE.length + ' Datumsfälle korrekt, Schaltjahr geprüft'); }
    }
  } else { fail('dmyZuIso nicht gefunden'); }

  const mP = JSK.match(/function blattPlan\(pid\) \{([\s\S]*?)\n\}/);
  if (!mP) { fail('blattPlan nicht auswertbar'); }
  else {
    if (/planFeld\('? ?\+? ?p\.id[^)]*'titel'|'titel'\)/.test(mP[1])) {
      ok('Plantitel ist bearbeitbar');
    } else { fail('Plantitel lässt sich nicht ändern'); }
    if (/bereichWahl\(\\'plan\\'/.test(mP[1])) { ok('Planbereich ist wählbar'); }
    else { fail('Planbereich lässt sich nicht umhängen'); }
    if (/planZielWahl/.test(mP[1])) { ok('Ziel eines Plans ist wählbar'); }
    else { fail('Ziel eines Plans lässt sich nicht setzen'); }
    if (/zieldatum/.test(mP[1])) { ok('Zieldatum ist am Blatt bearbeitbar'); }
    else { fail('Zieldatum nur in der Übersicht sichtbar'); }
  }

  const mZ = JSK.match(/function blattZiel\(zid\) \{([\s\S]*?)\n\}/);
  if (!mZ) { fail('blattZiel nicht auswertbar'); }
  else {
    if (/zielFeld\(.*'titel'\)|'titel'\)/.test(mZ[1])) { ok('Zieltitel ist bearbeitbar'); }
    else { fail('Zieltitel lässt sich nicht ändern'); }
    /* Ein Ziel hängt an der Sphäre, nicht am Bereich */
    if (/sphWahl\(/.test(mZ[1])) { ok('Sphäre des Ziels ist wählbar'); }
    else { fail('Sphäre des Ziels lässt sich nicht umhängen'); }
  }

  const mS = JSK.match(/function zielSchreiben\(\) \{([\s\S]*?)\n\}/);
  if (mS && /dmyZuIso\(v\)/.test(mS[1])) { ok('Zieldaten werden geprüft'); }
  else { fail('Zieldaten werden ungeprüft übernommen'); }
  const mPS = JSK.match(/function planSchreiben\(\) \{([\s\S]*?)\n\}/);
  if (mPS && /dmyZuIso\(v\)/.test(mPS[1])) { ok('Zieldatum des Plans wird geprüft'); }
  else { fail('Zieldatum des Plans wird ungeprüft übernommen'); }

  const mJ = JSK.match(/function jtSpeichern\(\) \{([\s\S]*?)\n\}/);
  if (mJ && /dmyZuIso/.test(mJ[1]) && /bis < von/.test(mJ[1])) {
    ok('Jahrestermin prüft Datum und dreht vertauschte Grenzen');
  } else { fail('Jahrestermin-Datum ungeprüft'); }
}

/* ═══ 18 · Weiterziehen und Planungsstand ═══════════════════════════════
   Fehlerarten: ein weitergezogener Vorgang verschwindet spurlos vom alten
   Blatt; er lässt sich in die Vergangenheit schieben; ein liegen-
   gebliebener Vorgang sieht in der Checkliste aus wie jeder andere offene.
   ═══════════════════════════════════════════════════════════════════════ */
kat('18 · Weiterziehen und Planungsstand');
{
  ['zugAuf', 'zugSetzen', 'zugFruehestens', 'zugFrei', 'planStandZelle']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  const mG = JSK.match(/function glyphWeiter\(id\) \{([\s\S]*?)\n\}/);
  if (mG && /naechst === '>' && a\.geplant/.test(mG[1]) && /zugAuf\(id\)/.test(mG[1])) {
    ok('› öffnet die Datumsauswahl statt still zu schalten');
  } else { fail('› setzt den Zustand ohne nach dem neuen Tag zu fragen'); }

  const mF = JSK.match(/function zugFruehestens\(\) \{([\s\S]*?)\n\}/);
  if (mF) {
    let fn = null;
    try {
      fn = eval('(function (tagOffen, isoHeute, isoPlus) { return ' +
        mF[0].replace('function zugFruehestens', 'function') + '; })')
        .call(null);
    } catch (e) { fn = null; }
    if (/isoPlus\(tagOffen, 1\)/.test(mF[1]) && /nachBlatt > h/.test(mF[1])) {
      ok('frühestens Blatt+1, bei alten Blättern frühestens heute');
    } else { fail('Untergrenze des Weiterziehens falsch'); }
  } else { fail('zugFruehestens nicht auswertbar'); }

  const mS = JSK.match(/function zugSetzen\(iso\) \{([\s\S]*?)\n\}/);
  if (mS && /a\.verschoben\.push\(a\.geplant\)/.test(mS[1])) {
    ok('das alte Datum wird als Spur gemerkt');
  } else { fail('Verschiebung hinterlässt keine Spur'); }
  const mFr = JSK.match(/function zugFrei\(\) \{([\s\S]*?)\n\}/);
  if (mFr && /iso < zugFruehestens\(\)/.test(mFr[1])) {
    ok('freie Eingabe wird gegen die Untergrenze geprüft');
  } else { fail('freie Datumseingabe erlaubt Rückdatierung'); }

  const mT = JSK.match(/function blattTag\(\) \{([\s\S]*?)\n\}/);
  if (mT && /verschoben\.indexOf\(tagOffen\)/.test(mT[1])) {
    ok('altes Tagesblatt zeigt das Weggezogene weiterhin');
  } else { fail('weggezogene Vorgänge verschwinden vom alten Blatt'); }

  const mP = JSK.match(/function planStandZelle\(a\) \{([\s\S]*?)\n\}/);
  if (mP && /a\.geplant < h/.test(mP[1]) && /rueck/.test(mP[1])) {
    ok('liegengebliebene Vorgänge sind in der Checkliste gekennzeichnet');
  } else { fail('kein Hinweis auf liegengebliebene Vorgänge'); }

  const mM = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}/);
  if (mM && /Array\.isArray\(a\.verschoben\)/.test(mM[1])) {
    ok('Migration ergänzt die Verschiebungsspur');
  } else { fail('Migration ergänzt verschoben nicht'); }
  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 4) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 19 · Datenbank und Notizen (S5) ══════════════════════════════════
   Fehlerarten: der Notizinhalt geht beim Import verloren und es bleiben
   leere Überschriften; ein Blatt lässt sich nicht anlegen oder ändern;
   die Registernummer wird doppelt vergeben.
   ═══════════════════════════════════════════════════════════════════════ */
kat('19 · Datenbank und Notizen');
{
  ['notizNeu', 'notizAuf', 'notizZurueck', 'notizLoeschen', 'notizFeld',
   'notizSchreiben', 'blattNotizBlatt', 'notizBereich']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  /* Registernummer: der Höchstwert plus eins, nicht die Anzahl —
     sonst entstehen nach dem Löschen Dubletten.                      */
  const mN = JSK.match(/function notizNr\(\) \{([\s\S]*?)\n\}/);
  if (mN && /n\.nr > m/.test(mN[1])) { ok('Registernummer aus dem Höchstwert'); }
  else { fail('Registernummer aus der Anzahl — nach dem Löschen doppelt'); }

  const mB = JSK.match(/function blattNotizBlatt\(id\) \{([\s\S]*?)\n\}/);
  if (!mB) { fail('blattNotizBlatt nicht auswertbar'); }
  else {
    ['t', 'datum', 'quelle', 'text'].forEach(function (f) {
      if (new RegExp("notizFeld\\(' \\+ n\\.id \\+ ',\\\\'" + f + "\\\\'\\)").test(mB[1])) {
        ok('Notizfeld ' + f + ' ist bearbeitbar');
      } else { fail('Notizfeld ' + f + ' lässt sich nicht ändern'); }
    });
    if (/notizBereich/.test(mB[1])) { ok('Bereich des Blattes ist wählbar'); }
    else { fail('Bereich des Blattes lässt sich nicht ändern'); }
  }

  const mW = JSK.match(/function waUmwandeln\(d\) \{([\s\S]*?)\n\}/);
  if (mW && /n\.inhalt \|\| ''/.test(mW[1])) { ok('Import übernimmt den Notizinhalt'); }
  else { fail('Notizinhalt geht beim Import verloren'); }
  if (mW && /dok\.link/.test(mW[1])) { ok('Import übernimmt den Dokumentlink'); }
  else { fail('Dokumentlink geht beim Import verloren'); }

  const mS = JSK.match(/function notizSchreiben\(\) \{([\s\S]*?)\n\}/);
  if (mS && /dmyZuIso\(v\)/.test(mS[1])) { ok('Notizdatum wird geprüft'); }
  else { fail('Notizdatum ungeprüft'); }

  const mM = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}/);
  if (mM && /n\.text === undefined/.test(mM[1])) { ok('Migration ergänzt den Notiztext'); }
  else { fail('Migration ergänzt text nicht'); }
  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 5) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 20 · Blatt an Move (S6) ═══════════════════════════════════════════
   Fehlerarten: das PDF bekommt A4 statt Movemaß; fehlender PDF-Baustein
   führt zum stillen Absturz statt zu einer Meldung; der Knopf steht auf
   Blättern, die gar nicht exportiert werden; Text läuft über den Rand.
   ═══════════════════════════════════════════════════════════════════════ */
kat('20 · Blatt an Move');
{
  ['moveTagPdf', 'moveErzeugen', 'pdfVerfuegbar']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  const mMV = JS.match(/const MV = \{ b:([\d.]+), h:([\d.]+), rand:([\d.]+) \}/);
  if (mMV && mMV[1] === '82.6' && mMV[2] === '132.2') {
    ok('Blattmaß 82,6 × 132,2 mm (reMarkable Paper Pro Move)');
  } else { fail('Blattmaß stimmt nicht'); }

  const mP = JSK.match(/function moveTagPdf\(\) \{([\s\S]*?)\n\}\n/);
  if (!mP) { fail('moveTagPdf nicht auswertbar'); }
  else {
    const t = mP[1];
    if (/if \(!pdfVerfuegbar\(\)\)/.test(t)) { ok('fehlender PDF-Baustein wird abgefangen'); }
    else { fail('kein Rückfall ohne PDF-Baustein'); }
    if (/format:\[MV\.b, MV\.h\]/.test(t)) { ok('Seitenformat aus dem Movemaß'); }
    else { fail('Seitenformat nicht aus MV'); }
    if (/doc\.addPage\(\[MV\.b, MV\.h\]/.test(t)) { ok('Folgeseiten im selben Maß'); }
    else { fail('Folgeseiten fehlen oder haben ein anderes Maß'); }
    if (/const kurz = function/.test(t) && /getTextWidth/.test(t)) {
      ok('Text wird auf die Blattbreite gekürzt');
    } else { fail('Text kann über den Rand laufen'); }
    const seiten = (t.match(/doc\.addPage\(/g) || []).length + 1;
    if (seiten === 3) { ok('drei Seiten: Plan, Rückfragen, Notizen'); }
    else { fail('Seitenzahl ist ' + seiten + ', erwartet 3'); }
    if (/'1 \/ 3'/.test(t) && /'2 \/ 3'/.test(t) && /'3 \/ 3'/.test(t)) {
      ok('Seitenzahlen im Fuß stimmen');
    } else { fail('Seitenzahlen im Fuß fehlen oder falsch'); }
    /* Die Schreiblinie gehoert unter das eigene Kaestchen. Lag sie eine
       halbe Zeile tiefer, durchkreuzte sie das folgende.              */
    if (/doc\.line\(L \+ 4\.6, y \+ 1\.4, R, y \+ 1\.4\);\n    y \+= 5\.8;/.test(t)) {
      ok('Schreiblinie liegt unter dem eigenen Kästchen');
    } else { fail('Schreiblinie sitzt falsch — sie durchkreuzt das nächste Kästchen'); }
    if (/while \(y < fussY\)/.test(t)) { ok('Aktivitäten haben freie Zeilen bis ans Blattende'); }
    else { fail('keine freien Zeilen bei den Aktivitäten'); }
    if (/const rZeilen = 3;/.test(t)) { ok('Reflexion auf drei Zeilen'); }
    else { fail('Reflexion nicht auf drei Zeilen'); }
  }

  /* Der Knopf gehört nur auf das Tagesblatt */
  if (/km\.style\.display = \(reg === 'tag'\)/.test(JSK)) {
    ok('Move-Knopf nur auf dem Tagesblatt');
  } else { fail('Move-Knopf erscheint auf Blättern ohne Export'); }

  if (/jspdf\.umd\.min\.js/.test(H)) { ok('jsPDF eingebunden'); }
  else { fail('jsPDF nicht eingebunden'); }
}

/* ═══ 21 · Markdown, Notizgruppen, Archiv-Löschen ══════════════════════
   Fehlerarten: eingegebenes HTML wird ausgeführt statt angezeigt; die
   Notizliste bleibt eine ungegliederte Halde; im Archiv lässt sich nichts
   endgültig entfernen; Löschen ohne Rückfrage kostet den Eintrag.
   ═══════════════════════════════════════════════════════════════════════ */
kat('21 · Markdown, Notizgruppen, Archiv');
{
  ['mdZuHtml', 'mdInline', 'arWeg', 'arFragen', 'arLoeschen']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  /* Markdown wirklich auswerten, nicht nur auf Vorkommen prüfen */
  const mI = JSK.match(/function mdInline\(t\) \{[\s\S]*?\n\}/);
  const mZ = JSK.match(/function mdZuHtml\(txt\) \{[\s\S]*?\n\}/);
  if (mI && mZ) {
    let fn = null;
    try {
      fn = new Function('esc',
        mI[0] + '\n' + mZ[0] + '\nreturn mdZuHtml;')(
        t => String(t == null ? '' : t).replace(/&/g, '&amp;')
              .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
    } catch (e) { fn = null; }
    if (!fn) { fail('Markdown nicht auswertbar'); }
    else {
      const FAELLE = [
        ['# Titel', '<h1>Titel</h1>'],
        ['- [ ] offen', 'md-haken'],
        ['- [x] fertig', 'ab'],
        ['**fett**', '<b>fett</b>'],
        ['> Zitat', '<blockquote>'],
        ['---', '<hr>'],
      ];
      let f = 0;
      FAELLE.forEach(function (x) {
        if (fn(x[0]).indexOf(x[1]) === -1) { f++; fail('Markdown: "' + x[0] + '" ohne ' + x[1]); }
      });
      if (!f) { ok(FAELLE.length + ' Markdown-Muster korrekt'); }
      /* Eingegebenes HTML darf nicht ausgeführt werden */
      const boese = fn('<img src=x onerror=alert(1)>');
      if (boese.indexOf('<img') === -1 && boese.indexOf('&lt;img') !== -1) {
        ok('eingegebenes HTML wird maskiert');
      } else { fail('HTML aus dem Notiztext wird ausgeführt'); }
    }
  } else { fail('mdInline oder mdZuHtml nicht gefunden'); }

  const mN = JSK.match(/function blattNotiz\(\) \{([\s\S]*?)\n\}/);
  if (mN && /bereicheDerGruppe\(gid\)/.test(mN[1])) {
    ok('Notizliste ist nach Gruppen gegliedert');
  } else { fail('Notizliste ohne Gruppengliederung'); }

  const mB = JSK.match(/function blattNotizBlatt\(id\) \{([\s\S]*?)\n\}/);
  if (mB && /mdZuHtml\(seiten\[nSeite\]\)/.test(mB[1]) && /textarea/.test(mB[1])) {
    ok('Notizblatt schaltet zwischen Ansicht und Bearbeitung');
  } else { fail('keine Umschaltung zwischen Ansicht und Markdown'); }

  const mA = JSK.match(/function arWeg\(art, id\) \{([\s\S]*?)\n\}/);
  if (mA && /arFrage === schluessel/.test(mA[1])) { ok('Archiv-Löschen fragt zurück'); }
  else { fail('Archiv-Löschen ohne Rückfrage'); }
  const mAL = JSK.match(/function arLoeschen\(art, id\) \{([\s\S]*?)\n\}/);
  if (mAL && /a\.planId = null/.test(mAL[1]) && /x\.zielId = null/.test(mAL[1])) {
    ok('Löschen im Archiv löst nur Zuordnungen');
  } else { fail('Löschen im Archiv reißt Zugeordnetes mit'); }
}

/* ═══ 22 · Feste Reiter und Verwaltungsknöpfe ═══════════════════════════
   Fehlerarten: die festen Reiter am Spaltenende werden bei vielen Gruppen
   aus der Spalte geschoben und sind nicht mehr erreichbar (margin-top:auto
   wirkt nur bei freiem Platz); ein Löschknopf steckt als blasses Kreuz in
   einem Verwaltungsdialog und wird nicht gefunden.
   ═══════════════════════════════════════════════════════════════════════ */
kat('22 · Feste Reiter und Verwaltungsknöpfe');
{
  const css = H.slice(H.indexOf('<style>'), H.indexOf('</style>'));
  const mFest = /^\.rt-fest \{([^}]*)\}/m.exec(css);
  if (!mFest) { fail('.rt-fest nicht definiert'); }
  else if (/margin-top:\s*auto/.test(mFest[1])) {
    fail('.rt-fest nutzt margin-top:auto — bei vielen Reitern wird es verdrängt');
  } else if (/flex:\s*0 0 auto/.test(mFest[1])) {
    ok('.rt-fest bekommt festen Platz zugeteilt');
  } else { fail('.rt-fest ohne feste Platzzuteilung'); }

  const mLauf = /^\.rt-lauf \{([^}]*)\}/m.exec(css);
  if (mLauf && /overflow:\s*hidden/.test(mLauf[1]) && /flex:\s*1 1 auto/.test(mLauf[1])) {
    ok('der laufende Teil nimmt den Rest und wird beschnitten');
  } else { fail('.rt-lauf fehlt oder beschneidet nicht'); }

  const mR = JSK.match(/function renderRegister\(\) \{([\s\S]*?)\n\}/);
  if (mR && /rt-lauf/.test(mR[1]) && /rt-fest/.test(mR[1])) {
    ok('Register trennt laufende und feste Reiter');
  } else { fail('Register trennt die Reiterarten nicht'); }
  if (mR && /FEST = \(reg === 'akt'\) \? \['wied', 'gew'\] : \['archiv'\]/.test(mR[1])) {
    ok('Archiv und die beiden Listenblätter sind fest verankert');
  } else { fail('feste Reiter nicht definiert'); }

  const mG = JSK.match(/function gruppenRender\(\) \{([\s\S]*?)\n\}/);
  if (!mG) { fail('gruppenRender nicht auswertbar'); }
  else if (/mon-x/.test(mG[1])) {
    fail('Gruppen-Löschen steckt als blasses Kreuz im Dialog');
  } else if (/grFragen/.test(mG[1]) && /L\\u00f6schen/.test(mG[1])) {
    ok('Gruppen-Löschen als beschrifteter Knopf mit Rückfrage');
  } else { fail('Gruppen lassen sich nicht löschen'); }
  if (/function grFragen/.test(JS)) { ok('grFragen vorhanden'); }
  else { fail('grFragen fehlt'); }
}

/* ═══ 23 · Notizeditor und Werkzeugleiste ══════════════════════════════
   Fehlerarten: das Eingabefeld hat eine feste Höhe und wirkt bei langen
   Notizen halb so gross wie die Ansicht; ein Werkzeugknopf entzieht dem
   Textfeld den Fokus und schliesst den Editor beim ersten Antippen; eine
   Auszeichnung verschachtelt sich beim zweiten Antippen statt zu lösen;
   eingerückte Listen werden flach dargestellt.
   ═══════════════════════════════════════════════════════════════════════ */
kat('23 · Notizeditor und Werkzeugleiste');
{
  ['mdWerkzeuge', 'mdHoehe', 'mdZeile', 'mdEinzug', 'mdUm', 'mdEinfuegen',
   'mdVerweis', 'mdLink', 'mdBild']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  const css = H.slice(H.indexOf('<style>'), H.indexOf('</style>'));
  const mT = /textarea\.nz-text \{([^}]*)\}/.exec(css);
  if (mT && /height:\s*\d+px/.test(mT[1]) && !/min-height/.test(mT[1])) {
    fail('Eingabefeld hat eine feste Höhe — wirkt bei langen Notizen zu klein');
  } else if (mT && /min-height/.test(mT[1])) {
    ok('Eingabefeld wächst mit dem Inhalt');
  } else { fail('textarea.nz-text nicht gefunden'); }

  const mW = JSK.match(/function mdWerkzeuge\(\) \{([\s\S]*?)\n\}/);
  if (mW && /onmousedown="event\.preventDefault\(\)"/.test(mW[1])) {
    ok('Werkzeugknöpfe entziehen dem Feld nicht den Fokus');
  } else { fail('Werkzeugknöpfe schliessen den Editor beim Antippen'); }

  /* Die Umschaltung muss auch greifen, wenn die Zeichen ausserhalb der
     Auswahl stehen — genau der Zustand nach dem Einfügen.            */
  const mU = JSK.match(/function mdUm\(zeichen\) \{([\s\S]*?)\n\}/);
  if (mU && /v\.slice\(a - n, a\) === zeichen/.test(mU[1])) {
    ok('Auszeichnung löst sich beim zweiten Antippen');
  } else { fail('zweites Antippen verschachtelt die Auszeichnung'); }

  const mZ = JSK.match(/function mdZeile\(praefix\) \{([\s\S]*?)\n\}/);
  if (mZ && /alleDa/.test(mZ[1]) && /#\{1,4\}/.test(mZ[1])) {
    ok('Zeilenpräfix wird ersetzt statt gestapelt');
  } else { fail('Zeilenpräfixe stapeln sich'); }

  /* Verschachtelte Listen: der Renderer braucht einen Ebenenstapel */
  const mI = JSK.match(/function mdInline\(t\) \{[\s\S]*?\n\}/);
  const mM = JSK.match(/function mdZuHtml\(txt\) \{[\s\S]*?\n\}/);
  if (mI && mM) {
    let fn = null;
    try {
      fn = new Function('esc', mI[0] + '\n' + mM[0] + '\nreturn mdZuHtml;')(
        t => String(t == null ? '' : t).replace(/&/g, '&amp;')
              .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
    } catch (e) { fn = null; }
    if (!fn) { fail('Markdown nicht auswertbar'); }
    else {
      const r = fn('- oben\n  - tiefer\n- wieder oben');
      const auf = (r.match(/<ul|<ol/g) || []).length;
      const zu = (r.match(/<\/ul>|<\/ol>/g) || []).length;
      if (auf === zu && auf >= 2) { ok('verschachtelte Listen, Tags ausgeglichen'); }
      else { fail('Listenverschachtelung unausgeglichen: ' + auf + '/' + zu); }
      if (fn('~~weg~~').indexOf('<s>weg</s>') !== -1) { ok('Durchgestrichen wird erkannt'); }
      else { fail('~~ wird nicht erkannt'); }
      if (fn('![A](x.png)').indexOf('<img') !== -1) { ok('Bilder werden dargestellt'); }
      else { fail('Bildsyntax wird nicht erkannt'); }
    }
  }
}

/* ═══ 24 · Übertrag und Löschen ════════════════════════════════════════
   Fehlerarten: abgeheftete Aktivitäten stehen weiter in den Arbeitslisten;
   der Übertrag nimmt auch Offenes oder Weitergezogenes mit; eine gelöschte
   Aktivität hinterlässt Verweise ins Leere in Wochen- und Monatsblättern;
   gelöscht wird ohne Rückfrage.
   ═══════════════════════════════════════════════════════════════════════ */
kat('24 · Übertrag und Löschen');
{
  ['uebertragKandidaten', 'uebertragAuf', 'uebertragMachen', 'aktZurueck',
   'aktEntfernen', 'aktLebend']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  if (/const lebend = a => !a\.archiviert;/.test(JSK)) { ok('lebend-Prüfung vorhanden'); }
  else { fail('keine zentrale Prüfung auf abgeheftet'); }

  /* Jede Arbeitsliste muss abgeheftete Aktivitäten ausblenden */
  const STELLEN = [
    ['blattTag', 'a.geplant === tagOffen'],
    ['blattAktivitaeten', 'bIds[a.b]'],
    ['planAktivitaeten', 'a.planId === pid'],
    ['zielAktivitaeten', 'a.zielId === zid'],
  ];
  let f = 0;
  STELLEN.forEach(function (x) {
    const m = JSK.match(new RegExp('function ' + x[0] + '\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}'));
    if (!m) { f++; fail(x[0] + ' nicht auswertbar'); return; }
    const zeile = m[1].split('\n').find(z => z.indexOf(x[1]) !== -1);
    if (!zeile || zeile.indexOf('lebend(a)') === -1) {
      f++; fail(x[0] + ' zeigt auch abgeheftete Aktivitäten');
    }
  });
  if (!f) { ok(STELLEN.length + ' Arbeitslisten blenden Abgeheftetes aus'); }

  /* Der Übertrag darf nur Erledigtes und Gestrichenes nehmen */
  const mK = JSK.match(/function uebertragKandidaten\(\) \{([\s\S]*?)\n\}/);
  /* Der Code schreibt die Glyphen als \u-Escapes — beide Formen prüfen */
  const glErl = /a\.glyph === '(?:\u2715|\\u2715)'/.test(mK ? mK[1] : '');
  const glGestr = /a\.glyph === '(?:\u2013|\\u2013)'/.test(mK ? mK[1] : '');
  if (mK && glErl && glGestr && /lebend\(a\)/.test(mK[1])) {
    ok('Übertrag nimmt nur Erledigtes und Gestrichenes');
  } else { fail('Übertrag greift zu weit — Offenes würde mit abgeheftet'); }

  const mM = JSK.match(/function uebertragMachen\(\) \{([\s\S]*?)\n\}/);
  if (mM && /a\.archiviert = datum/.test(mM[1])) {
    ok('Übertrag setzt das Datum, verschiebt aber nichts');
  } else { fail('Übertrag verschiebt Datensätze'); }

  /* Löschen muss Verweise mitnehmen */
  const mE = JSK.match(/function aktEntfernen\(id\) \{([\s\S]*?)\n\}/);
  if (!mE) { fail('aktEntfernen nicht auswertbar'); }
  else {
    if (/WOCHENBLAETTER\.forEach/.test(mE[1]) && /MONATSBLAETTER\.forEach/.test(mE[1])) {
      ok('Löschen räumt Verweise aus Wochen- und Monatsblättern');
    } else { fail('gelöschte Aktivität hinterlässt Verweise ins Leere'); }
  }
  if (/function bwLoeschFragen/.test(JS) && /bwLoeschFrage/.test(JSK)) {
    ok('Löschen erst nach Rückfrage');
  } else { fail('Löschen ohne Rückfrage'); }

  const mMig = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}/);
  if (mMig && /a\.archiviert === undefined/.test(mMig[1])) {
    ok('Migration ergänzt das Archivfeld');
  } else { fail('Migration ergänzt archiviert nicht'); }
  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 6) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 25 · Jahresrahmen und Monatshintergrund ══════════════════════════
   Fehlerarten: ein Rahmen wie ein Sabbatical erscheint im Tages- und
   Wochenblatt und verrauscht sie; Jahrestermine fehlen im Monatsblatt,
   obwohl sie den Monat prägen; sie werden dort zusätzlich als Eintrag
   angeboten und stehen dann doppelt.
   ═══════════════════════════════════════════════════════════════════════ */
kat('25 · Jahresrahmen und Monatshintergrund');
{
  const mJ = JS.match(/const SAAT_JAHRESTERMINE = \[([\s\S]*?)\n\];/) ||
             JS.match(/const JAHRESTERMINE = \[([\s\S]*?)\n\];/);
  if (mJ && /nurJahr:true/.test(mJ[1].replace(/\s/g, ''))) {
    ok('Jahresrahmen im Bestand vorhanden');
  } else { warn('kein Beispiel mit nurJahr im Bestand'); }

  const mG = JSK.match(/function ganztagsEintraegeFuer\(D\) \{([\s\S]*?)\n\}/);
  if (!mG) { fail('ganztagsEintraege nicht auswertbar'); }
  else if (/if \(j\.nurJahr\) \{ return; \}/.test(mG[1])) {
    ok('Tagesblatt lässt Jahresrahmen draußen');
  } else { fail('Jahresrahmen erscheint im Tagesblatt'); }

  const mW = JSK.match(/function blattWoche\(\) \{([\s\S]*?)\n\}/);
  /* Die Datumspruefung laeuft jetzt ueber jtLaeuft, damit jaehrliche
     mitgezaehlt werden.                                              */
  if (mW && /!j\.nurJahr && jtLaeuft\(j, iso\)/.test(mW[1])) {
    ok('Wochenblatt lässt Jahresrahmen draußen');
  } else { fail('Jahresrahmen erscheint im Wochenblatt'); }

  const mM = JSK.match(/function blattMonat\(\) \{([\s\S]*?)\n\}/);
  if (!mM) { fail('blattMonat nicht auswertbar'); }
  else {
    /* Sie stehen im festen Rahmen des Monats, nicht als Eintrag */
    if (/JAHRESTERMINE\.forEach/.test(mM[1]) && /rahmen\.push/.test(mM[1])) {
      ok('Monatsblatt zeigt Jahrestermine im festen Rahmen');
    } else { fail('Jahrestermine fehlen im Monatsblatt'); }
    if (!/vorhaben\.push/.test(mM[1])) {
      ok('Jahrestermine werden nicht als Vorhaben geschrieben');
    } else { fail('Jahrestermine mischen sich unter die Vorhaben'); }
  }

  const mWa = JSK.match(/function wahlAuf\(modus\) \{([\s\S]*?)\n\}/);
  if (mWa && /if \(fuerWoche\) \{[\s\S]{0,400}JAHRESTERMINE\.forEach/.test(mWa[1])) {
    ok('Monatswähler bietet Jahrestermine nicht mehr doppelt an');
  } else { fail('Jahrestermine werden im Monat doppelt angeboten'); }

  const mS = JSK.match(/function jtSpeichern\(\) \{([\s\S]*?)\n\}/);
  if (mS && /j\.nurJahr = /.test(mS[1])) { ok('Sichtbarkeit ist im Dialog einstellbar'); }
  else { fail('nurJahr lässt sich nicht setzen'); }

  const mMig = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}/);
  if (mMig && /j\.nurJahr === undefined/.test(mMig[1])) {
    ok('Migration ergänzt nurJahr');
  } else { fail('Migration ergänzt nurJahr nicht'); }
  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 7) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 26 · Inforegister ════════════════════════════════════════════════
   Fehlerarten: die Infoseiten fehlen in saatDB oder leereDB und das
   Register steht leer; die Migration ergänzt sie nicht und ein alter
   Bestand hat keine Anleitung; die Anleitung ist kein gültiges Markdown.
   ═══════════════════════════════════════════════════════════════════════ */
kat('26 · Inforegister');
{
  ['blattInfo', 'infoNeu', 'infoLoeschen', 'infoFeld', 'infoSchreiben', 'infoOffen']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  const mS = JSK.match(/function saatDB\(\) \{([\s\S]*?)\n\}/);
  const mL = JSK.match(/function leereDB\(\) \{([\s\S]*?)\n\}/);
  if (mS && /infoseiten:/.test(mS[1])) { ok('saatDB kennt infoseiten'); }
  else { fail('infoseiten fehlt in saatDB'); }
  if (mL && /infoseiten:/.test(mL[1])) { ok('leereDB kennt infoseiten'); }
  else { fail('infoseiten fehlt in leereDB'); }

  const mU = JSK.match(/function dbUebernehmen\(neu\) \{([\s\S]*?)\n\}/);
  if (mU && /INFOSEITEN\s*=\s*DB\.infoseiten/.test(mU[1])) {
    ok('dbUebernehmen setzt INFOSEITEN');
  } else { fail('INFOSEITEN wird nicht neu gesetzt'); }

  /* Ein alter Bestand ohne Infoseiten bekommt die Anleitung nachgereicht */
  const mM = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}/);
  if (mM && /!Array\.isArray\(d\.infoseiten\) \|\| !d\.infoseiten\.length/.test(mM[1])) {
    ok('Migration reicht die Anleitung nach');
  } else { fail('alter Bestand bliebe ohne Anleitung'); }

  /* Die Anleitung muss gültiges Markdown sein */
  const mI = JS.match(/const SAAT_INFOSEITEN = \[([\s\S]*?)\n\];/);
  if (!mI) { fail('SAAT_INFOSEITEN nicht gefunden'); }
  else {
    const mT = /text:'((?:[^'\\]|\\.)*)'/.exec(mI[1]);
    if (!mT) { fail('Anleitungstext nicht lesbar'); }
    else {
      const txt = mT[1].replace(/\\n/g, '\n').replace(/\\'/g, "'")
                       .replace(/\\\\/g, '\\');
      if (txt.length > 1000) { ok('Anleitung mit ' + txt.length + ' Zeichen'); }
      else { fail('Anleitung zu knapp: ' + txt.length + ' Zeichen'); }
      const mIn = JSK.match(/function mdInline\(t\) \{[\s\S]*?\n\}/);
      const mZ = JSK.match(/function mdZuHtml\(txt\) \{[\s\S]*?\n\}/);
      if (mIn && mZ) {
        let fn = null;
        try {
          fn = new Function('esc', mIn[0] + '\n' + mZ[0] + '\nreturn mdZuHtml;')(
            t => String(t == null ? '' : t).replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
        } catch (e) { fn = null; }
        if (fn) {
          const r = fn(txt);
          const auf = (r.match(/<ul|<ol/g) || []).length;
          const zu = (r.match(/<\/ul>|<\/ol>/g) || []).length;
          if (auf === zu) { ok('Anleitung rendert mit ausgeglichenen Listen'); }
          else { fail('Anleitung rendert unausgeglichen: ' + auf + '/' + zu); }
          if ((r.match(/<h[12]/g) || []).length >= 5) { ok('Anleitung ist gegliedert'); }
          else { fail('Anleitung ohne Gliederung'); }
        }
      }
    }
  }

  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 8) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 27 · Spaltenbreiten und Arten-Farben ═════════════════════════════
   Fehlerarten: eine Rasterspalte wird von langem Inhalt aufgedrückt und
   die Nachbarspalte schrumpft (fehlendes minmax(0,…)); lange Titel laufen
   einzeilig aus statt umzubrechen; zwei Arten bekommen fast dieselbe
   Farbe und sind im 24-px-Balken nicht zu unterscheiden.
   ═══════════════════════════════════════════════════════════════════════ */
kat('27 · Spaltenbreiten und Arten-Farben');
{
  const css = H.slice(H.indexOf('<style>'), H.indexOf('</style>'));
  const mD = /\.doppel \{([^}]*)\}/.exec(css);
  if (!mD) { fail('.doppel nicht gefunden'); }
  else if (/minmax\(0,\s*1fr\)/.test(mD[1]) && /minmax\(0,\s*1\.15fr\)/.test(mD[1])) {
    ok('Spaltenbreiten können nicht aufgedrückt werden');
  } else { fail('.doppel ohne minmax(0,…) — langer Inhalt verschiebt die Spalten'); }

  ['a-titel', 'wk-t'].forEach(function (k) {
    const m = new RegExp('^\\.' + k + ' \\{([^}]*)\\}', 'm').exec(css);
    if (m && /-webkit-line-clamp:\s*2/.test(m[1])) {
      ok('.' + k + ' bricht auf zwei Zeilen und schneidet dann ab');
    } else { fail('.' + k + ' ohne Zweizeilen-Begrenzung'); }
  });

  const mA = JS.match(/const JT_ARTEN = \{([\s\S]*?)\n\};/);
  if (!mA) { fail('JT_ARTEN nicht gefunden'); }
  else {
    const arten = {};
    (mA[1].match(/(\w+):\s*\{ n:'[^']*',\s*f:'(#[0-9a-fA-F]{6})' \}/g) || [])
      .forEach(function (z) {
        const m = /(\w+):\s*\{ n:'[^']*',\s*f:'(#[0-9a-fA-F]{6})' \}/.exec(z);
        arten[m[1]] = m[2];
      });
    const k = Object.keys(arten);
    ['urlaub', 'krank', 'dienstreise', 'besuche', 'abwesend', 'termin',
     'geburtstag', 'feier', 'feiertag', 'sonstiges'].forEach(function (x) {
      if (k.indexOf(x) !== -1) { ok('Art ' + x + ' vorhanden'); }
      else { fail('Art ' + x + ' fehlt'); }
    });
    const rgb = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
    let min = 999, paar = '';
    for (let i = 0; i < k.length; i++) {
      for (let j = i + 1; j < k.length; j++) {
        const a = rgb(arten[k[i]]), b = rgb(arten[k[j]]);
        const d = Math.sqrt(a.reduce((s, v, x) => s + (v - b[x]) * (v - b[x]), 0));
        if (d < min) { min = d; paar = k[i] + '/' + k[j]; }
      }
    }
    if (min >= 40) {
      ok(k.length + ' Arten, kleinster Farbabstand ' + Math.round(min) + ' bei ' + paar);
    } else {
      fail('Farben zu ähnlich: ' + paar + ' (Abstand ' + Math.round(min) + ')');
    }
  }
}

/* ═══ 28 · Doppelte Schleifen und Zeilenhöhen ══════════════════════════
   Fehlerarten: beim Umbau bleibt eine alte Schleife stehen und jeder
   Eintrag erscheint zweimal; eine feste Zeilenhöhe verträgt den
   Zweizeilenumbruch nicht und die Zeilen laufen ineinander; freie Zeilen
   sind keine Klickfläche, obwohl man auf Papier auf jede Linie schreibt.
   ═══════════════════════════════════════════════════════════════════════ */
kat('28 · Doppelte Schleifen und Zeilenhöhen');
{
  const mG = JSK.match(/function ganztagsEintraegeFuer\(D\) \{([\s\S]*?)\n\}/);
  if (!mG) { fail('ganztagsEintraege nicht auswertbar'); }
  else {
    const n = (mG[1].match(/JAHRESTERMINE\.forEach/g) || []).length;
    if (n === 1) { ok('genau eine Jahrestermin-Schleife im Ganztags-Band'); }
    else { fail(n + ' Jahrestermin-Schleifen — Einträge erscheinen mehrfach'); }
    if (!/ort/.test(mG[1])) { ok('das Band führt keinen Ort'); }
    else { fail('Ort im Ganztags-Band'); }
  }

  const css = H.slice(H.indexOf('<style>'), H.indexOf('</style>'));
  /* Zeilen mit Zweizeilenumbruch duerfen keine feste Hoehe haben */
  [['wk-z', 'wk-t'], ['zl-z', 'zl-t']].forEach(function (paar) {
    const mZ = new RegExp('^\\.' + paar[0] + ' \\{([^}]*)\\}', 'm').exec(css);
    const mT = new RegExp('^\\.' + paar[1] + ' \\{([^}]*)\\}', 'm').exec(css);
    if (!mZ) { return; }
    const clamp = mT && /-webkit-line-clamp/.test(mT[1]);
    const fest = /(^|;)\s*height:\s*\d+px/.test(mZ[1]);
    if (clamp && fest) {
      fail('.' + paar[0] + ' hat feste Höhe, .' + paar[1] + ' bricht um — Zeilen überlappen');
    } else { ok('.' + paar[0] + ' verträgt den Inhalt'); }
  });

  const mT = JSK.match(/function blattTag\(\) \{([\s\S]*?)\n\}/);
  if (mT && /class="leer klick" onclick="aktNeu/.test(mT[1])) {
    ok('freie Zeilen im Tagesblatt sind Klickflächen');
  } else { fail('freie Zeilen im Tagesblatt sind tot'); }
  const mA = JSK.match(/function blattAktivitaeten\(\) \{([\s\S]*?)\n\}/);
  if (mA && /tr class="leer klick"/.test(mA[1])) {
    ok('freie Zeilen in der Checkliste sind Klickflächen');
  } else { fail('freie Zeilen in der Checkliste sind tot'); }
}

/* ═══ 29 · Rhythmen anlegen und pflegen ════════════════════════════════
   Fehlerart: ein Bestand ist nur Anzeige — man kann Kästchen schalten,
   den Vorgang selbst aber weder anlegen noch ändern noch löschen.
   Ebenso: Mustertext und Wochentage laufen auseinander, weil beide von
   Hand gepflegt werden; das Soll einer Gewohnheit passt nicht zu ihren
   Tagen.
   ═══════════════════════════════════════════════════════════════════════ */
kat('29 · Rhythmen anlegen und pflegen');
{
  ['rhNeu', 'rhOeffnen', 'rhSpeichern', 'rhLoeschen', 'rhTag', 'rhMuster', 'rhRender']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  ['blattWieder', 'blattGewohnheit'].forEach(function (bl) {
    const m = JSK.match(new RegExp('function ' + bl + '\\(\\) \\{([\\s\\S]*?)\\n\\}'));
    if (!m) { fail(bl + ' nicht auswertbar'); return; }
    if (/rhNeu\(/.test(m[1])) { ok(bl + ': Anlegen möglich'); }
    else { fail(bl + ': kein Weg zum Anlegen'); }
    if (/rhOeffnen\(/.test(m[1])) { ok(bl + ': Bearbeiten möglich'); }
    else { fail(bl + ': kein Weg zum Bearbeiten'); }
  });

  /* Muster wird gerechnet, nicht getippt */
  const mM = JSK.match(/function rhMuster\(w\) \{[\s\S]*?\n\}/);
  if (mM) {
    let fn = null;
    try {
      fn = new Function('WOKURZ', mM[0] + '\nreturn rhMuster;')(
        ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
    } catch (e) { fn = null; }
    if (!fn) { fail('rhMuster nicht auswertbar'); }
    else {
      const F = [
        [{ typ:'woche', tage:[0,1,2,3,4,5,6], intervall:1 }, 'täglich'],
        [{ typ:'woche', tage:[0,1,2,3,4], intervall:1 }, 'Mo – Fr'],
        [{ typ:'woche', tage:[5,6], intervall:1 }, 'Wochenende'],
        [{ typ:'woche', tage:[0,2,4], intervall:1 }, 'Mo · Mi · Fr'],
        [{ typ:'woche', tage:[2], intervall:2 }, 'Mi, jede zweite Woche'],
        [{ typ:'monat', monatstag:15 }, 'am 15. jedes Monats'],
      ];
      let f = 0;
      F.forEach(function (x) {
        if (fn(x[0]) !== x[1]) { f++; fail('rhMuster: ' + fn(x[0]) + ' statt ' + x[1]); }
      });
      if (!f) { ok(F.length + ' Rhythmusmuster korrekt gebildet'); }
    }
  }

  const mS = JSK.match(/function rhSpeichern\(\) \{([\s\S]*?)\n\}/);
  if (!mS) { fail('rhSpeichern nicht auswertbar'); }
  else {
    if (/e\.muster = rhMuster\(e\)/.test(mS[1])) {
      ok('Mustertext folgt dem Rhythmus');
    } else { fail('Muster und Rhythmus können auseinanderlaufen'); }
    if (/e\.soll = e\.tage\.length/.test(mS[1])) {
      ok('Soll einer Gewohnheit folgt ihren Tagen');
    } else { fail('Soll und Tage können auseinanderlaufen'); }
    if (/!e\.tage\.length/.test(mS[1])) { ok('ohne Wochentag wird nicht gespeichert'); }
    else { fail('ein Rhythmus ohne Tag wäre unsichtbar'); }
    if (/i === -1 \) \{ l\.push\(e\); \} else \{ l\[i\] = e; \}|l\.push\(e\); \} else \{ l\[i\] = e/.test(mS[1])) {
      ok('Bearbeiten ersetzt, statt anzuhängen');
    } else { fail('Bearbeiten könnte Dubletten erzeugen'); }
  }

  const mL = JSK.match(/function rhFragen\(\)/);
  if (mL) { ok('Löschen erst nach Rückfrage'); }
  else { fail('Löschen ohne Rückfrage'); }
}

/* ═══ 30 · Anhänge und Vollsicherung ═══════════════════════════════════
   Fehlerarten: die Bilder landen im Bestand und blähen jeden Speichervorgang
   und jeden Export auf; ein Anhang wird beim Löschen der Notizzeile nicht
   mitentfernt und bleibt als Leiche liegen; die Vollsicherung lässt sich
   nicht wieder einlesen; ein 4000-Punkte-Foto wird ungerechnet abgelegt.
   ═══════════════════════════════════════════════════════════════════════ */
kat('30 · Anhänge und Vollsicherung');
{
  ['anLesen', 'anSchreiben', 'anEntfernen', 'anAlle', 'anHolen', 'anDateiGelesen',
   'anBildVerkleinern', 'anPdfSeiten', 'anVoll', 'anLoesen', 'datenExportVoll']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  /* Die Bilder duerfen nicht im Bestand liegen */
  const mS = JSK.match(/function saatDB\(\) \{([\s\S]*?)\n\}/);
  if (mS && !/anhaenge:/.test(mS[1])) { ok('Anhänge liegen außerhalb des Bestands'); }
  else { fail('Anhänge im Bestand — jeder Speichervorgang würde sie mitschreiben'); }
  if (/const AN_STORE = 'anhaenge'/.test(JSK)) { ok('eigener Speicherbereich'); }
  else { fail('kein eigener Speicherbereich für Anhänge'); }
  if (/indexedDB\.open\(SP_NAME, 2\)/.test(JSK)) { ok('Speicherversion für den neuen Bereich erhöht'); }
  else { fail('Speicherversion nicht erhöht — der Bereich entsteht nicht'); }

  const mE = JSK.match(/function datenExport\(\) \{([\s\S]*?)\n\}/);
  if (mE && !/anAlle/.test(mE[1])) { ok('gewöhnlicher Export bleibt schlank'); }
  else { fail('gewöhnlicher Export zieht die Anhänge mit'); }
  const mV = JSK.match(/function datenExportVoll\(\) \{([\s\S]*?)\n\}/);
  if (mV && /anAlle\(\)/.test(mV[1]) && /vollsicherung/.test(mV[1])) {
    ok('Vollsicherung bündelt Bestand und Anhänge');
  } else { fail('Vollsicherung unvollständig'); }

  const mI = JSK.match(/function datenImport\(ev\) \{([\s\S]*?)\n\}/);
  if (mI && /neu\.timeassist === 'vollsicherung'/.test(mI[1])) {
    ok('Vollsicherung wird beim Import erkannt');
  } else { fail('Vollsicherung lässt sich nicht zurücklesen'); }

  const mL = JSK.match(/function anLoesen\(notizId, anId\) \{([\s\S]*?)\n\}/);
  if (mL && /anEntfernen\(anId\)/.test(mL[1]) && /anhaenge\.splice/.test(mL[1])) {
    ok('Anhang wird aus Notiz und Speicher entfernt');
  } else { fail('gelöschter Anhang bleibt als Leiche liegen'); }

  const mB = JSK.match(/function anBildVerkleinern\(datenUrl\) \{([\s\S]*?)\n\}/);
  if (mB && /AN_BREITE/.test(mB[1]) && /toDataURL/.test(mB[1])) {
    ok('große Bilder werden auf Blattbreite gerechnet');
  } else { fail('Bilder werden ungerechnet abgelegt'); }

  const mM = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}/);
  if (mM && /Array\.isArray\(n\.anhaenge\)/.test(mM[1])) {
    ok('Migration ergänzt die Anhangliste');
  } else { fail('Migration ergänzt anhaenge nicht'); }
  const mDV = JS.match(/const DB_VERSION = (\d+)/);
  if (mDV && parseInt(mDV[1], 10) >= 9) { ok('Schemaversion auf ' + mDV[1]); }
  else { fail('Schemaversion nicht erhöht'); }

  if (/pdf\.js\/[\d.]+\/pdf\.min\.js/.test(H)) { ok('pdf.js eingebunden'); }
  else { fail('pdf.js nicht eingebunden'); }
  if (/function pdfBausteinDa/.test(JS)) { ok('fehlender PDF-Baustein wird abgefangen'); }
  else { fail('kein Rückfall ohne pdf.js'); }
}

/* ═══ 31 · Rhythmus mit Intervall und Monatstag ════════════════════════
   Fehlerarten: nur Wochentage umgesetzt, "jede zweite Woche" und "am 15."
   fehlen; der Monatstag 31 lässt den Vorgang in kürzeren Monaten ganz
   ausfallen; der Import wirft das Intervall weg; Streifen und Tagesblatt
   entscheiden die Fälligkeit unterschiedlich.
   ═══════════════════════════════════════════════════════════════════════ */
kat('31 · Rhythmus mit Intervall und Monatstag');
{
  ['faelligAn', 'wochenAbstand', 'rhTyp'].forEach(function (f) {
    if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
    else { fail(f + ' fehlt'); }
  });

  /* Die Fälligkeit wirklich rechnen, nicht nur auf Vorkommen prüfen */
  const teile = ['isoPlus', 'isoWt', 'isoMontag', 'wochenAbstand', 'faelligAn']
    .map(function (n) {
      const m = JSK.match(new RegExp('function ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
      return m ? m[0] : null;
    });
  if (teile.indexOf(null) !== -1) { fail('Fälligkeitsfunktionen nicht auswertbar'); }
  else {
    let fn = null;
    try { fn = new Function(teile.join('\n') + '\nreturn faelligAn;')(); }
    catch (e) { fn = null; }
    if (!fn) { fail('faelligAn nicht auswertbar'); }
    else {
      const F = [
        [{ typ:'woche', tage:[2], intervall:2, ab:'2026-08-17' }, '2026-08-19', true],
        [{ typ:'woche', tage:[2], intervall:2, ab:'2026-08-17' }, '2026-08-26', false],
        [{ typ:'woche', tage:[2], intervall:2, ab:'2026-08-17' }, '2026-09-02', true],
        [{ typ:'woche', tage:[0], intervall:4, ab:'2026-08-17' }, '2026-09-14', true],
        [{ typ:'woche', tage:[0], intervall:4, ab:'2026-08-17' }, '2026-09-07', false],
        [{ typ:'woche', tage:[0,4], intervall:1 }, '2026-08-21', true],
        [{ typ:'monat', monatstag:15 }, '2026-08-15', true],
        [{ typ:'monat', monatstag:15 }, '2026-08-14', false],
        /* Der 31. muss in kürzeren Monaten auf den letzten Tag rücken */
        [{ typ:'monat', monatstag:31 }, '2026-02-28', true],
        [{ typ:'monat', monatstag:31 }, '2026-04-30', true],
        [{ typ:'monat', monatstag:31 }, '2026-04-29', false],
        [{ typ:'monat', monatstag:31 }, '2028-02-29', true],
      ];
      let f = 0;
      F.forEach(function (x) {
        if (fn(x[0], x[1]) !== x[2]) {
          f++;
          fail('faelligAn ' + JSON.stringify(x[0]) + ' am ' + x[1] + ' = ' + fn(x[0], x[1]));
        }
      });
      if (!f) { ok(F.length + ' Fälligkeitsfälle korrekt, Monatsende und Schalttag geprüft'); }
    }
  }

  /* Streifen und Tagesblatt müssen dieselbe Quelle nutzen */
  const mSt = JSK.match(/function streifen\(obj, klickbar, fn\) \{([\s\S]*?)\n\}/);
  if (mSt && /faelligAn\(obj, iso\)/.test(mSt[1])) {
    ok('Streifen fragt die Fälligkeit');
  } else { fail('Streifen prüft nur Wochentage'); }
  const mT = JSK.match(/function blattTag\(\) \{([\s\S]*?)\n\}/);
  if (mT && /faelligAn\(x, tagOffen\)/.test(mT[1])) {
    ok('Tagesblatt fragt dieselbe Fälligkeit');
  } else { fail('Tagesblatt entscheidet anders als der Streifen'); }

  const mR = JSK.match(/function rhRender\(\) \{([\s\S]*?)\n\}/);
  if (mR && /rh-iv/.test(mR[1]) && /rh-mt/.test(mR[1]) && /rhTyp\(/.test(mR[1])) {
    ok('Dialog bietet Intervall und Monatstag');
  } else { fail('Dialog kennt nur Wochentage'); }

  const mW = JSK.match(/function waUmwandeln\(d\) \{([\s\S]*?)\n\}/);
  if (mW && /neu\.typ = 'monat'/.test(mW[1]) && /intervall:iv/.test(mW[1])) {
    ok('Import überträgt Intervall und Monatsrhythmus');
  } else { fail('Import wirft den Rhythmus weg'); }

  const mM = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}/);
  if (mM && /w\.typ = 'woche'/.test(mM[1]) && /w\.ab = isoMontag/.test(mM[1])) {
    ok('Migration ergänzt Typ, Intervall und Anker');
  } else { fail('Migration ergänzt den Rhythmus nicht'); }
  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 10) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 32 · Annotieren ══════════════════════════════════════════════════
   Fehlerarten: die Striche werden im Anhang gespeichert und bei jedem
   Strich fliegen alle Seitenbilder neu auf die Platte; Koordinaten in
   Bildpunkten statt Anteilen — der Strich liegt nach einer Drehung
   daneben; der Finger malt statt zu schieben; ein gelöschter Anhang
   lässt seine Striche als Leiche zurück.
   ═══════════════════════════════════════════════════════════════════════ */
kat('32 · Annotieren');
{
  ['avZeichnen', 'avMalen', 'avStrichMalen', 'avPunkt', 'avRadieren',
   'avZeigerBinden', 'avLeinwandPassen', 'avSichern', 'avZurueckNehmen',
   'avSeiteLeeren', 'anStricheLesen', 'anStricheSchreiben']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  /* Striche gehören in einen eigenen Datensatz */
  const mS = JSK.match(/function avSichern\(\) \{([\s\S]*?)\n\}/);
  if (mS && /anStricheSchreiben/.test(mS[1]) && !/anSchreiben\(/.test(mS[1])) {
    ok('Striche werden getrennt vom Anhang gespeichert');
  } else { fail('jeder Strich schreibt alle Seitenbilder neu'); }
  if (/put\(\{ id:id, striche:striche \}, 'str' \+ id\)/.test(JSK)) {
    ok('eigener Schlüssel für die Striche');
  } else { fail('kein eigener Schlüssel für die Striche'); }

  /* Koordinaten als Anteil, nicht in Bildpunkten */
  const mP = JSK.match(/function avPunkt\(ev\) \{([\s\S]*?)\n\}/);
  if (mP && /\/ r\.width/.test(mP[1]) && /\/ r\.height/.test(mP[1])) {
    ok('Koordinaten als Anteil der Bildbreite');
  } else { fail('Koordinaten in Bildpunkten — Striche verrutschen bei Größenänderung'); }
  const mM = JSK.match(/function avStrichMalen\(g, st, b, h\) \{([\s\S]*?)\n\}/);
  if (mM && /st\.p\[0\]\[0\] \* b/.test(mM[1]) && /st\.b \* b \/ 1000/.test(mM[1])) {
    ok('Strichbreite skaliert mit der Anzeige');
  } else { fail('Strichbreite fest in Bildpunkten'); }

  /* Radierer wirklich rechnen */
  const mR = JSK.match(/function avRadieren\(pt\) \{[\s\S]*?\n\}/);
  if (mR) {
    let fn = null;
    try {
      /* strichNah gehoert dazu: der Radierer prueft den Abstand zur
         Strecke, nicht nur zu den gespeicherten Punkten.             */
      const mN = JSK.match(/function strichNah\(st, pt, nah\) \{[\s\S]*?\n\}/);
      fn = new Function('zustand',
        'let avSeite = zustand.seite, avStriche = zustand.striche;' +
        'const $ = () => ({ clientWidth: 800 });' +
        'const avMalen = () => {}; const avSichernSpaeter = () => {};' +
        (mN ? mN[0] + '\n' : '') +
        mR[0] + '\nreturn function (pt) { avRadieren(pt); return avStriche[avSeite].length; };');
    } catch (e) { fn = null; }
    if (!fn) { fail('avRadieren nicht auswertbar'); }
    else {
      const bau = () => ({ seite:0,
        striche:{ 0:[{ f:'x', b:3, p:[[0.1,0.1],[0.5,0.5],[0.9,0.2]] }] } });
      const treffer = fn(bau())([0.5, 0.5]);
      const daneben = fn(bau())([0.3, 0.8]);
      if (treffer === 0 && daneben === 1) { ok('Radierer trifft nur den gemeinten Strich'); }
      else { fail('Radierer: Treffer=' + treffer + ' Daneben=' + daneben); }
    }
  }

  /* Der Finger soll schieben können, solange der Stift zeichnet */
  const mB = JSK.match(/function avZeigerBinden\(\) \{([\s\S]*?)\n\}/);
  if (mB && /ev\.pointerType === 'pen' \|\| avStift/.test(mB[1])) {
    ok('Stift zeichnet immer, der Finger nur im Zeichenbetrieb');
  } else { fail('der Finger malt und die Seite lässt sich nicht schieben'); }
  const css = H.slice(H.indexOf('<style>'), H.indexOf('</style>'));
  if (/\.av-flaeche canvas \{[^}]*touch-action:\s*none/.test(css)) {
    ok('Zeichenfläche unterdrückt die Gestenerkennung');
  } else { fail('ohne touch-action:none scrollt die Seite beim Zeichnen'); }

  const mL = JSK.match(/function anLoesen\(notizId, anId\) \{([\s\S]*?)\n\}/);
  if (mL && /delete\('str' \+ anId\)/.test(mL[1])) {
    ok('Löschen räumt auch die Striche weg');
  } else { fail('Striche bleiben als Leiche zurück'); }

  if (/if \(avId !== null\) \{ avLeinwandPassen\(0\); avMalen\(\); \}/.test(JSK)) {
    ok('Zeichenebene folgt einer Größenänderung');
  } else { fail('nach einer Drehung liegt der Strich neben dem Stift'); }
}

/* ═══ 33 · Planblatt: Rang, Archivsicht, Überschriften ═════════════════
   Fehlerarten: das Planblatt zeigt nur die lebenden Aktivitäten und die
   Geschichte des Vorhabens fehlt; Abgeheftetes nimmt am Umsortieren teil
   und wandert zwischen die Arbeit; der Titel steht im Blattkopf und
   nochmals im Blatt und frisst eine Zeile.
   ═══════════════════════════════════════════════════════════════════════ */
kat('33 · Planblatt');
{
  ['planRuecken', 'planRangNeu'].forEach(function (f) {
    if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
    else { fail(f + ' fehlt'); }
  });

  /* Reihenfolge wirklich rechnen */
  const mA = JSK.match(/function planAktivitaeten\(pid, mitArchiv\) \{[\s\S]*?\n\}/);
  const mR = JSK.match(/function planRuecken\(pid, id, richtung\) \{[\s\S]*?\n\}/);
  if (!mA || !mR) { fail('Sortierfunktionen nicht auswertbar'); }
  else {
    let bau = null;
    try {
      bau = new Function(
        'let AKTIVITAETEN = [];' +
        'const lebend = a => !a.archiviert;' +
        'const renderAlles = () => {};' +
        mA[0] + '\n' + mR[0] + '\n' +
        'return { setze:function (l) { AKTIVITAETEN = l; },' +
        ' liste:function (m) { return planAktivitaeten("p1", m).map(a => a.t); },' +
        ' ruecke:function (id, d) { planRuecken("p1", id, d); } };')();
    } catch (e) { bau = null; }
    if (!bau) { fail('Sortierlogik nicht auswertbar'); }
    else {
      bau.setze([
        { id:1, t:'A', planId:'p1', pos:1, archiviert:null },
        { id:2, t:'B', planId:'p1', pos:2, archiviert:null },
        { id:3, t:'C', planId:'p1', pos:3, archiviert:null },
        { id:4, t:'Alt', planId:'p1', pos:0, archiviert:'2026-08-01' },
      ]);
      let f = 0;
      if (bau.liste(true).join() !== 'A,B,C,Alt') { f++; fail('Ausgangsfolge falsch: ' + bau.liste(true)); }
      if (bau.liste(false).join() !== 'A,B,C') { f++; fail('Arbeitsliste enthält Abgeheftetes'); }
      bau.ruecke(3, -1);
      if (bau.liste(true).join() !== 'A,C,B,Alt') { f++; fail('nach ↑: ' + bau.liste(true)); }
      bau.ruecke(3, -1);
      bau.ruecke(3, -1);
      if (bau.liste(true).join() !== 'C,A,B,Alt') { f++; fail('über den Rand: ' + bau.liste(true)); }
      if (bau.liste(true).slice(-1)[0] !== 'Alt') { f++; fail('Abgeheftetes wandert nach vorn'); }
      if (!f) { ok('Umsortieren korrekt, Abgeheftetes bleibt hinten'); }
    }
  }

  const mB = JSK.match(/function blattPlan\(pid\) \{([\s\S]*?)\n\}/);
  if (!mB) { fail('blattPlan nicht auswertbar'); }
  else {
    if (/planAktivitaeten\(p\.id, true\)/.test(mB[1])) {
      ok('Planblatt zeigt auch Abgeheftetes');
    } else { fail('Planblatt verschweigt die Geschichte des Vorhabens'); }
    if (/p-arch/.test(mB[1])) { ok('Abgeheftetes ist als solches gekennzeichnet'); }
    else { fail('Abgeheftetes sieht aus wie laufende Arbeit'); }
    if (/planRuecken/.test(mB[1])) { ok('Rangknöpfe im Blatt'); }
    else { fail('keine Möglichkeit umzusortieren'); }
  }

  /* Der Titel darf nicht zweimal dastehen */
  [['blattPlan', "kopf('Plan'"], ['blattZiel', "kopf('Ziel'"],
   ['blattInfo', "kopf('Info'"]].forEach(function (x) {
    const m = JSK.match(new RegExp('function ' + x[0] + '\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}'));
    if (m && m[1].indexOf(x[1]) !== -1) { ok(x[0] + ': Überschrift steht nur einmal'); }
    else { fail(x[0] + ': Titel doppelt in Kopf und Blatt'); }
  });

  const mM = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}/);
  if (mM && /a\.pos === undefined/.test(mM[1])) { ok('Migration vergibt Ränge'); }
  else { fail('Migration vergibt keine Ränge'); }
  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 11) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 34 · Startdatum eines Rhythmus ═══════════════════════════════════
   Fehlerarten: das Startdatum lässt sich nicht setzen, obwohl "jede
   zweite Woche" ohne Anker nicht bestimmbar ist; ein Vorgang gilt auch
   vor seinem Beginn als fällig; ein unsinniges Datum wird stillschweigend
   übernommen und der Vorgang fällt lautlos aus; bereits erfasste Häkchen
   liegen nach der Umstellung vor dem Start.
   ═══════════════════════════════════════════════════════════════════════ */
kat('34 · Startdatum eines Rhythmus');
{
  const mF = JSK.match(/function faelligAn\(w, iso\) \{([\s\S]*?)\n\}/);
  if (mF && /w\.ab && iso < w\.ab/.test(mF[1])) {
    ok('vor dem Startdatum ist nichts fällig');
  } else { fail('der Vorgang gilt auch vor seinem Beginn als fällig'); }

  /* Wirkung wirklich rechnen */
  const teile = ['isoPlus', 'isoWt', 'isoMontag', 'wochenAbstand', 'faelligAn']
    .map(function (n) {
      const m = JSK.match(new RegExp('function ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
      return m ? m[0] : null;
    });
  if (teile.indexOf(null) !== -1) { fail('Fälligkeitsfunktionen nicht auswertbar'); }
  else {
    let fn = null;
    try { fn = new Function(teile.join('\n') + '\nreturn faelligAn;')(); }
    catch (e) { fn = null; }
    if (!fn) { fail('faelligAn nicht auswertbar'); }
    else {
      const F = [
        [{ typ:'woche', tage:[0,2,4], intervall:1, ab:'2026-09-01' }, '2026-08-31', false],
        [{ typ:'woche', tage:[0,2,4], intervall:1, ab:'2026-09-01' }, '2026-09-02', true],
        [{ typ:'monat', monatstag:15, ab:'2026-10-01' }, '2026-09-15', false],
        [{ typ:'monat', monatstag:15, ab:'2026-10-01' }, '2026-10-15', true],
        /* Start mitten in der Woche: der Tag davor bleibt aus, der Tag
           danach zählt bereits zur ersten Intervallwoche.            */
        [{ typ:'woche', tage:[0,4], intervall:2, ab:'2026-09-02' }, '2026-08-31', false],
        [{ typ:'woche', tage:[0,4], intervall:2, ab:'2026-09-02' }, '2026-09-04', true],
        [{ typ:'woche', tage:[0,4], intervall:2, ab:'2026-09-02' }, '2026-09-11', false],
        [{ typ:'woche', tage:[0,4], intervall:2, ab:'2026-09-02' }, '2026-09-14', true],
      ];
      let f = 0;
      F.forEach(function (x) {
        if (fn(x[0], x[1]) !== x[2]) {
          f++; fail('Startdatum: ' + x[1] + ' ergibt ' + fn(x[0], x[1]));
        }
      });
      if (!f) { ok(F.length + ' Fälle mit Startdatum korrekt'); }
    }
  }

  const mR = JSK.match(/function rhRender\(\) \{([\s\S]*?)\n\}/);
  if (mR && /rh-ab/.test(mR[1])) { ok('Startdatum ist im Dialog zu setzen'); }
  else { fail('Startdatum lässt sich nicht setzen'); }

  const mM = JSK.match(/function rhMerken\(\) \{([\s\S]*?)\n\}/);
  /* Nicht nur pruefen, ob geprueft wird — sondern ob das Ergebnis der
     Pruefung auch die Zuweisung bewacht.                             */
  if (mM && /if \(v\) \{ rhEntwurf\.ab = v; \}/.test(mM[1])) {
    ok('Startdatum wird geprüft und nur Gültiges übernommen');
  } else { fail('unsinniges Startdatum würde übernommen'); }
  const mSp = JSK.match(/function rhSpeichern\(\) \{([\s\S]*?)\n\}/);
  if (mSp && /rhAbFehler/.test(mSp[1])) { ok('falsches Startdatum verhindert das Speichern'); }
  else { fail('falsches Startdatum wird stillschweigend verworfen'); }

  const mMig = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}/);
  if (mMig && /tage\[0\] < w\.ab/.test(mMig[1])) {
    ok('Migration schützt bereits erfasste Häkchen');
  } else { fail('erfasste Häkchen lägen nach der Umstellung vor dem Start'); }
  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 12) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 35 · Wochenblatt: Datumsspalte und Zeilenhöhe ════════════════════
   Fehlerarten: die Jahrestermine stehen als Kästen im Inhaltsbereich,
   verdrängen die eigenen Einträge und überschneiden deren Kästchen; die
   Datumsspalte ist zu schmal für die Termintitel; die Tagzeile fasst
   weniger als vier Einträge und schneidet die letzten an.
   ═══════════════════════════════════════════════════════════════════════ */
kat('35 · Wochenblatt');
{
  const css = H.slice(H.indexOf('<style>'), H.indexOf('</style>'));
  const mT = /^\.wo-t \{([^}]*)\}/m.exec(css);
  if (!mT) { fail('.wo-t nicht gefunden'); }
  else {
    const m = /min-height:\s*(\d+)px/.exec(mT[1]);
    const hoehe = m ? parseInt(m[1], 10) : 0;
    if (hoehe >= 104) { ok('Tagzeile fasst vier Einträge (' + hoehe + ' px)'); }
    else { fail('Tagzeile nur ' + hoehe + ' px — vier Einträge passen nicht'); }
    /* Sieben Tagzeilen plus Kopf, Wichtig-Block und Reflexion müssen ins
       Blatt passen, sonst scrollt die Woche.                          */
    const ges = 52 + hoehe * 7 + 100 + 120 + 24;
    if (ges <= 1052) { ok('Wochenblatt bleibt ohne Scrollbalken (' + ges + ' px)'); }
    else { warn('Wochenblatt scrollt um ' + (ges - 1052) + ' px'); }
  }

  const mN = /^\.wo-nr \{([^}]*)\}/m.exec(css);
  if (mN) {
    const m = /width:\s*(\d+)px/.exec(mN[1]);
    const b = m ? parseInt(m[1], 10) : 0;
    if (b >= 150) { ok('Datumsspalte ' + b + ' px breit'); }
    else { fail('Datumsspalte nur ' + b + ' px — Termintitel passen nicht'); }
  } else { fail('.wo-nr nicht gefunden'); }

  const mW = JSK.match(/function blattWoche\(\) \{([\s\S]*?)\n\}/);
  if (!mW) { fail('blattWoche nicht auswertbar'); }
  else {
    /* Das Band gehört in die Datumsspalte, nicht in den Inhalt */
    const i1 = mW[1].indexOf("'</div>' + band + '</span>'");
    const i2 = mW[1].indexOf('wo-dat');
    if (mW[1].indexOf('wo-jd') !== -1 && i1 !== -1 && i2 !== -1 && i1 > i2) {
      ok('Jahrestermine stehen unter dem Datum');
    } else { fail('Jahrestermine stehen noch im Inhaltsbereich'); }
    if (!/wo-jt-a|JT_ARTEN\[j\.art\]/.test(mW[1])) {
      ok('keine Kategorie und kein Kasten am Termin');
    } else { fail('Termin trägt weiterhin Kategorie oder Kasten'); }
  }

  const mJ = /^\.wo-jd \{([^}]*)\}/m.exec(css);
  const mD = /^\.wo-dat \{([^}]*)\}/m.exec(css);
  if (mJ && mD) {
    const g1 = /font-size:\s*([\d.]+)px/.exec(mJ[1]);
    const g2 = /font-size:\s*([\d.]+)px/.exec(mD[1]);
    if (g1 && g2 && g1[1] === g2[1]) { ok('Termin so groß wie das Datum'); }
    else { fail('Termin und Datum verschieden groß'); }
    if (!/background/.test(mJ[1])) { ok('kein Hintergrund am Termin'); }
    else { fail('Termin hat einen Hintergrund'); }
  } else { fail('.wo-jd oder .wo-dat nicht gefunden'); }
}

/* ═══ 36 · Termine aus Woche und Monat im Kalender ═════════════════════
   Fehlerarten: ein auf dem Wochenblatt erfasster Termin bleibt dort
   liegen und erscheint nie im Tagesblatt; ein Termin ohne Uhrzeit ist im
   Zeitraster unsichtbar statt ganztägig; beim Löschen des Eintrags bleibt
   der Termin als Leiche im Kalender; eine unsinnige Uhrzeit wird
   stillschweigend zu 'NaN:NaN'.
   ═══════════════════════════════════════════════════════════════════════ */
kat('36 · Termine aus Woche und Monat');
{
  if (/function zeitZuMin\b/.test(JS)) { ok('zeitZuMin vorhanden'); }
  else { fail('zeitZuMin fehlt'); }

  const mZ = JSK.match(/function zeitZuMin\(t\) \{[\s\S]*?\n\}/);
  if (mZ) {
    let fn = null;
    try { fn = new Function(mZ[0] + '\nreturn zeitZuMin;')(); } catch (e) { fn = null; }
    if (!fn) { fail('zeitZuMin nicht auswertbar'); }
    else {
      const F = [['09:30', 570], ['9:30', 570], ['0930', 570], ['23:59', 1439],
                 ['24:00', null], ['09:60', null], ['', null], ['abc', null]];
      let f = 0;
      F.forEach(function (x) {
        if (fn(x[0]) !== x[1]) { f++; fail('zeitZuMin("' + x[0] + '") = ' + fn(x[0])); }
      });
      if (!f) { ok(F.length + ' Zeitangaben korrekt geprüft'); }
    }
  }

  const mS = JSK.match(/function eintragSpeichern\(\) \{([\s\S]*?)\n\}/);
  if (!mS) { fail('eintragSpeichern nicht auswertbar'); }
  else {
    const t = mS[1];
    if (/TERMINE\.push\(t\)/.test(t)) { ok('der Eintrag legt einen echten Termin an'); }
    else { fail('Wochentermin bleibt auf dem Wochenblatt liegen'); }
    if (/refArt:'termin'/.test(t)) { ok('der Wocheneintrag ist ein Verweis darauf'); }
    else { fail('kein Verweis — Woche und Tag laufen auseinander'); }
    if (/t\.ganztags = \(min === null\)/.test(t)) {
      ok('ohne Uhrzeit wird der Termin ganztägig');
    } else { fail('ein Termin ohne Uhrzeit wäre im Raster unsichtbar'); }
    if (/min === null\) \{ melde/.test(t)) { ok('unsinnige Uhrzeit wird abgewiesen'); }
    else { fail('unsinnige Uhrzeit würde übernommen'); }
    /* Der Monat kennt keine datierten Ereignisse mehr — er gliedert
       nach Wochen. Datiertes gehört in den Kalender.                 */
    if (!/k\.art === 'ereignis'/.test(t)) { ok('der Monat kennt keine Ereignisse mehr'); }
    else { fail("'ereignis' ist noch im Dialog"); }
  }

  /* Beide Blätter müssen den Verweis auflösen können */
  ['wocheText', 'monatText'].forEach(function (n) {
    const m = JSK.match(new RegExp('function ' + n + '\\(e\\) \\{([\\s\\S]*?)\\n\\}'));
    if (m && /e\.refArt === 'termin'/.test(m[1])) { ok(n + ' löst Terminverweise auf'); }
    else { fail(n + ' zeigt bei einem Terminverweis nichts an'); }
  });

  const mL = JSK.match(/function eintragLoeschen\(\) \{([\s\S]*?)\n\}/);
  if (mL && /TERMINE\.splice/.test(mL[1])) {
    ok('Löschen räumt den Termin mit weg');
  } else { fail('gelöschter Eintrag lässt den Termin im Kalender zurück'); }

  const mO = JSK.match(/function eintragOeffnen\(blatt, tag, id, montag\) \{([\s\S]*?)\n\}/);
  if (mO && /e\.refArt === 'termin'/.test(mO[1])) {
    ok('ein bestehender Termin wird zum Bearbeiten geladen');
  } else { fail('Terminverweis lässt sich nicht bearbeiten'); }
}

/* ═══ 37 · Begriffe in der Oberfläche ══════════════════════════════════
   Fehlerart: dieselbe Sache heißt an verschiedenen Stellen verschieden,
   oder ein Wort meint zweierlei. "Vorgang" war zugleich Sammelbegriff
   und Name der wiederkehrenden Einträge — das war der Auslöser.
   ═══════════════════════════════════════════════════════════════════════ */
kat('37 · Begriffe in der Oberfläche');
{
  /* Auf das Wort mit Wortgrenzen prüfen statt zu versuchen, Strings
     herauszuschneiden: eine Paarung von Anführungszeichen verrutscht,
     sobald ein maskiertes Apostroph dazwischen steht. Bezeichner wie
     bereichGruppe fallen durch die Wortgrenze von selbst heraus.     */
  const quelle = JSK + ' ' + HTMLTEIL.replace(/\/\*[\s\S]*?\*\//g, '');

  if (!/\bVorgang\b|\bVorgänge\b|Vorg\\u00e4nge/.test(quelle)) {
    ok('"Vorgang" kommt in der Oberfläche nicht mehr vor');
  } else { fail('"Vorgang" ist noch in der Oberfläche'); }

  if (!/\bGruppe\b|\bGruppen\b|\bGruppenr?\b/.test(quelle)) {
    ok('"Gruppe" kommt in der Oberfläche nicht mehr vor');
  } else { fail('"Gruppe" steht noch in sichtbaren Texten'); }

  if (/Sph\\u00e4re|Sphäre/.test(quelle)) { ok('"Sphäre" wird verwendet'); }
  else { fail('"Sphäre" fehlt'); }

  /* Die Anleitung muss die Begriffe erklären */
  const mI = JS.match(/const SAAT_INFOSEITEN = \[([\s\S]*?)\n\];/);
  if (!mI) { fail('SAAT_INFOSEITEN nicht gefunden'); }
  else {
    const mT = /text:'((?:[^'\\]|\\.)*)'/.exec(mI[1]);
    const txt = mT ? mT[1].replace(/\\n/g, '\n').replace(/\\'/g, "'")
                          .replace(/\\\\/g, '\\') : '';
    const BEGRIFFE = ['Sphäre', 'Bereich', 'Aktivität', 'Plan', 'Ziel', 'Termin'];
    const fehlt = BEGRIFFE.filter(b => txt.indexOf('**' + b + '**') === -1);
    if (!fehlt.length) { ok('alle sechs Begriffe sind in der Anleitung erklärt'); }
    else { fail('in der Anleitung nicht erklärt: ' + fehlt.join(', ')); }
    if (txt.indexOf('Vorgang') === -1) { ok('Anleitung ohne "Vorgang"'); }
    else { fail('Anleitung nennt noch "Vorgang"'); }
  }
}

/* ═══ 38 · Sphären, Kartenreiter, Zielbindung ══════════════════════════
   Fehlerarten: dreizehn Bereiche als senkrechte Laschen — unlesbar; ein
   Ziel hängt an einem Bereich, obwohl es mehrere überspannt; die Wahl des
   Kartenreiters geht beim Wechsel der Lasche verloren; die Migration
   lässt Ziele ohne Sphäre zurück.
   ═══════════════════════════════════════════════════════════════════════ */
kat('38 · Sphären und Kartenreiter');
{
  ['reiterBereiche', 'zeigeBereich', 'bereichOffen', 'sphWahl', 'sphSetzen',
   'sphName', 'sphFarbe', 'ersteSphaere']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  const mU = JSK.match(/function renderUnterreiter\(\) \{([\s\S]*?)\n\}/);
  if (mU && /reiterBereiche\(\)/.test(mU[1]) && /zeigeBereich/.test(mU[1])) {
    ok('Bereiche erscheinen als Kartenreiter über dem Blatt');
  } else { fail('Bereiche stehen nicht als Kartenreiter'); }

  /* Die Wahl muss je Lasche getrennt gemerkt werden */
  const mK = JSK.match(/function bereichReiterKey\(\) \{([\s\S]*?)\n\}/);
  if (mK && /reg \+ ':'/.test(mK[1])) {
    ok('Kartenreiterwahl wird je Lasche gemerkt');
  } else { fail('Wechsel der Lasche vergisst den gewählten Bereich'); }

  /* Blätter und Übertrag müssen den Kartenreiter beachten */
  ['blattAktivitaeten', 'blattNotiz', 'uebertragKandidaten'].forEach(function (n) {
    const m = JSK.match(new RegExp('function ' + n + '\\(\\) \\{([\\s\\S]*?)\\n\\}'));
    if (m && /bereichOffen\(\)/.test(m[1])) { ok(n + ' beachtet den Kartenreiter'); }
    else { fail(n + ' zeigt trotz Kartenreiter alles'); }
  });

  /* Ziele an der Sphäre */
  const mZ = JS.match(/const SAAT_ZIELE = \[([\s\S]*?)\n\];/);
  if (mZ && /sphaere:'g\d'/.test(mZ[1]) && !/\bb:'b\d'/.test(mZ[1])) {
    ok('Ziele tragen eine Sphäre statt eines Bereichs');
  } else { fail('Ziele hängen noch an einem Bereich'); }
  const mUe = JSK.match(/function blattZielUebersicht\(\) \{([\s\S]*?)\n\}/);
  if (mUe && /GRUPPEN\.forEach/.test(mUe[1])) {
    ok('Zielübersicht gruppiert nach Sphäre');
  } else { fail('Zielübersicht gruppiert noch nach Bereich'); }

  const mG = JS.match(/const SAAT_GRUPPEN = \[([\s\S]*?)\n\];/);
  if (mG && /farbe:'#/.test(mG[1])) { ok('Sphären tragen eine Farbe'); }
  else { fail('Sphären ohne Farbe — Ziele hätten keine'); }

  const mM = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}/);
  if (mM && /z\.sphaere === undefined/.test(mM[1]) && /delete z\.b/.test(mM[1])) {
    ok('Migration hängt Ziele an die Sphäre ihres bisherigen Bereichs');
  } else { fail('Migration lässt Ziele ohne Sphäre'); }
  if (mM && /!g\.farbe/.test(mM[1])) { ok('Migration ergänzt Sphärenfarben'); }
  else { fail('Migration ergänzt keine Farben'); }
  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 13) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 39 · Unterlagen an Plan und Ziel ═════════════════════════════════
   Fehlerarten: ein Plan hat keinen Ort für Unterlagen; der Verweis liegt
   an der Notiz statt am Plan und ein Blatt kann dadurch nur zu einem
   Vorhaben gehören; der Verweis führt nicht zum Blatt; das Entfernen des
   Verweises löscht die Notiz.
   ═══════════════════════════════════════════════════════════════════════ */
kat('39 · Unterlagen an Plan und Ziel');
{
  ['unAbschnitt', 'unWahl', 'unSchalten', 'unLoesen', 'notizSpringen', 'unTraeger']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  /* Der Verweis gehört an Plan und Ziel, nicht an die Notiz */
  const mN = JS.match(/const SAAT_NOTIZEN = \[([\s\S]*?)\n\];/);
  if (mN && !/plaene:|zielId/.test(mN[1])) { ok('die Notiz kennt ihre Vorhaben nicht'); }
  else { fail('Verweis liegt an der Notiz — sie gehörte dann nur zu einem Vorhaben'); }

  const mM = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}/);
  if (mM && /Array\.isArray\(x\.notizen\)/.test(mM[1])) {
    ok('Migration ergänzt die Unterlagenliste');
  } else { fail('Migration ergänzt notizen nicht'); }

  ['blattPlan', 'blattZiel'].forEach(function (n) {
    const m = JSK.match(new RegExp('function ' + n + '\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}'));
    if (m && /unAbschnitt\(/.test(m[1])) { ok(n + ': Unterlagen sichtbar'); }
    else { fail(n + ': kein Ort für Unterlagen'); }
  });

  const mA = JSK.match(/function unAbschnitt\(art, id\) \{([\s\S]*?)\n\}/);
  if (mA && /notizSpringen\(/.test(mA[1])) { ok('der Verweis führt zum Blatt'); }
  else { fail('der Verweis führt nirgendwohin'); }

  /* Entfernen darf nur die Zuordnung lösen */
  const mL = JSK.match(/function unLoesen\(art, id, nid\) \{([\s\S]*?)\n\}/);
  if (mL && /o\.notizen\.splice/.test(mL[1]) && !/NOTIZEN\.splice/.test(mL[1])) {
    ok('Entfernen löst nur die Zuordnung');
  } else { fail('Entfernen löscht das Notizblatt'); }

  /* Der Sprung muss die richtige Lasche öffnen, sonst ist das Blatt
     zwar aufgeschlagen, aber nicht erreichbar.                       */
  const mS = JSK.match(/function notizSpringen\(nid\) \{([\s\S]*?)\n\}/);
  if (mS && /unterAktiv\.db =/.test(mS[1]) && /notizOffen = nid/.test(mS[1])) {
    ok('der Sprung öffnet Lasche und Blatt');
  } else { fail('der Sprung landet auf dem falschen Register'); }

  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 14) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 40 · Wochenzuordnung setzt das Planungsdatum ═════════════════════
   Fehlerart: eine Aufgabe wird auf einen Wochentag gelegt, aber ihr
   geplant-Feld bleibt leer. Sie steht dann nur auf dem Wochenblatt —
   weder im Tagesblatt noch als geplant in der Checkliste. Dasselbe beim
   Zuordnen einer vorhandenen Aktivität und beim Verschieben auf einen
   anderen Tag.
   ═══════════════════════════════════════════════════════════════════════ */
kat('40 · Wochenzuordnung und Planungsdatum');
{
  const mS = JSK.match(/function eintragSpeichern\(\) \{([\s\S]*?)\n\}/);
  if (!mS) { fail('eintragSpeichern nicht auswertbar'); }
  else {
    /* Neue Aufgabe: geplant muss aus dem gewählten Tag kommen */
    const auf = mS[1].slice(mS[1].indexOf("k.art === 'aufgabe'"));
    if (/geplant:\(k\.tag >= 0\) \? isoPlus\(b\.montag, k\.tag\) : null/.test(auf)) {
      ok('neue Aufgabe wird auf den gewählten Tag geplant');
    } else { fail('neue Aufgabe bleibt ohne Planungsdatum'); }

    /* Verschieben eines Verweises zieht das Datum mit */
    const verw = mS[1].slice(mS[1].indexOf("k.art === 'verweis'"));
    if (/a\.geplant = \(k\.tag >= 0\)/.test(verw)) {
      ok('Verschieben auf einen anderen Tag ändert das Planungsdatum');
    } else { fail('verschobene Aufgabe bleibt auf dem alten Tag geplant'); }
  }

  const mN = JSK.match(/function wahlNehmen\(art, id, tag\) \{([\s\S]*?)\n\}/);
  if (mN && /za\.geplant = isoPlus\(b\.montag, tag\)/.test(mN[1])) {
    ok('zugeordnete Aktivität wird auf den Tag geplant');
  } else { fail('über die Auswahlliste zugeordnete Aktivität bleibt ungeplant'); }

  /* Ohne festen Tag darf kein Datum entstehen */
  if (mS && /: null/.test(mS[1])) { ok('ohne festen Tag bleibt geplant leer'); }
  else { warn('kein erkennbarer Fall für "ohne festen Tag"'); }
}

/* ═══ 41 · Bereiche anlegen und entfernen ══════════════════════════════
   Fehlerarten: Bereiche lassen sich weder anlegen noch löschen; das
   Löschen reißt Aktivitäten, Pläne und Notizblätter mit oder lässt sie
   heimatlos zurück; ein belegter Bereich verschwindet ohne Rückfrage.
   ═══════════════════════════════════════════════════════════════════════ */
kat('41 · Bereiche anlegen und entfernen');
{
  ['bereichNeu', 'bereichLoeschen', 'bereichInhalt', 'bereichBelegt',
   'bereichFragen', 'bereichLoeschZeile']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  const mG = JSK.match(/function gruppenRender\(\) \{([\s\S]*?)\n\}/);
  if (mG && /bereichNeu\(/.test(mG[1])) { ok('Bereich lässt sich anlegen'); }
  else { fail('kein Weg, einen Bereich anzulegen'); }
  if (mG && /bereichFragen\(/.test(mG[1])) { ok('Bereich lässt sich löschen'); }
  else { fail('kein Weg, einen Bereich zu löschen'); }

  /* Das Verschieben wirklich rechnen */
  const mI = JSK.match(/function bereichInhalt\(bid\) \{[\s\S]*?\n\}/);
  const mB = JSK.match(/function bereichBelegt\(bid\) \{[\s\S]*?\n\}/);
  const mL = JSK.match(/function bereichLoeschen\(bid, zielId\) \{[\s\S]*?\n\}/);
  if (!mI || !mB || !mL) { fail('Löschlogik nicht auswertbar'); }
  else {
    let bau = null;
    try {
      bau = new Function(
        'let AKTIVITAETEN=[],PLAENE=[],WIEDER=[],NOTIZEN=[],BEREICHE=[];' +
        'const melde=()=>{}; const gruppenRender=()=>{}; let brFrage=null;' +
        'const bName=()=>"x";' +
        mI[0] + '\n' + mB[0] + '\n' + mL[0] + '\n' +
        'return { setze:function(a,p,w,n,b){AKTIVITAETEN=a;PLAENE=p;WIEDER=w;' +
        'NOTIZEN=n;BEREICHE=b;},' +
        ' belegt:function(id){return bereichBelegt(id);},' +
        ' loesche:function(id,z){bereichLoeschen(id,z);},' +
        ' stand:function(){return {a:AKTIVITAETEN.map(x=>x.b),p:PLAENE.map(x=>x.b),' +
        'w:WIEDER.map(x=>x.b),n:NOTIZEN.map(x=>x.b),b:BEREICHE.map(x=>x.id)};} };')();
    } catch (e) { bau = null; }
    if (!bau) { fail('Löschlogik nicht ausführbar'); }
    else {
      let f = 0;
      const setze = () => bau.setze(
        [{ b:'b1' }, { b:'b1' }, { b:'b2' }], [{ b:'b1' }], [{ b:'b1' }], [{ b:'b3' }],
        [{ id:'b1' }, { id:'b2' }, { id:'b3' }]);
      setze();
      if (bau.belegt('b1') !== 4) { f++; fail('Inhaltszählung falsch: ' + bau.belegt('b1')); }
      bau.loesche('b1', null);
      if (bau.stand().b.length !== 3) { f++; fail('belegter Bereich ohne Ziel gelöscht'); }
      bau.loesche('b1', 'b2');
      const st = bau.stand();
      if (st.b.indexOf('b1') !== -1) { f++; fail('Bereich nicht entfernt'); }
      if (st.a.join() !== 'b2,b2,b2') { f++; fail('Aktivitäten nicht verschoben: ' + st.a); }
      if (st.p.join() !== 'b2' || st.w.join() !== 'b2') { f++; fail('Pläne oder Wiederkehrende verloren'); }
      if (st.n.join() !== 'b3') { f++; fail('fremde Notiz mitverschoben'); }
      if (!f) { ok('Löschen verschiebt allen Inhalt und verliert nichts'); }
    }
  }

  const mZ = JSK.match(/function bereichLoeschZeile\(b\) \{([\s\S]*?)\n\}/);
  if (mZ && /andere\.length/.test(mZ[1])) {
    ok('ohne Ausweichbereich wird das Löschen verweigert');
  } else { fail('Inhalt könnte heimatlos werden'); }
}

/* ═══ 42 · Bereichsreiter schlank und zweireihig ═══════════════════════
   Fehlerarten: Farbpunkt und Zähler blähen die Reiter, sodass sie eine
   dritte Reihe brauchen und das Blatt schrumpft; ein zu langer Name
   sprengt die Leiste.
   ═══════════════════════════════════════════════════════════════════════ */
kat('42 · Bereichsreiter');
{
  const mU = JSK.match(/function renderUnterreiter\(\) \{([\s\S]*?)\n\}/);
  if (!mU) { fail('renderUnterreiter nicht auswertbar'); }
  else {
    const teil = mU[1].slice(0, mU[1].indexOf('const l = unterListe'));
    if (!/tz-punkt/.test(teil)) { ok('Bereichsreiter ohne Farbpunkt'); }
    else { fail('Farbpunkt noch am Bereichsreiter'); }
    if (!/ur-zahl/.test(teil)) { ok('Bereichsreiter ohne Zähler'); }
    else { fail('Zähler noch am Bereichsreiter'); }
  }

  const css = H.slice(H.indexOf('<style>'), H.indexOf('</style>'));
  const mL = /^\.unterreiter \{([^}]*)\}/m.exec(css);
  if (!mL) { fail('.unterreiter nicht gefunden'); }
  else {
    if (/flex-wrap:\s*wrap/.test(mL[1])) { ok('Leiste bricht um'); }
    else { fail('Leiste bricht nicht um — Reiter laufen aus dem Blatt'); }
    const m = /max-height:\s*(\d+)px/.exec(mL[1]);
    const hoehe = m ? parseInt(m[1], 10) : 0;
    if (hoehe && hoehe <= 80) { ok('Leiste höchstens zwei Reihen (' + hoehe + ' px)'); }
    else { fail('Leiste ohne Höhenbegrenzung'); }
  }

  /* Die Kürzung muss so knapp sein, dass elf Bereiche in zwei Reihen
     passen — sonst braucht die Leiste eine dritte.                   */
  const mK = JSK.match(/function kurzReiter\(n\) \{[\s\S]*?\n\}/);
  if (!mK) { fail('kurzReiter nicht auswertbar'); }
  else {
    let fn = null;
    try { fn = new Function(mK[0] + '\nreturn kurzReiter;')(); } catch (e) { fn = null; }
    if (!fn) { fail('kurzReiter nicht ausführbar'); }
    else {
      const NAMEN = ['Alle', 'Organisatorische Aufgaben', 'SMAX: Gitlab Ablöse',
        'Last- und Performance', 'Hybride Tests', 'User Journey QS', 'F TO Analyse',
        'Auslieferungen 20.0x', 'Einführung Windows 11 26H2', 'Update-Termine 2026',
        'Sonstiges'];
      const platz = 734;
      let reihe = 0, zeilen = 1;
      NAMEN.forEach(function (t) {
        const b = fn(t).length * 7.1 + 27;
        if (reihe + b > platz) { zeilen++; reihe = b; } else { reihe += b; }
      });
      if (zeilen <= 2) { ok('elf Bereiche passen in zwei Reihen'); }
      else { fail('elf Bereiche brauchen ' + zeilen + ' Reihen'); }
      if (fn('Kurz') === 'Kurz') { ok('kurze Namen bleiben unangetastet'); }
      else { fail('kurze Namen werden verstümmelt'); }
    }
  }
}

/* ═══ 43 · Abschnittskopf und Gliederung nach Plänen ═══════════════════
   Fehlerarten: der Abschnittskopf maskiert seinen Zusatz immer, wodurch
   ein Knopf als Markup im Blatt steht; die Gliederung nach Plänen
   verschluckt Aktivitäten oder zeigt sie doppelt; eine Aktivität eines
   archivierten Plans verschwindet aus der Liste.
   ═══════════════════════════════════════════════════════════════════════ */
kat('43 · Abschnittskopf und Gliederung');
{
  /* Der Kopf muss Markup durchlassen, aber Text weiterhin maskieren */
  const mA = JSK.match(/function abschnitt\(titel, sub\) \{[\s\S]*?\n\}/);
  if (!mA) { fail('abschnitt nicht auswertbar'); }
  else {
    let fn = null;
    try {
      fn = new Function('esc', mA[0] + '\nreturn abschnitt;')(
        t => String(t == null ? '' : t).replace(/&/g, '&amp;')
              .replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    } catch (e) { fn = null; }
    if (!fn) { fail('abschnitt nicht ausführbar'); }
    else {
      let f = 0;
      if (fn('X', '<button>A</button>').indexOf('<button>A</button>') === -1) {
        f++; fail('Knopf im Abschnittskopf wird maskiert');
      }
      if (fn('X', 'a < b').indexOf('&lt;') === -1) {
        f++; fail('Text im Abschnittskopf wird nicht maskiert');
      }
      if (fn('X', '').indexOf('ab-sub') !== -1) {
        f++; fail('leerer Zusatz erzeugt eine Hülle');
      }
      if (!f) { ok('Abschnittskopf: Markup durch, Text maskiert'); }
    }
  }

  if (/function planGliederung\b/.test(JS)) { ok('planGliederung vorhanden'); }
  else { fail('planGliederung fehlt'); }

  const mB = JSK.match(/function blattAktivitaeten\(\) \{([\s\S]*?)\n\}/);
  if (!mB) { fail('blattAktivitaeten nicht auswertbar'); }
  else {
    if (/if \(!nachPlan\)/.test(mB[1])) { ok('Gliederung ist umschaltbar'); }
    else { fail('Gliederung nach Plänen fehlt'); }
    /* Eine Aktivität eines archivierten Plans darf nicht verschwinden */
    if (/!PLAENE\.some\(p => p\.id === a\.planId && !p\.archiviert\)/.test(mB[1])) {
      ok('Aktivität eines archivierten Plans bleibt sichtbar');
    } else { fail('Aktivität eines archivierten Plans fällt aus der Liste'); }
    if (/\(x\.pos \|\| 0\) - \(y\.pos \|\| 0\)/.test(mB[1])) {
      ok('Planzeilen folgen ihrem Rang');
    } else { fail('Planzeilen ignorieren den Rang'); }
    /* Genau eine Zeilenfunktion, damit flach und gegliedert gleich aussehen */
    const n = (mB[1].match(/hakFeld\(a\.glyph/g) || []).length;
    if (n === 1) { ok('eine Zeilenfunktion für beide Gliederungen'); }
    else { fail(n + ' Zeilenaufbauten — sie laufen auseinander'); }
  }
}

/* ═══ 44 · Spaltenzahl der Checkliste ══════════════════════════════════
   Fehlerarten: die Bereichsspalte entfällt in der Plangliederung, aber
   Kopfzeile, Zusammenfassungszeilen oder Leerzeilen zählen weiter neun —
   die Tabelle verrutscht dann um eine Spalte. Und: der Planpfeil steht
   an jeder Zeile, obwohl der Plan schon in der Überschrift darüber steht.
   ═══════════════════════════════════════════════════════════════════════ */
kat('44 · Spaltenzahl der Checkliste');
{
  const mB = JSK.match(/function blattAktivitaeten\(\) \{([\s\S]*?)\n  \$\('blatt'\)/);
  if (!mB) { fail('blattAktivitaeten nicht auswertbar'); }
  else {
    const t = mB[1];
    if (/const sp = nachPlan \? 8 : 9;/.test(t)) { ok('Spaltenzahl hängt an der Gliederung'); }
    else { fail('Spaltenzahl fest verdrahtet'); }

    /* Keine feste 9 mehr — sonst verrutscht die Tabelle */
    if (!/colspan="9"/.test(t)) { ok('keine feste colspan-Angabe'); }
    else { fail('colspan="9" trotz acht Spalten in der Plangliederung'); }
    const feste = (t.match(/colspan="\d+"/g) || []);
    if (!feste.length) { ok('alle Zusammenfassungszeilen rechnen mit sp'); }
    else { fail('feste colspan: ' + feste.join(', ')); }

    /* Die Zellenzahl je Datenzeile muss zu sp passen */
    const mZ = t.match(/const zeile = function \(a\) \{([\s\S]*?)\n  \};/);
    if (mZ && /nachPlan \? '' :\s*\n?\s*'<td class="mitte z" onclick="bereichWeiter/.test(mZ[1])) {
      ok('Bereichsspalte entfällt in der Plangliederung');
    } else { fail('Bereichsspalte bleibt und sprengt die Zeile'); }

    /* Kopfzeile ebenso */
    if (/<thead><tr><th><\/th>' \+ \(nachPlan \? '' : '<th><\/th>'\)/.test(t)) {
      ok('Kopfzeile folgt der Spaltenzahl');
    } else { fail('Kopfzeile hat immer neun Spalten'); }

    /* Leerzeilen dürfen nicht neun Zellen fest ausgeben */
    if (/'<td><\/td>'\.repeat\(sp\)/.test(t)) { ok('Leerzeilen folgen der Spaltenzahl'); }
    else { fail('Leerzeilen mit fester Zellenzahl'); }
  }

  const mP = JSK.match(/function planPfeilZelle\(a, ohnePfeil\) \{([\s\S]*?)\n\}/);
  if (mP && /if \(ohnePfeil\) \{ return inner; \}/.test(mP[1])) {
    ok('Planpfeil lässt sich unterdrücken');
  } else { fail('Planpfeil steht doppelt zum Überschriftstext'); }

  const css = H.slice(H.indexOf('<style>'), H.indexOf('</style>'));
  if (/\.atab tr\.ein td:first-child/.test(css)) { ok('Zeilen der Plangliederung sind eingerückt'); }
  else { fail('keine Einrückung in der Plangliederung'); }
}

/* ═══ 45 · Zeichnen auf dem Gerät ══════════════════════════════════════
   Fehlerart: touch-action allein hält Safari nicht davon ab, die Seite
   zu schieben — die Geste beginnt, bevor der Zeiger-Handler läuft. Und:
   misst man die Zeichenfläche, bevor das Bild eine Größe hat, bleibt sie
   null Pixel groß und lässt sich nie treffen.
   ═══════════════════════════════════════════════════════════════════════ */
kat('45 · Zeichnen auf dem Gerät');
{
  const mB = JSK.match(/function avZeigerBinden\(\) \{([\s\S]*?)\n\}/);
  if (!mB) { fail('avZeigerBinden nicht auswertbar'); }
  else {
    if (/\{ passive:false \}/.test(mB[1])) {
      ok('Touch-Ereignisse werden nicht passiv gebunden');
    } else { fail('passive Bindung — preventDefault richtet nichts aus'); }
    if (/touchstart/.test(mB[1]) && /touchmove/.test(mB[1])) {
      ok('touchstart und touchmove werden abgefangen');
    } else { fail('Touch-Ereignisse werden nicht abgefangen'); }
    if (/touchType === 'stylus'/.test(mB[1])) {
      ok('der Stift wird an der Berührungsart erkannt');
    } else { fail('Stift und Finger nicht unterscheidbar'); }
  }

  /* Im Zeichenbetrieb darf die Fläche nicht mehr rollen */
  const css = H.slice(H.indexOf('<style>'), H.indexOf('</style>'));
  if (/\.av-blatt\.zeichnen \{[^}]*overflow:\s*hidden/.test(css)) {
    ok('Blattfläche rollt im Zeichenbetrieb nicht');
  } else { fail('Blattfläche rollt weiter und verschiebt das Bild'); }
  if (/function avBlattModus/.test(JS)) { ok('avBlattModus vorhanden'); }
  else { fail('avBlattModus fehlt'); }
  const mS = JSK.match(/function avStiftUm\(\) \{([\s\S]*?)\n\}/);
  if (mS && /avBlattModus\(\)/.test(mS[1])) { ok('der Schalter stellt die Fläche fest'); }
  else { fail('der Schalter wirkt nicht auf die Fläche'); }

  /* Das Bild darf keine Zeiger schlucken */
  if (/\.av-blatt img \{[^}]*pointer-events:\s*none/.test(css)) {
    ok('das Bild nimmt keine Berührungen an');
  } else { fail('das Bild fängt Berührungen vor der Zeichenfläche ab'); }

  /* Erneuter Anlauf, wenn das Bild noch keine Größe hat */
  const mL = JSK.match(/function avLeinwandPassen\(versuch\) \{([\s\S]*?)\n\}/);
  if (mL && /requestAnimationFrame/.test(mL[1])) {
    ok('Zeichenfläche wird erneut gemessen, wenn das Bild noch fehlt');
  } else { fail('Zeichenfläche bleibt null Pixel groß'); }
}

/* ═══ 46 · Tagesnotizen ════════════════════════════════════════════════
   Fehlerarten: die Notiz vom Wochenblatt bleibt dort liegen und erreicht
   den Tag nie; sie wird zwar angelegt, aber nicht als Verweis geführt und
   läuft mit der Woche auseinander; beim Löschen bleibt ein Verweis ins
   Leere zurück.
   ═══════════════════════════════════════════════════════════════════════ */
kat('46 · Tagesnotizen');
{
  ['tagnotizNeu', 'tagnotizLoeschen'].forEach(function (f) {
    if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
    else { fail(f + ' fehlt'); }
  });

  const mS = JSK.match(/function saatDB\(\) \{([\s\S]*?)\n\}/);
  const mL = JSK.match(/function leereDB\(\) \{([\s\S]*?)\n\}/);
  if (mS && /tagnotizen:/.test(mS[1])) { ok('saatDB kennt tagnotizen'); }
  else { fail('tagnotizen fehlt in saatDB'); }
  if (mL && /tagnotizen:/.test(mL[1])) { ok('leereDB kennt tagnotizen'); }
  else { fail('tagnotizen fehlt in leereDB'); }
  const mU = JSK.match(/function dbUebernehmen\(neu\) \{([\s\S]*?)\n\}/);
  if (mU && /TAGNOTIZEN\s*=\s*DB\.tagnotizen/.test(mU[1])) { ok('dbUebernehmen setzt TAGNOTIZEN'); }
  else { fail('TAGNOTIZEN wird nicht neu gesetzt'); }

  const mE = JSK.match(/function eintragSpeichern\(\) \{([\s\S]*?)\n\}/);
  if (!mE) { fail('eintragSpeichern nicht auswertbar'); }
  else {
    if (/k\.art === 'notiz' && k\.tag >= 0/.test(mE[1])) {
      ok('Notiz mit Tag wird zur Tagesnotiz');
    } else { fail('Notiz bleibt auf dem Wochenblatt liegen'); }
    if (/refArt:'tagnotiz'/.test(mE[1])) { ok('der Wocheneintrag verweist darauf'); }
    else { fail('kein Verweis — Woche und Tag laufen auseinander'); }
  }

  const mT = JSK.match(/function blattTag\(\) \{([\s\S]*?)\n\}/);
  if (mT && /TAGNOTIZEN\.filter\(n => n\.datum === tagOffen\)/.test(mT[1])) {
    ok('Tagesblatt zeigt die Notizen');
  } else { fail('Notizen erscheinen nicht auf dem Tagesblatt'); }
  if (mT && /tagnotizNeu\(\)/.test(mT[1])) { ok('am Tag lassen sich Notizen ergänzen'); }
  else { fail('keine Möglichkeit, am Tag zu ergänzen'); }

  const mW = JSK.match(/function wocheText\(e\) \{([\s\S]*?)\n\}/);
  if (mW && /e\.refArt === 'tagnotiz'/.test(mW[1])) { ok('wocheText löst Notizverweise auf'); }
  else { fail('Wochenblatt zeigt bei einem Notizverweis nichts an'); }

  const mDel = JSK.match(/function tagnotizLoeschen\(id\) \{([\s\S]*?)\n\}/);
  if (mDel && /WOCHENBLAETTER\.forEach/.test(mDel[1])) {
    ok('Löschen räumt den Wochenverweis mit weg');
  } else { fail('gelöschte Notiz hinterlässt einen Verweis ins Leere'); }
  const mEL = JSK.match(/function eintragLoeschen\(\) \{([\s\S]*?)\n\}/);
  if (mEL && /TAGNOTIZEN\.findIndex/.test(mEL[1])) {
    ok('vom Wochenblatt gelöscht verschwindet auch die Tagesnotiz');
  } else { fail('Tagesnotiz bleibt als Leiche zurück'); }

  const mP = JSK.match(/function moveTagPdf\(\) \{([\s\S]*?)\n\}\n/);
  if (mP && /TAGNOTIZEN\.filter/.test(mP[1])) { ok('Notizen stehen im Move-PDF'); }
  else { fail('Notizen fehlen im Move-PDF'); }

  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 15) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 47 · Symbol für den Home-Bildschirm ══════════════════════════════
   Fehlerarten: kein apple-touch-icon — iOS nimmt dann einen Bildschirm-
   ausschnitt; nur ein data-URI, das ältere iOS-Fassungen ignorieren; die
   Datei-Verweise fehlen oder zeigen auf nicht mitgelieferte Größen.
   ═══════════════════════════════════════════════════════════════════════ */
kat('47 · Symbol für den Home-Bildschirm');
{
  const links = H.match(/<link rel="apple-touch-icon"[^>]*>/g) || [];
  if (links.length) { ok(links.length + ' apple-touch-icon-Verweise'); }
  else { fail('kein apple-touch-icon — iOS nimmt einen Bildschirmausschnitt'); }

  /* Mindestens ein Verweis auf eine echte Datei, nicht nur data-URI */
  const dateien = links.filter(l => /href="icon-\d+\.png"/.test(l));
  if (dateien.length >= 1) { ok(dateien.length + ' Verweise auf Symboldateien'); }
  else { fail('nur data-URI — ältere iOS-Fassungen zeigen dann nichts'); }

  const GROESSEN = ['180x180', '167x167', '152x152'];
  const fehlt = GROESSEN.filter(g => H.indexOf('sizes="' + g + '"') === -1);
  if (!fehlt.length) { ok('Größen für iPhone und iPad hinterlegt'); }
  else { warn('keine Angabe für: ' + fehlt.join(', ')); }

  if (/href="data:image\/png;base64,/.test(H)) {
    ok('eingebettetes Symbol als Rückfall');
  } else { warn('kein eingebettetes Symbol — die Datei allein bliebe ohne'); }

  if (/<meta name="apple-mobile-web-app-title"/.test(H)) { ok('Name für den Home-Bildschirm gesetzt'); }
  else { fail('ohne Titel steht der Dateiname unter dem Symbol'); }
  if (/<meta name="theme-color"/.test(H)) { ok('theme-color gesetzt'); }
  else { warn('keine theme-color'); }
}

/* ═══ 48 · Sicherung und Tagesblattaufbau ══════════════════════════════
   Fehlerarten: keine Erinnerung an die Sicherungsdatei — der Bestand ist
   weg, sobald iOS den Speicher abräumt; die Erinnerung kommt mehrmals am
   Tag; der Dateiname trägt ein Datum und es sammeln sich Dutzende
   Dateien; die interne Kopie wird nie erneuert.
   ═══════════════════════════════════════════════════════════════════════ */
kat('48 · Sicherung');
{
  ['sicherungPruefen', 'sicherungJetzt', 'sicherungSchreiben', 'sicherungLesen',
   'sicherungZurueck']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  const mP = JSK.match(/function sicherungPruefen\(\) \{([\s\S]*?)\n\}/);
  if (!mP) { fail('sicherungPruefen nicht auswertbar'); }
  else {
    if (/DB\.sicherung\.zuletzt === heute\) \{ return; \}/.test(mP[1])) {
      ok('höchstens einmal am Tag');
    } else { fail('die Erinnerung käme bei jedem Start'); }
    if (/sicherungSchreiben\(\)/.test(mP[1])) { ok('die interne Kopie wird beim Start erneuert'); }
    else { fail('die interne Kopie veraltet'); }
  }

  const mJ = JSK.match(/function sicherungJetzt\(\) \{([\s\S]*?)\n\}/);
  if (!mJ) { fail('sicherungJetzt nicht auswertbar'); }
  else {
    if (/'timeassist\.json'/.test(mJ[1])) { ok('eine Datei ohne Datumszusatz'); }
    else { fail('Dateiname mit Datum — es sammeln sich Dutzende'); }
    if (/DB\.sicherung\.zuletzt = isoHeute\(\)/.test(mJ[1])) {
      ok('der Stand wird vermerkt');
    } else { fail('ohne Vermerk fragt die App gleich wieder'); }
  }

  if (/setTimeout\(sicherungPruefen/.test(JSK)) { ok('Prüfung läuft beim Start'); }
  else { fail('Prüfung wird nie ausgelöst'); }

  /* Der Hinweis muss die Grenze benennen, sonst wiegt er in Sicherheit */
  const mD = JSK.match(/function datenAuf\(\) \{([\s\S]*?)\n\}/);
  if (mD && /r\\u00e4umt iOS diesen/.test(mD[1])) {
    ok('die Datenverwaltung benennt das Risiko');
  } else { fail('kein Hinweis auf den Verlust beim Entfernen der App'); }

  /* Tagesblatt: Chronik bis 22 Uhr, Notizen in der Terminspalte */
  const mT = JSK.match(/function blattTag\(\) \{([\s\S]*?)\n\}/);
  if (!mT) { fail('blattTag nicht auswertbar'); }
  else {
    if (/for \(let st = 6; st <= 22; st\+\+\)/.test(mT[1])) { ok('Chronik von 6 bis 22 Uhr'); }
    else { fail('Chronik nicht auf 6 bis 22 Uhr'); }
    if (/'6 \\u2013 22 Uhr'/.test(mT[1])) { ok('Beschriftung passt zum Raster'); }
    else { fail('Beschriftung und Raster laufen auseinander'); }
    /* Der Notizblock gehört in die linke Spalte */
    const iN = mT[1].indexOf('TAGNOTIZEN.filter');
    const iR = mT[1].indexOf("let rechts =");
    if (iN !== -1 && iR !== -1 && iN < iR) { ok('Notizen stehen in der Terminspalte'); }
    else { fail('Notizen stehen nicht in der Terminspalte'); }
    if (!/rechts \+= '<div class="abschnitt rf-block">' \+\s*\n\s*abschnitt\('Notizen'/.test(mT[1])) {
      ok('kein Notizblock mehr in der rechten Spalte');
    } else { fail('Notizblock steht doppelt'); }
  }

  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 16) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 49 · Aktualisierung ══════════════════════════════════════════════
   Fehlerarten: die App merkt nie, dass eine neue Fassung bereitsteht, und
   iOS liefert ewig die zwischengespeicherte alte; die Prüfung holt die
   Datei aus demselben Zwischenspeicher und vergleicht sich mit sich
   selbst; das Neuladen landet wieder auf der alten Fassung.
   ═══════════════════════════════════════════════════════════════════════ */
kat('49 · Aktualisierung');
{
  ['fassungPruefen', 'fassungLaden', 'fassungZu'].forEach(function (f) {
    if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
    else { fail(f + ' fehlt'); }
  });

  const mP = JSK.match(/function fassungPruefen\(laut\) \{([\s\S]*?)\n\}/);
  if (!mP) { fail('fassungPruefen nicht auswertbar'); }
  else {
    if (/cache:'no-store'/.test(mP[1])) { ok('die Prüfung umgeht den Zwischenspeicher'); }
    else { fail('die Prüfung liest aus dem Zwischenspeicher und findet nie etwas'); }
    if (/\?p=' \+ Date\.now\(\)/.test(mP[1])) { ok('zusätzlich ein Kennzeichen an der Adresse'); }
    else { warn('kein Kennzeichen an der Adresse'); }
    if (/APP_VERSION\\s\*=\\s\*'\(\[\^'\]\+\)'/.test(mP[1]) || /APP_VERSION/.test(mP[1])) {
      ok('die Fassung wird aus der Datei gelesen');
    } else { fail('kein Versionsvergleich'); }
    if (/\.catch\(function \(\) \{/.test(mP[1])) { ok('ohne Verbindung passiert nichts Schlimmes'); }
    else { fail('ohne Verbindung bricht die Prüfung sichtbar ab'); }
  }

  const mL = JSK.match(/function fassungLaden\(\) \{([\s\S]*?)\n\}/);
  if (mL && /location\.pathname \+ '\?v='/.test(mL[1])) {
    ok('Neuladen umgeht den Zwischenspeicher');
  } else { fail('Neuladen holt wieder die alte Fassung'); }

  if (/setTimeout\(function \(\) \{ fassungPruefen\(false\); \}/.test(JSK)) {
    ok('Prüfung läuft beim Start');
  } else { fail('Prüfung wird nie ausgelöst'); }
  /* Der Knopf steht im HTML, nicht im Skript */
  if (/fassungPruefen\(true\)/.test(H)) { ok('Prüfung auch von Hand auslösbar'); }
  else { fail('keine Prüfung von Hand'); }

  /* Die Anleitung muss den Weg beschreiben — sonst löscht man wieder */
  const mI = JS.match(/const SAAT_INFOSEITEN = \[([\s\S]*?)\n\];/);
  if (mI) {
    const mT = /text:'((?:[^'\\]|\\.)*)'/.exec(mI[1]);
    const txt = mT ? mT[1] : '';
    if (/Symbol nicht entfernen/.test(txt)) { ok('die Anleitung warnt vor dem Entfernen'); }
    else { fail('die Anleitung erklärt das Aktualisieren nicht'); }
  }
}

/* ═══ 50 · Datendialog: Knöpfe und Platz ══════════════════════════════
   Fehlerart: die Fußzeile eines Dialogs sammelt mit der Zeit Knöpfe an,
   bis sie nicht mehr hineinpassen und stillschweigend abgeschnitten
   werden. Ebenso: ein Knopf wird per Kennung umgebaut, obwohl der Dialog
   inzwischen neu gezeichnet wird — dann greift die Rückfrage ins Leere.
   ═══════════════════════════════════════════════════════════════════════ */
kat('50 · Datendialog');
{
  /* Die Fußzeile darf höchstens zwei Knöpfe tragen */
  const mD = /<div class="hg" id="daten"[\s\S]*?<div class="dlg-fuss">([\s\S]*?)<\/div>/
    .exec(HTMLTEIL);
  if (!mD) { fail('Datendialog nicht gefunden'); }
  else {
    const n = (mD[1].match(/<button/g) || []).length;
    if (n <= 2) { ok('Fußzeile mit ' + n + ' Knöpfen'); }
    else { fail(n + ' Knöpfe in der Fußzeile — sie passen nicht nebeneinander'); }
  }

  const mA = JSK.match(/function datenAuf\(\) \{([\s\S]*?)\n\}/);
  if (!mA) { fail('datenAuf nicht auswertbar'); }
  else {
    const GRUPPEN = ['Sichern', 'Einlesen', 'Programm'];
    const fehlt = GRUPPEN.filter(g => mA[1].indexOf('>' + g + '<') === -1);
    if (!fehlt.length) { ok('Knöpfe nach Zweck gruppiert'); }
    else { fail('Gruppe fehlt: ' + fehlt.join(', ')); }
    const AKTIONEN = ['datenExport()', 'datenExportVoll()', 'sicherungZurueck()',
                      'fassungPruefen(true)', 'datenLoeschenFragen()'];
    const ohne = AKTIONEN.filter(a => mA[1].indexOf(a) === -1);
    if (!ohne.length) { ok('alle ' + AKTIONEN.length + ' Aktionen erreichbar'); }
    else { fail('nicht erreichbar: ' + ohne.join(', ')); }
  }

  /* Die Rückfrage muss den Dialog neu zeichnen, nicht einen Knopf
     umbauen, den es nach dem Neuzeichnen nicht mehr gibt.            */
  const mL = JSK.match(/function datenLoeschenFragen\(\) \{([\s\S]*?)\n\}/);
  if (mL && /datenAuf\(\)/.test(mL[1]) && !/daten-loeschen/.test(mL[1])) {
    ok('Löschrückfrage zeichnet den Dialog neu');
  } else { fail('Löschrückfrage baut einen Knopf um, der neu gezeichnet wird'); }

  /* Die Breite muss zur längsten Knopfgruppe passen */
  const mB = /<div class="hg" id="daten"[\s\S]*?<div class="dlg" style="width:(\d+)px">/
    .exec(HTMLTEIL);
  if (!mB) { fail('Dialogbreite nicht gefunden'); }
  else {
    const innen = parseInt(mB[1], 10) - 36;
    const laengste = ['Exportieren', 'Mit Anhängen', 'Kopie zurück']
      .reduce(function (n, t) { return n + t.length * 7.2 + 32; }, 0);
    if (laengste <= innen) {
      ok('breiteste Gruppe passt in eine Zeile (' + Math.round(laengste) + ' von ' + innen + ' px)');
    } else { fail('Knopfgruppe bricht um: ' + Math.round(laengste) + ' von ' + innen + ' px'); }
  }
}

/* ═══ 51 · Journal ═════════════════════════════════════════════════════
   Fehlerarten: das Journal fehlt in saatDB oder leereDB und geht beim
   Übernehmen verloren; die Einträge stehen in der falschen Reihenfolge —
   ein Journal liest man von vorn; bei gleichem Datum entscheidet der
   Zufall; ein Eintrag lässt sich keinem Ziel zuordnen.
   ═══════════════════════════════════════════════════════════════════════ */
kat('51 · Journal');
{
  ['blattJournal', 'blattJournalEintrag', 'jNeu', 'jLoeschen', 'jSchreiben',
   'jListe', 'jZielWahl', 'zielName']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  const mS = JSK.match(/function saatDB\(\) \{([\s\S]*?)\n\}/);
  const mL = JSK.match(/function leereDB\(\) \{([\s\S]*?)\n\}/);
  if (mS && /journal:/.test(mS[1])) { ok('saatDB kennt journal'); }
  else { fail('journal fehlt in saatDB'); }
  if (mL && /journal:/.test(mL[1])) { ok('leereDB kennt journal'); }
  else { fail('journal fehlt in leereDB'); }
  const mU = JSK.match(/function dbUebernehmen\(neu\) \{([\s\S]*?)\n\}/);
  if (mU && /JOURNAL\s*=\s*DB\.journal/.test(mU[1])) { ok('dbUebernehmen setzt JOURNAL'); }
  else { fail('JOURNAL wird nicht neu gesetzt'); }

  /* Reihenfolge wirklich rechnen */
  const mLi = JSK.match(/function jListe\(\) \{[\s\S]*?\n\}/);
  if (!mLi) { fail('jListe nicht auswertbar'); }
  else {
    let fn = null;
    try {
      fn = new Function('zustand',
        'let JOURNAL = zustand.j; const unterAktiv = { journal: zustand.u };' +
        'function jZiel(){const u=unterAktiv.journal||"alle";' +
        'if(u.indexOf("z:")!==0)return null;return u.slice(2);}' +
        mLi[0] + '\nreturn jListe;');
    } catch (e) { fn = null; }
    if (!fn) { fail('jListe nicht ausführbar'); }
    else {
      const J = [{ id:1, datum:'2026-08-18', t:'A', zielId:'z9' },
                 { id:2, datum:'2026-08-20', t:'B', zielId:'z9' },
                 { id:3, datum:'2026-08-20', t:'C', zielId:null },
                 { id:4, datum:'2026-07-02', t:'D', zielId:'z9' }];
      const kopie = () => JSON.parse(JSON.stringify(J));
      let f = 0;
      const alle = fn({ j:kopie(), u:'alle' })().map(x => x.t).join('');
      if (alle !== 'CBAD') { f++; fail('Reihenfolge: ' + alle + ' statt CBAD'); }
      const ziel = fn({ j:kopie(), u:'z:z9' })().map(x => x.t).join('');
      if (ziel !== 'BAD') { f++; fail('Zielfilter: ' + ziel + ' statt BAD'); }
      const ohne = fn({ j:kopie(), u:'z:0' })().map(x => x.t).join('');
      if (ohne !== 'C') { f++; fail('Ohne-Ziel-Filter: ' + ohne + ' statt C'); }
      if (!f) { ok('neueste zuerst, Filter nach Ziel korrekt'); }
    }
  }

  const mR = JSK.match(/const REGISTER = \[([\s\S]*?)\n\];/);
  if (mR) {
    const keys = (mR[1].match(/k:'(\w+)'/g) || []).map(s => s.match(/k:'(\w+)'/)[1]);
    const iD = keys.indexOf('db'), iJ = keys.indexOf('journal'), iI = keys.indexOf('info');
    if (iJ > iD && iJ < iI) { ok('Journal liegt zwischen Datenbank und Info'); }
    else { fail('Journal steht an der falschen Stelle'); }
  }

  const mM = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}/);
  if (mM && /Array\.isArray\(d\.journal\)/.test(mM[1])) { ok('Migration ergänzt das Journal'); }
  else { fail('Migration ergänzt journal nicht'); }
  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 17) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 52 · Sprungmarken zwischen den Ebenen ════════════════════════════
   Fehlerart: ein Weg zwischen zwei Blättern hängt an einem Datenfeld, das
   nur die Beispielzeile trägt — bei eingelesenen Daten gibt es ihn nie.
   Ebenso: der Sprung landet auf der falschen Woche oder im falschen
   Monat, weil er vom heutigen Tag statt vom angezeigten ausgeht.
   ═══════════════════════════════════════════════════════════════════════ */
kat('52 · Sprungmarken');
{
  ['springWoche', 'springMonat', 'springMonatAusWoche', 'tagSpringen']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  /* Die Wege müssen im Blattkopf stehen, nicht an einem Datenfeld */
  const mT = JSK.match(/function blattTag\(\) \{([\s\S]*?)\n\}/);
  if (!mT) { fail('blattTag nicht auswertbar'); }
  else {
    [['springWoche', 'Woche'], ['springMonat', 'Monat'],
     ["blattOeffnen\\(\\\\'akt\\\\',\\\\'gew", 'Gewohnheiten']]
      .forEach(function (x) {
        if (new RegExp(x[0]).test(mT[1])) { ok('Weg zu ' + x[1] + ' im Blattkopf'); }
        else { fail('kein fester Weg zu ' + x[1]); }
      });
  }

  /* Der Sprung muss vom angezeigten Tag ausgehen, nicht von heute */
  const mW = JSK.match(/function springWoche\(\) \{([\s\S]*?)\n\}/);
  if (mW && /isoMontag\(tagOffen\)/.test(mW[1])) { ok('Woche folgt dem angezeigten Tag'); }
  else { fail('Sprung landet auf der laufenden Woche statt der angezeigten'); }
  const mM = JSK.match(/function springMonat\(\) \{([\s\S]*?)\n\}/);
  if (mM && /tagOffen\.slice\(0, 7\)/.test(mM[1])) { ok('Monat folgt dem angezeigten Tag'); }
  else { fail('Sprung landet im laufenden Monat statt im angezeigten'); }

  /* Eine Woche über den Monatswechsel gehört zu dem Monat, in dem ihr
     Donnerstag liegt — sonst springt man in den falschen.            */
  const mA = JSK.match(/function springMonatAusWoche\(\) \{([\s\S]*?)\n\}/);
  if (mA && /isoPlus\(wocheBlatt\(\)\.montag, 3\)/.test(mA[1])) {
    ok('Woche über den Monatswechsel springt in den überwiegenden Monat');
  } else { fail('Sprung nimmt den Montag und landet im falschen Monat'); }

  /* Der alte Weg über fuehrtZu darf nicht der einzige sein */
  if (/fuehrtZu/.test(JSK)) {
    const nurDaten = !new RegExp("blattOeffnen\\(\\\\'akt\\\\',\\\\'gew").test(JSK);
    if (nurDaten) { fail('der Weg zu den Gewohnheiten hängt nur an fuehrtZu'); }
    else { ok('fuehrtZu ist Beiwerk, nicht der einzige Weg'); }
  }
}

/* ═══ 53 · Zeitebenen als eigene Laschen ═══════════════════════════════
   Fehlerarten: Monat und Jahr bleiben hinter einem Sammelreiter und
   werden selten benutzt; nach der Aufteilung führt kein Dispatcher-Zweig
   mehr auf sie und die Laschen bleiben leer; die Sprungmarken zeigen auf
   ein Register, das es nicht mehr gibt.
   ═══════════════════════════════════════════════════════════════════════ */
kat('53 · Zeitebenen');
{
  const mD = JSK.match(/function renderBlatt\(\) \{([\s\S]*?)\n\}/);
  if (!mD) { fail('renderBlatt nicht auswertbar'); }
  else {
    [['monat', 'blattMonat'], ['jahr', 'blattJahrestermine']].forEach(function (x) {
      const re = new RegExp("reg === '" + x[0] + "'[\\s\\S]{0,80}" + x[1]);
      if (re.test(mD[1])) { ok(x[0] + ' hat einen Dispatcher-Zweig'); }
      else { fail(x[0] + ' ist nicht erreichbar'); }
    });
  }

  /* Kein Verweis mehr auf das aufgeloeste Register */
  if (!/'planung'/.test(JSK)) { ok('keine Reste des Sammelreiters'); }
  else { fail("'planung' wird noch verwendet"); }

  const mF = JSK.match(/function formNr\(\) \{([\s\S]*?)\n\}/);
  if (mF && /reg === 'monat'/.test(mF[1]) && /reg === 'jahr'/.test(mF[1])) {
    ok('Formularnummern für Monat und Jahr');
  } else { fail('Formularnummer fehlt für Monat oder Jahr'); }

  const mS = JSK.match(/function springMonat\(\) \{([\s\S]*?)\n\}/);
  if (mS && /reg = 'monat'/.test(mS[1])) { ok('Sprungmarke zeigt auf das neue Register'); }
  else { fail('Sprungmarke zeigt ins Leere'); }

  /* Zehn Laschen müssen in die Spalte passen */
  const mR = JSK.match(/const REGISTER = \[([\s\S]*?)\n\];/);
  if (mR) {
    const namen = (mR[1].match(/n:'([^']+)'/g) || []).map(s => s.match(/n:'([^']+)'/)[1]);
    const hoehe = namen.reduce(function (n, t) { return n + t.length * 7.5 + 33; }, 0);
    if (hoehe <= 1052) {
      ok(namen.length + ' Laschen, ' + Math.round(hoehe) + ' px von 1052');
    } else { fail('Laschen brauchen ' + Math.round(hoehe) + ' px — die Spalte reicht nicht'); }
  }
}

/* ═══ 54 · Wochenblatt in drei Spalten ═════════════════════════════════
   Fehlerarten: auf dem Wochenblatt stehen Kästchen, obwohl dort geplant
   und nicht abgehakt wird; ein Eintrag landet in der falschen Spalte oder
   in keiner und verschwindet; alte freie Zeilen aus früheren Fassungen
   fallen durch das Raster.
   ═══════════════════════════════════════════════════════════════════════ */
kat('54 · Wochenblatt in drei Spalten');
{
  const mZ = JSK.match(/function wocheZeile\(e\) \{([\s\S]*?)\n\}/);
  if (!mZ) { fail('wocheZeile nicht auswertbar'); }
  else {
    if (!/hakFeld/.test(mZ[1])) { ok('keine Kästchen auf dem Wochenblatt'); }
    else { fail('Kästchen auf dem Wochenblatt — dort wird nicht abgehakt'); }
    /* Der Zustand muss trotzdem ablesbar bleiben */
    if (/titelKlasse/.test(mZ[1])) { ok('Erledigtes bleibt als solches erkennbar'); }
    else { fail('der Zustand ist auf der Woche nicht mehr ablesbar'); }
  }

  /* Jeder Eintrag muss in genau eine Spalte fallen */
  const mS = JSK.match(/function wocheSpalte\(e\) \{[\s\S]*?\n\}/);
  if (!mS) { fail('wocheSpalte fehlt'); }
  else {
    let fn = null;
    try { fn = new Function(mS[0] + '\nreturn wocheSpalte;')(); } catch (e) { fn = null; }
    if (!fn) { fail('wocheSpalte nicht ausführbar'); }
    else {
      const F = [
        /* Ein Terminverweis wird nicht mehr eigens gezeigt — der Termin
           selbst steht in der Spalte, sonst staende er doppelt.      */
        [{ refArt:'termin' }, 'nichts'],
        [{ refArt:'aktivitaet' }, 'akt'],
        [{ refArt:'tagnotiz' }, 'notiz'],
        [{ refArt:'jahrestermin' }, 'termin'],
        /* Freie Zeilen aus früheren Fassungen dürfen nicht verschwinden */
        [{ zeit:'09:30', t:'alt' }, 'termin'],
        [{ t:'alt ohne Zeit' }, 'notiz'],
      ];
      let f = 0;
      F.forEach(function (x) {
        if (fn(x[0]) !== x[1]) { f++; fail('Spalte: ' + fn(x[0]) + ' statt ' + x[1]); }
      });
      if (!f) { ok(F.length + ' Einträge korrekt zugeordnet, keiner fällt heraus'); }
    }
  }

  const mW = JSK.match(/function blattWoche\(\) \{([\s\S]*?)\n\}/);
  if (!mW) { fail('blattWoche nicht auswertbar'); }
  else {
    /* Die Spalten werden über eine Hilfsfunktion gebaut — geprüft wird
       der Aufruf je Spalte, nicht die inline wiederholte Auszeichnung. */
    const rufe = (mW[1].match(/spalte\('[tan]', '\w+', d, proTag\)/g) || []).length;
    if (rufe === 3) { ok('drei Spalten je Tag'); }
    else { fail(rufe + ' Spaltenaufrufe statt drei'); }
    if (/wo-sp t<\/span>|wo-sp t">Termine/.test(mW[1])) { ok('Kopfzeile über den Spalten'); }
    else { fail('keine Kopfzeile über den Spalten'); }
    [['t', 'termin'], ['a', 'akt'], ['n', 'notiz']].forEach(function (s) {
      if (new RegExp("spalte\\('" + s[0] + "', '" + s[1] + "'").test(mW[1])) {
        ok('Spalte ' + s[1] + ' wird gefüllt');
      } else { fail('Spalte ' + s[1] + ' bleibt leer'); }
    });
    /* Eine einzelne Zeile darf ausschreiben — gezaehlt wird alles in
       der Spalte, auch die unmittelbar gelesenen Termine.           */
    if (/anzahl === 1 \? ' einzeln' : ''/.test(mW[1])) {
      ok('einzelner Eintrag wird ausgeschrieben');
    } else { fail('auch ein einzelner Eintrag wird gekürzt'); }
  }

  const css = H.slice(H.indexOf('<style>'), H.indexOf('</style>'));
  const anteil = function (k) {
    const m = new RegExp('\\.wo-sp\\.' + k + ' \\{[^}]*flex:\\s*(\\d+)').exec(css);
    return m ? parseInt(m[1], 10) : 0;
  };
  if (anteil('t') === 2 && anteil('a') === 2 && anteil('n') === 1) {
    ok('Spaltenverhältnis 2:2:1');
  } else {
    fail('Verhältnis ' + anteil('t') + ':' + anteil('a') + ':' + anteil('n'));
  }

  /* Die Tagzeilen sollen hell sein */
  const mWe = /^\.wo-t\.we \{([^}]*)\}/m.exec(css);
  if (mWe && !/background:\s*var\(--papier-2\)/.test(mWe[1])) {
    ok('Wochenendzeilen nicht mehr grau hinterlegt');
  } else { fail('Wochenendzeilen liegen auf Grau'); }
}

/* ═══ 55 · Wochenblatt: heller Grund, sichtbare Spalten ═══════════════
   Fehlerarten: Ferien und Wochenende tönen die Zeile als Fläche — im
   August liegt damit das ganze Blatt auf Grau; die Spaltentrennung ist
   so blass, dass die Spalten nicht als solche lesbar sind; nach dem
   Entfernen des Zeilenknopfs bleiben verwaiste Regeln zurück.
   ═══════════════════════════════════════════════════════════════════════ */
kat('55 · Wochenblatt: Grund und Spalten');
{
  const css = H.slice(H.indexOf('<style>'), H.indexOf('</style>'));

  /* Keine Flaechentoenung mehr, weder Wochenende noch Ferien */
  [['\\.wo-t\\.we', 'Wochenende'], ['\\.wo-t\\.ferien', 'Ferien']].forEach(function (x) {
    const m = new RegExp('^' + x[0] + ' \\{([^}]*)\\}', 'm').exec(css);
    if (!m) { fail(x[1] + '-Regel nicht gefunden'); return; }
    const grau = /background:\s*(#[0-9a-f]{6}|var\(--papier-2\))/i.test(m[1]) ||
                 /box-shadow:[^;]*rgba/.test(m[1]);
    if (!grau) { ok(x[1] + ' tönt die Zeile nicht'); }
    else { fail(x[1] + ' liegt weiterhin auf Grau'); }
  });

  /* Ohne Toenung muss das Wort erscheinen, sonst geht die Angabe verloren */
  const mW2 = JSK.match(/function blattWoche\(\) \{([\s\S]*?)\n\}/);
  if (mW2 && /if \(fer\) \{ band \+=/.test(mW2[1])) {
    ok('Ferien stehen als Wort unter dem Datum');
  } else { fail('Ferien wären nach dem Entfernen der Tönung unsichtbar'); }
  /* In derselben Schriftfarbe wie die Jahrestermine, nicht blasser */
  if (mW2 && !/wo-jd blass/.test(mW2[1])) {
    ok('Ferien so dunkel wie die Jahrestermine');
  } else { fail('Ferientext blasser als die übrigen Angaben'); }
  if (!/\.wo-jd\.blass/.test(css)) { ok('keine verwaiste Blass-Regel'); }
  else { fail('Blass-Regel steht noch im Stil'); }

  /* Spaltenlinien sichtbar */
  const mS = /^\.wo-sp \{([^}]*)\}/m.exec(css);
  if (!mS) { fail('.wo-sp nicht gefunden'); }
  else if (/border-left:\s*1px solid var\(--linie\)/.test(mS[1])) {
    ok('Spalten durch sichtbare Linien getrennt');
  } else { fail('Spaltentrennung zu blass oder fehlend'); }

  /* Der Zeilenknopf ist weg — samt seiner Regeln */
  if (!/wo-plus/.test(H)) { ok('kein Zeilenknopf und keine verwaisten Regeln'); }
  else { fail('Reste des Zeilenknopfs vorhanden'); }
  /* Der Weg über den Blattkopf muss bleiben */
  if (/wahlAuf\(\\'waktivitaet\\'\)/.test(JSK)) {
    ok('Aktivität zuordnen geht weiterhin über den Blattkopf');
  } else { fail('kein Weg mehr, eine Aktivität auf die Woche zu legen'); }
}

/* ═══ 56 · Monatsblatt nach Wochen ═════════════════════════════════════
   Fehlerarten: das Monatsblatt bleibt ein zweiter Tageskalender und
   beantwortet keine eigene Frage; die Wocheneinträge liegen in einem
   eigenen Bestand und laufen mit dem Wochenblatt auseinander; beim Umbau
   gehen die alten Ereignisse verloren; ein Monat, den zwei Wochen nur
   berühren, verliert die erste oder letzte Woche.
   ═══════════════════════════════════════════════════════════════════════ */
kat('56 · Monatsblatt nach Wochen');
{
  ['wocheBlattFuer', 'monatZurWoche', 'monatWocheNeu'].forEach(function (f) {
    if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
    else { fail(f + ' fehlt'); }
  });

  const mM = JSK.match(/function blattMonat\(\) \{([\s\S]*?)\n\}/);
  if (!mM) { fail('blattMonat nicht auswertbar'); }
  else {
    const t = mM[1];
    if (/while \(mo <= letzter\)/.test(t)) { ok('gliedert nach Wochen, nicht nach Tagen'); }
    else { fail('noch ein Tagesraster'); }
    /* Die Einträge müssen aus dem Wochenblatt kommen, nicht aus einem
       eigenen Bestand — sonst sind es zwei Wahrheiten.               */
    if (/wocheBlattFuer\(mo\)/.test(t) && /wb\.wichtig/.test(t)) {
      ok('die Wocheneinträge sind dieselben wie auf dem Wochenblatt');
    } else { fail('eigener Bestand für die Wochen — er läuft auseinander'); }
    if (/Fester Rahmen/.test(t)) { ok('fester Rahmen aus Jahresterminen und Ganztägigem'); }
    else { fail('kein Rahmen, in den geplant wird'); }
    if (/Diesen Monat/.test(t)) { ok('Wartebereich ohne feste Woche'); }
    else { fail('Vorhaben ohne Woche haben keinen Ort'); }
  }

  /* Alle Wochen, die den Monat berühren — auch die angeschnittenen */
  const teile = ['isoPlus', 'isoWt', 'isoMontag'].map(function (n) {
    const m = JSK.match(new RegExp('function ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
    return m ? m[0] : null;
  });
  if (teile.indexOf(null) === -1) {
    const f = new Function(teile.join('\n') +
      'return function (erster, letzter) { let mo = isoMontag(erster); const l = [];' +
      'while (mo <= letzter) { l.push(mo); mo = isoPlus(mo, 7); } return l; };')();
    /* Nachgerechnet: ein Monat beruehrt vier bis sechs Wochen, je
       nachdem, auf welchen Wochentag der Erste faellt.               */
    const FAELLE = [['2026-08-01', '2026-08-31', 6], ['2026-02-01', '2026-02-28', 5],
                    ['2026-03-01', '2026-03-31', 6], ['2027-02-01', '2027-02-28', 4]];
    let fe = 0;
    FAELLE.forEach(function (x) {
      const n = f(x[0], x[1]).length;
      if (n !== x[2]) { fe++; fail(x[0].slice(0, 7) + ': ' + n + ' Wochen statt ' + x[2]); }
    });
    if (!fe) { ok('alle berührten Wochen erscheinen, auch die angeschnittenen'); }
  }

  /* Die Migration darf nichts wegwerfen */
  const mMig = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}/);
  if (mMig && /m\.vorhaben\.push\(e\)/.test(mMig[1]) && /delete m\.ereignisse/.test(mMig[1])) {
    ok('alte freie Ereignisse wandern zu den Vorhaben');
  } else { fail('beim Umbau gehen die alten Ereignisse verloren'); }

  /* Der Dialog muss auf eine bestimmte Woche zielen können */
  const mS = JSK.match(/function eintragSpeichern\(\) \{([\s\S]*?)\n\}/);
  if (mS && /k\.montag \? wocheBlattFuer\(k\.montag\)/.test(mS[1])) {
    ok('vom Monat aus zielt der Dialog auf die richtige Woche');
  } else { fail('der Eintrag landet in der gerade offenen Woche'); }

  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 18) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 57 · Blattkopf und Vollständigkeit des Monats ════════════════════
   Fehlerarten: Titel und Knopfreihe brauchen zusammen mehr als die
   Blattbreite — der Kopf wird dreizeilig und das Blatt höher als der
   Bildschirm; das Monatsblatt zeigt nur einen Teil einer Woche, sodass
   ein dort eingetragener Termin spurlos verschwindet.
   ═══════════════════════════════════════════════════════════════════════ */
kat('57 · Blattkopf und Monatsvollständigkeit');
{
  const css = H.slice(H.indexOf('<style>'), H.indexOf('</style>'));
  [['bk-titel', 'Titel'], ['bk-sub', 'Untertitel']].forEach(function (x) {
    const m = new RegExp('^\\.' + x[0] + ' \\{([^}]*)\\}', 'm').exec(css);
    if (m && /white-space:\s*nowrap/.test(m[1])) { ok(x[1] + ' bricht nicht um'); }
    else { fail(x[1] + ' darf umbrechen und macht den Kopf höher'); }
  });

  /* Die Knopfreihe des Tagesblatts muss neben den Titel passen */
  const mT = JSK.match(/function blattTag\(\) \{([\s\S]*?)\n\}/);
  if (!mT) { fail('blattTag nicht auswertbar'); }
  else {
    const kopfAufruf = mT[1].slice(mT[1].indexOf('kopf('), mT[1].indexOf('\n\n'));
    const knoepfe = (kopfAufruf.match(/k-btn/g) || []).length;
    if (knoepfe <= 3) { ok('Tagesblatt mit ' + knoepfe + ' Knöpfen im Kopf'); }
    else { fail(knoepfe + ' Knöpfe — Titel und Reihe passen nicht nebeneinander'); }
    /* Die Wege stehen stattdessen im Untertitel */
    if (/bk-weg/.test(mT[1])) { ok('Wege als Text im Untertitel'); }
    else { fail('keine Wege in andere Blätter'); }
  }

  const mK = JSK.match(/function kopf\(titel, sub, akt\) \{([\s\S]*?)\n\}/);
  if (mK && /indexOf\('<'\) !== -1/.test(mK[1])) {
    ok('der Untertitel darf Markup tragen, Text bleibt maskiert');
  } else { fail('Wege im Untertitel würden als Zeichenkette erscheinen'); }

  /* Das Monatsblatt muss die ganze Woche zeigen */
  const mM = JSK.match(/function blattMonat\(\) \{([\s\S]*?)\n\}/);
  if (!mM) { fail('blattMonat nicht auswertbar'); }
  else {
    if (/wb\.wichtig/.test(mM[1]) && /wb\.eintraege/.test(mM[1])) {
      ok('Monatsblatt zeigt Vorgemerktes und auf Tage Gelegtes');
    } else { fail('ein im Monat eingetragener Termin verschwindet'); }
    if (/WOKURZ\[typeof e\.tag === 'number'/.test(mM[1])) {
      ok('die Tageseinträge tragen ihren Wochentag');
    } else { fail('ohne Wochentag ist nicht erkennbar, wann etwas liegt'); }
    if (/\(x\.tag \|\| 0\) - \(y\.tag \|\| 0\)/.test(mM[1])) {
      ok('nach Wochentag sortiert');
    } else { fail('die Tageseinträge stehen in zufälliger Folge'); }
  }
}

/* ═══ 58 · Termine entfernen ═══════════════════════════════════════════
   Fehlerarten: ein Termin lässt sich nur loswerden, indem man seinen
   Titel leert — das findet niemand; ein ganztägiger Termin liegt im Band
   und ist gar nicht anzutippen; beim Löschen bleiben Verweise aus Wochen-
   und Monatsblatt stehen und zeigen "entfallen".
   ═══════════════════════════════════════════════════════════════════════ */
kat('58 · Termine entfernen');
{
  if (/function terminLoeschen\b/.test(JS)) { ok('terminLoeschen vorhanden'); }
  else { fail('kein Weg, einen Termin zu löschen'); }

  const mE = JSK.match(/function terminEdit\(t\) \{([\s\S]*?)\n\}/);
  if (mE && /terminLoeschen\(/.test(mE[1])) { ok('Löschen in der Terminbearbeitung'); }
  else { fail('in der Bearbeitung fehlt das Löschen'); }

  /* Ganztägiges liegt im Band — auch dort muss man herankommen */
  const mG = JSK.match(/function ganztagsEintraegeFuer\(D\) \{([\s\S]*?)\n\}/);
  if (mG && /id:t\.id/.test(mG[1])) { ok('eigene Termine tragen ihre Kennung mit'); }
  else { fail('im Band ist nicht unterscheidbar, was eigen ist'); }
  const mT = JSK.match(/function blattTag\(\) \{([\s\S]*?)\n\}/);
  if (mT && /g\.id \? ' eigen' : ''/.test(mT[1]) && /terminLoeschen\(' \+ g\.id/.test(mT[1])) {
    ok('ganztägige Termine sind im Band bearbeitbar');
  } else { fail('ganztägige Termine lassen sich nicht anfassen'); }
  /* Fremdes darf nicht anklickbar sein */
  if (mG && /quelle:'Jahrestermin'/.test(mG[1])) {
    ok('Jahrestermine und Feiertage bleiben Hinweis');
  } else { warn('Herkunft im Band nicht mehr unterscheidbar'); }

  const mL = JSK.match(/function terminLoeschen\(id\) \{([\s\S]*?)\n\}/);
  const mV = JSK.match(/function terminVerweiseWeg\(id\) \{([\s\S]*?)\n\}/);
  if (!mL || !mV) { fail('terminLoeschen nicht auswertbar'); }
  else {
    /* Das Aufraeumen liegt in einer gemeinsamen Funktion — Loeschen und
       Umwandeln brauchen es beide.                                    */
    if (/terminVerweiseWeg\(id\)/.test(mL[1])) { ok('Löschen räumt die Verweise mit'); }
    else { fail('gelöschter Termin hinterlässt "entfallen" auf anderen Blättern'); }
    if (/WOCHENBLAETTER\.forEach/.test(mV[1]) && /MONATSBLAETTER\.forEach/.test(mV[1])) {
      ok('Wochen- und Monatsblatt werden beide geräumt');
    } else { fail('ein Blatt bleibt mit Verweisen zurück'); }
  }
}

/* ═══ 59 · Planschritte aus der Checkliste ═════════════════════════════
   Fehlerarten: die 25 Schritte eines Vorhabens stehen zusätzlich in der
   Checkliste und im Tagesblatt und verstopfen beide; der Plan selbst ist
   dort nicht sichtbar, also weiß man nicht, dass es ihn gibt; ein Plan
   lässt sich nicht auf einen Tag legen, nur seine Schritte.
   ═══════════════════════════════════════════════════════════════════════ */
kat('59 · Planschritte und Planzeile');
{
  ['schritteUm', 'werUm', 'planOeffnen'].forEach(function (f) {
    if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
    else { fail(f + ' fehlt'); }
  });

  const mA = JSK.match(/function blattAktivitaeten\(\) \{([\s\S]*?)\n\}/);
  if (!mA) { fail('blattAktivitaeten nicht auswertbar'); }
  else {
    if (/zeigeSchritte \|\| !a\.planId/.test(mA[1])) {
      ok('Planschritte bleiben aus der Checkliste heraus');
    } else { fail('die Schritte verstopfen weiterhin die Liste'); }
    /* Ein archivierter Plan darf seine Schritte nicht verschlucken */
    if (/!PLAENE\.some\(p => p\.id === a\.planId && !p\.archiviert\)/.test(mA[1])) {
      ok('Schritte archivierter Pläne bleiben sichtbar');
    } else { fail('Schritte eines archivierten Plans verschwinden'); }
    if (/plaeneHier/.test(mA[1]) && /planFortschritt\(p\.id\)/.test(mA[1])) {
      ok('der Plan erscheint als eine Zeile mit Fortschritt');
    } else { fail('der Plan ist in der Checkliste unsichtbar'); }
  }

  const mT = JSK.match(/function blattTag\(\) \{([\s\S]*?)\n\}/);
  if (!mT) { fail('blattTag nicht auswertbar'); }
  else {
    /* Ein Planschritt steht auf dem Tagesblatt wie jede andere
       Aktivitaet — keine Gruppierung, kein Planname, keine Planzeile. */
    if (!/tagPlaene/.test(mT[1])) { ok('keine Planzeilen auf dem Tagesblatt'); }
    else { fail('der Plan steht wieder als eigene Zeile da'); }
    if (/liste\.length \+ weg\.length/.test(mT[1])) {
      ok('die freien Zeilen zählen alles Belegte ab');
    } else { fail('freie Zeilen überlappen mit den Einträgen'); }
  }

  const mP = JSK.match(/function blattPlan\(pid\) \{([\s\S]*?)\n\}/);
  if (!mP) { fail('blattPlan nicht auswertbar'); }
  else {
    /* Der einzelne Schritt kommt auf den Tag, nicht der ganze Plan */
    if (/planStandZelle\(a\)/.test(mP[1])) { ok('jeder Schritt kommt einzeln auf den Tag'); }
    else { fail('kein Weg, einen Schritt auf einen Tag zu legen'); }
    if (!/planAufTag/.test(JSK)) { ok('kein zweiter Weg über den ganzen Plan'); }
    else { fail('zwei Wege für dieselbe Frage'); }
    if (/if \(nachWer\)/.test(mP[1])) { ok('Gliederung nach Zuständigkeit'); }
    else { fail('keine Gliederung nach Wer'); }
    /* Nichtzugeordnetes gehört ans Ende, nicht an den Anfang */
    if (/if \(!x\) \{ return 1; \}/.test(mP[1])) {
      ok('Nichtzugeordnetes steht am Ende');
    } else { fail('Nichtzugeordnetes steht vor den Namen'); }
  }

  const mMig = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}/);
  if (mMig && /p\.geplant === undefined/.test(mMig[1])) {
    ok('Migration ergänzt das Planungsdatum am Plan');
  } else { fail('Migration ergänzt geplant nicht'); }
  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 19) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 60 · Geräterahmen ════════════════════════════════════════════════
   Fehlerarten: der Rahmen ist auf ein Gerät festgenagelt; auf einem
   dichteren Bildschirm wird alles physisch kleiner, ohne dass es
   auffällt; ein kleiner Rahmen behält das zweispaltige Tagesblatt und
   die Beschreibung schrumpft auf 90 px; der Maßstab darf nie über 100 %,
   dann nützt der kleine Rahmen nichts.
   ═══════════════════════════════════════════════════════════════════════ */
kat('60 · Geräterahmen');
{
  ['rahmenWahl', 'rahmenSetzen'].forEach(function (f) {
    if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
    else { fail(f + ' fehlt'); }
  });

  const mR = JS.match(/const RAHMEN = \{([\s\S]*?)\n\};/);
  if (!mR) { fail('RAHMEN nicht gefunden'); }
  else {
    const keys = (mR[1].match(/^\s*'?([\w-]+)'?:/gm) || [])
      .map(s => s.replace(/[^\w-]/g, ''));
    ['air', 'mini', 'mini-gross'].forEach(function (k) {
      if (keys.indexOf(k) !== -1) { ok('Rahmen ' + k + ' vorhanden'); }
      else { fail('Rahmen ' + k + ' fehlt'); }
    });
  }

  const mS = JSK.match(/function skaliere\(\) \{([\s\S]*?)\n\}/);
  if (!mS) { fail('skaliere nicht auswertbar'); }
  else {
    if (/g\.style\.width = r\.b/.test(mS[1])) { ok('der Rahmen wird gesetzt, nicht fest verdrahtet'); }
    else { fail('Rahmengröße fest im Stil'); }
    /* Ohne Vergroesserung ueber 100 % nuetzt der kleine Rahmen nichts */
    if (/grenze = \(r\.b < 700\) \? 1\.35 : 1/.test(mS[1])) {
      ok('der kleine Rahmen darf über 100 % wachsen');
    } else { fail('Maßstab bei 100 % gedeckelt — die Schrift bliebe klein'); }
    if (/classList\.toggle\('schmal'/.test(mS[1])) { ok('schmaler Rahmen wird gekennzeichnet'); }
    else { fail('kein Kennzeichen für den schmalen Rahmen'); }
    /* visualViewport bleibt tabu */
    if (!/visualViewport/.test(mS[1])) { ok('weiterhin aus dem Layout-Viewport'); }
    else { fail('visualViewport zurück — die Tastatur verkleinert das Blatt'); }
  }

  const css = H.slice(H.indexOf('<style>'), H.indexOf('</style>'));
  if (/\.geraet\.schmal \.doppel \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/.test(css)) {
    ok('schmaler Rahmen stapelt das Tagesblatt');
  } else { fail('zweispaltiges Tagesblatt auch im schmalen Rahmen'); }

  /* Die Rechnung: bleibt in jedem Rahmen genug für die Beschreibung? */
  if (mR) {
    const masse = {};
    (mR[1].match(/'?([\w-]+)'?:\s*\{ b:(\d+), h:(\d+)/g) || []).forEach(function (z) {
      const m = /'?([\w-]+)'?:\s*\{ b:(\d+), h:(\d+)/.exec(z);
      masse[m[1]] = parseInt(m[2], 10);
    });
    let f = 0;
    Object.keys(masse).forEach(function (k) {
      const blatt = masse[k] - 100;
      const spalte = (masse[k] < 700) ? blatt : Math.round(blatt * 1.15 / 2.15);
      const rest = spalte - 180;
      if (rest < 150) { f++; fail(k + ': nur ' + rest + ' px für die Beschreibung'); }
    });
    if (!f) { ok('in jedem Rahmen bleibt genug für die Beschreibung'); }
  }

  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 20) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 61 · Tageswechsel und Zettelwand ═════════════════════════════════
   Fehlerarten: die App bleibt tagelang offen und zeigt morgens noch das
   Blatt von gestern — man trägt in den falschen Tag ein; der Wechsel
   reisst ein bewusst zurückgeblättertes Blatt mit; die Handschrift auf
   den Zetteln wird ungefiltert gespeichert und bläht den Bestand.
   ═══════════════════════════════════════════════════════════════════════ */
kat('61 · Tageswechsel und Zettel');
{
  if (/function tageswechselPruefen\b/.test(JS)) { ok('tageswechselPruefen vorhanden'); }
  else { fail('der Tageswechsel wird nicht bemerkt'); }

  const mT = JSK.match(/function tageswechselPruefen\(\) \{([\s\S]*?)\n\}/);
  if (!mT) { fail('tageswechselPruefen nicht auswertbar'); }
  else {
    /* Nur mitziehen, wenn das Blatt auf dem alten Heute stand */
    if (/mitziehen = \(tagOffen === letzterTag\)/.test(mT[1])) {
      ok('ein zurückgeblättertes Blatt bleibt stehen');
    } else { fail('der Wechsel reisst jedes Blatt mit'); }
    if (/wocheOffen/.test(mT[1]) && /monatOffen/.test(mT[1])) {
      ok('Woche und Monat wandern mit');
    } else { fail('nur der Tag wandert, Woche und Monat bleiben zurück'); }
    if (/sicherungPruefen/.test(mT[1])) { ok('die Sicherung wird wieder fällig'); }
    else { warn('nach dem Wechsel wird nicht nach der Sicherung gefragt'); }
  }
  if (/visibilitychange/.test(JSK) && /setInterval\(tageswechselPruefen/.test(JSK)) {
    ok('geprüft beim Zurückkehren und laufend');
  } else { fail('die Prüfung wird nicht ausgelöst'); }

  /* Zettelwand */
  ['zettelEbene', 'zettelOrt', 'zHier', 'zNeu', 'zLoeschen', 'zBinden', 'zMalen', 'zFarbe']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  const mB = JSK.match(/function zBinden\(\) \{([\s\S]*?)\n\}/);
  if (!mB) { fail('zBinden nicht auswertbar'); }
  else {
    /* Die Handschrift muss ausgedünnt werden, sonst bläht sie den
       Bestand — und der wird bei jeder Änderung ganz neu geschrieben. */
    if (/Math\.abs\(pt\[0\] - v\[0\]\) < 0\.012/.test(mB[1])) {
      ok('Striche werden ausgedünnt');
    } else { fail('ungefilterte Punkte blähen den Bestand'); }
    if (/Math\.round\(pt\[0\] \* 100\) \/ 100/.test(mB[1])) {
      ok('auf zwei Nachkommastellen gerundet');
    } else { fail('unnötig viele Nachkommastellen'); }
    if (/ev\.pointerType === 'pen' \|\| zStift/.test(mB[1])) {
      ok('der Stift schreibt immer, der Finger nur im Schreibbetrieb');
    } else { fail('Finger und Stift nicht unterschieden'); }
    if (/\{ passive:false \}/.test(mB[1])) { ok('Touch-Ereignisse nicht passiv'); }
    else { fail('das Blatt würde beim Schreiben verrutschen'); }
    /* Schieben darf den Zettel nicht aus der Wand tragen */
    /* Der Anschlag muss aus der wirklichen Groesse kommen. Feste Werte
       stimmen nur fuer eine Zettelgroesse.                           */
    if (/el\.offsetWidth \/ r\.width/.test(mB[1]) &&
        /el\.offsetHeight \/ r\.height/.test(mB[1])) {
      ok('der Anschlag folgt der Zettelgröße');
    } else { fail('fester Anschlag — bei anderer Größe falsch'); }
  }

  const css = H.slice(H.indexOf('<style>'), H.indexOf('</style>'));
  if (/\.z-griff \{[^}]*touch-action:\s*none/.test(css)) { ok('der Griff nimmt die Geste an'); }
  else { fail('ohne touch-action rollt die Seite statt zu schieben'); }

  /* Zettel und Zeichenflaeche muessen sich decken */
  const zz = /^\.z-z \{([^}]*)\}/m.exec(css);
  const zl = /^\.z-l \{([^}]*)\}/m.exec(css);
  const zg = /^\.z-griff \{([^}]*)\}/m.exec(css);
  if (zz && zl && zg) {
    const b = parseInt(/width:\s*(\d+)px/.exec(zz[1])[1], 10);
    const hz = parseInt(/height:\s*(\d+)px/.exec(zz[1])[1], 10);
    const bl = parseInt(/width:\s*(\d+)px/.exec(zl[1])[1], 10);
    const hl = parseInt(/height:\s*(\d+)px/.exec(zl[1])[1], 10);
    const top = parseInt(/top:\s*(\d+)px/.exec(zl[1])[1], 10);
    const gr = parseInt(/flex:\s*0 0 (\d+)px/.exec(zg[1])[1], 10);
    if (bl === b && hl === hz - gr && top === gr) {
      ok('Zeichenfläche deckt sich mit dem Zettel (' + b + '\u00d7' + hl + ')');
    } else {
      fail('Zeichenfläche passt nicht: ' + bl + '\u00d7' + hl +
           ' bei Zettel ' + b + '\u00d7' + hz + ', Griff ' + gr);
    }
    /* Im kleinsten Rahmen bleibt das Blatt 505 px breit */
    if (b <= 505) { ok('der Zettel passt auch in den kleinsten Rahmen'); }
    else { fail('im kleinen Rahmen ragt der Zettel über das Blatt'); }
  } else { fail('Zettelmaße nicht gefunden'); }

  /* Zettel kleben auf den Blaettern, sie sind kein Register */
  const mR = JSK.match(/const REGISTER = \[([\s\S]*?)\n\];/);
  if (mR && !/k:'zettel'/.test(mR[1])) { ok('kein eigenes Register — sie kleben am Blatt'); }
  else { fail('Zettel als Register statt auf dem Blatt'); }
  /* Der Ort muss das Blatt unterscheiden, nicht nur das Register */
  const mO = JSK.match(/function zettelOrt\(\) \{([\s\S]*?)\n\}/);
  if (mO && /'tag:' \+ tagOffen/.test(mO[1]) && /'woche:' \+ wocheBlatt\(\)\.montag/.test(mO[1])) {
    ok('der Ort unterscheidet die einzelnen Blätter');
  } else { fail('alle Tage teilten sich dieselben Zettel'); }
  const mN = JSK.match(/function zNeu\(\) \{([\s\S]*?)\n\}/);
  if (mN && /hier\.length >= ZETTEL_MAX/.test(mN[1])) { ok('höchstens vier je Blatt'); }
  else { fail('beliebig viele Zettel je Blatt'); }
  /* Die Ebene darf das Blatt nicht blockieren */
  if (/\.z-wand \{[^}]*pointer-events:\s*none/.test(css)) {
    ok('die Zettelebene lässt das Blatt durch');
  } else { fail('die Ebene fängt alle Berührungen ab'); }
  /* Reihenfolge statt Wortlaut pruefen: zettelEbene muss in renderAlles
     nach renderBlatt stehen, sonst raeumt das Blatt sie wieder weg.  */
  const mA = JSK.match(/function renderAlles\(\) \{([\s\S]*?)\n\}/);
  if (!mA) { fail('renderAlles nicht auswertbar'); }
  else {
    const iB = mA[1].indexOf('renderBlatt()');
    const iZ = mA[1].indexOf('zettelEbene()');
    if (iB !== -1 && iZ !== -1 && iZ > iB) {
      ok('die Zettel werden nach dem Blatt gezeichnet');
    } else { fail('das Blatt überschreibt die Zettel'); }
  }
  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 21) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 62 · Radierer ════════════════════════════════════════════════════
   Fehlerarten: der Radierer prüft nur die gespeicherten Punkte — ein
   schnell gezogener langer Strich hat wenige davon, und dazwischen greift
   er ins Leere; Stift und Radierer sind gleichzeitig an; ohne Radierer
   bleibt nur "alles löschen".
   ═══════════════════════════════════════════════════════════════════════ */
kat('62 · Radierer');
{
  ['strichNah', 'zRadieren', 'zRadiererUm'].forEach(function (f) {
    if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
    else { fail(f + ' fehlt'); }
  });

  /* Abstand zur Strecke wirklich rechnen */
  const mN = JSK.match(/function strichNah\(st, pt, nah\) \{[\s\S]*?\n\}/);
  if (!mN) { fail('strichNah nicht auswertbar'); }
  else {
    let fn = null;
    try { fn = new Function(mN[0] + '\nreturn strichNah;')(); } catch (e) { fn = null; }
    if (!fn) { fail('strichNah nicht ausführbar'); }
    else {
      const nah = 16 / 336;
      const lang = { p:[[0.2, 0.8], [0.8, 0.8]] };
      const kurve = { p:[[0.1, 0.1], [0.5, 0.5], [0.9, 0.2]] };
      const F = [
        [lang, [0.5, 0.8], true, 'Mitte eines langen Strichs'],
        [lang, [0.2, 0.8], true, 'Anfangspunkt'],
        [lang, [0.5, 0.9], false, 'daneben'],
        [kurve, [0.3, 0.3], true, 'zwischen zwei Punkten'],
        [kurve, [0.9, 0.9], false, 'weit weg'],
      ];
      let f = 0;
      F.forEach(function (x) {
        if (fn(x[0], x[1], nah) !== x[2]) { f++; fail('strichNah: ' + x[3] + ' falsch'); }
      });
      if (!f) { ok(F.length + ' Radierfälle korrekt, auch zwischen den Punkten'); }
    }
  }

  /* Beide Radierer nutzen dieselbe Prüfung */
  ['zRadieren', 'avRadieren'].forEach(function (n) {
    const m = JSK.match(new RegExp('function ' + n + '\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}'));
    if (m && /strichNah\(/.test(m[1])) { ok(n + ' prüft die Strecke'); }
    else { fail(n + ' prüft nur die Punkte'); }
  });

  const mU = JSK.match(/function zStiftUm\(\) \{([\s\S]*?)\n\}/);
  if (mU && /zRadierer = false/.test(mU[1])) { ok('Stift und Radierer schliessen sich aus'); }
  else { fail('beide Werkzeuge zugleich aktiv'); }

  const mB = JSK.match(/function zBinden\(\) \{([\s\S]*?)\n\}/);
  if (mB && /ev\.pointerType === 'eraser'/.test(mB[1])) {
    ok('die Rückseite des Pencil radiert');
  } else { fail('die Rückseite des Pencil zeichnet'); }
  if (mB && /zStift \|\| zRadierer \|\|/.test(mB[1])) {
    ok('das Blatt verrutscht auch beim Radieren nicht');
  } else { fail('beim Radieren mit dem Finger rollt die Seite'); }

  const mE = JSK.match(/function zettelEbene\(\) \{([\s\S]*?)\n\}/);
  if (mE && /zRadiererUm\(\)/.test(mE[1])) { ok('der Radierer ist erreichbar'); }
  else { fail('kein Knopf für den Radierer'); }
}

/* ═══ 63 · Notizseiten und Markdown-Werkzeuge ══════════════════════════
   Fehlerarten: ein Zeilenbefehl markiert die ganze Zeile, das nächste
   Zeichen überschreibt sie; ein Blatt hat nur ein endloses Textfeld;
   der Text landet im Blatt statt auf der offenen Seite; die letzte Seite
   lässt sich entfernen und das Blatt bleibt ohne Inhalt.
   ═══════════════════════════════════════════════════════════════════════ */
kat('63 · Notizseiten');
{
  /* Der Zeilenbefehl darf ohne Auswahl nichts markieren */
  const mZ = JSK.match(/function mdZeile\(praefix\) \{[\s\S]*?\n\}/);
  if (!mZ) { fail('mdZeile nicht auswertbar'); }
  else {
    let bau = null;
    try {
      bau = new Function('start', 'ende', 'praefix',
        'let feld = { value:"Meine Zeile", selectionStart:start, selectionEnd:ende,' +
        ' focus:function(){}, setSelectionRange:function(a,b){this.sa=a;this.sb=b;} };' +
        'const mdFeld = () => feld; const mdHoehe = () => {};' +
        'function mdSchreiben(neu,a,b){ feld.value=neu; feld.setSelectionRange(a,b); }' +
        mZ[0] + '\nmdZeile(praefix); return feld;');
    } catch (e) { bau = null; }
    if (!bau) { fail('mdZeile nicht ausführbar'); }
    else {
      const ohne = bau(6, 6, '# ');
      if (ohne.value === '# Meine Zeile' && ohne.sa === ohne.sb) {
        ok('ohne Auswahl bleibt die Einfügemarke stehen');
      } else {
        fail('nach dem Zeilenbefehl ist markiert: ' + ohne.sa + '\u2013' + ohne.sb);
      }
      /* Die Marke muss um das Präfix mitwandern */
      if (ohne.sa === 8) { ok('die Einfügemarke wandert um das Präfix mit'); }
      else { fail('Einfügemarke bei ' + ohne.sa + ' statt 8'); }
      const mit = bau(0, 11, '- ');
      if (mit.sa === 0 && mit.sb === 13) { ok('mit Auswahl bleibt sie erhalten'); }
      else { fail('Auswahl nach dem Befehl: ' + mit.sa + '\u2013' + mit.sb); }
    }
  }

  /* Seiten je Blatt */
  ['nSeiteNeu', 'nSeiteWeg', 'nBlaettern', 'nSeiteAuf'].forEach(function (f) {
    if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
    else { fail(f + ' fehlt'); }
  });

  const mM = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}/);
  if (mM && /n\.seiten = \[n\.text \|\| ''\]/.test(mM[1])) {
    ok('Migration macht aus dem Text die erste Seite');
  } else { fail('vorhandene Notizen verlieren ihren Text'); }

  const mS = JSK.match(/function notizSchreiben\(\) \{([\s\S]*?)\n\}/);
  if (mS && /n\.seiten\[nSeite\] = f\.value/.test(mS[1])) {
    ok('geschrieben wird auf die offene Seite');
  } else { fail('der Text landet im Blatt statt auf der Seite'); }

  const mW = JSK.match(/function nSeiteWeg\(\) \{([\s\S]*?)\n\}/);
  if (mW && /n\.seiten\.length < 2/.test(mW[1])) { ok('die letzte Seite bleibt'); }
  else { fail('das Blatt liesse sich leerräumen'); }
  if (mW && /nWegFrage/.test(mW[1])) { ok('eine beschriebene Seite fragt zurück'); }
  else { fail('eine beschriebene Seite verschwindet ohne Rückfrage'); }

  const mA = JSK.match(/function notizAuf\(id\) \{([\s\S]*?)\n\}/);
  if (mA && /nSeite = 0/.test(mA[1])) { ok('ein anderes Blatt öffnet auf Seite eins'); }
  else { fail('das neue Blatt öffnet auf der Seitenzahl des alten'); }

  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 23) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 64 · Migration: Verschachtelung und Reihenfolge ══════════════════
   Fehlerarten: eine neue Migrationsstufe wird versehentlich in eine
   Schleife hineingeschrieben — dann läuft sie je Element mehrfach und
   bei leerem Bestand gar nicht; eine ältere Stufe räumt ein Feld weg,
   das eine neuere gerade angelegt hat.
   ═══════════════════════════════════════════════════════════════════════ */
kat('64 · Migration');
{
  const mM = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}\n/);
  if (!mM) { fail('migriereDB nicht auswertbar'); }
  else {
    const t = mM[1];

    /* Keine spätere Stufe darf löschen, was eine frühere anlegt */
    if (!/delete n\.seiten/.test(t)) { ok('die Seiten werden nicht wieder gelöscht'); }
    else { fail('eine ältere Stufe löscht die Seiten wieder weg'); }

    /* Die Stufen ab d.zettel gehören auf die oberste Ebene, nicht in
       die Notizschleife — sonst laufen sie ohne Notizen nie.        */
    const iSchleife = t.indexOf('(d.notizen || []).forEach');
    if (iSchleife !== -1) {
      let tiefe = 0, ende = -1;
      for (let i = t.indexOf('{', iSchleife + 20); i < t.length; i++) {
        if (t[i] === '{') { tiefe++; }
        else if (t[i] === '}') { tiefe--; if (!tiefe) { ende = i; break; } }
      }
      const drin = t.slice(iSchleife, ende);
      const FREMD = ['d.zettel', 'd.ansicht', 'd.plaene', 'd.monatsblaetter',
                     'd.journal', 'd.tagnotizen'];
      const falsch = FREMD.filter(x => drin.indexOf(x) !== -1);
      if (!falsch.length) { ok('keine fremde Stufe in der Notizschleife'); }
      else { fail('in der Notizschleife verschachtelt: ' + falsch.join(', ')); }
    }
  }

  /* Die Migration wirklich laufen lassen */
  const teile = ['isoHeute', 'isoPlus', 'isoWt', 'isoMontag', 'migriereDB']
    .map(function (n) {
      const m = JSK.match(new RegExp('function ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
      return m ? m[0] : null;
    });
  if (teile.indexOf(null) !== -1) { fail('Migration nicht auswertbar'); }
  else {
    let fn = null;
    try {
      fn = new Function('SAAT_INFOSEITEN',
        'const DB_VERSION = 99;' +
        'const S = { bereiche:[{id:"b1"}], gruppen:[{id:"g1"}], notizen:[], zettel:[],' +
        ' aktivitaeten:[], plaene:[], ziele:[], wieder:[], gewohnheit:[], termine:[],' +
        ' kontakte:[], jahrestermine:[], wochenblaetter:[], monatsblaetter:[],' +
        ' tagesblaetter:[], tagnotizen:[], journal:[], infoseiten:SAAT_INFOSEITEN,' +
        ' sicherung:{}, ansicht:{}, naechsteId:1 };' +
        'const saatDB = () => JSON.parse(JSON.stringify(S));' +
        teile.join('\n') + '\nreturn migriereDB;')([{ id:1, nr:1, t:'x', text:'y' }]);
    } catch (e) { fn = null; }
    if (!fn) { fail('Migration nicht ausführbar'); }
    else {
      /* Ein altes Notizblatt behält seinen Text als erste Seite */
      const alt = fn({ version:5, bereiche:[{ id:'b1' }], gruppen:[{ id:'g1' }],
                       notizen:[{ id:1, nr:1, t:'Alt', b:'b1', text:'Erste\nZweite' }] });
      if (alt.notizen[0].seiten && alt.notizen[0].seiten[0] === 'Erste\nZweite') {
        ok('alter Notiztext wird zur ersten Seite');
      } else {
        fail('Notiztext verloren: ' + JSON.stringify(alt.notizen[0].seiten));
      }
      /* Ohne Notizen müssen die späteren Stufen trotzdem laufen */
      const leer = fn({ version:5, bereiche:[{ id:'b1' }], gruppen:[{ id:'g1' }],
                        notizen:[] });
      const FEHLT = ['zettel', 'journal', 'tagnotizen'].filter(function (k) {
        return !Array.isArray(leer[k]);
      });
      if (!FEHLT.length) { ok('alle Stufen laufen auch bei leerem Notizbestand'); }
      else { fail('ohne Notizen nicht migriert: ' + FEHLT.join(', ')); }
    }
  }
}

/* ═══ 65 · Tagesblatt ═════════════════════════════════════════════════
   Fehlerarten: die Tagesreflexion kehrt zurück oder ihr Inhalt wird beim
   Rückbau gelöscht; die freien Zeilen überlappen mit den Einträgen, weil
   nicht alles Belegte abgezogen wird; der Kleinkram landet wieder in der
   Aktivitätenliste statt im Blattblock.
   ═══════════════════════════════════════════════════════════════════════ */
kat('65 · Tagesblatt');
{
  const mT = JSK.match(/function blattTag\(\) \{([\s\S]*?)\n\}/);
  if (!mT) { fail('blattTag nicht auswertbar'); }
  else {
    const t = mT[1];
    /* Keine Tagesreflexion */
    if (!/refl-l">Reflexion/.test(t)) { ok('keine Tagesreflexion auf dem Blatt'); }
    else { fail('die Reflexion steht wieder da'); }
    /* Wichtigste Aufgabe zurück */
    if (/wichtig-l">Wichtigste Aufgabe heute/.test(t)) { ok('Wichtigste Aufgabe wieder da'); }
    else { fail('die wichtigste Aufgabe fehlt'); }
    /* Die drei Grossen und die Entwicklung sind draussen */
    ['class="gross"', 'class="entw"', 'class="klein"'].forEach(function (x) {
      if (t.indexOf(x) === -1) { ok(x + ' ist zurückgebaut'); }
      else { fail(x + ' steht noch auf dem Blatt'); }
    });
    /* Aktivitaeten wieder als Tabelle */
    if (/<table class="atab">/.test(t)) { ok('Aktivitäten wieder als Tabelle'); }
    else { fail('keine Aktivitätentabelle'); }
    /* Die freien Zeilen muessen alles Belegte abziehen */
    if (/const belegt = liste\.length \+ weg\.length;/.test(t)) {
      ok('die freien Zeilen zählen alles Belegte ab');
    } else { fail('freie Zeilen überlappen mit den Einträgen'); }
    if (/class="leer klick" onclick="aktNeu/.test(t)) {
      ok('freie Zeilen sind Klickflächen');
    } else { fail('freie Zeilen im Tagesblatt sind tot'); }
    /* Der letzte Block traegt jetzt drei Zwecke */
    if (/Kontakte \/ R\\u00fcckfragen \/ Kleinigkeiten/.test(t)) {
      ok('Kontakte / Rückfragen / Kleinigkeiten');
    } else { fail('der Block heisst noch anders'); }
    if (/kontakt-m/.test(t)) { ok('Minutenfeld am Blattblock'); }
    else { fail('keine Minuten bei den Kleinigkeiten'); }
  }

  /* Woche und Monat behalten ihren Rückblick */
  ['blattWoche', 'blattMonat'].forEach(function (n) {
    const m = JSK.match(new RegExp('function ' + n + '\\(\\) \\{([\\s\\S]*?)\\n\\}'));
    if (m && /refl-l/.test(m[1])) { ok(n + ' behält den Rückblick'); }
    else { fail(n + ': Rückblick versehentlich mitentfernt'); }
  });

  /* Der Rückbau darf nichts aus dem Bestand werfen */
  const mM = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}\n/);
  if (!mM) { fail('migriereDB nicht auswertbar'); }
  else {
    if (/t\.gross\.find\(x => typeof x === 'number'\)/.test(mM[1])) {
      ok('der erste der drei Plätze wird wieder die wichtigste Aufgabe');
    } else { fail('die Wahl aus den drei Plätzen geht verloren'); }
    ['delete t.gross', 'delete t.entw', 'delete t.reflexion'].forEach(function (x) {
      if (mM[1].indexOf(x) === -1) { ok('Bestand bleibt erhalten: ' + x.slice(7)); }
      else { fail('der Rückbau löscht ' + x.slice(7)); }
    });
    if (/k\.min === undefined/.test(mM[1])) { ok('Kontakte bekommen ein Minutenfeld'); }
    else { fail('Migration ergänzt die Minuten nicht'); }
  }

  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 26) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 67 · div-Bilanz der Blattfunktionen ══════════════════════════════
   Fehlerart: eine Blattfunktion erzeugt ein überzähliges schliessendes
   Element. Die Datei bleibt syntaktisch heil und die Prüfung der Datei
   selbst schlägt nicht an — aber im Browser schliesst der Block zu früh,
   und alles Folgende fällt aus dem Layout. Genau so verschwanden die
   Kontakte vom Tagesblatt.
   ═══════════════════════════════════════════════════════════════════════ */
kat('67 · div-Bilanz der Blattfunktionen');
{
  const BLAETTER = ['blattTag', 'blattWoche', 'blattMonat', 'blattAktivitaeten',
                    'blattPlan', 'blattZiel', 'blattNotizBlatt', 'blattJournal',
                    'blattJahrestermine'];
  let schief = 0;
  BLAETTER.forEach(function (n) {
    const i = JSK.indexOf('function ' + n + '(');
    if (i === -1) { fail(n + ' nicht gefunden'); schief++; return; }
    let t = 0, j = JSK.indexOf('{', i), k = j;
    while (k < JSK.length) {
      if (JSK[k] === '{') { t++; }
      else if (JSK[k] === '}') { t--; if (!t) { break; } }
      k++;
    }
    const koerper = JSK.slice(i, k);
    const auf = (koerper.match(/<div\b/g) || []).length;
    const zu = (koerper.match(/<\/div>/g) || []).length;
    if (auf !== zu) {
      fail(n + ': ' + auf + ' <div> gegen ' + zu + ' </div>');
      schief++;
    }
  });
  if (!schief) { ok('alle ' + BLAETTER.length + ' Blattfunktionen ausgeglichen'); }
}

/* ═══ 68 · Kalenderausfuhr ═════════════════════════════════════════════
   Fehlerarten: ohne feste Kennung legt jeder Export Dubletten an; eine
   Änderung an Zeit oder Titel bleibt unbemerkt, weil nur ein Zeitstempel
   verglichen wird; Sonderzeichen zerlegen die Datei; ein ganztägiger
   Eintrag endet einen Tag zu früh, weil das Ende ausschliessend ist.
   ═══════════════════════════════════════════════════════════════════════ */
kat('68 · Kalenderausfuhr');
{
  ['icsEintraege', 'icsAbdruck', 'icsBlock', 'icsDatei', 'icsOffen',
   'icsAusfuehren', 'kalenderAuf', 'kalWeiter']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  /* Eine Datei wirklich bauen und prüfen */
  const teile = ['isoPlus', 'isoWt', 'icsEsc', 'icsFalten', 'icsDatum', 'icsZeit',
                 'icsBlock', 'icsDatei'].map(function (n) {
    const m = JSK.match(new RegExp('function ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
    return m ? m[0] : null;
  });
  if (teile.indexOf(null) !== -1) { fail('ICS-Funktionen nicht auswertbar'); }
  else {
    let fn = null;
    try {
      fn = new Function('const JT_ARTEN = { urlaub:{ n:"Urlaub" } };' +
        teile.join('\n') + '\nreturn icsDatei;')();
    } catch (e) { fn = null; }
    if (!fn) { fail('ICS-Erzeugung nicht ausführbar'); }
    else {
      const l = [
        { art:'termin', uid:'ta-t5', o:{ datum:'2026-08-21', von:'09:30', bis:'10:30',
          ganztags:false, t:'Zahnarzt; Kontrolle', ort:'Bamberg, Innenstadt' } },
        { art:'termin', uid:'ta-t6', o:{ datum:'2026-08-22', ganztags:true,
          t:'Sandkerwa', ort:'' } },
        { art:'jahr', uid:'ta-j2', o:{ von:'2026-08-20', bis:'2026-08-23',
          t:'Urlaub', art:'urlaub', ort:'' } },
      ];
      const d = fn(l, 'Alex', '20260821T080000Z');
      let f = 0;
      if (!/^BEGIN:VCALENDAR/.test(d)) { f++; fail('kein VCALENDAR-Kopf'); }
      if (!/END:VCALENDAR\r\n$/.test(d)) { f++; fail('Datei endet falsch'); }
      /* Zeilenenden müssen CRLF sein */
      if (/[^\r]\n/.test(d)) { f++; fail('Zeilenenden nicht durchgehend CRLF'); }
      /* Sonderzeichen maskiert */
      if (d.indexOf('Zahnarzt\\; Kontrolle') === -1) { f++; fail('Semikolon nicht maskiert'); }
      if (d.indexOf('Bamberg\\, Innenstadt') === -1) { f++; fail('Komma nicht maskiert'); }
      /* Ganztägig: Ende ist der Folgetag */
      if (d.indexOf('DTEND;VALUE=DATE:20260823') === -1) {
        f++; fail('ganztägiger Termin endet einen Tag zu früh');
      }
      if (d.indexOf('DTEND;VALUE=DATE:20260824') === -1) {
        f++; fail('mehrtägiger Eintrag endet einen Tag zu früh');
      }
      /* Feste Kennung je Eintrag — sonst Dubletten */
      if ((d.match(/^UID:/gm) || []).length !== 3) { f++; fail('nicht jeder Eintrag hat eine UID'); }
      if (!/UID:ta-t5@timeassist/.test(d)) { f++; fail('UID nicht aus der Kennung gebildet'); }
      /* Keine Zeile über 75 Zeichen */
      if (!d.split('\r\n').every(z => z.length <= 75)) { f++; fail('Zeile über 75 Zeichen'); }
      if (!f) { ok('ICS formal korrekt: CRLF, Maskierung, Enddatum, UID, Faltung'); }
    }
  }

  /* Der Abdruck muss jede Änderung bemerken */
  const mA = JSK.match(/function icsAbdruck\(e\) \{[\s\S]*?\n\}/);
  if (!mA) { fail('icsAbdruck nicht auswertbar'); }
  else {
    let fn = null;
    try { fn = new Function(mA[0] + '\nreturn icsAbdruck;')(); } catch (e) { fn = null; }
    if (!fn) { fail('icsAbdruck nicht ausführbar'); }
    else {
      const bau = () => ({ art:'termin', o:{ datum:'2026-08-21', von:'09:30', bis:'10:30',
        ganztags:false, t:'Zahnarzt', ort:'', kal:'alex' } });
      const grund = fn(bau());
      let f = 0;
      [['von', '10:00'], ['t', 'Arzt'], ['ort', 'Praxis'], ['kal', 'familie'],
       ['datum', '2026-08-22']].forEach(function (x) {
        const e = bau(); e.o[x[0]] = x[1];
        if (fn(e) === grund) { f++; fail('Änderung an ' + x[0] + ' bleibt unbemerkt'); }
      });
      if (!f) { ok('der Abdruck bemerkt jede Änderung'); }
    }
  }

  /* Der Kleinkram unter Kontakten darf nicht mitgehen */
  const mE = JSK.match(/function icsEintraege\(\) \{([\s\S]*?)\n\}/);
  if (mE && !/KONTAKTE/.test(mE[1])) { ok('Kontakte und Kleinigkeiten bleiben draussen'); }
  else { fail('der Kleinkram landet im Kalender'); }
  if (mE && /a\.geplant/.test(mE[1])) { ok('Aktivitäten mit festem Tag gehen mit'); }
  else { fail('geplante Aktivitäten fehlen'); }

  /* Vermerkt wird erst nach dem Schreiben */
  const mAus = JSK.match(/function icsAusfuehren\(k\) \{([\s\S]*?)\n\}/);
  if (mAus) {
    const iD = mAus[1].indexOf('dateiGeben');
    const iV = mAus[1].indexOf('e.o.exp = e.abdruck');
    if (iD !== -1 && iV > iD) { ok('vermerkt wird erst nach dem Schreiben'); }
    else { fail('der Vermerk steht vor der Datei'); }
  }

  const mM = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}\n/);
  if (mM && /j\.art === 'urlaub' \|\| j\.art === 'besuche'/.test(mM[1])) {
    ok('Urlaube und Besuche kommen in den Familienkalender');
  } else { fail('keine sinnvolle Voreinstellung je Art'); }
  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 27) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 69 · Kalendereinfuhr ═════════════════════════════════════════════
   Fehlerarten: jeder zweite Import legt Dubletten an, weil die fremde
   Kennung nicht gemerkt wird; gefaltete Zeilen werden nicht wieder
   zusammengesetzt; Weltzeit wird nicht in Ortszeit umgerechnet; das
   ausschliessende Enddatum macht mehrtägige Einträge einen Tag zu lang;
   wiederkehrende Termine werden geraten statt übersprungen.
   ═══════════════════════════════════════════════════════════════════════ */
kat('69 · Kalendereinfuhr');
{
  ['icsLesen', 'icsBefund', 'icsUebernehmen', 'icsEntfalten', 'icsZerlegeZeit',
   'icsAusEsc', 'icsGelesen'].forEach(function (f) {
    if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
    else { fail(f + ' fehlt'); }
  });

  const holen = function (n) {
    const m = JSK.match(new RegExp('function ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
    return m ? m[0] : null;
  };
  const teile = ['isoPlus', 'isoWt', 'icsEntfalten', 'icsZerlegeZeit', 'icsAusEsc',
                 'icsLesen', 'icsAbdruck', 'icsBefund', 'icsUebernehmen'].map(holen);
  if (teile.indexOf(null) !== -1) { fail('Einlesefunktionen nicht auswertbar'); }
  else {
    let bau = null;
    try {
      bau = new Function(
        'let neuId = 900; const naechsteId = () => ++neuId;' +
        'let TERMINE = [], JAHRESTERMINE = [];' +
        /* Der Stichtag gehoert dazu, sonst filtert der Befund nicht */
        'let icsAb = "2026-01-01"; let WTERMINE = [];' +
        /* Die Serienlogik gehoert dazu — der Befund stuetzt sich darauf */
        ['isoWt', 'isoMontag', 'wochenAbstand', 'wtFaellig', 'rrZerlegen']
          .map(function (n) {
            const m = JSK.match(new RegExp('function ' + n +
              '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
            return m ? m[0] : '';
          }).join('\n') +
        'const RR_TAGE = { MO:0, TU:1, WE:2, TH:3, FR:4, SA:5, SU:6 };' +
        teile.join('\n') +
        '\nreturn { lauf:function (text, kal) {' +
        '  return icsUebernehmen(icsBefund(icsLesen(text), kal)); },' +
        ' befund:function (text, kal) { return icsBefund(icsLesen(text), kal); },' +
        ' stand:function () { return { t:TERMINE, j:JAHRESTERMINE }; } };');
    } catch (e) { bau = null; }
    if (!bau) { fail('Einlesen nicht ausführbar'); }
    else {
      const w = bau();
      const datei = ['BEGIN:VCALENDAR',
        'BEGIN:VEVENT', 'UID:a@g', 'SUMMARY:Elternabend', 'DTSTART:20260903T183000',
        'DTEND:20260903T200000', 'END:VEVENT',
        'BEGIN:VEVENT', 'UID:b@g', 'SUMMARY:Urlaub Nordsee',
        'DTSTART;VALUE=DATE:20260810', 'DTEND;VALUE=DATE:20260818', 'END:VEVENT',
        /* Woechentlich: das bleibt draussen. Jaehrliche pruefen wir in
           Kategorie 78, sie werden inzwischen uebernommen.           */
        'BEGIN:VEVENT', 'UID:c@g', 'SUMMARY:Jour fixe', 'RRULE:FREQ=WEEKLY;BYDAY=MO',
        'DTSTART:20260907T090000', 'DTEND:20260907T100000', 'END:VEVENT',
        'BEGIN:VEVENT', 'UID:ta-t5@timeassist', 'SUMMARY:Zahnarzt',
        'DTSTART:20260821T093000', 'DTEND:20260821T103000', 'END:VEVENT',
        'END:VCALENDAR'].join('\r\n');

      const b = w.befund(datei, 'familie');
      const arten = {};
      b.forEach(function (x) { arten[x.art] = (arten[x.art] || 0) + 1; });
      let f = 0;
      /* Woechentliche werden jetzt Serientermine — Kategorie 79 prueft
         sie im Einzelnen.                                            */
      if (arten.serie !== 1) { f++; fail('wöchentlicher Termin wird keine Serie'); }
      if (arten.eigen !== 1) { f++; fail('eigener Eintrag nicht erkannt — er käme doppelt'); }
      if (arten.neu !== 2) { f++; fail('neue Einträge: ' + arten.neu + ' statt 2'); }
      if (!f) { ok('Befund trennt neu, eigen und übersprungen'); }

      /* Zweimal dieselbe Datei darf keine Dubletten machen */
      w.lauf(datei, 'familie');
      const nach1 = w.stand();
      const r2 = w.lauf(datei, 'familie');
      const nach2 = w.stand();
      /* Die Serie zaehlt beim zweiten Lauf als geaendert mit */
      if (nach1.t.length === nach2.t.length && nach1.j.length === nach2.j.length &&
          r2.neu === 0 && r2.geaendert === 3) {
        ok('ein zweiter Import legt keine Dubletten an');
      } else {
        fail('Dubletten: ' + nach1.t.length + '/' + nach1.j.length + ' → ' +
             nach2.t.length + '/' + nach2.j.length);
      }
      /* Mehrtägig: das Ende ist ausschliessend */
      const j = nach2.j[0];
      if (j && j.von === '2026-08-10' && j.bis === '2026-08-17') {
        ok('mehrtägiger Eintrag endet am richtigen Tag');
      } else {
        fail('Jahrestermin ' + (j ? j.von + '–' + j.bis : 'fehlt'));
      }
      /* Eingelesenes gilt als im Kalender vorhanden */
      if (nach2.t[0] && nach2.t[0].exp) { ok('Eingelesenes gilt nicht sofort als offen'); }
      else { fail('Eingelesenes stünde sofort wieder zur Ausfuhr an'); }
    }
  }

  /* Faltung und Zeitzone */
  const mE = holen('icsEntfalten');
  if (mE) {
    let fn = null;
    try { fn = new Function(mE + '\nreturn icsEntfalten;')(); } catch (e) { fn = null; }
    if (fn && fn('SUMMARY:Ein lang\r\n er Titel') === 'SUMMARY:Ein langer Titel') {
      ok('gefaltete Zeilen werden zusammengesetzt');
    } else { fail('Faltung wird nicht aufgelöst'); }
  }
  const mZ = holen('icsZerlegeZeit');
  if (mZ && /getUTCDate|Date\.UTC/.test(mZ)) { ok('Weltzeit wird in Ortszeit gerechnet'); }
  else { fail('Weltzeit bleibt unumgerechnet'); }

  const mM = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}\n/);
  if (mM && /t\.uid === undefined/.test(mM[1])) { ok('Migration ergänzt die fremde Kennung'); }
  else { fail('ohne uid legte jeder Import Dubletten an'); }
  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 28) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 70 · Zellenbearbeitung ═══════════════════════════════════════════
   Fehlerarten: die Rechtsbündigkeit wird über einen Buchstaben statt
   einen Klassennamen entschieden — 'durch' enthält ein r, und der Titel
   einer erledigten Aktivität rückt beim Bearbeiten nach rechts; die
   Feldfolge nennt eine Spalte, die es auf dem Blatt gar nicht gibt, und
   die Tabulatortaste springt ins Leere.
   ═══════════════════════════════════════════════════════════════════════ */
kat('70 · Zellenbearbeitung');
{
  const mZ = JSK.match(/function zelle\(art, id, feld, wertText, folgeName, klasse, platzhalter\) \{[\s\S]*?\n\}/);
  if (!mZ) { fail('zelle nicht auswertbar'); }
  else {
    if (/kls\.indexOf\('r'\)/.test(mZ[0])) { ok('Rechtsbündigkeit über den Klassennamen'); }
    else { fail('Rechtsbündigkeit über einen Buchstaben — "durch" enthält ein r'); }
    let fn = null;
    try {
      fn = new Function('esc', 'zelleOffen',
        mZ[0] + '\nreturn zelle;')(x => String(x == null ? '' : x),
        () => true);
    } catch (e) { fn = null; }
    if (!fn) { fail('zelle nicht ausführbar'); }
    else {
      const F = [['a-titel durch', false, 'erledigter Titel'],
                 ['wer', false, 'Wer-Zelle'],
                 ['dat', true, 'Datumszelle'],
                 ['r', true, 'Minutenzelle']];
      let f = 0;
      F.forEach(function (x) {
        const rechts = /class="zf r"/.test(fn('akt', 1, 't', 'X', 'voll', x[0], ''));
        if (rechts !== x[1]) { f++; fail(x[2] + ': ' + (rechts ? 'rechts' : 'links')); }
      });
      if (!f) { ok(F.length + ' Zellenarten richtig ausgerichtet'); }
    }
  }

  /* Die Feldfolge darf nur Spalten nennen, die das Blatt auch hat */
  const mF = JS.match(/const FELDFOLGE = \{([\s\S]*?)\n\};/);
  if (!mF) { fail('FELDFOLGE nicht gefunden'); }
  else {
    if (/plan:\s*\['t', 'wer', 'ende', 'min'\]/.test(mF[1])) {
      ok('das Planblatt hat eine eigene Feldfolge ohne Beginn');
    } else { fail('die Tabulatortaste springt im Planblatt ins Leere'); }
  }
  const mP = JSK.match(/function blattPlan\(pid\) \{([\s\S]*?)\n\}/);
  if (mP) {
    if (!/'voll'/.test(mP[1])) { ok('Planblatt nutzt seine eigene Folge'); }
    else { fail("Planblatt nutzt noch 'voll' — mit einer Spalte, die es nicht hat"); }
    /* Jede in der Folge genannte Spalte muss auch gerendert werden */
    const FEHLT = ['t', 'wer', 'ende', 'min'].filter(function (x) {
      return mP[1].indexOf("'" + x + "'") === -1;
    });
    if (!FEHLT.length) { ok('alle Spalten der Folge werden gezeichnet'); }
    else { fail('Folge nennt fehlende Spalten: ' + FEHLT.join(', ')); }
  }

  /* Der Importknopf muss vor den Ausfuhrblöcken stehen */
  const mK = JSK.match(/function kalenderRender\(\) \{([\s\S]*?)\n\}/);
  if (mK) {
    /* Der Einleseteil ist ausgelagert — geprueft wird sein Aufruf */
    const iE = mK[1].indexOf('icsEinleseBlock()');
    const iA = mK[1].indexOf('KALENDER.forEach');
    if (iE !== -1 && iA !== -1 && iE < iA) {
      ok('Einlesen steht vor der Ausfuhr, nicht unter drei Listen');
    } else { fail('der Importknopf liegt hinter allen Kalenderblöcken'); }
  }
  if (/function icsEinleseBlock\b/.test(JS)) { ok('icsEinleseBlock vorhanden'); }
  else { fail('der Einleseteil fehlt ganz'); }
}

/* ═══ 71 · Schreiben in die richtige Zelle ═════════════════════════════
   Fehlerart: das Schreiben sucht sein Ziel über zwei globale Zustände —
   editZelle und das erste Element mit der Kennung ez. Beim Weiterspringen
   zeigt editZelle schon auf die neue Zelle, während das Verlassen des
   alten Feldes erst danach auslöst. Der alte Wert landet dann im neuen
   Feld: eine frisch angelegte Aktivität bekam die Minutenzahl als Titel.
   ═══════════════════════════════════════════════════════════════════════ */
kat('71 · Schreiben in die richtige Zelle');
{
  ['zelleAusFeld', 'zelleZiel'].forEach(function (f) {
    if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
    else { fail(f + ' fehlt'); }
  });

  /* Das Feld muss sein Ziel selbst tragen */
  const mZ = JSK.match(/function zelle\(art, id, feld[\s\S]*?\n\}/);
  if (!mZ) { fail('zelle nicht auswertbar'); }
  else {
    ['data-art', 'data-id', 'data-feld'].forEach(function (x) {
      if (mZ[0].indexOf(x) !== -1) { ok('Eingabefeld trägt ' + x); }
      else { fail(x + ' fehlt am Eingabefeld'); }
    });
    if (/onblur="zelleAusFeld\(this\)"/.test(mZ[0])) {
      ok('das Verlassen schreibt über das Feld selbst');
    } else { fail('das Verlassen schreibt über den globalen Zustand'); }
  }

  /* Den Ablauf wirklich nachstellen */
  const mT = JSK.match(/function zelleZiel\(art, id, feld, v\) \{[\s\S]*?\n\}/);
  if (!mT) { fail('zelleZiel nicht auswertbar'); }
  else {
    let w = null;
    try {
      w = new Function(
        /* Zwei Eintraege, geschrieben wird in den zweiten: sonst faende
           auch ein falscher Zugriff auf den ersten das Richtige.     */
        'let AKTIVITAETEN = [{ id:7, t:"Anderes", min:15 },' +
        ' { id:11, t:"Schritt", min:90 }];' +
        'let KONTAKTE = [];' +
        mT[0] +
        '\nreturn { schreibe:zelleZiel, neu:function () {' +
        '  AKTIVITAETEN.push({ id:200, t:"", min:30 }); },' +
        ' stand:function () { return AKTIVITAETEN; } };')();
    } catch (e) { w = null; }
    if (!w) { fail('zelleZiel nicht ausführbar'); }
    else {
      /* Minuten schreiben, neue Aktivität anlegen, verspätet nochmals
         schreiben — der Wert muss beim alten Eintrag bleiben.        */
      w.schreibe('akt', 11, 'min', '90');
      w.neu();
      w.schreibe('akt', 11, 'min', '90');
      const st = w.stand();
      const alt = st.find(x => x.id === 11);
      const erste = st.find(x => x.id === 7);
      const neuA = st.find(x => x.id === 200);
      if (alt.min === 90 && neuA.t === '' && neuA.min === 30 &&
          erste.min === 15 && erste.t === 'Anderes') {
        ok('der Wert bleibt beim verlassenen Eintrag');
      } else {
        fail('geschrieben wurde falsch: neue t="' + neuA.t + '" min=' + neuA.min +
             ' / Ziel min=' + alt.min + ' / erste min=' + erste.min);
      }
      /* Ein unbekanntes Ziel darf nichts anrichten */
      const vorher = JSON.stringify(w.stand());
      w.schreibe('akt', 999, 't', 'X');
      if (JSON.stringify(w.stand()) === vorher) {
        ok('ein unbekanntes Ziel richtet nichts an');
      } else { fail('unbekanntes Ziel schreibt irgendwohin'); }
    }
  }

  /* Das verzögerte Schliessen darf nicht die neue Zelle treffen */
  const mA = JSK.match(/function zelleAusFeld\(el\) \{([\s\S]*?)\n\}/);
  if (mA && /editZelle\.art === art &&/.test(mA[1]) &&
      /String\(editZelle\.id\) === String\(id\)/.test(mA[1])) {
    ok('geschlossen wird nur die eigene Zelle');
  } else { fail('das Verlassen schliesst die eben geöffnete Zelle wieder'); }
}

/* ═══ 72 · Kalenderdialog: auswählen und umhängen ══════════════════════
   Fehlerarten: der Dialog listet nur auf — man kann nichts abwählen und
   nichts umhängen; die Liste ist abgeschnitten und der Rest unerreichbar;
   die Auswahl wird gespeichert und wirkt beim nächsten Mal nach; das
   Ausführen nimmt trotz Abwahl alles mit.
   ═══════════════════════════════════════════════════════════════════════ */
kat('72 · Kalenderdialog');
{
  ['icsWaehlen', 'icsAlleWaehlen'].forEach(function (f) {
    if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
    else { fail(f + ' fehlt'); }
  });

  const mR = JSK.match(/function kalenderRender\(\) \{([\s\S]*?)\n\}/);
  if (!mR) { fail('kalenderRender nicht auswertbar'); }
  else {
    const t = mR[1];
    if (/ics-h/.test(t) && /icsWaehlen\(/.test(t)) { ok('jede Zeile hat einen Auswahlhaken'); }
    else { fail('nichts lässt sich abwählen'); }
    if (/kalWeiter\(/.test(t)) { ok('jede Zeile lässt sich umhängen'); }
    else { fail('die Kalenderzuordnung ist im Dialog nicht änderbar'); }
    if (/icsAlleWaehlen\(/.test(t)) { ok('Alle und Keine je Kalender'); }
    else { fail('kein Weg, alle auf einmal zu wählen'); }
    /* Die Liste darf nicht abgeschnitten sein */
    if (!/\.slice\(0, 8\)/.test(t)) { ok('die Liste zeigt alle Einträge'); }
    else { fail('die Liste ist nach acht Einträgen abgeschnitten'); }
    /* Was schon im Kalender steht, muss erkennbar sein */
    if (/ics-schon/.test(t)) { ok('bereits Ausgeführtes ist gekennzeichnet'); }
    else { fail('offen und ausgeführt sind nicht unterscheidbar'); }
  }

  /* Ausgeführt wird nur das Gewählte */
  const mA = JSK.match(/function icsAusfuehren\(k\) \{([\s\S]*?)\n\}/);
  if (mA && /icsWahl && icsWahl\[e\.uid\]/.test(mA[1])) {
    ok('ausgeführt wird nur das Gewählte');
  } else { fail('die Abwahl wird beim Ausführen übergangen'); }

  /* Die Wahl darf nicht im Bestand landen */
  const mS = JSK.match(/function saatDB\(\) \{([\s\S]*?)\n\}/);
  if (mS && !/icsWahl/.test(mS[1])) { ok('die Wahl gilt nur für diese Ausfuhr'); }
  else { fail('die Auswahl wird gespeichert und wirkt nach'); }
  const mAuf = JSK.match(/function kalenderAuf\(\) \{([\s\S]*?)\n\}/);
  if (mAuf && /icsWahl = null/.test(mAuf[1])) { ok('beim Öffnen ist alles gewählt'); }
  else { fail('die Wahl des letzten Mals wirkt nach'); }

  /* Umhängen muss den Dialog neu zeichnen, sonst bleibt die Zeile stehen */
  const mW = JSK.match(/function kalWeiter\(art, id\) \{([\s\S]*?)\n\}/);
  if (mW && /kalenderRender\(\)/.test(mW[1])) {
    ok('nach dem Umhängen wandert die Zeile sofort');
  } else { fail('die umgehängte Zeile bleibt im alten Block stehen'); }
}

/* ═══ 73 · Stichtag beim Einlesen ══════════════════════════════════════
   Fehlerart: Google kann nur den ganzen Kalender ausgeben. Ohne Stichtag
   käme jeder Termin seit 2019 mit. Und: massgeblich ist das Ende, nicht
   der Beginn — ein laufender Urlaub, der vor dem Stichtag begann, gehört
   noch dazu.
   ═══════════════════════════════════════════════════════════════════════ */
kat('73 · Stichtag beim Einlesen');
{
  ['icsAbSetzen', 'icsAbFeld'].forEach(function (f) {
    if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
    else { fail(f + ' fehlt'); }
  });

  const mB = JSK.match(/function icsBefund\(roh, kal\) \{([\s\S]*?)\n\}/);
  if (!mB) { fail('icsBefund nicht auswertbar'); }
  else {
    if (/const ab = icsAb \|\| isoHeute\(\)/.test(mB[1])) {
      ok('ohne gesetzten Stichtag gilt heute');
    } else { fail('kein Stichtag im Befund'); }
    if (/art:'zualt'/.test(mB[1])) { ok('zu Altes wird als solches gemeldet'); }
    else { fail('zu Altes verschwindet stillschweigend'); }
  }

  /* Den Filter wirklich rechnen */
  const teile = ['isoHeute', 'isoPlus', 'isoWt', 'icsBefund'].map(function (n) {
    const m = JSK.match(new RegExp('function ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
    return m ? m[0] : null;
  });
  if (teile.indexOf(null) !== -1) { fail('Befund nicht auswertbar'); }
  else {
    let fn = null;
    try {
      fn = new Function('ab',
        'let TERMINE = [], JAHRESTERMINE = [], WTERMINE = []; let icsAb = ab;' +
        'const rrZerlegen = () => null;' +
        teile.join('\n') + '\nreturn icsBefund;');
    } catch (e) { fn = null; }
    if (!fn) { fail('Befund nicht ausführbar'); }
    else {
      const b = fn('2026-08-01');
      const F = [
        [{ uid:'a', t:'Alt', von:{ datum:'2019-05-04', zeit:'10:00', ganztags:false },
           bis:{ datum:'2019-05-04' } }, 'zualt', 'Termin von 2019'],
        [{ uid:'b', t:'Läuft', von:{ datum:'2026-07-28', ganztags:true },
           bis:{ datum:'2026-08-05' } }, 'neu', 'laufender Urlaub über den Stichtag'],
        [{ uid:'c', t:'Knapp', von:{ datum:'2026-07-25', ganztags:true },
           bis:{ datum:'2026-08-01' } }, 'zualt', 'endete am Vortag'],
        [{ uid:'d', t:'Genau', von:{ datum:'2026-08-01', zeit:'08:00', ganztags:false },
           bis:{ datum:'2026-08-01' } }, 'neu', 'genau am Stichtag'],
        [{ uid:'e', t:'Künftig', von:{ datum:'2026-09-10', zeit:'09:00', ganztags:false },
           bis:{ datum:'2026-09-10' } }, 'neu', 'künftig'],
      ];
      let f = 0;
      F.forEach(function (x) {
        const r = b([x[0]], 'alex')[0];
        if (r.art !== x[1]) { f++; fail(x[2] + ': ' + r.art + ' statt ' + x[1]); }
      });
      if (!f) { ok(F.length + ' Fälle am Stichtag korrekt, Ende zählt statt Beginn'); }
    }
  }

  /* Der Stichtag muss ohne erneutes Lesen wirken */
  const mS = JSK.match(/function icsAbSetzen\(iso\) \{([\s\S]*?)\n\}/);
  if (mS && /icsRoh/.test(mS[1])) { ok('der Stichtag wirkt ohne neues Einlesen'); }
  else { fail('die Datei müsste nochmals gewählt werden'); }
  const mE = JSK.match(/function icsEinleseBlock\(\) \{([\s\S]*?)\n\}/);
  if (mE && /Monatsanfang/.test(mE[1]) && /icsAbFeld/.test(mE[1])) {
    ok('Stichtag frei eingebbar und mit Abkürzungen');
  } else { fail('kein Bedienelement für den Stichtag'); }
  if (mE && /zualt:/.test(mE[1])) { ok('die Vorschau nennt die übersprungenen Alten'); }
  else { fail('man erführe nicht, wie viel weggefiltert wurde'); }
}

/* ═══ 74 · Jahresblatt zeigt denselben Rahmen ══════════════════════════
   Fehlerart: das Monatsblatt fasst Jahrestermine und ganztägige Termine
   zum festen Rahmen zusammen, das Jahresblatt zeigte nur die
   Jahrestermine. Ein eingelesener eintägiger Termin stand damit im Tages-
   und Monatsblatt, im Jahr aber nicht — und niemand fand den Grund.
   ═══════════════════════════════════════════════════════════════════════ */
kat('74 · Jahresblatt und ganztägige Termine');
{
  const mT = JSK.match(/function jtAnTag\(iso\) \{[\s\S]*?\n\}/);
  if (!mT) { fail('jtAnTag nicht auswertbar'); }
  else {
    if (/TERMINE\.forEach/.test(mT[0])) { ok('ganztägige Termine gehören zum Rahmen'); }
    else { fail('das Jahresblatt zeigt nur Jahrestermine'); }

    let fn = null;
    try {
      /* Die Jahreslogik gehoert dazu — jtAnTag stuetzt sich darauf */
      const hilf = ['jtSchalttag', 'jtVon', 'jtBis', 'jtLaeuft', 'jtFilterPasst']
        .map(function (n) {
        const m = JSK.match(new RegExp('function ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
        return m ? m[0] : '';
      }).join('\n');
      fn = new Function('J', 'T',
        'const JAHRESTERMINE = J, TERMINE = T;' +
        'let jtFilter = null; const JT_ARTEN = { urlaub:{}, termin:{} };' +
        hilf + '\n' + mT[0] + '\nreturn jtAnTag;');
    } catch (e) { fn = null; }
    if (!fn) { fail('jtAnTag nicht ausführbar'); }
    else {
      const f = fn(
        [{ id:1, t:'Kreta', von:'2026-08-06', bis:'2026-08-16', art:'urlaub' }],
        [{ id:5, datum:'2026-08-21', ganztags:true, t:'Sandkerwa' },
         { id:6, datum:'2026-08-21', ganztags:false, von:'09:30', t:'Zahnarzt' },
         { id:7, datum:'2026-08-22', ganztags:true, t:'' }]);
      let fe = 0;
      if (f('2026-08-10').length !== 1) { fe++; fail('Jahrestermin fehlt'); }
      const eins = f('2026-08-21');
      if (eins.length !== 1 || eins[0].t !== 'Sandkerwa') {
        fe++; fail('ganztägiger Termin nicht im Jahresblatt');
      }
      /* Zeitgebundenes gehört nicht in den Rahmen — sonst stünde jeder
         Zahnarzttermin als Balken im Jahr.                            */
      if (eins.some(x => x.t === 'Zahnarzt')) { fe++; fail('Termin mit Uhrzeit im Jahresraster'); }
      if (f('2026-08-22').length) { fe++; fail('leerer Termin erscheint'); }
      if (!fe) { ok('Jahrestermine und ganztägige Termine, nichts Zeitgebundenes'); }
      /* Sie müssen unterscheidbar bleiben */
      if (eins[0] && eins[0].ganztagsTermin) { ok('Herkunft bleibt unterscheidbar'); }
      else { fail('Termin und Jahrestermin nicht auseinanderzuhalten'); }
    }
  }

  const mJ = JSK.match(/function blattJahrestermine\(\) \{([\s\S]*?)\n\}/);
  if (mJ) {
    /* Ein Termin darf nicht den Jahrestermin-Dialog öffnen */
    if (/j\.ganztagsTermin/.test(mJ[1]) && /tagSpringen/.test(mJ[1])) {
      ok('ein Termin führt auf sein Tagesblatt, nicht in den Jahresdialog');
    } else { fail('der Balken öffnet den falschen Dialog'); }
    if (/ganzt\\u00e4gige Termine/.test(mJ[1])) { ok('der Kopf nennt beide Zahlen'); }
    else { warn('die Kopfzeile zählt nur die Jahrestermine'); }
  }
}

/* ═══ 75 · Termin und Jahrestermin umwandeln ═══════════════════════════
   Fehlerarten: beim Umwandeln wechselt die Kennung, und in Google steht
   der Eintrag danach zweimal; die Verweise aus Wochen- und Monatsblatt
   zeigen ins Leere; ein mehrtägiger Jahrestermin lässt sich in einen
   Termin verwandeln und verliert dabei seine Dauer.
   ═══════════════════════════════════════════════════════════════════════ */
kat('75 · Umwandeln');
{
  ['zumJahrestermin', 'zumTermin', 'terminVerweiseWeg'].forEach(function (f) {
    if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
    else { fail(f + ' fehlt'); }
  });

  /* Eingelesene behalten ihre Kennung auch bei der Ausfuhr */
  const mE = JSK.match(/function icsEintraege\(\) \{([\s\S]*?)\n\}/);
  if (mE && /t\.uid \|\| \('ta-t' \+ t\.id\)/.test(mE[1]) &&
      /j\.uid \|\| \('ta-j' \+ j\.id\)/.test(mE[1])) {
    ok('eingelesene Einträge behalten ihre Kennung');
  } else { fail('ein eingelesener Eintrag käme in Google ein zweites Mal an'); }
  const mB = JSK.match(/function icsBlock\(e, stempel\) \{([\s\S]*?)\n\}/);
  if (mB && /indexOf\('@'\) === -1/.test(mB[1])) {
    ok('fremde Kennungen werden nicht nochmals ergänzt');
  } else { fail('fremde Kennung bekäme ein zweites @timeassist'); }

  /* Das Umwandeln wirklich rechnen */
  const teile = ['terminVerweiseWeg', 'zumJahrestermin'].map(function (n) {
    const m = JSK.match(new RegExp('function ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
    return m ? m[0] : null;
  });
  if (teile.indexOf(null) !== -1) { fail('Umwandlung nicht auswertbar'); }
  else {
    let w = null;
    try {
      w = new Function(
        'let neuId = 900; const naechsteId = () => ++neuId;' +
        'let TERMINE = [{ id:5, datum:"2026-08-21", ganztags:true, t:"Fremd",' +
        ' ort:"", kal:"feste", uid:"abc@google.com", exp:"x" },' +
        ' { id:6, datum:"2026-08-22", ganztags:true, t:"Eigen", ort:"",' +
        ' kal:"alex", uid:null, exp:"y" }];' +
        'let JAHRESTERMINE = [];' +
        'let WOCHENBLAETTER = [{ eintraege:[{ id:1, refArt:"termin", refId:5 }],' +
        ' wichtig:[] }];' +
        'let MONATSBLAETTER = [{ vorhaben:[{ id:2, refArt:"termin", refId:5 }] }];' +
        'let editTermin = null; const renderAlles = () => {}; const melde = () => {};' +
        teile.join('\n') +
        '\nreturn { wandle:zumJahrestermin, stand:function () {' +
        ' return { t:TERMINE, j:JAHRESTERMINE, w:WOCHENBLAETTER, m:MONATSBLAETTER }; } };')();
    } catch (e) { w = null; }
    if (!w) { fail('Umwandlung nicht ausführbar'); }
    else {
      w.wandle(5);
      const st = w.stand();
      let f = 0;
      const j = st.j[0];
      if (!j || j.von !== '2026-08-21' || j.bis !== '2026-08-21') {
        f++; fail('Jahrestermin falsch datiert');
      }
      /* Fremde Kennung und Ausfuhrvermerk müssen mitwandern */
      if (!j || j.uid !== 'abc@google.com' || j.exp !== 'x') {
        f++; fail('Kennung geht verloren — Google bekäme einen zweiten Eintrag');
      }
      if (st.t.length !== 1) { f++; fail('der alte Termin blieb stehen'); }
      if (st.w[0].eintraege.length || st.m[0].vorhaben.length) {
        f++; fail('Verweise zeigen ins Leere');
      }
      /* Ohne fremde Kennung gilt der Eintrag wieder als offen */
      w.wandle(6);
      const j2 = w.stand().j[1];
      if (!j2 || j2.exp !== null) { f++; fail('eigener Eintrag gilt fälschlich als ausgeführt'); }
      if (!f) { ok('Umwandlung erhält Kennung, Datum und räumt die Verweise'); }
    }
  }

  const mZ = JSK.match(/function zumTermin\(id\) \{([\s\S]*?)\n\}/);
  if (mZ && /j\.von !== j\.bis/.test(mZ[1])) {
    ok('mehrtägige lassen sich nicht zurückverwandeln');
  } else { fail('ein mehrtägiger Eintrag verlöre seine Dauer'); }
}

/* ═══ 76 · Ledereinband ════════════════════════════════════════════════
   Fehlerarten: der Einband klappt bei jedem Zurückkehren zur App auf und
   wird zur Last; er lässt sich nicht überspringen; die Sicherungsfrage
   erscheint unter dem Deckel; das Zuklappen springt ohne Bewegung, weil
   beide Zustände im selben Bildaufbau gesetzt werden.
   ═══════════════════════════════════════════════════════════════════════ */
kat('76 · Ledereinband');
{
  ['einbandZeigen', 'einbandWeg', 'einbandSchliessen', 'einbandUeberspringen']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  const mZ = JSK.match(/function einbandZeigen\(\) \{([\s\S]*?)\n\}/);
  if (!mZ) { fail('einbandZeigen nicht auswertbar'); }
  else {
    if (/DB\.ansicht\.einbandTag === isoHeute\(\)/.test(mZ[1])) {
      ok('höchstens einmal am Tag');
    } else { fail('der Einband käme bei jedem Start'); }
    if (/setTimeout\(einbandWeg/.test(mZ[1])) { ok('er räumt sich selbst weg'); }
    else { fail('der Deckel bliebe liegen'); }
  }

  /* Überspringen muss möglich sein */
  if (/onclick="einbandUeberspringen\(\)"/.test(HTMLTEIL)) {
    ok('ein Tipp überspringt ihn');
  } else { fail('man müsste die Bewegung abwarten'); }

  /* Zuklappen braucht zwei Bildaufbauten, sonst gibt es keine Bewegung */
  const mS = JSK.match(/function einbandSchliessen\(\) \{([\s\S]*?)\n\}/);
  if (!mS) { fail('einbandSchliessen nicht auswertbar'); }
  else {
    const n = (mS[1].match(/requestAnimationFrame/g) || []).length;
    if (n >= 2) { ok('das Zuklappen wird sichtbar bewegt'); }
    else { fail('Deckel springt zu, ohne sich zu bewegen'); }
    if (/dk-bilanz/.test(mS[1])) { ok('die Bilanz steht auf dem Deckel'); }
    else { fail('keine Bilanz beim Zuklappen'); }
  }

  /* Die Sicherungsfrage darf nicht unter dem Deckel liegen */
  const mSt = JS.match(/einbandZeigen\(\);\s*\n\s*setTimeout\(sicherungPruefen, (\d+)\)/);
  if (mSt && parseInt(mSt[1], 10) >= 1400) {
    ok('die Sicherungsfrage kommt nach dem Aufklappen (' + mSt[1] + ' ms)');
  } else { fail('die Sicherungsfrage läge unter dem Deckel'); }

  /* Der Deckel braucht Tiefe am Elternteil, sonst klappt nichts */
  const css = H.slice(H.indexOf('<style>'), H.indexOf('</style>'));
  if (/\.geraet \{[^}]*perspective:/.test(css)) { ok('das Gerät gibt die Tiefe vor'); }
  else { fail('ohne perspective bleibt die Bewegung flach'); }
  if (/\.deckel \{[^}]*transform-origin:\s*left center/.test(css)) {
    ok('die Angel sitzt links');
  } else { fail('der Deckel dreht um die falsche Kante'); }
  const mD = /\.deckel \{([^}]*)\}/.exec(css);
  if (mD && /900ms/.test(mD[1])) { ok('900 ms wie gewünscht'); }
  else { fail('andere Dauer als vereinbart'); }
  /* Er darf das Blatt nur zeigen, wenn er auch gebraucht wird */
  if (/\.deckel \{[^}]*display:\s*none/.test(css) && /\.deckel\.da \{/.test(css)) {
    ok('sonst liegt er nicht im Weg');
  } else { fail('der Deckel liegt dauerhaft über dem Blatt'); }
}

/* ═══ 77 · Termine im Wochenblatt ══════════════════════════════════════
   Fehlerart: Tages-, Monats- und Jahresblatt lesen die Termine
   unmittelbar aus dem Kalender, das Wochenblatt zeigte nur, was jemand
   dort abgelegt hatte. Ein am Tag erfasster oder eingelesener Termin
   fehlte damit ausgerechnet in der Wochenübersicht.
   ═══════════════════════════════════════════════════════════════════════ */
kat('77 · Termine im Wochenblatt');
{
  const mW = JSK.match(/function blattWoche\(\) \{([\s\S]*?)\n\}/);
  if (!mW) { fail('blattWoche nicht auswertbar'); }
  else {
    const t = mW[1];
    if (/TERMINE\.filter\(x => x\.datum === iso/.test(t)) {
      ok('die Woche liest die Termine unmittelbar');
    } else { fail('die Woche zeigt nur abgelegte Verweise'); }
    /* Leere Termine gehören nicht ins Blatt */
    if (/\(x\.t \|\| ''\)\.trim\(\)/.test(t)) { ok('leere Termine bleiben draussen'); }
    else { fail('ein leerer Termin erzeugt eine leere Zeile'); }
    /* Ganztägiges zuerst, dann nach Uhrzeit */
    if (/x\.ganztags !== y\.ganztags/.test(t)) {
      ok('ganztägig zuerst, dann nach Uhrzeit');
    } else { fail('die Termine stehen in zufälliger Folge'); }
    /* Ein Tipp führt auf den Tag */
    if (/tagSpringen\(/.test(t) && /wo-et/.test(t)) {
      ok('ein Termin führt auf sein Tagesblatt');
    } else { fail('der Termin ist von der Woche aus nicht erreichbar'); }
  }

  /* Kein doppeltes Erscheinen */
  const mS = JSK.match(/function wocheSpalte\(e\) \{([\s\S]*?)\n\}/);
  if (mS && /e\.refArt === 'termin'\) \{ return 'nichts'/.test(mS[1])) {
    ok('ein Terminverweis erscheint nicht zusätzlich');
  } else { fail('Termin und Verweis stünden doppelt nebeneinander'); }

  /* Die Sortierung wirklich rechnen */
  let fn = null;
  try {
    fn = new Function('l',
      'return l.filter(x => x.datum === "2026-08-21" && (x.t || "").trim())' +
      '.sort(function (x, y) {' +
      '  if (x.ganztags !== y.ganztags) { return x.ganztags ? -1 : 1; }' +
      '  return (x.von || "") < (y.von || "") ? -1 : 1; });');
  } catch (e) { fn = null; }
  if (fn) {
    const r = fn([
      { id:1, datum:'2026-08-21', ganztags:false, von:'14:00', t:'Zahnarzt' },
      { id:2, datum:'2026-08-21', ganztags:true, t:'Sandkerwa' },
      { id:3, datum:'2026-08-21', ganztags:false, von:'09:30', t:'Testfenster' },
      { id:4, datum:'2026-08-22', ganztags:false, von:'10:00', t:'Anderer Tag' },
      { id:5, datum:'2026-08-21', ganztags:false, von:'11:00', t:'   ' },
    ]).map(x => x.t).join(',');
    if (r === 'Sandkerwa,Testfenster,Zahnarzt') { ok('Reihenfolge und Filter korrekt'); }
    else { fail('Reihenfolge: ' + r); }
  }
}

/* ═══ 78 · Jährliche Jahrestermine ═════════════════════════════════════
   Fehlerarten: ein Geburtstag muss jedes Jahr neu angelegt werden; der
   29. Februar fällt in gewöhnlichen Jahren aus; ein jährlicher Eintrag
   wird vom Stichtag weggefiltert, weil sein erstes Auftreten weit
   zurückliegt; wöchentliche Regeln werden geraten statt übersprungen.
   ═══════════════════════════════════════════════════════════════════════ */
kat('78 · Jährliche Jahrestermine');
{
  ['jtVon', 'jtBis', 'jtLaeuft', 'jtImZeitraum', 'jtSchalttag']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  const teile = ['jtSchalttag', 'jtVon', 'jtBis', 'jtLaeuft', 'jtImZeitraum']
    .map(function (n) {
      const m = JSK.match(new RegExp('function ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
      return m ? m[0] : null;
    });
  if (teile.indexOf(null) !== -1) { fail('Jahreslogik nicht auswertbar'); }
  else {
    let w = null;
    try {
      w = new Function(teile.join('\n') +
        '\nreturn { laeuft:jtLaeuft, zeitraum:jtImZeitraum, von:jtVon };')();
    } catch (e) { w = null; }
    if (!w) { fail('Jahreslogik nicht ausführbar'); }
    else {
      const g = { von:'1954-09-15', bis:'1954-09-15', jaehrlich:true };
      const u = { von:'2026-08-06', bis:'2026-08-16', jaehrlich:false };
      const s = { von:'2020-02-29', bis:'2020-02-29', jaehrlich:true };
      const F = [
        [g, '2026-09-15', true, 'Geburtstag in einem anderen Jahr'],
        [g, '2027-09-15', true, 'und im übernächsten'],
        [g, '2026-09-14', false, 'einen Tag davor'],
        [u, '2027-08-10', false, 'einmaliger Urlaub wiederholt sich nicht'],
        [s, '2028-02-29', true, 'Schalttag im Schaltjahr'],
        [s, '2026-02-28', true, 'Schalttag rückt auf den 28.'],
        [s, '2026-02-29', false, 'den es gar nicht gibt'],
      ];
      let f = 0;
      F.forEach(function (x) {
        if (w.laeuft(x[0], x[1]) !== x[2]) { f++; fail(x[3] + ': falsch'); }
      });
      if (!f) { ok(F.length + ' Fälle korrekt, Schalttag geprüft'); }
      if (w.zeitraum(g, '2026-09-01', '2026-09-30') &&
          !w.zeitraum(g, '2026-07-01', '2026-07-31')) {
        ok('Zeitraumprüfung trifft das richtige Jahr');
      } else { fail('Zeitraumprüfung falsch'); }
    }
  }

  /* Einfuhr: jährlich ja, wöchentlich nein */
  const mB = JSK.match(/function icsBefund\(roh, kal\) \{([\s\S]*?)\n\}/);
  if (!mB) { fail('icsBefund nicht auswertbar'); }
  else {
    if (/FREQ=YEARLY/.test(mB[1])) { ok('jährliche Regeln werden übernommen'); }
    else { fail('auch jährliche werden übersprungen'); }
    if (/INTERVAL=\(\?!1/.test(mB[1])) { ok('alle zwei Jahre bleibt draussen'); }
    else { fail('ein Zweijahresrhythmus käme als jährlich an'); }
    /* Ein jährlicher darf nicht am Stichtag scheitern */
    if (/!e\.rrule &&/.test(mB[1])) { ok('der Stichtag greift bei jährlichen nicht'); }
    else { fail('ein Geburtstag von 1954 fiele durch den Stichtag'); }
    /* Ein eintägiger jährlicher gehört zu den Jahresterminen */
    if (/\|\| !!e\.jaehrlich/.test(mB[1])) {
      ok('ein eintägiger jährlicher wird ein Jahrestermin');
    } else { fail('ein Geburtstag käme als gewöhnlicher Termin an'); }
  }

  /* Ausfuhr trägt die Regel mit */
  const mBl = JSK.match(/function icsBlock\(e, stempel\) \{([\s\S]*?)\n\}/);
  if (mBl && /RRULE:FREQ=YEARLY/.test(mBl[1])) {
    ok('jährliche gehen mit ihrer Regel hinaus');
  } else { fail('ein jährlicher Eintrag stünde in Google nur einmal'); }

  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 30) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 79 · Serientermine ═══════════════════════════════════════════════
   Fehlerarten: wöchentliche und monatliche Termine werden übersprungen
   und fehlen im Tagesplan; oder sie erscheinen überall und machen
   Wochen-, Monats- und Jahresblatt unlesbar; die Regel wird falsch
   gerechnet — der 31. fällt in kurzen Monaten aus, ein Zähler läuft
   unbegrenzt weiter; eine gespiegelte Serie wird zurückexportiert und
   verfälscht dabei ihre Regel.
   ═══════════════════════════════════════════════════════════════════════ */
kat('79 · Serientermine');
{
  ['rrZerlegen', 'wtFaellig', 'wtAnTag', 'wtLoeschen'].forEach(function (f) {
    if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
    else { fail(f + ' fehlt'); }
  });

  /* Die Regeln wirklich rechnen */
  const teile = ['isoPlus', 'isoWt', 'isoMontag', 'wochenAbstand', 'wtFaellig',
                 'rrZerlegen'].map(function (n) {
    const m = JSK.match(new RegExp('function ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
    return m ? m[0] : null;
  });
  if (teile.indexOf(null) !== -1) { fail('Serienlogik nicht auswertbar'); }
  else {
    let w = null;
    try {
      w = new Function('const RR_TAGE = { MO:0, TU:1, WE:2, TH:3, FR:4, SA:5, SU:6 };' +
        teile.join('\n') +
        '\nreturn function (rr, start, tage) {' +
        '  const r = rrZerlegen(rr, start); if (!r) { return null; }' +
        '  const l = []; let d = start;' +
        '  for (let i = 0; i < tage; i++) { if (wtFaellig(r, d)) { l.push(d); }' +
        '    d = isoPlus(d, 1); } return { regel:r, treffer:l }; };')();
    } catch (e) { w = null; }
    if (!w) { fail('Serienlogik nicht ausführbar'); }
    else {
      let f = 0;
      const F = [
        ['FREQ=WEEKLY;BYDAY=MO', '2026-08-03', 30,
         ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24'], 'wöchentlich montags'],
        ['FREQ=WEEKLY;BYDAY=TU,TH;INTERVAL=2', '2026-08-04', 20,
         ['2026-08-04', '2026-08-06', '2026-08-18', '2026-08-20'], 'jede zweite Woche'],
        ['FREQ=MONTHLY;BYMONTHDAY=15', '2026-08-15', 100,
         ['2026-08-15', '2026-09-15', '2026-10-15', '2026-11-15'], 'monatlich am 15.'],
        /* Der 31. rueckt in kuerzeren Monaten auf den letzten Tag */
        ['FREQ=MONTHLY;INTERVAL=3', '2026-08-31', 100,
         ['2026-08-31', '2026-11-30'], 'alle drei Monate am 31.'],
        ['FREQ=WEEKLY;BYDAY=FR;COUNT=3', '2026-08-07', 60,
         ['2026-08-07', '2026-08-14', '2026-08-21'], 'dreimal freitags'],
        /* Mit Enddatum: danach ist Schluss */
        ['FREQ=WEEKLY;BYDAY=WE;UNTIL=20260826T235959Z', '2026-08-05', 60,
         ['2026-08-05', '2026-08-12', '2026-08-19', '2026-08-26'], 'mittwochs bis 26.08.'],
      ];
      F.forEach(function (x) {
        const r = w(x[0], x[1], x[2]);
        if (!r) { f++; fail(x[4] + ': Regel nicht erkannt'); return; }
        const soll = x[3].join(',');
        const ist = r.treffer.slice(0, x[3].length).join(',');
        if (ist !== soll) { f++; fail(x[4] + ': ' + ist); }
        /* Bei COUNT muss die Serie auch wirklich enden */
        if (/COUNT/.test(x[0]) && r.treffer.length !== 3) {
          f++; fail(x[4] + ': ' + r.treffer.length + ' statt 3 Termine');
        }
        if (/UNTIL/.test(x[0]) && r.treffer.length !== 4) {
          f++; fail(x[4] + ': ' + r.treffer.length + ' statt 4 Termine');
        }
      });
      if (!f) { ok(F.length + ' Serienregeln korrekt gerechnet'); }
      /* Jährliches gehört nicht hierher */
      if (w('FREQ=YEARLY', '2026-08-01', 5) === null) { ok('jährliche bleiben Jahrestermine'); }
      else { fail('jährliche würden zu Serienterminen'); }
    }
  }

  /* Nur im Tagesblatt */
  const mT = JSK.match(/function blattTag\(\) \{([\s\S]*?)\n\}/);
  if (mT && /wtAnTag\(tagOffen\)/.test(mT[1])) { ok('Serien stehen im Tagesblatt'); }
  else { fail('Serien fehlen im Tagesplan'); }
  ['blattWoche', 'blattMonat', 'blattJahrestermine'].forEach(function (n) {
    const m = JSK.match(new RegExp('function ' + n + '\\(\\) \\{([\\s\\S]*?)\\n\\}'));
    if (m && !/wtAnTag/.test(m[1])) { ok(n + ' bleibt frei davon'); }
    else { fail(n + ': die Serien machen das Blatt unlesbar'); }
  });

  /* Sie werden gespiegelt, nicht zurückgeführt */
  const mE = JSK.match(/function icsEintraege\(\) \{([\s\S]*?)\n\}/);
  if (mE && !/WTERMINE/.test(mE[1])) { ok('Serien gehen nicht zurück nach Google'); }
  else { fail('eine zurückgeführte Serie verfälscht ihre Regel'); }
  /* Eine Serie laesst sich jetzt loesen: was in Google geloescht wurde,
     sieht TimeAssist nicht und muss hier von Hand weg.               */
  if (mT && /serieAuf\(/.test(mT[1])) {
    ok('eine Serie lässt sich anfassen');
  } else { fail('eine Serie ist nicht loszuwerden'); }

  const mV = JS.match(/const DB_VERSION = (\d+)/);
  if (mV && parseInt(mV[1], 10) >= 31) { ok('Schemaversion auf ' + mV[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══ 80 · Filter im Jahresblatt ═══════════════════════════════════════
   Fehlerarten: die Zusammenfassung steht unter den Einträgen, wo sie
   niemand sucht; ein Filter wirkt nur auf die Liste, nicht auf das
   Raster — beide zeigen dann Verschiedenes; ein Eintrag mit unbekannter
   Art fällt durch jeden Filter und ist unerreichbar.
   ═══════════════════════════════════════════════════════════════════════ */
kat('80 · Filter im Jahresblatt');
{
  ['jtFilterSetzen', 'jtFilterPasst'].forEach(function (f) {
    if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
    else { fail(f + ' fehlt'); }
  });

  const mJ = JSK.match(/function blattJahrestermine\(\) \{([\s\S]*?)\n\}/);
  if (!mJ) { fail('blattJahrestermine nicht auswertbar'); }
  else {
    const t = mJ[1];
    /* Reihenfolge: Raster, Zusammenfassung, Einträge */
    const iR = t.indexOf('</tbody></table>');
    const iS = t.indexOf('Summe je Art');
    const iE = t.indexOf("abschnitt('Eintr");
    if (iR !== -1 && iS !== -1 && iE !== -1 && iR < iS && iS < iE) {
      ok('erst Raster, dann Zusammenfassung, dann Einträge');
    } else { fail('die Zusammenfassung steht an der falschen Stelle'); }
    if (/jtFilterSetzen\(/.test(t)) { ok('die Zusammenfassung filtert'); }
    else { fail('die Summenzeilen sind nicht anklickbar'); }
    if (/jtFilterSetzen\(null\)/.test(t)) { ok('eine Zeile Alle hebt den Filter auf'); }
    else { fail('kein Weg zurück zu allen Einträgen'); }
    /* Die Liste muss ebenfalls gefiltert werden */
    if (/if \(!jtFilterPasst\(j\)\) \{ return false; \}/.test(t)) {
      ok('die Liste folgt dem Filter');
    } else { fail('die Liste zeigt weiterhin alles'); }
  }

  /* Das Raster muss demselben Filter folgen */
  const mA = JSK.match(/function jtAnTag\(iso\) \{([\s\S]*?)\n\}/);
  if (mA && /jtFilterPasst\(j\)/.test(mA[1])) { ok('das Raster folgt dem Filter'); }
  else { fail('Raster und Liste zeigen Verschiedenes'); }
  if (mA && /!jtFilter \|\| jtFilter === 'termin'/.test(mA[1])) {
    ok('ganztägige Termine folgen dem Filter Termin');
  } else { fail('ganztägige Termine ignorieren den Filter'); }

  /* Eine unbekannte Art darf nicht unerreichbar werden */
  const mP = JSK.match(/function jtFilterPasst\(j\) \{[\s\S]*?\n\}/);
  if (!mP) { fail('jtFilterPasst nicht auswertbar'); }
  else {
    let fn = null;
    try {
      fn = new Function('f',
        'let jtFilter = f; const JT_ARTEN = { urlaub:{}, termin:{}, geburtstag:{} };' +
        mP[0] + '\nreturn jtFilterPasst;');
    } catch (e) { fn = null; }
    if (!fn) { fail('jtFilterPasst nicht ausführbar'); }
    else {
      const J = [{ art:'urlaub' }, { art:'geburtstag' }, { art:'termin' },
                 { art:'unbekannt' }];
      const zaehl = k => J.filter(fn(k)).length;
      let f = 0;
      if (zaehl(null) !== 4) { f++; fail('ohne Filter fehlen Einträge'); }
      if (zaehl('urlaub') !== 1) { f++; fail('Filter Urlaub: ' + zaehl('urlaub')); }
      /* Unbekannte Arten zählen als Termin — sonst wären sie in keinem
         Filter zu finden.                                            */
      if (zaehl('termin') !== 2) { f++; fail('unbekannte Art ist unerreichbar'); }
      if (!f) { ok('Filter trifft jede Art, auch unbekannte'); }
    }
  }

  /* Ein zweites Antippen derselben Art hebt den Filter auf */
  const mS = JSK.match(/function jtFilterSetzen\(k\) \{([\s\S]*?)\n\}/);
  if (mS && /k !== jtFilter/.test(mS[1])) { ok('nochmals antippen hebt auf'); }
  else { fail('ein gesetzter Filter lässt sich nur über Alle lösen'); }
}

/* ═══ 81 · Drucksatz ═══════════════════════════════════════════════════
   Fehlerarten: eine lange Tabelle läuft über den Seitenrand hinaus statt
   umzubrechen; auf der Folgeseite fehlt die Kopfzeile und niemand weiss
   mehr, welche Spalte was ist; ein Bauplan enthält Geometrie und passt
   dann nur in ein Format; ein Blatt ohne Inhalt erzeugt ein leeres PDF
   statt einer Ansage.
   ═══════════════════════════════════════════════════════════════════════ */
kat('81 · Drucksatz');
{
  ['druckSetzen', 'druckAuf', 'druckLos', 'druckRender'].forEach(function (f) {
    if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
    else { fail(f + ' fehlt'); }
  });

  /* Jedes Blatt braucht einen Bauplan, und jeder Bauplan ein Blatt */
  const mB = JS.match(/const DR_BLAETTER = \{([\s\S]*?)\n\};/);
  const mA = JS.match(/const DR_BAU = \{([\s\S]*?)\};/);
  if (!mB || !mA) { fail('DR_BLAETTER oder DR_BAU nicht gefunden'); }
  else {
    const bl = (mB[1].match(/^\s*(\w+):/gm) || []).map(s => s.replace(/[^\w]/g, ''));
    const bau = (mA[1].match(/(\w+):\s*dr\w+/g) || []).map(s => s.split(':')[0].trim());
    /* Das Heft baut sich selbst — feste Seiten und Sprungmarken passen
       nicht in den fliessenden Satz. Es braucht deshalb keinen Bauplan,
       aber einen eigenen Weg im Druckknopf.                          */
    const SELBST = ['heft'];
    const fehlt = bl.filter(k => bau.indexOf(k) === -1 && SELBST.indexOf(k) === -1);
    if (!fehlt.length) {
      ok(bl.length + ' Blätter: ' + (bl.length - SELBST.length) +
         ' mit Bauplan, ' + SELBST.length + ' selbstbauend');
    } else { fail('ohne Bauplan: ' + fehlt.join(', ')); }
    SELBST.forEach(function (k) {
      const m = JSK.match(/function druckLos\(\) \{([\s\S]*?)\n\}/);
      if (m && new RegExp("drBlatt === '" + k + "'").test(m[1])) {
        ok(k + ' hat einen eigenen Weg');
      } else { fail(k + ' ist wählbar, tut aber nichts'); }
    });
    /* Und jede Bauplanfunktion muss es geben */
    const namen = (mA[1].match(/dr[A-Z]\w+/g) || []);
    const ohne = namen.filter(n => !new RegExp('function ' + n + '\\b').test(JS));
    if (!ohne.length) { ok('alle Bauplanfunktionen vorhanden'); }
    else { fail('fehlende Funktionen: ' + ohne.join(', ')); }
  }

  /* Ein Bauplan darf keine Geometrie kennen */
  ['drTag', 'drWoche', 'drMonat', 'drJahr', 'drCheckliste', 'drPlan', 'drZiel',
   'drNotiz', 'drJournal'].forEach(function (n) {
    /* Manche Baupläne nehmen ein zweites Argument — Tag oder Montag */
    const m = JSK.match(new RegExp('function ' + n +
      '\\(o(?:, \\w+)?\\) \\{[\\s\\S]*?\\n\\}'));
    if (!m) { fail(n + ' nicht auswertbar'); return; }
    if (/doc\.|addPage|setFontSize|\bmm\b/.test(m[0])) {
      fail(n + ' enthält Geometrie und passt nur in ein Format');
    }
  });
  ok('kein Bauplan kennt Geometrie');

  /* Der Umbruch: nachgebaut mit denselben Maßen */
  const mF = JS.match(/const DR_FORMATE = \{([\s\S]*?)\n\};/);
  if (!mF) { fail('DR_FORMATE nicht gefunden'); }
  else {
    let werte = null;
    try { werte = new Function('return {' + mF[1] + '};')(); } catch (e) { werte = null; }
    if (!werte) { fail('DR_FORMATE nicht auswertbar'); }
    else {
      let f = 0;
      Object.keys(werte).forEach(function (k) {
        const F = werte[k];
        const nutz = F.h - F.rand - F.fussrand;
        if (nutz < F.tabzh * 8) {
          f++; fail(k + ': nur ' + Math.floor(nutz / F.tabzh) + ' Zeilen je Seite');
        }
        /* Der Rand muss innerhalb des Blattes liegen */
        if (F.rand * 2 >= F.b) { f++; fail(k + ': Rand grösser als das Blatt'); }
      });
      if (!f) {
        ok(Object.keys(werte).length + ' Formate mit brauchbarer Nutzhöhe');
      }
      /* Seitenzahl für eine lange Liste */
      const a4 = werte.a4;
      const proSeite = Math.floor((a4.h - a4.rand - a4.fussrand) / a4.tabzh);
      if (proSeite >= 30 && proSeite <= 60) {
        ok('A4 fasst ' + proSeite + ' Tabellenzeilen je Seite');
      } else { fail('A4 fasst ' + proSeite + ' Zeilen — unplausibel'); }
    }
  }

  /* Umbruch und wiederholte Kopfzeile */
  const mS = JSK.match(/function druckSetzen\(bauplan, formatKey, dateiname\) \{([\s\S]*?)\n\}\n/);
  if (!mS) { fail('druckSetzen nicht auswertbar'); }
  else {
    if (/if \(y \+ hoehe > UNTEN\) \{ neueSeite\(\)/.test(mS[1])) {
      ok('der Setzer bricht um, statt über den Rand zu laufen');
    } else { fail('lange Blätter laufen über den Seitenrand'); }
    if (/kopfzeile = kopf;/.test(mS[1])) {
      ok('die Tabellenkopfzeile wiederholt sich auf Folgeseiten');
    } else { fail('auf Seite 2 fehlt die Kopfzeile'); }
    /* Die vorherige Kopfzeile muss zurückgesetzt werden */
    if (/kopfzeile = vorher;/.test(mS[1])) {
      ok('nach der Tabelle gilt die Kopfzeile nicht mehr');
    } else { fail('die Kopfzeile bleibt auf allen Folgeseiten stehen'); }
    if (/seitenfuss\(\)/.test(mS[1])) { ok('jede Seite trägt Fuss und Seitenzahl'); }
    else { fail('keine Seitenzahl'); }
    /* Spaltenbreiten als Anteile, nicht in Millimetern */
    if (/BR \* \(s\.b \|\| 1\) \/ summe/.test(mS[1])) {
      ok('Spaltenbreiten als Anteile — dieselbe Tabelle passt in jedes Format');
    } else { fail('Spaltenbreiten fest in Millimetern'); }
  }

  /* Ein Blatt ohne Inhalt muss es sagen */
  const mR = JSK.match(/function druckRender\(\) \{([\s\S]*?)\n\}/);
  if (mR && /Es ist kein Plan aufgeschlagen/.test(mR[1])) {
    ok('ohne aufgeschlagenen Plan wird nichts gedruckt');
  } else { fail('ein leeres PDF statt einer Ansage'); }
  if (mR && /kn\.disabled = !!hinweis/.test(mR[1])) { ok('der Knopf sperrt dann'); }
  else { fail('man könnte trotzdem drucken'); }
}

/* ═══ 82 · Wochensatz ══════════════════════════════════════════════════
   Fehlerarten: der Satz druckt immer dieselbe Woche, weil die Baupläne
   an den globalen Zustand gebunden sind; die Tagesblätter laufen
   ineinander statt auf eigene Seiten; ein Tag ohne eigenes Blatt legt
   beim Drucken einen Datensatz für den falschen Tag an.
   ═══════════════════════════════════════════════════════════════════════ */
kat('82 · Wochensatz');
{
  if (/function drWochensatz\b/.test(JS)) { ok('drWochensatz vorhanden'); }
  else { fail('drWochensatz fehlt'); }

  /* Die Baupläne müssen ein Datum annehmen, sonst druckt der Satz
     siebenmal denselben Tag.                                         */
  const mT = JSK.match(/function drTag\(o, iso\) \{([\s\S]*?)\n\}/);
  if (mT) { ok('drTag nimmt ein Datum an'); }
  else { fail('drTag hängt am aufgeschlagenen Tag'); }
  if (mT && !/\btagOffen\b/.test(mT[1].replace(/iso \|\| tagOffen/, ''))) {
    ok('drTag greift nicht mehr auf den offenen Tag durch');
  } else { fail('drTag liest doch wieder den globalen Tag'); }
  const mW = JSK.match(/function drWoche\(o, montag\) \{([\s\S]*?)\n\}/);
  if (mW) { ok('drWoche nimmt einen Montag an'); }
  else { fail('drWoche hängt an der offenen Woche'); }

  /* tagBlattFuer darf keinen Datensatz für den falschen Tag anlegen */
  const mB = JSK.match(/function tagBlattFuer\(iso\) \{([\s\S]*?)\n\}/);
  if (mB && /datum:iso/.test(mB[1]) && !/tagOffen/.test(mB[1])) {
    ok('ein neues Tagesblatt trägt das richtige Datum');
  } else { fail('beim Drucken entstünde ein Blatt für den falschen Tag'); }
  const mG = JSK.match(/function ganztagsEintraegeFuer\(D\) \{([\s\S]*?)\n\}/);
  if (mG && !/tagOffen/.test(mG[1])) { ok('das Ganztags-Band folgt dem Datum'); }
  else { fail('das Band zeigt immer den offenen Tag'); }

  /* Der Satz selbst */
  const mS = JSK.match(/function drWochensatz\(o\) \{([\s\S]*?)\n\}/);
  if (!mS) { fail('drWochensatz nicht auswertbar'); }
  else {
    if (/typ:'seitenwechsel'/.test(mS[1])) { ok('jeder Tag beginnt auf eigener Seite'); }
    else { fail('die Tagesblätter laufen ineinander'); }
    if (/o\.werktage \? 5 : 7/.test(mS[1])) { ok('wahlweise fünf oder sieben Tage'); }
    else { fail('die Zahl der Tage ist fest'); }
    if (/o\.wVor \? isoPlus\(wocheBlatt\(\)\.montag, 7\)/.test(mS[1])) {
      ok('auch die kommende Woche lässt sich drucken');
    } else { fail('nur die offene Woche druckbar'); }
    if (/drWoche\(o, montag\)/.test(mS[1]) && /drTag\(o, isoPlus\(montag, d\)\)/.test(mS[1])) {
      ok('Wochenblatt zuerst, dann die Tage der Reihe nach');
    } else { fail('Reihenfolge oder Datum falsch'); }
  }

  /* Im Wähler und mit passenden Schaltern */
  const mBl = JS.match(/const DR_BLAETTER = \{([\s\S]*?)\n\};/);
  if (mBl && /wsatz:/.test(mBl[1])) { ok('Wochensatz steht im Wähler'); }
  else { fail('der Wochensatz ist nicht wählbar'); }
  const mSch = JS.match(/const DR_SCHALTER = \{([\s\S]*?)\n\};/);
  if (mSch && /werktage:/.test(mSch[1]) && /wVor:/.test(mSch[1])) {
    ok('eigene Schalter für den Satz');
  } else { fail('Schalter fehlen'); }

  /* Der Dateiname muss die Woche nennen, nicht das Druckdatum */
  const mL = JSK.match(/function druckLos\(\) \{([\s\S]*?)\n\}/);
  if (mL && /'kw' \+ kalenderwoche\(mo\)/.test(mL[1])) {
    ok('der Dateiname nennt die Kalenderwoche');
  } else { fail('zwei Wochensätze hiessen am selben Tag gleich'); }
}

/* ═══ 83 · Move-Dreisatz ═══════════════════════════════════════════════
   Fehlerarten: das Format erreicht den Bauplan nicht, der Dreisatz greift
   nie; die Zeitleiste zeichnet Termine ausserhalb ihrer Stunden oder
   überdeckt den Seitenfuss; ein Termin ohne Ende bekommt keine Höhe; auf
   A4 wird der Tag ebenfalls zerrissen, obwohl dort alles auf eine Seite
   passt.
   ═══════════════════════════════════════════════════════════════════════ */
kat('83 · Move-Dreisatz');
{
  /* Das Format muss in den Bauplan gereicht werden */
  const mL = JSK.match(/function druckLos\(\) \{([\s\S]*?)\n\}/);
  if (mL && /format:drFormat/.test(mL[1])) { ok('das Format erreicht den Bauplan'); }
  else { fail('der Bauplan erfährt das Format nicht'); }

  const mT = JSK.match(/function drTag\(o, iso\) \{([\s\S]*?)\n\}/);
  if (!mT) { fail('drTag nicht auswertbar'); }
  else {
    const t = mT[1];
    if (/dreisatz = \(o\.format === 'move'\)/.test(t)) {
      ok('der Dreisatz gilt nur für das Move');
    } else { fail('auch A4 würde zerrissen'); }
    const n = (t.match(/typ:'seitenwechsel'/g) || []).length;
    if (n === 2) { ok('zwei Seitenwechsel — drei Seiten'); }
    else { fail(n + ' Seitenwechsel statt zwei'); }
    if (/typ:'zeitleiste'/.test(t)) { ok('Seite eins trägt die Zeitleiste'); }
    else { fail('keine Zeitleiste'); }
    if (/fuellen:true/.test(t)) { ok('die Zeitleiste füllt die Seite'); }
    else { fail('die Zeitleiste bleibt ein Streifen'); }
    /* Auf A4 bleibt die Tabelle */
    if (/spalten:\[\{ t:'Zeit', b:2 \}/.test(t)) { ok('A4 behält die Terminliste'); }
    else { fail('A4 hat keine Termine mehr'); }
  }

  /* Der Baustein muss im Setzer stehen */
  const mS = JSK.match(/function druckSetzen\(bauplan, formatKey, dateiname\) \{([\s\S]*?)\n\}\n/);
  if (!mS) { fail('druckSetzen nicht auswertbar'); }
  else {
    const z = mS[1].match(/zeitleiste: function \(b\) \{([\s\S]*?)\n    \},/);
    if (!z) { fail('Baustein zeitleiste fehlt'); }
    else {
      /* Termine ausserhalb der Stunden dürfen nicht gezeichnet werden */
      if (/if \(e <= vonSt \* 60 \|\| a >= bisSt \* 60\) \{ return; \}/.test(z[1])) {
        ok('Termine ausserhalb der Stunden bleiben draussen');
      } else { fail('ein Termin um fünf Uhr würde über den Rand gezeichnet'); }
      /* Und angeschnittene werden geklemmt */
      if (/Math\.max\(inMin\(t\.von\), vonSt \* 60\)/.test(z[1]) &&
          /Math\.min\(inMin\(t\.bis \|\| t\.von\)/.test(z[1])) {
        ok('angeschnittene Termine werden geklemmt');
      } else { fail('ein Termin über Mitternacht liefe aus dem Raster'); }
      /* Ein Termin ohne Ende braucht trotzdem Höhe */
      if (/Math\.max\(y1 \+ proStunde \* 0\.34/.test(z[1])) {
        ok('ein Termin ohne Ende bekommt eine Mindesthöhe');
      } else { fail('ein Termin ohne Endzeit wäre unsichtbar'); }
      /* Die Leiste darf den Fuss nicht überdecken */
      if (/UNTEN - y - 2/.test(z[1])) { ok('die Leiste bleibt über dem Seitenfuss'); }
      else { fail('die Zeitleiste liefe in den Fuss'); }
    }
  }

  /* Die Höhe je Stunde muss für eine Zeile reichen */
  const mF = JS.match(/const DR_FORMATE = \{([\s\S]*?)\n\};/);
  if (mF) {
    const m = /move:\s*\{[^}]*h:([\d.]+), rand:([\d.]+), fussrand:([\d.]+)/.exec(mF[1]);
    if (m) {
      const nutz = parseFloat(m[1]) - parseFloat(m[2]) - parseFloat(m[3]);
      const proStunde = (nutz - 17) / 16;
      if (proStunde >= 4) {
        ok('je Stunde ' + proStunde.toFixed(1) + ' mm — genug für eine Zeile');
      } else { fail('je Stunde nur ' + proStunde.toFixed(1) + ' mm'); }
    }
  }
}

/* ═══ 84 · Masse im Druck ══════════════════════════════════════════════
   Fehlerarten: das Kästchen wird an der Schriftgrösse bemessen und wird
   auf A4 fast acht Millimeter gross; die Terminschrift in der Zeitleiste
   ist so gross wie im Fliesstext und sprengt einen Block von wenigen
   Millimetern; freie Zeilen zum Nachtragen haben kein Kästchen — man
   kann Nachgetragenes nicht abhaken.
   ═══════════════════════════════════════════════════════════════════════ */
kat('84 · Masse im Druck');
{
  const mS = JSK.match(/function druckSetzen\(bauplan, formatKey, dateiname\) \{([\s\S]*?)\n\}\n/);
  if (!mS) { fail('druckSetzen nicht auswertbar'); }
  else {
    /* Das Kaestchen haengt an der Zeilenhoehe */
    if (/kastenMass = function \(\) \{ return F\.zh \* 0\.62; \}/.test(mS[1])) {
      ok('das Kästchen ist an der Zeilenhöhe bemessen');
    } else { fail('das Kästchen hängt an der Schriftgrösse'); }
    if (!/const s = F\.fs\.text \* 0\.34/.test(mS[1])) {
      ok('keine Bemessung mehr über die Schriftgrösse');
    } else { fail('die alte Bemessung steht noch da'); }
    /* Die Terminschrift in der Leiste ist die kleine */
    const z = mS[1].match(/zeitleiste: function \(b\) \{([\s\S]*?)\n    \},/);
    if (z && /doc\.setFontSize\(F\.fs\.klein\);\s*\n\s*doc\.text\(kurz\(t\.t/.test(z[1])) {
      ok('Termine in der Zeitleiste in kleiner Schrift');
    } else { fail('die Terminschrift ist so gross wie der Fliesstext'); }
    /* Freie Zeilen koennen ein Kaestchen tragen */
    const l = mS[1].match(/linien: function \(b\) \{([\s\S]*?)\n    \},/);
    if (l && /if \(b\.kasten\)/.test(l[1])) { ok('freie Zeilen können ein Kästchen tragen'); }
    else { fail('freie Zeilen bleiben ohne Kästchen'); }
  }

  /* Die Masse wirklich rechnen */
  const mF = JS.match(/const DR_FORMATE = \{([\s\S]*?)\n\};/);
  if (mF) {
    let f = 0;
    [['a4', 6.2], ['move', 4.6]].forEach(function (x) {
      const m = new RegExp(x[0] + ':[\\s\\S]*?zh:([\\d.]+)').exec(mF[1]);
      if (!m) { f++; fail(x[0] + ': Zeilenhöhe nicht gefunden'); return; }
      const kasten = parseFloat(m[1]) * 0.62;
      /* Zwischen zwei und fuenf Millimetern ist ein Kaestchen brauchbar */
      if (kasten < 2 || kasten > 5) {
        f++; fail(x[0] + ': Kästchen ' + kasten.toFixed(1) + ' mm');
      }
    });
    if (!f) { ok('Kästchen in beiden Formaten zwischen 2 und 5 mm'); }
  }

  /* Die abhakbaren Blöcke müssen Kästchen haben, die anderen nicht */
  const bl = (JSK.match(/typ:'linien'[^}]*/g) || []);
  const mit = bl.filter(x => /kasten:true/.test(x)).length;
  if (mit >= 6) { ok(mit + ' von ' + bl.length + ' Zeilenblöcken mit Kästchen'); }
  else { fail('nur ' + mit + ' Zeilenblöcke zum Abhaken'); }
  /* Reflexion und Notizen brauchen keine */
  const mT = JSK.match(/function drTag\(o, iso\) \{([\s\S]*?)\n\}/);
  if (mT) {
    const nachNotizen = mT[1].slice(mT[1].indexOf("t:'Notizen'"));
    if (!/kasten:true/.test(nachNotizen)) { ok('Notizzeilen bleiben ohne Kästchen'); }
    else { fail('auch die Notizen bekommen Kästchen'); }
  }
}

/* ═══ 85 · Monatsheft für den Move ═════════════════════════════════════
   Fehlerarten: die Sprungmarken zeigen auf falsche Seiten, weil die
   Seitenzahlen erst beim Zeichnen entstehen; ein Monat mit sechs
   berührten Wochen verschiebt alles danach; das Heft ist bunt oder
   graustufig statt schwarzweiss — auf E-Papier nur Unschärfe; ein Tag
   ausserhalb des Monats bekommt eine Sprungmarke ins Leere.
   ═══════════════════════════════════════════════════════════════════════ */
kat('85 · Monatsheft');
{
  ['heftBauen', 'jtAnTagRoh'].forEach(function (f) {
    if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
    else { fail(f + ' fehlt'); }
  });

  const mH = JSK.match(/function heftBauen\(o\) \{([\s\S]*?)\n\}\n/);
  if (!mH) { fail('heftBauen nicht auswertbar'); }
  else {
    const t = mH[1];
    /* Erst zaehlen, dann zeichnen */
    const iP = t.indexOf('P.notiz = s;');
    const iZ = t.indexOf('neueSeite();');
    if (iP !== -1 && iZ !== -1 && iP < iZ) {
      ok('die Seitenzahlen stehen fest, bevor gezeichnet wird');
    } else { fail('Sprungmarken zeigten auf noch unbekannte Seiten'); }
    if (/doc\.link\(/.test(t)) { ok('Sprungmarken sind gesetzt'); }
    else { fail('keine Verweise im Heft'); }
    /* Schwarzweiss: keine Farbe ausser Grauwerten */
    const farben = (t.match(/set(?:Text|Draw|Fill)Color\(([^)]*)\)/g) || []);
    const bunt = farben.filter(function (f) {
      const z = f.match(/-?\d+/g) || [];
      return z.length === 3 && !(z[0] === z[1] && z[1] === z[2]);
    });
    if (!bunt.length) { ok(farben.length + ' Farbangaben, alle schwarzweiss'); }
    else { fail('bunte Farbe im Heft: ' + bunt[0]); }
    /* Punktraster */
    if (/raster = function/.test(t) && /doc\.circle/.test(t)) {
      ok('Punktraster als Schreibgrund');
    } else { fail('kein Punktraster'); }
    /* Ein Tag ausserhalb des Monats darf keine Marke bekommen */
    if (/if \(drin\) \{\s*\n\s*doc\.link/.test(t)) {
      ok('nur Tage des Monats tragen eine Sprungmarke');
    } else { fail('ein Nachbartag verwiese ins Leere'); }
  }

  /* Die Seitenrechnung wirklich nachrechnen */
  const teile = ['isoPlus', 'isoWt', 'isoMontag'].map(function (n) {
    const m = JSK.match(new RegExp('function ' + n + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
    return m ? m[0] : null;
  });
  if (teile.indexOf(null) === -1) {
    const f = new Function(teile.join('\n') +
      '\nreturn function (monatOffen) {' +
      '  const jahr = parseInt(monatOffen.slice(0, 4), 10);' +
      '  const monat = parseInt(monatOffen.slice(5), 10);' +
      '  const tage = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();' +
      '  const letzter = monatOffen + "-" + String(tage).padStart(2, "0");' +
      '  let mo = isoMontag(monatOffen + "-01"), w = 0;' +
      '  while (mo <= letzter) { w += 1; mo = isoPlus(mo, 7); }' +
      '  return { tage:tage, wochen:w, gesamt:1 + w + tage + 4 + 2 + 20 }; };')();
    const F = [['2026-09', 30, 5], ['2026-08', 31, 6], ['2027-02', 28, 4]];
    let fe = 0;
    F.forEach(function (x) {
      const r = f(x[0]);
      if (r.tage !== x[1] || r.wochen !== x[2]) {
        fe++; fail(x[0] + ': ' + r.tage + ' Tage, ' + r.wochen + ' Wochen');
      }
    });
    if (!fe) { ok('Seitenrechnung stimmt, auch bei sechs berührten Wochen'); }
    const sep = f('2026-09');
    if (sep.gesamt === 62) { ok('September 2026: ' + sep.gesamt + ' Seiten'); }
    else { fail('September ergibt ' + sep.gesamt + ' Seiten'); }
  }

  /* Die Masse müssen zum Schreiben taugen */
  const mF = JS.match(/const HF = \{([\s\S]*?)\n\};/);
  if (!mF) { fail('HF nicht gefunden'); }
  else {
    const z = {};
    ['b', 'h', 'rand', 'kopf', 'fuss'].forEach(function (k) {
      const m = new RegExp(k + ':\\s*([\\d.]+)').exec(mF[1]);
      if (m) { z[k] = parseFloat(m[1]); }
    });
    const nutz = z.h - z.rand - z.kopf - z.fuss;
    const proStunde = nutz * 0.66 / 16;
    if (proStunde >= 4) {
      ok('Tagesraster ' + proStunde.toFixed(1) + ' mm je Stunde');
    } else { fail('nur ' + proStunde.toFixed(1) + ' mm je Stunde'); }
    const zelle = (z.b - 2 * z.rand) / 7;
    if (zelle >= 9) { ok('Monatszelle ' + zelle.toFixed(1) + ' mm breit'); }
    else { fail('Monatszelle nur ' + zelle.toFixed(1) + ' mm'); }
  }

  const mBl = JS.match(/const DR_BLAETTER = \{([\s\S]*?)\n\};/);
  if (mBl && /heft:/.test(mBl[1])) { ok('das Heft steht im Wähler'); }
  else { fail('das Heft ist nicht wählbar'); }
  const mL = JSK.match(/function druckLos\(\) \{([\s\S]*?)\n\}/);
  if (mL && /drBlatt === 'heft'\) \{ heftBauen/.test(mL[1])) {
    ok('der Druckknopf baut das Heft');
  } else { fail('der Knopf führt ins Leere'); }
}

/* ═══ 86 · Serien lösen ════════════════════════════════════════════════
   Fehlerart: Serientermine sind gespiegelt und unantastbar. Was in Google
   gelöscht wurde, sieht TimeAssist aber nicht — in einer Exportdatei
   fehlt es einfach. Der Eintrag bleibt dann für immer stehen.
   ═══════════════════════════════════════════════════════════════════════ */
kat('86 · Serien lösen');
{
  ['wtAusnahme', 'wtVerselbstaendigen', 'serieAuf', 'serieZu']
    .forEach(function (f) {
      if (new RegExp('function ' + f + '\\b').test(JS)) { ok(f + ' vorhanden'); }
      else { fail(f + ' fehlt'); }
    });

  /* Die Ausnahme muss beim Rechnen greifen */
  const mF = JSK.match(/function wtFaellig\(r, iso, ohneEnde, aus\) \{[\s\S]*?\n\}/);
  if (!mF) { fail('wtFaellig nimmt keine Ausnahmen an'); }
  else {
    if (/aus && aus\.indexOf\(iso\) !== -1/.test(mF[0])) {
      ok('ausgenommene Tage fallen aus der Serie');
    } else { fail('die Ausnahme wird nicht geprüft'); }
    const mA = JSK.match(/function wtAnTag\(iso\) \{[\s\S]*?\n\}/);
    if (mA && /w\.aus/.test(mA[0])) { ok('das Tagesblatt reicht sie durch'); }
    else { fail('die Ausnahme erreicht die Anzeige nicht'); }

    /* Wirklich rechnen */
    const teile = ['isoPlus', 'isoWt', 'isoMontag', 'wochenAbstand']
      .map(function (n) {
        const m = JSK.match(new RegExp('function ' + n +
          '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
        return m ? m[0] : '';
      }).join('\n');
    let fn = null;
    try { fn = new Function(teile + '\n' + mF[0] + '\nreturn wtFaellig;')(); }
    catch (e) { fn = null; }
    if (!fn) { fail('wtFaellig nicht ausführbar'); }
    else {
      const r = { freq:'woche', intervall:1, ab:'2026-08-03', bis:'', tage:[0] };
      let f = 0;
      if (!fn(r, '2026-08-10', false, [])) { f++; fail('normaler Montag fehlt'); }
      if (fn(r, '2026-08-10', false, ['2026-08-10'])) {
        f++; fail('der ausgenommene Tag erscheint trotzdem');
      }
      if (!fn(r, '2026-08-17', false, ['2026-08-10'])) {
        f++; fail('die Ausnahme trifft auch andere Tage');
      }
      if (!f) { ok('die Ausnahme trifft genau einen Tag'); }
    }
  }

  /* Verselbständigen macht einen echten Termin und nimmt den Tag aus */
  const mV = JSK.match(/function wtVerselbstaendigen\(id, iso\) \{([\s\S]*?)\n\}/);
  if (!mV) { fail('wtVerselbstaendigen nicht auswertbar'); }
  else {
    if (/TERMINE\.push\(t\)/.test(mV[1]) && /wtAusnahme\(id, iso\)/.test(mV[1])) {
      ok('der Termin wird echt und fällt aus der Serie');
    } else { fail('der Termin stünde danach doppelt da'); }
    if (/uid:null/.test(mV[1])) { ok('ohne fremde Kennung — er gehört jetzt hierher'); }
    else { fail('er trüge die Kennung der Serie weiter'); }
  }

  /* Drei Wege im Dialog */
  const mD = JSK.match(/function serieAuf\(id, iso\) \{([\s\S]*?)\n\}/);
  if (!mD) { fail('serieAuf nicht auswertbar'); }
  else {
    ['wtVerselbstaendigen', 'wtAusnahme', 'wtLoeschen'].forEach(function (x) {
      if (mD[1].indexOf(x) !== -1) { ok('Dialog bietet ' + x); }
      else { fail(x + ' fehlt im Dialog'); }
    });
    if (/seit/.test(mD[1])) { ok('der Dialog nennt die Regel der Serie'); }
    else { warn('man erführe nicht, welche Serie man löscht'); }
  }

  const mM = JSK.match(/function migriereDB\(d\) \{([\s\S]*?)\n\}\n/);
  if (mM && /Array\.isArray\(w\.aus\)/.test(mM[1])) {
    ok('Migration ergänzt die Ausnahmeliste');
  } else { fail('vorhandene Serien hätten keine Ausnahmeliste'); }
  const mVer = JS.match(/const DB_VERSION = (\d+)/);
  if (mVer && parseInt(mVer[1], 10) >= 32) { ok('Schemaversion auf ' + mVer[1]); }
  else { fail('Schemaversion nicht erhöht'); }
}

/* ═══════════════════════════════════════════════════════════════════════
   ERGEBNIS
   ═══════════════════════════════════════════════════════════════════════ */
console.log('\n' + '═'.repeat(66));
console.log('ERGEBNIS   ok: ' + nOk + '   warn: ' + nWarn + '   FAIL: ' + nFail);
console.log('Datei: ' + PFAD);
console.log('═'.repeat(66));
process.exit(nFail > 0 ? 1 : 0);
