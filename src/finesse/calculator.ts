// Refactored finesse/calculator.ts
// Drop-in replacement that preserves the public interface but adds:
// - Board-aware BFS (supports soft-drop under overhangs, T-spins, etc.)
// - Goal by final occupancy equality (not just x+rot), which naturally handles
//   rotation-direction differences (CW vs CCW) and symmetric rotations (O, I, S, Z)
// - Stronger typing + functional style helpers
//
// Public exports preserved: FinesseResult, Fault/FaultType, FinesseCalculator,
// finesseCalculator (instance), extractFinesseActionsFromProcessed, assertNever,
// isOptimalResult, isFaultyResult.

import {
  createEmptyBoard,
  canMove,
  moveToWall,
  dropToBottom,
} from "../core/board";
import { PIECES } from "../core/pieces";
import { getNextRotation, tryRotate } from "../core/srs";
import {
  type ActivePiece,
  type GameplayConfig,
  type Rot,
  type FinesseAction,
  type ProcessedAction,
  type Action,
  type Board,
} from "../state/types";
import { createGridCoord, gridCoordAsNumber } from "../types/brands";

// ---------- Result model (unchanged shape) ----------

export type FaultType =
  | "extra_input"
  | "suboptimal_path"
  | "unnecessary_rotation"
  | "wrong_piece"
  | "wrong_target";

export type Fault = {
  readonly type: FaultType;
  readonly description?: string;
  readonly position?: number; // index in player sequence (optional)
};

export type OptimalResult = {
  readonly kind: "optimal";
  readonly optimalSequences: Array<Array<FinesseAction>>;
  readonly playerSequence: Array<FinesseAction>;
};

export type FaultyResult = {
  readonly kind: "faulty";
  readonly faults: Array<Fault>;
  readonly optimalSequences: Array<Array<FinesseAction>>;
  readonly playerSequence: Array<FinesseAction>;
};

export type FinesseResult = OptimalResult | FaultyResult;

export function assertNever(x: never): never {
  throw new Error(`Unexpected FinesseResult variant: ${JSON.stringify(x)}`);
}

// Type guards
export const isOptimalResult = (
  r: unknown,
): r is Extract<FinesseResult, { kind: "optimal" }> =>
  typeof r === "object" &&
  r !== null &&
  (r as { kind?: unknown }).kind === "optimal";

export const isFaultyResult = (
  r: unknown,
): r is Extract<FinesseResult, { kind: "faulty" }> =>
  typeof r === "object" &&
  r !== null &&
  (r as { kind?: unknown }).kind === "faulty";

// ---------- Public calculator interface (unchanged) ----------

export type FinesseCalculator = {
  // Calculate optimal finesse for placing a piece at target position
  calculateOptimal(
    piece: ActivePiece,
    targetX: number,
    targetRot: Rot,
    config: GameplayConfig,
  ): Array<FinesseAction> | null;

  // Analyze player input for finesse optimality
  analyze(
    piece: ActivePiece,
    targetX: number,
    targetRot: Rot,
    playerInputs: Array<FinesseAction>,
    config: GameplayConfig,
  ): FinesseResult;
};

// ---------- Helpers ----------

// Key for visited states (immutable + branded numbers kept via accessors)
const keyOf = (p: ActivePiece): string =>
  `${p.id}|${p.rot}|${String(gridCoordAsNumber(p.x))}|${String(gridCoordAsNumber(p.y))}`;

// Absolute occupied cells for a piece
type Cell = readonly [number, number];

const absCells = (piece: ActivePiece): ReadonlyArray<Cell> => {
  const shape = PIECES[piece.id];
  const offsets: ReadonlyArray<readonly [number, number]> =
    shape.cells[piece.rot];
  const px = gridCoordAsNumber(piece.x);
  const py = gridCoordAsNumber(piece.y);
  return offsets.map(([dx, dy]) => [px + dx, py + dy] as const);
};

const sortedCellsKey = (cells: ReadonlyArray<Cell>): string =>
  cells
    .slice()
    .sort((a, b) => {
      const dy = a[1] - b[1];
      return dy === 0 ? a[0] - b[0] : dy;
    })
    .map(([x, y]) => `${String(x)},${String(y)}`)
    .join(";");

// Compute the final resting "occupancy key" for a piece on a board
const finalOccupancyKey = (board: Board, piece: ActivePiece): string => {
  const final = dropToBottom(board, piece);
  return sortedCellsKey(absCells(final));
};

// Generate neighbors with 1-input transitions
type Step = { readonly action: FinesseAction; readonly next: ActivePiece };

const neighbors = (board: Board, p: ActivePiece): ReadonlyArray<Step> => {
  const out: Array<Step> = [];
  const isEmptyBoard = board.cells.every((v) => v === 0);

  // Left/right (1 cell)
  if (canMove(board, p, -1, 0)) {
    out.push({
      action: "MoveLeft",
      next: { ...p, x: createGridCoord(gridCoordAsNumber(p.x) - 1) },
    });
  }
  if (canMove(board, p, 1, 0)) {
    out.push({
      action: "MoveRight",
      next: { ...p, x: createGridCoord(gridCoordAsNumber(p.x) + 1) },
    });
  }

  // DAS to wall
  const leftWall = moveToWall(board, p, -1);
  if (gridCoordAsNumber(leftWall.x) !== gridCoordAsNumber(p.x)) {
    out.push({ action: "DASLeft", next: leftWall });
  }
  const rightWall = moveToWall(board, p, 1);
  if (gridCoordAsNumber(rightWall.x) !== gridCoordAsNumber(p.x)) {
    out.push({ action: "DASRight", next: rightWall });
  }

  // Rotate CW / CCW (SRS kicks via tryRotate)
  const cwTarget = getNextRotation(p.rot, "CW");
  const cw = tryRotate(p, cwTarget, board);
  if (cw) out.push({ action: "RotateCW", next: cw });
  const ccwTarget = getNextRotation(p.rot, "CCW");
  const ccw = tryRotate(p, ccwTarget, board);
  if (ccw) out.push({ action: "RotateCCW", next: ccw });

  // Soft drop (1 cell) — only when board isn’t empty
  if (!isEmptyBoard && canMove(board, p, 0, 1)) {
    out.push({
      action: "SoftDrop",
      next: { ...p, y: createGridCoord(gridCoordAsNumber(p.y) + 1) },
    });
  }

  return out;
};

// (dedupeSequences removed; we cap to a single minimal solution now)

// Treat rotations with 180° symmetry as equivalent for goal orientation
// (kept for reference; goal test uses final-occupancy equality directly)

// ---------- Implementation ----------

class BoardAwareFinesseCalculator implements FinesseCalculator {
  // Overload: keep the 4-arg signature AND allow passing a board internally
  calculateOptimal(
    piece: ActivePiece,
    targetX: number,
    targetRot: Rot,
    _config: GameplayConfig,
    board?: Board,
  ): Array<FinesseAction> | null {
    // _config is currently unused; reserved for future tuning hooks
    const b = board ?? createEmptyBoard();

    // Define goal by final occupancy equality on the given board.
    const target: ActivePiece = {
      id: piece.id,
      rot: targetRot,
      x: createGridCoord(targetX),
      // start above the board so dropToBottom determines the y
      y: createGridCoord(-2),
    };
    const goalOccKey = finalOccupancyKey(b, target);
    const sols = this.searchMinimalSequences(b, piece, goalOccKey, targetRot);
    const first = sols[0];
    return first ? [...first] : null;
  }

  private searchMinimalSequences(
    b: Board,
    startPiece: ActivePiece,
    goalOccKey: string,
    targetRotStrict: Rot | null,
  ): Array<ReadonlyArray<FinesseAction>> {
    type Node = {
      readonly piece: ActivePiece;
      readonly path: ReadonlyArray<FinesseAction>;
    };

    // Safety caps to prevent pathological explosion in degenerate cases.
    const MAX_VISITS = 50000; // hard limit on dequeued nodes
    const MAX_SOLUTIONS = 1; // cap number of minimal solutions to collect (first minimal only)

    const start: Node = { path: [], piece: startPiece };
    const q: Array<Node> = [start];
    const bestDepthByState = new Map<string, number>();
    bestDepthByState.set(keyOf(startPiece), 0);
    let foundDepth: number | undefined;
    const solutions: Array<ReadonlyArray<FinesseAction>> = [];
    let visits = 0;

    const recordIfGoal = (node: Node, depth: number): boolean => {
      // Require final occupancy match; optionally require orientation when strict.
      if (targetRotStrict !== null && node.piece.rot !== targetRotStrict)
        return false;
      if (finalOccupancyKey(b, node.piece) !== goalOccKey) return false;
      solutions.push([...node.path, "HardDrop"]);
      foundDepth = depth;
      return solutions.length >= MAX_SOLUTIONS;
    };

    const shouldStop = (depth: number, visitCount: number): boolean =>
      (foundDepth !== undefined && depth > foundDepth) ||
      visitCount > MAX_VISITS;

    const enqueueIfBetter = (next: Node, depth: number): void => {
      const k = keyOf(next.piece);
      const prevBest = bestDepthByState.get(k);
      if (prevBest === undefined || depth + 1 < prevBest) {
        bestDepthByState.set(k, depth + 1);
        q.push(next);
      }
    };

    while (q.length > 0) {
      const cur = q.shift();
      if (!cur) break;
      const depth = cur.path.length;
      visits++;

      if (shouldStop(depth, visits)) break;
      if (recordIfGoal(cur, depth)) break;
      if (foundDepth !== undefined && depth >= foundDepth) continue;

      for (const step of neighbors(b, cur.piece)) {
        const next: Node = {
          path: [...cur.path, step.action],
          piece: step.next,
        };
        enqueueIfBetter(next, depth);
      }
    }

    return solutions;
  }

  analyze(
    piece: ActivePiece,
    targetX: number,
    targetRot: Rot,
    playerInputs: Array<FinesseAction>,
    _config: GameplayConfig,
  ): FinesseResult {
    // Bypass analysis when player used SoftDrop: we don't judge finesse in this case
    if (playerInputs.some((a) => a === "SoftDrop")) {
      return {
        kind: "optimal",
        optimalSequences: [],
        playerSequence: playerInputs,
      };
    }
    // _config is currently unused by analysis rules
    // NOTE: analyze uses occupancy-equivalent goals (ignore rotation) on an empty board.
    const empty = createEmptyBoard();
    const target: ActivePiece = {
      id: piece.id,
      rot: targetRot,
      x: createGridCoord(targetX),
      y: createGridCoord(-2),
    };
    const goalOccKey = finalOccupancyKey(empty, target);
    const optimalSequencesRaw = this.searchMinimalSequences(
      empty,
      piece,
      goalOccKey,
      null,
    );
    const optimalSequences: Array<Array<FinesseAction>> =
      optimalSequencesRaw.map((s) => [...s]);

    const optimalLen =
      optimalSequences.length === 0
        ? Number.POSITIVE_INFINITY
        : Math.min(...optimalSequences.map((s) => s.length));

    const playerLen = playerInputs.length;

    // Length-only optimality: if player used minimal number of inputs, accept as optimal
    if (playerLen === optimalLen) {
      return {
        kind: "optimal",
        optimalSequences,
        playerSequence: playerInputs,
      };
    }

    const faults: Array<Fault> = [];

    if (playerLen > optimalLen) {
      faults.push({
        description: `Used ${String(playerLen)} inputs; optimal is ${String(optimalLen)}.`,
        position: optimalLen,
        type: "extra_input",
      });
    } else if (playerLen < optimalLen) {
      faults.push({
        description: `Sequence incomplete or mismatched; expected ${String(optimalLen)} inputs.`,
        position: playerLen,
        type: "suboptimal_path",
      });
    }

    return {
      faults,
      kind: "faulty",
      optimalSequences,
      playerSequence: playerInputs,
    };
  }
}

// ---------- Input extraction (unchanged) ----------

export function extractFinesseActionsFromProcessed(
  actions: ReadonlyArray<ProcessedAction>,
): Array<FinesseAction> {
  return actions
    .map((action): FinesseAction | undefined => {
      switch (action.kind) {
        case "TapMove":
          return action.dir === -1 ? "MoveLeft" : "MoveRight";
        case "HoldMove":
          return action.dir === -1 ? "DASLeft" : "DASRight";
        case "RepeatMove":
          return undefined;
        case "Rotate":
          return action.dir === "CW" ? "RotateCW" : "RotateCCW";
        case "SoftDrop":
          return action.on ? "SoftDrop" : undefined;
        case "HardDrop":
          return "HardDrop";
      }
    })
    .filter((action): action is FinesseAction => action !== undefined);
}

// Public helper: extract finesse actions from raw Action stream
export function extractFinesseActions(
  actions: ReadonlyArray<Action>,
): Array<FinesseAction> {
  type RelevantAction = Extract<
    Action,
    | { type: "TapMove" }
    | { type: "HoldMove" }
    | { type: "RepeatMove" }
    | { type: "HoldStart" }
    | { type: "Rotate" }
    | { type: "SoftDrop" }
    | { type: "HardDrop" }
  >;

  const isRelevant = (a: Action): a is RelevantAction =>
    a.type === "TapMove" ||
    a.type === "HoldMove" ||
    a.type === "RepeatMove" ||
    a.type === "HoldStart" ||
    a.type === "Rotate" ||
    a.type === "SoftDrop" ||
    a.type === "HardDrop";

  // Pre-scan to filter optimistic taps that are followed by a hold-run in same dir
  const hasFollowingHoldStartSameDir = (idx: number): boolean => {
    const a = actions[idx];
    if (!a || a.type !== "TapMove" || !a.optimistic) return false;
    const dir = a.dir;
    for (let i = idx + 1; i < actions.length; i++) {
      const next = actions[i];
      if (!next) return false;
      if (next.type === "HoldStart" && next.dir === dir) return true;
      // Switching direction cancels the possibility
      if (
        (next.type === "TapMove" ||
          next.type === "HoldStart" ||
          next.type === "HoldMove") &&
        next.dir !== dir
      ) {
        return false;
      }
    }
    return false;
  };

  function mapNonTapNonSoft(
    a: Exclude<
      RelevantAction,
      Extract<Action, { type: "TapMove" | "SoftDrop" }>
    >,
  ): FinesseAction | undefined {
    switch (a.type) {
      case "HoldMove":
        return a.dir === -1 ? "DASLeft" : "DASRight";
      case "RepeatMove":
      case "HoldStart":
        return undefined; // only HoldMove represents DAS
      case "Rotate":
        return a.dir === "CW" ? "RotateCW" : "RotateCCW";
      case "HardDrop":
        return "HardDrop";
    }
  }

  const mapOne = (
    a: RelevantAction,
    idx: number,
  ): FinesseAction | undefined => {
    if (a.type === "TapMove") {
      if (a.optimistic && hasFollowingHoldStartSameDir(idx)) {
        return undefined;
      }
      return a.dir === -1 ? "MoveLeft" : "MoveRight";
    }
    if (a.type === "SoftDrop") {
      return a.on ? "SoftDrop" : undefined;
    }
    return mapNonTapNonSoft(a);
  };

  const out: Array<FinesseAction> = [];
  for (let i = 0; i < actions.length; i++) {
    const raw = actions[i];
    if (!raw || !isRelevant(raw)) continue;
    const mapped = mapOne(raw, i);
    if (mapped !== undefined) out.push(mapped);
  }
  return out;
}

// ---------- Export instance ----------

export const finesseCalculator = new BoardAwareFinesseCalculator();
