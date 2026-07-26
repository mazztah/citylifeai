import Phaser from "phaser";

export type VehicleClass =
  | "player"
  | "taxi"
  | "delivery"
  | "police"
  | "civilian"
  | "suv"
  | "motorcycle";

const VEHICLE_COLORS: Record<VehicleClass, { body: number; accent: number }> = {
  player: { body: 0xffd23f, accent: 0xe8b800 },
  taxi: { body: 0xffc107, accent: 0x222222 },
  delivery: { body: 0xffffff, accent: 0x1565c0 },
  police: { body: 0x1a237e, accent: 0xffffff },
  civilian: { body: 0xe53935, accent: 0xb71c1c },
  suv: { body: 0x37474f, accent: 0x263238 },
  motorcycle: { body: 0x263238, accent: 0xff7043 },
};

/** Zufällige Lack-Varianten für Zivil-Fahrzeuge, damit geparkte Autos nicht alle gleich aussehen. */
const CIVILIAN_PALETTE = [0xe53935, 0x43a047, 0x1e88e5, 0x8e24aa, 0xfb8c00, 0x546e7a, 0xd81b60];

export type DrivableCheck = (x: number, y: number) => boolean;

export class Car {
  sprite: Phaser.GameObjects.Container;
  private speed = 0;
  private angle = 0;
  private brakeLights: Phaser.GameObjects.Rectangle[] = [];
  private headLights: Phaser.GameObjects.Rectangle[] = [];
  private bodyRect: Phaser.GameObjects.Rectangle;
  private smokeEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private sceneRef: Phaser.Scene;

  private readonly maxSpeedBase: number;
  private readonly acceleration: number;
  private readonly brakingForce: number;
  private readonly friction: number;
  private readonly turnRateBase: number;
  private readonly minTurnFactor: number;
  readonly vehicleClass: VehicleClass;
  readonly isMotorcycle: boolean;

  /** 0–10 Kollisionen; ab 4 Rauch, ab 10 total */
  collisionCount = 0;
  wrecked = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    vehicleClass: VehicleClass = "player",
    opts?: { maxSpeed?: number; acceleration?: number; colorVariant?: number }
  ) {
    this.sceneRef = scene;
    this.vehicleClass = vehicleClass;
    this.isMotorcycle = vehicleClass === "motorcycle";
    const colors = VEHICLE_COLORS[vehicleClass];
    const bodyColor =
      opts?.colorVariant != null && vehicleClass === "civilian"
        ? CIVILIAN_PALETTE[opts.colorVariant % CIVILIAN_PALETTE.length]
        : colors.body;
    const isSuv = vehicleClass === "suv" || vehicleClass === "delivery";
    const w = this.isMotorcycle ? 16 : isSuv ? 26 : 24;
    const h = this.isMotorcycle ? 7 : isSuv ? 14 : 12;

    // Spürbar direktere, agilere Fahrphysik – v.a. für den Spieler.
    this.maxSpeedBase =
      opts?.maxSpeed ?? (vehicleClass === "player" ? 300 : this.isMotorcycle ? 190 : 150);
    this.acceleration =
      opts?.acceleration ?? (vehicleClass === "player" ? 400 : this.isMotorcycle ? 320 : 160);
    this.brakingForce = vehicleClass === "player" ? 620 : 480;
    this.friction = vehicleClass === "player" ? 110 : 160;
    this.turnRateBase = vehicleClass === "player" ? (this.isMotorcycle ? 4.4 : 3.8) : 2.8;
    // Auch bei niedrigem Tempo spürbar lenkbar – vorher fühlte sich das "schwergängig" an.
    this.minTurnFactor = vehicleClass === "player" ? 0.4 : 0.12;

    const extras: Phaser.GameObjects.GameObject[] = [];
    let parts: Phaser.GameObjects.GameObject[];

    if (this.isMotorcycle) {
      const shadow = scene.add.ellipse(1, 2, w + 3, h + 3, 0x000000, 0.3);
      const wheelR = scene.add.circle(w * 0.34, 0, 3.4, 0x111111);
      const wheelF = scene.add.circle(-w * 0.34, 0, 3.4, 0x111111);
      this.bodyRect = scene.add.rectangle(0, 0, w * 0.62, h, bodyColor).setStrokeStyle(1, 0x111111);
      const seat = scene.add.rectangle(w * 0.05, -1.5, w * 0.32, 2.4, 0x1a1a1a);
      const windshieldM = scene.add.rectangle(-w * 0.32, -0.5, 2.4, 4.5, 0x81d4fa, 0.85);
      const hl1 = scene.add.rectangle(-w * 0.42, 0, 2.4, 2.4, 0xfff9c4);
      this.headLights = [hl1];
      const bl1 = scene.add.rectangle(w * 0.42, 0, 2.2, 2.2, 0xb71c1c);
      this.brakeLights = [bl1];
      parts = [shadow, wheelR, wheelF, this.bodyRect, seat, windshieldM, hl1, bl1];
    } else {
      const shadow = scene.add.ellipse(1, 3, w + 4, h + 2, 0x000000, 0.3);
      const fl = scene.add.rectangle(-w * 0.28, -h * 0.55, 5, 3, 0x1a1a1a);
      const fr = scene.add.rectangle(-w * 0.28, h * 0.55, 5, 3, 0x1a1a1a);
      const rl = scene.add.rectangle(w * 0.28, -h * 0.55, 5, 3, 0x1a1a1a);
      const rr = scene.add.rectangle(w * 0.28, h * 0.55, 5, 3, 0x1a1a1a);

      this.bodyRect = scene.add.rectangle(0, 0, w, h, bodyColor).setStrokeStyle(1, 0x111111);
      const roof = scene.add.rectangle(1, 0, w * 0.42, h * 0.72, colors.accent).setAlpha(0.35);
      const windshield = scene.add.rectangle(-w * 0.22, 0, w * 0.22, h * 0.62, 0x81d4fa, 0.85);
      const rearWindow = scene.add.rectangle(w * 0.2, 0, w * 0.16, h * 0.55, 0x4fc3f7, 0.7);

      const hl1 = scene.add.rectangle(-w * 0.48, -h * 0.28, 3, 3, 0xfff9c4);
      const hl2 = scene.add.rectangle(-w * 0.48, h * 0.28, 3, 3, 0xfff9c4);
      this.headLights = [hl1, hl2];
      const bl1 = scene.add.rectangle(w * 0.48, -h * 0.28, 3, 3, 0xb71c1c);
      const bl2 = scene.add.rectangle(w * 0.48, h * 0.28, 3, 3, 0xb71c1c);
      this.brakeLights = [bl1, bl2];

      if (vehicleClass === "taxi") {
        extras.push(scene.add.rectangle(0, 0, 8, 4, 0x222222));
        extras.push(scene.add.rectangle(0, -1, 6, 2, 0xffc107));
      }
      if (vehicleClass === "police") {
        const bar = scene.add.rectangle(0, 0, 10, 3, 0x1565c0);
        extras.push(bar);
        // Blaulicht-Puls – schön anzusehen und liest sich sofort als "Polizei".
        let blueOn = true;
        scene.time.addEvent({
          delay: 260,
          loop: true,
          callback: () => {
            if (!bar.active) return;
            blueOn = !blueOn;
            bar.setFillStyle(blueOn ? 0x1565c0 : 0xff1744);
          },
        });
      }
      parts = [
        shadow,
        fl,
        fr,
        rl,
        rr,
        this.bodyRect,
        roof,
        windshield,
        rearWindow,
        ...this.headLights,
        ...this.brakeLights,
        ...extras,
      ];
    }

    this.sprite = scene.add.container(x, y, parts);
    this.sprite.setSize(w, h);
    this.sprite.setDepth(20);

    // Partikel-Textur einmalig
    if (!scene.textures.exists("smoke_px")) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x888888, 1);
      g.fillCircle(4, 4, 4);
      g.generateTexture("smoke_px", 8, 8);
      g.destroy();
    }
  }

  get maxSpeed() {
    // Schaden drosselt Tempo
    const factor = this.wrecked ? 0 : Math.max(0.25, 1 - this.collisionCount * 0.07);
    return this.maxSpeedBase * factor;
  }

  /** Kollision registrieren – gibt true wenn gerade wrecked geworden */
  registerCollision(): boolean {
    if (this.wrecked) return false;
    this.collisionCount = Math.min(10, this.collisionCount + 1);
    this.updateDamageVisuals();
    if (this.collisionCount >= 10) {
      this.wrecked = true;
      this.speed = 0;
      return true;
    }
    return false;
  }

  private updateDamageVisuals() {
    const c = this.collisionCount;
    // Karosserie dunkler mit steigendem Schaden
    if (c >= 2) {
      const t = c / 10;
      const r = Math.floor(255 * (1 - t * 0.6));
      const g = Math.floor(210 * (1 - t * 0.7));
      const b = Math.floor(63 * (1 - t * 0.3));
      this.bodyRect.setFillStyle(Phaser.Display.Color.GetColor(r, g, b));
    }

    if (c >= 4 && !this.smokeEmitter) {
      this.smokeEmitter = this.sceneRef.add.particles(0, 0, "smoke_px", {
        speed: { min: 8, max: 28 },
        angle: { min: 240, max: 300 },
        scale: { start: 0.5, end: 1.8 },
        alpha: { start: 0.45, end: 0 },
        lifespan: 700,
        frequency: 80,
        follow: this.sprite,
        followOffset: { x: 8, y: -4 },
        quantity: 1,
      });
      this.smokeEmitter.setDepth(21);
    }
    if (this.smokeEmitter) {
      const intensity = Math.min(1, (c - 3) / 7);
      this.smokeEmitter.setFrequency(Math.max(25, 90 - intensity * 70));
      this.smokeEmitter.setQuantity(1 + Math.floor(intensity * 3));
    }
  }

  resetDamage() {
    this.collisionCount = 0;
    this.wrecked = false;
    this.smokeEmitter?.destroy();
    this.smokeEmitter = null;
    this.bodyRect.setFillStyle(VEHICLE_COLORS[this.vehicleClass].body);
  }

  /** Alias für die Werkstatt-Reparatur – funktional identisch zu resetDamage(). */
  repair() {
    this.resetDamage();
  }

  update(
    dt: number,
    input: {
      up: boolean;
      down: boolean;
      left: boolean;
      right: boolean;
      axisX?: number;
      axisY?: number;
      analog?: boolean;
    },
    isDrivable?: DrivableCheck
  ) {
    if (this.wrecked) {
      this.speed = 0;
      return;
    }

    let braking = false;
    const analog = !!input.analog && (input.axisX != null || input.axisY != null);
    const axisY = input.axisY ?? 0;
    const axisX = input.axisX ?? 0;

    if (analog) {
      // Joystick: oben = Gas (axisY negativ im Screen-Space)
      const throttle = -axisY;
      if (throttle > 0.15) {
        this.speed += this.acceleration * throttle * dt;
      } else if (throttle < -0.2) {
        this.speed -= this.brakingForce * (-throttle) * dt;
        braking = this.speed > 10;
      } else {
        if (this.speed > 0) this.speed = Math.max(0, this.speed - this.friction * dt);
        else if (this.speed < 0) this.speed = Math.min(0, this.speed + this.friction * dt);
      }
      this.speed = Phaser.Math.Clamp(this.speed, -this.maxSpeed * 0.4, this.maxSpeed);
      const speedFactor = Phaser.Math.Clamp(
        Math.abs(this.speed) / this.maxSpeedBase,
        this.minTurnFactor,
        1
      );
      if (Math.abs(axisX) > 0.1) {
        this.angle += axisX * this.turnRateBase * speedFactor * (this.speed < 0 ? -1 : 1) * dt;
      }
    } else {
      if (input.up) this.speed += this.acceleration * dt;
      else if (input.down) {
        this.speed -= this.brakingForce * dt;
        braking = this.speed > 10;
      } else {
        if (this.speed > 0) this.speed = Math.max(0, this.speed - this.friction * dt);
        else if (this.speed < 0) this.speed = Math.min(0, this.speed + this.friction * dt);
      }
      this.speed = Phaser.Math.Clamp(this.speed, -this.maxSpeed * 0.45, this.maxSpeed);
      const speedFactor = Phaser.Math.Clamp(
        Math.abs(this.speed) / this.maxSpeedBase,
        this.minTurnFactor,
        1
      );
      const turnRate = this.turnRateBase * speedFactor * (this.speed < 0 ? -1 : 1);
      if (input.left) this.angle -= turnRate * dt;
      if (input.right) this.angle += turnRate * dt;
    }

    const dx = Math.cos(this.angle) * this.speed * dt;
    const dy = Math.sin(this.angle) * this.speed * dt;
    const ox = this.sprite.x;
    const oy = this.sprite.y;

    if (!isDrivable) {
      this.sprite.x = ox + dx;
      this.sprite.y = oy + dy;
    } else {
      const nx = ox + dx;
      const ny = oy + dy;
      if (isDrivable(nx, ny)) {
        this.sprite.x = nx;
        this.sprite.y = ny;
      } else {
        let moved = false;
        if (isDrivable(nx, oy)) {
          this.sprite.x = nx;
          moved = true;
        }
        if (isDrivable(this.sprite.x, ny)) {
          this.sprite.y = ny;
          moved = true;
        }
        if (!moved) this.speed *= 0.4;
        else this.speed *= 0.92;
      }
    }

    this.sprite.rotation = this.angle;
    for (const bl of this.brakeLights) bl.setFillStyle(braking ? 0xff1744 : 0xb71c1c);
  }

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

  get currentAngle() {
    return this.angle;
  }

  get position() {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  get currentSpeedKmh() {
    return Math.round((Math.abs(this.speed) / 1.6) * 3.6 * 0.04);
  }

  /** Bounding radius für Auto-Auto-Kollision */
  get radius() {
    return this.isMotorcycle ? 9 : 14;
  }

  destroy() {
    this.smokeEmitter?.destroy();
    this.sprite.destroy();
  }
}
