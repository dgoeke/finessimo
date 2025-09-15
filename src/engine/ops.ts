import { createEmptyBoard, shiftUpAndInsertRow } from "@/engine/core/board";
import { createActivePiece } from "@/engine/core/spawning";
import {
  type BoardCells,
  type GameState,
  type PieceId,
  createCellValue,
} from "@/engine/types";

/**
 * Pure helpers that transform GameState for mode-controlled scenarios.
 * These DO NOT represent normal gameplay; they are used between ticks by modes.
 * Implementations should be deterministic and not mutate input state.
 */

export type EngineOp = (s: GameState) => GameState;

/** Replace the entire board with provided cells (row-major). */
export function withBoard(cells: BoardCells): EngineOp {
  return (s) => {
    return { ...s, board: { ...createEmptyBoard(), cells } };
  };
}

/** Replace the next-queue with a specific sequence (front = index 0). */
export function withQueue(seq: ReadonlyArray<PieceId>): EngineOp {
  return (s) => {
    return { ...s, queue: [...seq] };
  };
}

/** Force the active piece to a specific kind at spawn location. */
export function forceActive(kind: PieceId): EngineOp {
  return (s) => {
    const newPiece = createActivePiece(kind);
    return { ...s, piece: newPiece };
  };
}

/** Add N rows of garbage with specified hole positions at the bottom. */
export function addGarbage(rows: ReadonlyArray<number>): EngineOp {
  return (s) => {
    if (rows.length === 0) {
      return s;
    }

    let newBoard = s.board;

    // Process each garbage row from bottom to top
    for (const holeColumn of rows) {
      if (holeColumn < 0 || holeColumn >= newBoard.width) {
        throw new Error(
          `Hole column ${String(holeColumn)} out of bounds [0, ${String(newBoard.width - 1)}]`,
        );
      }

      // Create garbage row with hole at specified column
      const garbageRow = Array.from(
        { length: newBoard.width },
        (_, i) => (i === holeColumn ? 0 : createCellValue(8)), // 8 = garbage cell value
      );

      // Shift board up and insert garbage row at bottom
      const newCells = shiftUpAndInsertRow(newBoard, garbageRow);
      newBoard = { ...newBoard, cells: newCells };
    }

    return { ...s, board: newBoard };
  };
}

/** Reset hold state (useful for scenarios). */
export function clearHold(): EngineOp {
  return (s) => ({ ...s, hold: { piece: null, usedThisTurn: false } });
}
