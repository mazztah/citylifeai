"""
Vorbereiteter Importer für ECHTE OpenStreetMap-Daten.

In dieser Entwicklungsumgebung ist kein Netzwerkzugriff auf overpass-api.de /
download.geofabrik.de möglich, daher ist dieses Skript aktuell nicht ausführbar -
es dokumentiert aber exakt, wie der Vollausbau (siehe Konzept-Chat) aussehen würde,
und die Zielstruktur (GeoJSON mit "roads" + "pois" FeatureCollections) ist identisch
zu `frontend/src/data/hannover_center.geojson`, sodass das Frontend unverändert bleibt.

Geplanter Ablauf für den Produktivbetrieb:

1. Regionsextrakt laden (z.B. von Geofabrik):
   wget https://download.geofabrik.de/europe/germany/niedersachsen-latest.osm.pbf

2. Mit osmium auf die Bounding Box von Hannover zuschneiden:
   osmium extract -b 9.60,52.30,9.90,52.45 niedersachsen-latest.osm.pbf -o hannover.osm.pbf

3. Straßen (highway=*) und Gebäude (building=*) sowie POIs (amenity=*, shop=*)
   mit osmium/ogr2ogr nach PostGIS importieren:
   ogr2ogr -f PostgreSQL PG:"dbname=citylife" hannover.osm.pbf lines -nln osm_roads
   ogr2ogr -f PostgreSQL PG:"dbname=citylife" hannover.osm.pbf multipolygons -nln osm_buildings

4. Aus PostGIS einen vereinfachten, gecachten GeoJSON-"Chunk-Export" für den
   Client erzeugen (siehe ChunkManager.ts im Frontend, das genau dieses Format
   erwartet):
   {
     "roads": { "type": "FeatureCollection", "features": [ {LineString, properties: {name, kind}} ] },
     "pois":  { "type": "FeatureCollection", "features": [ {Point, properties: {name, category}} ] }
   }

5. Routing-Graph (Node-zu-Node) aus den Straßen für Navigation/KI-Verkehr aufbauen,
   z.B. mit `networkx` in Python oder direkt mit Valhalla/GraphHopper als externem
   Routing-Service (siehe docs/ARCHITECTURE.md).

Dieses Modul exportiert absichtlich nur Signaturen/TODOs, damit es beim Import
nicht crasht, aber klar zeigt, wo echte OSM-Daten andocken:
"""
from pathlib import Path


def extract_city(pbf_path: Path, bbox: tuple[float, float, float, float], out_path: Path) -> None:
    """TODO: osmium-Aufruf via subprocess, siehe Docstring oben."""
    raise NotImplementedError(
        "Kein Netzwerk-/Binary-Zugriff in dieser Sandbox. In Produktivumgebung: "
        "osmium extract verwenden (siehe Kommentar im Modul-Docstring)."
    )


def import_to_postgis(osm_pbf_path: Path, dsn: str) -> None:
    """TODO: ogr2ogr-Aufrufe via subprocess, siehe Docstring oben."""
    raise NotImplementedError("Siehe Modul-Docstring für den geplanten Ablauf.")


def export_chunk_geojson(dsn: str, bbox: tuple[float, float, float, float], out_path: Path) -> None:
    """TODO: SQL-Query gegen osm_roads/osm_buildings, Ergebnis als GeoJSON schreiben,
    im selben Schema wie frontend/src/data/hannover_center.geojson."""
    raise NotImplementedError("Siehe Modul-Docstring für den geplanten Ablauf.")
