// Scaffold tests for @/engine/step/resolve-transitions.ts
// import { resolveTransitions } from "@/engine/step/resolve-transitions";

describe("@/engine/step/resolve-transitions — place/clear/spawn", () => {
  test.todo(
    "When lockNow=true: placeActivePiece() merges into board, emits Locked before any LinesCleared/PieceSpawned",
  );

  test.todo(
    "If one or more lines complete: emit LinesCleared with correct row indices and compact the board",
  );

  test.todo(
    "Spawn path: if spawnOverride is present (from Hold), that pieceId is used; otherwise pop from queue (refilling from rng as needed)",
  );

  test.todo(
    "Top-out: if new piece cannot be placed (collision even in vanish rows), emit TopOut and do not set an active piece",
  );
});
