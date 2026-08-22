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
const JSK = JS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

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
  if (mB && /mdZuHtml\(n\.text\)/.test(mB[1]) && /textarea/.test(mB[1])) {
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

  const mG = JSK.match(/function ganztagsEintraege\(\) \{([\s\S]*?)\n\}/);
  if (!mG) { fail('ganztagsEintraege nicht auswertbar'); }
  else if (/if \(j\.nurJahr\) \{ return; \}/.test(mG[1])) {
    ok('Tagesblatt lässt Jahresrahmen draußen');
  } else { fail('Jahresrahmen erscheint im Tagesblatt'); }

  const mW = JSK.match(/function blattWoche\(\) \{([\s\S]*?)\n\}/);
  if (mW && /!j\.nurJahr && iso >= j\.von/.test(mW[1])) {
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
    ['besuche', 'sonstiges'].forEach(function (x) {
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
  const mG = JSK.match(/function ganztagsEintraege\(\) \{([\s\S]*?)\n\}/);
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
  if (mT && /tr class="leer klick"/.test(mT[1])) {
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
      fn = new Function('zustand',
        'let avSeite = zustand.seite, avStriche = zustand.striche;' +
        'const $ = () => ({ clientWidth: 800 });' +
        'const avMalen = () => {}; const avSichernSpaeter = () => {};' +
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
        [{ refArt:'termin' }, 'termin'],
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
    /* Eine einzelne Zeile darf ausschreiben */
    if (/l\.length === 1 \? ' einzeln' : ''/.test(mW[1])) {
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
  const mG = JSK.match(/function ganztagsEintraege\(\) \{([\s\S]*?)\n\}/);
  if (mG && /id:t\.id/.test(mG[1])) { ok('eigene Termine tragen ihre Kennung mit'); }
  else { fail('im Band ist nicht unterscheidbar, was eigen ist'); }
  const mT = JSK.match(/function blattTag\(\) \{([\s\S]*?)\n\}/);
  if (mT && /g\.id \? ' eigen' : ''/.test(mT[1]) && /terminLoeschen\(' \+ g\.id/.test(mT[1])) {
    ok('ganztägige Termine sind im Band bearbeitbar');
  } else { fail('ganztägige Termine lassen sich nicht anfassen'); }
  /* Fremdes darf nicht anklickbar sein */
  if (mG && /l\.push\(\{ t:j\.t, quelle:'Jahrestermin' \}\)/.test(mG[1])) {
    ok('Jahrestermine und Feiertage bleiben Hinweis');
  } else { warn('Herkunft im Band nicht mehr unterscheidbar'); }

  const mL = JSK.match(/function terminLoeschen\(id\) \{([\s\S]*?)\n\}/);
  if (!mL) { fail('terminLoeschen nicht auswertbar'); }
  else {
    if (/WOCHENBLAETTER\.forEach/.test(mL[1]) && /MONATSBLAETTER\.forEach/.test(mL[1])) {
      ok('Verweise aus Wochen- und Monatsblatt werden mitgeräumt');
    } else { fail('gelöschter Termin hinterlässt "entfallen" auf anderen Blättern'); }
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
  ['schritteUm', 'werUm', 'planAufTag', 'planOeffnen'].forEach(function (f) {
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
    if (/p\.geplant === tagOffen/.test(mT[1])) { ok('Pläne lassen sich auf den Tag legen'); }
    else { fail('ein Plan erreicht das Tagesblatt nicht'); }
    /* Die Zeilenzählung muss die Planzeilen mitzählen, sonst überlappen
       sie mit den Leerzeilen darunter.                                */
    if (/liste\.length \+ weg\.length \+ tagPlaene\.length/.test(mT[1])) {
      ok('die Planzeilen zählen bei den Blattzeilen mit');
    } else { fail('Planzeilen werden bei der Zeilenzahl übergangen'); }
  }

  const mP = JSK.match(/function blattPlan\(pid\) \{([\s\S]*?)\n\}/);
  if (!mP) { fail('blattPlan nicht auswertbar'); }
  else {
    if (/planAufTag\(/.test(mP[1])) { ok('vom Planblatt auf den Tag'); }
    else { fail('kein Weg, den Plan auf einen Tag zu legen'); }
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

/* ═══════════════════════════════════════════════════════════════════════
   ERGEBNIS
   ═══════════════════════════════════════════════════════════════════════ */
console.log('\n' + '═'.repeat(66));
console.log('ERGEBNIS   ok: ' + nOk + '   warn: ' + nWarn + '   FAIL: ' + nFail);
console.log('Datei: ' + PFAD);
console.log('═'.repeat(66));
process.exit(nFail > 0 ? 1 : 0);
