# CityLife AI

> "A Living Open World built on OpenStreetMap" – ein persistentes Open-World-Wirtschafts-
> und Story-Spiel, das als Telegram Mini App läuft. Die Spielwelt basiert auf echten
> Geodaten realer Städte (Start: Hannover). KI-Agenten steuern Missionen, NPCs, Wirtschaft
> und eine durchgehende Story, die sich Level für Level weitererzählt.

## Warum dieses Repo anders aufgebaut ist als der ursprüngliche Chat-Entwurf

Der Chat-Entwurf beschreibt die *Vollausbaustufe* (Verkehr, NPC-Tagesabläufe, Multiplayer,
Vektor-DB-Erinnerungen etc.). Das ist ein Mehrjahresprojekt. Dieses Repo liefert dir den
**funktionsfähigen Kern**, auf dem alles Weitere sauber aufgebaut werden kann:

| Baustein | Status in diesem Repo |
|---|---|
| Backend (FastAPI, DB, API) | ✅ voll lauffähig |
| Mission-Engine | ✅ funktionsfähig, generiert dynamische Missionen |
| Story-Engine ("roter Faden" über Level) | ✅ funktionsfähig, 5 Kapitel als Startgerüst |
| City-Evolution (Stadt entwickelt sich pro Spieler über Zeit) | ✅ funktionsfähig (World-Tick-Engine) |
| Telegram-Bot (Mini-App-Start, Highscores) | ✅ funktionsfähig (aiogram) |
| Frontend (Phaser 3, Auto fahren, echtes Straßenraster Hannover) | ✅ lauffähiger Prototyp |
| Echter OSM/Overpass-Import-Pipeline | ⚠️ als Skript vorbereitet, aber mit **vereinfachten** Beispieldaten für Hannover-Zentrum befüllt (siehe unten) |
| Multiplayer (Colyseus), Verkehrs-KI, NPC-Tagesabläufe, Vektor-DB | 🧭 in `docs/ROADMAP.md` als nächste Ausbaustufen beschrieben, noch nicht implementiert |

**Wichtig zur Kartendaten-Ehrlichkeit:** In dieser Sandbox habe ich keinen Netzwerkzugriff auf
`overpass-api.de` / `openstreetmap.org`. Die Datei `frontend/src/data/hannover_center.geojson`
enthält deshalb ein *handkuratiertes, geografisch grob korrektes* Straßen- und POI-Netz um
Kröpcke / Hauptbahnhof / Maschsee/Neues Rathaus, **keinen echten OSM-Export**. Das Backend
und der Importer sind aber so gebaut, dass du eine echte `hannover.osm.pbf`-Datei
(z. B. von Geofabrik) durch `backend/app/tools/osm_import.py` (Platzhalter, siehe Kommentare)
jederzeit einspeisen kannst, ohne den Rest der Architektur zu ändern.

## Repo-Struktur

```
citylife-ai/
├── backend/            FastAPI-Server: Auth, Missionen, Story, City-State, Leaderboard
│   └── app/
│       ├── main.py
│       ├── models.py / schemas.py / database.py / config.py / auth.py
│       ├── routers/    players, missions, story, world, leaderboard
│       ├── engines/    mission_engine, story_engine, world_engine
│       └── data/       story_chapters.json (der "rote Faden")
├── frontend/           Phaser 3 + TypeScript + Vite Client (Telegram Mini App)
│   └── src/
│       ├── scenes/     BootScene, WorldScene, UIScene
│       ├── game/       RoadGraph, Car, ChunkManager, MissionMarker, StoryDialog
│       ├── api/        Backend-Client
│       └── data/       hannover_center.geojson
├── telegram-bot/       aiogram-Bot: /start startet Mini App, /rangliste zeigt Highscores
├── docs/                ARCHITECTURE.md, STORY_BIBLE.md, ROADMAP.md
└── docker-compose.yml
```

## Schnellstart (lokal, ohne Docker)

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API-Doku dann unter http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Öffnet unter http://localhost:5173 – WASD/Pfeiltasten steuern das Auto, es fährt im
Straßenraster von Hannover-Zentrum. Missionen und Story werden vom Backend geladen
(`VITE_API_URL` in `.env`, Default `http://localhost:8000`).

### Telegram-Bot
```bash
cd telegram-bot
pip install -r requirements.txt
export TELEGRAM_BOT_TOKEN=xxxx
export MINI_APP_URL=https://deine-domain.tld   # vom Frontend-Hosting
python bot.py
```

### Alles zusammen mit Docker
```bash
docker compose up --build
```

## Persistente, individuell wachsende Stadt (Kernversprechen des Spiels)

Jeder Spieler hat einen eigenen `CityState`-Datensatz pro Stadt. Der `world_engine.py`
"tickt" diesen Zustand bei jedem Login abhängig von der **echten vergangenen Zeit**
(nicht nur Spielzeit) weiter: Mieten, Leerstand, NPC-Stimmung, Ereigniswahrscheinlichkeit
und Missionsschwierigkeit verändern sich. Dadurch sieht Hannover für Spieler A nach
zwei Wochen anders aus als für Spieler B – abhängig davon, welche Immobilien gekauft,
welche Missionen erfüllt und welche Entscheidungen getroffen wurden. Details in
`docs/ARCHITECTURE.md` Abschnitt "World Evolution". yeas

## Story-System ("roter Faden")

`backend/app/data/story_chapters.json` definiert Kapitel, die anhand von XP-Schwellen
freigeschaltet werden. Jedes Kapitel liefert Story-Text (Deutsch), eine Missionskette und
einen Cliffhanger fürs nächste Kapitel. Das Frontend zeigt neue Kapitel als Dialog
(`StoryDialog.ts`) an, sobald `/story/current` ein neues Kapitel meldet. Die vollständige
Story-Bibel (Figuren, Spannungsbogen über 12 geplante Kapitel) steht in
`docs/STORY_BIBLE.md`.
