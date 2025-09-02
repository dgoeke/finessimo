# Openers Policy Training — Revised Design & Implementation Plan (TKI & PCO)

**Repo context:** `finessimo` (TypeScript, immutable data flow). Relevant areas: `src/policy/*`, `src/finesse/*`, `src/state/*`, `src/core/*`, `src/types/*`, `src/ui/*`.

---

## What changed in this revision

**Purpose of this rewrite:** tighten the design around existing repo types, fold in the proposals from `plan_updates.md`, and remove ambiguity.

**Key fixes & alignments**

- **Type alignment with `src/types/brands.ts` and `src/types/timestamp.ts`:**
  - Replaced ad‑hoc `GridX`/`GridY` with **`GridCoord`**.
  - Replaced `Rot` numeric union with repo’s **`Rot = "spawn" | "right" | "two" | "left"`** (see `types.ts`).
  - Use **`DurationMs`** brand from `brands.ts`.
  - Use **`Seed`** **as a branded `string`** (repo), not a number.
  - Use **`Timestamp`** from `types/timestamp.ts` where needed.
  - Reuse **`ModeGuidance`** for UI targeting instead of inventing a parallel shape.
- **API surface:** `recommendMove` now has a pure, immutable **context** to support hysteresis (avoids thrash between plans). Backward‑compatible wrapper preserved.
- **Template system:** introduces **composition via patches** (`extendTemplate`) so opener variants are small overrides of a common base.
- **Scoring & confidence:** adopts **margin‑based confidence with fragility weighting** and **bounded decay**; adds plan hysteresis rules.
- **Anti‑patterns:** formalizes **hazards** (first‑class) with severity; hazards inform both scoring and the rationale text.
- **Executor output:** introduces **placement clustering** (by `rot` and contiguous `x` spans) with a **Pareto filter** on utility vs. finesse cost for UI hints.
- **Consistency:** removes redefinitions of `GameState`/`Board`; the design refers to existing repo types.

---

## Table of Contents

1. [Motivation & Scope](#motivation--scope)
2. [Learning Objectives](#learning-objectives)
3. [Policy API (Planner + Executor)](#policy-api-planner--executor)
4. [Types](#types)
5. [Template Library & Composition](#template-library--composition)
6. [Scoring, Hazards & Confidence](#scoring-hazards--confidence)
7. [Executor & Placement Clustering](#executor--placement-clustering)
8. [Scenario Generation & SRS](#scenario-generation--srs)
9. [Game Modes](#game-modes)
10. [UI/UX & Explainability](#uiux--explainability)
11. [Algorithms (Pseudocode)](#algorithms-pseudocode)
12. [Performance](#performance)
13. [Testing](#testing)
14. [Telemetry](#telemetry)
15. [Phased Implementation Plan](#phased-implementation-plan)
16. [Risks & Mitigations](#risks--mitigations)
17. [Appendix A — Type alignment notes](#appendix-a--type-alignment-notes)

---

## Motivation & Scope

Current finesse training treats each **(piece, rotation, target‑x)** in isolation. **Openers** (e.g., **TKI**, **PCO**) are _multi‑piece_ patterns with branching, hold use, and timing. We want players to:

- **Recognize** opener viability from the initial board + preview.
- **Execute** the next step (including **hold**) that progresses the chosen pattern.
- **Generalize** via scenario practice and SRS, not memorize only one fixed path.

**Non‑goals (initial):** full‑search solvers; mid‑game strategy; deep bag lookahead beyond light rollouts. Start with clean boards; later accept light noise.

---

## Policy API (Planner + Executor)

We expose a single policy that is **pure** and **deterministic** given `(state, ctx)`:

```ts
// src/policy/index.ts
import type { GameState, ModeGuidance, Rot } from "../types/types"; // Rot: "spawn" | "right" | "two" | "left"
import type { GridCoord, DurationMs, Seed } from "../types/brands";
import type { Timestamp } from "../types/timestamp";

export type Intent = "TKI" | "PCO" | "Neither";

export type Placement = Readonly<{
  x: GridCoord;
  rot: Rot;
  useHold?: boolean; // true => move current to hold and use next
}>;

export type Hazard = Readonly<{
  id: string; // e.g., "overhang-without-T", "split-needs-I"
  severity: 1 | 2 | 3; // 1=low 2=med 3=high
  note: string; // short UI-safe explanation
}>;

export type PlacementGroup = Readonly<{
  rot: Rot;
  xs: ReadonlyArray<GridCoord>; // contiguous span(s) for UI
  primary: Placement; // highest-utility in group
  alts: ReadonlyArray<Placement>;
}>;

export type Suggestion = Readonly<{
  intent: Intent;
  placement: Placement; // for current piece (after hold, if used)
  planId?: string; // chosen template/variant id
  rationale: string; // short explanation w/ 1–2 hazards + one positive
  confidence: number; // 0..1
  hazards?: ReadonlyArray<Hazard>;
  groups?: ReadonlyArray<PlacementGroup>; // optional grouped hints for UI
  guidance?: ModeGuidance; // reuse existing UI guidance type
}>;

export type PolicyContext = Readonly<{
  lastPlanId: string | null;
  lastBestScore: number | null;
  lastSecondScore: number | null;
  planAge: number; // increments if plan unchanged
  lastUpdate: Timestamp | null; // for optional time-based decay
}>;

export type PolicyOutput = Readonly<{
  suggestion: Suggestion;
  nextCtx: PolicyContext;
}>;

// Back-compat wrapper (stateless). Modes should migrate to the ctx form.
export function recommendMove(
  state: GameState,
  ctx?: PolicyContext
): PolicyOutput;
```

**Planner** chooses `intent + plan (template variant)` with scoring. **Executor** chooses the concrete placement for **this** piece (including `useHold`).

---

## Types

We rely on existing repo types:

- **`GridCoord`**, **`DurationMs`**, **`Seed`**, **`UiEffectId`** from `src/types/brands.ts` (note: `Seed` is a branded **string**).
- **`Timestamp`** from `src/types/timestamp.ts`.
- **`Rot`** and **`GameState`**, **`ModeGuidance`** from `src/types/types.ts`.
- Finesse analysis via `finesse/calculator` (e.g., for **Pareto filtering** and **cost**).

This module defines only opener‑specific types (`Intent`, `Placement`, `Hazard`, `PlacementGroup`, `PolicyContext`, `Template`, etc.).

---

## Template Library & Composition

Templates describe an opener’s **preconditions**, and how to generate **step candidates** for the current piece.

```ts
export type StepCandidate = Readonly<{
  when: (s: GameState) => boolean;
  propose: (s: GameState) => ReadonlyArray<Placement>;
  utility: (p: Placement, s: GameState) => number; // higher is better
}>;

export type Template = Readonly<{
  id: string; // e.g., "TKI/base", "PCO/std"
  opener: Intent; // "TKI" | "PCO" | "Neither"
  preconditions: (s: GameState) => Readonly<{
    feasible: boolean;
    notes: ReadonlyArray<string>;
    scoreDelta?: number; // bias for ranking
  }>;
  nextStep: (s: GameState) => ReadonlyArray<StepCandidate>;
  branch?: (s: GameState) => string | null; // template.id to jump to
  gracefulExit?: (s: GameState) => Intent; // where to go if infeasible
}>;
```

### Composition via patches (`plan_updates.md`)

Treat variants as **small overrides** of a common base. Left‑to‑right deterministic merge:

```ts
// src/policy/templates/_compose.ts
type TemplatePatch = Partial<Omit<Template, "id" | "opener">> & { id: string };

export function extendTemplate(base: Template, patch: TemplatePatch): Template {
  return {
    ...base,
    ...patch,
    preconditions: patch.preconditions
      ? (s) => {
          const b = base.preconditions(s);
          const p = patch.preconditions!(s);
          return {
            feasible: b.feasible && p.feasible,
            notes: [...b.notes, ...p.notes],
            scoreDelta: (b.scoreDelta ?? 0) + (p.scoreDelta ?? 0),
          };
        }
      : base.preconditions,
    nextStep: patch.nextStep
      ? (s) => [...base.nextStep(s), ...patch.nextStep!(s)]
      : base.nextStep,
  };
}
```

**Guardrails** (to prevent template sprawl):

- Prefer patches over new top‑level templates.
- Only create a new template id when **steps truly differ** (not just preconditions).
- Keep variant files tiny (`tki.flatTop.ts` extends `tki.base.ts`).

---

## Scoring, Hazards & Confidence

### Plan score

`scorePlan` returns raw score plus hazards, which influence both the final score and the rationale:

```ts
export type PlanScore = Readonly<{
  rawScore: number; // silhouette progress, stability, etc.
  hazards: ReadonlyArray<Hazard>;
  adjusted: number; // raw + bias - hazard penalties
}>;
```

`hazards` are produced by lightweight structure checks (e.g., **overhang‑without‑T**, **split‑needs‑I**, **early‑burn‑risk**). A small number (top 1–2 by severity) are shown in the UI.

### Confidence from margins + fragility

```ts
// Margin between best & second-best adjusted scores
function confidenceFromScores(best: number, second: number): number {
  const margin = best - second; // larger margin → more confident
  return 1 / (1 + Math.exp(-margin / 0.8)); // smooth sigmoid
}

// 0..1 where 1 = very fragile (depends on scarce resources / tight slots)
function planFragility(s: GameState, plan: Template): number {
  const criticals =
    (requiresI(plan) && !iSecured(s) ? 1 : 0) +
    (requiresT(plan) && !tSecured(s) ? 1 : 0) +
    (tightSlot(plan, s) ? 1 : 0);
  return Math.min(1, criticals / 3);
}

// Small bounded decay proportional to remaining uncertainty
function decayWithProgress(stepsCompleted: number, stepsTotal: number) {
  const remain = Math.max(0, stepsTotal - stepsCompleted);
  return Math.min(0.2, (remain / Math.max(1, stepsTotal)) * 0.2);
}
```

**Final confidence** = `sigmoidMargin * (1 - 0.5 * fragility) * (1 - decay)`.

### Plan hysteresis (avoid thrash)

Maintain in `PolicyContext`:

- `planAge` (increment while the chosen plan remains unchanged).
- `lastPlanId`, `lastBestScore`, `lastSecondScore`.

Switch only if both hold:

- **Challenger** ≥ **current** + `switchMargin` (e.g., 0.2).
- `planAge` ≥ `minAge` **or** current confidence is very low.

Also clamp plan swapping **mid‑bag** unless confidence collapses, to avoid churning when previews fluctuate slightly.

---

## Executor & Placement Clustering

The executor chooses a placement for the current piece from the best template’s step candidates. It also prepares **grouped hints** for UI:

1. Compute all candidate `Placement` items from the chosen `Template.nextStep`.
2. Compute **utility** for each and a **finesse cost** (via `finesse/calculator`), then **Pareto‑filter** to discard dominated options.
3. Group the remainder by `rot`, and within each rotation coalesce contiguous `x` values into a **span**.
4. In each group select a **primary** (highest utility), the others are `alts`. Provide a mid‑point label (“x=3–4, R=right”).

```ts
export type PlacementGroup = {
  rot: Rot;
  xs: ReadonlyArray<GridCoord>;
  primary: Placement;
  alts: ReadonlyArray<Placement>;
};

// sketch only
function clusterPlacements(
  ps: ReadonlyArray<Placement>,
  utility: (p: Placement) => number,
  finesseCost: (p: Placement) => number
): ReadonlyArray<PlacementGroup> {
  /* ... */
}
```

The `Suggestion.guidance` can mirror the `primary` as a UI target (`ModeGuidance.target`).

---

## Scenario Generation & SRS

**Scenario cards** define practice situations and feed an SRS loop.

```ts
export type ScenarioCard = Readonly<{
  id: string; // "PCO/std:easyA", "TKI/flat:mid2"
  opener: Intent;
  seed: Seed; // branded string (from brands.ts)
  startTicks?: number; // optional quick spawn offset
  notes?: ReadonlyArray<string>;
  // Optional constraints (light noise for generalization)
  maxGarbage?: number;
  minPreview?: number; // at least N preview pieces available
}>;
```

**SRS grading** (per attempt) can classify: `"Again" | "Hard" | "Good" | "Easy"` based on correctness, achieved outcome (e.g., PC or TSD), time, and hints used. Cards are scheduled using an **interval** in `DurationMs` and `Timestamp` from `types/timestamp.ts`.

---

## Game Modes

Two useful modes to start:

- **Guided Opener Trainer:** runs scenarios, shows **grouped hints**, displays rationale and hazards, collects timing and finesse stats.
- **Freeplay with Coaching:** policy runs continuously; minimal overlays with a small **HUD** label (rationale and confidence bar).

Both reuse the same **planner/executor** and the same **template** library.

---

## UI/UX & Explainability

- **HUD Rationale:** Short line from `Suggestion.rationale` (≤ ~90 chars): e.g., “Choosing **TKI** (I visible; hold T). ⚠ Center uneven—avoid burying slot.”
- **Targeting:** Use `Suggestion.guidance` (i.e., `ModeGuidance.target`) to show where to aim this piece, optionally path/ghost.
- **Grouped Hints:** Optional overlay reads `Suggestion.groups` to display spans and a primary target.
- **Hazards:** Show top 1–2 hazards w/ icons/severity; keep concise.

---

## Algorithms (Pseudocode)

### Planner skeleton

```ts
function recommendMove(
  state: GameState,
  ctx: PolicyContext = {
    lastPlanId: null,
    lastBestScore: null,
    lastSecondScore: null,
    planAge: 0,
    lastUpdate: null,
  }
): PolicyOutput {
  const candidates = planCandidates(state); // enumerate Template variants
  let best: { t: Template; score: PlanScore } | null = null;
  let second = -Infinity;

  for (const t of candidates) {
    const sc = scorePlan(t, state); // returns { rawScore, hazards, adjusted }
    if (!best || sc.adjusted > best.score.adjusted) {
      second = best?.score.adjusted ?? second;
      best = { t, score: sc };
    } else {
      second = Math.max(second, sc.adjusted);
    }
  }

  // Hysteresis: optionally stick with prior plan if margin is small
  const chosen = chooseWithHysteresis(best, second, ctx);

  const placement = nextActionForPlan(chosen, state); // executor
  const groups = clusterForUi(chosen, state); // optional grouped hints

  const fragility = planFragility(state, chosen);
  const conf =
    confidenceFromScores(best!.score.adjusted, second) *
    (1 - 0.5 * fragility) *
    (1 - decayWithProgress(stepsCompleted(chosen, state), stepsTotal(chosen)));

  const rationale = formatRationale(chosen, best!.score.hazards);

  return {
    suggestion: {
      intent: chosen.opener,
      placement,
      planId: chosen.id,
      rationale,
      confidence: conf,
      hazards: summarizeHazards(best!.score.hazards),
      groups,
      guidance: toModeGuidance(placement),
    },
    nextCtx: updateCtx(ctx, chosen.id, best!.score.adjusted, second),
  };
}
```

### Candidate enumeration

`planCandidates(state)` returns `Template[]` constructed from base templates plus **patches** (mixins) for specific variants (e.g., **TKI flat‑top**).

### Scoring (fast + tiny rollout)

`scorePlan` should be fast. Combine:

- **Silhouette / pattern progress** toward the template’s next silhouettes.
- **Stability** (avoid early overhangs without **T** support, avoid irreversible splits without **I** soon).
- **Bias** from preconditions (small `scoreDelta` bonuses).
- **Light rollout** (1–2 ply) only when needed to break ties or validate feasibility of tight steps.

### Executor

- Generate step placements from the chosen `Template.nextStep`.
- Pareto‑filter by `{utility, finesseCost}`.
- Choose `primary` for the suggestion; group the rest for UI.

### Core heuristics

- `tkiFeasibleQuick(s)`: T in preview, **I** availability soon, reasonable center.
- `pcoFeasibleQuick(s)`: flat field; **I** available via hold or early preview.
- `tightSlot(plan, s)`: indicates fragility if near walls or narrow wells.

### PCO minimal feasibility (1–2 ply)

Quick tests **only**; deeper checks stay in rollout. Prefer simple guards like “**I** in hold/preview” and “field flat enough”.

### Template example (PCO Standard; sketch)

```ts
export const PCO_STANDARD: Template = {
  id: "PCO/std",
  opener: "PCO",
  preconditions: (s) => ({
    feasible: pcoFeasibleQuick(s),
    notes: ["flat field", "I available via hold soon"],
    scoreDelta: +0.2,
  }),
  nextStep: (s) => [
    {
      when: (s) => s.active === "L" || s.active === "J" || s.active === "O",
      propose: (s) => placementsForLJOBlock(s),
      utility: (p, s) => silhouetteProgress("PCO/std", s, p),
    },
    {
      when: (s) => s.active === "T" || s.active === "S" || s.active === "Z",
      propose: (s) => placementsForTSZBlock(s),
      utility: (p, s) => silhouetteProgress("PCO/std", s, p),
    },
    {
      when: (s) => s.active === "I",
      propose: (s) => placementsForIBar(s, /* useHoldIfNeeded */ true),
      utility: (p, s) => silhouetteProgress("PCO/std", s, p),
    },
  ],
  gracefulExit: () => "Neither",
};
```

### Scenario grading (SRS)

```ts
type SRSTier = "Again" | "Hard" | "Good" | "Easy";

function gradeScenario(outcome: {
  achieved: "PC" | "TSD" | "None";
  timeMs: number;
  hintsUsed: number;
  correctIntent: boolean;
}): SRSTier {
  if (!outcome.correctIntent) return "Again";
  if (outcome.achieved === "PC" || outcome.achieved === "TSD") {
    if (outcome.hintsUsed === 0 && outcome.timeMs < FAST_MS) return "Easy";
    return "Good";
  }
  return "Hard";
}
```

---

## Performance

- Keep planner/executor **pure** and **branch‑light**; avoid heavy rollouts.
- Cache light computations by `Template.id` when preview unchanged.
- Batched UI overlays: compute groups once per call.

---

## Testing

- **Property tests** for hazards (e.g., injecting synthetic overhangs).
- **Determinism**: fixed `Seed` ⇒ stable candidate sets & scores.
- **Regression**: golden files for `recommendMove` inputs/outputs (including `PolicyContext` evolution).
- **Human sanity checks**: canned boards where the correct plan is obvious.

---

## Telemetry

- Log `planId`, `confidence`, `hazards` (ids + severity), and outcome (achieved / time / hints) per scenario.
- Track **thrash rate** (how often plans switch without a big margin).
- Track **hint uptake** and **finesse cost** distributions of chosen placements.

---

## Phased Implementation Plan

**Phase 1 — Policy skeleton & two templates (1–2 weeks)**

- Implement `recommendMove(state, ctx)` with hysteresis and margin‑based confidence.
- Implement `extendTemplate`, a base **TKI** and **PCO** template, plus one patch variant each.
- Minimal hazards (`overhang-without-T`, `split-needs-I`), and a simple rationale formatter.
- Executor picks a single placement (no grouping yet).

**Phase 2 — Scenarios & SRS, Coaching UI (1–2 weeks)**

- Scenario cards + SRS grading; integrate `Timestamp` and `DurationMs`.
- Coaching overlays using `ModeGuidance` target and short rationale.
- Add 1–2 more variants via **patches**.

**Phase 3 — Branching & Fallbacks (1–2 weeks)**

- Template `branch` and `gracefulExit`; add minimal rollout (1–2 ply) in tie‑breaks.
- Introduce hazard severities and improve silhouette scoring.

**Phase 4 — Polish & Scale (ongoing)**

- Placement clustering + Pareto filter; expose `groups` for UI hints.
- Expand hazard library and scenario coverage; tune hysteresis constants.
- Optimize hot paths; add caches keyed by preview signature.

---

## Risks & Mitigations

- **Template proliferation:** enforce patches-first rule; review new ids.
- **Over‑fitting:** emphasize hazards and light noise in scenarios; avoid path‑only scoring.
- **UI overload:** keep rationale < 90 chars; show only top hazards; opt‑in grouped hints.
- **Thrash:** use hysteresis (`planAge`, `switchMargin`) and margin‑based confidence.

---

## Appendix A — Type alignment notes

- Use `GridCoord` (not `GridX`/`GridY`) for board positions.
- Use repo `Rot` string union (`"spawn" | "right" | "two" | "left"`).
- Use `Seed` **string brand** from `brands.ts`.
- Use `DurationMs` and `Timestamp` from their respective modules.
- Reuse `ModeGuidance` for UI targeting/overlays.
- Do **not** redefine `GameState` or `Board` here; import existing types.

---

## Project layout (suggested)

```
src/
  policy/
    index.ts                 // recommendMove(state, ctx): PolicyOutput
    types.ts                 // Intent, Placement, Hazard, PlacementGroup, PolicyContext
    planner.ts               // candidates, scorePlan, hysteresis
    executor.ts              // placement selection, Pareto filter, grouping
    heuristics/
      hazards.ts             // detect anti-patterns
      silhouettes.ts         // silhouette progress utils
    templates/
      tki.base.ts
      tki.flatTop.ts         // extendTemplate(tki.base, ...)
      pco.standard.ts
      pco.alt.edgeX.ts
      neither.safe.ts
  scenarios/
    cards.ts                 // scenario card types & registry
    generators.ts            // deterministic sequence generators
    srs.ts                   // spaced repetition scheduling
  ui/
    coachOverlay.tsx         // reads Suggestion.guidance and .groups
```
