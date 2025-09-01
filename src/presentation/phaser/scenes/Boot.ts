// Phase 1: Minimal scene shell (no Phaser import)
import { SCENE_KEYS, type SceneController } from "./types";

export class Boot /* extends Phaser.Scene */ {
  // Phaser injects this at runtime; here we keep a typed placeholder
  public scene: SceneController = { start: () => void 0 };

  // Placeholder to reflect Phaser Scene lifecycle
  create(): void {
    // Minimal transition to MainMenu
    this.scene.start(SCENE_KEYS.MainMenu);
  }
}
