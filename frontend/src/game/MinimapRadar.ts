import Phaser from "phaser";
import type { RoadGraph } from "./RoadGraph";

/** Rundes Radar – standardmäßig unten links (über Joystick-Zone). */
export class MinimapRadar {
  private container: Phaser.GameObjects.Container;
  private roadGfx: Phaser.GameObjects.Graphics;
  private overlayGfx: Phaser.GameObjects.Graphics;
  private maskGfx: Phaser.GameObjects.Graphics;
  private playerDot: Phaser.GameObjects.Arc;
  private heading: Phaser.GameObjects.Triangle;

  private readonly size: number;
  private readonly radius: number;
  private readonly worldRadius: number;
  private cx: number;
  private cy: number;
  private missions: { x: number; y: number; story: boolean }[] = [];
  private lastRedrawX = Infinity;
  private lastRedrawY = Infinity;

  constructor(
    private scene: Phaser.Scene,
    private graph: RoadGraph,
    opts?: { size?: number; worldRadius?: number; corner?: "bl" | "br" }
  ) {
    this.size = opts?.size ?? 112;
    this.radius = this.size / 2 - 4;
    this.worldRadius = opts?.worldRadius ?? 850;
    const corner = opts?.corner ?? "bl";

    const pad = 10;
    const { width, height } = scene.scale;
    // Unten links, oberhalb des unteren Drittels (Joystick)
    this.cx = corner === "bl" ? this.size / 2 + pad : width - this.size / 2 - pad;
    this.cy = height - height * 0.33 - this.size / 2 - 4;

    const bg = scene.add.circle(0, 0, this.radius + 3, 0x0a0e14, 0.88);
    bg.setStrokeStyle(2, 0x36c2ff, 0.7);
    const ring1 = scene.add.circle(0, 0, this.radius * 0.55, 0x000000, 0).setStrokeStyle(1, 0x36c2ff, 0.12);

    this.roadGfx = scene.add.graphics();
    this.overlayGfx = scene.add.graphics();
    this.playerDot = scene.add.circle(0, 0, 3.2, 0xffd23f).setStrokeStyle(1, 0xffffff, 0.9);
    this.heading = scene.add.triangle(0, -7, 0, -5, -3.5, 2, 3.5, 2, 0xffd23f).setAlpha(0.95);

    this.maskGfx = scene.make.graphics({ x: this.cx, y: this.cy });
    this.maskGfx.fillStyle(0xffffff);
    this.maskGfx.fillCircle(0, 0, this.radius);
    const mask = this.maskGfx.createGeometryMask();
    this.roadGfx.setMask(mask);
    this.overlayGfx.setMask(mask);

    this.container = scene.add.container(this.cx, this.cy, [
      bg,
      ring1,
      this.roadGfx,
      this.overlayGfx,
      this.heading,
      this.playerDot,
    ]);
    this.container.setDepth(200);
    this.container.setScrollFactor(0);

    this.redrawRoads(0, 0);
  }

  layout() {
    const pad = 10;
    const { width, height } = this.scene.scale;
    this.cx = this.size / 2 + pad;
    this.cy = height - height * 0.33 - this.size / 2 - 4;
    this.container.setPosition(this.cx, this.cy);
    this.maskGfx.setPosition(this.cx, this.cy);
  }

  setMissions(missions: { x: number; y: number; story: boolean }[]) {
    this.missions = missions;
  }

  update(playerX: number, playerY: number, angleRad: number) {
    // Straßen nur neu zeichnen, wenn sich der Spieler spürbar bewegt hat – spart auf Dauer
    // viele überflüssige Graphics-Redraws pro Sekunde.
    if (Math.hypot(playerX - this.lastRedrawX, playerY - this.lastRedrawY) > 10) {
      this.redrawRoads(playerX, playerY);
      this.lastRedrawX = playerX;
      this.lastRedrawY = playerY;
    }
    this.overlayGfx.clear();
    for (const m of this.missions) {
      const { x, y } = this.toRadar(m.x - playerX, m.y - playerY);
      if (x * x + y * y > this.radius * this.radius) continue;
      const color = m.story ? 0xffd23f : 0x36c2ff;
      this.overlayGfx.fillStyle(color, 0.95);
      this.overlayGfx.fillCircle(x, y, m.story ? 3.2 : 2.2);
    }
    this.heading.setRotation(angleRad + Math.PI / 2);
  }

  private toRadar(dx: number, dy: number): { x: number; y: number } {
    const s = this.radius / this.worldRadius;
    return { x: dx * s, y: dy * s };
  }

  private redrawRoads(playerX: number, playerY: number) {
    this.roadGfx.clear();
    this.roadGfx.lineStyle(1.1, 0x5a6a7a, 0.8);
    // Nur nahe Straßen zeichnen (Performance)
    for (const road of this.graph.roads) {
      if (road.points.length < 2) continue;
      let started = false;
      for (const p of road.points) {
        const { x, y } = this.toRadar(p.x - playerX, p.y - playerY);
        if (x * x + y * y > (this.radius * 1.4) ** 2 && started) {
          // weiterzeichnen ok
        }
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
