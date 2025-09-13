// Scaffold tests for @/engine/core/srs.ts
// import { tryRotateWithKickInfo, getNextRotation } from "@/engine/core/srs";
// import { createActivePiece } from "@/engine/core/spawning";
// import { createEmptyBoard } from "@/engine/core/board";

describe("@/engine/core/srs — wall/floor kicks", () => {
  test.todo("Rotating JLSTZ at an open center uses kick index 0 (no kick)");

  test.todo(
    "Rotating against a wall uses one of indices 1..4 (wall kicks); ensure resulting position is placeable",
  );

  test.todo(
    "I-piece uses I-specific kick table (catch cases where JLSTZ table was applied incorrectly)",
  );

  test.todo(
    "When kickOffset is exposed by tryRotateWithKickInfo, classify 'floor' kicks when Y offset is negative (upward)",
  );

  test.todo(
    "Two sequential 90° rotations simulate a 180° turn; no direct opposite-rotation transition is allowed",
  );
});
