import { gridCoordAsNumber } from "../../types/brands";

import type { GridCoord } from "../../types/brands";

/**
 * Pure geometry utilities for computing piece outlines.
 *
 * This module provides type-safe, pure functions for computing the outer
 * perimeter of a set of grid cells, used for rendering clean outlines
 * around tetromino shapes in guided mode.
 */

// Grid coordinate tuple as used by overlays
export type GridCell = readonly [GridCoord, GridCoord];

// Vertex at a cell boundary corner (integer grid corner)
export type BoundaryVertex = Readonly<{ x: number; y: number }>;

// Oriented edge on the perimeter (from → to)
export type OrientedEdge = Readonly<{
  from: BoundaryVertex;
  to: BoundaryVertex;
}>;

// A continuous closed outline path (polygon in grid space)
export type OutlinePath = ReadonlyArray<BoundaryVertex>;

// Options for drawing the outline
export type OutlineStyle = Readonly<{
  strokeColor: string;
  lineWidthPx: number;
  lineJoin?: CanvasLineJoin;
  lineCap?: CanvasLineCap;
}>;

/**
 * Create a canonical key for an edge that's orientation-independent.
 * Used for detecting and canceling shared internal edges.
 */
function edgeKey(v1: BoundaryVertex, v2: BoundaryVertex): string {
  // Sort vertices lexicographically to create canonical form
  const [min, max] =
    v1.y < v2.y || (v1.y === v2.y && v1.x < v2.x) ? [v1, v2] : [v2, v1];
  return `${String(min.x)},${String(min.y)}-${String(max.x)},${String(max.y)}`;
}

/**
 * Compute the outer perimeter oriented edges by canceling internal shared edges.
 *
 * For each cell, generates 4 CCW-oriented edges. Internal edges shared between
 * adjacent cells appear twice with opposite orientations and cancel out.
 * The remaining edges form the outer perimeter.
 */
export function computePerimeterEdges(
  cells: ReadonlyArray<GridCell>,
): ReadonlyArray<OrientedEdge> {
  // Map from canonical edge key to the oriented edge
  // When we see an edge twice, we remove it (internal edge)
  const edgeMap = new Map<string, OrientedEdge | null>();

  for (const [gridX, gridY] of cells) {
    const x = gridCoordAsNumber(gridX);
    const y = gridCoordAsNumber(gridY);

    // Generate 4 CCW-oriented edges for this cell
    const edges: ReadonlyArray<OrientedEdge> = [
      // Top edge: (x, y) → (x+1, y)
      { from: { x, y }, to: { x: x + 1, y } },
      // Right edge: (x+1, y) → (x+1, y+1)
      { from: { x: x + 1, y }, to: { x: x + 1, y: y + 1 } },
      // Bottom edge: (x+1, y+1) → (x, y+1)
      { from: { x: x + 1, y: y + 1 }, to: { x, y: y + 1 } },
      // Left edge: (x, y+1) → (x, y)
      { from: { x, y: y + 1 }, to: { x, y } },
    ];

    for (const edge of edges) {
      const key = edgeKey(edge.from, edge.to);

      if (edgeMap.has(key)) {
        // This edge was already seen (from adjacent cell)
        // Cancel it out by marking as null
        edgeMap.set(key, null);
      } else {
        // First time seeing this edge
        edgeMap.set(key, edge);
      }
    }
  }

  // Return only the non-canceled edges (perimeter edges)
  const perimeter: Array<OrientedEdge> = [];
  for (const edge of edgeMap.values()) {
    if (edge !== null) {
      perimeter.push(edge);
    }
  }

  return perimeter;
}

/**
 * Order oriented edges into one or more closed outline paths.
 *
 * Builds an adjacency structure and walks edges to form closed loops.
 * For tetromino shapes, this produces a single closed path.
 */
export function orderEdgesToPaths(
  edges: ReadonlyArray<OrientedEdge>,
): ReadonlyArray<OutlinePath> {
  if (edges.length === 0) {
    return [];
  }

  // Build adjacency map: from vertex → list of outgoing edges
  const adjacency = new Map<string, Array<OrientedEdge>>();

  for (const edge of edges) {
    const fromKey = `${String(edge.from.x)},${String(edge.from.y)}`;
    const existing = adjacency.get(fromKey) ?? [];
    adjacency.set(fromKey, [...existing, edge]);
  }

  const paths: Array<OutlinePath> = [];
  const visited = new Set<string>();

  // Process all edges to handle potentially disjoint shapes
  for (const [startKey] of adjacency) {
    if (visited.has(startKey)) {
      continue;
    }

    const path: Array<BoundaryVertex> = [];
    let currentKey = startKey;

    // Walk the edges to form a closed path
    for (;;) {
      visited.add(currentKey);

      const outgoing = adjacency.get(currentKey);
      if (outgoing === undefined || outgoing.length === 0) {
        break;
      }

      // For simple closed loops (tetrominoes), there's exactly one outgoing edge
      const edge = outgoing[0];
      if (!edge) {
        break;
      }
      path.push(edge.from);

      // Remove used edge to avoid cycles
      adjacency.set(currentKey, outgoing.slice(1));

      const nextKey = `${String(edge.to.x)},${String(edge.to.y)}`;

      // Check if we've completed the loop
      if (nextKey === startKey) {
        break;
      }

      currentKey = nextKey;
    }

    if (path.length > 0) {
      paths.push(path);
    }
  }

  return paths;
}

/**
 * Convenience function to compute complete outline paths from cells.
 * Combines perimeter edge computation and path ordering.
 */
export function computeOutlinePaths(
  cells: ReadonlyArray<GridCell>,
): ReadonlyArray<OutlinePath> {
  const edges = computePerimeterEdges(cells);
  return orderEdgesToPaths(edges);
}

/**
 * Generate a stable hash key for a set of cells.
 * Sorts cells to ensure order-invariant hashing.
 *
 * @param cells - The grid cells to hash
 * @returns A stable string key representing the cell set
 */
export function getCellsHash(cells: ReadonlyArray<GridCell>): string {
  if (cells.length === 0) return "empty";

  // Sort cells by x then y for stable ordering
  const sorted = [...cells].sort((a, b) => {
    const ax = gridCoordAsNumber(a[0]);
    const bx = gridCoordAsNumber(b[0]);
    if (ax !== bx) return ax - bx;

    const ay = gridCoordAsNumber(a[1]);
    const by = gridCoordAsNumber(b[1]);
    return ay - by;
  });

  // Create hash from all coordinates
  return sorted
    .map(
      ([x, y]) =>
        `${String(gridCoordAsNumber(x))},${String(gridCoordAsNumber(y))}`,
    )
    .join(";");
}

/**
 * Convert a single OutlinePath to a Path2D in pixel space.
 *
 * @param path - The outline path in grid coordinates
 * @param cellSize - The size of each cell in pixels
 * @returns A Path2D object ready for canvas rendering
 */
export function pathToPath2D(path: OutlinePath, cellSize: number): Path2D {
  const path2d = new Path2D();

  if (path.length === 0) {
    return path2d;
  }

  // Convert grid coordinates to pixel coordinates
  const toPixel = (v: BoundaryVertex): { x: number; y: number } => ({
    x: v.x * cellSize,
    y: v.y * cellSize,
  });

  const firstVertex = path[0];
  if (!firstVertex) {
    return path2d;
  }
  const first = toPixel(firstVertex);
  path2d.moveTo(first.x, first.y);

  for (let i = 1; i < path.length; i++) {
    const vertex = path[i];
    if (!vertex) {
      continue;
    }
    const pixelVertex = toPixel(vertex);
    path2d.lineTo(pixelVertex.x, pixelVertex.y);
  }

  path2d.closePath();
  return path2d;
}
