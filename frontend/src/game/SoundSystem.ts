import Phaser from "phaser";

type SoundKey = "music" | "ambient" | "engine" | "brake" | "horn" | "siren" | "crashCar" | "crashPed" | "crashBuilding" | "repair" | "angry" | "door";

const TONES: Record<SoundKey, { freq: number; type: OscillatorType; gain: number; dur: number }> = {
  music: { freq: 110, type: "sine", gain: 0.015, dur: 0.18 },
  ambient: { freq: 180, type: "triangle", gain: 0.01, dur: 0.12 },
  engine: { freq: 70, type: "sawtooth", gain: 0.018, dur: 0.09 },
  brake: { freq: 420, type: "square", gain: 0.018, dur: 0.08 },
  horn: { freq: 520, type: "square", gain: 0.04, dur: 0.18 },
  siren: { freq: 780, type: "sine", gain: 0.045, dur: 0.22 },
  crashCar: { freq: 95, type: "sawtooth", gain: 0.08, dur: 0.16 },
  crashPed: { freq: 240, type: "triangle", gain: 0.045, dur: 0.14 },
  crashBuilding: { freq: 70, type: "sawtooth", gain: 0.09, dur: 0.22 },
  repair: { freq: 680, type: "triangle", gain: 0.04, dur: 0.16 },
  angry: { freq: 300, type: "square", gain: 0.035, dur: 0.13 },
  door: { freq: 150, type: "sine", gain: 0.03, dur: 0.08 },
};

/** Tiny WebAudio synth: no assets, pooled/cooldown-limited, prevents overlapping spam. */
export class SoundSystem {
  private ctx: AudioContext | null = null;
  private last = new Map<SoundKey, number>();
  private musicTimer?: Phaser.Time.TimerEvent;
  private ambientTimer?: Phaser.Time.TimerEvent;

  constructor(private scene: Phaser.Scene) {
    const unlock = () => this.ensure();
    scene.input.once("pointerdown", unlock);
    scene.input.keyboard?.once("keydown", unlock);
  }

  private ensure(): AudioContext | null {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  play(key: SoundKey, volume = 1, cooldownMs = 120) {
    const now = performance.now();
    if ((this.last.get(key) ?? 0) + cooldownMs > now) return;
    this.last.set(key, now);
    const ctx = this.ensure();
    if (!ctx) return;
    const tone = TONES[key];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.freq, ctx.currentTime);
    if (key === "siren") osc.frequency.linearRampToValueAtTime(tone.freq * 0.62, ctx.currentTime + tone.dur);
    gain.gain.setValueAtTime(tone.gain * volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + tone.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + tone.dur);
  }

  startBeds() {
    if (this.musicTimer) return;
    this.musicTimer = this.scene.time.addEvent({ delay: 900, loop: true, callback: () => this.play("music", 0.75, 0) });
    this.ambientTimer = this.scene.time.addEvent({ delay: 1800, loop: true, callback: () => this.play("ambient", 0.8, 0) });
  }

  update(speedKmh: number, wanted: boolean, policeDistance: number | null) {
    if (speedKmh > 6) this.play("engine", Math.min(1, 0.35 + speedKmh / 95), 95);
    if (wanted && policeDistance != null) this.play("siren", Phaser.Math.Clamp(1.2 - policeDistance / 430, 0.2, 1), 260);
  }

  destroy() {
    this.musicTimer?.destroy();
    this.ambientTimer?.destroy();
    void this.ctx?.close();
  }
}
