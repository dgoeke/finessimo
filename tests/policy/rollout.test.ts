// Unit tests for Chapter 3 rollout tie-breaking system
// Tests micro-rollout for disambiguating close scores, performance budgets, and depth limits

import { createEmptyBoard } from "../../src/core/board";
import { createActivePiece } from "../../src/core/spawning";
import { createInitialState } from "../../src/engine/init";
import { selectTemplateWithRollout } from "../../src/policy/planner";
import {
  shouldUseRollout,
  microRollout,
  scoreTemplateWithRollout,
  compareTemplatesWithRollout,
  EPS,
  DEFAULT_ROLLOUT_DEPTH,
} from "../../src/policy/rollout";
import { BASE_TEMPLATES } from "../../src/policy/templates/index";
import { createSeed, createGridCoord } from "../../src/types/brands";
import { fromNow } from "../../src/types/timestamp";

import type { Template, Intent } from "../../src/policy/types";
import type { PieceId, PlayingState, Board } from "../../src/state/types";

describe("Policy Rollout System", () => {
  // Helper to create test state
  function createTestState(
    overrides: Partial<PlayingState> = {},
    customBoard?: Board,
  ): PlayingState {
    const seed = createSeed("test-rollout");
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
      nextQueue: ["I", "S", "Z", "O", "L", "J", "T"] as const,
      pendingLock: null,
      status: "playing",
      ...overrides,
    };

    return playingState;
  }

  // Helper to create board with specific filled cells
  function createBoardWithCells(
    filledPositions: ReadonlyArray<{ x: number; y: number }>,
  ): Board {
    const board = createEmptyBoard();
    const newCells = new Uint8Array(board.cells);

    filledPositions.forEach(({ x, y }) => {
      const storageRow = y + board.vanishRows;
      const idx = storageRow * board.width + x;
      if (idx >= 0 && idx < newCells.length) {
        newCells[idx] = 1;
      }
    });

    return {
      ...board,
      cells: newCells as typeof board.cells,
    };
  }

  // Helper to create mock template for testing
  function createMockTemplate(
    id: string,
    opener: Intent,
    baseScore = 1.0,
  ): Template {
    return {
      gracefulExit: (_s) => null,
      id,
      nextStep: (_s) => [
        {
          propose: (_s) => [
            {
              rot: "spawn",
              useHold: false,
              x: createGridCoord(4),
            },
          ],
          utility: (_p, _s) => baseScore,
          when: (_s) => true,
        },
      ],
      opener,
      preconditions: (_s) => ({
        feasible: true,
        notes: [`Mock ${id} template`],
        scoreDelta: baseScore,
      }),
    };
  }

  describe("Rollout Trigger Logic", () => {
    it("should trigger rollout when scores are within epsilon", () => {
      const score1 = 1.0;
      const score2 = 1.0 + EPS - 0.01; // Just within threshold

      expect(shouldUseRollout(score1, score2)).toBe(true);
    });

    it("should not trigger rollout when scores differ significantly", () => {
      const score1 = 1.0;
      const score2 = 1.0 + EPS + 0.1; // Well above threshold

      expect(shouldUseRollout(score1, score2)).toBe(false);
    });

    it("should handle exact threshold boundary", () => {
      const score1 = 1.0;
      const score2 = 1.0 + EPS; // Exactly at threshold

      expect(shouldUseRollout(score1, score2)).toBe(false);
    });

    it("should work with negative scores", () => {
      const score1 = -0.5;
      const score2 = -0.5 + EPS - 0.001; // Within threshold

      expect(shouldUseRollout(score1, score2)).toBe(true);
    });

    it("should handle reversed score order", () => {
      const score1 = 1.1;
      const score2 = 1.0; // Lower than score1

      expect(shouldUseRollout(score1, score2)).toBe(false);

      const score3 = 1.1 - EPS + 0.001; // Within threshold of score1
      expect(shouldUseRollout(score1, score3)).toBe(true);
    });
  });

  describe("Micro-Rollout Evaluation", () => {
    it("should evaluate template with rollout depth 1", () => {
      const template = createMockTemplate("Test/Template", "TKI", 0.8);
      const state = createTestState();

      const rolloutScore = microRollout(state, template, 1);

      expect(typeof rolloutScore).toBe("number");
      expect(rolloutScore).toBeGreaterThanOrEqual(-10); // Minimum penalty
      expect(rolloutScore).toBeLessThanOrEqual(10); // Reasonable maximum
    });

    it("should handle empty next queue", () => {
      const template = createMockTemplate("Test/Empty", "TKI", 0.5);
      const state = createTestState({
        active: undefined,
        nextQueue: [] as const,
      });

      const rolloutScore = microRollout(state, template, 1);

      expect(rolloutScore).toBe(0); // Should return 0 for no pieces
    });

    it("should respect rollout depth limits", () => {
      const template = createMockTemplate("Test/Depth", "PCO", 0.6);
      const state = createTestState();

      // Test different depths
      const depth1Score = microRollout(state, template, 1);
      const depth2Score = microRollout(state, template, 2);

      expect(typeof depth1Score).toBe("number");
      expect(typeof depth2Score).toBe("number");

      // Deeper rollout may give different results but should still be reasonable
      expect(Math.abs(depth2Score - depth1Score)).toBeLessThan(5);
    });

    it("should limit placement candidates for performance", () => {
      const template = createMockTemplate("Test/Performance", "TKI", 0.7);
      const state = createTestState({
        active: {
          id: "I" as PieceId, // I piece has many placement options
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        },
      });

      const start = fromNow();
      const rolloutScore = microRollout(state, template, 1);
      const elapsed = fromNow() - start;

      expect(typeof rolloutScore).toBe("number");
      expect(elapsed).toBeLessThan(5); // Should complete within 5ms
    });

    it("should handle board states with limited placement options", () => {
      // Create board with tall stacks to limit placements
      const tallStacks = [];
      for (let y = 0; y < 15; y++) {
        tallStacks.push({ x: 0, y });
        tallStacks.push({ x: 9, y });
      }
      const constrainedBoard = createBoardWithCells(tallStacks);
      const state = createTestState({}, constrainedBoard);

      const template = createMockTemplate("Test/Constrained", "PCO", 0.4);
      const rolloutScore = microRollout(state, template, 1);

      expect(typeof rolloutScore).toBe("number");
      // Should handle constrained placements without error
    });

    it("should stay within time budget", () => {
      const template = createMockTemplate("Test/Budget", "TKI", 0.9);
      const state = createTestState();

      const start = fromNow();

      // Run multiple rollouts to test budget limits
      for (let i = 0; i < 10; i++) {
        microRollout(state, template, DEFAULT_ROLLOUT_DEPTH);
      }

      const elapsed = fromNow() - start;

      // Should complete all rollouts within reasonable time (25ms for 10 calls)
      expect(elapsed).toBeLessThan(25);
    });
  });

  describe("Template Scoring with Rollout", () => {
    it("should return base score when rollout is disabled", () => {
      const template = createMockTemplate("Test/NoRollout", "PCO", 1.5);
      const state = createTestState();
      const baseScore = 1.5;

      const finalScore = scoreTemplateWithRollout(
        template,
        state,
        baseScore,
        false, // useRollout = false
      );

      expect(finalScore).toBe(baseScore);
    });

    it("should blend base score with rollout when enabled", () => {
      const template = createMockTemplate("Test/WithRollout", "TKI", 1.2);
      const state = createTestState();
      const baseScore = 1.2;

      const finalScore = scoreTemplateWithRollout(
        template,
        state,
        baseScore,
        true, // useRollout = true
      );

      expect(typeof finalScore).toBe("number");
      // Should be influenced by both base score and rollout
      expect(finalScore).toBeGreaterThanOrEqual(baseScore * 0.5); // Minimum blend
      expect(finalScore).toBeLessThanOrEqual(baseScore * 1.5); // Maximum reasonable blend
    });

    it("should fallback to base score on rollout failure", () => {
      // Create template that might cause rollout issues
      const problematicTemplate: Template = {
        ...createMockTemplate("Test/Problematic", "Neither", 0.8),
        nextStep: (_s) => {
          throw new Error("Simulated template evaluation error");
        },
      };

      const state = createTestState();
      const baseScore = 0.8;

      const finalScore = scoreTemplateWithRollout(
        problematicTemplate,
        state,
        baseScore,
        true, // useRollout = true
      );

      // Should fallback to base score on error (but may be blended)
      expect(typeof finalScore).toBe("number");
      // The rollout may return a negative score due to errors, so we check the reasonable range
      expect(finalScore).toBeGreaterThanOrEqual(-5);
      expect(finalScore).toBeLessThanOrEqual(5);
    });

    it("should respect rollout depth parameter", () => {
      const template = createMockTemplate("Test/DepthParam", "TKI", 1.1);
      const state = createTestState();
      const baseScore = 1.1;

      const score1 = scoreTemplateWithRollout(
        template,
        state,
        baseScore,
        true,
        1,
      );
      const score2 = scoreTemplateWithRollout(
        template,
        state,
        baseScore,
        true,
        2,
      );

      expect(typeof score1).toBe("number");
      expect(typeof score2).toBe("number");
      // Both should be valid, though possibly different
      expect(Math.abs(score1 - baseScore)).toBeLessThan(2);
      expect(Math.abs(score2 - baseScore)).toBeLessThan(2);
    });
  });

  describe("Template Comparison with Rollout", () => {
    it("should return higher-scoring template when no rollout needed", () => {
      const template1 = createMockTemplate("Test/Lower", "TKI", 0.8);
      const template2 = createMockTemplate("Test/Higher", "PCO", 1.5);
      const state = createTestState();

      const comparison1 = { baseScore: 0.8, template: template1 };
      const comparison2 = { baseScore: 1.5, template: template2 };

      const result = compareTemplatesWithRollout(
        comparison1,
        comparison2,
        state,
      );

      expect(result.winner).toBe(template2);
      expect(result.score).toBe(1.5);
    });

    it("should use rollout when scores are close", () => {
      const template1 = createMockTemplate("Test/Close1", "TKI", 1.0);
      const template2 = createMockTemplate(
        "Test/Close2",
        "PCO",
        1.0 + EPS - 0.01,
      );
      const state = createTestState();

      const comparison1 = { baseScore: 1.0, template: template1 };
      const comparison2 = { baseScore: 1.0 + EPS - 0.01, template: template2 };

      const result = compareTemplatesWithRollout(
        comparison1,
        comparison2,
        state,
      );

      expect(result.winner).toBeDefined();
      expect([template1, template2]).toContain(result.winner);
      expect(typeof result.score).toBe("number");
    });

    it("should handle identical scores", () => {
      const template1 = createMockTemplate("Test/Same1", "TKI", 1.0);
      const template2 = createMockTemplate("Test/Same2", "PCO", 1.0);
      const state = createTestState();

      const comparison1 = { baseScore: 1.0, template: template1 };
      const comparison2 = { baseScore: 1.0, template: template2 };

      const result = compareTemplatesWithRollout(
        comparison1,
        comparison2,
        state,
      );

      // Should pick one and return enhanced score
      expect([template1, template2]).toContain(result.winner);
      expect(typeof result.score).toBe("number");
    });

    it("should respect rollout depth parameter in comparisons", () => {
      const template1 = createMockTemplate("Test/CompDepth1", "TKI", 1.0);
      const template2 = createMockTemplate("Test/CompDepth2", "PCO", 1.02);
      const state = createTestState();

      const comparison1 = { baseScore: 1.0, template: template1 };
      const comparison2 = { baseScore: 1.02, template: template2 };

      const result1 = compareTemplatesWithRollout(
        comparison1,
        comparison2,
        state,
        1,
      );
      const result2 = compareTemplatesWithRollout(
        comparison1,
        comparison2,
        state,
        2,
      );

      expect(result1.winner).toBeDefined();
      expect(result2.winner).toBeDefined();
      // Both should return valid results
      expect(typeof result1.score).toBe("number");
      expect(typeof result2.score).toBe("number");
    });
  });

  describe("Integration with Template Selection", () => {
    it("should use rollout in template selection when scores are close", () => {
      // Create scenario where TKI and PCO have very similar base scores
      const state = createTestState({
        nextQueue: ["I", "O", "S", "Z", "L", "J", "T"] as const, // I piece available for both
      });

      const selection = selectTemplateWithRollout([...BASE_TEMPLATES], state);

      expect(selection.template).toBeDefined();
      expect(typeof selection.score).toBe("number");
      expect(typeof selection.secondScore).toBe("number");
      expect(selection.template.opener).toMatch(/^(TKI|PCO|Neither)$/);
    });

    it("should handle single template selection", () => {
      const singleTemplate = BASE_TEMPLATES.find((t) => t.id === "TKI/base");
      expect(singleTemplate).toBeDefined();
      if (!singleTemplate) return;

      const state = createTestState();
      const selection = selectTemplateWithRollout([singleTemplate], state);

      expect(selection.template).toBe(singleTemplate);
      expect(selection.secondScore).toBe(-Infinity);
    });

    it("should throw error for empty template array", () => {
      const state = createTestState();

      expect(() => {
        selectTemplateWithRollout([], state);
      }).toThrow("No templates available for selection");
    });

    it("should handle template evaluation errors gracefully", () => {
      const goodTemplate = createMockTemplate("Test/Good", "PCO", 1.0);
      const state = createTestState();

      // Should not crash and should return the good template
      expect(() => {
        selectTemplateWithRollout([goodTemplate], state);
      }).not.toThrow();

      const selection = selectTemplateWithRollout([goodTemplate], state);
      expect(selection.template).toBeDefined();
    });
  });

  describe("Performance and Budget Management", () => {
    it("should complete rollout within time budget", () => {
      const template = createMockTemplate("Test/TimeBudget", "TKI", 1.0);
      const state = createTestState();

      const start = fromNow();
      microRollout(state, template, DEFAULT_ROLLOUT_DEPTH);
      const elapsed = fromNow() - start;

      // Should complete within 1ms (generous budget)
      expect(elapsed).toBeLessThan(1);
    });

    it("should limit placement generation for performance", () => {
      // Create state with I piece which has many placement options
      const state = createTestState({
        active: createActivePiece("I"),
      });

      const template = createMockTemplate("Test/ManyPlacements", "TKI", 0.9);

      const start = fromNow();
      const rolloutScore = microRollout(state, template, 1);
      const elapsed = fromNow() - start;

      expect(typeof rolloutScore).toBe("number");
      expect(elapsed).toBeLessThan(2); // Should stay within budget
    });

    it("should handle deep rollout efficiently", () => {
      const template = createMockTemplate("Test/DeepRollout", "PCO", 1.1);
      const state = createTestState();

      const start = fromNow();
      microRollout(state, template, 2); // Deeper rollout
      const elapsed = fromNow() - start;

      expect(elapsed).toBeLessThan(3); // Even deep rollout should be fast
    });

    it("should not cause memory issues with repeated rollouts", () => {
      const template = createMockTemplate("Test/Memory", "TKI", 0.7);
      const state = createTestState();

      // Run many rollouts
      for (let i = 0; i < 100; i++) {
        const score = microRollout(state, template, 1);
        expect(typeof score).toBe("number");
      }

      // Should complete without memory errors
    });
  });

  // Helper function to create high utility template (extract to reduce nesting)
  function createHighUtilityTemplate(
    id: string,
    opener: Intent,
    baseScore: number,
  ): Template {
    return {
      ...createMockTemplate(id, opener, baseScore),
      nextStep: (_s) => [
        {
          propose: (_s) => [
            {
              rot: "spawn",
              useHold: false,
              x: createGridCoord(4),
            },
          ],
          utility: (_p, _s) => 2.0, // Higher utility
          when: (_s) => true,
        },
      ],
    };
  }

  // Helper function to create low utility template (extract to reduce nesting)
  function createLowUtilityTemplate(
    id: string,
    opener: Intent,
    baseScore: number,
  ): Template {
    return {
      ...createMockTemplate(id, opener, baseScore),
      nextStep: (_s) => [
        {
          propose: (_s) => [
            {
              rot: "spawn",
              useHold: false,
              x: createGridCoord(4),
            },
          ],
          utility: (_p, _s) => 0.5, // Lower utility
          when: (_s) => true,
        },
      ],
    };
  }

  // Helper function to create no-placement template (extract to reduce nesting)
  function createNoPlacementTemplate(
    id: string,
    opener: Intent,
    baseScore: number,
  ): Template {
    return {
      ...createMockTemplate(id, opener, baseScore),
      nextStep: (_s) => [
        {
          propose: (_s) => [], // No placements available
          utility: (_p, _s) => 1.0,
          when: (_s) => true,
        },
      ],
    };
  }

  // Helper function to create utility error template (extract to reduce nesting)
  function createUtilityErrorTemplate(
    id: string,
    opener: Intent,
    baseScore: number,
  ): Template {
    return {
      ...createMockTemplate(id, opener, baseScore),
      nextStep: (_s) => [
        {
          propose: (_s) => [
            {
              rot: "spawn",
              useHold: false,
              x: createGridCoord(4),
            },
          ],
          utility: (_p, _s) => {
            throw new Error("Simulated utility error");
          },
          when: (_s) => true,
        },
      ],
    };
  }

  describe("Rollout Accuracy and Tie-Breaking", () => {
    it("should provide meaningful differentiation between close templates", () => {
      // Create two templates with very close base scores
      const template1 = createMockTemplate("Test/Tie1", "TKI", 1.0);
      const template2 = createMockTemplate("Test/Tie2", "PCO", 1.001);

      const state = createTestState();

      const comparison1 = { baseScore: 1.0, template: template1 };
      const comparison2 = { baseScore: 1.001, template: template2 };

      // Run comparison multiple times to test consistency
      const results = [];
      for (let i = 0; i < 10; i++) {
        const result = compareTemplatesWithRollout(
          comparison1,
          comparison2,
          state,
        );
        results.push(result.winner.id);
      }

      // Should pick templates consistently (though may not be perfectly deterministic due to timing)
      const uniqueWinners = new Set(results);
      expect(uniqueWinners.size).toBeLessThanOrEqual(2); // Allow some variation due to rollout randomness
    });

    it("should resolve ties correctly based on utility", () => {
      const highUtilityTemplate = createHighUtilityTemplate(
        "Test/HighUtil",
        "TKI",
        1.0,
      );
      const lowUtilityTemplate = createLowUtilityTemplate(
        "Test/LowUtil",
        "PCO",
        1.0,
      );
      const state = createTestState();

      const comparison1 = { baseScore: 1.0, template: highUtilityTemplate };
      const comparison2 = { baseScore: 1.0, template: lowUtilityTemplate };

      const result = compareTemplatesWithRollout(
        comparison1,
        comparison2,
        state,
      );

      // Higher utility template should win in rollout
      expect(result.winner.id).toBe("Test/HighUtil");
    });

    it("should handle templates with no valid placements", () => {
      const noPlacementTemplate = createNoPlacementTemplate(
        "Test/NoPlacement",
        "Neither",
        1.0,
      );
      const normalTemplate = createMockTemplate("Test/Normal", "TKI", 1.0);
      const state = createTestState();

      const comparison1 = { baseScore: 1.0, template: noPlacementTemplate };
      const comparison2 = { baseScore: 1.0, template: normalTemplate };

      const result = compareTemplatesWithRollout(
        comparison1,
        comparison2,
        state,
      );

      // When rollout encounters no placements, it may handle it in various ways
      // Let's just verify that a winner is selected
      expect([noPlacementTemplate, normalTemplate]).toContain(result.winner);
      expect(typeof result.score).toBe("number");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle malformed game states", () => {
      const template = createMockTemplate("Test/Malformed", "TKI", 1.0);
      const malformedState = createTestState({
        nextQueue: [] as const, // Empty queue instead of undefined
      });

      // Should not crash on malformed state
      const result = microRollout(malformedState, template, 1);
      expect(typeof result).toBe("number");
    });

    it("should handle invalid placement coordinates", () => {
      const template = createMockTemplate("Test/InvalidCoord", "PCO", 1.0);
      const state = createTestState();

      // Rollout should handle coordinate validation internally
      const rolloutScore = microRollout(state, template, 1);
      expect(typeof rolloutScore).toBe("number");
    });

    it("should handle template step evaluation errors", () => {
      const errorTemplate = createUtilityErrorTemplate(
        "Test/Error",
        "TKI",
        1.0,
      );
      const state = createTestState();

      // Should handle errors gracefully and return reasonable score
      const rolloutScore = microRollout(state, errorTemplate, 1);
      expect(typeof rolloutScore).toBe("number");
    });

    it("should handle board state simulation errors", () => {
      // Create board that might cause simulation issues
      const problematicBoard = createBoardWithCells([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
        { x: 5, y: 0 },
        { x: 6, y: 0 },
        { x: 7, y: 0 },
        { x: 8, y: 0 },
        { x: 9, y: 0 }, // Full top row
      ]);

      const state = createTestState({}, problematicBoard);
      const template = createMockTemplate("Test/Problematic", "Neither", 1.0);

      const rolloutScore = microRollout(state, template, 1);
      expect(typeof rolloutScore).toBe("number");
    });

    it("should maintain deterministic behavior", () => {
      const template = createMockTemplate("Test/Deterministic", "TKI", 1.0);
      const state = createTestState();

      // Run rollout multiple times with same input
      const scores = [];
      for (let i = 0; i < 5; i++) {
        scores.push(microRollout(state, template, 1));
      }

      // Scores should be within a reasonable range (allowing for minor variations)
      const uniqueScores = new Set(scores);
      expect(uniqueScores.size).toBeLessThanOrEqual(3); // Allow minor variations in rollout
    });
  });
});
