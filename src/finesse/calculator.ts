import { createEmptyBoard, canMove, moveToWall } from "../core/board";
import { getNextRotation, tryRotate } from "../core/srs";
import {
  type ActivePiece,
  type GameplayConfig,
  type Rot,
  type FinesseAction,
  type Action,
  type ProcessedAction,
  type Board,
} from "../state/types";
import { createGridCoord, gridCoordAsNumber } from "../types/brands";

// Finesse calculation result - discriminated union for type safety
export type FinesseResult =
  | {
      kind: "optimal";
      playerSequence: Array<FinesseAction>;
      optimalSequences: Array<Array<FinesseAction>>;
      faults?: never;
    }
  | {
      kind: "faulty";
      playerSequence: Array<FinesseAction>;
      optimalSequences: Array<Array<FinesseAction>>;
      faults: Array<Fault>;
    };

// Fault types for type safety
export type FaultType =
  | "extra_input"
  | "suboptimal_path"
  | "unnecessary_rotation"
  | "wrong_piece"
  | "wrong_target";

// Fault types (to be expanded in later iterations)
export type Fault = {
  type: FaultType;
  description: string;
  position?: number; // Index in the player sequence where fault occurs
};

// Exhaustive checking helper for compile-time safety
export function assertNever(x: never): never {
  throw new Error(`Unexpected FinesseResult variant: ${JSON.stringify(x)}`);
}

// Type guards for ergonomic narrowing
export const isOptimalResult = (
  r: FinesseResult,
): r is Extract<FinesseResult, { kind: "optimal" }> => r.kind === "optimal";

export const isFaultyResult = (
  r: FinesseResult,
): r is Extract<FinesseResult, { kind: "faulty" }> => r.kind === "faulty";

// Convert Actions to FinesseActions for analysis (with optimistic move filtering)
// Convert ProcessedActions to FinesseActions - simpler since ProcessedActions are already normalized
export function extractFinesseActionsFromProcessed(
  actions: ReadonlyArray<ProcessedAction>,
): Array<FinesseAction> {
  return actions
    .map((action): FinesseAction | undefined => {
      switch (action.kind) {
        case "TapMove":
        case "HoldMove":
        case "RepeatMove":
          return action.dir === -1 ? "MoveLeft" : "MoveRight";
        case "Rotate":
          return action.dir === "CW" ? "RotateCW" : "RotateCCW";
        case "SoftDrop":
          return action.on ? "SoftDrop" : undefined;
        case "HardDrop":
          return "HardDrop";
        default:
          return undefined;
      }
    })
    .filter((action): action is FinesseAction => action !== undefined);
}

export function extractFinesseActions(
  actions: Array<Action>,
): Array<FinesseAction> {
  // Create pairs of original actions and their converted finesse actions
  const actionPairs = actions
    .map((action, index) => ({
      finesse: convertSingleAction(action),
      index,
      original: action,
    }))
    .filter(
      (
        pair,
      ): pair is { finesse: FinesseAction; index: number; original: Action } =>
        pair.finesse !== undefined,
    );

  // Sliding window to filter out optimistic moves followed by DAS in same direction
  const result: Array<FinesseAction> = [];

  for (let i = 0; i < actionPairs.length; i++) {
    const current = actionPairs[i];
    if (!current) continue;

    // Check if this is an optimistic TapMove (only filter optimistic moves)
    if (current.original.type === "TapMove" && current.original.optimistic) {
      // Look at the next action pair to see if it's a DAS in the same direction
      const next = actionPairs[i + 1];

      const isDASInSameDirection =
        next &&
        next.original.type === "HoldMove" &&
        "dir" in next.original &&
        "dir" in current.original &&
        next.original.dir === current.original.dir &&
        (next.finesse === "DASLeft" || next.finesse === "DASRight");

      if (isDASInSameDirection === true) {
        // Skip this optimistic move - it will be followed by the DAS action
        continue;
      }
    }

    // Keep this action
    result.push(current.finesse);
  }

  return result;
}

// Convert single action with reduced complexity
function convertSingleAction(action: Action): FinesseAction | undefined {
  // Handle movement actions
  if (action.type === "TapMove") {
    return mapDirToMove(action.dir);
  }
  if (action.type === "HoldMove") {
    return mapDirToDAS(action.dir);
  }

  // Handle rotation actions
  if (action.type === "Rotate") {
    return action.dir === "CW" ? "RotateCW" : "RotateCCW";
  }

  // Handle drop actions
  if (action.type === "HardDrop") {
    return "HardDrop";
  }
  if (action.type === "SoftDrop") {
    return action.on ? "SoftDrop" : undefined;
  }

  // HoldStart, RepeatMove are just telemetry - ignore them for finesse analysis
  // All other actions are ignored
  return undefined;
}

// Helper to map direction to movement finesse actions
function mapDirToMove(dir: -1 | 0 | 1): FinesseAction | undefined {
  if (dir === -1) return "MoveLeft";
  if (dir === 1) return "MoveRight";
  return undefined; // dir === 0, no movement
}

// Helper to map direction to DAS finesse actions
function mapDirToDAS(dir: -1 | 0 | 1): FinesseAction | undefined {
  if (dir === -1) return "DASLeft";
  if (dir === 1) return "DASRight";
  return undefined; // dir === 0, no DAS movement
}

// Finesse Calculator interface
export type FinesseCalculator = {
  // Calculate optimal finesse for placing a piece at target position
  calculateOptimal(
    piece: ActivePiece,
    targetX: number,
    targetRot: Rot,
    config: GameplayConfig,
  ): Array<Array<FinesseAction>>;

  // Analyze player input for finesse optimality
  analyze(
    piece: ActivePiece,
    targetX: number,
    targetRot: Rot,
    playerInputs: Array<FinesseAction>,
    config: GameplayConfig,
  ): FinesseResult;
};

type BfsContext = {
  queue: Array<{ piece: ActivePiece; path: Array<FinesseAction> }>;
  visited: Set<string>;
  keyOf: (p: ActivePiece) => string;
};

// BFS-based implementation of the finesse calculator (empty board assumption)
export class BfsFinesseCalculator implements FinesseCalculator {
  calculateOptimal(
    piece: ActivePiece,
    targetX: number,
    targetRot: Rot,
    _config: GameplayConfig,
  ): Array<Array<FinesseAction>> {
    void _config;
    const board = createEmptyBoard();
    const results = this.performBfsSearch(piece, targetX, targetRot, board);
    return this.deduplicateSequences(results);
  }

  private performBfsSearch(
    startPiece: ActivePiece,
    targetX: number,
    targetRot: Rot,
    board: Board,
  ): Array<Array<FinesseAction>> {
    type Node = {
      piece: ActivePiece;
      path: Array<FinesseAction>;
    };

    const start: Node = { path: [], piece: startPiece };
    const queue: Array<Node> = [start];
    const visited = new Set<string>();
    const results: Array<Array<FinesseAction>> = [];
    let foundDepth: number | undefined;

    const keyOf = (p: ActivePiece): string =>
      `${String(p.x)},${String(p.y)},${p.rot}`;
    visited.add(keyOf(startPiece));

    while (queue.length > 0) {
      const shifted = queue.shift();
      if (!shifted) break;
      const { path, piece: cur } = shifted;

      // If we have found solutions, limit exploration to the same depth
      if (foundDepth !== undefined && path.length > foundDepth) break;

      // Check goal condition
      if (cur.x === targetX && cur.rot === targetRot) {
        results.push([...path, "HardDrop"]);
        foundDepth = path.length;
        continue;
      }

      this.exploreNeighbors(board, cur, path, { keyOf, queue, visited });
    }

    return results;
  }

  private exploreNeighbors(
    board: Board,
    cur: ActivePiece,
    path: Array<FinesseAction>,
    context: BfsContext,
  ): void {
    this.tryMove(board, cur, path, context, -1);
    this.tryMove(board, cur, path, context, 1);
    this.tryWallMove(board, cur, path, context, -1);
    this.tryWallMove(board, cur, path, context, 1);
    this.tryRotate(board, cur, path, context, "CW");
    this.tryRotate(board, cur, path, context, "CCW");
  }

  private tryMove(
    board: Board,
    cur: ActivePiece,
    path: Array<FinesseAction>,
    context: BfsContext,
    dir: -1 | 1,
  ): void {
    if (canMove(board, cur, dir, 0)) {
      const next: ActivePiece = {
        ...cur,
        x: createGridCoord(gridCoordAsNumber(cur.x) + dir),
      };
      const k = context.keyOf(next);
      if (!context.visited.has(k)) {
        context.visited.add(k);
        const action: FinesseAction = dir === -1 ? "MoveLeft" : "MoveRight";
        context.queue.push({ path: [...path, action], piece: next });
      }
    }
  }

  private tryWallMove(
    board: Board,
    cur: ActivePiece,
    path: Array<FinesseAction>,
    context: BfsContext,
    dir: -1 | 1,
  ): void {
    const walled = moveToWall(board, cur, dir);
    if (walled.x !== cur.x) {
      const k = context.keyOf(walled);
      if (!context.visited.has(k)) {
        context.visited.add(k);
        const action: FinesseAction = dir === -1 ? "DASLeft" : "DASRight";
        context.queue.push({ path: [...path, action], piece: walled });
      }
    }
  }

  private tryRotate(
    board: Board,
    cur: ActivePiece,
    path: Array<FinesseAction>,
    context: BfsContext,
    direction: "CW" | "CCW",
  ): void {
    const target = getNextRotation(cur.rot, direction);
    const rotated = tryRotate(cur, target, board);
    if (rotated) {
      const k = context.keyOf(rotated);
      if (!context.visited.has(k)) {
        context.visited.add(k);
        const action: FinesseAction =
          direction === "CW" ? "RotateCW" : "RotateCCW";
        context.queue.push({ path: [...path, action], piece: rotated });
      }
    }
  }

  private deduplicateSequences(
    results: Array<Array<FinesseAction>>,
  ): Array<Array<FinesseAction>> {
    const uniq = new Map<string, Array<FinesseAction>>();
    for (const seq of results) {
      const key = seq.join("|");
      if (!uniq.has(key)) uniq.set(key, seq);
    }
    return Array.from(uniq.values());
  }

  analyze(
    piece: ActivePiece,
    targetX: number,
    targetRot: Rot,
    playerInputs: Array<FinesseAction>,
    config: GameplayConfig,
  ): FinesseResult {
    // Skip finesse analysis if soft drop is detected
    if (playerInputs.includes("SoftDrop")) {
      return {
        kind: "optimal",
        optimalSequences: [],
        playerSequence: playerInputs,
      };
    }

    // Calculate optimal sequences (already includes HardDrop)
    const optimalSequences = this.calculateOptimal(
      piece,
      targetX,
      targetRot,
      config,
    );

    // Normalize player inputs (basic filter; full normalization handled elsewhere)
    const playerSequence = this.normalizeInputs(playerInputs, config);

    // Compare by length against optimal minimal length (handle empty safely for noUncheckedIndexedAccess)
    const minLen = optimalSequences.reduce(
      (min, seq) => Math.min(min, seq.length),
      Number.POSITIVE_INFINITY,
    );
    const optimalLength = minLen === Number.POSITIVE_INFINITY ? 0 : minLen;
    const playerLength = playerSequence.length;
    const isOptimal = playerLength === optimalLength;

    const faults: Array<Fault> = [];
    if (playerLength > optimalLength) {
      faults.push({
        description: `Used ${String(playerLength)} inputs instead of optimal ${String(optimalLength)}`,
        position: optimalLength,
        type: "extra_input",
      });
    } else if (playerLength < optimalLength) {
      faults.push({
        description: `Sequence incomplete or mismatched; expected ${String(optimalLength)} inputs`,
        position: playerLength,
        type: "suboptimal_path",
      });
    }

    // Return discriminated union based on fault analysis
    if (isOptimal && faults.length === 0) {
      return {
        kind: "optimal",
        optimalSequences,
        playerSequence,
      };
    } else {
      return {
        faults,
        kind: "faulty",
        optimalSequences,
        playerSequence,
      };
    }
  }

  // Input normalization: all FinesseActions are valid by design with clean architecture
  private normalizeInputs(
    inputs: Array<FinesseAction>,
    _config: GameplayConfig,
  ): Array<FinesseAction> {
    void _config;

    // With our clean architecture, all FinesseActions are already valid
    return inputs;
  }
}

// Export a default instance
export const finesseCalculator = new BfsFinesseCalculator();
