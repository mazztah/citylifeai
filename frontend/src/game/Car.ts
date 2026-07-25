import Phaser from "phaser";

export type VehicleClass =
  | "player"
  | "taxi"
  | "delivery"
  | "police"
  | "civilian"
  | "suv";

const VEHICLE_COLORS: Record<VehicleClass, { body: number; accent: number }> = {
  player: { body: 0xffd23f, accent: 0xe8b800 },
  taxi: { body: 0xffc107, accent: 0x222222 },
  delivery: { body: 0xffffff, accent: 0x1565c0 },
  police: { body: 0x1a237e, accent: 0xffffff },
  civilian: { body: 0xe53935, accent: 0xb71c1c },
  suv: { body: 0x37474f, accent: 0x263238 },
};

/**
 * Mehrschichtiges Top-Down-Fahrzeug: Schatten, Karosserie, Fenster, Räder, Lichter.
 */
export class Car {
  sprite: Phaser.GameObjects.Container;
  private speed = 0;
  private angle = 0;
  private wheels: Phaser.GameObjects.Rectangle[] = [];
  private brakeLights: Phaser.GameObjects.Rectangle[] = [];
  private headLights: Phaser.GameObjects.Rectangle[] = [];
  private shadow: Phaser.GameObjects.Ellipse;

  private readonly maxSpeed: number;
  private readonly acceleration: number;
  private readonly brakingForce = 480;
  private readonly friction = 160;
  private readonly turnRateBase = 2.8;
  readonly vehicleClass: VehicleClass;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    vehicleClass: VehicleClass = "player",
    opts?: { maxSpeed?: number; acceleration?: number }
  ) {
    this.vehicleClass = vehicleClass;
    const colors = VEHICLE_COLORS[vehicleClass];
    const isSuv = vehicleClass === "suv" || vehicleClass === "delivery";
    const w = isSuv ? 30 : 28;
    const h = isSuv ? 16 : 14;

    this.maxSpeed = opts?.maxSpeed ?? (vehicleClass === "player" ? 280 : 180);
    this.acceleration = opts?.acceleration ?? (vehicleClass === "player" ? 280 : 160);

    // Schatten
    this.shadow = scene.add.ellipse(1, 3, w + 4, h + 2, 0x000000, 0.35);

    // Räder
    const wheelColor = 0x1a1a1a;
    const fl = scene.add.rectangle(-w * 0.28, -h * 0.55, 6, 3, wheelColor);
    const fr = scene.add.rectangle(-w * 0.28, h * 0.55, 6, 3, wheelColor);
    const rl = scene.add.rectangle(w * 0.28, -h * 0.55, 6, 3, wheelColor);
    const rr = scene.add.rectangle(w * 0.28, h * 0.55, 6, 3, wheelColor);
    this.wheels = [fl, fr, rl, rr];

    // Karosserie
    const body = scene.add.rectangle(0, 0, w, h, colors.body).setStrokeStyle(1.5, 0x111111);
    const roof = scene.add
      .rectangle(1, 0, w * 0.42, h * 0.72, colors.accent)
      .setAlpha(0.35);

    // Fenster
    const windshield = scene.add.rectangle(-w * 0.22, 0, w * 0.22, h * 0.62, 0x81d4fa, 0.85);
    const rearWindow = scene.add.rectangle(w * 0.2, 0, w * 0.16, h * 0.55, 0x4fc3f7, 0.7);

    // Scheinwerfer
    const hl1 = scene.add.rectangle(-w * 0.48, -h * 0.28, 3, 3, 0xfff9c4);
    const hl2 = scene.add.rectangle(-w * 0.48, h * 0.28, 3, 3, 0xfff9c4);
    this.headLights = [hl1, hl2];

    // Bremslichter
    const bl1 = scene.add.rectangle(w * 0.48, -h * 0.28, 3, 3, 0xb71c1c);
    const bl2 = scene.add.rectangle(w * 0.48, h * 0.28, 3, 3, 0xb71c1c);
    this.brakeLights = [bl1, bl2];

    // Taxi-Schild
    const extras: Phaser.GameObjects.GameObject[] = [];
    if (vehicleClass === "taxi") {
      extras.push(scene.add.rectangle(0, 0, 8, 4, 0x222222));
      extras.push(scene.add.rectangle(0, -1, 6, 2, 0xffc107));
    }
    if (vehicleClass === "police") {
      const lightBar = scene.add.rectangle(0, 0, 10, 3, 0x1565c0);
      extras.push(lightBar);
    }

    this.sprite = scene.add.container(x, y, [
      this.shadow,
      ...this.wheels,
      body,
      roof,
      windshield,
      rearWindow,
      ...this.headLights,
      ...this.brakeLights,
      ...extras,
    ]);
    this.sprite.setSize(w, h);
    this.sprite.setDepth(20);
  }

  update(dt: number, input: { up: boolean; down: boolean; left: boolean; right: boolean }) {
    let braking = false;
    if (input.up) {
      this.speed += this.acceleration * dt;
    } else if (input.down) {
      this.speed -= this.brakingForce * dt;
      braking = this.speed > 10;
    } else {
      if (this.speed > 0) this.speed = Math.max(0, this.speed - this.friction * dt);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + this.friction * dt);
    }
    this.speed = Phaser.Math.Clamp(this.speed, -this.maxSpeed * 0.45, this.maxSpeed);

    const speedFactor = Phaser.Math.Clamp(Math.abs(this.speed) / this.maxSpeed, 0.12, 1);
    const turnRate = this.turnRateBase * speedFactor * (this.speed < 0 ? -1 : 1);
    if (input.left) this.angle -= turnRate * dt;
    if (input.right) this.angle += turnRate * dt;

    this.sprite.x += Math.cos(this.angle) * this.speed * dt;
    this.sprite.y += Math.sin(this.angle) * this.speed * dt;
    this.sprite.rotation = this.angle;

    // Bremslichter aufhellen
    for (const bl of this.brakeLights) {
      bl.setFillStyle(braking ? 0xff1744 : 0xb71c1c);
    }
    // Scheinwerfer leicht
    for (const hl of this.headLights) {
      hl.setFillStyle(0xfffde7);
      hl.setAlpha(0.95);
    }
  }

  /** NPC: feste Geschwindigkeit entlang angle */
  updateNpc(dt: number, targetSpeed: number) {
    this.speed = Phaser.Math.Linear(this.speed, targetSpeed, 0.05);
    this.sprite.x += Math.cos(this.angle) * this.speed * dt;
    this.sprite.y += Math.sin(this.angle) * this.speed * dt;
    this.sprite.rotation = this.angle;
  }

  setAngle(rad: number) {
    this.angle = rad;
    this.sprite.rotation = rad;
  }

  get position() {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  get currentSpeedKmh() {
    return Math.round((Math.abs(this.speed) / 1.8) * 3.6 * 0.04);
  }

  destroy() {
    this.sprite.destroy();
  }
}
