// Tests for @/engine/types.ts (runtime-visible invariants)
// Type-level guarantees aren't testable at runtime, but we can assert constructor behavior and constants.

import {
  BOARD_WIDTH,
  VISIBLE_HEIGHT,
  VANISH_ROWS,
  TOTAL_HEIGHT,
  idx,
  idxSafe,
  createGridCoord,
  createCellValue,
  createBoardCells,
  type Board,
  type PieceId,
} from "@/engine/core/types";
import {
  mkInitialState,
  type EngineConfig,
  type Tick,
  type Q16_16,
  type TickDelta,
} from "@/engine/types";

// Test helper functions
function createTestConfig(): EngineConfig {
  return {
    gravity32: 0.5 as Q16_16,
    height: 20,
    lockDelayTicks: 30 as TickDelta,
    maxLockResets: 15,
    previewCount: 7,
    rngSeed: 12345,
    softDrop32: 2.0 as Q16_16,
    width: 10,
  } as const;
}

function assertValidPieceId(piece: unknown): asserts piece is PieceId {
  if (
    typeof piece !== "string" ||
    !(["I", "O", "T", "S", "Z", "J", "L"] as const).includes(piece as PieceId)
  ) {
    throw new Error(`Not a valid PieceId: ${String(piece)}`);
  }
}

describe("@/engine/types — runtime invariants", () => {
  test("mkInitialState(): fills preview queue to cfg.previews and seeds rng; physics.lock.deadlineTick is null", () => {
    const cfg = createTestConfig();
    const startTick = 100 as Tick;

    const state = mkInitialState(cfg, startTick);

    // Queue should be filled to preview count
    expect(state.queue).toHaveLength(cfg.previewCount);

    // All pieces in queue should be valid piece IDs
    state.queue.forEach((piece) => {
      assertValidPieceId(piece);
    });

    // RNG should be seeded - verify it's not the same as a different seed
    const differentSeedConfig = { ...cfg, rngSeed: 54321 };
    const differentSeedState = mkInitialState(differentSeedConfig, startTick);

    // Different seeds should usually produce different first pieces
    // (Not guaranteed but very likely with a good RNG)
    const sameFirstPieces = state.queue.every(
      (piece, idx) =>
        idx < differentSeedState.queue.length &&
        piece === differentSeedState.queue[idx],
    );
    expect(sameFirstPieces).toBe(false);

    // Physics lock deadline should be null initially
    expect(state.physics.lock.deadlineTick).toBeNull();

    // Verify other initial state properties
    expect(state.cfg).toBe(cfg);
    expect(state.tick).toBe(startTick);
    expect(state.piece).toBeNull();
    expect(state.hold.piece).toBeNull();
    expect(state.hold.usedThisTurn).toBe(false);
    expect(state.physics.gravityAccum32).toBe(0);
    expect(state.physics.lock.resetCount).toBe(0);
    expect(state.physics.softDropOn).toBe(false);

    // Board should have correct dimensions
    expect(state.board.width).toBe(10);
    expect(state.board.height).toBe(20);
    expect(state.board.vanishRows).toBe(3);
    expect(state.board.totalHeight).toBe(23);
    expect(state.board.cells).toHaveLength(230); // 23 * 10
  });

  test("Constants: BOARD_WIDTH=10, VISIBLE_HEIGHT=20, VANISH_ROWS=3, TOTAL_HEIGHT=23", () => {
    expect(BOARD_WIDTH).toBe(10);
    expect(VISIBLE_HEIGHT).toBe(20);
    expect(VANISH_ROWS).toBe(3);
    expect(TOTAL_HEIGHT).toBe(23);
  });

  test("GridCoord/CellValue/BoardCells behave correctly at runtime: idx()/idxSafe() mapping accounts for vanish rows (y=-3 maps to storage row 0)", () => {
    const board: Board = {
      cells: createBoardCells(),
      height: 20,
      totalHeight: 23,
      vanishRows: 3,
      width: 10,
    };

    // Test GridCoord creation and validation
    const validCoord = createGridCoord(5);
    expect(validCoord).toBe(5);
    expect(() => createGridCoord(5.5)).toThrow("GridCoord must be an integer");

    // Test CellValue creation and validation
    const validCell = createCellValue(3);
    expect(validCell).toBe(3);
    expect(() => createCellValue(-1)).toThrow(
      "CellValue must be an integer from 0 to 8",
    );
    expect(() => createCellValue(9)).toThrow(
      "CellValue must be an integer from 0 to 8",
    );
    expect(() => createCellValue(2.5)).toThrow(
      "CellValue must be an integer from 0 to 8",
    );

    // Test BoardCells creation
    const cells = createBoardCells();
    expect(cells).toHaveLength(230); // 23 * 10
    expect(cells).toBeInstanceOf(Uint8Array);

    // Test vanish row mapping with idx()
    const x = createGridCoord(0);

    // y = -3 should map to storage row 0
    const yNeg3 = createGridCoord(-3);
    expect(idx(board, x, yNeg3)).toBe(0); // row 0 * 10 + 0 = 0

    // y = -2 should map to storage row 1
    const yNeg2 = createGridCoord(-2);
    expect(idx(board, x, yNeg2)).toBe(10); // row 1 * 10 + 0 = 10

    // y = -1 should map to storage row 2
    const yNeg1 = createGridCoord(-1);
    expect(idx(board, x, yNeg1)).toBe(20); // row 2 * 10 + 0 = 20

    // y = 0 should map to storage row 3 (first visible row)
    const y0 = createGridCoord(0);
    expect(idx(board, x, y0)).toBe(30); // row 3 * 10 + 0 = 30

    // Test with non-zero x coordinate
    const x5 = createGridCoord(5);
    expect(idx(board, x5, yNeg3)).toBe(5); // row 0 * 10 + 5 = 5
    expect(idx(board, x5, y0)).toBe(35); // row 3 * 10 + 5 = 35

    // Test idxSafe bounds checking
    const validX = createGridCoord(5);
    const validY = createGridCoord(10);
    expect(idxSafe(board, validX, validY)).toBe(idx(board, validX, validY));

    // Out of bounds should throw
    const outOfBoundsX = createGridCoord(-1);
    expect(() => idxSafe(board, outOfBoundsX, y0)).toThrow(
      "idxSafe: out-of-bounds",
    );

    const outOfBoundsXHigh = createGridCoord(10);
    expect(() => idxSafe(board, outOfBoundsXHigh, y0)).toThrow(
      "idxSafe: out-of-bounds",
    );

    const outOfBoundsYLow = createGridCoord(-4);
    expect(() => idxSafe(board, validX, outOfBoundsYLow)).toThrow(
      "idxSafe: out-of-bounds",
    );

    const outOfBoundsYHigh = createGridCoord(20);
    expect(() => idxSafe(board, validX, outOfBoundsYHigh)).toThrow(
      "idxSafe: out-of-bounds",
    );
  });
});
