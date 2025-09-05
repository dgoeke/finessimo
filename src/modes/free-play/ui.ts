import type { GameState } from "../../state/types";
import type { ModeUiAdapter, ExtendedModeData } from "../types";

/**
 * Free play mode UI adapter implementation.
 *
 * Simple implementation that provides no special UI adaptations for free play.
 */
export const freePlayUi: ModeUiAdapter = {
  /**
   * Compute derived UI data for free play mode.
   *
   * @param _state - Current game state
   * @returns No special UI data needed for free play
   */
  computeDerivedUi(_state: GameState): Partial<ExtendedModeData> | null {
    // Free play mode needs no special UI adaptations
    return null;
  },
} as const;
