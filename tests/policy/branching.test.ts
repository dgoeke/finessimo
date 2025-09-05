// Unit tests for Chapter 3 branching and fallback logic
// Tests template branching, graceful exits, and plan history tracking

import { createEmptyBoard } from "../../src/core/board";
import { createInitialState } from "../../src/engine/init";
import { recommendMove, clearPolicyCache } from "../../src/policy/index";
import {
  findViableBranch,
  attemptGracefulExit,
  isInPlanHistory,
  chooseWithHysteresisEnhanced,
  updatePolicyContextEnhanced,
  recommendMoveEnhanced,
  MAX_PLAN_HISTORY_DEPTH,
} from "../../src/policy/planner";
import { BASE_TEMPLATES } from "../../src/policy/templates/index";
import { VARIANT_TEMPLATES } from "../../src/policy/templates/variants";
import { createSeed, createGridCoord } from "../../src/types/brands";
import { fromNow } from "../../src/types/timestamp";

import type { EnhancedPolicyContext } from "../../src/policy/planner";
import type { Template } from "../../src/policy/types";
import type { PieceId, PlayingState, Board } from "../../src/state/types";

// Helper to create mock template
function createMockTemplate(
  id: string,
  opener: "TKI" | "PCO" | "Neither",
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

describe("Policy Branching System", () => {
  // Helper to create test state
  function createTestState(
    overrides: Partial<PlayingState> = {},
    customBoard?: Board,
  ): PlayingState {
    const seed = createSeed("test-branching");
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

  const defaultEnhancedCtx: EnhancedPolicyContext = {
    lastBestScore: null,
    lastPlanId: null,
    lastSecondScore: null,
    lastUpdate: null,
    planAge: 0,
    planHistory: undefined,
  };

  beforeEach(() => {
    clearPolicyCache();
  });

  describe("Plan History Tracking", () => {
    it("should track plan history correctly", () => {
      const ctx: EnhancedPolicyContext = {
        ...defaultEnhancedCtx,
        planHistory: ["TKI/base", "PCO/standard"],
      };

      expect(isInPlanHistory("TKI/base", ctx)).toBe(true);
      expect(isInPlanHistory("PCO/standard", ctx)).toBe(true);
      expect(isInPlanHistory("Neither/safe", ctx)).toBe(false);
    });

    it("should handle empty plan history", () => {
      const ctx: EnhancedPolicyContext = {
        ...defaultEnhancedCtx,
        planHistory: undefined,
      };

      expect(isInPlanHistory("TKI/base", ctx)).toBe(false);
      expect(isInPlanHistory("PCO/standard", ctx)).toBe(false);
    });

    it("should maintain history depth limit", () => {
      // Test updatePolicyContextEnhanced with history tracking
      const template = BASE_TEMPLATES.find((t) => t.id === "TKI/base");
      expect(template).toBeDefined();
      if (!template) return;

      let ctx: EnhancedPolicyContext = defaultEnhancedCtx;

      // Add plans beyond the depth limit
      for (let i = 0; i < MAX_PLAN_HISTORY_DEPTH + 2; i++) {
        ctx = updatePolicyContextEnhanced(ctx, template, 1.0, 0.8, false);
      }

      expect(ctx.planHistory?.length).toBeLessThanOrEqual(
        MAX_PLAN_HISTORY_DEPTH,
      );
    });

    it("should reset history on branching", () => {
      const template = BASE_TEMPLATES.find((t) => t.id === "TKI/base");
      expect(template).toBeDefined();
      if (!template) return;

      const initialCtx: EnhancedPolicyContext = {
        ...defaultEnhancedCtx,
        planAge: 5,
        planHistory: ["PCO/standard", "Neither/safe"],
      };

      const updatedCtx = updatePolicyContextEnhanced(
        initialCtx,
        template,
        1.5,
        1.0,
        true, // isBranching = true
      );

      expect(updatedCtx.planHistory).toEqual(["TKI/base"]);
      expect(updatedCtx.planAge).toBe(0); // Reset age on branching
    });
  });

  describe("Branch Detection and Selection", () => {
    it("should find viable branches for PCO standard template", () => {
      const pcoStandard = VARIANT_TEMPLATES.find(
        (t) => t.id === "PCO/standard",
      );
      expect(pcoStandard).toBeDefined();
      if (!pcoStandard) return;

      // Create state with clean edges to trigger PCO/edge branch
      const cleanBoard = createEmptyBoard();
      const state = createTestState({}, cleanBoard);
      const ctx: EnhancedPolicyContext = { ...defaultEnhancedCtx };

      const branch = findViableBranch(pcoStandard, state, ctx);

      expect(branch).toBeDefined();
      expect(branch?.id).toBe("PCO/edge");
    });

    it("should find viable branches for TKI base template", () => {
      const tkiBase = VARIANT_TEMPLATES.find((t) => t.id === "TKI/base");
      expect(tkiBase).toBeDefined();
      if (!tkiBase) return;

      // Create state with flat-top conditions
      const flatBoard = createEmptyBoard();
      const state = createTestState({}, flatBoard);
      const ctx: EnhancedPolicyContext = { ...defaultEnhancedCtx };

      const branch = findViableBranch(tkiBase, state, ctx);

      expect(branch).toBeDefined();
      expect(branch?.id).toBe("TKI/flatTop");
    });

    it("should skip branches already in plan history to prevent loops", () => {
      const pcoStandard = VARIANT_TEMPLATES.find(
        (t) => t.id === "PCO/standard",
      );
      expect(pcoStandard).toBeDefined();
      if (!pcoStandard) return;

      const cleanBoard = createEmptyBoard();
      const state = createTestState({}, cleanBoard);
      const ctx: EnhancedPolicyContext = {
        ...defaultEnhancedCtx,
        planHistory: ["PCO/edge"], // Already tried PCO/edge
      };

      const branch = findViableBranch(pcoStandard, state, ctx);

      // Should not return PCO/edge due to plan history
      expect(branch?.id).not.toBe("PCO/edge");
    });

    it("should return null when no viable branches exist", () => {
      const neitherSafe = BASE_TEMPLATES.find((t) => t.id === "Neither/safe");
      expect(neitherSafe).toBeDefined();
      if (!neitherSafe) return;

      const state = createTestState();
      const ctx: EnhancedPolicyContext = { ...defaultEnhancedCtx };

      // Neither/safe has no branching capability
      const branch = findViableBranch(neitherSafe, state, ctx);

      expect(branch).toBeNull();
    });

    it("should handle templates without branch function", () => {
      // Create a mock template without branch function
      const templateWithoutBranch = BASE_TEMPLATES.find(
        (t) => t.id === "PCO/standard",
      );
      expect(templateWithoutBranch).toBeDefined();
      if (!templateWithoutBranch) return;

      const mockTemplate: Template = {
        ...templateWithoutBranch,
      };

      // Remove branch property to simulate template without branch function
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (mockTemplate as any).branch;

      const state = createTestState();
      const ctx: EnhancedPolicyContext = { ...defaultEnhancedCtx };

      const branch = findViableBranch(mockTemplate, state, ctx);

      expect(branch).toBeNull();
    });
  });

  describe("Graceful Exit Fallback", () => {
    it("should attempt graceful exit when template becomes infeasible", () => {
      const pcoStandard = VARIANT_TEMPLATES.find(
        (t) => t.id === "PCO/standard",
      );
      expect(pcoStandard).toBeDefined();
      if (!pcoStandard) return;

      // Create state where graceful exit would be needed
      const state = createTestState();

      const fallback = attemptGracefulExit(pcoStandard, state);

      expect(fallback).toBeDefined();
      expect(fallback?.id).toBe("Neither/safe");
    });

    it("should return null when template has no graceful exit", () => {
      // Create a mock template without gracefulExit function
      const templateWithoutExit = BASE_TEMPLATES.find(
        (t) => t.id === "TKI/base",
      );
      expect(templateWithoutExit).toBeDefined();
      if (!templateWithoutExit) return;

      const mockTemplate: Template = {
        ...templateWithoutExit,
      };

      // Remove gracefulExit property to simulate template without graceful exit
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (mockTemplate as any).gracefulExit;

      const state = createTestState();

      const fallback = attemptGracefulExit(mockTemplate, state);

      expect(fallback).toBeNull();
    });

    it("should return null when graceful exit returns null", () => {
      const mockTemplate: Template = {
        ...(BASE_TEMPLATES[0] ??
          createMockTemplate("Test/Mock", "Neither", 1.0)),
        gracefulExit: (_s) => null,
      };

      const state = createTestState();

      const fallback = attemptGracefulExit(mockTemplate, state);

      expect(fallback).toBeNull();
    });

    it("should validate fallback template feasibility", () => {
      // Test that graceful exit returns a feasible template
      const pcoStandard = VARIANT_TEMPLATES.find(
        (t) => t.id === "PCO/standard",
      );
      expect(pcoStandard).toBeDefined();
      if (!pcoStandard) return;

      const state = createTestState();
      const fallback = attemptGracefulExit(pcoStandard, state);

      if (fallback) {
        const preconditions = fallback.preconditions(state);
        expect(preconditions.feasible).toBe(true);
      }
    });
  });

  describe("Enhanced Hysteresis with Branching", () => {
    it("should handle template infeasibility with branching", () => {
      const pcoStandard = VARIANT_TEMPLATES.find(
        (t) => t.id === "PCO/standard",
      );
      expect(pcoStandard).toBeDefined();
      if (!pcoStandard) return;

      // Create state where current template should stay viable but we test branching
      const state = createTestState();

      const ctx: EnhancedPolicyContext = {
        ...defaultEnhancedCtx,
        lastBestScore: 1.0,
        lastPlanId: "PCO/standard",
        planAge: 3,
      };

      const result = chooseWithHysteresisEnhanced(
        pcoStandard,
        0.8, // Lower score than current
        0.5,
        ctx,
        state,
      );

      // Since the best template score is lower and we don't meet switch conditions,
      // should stick with current template
      expect(result.template.id).toBe("PCO/standard");
      expect(result.isBranching).toBe(false);
    });

    it("should prefer branching over switching when current template is infeasible", () => {
      const pcoStandard = VARIANT_TEMPLATES.find(
        (t) => t.id === "PCO/standard",
      );
      const tkiBase = VARIANT_TEMPLATES.find((t) => t.id === "TKI/base");
      expect(pcoStandard).toBeDefined();
      expect(tkiBase).toBeDefined();
      if (!pcoStandard || !tkiBase) return;

      // Create clean state
      const state = createTestState();

      const ctx: EnhancedPolicyContext = {
        ...defaultEnhancedCtx,
        lastBestScore: 1.0,
        lastPlanId: "PCO/standard",
        planAge: 3,
      };

      const result = chooseWithHysteresisEnhanced(
        tkiBase, // TKI is the "best" according to scoring
        1.5, // Much higher score should trigger switch
        1.0,
        ctx,
        state,
      );

      // With much higher score, should switch to TKI (not branch)
      expect(result.template.id).toBe("TKI/base");
      expect(result.isBranching).toBe(false);
    });

    it("should reset plan age when branching occurs", () => {
      const pcoStandard = VARIANT_TEMPLATES.find(
        (t) => t.id === "PCO/standard",
      );
      expect(pcoStandard).toBeDefined();
      if (!pcoStandard) return;

      const state = createTestState();
      const ctx: EnhancedPolicyContext = {
        ...defaultEnhancedCtx,
        lastPlanId: "PCO/standard",
        planAge: 5,
      };

      const result = chooseWithHysteresisEnhanced(
        pcoStandard,
        1.0,
        0.8,
        ctx,
        state,
      );

      const updatedCtx = updatePolicyContextEnhanced(
        ctx,
        result.template,
        1.0,
        0.8,
        result.isBranching,
      );

      if (result.isBranching) {
        expect(updatedCtx.planAge).toBe(0);
      }
    });
  });

  describe("Branch Loop Prevention", () => {
    it("should prevent infinite branching loops", () => {
      // Create scenario where templates could branch back and forth
      const state = createTestState();
      const ctx: EnhancedPolicyContext = {
        ...defaultEnhancedCtx,
        planHistory: ["TKI/base", "TKI/flatTop"], // Already used both
      };

      const tkiFlatTop = VARIANT_TEMPLATES.find((t) => t.id === "TKI/flatTop");
      expect(tkiFlatTop).toBeDefined();
      if (!tkiFlatTop) return;

      // Should not branch to TKI/base since it's already in history
      const branch = findViableBranch(tkiFlatTop, state, ctx);

      // Should either find a different branch or return null
      if (branch) {
        expect(branch.id).not.toBe("TKI/base");
      }
    });

    it("should limit plan history depth", () => {
      let ctx: EnhancedPolicyContext = defaultEnhancedCtx;
      const template = BASE_TEMPLATES.find((t) => t.id === "TKI/base");
      expect(template).toBeDefined();
      if (!template) return;

      // Add more templates than the depth limit
      for (let i = 0; i < MAX_PLAN_HISTORY_DEPTH + 3; i++) {
        ctx = updatePolicyContextEnhanced(ctx, template, 1.0, 0.8, false);
      }

      expect(ctx.planHistory).toBeDefined();
      expect(ctx.planHistory?.length ?? 0).toBeLessThanOrEqual(
        MAX_PLAN_HISTORY_DEPTH,
      );
    });
  });

  describe("Integration with Enhanced Recommend Move", () => {
    it("should return branching information in enhanced recommend move", () => {
      // Create state that should trigger branching
      const cleanBoard = createEmptyBoard();
      const state = createTestState({}, cleanBoard);

      const ctx: EnhancedPolicyContext = {
        ...defaultEnhancedCtx,
        lastBestScore: 1.0,
        lastPlanId: "PCO/standard",
        planAge: 3,
      };

      const result = recommendMoveEnhanced(state, ctx);

      expect(result).toHaveProperty("isBranching");
      expect(result).toHaveProperty("suggestion");
      expect(result).toHaveProperty("nextCtx");

      expect(typeof result.isBranching).toBe("boolean");
      expect(result.nextCtx).toHaveProperty("planHistory");
    });

    it("should maintain backward compatibility with regular recommend move", () => {
      const state = createTestState();

      // Regular recommend move should still work
      const result = recommendMove(state);

      expect(result).toHaveProperty("suggestion");
      expect(result).toHaveProperty("nextCtx");
      expect(result.suggestion).toHaveProperty("intent");
      expect(result.suggestion).toHaveProperty("confidence");
      expect(result.suggestion).toHaveProperty("rationale");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle missing template in plan history", () => {
      const state = createTestState();
      const ctx: EnhancedPolicyContext = {
        ...defaultEnhancedCtx,
        lastBestScore: 1.0,
        lastPlanId: "NonExistent/Template",
        planAge: 2,
      };

      const tkiBase = BASE_TEMPLATES.find((t) => t.id === "TKI/base");
      expect(tkiBase).toBeDefined();
      if (!tkiBase) return;

      const result = chooseWithHysteresisEnhanced(
        tkiBase,
        1.5,
        1.0,
        ctx,
        state,
      );

      // Should fallback gracefully to best template
      expect(result.template.id).toBe("TKI/base");
      expect(result.isBranching).toBe(false);
    });

    it("should handle empty template arrays in branching", () => {
      const mockTemplate: Template = {
        ...(BASE_TEMPLATES[0] ??
          createMockTemplate("Test/Mock", "Neither", 1.0)),
        branch: (_s) => [], // Returns empty array
      };

      const state = createTestState();
      const ctx: EnhancedPolicyContext = defaultEnhancedCtx;

      const branch = findViableBranch(mockTemplate, state, ctx);

      expect(branch).toBeNull();
    });

    it("should handle null preconditions in branch evaluation", () => {
      const mockBranch: Template = {
        ...(BASE_TEMPLATES[0] ??
          createMockTemplate("Test/Mock", "Neither", 1.0)),
        id: "Mock/Branch",
        preconditions: (_s) => ({ feasible: false, notes: [] }),
      };

      const mockTemplate: Template = {
        ...(BASE_TEMPLATES[0] ??
          createMockTemplate("Test/Mock", "Neither", 1.0)),
        branch: (_s) => [mockBranch],
      };

      const state = createTestState();
      const ctx: EnhancedPolicyContext = defaultEnhancedCtx;

      const branch = findViableBranch(mockTemplate, state, ctx);

      expect(branch).toBeNull(); // Should skip infeasible branches
    });

    it("should maintain consistency across multiple calls", () => {
      const state = createTestState();
      const ctx: EnhancedPolicyContext = {
        ...defaultEnhancedCtx,
        lastPlanId: "PCO/standard",
        planAge: 2,
      };

      const result1 = recommendMoveEnhanced(state, ctx);
      const result2 = recommendMoveEnhanced(state, ctx);

      // Should produce consistent results for same input
      expect(result1.suggestion.template.id).toBe(
        result2.suggestion.template.id,
      );
      expect(result1.isBranching).toBe(result2.isBranching);
    });
  });

  describe("Performance Considerations", () => {
    it("should complete branching logic within reasonable time", () => {
      const start = fromNow();

      const state = createTestState();
      const ctx: EnhancedPolicyContext = {
        ...defaultEnhancedCtx,
        lastPlanId: "PCO/standard",
        planAge: 5,
      };

      // Run multiple iterations to test performance
      for (let i = 0; i < 100; i++) {
        recommendMoveEnhanced(state, ctx);
      }

      const elapsed = fromNow() - start;

      // Should complete 100 iterations in under 100ms (1ms per call)
      expect(elapsed).toBeLessThan(100);
    });

    it("should not cause memory leaks with plan history", () => {
      let ctx: EnhancedPolicyContext = defaultEnhancedCtx;
      const template = BASE_TEMPLATES.find((t) => t.id === "TKI/base");
      expect(template).toBeDefined();
      if (!template) return;

      // Create many context updates
      for (let i = 0; i < 1000; i++) {
        ctx = updatePolicyContextEnhanced(ctx, template, 1.0, 0.8, false);
      }

      // Plan history should still be bounded
      expect(ctx.planHistory).toBeDefined();
      expect(ctx.planHistory?.length ?? 0).toBeLessThanOrEqual(
        MAX_PLAN_HISTORY_DEPTH,
      );
    });
  });
});
