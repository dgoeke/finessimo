import { describe, it, expect } from "@jest/globals";
import { reducer } from "../../src/state/reducer";
import { GameState } from "../../src/state/types";

describe("finesse analysis trigger logic", () => {
  it("should properly detect when a piece becomes inactive (auto-lock scenario)", () => {
    // Test that the app.ts logic for detecting piece lock works
    // This tests the condition: if (prevState.active && !newState.active)

    function createTestState(): GameState {
      return reducer(undefined, {
        type: "Init",
        seed: "test",
        timing: {
          gravityEnabled: true,
          gravityMs: 1000,
          lockDelayMs: 500,
        },
      });
    }

    const state = createTestState();

    // Create state with active piece in lock delay
    const stateWithActive: GameState = {
      ...state,
      active: {
        id: "T",
        x: 4,
        y: 18,
        rot: "spawn",
      },
      physics: {
        ...state.physics,
        lockDelayStartTime: 1000,
        lastGravityTime: 0,
      },
    };

    // Trigger auto-lock by advancing time past lock delay
    const stateAfterAutoLock = reducer(stateWithActive, {
      type: "Tick",
      timestampMs: 1500 + 500, // Past lock delay
    });

    // Verify that this scenario would trigger finesse analysis
    // (i.e., piece went from active to inactive)
    expect(stateWithActive.active).toBeDefined();
    expect(stateAfterAutoLock.active).toBeUndefined();

    // This confirms the trigger condition: prevState.active && !newState.active
    expect(stateWithActive.active && !stateAfterAutoLock.active).toBe(true);
  });

  it("should detect piece lock on HardDrop", () => {
    function createTestState(): GameState {
      return reducer(undefined, {
        type: "Init",
        seed: "test",
        timing: {
          gravityEnabled: true,
          gravityMs: 1000,
          lockDelayMs: 500,
        },
      });
    }

    const state = createTestState();

    const stateWithActive: GameState = {
      ...state,
      active: {
        id: "T",
        x: 4,
        y: 10, // High up
        rot: "spawn",
      },
    };

    // HardDrop should lock the piece
    const stateAfterHardDrop = reducer(stateWithActive, {
      type: "HardDrop",
    });

    // Verify piece lock detection for HardDrop
    expect(stateWithActive.active).toBeDefined();
    expect(stateAfterHardDrop.active).toBeUndefined();

    // This confirms the trigger condition works for HardDrop too
    expect(stateWithActive.active && !stateAfterHardDrop.active).toBe(true);
  });
});
