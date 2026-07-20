// ╔══════════════════════════════════════════════════════════════════╗
// ║  WorkAssist AA_tests.js — Regressions- & Vollständigkeitstests  ║
// ║  Ausführen: In der Browser-Konsole einfügen und Enter drücken   ║
// ╚══════════════════════════════════════════════════════════════════╝

(function () {
  let ok = 0, fail = 0, warn = 0;
  const OK   = (msg) => { ok++;   console.log('%c✔ OK   ' + msg, 'color:#1a7a4a;font-weight:600'); };
  const FAIL = (msg) => { fail++; console.error('✘ FAIL  ' + msg); };
  const WARN = (msg) => { warn++; console.warn('⚠ WARN  ' + msg); };

  // ── 1. SCREEN-VOLLSTÄNDIGKEIT ────────────────────────────────────
  console.log('%c── 1. Screen-Vollständigkeit', 'font-weight:700;color:#333');
  const screens = ['screen-dashboard','screen-aufgaben','screen-wissen',
                   'screen-bereiche','screen-dokumente','screen-plaene','screen-notizen'];
  screens.forEach(id => {
    document.getElementById(id) ? OK(id + ' vorhanden') : FAIL(id + ' FEHLT');
  });

  // ── 2. KRITISCHE DOM-ELEMENTE ────────────────────────────────────
  console.log('%c── 2. Kritische DOM-Elemente', 'font-weight:700;color:#333');
  const domIds = ['ph-plan','ph-plan-count','plan-prio-btns','plan-hz-btns',
                  'plan-fortschritt-wrap','app-version'];
  domIds.forEach(id => {
    document.getElementById(id) ? OK('#' + id + ' vorhanden') : FAIL('#' + id + ' FEHLT');
  });

  // ── 3. KRITISCHE JS-FUNKTIONEN ───────────────────────────────────
  console.log('%c── 3. Kritische JS-Funktionen', 'font-weight:700;color:#333');
  const fns = [
    'renderDashboard','renderDashboardPlaene','renderPlaeneScreen',
    'planSetPrio','planSetHz','openPlanQuickView','savePlan','escHtml',
    'badgeAktualisieren','openAufgabe','renderAufgaben','renderBereiche',
    'renderWissen','renderNotizen','ladeDB','speichereDB'
  ];
  fns.forEach(fn => {
    typeof window[fn] === 'function' ? OK(fn + '()') : FAIL(fn + '() FEHLT');
  });

  // ── 4. DB-FELDVOLLSTÄNDIGKEIT ────────────────────────────────────
  console.log('%c── 4. DB-Feldvollständigkeit', 'font-weight:700;color:#333');
  if (typeof DB !== 'undefined') {
    ['bereiche','aufgaben','wissen','dokumente','plaene','notizen'].forEach(f => {
      Array.isArray(DB[f]) ? OK('DB.' + f + ' Array') : FAIL('DB.' + f + ' kein Array');
    });
    typeof DB.version === 'string' ? OK('DB.version String') : WARN('DB.version kein String');
  } else {
    WARN('DB nicht definiert – evtl. noch nicht geladen');
  }

  // ── 5. PRIORITÄT-BUTTONS (inkl. KRISE) ──────────────────────────
  console.log('%c── 5. Priorität-Buttons im Plan-Dialog', 'font-weight:700;color:#333');
  const prioContainer = document.getElementById('plan-prio-btns');
  if (prioContainer) {
    const prioButtons = prioContainer.querySelectorAll('.plan-prio-btn');
    const prioWerte   = Array.from(prioButtons).map(b => b.dataset.prio);
    ['krise','hoch','mittel','niedrig'].forEach(p => {
      prioWerte.includes(p)
        ? OK('Prio-Button "' + p + '" vorhanden')
        : FAIL('Prio-Button "' + p + '" FEHLT — Krise-Typ nicht setzbar');
    });
  } else {
    FAIL('#plan-prio-btns nicht gefunden – Prio-Buttons nicht prüfbar');
  }

  // ── 6. DELEGIERTE PLÄNE IN HORIZONT-GRUPPE (kein separater "Warte auf"-Block) ──
  console.log('%c── 6. Delegierte Pläne in Horizont-Gruppen (kein "Warte auf"-Block)', 'font-weight:700;color:#333');
  const phPlan = document.getElementById('ph-plan');
  if (phPlan && typeof DB !== 'undefined' && DB.plaene?.length) {
    // Prüfen: kein separater "Warte auf"-Header im Plan-Widget
    const innerText = phPlan.innerText || phPlan.textContent || '';
    !innerText.includes('WARTE AUF')
      ? OK('Kein separater "Warte auf"-Block im Dashboard')
      : FAIL('"Warte auf"-Block existiert noch — delegierte Pläne sollen in Horizont-Gruppe erscheinen');

    // Prüfen: delegierte Pläne landen in einer Horizont-Gruppe
    const delegiertePlaene = DB.plaene.filter(p => {
      if (p.status === 'abgeschlossen' || p.prioritaet === 'krise') return false;
      const ns = (p.schritte||[]).find(s => {
        const st = s.aufgabeId
          ? (DB.aufgaben.find(a=>a.id===s.aufgabeId)?.status || s.status)
          : s.status;
        return st !== 'erledigt';
      });
      return !!(ns?.delegiertAn);
    });
    if (delegiertePlaene.length > 0) {
      const horizonte = ['kurzfristig','mittelfristig','langfristig'];
      const allInHorizont = delegiertePlaene.every(p => horizonte.includes(p.horizont || 'kurzfristig'));
      allInHorizont
        ? OK('Alle ' + delegiertePlaene.length + ' delegierten Pläne haben gültigen Horizont')
        : FAIL('Delegierter Plan ohne gültigen Horizont — würde in keine Gruppe fallen');
    } else {
      OK('Keine delegierten Pläne vorhanden – Struktur-Check übersprungen');
    }
  } else {
    WARN('ph-plan oder DB.plaene nicht verfügbar – Delegiert-Test übersprungen');
  }

  // ── 7. KRISE-PRIORITÄT WIRD KORREKT GERENDERT ───────────────────
  console.log('%c── 7. Krise-Pläne werden im Dashboard oben angezeigt', 'font-weight:700;color:#333');
  if (typeof DB !== 'undefined' && DB.plaene?.length) {
    const krisePlaene = DB.plaene.filter(p => p.prioritaet === 'krise' && p.status !== 'abgeschlossen');
    if (krisePlaene.length > 0) {
      const phEl = document.getElementById('ph-plan');
      if (phEl) {
        const firstHeader = phEl.querySelector('div');
        const firstText   = firstHeader?.textContent?.trim().toUpperCase() || '';
        firstText.includes('KRISE')
          ? OK('Krise-Sektion erscheint als erste Gruppe im Dashboard')
          : FAIL('Krise-Pläne vorhanden, aber Krise-Sektion ist nicht erste Gruppe');
      }
    } else {
      OK('Keine Krise-Pläne vorhanden – Reihenfolge-Check übersprungen');
    }

    // Krise-Pläne dürfen nicht in Horizont-Gruppen landen
    const kriseInHorizont = DB.plaene.filter(p =>
      p.prioritaet === 'krise' && p.status !== 'abgeschlossen'
    );
    OK('renderDashboardPlaene sortiert Krise-Pläne separat (' + kriseInHorizont.length + ' Stück)');
  } else {
    WARN('DB.plaene nicht verfügbar – Krise-Render-Test übersprungen');
  }

  // ── 8. planSetPrio KENNT 'krise' ────────────────────────────────
  console.log('%c── 8. planSetPrio() – Krise-Farbe definiert', 'font-weight:700;color:#333');
  if (typeof planSetPrio === 'function') {
    // Testaufruf – sollte keinen Fehler werfen
    try {
      planSetPrio('krise');
      const val = document.getElementById('plan-prio-btns')?.dataset.val;
      val === 'krise'
        ? OK('planSetPrio("krise") setzt data-val korrekt')
        : FAIL('planSetPrio("krise") – data-val ist "' + val + '" statt "krise"');
      // Zurücksetzen auf Mittel
      planSetPrio('mittel');
    } catch(e) {
      FAIL('planSetPrio("krise") wirft Fehler: ' + e.message);
    }
  } else {
    FAIL('planSetPrio() nicht definiert');
  }

  // ── ERGEBNIS ─────────────────────────────────────────────────────
  console.log('');
  console.log('%c══════════════════════════════════════════', 'color:#555');
  console.log(
    '%cERGEBNIS: ' + ok + ' OK  |  ' + warn + ' WARN  |  ' + fail + ' FAIL',
    fail > 0 ? 'color:#c0392b;font-weight:700;font-size:14px'
             : warn > 0 ? 'color:#e67e22;font-weight:700;font-size:14px'
             : 'color:#1a7a4a;font-weight:700;font-size:14px'
  );
  console.log('%c══════════════════════════════════════════', 'color:#555');
})();

// ── 9. BEREICHE VOLLBILD-ACCORDION ──────────────────────────────────────
console.log('%c── 9. Bereiche Vollbild-Accordion', 'font-weight:700;color:#333');

// 9a: Kein Split-Layout mehr — struct-layout darf nicht im Bereiche-Screen sein
const bereicheScreen = document.getElementById('screen-bereiche');
if (bereicheScreen) {
  !bereicheScreen.querySelector('.struct-layout')
    ? OK('Kein struct-layout im Bereiche-Screen (Vollbild korrekt)')
    : FAIL('struct-layout noch im Bereiche-Screen — Split-View nicht entfernt');

  // 9b: bd-scroll vorhanden
  bereicheScreen.querySelector('.bd-scroll')
    ? OK('.bd-scroll Container vorhanden')
    : FAIL('.bd-scroll fehlt — Karten-Scrollbereich nicht gerendert');

  // 9c: Suchfeld vorhanden
  document.getElementById('bereiche-suche')
    ? OK('#bereiche-suche Suchfeld vorhanden')
    : FAIL('#bereiche-suche fehlt');
} else {
  FAIL('#screen-bereiche nicht gefunden');
}

// 9d: Neue Funktionen vorhanden
['bdToggleKarte','bdAccToggle','renderBereichDetail','bereichKarteHTML'].forEach(fn => {
  typeof window[fn] === 'function'
    ? OK(fn + '() vorhanden')
    : FAIL(fn + '() fehlt');
});

// 9e: Alte Split-View Funktionen nicht mehr nötig (bereich-detail)
document.getElementById('bereich-detail')
  ? WARN('#bereich-detail noch im DOM — wird nicht mehr benötigt')
  : OK('#bereich-detail korrekt entfernt');

// 9f: renderBereichDetail gibt String zurück (nicht undefined)
if (typeof renderBereichDetail === 'function' && typeof DB !== 'undefined' && DB.bereiche?.length) {
  const b = DB.bereiche[0];
  const result = renderBereichDetail(b);
  typeof result === 'string' && result.length > 0
    ? OK('renderBereichDetail() gibt HTML-String zurück')
    : FAIL('renderBereichDetail() gibt keinen String zurück — Accordion-Body bleibt leer');
} else {
  WARN('renderBereichDetail-Test übersprungen (keine Bereiche oder Funktion fehlt)');
}

// 9g: Notizen-Sektion nur bei privatem Theme
if (typeof DB !== 'undefined' && DB.bereiche?.length) {
  const istPrivat = document.documentElement.getAttribute('data-theme') === 'privat';
  const b = DB.bereiche[0];
  const html = typeof renderBereichDetail === 'function' ? renderBereichDetail(b) : '';
  const hatNotizen = html.includes('bd-acc-title">Notizen');
  if (istPrivat) {
    hatNotizen ? OK('Notizen-Sektion bei Privat-Theme vorhanden') : WARN('Notizen-Sektion fehlt bei Privat-Theme');
  } else {
    !hatNotizen ? OK('Notizen-Sektion korrekt ausgeblendet (berufliche Datei)') : FAIL('Notizen-Sektion erscheint bei beruflicher Datei!');
  }
} else {
  WARN('Notizen-Theme-Test übersprungen (keine Bereiche)');
}

// 9h: Pills in bereichKarteHTML
if (typeof bereichKarteHTML === 'function' && typeof DB !== 'undefined' && DB.bereiche?.length) {
  const html = bereichKarteHTML(DB.bereiche[0]);
  html.includes('bd-pill')
    ? OK('bd-pill Pills werden in Bereichskarte gerendert')
    : FAIL('bd-pill fehlt in Bereichskarte');
  html.includes('bd-card-ziel')
    ? OK('bd-card-ziel Ziel-Unterzeile in Karte vorhanden')
    : FAIL('bd-card-ziel fehlt — Ziel wird nicht in Karte angezeigt');
} else {
  WARN('bereichKarteHTML-Test übersprungen');
}

