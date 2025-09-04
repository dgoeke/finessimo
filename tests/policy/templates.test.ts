// Template tests for opener policy system

import { createEmptyBoard } from "../../src/core/board";
import { createInitialState } from "../../src/engine/init";
import { recommendMove } from "../../src/policy/index";
import { BASE_TEMPLATES } from "../../src/policy/templates/index";
import { createSeed, createGridCoord } from "../../src/types/brands";
import { fromNow } from "../../src/types/timestamp";

import type { Template, StepCandidate } from "../../src/policy/types";
import type { PlayingState, PieceId } from "../../src/state/types";

describe("Opener Templates", () => {
  // Helper to create test state - creates a valid playing state
  function createTestState(
    overrides: Partial<PlayingState> = {},
  ): PlayingState {
    const seed = createSeed("test-templates");
    const timestamp = fromNow();
    const baseState = createInitialState(seed, timestamp);

    // Create a proper playing state that satisfies the discriminated union
    const playingState: PlayingState = {
      ...baseState,
      active: {
        id: "T" as PieceId,
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(0),
      },
      board: createEmptyBoard(),
      nextQueue: ["T", "I", "S", "Z", "O", "L", "J"] as const,
      pendingLock: null, // required for playing state
      status: "playing",
      ...overrides,
    };

    return playingState;
  }

  describe("Template Registry", () => {
    it("should have exactly 4 base templates (includes TKI variant)", () => {
      expect(BASE_TEMPLATES).toHaveLength(4);
    });

    it("should have unique template IDs", () => {
      const ids = BASE_TEMPLATES.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have all required template fields", () => {
      BASE_TEMPLATES.forEach((template) => {
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
  });

  describe("Template Preconditions", () => {
    it("should evaluate preconditions correctly", () => {
      const state = createTestState();

      BASE_TEMPLATES.forEach((template) => {
        const result = template.preconditions(state);

        expect(result).toHaveProperty("feasible");
        expect(result).toHaveProperty("notes");
        expect(typeof result.feasible).toBe("boolean");
        expect(Array.isArray(result.notes)).toBe(true);

        if (result.scoreDelta !== undefined) {
          expect(typeof result.scoreDelta).toBe("number");
        }
      });
    });

    it("should provide meaningful notes for feasibility", () => {
      const state = createTestState();

      BASE_TEMPLATES.forEach((template) => {
        const result = template.preconditions(state);

        if (!result.feasible) {
          expect(result.notes.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe("Template Next Steps", () => {
    // Helper function to validate step structure
    function validateStep(step: StepCandidate) {
      expect(step).toHaveProperty("when");
      expect(step).toHaveProperty("propose");
      expect(step).toHaveProperty("utility");
      expect(typeof step.when).toBe("function");
      expect(typeof step.propose).toBe("function");
      expect(typeof step.utility).toBe("function");
    }

    it("should generate valid next steps", () => {
      const state = createTestState();

      BASE_TEMPLATES.forEach((template) => {
        const steps = template.nextStep(state);
        expect(Array.isArray(steps)).toBe(true);
        steps.forEach(validateStep);
      });
    });

    it("should have consistent step behavior", () => {
      const state = createTestState();

      BASE_TEMPLATES.forEach((template) => {
        const steps1 = template.nextStep(state);
        const steps2 = template.nextStep(state);

        expect(steps1).toEqual(steps2);
      });
    });
  });

  // Helper functions extracted to module level to reduce nesting
  function findTemplateById(id: string): Template | undefined {
    return BASE_TEMPLATES.find((t) => t.id === id);
  }

  function testTemplateMethodsSafe(template: Template, state: PlayingState) {
    expect(() => {
      template.preconditions(state);
      template.nextStep(state);
    }).not.toThrow();
  }

  function testStepPlacements(step: StepCandidate, state: PlayingState) {
    if (step.when(state)) {
      const placements = step.propose(state);
      expect(Array.isArray(placements)).toBe(true);

      if (placements.length > 0) {
        const firstPlacement = placements[0];
        if (firstPlacement !== undefined) {
          const utility = step.utility(firstPlacement, state);
          expect(typeof utility).toBe("number");
        }
      }
    }
  }

  function testAllStepsForTemplate(template: Template, state: PlayingState) {
    const steps = template.nextStep(state);
    steps.forEach((step) => testStepPlacements(step, state));
  }

  describe("Template Integration", () => {
    it("should work with policy recommendation", () => {
      const state = createTestState();

      // Test that all templates can be used by the policy system
      const result = recommendMove(state);

      expect(result).toHaveProperty("suggestion");
      expect(result).toHaveProperty("nextCtx");
      expect(result.suggestion).toHaveProperty("intent");
      expect(result.suggestion).toHaveProperty("placement");
      expect(result.suggestion).toHaveProperty("rationale");
      expect(result.suggestion).toHaveProperty("confidence");
    });

    it("should generate placements when feasible", () => {
      const state = createTestState();
      BASE_TEMPLATES.forEach((template) =>
        testAllStepsForTemplate(template, state),
      );
    });
  });

  describe("Template Specificity", () => {
    describe("TKI Template", () => {
      it("should be the T-Kick-I template", () => {
        const tsdTemplate = findTemplateById("TKI/base");
        expect(tsdTemplate).toBeDefined();
        expect(tsdTemplate?.opener).toBe("TKI");
      });

      it("should have appropriate preconditions", () => {
        const state = createTestState();
        const tsdTemplate = findTemplateById("TKI/base");

        expect(tsdTemplate).toBeDefined();
        if (tsdTemplate) {
          const result = tsdTemplate.preconditions(state);
          expect(result).toHaveProperty("feasible");
        }
      });
    });

    describe("PCO Template", () => {
      it("should be the Perfect Clear Opener template", () => {
        const lstTemplate = findTemplateById("PCO/standard");
        expect(lstTemplate).toBeDefined();
        expect(lstTemplate?.opener).toBe("PCO");
      });
    });

    describe("Neither Template", () => {
      it("should be the Neither template", () => {
        const trinityTemplate = findTemplateById("Neither/safe");
        expect(trinityTemplate).toBeDefined();
        expect(trinityTemplate?.opener).toBe("Neither");
      });
    });
  });

  describe("Template Edge Cases", () => {
    it("should handle empty board gracefully", () => {
      const emptyBoardState = createTestState({
        board: createEmptyBoard(),
      });

      BASE_TEMPLATES.forEach((template) => {
        testTemplateMethodsSafe(template, emptyBoardState);
      });
    });

    it("should handle states without active pieces", () => {
      const noActiveState = createTestState({
        active: undefined,
      });

      BASE_TEMPLATES.forEach((template) => {
        testTemplateMethodsSafe(template, noActiveState);
      });
    });
  });
});
