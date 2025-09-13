// Scaffold tests for @/engine/gameplay/movement.ts
// import { tryMoveLeft, tryMoveRight, tryRotateCW, tryRotateCCW, tryShiftToWall, tryHardDrop, tryHold } from "@/engine/gameplay/movement";
// import { isAtBottom } from "@/engine/core/board";

describe("@/engine/gameplay/movement — move/rotate/hold/drop", () => {
  test.todo(
    "tryMoveLeft/Right: returns moved=true and updates x by ±1 when legal; lockResetEligible computed from pre-move grounded state",
  );

  test.todo(
    "tryShiftToWall: moves to the farthest legal x in the requested direction; moved=false when already at wall",
  );

  test.todo(
    "tryRotateCW/CCW: returns moved=true when placement succeeds via SRS; exposes kickIndex (and later kickOffset)",
  );

  test.todo(
    "tryHardDrop: returns state with piece at bottom and hardDropped=true side-effect; no lock here",
  );

  test.todo(
    "tryHold: no-op if hold.usedThisTurn=true; emits swapped=false when moving current piece to empty hold; emits swapped=true when pulling from occupied hold",
  );
});
