import Phaser from "phaser";
import { api } from "../api/client";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create() {
    const { width, height } = this.scale;
    const label = this.add
      .text(width / 2, height / 2, "CityLife AI wird geladen …", {
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    api
      .login()
      .then((player) => {
        label.setText(`Willkommen, ${player.display_name}!`);
        this.time.delayedCall(400, () => {
          this.scene.start("WorldScene", { player });
        });
      })
      .catch((err) => {
        console.error(err);
        label.setText(
          "Backend nicht erreichbar.\nLäuft der Server unter " +
            (import.meta as any).env?.VITE_API_URL +
            "?"
        );
        label.setColor("#ff6b6b");
      });
  }
}
