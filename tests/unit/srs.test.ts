import { canRotate, tryRotate, getNextRotation } from "../../src/core/srs";
import { createEmptyBoard } from "../../src/core/board";
import { ActivePiece, Board, Rot } from "../../src/state/types";
import { assertDefined } from "../test-helpers";

describe("SRS Rotation Logic", () => {
  let emptyBoard: Board;

  beforeEach(() => {
    emptyBoard = createEmptyBoard();
  });

  describe("getNextRotation", () => {
    it("should rotate clockwise correctly with 4-way SRS", () => {
      expect(getNextRotation("spawn", "CW")).toBe("right");
      expect(getNextRotation("right", "CW")).toBe("two");
      expect(getNextRotation("two", "CW")).toBe("left");
      expect(getNextRotation("left", "CW")).toBe("spawn");
    });

    it("should rotate counter-clockwise correctly with 4-way SRS", () => {
      expect(getNextRotation("spawn", "CCW")).toBe("left");
      expect(getNextRotation("left", "CCW")).toBe("two");
      expect(getNextRotation("two", "CCW")).toBe("right");
      expect(getNextRotation("right", "CCW")).toBe("spawn");
    });
  });

  describe("4-way SRS rotation sequence", () => {
    it("should cycle through all four rotation states", () => {
      const tPiece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: 4,
        y: 2,
      };

      // Test full CW rotation cycle
      let current = tPiece.rot;
      current = getNextRotation(current, "CW"); // spawn -> right
      expect(current).toBe("right");
      current = getNextRotation(current, "CW"); // right -> two
      expect(current).toBe("two");
      current = getNextRotation(current, "CW"); // two -> left
      expect(current).toBe("left");
      current = getNextRotation(current, "CW"); // left -> spawn
      expect(current).toBe("spawn");

      // Test full CCW rotation cycle
      current = tPiece.rot;
      current = getNextRotation(current, "CCW"); // spawn -> left
      expect(current).toBe("left");
      current = getNextRotation(current, "CCW"); // left -> two
      expect(current).toBe("two");
      current = getNextRotation(current, "CCW"); // two -> right
      expect(current).toBe("right");
      current = getNextRotation(current, "CCW"); // right -> spawn
      expect(current).toBe("spawn");
    });

    it("should require sequential rotations for 180-degree turns (SRS-compliant)", () => {
      const emptyBoard = createEmptyBoard();
      const tPiece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: 4,
        y: 2,
      };

      // Direct rotation to 'two' state should NOT be allowed in SRS
      const directRotateToTwo = tryRotate(tPiece, "two", emptyBoard);
      expect(directRotateToTwo).toBeNull();

      // Must rotate sequentially: spawn -> right -> two
      const firstRotation = tryRotate(tPiece, "right", emptyBoard);
      expect(firstRotation).not.toBeNull();
      assertDefined(firstRotation);
      expect(firstRotation.rot).toBe("right");

      const secondRotation = tryRotate(firstRotation, "two", emptyBoard);
      expect(secondRotation).not.toBeNull();
      assertDefined(secondRotation);
      expect(secondRotation.rot).toBe("two");

      // Test that from 'two' state, only adjacent rotations are allowed
      const tPieceTwo: ActivePiece = {
        id: "T",
        rot: "two",
        x: 4,
        y: 2,
      };

      // Direct rotation back to spawn should NOT be allowed
      const directToSpawn = tryRotate(tPieceTwo, "spawn", emptyBoard);
      expect(directToSpawn).toBeNull();

      // Adjacent rotations should work
      const toRight = tryRotate(tPieceTwo, "right", emptyBoard);
      expect(toRight).not.toBeNull();
      assertDefined(toRight);
      expect(toRight.rot).toBe("right");

      const toLeft = tryRotate(tPieceTwo, "left", emptyBoard);
      expect(toLeft).not.toBeNull();
      assertDefined(toLeft);
      expect(toLeft.rot).toBe("left");
    });
  });

  describe("O piece rotation", () => {
    const oPiece: ActivePiece = {
      id: "O",
      rot: "spawn",
      x: 4,
      y: 0,
    };

    it("should not allow O piece to change rotation", () => {
      expect(canRotate(oPiece, "right", emptyBoard)).toBe(false);
      expect(canRotate(oPiece, "two", emptyBoard)).toBe(false);
      expect(canRotate(oPiece, "left", emptyBoard)).toBe(false);
      expect(canRotate(oPiece, "spawn", emptyBoard)).toBe(true);
    });

    it("should return null for invalid O piece rotations", () => {
      expect(tryRotate(oPiece, "right", emptyBoard)).toBeNull();
      expect(tryRotate(oPiece, "two", emptyBoard)).toBeNull();
      expect(tryRotate(oPiece, "left", emptyBoard)).toBeNull();
      expect(tryRotate(oPiece, "spawn", emptyBoard)).toEqual(oPiece);
    });
  });

  describe("Basic rotation checks", () => {
    const tPiece: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: 4,
      y: 2,
    };

    it("should allow valid adjacent rotations on empty board", () => {
      expect(canRotate(tPiece, "right", emptyBoard)).toBe(true);
      expect(canRotate(tPiece, "left", emptyBoard)).toBe(true);
      // Direct 180° rotation should not be allowed in SRS
      expect(canRotate(tPiece, "two", emptyBoard)).toBe(false);
    });

    it("should perform valid adjacent rotations on empty board", () => {
      const rotatedRight = tryRotate(tPiece, "right", emptyBoard);
      expect(rotatedRight).not.toBeNull();
      assertDefined(rotatedRight);
      expect(rotatedRight.rot).toBe("right");
      expect(rotatedRight.id).toBe("T");

      const rotatedLeft = tryRotate(tPiece, "left", emptyBoard);
      expect(rotatedLeft).not.toBeNull();
      assertDefined(rotatedLeft);
      expect(rotatedLeft.rot).toBe("left");
      expect(rotatedLeft.id).toBe("T");

      // Direct 180° rotation should fail in SRS
      const rotatedTwo = tryRotate(tPiece, "two", emptyBoard);
      expect(rotatedTwo).toBeNull();
    });
  });

  describe("Wall kick behavior", () => {
    it("should handle blocked rotation with successful kick", () => {
      // Create a board with some obstacles
      const blockedBoard = createEmptyBoard();
      // Place a block that would interfere with basic rotation
      blockedBoard.cells[5 * 10 + 2] = 1; // Block at (2, 5)

      const tPiece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: 3,
        y: 4,
      };

      // Should still be able to rotate due to wall kicks
      const rotated = tryRotate(tPiece, "right", blockedBoard);
      expect(rotated).not.toBeNull();
      assertDefined(rotated);
      expect(rotated.rot).toBe("right");
    });

    it("should return null when no valid kick position exists", () => {
      // Create a completely blocked scenario
      const fullyBlockedBoard = createEmptyBoard();

      // Block all positions around the piece
      for (let x = 2; x <= 6; x++) {
        for (let y = 1; y <= 4; y++) {
          if (!(x === 4 && y === 2)) {
            // Don't block the piece itself
            fullyBlockedBoard.cells[y * 10 + x] = 1;
          }
        }
      }

      const tPiece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: 4,
        y: 2,
      };

      const rotated = tryRotate(tPiece, "right", fullyBlockedBoard);
      expect(rotated).toBeNull();
    });
  });

  describe("I piece special behavior", () => {
    const iPiece: ActivePiece = {
      id: "I",
      rot: "spawn",
      x: 3,
      y: 1,
    };

    it("should use I piece kick table for I piece", () => {
      // I piece should be able to rotate in its spawn position
      expect(canRotate(iPiece, "right", emptyBoard)).toBe(true);

      const rotated = tryRotate(iPiece, "right", emptyBoard);
      expect(rotated).not.toBeNull();
      assertDefined(rotated);
      expect(rotated.rot).toBe("right");
      expect(rotated.id).toBe("I");
    });
  });

  describe("Edge cases", () => {
    it("should handle rotation at board boundaries", () => {
      // Test piece at left edge
      const leftEdgePiece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: 1,
        y: 2,
      };

      expect(canRotate(leftEdgePiece, "right", emptyBoard)).toBe(true);

      // Test piece at right edge
      const rightEdgePiece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: 8,
        y: 2,
      };

      expect(canRotate(rightEdgePiece, "left", emptyBoard)).toBe(true);
    });

    it("should handle rotation near top of board (negative y)", () => {
      const highPiece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: 4,
        y: -1,
      };

      // Should still work with negative y coordinates
      expect(canRotate(highPiece, "right", emptyBoard)).toBe(true);
    });

    it("should return current rotation for invalid direction in getNextRotation", () => {
      // Test invalid direction that would trigger the fallback
      const invalidDirection = "INVALID" as unknown as "CW" | "CCW";
      const result = getNextRotation("spawn", invalidDirection);
      expect(result).toBe("spawn"); // Should return current rotation unchanged
    });

    it("should handle edge case scenarios that might not have kick data", () => {
      // Test with a scenario that could potentially create missing kick data
      // Create an unusual piece position that might stress the kick system
      const edgePiece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: 4,
        y: 2,
      };

      // This should work normally
      expect(canRotate(edgePiece, "right", emptyBoard)).toBe(true);
      expect(tryRotate(edgePiece, "right", emptyBoard)).not.toBeNull();
    });

    it("should return false/null when no kick data exists for rotation", () => {
      const tPiece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: 4,
        y: 2,
      };

      // Mock getKickTable to return an empty object to test missing kick data
      type GlobalWithKickTable = typeof globalThis & {
        getKickTable?: () => Record<string, unknown>;
      };
      const originalKickTable = (global as GlobalWithKickTable).getKickTable;
      jest.doMock("../../src/core/srs", () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const actual = jest.requireActual("../../src/core/srs");
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return {
          ...actual,
          getKickTable: (): Record<string, unknown> => ({}), // Return empty kick table
        };
      });

      // Test that functions handle missing kick data gracefully
      // Note: Since getKickTable is not exported, we'll test with an invalid rotation instead
      // This creates a scenario where kickTable[kickKey] returns undefined
      const invalidRotation = "invalid" as unknown as Rot;

      expect(canRotate(tPiece, invalidRotation, emptyBoard)).toBe(false);
      expect(tryRotate(tPiece, invalidRotation, emptyBoard)).toBeNull();

      // Restore original function if it existed
      if (originalKickTable) {
        (global as GlobalWithKickTable).getKickTable = originalKickTable;
      }
    });

    it("should return false when all kick attempts fail", () => {
      // Create a board where all possible kick positions are blocked
      const fullyBlockedBoard = createEmptyBoard();

      // Create a T piece at spawn position
      const tPiece: ActivePiece = {
        id: "T",
        rot: "spawn",
        x: 4,
        y: 2,
      };

      // Block all possible positions that kicks could place the piece
      // This includes the original position and all kick offsets
      for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 6; y++) {
          fullyBlockedBoard.cells[y * 10 + x] = 1;
        }
      }

      // Now test that rotation fails when all kicks are blocked
      expect(canRotate(tPiece, "right", fullyBlockedBoard)).toBe(false);
      expect(tryRotate(tPiece, "right", fullyBlockedBoard)).toBeNull();
    });
  });
});
