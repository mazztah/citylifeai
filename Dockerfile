# =============================================================================
# CityLife AI – automatischer OSM-Fetch im Docker/Fly-Build
#
# Stage osm-data:   echte OpenStreetMap-Daten von Overpass laden
# Stage frontend:   GeoJSON einbetten + Vite-Build
# Stage runtime:    FastAPI + statisches Frontend
#
# Deploy:  fly deploy --no-cache
# Lokal:   docker build -t citylife .
# =============================================================================

# ----- Stage 0: OSM von Overpass (Netzwerk im Builder noetig) -----
FROM python:3.12-slim AS osm-data
WORKDIR /osm
RUN mkdir -p app/tools && touch app/__init__.py app/tools/__init__.py
COPY backend/app/tools/osm_import.py app/tools/osm_import.py

RUN python -m app.tools.osm_import import-bbox \
      --south 52.358 --west 9.725 --north 52.390 --east 9.765 \
      --origin-lat 52.3759 --origin-lon 9.7392 \
      --timeout 300 \
      --out /osm/hannover_center.geojson \
    || echo "OSM import-bbox exit non-zero"

RUN python - <<'PY'
import json, pathlib
p = pathlib.Path("/osm/hannover_center.geojson")
fallback = {
    "meta": {"source": "fetch-failed", "road_count": 0},
    "roads": {"type": "FeatureCollection", "features": []},
    "pois": {"type": "FeatureCollection", "features": []},
    "buildings": {"type": "FeatureCollection", "features": []},
    "areas": {"type": "FeatureCollection", "features": []},
}
ok = False
meta = {}
if p.exists():
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
        meta = d.get("meta") or {}
        ok = meta.get("source") == "openstreetmap" and int(meta.get("road_count") or 0) > 20
    except Exception as e:
        print("parse error:", e)
        p.write_text(json.dumps(fallback), encoding="utf-8")
else:
    p.write_text(json.dumps(fallback), encoding="utf-8")

pathlib.Path("/osm/status.txt").write_text("ok" if ok else "fail", encoding="utf-8")
print("=" * 60)
print("OSM BUILD STATUS:", "OK" if ok else "FAIL")
print("meta:", meta)
print("=" * 60)
if not ok:
    print("WARN: Overpass-Fetch fehlgeschlagen – Frontend behaelt Fallback-GeoJSON.")
    print("      Erneut versuchen: fly deploy --no-cache")
PY

# ----- Stage 1: Frontend bauen -----
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .

COPY --from=osm-data /osm/hannover_center.geojson /tmp/hannover_center.geojson
COPY --from=osm-data /osm/status.txt /tmp/osm_status.txt

RUN if grep -qx ok /tmp/osm_status.txt; then \
      cp /tmp/hannover_center.geojson src/data/hannover_center.geojson && \
      echo ">>> Echtes OSM-GeoJSON in Frontend eingebunden"; \
    else \
      echo ">>> OSM-Fetch FAIL – nutze committed Fallback unter src/data/"; \
    fi

ENV VITE_API_URL=
RUN npm run build

# ----- Stage 2: Runtime -----
FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY telegram-bot/requirements.txt ./telegram-bot/
RUN pip install --no-cache-dir -r telegram-bot/requirements.txt

COPY . .
COPY --from=frontend-builder /app/frontend/dist ./static

COPY --from=osm-data /osm/hannover_center.geojson ./data/hannover_center.geojson
COPY --from=osm-data /osm/status.txt ./data/osm_status.txt

EXPOSE 8000
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
