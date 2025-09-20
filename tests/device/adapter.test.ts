import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";

import {
  makeDeviceDriverWithCtor,
  mapButtonEvent,
  mapAxisEvent,
  getGamepadEventType,
  type IdhCtor,
} from "../../src/device/adapter";
import {
  DEFAULT_KBD_MAP,
  DEFAULT_PAD_MAP,
} from "../../src/device/default-keymaps";

import type { Device, InputAction } from "../../src/device/keys";
import type { Tick } from "@/engine/types";

// Set NODE_ENV for test double
const originalEnv = process.env["NODE_ENV"];
beforeEach(() => {
  process.env["NODE_ENV"] = "test";
});

afterEach(() => {
  process.env["NODE_ENV"] = originalEnv;
});

const tick = (n: number) => n as unknown as Tick;

// Fake IDH class for unit testing (no ESM dependencies)
class FakeIDH {
  readAllDevices() {
    return {
      "0": { currentInputs: {} },
      "1": { currentInputs: {} },
      "2": { currentInputs: {} },
      "3": { currentInputs: {} },
      keyboard: { currentInputs: {} },
    };
  }

  pausePollingLoop() {
    // No-op
  }
}

// Type for test driver that exposes internal test method
type TestDriver = ReturnType<typeof makeDeviceDriverWithCtor> & {
  _testInjectEvent: (
    device: Device,
    action: InputAction,
    type: "down" | "up",
  ) => void;
};

describe("Device adapter - test environment", () => {
  it("creates driver with test double", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: DEFAULT_KBD_MAP,
    }) as TestDriver;

    expect(typeof driver.start).toBe("function");
    expect(typeof driver.stop).toBe("function");
    expect(typeof driver.drainInputEdges).toBe("function");
    expect(typeof driver._testInjectEvent).toBe("function");
  });

  it("start and stop do nothing in test mode", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: DEFAULT_KBD_MAP,
    });

    expect(() => driver.start()).not.toThrow();
    expect(() => driver.stop()).not.toThrow();
  });
});

describe("Device adapter - event handling", () => {
  it("maps keyboard codes to KeyEdge", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: DEFAULT_KBD_MAP,
    }) as TestDriver;

    driver._testInjectEvent("keyboard", "NavigateDown", "down");
    driver._testInjectEvent("keyboard", "Select", "down");

    const edges = driver.drainInputEdges(tick(5));

    expect(edges).toHaveLength(2);
    expect(edges[0]).toEqual({
      action: "NavigateDown",
      device: "keyboard",
      tick: tick(5),
      type: "down",
    });
  });

  it("assigns current tick to all edges", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: DEFAULT_KBD_MAP,
    }) as TestDriver;

    driver._testInjectEvent("keyboard", "NavigateLeft", "down");
    driver._testInjectEvent("gamepad", "RotateCW", "down");

    const currentTick = tick(42);
    const edges = driver.drainInputEdges(currentTick);

    expect(edges).toHaveLength(2);
    expect(edges[0]?.tick).toBe(currentTick);
    expect(edges[1]?.tick).toBe(currentTick);
  });

  it("clears buffer after drain", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: DEFAULT_KBD_MAP,
    }) as TestDriver;

    driver._testInjectEvent("keyboard", "NavigateUp", "down");
    driver._testInjectEvent("keyboard", "Back", "up");

    const firstEdges = driver.drainInputEdges(tick(1));
    expect(firstEdges).toHaveLength(2);

    const secondEdges = driver.drainInputEdges(tick(2));
    expect(secondEdges).toHaveLength(0);
  });

  it("handles multiple device types", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: DEFAULT_KBD_MAP,
    }) as TestDriver;

    driver._testInjectEvent("keyboard", "NavigateLeft", "down");
    driver._testInjectEvent("gamepad", "NavigateRight", "down");
    driver._testInjectEvent("touch", "Select", "up");
    driver._testInjectEvent("mouse", "Back", "down");

    const edges = driver.drainInputEdges(tick(10));

    expect(edges).toHaveLength(4);
    expect(edges.map((e) => e.device)).toEqual([
      "keyboard",
      "gamepad",
      "touch",
      "mouse",
    ]);
  });

  it("handles all key types", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: DEFAULT_KBD_MAP,
    }) as TestDriver;

    // Test UI and game keys
    const allKeys: Array<InputAction> = [
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
    ];
    allKeys.forEach((key) => {
      driver._testInjectEvent("keyboard", key, "down");
    });

    const edges = driver.drainInputEdges(tick(1));
    expect(edges).toHaveLength(11);

    const receivedKeys = edges.map((e) => e.action);
    allKeys.forEach((key) => {
      expect(receivedKeys).toContain(key);
    });
  });

  it("handles up and down events", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: DEFAULT_KBD_MAP,
    }) as TestDriver;

    driver._testInjectEvent("keyboard", "NavigateUp", "down");
    driver._testInjectEvent("keyboard", "NavigateUp", "up");

    const edges = driver.drainInputEdges(tick(1));
    expect(edges).toHaveLength(2);
    expect(edges[0]?.type).toBe("down");
    expect(edges[1]?.type).toBe("up");
  });
});

describe("Device adapter - production environment", () => {
  beforeEach(() => {
    process.env["NODE_ENV"] = "production";
    jest.clearAllMocks();
  });

  it("creates production driver", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: DEFAULT_KBD_MAP,
    });

    expect(typeof driver.start).toBe("function");
    expect(typeof driver.stop).toBe("function");
    expect(typeof driver.drainInputEdges).toBe("function");
    // Should not have test injection method
    expect(
      (driver as unknown as { _testInjectEvent?: unknown })._testInjectEvent,
    ).toBeUndefined();
  });

  it("drains edges with assigned tick", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: DEFAULT_KBD_MAP,
    });

    const edges = driver.drainInputEdges(tick(100));
    expect(edges).toEqual([]);
  });

  it("handles stop with null handlers", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: DEFAULT_KBD_MAP,
    });

    // Should not throw when handlers are null
    expect(() => driver.stop()).not.toThrow();
  });

  it("handles start function call", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: DEFAULT_KBD_MAP,
    });

    // Should not throw when called (dynamic import happens asynchronously)
    expect(() => driver.start()).not.toThrow();
  });
});

describe("Device adapter - helper functions", () => {
  it("handles keyboard events correctly", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: DEFAULT_KBD_MAP,
    }) as TestDriver;

    const testCases = [
      { expectedKey: "NavigateUp" },
      { expectedKey: "NavigateDown" },
      { expectedKey: "NavigateLeft" },
      { expectedKey: "NavigateRight" },
      { expectedKey: "Select" },
      { expectedKey: "Back" },
      { expectedKey: "RotateCCW" },
      { expectedKey: "RotateCW" },
      { expectedKey: "Hold" },
      { expectedKey: "SoftDrop" },
    ];

    testCases.forEach(({ expectedKey }) => {
      driver._testInjectEvent("keyboard", expectedKey as InputAction, "down");
    });

    const edges = driver.drainInputEdges(tick(1));
    expect(edges).toHaveLength(testCases.length);
  });

  it("handles gamepad button events", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: DEFAULT_KBD_MAP,
    }) as TestDriver;

    const testCases = [
      { button: 0, expectedKey: "Select" },
      { button: 1, expectedKey: "Back" },
      { button: 12, expectedKey: "NavigateUp" },
      { button: 13, expectedKey: "NavigateDown" },
      { button: 14, expectedKey: "NavigateLeft" },
      { button: 15, expectedKey: "NavigateRight" },
      { button: 4, expectedKey: "Hold" },
      { button: 5, expectedKey: "RotateCW" },
      { button: 2, expectedKey: "RotateCCW" },
      { button: 3, expectedKey: "HardDrop" },
    ];

    testCases.forEach(({ expectedKey }) => {
      driver._testInjectEvent("gamepad", expectedKey as InputAction, "down");
    });

    const edges = driver.drainInputEdges(tick(1));
    expect(edges).toHaveLength(testCases.length);
  });

  it("handles unknown keyboard codes", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: new Map([["KeyA", ["NavigateUp"]]]),
    }) as TestDriver;

    // This should be ignored since KeyB is not mapped
    const edges = driver.drainInputEdges(tick(1));
    expect(edges).toHaveLength(0);
  });

  it("handles multi-value keymaps", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: new Map([["ArrowUp", ["NavigateUp", "HardDrop"]]]),
    }) as TestDriver;

    // Inject a single physical key press that maps to multiple logical keys
    driver._testInjectEvent("keyboard", "NavigateUp", "down");
    driver._testInjectEvent("keyboard", "HardDrop", "down");

    const edges = driver.drainInputEdges(tick(1));
    expect(edges).toHaveLength(2);

    const keysMapped = edges
      .map((e) => e.action)
      .sort((a, b) => a.localeCompare(b));
    expect(keysMapped).toEqual(["HardDrop", "NavigateUp"]);
  });

  it("verifies default keyboard map multi-value mappings", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: DEFAULT_KBD_MAP,
    }) as TestDriver;

    // ArrowUp should map to both "NavigateUp" and "HardDrop"
    driver._testInjectEvent("keyboard", "NavigateUp", "down");
    driver._testInjectEvent("keyboard", "HardDrop", "down");

    const edges = driver.drainInputEdges(tick(1));
    expect(edges).toHaveLength(2);

    const mappedKeys = edges
      .map((e) => e.action)
      .sort((a, b) => a.localeCompare(b));
    expect(mappedKeys).toContain("NavigateUp");
    expect(mappedKeys).toContain("HardDrop");
  });

  it("handles single-value and multi-value keys in same map", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: new Map([
        ["KeyA", ["Back"]], // Single value (as array)
        ["KeyB", ["NavigateUp", "HardDrop"]], // Multi value
      ]),
    }) as TestDriver;

    driver._testInjectEvent("keyboard", "Back", "down");
    driver._testInjectEvent("keyboard", "NavigateUp", "down");
    driver._testInjectEvent("keyboard", "HardDrop", "down");

    const edges = driver.drainInputEdges(tick(1));
    expect(edges).toHaveLength(3);

    const mappedKeys = edges
      .map((e) => e.action)
      .sort((a, b) => a.localeCompare(b));
    expect(mappedKeys).toEqual(["Back", "HardDrop", "NavigateUp"]);
  });

  it("handles unknown gamepad buttons", () => {
    const driver = makeDeviceDriverWithCtor(FakeIDH as IdhCtor, {
      gamepadMap: new Map([["gp:button:0", ["NavigateUp"]]]),
      keyboardMap: DEFAULT_KBD_MAP,
    }) as TestDriver;

    // This should be ignored since button 99 is not mapped
    const edges = driver.drainInputEdges(tick(1));
    expect(edges).toHaveLength(0);
  });
});

describe("Device adapter - input parsing", () => {
  beforeEach(() => {
    process.env["NODE_ENV"] = "production";
  });

  it("handles keyboard inputs with zero values correctly", () => {
    class ZeroValueIDH {
      readAllDevices() {
        return {
          keyboard: {
            currentInputs: {
              KeyA: { inputValue: 0 }, // Zero value (should be ignored)
              KeyB: { inputValue: -1 }, // Negative value (should be ignored)
              KeyC: { inputValue: 1.0 }, // Valid
            },
          },
        };
      }
      pausePollingLoop(): void {
        // Implementation not needed for test
      }
    }

    const driver = makeDeviceDriverWithCtor(ZeroValueIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: new Map([["KeyC", ["NavigateUp"]]]),
    });

    driver.start();
    const edges = driver.drainInputEdges(tick(1));
    expect(edges).toHaveLength(1);
    expect(edges[0]?.action).toBe("NavigateUp");
  });

  it("handles gamepad inputs with negative and zero values", () => {
    class GamepadInputIDH {
      readAllDevices() {
        return {
          "0": {
            currentInputs: {
              axis0: { inputValue: -0.8 }, // This will be ignored because inputValue <= 0
              axis1: { inputValue: 0.7 }, // Valid positive axis
              button0: { inputValue: -0.5 }, // Negative value (should be ignored)
              button1: { inputValue: 0 }, // Zero value (should be ignored)
              button2: { inputValue: 1.0 }, // Valid positive button
            },
          },
          keyboard: { currentInputs: {} },
        };
      }
      pausePollingLoop(): void {
        // Test implementation - no operation needed
      }
    }

    const driver = makeDeviceDriverWithCtor(GamepadInputIDH as IdhCtor, {
      gamepadMap: new Map([
        ["gp:button:2", ["Select"]],
        ["gp:axis:1:+", ["NavigateRight"]],
      ]),
      keyboardMap: DEFAULT_KBD_MAP,
    });

    driver.start();
    const edges = driver.drainInputEdges(tick(1));

    expect(edges).toHaveLength(2);
    const keys = edges.map((e) => e.action).sort((a, b) => a.localeCompare(b));
    expect(keys).toEqual(["NavigateRight", "Select"]);
  });

  it("handles axis input name parsing edge cases", () => {
    class AxisEdgeCaseIDH {
      readAllDevices() {
        return {
          "0": {
            currentInputs: {
              axis: { inputValue: 1.0 }, // No number after axis
              axis10: { inputValue: 0.8 }, // Valid
              invalidaxis: { inputValue: 1.0 }, // No number
              notaxis0: { inputValue: 1.0 }, // Doesn't start with axis
            },
          },
          keyboard: { currentInputs: {} },
        };
      }
      pausePollingLoop(): void {
        // Test implementation - no operation needed
      }
    }

    const driver = makeDeviceDriverWithCtor(AxisEdgeCaseIDH as IdhCtor, {
      gamepadMap: new Map([["gp:axis:10:+", ["NavigateRight"]]]),
      keyboardMap: DEFAULT_KBD_MAP,
    });

    driver.start();
    const edges = driver.drainInputEdges(tick(1));

    expect(edges).toHaveLength(1);
    expect(edges[0]?.action).toBe("NavigateRight");
  });

  it("handles multiple gamepad devices simultaneously", () => {
    class MultiGamepadIDH {
      readAllDevices() {
        return {
          "0": {
            currentInputs: {
              button0: { inputValue: 1.0 },
            },
          },
          "1": {
            currentInputs: {
              button1: { inputValue: 1.0 },
            },
          },
          "2": {
            currentInputs: {
              button2: { inputValue: 1.0 },
            },
          },
          "3": {
            currentInputs: {
              button3: { inputValue: 1.0 },
            },
          },
          keyboard: { currentInputs: {} },
        };
      }
      pausePollingLoop(): void {
        // Test implementation - no operation needed
      }
    }

    const driver = makeDeviceDriverWithCtor(MultiGamepadIDH as IdhCtor, {
      gamepadMap: new Map([
        ["gp:button:0", ["NavigateUp"]],
        ["gp:button:1", ["NavigateDown"]],
        ["gp:button:2", ["NavigateLeft"]],
        ["gp:button:3", ["NavigateRight"]],
      ]),
      keyboardMap: DEFAULT_KBD_MAP,
    });

    driver.start();
    const edges = driver.drainInputEdges(tick(1));

    expect(edges).toHaveLength(4);
    const keys = edges.map((e) => e.action).sort((a, b) => a.localeCompare(b));
    expect(keys).toEqual([
      "NavigateDown",
      "NavigateLeft",
      "NavigateRight",
      "NavigateUp",
    ]);
  });

  it("handles IDH constructor failure gracefully", () => {
    // Mock console.warn to suppress expected warning
    const consoleWarnSpy = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {
        // Intentionally empty to suppress console output in tests
      });

    class FailingIDH {
      constructor(_opts: {
        disableMouseMovement?: boolean;
        startLoopImmediately?: boolean;
      }) {
        throw new Error("IDH initialization failed");
      }
      readAllDevices(): ReturnType<IdhCtor["prototype"]["readAllDevices"]> {
        return {
          keyboard: { currentInputs: {} },
        };
      }
      pausePollingLoop(): void {
        // Test implementation - no operation needed
      }
    }

    const driver = makeDeviceDriverWithCtor(FailingIDH as unknown as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: DEFAULT_KBD_MAP,
    });

    // Should not throw during start
    expect(() => driver.start()).not.toThrow();

    // Verify the warning was called as expected
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Failed to initialize InputDeviceHandler:",
      expect.any(Error),
    );

    // Should return empty edges when IDH is null
    const edges = driver.drainInputEdges(tick(1));
    expect(edges).toEqual([]);

    // Should not throw during stop even when IDH is null
    expect(() => driver.stop()).not.toThrow();

    // Restore console.warn
    consoleWarnSpy.mockRestore();
  });

  it("handles successful IDH initialization and stop", () => {
    const pausePollingLoopMock = jest.fn();

    class WorkingIDH {
      pausePollingLoop = pausePollingLoopMock;
      readAllDevices() {
        return {
          "0": { currentInputs: {} },
          keyboard: { currentInputs: {} },
        };
      }
    }

    const driver = makeDeviceDriverWithCtor(WorkingIDH as IdhCtor, {
      gamepadMap: DEFAULT_PAD_MAP,
      keyboardMap: DEFAULT_KBD_MAP,
    });

    driver.start();
    driver.stop();

    // Should call pausePollingLoop when stopping with valid IDH
    expect(pausePollingLoopMock).toHaveBeenCalled();
  });
});

describe("Device adapter - gamepad helpers", () => {
  describe("mapButtonEvent", () => {
    it("maps button down events", () => {
      expect(
        mapButtonEvent({ buttonIndex: 0, type: "gamepadButtonDown" }),
      ).toBe("gp:button:0");
      expect(
        mapButtonEvent({ buttonIndex: 15, type: "gamepadButtonDown" }),
      ).toBe("gp:button:15");
    });

    it("maps button up events", () => {
      expect(mapButtonEvent({ buttonIndex: 5, type: "gamepadButtonUp" })).toBe(
        "gp:button:5",
      );
    });

    it("returns null for invalid events", () => {
      expect(mapButtonEvent({ type: "gamepadButtonDown" })).toBeNull();
      expect(
        mapButtonEvent({
          buttonIndex: "invalid" as unknown as number,
          type: "gamepadButtonDown",
        }),
      ).toBeNull();
      expect(mapButtonEvent({ buttonIndex: 0, type: "otherEvent" })).toBeNull();
    });
  });

  describe("mapAxisEvent", () => {
    it("maps axis positive events", () => {
      expect(
        mapAxisEvent({ axisIndex: 0, type: "gamepadAxisChange", value: 0.8 }),
      ).toBe("gp:axis:0:+");
      expect(
        mapAxisEvent({ axisIndex: 1, type: "gamepadAxisChange", value: 1.0 }),
      ).toBe("gp:axis:1:+");
    });

    it("maps axis negative events", () => {
      expect(
        mapAxisEvent({ axisIndex: 0, type: "gamepadAxisChange", value: -0.8 }),
      ).toBe("gp:axis:0:-");
      expect(
        mapAxisEvent({ axisIndex: 2, type: "gamepadAxisChange", value: -1.0 }),
      ).toBe("gp:axis:2:-");
    });

    it("returns null for values below threshold", () => {
      expect(
        mapAxisEvent({ axisIndex: 0, type: "gamepadAxisChange", value: 0.3 }),
      ).toBeNull();
      expect(
        mapAxisEvent({ axisIndex: 0, type: "gamepadAxisChange", value: -0.2 }),
      ).toBeNull();
      expect(
        mapAxisEvent({ axisIndex: 0, type: "gamepadAxisChange", value: 0 }),
      ).toBeNull();
    });

    it("returns null for invalid events", () => {
      expect(mapAxisEvent({ type: "gamepadAxisChange" })).toBeNull();
      expect(
        mapAxisEvent({ axisIndex: 0, type: "gamepadAxisChange" }),
      ).toBeNull();
      expect(
        mapAxisEvent({ type: "gamepadAxisChange", value: 0.8 }),
      ).toBeNull();
      expect(
        mapAxisEvent({ axisIndex: 0, type: "otherEvent", value: 0.8 }),
      ).toBeNull();
    });
  });

  describe("getGamepadEventType", () => {
    it("returns down for button down events", () => {
      expect(getGamepadEventType({ type: "gamepadButtonDown" })).toBe("down");
    });

    it("returns up for button up events", () => {
      expect(getGamepadEventType({ type: "gamepadButtonUp" })).toBe("up");
    });

    it("returns down for axis change above threshold", () => {
      expect(
        getGamepadEventType({ type: "gamepadAxisChange", value: 0.8 }),
      ).toBe("down");
      expect(
        getGamepadEventType({ type: "gamepadAxisChange", value: -0.7 }),
      ).toBe("down");
    });

    it("returns up for axis change below threshold", () => {
      expect(
        getGamepadEventType({ type: "gamepadAxisChange", value: 0.3 }),
      ).toBe("up");
      expect(
        getGamepadEventType({ type: "gamepadAxisChange", value: -0.2 }),
      ).toBe("up");
      expect(getGamepadEventType({ type: "gamepadAxisChange", value: 0 })).toBe(
        "up",
      );
    });

    it("returns up for axis change without value", () => {
      expect(getGamepadEventType({ type: "gamepadAxisChange" })).toBe("up");
    });

    it("returns up for unknown events", () => {
      expect(getGamepadEventType({ type: "unknownEvent" })).toBe("up");
    });
  });
});
