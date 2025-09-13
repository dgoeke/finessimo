// Scaffold tests for @/engine/commands.ts (command union & dispatch expectations)
// Commands are mapped to handlers in @/engine/step/apply-commands.ts

describe("@/engine/commands — dispatch coverage", () => {
  test.todo(
    "Each Command.kind is handled by apply-commands (MoveLeft/Right, ShiftToWall*, Rotate*, SoftDropOn/Off, HardDrop, Hold)",
  );

  test.todo(
    "ShiftToWall* is only produced by Control (ARR=0 case) but engine handler still moves piece to wall when possible",
  );
});
