# CityLife AI - Architektur

## Überblick

```
Telegram-Client
      │  (WebApp / initData)
      ▼
Telegram Mini App (Phaser 3 + TS, im Frontend-Container ausgeliefert)
      │  REST/JSON (fetch)
      ▼
FastAPI Backend  ──────────────────────────────────────────
  ├─ auth.py           Telegram-initData-HMAC-Verifikation
  ├─ routers/          players, missions, story, world, leaderboard
  ├─ engines/
  │    ├─ mission_engine.py   generiert Story-/freie Missionen
  │    ├─ story_engine.py     schaltet Kapitel per XP frei
  │    └─ world_engine.py     "Catch-up-Tick": individuelle Stadtentwicklung
  └─ models.py          SQLAlchemy: Player, CityState, StoryProgress,
                         MissionInstance, PropertyOwnership, WorldEvent
      │
      ▼
PostgreSQL (Produktiv) / SQLite (lokale Entwicklung, Default)
```

Telegram-Bot (aiogram) ist ein separater, unabhängiger Prozess: er startet die
Mini App über einen `WebAppInfo`-Button und ruft für `/rangliste` dieselbe
REST-API wie das Frontend auf. Bot und Frontend sind bewusst entkoppelt -
beide sprechen nur über die öffentliche Backend-API, nie direkt miteinander.

## Warum dieser Schnitt?

- **Ein Backend, zwei Clients (Mini App + Bot).** Beide nutzen exakt dieselbe
  REST-API. Das verhindert doppelte Spiellogik und macht spätere Clients
  (z.B. eine native App) trivial anschließbar.
- **Engines statt "fetter" Router.** `mission_engine`, `story_engine` und
  `world_engine` enthalten die eigentliche Spiellogik und sind unabhängig von
  FastAPI testbar (siehe `backend/tests/test_api.py`, das sie indirekt über die
  API testet - für komplexere Logik würde man zusätzlich Unit-Tests direkt
  gegen die Engines schreiben).
- **Kartendaten als austauschbare Datenquelle.** Sowohl Backend als auch
  Frontend kennen nur ein GeoJSON-Schema (`{roads: FeatureCollection, pois:
  FeatureCollection}`). Ob dieses Schema aus einer handkuratierten Datei
  (aktueller Stand, siehe `frontend/src/data/hannover_center.geojson`) oder
  aus einem echten OSM/PostGIS-Import (`backend/app/tools/osm_import.py`)
  stammt, ist für den restlichen Code unsichtbar.

## World Evolution - wie "jede Stadt sich individuell entwickelt"

Das war eine explizite Anforderung aus dem ursprünglichen Konzept. Umsetzung:

1. Jeder `Player` hat pro Stadt (`city_id`) genau einen `CityState`-Datensatz
   mit Kennzahlen: `development_level`, `average_rent_index`, `vacancy_rate`,
   `citizen_mood`, `traffic_load`, `event_pressure`, `weather`, `season`.
2. `world_engine.tick()` wird bei **jedem Login** und **jedem Abruf des
   City-States** aufgerufen. Es berechnet, wie viel *reale* Zeit seit dem
   letzten Tick vergangen ist (`last_ticked_at`), und simuliert diese Zeit in
   diskreten Schritten (Standard: 1 Schritt pro Stunde, siehe
   `WORLD_TICK_MIN_INTERVAL_HOURS`) nach.
3. Jeder Schritt bezieht **spielerspezifische** Faktoren ein: Anzahl und
   Zustand der Immobilien (`PropertyOwnership`), Reputation, Story-Flags
   (`StoryProgress.flags`, z.B. ob der Spieler sich für die Nachbarschaft
   oder die Investorenseite entschieden hat). Dadurch divergiert die
   Entwicklung zwischen Spielern, obwohl die Straßen-/POI-Datenbasis identisch
   bleibt.
4. Ein steigender `event_pressure`-Wert kann zufällige `WorldEvent`s auslösen
   (Baustelle, Marathon, Messe, Unfall) - eine einfache Vorstufe zum im
   Konzept beschriebenen "Event Engine".

Dieser "Lazy Catch-up"-Ansatz ist bewusst gewählt, weil er ohne Dauerlast
(Cron-Jobs für Millionen Spieler) auskommt: Stadtentwicklung passiert nur,
wenn ein Spieler tatsächlich mit dem System interagiert.

## Story Engine - der rote Faden

`backend/app/data/story_chapters.json` ist die einzige Quelle der Wahrheit
für die Kampagne. Jedes Kapitel hat:
- `unlock_xp`: XP-Schwelle für Freischaltung
- `intro` / `cliffhanger`: Fließtext, im Frontend als `StoryDialog` gezeigt
- `mission_chain`: Liste von Missions-Template-IDs, die `mission_engine`
  nacheinander an den Spieler ausgibt, bis die Kette abgearbeitet ist

`story_engine.sync_unlocks()` prüft bei jedem Story-Abruf, ob neue Kapitel
anhand der aktuellen XP freigeschaltet werden können, und aktualisiert
`StoryProgress.current_chapter_id` entsprechend. Das Frontend erkennt einen
Kapitelwechsel (`WorldScene.checkStory`) und zeigt automatisch den neuen
Story-Dialog.

Wie im Konzept gefordert ("Story Agent"), ist das Datenschema absichtlich
simpel gehalten (id, unlock_xp, intro, cliffhanger, mission_chain), damit ein
späterer LLM-Agent eigene Kapitel im selben Format generieren kann, ohne
Code-Änderungen im Frontend zu benötigen.

## Nicht implementiert (siehe ROADMAP.md für den Plan)

- Echter OSM/PostGIS-Import (Pipeline dokumentiert, aber nicht ausführbar in
  dieser Sandbox mangels Netzwerkzugriff auf overpass-api.de/geofabrik.de)
- KI-Verkehr (NPC-Fahrzeuge mit eigenem Routing)
- NPC-Tagesabläufe
- Multiplayer (Colyseus-Server für Live-Positionen mehrerer Spieler)
- Vektor-DB-gestützte NPC-Erinnerungen / LLM-generierte Freitext-Missionen
  (aktuell werden Missionstexte aus Vorlagen zusammengesetzt, siehe
  `mission_engine.FREE_MISSION_TEMPLATES`)
