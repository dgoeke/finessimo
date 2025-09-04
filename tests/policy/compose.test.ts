import { describe, it, expect } from "@jest/globals";

import { createInitialState } from "../../src/engine/init";
import { extendTemplate } from "../../src/policy/templates/_compose";
import { BASE_TEMPLATES } from "../../src/policy/templates/index";
import { createSeed, createGridCoord } from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";

import type { TemplatePatch } from "../../src/policy/templates/_compose";
import type { StepCandidate } from "../../src/policy/types";
import type { GameState, ActivePiece } from "../../src/state/types";

describe("Template Composition", () => {
  let baseState: GameState;

  beforeEach(() => {
    baseState = createInitialState(
      createSeed("test-seed"),
      createTimestamp(1000),
    );
  });

  describe("extendTemplate", () => {
    it("should extend template with basic patch fields", () => {
      const baseTemplate = BASE_TEMPLATES.find((t) => t.id === "TKI/base");
      if (!baseTemplate) throw new Error("TKI/base template not found");

      const patch: TemplatePatch = {
        id: "TKI/extended",
      };

      const extended = extendTemplate(baseTemplate, patch);

      expect(extended.id).toBe("TKI/extended");
      expect(extended.opener).toBe(baseTemplate.opener);
      expect(extended.nextStep).toBe(baseTemplate.nextStep);
      expect(extended.preconditions).toBe(baseTemplate.preconditions);
    });

    it("should compose nextStep functions when patch provides one", () => {
      const baseTemplate = BASE_TEMPLATES.find((t) => t.id === "TKI/base");
      if (!baseTemplate) throw new Error("TKI/base template not found");

      const mockStepCandidate: StepCandidate = {
        propose: () => [
          {
            rot: "spawn",
            useHold: false,
            x: createGridCoord(5),
          },
        ],
        utility: () => 2.0,
        when: (s: GameState) => s.active !== undefined,
      };

      const patch: TemplatePatch = {
        id: "TKI/with-extra-step",
        nextStep: () => [mockStepCandidate],
      };

      const extended = extendTemplate(baseTemplate, patch);
      const state: GameState = {
        ...baseState,
        active: {
          id: "T",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        } as ActivePiece,
        pendingLock: null,
        status: "playing",
      };

      const baseSteps = baseTemplate.nextStep(state);
      const extendedSteps = extended.nextStep(state);

      expect(extendedSteps.length).toBe(baseSteps.length + 1);
      expect(extendedSteps).toEqual([...baseSteps, mockStepCandidate]);
    });

    it("should use base nextStep when patch does not provide one", () => {
      const baseTemplate = BASE_TEMPLATES.find((t) => t.id === "TKI/base");
      if (!baseTemplate) throw new Error("TKI/base template not found");

      const patch: TemplatePatch = {
        id: "TKI/no-step-change",
        // No nextStep property (omitted rather than explicitly undefined)
      };

      const extended = extendTemplate(baseTemplate, patch);
      const state: GameState = {
        ...baseState,
        active: {
          id: "T",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        } as ActivePiece,
        pendingLock: null,
        status: "playing",
      };

      const baseSteps = baseTemplate.nextStep(state);
      const extendedSteps = extended.nextStep(state);

      expect(extendedSteps).toEqual(baseSteps);
    });

    it("should compose preconditions by ANDing feasible flags", () => {
      const baseTemplate = BASE_TEMPLATES.find((t) => t.id === "TKI/base");
      if (!baseTemplate) throw new Error("TKI/base template not found");

      const patch: TemplatePatch = {
        id: "TKI/strict",
        preconditions: () => ({
          feasible: false, // This should make the extended template infeasible
          notes: ["Additional constraint failed"],
          scoreDelta: -0.1,
        }),
      };

      const extended = extendTemplate(baseTemplate, patch);
      const state: GameState = {
        ...baseState,
        active: {
          id: "T",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        } as ActivePiece,
        nextQueue: ["I", "S", "Z", "O", "L", "J", "T"] as const, // Has I, so base would be feasible
        pendingLock: null,
        status: "playing",
      };

      const baseResult = baseTemplate.preconditions(state);
      const extendedResult = extended.preconditions(state);

      expect(baseResult.feasible).toBe(true);
      expect(extendedResult.feasible).toBe(false); // ANDed with patch's false
    });

    it("should concatenate precondition notes", () => {
      const baseTemplate = BASE_TEMPLATES.find((t) => t.id === "TKI/base");
      if (!baseTemplate) throw new Error("TKI/base template not found");

      const patch: TemplatePatch = {
        id: "TKI/with-notes",
        preconditions: () => ({
          feasible: true,
          notes: ["Additional note 1", "Additional note 2"],
          scoreDelta: 0.05,
        }),
      };

      const extended = extendTemplate(baseTemplate, patch);
      const state: GameState = {
        ...baseState,
        active: {
          id: "T",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        } as ActivePiece,
        nextQueue: ["I", "S", "Z", "O", "L", "J", "T"] as const,
        pendingLock: null,
        status: "playing",
      };

      const baseResult = baseTemplate.preconditions(state);
      const extendedResult = extended.preconditions(state);

      expect(extendedResult.notes).toEqual([
        ...baseResult.notes,
        "Additional note 1",
        "Additional note 2",
      ]);
    });

    it("should sum scoreDelta from base and patch", () => {
      const baseTemplate = BASE_TEMPLATES.find((t) => t.id === "TKI/base");
      if (!baseTemplate) throw new Error("TKI/base template not found");

      const patch: TemplatePatch = {
        id: "TKI/with-bonus",
        preconditions: () => ({
          feasible: true,
          notes: ["Bonus applied"],
          scoreDelta: 0.15,
        }),
      };

      const extended = extendTemplate(baseTemplate, patch);
      const state: GameState = {
        ...baseState,
        active: {
          id: "T",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        } as ActivePiece,
        nextQueue: ["I", "S", "Z", "O", "L", "J", "T"] as const,
        pendingLock: null,
        status: "playing",
      };

      const baseResult = baseTemplate.preconditions(state);
      const extendedResult = extended.preconditions(state);

      const expectedScoreDelta = (baseResult.scoreDelta ?? 0) + 0.15;
      expect(extendedResult.scoreDelta).toBe(expectedScoreDelta);
    });

    it("should handle undefined scoreDelta values", () => {
      const baseTemplate = BASE_TEMPLATES.find((t) => t.id === "Neither/safe");
      if (!baseTemplate) throw new Error("Neither/safe template not found");

      const patch: TemplatePatch = {
        id: "Neither/modified",
        preconditions: () => ({
          feasible: true,
          notes: ["Modified"],
          // No scoreDelta specified (undefined)
        }),
      };

      const extended = extendTemplate(baseTemplate, patch);
      const extendedResult = extended.preconditions(baseState);

      // Neither template has scoreDelta: 0, patch has undefined
      expect(extendedResult.scoreDelta).toBe(0);
    });

    it("should use base preconditions when patch does not provide them", () => {
      const baseTemplate = BASE_TEMPLATES.find((t) => t.id === "TKI/base");
      if (!baseTemplate) throw new Error("TKI/base template not found");

      const patch: TemplatePatch = {
        id: "TKI/no-precondition-change",
        // No preconditions property (omitted rather than explicitly undefined)
      };

      const extended = extendTemplate(baseTemplate, patch);
      const state: GameState = {
        ...baseState,
        active: {
          id: "T",
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        } as ActivePiece,
        nextQueue: ["I", "S", "Z", "O", "L", "J", "T"] as const,
        pendingLock: null,
        status: "playing",
      };

      const baseResult = baseTemplate.preconditions(state);
      const extendedResult = extended.preconditions(state);

      expect(extendedResult).toEqual(baseResult);
    });
  });
});
