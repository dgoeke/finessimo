import { reducer } from '../../src/state/reducer';
import { GameState, Action } from '../../src/state/types';

describe('Reducer Edge Cases and Error Conditions', () => {
  let validState: GameState;
  let stateWithActivePiece: GameState;

  beforeEach(() => {
    validState = reducer(undefined as any, { type: 'Init' });
    
    // Create state with an active piece for testing actions that require one
    stateWithActivePiece = {
      ...validState,
      active: {
        id: 'T',
        rot: 'spawn',
        x: 4,
        y: 2
      }
    };
  });

  describe('Actions without active piece', () => {
    it('should return unchanged state for Move action without active piece', () => {
      const action: Action = { type: 'Move', dir: -1, source: 'tap' };
      const result = reducer(validState, action);
      expect(result).toBe(validState); // Same reference
    });

    it('should return unchanged state for Rotate action without active piece', () => {
      const action: Action = { type: 'Rotate', dir: 'CW' };
      const result = reducer(validState, action);
      expect(result).toBe(validState);
    });

    it('should return unchanged state for HardDrop action without active piece', () => {
      const action: Action = { type: 'HardDrop' };
      const result = reducer(validState, action);
      expect(result).toBe(validState);
    });

    it('should return unchanged state for SoftDrop action without active piece', () => {
      const softDropOnAction: Action = { type: 'SoftDrop', on: true };
      const softDropOffAction: Action = { type: 'SoftDrop', on: false };
      
      expect(reducer(validState, softDropOnAction)).toBe(validState);
      expect(reducer(validState, softDropOffAction)).toBe(validState);
    });

    it('should return unchanged state for Hold action without active piece', () => {
      const action: Action = { type: 'Hold' };
      const result = reducer(validState, action);
      expect(result).toBe(validState);
    });
  });

  describe('Hold action edge cases', () => {
    it('should return unchanged state when hold is not allowed', () => {
      const stateWithNoHold = {
        ...stateWithActivePiece,
        canHold: false
      };

      const action: Action = { type: 'Hold' };
      const result = reducer(stateWithNoHold, action);
      expect(result).toBe(stateWithNoHold);
    });
  });

  describe('Move action edge cases', () => {
    it('should handle DAS movement source', () => {
      const action: Action = { type: 'Move', dir: -1, source: 'das' };
      const result = reducer(stateWithActivePiece, action);
      
      expect(result).not.toBe(stateWithActivePiece);
      expect(result.active?.x).toBeLessThan(stateWithActivePiece.active!.x);
    });

    it('should handle invalid movement (blocked)', () => {
      // Create a piece at the edge that can't move further
      const edgeState = {
        ...stateWithActivePiece,
        active: {
          id: 'T' as const,
          rot: 'spawn' as const,
          x: 0, // At left edge, can't move further left
          y: 2
        }
      };

      const action: Action = { type: 'Move', dir: -1, source: 'tap' };
      const result = reducer(edgeState, action);
      expect(result).toBe(edgeState); // No movement possible
    });
  });

  describe('Rotate action edge cases', () => {
    it('should handle blocked rotation', () => {
      // Create a board with blocks that prevent rotation
      const blockedBoard = { ...validState.board };
      blockedBoard.cells = new Uint8Array(200);
      
      // Fill area around piece to block rotation
      for (let x = 3; x <= 6; x++) {
        for (let y = 1; y <= 4; y++) {
          if (!(x === 4 && y === 2)) { // Don't block piece center
            const idx = y * 10 + x;
            if (idx >= 0 && idx < 200) {
              blockedBoard.cells[idx] = 1;
            }
          }
        }
      }

      const blockedState = {
        ...stateWithActivePiece,
        board: blockedBoard
      };

      const action: Action = { type: 'Rotate', dir: 'CW' };
      const result = reducer(blockedState, action);
      expect(result).toBe(blockedState); // Rotation blocked
    });

    it('should handle 180-degree rotation when disabled', () => {
      const no180State = {
        ...stateWithActivePiece,
        gameplay: {
          ...stateWithActivePiece.gameplay,
          allow180Rotation: false
        }
      };

      const action: Action = { type: 'Rotate', dir: '180' };
      const result = reducer(no180State, action);
      expect(result).toBe(no180State); // 180 rotation blocked
    });
  });

  describe('SoftDrop action edge cases', () => {
    it('should handle soft drop when piece cannot move down', () => {
      // Create a piece at the bottom
      const bottomState = {
        ...stateWithActivePiece,
        active: {
          id: 'T' as const,
          rot: 'spawn' as const,
          x: 4,
          y: 18 // At bottom
        }
      };

      const action: Action = { type: 'SoftDrop', on: true };
      const result = reducer(bottomState, action);
      
      // Should return new state even if piece can't move
      expect(result.active).toEqual(bottomState.active);
    });

    it('should handle soft drop off', () => {
      const action: Action = { type: 'SoftDrop', on: false };
      const result = reducer(stateWithActivePiece, action);
      expect(result).toBe(stateWithActivePiece); // No state change for off
    });
  });

  describe('HardDrop with line clearing', () => {
    it('should handle hard drop that completes lines', () => {
      // Create a board with almost complete lines
      const boardWithAlmostCompleteLine = { ...validState.board };
      boardWithAlmostCompleteLine.cells = new Uint8Array(200);
      
      // Fill bottom row except for one column where T-piece will land
      for (let x = 0; x < 10; x++) {
        if (x !== 4 && x !== 5 && x !== 6) { // Leave space for T-piece
          boardWithAlmostCompleteLine.cells[19 * 10 + x] = 1;
        }
      }

      const almostCompleteState = {
        ...stateWithActivePiece,
        board: boardWithAlmostCompleteLine,
        active: {
          id: 'T' as const,
          rot: 'spawn' as const,
          x: 4,
          y: 0 // High up so it drops
        }
      };

      const action: Action = { type: 'HardDrop' };
      const result = reducer(almostCompleteState, action);
      
      expect(result.active).toBeUndefined(); // Piece should be locked
      expect(result.canHold).toBe(true); // Should reset hold
    });
  });

  describe('Invalid or malformed states', () => {
    it('should handle Lock action with invalid state structure', () => {
      const invalidState = {
        ...validState,
        tick: undefined as any // Invalid tick
      };

      const action: Action = { type: 'Lock' };
      const result = reducer(invalidState as any, action);
      expect(result).toBe(invalidState); // Should return unchanged
    });

    it('should handle Tick action with invalid state structure', () => {
      const invalidState = {
        ...validState,
        tick: 'invalid' as any // Invalid tick
      };

      const action: Action = { type: 'Tick' };
      const result = reducer(invalidState as any, action);
      expect(result).toBe(invalidState); // Should return unchanged
    });

    it('should handle EnqueueInput with invalid state', () => {
      const invalidState = {
        ...validState,
        inputLog: null as any // Invalid inputLog
      };

      const action: Action = {
        type: 'EnqueueInput',
        event: { tMs: 1000, frame: 60, action: 'HardDrop' }
      };

      const result = reducer(invalidState as any, action);
      expect(result).toBe(invalidState);
    });

    it('should handle EnqueueInput with missing event', () => {
      const action: Action = {
        type: 'EnqueueInput',
        event: undefined as any
      };

      const result = reducer(validState, action);
      expect(result).toBe(validState);
    });
  });

  describe('ClearLines action', () => {
    it('should clear specified lines from board', () => {
      // Create a board with some content
      const boardWithContent = { ...validState.board };
      boardWithContent.cells = new Uint8Array(200);
      
      // Fill some rows
      for (let x = 0; x < 10; x++) {
        boardWithContent.cells[18 * 10 + x] = 1; // Row 18
        boardWithContent.cells[19 * 10 + x] = 2; // Row 19
      }

      const stateWithContent = {
        ...validState,
        board: boardWithContent
      };

      const action: Action = { type: 'ClearLines', lines: [19] };
      const result = reducer(stateWithContent, action);
      
      expect(result.board).not.toBe(stateWithContent.board);
      expect(result.board.cells[19 * 10 + 0]).toBe(1); // Row 18 moved to 19
    });

    it('should handle empty lines array', () => {
      const action: Action = { type: 'ClearLines', lines: [] };
      const result = reducer(validState, action);
      expect(result.board).toBe(validState.board); // Same reference when no lines
    });
  });

  describe('Spawn action (unimplemented)', () => {
    it('should return unchanged state for Spawn action', () => {
      const action: Action = { type: 'Spawn' };
      const result = reducer(validState, action);
      expect(result).toBe(validState); // No-op, returns same reference
    });
  });
});