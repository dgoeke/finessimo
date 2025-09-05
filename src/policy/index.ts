// Public API for opener policy system
// Chapter 1: Pure, deterministic policy with hysteresis and hazard detection

import { gridCoordAsNumber } from "../types/brands";

import { getCachedPreconditions, clearAllCaches } from "./cache";
import {
  clusterPlacements,
  paretoFilter,
  calculateFinesseCost,
} from "./executor";
import {
  calculateBaseUtility,
  calculateConfidence,
  calculateHazards,
  chooseWithHysteresis,
  updatePolicyContext,
  choosePlacementForStep,
  formatRationale,
  clearMemoCache,
} from "./planner";
import { suggestBySearch, defaultSearchConfig } from "./search";
import { BASE_TEMPLATES, clearTemplateCache } from "./templates/index";

import type {
  PolicyContext,
  PolicyOutput,
  Suggestion,
  Template,
  Hazard,
  Placement,
} from "./types";
import type { GameState, ModeGuidance } from "../state/types";

// Internal scoring type
type PlanScore = {
  adjusted: number;
  hazards: ReadonlyArray<Hazard>;
  rawScore: number;
};

/**
 * Score a template against current game state
 * Internal function for policy evaluation
 */
function scorePlan(template: Template, state: GameState): PlanScore {
  // Use cached preconditions for performance
  const preconditions = getCachedPreconditions(template, state);
  let rawScore = calculateBaseUtility(template, state);

  // Add score delta from preconditions (can be bonus or penalty)
  if (preconditions.scoreDelta !== undefined) {
    rawScore += preconditions.scoreDelta;
  }

  // Detect hazards
  const hazards = calculateHazards(template, state);

  // Apply hazard penalties
  let adjusted = rawScore;
  for (const hazard of hazards) {
    adjusted += hazard.penalty; // penalties are negative
  }

  return { adjusted, hazards, rawScore };
}

/**
 * Collect all placement candidates from a template for clustering
 * This is similar to choosePlacementForStep but returns all candidates
 */
function collectPlacementCandidates(
  template: Template,
  state: GameState
): ReadonlyArray<{ placement: Placement; utility: number }> {
  const steps = template.nextStep(state);
  const candidates: Array<{ placement: Placement; utility: number }> = [];

  // Collect candidates from all applicable steps
  for (const step of steps) {
    if (!step.when(state)) continue;

    const placements = step.propose(state);
    for (const placement of placements) {
      const utility = step.utility(placement, state);
      candidates.push({ placement, utility });
    }
  }

  return candidates;
}

/**
 * Helper function to create ModeGuidance from placement
 */
function toModeGuidance(placement: Placement): ModeGuidance {
  return {
    label: `${placement.rot} @ x=${String(gridCoordAsNumber(placement.x))}`,
    target: { rot: placement.rot, x: placement.x },
    visual: { highlightTarget: true, showPath: false },
  };
}

/**
 * Default policy context for first-time use
 */
function createDefaultPolicyContext(): PolicyContext {
  return {
    lastBestScore: null,
    lastPlanId: null,
    lastSecondScore: null,
    lastUpdate: null,
    planAge: 0,
  };
}

/**
 * Main policy function: recommend move for current game state
 *
 * Pure and deterministic - same state + context always produces same output.
 * Includes hysteresis to avoid plan thrashing.
 *
 * @param state Current game state
 * @param ctx Optional policy context for hysteresis (defaults to empty)
 * @returns Policy output with suggestion and updated context
 */
export function recommendMove(
  state: GameState,
  ctx: PolicyContext = createDefaultPolicyContext()
): PolicyOutput {
  // Evaluate all templates - assert that we have templates available
  if (BASE_TEMPLATES.length === 0) {
    throw new Error("No base templates available");
  }

  // Initialize with first template - safe after length check above
  const firstTemplate = BASE_TEMPLATES[0];
  if (!firstTemplate) {
    throw new Error("First template is undefined despite non-empty array");
  }

  let bestTemplate = firstTemplate;
  let bestScore = -Infinity;
  let secondScore = -Infinity;

  for (const template of BASE_TEMPLATES) {
    const score = scorePlan(template, state);

    if (score.adjusted > bestScore) {
      secondScore = bestScore;
      bestScore = score.adjusted;
      bestTemplate = template;
    } else if (score.adjusted > secondScore) {
      secondScore = score.adjusted;
    }
  }

  // Apply hysteresis to choose final template
  const chosenTemplate = chooseWithHysteresis(
    bestTemplate,
    bestScore,
    secondScore,
    ctx,
    state
  );

  if (chosenTemplate.opener === "Neither") {
    const sr = suggestBySearch(state, defaultSearchConfig);

    // Reuse your confidence scheme if you prefer; here's a simple margin version:
    const confidence = Math.max(
      0.1,
      Math.min(0.99, 0.6 + (sr.bestScore - sr.secondBestScore))
    );

    // Build suggestion object conditionally to satisfy exactOptionalPropertyTypes
    const baseSuggestion = {
      confidence,
      intent: "Neither" as const,
      placement: sr.best,
      planId: "search/basic",
      rationale: "Flat, low-risk placement (search)",
    };
    
    const suggestion: Suggestion = sr.groups 
      ? { ...baseSuggestion, groups: sr.groups }
      : baseSuggestion;

    // Create a minimal template for "Neither" case
    const neitherTemplate: Template = {
      id: "search/basic",
      nextStep: () => [],
      opener: "Neither",
      preconditions: () => ({ feasible: true, notes: [] }),
    };

    const nextCtx = updatePolicyContext(
      ctx,
      neitherTemplate,
      sr.bestScore,
      sr.secondBestScore
    );

    return { nextCtx, suggestion };
  }

  // Collect all placement candidates for clustering
  const candidates = collectPlacementCandidates(chosenTemplate, state);

  // Extract placement array and utility function for clustering
  const candidatePlacements = candidates.map((c) => c.placement);
  const utilityLookup = new Map(
    candidates.map((c) => [c.placement, c.utility])
  );
  const utility = (p: Placement): number => utilityLookup.get(p) ?? 0;
  const finesseCost = (p: Placement): number => calculateFinesseCost(p);

  // Apply Pareto filtering to remove dominated placements
  const nonDominatedPlacements = paretoFilter(
    candidatePlacements,
    utility,
    finesseCost
  );

  // Generate placement groups using clustering
  const groups = clusterPlacements(
    nonDominatedPlacements,
    utility,
    finesseCost,
    gridCoordAsNumber
  );

  // Get placement for chosen template (fallback to original method)
  const placement = choosePlacementForStep(chosenTemplate, state);

  // Calculate confidence
  const confidence = calculateConfidence(
    bestScore,
    secondScore,
    state,
    chosenTemplate
  );

  // Score the chosen template to get hazards for rationale
  const chosenScore = scorePlan(chosenTemplate, state);
  const rationale = formatRationale(chosenTemplate, chosenScore.hazards);

  // Build suggestion with populated groups and guidance
  const suggestion: Suggestion = {
    confidence,
    groups, // Now populated with clustered placements
    guidance: toModeGuidance(placement),
    intent: chosenTemplate.opener,
    placement,
    planId: chosenTemplate.id,
    rationale,
  };

  // Update context
  const nextCtx = updatePolicyContext(
    ctx,
    chosenTemplate,
    bestScore,
    secondScore
  );

  return {
    nextCtx,
    suggestion,
  };
}

/**
 * Clear all policy caches (useful for testing or memory management)
 */
export function clearPolicyCache(): void {
  clearMemoCache();
  clearTemplateCache();
  clearAllCaches(); // Clear new Chapter 4 caches
}

// Re-export types for consumers
export type {
  Hazard,
  Intent,
  Placement,
  PlacementGroup,
  PolicyContext,
  PolicyOutput,
  Suggestion,
  Template,
} from "./types";

// Re-export templates for testing and inspection
export { BASE_TEMPLATES } from "./templates/index";

// Re-export constants for configuration
export {
  ACCEPT_MIN_CONF,
  LOW_CONF,
  MIN_PLAN_AGE,
  SWITCH_MARGIN,
} from "./planner";
