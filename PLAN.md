# Guided Target Piece Outline — Design Plan

Status: Draft
Owner: Finessimo (Guided Mode UI)
Scope: Target overlays rendering (guided mode)

## Problem Statement

In guided mode, we currently render the target placement as a set of highlighted cells, each with its own border. This produces busy visuals with grid-aligned borders around every cell. We want a single, thicker outline that traces the outside of the entire target piece while preserving the existing glow and core highlight per cell.

## Goals

- Render a single, thick border around the union of target cells (the piece silhouette).
- Keep existing glow and inner “core” fill per cell for anchor/visibility.
- Make the outline computation pure, deterministic, and testable.
- Integrate without changing mode data types (no schema churn).

## Non‑Goals

- Changing target overlay data structures (`TargetOverlay`) or guided mode data schema.
- Adding animations or changing color palette beyond the new outline stroke.
- Supporting arbitrary holes (not applicable to tetromino shapes).

## Current Architecture (relevant parts)

- Mode data to overlays:
  - `src/modes/guided/ui.ts → computeDerivedUi` builds `targets: TargetCell[][]` (one pattern per guided step).
  - `src/engine/selectors/overlays.ts → selectTargetOverlays` converts `TargetCell[]` to `TargetOverlay`.
- Rendering:
  - `src/ui/components/game-board.tsx → renderTargetOverlay` does two passes:
    1) glow per cell (`drawHighlightCellGlow`)
    2) border + inner core per cell (`drawHighlightCellBorderAndCore`)

We will adjust (2) to draw one perimeter outline path and keep only the inner core per cell.

## Design Overview

Compute the piece silhouette by treating each target cell as a unit square on the integer grid. For every cell, add its four CCW-oriented edges; remove edges that appear twice with opposite orientation (shared internal edges). The remaining oriented edges form the outer perimeter. Order the perimeter edges into a closed path and draw a single thick stroke on canvas. Continue to render the per-cell inner core rectangles for anchoring.

This approach is fast (O(n) in number of cells), pure, and produces exact outlines for concave tetromino shapes (Z, S, etc.).

## Types and Signatures (types-first)

We keep core data in grid coordinates (integers). Drawing converts to pixels using `cellSize`.

```ts
// Grid coordinate of cell indices used across the app
import type { GridCoord } from "./src/types/brands";

// A cell coordinate tuple [x, y] as used by overlays
export type GridCell = readonly [GridCoord, GridCoord];

// Vertex at a cell boundary corner (integer grid corner)
// Note: to keep friction low we represent boundary vertices as numbers locally
// (integers) and convert from GridCoord via gridCoordAsNumber().
export type BoundaryVertex = Readonly<{ x: number; y: number }>;

// Oriented edge on the perimeter (from → to)
export type OrientedEdge = Readonly<{ from: BoundaryVertex; to: BoundaryVertex }>;

// A continuous closed outline path (polygon in grid space)
export type OutlinePath = ReadonlyArray<BoundaryVertex>; // first vertex repeated at end is optional

// Options for drawing the outline
export type OutlineStyle = Readonly<{
  strokeColor: string;   // e.g., normalized overlay color or neutral gray
  lineWidthPx: number;   // e.g., Math.max(4, cellSize * 0.18)
  lineJoin?: CanvasLineJoin; // default: "miter"
  lineCap?: CanvasLineCap;   // default: "butt"
}>;
```

Pure utilities (no side effects):

```ts
// Compute the outer perimeter oriented edges by canceling internal shared edges
export function computePerimeterEdges(
  cells: ReadonlyArray<GridCell>,
): ReadonlyArray<OrientedEdge>;

// Order oriented edges into one or more closed outline paths (tetromino → 1 path)
export function orderEdgesToPaths(
  edges: ReadonlyArray<OrientedEdge>,
): ReadonlyArray<OutlinePath>;

// Convenience: compute complete outline paths from cells
export function computeOutlinePaths(
  cells: ReadonlyArray<GridCell>,
): ReadonlyArray<OutlinePath>;
```

Canvas integration (UI-only, side effects):

```ts
// Convert a single OutlinePath to a Path2D in pixel space (via cellSize)
export function pathToPath2D(
  path: OutlinePath,
  cellSize: number,
): Path2D;

// Draw all outline paths with the desired style
export function drawTargetPieceOutline(
  ctx: CanvasRenderingContext2D,
  cells: ReadonlyArray<GridCell>,
  cellSize: number,
  style: OutlineStyle,
): void;
```

Notes on brands and invariants:
- We keep the pure geometry over `number` for boundary vertices to avoid introducing a new brand for boundary corners (“CellBoundaryCoord”). Inputs are branded `GridCoord` at the boundary; outputs are integer numbers in grid-space corners. This is confined to the UI layer.
- All returned arrays are `readonly` to reinforce immutability.

## Algorithm Details

1) Oriented edge generation (CCW)
- For a cell at grid `(x, y)` with unit size 1, emit edges in counter‑clockwise order:
  - top:    (x, y)     → (x+1, y)
  - right:  (x+1, y)   → (x+1, y+1)
  - bottom: (x+1, y+1) → (x, y+1)
  - left:   (x, y+1)   → (x, y)

2) Cancel internal edges
- Use an undirected canonical key for an edge: `min(from,to) → max(from,to)`.
- Maintain a map from canonical key → oriented edge. When a second edge with the same canonical key appears (it will be opposite orientation for adjacent cells), remove/cancel it. The remaining set are perimeter oriented edges.

3) Stitch oriented edges into closed path(s)
- Build an adjacency map from `from` vertex → list of outgoing edges.
- Start at the lexicographically smallest vertex `(y, then x)` to get a stable start.
- Walk by repeatedly choosing the (only) outgoing edge; remove it from the adjacency to avoid cycles. Because tetromino perimeters are simple cycles, there is exactly one outgoing edge at each step.
- Continue until returning to the start vertex to close the loop. Result is an `OutlinePath`.
- In the general case of multiple disjoint shapes, repeat until all edges are consumed; guided targets use a single contiguous shape.

4) Convert to pixels and draw
- Convert `(gx, gy)` grid-space vertex to pixel: `(gx * cellSize, gy * cellSize)`.
- Build a `Path2D`, `moveTo` first vertex, `lineTo` others, and `closePath`.
- Configure stroke style:
  - `ctx.lineJoin = 'miter'` for crisp right angles (or `'round'` if preferred).
  - `ctx.lineCap = 'butt'`.
  - `ctx.lineWidth = max(4, cellSize * 0.18)`.
  - `ctx.strokeStyle = '#666666'` or a normalized `overlay.color` via existing color utils.
- `ctx.stroke(path)` once to draw the entire outline above the glow but below the active piece.

Complexity: O(n) edges, O(n) stitching; n ≤ 4 for tetromino cells (constant in practice). Negligible runtime.

## Integration Plan

Minimal surface area changes; no schema changes.

1) Utilities (pure)
- Option A (preferred): add `src/ui/utils/outlines.ts` with the pure geometry functions:
  - `computePerimeterEdges`, `orderEdgesToPaths`, `computeOutlinePaths`, `pathToPath2D`.
- Option B: keep small helpers private inside `game-board.tsx` (less reusable). Option A improves testability.

2) Renderer changes (`src/ui/components/game-board.tsx`)
- In `renderTargetOverlay`:
  - Keep pass 1 (glow) as-is.
  - Replace pass 2 per-cell border with:
    - `drawTargetPieceOutline(this.ctx, validCells, this.cellSize, style)`
    - Per cell: `drawHighlightCellCore(x, y, alpha)` (extracted from the existing `drawHighlightCellBorderAndCore` without the stroke portion).
- Add `drawHighlightCellCore(x, y, alpha)` private helper (copy the “Crisp inner core” block).

3) Visual defaults
- Outline `lineWidthPx = max(4, cellSize * 0.18)`.
- Outline `strokeColor = normalizeColorBrightness(color, 0.4)` or neutral `#666` to contrast on a dark grid.
- Respect existing `overlay.alpha` only for glow and core; outline stays fully opaque for clarity.

4) Z‑order
- No change. Target overlays keep `z: Z.target`. Outline draws in the same pass between glow and per‑cell core.

## Edge Cases and Invariants

- Single cell targets: produces a rectangle (works).
- Concave tetromino shapes (S/Z, J/L/T rotated): produces stepped outline as expected.
- Cells partially outside visible board: we already filter to `validCells` in `renderTargetOverlay`.
- Disjoint sets: not expected in guided mode today; the algorithm supports multiple cycles and would draw multiple outlines in order.
- No holes: tetrominoes have no holes; if future targets had holes, the cancel + orient approach still works and would produce inner cycles too (we could stroke both or ignore inner cycles depending on design).

## Testing Strategy

Type-level intents (compile-time):
- All helpers accept `ReadonlyArray` inputs and return `ReadonlyArray` outputs.

Unit tests (pure geometry): `tests/unit/ui/outlines.test.ts`
- O piece (2×2) → one rectangular path with 4 corners.
- Z piece → one concave path; verify vertex set and closed loop.
- Single cell → four edges, single rectangular path.
- Disjoint (optional) → two paths when given two separated cells.

Render sanity (integration):
- Smoke-test `drawTargetPieceOutline` with a mocked `CanvasRenderingContext2D` (spy on `stroke` and `lineWidth`).

## Rollout Steps

1) Add `src/ui/utils/outlines.ts` with pure helpers.
2) Update `src/ui/components/game-board.tsx`:
   - Add `drawHighlightCellCore`.
   - Switch pass 2 to outline + core.
3) Add unit tests for outline utilities.
4) Tune visuals (line width, color normalization) by eye.
5) Update `FILES.md` to document the new module.
6) Run `npm run pre-commit` and ensure green.

## Future Work (optional)

- Allow target `style: "outline" | "glow" | "hint"` to toggle outline variants explicitly.
- Reuse outline drawing for ghost or other overlays where an outside-only border improves clarity.
- Add subtle drop-shadow / outer glow around the outline for improved contrast on complex boards.

