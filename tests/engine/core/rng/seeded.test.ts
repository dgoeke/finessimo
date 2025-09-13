// Scaffold tests for @/engine/core/rng/seeded.ts
// import { createSevenBagRng } from "@/engine";

describe("@/engine/core/rng/seeded — seven-bag determinism", () => {
  test.todo(
    "createSevenBagRng('seedA'): first 7 pieces are a permutation of I,O,T,S,Z,J,L (no repeats until bag exhausted)",
  );

  test.todo(
    "Different seeds yield different first-bag permutations more often than not (non-cryptographic)",
  );

  test.todo(
    "getNextPieces(n) returns same sequence as n calls to getNextPiece()",
  );
});
