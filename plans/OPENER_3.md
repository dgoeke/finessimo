## CHAPTER 3 — Branching & graceful fallback (+ tie‑break rollout)

### 1) Scope

- Enable **template branching** and **gracefulExit** fallback when a plan becomes non‑viable.
- Add **1–2 ply micro‑rollout** only for **tie‑breaks** (never full search).
- Expand **hazard severities** and refine silhouette/utility scoring.
- No grouping UI yet.

### 2) Files (≤4 product files)

```
src/policy/planner.ts          // modify: branching + gracefulExit + tie-break rollout
src/policy/rollout.ts          // new: micro-rollout evaluator (1–2 ply)
src/policy/silhouettes.ts      // new: silhouette progress helpers
src/policy/templates/variants.ts  // add 1–2 more variants (patches)
```

**Tests**

```
tests/policy/branching.test.ts
tests/policy/rollout.test.ts
tests/policy/hazards_severity.test.ts
```

### 3) Behavior & rules

- **Branching:** if chosen plan’s `preconditions` turn false mid‑sequence, check `branch(s)` for viable sibling variants; otherwise call `gracefulExit(s)` to pick `Neither/safe`.
- **Tie‑break rollout:** when `|bestScore - secondScore| < EPS` (e.g., 0.05), simulate **one future placement** from preview to disambiguate; keep within perf budget.
- **Hazards:** introduce severity tiers; concatenate reasons in `rationale` (≤90 chars).
- **Hysteresis:** unchanged constants.

### 4) Tests

- **Branching**
  - Given a scenario where TKI loses early‑I, planner selects a TKI variant via `branch`; if none, falls back to `Neither`.

- **Rollout**
  - With equal utilities, rollout resolves toward the variant that creates higher silhouette progress and lower finesse cost.

- **Hazards**
  - Multiple hazards sum once; severities align with penalties.

- **Property**
  - No illegal placements across 1–2 ply simulation.

- **Perf**
  - Planner including tie‑break rollout still ≤ **0.3 ms** mean (log 95p).

### 5) Acceptance criteria

- All Chapter 1/2 tests still green.
- New branching/rollout tests green; perf budget upheld.

### 6) Risks & mitigations

- Rollout creep → **limit to 1 ply** by default; 2 ply behind constant flag for experiments.
- Branch loops → track `planId` history within a spawn and cap branch depth (e.g., ≤2).
