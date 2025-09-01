// Phase 1: Minimal scene shell (no Phaser import)
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
}
