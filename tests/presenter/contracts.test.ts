import { describe, expect, it } from "@jest/globals";

import { NoopPresenter } from "../../src/presentation/phaser/presenter/Presenter";
import { mapGameStateToViewModel } from "../../src/presentation/phaser/presenter/viewModel";

import type {
  Col,
  Ms,
  Px,
  RenderPlan,
  Row,
  ViewModel,
  Presenter as PresenterType,
} from "../../src/presentation/phaser/presenter/types";
import type { GameState } from "../../src/state/types";

// Type-level test utilities
type Equals<A, B> = (() => A extends B ? 1 : 2) extends () => B extends A
  ? 1
  : 2
  ? true
  : false;
type Expect<T extends true> = T;

// Exhaustiveness helper for discriminated unions
function assertNever(x: never): never {
  throw new Error(`Unreachable variant: ${String(x)}`);
}

// --- Brand contracts ---
export type _PxBrand = Expect<Equals<Px, number & { readonly __brand: "Px" }>>;
export type _ColBrand = Expect<
  Equals<Col, number & { readonly __brand: "Col" }>
>;
export type _RowBrand = Expect<
  Equals<Row, number & { readonly __brand: "Row" }>
>;
export type _MsBrand = Expect<Equals<Ms, number & { readonly __brand: "Ms" }>>;

// --- RenderPlan tag exhaustiveness ---
export type _RenderPlanTags = Expect<
  Equals<
    RenderPlan["t"],
    "TileDiff" | "PiecePos" | "CameraFx" | "SoundCue" | "UiHint" | "Noop"
  >
>;

// This function must remain exhaustive; adding a new variant should fail here
function exhaustivePlanCheck(plan: RenderPlan): void {
  switch (plan.t) {
    case "TileDiff":
    case "PiecePos":
    case "CameraFx":
    case "SoundCue":
    case "UiHint":
    case "Noop":
      return;
    default:
      return assertNever(plan);
  }
}

// Keep Jest collecting this file
export const typeContractsOk = true;

// Map function signature contract (type-level)
export type _MapSig = Expect<
  Equals<typeof mapGameStateToViewModel, (s: Readonly<GameState>) => ViewModel>
>;

describe("Presenter contracts (Phase 0)", () => {
  it("should construct a NoopPresenter matching the Presenter type", () => {
    const p: PresenterType = new NoopPresenter();
    // Runtime smoke: computePlan returns a Noop plan
    const vmPrev: ViewModel | null = null;
    const vmNext: ViewModel = {
      board: [],
      hud: { lines: 0, mode: "", score: 0 },
      topOut: false,
    } as const;
    const plan = p.computePlan(vmPrev, vmNext);
    expect(Array.isArray(plan)).toBe(true);
    expect(plan[0]?.t).toBe("Noop");
    // ensure exhaustive check compiles against union
    if (plan[0]) exhaustivePlanCheck(plan[0]);
  });

  it("should expose mapGameStateToViewModel signature", () => {
    expect(typeof mapGameStateToViewModel).toBe("function");
  });
});
