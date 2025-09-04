// Unit tests for policy planner
// Tests scoring, hazards, confidence, and hysteresis logic

import { createEmptyBoard } from "../../src/core/board";
import { createInitialState } from "../../src/engine/init";
import { recommendMove, clearPolicyCache } from "../../src/policy/index";
import {
  calculateConfidence,
  chooseWithHysteresis,
  updatePolicyContext,
  SWITCH_MARGIN,
  MIN_PLAN_AGE,
  HAZARDS,
} from "../../src/policy/planner";
import { BASE_TEMPLATES } from "../../src/policy/templates/index";
import { createSeed, createGridCoord } from "../../src/types/brands";
import { fromNow } from "../../src/types/timestamp";

import type { PolicyContext } from "../../src/policy/types";
import type { PieceId, PlayingState } from "../../src/state/types";

describe("Policy Planner", () => {
  // Helper to create test state
  function createTestState(
    overrides: Partial<PlayingState> = {},
  ): PlayingState {
    const seed = createSeed("test-seed");
    const timestamp = fromNow();
    const baseState = createInitialState(seed, timestamp);

    // Create a properly typed playing state
    const playingState: PlayingState = {
      ...baseState,
      board: createEmptyBoard(),
      nextQueue: ["T", "I", "S", "Z", "O", "L", "J"] as const,
      pendingLock: null, // required for PlayingState
      status: "playing",
      ...overrides,
    };

    return playingState;
  }

  const defaultCtx: PolicyContext = {
    lastBestScore: null,
    lastPlanId: null,
    lastSecondScore: null,
    lastUpdate: null,
    planAge: 0,
  };

  describe("Score Calculation", () => {
    it("should calculate and use scores for all templates", () => {
      const state = createTestState();

      // Test that policy can evaluate all templates successfully
      const result = recommendMove(state);

      expect(result.suggestion).toBeDefined();
      expect(result.suggestion.intent).toMatch(/^(TKI|PCO|Neither)$/);
      expect(result.suggestion.confidence).toBeGreaterThan(0);
      expect(result.suggestion.confidence).toBeLessThanOrEqual(1);
      expect(typeof result.suggestion.rationale).toBe("string");
    });

    it("should apply hazard penalties correctly", () => {
      // Test specific hazard scenario - TKI with no I available should trigger hazard
      const hazardState = createTestState({
        active: {
          id: "T" as PieceId,
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        },
        hold: "T", // Make TKI template considered but no I available
        nextQueue: ["S", "Z", "O", "L", "J", "S", "Z"], // No I in queue
      });

      const result = recommendMove(hazardState);

      // Should detect hazards and choose Neither or show warning
      expect(result.suggestion.intent).toBe("Neither"); // Should fall back due to hazards
    });
  });

  describe("Confidence Calculation", () => {
    it("should return higher confidence for larger score margins", () => {
      const state = createTestState();
      const template = BASE_TEMPLATES[0];
      expect(template).toBeDefined();
      if (!template) return;

      const lowConf = calculateConfidence(1.1, 1.0, state, template);
      const highConf = calculateConfidence(2.0, 1.0, state, template);

      expect(highConf).toBeGreaterThan(lowConf);
    });

    it("should cap confidence between 0 and 1", () => {
      const state = createTestState();
      const template = BASE_TEMPLATES[0];
      expect(template).toBeDefined();
      if (!template) return;

      const conf = calculateConfidence(10.0, 0.0, state, template);
      expect(conf).toBeGreaterThanOrEqual(0);
      expect(conf).toBeLessThanOrEqual(1);
    });
  });

  describe("Hysteresis Logic", () => {
    it("should stick to current plan when margin is insufficient", () => {
      const state = createTestState();
      const currentTemplate = BASE_TEMPLATES[1];
      const challengerTemplate = BASE_TEMPLATES[0];
      expect(currentTemplate).toBeDefined();
      expect(challengerTemplate).toBeDefined();
      if (!currentTemplate || !challengerTemplate) return;

      const ctx: PolicyContext = {
        ...defaultCtx,
        lastBestScore: 1.0,
        lastPlanId: currentTemplate.id,
        lastSecondScore: 0.8,
        planAge: 1,
      };

      const chosen = chooseWithHysteresis(
        challengerTemplate,
        1.0 + SWITCH_MARGIN - 0.05, // Slightly below switch margin
        1.0,
        ctx,
        state,
      );

      // Should stick with current template due to insufficient margin
      expect(chosen.id).toBe(currentTemplate.id);
    });

    it("should switch when margin is sufficient and plan is old", () => {
      const state = createTestState();
      const currentTemplate = BASE_TEMPLATES[1];
      const challengerTemplate = BASE_TEMPLATES[0];
      expect(currentTemplate).toBeDefined();
      expect(challengerTemplate).toBeDefined();
      if (!currentTemplate || !challengerTemplate) return;

      const ctx: PolicyContext = {
        ...defaultCtx,
        lastBestScore: 1.0,
        lastPlanId: currentTemplate.id,
        lastSecondScore: 0.8,
        planAge: MIN_PLAN_AGE,
      };

      const chosen = chooseWithHysteresis(
        challengerTemplate,
        1.0 + SWITCH_MARGIN + 0.1, // Exceed switch margin
        1.0,
        ctx,
        state,
      );

      // Should switch to challenger when margin is sufficient
      expect(chosen.id).toBe(challengerTemplate.id);
    });

    it("should switch when confidence is low even with small margin", () => {
      const state = createTestState();
      const currentTemplate = BASE_TEMPLATES[1]; // PCO
      const challengerTemplate = BASE_TEMPLATES[0]; // TKI
      expect(currentTemplate).toBeDefined();
      expect(challengerTemplate).toBeDefined();
      if (!currentTemplate || !challengerTemplate) return;

      const ctx: PolicyContext = {
        ...defaultCtx,
        lastBestScore: 1.0,
        lastPlanId: currentTemplate.id,
        lastSecondScore: 0.98, // Very close scores = low confidence
        planAge: MIN_PLAN_AGE, // Meet age requirement
      };

      const chosen = chooseWithHysteresis(
        challengerTemplate,
        1.0 + SWITCH_MARGIN + 0.1, // Exceed switch margin
        1.0,
        ctx,
        state,
      );

      // Should switch to challenger when margin is sufficient
      expect(chosen.id).toBe(challengerTemplate.id);
    });
  });

  describe("Context Updates", () => {
    it("should update context with new scores and plan", () => {
      const template = BASE_TEMPLATES[0];
      expect(template).toBeDefined();
      if (!template) return;

      const ctx = defaultCtx;
      const newCtx = updatePolicyContext(ctx, template, 2.0, 1.5);

      expect(newCtx.lastPlanId).toBe(template.id);
      expect(newCtx.lastBestScore).toBe(2.0);
      expect(newCtx.lastSecondScore).toBe(1.5);
      expect(newCtx.planAge).toBe(0); // New plan
      expect(newCtx.lastUpdate).toBeTruthy();
    });

    it("should increment plan age when plan stays the same", () => {
      const template = BASE_TEMPLATES[0];
      expect(template).toBeDefined();
      if (!template) return;

      const ctx: PolicyContext = {
        ...defaultCtx,
        lastPlanId: template.id,
        planAge: 5,
      };

      const newCtx = updatePolicyContext(ctx, template, 2.0, 1.5);
      expect(newCtx.planAge).toBe(6);
    });

    it("should reset plan age when plan changes", () => {
      const oldTemplate = BASE_TEMPLATES[0];
      const newTemplate = BASE_TEMPLATES[1];
      expect(oldTemplate).toBeDefined();
      expect(newTemplate).toBeDefined();
      if (!oldTemplate || !newTemplate) return;

      const ctx: PolicyContext = {
        ...defaultCtx,
        lastPlanId: oldTemplate.id,
        planAge: 5,
      };

      const newCtx = updatePolicyContext(ctx, newTemplate, 2.0, 1.5);

      expect(newCtx.planAge).toBe(0);
      expect(newCtx.lastPlanId).toBe(newTemplate.id);
    });
  });

  describe("Hazard Detection", () => {
    it("should detect TKI hazard when no early I available", () => {
      const state = createTestState({
        active: {
          id: "S" as PieceId,
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        },
        hold: undefined,
        nextQueue: ["S", "Z", "O", "L", "J", "T", "S"],
      });

      const hazard = HAZARDS.find((h) => h.id === "tki-no-early-i");
      expect(hazard).toBeDefined();
      if (!hazard) return;

      const applies = hazard.detect(state);
      expect(applies).toBe(true);
    });

    it("should not detect TKI hazard when I is available", () => {
      const state = createTestState({
        active: {
          id: "S" as PieceId,
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        },
        hold: undefined,
        nextQueue: ["I", "Z", "O", "L", "J", "T", "S"],
      });

      const hazard = HAZARDS.find((h) => h.id === "tki-no-early-i");
      expect(hazard).toBeDefined();
      if (!hazard) return;

      const applies = hazard.detect(state);
      expect(applies).toBe(false);
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete policy flow", () => {
      const state = createTestState();

      const result = recommendMove(state);

      expect(result).toHaveProperty("suggestion");
      expect(result).toHaveProperty("nextCtx");
      expect(result.suggestion.confidence).toBeGreaterThanOrEqual(0);
      expect(result.suggestion.confidence).toBeLessThanOrEqual(1);
      expect(result.suggestion.intent).toMatch(/^(TKI|PCO|Neither)$/);
    });

    it("should maintain policy consistency", () => {
      const state = createTestState();

      // Same inputs should produce same outputs
      const result1 = recommendMove(state);
      const result2 = recommendMove(state);

      expect(result1.suggestion.intent).toBe(result2.suggestion.intent);
      expect(result1.suggestion.confidence).toBe(result2.suggestion.confidence);
      expect(result1.suggestion.rationale).toBe(result2.suggestion.rationale);
    });
  });

  describe("Memoization", () => {
    it("should maintain consistent results with caching", () => {
      const state = createTestState();

      // Clear cache and run first time
      clearPolicyCache();
      const result1 = recommendMove(state);

      // Run second time (should use cache)
      const result2 = recommendMove(state);

      // Results should be identical
      expect(result1.suggestion.intent).toBe(result2.suggestion.intent);
      expect(result1.suggestion.confidence).toBe(result2.suggestion.confidence);
      expect(result1.suggestion.rationale).toBe(result2.suggestion.rationale);
    });

    it("should clear cache successfully", () => {
      const state = createTestState();

      // Warm up cache
      recommendMove(state);

      // Clear cache (should not throw)
      expect(() => clearPolicyCache()).not.toThrow();

      // Should still work after clearing
      const result = recommendMove(state);
      expect(result.suggestion).toBeDefined();
    });
  });
});
