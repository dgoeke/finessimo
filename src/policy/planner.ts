// Planner implementation with scoring, hazards, confidence, and hysteresis
// Chapter 1: MVP planner with 3 hazards

import { createGridCoord } from "../types/brands";
import { fromNow } from "../types/timestamp";

import { BASE_TEMPLATES } from "./templates/index";

import type { Template, Hazard, PolicyContext, Placement } from "./types";
import type { GameState } from "../state/types";

// Memoization cache for performance optimization
const memoCache = new Map<string, unknown>();

/**
 * Simple memoization utility with cache key generation
 */
function memoize<Args extends ReadonlyArray<unknown>, Return>(
  fn: (...args: Args) => Return,
  keyFn: (...args: Args) => string,
): (...args: Args) => Return {
  return (...args: Args): Return => {
    const key = keyFn(...args);

    if (memoCache.has(key)) {
      return memoCache.get(key) as Return;
    }

    const result = fn(...args);
    memoCache.set(key, result);
    return result;
  };
}

/**
 * Clear memoization cache (useful for testing or memory management)
 */
function clearMemoCache(): void {
  memoCache.clear();
}

// Constants for hysteresis and confidence
export const SWITCH_MARGIN = 0.2;
export const MIN_PLAN_AGE = 2;
export const LOW_CONF = 0.4;
export const ACCEPT_MIN_CONF = 0.35;

// Hazard definitions - start with 3 core hazards
const HAZARDS: ReadonlyArray<Hazard> = [
  {
    appliesTo: ["TKI"],
    detect: (s: GameState): boolean => {
      // TKI hazard: no early I available
      const hasIInQueue = s.nextQueue.slice(0, 3).includes("I");
      const activeIsI = s.active?.id === "I";
      return !hasIInQueue && !activeIsI && s.hold !== "I";
    },
    id: "tki-no-early-i",
    penalty: -1.5,
    reason: "No I piece available for TKI",
  },
  {
    appliesTo: ["TKI", "PCO"],
    detect: (s: GameState): boolean => {
      // Detect overhangs without T support - optimized scan
      const board = s.board;

      // Only scan top 4 rows for performance
      const scanDepth = Math.min(board.height - 1, 4);

      for (let y = 0; y < scanDepth; y++) {
        for (let x = 0; x < board.width; x++) {
          const topIdx = (y + board.vanishRows) * board.width + x;
          const botIdx = (y + 1 + board.vanishRows) * board.width + x;

          // Bounds check to prevent undefined access
          const inBounds =
            topIdx >= 0 &&
            topIdx < board.cells.length &&
            botIdx >= 0 &&
            botIdx < board.cells.length;

          if (
            inBounds &&
            board.cells[topIdx] !== 0 &&
            board.cells[botIdx] === 0
          ) {
            return true; // Early return on first overhang found
          }
        }
      }

      return false;
    },
    id: "overhang-without-t",
    penalty: -1.2,
    reason: "Overhang without T piece support",
  },
  {
    appliesTo: ["TKI", "PCO"],
    detect: (s: GameState): boolean => {
      // Split board formation without I piece - optimized check
      const board = s.board;

      // Only check if I piece is not available (early exit)
      const hasIInQueue = s.nextQueue.slice(0, 3).includes("I");
      const activeIsI = s.active?.id === "I";
      const hasI = hasIInQueue || activeIsI || s.hold === "I";

      if (hasI) return false; // No hazard if I is available

      // Check for 4-wide gaps in top 3 rows only
      for (let y = 0; y < Math.min(board.height - 3, 3); y++) {
        if (checkForGapAtRow(board, y)) {
          return true; // Early return on first gap found
        }
      }

      return false;
    },
    id: "split-needs-i",
    penalty: -0.8,
    reason: "Split formation needs I piece",
  },
] as const;

/**
 * Helper function to check for gap at specific row - optimized with bounds checking
 */
function checkForGapAtRow(board: GameState["board"], y: number): boolean {
  // Validate row bounds
  if (y < 0 || y >= board.height) return false;

  const rowStart = (y + board.vanishRows) * board.width;

  // Check for 4 consecutive empty cells in this row
  for (let x = 0; x <= board.width - 4; x++) {
    let consecutive = 0;
    for (let dx = 0; dx < 4; dx++) {
      const cellIndex = rowStart + x + dx;
      // Bounds check to prevent undefined access
      if (cellIndex < 0 || cellIndex >= board.cells.length) {
        break;
      }

      if (board.cells[cellIndex] === 0) {
        consecutive++;
      } else {
        break; // Not consecutive, try next position
      }
    }
    if (consecutive === 4) {
      return true; // Found 4-wide gap
    }
  }
  return false;
}

/**
 * Calculate base utility score for a template
 */
function calculateBaseUtility(_template: Template, _state: GameState): number {
  // Simplified scoring for Chapter 1 MVP
  // Real implementation would consider board state, piece positions, etc.
  return 1.0; // Base utility
}

/**
 * Detect relevant hazards for a template (internal, unmemoized)
 */
function calculateHazardsInternal(
  template: Template,
  state: GameState,
): ReadonlyArray<Hazard> {
  return HAZARDS.filter((h) => {
    // Handle nullable appliesTo explicitly
    if (h.appliesTo === undefined) return true; // Global hazard

    return h.appliesTo.includes(template.opener) && h.detect(state);
  });
}

// Memoized version of hazard calculation
const calculateHazards = memoize(
  calculateHazardsInternal,
  (template: Template, state: GameState) => {
    // Create cache key from template and game state essentials
    const activeId = state.active?.id ?? "none";
    const hold = state.hold ?? "none";
    const queueKey = state.nextQueue.slice(0, 5).join(""); // Only first 5 pieces matter for hazards
    const boardKey = state.board.cells.join(""); // Board state affects structural hazards
    return `hazards_${template.id}_${activeId}_${hold}_${queueKey}_${boardKey}`;
  },
);

/**
 * Calculate plan fragility (0..1 where 1 = very fragile)
 */
function calculatePlanFragility(state: GameState, template: Template): number {
  let fragility = 0;
  // Fragility factors
  const requiresI = template.opener === "TKI" || template.opener === "PCO";
  const hasI = state.hold === "I" || state.nextQueue.slice(0, 2).includes("I");
  if (requiresI && !hasI) {
    fragility += 0.4;
  }
  const requiresT = template.opener === "TKI";
  const hasT = state.hold === "T" || state.nextQueue.slice(0, 2).includes("T");
  if (requiresT && !hasT) {
    fragility += 0.3;
  }
  // Board height factor
  const maxHeight = calculateMaxHeight(state.board);
  if (maxHeight > 15) {
    fragility += 0.3; // High stack adds fragility
  }
  return Math.min(fragility, 1.0);
}

/**
 * Calculate column heights for a board (memoized)
 */
function calculateColumnHeights(
  board: GameState["board"],
): ReadonlyArray<number> {
  const heights: Array<number> = new Array<number>(board.width).fill(0);

  for (let x = 0; x < board.width; x++) {
    for (let y = 0; y < board.height; y++) {
      const idx = (y + board.vanishRows) * board.width + x;
      // Bounds check before accessing
      if (idx >= 0 && idx < board.cells.length && board.cells[idx] !== 0) {
        heights[x] = board.height - y; // Height from bottom
        break; // Found top piece in this column
      }
    }
  }

  return heights;
}

// Memoized version of column height calculation
const memoizedColumnHeights = memoize(
  calculateColumnHeights,
  (board: GameState["board"]) => {
    // Create cache key from board cells array (simplified)
    return `heights_${board.cells.join("")}_${board.vanishRows.toString()}`;
  },
);

/**
 * Calculate board's maximum height with bounds checking (now uses memoized column heights)
 */
function calculateMaxHeight(board: GameState["board"]): number {
  const heights = memoizedColumnHeights(board);
  return Math.max(0, ...heights);
}

/**
 * Calculate confidence score based on margin and context
 * Uses the formula from Chapter 1 spec
 */
function calculateConfidence(
  bestScore: number,
  secondScore: number,
  state: GameState,
  template: Template,
): number {
  const margin = bestScore - secondScore;
  const fragility = calculatePlanFragility(state, template);

  // Sigmoid for margin confidence as per spec
  const marginConfidence = 1 / (1 + Math.exp(-margin / 0.8));

  // Fragility reduction factor
  const fragilityFactor = 1 - 0.6 * fragility;

  // Progress decay (simplified - assume 2 remaining steps for Chapter 1)
  const progressDecay = Math.pow(0.97, 2);

  // Apply the formula from requirements
  const confidence = marginConfidence * fragilityFactor * progressDecay;

  // Ensure bounds [0,1]
  return Math.max(0.05, Math.min(confidence, 1.0));
}

/**
 * Choose plan with hysteresis to avoid thrashing
 */
function chooseWithHysteresis(
  bestTemplate: Template,
  bestScore: number,
  _secondScore: number,
  ctx: PolicyContext,
  state: GameState,
): Template {
  // If no previous plan, use best
  if (ctx.lastPlanId === null) {
    return bestTemplate;
  }

  // Find current template
  const currentTemplate = BASE_TEMPLATES.find((t) => t.id === ctx.lastPlanId);

  // If we can't find current template, use best
  if (!currentTemplate) {
    return bestTemplate;
  }

  // If best template is same as current, keep it
  if (bestTemplate.id === ctx.lastPlanId) {
    return bestTemplate;
  }

  // Calculate switch margin requirement
  const currentScore = ctx.lastBestScore ?? -Infinity;
  const marginGap = bestScore - currentScore;

  // Calculate current confidence
  const currentConf =
    ctx.lastSecondScore !== null
      ? calculateConfidence(
          currentScore,
          ctx.lastSecondScore,
          state,
          currentTemplate,
        )
      : 0;

  // Switch conditions
  const hasMargin = marginGap >= SWITCH_MARGIN;
  const planIsOld = ctx.planAge >= MIN_PLAN_AGE;
  const confidenceIsLow = currentConf < LOW_CONF;

  // Make switch decision - prioritize low confidence switches
  if (confidenceIsLow && marginGap > 0) {
    return bestTemplate; // Low confidence, any improvement helps
  }

  if (hasMargin && planIsOld) {
    return bestTemplate; // Clear improvement
  }

  // Stick with current plan - return the current template, not best
  return currentTemplate;
}

/**
 * Update policy context with new plan results
 */
function updatePolicyContext(
  ctx: PolicyContext,
  chosenTemplate: Template,
  bestScore: number,
  secondScore: number,
): PolicyContext {
  const isSamePlan = ctx.lastPlanId === chosenTemplate.id;

  return {
    lastBestScore: bestScore,
    lastPlanId: chosenTemplate.id,
    lastSecondScore: secondScore,
    lastUpdate: fromNow(),
    planAge: isSamePlan ? ctx.planAge + 1 : 0, // Increment if same, reset if different
  };
}

/**
 * Choose placement from available step candidates - simplified for cognitive complexity
 */
function choosePlacementForStep(
  template: Template,
  state: GameState,
): Placement {
  const steps = template.nextStep(state);

  // Find first applicable step
  for (const step of steps) {
    if (!step.when(state)) continue;

    const placements = step.propose(state);
    if (placements.length === 0) continue;

    // Choose best placement by utility
    const bestPlacement = findBestPlacement(placements, step, state);
    return bestPlacement;
  }

  // No applicable step found, return default safe placement
  return {
    rot: "spawn",
    useHold: false,
    x: createGridCoord(4), // Center column
  };
}

/**
 * Helper function to find best placement to reduce complexity
 * Uses safe array access and ensures non-empty input
 */
function findBestPlacement(
  placements: ReadonlyArray<Placement>,
  step: { readonly utility: (p: Placement, s: GameState) => number },
  state: GameState,
): Placement {
  // Ensure we have at least one placement
  if (placements.length === 0) {
    // Fallback if placements array is empty
    return {
      rot: "spawn",
      useHold: false,
      x: createGridCoord(4),
    };
  }

  const firstPlacement = placements[0];
  // Length check above ensures this exists
  if (firstPlacement === undefined) {
    throw new Error(
      "Unreachable: first placement undefined despite length check",
    );
  }
  let bestPlacement = firstPlacement;
  let bestUtility = step.utility(bestPlacement, state);

  // Safe iteration with bounds checking
  for (let i = 1; i < placements.length; i++) {
    const placement = placements[i];
    if (placement !== undefined) {
      const utility = step.utility(placement, state);
      if (utility > bestUtility) {
        bestUtility = utility;
        bestPlacement = placement;
      }
    }
  }

  return bestPlacement;
}

/**
 * Format rationale text for UI display (≤90 chars)
 */
function formatRationale(
  template: Template,
  hazards: ReadonlyArray<Hazard>,
): string {
  const opener = template.opener;
  const hazardWarnings =
    hazards.length > 0 ? hazards.map((h) => h.reason).join(", ") : "";

  let rationale = `Choosing **${opener}**`;

  // Add template-specific notes
  switch (opener) {
    case "TKI":
      rationale += " (I available)";
      break;
    case "PCO":
      rationale += " (field flat)";
      break;
    case "Neither":
    default:
      rationale += " (safe option)";
      break;
  }

  // Add hazard warnings if any
  if (hazardWarnings.length > 0) {
    rationale = `${rationale}. ⚠ ${hazardWarnings}`;
  } else {
    rationale = `${rationale}.`;
  }

  // Truncate to 90 characters if too long
  if (rationale.length > 90) {
    rationale = `${rationale.slice(0, 87)}...`;
  }

  return rationale;
}

// Export main planning functions
export {
  calculateBaseUtility,
  calculateConfidence,
  calculateHazards,
  choosePlacementForStep,
  chooseWithHysteresis,
  clearMemoCache,
  formatRationale,
  HAZARDS,
  updatePolicyContext,
};
