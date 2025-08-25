import { Action, KeyAction, InputEvent, GameState } from "../state/types";
import { KeyBindings, defaultKeyBindings } from "./keyboard";

// Input normalization utility
export function normalizeInputSequence(
  events: InputEvent[],
  cancelWindowMs: number,
): KeyAction[] {
  // All events are already relevant with the clean KeyAction type
  const relevantEvents = events;

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

      // Check for opposite directional inputs (raw events)
      if (
        (current.action === "LeftDown" && next.action === "RightDown") ||
        (current.action === "RightDown" && next.action === "LeftDown")
      ) {
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

// Mock input handler for testing
export class MockInputHandler implements InputHandler {
  private dispatch?: (action: Action) => void;
  private currentBindings: KeyBindings = defaultKeyBindings();
  private currentState: InputHandlerState = {
    isLeftKeyDown: false,
    isRightKeyDown: false,
    isSoftDropDown: false,
    dasStartTime: undefined,
    arrLastTime: undefined,
    currentDirection: undefined,
    softDropLastTime: undefined,
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
