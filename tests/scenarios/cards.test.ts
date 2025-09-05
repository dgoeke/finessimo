import { describe, it, expect } from "@jest/globals";

import {
  SCENARIOS,
  findScenarioById,
  getScenariosByOpener,
  getScenariosByDifficulty,
  isValidScenarioCard,
  type ScenarioCard,
} from "../../src/scenarios/cards";
import { createSeed } from "../../src/types/brands";

describe("Scenario Cards", () => {
  describe("SCENARIOS registry", () => {
    it("should have exactly 8 scenarios (6+ requirement met)", () => {
      expect(SCENARIOS).toHaveLength(8);
    });

    it("should have unique IDs across all scenarios", () => {
      const ids = SCENARIOS.map((card) => card.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have valid opener types", () => {
      const validOpeners = new Set(["TKI", "PCO", "Neither"]);

      SCENARIOS.forEach((card) => {
        expect(validOpeners.has(card.opener)).toBe(true);
      });
    });

    it("should have TKI and PCO scenarios", () => {
      const tkiCount = SCENARIOS.filter((card) => card.opener === "TKI").length;
      const pcoCount = SCENARIOS.filter((card) => card.opener === "PCO").length;

      expect(tkiCount).toBeGreaterThanOrEqual(3);
      expect(pcoCount).toBeGreaterThanOrEqual(3);
    });

    it("should have scenarios with different difficulty levels", () => {
      const easyCount = SCENARIOS.filter((card) =>
        card.id.includes("easy"),
      ).length;
      const midCount = SCENARIOS.filter((card) =>
        card.id.includes("mid"),
      ).length;
      const hardCount = SCENARIOS.filter((card) =>
        card.id.includes("hard"),
      ).length;

      expect(easyCount).toBeGreaterThan(0);
      expect(midCount).toBeGreaterThan(0);
      expect(hardCount).toBeGreaterThan(0);
    });

    it("should have all scenarios with required fields", () => {
      SCENARIOS.forEach((card) => {
        expect(typeof card.id).toBe("string");
        expect(card.id.length).toBeGreaterThan(0);
        expect(typeof card.opener).toBe("string");
        expect(typeof card.seed).toBe("string");
        expect(card.seed.length).toBeGreaterThan(0);
      });
    });

    it("should have reasonable default values for optional fields", () => {
      SCENARIOS.forEach((card) => {
        if (card.startTicks !== undefined) {
          expect(card.startTicks).toBeGreaterThanOrEqual(0);
        }
        if (card.maxGarbage !== undefined) {
          expect(card.maxGarbage).toBeGreaterThanOrEqual(0);
        }
        if (card.minPreview !== undefined) {
          expect(card.minPreview).toBeGreaterThanOrEqual(1);
        }
        if (card.notes !== undefined) {
          expect(Array.isArray(card.notes)).toBe(true);
          expect(card.notes.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe("isValidScenarioCard", () => {
    it("should validate complete scenario cards", () => {
      const validCard: ScenarioCard = {
        id: "test-card",
        maxGarbage: 0,
        minPreview: 5,
        notes: ["test note"],
        opener: "TKI",
        seed: createSeed("test-seed"),
        startTicks: 0,
      };

      expect(isValidScenarioCard(validCard)).toBe(true);
    });

    it("should validate minimal scenario cards", () => {
      const minimalCard = {
        id: "minimal",
        opener: "PCO",
        seed: createSeed("minimal-seed"),
      };

      expect(isValidScenarioCard(minimalCard)).toBe(true);
    });

    it("should reject cards with missing required fields", () => {
      expect(isValidScenarioCard({})).toBe(false);
      expect(isValidScenarioCard({ id: "test" })).toBe(false);
      expect(isValidScenarioCard({ id: "test", opener: "TKI" })).toBe(false);
    });

    it("should reject cards with invalid opener values", () => {
      const invalidOpenerCard = {
        id: "invalid-opener",
        opener: "INVALID",
        seed: createSeed("test-seed"),
      };

      expect(isValidScenarioCard(invalidOpenerCard)).toBe(false);
    });

    it("should reject cards with empty strings", () => {
      const emptyStringCard = {
        id: "",
        opener: "TKI",
        seed: createSeed("test-seed"),
      };

      expect(isValidScenarioCard(emptyStringCard)).toBe(false);
    });

    it("should reject cards with negative optional values", () => {
      const negativeCard = {
        id: "negative-test",
        opener: "TKI",
        seed: createSeed("test-seed"),
        startTicks: -1,
      };

      expect(isValidScenarioCard(negativeCard)).toBe(false);
    });

    it("should reject null and undefined", () => {
      expect(isValidScenarioCard(null)).toBe(false);
      expect(isValidScenarioCard(undefined)).toBe(false);
    });

    it("should reject non-objects", () => {
      expect(isValidScenarioCard("not an object")).toBe(false);
      expect(isValidScenarioCard(42)).toBe(false);
      expect(isValidScenarioCard([])).toBe(false);
    });
  });

  describe("findScenarioById", () => {
    it("should find existing scenarios by ID", () => {
      const firstScenario = SCENARIOS[0];
      if (firstScenario) {
        const found = findScenarioById(firstScenario.id);
        expect(found).toEqual(firstScenario);
      }
    });

    it("should return undefined for non-existent IDs", () => {
      const notFound = findScenarioById("non-existent-id");
      expect(notFound).toBeUndefined();
    });

    it("should be case-sensitive", () => {
      const firstScenario = SCENARIOS[0];
      if (firstScenario) {
        const notFound = findScenarioById(firstScenario.id.toUpperCase());
        expect(notFound).toBeUndefined();
      }
    });

    it("should return exact same object reference", () => {
      const firstScenario = SCENARIOS[0];
      if (firstScenario) {
        const found = findScenarioById(firstScenario.id);
        expect(found).toBe(firstScenario);
      }
    });
  });

  describe("getScenariosByOpener", () => {
    it("should return all TKI scenarios", () => {
      const tkiScenarios = getScenariosByOpener("TKI");
      expect(Array.isArray(tkiScenarios)).toBe(true);
      expect(tkiScenarios.length).toBeGreaterThan(0);

      for (const scenario of tkiScenarios) {
        expect(scenario.opener).toBe("TKI");
        const found = SCENARIOS.find((s) => s.id === scenario.id);
        expect(scenario).toBe(found);
      }
    });

    it("should return all PCO scenarios", () => {
      const pcoScenarios = getScenariosByOpener("PCO");
      expect(Array.isArray(pcoScenarios)).toBe(true);
      expect(pcoScenarios.length).toBeGreaterThan(0);

      for (const scenario of pcoScenarios) {
        expect(scenario.opener).toBe("PCO");
        const found = SCENARIOS.find((s) => s.id === scenario.id);
        expect(scenario).toBe(found);
      }
    });

    it("should return empty array for Neither if no Neither scenarios exist", () => {
      const neitherScenarios = getScenariosByOpener("Neither");
      expect(Array.isArray(neitherScenarios)).toBe(true);

      for (const scenario of neitherScenarios) {
        expect(scenario.opener).toBe("Neither");
        const found = SCENARIOS.find((s) => s.id === scenario.id);
        expect(scenario).toBe(found);
      }
    });

    it("should return readonly arrays", () => {
      const tkiScenarios = getScenariosByOpener("TKI");

      // The returned array should be marked as readonly in TypeScript
      // At runtime, we just verify the structure
      expect(Array.isArray(tkiScenarios)).toBe(true);
      expect(tkiScenarios.length).toBeGreaterThan(0);
    });
  });

  describe("getScenariosByDifficulty", () => {
    it("should return scenarios matching easy difficulty", () => {
      const easyScenarios = getScenariosByDifficulty("easy");
      expect(easyScenarios.length).toBeGreaterThan(0);

      for (const scenario of easyScenarios) {
        expect(scenario.id.includes("easy")).toBe(true);
        const found = SCENARIOS.find((s) => s.id === scenario.id);
        expect(scenario).toBe(found);
      }
    });

    it("should return scenarios matching mid difficulty", () => {
      const midScenarios = getScenariosByDifficulty("mid");
      expect(midScenarios.length).toBeGreaterThan(0);

      for (const scenario of midScenarios) {
        expect(scenario.id.includes("mid")).toBe(true);
        const found = SCENARIOS.find((s) => s.id === scenario.id);
        expect(scenario).toBe(found);
      }
    });

    it("should return scenarios matching hard difficulty", () => {
      const hardScenarios = getScenariosByDifficulty("hard");
      expect(hardScenarios.length).toBeGreaterThan(0);

      for (const scenario of hardScenarios) {
        expect(scenario.id.includes("hard")).toBe(true);
        const found = SCENARIOS.find((s) => s.id === scenario.id);
        expect(scenario).toBe(found);
      }
    });

    it("should return readonly arrays", () => {
      const easyScenarios = getScenariosByDifficulty("easy");

      // The returned array should be marked as readonly in TypeScript
      // At runtime, we just verify the structure
      expect(Array.isArray(easyScenarios)).toBe(true);
      expect(easyScenarios.length).toBeGreaterThan(0);
    });
  });

  describe("Scenario card structure validation", () => {
    it("should have properly structured IDs", () => {
      for (const card of SCENARIOS) {
        // IDs should follow pattern: opener/variant:difficulty
        expect(card.id).toMatch(/^[A-Z]+\/[a-zA-Z]+:[a-zA-Z]+$/);
      }
    });

    it("should have ID opener matching opener field", () => {
      for (const card of SCENARIOS) {
        const idOpener = card.id.split("/")[0];
        expect(idOpener).toBe(card.opener);
      }
    });

    it("should have meaningful notes when provided", () => {
      for (const card of SCENARIOS) {
        if (card.notes) {
          expect(card.notes.length).toBeGreaterThan(0);
          for (const note of card.notes) {
            expect(note.length).toBeGreaterThan(0);
          }
        }
      }
    });

    it("should have consistent seed naming", () => {
      for (const card of SCENARIOS) {
        // Seeds should be related to the scenario ID
        const seedStr = card.seed as unknown as string;
        expect(seedStr.length).toBeGreaterThan(0);
        expect(seedStr.includes("_")).toBe(true); // Should have underscores
      }
    });
  });

  describe("Registry integrity", () => {
    it("should have all scenarios passing validation", () => {
      for (const card of SCENARIOS) {
        expect(isValidScenarioCard(card)).toBe(true);
      }
    });

    it("should maintain consistent data types", () => {
      for (const card of SCENARIOS) {
        expect(typeof card.id).toBe("string");
        expect(typeof card.opener).toBe("string");
        expect(typeof card.seed).toBe("string");

        if (card.startTicks !== undefined) {
          expect(typeof card.startTicks).toBe("number");
        }
        if (card.maxGarbage !== undefined) {
          expect(typeof card.maxGarbage).toBe("number");
        }
        if (card.minPreview !== undefined) {
          expect(typeof card.minPreview).toBe("number");
        }
        if (card.notes !== undefined) {
          expect(Array.isArray(card.notes)).toBe(true);
        }
      }
    });

    it("should have balanced difficulty distribution", () => {
      const easyCount = SCENARIOS.filter((s) => s.id.includes("easy")).length;
      const midCount = SCENARIOS.filter((s) => s.id.includes("mid")).length;
      const hardCount = SCENARIOS.filter((s) => s.id.includes("hard")).length;

      // Should have a reasonable distribution
      expect(easyCount).toBeGreaterThanOrEqual(2);
      expect(midCount).toBeGreaterThanOrEqual(2);
      expect(hardCount).toBeGreaterThanOrEqual(1);
    });
  });
});
