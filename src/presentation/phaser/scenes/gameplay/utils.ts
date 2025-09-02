import { durationMsAsNumber } from "../../../../types/brands";

import type { GameState } from "../../../../state/types";

export function shouldCompleteLineClear(
  state: GameState,
  nowMs: number,
): boolean {
  if (state.status !== "lineClear") return false;
  const delay = durationMsAsNumber(state.timing.lineClearDelayMs);
  if (delay === 0) return false; // Immediate clearing handled in reducer
  const start = state.physics.lineClearStartTime;
  if (start === null) return false; // not started
  return nowMs - start >= delay;
}

export function simpleEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function shallowEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  if (a === b) return true;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export function hexToNumber(hex: string): number {
  const s = hex.startsWith("#") ? hex.slice(1) : hex;
  const n = Number.parseInt(s, 16);
  return Number.isFinite(n) ? n : 0xffffff;
}

export function assertNever(x: never): never {
  throw new Error(`Unreachable variant: ${String(x)}`);
}
