import Phaser from "phaser";
import { RoadGraph } from "./RoadGraph";

const ROAD_ASPHALT: Record<string, number> = {
  primary: 0x3d4450,
  secondary: 0x353b48,
  tertiary: 0x2e3340,
};

const ROAD_EDGE: Record<string, number> = {
  primary: 0x1c1f26,
  secondary: 0x1a1d24,
  tertiary: 0x181b20,
};

const POI_COLORS: Record<string, number> = {
  landmark: 0xffd23f,
  park: 0x4caf50,
  transit: 0x36c2ff,
  shopping: 0xff6b9d,
  nightlife: 0xb266ff,
  cafe: 0xd2a679,
  fuel: 0xff8a3d,
  shop: 0x8bd450,
  hospital: 0xff5c5c,
};

/**
 * Vektor-Straßen + Gebäude/Flächen im Web-Mercator-Raum (gleiche Projektion wie MapTiles).
 * Straßen leicht transparent, damit Basemap-Tiles durchscheinen.
 */
export class ChunkManager {
  graph = new RoadGraph();
  private poiLabels: Phaser.GameObjects.Text[] = [];

  constructor(private scene: Phaser.Scene) {}

  renderAll() {
    // Flächen (Parks/Plätze) unter den Straßen
    const areaG = this.scene.add.graphics().setDepth(0);
    for (const area of this.graph.areas) {
      if (area.points.length < 3) continue;
      const isPark = area.category === "park";
      areaG.fillStyle(isPark ? 0x2e7d32 : 0x5d6d7e, isPark ? 0.28 : 0.22);
      areaG.lineStyle(1, isPark ? 0x66bb6a : 0x90a4ae, 0.5);
      areaG.beginPath();
      area.points.forEach((p, i) => (i === 0 ? areaG.moveTo(p.x, p.y) : areaG.lineTo(p.x, p.y)));
      areaG.closePath();
      areaG.fillPath();
      areaG.strokePath();
    }

    const g = this.scene.add.graphics().setDepth(1);

    for (const road of this.graph.roads) {
      if (road.points.length < 2) continue;
      const kind = road.kind in ROAD_ASPHALT ? road.kind : "tertiary";
      const outerW = kind === "primary" ? 18 : kind === "secondary" ? 14 : 10;
      const innerW = kind === "primary" ? 14 : kind === "secondary" ? 10 : 7;

      g.lineStyle(outerW, ROAD_EDGE[kind], 0.42);
      g.beginPath();
      road.points.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
      g.strokePath();

      g.lineStyle(innerW, ROAD_ASPHALT[kind], 0.38);
      g.beginPath();
      road.points.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
      g.strokePath();

      if (kind === "primary") {
        g.lineStyle(1.2, 0xf0c419, 0.4);
        g.beginPath();
        road.points.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
        g.strokePath();
      }
    }

    // Gebäude über den Straßen, unter POIs – klare Sperrflächen
    const bG = this.scene.add.graphics().setDepth(3);
    for (const b of this.graph.buildings) {
      if (b.points.length < 3) continue;
      bG.fillStyle(0x1a2230, 0.55);
      bG.lineStyle(1, 0x3a4558, 0.9);
      bG.beginPath();
      b.points.forEach((p, i) => (i === 0 ? bG.moveTo(p.x, p.y) : bG.lineTo(p.x, p.y)));
      bG.closePath();
      bG.fillPath();
      bG.strokePath();
    }

    for (const poi of this.graph.pois) {
      const color = POI_COLORS[poi.category] ?? 0xcccccc;
      const ring = this.scene.add
        .circle(poi.x, poi.y, 10, color, 0.15)
        .setStrokeStyle(2, color, 0.9)
        .setDepth(5);
      this.scene.tweens.add({
        targets: ring,
        scale: { from: 0.85, to: 1.2 },
        alpha: { from: 0.9, to: 0.4 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
      });
      this.scene.add.circle(poi.x, poi.y, 5, color).setStrokeStyle(1, 0xffffff, 0.9).setDepth(6);
      const label = this.scene.add
        .text(poi.x, poi.y - 20, poi.name, {
          fontSize: "11px",
          color: "#ffffff",
          backgroundColor: "#0a0c1099",
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0.5)
        .setDepth(7);
      this.poiLabels.push(label);
    }

    return g;
  }

  loadChunksAround(_worldX: number, _worldY: number, _radiusPx: number) {}
}
