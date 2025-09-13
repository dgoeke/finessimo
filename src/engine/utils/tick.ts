import type { Tick } from "../types";

/**
 * Type-safe utilities for working with branded Tick types.
 * These are the only allowed operations on Tick values to maintain type safety
 * and prevent mixing different time units.
 */

/**
 * Safely adds a delta (in ticks) to a branded Tick type.
 * Used at system boundaries where arithmetic is necessary.
 */
export function addTicks(baseTick: Tick, deltaTicks: number): Tick {
  return (baseTick + deltaTicks) as Tick;
}

/**
 * Increments a tick by 1. Used for advancing time in the engine.
 */
export function incrementTick(tick: Tick): Tick {
  return (tick + 1) as Tick;
}

/**
 * Compares two Tick values.
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareTicks(a: Tick, b: Tick): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Checks if tick is strictly after (greater than) the deadline.
 */
export function isTickAfter(tick: Tick, deadline: Tick): boolean {
  return tick > deadline;
}

/**
 * Checks if tick is at or after (greater than or equal to) the deadline.
 * Commonly used for deadline checks in physics and timing.
 */
export function isTickAfterOrEqual(tick: Tick, deadline: Tick): boolean {
  return tick >= deadline;
}

/**
 * Converts a raw number to a branded Tick type.
 * Should only be used at system boundaries (initialization, parsing).
 *
 * @param n - The number to convert to a Tick
 * @returns The branded Tick value
 */
export function asTick(n: number): Tick {
  return n as Tick;
}

/**
 * Subtracts one tick from another to get the delta.
 * Useful for calculating elapsed time between ticks.
 */
export function tickDelta(later: Tick, earlier: Tick): number {
  return (later as number) - (earlier as number);
}
