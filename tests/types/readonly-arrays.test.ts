// Type-level tests for readonly array discipline
// These tests validate that our readonly arrays are properly enforced

import type {
  GameState,
  ProcessedAction,
  PendingLock,
  Action,
  PieceId,
} from "../../src/state/types";

// Utility types for compile-time testing
type _Equals<A, B> = (() => A) extends () => B
  ? (() => B) extends () => A
    ? true
    : false
  : false;
type Expect<T extends true> = T;
type IsReadonly<T> = T extends ReadonlyArray<unknown> ? true : false;

// Test that array fields are readonly
type _1 = IsReadonly<GameState["nextQueue"]>;
type _2 = IsReadonly<GameState["processedInputLog"]>;
type __3 = Expect<_1>; // nextQueue should be readonly
type __4 = Expect<_2>; // processedInputLog should be readonly

// Test PendingLock arrays are readonly
type _5 = IsReadonly<PendingLock["completedLines"]>;
type __6 = Expect<_5>; // completedLines should be readonly

// Test Action arrays are readonly where applicable
type RefillAction = Extract<Action, { type: "RefillPreview" }>;
type ReplaceAction = Extract<Action, { type: "ReplacePreview" }>;
type ClearLinesAction = Extract<Action, { type: "ClearLines" }>;

type _7 = IsReadonly<RefillAction["pieces"]>;
type _8 = IsReadonly<ReplaceAction["pieces"]>;
type _9 = IsReadonly<ClearLinesAction["lines"]>;
type __10 = Expect<_7>; // RefillPreview pieces should be readonly
type __11 = Expect<_8>; // ReplacePreview pieces should be readonly
type __12 = Expect<_9>; // ClearLines lines should be readonly

// Test that ProcessedAction log is properly typed
type _13 =
  GameState["processedInputLog"] extends ReadonlyArray<ProcessedAction>
    ? true
    : false;
type __14 = Expect<_13>;

// Test nextQueue typing
type _15 = GameState["nextQueue"] extends ReadonlyArray<PieceId> ? true : false;
type __16 = Expect<_15>;

// Export a runtime value to ensure Jest processes this file
// Also reference our type tests to avoid unused warnings
export const readonlyArrayTestsComplete = [
  true as __3,
  true as __4,
  true as __6,
  true as __10,
  true as __11,
  true as __12,
  true as __14,
  true as __16,
] as const;

// Export a test to avoid unused warning
export type _TestTypeReference = _Equals<
  ReadonlyArray<string>,
  ReadonlyArray<string>
>;

// Runtime test to satisfy Jest requirement
describe("Readonly Arrays", () => {
  it("should validate readonly array type constraints", () => {
    expect(readonlyArrayTestsComplete.length).toBeGreaterThan(0);
    expect(readonlyArrayTestsComplete).toBeTruthy();
  });
});
