import Phaser from "phaser";

export interface DriveInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

/**
 * Liest Tastatur (WASD + Pfeiltasten) und optional einen simplen Touch-Joystick
 * (touchState wird von der UIScene für mobile Steuerung gesetzt) aus.
 */
export class InputController {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;

  // Von außen (Touch-Buttons in der UIScene) gesetzt, überschreibt Tastatur additiv
  public touchState: DriveInput = { up: false, down: false, left: false, right: false };

  constructor(scene: Phaser.Scene) {
    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = scene.input.keyboard!.addKeys("W,A,S,D") as any;
  }

  read(): DriveInput {
    return {
      up: this.cursors.up.isDown || this.wasd.W.isDown || this.touchState.up,
      down: this.cursors.down.isDown || this.wasd.S.isDown || this.touchState.down,
      left: this.cursors.left.isDown || this.wasd.A.isDown || this.touchState.left,
      right: this.cursors.right.isDown || this.wasd.D.isDown || this.touchState.right,
    };
  }
}
