import { TouchInputHandler } from '../../src/input/touch';
import { Action, GameState, KeyAction } from '../../src/state/types';
import type { InputHandlerState } from '../../src/input/handler';
import { createRng } from '../../src/core/rng';

function makeState(): GameState {
  // Build a minimal valid GameState by initializing the app reducer indirectly would be complex here.
  // For our input handler update tests, we only use `timing` fields.
  return {
    board: { width: 10, height: 20, cells: new Uint8Array(200) },
    active: undefined,
    hold: undefined,
    canHold: true,
    nextQueue: [],
    rng: createRng('touch'),
    timing: {
      tickHz: 60,
      dasMs: 133,
      arrMs: 2,
      softDropCps: 20,
      lockDelayMs: 500,
      lineClearDelayMs: 0,
      gravityEnabled: false,
      gravityMs: 1000,
    },
    gameplay: { finesseCancelMs: 50 },
    tick: 0,
    status: 'playing',
    stats: {
      piecesPlaced: 0,
      linesCleared: 0,
      optimalPlacements: 0,
      incorrectPlacements: 0,
      attempts: 0,
      startedAtMs: 0,
      timePlayedMs: 0,
    },
    physics: { lastGravityTime: 0, lockDelayStartTime: null, isSoftDropping: false, lineClearStartTime: null, lineClearLines: [] },
    inputLog: [],
    currentMode: 'freePlay',
    modeData: null,
    finesseFeedback: null,
    modePrompt: null,
  };
}

describe('TouchInputHandler', () => {
  let handler: TouchInputHandler;
  let dispatched: Action[];
  interface Testable { state: InputHandlerState; triggerAction: (a: KeyAction, p: 'down' | 'up') => void }

  beforeEach(() => {
    // Provide a board-frame container like the app layout
    document.body.innerHTML = '<div class="board-frame"></div>';
    handler = new TouchInputHandler();
    dispatched = [];
    handler.init((a: Action) => dispatched.push(a));
  });

  afterEach(() => {
    handler.stop();
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  test('start creates overlay inside board-frame and stop removes it', () => {
    handler.start();
    const overlay = document.querySelector('#touch-controls');
    expect(overlay).toBeTruthy();

    handler.stop();
    const overlayAfter = document.querySelector('#touch-controls');
    expect(overlayAfter).toBeFalsy();
  });

  test('update with DAS/ARR repeats movement when direction held', () => {
    handler.start();
    const state = makeState();

    // Force internal state to simulate holding Right long enough to surpass DAS
    const now = 1_000_000;
    const h = handler as unknown as Testable;
    h.state.currentDirection = 1;
    h.state.dasStartTime = now - state.timing.dasMs;
    h.state.arrLastTime = undefined;

    handler.update(state, now);
    expect(dispatched.some(a => a.type === 'Move' && a.dir === 1 && a.source === 'das')).toBe(true);

    // Next ARR pulse after arrMs
    handler.update(state, now + state.timing.arrMs);
    // Should dispatch another repeat
    const moveCount = dispatched.filter(a => a.type === 'Move' && a.dir === 1 && a.source === 'das').length;
    expect(moveCount).toBeGreaterThanOrEqual(2);
  });

  test('soft drop pulses while engaged and stops on release', () => {
    handler.start();
    const state = makeState();
    const base = 2_000_000;

    // Engage soft drop
    (handler as unknown as Testable).triggerAction('SoftDropDown', 'down');
    expect(dispatched.find(a => a.type === 'SoftDrop' && a.on === true)).toBeTruthy();
    // Align last pulse time to base to avoid relying on Date.now in trigger
    (handler as unknown as Testable).state.softDropLastTime = base;

    // Advance time beyond interval to trigger repeat
    const interval = Math.max(1, Math.floor(1000 / Math.max(1, state.timing.softDropCps)));
    handler.update(state, base + interval);
    const softCount = dispatched.filter(a => a.type === 'SoftDrop' && a.on === true).length;
    expect(softCount).toBeGreaterThanOrEqual(2);

    // Release
    (handler as unknown as Testable).triggerAction('SoftDropDown', 'up');
    expect(dispatched.find(a => a.type === 'SoftDrop' && a.on === false)).toBeTruthy();
  });
});
