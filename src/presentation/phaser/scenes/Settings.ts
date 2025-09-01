// Phase 6: Settings scene — maps UI inputs to store actions (still framework-agnostic)
import { dispatch } from "../../../state/signals";
import { createDurationMs } from "../../../types/brands";

import { SCENE_KEYS, type SceneController } from "./types";

import type { GameplayConfig, TimingConfig } from "../../../state/types";

export class Settings /* extends Phaser.Scene */ {
  public scene: SceneController = { start: () => void 0 };

  create(): void {
    // Intentionally empty
  }

  backToMenu(): void {
    this.scene.start(SCENE_KEYS.MainMenu);
  }

  // --- Settings mapping helpers (UI → Actions) ---

  /**
   * Update timing settings from numbers/flags (boundary conversion to brands).
   * Accepts a narrow subset that menus commonly modify; safe to call with partials.
   */
  updateTimingMs(
    partial: Partial<{
      arrMs: number;
      dasMs: number;
      gravityEnabled: boolean;
      gravityMs: number;
      lineClearDelayMs: number;
      lockDelayMs: number;
      softDrop: TimingConfig["softDrop"];
    }>,
  ): void {
    const timing: Partial<TimingConfig> = {};
    if (partial.arrMs !== undefined)
      timing.arrMs = createDurationMs(partial.arrMs);
    if (partial.dasMs !== undefined)
      timing.dasMs = createDurationMs(partial.dasMs);
    if (partial.gravityEnabled !== undefined)
      timing.gravityEnabled = partial.gravityEnabled;
    if (partial.gravityMs !== undefined)
      timing.gravityMs = createDurationMs(partial.gravityMs);
    if (partial.lineClearDelayMs !== undefined)
      timing.lineClearDelayMs = createDurationMs(partial.lineClearDelayMs);
    if (partial.lockDelayMs !== undefined)
      timing.lockDelayMs = createDurationMs(partial.lockDelayMs);
    if (partial.softDrop !== undefined) timing.softDrop = partial.softDrop;

    if (Object.keys(timing).length > 0) {
      dispatch({ timing, type: "UpdateTiming" });
    }
  }

  /**
   * Update gameplay toggles and durations from primitives; converts numbers to brands.
   */
  updateGameplay(
    partial: Partial<{
      finesseCancelMs: number;
      ghostPieceEnabled: boolean;
      nextPieceCount: number;
      holdEnabled: boolean;
      finesseFeedbackEnabled: boolean;
      finesseBoopEnabled: boolean;
      retryOnFinesseError: boolean;
    }>,
  ): void {
    const gameplay: Partial<GameplayConfig> = {};
    if (partial.finesseCancelMs !== undefined)
      gameplay.finesseCancelMs = createDurationMs(partial.finesseCancelMs);
    if (partial.ghostPieceEnabled !== undefined)
      gameplay.ghostPieceEnabled = partial.ghostPieceEnabled;
    if (partial.nextPieceCount !== undefined)
      gameplay.nextPieceCount = partial.nextPieceCount;
    if (partial.holdEnabled !== undefined)
      gameplay.holdEnabled = partial.holdEnabled;
    if (partial.finesseFeedbackEnabled !== undefined)
      gameplay.finesseFeedbackEnabled = partial.finesseFeedbackEnabled;
    if (partial.finesseBoopEnabled !== undefined)
      gameplay.finesseBoopEnabled = partial.finesseBoopEnabled;
    if (partial.retryOnFinesseError !== undefined)
      gameplay.retryOnFinesseError = partial.retryOnFinesseError;

    if (Object.keys(gameplay).length > 0) {
      dispatch({ gameplay, type: "UpdateGameplay" });
    }
  }

  /** Convenience: set both timing and gameplay in one call */
  applySettings(opts: {
    timing?: Parameters<Settings["updateTimingMs"]>[0];
    gameplay?: Parameters<Settings["updateGameplay"]>[0];
  }): void {
    if (opts.timing) this.updateTimingMs(opts.timing);
    if (opts.gameplay) this.updateGameplay(opts.gameplay);
  }
}
