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
const mS = H.match(/<script>\n([\s\S]*)<\/script>/);
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
  }
}

/* ═══ 6 · Registerstruktur und Dispatcher ═══════════════════════════════ */
kat('6 · Registerstruktur');
{
  const SOLL = ['tag', 'woche', 'akt', 'plaene', 'planung', 'ziele', 'db'];
  const mR = JS.match(/const REGISTER = \[([\s\S]*?)\n\];/);
  if (!mR) { fail('REGISTER nicht gefunden'); }
  else {
    const keys = (mR[1].match(/k:'(\w+)'/g) || []).map(s => s.match(/k:'(\w+)'/)[1]);
    const fehlt = SOLL.filter(s => keys.indexOf(s) === -1);
    if (!fehlt.length) { ok('alle sieben Hauptregister vorhanden'); }
    else { fail('Register fehlen: ' + fehlt.join(', ')); }
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
  const BL = ['tag', 'woche', 'notiz', 'monat', 'jtermine', 'archiv'];
  const ohne = BL.filter(b => JS.indexOf("k === '" + b + "'") === -1);
  /* Es gibt mehrere Stellen mit reg === 'akt' — gemeint ist die im
     Dispatcher.                                                       */
  const mDis = JSK.match(/function renderBlatt\(\) \{([\s\S]*?)\n\}/);
  const uA = mDis ? mDis[1].match(/if \(reg === 'akt'\) \{([\s\S]*?)\n  \}/) : null;
  if (uA && /blattWieder\(\)/.test(uA[1]) && /blattGewohnheit\(\)/.test(uA[1]) &&
      /blattAktivitaeten\(\)/.test(uA[1])) {
    ok('Aktivitäten-Zweig erreicht alle drei Blätter');
  } else { fail('Aktivitäten-Zweig unvollständig'); }
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
                     'geplant', 'verschoben', 'planId', 'zielId'];
    const felder = Array.from(new Set((mA[1].match(/[{,]\s*(\w+):/g) || [])
      .map(s => s.replace(/[{,]\s*/, '').replace(':', ''))));
    const zuviel = felder.filter(f => ERLAUBT.indexOf(f) === -1);
    if (!zuviel.length) { ok('Aktivität hat nur erlaubte Felder (' + felder.length + ')'); }
    else { fail('Unerlaubte Felder in Aktivität: ' + zuviel.join(', ')); }
  }
  const VERBOTEN = ['erstellt', 'geaendert', 'status', 'tags', 'archiviert:', 'imFokus',
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

  const mR = JSK.match(/function eintragRender\(\) \{([\s\S]*?)\n\}/);
  if (!mR) { fail('eintragRender nicht auswertbar'); }
  else {
    if (/monatTage\(\)/.test(mR[1])) { ok('Dialog begrenzt den Monatstag auf die Monatslänge'); }
    else { fail('Dialog nimmt jeden Monatstag an — 31. Februar wäre unsichtbar'); }
    if (/isoPlus\(mo, d\)/.test(mR[1])) { ok('Wochentagsknöpfe zeigen das Datum'); }
    else { fail('Wochentagsknöpfe ohne Datum'); }
  }

  const mS = JSK.match(/function eintragSpeichern\(\) \{([\s\S]*?)\n\}/);
  if (mS && /Math\.min\(Math\.max\(k\.tag, 1\), monatTage\(\)\)/.test(mS[1])) {
    ok('Speichern klemmt den Tag in den gültigen Bereich');
  } else { fail('Speichern lässt Tage außerhalb des Monats zu'); }
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
    if (/bereichWahl\(\\'ziel\\'/.test(mZ[1])) { ok('Zielbereich ist wählbar'); }
    else { fail('Zielbereich lässt sich nicht umhängen'); }
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

/* ═══════════════════════════════════════════════════════════════════════
   ERGEBNIS
   ═══════════════════════════════════════════════════════════════════════ */
console.log('\n' + '═'.repeat(66));
console.log('ERGEBNIS   ok: ' + nOk + '   warn: ' + nWarn + '   FAIL: ' + nFail);
console.log('Datei: ' + PFAD);
console.log('═'.repeat(66));
process.exit(nFail > 0 ? 1 : 0);
