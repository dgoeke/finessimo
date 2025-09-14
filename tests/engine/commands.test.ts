// Scaffold tests for @/engine/commands.ts (command union & dispatch expectations)
// Commands are mapped to handlers in @/engine/step/apply-commands.ts

import { applyCommands } from "@/engine/step/apply-commands";

import {
  createTestGameState,
  createTestPiece,
  createBoardWithLeftWall,
  createBoardWithRightWall,
} from "../test-helpers";

import type { Command } from "@/engine/commands";

describe("@/engine/commands — dispatch coverage", () => {
  test("Each Command.kind is handled by apply-commands (MoveLeft/Right, ShiftToWall*, Rotate*, SoftDropOn/Off, HardDrop, Hold)", () => {
    // Create a game state with an active piece to ensure commands can be processed
    const state = createTestGameState({
      piece: createTestPiece("T", 4, 5),
    });

    // Define all command variants from the Command union type
    const allCommands: ReadonlyArray<Command> = [
      { kind: "MoveLeft" },
      { kind: "MoveLeft", source: "tap" },
      { kind: "MoveLeft", source: "repeat" },
      { kind: "MoveRight" },
      { kind: "MoveRight", source: "tap" },
      { kind: "MoveRight", source: "repeat" },
      { kind: "ShiftToWallLeft" },
      { kind: "ShiftToWallRight" },
      { kind: "RotateCW" },
      { kind: "RotateCCW" },
      { kind: "SoftDropOn" },
      { kind: "SoftDropOff" },
      { kind: "HardDrop" },
      { kind: "Hold" },
    ] as const;

    // Test each command individually to ensure dispatch works
    for (const command of allCommands) {
      expect(() => {
        const result = applyCommands(state, [command]);
        // Verify the result has the expected structure
        expect(result).toHaveProperty("state");
        expect(result).toHaveProperty("events");
        expect(result).toHaveProperty("sideEffects");
        expect(Array.isArray(result.events)).toBe(true);
        expect(typeof result.sideEffects).toBe("object");
      }).not.toThrow();
    }

    // Test exhaustive coverage by attempting to process all commands at once
    // This verifies that the command dispatcher handles every variant
    expect(() => {
      applyCommands(state, allCommands);
    }).not.toThrow();

    // TypeScript compile-time check: This function should handle all Command.kind values
    // If a new command type is added to the Command union, this test will fail to compile
    // until the getCommandHandler switch statement is updated
    function assertExhaustiveCommandHandling(cmd: Command): void {
      switch (cmd.kind) {
        case "MoveLeft":
        case "MoveRight":
        case "ShiftToWallLeft":
        case "ShiftToWallRight":
        case "RotateCW":
        case "RotateCCW":
        case "SoftDropOn":
        case "SoftDropOff":
        case "HardDrop":
        case "Hold": {
          return;
        }
        default: {
          // This line should never be reached if all command kinds are handled
          // TypeScript will error if a new command kind is added but not handled above
          const exhaustiveCheck: never = cmd;
          throw new Error(`Unhandled command kind: ${String(exhaustiveCheck)}`);
        }
      }
    }

    // Verify our test covers all command variants
    allCommands.forEach(assertExhaustiveCommandHandling);
  });

  test("ShiftToWall* is only produced by Control (ARR=0 case) but engine handler still moves piece to wall when possible", () => {
    // Test ShiftToWallLeft command
    {
      // Create a state with a piece that can move left to the wall
      const state = createTestGameState({
        piece: createTestPiece("I", 5, 10), // I piece at x=5, can shift to left wall
      });

      const result = applyCommands(state, [{ kind: "ShiftToWallLeft" }]);

      // Piece should move to the left wall (x=0 for I piece spawn orientation)
      expect(result.state.piece?.x).toBe(0);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        fromX: 5,
        kind: "MovedLeft",
        tick: state.tick,
        toX: 0,
      });
    }

    // Test ShiftToWallRight command
    {
      // Create a state with a piece that can move right to the wall
      const state = createTestGameState({
        piece: createTestPiece("I", 3, 10), // I piece at x=3, can shift to right wall
      });

      const result = applyCommands(state, [{ kind: "ShiftToWallRight" }]);

      // Piece should move to the right wall (x=6 for I piece in spawn orientation)
      // I piece is 4 cells wide, so rightmost position is board.width - 4 = 6
      expect(result.state.piece?.x).toBe(6);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        fromX: 3,
        kind: "MovedRight",
        tick: state.tick,
        toX: 6,
      });
    }

    // Test ShiftToWallLeft when blocked by obstacles
    {
      // Create a board with left wall filled to block movement
      const boardWithLeftWall = createBoardWithLeftWall(20, 0);
      const state = createTestGameState({
        board: boardWithLeftWall,
        piece: createTestPiece("T", 4, 10),
      });

      const result = applyCommands(state, [{ kind: "ShiftToWallLeft" }]);

      // Piece should move as far left as possible (x=1, since x=0 is blocked)
      expect(result.state.piece?.x).toBe(1);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        fromX: 4,
        kind: "MovedLeft",
        toX: 1,
      });
    }

    // Test ShiftToWallRight when blocked by obstacles
    {
      // Create a board with right wall filled to block movement
      const boardWithRightWall = createBoardWithRightWall(20, 0);
      const state = createTestGameState({
        board: boardWithRightWall,
        piece: createTestPiece("T", 4, 10),
      });

      const result = applyCommands(state, [{ kind: "ShiftToWallRight" }]);

      // Piece should move as far right as possible (x=6, since x=9 is blocked)
      // T piece rightmost cell is at offset +2, so at x=6 it reaches x=8 (avoiding blocked x=9)
      expect(result.state.piece?.x).toBe(6);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        fromX: 4,
        kind: "MovedRight",
        toX: 6,
      });
    }

    // Test ShiftToWall when piece is already at the wall
    {
      // Test left wall - piece already at leftmost position
      const state = createTestGameState({
        piece: createTestPiece("T", 0, 10), // T piece already at leftmost position
      });

      const result = applyCommands(state, [{ kind: "ShiftToWallLeft" }]);

      // Piece should not move, no events should be generated
      expect(result.state.piece?.x).toBe(0);
      expect(result.events).toHaveLength(0);
    }

    {
      // Test right wall - piece already at rightmost position
      const state = createTestGameState({
        piece: createTestPiece("T", 7, 10), // T piece at rightmost position (board width 10, T width 3)
      });

      const result = applyCommands(state, [{ kind: "ShiftToWallRight" }]);

      // Piece should not move, no events should be generated
      expect(result.state.piece?.x).toBe(7);
      expect(result.events).toHaveLength(0);
    }
  });
});
