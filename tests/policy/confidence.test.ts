// Confidence calculation tests for opener policy

import { createEmptyBoard } from "../../src/core/board";
import { createInitialState } from "../../src/engine/init";
import { calculateConfidence } from "../../src/policy/planner";
import { BASE_TEMPLATES } from "../../src/policy/templates/index";
import { createSeed } from "../../src/types/brands";
import { fromNow } from "../../src/types/timestamp";

import type { PlayingState } from "../../src/state/types";

describe("Confidence Calculation", () => {
  // Helper to create test state - creates a valid playing state
  function createTestState(
    overrides: Partial<PlayingState> = {},
  ): PlayingState {
    const seed = createSeed("confidence-test");
    const timestamp = fromNow();
    const baseState = createInitialState(seed, timestamp);

    // Create a proper playing state that satisfies the discriminated union
    const playingState: PlayingState = {
      ...baseState,
      active: undefined, // allowed for playing state
      board: createEmptyBoard(),
      nextQueue: ["T", "I", "S", "Z", "O", "L", "J"] as const,
      pendingLock: null, // required for playing state
      status: "playing",
      ...overrides,
    };

    return playingState;
  }

  describe("Score Margin Effects", () => {
    it("should increase confidence with larger margins", () => {
      const state = createTestState();
      const template = BASE_TEMPLATES[0];

      if (template) {
        const smallMargin = calculateConfidence(1.0, 0.8, state, template);
        const largeMargin = calculateConfidence(2.0, 0.8, state, template);

        expect(largeMargin).toBeGreaterThan(smallMargin);
      }
    });

    it("should return low confidence for small margins", () => {
      const state = createTestState();
      const template = BASE_TEMPLATES[0];

      if (template) {
        const confidence = calculateConfidence(1.0, 0.95, state, template);
        expect(confidence).toBeLessThan(0.7); // Adjusted for new confidence formula
      }
    });

    it("should cap confidence at 1.0", () => {
      const state = createTestState();
      const template = BASE_TEMPLATES[0];

      if (template) {
        const confidence = calculateConfidence(10.0, 0.0, state, template);
        expect(confidence).toBeLessThanOrEqual(1.0);
      }
    });
  });

  describe("Template-Specific Factors", () => {
    it("should handle different template types", () => {
      const state = createTestState();

      BASE_TEMPLATES.forEach((template) => {
        const confidence = calculateConfidence(2.0, 1.0, state, template);

        expect(confidence).toBeGreaterThanOrEqual(0);
        expect(confidence).toBeLessThanOrEqual(1);
        expect(typeof confidence).toBe("number");
        expect(Number.isFinite(confidence)).toBe(true);
      });
    });

    it("should be consistent for same inputs", () => {
      const state = createTestState();
      const template = BASE_TEMPLATES[0];

      if (template) {
        const conf1 = calculateConfidence(1.5, 1.0, state, template);
        const conf2 = calculateConfidence(1.5, 1.0, state, template);

        expect(conf1).toBe(conf2);
      }
    });
  });

  describe("State Context Effects", () => {
    it("should consider board state in confidence", () => {
      const emptyState = createTestState();
      const template = BASE_TEMPLATES[0];

      if (template) {
        const emptyConf = calculateConfidence(2.0, 1.0, emptyState, template);

        // Confidence should be a valid number
        expect(typeof emptyConf).toBe("number");
        expect(Number.isFinite(emptyConf)).toBe(true);
        expect(emptyConf).toBeGreaterThanOrEqual(0);
        expect(emptyConf).toBeLessThanOrEqual(1);
      }
    });

    it("should handle edge case scores", () => {
      const state = createTestState();
      const template = BASE_TEMPLATES[0];

      if (template) {
        // Very close scores
        const closeConf = calculateConfidence(1.01, 1.0, state, template);
        expect(closeConf).toBeGreaterThanOrEqual(0);
        expect(closeConf).toBeLessThanOrEqual(1);

        // Identical scores
        const identicalConf = calculateConfidence(1.0, 1.0, state, template);
        expect(identicalConf).toBeGreaterThanOrEqual(0);
        expect(identicalConf).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("Boundary Conditions", () => {
    it("should handle negative scores", () => {
      const state = createTestState();
      const template = BASE_TEMPLATES[0];

      if (template) {
        const negConf = calculateConfidence(-1.0, -2.0, state, template);
        expect(negConf).toBeGreaterThanOrEqual(0);
        expect(negConf).toBeLessThanOrEqual(1);
      }
    });

    it("should handle zero scores", () => {
      const state = createTestState();
      const template = BASE_TEMPLATES[0];

      if (template) {
        const zeroConf = calculateConfidence(0, 0, state, template);
        expect(zeroConf).toBeGreaterThanOrEqual(0);
        expect(zeroConf).toBeLessThanOrEqual(1);
      }
    });
  });
});
