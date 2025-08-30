import { createDurationMs, durationMsAsNumber } from "../../types/brands";

import type { Stats } from "../../state/types";

export function derive(stats: Stats): Stats {
  const {
    attempts,
    optimalInputs,
    optimalPlacements,
    piecesPlaced,
    sessionLinesCleared,
    sessionPiecesPlaced,
    timePlayedMs,
    totalInputs,
  } = stats;

  const accuracyPercentage =
    attempts > 0 ? (optimalPlacements / attempts) * 100 : 0;

  const finesseAccuracy =
    totalInputs > 0
      ? Math.min(100, Math.max(0, (optimalInputs / totalInputs) * 100))
      : 0;

  const playTimeMinutes =
    durationMsAsNumber(timePlayedMs) > 0
      ? durationMsAsNumber(timePlayedMs) / (1000 * 60)
      : 0;

  const averageInputsPerPiece =
    piecesPlaced > 0 ? totalInputs / piecesPlaced : 0;
  const piecesPerMinute =
    playTimeMinutes > 0 ? sessionPiecesPlaced / playTimeMinutes : 0;
  const linesPerMinute =
    playTimeMinutes > 0 ? sessionLinesCleared / playTimeMinutes : 0;

  return {
    ...stats,
    accuracyPercentage,
    averageInputsPerPiece,
    finesseAccuracy,
    linesPerMinute,
    piecesPerMinute,
  };
}

export function applyDelta(prev: Stats, delta: Partial<Stats>): Stats {
  return derive({ ...prev, ...delta });
}

export function updateSessionDurations(stats: Stats, nowMs: number): Stats {
  const sessionStart = stats.sessionStartMs as unknown as number;
  const sessionElapsed = Math.max(0, nowMs - sessionStart);
  return applyDelta(stats, {
    longestSessionMs: createDurationMs(
      Math.max(stats.longestSessionMs as unknown as number, sessionElapsed),
    ),
    timePlayedMs: createDurationMs(sessionElapsed),
  });
}
