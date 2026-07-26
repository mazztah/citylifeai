// Zentrale Spielkonfiguration + einheitliche Web-Mercator-Projektion.

export const API_URL: string = (import.meta as any).env?.VITE_API_URL || "";

/** Kartenursprung: Kröpcke, Hannover */
export const MAP_ORIGIN = { lat: 52.3759, lon: 9.7392 };

export const EARTH_RADIUS = 6378137;
export const ORIGIN_SHIFT = Math.PI * EARTH_RADIUS;

/**
 * Pixel pro Meter – auf Mobile etwas geringer für weniger Overdraw.
 */
export const PIXELS_PER_METER = 1.6;

/** Rasterkachel-Zoom (14 = weniger Tiles / bessere Performance auf Android) */
export const MAP_TILE_ZOOM = 14;

export function lonLatToMercator(lon: number, lat: number): { x: number; y: number } {
  const x = (lon * ORIGIN_SHIFT) / 180;
  let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * ORIGIN_SHIFT) / 180;
  return { x, y };
}

const ORIGIN_MERC = lonLatToMercator(MAP_ORIGIN.lon, MAP_ORIGIN.lat);

export function lonLatToWorld(lon: number, lat: number): { x: number; y: number } {
  const m = lonLatToMercator(lon, lat);
  return {
    x: (m.x - ORIGIN_MERC.x) * PIXELS_PER_METER,
    y: -(m.y - ORIGIN_MERC.y) * PIXELS_PER_METER,
  };
}

export function worldToLonLat(wx: number, wy: number): { lon: number; lat: number } {
  const mx = wx / PIXELS_PER_METER + ORIGIN_MERC.x;
  const my = -wy / PIXELS_PER_METER + ORIGIN_MERC.y;
  const lon = (mx / ORIGIN_SHIFT) * 180;
  let lat = (my / ORIGIN_SHIFT) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return { lon, lat };
}

export function lonLatToTile(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

export function tileToLonLatBounds(tx: number, ty: number, zoom: number) {
  const n = 2 ** zoom;
  const west = (tx / n) * 360 - 180;
  const east = ((tx + 1) / n) * 360 - 180;
  const north = (Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n))) * 180) / Math.PI;
  const south = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (ty + 1)) / n))) * 180) / Math.PI;
  return { west, south, east, north };
}

/** Basis-Auflösung – wird per Scale.RESIZE an Viewport angepasst */
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 800;

/** Zoom: Auto / zu Fuß */
export const ZOOM_DRIVING = 1.05;
export const ZOOM_WALKING = 1.55;

/** Grenzen für manuellen Zoom (Mausrad am PC, Pinch am Smartphone) */
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.8;
