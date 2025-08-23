import { DOMInputHandler, KeyBindings, normalizeInputSequence } from '../../src/input/handler';
import { InputEvent, Action, GameState } from '../../src/state/types';

describe('normalizeInputSequence', () => {
  test('cancels opposite inputs within window', () => {
    const t = 1000;
    const events: InputEvent[] = [
      { tMs: t, frame: 1, action: 'LeftDown' },
      { tMs: t + 40, frame: 2, action: 'RightDown' }, // within 50ms window
      { tMs: t + 200, frame: 3, action: 'RotateCW' },
    ];
    const out = normalizeInputSequence(events, 50);
    expect(out).toEqual(['RotateCW']);
  });

  test('keeps inputs outside cancel window', () => {
    const t = 1000;
    const events: InputEvent[] = [
      { tMs: t, frame: 1, action: 'LeftDown' },
      { tMs: t + 80, frame: 2, action: 'RightDown' }, // outside 50ms window
    ];
    const out = normalizeInputSequence(events, 50);
    expect(out).toEqual(['LeftDown', 'RightDown']);
  });
});

describe('DOMInputHandler keybindings and suppression', () => {
  let handler: DOMInputHandler;
  let dispatched: Action[];

  beforeEach(() => {
    handler = new DOMInputHandler();
    dispatched = [] as Action[];
    handler.init((a: Action) => dispatched.push(a));
    handler.start();
  });

  afterEach(() => {
    handler.stop();
    document.body.classList.remove('settings-open');
    jest.restoreAllMocks();
  });

  test('setKeyBindings persists and affects mapping', () => {
    const bindings: KeyBindings = {
      MoveLeft: ['KeyQ'],
      MoveRight: ['KeyE'],
      SoftDrop: ['KeyS'],
      HardDrop: ['KeyH'],
      RotateCW: ['KeyI'],
      RotateCCW: ['KeyU'],
      Hold: ['KeyO'],
    };
    handler.setKeyBindings(bindings);

    // Consolidated store should contain keyBindings
    const raw = localStorage.getItem('finessimo');
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const keyBindings = (typeof parsed === 'object' && parsed && 'keyBindings' in parsed)
      ? (parsed as { keyBindings: KeyBindings }).keyBindings
      : undefined;
    expect(keyBindings).toBeTruthy();
    expect(keyBindings?.MoveLeft).toContain('KeyQ');

    // Private mapKeyToAction reflects new mapping
    // Simulate keydown/keyup events to assert mappings indirectly
    const kd = new KeyboardEvent('keydown', { code: 'KeyQ' });
    const ku = new KeyboardEvent('keyup', { code: 'KeyQ' });
    // @ts-expect-error access private for test harness
    handler.handleKeyDown(kd);
    // @ts-expect-error access private for test harness
    handler.handleKeyUp(ku);
    expect(dispatched.some(a => a.type === 'EnqueueInput' && a.event.action === 'LeftDown')).toBe(true);
    // Clear and test another mapping
    dispatched.length = 0;
    // @ts-expect-error access private for test harness
    handler.handleKeyDown(new KeyboardEvent('keydown', { code: 'KeyI' }));
    expect(dispatched.some(a => a.type === 'Rotate' && a.dir === 'CW')).toBe(true);
  });

  test('keydown/keyup suppressed while settings overlay open', () => {
    document.body.classList.add('settings-open');
    const kd = new KeyboardEvent('keydown', { code: 'KeyA' });
    const ku = new KeyboardEvent('keyup', { code: 'KeyA' });
    // @ts-expect-error accessing private method for testing event mapping
    handler.handleKeyDown(kd);
    // @ts-expect-error accessing private method for testing event mapping
    handler.handleKeyUp(ku);
    expect(dispatched.length).toBe(0);
  });

  test('DAS then ARR pulses using functional now param', () => {
    const state = { timing: { dasMs: 100, arrMs: 50, softDropCps: 20 } } as GameState;
    // Simulate holding Right
    // @ts-expect-error access private state for test harness
    handler.state.currentDirection = 1;
    // @ts-expect-error access private state for test harness
    handler.state.dasStartTime = 1000; // press time
    // @ts-expect-error access private state for test harness
    handler.state.arrLastTime = undefined;

    // At t = 1099: no pulse yet
    handler.update(state, 1099);
    expect(dispatched.find(a => a.type === 'Move' && a.source === 'das')).toBeFalsy();
    // At t = 1100: first pulse
    handler.update(state, 1100);
    expect(dispatched.find(a => a.type === 'Move' && a.dir === 1 && a.source === 'das')).toBeTruthy();
    // Next pulse at t >= 1150
    handler.update(state, 1149);
    const countBefore = dispatched.filter(a => a.type === 'Move' && a.source === 'das').length;
    handler.update(state, 1150);
    const countAfter = dispatched.filter(a => a.type === 'Move' && a.source === 'das').length;
    expect(countAfter).toBeGreaterThan(countBefore);
  });
});
