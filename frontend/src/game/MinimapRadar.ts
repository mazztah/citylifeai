import Phaser from "phaser";
import type { RoadGraph } from "./RoadGraph";
import type { Mission } from "../api/client";

/**
 * Einfaches rundes Radar unten rechts: Straßennetz, Spieler-Punkt, Missionsmarker.
 * Scrollt mit dem Spieler (zentriert auf Auto).
 */
export class MinimapRadar {
  private container: Phaser.GameObjects.Container;
  private roadGfx: Phaser.GameObjects.Graphics;
  private overlayGfx: Phaser.GameObjects.Graphics;
  private maskGfx: Phaser.GameObjects.Graphics;
  private playerDot: Phaser.GameObjects.Arc;
  private heading: Phaser.GameObjects.Triangle;

  private readonly size: number;
  private readonly radius: number;
  private readonly worldRadius: number; // sichtbarer Weltradius in px
  private cx: number;
  private cy: number;

  private missions: { x: number; y: number; story: boolean }[] = [];

  constructor(
    private scene: Phaser.Scene,
    private graph: RoadGraph,
    opts?: { size?: number; worldRadius?: number }
  ) {
    this.size = opts?.size ?? 132;
    this.radius = this.size / 2 - 4;
    this.worldRadius = opts?.worldRadius ?? 900;

    const { width, height } = scene.scale;
    this.cx = width - this.size / 2 - 12;
    this.cy = height - this.size / 2 - 14;

    // Hintergrund-Kreis
    const bg = scene.add.circle(0, 0, this.radius + 3, 0x0a0e14, 0.88);
    bg.setStrokeStyle(2, 0x36c2ff, 0.7);

    // leichte Scan-Ringe
    const ring1 = scene.add.circle(0, 0, this.radius * 0.55, 0x000000, 0).setStrokeStyle(1, 0x36c2ff, 0.15);
    const ring2 = scene.add.circle(0, 0, this.radius * 0.28, 0x000000, 0).setStrokeStyle(1, 0x36c2ff, 0.12);

    this.roadGfx = scene.add.graphics();
    this.overlayGfx = scene.add.graphics();

    this.playerDot = scene.add.circle(0, 0, 3.5, 0xffd23f).setStrokeStyle(1, 0xffffff, 0.9);
    this.heading = scene.add
      .triangle(0, -8, 0, -6, -4, 2, 4, 2, 0xffd23f)
      .setAlpha(0.95);

    // Maske: kreisförmig
    this.maskGfx = scene.make.graphics({ x: this.cx, y: this.cy });
    this.maskGfx.fillStyle(0xffffff);
    this.maskGfx.fillCircle(0, 0, this.radius);
    const mask = this.maskGfx.createGeometryMask();
    this.roadGfx.setMask(mask);
    this.overlayGfx.setMask(mask);

    this.container = scene.add.container(this.cx, this.cy, [
      bg,
      ring1,
      ring2,
      this.roadGfx,
      this.overlayGfx,
      this.heading,
      this.playerDot,
    ]);
    this.container.setDepth(200);
    this.container.setScrollFactor(0);

    // Label
    const label = scene.add
      .text(0, this.radius + 2, "RADAR", {
        fontSize: "9px",
        color: "#6a7a8a",
      })
      .setOrigin(0.5, 0);
    this.container.add(label);

    this.redrawRoads(0, 0);
  }

  setMissions(missions: { x: number; y: number; story: boolean }[]) {
    this.missions = missions;
  }

  /** playerX/Y in Weltpixeln, angle in Radiant */
  update(playerX: number, playerY: number, angleRad: number) {
    this.redrawRoads(playerX, playerY);
    this.overlayGfx.clear();

    // Missionen
    for (const m of this.missions) {
      const { x, y } = this.toRadar(m.x - playerX, m.y - playerY);
      if (x * x + y * y > this.radius * this.radius) continue;
      const color = m.story ? 0xffd23f : 0x36c2ff;
      this.overlayGfx.fillStyle(color, 0.95);
      this.overlayGfx.fillCircle(x, y, m.story ? 3.5 : 2.5);
      this.overlayGfx.lineStyle(1, 0xffffff, 0.5);
      this.overlayGfx.strokeCircle(x, y, m.story ? 3.5 : 2.5);
    }

    // Spieler immer in der Mitte; Heading drehen
    this.heading.setRotation(angleRad + Math.PI / 2);
  }

  private toRadar(dx: number, dy: number): { x: number; y: number } {
    const s = this.radius / this.worldRadius;
    return { x: dx * s, y: dy * s };
  }

  private redrawRoads(playerX: number, playerY: number) {
    this.roadGfx.clear();
    this.roadGfx.lineStyle(1.2, 0x5a6a7a, 0.85);
    for (const road of this.graph.roads) {
      if (road.points.length < 2) continue;
      let started = false;
      for (const p of road.points) {
        const { x, y } = this.toRadar(p.x - playerX, p.y - playerY);
        if (!started) {
          this.roadGfx.beginPath();
          this.roadGfx.moveTo(x, y);
          started = true;
        } else {
          this.roadGfx.lineTo(x, y);
        }
      }
      if (started) this.roadGfx.strokePath();
    }
  }

  destroy() {
    this.maskGfx.destroy();
    this.container.destroy();
  }
}
