import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { WorldScene } from "./scenes/WorldScene";
import { UIScene } from "./scenes/UIScene";
import { GAME_WIDTH, GAME_HEIGHT } from "./config";

// Telegram Mini App: volle Höhe anfordern, Rand-Swipe-Schließen verhindern
const tg = (window as any)?.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.disableVerticalSwipes?.();
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#0f1115",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: undefined, // eigene, einfache Fahrphysik in Car.ts statt Arcade Physics
  },
  scene: [BootScene, WorldScene, UIScene],
});
