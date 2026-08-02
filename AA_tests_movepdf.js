// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: MOVE-PDF-EXPORT   (neu in v1.5.226, erweitert in v1.5.227/228)
//  Einfügen in AA_tests.js: am Ende, direkt VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • Font-Script-Tags beim Refactoring gelöscht oder geleert
//     -> PDF fällt still auf Helvetica zurück, Layout bricht
//   • Sidebar-Buttons entfernt oder onclick zeigt ins Leere
//   • Aufrufe auf nicht definierte Funktionen (jsPDF-Loader, Zweitquelle)
//   • Abhängigkeiten aus dem Kern (getKW, handleLaden, showToast, DB) gelöscht
//   • Namenskollision aufgabeZeile / moveAufgabeZeile wieder eingeschleppt
//   • Seitensprung-Kaestchen [1][2][3] im Kopf versehentlich wieder eingebaut
//   • Erledigt-Erkennung prueft Felder, die es in WorkAssist nicht gibt
//     (s.erledigt / s.alsErledigt statt s.status) -> freie Plan-Schritte
//     werden nie durchgestrichen
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== MOVE-PDF-EXPORT ===');

(function testMovePdfExport() {

  // ── 1. Eingebettete Caveat-Fonts ────────────────────────────────────────
  const elR = document.getElementById('font-caveat-regular');
  const elB = document.getElementById('font-caveat-bold');

  if (!elR) fail('Font-Tag #font-caveat-regular fehlt');
  else if (elR.textContent.trim().length < 100000)
    fail('#font-caveat-regular ist leer oder abgeschnitten (' + elR.textContent.trim().length + ' Zeichen)');
  else ok('Caveat regular eingebettet (' + elR.textContent.trim().length + ' Zeichen)');

  if (!elB) fail('Font-Tag #font-caveat-bold fehlt');
  else if (elB.textContent.trim().length < 100000)
    fail('#font-caveat-bold ist leer oder abgeschnitten (' + elB.textContent.trim().length + ' Zeichen)');
  else ok('Caveat bold eingebettet (' + elB.textContent.trim().length + ' Zeichen)');

  if (elR && elB && elR.textContent.trim() === elB.textContent.trim())
    fail('regular und bold sind identisch – falscher Font kopiert');

  // ── 2. Sidebar-Buttons ──────────────────────────────────────────────────
  const btns = document.querySelectorAll('.sidebar-move .btn-move');
  if (btns.length !== 2) fail('Erwartet 2 Move-PDF-Buttons, gefunden: ' + btns.length);
  else ok('Beide Move-PDF-Buttons in der Sidebar vorhanden');

  const erwarteteHandler = ['exportMoveAufgabenPDF', 'exportMovePlaenePDF'];
  erwarteteHandler.forEach(h => {
    const treffer = Array.from(btns).some(b => (b.getAttribute('onclick') || '').includes(h));
    if (!treffer) fail('Kein Button ruft ' + h + '() auf');
    else ok('Button verdrahtet: ' + h + '()');
  });

  // ── 3. Alle Funktionen des Moduls definiert ─────────────────────────────
  const noetig = [
    'ladeJsPDF', 'ladeCaveatFonts', 'moveTodayISO', 'moveIstPrivat',
    'moveZweitquelleLaden', 'moveQuellenLaden', 'moveUebersichtStarten',
    'moveUebersichtPDF', 'exportMoveAufgabenPDF', 'exportMovePlaenePDF'
  ];
  const fehlend = noetig.filter(f => typeof window[f] !== 'function');
  if (fehlend.length) fail('Nicht definierte Move-Funktionen: ' + fehlend.join(', '));
  else ok('Alle ' + noetig.length + ' Move-Funktionen definiert');

  // ── 4. Kern-Abhängigkeiten ──────────────────────────────────────────────
  const abhaengig = ['getKW', 'handleLaden', 'showToast'];
  const fehltAbh = abhaengig.filter(f => typeof window[f] !== 'function');
  if (fehltAbh.length) fail('Move-PDF ruft nicht definierte Kernfunktionen: ' + fehltAbh.join(', '));
  else ok('Kern-Abhängigkeiten vorhanden (' + abhaengig.join(', ') + ')');

  if (typeof DB === 'undefined' || DB === null) fail('DB nicht initialisiert – Move-PDF liest DB direkt');
  else ok('DB initialisiert');

  // ── 5. Konstanten / Move-Format ─────────────────────────────────────────
  if (typeof MOVE_PDF_W === 'undefined' || typeof MOVE_PDF_H === 'undefined')
    fail('MOVE_PDF_W / MOVE_PDF_H nicht definiert');
  else if (MOVE_PDF_W !== 82.6 || MOVE_PDF_H !== 132.2)
    fail('Move-Seitenformat verändert: ' + MOVE_PDF_W + ' x ' + MOVE_PDF_H + ' (erwartet 82.6 x 132.2)');
  else ok('Move-Seitenformat 82.6 x 132.2 mm');

  // ── 6. getKW liefert plausible Werte ────────────────────────────────────
  try {
    const kw = getKW('2026-07-27');
    if (kw !== 31) fail('getKW("2026-07-27") = ' + kw + ' (erwartet 31)');
    else ok('getKW rechnet ISO-konform');
  } catch (e) {
    fail('getKW wirft Fehler: ' + e.message);
  }

  // ── 7. Namenskollision aufgabeZeile ─────────────────────────────────────
  if (typeof window.aufgabeZeile === 'function')
    warn('Globale aufgabeZeile() existiert – Kollisionsgefahr mit moveAufgabeZeile()');
  else ok('Keine globale aufgabeZeile() – keine Kollision');

  // ── 8. jsPDF-Lazy-Loader verhält sich sauber ────────────────────────────
  if (typeof MOVE_JSPDF_URL !== 'string' || !MOVE_JSPDF_URL.startsWith('https://'))
    fail('MOVE_JSPDF_URL fehlt oder ist keine https-URL');
  else ok('jsPDF-CDN-URL gesetzt');

  if (typeof window.jspdf === 'undefined')
    ok('jsPDF wird korrekt erst bei Bedarf geladen (noch nicht im Speicher)');
  else
    warn('jsPDF bereits geladen – Lazy-Loading greift nicht oder Export lief schon');

  // ── 9. Keine Seitensprung-Kaestchen im Kopf (entfernt in v1.5.227) ──────
  if (typeof moveUebersichtPDF === 'function') {
    const src = moveUebersichtPDF.toString();
    if (src.includes('pageNumber'))
      fail('Seitensprung-Links (pageNumber) sind wieder im Uebersichts-PDF');
    else if (src.includes('doc.rect('))
      fail('Rechtecke im Uebersichts-PDF – Seitenkaestchen vermutlich wieder da');
    else
      ok('Kopfzeile ohne Seitensprung-Kaestchen');

    if (!src.includes("'  (KW '"))
      fail('KW-Anzeige aus der Kopfzeile verschwunden');
    else
      ok('KW-Anzeige in der Kopfzeile vorhanden');
  }

  // ── 10. Erledigt-Erkennung (Bugfix v1.5.228) ────────────────────────────
  if (typeof moveSchrittErledigt !== 'function' || typeof moveAufgabeErledigt !== 'function') {
    fail('moveSchrittErledigt() / moveAufgabeErledigt() nicht definiert');
  } else {
    const faelle = [
      // [Schritt, verknuepfte Aufgabe, erwartet, Beschreibung]
      [{ status: 'erledigt' }, null, true,  'freier Schritt status=erledigt'],
      [{ status: 'offen'    }, null, false, 'freier Schritt status=offen'],
      [{ status: 'inArbeit' }, null, false, 'freier Schritt status=inArbeit'],
      [{}, null, false, 'freier Schritt ohne status'],
      [{ status: 'offen' }, { status: 'erledigt' }, true,  'Aufgabe erledigt hat Vorrang'],
      [{ status: 'erledigt' }, { status: 'offen' }, false, 'Aufgabe offen hat Vorrang'],
      [{ erledigt: true }, null, true, 'DayPaper-Fallback s.erledigt'],
      [{ alsErledigt: true }, null, true, 'DayPaper-Fallback s.alsErledigt'],
    ];
    let schlecht = 0;
    faelle.forEach(([s, a, soll, txt]) => {
      if (moveSchrittErledigt(s, a) !== soll) { fail('Erledigt-Erkennung falsch: ' + txt); schlecht++; }
    });
    if (!schlecht) ok('Erledigt-Erkennung Plan-Schritte: alle ' + faelle.length + ' Faelle korrekt');

    if (moveAufgabeErledigt({ status: 'erledigt' }) !== true ||
        moveAufgabeErledigt({ status: 'offen' })    !== false ||
        moveAufgabeErledigt(null)                   !== false)
      fail('moveAufgabeErledigt() liefert falsche Werte');
    else ok('Erledigt-Erkennung Aufgaben korrekt');
  }

  // Das Modul darf sich NICHT allein auf Boolean-Felder verlassen
  if (typeof moveUebersichtPDF === 'function') {
    const src = moveUebersichtPDF.toString();
    if (/s\.erledigt\s*\|\|\s*s\.alsErledigt/.test(src))
      fail('Alte DayPaper-Erledigt-Logik (s.erledigt || s.alsErledigt) wieder im Modul');
    else if (!src.includes('moveSchrittErledigt'))
      fail('moveUebersichtPDF nutzt moveSchrittErledigt() nicht mehr');
    else ok('Modul nutzt zentrale Erledigt-Erkennung');
  }

  // Gegen echte Daten: Anzahl erledigter Schritte muss zur Plan-Ansicht passen
  if (typeof DB !== 'undefined' && DB && Array.isArray(DB.plaene)) {
    let abweichung = 0, geprueft = 0;
    DB.plaene.forEach(p => {
      (p.schritte || []).forEach(s => {
        const a = s.aufgabeId ? (DB.aufgaben || []).find(x => x.id === s.aufgabeId) : null;
        const ansicht = ((a && a.status) || s.status || 'offen') === 'erledigt';
        geprueft++;
        if (moveSchrittErledigt(s, a) !== ansicht) abweichung++;
      });
    });
    if (abweichung) fail(abweichung + ' von ' + geprueft + ' Schritten weichen von der Plan-Ansicht ab');
    else if (geprueft) ok('PDF und Plan-Ansicht stimmen bei allen ' + geprueft + ' Schritten ueberein');
    else warn('Keine Plan-Schritte in der DB – Abgleich nicht moeglich');
  }

  // ── 11. Zweitquelle: Handle-Keys ────────────────────────────────────────
  (async () => {
    try {
      const work = await handleLaden('filehandle_work');
      const priv = await handleLaden('filehandle_privat');
      if (!work && !priv)
        warn('Weder filehandle_work noch filehandle_privat bekannt – kombiniertes PDF bleibt einseitig');
      else if (!work || !priv)
        warn('Nur eine der beiden Dateien registriert – zweiter Bereich fehlt im PDF');
      else
        ok('Beide Datei-Handles registriert – kombiniertes PDF möglich');
    } catch (e) {
      fail('handleLaden wirft Fehler: ' + e.message);
    }
  })();

})();

// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: TAGESZETTEL-ASSISTENT   (neu in v1.5.229)
//  Einfügen in AA_tests.js: direkt nach der Kategorie MOVE-PDF-EXPORT,
//  weiterhin VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • DOM-Elemente des Assistenten beim Refactoring gelöscht
//     (Stepper, Vorschau, Footer-Buttons, Screen selbst)
//   • Schrittdefinition/Reihenfolge verändert
//   • Erledigte oder bereits verplante Aufgaben tauchen doppelt auf
//   • Titel mit Anführungszeichen brechen die Liste (fehlendes Escaping)
//   • Motto verliert seine feste Position ganz oben
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== TAGESZETTEL-ASSISTENT ===');

(function testTageszettel() {

  // ── 1. Screen und Pflicht-Elemente ──────────────────────────────────────
  const noetigeIds = ['screen-tageszettel','tz-stepper','tz-title','tz-sub','tz-body',
                      'tz-paper','tz-pv-cnt','tz-info','tz-btn-back','tz-btn-skip','tz-btn-next',
                      'tz-src-work','tz-src-priv'];
  const fehlend = noetigeIds.filter(id => !document.getElementById(id));
  if (fehlend.length) fail('Fehlende Elemente im Assistenten: ' + fehlend.join(', '));
  else ok('Alle ' + noetigeIds.length + ' Pflicht-Elemente vorhanden');

  const nav = document.getElementById('nav-tageszettel');
  if (!nav) fail('Nav-Eintrag #nav-tageszettel fehlt');
  else if (!(nav.getAttribute('onclick') || '').includes("showScreen('tageszettel'"))
    fail('Nav-Eintrag ruft showScreen(\'tageszettel\') nicht auf');
  else ok('Nav-Eintrag verdrahtet');

  if (typeof SCREENS === 'undefined' || !SCREENS.tageszettel)
    fail('SCREENS.tageszettel fehlt – Topbar bleibt leer');
  else ok('SCREENS-Eintrag vorhanden');

  // ── 2. Funktionen ───────────────────────────────────────────────────────
  const noetig = ['renderTageszettel','tzRender','tzRenderStepper','tzRenderLinks','tzRenderPaper',
                  'tzHtmlAufgaben','tzHtmlTermine','tzHtmlMotto','tzHtmlExport','tzPick',
                  'tzAddTermin','tzGehe','tzSpringe','tzPdfErstellen','erstelleTageszettelPDF',
                  'tzZeilenMeta','tzDatumKopf','tzBindeDrag','tzBindeKlicks'];
  const fehltFn = noetig.filter(f => typeof window[f] !== 'function');
  if (fehltFn.length) fail('Nicht definierte Assistenten-Funktionen: ' + fehltFn.join(', '));
  else ok('Alle ' + noetig.length + ' Assistenten-Funktionen definiert');

  // ── 3. Schrittdefinition ────────────────────────────────────────────────
  if (typeof TZ_SCHRITTE === 'undefined') {
    fail('TZ_SCHRITTE nicht definiert');
  } else {
    if (TZ_SCHRITTE.length !== 6) fail('Erwartet 6 Schritte, definiert: ' + TZ_SCHRITTE.length);
    else ok('6 Schritte definiert');

    const typen = TZ_SCHRITTE.map(s => s.typ).join(',');
    if (typen !== 'aufgaben,termine,aufgaben,termine,motto,export')
      fail('Schrittreihenfolge verändert: ' + typen);
    else ok('Schrittreihenfolge korrekt');

    if (TZ_SCHRITTE[5].skip) fail('Letzter Schritt darf nicht überspringbar sein');
    else ok('Letzter Schritt nicht überspringbar');

    if (typeof TZ_KURZ === 'undefined' || TZ_KURZ.length !== TZ_SCHRITTE.length)
      fail('TZ_KURZ passt nicht zur Anzahl der Schritte');
    else ok('Stepper-Beschriftungen vollständig');
  }

  // ── 4. Tagesmotto ───────────────────────────────────────────────────────
  if (typeof TZ_MOTTOS === 'undefined') {
    fail('TZ_MOTTOS nicht definiert');
  } else {
    if (TZ_MOTTOS.length < 14) fail('Nur ' + TZ_MOTTOS.length + ' Motto-Vorschläge (erwartet mind. 14)');
    else ok(TZ_MOTTOS.length + ' Motto-Vorschläge');
    if (new Set(TZ_MOTTOS).size !== TZ_MOTTOS.length) fail('Doppelte Motto-Vorschläge');
    else ok('Motto-Vorschläge eindeutig');
  }

  // Motto muss im PDF als erster Eintrag mit Pfeil landen
  if (typeof tzPdfErstellen === 'function') {
    const src = tzPdfErstellen.toString();
    if (!/typ:\s*'notiz'/.test(src))
      fail('Motto wird nicht mehr als Notiz-Eintrag (Pfeilzeile) übergeben');
    else if (src.indexOf('notiz') > src.indexOf('TZ.zettel.forEach'))
      fail('Motto wird nicht mehr vor den übrigen Einträgen eingefügt');
    else ok('Motto steht als Pfeilzeile an erster Stelle');
  }

  // ── 5. Auswahl-Logik gegen echte Daten ──────────────────────────────────
  if (typeof tzHtmlAufgaben === 'function' && typeof TZ !== 'undefined' &&
      typeof DB !== 'undefined' && DB && Array.isArray(DB.aufgaben)) {
    const sicherung = { q: TZ.quellen, z: TZ.zettel, k: TZ.katalog, o: TZ.offen };
    try {
      TZ.quellen = { work: DB, priv: null };
      TZ.zettel = []; TZ.katalog = {}; TZ.offen = {};
      const h = tzHtmlAufgaben('work');

      const erledigt = DB.aufgaben.filter(a => moveAufgabeErledigt(a));
      const drin = erledigt.filter(a => a.titel && h.includes(escHtml(a.titel)));
      if (drin.length) fail(drin.length + ' erledigte Aufgaben erscheinen in der Auswahlliste');
      else ok('Keine erledigten Aufgaben in der Auswahlliste');

      // Aufgaben, die als Plan-Schritt hängen, dürfen nicht doppelt auftauchen
      const imPlan = new Set();
      (DB.plaene || []).forEach(p => (p.schritte || []).forEach(s => { if (s.aufgabeId) imPlan.add(s.aufgabeId); }));
      let doppelt = 0;
      imPlan.forEach(id => {
        const a = DB.aufgaben.find(x => x.id === id);
        if (!a || !a.titel) return;
        const n = (h.match(new RegExp(escHtml(a.titel).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        if (n > 1) doppelt++;
      });
      if (doppelt) fail(doppelt + ' Aufgaben erscheinen doppelt (Liste und Plan)');
      else ok('Keine Doppelungen zwischen Aufgabenliste und Plänen');

      if (/data-key="[^"]*"[^>]*"/.test(h) === false) ok('data-key-Attribute sauber gequotet');
    } catch (e) {
      fail('tzHtmlAufgaben wirft Fehler: ' + e.message);
    } finally {
      TZ.quellen = sicherung.q; TZ.zettel = sicherung.z;
      TZ.katalog = sicherung.k; TZ.offen = sicherung.o;
    }
  }

  // ── 6. Meta-Aufbereitung ────────────────────────────────────────────────
  if (typeof tzZeilenMeta === 'function') {
    const f = [
      [{ typ:'aufgabe', planTitel:'Migration', groesse:45 }, '[Migration]  (45 min)'],
      [{ typ:'aufgabe', groesse:30 }, '(30 min)'],
      [{ typ:'aufgabe' }, ''],
      [{ typ:'termin', meta:'(Raum 3)  [!]' }, '(Raum 3)  [!]'],
    ];
    const schlecht = f.filter(([z, s]) => tzZeilenMeta(z) !== s);
    if (schlecht.length) fail('tzZeilenMeta liefert bei ' + schlecht.length + ' Fällen falsche Werte');
    else ok('Meta-Aufbereitung korrekt');
  }

  // ── 7. Assistent verändert keine Daten ──────────────────────────────────
  ['tzPick','tzAddTermin','tzPdfErstellen','tzRenderPaper','tzHtmlAufgaben'].forEach(fn => {
    if (typeof window[fn] !== 'function') return;
    const src = window[fn].toString();
    if (/\bsaveDB\s*\(/.test(src) || /\bDB\.\w+\.(push|splice)\s*\(/.test(src))
      fail(fn + '() schreibt in die DB – der Assistent muss lesend bleiben');
  });
  ok('Assistent schreibt nicht in die DB');

  // ── 8. Tageszettel-PDF ──────────────────────────────────────────────────
  if (typeof erstelleTageszettelPDF === 'function') {
    const src = erstelleTageszettelPDF.toString();
    if (src.includes('pageNumber')) fail('Seitensprung-Links im Tageszettel-PDF');
    else ok('Tageszettel-PDF ohne Seitensprung-Kästchen');
    if (!/getNumberOfPages\(\)\s*<\s*3/.test(src)) warn('Mindestseitenzahl 3 im Tageszettel-PDF nicht mehr erkennbar');
    else ok('Tageszettel-PDF erzeugt mindestens 3 Seiten');
  }

})();

// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: TAGESZETTEL – ZUSTAND UND PERSISTENZ   (neu in v1.5.230)
//  Einfügen in AA_tests.js nach der Kategorie TAGESZETTEL-ASSISTENT,
//  weiterhin VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • Zettel von gestern bleibt unter dem heutigen Datum stehen
//   • Zwischenstand wird nicht mehr gesichert (Reload verliert die Planung)
//   • Assistent zeigt nach Dateiwechsel/Toggle/Import veraltete Daten,
//     weil DB komplett ersetzt wird (DB = data) und die Referenz alt bleibt
//   • Plan-Schritt-Keys hängen wieder am Array-Index statt an der Plan-ID
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== TAGESZETTEL – ZUSTAND ===');

(function testTageszettelZustand() {

  // ── 1. Funktionen ───────────────────────────────────────────────────────
  const noetig = ['tzSpeichern','tzWiederherstellen','tzVerwerfen','tzZuruecksetzen',
                  'tzPruefeDatum','tzLeeren'];
  const fehlt = noetig.filter(f => typeof window[f] !== 'function');
  if (fehlt.length) fail('Fehlende Zustandsfunktionen: ' + fehlt.join(', '));
  else ok('Alle ' + noetig.length + ' Zustandsfunktionen vorhanden');

  if (typeof TZ_LS_KEY !== 'string' || !TZ_LS_KEY)
    fail('TZ_LS_KEY nicht definiert – Zwischenstand kann nicht gesichert werden');
  else ok('Speicherschlüssel: ' + TZ_LS_KEY);

  // ── 2. Datumsfeld wird geführt ──────────────────────────────────────────
  if (typeof TZ === 'undefined') {
    fail('TZ nicht definiert');
  } else {
    if (!('datum' in TZ)) fail('TZ.datum fehlt – Tageswechsel kann nicht erkannt werden');
    else ok('TZ.datum wird geführt');
    if ('geladen' in TZ) warn('TZ.geladen existiert noch – ersetzt durch TZ.dbRef?');
    if (!('dbRef' in TZ)) fail('TZ.dbRef fehlt – veraltete Daten nach Dateiwechsel möglich');
    else ok('TZ.dbRef wird geführt');
  }

  // ── 3. Tageswechsel setzt zurück ────────────────────────────────────────
  if (typeof tzPruefeDatum === 'function' && typeof TZ !== 'undefined') {
    const sich = { d:TZ.datum, z:TZ.zettel, m:TZ.motto, s:TZ.schritt, o:TZ.offen };
    try {
      const g = new Date(Date.now() - 86400000);
      const gestern = g.getFullYear() + '-' + String(g.getMonth()+1).padStart(2,'0')
                                      + '-' + String(g.getDate()).padStart(2,'0');
      TZ.datum = gestern;
      TZ.zettel = [{ key:'test', typ:'aufgabe', text:'Testeintrag' }];
      TZ.motto = 'Test';
      if (tzPruefeDatum() !== true) fail('Tageswechsel wird nicht erkannt');
      else if (TZ.zettel.length !== 0 || TZ.motto !== '')
        fail('Tageswechsel erkannt, aber Zettel nicht geleert');
      else if (TZ.datum !== moveTodayISO())
        fail('TZ.datum nach Reset nicht auf heute gesetzt');
      else ok('Tageswechsel setzt den Zettel zurück');

      TZ.datum = moveTodayISO();
      TZ.zettel = [{ key:'test2', typ:'aufgabe', text:'Bleibt' }];
      if (tzPruefeDatum() !== false || TZ.zettel.length !== 1)
        fail('Zettel wird am selben Tag fälschlich zurückgesetzt');
      else ok('Am selben Tag bleibt der Zettel stehen');
    } catch (e) {
      fail('tzPruefeDatum wirft Fehler: ' + e.message);
    } finally {
      TZ.datum = sich.d; TZ.zettel = sich.z; TZ.motto = sich.m;
      TZ.schritt = sich.s; TZ.offen = sich.o;
    }
  }

  // ── 4. Speichern greift an allen Mutationsstellen ───────────────────────
  ['tzPick','tzAddTermin','tzSpringe','tzLeeren'].forEach(fn => {
    if (typeof window[fn] !== 'function') return;
    if (!window[fn].toString().includes('tzSpeichern') &&
        !window[fn].toString().includes('tzZuruecksetzen'))
      fail(fn + '() sichert den Zwischenstand nicht');
  });
  ok('Auswahl, Termine, Navigation und Leeren sichern den Zwischenstand');

  if (typeof tzBindeDrag === 'function' && !tzBindeDrag.toString().includes('tzSpeichern'))
    fail('Umsortieren per Drag & Drop wird nicht gesichert');
  else ok('Umsortieren wird gesichert');

  // ── 5. Persistenz schreibt nicht in die Datei ───────────────────────────
  if (typeof tzSpeichern === 'function') {
    const src = tzSpeichern.toString();
    if (/saveDB|fileHandle|createWritable/.test(src))
      fail('tzSpeichern() greift auf die Datei zu – muss localStorage bleiben');
    else if (!src.includes('localStorage'))
      fail('tzSpeichern() nutzt kein localStorage');
    else ok('Zwischenstand geht nur in den localStorage');
  }

  // ── 6. Gespeicherter Stand passt zum heutigen Tag ──────────────────────
  try {
    const roh = localStorage.getItem(TZ_LS_KEY);
    if (!roh) {
      warn('Kein Zwischenstand gespeichert – Assistent wurde heute noch nicht benutzt');
    } else {
      const d = JSON.parse(roh);
      if (d.datum !== moveTodayISO())
        fail('Gespeicherter Zettel ist vom ' + d.datum + ', heute ist ' + moveTodayISO());
      else ok('Gespeicherter Zettel gehört zum heutigen Tag (' +
              ((d.zettel || []).length) + ' Einträge)');
    }
  } catch (e) {
    fail('Gespeicherter Zwischenstand ist kein gültiges JSON: ' + e.message);
  }

  // ── 7. Plan-Keys hängen an der Plan-ID ─────────────────────────────────
  if (typeof tzHtmlAufgaben === 'function') {
    const src = tzHtmlAufgaben.toString();
    if (/':s:'\s*\+\s*pi\b/.test(src))
      fail('Plan-Schritt-Keys nutzen wieder den Array-Index statt der Plan-ID');
    else if (!src.includes('p.id'))
      fail('Plan-ID wird nicht mehr für die Key-Bildung verwendet');
    else ok('Plan-Schritt-Keys hängen an der Plan-ID');
  }

  // ── 8. Leeren-Button vorhanden und gebunden ────────────────────────────
  const leer = document.querySelector('.tz-leeren');
  if (!leer) fail('Leeren-Button fehlt in der Vorschau-Kopfzeile');
  else ok('Leeren-Button vorhanden');

})();

// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: TAGESZETTEL – GRUPPIERUNG UND WIEDERHOLUNGEN
//  (neu in v1.5.231, korrigiert in v1.5.232)
//  Einfügen in AA_tests.js nach der Kategorie TAGESZETTEL – ZUSTAND,
//  weiterhin VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • Aufgaben wieder nach Bereich statt nach Fälligkeit gruppiert
//   • Gruppenreihenfolge verdreht (Überfällig nicht mehr oben)
//   • Datumsrechnung bricht an Monats-, Jahres- oder Schaltjahresgrenzen
//   • Künftige Instanzen wiederholender Aufgaben tauchen wieder auf
//   • Mehrere offene Instanzen derselben Serie gleichzeitig sichtbar
//   • Gruppierung liest wieder a.faellig statt anzeigedatum() – dann bleiben
//     Heute und Überfällig leer und alles landet unter „Ohne Datum"
//   • Gruppe „In Arbeit" verschwindet
//   • Assistent und Dashboard urteilen unterschiedlich
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== TAGESZETTEL – GRUPPIERUNG ===');

(function testTageszettelGruppierung() {

  // ── 1. Definition ───────────────────────────────────────────────────────
  const noetig = ['tzDatumGruppe','tzPlusTage','tzWochenEnde'];
  const fehlt = noetig.filter(f => typeof window[f] !== 'function');
  if (fehlt.length) fail('Fehlende Datumsfunktionen: ' + fehlt.join(', '));
  else ok('Datumsfunktionen vorhanden');

  if (typeof TZ_DATUMSGRUPPEN === 'undefined') {
    fail('TZ_DATUMSGRUPPEN nicht definiert – Gruppierung nach Fälligkeit fehlt');
  } else {
    const keys = TZ_DATUMSGRUPPEN.map(g => g.key).join(',');
    if (keys !== 'ueberfaellig,heute,inarbeit,zeitnah,morgen,woche,spaeter,ohne')
      fail('Gruppenreihenfolge verändert: ' + keys);
    else ok('8 Gruppen in korrekter Reihenfolge');
    if (!TZ_DATUMSGRUPPEN[0].warn) fail('Gruppe „Überfällig" nicht mehr hervorgehoben');
    else ok('Überfällig wird hervorgehoben');
  }

  // ── 2. Datumsrechnung ───────────────────────────────────────────────────
  if (typeof tzPlusTage === 'function') {
    const f = [
      ['2026-01-31', 1, '2026-02-01', 'Monatsgrenze'],
      ['2028-02-28', 1, '2028-02-29', 'Schaltjahr'],
      ['2026-12-31', 1, '2027-01-01', 'Jahresgrenze'],
      ['2026-03-01',-1, '2026-02-28', 'rückwärts über Monatsgrenze'],
    ];
    const schlecht = f.filter(([d,n,s]) => tzPlusTage(d,n) !== s);
    if (schlecht.length) fail('tzPlusTage falsch bei: ' + schlecht.map(x => x[3]).join(', '));
    else ok('Datumsrechnung über alle Grenzen korrekt');
  }
  if (typeof tzWochenEnde === 'function') {
    if (tzWochenEnde('2026-07-27') !== '2026-08-02') fail('tzWochenEnde: Montag liefert falschen Sonntag');
    else if (tzWochenEnde('2026-08-02') !== '2026-08-02') fail('tzWochenEnde: Sonntag muss sich selbst liefern');
    else ok('Wochenende korrekt bestimmt');
  }

  // ── 3. Zuordnung ────────────────────────────────────────────────────────
  if (typeof tzDatumGruppe === 'function' && typeof tzPlusTage === 'function') {
    const h = moveTodayISO();
    const f = [
      [{ faellig: tzPlusTage(h,-1) }, 'ueberfaellig', 'Fälligkeit gestern'],
      [{ faellig: h },                'heute',        'Fälligkeit heute'],
      [{ faellig: tzPlusTage(h,1) },  'morgen',       'Fälligkeit morgen'],
      [{ faellig: tzPlusTage(h,90) }, 'spaeter',      'Fälligkeit in 90 Tagen'],
      [{},                            'ohne',         'ohne jedes Datum'],
      [{ zeitnah:true },              'zeitnah',      'nur zeitnah-Flag'],
      // anzeigedatum-Kette: Wiedervorlage > Startdatum > Fälligkeit
      [{ startdatum: h },                                'heute',        'Startdatum heute'],
      [{ startdatum: tzPlusTage(h,-2) },                 'ueberfaellig', 'Startdatum in der Vergangenheit'],
      [{ startdatum: tzPlusTage(h,-9), wiedervorlage: h },'heute',       'Wiedervorlage heute'],
      [{ wiedervorlage: h, faellig: tzPlusTage(h,30) },  'heute',        'Wiedervorlage heute schlägt späte Fälligkeit'],
      [{ faellig: tzPlusTage(h,-3), wiedervorlage: tzPlusTage(h,5) }, 'ueberfaellig', 'Fälligkeit vergangen'],
      // In Arbeit
      [{ status:'inArbeit' },                            'inarbeit', 'In Arbeit ohne Datum'],
      [{ status:'inArbeit', faellig: h },                'heute',    'In Arbeit mit heutigem Datum'],
      [{ status:'inArbeit', wiederholung:{typ:'woechentlich'}, faellig: tzPlusTage(h,1) },
                                                         'morgen',   'In Arbeit + Wiederholung mit Datum'],
    ];
    const schlecht = f.filter(([a,s]) => tzDatumGruppe(a,h) !== s);
    if (schlecht.length) fail('tzDatumGruppe falsch bei: ' + schlecht.map(x => x[2]).join('; '));
    else ok('Alle ' + f.length + ' Zuordnungsfälle korrekt');
  }

  // ── 3b. Es wird anzeigedatum() gelesen, nicht nur a.faellig ─────────────
  if (typeof tzDatumGruppe === 'function') {
    const src = tzDatumGruppe.toString();
    if (!src.includes('anzeigedatum'))
      fail('tzDatumGruppe liest nicht anzeigedatum() – Heute und Überfällig bleiben leer');
    else ok('Gruppierung liest anzeigedatum()');
    if (!src.includes('istHeute'))
      fail('tzDatumGruppe nutzt istHeute() nicht – Abweichung zum Dashboard möglich');
    else ok('Heute-Logik identisch zum Dashboard');
  }
  if (typeof anzeigedatum !== 'function' || typeof istHeute !== 'function')
    fail('anzeigedatum()/istHeute() fehlen – der Assistent hängt daran');
  else ok('Kernfunktionen anzeigedatum/istHeute vorhanden');

  // ── 4. Wiederholende Aufgaben ───────────────────────────────────────────
  if (typeof tzHtmlAufgaben === 'function') {
    const src = tzHtmlAufgaben.toString();
    if (!/a\.wiederholung\s*&&\s*ad\s*&&\s*ad\s*>\s*heute/.test(src))
      fail('Filter für künftige Wiederholungen fehlt oder liest wieder a.faellig');
    else ok('Künftige Wiederholungen werden über anzeigedatum ausgeblendet');
    if (!src.includes('serien'))
      fail('Absicherung gegen mehrere offene Instanzen derselben Serie fehlt');
    else ok('Serien-Absicherung vorhanden');
    if (/tz-grp">\$\{escHtml\(name\)\}/.test(src))
      fail('Aufgaben werden wieder nach Bereich gruppiert');
    else ok('Gruppierung erfolgt nach Fälligkeit, nicht nach Bereich');
  }

  // ── 5. Gegen echte Daten ────────────────────────────────────────────────
  if (typeof DB !== 'undefined' && DB && Array.isArray(DB.aufgaben) &&
      typeof tzHtmlAufgaben === 'function' && typeof TZ !== 'undefined') {
    const sich = { q:TZ.quellen, z:TZ.zettel, k:TZ.katalog, o:TZ.offen };
    try {
      TZ.quellen = { work: DB, priv: null };
      TZ.zettel = []; TZ.katalog = {}; TZ.offen = {};
      const h = tzHtmlAufgaben('work');
      const heute = moveTodayISO();
      const planIds = new Set((DB.plaene || []).flatMap(p =>
        (p.schritte || []).filter(s => s.aufgabeId).map(s => s.aufgabeId)));
      const inPlanIds = a => planIds.has(a.id);

      const kuenftig = DB.aufgaben.filter(a =>
        !moveAufgabeErledigt(a) && a.wiederholung && anzeigedatum(a) && anzeigedatum(a) > heute);
      const sichtbar = kuenftig.filter(a => a.titel && h.includes(escHtml(a.titel)));
      if (sichtbar.length)
        fail(sichtbar.length + ' künftige Wiederholungsinstanzen stehen in der Liste');
      else if (kuenftig.length)
        ok(kuenftig.length + ' künftige Wiederholungen korrekt ausgeblendet');
      else
        warn('Keine künftigen Wiederholungsinstanzen vorhanden – Filter nicht prüfbar');

      const ueberf = DB.aufgaben.filter(a =>
        !moveAufgabeErledigt(a) && !inPlanIds(a) && tzDatumGruppe(a, heute) === 'ueberfaellig');
      const heuteL = DB.aufgaben.filter(a =>
        !moveAufgabeErledigt(a) && !inPlanIds(a) && tzDatumGruppe(a, heute) === 'heute');
      if (heuteL.length && !h.includes('>Heute '))
        fail(heuteL.length + ' Aufgaben sind heute dran, aber die Gruppe „Heute" fehlt');
      else if (heuteL.length) ok('Gruppe „Heute" mit ' + heuteL.length + ' Aufgaben');
      else ok('Heute steht nichts an');
      if (ueberf.length && !h.includes('Überfällig'))
        fail(ueberf.length + ' überfällige Aufgaben, aber keine Gruppe „Überfällig"');
      else if (ueberf.length)
        ok('Gruppe „Überfällig" mit ' + ueberf.length + ' Aufgaben');
      else
        ok('Keine überfälligen Aufgaben');
    } catch (e) {
      fail('tzHtmlAufgaben wirft Fehler: ' + e.message);
    } finally {
      TZ.quellen = sich.q; TZ.zettel = sich.z; TZ.katalog = sich.k; TZ.offen = sich.o;
    }
  }

})();

// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: NOTIZ → MOVE   (neu in v1.5.233)
//  Einfügen in AA_tests.js nach der Kategorie TAGESZETTEL – GRUPPIERUNG,
//  weiterhin VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • Elemente des Export-Screens oder der Button in der Notiz gelöscht
//   • Markdown-Erkennung bricht (Tabellen, Checkboxen, Überschriften)
//   • Zellfarben landen wieder im PDF, obwohl schwarz/weiß gefordert ist
//   • Unterseiten-Toggle wirkungslos
//   • Text läuft über den rechten Seitenrand
//   • Objekt-URLs der Vorschau werden nicht freigegeben (Speicherleck)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== NOTIZ → MOVE ===');

(function testNotizMove() {

  // ── 1. Screen und Elemente ──────────────────────────────────────────────
  const ids = ['screen-notizmove','nm-opts','nm-titel','nm-meta','nm-unter-sub',
               'nm-sw-unter','nm-seg','nm-struct','nm-frame','nm-pv-cnt'];
  const fehlend = ids.filter(i => !document.getElementById(i));
  if (fehlend.length) fail('Fehlende Elemente im Notiz-Export: ' + fehlend.join(', '));
  else ok('Alle ' + ids.length + ' Elemente vorhanden');

  const seg = document.querySelectorAll('#nm-seg button');
  if (seg.length !== 3) fail('Textgrößen-Umschalter hat ' + seg.length + ' statt 3 Stufen');
  else ok('Textgrößen-Umschalter mit 3 Stufen');

  const moveBtn = Array.from(document.querySelectorAll('.ntb'))
    .some(b => (b.getAttribute('onclick') || '').includes('notizFuerMove'));
  if (!moveBtn) fail('Move-Button in der Notiz-Werkzeugleiste fehlt');
  else ok('Move-Button in der Notiz vorhanden');

  if (typeof SCREENS === 'undefined' || !SCREENS.notizmove)
    fail('SCREENS.notizmove fehlt');
  else ok('SCREENS-Eintrag vorhanden');

  // ── 2. Funktionen ───────────────────────────────────────────────────────
  const noetig = ['notizFuerMove','nmZurueckZurNotiz','renderNotizMove','nmToggleUnter',
                  'nmSetGroesse','nmVorschauNeu','nmVorschauBauen','nmParse','nmRuns',
                  'nmZellenAusZeile','nmErstellePDF','nmPdfErstellen','nmNotiz','nmUnterseiten'];
  const fehltFn = noetig.filter(f => typeof window[f] !== 'function');
  if (fehltFn.length) fail('Nicht definierte Funktionen: ' + fehltFn.join(', '));
  else ok('Alle ' + noetig.length + ' Funktionen definiert');

  if (typeof NM_GROESSEN === 'undefined' || !NM_GROESSEN.s || !NM_GROESSEN.m || !NM_GROESSEN.l)
    fail('NM_GROESSEN unvollständig');
  else if (!(NM_GROESSEN.s.text < NM_GROESSEN.m.text && NM_GROESSEN.m.text < NM_GROESSEN.l.text))
    fail('Textgrößen sind nicht aufsteigend');
  else ok('Drei Textgrößen korrekt gestaffelt');

  // ── 3. Markdown-Erkennung ───────────────────────────────────────────────
  if (typeof nmParse === 'function') {
    const b = nmParse('# T\n## Z\n### D\nAbsatz\n- P\n- [ ] o\n- [x] f\n> Z\n---\n| A | B |\n|---|---|\n| 1 | 2 |\n');
    const typen = b.map(x => x.typ).join(',');
    if (typen !== 'h1,h2,h3,p,liste,zitat,hr,tabelle,leer')
      fail('Markdown-Erkennung verändert: ' + typen);
    else ok('Alle Blocktypen werden erkannt');

    const l = b.find(x => x.typ === 'liste');
    if (!l || l.items.length !== 3) fail('Listenpunkte werden nicht korrekt gesammelt');
    else if (!l.items[1].cb || l.items[2].an !== true) fail('Checkboxen werden nicht erkannt');
    else ok('Aufzählung und Checkboxen korrekt');
  }

  if (typeof nmRuns === 'function') {
    const f = [
      ['a **b** c', r => r.length === 3 && r[1].bold === true, 'fett'],
      ['*x*',       r => r.length === 1 && !r[0].bold,          'kursiv wird normal gesetzt'],
      ['`y`',       r => r[0].code === true,                    'Code'],
      ['[D](http://x)', r => r[0].t === 'D (http://x)',         'Link zu sichtbarem Text'],
    ];
    const schlecht = f.filter(([t, p]) => !p(nmRuns(t)));
    if (schlecht.length) fail('Inline-Auszeichnung falsch bei: ' + schlecht.map(x => x[2]).join(', '));
    else ok('Inline-Auszeichnung korrekt');
  }

  // ── 4. Keine Farben ─────────────────────────────────────────────────────
  if (typeof nmZellenAusZeile === 'function') {
    if (nmZellenAusZeile('| {gruen}OK | {rot}Fehler |').join('|') !== 'OK|Fehler')
      fail('Farbsyntax wird nicht aus den Zellen entfernt');
    else ok('Zellfarben werden verworfen');
  }
  if (typeof nmErstellePDF === 'function') {
    const src = nmErstellePDF.toString();
    if (/setFillColor\(\s*(?!190|20)\d/.test(src.replace(/setFillColor\(190, 195, 205\)/g, '')))
      warn('Ungewöhnlicher Füllfarben-Aufruf im Notiz-PDF – schwarz/weiß prüfen');
    else ok('Notiz-PDF bleibt schwarz auf Punktraster');
  }

  // ── 5. Unterseiten-Toggle wirkt ─────────────────────────────────────────
  if (typeof nmErstellePDF === 'function' && typeof NM !== 'undefined' &&
      typeof DB !== 'undefined' && DB && Array.isArray(DB.notizen) && window.jspdf) {
    const mitKind = DB.notizen.find(n => !n.parentId &&
      DB.notizen.some(u => u.parentId === n.id));
    if (!mitKind) {
      warn('Keine Notiz mit Unterseiten vorhanden – Toggle nicht prüfbar');
    } else {
      const sich = { id: NM.notizId, u: NM.mitUnter, g: NM.groesse };
      try {
        NM.notizId = mitKind.id; NM.groesse = 'm';
        NM.mitUnter = true;  const a = nmErstellePDF();
        NM.mitUnter = false; const b = nmErstellePDF();
        if (!a || !b) fail('nmErstellePDF liefert kein Dokument');
        else if (a.internal.getNumberOfPages() <= b.internal.getNumberOfPages())
          fail('Unterseiten-Toggle wirkt nicht auf die Seitenzahl');
        else ok('Unterseiten-Toggle wirkt (' + b.internal.getNumberOfPages() +
                ' → ' + a.internal.getNumberOfPages() + ' Seiten)');
        if (a._nmSeitenProAbschnitt) {
          const summe = a._nmSeitenProAbschnitt.reduce((s, x) => s + x.seiten, 0);
          if (summe !== a.internal.getNumberOfPages())
            fail('Strukturliste und tatsächliche Seitenzahl weichen ab');
          else ok('Strukturliste stimmt mit dem PDF überein');
        }
      } catch (e) {
        fail('nmErstellePDF wirft Fehler: ' + e.message);
      } finally {
        NM.notizId = sich.id; NM.mitUnter = sich.u; NM.groesse = sich.g;
      }
    }
  }

  // ── 6. Vorschau gibt Objekt-URLs frei ──────────────────────────────────
  if (typeof nmVorschauBauen === 'function') {
    if (!nmVorschauBauen.toString().includes('revokeObjectURL'))
      fail('Vorschau gibt alte Objekt-URLs nicht frei – Speicherleck bei jeder Änderung');
    else ok('Alte Vorschau-URLs werden freigegeben');
  }

  // ── 7. Seitenränder ─────────────────────────────────────────────────────
  if (typeof nmErstellePDF === 'function') {
    const src = nmErstellePDF.toString();
    if (!/ML\s*=\s*2\.5.*MR\s*=\s*3\.5/.test(src.replace(/\s+/g, ' ')))
      warn('Seitenränder des Notiz-PDF wurden verändert – Randeinhaltung neu prüfen');
    else ok('Seitenränder unverändert (2,5 / 3,5 mm)');
  }

})();

// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: PWA-BADGE UND DATUMSBERECHNUNG   (neu in v1.5.234)
//  Einfügen in AA_tests.js nach der Kategorie NOTIZ → MOVE,
//  weiterhin VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • Badge wird nur beim Dashboard-Rendern aktualisiert und ist überall
//     sonst veraltet
//   • Badge weicht bei 0 fälligen Aufgaben auf die Plananzahl aus – dieselbe
//     Zahl bedeutet dann mal Aufgaben, mal Pläne
//   • Datumsfunktionen rechnen wieder über toISOString() in UTC und liefern
//     in Deutschland nachts bzw. bei lokaler Mitternacht den falschen Tag
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== PWA-BADGE UND DATUM ===');

(function testBadgeUndDatum() {

  // ── 1. Datumsfunktionen ─────────────────────────────────────────────────
  if (typeof isoDatum !== 'function') {
    fail('isoDatum() fehlt – zentrale lokale Datumsformatierung');
  } else {
    const f = [
      ['2026-07-27T00:30:00', '2026-07-27', 'Sommerzeit 00:30'],
      ['2026-01-15T00:30:00', '2026-01-15', 'Winterzeit 00:30'],
      ['2026-12-31T23:00:00', '2026-12-31', 'Jahreswechsel'],
    ];
    const schlecht = f.filter(([iso, soll]) => isoDatum(new Date(iso)) !== soll);
    if (schlecht.length) fail('isoDatum falsch bei: ' + schlecht.map(x => x[2]).join(', '));
    else ok('isoDatum liefert das lokale Datum');
  }

  if (typeof today !== 'function') {
    fail('today() fehlt');
  } else if (today() !== moveTodayISO()) {
    fail('today() und moveTodayISO() liefern verschiedene Tage: ' + today() + ' / ' + moveTodayISO());
  } else ok('today() und moveTodayISO() stimmen überein');

  if (typeof moveTodayISO === 'function' && !/return today\(\)/.test(moveTodayISO.toString()))
    warn('moveTodayISO() rechnet wieder selbst – doppelte Datumslogik');
  else ok('Nur eine Datumsimplementierung im Einsatz');

  // arbeitstageVor wird immer mit '...T00:00:00' gerufen – lokale Mitternacht.
  // Über toISOString() sprang das Ergebnis früher einen Tag zurück.
  if (typeof arbeitstageVor === 'function') {
    const heute = today();
    if (arbeitstageVor(heute + 'T00:00:00', 0) !== heute)
      fail('arbeitstageVor(heute, 0) liefert nicht heute – UTC-Verschiebung zurück?');
    else ok('arbeitstageVor rechnet ohne Tagesversatz');
  }

  ['naechsteNArbeitstage','wocheStart','wocheEnde','naechste3ArbeitstageEnde',
   'naechsterArbeitstag','datumPlusTageFaellig'].forEach(fn => {
    if (typeof window[fn] !== 'function') return;
    if (/toISOString\(\)\s*\.\s*slice\(\s*0\s*,\s*10\s*\)/.test(window[fn].toString()))
      fail(fn + '() rechnet wieder über toISOString() – falscher Tag in der Nacht');
  });
  ok('Keine UTC-Datumsrückgaben in den Datumsfunktionen');

  // ── 2. Badge-Aktualisierung ─────────────────────────────────────────────
  if (typeof badgeAnstossen !== 'function')
    fail('badgeAnstossen() fehlt – Badge wird nur beim Dashboard-Rendern aktualisiert');
  else if (!/setTimeout/.test(badgeAnstossen.toString()))
    warn('badgeAnstossen() ist nicht entprellt – läuft bei jedem Tastendruck');
  else ok('Badge wird entprellt nachgezogen');

  if (typeof saveDB === 'function' && !/badgeAnstossen/.test(saveDB.toString()))
    fail('saveDB() stößt den Badge nicht an – er veraltet außerhalb des Dashboards');
  else ok('Jede Datenänderung zieht den Badge nach');

  if (typeof ladeUndStarte === 'function' && !/badgeAktualisieren/.test(ladeUndStarte.toString()))
    fail('Badge wird nach dem Laden nicht gesetzt – alter Wert bleibt in der Taskleiste');
  else ok('Badge wird nach dem Laden gesetzt');

  // ── 3. Badge bedeutet immer dasselbe ────────────────────────────────────
  if (typeof badgeAktualisieren === 'function') {
    const src = badgeAktualisieren.toString();
    if (/setAppBadge\(\s*anzahlPlaene\s*\)/.test(src))
      fail('Badge weicht wieder auf die Plananzahl aus – Zahl ist nicht mehr deutbar');
    else ok('Badge zeigt ausschließlich fällige Aufgaben');
    if (!/clearAppBadge/.test(src))
      fail('Badge wird bei 0 fälligen Aufgaben nicht gelöscht');
    else ok('Badge wird bei 0 gelöscht');
  }

  // ── 4. Badge stimmt mit der Dashboard-Pille überein ─────────────────────
  if (typeof DB !== 'undefined' && DB && Array.isArray(DB.aufgaben) &&
      typeof istHeute === 'function') {
    const heute = today();
    const offen = DB.aufgaben.filter(a => a.status !== 'erledigt');
    const ueber = offen.filter(a => {
      if (a.wiedervorlage || a.startdatum) {
        const ad = a.wiedervorlage || a.startdatum || a.faellig;
        return ad && ad < heute;
      }
      return a.faellig && a.faellig < heute;
    });
    const heuteL = offen.filter(a => !ueber.includes(a) && istHeute(a, heute));
    const erwartet = ueber.length + heuteL.length;
    const pille = document.getElementById('badge-faellig-zahl');
    if (!pille) {
      warn('Dashboard-Pille nicht gefunden – Abgleich nicht möglich');
    } else if (String(erwartet) !== (pille.textContent || '').trim()) {
      warn('Badge-Erwartung ' + erwartet + ', Dashboard-Pille zeigt "' +
           (pille.textContent || '').trim() + '" – Dashboard evtl. noch nicht gerendert');
    } else {
      ok('Badge-Rechnung deckt sich mit der Dashboard-Pille (' + erwartet + ')');
    }
  }

})();

// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: AUFGABEN-ASSISTENT V2   (neu in v1.5.235)
//  Einfügen in AA_tests.js nach der Kategorie PWA-BADGE UND DATUM,
//  weiterhin VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • Titel und Untertitel wieder vertauscht (Wirkung landet im Titel)
//   • Ein Schritt des Assistenten verschwindet oder die Vorschau rutscht
//   • Kriterien-Haken gehen beim erneuten Aufwerten verloren
//   • Altbestand-Umstellung läuft zweimal und dreht alles zurück
//   • DOM-Elemente von Kriterienliste oder erstem Schritt gelöscht
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== AUFGABEN-ASSISTENT V2 ===');

(function testAssistentV2() {

  // ── 1. Sechs Schritte vorhanden ─────────────────────────────────────────
  const fehlend = [1,2,3,4,5,6].filter(i => !document.getElementById('asst-s' + i));
  if (fehlend.length) fail('Fehlende Assistenten-Schritte: ' + fehlend.join(', '));
  else ok('Alle 6 Schritte im DOM');

  const dots = [1,2,3,4].filter(i => document.getElementById('asst-dot-' + i)).length;
  if (dots !== 4) fail('Erwartet 4 Fortschrittspunkte, gefunden: ' + dots);
  else ok('4 Fortschrittspunkte');

  const neueIds = ['asst-ergebnis','asst-erster','asst-prev-ergebnis','asst-prev-erster',
                   'asst-groesse-unv','aufgabe-erster','krit-box','krit-pill','krit-fertig'];
  const fehltId = neueIds.filter(i => !document.getElementById(i));
  if (fehltId.length) fail('Fehlende Elemente: ' + fehltId.join(', '));
  else ok('Alle ' + neueIds.length + ' neuen Elemente vorhanden');

  if (document.getElementById('asst-wert'))
    fail('Altes Feld asst-wert existiert noch – Schritt 4 nicht sauber ersetzt');
  else ok('Altes Wert-Feld entfernt');

  // ── 2. Funktionen ───────────────────────────────────────────────────────
  const noetig = ['kritZuText','textZuKrit','kritRendern','kritToggle','kritLoeschen',
                  'kritHinzufuegen','kritPille','kritAufgabeAbschliessen',
                  'ersterSchrittRendern','ersterSchrittToggle','ersterSchrittGeaendert',
                  'asstGroesseUnveraendert','aufwertungBetroffene','aufwertungTitelTauschen',
                  'tauschBannerRendern','tauschBannerAusblenden'];
  const fehltFn = noetig.filter(f => typeof window[f] !== 'function');
  if (fehltFn.length) fail('Nicht definierte Funktionen: ' + fehltFn.join(', '));
  else ok('Alle ' + noetig.length + ' Funktionen definiert');

  // ── 3. Mapping: Tätigkeit → titel, Wirkung → untertitel ────────────────
  if (typeof asstUebernehmen === 'function') {
    const src = asstUebernehmen.toString();
    if (/a\.untertitel\s*=\s*alterTitel/.test(src))
      fail('Altes Mapping zurück: alter Titel wird wieder zum Untertitel');
    else if (!/a\.untertitel\s*=\s*wirkung/.test(src))
      fail('Wirkung wird nicht in untertitel geschrieben');
    else ok('Wirkung geht in untertitel, Titel bleibt die Tätigkeit');
    if (/a\.titel\s*=\s*titel/.test(src))
      fail('Aufwerten überschreibt wieder den Titel');
    else ok('Aufwerten lässt den Titel unangetastet');
  }

  // ── 4. Kriterien: Text und Haken ────────────────────────────────────────
  if (typeof textZuKrit === 'function' && typeof kritZuText === 'function') {
    const l = textZuKrit('A\nB\n\n  C  ');
    if (l.length !== 3 || l[2].text !== 'C')
      fail('textZuKrit trennt Zeilen nicht korrekt');
    else ok('Eine Zeile ergibt ein Kriterium');

    const erhalten = textZuKrit('A\nB', [{ text:'A', erledigt:true }]);
    if (erhalten[0].erledigt !== true || erhalten[1].erledigt !== false)
      fail('Haken gehen beim erneuten Schreiben verloren');
    else ok('Gesetzte Haken überleben das Aufwerten');

    if (kritZuText([{ text:'A' }, { text:'B' }]) !== 'A\nB')
      fail('kritZuText liefert nicht eine Zeile je Kriterium');
    else ok('Rückwandlung korrekt');
  }

  if (typeof kritPille === 'function') {
    if (kritPille({}) !== '' || kritPille({ ergebnis: [] }) !== '')
      fail('Pille erscheint ohne Kriterien');
    else if (!kritPille({ ergebnis:[{ text:'a', erledigt:true }] }).includes('voll'))
      fail('Vollständige Kriterien werden nicht hervorgehoben');
    else ok('Kriterien-Pille verhält sich korrekt');
  }

  // ── 5. Altbestand-Umstellung ist einmalig ──────────────────────────────
  if (typeof aufwertungBetroffene === 'function') {
    if (!/titel_getauscht/.test(aufwertungBetroffene.toString()))
      fail('Bereits umgestellte Aufgaben werden nicht ausgeschlossen – zweiter Lauf dreht zurück');
    else ok('Umstellung kann nicht zweimal laufen');

    const n = aufwertungBetroffene().length;
    if (n) warn(n + ' Aufgabe(n) stammen noch aus der alten Aufwertung – Banner sollte erscheinen');
    else ok('Kein Altbestand mehr offen');
  }

  // ── 6. Datenfelder in der DB ────────────────────────────────────────────
  if (typeof DB !== 'undefined' && DB && Array.isArray(DB.aufgaben)) {
    const kaputt = DB.aufgaben.filter(a => a.ergebnis && !Array.isArray(a.ergebnis));
    if (kaputt.length) fail(kaputt.length + ' Aufgaben haben ein ergebnis-Feld, das kein Array ist');
    else ok('Kriterien liegen überall als Array vor');

    const ohneText = DB.aufgaben.filter(a =>
      Array.isArray(a.ergebnis) && a.ergebnis.some(k => !k || typeof k.text !== 'string'));
    if (ohneText.length) fail(ohneText.length + ' Aufgaben haben Kriterien ohne Text');
    else ok('Alle Kriterien haben einen Text');

    const mitKrit = DB.aufgaben.filter(a => (a.ergebnis || []).length).length;
    const mitErst = DB.aufgaben.filter(a => a.ersterSchritt).length;
    ok('Bestand: ' + mitKrit + ' mit Kriterien, ' + mitErst + ' mit erstem Schritt');
  }

  // ── 7. Routine-Knopf verwirft nichts mehr ──────────────────────────────
  if (typeof asstRoutine === 'function') {
    if (!/asst-taetigkeit/.test(asstRoutine.toString()))
      fail('„Routine, direkt weiter" verwirft die eingegebene Tätigkeit wieder');
    else ok('Routine-Knopf übernimmt die Tätigkeit');
  }

})();

// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: MODAL-SCHLIESSVERHALTEN   (neu in v1.5.236)
//  Einfügen in AA_tests.js nach der Kategorie AUFGABEN-ASSISTENT V2,
//  weiterhin VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • Modal schließt sich, wenn eine Textmarkierung im Modal beginnt und
//     außerhalb endet – Eingaben gehen verloren
//   • Rückfall auf einen reinen click-Handler auf dem Overlay
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== MODAL-SCHLIESSVERHALTEN ===');

(function testModalSchliessen() {
  const overlays = document.querySelectorAll('.modal-overlay');
  if (!overlays.length) { fail('Keine .modal-overlay gefunden'); return; }
  ok(overlays.length + ' Modal-Overlays vorhanden');

  // Der Handler wird beim Laden gebunden – prüfbar ist der Quelltext
  const skripte = Array.from(document.querySelectorAll('script'))
    .map(s => s.textContent || '').join('\n');
  const block = skripte.match(/querySelectorAll\('\.modal-overlay'\)\.forEach[\s\S]{0,900}/);
  if (!block) {
    warn('Overlay-Handler im Quelltext nicht auffindbar');
  } else {
    const src = block[0];
    if (/addEventListener\('click'/.test(src) && !/addEventListener\('mousedown'/.test(src))
      fail('Overlay nutzt wieder einen reinen click-Handler – Textmarkierung schließt das Modal');
    else if (!/addEventListener\('mousedown'/.test(src) || !/addEventListener\('mouseup'/.test(src))
      fail('mousedown/mouseup-Paarung fehlt – Schließen ist nicht abgesichert');
    else ok('Schließen erfordert mousedown und mouseup auf dem Overlay');

    if (!/mouseleave/.test(src))
      warn('Kein Abbruch beim Verlassen des Fensters – Randfall ungesichert');
    else ok('Verlassen des Fensters bricht den Schließvorgang ab');
  }

  // Live-Test an einem echten Overlay, ohne es sichtbar zu öffnen
  const o = overlays[0];
  const warOffen = o.classList.contains('open');
  try {
    o.classList.add('open');
    const inner = o.querySelector('.modal') || o.firstElementChild || o;
    inner.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    o.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    if (!o.classList.contains('open'))
      fail('Markierung von innen nach außen schließt das Modal weiterhin');
    else ok('Markierung von innen nach außen lässt das Modal offen');

    o.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    o.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    if (o.classList.contains('open'))
      fail('Echter Klick neben das Modal schließt es nicht mehr');
    else ok('Klick neben das Modal schließt weiterhin');
  } catch (e) {
    warn('Live-Test nicht möglich: ' + e.message);
  } finally {
    o.classList.toggle('open', warOffen);
  }
})();

// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: ERINNERUNGEN AN PLAN-SCHRITTEN   (neu in v1.5.237)
//  Einfügen in AA_tests.js nach der Kategorie MODAL-SCHLIESSVERHALTEN,
//  weiterhin VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • Erinnerung wird außerhalb des Schritts abgelegt und zeigt nach dem
//     Umsortieren auf den falschen Schritt
//   • Verknüpfte Schritte bekommen eine zweite, konkurrierende Datumsangabe
//   • Erledigte oder künftige Erinnerungen tauchen im Dashboard auf
//   • Glocke wird wieder als Emoji statt als SVG gerendert
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== ERINNERUNGEN PLAN-SCHRITTE ===');

(function testPlanErinnerungen() {

  const noetig = ['svgGlocke','erinnStatus','erinnFaellige','erinnZeileHTML','erinnPopover',
                  'erinnSetzen','erinnSetzenDatum','erinnPlusTag','erinnSchrittAbhaken',
                  'erinnDashboardHTML','erinnPilleAktualisieren'];
  const fehlt = noetig.filter(f => typeof window[f] !== 'function');
  if (fehlt.length) fail('Nicht definierte Funktionen: ' + fehlt.join(', '));
  else ok('Alle ' + noetig.length + ' Funktionen definiert');

  if (!document.getElementById('ph-plan-erinn'))
    fail('Erinnerungs-Pille im Panel-Kopf fehlt');
  else ok('Erinnerungs-Pille vorhanden');

  // ── Symbol bleibt schlicht ──────────────────────────────────────────────
  if (typeof svgGlocke === 'function') {
    const g = svgGlocke(12);
    if (!g.includes('<svg')) fail('svgGlocke liefert kein SVG');
    else if (/[\u{1F300}-\u{1FAFF}]/u.test(g)) fail('Glocke enthält wieder ein Emoji');
    else ok('Glocke ist ein schlichtes SVG');
  }
  if (typeof erinnDashboardHTML === 'function' &&
      /[\u{1F300}-\u{1FAFF}]/u.test(erinnDashboardHTML()))
    fail('Dashboard-Erinnerungen enthalten Emojis');
  else ok('Dashboard-Erinnerungen ohne Emojis');

  // ── Ablageort: am Schritt, nicht über den Index ────────────────────────
  if (typeof erinnSetzen === 'function') {
    const src = erinnSetzen.toString();
    if (/schrittIdx|erinnerungen\s*\[/.test(src))
      fail('Erinnerung wird wieder außerhalb des Schritts abgelegt – Indexproblem');
    else if (!/s\.erinnerung\s*=/.test(src))
      fail('Erinnerung wird nicht am Schritt-Objekt gesetzt');
    else ok('Erinnerung liegt am Schritt-Objekt');
  }

  // ── Verknüpfte Schritte bekommen keine Glocke ──────────────────────────
  if (typeof erinnZeileHTML === 'function') {
    if (erinnZeileHTML({ id:'x' }, { aufgabeId:'a1' }, 0, false) !== '')
      fail('Verknüpfte Schritte bekommen eine eigene Erinnerung – zwei Datumsangaben');
    else ok('Verknüpfte Schritte ohne eigene Erinnerung');
  }

  // ── Auswahl im Dashboard ────────────────────────────────────────────────
  if (typeof erinnFaellige === 'function' && typeof DB !== 'undefined' && DB) {
    const heute = today();
    const liste = erinnFaellige();

    const kuenftig = liste.filter(x => x.datum > heute);
    if (kuenftig.length) fail(kuenftig.length + ' künftige Erinnerungen stehen im Dashboard');
    else ok('Künftige Erinnerungen bleiben ausgeblendet');

    const erledigt = liste.filter(x => (x.schritt.status === 'erledigt'));
    if (erledigt.length) fail(erledigt.length + ' erledigte Schritte werden noch erinnert');
    else ok('Erledigte Schritte fallen aus der Liste');

    const verknuepft = liste.filter(x => x.schritt.aufgabeId);
    if (verknuepft.length) fail('Verknüpfte Schritte tauchen in der Erinnerungsliste auf');
    else ok('Nur Textschritte in der Erinnerungsliste');

    const sortiert = liste.every((x, i) => i === 0 || liste[i-1].datum <= x.datum);
    if (!sortiert) fail('Erinnerungen sind nicht nach Datum sortiert');
    else ok('Sortierung nach Datum, Überfälliges zuerst');

    ok(liste.length + ' fällige Erinnerung(en) im Bestand');
  }

  // ── Datenbestand plausibel ──────────────────────────────────────────────
  if (typeof DB !== 'undefined' && DB && Array.isArray(DB.plaene)) {
    let kaputt = 0, aufAufgabe = 0;
    DB.plaene.forEach(p => (p.schritte || []).forEach(s => {
      if (!s.erinnerung) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.erinnerung)) kaputt++;
      if (s.aufgabeId) aufAufgabe++;
    }));
    if (kaputt) fail(kaputt + ' Erinnerungen haben kein gültiges ISO-Datum');
    else ok('Alle Erinnerungen im Format JJJJ-MM-TT');
    if (aufAufgabe) warn(aufAufgabe + ' verknüpfte Schritte tragen eine eigene Erinnerung – Altbestand?');
    else ok('Keine Erinnerungen an verknüpften Schritten');
  }

})();

// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: PLAN-ABZEICHEN „HEUTE"   (neu in v1.5.238, erweitert bis v1.5.240)
//  Einfügen in AA_tests.js nach der Kategorie ERINNERUNGEN PLAN-SCHRITTE,
//  weiterhin VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • Abzeichen zählt erledigte Aufgaben oder künftig eingeplante mit
//   • Abzeichen zählt überfällige Aufgaben mit und klebt dauerhaft
//   • Abzeichen fehlt in der Krise-Zeile oder in der Schnellansicht
//   • Plan-Zähler und Einzelschritt-Kennzeichnung laufen auseinander
//   • Abzeichen und die Sektion „Heute eingeplant" im Aufgaben-Panel
//     kommen auf unterschiedliche Ergebnisse
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== PLAN-ABZEICHEN HEUTE ===');

(function testPlanHeute() {

  const noetig = ['schrittStehtHeuteAn','planHeuteEingeplant','planHeuteBadge','schrittHeuteBadge'];
  const fehlt = noetig.filter(f => typeof window[f] !== 'function');
  if (fehlt.length) { fail('Nicht definiert: ' + fehlt.join(', ')); return; }
  ok('Alle ' + noetig.length + ' Funktionen definiert');

  // Bedingung darf nur an einer Stelle stehen
  if (!/schrittStehtHeuteAn/.test(planHeuteEingeplant.toString()))
    fail('planHeuteEingeplant hat die Bedingung erneut ausformuliert statt sie zu teilen');
  else ok('Bedingung steht nur in schrittStehtHeuteAn()');

  // ── Kriterium: eingeplant, nicht fällig ─────────────────────────────────
  const src = schrittStehtHeuteAn.toString();
  if (!/geplantAm/.test(src))
    fail('Abzeichen liest nicht geplantAm – eingeplante Aufgaben fehlen');
  else ok('Abzeichen zählt eingeplante Aufgaben');
  if (!/tzDatumGruppe/.test(src))
    fail('Abzeichen nutzt tzDatumGruppe() nicht – heute fällige Aufgaben fehlen');
  else ok('Fälligkeit über dieselbe Logik wie Dashboard und Tageszettel');
  if (/'ueberfaellig'/.test(src))
    fail('Überfällige Aufgaben zählen wieder mit – Abzeichen wird zum Dauerzustand');
  else ok('Überfällige Fälligkeiten bleiben ausgeschlossen');

  // ── Verhalten an konstruierten Fällen ───────────────────────────────────
  if (typeof DB !== 'undefined' && DB && Array.isArray(DB.aufgaben)) {
    const sich = DB.aufgaben;
    const heute = today();
    const gestern = tzPlusTage(heute, -2), morgen = tzPlusTage(heute, 1);
    try {
      DB.aufgaben = [
        { id:'_t1', status:'offen',    geplantAm:{ datum: heute } },
        { id:'_t2', status:'offen',    geplantAm:{ datum: gestern } },
        { id:'_t3', status:'offen',    geplantAm:{ datum: morgen } },
        { id:'_t4', status:'offen',    faellig: heute },
        { id:'_t5', status:'erledigt', geplantAm:{ datum: heute } },
      ];
      DB.aufgaben.push(
        { id:'_t6', status:'offen',    faellig: tzPlusTage(heute, -4) },
        { id:'_t7', status:'offen',    faellig: morgen },
        { id:'_t8', status:'offen',    startdatum: heute },
        { id:'_t9', status:'offen',    startdatum: tzPlusTage(heute,-9), wiedervorlage: heute },
      );
      const f = [
        [{ schritte:[{ aufgabeId:'_t1' }] }, 1, 'heute eingeplant'],
        [{ schritte:[{ aufgabeId:'_t2' }] }, 1, 'vergangen und offen'],
        [{ schritte:[{ aufgabeId:'_t3' }] }, 0, 'künftig eingeplant'],
        [{ schritte:[{ aufgabeId:'_t4' }] }, 1, 'heute fällig'],
        [{ schritte:[{ aufgabeId:'_t5' }] }, 0, 'erledigt'],
        [{ schritte:[{ aufgabeId:'_t6' }] }, 0, 'überfällig'],
        [{ schritte:[{ aufgabeId:'_t7' }] }, 0, 'morgen fällig'],
        [{ schritte:[{ aufgabeId:'_t8' }] }, 1, 'Startdatum heute'],
        [{ schritte:[{ aufgabeId:'_t9' }] }, 1, 'Wiedervorlage heute'],
        [{ schritte:[{ aufgabeId:'_t1' }] }, 1, 'keine Doppelzählung'],
        [{ schritte:[{ titel:'Text' }] },    0, 'reiner Textschritt'],
        [{ schritte:[] },                    0, 'leerer Plan'],
      ];
      const schlecht = f.filter(([p, soll]) => planHeuteEingeplant(p) !== soll);
      if (schlecht.length) fail('Zählung falsch bei: ' + schlecht.map(x => x[2]).join(', '));
      else ok('Alle ' + f.length + ' Zählfälle korrekt');

      if (planHeuteBadge({ schritte:[{ aufgabeId:'_t3' }] }) !== '')
        fail('Abzeichen erscheint ohne Treffer');
      else ok('Ohne Treffer kein Abzeichen');
    } catch (e) {
      fail('planHeuteEingeplant wirft Fehler: ' + e.message);
    } finally {
      DB.aufgaben = sich;
    }
  }

  // ── Abgleich mit dem Aufgaben-Panel ─────────────────────────────────────
  if (typeof DB !== 'undefined' && DB && Array.isArray(DB.plaene)) {
    const heute = today();
    const zaehltIds = new Set(DB.aufgaben.filter(a => {
      if (moveAufgabeErledigt(a)) return false;
      if (a.geplantAm?.datum && a.geplantAm.datum <= heute) return true;
      return tzDatumGruppe(a, heute) === 'heute';
    }).map(a => a.id));
    let ausPlaenen = 0;
    DB.plaene.forEach(p => {
      (p.schritte || []).forEach(s => { if (s.aufgabeId && zaehltIds.has(s.aufgabeId)) ausPlaenen++; });
    });
    const summe = DB.plaene.reduce((n, p) => n + planHeuteEingeplant(p), 0);
    if (summe !== ausPlaenen)
      fail('Abzeichen zählt ' + summe + ', erwartet ' + ausPlaenen + ' – Kriterium weicht ab');
    else ok('Abzeichen deckt sich mit dem Kriterium (' + summe + ')');

    const mitBadge = DB.plaene.filter(p => planHeuteEingeplant(p) > 0).length;
    ok(mitBadge + ' von ' + DB.plaene.length + ' Plänen tragen das Abzeichen');
  }

  // ── Abzeichen in allen Renderfunktionen ────────────────────────────────
  // Pläne mit Priorität "Krise" werden über eine eigene Zeilenfunktion
  // gerendert – dort fehlte das Abzeichen bis v1.5.239.
  const skripte = Array.from(document.querySelectorAll('script'))
    .map(s => s.textContent || '').join('\n');
  const treffer = (skripte.match(/planHeuteBadge\(p\)/g) || []).length;
  if (treffer < 5)
    fail('planHeuteBadge wird nur ' + treffer + '× gerendert – erwartet 5 (Planzeile, Krise-Zeile, Plan-Karte, Schnellansicht, Helfer)');
  else ok('Plan-Abzeichen in allen Ansichten gerendert');
  if (!/schrittHeuteBadge\(s\)/.test(skripte))
    fail('Einzelschritte in der Schnellansicht werden nicht gekennzeichnet');
  else ok('Einzelschritte in der Schnellansicht gekennzeichnet');

  // Zähler und Einzelkennzeichnung müssen übereinstimmen
  if (typeof DB !== 'undefined' && DB && Array.isArray(DB.plaene)) {
    const abweichung = DB.plaene.filter(p =>
      planHeuteEingeplant(p) !== (p.schritte || []).filter(schrittStehtHeuteAn).length);
    if (abweichung.length)
      fail(abweichung.length + ' Pläne: Zähler und markierte Schritte weichen ab');
    else ok('Zähler deckt sich überall mit den markierten Schritten');
  }

})();

// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: TAGESZETTEL-DETAILTIEFE   (neu in v1.5.242)
//  Einfügen in AA_tests.js nach der Kategorie PLAN-ABZEICHEN „HEUTE",
//  weiterhin VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • Schalter wirken auf beide Bereiche statt nur auf ihren eigenen
//   • Bereits erfüllte Kriterien landen wieder auf dem Papier
//   • Erledigte erste Schritte werden noch angeboten
//   • Schalterstellung überlebt den Reload nicht
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== TAGESZETTEL-DETAILTIEFE ===');

(function testTageszettelTiefe() {

  if (typeof TZ === 'undefined' || !TZ.tiefe) {
    fail('TZ.tiefe fehlt – Detailtiefe nicht vorhanden');
    return;
  }
  if (!TZ.tiefe.work || !TZ.tiefe.priv)
    fail('TZ.tiefe muss je einen Eintrag für work und priv haben');
  else ok('Detailtiefe je Bereich getrennt geführt');

  if (typeof tzOffeneKriterien !== 'function')
    fail('tzOffeneKriterien() nicht definiert');
  else {
    const a = { ergebnis:[{ text:'A', erledigt:true }, { text:'B', erledigt:false }] };
    const r = tzOffeneKriterien(a);
    if (r.length !== 1 || r[0] !== 'B')
      fail('Erfüllte Kriterien landen wieder auf dem Zettel');
    else ok('Nur offene Kriterien werden übernommen');
    if (tzOffeneKriterien(null).length !== 0) fail('tzOffeneKriterien ist nicht null-sicher');
    else ok('null-sicher');
  }

  // ── Schalter wirken nur auf ihren Bereich ───────────────────────────────
  if (typeof tzPdfErstellen === 'function') {
    const src = tzPdfErstellen.toString();
    if (!/TZ\.tiefe\[z\.quelle\]/.test(src))
      fail('Detailtiefe wird nicht je Quelle ausgewertet – Schalter wirken global');
    else ok('Detailtiefe wird je Quelle ausgewertet');
  }
  if (typeof tzRenderPaper === 'function' && !/TZ\.tiefe\[z\.quelle\]/.test(tzRenderPaper.toString()))
    fail('Vorschau wertet die Detailtiefe nicht je Quelle aus');
  else ok('Vorschau folgt der Detailtiefe je Quelle');

  // ── Schalterleiste im DOM ───────────────────────────────────────────────
  if (typeof tzHtmlAufgaben === 'function' && typeof TZ !== 'undefined') {
    const sich = { q:TZ.quellen, z:TZ.zettel, k:TZ.katalog, o:TZ.offen };
    try {
      TZ.quellen = { work: DB, priv: null };
      TZ.zettel = []; TZ.katalog = {}; TZ.offen = {};
      const h = tzHtmlAufgaben('work');
      if (!h.includes('tz-tiefe')) fail('Schalterleiste fehlt in der Aufgabenliste');
      else ok('Schalterleiste wird gerendert');
      if ((h.match(/data-tz="tiefe"/g) || []).length !== 2)
        fail('Erwartet genau 2 Schalter je Bereich');
      else ok('Zwei Schalter je Bereich');

      // Erledigte erste Schritte dürfen nicht angeboten werden
      const falsch = Object.values(TZ.katalog).filter(k => {
        if (!k.ersterSchritt) return false;
        const a = (DB.aufgaben || []).find(x => x.titel === k.text);
        return a && a.ersterSchrittErledigt;
      });
      if (falsch.length) fail(falsch.length + ' erledigte erste Schritte werden angeboten');
      else ok('Erledigte erste Schritte bleiben draußen');

      // Katalog trägt nur offene Kriterien
      const zuviel = Object.values(TZ.katalog).filter(k => {
        const a = (DB.aufgaben || []).find(x => x.titel === k.text);
        if (!a || !Array.isArray(a.ergebnis)) return false;
        return (k.kriterien || []).length !== a.ergebnis.filter(x => !x.erledigt).length;
      });
      if (zuviel.length) fail(zuviel.length + ' Aufgaben mit falscher Kriterienzahl im Katalog');
      else ok('Katalog trägt genau die offenen Kriterien');
    } catch (e) {
      fail('tzHtmlAufgaben wirft Fehler: ' + e.message);
    } finally {
      TZ.quellen = sich.q; TZ.zettel = sich.z; TZ.katalog = sich.k; TZ.offen = sich.o;
    }
  }

  // ── Persistenz ──────────────────────────────────────────────────────────
  if (typeof tzSpeichern === 'function' && !/tiefe/.test(tzSpeichern.toString()))
    fail('Schalterstellung wird nicht gesichert – geht beim Reload verloren');
  else ok('Schalterstellung wird gesichert');
  if (typeof tzWiederherstellen === 'function' && !/tiefe/.test(tzWiederherstellen.toString()))
    fail('Schalterstellung wird nicht wiederhergestellt');
  else ok('Schalterstellung wird wiederhergestellt');

  // ── PDF zeichnet die Unterzeilen ───────────────────────────────────────
  if (typeof erstelleTageszettelPDF === 'function') {
    const src = erstelleTageszettelPDF.toString();
    if (!/tzUnterZeile/.test(src))
      fail('PDF zeichnet keine Unterzeilen mehr');
    else ok('PDF zeichnet erste Schritte und Kriterien');
  }

  // ── Google-Kalender-Knopf ───────────────────────────────────────────────
  if (typeof googleKalenderOeffnen !== 'function')
    fail('googleKalenderOeffnen() fehlt');
  else if (!document.querySelector('.btn-extern'))
    fail('Kalender-Knopf in der Sidebar fehlt');
  else ok('Kalender-Knopf vorhanden');

})();

// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: HEUTE ERLEDIGTES IM TAGESZETTEL   (neu in v1.5.243, v1.5.244)
//  Einfügen in AA_tests.js nach der Kategorie TAGESZETTEL-DETAILTIEFE,
//  weiterhin VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • Ein Weg zum Erledigen setzt erledigtAm nicht – die Erledigung bleibt
//     im Rückblick unsichtbar
//   • Wiedergeöffnetes behält erledigtAm und gilt weiter als heute erledigt
//   • Gestern oder früher Erledigtes rutscht in den Rückblick
//   • Aufgaben an Plan-Schritten erscheinen doppelt
//   • Rückfallebene über das Änderungsprotokoll fällt weg – dann bleibt
//     alles unsichtbar, was vor v1.5.243 abgehakt wurde
//   • Protokoll wird in UTC statt lokal ausgewertet
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== HEUTE ERLEDIGTES ===');

(function testErledigtHeute() {

  const noetig = ['statusSetzen','heuteErledigt','tzErledigteHeute'];
  const fehlt = noetig.filter(f => typeof window[f] !== 'function');
  if (fehlt.length) { fail('Nicht definiert: ' + fehlt.join(', ')); return; }
  ok('Alle Funktionen definiert');

  // ── statusSetzen pflegt den Zeitstempel ─────────────────────────────────
  const o = { status:'offen' };
  statusSetzen(o, 'erledigt');
  if (o.erledigtAm !== today()) fail('statusSetzen setzt erledigtAm nicht auf heute');
  else ok('erledigtAm wird gesetzt');
  statusSetzen(o, 'offen');
  if ('erledigtAm' in o) fail('erledigtAm bleibt beim Wiederöffnen stehen');
  else ok('erledigtAm wird beim Wiederöffnen entfernt');

  // ── Kein Weg schreibt den Status noch direkt ────────────────────────────
  const skripte = Array.from(document.querySelectorAll('script'))
    .map(s => s.textContent || '').join('\n');
  const direkt = (skripte.match(/\b[as]\.status\s*=\s*(?!==)/g) || []).length;
  if (direkt) fail(direkt + ' Stellen setzen den Status direkt statt über statusSetzen() – erledigtAm fehlt dort');
  else ok('Alle Statusänderungen laufen über statusSetzen()');

  // ── heuteErledigt ───────────────────────────────────────────────────────
  const g = new Date(); g.setDate(g.getDate() - 1);
  const gestern = isoDatum(g);
  const jetzt   = new Date().toISOString();
  const gesternTs = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString(); })();
  const LG = (zu, ts) => ({ aktion:'status_geaendert', zu, datum: ts });
  const f = [
    [{ status:'erledigt', erledigtAm: today() }, true,  'heute erledigt'],
    [{ status:'erledigt', erledigtAm: gestern }, false, 'gestern erledigt'],
    [{ status:'erledigt' },                      false, 'weder Datum noch Protokoll'],
    [{ status:'offen', erledigtAm: today() },    false, 'offen mit Zeitstempel'],
    // Rückfallebene Protokoll
    [{ status:'erledigt', log:[LG('erledigt', jetzt)] },     true,  'heute laut Protokoll'],
    [{ status:'erledigt', log:[LG('erledigt', gesternTs)] }, false, 'gestern laut Protokoll'],
    [{ status:'erledigt', log:[LG('erledigt', gesternTs), LG('offen', jetzt), LG('erledigt', jetzt)] },
                                                             true,  'gestern zu, heute auf und wieder zu'],
    [{ status:'erledigt', log:[LG('erledigt', jetzt), LG('offen', jetzt)] },
                                                             false, 'letzter Protokolleintrag ist offen'],
    [{ status:'erledigt', log:[LG('erledigt', jetzt), { aktion:'aufgewertet', datum: jetzt }] },
                                                             true,  'fremde Einträge überspringen'],
    [{ status:'erledigt', log:[LG('erledigt', 'keindatum')] }, false, 'kaputter Zeitstempel'],
    [{ status:'erledigt', log:'kaputt' },                    false, 'Protokoll kein Array'],
    [{ status:'erledigt', erledigtAm: gestern, log:[LG('erledigt', jetzt)] },
                                                             false, 'erledigtAm hat Vorrang'],
  ];
  const schlecht = f.filter(([x, soll]) => heuteErledigt(x) !== soll);
  if (schlecht.length) fail('heuteErledigt falsch bei: ' + schlecht.map(x => x[2]).join('; '));
  else ok('Alle ' + f.length + ' Fälle korrekt, inklusive Rückfallebene');

  if (!/isoDatum\(d\)/.test(heuteErledigt.toString()))
    fail('Protokollzeitstempel wird nicht lokal umgerechnet – UTC-Verschiebung nachts');
  else ok('Protokoll wird lokal ausgewertet');
  if (!/l\.aktion !== 'status_geaendert'/.test(heuteErledigt.toString()))
    warn('Rückfallebene filtert nicht mehr auf status_geaendert');

  // ── Sammlung gegen echte Daten ──────────────────────────────────────────
  if (typeof TZ !== 'undefined' && typeof DB !== 'undefined' && DB) {
    const sich = TZ.quellen;
    try {
      TZ.quellen = { work: DB, priv: null };
      const liste = tzErledigteHeute();

      const nichtHeute = liste.filter(x => !x.text);
      if (nichtHeute.length) fail(nichtHeute.length + ' Einträge ohne Text im Rückblick');
      else ok('Alle Rückblick-Einträge haben einen Text');

      // Aufgaben, die an einem Plan hängen, dürfen nur einmal erscheinen
      const texte = liste.map(x => x.text);
      const doppelt = texte.filter((x, i) => texte.indexOf(x) !== i);
      if (doppelt.length) fail('Doppelte Einträge im Rückblick: ' + doppelt.join(', '));
      else ok('Keine Doppelungen zwischen Aufgabenliste und Plänen');

      const erwartet = (DB.aufgaben || []).filter(heuteErledigt).length;
      ok('Heute abgehakt: ' + erwartet + ' Aufgaben, ' + liste.length + ' Einträge im Rückblick');
    } catch (e) {
      fail('tzErledigteHeute wirft Fehler: ' + e.message);
    } finally {
      TZ.quellen = sich;
    }
  }

  // ── Schalter und Darstellung ────────────────────────────────────────────
  if (typeof TZ !== 'undefined' && !('erledigte' in TZ))
    fail('TZ.erledigte fehlt – Schalter nicht vorhanden');
  else ok('Schalterzustand wird geführt');
  if (!document.getElementById('tz-tg-erl'))
    fail('Schalter „Heute Erledigtes zeigen" fehlt im DOM');
  else ok('Schalter im DOM vorhanden');
  if (typeof tzSpeichern === 'function' && !/erledigte/.test(tzSpeichern.toString()))
    fail('Schalterstellung wird nicht gesichert');
  else ok('Schalterstellung wird gesichert');

  if (typeof erstelleTageszettelPDF === 'function' &&
      !/'trenner'/.test(erstelleTageszettelPDF.toString()))
    fail('PDF kennt den Trenner vor dem Rückblick nicht');
  else ok('PDF trennt den Rückblick ab');

  // Erledigtes wird nur durchgestrichen, nicht ausgegraut (v1.5.245)
  if (typeof erstelleTageszettelPDF === 'function') {
    const src = erstelleTageszettelPDF.toString();
    const bullet = src.match(/function tzBulletZeile[\s\S]*?\n  \}/);
    if (!bullet) {
      warn('tzBulletZeile im Quelltext nicht auffindbar');
    } else if (/erledigt \? 150/.test(bullet[0]) || /\[150, 138, 118\]/.test(bullet[0]))
      fail('Erledigte Einträge werden im Tageszettel wieder ausgegraut');
    else
      ok('Erledigte Einträge bleiben schwarz, nur durchgestrichen');

    // Unterzeilen (erster Schritt, Kriterien) in voller Schriftfarbe
    const unter = src.match(/function tzUnterZeile[\s\S]*?\n  \}/);
    if (unter && /60, 50, 38/.test(unter[0]))
      fail('Erster Schritt und Kriterien werden wieder abgeschwächt gesetzt');
    else if (unter) ok('Unterzeilen in voller Schriftfarbe');

    // Die Trennlinie darf grau bleiben – sie ist Struktur, kein Text
    if (!/setDrawColor\(150, 138, 118\)/.test(src))
      warn('Trennlinie vor dem Rückblick ist nicht mehr abgesetzt');
    else ok('Trennlinie bleibt dezent');
  }

  // Pläne-Übersicht folgt derselben Regel
  if (typeof moveUebersichtPDF === 'function') {
    const src = moveUebersichtPDF.toString();
    const sz = src.match(/function schrittZeile[\s\S]*?\n  \}/);
    if (sz && /erledigt \? \[150/.test(sz[0]))
      fail('Pläne-Übersicht graut erledigte Schritte wieder aus');
    else if (sz) ok('Pläne-Übersicht und Tageszettel gleich eingefärbt');
  }

  // ── Protokollfehler von früher ──────────────────────────────────────────
  if (typeof planSchrittStatusToggle === 'function') {
    const src = planSchrittStatusToggle.toString();
    if (/von:\s*a\.status/.test(src))
      fail('planSchrittStatusToggle liest „von" wieder nach der Änderung – Protokoll falsch');
    else ok('Protokoll hält den alten Status fest');
  }
  if (typeof qvSchrittToggle === 'function' && !/logAktion/.test(qvSchrittToggle.toString()))
    fail('Abhaken in der Schnellansicht wird nicht protokolliert');
  else ok('Schnellansicht protokolliert das Abhaken');

})();

// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: TAGESZETTEL-OVERLAY   (neu in v1.5.247, erweitert in v1.5.248)
//  Einfügen in AA_tests.js nach der Kategorie HEUTE ERLEDIGTES,
//  weiterhin VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • Einträge werden wieder als Momentaufnahme gezeigt statt live aufgelöst
//   • Panel erscheint auf Ansichten, die selbst eine rechte Spalte haben
//   • Einträge der zweiten, nur lesend geladenen Datei werden bearbeitbar
//   • Gelöschte Originale verschwinden kommentarlos statt als verwaist
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== TAGESZETTEL-OVERLAY ===');

(function testZettelPanel() {

  const noetig = ['tzEintragAufloesen','zpBearbeitbar','zpNeueHeute','zpToggle','zpRender',
                  'zpAnsicht','zpAnstossen','zpToggleEintrag','zpNeueUebernehmen','zpWiederherstellen'];
  const fehlt = noetig.filter(f => typeof window[f] !== 'function');
  if (fehlt.length) { fail('Nicht definiert: ' + fehlt.join(', ')); return; }
  ok('Alle ' + noetig.length + ' Funktionen definiert');

  ['zettel-panel','zp-paper','zp-cnt','zp-hinweis','btn-zettelpanel'].forEach(id => {
    if (!document.getElementById(id)) fail('Element ' + id + ' fehlt');
  });
  ok('Panel-Elemente vorhanden');

  // ── Ansichten ohne Panel ────────────────────────────────────────────────
  if (typeof ZP_OHNE === 'undefined' || ZP_OHNE.indexOf('tageszettel') < 0 ||
      ZP_OHNE.indexOf('notizmove') < 0)
    fail('Panel wird nicht auf Tageszettel und Notiz-Export unterdrückt');
  else ok('Ansichten mit eigener rechter Spalte ausgenommen');

  // ── Live-Auflösung statt Momentaufnahme ────────────────────────────────
  const src = tzEintragAufloesen.toString();
  if (!/verwaist/.test(src))
    fail('Gelöschte Originale werden nicht als verwaist gekennzeichnet');
  else ok('Verwaiste Einträge werden erkannt');

  if (typeof zpRender === 'function' && !/tzEintragAufloesen/.test(zpRender.toString()))
    fail('Panel zeichnet aus der Momentaufnahme statt live aufzulösen');
  else ok('Panel löst live gegen die Daten auf');

  // ── Zweitquelle bleibt schreibgeschützt ────────────────────────────────
  if (typeof zpToggleEintrag === 'function' && !/zpBearbeitbar/.test(zpToggleEintrag.toString()))
    fail('Abhaken prüft nicht, ob der Eintrag zur geöffneten Datei gehört');
  else ok('Zweitquelle bleibt schreibgeschützt');

  // ── Gegen echte Daten ───────────────────────────────────────────────────
  if (typeof TZ !== 'undefined' && Array.isArray(TZ.zettel) && TZ.zettel.length) {
    let verwaist = 0, abweichend = 0;
    TZ.zettel.forEach(z => {
      const r = tzEintragAufloesen(z);
      if (r.verwaist) verwaist++;
      else if (z.typ !== 'termin' && r.text && z.text && r.text !== z.text) abweichend++;
    });
    if (verwaist) warn(verwaist + ' Zettel-Einträge zeigen auf gelöschte Originale');
    else ok('Alle Zettel-Einträge auflösbar');
    if (abweichend) ok(abweichend + ' Einträge zeigen den aktualisierten Titel');
    else ok('Titel überall aktuell');
  } else {
    warn('Zettel ist leer – Live-Auflösung nicht gegen echte Daten prüfbar');
  }

  // ── Erweiterungen aus v1.5.248 ─────────────────────────────────────────
  ['zpOffeneHeute','zpErstToggle','zpKritToggle','zpErledigteToggle','zpPdfExport',
   'aufgabeStehtHeuteAn'].forEach(f => {
    if (typeof window[f] !== 'function') fail(f + '() fehlt');
  });
  ok('Funktionen der Erweiterung vorhanden');

  ['zp-tg-erl'].forEach(id => {
    if (!document.getElementById(id)) fail('Element ' + id + ' fehlt');
  });
  if (!document.querySelector('.zp-export')) fail('PDF-Knopf im Panel fehlt');
  else ok('Erledigt-Schalter und PDF-Knopf vorhanden');

  // Vorschlag stützt sich auf Fälligkeit, nicht auf das Anlagedatum
  if (typeof zpOffeneHeute === 'function') {
    const src2 = zpOffeneHeute.toString();
    if (/a\.erstellt/.test(src2))
      fail('Vorschlagsliste greift wieder auf das Anlagedatum zurück');
    else if (!/schrittStehtHeuteAn/.test(src2))
      fail('Plan-Schritte werden nicht mehr vorgeschlagen');
    else ok('Vorschlag umfasst heute fällige Aufgaben und Plan-Schritte');
  }

  // Regel steht nur an einer Stelle
  if (typeof schrittStehtHeuteAn === 'function' &&
      !/aufgabeStehtHeuteAn/.test(schrittStehtHeuteAn.toString()))
    fail('schrittStehtHeuteAn formuliert die Regel erneut aus');
  else ok('Regel „steht heute an" nur einmal im Code');

  // Erledigt-Schalter teilt sich den Zustand mit dem Assistenten
  if (typeof zpErledigteToggle === 'function' && !/TZ\.erledigte/.test(zpErledigteToggle.toString()))
    fail('Panel-Schalter nutzt einen eigenen Zustand statt TZ.erledigte');
  else ok('Panel und PDF teilen sich den Erledigt-Schalter');

  // Ganztagstermine
  if (typeof TZ !== 'undefined' && !('ganztag' in TZ))
    fail('TZ.ganztag fehlt – Ganztagstermine nicht vorhanden');
  else ok('Ganztag-Zustand wird geführt');
  if (typeof tzAddTermin === 'function' && !/ganztag/.test(tzAddTermin.toString()))
    fail('tzAddTermin kennt keine Ganztagstermine');
  else ok('Ganztagstermine werden angelegt');

  const ganz = (DB.aufgaben ? TZ.zettel : []).filter(z => z.terminDaten && z.terminDaten.ganztag);
  if (ganz.length && ganz.some(z => z.terminDaten.start))
    fail('Ganztagstermine tragen trotzdem eine Uhrzeit');
  else ok(ganz.length + ' Ganztagstermin(e) auf dem Zettel, alle ohne Uhrzeit');

  // ── Panel wird nachgezogen ──────────────────────────────────────────────
  if (typeof saveDB === 'function' && !/zpAnstossen/.test(saveDB.toString()))
    fail('saveDB zieht das Panel nicht nach – es bleibt stehen');
  else ok('Jede Datenänderung zieht das Panel nach');
  if (typeof zpAnstossen === 'function' && !/setTimeout/.test(zpAnstossen.toString()))
    warn('Panel-Aktualisierung ist nicht entprellt');
  else ok('Aktualisierung entprellt');

})();

// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: FOKUS-MODUS   (neu in v1.5.249)
//  Einfügen in AA_tests.js nach der Kategorie TAGESZETTEL-OVERLAY,
//  weiterhin VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • Fokus baut die Oberfläche neu auf statt sich darüberzulegen –
//     laufende Eingaben gehen verloren
//   • Neuladen wird zum bequemen Ausweg aus dem Fokus
//   • Notfall-Modus verliert seine feste Laufzeit
//   • Warnung lässt sich wieder wegklicken oder greift nach dem Export
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== FOKUS-MODUS ===');

(function testFokusModus() {

  const noetig = ['fmStart','fmFokusAn','fmModus','fmTick','fmAnsicht','fmSchirmFuellen',
                  'fmWarnungAktiv','fmWarnbannerZeichnen','fmExportGemerkt',
                  'fmZettelHeuteExportiert','fmSpeichern','fmWiederherstellen'];
  const fehlt = noetig.filter(f => typeof window[f] !== 'function');
  if (fehlt.length) { fail('Nicht definiert: ' + fehlt.join(', ')); return; }
  ok('Alle ' + noetig.length + ' Funktionen definiert');

  ['fm-schirm','fm-dlg','fm-uhr','fm-datum','fm-warn','fm-motto','fm-zahl','fm-dauer',
   'fm-bar','fm-warnung','fm-dauer-wahl'].forEach(id => {
    if (!document.getElementById(id)) fail('Element ' + id + ' fehlt');
  });
  if (document.querySelectorAll('.fm-wahl').length !== 3)
    fail('Der Dialog hat nicht genau drei Wege');
  else ok('Drei Wege im Dialog');
  const prim = document.querySelector('.fm-wahl.prim');
  if (!prim || !/Move nutzen/.test(prim.textContent))
    fail('„Move nutzen — Abbrechen" ist nicht die hervorgehobene Vorgabe');
  else ok('Move-Abbrechen ist die Vorgabe');

  // ── Overlay statt Neuaufbau ─────────────────────────────────────────────
  const schirm = document.getElementById('fm-schirm');
  if (schirm && getComputedStyle(schirm).position !== 'fixed')
    fail('Fokus-Schirm ist kein Overlay – Eingaben könnten verloren gehen');
  else ok('Fokus liegt als Overlay über der Oberfläche');
  if (typeof fmFokusAn === 'function' && /innerHTML\s*=/.test(fmFokusAn.toString()))
    warn('fmFokusAn schreibt innerHTML – prüfen, ob etwas neu aufgebaut wird');

  // ── Neuladen ist kein Ausweg ───────────────────────────────────────────
  if (typeof fmWiederherstellen === 'function' &&
      !/d\.modus === 'normal'/.test(fmWiederherstellen.toString()))
    fail('Nach dem Neuladen wird der Fokus nicht wiederhergestellt');
  else ok('Neuladen führt zurück in den Fokus');

  // ── Notfall behält seine feste Laufzeit ────────────────────────────────
  if (typeof FM_NOTFALL_MS === 'undefined' || FM_NOTFALL_MS !== 30 * 60 * 1000)
    fail('Notfall-Laufzeit ist nicht mehr 30 Minuten');
  else ok('Notfall-Modus läuft 30 Minuten');
  if (typeof fmTick === 'function' && !/notfallBis/.test(fmTick.toString()))
    fail('Notfall-Countdown wird nicht mehr geprüft');
  else ok('Notfall endet automatisch');

  // ── Warnung ─────────────────────────────────────────────────────────────
  if (typeof fmWarnungAktiv === 'function') {
    const src = fmWarnungAktiv.toString();
    if (!/getHours\(\) === 7 && .*getMinutes\(\) >= 55/.test(src.replace(/\s+/g, ' ')))
      warn('Die 07:55-Grenze ist nicht mehr erkennbar');
    else ok('Warnung ab 07:55');
    if (!/FM_LANG_OFFEN|15 \* 60/.test(src + String(typeof FM_LANG_OFFEN !== 'undefined' ? FM_LANG_OFFEN : '')))
      warn('Die 15-Minuten-Regel ist nicht mehr erkennbar');
    else ok('Warnung nach 15 Minuten ohne Export');
    if (/getDay\(\)/.test(src))
      fail('Warnung ist wieder auf Werktage beschränkt – gewünscht sind sieben Tage');
    else ok('Warnung gilt an sieben Tagen');
  }
  const warnEl = document.getElementById('fm-warnung');
  if (warnEl && /Heute nicht mehr|Später|Ausblenden/.test(warnEl.innerHTML))
    fail('Die Warnung lässt sich wegklicken – sie soll bis zum Export bleiben');
  else ok('Warnung ist nicht wegklickbar');

  // ── Export setzt den Merker ────────────────────────────────────────────
  if (typeof tzPdfErstellen === 'function' && !/fmExportGemerkt/.test(tzPdfErstellen.toString()))
    fail('Der Export merkt sich den Tag nicht – die Warnung bliebe stehen');
  else ok('Export setzt den Merker');
  if (typeof tzPdfErstellen === 'function' && !/fmFokusAn/.test(tzPdfErstellen.toString()))
    fail('Nach dem Export wird der Fokus nicht gestartet');
  else ok('Export führt in den Fokus');

  // ── Projektplanung blendet aus ─────────────────────────────────────────
  if (typeof fmAnsicht === 'function' && !/fm-planung/.test(fmAnsicht.toString()))
    fail('Projektplanung blendet Dashboard und Tageszettel nicht mehr aus');
  else ok('Projektplanung blendet die Fokus-Ansichten aus');

  // ── Laufender Zustand ───────────────────────────────────────────────────
  if (typeof FM !== 'undefined') {
    if (['fokus','normal','planung','notfall'].indexOf(FM.modus) < 0)
      fail('Unbekannter Modus: ' + FM.modus);
    else ok('Aktueller Modus: ' + FM.modus);
    if (FM.inaktivMin !== 5 && FM.inaktivMin !== 10)
      fail('Inaktivitätsdauer ist weder 5 noch 10 Minuten');
    else ok('Inaktivität nach ' + FM.inaktivMin + ' Minuten');
    if (!fmZettelHeuteExportiert())
      warn('Heute noch kein Tageszettel exportiert – Warnung ist aktiv');
    else ok('Tageszettel heute bereits exportiert');
  }

})();

// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: GEWOHNHEITEN, CHALLENGE UND DAILY LOG   (neu in v1.5.250)
//  Einfügen in AA_tests.js nach der Kategorie FOKUS-MODUS,
//  weiterhin VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • Auslassen reduziert wieder das Ziel – die Quote wird beschönigend
//   • Nicht vorgesehene Wochentage zählen mit
//   • Mehrere Challenges laufen gleichzeitig
//   • Daily Log fällt unter vier Seiten oder verliert den Seitenindikator
//   • Kontrollzeile steht nicht mehr direkt unter dem Motto
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== GEWOHNHEITEN UND CHALLENGE ===');

(function testHabits() {

  const noetig = ['hbInit','hbMontag','hbWocheTage','hbWert','hbSetzen','hbVorgesehen','hbSoll',
                  'hbZielText','hbWoche','hbSchnitt','hbKlick','renderHabits','habitModal',
                  'habitSpeichern','habitLoeschen','challengeAktiv','challengeModal',
                  'challengeSpeichern','challengeUeberschneidung','hbPdfExport','hbErstellePDF'];
  const fehlt = noetig.filter(f => typeof window[f] !== 'function');
  if (fehlt.length) { fail('Nicht definiert: ' + fehlt.join(', ')); return; }
  ok('Alle ' + noetig.length + ' Funktionen definiert');

  ['screen-habits','hb-tab','hb-challenge','hb-mahnung','hb-kw-titel','hb-export',
   'modal-habit','modal-challenge','nav-habits','hb-m-beschr'].forEach(id => {
    if (!document.getElementById(id)) fail('Element ' + id + ' fehlt');
  });
  ok('Screen, Modals und Nav-Eintrag vorhanden');

  // Ohne Einstieg ins Modal liesse sich keine Gewohnheit ändern
  if (typeof renderHabits === 'function' && !/habitModal\('\$\{hb\.id\}'\)/.test(renderHabits.toString()))
    fail('Kein Weg zum Bearbeiten – habitModal wird nur ohne ID aufgerufen');
  else ok('Gewohnheiten sind über die Namenszeile bearbeitbar');

  // Beschreibung überall durchgereicht
  if (typeof habitSpeichern === 'function' && !/beschreibung/.test(habitSpeichern.toString()))
    fail('Beschreibung wird nicht gespeichert');
  else ok('Beschreibung wird gespeichert');
  if (typeof habitModal === 'function' && !/hb-m-beschr/.test(habitModal.toString()))
    fail('Beschreibung wird beim Öffnen nicht vorbelegt');
  else ok('Beschreibung wird vorbelegt');
  if (typeof hbErstellePDF === 'function' && !/h\.beschreibung/.test(hbErstellePDF.toString()))
    warn('Beschreibung erscheint nicht mehr im Wochenblatt');
  else ok('Beschreibung steht im Wochenblatt');

  // ── Kompaktes Wochenblatt (v1.5.258) ───────────────────────────────────
  if (typeof hbErstellePDF === 'function') {
    const src = hbErstellePDF.toString();
    const box = src.match(/const BOX = ([^;]+);/);
    if (!box) fail('Kästchengröße im Wochenblatt nicht auffindbar');
    else if (/Math\.min/.test(box[1]))
      fail('Kästchen werden wieder aus der Spaltenbreite berechnet – sie wurden 9 mm groß');
    else if (parseFloat(box[1]) > 5)
      fail('Kästchen sind ' + box[1].trim() + ' mm – gewünscht sind 4 mm');
    else ok('Kästchen ' + box[1].trim() + ' mm');

    // Der Wochentag steht im Kästchen, nicht mehr als Spaltenkopf
    const kopf = src.match(/function hbKopf\(\)[\s\S]*?\n  \}/);
    if (kopf && /HB_TAGE/.test(kopf[0]))
      fail('Der Spaltenkopf mit Wochentagen ist zurück – der Buchstabe gehört ins Kästchen');
    else ok('Kein Spaltenkopf mehr');
    if (!/doc\.text\(HB_TAGE\[i\]\[0\]/.test(src))
      fail('Der Wochentag wird nicht mehr ins Kästchen gezeichnet');
    else ok('Wochentag im Kästchen');
    if (!/BOX \* 3\.1/.test(src))
      warn('Der Wochentag füllt das Kästchen nicht mehr aus');
    else ok('Wochentag füllt das Kästchen');

    // Beschreibung vollständig, groß und dunkel
    if (/splitTextToSize\(h\.beschreibung[^)]*\)\s*\.slice\(0, 1\)/.test(src))
      fail('Die Beschreibung wird wieder nach einer Zeile abgeschnitten');
    else ok('Beschreibung läuft vollständig um');
    const fs = src.match(/const FS_BESCHR = (\d+)/);
    if (!fs) warn('Schriftgröße der Beschreibung nicht mehr als Konstante geführt');
    else if (Number(fs[1]) < 11)
      fail('Beschreibung wieder kleiner als 11 pt');
    else ok('Beschreibung ' + fs[1] + ' pt');
    if (!/const GRAU_TEXT = \[45, 40, 33\]/.test(src))
      warn('Der Grauton wurde verändert');
    else ok('Beschreibung und Tagesbuchstabe fast schwarz');
    if (!/setTextColor\(GRAU_TEXT\[0\], GRAU_TEXT\[1\], GRAU_TEXT\[2\]\)[\s\S]{0,200}HB_TAGE/.test(src)
        && !/HB_TAGE[\s\S]{0,200}GRAU_TEXT/.test(src.split('setFontSize(BOX')[1] || ''))
      warn('Der Tagesbuchstabe nutzt womöglich einen anderen Ton als die Beschreibung');
    else ok('Beide im selben Ton');
    if (!/const LUFT_NAME/.test(src) || !/const LUFT_BOX/.test(src))
      warn('Die Abstände sind nicht mehr als Konstanten geführt');
    else ok('Abstände als Konstanten geführt');

    // Die Quote je Gewohnheit ist entfallen
    if (/r\.ja \+ ' \/ ' \+ r\.soll/.test(src))
      fail('Die Quote je Gewohnheit ist zurück – sie war nicht gewünscht');
    else ok('Keine Quote im Wochenblatt');

    if (!/sn \+ ' \/ ' \+ gesamt/.test(src))
      fail('Seitenzähler x / y im Kopf fehlt');
    else ok('Seitenzähler im Kopf');

    const blockH = src.match(/const blockH = ([^;]+);/);
    if (blockH && /BOX \+ 2\.4/.test(blockH[1]) === false)
      warn('Blockhöhe verändert – Anzahl je Seite neu prüfen');
    else ok('Blockhöhe kompakt');
  }

  const mitBeschr = (DB.habits || []).filter(h => h.beschreibung).length;
  ok(mitBeschr + ' von ' + (DB.habits || []).length + ' Gewohnheiten mit Beschreibung');

  if (typeof DB === 'undefined' || !Array.isArray(DB.habits) || !Array.isArray(DB.challenges))
    fail('DB-Sektionen habits/challenges fehlen oder sind keine Arrays');
  else ok('Eigene DB-Sektionen vorhanden');

  // ── Dreiwertig, ohne Freibrief ──────────────────────────────────────────
  const probe = { ziel:{ typ:'tage', tage:[0,1,2,3,4] }, checks:{} };
  const M = hbMontag(today());
  hbSetzen(probe, M, 'ja');
  hbSetzen(probe, tzPlusTage(M,1), 'nein');
  const r = hbWoche(probe, M);
  if (r.soll !== 5) fail('Das Ziel ändert sich durch Auslassen – Quote wird beschönigend');
  else ok('Auslassen reduziert das Ziel nicht');
  if (r.ja !== 1 || r.nein !== 1) fail('Zählung von ja/nein stimmt nicht');
  else ok('Erledigt und ausgelassen werden getrennt gezählt');
  hbSetzen(probe, tzPlusTage(M,5), 'ja');   // Samstag, nicht vorgesehen
  if (hbWoche(probe, M).ja !== 1) fail('Nicht vorgesehene Tage zählen mit');
  else ok('Nicht vorgesehene Tage bleiben außen vor');

  if (hbWert({checks:{}}, M) !== 'offen') fail('Fehlender Eintrag ist nicht „offen"');
  else ok('Drei Zustände sauber unterschieden');

  // ── Challenge: nur eine gleichzeitig ────────────────────────────────────
  const heute = today();
  const laufend = (DB.challenges || []).filter(c =>
    c.start && c.ende && c.start <= heute && heute <= c.ende);
  if (laufend.length > 1) fail(laufend.length + ' Challenges laufen gleichzeitig');
  else ok(laufend.length ? 'Eine Challenge aktiv' : 'Keine Challenge aktiv');

  const kaputt = (DB.challenges || []).filter(c => !c.start || !c.ende || c.ende < c.start);
  if (kaputt.length) fail(kaputt.length + ' Challenges mit ungültigem Zeitraum');
  else ok('Alle Challenge-Zeiträume gültig');

  if (typeof challengeSpeichern === 'function' &&
      !/challengeUeberschneidung/.test(challengeSpeichern.toString()))
    fail('Überschneidende Challenges werden nicht mehr abgelehnt');
  else ok('Überschneidung wird geprüft');

  // ── Rückwirkendes Abhaken begrenzt ──────────────────────────────────────
  if (typeof hbBearbeitbar === 'function' && !/>= *-1/.test(hbBearbeitbar.toString()))
    warn('Grenze für rückwirkendes Abhaken verändert – erwartet laufende und vorige Woche');
  else ok('Rückwirkend nur laufende und vorige Woche');

  // ── Datenbestand ────────────────────────────────────────────────────────
  let ungueltig = 0;
  (DB.habits || []).forEach(h => {
    Object.values(h.checks || {}).forEach(v => { if (v !== 'ja' && v !== 'nein') ungueltig++; });
    if (!h.ziel || (h.ziel.typ !== 'tage' && h.ziel.typ !== 'proWoche')) ungueltig++;
  });
  if (ungueltig) fail(ungueltig + ' ungültige Werte in den Gewohnheiten');
  else ok((DB.habits || []).length + ' Gewohnheit(en), alle Werte gültig');

  // ── Daily Log ───────────────────────────────────────────────────────────
  if (typeof erstelleTageszettelPDF === 'function') {
    const src = erstelleTageszettelPDF.toString();
    if (!/getNumberOfPages\(\) < 4/.test(src))
      fail('Daily Log erzeugt nicht mehr mindestens vier Seiten');
    else ok('Mindestens vier Seiten');
    if (!/belegteSeiten/.test(src))
      fail('Seitenindikator fehlt');
    else ok('Seitenindikator vorhanden');
    if (!/tzKontrollZeile/.test(src))
      fail('Kontrollzeile „Gewohnheiten eingehalten und gecheckt?" fehlt');
    else ok('Kontrollzeile vorhanden');
    if (!/challengeAktiv/.test(src))
      fail('Challenge-Zähler fehlt im Daily Log');
    else ok('Challenge-Zähler im Kopf');
    if (/tzChallengeKopf[\s\S]{0,600}rect\([\s\S]{0,120}fill/.test(src) && /ch-fill|Fortschritt/.test(src))
      warn('Im Daily Log scheint wieder ein Fortschrittsbalken zu stecken');
    else ok('Kein Fortschrittsbalken im Daily Log');
    if (!/_DailyLog\.pdf/.test(src))
      fail('Dateiname folgt nicht dem Muster TT_MM_JJJJ_DailyLog.pdf');
    else ok('Dateiname korrekt');
  }

  // ── Umbenennung ─────────────────────────────────────────────────────────
  const nav = document.getElementById('nav-tageszettel');
  if (nav && /Tageszettel/.test(nav.textContent))
    fail('Der Menüpunkt heißt noch „Tageszettel" statt „Daily Log"');
  else ok('Umbenennung in der Navigation erfolgt');

})();

// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: NOTIZBUCH-EXPORT   (neu in v1.5.251)
//  Einfügen in AA_tests.js nach der Kategorie GEWOHNHEITEN,
//  weiterhin VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • Kompression wird abgeschaltet – die Datei wächst von 3,6 auf 39 MB
//   • Seitenzahl oder Format weichen vom Daily Log ab
//   • Kein Nachgeben an den Browser – die Oberfläche friert ein
//   • Mehrfachstart erzeugt parallele Läufe
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== NOTIZBUCH-EXPORT ===');

(function testNotizbuch() {

  if (typeof notizbuchExport !== 'function' || typeof nbErstellePDF !== 'function') {
    fail('notizbuchExport() / nbErstellePDF() nicht definiert');
    return;
  }
  ok('Beide Funktionen definiert');

  if (typeof NB_SEITEN === 'undefined' || NB_SEITEN !== 150)
    fail('Seitenzahl ist nicht mehr 150, sondern ' + NB_SEITEN);
  else ok('150 Seiten festgelegt');

  const knopf = document.getElementById('btn-notizbuch');
  if (!knopf) fail('Knopf „Notizbuch" fehlt in der Seitenleiste');
  else if (!/notizbuchExport/.test(knopf.getAttribute('onclick') || ''))
    fail('Knopf ist nicht verdrahtet');
  else ok('Knopf vorhanden und verdrahtet');
  if (knopf && !knopf.querySelector('svg')) fail('Knopf trägt kein SVG-Symbol');
  else ok('SVG-Symbol vorhanden');

  const src = nbErstellePDF.toString();

  // Ohne Kompression wären es rund 39 MB statt 3,6
  if (!/compress:\s*true/.test(src))
    fail('Kompression abgeschaltet – die Datei würde rund zehnmal so groß');
  else ok('Kompression eingeschaltet');

  if (!/MOVE_PDF_W/.test(src) || !/MOVE_PDF_H/.test(src))
    fail('Notizbuch nutzt nicht das Move-Format des Daily Log');
  else ok('Gleiches Format wie der Daily Log');

  if (!/await new Promise/.test(src))
    fail('Kein Nachgeben an den Browser – die Oberfläche friert bei 150 Seiten ein');
  else ok('Erzeugung gibt zwischendurch nach');

  if (!/'Notizen\.pdf'/.test(src))
    fail('Dateiname ist nicht mehr Notizen.pdf');
  else ok('Dateiname Notizen.pdf');

  if (!/doc\.text\('Notizen'/.test(src))
    fail('Kopfzeile „Notizen" fehlt');
  else ok('Kopfzeile links vorhanden');
  if (!/align:\s*'right'/.test(src))
    fail('Seitenzahl steht nicht mehr rechts');
  else ok('Seitenzahl rechts');

  if (typeof notizbuchExport === 'function' && !/nbLaeuft/.test(notizbuchExport.toString()))
    fail('Mehrfachstart wird nicht verhindert');
  else ok('Doppelstart wird abgefangen');

})();


// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: TERMINE UND MONATSREFLEXION   (neu in v1.5.253)
//  Einfügen in AA_tests.js nach der Kategorie NOTIZBUCH-EXPORT,
//  weiterhin VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • Termine werden nicht mehr gemerkt – die Zeitleiste bleibt leer und
//     die Monatsreflexion wird zur Gedächtnisübung
//   • Aufräumen greift nicht, die JSON-Datei wächst unbemerkt
//   • Tagesreflexion rutscht von Seite 4 weg oder erscheint mehrfach
//   • REF-Kachel wird wieder als belegte Seite eingefärbt
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== TERMINE UND MONATSREFLEXION ===');

(function testMonatsreflexion() {

  const noetig = ['terminMerken','terminAufraeumen','termineAmTag','mrErstellePDF',
                  'monatsblattExport','mrMonatExportiert','mrMahnungAktiv','mrMahnungZeichnen'];
  const fehlt = noetig.filter(f => typeof window[f] !== 'function');
  if (fehlt.length) { fail('Nicht definiert: ' + fehlt.join(', ')); return; }
  ok('Alle ' + noetig.length + ' Funktionen definiert');

  if (typeof DB === 'undefined' || !Array.isArray(DB.termine))
    fail('DB-Sektion termine fehlt');
  else ok('Termine-Sektion vorhanden (' + DB.termine.length + ' Einträge)');

  if (!document.getElementById('mr-mahnung'))
    fail('Monatsblatt-Mahnung fehlt auf dem Gewohnheiten-Screen');
  else ok('Mahnung vorhanden');

  // Der Export muss jederzeit erreichbar sein, nicht nur über die Mahnung
  const expKnopf = document.getElementById('mr-export');
  if (!expKnopf)
    fail('Fester Export-Knopf für das Monatsblatt fehlt – ohne ihn kommt man vor dem 25. nicht an den Export');
  else if (!/mrExportKlick/.test(expKnopf.getAttribute('onclick') || ''))
    fail('Export-Knopf ist nicht verdrahtet');
  else ok('Export jederzeit erreichbar');

  ['mr-sub','mr-lage','mr-btn-vor','mr-export-txt','mr-fuss'].forEach(id => {
    if (!document.getElementById(id)) fail('Element ' + id + ' fehlt');
  });
  ok('Monatsnavigation vollständig');

  if (typeof mrGewaehlt === 'function' && typeof mrMonatWechsel === 'function') {
    const merk = (typeof mrMonatsOffset !== 'undefined') ? mrMonatsOffset : 0;
    try {
      const jetzt = new Date();
      mrMonatWechsel(1);
      if (mrGewaehlt().monat !== jetzt.getMonth())
        fail('Der Monatswechsel läuft in die Zukunft – ein Rückblick auf kommende Monate ergibt keinen Sinn');
      else ok('Kein Rückblick auf künftige Monate');
      mrMonatWechsel(-13);
      const soll = new Date(jetzt.getFullYear(), jetzt.getMonth() - 13, 1);
      const g = mrGewaehlt();
      if (g.jahr !== soll.getFullYear() || g.monat !== soll.getMonth())
        fail('Monatsrechnung über die Jahresgrenze falsch');
      else ok('Monatsrechnung über Jahresgrenzen korrekt');
    } finally {
      if (typeof mrMonatsOffset !== 'undefined') mrMonatsOffset = merk;
      if (typeof mrKarteZeichnen === 'function') mrKarteZeichnen();
    }
  }

  // ── Termine werden beim Anlegen gemerkt ────────────────────────────────
  if (typeof tzAddTermin === 'function' && !/terminMerken/.test(tzAddTermin.toString()))
    fail('Termine aus dem Daily Log werden nicht mehr gemerkt');
  else ok('Termine werden beim Anlegen gespeichert');

  // ── Datenbestand ────────────────────────────────────────────────────────
  const kaputt = (DB.termine || []).filter(t =>
    !t.datum || !/^\d{4}-\d{2}-\d{2}$/.test(t.datum) || !t.titel);
  if (kaputt.length) fail(kaputt.length + ' Termine ohne gültiges Datum oder Titel');
  else ok('Alle Termine vollständig');

  const grenze = tzPlusTage(today(), -365);
  const alt = (DB.termine || []).filter(t => t.datum && t.datum < grenze);
  if (alt.length) warn(alt.length + ' Termine älter als ein Jahr – Aufräumen greift nicht');
  else ok('Keine veralteten Termine');

  if (typeof terminAufraeumen === 'function' && !/MR_MAX_ALT|365/.test(terminAufraeumen.toString()))
    warn('Aufräumgrenze verändert');
  else ok('Aufräumen nach einem Jahr');

  // ── Sortierung: ganztägig zuerst ───────────────────────────────────────
  if (typeof termineAmTag === 'function') {
    const heute = today();
    const liste = termineAmTag(heute);
    const ganz = liste.filter(t => t.ganztag).length;
    if (ganz && !liste[0].ganztag)
      fail('Ganztagestermine stehen nicht mehr zuerst');
    else ok(liste.length + ' Termine heute, Sortierung korrekt');
  }

  // ── Monatsblatt ─────────────────────────────────────────────────────────
  if (typeof mrErstellePDF === 'function') {
    const src = mrErstellePDF.toString();
    if (!/compress:\s*true/.test(src)) fail('Kompression im Monatsblatt abgeschaltet');
    else ok('Kompression eingeschaltet');
    if (!/termineAmTag/.test(src))
      fail('Zeitleiste druckt die Termine nicht mehr vor');
    else ok('Termine werden in die Zeitleiste gedruckt');
    if (!/new Date\(jahr, monat \+ 1, 0\)\.getDate\(\)/.test(src))
      fail('Monatslänge kommt nicht mehr aus dem Kalender');
    else ok('Monatslängen korrekt');
    if (!/Reflexion_/.test(src)) fail('Dateiname folgt nicht dem Muster Reflexion_JJJJ_MM.pdf');
    else ok('Dateiname korrekt');
    if (!/Termine, davon/.test(src)) warn('Zusammenfassung am Seitenende entfällt');
    else ok('Zusammenfassung vorhanden');
  }

  // ── Tagesreflexion auf Seite 4 ─────────────────────────────────────────
  if (typeof erstelleTageszettelPDF === 'function') {
    const src = erstelleTageszettelPDF.toString();
    if (!/tzReflexionsSeite/.test(src))
      fail('Tagesreflexion fehlt im Daily Log');
    else ok('Tagesreflexion vorhanden');
    if (!/doc\.setPage\(4\)/.test(src))
      fail('Tagesreflexion sitzt nicht mehr fest auf Seite 4');
    else ok('Tagesreflexion fest auf Seite 4');
    if (!/'REF'/.test(src))
      fail('REF-Kennzeichnung im Seitenindikator fehlt');
    else ok('Seite 4 als REF gekennzeichnet');
    if (!/istRef \? bx \* 1\.6 : bx/.test(src.replace(/\s+/g, ' ')))
      warn('REF-Kachel ist nicht mehr breiter als die übrigen');
    else ok('REF-Kachel abgesetzt');
    if (/!istRef && belegteSeiten/.test(src)) ok('REF wird nie als belegt eingefärbt');
    else fail('REF-Kachel wird wieder wie eine normale Seite eingefärbt');
  }

  // ── Register im Notizbuch ──────────────────────────────────────────────
  if (typeof NB_INDEX === 'undefined' || NB_INDEX !== 4)
    fail('Registerseiten im Notizbuch fehlen oder sind nicht mehr vier');
  else ok('Vier Registerseiten im Notizbuch');
  if (typeof nbErstellePDF === 'function' && !/indexSeite/.test(nbErstellePDF.toString()))
    fail('Notizbuch erzeugt kein Register mehr');
  else ok('Register wird erzeugt');

  // ── BuJo ist entfernt ──────────────────────────────────────────────────
  if (typeof bujoExport === 'function' || document.getElementById('btn-bujo'))
    warn('Der BuJo-Export ist wieder vorhanden – bewusst entfernt in v1.5.253');
  else ok('BuJo-Export entfernt');

})();

// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: AUFGABENZEILE UND BANNERTEXT   (neu in v1.5.255)
//  Einfügen in AA_tests.js nach der Kategorie TERMINE UND MONATSREFLEXION,
//  weiterhin VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • Pillen rutschen bei langen Titeln wieder unter den Titel
//   • Zeile bricht um und wird doppelt hoch
//   • Bannertext verliert den Hinweis auf die Übertragung
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== AUFGABENZEILE UND BANNER ===');

(function testAufgabenzeile() {

  // ── Pillen stehen immer rechts ──────────────────────────────────────────
  if (typeof aufgabeRowHTML === 'function' || typeof renderAufgaben === 'function') {
    const skripte = Array.from(document.querySelectorAll('script'))
      .map(x => x.textContent || '').join('\n');
    if (/titel\.length\s*[<>]=?\s*35/.test(skripte))
      fail('Die 35-Zeichen-Grenze ist zurück – Pillen rutschen bei langen Titeln nach unten');
    else ok('Keine Längengrenze mehr in der Aufgabenzeile');
    if (/class="task-meta"/.test(skripte))
      fail('task-meta wird wieder verwendet – das war der Umbruch-Container');
    else ok('Kein Umbruch-Container mehr');
  }

  // ── Live am gerenderten DOM ─────────────────────────────────────────────
  const zeilen = document.querySelectorAll('.task-row');
  if (!zeilen.length) {
    warn('Keine Aufgabenzeilen sichtbar – Layout nicht prüfbar');
  } else {
    let umgebrochen = 0, tagsFalsch = 0;
    zeilen.forEach(z => {
      const tags = z.querySelector(':scope > .task-tags');
      if (!tags) return;
      const zr = z.getBoundingClientRect(), tr = tags.getBoundingClientRect();
      // Pillen müssen vertikal in der Zeile liegen, nicht darunter
      if (tr.top > zr.top + zr.height * 0.7) umgebrochen++;
      // und rechtsbündig sitzen
      if (zr.right - tr.right > 60) tagsFalsch++;
    });
    if (umgebrochen) fail(umgebrochen + ' Zeilen mit umgebrochenen Pillen');
    else ok('Pillen bleiben in ' + zeilen.length + ' Zeilen oben');
    if (tagsFalsch) warn(tagsFalsch + ' Zeilen mit Pillen weit links vom Rand');
    else ok('Pillen rechtsbündig');
  }

  // ── CSS-Regeln ──────────────────────────────────────────────────────────
  const probe = document.querySelector('.task-row > .task-tags');
  if (probe) {
    const st = getComputedStyle(probe);
    if (st.flexWrap === 'wrap') fail('Pillenreihe darf wieder umbrechen');
    else ok('Pillenreihe bricht nicht um');
    if (st.marginLeft !== 'auto' && parseFloat(st.marginLeft) < 1)
      warn('Pillen sind nicht mehr rechtsbündig ausgerichtet');
    else ok('Rechtsbündig ausgerichtet');
  }

  // ── Bannertext ──────────────────────────────────────────────────────────
  const SOLL = 'Heute noch kein Daily Log exportiert und die Planung von gestern übertragen';
  if (typeof fmWarnbannerZeichnen === 'function' &&
      !fmWarnbannerZeichnen.toString().includes(SOLL))
    fail('Bannertext stimmt nicht mehr – der Hinweis auf die Übertragung fehlt');
  else ok('Bannertext vollständig');
  if (typeof fmSchirmFuellen === 'function' &&
      !fmSchirmFuellen.toString().includes(SOLL))
    fail('Text auf dem Fokus-Schirm stimmt nicht mehr');
  else ok('Fokus-Schirm zeigt denselben Text');

})();

// ═══════════════════════════════════════════════════════════════════════════
//  KATEGORIE: ZUSTANDSSPEICHERUNG UND SERVICE WORKER   (neu in v1.5.257)
//  Einfügen in AA_tests.js nach der Kategorie AUFGABENZEILE UND BANNER,
//  weiterhin VOR dem ERGEBNIS-Block.
//
//  Fehlerart, die diese Kategorie abdeckt:
//   • Inhalte liegen wieder nur im localStorage – sie fehlen dann im Backup
//     und gehen bei Wechsel der Herkunft oder der Browserdaten verloren
//   • Der Service Worker liefert aus dem Cache zuerst und blockiert Updates
//   • Ein Zweig des Fetch-Handlers liefert keine echte Response
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n=== ZUSTAND UND SERVICE WORKER ===');

(function testZustand() {

  if (typeof zustandSchreiben !== 'function' || typeof zustandLesen !== 'function') {
    fail('zustandSchreiben() / zustandLesen() fehlen – Inhalte liegen wieder nur im Browser');
    return;
  }
  ok('Zentrale Zustandsspeicherung vorhanden');

  if (typeof DB === 'undefined' || !DB) { warn('Keine Datei verbunden – Prüfung eingeschränkt'); return; }

  if (typeof DB.exporte !== 'object' || DB.exporte === null)
    fail('DB.exporte fehlt – die Export-Merker landen nicht in der Datei');
  else ok('DB.exporte vorhanden');
  if (!('tageszettel' in DB))
    fail('DB.tageszettel fehlt – die Tagesplanung landet nicht in der Datei');
  else ok('DB.tageszettel vorhanden');

  // ── Die drei Merker schreiben in die Datei ─────────────────────────────
  [['fmExportGemerkt','dailyLog'], ['hbExportGemerkt','habits'],
   ['mrExportGemerkt','monatsblatt']].forEach(([fn, feld]) => {
    if (typeof window[fn] !== 'function') return;
    const src = window[fn].toString();
    if (!/zustandSchreiben/.test(src))
      fail(fn + '() schreibt nicht über zustandSchreiben – der Merker fehlt in der Datei');
    else if (!new RegExp("'" + feld + "'").test(src))
      warn(fn + '() nutzt ein anderes Feld als ' + feld);
  });
  ok('Alle drei Export-Merker gehen in die Datei');

  if (typeof tzSpeichern === 'function') {
    const src = tzSpeichern.toString();
    if (!/zustandSchreiben/.test(src))
      fail('Die Tagesplanung wird nicht in die Datei geschrieben');
    else if (!/saveDB/.test(src))
      fail('tzSpeichern ruft saveDB nicht – die Planung bliebe im Arbeitsspeicher');
    else ok('Tagesplanung wird in der Datei gesichert');
  }

  // ── Die Datei hat Vorrang vor dem Browser ──────────────────────────────
  if (typeof zustandLesen === 'function') {
    const merk = DB.exporte._probe;
    try {
      DB.exporte._probe = 'aus-der-datei';
      localStorage.setItem('_wa_probe', 'aus-dem-browser');
      if (zustandLesen('_probe', '_wa_probe') !== 'aus-der-datei')
        fail('Der Browser überstimmt die Datei – bei Widerspruch muss die Datei gewinnen');
      else ok('Datei hat Vorrang vor dem Browser');
      delete DB.exporte._probe;
      if (zustandLesen('_probe', '_wa_probe') !== 'aus-dem-browser')
        fail('Ohne Eintrag in der Datei greift die Rückfallebene nicht');
      else ok('Rückfall auf den Browser funktioniert');
    } finally {
      if (merk === undefined) delete DB.exporte._probe; else DB.exporte._probe = merk;
      try { localStorage.removeItem('_wa_probe'); } catch (e) {}
    }
  }

  // ── Bestand prüfen ──────────────────────────────────────────────────────
  const heute = today();
  const dl = (DB.exporte || {}).dailyLog;
  if (dl === heute) ok('Daily Log heute exportiert');
  else if (dl) warn('Letzter Daily-Log-Export: ' + dl);
  else warn('Noch kein Daily-Log-Export in der Datei vermerkt');

  if (DB.tageszettel && DB.tageszettel.datum && DB.tageszettel.datum !== heute)
    warn('Gespeicherte Planung stammt vom ' + DB.tageszettel.datum);
  else if (DB.tageszettel)
    ok('Planung von heute in der Datei (' + ((DB.tageszettel.zettel || []).length) + ' Einträge)');

  // ── Service Worker ──────────────────────────────────────────────────────
  if (!('serviceWorker' in navigator)) {
    warn('Kein Service Worker in diesem Browser');
  } else {
    navigator.serviceWorker.getRegistrations().then(regs => {
      if (!regs.length) warn('Kein Service Worker registriert – Offline-Betrieb nicht möglich');
      else if (regs.length > 1)
        fail(regs.length + ' Service Worker registriert – alte Registrierung entfernen');
      else console.log('  ok   Genau ein Service Worker: ' + regs[0].scope);
      const blob = regs.filter(r => (r.scope || '').startsWith('blob:'));
      if (blob.length) fail('Ein Blob-Service-Worker ist registriert – der kann keinen Scope beanspruchen');
    }).catch(() => {});
  }

  const skripte = Array.from(document.querySelectorAll('script')).map(x => x.textContent || '').join('\n');
  if (/register\(URL\.createObjectURL/.test(skripte))
    fail('Der Blob-Fallback für den Service Worker ist zurück – er kann nicht funktionieren');
  else ok('Kein Blob-Service-Worker mehr');
  if (/start_url:\s*'\.\/'/.test(skripte))
    fail('start_url ist wieder relativ – im Blob-Manifest wird es verworfen');
  else ok('start_url ist absolut');

})();
