"""
Echter OpenStreetMap-Importer für CityLife AI.

Zielschema (identisch zu frontend/src/data/hannover_center.geojson):
{
  "meta": { "note": "...", "origin_lat": ..., "origin_lon": ..., "source": "osm" },
  "roads": { "type": "FeatureCollection", "features": [ LineString + {name, kind} ] },
  "pois":  { "type": "FeatureCollection", "features": [ Point + {name, category} ] }
}

Nutzung (mit Netzwerk):

  # 1) Overpass-JSON für Hannover-Zentrum holen
  python -m backend.app.tools.osm_import fetch \\
      --south 52.358 --west 9.725 --north 52.390 --east 9.765 \\
      --out /tmp/hannover_overpass.json

  # 2) In Spiel-GeoJSON konvertieren
  python -m backend.app.tools.osm_import convert \\
      --input /tmp/hannover_overpass.json \\
      --out frontend/src/data/hannover_center.geojson

  # Optional: Geofabrik-PBF-Pfad (wenn osmium installiert)
  python -m backend.app.tools.osm_import from-pbf \\
      --pbf niedersachsen-latest.osm.pbf \\
      --bbox 9.725,52.358,9.765,52.390 \\
      --out frontend/src/data/hannover_center.geojson

Die Frontend-Klasse RoadGraph lädt genau dieses Schema – kein weiterer Code-Change nötig.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

HIGHWAY_KIND: dict[str, str] = {
    "motorway": "primary",
    "motorway_link": "primary",
    "trunk": "primary",
    "trunk_link": "primary",
    "primary": "primary",
    "primary_link": "primary",
    "secondary": "secondary",
    "secondary_link": "secondary",
    "tertiary": "secondary",
    "tertiary_link": "secondary",
    "residential": "tertiary",
    "unclassified": "tertiary",
    "living_street": "tertiary",
    "service": "tertiary",
    "pedestrian": "tertiary",
}

POI_CATEGORY: dict[str, str] = {
    "cafe": "cafe",
    "restaurant": "cafe",
    "fast_food": "cafe",
    "fuel": "fuel",
    "charging_station": "fuel",
    "hospital": "hospital",
    "clinic": "hospital",
    "pharmacy": "shop",
    "supermarket": "shop",
    "convenience": "shop",
    "mall": "shopping",
    "department_store": "shopping",
    "clothes": "shopping",
    "bank": "shop",
    "parking": "transit",
    "bus_station": "transit",
    "school": "landmark",
    "university": "landmark",
    "theatre": "landmark",
    "cinema": "nightlife",
    "bar": "nightlife",
    "pub": "nightlife",
    "attraction": "landmark",
    "museum": "landmark",
    "viewpoint": "landmark",
    "park": "park",
}

DRIVABLE = {
    "motorway", "motorway_link", "trunk", "trunk_link",
    "primary", "primary_link", "secondary", "secondary_link",
    "tertiary", "tertiary_link", "residential", "unclassified",
    "living_street", "service",
}


def overpass_query_roads_and_pois(
    south: float, west: float, north: float, east: float, timeout: int = 90
) -> str:
    return f"""
[out:json][timeout:{timeout}];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|service)$"]
    ({south},{west},{north},{east});
);
out geom;
node["amenity"~"^(cafe|restaurant|fuel|hospital|clinic|pharmacy|bank|parking|school|university|theatre|cinema|bar|pub)$"]
  ({south},{west},{north},{east});
node["shop"~"^(supermarket|convenience|mall|clothes)$"]
  ({south},{west},{north},{east});
node["railway"="station"]({south},{west},{north},{east});
node["tourism"~"^(attraction|museum|viewpoint)$"]({south},{west},{north},{east});
node["leisure"="park"]({south},{west},{north},{east});
out body;
"""


def fetch_overpass(
    south: float,
    west: float,
    north: float,
    east: float,
    endpoint: str = "https://overpass-api.de/api/interpreter",
    timeout: int = 120,
) -> dict[str, Any]:
    query = overpass_query_roads_and_pois(south, west, north, east, timeout=timeout - 10)
    url = f"{endpoint}?data={urllib.parse.quote(query)}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "CityLifeAI/0.1 (educational)"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _kind_from_tags(tags: dict) -> str | None:
    hw = tags.get("highway")
    if not hw:
        return None
    if hw not in DRIVABLE and hw not in ("pedestrian",):
        return None
    return HIGHWAY_KIND.get(hw, "tertiary")


def _category_from_tags(tags: dict) -> str | None:
    for key in ("amenity", "shop", "tourism", "leisure", "railway"):
        val = tags.get(key)
        if not val:
            continue
        if key == "railway" and val == "station":
            return "transit"
        cat = POI_CATEGORY.get(val)
        if cat:
            return cat
    return None


def convert_overpass_to_game_geojson(
    overpass: dict[str, Any],
    origin_lat: float = 52.3759,
    origin_lon: float = 9.7320,
    min_road_points: int = 2,
) -> dict[str, Any]:
    roads_features: list[dict] = []
    pois_features: list[dict] = []
    seen_poi: set[str] = set()

    for el in overpass.get("elements", []):
        tags = el.get("tags") or {}
        etype = el.get("type")

        if etype == "way" and "geometry" in el:
            kind = _kind_from_tags(tags)
            if kind is None:
                continue
            geom = el["geometry"]
            if len(geom) < min_road_points:
                continue
            coords = [[p["lon"], p["lat"]] for p in geom]
            name = tags.get("name") or tags.get("ref") or f"way/{el.get('id', '?')}"
            roads_features.append(
                {
                    "type": "Feature",
                    "properties": {"name": name, "kind": kind, "osm_id": el.get("id")},
                    "geometry": {"type": "LineString", "coordinates": coords},
                }
            )

        elif etype == "node":
            cat = _category_from_tags(tags)
            if cat is None:
                continue
            name = tags.get("name") or tags.get("brand") or cat
            key = f"{name}|{round(el.get('lat', 0), 4)}|{round(el.get('lon', 0), 4)}"
            if key in seen_poi:
                continue
            seen_poi.add(key)
            pois_features.append(
                {
                    "type": "Feature",
                    "properties": {"name": name, "category": cat, "osm_id": el.get("id")},
                    "geometry": {
                        "type": "Point",
                        "coordinates": [el["lon"], el["lat"]],
                    },
                }
            )

    return {
        "meta": {
            "note": "Echter OpenStreetMap-Export (ODbL). Generiert von backend.app.tools.osm_import.",
            "origin_lat": origin_lat,
            "origin_lon": origin_lon,
            "source": "openstreetmap",
            "road_count": len(roads_features),
            "poi_count": len(pois_features),
        },
        "roads": {"type": "FeatureCollection", "features": roads_features},
        "pois": {"type": "FeatureCollection", "features": pois_features},
    }


def extract_city(pbf_path: Path, bbox: tuple[float, float, float, float], out_path: Path) -> None:
    import shutil
    import subprocess

    if not shutil.which("osmium"):
        raise RuntimeError(
            "osmium nicht gefunden. Installiere osmium-tool "
            "(https://osmcode.org/osmium-tool/)."
        )
    west, south, east, north = bbox
    cmd = [
        "osmium", "extract",
        "-b", f"{west},{south},{east},{north}",
        str(pbf_path), "-o", str(out_path), "--overwrite",
    ]
    subprocess.check_call(cmd)


def import_to_postgis(osm_pbf_path: Path, dsn: str) -> None:
    import shutil
    import subprocess

    if not shutil.which("ogr2ogr"):
        raise RuntimeError("ogr2ogr (GDAL) nicht gefunden.")
    for layer, table in (("lines", "osm_roads"), ("multipolygons", "osm_buildings"), ("points", "osm_pois")):
        cmd = [
            "ogr2ogr", "-f", "PostgreSQL", f"PG:{dsn}",
            str(osm_pbf_path), layer, "-nln", table, "-overwrite",
            "-lco", "GEOMETRY_NAME=geom",
        ]
        try:
            subprocess.check_call(cmd)
        except subprocess.CalledProcessError as exc:
            print(f"Warnung: Layer {layer}: {exc}", file=sys.stderr)


def export_chunk_geojson(
    overpass_or_geojson_path: Path,
    out_path: Path,
    origin_lat: float = 52.3759,
    origin_lon: float = 9.7320,
) -> None:
    data = json.loads(overpass_or_geojson_path.read_text(encoding="utf-8"))
    if "roads" in data and "pois" in data:
        out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return
    game = convert_overpass_to_game_geojson(data, origin_lat=origin_lat, origin_lon=origin_lon)
    out_path.write_text(json.dumps(game, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"Geschrieben: {out_path} "
        f"({game['meta']['road_count']} Straßen, {game['meta']['poi_count']} POIs)"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CityLife AI OSM Import")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_fetch = sub.add_parser("fetch", help="Overpass-JSON für Bounding-Box laden")
    p_fetch.add_argument("--south", type=float, default=52.358)
    p_fetch.add_argument("--west", type=float, default=9.725)
    p_fetch.add_argument("--north", type=float, default=52.390)
    p_fetch.add_argument("--east", type=float, default=9.765)
    p_fetch.add_argument("--out", type=Path, required=True)
    p_fetch.add_argument(
        "--endpoint",
        default="https://overpass-api.de/api/interpreter",
    )

    p_conv = sub.add_parser("convert", help="Overpass-JSON → Spiel-GeoJSON")
    p_conv.add_argument("--input", type=Path, required=True)
    p_conv.add_argument("--out", type=Path, required=True)
    p_conv.add_argument("--origin-lat", type=float, default=52.3759)
    p_conv.add_argument("--origin-lon", type=float, default=9.7320)

    p_pbf = sub.add_parser("from-pbf", help="osmium extract")
    p_pbf.add_argument("--pbf", type=Path, required=True)
    p_pbf.add_argument("--bbox", type=str, required=True, help="west,south,east,north")
    p_pbf.add_argument("--out", type=Path, required=True)

    args = parser.parse_args(argv)

    if args.cmd == "fetch":
        print(f"Lade Overpass-Daten ({args.south},{args.west},{args.north},{args.east}) …")
        try:
            data = fetch_overpass(
                args.south, args.west, args.north, args.east, endpoint=args.endpoint
            )
        except Exception as exc:
            print(f"Primärer Endpoint fehlgeschlagen ({exc}), versuche Mirror …", file=sys.stderr)
            data = fetch_overpass(
                args.south, args.west, args.north, args.east,
                endpoint="https://maps.mail.ru/osm/tools/overpass/api/interpreter",
            )
        args.out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        print(f"Gespeichert: {args.out} ({len(data.get('elements', []))} Elemente)")
        return 0

    if args.cmd == "convert":
        export_chunk_geojson(args.input, args.out, args.origin_lat, args.origin_lon)
        return 0

    if args.cmd == "from-pbf":
        parts = [float(x) for x in args.bbox.split(",")]
        if len(parts) != 4:
            print("bbox muss west,south,east,north sein", file=sys.stderr)
            return 1
        west, south, east, north = parts
        extracted = args.out.with_suffix(".osm.pbf")
        extract_city(args.pbf, (west, south, east, north), extracted)
        print(f"Ausschnitt: {extracted}")
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
