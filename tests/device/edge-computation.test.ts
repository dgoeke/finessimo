import { describe, it, expect } from "@jest/globals";

import {
  computeEdges,
  ALL_INPUT_ACTIONS,
  makeInitialEdgeState,
  type DeviceSnapshot,
  type EdgeState,
} from "../../src/device/edge-computation";

import type { Keymap } from "../../src/device/adapter";
import type { Tick } from "../../src/device/keys";

const tick = (n: number) => n as unknown as Tick;

function createSnapshot(
  keyboardCodes: Array<string> = [],
  gamepadButtons: Array<string> = [],
): DeviceSnapshot {
  return {
    gamepadPressed: new Set(gamepadButtons),
    keyboardPressed: new Set(keyboardCodes),
  };
}

const DEFAULT_KBD_MAP: Keymap = new Map([
  ["ArrowUp", ["NavigateUp", "HardDrop"]],
  ["ArrowDown", ["NavigateDown", "SoftDrop"]],
  ["ArrowLeft", ["NavigateLeft"]],
  ["ArrowRight", ["NavigateRight"]],
  ["Enter", ["Select"]],
  ["Space", ["Select"]],
  ["Escape", ["Back"]],
  ["KeyZ", ["RotateCCW"]],
  ["KeyX", ["RotateCW"]],
  ["KeyC", ["Hold"]],
  ["ShiftLeft", ["SoftDrop"]],
  ["ShiftRight", ["SoftDrop"]],
]);

const DEFAULT_PAD_MAP: Keymap = new Map([
  ["gp:button:0", ["Select"]],
  ["gp:button:1", ["Back"]],
  ["gp:button:12", ["NavigateUp"]],
  ["gp:button:13", ["NavigateDown"]],
  ["gp:button:14", ["NavigateLeft"]],
  ["gp:button:15", ["NavigateRight"]],
  ["gp:button:4", ["Hold"]],
  ["gp:button:5", ["RotateCW"]],
  ["gp:button:2", ["RotateCCW"]],
  ["gp:button:3", ["HardDrop"]],
  ["gp:axis:0:-", ["NavigateLeft"]],
  ["gp:axis:0:+", ["NavigateRight"]],
  ["gp:axis:1:+", ["NavigateDown"]],
]);

describe("computeEdges - basic edge detection", () => {
  const emptyPrevState = makeInitialEdgeState();

  it("computes no edges when no keys are pressed", () => {
    const snapshot = createSnapshot();
    const result = computeEdges(
      emptyPrevState,
      snapshot,
      DEFAULT_KBD_MAP,
      DEFAULT_PAD_MAP,
      tick(1),
    );

    expect(result.edges).toHaveLength(0);
    // All keys should be down: false for both devices
    expect(
      Object.values(result.nextEdgeState.down).every(
        (dev) => !dev.keyboard && !dev.gamepad,
      ),
    ).toBe(true);
  });

  it("computes down edge for keyboard key press", () => {
    const snapshot = createSnapshot(["ArrowLeft"]);
    const result = computeEdges(
      emptyPrevState,
      snapshot,
      DEFAULT_KBD_MAP,
      DEFAULT_PAD_MAP,
      tick(1),
    );

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toEqual({
      action: "NavigateLeft",
      device: "keyboard",
      tick: tick(1),
      type: "down",
    });
    expect(result.nextEdgeState.down.NavigateLeft.keyboard).toBe(true);
    expect(result.nextEdgeState.down.NavigateLeft.gamepad).toBe(false);
  });

  it("computes up edge for keyboard key release", () => {
    const prevState: EdgeState = {
      down: Object.fromEntries(
        ALL_INPUT_ACTIONS.map((k) => [
          k,
          { gamepad: false, keyboard: k === "NavigateLeft" },
        ]),
      ) as EdgeState["down"],
    };
    const snapshot = createSnapshot(); // no keys pressed
    const result = computeEdges(
      prevState,
      snapshot,
      DEFAULT_KBD_MAP,
      DEFAULT_PAD_MAP,
      tick(2),
    );

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toEqual({
      action: "NavigateLeft",
      device: "keyboard",
      tick: tick(2),
      type: "up",
    });
    expect(result.nextEdgeState.down.NavigateLeft.keyboard).toBe(false);
    expect(result.nextEdgeState.down.NavigateLeft.gamepad).toBe(false);
  });
});

describe("computeEdges - multi-value keymaps", () => {
  const emptyPrevState = makeInitialEdgeState();

  it("computes multiple edges for multi-value keymap", () => {
    const snapshot = createSnapshot(["ArrowUp"]); // Maps to both "NavigateUp" and "HardDrop"
    const result = computeEdges(
      emptyPrevState,
      snapshot,
      DEFAULT_KBD_MAP,
      DEFAULT_PAD_MAP,
      tick(1),
    );

    expect(result.edges).toHaveLength(2);
    const actions = result.edges
      .map((e) => e.action)
      .sort((a, b) => a.localeCompare(b));
    expect(actions).toEqual(["HardDrop", "NavigateUp"]);
    expect(result.edges.every((e) => e.type === "down")).toBe(true);
    expect(result.edges.every((e) => e.device === "keyboard")).toBe(true);
  });
});

describe("computeEdges - device attribution", () => {
  const emptyPrevState = makeInitialEdgeState();

  it("computes gamepad edges", () => {
    const snapshot = createSnapshot([], ["gp:button:0"]); // Gamepad A/Cross -> Select
    const result = computeEdges(
      emptyPrevState,
      snapshot,
      DEFAULT_KBD_MAP,
      DEFAULT_PAD_MAP,
      tick(1),
    );

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toEqual({
      action: "Select",
      device: "gamepad",
      tick: tick(1),
      type: "down",
    });
  });

  it("computes gamepad up edges", () => {
    const prevState: EdgeState = {
      down: Object.fromEntries(
        ALL_INPUT_ACTIONS.map((k) => [
          k,
          { gamepad: k === "Select", keyboard: false },
        ]),
      ) as EdgeState["down"],
    };
    const snapshot = createSnapshot([], []); // no gamepad buttons pressed
    const result = computeEdges(
      prevState,
      snapshot,
      DEFAULT_KBD_MAP,
      DEFAULT_PAD_MAP,
      tick(2),
    );

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toEqual({
      action: "Select",
      device: "gamepad",
      tick: tick(2),
      type: "up",
    });
    expect(result.nextEdgeState.down.Select.gamepad).toBe(false);
  });

  it("handles both keyboard and gamepad for same action", () => {
    // Both keyboard Space and gamepad button:0 map to Select
    const snapshot = createSnapshot(["Space"], ["gp:button:0"]);
    const result = computeEdges(
      emptyPrevState,
      snapshot,
      DEFAULT_KBD_MAP,
      DEFAULT_PAD_MAP,
      tick(1),
    );

    // Should get two edges - one from each device
    expect(result.edges).toHaveLength(2);

    const keyboardEdge = result.edges.find((e) => e.device === "keyboard");
    const gamepadEdge = result.edges.find((e) => e.device === "gamepad");

    expect(keyboardEdge).toEqual({
      action: "Select",
      device: "keyboard",
      tick: tick(1),
      type: "down",
    });

    expect(gamepadEdge).toEqual({
      action: "Select",
      device: "gamepad",
      tick: tick(1),
      type: "down",
    });

    expect(result.nextEdgeState.down.Select.keyboard).toBe(true);
    expect(result.nextEdgeState.down.Select.gamepad).toBe(true);
  });
});

describe("computeEdges - unmapped keys", () => {
  const emptyPrevState = makeInitialEdgeState();

  it("ignores unmapped keyboard codes", () => {
    const snapshot = createSnapshot(["KeyQ"]); // Not mapped
    const result = computeEdges(
      emptyPrevState,
      snapshot,
      DEFAULT_KBD_MAP,
      DEFAULT_PAD_MAP,
      tick(1),
    );

    expect(result.edges).toHaveLength(0);
    expect(
      Object.values(result.nextEdgeState.down).every(
        (dev) => !dev.keyboard && !dev.gamepad,
      ),
    ).toBe(true);
  });

  it("ignores unmapped gamepad buttons", () => {
    const snapshot = createSnapshot([], ["gp:button:99"]); // Not mapped
    const result = computeEdges(
      emptyPrevState,
      snapshot,
      DEFAULT_KBD_MAP,
      DEFAULT_PAD_MAP,
      tick(1),
    );

    expect(result.edges).toHaveLength(0);
    expect(
      Object.values(result.nextEdgeState.down).every(
        (dev) => !dev.keyboard && !dev.gamepad,
      ),
    ).toBe(true);
  });
});

describe("computeEdges - mixed device input", () => {
  const emptyPrevState = makeInitialEdgeState();

  it("handles mixed keyboard and gamepad presses", () => {
    const snapshot = createSnapshot(["KeyZ"], ["gp:button:5"]); // RotateCCW from keyboard, RotateCW from gamepad
    const result = computeEdges(
      emptyPrevState,
      snapshot,
      DEFAULT_KBD_MAP,
      DEFAULT_PAD_MAP,
      tick(1),
    );

    expect(result.edges).toHaveLength(2);

    const ccwEdge = result.edges.find((e) => e.action === "RotateCCW");
    const cwEdge = result.edges.find((e) => e.action === "RotateCW");

    expect(ccwEdge).toEqual({
      action: "RotateCCW",
      device: "keyboard",
      tick: tick(1),
      type: "down",
    });

    expect(cwEdge).toEqual({
      action: "RotateCW",
      device: "gamepad",
      tick: tick(1),
      type: "down",
    });
  });
});

describe("computeEdges - state persistence", () => {
  const emptyPrevState = makeInitialEdgeState();

  it("maintains state correctly across multiple calls", () => {
    let prevState: EdgeState = emptyPrevState;

    // First call: press ArrowLeft
    const snapshot1 = createSnapshot(["ArrowLeft"]);
    const result1 = computeEdges(
      prevState,
      snapshot1,
      DEFAULT_KBD_MAP,
      DEFAULT_PAD_MAP,
      tick(1),
    );
    expect(result1.edges).toHaveLength(1);
    expect(result1.edges[0]?.type).toBe("down");
    prevState = result1.nextEdgeState;

    // Second call: same key still pressed, no changes
    const snapshot2 = createSnapshot(["ArrowLeft"]);
    const result2 = computeEdges(
      prevState,
      snapshot2,
      DEFAULT_KBD_MAP,
      DEFAULT_PAD_MAP,
      tick(2),
    );
    expect(result2.edges).toHaveLength(0); // No changes
    prevState = result2.nextEdgeState;

    // Third call: release ArrowLeft
    const snapshot3 = createSnapshot([]);
    const result3 = computeEdges(
      prevState,
      snapshot3,
      DEFAULT_KBD_MAP,
      DEFAULT_PAD_MAP,
      tick(3),
    );
    expect(result3.edges).toHaveLength(1);
    expect(result3.edges[0]?.type).toBe("up");
  });
});
