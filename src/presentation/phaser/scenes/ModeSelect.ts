// Phase 6: Mode selection helpers — list/select modes via the pure registry
import { gameModeRegistry } from "../../../modes";
import { dispatch } from "../../../state/signals";

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

  /**
   * Pure listing of available mode names from the registry.
   * UI can call this to build a menu without coupling to registry internals.
   */
  listModes(): ReadonlyArray<string> {
    return gameModeRegistry.list();
  }

  /**
   * Select a mode by name and transition into gameplay.
   * Keeps the core pure by dispatching a typed action only.
   */
  selectMode(modeName: string): void {
    dispatch({ mode: modeName, type: "SetMode" });
    this.scene.start(SCENE_KEYS.Gameplay);
  }
}
