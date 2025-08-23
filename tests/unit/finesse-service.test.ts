import { describe, test, expect } from '@jest/globals';
import { DefaultFinesseService } from '../../src/finesse/service';
import { FreePlayMode } from '../../src/modes/freePlay';
import { reducer } from '../../src/state/reducer';
import type { GameState, ActivePiece, InputEvent } from '../../src/state/types';
import { PIECES } from '../../src/core/pieces';

function baseState(): GameState {
  return reducer(undefined as any, { type: 'Init' });
}

describe('FinesseService', () => {
  const service = new DefaultFinesseService();
  const mode = new FreePlayMode();

  test('uses normalization window to cancel opposite taps', () => {
    let state = baseState();
    const events: InputEvent[] = [
      { tMs: 100, frame: 6, action: 'LeftDown' },
      { tMs: 130, frame: 8, action: 'RightDown' }, // within 50ms → cancel
      { tMs: 200, frame: 12, action: 'HardDrop' }
    ];
    state = { ...state, inputLog: events, gameplay: { finesseCancelMs: 50 } };

    // locked piece at spawn; final target is same column/rot, so optimal is HardDrop only
    const topLeft = PIECES['T'].spawnTopLeft;
    const locked: ActivePiece = { id: 'T', rot: 'spawn', x: topLeft[0], y: topLeft[1] };

    const actions = service.analyzePieceLock(state, locked, mode);
    const feedback = actions.find(a => a.type === 'UpdateFinesseFeedback');
    expect(feedback).toBeTruthy();
    // Should be optimal because normalized to just HardDrop
    // @ts-expect-error narrowing by runtime check above
    expect(feedback.feedback.isOptimal).toBe(true);
  });

  test('analyzes from spawn state (not current pre-lock position)', () => {
    let state = baseState();
    // Player performed minimal inputs to go from spawn x=3 to x=0: Left + HardDrop
    const events: InputEvent[] = [
      { tMs: 100, frame: 6, action: 'LeftDown' },
      { tMs: 200, frame: 12, action: 'HardDrop' }
    ];
    state = { ...state, inputLog: events, gameplay: { finesseCancelMs: 50 } };

    // Simulate that the piece was already at x=0 before lock
    const locked: ActivePiece = { id: 'T', rot: 'spawn', x: 0, y: 5 };

    const actions = service.analyzePieceLock(state, locked, mode);
    const feedback = actions.find(a => a.type === 'UpdateFinesseFeedback');
    expect(feedback).toBeTruthy();
    // If analyzed from spawn, optimal len is 2 and player len is 2 → optimal true
    // If erroneously analyzed from current, optimal len would be 1 (HardDrop only) → optimal false
    // @ts-expect-error narrowing by runtime check above
    expect(feedback.feedback.isOptimal).toBe(true);
  });
});

