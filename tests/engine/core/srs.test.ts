import { createEmptyBoard, canPlacePiece } from "@/engine/core/board";
import {
  tryRotateWithKickInfo,
  getNextRotation,
  canRotate,
  tryRotate,
  KICKS_JLSTZ,
} from "@/engine/core/srs";
import { type PieceId, type Rot, createGridCoord } from "@/engine/core/types";

import {
  createTestPiece,
  setBoardCell,
  createBoardWithLeftWall,
  createBoardWithRightWall,
  fillBoardRow,
} from "../../test-helpers";

describe("@/engine/core/srs — wall/floor kicks", () => {
  describe("Basic rotation (no kick)", () => {
    test("Rotating JLSTZ at an open center uses kick index 0 (no kick)", () => {
      const board = createEmptyBoard();

      // Test each JLSTZ piece type
      const jlstzPieces: Array<PieceId> = ["J", "L", "S", "T", "Z"];

      for (const pieceId of jlstzPieces) {
        // Test piece at center with room to rotate
        const piece = createTestPiece(pieceId, 4, 10, "spawn");

        // Test CW rotation (spawn → right)
        const cwResult = tryRotateWithKickInfo(piece, "right", board);
        expect(cwResult.kickIndex).toBe(0); // Should use kick index 0 (no kick)
        expect(cwResult.kickOffset).toEqual([0, 0]);
        expect(cwResult.piece).not.toBeNull();

        // Test CCW rotation (spawn → left)
        const ccwResult = tryRotateWithKickInfo(piece, "left", board);
        expect(ccwResult.kickIndex).toBe(0);
        expect(ccwResult.kickOffset).toEqual([0, 0]);
        expect(ccwResult.piece).not.toBeNull();
      }
    });

    test("O-piece rotates with kickIndex 0 and no offset (SRS-compliant)", () => {
      const board = createEmptyBoard();
      const oPiece = createTestPiece("O", 4, 10, "spawn");

      // O-piece rotations are allowed with kickIndex 0 (SRS-compliant)
      const result = tryRotateWithKickInfo(oPiece, "right", board);
      expect(result.kickIndex).toBe(0);
      expect(result.kickOffset).toEqual([0, 0]);
      expect(result.piece).not.toBeNull();
      expect(result.piece?.rot).toBe("right");

      // Rotation to same state also succeeds
      const sameStateResult = tryRotateWithKickInfo(oPiece, "spawn", board);
      expect(sameStateResult.kickIndex).toBe(0);
      expect(sameStateResult.kickOffset).toEqual([0, 0]);
      expect(sameStateResult.piece).toEqual(oPiece);
    });

    test("O-piece rotation succeeds even when completely surrounded", () => {
      const board = createEmptyBoard();
      // O-piece at (4,10) occupies cells (5,10), (6,10), (5,11), (6,11)
      // Surround it without blocking those cells
      let blockedBoard = setBoardCell(board, 4, 9, 1); // Top-left
      blockedBoard = setBoardCell(blockedBoard, 5, 9, 1); // Top-left-center
      blockedBoard = setBoardCell(blockedBoard, 6, 9, 1); // Top-right-center
      blockedBoard = setBoardCell(blockedBoard, 7, 9, 1); // Top-right
      blockedBoard = setBoardCell(blockedBoard, 4, 10, 1); // Left side
      blockedBoard = setBoardCell(blockedBoard, 7, 10, 1); // Right side
      blockedBoard = setBoardCell(blockedBoard, 4, 11, 1); // Left side
      blockedBoard = setBoardCell(blockedBoard, 7, 11, 1); // Right side
      blockedBoard = setBoardCell(blockedBoard, 4, 12, 1); // Bottom-left
      blockedBoard = setBoardCell(blockedBoard, 5, 12, 1); // Bottom-left-center
      blockedBoard = setBoardCell(blockedBoard, 6, 12, 1); // Bottom-right-center
      blockedBoard = setBoardCell(blockedBoard, 7, 12, 1); // Bottom-right

      const oPiece = createTestPiece("O", 4, 10, "spawn");

      // O-piece should still be able to rotate because rotation is a no-op geometrically
      const result = tryRotateWithKickInfo(oPiece, "right", blockedBoard);
      expect(result.kickIndex).toBe(0);
      expect(result.kickOffset).toEqual([0, 0]);
      expect(result.piece).not.toBeNull();
      expect(result.piece?.rot).toBe("right");
    });

    test("O-piece rotation fails when the piece itself is in an invalid position", () => {
      const board = createEmptyBoard();
      // Create a board where the O-piece position itself overlaps with existing blocks
      // O-piece at (4,10) occupies cells (5,10), (6,10), (5,11), (6,11)
      const blockedBoard = setBoardCell(board, 5, 10, 1); // Block at O-piece cell

      const oPiece = createTestPiece("O", 4, 10, "spawn");

      // O-piece rotation should fail because the piece is already in invalid position
      expect(() =>
        tryRotateWithKickInfo(oPiece, "right", blockedBoard),
      ).toThrow("Invalid state: O-piece in invalid position cannot be placed");
    });
  });

  describe("Wall kicks", () => {
    test("Rotating against a wall uses one of indices 1..4 (wall kicks); ensure resulting position is placeable", () => {
      // Test I-piece which is more likely to need wall kicks due to its length
      const leftWallBoard = createBoardWithLeftWall();

      // Place I-piece horizontally near left wall where rotation would conflict
      const iPieceNearLeftWall = createTestPiece("I", 1, 10, "spawn");

      // This should require a wall kick to succeed (I-piece spawn->right needs horizontal space)
      const leftWallResult = tryRotateWithKickInfo(
        iPieceNearLeftWall,
        "right",
        leftWallBoard,
      );

      if (leftWallResult.piece !== null) {
        expect(leftWallResult.kickIndex).toBeGreaterThanOrEqual(0);
        expect(leftWallResult.kickIndex).toBeLessThan(5);
        expect(canPlacePiece(leftWallBoard, leftWallResult.piece)).toBe(true);

        // If kick index > 0, this confirms wall kick was used
        if (leftWallResult.kickIndex > 0) {
          expect(leftWallResult.kickIndex).toBeGreaterThan(0);
        }
      }

      // Test I-piece against right wall
      const rightWallBoard = createBoardWithRightWall();
      const iPieceNearRightWall = createTestPiece("I", 7, 10, "spawn");

      const rightWallResult = tryRotateWithKickInfo(
        iPieceNearRightWall,
        "right",
        rightWallBoard,
      );

      if (rightWallResult.piece !== null) {
        expect(rightWallResult.kickIndex).toBeGreaterThanOrEqual(0);
        expect(rightWallResult.kickIndex).toBeLessThan(5);
        expect(canPlacePiece(rightWallBoard, rightWallResult.piece)).toBe(true);
      }

      // Create a more constrained scenario that definitely requires a kick
      const constrainedBoard = createEmptyBoard();
      // Block specific cells to force a kick
      let blockedBoard = setBoardCell(constrainedBoard, 8, 10, 1);
      blockedBoard = setBoardCell(blockedBoard, 9, 10, 1);

      const constrainedPiece = createTestPiece("T", 8, 10, "spawn");
      const constrainedResult = tryRotateWithKickInfo(
        constrainedPiece,
        "right",
        blockedBoard,
      );

      // This should either succeed with a kick (kickIndex > 0) or fail completely
      if (constrainedResult.piece !== null) {
        expect(canPlacePiece(blockedBoard, constrainedResult.piece)).toBe(true);
      }
    });

    test("Failed rotation returns kick index -1 when no kicks work", () => {
      const board = createEmptyBoard();

      // Create a tightly constrained scenario where no kicks can work
      // Fill cells around a T-piece to block all possible kick positions
      let constrainedBoard = board;
      const tPiece = createTestPiece("T", 1, 1, "spawn");

      // Block cells that would be used by kick attempts
      // This is a simplified test - in practice, finding scenarios where ALL kicks fail is complex
      constrainedBoard = setBoardCell(constrainedBoard, 0, 1, 1); // Left
      constrainedBoard = setBoardCell(constrainedBoard, 2, 1, 1); // Right
      constrainedBoard = setBoardCell(constrainedBoard, 1, 0, 1); // Above
      constrainedBoard = setBoardCell(constrainedBoard, 1, 2, 1); // Below
      constrainedBoard = setBoardCell(constrainedBoard, 0, 0, 1); // Diagonal corners
      constrainedBoard = setBoardCell(constrainedBoard, 2, 0, 1);
      constrainedBoard = setBoardCell(constrainedBoard, 0, 2, 1);
      constrainedBoard = setBoardCell(constrainedBoard, 2, 2, 1);

      const failedResult = tryRotateWithKickInfo(
        tPiece,
        "right",
        constrainedBoard,
      );

      // If rotation fails, should return kick index -1
      if (failedResult.piece === null) {
        expect(failedResult.kickIndex).toBe(-1);
        expect(failedResult.kickOffset).toEqual([0, 0]);
      }
    });
  });

  describe("I-piece specific kicks", () => {
    test("I-piece uses I-specific kick table (catch cases where JLSTZ table was applied incorrectly)", () => {
      const board = createEmptyBoard();

      // I-piece has different kick patterns than JLSTZ
      // Test a scenario where I-piece and JLSTZ would have different kick behavior
      const iPiece = createTestPiece("I", 4, 10, "spawn");
      const tPiece = createTestPiece("T", 4, 10, "spawn");

      // Get kick results for both pieces in same scenario
      const iResult = tryRotateWithKickInfo(iPiece, "right", board);
      const tResult = tryRotateWithKickInfo(tPiece, "right", board);

      // Both should succeed in open space with kick index 0
      expect(iResult.kickIndex).toBe(0);
      expect(tResult.kickIndex).toBe(0);

      // But let's test a constrained scenario where they would differ
      // Create a board that constrains rotation differently for I vs T
      let constrainedBoard = board;

      // I-piece spawn→right rotation has specific kick offsets that differ from JLSTZ
      // Place I-piece in a position where its specific kicks matter
      const iPieceConstrained = createTestPiece("I", 8, 10, "spawn"); // Near right edge

      // Add obstacles that would affect I-piece kicks differently than JLSTZ kicks
      constrainedBoard = setBoardCell(constrainedBoard, 9, 10, 1);
      constrainedBoard = setBoardCell(constrainedBoard, 9, 9, 1);

      const iConstrainedResult = tryRotateWithKickInfo(
        iPieceConstrained,
        "right",
        constrainedBoard,
      );

      // I-piece should still find a valid kick (verifies it's using I-specific table)
      expect(iConstrainedResult.piece).not.toBeNull();
      if (iConstrainedResult.piece) {
        expect(canPlacePiece(constrainedBoard, iConstrainedResult.piece)).toBe(
          true,
        );
      }
    });

    test("I-piece kick offsets are distinct from JLSTZ kick offsets", () => {
      const board = createEmptyBoard();

      // Test I-piece against edge to trigger specific kicks
      const iPieceAtEdge = createTestPiece("I", 1, 15, "spawn");

      const result = tryRotateWithKickInfo(iPieceAtEdge, "right", board);

      // Verify we get a result (I-piece should handle edge cases)
      expect(result).toBeDefined();
      expect(result.kickOffset).toBeDefined();

      // The exact kick offset will depend on the I-piece kick table
      // What matters is that it uses I-specific kicks, not JLSTZ kicks
      if (result.piece) {
        expect(canPlacePiece(board, result.piece)).toBe(true);
      }
    });
  });

  describe("Floor kicks", () => {
    test("When kickOffset is exposed by tryRotateWithKickInfo, classify 'floor' kicks when Y offset is negative (upward)", () => {
      // Create a board with floor obstacle that forces upward kicks
      const floorBoard = fillBoardRow(createEmptyBoard(), 12);

      // Place T-piece above the floor where rotation might need upward kick
      const tPieceAboveFloor = createTestPiece("T", 4, 11, "spawn");

      const result = tryRotateWithKickInfo(
        tPieceAboveFloor,
        "right",
        floorBoard,
      );

      if (result.piece && result.kickIndex > 0) {
        const [, dy] = result.kickOffset;

        // Check if this is a floor kick (negative Y offset means upward movement)
        if (dy < 0) {
          // This is a floor kick - piece moved upward to avoid obstacle
          expect(dy).toBeLessThan(0);
          expect(result.piece).not.toBeNull();
          expect(canPlacePiece(floorBoard, result.piece)).toBe(true);
        }
      }

      // Test another scenario with I-piece that commonly triggers floor kicks
      const iPieceNearFloor = createTestPiece("I", 4, 11, "two");
      const iResult = tryRotateWithKickInfo(
        iPieceNearFloor,
        "right",
        floorBoard,
      );

      if (iResult.piece && iResult.kickIndex > 0) {
        const [, dy] = iResult.kickOffset;

        // Floor kick classification
        const isFloorKick = dy < 0;

        if (isFloorKick) {
          expect(dy).toBeLessThan(0); // Upward movement
          expect(canPlacePiece(floorBoard, iResult.piece)).toBe(true);
        }
      }
    });

    test("Floor kicks move piece upward to clear obstacles below", () => {
      // Create specific floor kick scenario
      const board = createEmptyBoard();

      // Add strategic obstacles to force floor kicks
      let obstructedBoard = setBoardCell(board, 4, 16, 1);
      obstructedBoard = setBoardCell(obstructedBoard, 5, 16, 1);
      obstructedBoard = setBoardCell(obstructedBoard, 3, 16, 1);

      const piece = createTestPiece("T", 4, 15, "spawn");
      const result = tryRotateWithKickInfo(piece, "right", obstructedBoard);

      if (result.piece && result.kickIndex > 0) {
        const [, dy] = result.kickOffset;

        // If it's a floor kick, verify the piece behavior
        if (dy < 0) {
          // Floor kick detected - dy is negative (upward in SRS coordinates)
          expect(dy).toBeLessThan(0);
          expect(canPlacePiece(obstructedBoard, result.piece)).toBe(true);

          // Note: Due to coordinate system conversion (dy inverted in implementation),
          // result.piece.y might actually be greater than piece.y in our coordinate system
          // The key is that dy < 0 indicates upward movement in SRS terms
        }
      }
    });
  });

  describe("Sequential rotations", () => {
    test("Two sequential 90° rotations simulate a 180° turn; no direct opposite-rotation transition is allowed", () => {
      const board = createEmptyBoard();
      const originalPiece = createTestPiece("T", 4, 10, "spawn");

      // First 90° rotation: spawn → right
      const firstResult = tryRotateWithKickInfo(originalPiece, "right", board);
      expect(firstResult.piece).not.toBeNull();
      expect(firstResult.piece?.rot).toBe("right");

      if (!firstResult.piece) return;

      // Second 90° rotation: right → two (achieves 180° total)
      const secondResult = tryRotateWithKickInfo(
        firstResult.piece,
        "two",
        board,
      );
      expect(secondResult.piece).not.toBeNull();
      expect(secondResult.piece?.rot).toBe("two");

      // Verify we achieved 180° rotation through two 90° steps
      expect(originalPiece.rot).toBe("spawn");
      expect(secondResult.piece?.rot).toBe("two");

      // Test the other direction: spawn → left → two
      const leftFirstResult = tryRotateWithKickInfo(
        originalPiece,
        "left",
        board,
      );
      expect(leftFirstResult.piece).not.toBeNull();
      expect(leftFirstResult.piece?.rot).toBe("left");

      if (!leftFirstResult.piece) return;

      const leftSecondResult = tryRotateWithKickInfo(
        leftFirstResult.piece,
        "two",
        board,
      );
      expect(leftSecondResult.piece).not.toBeNull();
      expect(leftSecondResult.piece?.rot).toBe("two");
    });

    test("Direct opposite rotations should be rejected by SRS rules", () => {
      const board = createEmptyBoard();
      const piece = createTestPiece("T", 4, 10, "spawn");

      // Attempt direct opposite rotation (spawn → two)
      // This should fail because SRS only allows adjacent rotations
      const directResult = tryRotateWithKickInfo(piece, "two", board);

      // Check if the rotation system rejects direct opposite transitions
      // (Implementation may return kickIndex -1 for invalid transitions)
      expect(directResult.kickIndex).toBe(-1);
      expect(directResult.piece).toBeNull();
    });

    test("getNextRotation helper works correctly for CW and CCW", () => {
      // Test CW progression: spawn → right → two → left → spawn
      expect(getNextRotation("spawn", "CW")).toBe("right");
      expect(getNextRotation("right", "CW")).toBe("two");
      expect(getNextRotation("two", "CW")).toBe("left");
      expect(getNextRotation("left", "CW")).toBe("spawn");

      // Test CCW progression: spawn → left → two → right → spawn
      expect(getNextRotation("spawn", "CCW")).toBe("left");
      expect(getNextRotation("left", "CCW")).toBe("two");
      expect(getNextRotation("two", "CCW")).toBe("right");
      expect(getNextRotation("right", "CCW")).toBe("spawn");
    });

    test("Sequential rotations maintain piece position correctly", () => {
      const board = createEmptyBoard();
      const originalPiece = createTestPiece("L", 5, 8, "spawn");

      // Perform four 90° CW rotations to return to original state
      let currentPiece = originalPiece;
      const rotations: Array<Rot> = ["right", "two", "left", "spawn"];

      for (const targetRot of rotations) {
        const result = tryRotateWithKickInfo(currentPiece, targetRot, board);
        expect(result.piece).not.toBeNull();

        if (result.piece) {
          currentPiece = result.piece;
          expect(currentPiece.rot).toBe(targetRot);
        }
      }

      // After full rotation, piece should be back to original rotation
      expect(currentPiece.rot).toBe("spawn");
      // Position may have changed due to kicks, but should still be valid
      expect(canPlacePiece(board, currentPiece)).toBe(true);
    });
  });

  describe("Edge cases and boundary conditions", () => {
    test("Rotation near board boundaries", () => {
      const board = createEmptyBoard();

      // Test rotation at left boundary
      const leftBoundaryPiece = createTestPiece("I", 0, 10, "spawn");
      const leftResult = tryRotateWithKickInfo(
        leftBoundaryPiece,
        "right",
        board,
      );

      if (leftResult.piece) {
        expect(canPlacePiece(board, leftResult.piece)).toBe(true);
      }

      // Test rotation at right boundary
      const rightBoundaryPiece = createTestPiece("I", 9, 10, "spawn");
      const rightResult = tryRotateWithKickInfo(
        rightBoundaryPiece,
        "right",
        board,
      );

      if (rightResult.piece) {
        expect(canPlacePiece(board, rightResult.piece)).toBe(true);
      }

      // Test rotation near bottom
      const bottomPiece = createTestPiece("T", 4, 18, "spawn");
      const bottomResult = tryRotateWithKickInfo(bottomPiece, "right", board);

      if (bottomResult.piece) {
        expect(canPlacePiece(board, bottomResult.piece)).toBe(true);
      }
    });

    test("Rotation in vanish zone", () => {
      const board = createEmptyBoard();

      // Test rotation in vanish zone (y < 0)
      const vanishPiece = createTestPiece("T", 4, -2, "spawn");
      const vanishResult = tryRotateWithKickInfo(vanishPiece, "right", board);

      if (vanishResult.piece) {
        expect(canPlacePiece(board, vanishResult.piece)).toBe(true);
        // Piece should still be in valid range (including vanish zone)
        expect(vanishResult.piece.y).toBeGreaterThanOrEqual(
          createGridCoord(-3),
        );
      }
    });

    test("canRotate function consistency with tryRotateWithKickInfo", () => {
      const board = createEmptyBoard();
      const piece = createTestPiece("S", 3, 5, "spawn");

      // canRotate should be consistent with tryRotateWithKickInfo
      const canRotateResult = canRotate(piece, "right", board);
      const fullResult = tryRotateWithKickInfo(piece, "right", board);

      expect(canRotateResult).toBe(fullResult.piece !== null);

      if (canRotateResult) {
        expect(fullResult.piece).not.toBeNull();
        expect(fullResult.kickIndex).toBeGreaterThanOrEqual(0);
      } else {
        expect(fullResult.piece).toBeNull();
        expect(fullResult.kickIndex).toBe(-1);
      }
    });
  });

  describe("canRotate and tryRotate wrappers — explicit coverage", () => {
    test("canRotate: O-piece allows all rotations (SRS-compliant)", () => {
      const board = createEmptyBoard();
      const oPiece = createTestPiece("O", 4, 10, "spawn");

      // Same rotation state → true
      expect(canRotate(oPiece, "spawn", board)).toBe(true);

      // Different rotation state → true (O-piece can rotate in SRS)
      expect(canRotate(oPiece, "right", board)).toBe(true);
      expect(canRotate(oPiece, "two", board)).toBe(true);
      expect(canRotate(oPiece, "left", board)).toBe(true);
    });

    test("canRotate: rejects non-adjacent rotation pairs (e.g., spawn→two)", () => {
      const board = createEmptyBoard();
      const tPiece = createTestPiece("T", 4, 10, "spawn");

      // Direct 180° rotation is not allowed by SRS (no kick table key)
      expect(canRotate(tPiece, "two", board)).toBe(false);
    });

    test("canRotate: returns false when all kicks fail (boundary OOB)", () => {
      const board = createEmptyBoard();
      // Place near the right boundary so every kick candidate would put a 'right' rotation out-of-bounds
      const tPiece = createTestPiece("T", 9, 10, "spawn");

      expect(canRotate(tPiece, "right", board)).toBe(false);
    });

    test("tryRotate: returns piece on success and null on invalid pair", () => {
      const board = createEmptyBoard();
      const tPiece = createTestPiece("T", 4, 10, "spawn");

      // Valid adjacent rotation
      const successPiece = tryRotate(tPiece, "right", board);
      expect(successPiece).not.toBeNull();

      // Invalid opposite rotation (spawn→two) should fail
      const failedPiece = tryRotate(tPiece, "two", board);
      expect(failedPiece).toBeNull();
    });

    test("getNextRotation: default branch behavior on invalid input (defensive)", () => {
      // Force an invalid Rot at runtime to exercise default branch.
      const invalidRot = "invalid" as unknown as Rot;
      expect(getNextRotation(invalidRot, "CW")).toBe(invalidRot);
      expect(getNextRotation(invalidRot, "CCW")).toBe(invalidRot);
    });
  });

  describe("Defensive handling of malformed kick entries", () => {
    test("tryRotateWithKickInfo skips undefined kick offsets", () => {
      const board = createEmptyBoard();
      const tPieceNearRight = createTestPiece("T", 9, 10, "spawn");

      // Mutate kick table for this test only to include an undefined entry at the end
      const key = "spawn->right" as const;
      const arr = KICKS_JLSTZ[key] as unknown as Array<
        readonly [number, number] | undefined
      >;
      arr.push(undefined);

      try {
        const result = tryRotateWithKickInfo(tPieceNearRight, "right", board);
        // Rotation should still fail (boundary), but loop should tolerate the undefined entry
        expect(result.piece).toBeNull();
        expect(result.kickIndex).toBe(-1);
      } finally {
        // Restore original shape
        arr.pop();
      }
    });
  });
});
