// PR3: Real Phaser ModeSelect scene — lists and selects modes
import Phaser from "phaser";

import { gameModeRegistry } from "../../../modes";
import { dispatch } from "../../../state/signals";

import { SCENE_KEYS } from "./types";

export class ModeSelect extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.ModeSelect });
  }

  create(): void {
    // Placeholder label; rexUI list wiring will replace this later.
    const w = this.scale.width;
    const h = this.scale.height;
    const label = this.add.text(w / 2, h / 2 - 20, "Select Mode", {
      color: "#ffffff",
      fontFamily: "monospace",
      fontSize: "14px",
    });
    label.setOrigin(0.5, 0.5);
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
