/*
 * DAS (Delayed Auto Shift) State Machine Implementation using Robot3
 *
 * This file implements a state machine for handling DAS input timing using the robot3 library.
 * DAS determines whether a key press is a "tap" (quick press/release) or "hold" (press and hold for repeating).
 *
 * ROBOT3 ARCHITECTURE OVERVIEW:
 * - robot3 uses IMMUTABLE context - never mutate context directly
 * - Reducers return NEW context objects, they don't mutate the existing one
 * - Actions are for SIDE EFFECTS (like emitting Actions), not state changes
 * - State transitions are defined declaratively with guards and reducers
 *
 * ROBOT3 API PATTERNS:
 * - createMachine(initial, states, contextFactory) or createMachine(states, contextFactory)
 *   We use the 3-arg form with initial "idle" to keep event typing tight.
 * - interpret(machine, onChange) - creates a service to run the machine
 * - service.send(event) - sends events to trigger transitions
 * - service.context - the CURRENT context (updated after reducers run)
 * - service.machine.state.name - the current state name

 * TYPE CONVENTIONS IN THIS FILE:
 * - Event names are the union DASEvent['type']; transitions must use those exact strings.
 * - State builders return MachineState<DASEvent['type']> so the map of states is type-safe.
 * - The machine/service are strongly typed via robot3's Machine/Service generics.
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

import { createTimestamp } from "../../types/timestamp";

import type { Action } from "../../state/types";
import type { MachineState, MachineStates, Machine, Service } from "robot3";

export type DASState = "idle" | "charging" | "repeating";

// DAS state machine context - this is the immutable state that flows through the machine
export type DASContext = {
  direction: -1 | 1 | undefined; // -1 for left, 1 for right, undefined when no key held
  dasStartTime: number | undefined; // When DAS timer started (KEY_DOWN timestamp)
  arrLastTime: number | undefined; // Last time an ARR repeat fired
  dasMs: number; // DAS delay in milliseconds (how long to hold before repeating starts)
  arrMs: number; // ARR rate in milliseconds (how fast repeating happens)
  repeats: number; // Number of catch-up repeats to emit (for catch-up logic)
};

// DAS state machine events - these trigger state transitions
export type DASEvent =
  | { type: "KEY_DOWN"; direction: -1 | 1; timestamp: number } // User pressed a movement key
  | { type: "KEY_UP"; direction: -1 | 1; timestamp: number } // User released a movement key
  | { type: "TIMER_TICK"; timestamp: number } // Game loop timer tick
  | { type: "UPDATE_CONFIG"; dasMs: number; arrMs: number }; // Configuration update

// Export interface for mapping DAS events
export type DASMachineEventMap = {
  KEY_DOWN: { direction: -1 | 1 };
  KEY_UP: { direction: -1 | 1 };
  TIMER_TICK: { deltaMs: number };
  UPDATE_CONFIG: { dasMs: number; arrMs: number };
};

/*
 * ROBOT3 GUARDS - Functions that return true/false to determine if a transition should happen
 * Guards receive (context, event) and return boolean
 * They are PURE functions - no side effects, just decision logic
 */

// Guard: Check if event is a key down
const isKeyDown = (_ctx: DASContext, event: DASEvent): boolean => {
  return event.type === "KEY_DOWN";
};

// Guard: Check if key was released before DAS timer expired (= tap classification)
const isKeyUpBeforeDAS = (ctx: DASContext, event: DASEvent): boolean => {
  if (event.type !== "KEY_UP") return false;
  if (ctx.dasStartTime === undefined) return false;
  if (event.direction !== ctx.direction) return false;

  const elapsed = event.timestamp - ctx.dasStartTime;
  return elapsed <= ctx.dasMs; // Released within DAS window = tap
};

// Guard: Check if DAS timer has expired (time to start repeating)
const isDASExpired = (ctx: DASContext, event: DASEvent): boolean => {
  if (event.type !== "TIMER_TICK") return false;
  if (ctx.dasStartTime === undefined) return false;

  const elapsed = event.timestamp - ctx.dasStartTime;
  return elapsed >= ctx.dasMs; // DAS time has passed
};

// Guard: Check if key was released after DAS timer expired but before first repeat
// This handles the edge case where user releases key after DAS expires but before TIMER_TICK
const isKeyUpAfterDAS = (ctx: DASContext, event: DASEvent): boolean => {
  return (
    event.type === "KEY_UP" &&
    ctx.dasStartTime !== undefined &&
    event.direction === ctx.direction &&
    event.timestamp - ctx.dasStartTime > ctx.dasMs
  );
};

// Guard: Check if the correct directional key was released while repeating
// IMPORTANT: Only KEY_UP for the SAME direction should stop repeating
const isKeyUpFromRepeating = (ctx: DASContext, event: DASEvent): boolean => {
  return (
    event.type === "KEY_UP" &&
    ctx.direction !== undefined &&
    event.direction === ctx.direction // Must match the held direction
  );
};

// Guard: Check if it's time to emit another ARR repeat
const shouldEmitARR = (ctx: DASContext, event: DASEvent): boolean => {
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
const isConfigUpdate = (_ctx: DASContext, event: DASEvent): boolean => {
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
      arrLastTime: undefined, // Reset ARR timer
      dasStartTime: event.timestamp, // Start the DAS timer
      direction: event.direction, // Record which direction key was pressed
      repeats: 0, // Reset catch-up repeats
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
    arrLastTime: undefined, // Clear ARR timer
    dasStartTime: undefined, // Clear DAS timer
    direction: undefined, // No key held
    repeats: 0, // Clear catch-up repeats
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
      repeats: 0, // Reset catch-up repeats when starting hold
    };
  }
  return ctx; // No change if conditions not met
};

// Reducer: Update ARR timer for next repeat with catch-up logic
export const updateContextARR = (
  ctx: DASContext,
  event: DASEvent,
): DASContext => {
  if (
    event.type === "TIMER_TICK" &&
    ctx.arrLastTime !== undefined &&
    ctx.direction !== undefined &&
    ctx.dasStartTime !== undefined
  ) {
    const safeArrMs = Math.max(1, ctx.arrMs); // Prevent divide by zero

    // Compute catch-up repeats based on how much time has passed
    const baseTime = ctx.arrLastTime;
    const repeats = Math.floor((event.timestamp - baseTime) / safeArrMs);

    return {
      ...ctx,
      // Update arrLastTime to the effective time after all catch-up repeats
      arrLastTime: baseTime + repeats * safeArrMs,
      // Store repeats count for emitRepeatMove action
      repeats: Math.max(1, repeats), // At least 1 repeat when this reducer is called
    };
  }
  return ctx; // No change if conditions not met
};

// Reducer: Update DAS/ARR timing configuration with validation
export const updateConfig = (ctx: DASContext, event: DASEvent): DASContext => {
  if (event.type === "UPDATE_CONFIG") {
    return {
      ...ctx,
      arrMs: Math.max(1, event.arrMs), // Clamp ARR to >= 1ms (prevent divide by zero)
      dasMs: Math.max(0, event.dasMs), // Clamp DAS to >= 0ms
    };
  }
  return ctx; // No change if event doesn't match
};

/*
 * ROBOT3 ACTION CREATORS - Pure functions that create action handlers
 * These create the actual action functions used in the state machine
 */

// Creates action function to emit tap moves
const createEmitTapAction =
  (onAction?: (action: Action) => void) =>
  (_ctx: DASContext, event: DASEvent): void => {
    if (event.type === "KEY_UP" && onAction && "direction" in event) {
      onAction({
        dir: event.direction,
        timestampMs: createTimestamp(event.timestamp),
        type: "TapMove",
      });
    }
  };

// Creates action function to emit hold start analytics events
const createEmitHoldStart =
  (onAction?: (action: Action) => void) =>
  (ctx: DASContext, event: DASEvent): void => {
    if (ctx.direction !== undefined && onAction && "timestamp" in event) {
      onAction({
        dir: ctx.direction,
        timestampMs: createTimestamp(event.timestamp),
        type: "HoldStart",
      });
    }
  };

// Creates action function to emit hold moves
const createEmitHoldMove =
  (onAction?: (action: Action) => void) =>
  (ctx: DASContext, event: DASEvent): void => {
    if (ctx.direction !== undefined && onAction && "timestamp" in event) {
      onAction({
        dir: ctx.direction,
        timestampMs: createTimestamp(event.timestamp),
        type: "HoldMove",
      });
    }
  };

// Creates action function to emit repeat moves with catch-up support
const createEmitRepeatMove =
  (onAction?: (action: Action) => void) =>
  (ctx: DASContext, event: DASEvent): void => {
    if (
      ctx.direction !== undefined &&
      onAction &&
      "timestamp" in event &&
      ctx.dasStartTime !== undefined
    ) {
      const safeArrMs = Math.max(1, ctx.arrMs);
      const latestTime = ctx.arrLastTime ?? ctx.dasStartTime + ctx.dasMs;
      const repeats = Math.max(1, ctx.repeats !== 0 ? ctx.repeats : 1);
      const startTime = latestTime - (repeats - 1) * safeArrMs;

      const actionTimestamp = startTime + (repeats - 1) * safeArrMs;
      if (actionTimestamp <= event.timestamp) {
        onAction({
          dir: ctx.direction,
          timestampMs: createTimestamp(actionTimestamp),
          type: "RepeatMove",
        });
      }
    }
  };

// Creates all action functions for the DAS machine
const createDASActions = (
  onAction?: (action: Action) => void,
): {
  emitTapAction: (ctx: DASContext, event: DASEvent) => void;
  emitHoldStart: (ctx: DASContext, event: DASEvent) => void;
  emitHoldMove: (ctx: DASContext, event: DASEvent) => void;
  emitRepeatMove: (ctx: DASContext, event: DASEvent) => void;
} => ({
  emitHoldMove: createEmitHoldMove(onAction),
  emitHoldStart: createEmitHoldStart(onAction),
  emitRepeatMove: createEmitRepeatMove(onAction),
  emitTapAction: createEmitTapAction(onAction),
});

/*
 * ROBOT3 STATE BUILDERS - Pure functions that create state definitions
 * Each state builder returns a configured state with its transitions
 */

// Creates the idle state: waiting for input
const createIdleState = (
  _actions: ReturnType<typeof createDASActions>,
): MachineState<DASEvent["type"]> =>
  state(
    transition(
      "KEY_DOWN",
      "charging",
      guard(isKeyDown),
      reduce(updateContextKeyDown),
    ),
    transition(
      "UPDATE_CONFIG",
      "idle",
      guard(isConfigUpdate),
      reduce(updateConfig),
    ),
  );

// Creates the charging state: key held, waiting to see if it's tap or hold
const createChargingState = (
  actions: ReturnType<typeof createDASActions>,
): MachineState<DASEvent["type"]> =>
  state(
    transition(
      "KEY_UP",
      "idle",
      guard(isKeyUpBeforeDAS),
      reduce(updateContextKeyUp),
      action(actions.emitTapAction),
    ),
    transition(
      "KEY_UP",
      "idle",
      guard(isKeyUpAfterDAS),
      reduce(updateContextKeyUp),
      action(actions.emitTapAction),
    ),
    transition(
      "TIMER_TICK",
      "repeating",
      guard(isDASExpired),
      reduce(updateContextHoldStart),
      action(actions.emitHoldStart),
      action(actions.emitHoldMove),
    ),
    transition(
      "KEY_DOWN",
      "charging",
      guard(isKeyDown),
      reduce(updateContextKeyDown),
      action(actions.emitTapAction),
    ),
    transition(
      "UPDATE_CONFIG",
      "charging",
      guard(isConfigUpdate),
      reduce(updateConfig),
    ),
  );

// Creates the repeating state: key held and repeating at ARR rate
const createRepeatingState = (
  actions: ReturnType<typeof createDASActions>,
): MachineState<DASEvent["type"]> =>
  state(
    transition(
      "KEY_UP",
      "idle",
      guard(isKeyUpFromRepeating),
      reduce(updateContextKeyUp),
    ),
    transition(
      "TIMER_TICK",
      "repeating",
      guard(shouldEmitARR),
      reduce(updateContextARR),
      action(actions.emitRepeatMove),
    ),
    transition(
      "KEY_DOWN",
      "charging",
      guard(isKeyDown),
      reduce(updateContextKeyDown),
      action(actions.emitTapAction),
    ),
    transition(
      "UPDATE_CONFIG",
      "repeating",
      guard(isConfigUpdate),
      reduce(updateConfig),
    ),
  );

/*
 * ROBOT3 MACHINE CREATION
 * Creates the state machine definition with states, transitions, guards, reducers, and actions
 */
type DASEventType = DASEvent["type"];
type DASStatesObject = Record<DASState, MachineState<DASEventType>>;
export type DASMachine = Machine<
  DASStatesObject,
  DASContext,
  DASState,
  DASEventType
>;

export const createDASMachine = (
  initialContext: DASContext,
  onAction?: (action: Action) => void,
): DASMachine => {
  const actions = createDASActions(onAction);

  const states = {
    charging: createChargingState(actions),
    idle: createIdleState(actions),
    repeating: createRepeatingState(actions),
  } as const;

  // Note: robot3's return type narrows event type `F` to `string`.
  // We pass a precisely typed states object and initial state, then cast to `DASMachine`
  // to retain our stricter event/state typing at the boundaries of this module.
  return createMachine(
    "idle" as const,
    states as unknown as MachineStates<DASStatesObject, DASEventType>,
    (_ctx: DASContext): DASContext => initialContext,
  ) as unknown as DASMachine;
};

// Default context factory with validation
export const createDefaultDASContext = (
  dasMs = 133, // Default per DESIGN.md
  arrMs = 2, // Default per DESIGN.md
): DASContext => ({
  arrLastTime: undefined, // No ARR timer active
  arrMs: Math.max(1, arrMs), // Clamp ARR to >= 1ms (prevent divide by zero)
  dasMs: Math.max(0, dasMs), // Clamp DAS to >= 0ms
  dasStartTime: undefined, // No DAS timer active
  direction: undefined, // No key held initially
  repeats: 0, // No catch-up repeats initially
});

/*
 * ROBOT3 SERVICE TYPES
 * We leverage robot3's Machine/Service generics to strongly type the DAS service.
 */
type DASService = Service<DASMachine>;

/*
 * DAS MACHINE SERVICE - Thin wrapper around robot3
 *
 * This class provides a clean API for the DAS state machine:
 * 1. Creates and manages the robot3 service
 * 2. Collects Actions from the action callbacks
 * 3. Provides methods for sending events and getting state
 *
 * IMPORTANT: This is a THIN wrapper - no duplicate state machine logic!
 * All state transitions are handled by the robot3 machine defined above.
 */
export class DASMachineService {
  private service: DASService; // Robot3 service instance
  private actionQueue: Array<Action> = []; // Queue for collecting emitted actions
  private currentStateName: DASState; // Current state name stored from interpret callback

  constructor(initialContext?: DASContext) {
    const context = initialContext ?? createDefaultDASContext();
    this.currentStateName = "idle"; // Initialize with default state

    // Create the robot3 machine with action callback to collect Actions
    const machine = createDASMachine(context, (action) => {
      this.actionQueue.push(action); // Collect actions from robot3 action() callbacks
    });

    // Create robot3 service with onChange callback to store current state name
    this.service = interpret(machine, (service) => {
      // onChange: update a stable, typed snapshot of the current state name
      this.currentStateName = service.machine.state.name;
    });
  }

  /**
   * Send event to robot3 service and return any emitted actions
   * This is the main interface for triggering state transitions
   */
  send(event: DASEvent): Array<Action> {
    this.service.send(event); // Send event to robot3 (triggers transitions)
    const actions = [...this.actionQueue]; // Copy collected actions
    this.actionQueue = []; // Clear queue for next send
    return actions; // Return actions that were emitted
  }

  /**
   * Get current state and context from robot3
   * Uses stored currentStateName instead of accessing service.machine.state.name
   */
  getState(): { state: DASState; context: DASContext } {
    return {
      context: { ...this.service.context }, // Copy of current context
      state: this.currentStateName, // Current state name from stored value
    };
  }

  /** Thin wrapper around sending UPDATE_CONFIG event */
  updateConfig(dasMs: number, arrMs: number): Array<Action> {
    return this.send({ arrMs, dasMs, type: "UPDATE_CONFIG" });
  }

  /** Reset by creating new robot3 service with preserved timing settings */
  reset(): void {
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
      // onChange: store current state name
      this.currentStateName = service.machine.state.name;
    });
    this.actionQueue = [];
  }

  /** Testing helper - direct context access for test setup */
  setContextForTesting(context: DASContext): void {
    // Robot3's service.context is mutable and can be updated directly
    Object.assign(this.service.context, context);
  }
}
