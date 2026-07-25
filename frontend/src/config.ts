// Zentrale Spielkonfiguration.

export const API_URL: string = (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";

// Ursprung für die (sehr einfache) äquirektangulare Projektion: Kröpcke, Hannover.
export const MAP_ORIGIN = { lat: 52.3759, lon: 9.732 };

// Meter pro Breitengrad ist praktisch konstant; Meter pro Längengrad hängt von
// der Breite ab (cos(lat)). Für unseren kleinen Kartenausschnitt reicht eine
// lokale Näherung völlig aus - für Weltmaßstab bräuchte man eine echte Projektion
// (z.B. Web Mercator), was hier bewusst nicht nötig ist.
const METERS_PER_DEGREE_LAT = 111_320;
const METERS_PER_DEGREE_LON = 111_320 * Math.cos((MAP_ORIGIN.lat * Math.PI) / 180);

// Pixel pro Meter - bestimmt, wie "groß" die Stadt im Spiel wirkt.
export const PIXELS_PER_METER = 2.2;

export function lonLatToWorld(lon: number, lat: number): { x: number; y: number } {
  const dx = (lon - MAP_ORIGIN.lon) * METERS_PER_DEGREE_LON;
  const dy = (lat - MAP_ORIGIN.lat) * METERS_PER_DEGREE_LAT;
  // y invertieren: höhere Latitude = weiter Norden = im Bildschirmkoordinatensystem "nach oben" (negatives y)
  return { x: dx * PIXELS_PER_METER, y: -dy * PIXELS_PER_METER };
}

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 640;
