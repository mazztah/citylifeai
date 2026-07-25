import Phaser from "phaser";
import { RoadGraph } from "./RoadGraph";
import { Car, type VehicleClass } from "./Car";

/**
 * Belebt die Welt – reduziert auf Mobile (weniger Traffic/Peds/Bäume).
 */
export class WorldDecor {
  private staticObjects: Phaser.GameObjects.GameObject[] = [];
  traffic: { car: Car; path: { x: number; y: number }[]; idx: number; speed: number }[] = [];
  private peds: {
    sprite: Phaser.GameObjects.Container;
    body: Phaser.GameObjects.Rectangle;
    legL: Phaser.GameObjects.Rectangle;
    legR: Phaser.GameObjects.Rectangle;
    path: { x: number; y: number }[];
    idx: number;
    phase: number;
  }[] = [];

  constructor(
    private scene: Phaser.Scene,
    private graph: RoadGraph
  ) {}

  spawnAll(mobile: boolean) {
    if (!this.graph.roads.length) return;
    this.spawnTreesNearParks(mobile ? 3 : 6);
    if (!mobile) this.spawnStreetLights();
    this.spawnTraffic(mobile ? 4 : 8);
    this.spawnPedestrians(mobile ? 6 : 10);
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
    const classes: VehicleClass[] = ["taxi", "civilian", "delivery", "suv"];

    for (let i = 0; i < count; i++) {
      const road = roads[Math.floor(Math.random() * roads.length)];
      const path = [...road.points];
      if (Math.random() > 0.5) path.reverse();
      const start = path[0];
      const next = path[1] || start;
      const angle = Math.atan2(next.y - start.y, next.x - start.x);
      const cls = classes[i % classes.length];
      const car = new Car(this.scene, start.x, start.y, cls);
      car.setAngle(angle);
      car.sprite.setDepth(12);
      this.traffic.push({
        car,
        path,
        idx: 0,
        speed: 35 + Math.random() * 45,
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
      // Einfache „CSS-artige“ Figur: Körper + Beine die phasenverschoben wippen
      const body = this.scene.add.rectangle(0, -2, 5, 7, c);
      const head = this.scene.add.circle(0, -7, 2.5, 0xffe0b2);
      const legL = this.scene.add.rectangle(-1.5, 3, 2, 5, 0x37474f);
      const legR = this.scene.add.rectangle(1.5, 3, 2, 5, 0x455a64);
      const container = this.scene.add
        .container(path[0].x, path[0].y, [legL, legR, body, head])
        .setDepth(11);
      this.peds.push({ sprite: container, body, legL, legR, path, idx: 0, phase: Math.random() * Math.PI * 2 });
    }
  }

  update(dt: number) {
    for (const t of this.traffic) {
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
      // Geh-Animation: Beine schwingen
      ped.phase += dt * 10;
      const swing = Math.sin(ped.phase) * 2.2;
      ped.legL.y = 3 + swing;
      ped.legR.y = 3 - swing;
      ped.sprite.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
    }
  }

  /** Alle NPC-Autos für Kollisionschecks */
  getTrafficCars(): Car[] {
    return this.traffic.map((t) => t.car);
  }

  destroy() {
    for (const o of this.staticObjects) o.destroy();
    for (const t of this.traffic) t.car.destroy();
    for (const p of this.peds) p.sprite.destroy();
  }
}
