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
| Echter OSM/Overpass-Import-Pipeline | ✅ `backend/app/tools/osm_import.py` (fetch/convert/from-pbf) + `scripts/fetch_hannover_osm.sh`; GeoJSON mit echten OSM-Koordinaten |
| Multiplayer (Colyseus), Verkehrs-KI, NPC-Tagesabläufe, Vektor-DB | 🧭 in `docs/ROADMAP.md` als nächste Ausbaustufen beschrieben, noch nicht implementiert |

**Kartendaten (OSM):** `frontend/src/data/hannover_center.geojson` enthält ein dichtes
Straßen-/POI-Netz um Kröpcke, Hbf, List und Maschsee mit **echten OSM-Koordinaten**
(ODbL). Zusätzlich ist der vollständige Import-Pfad implementiert:

```bash
# Echten Overpass-Export für Hannover-Zentrum holen (braucht Netzwerk)
cd backend && python -m app.tools.osm_import fetch \
  --south 52.358 --west 9.725 --north 52.390 --east 9.765 \
  --out /tmp/hannover_overpass.json

# In das Spiel-GeoJSON konvertieren (Frontend lädt unverändert)
python -m app.tools.osm_import convert \
  --input /tmp/hannover_overpass.json \
  --out ../frontend/src/data/hannover_center.geojson
```

Alternativ Geofabrik-PBF + osmium: siehe `python -m app.tools.osm_import from-pbf --help`.
Das Frontend (`RoadGraph.ts` / `ChunkManager.ts`) bleibt unverändert – nur die GeoJSON-Datei
wird ausgetauscht.


## Echte Karte im Spiel (OSM-Tiles + Straßennetz)

Das Frontend lädt **OpenStreetMap-Rasterkacheln** als Hintergrund (echte Straßenoptik von Hannover)
und zeichnet darüber das **Vektor-Straßennetz** aus `hannover_center.geojson` für Fahrphysik und Missionen.

- Attribution: „© OpenStreetMap“ (rechts oben im HUD)
- Voller Vektor-Export: `./scripts/fetch_hannover_osm.sh` (mit Internet)
- Tiles brauchen zur Laufzeit Internetzugang zum Tile-Server

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
`docs/ARCHITECTURE.md` Abschnitt "World Evolution".

## Story-System ("roter Faden")

`backend/app/data/story_chapters.json` definiert Kapitel, die anhand von XP-Schwellen
freigeschaltet werden. Jedes Kapitel liefert Story-Text (Deutsch), eine Missionskette und
einen Cliffhanger fürs nächste Kapitel. Das Frontend zeigt neue Kapitel als Dialog
(`StoryDialog.ts`) an, sobald `/story/current` ein neues Kapitel meldet. Die vollständige
Story-Bibel (Figuren, Spannungsbogen über 12 geplante Kapitel) steht in
`docs/STORY_BIBLE.md`.

## Straßen exakt auf der Basemap (Fly.io / Produktion)

Die handkuratierte Fallback-Karte weicht von den echten OSM-Tiles ab. Beim
**Docker-/Fly-Build** werden echte OpenStreetMap-Daten geladen und ins Frontend
eingebacken:

```bash
# Neu deployen – OSM-Stage muss neu gebaut werden
fly deploy --no-cache
```

Im Build-Log solltest du sehen:
```
OSM status: ok {'source': 'openstreetmap', 'road_count': ..., ...}
Echtes OSM-GeoJSON eingebunden
```

Lokal vor dem Push (empfohlen, damit auch ohne Build-Netzwerk die Daten stimmen):

```bash
./scripts/fetch_hannover_osm.sh
git add frontend/src/data/hannover_center.geojson
git commit -m "echte OSM-Straßen für Hannover"
```

Danach liegen die Vektorstraßen auf denselben Koordinaten wie die Carto/OSM-Kacheln;
das Auto darf nur auf diesen Straßen (und Parks/Plätzen) fahren, nicht durch Gebäude.

