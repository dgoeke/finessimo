// Scaffold tests for @/engine/physics/gravity.ts
// import { gravityStep } from "@/engine/physics/gravity";

describe("@/engine/physics/gravity — fixed-point descent", () => {
  test.todo(
    "With gravity32 = 0.5 (Q16.16), two ticks should move the piece down by one cell (absent collision)",
  );

  test.todo(
    "Accumulation carries over fractional remainder across ticks (fracQ)",
  );

  test.todo("Collision halts descent exactly at floor/stack; no overshoot");
});
