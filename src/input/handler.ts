import { Action, KeyAction, InputEvent, GameState } from '../state/types';

// Public type for configurable key bindings
export type BindableAction =
  | 'MoveLeft'
  | 'MoveRight'
  | 'SoftDrop'
  | 'HardDrop'
  | 'RotateCW'
  | 'RotateCCW'
  | 'Hold';

export type KeyBindings = Record<BindableAction, string[]>; // KeyboardEvent.code values

export function defaultKeyBindings(): KeyBindings {
  return {
    MoveLeft: ['ArrowLeft', 'KeyA'],
    MoveRight: ['ArrowRight', 'KeyD'],
    SoftDrop: ['ArrowDown', 'KeyS'],
    HardDrop: ['Space'],
    RotateCW: ['ArrowUp', 'KeyW', 'KeyX'],
    RotateCCW: ['KeyZ'],
    Hold: ['KeyC']
  };
}

const STORAGE_KEY = 'finessimo';
const LEGACY_BINDINGS_KEY = 'finessimo-keybindings';

// Input normalization utility
export function normalizeInputSequence(events: InputEvent[], cancelWindowMs: number): KeyAction[] {
  // Filter to only keep relevant events
  const relevantEvents = events.filter(event => 
    ['LeftDown', 'RightDown', 'RotateCW', 'RotateCCW', 'Hold', 'HardDrop'].includes(event.action)
  );

  // Sort by timestamp to ensure proper order
  const sortedEvents = [...relevantEvents].sort((a, b) => a.tMs - b.tMs);

  const result: KeyAction[] = [];
  const toRemove = new Set<number>();

  // Look for cancellation pairs
  for (let i = 0; i < sortedEvents.length - 1; i++) {
    if (toRemove.has(i)) continue;

    const current = sortedEvents[i];
    if (!current) continue;
    
    for (let j = i + 1; j < sortedEvents.length; j++) {
      if (toRemove.has(j)) continue;

      const next = sortedEvents[j];
      if (!next) continue;
      
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
      const event = sortedEvents[i];
      if (event) {
        result.push(event.action);
      }
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
  update(gameState: GameState, nowMs: number): void;
  
  // Get current internal state for debugging
  getState(): InputHandlerState;

  // Update and retrieve key bindings
  setKeyBindings(bindings: KeyBindings): void;
  getKeyBindings(): KeyBindings;
}

// Internal state that the input handler maintains
export interface InputHandlerState {
  isLeftKeyDown: boolean;
  isRightKeyDown: boolean;
  isSoftDropDown: boolean;
  dasStartTime: number | undefined;
  arrLastTime: number | undefined;
  currentDirection: -1 | 1 | undefined; // -1 for left, 1 for right
  softDropLastTime?: number; // last timestamp a soft drop pulse was sent
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
    currentDirection: undefined,
    softDropLastTime: undefined
  };
  private frameCounter = 0;

  init(dispatch: (action: Action) => void): void {
    this.dispatch = dispatch;
  }

  start(): void {
    // MockInputHandler started
  }

  stop(): void {
    // MockInputHandler stopped
  }

  update(_gameState: GameState, _nowMs: number): void {
    // This would normally handle DAS/ARR timing
    // For the mock, we just increment the frame counter
    this.frameCounter++;
  }

  getState(): InputHandlerState {
    return { ...this.state };
  }

  setKeyBindings(_bindings: KeyBindings): void {
    // mock: ignore
  }
  getKeyBindings(): KeyBindings {
    return defaultKeyBindings();
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

    // MockInputHandler dispatching input
    
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
    currentDirection: undefined,
    softDropLastTime: undefined
  };
  private frameCounter = 0;
  private boundKeyDownHandler: (event: KeyboardEvent) => void;
  private boundKeyUpHandler: (event: KeyboardEvent) => void;
  private bindings: KeyBindings;

  constructor() {
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
    this.boundKeyUpHandler = this.handleKeyUp.bind(this);
    this.bindings = this.loadBindingsFromStorage();
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

  update(gameState: GameState, nowMs: number): void {
    this.frameCounter++;
    const currentTime = nowMs;

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

    // Handle soft drop repeat independent of gravity
    if (this.state.isSoftDropDown) {
      const interval = Math.max(1, Math.floor(1000 / Math.max(1, gameState.timing.softDropCps)));
      if (
        this.state.softDropLastTime === undefined ||
        currentTime - this.state.softDropLastTime >= interval
      ) {
        this.dispatch!({ type: 'SoftDrop', on: true });
        this.state.softDropLastTime = currentTime;
      }
    }
  }

  getState(): InputHandlerState {
    return { ...this.state };
  }

  setKeyBindings(bindings: KeyBindings): void {
    // Shallow clone and persist
    this.bindings = JSON.parse(JSON.stringify(bindings));
    try {
      // Consolidated store: { settings?: ..., keyBindings?: ... }
      const storeRaw = localStorage.getItem(STORAGE_KEY);
      let store: any = {};
      if (storeRaw) {
        try { store = JSON.parse(storeRaw); } catch { store = {}; }
      }
      store.keyBindings = this.bindings;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      // ignore storage errors
    }
  }

  getKeyBindings(): KeyBindings {
    return JSON.parse(JSON.stringify(this.bindings));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.dispatch) return;

    // Ignore inputs when settings overlay is open to allow rebinding
    if (document.body.classList.contains('settings-open')) return;

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

    // Ignore inputs when settings overlay is open to allow rebinding
    if (document.body.classList.contains('settings-open')) return;

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
    const b = this.bindings;

    // Determine which binding group this code belongs to
    const inList = (list: string[]) => list.includes(code);

    // On keyup, we only emit for continuous actions (move and soft drop)
    if (type === 'up') {
      if (inList(b.MoveLeft)) return 'LeftUp';
      if (inList(b.MoveRight)) return 'RightUp';
      if (inList(b.SoftDrop)) return 'SoftDropUp';
      return null;
    }

    // keydown
    if (inList(b.MoveLeft)) return 'LeftDown';
    if (inList(b.MoveRight)) return 'RightDown';
    if (inList(b.SoftDrop)) return 'SoftDropDown';
    if (inList(b.RotateCW)) return 'RotateCW';
    if (inList(b.RotateCCW)) return 'RotateCCW';
    if (inList(b.HardDrop)) return 'HardDrop';
    if (inList(b.Hold)) return 'Hold';
    return null;
  }

  private loadBindingsFromStorage(): KeyBindings {
    try {
      // Prefer consolidated store
      const storeRaw = localStorage.getItem(STORAGE_KEY);
      if (storeRaw) {
        const store = JSON.parse(storeRaw);
        if (store && store.keyBindings) {
          const fallback = defaultKeyBindings();
          const merged: KeyBindings = { ...fallback, ...store.keyBindings };
          (Object.keys(fallback) as (keyof KeyBindings)[]).forEach(k => {
            if (!Array.isArray((merged as any)[k])) (merged as any)[k] = (fallback as any)[k];
          });
          return merged;
        }
      }
      // Legacy fallback
      const legacyRaw = localStorage.getItem(LEGACY_BINDINGS_KEY);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        const fallback = defaultKeyBindings();
        const merged: KeyBindings = { ...fallback, ...parsed };
        (Object.keys(fallback) as (keyof KeyBindings)[]).forEach(k => {
          if (!Array.isArray((merged as any)[k])) (merged as any)[k] = (fallback as any)[k];
        });
        // Migrate to consolidated store
        try {
          const store = { keyBindings: merged };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        } catch {}
        return merged;
      }
      return defaultKeyBindings();
    } catch {
      return defaultKeyBindings();
    }
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
        // immediate pulse happens on keydown via dispatch; set timing for repeats
        this.state.softDropLastTime = currentTime;
        break;
      case 'SoftDropUp':
        this.state.isSoftDropDown = false;
        this.state.softDropLastTime = undefined;
        break;
    }
  }
}
