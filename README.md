# 🌙 Schlummer — Baby Schlaf Tracker (PWA)

Eine schlanke, installierbare **Progressive Web App** zum Tracken von Baby-Schlaf —
inspiriert von der Napper-App, bewusst auf **das Wesentliche** reduziert:

- **Nickerchen starten & beenden** (Live-Timer)
- **Schlafenszeit / Nachtschlaf eintragen**
- **Vorhersage** des nächsten Nickerchens und der Schlafenszeit — so genau wie möglich

Mehr macht die App absichtlich nicht.

---

## Wie die Vorhersage funktioniert

Die App nutzt das **Wachfenster-Prinzip** (engl. *wake windows*) — dieselbe Methode
wie Napper oder Huckleberry. Ein Baby kann altersabhängig nur eine bestimmte Zeit
wach bleiben, bevor es wieder müde wird:

**Nächster Schlaf = letzte Aufwachzeit + passendes Wachfenster**

Für **maximale Genauigkeit** kombiniert die Engine (`js/engine.js`) zwei Quellen:

1. **Altersbasierte Richtwerte** aus der pädiatrischen Schlafforschung
   (Wachfenster, Anzahl & Dauer der Nickerchen je Altersband).
2. **Die echten, getrackten Daten deines Babys.** Aus den bisherigen Zyklen
   werden die *tatsächlichen* Wachfenster und Nickerchen-Dauern pro Tagesposition
   berechnet (1., 2., 3. Nickerchen …).

Beide werden gewichtet gemischt: Je mehr eigene Daten vorliegen, desto stärker
zählt das individuelle Muster (bis zu ~80 %). Zusätzlich wird berücksichtigt, dass
Wachfenster im Tagesverlauf **länger** werden (morgens kurz, vor der Nacht am längsten).

Jede Vorhersage zeigt eine **Genauigkeitsstufe** (niedrig / mittel / hoch),
abhängig davon, wie viele passende Aufzeichnungen vorliegen.

---

## Funktionen

| | |
|---|---|
| 😴 **Nickerchen** | Mit einem Tipp starten/beenden, Live-Timer |
| 🌙 **Nachtschlaf** | Schlafenszeit starten oder manuell nachtragen |
| 🌅 **Nächster Schlaf** | Vorhergesagte Uhrzeit + ideales Zeitfenster |
| 📋 **Tagesplan** | Vorschau aller verbleibenden Schlafphasen |
| 📖 **Verlauf** | Alle Einträge, bearbeitbar & löschbar |
| 👨‍👩‍👧 **Familien-Sync** | Optional: Mama & Papa sehen per Familien-Code live dieselben Daten |
| 📴 **Offline** | Funktioniert komplett ohne Internet (Service Worker) |
| 🔒 **Privat** | Standardmäßig nur lokal (localStorage); Cloud nur bei aktivem Sync |

---

## Nutzung / Installation

Es ist **kein Build-Schritt** nötig — reines HTML/CSS/JS.

### Lokal ausprobieren
```bash
# im Projektordner einen einfachen Webserver starten
python3 -m http.server 8080
# dann im Browser öffnen:
#   http://localhost:8080
```
> Ein Webserver ist nötig (nicht per `file://` öffnen), da die App ES-Module
> und einen Service Worker verwendet.

### Als App installieren
Im Browser auf dem Smartphone öffnen → Menü → **„Zum Startbildschirm hinzufügen“**.
Danach startet Schlummer wie eine native App im Vollbild und funktioniert offline.

### Veröffentlichen
Der Ordner kann unverändert auf jeden statischen Host geladen werden
(GitHub Pages, Netlify, Vercel, eigener Server). Wichtig: **HTTPS**, damit
der Service Worker aktiv wird.

---

## Familien-Sync einrichten (optional)

Damit **beide Elternteile live dieselben Daten** sehen, nutzt die App einen
kostenlosen **Firebase-(Firestore-)** Speicher. Die Einrichtung ist einmalig:

### 1. Firebase-Projekt anlegen
1. Auf **https://console.firebase.google.com** mit einem Google-Konto anmelden.
2. **„Projekt hinzufügen"** → Namen vergeben (z. B. „schlummer") → erstellen.

### 2. Firestore-Datenbank aktivieren
1. Linkes Menü → **Build → Firestore Database** → **„Datenbank erstellen"**.
2. Modus **„Produktion"** wählen, eine Region (z. B. `eur3` / Europa) auswählen.

### 3. Anonyme Anmeldung aktivieren
1. Linkes Menü → **Build → Authentication** → **„Los geht's"**.
2. Reiter **„Sign-in method"** → **„Anonym"** aktivieren.

### 4. Sicherheitsregeln setzen
Unter **Firestore → Regeln** folgenden Inhalt einfügen und veröffentlichen:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /families/{code}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
Nur angemeldete App-Nutzer mit dem geheimen Familien-Code kommen so an die Daten.

### 5. Zugangsdaten eintragen
1. **Projektübersicht (Zahnrad) → Projekteinstellungen → Deine Apps → Web-App** (`</>`)
   hinzufügen. Firebase zeigt dann ein `firebaseConfig`-Objekt an.
2. Diese Werte in **`js/firebase-config.js`** eintragen (sie sind nicht geheim).

### 6. Verbinden
In der App: **⚙️ → Familien-Sync → Code erzeugen → Verbinden.** Denselben Code
auf dem zweiten Handy eingeben – fertig. Ab jetzt synchronisiert sich alles live.

> Bei aktivem Sync liegen die Daten (verschlüsselt) bei Firebase statt nur lokal.
> Ohne Sync bleibt die App komplett offline und lokal.

## Projektstruktur

```
index.html              App-Shell
manifest.webmanifest    PWA-Manifest (Name, Icons, Farben)
sw.js                   Service Worker (Offline-Cache)
css/styles.css          Styling (Nacht-Theme, mobil-first)
js/
  engine.js             Vorhersage-Engine (Wachfenster + Personalisierung)
  store.js              Datenhaltung & localStorage (+ Sync-Anbindung)
  ui.js                 Rendering & Interaktion
  app.js                Bootstrap + Service-Worker-Registrierung
  sync.js               Familien-Sync über Firebase Firestore
  firebase-config.js    Firebase-Zugangsdaten (für den Sync einzutragen)
icons/                  App-Icons (Mondsichel)
scripts/gen-icons.mjs   Generiert die PNG-Icons neu (node scripts/gen-icons.mjs)
```

---

## Hinweis

Schlummer ist ein Hilfsmittel zur Orientierung und ersetzt keine ärztliche
Beratung. Jedes Baby ist individuell — die Vorhersagen sind Richtwerte, die mit
mehr Aufzeichnungen genauer werden.
