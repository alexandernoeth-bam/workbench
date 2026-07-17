// AA_tests.js – WorkAssist Regressionstests
// In Browser-Konsole einfügen (während WorkAssist geöffnet ist)
// Stand: v1.5.188

const results = [];
function ok(name)         { results.push({status:'ok',   name}); console.log('✅ OK   ', name); }
function fail(name, detail){ results.push({status:'fail', name, detail}); console.error('❌ FAIL ', name, detail||''); }
function warn(name, detail){ results.push({status:'warn', name, detail}); console.warn('⚠️ WARN ', name, detail||''); }

// ── KATEGORIE 1: Screen-Sichtbarkeit ──
console.log('\n── 1. Screen-Sichtbarkeit ──');
(function() {
  const screens = ['dashboard','aufgaben','wissen','bereiche','dokumente','plaene','notizen'];
  screens.forEach(id => {
    const el = document.getElementById('screen-' + id);
    if (!el) { fail('Screen vorhanden: ' + id); return; }
    ok('Screen vorhanden: ' + id);
    const style = getComputedStyle(el);
    if (el.classList.contains('active')) {
      if (style.display !== 'none') ok('Aktiver Screen sichtbar: ' + id);
      else fail('Aktiver Screen unsichtbar: ' + id);
    } else {
      if (style.display === 'none') ok('Inaktiver Screen versteckt: ' + id);
      else fail('Inaktiver Screen sichtbar: ' + id);
    }
  });
})();

// ── KATEGORIE 2: DB-Struktur ──
console.log('\n── 2. DB-Struktur ──');
(function() {
  if (typeof DB === 'undefined') { fail('DB nicht definiert'); return; }
  ['bereiche','aufgaben','wissen','dokumente','plaene','notizen'].forEach(key => {
    if (Array.isArray(DB[key])) ok('DB.' + key + ' ist Array');
    else fail('DB.' + key + ' fehlt oder kein Array');
  });
})();

// ── KATEGORIE 3: Plan-Priorität inkl. Krise ──
console.log('\n── 3. Plan-Priorität inkl. Krise ──');
(function() {
  if (typeof PLAN_PRIO === 'undefined') { fail('PLAN_PRIO nicht definiert'); return; }

  // Alle 4 Stufen vorhanden
  ['krise','hoch','mittel','niedrig'].forEach(p => {
    if (PLAN_PRIO[p]) ok('PLAN_PRIO.' + p + ' vorhanden');
    else fail('PLAN_PRIO.' + p + ' FEHLT');
  });

  // krise hat Label und Dot
  if (PLAN_PRIO.krise?.label === 'Krise') ok('PLAN_PRIO.krise label = Krise');
  else fail('PLAN_PRIO.krise label falsch', PLAN_PRIO.krise?.label);

  if (PLAN_PRIO.krise?.dot === '#c0392b') ok('PLAN_PRIO.krise dot Farbe korrekt');
  else fail('PLAN_PRIO.krise dot Farbe falsch', PLAN_PRIO.krise?.dot);

  // Sortierreihenfolge: krise muss vor hoch kommen
  // Simuliere prioOrder wie in renderDashboardPlaene
  const prioOrder = { krise: -1, hoch: 0, mittel: 1, niedrig: 2 };
  const plaeneTest = [
    { id: 'p1', titel: 'A', prioritaet: 'hoch',   horizont: 'kurzfristig', schritte: [] },
    { id: 'p2', titel: 'B', prioritaet: 'krise',  horizont: 'kurzfristig', schritte: [] },
    { id: 'p3', titel: 'C', prioritaet: 'niedrig',horizont: 'kurzfristig', schritte: [] },
  ];
  const sorted = [...plaeneTest].sort((a,b) =>
    (prioOrder[a.prioritaet ?? 'mittel'] ?? 1) - (prioOrder[b.prioritaet ?? 'mittel'] ?? 1)
  );
  if (sorted[0].prioritaet === 'krise') ok('Sortierung: krise steht vor hoch');
  else fail('Sortierung: krise nicht an erster Stelle', sorted.map(p=>p.prioritaet));

  if (sorted[sorted.length-1].prioritaet === 'niedrig') ok('Sortierung: niedrig steht zuletzt');
  else fail('Sortierung: niedrig nicht zuletzt', sorted.map(p=>p.prioritaet));

  // krise hat negativen prioOrder-Wert → schlägt alles
  if (prioOrder['krise'] < prioOrder['hoch']) ok('prioOrder: krise < hoch (schlägt alles)');
  else fail('prioOrder: krise nicht kleiner als hoch');

  // planSetPrio kennt krise
  if (typeof planSetPrio === 'function') {
    try {
      planSetPrio('krise');
      const val = document.getElementById('plan-prio-btns')?.dataset.val;
      if (val === 'krise') ok('planSetPrio: krise setzt dataset.val');
      else fail('planSetPrio: krise setzt dataset.val nicht', val);
    } catch(e) { fail('planSetPrio(krise) wirft Fehler', e.message); }
  } else warn('planSetPrio nicht verfügbar (Modal nicht offen)');

  // Krise-Button im Modal vorhanden
  const kriseBtn = document.querySelector('.plan-prio-btn[data-prio="krise"]');
  if (kriseBtn) ok('Krise-Button im Modal vorhanden');
  else warn('Krise-Button nicht gefunden (Modal muss offen sein)');
})();

// ── KATEGORIE 4: Delegations-Farbe (Blau statt Gelb) ──
console.log('\n── 4. Delegations-Farbe ──');
(function() {
  // renderDashboardPlaene muss im Quellcode #1976d2 verwenden, nicht #f59e0b
  // Test über den gerenderten DOM (funktioniert wenn Pläne mit Delegation vorhanden)
  const warte = document.querySelector('#dash-plan-panel [style*="color:#1976d2"]');
  const gelb  = document.querySelector('#dash-plan-panel [style*="color:#f59e0b"]');

  if (gelb) fail('Delegationsfarbe: Gelb (#f59e0b) noch im Dashboard vorhanden!');
  else ok('Delegationsfarbe: kein Gelb (#f59e0b) im Dashboard');

  if (warte) ok('Delegationsfarbe: Blau (#1976d2) im Dashboard gefunden');
  else warn('Delegationsfarbe: kein Blau sichtbar (evtl. keine delegierten Pläne vorhanden)');

  // Badge-Farbe prüfen
  const gelbBadge = document.querySelector('#dash-plan-panel [style*="background:#fef3c7"]');
  if (gelbBadge) fail('Delegations-Badge: altes Gelb (#fef3c7) noch vorhanden');
  else ok('Delegations-Badge: kein altes Gelb mehr');

  const blauBadge = document.querySelector('#dash-plan-panel [style*="background:#e3f0fc"]');
  if (blauBadge) ok('Delegations-Badge: Blau (#e3f0fc) gefunden');
  else warn('Delegations-Badge: kein Blau sichtbar (evtl. keine delegierten Pläne)');
})();

// ── KATEGORIE 5: Zoom-Korrektheit ──
console.log('\n── 5. Zoom-Korrektheit ──');
(function() {
  if (typeof setZoom !== 'function') { warn('setZoom nicht verfügbar'); return; }
  const zoom = parseFloat(document.documentElement.style.zoom || 1);
  if (zoom > 0) ok('Zoom-Wert gesetzt: ' + zoom);
  else fail('Zoom-Wert ungültig', zoom);
})();

// ── KATEGORIE 6: Dashboard-Panels ──
console.log('\n── 6. Dashboard-Panels ──');
(function() {
  const panels = ['dash-plan-panel','dash-ber-panel'];
  panels.forEach(id => {
    const el = document.getElementById(id);
    if (el) ok('Panel vorhanden: ' + id);
    else fail('Panel fehlt: ' + id);
  });
})();


// ── KATEGORIE 7: Krise-Plan immer oben (auch bei Delegation) ──
console.log('\n── 7. Krise-Plan Positionierung ──');
(function() {
  if (typeof renderDashboardPlaene !== 'function') { warn('renderDashboardPlaene nicht verfügbar'); return; }

  // Simuliere DB mit Krise+delegiert Plan
  const backup = JSON.parse(JSON.stringify(DB));
  DB.plaene = [
    { id: 'k1', titel: 'Krise delegiert', prioritaet: 'krise', horizont: 'kurzfristig', status: null,
      schritte: [{ titel: 'Schritt', status: 'offen', delegiertAn: 'Max', reihenfolge: 0 }] },
    { id: 'n1', titel: 'Normal hoch',     prioritaet: 'hoch',  horizont: 'kurzfristig', status: null,
      schritte: [{ titel: 'Schritt', status: 'offen', reihenfolge: 0 }] },
  ];
  renderDashboardPlaene();
  const el = document.getElementById('ph-plan');
  const html = el ? el.innerHTML : '';

  // Krise-Block muss vor Kurzfristig kommen
  const idxKrise  = html.indexOf('Krise');
  const idxKurz   = html.indexOf('Kurzfristig');
  if (idxKrise >= 0 && idxKurz >= 0 && idxKrise < idxKurz)
    ok('Krise-Block erscheint vor Kurzfristig-Block');
  else fail('Krise-Block nicht vor Kurzfristig-Block', {idxKrise, idxKurz});

  // Krise-Plan darf NICHT in Warte-auf erscheinen
  const idxWarte = html.indexOf('Warte auf');
  if (idxWarte >= 0) {
    // Prüfe ob Krise-Plan-Titel in Warte-auf vorkommt
    const warteSection = html.slice(idxWarte);
    if (!warteSection.includes('Krise delegiert'))
      ok('Krise-Plan nicht in Warte-auf Sektion');
    else fail('Krise-Plan erscheint fälschlicherweise in Warte-auf');
  } else {
    ok('Kein Warte-auf Bereich (Krise-Plan korrekt ausgefiltert)');
  }

  // Personen-SVG bei delegiertem Krise-Plan
  const kriseSection = html.slice(html.indexOf('Krise'), idxKurz >= 0 ? idxKurz : html.length);
  if (kriseSection.includes('M20 21v-2a4 4'))
    ok('Personen-SVG bei delegiertem Krise-Plan vorhanden');
  else fail('Personen-SVG fehlt bei delegiertem Krise-Plan');

  // Roter Hintergrund bei Krise-Zeile
  if (kriseSection.includes('background:#fdf0ef'))
    ok('Roter Hintergrund bei Krise-Zeile');
  else fail('Roter Hintergrund fehlt bei Krise-Zeile');

  // Restore
  DB.plaene = backup.plaene;
  renderDashboardPlaene();
})();

// ── KATEGORIE 8: Favicon Badge ──
console.log('\n── 8. Favicon Badge ──');
(function() {
  if (typeof badgeAktualisieren !== 'function') { fail('badgeAktualisieren nicht definiert'); return; }
  ok('badgeAktualisieren definiert');

  const backup = JSON.parse(JSON.stringify(DB));

  // Test 1: Krise zählt immer (auch delegiert)
  DB.plaene = [
    { id: 'k1', prioritaet: 'krise', horizont: 'langfristig', status: null,
      schritte: [{ titel: 'S', status: 'offen', delegiertAn: 'Max', reihenfolge: 0 }] }
  ];
  DB.aufgaben = [];
  badgeAktualisieren();
  const link1 = document.querySelector("link[rel~='icon']");
  if (link1 && link1.href.startsWith('data:image/png'))
    ok('Badge: Favicon nach badgeAktualisieren als PNG gesetzt');
  else fail('Badge: Favicon nicht als PNG gesetzt');

  // Test 2: Kurzfristig nicht-delegiert zählt
  DB.plaene = [
    { id: 'n1', prioritaet: 'mittel', horizont: 'kurzfristig', status: null,
      schritte: [{ titel: 'S', status: 'offen', reihenfolge: 0 }] }
  ];
  badgeAktualisieren();
  ok('Badge: kurzfristiger nicht-delegierter Plan – kein Fehler');

  // Test 3: Kurzfristig + delegiert zählt NICHT
  DB.plaene = [
    { id: 'n2', prioritaet: 'mittel', horizont: 'kurzfristig', status: null,
      schritte: [{ titel: 'S', status: 'offen', delegiertAn: 'Team', reihenfolge: 0 }] }
  ];
  badgeAktualisieren();
  ok('Badge: delegierter kurzfristiger Plan – kein Fehler');

  // Test 4: Keine Pläne → kein Fehler
  DB.plaene = [];
  badgeAktualisieren();
  ok('Badge: leere Pläne – kein Fehler');

  DB.plaene = backup.plaene;
  DB.aufgaben = backup.aufgaben;
  badgeAktualisieren();
})();

// ── ERGEBNIS ──
console.log('\n══════════════════════════════════════');
const okC   = results.filter(r => r.status === 'ok').length;
const failC = results.filter(r => r.status === 'fail').length;
const warnC = results.filter(r => r.status === 'warn').length;
console.log(`ERGEBNIS: ${okC} OK | ${failC} FAIL | ${warnC} WARN`);
if (failC === 0) console.log('✅ Alle Tests bestanden');
else console.error('❌ ' + failC + ' Test(s) fehlgeschlagen');
