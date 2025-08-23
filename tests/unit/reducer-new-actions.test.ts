import { reducer } from '../../src/state/reducer';

describe('Reducer - new action branches', () => {
  it('handles SetMode', () => {
    const init = reducer(undefined as any, { type: 'Init' });
    const state = reducer(init, { type: 'SetMode', mode: 'guided' });
    expect(state.currentMode).toBe('guided');
    expect(state.finesseFeedback).toBeNull();
    expect(state.modePrompt).toBeNull();
  });

  it('handles UpdateFinesseFeedback', () => {
    const init = reducer(undefined as any, { type: 'Init' });
    const fb = { message: 'ok', isOptimal: true, timestamp: Date.now() };
    const state = reducer(init, { type: 'UpdateFinesseFeedback', feedback: fb });
    expect(state.finesseFeedback).toEqual(fb);
  });

  it('handles UpdateModePrompt', () => {
    const init = reducer(undefined as any, { type: 'Init' });
    const state = reducer(init, { type: 'UpdateModePrompt', prompt: 'Do this' });
    expect(state.modePrompt).toBe('Do this');
  });
});

