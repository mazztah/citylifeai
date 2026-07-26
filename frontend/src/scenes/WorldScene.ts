import Phaser from "phaser";
import { Car } from "../game/Car";
import { ChunkManager } from "../game/ChunkManager";
import { InputController } from "../game/InputController";
import { MissionMarker } from "../game/MissionMarker";
import { StoryDialog } from "../game/StoryDialog";
import { MapTiles } from "../game/MapTiles";
import { WorldDecor, type ParkedVehicle } from "../game/WorldDecor";
import { DrivableArea } from "../game/DrivableArea";
import { MinimapRadar } from "../game/MinimapRadar";
import { CameraZoomController } from "../game/CameraZoomController";
import { api, type Mission, type Player } from "../api/client";
import {
  lonLatToWorld,
  MAP_TILE_ZOOM,
  ZOOM_DRIVING,
  ZOOM_WALKING,
  ZOOM_MIN,
  ZOOM_MAX,
} from "../config";

const IS_MOBILE =
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 0 && window.innerWidth < 900);

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private car!: Car;
  driveInput!: InputController;
  private chunkManager!: ChunkManager;
  private mapTiles!: MapTiles;
  private decor!: WorldDecor;
  private drivable!: DrivableArea;
  private radar!: MinimapRadar;
  private markers: MissionMarker[] = [];
  private storyDialog!: StoryDialog;

  private lastKnownChapterId: string | null = null;
  private missionRefreshTimer = 0;
  private storyCheckTimer = 0;
  private collisionCooldown = 0;

  /** true = im Auto, false = zu Fuß */
  private inVehicle = true;
  private walker: Phaser.GameObjects.Container | null = null;
  private walkAngle = 0;

  private zoomCtrl!: CameraZoomController;

  /** Werkstatt zum Reparieren beschädigter (nicht totalschaden) Fahrzeuge */
  private workshopPos = lonLatToWorld(9.735, 52.3705);
  private workshopMarker!: Phaser.GameObjects.Container;

  /** Fahndung: Distanz-Timer bis die Polizei die Verfolgung aufgibt */
  private policeEscapeTimer = 0;
  private lastWanted = false;

  /** Fallback, falls nie ein geparktes Fahrzeug in der Nähe ist */
  private strandedWalkDistance = 0;

  constructor() {
    super("WorldScene");
  }

  init(data: { player: Player }) {
    this.player = data.player;
  }

  preload() {}

  create() {
    try {
      this.chunkManager = new ChunkManager(this);
      this.chunkManager.renderAll();
      this.drivable = new DrivableArea(this.chunkManager.graph);

      this.decor = new WorldDecor(this, this.chunkManager.graph);
      this.decor.spawnAll(IS_MOBILE);

      const start = lonLatToWorld(9.7410, 52.3769);
      let spawn = this.drivable.snapToRoad(start.x, start.y);
      if (!this.drivable.isDrivable(spawn.x, spawn.y)) {
        for (let r = 10; r <= 120; r += 10) {
          let found = false;
          for (let a = 0; a < 8; a++) {
            const ang = (a / 8) * Math.PI * 2;
            const tx = spawn.x + Math.cos(ang) * r;
            const ty = spawn.y + Math.sin(ang) * r;
            if (this.drivable.isDrivable(tx, ty)) {
              spawn = { x: tx, y: ty };
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }

      this.car = new Car(this, spawn.x, spawn.y, "player");
      this.driveInput = new InputController(this);

      this.cameras.main.startFollow(this.car.sprite, true, 0.12, 0.12);
      this.zoomCtrl = new CameraZoomController(this, this.cameras.main, ZOOM_MIN, ZOOM_MAX, ZOOM_DRIVING);
      this.cameras.main.setBackgroundColor("#1a2332");
      this.cameras.main.setRoundPixels(true);

      const nw = lonLatToWorld(9.728, 52.385);
      const se = lonLatToWorld(9.760, 52.358);
      this.cameras.main.setBounds(
        Math.min(nw.x, se.x) - 120,
        Math.min(nw.y, se.y) - 120,
        Math.abs(se.x - nw.x) + 240,
        Math.abs(se.y - nw.y) + 240
      );

      // Werkstatt an eine befahrbare Stelle snappen, damit man sie auch erreichen kann.
      this.workshopPos = this.drivable.snapToRoad(this.workshopPos.x, this.workshopPos.y);
      this.workshopMarker = this.buildWorkshopMarker(this.workshopPos.x, this.workshopPos.y);

      this.storyDialog = new StoryDialog(() => {});
      this.scene.launch("UIScene", { player: this.player });
      this.events.emit("player-updated", this.player);

      this.refreshMissions();
      this.checkStory(true);

      this.mapTiles = new MapTiles(
        this,
        Math.min(MAP_TILE_ZOOM, IS_MOBILE ? 14 : 15),
        { south: 52.358, west: 9.728, north: 52.385, east: 9.760 },
        "voyager"
      );
      this.mapTiles.startLoading();

      this.radar = new MinimapRadar(this, this.chunkManager.graph, { corner: "bl" });

      this.scale.on("resize", () => {
        this.radar?.layout();
      });

      // Taste E: Ein-/Aussteigen (auch bei geparkten Fremdfahrzeugen)
      this.input.keyboard?.on("keydown-E", () => this.toggleVehicle());
      // Taste R: An der Werkstatt reparieren
      this.input.keyboard?.on("keydown-R", () => this.tryRepairAtWorkshop());
    } catch (err) {
      console.error("WorldScene create failed:", err);
      const { width, height } = this.scale;
      this.add
        .text(width / 2, height / 2, "Spielstart-Fehler", {
          fontSize: "16px",
          color: "#ff6b6b",
        })
        .setOrigin(0.5);
    }
  }

  private toggleVehicle() {
    if (this.inVehicle) {
      // Aussteigen – Zoom näher
      this.inVehicle = false;
      this.car.sprite.setAlpha(0.85);
      const pos = this.car.position;
      if (!this.walker) {
        const body = this.add.rectangle(0, -2, 6, 8, 0x42a5f5);
        const head = this.add.circle(0, -8, 3, 0xffe0b2);
        this.walker = this.add.container(pos.x + 12, pos.y, [body, head]).setDepth(22);
      } else {
        this.walker.setPosition(pos.x + 12, pos.y);
        this.walker.setVisible(true);
      }
      this.cameras.main.stopFollow();
      this.cameras.main.startFollow(this.walker, true, 0.15, 0.15);
      this.zoomCtrl.jumpTo(ZOOM_WALKING);
      this.showToast("Zu Fuß – nähere Ansicht. E = einsteigen");
      this.events.emit("mode-changed", "walk");
    } else {
      // Einsteigen – eigenes Auto bevorzugt, sonst nächstes geparktes Fahrzeug
      if (!this.walker) return;
      const dOwn = Phaser.Math.Distance.Between(
        this.walker.x,
        this.walker.y,
        this.car.sprite.x,
        this.car.sprite.y
      );
      if (!this.car.wrecked && dOwn <= 40) {
        this.enterVehicle(this.car);
        return;
      }

      const nearby = this.decor.findNearbyParkedVehicle(this.walker.x, this.walker.y, 40);
      if (nearby) {
        this.enterParkedVehicle(nearby);
        return;
      }

      if (this.car.wrecked) {
        this.showToast("Kein Fahrzeug in Reichweite – such ein geparktes Auto/Motorrad!");
      } else {
        this.showToast("Näher an ein Fahrzeug herangehen");
      }
    }
  }

  /** Steigt in das eigene, unbeschädigt genug fahrbereite Auto ein. */
  private enterVehicle(car: Car) {
    this.car = car;
    this.inVehicle = true;
    this.walker!.setVisible(false);
    this.car.sprite.setAlpha(1);
    this.cameras.main.stopFollow();
    this.cameras.main.startFollow(this.car.sprite, true, 0.12, 0.12);
    this.zoomCtrl.jumpTo(ZOOM_DRIVING);
    this.showToast("Eingestiegen");
    this.events.emit("mode-changed", "drive");
    this.events.emit("damage-updated", this.car.collisionCount);
  }

  /** Übernimmt ein geparktes Fremdfahrzeug – das alte (falls fahrbereit) bleibt als neu parkbares Fahrzeug zurück. */
  private enterParkedVehicle(pv: ParkedVehicle) {
    if (this.car && !this.car.wrecked) {
      this.decor.releaseAsParked(this.car);
    }
    this.decor.removeParkedVehicle(pv);
    pv.taken = true;
    pv.car.sprite.setAlpha(1);
    this.strandedWalkDistance = 0;
    this.enterVehicle(pv.car);
    this.showToast(pv.car.isMotorcycle ? "🏍️ Motorrad übernommen!" : "🚗 Fahrzeug übernommen!");
  }

  /** Kleiner Schraubenschlüssel-Marker + Reichweitenkreis für die Werkstatt. */
  private buildWorkshopMarker(x: number, y: number): Phaser.GameObjects.Container {
    const ring = this.add.circle(0, 0, 40, 0x36c2ff, 0.08).setStrokeStyle(1.5, 0x36c2ff, 0.5);
    const bg = this.add.circle(0, 0, 12, 0x1a2332, 0.92).setStrokeStyle(2, 0xffd23f);
    const icon = this.add.text(0, 0, "🔧", { fontSize: "14px" }).setOrigin(0.5);
    const label = this.add
      .text(0, 20, "Werkstatt", {
        fontSize: "10px",
        color: "#ffd23f",
        backgroundColor: "#00000066",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5);
    const container = this.add.container(x, y, [ring, bg, icon, label]).setDepth(14);
    return container;
  }

  /** Repariert das aktuelle Auto an der Werkstatt gegen Bezahlung. */
  tryRepairAtWorkshop() {
    if (!this.inVehicle || !this.car) return;
    if (this.car.wrecked) {
      this.showToast("💀 Totalschaden – hier nicht reparierbar. Neues Fahrzeug suchen!");
      return;
    }
    if (this.car.collisionCount <= 0) {
      this.showToast("Kein Schaden vorhanden");
      return;
    }
    const d = Phaser.Math.Distance.Between(
      this.car.position.x,
      this.car.position.y,
      this.workshopPos.x,
      this.workshopPos.y
    );
    if (d > 55) {
      this.showToast("🔧 Zur Werkstatt fahren, dann R drücken");
      return;
    }
    const cost = this.car.collisionCount * 15;
    if (this.player.cash < cost) {
      this.showToast(`Nicht genug Geld (${cost}💰 nötig)`);
      return;
    }
    this.player = { ...this.player, cash: this.player.cash - cost };
    this.car.repair();
    this.events.emit("player-updated", this.player);
    this.events.emit("damage-updated", 0);
    this.showToast(`🔧 Repariert für ${cost}💰`);
  }

  /** Polizei erwischt den Spieler – Strafzettel gegen Bargeld, Fahndung endet. */
  private issueTicket() {
    const fine = 50 + this.car.collisionCount * 5;
    this.player = { ...this.player, cash: Math.max(0, this.player.cash - fine) };
    this.decor.clearPolicePursuit();
    this.policeEscapeTimer = 0;
    this.events.emit("player-updated", this.player);
    this.events.emit("wanted-changed", false);
    this.showToast(`🚔 Strafzettel! -${fine}💰`);
  }

  private toastHideTimer?: number;
  private showToast(msg: string) {
    const el = document.getElementById("damage-toast");
    if (!el) return;
    el.textContent = msg;
    el.style.display = "block";
    // Reflow erzwingen, damit die CSS-Transition bei erneutem Toast sauber neu startet.
    void el.offsetWidth;
    el.classList.add("show");
    if (this.toastHideTimer) window.clearTimeout(this.toastHideTimer);
    this.toastHideTimer = window.setTimeout(() => {
      el.classList.remove("show");
      window.setTimeout(() => {
        el.style.display = "none";
      }, 220);
    }, 2200);
  }

  private handleCarCollisions(dt: number) {
    if (!this.inVehicle || this.car.wrecked) return;
    this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);
    if (this.collisionCooldown > 0) return;

    const pos = this.car.position;

    // 1) Kollision mit fahrendem Verkehr (inkl. Polizei -> Fahndung)
    for (const other of this.decor.getTrafficCars()) {
      const op = other.position;
      const dist = Math.hypot(pos.x - op.x, pos.y - op.y);
      if (dist < this.car.radius + other.radius) {
        this.registerPlayerCollision(pos, op);
        if (other.vehicleClass === "police" && !this.decor.hasActivePursuit()) {
          this.decor.triggerPolicePursuit(pos.x, pos.y);
          this.events.emit("wanted-changed", true);
          this.showToast("🚨 Die Polizei nimmt die Verfolgung auf!");
        }
        return;
      }
    }

    // 2) Kollision mit geparkten Fahrzeugen – vorher wurden diese komplett ignoriert,
    //    weshalb Rammen von parkenden Autos/Motorrädern keinen Schaden/Rauch auslöste.
    for (const pv of this.decor.parked) {
      const op = pv.car.position;
      const dist = Math.hypot(pos.x - op.x, pos.y - op.y);
      if (dist < this.car.radius + pv.car.radius) {
        this.registerPlayerCollision(pos, op);
        return;
      }
    }
  }

  /** Gemeinsame Kollisionsfolgen: Schaden hochzählen, abprallen, Toast/HUD aktualisieren. */
  private registerPlayerCollision(pos: { x: number; y: number }, otherPos: { x: number; y: number }) {
    this.collisionCooldown = 0.6;
    const becameWreck = this.car.registerCollision();
    const ang = Math.atan2(pos.y - otherPos.y, pos.x - otherPos.x);
    this.car.sprite.x += Math.cos(ang) * 10;
    this.car.sprite.y += Math.sin(ang) * 10;
    this.events.emit("damage-updated", this.car.collisionCount);

    if (becameWreck) {
      this.showToast("💥 Auto schrottreif! E = aussteigen, neues Fahrzeug suchen");
    } else if (this.car.collisionCount >= 4) {
      this.showToast(`💨 Rauch! Schaden ${this.car.collisionCount}/10`);
    } else {
      this.showToast(`Kollision ${this.car.collisionCount}/10`);
    }
  }

  /** Notfall-Ersatzwagen, falls partout kein geparktes Fahrzeug in der Nähe zu finden ist. */
  private spawnReplacementCar() {
    if (!this.walker) return;
    const pos = { x: this.walker.x, y: this.walker.y };
    const snapped = this.drivable.snapToRoad(pos.x, pos.y);
    this.car.destroy();
    this.car = new Car(this, snapped.x, snapped.y, "player");
    this.showToast("Ersatzwagen gefunden");
    this.events.emit("damage-updated", 0);
  }

  update(_time: number, deltaMs: number) {
    if (!this.driveInput || !this.drivable) return;
    const dt = Math.min(deltaMs / 1000, 0.05); // Frame-Cap gegen Spikes
    try {
      const input = this.driveInput.read();

      if (this.inVehicle && this.car) {
        this.car.update(dt, input, (x, y) => this.drivable.isDrivable(x, y));
        this.events.emit("speed-updated", this.car.currentSpeedKmh);
        this.handleCarCollisions(dt);
        this.radar?.update(this.car.position.x, this.car.position.y, this.car.sprite.rotation);

        for (const marker of [...this.markers]) {
          if (marker.isReachable(this.car.position.x, this.car.position.y)) {
            this.completeMission(marker);
          }
        }
      } else if (this.walker) {
        // Zu Fuß steuern
        const sp = 55;
        let vx = 0;
        let vy = 0;
        if (input.analog) {
          vx = input.axisX * sp;
          vy = input.axisY * sp;
        } else {
          if (input.left) vx -= sp;
          if (input.right) vx += sp;
          if (input.up) vy -= sp;
          if (input.down) vy += sp;
        }
        const nx = this.walker.x + vx * dt;
        const ny = this.walker.y + vy * dt;
        // Fußgänger: Gebäude meiden, sonst frei
        if (!this.drivable.isInsideAnyBuilding(nx, ny)) {
          this.walker.x = nx;
          this.walker.y = ny;
        }
        if (vx || vy) this.walkAngle = Math.atan2(vy, vx);
        this.radar?.update(this.walker.x, this.walker.y, this.walkAngle);

        // Notfall-Ersatzwagen nur, wenn wirklich lange kein geparktes Fahrzeug gefunden wurde.
        if (this.car.wrecked) {
          this.strandedWalkDistance += Math.hypot(vx, vy) * dt;
          if (this.strandedWalkDistance > 260) {
            this.strandedWalkDistance = 0;
            this.spawnReplacementCar();
          }
        }
      }

      // Fahndung: Spieler-Position (egal ob im Auto oder zu Fuß) an den Verkehr weiterreichen,
      // damit ein verfolgendes Polizeiauto den Spieler auch aussteigen "sieht".
      const playerPos = this.inVehicle
        ? this.car.position
        : this.walker
          ? { x: this.walker.x, y: this.walker.y }
          : undefined;
      this.decor?.update(dt, playerPos);
      this.updatePursuitState(dt, playerPos);

      this.missionRefreshTimer += dt;
      if (this.missionRefreshTimer > (IS_MOBILE ? 20 : 15)) {
        this.missionRefreshTimer = 0;
        this.refreshMissions();
      }
      this.storyCheckTimer += dt;
      if (this.storyCheckTimer > 8) {
        this.storyCheckTimer = 0;
        this.checkStory(false);
      }
    } catch (err) {
      console.error("WorldScene update:", err);
    }
  }

  /** Prüft, ob die Polizei den Spieler eingeholt hat (Strafzettel) oder aufgibt (Entkommen). */
  private updatePursuitState(dt: number, playerPos?: { x: number; y: number }) {
    const wanted = this.decor.hasActivePursuit();
    if (wanted !== this.lastWanted) {
      this.lastWanted = wanted;
      this.events.emit("wanted-changed", wanted);
    }
    if (!wanted || !playerPos) {
      this.policeEscapeTimer = 0;
      return;
    }
    const dist = this.decor.pursuingPoliceDistance(playerPos.x, playerPos.y);
    if (dist == null) return;
    if (dist < 26) {
      this.issueTicket();
    } else if (dist > 420) {
      this.policeEscapeTimer += dt;
      if (this.policeEscapeTimer > 6) {
        this.policeEscapeTimer = 0;
        this.decor.clearPolicePursuit();
        this.showToast("🚓 Die Polizei hat die Verfolgung aufgegeben");
        this.events.emit("wanted-changed", false);
      }
    } else {
      this.policeEscapeTimer = 0;
    }
  }

  private refreshMissions() {
    api
      .getActiveMissions(this.player.id)
      .then((missions) => this.syncMarkers(missions))
      .catch((err) => console.error("Missionen:", err));
  }

  private syncMarkers(missions: Mission[]) {
    const activeIds = new Set(missions.map((m) => m.id));
    this.markers = this.markers.filter((m) => {
      if (!activeIds.has(m.mission.id)) {
        m.destroy();
        return false;
      }
      return true;
    });
    const existingIds = new Set(this.markers.map((m) => m.mission.id));
    for (const mission of missions) {
      if (existingIds.has(mission.id) || mission.target_lat == null || mission.target_lon == null)
        continue;
      const { x, y } = lonLatToWorld(mission.target_lon, mission.target_lat);
      const marker = new MissionMarker(this, x, y, mission);
      marker.container.setDepth(15);
      this.markers.push(marker);
    }
    this.events.emit("missions-updated", missions);
    if (this.radar) {
      this.radar.setMissions(
        missions
          .filter((m) => m.target_lat != null && m.target_lon != null)
          .map((m) => {
            const w = lonLatToWorld(m.target_lon!, m.target_lat!);
            return { x: w.x, y: w.y, story: m.category === "story" };
          })
      );
    }
  }

  private completeMission(marker: MissionMarker) {
    this.markers = this.markers.filter((m) => m !== marker);
    marker.destroy();
    api
      .completeMission(this.player.id, marker.mission.id)
      .then((updatedPlayer) => {
        this.player = updatedPlayer;
        this.events.emit("player-updated", updatedPlayer);
        this.events.emit("mission-completed", marker.mission);
        this.refreshMissions();
        if (marker.mission.category === "story") this.checkStory(false);
      })
      .catch((err) => console.error("Mission complete:", err));
  }

  private checkStory(isInitialLoad: boolean) {
    api
      .getStoryState(this.player.id)
      .then((state) => {
        const current = state.current_chapter;
        const isNew = this.lastKnownChapterId !== null && this.lastKnownChapterId !== current.id;
        if (isInitialLoad || isNew) {
          this.storyDialog.showChapter(current, { isNew: isNew && !isInitialLoad });
        }
        this.lastKnownChapterId = current.id;
        this.events.emit("story-updated", state);
      })
      .catch((err) => console.error("Story:", err));
  }
}
