import Phaser from "phaser";
import { RoadGraph } from "./RoadGraph";

const ROAD_COLORS: Record<string, number> = {
  primary: 0x4a5568,
  secondary: 0x3a4150,
  tertiary: 0x2c3140,
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
 * Aktuell lädt und zeichnet der ChunkManager das gesamte (kleine) Hannover-
 * Zentrum auf einmal - für die Kartengröße dieses Prototyps ist echtes
 * Chunk-Streaming (Minecraft-artig, wie im Konzept beschrieben) nicht nötig.
 * Die Klasse ist aber bewusst so geschnitten, dass eine spätere Version pro
 * Grid-Zelle (z.B. 500m x 500m) nur den sichtbaren Ausschnitt aus dem Backend
 * nachlädt (`loadChunksAround(x, y, radiusPx)`), ohne den Aufrufer (WorldScene)
 * anzupassen.
 */
export class ChunkManager {
  graph = new RoadGraph();
  private poiLabels: Phaser.GameObjects.Text[] = [];

  constructor(private scene: Phaser.Scene) {}

  renderAll() {
    const graphics = this.scene.add.graphics();

    for (const road of this.graph.roads) {
      const color = ROAD_COLORS[road.kind] ?? ROAD_COLORS.tertiary;
      const width = road.kind === "primary" ? 10 : road.kind === "secondary" ? 7 : 5;
      graphics.lineStyle(width, color, 1);
      graphics.beginPath();
      road.points.forEach((p, i) => (i === 0 ? graphics.moveTo(p.x, p.y) : graphics.lineTo(p.x, p.y)));
      graphics.strokePath();

      // Straßenmarkierung (Mittellinie), nur für größere Straßen
      if (road.kind !== "tertiary") {
        graphics.lineStyle(1, 0xf0c419, 0.6);
        graphics.beginPath();
        road.points.forEach((p, i) => (i === 0 ? graphics.moveTo(p.x, p.y) : graphics.lineTo(p.x, p.y)));
        graphics.strokePath();
      }
    }

    for (const poi of this.graph.pois) {
      const color = POI_COLORS[poi.category] ?? 0xcccccc;
      this.scene.add.circle(poi.x, poi.y, 6, color).setStrokeStyle(1, 0xffffff, 0.6);
      const label = this.scene.add
        .text(poi.x, poi.y - 16, poi.name, { fontSize: "10px", color: "#c9ced9" })
        .setOrigin(0.5);
      this.poiLabels.push(label);
    }

    return graphics;
  }

  /** Platzhalter für künftiges Streaming großer Karten (siehe Klassenkommentar oben). */
  loadChunksAround(_worldX: number, _worldY: number, _radiusPx: number) {
    // no-op im aktuellen Prototyp - gesamte Karte ist bereits geladen
  }
}
