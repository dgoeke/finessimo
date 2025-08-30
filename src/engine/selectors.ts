import { dropToBottom, isAtBottom } from "../core/board";
import { isPlaying } from "../state/types";
import { durationMsAsNumber } from "../types/brands";

import type { ActivePiece, GameState, PlayingState } from "../state/types";
import type { Timestamp } from "../types/timestamp";

// State variant helpers for UI branching
export const selectStatus = (s: GameState): GameState["status"] => s.status;
export const selectIsPlaying = (s: GameState): s is PlayingState =>
  isPlaying(s);
export const selectIsResolving = (s: GameState): boolean =>
  s.status === "resolvingLock";
export const selectIsLineClear = (s: GameState): boolean =>
  s.status === "lineClear";
export const selectIsTopOut = (s: GameState): boolean => s.status === "topOut";

// Stats and high-level metrics
export const selectPPM = (s: GameState): number => s.stats.piecesPerMinute;
export const selectLPM = (s: GameState): number => s.stats.linesPerMinute;
export const selectFinesseAccuracy = (s: GameState): number =>
  s.stats.finesseAccuracy;
export const selectAvgInputsPerPiece = (s: GameState): number =>
  s.stats.averageInputsPerPiece;

// Active piece accessors (safe)
export const selectActive = (s: GameState): ActivePiece | undefined =>
  isPlaying(s) ? s.active : undefined;

// Grounded/lock delay status for UI indicators
export const selectIsGrounded = (s: GameState): boolean => {
  const a = selectActive(s);
  return Boolean(a && isAtBottom(s.board, a));
};

export const selectLockResets = (s: GameState): number =>
  s.physics.lockDelay.tag === "Grounded" ? s.physics.lockDelay.resets : 0;

export const selectLockElapsedMs = (s: GameState, now: Timestamp): number => {
  if (s.physics.lockDelay.tag !== "Grounded") return 0;
  const start = s.physics.lockDelay.start as unknown as number;
  const nowNum = now as unknown as number;
  return Math.max(0, nowNum - start);
};

export const selectLockDelayMs = (s: GameState): number =>
  durationMsAsNumber(s.timing.lockDelayMs);
export const selectLockResetCap = (s: GameState): number =>
  s.timing.lockDelayMaxResets;

// Ghost piece (for rendering overlays)
export function selectGhostPieceBottom(s: GameState): ActivePiece | undefined {
  const a = selectActive(s);
  return a ? dropToBottom(s.board, a) : undefined;
}
