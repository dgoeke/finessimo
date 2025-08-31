# Phaser 3 Presentation Layer — Design & Migration Plan

**Goal:** Replace the current Lit+Canvas presentation with a **Phaser 3** scene-based renderer that delivers stylish, 60 fps menus, transitions, gameplay, results, and effects—**without changing the pure core** (reducers, types, finesse pipeline, modes, RNG).

**Non-goals:** Change rotation rules, physics, timers, or core data structures; introduce mutable state into reducers; compromise determinism.

## Current Architecture (as-is)

- **Flow:** `UI → Input Handler → Reducer → State → UI` (pure/immutable core).
- **Key modules:** `src/app.ts`, `src/state/{types.ts,reducer.ts,signals.ts}`, `src/input/StateMachineInputHandler.ts`, `src/modes/*`, `src/core/*`, `src/finesse/*`, `src/ui/*`. ([GitHub][1])

## Big Picture (to-be)

We add a **Phaser layer** that _reads_ the core state and _presents_ it. The core remains framework-agnostic.

- **Scenes:** `Boot → MainMenu → Settings → ModeSelect → Gameplay → Results`
- **Presenter:** A thin adapter that diffs a **ViewModel** against current display objects and issues _imperative draw/update commands_.
- **Renderer details:** Use **Blitter** for locked cells, pooled Sprites for active/ghost pieces, **RenderTexture** for grid/background, camera FX + post-processing for juice. ([docs.phaser.io][2])
- **Transitions & FX:** Camera fades/zooms/shakes and post-FX pipelines (e.g., vignette, bloom, glitch). ([docs.phaser.io][3])
- **UI in-engine:** Use **rexUI** for menus, lists, dialogs, sliders, etc. (no DOM seam). ([npm][4])
- **Renderer choice:** Phaser 3 uses **WebGL** (or Canvas fallback) with `type: Phaser.AUTO`; **not WebGPU**. ([phaser.io][5])

## Proposed File Layout

```
src/
  presentation/phaser/
    Game.ts                      // Phaser.Game config (AUTO renderer)
    assets/                      // atlases, sfx, bitmapfonts (packed by Vite)
    scenes/
      Boot.ts
      MainMenu.ts
      Settings.ts
      ModeSelect.ts
      Gameplay.ts
      Results.ts
    presenter/
      types.ts                   // ViewModel, RenderPlan (branded types)
      BoardPresenter.ts          // locked/active/ghost diff + draw
      Effects.ts                 // camera/post-fx helpers
      AudioBus.ts                // mapping of SoundCue -> Phaser sound
      UiAdapters.ts              // rexUI wrappers for menus/settings
```

Existing core remains where it is (`src/state/*`, `src/core/*`, `src/modes/*`, `src/finesse/*`). ([GitHub][1])

## Data Flow & Components (Mermaid)

```mermaid
flowchart LR
  subgraph Inputs
    K[Keyboard/Touch]:::io
  end

  subgraph Core (Pure)
    IH[Input Handler\n(Robot3 DAS/ARR)] --> A[Action]
    A --> R[Reducer]
    R --> GS[(GameState)]
    GS --> VM[ViewModel\n(pure mapping)]
  end

  subgraph Phaser Layer (Impure, Render-only)
    VM --> PZ[Presenter\n(diff -> RenderPlan)]
    PZ --> SG[Scene Graph\n(Sprites/Blitter/Containers)]
    SG --> CAM[Camera FX/PostFX]
    PZ --> SFX[Audio Bus]
  end

  K --> IH
  CAM -->|transition| Scenes[Scenes: Boot→Menu→Settings→ModeSelect→Gameplay→Results]
  classDef io fill:#eef,stroke:#99f,color:#111;
```

**Notes**

- **ViewModel** is a pure, typed projection of `GameState` for rendering only.
- **RenderPlan** is a discriminated union of _commands_ (e.g., `TileDiff`, `PieceMove`, `CameraShake`, `SoundCue`), allowing deterministic unit tests.

## Key Interfaces (Types-first, Haskell-style)

```ts
// presentation/phaser/presenter/types.ts
export type Px = number & { readonly __brand: "Px" };
export type Col = number & { readonly __brand: "Col" };
export type Row = number & { readonly __brand: "Row" };

export interface ViewModel {
  readonly board: ReadonlyArray<ReadonlyArray<number>>; // 0..7
  readonly active: {
    kind: "I" | "J" | "L" | "O" | "S" | "T" | "Z";
    cells: ReadonlyArray<{ col: Col; row: Row }>;
  };
  readonly ghost: { cells: ReadonlyArray<{ col: Col; row: Row }> } | null;
  readonly topOut: boolean;
  // plus HUD bits you want displayed, e.g., score, lines, mode name
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
      ms: number;
    }
  | { t: "SoundCue"; name: "spawn" | "lock" | "line" | "topout" }
  | { t: "Noop" };

export interface Presenter {
  computePlan(
    vmPrev: ViewModel | null,
    vmNext: ViewModel
  ): ReadonlyArray<RenderPlan>;
  apply(plan: ReadonlyArray<RenderPlan>): void; // impure, Phaser side-effects only
}
```

> **Guardrails:** No Phaser imports in `src/state/*`, `src/core/*`, or `src/modes/*`. All rendering is behind `Presenter`.

## Scenes & Effects

- **Boot:** load atlases, SFX, bitmap fonts; init scale (`FIT`, `CENTER_BOTH`), `roundPixels: true`.
- **MainMenu:** camera parallax background (RenderTexture or shader), post-FX vignette; menu via rexUI.
- **Settings:** sliders/toggles mapped to existing settings actions; save to your current store.
- **ModeSelect:** list grid with previews; start transition.
- **Gameplay:** fixed-step accumulator calls reducer; Presenter diffs to board, active, ghost.
- **Results:** animated counters, particle burst, “retry” or “menu”.

**FX:** Use camera fade/zoom/shake and PostFX pipelines for bloom/glow/glitch. (WebGL mode). ([docs.phaser.io][3])

## Rendering Strategy (60 fps, crisp)

- **Grid / Frame (static):** pre-render to **RenderTexture**, reuse. ([docs.phaser.io][6])
- **Locked cells:** **Blitter** (one Bob per filled cell); update only rows that change. ([docs.phaser.io][2])
- **Active/ghost:** 4 pooled Sprites each, parented to a Container; set x/y only.
- **Spawn rows above board:** single world stage; place containers at `y < 0` (no HTML seam).
- **Crisp pixels:** `roundPixels: true`, `antialias: false`, Scale `FIT` with integer zoom.

## Update Loop (deterministic)

Inside `GameplayScene.update(t, dt)`:

1. Accumulate `dt` and step the core at fixed `FIXED_DT` (e.g., 16.666 ms).
2. Input adapter translates Phaser input → existing `Action`s → reducer.
3. Map `GameState → ViewModel` (pure).
4. `Presenter.computePlan(prev, next)` → `apply(plan)` (impure).

> Keep clocks outside the reducer; reducers accept timestamps (branded `Timestamp`) provided by the loop.

## Audio

Map pure **SoundCue** events in `RenderPlan` to Phaser’s **Sound Manager** (WebAudio, HTML5 fallback). Keep sound selection & rates outside the core.

## UI: in-engine

Adopt **rexUI** for buttons, sliders, dialogs, tables (settings, mode select, high-scores). Ship with a minimal style sheet (9-slice panels + bitmap font). ([npm][4])

## Tooling & Build

- **Deps:** `npm i phaser phaser3-rex-plugins`
- **Vite:** No special config for modern Phaser ESM. Use static import and assets under `public/` as you do today.
- **Renderer type:** `type: Phaser.AUTO` (WebGL preferred; Canvas fallback). **Phaser 3 does not use WebGPU.** ([phaser.io][5])

---

## Phased Implementation (tests must pass between phases)

> You **do not** need a playable game between phases; only **typechecks + unit tests** must pass. UI-only tests may be deleted when explicitly called out below.

### Phase 0 — Skeleton & Contracts (green build)

- Add `src/presentation/phaser/{Game.ts, presenter/types.ts}` with the **types above**.
- Export a **no-op** `Presenter` that compiles (`computePlan` returns `[ { t: "Noop" } ]`, `apply` is empty).
- Add `tests/presenter/contracts.test.ts`: compile-time checks (exhaustive unions, brands, no `any`).
  **Exit:** `npm run typecheck`, `npm run test`, `npm run lint` all green.

### Phase 1 — Scenes Shells (no rendering)

- Implement empty `Boot`, `MainMenu`, `Settings`, `ModeSelect`, `Gameplay`, `Results` with transitions only (no game content).
- Add `tests/presenter/scenes.spec.ts`: asserts scenes register and transition methods exist (shallow, not visual).
  **Exit:** green build. (Delete any UI snapshot tests that depended on Lit DOM output.)

### Phase 2 — ViewModel Mapper (pure)

- Write `mapGameStateToViewModel(state): ViewModel` (pure).
- Tests: **goldens** for tricky cases (spawn above board, ghost projection, top-out).
  **Exit:** green.

### Phase 3 — RenderPlan Generator (pure) + BoardPresenter (impure)

- Implement `Presenter.computePlan(prev, next)` with **row-diff** for locked cells and minimal piece move ops.
- Tests: render-plan snapshots on small boards (e.g., 6×6 fixtures).
- Implement `BoardPresenter.apply` using **Blitter** for locked cells, Sprites for active/ghost. ([docs.phaser.io][2])
  **Exit:** green (plan tests), runtime code covered by plan unit tests.

### Phase 4 — Gameplay Loop Integration (deterministic)

- In `GameplayScene`, add accumulator loop and wire inputs → existing `StateMachineInputHandler` → reducer.
- Introduce `SimulatedClock` so reducers receive branded timestamps; test with fixed seeds to ensure stable outputs.
- Tests: **integration** that one step of reducer → specific `ViewModel` → expected `RenderPlan`.
  **Exit:** green.

### Phase 5 — Transitions, FX, and Audio

- Add camera **fade/zoom/shake**, death **glitch/bloom**, and **mode start stingers** via `SoundCue`. ([docs.phaser.io][3])
- Tests: small unit tests around **plan composition** (e.g., top-out emits `CameraFx: shake` + `SoundCue: topout`).
  **Exit:** green. Remove any remaining Lit-canvas UI tests; replace with plan tests.

### Phase 6 — Menus & Settings (rexUI)

- Implement Main Menu, Mode Select, Settings using **rexUI** widgets. Wire to existing settings actions. ([npm][4])
- Tests: minimal “config plumbing” unit tests (pure functions only).
  **Exit:** green.

### Phase 7 — Results/High-scores & Cleanup

- Animate results counters; add retry/menu paths.
- Remove old `src/ui/*` code paths; keep any CSS/asset files still used.
- Update `FILES.md` and `README.md` sections.
  **Exit:** green; core coverage unchanged.

---

## Testing Strategy (what stays, what changes)

- **Stays:** All **core** tests over reducers, finesse, SRS, RNG, modes.
- **New:** Pure tests for `ViewModel` mapper and `RenderPlan` generator; small integration tests for “one step produces these commands.”
- **Removed:** **UI-only** snapshot tests that asserted DOM/canvas pixels. Replace with **plan snapshots**.
- **Lint / TS gates:** No new `any`, no `@ts-ignore`, unions must be exhaustive, brands respected.

---

## Performance Notes

- Prefer **Blitter** for dense tile fields; avoid per-tile Sprites. ([docs.phaser.io][2])
- Cache static layers to **RenderTexture**; update only when theme/size changes. ([docs.phaser.io][6])
- Pool Sprites; never allocate in `update()`.
- Use `roundPixels: true`, `antialias: false` for crisp grids; integer zoom via Scale Manager.

---

## Open Questions

1. Should spawn/hold/queue share one atlas or separate atlases for color variants?
2. Do we want a theme system (palette, bloom intensity, vignette) exposed to settings?
3. How should we persist high-scores (localStorage now; server later)?
4. Any UI that must stay in HTML (e.g., OAuth) or can everything move to rexUI?

---

## References

- Phaser renderer selection and AUTO (WebGL with Canvas fallback). ([phaser.io][5])
- Scenes / camera / transitions concepts. ([docs.phaser.io][3])
- Post-FX / camera effects. ([docs.phaser.io][7])
- Blitter and RenderTexture guides. ([docs.phaser.io][8])
- rexUI plugins for in-engine UI. ([npm][4])
- Repo’s current “Key Files & Folders” and flow. ([GitHub][1])

---

## Definition of Done (for the migration)

- Core (`src/state/*`, `src/core/*`, `src/modes/*`, `src/finesse/*`) untouched by Phaser imports.
- `mapGameStateToViewModel` and `Presenter.computePlan` are pure, with unit tests.
- Scenes compile and transition; GameplayScene runs the fixed-step loop.
- Effects and audio are driven by typed **RenderPlan** entries.
- All gates (`typecheck`, `lint`, `test`) pass at every phase.
- Removed UI tests are replaced by equivalent **plan** tests.
