// Phase 6: Main menu helpers — typed navigation + quick mode shortcuts
import { dispatch } from "../../../state/signals";

import { SCENE_KEYS, type SceneController } from "./types";

export class MainMenu /* extends Phaser.Scene */ {
  public scene: SceneController = { start: () => void 0 };

  create(): void {
    // Intentionally empty for Phase 1 (no rendering)
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
