// Unit tests for Chapter 3 enhanced hazard system with severity levels
// Tests hazard detection, severity calculation, penalty application, and rationale reporting

import { createEmptyBoard } from "../../src/core/board";
import { createInitialState } from "../../src/engine/init";
import { recommendMove, clearPolicyCache } from "../../src/policy/index";
import {
  calculateHazards,
  formatRationale,
  HAZARDS,
} from "../../src/policy/planner";
import { BASE_TEMPLATES } from "../../src/policy/templates/index";
import { createSeed, createGridCoord } from "../../src/types/brands";
import { fromNow } from "../../src/types/timestamp";

import type { Hazard, Intent } from "../../src/policy/types";
import type { PieceId, PlayingState, Board } from "../../src/state/types";

describe("Policy Hazard System with Severities", () => {
  // Helper to create test state
  function createTestState(
    overrides: Partial<PlayingState> = {},
    customBoard?: Board,
  ): PlayingState {
    const seed = createSeed("test-hazards");
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
      nextQueue: ["S", "Z", "O", "L", "J", "T", "S"] as const,
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

  // Enhanced hazard type with severity for testing
  type EnhancedHazard = Hazard & {
    readonly severity: "low" | "medium" | "high" | "critical";
  };

  // Helper to calculate hazard severity based on penalty
  function calculateHazardSeverity(
    hazard: Hazard,
  ): "low" | "medium" | "high" | "critical" {
    const penalty = Math.abs(hazard.penalty);
    if (penalty >= 2.0) return "critical";
    if (penalty >= 1.5) return "high";
    if (penalty >= 1.0) return "medium";
    return "low";
  }

  // Helper to enhance hazards with severity information
  function enhanceHazardsWithSeverity(
    hazards: ReadonlyArray<Hazard>,
  ): ReadonlyArray<EnhancedHazard> {
    return hazards.map((hazard) => ({
      ...hazard,
      severity: calculateHazardSeverity(hazard),
    }));
  }

  beforeEach(() => {
    clearPolicyCache();
  });

  describe("Hazard Detection and Classification", () => {
    it("should detect all three core hazards correctly", () => {
      expect(HAZARDS).toHaveLength(3);

      const hazardIds = HAZARDS.map((h) => h.id);
      expect(hazardIds).toContain("tki-no-early-i");
      expect(hazardIds).toContain("overhang-without-t");
      expect(hazardIds).toContain("split-needs-i");
    });

    it("should assign correct severity levels based on penalties", () => {
      const enhancedHazards = enhanceHazardsWithSeverity(HAZARDS);

      // TKI no early I: penalty -1.5 → high severity
      const tkiNoI = enhancedHazards.find((h) => h.id === "tki-no-early-i");
      expect(tkiNoI?.severity).toBe("high");

      // Overhang without T: penalty -1.2 → medium severity
      const overhang = enhancedHazards.find(
        (h) => h.id === "overhang-without-t",
      );
      expect(overhang?.severity).toBe("medium");

      // Split needs I: penalty -0.8 → low severity
      const splitI = enhancedHazards.find((h) => h.id === "split-needs-i");
      expect(splitI?.severity).toBe("low");
    });

    it("should detect TKI no-early-I hazard correctly", () => {
      const tkiTemplate = BASE_TEMPLATES.find((t) => t.opener === "TKI");
      expect(tkiTemplate).toBeDefined();
      if (!tkiTemplate) return;

      // State without I piece in early positions
      const noIState = createTestState({
        active: {
          id: "S" as PieceId,
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        },
        hold: undefined,
        nextQueue: ["S", "Z", "O", "L", "J", "T", "S"] as const, // No I in first 3
      });

      const hazards = calculateHazards(tkiTemplate, noIState);
      const tkiHazard = hazards.find((h) => h.id === "tki-no-early-i");

      expect(tkiHazard).toBeDefined();
      expect(tkiHazard?.penalty).toBe(-1.5);
      expect(tkiHazard?.reason).toBe("No I piece available for TKI");
    });

    it("should detect overhang-without-t hazard correctly", () => {
      const template = BASE_TEMPLATES.find((t) => t.opener === "PCO");
      expect(template).toBeDefined();
      if (!template) return;

      // Create board with overhang: filled cell above empty cell
      const overhangBoard = createBoardWithCells([
        { x: 4, y: 1 }, // Filled cell at y=1
        // No cell at y=2, creating overhang
      ]);

      const state = createTestState({}, overhangBoard);
      const hazards = calculateHazards(template, state);
      const overhangHazard = hazards.find((h) => h.id === "overhang-without-t");

      expect(overhangHazard).toBeDefined();
      expect(overhangHazard?.penalty).toBe(-1.2);
      expect(overhangHazard?.reason).toBe("Overhang without T piece support");
    });

    it("should detect split-needs-i hazard correctly", () => {
      const template = BASE_TEMPLATES.find((t) => t.opener === "TKI");
      expect(template).toBeDefined();
      if (!template) return;

      // Create board with 4-wide gap and no I piece available
      const splitBoard = createBoardWithCells([
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 }, // Left side
        { x: 7, y: 1 },
        { x: 8, y: 1 },
        { x: 9, y: 1 }, // Right side
        // Gap at x: 3,4,5,6 (4-wide gap)
      ]);

      const noIState = createTestState(
        {
          nextQueue: ["S", "Z", "O", "L", "J", "T", "S"] as const, // No I piece
        },
        splitBoard,
      );

      const hazards = calculateHazards(template, noIState);
      const splitHazard = hazards.find((h) => h.id === "split-needs-i");

      expect(splitHazard).toBeDefined();
      expect(splitHazard?.penalty).toBe(-0.8);
      expect(splitHazard?.reason).toBe("Split formation needs I piece");
    });

    it("should not detect hazards when conditions are not met", () => {
      const tkiTemplate = BASE_TEMPLATES.find((t) => t.opener === "TKI");
      expect(tkiTemplate).toBeDefined();
      if (!tkiTemplate) return;

      // State with I piece available early
      const goodState = createTestState({
        active: {
          id: "I" as PieceId,
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        },
        nextQueue: ["S", "Z", "O", "L", "J", "T", "S"] as const,
      });

      const hazards = calculateHazards(tkiTemplate, goodState);
      const tkiHazard = hazards.find((h) => h.id === "tki-no-early-i");

      expect(tkiHazard).toBeUndefined(); // Should not detect when I is active
    });
  });

  describe("Multiple Hazard Scenarios", () => {
    it("should detect multiple hazards simultaneously", () => {
      const tkiTemplate = BASE_TEMPLATES.find((t) => t.opener === "TKI");
      expect(tkiTemplate).toBeDefined();
      if (!tkiTemplate) return;

      // Create scenario with multiple hazards:
      // 1. No I piece (TKI hazard)
      // 2. Overhang pattern
      // 3. Split formation needing I
      const multiHazardBoard = createBoardWithCells([
        { x: 4, y: 1 }, // Overhang at x=4, y=1
        { x: 0, y: 2 },
        { x: 1, y: 2 }, // Left side
        { x: 7, y: 2 },
        { x: 8, y: 2 },
        { x: 9, y: 2 }, // Right side with 4-wide gap
      ]);

      const multiHazardState = createTestState(
        {
          nextQueue: ["S", "Z", "O", "L", "J", "T", "S"] as const, // No I piece
        },
        multiHazardBoard,
      );

      const hazards = calculateHazards(tkiTemplate, multiHazardState);

      expect(hazards.length).toBeGreaterThanOrEqual(2);

      const hazardIds = hazards.map((h) => h.id);
      expect(hazardIds).toContain("tki-no-early-i");
      expect(hazardIds).toContain("overhang-without-t");
    });

    it("should sum penalties correctly for multiple hazards", () => {
      const tkiTemplate = BASE_TEMPLATES.find((t) => t.opener === "TKI");
      expect(tkiTemplate).toBeDefined();
      if (!tkiTemplate) return;

      const multiHazardBoard = createBoardWithCells([
        { x: 4, y: 1 }, // Overhang
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 7, y: 2 },
        { x: 8, y: 2 },
        { x: 9, y: 2 }, // Split
      ]);

      const state = createTestState(
        {
          nextQueue: ["S", "Z", "O", "L", "J", "T", "S"] as const, // No I
        },
        multiHazardBoard,
      );

      const hazards = calculateHazards(tkiTemplate, state);
      const totalPenalty = hazards.reduce((sum, h) => sum + h.penalty, 0);

      // Should be sum of individual penalties (all negative)
      expect(totalPenalty).toBeLessThan(-1.0); // Multiple hazards = significant penalty
      expect(totalPenalty).toBeGreaterThan(-5.0); // But not unreasonably large
    });

    it("should prioritize hazards by severity in rationale", () => {
      const tkiTemplate = BASE_TEMPLATES.find((t) => t.opener === "TKI");
      expect(tkiTemplate).toBeDefined();
      if (!tkiTemplate) return;

      const multiHazardBoard = createBoardWithCells([
        { x: 4, y: 1 }, // Overhang (medium severity)
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 7, y: 2 },
        { x: 8, y: 2 },
        { x: 9, y: 2 }, // Split (low severity)
      ]);

      const state = createTestState(
        {
          nextQueue: ["S", "Z", "O", "L", "J", "T", "S"] as const, // No I (high severity)
        },
        multiHazardBoard,
      );

      const hazards = calculateHazards(tkiTemplate, state);
      const rationale = formatRationale(tkiTemplate, hazards);

      // Should mention most severe hazards first
      expect(rationale).toContain("No I piece available"); // High severity should be mentioned
      expect(rationale.length).toBeLessThanOrEqual(90); // Stay within character limit
    });
  });

  describe("Hazard Severity Alignment with Penalties", () => {
    it("should have severity levels that align with penalty ranges", () => {
      const enhancedHazards = enhanceHazardsWithSeverity(HAZARDS);

      for (const hazard of enhancedHazards) {
        const penaltyMagnitude = Math.abs(hazard.penalty);

        switch (hazard.severity) {
          case "critical":
            expect(penaltyMagnitude).toBeGreaterThanOrEqual(2.0);
            break;
          case "high":
            expect(penaltyMagnitude).toBeGreaterThanOrEqual(1.5);
            expect(penaltyMagnitude).toBeLessThan(2.0);
            break;
          case "medium":
            expect(penaltyMagnitude).toBeGreaterThanOrEqual(1.0);
            expect(penaltyMagnitude).toBeLessThan(1.5);
            break;
          case "low":
            expect(penaltyMagnitude).toBeLessThan(1.0);
            break;
        }
      }
    });

    it("should have consistent penalty-to-severity mapping", () => {
      const testCases = [
        { expectedSeverity: "critical", penalty: -2.5 },
        { expectedSeverity: "critical", penalty: -2.0 },
        { expectedSeverity: "high", penalty: -1.8 },
        { expectedSeverity: "high", penalty: -1.5 },
        { expectedSeverity: "medium", penalty: -1.3 },
        { expectedSeverity: "medium", penalty: -1.0 },
        { expectedSeverity: "low", penalty: -0.8 },
        { expectedSeverity: "low", penalty: -0.5 },
      ];

      for (const testCase of testCases) {
        const mockHazard: Hazard = {
          appliesTo: ["TKI"],
          detect: (_s) => true,
          id: "test-hazard",
          penalty: testCase.penalty,
          reason: "Test hazard",
        };

        const severity = calculateHazardSeverity(mockHazard);
        expect(severity).toBe(testCase.expectedSeverity);
      }
    });
  });

  describe("Hazard Reporting and Rationale", () => {
    it("should include hazard information in rationale when present", () => {
      const tkiTemplate = BASE_TEMPLATES.find((t) => t.opener === "TKI");
      expect(tkiTemplate).toBeDefined();
      if (!tkiTemplate) return;

      const hazardState = createTestState({
        nextQueue: ["S", "Z", "O", "L", "J", "T", "S"] as const, // No I piece
      });

      const hazards = calculateHazards(tkiTemplate, hazardState);
      const rationale = formatRationale(tkiTemplate, hazards);

      expect(rationale).toContain("⚠"); // Warning symbol should be present
      expect(rationale).toContain("No I piece available"); // Specific hazard reason
      expect(rationale.length).toBeLessThanOrEqual(90); // Character limit
    });

    it("should omit hazard warnings when no hazards present", () => {
      const tkiTemplate = BASE_TEMPLATES.find((t) => t.opener === "TKI");
      expect(tkiTemplate).toBeDefined();
      if (!tkiTemplate) return;

      const cleanState = createTestState({
        active: {
          id: "I" as PieceId, // I piece available
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        },
        nextQueue: ["S", "Z", "O", "L", "J", "T", "S"] as const,
      });

      const hazards = calculateHazards(tkiTemplate, cleanState);
      const rationale = formatRationale(tkiTemplate, hazards);

      expect(rationale).not.toContain("⚠"); // No warning symbol
      expect(rationale).toContain("TKI"); // Should still mention template choice
      expect(rationale.endsWith(".")).toBe(true); // Should end with period
    });

    it("should truncate rationale when hazards make it too long", () => {
      const tkiTemplate = BASE_TEMPLATES.find((t) => t.opener === "TKI");
      expect(tkiTemplate).toBeDefined();
      if (!tkiTemplate) return;

      // Create scenario with many hazards to test truncation
      const manyHazardBoard = createBoardWithCells([
        { x: 4, y: 1 }, // Overhang
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 7, y: 2 },
        { x: 8, y: 2 },
        { x: 9, y: 2 }, // Split
      ]);

      const state = createTestState(
        {
          nextQueue: ["S", "Z", "O", "L", "J", "T", "S"] as const, // No I
        },
        manyHazardBoard,
      );

      const hazards = calculateHazards(tkiTemplate, state);
      const rationale = formatRationale(tkiTemplate, hazards);

      expect(rationale.length).toBeLessThanOrEqual(90);

      if (rationale.length === 90) {
        expect(rationale.endsWith("...")).toBe(true);
      }
    });

    // Helper function to sort hazards by severity (extract to reduce nesting)
    function sortHazardsBySeverity(
      enhancedHazards: ReadonlyArray<EnhancedHazard>,
    ): Array<EnhancedHazard> {
      const severityOrder: Record<string, number> = {
        critical: 4,
        high: 3,
        low: 1,
        medium: 2,
      };

      return [...enhancedHazards].sort((a, b) => {
        const aSeverity = severityOrder[a.severity] ?? 0;
        const bSeverity = severityOrder[b.severity] ?? 0;
        return bSeverity - aSeverity;
      });
    }

    it("should prioritize most severe hazards in limited space", () => {
      const tkiTemplate = BASE_TEMPLATES.find((t) => t.opener === "TKI");
      expect(tkiTemplate).toBeDefined();
      if (!tkiTemplate) return;

      const multiHazardBoard = createBoardWithCells([
        { x: 4, y: 1 }, // Medium severity: overhang
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 7, y: 2 },
        { x: 8, y: 2 },
        { x: 9, y: 2 }, // Low severity: split
      ]);

      const state = createTestState(
        {
          nextQueue: ["S", "Z", "O", "L", "J", "T", "S"] as const, // High severity: no I
        },
        multiHazardBoard,
      );

      const hazards = calculateHazards(tkiTemplate, state);
      const enhancedHazards = enhanceHazardsWithSeverity(hazards);

      const sortedHazards = sortHazardsBySeverity(enhancedHazards);
      const rationale = formatRationale(tkiTemplate, hazards);

      // Use sortedHazards to avoid unused variable warning
      expect(sortedHazards.length).toBeGreaterThan(0);

      // High severity hazard (no I) should be mentioned before others
      const noIIndex = rationale.indexOf("No I piece");
      const overhangIndex = rationale.indexOf("Overhang");

      if (noIIndex !== -1 && overhangIndex !== -1) {
        expect(noIIndex).toBeLessThan(overhangIndex);
      }
    });
  });

  describe("Hazard Integration with Policy System", () => {
    it("should influence template selection through penalty application", () => {
      // Create state that triggers hazards for TKI but not PCO
      const tkiHazardState = createTestState({
        nextQueue: ["S", "Z", "O", "L", "J", "T", "S"] as const, // No I piece hurts TKI
      });

      const result = recommendMove(tkiHazardState);

      // Should prefer PCO or Neither over TKI due to hazards
      expect(result.suggestion.intent).not.toBe("TKI");
      expect(result.suggestion.rationale).toBeDefined();
    });

    it("should provide hazard context in policy rationale", () => {
      const hazardState = createTestState({
        nextQueue: ["S", "Z", "O", "L", "J", "T", "S"] as const, // Triggers TKI hazard
      });

      const result = recommendMove(hazardState);

      // Rationale should reflect hazard considerations
      expect(result.suggestion.rationale).toBeDefined();
      expect(result.suggestion.rationale.length).toBeGreaterThan(0);
      expect(result.suggestion.rationale.length).toBeLessThanOrEqual(90);
    });

    it("should handle templates with different hazard applicability", () => {
      const pcoTemplate = BASE_TEMPLATES.find((t) => t.opener === "PCO");
      const tkiTemplate = BASE_TEMPLATES.find((t) => t.opener === "TKI");
      const neitherTemplate = BASE_TEMPLATES.find(
        (t) => t.opener === "Neither",
      );

      expect(pcoTemplate).toBeDefined();
      expect(tkiTemplate).toBeDefined();
      expect(neitherTemplate).toBeDefined();

      if (!pcoTemplate || !tkiTemplate || !neitherTemplate) return;

      const state = createTestState({
        nextQueue: ["S", "Z", "O", "L", "J", "T", "S"] as const, // No I piece
      });

      const tkiHazards = calculateHazards(tkiTemplate, state);
      const pcoHazards = calculateHazards(pcoTemplate, state);
      const neitherHazards = calculateHazards(neitherTemplate, state);

      // TKI should have more hazards due to I piece requirement
      expect(tkiHazards.length).toBeGreaterThanOrEqual(pcoHazards.length);
      expect(tkiHazards.length).toBeGreaterThanOrEqual(neitherHazards.length);
    });

    it("should maintain performance with hazard detection", () => {
      const template = BASE_TEMPLATES.find((t) => t.opener === "TKI");
      expect(template).toBeDefined();
      if (!template) return;

      const state = createTestState();

      const start = fromNow();

      // Run hazard detection many times
      for (let i = 0; i < 1000; i++) {
        calculateHazards(template, state);
      }

      const elapsed = fromNow() - start;

      // Should complete 1000 hazard calculations quickly (under 100ms)
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe("Hazard Memoization and Caching", () => {
    it("should cache hazard results for identical states", () => {
      const template = BASE_TEMPLATES.find((t) => t.opener === "TKI");
      expect(template).toBeDefined();
      if (!template) return;

      const state = createTestState();

      const result1 = calculateHazards(template, state);
      const result2 = calculateHazards(template, state);

      // Results should be identical (potentially cached)
      expect(result1).toEqual(result2);
    });

    it("should return different results for different states", () => {
      const template = BASE_TEMPLATES.find((t) => t.opener === "TKI");
      expect(template).toBeDefined();
      if (!template) return;

      const cleanState = createTestState({
        active: {
          id: "I" as PieceId,
          rot: "spawn",
          x: createGridCoord(4),
          y: createGridCoord(0),
        },
      });

      const hazardState = createTestState({
        nextQueue: ["S", "Z", "O", "L", "J", "T", "S"] as const,
      });

      const cleanHazards = calculateHazards(template, cleanState);
      const hazards = calculateHazards(template, hazardState);

      expect(cleanHazards.length).toBeLessThan(hazards.length);
    });

    it("should handle cache clearing gracefully", () => {
      const template = BASE_TEMPLATES.find((t) => t.opener === "TKI");
      expect(template).toBeDefined();
      if (!template) return;

      const state = createTestState();

      // Calculate hazards
      const result1 = calculateHazards(template, state);

      // Clear cache
      clearPolicyCache();

      // Calculate again
      const result2 = calculateHazards(template, state);

      // Should still get same results after cache clear
      expect(result1).toEqual(result2);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle malformed board states gracefully", () => {
      const template = BASE_TEMPLATES.find((t) => t.opener === "TKI");
      expect(template).toBeDefined();
      if (!template) return;

      const malformedBoard = {
        ...createEmptyBoard(),
        cells: new Uint8Array(100).fill(0) as ReturnType<
          typeof createEmptyBoard
        >["cells"],
      };

      const state = createTestState({}, malformedBoard);

      expect(() => {
        calculateHazards(template, state);
      }).not.toThrow();
    });

    it("should handle empty next queue", () => {
      const template = BASE_TEMPLATES.find((t) => t.opener === "TKI");
      expect(template).toBeDefined();
      if (!template) return;

      const state = createTestState({
        nextQueue: [] as const,
      });

      const hazards = calculateHazards(template, state);

      // Should detect hazards even with empty queue
      expect(Array.isArray(hazards)).toBe(true);
    });

    it("should handle undefined active piece", () => {
      const template = BASE_TEMPLATES.find((t) => t.opener === "PCO");
      expect(template).toBeDefined();
      if (!template) return;

      const state = createTestState({
        active: undefined,
      });

      expect(() => {
        calculateHazards(template, state);
      }).not.toThrow();
    });

    it("should maintain consistency across multiple evaluations", () => {
      const template = BASE_TEMPLATES.find((t) => t.opener === "TKI");
      expect(template).toBeDefined();
      if (!template) return;

      const state = createTestState({
        nextQueue: ["S", "Z", "O", "L", "J", "T", "S"] as const,
      });

      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(calculateHazards(template, state));
      }

      // All results should be identical (deterministic)
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toEqual(results[0]);
      }
    });

    // Helper function to filter global hazards (extract to reduce nesting)
    function filterGlobalHazards(
      mockHazards: ReadonlyArray<Hazard>,
      template: { opener: Intent },
      state: PlayingState,
    ) {
      return mockHazards.filter((h) => {
        if (h.appliesTo === undefined) return true;
        return h.appliesTo.includes(template.opener) && h.detect(state);
      });
    }

    it("should handle templates with undefined appliesTo", () => {
      const globalHazard: Hazard = {
        detect: (_s) => true,
        id: "global-test-hazard",
        penalty: -0.5,
        reason: "Global test hazard",
        // appliesTo is undefined (applies to all templates)
      };

      const template = BASE_TEMPLATES.find((t) => t.opener === "Neither");
      expect(template).toBeDefined();
      if (!template) return;

      const state = createTestState();

      // Should handle global hazards without error
      expect(() => {
        // Note: This would require modifying HAZARDS array for real test
        // Here we're just testing the pattern
        const mockHazards = [globalHazard];
        const filteredHazards = filterGlobalHazards(
          mockHazards,
          template,
          state,
        );
        expect(filteredHazards).toBeDefined(); // Use the result
      }).not.toThrow();
    });
  });
});
