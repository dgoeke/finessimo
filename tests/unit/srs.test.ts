import { canRotate, tryRotate, getNextRotation } from '../../src/core/srs';
import { createEmptyBoard } from '../../src/core/board';
import { ActivePiece, Board } from '../../src/state/types';

describe('SRS Rotation Logic', () => {
  let emptyBoard: Board;

  beforeEach(() => {
    emptyBoard = createEmptyBoard();
  });

  describe('getNextRotation', () => {
    it('should rotate clockwise correctly', () => {
      expect(getNextRotation('spawn', 'CW')).toBe('right');
      expect(getNextRotation('right', 'CW')).toBe('left');
      expect(getNextRotation('left', 'CW')).toBe('spawn');
    });

    it('should rotate counter-clockwise correctly', () => {
      expect(getNextRotation('spawn', 'CCW')).toBe('left');
      expect(getNextRotation('left', 'CCW')).toBe('right');
      expect(getNextRotation('right', 'CCW')).toBe('spawn');
    });
  });

  describe('O piece rotation', () => {
    const oPiece: ActivePiece = {
      id: 'O',
      rot: 'spawn',
      x: 4,
      y: 0
    };

    it('should not allow O piece to change rotation', () => {
      expect(canRotate(oPiece, 'right', emptyBoard)).toBe(false);
      expect(canRotate(oPiece, 'spawn', emptyBoard)).toBe(true);
    });

    it('should return null for invalid O piece rotations', () => {
      expect(tryRotate(oPiece, 'right', emptyBoard)).toBeNull();
      expect(tryRotate(oPiece, 'spawn', emptyBoard)).toEqual(oPiece);
    });
  });

  describe('Basic rotation checks', () => {
    const tPiece: ActivePiece = {
      id: 'T',
      rot: 'spawn',
      x: 4,
      y: 2
    };

    it('should allow valid rotations on empty board', () => {
      expect(canRotate(tPiece, 'right', emptyBoard)).toBe(true);
      expect(canRotate(tPiece, 'left', emptyBoard)).toBe(true);
    });

    it('should perform valid rotations on empty board', () => {
      const rotatedRight = tryRotate(tPiece, 'right', emptyBoard);
      expect(rotatedRight).not.toBeNull();
      expect(rotatedRight!.rot).toBe('right');
      expect(rotatedRight!.id).toBe('T');
    });
  });

  describe('Wall kick behavior', () => {
    it('should handle blocked rotation with successful kick', () => {
      // Create a board with some obstacles
      const blockedBoard = createEmptyBoard();
      // Place a block that would interfere with basic rotation
      blockedBoard.cells[5 * 10 + 2] = 1; // Block at (2, 5)

      const tPiece: ActivePiece = {
        id: 'T',
        rot: 'spawn',
        x: 3,
        y: 4
      };

      // Should still be able to rotate due to wall kicks
      const rotated = tryRotate(tPiece, 'right', blockedBoard);
      expect(rotated).not.toBeNull();
      expect(rotated!.rot).toBe('right');
    });

    it('should return null when no valid kick position exists', () => {
      // Create a completely blocked scenario
      const fullyBlockedBoard = createEmptyBoard();
      
      // Block all positions around the piece
      for (let x = 2; x <= 6; x++) {
        for (let y = 1; y <= 4; y++) {
          if (!(x === 4 && y === 2)) { // Don't block the piece itself
            fullyBlockedBoard.cells[y * 10 + x] = 1;
          }
        }
      }

      const tPiece: ActivePiece = {
        id: 'T',
        rot: 'spawn',
        x: 4,
        y: 2
      };

      const rotated = tryRotate(tPiece, 'right', fullyBlockedBoard);
      expect(rotated).toBeNull();
    });
  });

  describe('I piece special behavior', () => {
    const iPiece: ActivePiece = {
      id: 'I',
      rot: 'spawn',
      x: 3,
      y: 1
    };

    it('should use I piece kick table for I piece', () => {
      // I piece should be able to rotate in its spawn position
      expect(canRotate(iPiece, 'right', emptyBoard)).toBe(true);
      
      const rotated = tryRotate(iPiece, 'right', emptyBoard);
      expect(rotated).not.toBeNull();
      expect(rotated!.rot).toBe('right');
      expect(rotated!.id).toBe('I');
    });
  });

  describe('Edge cases', () => {
    it('should handle rotation at board boundaries', () => {
      // Test piece at left edge
      const leftEdgePiece: ActivePiece = {
        id: 'T',
        rot: 'spawn',
        x: 1,
        y: 2
      };

      expect(canRotate(leftEdgePiece, 'right', emptyBoard)).toBe(true);

      // Test piece at right edge
      const rightEdgePiece: ActivePiece = {
        id: 'T',
        rot: 'spawn',
        x: 8,
        y: 2
      };

      expect(canRotate(rightEdgePiece, 'left', emptyBoard)).toBe(true);
    });

    it('should handle rotation near top of board (negative y)', () => {
      const highPiece: ActivePiece = {
        id: 'T',
        rot: 'spawn',
        x: 4,
        y: -1
      };

      // Should still work with negative y coordinates
      expect(canRotate(highPiece, 'right', emptyBoard)).toBe(true);
    });

    it('should return current rotation for invalid direction in getNextRotation', () => {
      // Test invalid direction that would trigger the fallback
      const invalidDirection = 'INVALID' as any;
      const result = getNextRotation('spawn', invalidDirection);
      expect(result).toBe('spawn'); // Should return current rotation unchanged
    });

    it('should handle edge case scenarios that might not have kick data', () => {
      // Test with a scenario that could potentially create missing kick data
      // Create an unusual piece position that might stress the kick system
      const edgePiece: ActivePiece = {
        id: 'T',
        rot: 'spawn',
        x: 4,
        y: 2
      };
      
      // This should work normally
      expect(canRotate(edgePiece, 'right', emptyBoard)).toBe(true);
      expect(tryRotate(edgePiece, 'right', emptyBoard)).not.toBeNull();
    });

    it('should return false/null when no kick data exists for rotation', () => {
      const tPiece: ActivePiece = {
        id: 'T',
        rot: 'spawn',
        x: 4,
        y: 2
      };

      // Mock getKickTable to return an empty object to test missing kick data
      const originalKickTable = (global as any).getKickTable;
      jest.doMock('../../src/core/srs', () => ({
        ...jest.requireActual('../../src/core/srs'),
        getKickTable: () => ({}) // Return empty kick table
      }));

      // Test that functions handle missing kick data gracefully
      // Note: Since getKickTable is not exported, we'll test with an invalid rotation instead
      // This creates a scenario where kickTable[kickKey] returns undefined
      const invalidRotation = 'invalid' as any;
      
      expect(canRotate(tPiece, invalidRotation, emptyBoard)).toBe(false);
      expect(tryRotate(tPiece, invalidRotation, emptyBoard)).toBeNull();
      
      // Restore original function if it existed
      if (originalKickTable) {
        (global as any).getKickTable = originalKickTable;
      }
    });

    it('should return false when all kick attempts fail', () => {
      // Create a board where all possible kick positions are blocked
      const fullyBlockedBoard = createEmptyBoard();
      
      // Create a T piece at spawn position
      const tPiece: ActivePiece = {
        id: 'T',
        rot: 'spawn',
        x: 4,
        y: 2
      };
      
      // Block all possible positions that kicks could place the piece
      // This includes the original position and all kick offsets
      for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 6; y++) {
          fullyBlockedBoard.cells[y * 10 + x] = 1;
        }
      }

      // Now test that rotation fails when all kicks are blocked
      expect(canRotate(tPiece, 'right', fullyBlockedBoard)).toBe(false);
      expect(tryRotate(tPiece, 'right', fullyBlockedBoard)).toBeNull();
    });
  });
});