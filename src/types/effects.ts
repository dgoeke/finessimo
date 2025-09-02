// Effect description patterns for temporal and side effects

import type { DurationMs } from "./brands";

/**
 * Describes a delayed effect without executing it.
 * This separates effect description from interpretation.
 */
export type DelayedEffect<T = void> = {
  readonly type: "delayed";
  readonly delayMs: DurationMs;
  readonly action: () => T;
};

/**
 * Describes an immediate effect.
 */
export type ImmediateEffect<T = void> = {
  readonly type: "immediate";
  readonly action: () => T;
};

/**
 * Union of all effect types.
 */
export type Effect<T = void> = DelayedEffect<T> | ImmediateEffect<T>;

/**
 * Creates a delayed effect description.
 */
export const createDelayedEffect = <T = void>(
  delayMs: DurationMs,
  action: () => T,
): DelayedEffect<T> => ({
  action,
  delayMs,
  type: "delayed",
});

/**
 * Creates an immediate effect description.
 */
export const createImmediateEffect = <T = void>(
  action: () => T,
): ImmediateEffect<T> => ({
  action,
  type: "immediate",
});

/**
 * Type guard for delayed effects.
 */
export const isDelayedEffect = <T>(
  effect: Effect<T>,
): effect is DelayedEffect<T> => effect.type === "delayed";

/**
 * Type guard for immediate effects.
 */
export const isImmediateEffect = <T>(
  effect: Effect<T>,
): effect is ImmediateEffect<T> => effect.type === "immediate";
