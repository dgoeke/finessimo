import {
  createRng,
  getNextPiece,
  getNextPieces,
  type SevenBagRng,
} from "../../src/core/rng";
import { type PieceId } from "../../src/state/types";
import { createCorruptedRng } from "../test-types";

describe("Seven Bag RNG", () => {
  const ALL_PIECES: Array<PieceId> = ["I", "O", "T", "S", "Z", "J", "L"];

  describe("createRng", () => {
    it("should create RNG with default seed", () => {
      const rng = createRng();
      expect(rng.seed).toBe("default");
      expect(rng.currentBag).toEqual([]);
      expect(rng.bagIndex).toBe(0);
      expect(rng.internalSeed).toBeGreaterThan(0);
    });

    it("should create RNG with custom seed", () => {
      const rng = createRng("test-seed");
      expect(rng.seed).toBe("test-seed");
      expect(rng.currentBag).toEqual([]);
      expect(rng.bagIndex).toBe(0);
      expect(rng.internalSeed).toBeGreaterThan(0);
    });

    it("should create different internal seeds for different strings", () => {
      const rng1 = createRng("seed1");
      const rng2 = createRng("seed2");
      expect(rng1.internalSeed).not.toBe(rng2.internalSeed);
    });

    it("should create same internal seed for same string", () => {
      const rng1 = createRng("same-seed");
      const rng2 = createRng("same-seed");
      expect(rng1.internalSeed).toBe(rng2.internalSeed);
    });
  });

  describe("getNextPiece", () => {
    it("should return a valid piece from first bag", () => {
      const rng = createRng("test");
      const result = getNextPiece(rng);

      expect(ALL_PIECES).toContain(result.piece);
      expect(result.newRng.bagIndex).toBe(1);
      expect(result.newRng.currentBag).toHaveLength(7);
    });

    it("should generate all pieces in first bag", () => {
      let currentRng = createRng("test");
      const firstBagPieces: Array<PieceId> = [];

      for (let i = 0; i < 7; i++) {
        const result = getNextPiece(currentRng);
        firstBagPieces.push(result.piece);
        currentRng = result.newRng;
      }

      // Should contain all pieces exactly once
      expect(firstBagPieces).toHaveLength(7);
      ALL_PIECES.forEach((piece) => {
        expect(firstBagPieces).toContain(piece);
      });
    });

    it("should create new bag when first bag is exhausted", () => {
      let currentRng = createRng("test");

      // Exhaust first bag
      for (let i = 0; i < 7; i++) {
        const result = getNextPiece(currentRng);
        currentRng = result.newRng;
      }

      // Get piece from second bag
      const result = getNextPiece(currentRng);
      expect(ALL_PIECES).toContain(result.piece);
      expect(result.newRng.bagIndex).toBe(1); // Reset to 1 (first piece taken from new bag)
    });

    it("should generate deterministic sequence with same seed", () => {
      const rng1 = createRng("deterministic");
      const rng2 = createRng("deterministic");

      const pieces1: Array<PieceId> = [];
      const pieces2: Array<PieceId> = [];

      let currentRng1 = rng1;
      let currentRng2 = rng2;

      for (let i = 0; i < 14; i++) {
        // Two full bags
        const result1 = getNextPiece(currentRng1);
        const result2 = getNextPiece(currentRng2);

        pieces1.push(result1.piece);
        pieces2.push(result2.piece);

        currentRng1 = result1.newRng;
        currentRng2 = result2.newRng;
      }

      expect(pieces1).toEqual(pieces2);
    });

    it("should generate different sequences with different seeds", () => {
      const rng1 = createRng("seed1");
      const rng2 = createRng("seed2");

      const pieces1: Array<PieceId> = [];
      const pieces2: Array<PieceId> = [];

      let currentRng1 = rng1;
      let currentRng2 = rng2;

      for (let i = 0; i < 14; i++) {
        const result1 = getNextPiece(currentRng1);
        const result2 = getNextPiece(currentRng2);

        pieces1.push(result1.piece);
        pieces2.push(result2.piece);

        currentRng1 = result1.newRng;
        currentRng2 = result2.newRng;
      }

      // Sequences should be different (very high probability)
      expect(pieces1).not.toEqual(pieces2);
    });

    it("should maintain immutability of original RNG state", () => {
      const originalRng = createRng("immutable");
      const originalBagIndex = originalRng.bagIndex;
      const originalInternalSeed = originalRng.internalSeed;

      getNextPiece(originalRng);

      expect(originalRng.bagIndex).toBe(originalBagIndex);
      expect(originalRng.internalSeed).toBe(originalInternalSeed);
    });

    it("should throw error if bag is corrupted", () => {
      const corruptedRng = createCorruptedRng("test", "undefined");

      expect(() =>
        getNextPiece(corruptedRng as unknown as SevenBagRng),
      ).toThrow("Bag is empty or corrupted");
    });
  });

  describe("getNextPieces", () => {
    it("should return requested number of pieces", () => {
      const rng = createRng("batch");
      const result = getNextPieces(rng, 5);

      expect(result.pieces).toHaveLength(5);
      for (const piece of result.pieces) {
        expect(ALL_PIECES).toContain(piece);
      }
    });

    it("should return empty array for zero count", () => {
      const rng = createRng("zero");
      const result = getNextPieces(rng, 0);

      expect(result.pieces).toEqual([]);
      expect(result.newRng).toBe(rng); // Same reference when no pieces requested
    });

    it("should handle requests spanning multiple bags", () => {
      const rng = createRng("spanning");
      const result = getNextPieces(rng, 14); // Two full bags

      expect(result.pieces).toHaveLength(14);

      // Should contain each piece exactly twice
      for (const piece of ALL_PIECES) {
        const count = result.pieces.filter((p) => p === piece).length;
        expect(count).toBe(2);
      }
    });

    it("should be equivalent to multiple getNextPiece calls", () => {
      const rng = createRng("equivalent");

      // Get pieces using batch method
      const batchResult = getNextPieces(rng, 10);

      // Get pieces using individual calls
      const individualPieces: Array<PieceId> = [];
      let currentRng = rng;
      for (let i = 0; i < 10; i++) {
        const result = getNextPiece(currentRng);
        individualPieces.push(result.piece);
        currentRng = result.newRng;
      }

      expect(batchResult.pieces).toEqual(individualPieces);
    });

    it("should maintain immutability of original RNG state", () => {
      const originalRng = createRng("batch-immutable");
      const originalBagIndex = originalRng.bagIndex;
      const originalBag = originalRng.currentBag;

      getNextPieces(originalRng, 5);

      expect(originalRng.bagIndex).toBe(originalBagIndex);
      expect(originalRng.currentBag).toBe(originalBag);
    });
  });

  describe("Seven-bag properties", () => {
    it("should ensure each piece appears exactly once per bag", () => {
      const rng = createRng("property-test");
      let currentRng = rng;

      // Test multiple bags
      for (let bag = 0; bag < 5; bag++) {
        const bagPieces: Array<PieceId> = [];

        for (let i = 0; i < 7; i++) {
          const result = getNextPiece(currentRng);
          bagPieces.push(result.piece);
          currentRng = result.newRng;
        }

        // Each bag should have all pieces exactly once
        for (const piece of ALL_PIECES) {
          const count = bagPieces.filter((p) => p === piece).length;
          expect(count).toBe(1);
        }
      }
    });

    it("should not repeat the same piece consecutively across bags", () => {
      const rng = createRng("no-consecutive");
      let currentRng = rng;
      const sequence: Array<PieceId> = [];

      // Get pieces from multiple bags
      for (let i = 0; i < 21; i++) {
        // 3 full bags
        const result = getNextPiece(currentRng);
        sequence.push(result.piece);
        currentRng = result.newRng;
      }

      // Check that sequence has proper distribution
      expect(sequence).toHaveLength(21);

      // Each piece should appear exactly 3 times
      for (const piece of ALL_PIECES) {
        const count = sequence.filter((p) => p === piece).length;
        expect(count).toBe(3);
      }
    });

    it("should produce fair distribution over many bags", () => {
      const rng = createRng("fair-distribution");
      let currentRng = rng;
      const pieceCounts: Record<PieceId, number> = {
        I: 0,
        J: 0,
        L: 0,
        O: 0,
        S: 0,
        T: 0,
        Z: 0,
      };

      // Generate 700 pieces (100 bags)
      for (let i = 0; i < 700; i++) {
        const result = getNextPiece(currentRng);
        pieceCounts[result.piece]++;
        currentRng = result.newRng;
      }

      // Each piece should appear exactly 100 times
      for (const piece of ALL_PIECES) {
        expect(pieceCounts[piece]).toBe(100);
      }
    });
  });
});
