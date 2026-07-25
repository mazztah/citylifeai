import { lonLatToWorld } from "../config";
// Vite behandelt .geojson nicht automatisch als JSON-Modul -> als Rohtext laden und parsen.
import geojsonRaw from "../data/hannover_center.geojson?raw";

const geojson = JSON.parse(geojsonRaw);

export interface RoadSegment {
  name: string;
  kind: string;
  points: { x: number; y: number }[];
}

export interface PoiPoint {
  name: string;
  category: string;
  x: number;
  y: number;
  lat: number;
  lon: number;
}

/**
 * Lädt das (aktuell handkuratierte, siehe README) Straßen-/POI-GeoJSON und
 * rechnet alle Koordinaten einmalig in Pixel-Weltkoordinaten um. Für einen
 * echten OSM-Import würde nur diese Datei ausgetauscht - der Rest der Klasse
 * bleibt identisch (siehe backend/app/tools/osm_import.py für das Zielschema).
 */
export class RoadGraph {
  roads: RoadSegment[] = [];
  pois: PoiPoint[] = [];

  constructor() {
    const data = geojson as any;

    for (const feature of data.roads.features) {
      const points = feature.geometry.coordinates.map(([lon, lat]: [number, number]) =>
        lonLatToWorld(lon, lat)
      );
      this.roads.push({
        name: feature.properties.name,
        kind: feature.properties.kind,
        points,
      });
    }

    for (const feature of data.pois.features) {
      const [lon, lat] = feature.geometry.coordinates;
      const { x, y } = lonLatToWorld(lon, lat);
      this.pois.push({ name: feature.properties.name, category: feature.properties.category, x, y, lat, lon });
    }
  }

  /** Nächster Punkt auf irgendeiner Straße zu einer Weltposition - simple
   * "bleib in der Nähe der Straße"-Hilfe, kein echtes Pathfinding (Ausbaustufe: siehe ROADMAP). */
  nearestRoadPoint(x: number, y: number): { x: number; y: number; distance: number } {
    let best = { x, y, distance: Infinity };
    for (const road of this.roads) {
      for (const p of road.points) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < best.distance) best = { x: p.x, y: p.y, distance: d };
      }
    }
    return best;
  }

  findPoiByLatLon(lat: number, lon: number): PoiPoint | undefined {
    return this.pois.find((p) => Math.abs(p.lat - lat) < 1e-4 && Math.abs(p.lon - lon) < 1e-4);
  }
}
