// Scaffold tests for @/engine/step/apply-commands.ts
// import { applyCommands } from "@/engine/step/apply-commands";
// Use a state with an active piece to exercise move/rotate/hold/hard-drop.

describe("@/engine/step/apply-commands — command handling", () => {
  test.todo(
    "MoveLeft: attempts left shift; on success emits MovedLeft and sets sideEffects.lockResetEligible if previously grounded",
  );

  test.todo(
    "MoveRight: same as MoveLeft but to the right; lockResetEligible reflects pre-move grounded state",
  );

  test.todo(
    "RotateCW/RotateCCW: emits Rotated with kick classification; set lockResetEligible when rotation performed while grounded",
  );

  test.todo(
    "ShiftToWallLeft/Right: piece moves to wall; emits Moved* once with fromX/toX distance; lockResetEligible if grounded before shift",
  );

  test.todo(
    "SoftDropOn/Off: emits SoftDropToggled and updates physics.softDropOn; no immediate vertical move here",
  );

  test.todo(
    "HardDrop: sets sideEffects.hardDropped=true and places piece at bottom in state (actual lock handled by AdvancePhysics/ResolveTransitions)",
  );

  test.todo(
    "Hold: when hold unused this turn, emits Held; if hold occupied, sets spawnOverride to swap in held piece; if empty, stores current piece and spawns next",
  );
});
