# Phaser 3 Presentation Layer — Design & Migration Plan (Expanded)

**Goal**  
Replace the current Lit+Canvas presentation with a **Phaser 3** renderer that delivers stylish, 60 fps menus, transitions, gameplay, results, and effects — **without changing the pure core** (reducers, types, finesse pipeline, modes, RNG).

**Non‑goals**

- Change rotation rules, physics, timers, or core data structures
- Introduce mutable state into reducers
- Tie game speed to the display refresh rate (remain deterministic)

> This doc is written for AI agents implementing the migration. It includes explicit type signatures, boundaries, and phase gates to keep **typechecks / lint / unit tests green between phases**. UI‑only tests may be deleted when explicitly noted.

---

## Current Architecture (as‑is)

Immutable, uni‑directional flow (already in repo):

```
UI → Input Handler → Reducer → State → UI
```

Indicative module references (adjust if names differ):

- `src/state/{types.ts,reducer.ts}` — core types and reducer
- `src/input/StateMachineInputHandler.ts` — DAS/ARR timing, action emission
- `src/core/*` — board, SRS, piece logic
- `src/modes/*` — gameplay modes & rules
- `src/finesse/*` — finesse calculator and faults

---

## Target Architecture (to‑be)

We add a **Phaser 3 presentation layer** that _reads_ the pure state and _presents_ it. The core remains framework‑agnostic.

- **Scenes:** `Boot → MainMenu → Settings → ModeSelect → Gameplay → Results`
- **Presenter:** A thin adapter that diffs a **ViewModel** against current display objects to produce an imperative **RenderPlan** (commands). `apply(plan)` executes side‑effects in Phaser only.
- **Renderer choices:** Use **Blitter** for dense locked tiles, pooled Sprites for active/ghost, **RenderTexture** (or cached Graphics) for static grid/frame, **Camera FX + PostFX** for juice.
- **UI in‑engine:** Use rexUI for menus, sliders, tables, etc. Avoid DOM seams.
- **Renderer type:** `Phaser.AUTO` (WebGL preferred; Canvas fallback). PostFX are WebGL‑only; gate them.

### Mermaid — Components & Data Flow

```mermaid
flowchart TB
  subgraph Core[Pure Core]
    IH[Input Handler\n(DAS/ARR state machine)] --> A[Action]
    A --> R[Reducer]
    R --> GS[(GameState)]
    GS --> VM[ViewModel Mapper\n(GameState → ViewModel)]
  end

  subgraph Phaser[Phaser 3 Presentation (Impure)]
    VM --> PZ[Presenter\n(diff → RenderPlan[])]
    PZ --> SG[Scene Graph\n(Sprites/Blitter/Containers)]
    PZ --> CAM[Camera & PostFX]
    PZ --> SND[Audio Bus]
  end

  subgraph Scenes[Scenes & Flow]
    Boot --> MainMenu --> Settings --> ModeSelect --> Gameplay --> Results --> MainMenu
  end

  KBD[Keyboard/Gamepad] --> IH
  Gameplay -. uses .-> Phaser
```

**Notes**

- **ViewModel** is a pure, typed projection of `GameState` for rendering only.
- **RenderPlan** is a discriminated union of commands (`TileDiff`, `PiecePos`, `CameraFx`, `SoundCue`, …) — perfect for deterministic unit tests.
- **No Phaser imports** in `src/state/*`, `src/core/*`, `src/modes/*`, or any other pure modules.

---

## Key Types (Haskell‑style in TypeScript)

```ts
// presentation/phaser/presenter/types.ts
export type Px = number & { readonly __brand: "Px" };
export type Col = number & { readonly __brand: "Col" };
export type Row = number & { readonly __brand: "Row" };
export type Ms = number & { readonly __brand: "Ms" };

export interface ViewModel {
  readonly board: ReadonlyArray<ReadonlyArray<number>>; // 0..7 tile indices, [row][col]
  readonly active?: {
    readonly kind: "I" | "J" | "L" | "O" | "S" | "T" | "Z";
    readonly cells: ReadonlyArray<{ col: Col; row: Row }>;
  };
  readonly ghost?: {
    readonly cells: ReadonlyArray<{ col: Col; row: Row }>;
  };
  readonly topOut: boolean;
  readonly hud: {
    readonly score: number;
    readonly lines: number;
    readonly mode: string;
  };
}

export type RenderPlan =
  | {
      t: "TileDiff";
      puts: ReadonlyArray<{ col: Col; row: Row; frame: number }>;
      dels: ReadonlyArray<{ col: Col; row: Row }>;
    }
  | { t: "PiecePos"; id: "active" | "ghost"; xPx: Px; yPx: Px }
  | {
      t: "CameraFx";
      kind: "shake" | "fadeIn" | "fadeOut" | "zoomTo";
      ms: Ms;
      magnitude?: number;
    }
  | { t: "SoundCue"; name: "spawn" | "lock" | "line" | "topout" }
  | { t: "UiHint"; name: "showSettings" | "hideSettings" }
  | { t: "Noop" };

export interface Presenter {
  computePlan(
    vmPrev: ViewModel | null,
    vmNext: ViewModel
  ): ReadonlyArray<RenderPlan>;
  apply(plan: ReadonlyArray<RenderPlan>): void; // impure, Phaser side‑effects only
}
```

> Guardrail: `RenderPlan` must be **exhaustive** in `switch(plan.t)` with `never` checks. No `any`, no `@ts-ignore`.

---

## Proposed File Layout

```
src/
  presentation/phaser/
    Game.ts                      // Phaser.Game config (AUTO renderer)
    assets/                      // atlases, sfx, bitmapfonts (bundled by Vite)
    scenes/
      Boot.ts
      MainMenu.ts
      Settings.ts
      ModeSelect.ts
      Gameplay.ts
      Results.ts
    presenter/
      types.ts                   // ViewModel, RenderPlan (brands)
      Presenter.ts               // computePlan/apply, board & piece submodules
      BoardPresenter.ts          // locked/active/ghost diff + draw
      Effects.ts                 // camera/post-fx helpers
      AudioBus.ts                // SoundCue -> Phaser sound mapping
      UiAdapters.ts              // rexUI wrappers for menus/settings
    input/
      PhaserInputAdapter.ts      // key/gamepad -> Action (pure map)
```

---

## Rendering Strategy (60 fps, crisp pixels)

- **Grid/Frame (static)** — pre-render to **RenderTexture** (or cached Graphics) and reuse.
- **Locked cells** — **Blitter** (one Bob per filled cell); update only rows that change.
- **Active/Ghost** — 4 pooled Sprites each, parented to a Container (`x/y` only, no per‑frame allocation).
- **Spawn rows** — single world stage; position piece containers at `y < 0` (no DOM seam).
- **Crisp pixels** — `roundPixels: true`, `antialias: false`; Scale Manager `mode: FIT`, `autoCenter: CENTER_BOTH`, integer zooms when possible.

---

## Timing & Determinism

Use a fixed‑step accumulator inside `GameplayScene.update(time, delta)`:

```ts
const FIXED_DT: Ms = 16.666 as Ms; // 60Hz
let acc: number = 0;
let prevVm: ViewModel | null = null;

update(time: number, delta: number) {
  acc += delta;
  while (acc >= FIXED_DT) {
    for (const a of this.inputAdapter.drainActions(FIXED_DT)) {
      this.state = reduce(this.state, a); // pure reducer
    }
    acc -= FIXED_DT;
  }
  const vm = mapGameStateToViewModel(this.state);
  const plan = this.presenter.computePlan(prevVm, vm);
  this.presenter.apply(plan);
  prevVm = vm;
}
```

> On hidden tabs, RAF is throttled; pause the accumulator and audio on `visibilitychange` and resume cleanly when visible.

---

## Input (Keyboard & Gamepad)

- Use `keyboard.addKey(KeyCodes.SHIFT)` for “Hold” action; `JustDown/JustUp/isDown` patterns.
- For Left/Right Shift distinction, listen to global `keydown` and branch on `KeyboardEvent.code` (`"ShiftLeft"`, `"ShiftRight"`).
- Prevent page scrolling: `keyboard.addCapture([KeyCodes.SPACE, KeyCodes.UP, KeyCodes.DOWN, KeyCodes.LEFT, KeyCodes.RIGHT])`.
- RMB actions: `this.input.mouse.disableContextMenu()`.
- Gamepads available via `this.input.gamepad` (optional).

Bind keys to **Action** via a small pure `PhaserInputAdapter` so the reducer API does not change.

```ts
export interface PhaserInputAdapter {
  drainActions(dt: Ms): ReadonlyArray<Action>; // consult keys, DAS/ARR machine, return Actions for the fixed step
}
```

---

## Audio

- WebAudio may require first user gesture — show an “Enable Sound” prompt in Boot/Menu.
- Map **SoundCue** commands from `RenderPlan` to Sound Manager (`this.sound.play(key, config)`).

---

## Build & Assets (Vite + ESM)

- `npm i phaser phaser3-rex-plugins`
- Use ESM imports; put large assets under `/public` or import URLs via Vite.
- Use **bitmap fonts** for crisp UI text at small sizes; prefer atlases over many loose textures.

---

## Gotchas & Platform Caveats

- **Renderer fallback:** PostFX are WebGL‑only; gate with a feature flag and provide mild fallback visuals.
- **Scale & pixel rounding:** Always enable `roundPixels` and avoid sub‑pixel positions for tiles.
- **Context loss:** Handle `restorewebgl` to rebuild dynamic textures (RenderTextures, cached Graphics).
- **Hidden tabs:** Pause accumulator and audio on `document.hidden`; resume deterministically.
- **Autoplay policy:** Don’t try to play audio before a gesture; show a minimal prompt.
- **No Workers for Phaser:** Keep Phaser on the main thread; heavy non‑render work can go to Workers.

---

## Lint & Type Guardrails (automatable)

- **Ban Phaser in pure modules**

```js
// eslint.config.js
rules: {
  'no-restricted-imports': ['error', {
    paths: [{ name: 'phaser', message: 'Phaser is presentation-only. Import in presentation/*.' }],
    patterns: ['phaser/**']
  }]
}
```

- **Exhaustive unions** for `RenderPlan`, branded types (`Px`, `Col`, `Row`, `Ms`), **no `any`** in presenter code.
- **Test layers**
  - Pure: `mapGameStateToViewModel`, `Presenter.computePlan` over fixtures.
  - Impure: smoke tests that `apply(plan)` touches Blitter/Sprites as expected (no pixel snapshots).

---

## Phased Implementation (keep gates green)

> You **do not** need a playable game between phases. Each phase ends with green `typecheck`/`lint`/`test`. UI‑only tests may be removed when explicitly stated.

### Phase 0 — Skeleton & Contracts (green build)

**What to add**

- `src/presentation/phaser/Game.ts` with minimal `Phaser.Game` config (not yet constructed by app code).
- `src/presentation/phaser/presenter/types.ts` — copy the types in this doc.
- `src/presentation/phaser/presenter/Presenter.ts` — no‑op implementation:
  ```ts
  export class NoopPresenter implements Presenter {
    computePlan(_: ViewModel | null, __: ViewModel) {
      return [{ t: "Noop" }] as const;
    }
    apply(_: ReadonlyArray<RenderPlan>): void {}
  }
  ```

**Type signatures**

```ts
export function mapGameStateToViewModel(s: Readonly<GameState>): ViewModel;
```

**Tests**

- `tests/presenter/contracts.test.ts` — type‑only assertions (brands are enforced; no `any`; exhaustive `RenderPlan` check using a `never` helper).

**Exit criteria**  
All gates green; no linkage into the running app yet.

---

### Phase 1 — Scene Shells (no rendering)

**What to add**

- `Boot.ts`, `MainMenu.ts`, `Settings.ts`, `ModeSelect.ts`, `Gameplay.ts`, `Results.ts` with minimal scene classes (empty `create()`).
- Wire minimal transitions with `this.scene.start(...)` placeholders.

**Tests**

- `tests/presenter/scenes.spec.ts` — ensure scenes register; transition methods exist (shallow).

**Notes**

- Delete/skip **DOM snapshot** tests bound to the old Lit presentation (UI‑only); core tests remain.

**Exit criteria**  
Gates green; app still uses old UI or no UI.

---

### Phase 2 — Pure ViewModel Mapper

**What to add**

- `mapGameStateToViewModel(state): ViewModel` (pure). Include: board grid, active/ghost cells, topOut, HUD.
- Small helpers: `toCol(n: number): Col`, `toRow(n: number): Row`, `toPx(n: number): Px` (constructors validate ranges in tests).

**Tests**

- Golden fixtures for edge cases: spawn above top, ghost projection when overlapping, top‑out, cleared line compaction.

**Exit criteria**  
Pure tests green; no Phaser side‑effects yet.

---

### Phase 3 — RenderPlan Generator (pure) + BoardPresenter.apply (impure)

**What to add**

- Implement `Presenter.computePlan(prev, next)` using diffs:
  - **TileDiff** — compare locked‑cell layers by row; produce `puts`/`dels`
  - **PiecePos** — position active/ghost as whole containers (`xPx`, `yPx`)
  - **CameraFx/SoundCue** — generated from transitions in ViewModel/topOut, etc.

- Implement `BoardPresenter.apply(plan)` in Phaser:
  - Create **Blitter** for board; put/remove Bobs per `TileDiff`
  - Pool Sprites for 4 active & 4 ghost cells; set `x/y` only
  - Pre‑render grid/frame to **RenderTexture** once

**Type signatures**

```ts
export class BoardPresenter implements Presenter {
  computePlan(
    prev: ViewModel | null,
    next: ViewModel
  ): ReadonlyArray<RenderPlan>;
  apply(plan: ReadonlyArray<RenderPlan>): void;
}
```

**Tests**

- **Pure**: snapshot `RenderPlan[]` on 6×6 mini boards
- **Impure**: spy/phake tests that `apply` calls `blitter.create(x,y,frame)` / `bob.reset()` etc.

**Exit criteria**  
All tests green; visual output not required yet.

---

### Phase 4 — Gameplay Loop Integration (deterministic)

**What to add**

- In `Gameplay.ts`, add the fixed‑step accumulator; inject the existing input handler & reducer.
- Introduce `Clock` abstraction for branded timestamps:

```ts
export interface Clock {
  nowMs(): Ms;
}
export class SimulatedClock implements Clock {
  private t: Ms = 0 as Ms;
  tick(dt: Ms) {
    this.t = (this.t + dt) as Ms;
  }
  nowMs(): Ms {
    return this.t;
  }
}
```

- Wire `PhaserInputAdapter` to produce `Action[]` per fixed step.

**Tests**

- Integration test: given seed + inputs over N steps → expected `ViewModel` and `RenderPlan`.

**Exit criteria**  
Green; game can “run” headlessly in tests.

---

### Phase 5 — Transitions, Camera FX, and Audio

**What to add**

- Camera `fadeIn/fadeOut/zoomTo/shake` mapped from `RenderPlan.CameraFx`.
- Death/top‑out → `shake + glitch` (gate glitch if not WebGL).
- `SoundCue` mapping in `AudioBus` (`spawn`, `lock`, `line`, `topout`).

**Tests**

- Pure: verify correct composition of `CameraFx`/`SoundCue` in plan.
- Impure: smoke test that `fade/zoom/shake` methods are invoked.

**Exit criteria**  
Green; still no need for pixel snapshots.

---

### Phase 6 — Menus & Settings (rexUI)

**What to add**

- Build `MainMenu`, `Settings`, `ModeSelect` with rexUI components.
- Settings map to the existing settings actions in your store (pure side).

**Tests**

- Pure: settings reducers remain covered; minimal UI integration smoke tests acceptable.

**Exit criteria**  
Green; DOM‑based settings removed/replaced.

---

### Phase 7 — Results / High‑scores & Cleanup

**What to add**

- Results scene with animated counters (tweened), particles, Retry/Menu buttons.
- Remove old `src/ui/*` modules not used by Phaser.
- Update `README.md` / `FILES.md` / `MIGRATION_NOTES.md` (optional).

**Exit criteria**  
All gates green; core coverage unchanged or improved.

---

## Feature Flags & Fallbacks

```ts
const supportsWebGL =
  this.game.renderer && (this.game.renderer as any).type === Phaser.WEBGL;
if (supportsWebGL) enablePostFx();
else applySimpleTheme();
```

- FX pipelines must be guarded; Canvas renderer will not support them.
- If FX disabled, keep transitions via camera fades and color tweens (cheap and portable).

---

## Visibility & Context Loss Hooks

```ts
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pauseAudio();
    pauseAccumulator();
  } else {
    resumeAccumulator();
    resumeAudio();
  }
});

this.game.renderer.events.on("restorewebgl", () => {
  rebuildRenderTextures(); // redraw cached layers
});
```

---

## Definition of Done

- No Phaser imports in core (`src/state/*`, `src/core/*`, `src/modes/*`, `src/finesse/*`)
- `mapGameStateToViewModel` and `Presenter.computePlan` are **pure** and tested
- Scenes compile and transition; GameplayScene runs the fixed‑step loop
- Effects & audio are driven only by typed **RenderPlan** entries
- All gates (`typecheck`, `lint`, `test`) pass at every phase
- Removed UI tests are replaced by equivalent **plan** tests

---

## Appendix: Minimal Phaser Config (for reference)

```ts
// src/presentation/phaser/Game.ts
import Phaser from "phaser";

export function createGame(
  parent: HTMLElement,
  width: number,
  height: number
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width,
    height,
    backgroundColor: "#000000",
    pixelArt: true, // disables antialiasing in WebGL
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: "arcade", arcade: { debug: false } }, // not used but harmless
    audio: { disableWebAudio: false },
    scene: [], // scenes get registered by add/start
  });
}
```

---

**End of DESIGN.md**
