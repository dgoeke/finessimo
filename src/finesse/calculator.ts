import {
  ActivePiece,
  GameplayConfig,
  Rot,
  FinesseAction,
} from "../state/types";
import { createEmptyBoard, canMove, moveToWall } from "../core/board";
import { getNextRotation, tryRotate } from "../core/srs";
import type { Action } from "../state/types";

// Finesse calculation result
export interface FinesseResult {
  optimalSequences: FinesseAction[][]; // Can be multiple paths of the same length
  playerSequence: FinesseAction[]; // normalized from player input
  isOptimal: boolean;
  faults: Fault[]; // Fault type to be defined
}

// Fault types for type safety
export type FaultType =
  | "extra_input"
  | "suboptimal_path"
  | "unnecessary_rotation"
  | "wrong_piece"
  | "wrong_target";

// Fault types (to be expanded in later iterations)
export interface Fault {
  type: FaultType;
  description: string;
  position?: number; // Index in the player sequence where fault occurs
}

// Convert Actions to FinesseActions for analysis (with DAS coalescing)
export function extractFinesseActions(actions: Action[]): FinesseAction[] {
  // Helper for exhaustive type checking
  function assertNever(value: never): never {
    throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
  }

  // Helper to map direction to movement finesse actions
  function mapDirToMove(dir: number): FinesseAction | undefined {
    if (dir === -1) return "MoveLeft";
    if (dir === 1) return "MoveRight";
    // Debug log for invalid direction values
    if (dir !== 0) {
      console.debug(`mapDirToMove received invalid direction: ${dir}`);
    }
    return undefined;
  }

  // Helper to map direction to DAS finesse actions
  function mapDirToDAS(dir: number): FinesseAction | undefined {
    if (dir === -1) return "DASLeft";
    if (dir === 1) return "DASRight";
    // Debug log for invalid direction values
    if (dir !== 0) {
      console.debug(`mapDirToDAS received invalid direction: ${dir}`);
    }
    return undefined;
  }

  // Convert each action to its corresponding FinesseAction (or undefined if not relevant)
  const convertToFinesseAction = (
    action: Action,
  ): FinesseAction | undefined => {
    switch (action.type) {
      case "TapMove":
        return mapDirToMove(action.dir);
      case "HoldMove":
        return mapDirToDAS(action.dir);
      case "HoldStart":
      case "RepeatMove":
        return undefined;
      case "Rotate":
        return action.dir === "CW" ? "RotateCW" : "RotateCCW";
      case "HardDrop":
        return "HardDrop";
      case "Init":
      case "Tick":
      case "Spawn":
      case "SoftDrop":
      case "Hold":
      case "Lock":
      case "StartLockDelay":
      case "CancelLockDelay":
      case "StartLineClear":
      case "CompleteLineClear":
      case "ClearLines":
      case "SetMode":
      case "UpdateFinesseFeedback":
      case "UpdateModePrompt":
      case "UpdateTiming":
      case "UpdateGameplay":
      case "UpdateGuidance":
      case "UpdateModeData":
      case "RecordPieceLock":
      case "ClearInputLog":
        return undefined;
      default:
        return assertNever(action);
    }
  };

  return actions
    .map(convertToFinesseAction)
    .filter((action): action is FinesseAction => action !== undefined);
}

// Finesse Calculator interface
export interface FinesseCalculator {
  // Calculate optimal finesse for placing a piece at target position
  calculateOptimal(
    piece: ActivePiece,
    targetX: number,
    targetRot: Rot,
    config: GameplayConfig,
  ): FinesseAction[][];

  // Analyze player input for finesse optimality
  analyze(
    piece: ActivePiece,
    targetX: number,
    targetRot: Rot,
    playerInputs: FinesseAction[],
    config: GameplayConfig,
  ): FinesseResult;
}

// BFS-based implementation of the finesse calculator (empty board assumption)
export class BfsFinesseCalculator implements FinesseCalculator {
  calculateOptimal(
    piece: ActivePiece,
    targetX: number,
    targetRot: Rot,
    _config: GameplayConfig,
  ): FinesseAction[][] {
    void _config;
    // Use an empty board for finesse calculation (placement minimality is board-agnostic in trainer drills)
    const board = createEmptyBoard();

    interface Node {
      piece: ActivePiece;
      path: FinesseAction[];
    }
    const start: Node = { piece, path: [] };
    const queue: Node[] = [start];
    const visited = new Set<string>();
    const results: FinesseAction[][] = [];
    let foundDepth: number | undefined;

    const keyOf = (p: ActivePiece): string => `${p.x},${p.y},${p.rot}`;
    visited.add(keyOf(piece));

    while (queue.length) {
      const shifted = queue.shift();
      if (!shifted) break;
      const { piece: cur, path } = shifted;

      // If we have found solutions, limit exploration to the same depth
      if (foundDepth !== undefined && path.length > foundDepth) break;

      // Check goal condition (x and rot match). y is irrelevant for minimal input placement.
      if (cur.x === targetX && cur.rot === targetRot) {
        // Append hard drop as the final required input
        results.push([...path, "HardDrop"]);
        foundDepth = path.length; // first time sets minimal depth
        // Do not continue expanding this node; continue collecting other minimal solutions
        continue;
      }

      // Expand neighbors as player intents, each with cost 1
      // 1) Tap Left
      if (canMove(board, cur, -1, 0)) {
        const next: ActivePiece = { ...cur, x: cur.x - 1 };
        const k = keyOf(next);
        if (!visited.has(k)) {
          visited.add(k);
          queue.push({ piece: next, path: [...path, "MoveLeft"] });
        }
      }

      // 2) Tap Right
      if (canMove(board, cur, 1, 0)) {
        const next: ActivePiece = { ...cur, x: cur.x + 1 };
        const k = keyOf(next);
        if (!visited.has(k)) {
          visited.add(k);
          queue.push({ piece: next, path: [...path, "MoveRight"] });
        }
      }

      // 3) Hold Left (move to left wall)
      {
        const walled = moveToWall(board, cur, -1);
        if (walled.x !== cur.x) {
          const k = keyOf(walled);
          if (!visited.has(k)) {
            visited.add(k);
            // Wall movement using DAS
            queue.push({ piece: walled, path: [...path, "DASLeft"] });
          }
        }
      }

      // 4) Hold Right (move to right wall)
      {
        const walled = moveToWall(board, cur, 1);
        if (walled.x !== cur.x) {
          const k = keyOf(walled);
          if (!visited.has(k)) {
            visited.add(k);
            queue.push({ piece: walled, path: [...path, "DASRight"] });
          }
        }
      }

      // 5) Rotate CW
      {
        const target = getNextRotation(cur.rot, "CW");
        const rotated = tryRotate(cur, target, board);
        if (rotated) {
          const k = keyOf(rotated);
          if (!visited.has(k)) {
            visited.add(k);
            queue.push({ piece: rotated, path: [...path, "RotateCW"] });
          }
        }
      }

      // 6) Rotate CCW
      {
        const target = getNextRotation(cur.rot, "CCW");
        const rotated = tryRotate(cur, target, board);
        if (rotated) {
          const k = keyOf(rotated);
          if (!visited.has(k)) {
            visited.add(k);
            queue.push({ piece: rotated, path: [...path, "RotateCCW"] });
          }
        }
      }
    }

    // Deduplicate identical key sequences (hold vs tap can coincide)
    const uniq = new Map<string, FinesseAction[]>();
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
    playerInputs: FinesseAction[],
    config: GameplayConfig,
  ): FinesseResult {
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

    const faults: Fault[] = [];
    if (playerLength > optimalLength) {
      faults.push({
        type: "extra_input",
        description: `Used ${playerLength} inputs instead of optimal ${optimalLength}`,
        position: optimalLength,
      });
    } else if (playerLength < optimalLength) {
      faults.push({
        type: "suboptimal_path",
        description: `Sequence incomplete or mismatched; expected ${optimalLength} inputs`,
        position: playerLength,
      });
    }

    return {
      optimalSequences,
      playerSequence,
      isOptimal,
      faults,
    };
  }

  // Input normalization: all FinesseActions are valid by design with clean architecture
  private normalizeInputs(
    inputs: FinesseAction[],
    _config: GameplayConfig,
  ): FinesseAction[] {
    void _config;

    // With our clean architecture, all FinesseActions are already valid
    return inputs;
  }
}

// Export a default instance
export const finesseCalculator = new BfsFinesseCalculator();
