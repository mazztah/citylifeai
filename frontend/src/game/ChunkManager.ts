import Phaser from "phaser";
import { RoadGraph } from "./RoadGraph";

const ROAD_FILL: Record<string, number> = {
  primary: 0x5a6270,
  secondary: 0x4a5260,
  tertiary: 0x3a4250,
};

const ROAD_EDGE: Record<string, number> = {
  primary: 0x2a2e38,
  secondary: 0x252830,
  tertiary: 0x1e2228,
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
 * Zeichnet das OSM-basierte Straßennetz und POIs über den Karten-Tiles.
 * Später: Chunk-Streaming für größere Städte (loadChunksAround).
 */
export class ChunkManager {
  graph = new RoadGraph();
  private poiLabels: Phaser.GameObjects.Text[] = [];
  private roadGraphics?: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene) {}

  renderAll() {
    // Straßen etwas transparent über den OSM-Tiles, damit die echte Karte durchscheint,
    // die Fahrspur aber klar erkennbar bleibt.
    const g = this.scene.add.graphics().setDepth(1);
    this.roadGraphics = g;

    for (const road of this.graph.roads) {
      if (road.points.length < 2) continue;
      const kind = road.kind in ROAD_FILL ? road.kind : "tertiary";
      const outerW = kind === "primary" ? 16 : kind === "secondary" ? 12 : 9;
      const innerW = kind === "primary" ? 12 : kind === "secondary" ? 9 : 6;

      // Rand (Asphalt-Kante)
      g.lineStyle(outerW, ROAD_EDGE[kind], 0.85);
      g.beginPath();
      road.points.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
      g.strokePath();

      // Fahrbahn
      g.lineStyle(innerW, ROAD_FILL[kind], 0.75);
      g.beginPath();
      road.points.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
      g.strokePath();

      // Mittellinie
      if (kind !== "tertiary") {
        g.lineStyle(1.5, 0xf0c419, 0.7);
        g.beginPath();
        road.points.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
        g.strokePath();
      }
    }

    for (const poi of this.graph.pois) {
      const color = POI_COLORS[poi.category] ?? 0xcccccc;
      this.scene.add
        .circle(poi.x, poi.y, 7, color, 0.95)
        .setStrokeStyle(2, 0xffffff, 0.8)
        .setDepth(5);
      const label = this.scene.add
        .text(poi.x, poi.y - 18, poi.name, {
          fontSize: "11px",
          color: "#ffffff",
          backgroundColor: "#00000099",
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5)
        .setDepth(6);
      this.poiLabels.push(label);
    }

    return g;
  }

  loadChunksAround(_worldX: number, _worldY: number, _radiusPx: number) {
    // no-op – gesamte Zentrumskarte ist geladen
  }
}
