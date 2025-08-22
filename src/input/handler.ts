import { Action, KeyAction, InputEvent, GameState } from '../state/types';

// Input Handler interface
export interface InputHandler {
  // Initialize the handler with a dispatch function
  init(dispatch: (action: Action) => void): void;
  
  // Start listening for input events
  start(): void;
  
  // Stop listening for input events
  stop(): void;
  
  // Update handler state based on current game state (for DAS/ARR timing)
  update(gameState: GameState): void;
  
  // Get current internal state for debugging
  getState(): InputHandlerState;
}

// Internal state that the input handler maintains
export interface InputHandlerState {
  isLeftKeyDown: boolean;
  isRightKeyDown: boolean;
  isSoftDropDown: boolean;
  dasStartTime: number | undefined;
  arrLastTime: number | undefined;
  currentDirection: -1 | 1 | undefined; // -1 for left, 1 for right
}

// Mock implementation for testing the architecture
export class MockInputHandler implements InputHandler {
  private dispatch?: (action: Action) => void;
  private state: InputHandlerState = {
    isLeftKeyDown: false,
    isRightKeyDown: false,
    isSoftDropDown: false,
    dasStartTime: undefined,
    arrLastTime: undefined,
    currentDirection: undefined
  };
  private frameCounter = 0;

  init(dispatch: (action: Action) => void): void {
    this.dispatch = dispatch;
  }

  start(): void {
    console.log('MockInputHandler: Started listening for input');
  }

  stop(): void {
    console.log('MockInputHandler: Stopped listening for input');
  }

  update(_gameState: GameState): void {
    // This would normally handle DAS/ARR timing
    // For the mock, we just increment the frame counter
    this.frameCounter++;
  }

  getState(): InputHandlerState {
    return { ...this.state };
  }

  // Mock method to simulate input events for testing
  simulateInput(action: KeyAction): void {
    if (!this.dispatch) {
      console.error('MockInputHandler: dispatch not initialized');
      return;
    }

    const event: InputEvent = {
      tMs: Date.now(),
      frame: this.frameCounter,
      action
    };

    console.log('MockInputHandler: Dispatching input', action);
    
    // Enqueue the input event
    this.dispatch({
      type: 'EnqueueInput',
      event
    });

    // Update internal state based on the action
    this.updateInternalState(action);

    // For certain actions, dispatch corresponding game actions
    switch (action) {
      case 'LeftDown':
        this.dispatch({ type: 'Move', dir: -1, source: 'tap' });
        break;
      case 'RightDown':
        this.dispatch({ type: 'Move', dir: 1, source: 'tap' });
        break;
      case 'RotateCW':
        this.dispatch({ type: 'Rotate', dir: 'CW' });
        break;
      case 'RotateCCW':
        this.dispatch({ type: 'Rotate', dir: 'CCW' });
        break;
      case 'Rotate180':
        this.dispatch({ type: 'Rotate', dir: '180' });
        break;
      case 'HardDrop':
        this.dispatch({ type: 'HardDrop' });
        break;
      case 'Hold':
        this.dispatch({ type: 'Hold' });
        break;
      case 'SoftDropDown':
        this.dispatch({ type: 'SoftDrop', on: true });
        break;
      case 'SoftDropUp':
        this.dispatch({ type: 'SoftDrop', on: false });
        break;
    }
  }

  private updateInternalState(action: KeyAction): void {
    switch (action) {
      case 'LeftDown':
        this.state.isLeftKeyDown = true;
        this.state.currentDirection = -1;
        this.state.dasStartTime = Date.now();
        break;
      case 'LeftUp':
        this.state.isLeftKeyDown = false;
        if (this.state.currentDirection === -1) {
          this.state.currentDirection = undefined;
          this.state.dasStartTime = undefined;
        }
        break;
      case 'RightDown':
        this.state.isRightKeyDown = true;
        this.state.currentDirection = 1;
        this.state.dasStartTime = Date.now();
        break;
      case 'RightUp':
        this.state.isRightKeyDown = false;
        if (this.state.currentDirection === 1) {
          this.state.currentDirection = undefined;
          this.state.dasStartTime = undefined;
        }
        break;
      case 'SoftDropDown':
        this.state.isSoftDropDown = true;
        break;
      case 'SoftDropUp':
        this.state.isSoftDropDown = false;
        break;
    }
  }
}