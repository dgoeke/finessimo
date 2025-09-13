// Scaffold tests for @/engine/core/spawning.ts
// import { createActivePiece, isTopOut, spawnWithHold } from "@/engine/core/spawning";
// import { createEmptyBoard } from "@/engine/core/board";

describe("@/engine/core/spawning — piece creation & top-out", () => {
  test.todo(
    "createActivePiece(): returns branded ActivePiece at spawn orientation and top-left; coordinates branded as GridCoord",
  );

  test.todo(
    "isTopOut(): returns true when spawn piece collides in visible area; returns false when only vanish rows are occupied",
  );

  test.todo(
    "spawnWithHold(): with empty hold returns next piece; with held piece returns held piece and sets next as new hold; returns null on top-out",
  );
});
