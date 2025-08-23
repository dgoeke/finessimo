import { GameState, Action, Board, TimingConfig, GameplayConfig } from './types';
import { tryMove, moveToWall, dropToBottom, lockPiece, isAtBottom, getCompletedLines, clearLines } from '../core/board';
import { tryRotate, getNextRotation } from '../core/srs';

// Create an empty board
function createEmptyBoard(): Board {
  return {
    width: 10,
    height: 20,
    cells: new Uint8Array(200)
  };
}

// Default timing configuration
const defaultTimingConfig: TimingConfig = {
  tickHz: 60,
  dasMs: 133,
  arrMs: 2,
  softDropCps: 20,
  lockDelayMs: 500,
  lineClearDelayMs: 0
};

// Default gameplay configuration
const defaultGameplayConfig: GameplayConfig = {
  allow180Rotation: true,
  finesseCancelMs: 50
};

// Initial game state
function createInitialState(
  seed?: string,
  timing?: Partial<TimingConfig>,
  gameplay?: Partial<GameplayConfig>
): GameState {
  return {
    board: createEmptyBoard(),
    active: undefined,
    hold: undefined,
    canHold: true,
    nextQueue: [],
    rng: { seed: seed || 'default' }, // Placeholder RNG state
    timing: { ...defaultTimingConfig, ...timing },
    gameplay: { ...defaultGameplayConfig, ...gameplay },
    tick: 0,
    status: 'playing',
    stats: {},
    inputLog: []
  };
}

export const reducer: (state: Readonly<GameState>, action: Action) => GameState = (
  state: Readonly<GameState>,
  action: Action
): GameState => {
  if (!action) {
    return state;
  }
  
  switch (action.type) {
    case 'Init':
      return createInitialState(action.seed, action.timing, action.gameplay);

    case 'Lock':
      // Defensive: only process if state has valid tick property
      if (!state || typeof state !== 'object' || typeof state.tick !== 'number') {
        return state;
      }
      // Stub implementation - demonstrates a state change for testing
      return {
        ...state,
        active: undefined,
        canHold: true,
        inputLog: [], // Clear input log after lock
        tick: state.tick + 1
      };

    case 'Tick':
      // Defensive: only process if state has valid tick property
      if (!state || typeof state !== 'object' || typeof state.tick !== 'number') {
        return state;
      }
      return {
        ...state,
        tick: state.tick + 1
      };

    case 'Move':
      // Only process if we have an active piece
      if (!state.active) {
        return state;
      }
      
      let movedPiece;
      if (action.source === 'das') {
        // For DAS, move to wall
        movedPiece = moveToWall(state.board, state.active, action.dir);
      } else {
        // For tap, try single move
        movedPiece = tryMove(state.board, state.active, action.dir, 0);
        if (!movedPiece) {
          return state; // Can't move
        }
      }
      
      return {
        ...state,
        active: movedPiece
      };

    case 'Rotate':
      // Only process if we have an active piece
      if (!state.active) {
        return state;
      }
      
      const targetRot = getNextRotation(state.active.rot, action.dir);
      const rotatedPiece = tryRotate(
        state.active,
        targetRot,
        state.board,
        state.gameplay.allow180Rotation
      );
      
      if (!rotatedPiece) {
        return state; // Can't rotate
      }
      
      return {
        ...state,
        active: rotatedPiece
      };

    case 'HardDrop':
      // Only process if we have an active piece
      if (!state.active) {
        return state;
      }
      
      const droppedPiece = dropToBottom(state.board, state.active);
      const newBoard = lockPiece(state.board, droppedPiece);
      const completedLines = getCompletedLines(newBoard);
      
      let finalBoard = newBoard;
      if (completedLines.length > 0) {
        finalBoard = clearLines(newBoard, completedLines);
      }
      
      return {
        ...state,
        board: finalBoard,
        active: undefined,
        canHold: true,
        inputLog: [] // Clear input log after piece locks
      };

    case 'SoftDrop':
      // Only process if we have an active piece
      if (!state.active) {
        return state;
      }
      
      if (action.on) {
        // Start soft drop - try to move down one cell
        const softDroppedPiece = tryMove(state.board, state.active, 0, 1);
        return {
          ...state,
          active: softDroppedPiece || state.active
        };
      }
      
      // Soft drop off - no state change needed
      return state;

    case 'Hold':
      // Only process if we have an active piece and can hold
      if (!state.active || !state.canHold) {
        return state;
      }
      
      const heldPieceId = state.active.id;
      
      return {
        ...state,
        active: undefined, // Will be replaced by spawn logic
        hold: heldPieceId,
        canHold: false
      };

    case 'ClearLines':
      const clearedBoard = clearLines(state.board, action.lines);
      return {
        ...state,
        board: clearedBoard
      };

    case 'EnqueueInput':
      // Defensive: only process if state has valid inputLog array
      if (!state || typeof state !== 'object' || !Array.isArray(state.inputLog) || !action.event) {
        return state;
      }
      return {
        ...state,
        inputLog: [...state.inputLog, { ...action.event }]
      };

    default:
      // No-op default case - returns state unchanged
      return state;
  }
};