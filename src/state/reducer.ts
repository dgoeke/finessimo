import { GameState, Action, Board, TimingConfig, GameplayConfig } from './types';

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