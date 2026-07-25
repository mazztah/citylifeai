import Phaser from "phaser";
import { Car } from "../game/Car";
import { ChunkManager } from "../game/ChunkManager";
import { InputController } from "../game/InputController";
import { MissionMarker } from "../game/MissionMarker";
import { StoryDialog } from "../game/StoryDialog";
import { MapTiles } from "../game/MapTiles";
import { WorldDecor } from "../game/WorldDecor";
import { api, type Mission, type Player } from "../api/client";
import { lonLatToWorld, MAP_TILE_ZOOM } from "../config";

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private car!: Car;
  driveInput!: InputController;
  private chunkManager!: ChunkManager;
  private mapTiles!: MapTiles;
  private decor!: WorldDecor;
  private markers: MissionMarker[] = [];
  private storyDialog!: StoryDialog;

  private lastKnownChapterId: string | null = null;
  private missionRefreshTimer = 0;
  private storyCheckTimer = 0;

  constructor() {
    super("WorldScene");
  }

  init(data: { player: Player }) {
    this.player = data.player;
  }

  preload() {
    this.mapTiles = new MapTiles(
      this,
      MAP_TILE_ZOOM,
      { south: 52.355, west: 9.722, north: 52.390, east: 9.768 },
      "voyager"
    );
    this.mapTiles.queueLoad();
    this.load.on("loaderror", (file: { key?: string }) => {
      console.warn("Kachel-Fehler:", file?.key);
    });
  }

  create() {
    this.mapTiles.place();

    this.chunkManager = new ChunkManager(this);
    this.chunkManager.renderAll();

    this.decor = new WorldDecor(this, this.chunkManager.graph);
    this.decor.spawnAll();

    const start = lonLatToWorld(9.7386, 52.3766);
    this.car = new Car(this, start.x, start.y, "player");
    this.driveInput = new InputController(this);

    this.cameras.main.startFollow(this.car.sprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.25);
    this.cameras.main.setBackgroundColor("#1a2332");
    this.cameras.main.setRoundPixels(true);

    const nw = lonLatToWorld(9.722, 52.390);
    const se = lonLatToWorld(9.768, 52.355);
    this.cameras.main.setBounds(
      Math.min(nw.x, se.x) - 150,
      Math.min(nw.y, se.y) - 150,
      Math.abs(se.x - nw.x) + 300,
      Math.abs(se.y - nw.y) + 300
    );

    this.storyDialog = new StoryDialog(() => {});
    this.scene.launch("UIScene", { player: this.player });
    this.events.emit("player-updated", this.player);

    this.refreshMissions();
    this.checkStory(true);
  }

  update(_time: number, deltaMs: number) {
    const dt = deltaMs / 1000;
    this.car.update(dt, this.driveInput.read());
    this.events.emit("speed-updated", this.car.currentSpeedKmh);
    this.decor.update(dt);

    const pos = this.car.position;
    const nearest = this.chunkManager.graph.nearestRoadPoint(pos.x, pos.y);
    if (nearest.distance > 35 && nearest.distance < 180) {
      const pull = 0.02;
      this.car.sprite.x += (nearest.x - pos.x) * pull;
      this.car.sprite.y += (nearest.y - pos.y) * pull;
    }

    for (const marker of [...this.markers]) {
      if (marker.isReachable(pos.x, pos.y)) this.completeMission(marker);
    }

    this.missionRefreshTimer += dt;
    if (this.missionRefreshTimer > 15) {
      this.missionRefreshTimer = 0;
      this.refreshMissions();
    }
    this.storyCheckTimer += dt;
    if (this.storyCheckTimer > 5) {
      this.storyCheckTimer = 0;
      this.checkStory(false);
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
