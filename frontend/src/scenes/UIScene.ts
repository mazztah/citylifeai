import Phaser from "phaser";
import type { Mission, Player, StoryState } from "../api/client";

export class UIScene extends Phaser.Scene {
  private hudText!: Phaser.GameObjects.Text;
  private missionText!: Phaser.GameObjects.Text;
  private storyBadge!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private damageText!: Phaser.GameObjects.Text;
  private modeBtn!: Phaser.GameObjects.Container;

  constructor() {
    super("UIScene");
  }

  create() {
    const world = this.scene.get("WorldScene") as any;

    this.hudText = this.add
      .text(10, 8, "", {
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "#00000066",
        padding: { x: 7, y: 5 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.storyBadge = this.add
      .text(10, 52, "", {
        fontSize: "10px",
        color: "#ffd23f",
        backgroundColor: "#00000066",
        padding: { x: 7, y: 3 },
        wordWrap: { width: 220 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.missionText = this.add
      .text(10, 0, "", {
        fontSize: "11px",
        color: "#36c2ff",
        backgroundColor: "#00000066",
        padding: { x: 7, y: 5 },
        wordWrap: { width: 240 },
      })
      .setScrollFactor(0)
      .setDepth(100);

    this.speedText = this.add
      .text(0, 0, "0 km/h", {
        fontSize: "13px",
        color: "#ffffff",
        backgroundColor: "#00000066",
        padding: { x: 7, y: 4 },
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(100);

    this.damageText = this.add
      .text(0, 0, "", {
        fontSize: "11px",
        color: "#ffab91",
        backgroundColor: "#00000066",
        padding: { x: 6, y: 3 },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.add
      .text(0, 8, "© OSM · CARTO", {
        fontSize: "9px",
        color: "#a0a8b8",
        backgroundColor: "#00000055",
        padding: { x: 5, y: 2 },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setPosition(this.scale.width - 8, 8);

    // Aussteigen / Einsteigen Button
    const btnBg = this.add.rectangle(0, 0, 88, 34, 0x1a2332, 0.85).setStrokeStyle(1, 0x36c2ff);
    const btnLabel = this.add.text(0, 0, "🚶 Aus", { fontSize: "13px", color: "#fff" }).setOrigin(0.5);
    this.modeBtn = this.add.container(0, 0, [btnBg, btnLabel]).setScrollFactor(0).setDepth(110);
    btnBg.setInteractive({ useHandCursor: true });
    btnBg.on("pointerdown", () => {
      world.toggleVehicle?.();
    });

    this.layoutHud();
    this.scale.on("resize", () => this.layoutHud());

    world.events.on("player-updated", (p: Player) => this.renderPlayer(p));
    world.events.on("missions-updated", (missions: Mission[]) => this.renderMissions(missions));
    world.events.on("story-updated", (state: StoryState) =>
      this.storyBadge.setText(`📖 ${state.current_chapter.title}`)
    );
    world.events.on("speed-updated", (kmh: number) => this.speedText.setText(`${kmh} km/h`));
    world.events.on("mission-completed", (mission: Mission) => this.flashMissionComplete(mission));
    world.events.on("damage-updated", (n: number) => {
      if (n <= 0) this.damageText.setText("");
      else if (n >= 10) this.damageText.setText("💀 Schrottreif");
      else if (n >= 4) this.damageText.setText(`💨 Schaden ${n}/10`);
      else this.damageText.setText(`Schaden ${n}/10`);
    });
    world.events.on("mode-changed", (mode: string) => {
      btnLabel.setText(mode === "walk" ? "🚗 Ein" : "🚶 Aus");
    });
  }

  private layoutHud() {
    const w = this.scale.width;
    const h = this.scale.height;
    // Missionen über dem unteren Drittel
    this.missionText.setPosition(10, h * 0.62);
    this.speedText.setPosition(w - 10, h * 0.62);
    this.damageText.setPosition(w - 10, 48);
    this.modeBtn.setPosition(w - 56, 90);
    this.children.each((c: any) => {
      if (c.text === "© OSM · CARTO") c.setPosition(w - 8, 8);
    });
  }

  private renderPlayer(p: Player) {
    this.hudText.setText(
      `${p.display_name} · Lvl ${p.level} · ${p.xp} XP\n💰 ${p.cash} · ⭐ ${p.reputation}`
    );
  }

  private renderMissions(missions: Mission[]) {
    if (missions.length === 0) {
      this.missionText.setText("Keine Missionen");
      return;
    }
    const lines = missions
      .slice(0, 2)
      .map((m) => `${m.category === "story" ? "⭐" : "▸"} ${m.title}`);
    this.missionText.setText(lines.join("\n"));
  }

  private flashMissionComplete(mission: Mission) {
    const toast = this.add
      .text(this.scale.width / 2, 80, `✅ ${mission.title}`, {
        fontSize: "13px",
        color: "#8bd450",
        backgroundColor: "#00000088",
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(120);
    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: 55,
      delay: 1200,
      duration: 500,
      onComplete: () => toast.destroy(),
    });
  }
}
