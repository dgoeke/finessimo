import { recommendMove } from "../../policy/index";

import type { PolicyOutput, PolicyContext } from "../../policy/types";
import type { GameState } from "../../state/types";
import type { ModeUiAdapter, ExtendedModeData } from "../types";

/**
 * FreePlay mode data structure that includes policy context and output
 */
type FreePlayModeData = {
  policyContext: PolicyContext;
  policyOutput?: PolicyOutput;
};

/**
 * Free play mode UI adapter implementation.
 *
 * Computes policy recommendations when opening coaching is enabled
 * and provides them via modeData for the CoachOverlay to display.
 */
export const freePlayUi: ModeUiAdapter = {
  /**
   * Compute derived UI data including policy output for opening coaching.
   *
   * @param state - Current game state
   * @returns Policy output for coaching display, or null if not needed
   */
  computeDerivedUi(state: GameState): Partial<ExtendedModeData> | null {
    // Only generate policy output if opening coaching is enabled
    if (!state.gameplay.openingCoachingEnabled) {
      return null;
    }

    // Extract existing modeData with policy context
    const modeData = state.modeData as FreePlayModeData | null;
    if (!modeData?.policyContext) {
      return null;
    }

    try {
      // Generate policy recommendation
      const policyOutput = recommendMove(state, modeData.policyContext);

      // Return the policy output to be merged into modeData
      return {
        policyOutput,
      };
    } catch (error) {
      // Handle policy errors gracefully
      console.warn("Policy recommendation failed:", error);
      return null;
    }
  },
} as const;
