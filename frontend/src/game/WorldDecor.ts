import Phaser from "phaser";
import { RoadGraph } from "./RoadGraph";
import { Car, type VehicleClass } from "./Car";

export interface TrafficEntry {
  car: Car;
  path: { x: number; y: number }[];
  idx: number;
  speed: number;
  isPolice: boolean;
  /** true = verfolgt aktuell den Spieler statt der Patrouillenroute */
  pursuing: boolean;
}

export interface ParkedVehicle {
  car: Car;
  taken: boolean;
}

/**
 * Belebt die Welt – reduziert auf Mobile (weniger Traffic/Peds/Bäume).
 */
export class WorldDecor {
  private staticObjects: Phaser.GameObjects.GameObject[] = [];
  traffic: TrafficEntry[] = [];
  parked: ParkedVehicle[] = [];
  peds: {
    sprite: Phaser.GameObjects.Container;
    body: Phaser.GameObjects.Rectangle;
    head: Phaser.GameObjects.Arc;
    legL: Phaser.GameObjects.Rectangle;
    legR: Phaser.GameObjects.Rectangle;
    armL: Phaser.GameObjects.Rectangle;
    armR: Phaser.GameObjects.Rectangle;
    path: { x: number; y: number }[];
    idx: number;
    phase: number;
    emotion: "neutral" | "angry" | "scared";
  }[] = [];

  constructor(
    private scene: Phaser.Scene,
    private graph: RoadGraph
  ) {}

  spawnAll(mobile: boolean) {
    if (!this.graph.roads.length) return;
    this.spawnTreesNearParks(mobile ? 3 : 6);
    if (!mobile) this.spawnStreetLights();
    this.spawnTraffic(mobile ? 3 : 6);
    this.spawnPedestrians(mobile ? 5 : 8);
    this.spawnParkedVehicles(mobile ? 4 : 8);
  }

  /** Parkende Autos/Motorräder am Straßenrand – der Spieler kann sie benutzen. */
  private spawnParkedVehicles(count: number) {
    const roads = this.graph.roads.filter((r) => r.points.length >= 2 && r.kind !== "tertiary");
    if (!roads.length) return;
    for (let i = 0; i < count; i++) {
      const road = roads[Math.floor(Math.random() * roads.length)];
      const idx = Math.floor(Math.random() * (road.points.length - 1));
      const a = road.points[idx];
      const b = road.points[idx + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const side = Math.random() > 0.5 ? 1 : -1;
      const offset = side * 26;
      const px = a.x + (-dy / len) * offset;
      const py = a.y + (dx / len) * offset;
      const angle = Math.atan2(dy, dx);
      const isMoto = Math.random() < 0.3;
      const cls: VehicleClass = isMoto ? "motorcycle" : "civilian";
      const car = new Car(this.scene, px, py, cls, {
        colorVariant: Math.floor(Math.random() * 7),
      });
      car.setAngle(angle);
      car.sprite.setDepth(9);
      car.sprite.setAlpha(0.96);
      this.parked.push({ car, taken: false });
    }
  }

  /** Nächstes freies geparktes Fahrzeug in Reichweite (für "Einsteigen"). */
  findNearbyParkedVehicle(x: number, y: number, maxDist = 34): ParkedVehicle | null {
    let best: ParkedVehicle | null = null;
    let bestDist = maxDist;
    for (const pv of this.parked) {
      if (pv.taken) continue;
      const d = Phaser.Math.Distance.Between(x, y, pv.car.position.x, pv.car.position.y);
      if (d < bestDist) {
        bestDist = d;
        best = pv;
      }
    }
    return best;
  }

  /** Entfernt ein bereits übernommenes Fahrzeug aus dem Deko-Pool. */
  removeParkedVehicle(pv: ParkedVehicle) {
    this.parked = this.parked.filter((p) => p !== pv);
  }

  /** Setzt ein zurückgelassenes Fahrzeug als "geparkt" wieder in die Welt. */
  releaseAsParked(car: Car) {
    car.sprite.setDepth(9);
    this.parked.push({ car, taken: false });
  }

  private spawnTreesNearParks(perPark: number) {
    const parks = this.graph.pois.filter((p) => p.category === "park");
    for (const park of parks) {
      for (let i = 0; i < perPark; i++) {
        const ang = (i / perPark) * Math.PI * 2;
        const r = 40 + Math.random() * 40;
        this.addTree(park.x + Math.cos(ang) * r, park.y + Math.sin(ang) * r);
      }
    }
  }

  private addTree(x: number, y: number) {
    const shadow = this.scene.add.ellipse(x + 2, y + 4, 12, 7, 0x000000, 0.22).setDepth(2);
    const trunk = this.scene.add.rectangle(x, y + 2, 3, 7, 0x5d4037).setDepth(3);
    const canopy = this.scene.add.circle(x, y - 3, 8, 0x2e7d32, 0.9).setDepth(3);
    this.staticObjects.push(shadow, trunk, canopy);
  }

  private spawnStreetLights() {
    let n = 0;
    for (const road of this.graph.roads) {
      if (road.kind === "tertiary") continue;
      for (let i = 0; i < road.points.length - 1; i += 3) {
        if (n > 40) return;
        const p = road.points[i];
        const next = road.points[i + 1];
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const ox = (-dy / len) * 14;
        const oy = (dx / len) * 14;
        const pole = this.scene.add.rectangle(p.x + ox, p.y + oy, 2, 14, 0x455a64).setDepth(4);
        const head = this.scene.add.circle(p.x + ox, p.y + oy - 8, 2.5, 0xfff59d, 0.8).setDepth(4);
        this.staticObjects.push(pole, head);
        n++;
      }
    }
  }

  private spawnTraffic(count: number) {
    const roads = this.graph.roads.filter((r) => r.points.length >= 2);
    if (!roads.length) return;
    // Ein Streifenwagen ist immer dabei, Rest gemischter Verkehr.
    const classes: VehicleClass[] = ["taxi", "civilian", "delivery", "suv", "police"];

    for (let i = 0; i < count; i++) {
      const road = roads[Math.floor(Math.random() * roads.length)];
      const path = [...road.points];
      if (Math.random() > 0.5) path.reverse();
      const start = path[0];
      const next = path[1] || start;
      const angle = Math.atan2(next.y - start.y, next.x - start.x);
      const isPolice = i === 0 || (count > 5 && i === Math.floor(count / 2));
      const cls: VehicleClass = isPolice ? "police" : classes[i % (classes.length - 1)];
      const car = new Car(this.scene, start.x, start.y, cls);
      car.setAngle(angle);
      car.sprite.setDepth(12);
      this.traffic.push({
        car,
        path,
        idx: 0,
        speed: 35 + Math.random() * 45,
        isPolice: cls === "police",
        pursuing: false,
      });
    }
  }

  private spawnPedestrians(count: number) {
    const roads = this.graph.roads;
    const colors = [0xffcc80, 0x90caf9, 0xf48fb1, 0xce93d8, 0xa5d6a7];
    for (let i = 0; i < count; i++) {
      const road = roads[Math.floor(Math.random() * roads.length)];
      if (!road || road.points.length < 2) continue;
      const path = road.points.map((p, idx) => {
        const n = road.points[Math.min(idx + 1, road.points.length - 1)];
        const dx = n.x - p.x;
        const dy = n.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        return { x: p.x + (-dy / len) * 16, y: p.y + (dx / len) * 16 };
      });
      const c = colors[i % colors.length];
      // Kleine Figur mit Armen + Beinen, die beim Laufen gegenläufig schwingen und leicht hüpfen.
      const shadow = this.scene.add.ellipse(0, 5.5, 7, 2.6, 0x000000, 0.28);
      const legL = this.scene.add.rectangle(-1.5, 3, 2, 5, 0x37474f);
      const legR = this.scene.add.rectangle(1.5, 3, 2, 5, 0x455a64);
      const armL = this.scene.add.rectangle(-3, -1, 1.6, 4.5, c).setAlpha(0.9);
      const armR = this.scene.add.rectangle(3, -1, 1.6, 4.5, c).setAlpha(0.9);
      const body = this.scene.add.rectangle(0, -2, 5, 7, c);
      const head = this.scene.add.circle(0, -7, 2.5, 0xffe0b2);
      const hair = this.scene.add.rectangle(0, -9, 4, 1.5, i % 2 ? 0x3e2723 : 0xf9a825);
      const eyeL = this.scene.add.circle(-0.9, -7.4, 0.35, 0x111111);
      const eyeR = this.scene.add.circle(0.9, -7.4, 0.35, 0x111111);
      const mouth = this.scene.add.rectangle(0, -6.2, 1.6, 0.35, 0x5d4037);
      const container = this.scene.add
        .container(path[0].x, path[0].y, [shadow, legL, legR, armL, armR, body, head, hair, eyeL, eyeR, mouth])
        .setDepth(11);
      this.peds.push({
        sprite: container,
        body,
        head,
        legL,
        legR,
        armL,
        armR,
        path,
        idx: 0,
        phase: Math.random() * Math.PI * 2,
        emotion: "neutral",
      });
    }
  }

  /**
   * @param player Wenn gesetzt, jagt jedes `pursuing`-Polizeiauto diese Position direkt an.
   */
  update(dt: number, player?: { x: number; y: number }) {
    for (const t of this.traffic) {
      if (t.pursuing && player) {
        const pos = t.car.position;
        const dx = player.x - pos.x;
        const dy = player.y - pos.y;
        const dist = Math.hypot(dx, dy) || 1;
        const targetAngle = Math.atan2(dy, dx);
        // Sanft zur Zielrichtung drehen statt sofort einzurasten – wirkt organischer.
        const next = Phaser.Math.Angle.RotateTo(t.car.currentAngle, targetAngle, 4.5 * dt);
        t.car.setAngle(next);
        t.car.updateNpc(dt, Math.min(t.speed * 1.9, dist * 3 + 60));
        continue;
      }

      if (t.idx >= t.path.length - 1) {
        t.idx = 0;
        const p = t.path[0];
        t.car.sprite.x = p.x;
        t.car.sprite.y = p.y;
      }
      const target = t.path[t.idx + 1];
      const pos = t.car.position;
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 8) {
        t.idx++;
        continue;
      }
      t.car.setAngle(Math.atan2(dy, dx));
      t.car.updateNpc(dt, t.speed);
    }

    for (const ped of this.peds) {
      if (ped.idx >= ped.path.length - 1) {
        ped.idx = 0;
        ped.sprite.x = ped.path[0].x;
        ped.sprite.y = ped.path[0].y;
      }
      const target = ped.path[ped.idx + 1];
      const dx = target.x - ped.sprite.x;
      const dy = target.y - ped.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) {
        ped.idx++;
        continue;
      }
      const sp = 20;
      ped.sprite.x += (dx / dist) * sp * dt;
      ped.sprite.y += (dy / dist) * sp * dt;
      // Geh-Animation: Beine + Arme schwingen gegenläufig, Körper hüpft leicht mit.
      ped.phase += dt * 10;
      const swing = Math.sin(ped.phase) * 2.2;
      const bob = Math.abs(Math.sin(ped.phase)) * 0.9;
      ped.legL.y = 3 + swing;
      ped.legR.y = 3 - swing;
      ped.armL.y = -1 - swing * 0.7;
      ped.armR.y = -1 + swing * 0.7;
      ped.body.y = -2 - bob;
      ped.head.y = -7 - bob;
      ped.sprite.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
    }
  }

  /** Alle NPC-Autos für Kollisionschecks */
  getTrafficCars(): Car[] {
    return this.traffic.map((t) => t.car);
  }

  getPedestrians() {
    return this.peds;
  }

  getTrafficEntries() {
    return this.traffic;
  }

  driverRantAt(x: number, y: number) {
    const bubble = this.scene.add.text(x, y - 24, "🤬 Hey! Pass doch auf!", {
      fontSize: "10px", color: "#ffeb3b", backgroundColor: "#330000cc", padding: { x: 4, y: 2 }
    }).setOrigin(0.5).setDepth(40);
    this.scene.tweens.add({ targets: bubble, y: y - 42, alpha: 0, duration: 1500, onComplete: () => bubble.destroy() });
  }

  scarePedestrian(ped: { sprite: Phaser.GameObjects.Container; emotion: "neutral" | "angry" | "scared" }) {
    ped.emotion = "scared";
    const shout = this.scene.add.text(ped.sprite.x, ped.sprite.y - 20, "😱", { fontSize: "13px" }).setOrigin(0.5).setDepth(40);
    this.scene.tweens.add({ targets: [ped.sprite, shout], scale: 1.18, yoyo: true, duration: 120, repeat: 3, onComplete: () => shout.destroy() });
  }

  /** Setzt das nächste freie Polizeiauto in Verfolgungsmodus (löst die Fahndung aus). */
  triggerPolicePursuit(fromX: number, fromY: number): boolean {
    let nearest: TrafficEntry | null = null;
    let bestDist = Infinity;
    for (const t of this.traffic) {
      if (!t.isPolice || t.pursuing) continue;
      const d = Phaser.Math.Distance.Between(fromX, fromY, t.car.position.x, t.car.position.y);
      if (d < bestDist) {
        bestDist = d;
        nearest = t;
      }
    }
    if (!nearest) return false;
    nearest.pursuing = true;
    return true;
  }

  /** Bricht jede aktive Verfolgung ab (z.B. nach Strafzettel oder wenn der Spieler entkommt). */
  clearPolicePursuit() {
    for (const t of this.traffic) t.pursuing = false;
  }

  hasActivePursuit(): boolean {
    return this.traffic.some((t) => t.pursuing);
  }

  /** Distanz zum nächsten verfolgenden Polizeiauto, oder null wenn keine Verfolgung aktiv ist. */
  pursuingPoliceDistance(x: number, y: number): number | null {
    let best: number | null = null;
    for (const t of this.traffic) {
      if (!t.pursuing) continue;
      const d = Phaser.Math.Distance.Between(x, y, t.car.position.x, t.car.position.y);
      if (best === null || d < best) best = d;
    }
    return best;
  }

  destroy() {
    for (const o of this.staticObjects) o.destroy();
    for (const t of this.traffic) t.car.destroy();
    for (const p of this.peds) p.sprite.destroy();
    for (const p of this.parked) p.car.destroy();
  }
}
