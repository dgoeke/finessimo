import {
  computeEdges,
  makeInitialEdgeState,
  type DeviceSnapshot,
} from "./edge-computation";

import type { Device, InputAction, InputEdge, Tick } from "./keys";

// Proper types for IDH device structures
type IdhInputValue = {
  readonly inputValue: number;
};

type IdhKeyboardDevice = {
  readonly currentInputs: Record<string, IdhInputValue>;
};

type IdhGamepadDevice = {
  readonly currentInputs: Record<string, IdhInputValue>;
};

type IdhDeviceSnapshot = {
  readonly keyboard: IdhKeyboardDevice;
  readonly "0"?: IdhGamepadDevice;
  readonly "1"?: IdhGamepadDevice;
  readonly "2"?: IdhGamepadDevice;
  readonly "3"?: IdhGamepadDevice;
};

// Interface for IDH constructor that can be injected for testing
export type IdhCtor = new (opts: {
  disableMouseMovement?: boolean;
  startLoopImmediately?: boolean;
}) => {
  readAllDevices(): IdhDeviceSnapshot;
  pausePollingLoop(): void;
};

export type DeviceDriver = {
  /** Begin listening to physical devices (impure). */
  start: () => void;
  /** Stop listening / release resources (impure). */
  stop: () => void;
  /**
   * Drain buffered edges for the current app tick.
   * Assigns the provided tick to all edges and clears the buffer.
   * This is the ONLY function called from the pure loop boundary.
   */
  drainInputEdges: (tick: Tick) => ReadonlyArray<InputEdge>;
};

export type Keymap = Readonly<Map<string, ReadonlyArray<InputAction>>>; // raw code/btn → InputAction(s)

type TestDriver = {
  _testInjectEvent: (
    device: Device,
    action: InputAction,
    type: "down" | "up",
  ) => void;
} & DeviceDriver;

/** Creates test driver for unit testing */
function createTestDriver(
  edgeBuffer: Array<{
    device: Device;
    action: InputAction;
    type: "down" | "up";
  }>,
): TestDriver {
  return {
    _testInjectEvent: (
      device: Device,
      action: InputAction,
      type: "down" | "up",
    ): void => {
      edgeBuffer.push({ action, device, type });
    },
    drainInputEdges: (tick: Tick): ReadonlyArray<InputEdge> => {
      const edges = edgeBuffer.map((edge) => ({
        ...edge,
        tick,
      }));
      edgeBuffer.length = 0; // Clear buffer
      return edges;
    },
    start: (): void => {
      // No-op for tests
    },
    stop: (): void => {
      // No-op for tests
    },
  };
}

/** Type guard for IDH device structure */
function isIdhDeviceSnapshot(devices: unknown): devices is IdhDeviceSnapshot {
  if (typeof devices !== "object" || devices === null) return false;

  const devicesObj = devices as Record<string, unknown>;

  // Check for required keyboard property
  const keyboard = devicesObj["keyboard"];
  if (typeof keyboard !== "object" || keyboard === null) {
    return false;
  }

  const keyboardObj = keyboard as Record<string, unknown>;
  const currentInputs = keyboardObj["currentInputs"];
  if (typeof currentInputs !== "object" || currentInputs === null) {
    return false;
  }

  return true;
}

/** Helper to validate IDH input value structure */
function isValidInputValue(inputValue: unknown): inputValue is IdhInputValue {
  return (
    typeof inputValue === "object" &&
    inputValue !== null &&
    "inputValue" in inputValue &&
    typeof (inputValue as Record<string, unknown>)["inputValue"] === "number"
  );
}

/** Extract pressed KeyboardEvent.code values from the IDH devices snapshot. */
function getPressedKeyboardCodes(
  devices: IdhDeviceSnapshot,
): ReadonlySet<string> {
  const out = new Set<string>();

  // With proper typing, we can safely access the keyboard device
  const { currentInputs } = devices.keyboard;

  // IDH keyboard currentInputs is Record<string, IdhInputValue>
  // where the key is the code and IdhInputValue.inputValue > 0 means pressed
  for (const [code, inputValue] of Object.entries(currentInputs)) {
    if (isValidInputValue(inputValue) && inputValue.inputValue > 0) {
      out.add(code);
    }
  }

  return out;
}

/** Extract pressed gamepad button names from the IDH devices snapshot. */
function getPressedGamepadButtons(
  devices: IdhDeviceSnapshot,
): ReadonlySet<string> {
  const out = new Set<string>();

  // IDH exposes gamepad devices as "0", "1", "2", "3"
  for (const deviceKey of ["0", "1", "2", "3"] as const) {
    const gamepad = devices[deviceKey];
    if (!gamepad) continue;

    extractGamepadInputs(gamepad.currentInputs, out);
  }

  return out;
}

/** Helper function to extract gamepad inputs and reduce cognitive complexity */
function extractGamepadInputs(
  currentInputs: Record<string, IdhInputValue>,
  out: Set<string>,
): void {
  for (const [inputName, inputValue] of Object.entries(currentInputs)) {
    if (inputValue.inputValue <= 0) continue;

    if (inputName.startsWith("button")) {
      const buttonIndex = inputName.replace("button", "");
      out.add(`gp:button:${buttonIndex}`);
    } else if (inputName.startsWith("axis")) {
      extractAxisInput(inputName, inputValue.inputValue, out);
    }
  }
}

/** Helper function to extract axis input */
function extractAxisInput(
  inputName: string,
  inputValue: number,
  out: Set<string>,
): void {
  const axisRegex = /axis(\d+)/;
  const axisMatch = axisRegex.exec(inputName);
  const axisIndex = axisMatch?.[1];
  if (axisIndex !== undefined) {
    const direction = inputValue > 0 ? "+" : "-";
    out.add(`gp:axis:${axisIndex}:${direction}`);
  }
}

/** Helper to map gamepad button events to codes */
export function mapButtonEvent(event: {
  type: string;
  buttonIndex?: number;
}): string | null {
  if (event.type === "gamepadButtonDown" || event.type === "gamepadButtonUp") {
    if (typeof event.buttonIndex !== "number") return null;
    return `gp:button:${String(event.buttonIndex)}`;
  }
  return null;
}

/** Helper to map gamepad axis events to codes */
export function mapAxisEvent(event: {
  type: string;
  axisIndex?: number;
  value?: number;
}): string | null {
  if (event.type === "gamepadAxisChange") {
    if (typeof event.axisIndex !== "number" || typeof event.value !== "number")
      return null;
    const threshold = 0.5;
    if (Math.abs(event.value) < threshold) return null;
    const direction = event.value > 0 ? "+" : "-";
    return `gp:axis:${String(event.axisIndex)}:${direction}`;
  }
  return null;
}

/** Helper to determine if gamepad event is down or up */
export function getGamepadEventType(event: {
  type: string;
  value?: number;
}): "down" | "up" {
  return event.type === "gamepadButtonDown" ||
    (event.type === "gamepadAxisChange" &&
      typeof event.value === "number" &&
      Math.abs(event.value) >= 0.5)
    ? "down"
    : "up";
}

/** Factory to create a driver using polling from input-device-handler with injected constructor. */
export function makeDeviceDriverWithCtor(
  IdhConstructor: IdhCtor,
  opts: {
    keyboardMap: Keymap;
    gamepadMap: Keymap;
  },
): DeviceDriver {
  // Test double for unit testing
  if (process.env["NODE_ENV"] === "test") {
    const edgeBuffer: Array<{
      device: Device;
      action: InputAction;
      type: "down" | "up";
    }> = [];
    return createTestDriver(edgeBuffer);
  }

  // Production implementation using polling approach
  let idh: InstanceType<IdhCtor> | null = null;

  // Track previous edge states for edge detection
  let prevEdgeState = makeInitialEdgeState();

  function readEdges(tick: Tick): ReadonlyArray<InputEdge> {
    if (!idh) return [];

    // Read current input snapshot from IDH
    const devices = idh.readAllDevices();

    // Validate device structure - if invalid, return empty edges
    if (!isIdhDeviceSnapshot(devices)) {
      return [];
    }

    // Build device snapshot
    const snapshot: DeviceSnapshot = {
      gamepadPressed: getPressedGamepadButtons(devices),
      keyboardPressed: getPressedKeyboardCodes(devices),
    };

    // Use pure function to compute edges
    const result = computeEdges(
      prevEdgeState,
      snapshot,
      opts.keyboardMap,
      opts.gamepadMap,
      tick,
    );

    // Update state for next tick
    prevEdgeState = result.nextEdgeState;

    return result.edges;
  }

  return {
    drainInputEdges: readEdges,

    start: (): void => {
      try {
        idh = new IdhConstructor({
          disableMouseMovement: true,
          startLoopImmediately: false,
        });
      } catch (error) {
        console.warn("Failed to initialize InputDeviceHandler:", error);
        idh = null;
      }
    },

    stop: (): void => {
      if (idh) {
        idh.pausePollingLoop();
      }
      idh = null;
    },
  };
}

/** Factory to create a driver using polling from input-device-handler (production convenience). */
export async function makeDeviceDriver(opts: {
  keyboardMap: Keymap;
  gamepadMap: Keymap;
}): Promise<DeviceDriver> {
  const { InputDeviceHandler } = await import("input-device-handler");
  return makeDeviceDriverWithCtor(InputDeviceHandler as IdhCtor, opts);
}
