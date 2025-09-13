// Scaffold tests for @/engine/gameplay/spawn.ts
// import { placeActivePiece, spawnPiece } from "@/engine/gameplay/spawn";

describe("@/engine/gameplay/spawn — locking & spawning", () => {
  test.todo(
    "placeActivePiece(): merges current piece into the board and returns pieceId; returns null pieceId if no active piece",
  );

  test.todo(
    "spawnPiece(): pulls next from queue (refilling via rng) unless spawnOverride provided; resets physics (gravityAccum32=0, lock.resetCount=0, deadlineTick=null, hold.usedThisTurn=false)",
  );

  test.todo(
    "spawnPiece(): top-out when placement fails; PieceSpawned not emitted; subsequent steps should not try to spawn again unless game resets",
  );
});
