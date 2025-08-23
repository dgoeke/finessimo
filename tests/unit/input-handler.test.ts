import { MockInputHandler, InputHandlerState } from '../../src/input/handler';
import { Action, GameState, KeyAction } from '../../src/state/types';

describe('Input Handler', () => {
  let inputHandler: MockInputHandler;
  let dispatchSpy: jest.Mock<void, [Action]>;
  let mockGameState: GameState;

  beforeEach(() => {
    inputHandler = new MockInputHandler();
    dispatchSpy = jest.fn();
    
    // Create a minimal mock game state
    mockGameState = {
      board: { width: 10, height: 20, cells: new Uint8Array(200) },
      active: undefined,
      hold: undefined,
      canHold: true,
      nextQueue: [],
      rng: { seed: 'test' },
      timing: {
        tickHz: 60,
        dasMs: 133,
        arrMs: 2,
        softDropCps: 20,
        lockDelayMs: 500,
        lineClearDelayMs: 0
      },
      gameplay: {
        finesseCancelMs: 50
      },
      tick: 0,
      status: 'playing',
      stats: {},
      inputLog: []
    };
  });

  describe('Initialization', () => {
    it('should initialize with proper dispatch function', () => {
      expect(() => inputHandler.init(dispatchSpy)).not.toThrow();
    });

    it('should start and stop without errors', () => {
      inputHandler.init(dispatchSpy);
      
      expect(() => inputHandler.start()).not.toThrow();
      expect(() => inputHandler.stop()).not.toThrow();
    });

    it('should have clean initial state', () => {
      const state = inputHandler.getState();
      
      expect(state.isLeftKeyDown).toBe(false);
      expect(state.isRightKeyDown).toBe(false);
      expect(state.isSoftDropDown).toBe(false);
      expect(state.dasStartTime).toBeUndefined();
      expect(state.arrLastTime).toBeUndefined();
      expect(state.currentDirection).toBeUndefined();
    });
  });

  describe('Input Simulation Contract', () => {
    beforeEach(() => {
      inputHandler.init(dispatchSpy);
      inputHandler.start();
    });

    it('should dispatch valid Action objects', () => {
      inputHandler.simulateInput('LeftDown');
      
      expect(dispatchSpy).toHaveBeenCalled();
      
      // Check that all dispatched actions are valid Action types
      dispatchSpy.mock.calls.forEach(([action]) => {
        expect(action).toHaveProperty('type');
        expect(typeof action.type).toBe('string');
      });
    });

    it('should not directly mutate GameState', () => {
      const originalState = { ...mockGameState };
      
      inputHandler.update(mockGameState);
      inputHandler.simulateInput('LeftDown');
      
      // Game state should not be modified by input handler
      expect(mockGameState).toEqual(originalState);
    });

    describe('Movement inputs', () => {
      it('should dispatch Move action for LeftDown', () => {
        inputHandler.simulateInput('LeftDown');
        
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'EnqueueInput',
            event: expect.objectContaining({
              action: 'LeftDown'
            })
          })
        );
        
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'Move',
            dir: -1,
            source: 'tap'
          })
        );
      });

      it('should dispatch Move action for RightDown', () => {
        inputHandler.simulateInput('RightDown');
        
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'Move',
            dir: 1,
            source: 'tap'
          })
        );
      });

      it('should update internal state for directional inputs', () => {
        inputHandler.simulateInput('LeftDown');
        
        const state = inputHandler.getState();
        expect(state.isLeftKeyDown).toBe(true);
        expect(state.currentDirection).toBe(-1);
        expect(state.dasStartTime).toBeDefined();
      });

      it('should handle key release properly', () => {
        inputHandler.simulateInput('LeftDown');
        inputHandler.simulateInput('LeftUp');
        
        const state = inputHandler.getState();
        expect(state.isLeftKeyDown).toBe(false);
        expect(state.currentDirection).toBeUndefined();
        expect(state.dasStartTime).toBeUndefined();
      });
    });

    describe('Rotation inputs', () => {
      const rotationTests: Array<[KeyAction, string]> = [
        ['RotateCW', 'CW'],
        ['RotateCCW', 'CCW'],
      ];

      rotationTests.forEach(([input, expectedDir]) => {
        it(`should dispatch Rotate action for ${input}`, () => {
          inputHandler.simulateInput(input);
          
          expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'Rotate',
              dir: expectedDir
            })
          );
        });
      });
    });

    describe('Other inputs', () => {
      it('should dispatch HardDrop action', () => {
        inputHandler.simulateInput('HardDrop');
        
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'HardDrop'
          })
        );
      });

      it('should dispatch Hold action', () => {
        inputHandler.simulateInput('Hold');
        
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'Hold'
          })
        );
      });

      it('should dispatch SoftDrop actions', () => {
        inputHandler.simulateInput('SoftDropDown');
        
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'SoftDrop',
            on: true
          })
        );
        
        dispatchSpy.mockClear();
        
        inputHandler.simulateInput('SoftDropUp');
        
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'SoftDrop',
            on: false
          })
        );
      });

      it('should update soft drop state', () => {
        inputHandler.simulateInput('SoftDropDown');
        expect(inputHandler.getState().isSoftDropDown).toBe(true);
        
        inputHandler.simulateInput('SoftDropUp');
        expect(inputHandler.getState().isSoftDropDown).toBe(false);
      });
    });

    describe('Input event enqueuing', () => {
      it('should always enqueue InputEvent for every simulated input', () => {
        const testInputs: KeyAction[] = [
          'LeftDown', 'RightDown', 'RotateCW', 'RotateCCW',
          'HardDrop', 'Hold', 'SoftDropDown', 'SoftDropUp'
        ];
        
        testInputs.forEach((input) => {
          dispatchSpy.mockClear();
          inputHandler.simulateInput(input);
          
          // Should always have at least one EnqueueInput call
          const enqueueInputCalls = dispatchSpy.mock.calls.filter(
            ([action]) => action.type === 'EnqueueInput'
          );
          
          expect(enqueueInputCalls).toHaveLength(1);
          expect(enqueueInputCalls[0]![0]).toMatchObject({
            type: 'EnqueueInput',
            event: {
              tMs: expect.any(Number),
              frame: expect.any(Number),
              action: input
            }
          });
        });
      });

      it('should include timestamp and frame in InputEvent', () => {
        inputHandler.simulateInput('LeftDown');
        
        const enqueueCall = dispatchSpy.mock.calls.find(
          ([action]) => action.type === 'EnqueueInput'
        );
        
        expect(enqueueCall).toBeDefined();
        const event = (enqueueCall![0] as any).event;
        
        expect(typeof event.tMs).toBe('number');
        expect(typeof event.frame).toBe('number');
        expect(event.tMs).toBeGreaterThan(0);
        expect(event.frame).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Error handling', () => {
      it('should handle simulation without initialized dispatch', () => {
        const uninitializedHandler = new MockInputHandler();
        
        // Mock console.error to suppress output during test
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        
        // Should not throw, but should log error
        expect(() => uninitializedHandler.simulateInput('LeftDown')).not.toThrow();
        
        // Verify error was logged
        expect(consoleErrorSpy).toHaveBeenCalledWith('MockInputHandler: dispatch not initialized');
        
        // Restore console.error
        consoleErrorSpy.mockRestore();
      });

      it('should handle update calls gracefully', () => {
        expect(() => inputHandler.update(mockGameState)).not.toThrow();
      });
    });
  });

  describe('State Management', () => {
    beforeEach(() => {
      inputHandler.init(dispatchSpy);
    });

    it('should maintain separate internal state', () => {
      const state1 = inputHandler.getState();
      const state2 = inputHandler.getState();
      
      // Should be different objects with same content
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });

    it('should handle concurrent directional inputs', () => {
      inputHandler.simulateInput('LeftDown');
      inputHandler.simulateInput('RightDown');
      
      const state = inputHandler.getState();
      expect(state.isLeftKeyDown).toBe(true);
      expect(state.isRightKeyDown).toBe(true);
      expect(state.currentDirection).toBe(1); // Right should override left
    });

    it('should maintain DAS timing state', () => {
      const beforeTime = Date.now();
      inputHandler.simulateInput('LeftDown');
      const afterTime = Date.now();
      
      const state = inputHandler.getState();
      expect(state.dasStartTime).toBeGreaterThanOrEqual(beforeTime);
      expect(state.dasStartTime).toBeLessThanOrEqual(afterTime);
    });
  });
});