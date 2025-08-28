/**
 * Pure helper functions for managing processedInputLog for finesse analysis.
 * Follows the principle: finesse analysis needs to track player inputs to determine optimality.
 *
 * Logging Rules:
 * - TapMove: log only when optimistic === false (ignore optimistic tap to avoid double-counting)
 * - HoldMove: log once at hold start; don't log repeats
 * - RepeatMove: do NOT log; ARR repeats are not inputs for finesse
 * - Rotate/HardDrop: always log when active piece exists
 * - SoftDrop: log transitions only (first on, then off), dedup on-pulses
 * - Only log when active piece exists and status is "playing"
 */

import { type Timestamp } from "../types/timestamp";

import type { ProcessedAction, GameState } from "../state/types";

// Helper functions for input handlers

/**
 * Determines if a TapMove should be processed for finesse logging.
 * Only non-optimistic tap moves should be logged.
 */
export function shouldProcessTapMove(optimistic: boolean): boolean {
  return !optimistic;
}

/**
 * Determines if a HoldMove should be processed for finesse logging.
 * Only the initial hold (start) should be logged, not subsequent repeats.
 */
export function shouldProcessHoldMove(isHoldStart: boolean): boolean {
  return isHoldStart;
}

/**
 * Determines if a RepeatMove should be processed for finesse logging.
 * RepeatMoves (ARR) should never be logged as they are not finesse inputs.
 */
export function shouldProcessRepeatMove(): boolean {
  return false;
}

/**
 * Determines if a Rotate should be processed for finesse logging.
 * Rotations should always be logged.
 */
export function shouldProcessRotate(): boolean {
  return true;
}

/**
 * Determines if a HardDrop should be processed for finesse logging.
 * HardDrops should always be logged.
 */
export function shouldProcessHardDrop(): boolean {
  return true;
}

/**
 * State for tracking SoftDrop transitions to avoid logging duplicate "on" pulses.
 */
export type SoftDropState = {
  readonly lastOn: boolean;
};

/**
 * Creates initial SoftDrop state.
 */
export function createSoftDropState(): SoftDropState {
  return { lastOn: false };
}

/**
 * Determines if a SoftDrop should be processed for finesse logging.
 * Only transitions (off→on or on→off) should be logged, not repeated pulses.
 * Returns [shouldProcess, newState] tuple.
 */
export function shouldProcessSoftDrop(
  on: boolean,
  state: SoftDropState,
): [boolean, SoftDropState] {
  const shouldProcess = on !== state.lastOn;
  const newState: SoftDropState = { lastOn: on };
  return [shouldProcess, newState];
}

/**
 * Creates a ProcessedAction for a TapMove.
 */
export function createProcessedTapMove(
  dir: -1 | 1,
  timestampMs: Timestamp,
): ProcessedAction {
  return {
    dir,
    kind: "TapMove",
    t: timestampMs,
  };
}

/**
 * Creates a ProcessedAction for a HoldMove.
 */
export function createProcessedHoldMove(
  dir: -1 | 1,
  timestampMs: Timestamp,
): ProcessedAction {
  return {
    dir,
    kind: "HoldMove",
    t: timestampMs,
  };
}

/**
 * Creates a ProcessedAction for a Rotate.
 */
export function createProcessedRotate(
  dir: "CW" | "CCW",
  timestampMs: Timestamp,
): ProcessedAction {
  return {
    dir,
    kind: "Rotate",
    t: timestampMs,
  };
}

/**
 * Creates a ProcessedAction for a SoftDrop.
 */
export function createProcessedSoftDrop(
  on: boolean,
  timestampMs: Timestamp,
): ProcessedAction {
  return {
    kind: "SoftDrop",
    on,
    t: timestampMs,
  };
}

/**
 * Creates a ProcessedAction for a HardDrop.
 */
export function createProcessedHardDrop(
  timestampMs: Timestamp,
): ProcessedAction {
  return {
    kind: "HardDrop",
    t: timestampMs,
  };
}

/**
 * Determines if the current game state allows processing input events.
 * Only process when there is an active piece and status is "playing".
 */
export function shouldProcessInCurrentState(
  hasActivePiece: boolean,
  status: GameState["status"],
): boolean {
  return hasActivePiece && status === "playing";
}
