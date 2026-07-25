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

export interface PolyArea {
  id: string;
  name: string;
  category: string;
  points: { x: number; y: number }[];
}

/**
 * Lädt OSM-basierte Straßen/POIs sowie Gebäude- und Flächenpolygone.
 * Alle Koordinaten werden einmalig in Web-Mercator-Weltpixel umgerechnet
 * (identisch zu MapTiles) – dadurch liegen Vektorstraßen und Rasterkacheln
 * im selben Raum.
 */
export class RoadGraph {
  roads: RoadSegment[] = [];
  pois: PoiPoint[] = [];
  buildings: PolyArea[] = [];
  areas: PolyArea[] = [];

  constructor() {
    const data = geojson as any;

    for (const feature of data.roads?.features ?? []) {
      const points = feature.geometry.coordinates.map(([lon, lat]: [number, number]) =>
        lonLatToWorld(lon, lat)
      );
      this.roads.push({
        name: feature.properties.name,
        kind: feature.properties.kind,
        points,
      });
    }

    for (const feature of data.pois?.features ?? []) {
      const [lon, lat] = feature.geometry.coordinates;
      const { x, y } = lonLatToWorld(lon, lat);
      this.pois.push({
        name: feature.properties.name,
        category: feature.properties.category,
        x,
        y,
        lat,
        lon,
      });
    }

    for (const feature of data.buildings?.features ?? []) {
      const ring = feature.geometry.coordinates[0] as [number, number][];
      this.buildings.push({
        id: String(feature.properties?.id ?? ""),
        name: feature.properties?.name ?? "Gebäude",
        category: "building",
        points: ring.map(([lon, lat]) => lonLatToWorld(lon, lat)),
      });
    }

    for (const feature of data.areas?.features ?? []) {
      const ring = feature.geometry.coordinates[0] as [number, number][];
      this.areas.push({
        id: String(feature.properties?.id ?? feature.properties?.name ?? ""),
        name: feature.properties?.name ?? "Fläche",
        category: feature.properties?.category ?? "plaza",
        points: ring.map(([lon, lat]) => lonLatToWorld(lon, lat)),
      });
    }
  }

  /** Nächster Punkt auf irgendeiner Straße – für Spawn/Debug, kein Pathfinding. */
  nearestRoadPoint(x: number, y: number): { x: number; y: number; distance: number } {
    let best = { x, y, distance: Infinity };
    for (const road of this.roads) {
      for (let i = 0; i < road.points.length - 1; i++) {
        const a = road.points[i];
        const b = road.points[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len2 = dx * dx + dy * dy || 1;
        let t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = a.x + t * dx;
        const py = a.y + t * dy;
        const d = Math.hypot(px - x, py - y);
        if (d < best.distance) best = { x: px, y: py, distance: d };
      }
    }
    return best;
  }

  findPoiByLatLon(lat: number, lon: number): PoiPoint | undefined {
    return this.pois.find((p) => Math.abs(p.lat - lat) < 1e-4 && Math.abs(p.lon - lon) < 1e-4);
  }
}
