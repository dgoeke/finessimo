import { describe, test, expect } from '@jest/globals';
import { FreePlayMode } from '../../src/modes/freePlay';
import { GuidedMode } from '../../src/modes/guided';
import { GameState, ActivePiece } from '../../src/state/types';
import { createRng } from '../../src/core/rng';
import { FinesseResult } from '../../src/finesse/calculator';

const mockGameState: GameState = {
  board: { width: 10, height: 20, cells: new Uint8Array(200) },
  active: undefined,
  hold: undefined,
  canHold: true,
  nextQueue: [],
  rng: createRng('test'),
  timing: { tickHz: 60, dasMs: 133, arrMs: 2, softDropCps: 20, lockDelayMs: 500, lineClearDelayMs: 0, gravityEnabled: false, gravityMs: 1000 },
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
  finesseFeedback: null,
  modePrompt: null
};

const mockPiece: ActivePiece = {
  id: 'T',
  rot: 'spawn',
  x: 4,
  y: 0
};

const mockOptimalResult: FinesseResult = {
  optimalSequences: [['LeftDown', 'LeftDown', 'HardDrop']],
  playerSequence: ['LeftDown', 'LeftDown', 'HardDrop'],
  isOptimal: true,
  faults: []
};

const mockSuboptimalResult: FinesseResult = {
  optimalSequences: [['LeftDown', 'LeftDown', 'HardDrop']],
  playerSequence: ['LeftDown', 'RightDown', 'LeftDown', 'LeftDown', 'LeftDown', 'HardDrop'],
  isOptimal: false,
  faults: [
    {
      type: 'extra_input',
      description: 'Used 6 inputs instead of optimal 3',
      position: 3
    }
  ]
};

describe('FreePlayMode', () => {
  const mode = new FreePlayMode();

  test('should provide feedback for optimal finesse', () => {
    const result = mode.onPieceLocked(mockGameState, mockOptimalResult, mockPiece, mockPiece);
    
    expect(result.feedback).toContain('✓ Optimal finesse');
    expect(result.feedback).toContain('3 inputs');
    expect(result.isComplete).toBeUndefined();
    expect(result.nextPrompt).toBeUndefined();
  });

  test('should provide feedback for suboptimal finesse', () => {
    const result = mode.onPieceLocked(mockGameState, mockSuboptimalResult, mockPiece, mockPiece);
    
    expect(result.feedback).toContain('✗ Non-optimal finesse');
    expect(result.feedback).toContain('Used 6 inputs');
    expect(result.feedback).toContain('optimal was 3');
    expect(result.feedback).toContain('3 extra inputs');
  });

  test('should not prompt for next challenge', () => {
    expect(mode.shouldPromptNext(mockGameState)).toBe(false);
    expect(mode.getNextPrompt(mockGameState)).toBe(null);
  });
});

describe('GuidedMode', () => {
  let mode: GuidedMode;
  let state: GameState;

  beforeEach(() => {
    mode = new GuidedMode();
    state = { ...mockGameState, currentMode: 'guided', modeData: mode.initModeData?.() };
  });

  test('should provide feedback for optimal finesse and advance drill', () => {
    // Match current drill (T at x=0, rot=spawn)
    const locked: ActivePiece = { id: 'T', rot: 'spawn', x: 4, y: 0 };
    const finalPos: ActivePiece = { id: 'T', rot: 'spawn', x: 0, y: 0 };
    const result = mode.onPieceLocked(state, mockOptimalResult, locked, finalPos);
    if (result.modeData !== undefined) state = { ...state, modeData: result.modeData };
    
    expect(result.feedback).toContain('✓ Perfect!');
    expect(result.feedback).toContain('3 inputs (optimal)');
    expect(result.feedback).toContain('Moving to next drill');
    expect(result.nextPrompt).toContain('Place T-piece at right edge');
  });

  test('should provide feedback for suboptimal finesse without advancing', () => {
    const locked: ActivePiece = { id: 'T', rot: 'spawn', x: 4, y: 0 };
    const finalPos: ActivePiece = { id: 'T', rot: 'spawn', x: 0, y: 0 };
    const result = mode.onPieceLocked(state, mockSuboptimalResult, locked, finalPos);
    
    expect(result.feedback).toContain('✗ Try again!');
    expect(result.feedback).toContain('Used 6 inputs');
    expect(result.feedback).toContain('optimal is 3');
    expect(result.feedback).toContain('3 extra inputs');
    expect(result.nextPrompt).toBeUndefined();
  });

  test('should show optimal sequence hint after multiple attempts', () => {
    // First attempt - suboptimal
    const locked: ActivePiece = { id: 'T', rot: 'spawn', x: 4, y: 0 };
    const finalPos: ActivePiece = { id: 'T', rot: 'spawn', x: 0, y: 0 };
    let result = mode.onPieceLocked(state, mockSuboptimalResult, locked, finalPos);
    expect(result.feedback).not.toContain('Optimal sequence:');
    if (result.modeData !== undefined) state = { ...state, modeData: result.modeData };
    
    // Second attempt - suboptimal
    result = mode.onPieceLocked(state, mockSuboptimalResult, locked, finalPos);
    expect(result.feedback).not.toContain('Optimal sequence:');
    if (result.modeData !== undefined) state = { ...state, modeData: result.modeData };
    
    // Third attempt - should show hint
    result = mode.onPieceLocked(state, mockSuboptimalResult, locked, finalPos);
    expect(result.feedback).toContain('Optimal sequence:');
    expect(result.feedback).toContain('LeftDown → LeftDown → HardDrop');
  });

  test('should provide next prompt when no active piece', () => {
    const stateNoActive = { ...mockGameState, active: undefined };
    
    expect(mode.shouldPromptNext(stateNoActive)).toBe(true);
    
    const prompt = mode.getNextPrompt(stateNoActive);
    expect(prompt).toContain('Drill 1/7');
    expect(prompt).toContain('Place T-piece at left edge');
  });

  test('should complete all drills', () => {
    // Complete all 7 drills with matching piece/target using guidance
    for (let i = 0; i < 7; i++) {
      const guidance = mode.getGuidance(state);
      expect(guidance?.target).toBeDefined();
      const expected = mode.getExpectedPiece(state);
      expect(expected).toBeDefined();
      if (!guidance?.target || !expected) return;
      const locked: ActivePiece = { id: expected, rot: 'spawn', x: 4, y: 0 };
      const finalPos: ActivePiece = { id: locked.id, rot: guidance.target.rot, x: guidance.target.x, y: 0 };
      const result = mode.onPieceLocked(state, mockOptimalResult, locked, finalPos);
      if (result.modeData !== undefined) state = { ...state, modeData: result.modeData };
      if (i === 6) {
        expect(result.feedback).toContain('All drills completed!');
        expect(result.isComplete).toBe(true);
      }
    }
  });

  test('should track progress correctly', () => {
    const data0 = state.modeData as { currentDrillIndex: number } | undefined;
    expect((data0?.currentDrillIndex ?? 0)).toBe(0);
    
    const total = 7;
    
    // Complete one drill
    {
      const guidance = mode.getGuidance(state);
      expect(guidance?.target).toBeDefined();
      const expected = mode.getExpectedPiece(state);
      expect(expected).toBeDefined();
      if (!guidance?.target || !expected) return;
      const locked: ActivePiece = { id: expected, rot: 'spawn', x: 4, y: 0 };
      const finalPos: ActivePiece = { id: locked.id, rot: guidance.target.rot, x: guidance.target.x, y: 0 };
      const res = mode.onPieceLocked(state, mockOptimalResult, locked, finalPos);
      if (res.modeData !== undefined) state = { ...state, modeData: res.modeData };
    }
    
    const data1 = state.modeData as { currentDrillIndex: number } | undefined;
    expect((data1?.currentDrillIndex ?? 0)).toBe(1);
    expect(total).toBe(7);
  });

  test('should reset correctly', () => {
    // Advance a few drills
    {
      const guidance = mode.getGuidance(state);
      const expected = mode.getExpectedPiece(state);
      expect(guidance?.target).toBeDefined();
      expect(expected).toBeDefined();
      if (!guidance?.target || !expected) return;
      const locked: ActivePiece = { id: expected, rot: 'spawn', x: 4, y: 0 };
      const finalPos: ActivePiece = { id: locked.id, rot: guidance.target.rot, x: guidance.target.x, y: 0 };
      const res = mode.onPieceLocked(state, mockOptimalResult, locked, finalPos);
      if (res.modeData !== undefined) state = { ...state, modeData: res.modeData };
    }
    {
      const guidance = mode.getGuidance(state);
      const expected = mode.getExpectedPiece(state);
      expect(guidance?.target).toBeDefined();
      expect(expected).toBeDefined();
      if (!guidance?.target || !expected) return;
      const locked: ActivePiece = { id: expected, rot: 'spawn', x: 4, y: 0 };
      const finalPos: ActivePiece = { id: locked.id, rot: guidance.target.rot, x: guidance.target.x, y: 0 };
      const res = mode.onPieceLocked(state, mockOptimalResult, locked, finalPos);
      if (res.modeData !== undefined) state = { ...state, modeData: res.modeData };
    }
    
    expect(((state.modeData as { currentDrillIndex: number } | undefined)?.currentDrillIndex ?? 0)).toBe(2);
    
    mode.reset();
    
    // After reset, consumer should re-init modeData using initModeData
    state = { ...state, modeData: mode.initModeData?.() };
    expect(((state.modeData as { currentDrillIndex: number } | undefined)?.currentDrillIndex ?? 0)).toBe(0);
  });
});
