// Phase 1: Minimal scene shell (no Phaser import)
import { SCENE_KEYS, type SceneController } from "./types";

export class ModeSelect /* extends Phaser.Scene */ {
  public scene: SceneController = { start: () => void 0 };

  create(): void {
    // Intentionally empty
  }

  toGameplay(): void {
    this.scene.start(SCENE_KEYS.Gameplay);
  }

  backToMenu(): void {
    this.scene.start(SCENE_KEYS.MainMenu);
  }
}
