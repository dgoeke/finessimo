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

    // Generate visual assets at runtime
    this.ensureGeneratedTilesTexture();

    // Audio placeholders removed: invalid data URLs were causing decode errors.
    // Real audio assets should be loaded here when available.

    // Show a simple progress text while loading (even if nothing to load yet)
    const w = this.scale.width;
    const h = this.scale.height;
    const txt = this.add.text(w / 2, h / 2, "Loading…", {
      color: "#cccccc",
      fontFamily: "monospace",
      fontSize: "14px",
    });
    txt.setOrigin(0.5, 0.5);

    this.load.on("progress", (p: unknown) => {
      const pct = Math.round((p as number) * 100);
      txt.setText(`Loading… ${String(pct)}%`);
    });
  }

  async create(): Promise<void> {
    const seed = createSeed(crypto.randomUUID());
    const defaultMode = gameModeRegistry.get("freePlay");
    const rng = defaultMode ? getActiveRng(defaultMode, seed) : undefined;
    const initAction: Extract<Action, { type: "Init" }> = {
      mode: defaultMode?.name ?? "freePlay",
      seed,
      timestampMs: fromNow(),
      type: "Init",
      ...(rng ? { rng } : {}),
    };
    dispatch(initAction);

    // Lazily register other scenes when running inside a real Phaser.Game
    const maybeGame: unknown = this.game as unknown;
    if (
      maybeGame !== null &&
      maybeGame !== undefined &&
      typeof maybeGame === "object" &&
      "scene" in (maybeGame as Record<string, unknown>)
    ) {
      const { registerLazyScenes } = await import("./registerLazy");
      await registerLazyScenes(this.game);
    }
    this.scene.start(SCENE_KEYS.MainMenu);
  }

  private ensureGeneratedTilesTexture(): void {
    const key = "tiles";
    if (this.textures.exists(key)) return;

    const size = 16; // px
    const frames = 9; // 0..8
    const tex = this.textures.createCanvas(key, size * frames, size);
    if (!tex) return; // narrow for strict types; texture manager should be available in real runtime
    const ctx = tex.context;

    // Simple palette (index 0 is empty/black)
    const palette = [
      "#000000", // 0 (empty)
      "#00ffff", // 1 I (cyan)
      "#0000ff", // 2 J (blue)
      "#ff7f00", // 3 L (orange)
      "#ffff00", // 4 O (yellow)
      "#00ff00", // 5 S (green)
      "#800080", // 6 T (purple)
      "#ff0000", // 7 Z (red)
      "#7f7f7f", // 8 (extra)
    ] as const;

    for (let i = 0; i < frames; i++) {
      ctx.fillStyle = palette[i] ?? "#ffffff";
      ctx.fillRect(i * size, 0, size, size);
      // simple inner stroke for definition
      if (i !== 0) {
        ctx.strokeStyle = "#111111";
        ctx.lineWidth = 2;
        ctx.strokeRect(i * size + 1, 1, size - 2, size - 2);
      }
    }
    tex.refresh();

    // Define frames 0..8 over the canvas so blitter can address by index
    const texture = this.textures.get(key);
    for (let i = 0; i < frames; i++) {
      texture.add(String(i), 0, i * size, 0, size, size);
    }
  }

  // Note: Valid audio should be loaded via this.load.audio(...) when assets are ready.
}
