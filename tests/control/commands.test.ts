/**
 * @fileoverview Tests for control command generation
 *
 * Tests verify that control commands are correctly generated for action keys
 * (SoftDrop, HardDrop, CW, CCW, Hold) based on key down/up events.
 */

import { controlStep } from "@/control/index";

import type { ControlState, KeyEdge } from "@/control/types";
import type { Tick, TickDelta } from "@/engine/types";

/**
 * Creates a test control state with default DAS/ARR configuration
 */
function createTestControlState(): ControlState {
  return {
    activeDir: null,
    cfg: {
      arrTicks: 5 as TickDelta,
      dasTicks: 10 as TickDelta,
    },
    dasDeadlineTick: null,
    leftDown: false,
    nextRepeatTick: null,
    rightDown: false,
    softDropDown: false,
  };
}

describe("@/control/commands — Action key command generation", () => {
  describe("SoftDrop commands", () => {
    test("generates SoftDropOn command on key down", () => {
      const state = createTestControlState();
      const edge: KeyEdge = { key: "SoftDrop", type: "down" };

      const result = controlStep(state, 100 as Tick, [edge]);

      expect(result.commands).toContainEqual({ kind: "SoftDropOn" });
      expect(result.telemetry).toContainEqual({
        key: "SoftDrop",
        kind: "KeyDown",
        tick: 100 as Tick,
      });
    });

    test("generates SoftDropOff command on key up", () => {
      const state = createTestControlState();
      const edge: KeyEdge = { key: "SoftDrop", type: "up" };

      const result = controlStep(state, 105 as Tick, [edge]);

      expect(result.commands).toContainEqual({ kind: "SoftDropOff" });
      expect(result.telemetry).toContainEqual({
        key: "SoftDrop",
        kind: "KeyUp",
        tick: 105 as Tick,
      });
    });
  });

  describe("HardDrop commands", () => {
    test("generates HardDrop command on key down", () => {
      const state = createTestControlState();
      const edge: KeyEdge = { key: "HardDrop", type: "down" };

      const result = controlStep(state, 200 as Tick, [edge]);

      expect(result.commands).toContainEqual({ kind: "HardDrop" });
      expect(result.telemetry).toContainEqual({
        key: "HardDrop",
        kind: "KeyDown",
        tick: 200 as Tick,
      });
    });

    test("does not generate command on key up", () => {
      const state = createTestControlState();
      const edge: KeyEdge = { key: "HardDrop", type: "up" };

      const result = controlStep(state, 205 as Tick, [edge]);

      expect(result.commands).toHaveLength(0);
      expect(result.telemetry).toContainEqual({
        key: "HardDrop",
        kind: "KeyUp",
        tick: 205 as Tick,
      });
    });
  });

  describe("Rotation commands", () => {
    test("generates RotateCW command on CW key down", () => {
      const state = createTestControlState();
      const edge: KeyEdge = { key: "CW", type: "down" };

      const result = controlStep(state, 300 as Tick, [edge]);

      expect(result.commands).toContainEqual({ kind: "RotateCW" });
      expect(result.telemetry).toContainEqual({
        key: "CW",
        kind: "KeyDown",
        tick: 300 as Tick,
      });
    });

    test("does not generate command on CW key up", () => {
      const state = createTestControlState();
      const edge: KeyEdge = { key: "CW", type: "up" };

      const result = controlStep(state, 305 as Tick, [edge]);

      expect(result.commands).toHaveLength(0);
      expect(result.telemetry).toContainEqual({
        key: "CW",
        kind: "KeyUp",
        tick: 305 as Tick,
      });
    });

    test("generates RotateCCW command on CCW key down", () => {
      const state = createTestControlState();
      const edge: KeyEdge = { key: "CCW", type: "down" };

      const result = controlStep(state, 400 as Tick, [edge]);

      expect(result.commands).toContainEqual({ kind: "RotateCCW" });
      expect(result.telemetry).toContainEqual({
        key: "CCW",
        kind: "KeyDown",
        tick: 400 as Tick,
      });
    });

    test("does not generate command on CCW key up", () => {
      const state = createTestControlState();
      const edge: KeyEdge = { key: "CCW", type: "up" };

      const result = controlStep(state, 405 as Tick, [edge]);

      expect(result.commands).toHaveLength(0);
      expect(result.telemetry).toContainEqual({
        key: "CCW",
        kind: "KeyUp",
        tick: 405 as Tick,
      });
    });
  });

  describe("Hold commands", () => {
    test("generates Hold command on key down", () => {
      const state = createTestControlState();
      const edge: KeyEdge = { key: "Hold", type: "down" };

      const result = controlStep(state, 500 as Tick, [edge]);

      expect(result.commands).toContainEqual({ kind: "Hold" });
      expect(result.telemetry).toContainEqual({
        key: "Hold",
        kind: "KeyDown",
        tick: 500 as Tick,
      });
    });

    test("does not generate command on key up", () => {
      const state = createTestControlState();
      const edge: KeyEdge = { key: "Hold", type: "up" };

      const result = controlStep(state, 505 as Tick, [edge]);

      expect(result.commands).toHaveLength(0);
      expect(result.telemetry).toContainEqual({
        key: "Hold",
        kind: "KeyUp",
        tick: 505 as Tick,
      });
    });
  });

  describe("Multiple action keys", () => {
    test("processes multiple action keys in single step", () => {
      const state = createTestControlState();
      const edges: Array<KeyEdge> = [
        { key: "CW", type: "down" },
        { key: "SoftDrop", type: "down" },
        { key: "Hold", type: "down" },
      ];

      const result = controlStep(state, 600 as Tick, edges);

      expect(result.commands).toContainEqual({ kind: "RotateCW" });
      expect(result.commands).toContainEqual({ kind: "SoftDropOn" });
      expect(result.commands).toContainEqual({ kind: "Hold" });
      expect(result.commands).toHaveLength(3);

      expect(result.telemetry).toContainEqual({
        key: "CW",
        kind: "KeyDown",
        tick: 600 as Tick,
      });
      expect(result.telemetry).toContainEqual({
        key: "SoftDrop",
        kind: "KeyDown",
        tick: 600 as Tick,
      });
      expect(result.telemetry).toContainEqual({
        key: "Hold",
        kind: "KeyDown",
        tick: 600 as Tick,
      });
    });
  });
});
