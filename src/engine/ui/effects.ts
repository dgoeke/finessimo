import { durationMsAsNumber } from "../../types/brands";

import type { GameState, UiEffect } from "../../state/types";
import type { Timestamp } from "../../types/timestamp";

/**
 * UI Effects helpers: push/prune/clear.
 * Effects are pure data; renderer decides how to animate.
 * Pruning is deterministic via provided `now` (no timers here).
 */

export function pushUiEffect<S extends GameState>(
  state: S,
  effect: UiEffect,
): S {
  const next = state.uiEffects.concat(effect) as ReadonlyArray<UiEffect>;
  return { ...state, uiEffects: next } as S;
}

export function pruneUiEffects<S extends GameState>(
  state: S,
  now: Timestamp,
): S {
  const nowNum = now as unknown as number;
  const pruned = state.uiEffects.filter((e) => {
    const created = e.createdAt as unknown as number;
    const ttl = durationMsAsNumber(e.ttlMs);
    return nowNum - created < ttl;
  }) as ReadonlyArray<UiEffect>;

  return pruned === state.uiEffects
    ? state
    : ({ ...state, uiEffects: pruned } as S);
}

export function clearUiEffects<S extends GameState>(state: S): S {
  return state.uiEffects.length === 0
    ? state
    : ({ ...state, uiEffects: [] } as S);
}
