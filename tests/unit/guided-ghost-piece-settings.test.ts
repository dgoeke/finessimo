import { describe, it, expect } from "@jest/globals";

import { selectGhostOverlay } from "../../src/engine/selectors/overlays";
import { reducer as gameReducer } from "../../src/state/reducer";
import { createDurationMs } from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";
import { createTestGameState } from "../test-helpers";

describe("Guided mode ghost piece behavior", () => {
  it("should not render ghost pieces in guided mode regardless of settings", () => {
    // Create initial state with ghost pieces enabled in settings
    const initialState = createTestGameState({
      currentMode: "freePlay",
      gameplay: {
        finesseBoopEnabled: false,
        // Include all required fields for a complete GameplayConfig
        finesseCancelMs: createDurationMs(50),
        finesseFeedbackEnabled: true,
        ghostPieceEnabled: true, // User preference: enabled
        holdEnabled: true,
        nextPieceCount: 5,
        retryOnFinesseError: false,
      },
      nextQueue: ["T", "I", "O", "S", "Z"], // Add pieces to the queue
    });

    // Spawn a piece in free play mode
    const stateWithPiece = gameReducer(initialState, {
      timestampMs: createTimestamp(1001),
      type: "Spawn",
    });

    // Ghost should be available in free play mode
    const ghostInFreePlay = selectGhostOverlay(stateWithPiece);
    expect(ghostInFreePlay).not.toBeNull();

    // Create a guided mode state with the same ghost piece setting
    const guidedState = createTestGameState({
      currentMode: "guided",
      gameplay: {
        finesseBoopEnabled: false,
        // Include all required fields for a complete GameplayConfig
        finesseCancelMs: createDurationMs(50),
        finesseFeedbackEnabled: true,
        ghostPieceEnabled: true, // User's preference preserved
        holdEnabled: false, // Guided mode disables hold
        nextPieceCount: 5,
        retryOnFinesseError: false,
      },
      nextQueue: ["T", "I", "O", "S", "Z"], // Add pieces to the queue
    });

    // Spawn a piece in guided mode
    const guidedWithPiece = gameReducer(guidedState, {
      timestampMs: createTimestamp(1003),
      type: "Spawn",
    });

    // Ghost should NOT be rendered in guided mode despite settings
    const ghostInGuided = selectGhostOverlay(guidedWithPiece);
    expect(ghostInGuided).toBeNull();

    // Verify we're actually in guided mode and have an active piece
    expect(guidedWithPiece.currentMode).toBe("guided");
    expect(guidedWithPiece.active).not.toBeUndefined();
    expect(guidedWithPiece.status).toBe("playing");
    expect(guidedWithPiece.gameplay.ghostPieceEnabled).toBe(true);
  });

  it("should not render ghost pieces in guided mode even with explicit ghostPieceEnabled: false", () => {
    // Test the case where user has explicitly disabled ghost pieces
    const guidedState = createTestGameState({
      currentMode: "guided",
      gameplay: {
        finesseBoopEnabled: false,
        // Include all required fields for a complete GameplayConfig
        finesseCancelMs: createDurationMs(50),
        finesseFeedbackEnabled: true,
        ghostPieceEnabled: false, // User preference: disabled
        holdEnabled: false,
        nextPieceCount: 5,
        retryOnFinesseError: false,
      },
      nextQueue: ["T", "I", "O", "S", "Z"], // Add pieces to the queue
    });

    const stateWithPiece = gameReducer(guidedState, {
      timestampMs: createTimestamp(1001),
      type: "Spawn",
    });

    // Ghost should not be rendered in guided mode
    const ghost = selectGhostOverlay(stateWithPiece);
    expect(ghost).toBeNull();

    // Verify the user's setting is preserved and we're in guided mode
    expect(stateWithPiece.gameplay.ghostPieceEnabled).toBe(false);
    expect(stateWithPiece.currentMode).toBe("guided");
  });
});
