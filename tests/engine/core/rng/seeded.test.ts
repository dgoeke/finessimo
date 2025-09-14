// Tests for @/engine/core/rng/seeded.ts
import { getNextPiece, type SevenBagRng } from "@/engine/core/rng/seeded";
import { type PieceId } from "@/engine/core/types";
import { createSevenBagRng } from "@/engine/types";

describe("@/engine/core/rng/seeded — seven-bag determinism", () => {
  test("createSevenBagRng('seedA'): first 7 pieces are a permutation of I,O,T,S,Z,J,L (no repeats until bag exhausted)", () => {
    const rng = createSevenBagRng("seedA");

    // Get the first 7 pieces (one complete bag) using functional approach
    const result = rng.getNextPieces(7);
    const firstBag = result.pieces;

    // Should have exactly 7 pieces
    expect(firstBag).toHaveLength(7);

    // Should contain each piece exactly once (no repeats)
    const allPieces: ReadonlyArray<PieceId> = [
      "I",
      "O",
      "T",
      "S",
      "Z",
      "J",
      "L",
    ] as const;

    // Count occurrences using functional reduce with proper type safety
    const pieceCounts = firstBag.reduce<Partial<Record<PieceId, number>>>(
      (acc, piece) => ({ ...acc, [piece]: (acc[piece] ?? 0) + 1 }),
      {},
    );

    // Each piece should appear exactly once
    allPieces.forEach((piece) => {
      expect(pieceCounts[piece]).toBe(1);
    });

    // Should contain all 7 different pieces
    expect(Object.keys(pieceCounts)).toHaveLength(7);
  });

  test("Different seeds yield different first-bag permutations more often than not (non-cryptographic)", () => {
    // Generate multiple seeds and their corresponding first bags
    const numSeeds = 20;
    const seeds: ReadonlyArray<string> = Array.from(
      { length: numSeeds },
      (_, i) => `seed${String(i)}`,
    );

    // Get first bag for each seed using functional approach
    const firstBags: ReadonlyArray<ReadonlyArray<PieceId>> = seeds.map(
      (seed) => {
        const rng = createSevenBagRng(seed);
        const result = rng.getNextPieces(7);
        return result.pieces;
      },
    );

    // Convert bags to strings for easy comparison
    const bagStrings: ReadonlyArray<string> = firstBags.map((bag) =>
      bag.join(""),
    );

    // Count unique permutations using functional approach
    const uniqueBagStrings = new Set(bagStrings);
    const uniqueCount = uniqueBagStrings.size;

    // Should have at least 80% different permutations (16 out of 20)
    const threshold = Math.floor(numSeeds * 0.8);
    expect(uniqueCount).toBeGreaterThanOrEqual(threshold);

    // Verify each bag is still a valid 7-bag (contains each piece exactly once)
    firstBags.forEach((bag) => {
      expect(bag).toHaveLength(7);

      const allPieces: ReadonlyArray<PieceId> = [
        "I",
        "O",
        "T",
        "S",
        "Z",
        "J",
        "L",
      ] as const;

      const pieceCounts = bag.reduce<Partial<Record<PieceId, number>>>(
        (acc, piece) => ({ ...acc, [piece]: (acc[piece] ?? 0) + 1 }),
        {},
      );

      allPieces.forEach((piece) => {
        expect(pieceCounts[piece]).toBe(1);
      });
    });
  });

  test("getNextPieces(n) returns same sequence as n calls to getNextPiece()", () => {
    const seed = "testSeed";
    const piecesToGenerate = 10;

    // Method 1: Get all pieces at once using getNextPieces
    const rng1 = createSevenBagRng(seed);
    const result1 = rng1.getNextPieces(piecesToGenerate);
    const piecesFromBatch: ReadonlyArray<PieceId> = result1.pieces;

    // Method 2: Get pieces one by one using getNextPiece
    let currentRng = createSevenBagRng(seed);
    const piecesFromIndividual: Array<PieceId> = [];

    for (let i = 0; i < piecesToGenerate; i++) {
      const result = currentRng.getNextPiece();
      piecesFromIndividual.push(result.piece);
      currentRng = result.newRng;
    }

    // Convert to readonly for type safety
    const readonlyPiecesFromIndividual: ReadonlyArray<PieceId> =
      piecesFromIndividual;

    // Both methods should produce identical sequences
    expect(piecesFromBatch).toHaveLength(piecesToGenerate);
    expect(readonlyPiecesFromIndividual).toHaveLength(piecesToGenerate);
    expect(piecesFromBatch).toEqual(readonlyPiecesFromIndividual);

    // Verify each piece in the sequence is valid
    const allValidPieces: ReadonlyArray<PieceId> = [
      "I",
      "O",
      "T",
      "S",
      "Z",
      "J",
      "L",
    ] as const;

    piecesFromBatch.forEach((piece) => {
      expect(allValidPieces).toContain(piece);
    });

    readonlyPiecesFromIndividual.forEach((piece) => {
      expect(allValidPieces).toContain(piece);
    });
  });

  test("getState() method returns internal state for compatibility", () => {
    const rng = createSevenBagRng("testSeed");

    // Test the getState() method (covers line 145 in seeded.ts)
    const rngImpl = rng as unknown as { getState(): SevenBagRng }; // Cast to access internal methods
    expect(typeof rngImpl.getState).toBe("function");

    const state = rngImpl.getState();
    expect(state).toHaveProperty("seed");
    expect(state).toHaveProperty("currentBag");
    expect(state).toHaveProperty("bagIndex");
    expect(state).toHaveProperty("internalSeed");
    expect(state.seed).toBe("testSeed");
  });

  test("Error handling: detects corrupted bag state", () => {
    // Create a corrupted RNG state with sparse array (hole at index 0) to trigger error (covers line 82)
    const sparseBag: Array<PieceId> = [];
    sparseBag[1] = "I"; // Index 0 is undefined, but length is 2
    sparseBag.length = 2;

    const corruptedState: SevenBagRng = {
      bagIndex: 0, // Pointing to undefined slot
      currentBag: sparseBag, // Sparse bag with undefined at index 0
      internalSeed: 12345,
      seed: "test",
    };

    // This should trigger the defensive error check in getNextPiece
    expect(() => getNextPiece(corruptedState)).toThrow(
      "Bag is empty or corrupted",
    );
  });
});
