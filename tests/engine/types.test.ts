// Scaffold tests for @/engine/types.ts (runtime-visible invariants)
// Type-level guarantees aren't testable at runtime, but we can assert constructor behavior and constants.

describe("@/engine/types — runtime invariants", () => {
  test.todo(
    "mkInitialState(): fills preview queue to cfg.previews and seeds rng; physics.lock.deadlineTick is null",
  );

  test.todo(
    "Constants: BOARD_WIDTH=10, VISIBLE_HEIGHT=20, VANISH_ROWS=3, TOTAL_HEIGHT=23",
  );

  test.todo(
    "GridCoord/CellValue/BoardCells behave correctly at runtime: idx()/idxSafe() mapping accounts for vanish rows (y=-3 maps to storage row 0)",
  );
});
