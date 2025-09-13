import { isAtBottom } from "@/engine/core/board";
import { applyCommands } from "@/engine/step/apply-commands";

import {
  createTestGameState,
  createTestPiece,
  setBoardCell,
  setupBoardWithFloor,
} from "../../test-helpers";

import type { Command } from "@/engine/commands";

describe("@/engine/step/apply-commands — command handling", () => {
  describe("MoveLeft", () => {
    test("attempts left shift; on success emits MovedLeft and sets sideEffects.lockResetEligible if previously grounded", () => {
      const groundedState = createTestGameState({
        board: setupBoardWithFloor(19), // Floor at y=19
        piece: createTestPiece("T", 5, 17), // Position that's grounded with floor at 19
      });

      expect(groundedState.piece).toBeTruthy();
      if (!groundedState.piece) throw new Error("Expected piece to exist");
      expect(isAtBottom(groundedState.board, groundedState.piece)).toBe(true);

      const moveLeftCmd: Command = { kind: "MoveLeft" };
      const result = applyCommands(groundedState, [moveLeftCmd]);

      // Should move left successfully
      expect(result.state.piece).toBeTruthy();
      expect(result.state.piece?.x).toBe(4); // Moved from x=5 to x=4
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        fromX: 5,
        kind: "MovedLeft",
        tick: groundedState.tick,
        toX: 4,
      });

      // Should set lockResetEligible because piece was grounded before move
      expect(result.sideEffects.lockResetEligible).toBe(true);
      expect(result.sideEffects.lockResetReason).toBe("move");
    });

    test("no-op when blocked by wall or obstacle", () => {
      // T piece spawn has cells at [1,0], [0,1], [1,1], [2,1]
      // For T piece at x=1, y=10, cells are at:
      // - (2, 10), (1, 11), (2, 11), (3, 11)
      // To block left move, put obstacle at x=0, y=11 (where left cell of bottom row would be)
      const blockedState = createTestGameState({
        board: setBoardCell(
          createTestGameState().board,
          0, // Obstacle where left move would place the piece
          11, // At y=11 where T piece bottom row is
          1,
        ),
        piece: createTestPiece("T", 1, 10), // At x=1
      });

      const moveLeftCmd: Command = { kind: "MoveLeft" };
      const result = applyCommands(blockedState, [moveLeftCmd]);

      // Should not move
      expect(result.state.piece).toBeTruthy();
      expect(result.state.piece?.x).toBe(1); // Unchanged
      expect(result.events).toHaveLength(0); // No events
      expect(result.sideEffects.lockResetEligible).toBe(false);
    });

    test("does not set lockResetEligible when piece not grounded before move", () => {
      const floatingState = createTestGameState({
        piece: createTestPiece("T", 5, 10), // Floating piece
      });

      expect(floatingState.piece).toBeTruthy();
      if (!floatingState.piece) throw new Error("Expected piece to exist");
      expect(isAtBottom(floatingState.board, floatingState.piece)).toBe(false);

      const moveLeftCmd: Command = { kind: "MoveLeft" };
      const result = applyCommands(floatingState, [moveLeftCmd]);

      expect(result.state.piece).toBeTruthy();
      expect(result.state.piece?.x).toBe(4);
      expect(result.events).toHaveLength(1);
      expect(result.sideEffects.lockResetEligible).toBe(false);
    });
  });

  describe("MoveRight", () => {
    test("same as MoveLeft but to the right; lockResetEligible reflects pre-move grounded state", () => {
      const groundedState = createTestGameState({
        board: setupBoardWithFloor(19),
        piece: createTestPiece("T", 4, 17),
      });

      expect(groundedState.piece).toBeTruthy();
      if (!groundedState.piece) throw new Error("Expected piece to exist");
      expect(isAtBottom(groundedState.board, groundedState.piece)).toBe(true);

      const moveRightCmd: Command = { kind: "MoveRight" };
      const result = applyCommands(groundedState, [moveRightCmd]);

      expect(result.state.piece).toBeTruthy();
      expect(result.state.piece?.x).toBe(5); // Moved from x=4 to x=5
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        fromX: 4,
        kind: "MovedRight",
        tick: groundedState.tick,
        toX: 5,
      });

      expect(result.sideEffects.lockResetEligible).toBe(true);
      expect(result.sideEffects.lockResetReason).toBe("move");
    });

    test("no-op when blocked", () => {
      // T piece spawn at x=7 has rightmost cell at x=9
      // To block right move, put obstacle at x=10
      const blockedState = createTestGameState({
        board: setBoardCell(createTestGameState().board, 10, 11, 1), // Block right move
        piece: createTestPiece("T", 7, 10), // At rightmost legal position
      });

      const moveRightCmd: Command = { kind: "MoveRight" };
      const result = applyCommands(blockedState, [moveRightCmd]);

      expect(result.state.piece).toBeTruthy();
      expect(result.state.piece?.x).toBe(7); // Unchanged
      expect(result.events).toHaveLength(0);
      expect(result.sideEffects.lockResetEligible).toBe(false);
    });
  });

  describe("RotateCW/RotateCCW", () => {
    test("emits Rotated with kick classification; set lockResetEligible when rotation performed while grounded", () => {
      const groundedState = createTestGameState({
        board: setupBoardWithFloor(19),
        piece: createTestPiece("T", 4, 17, "spawn"), // Grounded position
      });

      expect(groundedState.piece).toBeTruthy();
      if (!groundedState.piece) throw new Error("Expected piece to exist");
      expect(isAtBottom(groundedState.board, groundedState.piece)).toBe(true);

      const rotateCWCmd: Command = { kind: "RotateCW" };
      const result = applyCommands(groundedState, [rotateCWCmd]);

      expect(result.state.piece).toBeTruthy();
      expect(result.state.piece?.rot).toBe("right"); // T piece rotated CW
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        dir: "CW",
        kick: "floor", // Floor kick due to grounded position requiring upward kick
        kind: "Rotated",
        tick: groundedState.tick,
      });

      expect(result.sideEffects.lockResetEligible).toBe(true);
      expect(result.sideEffects.lockResetReason).toBe("rotate");
    });

    test("CCW rotation works similarly", () => {
      const groundedState = createTestGameState({
        board: setupBoardWithFloor(19),
        piece: createTestPiece("I", 4, 17, "spawn"), // I piece in grounded position
      });

      const rotateCCWCmd: Command = { kind: "RotateCCW" };
      const result = applyCommands(groundedState, [rotateCCWCmd]);

      expect(result.state.piece).toBeTruthy();
      expect(result.state.piece?.rot).toBe("left"); // I piece rotated CCW
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        dir: "CCW",
        kick: "floor", // Floor kick due to grounded position requiring upward kick
        kind: "Rotated",
        tick: groundedState.tick,
      });

      expect(result.sideEffects.lockResetEligible).toBe(true);
    });

    test("no lockResetEligible when piece not grounded", () => {
      const floatingState = createTestGameState({
        piece: createTestPiece("T", 4, 10, "spawn"),
      });

      expect(floatingState.piece).toBeTruthy();
      if (!floatingState.piece) throw new Error("Expected piece to exist");
      expect(isAtBottom(floatingState.board, floatingState.piece)).toBe(false);

      const rotateCWCmd: Command = { kind: "RotateCW" };
      const result = applyCommands(floatingState, [rotateCWCmd]);

      expect(result.events).toHaveLength(1);
      expect(result.sideEffects.lockResetEligible).toBe(false);
    });

    test("no-op when rotation blocked", () => {
      // Create a completely blocked scenario similar to movement tests
      // T piece spawn has cells [1,0], [0,1], [1,1], [2,1]
      // T piece "right" rotation has cells [1,0], [1,1], [2,1], [1,2]
      // Fill a box around the piece to block any rotation
      let board = createTestGameState().board;
      for (let x = 3; x <= 7; x++) {
        for (let y = 9; y <= 13; y++) {
          if (!(x === 5 && (y === 10 || y === 11))) {
            // Leave space for T piece at (5, 10)
            board = setBoardCell(board, x, y, 1);
          }
        }
      }

      const blockedState = createTestGameState({
        board,
        piece: createTestPiece("T", 5, 10, "spawn"), // Completely surrounded
      });

      const rotateCWCmd: Command = { kind: "RotateCW" };
      const result = applyCommands(blockedState, [rotateCWCmd]);

      expect(result.state.piece).toBeTruthy();
      expect(result.state.piece?.rot).toBe("spawn"); // Unchanged
      expect(result.events).toHaveLength(0);
      expect(result.sideEffects.lockResetEligible).toBe(false);
    });
  });

  describe("ShiftToWallLeft/Right", () => {
    test("piece moves to wall; emits Moved* once with fromX/toX distance; lockResetEligible if grounded before shift", () => {
      const groundedState = createTestGameState({
        board: setupBoardWithFloor(19),
        piece: createTestPiece("T", 5, 17), // Start in middle, grounded
      });

      expect(groundedState.piece).toBeTruthy();
      if (!groundedState.piece) throw new Error("Expected piece to exist");
      expect(isAtBottom(groundedState.board, groundedState.piece)).toBe(true);

      const shiftLeftCmd: Command = { kind: "ShiftToWallLeft" };
      const result = applyCommands(groundedState, [shiftLeftCmd]);

      // Should move to left wall (x=0 for T piece center)
      expect(result.state.piece).toBeTruthy();
      expect(result.state.piece?.x).toBe(0);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        fromX: 5,
        kind: "MovedLeft",
        tick: groundedState.tick,
        toX: 0, // Moved all the way to wall
      });

      expect(result.sideEffects.lockResetEligible).toBe(true);
      expect(result.sideEffects.lockResetReason).toBe("move");
    });

    test("ShiftToWallRight moves to right wall", () => {
      const groundedState = createTestGameState({
        board: setupBoardWithFloor(19),
        piece: createTestPiece("T", 4, 17), // Grounded position
      });

      const shiftRightCmd: Command = { kind: "ShiftToWallRight" };
      const result = applyCommands(groundedState, [shiftRightCmd]);

      // T piece can move to x=7 (rightmost position where it fits)
      expect(result.state.piece).toBeTruthy();
      expect(result.state.piece?.x).toBe(7);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        fromX: 4,
        kind: "MovedRight",
        tick: groundedState.tick,
        toX: 7,
      });

      expect(result.sideEffects.lockResetEligible).toBe(true);
    });

    test("no-op if already at wall", () => {
      const state = createTestGameState({
        piece: createTestPiece("T", 0, 10), // Already at left wall
      });

      const shiftLeftCmd: Command = { kind: "ShiftToWallLeft" };
      const result = applyCommands(state, [shiftLeftCmd]);

      expect(result.state.piece).toBeTruthy();
      expect(result.state.piece?.x).toBe(0); // No change
      expect(result.events).toHaveLength(0); // No event since no movement
      expect(result.sideEffects.lockResetEligible).toBe(false);
    });
  });

  describe("SoftDropOn/Off", () => {
    test("emits SoftDropToggled and updates physics.softDropOn; no immediate vertical move here", () => {
      const state = createTestGameState({
        physics: { ...createTestGameState().physics, softDropOn: false },
      });

      const softDropOnCmd: Command = { kind: "SoftDropOn" };
      const result = applyCommands(state, [softDropOnCmd]);

      expect(result.state.physics.softDropOn).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        kind: "SoftDropToggled",
        on: true,
        tick: state.tick,
      });

      // Piece position should not change immediately
      expect(result.state.piece).toEqual(state.piece);
    });

    test("SoftDropOff turns off soft drop", () => {
      const state = createTestGameState({
        physics: { ...createTestGameState().physics, softDropOn: true },
      });

      const softDropOffCmd: Command = { kind: "SoftDropOff" };
      const result = applyCommands(state, [softDropOffCmd]);

      expect(result.state.physics.softDropOn).toBe(false);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        kind: "SoftDropToggled",
        on: false,
        tick: state.tick,
      });
    });

    test("no-op if soft drop already in requested state", () => {
      const state = createTestGameState({
        physics: { ...createTestGameState().physics, softDropOn: true },
      });

      const softDropOnCmd: Command = { kind: "SoftDropOn" };
      const result = applyCommands(state, [softDropOnCmd]);

      expect(result.state.physics.softDropOn).toBe(true); // Unchanged
      expect(result.events).toHaveLength(0); // No event
    });
  });

  describe("HardDrop", () => {
    test("sets sideEffects.hardDropped=true and places piece at bottom in state", () => {
      const state = createTestGameState({
        board: setupBoardWithFloor(18), // Floor at y=18 leaves space for T piece above
        piece: createTestPiece("T", 4, 5), // High up
      });

      const hardDropCmd: Command = { kind: "HardDrop" };
      const result = applyCommands(state, [hardDropCmd]);

      // Piece should be moved to bottom - T piece drops to y=16 (bottom cells at y=17, floor at y=18)
      expect(result.state.piece).toBeTruthy();
      expect(result.state.piece?.y).toBe(16); // Just above floor
      expect(result.sideEffects.hardDropped).toBe(true);

      // No events emitted by hard drop command itself
      expect(result.events).toHaveLength(0);
    });

    test("no-op if no active piece", () => {
      const state = createTestGameState({ piece: null });

      const hardDropCmd: Command = { kind: "HardDrop" };
      const result = applyCommands(state, [hardDropCmd]);

      expect(result.state.piece).toBe(null);
      expect(result.sideEffects.hardDropped).toBe(false);
      expect(result.events).toHaveLength(0);
    });
  });

  describe("Hold", () => {
    test("when hold unused this turn, emits Held; if hold empty, stores current piece and spawns next", () => {
      const state = createTestGameState({
        hold: { piece: null, usedThisTurn: false },
        piece: createTestPiece("T"),
      });

      const holdCmd: Command = { kind: "Hold" };
      const result = applyCommands(state, [holdCmd]);

      // Current piece should be stored in hold
      expect(result.state.hold.piece).toBe("T");
      expect(result.state.hold.usedThisTurn).toBe(true);
      expect(result.state.piece).toBe(null); // Active piece cleared

      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        kind: "Held",
        swapped: false, // No piece was in hold
        tick: state.tick,
      });

      // No spawn override since hold was empty
      expect(result.sideEffects.spawnOverride).toBeUndefined();
    });

    test("if hold occupied, sets spawnOverride to swap in held piece", () => {
      const state = createTestGameState({
        hold: { piece: "I", usedThisTurn: false },
        piece: createTestPiece("T"),
      });

      const holdCmd: Command = { kind: "Hold" };
      const result = applyCommands(state, [holdCmd]);

      // Pieces should be swapped
      expect(result.state.hold.piece).toBe("T"); // Current piece now held
      expect(result.state.hold.usedThisTurn).toBe(true);
      expect(result.state.piece).toBe(null); // Active piece cleared

      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        kind: "Held",
        swapped: true, // Piece was swapped
        tick: state.tick,
      });

      // Spawn override should be set to the previously held piece
      expect(result.sideEffects.spawnOverride).toBe("I");
    });

    test("no-op when hold already used this turn", () => {
      const state = createTestGameState({
        hold: { piece: "I", usedThisTurn: true },
        piece: createTestPiece("T"),
      });

      const holdCmd: Command = { kind: "Hold" };
      const result = applyCommands(state, [holdCmd]);

      // Nothing should change
      expect(result.state.hold).toEqual(state.hold);
      expect(result.state.piece).toEqual(state.piece);
      expect(result.events).toHaveLength(0);
      expect(result.sideEffects.spawnOverride).toBeUndefined();
    });

    test("no-op when no active piece", () => {
      const state = createTestGameState({
        hold: { piece: null, usedThisTurn: false },
        piece: null,
      });

      const holdCmd: Command = { kind: "Hold" };
      const result = applyCommands(state, [holdCmd]);

      expect(result.state.hold).toEqual(state.hold);
      expect(result.state.piece).toBe(null);
      expect(result.events).toHaveLength(0);
    });
  });

  describe("Multiple commands", () => {
    test("processes commands sequentially and accumulates side effects", () => {
      const state = createTestGameState({
        board: setupBoardWithFloor(19),
        physics: { ...createTestGameState().physics, softDropOn: false },
        piece: createTestPiece("T", 5, 17), // Grounded position
      });

      const commands: Array<Command> = [
        { kind: "MoveLeft" },
        { kind: "RotateCW" },
        { kind: "SoftDropOn" },
      ];

      const result = applyCommands(state, commands);

      // Should have all three events
      expect(result.events).toHaveLength(3);
      expect(result.events[0]?.kind).toBe("MovedLeft");
      expect(result.events[1]?.kind).toBe("Rotated");
      expect(result.events[2]?.kind).toBe("SoftDropToggled");

      // Both move and rotate were grounded, so lockResetEligible should be true
      expect(result.sideEffects.lockResetEligible).toBe(true);
      expect(result.sideEffects.lockResetReason).toBe("move"); // First reset reason

      // Final state should reflect all changes
      expect(result.state.piece).toBeTruthy();
      expect(result.state.piece?.x).toBe(3); // Moved left and potentially kicked during rotation
      expect(result.state.piece).toBeTruthy();
      expect(result.state.piece?.rot).toBe("right"); // Rotated CW
      expect(result.state.physics.softDropOn).toBe(true); // Soft drop on
    });

    test("side effects are OR'd together", () => {
      const state = createTestGameState({
        board: setupBoardWithFloor(18),
        hold: { piece: "I", usedThisTurn: false },
        piece: createTestPiece("T", 4, 5),
      });

      const commands: Array<Command> = [
        { kind: "HardDrop" }, // Sets hardDropped=true
        { kind: "Hold" }, // Sets spawnOverride
      ];

      const result = applyCommands(state, commands);

      expect(result.sideEffects.hardDropped).toBe(true);
      expect(result.sideEffects.spawnOverride).toBe("I");
    });
  });
});
