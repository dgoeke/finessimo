import type { Keymap } from "./adapter";
import type { InputAction, InputEdge, Tick } from "./keys";

/** All logical input actions the engine understands. */
const ALL_INPUT_ACTIONS: ReadonlyArray<InputAction> = [
  "NavigateUp",
  "NavigateDown",
  "NavigateLeft",
  "NavigateRight",
  "Select",
  "Back",
  "SoftDrop",
  "HardDrop",
  "RotateCW",
  "RotateCCW",
  "Hold",
] as const;

export type DeviceSnapshot = Readonly<{
  keyboardPressed: ReadonlySet<string>;
  gamepadPressed: ReadonlySet<string>;
}>;

export type EdgeState = Readonly<{
  down: Record<InputAction, { keyboard: boolean; gamepad: boolean }>;
}>;

export type EdgeComputationResult = Readonly<{
  edges: ReadonlyArray<InputEdge>;
  nextEdgeState: EdgeState;
}>;

export function makeInitialEdgeState(): EdgeState {
  return {
    down: Object.fromEntries(
      ALL_INPUT_ACTIONS.map((k) => [k, { gamepad: false, keyboard: false }]),
    ) as EdgeState["down"],
  };
}

/** Helper: check if ANY binding entry maps to this InputAction and is currently pressed. */
function isInputActionDownFromDevice(
  map: Keymap,
  action: InputAction,
  pressedTokens: ReadonlySet<string>,
): boolean {
  for (const [token, mappedActions] of map.entries()) {
    if (pressedTokens.has(token) && mappedActions.includes(action)) {
      return true;
    }
  }
  return false;
}

/**
 * Pure function to compute InputEdges from device snapshots.
 * Diffs per device first to ensure correct device attribution.
 */
export function computeEdges(
  prevEdgeState: EdgeState,
  snapshot: DeviceSnapshot,
  keyboardMap: Keymap,
  gamepadMap: Keymap,
  tick: Tick,
): EdgeComputationResult {
  // Create "down now" state directly as Record to avoid Map.get() uncertainty
  const kbDownNow: Record<InputAction, boolean> = {} as Record<
    InputAction,
    boolean
  >;
  const gpDownNow: Record<InputAction, boolean> = {} as Record<
    InputAction,
    boolean
  >;

  for (const action of ALL_INPUT_ACTIONS) {
    kbDownNow[action] = isInputActionDownFromDevice(
      keyboardMap,
      action,
      snapshot.keyboardPressed,
    );
    gpDownNow[action] = isInputActionDownFromDevice(
      gamepadMap,
      action,
      snapshot.gamepadPressed,
    );
  }

  const edges: Array<InputEdge> = [];

  // Deterministic order: keyboard first, then gamepad
  for (const action of ALL_INPUT_ACTIONS) {
    const prevDev = prevEdgeState.down[action];
    const currDev = {
      gamepad: gpDownNow[action],
      keyboard: kbDownNow[action],
    };

    // Diff per device so "who caused the edge" is correct
    if (currDev.keyboard !== prevDev.keyboard) {
      edges.push({
        action,
        device: "keyboard",
        tick,
        type: currDev.keyboard ? "down" : "up",
      });
    }
    if (currDev.gamepad !== prevDev.gamepad) {
      edges.push({
        action,
        device: "gamepad",
        tick,
        type: currDev.gamepad ? "down" : "up",
      });
    }
  }

  const nextEdgeState: EdgeState = {
    down: Object.fromEntries(
      ALL_INPUT_ACTIONS.map((k) => [
        k,
        {
          gamepad: gpDownNow[k],
          keyboard: kbDownNow[k],
        },
      ]),
    ) as EdgeState["down"],
  };

  return { edges, nextEdgeState };
}

export { ALL_INPUT_ACTIONS };

// Legacy export for backward compatibility during migration
/** @deprecated Use ALL_INPUT_ACTIONS instead */
export const ALL_KEYS = ALL_INPUT_ACTIONS;
