// Policy executor for Chapter 4: Placement clustering, Pareto filtering, and UI hint generation
// Handles finesse cost integration and performance-optimized clustering operations

import { createEmptyBoard } from "../core/board";
import { finesseCalculator } from "../finesse/calculator";
import {
  gridCoordAsNumber,
  createGridCoord,
  createDurationMs,
  type GridCoord,
} from "../types/brands";

import type { Placement, PlacementGroup } from "./types";
import type { Rot, GameplayConfig } from "../state/types";

/**
 * Pareto filter function: removes dominated placements based on (utility↑, finesseCost↓)
 * A placement P1 dominates P2 if P1 has higher utility AND lower finesse cost
 *
 * @param ps - Array of placements to filter
 * @param utility - Function to calculate utility (higher is better)
 * @param finesseCost - Function to calculate finesse cost (lower is better)
 * @returns Array of non-dominated placements
 */
/**
 * Helper function to check if one placement dominates another
 */
function dominates(
  a: { utility: number; cost: number },
  b: { utility: number; cost: number },
): boolean {
  return (
    a.utility >= b.utility &&
    a.cost <= b.cost &&
    (a.utility > b.utility || a.cost < b.cost)
  );
}

/**
 * Filter placements to remove dominated ones
 */
function filterDominated(
  withScores: Array<{ placement: Placement; utility: number; cost: number }>,
  candidate: { placement: Placement; utility: number; cost: number },
): Array<{ placement: Placement; utility: number; cost: number }> {
  return withScores.filter((existing) => !dominates(candidate, existing));
}

export function paretoFilter(
  ps: ReadonlyArray<Placement>,
  utility: (p: Placement) => number,
  finesseCost: (p: Placement) => number,
): ReadonlyArray<Placement> {
  if (ps.length <= 1) return ps;

  // Pre-compute utility and cost for all placements to avoid repeated calculations
  const withScores = ps.map((p) => ({
    cost: finesseCost(p),
    placement: p,
    utility: utility(p),
  }));

  let nonDominated: typeof withScores = [];

  for (const candidate of withScores) {
    // Check if candidate is dominated by any existing non-dominated placement
    const isDominated = nonDominated.some((existing) =>
      dominates(existing, candidate),
    );

    if (!isDominated) {
      // Remove any existing placements dominated by the candidate
      nonDominated = filterDominated(nonDominated, candidate);
      nonDominated.push(candidate);
    }
  }

  return nonDominated.map((item) => item.placement);
}

/**
 * Group placements by rotation
 */
function groupPlacementsByRotation(
  ps: ReadonlyArray<Placement>,
): Map<Rot, Array<Placement>> {
  const rotationGroups = new Map<Rot, Array<Placement>>();

  for (const p of ps) {
    const existing = rotationGroups.get(p.rot);
    if (existing) {
      existing.push(p);
    } else {
      rotationGroups.set(p.rot, [p]);
    }
  }

  return rotationGroups;
}

/**
 * Create contiguous spans from sorted placements
 */
function createContiguousSpans(
  sortedPlacements: ReadonlyArray<Placement>,
  gridCoordAsNumberHelper: (x: GridCoord) => number,
): Array<Array<Placement>> {
  const spans: Array<Array<Placement>> = [];
  let currentSpan: Array<Placement> = [];

  for (const p of sortedPlacements) {
    if (currentSpan.length === 0) {
      currentSpan = [p];
    } else {
      const lastPlacement = currentSpan[currentSpan.length - 1];
      if (!lastPlacement) continue;

      const lastX = gridCoordAsNumberHelper(lastPlacement.x);
      const currentX = gridCoordAsNumberHelper(p.x);

      if (currentX === lastX + 1) {
        currentSpan.push(p);
      } else {
        spans.push([...currentSpan]);
        currentSpan = [p];
      }
    }
  }

  if (currentSpan.length > 0) {
    spans.push(currentSpan);
  }

  return spans;
}

/**
 * Find primary placement in a span
 */
function findPrimaryPlacement(
  span: ReadonlyArray<Placement>,
  utility: (p: Placement) => number,
  finesseCost: (p: Placement) => number,
): Placement | null {
  const firstPlacement = span[0];
  if (!firstPlacement) return null;

  let primary = firstPlacement;
  let maxUtility = utility(primary);

  for (const candidate of span.slice(1)) {
    const candidateUtility = utility(candidate);

    if (
      candidateUtility > maxUtility ||
      (candidateUtility === maxUtility &&
        finesseCost(candidate) < finesseCost(primary))
    ) {
      primary = candidate;
      maxUtility = candidateUtility;
    }
  }

  return primary;
}

/**
 * Groups placements by rotation and clusters contiguous x-coordinate spans
 * Selects primary placement with highest utility within each span
 */
export function clusterPlacements(
  ps: ReadonlyArray<Placement>,
  utility: (p: Placement) => number,
  finesseCost: (p: Placement) => number,
  gridCoordAsNumberHelper: (x: GridCoord) => number,
): ReadonlyArray<PlacementGroup> {
  if (ps.length === 0) return [];

  const rotationGroups = groupPlacementsByRotation(ps);
  const groups: Array<PlacementGroup> = [];

  for (const [rot, placements] of rotationGroups) {
    const sortedPlacements = [...placements].sort(
      (a, b) => gridCoordAsNumberHelper(a.x) - gridCoordAsNumberHelper(b.x),
    );

    const spans = createContiguousSpans(
      sortedPlacements,
      gridCoordAsNumberHelper,
    );

    for (const span of spans) {
      if (span.length === 0) continue;

      const primary = findPrimaryPlacement(span, utility, finesseCost);
      if (!primary) continue;

      const alts = span.filter((p) => p !== primary);
      const xs = span.map((p) => gridCoordAsNumberHelper(p.x));

      groups.push({ alts, primary, rot, xs });
    }
  }

  return groups;
}

/**
 * Calculate finesse cost for a placement using the existing finesse calculator
 * Uses empty board for consistent cost calculation across all placements
 *
 * @param placement - The placement to calculate cost for
 * @returns Number of finesse actions required, or Infinity if placement is impossible
 */
export function calculateFinesseCost(placement: Placement): number {
  // Create a mock active piece for finesse calculation
  // We need to determine piece type - this is a simplified version
  // In real usage, this would need the actual piece type from context

  // For now, use a generic spawn position and let the calculator determine optimal path
  const mockPiece = {
    id: "T" as const, // Placeholder - would need actual piece type from context
    rot: "spawn" as const,
    x: createGridCoord(4), // Standard spawn x-position
    y: createGridCoord(0), // Standard spawn y-position
  };

  const emptyBoard = createEmptyBoard();
  const targetX = gridCoordAsNumber(placement.x);
  const targetRot = placement.rot;

  const config: GameplayConfig = {
    finesseCancelMs: createDurationMs(50),
    holdEnabled: false,
    openingCoachingEnabled: false,
  };

  const optimalSequence = finesseCalculator.calculateOptimal(
    mockPiece,
    targetX,
    targetRot,
    config,
    emptyBoard,
  );

  return optimalSequence?.length ?? Number.POSITIVE_INFINITY;
}

/**
 * Enhanced finesse cost calculation that accounts for piece type and board state
 * This version should be used when piece context is available
 *
 * @param placement - The placement to calculate cost for
 * @param pieceId - The piece type (T, I, O, S, Z, J, L)
 * @param spawnX - The spawn x-coordinate for the piece
 * @param spawnY - The spawn y-coordinate for the piece
 * @returns Number of finesse actions required, or Infinity if placement is impossible
 */
export function calculateFinesseCostWithContext(
  placement: Placement,
  pieceId: "T" | "I" | "O" | "S" | "Z" | "J" | "L",
  spawnX = 4,
  spawnY = 0,
): number {
  const activePiece = {
    id: pieceId,
    rot: "spawn" as const,
    x: createGridCoord(spawnX),
    y: createGridCoord(spawnY),
  };

  const emptyBoard = createEmptyBoard();
  const targetX = gridCoordAsNumber(placement.x);
  const targetRot = placement.rot;

  const config: GameplayConfig = {
    finesseCancelMs: createDurationMs(50),
    holdEnabled: false,
    openingCoachingEnabled: false,
  };

  const optimalSequence = finesseCalculator.calculateOptimal(
    activePiece,
    targetX,
    targetRot,
    config,
    emptyBoard,
  );

  return optimalSequence?.length ?? Number.POSITIVE_INFINITY;
}

/**
 * Performance-optimized clustering for large placement sets
 * Uses Map-based grouping and pre-sorted arrays for O(n log n) complexity
 * Target: ≤0.1ms mean for typical clustering operations
 */
export function fastClusterPlacements(
  ps: ReadonlyArray<Placement>,
  utility: (p: Placement) => number,
  finesseCost: (p: Placement) => number,
): ReadonlyArray<PlacementGroup> {
  // Use the standard clustering algorithm with gridCoordAsNumber helper
  return clusterPlacements(ps, utility, finesseCost, gridCoordAsNumber);
}
