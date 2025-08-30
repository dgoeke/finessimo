import type { GameState } from "../../state/types";
import type { ModeUiAdapter, ExtendedModeData } from "../types";

/**
 * Free play mode UI adapter implementation.
 *
 * Free play mode has minimal UI requirements - no special targets,
 * overlays, or guidance beyond standard finesse feedback.
 * This adapter returns null to indicate no special UI data is needed.
 */
export const freePlayUi: ModeUiAdapter = {
  /**
   * Free play mode requires no special UI data.
   * All UI needs are handled by standard game rendering and finesse feedback.
   *
   * @param _state - Current game state (unused)
   * @returns null - no special UI data needed
   */
  computeDerivedUi(_state: GameState): Partial<ExtendedModeData> | null {
    return null;
  },
} as const;
