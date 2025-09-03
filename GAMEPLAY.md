# Finessimo Gameplay & Board Rendering Refactor Plan

Purpose: refactor `src/ui/components/game-board.tsx` (904 LOC) into a small orchestration component backed by pure, strongly‑typed render modules. Preserve visuals and 60 Hz behavior; improve clarity, testability, and type safety.

Context
- Current responsibilities in `game-board.tsx`:
  - Canvas lifecycle and sizing (Lit component)
  - Grid/offscreen canvas caching
  - Board cell rendering and gradients
  - Active piece rendering with vertical tween
  - Overlay rendering (ghost/target/line‑flash/effect‑dot/column‑highlight)
  - Play area background + border
  - Change detection + signal wiring
- Constraints: 60 Hz redraw for smooth animations; overlays render in z‑order; vanish rows offset logic must be correct and efficient. Core logic remains pure (reducers/selectors).

Objectives
- Small, composable, pure functions for all drawing decisions and geometry.
- Keep side effects at the edges: the Lit element and a tiny grid/outline cache wrapper.
- Encode invariants with brands and ADTs to prevent grid/canvas coordinate mix‑ups.
- Exhaustive handling over overlay kinds; immutable inputs/outputs.

Architecture (types‑first)

Files introduced
- `src/ui/types/brands-render.ts` — brands for render space and viewport
- `src/ui/renderers/grid-cache.ts` — offscreen grid cache (edge; minimal side effects)
- `src/ui/renderers/tween.ts` — pure tween math/state
- `src/ui/renderers/cells.ts` — board + active piece cell drawing (pure)
- `src/ui/renderers/overlays.ts` — overlay render functions (pure, uses outline cache iface)
- `src/ui/renderers/viewport.ts` — background/border drawing (pure)

Core types (proposed)
```ts
// src/ui/types/brands-render.ts
import type { Brand } from "../../types/brands";

export type CellSizePx = Brand<number, "CellSizePx">;
export type BoardCols  = Brand<number, "BoardCols">;      // e.g., 10
export type VisibleRows = Brand<number, "VisibleRows">;    // e.g., 20
export type VanishRows = Brand<number, "VanishRows">;      // e.g., 2

export type PixelX = Brand<number, "PixelX">;
export type PixelY = Brand<number, "PixelY">;
export type CanvasCol = Brand<number, "CanvasCol">;        // grid col used for canvas space
export type CanvasRow = Brand<number, "CanvasRow">;        // grid row including vanish offset

export type BoardViewport = Readonly<{
  cols: BoardCols;
  visibleRows: VisibleRows;
  vanishRows: VanishRows;
  cell: CellSizePx;
}>;

// Constructors at the UI boundary
export const asCellSizePx = (n: number): CellSizePx => n as CellSizePx;
export const asBoardCols  = (n: number): BoardCols  => n as BoardCols;
export const asVisibleRows = (n: number): VisibleRows => n as VisibleRows;
export const asVanishRows = (n: number): VanishRows => n as VanishRows;
export const asPixelX = (n: number): PixelX => n as PixelX;
export const asPixelY = (n: number): PixelY => n as PixelY;
export const asCanvasCol = (n: number): CanvasCol => n as CanvasCol;
export const asCanvasRow = (n: number): CanvasRow => n as CanvasRow;

export const gridToCanvasRow = (yGrid: number, vanish: VanishRows): CanvasRow =>
  asCanvasRow(yGrid + (vanish as unknown as number));
```

Render frame model
```ts
// used across modules; avoids coupling to Lit component
import type { GameState, Board, ActivePiece } from "../../state/types";
import type { RenderOverlay } from "../../engine/ui/overlays";
import type { BoardViewport } from "../types/brands-render";

export type BoardRenderFrame = Readonly<{
  board: Board;
  active: GameState["active"]; // ActivePiece | null
  tick: GameState["tick"];
  overlays: ReadonlyArray<RenderOverlay>;
  viewport: BoardViewport;
}>;
```

Tween state (pure)
```ts
// src/ui/renderers/tween.ts
import type { ActivePiece } from "../../state/types";
import type { BoardViewport, PixelY } from "../types/brands-render";

export type TweenState = Readonly<{
  startTick?: number;           // undefined when idle
  magnitude?: 1 | 2 | 3;        // cells, capped to 3
}>;

export const advanceTween = (
  prev: ActivePiece | null,
  next: ActivePiece | null,
  tick: number,
  prevState: TweenState,
): TweenState => { /* pure; start only on downward moves >=1 */ return prevState; };

export const verticalOffsetPx = (
  tween: TweenState,
  tick: number,
  viewport: BoardViewport,
): PixelY => { /* easeOutQuad + quantize to int px */ return 0 as PixelY; };
```

Outline cache interface (pure to callers)
```ts
// provided by component; overlays only use this interface
import type { GridCell, OutlinePath } from "../utils/outlines";

export type OutlineCache = Readonly<{
  get: (cells: ReadonlyArray<GridCell>) => OutlinePath;
}>;
```

Render modules (pure APIs)
```ts
// src/ui/renderers/grid-cache.ts
import type { BoardViewport } from "../types/brands-render";

export type GridCache = Readonly<{
  drawGrid: (ctx: CanvasRenderingContext2D) => void; // draws cached grid at vanish offset
  dispose: () => void;
}>;

export const createGridCache = (viewport: BoardViewport): GridCache => ({
  drawGrid: () => {},
  dispose: () => {},
});

// src/ui/renderers/cells.ts
import type { Board, ActivePiece } from "../../state/types";
import type { BoardViewport, PixelX, PixelY } from "../types/brands-render";

export const getCellColor = (cellValue: number): string => "#ffffff";

export const renderBoardCells = (
  ctx: CanvasRenderingContext2D,
  board: Board,
  viewport: BoardViewport,
): void => {};

export const renderActivePieceCells = (
  ctx: CanvasRenderingContext2D,
  piece: ActivePiece,
  tick: number,
  viewport: BoardViewport,
  verticalOffsetPx: PixelY,
): void => {};

// src/ui/renderers/overlays.ts
import type { RenderOverlay } from "../../engine/ui/overlays";
import type { BoardViewport } from "../types/brands-render";
import type { OutlineCache } from "./types"; // or colocate the interface

export const renderOverlays = (
  ctx: CanvasRenderingContext2D,
  overlays: ReadonlyArray<RenderOverlay>,
  viewport: BoardViewport,
  outlineCache: OutlineCache,
): void => {};

// src/ui/renderers/viewport.ts
import type { BoardViewport } from "../types/brands-render";

export const drawPlayAreaBackground = (
  ctx: CanvasRenderingContext2D,
  viewport: BoardViewport,
): void => {};

export const drawPlayAreaBorder = (
  ctx: CanvasRenderingContext2D,
  viewport: BoardViewport,
): void => {};
```

GameBoard after refactor
- Orchestrator; owns only:
  - Canvas element/context and sizing
  - Construction of `viewport` brands from constants
  - `GridCache` instance and a thin outline cache (Map wrapper)
  - `TweenState` (read/write via pure helpers)
  - Pull state via signals and build a `BoardRenderFrame`
  - Call render modules in order

Call order (kept): background → overlays(z<1) → board → grid → border → overlays(z≥1) → active piece.

Function boundaries in GameBoard (post‑refactor)
```ts
// src/ui/components/game-board.tsx (sketch)
const viewport: BoardViewport = { cols, visibleRows, vanishRows, cell } as const;
const frame: BoardRenderFrame = { board, active, tick, overlays, viewport } as const;
tween = advanceTween(prevActive, frame.active, frame.tick, tween);

drawPlayAreaBackground(ctx, viewport);
renderOverlays(ctx, overlays.filter(o => o.z < 1), viewport, outlineCache);
renderBoardCells(ctx, frame.board, viewport);
gridCache.drawGrid(ctx);
drawPlayAreaBorder(ctx, viewport);
renderOverlays(ctx, overlays.filter(o => o.z >= 1), viewport, outlineCache);
if (frame.active) {
  const dyPx = verticalOffsetPx(tween, frame.tick, viewport);
  renderActivePieceCells(ctx, frame.active, frame.tick, viewport, dyPx);
}
```

Phased Plan

Phase 1 — Introduce render brands and viewport
- Goal: add `brands-render.ts` and `BoardRenderFrame` types; no behavior changes.
- Changes:
  - Create `src/ui/types/brands-render.ts` with brands and constructors.
  - Use local `BoardViewport` object inside `game-board.tsx` (only type‑level wiring).
  - Document invariants for grid↔canvas conversion.
- Files: `src/ui/components/game-board.tsx`, `src/ui/types/brands-render.ts`.

Phase 2 — Extract grid cache
- Goal: move offscreen grid logic to `grid-cache.ts` and consume from component.
- Changes: replace `getGridCanvas`/`drawGridToCanvas`/`drawGrid` with `createGridCache(viewport)` and `gridCache.drawGrid(ctx)`.
- Files: `src/ui/renderers/grid-cache.ts`, update `src/ui/components/game-board.tsx` imports/usage.

Phase 3 — Isolate tween logic
- Goal: replace component’s tween fields and methods with pure `TweenState` helpers.
- Changes: add `src/ui/renderers/tween.ts` and use `advanceTween`/`verticalOffsetPx` inside `updated()` and active piece draw.
- Files: `src/ui/renderers/tween.ts`, update `src/ui/components/game-board.tsx`.

Phase 4 — Extract board/active piece cell rendering
- Goal: move `renderBoard`, `renderActivePiece`, `drawCell`, `drawCellSimple`, `isWithinBounds`, `getCellColor` to `cells.ts`.
- Changes: expose `renderBoardCells`, `renderActivePieceCells`; pass `verticalOffsetPx` value to avoid hidden state.
- Files: `src/ui/renderers/cells.ts`, update `src/ui/components/game-board.tsx`.

Phase 5 — Extract overlays
- Goal: move all overlay methods and outline cache usage behind `renderOverlays`.
- Changes: implement `renderOverlays` with exhaustive switch per overlay kind; accept `OutlineCache` interface.
- Files: `src/ui/renderers/overlays.ts`, update `src/ui/components/game-board.tsx`.

Phase 6 — Extract viewport draws
- Goal: move `drawPlayAreaBackground` and `drawPlayAreaBorder` to `viewport.ts`.
- Files: `src/ui/renderers/viewport.ts`, update `src/ui/components/game-board.tsx`.

Phase 7 — Slim component + docs/tests/CI
- Goal: `game-board.tsx` ~200–250 LOC; orchestration‑only.
- Changes: remove now‑migrated methods; keep `hasStateChanged` and subscription glue; add unit/type tests.
- Files: `src/ui/components/game-board.tsx`, tests under `tests/ui/renderers/*`, update `FILES.md`.

Testing Strategy
- Type‑level (compile‑only):
  - `BoardViewport` brand usage; `BoardRenderFrame` fields readonly.
  - Exhaustive overlay `kind` handling (`renderOverlays`).
- Unit (pure):
  - `gridToCanvasRow` with multiple vanish rows; grid bounds filtering.
  - `advanceTween` start/idle transitions; `verticalOffsetPx` easing and integer quantization.
  - `getCellColor` returns stable colors for values 1..7.
  - Outline cache key stability for identical cell sets.
- Draw ordering (integration‑light):
  - Spy on `CanvasRenderingContext2D` to assert call ordering background→grid→border and z‑layering of overlays.

Acceptance Criteria
- `game-board.tsx` reduced to orchestration responsibilities only.
- All overlay kinds are handled exhaustively via a single entry point.
- Brands prevent mixing grid/canvas coordinates; no new TS/ESLint suppressions.
- Visual behavior matches current implementation (60 Hz, tween look/feel, z‑order).
- `npm run ci` passes; `FILES.md` lists new modules.

Risks & Mitigations
- Visual regressions: phase by phase switch‑over with manual verification after each phase.
- Performance: offscreen grid cache is preserved; outline caching kept; active piece tween remains quantized to integer pixels.
- Type noise: brands live in a dedicated `brands-render.ts`, keeping imports localized to UI renderers.

