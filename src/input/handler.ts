import { Action, KeyAction, InputEvent, GameState } from '../state/types';

// Input normalization utility
export function normalizeInputSequence(events: InputEvent[], cancelWindowMs: number): KeyAction[] {
  // Filter to only keep relevant events
  const relevantEvents = events.filter(event => 
    ['LeftDown', 'RightDown', 'RotateCW', 'RotateCCW', 'Rotate180', 'Hold', 'HardDrop'].includes(event.action)
  );

  // Sort by timestamp to ensure proper order
  const sortedEvents = [...relevantEvents].sort((a, b) => a.tMs - b.tMs);

  const result: KeyAction[] = [];
  const toRemove = new Set<number>();

  // Look for cancellation pairs
  for (let i = 0; i < sortedEvents.length - 1; i++) {
    if (toRemove.has(i)) continue;

    const current = sortedEvents[i];
    
    for (let j = i + 1; j < sortedEvents.length; j++) {
      if (toRemove.has(j)) continue;

      const next = sortedEvents[j];
      const timeDiff = next.tMs - current.tMs;

      if (timeDiff > cancelWindowMs) break; // Too far apart

      // Check for opposite directional inputs
      if ((current.action === 'LeftDown' && next.action === 'RightDown') ||
          (current.action === 'RightDown' && next.action === 'LeftDown')) {
        toRemove.add(i);
        toRemove.add(j);
        break;
      }
    }
  }

  // Build result without removed events
  for (let i = 0; i < sortedEvents.length; i++) {
    if (!toRemove.has(i)) {
      result.push(sortedEvents[i].action);
    }
  }

  return result;
}

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

// Real InputHandler implementation with DAS/ARR timing
export class DOMInputHandler implements InputHandler {
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
  private boundKeyDownHandler: (event: KeyboardEvent) => void;
  private boundKeyUpHandler: (event: KeyboardEvent) => void;

  constructor() {
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
    this.boundKeyUpHandler = this.handleKeyUp.bind(this);
  }

  init(dispatch: (action: Action) => void): void {
    this.dispatch = dispatch;
  }

  start(): void {
    document.addEventListener('keydown', this.boundKeyDownHandler);
    document.addEventListener('keyup', this.boundKeyUpHandler);
  }

  stop(): void {
    document.removeEventListener('keydown', this.boundKeyDownHandler);
    document.removeEventListener('keyup', this.boundKeyUpHandler);
  }

  update(gameState: GameState): void {
    this.frameCounter++;
    const currentTime = Date.now();

    // Handle DAS/ARR timing
    if (this.state.currentDirection !== undefined && this.state.dasStartTime !== undefined) {
      const dasElapsed = currentTime - this.state.dasStartTime;
      
      if (dasElapsed >= gameState.timing.dasMs) {
        // DAS threshold reached, check for ARR
        if (this.state.arrLastTime === undefined) {
          // First DAS trigger
          this.dispatch!({ type: 'Move', dir: this.state.currentDirection, source: 'das' });
          this.state.arrLastTime = currentTime;
        } else {
          // Check ARR timing
          const arrElapsed = currentTime - this.state.arrLastTime;
          if (arrElapsed >= gameState.timing.arrMs) {
            this.dispatch!({ type: 'Move', dir: this.state.currentDirection, source: 'das' });
            this.state.arrLastTime = currentTime;
          }
        }
      }
    }
  }

  getState(): InputHandlerState {
    return { ...this.state };
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.dispatch) return;

    const action = this.mapKeyToAction(event.code, 'down');
    if (!action) return;

    event.preventDefault();

    // Prevent key repeat
    if (event.repeat) return;

    const inputEvent: InputEvent = {
      tMs: Date.now(),
      frame: this.frameCounter,
      action
    };

    this.dispatch({ type: 'EnqueueInput', event: inputEvent });
    this.updateInternalState(action);

    // Dispatch immediate game actions for certain inputs
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
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (!this.dispatch) return;

    const action = this.mapKeyToAction(event.code, 'up');
    if (!action) return;

    event.preventDefault();

    const inputEvent: InputEvent = {
      tMs: Date.now(),
      frame: this.frameCounter,
      action
    };

    this.dispatch({ type: 'EnqueueInput', event: inputEvent });
    this.updateInternalState(action);

    // Handle soft drop release
    if (action === 'SoftDropUp') {
      this.dispatch({ type: 'SoftDrop', on: false });
    }
  }

  private mapKeyToAction(code: string, type: 'down' | 'up'): KeyAction | null {
    // Standard Tetris controls
    const keyMapping: Record<string, { down: KeyAction; up: KeyAction }> = {
      'ArrowLeft': { down: 'LeftDown', up: 'LeftUp' },
      'KeyA': { down: 'LeftDown', up: 'LeftUp' },
      'ArrowRight': { down: 'RightDown', up: 'RightUp' },
      'KeyD': { down: 'RightDown', up: 'RightUp' },
      'ArrowDown': { down: 'SoftDropDown', up: 'SoftDropUp' },
      'KeyS': { down: 'SoftDropDown', up: 'SoftDropUp' },
      'ArrowUp': { down: 'RotateCW', up: 'RotateCW' }, // No up action for rotations
      'KeyW': { down: 'RotateCW', up: 'RotateCW' },
      'KeyZ': { down: 'RotateCCW', up: 'RotateCCW' },
      'KeyX': { down: 'Rotate180', up: 'Rotate180' },
      'Space': { down: 'HardDrop', up: 'HardDrop' },
      'KeyC': { down: 'Hold', up: 'Hold' },
    };

    const mapping = keyMapping[code];
    if (!mapping) return null;

    // For non-directional keys, only respond to keydown
    if (type === 'up' && !code.startsWith('Arrow') && code !== 'KeyS') {
      return null;
    }

    return mapping[type];
  }

  private updateInternalState(action: KeyAction): void {
    const currentTime = Date.now();

    switch (action) {
      case 'LeftDown':
        this.state.isLeftKeyDown = true;
        this.state.currentDirection = -1;
        this.state.dasStartTime = currentTime;
        this.state.arrLastTime = undefined;
        break;
      case 'LeftUp':
        this.state.isLeftKeyDown = false;
        if (this.state.currentDirection === -1) {
          this.state.currentDirection = this.state.isRightKeyDown ? 1 : undefined;
          if (this.state.currentDirection === 1) {
            this.state.dasStartTime = currentTime;
          } else {
            this.state.dasStartTime = undefined;
          }
          this.state.arrLastTime = undefined;
        }
        break;
      case 'RightDown':
        this.state.isRightKeyDown = true;
        this.state.currentDirection = 1;
        this.state.dasStartTime = currentTime;
        this.state.arrLastTime = undefined;
        break;
      case 'RightUp':
        this.state.isRightKeyDown = false;
        if (this.state.currentDirection === 1) {
          this.state.currentDirection = this.state.isLeftKeyDown ? -1 : undefined;
          if (this.state.currentDirection === -1) {
            this.state.dasStartTime = currentTime;
          } else {
            this.state.dasStartTime = undefined;
          }
          this.state.arrLastTime = undefined;
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