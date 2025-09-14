// Scaffold tests for @/engine/core/rng/one-piece.ts
import { OnePieceRng } from "@/engine/core/rng/one-piece";
import { type PieceId } from "@/engine/core/types";

describe("@/engine/core/rng/one-piece — constant piece", () => {
  test("getNextPiece() always returns the configured piece and same RNG instance", () => {
    const configuredPiece: PieceId = "T";
    const rng = new OnePieceRng(configuredPiece);

    // Call getNextPiece() multiple times to verify consistency
    const results = Array.from({ length: 5 }, () => rng.getNextPiece());

    // Verify we got the expected number of results
    expect(results).toHaveLength(5);

    // Verify all results return the same configured piece
    results.forEach((result) => {
      expect(result.piece).toBe(configuredPiece);
      // Verify newRng is the same instance (reference equality)
      // OnePieceRng returns `this`, so it should be the same instance
      expect(result.newRng).toBe(rng);
    });
  });

  test("getNextPieces(k) returns k copies of the configured piece", () => {
    const configuredPiece: PieceId = "L";
    const rng = new OnePieceRng(configuredPiece);
    const count = 7;

    const result = rng.getNextPieces(count);

    // Verify the returned array has exactly k elements
    expect(result.pieces).toHaveLength(count);

    // Verify all pieces are the configured piece
    result.pieces.forEach((piece) => {
      expect(piece).toBe(configuredPiece);
    });

    // Verify the array contains exactly k copies using functional approach
    const expectedArray: ReadonlyArray<PieceId> = Array(count).fill(
      configuredPiece,
    ) as ReadonlyArray<PieceId>;
    expect(result.pieces).toEqual(expectedArray);

    // Verify newRng is the same instance (reference equality)
    expect(result.newRng).toBe(rng);

    // Test edge cases
    // Test with 0 pieces
    const emptyResult = rng.getNextPieces(0);
    expect(emptyResult.pieces).toHaveLength(0);
    expect(emptyResult.pieces).toEqual([]);
    expect(emptyResult.newRng).toBe(rng);

    // Test with 1 piece
    const singleResult = rng.getNextPieces(1);
    expect(singleResult.pieces).toHaveLength(1);
    expect(singleResult.pieces[0]).toBe(configuredPiece);
    expect(singleResult.newRng).toBe(rng);
  });
});
