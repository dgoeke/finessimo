## CHAPTER 4 — Placement clustering (Pareto) + caching + polish

### 1) Scope

- Implement **placement clustering** for UI hints:
  - **Pareto filter** on `(utility↑, finesseCost↓)`.
  - Group by `rot`, then contiguous `x` spans; choose a `primary` with `alts`.

- Add **memoization caches** keyed by preview signature & board features.
- Optional bitboard executor path for `applyPlacement`, behind a flag.
- Tune hysteresis constants via telemetry if available (non-blocking).

### 2) Files (≤3 product files)

```
src/policy/executor.ts      // new: clusterPlacements + paretoFilter + finesseCost adapter
src/policy/cache.ts         // new: per-spawn memoization helpers
src/policy/index.ts         // modify: include groups in Suggestion (no API change)
```

**Tests & bench**

```
tests/policy/clustering.test.ts
microbench/policy_cluster.bench.ts
```

### 3) Key functions (from A)

```ts
// src/policy/executor.ts
import type { Placement, PlacementGroup } from "./types";

export function paretoFilter(
  ps: ReadonlyArray<Placement>,
  utility: (p: Placement) => number,
  finesseCost: (p: Placement) => number
): ReadonlyArray<Placement>;

export function clusterPlacements(
  ps: ReadonlyArray<Placement>,
  utility: (p: Placement) => number,
  finesseCost: (p: Placement) => number,
  gridCoordAsNumber: (x: any) => number
): ReadonlyArray<PlacementGroup>;
```

- **Grouping algorithm**: after Pareto filtering, group by `rot`, then compress contiguous `x` values into spans; pick `primary` by highest `utility` within each span; leftover become `alts`.

**Perf budget:**

- Clustering (including Pareto + grouping): **≤ 0.1 ms** mean.

**Caching:**

- Memoize: column heights, slot masks, preconditions; cache by a **preview signature** string (e.g., first N queue ids + hold id).

**Optional bitboards:**

- Provide an executor‑local bitboard path for `applyPlacement` (off by default). Guard with `ENABLE_BITBOARDS`.

### 4) Tests

- **Pareto correctness**: no dominated placements survive; verify via handcrafted utility/cost pairs.
- **Grouping determinism**: for fixed inputs, groups stable; `primary` is the max utility of span.
- **UI contract**: `Suggestion.groups` populated with sensible sizes (1–4 groups typical).
- **Perf**: `microbench/policy_cluster.bench.ts` asserts mean ≤ **0.1 ms**.

### 5) Acceptance criteria

- All previous tests pass.
- New clustering tests pass; perf bench within 0.1 ms mean.

### 6) Risks & mitigations

- Over‑grouping → limit span size; cap groups shown (e.g., ≤4).
- Cost model drift → source finesse cost from existing `finesse/calculator`.
