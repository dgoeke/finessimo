import Phaser from "phaser";

import { gameModeRegistry } from "../../../modes";
import { getActiveRng } from "../../../modes/spawn-service";
import { dispatch } from "../../../state/signals";
import { createSeed } from "../../../types/brands";
import { fromNow } from "../../../types/timestamp";

import { SCENE_KEYS } from "./types";

import type { Action } from "../../../state/types";

export class Boot extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.Boot });
  }

  // Load atlases / bitmapfonts / audio when available.
  // For now, keep it minimal to avoid asset coupling.
  preload(): void {
    // rexUI is installed globally via Game config plugins (see Game.ts)
    // Example: this.load.atlas('tiles', 'assets/tiles.png', 'assets/tiles.json');
    // Example: this.load.bitmapFont('arcade', 'assets/arcade.png', 'assets/arcade.xml');
    // Example: this.load.audio('lock', 'assets/lock.mp3');

    // Show a simple progress text while loading (even if nothing to load yet)
    const w = this.scale.width;
    const h = this.scale.height;
    const txt = this.add.text(w / 2, h / 2, "Loading…", {
      color: "#cccccc",
      fontFamily: "monospace",
      fontSize: "14px",
    });
    txt.setOrigin(0.5, 0.5);

    this.load.on("progress", (p: number) => {
      const pct = Math.round(p * 100);
      txt.setText(`Loading… ${String(pct)}%`);
    });
  }

  create(): void {
    const seed = createSeed(crypto.randomUUID());
    const defaultMode = gameModeRegistry.get("freePlay");
    const rng = defaultMode ? getActiveRng(defaultMode, seed) : undefined;
    let initAction: Extract<Action, { type: "Init" }> = {
      mode: defaultMode?.name ?? "freePlay",
      seed,
      timestampMs: fromNow(),
      type: "Init",
    };
    if (rng) initAction = { ...initAction, rng };
    dispatch(initAction);

    // Transition to MainMenu after assets are ready
    this.scene.start(SCENE_KEYS.MainMenu);
  }
}
