// Zentrale Spielkonfiguration + einheitliche Web-Mercator-Projektion.
// Straßen und OSM-Tiles nutzen dieselbe Transformation → pixelgenaue Ausrichtung.

export const API_URL: string = (import.meta as any).env?.VITE_API_URL || "";

/** Kartenursprung: Kröpcke, Hannover */
export const MAP_ORIGIN = { lat: 52.3759, lon: 9.7392 };

/** Erde / Web Mercator (EPSG:3857) */
export const EARTH_RADIUS = 6378137;
export const ORIGIN_SHIFT = Math.PI * EARTH_RADIUS; // ≈ 20037508.34

/**
 * Pixel pro Meter in der Phaser-Welt.
 * Bei Zoom 16 ist eine OSM-Kachel ~611 m breit → ~1344 px bei 2.2 → etwas groß.
 * 1.8 wirkt ausgewogen für Fahrgefühl + lesbare Karte.
 */
export const PIXELS_PER_METER = 1.8;

/** Standard-Zoom für Rasterkacheln (höher = schärfer, mehr Downloads) */
export const MAP_TILE_ZOOM = 15;

export function lonLatToMercator(lon: number, lat: number): { x: number; y: number } {
  const x = (lon * ORIGIN_SHIFT) / 180;
  let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  y = (y * ORIGIN_SHIFT) / 180;
  return { x, y };
}

const ORIGIN_MERC = lonLatToMercator(MAP_ORIGIN.lon, MAP_ORIGIN.lat);

/**
 * WGS84 → Phaser-Weltpixel (Web Mercator, y nach Süden positiv wie Bildschirm).
 * Einmalige Transformation beim Import/Load – nicht pro Frame.
 */
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

/** OSM-Tile-Index aus Lon/Lat */
export function lonLatToTile(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

/** Lon/Lat-Ecken einer OSM-Kachel */
export function tileToLonLatBounds(tx: number, ty: number, zoom: number) {
  const n = 2 ** zoom;
  const west = (tx / n) * 360 - 180;
  const east = ((tx + 1) / n) * 360 - 180;
  const north = (Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n))) * 180) / Math.PI;
  const south = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (ty + 1)) / n))) * 180) / Math.PI;
  return { west, south, east, north };
}

/** Kachelgröße in Metern (Web Mercator, am Äquator; für Platzierung nutzen wir Ecken) */
export function tileSizeMeters(zoom: number): number {
  return (2 * ORIGIN_SHIFT) / 2 ** zoom;
}

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 640;
