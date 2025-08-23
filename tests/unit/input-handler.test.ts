import { DOMInputHandler, KeyBindings, normalizeInputSequence } from '../../src/input/handler';
import { InputEvent } from '../../src/state/types';

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
  let dispatched: any[];

  beforeEach(() => {
    handler = new DOMInputHandler();
    dispatched = [];
    handler.init((a) => dispatched.push(a));
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
    const store = JSON.parse(localStorage.getItem('finessimo') || '{}');
    expect(store.keyBindings).toBeTruthy();
    expect(store.keyBindings.MoveLeft).toContain('KeyQ');

    // Private mapKeyToAction reflects new mapping
    const map = (handler as any).mapKeyToAction.bind(handler);
    expect(map('KeyQ', 'down')).toBe('LeftDown');
    expect(map('KeyE', 'down')).toBe('RightDown');
    expect(map('KeyQ', 'up')).toBe('LeftUp');
    expect(map('KeyI', 'down')).toBe('RotateCW');
    expect(map('KeyU', 'down')).toBe('RotateCCW');
    expect(map('KeyH', 'down')).toBe('HardDrop');
    expect(map('KeyO', 'down')).toBe('Hold');
  });

  test('keydown/keyup suppressed while settings overlay open', () => {
    document.body.classList.add('settings-open');
    const kd = new KeyboardEvent('keydown', { code: 'KeyA' });
    const ku = new KeyboardEvent('keyup', { code: 'KeyA' });
    // @ts-ignore access private for test
    (handler as any).handleKeyDown(kd);
    // @ts-ignore access private for test
    (handler as any).handleKeyUp(ku);
    expect(dispatched.length).toBe(0);
  });

  test('DAS then ARR pulses using functional now param', () => {
    const state: any = { timing: { dasMs: 100, arrMs: 50, softDropCps: 20 } };
    // Simulate holding Right
    (handler as any).state.currentDirection = 1;
    (handler as any).state.dasStartTime = 1000; // press time
    (handler as any).state.arrLastTime = undefined;

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
