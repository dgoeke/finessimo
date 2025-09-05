/**
 * Compile-time type tests for critical invariants
 * These tests ensure type correctness without runtime execution
 */

import { describe, it, expect } from "@jest/globals";

import type { GameState, BoardCells, ProcessedAction } from "@/state/types";

// Type-level test utilities
type Equals<A, B> = (() => A extends B ? 1 : 2) extends () => B extends A
  ? 1
  : 2
  ? true
  : false;
type Expect<T extends true> = T;

// Compile-time type assertions - exported to satisfy unused variable warnings
// Test GameState status union exhaustiveness
export type GameStateStatusTest = Expect<
  Equals<
    GameState["status"],
    "playing" | "resolvingLock" | "lineClear" | "topOut"
  >
>;

// Test Board dimensions are literal types
export type BoardWidthTest = Expect<Equals<GameState["board"]["width"], 10>>;
export type BoardHeightTest = Expect<Equals<GameState["board"]["height"], 20>>;

// Test BoardCells length constraint
export type BoardCellsLengthTest = Expect<Equals<BoardCells["length"], 200>>;

// Test that next queue is readonly
export type NextQueueReadonlyTest = Expect<
  Equals<
    GameState["nextQueue"],
    ReadonlyArray<"I" | "O" | "T" | "S" | "Z" | "J" | "L">
  >
>;

// Test that processed input log is readonly
export type ProcessedInputLogReadonlyTest = Expect<
  Equals<GameState["processedInputLog"], ReadonlyArray<ProcessedAction>>
>;

// Value-level export to keep Jest collecting this file
export const typeTestsComplete = true;

// Add a basic test to satisfy Jest requirement
describe("Type invariants", () => {
  it("should have type tests complete", () => {
    expect(typeTestsComplete).toBe(true);
  });
});
