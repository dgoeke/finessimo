// Type-level tests for branded types without suppressions
// These tests validate that our branded types work correctly at compile time

import type {
  DurationMs,
  GridCoord,
  CellValue,
  Frame,
  Seed,
} from "@/types/brands";
import type { Timestamp } from "@/types/timestamp";

// Utility types for compile-time testing
type Equals<A, B> = (() => A) extends () => B
  ? (() => B) extends () => A
    ? true
    : false
  : false;
type Expect<T extends true> = T;

// Test that branded types are NOT equal to their base types (that's the point of branding)
type _1 = Equals<Timestamp, number>; // Should be false - brands should not equal base types
type _2 = Equals<DurationMs, number>; // Should be false
type _3 = Equals<GridCoord, number>; // Should be false
type _4 = Equals<Frame, number>; // Should be false
type _5 = Equals<Seed, string>; // Should be false
type __6 = Expect<_1 extends false ? true : false>;
type __7 = Expect<_2 extends false ? true : false>;
type __8 = Expect<_3 extends false ? true : false>;
type __9 = Expect<_4 extends false ? true : false>;
type __10 = Expect<_5 extends false ? true : false>;

// Test that branded types DO extend their base types (structural compatibility)
// but are NOT equal to them (nominal typing)
type _11 = Timestamp extends number ? true : false;
type __12 = Expect<_11>; // Should be true - Timestamp should extend number (structurally compatible)

// Test CellValue constraints
type _13 = CellValue extends 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 ? true : false;
type __14 = Expect<_13>; // Should be true

// Test that different branded types are distinct
type _15 = Equals<Timestamp, DurationMs>;
type __16 = Expect<_15 extends false ? true : false>; // Should be true - different brands should be distinct

// Export a runtime value to ensure Jest processes this file
// Also reference our type tests to avoid unused warnings
export const typeLevelTestsComplete = [
  true as __6,
  true as __7,
  true as __8,
  true as __9,
  true as __10,
  true as __12,
  true as __14,
  true as __16,
] as const;

// Runtime test to satisfy Jest requirement
describe("Branded Types", () => {
  it("should validate type system compile-time tests", () => {
    expect(typeLevelTestsComplete.length).toBe(8);
    expect(typeLevelTestsComplete).toBeTruthy();
  });
});
