import { describe, test, expect } from '@jest/globals';
import { FreePlayMode } from '../../src/modes/freePlay';
import { GuidedMode } from '../../src/modes/guided';
import { GameState, ActivePiece } from '../../src/state/types';
import { FinesseResult } from '../../src/finesse/calculator';

const mockGameState: GameState = {
  board: { width: 10, height: 20, cells: new Uint8Array(200) },
  active: undefined,
  hold: undefined,
  canHold: true,
  nextQueue: [],
  rng: { seed: 'test' },
  timing: { tickHz: 60, dasMs: 133, arrMs: 2, softDropCps: 20, lockDelayMs: 500, lineClearDelayMs: 0 },
  gameplay: { finesseCancelMs: 50 },
  tick: 0,
  status: 'playing',
  stats: {},
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
    const result = mode.onPieceLocked(mockGameState, mockOptimalResult);
    
    expect(result.feedback).toContain('✓ Optimal finesse');
    expect(result.feedback).toContain('3 inputs');
    expect(result.isComplete).toBeUndefined();
    expect(result.nextPrompt).toBeUndefined();
  });

  test('should provide feedback for suboptimal finesse', () => {
    const result = mode.onPieceLocked(mockGameState, mockSuboptimalResult);
    
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

  beforeEach(() => {
    mode = new GuidedMode();
  });

  test('should provide feedback for optimal finesse and advance drill', () => {
    // Match current drill (T at x=0, rot=spawn)
    const locked: ActivePiece = { id: 'T', rot: 'spawn', x: 4, y: 0 };
    const finalPos: ActivePiece = { id: 'T', rot: 'spawn', x: 0, y: 0 };
    const result = mode.onPieceLocked(mockGameState, mockOptimalResult, locked, finalPos);
    
    expect(result.feedback).toContain('✓ Perfect!');
    expect(result.feedback).toContain('3 inputs (optimal)');
    expect(result.feedback).toContain('Moving to next drill');
    expect(result.nextPrompt).toContain('Place T-piece at right edge');
  });

  test('should provide feedback for suboptimal finesse without advancing', () => {
    const locked: ActivePiece = { id: 'T', rot: 'spawn', x: 4, y: 0 };
    const finalPos: ActivePiece = { id: 'T', rot: 'spawn', x: 0, y: 0 };
    const result = mode.onPieceLocked(mockGameState, mockSuboptimalResult, locked, finalPos);
    
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
    let result = mode.onPieceLocked(mockGameState, mockSuboptimalResult, locked, finalPos);
    expect(result.feedback).not.toContain('Optimal sequence:');
    
    // Second attempt - suboptimal
    result = mode.onPieceLocked(mockGameState, mockSuboptimalResult, locked, finalPos);
    expect(result.feedback).not.toContain('Optimal sequence:');
    
    // Third attempt - should show hint
    result = mode.onPieceLocked(mockGameState, mockSuboptimalResult, locked, finalPos);
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
    // Complete all 7 drills with matching piece/target
    for (let i = 0; i < 7; i++) {
      const drill = mode.getCurrentDrill()!;
      const locked: ActivePiece = { id: drill.piece, rot: 'spawn', x: 4, y: 0 };
      const finalPos: ActivePiece = { id: drill.piece, rot: drill.targetRot, x: drill.targetX, y: 0 };
      const result = mode.onPieceLocked(mockGameState, mockOptimalResult, locked, finalPos);
      if (i === 6) {
        expect(result.feedback).toContain('All drills completed!');
        expect(result.isComplete).toBe(true);
      }
    }
  });

  test('should track progress correctly', () => {
    const progress = mode.getProgress();
    expect(progress.current).toBe(0);
    expect(progress.total).toBe(7);
    
    // Complete one drill
    {
      const drill = mode.getCurrentDrill()!;
      const locked: ActivePiece = { id: drill.piece, rot: 'spawn', x: 4, y: 0 };
      const finalPos: ActivePiece = { id: drill.piece, rot: drill.targetRot, x: drill.targetX, y: 0 };
      mode.onPieceLocked(mockGameState, mockOptimalResult, locked, finalPos);
    }
    
    const newProgress = mode.getProgress();
    expect(newProgress.current).toBe(1);
    expect(newProgress.total).toBe(7);
  });

  test('should reset correctly', () => {
    // Advance a few drills
    {
      const drill = mode.getCurrentDrill()!;
      const locked: ActivePiece = { id: drill.piece, rot: 'spawn', x: 4, y: 0 };
      const finalPos: ActivePiece = { id: drill.piece, rot: drill.targetRot, x: drill.targetX, y: 0 };
      mode.onPieceLocked(mockGameState, mockOptimalResult, locked, finalPos);
    }
    {
      const drill = mode.getCurrentDrill()!;
      const locked: ActivePiece = { id: drill.piece, rot: 'spawn', x: 4, y: 0 };
      const finalPos: ActivePiece = { id: drill.piece, rot: drill.targetRot, x: drill.targetX, y: 0 };
      mode.onPieceLocked(mockGameState, mockOptimalResult, locked, finalPos);
    }
    
    expect(mode.getProgress().current).toBe(2);
    
    mode.reset();
    
    expect(mode.getProgress().current).toBe(0);
  });
});
