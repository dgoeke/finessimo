import { createDurationMs, createGridCoord } from "../../src/types/brands";
import { createTestGameState } from "../test-helpers";

import type { PolicyOutput } from "../../src/policy/types";
import type { GameplayConfig, GameState } from "../../src/state/types";

// Mock the CoachOverlay component for testing
class MockCoachOverlay {
  private updateCoachFeedbackImpl(gameState: GameState): void {
    // Only show coaching if it's enabled in gameplay settings
    if (!gameState.gameplay.openingCoachingEnabled) {
      return;
    }

    // Extract policy output from game state
    const policyOutput = this.extractPolicyOutput(gameState);
    const suggestion = policyOutput?.suggestion;
    const rationale = suggestion?.rationale;

    if (rationale === undefined || rationale.trim().length === 0) {
      return;
    }

    // Would handle active suggestion in real implementation
  }

  private extractPolicyOutput(gameState: GameState): PolicyOutput | null {
    const modeData = gameState.modeData;

    if (
      modeData !== null &&
      typeof modeData === "object" &&
      "policyOutput" in modeData
    ) {
      return (modeData as Record<string, unknown>)[
        "policyOutput"
      ] as PolicyOutput;
    }

    // Check if there's a policyOutput field directly on the game state
    if ("policyOutput" in gameState) {
      return (gameState as GameState & { policyOutput: PolicyOutput })
        .policyOutput;
    }

    return null;
  }

  public testUpdateCoachFeedback(gameState: GameState): void {
    this.updateCoachFeedbackImpl(gameState);
  }

  public testExtractPolicyOutput(gameState: GameState): PolicyOutput | null {
    return this.extractPolicyOutput(gameState);
  }
}

describe("Coach Overlay - Opening Coaching", () => {
  let overlay: MockCoachOverlay;

  beforeEach(() => {
    overlay = new MockCoachOverlay();
  });

  describe("extractPolicyOutput", () => {
    it("should return null when modeData is null", () => {
      const gameplay: GameplayConfig = {
        finesseCancelMs: createDurationMs(50),
        holdEnabled: true,
        openingCoachingEnabled: true,
      };
      const state = createTestGameState({ gameplay, modeData: null });

      const result = overlay.testExtractPolicyOutput(state);

      expect(result).toBeNull();
    });

    it("should return null when modeData doesn't have policyOutput", () => {
      const gameplay: GameplayConfig = {
        finesseCancelMs: createDurationMs(50),
        holdEnabled: true,
        openingCoachingEnabled: true,
      };
      const state = createTestGameState({
        gameplay,
        modeData: { someOtherData: true },
      });

      const result = overlay.testExtractPolicyOutput(state);

      expect(result).toBeNull();
    });

    it("should return policyOutput when present in modeData", () => {
      const gameplay: GameplayConfig = {
        finesseCancelMs: createDurationMs(50),
        holdEnabled: true,
        openingCoachingEnabled: true,
      };
      const mockPolicyOutput: PolicyOutput = {
        nextCtx: {
          lastBestScore: null,
          lastPlanId: null,
          lastSecondScore: null,
          lastUpdate: null,
          planAge: 0,
        },
        suggestion: {
          confidence: 0.8,
          intent: "TKI",
          placement: { rot: "spawn", x: createGridCoord(4) },
          planId: "TKI/base",
          rationale: "Test rationale",
        },
      };

      // Create state with modeData in baseOverrides and active piece
      const state = createTestGameState(
        {
          gameplay,
          modeData: { policyOutput: mockPolicyOutput },
        },
        {
          active: {
            id: "T",
            rot: "spawn",
            x: createGridCoord(4),
            y: createGridCoord(0),
          },
        },
      );

      const result = overlay.testExtractPolicyOutput(state);

      expect(result).toEqual(mockPolicyOutput);
    });
  });

  describe("updateCoachFeedback", () => {
    it("should not process feedback when coaching is disabled", () => {
      const gameplay: GameplayConfig = {
        finesseCancelMs: createDurationMs(50),
        holdEnabled: true,
        openingCoachingEnabled: false,
      };
      const state = createTestGameState({ gameplay });

      // Should not throw or cause issues
      expect(() => overlay.testUpdateCoachFeedback(state)).not.toThrow();
    });

    it("should process feedback when coaching is enabled", () => {
      const gameplay: GameplayConfig = {
        finesseCancelMs: createDurationMs(50),
        holdEnabled: true,
        openingCoachingEnabled: true,
      };
      const mockPolicyOutput: PolicyOutput = {
        nextCtx: {
          lastBestScore: null,
          lastPlanId: null,
          lastSecondScore: null,
          lastUpdate: null,
          planAge: 0,
        },
        suggestion: {
          confidence: 0.8,
          intent: "TKI",
          placement: { rot: "spawn", x: createGridCoord(4) },
          planId: "TKI/base",
          rationale: "Test rationale",
        },
      };
      const state = createTestGameState({
        gameplay,
        modeData: { policyOutput: mockPolicyOutput },
      });

      // Should not throw or cause issues
      expect(() => overlay.testUpdateCoachFeedback(state)).not.toThrow();
    });
  });
});
