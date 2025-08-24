import { KeyAction, ActivePiece, GameplayConfig, Rot } from "../state/types";
import { createEmptyBoard, canMove, moveToWall } from "../core/board";
import { getNextRotation, tryRotate } from "../core/srs";

// Finesse calculation result
export interface FinesseResult {
  optimalSequences: KeyAction[][]; // Can be multiple paths of the same length
  playerSequence: KeyAction[]; // normalized
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

// Finesse Calculator interface
export interface FinesseCalculator {
  // Calculate optimal finesse for placing a piece at target position
  calculateOptimal(
    piece: ActivePiece,
    targetX: number,
    targetRot: Rot,
    config: GameplayConfig,
  ): KeyAction[][];

  // Analyze player input for finesse optimality
  analyze(
    piece: ActivePiece,
    targetX: number,
    targetRot: Rot,
    playerInputs: KeyAction[],
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
  ): KeyAction[][] {
    void _config;
    // Use an empty board for finesse calculation (placement minimality is board-agnostic in trainer drills)
    const board = createEmptyBoard();

    interface Node {
      piece: ActivePiece;
      path: KeyAction[];
    }
    const start: Node = { piece, path: [] };
    const queue: Node[] = [start];
    const visited = new Set<string>();
    const results: KeyAction[][] = [];
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
          queue.push({ piece: next, path: [...path, "LeftDown"] });
        }
      }

      // 2) Tap Right
      if (canMove(board, cur, 1, 0)) {
        const next: ActivePiece = { ...cur, x: cur.x + 1 };
        const k = keyOf(next);
        if (!visited.has(k)) {
          visited.add(k);
          queue.push({ piece: next, path: [...path, "RightDown"] });
        }
      }

      // 3) Hold Left (move to left wall)
      {
        const walled = moveToWall(board, cur, -1);
        if (walled.x !== cur.x) {
          const k = keyOf(walled);
          if (!visited.has(k)) {
            visited.add(k);
            // Represent both tap and hold as the same counted input: key down
            queue.push({ piece: walled, path: [...path, "LeftDown"] });
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
            queue.push({ piece: walled, path: [...path, "RightDown"] });
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
    const uniq = new Map<string, KeyAction[]>();
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
    playerInputs: KeyAction[],
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

  // Simple input normalization: drop releases and soft drop ups
  private normalizeInputs(
    inputs: KeyAction[],
    _config: GameplayConfig,
  ): KeyAction[] {
    void _config;
    return inputs.filter(
      (a) => a !== "LeftUp" && a !== "RightUp" && a !== "SoftDropUp",
    );
  }
}

// Export a default instance
export const finesseCalculator = new BfsFinesseCalculator();
