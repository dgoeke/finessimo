// Planner implementation with scoring, hazards, confidence, and hysteresis
// Chapter 3: Enhanced planner with branching, rollout, and graceful fallback

import { createGridCoord } from "../types/brands";
import { fromNow } from "../types/timestamp";

import {
  shouldUseRollout,
  compareTemplatesWithRollout,
  DEFAULT_ROLLOUT_DEPTH,
} from "./rollout";
import { BASE_TEMPLATES } from "./templates/index";
// import { silhouetteProgress } from "./silhouettes"; // Available for future use

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

// Constants for branching and rollout
export const MAX_PLAN_HISTORY_DEPTH = 2; // Prevent infinite branch loops
export const ROLLOUT_TIE_THRESHOLD = 0.05; // Use rollout when scores are this close

// Enhanced PolicyContext with plan history tracking
type EnhancedPolicyContext = PolicyContext & {
  readonly planHistory?: ReadonlyArray<string> | undefined;
};

/**
 * Check if a plan ID is already in the plan history to prevent loops
 */
function isInPlanHistory(planId: string, ctx: EnhancedPolicyContext): boolean {
  return ctx.planHistory?.includes(planId) ?? false;
}

/**
 * Add a plan ID to the history, maintaining maximum depth
 */
function addToPlanHistory(
  planId: string,
  ctx: EnhancedPolicyContext,
): ReadonlyArray<string> {
  const currentHistory = ctx.planHistory ?? [];
  const newHistory = [planId, ...currentHistory];
  return newHistory.slice(0, MAX_PLAN_HISTORY_DEPTH);
}

/**
 * Reset plan history when branching occurs
 */
function resetPlanHistory(newPlanId: string): ReadonlyArray<string> {
  return [newPlanId];
}

/**
 * Attempt to find a viable branch when current template becomes infeasible
 */
function findViableBranch(
  template: Template,
  state: GameState,
  ctx: EnhancedPolicyContext,
): Template | null {
  // Check if template has branching capability
  if (!template.branch) {
    return null;
  }

  // Get available branches
  const branches = template.branch(state);
  if (branches.length === 0) {
    return null;
  }

  // Find first viable branch that's not in plan history
  for (const branch of branches) {
    if (isInPlanHistory(branch.id, ctx)) {
      continue; // Skip branches that would cause loops
    }

    const preconditions = branch.preconditions(state);
    if (preconditions.feasible) {
      return branch; // Found viable branch
    }
  }

  return null; // No viable branches
}

/**
 * Attempt graceful exit when template and branches are non-viable
 */
function attemptGracefulExit(
  template: Template,
  state: GameState,
): Template | null {
  if (!template.gracefulExit) {
    return null;
  }

  const fallback = template.gracefulExit(state);
  if (fallback === null) {
    return null;
  }

  const preconditions = fallback.preconditions(state);
  return preconditions.feasible ? fallback : null;
}

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
 * Enhanced template selection with rollout tie-breaking
 */
function selectTemplateWithRollout(
  templates: ReadonlyArray<Template>,
  state: GameState,
): { template: Template; score: number; secondScore: number } {
  if (templates.length === 0) {
    throw new Error("No templates available for selection");
  }

  // Calculate base scores for all templates
  const scoredTemplates = templates.map((template) => ({
    baseScore: calculateTemplateBaseScore(template, state),
    template,
  }));

  // Sort by base score
  scoredTemplates.sort((a, b) => b.baseScore - a.baseScore);

  const best = scoredTemplates[0];
  const second = scoredTemplates[1];

  if (!best) {
    throw new Error("No best template found despite non-empty array");
  }

  // If there's no second template, return best
  if (!second) {
    return {
      score: best.baseScore,
      secondScore: -Infinity,
      template: best.template,
    };
  }

  // Check if rollout is needed for tie-breaking
  if (shouldUseRollout(best.baseScore, second.baseScore)) {
    const rolloutResult = compareTemplatesWithRollout(
      { baseScore: best.baseScore, template: best.template },
      { baseScore: second.baseScore, template: second.template },
      state,
      DEFAULT_ROLLOUT_DEPTH,
    );
    return {
      score: rolloutResult.score,
      secondScore:
        rolloutResult.score === best.baseScore
          ? second.baseScore
          : best.baseScore,
      template: rolloutResult.winner,
    };
  }

  return {
    score: best.baseScore,
    secondScore: second.baseScore,
    template: best.template,
  };
}

/**
 * Calculate template base score including hazards and preconditions
 */
function calculateTemplateBaseScore(
  template: Template,
  state: GameState,
): number {
  const baseUtility = calculateBaseUtility(template, state);
  const preconditions = template.preconditions(state);
  const hazards = calculateHazards(template, state);

  let score = baseUtility;

  // Add precondition score delta
  if (preconditions.scoreDelta !== undefined) {
    score += preconditions.scoreDelta;
  }

  // Apply hazard penalties
  for (const hazard of hazards) {
    score += hazard.penalty;
  }

  // Penalize infeasible templates heavily
  if (!preconditions.feasible) {
    score -= 10;
  }

  return score;
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
  // Convert to enhanced context for internal use
  const enhancedCtx: EnhancedPolicyContext = {
    ...ctx,
    planHistory: (ctx as EnhancedPolicyContext).planHistory ?? undefined,
  };

  const result = chooseWithHysteresisEnhanced(
    bestTemplate,
    bestScore,
    _secondScore,
    enhancedCtx,
    state,
  );

  return result.template;
}

/**
 * Handle infeasible current template with branching or fallback
 */
function handleInfeasibleTemplate(
  currentTemplate: Template,
  state: GameState,
  ctx: EnhancedPolicyContext,
  bestTemplate: Template,
): { template: Template; isBranching: boolean } {
  // Current plan is no longer viable - try branching
  const viableBranch = findViableBranch(currentTemplate, state, ctx);
  if (viableBranch) {
    return { isBranching: true, template: viableBranch };
  }

  // Try graceful exit
  const fallback = attemptGracefulExit(currentTemplate, state);
  if (fallback) {
    return { isBranching: true, template: fallback };
  }

  // No viable branch or fallback - use best available
  return { isBranching: false, template: bestTemplate };
}

/**
 * Evaluate switch conditions for hysteresis
 */
function evaluateSwitchConditions(
  bestTemplate: Template,
  bestScore: number,
  ctx: EnhancedPolicyContext,
  state: GameState,
  currentTemplate: Template,
): { template: Template; isBranching: boolean } {
  // If best template is same as current, keep it
  if (bestTemplate.id === ctx.lastPlanId) {
    return { isBranching: false, template: bestTemplate };
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
    return { isBranching: false, template: bestTemplate };
  }

  if (hasMargin && planIsOld) {
    return { isBranching: false, template: bestTemplate };
  }

  // Stick with current plan
  return { isBranching: false, template: currentTemplate };
}

/**
 * Enhanced hysteresis selection with branching support
 */
function chooseWithHysteresisEnhanced(
  bestTemplate: Template,
  bestScore: number,
  _secondScore: number,
  ctx: EnhancedPolicyContext,
  state: GameState,
): { template: Template; isBranching: boolean } {
  // If no previous plan, use best
  if (ctx.lastPlanId === null) {
    return { isBranching: false, template: bestTemplate };
  }

  // Find current template
  const currentTemplate = BASE_TEMPLATES.find((t) => t.id === ctx.lastPlanId);
  if (!currentTemplate) {
    return { isBranching: false, template: bestTemplate };
  }

  // Check if current template is still viable
  const currentPreconditions = currentTemplate.preconditions(state);
  if (!currentPreconditions.feasible) {
    return handleInfeasibleTemplate(currentTemplate, state, ctx, bestTemplate);
  }

  return evaluateSwitchConditions(
    bestTemplate,
    bestScore,
    ctx,
    state,
    currentTemplate,
  );
}

/**
 * Update policy context with new plan results (backward compatible)
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
 * Enhanced policy context update with plan history and branching support
 */
function updatePolicyContextEnhanced(
  ctx: EnhancedPolicyContext,
  chosenTemplate: Template,
  bestScore: number,
  secondScore: number,
  isBranching = false,
): EnhancedPolicyContext {
  const isSamePlan = ctx.lastPlanId === chosenTemplate.id;

  // Update plan history
  let newPlanHistory: ReadonlyArray<string>;
  if (isBranching) {
    // Reset history on branching to prevent long chains
    newPlanHistory = resetPlanHistory(chosenTemplate.id);
  } else if (isSamePlan) {
    // Same plan, keep history unchanged
    newPlanHistory = ctx.planHistory ?? [];
  } else {
    // New plan, add to history
    newPlanHistory = addToPlanHistory(chosenTemplate.id, ctx);
  }

  return {
    lastBestScore: bestScore,
    lastPlanId: chosenTemplate.id,
    lastSecondScore: secondScore,
    lastUpdate: fromNow(),
    planAge: isSamePlan && !isBranching ? ctx.planAge + 1 : 0, // Reset age on branching
    planHistory: newPlanHistory,
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

/**
 * Enhanced recommendMove with branching and rollout support
 * This replaces the simpler template selection with advanced branching logic
 */
export function recommendMoveEnhanced(
  state: GameState,
  ctx: EnhancedPolicyContext = {
    lastBestScore: null,
    lastPlanId: null,
    lastSecondScore: null,
    lastUpdate: null,
    planAge: 0,
  },
): {
  suggestion: { template: Template; score: number; secondScore: number };
  nextCtx: EnhancedPolicyContext;
  isBranching: boolean;
} {
  // Use enhanced template selection with rollout
  const selection = selectTemplateWithRollout(BASE_TEMPLATES, state);

  // Apply hysteresis with branching support
  const hysteresisResult = chooseWithHysteresisEnhanced(
    selection.template,
    selection.score,
    selection.secondScore,
    ctx,
    state,
  );

  // Update context with branching information
  const nextCtx = updatePolicyContextEnhanced(
    ctx,
    hysteresisResult.template,
    selection.score,
    selection.secondScore,
    hysteresisResult.isBranching,
  );

  return {
    isBranching: hysteresisResult.isBranching,
    nextCtx,
    suggestion: {
      score: selection.score,
      secondScore: selection.secondScore,
      template: hysteresisResult.template,
    },
  };
}

// Export main planning functions
export {
  attemptGracefulExit,
  calculateBaseUtility,
  calculateConfidence,
  calculateHazards,
  choosePlacementForStep,
  chooseWithHysteresis,
  chooseWithHysteresisEnhanced,
  clearMemoCache,
  findViableBranch,
  formatRationale,
  HAZARDS,
  isInPlanHistory,
  // New exports for Chapter 3
  selectTemplateWithRollout,
  updatePolicyContext,
  updatePolicyContextEnhanced,
};

// Export enhanced context type for external usage
export type { EnhancedPolicyContext };
