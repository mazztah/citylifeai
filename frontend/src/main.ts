import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { WorldScene } from "./scenes/WorldScene";
import { UIScene } from "./scenes/UIScene";
import { GAME_WIDTH, GAME_HEIGHT } from "./config";

const tg = (window as any)?.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.disableVerticalSwipes?.();
}

// Mobile: niedrigere Pixel-Ratio spart GPU
const isMobile =
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 0 && window.innerWidth < 900);
const maxDpr = isMobile ? 1.5 : 2;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#0f1115",
  // Volle Fläche, keine abgeschnittenen Ränder durch Letterboxing
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  render: {
    antialias: !isMobile,
    pixelArt: false,
    roundPixels: true,
    powerPreference: "high-performance",
  },
  fps: {
    target: isMobile ? 40 : 60,
    min: 20,
    forceSetTimeOut: isMobile,
  },
  physics: {
    default: undefined,
  },
  input: {
    // 2 aktive Touch-Pointer nötig für Zwei-Finger-Pinch-Zoom auf dem Smartphone
    activePointers: 2,
  },
  scene: [BootScene, WorldScene, UIScene],
  banner: false,
});

// DPR begrenzen
try {
  const canvas = document.querySelector("#game-root canvas") as HTMLCanvasElement | null;
  if (canvas && window.devicePixelRatio > maxDpr) {
    // Phaser setzt DPR intern; Scale.RESIZE + niedrigere target FPS helfen bereits
  }
} catch {
  /* ignore */
}
