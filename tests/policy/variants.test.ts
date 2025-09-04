import { describe, it, expect } from "@jest/globals";

import { createEmptyBoard } from "../../src/core/board";
import { createInitialState } from "../../src/engine/init";
import { BASE_TEMPLATES } from "../../src/policy/templates/index";
import { VARIANT_TEMPLATES } from "../../src/policy/templates/variants";
import { createSeed, createGridCoord } from "../../src/types/brands";
import { fromNow } from "../../src/types/timestamp";

import type { Template } from "../../src/policy/types";
import type { PlayingState, PieceId, Board } from "../../src/state/types";

// Shared helper functions to avoid duplication
const createTestState = (
  overrides: Partial<PlayingState> = {},
  customBoard?: Board,
): PlayingState => {
  const seed = createSeed("test-variants");
  const timestamp = fromNow();
  const baseState = createInitialState(seed, timestamp);

  const playingState: PlayingState = {
    ...baseState,
    active: {
      id: "T" as PieceId,
      rot: "spawn",
      x: createGridCoord(4),
      y: createGridCoord(0),
    },
    board: customBoard ?? createEmptyBoard(),
    nextQueue: ["I", "S", "Z", "O", "L", "J", "T"] as const, // I piece first for PCO
    pendingLock: null,
    status: "playing",
    ...overrides,
  };

  return playingState;
};

const createBoardWithCells = (
  filledPositions: ReadonlyArray<{ x: number; y: number }>,
): Board => {
  const board = createEmptyBoard();
  const newCells = new Uint8Array(board.cells);

  filledPositions.forEach(({ x, y }) => {
    // Adjust for vanish rows: y=0 is the first visible row, but storage starts at row 3
    const storageRow = y + board.vanishRows;
    const idx = storageRow * board.width + x;
    if (idx >= 0 && idx < newCells.length) {
      newCells[idx] = 1; // Fill with gray block
    }
  });

  return {
    ...board,
    cells: newCells as typeof board.cells,
  };
};

describe("Policy Template Variants", () => {
  describe("Variant Templates Registry", () => {
    it("should have exactly 2 variant templates", () => {
      expect(VARIANT_TEMPLATES).toHaveLength(2);
    });

    it("should have unique template IDs", () => {
      const ids = VARIANT_TEMPLATES.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should extend PCO base templates", () => {
      const variantIds = VARIANT_TEMPLATES.map((t) => t.id);

      expect(variantIds).toContain("PCO/edge");
      expect(variantIds).toContain("PCO/transition");
    });

    it("should have all required template fields", () => {
      VARIANT_TEMPLATES.forEach((template) => {
        expect(template).toHaveProperty("id");
        expect(template).toHaveProperty("opener");
        expect(template).toHaveProperty("preconditions");
        expect(template).toHaveProperty("nextStep");

        expect(typeof template.id).toBe("string");
        expect(typeof template.opener).toBe("string");
        expect(typeof template.preconditions).toBe("function");
        expect(typeof template.nextStep).toBe("function");
      });
    });

    it("should inherit PCO opener from base template", () => {
      VARIANT_TEMPLATES.forEach((template) => {
        expect(template.opener).toBe("PCO");
      });
    });
  });

  describe("Template Extension Mechanism", () => {
    it("should properly extend base template functionality", () => {
      const pcoStandard = BASE_TEMPLATES.find((t) => t.id === "PCO/standard");
      const pcoEdge = VARIANT_TEMPLATES.find((t) => t.id === "PCO/edge");

      expect(pcoStandard).toBeDefined();
      expect(pcoEdge).toBeDefined();

      if (pcoStandard && pcoEdge) {
        // Both should be PCO templates
        expect(pcoEdge.opener).toBe(pcoStandard.opener);

        // Edge variant should have extended preconditions
        const state = createTestState();
        const baseResult = pcoStandard.preconditions(state);
        const edgeResult = pcoEdge.preconditions(state);

        expect(baseResult).toHaveProperty("feasible");
        expect(edgeResult).toHaveProperty("feasible");
        expect(edgeResult).toHaveProperty("scoreDelta");
      }
    });

    it("should inherit nextStep functionality from base template", () => {
      const pcoStandard = BASE_TEMPLATES.find((t) => t.id === "PCO/standard");
      const pcoTransition = VARIANT_TEMPLATES.find(
        (t) => t.id === "PCO/transition",
      );

      expect(pcoStandard).toBeDefined();
      expect(pcoTransition).toBeDefined();

      if (pcoStandard && pcoTransition) {
        const state = createTestState();
        const baseSteps = pcoStandard.nextStep(state);
        const variantSteps = pcoTransition.nextStep(state);

        // Should both return array of step candidates
        expect(Array.isArray(baseSteps)).toBe(true);
        expect(Array.isArray(variantSteps)).toBe(true);

        // Should have same structure (since variants inherit nextStep)
        if (baseSteps.length > 0 && variantSteps.length > 0) {
          const baseStep = baseSteps[0];
          const variantStep = variantSteps[0];

          if (baseStep && variantStep) {
            expect(typeof baseStep.when).toBe(typeof variantStep.when);
            expect(typeof baseStep.propose).toBe(typeof variantStep.propose);
            expect(typeof baseStep.utility).toBe(typeof variantStep.utility);
          }
        }
      }
    });
  });

  describe("PCO Edge Variant", () => {
    let pcoEdge: Template;

    beforeEach(() => {
      const template = VARIANT_TEMPLATES.find((t) => t.id === "PCO/edge");
      if (!template) {
        throw new Error("PCO/edge template not found");
      }
      pcoEdge = template;
    });

    it("should have correct ID and opener", () => {
      expect(pcoEdge.id).toBe("PCO/edge");
      expect(pcoEdge.opener).toBe("PCO");
    });

    it("should give bonus score for clean edges", () => {
      // Create board with clean edges (no blocks in columns 0-2 and 7-9)
      const cleanBoard = createEmptyBoard();
      const state = createTestState({}, cleanBoard);

      const result = pcoEdge.preconditions(state);

      expect(result.feasible).toBe(true);
      expect(result.scoreDelta).toBe(0.35); // Base PCO (0.2) + clean edges bonus (0.15)
      expect(result.notes).toContain("clean edges for edge play");
    });

    it("should penalize score for occupied edges", () => {
      // Create board with blocks in edge columns (in the range checked by areEdgesClean)
      // areEdgesClean checks y=0-2 (board.vanishRows to board.vanishRows + 2)
      const edgeBlocks = [
        { x: 0, y: 2 }, // Left edge in checked range but below flatness check
        { x: 9, y: 2 }, // Right edge in checked range but below flatness check
      ];
      const occupiedEdgeBoard = createBoardWithCells(edgeBlocks);
      const state = createTestState({}, occupiedEdgeBoard);

      const result = pcoEdge.preconditions(state);

      expect(result.feasible).toBe(true);
      expect(result.scoreDelta).toBe(0.1); // Base PCO (0.2) + edge penalty (-0.1)
      expect(result.notes).toContain("edges have height");
    });

    it("should detect left edge occupation correctly", () => {
      // Fill only left edge columns (0-2) in the range checked by areEdgesClean
      const leftEdgeBlocks = [
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 2, y: 2 },
      ];
      const leftEdgeBoard = createBoardWithCells(leftEdgeBlocks);
      const state = createTestState({}, leftEdgeBoard);

      const result = pcoEdge.preconditions(state);

      expect(result.scoreDelta).toBe(0.1); // Base PCO (0.2) + edge penalty (-0.1)
      expect(result.notes).toContain("edges have height");
    });

    it("should detect right edge occupation correctly", () => {
      // Fill only right edge columns (7-9) in the range checked by areEdgesClean
      const rightEdgeBlocks = [
        { x: 7, y: 2 },
        { x: 8, y: 2 },
        { x: 9, y: 2 },
      ];
      const rightEdgeBoard = createBoardWithCells(rightEdgeBlocks);
      const state = createTestState({}, rightEdgeBoard);

      const result = pcoEdge.preconditions(state);

      expect(result.scoreDelta).toBe(0.1); // Base PCO (0.2) + edge penalty (-0.1)
      expect(result.notes).toContain("edges have height");
    });

    it("should not penalize for center column occupation", () => {
      // Fill only center columns (3-6) - outside the edge detection range
      const centerBlocks = [
        { x: 3, y: 2 },
        { x: 4, y: 2 },
        { x: 5, y: 2 },
        { x: 6, y: 2 },
      ];
      const centerBoard = createBoardWithCells(centerBlocks);
      const state = createTestState({}, centerBoard);

      const result = pcoEdge.preconditions(state);

      expect(result.scoreDelta).toBe(0.35); // Base PCO (0.2) + clean edges bonus (0.15)
      expect(result.notes).toContain("clean edges for edge play");
    });

    it("should be consistent with multiple evaluations", () => {
      const state = createTestState();

      const result1 = pcoEdge.preconditions(state);
      const result2 = pcoEdge.preconditions(state);

      expect(result1).toEqual(result2);
    });
  });

  describe("PCO Transition Variant", () => {
    let pcoTransition: Template;

    beforeEach(() => {
      const template = VARIANT_TEMPLATES.find((t) => t.id === "PCO/transition");
      if (!template) {
        throw new Error("PCO/transition template not found");
      }
      pcoTransition = template;
    });

    it("should have correct ID and opener", () => {
      expect(pcoTransition.id).toBe("PCO/transition");
      expect(pcoTransition.opener).toBe("PCO");
    });

    it("should give bonus when PC is still viable", () => {
      // Clean board with minimal cells (PC still viable)
      const minimalBlocks = [
        { x: 4, y: 19 }, // Near bottom of visible area
      ];
      const viableBoard = createBoardWithCells(minimalBlocks);
      const state = createTestState({}, viableBoard);

      const result = pcoTransition.preconditions(state);

      expect(result.feasible).toBe(true);
      expect(result.scoreDelta).toBeCloseTo(0.3); // Base PCO (0.2) + viable PC bonus (0.1)
      expect(result.notes).toContain("PC still viable");
    });

    it("should penalize when PC becomes unviable due to too many cells", () => {
      // Fill more than 20 cells to make PC unviable, but keep field flat (avoid y=0,1)
      const manyBlocks = [];
      for (let i = 0; i < 25; i++) {
        manyBlocks.push({ x: i % 10, y: 2 + Math.floor(i / 10) }); // Start from y=2 to keep field flat
      }
      const unviableBoard = createBoardWithCells(manyBlocks);
      const state = createTestState({}, unviableBoard);

      const result = pcoTransition.preconditions(state);

      expect(result.feasible).toBe(true); // Always feasible as it can transition
      expect(result.scoreDelta).toBeCloseTo(0.0); // Base PCO (0.2) + transition penalty (-0.2)
      expect(result.notes).toContain(
        "PC unviable, transition to safe stacking",
      );
    });

    it("should penalize when PC becomes unviable due to height", () => {
      // Create uneven height (max height > 3) but keep field flat
      const highBlocks = [
        { x: 0, y: 2 },
        { x: 0, y: 3 },
        { x: 0, y: 4 },
        { x: 0, y: 5 },
        { x: 0, y: 6 }, // Height of 5 in first column, starting from y=2
      ];
      const highBoard = createBoardWithCells(highBlocks);
      const state = createTestState({}, highBoard);

      const result = pcoTransition.preconditions(state);

      expect(result.scoreDelta).toBeCloseTo(0.0); // Base PCO (0.2) + transition penalty (-0.2)
      expect(result.notes).toContain(
        "PC unviable, transition to safe stacking",
      );
    });

    it("should handle edge case of exactly 20 cells", () => {
      // Place exactly 20 blocks all at y=2 to keep maxHeight = 3 and field flat
      const exactlyTwentyBlocks = [];
      for (let i = 0; i < 20; i++) {
        exactlyTwentyBlocks.push({ x: i % 10, y: 2 }); // All at y=2 for height=3
      }
      const twentyCellBoard = createBoardWithCells(exactlyTwentyBlocks);
      const state = createTestState({}, twentyCellBoard);

      const result = pcoTransition.preconditions(state);

      // 20 cells exactly should still be viable (not > 20)
      // Height = 3 exactly (not > 3), field is flat (y=0,1 empty)
      expect(result.feasible).toBe(true);
      expect(result.notes).toContain("flat field");
      expect(result.scoreDelta).toBeGreaterThan(0);
    });

    it("should handle edge case of exactly height 3", () => {
      // For maxHeight to be exactly 3, highest block should be at y=2
      // Height calculation: (storageY - vanishRows + 1) = (5 - 3 + 1) = 3
      const height3Blocks = [
        { x: 0, y: 2 }, // Storage y=5, height = 3 (exactly at threshold)
      ];
      const height3Board = createBoardWithCells(height3Blocks);
      const state = createTestState({}, height3Board);

      const result = pcoTransition.preconditions(state);

      // Height of exactly 3 should still be viable (not > 3)
      // Field is flat (y=0,1 empty), so base PCO should pass
      expect(result.feasible).toBe(true);
      expect(result.notes).toContain("flat field");
      expect(result.scoreDelta).toBeGreaterThan(0);
    });

    it("should be consistent with multiple evaluations", () => {
      const state = createTestState();

      const result1 = pcoTransition.preconditions(state);
      const result2 = pcoTransition.preconditions(state);

      expect(result1).toEqual(result2);
    });
  });

  describe("Template Integration", () => {
    it("should work with existing template system", () => {
      const state = createTestState();

      for (const template of VARIANT_TEMPLATES) {
        expect(() => {
          template.preconditions(state);
          template.nextStep(state);
        }).not.toThrow();
      }
    });

    it("should maintain template interface compatibility", () => {
      const state = createTestState();

      for (const template of VARIANT_TEMPLATES) {
        const preconditions = template.preconditions(state);
        expect(preconditions).toHaveProperty("feasible");
        expect(preconditions).toHaveProperty("notes");
        expect(Array.isArray(preconditions.notes)).toBe(true);

        if (preconditions.scoreDelta !== undefined) {
          expect(typeof preconditions.scoreDelta).toBe("number");
        }

        const steps = template.nextStep(state);
        expect(Array.isArray(steps)).toBe(true);

        for (const step of steps) {
          expect(typeof step.when).toBe("function");
          expect(typeof step.propose).toBe("function");
          expect(typeof step.utility).toBe("function");
        }
      }
    });

    it("should be deterministic", () => {
      const state = createTestState();

      for (const template of VARIANT_TEMPLATES) {
        const result1 = template.preconditions(state);
        const result2 = template.preconditions(state);

        expect(result1).toEqual(result2);

        const steps1 = template.nextStep(state);
        const steps2 = template.nextStep(state);

        expect(steps1).toEqual(steps2);
      }
    });

    it("should handle various game states gracefully", () => {
      const testStates = [
        createTestState(),
        createTestState({ active: undefined }),
        createTestState({}, createBoardWithCells([{ x: 0, y: 20 }])),
      ];

      for (const template of VARIANT_TEMPLATES) {
        for (const state of testStates) {
          expect(() => {
            template.preconditions(state);
            template.nextStep(state);
          }).not.toThrow();
        }
      }
    });
  });

  describe("Score Delta Behavior", () => {
    it("should provide meaningful score deltas", () => {
      const state = createTestState();

      for (const template of VARIANT_TEMPLATES) {
        const result = template.preconditions(state);

        if (result.scoreDelta !== undefined) {
          expect(typeof result.scoreDelta).toBe("number");
          expect(result.scoreDelta).toBeGreaterThanOrEqual(-1.0);
          expect(result.scoreDelta).toBeLessThanOrEqual(1.0);
        }
      }
    });

    it("should correlate score deltas with notes", () => {
      const state = createTestState();

      for (const template of VARIANT_TEMPLATES) {
        const result = template.preconditions(state);

        if (result.scoreDelta !== undefined) {
          const hasPositiveNote = result.notes.some(
            (note) =>
              note.includes("clean") ||
              note.includes("viable") ||
              note.includes("good"),
          );
          const hasNegativeNote = result.notes.some(
            (note) =>
              note.includes("height") ||
              note.includes("unviable") ||
              note.includes("transition"),
          );

          if (result.scoreDelta > 0) {
            expect(hasPositiveNote).toBe(true);
          } else if (result.scoreDelta < 0) {
            expect(hasNegativeNote).toBe(true);
          }
        }
      }
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle malformed board data", () => {
      const baseBoard = createEmptyBoard();
      const malformedBoard = {
        ...baseBoard,
        cells: new Uint8Array(100).fill(0) as typeof baseBoard.cells,
      };

      const state = createTestState({}, malformedBoard);

      for (const template of VARIANT_TEMPLATES) {
        expect(() => {
          template.preconditions(state);
        }).not.toThrow();
      }
    });

    it("should handle extreme board configurations", () => {
      const fullBlocks = [];
      for (let x = 0; x < 10; x++) {
        for (let y = 20; y < 30; y++) {
          fullBlocks.push({ x, y });
        }
      }
      const fullBoard = createBoardWithCells(fullBlocks);
      const stateWithFullBoard = createTestState({}, fullBoard);

      for (const template of VARIANT_TEMPLATES) {
        const result = template.preconditions(stateWithFullBoard);
        expect(result).toHaveProperty("feasible");
        expect(result).toHaveProperty("notes");
        expect(Array.isArray(result.notes)).toBe(true);
      }
    });
  });
});

// Extract the nested utility function tests to separate test suites to reduce nesting
describe("Policy Template Variants - Edge Detection Utility", () => {
  // Helper to validate edge scenario results
  const validateEdgeScenario = (
    pcoEdge: Template,
    blocks: ReadonlyArray<{ x: number; y: number }>,
    expectedClean: boolean,
  ): void => {
    const board = createBoardWithCells(blocks);
    const state = createTestState({}, board);
    const result = pcoEdge.preconditions(state);

    const actualClean = result.scoreDelta === 0.35; // Base (0.2) + clean edges (0.15)
    expect(actualClean).toBe(expectedClean);
  };

  it("should work with various board configurations", () => {
    const pcoEdge = VARIANT_TEMPLATES.find((t) => t.id === "PCO/edge");
    if (!pcoEdge) {
      throw new Error("PCO/edge template not found");
    }

    const testCases = [
      { blocks: [], expectedClean: true },
      { blocks: [{ x: 4, y: 2 }], expectedClean: true },
      { blocks: [{ x: 0, y: 2 }], expectedClean: false },
      { blocks: [{ x: 9, y: 2 }], expectedClean: false },
      { blocks: [{ x: 2, y: 2 }], expectedClean: false },
      { blocks: [{ x: 7, y: 2 }], expectedClean: false },
      { blocks: [{ x: 3, y: 2 }], expectedClean: true },
      { blocks: [{ x: 6, y: 2 }], expectedClean: true },
    ];

    for (const testCase of testCases) {
      validateEdgeScenario(pcoEdge, testCase.blocks, testCase.expectedClean);
    }
  });
});

describe("Policy Template Variants - Viability Check Utility", () => {
  // Helper to validate viability scenario results
  const validateViabilityScenario = (
    pcoTransition: Template,
    blocks: ReadonlyArray<{ x: number; y: number }>,
    expectedViable: boolean,
  ): void => {
    const board = createBoardWithCells(blocks);
    const state = createTestState({}, board);
    const result = pcoTransition.preconditions(state);

    const expectedScoreDelta = expectedViable ? 0.3 : 0.0;

    expect(result.scoreDelta).toBeCloseTo(expectedScoreDelta, 1);
    expect(result.feasible).toBe(true);
  };

  it("should work with various cell counts and heights", () => {
    const pcoTransition = VARIANT_TEMPLATES.find(
      (t) => t.id === "PCO/transition",
    );
    if (!pcoTransition) {
      throw new Error("PCO/transition template not found");
    }

    const testCases = [
      { blocks: [], expectedViable: true },
      {
        blocks: [
          { x: 0, y: 2 },
          { x: 1, y: 2 },
        ],
        expectedViable: true,
      },
      {
        blocks: Array.from({ length: 10 }, (_, i) => ({ x: i, y: 2 })),
        expectedViable: true,
      },
      {
        blocks: Array.from({ length: 21 }, (_, i) => ({
          x: i % 10,
          y: 2 + Math.floor(i / 10),
        })),
        expectedViable: false,
      },
      {
        blocks: [
          { x: 0, y: 2 },
          { x: 0, y: 3 },
          { x: 0, y: 4 },
          { x: 0, y: 5 },
        ],
        expectedViable: false,
      },
    ];

    for (const testCase of testCases) {
      validateViabilityScenario(
        pcoTransition,
        testCase.blocks,
        testCase.expectedViable,
      );
    }
  });
});
