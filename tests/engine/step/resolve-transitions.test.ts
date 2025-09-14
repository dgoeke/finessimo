import { resolveTransitions } from "@/engine/step/resolve-transitions";

import {
  createAlmostFullBoard,
  createTestGameState,
  createTestPiece,
  createTestRng,
  createTopOutBoard,
  fillBoardRow,
} from "../../test-helpers";

import type { PhysicsSideEffects } from "@/engine/step/advance-physics";
import type { Tick } from "@/engine/types";

describe("@/engine/step/resolve-transitions — place/clear/spawn", () => {
  describe("When lockNow=true", () => {
    test("placeActivePiece() merges into board, emits Locked before any LinesCleared/PieceSpawned", () => {
      // Arrange: State with active piece ready to lock
      const piece = createTestPiece("T", 4, 10);
      const state = createTestGameState({
        piece,
        tick: 100 as Tick,
      });

      const physFx: PhysicsSideEffects = {
        hardDropped: false,
        lockNow: true,
      };

      // Act
      const result = resolveTransitions(state, physFx);

      // Assert: Piece is locked and new piece spawned automatically
      expect(result.state.piece).not.toBeNull(); // New piece spawned automatically
      expect(result.events).toHaveLength(2); // Locked + PieceSpawned
      expect(result.events[0]).toEqual({
        kind: "Locked",
        pieceId: "T",
        source: "ground",
        tick: 100,
      });
      expect(result.events[1]?.kind).toBe("PieceSpawned");

      // Verify piece was merged into board (T piece cells should be non-zero)
      const boardHasPieceCells = result.state.board.cells.some(
        (cell) => cell !== 0,
      );
      expect(boardHasPieceCells).toBe(true);
    });

    test("emits Locked with hardDrop source when hardDropped=true", () => {
      // Arrange
      const piece = createTestPiece("I", 3, 8);
      const state = createTestGameState({
        piece,
        tick: 50 as Tick,
      });

      const physFx: PhysicsSideEffects = {
        hardDropped: true,
        lockNow: true,
      };

      // Act
      const result = resolveTransitions(state, physFx);

      // Assert: Locked event has hardDrop source
      expect(result.events[0]).toEqual({
        kind: "Locked",
        pieceId: "I",
        source: "hardDrop",
        tick: 50,
      });
    });
  });

  describe("Line clearing", () => {
    test("emits LinesCleared with correct row indices and compacts the board", () => {
      // Arrange: Board with almost complete bottom row + piece that will complete it
      const boardWithAlmostFullRow = createAlmostFullBoard([19], 4); // Row 19 missing cell at x=4
      // Use I piece in vertical ("left") orientation at x=3 to fill the gap at x=4
      // "left" rotation has cells at [1,0], [1,1], [1,2], [1,3]
      // At position (3,16): (3+1,16+0), (3+1,16+1), (3+1,16+2), (3+1,16+3) = (4,16), (4,17), (4,18), (4,19)
      // This fills the gap at x=4 in row 19
      const piece = createTestPiece("I", 3, 16, "left");

      const state = createTestGameState({
        board: boardWithAlmostFullRow,
        piece,
        tick: 200 as Tick,
      });

      const physFx: PhysicsSideEffects = {
        hardDropped: false,
        lockNow: true,
      };

      // Act
      const result = resolveTransitions(state, physFx);

      // Assert: LinesCleared event is emitted after Locked
      expect(result.events).toHaveLength(3); // Locked + LinesCleared + PieceSpawned
      expect(result.events[0]?.kind).toBe("Locked");
      expect(result.events[1]).toEqual({
        kind: "LinesCleared",
        rows: [19],
        tick: 200,
      });
      expect(result.events[2]?.kind).toBe("PieceSpawned");
    });

    test("handles multiple line clears correctly", () => {
      // Arrange: Board with two almost complete rows, each missing one cell at x=3
      const boardWithMultipleRows = createAlmostFullBoard([18, 19], 3); // Both rows missing cell at x=3
      // Use I piece vertically ("left") at x=2 to fill both gaps at x=3
      // "left" rotation has cells at [1,0], [1,1], [1,2], [1,3]
      // At position (2,16): (2+1,16+0), (2+1,16+1), (2+1,16+2), (2+1,16+3) = (3,16), (3,17), (3,18), (3,19)
      // This fills the gaps at x=3 in both rows 18 and 19
      const piece = createTestPiece("I", 2, 16, "left");

      const state = createTestGameState({
        board: boardWithMultipleRows,
        piece,
        tick: 150 as Tick,
      });

      const physFx: PhysicsSideEffects = {
        hardDropped: true,
        lockNow: true,
      };

      // Act
      const result = resolveTransitions(state, physFx);

      // Assert: Multiple lines cleared
      const linesClearedEvent = result.events.find(
        (e) => e.kind === "LinesCleared",
      );
      expect(linesClearedEvent).toBeDefined();
      if (linesClearedEvent?.kind === "LinesCleared") {
        expect(linesClearedEvent.rows).toEqual([18, 19]);
      }
    });

    test("no LinesCleared event when no lines complete", () => {
      // Arrange: Normal lock without completing lines
      const piece = createTestPiece("T", 4, 10);
      const state = createTestGameState({
        piece,
        tick: 75 as Tick,
      });

      const physFx: PhysicsSideEffects = {
        hardDropped: false,
        lockNow: true,
      };

      // Act
      const result = resolveTransitions(state, physFx);

      // Assert: No LinesCleared event
      const hasLinesClearedEvent = result.events.some(
        (e) => e.kind === "LinesCleared",
      );
      expect(hasLinesClearedEvent).toBe(false);
      expect(result.events).toHaveLength(2); // Only Locked + PieceSpawned
    });
  });

  describe("Spawn path", () => {
    test("if spawnOverride is present (from Hold), that pieceId is used", () => {
      // Arrange: State without active piece + spawnOverride
      const testRng = createTestRng(["L", "S", "Z"]); // Queue pieces
      const state = createTestGameState({
        piece: null, // No active piece to trigger spawning
        queue: ["L", "S", "Z"],
        rng: testRng,
        tick: 125 as Tick,
      });

      const physFx: PhysicsSideEffects = {
        hardDropped: false,
        lockNow: false,
        spawnOverride: "J", // Hold piece override
      };

      // Act
      const result = resolveTransitions(state, physFx);

      // Assert: spawnOverride piece is used, not queue piece
      expect(result.state.piece?.id).toBe("J");
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        kind: "PieceSpawned",
        pieceId: "J",
        tick: 125,
      });
      // Queue should remain unchanged when using override
      expect(result.state.queue).toEqual(["L", "S", "Z"]);
    });

    test("normal spawn pops from queue and refills when needed", () => {
      // Arrange: State with short queue to trigger refilling
      const testRng = createTestRng(["T", "I", "O", "S", "Z", "L", "J"]); // Refill pieces
      const state = createTestGameState({
        cfg: { ...createTestGameState().cfg, previewCount: 3 }, // Will refill when queue < 3
        piece: null, // Trigger spawning
        queue: ["T"], // Short queue will trigger refill
        rng: testRng,
        tick: 300 as Tick,
      });

      const physFx: PhysicsSideEffects = {
        hardDropped: false,
        lockNow: false,
      };

      // Act
      const result = resolveTransitions(state, physFx);

      // Assert: First piece from queue is spawned
      expect(result.state.piece?.id).toBe("T");
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        kind: "PieceSpawned",
        pieceId: "T",
        tick: 300,
      });

      // Queue should be refilled (original queue minus spawned piece plus new pieces)
      expect(result.state.queue.length).toBeGreaterThan(1);
    });

    test("spawns next piece when no active piece exists", () => {
      // Arrange: Simple spawning case with sufficient queue length to prevent refill
      const testRng = createTestRng(["O", "S", "T", "I", "L", "Z", "J"]);
      const state = createTestGameState({
        cfg: { ...createTestGameState().cfg, previewCount: 3 }, // Queue needs to be >= 3 after spawn
        piece: null,
        queue: ["O", "S", "T", "I", "L"], // 5 pieces, after spawn will be 4, >= previewCount
        rng: testRng,
        tick: 400 as Tick,
      });

      const physFx: PhysicsSideEffects = {
        hardDropped: false,
        lockNow: false,
      };

      // Act
      const result = resolveTransitions(state, physFx);

      // Assert
      expect(result.state.piece?.id).toBe("O");
      expect(result.state.queue).toEqual(["S", "T", "I", "L"]);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]?.kind).toBe("PieceSpawned");
    });
  });

  describe("Top-out scenarios", () => {
    test("emits TopOut when new piece cannot be placed (collision even in vanish rows)", () => {
      // Arrange: Board blocked in spawn area
      const topOutBoard = createTopOutBoard(true); // Fill vanish zone too
      const state = createTestGameState({
        board: topOutBoard,
        piece: null, // Trigger spawning
        queue: ["T", "I", "O"],
        tick: 500 as Tick,
      });

      const physFx: PhysicsSideEffects = {
        hardDropped: false,
        lockNow: false,
      };

      // Act
      const result = resolveTransitions(state, physFx);

      // Assert: TopOut event and no active piece
      expect(result.state.piece).toBeNull();
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        kind: "TopOut",
        tick: 500,
      });
    });

    test("does not set active piece after top-out", () => {
      // Arrange: Board that causes top-out - create a more comprehensive block
      const topOutBoard = createTopOutBoard(true); // Block both vanish and visible areas
      // Also fill additional cells to ensure I piece spawn definitely fails
      let blockedBoard = fillBoardRow(topOutBoard, 0, 1); // Fill entire row 0
      blockedBoard = fillBoardRow(blockedBoard, 1, 1); // Fill entire row 1

      const state = createTestGameState({
        board: blockedBoard,
        piece: null,
        queue: ["I", "O", "T"], // I piece will definitely collide
        tick: 600 as Tick,
      });

      const physFx: PhysicsSideEffects = {
        hardDropped: false,
        lockNow: false,
      };

      // Act
      const result = resolveTransitions(state, physFx);

      // Assert: No active piece, only TopOut event
      expect(result.state.piece).toBeNull();
      expect(result.events).toHaveLength(1);
      expect(result.events[0]?.kind).toBe("TopOut");

      // Queue should remain unchanged on top-out
      expect(result.state.queue).toEqual(["I", "O", "T"]);
    });
  });

  describe("Edge cases", () => {
    test("handles lock + line clear + spawn in correct order", () => {
      // Arrange: State that will trigger all three operations
      const almostFullBoard = fillBoardRow(
        createAlmostFullBoard([19], 4),
        19,
        1,
      );
      const piece = createTestPiece("O", 4, 18); // Will complete the line

      const state = createTestGameState({
        board: almostFullBoard,
        piece,
        queue: ["T", "I", "S"],
        tick: 700 as Tick,
      });

      const physFx: PhysicsSideEffects = {
        hardDropped: true,
        lockNow: true,
      };

      // Act
      const result = resolveTransitions(state, physFx);

      // Assert: Events in correct order
      expect(result.events).toHaveLength(3);
      expect(result.events[0]?.kind).toBe("Locked");
      expect(result.events[1]?.kind).toBe("LinesCleared");
      expect(result.events[2]?.kind).toBe("PieceSpawned");

      // All operations completed
      expect(result.state.piece).not.toBeNull(); // New piece spawned
      expect(result.state.piece?.id).toBe("T"); // First from queue
    });

    test("no operations when no piece and no spawn needed", () => {
      // Arrange: State that doesn't need any operations
      const state = createTestGameState({
        piece: createTestPiece("S", 5, 12), // Active piece exists
        tick: 800 as Tick,
      });

      const physFx: PhysicsSideEffects = {
        hardDropped: false,
        lockNow: false, // No locking needed
      };

      // Act
      const result = resolveTransitions(state, physFx);

      // Assert: No events, state unchanged
      expect(result.events).toHaveLength(0);
      expect(result.state).toEqual(state);
    });
  });

  describe("Lock-out detection", () => {
    test("Piece locking entirely in vanish zone without line clear causes TopOut", () => {
      // Create a piece positioned entirely in the vanish zone
      const piece = createTestPiece("T", 4, -2); // T piece at y=-2 (vanish zone)
      const state = createTestGameState({
        piece,
        tick: 100 as Tick,
      });

      const physFx: PhysicsSideEffects = {
        hardDropped: false,
        lockNow: true,
      };

      // Act
      const result = resolveTransitions(state, physFx);

      // Assert: Should emit Locked then TopOut, no PieceSpawned
      expect(result.events).toHaveLength(2);
      expect(result.events[0]).toEqual({
        kind: "Locked",
        pieceId: "T",
        source: "ground",
        tick: 100,
      });
      expect(result.events[1]).toEqual({
        kind: "TopOut",
        tick: 100,
      });

      // No new piece should be spawned
      expect(result.state.piece).toBeNull();
    });

    test("Piece locking in vanish zone with line clear does not cause TopOut", () => {
      // Create a board with a full bottom row for clearing
      const board = fillBoardRow(createAlmostFullBoard([19]), 19);

      // Position piece in vanish zone but set up for line clear
      const piece = createTestPiece("I", 4, -1); // I piece in vanish zone
      const state = createTestGameState({
        board,
        piece,
        tick: 200 as Tick,
      });

      const physFx: PhysicsSideEffects = {
        hardDropped: false,
        lockNow: true,
      };

      // Act
      const result = resolveTransitions(state, physFx);

      // Assert: Should emit Locked, LinesCleared, and PieceSpawned (no TopOut)
      expect(result.events).toHaveLength(3);
      expect(result.events[0]?.kind).toBe("Locked");
      expect(result.events[1]?.kind).toBe("LinesCleared");
      expect(result.events[2]?.kind).toBe("PieceSpawned");

      // New piece should be spawned
      expect(result.state.piece).not.toBeNull();
    });

    test("Piece locking partially in vanish zone does not cause TopOut", () => {
      // Create a piece that spans vanish zone and visible area
      const piece = createTestPiece("I", 4, -1); // I piece spanning y=-1 to y=2
      const state = createTestGameState({
        piece,
        tick: 300 as Tick,
      });

      const physFx: PhysicsSideEffects = {
        hardDropped: false,
        lockNow: true,
      };

      // Act
      const result = resolveTransitions(state, physFx);

      // Assert: Should emit Locked and PieceSpawned (no TopOut)
      expect(result.events).toHaveLength(2);
      expect(result.events[0]?.kind).toBe("Locked");
      expect(result.events[1]?.kind).toBe("PieceSpawned");

      // New piece should be spawned
      expect(result.state.piece).not.toBeNull();
    });
  });
});
