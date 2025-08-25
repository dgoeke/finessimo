/*
 * DAS (Delayed Auto Shift) State Machine Implementation using Robot3
 *
 * This file implements a state machine for handling DAS input timing using the robot3 library.
 * DAS determines whether a key press is a "tap" (quick press/release) or "hold" (press and hold for repeating).
 *
 * ROBOT3 ARCHITECTURE OVERVIEW:
 * - robot3 uses IMMUTABLE context - never mutate context directly
 * - Reducers return NEW context objects, they don't mutate the existing one
 * - Actions are for SIDE EFFECTS (like emitting ProcessedActions), not state changes
 * - State transitions are defined declaratively with guards and reducers
 *
 * ROBOT3 API PATTERNS:
 * - createMachine(stateDefinition, contextFactory) - creates the state machine
 * - interpret(machine, onChange) - creates a service to run the machine
 * - service.send(event) - sends events to trigger transitions
 * - service.context - the CURRENT context (updated after reducers run)
 * - service.machine.state.name - the current state name
 *
 * DAS STATE FLOW:
 * idle → charging (on KEY_DOWN) → either:
 *   - back to idle (on KEY_UP before DAS timer expires) = TAP
 *   - to repeating (on TIMER_TICK after DAS expires) = HOLD START
 * repeating → repeating (on TIMER_TICK at ARR intervals) = HOLD REPEAT
 * repeating → idle (on KEY_UP) = END HOLD
 */

import {
  createMachine,
  state,
  transition,
  guard,
  reduce,
  action,
  interpret,
} from "robot3";
import type { Action } from "../../state/types";
import type { ProcessedAction } from "../handler";

export type DASState = 'idle' | 'charging' | 'repeating';

// DAS state machine context - this is the immutable state that flows through the machine
export interface DASContext {
  direction: -1 | 1 | undefined; // -1 for left, 1 for right, undefined when no key held
  dasStartTime: number | undefined; // When DAS timer started (KEY_DOWN timestamp)
  arrLastTime: number | undefined; // Last time an ARR repeat fired
  dasMs: number; // DAS delay in milliseconds (how long to hold before repeating starts)
  arrMs: number; // ARR rate in milliseconds (how fast repeating happens)
}

// DAS state machine events - these trigger state transitions
export type DASEvent =
  | { type: "KEY_DOWN"; direction: -1 | 1; timestamp: number } // User pressed a movement key
  | { type: "KEY_UP"; direction: -1 | 1; timestamp: number } // User released a movement key
  | { type: "TIMER_TICK"; timestamp: number } // Game loop timer tick
  | { type: "UPDATE_CONFIG"; dasMs: number; arrMs: number }; // Configuration update

/*
 * ROBOT3 GUARDS - Functions that return true/false to determine if a transition should happen
 * Guards receive (context, event) and return boolean
 * They are PURE functions - no side effects, just decision logic
 */

// Guard: Check if event is a key down
const isKeyDown = (_ctx: DASContext, event: DASEvent) => {
  return event.type === "KEY_DOWN";
};

// Guard: Check if key was released before DAS timer expired (= tap classification)
const isKeyUpBeforeDAS = (ctx: DASContext, event: DASEvent) => {
  if (event.type !== "KEY_UP") return false;
  if (ctx.dasStartTime === undefined) return false;
  if (event.direction !== ctx.direction) return false;

  const elapsed = event.timestamp - ctx.dasStartTime;
  return elapsed <= ctx.dasMs; // Released within DAS window = tap
};

// Guard: Check if DAS timer has expired (time to start repeating)
const isDASExpired = (ctx: DASContext, event: DASEvent) => {
  if (event.type !== "TIMER_TICK") return false;
  if (ctx.dasStartTime === undefined) return false;

  const elapsed = event.timestamp - ctx.dasStartTime;
  return elapsed >= ctx.dasMs; // DAS time has passed
};

// Guard: Check if key was released after DAS timer expired but before first repeat
// This handles the edge case where user releases key after DAS expires but before TIMER_TICK
const isKeyUpAfterDAS = (ctx: DASContext, event: DASEvent) => {
  return (
    event.type === "KEY_UP" &&
    ctx.dasStartTime !== undefined &&
    event.direction === ctx.direction &&
    event.timestamp - ctx.dasStartTime > ctx.dasMs
  );
};

// Guard: Check if the correct directional key was released while repeating
// IMPORTANT: Only KEY_UP for the SAME direction should stop repeating
const isKeyUpFromRepeating = (ctx: DASContext, event: DASEvent) => {
  return (
    event.type === "KEY_UP" &&
    ctx.direction !== undefined &&
    event.direction === ctx.direction // Must match the held direction
  );
};

// Guard: Check if it's time to emit another ARR repeat
const shouldEmitARR = (ctx: DASContext, event: DASEvent) => {
  if (event.type !== "TIMER_TICK") return false;
  if (ctx.dasStartTime === undefined || ctx.direction === undefined)
    return false;

  const dasElapsed = event.timestamp - ctx.dasStartTime;
  if (dasElapsed < ctx.dasMs) return false; // DAS hasn't expired yet

  const safeArrMs = Math.max(1, ctx.arrMs); // Prevent divide by zero
  const expectedArrTime =
    ctx.arrLastTime !== undefined
      ? ctx.arrLastTime + safeArrMs // Time for next repeat
      : ctx.dasStartTime + ctx.dasMs; // Time for first repeat

  return event.timestamp >= expectedArrTime;
};

// Guard: Check if event is a config update
const isConfigUpdate = (_ctx: DASContext, event: DASEvent) => {
  return event.type === "UPDATE_CONFIG";
};

/*
 * ROBOT3 REDUCERS - Functions that return NEW context objects (never mutate existing)
 * Reducers receive (context, event) and return new context
 * They are PURE functions - no side effects, just context transformation
 * ALWAYS use spread operator (...ctx) to create new context object
 */

// Reducer: Handle key down - start DAS timer and record direction
export const updateContextKeyDown = (
  ctx: DASContext,
  event: DASEvent,
): DASContext => {
  if (event.type === "KEY_DOWN") {
    return {
      ...ctx, // IMPORTANT: Always spread existing context
      direction: event.direction, // Record which direction key was pressed
      dasStartTime: event.timestamp, // Start the DAS timer
      arrLastTime: undefined, // Reset ARR timer
    };
  }
  return ctx; // No change if event doesn't match
};

// Reducer: Handle key up - reset all DAS/ARR state
export const updateContextKeyUp = (
  ctx: DASContext,
  event: DASEvent,
): DASContext => {
  void event; // Mark as used for interface compatibility
  return {
    ...ctx,
    direction: undefined, // No key held
    dasStartTime: undefined, // Clear DAS timer
    arrLastTime: undefined, // Clear ARR timer
  };
};

// Reducer: Start the hold/repeat phase - set initial ARR time
export const updateContextHoldStart = (
  ctx: DASContext,
  event: DASEvent,
): DASContext => {
  if (
    event.type === "TIMER_TICK" &&
    ctx.dasStartTime !== undefined &&
    ctx.direction !== undefined
  ) {
    return {
      ...ctx,
      // Set arrLastTime to when the first repeat should happen (DAS start + DAS duration)
      arrLastTime: ctx.dasStartTime + ctx.dasMs,
    };
  }
  return ctx; // No change if conditions not met
};

// Reducer: Update ARR timer for next repeat
export const updateContextARR = (
  ctx: DASContext,
  event: DASEvent,
): DASContext => {
  if (
    event.type === "TIMER_TICK" &&
    ctx.arrLastTime !== undefined &&
    ctx.direction !== undefined
  ) {
    const safeArrMs = Math.max(1, ctx.arrMs); // Prevent divide by zero
    return {
      ...ctx,
      // Update arrLastTime to when the next repeat should happen
      arrLastTime: ctx.arrLastTime + safeArrMs,
    };
  }
  return ctx; // No change if conditions not met
};

// Reducer: Update DAS/ARR timing configuration with validation
export const updateConfig = (ctx: DASContext, event: DASEvent): DASContext => {
  if (event.type === "UPDATE_CONFIG") {
    return {
      ...ctx,
      dasMs: Math.max(0, event.dasMs), // Clamp DAS to >= 0ms
      arrMs: Math.max(1, event.arrMs), // Clamp ARR to >= 1ms (prevent divide by zero)
    };
  }
  return ctx; // No change if event doesn't match
};

/*
 * ROBOT3 MACHINE CREATION
 * Creates the state machine definition with states, transitions, guards, reducers, and actions
 */
export const createDASMachine = (
  initialContext: DASContext,
  onAction?: (action: ProcessedAction) => void, // Callback to emit ProcessedActions
) => {
  /*
   * ROBOT3 ACTION FUNCTIONS - Handle side effects (ProcessedAction emission)
   * Actions receive (context, event) and perform side effects
   * Actions do NOT return anything - they are for side effects only
   * Actions are called AFTER reducers, so context contains the updated state
   */

  // Action: Emit a tap move (immediate move on key press)
  const emitTapAction = (_ctx: DASContext, event: DASEvent) => {
    if (event.type === "KEY_DOWN" && onAction) {
      onAction({
        action: {
          type: "Move",
          dir: event.direction, // Direction from the key press event
          source: "tap", // Mark as tap source
        } as Action,
        timestamp: event.timestamp,
      });
    }
  };

  // Action: Emit a DAS move (hold start or repeat move)
  const emitDASAction = (ctx: DASContext, event: DASEvent) => {
    if (ctx.direction !== undefined && onAction && "timestamp" in event) {
      onAction({
        action: {
          type: "Move",
          dir: ctx.direction, // Direction from context (what key is held)
          source: "das", // Mark as DAS source (hold/repeat)
        } as Action,
        timestamp: event.timestamp,
      });
    }
  };

  /*
   * ROBOT3 STATE MACHINE DEFINITION
   * Each state has transitions defined by: event -> target_state + guard + reducer + action
   * Order: guard (check if transition should happen) -> reducer (update context) -> action (side effect)
   */
  return createMachine(
    {
      // IDLE STATE: No keys held, waiting for input
      idle: state(
        transition(
          "KEY_DOWN", // Event type to listen for
          "charging", // Target state
          guard(isKeyDown), // Guard: Check if it's a key down
          reduce(updateContextKeyDown), // Reducer: Update context with key info
          action(emitTapAction), // Action: Emit immediate tap move
        ),
        transition(
          "UPDATE_CONFIG", // Allow config updates in idle
          "idle", // Stay in idle
          guard(isConfigUpdate), // Guard: Check if it's a config update
          reduce(updateConfig), // Reducer: Update DAS/ARR settings
        ),
      ),

      // CHARGING STATE: Key held, waiting to see if it's a tap or hold
      charging: state(
        transition(
          "KEY_UP", // Key released before DAS expires
          "idle", // Go back to idle (tap detected)
          guard(isKeyUpBeforeDAS), // Guard: Released within DAS window
          reduce(updateContextKeyUp), // Reducer: Clear all state
        ),
        transition(
          "KEY_UP", // Key released after DAS expires but before tick
          "idle", // Go back to idle (edge case handling)
          guard(isKeyUpAfterDAS), // Guard: Released after DAS but before repeat
          reduce(updateContextKeyUp), // Reducer: Clear all state
        ),
        transition(
          "TIMER_TICK", // Timer tick while charging
          "repeating", // Move to repeating state (hold detected)
          guard(isDASExpired), // Guard: DAS timer has expired
          reduce(updateContextHoldStart), // Reducer: Set up ARR timing
          action(emitDASAction), // Action: Emit first hold move
        ),
        transition(
          "KEY_DOWN", // Different key pressed (key switching)
          "charging", // Stay in charging with new key
          guard(isKeyDown), // Guard: Check if it's a key down
          reduce(updateContextKeyDown), // Reducer: Switch to new key
          action(emitTapAction), // Action: Emit tap for new key
        ),
        transition(
          "UPDATE_CONFIG", // Allow config updates while charging
          "charging", // Stay in charging
          guard(isConfigUpdate), // Guard: Check if it's a config update
          reduce(updateConfig), // Reducer: Update DAS/ARR settings
        ),
      ),

      // REPEATING STATE: Key held and repeating at ARR rate
      repeating: state(
        transition(
          "KEY_UP", // Key released while repeating
          "idle", // Go back to idle (end hold)
          guard(isKeyUpFromRepeating), // Guard: Correct direction key released
          reduce(updateContextKeyUp), // Reducer: Clear all state
        ),
        transition(
          "TIMER_TICK", // Timer tick while repeating
          "repeating", // Stay in repeating state
          guard(shouldEmitARR), // Guard: Time for next ARR repeat
          reduce(updateContextARR), // Reducer: Update ARR timing
          action(emitDASAction), // Action: Emit repeat move
        ),
        transition(
          "KEY_DOWN", // Different key pressed (key switching)
          "charging", // Go to charging with new key
          guard(isKeyDown), // Guard: Check if it's a key down
          reduce(updateContextKeyDown), // Reducer: Switch to new key
          action(emitTapAction), // Action: Emit tap for new key
        ),
        transition(
          "UPDATE_CONFIG", // Allow config updates while repeating
          "repeating", // Stay in repeating
          guard(isConfigUpdate), // Guard: Check if it's a config update
          reduce(updateConfig), // Reducer: Update DAS/ARR settings
        ),
      ),
    },
    () => initialContext, // Context factory function
  );
};

// Default context factory with validation
export const createDefaultDASContext = (
  dasMs = 167, // Default DAS: 167ms (about 10 frames at 60fps)
  arrMs = 33, // Default ARR: 33ms (about 2 frames at 60fps)
): DASContext => ({
  direction: undefined, // No key held initially
  dasStartTime: undefined, // No DAS timer active
  arrLastTime: undefined, // No ARR timer active
  dasMs: Math.max(0, dasMs), // Clamp DAS to >= 0ms
  arrMs: Math.max(1, arrMs), // Clamp ARR to >= 1ms (prevent divide by zero)
});

/*
 * ROBOT3 SERVICE INTERFACE
 * Simplified TypeScript interface for robot3's interpret() service
 * Robot3 doesn't provide proper TypeScript types, so we define our own
 */
interface Robot3Service {
  send(event: DASEvent): void; // Send events to trigger transitions
  machine: {
    state: {
      name: string; // Current state name (idle/charging/repeating)
    };
  };
  context: DASContext; // Current context (updated by reducers)
}

/*
 * DAS MACHINE SERVICE - Thin wrapper around robot3
 *
 * This class provides a clean API for the DAS state machine:
 * 1. Creates and manages the robot3 service
 * 2. Collects ProcessedActions from the action callbacks
 * 3. Provides methods for sending events and getting state
 *
 * IMPORTANT: This is a THIN wrapper - no duplicate state machine logic!
 * All state transitions are handled by the robot3 machine defined above.
 */
export class DASMachineService {
  private service: Robot3Service; // Robot3 service instance
  private actionQueue: ProcessedAction[] = []; // Queue for collecting emitted actions
  private currentStateName: DASState; // Current state name stored from interpret callback

  constructor(initialContext?: DASContext) {
    const context = initialContext ?? createDefaultDASContext();
    this.currentStateName = "idle"; // Initialize with default state

    // Create the robot3 machine with action callback to collect ProcessedActions
    const machine = createDASMachine(context, (action) => {
      this.actionQueue.push(action); // Collect actions from robot3 action() callbacks
    });

    // Create robot3 service with onChange callback to store current state name
    this.service = interpret(machine, (service) => {
      // onChange callback - called after each transition
      // Store current state name to avoid depending on service.machine.state.name
      this.currentStateName = service.machine.state.name as DASState;
    }) as Robot3Service;
  }

  /**
   * Send event to robot3 service and return any emitted actions
   * This is the main interface for triggering state transitions
   */
  send(event: DASEvent): ProcessedAction[] {
    this.service.send(event); // Send event to robot3 (triggers transitions)
    const actions = [...this.actionQueue]; // Copy collected actions
    this.actionQueue = []; // Clear queue for next send
    return actions; // Return actions that were emitted
  }

  /**
   * Get current state and context from robot3
   * Uses stored currentStateName instead of accessing service.machine.state.name
   */
  getState() {
    return {
      state: this.currentStateName as DASState, // Current state name from stored value
      context: { ...this.service.context }, // Copy of current context
    };
  }

  /** Thin wrapper around sending UPDATE_CONFIG event */
  updateConfig(dasMs: number, arrMs: number): ProcessedAction[] {
    return this.send({ type: "UPDATE_CONFIG", dasMs, arrMs });
  }

  /** Reset by creating new robot3 service with preserved timing settings */
  reset() {
    const currentContext = this.service.context;
    const newContext = createDefaultDASContext(
      currentContext.dasMs,
      currentContext.arrMs,
    );
    this.currentStateName = "idle"; // Reset to initial state

    // Recreate the machine and service
    const machine = createDASMachine(newContext, (action) => {
      this.actionQueue.push(action);
    });
    this.service = interpret(machine, (service) => {
      // onChange callback - store current state name
      this.currentStateName = service.machine.state.name as DASState;
    }) as Robot3Service;
    this.actionQueue = [];
  }

  /** Testing helper - direct context access for test setup */
  setContextForTesting(context: DASContext) {
    // Robot3's service.context is mutable and can be updated directly
    Object.assign(this.service.context, context);
  }
}
