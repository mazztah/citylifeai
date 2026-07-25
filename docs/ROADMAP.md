# CityLife AI - Roadmap

Status dieses Repos: **Phase 1 (Engine-Kern) + Teile von Phase 3 (Story/Missionen)
sind funktionsfähig implementiert.** Die folgenden Phasen bauen direkt darauf auf,
ohne die bestehende Architektur zu brechen.

## Phase 1 - Engine ✅ (Kern vorhanden)
- [x] Kartenimport-Schema (GeoJSON roads/pois) definiert und im Frontend genutzt
- [x] Fahrzeugsteuerung (WASD/Touch, einfache Top-Down-Physik)
- [x] Kamera folgt Spieler
- [ ] Echter OSM/PostGIS-Import statt handkuratiertem GeoJSON
      (`backend/app/tools/osm_import.py` ist vorbereitet, aber nicht ausführbar
      ohne Netzwerkzugriff auf Geofabrik/Overpass)
- [ ] Kollisionserkennung mit Gebäuden/Bordsteinen (aktuell: Auto kann überall fahren)
- [ ] Echtes Chunk-Streaming für große Karten (`ChunkManager.loadChunksAround`
      ist als Stub vorbereitet)

## Phase 2 - Simulation (geplant)
- [ ] KI-Verkehr: NPC-Fahrzeuge, die auf dem Straßengraphen navigieren
      (Straßengraph existiert bereits als `RoadGraph`, fehlt: Pathfinding + eigene
      Fahrzeug-Agenten)
- [ ] NPC-Tagesabläufe (Wohnung → Arbeit → Supermarkt → Wohnung)
- [ ] Tag-/Nachtwechsel und Wetterdarstellung im Frontend (Backend liefert
      `weather`/`season` im CityState bereits, Frontend zeigt es noch nicht visuell an)

## Phase 3 - Gameplay 🔶 (teilweise vorhanden)
- [x] Missions-Engine (Story- und freie Missionen)
- [x] Story-Engine mit Kapitel-Freischaltung
- [ ] Vollständiges Immobiliensystem (Kauf/Verkauf/Sanierung als Spieleraktion -
      `PropertyOwnership`-Modell existiert bereits, aber noch keine Kauf-API/UI)
- [ ] Berufe/Jobs als eigene Spielmechanik (aktuell nur über Missionskategorien
      abgebildet)

## Phase 4 - Online (geplant)
- [ ] Multiplayer (z.B. Colyseus) für gleichzeitig sichtbare Spieler in derselben Stadt
- [ ] Gilden/Unternehmen (Taxiunternehmen, Bauunternehmen als Spielergruppen)
- [ ] Live-Events, die mehrere Spieler gleichzeitig betreffen
- [ ] Echte Ranglisten-Season-Mechanik (aktuell: einfache XP-Sortierung ohne Zeitfenster)

## Phase 5 - KI (geplant)
- [ ] Mission Agent: LLM ersetzt/ergänzt `FREE_MISSION_TEMPLATES` durch dynamisch
      generierte Freitext-Missionen (Schnittstelle ist bereits so geschnitten,
      dass das ohne Breaking Change möglich ist - `mission_engine.generate_free_mission`
      müsste nur die Beschreibung statt aus der Vorlage aus einem LLM-Call beziehen)
- [ ] Story Agent: generiert neue Kapitel im bestehenden JSON-Schema automatisch
- [ ] Citizen Agent: steuert NPC-Bedürfnisse/Stimmung individuell
- [ ] Vektordatenbank (Qdrant/pgvector) für NPC-Erinnerungen an Spieleraktionen

## Technische Schulden / bekannte Vereinfachungen in diesem Scaffold
- Karten-Datenbasis ist handkuratiert, kein echter OSM-Export (siehe README)
- Kein Alembic, `Base.metadata.create_all()` reicht für dieses Scaffold, aber
  nicht für produktive Schemamigrationen
- Keine Rate-Limits/Abuse-Schutz auf der API (z.B. Mission-Farming durch schnelles
  Wiederholen von `/missions/{id}/complete` mit manipulierten IDs ist aktuell nur
  durch den `status != "active"`-Check in `mission_engine.complete_mission`
  eingeschränkt, nicht durch serverseitige Positionsprüfung - für Produktivbetrieb
  sollte der Server die Spielerposition mitprüfen, nicht nur der Client)
- Kein automatisches Reconnect-/Offline-Handling im Frontend
