import Phaser from "phaser";
import { lonLatToWorld, MAP_ORIGIN, PIXELS_PER_METER } from "../config";

/**
 * Lädt OpenStreetMap-Rasterkacheln (Standard-Style) als Hintergrund unter dem
 * Straßengraphen. Dadurch sieht die Spielwelt aus wie die echte Hannover-Karte,
 * während Fahrphysik und Missionen weiter auf dem Vektor-Straßennetz basieren.
 *
 * Tile-URL: https://tile.openstreetmap.org/{z}/{x}/{y}.png
 * Nutzung nur in moderatem Umfang (OSM Tile Usage Policy). Attribution im HUD.
 */
const METERS_PER_DEGREE_LAT = 111_320;
const METERS_PER_DEGREE_LON = 111_320 * Math.cos((MAP_ORIGIN.lat * Math.PI) / 180);

export function lonLatToTile(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

export function tileToLonLatBounds(tx: number, ty: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const west = (tx / n) * 360 - 180;
  const east = ((tx + 1) / n) * 360 - 180;
  const north = (Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n))) * 180) / Math.PI;
  const south = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (ty + 1)) / n))) * 180) / Math.PI;
  return { west, south, east, north };
}

export class MapTiles {
  private sprites: Phaser.GameObjects.Image[] = [];
  private loadedKeys = new Set<string>();
  readonly zoom: number;

  constructor(
    private scene: Phaser.Scene,
    zoom = 15,
    /** BBox in lon/lat der spielbaren Region */
    private bbox = { south: 52.355, west: 9.722, north: 52.390, east: 9.768 }
  ) {
    this.zoom = zoom;
  }

  /** Registriert alle benötigten Kacheln im Phaser-Loader (vor create / in preload). */
  queueLoad() {
    const z = this.zoom;
    const tl = lonLatToTile(this.bbox.west, this.bbox.north, z);
    const br = lonLatToTile(this.bbox.east, this.bbox.south, z);
    const minX = Math.min(tl.x, br.x);
    const maxX = Math.max(tl.x, br.x);
    const minY = Math.min(tl.y, br.y);
    const maxY = Math.max(tl.y, br.y);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const key = `osm_${z}_${x}_${y}`;
        if (this.loadedKeys.has(key)) continue;
        this.loadedKeys.add(key);
        const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
        this.scene.load.image(key, url);
      }
    }
  }

  /**
   * Platziert geladene Kacheln in Weltkoordinaten.
   * Depth niedrig, damit Straßen und Auto darüber liegen.
   */
  place() {
    const z = this.zoom;
    for (const key of this.loadedKeys) {
      if (!this.scene.textures.exists(key)) continue;
      const parts = key.split("_");
      const tx = parseInt(parts[2], 10);
      const ty = parseInt(parts[3], 10);
      const b = tileToLonLatBounds(tx, ty, z);

      const topLeft = lonLatToWorld(b.west, b.north);
      const bottomRight = lonLatToWorld(b.east, b.south);
      const width = bottomRight.x - topLeft.x;
      const height = bottomRight.y - topLeft.y;

      const img = this.scene.add
        .image(topLeft.x, topLeft.y, key)
        .setOrigin(0, 0)
        .setDisplaySize(width, Math.abs(height))
        .setDepth(-100)
        .setAlpha(0.92);

      // Unser y wächst nach Süden (positiv), tile topLeft.y ist nördlich (kleiner/negativer)
      if (height < 0) {
        img.setPosition(topLeft.x, topLeft.y);
      }
      this.sprites.push(img);
    }
  }

  destroy() {
    for (const s of this.sprites) s.destroy();
    this.sprites = [];
  }
}

/** Hilfsfunktion: ungefähre Kachelgröße in Weltpixeln bei gegebenem Zoom (Hannover). */
export function approxTileSizePx(zoom: number): number {
  const n = Math.pow(2, zoom);
  const metersPerTile = (40075016.686 * Math.cos((MAP_ORIGIN.lat * Math.PI) / 180)) / n;
  return metersPerTile * PIXELS_PER_METER;
}
