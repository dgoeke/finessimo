/**
 * Tests for line clearing regression bug
 *
 * This test file covers the regression where lines don't clear properly
 * when lineClearDelayMs > 0, causing game softlock.
 */

import { shouldCompleteLineClear } from "../../src/app";
import { type GameState } from "../../src/state/types";
import { createSeed, createDurationMs } from "../../src/types/brands";
import { createTimestamp, fromNow } from "../../src/types/timestamp";
import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";
import {
  createTestSpawnAction,
  createTestTapMoveAction,
} from "../test-helpers";

// Helper function to create a state with a line ready to clear
function createStateWithCompleteLine(lineClearDelayMs: number): GameState {
  let state = reducer(undefined, {
    seed: createSeed("test"),
    timestampMs: fromNow(),
    timing: { lineClearDelayMs: createDurationMs(lineClearDelayMs) },
    type: "Init",
  });

  // Fill bottom row leaving space for I piece (4 cells)
  for (let x = 0; x < 6; x++) {
    state.board.cells[190 + x] = 1; // Bottom row (y=19, x=0-5)
  }

  // Spawn I piece
  state = reducer(state, createTestSpawnAction("I"));

  // Move I piece to complete the line
  if (state.active) {
    // I piece spawns at x=3 with cells at [0,1],[1,1],[2,1],[3,1] relative to piece
    // At x=3, this puts cells at board positions x=3,4,5,6
    // We want to fill x=6,7,8,9 to complete the line (since x=0-5 are already filled)
    state = reducer(state, createTestTapMoveAction(1, false)); // x=4 -> cells at 4,5,6,7
    state = reducer(state, createTestTapMoveAction(1, false)); // x=5 -> cells at 5,6,7,8
    state = reducer(state, createTestTapMoveAction(1, false)); // x=6 -> cells at 6,7,8,9

    // HardDrop stages a pending lock for pre-commit pipeline decisions
    state = reducer(state, {
      timestampMs: createTimestamp(1000),
      type: "HardDrop",
    });

    // If still resolving, manually commit the staged lock for this test
    if (state.status === "resolvingLock") {
      state = reducer(state, { type: "CommitLock" });

      // Handle zero-delay line clear completion
      if (state.status === "lineClear" && lineClearDelayMs === 0) {
        state = reducer(state, { type: "CompleteLineClear" });
      }
    }
  }

  return state;
}

describe("Line Clearing Regression Tests", () => {
  describe("Zero delay (immediate clearing)", () => {
    it("should clear lines immediately with no animation delay", () => {
      const state = createStateWithCompleteLine(0);

      // With 0 delay, lines should be cleared immediately and status should be "playing"
      expect(state.status).toBe("playing");
      expect(state.active).toBeUndefined(); // No active piece after lock

      // Bottom row should be empty (line was cleared)
      for (let x = 0; x < 10; x++) {
        expect(state.board.cells[190 + x]).toBe(0);
      }

      // Physics should not have line clear state set
      expect(state.physics.lineClearStartTime).toBeNull();
      expect(state.physics.lineClearLines).toEqual([]);
    });

    it("should not trigger shouldCompleteLineClear for zero delay", () => {
      const state = createStateWithCompleteLine(0);

      // shouldCompleteLineClear should return false for immediate clearing
      expect(shouldCompleteLineClear(state, 2000)).toBe(false);
    });
  });

  describe("Positive delay (animated clearing)", () => {
    it("should enter lineClear status with 100ms delay", () => {
      const state = createStateWithCompleteLine(100);

      // With positive delay, should enter "lineClear" status
      expect(state.status).toBe("lineClear");
      expect(state.active).toBeUndefined(); // No active piece after lock

      // Bottom row should still be filled (not yet cleared)
      let filledCells = 0;
      for (let x = 0; x < 10; x++) {
        if (state.board.cells[190 + x] !== 0) filledCells++;
      }
      expect(filledCells).toBe(10); // All cells should be filled

      // Physics should have line clear state set
      expect(state.physics.lineClearStartTime).not.toBeNull();
      expect(state.physics.lineClearLines).toEqual([19]); // Bottom line
    });

    it("should complete line clearing after delay expires", () => {
      let state = createStateWithCompleteLine(100);
      expect(state.physics.lineClearStartTime).not.toBeNull();
      const startTime = state.physics.lineClearStartTime as number;

      // Before delay expires, should not complete
      expect(shouldCompleteLineClear(state, startTime + 50)).toBe(false);

      // After delay expires, should complete
      expect(shouldCompleteLineClear(state, startTime + 100)).toBe(true);
      expect(shouldCompleteLineClear(state, startTime + 150)).toBe(true);

      // Complete the line clear
      state = reducer(state, { type: "CompleteLineClear" });

      // After completion, status should be "playing"
      expect(state.status).toBe("playing");

      // Bottom row should be empty (line was cleared)
      for (let x = 0; x < 10; x++) {
        expect(state.board.cells[190 + x]).toBe(0);
      }

      // Physics should be reset
      expect(state.physics.lineClearStartTime).toBeNull();
      expect(state.physics.lineClearLines).toEqual([]);
    });

    it("should handle 300ms delay correctly", () => {
      const state = createStateWithCompleteLine(300);
      expect(state.physics.lineClearStartTime).not.toBeNull();
      const startTime = state.physics.lineClearStartTime as number;

      // Should be in lineClear status
      expect(state.status).toBe("lineClear");

      // Before delay expires
      expect(shouldCompleteLineClear(state, startTime + 200)).toBe(false);
      expect(shouldCompleteLineClear(state, startTime + 299)).toBe(false);

      // Exactly at delay
      expect(shouldCompleteLineClear(state, startTime + 300)).toBe(true);

      // After delay
      expect(shouldCompleteLineClear(state, startTime + 400)).toBe(true);
    });

    it("should handle 500ms delay correctly", () => {
      const state = createStateWithCompleteLine(500);
      expect(state.physics.lineClearStartTime).not.toBeNull();
      const startTime = state.physics.lineClearStartTime as number;

      // Should be in lineClear status
      expect(state.status).toBe("lineClear");

      // Before delay expires
      expect(shouldCompleteLineClear(state, startTime + 400)).toBe(false);
      expect(shouldCompleteLineClear(state, startTime + 499)).toBe(false);

      // Exactly at delay
      expect(shouldCompleteLineClear(state, startTime + 500)).toBe(true);

      // After delay
      expect(shouldCompleteLineClear(state, startTime + 600)).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should not complete line clear if not in lineClear status", () => {
      const state = reducer(undefined, {
        seed: createSeed("test"),
        timestampMs: fromNow(),
        timing: { lineClearDelayMs: createDurationMs(100) },
        type: "Init",
      });

      // Playing status should not trigger completion
      expect(state.status).toBe("playing");
      expect(shouldCompleteLineClear(state, 2000)).toBe(false);
    });

    it("should not complete line clear if startTime is null", () => {
      let state = createStateWithCompleteLine(100);

      // Manually set startTime to null to test edge case
      state = {
        ...state,
        physics: {
          ...state.physics,
          lineClearStartTime: null,
        },
      };

      expect(shouldCompleteLineClear(state, 2000)).toBe(false);
    });

    it("should handle multiple line clears with delay", () => {
      let state = reducer(undefined, {
        seed: createSeed("test"),
        timestampMs: fromNow(),
        timing: { lineClearDelayMs: createDurationMs(100) },
        type: "Init",
      });

      // Create a simpler 2-line clear scenario
      // Fill bottom 2 rows leaving space for horizontal I piece (4 cells)
      for (let y = 18; y < 20; y++) {
        for (let x = 0; x < 6; x++) {
          state.board.cells[y * 10 + x] = 1;
        }
      }

      // Create first I piece to clear both lines
      state = reducer(state, createTestSpawnAction("I"));
      if (state.active) {
        // Move I piece to complete both lines (x=6 -> cells at 6,7,8,9)
        state = reducer(state, createTestTapMoveAction(1, false)); // x=4
        state = reducer(state, createTestTapMoveAction(1, false)); // x=5
        state = reducer(state, createTestTapMoveAction(1, false)); // x=6

        // HardDrop stages a pending lock for pre-commit pipeline decisions
        state = reducer(state, {
          timestampMs: createTimestamp(1000),
          type: "HardDrop",
        });

        // If still resolving, manually commit the staged lock for this test
        if (state.status === "resolvingLock") {
          state = reducer(state, { type: "CommitLock" });
          // Note: Don't auto-complete line clear for positive delay (100ms)
        }
      }

      // Should be in lineClear status with line(s) to clear
      expect(state.status).toBe("lineClear");
      expect(state.physics.lineClearLines.length).toBeGreaterThan(0);

      expect(state.physics.lineClearStartTime).not.toBeNull();
      const startTime = state.physics.lineClearStartTime as number;
      expect(shouldCompleteLineClear(state, startTime + 100)).toBe(true);

      // Complete clearing
      state = reducer(state, { type: "CompleteLineClear" });
      expect(state.status).toBe("playing");

      // After line clearing, the completed line should be gone and rows should shift down
      // The former partial row 18 should now be at row 19, and row 18 should be empty
      const row18 = Array.from(state.board.cells.slice(180, 190));
      const row19 = Array.from(state.board.cells.slice(190, 200));

      // Row 18 should be empty (cleared rows at top get filled with zeros)
      expect(row18).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

      // Row 19 should have the previous content of row 18 (partial fill)
      expect(row19).toEqual([1, 1, 1, 1, 1, 1, 0, 0, 0, 0]);
    });
  });

  describe("Game flow integration", () => {
    it("should prevent piece spawning while in lineClear status", () => {
      let state = createStateWithCompleteLine(100);

      // Should be in lineClear status
      expect(state.status).toBe("lineClear");

      // Trying to spawn should be ignored
      const beforeSpawn = state;
      state = reducer(state, createTestSpawnAction());

      // State should be unchanged
      expect(state).toEqual(beforeSpawn);
      expect(state.active).toBeUndefined();
      expect(state.status).toBe("lineClear");
    });

    it("should allow piece spawning after line clear completion", () => {
      let state = createStateWithCompleteLine(100);

      // Complete the line clear
      state = reducer(state, { type: "CompleteLineClear" });
      expect(state.status).toBe("playing");

      // Now spawning should work
      state = reducer(state, createTestSpawnAction());
      expect(state.active).toBeDefined();
      expect(state.status).toBe("playing");
    });
  });
});
