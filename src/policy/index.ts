// Public API for opener policy system
// Chapter 1: Pure, deterministic policy with hysteresis and hazard detection

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
import { BASE_TEMPLATES, clearTemplateCache } from "./templates/index";

import type {
  PolicyContext,
  PolicyOutput,
  Suggestion,
  Template,
  Hazard,
} from "./types";
import type { GameState } from "../state/types";

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
  // Base score from template preconditions and utility
  const preconditions = template.preconditions(state);
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
  ctx: PolicyContext = createDefaultPolicyContext(),
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
    state,
  );

  // Get placement for chosen template
  const placement = choosePlacementForStep(chosenTemplate, state);

  // Calculate confidence
  const confidence = calculateConfidence(
    bestScore,
    secondScore,
    state,
    chosenTemplate,
  );

  // Score the chosen template to get hazards for rationale
  const chosenScore = scorePlan(chosenTemplate, state);
  const rationale = formatRationale(chosenTemplate, chosenScore.hazards);

  // Build suggestion
  const suggestion: Suggestion = {
    confidence,
    intent: chosenTemplate.opener,
    placement,
    planId: chosenTemplate.id,
    rationale,
    // groups and guidance are empty in Chapter 1
  };

  // Update context
  const nextCtx = updatePolicyContext(
    ctx,
    chosenTemplate,
    bestScore,
    secondScore,
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
