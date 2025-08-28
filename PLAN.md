# Finessimo Type System Refactor — Plan

This plan sequences the refactor to maximize type safety while keeping the app green at the end of each phase. As requested, we start with type hardening (formerly “Phase 2”), then suppression cleanup, then simplification/pruning. The reducer/core remain pure; side-effects stay in the Input Handler.

## Goals

- Make invalid state unrepresentable using branded types and discriminated unions.
- Eliminate TypeScript/ESLint suppressions by fixing root causes (src and tests).
- Remove dead code/types and redundant runtime checks made unnecessary by types.
- Keep `npm run pre-commit` green at the end of every phase.

## Principles

- Functional core: immutable state, pure reducers, unidirectional flow.
- Branded primitives at the edges; no casting in core logic.
- Exhaustive unions with compile-time enforcement (`never` checks).
- Readonly-by-default for arrays and tuples in state and actions.
- 10×20 board is a permanent invariant and enforced at the type level.
- Timestamp branding is ubiquitous; plain `number` is not used for time.

## Phase 1 — Type System Hardening (BRANDS + UNIONS)

Objective: Introduce branded types and discriminated unions, standardize timestamps, and encode invariants. Keep behavior identical.

- Branded primitives (new or reinforced)
  - `Timestamp`: existing brand; use everywhere for time instants (e.g., `tick`-relative or `performance.now()` values). No `number` for timestamps.
  - `DurationMs`: brand for time deltas; prevents mixing instants and durations.
  - `GridCoord`: brand integer grid coordinates for `ActivePiece.x/y`, movement, and collision.
  - `CellValue`: brand `0 | 1..7 | 8` per current runtime behavior; confirm garbage value via code paths and align docs (“0 empty; 1..7 tetromino; 8 garbage”).
  - `Frame`: brand for frame counters if used; otherwise prefer `Timestamp` everywhere.
  - `Seed`: brand for RNG seed to avoid accidental string/number mixups.

- Board invariants
  - `Board.width: 10` and `Board.height: 20` as literal types.
  - `Board.cells: Uint8Array & { readonly length: 200 }` (compile-time brand to enforce size at creation time).
  - `idx(x, y, width)`: ensure callers pass the actual board width; never default to 10 implicitly inside helpers used by logic.

- Discriminated unions for state invariants
  - Replace `status: "playing" | "lineClear" | "topOut"` with explicit union members:
    - `PlayingState` — `status: "playing"`, `pendingLock: null`.
    - `ResolvingLockState` — `status: "resolvingLock"`, `pendingLock: PendingLock`.
    - `LineClearState` — `status: "lineClear"`, `lineClearStartTime: Timestamp`, `lineClearLines: readonly number[]`.
    - `TopOutState` — `status: "topOut"`, terminal fields.
  - `GameState` becomes a union of the above intersected with shared, immutable fields.
  - Reducers and selectors switch on `status` and use exhaustiveness guards.

- Processed input log
  - Ownership and placement
    - Keep immutable log data in `GameState` as `processedInputLog: readonly ProcessedAction[]` (per-piece; cleared on lock). Reducer remains pure and does not derive entries from movement handlers; it only appends when explicitly told and clears via `ClearInputLog`.
    - Centralize classification helpers under `src/finesse/log.ts` (pure). Do not move log state into the Finesse Service; the service stays stateless and pure (consumes the log, returns actions).
  - Input engine emits, reducer persists
    - The input engine (keyboard/touch + DAS) classifies low-level events into domain-level `ProcessedAction`s using `finesse/log.ts` rules and emits them alongside engine `Action`s.
    - Introduce a new reducer action: `AppendProcessed` carrying a single `ProcessedAction`. The app forwards emitted processed events by dispatching `AppendProcessed`; the reducer appends immutably to `processedInputLog`.
    - The app does not reclassify or generate timestamps; it only orchestrates dispatch.
  - Logging rules (aligned with finesse spec)
    - Only emit when there is an active piece and `status === "playing"`.
    - `TapMove`: emit only when `optimistic === false` (ignore optimistic taps that precede a hold/DAS).
    - `HoldMove`: emit once at hold start; do not emit for repeats.
    - `RepeatMove`: never emit (ARR repeats are not finesse inputs).
    - `Rotate`, `HardDrop`: always emit; stamp timestamps if absent (`performance.now()` via branded `Timestamp`).
    - `SoftDrop`: emit transitions only (first `on`, then `off`); deduplicate periodic `on` pulses while held.
  - Clearing and analysis
    - On lock resolution, the pipeline calls the Finesse Service which consumes `state.processedInputLog` and emits `UpdateFinesseFeedback` and `RecordPieceLock`, followed by `ClearInputLog` (handled by the reducer). This keeps the reducer pure and the service stateless.
  - Types remain as-is in Phase 1
    - Keep `ProcessedAction` in `src/state/types.ts` and `processedInputLog` on the raw `GameState` (no `state.finesse` nesting yet). Add `AppendProcessed` to the `Action` union. Optionally revisit namespacing in a later phase without behavior change.

- Readonly discipline
  - Use `readonly`/`as const` and `readonly T[]` for:
    - `nextQueue`, `completedLines`, `lineClearLines`, `optimalSequences`, `guidance` shapes.
  - Prefer returning new arrays/slices vs. mutation in reducers.

- Timing config consistency
  - `TimingConfig.tickHz: number` (default 60), while all time values carried as `DurationMs` or `Timestamp` appropriately.

- Exhaustiveness enforcement
  - Add `default: assertNever(x)` to relevant switches to enforce compile-time coverage for discriminated unions.

Acceptance Criteria
  - App compiles; behavior unchanged.
  - All time fields are `Timestamp` or `DurationMs` (no plain `number`).
  - State unions compile with exhaustive switches (no `any` or casts).
  - Board/idx helpers encode 10×20 and use explicit width.
  - Pre-commit passes.

## Phase 2 — Suppression Cleanup (updated)

Objective: Ensure the codebase is free of inline suppressions and tighten consistency after the Phase 1 finesse/logging and ARR updates.

- Inline suppressions
  - Verify there are no `eslint-disable*`, `@ts-ignore`, or `@ts-expect-error` comments in `src/` and `tests/` (excluding required `.d.ts` augmentations). Replace with proper typing or refactors where necessary.

- Input/Logging consistency checks
  - Confirm `AppendProcessed` is the only reducer entrypoint for appending finesse logs; no movement handler appends implicitly.
  - Ensure `src/finesse/log.ts` is used consistently by handlers (creation helpers and policy), and that there is no duplicate SoftDrop dedupe elsewhere.
  - Remove or quarantine any unused helpers introduced during Phase 1 (e.g., legacy variants of logging helpers) if they aren’t referenced.

- ARR behavior guardrails
  - Ensure the handler-side ARR catch-up is bounded by board width (already implemented) and covered by tests; verify no performance regressions.

- Declarations
  - Remove any obsolete declaration files or Jest mappers surfaced by stricter types (e.g., legacy input libs) if still present.

- ESLint configuration
  - If specific files need exceptions, prefer targeted overrides in `eslint.config.js` rather than inline comments (keep to an absolute minimum).

Acceptance Criteria
  - Zero inline TS/ESLint suppressions in src and tests (excluding required `.d.ts`).
  - No dead declarations or stale test mappers remain.
  - Consistent finesse log append via `AppendProcessed` only; ARR catch-up bounded and tested.
  - Pre-commit passes.

## Phase 3 — Simplification & Prune (updated after Phase 2)

Objective: Finish pruning and streamlining now that types are strict and Phase 2 removed suppressions and legacy paths. Focus on small, high‑leverage refinements identified during Phase 2 review.

- Remove leftovers and stale references
  - TinyKeys: remove any lingering comments or references in tests (now fully replaced by `KeyBindingManager`).
  - Docs: ensure references in docs reflect `KeyBindingManager` and the state‑machine input handler (no TinyKeys mention).

- Finalize finesse logging surface
  - We have already removed `appendProcessedLog` and centralized policy to `shouldProcess*` + `createProcessed*` helpers. Keep this minimal API and delete any stragglers if discovered.
  - Consider a tiny, internal helper (local to input handlers) to factor `dispatchWithOptionalProcessed` if duplication remains between keyboard and touch. Do not over‑abstract; only extract if it reduces risk without obscuring flow.

- Timestamp and status refinements
  - Deterministic timestamp sourcing: remove implicit `performance.now()` from core/log helpers. Handlers provide a single branded `Timestamp` per update and pass it through.
  - Make stats start times required: set `startedAtMs` and `sessionStartMs` deterministically at `Init` (preferred) or on first `Tick`. Remove magic sentinels (e.g., `createTimestamp(0.1)`).
  - Keep nullability only for truly inactive timers (e.g., `lockDelayStartTime: Timestamp | null`, `lineClearStartTime: Timestamp | null`).
  - Narrow `shouldProcessInCurrentState` to accept a discriminated status type (e.g., `GameState["status"]`) instead of `string`, to encode invariants at compile time.

- Consolidate timing types
  - Verify all helpers take `Timestamp`/`DurationMs` (they largely do); remove any accidental `number` fallbacks discovered during review.

- Processed input constructors
  - Require an explicit `Timestamp` parameter in `createProcessed*` helpers and always pass it from input handlers. This improves determinism and testability.

- Collapse defensive code now enforced by types
  - Revisit conditionals made redundant by unions (e.g., `pendingLock` access only on `resolvingLock`). Simplify where safe.

- ESLint and tests hardening (optional)
  - Consider prohibiting `// @ts-ignore` entirely in ESLint (remove the allowance with description) now that suppressions are gone.
  - Add light type‑level tests (compile‑only) for key invariants: `GameState["status"]` union, board `width/height`, `BoardCells` length.

- Docs and maps
  - Update `FILES.md` to reflect any removed helpers and confirm the finalized finesse logging ownership and input stack.

Acceptance Criteria
  - No stale TinyKeys references in code or tests; docs reflect current input stack.
  - No magic timestamp sentinels in stats; `startedAtMs`/`sessionStartMs` are required and set at `Init` or first `Tick`. Only inactive timers use `Timestamp | null`.
  - `shouldProcessInCurrentState` accepts a narrowed status type (not `string`).
  - `createProcessed*` require explicit `Timestamp`; no direct `performance.now()` usage in core/log helpers.
  - Input handler code is lean; optional DRY for `dispatchWithOptionalProcessed` only if it doesn’t hide control flow.
  - Reducer/helpers uniformly use branded time types; no ad‑hoc `number` fallbacks.
  - No unused types/functions; pre‑commit passes.

## Type Catalog (Draft)

- `Timestamp`: `number & { __brand: 'Timestamp' }` — instant in ms.
- `DurationMs`: `number & { __brand: 'DurationMs' }` — elapsed time in ms.
- `GridCoord`: `number & { __brand: 'GridCoord' }` — integer board coordinate.
- `CellValue`: `0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 & { __brand: 'CellValue' }` — encoded cell; `8` indicates garbage per current generator.
- `Frame`: `number & { __brand: 'Frame' }` — optional, only if needed.
- `Seed`: `string & { __brand: 'Seed' }` — RNG seed.

Helpers (centralized under `src/types/`)
- Constructors/guards for each brand to avoid ad-hoc casts.
- Conversion helpers (e.g., `asNumber(ts: Timestamp): number`) for interop at IO edges only.

## State Model (Draft)

- Shared fields (all states):
  - `board: Board`, `active?: ActivePiece`, `hold?: PieceId`, `canHold: boolean`, `nextQueue: readonly PieceId[]`, `rng: unknown`, `timing: TimingConfig`, `gameplay: GameplayConfig`, `tick: number`, `stats: Stats`, `processedInputLog: readonly ProcessedAction[]`, `currentMode: string`, `modeData?: unknown`, `guidance?: ModeGuidance | null`.
- `PlayingState`:
  - `status: 'playing'`; `pendingLock: null`.
- `ResolvingLockState`:
  - `status: 'resolvingLock'`; `pendingLock: PendingLock`.
- `LineClearState`:
  - `status: 'lineClear'`; `lineClearStartTime: Timestamp`; `lineClearLines: readonly number[]`.
- `TopOutState`:
  - `status: 'topOut'`.
- `GameState = (PlayingState | ResolvingLockState | LineClearState | TopOutState) & Shared`.

## Processed Input Log (Draft)

- `ProcessedAction` (normalized, intent-level actions):
  - `{ kind: 'TapMove' | 'HoldMove' | 'RepeatMove'; dir: -1 | 1; t: Timestamp }`
  - `{ kind: 'Rotate'; dir: 'CW' | 'CCW'; t: Timestamp }`
  - `{ kind: 'SoftDrop'; on: boolean; t: Timestamp }`
  - `{ kind: 'HardDrop'; t: Timestamp }`
- Stored as `processedInputLog: readonly ProcessedAction[]` and cleared after lock.

## Readonly & Immutability

- Arrays in state/actions are `readonly`.
- Reducers return new objects/arrays; no in-place mutation.
- Tuple-like data are declared with `as const` where appropriate.

## Type-Level Tests (Modern, No Suppressions)

- Strategy: compile-time assertion types; no `@ts-expect-error` comments.
- Utilities:
  - `type Equals<A,B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;`
  - `type Expect<T extends true> = T;`
- Pattern:
  - Create files under `tests/types/` that export only types/aliases. Example:
    - `type _1 = Expect<Equals<Timestamp, number>>; // branding still structurally number`
    - `type _2 = Expect<Equals<GameState['status'], 'playing' | 'resolvingLock' | 'lineClear' | 'topOut'>>;`
  - Add at least one value-level export to keep Jest collecting (or configure coverage to ignore `tests/types`).
- Outcome: Fails compilation on regression without runtime suppression comments.

## File Targets (High-Level)

- `src/state/types.ts`: introduce unions, readonly fields, branded types usage.
- `src/state/reducer.ts`: exhaustive switches; adapt to unions.
- `src/core/board.ts`: `Board` literal dimensions; `CellValue`; `idx/blocked` consistency; 10×20 constraints.
- `src/core/spawning.ts`, `src/core/pieces.ts`, `src/core/rng.ts`: adopt brands and readonly arrays.
- `src/input/*`: split `ProcessedAction` vs engine `Action`; timestamp usage; no casts.
- `src/finesse/*`: consume `ProcessedAction`; timestamp consistency.
- `src/types/timestamp.ts`: ensure helpers cover ubiquitous usage (no behavior change unless clarified).

## Risks & Mitigations

- Risk: Widespread type changes create cascading compiler errors.
  - Mitigation: Introduce union & brand types behind existing names, migrate module-by-module, keep PRs/commits small.
- Risk: Tests rely on deprecated APIs or type suppressions.
  - Mitigation: Replace with typed helpers and compile-time assertions.
- Risk: Runtime assumptions about board size/cell values diverge from types.
  - Mitigation: Align code and docs first; add guards in constructors where inputs originate.

## Deliverables per Phase

- Phase 1: Brands, unions, readonly adoption; no behavior change; green pre-commit.
- Phase 2: All suppressions removed or moved to precise file overrides (ideally zero); dead decls removed; green.
- Phase 3: Guard/code pruning; smaller reducers; dead code removed; green.
- Documentation: Update `FILES.md` as code moves; add a short “Types Overview” to DESIGN.md summarizing brands and unions.

## Notes & Decisions

- Garbage encoding: keep current runtime behavior; set `8` as garbage if generation uses it; update comments/docs accordingly.
- Board size: fixed 10×20 enforced via types.
- Timestamps: keep existing brand; require ubiquitous use; add `DurationMs` for deltas.
