// PR3: Real Phaser MainMenu scene — typed navigation hooks
import Phaser from "phaser";

import { dispatch } from "../../../state/signals";

import { SCENE_KEYS } from "./types";

export class MainMenu extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.MainMenu });
  }

  create(): void {
    // Minimal placeholder UI (rexUI wiring can replace this later)
    // Keep side effects minimal for tests; text creation is safe under Jest mock.
    const w = this.scale.width;
    const h = this.scale.height;
    const title = this.add.text(w / 2, h / 2 - 20, "Finessimo", {
      color: "#ffffff",
      fontFamily: "monospace",
      fontSize: "16px",
    });
    title.setOrigin(0.5, 0.5);
  }

  toSettings(): void {
    this.scene.start(SCENE_KEYS.Settings);
  }

  toModeSelect(): void {
    this.scene.start(SCENE_KEYS.ModeSelect);
  }

  toGameplay(): void {
    this.scene.start(SCENE_KEYS.Gameplay);
  }

  // --- Convenience shortcuts for common menu actions ---
  startMode(modeName: string): void {
    dispatch({ mode: modeName, type: "SetMode" });
    this.scene.start(SCENE_KEYS.Gameplay);
  }

  startFreePlay(): void {
    this.startMode("freePlay");
  }

  startGuided(): void {
    this.startMode("guided");
  }
}
