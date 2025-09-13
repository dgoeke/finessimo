// Scaffold tests for @/engine/events.ts (shape and invariants of DomainEvent)
// Consider adding runtime assertions while testing event payloads produced by the pipeline.

describe("@/engine/events — event payloads & invariants", () => {
  test.todo(
    "PieceSpawned: includes pieceId and tick; should appear once per spawn",
  );

  test.todo(
    "MovedLeft/Right: include fromX/toX and tick; toX-fromX === ±1 for single-step moves",
  );

  test.todo(
    "Rotated: includes dir and kick classification ('none'|'wall'|'floor'); when kickOffset is exposed, ensure 'floor' is emitted on upward offsets",
  );

  test.todo(
    "SoftDropToggled: on/off flip emits with the correct current tick; affects gravity only, not immediate vertical move",
  );

  test.todo(
    "LockStarted/LockReset: LockStarted only once per ground-touch; LockReset not emitted past cap; reasons are 'move' or 'rotate'",
  );

  test.todo(
    "Locked: includes source 'ground'|'hardDrop' and pieceId; occurs before LinesCleared and before next PieceSpawned on the same tick",
  );

  test.todo(
    "LinesCleared: rows are 0-indexed visible rows; vanish rows (-3..-1) are never included",
  );

  test.todo(
    "Held: swapped=true when swapping with an existing hold, false when moving current piece into empty hold",
  );

  test.todo(
    "TopOut: emitted when spawn placement fails due to collision in visible or vanish rows",
  );
});
