import Phaser from "phaser";
import {
  lonLatToWorld,
  lonLatToTile,
  tileToLonLatBounds,
  MAP_TILE_ZOOM,
} from "../config";

/**
 * OSM-Rasterkacheln im selben Web-Mercator-Raum wie die Straßenvektoren.
 * Jede Kachel wird über ihre lon/lat-Ecken → lonLatToWorld platziert
 * (gleiche Funktion wie RoadGraph) → keine Verschiebung.
 *
 * Bessere Optik: Zoom 16 + Carto "Voyager" (freundlicher, lesbarer als Standard-OSM).
 * Fallback: tile.openstreetmap.org
 */
export type TileStyle = "voyager" | "osm" | "positron";

const TILE_URLS: Record<TileStyle, (z: number, x: number, y: number) => string> = {
  // CartoCDN – klar, modern, gut für Spiele-Overlay
  voyager: (z, x, y) =>
    `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}@2x.png`,
  positron: (z, x, y) =>
    `https://a.basemaps.cartocdn.com/light_all/${z}/${x}/${y}@2x.png`,
  osm: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
};

export class MapTiles {
  private sprites: Phaser.GameObjects.Image[] = [];
  private loadedKeys = new Set<string>();
  readonly zoom: number;
  private style: TileStyle;

  constructor(
    private scene: Phaser.Scene,
    zoom = MAP_TILE_ZOOM,
    private bbox = { south: 52.355, west: 9.722, north: 52.390, east: 9.768 },
    style: TileStyle = "voyager"
  ) {
    this.zoom = zoom;
    this.style = style;
  }

  queueLoad() {
    const z = this.zoom;
    const tl = lonLatToTile(this.bbox.west, this.bbox.north, z);
    const br = lonLatToTile(this.bbox.east, this.bbox.south, z);
    const minX = Math.min(tl.x, br.x);
    const maxX = Math.max(tl.x, br.x);
    const minY = Math.min(tl.y, br.y);
    const maxY = Math.max(tl.y, br.y);
    const urlFn = TILE_URLS[this.style];

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const key = `map_${this.style}_${z}_${x}_${y}`;
        if (this.loadedKeys.has(key)) continue;
        this.loadedKeys.add(key);
        this.scene.load.image(key, urlFn(z, x, y));
      }
    }
  }

  place() {
    const z = this.zoom;
    for (const key of this.loadedKeys) {
      if (!this.scene.textures.exists(key)) continue;
      const parts = key.split("_");
      // map_style_z_x_y  (style can be one word)
      const tx = parseInt(parts[parts.length - 2], 10);
      const ty = parseInt(parts[parts.length - 1], 10);
      const b = tileToLonLatBounds(tx, ty, z);

      // NW-Ecke und SE-Ecke in Weltpixel – identische Projektion wie Straßen
      const nw = lonLatToWorld(b.west, b.north);
      const se = lonLatToWorld(b.east, b.south);
      const width = se.x - nw.x;
      const height = se.y - nw.y;

      const img = this.scene.add
        .image(nw.x, nw.y, key)
        .setOrigin(0, 0)
        .setDisplaySize(width, height)
        .setDepth(-100)
        .setAlpha(1);

      this.sprites.push(img);
    }
  }

  destroy() {
    for (const s of this.sprites) s.destroy();
    this.sprites = [];
  }
}
