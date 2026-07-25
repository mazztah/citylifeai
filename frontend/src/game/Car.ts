import Phaser from "phaser";

/**
 * Einfaches, aber angenehm zu steuerndes Top-Down-Fahrmodell:
 * - W/Pfeil hoch: beschleunigen
 * - S/Pfeil runter: bremsen/rückwärts
 * - A/D bzw. Pfeil links/rechts: lenken (stärker bei höherer Geschwindigkeit gedämpft, wie im echten Fahrgefühl)
 */
export class Car {
  sprite: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Rectangle;
  private speed = 0;
  private angle = 0; // Radiant

  private readonly maxSpeed = 260; // px/s
  private readonly acceleration = 260; // px/s^2
  private readonly brakingForce = 420;
  private readonly friction = 140;
  private readonly turnRateBase = 2.6; // rad/s bei niedriger Geschwindigkeit

  constructor(scene: Phaser.Scene, x: number, y: number, color = 0xffd23f) {
    this.body = scene.add.rectangle(0, 0, 26, 14, color).setStrokeStyle(2, 0x1a1a1a);
    const windshield = scene.add.rectangle(4, 0, 8, 10, 0x2b3a55);
    this.sprite = scene.add.container(x, y, [this.body, windshield]);
    this.sprite.setSize(26, 14);
  }

  update(dt: number, input: { up: boolean; down: boolean; left: boolean; right: boolean }) {
    if (input.up) {
      this.speed += this.acceleration * dt;
    } else if (input.down) {
      this.speed -= this.brakingForce * dt;
    } else {
      // Rollreibung bringt das Auto von selbst zum Stehen
      if (this.speed > 0) this.speed = Math.max(0, this.speed - this.friction * dt);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + this.friction * dt);
    }
    this.speed = Phaser.Math.Clamp(this.speed, -this.maxSpeed * 0.5, this.maxSpeed);

    // Lenkung nur wirksam, wenn das Auto sich bewegt; bei hoher Geschwindigkeit sanfter
    const speedFactor = Phaser.Math.Clamp(Math.abs(this.speed) / this.maxSpeed, 0.15, 1);
    const turnRate = this.turnRateBase * speedFactor * (this.speed < 0 ? -1 : 1);
    if (input.left) this.angle -= turnRate * dt;
    if (input.right) this.angle += turnRate * dt;

    this.sprite.x += Math.cos(this.angle) * this.speed * dt;
    this.sprite.y += Math.sin(this.angle) * this.speed * dt;
    this.sprite.rotation = this.angle;
  }

  get position() {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  get currentSpeedKmh() {
    // grobe Umrechnung px/s -> km/h für die HUD-Anzeige
    return Math.round((Math.abs(this.speed) / 2.2) * 3.6 * 0.05);
  }
}
