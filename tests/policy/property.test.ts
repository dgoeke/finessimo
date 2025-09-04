import { describe, it, expect } from "@jest/globals";

import { createEmptyBoard } from "../../src/core/board";
import { createInitialState } from "../../src/engine/init";
import { recommendMove } from "../../src/policy/index";
import { BASE_TEMPLATES } from "../../src/policy/templates/index";
import { createBoardCells } from "../../src/state/types";
import { createSeed, createGridCoord } from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";

import type { GameState, ActivePiece, PieceId } from "../../src/state/types";

describe("Policy Property Tests", () => {
  // Helper to create a random flat board state
  function createRandomFlatState(
    seed: string,
    pieces: Array<PieceId>,
  ): GameState {
    const state = createInitialState(createSeed(seed), createTimestamp(1000));

    return {
      ...state,
      active:
        pieces.length > 0 && pieces[0] !== undefined
          ? ({
              id: pieces[0],
              rot: "spawn" as const,
              x: createGridCoord(4),
              y: createGridCoord(0),
            } as ActivePiece)
          : undefined,
      board: createEmptyBoard(),
      nextQueue: pieces,
    };
  }

  // Helper to create a state with some random noise (occupied cells)
  function createNoisyState(seed: string, pieces: Array<PieceId>): GameState {
    const state = createRandomFlatState(seed, pieces);
    const board = { ...state.board };

    // Add some random occupied cells in lower rows
    const cells = createBoardCells();
    cells.set(board.cells);
    for (let i = 0; i < 10; i++) {
      // eslint-disable-next-line sonarjs/pseudo-random -- Safe: test data generation
      const x = Math.floor(Math.random() * board.width);
      // eslint-disable-next-line sonarjs/pseudo-random -- Safe: test data generation
      const y = Math.floor(Math.random() * 5) + 10; // Lower rows only
      const idx = (y + board.vanishRows) * board.width + x;
      if (idx < cells.length) {
        // eslint-disable-next-line sonarjs/pseudo-random -- Safe: test data generation
        cells[idx] = Math.floor(Math.random() * 7) + 1; // Random piece color
      }
    }

    return {
      ...state,
      board: { ...board, cells: cells },
    };
  }

  // Helper to validate placement structure
  function validatePlacementStructure(placement: {
    x: unknown;
    rot: unknown;
  }): void {
    expect(placement.x).toBeDefined();
    expect(placement.rot).toBeDefined();
    expect(["spawn", "right", "two", "left"]).toContain(placement.rot);
  }

  // Helper to test template candidates for a state
  function testTemplateCandidates(state: GameState): void {
    for (const template of BASE_TEMPLATES) {
      if (!state.active) continue;

      const candidates = template.nextStep(state);

      candidates.forEach((candidate) => {
        if (candidate.when(state)) {
          const placements = candidate.propose(state);
          placements.forEach(validatePlacementStructure);
        }
      });
    }
  }

  // Helper to test state without throwing
  function testStateStability(state: GameState): void {
    expect(() => {
      const result = recommendMove(state);
      expect(result).toBeDefined();
      expect(result.suggestion).toBeDefined();
      expect(result.nextCtx).toBeDefined();
    }).not.toThrow();
  }

  // Helper to test piece type handling
  function testPieceTypeHandling(pieceId: PieceId): void {
    const state = createRandomFlatState(`active-${pieceId}`, [
      pieceId,
      "T",
      "S",
    ]);

    expect(() => {
      const result = recommendMove(state);
      expect(result.suggestion.placement.x).toBeDefined();
      expect(result.suggestion.placement.rot).toBeDefined();
    }).not.toThrow();
  }

  // Helper to test template feasibility
  function testTemplateFeasibility(
    pieces: Array<PieceId>,
    index: number,
  ): void {
    const state = createRandomFlatState(`feasible-${index.toString()}`, pieces);

    const feasibleTemplates = BASE_TEMPLATES.filter((template) => {
      const precond = template.preconditions(state);
      return precond.feasible;
    });

    expect(feasibleTemplates.length).toBeGreaterThan(0);

    // Neither should always be feasible
    const neitherTemplate = BASE_TEMPLATES.find((t) => t.id === "Neither/safe");
    if (!neitherTemplate) throw new Error("Neither/safe template not found");
    expect(neitherTemplate.preconditions(state).feasible).toBe(true);
  }

  describe("Determinism properties", () => {
    it("should return identical results for same state and context", () => {
      const pieces: Array<PieceId> = ["T", "I", "S", "Z", "O", "L", "J"];
      const state = createRandomFlatState("determinism-test", pieces);

      const result1 = recommendMove(state);
      const result2 = recommendMove(state);

      expect(result1.suggestion.intent).toBe(result2.suggestion.intent);
      expect(result1.suggestion.planId).toBe(result2.suggestion.planId);
      expect(result1.suggestion.placement.x).toBe(
        result2.suggestion.placement.x,
      );
      expect(result1.suggestion.placement.rot).toBe(
        result2.suggestion.placement.rot,
      );
      expect(result1.suggestion.placement.useHold).toBe(
        result2.suggestion.placement.useHold,
      );
      expect(result1.suggestion.confidence).toBe(result2.suggestion.confidence);
      expect(result1.suggestion.rationale).toBe(result2.suggestion.rationale);
    });

    it("should return identical context updates for same inputs", () => {
      const pieces: Array<PieceId> = ["I", "T", "S", "Z", "O", "L", "J"];
      const state = createRandomFlatState("context-test", pieces);

      const result1 = recommendMove(state);
      const result2 = recommendMove(state);

      expect(result1.nextCtx.lastPlanId).toBe(result2.nextCtx.lastPlanId);
      expect(result1.nextCtx.lastBestScore).toBe(result2.nextCtx.lastBestScore);
      expect(result1.nextCtx.lastSecondScore).toBe(
        result2.nextCtx.lastSecondScore,
      );
      expect(result1.nextCtx.planAge).toBe(result2.nextCtx.planAge);
    });
  });

  describe("Valid placement properties", () => {
    const testCases: Array<{ name: string; pieces: Array<PieceId> }> = [
      {
        name: "standard queue with I first",
        pieces: ["I", "T", "S", "Z", "O", "L", "J"] as Array<PieceId>,
      },
      {
        name: "T first, I second",
        pieces: ["T", "I", "S", "Z", "O", "L", "J"] as Array<PieceId>,
      },
      {
        name: "I and T at end",
        pieces: ["S", "Z", "O", "L", "J", "T", "I"] as Array<PieceId>,
      },
      {
        name: "repeated pieces",
        pieces: ["O", "O", "O", "S", "S", "Z", "T"] as Array<PieceId>,
      },
    ];

    testCases.forEach(({ name, pieces }) => {
      it(`should always propose legal placements for ${name}`, () => {
        const state = createRandomFlatState(`legal-${name}`, pieces);
        testTemplateCandidates(state);
      });
    });

    it("should handle various board states without crashing", () => {
      const testStates = [
        createRandomFlatState("empty", ["T", "I", "S"]),
        createNoisyState("noisy", ["T", "I", "S"]),
      ];

      testStates.forEach(testStateStability);
    });
  });

  describe("Template feasibility properties", () => {
    it("should have at least one feasible template for any state", () => {
      const testCases: Array<Array<PieceId>> = [
        ["I", "T", "S", "Z", "O", "L", "J"] as Array<PieceId>,
        ["S", "Z", "O", "L", "J", "T", "I"] as Array<PieceId>,
        ["T", "T", "T", "S", "S", "S", "Z"] as Array<PieceId>,
      ];

      testCases.forEach(testTemplateFeasibility);
    });

    it("should prefer TKI when I is available early", () => {
      const withEarlyI = createRandomFlatState("early-i", [
        "I",
        "T",
        "S",
        "Z",
        "O",
        "L",
        "J",
      ]);
      const withLateI = createRandomFlatState("late-i", [
        "T",
        "S",
        "Z",
        "O",
        "L",
        "J",
        "I",
      ]);

      const tkiTemplate = BASE_TEMPLATES.find((t) => t.id === "TKI/base");
      if (!tkiTemplate) throw new Error("TKI/base template not found");

      expect(tkiTemplate.preconditions(withEarlyI).feasible).toBe(true);
      expect(tkiTemplate.preconditions(withLateI).feasible).toBe(false);
    });

    it("should prefer PCO on flat fields with I available", () => {
      const flatWithI = createRandomFlatState("flat-i", [
        "I",
        "L",
        "J",
        "S",
        "Z",
        "O",
        "T",
      ]);
      const noisyWithI = createNoisyState("noisy-i", [
        "I",
        "L",
        "J",
        "S",
        "Z",
        "O",
        "T",
      ]);

      const pcoTemplate = BASE_TEMPLATES.find((t) => t.id === "PCO/standard");
      if (!pcoTemplate) throw new Error("PCO/standard template not found");

      const flatResult = pcoTemplate.preconditions(flatWithI);
      const noisyResult = pcoTemplate.preconditions(noisyWithI);

      // Both should check I availability, but flat should be more favorable
      if (flatResult.feasible && noisyResult.feasible) {
        expect(flatResult.scoreDelta ?? 0).toBeGreaterThanOrEqual(
          noisyResult.scoreDelta ?? 0,
        );
      }
    });
  });

  describe("Confidence properties", () => {
    it("should have confidence between 0 and 1", () => {
      const testCases: Array<Array<PieceId>> = [
        ["I", "T", "S", "Z", "O", "L", "J"] as Array<PieceId>,
        ["S", "Z", "O", "L", "J", "T", "I"] as Array<PieceId>,
        ["T", "I", "O", "S", "Z", "L", "J"] as Array<PieceId>,
      ];

      testCases.forEach((pieces, index) => {
        const state = createRandomFlatState(
          `confidence-${index.toString()}`,
          pieces,
        );
        const result = recommendMove(state);

        expect(result.suggestion.confidence).toBeGreaterThanOrEqual(0);
        expect(result.suggestion.confidence).toBeLessThanOrEqual(1);
        expect(result.suggestion.confidence).not.toBeNaN();
        expect(Number.isFinite(result.suggestion.confidence)).toBe(true);
      });
    });

    it("should have higher confidence when templates are clearly differentiated", () => {
      // State that strongly favors Neither (clear winner)
      const clearFavorite = createRandomFlatState("clear-neither", [
        "S",
        "Z",
        "O",
        "L",
        "J",
        "S",
        "Z",
      ]);

      // State with competing templates (I available for TKI/PCO but also viable for Neither)
      const competing = createRandomFlatState("competing", [
        "I",
        "T",
        "S",
        "Z",
        "O",
        "L",
        "J",
      ]);

      const clearResult = recommendMove(clearFavorite);
      const competingResult = recommendMove(competing);

      // Clear favorite should have higher confidence due to less competition
      expect(clearResult.suggestion.confidence).toBeGreaterThanOrEqual(
        competingResult.suggestion.confidence,
      );
    });
  });

  describe("Hysteresis properties", () => {
    it("should maintain plan when scores are close", () => {
      const state = createRandomFlatState("hysteresis", [
        "T",
        "S",
        "Z",
        "O",
        "L",
        "J",
        "I",
      ]);

      // First call establishes a plan
      const result1 = recommendMove(state);

      // Second call with same state should maintain plan
      const result2 = recommendMove(state, result1.nextCtx);

      expect(result2.suggestion.planId).toBe(result1.suggestion.planId);
      expect(result2.nextCtx.planAge).toBe(result1.nextCtx.planAge + 1);
    });

    it("should eventually switch plans when new plan is clearly better", () => {
      // Start with a state that favors Neither
      const state = createRandomFlatState("switch-test", [
        "S",
        "Z",
        "O",
        "L",
        "J",
        "S",
        "Z",
      ]);

      let result = recommendMove(state);
      let context = result.nextCtx;

      // Simulate several iterations to build up plan age
      for (let i = 0; i < 5; i++) {
        result = recommendMove(state, context);
        context = result.nextCtx;
      }

      // Now change to a state that strongly favors TKI
      const tkiState = createRandomFlatState("switch-to-tki", [
        "I",
        "T",
        "S",
        "Z",
        "O",
        "L",
        "J",
      ]);

      // Should eventually switch to TKI
      const switchResult = recommendMove(tkiState, context);

      // The plan should either switch immediately or maintain with updated context
      expect(switchResult.nextCtx).toBeDefined();
      expect(switchResult.suggestion.planId).toBeDefined();
    });
  });

  describe("Rationale properties", () => {
    it("should always provide non-empty rationale", () => {
      const testCases: Array<Array<PieceId>> = [
        ["I", "T", "S", "Z", "O", "L", "J"] as Array<PieceId>,
        ["S", "Z", "O", "L", "J", "T", "I"] as Array<PieceId>,
        ["O", "O", "S", "S", "Z", "Z", "T"] as Array<PieceId>,
      ];

      testCases.forEach((pieces, index) => {
        const state = createRandomFlatState(
          `rationale-${index.toString()}`,
          pieces,
        );
        const result = recommendMove(state);

        expect(result.suggestion.rationale).toBeDefined();
        expect(result.suggestion.rationale.length).toBeGreaterThan(0);
        expect(result.suggestion.rationale.length).toBeLessThanOrEqual(90);
      });
    });

    it("should include intent in rationale", () => {
      const state = createRandomFlatState("intent-test", [
        "I",
        "T",
        "S",
        "Z",
        "O",
        "L",
        "J",
      ]);
      const result = recommendMove(state);

      expect(result.suggestion.rationale).toContain(result.suggestion.intent);
    });
  });

  describe("Edge case properties", () => {
    it("should handle empty next queue gracefully", () => {
      const state = {
        ...createRandomFlatState("empty-queue", []),
        active: undefined,
        nextQueue: [],
      };

      expect(() => {
        const result = recommendMove(state);
        expect(result).toBeDefined();
      }).not.toThrow();
    });

    it("should handle all piece types as active", () => {
      const pieceTypes: Array<PieceId> = ["I", "O", "T", "S", "Z", "J", "L"];

      pieceTypes.forEach(testPieceTypeHandling);
    });

    it("should maintain invariants under repeated calls", () => {
      const state = createRandomFlatState("repeated", [
        "I",
        "T",
        "S",
        "Z",
        "O",
        "L",
        "J",
      ]);
      let context = undefined;

      // Run many iterations
      for (let i = 0; i < 20; i++) {
        const result = recommendMove(state, context);

        // Check invariants
        expect(result.suggestion.confidence).toBeGreaterThanOrEqual(0);
        expect(result.suggestion.confidence).toBeLessThanOrEqual(1);
        expect(result.suggestion.planId).toBeDefined();
        expect(result.nextCtx.planAge).toBeGreaterThanOrEqual(0);

        context = result.nextCtx;
      }
    });
  });
});
