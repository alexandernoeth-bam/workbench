"""Baut clie.html aus der Workbench (Unterbau) und dem eigenen Teil.

Wie beim Wochenkompass: Speicher, Google-Anmeldung, Drive, Abgleich,
Löschvermerke und der Aktivitäten-Kern kommen wörtlich aus der
Workbench. Dazu das Lesen des Google-Kalenders.

Vom Kern wird nur übernommen, was CLIE schon zeigt: Funktionen, die
Anschlüsse der Oberfläche brauchen (kpTextSetzen …), kommen erst mit
den Apps, die sie bedienen. So ruft nichts eine Funktion, die es in
CLIE noch nicht gibt.
"""
import re, sys, os
HIER = os.path.dirname(os.path.abspath(__file__))
def hier(n): return os.path.join(HIER, n)

WB = open('/home/claude/wb6/workbench.html', encoding='utf-8').read()
WB_JS = re.findall(r'<script>([\s\S]*?)</script>', WB)[-1]

def funktion(name):
    eine = re.search(r'\nfunction ' + name + r'\([^)]*\)\s*\{[^\n]*\}\s*\n', WB_JS)
    if eine:
        return eine.group(0).strip('\n')
    m = re.search(r'\nfunction ' + name + r'\([^)]*\) \{[\s\S]*?\n\}\n', WB_JS)
    if not m:
        sys.exit('Workbench-Funktion fehlt: ' + name)
    return m.group(0).strip('\n')

def ersetze(text, alt, neu, name):
    if text.count(alt) != 1:
        sys.exit('Anpassung an %s passt nicht (%d Treffer): %r' % (name, text.count(alt), alt))
    return text.replace(alt, neu)

def variable(name):
    m = re.search(r'\nvar ' + name + r'\b[^\n]*\n', WB_JS)
    if not m:
        sys.exit('Workbench-Variable fehlt: ' + name)
    a = m.start() + 1
    if m.group(0).rstrip().endswith(';'):
        return WB_JS[a:m.end()].rstrip('\n')
    if re.match(r'var \w+ = \[', WB_JS[a:]):
        e = WB_JS.index('];\n', a) + 2
        return WB_JS[a:e]
    e = WB_JS.index('\n};\n', a) + 3
    return WB_JS[a:e]

UNVERAENDERT = [
    'zwei', 'isoDatum', 'isoZeit', 'esc', 'ausIso', 'tagePlus', 'montagVon', 'kalenderwoche',
    'fsApiDa', 'opfsDa', 'idbDa', 'localDa',
    'idbOeffnen', 'idbSchreiben', 'idbLesen', 'idbLoeschen', 'kurzDatum', 'rechtePruefen', 'rechteAnfragen',
    'dateiSchreiben', 'dateiLesen', 'opfsHandle', 'opfsSchreiben', 'opfsLesen', 'localSchreiben', 'localLesen',
    'jetzt', 'neueKennung', 'grabsteinSetzen', 'grabsteinZeit', 'grabsteineAufraeumen', 'zusammenfuehren',
    'alsText', 'uebernehmen', 'speichern', 'notwegSchreiben', 'localNotweg', 'laden', 'notwegLesen', 'localNotwegLesen',
    'gisLaden', 'tokenMerken', 'tokenAusSitzung', 'tokenVergessen', 'tokenGueltig', 'restMinuten',
    'erneuerungPlanen', 'erneuerungLaufen', 'erneuerungPruefen', 'klientVorbereiten', 'anmelden', 'anmeldeVersuch',
    'abmelden', 'warAngemeldet', 'driveKopf', 'dienstAusAdresse', 'antwortPruefen', 'driveSuchen', 'driveAnlegen',
    'driveHochladen', 'driveHerunterladen', 'textZuBestand', 'berichtText', 'abgleichPlanen',
    'taktPruefen', 'taktStarten', 'verbindungTaktStarten',
    'wegText', 'dateiWaehlen', 'dateiAnbieten', 'klickErneuern',
    'leereDatenbank',
]

# Google-Kalender lesen — wörtlich. Das Holen selbst (termineHolen) ist
# in der Workbench mit Tag, Jahresarchiv und Ladebalken verwoben; CLIE
# hat dafür clTermineHolen.
KALENDER = [
    # kalenderEintrag und kalenderBekannt seit 0.131.0: CLIE darf die
    # Zuordnung jetzt selbst setzen, soll sie aber nicht zweimal
    # formulieren. kalenderKontextUm bleibt draußen — das ruft
    # tagZeichnen() der Workbench, das es hier nicht gibt.
    'kalenderListeHolen', 'kalenderGewaehlt', 'kalenderKontext', 'kalenderEintrag', 'kalenderBekannt',
    'zeitAusEintrag', 'tagAusEintrag',
    'titelOhneArt', 'istCoachTermin', 'praktischGanztags', 'terminKontextUeber', 'merkeTermin', 'eintraegeEinsortieren',
    'einenKalenderHolen', 'termineZahl', 'termineFuerTag',
]
KALENDER_VARS = ['ART_MUSTER', 'KAL_SEITEN_MAX']

# Routinen: Wann ist eine fällig, wann erledigt, um welche Uhrzeit —
# wörtlich, damit CLIE und Workbench dieselben Tage zeigen.
JAHR_VARS = ['feiertagJahr', 'feiertagListe', 'FUELLWOERTER', 'JT_BERUFLICH']
JAHR = ['ostern', 'feiertageVon', 'feiertagAn', 'ferienEintragAn', 'ferienAn',
        'wortStamm', 'woerterVon', 'aehnlichkeit', 'jtDoppelWahl', 'jtDoppelt', 'jtKontext']

ROUTINEN = ['monatsende', 'wochenIndex', 'monatsIndex', 'faelligAn', 'aufgabeFaelligAn', 'istErledigtAn',
            'wiederholungSetzen', 'aufgabeZeitAn',
            # „nur diesmal“ — auslassen und verlegen (seit 0.5)
            'regulaerFaellig', 'ausfuehrungAuslassen', 'ausfuehrungVerlegen']

# Aktivitäten-Kern: alle Werte; Funktionen ohne Oberflächen-Anschluss.
KERN_DATEI = open('/home/claude/wb6/kern.js', encoding='utf-8').read()
KERN_FUNKTIONEN = re.findall(r'(?m)^function ([A-Za-z_$][\w$]*)', KERN_DATEI)
KERN_VARS = re.findall(r'(?m)^var ([A-Za-z_$][\w$]*)', KERN_DATEI)

# Anschlüsse, die erst die Apps aus Stufe 2 und 3 liefern
ANSCHLUESSE = ['kpVerweisHtml', 'kpTextSetzen', 'kpBzUm', 'kpBzSprung', 'kpKastenUm', 'kpZelleUm', 'kpAbschnittUm',
               'flaecheSinnbild', 'feldErsetzen', 'wortUmDieMarke', 'listenNummern', 'tabellenZellen',
               'istTabellenzeile', 'istTrennzeile', 'tabellenRichtung', 'spaeterSichern', 'zeichne', 'kpPrioUm']
ANSCHLUESSE += [a.strip() for a in (sys.argv[2].split(',') if len(sys.argv) > 2 else []) if a.strip()]
EIGEN = open(hier('cl_app.js'), encoding='utf-8').read() + '\n' + open(hier('cl_schule.js'), encoding='utf-8').read()
# Seit 0.30: Pfade der App „Kurs“ (Inhalte)
EIGEN += '\n' + open(hier('cl_pfade.js'), encoding='utf-8').read()
# Seit 0.80: Palm-Modell — Aufgaben, Memo Pad, Agenda
EIGEN += '\n' + open(hier('cl_palm.js'), encoding='utf-8').read()
# Seit 0.87: Kartenspiele — Poker und Schafkopf
EIGEN += '\n' + open(hier('cl_karten.js'), encoding='utf-8').read()
EIGEN_FUNKTIONEN = set(re.findall(r'(?m)^function ([A-Za-z_$][\w$]*)', EIGEN))
fehlend = set(a for a in ANSCHLUESSE if a not in EIGEN_FUNKTIONEN)
texte = dict((n, funktion(n)) for n in KERN_FUNKTIONEN)
weg = set()
while True:
    neu = set(n for n, t in texte.items() if n not in weg
              and any(re.search(r'\b' + re.escape(f) + r'\s*\(', t) for f in (fehlend | weg)))
    if not neu:
        break
    weg |= neu
KERN_MIT = [n for n in KERN_FUNKTIONEN if n not in weg]

teile = [funktion(n) for n in UNVERAENDERT]
teile.append('/* ---------- Google-Kalender lesen (aus der Workbench) ---------- */')
teile += [variable(n) for n in KALENDER_VARS]
teile += [funktion(n) for n in KALENDER]
# Seit 0.8.2: Jahrestermine, Feiertage und Ferien wie im Jahreskalender der Workbench
teile.append('/* ---------- Jahrestermine, Feiertage, Ferien (aus der Workbench) ---------- */')
teile += [variable(n) for n in JAHR_VARS]
teile += [funktion(n) for n in JAHR]
teile.append('/* ---------- Routinen: fällig, erledigt, Uhrzeit (aus der Workbench) ---------- */')
teile += [funktion(n) for n in ROUTINEN]
teile.append('/* ---------- Aktivitäten-Kern der Workbench ---------- */')
teile += [variable(n) for n in KERN_VARS]
teile += [funktion(n) for n in KERN_MIT]

# Anmeldung: wie in der Workbench, nur holt CLIE die Termine selbst.
a = funktion('anmeldeAnfragen')
a = ersetze(a, '      termineHolen(false);\n', '      clTermineHolen(false);\n', 'anmeldeAnfragen')
# Seit 0.7.1: Schlüssel über Neustarts halten und das Konto merken —
# bei zwei Google-Konten fragte Google sonst bei jeder Erneuerung nach.
a = ersetze(a, '      tokenMerken(antwort.access_token, Number(antwort.expires_in) || 3600);\n',
            '      tokenMerken(antwort.access_token, Number(antwort.expires_in) || 3600);\n      clTokenSichern();\n      clKontoMerken();\n', 'anmeldeAnfragen')
a = ersetze(a, '  klient.requestAccessToken({ prompt: aufforderung });\n',
            '  klient.requestAccessToken(clAnfrage(aufforderung));\n', 'anmeldeAnfragen')
teile.append('/* Aus der Workbench — termineHolen heißt hier clTermineHolen; dazu\n   merkt CLIE Schlüssel und Konto (seit 0.7.1). */\n' + a)

KERN = '\n\n'.join(teile)

# Seit CLIE 0.124.0: Felder, die diese Fassung nicht kennt, werden
# durchgereicht statt verworfen. Vorher übernahmen uebernehmen und
# textZuBestand nur, was in SAMMLUNGEN der laufenden Fassung steht —
# ein Gerät mit einer älteren CLIE las die Datei, kannte „casestudies“
# nicht, und beim nächsten Schreiben war das Modul aus der Datei weg.
# Ein Gerät darf nicht löschen, was es nur nicht versteht.
FREMDFELDER = (
    "  /* Was diese Fassung nicht kennt, bleibt unangetastet erhalten (0.124.0) */\n"
    "  clFremdfelderUebernehmen(gelesen, frisch);\n")
KERN = ersetze(KERN, '  bestandStempeln(frisch);\n  DB = frisch;',
               FREMDFELDER + '  bestandStempeln(frisch);\n  DB = frisch;', 'uebernehmen/Fremdfelder')
KERN = ersetze(KERN, '  bestandStempeln(frisch);\n  return frisch;',
               FREMDFELDER + '  bestandStempeln(frisch);\n  return frisch;', 'textZuBestand/Fremdfelder')
KERN = ersetze(KERN, '  ergebnis.einstellungen.clientId = CLIENT_ID;\n'
                     '  ergebnis.einstellungen.redirectUri = REDIRECT_URI;\n'
                     '  ergebnis.version = APP_VERSION;',
               '  clFremdfelderUebernehmen(lokal, ergebnis);\n'
               '  clFremdfelderUebernehmen(fremd, ergebnis);\n'
               '  ergebnis.einstellungen.clientId = CLIENT_ID;\n'
               '  ergebnis.einstellungen.redirectUri = REDIRECT_URI;\n'
               '  ergebnis.version = APP_VERSION;', 'zusammenfuehren/Fremdfelder')
# Seit CLIE 0.97.12: Bei gleichem Änderungsstempel gilt der Server. Zwei
# Geräte schreiben in derselben Sekunde; sonst behielte jedes seine
# eigene Fassung und der Abgleich käme nie zur Ruhe.
#
# Seit 0.121.0 getrennt vom Zählwerk: Ein gleicher Stempel heißt
# dieselbe Fassung. Der Server gilt, aber geändert hat sich nichts —
# gezählt wird „behalten“, und ein Konflikt ist es erst recht nicht.
# Vorher zählte jeder Gleichstand als „ersetzt“ und als „Konflikt“: Der
# Bericht meldete Hunderte Konflikte, während nichts geschah.
KERN = ersetze(KERN, '          if ((wb.geaendert || 0) > (wa.geaendert || 0)) {',
               '          if ((wb.geaendert || 0) >= (wa.geaendert || 0)) {', 'zusammenfuehren/Sätze')
KERN = ersetze(KERN, '            ergebnis[s][k] = wb; bericht.ersetzt++;\n',
               '            ergebnis[s][k] = wb;\n'
               '            if ((wb.geaendert || 0) > (wa.geaendert || 0)) { bericht.ersetzt++; } else { bericht.behalten++; }\n',
               'zusammenfuehren/Sätze zählen')
# Im Listenzweig genügt es, den Gleichstand-Fall den Serversatz nehmen
# zu lassen: „größer“ bleibt „ersetzt“ samt Konflikt, gleich wird
# behalten. Der Zweig für den Gleichstand ist der letzte else.
KERN = ersetze(KERN,
               '        } else {\n'
               '          ergebnis[s].push(paar.a); bericht.behalten++;\n'
               '        }\n'
               '      } else if (paar.b) {',
               '        } else {\n'
               '          /* Gleicher Stempel heißt gleiche Fassung: Der Server gilt,\n'
               '             damit der Abgleich zur Ruhe kommt. Geändert hat sich\n'
               '             dabei nichts — weder „ersetzt“ noch Konflikt. */\n'
               '          ergebnis[s].push(paar.b); bericht.behalten++;\n'
               '        }\n'
               '      } else if (paar.b) {',
               'zusammenfuehren/Listen Gleichstand')
# Seit CLIE 0.100.0: die leere Datenbank kennt auch die Stapel der Lernkartei.
KERN = ersetze(KERN, '    lernkaesten:       [],\n',
               '    lernkaesten:       [],\n    lernstapel:        [],\n', 'leereDatenbank/lernstapel')
# Seit CLIE 0.123.0: das Modul „Casestudies“ — Semester, Lehrplan, Abgaben
# und Stundenplan-Fenster in einer Sammlung, getrennt durch das Feld „typ“
# (wie es „kurs“ schon macht).
KERN = ersetze(KERN, '    ideen:             [],\n',
               '    ideen:             [],\n    casestudies:       [],\n', 'leereDatenbank/casestudies')
# Seit CLIE 0.49: Priorität in fünf Stufen (P1 … P5); die Workbench kennt
# nur P1 … P3 und zeigt „P4 “/„P5 “ als Text.
KERN = ersetze(KERN, 'var KP_PRIO = /^[P]([1-3])\\s+', 'var KP_PRIO = /^[P]([1-5])\\s+', 'KP_PRIO')
KERN = ersetze(KERN, "return (p >= 1 && p <= 3) ? 'P' + p + ' ' + rest : rest;", "return (p >= 1 && p <= 5) ? 'P' + p + ' ' + rest : rest;", 'kpPrioText')
# Seit CLIE 0.67: private Termine — Google liefert die Sichtbarkeit mit,
# jeder gemerkte Termin trägt „privat“ (private oder confidential).
KERN = ersetze(KERN, "+ 'end,recurringEventId)'", "+ 'end,recurringEventId,visibility)'", 'einenKalenderHolen')
_alt = "serieId: e.recurringEventId || ''"
assert KERN.count(_alt) == 3, 'eintraegeEinsortieren: serieId ' + str(KERN.count(_alt))
KERN = KERN.replace(_alt, _alt + ", privat: e.visibility === 'private' || e.visibility === 'confidential'")

GRUND = r"""
/* ============================================================
   Grunddaten

   CLIE arbeitet auf der workbench.json — mit den Sammlungen der
   Workbench. Gerätespeicher, Dateigriff und Anmeldemerker heißen
   eigen: Liegen die Apps unter derselben Adresse, kommen sie sich
   lokal nicht in die Quere; zusammen kommen sie über Google Drive.
   ============================================================ */

var APP_VERSION = '__VERSION__';
var DATEINAME   = 'workbench.json';
var IDB_NAME    = 'clie-speicher';
var IDB_STORE   = 'handles';
var IDB_KEY     = 'datendatei';
var LS_KEY      = 'clie-daten';
var OPFS_NAME   = 'clie-workbench.json';
/* Dieselbe Google-Anwendung wie die Workbench: Nur so ist deren
   workbench.json mit dem Recht drive.file sichtbar. Dazu das Lesen
   des Kalenders. */
var CLIENT_ID   = '__CLIENT_ID__';
var REDIRECT_URI = '__REDIRECT__';
/* Seit 0.2: Termine lesen und schreiben (calendar.events); die Liste
   der Kalender braucht weiter calendar.readonly. */
var SCOPES = 'https://www.googleapis.com/auth/drive.file '
           + 'https://www.googleapis.com/auth/calendar.readonly '
           + 'https://www.googleapis.com/auth/calendar.events';
var GIS_URL   = 'https://accounts.google.com/gsi/client';
var TOKEN_KEY = 'clie-zugriff';
var ANMELDE_MERKER = 'clie-war-angemeldet';
var ABGLEICH_VERZUG  = 2000;
var ABGLEICH_MINDEST = 20000;
var ABGLEICH_TAKT    = 30000;
var DRIVE_DATEI = '__DRIVE__';
var VORLAUF_MS = 5 * 60 * 1000;
var GRABSTEIN_TAGE = 180;

/* Wörtlich aus der Workbench — sonst gingen beim Abgleich Sammlungen verloren. */
__SAMMLUNGEN__

/* Aus der Workbench: nummerierte Zeilen */
var NUMMER_MUSTER = __NUMMER__;

var speicherWeg = 'keiner';
var dateiHandle = null;
var dateiName = '';
var rechteStand = 'unbekannt';
var letzterSchreibvorgang = null;
var tokenClient = null;
var zugriffToken = null;
var tokenAblauf = 0;
var erneuerungsUhr = null;
var erneuerungVersuche = 0;
var ERNEUERUNG_MAX = 6;
var ERNEUERUNG_ABSTAND = 60000;
var ANMELDE_ZEITGRENZE_MS = 60 * 1000;
var anmeldungLaeuft = false;
var letzteErneuerung = null;
var gisBereit = false;
var driveDateiId = '';
var driveStand = '';
var letzteUebertragung = null;
var letzterAbgleich = null;
var letzterBericht = null;
var abgleichUhr = null;
var abgleichLaeuft = false;
var abgleichZuletztMs = 0;
var verbindungOk = null;
var verbindungUhr = null;
var VERBINDUNG_TAKT = 60000;
var abgleichFehler = '';
var lokalOffen = false;
var taktUhr = null;

/* Termine gehören Google: nur im Arbeitsspeicher, nie in der Datei. */
var kalenderListe = [];
var termineNachTag = {};
var kalenderStand = '';
var kalenderFehler = '';
var kalenderLaeuft = false;
var kalenderUhr = null;
"""

def wert(name):
    m = re.search(r"var " + name + r"\s*=\s*'([^']*)';", WB_JS)
    if not m:
        sys.exit('Grundwert fehlt: ' + name)
    return m.group(1)

nummer = re.search(r"var NUMMER_MUSTER = (/.*/);", WB_JS)
if not nummer:
    sys.exit('NUMMER_MUSTER fehlt')
samm = re.search(r"var SAMMLUNGEN = \[[\s\S]*?\];", WB_JS)
if not samm:
    sys.exit('SAMMLUNGEN fehlt')
# Seit 0.100.0: Die Stapel der Lernkartei gehören CLIE allein; die
# Workbench bewahrt sie nur mit und gleicht sie ab.
SAMM = ersetze(samm.group(0), "'lernstand',", "'lernstand','lernstapel',", 'SAMMLUNGEN/lernstapel')
# Seit 0.123.0: das Modul „Casestudies“. Ohne diesen Eintrag wüsste der
# Abgleich nichts davon und das Feld fiele beim Zusammenführen weg.
SAMM = ersetze(SAMM, "'ideen'];",
               "'ideen',\n"
               "                  /* seit CLIE 0.123.0: Modul „Casestudies“ — Semester,\n"
               "                     Lehrplan, Abgaben und Stundenplan-Fenster (Feld „typ“) */\n"
               "                  'casestudies'];", 'SAMMLUNGEN/casestudies')

VERSION = sys.argv[1] if len(sys.argv) > 1 else '0.1.0'
GRUND = (GRUND.replace('__VERSION__', VERSION)
              .replace('__DRIVE__', wert('DRIVE_DATEI'))
              .replace('__SAMMLUNGEN__', SAMM)
              .replace('__CLIENT_ID__', wert('CLIENT_ID'))
              .replace('__REDIRECT__', wert('REDIRECT_URI'))
              .replace('__NUMMER__', nummer.group(1)))

HTML = open(hier('cl_huelle.html'), encoding='utf-8').read()

SKRIPT = ("'use strict';\n" + GRUND
          + "\n/* ============================================================\n"
          + "   Unterbau aus der Workbench " + wert('APP_VERSION') + " — wörtlich übernommen:\n"
          + "   Speicher, Google-Anmeldung, Drive, Abgleich, Löschvermerke,\n"
          + "   Kalender lesen, leere Datenbank und der Aktivitäten-Kern (kp…).\n"
          + "   ============================================================ */\n\n"
          + KERN + '\n\n' + EIGEN + '\nvar DB = leereDatenbank();\n')
import base64
ZIFFERN = base64.b64encode(open(hier('vt323-ziffern.woff2'), 'rb').read()).decode('ascii')
HTML = HTML.replace('__ZIFFERN__', ZIFFERN).replace('__ZGROESSE__', '128%')
aus = HTML.replace('__VERSION__', VERSION).replace('/*__SKRIPT__*/', SKRIPT)
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'clie.html'), 'w', encoding='utf-8').write(aus)
print('clie.html gebaut — Version', VERSION, '· Unterbau aus Workbench', wert('APP_VERSION'),
      '·', len(UNVERAENDERT) + len(KALENDER) + len(ROUTINEN) + len(KERN_MIT) + 1, 'Funktionen übernommen ·',
      len(weg), 'Kern-Funktionen warten auf spätere Apps')
