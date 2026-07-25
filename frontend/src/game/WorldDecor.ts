import Phaser from "phaser";
import { RoadGraph } from "./RoadGraph";
import { Car, type VehicleClass } from "./Car";

/**
 * Belebt die Welt: Bäume, Laternen, Verkehr, Fußgänger – prozedural entlang
 * des Straßennetzes und an POIs, ohne zusätzliche Assets.
 */
export class WorldDecor {
  private staticObjects: Phaser.GameObjects.GameObject[] = [];
  private traffic: { car: Car; path: { x: number; y: number }[]; idx: number; speed: number }[] = [];
  private peds: {
    sprite: Phaser.GameObjects.Container;
    path: { x: number; y: number }[];
    idx: number;
    t: number;
  }[] = [];

  constructor(
    private scene: Phaser.Scene,
    private graph: RoadGraph
  ) {}

  spawnAll() {
    if (!this.graph.roads.length) return;
    this.spawnTreesNearParks();
    this.spawnStreetLights();
    this.spawnBenchesAndBins();
    this.spawnTraffic(10);
    this.spawnPedestrians(12);
  }

  private spawnTreesNearParks() {
    const parks = this.graph.pois.filter((p) => p.category === "park");
    for (const park of parks) {
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const r = 40 + Math.random() * 50;
        this.addTree(park.x + Math.cos(ang) * r, park.y + Math.sin(ang) * r);
      }
    }
    // Zusätzliche Bäume entlang sekundärer Straßen
    for (const road of this.graph.roads) {
      if (road.kind === "primary") continue;
      for (let i = 1; i < road.points.length - 1; i += 2) {
        if (Math.random() > 0.45) continue;
        const p = road.points[i];
        const n = road.points[i + 1] || p;
        const dx = n.x - p.x;
        const dy = n.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const ox = (-dy / len) * 18;
        const oy = (dx / len) * 18;
        this.addTree(p.x + ox, p.y + oy);
      }
    }
  }

  private addTree(x: number, y: number) {
    const shadow = this.scene.add.ellipse(x + 2, y + 4, 14, 8, 0x000000, 0.25).setDepth(2);
    const trunk = this.scene.add.rectangle(x, y + 2, 3, 8, 0x5d4037).setDepth(3);
    const canopy = this.scene.add.circle(x, y - 4, 9 + Math.random() * 4, 0x2e7d32, 0.9).setDepth(3);
    const canopy2 = this.scene.add.circle(x - 3, y - 2, 6, 0x388e3c, 0.7).setDepth(3);
    this.staticObjects.push(shadow, trunk, canopy, canopy2);
  }

  private spawnStreetLights() {
    for (const road of this.graph.roads) {
      if (road.kind === "tertiary" && Math.random() > 0.5) continue;
      for (let i = 0; i < road.points.length - 1; i += 2) {
        const p = road.points[i];
        const n = road.points[i + 1];
        const dx = n.x - p.x;
        const dy = n.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const ox = (-dy / len) * 14;
        const oy = (dx / len) * 14;
        this.addLamp(p.x + ox, p.y + oy);
      }
    }
  }

  private addLamp(x: number, y: number) {
    const pole = this.scene.add.rectangle(x, y, 2, 16, 0x455a64).setDepth(4);
    const head = this.scene.add.circle(x, y - 9, 3, 0xfff59d, 0.85).setDepth(4);
    const glow = this.scene.add.circle(x, y - 9, 10, 0xfff59d, 0.12).setDepth(3);
    this.staticObjects.push(pole, head, glow);
  }

  private spawnBenchesAndBins() {
    for (const poi of this.graph.pois) {
      if (poi.category === "cafe" || poi.category === "park" || poi.category === "transit") {
        const bx = poi.x + 12;
        const by = poi.y + 10;
        const bench = this.scene.add.rectangle(bx, by, 12, 4, 0x6d4c41).setDepth(4);
        const bin = this.scene.add.rectangle(bx + 14, by, 5, 6, 0x37474f).setDepth(4);
        this.staticObjects.push(bench, bin);
      }
    }
  }

  private spawnTraffic(count: number) {
    const roads = this.graph.roads.filter((r) => r.points.length >= 2);
    if (!roads.length) return;
    const classes: VehicleClass[] = ["taxi", "civilian", "delivery", "suv", "police"];

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
        speed: 40 + Math.random() * 60,
      });
    }
  }

  private spawnPedestrians(count: number) {
    const roads = this.graph.roads;
    const colors = [0xffcc80, 0x90caf9, 0xf48fb1, 0xce93d8, 0xa5d6a7];
    for (let i = 0; i < count; i++) {
      const road = roads[Math.floor(Math.random() * roads.length)];
      if (road.points.length < 2) continue;
      const path = road.points.map((p, idx) => {
        const n = road.points[Math.min(idx + 1, road.points.length - 1)];
        const dx = n.x - p.x;
        const dy = n.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        // Gehweg-Offset
        return { x: p.x + (-dy / len) * 16, y: p.y + (dx / len) * 16 };
      });
      const c = colors[i % colors.length];
      const body = this.scene.add.circle(0, 0, 4, c);
      const head = this.scene.add.circle(0, -5, 2.5, 0xffe0b2);
      const container = this.scene.add.container(path[0].x, path[0].y, [body, head]).setDepth(11);
      this.peds.push({ sprite: container, path, idx: 0, t: 0 });
    }
  }

  update(dt: number) {
    // Verkehr entlang Pfad
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
      const angle = Math.atan2(dy, dx);
      t.car.setAngle(angle);
      t.car.updateNpc(dt, t.speed);
    }

    // Fußgänger
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
      const sp = 22;
      ped.sprite.x += (dx / dist) * sp * dt;
      ped.sprite.y += (dy / dist) * sp * dt;
    }
  }

  destroy() {
    for (const o of this.staticObjects) o.destroy();
    for (const t of this.traffic) t.car.destroy();
    for (const p of this.peds) p.sprite.destroy();
  }
}
