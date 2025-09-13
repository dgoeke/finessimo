// Scaffold tests for @/engine/core/board.ts
// import { createEmptyBoard, idx, canPlacePiece, tryMove, moveToWall, isAtBottom, dropToBottom, lockPiece, getCompletedLines, clearLines } from "@/engine/core/board";
// import { createActivePiece } from "@/engine/core/spawning";
// import { gridCoordAsNumber, createGridCoord } from "@/engine/core/types";

describe("@/engine/core/board — geometry & line clear", () => {
  test.todo(
    "idx(): y=-3 maps to storage row 0; y=0 maps to storage row vanishRows; dimensions totalHeight=23, width=10",
  );

  test.todo(
    "canPlacePiece(): false when any cell is out of bounds or collides with non-zero cell; vanish rows count as collidable",
  );

  test.todo(
    "tryMove(): moves piece by (dx,dy) only if all target cells are free; otherwise returns original",
  );

  test.todo(
    "moveToWall(): slides piece left/right until next move would collide; returns final x",
  );

  test.todo("isAtBottom(): true when cannot move down by one; false otherwise");

  test.todo("dropToBottom(): returns piece at the lowest legal y");

  test.todo("lockPiece(): merges active piece cells into board");

  test.todo(
    "getCompletedLines(): returns visible row indices fully filled (0..19), ignores vanish rows",
  );

  test.todo(
    "clearLines(): compacts board, removes given rows, preserves vanish rows as-is",
  );
});
