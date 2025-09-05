import { type PieceRandomGenerator } from "../core/rng/interface";
import { createSevenBagRng } from "../core/rng/seeded";
import { type GameState, type PieceId } from "../state/types";

import { type GameMode } from "./index";

/**
 * Pure helpers to centralize mode-owned RNG and preview queue refills.
 * No state mutation; callers dispatch resulting actions.
 */

export function getActiveRng(
  mode: GameMode | undefined,
  seed: string,
  prev?: PieceRandomGenerator,
): PieceRandomGenerator {
  if (mode && typeof mode.createRng === "function") {
    return mode.createRng(seed, prev);
  }
  return createSevenBagRng(seed);
}

export function getNextFromMode(
  state: GameState,
  mode: GameMode | undefined,
): { piece: PieceId; newRng: PieceRandomGenerator } {
  if (mode && typeof mode.getNextPiece === "function") {
    return mode.getNextPiece(state, state.rng);
  }
  return state.rng.getNextPiece();
}

export function getPreviewFromMode(
  state: GameState,
  mode: GameMode | undefined,
  count: number,
): { pieces: Array<PieceId>; newRng: PieceRandomGenerator } {
  if (mode && typeof mode.getPreview === "function") {
    return mode.getPreview(state, state.rng, count);
  }
  return state.rng.getNextPieces(count);
}

/**
 * Compute the pieces needed to reach at least minCount previews.
 * Returns null if no refill is needed.
 */
export function planPreviewRefill(
  state: GameState,
  mode: GameMode | undefined,
  minCount: number,
): { pieces: Array<PieceId>; newRng: PieceRandomGenerator } | null {
  const deficit = Math.max(0, minCount - state.nextQueue.length);
  if (deficit <= 0) return null;
  return getPreviewFromMode(state, mode, deficit);
}
