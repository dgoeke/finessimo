
// src/policy/search.ts
// Expectimax-lite / Beam fallback for "basic" mode (flat, low stack)
// Integrates with existing types and utilities in your repo.
//
// Design goals:
// - Deterministic and fast: depth 1–2 lookahead, small beam, no RNG mutation
// - Respect hold at root; ignore hold deeper for speed
// - Use your after-state scoring (opener_utils) + finesse cost
// - Pareto-prune (utility vs. finesse cost) and cluster for UI

import { canPlacePiece, dropToBottom, lockPiece, getCompletedLines, clearLines } from "../core/board";
import { PIECES } from "../core/pieces";
import { createActivePiece } from "../core/spawning";
import { tryRotate, getNextRotation } from "../core/srs";
import { gridCoordAsNumber, createGridCoord } from "../types/brands";

import { paretoFilter, clusterPlacements, calculateFinesseCost } from "./executor";
import { __debug as OpenersDebug } from "./templates/opener_utils";

import type { Placement, PlacementGroup } from "./types";
import type { GameState, Board, Rot, PieceId } from "../state/types";

// Reuse your opener after-state primitives for consistency

export type SearchConfig = Readonly<{
  depth: 1 | 2;
  beamWidth: number;        // candidates kept per ply
  maxPlacementsPerRot: number; // optional soft cap (post-prune)
  considerHoldAtRoot: boolean;
  betaFinesse: number;      // penalty multiplier for finesse fuel
  clusterForUi: boolean;
}>;

export const defaultSearchConfig: SearchConfig = {
  beamWidth: 8,
  betaFinesse: 0.12,
  clusterForUi: true,
  considerHoldAtRoot: true,
  depth: 2,
  maxPlacementsPerRot: 16,
};

export type SearchDiagnostics = Readonly<{
  explored: number;
  pruned: number;
  leafs: number;
  bestScore: number;
  secondBestScore: number;
}>;

export type SearchResult = Readonly<{
  best: Placement;
  alts: ReadonlyArray<Placement>;
  groups?: ReadonlyArray<PlacementGroup>;
  bestScore: number;
  secondBestScore: number;
  diag: SearchDiagnostics;
}>;

// ---------- Core helpers ----------

const ROTS: ReadonlyArray<Rot> = ["spawn", "right", "two", "left"] as const;

function rotateTo(board: Board, pieceId: PieceId, target: Rot) {
  // Start from spawn orientation; walk via SRS (90° steps) to target
  let p = createActivePiece(pieceId);
  // quick bailout if spawn cannot exist (rare at topout)
  if (!canPlacePiece(board, p)) return null;

  const dir = (from: Rot, to: Rot): Array<"CW" | "CCW"> => {
    // minimal 90° path (no direct 180°); just walk clockwise until equal
    const order: Array<Rot> = ["spawn", "right", "two", "left"];
    const idx = (r: Rot) => order.indexOf(r);
    const stepsCW = (idx(to) - idx(from) + 4) % 4;
    // Prefer CW unless 3 CCW is shorter than 1 CW (it never is), so CW is fine.
    return new Array(stepsCW).fill("CW");
  };

  for (const step of dir(p.rot, target)) {
    const nextRot = getNextRotation(p.rot, step);
    const rotated = tryRotate(p, nextRot, board);
    if (!rotated) return null; // blocked rotation path
    p = rotated;
  }
  return p;
}

function* enumerateFinalPlacements(board: Board, pieceId: PieceId): Generator<Placement> {
  const seen = new Set<string>();
  for (const rot of ROTS) {
    const base = rotateTo(board, pieceId, rot);
    if (!base) continue;

    // Generous scan bounds; canPlacePiece guards out-of-bounds
    for (let x = -2; x <= board.width + 1; x++) {
      const candidate = { ...base, x: createGridCoord(x) };
      if (!canPlacePiece(board, candidate)) continue;
      const dropped = dropToBottom(board, candidate);
      const key = `${rot}:${gridCoordAsNumber(dropped.x)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      yield { pieceId, rot: dropped.rot, x: dropped.x };
    }
  }
}

function applyPlacement(board: Board, pieceId: PieceId, p: Placement): Board {
  // Build an ActivePiece consistent with the final rot/x and drop it
  const rotated = rotateTo(board, pieceId, p.rot);
  if (!rotated) return board;
  const atX = { ...rotated, x: p.x };
  const dropped = canPlacePiece(board, atX) ? dropToBottom(board, atX) : atX;
  const locked = lockPiece(board, dropped);
  const cleared = getCompletedLines(locked);
  return clearLines(locked, cleared);
}

function afterStateUtility(board: Board): number {
  // Delegate to your opener_utils for a consistent base score
  // (flatness, holes, bumpiness, max well depth, etc.)
  return OpenersDebug.baseAfterStateScore(board);
}

// ---------- Search ----------

function scorePlacement(board: Board, p: Placement, betaFinesse: number): number {
  const nextBoard = applyPlacement(board, (p.pieceId!), p);
  const base = afterStateUtility(nextBoard);
  const finesse = calculateFinesseCost(p); // 0 = optimal, higher = worse
  return base - betaFinesse * finesse;
}

function sortDesc<T>(xs: ReadonlyArray<T>, f: (x: T) => number): Array<T> {
  return [...xs].sort((a, b) => f(b) - f(a));
}

function pickTop<T>(xs: ReadonlyArray<T>, n: number, f: (x: T) => number): Array<T> {
  if (xs.length <= n) return xs.slice();
  const sorted = sortDesc(xs, f);
  return sorted.slice(0, n);
}

function nextPieceAtDepth(state: GameState, depthIndex: number): ReadonlyArray<PieceId> {
  // Use preview when available; otherwise approximate with all 7
  // depthIndex 0 means "after current move", so take state.nextQueue[0] then [1], etc.
  const q = state.nextQueue;
  if (depthIndex < q.length) return [q[depthIndex]];
  return PIECES as unknown as ReadonlyArray<PieceId>;
}

export function suggestBySearch(
  state: GameState,
  cfg: SearchConfig = defaultSearchConfig,
): SearchResult {
  const board = state.board;
  const active = state.active?.id;
  if (!active) {
    // Not yet spawned; be inert
    const p: Placement = { rot: "spawn", x: createGridCoord(4) };
    return {
      alts: [],
      best: p,
      bestScore: 0,
      diag: { bestScore: 0, explored: 0, leafs: 0, pruned: 0, secondBestScore: 0 },
      groups: [],
      secondBestScore: 0,
    };
  }

  // Root candidates: use active, and (optionally) hold
  let rootPlacements: Array<Placement> = [];
  for (const p of enumerateFinalPlacements(board, active)) {
    rootPlacements.push(p);
  }

  if (cfg.considerHoldAtRoot && state.canHold) {
    const held = state.hold ?? state.nextQueue[0];
    if (held) {
      for (const p of enumerateFinalPlacements(board, held)) {
        rootPlacements.push({ ...p, pieceId: held, useHold: true });
      }
    }
  }

  // Attach pieceId when missing (active)
  rootPlacements = rootPlacements.map(p => p.pieceId ? p : { ...p, pieceId: p.useHold ? (p.pieceId as PieceId) : (active) });

  // Pareto-prune by (utility, finesse)
  const pruned = paretoFilter(
    rootPlacements,
    (p) => scorePlacement(board, p, cfg.betaFinesse),
    (p) => calculateFinesseCost(p),
  );

  // Keep a manageable beam
  const beam = pickTop(pruned, cfg.beamWidth, (p) => scorePlacement(board, p, cfg.betaFinesse));

  // Depth-2 lookahead: for each root candidate, evaluate expected value over next piece
  type BeamNode = { p: Placement; rootScore: number; lookahead: number };
  const nodes: Array<BeamNode> = [];
  for (const p of beam) {
    const s0 = scorePlacement(board, p, cfg.betaFinesse);
    let expected = 0;
    const nextPieces = nextPieceAtDepth(state, 0);
    if (cfg.depth === 1 || nextPieces.length === 0) {
      expected = s0;
    } else {
      // Average best response over plausible next piece(s)
      let accum = 0;
      for (const nxt of nextPieces) {
        const b1 = applyPlacement(board, (p.pieceId!), p);
        // NOTE: we ignore hold deeper for speed
        let bestNext = -Infinity;
        for (const q of enumerateFinalPlacements(b1, nxt)) {
          const s1 = scorePlacement(b1, q, cfg.betaFinesse);
          if (s1 > bestNext) bestNext = s1;
        }
        if (bestNext === -Infinity) bestNext = s0; // fallback
        accum += bestNext;
      }
      expected = 0.3 * s0 + 0.7 * (accum / nextPieces.length); // bias toward immediate stability
    }
    nodes.push({ lookahead: expected, p, rootScore: s0 });
  }

  // Pick best + alts
  const ranked = sortDesc(nodes, (n) => n.lookahead);
  const bestNode = ranked[0] ?? { lookahead: 0, p: beam[0], rootScore: 0 };
  const second = ranked[1]?.lookahead ?? (ranked[0]?.lookahead ?? 0);

  // UI clustering (group by rotation + contiguous x)
  const groups = cfg.clusterForUi
    ? clusterPlacements(
        ranked.map((n) => n.p),
        (p) => scorePlacement(board, p, cfg.betaFinesse),
        (p) => calculateFinesseCost(p),
      )
    : [];

  return {
    alts: ranked.slice(1, Math.min(4, ranked.length)).map((n) => n.p),
    best: bestNode.p!,
    bestScore: bestNode.lookahead,
    diag: {
      bestScore: bestNode.lookahead,
      explored: rootPlacements.length,
      leafs: ranked.length,
      pruned: rootPlacements.length - pruned.length,
      secondBestScore: second,
    },
    groups,
    secondBestScore: second,
  };
}
