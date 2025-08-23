import { reducer } from '../../src/state/reducer';
import { GameState } from '../../src/state/types';

describe('Reducer success paths: Rotate and Hold', () => {
  let base: GameState;

  beforeEach(() => {
    base = reducer(undefined as any, { type: 'Init' });
  });

  it('applies a successful Rotate and updates active piece', () => {
    const withPiece: GameState = {
      ...base,
      active: { id: 'T', rot: 'spawn', x: 4, y: 2 },
    };

    const rotated = reducer(withPiece, { type: 'Rotate', dir: 'CW' });
    expect(rotated).not.toBe(withPiece);
    expect(rotated.active).toBeDefined();
    expect(rotated.active!.rot).toBe('right');
  });

  it('Hold stores current piece id and clears active when allowed', () => {
    const withPiece: GameState = {
      ...base,
      active: { id: 'S', rot: 'spawn', x: 4, y: 2 },
      canHold: true,
    };

    const held = reducer(withPiece, { type: 'Hold' });
    expect(held).not.toBe(withPiece);
    expect(held.active).toBeUndefined();
    expect(held.hold).toBe('S');
    expect(held.canHold).toBe(false);
  });
});

