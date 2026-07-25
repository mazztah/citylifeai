import Phaser from "phaser";

export interface DriveInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /** -1..1 analog (Joystick) */
  axisX: number;
  axisY: number;
  /** true wenn Joystick aktiv */
  analog: boolean;
}

/**
 * Tastatur + virtueller Joystick im unteren Bildschirmdrittel (#vjoy-zone).
 */
export class InputController {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private wasd: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key> | null = null;

  public touchState: DriveInput = {
    up: false,
    down: false,
    left: false,
    right: false,
    axisX: 0,
    axisY: 0,
    analog: false,
  };

  private joyActive = false;
  private joyOrigin = { x: 0, y: 0 };
  private readonly maxRadius = 48;

  constructor(scene: Phaser.Scene) {
    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.wasd = scene.input.keyboard.addKeys("W,A,S,D") as any;
    }
    this.bindVirtualJoystick();
  }

  private bindVirtualJoystick() {
    const zone = document.getElementById("vjoy-zone");
    const base = document.getElementById("vjoy-base");
    const knob = document.getElementById("vjoy-knob");
    if (!zone || !base || !knob) return;

    const setAxes = (dx: number, dy: number) => {
      const len = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(len, this.maxRadius);
      const nx = (dx / len) * clamped;
      const ny = (dy / len) * clamped;
      knob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
      const ax = nx / this.maxRadius;
      const ay = ny / this.maxRadius;
      this.touchState.axisX = ax;
      this.touchState.axisY = ay;
      this.touchState.analog = true;
      // Diskret für Kompatibilität
      this.touchState.left = ax < -0.25;
      this.touchState.right = ax > 0.25;
      this.touchState.up = ay < -0.2;
      this.touchState.down = ay > 0.35;
    };

    const clear = () => {
      this.joyActive = false;
      base.style.display = "none";
      knob.style.transform = "translate(-50%, -50%)";
      this.touchState = {
        up: false,
        down: false,
        left: false,
        right: false,
        axisX: 0,
        axisY: 0,
        analog: false,
      };
    };

    const start = (clientX: number, clientY: number) => {
      this.joyActive = true;
      this.joyOrigin = { x: clientX, y: clientY };
      base.style.display = "block";
      base.style.left = `${clientX}px`;
      base.style.top = `${clientY}px`;
      setAxes(0, 0);
    };

    const move = (clientX: number, clientY: number) => {
      if (!this.joyActive) return;
      setAxes(clientX - this.joyOrigin.x, clientY - this.joyOrigin.y);
    };

    zone.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        start(t.clientX, t.clientY);
      },
      { passive: false }
    );
    zone.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        move(t.clientX, t.clientY);
      },
      { passive: false }
    );
    zone.addEventListener("touchend", (e) => {
      e.preventDefault();
      clear();
    });
    zone.addEventListener("touchcancel", () => clear());

    // Maus (Desktop-Test)
    zone.addEventListener("mousedown", (e) => {
      start(e.clientX, e.clientY);
    });
    window.addEventListener("mousemove", (e) => {
      if (this.joyActive) move(e.clientX, e.clientY);
    });
    window.addEventListener("mouseup", () => clear());
  }

  read(): DriveInput {
    const kUp = !!(this.cursors?.up.isDown || this.wasd?.W.isDown);
    const kDown = !!(this.cursors?.down.isDown || this.wasd?.S.isDown);
    const kLeft = !!(this.cursors?.left.isDown || this.wasd?.A.isDown);
    const kRight = !!(this.cursors?.right.isDown || this.wasd?.D.isDown);

    if (this.touchState.analog) {
      return { ...this.touchState };
    }
    return {
      up: kUp || this.touchState.up,
      down: kDown || this.touchState.down,
      left: kLeft || this.touchState.left,
      right: kRight || this.touchState.right,
      axisX: kLeft ? -1 : kRight ? 1 : 0,
      axisY: kUp ? -1 : kDown ? 1 : 0,
      analog: kUp || kDown || kLeft || kRight,
    };
  }
}
