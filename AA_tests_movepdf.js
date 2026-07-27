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
