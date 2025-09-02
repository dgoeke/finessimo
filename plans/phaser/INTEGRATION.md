# Phaser Integration Plan — Full Migration from DOM/Lit to Phaser 3

Authoritative references: DESIGN.md, plans/PHASER.md, FILES.md

Goal: Replace the existing DOM/Lit presentation with a Phaser 3 presentation layer while keeping the pure core (reducers, types, mode logic) intact. Maintain green gates (typecheck, lint, tests, coverage) at each PR.

Principles

- Functional core: immutable state + pure reducers; side-effects at edges.
- No Phaser imports in pure modules (`src/state/*`, `src/core/*`, `src/modes/*`, `src/engine/*`).
- Presenter produces deterministic RenderPlan; Phaser applies it.
- Deterministic fixed-step loop in Gameplay scene; framerate-independent.

Feature Flag for Rollout

- Use a URL param gate to switch between legacy DOM UI and Phaser while migrating.
  - Example: `?ui=phaser` enables Phaser boot; default remains DOM until PR7.

Test/CI Guardrails

- Always run `npm run ci` locally before merging.
- Coverage cannot drop; replace removed UI tests with presenter/plan tests.
- Keep ESLint rule to restrict `phaser` import to `src/presentation/phaser/**` only.

---

## PR1 — Add Phaser deps and real Game.ts (behind feature flag)

Goal

- Install Phaser and rexUI; implement a real `createGame` factory and a feature-flagged bootstrap without altering runtime behavior by default.

Changes

- package.json: add `phaser`, `phaser3-rex-plugins` dependencies.
- `src/presentation/phaser/Game.ts`: replace placeholder with real Phaser config (AUTO, pixelArt, roundPixels, FIT).
- `src/presentation/phaser/scenes/index.ts`: export constructors and keys (already present) for registration.
- `src/main.ts`: add a small flag-check wrapper that defers to Phaser boot when `?ui=phaser` is present; otherwise run current DOM app.

Type/Function Signatures

```ts
// src/presentation/phaser/Game.ts
import Phaser from "phaser";
import { SCENES } from "./scenes";

export function createGame(
  parent: HTMLElement,
  width: number,
  height: number
): Phaser.Game;
```

Bootstrap (flagged)

```ts
// src/main.ts (wrapper)
function shouldUsePhaser(): boolean {
  return new URLSearchParams(location.search).get("ui") === "phaser";
}
if (shouldUsePhaser()) {
  const root = document.getElementById("app") ?? document.body;
  const game = createGame(root, innerWidth, innerHeight);
  game.scene.add("Boot", new Boot(), true);
} else {
  // existing FinessimoApp flow
}
```

Tests

- None required beyond typecheck for this PR; runtime remains default DOM.

Quality Gates

- `npm run ci` green.
- ESLint `no-restricted-imports` updated to allow `phaser` only under `src/presentation/phaser/**`.

---

## PR2 — Boot scene preload and asset wiring

Goal

- Implement `Boot` as a real `Phaser.Scene` that preloads assets and transitions to `MainMenu`.

Changes

- `src/presentation/phaser/scenes/Boot.ts`: convert to `extends Phaser.Scene` and implement `preload()` and `create()`.
- Add minimal assets under `public/` (atlas, bitmapfont, sfx) or use placeholder Graphics if assets not ready.

Type/Function Signatures

```ts
export class Boot extends Phaser.Scene {
  preload(): void; // load atlases, bitmapfonts, audio
  create(): void; // start MainMenu
}
```

Tests

- Smoke test: scene class loads and calls `this.scene.start(SCENE_KEYS.MainMenu)` in `create()`.

Quality Gates

- `npm run ci` green.
- Asset load guarded so tests don’t require actual files (skip in test env).

---

## PR3 — MainMenu & ModeSelect (rexUI) with typed navigation

Goal

- Replace placeholders with rexUI-based menus; wire transitions and mode selection using pure actions.

Changes

- `src/presentation/phaser/scenes/MainMenu.ts`: `extends Phaser.Scene`, build menu UI via rexUI; call `this.scene.start(...)` based on selection.
- `src/presentation/phaser/scenes/ModeSelect.ts`: list modes from `gameModeRegistry.list()`; on select, `dispatch({ type: "SetMode", mode })` then start `Gameplay`.
- Add small rexUI wrapper helpers under `src/presentation/phaser/presenter/UiAdapters.ts` if needed for consistency.

Type/Function Signatures

```ts
export class MainMenu extends Phaser.Scene {
  create(): void;
}
export class ModeSelect extends Phaser.Scene {
  create(): void;
  listModes(): ReadonlyArray<string>; // pure pass-through
  selectMode(name: string): void; // dispatch SetMode and start Gameplay
}
```

Tests

- Shallow tests similar to existing ones verifying transitions; no pixel snapshots.

Quality Gates

- `npm run ci` green.

---

## PR4 — Settings scene with rexUI controls → store actions

Goal

- Build settings UI mapped to pure action helpers; replace DOM settings modal.

Changes

- `src/presentation/phaser/scenes/Settings.ts`: convert to real Scene; build sliders/toggles for timing and gameplay; call existing helpers `updateTimingMs` / `updateGameplay`.
- Add persistence (optional) reading/writing to localStorage via pure key/value mapping at edges.

Type/Function Signatures

```ts
export class Settings extends Phaser.Scene {
  create(): void; // build UI, bind events
  updateTimingMs(
    partial: Partial<{
      /* existing narrow shape */
    }>
  ): void;
  updateGameplay(
    partial: Partial<{
      /* existing narrow shape */
    }>
  ): void;
}
```

Tests

- Keep reducer/settings tests; add smoke tests for Settings invoking helpers.

Quality Gates

- `npm run ci` green.

---

## PR5 — Gameplay Scene: real Phaser adapters and deterministic loop

Goal

- Replace placeholder Gameplay with a real Phaser.Scene that wires BoardPresenter, InputAdapter, CameraFX, and AudioBus, and runs the fixed-step loop.

Changes

- `src/presentation/phaser/scenes/Gameplay.ts`: convert to `extends Phaser.Scene` while preserving the fixed-step loop logic from current file.
- Create real adapters:
  - `src/presentation/phaser/input/PhaserInputAdapterImpl.ts`: read Phaser keys/gamepad and emit DAS machine events plus immediate actions for the fixed-step loop.
  - Use `BoardPresenter` as-is but inject real Blitter and Containers for active/ghost.
  - Implement adapters for FX and Audio via `Effects.ts` and `AudioBus.ts` interfaces.

Type/Function Signatures

```ts
export class Gameplay extends Phaser.Scene {
  create(): void; // set up blitter, containers, adapters
  update(time: number, delta: number): void; // fixed-step loop: drain input -> reduce -> Tick -> VM -> plan -> apply
}

// Input adapter implementation
export class PhaserInputAdapterImpl implements PhaserInputAdapter {
  constructor(scene: Phaser.Scene);
  drainActions(dt: Ms): ReadonlyArray<Action>;
}
```

Renderer Setup

- Blitter for locked cells; pooled sprites (4 each) in two Containers for active/ghost.
- Pre-render grid/frame to RenderTexture once in `create()`; reuse each frame.

Tests

- Keep existing presenter tests (`plan.generator`, `boardPresenter.apply`, `gameplay.loop`); add a smoke test for `PhaserInputAdapterImpl` logic with key state stubs if needed.

Quality Gates

- `npm run ci` green. No Phaser imported in pure modules.

---

## PR6 — Audio + Camera FX Wiring (with Thin-Orchestrator Gameplay)

Goal

- Wire presenter-driven audio and camera effects to Phaser in a type-safe way, using the thin-orchestrator Gameplay scene and shared `SceneCtx` from PR5.
- Route `RenderPlan.SoundCue` and `RenderPlan.CameraFx` emitted by `BoardPresenter.computePlan()`/`apply()` to `Phaser.Sound` and `Phaser.Cameras.Scene2D.Camera` with safe unbranding and no changes to pure core logic.

Context

- Gameplay is now a thin orchestrator. It constructs adapters and delegates all logic to extracted modules. Side-effects remain at the scene edge only.
- `SceneCtx` is the shared runtime context. It exposes live accessors (no snapshots) for state and view-model linkage (`state`, `vmPrev`, `softDropOn`, `pendingTap`), and reducers/clock.
- Pure modules (state, engine, modes, presenter) continue to avoid importing Phaser.

Changes

- Implement concrete adapters in `Gameplay.create()` and pass them into `BoardPresenter`:
  - `CameraFxAdapter`: maps plan camera ops to `this.cameras.main` with branded-time unbranding.
  - `AudioBus`: maps plan sound cues to `this.sound.play(...)` with keys preloaded in `Boot` (PR2).
- Keep adapters minimal and stateless; all timing comes from the plan.
- Ensure all durations passed to Phaser are unbranded numbers via `ms`/`unbrandMs` helpers.
- Do not add or modify any `declare module "phaser"` stubs; rely on the `phaser` package types only.
- Keep all logic for when to play sounds or trigger camera fx inside `BoardPresenter.apply()` and the plan generator; the scene only executes the requested effects.

Type/Function Signatures

```ts
// Gameplay.create(): construct adapters once and inject into the presenter
const fx: CameraFxAdapter = {
  fadeIn: (ms) => this.cameras.main.fadeIn(unbrandMs(ms)),
  fadeOut: (ms) => this.cameras.main.fadeOut(unbrandMs(ms)),
  shake: (ms, mag) => this.cameras.main.shake(unbrandMs(ms), mag ?? 0.005),
  zoomTo: (ms, z) => this.cameras.main.zoomTo(z, unbrandMs(ms)),
};
const audio: AudioBus = {
  play: (name) => this.sound.play(name),
};

this._presenter = new BoardPresenter({
  /* ...other required handles... */
  fx,
  audio,
});
```

Gameplay Orchestration Notes

- Continue to use `SceneCtx` for all runtime communication between helpers; adapters are created in the scene and consumed by the presenter.
- Ensure `update()` remains deterministic with the fixed-timestep loop; if you cap the backlog (optional spiral-of-death guard), keep the cap small (e.g. `10 * dt`) and do not alter step order.
- Keep preview sizing single-sourced from `previews.ts` (e.g. `PREVIEW_CELL_PX`, `PREVIEW_BOX_COLS`) when computing camera fit bounds.

Tests

- Use existing presenter tests that verify effects emission. Add smoke tests (or extend existing ones) to spy on adapter calls:
  - Verify `BoardPresenter.apply(plan)` invokes `audio.play("spawn"|"lock"|...)` when the plan includes sound cues.
  - Verify camera effects (`fadeIn`, `fadeOut`, `shake`, `zoomTo`) are invoked with the correct unbranded millisecond values.
- Avoid relying on actual audio playback or Web Audio unlock. Tests should stub/spy the adapter methods only.

Quality Gates

- `npm run ci` must be green (typecheck, lint, tests, format).
- No new `any`, `no-unsafe-*`, or TypeScript suppressions.
- No Phaser imports in pure modules; all wiring stays under `src/presentation/phaser/**`.

---

## PR7 — Results UI and Summary (thin-orchestrator compatible)

Goal

- Implement a polished `Results` scene (rexUI/Phaser tweens/particles) driven by a plain `ResultsSummary` object, with navigation wired to Gameplay/MainMenu.
- Keep summary computation pure and branded-safe, and transition initiated from Gameplay’s thin orchestrator.

Context

- Gameplay delegates core logic to modules and remains a thin orchestrator; it triggers `toResults()` based on top-out/flow and passes a computed summary via `this.scene.start(SCENE_KEYS.Results, { summary })`.
- Summary derives from `GameState.stats`; convert branded durations to numbers via helpers.

Changes

- `src/presentation/phaser/scenes/Results.ts`:
  - Accept `init({ summary })` and cache a `ResultsSummary | null`.
  - In `create()`, build UI controls and call a `showResults(summary)` helper that animates counters and displays any celebration effects.
  - Provide `backToMenu()` and `retry()` public methods; wire them to buttons and call `this.scene.start(SCENE_KEYS.MainMenu)` / `this.scene.start(SCENE_KEYS.Gameplay)` respectively.
- `src/presentation/phaser/scenes/Gameplay.ts`:
  - Keep `toResults()` as a thin pass-through that computes summary and starts `Results` with `{ summary }`.
  - Ensure summary computation uses brand-unbranding helpers and no DOM concerns.

Type/Function Signatures

```ts
export type ResultsSummary = Readonly<{
  linesCleared: number;
  piecesPlaced: number;
  accuracyPercentage: number; // rounded int 0..100
  timePlayedMs: number; // unbranded
}>;

export class Results extends Phaser.Scene {
  init(data?: { summary?: ResultsSummary }): void;
  create(): void;
  backToMenu(): void; // start MainMenu
  retry(): void; // start Gameplay
}
```

Implementation Notes

- Use `durationMsAsNumber(stats.timePlayedMs)` to unbrand time values.
- Do not import pure modules directly; Results remains a presentation scene.
- Prefer readonly/literal types where possible; UI adapter types remain local to scene.

Tests

- `tests/presenter/results.scene.test.ts` should validate:
  - Scene key and transitions (`backToMenu()`) function as expected.
  - `toResults()` from Gameplay passes an object with a `summary` key to `Results`.
  - Optional: spy on tween/adapter calls to ensure counters animate from 0 → target.

Quality Gates

- `npm run ci` green; no new suppressions; no `any`/`no-unsafe-*` violations.

---

## PR8 — Entrypoint Switch, Remove DOM/Lit UI (stabilize Phaser default)

Goal

- Make Phaser the default presentation, remove legacy DOM/Lit components and boot paths, and keep the thin-orchestrator + SceneCtx architecture intact.

Changes

- `src/main.ts`: drop feature flag; always boot Phaser via `createGame(...)` with `Boot` scene.
- `index.html`: remove DOM/Lit styles and tags; leave a simple container element for Phaser.
- Remove `src/ui/**` and any imports referencing DOM presentation (`src/main.ts`, legacy `src/app.ts`, etc.).
- Migrate any residual edge policies (visibility gating, focus handling) into the relevant Phaser scenes (typically `Boot` or `Gameplay`).
- Keep preview sizing and camera-fit logic single-sourced from `previews.ts` (as in PR6) and avoid duplicating layout constants.
- Ensure no pure module (`src/state/*`, `src/engine/*`, `src/modes/*`) imports `phaser`.

Tests

- Remove/update DOM/Lit tests; retain/expand presenter, plan, and scene smoke tests.
- Verify `tests/presenter/scenes.spec.ts` remains green with Phaser default boot.

Quality Gates

- `npm run ci` green; coverage maintained or improved.
- ESLint `no-restricted-imports` continues to guard `phaser` to `src/presentation/phaser/**` only.

Rollback

- The `?ui=phaser` flag can be reintroduced temporarily if needed, but post-PR8 default is Phaser.

---

## PR9 — Cleanup & Docs (thin-orchestrator, SceneCtx, and guardrails)

Goal

- Finalize documentation and hygiene to reflect the Phaser migration and the thin-orchestrator pattern.

Changes

- `README.md`: update architecture overview to describe the unidirectional flow (UI → Input → Reducer → State → UI), the presenter/plan approach, and the Phaser thin-orchestrator scene.
- `DESIGN.md`: document `SceneCtx` shape (live accessors, no snapshots), module boundaries, and side-effect containment.
- `FILES.md`: ensure all `src/presentation/phaser/**` modules are listed (scenes, gameplay/\* helpers) and DOM/Lit files are removed.
- `plans/phaser/INTEGRATION.md`: mark PRs 1–9 as complete with links to PRs; include notes on preview sizing single-source and backlog cap.
- `eslint.config.js`: keep `no-restricted-imports` guard for `phaser` in pure modules.
- `MIGRATION_NOTES.md` (optional): list removed DOM modules and their Phaser equivalents.

Tests/CI

- `npm run ci` green across typecheck, lint, test, and format.
- No new TypeScript suppressions; keep strict flags.

---

## Implementation Notes & Snippets

ESLint guard (keep):

```js
// eslint.config.js
rules: {
  'no-restricted-imports': ['error', {
    paths: [{ name: 'phaser', message: 'Phaser is presentation-only. Import in presentation/*.' }],
    patterns: ['phaser/**']
  }]
}
```

Fixed-step loop sketch (Gameplay.update):

```ts
const FIXED_DT: Ms = 16.666 as Ms;
let acc = 0;
update(_time: number, delta: number) {
  acc += delta;
  while (acc >= FIXED_DT) {
    for (const a of this.inputAdapter.drainActions(FIXED_DT)) {
      this.state = reduce(this.state, a);
    }
    this.clock.tick(FIXED_DT);
    this.state = reduce(this.state, { type: 'Tick', timestampMs: createTimestamp(this.clock.nowMs() as any) });
    acc -= FIXED_DT;
  }
  const vm = mapGameStateToViewModel(this.state);
  const plan = this.presenter.computePlan(this.prevVm, vm);
  this.presenter.apply(plan);
  this.prevVm = vm;
}
```

BoardPresenter adapters setup (Gameplay.create):

```ts
this.blitter = this.add.blitter(ox, oy, "tiles");
this.activeContainer = this.add.container();
this.ghostContainer = this.add.container();
const fx: CameraFxAdapter = {
  fadeIn: (ms) => this.cameras.main.fadeIn(ms as any),
  fadeOut: (ms) => this.cameras.main.fadeOut(ms as any),
  shake: (ms, mag) => this.cameras.main.shake(ms as any, mag ?? 0.005),
  zoomTo: (ms, z) => this.cameras.main.zoomTo(z, ms as any),
};
const audio: AudioBus = { play: (name) => this.sound.play(name) };
this.presenter = new BoardPresenter({
  tileSizePx: 16,
  originXPx: ox,
  originYPx: oy,
  blitter: this.blitter,
  activeContainer: this.activeContainer,
  ghostContainer: this.ghostContainer,
  fx,
  audio,
});
```

Input adapter sketch:

```ts
export class PhaserInputAdapterImpl implements PhaserInputAdapter {
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  constructor(scene: Phaser.Scene) {
    this.keys = scene.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
    }) as any;
    scene.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
    ]);
  }
  drainActions(dt: Ms): ReadonlyArray<Action> {
    // translate key states to Actions using DAS/ARR policy
    return [] as const; // placeholder; implement with state-machine logic
  }
}
```

Results UI adapter sketch:

```ts
const ui: ResultsUiAdapter = {
  animateCounter: (label, to, ms) =>
    this.tweens.addCounter({
      from: 0,
      to,
      duration: ms as any,
      onUpdate: (tw) => {
        /* update bitmaptext */
      },
    }),
  emitParticles: () => {
    /* emitter from atlas frames */
  },
  bindRetry: (h) => {
    /* hook button */
  },
  bindMenu: (h) => {
    /* hook button */
  },
};
```
