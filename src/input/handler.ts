import {
  type Action,
  type KeyAction,
  type InputEvent,
  type GameState,
} from "../state/types";

import { type KeyBindings, defaultKeyBindings } from "./keyboard";

// Check if two actions are opposite directional inputs
function areOppositeDirections(current: KeyAction, next: KeyAction): boolean {
  return (
    (current === "LeftDown" && next === "RightDown") ||
    (current === "RightDown" && next === "LeftDown")
  );
}

// Find cancellation pairs within the cancel window
function findCancellationPairs(
  events: Array<InputEvent>,
  cancelWindowMs: number,
): Set<number> {
  const toRemove = new Set<number>();

  for (let i = 0; i < events.length - 1; i++) {
    if (toRemove.has(i)) continue;

    const current = events[i];
    if (!current) continue;

    for (let j = i + 1; j < events.length; j++) {
      if (toRemove.has(j)) continue;

      const next = events[j];
      if (!next) continue;

      const timeDiff = next.tMs - current.tMs;
      if (timeDiff > cancelWindowMs) break;

      if (areOppositeDirections(current.action, next.action)) {
        toRemove.add(i);
        toRemove.add(j);
        break;
      }
    }
  }

  return toRemove;
}

// Build result array excluding removed events
function buildResultArray(
  events: Array<InputEvent>,
  toRemove: Set<number>,
): Array<KeyAction> {
  const result: Array<KeyAction> = [];

  for (let i = 0; i < events.length; i++) {
    if (!toRemove.has(i)) {
      const event = events[i];
      if (event) {
        result.push(event.action);
      }
    }
  }

  return result;
}

// Input normalization utility
export function normalizeInputSequence(
  events: Array<InputEvent>,
  cancelWindowMs: number,
): Array<KeyAction> {
  const sortedEvents = [...events].sort((a, b) => a.tMs - b.tMs);
  const toRemove = findCancellationPairs(sortedEvents, cancelWindowMs);
  return buildResultArray(sortedEvents, toRemove);
}

// Input Handler interface
export type InputHandler = {
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
};

// Internal state that the input handler maintains
export type InputHandlerState = {
  isLeftKeyDown: boolean;
  isRightKeyDown: boolean;
  isSoftDropDown: boolean;
  dasStartTime: number | undefined;
  arrLastTime: number | undefined;
  currentDirection: -1 | 1 | undefined; // -1 for left, 1 for right
  softDropLastTime?: number; // last timestamp a soft drop pulse was sent
};

// Mock input handler for testing
export class MockInputHandler implements InputHandler {
  private dispatch?: (action: Action) => void;
  private currentBindings: KeyBindings = defaultKeyBindings();
  private currentState: InputHandlerState = {
    arrLastTime: undefined,
    currentDirection: undefined,
    dasStartTime: undefined,
    isLeftKeyDown: false,
    isRightKeyDown: false,
    isSoftDropDown: false,
  };

  init(dispatch: (action: Action) => void): void {
    this.dispatch = dispatch;
  }

  start(): void {
    // Mock implementation
  }

  stop(): void {
    // Mock implementation
  }

  update(_gameState: GameState, _nowMs: number): void {
    // Mock implementation
  }

  getState(): InputHandlerState {
    return { ...this.currentState };
  }

  setKeyBindings(bindings: KeyBindings): void {
    this.currentBindings = { ...bindings };
  }

  getKeyBindings(): KeyBindings {
    return { ...this.currentBindings };
  }

  // Test helper methods
  setState(state: Partial<InputHandlerState>): void {
    this.currentState = { ...this.currentState, ...state };
  }

  simulateAction(action: Action): void {
    if (this.dispatch) {
      this.dispatch(action);
    }
  }
}
