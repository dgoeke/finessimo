import { describe, test, expect, beforeEach } from '@jest/globals';
import { FreePlayMode } from '../../src/modes/freePlay';
import { GuidedMode } from '../../src/modes/guided';
import type { GameState, ActivePiece, Rot } from '../../src/state/types';
import type { FinesseResult } from '../../src/finesse/calculator';

const mockState = (): GameState => ({
  board: { width: 10, height: 20, cells: new Uint8Array(200) },
  active: undefined,
  hold: undefined,
  canHold: true,
  nextQueue: [],
  rng: { seed: 't' },
  timing: { tickHz: 60, dasMs: 133, arrMs: 2, softDropCps: 20, lockDelayMs: 500, lineClearDelayMs: 0 },
  gameplay: { finesseCancelMs: 50 },
  tick: 0,
  status: 'playing',
  stats: {},
  inputLog: [],
  currentMode: 'freePlay',
  finesseFeedback: null,
  modePrompt: null,
});

describe('FreePlayMode - extended', () => {
  test('suboptimal shorter sequence lists issues without extra inputs', () => {
    const mode = new FreePlayMode();
    const state = mockState();

    const res: FinesseResult = {
      optimalSequences: [['LeftDown', 'LeftDown', 'HardDrop']],
      playerSequence: ['LeftDown'], // shorter
      isOptimal: false,
      faults: [{ type: 'suboptimal_path', description: 'Sequence incomplete', position: 1 }]
    };

    const out = mode.onPieceLocked(state, res, { id: 'T', rot: 'spawn', x: 3, y: 0 }, { id: 'T', rot: 'spawn', x: 0, y: 0 });
    expect(out.feedback).toContain('✗ Non-optimal finesse');
    expect(out.feedback).toContain('Used 1 inputs, optimal was 3');
    expect(out.feedback).not.toContain('extra input');
    expect(out.feedback).toContain('Issues: Sequence incomplete');
  });

  test('target and expected piece helpers are null/undefined', () => {
    const mode = new FreePlayMode();
    const state = mockState();
    const target = mode.getTargetFor({ id: 'T', rot: 'spawn', x: 3, y: 0 }, state);
    const exp = mode.getExpectedPiece(state);
    expect(target).toBeNull();
    expect(exp).toBeUndefined();
  });
});

describe('GuidedMode - extended', () => {
  let mode: GuidedMode;
  let state: GameState;
  beforeEach(() => {
    mode = new GuidedMode();
    state = mockState();
  });

  test('wrong piece does not advance and gives feedback', () => {
    const current = mode.getCurrentDrill()!; // expects T first
    const wrongPiece: ActivePiece = { id: 'J', rot: 'spawn', x: 4, y: 0 };
    const finalPos: ActivePiece = { id: 'J', rot: current.targetRot, x: current.targetX, y: 0 };
    const result = mode.onPieceLocked(state, {
      optimalSequences: [['HardDrop']], playerSequence: ['HardDrop'], isOptimal: true, faults: []
    }, wrongPiece, finalPos);

    expect(result.feedback).toContain('Wrong piece');
    expect(mode.getProgress().current).toBe(0);
  });

  test('wrong target does not advance and gives feedback', () => {
    const current = mode.getCurrentDrill()!; // expects T at x target
    const locked: ActivePiece = { id: current.piece, rot: 'spawn', x: 4, y: 0 };
    // send a different target x/rot
    const badX = current.targetX === 0 ? 1 : 0;
    const badRot: Rot = current.targetRot === 'spawn' ? 'right' : 'spawn';
    const finalPos: ActivePiece = { id: current.piece, rot: badRot, x: badX, y: 0 };
    const result = mode.onPieceLocked(state, {
      optimalSequences: [['HardDrop']], playerSequence: ['HardDrop'], isOptimal: true, faults: []
    }, locked, finalPos);

    expect(result.feedback).toContain('Wrong target');
    expect(mode.getProgress().current).toBe(0);
  });

  test('getTargetFor/getExpectedPiece reflect current drill', () => {
    const cur = mode.getCurrentDrill()!;
    const target = mode.getTargetFor({ id: cur.piece, rot: 'spawn', x: 4, y: 0 }, state);
    const exp = mode.getExpectedPiece(state);
    expect(target).toEqual({ targetX: cur.targetX, targetRot: cur.targetRot });
    expect(exp).toBe(cur.piece);
  });

  test('shouldPromptNext is false when active piece exists', () => {
    const stateWithActive = { ...state, active: { id: 'T', rot: 'spawn', x: 3, y: 0 } };
    expect(mode.shouldPromptNext(stateWithActive)).toBe(false);
  });
});

