// Tests for @/engine/physics/gravity.ts — Q16.16 fixed-point gravity system
import { createEmptyBoard } from "@/engine/core/board";
import { createGridCoord } from "@/engine/core/types";
import { gravityStep } from "@/engine/physics/gravity";
import { mkInitialState, type GameState, type Tick } from "@/engine/types";
import { toQ, floorQ } from "@/engine/utils/fixedpoint";

import {
  createTestConfig,
  createTestGameState,
  createTestPiece,
  setupBoardWithFloor,
  setBoardCell,
} from "../../test-helpers";

describe("@/engine/physics/gravity — fixed-point descent", () => {
  test("With gravity32 = 0.5 (Q16.16), two ticks should move the piece down by one cell (absent collision)", () => {
    // Create game state with gravity32 = 0.5 and piece at (4, 0)
    const piece = createTestPiece("T", 4, 0);
    const state = createTestGameState(
      { piece },
      toQ(0.5), // 0.5 cells per tick
    );

    // After first tick: accumulator = 0.5, no movement (< 1.0)
    const result1 = gravityStep(state);
    const state1 = result1.state;

    expect(state1.piece).not.toBeNull();
    expect(state1.piece?.y).toBe(createGridCoord(0)); // Still at y=0
    expect(state1.physics.gravityAccum32).toBe(toQ(0.5)); // Fractional remainder

    // After second tick: accumulator = 0.5 + 0.5 = 1.0, piece moves down 1 cell
    const result2 = gravityStep(state1);
    const state2 = result2.state;

    expect(state2.piece).not.toBeNull();
    expect(state2.piece?.y).toBe(createGridCoord(1)); // Moved to y=1
    expect(state2.physics.gravityAccum32).toBe(toQ(0.0)); // Accumulator reset to 0
    expect(state2.piece?.x).toBe(createGridCoord(4)); // X position unchanged
    expect(state2.piece?.id).toBe("T"); // Piece type unchanged
    expect(state2.piece?.rot).toBe("spawn"); // Rotation unchanged
  });

  test("Accumulation carries over fractional remainder across ticks (fracQ)", () => {
    // Use gravity32 = 0.25 (1/4), which is exactly representable and requires 4 ticks to accumulate to 1.0
    const piece = createTestPiece("I", 4, 0);
    const state = createTestGameState(
      { piece },
      toQ(0.25), // 0.25 cells per tick (exactly representable)
    );

    // Tick 1: 0 + 0.25 = 0.25 (no movement)
    const result1 = gravityStep(state);
    const state1 = result1.state;
    expect(state1.piece?.y).toBe(createGridCoord(0));
    expect(floorQ(state1.physics.gravityAccum32)).toBe(0);
    expect(state1.physics.gravityAccum32).toBe(toQ(0.25));

    // Tick 2: 0.25 + 0.25 = 0.5 (no movement)
    const result2 = gravityStep(state1);
    const state2 = result2.state;
    expect(state2.piece?.y).toBe(createGridCoord(0));
    expect(floorQ(state2.physics.gravityAccum32)).toBe(0);
    expect(state2.physics.gravityAccum32).toBe(toQ(0.5));

    // Tick 3: 0.5 + 0.25 = 0.75 (no movement)
    const result3 = gravityStep(state2);
    const state3 = result3.state;
    expect(state3.piece?.y).toBe(createGridCoord(0));
    expect(floorQ(state3.physics.gravityAccum32)).toBe(0);
    expect(state3.physics.gravityAccum32).toBe(toQ(0.75));

    // Tick 4: 0.75 + 0.25 = 1.0 (move down 1, remainder 0.0)
    const result4 = gravityStep(state3);
    const state4 = result4.state;
    expect(state4.piece?.y).toBe(createGridCoord(1)); // Moved down 1 cell
    expect(floorQ(state4.physics.gravityAccum32)).toBe(0);
    expect(state4.physics.gravityAccum32).toBe(toQ(0.0)); // No remainder

    // Tick 5: 0.0 + 0.25 = 0.25 (no movement, continue accumulating)
    const result5 = gravityStep(state4);
    const state5 = result5.state;
    expect(state5.piece?.y).toBe(createGridCoord(1));
    expect(state5.physics.gravityAccum32).toBe(toQ(0.25));
  });

  test("Collision halts descent exactly at floor/stack; no overshoot", () => {
    // Create board with floor at y=18 (one row before bottom)
    const boardWithFloor = setupBoardWithFloor(18, 1);
    const piece = createTestPiece("O", 4, 15); // O piece at y=15, will hit floor at y=16 (O piece is 2 cells tall)

    // Use high gravity to test multiple cells movement at once
    const state = createTestGameState(
      {
        board: boardWithFloor,
        piece,
      },
      toQ(5.0), // 5 cells per tick - would overshoot without collision detection
    );

    const result = gravityStep(state);
    const finalState = result.state;

    expect(finalState.piece).not.toBeNull();
    // O piece should stop at y=16 (can't go to y=17 because that would overlap floor at y=18)
    expect(finalState.piece?.y).toBe(createGridCoord(16));
    expect(finalState.piece?.x).toBe(createGridCoord(4)); // X unchanged
    expect(finalState.piece?.id).toBe("O"); // Piece type unchanged

    // Accumulator should be reset since some movement occurred
    expect(finalState.physics.gravityAccum32).toBe(toQ(0.0));

    // Test that piece cannot move further down
    const result2 = gravityStep(finalState);
    const finalState2 = result2.state;
    expect(finalState2.piece?.y).toBe(createGridCoord(16)); // No further movement
  });

  test("Soft drop behavior when softDropOn = true", () => {
    const piece = createTestPiece("T", 4, 0);
    // Create state with soft drop rate
    const cfg = createTestConfig({ gravity32: toQ(0.5), softDrop32: toQ(2.0) }); // gravity 0.5, soft drop 2.0
    const baseState = mkInitialState(cfg, 0 as Tick);
    const state: GameState = {
      ...baseState,
      physics: {
        gravityAccum32: toQ(0.0),
        lock: { deadlineTick: null, resetCount: 0 },
        softDropOn: true, // Enable soft drop
      },
      piece,
    };

    // Should use soft drop rate (2.0) instead of normal gravity (0.5)
    const result = gravityStep(state);
    const finalState = result.state;

    expect(finalState.piece).not.toBeNull();
    expect(finalState.piece?.y).toBe(createGridCoord(2)); // Moved down 2 cells (floor(2.0) = 2)
    expect(finalState.physics.gravityAccum32).toBe(toQ(0.0)); // No remainder
  });

  test("No movement when piece is null", () => {
    const state = createTestGameState(
      { piece: null }, // No active piece
      toQ(1.0),
    );

    const result = gravityStep(state);
    const finalState = result.state;

    expect(finalState.piece).toBeNull();
    expect(finalState.physics.gravityAccum32).toBe(toQ(0.0)); // Accumulator unchanged
  });

  test("Zero gravity produces no movement", () => {
    const piece = createTestPiece("T", 4, 5);
    const state = createTestGameState(
      { piece },
      toQ(0.0), // Zero gravity
    );

    // Run multiple ticks with zero gravity
    let currentState = state;
    for (let i = 0; i < 10; i++) {
      const result = gravityStep(currentState);
      currentState = result.state;
    }

    expect(currentState.piece).not.toBeNull();
    expect(currentState.piece?.y).toBe(createGridCoord(5)); // No movement
    expect(currentState.physics.gravityAccum32).toBe(toQ(0.0)); // No accumulation
  });

  test("High gravity moves piece multiple cells in single tick", () => {
    const piece = createTestPiece("I", 4, 0);
    const state = createTestGameState(
      { piece },
      toQ(3.75), // 3.75 cells per tick (exactly representable as 3 + 3/4)
    );

    const result = gravityStep(state);
    const finalState = result.state;

    expect(finalState.piece).not.toBeNull();
    expect(finalState.piece?.y).toBe(createGridCoord(3)); // Moved down 3 cells (floor(3.75) = 3)
    expect(finalState.physics.gravityAccum32).toBe(toQ(0.75)); // Remainder 0.75
  });

  test("Collision detection works with stacked blocks", () => {
    // Create board with a single block at (4, 16)
    let board = createEmptyBoard();
    board = setBoardCell(board, 4, 16, 1); // Block at center

    // T piece at (4, 10) - its cells in spawn position are:
    // (5, 10), (4, 11), (5, 11), (6, 11)
    // The lowest cell is at y=11 (relative y=1)
    const piece = createTestPiece("T", 4, 10);
    const state = createTestGameState(
      {
        board,
        piece,
      },
      toQ(10.0), // High gravity
    );

    const result = gravityStep(state);
    const finalState = result.state;

    expect(finalState.piece).not.toBeNull();
    // T piece should stop at y=14 so its center cell at (4,15) doesn't collide with block at (4,16)
    expect(finalState.piece?.y).toBe(createGridCoord(14));
  });

  test("Fractional accumulation is deterministic across multiple runs", () => {
    const piece = createTestPiece("O", 4, 0);
    const gravity = toQ(0.375); // Exactly representable (3/8), but deterministic in Q16.16

    // Run the same sequence twice
    const runSequence = (initialState: GameState, ticks: number): GameState => {
      let state = initialState;
      for (let i = 0; i < ticks; i++) {
        const result = gravityStep(state);
        state = result.state;
      }
      return state;
    };

    const state1 = createTestGameState({ piece }, gravity);
    const state2 = createTestGameState({ piece }, gravity);

    const final1 = runSequence(state1, 10);
    const final2 = runSequence(state2, 10);

    // Both runs should produce identical results
    expect(final1.piece?.y).toBe(final2.piece?.y);
    expect(final1.physics.gravityAccum32).toBe(final2.physics.gravityAccum32);
  });

  test("Edge case: piece at bottom of board cannot move further", () => {
    // Place piece at the very bottom where it cannot move
    const piece = createTestPiece("O", 4, 18); // O piece at bottom (y=18, extends to y=19)
    const state = createTestGameState({ piece }, toQ(1.0));

    const result = gravityStep(state);
    const finalState = result.state;

    expect(finalState.piece).not.toBeNull();
    expect(finalState.piece?.y).toBe(createGridCoord(18)); // No movement
    // Accumulator should remain 0 since no movement was possible
    expect(finalState.physics.gravityAccum32).toBe(toQ(0.0));
  });

  test("Soft drop with undefined softDrop32 falls back to normal gravity", () => {
    const piece = createTestPiece("T", 4, 0);
    // Create state with no soft drop rate (undefined)
    const cfg = createTestConfig({ gravity32: toQ(0.5) });
    // Create a modified config without softDrop32 to test fallback by destructuring
    // Note: we extract softDrop32 to remove it, creating a config that doesn't have this property
    const cfgWithoutSoftDrop = (({ softDrop32: _softDrop32, ...rest }) => rest)(
      cfg,
    );
    const baseState = mkInitialState(cfgWithoutSoftDrop, 0 as Tick);
    const state: GameState = {
      ...baseState,
      physics: {
        gravityAccum32: toQ(0.0),
        lock: { deadlineTick: null, resetCount: 0 },
        softDropOn: true, // Soft drop enabled but no rate defined
      },
      piece,
    };

    // Should fall back to normal gravity when soft drop rate is undefined
    const result1 = gravityStep(state);
    const result2 = gravityStep(result1.state);

    expect(result2.state.piece).not.toBeNull();
    expect(result2.state.piece?.y).toBe(createGridCoord(1)); // One cell after two ticks (0.5 + 0.5 = 1.0)
  });
});
