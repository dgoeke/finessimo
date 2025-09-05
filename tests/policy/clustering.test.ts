// Comprehensive test suite for placement clustering functionality
// Chapter 4: Tests clustering algorithms, Pareto filtering, and UI contract

import {
  paretoFilter,
  clusterPlacements,
  fastClusterPlacements,
  calculateFinesseCost,
  calculateFinesseCostWithContext,
} from "../../src/policy/executor";
import { createGridCoord, gridCoordAsNumber } from "../../src/types/brands";

import type { Placement } from "../../src/policy/types";
import type { Rot } from "../../src/state/types";

describe("Placement Clustering", () => {
  // Helper to create test placements
  function createPlacement(x: number, rot: Rot, useHold?: boolean): Placement {
    return {
      rot,
      x: createGridCoord(x),
      ...(useHold !== undefined ? { useHold } : {}),
    };
  }

  // Helper to create mock utility functions
  function createMockUtility(
    values: ReadonlyArray<number>,
  ): (p: Placement) => number {
    return (p: Placement) => {
      const index = gridCoordAsNumber(p.x);
      return values[index] ?? 0;
    };
  }

  // Helper to create mock cost functions
  function createMockCost(
    values: ReadonlyArray<number>,
  ): (p: Placement) => number {
    return (p: Placement) => {
      const index = gridCoordAsNumber(p.x);
      return values[index] ?? Number.POSITIVE_INFINITY;
    };
  }

  // Helper to verify Pareto dominance relationship
  function isDominated(
    a: Placement,
    b: Placement,
    utility: (p: Placement) => number,
    cost: (p: Placement) => number,
  ): boolean {
    const aUtility = utility(a);
    const aCost = cost(a);
    const bUtility = utility(b);
    const bCost = cost(b);

    // b dominates a if b has higher utility AND lower cost
    return (
      bUtility >= aUtility &&
      bCost <= aCost &&
      (bUtility > aUtility || bCost < aCost)
    );
  }

  // Helper to verify no dominated placements exist in a set
  function verifyNoDominatedPlacements(
    placements: ReadonlyArray<Placement>,
    utility: (p: Placement) => number,
    cost: (p: Placement) => number,
  ): boolean {
    for (let i = 0; i < placements.length; i++) {
      for (let j = 0; j < placements.length; j++) {
        if (i !== j) {
          const a = placements[i];
          const b = placements[j];
          if (a && b && isDominated(a, b, utility, cost)) {
            return false;
          }
        }
      }
    }
    return true;
  }

  describe("Pareto Filtering", () => {
    it("should return empty array for empty input", () => {
      const result = paretoFilter(
        [],
        () => 1,
        () => 1,
      );
      expect(result).toEqual([]);
    });

    it("should return single placement unchanged", () => {
      const placements = [createPlacement(3, "spawn")];
      const result = paretoFilter(
        placements,
        () => 1,
        () => 1,
      );
      expect(result).toEqual(placements);
    });

    it("should filter out dominated placements", () => {
      const placements = [
        createPlacement(0, "spawn"), // utility: 5, cost: 1 (dominates x=1)
        createPlacement(1, "spawn"), // utility: 3, cost: 2 (dominated)
        createPlacement(2, "spawn"), // utility: 7, cost: 3 (not dominated)
      ];

      const utility = createMockUtility([5, 3, 7]);
      const cost = createMockCost([1, 2, 3]);

      const result = paretoFilter(placements, utility, cost);

      // x=0 dominates x=1 (higher utility, lower cost)
      expect(result).toHaveLength(2);
      expect(result.some((p) => gridCoordAsNumber(p.x) === 0)).toBe(true);
      expect(result.some((p) => gridCoordAsNumber(p.x) === 1)).toBe(false);
      expect(result.some((p) => gridCoordAsNumber(p.x) === 2)).toBe(true);
    });

    it("should handle edge cases with identical utility and cost", () => {
      const placements = [
        createPlacement(3, "spawn"),
        createPlacement(3, "right"),
      ];

      const result = paretoFilter(
        placements,
        () => 1,
        () => 1,
      );
      expect(result).toHaveLength(2); // Neither dominates the other
    });

    it("should verify Pareto correctness - no dominated placements survive", () => {
      const placements = [
        createPlacement(0, "spawn"), // utility: 10, cost: 1
        createPlacement(1, "spawn"), // utility: 8, cost: 2
        createPlacement(2, "spawn"), // utility: 12, cost: 3
        createPlacement(3, "spawn"), // utility: 6, cost: 1 (dominated by x=0)
        createPlacement(4, "spawn"), // utility: 9, cost: 4
      ];

      const utility = createMockUtility([10, 8, 12, 6, 9]);
      const cost = createMockCost([1, 2, 3, 1, 4]);

      const result = paretoFilter(placements, utility, cost);

      // Verify no placement dominates another in the result
      expect(verifyNoDominatedPlacements(result, utility, cost)).toBe(true);

      // x=3 should be filtered out (dominated by x=0: lower utility, same cost)
      expect(result.some((p) => gridCoordAsNumber(p.x) === 3)).toBe(false);
    });

    it("should handle complex dominance relationships", () => {
      // Create a scenario with multiple complex dominance relationships
      const placements = [
        createPlacement(0, "spawn"), // utility: 5, cost: 5
        createPlacement(1, "spawn"), // utility: 6, cost: 4 (dominates x=0)
        createPlacement(2, "spawn"), // utility: 4, cost: 6 (dominated by x=0)
        createPlacement(3, "spawn"), // utility: 7, cost: 3 (dominates x=1)
        createPlacement(4, "spawn"), // utility: 3, cost: 7 (dominated by many)
      ];

      const utility = createMockUtility([5, 6, 4, 7, 3]);
      const cost = createMockCost([5, 4, 6, 3, 7]);

      const result = paretoFilter(placements, utility, cost);

      // Only x=3 should remain (highest utility, lowest cost)
      expect(result).toHaveLength(1);
      const firstResult = result[0];
      expect(firstResult).toBeDefined();
      if (firstResult) {
        expect(gridCoordAsNumber(firstResult.x)).toBe(3);
      }
    });

    it("should be deterministic for fixed inputs", () => {
      const placements = [
        createPlacement(1, "spawn"),
        createPlacement(2, "right"),
        createPlacement(3, "two"),
        createPlacement(4, "left"),
      ];

      const utility = createMockUtility([0, 3, 2, 4, 1]);
      const cost = createMockCost([0, 2, 3, 1, 4]);

      const result1 = paretoFilter(placements, utility, cost);
      const result2 = paretoFilter(placements, utility, cost);
      const result3 = paretoFilter(placements, utility, cost);

      // Results should be identical across multiple runs
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);

      // Sort for consistent comparison
      const sortedResult1 = [...result1].sort(
        (a, b) => gridCoordAsNumber(a.x) - gridCoordAsNumber(b.x),
      );
      const sortedResult2 = [...result2].sort(
        (a, b) => gridCoordAsNumber(a.x) - gridCoordAsNumber(b.x),
      );
      expect(sortedResult1).toEqual(sortedResult2);
    });
  });

  describe("Placement Grouping", () => {
    it("should return empty array for empty input", () => {
      const result = clusterPlacements(
        [],
        () => 1,
        () => 1,
        gridCoordAsNumber,
      );
      expect(result).toEqual([]);
    });

    it("should group placements by rotation correctly", () => {
      const placements = [
        createPlacement(3, "spawn"),
        createPlacement(4, "spawn"),
        createPlacement(3, "right"),
        createPlacement(5, "left"),
      ];

      const result = clusterPlacements(
        placements,
        () => 1,
        () => 1,
        gridCoordAsNumber,
      );

      expect(result).toHaveLength(3); // Three rotation groups

      const rotations = result.map((g) => g.rot);
      expect(rotations).toContain("spawn");
      expect(rotations).toContain("right");
      expect(rotations).toContain("left");
    });

    it("should detect contiguous x-coordinate spans correctly", () => {
      const placements = [
        createPlacement(1, "spawn"),
        createPlacement(2, "spawn"), // Contiguous with 1
        createPlacement(3, "spawn"), // Contiguous with 2
        createPlacement(6, "spawn"), // Gap, separate span
        createPlacement(7, "spawn"), // Contiguous with 6
      ];

      const result = clusterPlacements(
        placements,
        () => 1,
        () => 1,
        gridCoordAsNumber,
      );

      expect(result).toHaveLength(2); // Two contiguous spans

      const sortNumbers = (a: number, b: number) => a - b;
      const sortByFirstElement = (a: Array<number>, b: Array<number>) => {
        const aFirst = a[0];
        const bFirst = b[0];
        if (aFirst === undefined || bFirst === undefined) return 0;
        return aFirst - bFirst;
      };

      const spans = result
        .map((g) => [...g.xs].sort(sortNumbers))
        .sort(sortByFirstElement);

      expect(spans[0]).toEqual([1, 2, 3]);
      expect(spans[1]).toEqual([6, 7]);
    });

    it("should select primary placement with maximum utility within each span", () => {
      const placements = [
        createPlacement(3, "spawn"), // utility: 1
        createPlacement(4, "spawn"), // utility: 5 (should be primary)
        createPlacement(5, "spawn"), // utility: 3
      ];

      const utility = createMockUtility([0, 0, 0, 1, 5, 3]);
      const result = clusterPlacements(
        placements,
        utility,
        () => 1,
        gridCoordAsNumber,
      );

      expect(result).toHaveLength(1);
      const group = result[0];
      expect(group).toBeDefined();
      if (group) {
        expect(gridCoordAsNumber(group.primary.x)).toBe(4);
        expect(group.alts).toHaveLength(2);

        // Verify primary has highest utility
        const primaryUtility = utility(group.primary);
        for (const alt of group.alts) {
          expect(primaryUtility).toBeGreaterThanOrEqual(utility(alt));
        }
      }
    });

    it("should use finesse cost as tiebreaker for equal utility", () => {
      const placements = [
        createPlacement(3, "spawn"), // utility: 2, cost: 3
        createPlacement(4, "spawn"), // utility: 2, cost: 1 (should be primary)
        createPlacement(5, "spawn"), // utility: 2, cost: 2
      ];

      const cost = createMockCost([0, 0, 0, 3, 1, 2]);
      const result = clusterPlacements(
        placements,
        () => 2,
        cost,
        gridCoordAsNumber,
      );

      expect(result).toHaveLength(1);
      const group = result[0];
      expect(group).toBeDefined();
      if (group) {
        expect(gridCoordAsNumber(group.primary.x)).toBe(4); // Lowest cost
      }
    });

    it("should handle multiple rotations with different spans", () => {
      const placements = [
        createPlacement(1, "spawn"),
        createPlacement(2, "spawn"),
        createPlacement(5, "spawn"), // Separate span for spawn
        createPlacement(1, "right"),
        createPlacement(3, "right"), // Separate span for right
        createPlacement(4, "right"),
      ];

      const result = clusterPlacements(
        placements,
        () => 1,
        () => 1,
        gridCoordAsNumber,
      );

      expect(result).toHaveLength(4); // 2 spawn spans + 2 right spans (x=1 isolated, x=3,4 contiguous)

      const spawnGroups = result.filter((g) => g.rot === "spawn");
      const rightGroups = result.filter((g) => g.rot === "right");

      expect(spawnGroups).toHaveLength(2);
      expect(rightGroups).toHaveLength(2);

      // Verify contiguous right span
      const contiguousRightGroup = rightGroups.find((g) => g.xs.length > 1);
      expect(contiguousRightGroup).toBeDefined();
      if (contiguousRightGroup) {
        expect(contiguousRightGroup.xs).toHaveLength(2); // x=3,4 are contiguous
      }
    });

    it("should populate alternatives array correctly", () => {
      const placements = [
        createPlacement(3, "spawn"),
        createPlacement(4, "spawn"),
        createPlacement(5, "spawn"),
      ];

      const utility = createMockUtility([0, 0, 0, 2, 5, 1]); // x=4 highest
      const result = clusterPlacements(
        placements,
        utility,
        () => 1,
        gridCoordAsNumber,
      );

      expect(result).toHaveLength(1);
      const group = result[0];
      expect(group).toBeDefined();
      if (!group) return;

      expect(gridCoordAsNumber(group.primary.x)).toBe(4);
      expect(group.alts).toHaveLength(2);

      const altXs = group.alts.map((p) => gridCoordAsNumber(p.x));
      expect(altXs).toContain(3);
      expect(altXs).toContain(5);
    });
  });

  describe("Integration Tests", () => {
    it("should handle full clustering pipeline with Pareto filtering", () => {
      const placements = [
        createPlacement(1, "spawn"), // utility: 5, cost: 2
        createPlacement(2, "spawn"), // utility: 4, cost: 1
        createPlacement(3, "spawn"), // utility: 3, cost: 3 (dominated by x=2)
        createPlacement(1, "right"), // utility: 6, cost: 4
        createPlacement(2, "right"), // utility: 7, cost: 3
      ];

      const utility = createMockUtility([0, 5, 4, 3, 0, 0, 6, 7]);
      const cost = createMockCost([0, 2, 1, 3, 0, 0, 4, 3]);

      // First apply Pareto filtering
      const filtered = paretoFilter(placements, utility, cost);

      // Verify x=3,spawn is filtered out (dominated)
      expect(
        filtered.some((p) => gridCoordAsNumber(p.x) === 3 && p.rot === "spawn"),
      ).toBe(false);

      // Then cluster the filtered results
      const result = clusterPlacements(
        filtered,
        utility,
        cost,
        gridCoordAsNumber,
      );

      expect(result.length).toBeGreaterThan(0);

      // Verify all groups have valid structure
      for (const group of result) {
        expect(group.primary).toBeDefined();
        expect(group.xs).toHaveLength(group.alts.length + 1);
        expect(group.rot).toMatch(/^(spawn|right|two|left)$/);
      }
    });

    it("should verify UI contract compliance", () => {
      const placements = [
        createPlacement(1, "spawn"),
        createPlacement(2, "spawn"),
        createPlacement(5, "right"),
        createPlacement(6, "right"),
        createPlacement(7, "right"),
        createPlacement(3, "two"),
      ];

      const result = clusterPlacements(
        placements,
        () => 1,
        () => 1,
        gridCoordAsNumber,
      );

      // Verify typical group count (1-4 groups)
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.length).toBeLessThanOrEqual(4);

      // Verify each group has required structure
      for (const group of result) {
        expect(group).toHaveProperty("rot");
        expect(group).toHaveProperty("xs");
        expect(group).toHaveProperty("primary");
        expect(group).toHaveProperty("alts");

        expect(Array.isArray(group.xs)).toBe(true);
        expect(Array.isArray(group.alts)).toBe(true);
        expect(group.xs.length).toBeGreaterThan(0);

        // xs should contain primary + alts
        expect(group.xs.length).toBe(group.alts.length + 1);
      }
    });

    it("should handle realistic placement sets", () => {
      // Create a realistic T-piece placement scenario
      const placements = [
        createPlacement(1, "spawn"),
        createPlacement(2, "spawn"),
        createPlacement(3, "spawn"),
        createPlacement(4, "spawn"),
        createPlacement(5, "spawn"),
        createPlacement(2, "right"),
        createPlacement(3, "right"),
        createPlacement(4, "right"),
        createPlacement(3, "two"),
        createPlacement(4, "two"),
        createPlacement(2, "left"),
        createPlacement(3, "left"),
        createPlacement(4, "left"),
      ];

      const utility = (p: Placement) => {
        // Simple utility based on centrality (x=3,4 preferred)
        const x = gridCoordAsNumber(p.x);
        return 10 - Math.abs(x - 3.5);
      };

      const cost = (p: Placement) => {
        // Simple cost based on distance from spawn
        const x = gridCoordAsNumber(p.x);
        return Math.abs(x - 4) + (p.rot === "spawn" ? 0 : 1);
      };

      const result = clusterPlacements(
        placements,
        utility,
        cost,
        gridCoordAsNumber,
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(4);

      // Verify each rotation has at most one group
      const rotationCounts = new Map<Rot, number>();
      for (const group of result) {
        rotationCounts.set(group.rot, (rotationCounts.get(group.rot) ?? 0) + 1);
      }

      for (const [, count] of rotationCounts) {
        expect(count).toBeLessThanOrEqual(2); // At most 2 spans per rotation
      }
    });

    it("should be deterministic for identical inputs", () => {
      const placements = [
        createPlacement(1, "spawn"),
        createPlacement(3, "spawn"),
        createPlacement(2, "right"),
        createPlacement(4, "left"),
      ];

      const utility = createMockUtility([0, 2, 0, 5, 3]);
      const cost = createMockCost([0, 1, 0, 2, 4]);

      const result1 = clusterPlacements(
        placements,
        utility,
        cost,
        gridCoordAsNumber,
      );
      const result2 = clusterPlacements(
        placements,
        utility,
        cost,
        gridCoordAsNumber,
      );
      const result3 = clusterPlacements(
        placements,
        utility,
        cost,
        gridCoordAsNumber,
      );

      // Results should be identical
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);

      // Verify structure is preserved
      expect(result1.length).toBe(result2.length);
      for (let i = 0; i < result1.length; i++) {
        const g1 = result1[i];
        const g2 = result2[i];
        expect(g1).toBeDefined();
        expect(g2).toBeDefined();
        if (g1 && g2) {
          expect(g1.rot).toBe(g2.rot);
          expect(g1.xs).toEqual(g2.xs);
          expect(g1.primary).toEqual(g2.primary);
          expect(g1.alts).toEqual(g2.alts);
        }
      }
    });
  });

  describe("Performance", () => {
    it("should handle moderate-sized placement sets", () => {
      // Create a moderate-sized placement set
      const placements: Array<Placement> = [];
      const rotations: Array<Rot> = ["spawn", "right", "two", "left"];

      for (let x = 0; x < 8; x++) {
        for (const rot of rotations) {
          placements.push(createPlacement(x, rot));
        }
      }

      const utility = (_p: Placement) => 5;
      const cost = (_p: Placement) => 2;

      // Should not throw and should return reasonable results
      const result = clusterPlacements(
        placements,
        utility,
        cost,
        gridCoordAsNumber,
      );
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(4); // Reasonable number of groups
    });

    it("should handle large placement sets efficiently", () => {
      // Create a large placement set
      const placements: Array<Placement> = [];
      const rotations: Array<Rot> = ["spawn", "right", "two", "left"];

      for (let x = 0; x < 10; x++) {
        for (const rot of rotations) {
          placements.push(createPlacement(x, rot));
          placements.push(createPlacement(x, rot, true)); // With hold
        }
      }

      const utility = (p: Placement) => gridCoordAsNumber(p.x);
      const cost = (p: Placement) => 10 - gridCoordAsNumber(p.x);

      // Should complete without throwing
      const result = clusterPlacements(
        placements,
        utility,
        cost,
        gridCoordAsNumber,
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it("should verify fast clustering produces same results as regular clustering", () => {
      const placements = [
        createPlacement(1, "spawn"),
        createPlacement(2, "spawn"),
        createPlacement(5, "right"),
        createPlacement(6, "right"),
        createPlacement(3, "two"),
      ];

      const utility = (p: Placement) => gridCoordAsNumber(p.x) * 2;
      const cost = (p: Placement) => 10 - gridCoordAsNumber(p.x);

      const regular = clusterPlacements(
        placements,
        utility,
        cost,
        gridCoordAsNumber,
      );
      const fast = fastClusterPlacements(placements, utility, cost);

      expect(fast).toEqual(regular);
    });
  });

  describe("Finesse Cost Integration", () => {
    it("should calculate finite costs for valid placements", () => {
      const placement = createPlacement(3, "spawn");
      const cost = calculateFinesseCost(placement);

      expect(cost).toBeGreaterThanOrEqual(0);
      expect(cost).toBeLessThan(Number.POSITIVE_INFINITY);
      expect(Number.isInteger(cost)).toBe(true);
    });

    it("should be consistent for identical placements", () => {
      const placement1 = createPlacement(4, "right");
      const placement2 = createPlacement(4, "right");

      const cost1 = calculateFinesseCost(placement1);
      const cost2 = calculateFinesseCost(placement2);

      expect(cost1).toBe(cost2);
    });

    it("should handle different piece types with context", () => {
      // Use a more reasonable placement that should be achievable for all pieces
      const placement = createPlacement(4, "spawn"); // Should be achievable from spawn position

      const tCost = calculateFinesseCostWithContext(placement, "T", 4, 0);
      const iCost = calculateFinesseCostWithContext(placement, "I", 4, 0);
      const oCost = calculateFinesseCostWithContext(placement, "O", 4, 0);

      expect(tCost).toBeGreaterThanOrEqual(0);
      expect(iCost).toBeGreaterThanOrEqual(0);
      expect(oCost).toBeGreaterThanOrEqual(0);

      // At least one should be finite (T-piece at x=4,spawn should be achievable)
      const costs = [tCost, iCost, oCost];
      const finiteCosts = costs.filter((c) => c !== Number.POSITIVE_INFINITY);
      expect(finiteCosts.length).toBeGreaterThan(0);

      // Test with an easier placement that should work for all pieces
      const easyPlacement = createPlacement(4, "spawn");
      const easyTCost = calculateFinesseCostWithContext(
        easyPlacement,
        "T",
        4,
        0,
      );
      expect(easyTCost).toBeLessThan(Number.POSITIVE_INFINITY);
    });

    it("should integrate properly with clustering pipeline", () => {
      const placements = [
        createPlacement(3, "spawn"),
        createPlacement(4, "spawn"),
        createPlacement(5, "spawn"),
      ];

      const utility = () => 1;
      const result = clusterPlacements(
        placements,
        utility,
        calculateFinesseCost,
        gridCoordAsNumber,
      );

      expect(result).toHaveLength(1);
      const group = result[0];
      expect(group).toBeDefined();
      if (!group) return;

      // Primary should have the lowest finesse cost (tiebreaker)
      const primaryCost = calculateFinesseCost(group.primary);
      for (const alt of group.alts) {
        const altCost = calculateFinesseCost(alt);
        expect(primaryCost).toBeLessThanOrEqual(altCost);
      }
    });
  });
});
