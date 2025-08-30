## Big idea: split visuals into **Derived Overlays** vs **Ephemeral Effects**

* **Derived overlays (frame-based, pure)**
  Things that are true *right now* given state (ghost piece, targeted placements from a mode, hint outlines). These should be **selectors** (no dispatch, no TTL). They are recomputed every render.

* **Ephemeral effects (event-based, TTL)**
  Blips caused by actions (line flash, finesse “boop”, “perfect” sparkles). These go through `uiEffects` and your `pruneUiEffects` loop.

GameBoard renders **both** streams in a unified way.

---

## Step 1 — Define a render-model union for overlays

Create `src/engine/ui/overlays.ts`:

```ts
// src/engine/ui/overlays.ts
import type { PieceId } from "../../state/types";
import type { GridCoord } from "../../types/brands";

// z-order policy, highest last
export const Z = {
  board: 0,
  placed: 1,
  ghost: 2,
  target: 3,
  effect: 4,
  cursor: 5,
} as const;

export type GhostOverlay = {
  kind: "ghost";
  z: typeof Z.ghost;
  cells: ReadonlyArray<GridCoord>;       // board coords to draw
  pieceId: PieceId;
  opacity?: number;                      // 0..1
};

export type TargetOverlay = {
  kind: "target";
  z: typeof Z.target;
  cells: ReadonlyArray<GridCoord>;
  style: "glow" | "dashed" | "hint";
};

export type LineFlashOverlay = {
  kind: "line-flash";
  z: typeof Z.effect;
  rows: ReadonlyArray<number>;
};

export type EffectDotOverlay = {
  kind: "effect-dot";
  z: typeof Z.effect;
  at: GridCoord;
};

export type RenderOverlay =
  | GhostOverlay
  | TargetOverlay
  | LineFlashOverlay
  | EffectDotOverlay;
```

> Keep overlays small and declarative. `game-board.tsx` decides how to paint each `kind`.

---

## Step 2 — Map **engine** state → overlays (selectors)

Create `src/engine/selectors/overlays.ts`:

```ts
// src/engine/selectors/overlays.ts
import type { GameState } from "../../state/types";
import { isPlaying } from "../../state/types";
import { dropToBottom } from "../../core/board";
import { cellsForActivePiece } from "../util/cell-projection"; // tiny helper you likely already have
import type { RenderOverlay, GhostOverlay, TargetOverlay } from "../ui/overlays";

export function selectGhostOverlay(s: GameState): GhostOverlay | null {
  if (!isPlaying(s) || !s.gameplay.ghostPieceEnabled || !s.active) return null;
  const bottom = dropToBottom(s.board, s.active);
  return {
    kind: "ghost",
    z: 2,
    cells: cellsForActivePiece(bottom),
    pieceId: bottom.id,
    opacity: 0.35,
  };
}

/** Example: targets provided by a mode via s.modeData (pure read, no TTL) */
export function selectTargetOverlays(s: GameState): ReadonlyArray<TargetOverlay> {
  // Suppose certain modes populate s.modeData.targets: ReadonlyArray<GridCoord[]>
  const targets = Array.isArray((s as any).modeData?.targets) ? (s as any).modeData.targets as ReadonlyArray<ReadonlyArray<any>> : [];
  return targets.map((cells) => ({
    kind: "target",
    z: 3,
    cells,
    style: "glow" as const,
  }));
}

/** Combine derived overlays (frame-based, pure) */
export function selectDerivedOverlays(s: GameState): ReadonlyArray<RenderOverlay> {
  const overlays: RenderOverlay[] = [];
  const ghost = selectGhostOverlay(s);
  if (ghost) overlays.push(ghost);
  overlays.push(...selectTargetOverlays(s));
  // You can add more derived overlays here (cursor, guides, etc.)
  return overlays;
}
```

> Key point: **no dispatch** here. These are pure derivations; modes feed their *intent* via `modeData` (see Step 3).

---

## Step 3 — Move per-mode UI logic into **mode adapters**, not `app.ts`

Create a tiny interface and adapters, e.g. `src/modes/<mode>/ui.ts`:

```ts
// src/modes/types.ts
import type { GameState } from "../state/types";

export interface ModeUiAdapter {
  /** Set/clear *persistent* decorations in state (once per tick or when changed) */
  computeDecorations(state: GameState): { decorations: any | null } | null;

  /** Populate state.modeData.* fields needed by view selectors (pure mutation-free return) */
  computeDerivedUi(state: GameState): Partial<GameState["modeData"]> | null;
}
```

Example adapter for a “guided targets” mode:

```ts
// src/modes/guided/ui.ts
import type { ModeUiAdapter } from "../types";
import { computeTargetCellsForCurrentCard } from "./logic";

export const guidedUi: ModeUiAdapter = {
  computeDecorations(state) {
    // If you have board-wide static overlays, you can write them to boardDecorations
    // Else, return null to do nothing.
    return null;
  },
  computeDerivedUi(state) {
    const targets = computeTargetCellsForCurrentCard(state);
    return { targets }; // consumed by selectTargetOverlays
  },
};
```

Then update your main loop (formerly calling `updateModeUi`) to:

* Look up the adapter for `state.currentMode`.
* Get `computeDerivedUi` result and patch `modeData` via a simple reducer action (`UpdateModeData`).
* (Optionally) set persistent `boardDecorations` when adapters return them.

This removes ad-hoc draws from `app.ts`.

---

## Step 4 — Map **TTL `uiEffects`** → overlays (pure mapper)

Add a mapper that turns effect records into overlays for the board to render:

```ts
// src/engine/selectors/effects-to-overlays.ts
import type { GameState } from "../../state/types";
import type { RenderOverlay } from "../ui/overlays";

export function selectEffectOverlays(s: GameState): ReadonlyArray<RenderOverlay> {
  return s.uiEffects.map((e) => {
    switch (e.type) {
      case "line-flash":
        return { kind: "line-flash", z: 4, rows: e.payload.rows };
      case "finesse-boop":
        return { kind: "effect-dot", z: 4, at: e.payload.at };
      // add cases as your UiEffect union grows
      default:
        return null;
    }
  }).filter((x): x is RenderOverlay => x !== null);
}
```

---

## Step 5 — One **selector** to rule them all

Expose a final selector that the React board can consume:

```ts
// src/engine/selectors/board-render.ts
import type { GameState } from "../../state/types";
import type { RenderOverlay } from "../ui/overlays";
import { selectDerivedOverlays } from "./overlays";
import { selectEffectOverlays } from "./effects-to-overlays";

export type BoardRenderModel = Readonly<{
  overlays: ReadonlyArray<RenderOverlay>;
  // add anything else the board needs (grid, cells, etc.)
}>;

export function selectBoardRenderModel(s: GameState): BoardRenderModel {
  const overlays = [
    ...selectDerivedOverlays(s),
    ...selectEffectOverlays(s),
  ].sort((a, b) => a.z - b.z);
  return { overlays };
}
```

---

## Step 6 — Update `game-board.tsx` to consume the render model

```tsx
// src/ui/components/game-board.tsx
import React from "react";
import type { GameState } from "../../state/types";
import { selectBoardRenderModel } from "../../engine/selectors/board-render";

export function GameBoard({ state }: { state: GameState }) {
  const { overlays } = selectBoardRenderModel(state);

  return (
    <div className="board-root">
      {/* ... base board grid ... */}
      {overlays.map((o, i) => {
        switch (o.kind) {
          case "ghost":     return <GhostCells key={`g-${i}`} cells={o.cells} opacity={o.opacity ?? 0.35} />;
          case "target":    return <GlowCells  key={`t-${i}`} cells={o.cells} style={o.style} />;
          case "line-flash":return <LineFlash  key={`lf-${i}`} rows={o.rows} />;
          case "effect-dot":return <EffectDot  key={`ed-${i}`} at={o.at} />;
          default:          return null;
        }
      })}
    </div>
  );
}
```

> This keeps React rendering ignorant of engine internals; it just paints what the model says.

---

## Step 7 — Replace `updateModeUi` in `app.ts`

Where you previously did drawing, instead:

* Run the mode adapter for the current mode:

  * `dispatch({ type: "UpdateModeData", data: guidedUi.computeDerivedUi(state) })`
  * `dispatch({ type: "UpdateBoardDecorations", decorations: adapterDecorations })` (if needed)
* Don’t paint here; let `game-board.tsx` pick it up via selectors.

If you want to avoid dispatch churn, you can hold mode-derived data in a **separate view store** (React local state or context). But keeping it in `modeData` is fine and already matches your reducer.

---

## Step 8 — Optional niceties

* **Logical keys for effects**: add `key?: string` to `UiEffect` and a `pushOrReplaceEffectByKey` helper to prevent duplicates (e.g., one `line-flash` per line group).
* **Branded coords**: you’re already using `GridCoord`—great. Keep overlays using brands to avoid off-grid mistakes.
* **Perf**: add a memoizer around `selectBoardRenderModel(state)` if the board is heavy; your immutable state makes referential memoization effective.
* **BoardDecorations unification**: if `boardDecorations` overlaps with overlays, add a small mapper to convert decorations → overlays so `game-board.tsx` only deals with one concept.

---

## Why this doesn’t conflict with earlier phases

* Phases 1–12 were engine-focused. This plan is a **view-model layer** on top.
* You’re not changing reducer semantics; you’re just moving mode-specific draw logic out of `app.ts` and into:

  * **adapters** (to feed `modeData`/decorations), and
  * **selectors** (to compute renderable overlays).
* `uiEffects` stays the TTL stream; we’re just mapping those records to overlays for rendering.

---

## Minimal patch order

1. Add `ui/overlays.ts`.
2. Add selectors in `engine/selectors/overlays.ts`, `effects-to-overlays.ts`, `board-render.ts`.
3. Create a mode adapter for the mode currently using `updateModeUi` and switch `app.ts` to call it, writing to `UpdateModeData`/`UpdateBoardDecorations`.
4. Update `game-board.tsx` to paint from `selectBoardRenderModel`.
5. Remove mode-specific drawing from `updateModeUi`.

If you drop me a snippet of your current `updateModeUi` body, I can sketch the exact adapter + selector transformations for those visuals (1:1 mapping).
