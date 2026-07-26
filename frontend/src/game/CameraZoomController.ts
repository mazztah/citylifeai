import Phaser from "phaser";

/**
 * Steuert den Kamera-Zoom manuell:
 *  – Mausrad am PC
 *  – Zwei-Finger-Pinch auf dem Smartphone (benötigt activePointers >= 2 in der Game-Config)
 *
 * Der automatische Zoom-Wechsel beim Ein-/Aussteigen (Fahren/Laufen) ruft weiterhin
 * `jumpTo()` auf – der Nutzer kann von dort aus wieder frei heran-/herauszoomen.
 */
export class CameraZoomController {
  private zoom: number;
  private pinchStartDist: number | null = null;
  private pinchStartZoom = 1;

  constructor(
    private scene: Phaser.Scene,
    private camera: Phaser.Cameras.Scene2D.Camera,
    private minZoom: number,
    private maxZoom: number,
    initialZoom: number
  ) {
    this.zoom = initialZoom;
    this.camera.setZoom(this.zoom);
    this.bindWheel();
    this.bindPinch();
  }

  private bindWheel() {
    this.scene.input.on(
      "wheel",
      (_pointer: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number) => {
        // Sanfte, exponentielle Skalierung – fühlt sich bei jeder Zoomstufe gleich an.
        const factor = Math.exp(-dy * 0.0011);
        this.setZoom(this.zoom * factor);
      }
    );
  }

  private bindPinch() {
    const handler = () => this.handlePinch();
    this.scene.input.on("pointermove", handler);
    this.scene.input.on("pointerdown", handler);
    this.scene.input.on("pointerup", () => {
      this.pinchStartDist = null;
    });
    this.scene.input.on("pointerupoutside", () => {
      this.pinchStartDist = null;
    });
  }

  private handlePinch() {
    const p2 = this.scene.input.pointer2;
    // Kein zweiter aktiver Pointer -> auf Desktop mit Maus praktisch immer der Fall.
    // Früh raus, bevor überhaupt der erste Pointer/Distanz berechnet wird.
    if (!p2 || !p2.isDown) {
      this.pinchStartDist = null;
      return;
    }
    const p1 = this.scene.input.pointer1;
    if (!p1 || !p1.isDown) {
      this.pinchStartDist = null;
      return;
    }
    const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
    if (this.pinchStartDist == null) {
      this.pinchStartDist = dist;
      this.pinchStartZoom = this.zoom;
      return;
    }
    if (this.pinchStartDist < 1) return;
    const scale = dist / this.pinchStartDist;
    this.setZoom(this.pinchStartZoom * scale);
  }

  setZoom(z: number) {
    this.zoom = Phaser.Math.Clamp(z, this.minZoom, this.maxZoom);
    this.camera.setZoom(this.zoom);
  }

  /** Für automatische Wechsel (Fahren/Laufen) – weich animiert. */
  jumpTo(z: number, duration = 380) {
    this.zoom = Phaser.Math.Clamp(z, this.minZoom, this.maxZoom);
    this.scene.tweens.add({
      targets: this.camera,
      zoom: this.zoom,
      duration,
      ease: "Sine.easeInOut",
    });
  }

  get current() {
    return this.zoom;
  }
}
