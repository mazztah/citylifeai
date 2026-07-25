import Phaser from "phaser";
import type { Mission } from "../api/client";

const CATEGORY_ICON: Record<string, string> = {
  delivery: "📦",
  taxi: "🚕",
  photo: "📸",
  property: "🏠",
  shopping: "🛒",
  story: "⭐",
};

export class MissionMarker {
  mission: Mission;
  container: Phaser.GameObjects.Container;
  private radius = 26;

  constructor(scene: Phaser.Scene, x: number, y: number, mission: Mission) {
    this.mission = mission;
    const isStory = mission.category === "story";

    const ring = scene.add.circle(0, 0, this.radius, isStory ? 0xffd23f : 0x36c2ff, 0.18);
    ring.setStrokeStyle(2, isStory ? 0xffd23f : 0x36c2ff);
    const icon = scene.add.text(0, -6, CATEGORY_ICON[mission.category] ?? "❓", {
      fontSize: "22px",
    }).setOrigin(0.5);
    const label = scene.add.text(0, 20, mission.target_label ?? "", {
      fontSize: "11px",
      color: "#ffffff",
      backgroundColor: "#00000088",
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5);

    this.container = scene.add.container(x, y, [ring, icon, label]);

    scene.tweens.add({
      targets: ring,
      scale: { from: 0.9, to: 1.15 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  distanceTo(x: number, y: number): number {
    return Phaser.Math.Distance.Between(this.container.x, this.container.y, x, y);
  }

  isReachable(x: number, y: number): boolean {
    return this.distanceTo(x, y) < this.radius;
  }

  destroy() {
    this.container.destroy();
  }
}
