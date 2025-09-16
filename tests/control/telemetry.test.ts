/**
 * @fileoverview Tests for DAS/ARR control telemetry
 *
 * Tests verify that control telemetry events are emitted correctly to describe
 * input semantics (tap, DAS start/mature, ARR repeat, sonic shift).
 */

import { controlStep } from "@/control/index";

import type { ControlState, KeyEdge } from "@/control/types";
import type { Tick, TickDelta } from "@/engine/types";

/**
 * Creates a test control state with given DAS/ARR configuration
 */
function createTestControlState(
  dasTicks: number,
  arrTicks: number,
): ControlState {
  return {
    activeDir: null,
    cfg: {
      arrTicks: arrTicks as TickDelta,
      dasTicks: dasTicks as TickDelta,
    },
    dasDeadlineTick: null,
    leftDown: false,
    nextRepeatTick: null,
    rightDown: false,
    softDropDown: false,
  };
}

describe("@/control/telemetry — DAS/ARR control telemetry", () => {
  describe("Basic key events", () => {
    test("emits KeyDown/KeyUp telemetry for all keys", () => {
      const state = createTestControlState(10, 5);

      // Test directional keys
      const leftDownEdge: KeyEdge = { key: "Left", type: "down" };
      const result1 = controlStep(state, 100 as Tick, [leftDownEdge]);

      expect(result1.telemetry).toContainEqual({
        key: "Left",
        kind: "KeyDown",
        tick: 100 as Tick,
      });

      const leftUpEdge: KeyEdge = { key: "Left", type: "up" };
      const result2 = controlStep(result1.next, 105 as Tick, [leftUpEdge]);

      expect(result2.telemetry).toContainEqual({
        key: "Left",
        kind: "KeyUp",
        tick: 105 as Tick,
      });

      // Test action keys
      const hardDropEdge: KeyEdge = { key: "HardDrop", type: "down" };
      const result3 = controlStep(state, 110 as Tick, [hardDropEdge]);

      expect(result3.telemetry).toContainEqual({
        key: "HardDrop",
        kind: "KeyDown",
        tick: 110 as Tick,
      });
    });
  });

  describe("Directional tap behavior", () => {
    test("emits Tap and DasStart on directional key down", () => {
      const state = createTestControlState(10, 5);
      const edge: KeyEdge = { key: "Right", type: "down" };
      const result = controlStep(state, 100 as Tick, [edge]);

      expect(result.telemetry).toContainEqual({
        key: "Right",
        kind: "KeyDown",
        tick: 100 as Tick,
      });
      expect(result.telemetry).toContainEqual({
        dir: "Right",
        kind: "Tap",
        tick: 100 as Tick,
      });
      expect(result.telemetry).toContainEqual({
        dir: "Right",
        kind: "DasStart",
        tick: 100 as Tick,
      });

      // Should also emit immediate MoveRight command
      expect(result.commands).toContainEqual({
        kind: "MoveRight",
        source: "tap",
      });
    });
  });

  describe("ARR > 0 behavior", () => {
    test("emits DasMature and ArrRepeat sequence for normal repeating", () => {
      const state = createTestControlState(3, 2); // DAS=3, ARR=2
      const edge: KeyEdge = { key: "Left", type: "down" };

      // t0: Key down
      const result1 = controlStep(state, 0 as Tick, [edge]);
      expect(result1.telemetry).toContainEqual({
        dir: "Left",
        kind: "Tap",
        tick: 0 as Tick,
      });
      expect(result1.telemetry).toContainEqual({
        dir: "Left",
        kind: "DasStart",
        tick: 0 as Tick,
      });

      // t1, t2: No repeats yet (DAS not mature)
      const result2 = controlStep(result1.next, 1 as Tick, []);
      expect(result2.telemetry).toHaveLength(0);

      const result3 = controlStep(result2.next, 2 as Tick, []);
      expect(result3.telemetry).toHaveLength(0);

      // t3: DAS maturity - first ARR repeat
      const result4 = controlStep(result3.next, 3 as Tick, []);
      expect(result4.telemetry).toContainEqual({
        dir: "Left",
        kind: "DasMature",
        tick: 3 as Tick,
      });
      expect(result4.telemetry).toContainEqual({
        dir: "Left",
        kind: "ArrRepeat",
        tick: 3 as Tick,
      });
      expect(result4.commands).toContainEqual({
        kind: "MoveLeft",
        source: "repeat",
      });

      // t4: No repeat
      const result5 = controlStep(result4.next, 4 as Tick, []);
      expect(result5.telemetry).toHaveLength(0);

      // t5: Next ARR repeat
      const result6 = controlStep(result5.next, 5 as Tick, []);
      expect(result6.telemetry).toContainEqual({
        dir: "Left",
        kind: "ArrRepeat",
        tick: 5 as Tick,
      });
      expect(result6.commands).toContainEqual({
        kind: "MoveLeft",
        source: "repeat",
      });

      // t7: Another ARR repeat
      const result7 = controlStep(result6.next, 7 as Tick, []);
      expect(result7.telemetry).toContainEqual({
        dir: "Left",
        kind: "ArrRepeat",
        tick: 7 as Tick,
      });
    });
  });

  describe("ARR = 0 sonic behavior", () => {
    test("emits DasMature and SonicShift for ARR=0", () => {
      const state = createTestControlState(10, 0); // DAS=10, ARR=0 (sonic)
      const edge: KeyEdge = { key: "Right", type: "down" };

      // t0: Key down
      const result1 = controlStep(state, 0 as Tick, [edge]);
      expect(result1.telemetry).toContainEqual({
        dir: "Right",
        kind: "DasStart",
        tick: 0 as Tick,
      });

      // t9: Still charging
      const result2 = controlStep(result1.next, 9 as Tick, []);
      expect(result2.telemetry).toHaveLength(0);

      // t10: DAS maturity - sonic shift
      const result3 = controlStep(result2.next, 10 as Tick, []);
      expect(result3.telemetry).toContainEqual({
        dir: "Right",
        kind: "DasMature",
        tick: 10 as Tick,
      });
      expect(result3.telemetry).toContainEqual({
        dir: "Right",
        kind: "SonicShift",
        tick: 10 as Tick,
      });
      expect(result3.commands).toContainEqual({ kind: "ShiftToWallRight" });

      // t11: No more events (sonic is one-shot)
      const result4 = controlStep(result3.next, 11 as Tick, []);
      expect(result4.telemetry).toHaveLength(0);
      expect(result4.commands).toHaveLength(0);
    });

    test("emits DasMature and SonicShift for ARR=0 with Left key", () => {
      const state = createTestControlState(10, 0); // DAS=10, ARR=0 (sonic)
      const edge: KeyEdge = { key: "Left", type: "down" };

      // t0: Key down
      const result1 = controlStep(state, 0 as Tick, [edge]);
      expect(result1.telemetry).toContainEqual({
        dir: "Left",
        kind: "DasStart",
        tick: 0 as Tick,
      });
      expect(result1.next.nextRepeatTick).toBe(null); // ARR=0 means no repeat timing

      // t9: Still charging
      const result2 = controlStep(result1.next, 9 as Tick, []);
      expect(result2.telemetry).toHaveLength(0);

      // t10: DAS maturity - sonic shift to left wall
      const result3 = controlStep(result2.next, 10 as Tick, []);
      expect(result3.telemetry).toContainEqual({
        dir: "Left",
        kind: "DasMature",
        tick: 10 as Tick,
      });
      expect(result3.telemetry).toContainEqual({
        dir: "Left",
        kind: "SonicShift",
        tick: 10 as Tick,
      });
      expect(result3.commands).toContainEqual({ kind: "ShiftToWallLeft" });

      // t11: No more events (sonic is one-shot)
      const result4 = controlStep(result3.next, 11 as Tick, []);
      expect(result4.telemetry).toHaveLength(0);
      expect(result4.commands).toHaveLength(0);
    });

    test("ARR=0 sets nextRepeatTick to null on initial key press", () => {
      const state = createTestControlState(5, 0); // DAS=5, ARR=0 (sonic)

      // Test Right key
      const rightEdge: KeyEdge = { key: "Right", type: "down" };
      const result1 = controlStep(state, 0 as Tick, [rightEdge]);
      expect(result1.next.nextRepeatTick).toBe(null);
      expect(result1.next.dasDeadlineTick).toEqual(5 as Tick);

      // Test Left key
      const leftState = createTestControlState(5, 0);
      const leftEdge: KeyEdge = { key: "Left", type: "down" };
      const result2 = controlStep(leftState, 10 as Tick, [leftEdge]);
      expect(result2.next.nextRepeatTick).toBe(null);
      expect(result2.next.dasDeadlineTick).toEqual(15 as Tick);
    });
  });

  describe("Release before maturity", () => {
    test("no DasMature emitted when key released early", () => {
      const state = createTestControlState(10, 2);
      const downEdge: KeyEdge = { key: "Left", type: "down" };
      const upEdge: KeyEdge = { key: "Left", type: "up" };

      // t0: Key down
      const result1 = controlStep(state, 0 as Tick, [downEdge]);
      expect(result1.telemetry).toContainEqual({
        dir: "Left",
        kind: "DasStart",
        tick: 0 as Tick,
      });

      // t5: Release before maturity (DAS=10)
      const result2 = controlStep(result1.next, 5 as Tick, [upEdge]);
      expect(result2.telemetry).toContainEqual({
        key: "Left",
        kind: "KeyUp",
        tick: 5 as Tick,
      });
      expect(result2.telemetry).not.toContainEqual(
        expect.objectContaining({ kind: "DasMature" }),
      );

      // t10: No maturity event after release
      const result3 = controlStep(result2.next, 10 as Tick, []);
      expect(result3.telemetry).toHaveLength(0);
    });
  });

  describe("Direction switch behavior", () => {
    test("last-pressed wins and resets DAS", () => {
      const state = createTestControlState(10, 5);
      const rightDownEdge: KeyEdge = { key: "Right", type: "down" };
      const leftDownEdge: KeyEdge = { key: "Left", type: "down" };

      // t0: Press Right
      const result1 = controlStep(state, 0 as Tick, [rightDownEdge]);
      expect(result1.telemetry).toContainEqual({
        dir: "Right",
        kind: "DasStart",
        tick: 0 as Tick,
      });

      // t5: Press Left while Right still held (last-pressed wins)
      const result2 = controlStep(result1.next, 5 as Tick, [leftDownEdge]);
      expect(result2.telemetry).toContainEqual({
        dir: "Left",
        kind: "Tap",
        tick: 5 as Tick,
      });
      expect(result2.telemetry).toContainEqual({
        dir: "Left",
        kind: "DasStart",
        tick: 5 as Tick,
      });
      expect(result2.next.activeDir).toBe("Left");

      // t10: No Right maturity (was overridden)
      const result3 = controlStep(result2.next, 10 as Tick, []);
      expect(result3.telemetry).not.toContainEqual(
        expect.objectContaining({
          dir: "Right",
          kind: "DasMature",
        }),
      );

      // t15: Left maturity (DAS restarted at t5)
      const result4 = controlStep(result3.next, 15 as Tick, []);
      expect(result4.telemetry).toContainEqual({
        dir: "Left",
        kind: "DasMature",
        tick: 15 as Tick,
      });
    });

    test("release-to-reverse: releasing active direction activates opposite if still held", () => {
      const state = createTestControlState(10, 5);
      const rightDownEdge: KeyEdge = { key: "Right", type: "down" };
      const leftDownEdge: KeyEdge = { key: "Left", type: "down" };

      // t0: Press Right
      const result1 = controlStep(state, 0 as Tick, [rightDownEdge]);

      // t5: Press Left (Right still active due to last-pressed-wins, but Left is down)
      const result2 = controlStep(result1.next, 5 as Tick, [leftDownEdge]);
      expect(result2.next.activeDir).toBe("Left");

      // t8: Release Left (active direction) - should switch to Right since Right still held
      const leftUpEdge: KeyEdge = { key: "Left", type: "up" };
      const result3 = controlStep(result2.next, 8 as Tick, [leftUpEdge]);
      expect(result3.next.activeDir).toBe("Right");
      expect(result3.telemetry).toContainEqual({
        dir: "Right",
        kind: "DasStart",
        tick: 8 as Tick,
      });

      // t18: Right should mature (DAS restarted at t8)
      const result4 = controlStep(result3.next, 18 as Tick, []);
      expect(result4.telemetry).toContainEqual({
        dir: "Right",
        kind: "DasMature",
        tick: 18 as Tick,
      });
    });
  });

  describe("Comprehensive integration", () => {
    test("ARR > 0 sequence with direction switch", () => {
      const state = createTestControlState(5, 3); // DAS=5, ARR=3
      const rightDownEdge: KeyEdge = { key: "Right", type: "down" };
      const leftDownEdge: KeyEdge = { key: "Left", type: "down" };

      // t0: Right down
      const result1 = controlStep(state, 0 as Tick, [rightDownEdge]);
      expect(result1.commands).toContainEqual({
        kind: "MoveRight",
        source: "tap",
      });
      expect(result1.telemetry).toContainEqual({
        dir: "Right",
        kind: "Tap",
        tick: 0 as Tick,
      });

      // t3: Left down (switches direction, resets DAS)
      const result2 = controlStep(result1.next, 3 as Tick, [leftDownEdge]);
      expect(result2.commands).toContainEqual({
        kind: "MoveLeft",
        source: "tap",
      });
      expect(result2.telemetry).toContainEqual({
        dir: "Left",
        kind: "Tap",
        tick: 3 as Tick,
      });
      expect(result2.telemetry).toContainEqual({
        dir: "Left",
        kind: "DasStart",
        tick: 3 as Tick,
      });

      // t8: Left DAS matures (3 + 5 = 8)
      const result3 = controlStep(result2.next, 8 as Tick, []);
      expect(result3.telemetry).toContainEqual({
        dir: "Left",
        kind: "DasMature",
        tick: 8 as Tick,
      });
      expect(result3.telemetry).toContainEqual({
        dir: "Left",
        kind: "ArrRepeat",
        tick: 8 as Tick,
      });
      expect(result3.commands).toContainEqual({
        kind: "MoveLeft",
        source: "repeat",
      });

      // t11: Next ARR repeat
      const result4 = controlStep(result3.next, 11 as Tick, []);
      expect(result4.telemetry).toContainEqual({
        dir: "Left",
        kind: "ArrRepeat",
        tick: 11 as Tick,
      });
    });

    test("release-to-reverse: releasing Right while Right is active and Left is held", () => {
      const state = createTestControlState(10, 5);
      const rightDownEdge: KeyEdge = { key: "Right", type: "down" };
      const leftDownEdge: KeyEdge = { key: "Left", type: "down" };

      // t0: Press Right
      const result1 = controlStep(state, 0 as Tick, [rightDownEdge]);
      expect(result1.next.activeDir).toBe("Right");

      // t5: Press Left (Left becomes active due to last-pressed-wins)
      const result2 = controlStep(result1.next, 5 as Tick, [leftDownEdge]);
      expect(result2.next.activeDir).toBe("Left");

      // t8: Release Right (Left is still active, Right is still held) - no switch expected
      const rightUpEdge: KeyEdge = { key: "Right", type: "up" };
      const result3 = controlStep(result2.next, 8 as Tick, [rightUpEdge]);
      expect(result3.next.activeDir).toBe("Left"); // Left should remain active
      expect(result3.telemetry).toContainEqual({
        key: "Right",
        kind: "KeyUp",
        tick: 8 as Tick,
      });

      // Now test the actual uncovered branch: Right active, then Right released with Left held
      const freshState = createTestControlState(10, 5);

      // t0: Press Right (Right becomes active)
      const step1 = controlStep(freshState, 0 as Tick, [rightDownEdge]);

      // t3: Press Left while Right is active, but DON'T release Right yet
      // This makes Left active due to last-pressed-wins
      const step2 = controlStep(step1.next, 3 as Tick, [leftDownEdge]);
      expect(step2.next.activeDir).toBe("Left");

      // t6: Release Left (which is currently active) while Right is still held
      // This should switch activeDir back to Right and emit DasStart for Right
      const leftUpEdge: KeyEdge = { key: "Left", type: "up" };
      const step3 = controlStep(step2.next, 6 as Tick, [leftUpEdge]);
      expect(step3.next.activeDir).toBe("Right");
      expect(step3.telemetry).toContainEqual({
        dir: "Right",
        kind: "DasStart",
        tick: 6 as Tick,
      });

      // Now create the scenario for the uncovered Right release code (lines 89-97)
      const anotherState = createTestControlState(10, 5);

      // t0: Press Left first
      const a1 = controlStep(anotherState, 0 as Tick, [leftDownEdge]);

      // t2: Press Right (Right becomes active)
      const a2 = controlStep(a1.next, 2 as Tick, [rightDownEdge]);
      expect(a2.next.activeDir).toBe("Right");

      // t5: Release Right while Right is active AND Left is still held
      // This should trigger the uncovered branch in processRightKey (lines 89-97)
      const rightUp2: KeyEdge = { key: "Right", type: "up" };
      const a3 = controlStep(a2.next, 5 as Tick, [rightUp2]);
      expect(a3.next.activeDir).toBe("Left"); // Should switch to Left since Left is still held
      expect(a3.telemetry).toContainEqual({
        dir: "Left",
        kind: "DasStart",
        tick: 5 as Tick,
      });
    });

    test("releasing Right while active with no Left held sets activeDir to null", () => {
      const state = createTestControlState(10, 5);
      const rightDownEdge: KeyEdge = { key: "Right", type: "down" };
      const rightUpEdge: KeyEdge = { key: "Right", type: "up" };

      // t0: Press Right (Right becomes active)
      const result1 = controlStep(state, 0 as Tick, [rightDownEdge]);
      expect(result1.next.activeDir).toBe("Right");
      expect(result1.next.leftDown).toBe(false); // Ensure Left is not held

      // t5: Release Right while Right is active and Left is NOT held
      // This should trigger line 95: state.activeDir = null
      const result2 = controlStep(result1.next, 5 as Tick, [rightUpEdge]);
      expect(result2.next.activeDir).toBe(null); // Should be null, not Left
      expect(result2.telemetry).toContainEqual({
        key: "Right",
        kind: "KeyUp",
        tick: 5 as Tick,
      });
      // Should NOT contain DasStart telemetry since no direction switch occurred
      expect(result2.telemetry).not.toContainEqual(
        expect.objectContaining({ kind: "DasStart" }),
      );
    });

    test("release-to-reverse with ARR=0 sets nextRepeatTick to null", () => {
      const state = createTestControlState(10, 0); // DAS=10, ARR=0 (sonic)
      const rightDownEdge: KeyEdge = { key: "Right", type: "down" };
      const leftDownEdge: KeyEdge = { key: "Left", type: "down" };
      const leftUpEdge: KeyEdge = { key: "Left", type: "up" };

      // t0: Press Right (ARR=0, so nextRepeatTick should be null)
      const result1 = controlStep(state, 0 as Tick, [rightDownEdge]);
      expect(result1.next.activeDir).toBe("Right");
      expect(result1.next.nextRepeatTick).toBe(null);
      expect(result1.next.rightDown).toBe(true);

      // t5: Press Left (Left becomes active, nextRepeatTick should remain null)
      const result2 = controlStep(result1.next, 5 as Tick, [leftDownEdge]);
      expect(result2.next.activeDir).toBe("Left");
      expect(result2.next.nextRepeatTick).toBe(null);
      expect(result2.next.leftDown).toBe(true);
      expect(result2.next.rightDown).toBe(true); // Both keys are held

      // t10: Release Left (active direction) while Right is still held
      // This should switch to Right and call updateDasArrTiming with ARR=0
      const result3 = controlStep(result2.next, 10 as Tick, [leftUpEdge]);
      expect(result3.next.activeDir).toBe("Right"); // Should switch to Right since Right is still held
      expect(result3.next.nextRepeatTick).toBe(null); // ARR=0 branch in updateDasArrTiming
      expect(result3.next.dasDeadlineTick).toEqual(20 as Tick); // Should be reset
      expect(result3.next.leftDown).toBe(false);
      expect(result3.next.rightDown).toBe(true); // Right should still be held
      expect(result3.telemetry).toContainEqual({
        dir: "Right",
        kind: "DasStart",
        tick: 10 as Tick,
      });
    });

    test("releasing non-active Left key does not change activeDir", () => {
      const state = createTestControlState(10, 5);
      const rightDownEdge: KeyEdge = { key: "Right", type: "down" };
      const leftDownEdge: KeyEdge = { key: "Left", type: "down" };
      const leftUpEdge: KeyEdge = { key: "Left", type: "up" };
      const rightUpEdge: KeyEdge = { key: "Right", type: "up" };

      // t0: Press Right (Right becomes active)
      const result1 = controlStep(state, 0 as Tick, [rightDownEdge]);
      expect(result1.next.activeDir).toBe("Right");

      // t5: Press Left (Left becomes active due to last-pressed-wins)
      const result2 = controlStep(result1.next, 5 as Tick, [leftDownEdge]);
      expect(result2.next.activeDir).toBe("Left");

      // t8: Release Right (Left remains active, Right no longer held)
      const result3 = controlStep(result2.next, 8 as Tick, [rightUpEdge]);
      expect(result3.next.activeDir).toBe("Left");
      expect(result3.next.rightDown).toBe(false);

      // t10: Release Left when Left is NOT active (test the else condition)
      // This should trigger the branch where Left key up but activeDir !== "Left"
      // First, we need to make Right active again while Left is still held
      const result4 = controlStep(result3.next, 10 as Tick, [rightDownEdge]);
      expect(result4.next.activeDir).toBe("Right"); // Right becomes active

      // t12: Now release Left while Right is active
      // This tests the missing branch: Left key up but activeDir === "Right"
      const result5 = controlStep(result4.next, 12 as Tick, [leftUpEdge]);
      expect(result5.next.activeDir).toBe("Right"); // Should remain Right
      expect(result5.next.leftDown).toBe(false);
      expect(result5.telemetry).toContainEqual({
        key: "Left",
        kind: "KeyUp",
        tick: 12 as Tick,
      });
    });
  });
});
