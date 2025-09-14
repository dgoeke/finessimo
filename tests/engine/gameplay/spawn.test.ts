import { createEmptyBoard } from "@/engine/core/board";
import { OnePieceRng } from "@/engine/core/rng/one-piece";
import { SequenceRng } from "@/engine/core/rng/sequence";
import { createActivePiece } from "@/engine/core/spawning";
import {
  type ActivePiece,
  type PieceId,
  createGridCoord,
  idx,
} from "@/engine/core/types";
import {
  clearCompletedLines,
  placeActivePiece,
  spawnPiece,
} from "@/engine/gameplay/spawn";
import { type GameState, type Q16_16, type Tick } from "@/engine/types";

import {
  createTestConfig,
  createTestPhysics,
  createBoardWithCollisions,
} from "../../test-helpers";

// Test helper functions local to this file

function createTestState(overrides: Partial<GameState> = {}): GameState {
  const cfg = createTestConfig();
  const rng = new OnePieceRng("T"); // Simple deterministic RNG for testing

  return {
    board: createEmptyBoard(),
    cfg,
    hold: { piece: null, usedThisTurn: false },
    physics: createTestPhysics(),
    piece: null,
    queue: ["I", "O", "T", "S", "Z"] as ReadonlyArray<PieceId>,
    rng,
    tick: 0 as Tick,
    ...overrides,
  };
}

describe("@/engine/gameplay/spawn — locking & spawning", () => {
  describe("clearCompletedLines()", () => {
    test("returns empty rows array and same state when no completed lines", () => {
      // Create board with partial lines
      const boardWithPartialLines = createBoardWithCollisions([
        { value: 1, x: 0, y: 0 },
        { value: 2, x: 1, y: 0 },
        { value: 3, x: 2, y: 0 }, // incomplete row
        { value: 1, x: 0, y: 1 },
        { value: 2, x: 5, y: 1 },
        { value: 3, x: 9, y: 1 }, // incomplete row
      ]);

      const state = createTestState({ board: boardWithPartialLines });
      const result = clearCompletedLines(state);

      expect(result.rows).toEqual([]);
      expect(result.state).toBe(state); // Should return same state when no lines cleared
    });

    test("clears single completed line and returns correct row index", () => {
      const completedLineBoard = createBoardWithCollisions([
        // Fill row 0 completely
        { value: 1, x: 0, y: 0 },
        { value: 2, x: 1, y: 0 },
        { value: 3, x: 2, y: 0 },
        { value: 4, x: 3, y: 0 },
        { value: 5, x: 4, y: 0 },
        { value: 6, x: 5, y: 0 },
        { value: 7, x: 6, y: 0 },
        { value: 1, x: 7, y: 0 },
        { value: 2, x: 8, y: 0 },
        { value: 3, x: 9, y: 0 },
        // Partial row 1
        { value: 1, x: 0, y: 1 },
        { value: 2, x: 1, y: 1 },
      ]);

      const state = createTestState({ board: completedLineBoard });
      const result = clearCompletedLines(state);

      expect(result.rows).toEqual([0]);
      expect(result.state).not.toBe(state); // Should return new state
      expect(result.state.board).not.toBe(state.board); // Should return new board

      // Verify the completed line was cleared - partial row 1 stays at row 1
      const newBoard = result.state.board;
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(0), createGridCoord(1))],
      ).toBe(1);
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(1), createGridCoord(1))],
      ).toBe(2);
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(2), createGridCoord(1))],
      ).toBe(0); // Should be empty

      // Top rows should be empty
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(0), createGridCoord(0))],
      ).toBe(0);
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(1), createGridCoord(0))],
      ).toBe(0);
    });

    test("clears multiple completed lines and returns correct row indices", () => {
      const multipleCompletedBoard = createBoardWithCollisions([
        // Fill row 0 completely
        { value: 1, x: 0, y: 0 },
        { value: 2, x: 1, y: 0 },
        { value: 3, x: 2, y: 0 },
        { value: 4, x: 3, y: 0 },
        { value: 5, x: 4, y: 0 },
        { value: 6, x: 5, y: 0 },
        { value: 7, x: 6, y: 0 },
        { value: 1, x: 7, y: 0 },
        { value: 2, x: 8, y: 0 },
        { value: 3, x: 9, y: 0 },
        // Partial row 1
        { value: 1, x: 0, y: 1 },
        { value: 2, x: 5, y: 1 },
        // Fill row 2 completely
        { value: 2, x: 0, y: 2 },
        { value: 3, x: 1, y: 2 },
        { value: 4, x: 2, y: 2 },
        { value: 5, x: 3, y: 2 },
        { value: 6, x: 4, y: 2 },
        { value: 7, x: 5, y: 2 },
        { value: 1, x: 6, y: 2 },
        { value: 2, x: 7, y: 2 },
        { value: 3, x: 8, y: 2 },
        { value: 4, x: 9, y: 2 },
      ]);

      const state = createTestState({ board: multipleCompletedBoard });
      const result = clearCompletedLines(state);

      expect(result.rows).toEqual([0, 2]); // Both rows 0 and 2 were complete
      expect(result.state).not.toBe(state);
      expect(result.state.board).not.toBe(state.board);

      // Verify lines were cleared - partial row 1 moves down by 1 to row 2
      const newBoard = result.state.board;
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(0), createGridCoord(2))],
      ).toBe(1);
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(5), createGridCoord(2))],
      ).toBe(2);
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(1), createGridCoord(2))],
      ).toBe(0); // Gap should be empty

      // Top rows should be empty
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(0), createGridCoord(0))],
      ).toBe(0);
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(5), createGridCoord(0))],
      ).toBe(0);
    });

    test("preserves other state properties when clearing lines", () => {
      const completedLineBoard = createBoardWithCollisions([
        // Fill row 19 (bottom) completely
        { value: 1, x: 0, y: 19 },
        { value: 2, x: 1, y: 19 },
        { value: 3, x: 2, y: 19 },
        { value: 4, x: 3, y: 19 },
        { value: 5, x: 4, y: 19 },
        { value: 6, x: 5, y: 19 },
        { value: 7, x: 6, y: 19 },
        { value: 1, x: 7, y: 19 },
        { value: 2, x: 8, y: 19 },
        { value: 3, x: 9, y: 19 },
      ]);

      const originalState = createTestState({
        board: completedLineBoard,
        hold: { piece: "J", usedThisTurn: true },
        piece: createActivePiece("T"),
        tick: 42 as Tick,
      });

      const result = clearCompletedLines(originalState);

      // Should preserve all properties except board
      expect(result.state.piece).toBe(originalState.piece);
      expect(result.state.tick).toBe(42 as Tick);
      expect(result.state.hold).toEqual({ piece: "J", usedThisTurn: true });
      expect(result.state.queue).toBe(originalState.queue);
      expect(result.state.cfg).toBe(originalState.cfg);
      expect(result.state.rng).toBe(originalState.rng);
      expect(result.state.physics).toBe(originalState.physics);
    });

    test("handles lines at different heights correctly", () => {
      // Test clearing lines at top and bottom of board
      const mixedHeightBoard = createBoardWithCollisions([
        // Fill row 1 (near top)
        { value: 1, x: 0, y: 1 },
        { value: 2, x: 1, y: 1 },
        { value: 3, x: 2, y: 1 },
        { value: 4, x: 3, y: 1 },
        { value: 5, x: 4, y: 1 },
        { value: 6, x: 5, y: 1 },
        { value: 7, x: 6, y: 1 },
        { value: 1, x: 7, y: 1 },
        { value: 2, x: 8, y: 1 },
        { value: 3, x: 9, y: 1 },
        // Some blocks in middle
        { value: 1, x: 0, y: 10 },
        { value: 2, x: 1, y: 10 },
        // Fill row 18 (near bottom)
        { value: 2, x: 0, y: 18 },
        { value: 3, x: 1, y: 18 },
        { value: 4, x: 2, y: 18 },
        { value: 5, x: 3, y: 18 },
        { value: 6, x: 4, y: 18 },
        { value: 7, x: 5, y: 18 },
        { value: 1, x: 6, y: 18 },
        { value: 2, x: 7, y: 18 },
        { value: 3, x: 8, y: 18 },
        { value: 4, x: 9, y: 18 },
      ]);

      const state = createTestState({ board: mixedHeightBoard });
      const result = clearCompletedLines(state);

      expect(result.rows).toEqual([1, 18]);

      // Verify middle blocks moved down by 1 after clearing row 18 below
      const newBoard = result.state.board;
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(0), createGridCoord(11))],
      ).toBe(1); // Moved from row 10 to row 11
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(1), createGridCoord(11))],
      ).toBe(2); // Moved from row 10 to row 11

      // Top rows should be empty
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(0), createGridCoord(1))],
      ).toBe(0);
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(0), createGridCoord(18))],
      ).toBe(0);
    });

    test("immutability - original state and board unchanged", () => {
      const completedLineBoard = createBoardWithCollisions([
        { value: 1, x: 0, y: 5 },
        { value: 2, x: 1, y: 5 },
        { value: 3, x: 2, y: 5 },
        { value: 4, x: 3, y: 5 },
        { value: 5, x: 4, y: 5 },
        { value: 6, x: 5, y: 5 },
        { value: 7, x: 6, y: 5 },
        { value: 1, x: 7, y: 5 },
        { value: 2, x: 8, y: 5 },
        { value: 3, x: 9, y: 5 },
      ]);

      const originalState = createTestState({ board: completedLineBoard });
      const originalBoard = originalState.board;

      const result = clearCompletedLines(originalState);

      // Verify original state and board are unchanged
      expect(originalState.board).toBe(originalBoard);
      expect(
        originalState.board.cells[
          idx(originalBoard, createGridCoord(0), createGridCoord(5))
        ],
      ).toBe(1);
      expect(
        originalState.board.cells[
          idx(originalBoard, createGridCoord(9), createGridCoord(5))
        ],
      ).toBe(3);

      // Verify result has different instances
      expect(result.state.board).not.toBe(originalBoard);
      expect(result.state.board.cells).not.toBe(originalBoard.cells);
    });

    test("returns array copy of completed rows (not the original array)", () => {
      const completedLineBoard = createBoardWithCollisions([
        { value: 1, x: 0, y: 0 },
        { value: 2, x: 1, y: 0 },
        { value: 3, x: 2, y: 0 },
        { value: 4, x: 3, y: 0 },
        { value: 5, x: 4, y: 0 },
        { value: 6, x: 5, y: 0 },
        { value: 7, x: 6, y: 0 },
        { value: 1, x: 7, y: 0 },
        { value: 2, x: 8, y: 0 },
        { value: 3, x: 9, y: 0 },
      ]);

      const state = createTestState({ board: completedLineBoard });
      const result = clearCompletedLines(state);

      // Should return a copy, not the original array from getCompletedLines
      expect(Array.isArray(result.rows)).toBe(true);
      expect(result.rows).toEqual([0]);

      // Verify it's a proper array (not readonly)
      const rowsCopy = [...result.rows];
      expect(rowsCopy).toEqual([0]);
    });
  });

  describe("placeActivePiece()", () => {
    test("merges current piece into the board and returns pieceId; returns null pieceId if no active piece", () => {
      // Test with no active piece
      const stateWithoutPiece = createTestState({ piece: null });
      const result1 = placeActivePiece(stateWithoutPiece);

      expect(result1.pieceId).toBeNull();
      expect(result1.state).toBe(stateWithoutPiece); // Should return same state

      // Test with active piece
      const activePiece = createActivePiece("T");
      const stateWithPiece = createTestState({ piece: activePiece });
      const result2 = placeActivePiece(stateWithPiece);

      expect(result2.pieceId).toBe("T");
      expect(result2.state.piece).toBeNull(); // Piece should be cleared
      expect(result2.state).not.toBe(stateWithPiece); // Should return new state
      expect(result2.state.board).not.toBe(stateWithPiece.board); // Board should be new

      // Verify immutability - original state unchanged
      expect(stateWithPiece.piece).not.toBeNull();
      expect(stateWithPiece.board).toEqual(stateWithoutPiece.board); // Original board unchanged
    });

    test("correctly locks piece cells into board at piece position", () => {
      const activePiece: ActivePiece = {
        id: "O",
        rot: "spawn",
        x: createGridCoord(4),
        y: createGridCoord(0),
      };
      const state = createTestState({ piece: activePiece });

      const result = placeActivePiece(state);

      // O piece at (4,0) with shape [1,0],[2,0],[1,1],[2,1] should place blocks at (5,0), (6,0), (5,1), (6,1)
      const newBoard = result.state.board;
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(5), createGridCoord(0))],
      ).toBe(2); // O piece = value 2
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(6), createGridCoord(0))],
      ).toBe(2);
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(5), createGridCoord(1))],
      ).toBe(2);
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(6), createGridCoord(1))],
      ).toBe(2);

      // Verify other cells remain empty
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(4), createGridCoord(0))],
      ).toBe(0);
      expect(
        newBoard.cells[idx(newBoard, createGridCoord(7), createGridCoord(0))],
      ).toBe(0);
    });

    test("preserves other state properties when locking piece", () => {
      const originalState = createTestState({
        hold: { piece: "J", usedThisTurn: true },
        piece: createActivePiece("I"),
        tick: 42 as Tick,
      });

      const result = placeActivePiece(originalState);

      // Should preserve all properties except piece and board
      expect(result.state.tick).toBe(42 as Tick);
      expect(result.state.hold).toEqual({ piece: "J", usedThisTurn: true });
      expect(result.state.queue).toBe(originalState.queue);
      expect(result.state.cfg).toBe(originalState.cfg);
      expect(result.state.rng).toBe(originalState.rng);
      expect(result.state.physics).toBe(originalState.physics);
    });
  });

  describe("spawnPiece() - normal operations", () => {
    test("pulls next from queue (refilling via rng) unless spawnOverride provided; resets physics (gravityAccum32=0, lock.resetCount=0, deadlineTick=null, hold.usedThisTurn=false)", () => {
      const initialQueue = ["I", "O"] as ReadonlyArray<PieceId>;
      const sequenceRng = new SequenceRng(["T", "S", "Z", "J", "L"]); // Will provide refill pieces
      const dirtyPhysics = createTestPhysics({
        gravityAccum32: 1.75 as Q16_16,
        lock: { deadlineTick: 200 as Tick, resetCount: 8 },
      });

      const state = createTestState({
        hold: { piece: "J", usedThisTurn: true },
        physics: dirtyPhysics,
        queue: initialQueue,
        rng: sequenceRng,
      });

      const result = spawnPiece(state);

      // Should spawn first piece from queue
      expect(result.spawnedId).toBe("I");
      expect(result.topOut).toBe(false);
      expect(result.state.piece?.id).toBe("I");

      // Queue should be shortened and refilled (started with 2, took 1, refilled with 7)
      expect(result.state.queue).toHaveLength(8); // 1 remaining + 7 refilled
      expect(result.state.queue[0]).toBe("O"); // Second piece from original queue
      expect(result.state.queue.slice(1)).toEqual([
        "T",
        "S",
        "Z",
        "J",
        "L",
        "T",
        "S",
      ]); // Refilled pieces (cycling)

      // Physics should be reset
      expect(result.state.physics.gravityAccum32).toBe(0 as Q16_16);
      expect(result.state.physics.lock.deadlineTick).toBeNull();
      expect(result.state.physics.lock.resetCount).toBe(0);

      // Hold usage should be reset
      expect(result.state.hold.usedThisTurn).toBe(false);
      expect(result.state.hold.piece).toBe("J"); // Hold piece preserved

      // RNG should be advanced
      expect(result.state.rng).not.toBe(sequenceRng);
    });

    test("uses spawnOverride when provided (Hold swap scenario)", () => {
      const state = createTestState({
        hold: { piece: "S", usedThisTurn: true },
        queue: ["I", "O", "T"] as ReadonlyArray<PieceId>,
      });

      const result = spawnPiece(state, "S"); // Spawn S from hold

      expect(result.spawnedId).toBe("S");
      expect(result.topOut).toBe(false);
      expect(result.state.piece?.id).toBe("S");

      // Queue should be unchanged when using override
      expect(result.state.queue).toEqual(["I", "O", "T"]);
      expect(result.state.rng).toBe(state.rng); // RNG unchanged for override

      // Hold usage should still be reset
      expect(result.state.hold.usedThisTurn).toBe(false);
    });

    test("does not refill queue when above previewCount threshold", () => {
      const largeQueue = [
        "I",
        "O",
        "T",
        "S",
        "Z",
        "J",
        "L",
      ] as ReadonlyArray<PieceId>;
      const rng = new OnePieceRng("T");
      const state = createTestState({
        cfg: createTestConfig({ previewCount: 5 }),
        queue: largeQueue,
        rng,
      });

      const result = spawnPiece(state);

      expect(result.spawnedId).toBe("I");
      // Queue should just lose first piece, no refill (7 - 1 = 6, still above previewCount=5)
      expect(result.state.queue).toEqual(["O", "T", "S", "Z", "J", "L"]);
      expect(result.state.rng).toBe(rng); // RNG should be unchanged
    });

    test("handles empty queue gracefully", () => {
      const state = createTestState({ queue: [] as ReadonlyArray<PieceId> });

      const result = spawnPiece(state);

      expect(result.spawnedId).toBeNull();
      expect(result.topOut).toBe(true);
      expect(result.state.piece).toBeNull();
      expect(result.state).toBe(state); // State should be unchanged on failure
    });

    test("handles queue with undefined elements (edge case)", () => {
      // This tests the defensive undefined check that should never happen
      // We create a malformed queue to test this edge case
      const malformedQueue = [undefined] as unknown as ReadonlyArray<PieceId>;
      const state = createTestState({ queue: malformedQueue });

      const result = spawnPiece(state);

      expect(result.spawnedId).toBeNull();
      expect(result.topOut).toBe(true);
      expect(result.state.piece).toBeNull();
      expect(result.state).toBe(state); // State should be unchanged on failure
    });

    test("immutability - original state unchanged", () => {
      const originalQueue = ["I", "O"] as ReadonlyArray<PieceId>;
      const originalPhysics = createTestPhysics();
      const originalState = createTestState({
        physics: originalPhysics,
        queue: originalQueue,
      });

      const result = spawnPiece(originalState);

      // Verify original state is unchanged
      expect(originalState.queue).toBe(originalQueue);
      expect(originalState.physics).toBe(originalPhysics);
      expect(originalState.piece).toBeNull();

      // Result should have new instances
      expect(result.state.queue).not.toBe(originalQueue);
      expect(result.state.physics).not.toBe(originalPhysics);
    });
  });

  describe("spawnPiece() - top-out detection", () => {
    test("top-out when placement fails; PieceSpawned not emitted; subsequent steps should not try to spawn again unless game resets", () => {
      // Create board with collision at T-piece spawn position
      // T piece spawns at (3, -2) with cells at [0,1], [-1,0], [0,0], [1,0] relative to origin
      // So actual cells are at (4, -1), (3, -2), (4, -2), (5, -2)
      const boardWithCollision = createBoardWithCollisions([
        { value: 8, x: 4, y: -1 }, // Block T-piece spawn cell
      ]);

      const state = createTestState({
        board: boardWithCollision,
        queue: ["T", "I", "O"] as ReadonlyArray<PieceId>,
      });

      const result = spawnPiece(state);

      expect(result.spawnedId).toBeNull(); // No piece spawned
      expect(result.topOut).toBe(true);
      expect(result.state.piece).toBeNull();
      expect(result.state).toBe(state); // State unchanged on top-out
    });

    test("successful spawn when collision is outside spawn area", () => {
      // Place collision away from spawn area
      const boardWithSafeCollision = createBoardWithCollisions([
        { value: 8, x: 0, y: 0 }, // Far from spawn area
        { value: 8, x: 9, y: 19 }, // Bottom corner
      ]);

      const state = createTestState({
        board: boardWithSafeCollision,
        queue: ["T"] as ReadonlyArray<PieceId>,
      });

      const result = spawnPiece(state);

      expect(result.spawnedId).toBe("T");
      expect(result.topOut).toBe(false);
      expect(result.state.piece?.id).toBe("T");
    });

    test("top-out detection works for different piece types", () => {
      // Test I-piece specifically - spawns at (3, -2) with cells at [0,1], [1,1], [2,1], [3,1]
      // So actual cells are at (3, -1), (4, -1), (5, -1), (6, -1)
      const boardBlockingI = createBoardWithCollisions([
        { value: 8, x: 3, y: -1 }, // Block I-piece spawn
      ]);

      const stateI = createTestState({
        board: boardBlockingI,
        queue: ["I"] as ReadonlyArray<PieceId>,
      });

      const resultI = spawnPiece(stateI);
      expect(resultI.topOut).toBe(true);
      expect(resultI.spawnedId).toBeNull();

      // Test O-piece - spawns at (3, -2) with cells at [1,0], [2,0], [1,1], [2,1]
      // So actual cells are at (4, -2), (5, -2), (4, -1), (5, -1)
      const boardBlockingO = createBoardWithCollisions([
        { value: 8, x: 4, y: -2 }, // Block O-piece spawn
      ]);

      const stateO = createTestState({
        board: boardBlockingO,
        queue: ["O"] as ReadonlyArray<PieceId>,
      });

      const resultO = spawnPiece(stateO);
      expect(resultO.topOut).toBe(true);
      expect(resultO.spawnedId).toBeNull();
    });

    test("top-out with spawnOverride still respects collision detection", () => {
      const boardWithCollision = createBoardWithCollisions([
        { value: 8, x: 4, y: -1 }, // Block T-piece spawn
      ]);

      const state = createTestState({ board: boardWithCollision });

      const result = spawnPiece(state, "T"); // Try to force spawn T

      expect(result.spawnedId).toBeNull();
      expect(result.topOut).toBe(true);
      expect(result.state.piece).toBeNull();
    });
  });

  describe("edge cases and integration", () => {
    test("queue length boundary conditions", () => {
      // Test exact previewCount threshold
      const exactQueue = ["I", "O", "T", "S", "Z"] as ReadonlyArray<PieceId>; // exactly 5
      const state = createTestState({
        cfg: createTestConfig({ previewCount: 5 }),
        queue: exactQueue,
        rng: new SequenceRng(["J", "L"]),
      });

      const result = spawnPiece(state);

      expect(result.state.queue).toHaveLength(11); // 4 remaining + 7 refilled
      expect(result.state.queue.slice(-2)).toEqual(["L", "J"]); // Last 2 refilled pieces (cycling)
    });

    test("spawned piece positioned correctly at spawn coordinates", () => {
      const state = createTestState({ queue: ["L"] as ReadonlyArray<PieceId> });

      const result = spawnPiece(state);

      expect(result.state.piece).not.toBeNull();
      const spawnedPiece = result.state.piece;
      if (spawnedPiece) {
        expect(spawnedPiece.x).toEqual(createGridCoord(3)); // Standard spawn x
        expect(spawnedPiece.y).toEqual(createGridCoord(-2)); // Standard spawn y
        expect(spawnedPiece.rot).toBe("spawn");
      }
    });

    test("physics reset preserves softDropOn setting", () => {
      const physicsWithSoftDrop = createTestPhysics({ softDropOn: true });
      const state = createTestState({
        physics: physicsWithSoftDrop,
        queue: ["S"] as ReadonlyArray<PieceId>,
      });

      const result = spawnPiece(state);

      // softDropOn should be preserved
      expect(result.state.physics.softDropOn).toBe(true);
      // But other physics should be reset
      expect(result.state.physics.gravityAccum32).toBe(0 as Q16_16);
      expect(result.state.physics.lock.deadlineTick).toBeNull();
      expect(result.state.physics.lock.resetCount).toBe(0);
    });

    test("multiple spawn calls maintain state consistency", () => {
      const state = createTestState({
        queue: ["I", "O"] as ReadonlyArray<PieceId>,
        rng: new SequenceRng(["T", "S", "Z", "J", "L"]),
      });

      // First spawn
      const result1 = spawnPiece(state);
      expect(result1.spawnedId).toBe("I");

      // Second spawn from new state
      const stateAfterFirst = { ...result1.state, piece: null }; // Clear piece to simulate locking
      const result2 = spawnPiece(stateAfterFirst);
      expect(result2.spawnedId).toBe("O");

      // Queue should be properly managed
      expect(result2.state.queue[0]).toBe("T"); // First refill piece
    });
  });
});
