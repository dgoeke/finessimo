/**
 * Integration test for line clearing with real app update loop
 */

import { shouldCompleteLineClear } from "../../src/app";
import { createTimestamp } from "../../src/types/timestamp";
import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";

describe("Line Clear Integration", () => {
  it("should complete line clearing through the app update loop", () => {
    // Initialize game state with 300ms delay (like real gameplay)
    let state = reducer(undefined, {
      seed: "test",
      timing: { lineClearDelayMs: 300 },
      type: "Init",
    });

    // Create line clear scenario
    for (let x = 0; x < 6; x++) {
      state.board.cells[190 + x] = 1; // Bottom row (y=19, x=0-5)
    }

    // Spawn I piece and position it
    state = reducer(state, { piece: "I", type: "Spawn" });
    state = reducer(state, { dir: 1, optimistic: false, type: "TapMove" });
    state = reducer(state, { dir: 1, optimistic: false, type: "TapMove" });
    state = reducer(state, { dir: 1, optimistic: false, type: "TapMove" });

    // Hard drop to trigger line clear
    const startTime = 1000;
    state = reducer(state, {
      timestampMs: createTimestamp(startTime),
      type: "HardDrop",
    });

    // Should be in lineClear status
    expect(state.status).toBe("lineClear");
    expect(state.physics.lineClearStartTime).toBe(startTime);
    expect(state.physics.lineClearLines).toEqual([19]);

    // Simulate app update loop timing
    // Before delay expires (299ms)
    expect(shouldCompleteLineClear(state, startTime + 299)).toBe(false);

    // Exactly at delay expiration (300ms)
    expect(shouldCompleteLineClear(state, startTime + 300)).toBe(true);

    // After delay expires (350ms)
    expect(shouldCompleteLineClear(state, startTime + 350)).toBe(true);

    // Complete the line clear
    state = reducer(state, { type: "CompleteLineClear" });

    // Should return to playing status with line cleared
    expect(state.status).toBe("playing");
    expect(state.physics.lineClearStartTime).toBeNull();
    expect(state.physics.lineClearLines).toEqual([]);

    // Bottom row should be empty (line was cleared)
    for (let x = 0; x < 10; x++) {
      expect(state.board.cells[190 + x]).toBe(0);
    }
  });

  it("should handle the default UI settings scenario", () => {
    // This simulates what happens when the app starts with UI settings
    let state = reducer(undefined, { seed: "test", type: "Init" }); // Default 0ms delay

    // Apply settings change to 300ms (like UI default)
    state = reducer(state, {
      timing: { lineClearDelayMs: 300 },
      type: "UpdateTiming",
    });

    expect(state.timing.lineClearDelayMs).toBe(300);

    // Create and clear a line
    for (let x = 0; x < 6; x++) {
      state.board.cells[190 + x] = 1;
    }

    state = reducer(state, { piece: "I", type: "Spawn" });
    state = reducer(state, { dir: 1, optimistic: false, type: "TapMove" });
    state = reducer(state, { dir: 1, optimistic: false, type: "TapMove" });
    state = reducer(state, { dir: 1, optimistic: false, type: "TapMove" });
    state = reducer(state, {
      timestampMs: createTimestamp(2000),
      type: "HardDrop",
    });

    // Should enter lineClear status with 300ms delay
    expect(state.status).toBe("lineClear");
    expect(shouldCompleteLineClear(state, 2300)).toBe(true);

    // Complete and verify
    state = reducer(state, { type: "CompleteLineClear" });
    expect(state.status).toBe("playing");
  });

  it("should prevent piece spawning during line clear delay", () => {
    let state = reducer(undefined, {
      seed: "test",
      timing: { lineClearDelayMs: 200 },
      type: "Init",
    });

    // Set up line clear
    for (let x = 0; x < 6; x++) {
      state.board.cells[190 + x] = 1;
    }

    state = reducer(state, { piece: "I", type: "Spawn" });
    state = reducer(state, { dir: 1, optimistic: false, type: "TapMove" });
    state = reducer(state, { dir: 1, optimistic: false, type: "TapMove" });
    state = reducer(state, { dir: 1, optimistic: false, type: "TapMove" });
    state = reducer(state, {
      timestampMs: createTimestamp(3000),
      type: "HardDrop",
    });

    // Should be in lineClear status
    expect(state.status).toBe("lineClear");
    expect(state.active).toBeUndefined();

    // Try to spawn - should be ignored
    const beforeSpawn = { ...state };
    state = reducer(state, { type: "Spawn" });

    // State should be unchanged
    expect(state.status).toBe("lineClear");
    expect(state.active).toBeUndefined();
    expect(state.physics.lineClearLines).toEqual(
      beforeSpawn.physics.lineClearLines,
    );

    // Complete line clear
    state = reducer(state, { type: "CompleteLineClear" });
    expect(state.status).toBe("playing");

    // Now spawning should work
    state = reducer(state, { type: "Spawn" });
    expect(state.active).toBeDefined();
  });
});
