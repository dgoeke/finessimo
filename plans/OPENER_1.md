## CHAPTER 1 — Policy skeleton, hysteresis & 2 base templates (MVP)

### 1) Scope (what ships)

- Pure/deterministic policy API: `recommendMove(state, ctx): PolicyOutput`.
- Minimal template library: **TKI/base**, **PCO/standard**, plus **Neither/safe** fallback.
- Planner with hazards, **margin‑based confidence** and **hysteresis** gates.
- Executor: choose **one** placement (no grouping yet).
- Tests: unit + golden + property; perf microbench (planner).
- Telemetry stub only if trivial (optional).

**Non-goals now:** placement grouping/clustering, UI overlays, branching/rollout.

### 2) Files (≤5 product files; tests/benches don’t count)

```
src/policy/index.ts                 // public API (exports recommendMove)
src/policy/types.ts                 // policy-only types (Intent, Placement, Hazard, PolicyContext,...)
src/policy/planner.ts               // candidates, scoring, hazards, hysteresis, confidence
src/policy/templates/_compose.ts    // extendTemplate(patch)
src/policy/templates/index.ts       // TKI/base, PCO/standard, Neither/safe (3 templates)
```

**Tests & benches**

```
tests/policy/planner.test.ts
tests/policy/confidence.test.ts
tests/policy/templates.test.ts
tests/policy/property.test.ts
microbench/policy_planner.bench.ts
```

### 3) Public API & core types (exact signatures)

```ts
// src/policy/types.ts
import type { GridCoord, DurationMs, Seed } from "../types/brands";
import type { Timestamp } from "../types/timestamp";
import type { Rot, GameState, ModeGuidance } from "../types/types";

export type Intent = "TKI" | "PCO" | "Neither";

export type Placement = Readonly<{
  x: GridCoord;
  rot: Rot;
  useHold?: boolean;
}>;

export type PlacementGroup = Readonly<{
  rot: Rot;
  xs: ReadonlyArray<number>; // column numbers (read via GridCoord->number helper)
  primary: Placement;
  alts: ReadonlyArray<Placement>;
}>;

export type Suggestion = Readonly<{
  intent: Intent;
  placement: Placement;
  rationale: string; // ≤ 90 chars
  confidence: number; // 0..1
  planId?: string;
  groups?: ReadonlyArray<PlacementGroup>; // empty in Chapter 1
  guidance?: ModeGuidance; // optional UI targeting (unused in Chapter 1)
}>;

export type StepCandidate = Readonly<{
  when: (s: GameState) => boolean;
  propose: (s: GameState) => ReadonlyArray<Placement>;
  utility: (p: Placement, s: GameState) => number; // higher is better
}>;

export type Template = Readonly<{
  id: string; // e.g. "TKI/base", "PCO/standard"
  opener: Intent;
  preconditions: (s: GameState) => {
    feasible: boolean;
    notes: ReadonlyArray<string>;
    scoreDelta?: number;
  };
  nextStep: (s: GameState) => ReadonlyArray<StepCandidate>;
  // Chapter 3 fields, stubbed here:
  branch?: (s: GameState) => ReadonlyArray<Template>;
  gracefulExit?: (s: GameState) => Template | null;
}>;

export type Hazard = Readonly<{
  id: string;
  detect: (s: GameState) => boolean;
  penalty: number; // e.g., -0.8 .. -2.0
  reason: string;
  appliesTo?: ReadonlyArray<Intent>;
}>;

export type PolicyContext = Readonly<{
  lastPlanId: string | null;
  lastBestScore: number | null;
  lastSecondScore: number | null;
  planAge: number; // increments if plan unchanged
  lastUpdate: Timestamp | null; // reserved (optional time-decay)
}>;

export type PolicyOutput = Readonly<{
  suggestion: Suggestion;
  nextCtx: PolicyContext;
}>;
```

```ts
// src/policy/index.ts
import type { GameState } from "../types/types";
import type { PolicyContext, PolicyOutput } from "./types";

export function recommendMove(
  state: GameState,
  ctx?: PolicyContext
): PolicyOutput;
```

### 4) Algorithms & constants (grounded in A + B)

**Candidate enumeration:** iterate the 3 templates whose `preconditions` are **O(1)/O(width)** only.

**Scoring:** `scorePlan(t,s) = baseUtility(t,s) + (precond.scoreDelta ?? 0) + sum(hazard.penalty)`.

**Hazards** (start with 3, from A):

- `tki-no-early-i`: `!hasEarlyI(s.nextQueue) && s.active?.id !== "I"` → penalty \~ **-1.5**.
- `overhang-without-T`: overhang created while T not secured → \~ **-1.2**.
- `split-needs-I`: deep split requiring I that isn’t secured → \~ **-0.8**.

**Hysteresis** (from A): only switch plans if challenger beats current by `SWITCH_MARGIN` **and** (`planAge ≥ MIN_PLAN_AGE` **or** `currentConfidence < LOW_CONF`).
_Defaults (tunable later):_

```ts
export const SWITCH_MARGIN = 0.2;
export const MIN_PLAN_AGE = 2;
export const LOW_CONF = 0.4;
export const ACCEPT_MIN_CONF = 0.35;
```

**Confidence:**

```ts
// src/policy/planner.ts
// margin -> sigmoid; fragility 0..1; progress decay on remaining steps
confidence =
  (1 / (1 + Math.exp(-(bestScore - secondScore) / 0.8))) *
  (1 - 0.6 * planFragility(state, chosen)) *
  Math.pow(0.97, progress.remaining);
```

**Executor (Chapter 1):** gather `nextStep(state)` candidates, include `useHold` options; filter invariant breakers; pick **single** best by `utility`.

**Performance budget:**

- **Planner** (enumerate + hazards + placement pick): **≤ 0.3 ms** per spawn (typical dev laptop).
- **Clustering** not in Chapter 1.

**Micro‑optimizations:**

- Memoize column heights, slot masks, simple checks within a spawn.
- Keep template set **small** (2–3 per opener + Neither).
- (Optional) Bitboard path for `applyPlacement` in simulation—**not required** in Chapter 1.

### 5) Implementation steps

1. `types.ts`: add the policy types above.
2. `templates/_compose.ts`: `extendTemplate(base, patch)` where patch overwrites shallow fields and composes `preconditions` and `nextStep` (call both).
3. `templates/index.ts`:
   - `tkiBase`: minimal silhouette & `nextStep` that proposes legal TKI placements for the **current** piece (plus hold alt).
   - `pcoStandard`: analogous for PCO.
   - `neitherSafe`: LST‑style safe stacking.
   - Preconditions must be **O(1)/O(width)** (flatness, early‑I/T secured, simple slot masks).

4. `planner.ts`:
   - `planCandidates(s)`, `applyHazards(t,s)`, `scorePlan(t,s)`.
   - `calculateConfidence(best,second,state,chosen)` using A’s constants.
   - Hysteresis gate + `updateContext(prevCtx, chosen, bestScore, secondScore)`.
   - `choosePlacementForStep(t,s)`; ensure invariant preservation.

5. `index.ts`: wire `recommendMove(state, ctx)`.

### 6) Tests

- **Unit**
  - Preconditions: early‑I, flatness, split detection.
  - Invariants: slot preservation, silhouette progress monotonicity.
  - Hazards: detection toggles and penalties applied once.
  - Confidence monotonicity vs. margin; fragility increases → confidence decreases.

- **Golden (deterministic)**
  - 4–6 `ScenarioCard`‑like fixtures with **Seed**s (temporary local fixtures since Chapter 2 formalizes scenarios). Assert chosen `planId`, `intent`, and that `placement` is one of allowed solutions.
  - Hysteresis: minor score perturbation doesn’t flip plan before `MIN_PLAN_AGE`.

- **Property**
  - Random near‑flat boards: `pcoStandard` never proposes illegal placements.
  - Random early‑I: `tkiBase` feasible more often than `Neither`.

- **Perf**
  - `microbench/policy_planner.bench.ts`: warm 200 runs; measure 1k runs; assert mean ≤ **0.3 ms**. Include 95th percentile log (informational).

### 7) Acceptance criteria (binary)

- `tsc` clean.
- All tests pass.
- `recommendMove` returns stable decision & confidence for fixed Seeds.
- Perf bench mean ≤ 0.3 ms.

### 8) Risks & mitigations

- **Too many variants** → keep only 2 templates + Neither in Chapter 1.
- **Confidence spikes** → cap confidences to \[0,1]; tighten hazard penalties if noisy.
- **Perf regression** → ensure memoization; avoid deep search.
