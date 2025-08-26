# Functional Migration Phases

This document breaks down the migration described in `plans/functional/FUNC-DESIGN.md` into coherent, self‑contained phases. Each phase ends with a working app and a green quality gate:

- `npm run pre-commit` passes (typecheck, lint, tests, format)
- No TypeScript/ESLint suppressions are introduced
- Reducers/core remain pure; side effects stay only at the edges per DESIGN.md

Notes

- Source of truth: `DESIGN.md`, `FILES.md`, `plans/functional/FUNC-DESIGN.md`
- Gold standards to emulate: `src/input/machines/das.ts`, `src/state/reducer.ts`
- We do not preserve external backward compatibility between phases; we keep tests/lint passing at each step.
- Option/Result are edge patterns only. In core/state, prefer strong types and preconditions so invalid states are unrepresentable without wrapping everything in Option/Result.

Conventions used below

- “Enable functional lint (dir)” means we wire the new functional flat‑config to that directory only. We gate stricter rules by directory as we migrate to avoid lint regressions.
- “Update tests” means we adapt tests to the corrected functional types/behavior; we do not reintroduce unsafe patterns.

---

## Phase 1 — Foundations: FP Primitives + Lint Guardrails (scaffold only)

Goal

- Introduce functional primitives (Option/Result/NonEmptyArray/Branded) and a dedicated functional ESLint flat config without changing existing module behavior yet. We will keep Option/Result usage to the edges (DOM, storage, startup), not the core algorithms.

Scope

- New: `src/types/util.ts`
- New: `.eslintrc-functional.js`
- No changes to core/state/input/ui yet; keep current behavior untouched.

Changes

- Add functional types and helpers (to be used sparingly at edges):
  - `Option<T> = { type: 'Some'; value: T } | { type: 'None' }`
  - `Result<T,E> = { type:'Ok'; value:T } | { type:'Err'; error:E }`
  - `NonEmptyArray<T>` branded; constructor `fromArray<T>(arr: ReadonlyArray<T>): Option<NonEmptyArray<T>>`
  - `Branded<T, Brand>` utility for domain types (e.g., `CellValue`, `DASMilliseconds`)
- Add `.eslintrc-functional.js` with strong rules, but do NOT import it from `eslint.config.js` yet. We will later enable it per-directory as we migrate.

Example (Option helpers)

```ts
// src/types/util.ts (excerpt)
export type None = { readonly type: 'None' };
export type Some<T> = { readonly type: 'Some'; readonly value: T };
export type Option<T> = Some<T> | None;

export const none = (): None => ({ type: 'None' });
export const some = <T>(value: T): Some<T> => ({ type: 'Some', value });
export const isSome = <T>(o: Option<T>): o is Some<T> => o.type === 'Some';
export const map = <T, U>(o: Option<T>, f: (t: T) => U): Option<U> =>
  isSome(o) ? some(f(o.value)) : none();
export const getOrElse = <T>(o: Option<T>, fallback: T): T =>
  isSome(o) ? o.value : fallback;
```

Exit criteria

- `npm run pre-commit` passes (no functional rules enabled yet). No runtime or type surface changes.

---

## Phase 2 — Movement/Rotation Preconditions (Core + Reducer composition)

Goal

- Remove nullable flows in reducer by composing on explicit preconditions (`canMove`, `canRotate`) and applying transformations that cannot fail under those preconditions. Keep APIs stable for now, but migrate reducer call-sites to the precondition pattern.

Scope

- Core APIs remain returning existing types for compatibility (e.g., `canMove: boolean`, `tryMove: ActivePiece | null` preserved initially)
- Modify: `src/state/reducer.ts` to follow the precondition pattern: guard with `canMove`/`canRotate` then construct the next `ActivePiece` directly (no null checks in core paths)
- Optionally add pure helpers in core: `applyMove(piece, dx, dy)` and `applyRotate(piece, targetRot)` that assume preconditions are already satisfied
- Enable functional lint (dir): `src/core/` (no mutation), `src/state/` (no nullable branching in core paths)

Changes

- Prefer reducer flow:

```ts
// Pseudocode: reducer move
if (canMove(board, active, dx, 0)) {
  const next = { ...active, x: active.x + dx };
  // next cannot be invalid by construction here
  return { ...state, active: next };
}
return state;
```

Tests to update

- Reducer tests that expected null checks on `tryMove`/`tryRotate` should be updated to expect preconditioned flows via `canMove`/`canRotate`
- Keep `board.test.ts` and `srs.test.ts` API coverage intact for now

Exit criteria

- Reducer’s main move/rotate paths no longer branch on `null`/undefined; they gate via `can*` and apply transformations that cannot fail
- `npm run pre-commit` passes

Detailed checklist (Reducer changes only)

Where: `src/state/reducer.ts`

- TapMove handler
  - Before: `const stepped = tryMove(board, active, action.dir, 0); if (!stepped) return state;`
  - After: `if (!canMove(board, active, action.dir, 0)) return state; const stepped = { ...active, x: active.x + action.dir };`
  - Keep: cancel lock delay if previously non-null; append to `processedInputLog`.

- RepeatMove handler
  - Apply the same transformation as TapMove (it’s identical in logic).

- HoldMove handler
  - Apply the same transformation as TapMove (identical single-step horizontal move).

- SoftDrop handler (action.on === true and softDrop !== 'infinite')
  - Before: `const softDroppedPiece = tryMove(board, active, 0, 1); active: softDroppedPiece ?? active; lockDelayStartTime: softDroppedPiece ? null : prev`
  - After: `if (canMove(board, active, 0, 1)) { const next = { ...active, y: active.y + 1 }; active: next; lockDelayStartTime: null; } else { active: active; lockDelayStartTime: prev; }`
  - Keep: set `isSoftDropping: true`; append to `processedInputLog`.

- Gravity path (pure helpers inside reducer): `processGravityDrop` and `applyGravityLogic`
  - In `processGravityDrop`: replace `tryMove(board, currentState.active, 0, 1)` with `canMove` + construct `{ ...piece, y: piece.y + 1 }`.
  - Keep: set `lastGravityTime` on successful move; otherwise set `lockDelayStartTime` if null and then check timeout via `checkLockDelayTimeout`.
  - In `applyGravityLogic`: no behavior change; keep structure, call the updated `processGravityDrop`.

- Rotate handler
  - Use a pre-check: `if (!canRotate(active, targetRot, board)) return state;`
  - Then call `tryRotate(active, targetRot, board)` to obtain the kicked piece (we need the final offset). Expect non-null here; still keep the fallback `if (!rotatedPiece) return state;` as a sanity guard in Phase 2.
  - Consideration: We will introduce a pure `applyRotate(...)` (assumes preconditions) in a later phase so reducer no longer needs the nullable return.

- HardDrop handler
  - No change. `dropToBottom` already returns a valid piece; keep as-is.

- Lock-delay cancellation
  - Ensure any successful movement (TapMove, RepeatMove, HoldMove, SoftDrop, Rotate) clears `lockDelayStartTime` to `null` using the current pattern.

Search/replace guide

- Pattern A (horizontal step):
  - From: `const stepped = tryMove(board, active, dx, 0); if (!stepped) return state;`
  - To: `if (!canMove(board, active, dx, 0)) return state; const stepped = { ...active, x: active.x + dx };`

- Pattern B (vertical step):
  - From: `const stepped = tryMove(board, active, 0, 1); active: stepped ?? active;`
  - To: `if (canMove(board, active, 0, 1)) { const stepped = { ...active, y: active.y + 1 }; active: stepped; }`

Tests to touch in this phase

- `tests/unit/reducer.test.ts` and `tests/unit/reducer-extended.test.ts` (movement assertions)
- `tests/unit/reducer-new-actions.test.ts` (TapMove/RepeatMove behavior)
- `tests/unit/finesse-auto-lock.test.ts` (lock-delay reset on movement)
- `tests/unit/physics.test.ts` (gravity path remains correct)
- `tests/unit/line-clear-*` (should remain unaffected by this phase)

---

## Phase 3 — Line Clear Strengthening (CellValue + NonEmpty at call sites only)

Goal

- Strengthen board cell typing (branded `CellValue`, `LineIndex`) while keeping Option usage out of core return types. Use `NonEmptyArray` only at call sites where emptiness is illegal (e.g., `clearLines`), not as the general return type of discovery functions.

Scope

- Modify: `src/core/board.ts`
  - `getPieceValue` → use branded `CellValue` (1..7)
  - `getCompletedLines(...): ReadonlyArray<LineIndex>` (pure array)
  - `clearLines(board, lines: NonEmptyArray<LineIndex>)` (requires NonEmpty only at the mutating operation)
- Modify: `src/state/reducer.ts` to convert: `const lines = getCompletedLines(b); if (lines.length) { /* refine to NonEmpty and clear */ }`
- Enable functional lint (dir): `src/core/` (wider set), `src/state/` (still moderate)

Changes

```ts
// board.ts stays simple for discovery
export function getCompletedLines(board: Board): ReadonlyArray<LineIndex> { /* ... */ }

// reducer.ts converts only where needed
const lines = getCompletedLines(lockedBoard);
if (lines.length > 0) {
  const nonEmpty = fromArray(lines).value; // One-time refinement at boundary
  // either immediate clear or animate
}
```

Tests to update

- `tests/unit/board.test.ts` (getCompletedLines, clearLines)
- Reducer line‑clear tests covering animation/immediate clear

Exit criteria

- Board API stabilized with branded `CellValue`; discovery functions return plain arrays
- NonEmpty used only where emptiness would be a bug
- `npm run pre-commit` passes

---

## Phase 4 — RNG Invariants (non-empty by construction; no Result in core)

Goal

- Guarantee non‑empty bags by construction (shuffle of fixed `ALL_PIECES`), maintain simple returns for hot paths, and keep throws only for intentionally corrupted test fixtures. Avoid `Result` in the core RNG API.

Scope

- Modify: `src/core/rng.ts`
  - Ensure `currentBag` is always a permutation of `ALL_PIECES` when used (i.e., length 7)
  - Strengthen internal types (e.g., branded `BagIndex`) to prevent out‑of‑range access
  - Keep return types unchanged for `getNextPiece/getNextPieces` on the happy path; preserve throwing only for corrupted RNG (tests)
- Reducer stays unchanged in signatures; no `Result` propagation
- Enable functional lint (dir): `src/core/` (full), `src/state/` (broader)

Changes

- Strengthen RNG internals to make invalid bags unrepresentable under normal construction; keep simple API on the outside

Tests to update

- `tests/unit/rng.test.ts` (focus on invariants and corrupted fixtures)
- Reducer init/preview queue/hold tests (no API changes expected)

Exit criteria

- No RNG throws in valid flows; corrupted fixtures still error as intended
- `npm run pre-commit` passes

---

## Phase 5 — Spawning Tightening (preconditions; no Option in core)

Goal

- Keep spawn/top‑out logic explicit via preconditions and pure constructors. Brand coordinates/piece IDs at boundaries. Avoid Option returns in core.

Scope

- Modify: `src/core/spawning.ts`
  - `canSpawnPiece` remains boolean
  - Add `applySpawn(pieceId): ActivePiece` with precondition: `canSpawnPiece(board, pieceId)` must be true before calling
  - Add `canSwapHoldAndSpawn(board, nextPiece, hold?)` boolean helper and `applyHoldSwap(...)` that assumes the precondition
- Modify: `src/state/reducer.ts` (hold/swap, top‑out paths) to use the precondition + apply pattern

Tests to update

- `tests/unit/spawning.test.ts`
- Reducer hold/top‑out tests

Exit criteria

- Spawning interfaces are preconditioned; reducer composes without nullable branches
- `npm run pre-commit` passes

---

## Phase 6 — Input Utils Functionalization (`src/input/handler.ts` only)

Goal

- Convert input utilities to pure functional style. Avoid introducing Option unless converting from external/unsafe inputs; keep arrays where natural. State‑machine handler unchanged for now.

Scope

- Modify: `src/input/handler.ts`
  - Keep `normalizeInputSequence` purely functional on arrays
  - Replace defensive checks with total functions and sorted inputs; reserve Option only if sanitizing untyped external events
- Enable functional lint (dir): `src/input/` (utilities subset)

Tests to update

- `tests/unit/input-normalization.test.ts`
- `tests/unit/input-handler.test.ts` (MockInputHandler expectations)

Exit criteria

- Input utilities are pure and functional without pervasive Option
- `npm run pre-commit` passes

---

## Phase 7 — Keyboard/Touch Handlers: Pure cores, effects at edges

Goal

- Refactor keyboard/touch handlers to keep DOM effects at the edges and move core logic to pure helpers. Maintain integration with DAS state machine.

Scope

- Modify: `src/input/keyboard.ts`, `src/input/touch.ts`
- Extract any internal mutation into pure helper functions (in‑file or small modules) returning next immutable state
- Keep TinyKeys/touch DOM wiring as effectful boundary
- Enable functional lint (dir): `src/input/` (broader)

Tests to update

- `tests/unit/keyboard.test.ts`
- `tests/unit/input-touch.test.ts`
- `tests/unit/state-machine-input-handler.test.ts` (only if public semantics shift)

Exit criteria

- Handlers are testably pure at the core; DOM wiring intact
- `npm run pre-commit` passes

---

## Phase 8 — Rendering Split: Pure calculations vs DOM

Goal

- Separate render calculations into a pure module and keep canvas class as the minimal effect layer.

Scope

- New: `src/ui/render-calculations.ts` (pure)
- Modify: `src/ui/canvas.ts` to consume the pure calculations and remove nullable fallbacks
- Enable functional lint (dir): `src/ui/` for pure module only; keep relaxed rules for DOM classes

Changes

- Extract functions:
  - `calculateBoardCells`, `calculatePieceCells`, `calculateGhostPiece`, `calculateGridLines`, `mapCellToColor`
- Replace `gameState.gameplay.ghostPieceEnabled ?? true` with a guaranteed boolean via type strengthening in state types (or guard at boundary)

Tests to update

- If UI has tests: update to use pure calc functions where applicable
- Visual logic remains equivalent; no DOM API changes

Exit criteria

- Clear separation of pure vs effectful UI
- `npm run pre-commit` passes

---

## Phase 9 — Finesse Engine Strengthening (internal NonEmpty; outward arrays)

Goal

- Use `NonEmptyArray` internally in BFS where appropriate, but keep outward API arrays to minimize Option/Result spread. Preserve correctness; remove defensive fallbacks.

Scope

- Modify: `src/finesse/calculator.ts` to strengthen internals (non-empty queue type, exhaustive action matching)
- Modify: `src/finesse/service.ts` to consume unchanged outward arrays while relying on internal guarantees
- Enable functional lint (dir): `src/finesse/`

Tests to update

- `tests/unit/finesse-calculator.test.ts`
- `tests/unit/finesse-service.test.ts`
- `tests/integration/finesse-golden-fixtures.test.ts`

Exit criteria

- Finesse internals use refined types; public contracts remain simple
- `npm run pre-commit` passes

---

## Phase 10 — UI Consumers of Finesse + HUD/Preview/Hold/Statistics/Settings

Goal

- Move remaining UI computations to pure helpers. Handle optional data via guards and total types; reserve Option only at DOM boundaries.

Scope

- Modify: `src/ui/finesse.ts`, `src/ui/finesse-feedback.ts`, `src/ui/preview.ts`, `src/ui/hold.ts`, `src/ui/statistics.ts`, `src/ui/settings.ts`, `src/ui/hud.ts`
- Ensure branded types for settings (e.g., `DASMilliseconds`, `ARRMilliseconds`)
- Keep DOM operations in classes; calculations in pure helpers (co‑locate in `render-calculations.ts` where shared)
- Enable functional lint (dir): `src/ui/` (pure helpers subset)

Tests to update

- Any UI/unit tests asserting data preparation/formatting

Exit criteria

- UI no longer relies on nullish fallbacks; calculations are pure
- `npm run pre-commit` passes

---

## Phase 11 — Modes: FreePlay/Guided and Registry

Goal

- Refactor mode logic to pure functions; keep registration immutable and type‑safe.

Scope

- Modify: `src/modes/freePlay.ts`, `src/modes/guided.ts`, `src/modes/index.ts`
- Use Option for optional guidance/targets
- Ensure exhaustive handling for mode kinds
- Enable functional lint (dir): `src/modes/`

Tests to update

- `tests/unit/game-modes*.test.ts`

Exit criteria

- Modes expose pure, typed contracts; reducer integration remains pure
- `npm run pre-commit` passes

---

## Phase 12 — App/Main Integration + Final Lint Enablement

Goal

- Wire the final functional interfaces into the app entry and turn on the functional ESLint config for all migrated directories. Use Option/Result at the true edges only (DOM queries, storage, initial parse), not inside core/state.

Scope

- Modify: `src/app.ts`, `src/main.ts`
- Integrate Option/Result flows only at the edges (init/config parse as `Result`, DOM lookups via Option), keep core paths free of wrappers
- Import `.eslintrc-functional.js` from `eslint.config.js` and enable strict profiles for:
  - `src/core/`, `src/state/`, `src/finesse/`, `src/input/` (strict)
  - `src/ui/`, `src/modes/` (moderate: allow DOM effects; still forbid unsafe null checks in pure helpers)

Exit criteria

- Functional lint fully enabled per directory, no warnings
- `npm run pre-commit` passes

---

## Rollout Checklist per Phase

- Typecheck: `npm run typecheck`
- Lint: `npm run lint` (keep warnings at 0 once a directory is enabled)
- Tests: `npm test` and update failing tests that depended on unsafe patterns
- Format: `npm run format`
- Gate: `npm run pre-commit`

## Risk Management and Mitigations

- Lint churn: Stage `.eslintrc-functional.js` enablement by directory only after migration of that directory.
- Test brittleness: When tests assume nullable/defensive patterns, update them to the correct Option/Result semantics rather than adding suppressions.
- UI regressions: Extract pure calculations first, swap renderer to use them with parity assertions in tests (where feasible).

## Mapping to FUNC-DESIGN.md

- Types/utilities: Phase 1
- Core board/srs (precondition pattern): Phase 2–3
- RNG (invariants; no Result): Phase 4
- Spawning (preconditions; no Option): Phase 5
- Input handler utils: Phase 6; keyboard/touch: Phase 7
- UI canvas split + consumers: Phase 8, 10
- Finesse calculator/service (internal refinement, outward arrays): Phase 9
- Modes: Phase 11
- App/Main + ESLint integration; Option/Result only at edges: Phase 12

## Out-of-Scope in this migration

- Behavior changes not mandated by `FUNC-DESIGN.md`
- Performance optimizations beyond structural functionalization

## Appendix — Edge-only Option/Result usage examples

```ts
// DOM boundary (main.ts): query and validate elements
const canvasEl = document.getElementById('board');
if (!(canvasEl instanceof HTMLCanvasElement)) {
  // Handle missing/invalid DOM safely at the edge
  throw new Error('Missing board canvas');
}

// Config parse boundary (app.ts)
const parsed = safeParseConfig(rawFromStorage); // returns Result<Config, ParseError>
if (parsed.type === 'Err') { /* show error UI */ }
```
