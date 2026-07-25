#!/usr/bin/env bash
# Holt echte OpenStreetMap-Daten für Hannover-Zentrum (Straßen, POIs, Gebäude, Parks)
# und schreibt frontend/src/data/hannover_center.geojson.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GEOJSON="${ROOT}/frontend/src/data/hannover_center.geojson"
CACHE="${1:-/tmp/hannover_overpass.json}"

echo "==> Echter OSM-Import (Hannover-Zentrum)"
echo "    Ziel: $GEOJSON"

cd "$ROOT/backend"

# Ein-Schritt: fetch + convert (Gebäude + Flächen inklusive)
python -m app.tools.osm_import import-bbox \
  --south 52.358 --west 9.725 --north 52.390 --east 9.765 \
  --origin-lat 52.3759 --origin-lon 9.7392 \
  --cache "$CACHE" \
  --out "$GEOJSON" \
  --timeout 180

echo ""
echo "Fertig. Frontend neu starten/bauen:"
echo "  cd frontend && npm run dev"
echo "Attribution: © OpenStreetMap contributors (ODbL)"
