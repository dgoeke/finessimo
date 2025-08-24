import { Action, KeyAction, InputEvent, GameState } from "../state/types";
import { createTimestamp, fromNow } from "../types/timestamp";
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

// Type for processed action with metadata
export interface ProcessedAction {
  action: Action;
  timestamp: number;
}

// Type for processing results
export interface ProcessResult {
  newState: InputHandlerState;
  actions: ProcessedAction[];
}

// Pure function to update DAS state based on input action
export function updateDASState(
  state: InputHandlerState,
  action: KeyAction,
  timeMs: number,
): InputHandlerState {
  switch (action) {
    case "LeftDown":
      return {
        ...state,
        isLeftKeyDown: true,
        currentDirection: -1,
        dasStartTime: timeMs,
        arrLastTime: undefined,
      };
    case "LeftUp": {
      const newDirection = state.isRightKeyDown ? 1 : undefined;
      return {
        ...state,
        isLeftKeyDown: false,
        currentDirection:
          state.currentDirection === -1 ? newDirection : state.currentDirection,
        dasStartTime:
          newDirection === 1
            ? timeMs
            : newDirection === undefined
              ? undefined
              : state.dasStartTime,
        arrLastTime:
          state.currentDirection === -1 ? undefined : state.arrLastTime,
      };
    }
    case "RightDown":
      return {
        ...state,
        isRightKeyDown: true,
        currentDirection: 1,
        dasStartTime: timeMs,
        arrLastTime: undefined,
      };
    case "RightUp": {
      const newDirection = state.isLeftKeyDown ? -1 : undefined;
      return {
        ...state,
        isRightKeyDown: false,
        currentDirection:
          state.currentDirection === 1 ? newDirection : state.currentDirection,
        dasStartTime:
          newDirection === -1
            ? timeMs
            : newDirection === undefined
              ? undefined
              : state.dasStartTime,
        arrLastTime:
          state.currentDirection === 1 ? undefined : state.arrLastTime,
      };
    }
    case "SoftDropDown":
      return {
        ...state,
        isSoftDropDown: true,
        softDropLastTime: timeMs,
      };
    case "SoftDropUp":
      return {
        ...state,
        isSoftDropDown: false,
        softDropLastTime: undefined,
      };
    default:
      return state;
  }
}

// Pure function to calculate DAS actions based on timing
export function calculateDASActions(
  direction: -1 | 1,
  dasStartTime: number,
  arrLastTime: number | undefined,
  currentTime: number,
  dasMs: number,
  arrMs: number,
): { actions: ProcessedAction[]; newArrTime: number | undefined } {
  const dasElapsed = currentTime - dasStartTime;

  if (dasElapsed < dasMs) {
    return { actions: [], newArrTime: arrLastTime };
  }

  const safeArrMs = Math.max(1, arrMs);
  let nextTime =
    arrLastTime !== undefined ? arrLastTime + safeArrMs : dasStartTime + dasMs;

  const actions: ProcessedAction[] = [];
  let pulses = 0;
  const MAX_PULSES_PER_UPDATE = 200;
  let newArrTime = arrLastTime;

  while (nextTime <= currentTime && pulses < MAX_PULSES_PER_UPDATE) {
    actions.push({
      action: {
        type: "Move",
        dir: direction,
        source: "das",
      },
      timestamp: nextTime,
    });

    newArrTime = nextTime;
    nextTime += safeArrMs;
    pulses++;
  }

  return { actions, newArrTime };
}

// Pure function to calculate soft drop actions
export function calculateSoftDropActions(
  softDropLastTime: number | undefined,
  currentTime: number,
  gravityMs: number,
  softDropMultiplier: number,
): { actions: ProcessedAction[]; newSoftDropTime: number | undefined } {
  const interval = Math.max(
    1,
    Math.floor(gravityMs / Math.max(1, softDropMultiplier)),
  );

  let nextTime =
    softDropLastTime !== undefined ? softDropLastTime + interval : currentTime;

  const actions: ProcessedAction[] = [];
  let pulses = 0;
  const MAX_PULSES_PER_UPDATE = 200;
  let newSoftDropTime = softDropLastTime;

  while (nextTime <= currentTime && pulses < MAX_PULSES_PER_UPDATE) {
    actions.push({
      action: { type: "SoftDrop", on: true },
      timestamp: nextTime,
    });

    newSoftDropTime = nextTime;
    nextTime += interval;
    pulses++;
  }

  return { actions, newSoftDropTime };
}

// Pure function to process input event with DAS logic
export function processInputWithDAS(
  state: InputHandlerState,
  event: InputEvent,
  gameState: GameState,
): ProcessResult {
  void gameState; // Parameter available for future use
  const newState = updateDASState(state, event.action, event.tMs);
  const actions: ProcessedAction[] = [];

  // Generate immediate actions for input events
  switch (event.action) {
    case "LeftDown":
      actions.push({
        action: { type: "Move", dir: -1, source: "tap" },
        timestamp: event.tMs,
      });
      break;
    case "RightDown":
      actions.push({
        action: { type: "Move", dir: 1, source: "tap" },
        timestamp: event.tMs,
      });
      break;
    case "SoftDropDown":
      actions.push({
        action: { type: "SoftDrop", on: true },
        timestamp: event.tMs,
      });
      break;
    case "SoftDropUp":
      actions.push({
        action: { type: "SoftDrop", on: false },
        timestamp: event.tMs,
      });
      break;
    case "RotateCW":
      actions.push({
        action: { type: "Rotate", dir: "CW" },
        timestamp: event.tMs,
      });
      break;
    case "RotateCCW":
      actions.push({
        action: { type: "Rotate", dir: "CCW" },
        timestamp: event.tMs,
      });
      break;
    case "HardDrop":
      actions.push({
        action: { type: "HardDrop", timestampMs: createTimestamp(event.tMs) },
        timestamp: event.tMs,
      });
      break;
    case "Hold":
      actions.push({
        action: { type: "Hold" },
        timestamp: event.tMs,
      });
      break;
    // Up events don't generate immediate actions
    case "LeftUp":
    case "RightUp":
      break;
  }

  return { newState, actions };
}

// Pure function to generate DAS actions during update cycle
export function generateDASActions(
  state: InputHandlerState,
  gameState: GameState,
  currentTimeMs: number,
): ProcessResult {
  let newState = state;
  let allActions: ProcessedAction[] = [];

  // Handle DAS/ARR timing
  if (
    newState.currentDirection !== undefined &&
    newState.dasStartTime !== undefined
  ) {
    const dasResult = calculateDASActions(
      newState.currentDirection,
      newState.dasStartTime,
      newState.arrLastTime,
      currentTimeMs,
      gameState.timing.dasMs,
      gameState.timing.arrMs,
    );

    allActions = [...allActions, ...dasResult.actions];
    newState = {
      ...newState,
      arrLastTime: dasResult.newArrTime,
    };
  }

  // Handle soft drop repeat
  if (newState.isSoftDropDown && gameState.timing.softDrop !== "infinite") {
    const softDropResult = calculateSoftDropActions(
      newState.softDropLastTime,
      currentTimeMs,
      gameState.timing.gravityMs,
      typeof gameState.timing.softDrop === "number"
        ? gameState.timing.softDrop
        : 1,
    );

    allActions = [...allActions, ...softDropResult.actions];
    newState = {
      ...newState,
      softDropLastTime: softDropResult.newSoftDropTime,
    };
  }

  return { newState, actions: allActions };
}

// InputProcessor class - thin wrapper around pure functions
export class InputProcessor {
  private state: InputHandlerState = {
    isLeftKeyDown: false,
    isRightKeyDown: false,
    isSoftDropDown: false,
    dasStartTime: undefined,
    arrLastTime: undefined,
    currentDirection: undefined,
    softDropLastTime: undefined,
  };
  private dispatch?: (action: Action) => void;

  init(dispatch: (action: Action) => void): void {
    this.dispatch = dispatch;
  }

  processEvent(event: InputEvent, gameState: GameState): void {
    if (!this.dispatch) return;

    const result = processInputWithDAS(this.state, event, gameState);
    this.state = result.newState; // Only mutation, at the edge

    for (const processedAction of result.actions) {
      this.dispatch({ type: "EnqueueProcessedInput", processedAction });
    }
  }

  update(gameState: GameState, nowMs: number): void {
    if (!this.dispatch) return;

    const result = generateDASActions(this.state, gameState, nowMs);
    this.state = result.newState; // Only mutation, at the edge

    for (const processedAction of result.actions) {
      this.dispatch({ type: "EnqueueProcessedInput", processedAction });
    }
  }

  getState(): InputHandlerState {
    return { ...this.state };
  }
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
    softDropLastTime: undefined,
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
    void _gameState;
    void _nowMs;
    // This would normally handle DAS/ARR timing
    // For the mock, we just increment the frame counter
    this.frameCounter++;
  }

  getState(): InputHandlerState {
    return { ...this.state };
  }

  setKeyBindings(_bindings: KeyBindings): void {
    // mock: ignore
    void _bindings;
  }
  getKeyBindings(): KeyBindings {
    return defaultKeyBindings();
  }

  // Mock method to simulate input events for testing
  simulateInput(action: KeyAction): void {
    if (!this.dispatch) {
      console.error("MockInputHandler: dispatch not initialized");
      return;
    }

    const event: InputEvent = {
      tMs: fromNow() as number,
      frame: this.frameCounter,
      action,
    };

    // MockInputHandler dispatching input

    // Enqueue the input event
    this.dispatch({
      type: "EnqueueInput",
      event,
    });

    // For raw input actions, dispatch corresponding game actions
    switch (action) {
      case "LeftDown":
        this.dispatch({ type: "Move", dir: -1, source: "tap" });
        break;
      case "RightDown":
        this.dispatch({ type: "Move", dir: 1, source: "tap" });
        break;
      case "SoftDropDown":
        this.dispatch({ type: "SoftDrop", on: true });
        break;
      case "SoftDropUp":
        this.dispatch({ type: "SoftDrop", on: false });
        break;
      case "RotateCW":
        this.dispatch({ type: "Rotate", dir: "CW" });
        break;
      case "RotateCCW":
        this.dispatch({ type: "Rotate", dir: "CCW" });
        break;
      case "HardDrop":
        this.dispatch({
          type: "HardDrop",
          timestampMs: createTimestamp(event.tMs),
        });
        break;
      case "Hold":
        this.dispatch({ type: "Hold" });
        break;
      // Up events for movement keys don't trigger immediate game actions
      case "LeftUp":
      case "RightUp":
        break;
    }
  }
}
