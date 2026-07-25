"""
Echter OpenStreetMap-Importer für CityLife AI.

Zielschema (frontend/src/data/hannover_center.geojson):
{
  "meta": { "note", "origin_lat", "origin_lon", "source", "road_count", ... },
  "roads":     { "type": "FeatureCollection", "features": [ LineString + {name, kind} ] },
  "pois":      { "type": "FeatureCollection", "features": [ Point + {name, category} ] },
  "buildings": { "type": "FeatureCollection", "features": [ Polygon + {id, kind} ] },
  "areas":     { "type": "FeatureCollection", "features": [ Polygon + {name, category} ] }
}

Nutzung:

  python -m app.tools.osm_import fetch \\
      --south 52.358 --west 9.725 --north 52.390 --east 9.765 \\
      --out /tmp/hannover_overpass.json

  python -m app.tools.osm_import convert \\
      --input /tmp/hannover_overpass.json \\
      --out ../frontend/src/data/hannover_center.geojson

Oder alles in einem Schritt:

  python -m app.tools.osm_import import-bbox \\
      --south 52.358 --west 9.725 --north 52.390 --east 9.765 \\
      --out ../frontend/src/data/hannover_center.geojson
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

# Freiflächen, die befahrbar sein sollen (Parks, Plätze, Parkplätze)
AREA_TAGS = {
    ("leisure", "park"): "park",
    ("leisure", "garden"): "park",
    ("landuse", "recreation_ground"): "park",
    ("landuse", "grass"): "park",
    ("leisure", "pitch"): "park",
    ("place", "square"): "plaza",
    ("highway", "pedestrian"): "plaza",  # Fußgängerzone als Fläche (wenn Polygon)
    ("amenity", "parking"): "parking",
    ("landuse", "plaza"): "plaza",
}


def overpass_query(
    south: float, west: float, north: float, east: float, timeout: int = 120
) -> str:
    """Straßen + POIs + Gebäude + Freiflächen für eine Bounding-Box."""
    return f"""
[out:json][timeout:{timeout}];
(
  // befahrbare Straßen
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|service|pedestrian)$"]
    ({south},{west},{north},{east});
  // Gebäude
  way["building"]({south},{west},{north},{east});
  // Parks / Plätze / Parkplätze als Flächen
  way["leisure"~"^(park|garden|pitch)$"]({south},{west},{north},{east});
  way["landuse"~"^(recreation_ground|grass)$"]({south},{west},{north},{east});
  way["place"="square"]({south},{west},{north},{east});
  way["amenity"="parking"]({south},{west},{north},{east});
  way["highway"="pedestrian"]["area"="yes"]({south},{west},{north},{east});
);
out geom;
(
  node["amenity"~"^(cafe|restaurant|fuel|hospital|clinic|pharmacy|bank|parking|school|university|theatre|cinema|bar|pub)$"]
    ({south},{west},{north},{east});
  node["shop"~"^(supermarket|convenience|mall|clothes)$"]
    ({south},{west},{north},{east});
  node["railway"="station"]({south},{west},{north},{east});
  node["tourism"~"^(attraction|museum|viewpoint)$"]
    ({south},{west},{north},{east});
  node["leisure"="park"]({south},{west},{north},{east});
);
out body;
"""


ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def fetch_overpass(
    south: float,
    west: float,
    north: float,
    east: float,
    endpoint: str | None = None,
    timeout: int = 180,
) -> dict[str, Any]:
    query = overpass_query(south, west, north, east, timeout=max(30, timeout - 20))
    endpoints = [endpoint] if endpoint else ENDPOINTS
    last_err: Exception | None = None
    body = urllib.parse.urlencode({"data": query}).encode("utf-8")
    for ep in endpoints:
        if not ep:
            continue
        for attempt in range(1, 4):
            req = urllib.request.Request(
                ep,
                data=body,
                method="POST",
                headers={
                    "User-Agent": "CityLifeAI/0.2 (educational; docker-build)",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            try:
                print(f"  Overpass: {ep} (Versuch {attempt}/3) …", file=sys.stderr)
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                n = len(data.get("elements", []))
                print(f"  → {n} Elemente", file=sys.stderr)
                if n == 0:
                    raise RuntimeError("leere Antwort")
                return data
            except Exception as exc:  # noqa: BLE001
                last_err = exc
                print(f"  fehlgeschlagen: {exc}", file=sys.stderr)
                import time
                time.sleep(2 * attempt)
    raise RuntimeError(f"Alle Overpass-Endpoints fehlgeschlagen: {last_err}")


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


def _area_category(tags: dict) -> str | None:
    for (k, v), cat in AREA_TAGS.items():
        if tags.get(k) == v:
            return cat
    if tags.get("highway") == "pedestrian" and tags.get("area") == "yes":
        return "plaza"
    return None


def _ring_from_geometry(geom: list[dict]) -> list[list[float]] | None:
    if not geom or len(geom) < 3:
        return None
    coords = [[p["lon"], p["lat"]] for p in geom]
    # Ring schließen
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    if len(coords) < 4:
        return None
    return coords


def convert_overpass_to_game_geojson(
    overpass: dict[str, Any],
    origin_lat: float = 52.3759,
    origin_lon: float = 9.7392,
    min_road_points: int = 2,
    max_buildings: int = 2500,
) -> dict[str, Any]:
    roads_features: list[dict] = []
    pois_features: list[dict] = []
    buildings_features: list[dict] = []
    areas_features: list[dict] = []
    seen_poi: set[str] = set()
    building_count = 0

    for el in overpass.get("elements", []):
        tags = el.get("tags") or {}
        etype = el.get("type")

        if etype == "way" and "geometry" in el:
            geom = el["geometry"]

            # 1) Straße?
            kind = _kind_from_tags(tags)
            if kind is not None and "building" not in tags:
                if len(geom) >= min_road_points:
                    coords = [[p["lon"], p["lat"]] for p in geom]
                    name = tags.get("name") or tags.get("ref") or f"way/{el.get('id', '?')}"
                    roads_features.append(
                        {
                            "type": "Feature",
                            "properties": {
                                "name": name,
                                "kind": kind,
                                "osm_id": el.get("id"),
                            },
                            "geometry": {"type": "LineString", "coordinates": coords},
                        }
                    )
                # Fußgängerzone als Fläche zusätzlich, wenn area=yes
                if tags.get("highway") == "pedestrian" and tags.get("area") == "yes":
                    ring = _ring_from_geometry(geom)
                    if ring:
                        areas_features.append(
                            {
                                "type": "Feature",
                                "properties": {
                                    "name": tags.get("name") or "Fußgängerzone",
                                    "category": "plaza",
                                    "osm_id": el.get("id"),
                                },
                                "geometry": {"type": "Polygon", "coordinates": [ring]},
                            }
                        )
                continue

            # 2) Gebäude?
            if "building" in tags and building_count < max_buildings:
                ring = _ring_from_geometry(geom)
                if ring:
                    buildings_features.append(
                        {
                            "type": "Feature",
                            "properties": {
                                "id": f"osm_{el.get('id')}",
                                "kind": "building",
                                "name": tags.get("name") or tags.get("building"),
                                "osm_id": el.get("id"),
                            },
                            "geometry": {"type": "Polygon", "coordinates": [ring]},
                        }
                    )
                    building_count += 1
                continue

            # 3) Freifläche?
            acat = _area_category(tags)
            if acat:
                ring = _ring_from_geometry(geom)
                if ring:
                    areas_features.append(
                        {
                            "type": "Feature",
                            "properties": {
                                "name": tags.get("name") or acat,
                                "category": acat,
                                "osm_id": el.get("id"),
                            },
                            "geometry": {"type": "Polygon", "coordinates": [ring]},
                        }
                    )
                continue

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
                    "properties": {
                        "name": name,
                        "category": cat,
                        "osm_id": el.get("id"),
                    },
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
            "building_count": len(buildings_features),
            "area_count": len(areas_features),
        },
        "roads": {"type": "FeatureCollection", "features": roads_features},
        "pois": {"type": "FeatureCollection", "features": pois_features},
        "buildings": {"type": "FeatureCollection", "features": buildings_features},
        "areas": {"type": "FeatureCollection", "features": areas_features},
    }


def export_chunk_geojson(
    overpass_or_geojson_path: Path,
    out_path: Path,
    origin_lat: float = 52.3759,
    origin_lon: float = 9.7392,
) -> dict[str, Any]:
    data = json.loads(overpass_or_geojson_path.read_text(encoding="utf-8"))
    if "roads" in data and "pois" in data and data.get("meta", {}).get("source") in (
        "openstreetmap",
        "openstreetmap-aligned",
    ):
        # bereits Spiel-GeoJSON – ggf. fehlende buildings/areas ergänzen
        data.setdefault("buildings", {"type": "FeatureCollection", "features": []})
        data.setdefault("areas", {"type": "FeatureCollection", "features": []})
        out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Kopiert (bereits Spiel-Format): {out_path}", file=sys.stderr)
        return data

    game = convert_overpass_to_game_geojson(
        data, origin_lat=origin_lat, origin_lon=origin_lon
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(game, ensure_ascii=False, indent=2), encoding="utf-8")
    m = game["meta"]
    print(
        f"Geschrieben: {out_path}\n"
        f"  Straßen: {m['road_count']}  POIs: {m['poi_count']}  "
        f"Gebäude: {m['building_count']}  Flächen: {m['area_count']}",
        file=sys.stderr,
    )
    return game


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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CityLife AI OSM Import")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_fetch = sub.add_parser("fetch", help="Overpass-JSON für Bounding-Box laden")
    p_fetch.add_argument("--south", type=float, default=52.358)
    p_fetch.add_argument("--west", type=float, default=9.725)
    p_fetch.add_argument("--north", type=float, default=52.390)
    p_fetch.add_argument("--east", type=float, default=9.765)
    p_fetch.add_argument("--out", type=Path, required=True)
    p_fetch.add_argument("--endpoint", default=None)
    p_fetch.add_argument("--timeout", type=int, default=180)

    p_conv = sub.add_parser("convert", help="Overpass-JSON → Spiel-GeoJSON")
    p_conv.add_argument("--input", type=Path, required=True)
    p_conv.add_argument("--out", type=Path, required=True)
    p_conv.add_argument("--origin-lat", type=float, default=52.3759)
    p_conv.add_argument("--origin-lon", type=float, default=9.7392)

    p_all = sub.add_parser("import-bbox", help="Fetch + Convert in einem Schritt")
    p_all.add_argument("--south", type=float, default=52.358)
    p_all.add_argument("--west", type=float, default=9.725)
    p_all.add_argument("--north", type=float, default=52.390)
    p_all.add_argument("--east", type=float, default=9.765)
    p_all.add_argument("--out", type=Path, required=True)
    p_all.add_argument("--endpoint", default=None)
    p_all.add_argument("--timeout", type=int, default=180)
    p_all.add_argument("--origin-lat", type=float, default=52.3759)
    p_all.add_argument("--origin-lon", type=float, default=9.7392)
    p_all.add_argument("--cache", type=Path, default=None, help="Overpass-JSON zwischenspeichern")

    p_pbf = sub.add_parser("from-pbf", help="osmium extract (nur Ausschnitt, kein Spiel-GeoJSON)")
    p_pbf.add_argument("--pbf", type=Path, required=True)
    p_pbf.add_argument("--bbox", type=str, required=True, help="west,south,east,north")
    p_pbf.add_argument("--out", type=Path, required=True)

    args = parser.parse_args(argv)

    if args.cmd == "fetch":
        print(
            f"Lade Overpass ({args.south},{args.west} → {args.north},{args.east}) …",
            file=sys.stderr,
        )
        data = fetch_overpass(
            args.south, args.west, args.north, args.east,
            endpoint=args.endpoint, timeout=args.timeout,
        )
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        print(f"Gespeichert: {args.out} ({len(data.get('elements', []))} Elemente)", file=sys.stderr)
        return 0

    if args.cmd == "convert":
        export_chunk_geojson(args.input, args.out, args.origin_lat, args.origin_lon)
        return 0

    if args.cmd == "import-bbox":
        print(
            f"Import bbox ({args.south},{args.west} → {args.north},{args.east}) …",
            file=sys.stderr,
        )
        data = fetch_overpass(
            args.south, args.west, args.north, args.east,
            endpoint=args.endpoint, timeout=args.timeout,
        )
        if args.cache:
            args.cache.parent.mkdir(parents=True, exist_ok=True)
            args.cache.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            print(f"Cache: {args.cache}", file=sys.stderr)
        game = convert_overpass_to_game_geojson(
            data, origin_lat=args.origin_lat, origin_lon=args.origin_lon
        )
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(game, ensure_ascii=False, indent=2), encoding="utf-8")
        m = game["meta"]
        print(
            f"Fertig: {args.out}\n"
            f"  Straßen: {m['road_count']}  POIs: {m['poi_count']}  "
            f"Gebäude: {m['building_count']}  Flächen: {m['area_count']}",
            file=sys.stderr,
        )
        return 0

    if args.cmd == "from-pbf":
        parts = [float(x) for x in args.bbox.split(",")]
        if len(parts) != 4:
            print("bbox muss west,south,east,north sein", file=sys.stderr)
            return 1
        west, south, east, north = parts
        extract_city(args.pbf, (west, south, east, north), args.out)
        print(f"Ausschnitt: {args.out}", file=sys.stderr)
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
