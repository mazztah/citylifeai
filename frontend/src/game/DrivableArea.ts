import type { RoadGraph, RoadSegment, PolyArea } from "./RoadGraph";

/** Halbe Fahrbahnbreite in Weltpixeln (PIXELS_PER_METER ≈ 1.8 → ~8–9 m pro Seite bei primary). */
const HALF_WIDTH: Record<string, number> = {
  primary: 16,
  secondary: 13,
  tertiary: 10,
};

/** Zusätzlicher Rand (Gehweg / leichte Kartenabweichung). */
const SIDEWALK_MARGIN = 8;

/**
 * Befahrbare Fläche: Straßenkorridor + Parks/Plätze, aber keine Gebäude.
 * Gebäude haben Vorrang (blockieren auch wenn sie theoretisch im Straßenkorridor lägen).
 */
export class DrivableArea {
  private roads: RoadSegment[];
  private buildings: PolyArea[];
  private areas: PolyArea[];

  constructor(graph: RoadGraph) {
    this.roads = graph.roads;
    this.buildings = graph.buildings;
    this.areas = graph.areas;
  }

  isDrivable(x: number, y: number): boolean {
    if (this.isInsideAnyBuilding(x, y)) return false;
    if (this.isInsideAnyArea(x, y)) return true;
    const { distance, halfWidth } = this.distanceToNearestRoad(x, y);
    return distance <= halfWidth + SIDEWALK_MARGIN;
  }

  isInsideAnyBuilding(x: number, y: number): boolean {
    for (const b of this.buildings) {
      if (pointInPolygon(x, y, b.points)) return true;
    }
    return false;
  }

  isInsideAnyArea(x: number, y: number): boolean {
    for (const a of this.areas) {
      if (pointInPolygon(x, y, a.points)) return true;
    }
    return false;
  }

  distanceToNearestRoad(x: number, y: number): { distance: number; halfWidth: number } {
    let best = Infinity;
    let bestHalf = HALF_WIDTH.tertiary;
    for (const road of this.roads) {
      const hw = HALF_WIDTH[road.kind] ?? HALF_WIDTH.tertiary;
      for (let i = 0; i < road.points.length - 1; i++) {
        const a = road.points[i];
        const b = road.points[i + 1];
        const d = distPointToSegment(x, y, a.x, a.y, b.x, b.y);
        if (d < best) {
          best = d;
          bestHalf = hw;
        }
      }
    }
    return { distance: best, halfWidth: bestHalf };
  }

  /** Nächster Punkt auf dem Straßennetz (für sanftes Einschnappen beim Spawn). */
  snapToRoad(x: number, y: number): { x: number; y: number } {
    let best = { x, y, d: Infinity };
    for (const road of this.roads) {
      for (let i = 0; i < road.points.length - 1; i++) {
        const a = road.points[i];
        const b = road.points[i + 1];
        const p = closestOnSegment(x, y, a.x, a.y, b.x, b.y);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < best.d) best = { x: p.x, y: p.y, d };
      }
    }
    return { x: best.x, y: best.y };
  }
}

function pointInPolygon(x: number, y: number, ring: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x;
    const yi = ring[i].y;
    const xj = ring[j].x;
    const yj = ring[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const p = closestOnSegment(px, py, ax, ay, bx, by);
  return Math.hypot(p.x - px, p.y - py);
}

function closestOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { x: number; y: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + t * dx, y: ay + t * dy };
}
