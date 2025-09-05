// Type-level tests for discriminated state unions
// These tests validate that our state union types work correctly at compile time

import type {
  GameState,
  PlayingState,
  ResolvingLockState,
  LineClearState,
  TopOutState,
  Action,
} from "@/state/types";

// Utility types for compile-time testing
type Equals<A, B> = (() => A) extends () => B
  ? (() => B) extends () => A
    ? true
    : false
  : false;
type Expect<T extends true> = T;

// Test that GameState is exactly the union of all states
type _1 = Equals<
  GameState,
  PlayingState | ResolvingLockState | LineClearState | TopOutState
>;
type __2 = Expect<_1>; // Should be true

// Test discriminated union status field
type _3 = GameState["status"] extends
  | "playing"
  | "resolvingLock"
  | "lineClear"
  | "topOut"
  ? true
  : false;
type __4 = Expect<_3>; // Should be true

// Test that each state has the correct status
type _5 = PlayingState["status"] extends "playing" ? true : false;
type _6 = ResolvingLockState["status"] extends "resolvingLock" ? true : false;
type _7 = LineClearState["status"] extends "lineClear" ? true : false;
type _8 = TopOutState["status"] extends "topOut" ? true : false;
type __9 = Expect<_5>;
type __10 = Expect<_6>;
type __11 = Expect<_7>;
type __12 = Expect<_8>;

// Test pendingLock constraints
type _13 = PlayingState["pendingLock"] extends null ? true : false;
type _14 = TopOutState["pendingLock"] extends null ? true : false;
type _15 = LineClearState["pendingLock"] extends null ? true : false;
type __16 = Expect<_13>;
type __17 = Expect<_14>;
type __18 = Expect<_15>;

// Test that ResolvingLockState has non-null pendingLock
type _19 = ResolvingLockState["pendingLock"] extends null ? false : true;
type __20 = Expect<_19>;

// Test that LineClearState has required fields (line clear data is in physics)
type _21 = "physics" extends keyof LineClearState ? true : false;
type _22 = "status" extends keyof LineClearState ? true : false;
type __23 = Expect<_21>;
type __24 = Expect<_22>;

// Test Action type completeness - should include all our actions
type ActionTypes = Action["type"];
type _25 = "Init" extends ActionTypes ? true : false;
type _26 = "Tick" extends ActionTypes ? true : false;
type _27 = "TapMove" extends ActionTypes ? true : false;
type _28 = "HardDrop" extends ActionTypes ? true : false;
type __29 = Expect<_25>;
type __30 = Expect<_26>;
type __31 = Expect<_27>;
type __32 = Expect<_28>;

// Export a runtime value to ensure Jest processes this file
// Also reference our type tests to avoid unused warnings
export const stateUnionTestsComplete = [
  true as __2,
  true as __4,
  true as __9,
  true as __10,
  true as __11,
  true as __12,
  true as __16,
  true as __17,
  true as __18,
  true as __20,
  true as __23,
  true as __24,
  true as __29,
  true as __30,
  true as __31,
  true as __32,
] as const;

// Runtime test to satisfy Jest requirement
describe("State Unions", () => {
  it("should validate discriminated union type constraints", () => {
    expect(stateUnionTestsComplete.length).toBe(16);
    expect(stateUnionTestsComplete).toBeTruthy();
  });
});
