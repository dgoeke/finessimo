// Deterministic sequence generators for scenario system
// Chapter 2: Generate piece queues and board states from ScenarioCard data

import { createEmptyBoard } from "../core/board";
import { createRng, getNextPieces } from "../core/rng";
import { seedAsString } from "../types/brands";

import type { ScenarioCard } from "./cards";
import type { PieceId, Board } from "../state/types";
import type { Seed } from "../types/brands";

/**
 * Generate a deterministic piece queue from a seed
 * @param seed Branded seed value for RNG initialization
 * @param minPreview Minimum number of pieces to generate (default 5)
 * @returns Array of piece IDs in deterministic order
 */
export function queueFromSeed(
  seed: Seed,
  minPreview = 5,
): ReadonlyArray<PieceId> {
  if (minPreview < 1) {
    throw new Error("minPreview must be at least 1");
  }

  // Convert branded seed to string for RNG
  const seedStr = seedAsString(seed);
  const rng = createRng(seedStr);

  // Generate the requested number of pieces
  const { pieces } = getNextPieces(rng, minPreview);

  return pieces;
}

/**
 * Generate a deterministic piece queue with start offset
 * @param seed Branded seed value for RNG initialization
 * @param startTicks Offset into the sequence (skips this many pieces)
 * @param minPreview Minimum number of pieces to generate after offset
 * @returns Array of piece IDs starting from the offset
 */
export function queueFromSeedWithOffset(
  seed: Seed,
  startTicks: number,
  minPreview = 5,
): ReadonlyArray<PieceId> {
  if (startTicks < 0) {
    throw new Error("startTicks must be non-negative");
  }
  if (minPreview < 1) {
    throw new Error("minPreview must be at least 1");
  }

  const seedStr = seedAsString(seed);
  let rng = createRng(seedStr);

  // Skip pieces up to startTicks offset
  if (startTicks > 0) {
    const { newRng } = getNextPieces(rng, startTicks);
    rng = newRng;
  }

  // Generate the preview pieces
  const { pieces } = getNextPieces(rng, minPreview);

  return pieces;
}

/**
 * Generate a board state from scenario card data
 * Currently returns empty board, but prepared for future garbage/setup
 * @param card ScenarioCard with board setup information
 * @returns Board state configured according to the scenario
 */
export function boardFromScenario(card: ScenarioCard): Board {
  // For Chapter 2, we start with empty boards
  // Future chapters may add garbage based on card.maxGarbage
  const board = createEmptyBoard();

  // Placeholder for future garbage generation based on card.maxGarbage
  if (card.maxGarbage !== undefined && card.maxGarbage > 0) {
    // Future chapters will generate garbage lines here
    // This would use the card.seed to deterministically place garbage
  }

  return board;
}

/**
 * Generate a complete piece sequence for training
 * Combines seed-based generation with scenario-specific parameters
 * @param card ScenarioCard containing generation parameters
 * @returns Extended piece sequence for training session
 */
export function generateTrainingSequence(
  card: ScenarioCard,
): ReadonlyArray<PieceId> {
  const minPreview = card.minPreview ?? 5;
  const startTicks = card.startTicks ?? 0;

  // Generate longer sequence for training (at least 20 pieces)
  const sequenceLength = Math.max(minPreview, 20);

  return queueFromSeedWithOffset(card.seed, startTicks, sequenceLength);
}

/**
 * Validate that generated sequences meet scenario requirements
 * @param card ScenarioCard to validate against
 * @param pieces Generated piece sequence
 * @returns Boolean indicating if sequence meets requirements
 */
export function validateSequence(
  card: ScenarioCard,
  pieces: ReadonlyArray<PieceId>,
): boolean {
  const minPreview = card.minPreview ?? 5;

  // Check minimum length requirement
  if (pieces.length < minPreview) {
    return false;
  }

  // Check that all pieces are valid
  const validPieces: ReadonlySet<PieceId> = new Set([
    "I",
    "O",
    "T",
    "S",
    "Z",
    "J",
    "L",
  ]);
  for (const piece of pieces) {
    if (!validPieces.has(piece)) {
      return false;
    }
  }

  return true;
}

/**
 * Get deterministic preview for a scenario (for UI display)
 * @param card ScenarioCard to generate preview for
 * @param previewCount Number of pieces to show in preview
 * @returns Array of piece IDs for preview display
 */
export function getScenarioPreview(
  card: ScenarioCard,
  previewCount = 5,
): ReadonlyArray<PieceId> {
  const startTicks = card.startTicks ?? 0;

  return queueFromSeedWithOffset(card.seed, startTicks, previewCount);
}
