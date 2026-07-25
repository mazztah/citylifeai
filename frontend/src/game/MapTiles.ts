import Phaser from "phaser";
import {
  lonLatToWorld,
  lonLatToTile,
  tileToLonLatBounds,
  MAP_TILE_ZOOM,
} from "../config";

/**
 * Kacheln asynchron – blockiert den Spielstart nicht.
 */
export type TileStyle = "voyager" | "osm" | "positron";

const TILE_URLS: Record<TileStyle, (z: number, x: number, y: number) => string> = {
  voyager: (z, x, y) =>
    `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}@2x.png`,
  positron: (z, x, y) =>
    `https://a.basemaps.cartocdn.com/light_all/${z}/${x}/${y}@2x.png`,
  osm: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
};

export class MapTiles {
  private sprites: Phaser.GameObjects.Image[] = [];
  private placed = new Set<string>();
  readonly zoom: number;
  private style: TileStyle;
  private destroyed = false;

  constructor(
    private scene: Phaser.Scene,
    zoom = MAP_TILE_ZOOM,
    private bbox = { south: 52.358, west: 9.728, north: 52.385, east: 9.760 },
    style: TileStyle = "voyager"
  ) {
    this.zoom = zoom;
    this.style = style;
  }

  startLoading() {
    const z = this.zoom;
    const tl = lonLatToTile(this.bbox.west, this.bbox.north, z);
    const br = lonLatToTile(this.bbox.east, this.bbox.south, z);
    const minX = Math.min(tl.x, br.x);
    const maxX = Math.max(tl.x, br.x);
    const minY = Math.min(tl.y, br.y);
    const maxY = Math.max(tl.y, br.y);

    const jobs: { key: string; url: string; tx: number; ty: number }[] = [];
    const urlFn = TILE_URLS[this.style];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        jobs.push({
          key: `map_${this.style}_${z}_${x}_${y}`,
          url: urlFn(z, x, y),
          tx: x,
          ty: y,
        });
      }
    }

    const concurrency = 2;
    let next = 0;
    let inFlight = 0;

    const launch = () => {
      while (inFlight < concurrency && next < jobs.length && !this.destroyed) {
        const job = jobs[next++];
        inFlight++;
        this.loadOne(job.key, job.url, job.tx, job.ty, () => {
          inFlight--;
          launch();
        });
      }
    };
    launch();
  }

  private loadOne(
    key: string,
    url: string,
    tx: number,
    ty: number,
    done: () => void
  ) {
    if (this.destroyed || this.placed.has(key)) {
      done();
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      done();
    };
    const timeout = window.setTimeout(finish, 10000);

    img.onload = () => {
      window.clearTimeout(timeout);
      if (this.destroyed) {
        finish();
        return;
      }
      try {
        if (!this.scene.sys || !this.scene.textures) {
          finish();
          return;
        }
        if (!this.scene.textures.exists(key)) {
          this.scene.textures.addImage(key, img);
        }
        this.placeTile(key, tx, ty);
      } catch (e) {
        console.warn("Tile:", key, e);
      }
      finish();
    };
    img.onerror = () => {
      window.clearTimeout(timeout);
      finish();
    };
    img.src = url;
  }

  private placeTile(key: string, tx: number, ty: number) {
    if (this.placed.has(key) || !this.scene.textures.exists(key)) return;
    this.placed.add(key);

    const b = tileToLonLatBounds(tx, ty, this.zoom);
    const nw = lonLatToWorld(b.west, b.north);
    const se = lonLatToWorld(b.east, b.south);
    const width = se.x - nw.x;
    const height = se.y - nw.y;
    if (!(width > 0) || !(height > 0)) return;

    const sprite = this.scene.add
      .image(nw.x, nw.y, key)
      .setOrigin(0, 0)
      .setDisplaySize(width, height)
      .setDepth(-100)
      .setAlpha(0);

    this.scene.tweens.add({ targets: sprite, alpha: 1, duration: 250 });
    this.sprites.push(sprite);
  }

  destroy() {
    this.destroyed = true;
    for (const s of this.sprites) s.destroy();
    this.sprites = [];
  }
}
