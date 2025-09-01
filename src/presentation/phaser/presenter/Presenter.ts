import type { Presenter, RenderPlan, ViewModel } from "./types";

// Phase 0: No-op presenter to satisfy contracts and tests
export class NoopPresenter implements Presenter {
  computePlan(_: ViewModel | null, __: ViewModel): ReadonlyArray<RenderPlan> {
    return [{ t: "Noop" }];
  }

  apply(_: ReadonlyArray<RenderPlan>): void {
    // Intentionally empty in Phase 0
  }
}
