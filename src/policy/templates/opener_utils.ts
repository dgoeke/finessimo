import { gridCoordAsNumber } from "../../types/brands";

import type { GameState, PieceId, Rot } from "../../state/types";
import type { Placement } from "../types";

// ---------- Small math helpers ----------
const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// ---------- Piece footprint approximation (columns spanned) ----------
// SRS-consistent column widths per rotation for column-span approximation
const PIECE_WIDTH: Record<PieceId, Record<Rot, number>> = {
  I: { left: 1, right: 1, spawn: 4, two: 4 },
  J: { left: 2, right: 2, spawn: 3, two: 3 },
  L: { left: 2, right: 2, spawn: 3, two: 3 },
  O: { left: 2, right: 2, spawn: 2, two: 2 },
  S: { left: 2, right: 2, spawn: 3, two: 3 },
  T: { left: 2, right: 2, spawn: 3, two: 3 },
  Z: { left: 2, right: 2, spawn: 3, two: 3 },
};

function resolvedPieceIdForPlacement(
  p: Placement,
  s: GameState,
): PieceId | undefined {
  // Prefer explicit pieceId if your Placement carries it
  const explicit: PieceId | undefined = (p as { pieceId?: PieceId }).pieceId;
  if (explicit !== undefined) return explicit;

  if (p.useHold === true) {
    // If holding is used, we likely drop the hold piece (if present), else queue[0]
    if (s.hold !== undefined) return s.hold;
    if (s.nextQueue.length > 0) return s.nextQueue[0];
    return s.active?.id;
  }
  return s.active?.id;
}

function columnsSpanned(p: Placement, s: GameState): Array<number> {
  const start = gridCoordAsNumber(p.x);
  const pieceId = resolvedPieceIdForPlacement(p, s);
  if (pieceId === undefined) return [start]; // best-effort fallback

  const width = PIECE_WIDTH[pieceId][p.rot];
  const cols: Array<number> = [];
  for (let dx = 0; dx < width; dx++) {
    const cx = start + dx;
    if (cx >= 0 && cx < s.board.width) cols.push(cx);
  }
  return cols.length > 0 ? cols : [clamp(start, 0, s.board.width - 1)];
}

// ---------- Board features (cached per board fingerprint) ----------
type Features = {
  heights: Array<number>;
  maxHeight: number;
  meanHeight: number;
  bumpiness: number;
};

// Very cheap fingerprint for the current board state.
// If your board already exposes a hash/version, use that instead.
function boardFingerprint(s: GameState): string {
  // Include basic geometry in case multiple modes have different dims
  return `${s.board.width.toString()}x${s.board.height.toString()}|${s.board.vanishRows.toString()}|${s.board.cells.join(
    "",
  )}`;
}

const featuresCache = new Map<string, Features>();

function getFeatures(s: GameState): Features {
  const key = boardFingerprint(s);
  const cached = featuresCache.get(key);
  if (cached) return cached;

  const heights = computeColumnHeights(s);
  let bumpiness = 0;
  for (let x = 0; x < heights.length - 1; x++) {
    const current = heights[x] ?? 0;
    const next = heights[x + 1] ?? 0;
    bumpiness += Math.abs(current - next);
  }
  const maxHeight = heights.length > 0 ? Math.max(...heights) : 0;
  const meanHeight =
    heights.length > 0
      ? heights.reduce((a, b) => a + b, 0) / heights.length
      : 0;

  const f: Features = { bumpiness, heights, maxHeight, meanHeight };
  featuresCache.set(key, f);
  return f;
}

// (Re)export a clearer cache reset if you need to wire into your existing clearTemplateCache
export function clearOpenerUtilityCache(): void {
  featuresCache.clear();
}

// Column heights: counts occupied cells in each visible column.
function computeColumnHeights(s: GameState): Array<number> {
  const { cells, height, vanishRows, width } = s.board;
  const visRows = height - vanishRows;
  const out: Array<number> = new Array<number>(width).fill(0);

  for (let x = 0; x < width; x++) {
    // scan from top of visible area downward
    let h = 0;
    for (let y = 0; y < visRows; y++) {
      const idx = (y + vanishRows) * width + x;
      if (cells[idx] !== 0) {
        h = visRows - y; // e.g., if first block at y=vanishRows, height==visRows
        break;
      }
    }
    out[x] = h; // 0 if empty
  }
  return out;
}

// ---------- Local topology helpers (based on columns spanned) ----------
type Local = {
  xStart: number;
  xEnd: number;
  targetHeights: Array<number>;
  leftNeighbor: number;
  rightNeighbor: number;
  minTarget: number;
  maxTarget: number;
};

function localTopology(p: Placement, s: GameState, feats: Features): Local {
  const cols = columnsSpanned(p, s);
  const targetHeights = cols.map((cx) => feats.heights[cx] ?? 0);
  const xStart = Math.min(...cols);
  const xEnd = Math.max(...cols);
  const leftNeighbor: number =
    xStart > 0 ? (feats.heights[xStart - 1] ?? 0) : (targetHeights[0] ?? 0);
  const rightNeighbor: number =
    xEnd < feats.heights.length - 1
      ? (feats.heights[xEnd + 1] ?? 0)
      : (targetHeights[targetHeights.length - 1] ?? 0);
  const minTarget = targetHeights.length > 0 ? Math.min(...targetHeights) : 0;
  const maxTarget = targetHeights.length > 0 ? Math.max(...targetHeights) : 0;
  return {
    leftNeighbor,
    maxTarget,
    minTarget,
    rightNeighbor,
    targetHeights,
    xEnd,
    xStart,
  };
}

// ---------- Common baseline (applies to all openers) ----------
function baseUtility(p: Placement, s: GameState, feats: Features): number {
  const { maxHeight, meanHeight } = feats;
  const loc = localTopology(p, s, feats);
  const width = loc.xEnd - loc.xStart + 1;

  let u = 1.0;

  // Global danger: discourage stacking too high
  if (maxHeight >= 18) u -= 1.2;
  else if (maxHeight >= 16) u -= 0.8;
  else if (maxHeight >= 14) u -= 0.4;

  // Edge friction: slight penalty at extreme edges, increases with height
  if (loc.xStart === 0 || loc.xEnd === s.board.width - 1) {
    u -= lerp(0.05, 0.2, clamp(maxHeight / 18, 0, 1));
  }

  // Local shape: prefer valley fill; avoid creating spikes
  const left = loc.leftNeighbor;
  const right = loc.rightNeighbor;
  const minT = loc.minTarget;
  const maxT = loc.maxTarget;
  const valleyBonus = (minT < left ? 0.15 : 0) + (minT < right ? 0.15 : 0);
  u += valleyBonus;

  const spikePenalty =
    (maxT > left + 2 ? 0.2 : 0) + (maxT > right + 2 ? 0.2 : 0);
  u -= spikePenalty;

  // Keep field relatively even around the landing zone
  const localMean = loc.targetHeights.reduce((a, b) => a + b, 0) / width;
  const localEvenness = 1 - clamp(Math.abs(localMean - meanHeight) / 6, 0, 1); // [0..1]
  u += 0.1 * localEvenness;

  // Light penalty for gratuitous hold usage
  if (p.useHold === true) u -= 0.05;

  return u;
}

// ---------- TKI utility helpers ----------

function calculateTkiCenterBandBonus(loc: Local, boardWidth: number): number {
  const xMid = (boardWidth - 1) / 2;
  const centerDist = Math.abs((loc.xStart + loc.xEnd) / 2 - xMid);
  return clamp(0.6 - 0.12 * centerDist, 0, 0.6);
}

function calculateTkiCenterHeightBonus(feats: Features): number {
  const centerCols = [3, 4, 5, 6].filter(
    (x) => x >= 0 && x < feats.heights.length,
  );
  const centerMax =
    centerCols.length > 0
      ? Math.max(...centerCols.map((x) => feats.heights[x] ?? 0))
      : feats.maxHeight;

  if (centerMax <= 6) return 0.15;
  if (centerMax >= 9) return -0.25;
  return 0;
}

function calculateTkiTPieceBonus(
  p: Placement,
  s: GameState,
  loc: Local,
): number {
  const piece = resolvedPieceIdForPlacement(p, s);
  if (piece === "T" && loc.xStart <= 4 && loc.xEnd >= 4) {
    return 0.2; // bonus if T covers column 4/5 region
  }
  return 0;
}

function calculateTkiIPieceBonus(p: Placement, s: GameState): number {
  const piece = resolvedPieceIdForPlacement(p, s);
  const earlyI =
    s.hold === "I" || s.nextQueue.slice(0, 3).includes("I") || piece === "I";
  return earlyI ? 0.1 : 0;
}

function calculateTkiSpikesPenalty(loc: Local): number {
  const left = loc.leftNeighbor;
  const right = loc.rightNeighbor;
  return (
    (loc.maxTarget > left + 2 ? 0.15 : 0) +
    (loc.maxTarget > right + 2 ? 0.15 : 0)
  );
}

function calculateTkiHoldBonus(p: Placement, s: GameState): number {
  if (
    p.useHold === true &&
    s.active &&
    s.active.id !== "T" &&
    s.active.id !== "I"
  ) {
    return 0.1;
  }
  return 0;
}

// ---------- TKI utility ----------
// Emphasis: central columns for T setups, avoid center spikes, gentle hold encouragement for I/T management.
export function tkiUtility(p: Placement, s: GameState): number {
  const feats = getFeatures(s);
  const loc = localTopology(p, s, feats);

  let u = baseUtility(p, s, feats);

  u += calculateTkiCenterBandBonus(loc, s.board.width);
  u += calculateTkiCenterHeightBonus(feats);
  u += calculateTkiTPieceBonus(p, s, loc);
  u += calculateTkiIPieceBonus(p, s);
  u -= calculateTkiSpikesPenalty(loc);
  u += calculateTkiHoldBonus(p, s);

  return u;
}

// ---------- PCO utility ----------
// Emphasis: flatness, low stack, gentle left-of-center bias for common PC patterns, strong anti-roughness.
export function pcoUtility(p: Placement, s: GameState): number {
  const feats = getFeatures(s);
  const loc = localTopology(p, s, feats);
  let u = baseUtility(p, s, feats);

  // Strong preference for low max height
  if (feats.maxHeight > 4) {
    u -= 0.5 + 0.1 * (feats.maxHeight - 4);
  } else u += 0.25;

  // Punish bumpiness; reward evenness around landing zone
  const evennessReward = clamp(1 - feats.bumpiness / 20, 0, 1); // [0..1]
  u += 0.4 * evennessReward;

  // Light left bias (helps many 4-wide-ish PC routes), but not the wall
  if (loc.xStart >= 1 && loc.xEnd <= 5) u += 0.15;

  // Penalize overhangs/spikes near the landing zone
  const left = loc.leftNeighbor;
  const right = loc.rightNeighbor;
  if (loc.maxTarget > left + 1) u -= 0.15;
  if (loc.maxTarget > right + 1) u -= 0.15;

  // Flatness around mean
  const localMean =
    loc.targetHeights.reduce((acc, height) => acc + height, 0) /
    Math.max(1, loc.xEnd - loc.xStart + 1);
  const flatness = 1 - clamp(Math.abs(localMean - feats.meanHeight) / 3, 0, 1);
  u += 0.2 * flatness;

  // Spawn rotation often optimal (avoid unnecessary twists for PC tables)
  if (p.rot === "spawn") u += 0.05;

  // Prefer not to use hold unless it clearly flattens
  if (p.useHold === true) u -= 0.05;

  return u;
}

// ---------- Safe utility helpers ----------

function isSafeOpening(feats: Features): boolean {
  const totalHeight = feats.heights.reduce((acc, height) => acc + height, 0);
  return feats.maxHeight <= 3 && totalHeight <= 6;
}

function calculateSafeOpeningBonus(loc: Local, boardWidth: number): number {
  let bonus = 0;
  if (loc.xStart >= 2 && loc.xEnd <= 7) bonus += 0.25;
  if (loc.xStart === 0 || loc.xEnd === boardWidth - 1) bonus -= 0.2;
  return bonus;
}

function calculateSafeMidgameBonus(feats: Features, loc: Local): number {
  let bonus = 0;
  if (feats.maxHeight > 15) bonus -= 0.8;
  else if (feats.maxHeight > 12) bonus -= 0.4;

  if (loc.xStart >= 2 && loc.xEnd <= 7) bonus += 0.1;
  return bonus;
}

function calculateSafeValleyFillBonus(loc: Local): number {
  const left = loc.leftNeighbor;
  const right = loc.rightNeighbor;
  let bonus = 0;
  if (loc.minTarget < Math.min(left, right)) bonus += 0.2;
  if (loc.maxTarget > Math.max(left, right) + 1) bonus -= 0.2;
  return bonus;
}

function calculateSafeEdgePenalty(loc: Local, boardWidth: number): number {
  return loc.xStart === 0 || loc.xEnd === boardWidth - 1 ? -0.1 : 0;
}

function calculateSafeHoldPenalty(p: Placement): number {
  return p.useHold === true ? -0.1 : 0;
}

// ---------- Safe ("Neither") utility ----------
// Emphasis: shape smoothing, valley fill, center-ish preference, strong height safety.
export function safeUtility(p: Placement, s: GameState): number {
  const feats = getFeatures(s);
  const loc = localTopology(p, s, feats);
  let u = baseUtility(p, s, feats);

  const isOpening = isSafeOpening(feats);

  if (isOpening) {
    u += calculateSafeOpeningBonus(loc, s.board.width);
  } else {
    u += calculateSafeMidgameBonus(feats, loc);
  }

  u += calculateSafeValleyFillBonus(loc);
  u += calculateSafeEdgePenalty(loc, s.board.width);
  u += calculateSafeHoldPenalty(p);

  return u;
}

// ---------- Optional: centralized weight knobs ----------
// If you want a single place to tweak behaviors, route through this table.
// Example:
//   export const openerUtility = (mode: "TKI"|"PCO"|"SAFE") => (p,s) => {
//      const scores = { TKI: tkiUtility(p,s), PCO: pcoUtility(p,s), SAFE: safeUtility(p,s) };
//      return scores[mode];
//   };
//
// For now we export the three functions directly above.
