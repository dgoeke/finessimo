// Chapter 3: Micro-rollout for tie-break resolution in opener policy system
// Implements 1-2 ply rollout to disambiguate close scores (≤0.05 difference)

import { canPlacePiece, lockPiece, dropToBottom } from "../core/board";
import { createActivePiece } from "../core/spawning";
import { isPlaying } from "../state/types";
import { createGridCoord } from "../types/brands";
import { fromNow } from "../types/timestamp";

import type { Template, Placement } from "./types";
import type { GameState, Board, ActivePiece, PieceId } from "../state/types";

// Constants for rollout configuration
export const EPS = 0.05; // Score difference threshold for triggering rollout
export const DEFAULT_ROLLOUT_DEPTH = 1; // Standard depth for micro-rollout
export const MAX_ROLLOUT_PLACEMENTS = 8; // Limit placements to stay within time budget

/**
 * Performance budget helper - tracks time spent in rollout
 */
class RolloutTimer {
  private readonly startTime: number;
  private readonly budgetMs: number;

  constructor(budgetMs = 0.2) {
    this.startTime = fromNow().valueOf();
    this.budgetMs = budgetMs;
  }

  /**
   * Check if we're within the time budget
   */
  withinBudget(): boolean {
    return fromNow().valueOf() - this.startTime < this.budgetMs;
  }

  /**
   * Get elapsed time in milliseconds
   */
  elapsed(): number {
    return fromNow().valueOf() - this.startTime;
  }
}

/**
 * Type guard to check if a piece can be spawned and placed
 */
function isValidPlacement(
  state: GameState,
  piece: PieceId,
  placement: Placement,
): boolean {
  // Handle playing state with active piece
  if (isPlaying(state)) {
    const activePiece = state.active ?? createActivePiece(piece);
    const testPiece = {
      ...activePiece,
      rot: placement.rot,
      x: placement.x,
    };
    try {
      const finalPos = dropToBottom(state.board, testPiece);
      return canPlacePiece(state.board, finalPos);
    } catch {
      return false;
    }
  }

  // Handle other game states by creating piece from scratch
  try {
    const activePiece = { ...createActivePiece(piece), rot: placement.rot };
    const finalPos = dropToBottom(state.board, {
      ...activePiece,
      x: placement.x,
    });
    return canPlacePiece(state.board, finalPos);
  } catch {
    return false;
  }
}

/**
 * Generate all valid placements for a piece on the current board
 */
function generatePlacements(
  state: GameState,
  piece: PieceId,
): ReadonlyArray<Placement> {
  const placements: Array<Placement> = [];
  const timer = new RolloutTimer(0.1); // Conservative budget for placement generation

  // Try all rotations
  const rotations = ["spawn", "right", "two", "left"] as const;

  for (const rot of rotations) {
    if (!timer.withinBudget()) break; // Stay within time budget

    // Try positions across the board width
    for (let x = 0; x < 10 && placements.length < MAX_ROLLOUT_PLACEMENTS; x++) {
      const placement: Placement = {
        rot,
        useHold: false,
        x: createGridCoord(x),
      };

      if (isValidPlacement(state, piece, placement)) {
        placements.push(placement);
      }
    }
  }

  return placements;
}

/**
 * Simulate placing a piece and return the resulting board state
 */
function simulatePlacement(
  state: GameState,
  piece: PieceId,
  placement: Placement,
): Board | null {
  try {
    let activePiece: ActivePiece;

    if (state.active) {
      activePiece = {
        ...state.active,
        rot: placement.rot,
        x: placement.x,
      };
    } else {
      activePiece = { ...createActivePiece(piece), rot: placement.rot };
      activePiece = { ...activePiece, x: placement.x };
    }

    const finalPos = dropToBottom(state.board, activePiece);

    if (!canPlacePiece(state.board, finalPos)) {
      return null; // Invalid placement
    }

    return lockPiece(state.board, finalPos);
  } catch {
    return null; // Error in simulation
  }
}

/**
 * Create a future state with the simulated placement
 */
function createFutureState(
  state: GameState,
  newBoard: Board,
  nextPiece: PieceId,
): GameState {
  // Create minimal future state for evaluation
  // Only copy essential fields needed for template evaluation
  const nextQueue = state.nextQueue.slice(1); // Consume one piece from queue

  return {
    ...state,
    active: createActivePiece(nextPiece), // Spawn next piece
    board: newBoard,
    nextQueue,
    // Keep other fields unchanged for micro-rollout
  } as GameState;
}

/**
 * Evaluate a template's utility on a future state (simplified)
 */
function evaluateTemplate(template: Template, futureState: GameState): number {
  try {
    // Check template preconditions
    const preconditions = template.preconditions(futureState);
    if (!preconditions.feasible) {
      return -1.0; // Template not feasible
    }

    // Get base score from preconditions
    const baseScore = preconditions.scoreDelta ?? 0;

    // Try to get next step candidates
    const steps = template.nextStep(futureState);
    if (steps.length === 0) {
      return baseScore * 0.5; // Penalize templates with no next steps
    }

    // Find best utility from available steps
    const bestUtility = findBestStepUtility(steps, futureState);

    return bestUtility === -Infinity
      ? baseScore * 0.3
      : baseScore + bestUtility * 0.7;
  } catch {
    return -2.0; // Error in template evaluation
  }
}

/**
 * Context for rollout recursion
 */
type RolloutContext = {
  readonly template: Template;
  readonly timer: RolloutTimer;
};

/**
 * Find best utility from available steps (helper to reduce nesting)
 */
function findBestStepUtility(
  steps: ReadonlyArray<{
    when: (s: GameState) => boolean;
    propose: (s: GameState) => ReadonlyArray<Placement>;
    utility: (p: Placement, s: GameState) => number;
  }>,
  futureState: GameState,
): number {
  let bestUtility = -Infinity;
  for (const step of steps) {
    if (step.when(futureState)) {
      const placements = step.propose(futureState);
      for (const placement of placements.slice(0, 3)) {
        // Limit for performance
        const utility = step.utility(placement, futureState);
        bestUtility = Math.max(bestUtility, utility);
      }
    }
  }
  return bestUtility;
}

/**
 * Perform micro-rollout simulation for a single placement
 */
function rolloutPlacement(
  state: GameState,
  piece: PieceId,
  placement: Placement,
  depth: number,
  context: RolloutContext,
): number {
  if (depth <= 0 || !context.timer.withinBudget()) {
    return 0; // Base case or time limit
  }

  // Simulate the placement
  const newBoard = simulatePlacement(state, piece, placement);
  if (newBoard === null) {
    return -10; // Invalid placement penalty
  }

  // Get next piece from queue
  const nextPieceQueue = state.nextQueue;
  if (nextPieceQueue.length === 0) {
    return 0; // No more pieces to simulate
  }

  const nextPiece = nextPieceQueue[0];
  if (nextPiece === undefined) {
    return 0; // Undefined piece
  }

  // Create future state
  const futureState = createFutureState(state, newBoard, nextPiece);

  // Evaluate template in future state
  const templateScore = evaluateTemplate(context.template, futureState);

  if (depth === 1) {
    return templateScore; // Terminal evaluation
  }

  // Recursive rollout (depth > 1)
  return (
    templateScore +
    evaluateRecursiveRollout(futureState, nextPiece, depth - 1, context)
  );
}

/**
 * Helper to evaluate recursive rollout without excessive nesting
 */
function evaluateRecursiveRollout(
  futureState: GameState,
  nextPiece: PieceId,
  depth: number,
  context: RolloutContext,
): number {
  const futurePlacements = generatePlacements(futureState, nextPiece);
  let bestFutureScore = -Infinity;

  for (const futurePlacement of futurePlacements.slice(0, 3)) {
    // Limit for performance
    if (!context.timer.withinBudget()) break;

    const futureScore = rolloutPlacement(
      futureState,
      nextPiece,
      futurePlacement,
      depth,
      context,
    );
    bestFutureScore = Math.max(bestFutureScore, futureScore);
  }

  return bestFutureScore === -Infinity ? 0 : bestFutureScore * 0.5;
}

/**
 * Determine if rollout should be used based on score difference
 */
export function shouldUseRollout(
  bestScore: number,
  secondScore: number,
): boolean {
  return Math.abs(bestScore - secondScore) <= EPS;
}

/**
 * Perform micro-rollout to disambiguate close template scores
 */
export function microRollout(
  state: GameState,
  template: Template,
  depth: number = DEFAULT_ROLLOUT_DEPTH,
): number {
  const timer = new RolloutTimer(0.2); // 0.2ms budget for rollout

  // Determine the piece to rollout with
  const piece = state.active?.id ?? state.nextQueue[0];
  if (piece === undefined) {
    return 0; // No piece to rollout with
  }

  // Generate valid placements for this piece
  const placements = generatePlacements(state, piece);
  if (placements.length === 0) {
    return -5; // No valid placements
  }

  // Create rollout context
  const context: RolloutContext = { template, timer };

  // Evaluate each placement with rollout
  let totalScore = 0;
  let evaluatedCount = 0;

  for (const placement of placements) {
    if (!timer.withinBudget()) break; // Respect time budget

    const placementScore = rolloutPlacement(
      state,
      piece,
      placement,
      depth,
      context,
    );
    totalScore += placementScore;
    evaluatedCount++;
  }

  // Return average score across all evaluated placements
  return evaluatedCount > 0 ? totalScore / evaluatedCount : 0;
}

/**
 * Enhanced template scoring with optional rollout
 * Called by policy planner when scores are too close
 */
export function scoreTemplateWithRollout(
  template: Template,
  state: GameState,
  baseScore: number,
  useRollout = false,
  rolloutDepth = DEFAULT_ROLLOUT_DEPTH,
): number {
  if (!useRollout) {
    return baseScore;
  }

  try {
    const rolloutScore = microRollout(state, template, rolloutDepth);
    // Blend base score with rollout score (70% base, 30% rollout)
    return baseScore * 0.7 + rolloutScore * 0.3;
  } catch {
    // Fallback to base score if rollout fails
    return baseScore;
  }
}

/**
 * Template comparison data for rollout
 */
type TemplateComparison = {
  readonly template: Template;
  readonly baseScore: number;
};

/**
 * Rollout-enhanced template comparison
 * Returns the better template when base scores are close
 */
export function compareTemplatesWithRollout(
  comparison1: TemplateComparison,
  comparison2: TemplateComparison,
  state: GameState,
  rolloutDepth = DEFAULT_ROLLOUT_DEPTH,
): { winner: Template; score: number } {
  // Check if rollout is needed
  if (!shouldUseRollout(comparison1.baseScore, comparison2.baseScore)) {
    // Clear winner based on base score
    return comparison1.baseScore >= comparison2.baseScore
      ? { score: comparison1.baseScore, winner: comparison1.template }
      : { score: comparison2.baseScore, winner: comparison2.template };
  }

  // Perform rollout for both templates
  const enhancedScore1 = scoreTemplateWithRollout(
    comparison1.template,
    state,
    comparison1.baseScore,
    true,
    rolloutDepth,
  );
  const enhancedScore2 = scoreTemplateWithRollout(
    comparison2.template,
    state,
    comparison2.baseScore,
    true,
    rolloutDepth,
  );

  return enhancedScore1 >= enhancedScore2
    ? { score: enhancedScore1, winner: comparison1.template }
    : { score: enhancedScore2, winner: comparison2.template };
}
