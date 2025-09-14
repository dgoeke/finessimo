// Tests for @/engine/core/rng/sequence.ts
import { SequenceRng } from "@/engine/core/rng/sequence";
import { type PieceId } from "@/engine/core/types";

describe("@/engine/core/rng/sequence — cycling sequence", () => {
  test("Throws on empty sequence", () => {
    const emptySequence: Array<PieceId> = [];

    expect(() => new SequenceRng(emptySequence)).toThrow(
      "Sequence must not be empty",
    );
  });

  test("Yields the sequence in order, then wraps around", () => {
    const sequence: Array<PieceId> = ["I", "O", "T"];
    let rng = new SequenceRng(sequence);

    // Get 6 pieces to verify wrapping (2 full cycles of 3-piece sequence)
    const expectedPieces: Array<PieceId> = ["I", "O", "T", "I", "O", "T"];
    const actualPieces: Array<PieceId> = [];

    // Functional approach: call getNextPiece() 6 times and collect results
    for (let i = 0; i < 6; i++) {
      const result = rng.getNextPiece();
      actualPieces.push(result.piece);
      rng = result.newRng as SequenceRng; // Advance to next RNG state
    }

    expect(actualPieces).toEqual(expectedPieces);
  });

  test("getNextPieces(n) returns n consecutive items with wrap-around at sequence length", () => {
    const sequence: Array<PieceId> = ["S", "Z"];
    const rng = new SequenceRng(sequence);

    // Get 5 pieces from a 2-piece sequence to verify wrap-around
    const result = rng.getNextPieces(5);
    const expectedPieces: Array<PieceId> = ["S", "Z", "S", "Z", "S"];

    expect(result.pieces).toEqual(expectedPieces);

    // Verify the returned RNG state is correctly advanced
    // After getting 5 pieces from ["S", "Z"], we should be at index 1 (Z position)
    const nextResult = result.newRng.getNextPiece();
    expect(nextResult.piece).toBe("Z");
  });

  test("Error handling: detects corrupted internal state", () => {
    // Create a SequenceRng with a valid sequence but invalid index to trigger error paths
    const sequence: Array<PieceId> = ["I", "O"];

    // Create RNG with an invalid internal index to trigger error checking
    const corruptedRng = new SequenceRng(sequence, 999); // Index out of bounds

    // Test getNextPiece error path (covers line 19 in sequence.ts)
    expect(() => corruptedRng.getNextPiece()).toThrow(
      "Sequence index out of bounds",
    );

    // Test getNextPieces error path (covers line 32 in sequence.ts)
    expect(() => corruptedRng.getNextPieces(1)).toThrow(
      "Sequence index out of bounds",
    );
  });
});
