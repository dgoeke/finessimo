/**
 * Edge case tests for line clearing that might occur in real gameplay
 */

import { reducer } from "../../src/state/reducer";
import { shouldCompleteLineClear } from "../../src/app";
import { createTimestamp } from "../../src/types/timestamp";

describe("Line Clear Edge Cases", () => {
  it("should handle multiple ticks during line clear delay", () => {
    let state = reducer(undefined, {
      type: "Init",
      timing: { lineClearDelayMs: 300 },
    });

    // Set up line clear
    for (let x = 0; x < 6; x++) {
      state.board.cells[190 + x] = 1;
    }

    state = reducer(state, { type: "Spawn", piece: "I" });
    state = reducer(state, { type: "TapMove", dir: 1 });
    state = reducer(state, { type: "TapMove", dir: 1 });
    state = reducer(state, { type: "TapMove", dir: 1 });
    state = reducer(state, {
      type: "HardDrop",
      timestampMs: createTimestamp(1000),
    });

    const startTime = 1000;
    expect(state.status).toBe("lineClear");

    // Simulate multiple tick updates during the delay
    state = reducer(state, {
      type: "Tick",
      timestampMs: createTimestamp(startTime + 50),
    });
    expect(state.status).toBe("lineClear");

    state = reducer(state, {
      type: "Tick",
      timestampMs: createTimestamp(startTime + 100),
    });
    expect(state.status).toBe("lineClear");

    state = reducer(state, {
      type: "Tick",
      timestampMs: createTimestamp(startTime + 200),
    });
    expect(state.status).toBe("lineClear");

    // Should still be waiting for completion
    expect(shouldCompleteLineClear(state, startTime + 299)).toBe(false);
    expect(shouldCompleteLineClear(state, startTime + 300)).toBe(true);

    // Complete the line clear
    state = reducer(state, { type: "CompleteLineClear" });
    expect(state.status).toBe("playing");
  });

  it("should handle line clear when next piece spawning is attempted", () => {
    let state = reducer(undefined, {
      type: "Init",
      timing: { lineClearDelayMs: 250 },
    });

    // Set up line clear
    for (let x = 0; x < 6; x++) {
      state.board.cells[190 + x] = 1;
    }

    state = reducer(state, { type: "Spawn", piece: "I" });
    state = reducer(state, { type: "TapMove", dir: 1 });
    state = reducer(state, { type: "TapMove", dir: 1 });
    state = reducer(state, { type: "TapMove", dir: 1 });
    state = reducer(state, {
      type: "HardDrop",
      timestampMs: createTimestamp(2000),
    });

    expect(state.status).toBe("lineClear");
    expect(state.active).toBeUndefined();

    // Try to spawn during line clear - should be ignored
    state = reducer(state, { type: "Spawn" });
    expect(state.status).toBe("lineClear");
    expect(state.active).toBeUndefined();

    // Complete line clear
    state = reducer(state, { type: "CompleteLineClear" });
    expect(state.status).toBe("playing");

    // Now spawning should work
    state = reducer(state, { type: "Spawn" });
    expect(state.active).toBeDefined();
  });

  it("should handle piece movement attempts during line clear", () => {
    let state = reducer(undefined, {
      type: "Init",
      timing: { lineClearDelayMs: 200 },
    });

    // Set up line clear
    for (let x = 0; x < 6; x++) {
      state.board.cells[190 + x] = 1;
    }

    state = reducer(state, { type: "Spawn", piece: "I" });
    state = reducer(state, { type: "TapMove", dir: 1 });
    state = reducer(state, { type: "TapMove", dir: 1 });
    state = reducer(state, { type: "TapMove", dir: 1 });
    state = reducer(state, {
      type: "HardDrop",
      timestampMs: createTimestamp(3000),
    });

    expect(state.status).toBe("lineClear");
    expect(state.active).toBeUndefined();

    // Try to move non-existent piece
    state = reducer(state, { type: "TapMove", dir: 1 });

    // Should be unchanged
    expect(state.status).toBe("lineClear");
    expect(state.active).toBeUndefined();

    // Complete line clear and verify it works
    state = reducer(state, { type: "CompleteLineClear" });
    expect(state.status).toBe("playing");
  });

  it("should handle line clear completion timing edge case", () => {
    let state = reducer(undefined, {
      type: "Init",
      timing: { lineClearDelayMs: 100 },
    });

    // Create line clear scenario
    for (let x = 0; x < 6; x++) {
      state.board.cells[190 + x] = 1;
    }

    state = reducer(state, { type: "Spawn", piece: "I" });
    state = reducer(state, { type: "TapMove", dir: 1 });
    state = reducer(state, { type: "TapMove", dir: 1 });
    state = reducer(state, { type: "TapMove", dir: 1 });

    const lockTime = 5000;
    state = reducer(state, {
      type: "HardDrop",
      timestampMs: createTimestamp(lockTime),
    });

    expect(state.status).toBe("lineClear");
    expect(state.physics.lineClearStartTime).toBe(lockTime);

    // Test timing boundaries
    expect(shouldCompleteLineClear(state, lockTime + 99)).toBe(false);
    expect(shouldCompleteLineClear(state, lockTime + 100)).toBe(true);
    expect(shouldCompleteLineClear(state, lockTime + 101)).toBe(true);

    // Complete and verify
    state = reducer(state, { type: "CompleteLineClear" });
    expect(state.status).toBe("playing");
    expect(state.physics.lineClearStartTime).toBeNull();
  });

  it("should handle multiple successive line clears", () => {
    let state = reducer(undefined, {
      type: "Init",
      timing: { lineClearDelayMs: 150 },
    });

    // Fill multiple rows for successive clears
    for (let y = 18; y < 20; y++) {
      for (let x = 0; x < 6; x++) {
        state.board.cells[y * 10 + x] = 1;
      }
    }

    // First line clear
    state = reducer(state, { type: "Spawn", piece: "I" });
    state = reducer(state, { type: "TapMove", dir: 1 });
    state = reducer(state, { type: "TapMove", dir: 1 });
    state = reducer(state, { type: "TapMove", dir: 1 });
    state = reducer(state, {
      type: "HardDrop",
      timestampMs: createTimestamp(4000),
    });

    expect(state.status).toBe("lineClear");
    expect(state.physics.lineClearLines).toEqual([19]); // Only bottom line is complete

    // Complete first line clear
    state = reducer(state, { type: "CompleteLineClear" });
    expect(state.status).toBe("playing");

    // The previous row 18 should now be at row 19 and still incomplete
    // Should be able to spawn new piece normally
    state = reducer(state, { type: "Spawn" });
    expect(state.active).toBeDefined();
    expect(state.status).toBe("playing");
  });
});
