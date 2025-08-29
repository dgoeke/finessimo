import { describe, it, expect } from "@jest/globals";

import { isAtBottom } from "../../src/core/board";
import {
  createBoardCells,
  type GameState,
  isValidLockDelayState,
  hasActivePiece,
} from "../../src/state/types";
import {
  createSeed,
  createDurationMs,
  createGridCoord,
} from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";
import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";
import { createTestSpawnAction, createTestTimingConfig } from "../test-helpers";

// Helper to create a test state with ground contact detection
function createGroundedState(): GameState {
  // Create a state with a piece that is grounded
  let state = reducer(undefined, {
    seed: createSeed("test"),
    timestampMs: createTimestamp(1000),
    timing: createTestTimingConfig({
      gravityEnabled: false, // Disable gravity for controlled testing
      lockDelayMaxResets: 15,
      lockDelayMs: createDurationMs(500),
    }),
    type: "Init",
  });

  // Spawn a T piece
  state = reducer(state, createTestSpawnAction("T"));

  // Move the piece to the bottom by modifying the board to block further downward movement
  const cells = createBoardCells();
  cells.set(state.board.cells);
  // Add blocks under the T piece to make it grounded
  cells[19 * 10 + 3] = 1; // Block below T piece left
  cells[19 * 10 + 4] = 1; // Block below T piece center
  cells[19 * 10 + 5] = 1; // Block below T piece right

  state = {
    ...state,
    active: state.active
      ? {
          ...state.active,
          y: createGridCoord(17), // One row above support; grounded (can't move down)
        }
      : state.active,
    board: { ...state.board, cells },
  };

  return state;
}

describe("Lock Delay - Tetris Guideline Compliance", () => {
  describe("Core Lock Delay Rules", () => {
    it("should start lock delay when piece lands via gravity", () => {
      let state = reducer(undefined, {
        seed: createSeed("test"),
        timestampMs: createTimestamp(1000),
        timing: createTestTimingConfig({
          gravityEnabled: true,
          gravityMs: createDurationMs(100),
          lockDelayMs: createDurationMs(500),
        }),
        type: "Init",
      });

      // Spawn a piece and let it drop to the ground with gravity
      state = reducer(state, createTestSpawnAction("T"));

      // Create ground by adding blocks at bottom
      const cells = createBoardCells();
      cells.set(state.board.cells);
      for (let x = 0; x < 10; x++) {
        cells[19 * 10 + x] = 1; // Fill bottom row
      }
      state = {
        ...state,
        active: state.active
          ? {
              ...state.active,
              y: createGridCoord(17), // Position piece just above ground
            }
          : state.active,
        board: { ...state.board, cells },
      };

      // Trigger gravity to make piece land
      const nextTick = reducer(state, {
        timestampMs: createTimestamp(1200), // After gravity interval
        type: "Tick",
      });

      // Should start lock delay immediately upon landing
      expect(nextTick.physics.lockDelayStartTime).not.toBeNull();
      expect(nextTick.physics.lockDelayResetCount).toBe(0);
    });

    it("should start lock delay when piece lands via soft drop", () => {
      let state = createGroundedState();

      // Move piece up first
      state = {
        ...state,
        active: state.active
          ? {
              ...state.active,
              y: createGridCoord(16), // Two rows above ground
            }
          : state.active,
        physics: {
          ...state.physics,
          lockDelayStartTime: null, // Ensure no lock delay initially
        },
      };

      // Soft drop the piece to ground
      state = reducer(state, {
        on: true,
        timestampMs: createTimestamp(1050),
        type: "SoftDrop",
      });

      // Should start lock delay immediately upon soft drop landing
      expect(state.physics.lockDelayStartTime).not.toBeNull();
      expect(state.physics.lockDelayResetCount).toBe(0);
    });

    it("should start lock delay when piece rotates onto ground", () => {
      let state = reducer(undefined, {
        seed: createSeed("test"),
        timestampMs: createTimestamp(1000),
        timing: createTestTimingConfig({
          lockDelayMs: createDurationMs(500),
        }),
        type: "Init",
      });

      // Spawn an I piece which is long and narrow
      state = reducer(state, createTestSpawnAction("I"));

      // Position I piece horizontally above ground with room to rotate
      const cells = createBoardCells();
      cells.set(state.board.cells);
      cells[19 * 10 + 4] = 1; // Single block that would touch piece after rotation

      state = {
        ...state,
        active: state.active
          ? {
              ...state.active,
              x: createGridCoord(4),
              y: createGridCoord(16), // Position so rotation will touch ground
            }
          : state.active,
        board: { ...state.board, cells },
        physics: {
          ...state.physics,
          lockDelayStartTime: null, // Ensure no lock delay initially
        },
      };

      // Verify piece is not grounded before rotation
      if (state.active) {
        expect(isAtBottom(state.board, state.active)).toBe(false);
      }

      // Rotate the piece - this should make it touch the ground
      const afterRotation = reducer(state, {
        dir: "CW",
        timestampMs: createTimestamp(1050),
        type: "Rotate",
      });

      // Should start lock delay after rotation brings piece to ground
      expect(afterRotation.physics.lockDelayStartTime).not.toBeNull();
      expect(afterRotation.physics.lockDelayResetCount).toBe(0);
    });

    it("should start lock delay when piece moves sideways onto ground", () => {
      let state = reducer(undefined, {
        seed: createSeed("test"),
        timestampMs: createTimestamp(1000),
        timing: createTestTimingConfig({
          lockDelayMs: createDurationMs(500),
        }),
        type: "Init",
      });

      state = reducer(state, createTestSpawnAction("T"));

      // Create a configuration where moving sideways will ground the piece
      // The T piece normally has blocks at positions (x-1, y+1), (x, y+1), (x+1, y+1)
      // We'll create ground only under the right side of the T piece
      const cells = createBoardCells();
      cells.set(state.board.cells);
      cells[19 * 10 + 6] = 1; // Block that will support right side of piece after sideways movement

      state = {
        ...state,
        active: state.active
          ? {
              ...state.active,
              x: createGridCoord(3), // Position so moving right will put right edge over support
              y: createGridCoord(17), // Position piece higher up
            }
          : state.active,
        board: { ...state.board, cells },
        physics: {
          ...state.physics,
          lockDelayStartTime: null,
        },
      };

      // Verify not grounded initially
      if (state.active) {
        expect(isAtBottom(state.board, state.active)).toBe(false);
      }

      // Move piece sideways - this should cause it to be supported by the block below
      const afterMove = reducer(state, {
        dir: 1,
        optimistic: false,
        timestampMs: createTimestamp(1000),
        type: "TapMove",
      });

      // Should start lock delay immediately
      expect(afterMove.physics.lockDelayStartTime).toBe(1000);
      expect(afterMove.physics.lockDelayResetCount).toBe(0);
    });
  });

  describe("Lock Delay Reset Behavior", () => {
    it("should reset lock delay timer on lateral movement while grounded", () => {
      let state = createGroundedState();

      // Start with lock delay already active
      state = {
        ...state,
        physics: {
          ...state.physics,
          lockDelayResetCount: 0,
          lockDelayStartTime: createTimestamp(1000),
        },
      };

      // Move piece laterally while grounded
      const afterMove = reducer(state, {
        dir: 1,
        optimistic: false,
        timestampMs: createTimestamp(1200),
        type: "TapMove",
      });

      // Should reset timer to new timestamp and increment reset count
      expect(afterMove.physics.lockDelayStartTime).toBe(1200);
      expect(afterMove.physics.lockDelayResetCount).toBe(1);
    });

    it("should reset lock delay timer on rotation while grounded", () => {
      let state = createGroundedState();

      // Start with lock delay active
      state = {
        ...state,
        physics: {
          ...state.physics,
          lockDelayResetCount: 0,
          lockDelayStartTime: createTimestamp(1000),
        },
      };

      // Rotate piece while grounded
      const afterRotation = reducer(state, {
        dir: "CW",
        timestampMs: createTimestamp(1050),
        type: "Rotate",
      });

      // Should increment reset count and update timer with new timestamp
      expect(afterRotation.physics.lockDelayStartTime).toBe(1050);
      expect(afterRotation.physics.lockDelayResetCount).toBe(1);
    });

    it("should enforce 15-reset limit", () => {
      let state = createGroundedState();

      // Start with lock delay at the reset limit
      state = {
        ...state,
        physics: {
          ...state.physics,
          lockDelayResetCount: 15, // At limit
          lockDelayStartTime: createTimestamp(1000),
        },
      };

      // Try to move piece laterally
      const afterMove = reducer(state, {
        dir: 1,
        optimistic: false,
        timestampMs: createTimestamp(1200),
        type: "TapMove",
      });

      // Should NOT reset the timer anymore - stays at original time
      expect(afterMove.physics.lockDelayStartTime).toBe(1000);
      expect(afterMove.physics.lockDelayResetCount).toBe(15);
    });

    it("should force lock immediately when at reset limit", () => {
      let state = createGroundedState();

      // Start with lock delay at the reset limit
      state = {
        ...state,
        physics: {
          ...state.physics,
          lockDelayResetCount: 15, // At limit
          lockDelayStartTime: createTimestamp(1000),
        },
      };

      // Trigger lock delay timeout check - should lock immediately even with 0 elapsed time
      const afterTick = reducer(state, {
        timestampMs: createTimestamp(1001), // Just 1ms later
        type: "Tick",
      });

      // After lock resolution pipeline, game returns to playing with no active piece
      expect(afterTick.status).toBe("playing");
      expect(afterTick.active).toBeUndefined();
    });
  });

  describe("Lock Delay Cancellation", () => {
    it("should cancel lock delay when piece moves off ground but preserve reset count", () => {
      let state = createGroundedState();

      // Start with lock delay active
      state = {
        ...state,
        physics: {
          ...state.physics,
          lockDelayResetCount: 5,
          lockDelayStartTime: createTimestamp(1000),
        },
      };

      // Remove ground support to make piece airborne
      const cells = createBoardCells();
      cells.set(state.board.cells);
      // Clear the blocks that were supporting the piece
      cells[19 * 10 + 3] = 0;
      cells[19 * 10 + 4] = 0;
      cells[19 * 10 + 5] = 0;

      state = {
        ...state,
        board: { ...state.board, cells },
      };

      // Move piece (which should now not be grounded)
      const afterMove = reducer(state, {
        dir: 1,
        optimistic: false,
        timestampMs: createTimestamp(1050),
        type: "TapMove",
      });

      // Should cancel lock delay but keep the accumulated reset count
      expect(afterMove.physics.lockDelayStartTime).toBeNull();
      expect(afterMove.physics.lockDelayResetCount).toBe(5);
    });
  });

  describe("Lock Delay Duration and Timeout", () => {
    it("should lock piece after standard 500ms delay", () => {
      let state = createGroundedState();

      // Start lock delay
      state = {
        ...state,
        physics: {
          ...state.physics,
          lockDelayResetCount: 0,
          lockDelayStartTime: createTimestamp(1000),
        },
      };

      // Advance time by exactly the lock delay duration
      const afterTimeout = reducer(state, {
        timestampMs: createTimestamp(1500), // 500ms later
        type: "Tick",
      });

      // After lock resolution pipeline, game returns to playing with no active piece
      expect(afterTimeout.status).toBe("playing");
      expect(afterTimeout.active).toBeUndefined();
    });

    it("should not lock piece before delay expires", () => {
      let state = createGroundedState();

      // Start lock delay
      state = {
        ...state,
        physics: {
          ...state.physics,
          lockDelayResetCount: 0,
          lockDelayStartTime: createTimestamp(1000),
        },
      };

      // Advance time by less than lock delay duration
      const beforeTimeout = reducer(state, {
        timestampMs: createTimestamp(1400), // 400ms later (less than 500ms)
        type: "Tick",
      });

      // Should NOT trigger lock yet
      expect(beforeTimeout.status).toBe("playing");
      expect(beforeTimeout.active).toBeDefined();
      expect(beforeTimeout.physics.lockDelayStartTime).toBe(1000);
    });
  });

  describe("Edge Cases", () => {
    it("should NOT reset lock delay on Tick actions (RULES.md compliance)", () => {
      let state = createGroundedState();

      // Start lock delay
      state = {
        ...state,
        physics: {
          ...state.physics,
          lockDelayResetCount: 5,
          lockDelayStartTime: createTimestamp(1000),
        },
      };

      // Tick should not reset the lock delay timer
      const afterTick = reducer(state, {
        timestampMs: createTimestamp(1100),
        type: "Tick",
      });

      // Should maintain the same start time and reset count
      expect(afterTick.physics.lockDelayStartTime).toBe(1000);
      expect(afterTick.physics.lockDelayResetCount).toBe(5);
    });

    it("should NOT reset lock delay on failed moves (no piece change)", () => {
      let state = createGroundedState();

      // Move piece to left wall
      state = {
        ...state,
        active: state.active
          ? {
              ...state.active,
              x: createGridCoord(0), // At left wall
            }
          : state.active,
        physics: {
          ...state.physics,
          lockDelayResetCount: 3,
          lockDelayStartTime: createTimestamp(1000),
        },
      };

      // Try to move left (should fail - already at wall)
      const afterFailedMove = reducer(state, {
        dir: -1,
        optimistic: false,
        timestampMs: createTimestamp(1200),
        type: "TapMove",
      });

      // Should NOT reset lock delay because piece didn't actually move
      expect(afterFailedMove.physics.lockDelayStartTime).toBe(1000);
      expect(afterFailedMove.physics.lockDelayResetCount).toBe(3);
      expect(afterFailedMove.active?.x).toBe(0); // Piece didn't move
    });

    it("should NOT reset lock delay on soft drop when piece doesn't move down", () => {
      let state = createGroundedState();

      // Piece is already at bottom - can't move down further
      state = {
        ...state,
        physics: {
          ...state.physics,
          lockDelayResetCount: 2,
          lockDelayStartTime: createTimestamp(1000),
        },
      };

      const originalY = state.active?.y;

      // Try soft drop when already grounded
      const afterSoftDrop = reducer(state, {
        on: true,
        timestampMs: createTimestamp(1300),
        type: "SoftDrop",
      });

      // Should NOT reset lock delay because piece didn't move down
      expect(afterSoftDrop.physics.lockDelayStartTime).toBe(1000);
      expect(afterSoftDrop.physics.lockDelayResetCount).toBe(2);
      expect(afterSoftDrop.active?.y).toBe(originalY); // Piece didn't move down
    });

    it("should start lock delay on first ground contact, not on subsequent Ticks", () => {
      let state = reducer(undefined, {
        seed: createSeed("test"),
        timestampMs: createTimestamp(1000),
        timing: createTestTimingConfig({
          gravityEnabled: true,
          gravityMs: createDurationMs(100),
          lockDelayMs: createDurationMs(500),
        }),
        type: "Init",
      });

      // Spawn a piece and set up ground
      state = reducer(state, createTestSpawnAction("T"));
      const cells = createBoardCells();
      cells.set(state.board.cells);
      for (let x = 0; x < 10; x++) {
        cells[19 * 10 + x] = 1; // Fill bottom row
      }
      state = {
        ...state,
        active: state.active
          ? {
              ...state.active,
              y: createGridCoord(17), // Position piece just above ground
            }
          : state.active,
        board: { ...state.board, cells },
      };

      // First tick - gravity makes piece land, should start lock delay
      const afterFirstTick = reducer(state, {
        timestampMs: createTimestamp(1200),
        type: "Tick",
      });

      expect(afterFirstTick.physics.lockDelayStartTime).toBe(1200);
      expect(afterFirstTick.physics.lockDelayResetCount).toBe(0);

      // Second tick - should NOT reset lock delay
      const afterSecondTick = reducer(afterFirstTick, {
        timestampMs: createTimestamp(1300),
        type: "Tick",
      });

      expect(afterSecondTick.physics.lockDelayStartTime).toBe(1200); // Same time
      expect(afterSecondTick.physics.lockDelayResetCount).toBe(0); // Same count
    });

    it("should handle failed rotation without resetting lock delay", () => {
      let state = createGroundedState();

      // Set up state where rotation would fail (block all candidate kick positions)
      const blocked = createBoardCells();
      // Fill entire board as occupied
      for (let i = 0; i < blocked.length; i++) blocked[i] = 1;
      // Carve out only the current piece footprint so current position remains valid
      if (state.active) {
        // T at spawn orientation uses these relative cells
        const rel: Array<readonly [number, number]> = [
          [1, 0],
          [0, 1],
          [1, 1],
          [2, 1],
        ];
        for (const [dx, dy] of rel) {
          const x = (state.active.x as unknown as number) + dx;
          const y = (state.active.y as unknown as number) + dy;
          blocked[y * 10 + x] = 0;
        }
      }

      state = {
        ...state,
        board: { ...state.board, cells: blocked },
        physics: {
          ...state.physics,
          lockDelayResetCount: 4,
          lockDelayStartTime: createTimestamp(1000),
        },
      };

      const originalRot = state.active?.rot;

      // Try to rotate (should fail due to blocks)
      const afterFailedRotation = reducer(state, {
        dir: "CW",
        timestampMs: createTimestamp(1400),
        type: "Rotate",
      });

      // Should NOT reset lock delay because rotation failed
      expect(afterFailedRotation.physics.lockDelayStartTime).toBe(1000);
      expect(afterFailedRotation.physics.lockDelayResetCount).toBe(4);
      expect(afterFailedRotation.active?.rot).toBe(originalRot); // Rotation didn't happen
    });
  });

  describe("Integration with Game Flow", () => {
    it("should reset lock delay state when new piece spawns", () => {
      let state = createGroundedState();

      // Set up lock delay state
      state = {
        ...state,
        physics: {
          ...state.physics,
          lockDelayResetCount: 10,
          lockDelayStartTime: createTimestamp(1000),
        },
      };

      // Force lock by hard drop
      const afterHardDrop = reducer(state, {
        timestampMs: createTimestamp(1200),
        type: "HardDrop",
      });

      // This creates a pending lock, let's complete it
      let afterLock = afterHardDrop;
      if (afterLock.status === "resolvingLock") {
        afterLock = reducer(afterLock, {
          type: "CommitLock",
        });
      }

      // Spawn new piece
      const afterSpawn = reducer(afterLock, {
        piece: "L",
        timestampMs: createTimestamp(1300),
        type: "Spawn",
      });

      // Lock delay state should be reset for new piece
      expect(afterSpawn.physics.lockDelayStartTime).toBeNull();
      expect(afterSpawn.physics.lockDelayResetCount).toBe(0);
    });

    it("should reset lock delay state when piece is held", () => {
      let state = createGroundedState();

      // Set up lock delay state
      state = {
        ...state,
        physics: {
          ...state.physics,
          lockDelayResetCount: 8,
          lockDelayStartTime: createTimestamp(1000),
        },
      };

      // Hold the piece
      const afterHold = reducer(state, { type: "Hold" });

      // Lock delay state should be reset
      expect(afterHold.physics.lockDelayStartTime).toBeNull();
      expect(afterHold.physics.lockDelayResetCount).toBe(0);
    });
  });

  describe("Lock Delay State Validation", () => {
    it("should allow nonzero reset count while lock delay is inactive (airborne)", () => {
      const state = createGroundedState();

      const physicsState = {
        ...state.physics,
        lockDelayResetCount: 5, // preserved across airborne phase
        lockDelayStartTime: null,
      };

      expect(isValidLockDelayState(physicsState)).toBe(true);
    });

    it("should validate that reset count is within range when lock delay is active", () => {
      const state = createGroundedState();

      // Set up valid state: lock delay active with valid reset count
      const validPhysicsState = {
        ...state.physics,
        lockDelayResetCount: 10, // Valid: 0-15
        lockDelayStartTime: createTimestamp(1000),
      };

      expect(isValidLockDelayState(validPhysicsState)).toBe(true);
    });

    it("should detect invalid reset count above limit", () => {
      const state = createGroundedState();

      // Set up invalid state: lock delay active but reset count too high
      const invalidPhysicsState = {
        ...state.physics,
        lockDelayResetCount: 20, // Invalid: exceeds 15
        lockDelayStartTime: createTimestamp(1000),
      };

      expect(isValidLockDelayState(invalidPhysicsState)).toBe(false);
    });

    it("should validate active piece presence when required", () => {
      const state = createGroundedState();

      // State with active piece should pass validation
      expect(hasActivePiece(state)).toBe(true);

      // State without active piece should fail validation
      const stateWithoutPiece = { ...state, active: undefined };
      expect(hasActivePiece(stateWithoutPiece)).toBe(false);
    });
  });
});
