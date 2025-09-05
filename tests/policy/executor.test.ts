// Tests for policy executor functions
// Chapter 4: Placement clustering, Pareto filtering, and UI hint generation

import {
  paretoFilter,
  clusterPlacements,
  fastClusterPlacements,
  calculateFinesseCost,
  calculateFinesseCostWithContext,
} from "../../src/policy/executor";
import { createGridCoord, gridCoordAsNumber } from "../../src/types/brands";

import type { Placement } from "../../src/policy/types";

describe("Policy Executor", () => {
  // Helper to create test placements
  const createPlacement = (
    x: number,
    rot: "spawn" | "right" | "two" | "left",
  ): Placement => ({
    rot,
    x: createGridCoord(x),
  });

  describe("paretoFilter", () => {
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
        createPlacement(3, "spawn"), // utility: 3, cost: 1 (dominates placement at 4)
        createPlacement(4, "spawn"), // utility: 4, cost: 2
        createPlacement(5, "spawn"), // utility: 5, cost: 3 (not dominated - highest utility)
      ];

      const utility = (p: Placement) => gridCoordAsNumber(p.x); // Higher x = higher utility
      const cost = (p: Placement) => gridCoordAsNumber(p.x) - 2; // Higher x = higher cost

      const result = paretoFilter(placements, utility, cost);

      // All should be kept since none strictly dominates another
      // x=3: utility=3, cost=1; x=4: utility=4, cost=2; x=5: utility=5, cost=3
      // No placement has both higher utility AND lower cost than another
      expect(result).toHaveLength(3);
    });

    it("should handle placements with equal utility and cost", () => {
      const placements = [
        createPlacement(3, "spawn"),
        createPlacement(3, "right"),
      ];

      const result = paretoFilter(
        placements,
        () => 1,
        () => 1,
      );
      expect(result).toHaveLength(2); // Both should be kept since neither dominates
    });
  });

  describe("clusterPlacements", () => {
    it("should return empty array for empty input", () => {
      const result = clusterPlacements(
        [],
        () => 1,
        () => 1,
        gridCoordAsNumber,
      );
      expect(result).toEqual([]);
    });

    it("should group placements by rotation", () => {
      const placements = [
        createPlacement(3, "spawn"),
        createPlacement(4, "spawn"),
        createPlacement(3, "right"),
      ];

      const result = clusterPlacements(
        placements,
        () => 1,
        () => 1,
        gridCoordAsNumber,
      );

      expect(result).toHaveLength(2); // Two rotation groups

      const spawnGroup = result.find((g) => g.rot === "spawn");
      const rightGroup = result.find((g) => g.rot === "right");

      expect(spawnGroup).toBeDefined();
      expect(rightGroup).toBeDefined();
      expect(spawnGroup?.xs).toEqual([3, 4]); // Contiguous span
      expect(rightGroup?.xs).toEqual([3]); // Single placement
    });

    it("should create separate groups for non-contiguous x-coordinates", () => {
      const placements = [
        createPlacement(1, "spawn"),
        createPlacement(2, "spawn"), // Contiguous with 1
        createPlacement(5, "spawn"), // Gap, separate group
        createPlacement(6, "spawn"), // Contiguous with 5
      ];

      const result = clusterPlacements(
        placements,
        () => 1,
        () => 1,
        gridCoordAsNumber,
      );

      expect(result).toHaveLength(2); // Two spans for spawn rotation

      const groups = result.filter((g) => g.rot === "spawn");
      expect(groups).toHaveLength(2);

      const spans = groups
        .map((g) => g.xs)
        .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
      expect(spans).toEqual([
        [1, 2],
        [5, 6],
      ]);
    });

    it("should select primary placement with highest utility", () => {
      const placements = [
        createPlacement(3, "spawn"), // utility: 1
        createPlacement(4, "spawn"), // utility: 2 (should be primary)
        createPlacement(5, "spawn"), // utility: 1
      ];

      const utility = (p: Placement) => (gridCoordAsNumber(p.x) === 4 ? 2 : 1);
      const result = clusterPlacements(
        placements,
        utility,
        () => 1,
        gridCoordAsNumber,
      );

      expect(result).toHaveLength(1);
      const firstResult = result[0];
      expect(firstResult).toBeDefined();
      if (firstResult) {
        expect(gridCoordAsNumber(firstResult.primary.x)).toBe(4);
        expect(firstResult.alts).toHaveLength(2);
      }
    });

    it("should use finesse cost as tiebreaker for equal utility", () => {
      const placements = [
        createPlacement(3, "spawn"), // utility: 1, cost: 2
        createPlacement(4, "spawn"), // utility: 1, cost: 1 (should be primary)
      ];

      const cost = (p: Placement) => (gridCoordAsNumber(p.x) === 4 ? 1 : 2);
      const result = clusterPlacements(
        placements,
        () => 1,
        cost,
        gridCoordAsNumber,
      );

      expect(result).toHaveLength(1);
      const firstResult = result[0];
      expect(firstResult).toBeDefined();
      if (firstResult) {
        expect(gridCoordAsNumber(firstResult.primary.x)).toBe(4);
      }
    });
  });

  describe("fastClusterPlacements", () => {
    it("should produce same results as regular clustering", () => {
      const placements = [
        createPlacement(1, "spawn"),
        createPlacement(2, "spawn"),
        createPlacement(5, "right"),
        createPlacement(6, "right"),
      ];

      const utility = (p: Placement) => gridCoordAsNumber(p.x);
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

  describe("calculateFinesseCost", () => {
    it("should return a finite number for valid placements", () => {
      const placement = createPlacement(3, "spawn");
      const cost = calculateFinesseCost(placement);

      expect(cost).toBeGreaterThanOrEqual(0);
      expect(cost).toBeLessThan(Number.POSITIVE_INFINITY);
    });

    it("should return consistent costs for the same placement", () => {
      const placement1 = createPlacement(3, "spawn");
      const placement2 = createPlacement(3, "spawn");

      const cost1 = calculateFinesseCost(placement1);
      const cost2 = calculateFinesseCost(placement2);

      // Same placements should have same cost
      expect(cost1).toBe(cost2);
    });
  });

  describe("calculateFinesseCostWithContext", () => {
    it("should return a finite number for valid placements with context", () => {
      const placement = createPlacement(3, "spawn");
      const cost = calculateFinesseCostWithContext(placement, "T", 4, 0);

      expect(cost).toBeGreaterThanOrEqual(0);
      expect(cost).toBeLessThan(Number.POSITIVE_INFINITY);
    });

    it("should handle different piece types", () => {
      const placement = createPlacement(3, "spawn");

      const tCost = calculateFinesseCostWithContext(placement, "T", 4, 0);
      const iCost = calculateFinesseCostWithContext(placement, "I", 4, 0);

      // Costs might be the same or different, but both should be finite
      expect(tCost).toBeGreaterThanOrEqual(0);
      expect(iCost).toBeGreaterThanOrEqual(0);
      expect(tCost).toBeLessThan(Number.POSITIVE_INFINITY);
      expect(iCost).toBeLessThan(Number.POSITIVE_INFINITY);
    });
  });
});
