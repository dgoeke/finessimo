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

export function createGame(parent: HTMLElement, width: number, height: number): Phaser.Game;
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
  updateTimingMs(partial: Partial<{ /* existing narrow shape */ }> ): void;
  updateGameplay(partial: Partial<{ /* existing narrow shape */ }> ): void;
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

## PR6 — Audio and Camera FX wiring

Goal
- Route `RenderPlan.SoundCue` and `RenderPlan.CameraFx` to Phaser Sound and Camera APIs, with WebGL-safe guards.

Changes
- `src/presentation/phaser/presenter/Effects.ts`: concrete adapter in Gameplay scene: `fadeIn`, `fadeOut`, `shake`, `zoomTo` using `this.cameras.main`.
- `src/presentation/phaser/presenter/AudioBus.ts`: concrete adapter mapping `spawn|lock|line|topout` to sound keys loaded in Boot.

Type/Function Signatures
```ts
// in Gameplay.create()
const fx: CameraFxAdapter = { /* map to this.cameras.main */ };
const audio: AudioBus = { play: (name) => this.sound.play(name) };
```

Tests
- Impure tests: spy on adapter calls in `BoardPresenter.apply` (already present). Add light smoke tests to ensure FX functions are invoked.

Quality Gates
- `npm run ci` green.

---

## PR7 — Results UI and summary integration

Goal
- Replace Results stub with real rexUI counters and particles; wire retry/menu.

Changes
- `src/presentation/phaser/scenes/Results.ts`: use `Results.show(summary, ui)` already added; implement a concrete UI adapter per Scene:
  - Tweens to animate counters to final values.
  - Particle emitter for celebration.
  - Buttons bound to `retry()` and `backToMenu()`.
- Add a helper to compute `ResultsSummary` from `GameState.stats` when transitioning from Gameplay to Results.

Type/Function Signatures
```ts
export type ResultsSummary = {
  linesCleared: number;
  piecesPlaced: number;
  accuracyPercentage: number;
  timePlayedMs: number;
};
```

Tests
- Unit: `tests/presenter/results.scene.test.ts` (already added) should remain green.

Quality Gates
- `npm run ci` green.

---

## PR8 — Entrypoint switch, remove DOM/Lit UI

Goal
- Make Phaser the default UI; remove DOM/Lit components and references.

Changes
- `src/main.ts`: remove FinessimoApp boot; always boot Phaser.
- `index.html`: remove UI CSS and Lit component tags; keep a bare container.
- Remove `src/ui/**` and all imports referencing it (`src/main.ts`, `src/app.ts`, engine selectors that import `../ui/overlays` are already moved under engine/ui — keep those).
- Remove `src/app.ts` once replaced; port any remaining logic (e.g., visibility gating) into Phaser scenes.
- Update tests that import UI modules; remove UI-only tests. Ensure presenter/plan tests cover rendering behavior.

Tests
- Update or remove DOM/Lit tests; ensure all core/presenter tests still pass.

Quality Gates
- `npm run ci` green; coverage unchanged or improved.

Rollback
- The `?ui=phaser` flag can be reintroduced temporarily if needed, but post-PR8 default is Phaser.

---

## PR9 — Cleanup & Docs

Goal
- Finalize docs and code hygiene post-migration.

Changes
- Update `README.md` with Phaser-based architecture and instructions.
- Update `FILES.md` to reflect Phaser as the presentation and removal of DOM/Lit.
- Update `eslint.config.js` `no-restricted-imports` rule to continue guarding pure modules.
- Ensure `MIGRATION_NOTES.md` (optional) documents removed modules and equivalences.

Quality Gates
- `npm run ci` green.

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
this.blitter = this.add.blitter(ox, oy, 'tiles');
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
    scene.input.keyboard.addCapture([Phaser.Input.Keyboard.KeyCodes.SPACE, Phaser.Input.Keyboard.KeyCodes.UP, Phaser.Input.Keyboard.KeyCodes.DOWN, Phaser.Input.Keyboard.KeyCodes.LEFT, Phaser.Input.Keyboard.KeyCodes.RIGHT]);
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
  animateCounter: (label, to, ms) => this.tweens.addCounter({ from: 0, to, duration: ms as any, onUpdate: (tw) => {/* update bitmaptext */} }),
  emitParticles: () => {/* emitter from atlas frames */},
  bindRetry: (h) => {/* hook button */},
  bindMenu: (h) => {/* hook button */},
};
```

