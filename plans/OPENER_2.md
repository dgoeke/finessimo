## CHAPTER 2 — Scenarios + SRS + minimal Coaching HUD

### 1) Scope

- Formalize **ScenarioCards**, deterministic **sequence generators**, and SRS scheduling.
- Minimal **coaching overlay** that reads `Suggestion.rationale` and (optionally) a `ModeGuidance` target id (no grouping yet).
- Add 1–2 **patch variants** via `extendTemplate` to broaden coverage (e.g., `TKI/flatTop`, `PCO/alt.edgeX`).

### 2) Files (≤5 product files)

```
src/scenarios/cards.ts            // types + registry of scenario cards
src/scenarios/generators.ts       // deterministic piece queues by Seed
src/scenarios/srs.ts              // spaced repetition scheduler (Again/Hard/Good/Easy)
src/ui/coachOverlay.tsx           // dumb HUD showing rationale + optional target
src/policy/templates/variants.ts  // 1–2 extendTemplate() variants
```

**Tests**

```
tests/scenarios/cards.test.ts
tests/scenarios/srs.test.ts
tests/ui/coachOverlay.test.tsx
tests/policy/variants.test.ts
```

### 3) Key types & functions

```ts
// src/scenarios/cards.ts
import type { Seed, DurationMs } from "../types/brands";
export type ScenarioCard = Readonly<{
  id: string; // "PCO/std:easyA"
  opener: "TKI" | "PCO";
  seed: Seed; // branded string
  startTicks?: number; // optional offset
  notes?: ReadonlyArray<string>;
  maxGarbage?: number;
  minPreview?: number; // minimal preview length guard
}>;
export const SCENARIOS: ReadonlyArray<ScenarioCard>;
```

```ts
// src/scenarios/generators.ts
export function queueFromSeed(seed: Seed, minPreview = 5): ReadonlyArray<string>;
export function boardFromScenario(card: ScenarioCard): /* existing Board/GameState builder */;
```

```ts
// src/scenarios/srs.ts
import type { DurationMs } from "../types/brands";
import type { Timestamp } from "../types/timestamp";
export type Grade = "Again" | "Hard" | "Good" | "Easy";
export type ReviewState = Readonly<{
  ease: number;
  interval: DurationMs;
  due: Timestamp;
}>;
export function nextReview(
  now: Timestamp,
  prev: ReviewState,
  grade: Grade
): ReviewState;
```

```tsx
// src/ui/coachOverlay.tsx
// A small, dependency-light overlay that renders suggestion.rationale
// and highlights an element by ModeGuidance.target (if provided).
```

### 4) Implementation details & constraints

- **Generators:** deterministic PRNG keyed by **Seed** (repo brand). No network/IO.
- **SRS:** simple SM‑2‑like update: `Again` → short interval; `Hard` → small increase; `Good`/`Easy` → multiplicative growth with `ease` adjustments.
- **HUD:** minimal React/TS component; no new CSS frameworks; no grouping UI.
- **Templates:** create 1–2 `extendTemplate` variants; keep preconditions O(1)/O(width).

### 5) Tests

- **Cards/Generators**
  - Registry loads; ids unique; cards validate (minPreview respected).
  - `queueFromSeed(seed)` → same result across runs; preview length ≥ `minPreview`.

- **SRS**
  - Monotonic intervals: `Again ≤ Hard ≤ Good ≤ Easy`.
  - Due dates always `>= now`; `ease` within sane bounds \[1.3..2.8] (example).

- **HUD**
  - Renders rationale text; if `guidance?.target` is set, class toggles on that element id (smoke test).

- **Variants**
  - Preconditions consistent with base; extended templates preserve invariants.

- **Perf**
  - None beyond Chapter 1 budget; scenario generation trivial.

### 6) Acceptance criteria

- `npm run check` clean
- At least **6** scenarios spanning TKI/PCO easy/mid.
- Calling `recommendMove` on a scenario produces a rationale string; HUD shows it.
