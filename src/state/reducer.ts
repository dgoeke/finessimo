import { GameState, Action, Board, TimingConfig, GameplayConfig, PhysicsState, PieceId, ActivePiece } from './types';
import { tryMove, dropToBottom, lockPiece, getCompletedLines, clearLines } from '../core/board';
import { PIECES } from '../core/pieces';
import { tryRotate, getNextRotation } from '../core/srs';
import { createRng, getNextPiece, getNextPieces, SevenBagRng } from '../core/rng';
import { createActivePiece, canSpawnPiece, isTopOut } from '../core/spawning';

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
  lineClearDelayMs: 0,
  gravityEnabled: false, // Gravity OFF by default per DESIGN.md
  gravityMs: 500 // 500ms gravity for visibility
};

// Default gameplay configuration
const defaultGameplayConfig: GameplayConfig = {
  finesseCancelMs: 50,
  ghostPieceEnabled: true,
  nextPieceCount: 5
};

// Create initial physics state
function createInitialPhysics(): PhysicsState {
  return {
    lastGravityTime: 0,
    lockDelayStartTime: null,
    isSoftDropping: false,
    lineClearStartTime: null,
    lineClearLines: []
  };
}

// Initial game state
function createInitialState(
  seed?: string,
  timing?: Partial<TimingConfig>,
  gameplay?: Partial<GameplayConfig>,
  mode?: string
): GameState {
  const rng = createRng(seed || 'default');
  const { pieces: initialQueue, newRng } = getNextPieces(rng, 5); // Generate 5-piece preview
  
  return {
    board: createEmptyBoard(),
    active: undefined,
    hold: undefined,
    canHold: true,
    nextQueue: initialQueue,
    rng: newRng,
    timing: { ...defaultTimingConfig, ...timing },
    gameplay: { ...defaultGameplayConfig, ...gameplay },
    tick: 0,
    status: 'playing',
    stats: {
      piecesPlaced: 0,
      linesCleared: 0,
      optimalPlacements: 0,
      incorrectPlacements: 0,
      attempts: 0,
      startedAtMs: Date.now(),
      timePlayedMs: 0
    },
    physics: createInitialPhysics(),
    inputLog: [],
    currentMode: mode || 'freePlay',
    modeData: null,
    finesseFeedback: null,
    modePrompt: null
  };
}

export const reducer: (state: Readonly<GameState> | undefined, action: Action) => GameState = (
  state: Readonly<GameState> | undefined,
  action: Action
): GameState => {
  // Defensive: if action is malformed, return state unchanged (including undefined)
  const isValidAction = action && typeof action === 'object' && 'type' in (action as Record<string, unknown>);
  if (!isValidAction) {
    return state as unknown as GameState;
  }
  if (state === undefined) {
    // Only initialize on Init; otherwise preserve undefined
    if (action.type === 'Init') {
      return createInitialState(action.seed, action.timing, action.gameplay, action.mode);
    }
    return state as unknown as GameState;
  }

  // Helper: determine if locking the given piece would top-out (any cell at y < 0)
  const wouldTopOut = (piece: ActivePiece): boolean => {
    const shape = PIECES[piece.id];
    const cells = shape.cells[piece.rot];
    
    for (const [, dy] of cells) {
      const cellY = piece.y + dy;
      if (cellY < 0) {
        return true;
      }
    }
    return false;
  };

  // Helper: lock active piece, handle line clears (immediate if delay=0), reset piece/hold, and set status/topOut
  const lockCurrentPiece = (baseState: GameState, piece: ActivePiece, timestampMs: number): GameState => {
    const lockedBoard = lockPiece(baseState.board, piece);
    const completedLines = getCompletedLines(lockedBoard);
    const topOut = wouldTopOut(piece);

    const nextState: GameState = {
      ...baseState,
      board: lockedBoard,
      active: undefined,
      canHold: true,
      inputLog: [],
      physics: {
        ...baseState.physics,
        lockDelayStartTime: null
      }
    };

    if (topOut) {
      return { ...nextState, status: 'topOut' };
    }

    if (completedLines.length === 0) {
      // No lines; remain in playing state
      return nextState;
    }

    if (baseState.timing.lineClearDelayMs === 0) {
      // Immediate clear with no animation delay
      const cleared = clearLines(lockedBoard, completedLines);
      return {
        ...nextState,
        board: cleared,
        status: 'playing',
        physics: {
          ...nextState.physics,
          lineClearStartTime: null,
          lineClearLines: []
        }
      };
    }

    // Stage line clear animation
    return {
      ...nextState,
      status: 'lineClear',
      physics: {
        ...nextState.physics,
        lineClearStartTime: timestampMs,
        lineClearLines: completedLines
      }
    };
  };

  switch (action.type) {
    case 'UpdateTiming':
      return {
        ...state,
        timing: { ...state.timing, ...action.timing }
      };

    case 'UpdateGameplay':
      return {
        ...state,
        gameplay: { ...state.gameplay, ...action.gameplay }
      };

    case 'Init':
      return createInitialState(action.seed, action.timing, action.gameplay, action.mode);

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

    case 'Tick': {
      // Defensive: only process if state has valid tick property
      if (!state || typeof state !== 'object' || typeof state.tick !== 'number') {
        return state;
      }
      // Use provided timestamp or lastGravityTime as a stable reference to remain pure
      const timestampMs = action.timestampMs ?? state.physics.lastGravityTime;
      let newState = {
        ...state,
        tick: state.tick + 1
      };
      
      // Handle gravity if enabled and piece exists
      if (state.timing.gravityEnabled && state.active && state.status === 'playing') {
        const timeSinceLastGravity = timestampMs - state.physics.lastGravityTime;
        const gravityInterval = state.physics.isSoftDropping ? 
          Math.floor(1000 / state.timing.softDropCps) : 
          state.timing.gravityMs;
          
        if (timeSinceLastGravity >= gravityInterval) {
          const movedPiece = tryMove(state.board, state.active, 0, 1);
          if (movedPiece) {
            newState = {
              ...newState,
              active: movedPiece,
              physics: {
                ...newState.physics,
                lastGravityTime: timestampMs
              }
            };
          } else if (!state.physics.lockDelayStartTime) {
            // Hit bottom, start lock delay
            newState = {
              ...newState,
              physics: {
                ...newState.physics,
                lockDelayStartTime: timestampMs
              }
            };
          }
        }
        
        // Check lock delay timeout
        if (state.physics.lockDelayStartTime && 
            (timestampMs - state.physics.lockDelayStartTime) >= state.timing.lockDelayMs) {
          // Auto-lock the piece and handle line clears/top-out
          if (newState.active) {
            newState = lockCurrentPiece(newState, newState.active, timestampMs);
          }
        }
      }
      
      return newState;
    }

    case 'Spawn': {
      // Only spawn if no active piece and game is playing
      if (state.active || state.status !== 'playing') {
        return state;
      }
      
      let pieceToSpawn: PieceId;
      let spawnRng: SevenBagRng = state.rng;
      const newQueue = [...state.nextQueue];
      
      if (action.piece) {
        // Manual piece spawn (for testing) - don't advance queue/RNG
        pieceToSpawn = action.piece;
      } else {
        // Take next piece from queue for normal gameplay
        if (newQueue.length === 0) {
          return state; // No pieces available
        }
        const nextFromQueue = newQueue.shift();
        if (!nextFromQueue) return state;
        pieceToSpawn = nextFromQueue;
        
        // Refill queue to maintain exactly 5 pieces for preview
        while (newQueue.length < 5) {
          const { piece, newRng: updatedRng } = getNextPiece(spawnRng);
          newQueue.push(piece);
          spawnRng = updatedRng;
        }
      }
      
      // Check for top-out
      if (isTopOut(state.board, pieceToSpawn)) {
        return {
          ...state,
          status: 'topOut'
        };
      }
      
      const newPiece = createActivePiece(pieceToSpawn);
      return {
        ...state,
        active: newPiece,
        nextQueue: newQueue,
        rng: spawnRng,
        physics: {
          ...state.physics,
          lockDelayStartTime: null,
          lastGravityTime: state.physics.lastGravityTime // Keep existing time - spawning doesn't need to update gravity timer
        }
      };
    }

    case 'Move': {
      // Only process if we have an active piece
      if (!state.active) {
        return state;
      }
      
      // Always apply a single-cell move; DAS/ARR repeats are produced by the Input Handler
      const stepped = tryMove(state.board, state.active, action.dir, 0);
      if (!stepped) {
        return state; // Can't move
      }
      
      // Cancel lock delay if piece moves
      const newPhysics = state.physics.lockDelayStartTime ? {
        ...state.physics,
        lockDelayStartTime: null
      } : state.physics;
      
      return {
        ...state,
        active: stepped,
        physics: newPhysics
      };
    }

    case 'Rotate': {
      // Only process if we have an active piece
      if (!state.active) {
        return state;
      }
      
      const targetRot = getNextRotation(state.active.rot, action.dir);
      const rotatedPiece = tryRotate(
        state.active,
        targetRot,
        state.board
      );
      
      if (!rotatedPiece) {
        return state; // Can't rotate
      }
      
      // Cancel lock delay if piece rotates
      const newPhysicsRotate = state.physics.lockDelayStartTime ? {
        ...state.physics,
        lockDelayStartTime: null
      } : state.physics;
      
      return {
        ...state,
        active: rotatedPiece,
        physics: newPhysicsRotate
      };
    }

    case 'HardDrop': {
      // Only process if we have an active piece
      if (!state.active) {
        return state;
      }
      
      const droppedPiece = dropToBottom(state.board, state.active);
      return lockCurrentPiece(state, droppedPiece, state.physics.lastGravityTime);
    }

    case 'SoftDrop': {
      // Only process if we have an active piece
      if (!state.active) {
        return state;
      }
      
      if (action.on) {
        // Start soft drop - try to move down one cell
        const softDroppedPiece = tryMove(state.board, state.active, 0, 1);
        return {
          ...state,
          active: softDroppedPiece || state.active,
          physics: {
            ...state.physics,
            isSoftDropping: true,
            lockDelayStartTime: softDroppedPiece ? null : state.physics.lockDelayStartTime
          }
        };
      }
      
      // Soft drop off
      return {
        ...state,
        physics: {
          ...state.physics,
          isSoftDropping: false
        }
      };
    }

    case 'Hold': {
      // Only process if we have an active piece and can hold
      if (!state.active || !state.canHold) {
        return state;
      }
      
      const currentPieceId = state.active.id;
      let newActive: ActivePiece | undefined;
      const holdQueue = [...state.nextQueue];
      let newRng: SevenBagRng = state.rng;
      
      if (state.hold) {
        // Swap with held piece
        newActive = createActivePiece(state.hold);
      } else {
        // Take next piece from queue for first hold
        if (holdQueue.length === 0) {
          return state; // No pieces available
        }
        const nextPiece = holdQueue.shift();
        if (!nextPiece) return state;
        newActive = createActivePiece(nextPiece);
        
        // Refill queue
        const { piece, newRng: updatedRng } = getNextPiece(newRng);
        holdQueue.push(piece);
        newRng = updatedRng;
      }
      
      // Check if new piece can spawn
      if (!canSpawnPiece(state.board, newActive.id)) {
        return {
          ...state,
          status: 'topOut'
        };
      }
      
      return {
        ...state,
        active: newActive,
        hold: currentPieceId,
        canHold: false,
        nextQueue: holdQueue,
        rng: newRng,
        physics: {
          ...state.physics,
          lockDelayStartTime: null
        }
      };
    }

    case 'ClearLines': {
      const clearedBoard = clearLines(state.board, action.lines);
      return {
        ...state,
        board: clearedBoard
      };
    }

    case 'EnqueueInput': {
      // Defensive: only process if state has valid inputLog array
      if (!state || typeof state !== 'object' || !Array.isArray(state.inputLog) || !action.event) {
        return state;
      }
      return {
        ...state,
        inputLog: [...state.inputLog, { ...action.event }]
      };
    }

    case 'SetMode': {
      return {
        ...state,
        currentMode: action.mode,
        finesseFeedback: null,
        modePrompt: null
      };
    }

    case 'UpdateFinesseFeedback': {
      return {
        ...state,
        finesseFeedback: action.feedback
      };
    }

    case 'UpdateModePrompt': {
      return {
        ...state,
        modePrompt: action.prompt
      };
    }

    case 'UpdateGuidance': {
      return {
        ...state,
        guidance: action.guidance
      };
    }

    case 'UpdateModeData': {
      return {
        ...state,
        modeData: action.data
      };
    }

    case 'StartLineClear': {
      return {
        ...state,
        status: 'lineClear',
        physics: {
          ...state.physics,
          lineClearStartTime: action.timestampMs,
          lineClearLines: action.lines
        }
      };
    }

    case 'CompleteLineClear': {
      // Clear the lines and return to playing state
      if (state.status !== 'lineClear' || state.physics.lineClearLines.length === 0) {
        return state;
      }
      
      const compactedBoard = clearLines(state.board, state.physics.lineClearLines);
      return {
        ...state,
        board: compactedBoard,
        status: 'playing',
        physics: {
          ...state.physics,
          lineClearStartTime: null,
          lineClearLines: []
        }
      };
    }

    case 'StartLockDelay': {
      return {
        ...state,
        physics: {
          ...state.physics,
          lockDelayStartTime: action.timestampMs
        }
      };
    }

    case 'CancelLockDelay': {
      return {
        ...state,
        physics: {
          ...state.physics,
          lockDelayStartTime: null
        }
      };
    }


    default:
      // No-op default case - returns state unchanged
      return state;
  }
};
