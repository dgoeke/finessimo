// Chapter 3: Silhouette progress calculation for opener policy system
// Implements pattern matching for TKI/PCO target shapes and progress scoring

import { gridCoordAsNumber } from "../types/brands";

import type { Placement } from "./types";
import type { GameState, Board, PieceId } from "../state/types";

// Target shape definitions for major openers
// Each shape is represented as a set of relative coordinates (x, y) from a reference point
type ShapePattern = ReadonlyArray<readonly [number, number]>;

/**
 * TKI (T-Spin Triple) target shapes
 * These represent the ideal board configurations for TKI setups
 */
const TKI_SHAPES: Record<string, ShapePattern> = {
  // Classic TKI setup - T-slot in left side
  "tki-left": [
    [0, 0],
    [1, 0],
    [3, 0],
    [4, 0],
    [5, 0],
    [6, 0],
    [7, 0],
    [8, 0],
    [9, 0], // Bottom row with gap at [2]
    [0, 1],
    [1, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [6, 1],
    [7, 1],
    [8, 1],
    [9, 1], // Second row with gap at [2]
    [0, 2],
    [1, 2],
    [4, 2],
    [5, 2],
    [6, 2],
    [7, 2],
    [8, 2],
    [9, 2], // Third row with gaps at [2,3]
    [2, 3], // Overhang at [2,3]
  ],

  // TKI setup - T-slot in right side
  "tki-right": [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
    [6, 0],
    [8, 0],
    [9, 0], // Bottom row with gap at [7]
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [6, 1],
    [8, 1],
    [9, 1], // Second row with gap at [7]
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
    [5, 2],
    [7, 2],
    [8, 2],
    [9, 2], // Third row with gaps at [6,7]
    [7, 3], // Overhang at [7,3]
  ],
} as const;

/**
 * PCO (Perfect Clear Opener) target shapes
 * Flat or nearly-flat formations that enable perfect clear sequences
 */
const PCO_SHAPES: Record<string, ShapePattern> = {
  // Single-row foundation for PCO
  "pco-base": [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [6, 0],
    [7, 0],
    [8, 0],
    [9, 0], // Foundation with 4x gap in middle
  ],

  // L/J dependent PCO setup
  "pco-dependent": [
    [0, 0],
    [1, 0],
    [2, 0],
    [7, 0],
    [8, 0],
    [9, 0], // Bottom foundation
    [0, 1],
    [1, 1],
    [8, 1],
    [9, 1], // Partial second row
  ],

  // Completely flat board - ideal for PCO
  "pco-flat": [],
} as const;

/**
 * Combined shape registry for lookup by template ID
 */
const SHAPE_PATTERNS: Record<string, ShapePattern> = {
  ...TKI_SHAPES,
  ...PCO_SHAPES,
} as const;

/**
 * Memoization cache for expensive pattern matching operations
 */
const silhouetteCache = new Map<string, number>();

/**
 * Clear the silhouette calculation cache (useful for testing)
 */
export function clearSilhouetteCache(): void {
  silhouetteCache.clear();
}

/**
 * Create a cache key for board state and template combination
 */
function createCacheKey(templateId: string, board: Board): string {
  // Only hash the bottom 8 rows for performance (openers don't use higher rows)
  const relevantCells: Array<number> = [];
  const startRow = Math.max(0, board.height - 8);

  for (let y = startRow; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const idx = (y + board.vanishRows) * board.width + x;
      relevantCells.push(
        idx < board.cells.length ? (board.cells[idx] ?? 0) : 0,
      );
    }
  }

  return `${templateId}_${relevantCells.join("")}`;
}

/**
 * Extract shape pattern from template ID with fallbacks
 */
function getShapePattern(templateId: string): ShapePattern | null {
  // Direct lookup
  if (templateId in SHAPE_PATTERNS) {
    const pattern = SHAPE_PATTERNS[templateId];
    return pattern ?? null;
  }

  // Fallback patterns based on opener type
  if (templateId.includes("TKI") || templateId.includes("tki")) {
    const pattern = TKI_SHAPES["tki-left"];
    return pattern ?? null; // Default TKI pattern
  }

  if (templateId.includes("PCO") || templateId.includes("pco")) {
    const pattern = PCO_SHAPES["pco-flat"];
    return pattern ?? null; // Default PCO pattern
  }

  return null; // No pattern available
}

/**
 * Check if a board cell is filled (non-zero)
 */
function isCellFilled(board: Board, x: number, y: number): boolean {
  if (x < 0 || x >= board.width || y < 0 || y >= board.height) {
    return false; // Out of bounds treated as empty
  }

  const idx = (y + board.vanishRows) * board.width + x;
  return idx >= 0 && idx < board.cells.length && (board.cells[idx] ?? 0) !== 0;
}

/**
 * Calculate how well a board matches a target shape pattern
 * Returns a score from 0.0 (no match) to 1.0 (perfect match)
 */
export function calculateShapeMatch(board: Board, targetShape: string): number {
  const pattern = getShapePattern(targetShape);
  if (pattern === null) {
    return 0; // Unknown pattern
  }

  const cacheKey = createCacheKey(targetShape, board);

  // Check cache first
  if (silhouetteCache.has(cacheKey)) {
    const cached = silhouetteCache.get(cacheKey);
    return cached ?? 0;
  }

  const score = calculatePatternScore(board, pattern);
  silhouetteCache.set(cacheKey, score);
  return score;
}

/**
 * Calculate the pattern matching score (extracted for complexity reduction)
 */
function calculatePatternScore(board: Board, pattern: ShapePattern): number {
  if (pattern.length === 0) {
    // Empty pattern (like PCO flat) - check if board is empty
    return isAllEmpty(board) ? 1.0 : 0;
  }

  // Count matches in pattern
  const matches = countPatternMatches(board, pattern);

  // Count penalty cells (filled but not expected)
  const penalties = countPenaltyCells(board, pattern);

  // Calculate final score
  return calculateFinalScore(matches, penalties, pattern.length);
}

/**
 * Count how many pattern cells are correctly filled
 */
function countPatternMatches(board: Board, pattern: ShapePattern): number {
  let matches = 0;
  for (const [px, py] of pattern) {
    if (isCellFilled(board, px, py)) {
      matches++;
    }
  }
  return matches;
}

/**
 * Count penalty cells (filled but not in pattern)
 */
function countPenaltyCells(board: Board, pattern: ShapePattern): number {
  const maxX = Math.max(9, Math.max(...pattern.map(([x]) => x)));
  const maxY = Math.max(4, Math.max(...pattern.map(([, y]) => y)));

  let penalties = 0;
  for (let y = 0; y <= maxY && y < board.height; y++) {
    penalties += countPenaltyCellsInRow(board, pattern, y, maxX);
  }
  return penalties;
}

/**
 * Count penalty cells in a single row (helper to reduce nesting)
 */
function countPenaltyCellsInRow(
  board: Board,
  pattern: ShapePattern,
  y: number,
  maxX: number,
): number {
  let rowPenalties = 0;
  for (let x = 0; x <= maxX && x < board.width; x++) {
    if (isCellFilled(board, x, y)) {
      const isExpected = pattern.some(([px, py]) => px === x && py === y);
      if (!isExpected) {
        rowPenalties++;
      }
    }
  }
  return rowPenalties;
}

/**
 * Calculate final score from matches and penalties
 */
function calculateFinalScore(
  matches: number,
  penalties: number,
  totalExpected: number,
): number {
  const matchRatio = totalExpected > 0 ? matches / totalExpected : 0;
  const penaltyDivisor = totalExpected + penalties;
  const penaltyRatio = penaltyDivisor > 0 ? penalties / penaltyDivisor : 0;
  return Math.max(0, matchRatio - penaltyRatio * 0.5);
}

/**
 * Check if the board is completely empty in the relevant area
 */
function isAllEmpty(board: Board): boolean {
  // Check bottom 6 rows for emptiness
  for (let y = Math.max(0, board.height - 6); y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (isCellFilled(board, x, y)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Simulate a placement and calculate the resulting shape match
 */
function simulateAndMatch(
  board: Board,
  placement: Placement,
  _pieceId: PieceId,
  targetShape: string,
): number {
  try {
    // This is a simplified simulation - in a full implementation,
    // we'd need to import piece shapes and simulate the actual placement
    // For now, return a reasonable approximation based on placement position

    const xPos = gridCoordAsNumber(placement.x);

    // Heuristic scoring based on placement characteristics
    let heuristicScore = calculateShapeMatch(board, targetShape);

    // Adjust score based on placement position for different openers
    if (targetShape.includes("tki")) {
      // TKI prefers edge placements for setup
      if (xPos <= 2 || xPos >= 7) {
        heuristicScore += 0.1;
      }
    } else if (targetShape.includes("pco")) {
      // PCO prefers balanced, flat placements
      if (xPos >= 3 && xPos <= 6) {
        heuristicScore += 0.1;
      }
    }

    return Math.min(1.0, heuristicScore);
  } catch {
    return 0; // Error in simulation
  }
}

/**
 * Calculate silhouette progress for a specific template and placement
 * This measures how well a placement advances toward the opener's goal shape
 */
export function silhouetteProgress(
  templateId: string,
  state: GameState,
  placement: Placement,
): number {
  // Get the current piece for simulation
  const pieceId =
    placement.useHold === true
      ? (state.hold ?? state.nextQueue[0])
      : (state.active?.id ?? state.nextQueue[0]);
  if (pieceId === undefined) {
    return 0; // No piece available
  }

  // Determine target shape from template ID
  const targetShape = inferTargetShape(templateId);
  if (targetShape === null) {
    return 0.5; // No specific shape target - neutral score
  }

  // Calculate current shape match
  const currentMatch = calculateShapeMatch(state.board, targetShape);

  // Simulate placement and calculate new match
  const newMatch = simulateAndMatch(
    state.board,
    placement,
    pieceId,
    targetShape,
  );

  // Progress is the improvement in match score
  const progress = newMatch - currentMatch;

  // Normalize to 0-1 range with 0.5 as neutral
  return Math.max(0, Math.min(1, 0.5 + progress));
}

/**
 * Infer target shape from template ID
 */
function inferTargetShape(templateId: string): string | null {
  // Direct shape mapping
  const lowerTemplateId = templateId.toLowerCase();

  if (lowerTemplateId.includes("tki")) {
    if (lowerTemplateId.includes("right")) {
      return "tki-right";
    }
    return "tki-left"; // Default TKI
  }

  if (lowerTemplateId.includes("pco")) {
    if (lowerTemplateId.includes("dependent")) {
      return "pco-dependent";
    }
    if (lowerTemplateId.includes("base")) {
      return "pco-base";
    }
    return "pco-flat"; // Default PCO
  }

  return null; // No specific shape for this template
}

/**
 * Get progress toward multiple potential shapes and return the best
 */
export function getBestShapeProgress(
  templateId: string,
  state: GameState,
  placement: Placement,
): number {
  const candidates: Array<string> = [];

  // Get candidate shapes based on template
  if (templateId.includes("TKI") || templateId.includes("tki")) {
    candidates.push("tki-left", "tki-right");
  } else if (templateId.includes("PCO") || templateId.includes("pco")) {
    candidates.push("pco-flat", "pco-base", "pco-dependent");
  } else {
    // For "Neither" templates, try both major opener types
    candidates.push("tki-left", "pco-flat");
  }

  if (candidates.length === 0) {
    return 0.5; // Neutral score if no candidates
  }

  // Calculate progress for each candidate shape
  let bestProgress = 0;
  for (const shapeId of candidates) {
    const progress = silhouetteProgressForShape(shapeId, state, placement);
    bestProgress = Math.max(bestProgress, progress);
  }

  return bestProgress;
}

/**
 * Calculate progress toward a specific shape
 */
function silhouetteProgressForShape(
  shapeId: string,
  state: GameState,
  placement: Placement,
): number {
  const pieceId =
    placement.useHold === true
      ? (state.hold ?? state.nextQueue[0])
      : (state.active?.id ?? state.nextQueue[0]);
  if (pieceId === undefined) {
    return 0;
  }

  const currentMatch = calculateShapeMatch(state.board, shapeId);
  const newMatch = simulateAndMatch(state.board, placement, pieceId, shapeId);
  const progress = newMatch - currentMatch;

  return Math.max(0, Math.min(1, 0.5 + progress));
}

/**
 * Calculate shape diversity - how many different opener paths remain viable
 * Higher diversity = more options = better for flexible play
 */
export function calculateShapeDiversity(board: Board): number {
  const shapes = ["tki-left", "tki-right", "pco-flat", "pco-base"];

  let viableShapes = 0;
  let totalMatch = 0;

  for (const shape of shapes) {
    const match = calculateShapeMatch(board, shape);
    if (match > 0.2) {
      // Threshold for "viable"
      viableShapes++;
      totalMatch += match;
    }
  }

  // Diversity score considers both count and quality of viable shapes
  const diversityScore =
    (viableShapes / shapes.length) * 0.7 + (totalMatch / shapes.length) * 0.3;
  return Math.max(0, Math.min(1, diversityScore));
}

/**
 * Export shape patterns for testing and debugging
 */
export const EXPORTED_PATTERNS = SHAPE_PATTERNS;
