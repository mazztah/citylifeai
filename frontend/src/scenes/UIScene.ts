import Phaser from "phaser";
import type { Mission, Player, StoryState } from "../api/client";

export class UIScene extends Phaser.Scene {
  private hudText!: Phaser.GameObjects.Text;
  private missionText!: Phaser.GameObjects.Text;
  private storyBadge!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;

  constructor() {
    super("UIScene");
  }

  create() {
    const world = this.scene.get("WorldScene");

    this.hudText = this.add.text(12, 10, "", {
      fontSize: "13px",
      color: "#ffffff",
      backgroundColor: "#00000066",
      padding: { x: 8, y: 6 },
    });

    this.storyBadge = this.add.text(12, 60, "", {
      fontSize: "11px",
      color: "#ffd23f",
      backgroundColor: "#00000066",
      padding: { x: 8, y: 4 },
      wordWrap: { width: 240 },
    });

    this.missionText = this.add.text(12, this.scale.height - 70, "", {
      fontSize: "12px",
      color: "#36c2ff",
      backgroundColor: "#00000066",
      padding: { x: 8, y: 6 },
      wordWrap: { width: 280 },
    });

    this.speedText = this.add
      .text(this.scale.width - 12, this.scale.height - 20, "0 km/h", {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#00000066",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 1);

    world.events.on("player-updated", (p: Player) => this.renderPlayer(p));
    world.events.on("missions-updated", (missions: Mission[]) => this.renderMissions(missions));
    world.events.on("story-updated", (state: StoryState) =>
      this.storyBadge.setText(`📖 ${state.current_chapter.title}`)
    );
    world.events.on("speed-updated", (kmh: number) => this.speedText.setText(`${kmh} km/h`));
    world.events.on("mission-completed", (mission: Mission) => this.flashMissionComplete(mission));

    this.buildTouchControls(world);
  }

  private renderPlayer(p: Player) {
    this.hudText.setText(
      `${p.display_name}  ·  Lvl ${p.level}  ·  ${p.xp} XP\n💰 ${p.cash} Taler  ·  ⭐ Ruf ${p.reputation}`
    );
  }

  private renderMissions(missions: Mission[]) {
    if (missions.length === 0) {
      this.missionText.setText("Keine aktiven Missionen.");
      return;
    }
    const lines = missions
      .slice(0, 3)
      .map((m) => `${m.category === "story" ? "⭐" : "▸"} ${m.title} (${m.target_label ?? "?"})`);
    this.missionText.setText(lines.join("\n"));
  }

  private flashMissionComplete(mission: Mission) {
    const toast = this.add
      .text(this.scale.width / 2, 90, `✅ Mission erledigt: ${mission.title}`, {
        fontSize: "14px",
        color: "#8bd450",
        backgroundColor: "#00000088",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5, 0);
    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: 60,
      delay: 1400,
      duration: 600,
      onComplete: () => toast.destroy(),
    });
  }

  /** Einfache Touch-Steuerung (D-Pad unten links) für mobile Telegram-Clients. */
  private buildTouchControls(world: Phaser.Scene) {
    const isTouch = this.sys.game.device.input.touch;
    if (!isTouch) return;

    const baseX = 90;
    const baseY = this.scale.height - 110;
    const btnDefs: { key: "up" | "down" | "left" | "right"; dx: number; dy: number; label: string }[] = [
      { key: "up", dx: 0, dy: -45, label: "▲" },
      { key: "down", dx: 0, dy: 45, label: "▼" },
      { key: "left", dx: -45, dy: 0, label: "◀" },
      { key: "right", dx: 45, dy: 0, label: "▶" },
    ];

    const getInputController = () => (world as any).driveInput as { touchState: Record<string, boolean> } | undefined;

    for (const def of btnDefs) {
      const circle = this.add
        .circle(baseX + def.dx, baseY + def.dy, 24, 0x1a1e28, 0.75)
        .setStrokeStyle(1, 0x444c5c)
        .setInteractive();
      this.add.text(baseX + def.dx, baseY + def.dy, def.label, { fontSize: "16px", color: "#fff" }).setOrigin(0.5);

      circle.on("pointerdown", () => {
        const ic = getInputController();
        if (ic) ic.touchState[def.key] = true;
      });
      const release = () => {
        const ic = getInputController();
        if (ic) ic.touchState[def.key] = false;
      };
      circle.on("pointerup", release);
      circle.on("pointerout", release);
    }
  }
}
