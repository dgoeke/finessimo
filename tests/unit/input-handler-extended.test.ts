import { DOMInputHandler, MockInputHandler } from '../../src/input/handler';
import { Action } from '../../src/state/types';

// Mock DOM listener bindings to capture handlers
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

Object.defineProperty(document, 'addEventListener', {
  writable: true,
  value: mockAddEventListener,
});

Object.defineProperty(document, 'removeEventListener', {
  writable: true,
  value: mockRemoveEventListener,
});

describe('Input Handler extended coverage', () => {
  describe('DOMInputHandler keyup suppression for ArrowUp', () => {
    it('does not dispatch any event on ArrowUp keyup', () => {
      const handler = new DOMInputHandler();
      const dispatch = jest.fn<void, [Action]>();
      handler.init(dispatch);

      // Start and capture handlers
      handler.start();
      const calls = mockAddEventListener.mock.calls as ([string, (e: KeyboardEvent) => void])[];
      const kd = calls.find(c => c[0] === 'keydown')?.[1];
      const ku = calls.find(c => c[0] === 'keyup')?.[1];

      expect(kd).toBeInstanceOf(Function);
      expect(ku).toBeInstanceOf(Function);

      // Clear any startup noise
      dispatch.mockClear();

      // Fire keyup ArrowUp and assert no dispatch occurred
      const up = new KeyboardEvent('keyup', { code: 'ArrowUp' });
      if (typeof ku === 'function') ku(up);
      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  describe('MockInputHandler RightUp branch', () => {
    it('updates internal state on RightUp', () => {
      const mock = new MockInputHandler();
      const dispatch = jest.fn<void, [Action]>();
      mock.init(dispatch);

      mock.start();
      mock.simulateInput('RightDown');
      expect(mock.getState().isRightKeyDown).toBe(true);

      mock.simulateInput('RightUp');
      const s = mock.getState();
      expect(s.isRightKeyDown).toBe(false);
      // currentDirection may change based on left state; here should be undefined
      expect(s.currentDirection).toBeUndefined();
    });
  });
});
