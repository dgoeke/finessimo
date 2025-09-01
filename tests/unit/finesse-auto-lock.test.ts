import { describe, it, expect } from "@jest/globals";

import { type GameState, buildPlayingState } from "../../src/state/types";
import {
  createSeed,
  createDurationMs,
  createGridCoord,
} from "../../src/types/brands";
import { createTimestamp, fromNow } from "../../src/types/timestamp";
import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";

describe("finesse analysis trigger logic", () => {
  const createTestState = (): GameState =>
    reducer(undefined, {
      seed: createSeed("test"),
      timestampMs: fromNow(),
      timing: {
        gravityEnabled: true,
        gravityMs: createDurationMs(1000),
        lockDelayMs: createDurationMs(500),
      },
      type: "Init",
    });

  it("should properly detect when a piece becomes inactive (auto-lock scenario)", () => {
    // Test that the app.ts logic for detecting piece lock works
    // This tests the condition: if (prevState.active && !newState.active)

    const state = createTestState();

    // Create state with active piece in lock delay
    const stateWithActive: GameState = buildPlayingState(
      {
        ...state,
        physics: {
          ...state.physics,
          lastGravityTime: createTimestamp(1),
          lockDelay: {
            resets: 0,
            start: createTimestamp(1000),
            tag: "Grounded",
          },
        },
      },
      {
        active: {
          id: "T",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(18),
        },
      },
    );

    // Trigger auto-lock by advancing time past lock delay
    const stateAfterAutoLock = reducer(stateWithActive, {
      timestampMs: createTimestamp(1500 + 500), // Past lock delay
      type: "Tick",
    });

    // Verify that this scenario would trigger finesse analysis
    // (i.e., piece went from active to inactive)
    expect(stateWithActive.active).toBeDefined();
    expect(stateAfterAutoLock.active).toBeUndefined();

    // This confirms the trigger condition: prevState.active && !newState.active
    expect(stateWithActive.active && !stateAfterAutoLock.active).toBe(true);
  });

  it("should detect piece lock on HardDrop", () => {
    const state = createTestState();

    const stateWithActive: GameState = buildPlayingState(state, {
      active: {
        id: "T",
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(10), // High up
      },
    });

    // HardDrop should lock the piece
    const stateAfterHardDrop = reducer(stateWithActive, {
      timestampMs: createTimestamp(1000),
      type: "HardDrop",
    });

    // Verify piece lock detection for HardDrop
    expect(stateWithActive.active).toBeDefined();
    expect(stateAfterHardDrop.active).toBeUndefined();

    // This confirms the trigger condition works for HardDrop too
    expect(stateWithActive.active && !stateAfterHardDrop.active).toBe(true);
  });
});
