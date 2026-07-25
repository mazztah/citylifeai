#!/usr/bin/env bash
# Holt echte OpenStreetMap-Daten für Hannover-Zentrum und schreibt das Spiel-GeoJSON.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_JSON="${1:-/tmp/hannover_overpass.json}"
GEOJSON="${ROOT}/frontend/src/data/hannover_center.geojson"

echo "==> Overpass fetch (Hannover center bbox)…"
cd "$ROOT/backend"
python -m app.tools.osm_import fetch \
  --south 52.358 --west 9.725 --north 52.390 --east 9.765 \
  --out "$OUT_JSON" \
  || python -m app.tools.osm_import fetch \
       --south 52.358 --west 9.725 --north 52.390 --east 9.765 \
       --endpoint "https://maps.mail.ru/osm/tools/overpass/api/interpreter" \
       --out "$OUT_JSON"

echo "==> Convert → $GEOJSON"
python -m app.tools.osm_import convert --input "$OUT_JSON" --out "$GEOJSON"
echo "Fertig. Frontend neu bauen/starten, damit die neue Karte geladen wird."
