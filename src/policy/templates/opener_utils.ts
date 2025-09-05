/* eslint-disable */
// src/policy/opener_utils_v2.ts
// After-state scoring utilities for opener policies (TKI / PCO / Safe).
//
// TODO: This file has many ESLint violations that need to be fixed when we finalize the implementation.
// For now we're iterating quickly on the logic.
//
// Key differences vs. pre-state heuristics:
// - Actually drops, stamps, and clears -> scores the *resulting* board.
// - Heavy penalties for holes and deep wells; modest rewards for line clears.
// - Small, bounded opener-specific nudges layered on a safe base score.
//
// This file is designed to work with the types you showed:
//   - GameState, ActivePiece, Rot, PieceId
//   - Placement { rot, x, useHold? }
//   - Board uses 1D `cells` with 0 = empty, non-zero = filled.
//   - `dropToBottom(board, piece)` and `canPlacePiece(board, piece)` are available.
//   - `GridCoord` helpers: createGridCoord, gridCoordAsNumber
//
// If your `Placement` includes `pieceId`, the utility will use it directly.
// If not, we resolve it best-effort via (useHold ? hold ?? nextQueue[0] : active.id).
//
// NOTE: The SRS block offsets below assume x/y are the top-left of the
// piece's *local* bounding box for each rotation. That matches many engines
// that expose a leftmost/topmost "origin". If your engine's origin differs
// for certain pieces (notably I), adjust OFFSETS to match your `dropToBottom`
// / `canPlacePiece` conventions.

import { canPlacePiece, dropToBottom } from "../../core/board";
import { createGridCoord, gridCoordAsNumber } from "../../types/brands";

import type { GameState, ActivePiece, Rot, PieceId } from "../../state/types";
import type { Placement } from "../types";

// -----------------------------------------------------------------------------
// SRS-ish block offsets per PieceId x Rot (top-left origin per rotation)
type XY = readonly [number, number];

const OFFSETS: Record<PieceId, Record<Rot, ReadonlyArray<XY>>> = {
  I: {
    left: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ],
    right: [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ],
    spawn: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    two: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
  },
  J: {
    //  .J
    //  .J
    //  JJ
    left: [
      [0, 2],
      [0, 1],
      [0, 0],
      [1, 2],
    ],
    //  .JJ
    //  .J
    //  .J
    right: [
      [1, 0],
      [2, 0],
      [1, 1],
      [1, 2],
    ],
    //  J..
    //  JJJ
    spawn: [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    //  JJJ
    //  ..J
    two: [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
  },
  L: {
    //  LL.
    //   L.
    //   L.
    left: [
      [0, 2],
      [1, 2],
      [1, 1],
      [1, 0],
    ],
    //  .L
    //  .L
    //  .LL
    right: [
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    //  ..L
    //  LLL
    spawn: [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    //  LLL
    //  L..
    two: [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
    ],
  },
  O: {
    left: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    right: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    spawn: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    two: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  },
  S: {
    //  S..
    //  SS.
    //  .S.
    left: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
    //  .S
    //  .SS
    //  ..S
    right: [
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    //  .SS
    //  SS.
    spawn: [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
    //  .SS
    //  SS.
    two: [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
  },
  T: {
    //  T.
    //  TT.
    //  T.
    left: [
      [0, 1],
      [1, 1],
      [0, 0],
      [0, 2],
    ],
    //  .T
    //  .TT
    //  .T
    right: [
      [1, 0],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    //  .T.
    //  TTT
    spawn: [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    //  TTT
    //   T
    two: [
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 1],
    ],
  },
  Z: {
    //  Z..
    //  ZZ.
    //  .Z.
    left: [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
    //  ..Z
    //  .ZZ
    //  .Z.
    right: [
      [2, 0],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    //  ZZ.
    //  .ZZ
    spawn: [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
    //  ZZ.
    //  .ZZ
    two: [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
  },
} as const;

// -----------------------------------------------------------------------------
// Helpers

function resolvedPieceIdForPlacement(
  p: Placement,
  s: GameState
): PieceId | undefined {
  // Prefer explicit p.pieceId if your Placement carries it
  const explicit: PieceId | undefined = 'pieceId' in p ? (p as any).pieceId : undefined;
  if (explicit) return explicit;

  if (p.useHold === true) {
    if (s.hold) return s.hold;
    if (s.nextQueue?.length) return s.nextQueue[0];
    return s.active?.id;
  }
  return s.active?.id;
}

function forEachBlock(
  piece: ActivePiece,
  fn: (gx: number, gy: number) => void
): void {
  const off = OFFSETS[piece.id][piece.rot];
  const baseX = gridCoordAsNumber(piece.x);
  const baseY = gridCoordAsNumber(piece.y);
  for (const [dx, dy] of off) {
    fn(baseX + dx, baseY + dy);
  }
}

function cloneCells(src: ReadonlyArray<number>): Array<number> {
  return Array.from(src);
}

function applyPiece(cells: Array<number>, s: GameState, piece: ActivePiece): void {
  forEachBlock(piece, (gx, gy) => {
    if (gx < 0 || gx >= s.board.width) return;
    if (
      gy + s.board.vanishRows < 0 ||
      gy + s.board.vanishRows >= s.board.height
    )
      return;
    const idx = (gy + s.board.vanishRows) * s.board.width + gx;
    cells[idx] = 1; // mark filled (color not important for heuristics)
  });
}

function clearFullRows(cells: Array<number>, s: GameState): number {
  const { height, width } = s.board;
  let dst = height - 1;
  let cleared = 0;

  for (let y = height - 1; y >= 0; y--) {
    let full = true;
    const rowStart = y * width;
    for (let x = 0; x < width; x++) {
      if (cells[rowStart + x] === 0) {
        full = false;
        break;
      }
    }
    if (!full || y < s.board.vanishRows) {
      // keep row
      if (dst !== y) {
        for (let x = 0; x < width; x++) {
          const srcCell = cells[rowStart + x];
          cells[dst * width + x] = srcCell ?? 0;
        }
      }
      dst--;
    } else {
      cleared++;
      // row removed (skip copy)
    }
  }
  // zero-fill above dst
  for (let y = dst; y >= 0; y--) {
    const rowStart = y * width;
    for (let x = 0; x < width; x++) cells[rowStart + x] = 0;
  }
  return cleared;
}

function computeColumnHeightsFromCells(
  cells: ReadonlyArray<number>,
  width: number,
  height: number,
  vanishRows: number
): Array<number> {
  const visRows = height - vanishRows;
  const out = new Array(width).fill(0);
  for (let x = 0; x < width; x++) {
    let h = 0;
    for (let y = 0; y < visRows; y++) {
      const idx = (y + vanishRows) * width + x;
      if (cells[idx] !== 0) {
        h = visRows - y;
        break;
      }
    }
    out[x] = h;
  }
  return out;
}

function countHoles(
  cells: ReadonlyArray<number>,
  width: number,
  height: number,
  vanishRows: number
): number {
  let holes = 0;
  for (let x = 0; x < width; x++) {
    let seen = false;
    for (let y = vanishRows; y < height; y++) {
      const idx = y * width + x;
      const filled = cells[idx] !== 0;
      if (filled) {
        seen = true;
      } else if (seen) {
        holes++;
      }
    }
  }
  return holes;
}

function maxWellDepth(heights: ReadonlyArray<number>): number {
  let maxDepth = 0;
  const n = heights.length;
  for (let x = 0; x < n; x++) {
    const left = x === 0 ? Number.MAX_SAFE_INTEGER : (heights[x - 1] ?? 0);
    const right = x === n - 1 ? Number.MAX_SAFE_INTEGER : (heights[x + 1] ?? 0);
    const currentHeight = heights[x] ?? 0;
    const wallMin = Math.min(left, right);
    if (wallMin > currentHeight) {
      maxDepth = Math.max(maxDepth, wallMin - currentHeight);
    }
  }
  return maxDepth;
}

type AfterFeatures = {
  heights: Array<number>;
  aggregateHeight: number;
  maxHeight: number;
  bumpiness: number;
  holes: number;
  maxWellDepth: number;
  linesCleared: number;
};

function analyzeAfterState(cells: Array<number>, s: GameState): AfterFeatures {
  const { height, vanishRows, width } = s.board;
  const heights = computeColumnHeightsFromCells(
    cells,
    width,
    height,
    vanishRows
  );
  const aggregateHeight = heights.reduce((a, b) => a + b, 0);
  const maxHeight = heights.length ? Math.max(...heights) : 0;
  let bumpiness = 0;
  for (let x = 0; x < heights.length - 1; x++) {
    const currentHeight = heights[x] ?? 0;
    const nextHeight = heights[x + 1] ?? 0;
    bumpiness += Math.abs(currentHeight - nextHeight);
  }
  const holes = countHoles(cells, width, height, vanishRows);
  const mwd = maxWellDepth(heights);
  return {
    aggregateHeight,
    bumpiness,
    heights,
    holes,
    linesCleared: 0,
    maxHeight,
    maxWellDepth: mwd,
  };
}

// -----------------------------------------------------------------------------
// Base score (El-Tetris style, tuned for opener safety). Higher is better.
function baseAfterStateScore(after: AfterFeatures): number {
  // Tune weights conservatively. Holes are most dangerous.
  const w = {
    aggregateHeight: -0.5,
    bumpiness: -0.22,
    holes: -2.4,
    linesCleared: 0.9,
    maxHeight: -0.35,
    maxWellDepth: -0.25,
  };
  return (
    w.aggregateHeight * after.aggregateHeight +
    w.bumpiness * after.bumpiness +
    w.holes * after.holes +
    w.maxHeight * after.maxHeight +
    w.maxWellDepth * after.maxWellDepth +
    w.linesCleared * after.linesCleared
  );
}

// Simulate placement -> after-state features (mutates a temp cells copy).
function simulateAfter(
  s: GameState,
  placement: Placement
): AfterFeatures | null {
  const id = resolvedPieceIdForPlacement(placement, s);
  if (!id || !s.active) return null;

  const piece: ActivePiece = {
    id,
    rot: placement.rot,
    x: placement.x,
    y: createGridCoord(0),
  };

  const dropped = dropToBottom(s.board, piece);
  if (!canPlacePiece(s.board, dropped)) return null;

  const scratch = cloneCells(Array.from(s.board.cells));
  applyPiece(scratch, s, dropped);
  const cleared = clearFullRows(scratch, s);
  const features = analyzeAfterState(scratch, s);
  features.linesCleared = cleared;
  return features;
}

// -----------------------------------------------------------------------------
// Opener-specific utilities (light nudges on top of base score).

function centerBias(
  _after: AfterFeatures,
  s: GameState,
  placement: Placement,
  maxBoost: number
): number {
  const xStart = gridCoordAsNumber(placement.x);
  // estimate center of footprint using OFFSETS bounds for this piece/rot
  const id = resolvedPieceIdForPlacement(placement, s);
  if (!id) return 0;
  const offs = OFFSETS[id][placement.rot];
  let minX = Infinity,
    maxX = -Infinity;
  for (const [dx] of offs) {
    minX = Math.min(minX, dx);
    maxX = Math.max(maxX, dx);
  }
  const width = maxX - minX + 1;
  const centerX = xStart + minX + (width - 1) / 2;
  const boardMid = (s.board.width - 1) / 2;
  const dist = Math.abs(centerX - boardMid);
  // triangular falloff to zero by ~4 cols
  return Math.max(0, maxBoost * (1 - dist / 4));
}

function earlyIAvailable(s: GameState, placement: Placement): boolean {
  const id = resolvedPieceIdForPlacement(placement, s);
  if (id === "I") return true;
  if (s.hold === "I") return true;
  const q = s.nextQueue ?? [];
  for (let i = 0; i < Math.min(3, q.length); i++) if (q[i] === "I") return true;
  return false;
}

export function tkiUtility(p: Placement, s: GameState): number {
  const after = simulateAfter(s, p);
  if (!after) return -Infinity;
  let score = baseAfterStateScore(after);

  // Gentle center encouragement
  score += centerBias(after, s, p, /*maxBoost*/ 0.15);

  // Early-I helps TKI branches; small bonus
  if (earlyIAvailable(s, p)) score += 0.08;

  // Without an imminent I, deep wells are dangerous for TKI
  if (!earlyIAvailable(s, p) && after.maxWellDepth >= 4) {
    score -= 0.3 * (after.maxWellDepth - 3);
  }

  // Slightly prefer not to use hold unless it clearly improves after-state
  if ('useHold' in p && p.useHold) score -= 0.03;

  return score;
}

export function pcoUtility(p: Placement, s: GameState): number {
  const after = simulateAfter(s, p);
  if (!after) return -Infinity;
  let score = baseAfterStateScore(after);

  // Flatness + low stack are critical
  const flatness = 1 - Math.min(1, after.bumpiness / 20);
  score += 0.35 * flatness;
  if (after.maxHeight <= 4) score += 0.25;
  else score -= 0.05 * (after.maxHeight - 4);

  // Tiny left-of-center nudge for common PC routes, but never the wall
  const leftBias =
    centerBias(after, s, p, 0.1) * (gridCoordAsNumber(p.x) <= 5 ? 1.0 : 0.5);
  score += leftBias;

  // Prefer not to use hold unless it flattened (already captured by base score);
  // add a small negative to break ties away from gratuitous holds.
  if ('useHold' in p && p.useHold) score -= 0.04;

  return score;
}

export function safeUtility(p: Placement, s: GameState): number {
  const after = simulateAfter(s, p);
  if (!after) return -Infinity;
  let score = baseAfterStateScore(after);

  // Opening detection: keep options open near center
  const isOpening = after.maxHeight <= 3 && after.aggregateHeight <= 6;
  if (isOpening) {
    score += centerBias(after, s, p, 0.12);
    // avoid hard walls
    const x = gridCoordAsNumber(p.x);
    if (x === 0 || x + 1 >= s.board.width) score -= 0.12;
  } else {
    // Midgame: avoid very tall stacks
    if (after.maxHeight > 15) score -= 0.6;
    else if (after.maxHeight > 12) score -= 0.3;
    // mild center-ish stability
    score += centerBias(after, s, p, 0.06);
  }

  // In safe mode we de-emphasize hold
  if ('useHold' in p && p.useHold) score -= 0.08;

  return score;
}

// Optional export if you want to unit test the primitives.
export const __debug = {
  baseAfterStateScore,
  computeColumnHeightsFromCells,
  countHoles,
  maxWellDepth,
  OFFSETS,
  simulateAfter,
};
