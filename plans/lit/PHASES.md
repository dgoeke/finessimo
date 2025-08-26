# Lit UI Migration — Phased Plan (Finessimo)

Purpose: migrate the UI from imperative DOM renderers to Lit components while preserving pure reducers and unidirectional data flow. Each phase results in a working, buildable app with passing lint/tests and no TypeScript/ESLint suppressions.

Source of truth: align with lit/phases/DESIGN.md and FILES.md. Code lives under `src/` and tests under `tests/` (or `../../test` from this folder if present).

Gates per phase:
- Build: `npm run pre-commit` passes (typecheck, lint, tests).
- Runtime: app starts and basic navigation works without console errors.

Principles:
- Functional core (immutable state + pure reducers) remains in `src/state/*`.
- Side-effects only in input handlers; Lit components are reactive views.
- Unidirectional data flow: UI → Input Handler → Reducer → State → UI.

Roadmap overview:
1) Tooling + shell skeleton
2) Signals foundation
3) Board migration
4) Finesse overlay migration
5) Hold + Preview migration
6) Stats panel migration
7) Settings modal migration
8) Shell + CSS finalization
9) App/main consolidation and cleanup

---

## Phase 1 — Tooling + Shell Skeleton (non-invasive)

Goal: introduce Lit build/tooling and a `<finessimo-shell>` wrapper that preserves existing container structure so the current `FinessimoApp` and renderers keep working unchanged.

Scope:
- Modify: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`.
- Add: `src/ui/components/finessimo-shell.tsx` (skeleton only; no state wiring yet).
- Touch: `src/main.ts` (register shell custom element).

Files/refs:
- Current app/root: `src/main.ts`, `src/app.ts`.
- Current UI containers/IDs come from existing HTML and are consumed by renderers in `src/ui/*.ts`.

Plan:
- Add dependencies per lit/phases/DESIGN.md:
  - `lit`
  - `@lit-labs/signals`
  - `@chnicoloso/lit-jsx`
  - `vite-plugin-lit-jsx` (dev)
- Configure TS + Vite for JSX with the Lit JSX transform.
- Create a shell component that emits the exact same internal container structure (IDs/classes) the legacy renderers expect. This lets `app.ts` find elements as before.
- Replace `<main class="app shell">…` in `index.html` with `<finessimo-shell></finessimo-shell>`.
- Import the shell once in `src/main.ts` to ensure the custom element is defined before DOM ready.

Example: minimal shell that preserves legacy containers
```ts
// src/ui/components/finessimo-shell.tsx
import {LitElement, css, html} from 'lit';
import {customElement} from 'lit/decorators.js';

@customElement('finessimo-shell')
export class FinessimoShell extends LitElement {
  static styles = css`:host{display:block}`;
  protected render() {
    // IMPORTANT: keep IDs/classes to satisfy current app.ts queries
    return html`
      <div class="app shell">
        <div id="hold-container"></div>
        <div id="game-canvas"></div>
        <div id="preview-container"></div>
        <div id="stats-panel"></div>
        <div id="finesse-overlay"></div>
        <div id="settings-modal-root"></div>
      </div>
    `;
  }
}
```

Acceptance:
- App renders exactly as before (all legacy renderers still active).
- `npm run pre-commit` passes.

Notes:
- No state/signals yet; no component migrations yet. This phase is reversible by restoring the original `<main>` markup.

---

## Phase 2 — Signals Foundation

Goal: introduce a reactive state signal that mirrors the reducer state without changing UI behavior yet.

Scope:
- Add: `src/state/signals.ts` exporting `gameStateSignal` and `dispatch` wrapper.
- Modify: `src/main.ts` to initialize the signal with the initial reducer state.
- Modify: `src/app.ts` to publish state updates to the signal (in parallel with existing logic).

Files/refs:
- Reducer/types: `src/state/reducer.ts`, `src/state/types.ts`.
- App orchestrator: `src/app.ts`.

Plan:
- Implement a pure wrapper that updates the signal via the reducer (immutably):
```ts
// src/state/signals.ts
import {signal} from '@lit-labs/signals';
import {reducer} from '../state/reducer';
import type {Action, GameState} from '../state/types';

export const gameStateSignal = signal<GameState>(undefined as unknown as GameState);

export function dispatch(action: Action) {
  const prev = gameStateSignal.value;
  gameStateSignal.value = reducer(prev, action);
}
```
- In `src/main.ts`, set `gameStateSignal.value` to the initial state created the same way `app.ts` does today (no double-init; app and signal must share the same single source of truth per tick).
- In `src/app.ts`, where actions are currently dispatched, mirror them via the new `dispatch` (or refactor `app.ts`’s internal dispatch to call the signal wrapper) while keeping all legacy renderers.

Acceptance:
- No visual change yet; state updates flow into the signal without consumers.
- `npm run pre-commit` passes.

Notes:
- Keep reducers pure; do not embed timers/IO in signals.

---

## Phase 3 — Migrate Board to Lit

Goal: replace the legacy canvas renderer wiring with a Lit `<game-board>` that wraps `src/ui/canvas.ts` and reacts to `gameStateSignal`.

Scope:
- Add: `src/ui/components/game-board.tsx`.
- Modify: `src/ui/components/finessimo-shell.tsx` to render `<game-board>` instead of the legacy `#game-canvas` div.
- Modify: `src/app.ts` to remove `BasicCanvasRenderer` ownership; rely on signal updates.

Files/refs:
- Canvas renderer: `src/ui/canvas.ts`.
- State: `src/state/signals.ts`.

Plan:
- Implement the component to own a `<canvas>` in shadow DOM and delegate draw ops to the existing canvas renderer, calling it inside `updated()` when relevant state changes.
- Subscribe to `gameStateSignal` (pull on render), ensuring minimal redraws.
- Remove `app.ts` direct canvas renderer lifecycle; the game loop stays unchanged, dispatching actions that update state → signal → component.

Sketch:
```ts
// src/ui/components/game-board.tsx
import {LitElement, html} from 'lit';
import {customElement, query} from 'lit/decorators.js';
import {gameStateSignal} from '../../state/signals';
import {BasicCanvasRenderer} from '../canvas';

@customElement('game-board')
export class GameBoard extends LitElement {
  @query('canvas') private canvas!: HTMLCanvasElement;
  private renderer?: BasicCanvasRenderer;
  protected firstUpdated() {
    this.renderer = new BasicCanvasRenderer(this.canvas);
  }
  protected updated() {
    const state = gameStateSignal.value; // reactive read
    this.renderer?.render(state);
  }
  protected render() { return html`<canvas></canvas>`; }
}
```

Acceptance:
- Board draws and updates via signal-driven renders.
- No regressions in input/engine behavior.
- `npm run pre-commit` passes.

---

## Phase 4 — Migrate Finesse Overlay

Goal: move `src/ui/finesse-feedback.ts` logic into `<finesse-overlay>` Lit component.

Scope:
- Add: `src/ui/components/finesse-overlay.tsx`.
- Modify: shell to include `<finesse-overlay>` and remove the legacy `#finesse-overlay` container.
- Modify: `src/app.ts` to drop finesse overlay wiring.

Files/refs:
- `src/ui/finesse-feedback.ts` (animations/visibility), `src/state/signals.ts`.

Plan:
- Render finesse prompts/reactive visibility via JSX; wire CSS transitions scoped to the component.
- Subscribe to the finesse-related slice (feedback, guidance, mode prompt).

Acceptance:
- Overlay displays/animates as before; no console errors.
- `npm run pre-commit` passes.

---

## Phase 5 — Migrate Hold + Preview

Goal: replace `src/ui/hold.ts` and `src/ui/preview.ts` with Lit components.

Scope:
- Add: `src/ui/components/piece-hold.tsx`, `src/ui/components/piece-preview.tsx`.
- Modify: shell to include these components; remove legacy containers.
- Modify: `src/app.ts` to drop hold/preview renderer ownership.

Files/refs:
- `src/ui/hold.ts`, `src/ui/preview.ts`, `src/state/signals.ts`.

Plan:
- Wrap existing canvas logic; update only when relevant state (hold piece, canHold, nextQueue) changes.
- Implement disabled visualization (slash overlay) in the hold component.

Acceptance:
- Hold/preview behave correctly with reactive updates.
- `npm run pre-commit` passes.

---

## Phase 6 — Migrate Stats Panel

Goal: render stats via JSX in `<stats-panel>` with derived formatting methods.

Scope:
- Add: `src/ui/components/stats-panel.tsx`.
- Modify: shell to include the component; remove legacy stats container.
- Modify: `src/app.ts` to drop statistics DOM updates.

Files/refs:
- `src/ui/statistics.ts` (formatting, sections), `src/state/signals.ts`.

Plan:
- Convert imperative DOM updates to declarative JSX mapped from `gameStateSignal.value.stats`.
- Maintain styling parity and responsive layout.

Acceptance:
- Stats values update consistently; no mismatches in derived metrics.
- `npm run pre-commit` passes.

---

## Phase 7 — Migrate Settings Modal

Goal: port `src/ui/settings.ts` to `<settings-modal>` with Lit internal state and event-based settings change API.

Scope:
- Add: `src/ui/components/settings-modal.tsx`.
- Modify: shell to manage visibility and listen for modal events.
- Modify: `src/app.ts` to listen for `settings-change` and dispatch reducer updates.

Files/refs:
- `src/ui/settings.ts`, `src/input/keyboard.ts`, `src/state/signals.ts`.

Plan:
- Implement tab switching, keybinding capture, validation; persist to `localStorage`.
- Emit a custom event for changes:
```ts
this.dispatchEvent(new CustomEvent('settings-change', {detail: updatedSettings, bubbles: true, composed: true}));
```
- In `app.ts`, add a top-level listener and dispatch an `UpdateSettings` action into the reducer/signal.

Acceptance:
- Settings open/close, keybinding capture works, settings persist, and changes affect gameplay.
- `npm run pre-commit` passes.

---

## Phase 8 — Shell + CSS Finalization

Goal: finish the root shell layout and adapt global CSS for shadow DOM while preserving visual identity.

Scope:
- Modify: `src/ui/components/finessimo-shell.tsx` to orchestrate child components and responsive layout.
- Modify: `src/ui/styles.css` to add `:host`, `::part()`, and CSS custom property plumbing as needed.

Files/refs:
- `src/ui/styles.css`, all new Lit components.

Plan:
- Move layout concerns (grid/columns) to the shell; keep component styles scoped.
- Ensure design tokens (e.g., `--bg`, `--primary`) flow into shadow DOM via CSS variables.
- Keep modal overlays styled from global scope if needed.

Acceptance:
- Visual parity with legacy UI; responsive behavior validated.
- `npm run pre-commit` passes.

---

## Phase 9 — App/Main Consolidation and Cleanup

Goal: make `FinessimoApp` a lean coordinator, fully signal-driven, and remove obsolete legacy UI code.

Scope:
- Modify: `src/app.ts` to remove all direct DOM element queries and legacy renderer management.
- Modify: `src/main.ts` to register all custom elements before bootstrapping and to initialize signals cleanly.
- Remove (or deprecate) legacy renderers now replaced by Lit components, keeping canvas helpers where still used.
- Update docs: `FILES.md` to reflect the new component-based UI structure.

Files/refs:
- `src/app.ts`, `src/main.ts`, `src/ui/*.ts` legacy files.

Plan:
- Verify all components subscribe to signals; `app.ts` dispatches only actions and handles input handlers’ side-effects.
- Remove any remaining legacy DOM mutation paths.
- Delete or archive superseded UI files (e.g., `statistics.ts`, `settings.ts`, `finesse-feedback.ts`, `hud.ts`) once feature parity is confirmed and tests adjusted.

Acceptance:
- Clean build, no dead code imports, no unused references.
- `npm run pre-commit` passes; documentation updated.

---

## Testing and Lint Strategy per Phase

- Type-safety: no TS/ESLint suppressions; fix types at the source.
- Reducer determinism: unit tests for reducers remain unchanged; only UI tests get updated as components migrate.
- UI behavior: smoke tests target public DOM of components (not shadow-internals) where possible; use events and state to validate behavior.
- Performance sanity: ensure no excessive renders on signals updates (spot-check via console instrumentation or basic perf marks).

---

## Risks and Mitigations

- Tooling churn (JSX + plugins): introduce in Phase 1 and stabilize before UI migrations.
- Shadow DOM styling gaps: address in Phase 8 with `:host`/`::part()` and CSS variables.
- State duplication: avoided by driving all state via `gameStateSignal` before components land.
- Input side-effects in components: prohibited; keep them in `src/input/*` and lift events to `app.ts`.

---

## Checklist (apply per phase)

- Update/created files match the phase scope.
- Run `npm run pre-commit` and ensure green.
- Launch app; verify no console errors and expected UI is interactive.
- If a legacy UI file is fully replaced, update `FILES.md` accordingly.
