import { describe, it, expect } from "@jest/globals";

import { createEmptyBoard } from "../../src/core/board";
import { SCENARIOS } from "../../src/scenarios/cards";
import {
  queueFromSeed,
  queueFromSeedWithOffset,
  boardFromScenario,
  generateTrainingSequence,
  validateSequence,
  getScenarioPreview,
} from "../../src/scenarios/generators";
import { createSeed } from "../../src/types/brands";

import type { ScenarioCard } from "../../src/scenarios/cards";
import type { PieceId } from "../../src/state/types";

describe("Scenario Generators", () => {
  const validPieces: ReadonlyArray<PieceId> = [
    "I",
    "O",
    "T",
    "S",
    "Z",
    "J",
    "L",
  ];

  describe("queueFromSeed", () => {
    it("should generate deterministic sequences from same seed", () => {
      const seed = createSeed("deterministic-test");

      const queue1 = queueFromSeed(seed, 10);
      const queue2 = queueFromSeed(seed, 10);

      expect(queue1).toEqual(queue2);
      expect(queue1).toHaveLength(10);
    });

    it("should generate different sequences from different seeds", () => {
      const seed1 = createSeed("seed-one");
      const seed2 = createSeed("seed-two");

      const queue1 = queueFromSeed(seed1, 14); // Two full bags
      const queue2 = queueFromSeed(seed2, 14);

      // Very high probability of being different
      expect(queue1).not.toEqual(queue2);
    });

    it("should respect minPreview parameter", () => {
      const seed = createSeed("preview-test");

      const queue5 = queueFromSeed(seed, 5);
      const queue10 = queueFromSeed(seed, 10);

      expect(queue5).toHaveLength(5);
      expect(queue10).toHaveLength(10);

      // Longer queue should start with same pieces as shorter
      expect(queue10.slice(0, 5)).toEqual(queue5);
    });

    it("should use default minPreview of 5", () => {
      const seed = createSeed("default-test");

      const queueDefault = queueFromSeed(seed);
      const queueExplicit = queueFromSeed(seed, 5);

      expect(queueDefault).toEqual(queueExplicit);
      expect(queueDefault).toHaveLength(5);
    });

    it("should throw error for invalid minPreview", () => {
      const seed = createSeed("error-test");

      expect(() => queueFromSeed(seed, 0)).toThrow(
        "minPreview must be at least 1",
      );
      expect(() => queueFromSeed(seed, -1)).toThrow(
        "minPreview must be at least 1",
      );
    });

    it("should generate only valid piece IDs", () => {
      const seed = createSeed("valid-pieces-test");
      const queue = queueFromSeed(seed, 14); // Two full bags

      for (const piece of queue) {
        expect(validPieces).toContain(piece);
      }
    });

    it("should follow seven-bag distribution over complete bags", () => {
      const seed = createSeed("distribution-test");
      const queue = queueFromSeed(seed, 14); // Exactly two full bags

      // Each piece should appear exactly twice
      for (const piece of validPieces) {
        const count = queue.filter((p) => p === piece).length;
        expect(count).toBe(2);
      }
    });

    it("should be deterministic across multiple calls", () => {
      const seed = createSeed("multiple-calls-test");

      const results: Array<ReadonlyArray<PieceId>> = [];
      for (let i = 0; i < 5; i++) {
        results.push(queueFromSeed(seed, 7));
      }

      // All results should be identical
      for (const result of results) {
        expect(result).toEqual(results[0]);
      }
    });
  });

  describe("queueFromSeedWithOffset", () => {
    it("should generate consistent sequences with offset", () => {
      const seed = createSeed("offset-test");

      const fullQueue = queueFromSeed(seed, 20);
      const offsetQueue = queueFromSeedWithOffset(seed, 5, 10);

      // Offset queue should match the full queue starting from offset
      expect(offsetQueue).toEqual(fullQueue.slice(5, 15));
    });

    it("should handle zero offset correctly", () => {
      const seed = createSeed("zero-offset-test");

      const normalQueue = queueFromSeed(seed, 10);
      const zeroOffsetQueue = queueFromSeedWithOffset(seed, 0, 10);

      expect(zeroOffsetQueue).toEqual(normalQueue);
    });

    it("should work with large offsets", () => {
      const seed = createSeed("large-offset-test");

      const largeOffsetQueue = queueFromSeedWithOffset(seed, 50, 5);

      expect(largeOffsetQueue).toHaveLength(5);
      for (const piece of largeOffsetQueue) {
        expect(validPieces).toContain(piece);
      }
    });

    it("should throw error for negative offset", () => {
      const seed = createSeed("negative-offset-test");

      expect(() => queueFromSeedWithOffset(seed, -1, 5)).toThrow(
        "startTicks must be non-negative",
      );
    });

    it("should throw error for invalid minPreview", () => {
      const seed = createSeed("invalid-preview-test");

      expect(() => queueFromSeedWithOffset(seed, 0, 0)).toThrow(
        "minPreview must be at least 1",
      );
      expect(() => queueFromSeedWithOffset(seed, 0, -1)).toThrow(
        "minPreview must be at least 1",
      );
    });

    it("should be deterministic with same parameters", () => {
      const seed = createSeed("deterministic-offset-test");

      const queue1 = queueFromSeedWithOffset(seed, 10, 8);
      const queue2 = queueFromSeedWithOffset(seed, 10, 8);

      expect(queue1).toEqual(queue2);
    });

    it("should maintain seven-bag properties across offsets", () => {
      const seed = createSeed("bag-properties-test");

      // Generate multiple offset queues and verify they contain valid pieces
      for (let offset = 0; offset < 21; offset += 7) {
        const queue = queueFromSeedWithOffset(seed, offset, 7);

        // Should be exactly one complete bag
        const pieceCounts: Record<string, number> = {};
        for (const piece of queue) {
          const currentCount = pieceCounts[piece] ?? 0;
          pieceCounts[piece] = currentCount + 1;
        }

        // Each piece should appear exactly once in a complete bag
        for (const piece of validPieces) {
          expect(pieceCounts[piece]).toBe(1);
        }
      }
    });
  });

  describe("boardFromScenario", () => {
    it("should create empty board for scenarios without garbage", () => {
      const noGarbageCard: ScenarioCard = {
        id: "test/empty:easy",
        maxGarbage: 0,
        opener: "TKI",
        seed: createSeed("empty-board-test"),
      };

      const board = boardFromScenario(noGarbageCard);
      const expectedBoard = createEmptyBoard();

      expect(board).toEqual(expectedBoard);
    });

    it("should create empty board when maxGarbage is undefined", () => {
      const undefinedGarbageCard: ScenarioCard = {
        id: "test/undefined:easy",
        opener: "PCO",
        seed: createSeed("undefined-garbage-test"),
      };

      const board = boardFromScenario(undefinedGarbageCard);
      const expectedBoard = createEmptyBoard();

      expect(board).toEqual(expectedBoard);
    });

    it("should currently create empty board even with maxGarbage > 0", () => {
      // Chapter 2 doesn't implement garbage generation yet
      const garbageCard: ScenarioCard = {
        id: "test/garbage:mid",
        maxGarbage: 3,
        opener: "TKI",
        seed: createSeed("garbage-test"),
      };

      const board = boardFromScenario(garbageCard);
      const expectedBoard = createEmptyBoard();

      // Should be empty for now (placeholder for future chapters)
      expect(board).toEqual(expectedBoard);
    });

    it("should work with all scenario cards from registry", () => {
      for (const card of SCENARIOS) {
        const board = boardFromScenario(card);

        // Should be a valid board
        expect(board).toBeDefined();
        expect(board.width).toBe(10);
        expect(board.height).toBe(20);
        expect(board.cells instanceof Uint8Array).toBe(true);
      }
    });

    it("should produce consistent boards for same scenario", () => {
      const card = SCENARIOS[0];
      if (card) {
        const board1 = boardFromScenario(card);
        const board2 = boardFromScenario(card);

        expect(board1).toEqual(board2);
      }
    });
  });

  describe("generateTrainingSequence", () => {
    it("should respect scenario minPreview", () => {
      const card: ScenarioCard = {
        id: "test/training:easy",
        minPreview: 8,
        opener: "TKI",
        seed: createSeed("training-preview-test"),
      };

      const sequence = generateTrainingSequence(card);

      // Should use at least the scenario's minPreview or 20, whichever is larger
      expect(sequence.length).toBeGreaterThanOrEqual(20);
    });

    it("should generate at least 20 pieces for training", () => {
      const card: ScenarioCard = {
        id: "test/training:easy",
        minPreview: 3, // Less than 20
        opener: "PCO",
        seed: createSeed("training-length-test"),
      };

      const sequence = generateTrainingSequence(card);

      expect(sequence.length).toBe(20); // Should use 20 as minimum
    });

    it("should respect startTicks offset", () => {
      const cardNoOffset: ScenarioCard = {
        id: "test/no-offset:easy",
        opener: "TKI",
        seed: createSeed("training-offset-test"),
      };

      const cardWithOffset: ScenarioCard = {
        id: "test/with-offset:easy",
        opener: "TKI",
        seed: createSeed("training-offset-test"),
        startTicks: 5,
      };

      const sequenceNoOffset = generateTrainingSequence(cardNoOffset);
      const sequenceWithOffset = generateTrainingSequence(cardWithOffset);

      // Both sequences should be length 20 (minimum training length)
      expect(sequenceNoOffset).toHaveLength(20);
      expect(sequenceWithOffset).toHaveLength(20);

      // Generate a longer no-offset sequence to compare against
      const longNoOffsetSequence = queueFromSeed(
        createSeed("training-offset-test"),
        25,
      );

      // With offset should match the long sequence starting from position 5
      expect(sequenceWithOffset).toEqual(longNoOffsetSequence.slice(5, 25));
    });

    it("should work with all scenario cards from registry", () => {
      for (const card of SCENARIOS) {
        const sequence = generateTrainingSequence(card);

        expect(sequence.length).toBeGreaterThanOrEqual(20);
        for (const piece of sequence) {
          expect(validPieces).toContain(piece);
        }
      }
    });

    it("should be deterministic for same scenario", () => {
      const card = SCENARIOS[0];
      if (card) {
        const sequence1 = generateTrainingSequence(card);
        const sequence2 = generateTrainingSequence(card);

        expect(sequence1).toEqual(sequence2);
      }
    });
  });

  describe("validateSequence", () => {
    it("should validate sequences meeting minPreview requirements", () => {
      const card: ScenarioCard = {
        id: "test/validate:easy",
        minPreview: 5,
        opener: "TKI",
        seed: createSeed("validate-test"),
      };

      const validSequence: ReadonlyArray<PieceId> = ["T", "I", "S", "Z", "O"];

      expect(validateSequence(card, validSequence)).toBe(true);
    });

    it("should reject sequences shorter than minPreview", () => {
      const card: ScenarioCard = {
        id: "test/validate:easy",
        minPreview: 5,
        opener: "TKI",
        seed: createSeed("validate-short-test"),
      };

      const shortSequence: ReadonlyArray<PieceId> = ["T", "I"];

      expect(validateSequence(card, shortSequence)).toBe(false);
    });

    it("should reject sequences with invalid pieces", () => {
      const card: ScenarioCard = {
        id: "test/validate:easy",
        minPreview: 3,
        opener: "TKI",
        seed: createSeed("validate-invalid-test"),
      };

      const invalidSequence = [
        "X",
        "Y",
        "Z",
      ] as unknown as ReadonlyArray<PieceId>;

      expect(validateSequence(card, invalidSequence)).toBe(false);
    });

    it("should use default minPreview of 5 when undefined", () => {
      const card: ScenarioCard = {
        id: "test/validate:easy",
        opener: "TKI",
        seed: createSeed("validate-default-test"),
        // minPreview undefined
      };

      const sequenceOf4: ReadonlyArray<PieceId> = ["T", "I", "S", "Z"];
      const sequenceOf5: ReadonlyArray<PieceId> = ["T", "I", "S", "Z", "O"];

      expect(validateSequence(card, sequenceOf4)).toBe(false);
      expect(validateSequence(card, sequenceOf5)).toBe(true);
    });

    it("should validate all generated sequences from registry", () => {
      for (const card of SCENARIOS) {
        const sequence = generateTrainingSequence(card);
        expect(validateSequence(card, sequence)).toBe(true);
      }
    });

    it("should validate empty sequences correctly", () => {
      const card: ScenarioCard = {
        id: "test/validate:easy",
        minPreview: 1,
        opener: "TKI",
        seed: createSeed("validate-empty-test"),
      };

      const emptySequence: ReadonlyArray<PieceId> = [];

      expect(validateSequence(card, emptySequence)).toBe(false);
    });

    it("should validate mixed valid/invalid piece sequences", () => {
      const card: ScenarioCard = {
        id: "test/validate:easy",
        minPreview: 5,
        opener: "TKI",
        seed: createSeed("validate-mixed-test"),
      };

      const mixedSequence = [
        "T",
        "I",
        "INVALID",
        "S",
        "Z",
      ] as unknown as ReadonlyArray<PieceId>;

      expect(validateSequence(card, mixedSequence)).toBe(false);
    });
  });

  describe("getScenarioPreview", () => {
    it("should generate preview with default count of 5", () => {
      const card = SCENARIOS[0];
      if (card) {
        const preview = getScenarioPreview(card);

        expect(preview).toHaveLength(5);
      }
    });

    it("should respect custom preview count", () => {
      const card = SCENARIOS[0];
      if (card) {
        const preview3 = getScenarioPreview(card, 3);
        const preview7 = getScenarioPreview(card, 7);

        expect(preview3).toHaveLength(3);
        expect(preview7).toHaveLength(7);
      }
    });

    it("should respect startTicks offset", () => {
      const cardNoOffset: ScenarioCard = {
        id: "test/preview:easy",
        opener: "TKI",
        seed: createSeed("preview-offset-test"),
        startTicks: 0,
      };

      const cardWithOffset: ScenarioCard = {
        id: "test/preview:easy",
        opener: "TKI",
        seed: createSeed("preview-offset-test"),
        startTicks: 3,
      };

      const previewNoOffset = getScenarioPreview(cardNoOffset, 8);
      const previewWithOffset = getScenarioPreview(cardWithOffset, 5);

      // With offset should match the no-offset preview starting from position 3
      expect(previewWithOffset).toEqual(previewNoOffset.slice(3));
    });

    it("should be deterministic for same parameters", () => {
      const card = SCENARIOS[0];
      if (card) {
        const preview1 = getScenarioPreview(card, 6);
        const preview2 = getScenarioPreview(card, 6);

        expect(preview1).toEqual(preview2);
      }
    });

    it("should generate only valid pieces", () => {
      const card = SCENARIOS[0];
      if (card) {
        const preview = getScenarioPreview(card, 10);

        for (const piece of preview) {
          expect(validPieces).toContain(piece);
        }
      }
    });

    it("should work with all scenarios from registry", () => {
      for (const card of SCENARIOS) {
        const preview = getScenarioPreview(card);

        expect(preview).toHaveLength(5);
        for (const piece of preview) {
          expect(validPieces).toContain(piece);
        }
      }
    });
  });

  describe("Integration with existing RNG system", () => {
    it("should be consistent with direct RNG usage", async () => {
      const seed = createSeed("rng-integration-test");

      // Use the same approach as the generators internally
      const { createRng, getNextPieces } = await import("../../src/core/rng");
      const rng = createRng(seed as unknown as string);
      const { pieces } = getNextPieces(rng, 7);

      const generatorQueue = queueFromSeed(seed, 7);

      expect(generatorQueue).toEqual(pieces);
    });

    it("should maintain determinism across function calls", () => {
      const card: ScenarioCard = {
        id: "test/determinism:easy",
        minPreview: 6,
        opener: "TKI",
        seed: createSeed("determinism-test"),
        startTicks: 2,
      };

      // Multiple function calls should be consistent
      const sequence1 = generateTrainingSequence(card);
      const sequence2 = generateTrainingSequence(card);
      const preview1 = getScenarioPreview(card);
      const preview2 = getScenarioPreview(card);

      expect(sequence1).toEqual(sequence2);
      expect(preview1).toEqual(preview2);

      // Preview should match the beginning of training sequence (after offset)
      expect(preview1).toEqual(sequence1.slice(0, 5));
    });
  });
});
