// Tests for template variants
// Ensures variant templates are properly constructed and integrated

import { BASE_TEMPLATES } from "../../../src/policy/templates/index";
import { VARIANT_TEMPLATES } from "../../../src/policy/templates/variants";
import { createGridCoord } from "../../../src/types/brands";
import { createTestGameState } from "../../test-helpers";

import type { ActivePiece } from "../../../src/state/types";

describe("Template Variants", () => {
  describe("VARIANT_TEMPLATES", () => {
    it("should export the correct number of variants", () => {
      expect(VARIANT_TEMPLATES).toHaveLength(2);
    });

    it("should have unique template IDs", () => {
      const ids = VARIANT_TEMPLATES.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should include PCO edge variant", () => {
      const pcoEdge = VARIANT_TEMPLATES.find((t) => t.id === "PCO/edge");
      expect(pcoEdge).toBeDefined();
      expect(pcoEdge?.opener).toBe("PCO");
    });

    it("should include PCO transition variant", () => {
      const pcoTransition = VARIANT_TEMPLATES.find(
        (t) => t.id === "PCO/transition",
      );
      expect(pcoTransition).toBeDefined();
      expect(pcoTransition?.opener).toBe("PCO");
    });

    it("should not conflict with base template IDs", () => {
      const baseIds = new Set(BASE_TEMPLATES.map((t) => t.id));
      const variantIds = VARIANT_TEMPLATES.map((t) => t.id);

      for (const variantId of variantIds) {
        expect(baseIds.has(variantId)).toBe(false);
      }
    });
  });

  describe("PCO Edge Variant", () => {
    const pcoEdge = VARIANT_TEMPLATES.find((t) => t.id === "PCO/edge");
    if (!pcoEdge) throw new Error("PCO/edge template not found");

    it("should evaluate preconditions for clean edges", () => {
      const state = createTestGameState();
      const result = pcoEdge.preconditions(state);

      expect(result.feasible).toBeDefined();
      expect(result.notes).toContain("clean edges for edge play");
      expect(result.scoreDelta).toBeDefined();
    });

    it("should provide step candidates", () => {
      const testActivePiece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(0),
      };
      const stateWithActivePiece = createTestGameState(
        {},
        { active: testActivePiece },
      );

      const steps = pcoEdge.nextStep(stateWithActivePiece);

      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
    });
  });

  describe("PCO Transition Variant", () => {
    const pcoTransition = VARIANT_TEMPLATES.find(
      (t) => t.id === "PCO/transition",
    );
    if (!pcoTransition) throw new Error("PCO/transition template not found");

    it("should evaluate preconditions for PC viability", () => {
      const state = createTestGameState();
      const result = pcoTransition.preconditions(state);

      expect(result.feasible).toBeDefined();
      expect(result.notes).toContain("PC still viable");
      expect(result.scoreDelta).toBeDefined();
    });

    it("should provide step candidates", () => {
      const testActivePiece: ActivePiece = {
        id: "I",
        rot: "spawn",
        x: createGridCoord(3),
        y: createGridCoord(0),
      };
      const stateWithActivePiece = createTestGameState(
        {},
        { active: testActivePiece },
      );

      const steps = pcoTransition.nextStep(stateWithActivePiece);

      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
    });
  });
});
