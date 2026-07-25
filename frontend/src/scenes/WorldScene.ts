import Phaser from "phaser";
import { Car } from "../game/Car";
import { ChunkManager } from "../game/ChunkManager";
import { InputController } from "../game/InputController";
import { MissionMarker } from "../game/MissionMarker";
import { StoryDialog } from "../game/StoryDialog";
import { api, type Mission, type Player } from "../api/client";
import { lonLatToWorld } from "../config";

export class WorldScene extends Phaser.Scene {
  private player!: Player;
  private car!: Car;
  driveInput!: InputController; // öffentlich (nicht "input"!) - Phaser-Scenes haben bereits ein eigenes this.input
  private chunkManager!: ChunkManager;
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

  create() {
    this.chunkManager = new ChunkManager(this);
    this.chunkManager.renderAll();

    // Startposition: am Hauptbahnhof (passend zur Story: "Ankunft am Hauptbahnhof")
    const start = lonLatToWorld(9.7386, 52.3766);
    this.car = new Car(this, start.x, start.y);

    this.driveInput = new InputController(this);

    this.cameras.main.startFollow(this.car.sprite, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.0);
    this.cameras.main.setBackgroundColor("#12151c");

    this.storyDialog = new StoryDialog(() => {
      /* nach Schließen einfach weiterspielen */
    });

    this.scene.launch("UIScene", { player: this.player });
    this.events.emit("player-updated", this.player);

    this.refreshMissions();
    this.checkStory(true);
  }

  update(_time: number, deltaMs: number) {
    const dt = deltaMs / 1000;
    this.car.update(dt, this.driveInput.read());
    this.events.emit("speed-updated", this.car.currentSpeedKmh);

    const pos = this.car.position;
    for (const marker of [...this.markers]) {
      if (marker.isReachable(pos.x, pos.y)) {
        this.completeMission(marker);
      }
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
      .catch((err) => console.error("Missionen konnten nicht geladen werden", err));
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
      if (existingIds.has(mission.id) || mission.target_lat == null || mission.target_lon == null) continue;
      const { x, y } = lonLatToWorld(mission.target_lon, mission.target_lat);
      this.markers.push(new MissionMarker(this, x, y, mission));
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
        if (marker.mission.category === "story") {
          this.checkStory(false);
        }
      })
      .catch((err) => console.error("Mission konnte nicht abgeschlossen werden", err));
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
      .catch((err) => console.error("Story-Status konnte nicht geladen werden", err));
  }
}
