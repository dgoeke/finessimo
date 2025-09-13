// Scaffold tests for @/engine/index.ts
// import { init, step, stepN } from "@/engine";
// import { createSevenBagRng } from "@/engine";
// import { type EngineConfig } from "@/engine";
// import { asTickDelta } from "@/engine/utils/tick";

describe("@/engine/index — step pipeline", () => {
  test.todo(
    "init(): returns initial state at the given startTick and zero events",
  );

  test.todo(
    "step(): with no commands, first call should spawn a piece (emits DomainEvent: PieceSpawned)",
  );

  test.todo("step(): increments state.tick by +1 on each call");

  test.todo(
    "step(): event order is applyCommands → advancePhysics → resolveTransitions (verify by scenario producing multiple events)",
  );

  test.todo(
    "step(): hard drop emits Locked{source:'hardDrop'} on the same tick, then either LinesCleared and/or PieceSpawned",
  );

  test.todo(
    "stepN(): deterministic sequence for a fixed seed and fixed per-tick command buckets (replay the same inputs twice and compare events)",
  );
});
