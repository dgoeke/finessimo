# Finessimo — 2‑Step Finesse Trainer 🎮

This is Finessimo — a small game that helps you master “2‑step finesse”: placing any tetromino with the minimum inputs. The goal is durable muscle memory first; speed follows naturally. For new players learning block stacking games, getting used to finesse movements early can be useful to avoid having to re-learn muscle memory later.

If you want the deep dive, see `DESIGN.md` (architecture) and `FILES.md` (map).

## Getting Started 🚀

- Prereqs: Node.js 18+, npm
- Install: `npm install`
- Dev server (HMR): `npm run dev` → opens `http://localhost:3000`

## Quality Gates ✅

- `npm run typecheck` — TypeScript only (no emit)
- `npm run lint` — Lint (fixes enabled by default in local dev)
- `npm run test` — Jest unit tests
- One‑shot all checks: `npm run check` (clean → typecheck → lint → test:coverage → format)

Other handy scripts 🛠️

- `npm run build` — Production build (Vite)
- `npm run test:watch` / `npm run test:coverage`

## Developer Overview 🧩

The architecture is functional, deterministic, and types‑first.

### Architecture 🏗️

- Flow: UI → Input Handler → Reducer → State → UI
- Core: Pure reducer with immutable `GameState` (discriminated union). Branded primitives keep look‑alike types from mixing.
- Input: A Robot3‑powered DAS/ARR state machine drives movement; handlers dispatch pure `Action`s and append normalized `ProcessedAction` entries for finesse analysis.
- Pipeline: After a piece locks, a pure lock pipeline runs finesse analysis and asks the active mode whether to commit or retry.
- Determinism: Seeded 7‑bag via `PieceRandomGenerator`; modes can own RNG/preview.
- Reactivity: `@lit-labs/signals` exposes `gameStateSignal` + selectors for minimal UI work.

### Key Files & Folders 📁

- `src/app/app.ts` — App loop, wiring, lock pipeline, mode switching, settings bridge.
- `src/app/settings.ts` — Load/save settings to localStorage (merged nested store).
- `src/state/types.ts` — Brands, `GameState` union, `Action` union, `ProcessedAction`, stats.
- `src/state/reducer.ts` — Pure reducer; physics post‑step integration; pending‑lock seam; derived stats.
- `src/state/signals.ts` — Global signal + selectors + reducer‑backed dispatch.
- `src/input/keyboard/handler.ts` — Keyboard over DAS/ARR; logging rules.
- `src/input/touch/handler.ts` — Touch overlay/gestures over shared DAS.
- `src/input/machines/das.ts` — Robot3 DAS machine (idle → charging → repeating).
- `src/engine/finesse/*` — Board‑aware BFS calculator, pure service, processed‑log helpers.
- `src/modes/*` — Mode contracts/registry (FreePlay, Guided), RNG/preview/guidance hooks, lock decisions.
- `src/core/*` — Board ops, SRS rotation, RNGs (`core/rng/*`), spawning/top‑out.
- `src/ui/components/*` — Lit components (board, overlays, settings, panels).
- `src/ui/renderers/*` — Pure canvas renderers (cells/overlays/grid/tween/viewport).
- `src/types/*` — Branded primitives (`DurationMs`, `GridCoord`, `Seed`, …) and `Timestamp` utilities.

### Working Agreements 🤝

- Purity: Side‑effects only at the edges (input, DOM/time, storage, audio). Core stays pure.
- Types‑first: Encode invariants with brands and discriminated unions. Use `assertNever` for exhaustiveness.
- Immutability: Never mutate in reducers; always return new objects/arrays.
- No suppressions: Don’t add `@ts-ignore` or ESLint disables — fix the types instead.
- Run the gates: `npm run check` before committing.

## License 📜

Apache-2.0
