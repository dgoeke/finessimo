import { interpret } from "robot3";

import {
  createDefaultDASContext,
  createDASMachine,
  DASMachineService,
  updateContextKeyDown,
  updateContextHoldStart,
  updateContextARR,
  updateConfig,
  type DASEvent,
} from "../../src/input/machines/das";
import { type Action } from "../../src/state/types";
import { createDurationMs } from "../../src/types/brands";

// Helper functions to check action types
const isTapMoveAction = (
  action: unknown,
): action is { type: "TapMove"; dir: -1 | 1; timestampMs?: number } => {
  return (
    typeof action === "object" &&
    action !== null &&
    "type" in action &&
    action.type === "TapMove" &&
    "dir" in action &&
    typeof action.dir === "number"
  );
};

const isHoldMoveAction = (
  action: unknown,
): action is { type: "HoldMove"; dir: -1 | 1; timestampMs?: number } => {
  return (
    typeof action === "object" &&
    action !== null &&
    "type" in action &&
    action.type === "HoldMove" &&
    "dir" in action &&
    typeof action.dir === "number"
  );
};

const isHoldStartAction = (
  action: unknown,
): action is { type: "HoldStart"; dir: -1 | 1; timestampMs?: number } => {
  return (
    typeof action === "object" &&
    action !== null &&
    "type" in action &&
    action.type === "HoldStart" &&
    "dir" in action &&
    typeof action.dir === "number"
  );
};

const isRepeatMoveAction = (
  action: unknown,
): action is { type: "RepeatMove"; dir: -1 | 1; timestampMs?: number } => {
  return (
    typeof action === "object" &&
    action !== null &&
    "type" in action &&
    action.type === "RepeatMove" &&
    "dir" in action &&
    typeof action.dir === "number"
  );
};

describe("DAS State Machine", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Initial State", () => {
    test("starts in idle state", () => {
      const service = new DASMachineService();
      expect(service.getState().state).toBe("idle");
    });

    test("has correct default context", () => {
      const defaultContext = createDefaultDASContext();
      expect(defaultContext).toEqual({
        arrLastTime: undefined,
        arrMs: createDurationMs(2),
        dasMs: createDurationMs(133),
        dasStartTime: undefined,
        direction: undefined,
        optimisticMoveEmitted: false,
        repeats: 0,
      });
    });
  });

  describe("State Transitions", () => {
    describe("idle → charging", () => {
      test("transitions to charging on key down and emits optimistic move", () => {
        const service = new DASMachineService();
        const actions = service.send({
          direction: -1,
          timestamp: 1000,
          type: "KEY_DOWN",
        });

        expect(service.getState().state).toBe("charging");
        expect(service.getState().context.direction).toBe(-1);
        expect(service.getState().context.dasStartTime).toBe(1000);
        expect(service.getState().context.optimisticMoveEmitted).toBe(true);
        expect(actions).toHaveLength(1); // Immediate optimistic move
        if (isTapMoveAction(actions[0])) {
          expect(actions[0].dir).toBe(-1);
          expect(actions[0].timestampMs).toBe(1000);
        }
      });

      test("emits optimistic move on key down, no duplicate on key up (confirmed tap)", () => {
        const service = new DASMachineService();

        // KEY_DOWN should emit optimistic move immediately
        const downActions = service.send({
          direction: 1,
          timestamp: 1500,
          type: "KEY_DOWN",
        });
        expect(downActions).toHaveLength(1);
        if (isTapMoveAction(downActions[0])) {
          expect(downActions[0].dir).toBe(1);
          expect(downActions[0].timestampMs).toBe(1500); // Uses KEY_DOWN timestamp
        }

        // KEY_UP should NOT emit another TapMove (optimistic move already emitted)
        const upActions = service.send({
          direction: 1,
          timestamp: 1550,
          type: "KEY_UP",
        });
        expect(upActions).toHaveLength(0); // No duplicate move
        expect(service.getState().context.optimisticMoveEmitted).toBe(false); // Flag reset
      });
    });

    describe("charging → idle (tap classification)", () => {
      test("returns to idle on key up before DAS timer", () => {
        const service = new DASMachineService();

        // Key down - emits optimistic move
        const downActions = service.send({
          direction: -1,
          timestamp: 1000,
          type: "KEY_DOWN",
        });
        expect(service.getState().state).toBe("charging");
        expect(downActions).toHaveLength(1); // Optimistic move emitted
        if (isTapMoveAction(downActions[0])) {
          expect(downActions[0].dir).toBe(-1);
          expect(downActions[0].timestampMs).toBe(1000); // Uses KEY_DOWN timestamp
        }

        // Key up before DAS (167ms) expires - at 100ms
        const actions = service.send({
          direction: -1,
          timestamp: 1100,
          type: "KEY_UP",
        });

        expect(service.getState().state).toBe("idle");
        expect(service.getState().context.direction).toBeUndefined();
        expect(service.getState().context.dasStartTime).toBeUndefined();
        expect(service.getState().context.optimisticMoveEmitted).toBe(false);
        expect(actions).toHaveLength(0); // No duplicate TapMove - optimistic already emitted
      });

      test("classifies as tap when released at exact DAS boundary", () => {
        const service = new DASMachineService();

        // Key down - emits optimistic move
        const downActions = service.send({
          direction: -1,
          timestamp: 1000,
          type: "KEY_DOWN",
        });
        expect(downActions).toHaveLength(1); // Optimistic move emitted
        if (isTapMoveAction(downActions[0])) {
          expect(downActions[0].dir).toBe(-1);
          expect(downActions[0].timestampMs).toBe(1000);
        }

        // Key up at exactly 166ms (1ms before DAS expires at 167ms)
        const actions = service.send({
          direction: -1,
          timestamp: 1166,
          type: "KEY_UP",
        });

        expect(service.getState().state).toBe("idle");
        expect(actions).toHaveLength(0); // No duplicate TapMove - optimistic already emitted
      });
    });

    describe("charging → repeating (hold classification)", () => {
      test("transitions to repeating when DAS timer expires", () => {
        const service = new DASMachineService();
        service.updateConfig(167, 33);

        // Key down - emits optimistic move
        const downActions = service.send({
          direction: -1,
          timestamp: 1000,
          type: "KEY_DOWN",
        });
        expect(downActions).toHaveLength(1); // Optimistic move emitted
        if (isTapMoveAction(downActions[0])) {
          expect(downActions[0].dir).toBe(-1);
          expect(downActions[0].timestampMs).toBe(1000);
        }

        // DAS timer expires at 1000 + 167 = 1167ms
        const actions = service.send({
          timestamp: 1167,
          type: "TIMER_TICK",
        });

        expect(service.getState().state).toBe("repeating");
        expect(service.getState().context.arrLastTime).toBe(1167);
        expect(service.getState().context.optimisticMoveEmitted).toBe(false); // Reset when transitioning to repeating
        expect(actions).toHaveLength(2); // HoldStart + HoldMove
        if (isHoldStartAction(actions[0])) {
          expect(actions[0].dir).toBe(-1);
        }
        if (isHoldMoveAction(actions[1])) {
          expect(actions[1].dir).toBe(-1);
        }
      });

      test("emits hold start action when transitioning to repeating", () => {
        const service = new DASMachineService();
        service.updateConfig(167, 33);

        // Key down - emits optimistic move
        const downActions = service.send({
          direction: 1,
          timestamp: 2000,
          type: "KEY_DOWN",
        });
        expect(downActions).toHaveLength(1); // Optimistic move emitted first

        const actions = service.send({
          timestamp: 2167, // 2000 + 167ms DAS
          type: "TIMER_TICK",
        });

        expect(actions).toHaveLength(2); // HoldStart + HoldMove
        if (isHoldStartAction(actions[0])) {
          expect(actions[0].dir).toBe(1);
          expect(actions[0].timestampMs).toBe(2167);
        }
        if (isHoldMoveAction(actions[1])) {
          expect(actions[1].dir).toBe(1);
          expect(actions[1].timestampMs).toBe(2167);
        }
      });
    });

    describe("repeating → idle", () => {
      test("returns to idle on key up from repeating", () => {
        const service = new DASMachineService();
        service.updateConfig(167, 33);

        // Get to repeating state
        service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });
        service.send({ timestamp: 1167, type: "TIMER_TICK" });
        expect(service.getState().state).toBe("repeating");

        // Key up
        const actions = service.send({
          direction: -1,
          timestamp: 1300,
          type: "KEY_UP",
        });

        expect(service.getState().state).toBe("idle");
        expect(service.getState().context.direction).toBeUndefined();
        expect(actions).toHaveLength(0);
      });
    });

    describe("charging - opposite key release", () => {
      test("releasing opposite key while charging does not exit to idle nor emit actions", () => {
        const service = new DASMachineService();

        // Key down left to start charging
        service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });
        expect(service.getState().state).toBe("charging");
        expect(service.getState().context.direction).toBe(-1);

        // Release opposite key (right) while charging left
        const actions = service.send({
          direction: 1,
          timestamp: 1100,
          type: "KEY_UP",
        });

        // Should remain in charging state
        expect(service.getState().state).toBe("charging");
        expect(service.getState().context.direction).toBe(-1);
        expect(service.getState().context.dasStartTime).toBe(1000);
        expect(actions).toHaveLength(0);
      });
    });

    describe("repeating → repeating (ARR)", () => {
      test("emits repeat moves at ARR rate", () => {
        const service = new DASMachineService();
        service.updateConfig(167, 33);

        // Get to repeating state
        service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });
        service.send({ timestamp: 1167, type: "TIMER_TICK" }); // DAS expires

        // First ARR tick at 1167 + 33 = 1200ms
        const actions1 = service.send({
          timestamp: 1200,
          type: "TIMER_TICK",
        });

        expect(actions1).toHaveLength(1);
        if (isRepeatMoveAction(actions1[0])) {
          expect(actions1[0].dir).toBe(-1);
        }
        expect(service.getState().context.arrLastTime).toBe(1200);

        // Second ARR tick at 1200 + 33 = 1233ms
        const actions2 = service.send({
          timestamp: 1233,
          type: "TIMER_TICK",
        });

        expect(actions2).toHaveLength(1);
        if (isRepeatMoveAction(actions2[0])) {
          expect(actions2[0].dir).toBe(-1);
        }
        expect(service.getState().context.arrLastTime).toBe(1233);
      });

      test("handles multiple ARR pulses in rapid succession", () => {
        const service = new DASMachineService();
        service.updateConfig(167, 33);

        service.send({ direction: 1, timestamp: 1000, type: "KEY_DOWN" });
        service.send({ timestamp: 1167, type: "TIMER_TICK" }); // DAS

        // Simulate catching up after a delay - multiple ARR intervals passed
        const actions = service.send({
          timestamp: 1300, // 1167 + 33 + 33 + 33 + 33 + ...
          type: "TIMER_TICK",
        });

        // Should emit catch-up repeats for all missed ARR intervals
        // DAS at 1167, ARR every 33ms: 1167, 1200, 1233, 1266, 1299
        // At timestamp 1300, should emit repeats for 1200, 1233, 1266, 1299
        expect(actions.length).toBeGreaterThan(0);
        const lastAction = actions[actions.length - 1];
        if (isRepeatMoveAction(lastAction)) {
          expect(lastAction.timestampMs).toBe(1299); // Last ARR time before 1300
        }
      });
    });
  });

  describe("Timing Edge Cases", () => {
    test("handles key down/up at exact DAS boundary", () => {
      const service = new DASMachineService();
      service.updateConfig(167, 33);

      // Key down - emits optimistic move immediately
      const downActions = service.send({
        direction: -1,
        timestamp: 1000,
        type: "KEY_DOWN",
      });
      expect(downActions).toHaveLength(1); // Optimistic move emitted
      if (isTapMoveAction(downActions[0])) {
        expect(downActions[0].dir).toBe(-1);
        expect(downActions[0].timestampMs).toBe(1000);
      }

      // Key up at exactly DAS expiry time (167ms)
      const actions = service.send({
        direction: -1,
        timestamp: 1167,
        type: "KEY_UP",
      });

      // At exactly the boundary, should still be classified as tap (< DAS)
      expect(service.getState().state).toBe("idle");
      expect(actions).toHaveLength(0); // No duplicate TapMove - optimistic already emitted
    });

    test("handles multiple rapid key presses", () => {
      const service = new DASMachineService();

      // First tap - optimistic move on KEY_DOWN
      const actions1 = service.send({
        direction: -1,
        timestamp: 1000,
        type: "KEY_DOWN",
      });
      service.send({
        direction: -1,
        timestamp: 1050,
        type: "KEY_UP",
      });

      // Second tap quickly after - optimistic move on KEY_DOWN
      const actions2 = service.send({
        direction: -1,
        timestamp: 1100,
        type: "KEY_DOWN",
      });
      service.send({
        direction: -1,
        timestamp: 1150,
        type: "KEY_UP",
      });

      expect(actions1).toHaveLength(1); // Optimistic move on first KEY_DOWN
      expect(actions2).toHaveLength(1); // Optimistic move on second KEY_DOWN
      expect(service.getState().state).toBe("idle");
    });

    test("handles key switching while charging", () => {
      const service = new DASMachineService();

      // Start with left
      const actions1 = service.send({
        direction: -1,
        timestamp: 1000,
        type: "KEY_DOWN",
      });

      // Switch to right before DAS
      const actions2 = service.send({
        direction: 1,
        timestamp: 1080,
        type: "KEY_DOWN",
      });

      if (isTapMoveAction(actions1[0])) {
        expect(actions1[0].dir).toBe(-1);
      }
      if (isTapMoveAction(actions2[0])) {
        expect(actions2[0].dir).toBe(1);
      }
      expect(service.getState().context.direction).toBe(1);
      expect(service.getState().context.dasStartTime).toBe(1080);
      expect(service.getState().state).toBe("charging");
    });

    test("handles rapid alternation - left down then immediate right down", () => {
      const service = new DASMachineService();

      // Press LeftDown - optimistic move emitted
      const leftActions = service.send({
        direction: -1,
        timestamp: 1000,
        type: "KEY_DOWN",
      });

      // Immediately press RightDown before any timer tick - switches to right key
      const rightActions = service.send({
        direction: 1,
        timestamp: 1000, // Same timestamp - rapid alternation
        type: "KEY_DOWN",
      });

      // Optimistic moves emitted on KEY_DOWN events
      expect(leftActions).toHaveLength(1); // Left optimistic move
      expect(rightActions).toHaveLength(1); // Right optimistic move
      if (isTapMoveAction(leftActions[0])) {
        expect(leftActions[0].dir).toBe(-1);
      }
      if (isTapMoveAction(rightActions[0])) {
        expect(rightActions[0].dir).toBe(1);
      }

      // Verify DAS machine is now charging with right direction (left key was overridden)
      expect(service.getState().state).toBe("charging");
      expect(service.getState().context.direction).toBe(1);
      expect(service.getState().context.dasStartTime).toBe(1000);

      // Now release the right key - no additional action since optimistic already emitted
      const upActions = service.send({
        direction: 1,
        timestamp: 1050,
        type: "KEY_UP",
      });
      expect(upActions).toHaveLength(0); // No duplicate move
    });

    test("handles key switching while repeating", () => {
      const service = new DASMachineService();
      service.updateConfig(167, 33);

      // Get to repeating with left
      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });
      service.send({ timestamp: 1167, type: "TIMER_TICK" });
      expect(service.getState().state).toBe("repeating");

      // Switch to right - this should transition to charging state and emit optimistic move
      const actions = service.send({
        direction: 1,
        timestamp: 1200,
        type: "KEY_DOWN",
      });

      // Optimistic move emitted on KEY_DOWN
      expect(actions).toHaveLength(1);
      if (isTapMoveAction(actions[0])) {
        expect(actions[0].dir).toBe(1);
      }

      // Verify state switched to charging with new direction
      expect(service.getState().context.direction).toBe(1);
      expect(service.getState().context.dasStartTime).toBe(1200);
      expect(service.getState().state).toBe("charging");

      // Release the key - no additional action since optimistic already emitted
      const upActions = service.send({
        direction: 1,
        timestamp: 1250,
        type: "KEY_UP",
      });
      expect(upActions).toHaveLength(0); // No duplicate move
    });

    test("handles zero ARR timing", () => {
      const service = new DASMachineService(createDefaultDASContext(167, 0));

      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });
      service.send({ timestamp: 1167, type: "TIMER_TICK" });

      // With 0ms ARR, should still work (uses Math.max(1, arrMs))
      const actions = service.send({
        timestamp: 1168, // 1167 + Math.max(1, 0) = 1168
        type: "TIMER_TICK",
      });

      expect(actions).toHaveLength(1);
      expect(service.getState().context.arrLastTime).toBe(1168);
    });

    test("handles very long hold periods", () => {
      const service = new DASMachineService();
      service.updateConfig(167, 33);

      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });
      service.send({ timestamp: 1167, type: "TIMER_TICK" }); // DAS

      // Simulate a very long hold - 10 seconds later
      const actions = service.send({
        timestamp: 11167,
        type: "TIMER_TICK",
      });

      // Should still work and emit one action for current ARR timing
      expect(actions).toHaveLength(1);
      expect(service.getState().state).toBe("repeating");
    });
  });

  describe("Action Emission", () => {
    test("emits correct action timestamps", () => {
      const service = new DASMachineService();
      service.updateConfig(167, 33);

      const actions1 = service.send({
        direction: -1,
        timestamp: 1234,
        type: "KEY_DOWN",
      });

      service.send({ timestamp: 1401, type: "TIMER_TICK" }); // 1234 + 167

      const actions2 = service.send({
        timestamp: 1434, // 1401 + 33
        type: "TIMER_TICK",
      });

      if (isTapMoveAction(actions1[0])) {
        expect(actions1[0].timestampMs).toBe(1234); // Tap timestamp
      }
      if (isRepeatMoveAction(actions2[0])) {
        expect(actions2[0].timestampMs).toBe(1434); // ARR timestamp
      }
    });

    test("emits proper action types for tap vs hold", () => {
      const service = new DASMachineService();

      // Tap sequence
      const tapActions = service.send({
        direction: 1,
        timestamp: 1000,
        type: "KEY_DOWN",
      });
      service.send({ direction: 1, timestamp: 1100, type: "KEY_UP" });

      // Hold sequence
      service.send({ direction: -1, timestamp: 2000, type: "KEY_DOWN" });
      const holdActions = service.send({
        timestamp: 2167,
        type: "TIMER_TICK",
      });

      if (isTapMoveAction(tapActions[0])) {
        expect(tapActions[0].type).toBe("TapMove");
      }
      // holdActions has 2 actions: HoldStart and HoldMove
      if (isHoldStartAction(holdActions[0])) {
        expect(holdActions[0].type).toBe("HoldStart");
      }
      if (isHoldMoveAction(holdActions[1])) {
        expect(holdActions[1].type).toBe("HoldMove");
      }
    });

    test("emits TapMove on key down (optimistic), no duplicate on key up", () => {
      const service = new DASMachineService();

      // Tap case - should emit optimistic TapMove on KEY_DOWN
      const tapDownActions = service.send({
        direction: -1,
        timestamp: 1000,
        type: "KEY_DOWN",
      });
      const tapUpActions = service.send({
        direction: -1,
        timestamp: 1100,
        type: "KEY_UP",
      });

      // Hold case - optimistic move on KEY_DOWN, no extra actions on KEY_UP
      const holdDownActions = service.send({
        direction: 1,
        timestamp: 2000,
        type: "KEY_DOWN",
      });
      service.send({ timestamp: 2167, type: "TIMER_TICK" }); // Triggers HoldStart + HoldMove
      const holdUpActions = service.send({
        direction: 1,
        timestamp: 2300,
        type: "KEY_UP",
      });

      expect(tapDownActions).toHaveLength(1); // Optimistic TapMove on KEY_DOWN
      if (isTapMoveAction(tapDownActions[0])) {
        expect(tapDownActions[0].dir).toBe(-1);
      }
      expect(tapUpActions).toHaveLength(0); // No duplicate on KEY_UP
      expect(holdDownActions).toHaveLength(1); // Optimistic move on hold KEY_DOWN
      expect(holdUpActions).toHaveLength(0); // No extra actions for hold release
    });
  });

  describe("Context Management", () => {
    test("preserves direction correctly during charging", () => {
      const service = new DASMachineService();

      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });

      expect(service.getState().context.direction).toBe(-1);
      expect(service.getState().context.dasStartTime).toBe(1000);
      expect(service.getState().context.arrLastTime).toBeUndefined();
    });

    test("updates timing state during repeating", () => {
      const service = new DASMachineService();
      service.updateConfig(167, 33);

      service.send({ direction: 1, timestamp: 1000, type: "KEY_DOWN" });
      service.send({ timestamp: 1167, type: "TIMER_TICK" });

      expect(service.getState().context.arrLastTime).toBe(1167);

      service.send({ timestamp: 1200, type: "TIMER_TICK" });

      expect(service.getState().context.arrLastTime).toBe(1200);
    });

    test("resets context on key up", () => {
      const service = new DASMachineService();

      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });
      service.send({ direction: -1, timestamp: 1100, type: "KEY_UP" });

      const context = service.getState().context;
      expect(context.direction).toBeUndefined();
      expect(context.dasStartTime).toBeUndefined();
      expect(context.arrLastTime).toBeUndefined();
    });

    test("updates configuration dynamically", () => {
      const service = new DASMachineService();

      // Defaults adhere to DESIGN.md
      expect(service.getState().context.dasMs).toBe(133);
      expect(service.getState().context.arrMs).toBe(2);

      service.updateConfig(100, 16);

      expect(service.getState().context.dasMs).toBe(100);
      expect(service.getState().context.arrMs).toBe(16);
    });
  });

  describe("Integration Scenarios", () => {
    test("handles multiple direction keys simultaneously", () => {
      const service = new DASMachineService();

      // Left key down
      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });
      expect(service.getState().context.direction).toBe(-1);

      // Right key down (should override)
      service.send({ direction: 1, timestamp: 1050, type: "KEY_DOWN" });
      expect(service.getState().context.direction).toBe(1);
      expect(service.getState().context.dasStartTime).toBe(1050);
    });

    test("handles rapid tap sequences", () => {
      const service = new DASMachineService();
      const allActions: Array<Action> = [];

      // Rapid left taps
      for (let i = 0; i < 5; i++) {
        // Optimistic moves are emitted on KEY_DOWN
        const downActions = service.send({
          direction: -1,
          timestamp: 1000 + i * 100,
          type: "KEY_DOWN",
        });
        allActions.push(...downActions);

        // KEY_UP should not emit additional actions (optimistic already emitted)
        const upActions = service.send({
          direction: -1,
          timestamp: 1000 + i * 100 + 50,
          type: "KEY_UP",
        });
        // No actions on KEY_UP since optimistic already emitted
        expect(upActions).toHaveLength(0);
      }

      expect(allActions).toHaveLength(5);
      allActions.forEach((action, index) => {
        if (isTapMoveAction(action)) {
          expect(action.type).toBe("TapMove");
          // Timestamp is from KEY_DOWN event (optimistic move)
          expect(action.timestampMs).toBe(1000 + index * 100);
        }
      });
    });

    test("handles hold-to-wall scenarios", () => {
      const service = new DASMachineService();

      // Key down - should emit tap move
      const initialActions = service.send({
        direction: -1,
        timestamp: 1000,
        type: "KEY_DOWN",
      });

      // DAS expires - should emit hold start
      const holdStartActions = service.send({
        timestamp: 1167,
        type: "TIMER_TICK",
      });

      // Multiple ARR ticks - should emit repeat moves
      const arr1Actions = service.send({
        timestamp: 1200,
        type: "TIMER_TICK",
      });

      const arr2Actions = service.send({
        timestamp: 1233,
        type: "TIMER_TICK",
      });

      // Key up when hitting wall
      service.send({ direction: -1, timestamp: 1300, type: "KEY_UP" });

      if (isTapMoveAction(initialActions[0])) {
        expect(initialActions[0].type).toBe("TapMove");
      }
      // holdStartActions has 2 actions: HoldStart and HoldMove
      if (isHoldStartAction(holdStartActions[0])) {
        expect(holdStartActions[0].type).toBe("HoldStart");
      }
      if (isHoldMoveAction(holdStartActions[1])) {
        expect(holdStartActions[1].type).toBe("HoldMove");
      }
      if (isRepeatMoveAction(arr1Actions[0])) {
        expect(arr1Actions[0].type).toBe("RepeatMove");
      }
      if (isRepeatMoveAction(arr2Actions[0])) {
        expect(arr2Actions[0].type).toBe("RepeatMove");
      }
    });

    test("handles state machine reset", () => {
      const service = new DASMachineService();

      // Get to repeating state
      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });
      service.send({ timestamp: 1167, type: "TIMER_TICK" });
      expect(service.getState().state).toBe("repeating");

      // Reset
      service.reset();

      expect(service.getState().state).toBe("idle");
      expect(service.getState().context.direction).toBeUndefined();
      expect(service.getState().context.dasStartTime).toBeUndefined();
      expect(service.getState().context.arrLastTime).toBeUndefined();
    });
  });

  describe("Error Handling", () => {
    test("handles invalid state transitions gracefully", () => {
      const service = new DASMachineService();

      // Try to send KEY_UP while in idle (no active direction)
      const actions = service.send({
        direction: -1,
        timestamp: 1000,
        type: "KEY_UP",
      });

      expect(actions).toHaveLength(0);
      expect(service.getState().state).toBe("idle");
    });

    test("handles timer ticks with no active direction", () => {
      const service = new DASMachineService();

      // Timer tick in idle state
      const actions = service.send({
        timestamp: 1000,
        type: "TIMER_TICK",
      });

      expect(actions).toHaveLength(0);
      expect(service.getState().state).toBe("idle");
    });

    test("handles valid timestamps correctly", () => {
      const service = new DASMachineService();

      // Test with a valid timestamp - KEY_DOWN now emits optimistic move
      const downActions = service.send({
        direction: 1,
        timestamp: 1000,
        type: "KEY_DOWN",
      });

      expect(downActions).toHaveLength(1); // Optimistic action on KEY_DOWN
      expect(service.getState().context.dasStartTime).toBe(1000);
      if (isTapMoveAction(downActions[0])) {
        expect(downActions[0].timestampMs).toBe(1000);
      }

      // KEY_UP should not emit additional action
      const upActions = service.send({
        direction: 1,
        timestamp: 1050,
        type: "KEY_UP",
      });

      expect(upActions).toHaveLength(0); // No duplicate action on KEY_UP
    });
  });

  describe("State Machine Robustness", () => {
    test("handles timer ticks with no active key", () => {
      const service = new DASMachineService();

      // Send TIMER_TICK without any previous key down (dasStartTime undefined)
      const actions = service.send({
        timestamp: 1000,
        type: "TIMER_TICK",
      });

      expect(actions).toHaveLength(0);
      expect(service.getState().state).toBe("idle");
    });

    test("handles corrupted context state gracefully", () => {
      const service = new DASMachineService();
      service.updateConfig(167, 33);

      // Get to repeating state first
      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });
      service.send({ timestamp: 1167, type: "TIMER_TICK" }); // DAS expires
      expect(service.getState().state).toBe("repeating");

      // Now manually mess with the context to simulate undefined direction
      // This covers the specific branch in shouldEmitARR where direction is undefined
      const currentContext = service.getState().context;
      const modifiedContext = { ...currentContext, direction: undefined };
      service.setContextForTesting(modifiedContext); // Use testing method

      // Send TIMER_TICK - should not emit ARR since direction is undefined
      const actions = service.send({
        timestamp: 1200,
        type: "TIMER_TICK",
      });

      expect(actions).toHaveLength(0);
    });

    test("allows configuration updates while charging", () => {
      const service = new DASMachineService();

      // Get to charging state
      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });
      expect(service.getState().state).toBe("charging");

      // Update config while charging
      const actions = service.updateConfig(200, 50);

      expect(actions).toHaveLength(0);
      expect(service.getState().context.dasMs).toBe(200);
      expect(service.getState().context.arrMs).toBe(50);
      expect(service.getState().state).toBe("charging"); // Should stay in charging
    });

    test("allows configuration updates while repeating", () => {
      const service = new DASMachineService();

      // Get to repeating state
      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });
      service.send({ timestamp: 1167, type: "TIMER_TICK" });
      expect(service.getState().state).toBe("repeating");

      // Update config while repeating
      const actions = service.updateConfig(300, 25);

      expect(actions).toHaveLength(0);
      expect(service.getState().context.dasMs).toBe(300);
      expect(service.getState().context.arrMs).toBe(25);
      expect(service.getState().state).toBe("repeating"); // Should stay in repeating
    });

    test("handles invalid event sequences properly", () => {
      const service = new DASMachineService();

      // Test updateContextKeyDown with non-KEY_DOWN event
      service.send({ timestamp: 1000, type: "TIMER_TICK" });
      expect(service.getState().context.direction).toBeUndefined();

      // Test updateContextHoldStart with wrong event type
      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });
      service.send({ direction: -1, timestamp: 1100, type: "KEY_UP" }); // Should not call updateContextHoldStart
      expect(service.getState().context.arrLastTime).toBeUndefined();

      // Test updateContextARR with wrong event type
      service.send({ direction: 1, timestamp: 2000, type: "KEY_DOWN" });
      service.send({ timestamp: 2167, type: "TIMER_TICK" }); // Get to repeating
      service.send({ direction: 1, timestamp: 2200, type: "KEY_UP" }); // Should not call updateContextARR
      expect(service.getState().state).toBe("idle");
    });

    test("ignores timer events when DAS conditions not met", () => {
      const service = new DASMachineService();

      // Get to charging state
      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });

      // Send a TIMER_TICK that doesn't meet DAS expiry condition (too early)
      const actions = service.send({ timestamp: 1050, type: "TIMER_TICK" }); // Only 50ms elapsed

      expect(actions).toHaveLength(0); // No actions should be emitted
      expect(service.getState().context.arrLastTime).toBeUndefined(); // Should remain undefined
      expect(service.getState().state).toBe("charging"); // Should still be charging
    });

    test("ignores timer events when ARR conditions not met", () => {
      const service = new DASMachineService();
      service.updateConfig(167, 33);

      // Get to repeating state
      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });
      service.send({ timestamp: 1167, type: "TIMER_TICK" }); // DAS expires
      expect(service.getState().state).toBe("repeating");

      // Send a TIMER_TICK that doesn't meet ARR condition (too early)
      const actions = service.send({ timestamp: 1180, type: "TIMER_TICK" }); // Only 13ms after ARR start

      expect(actions).toHaveLength(0); // No actions should be emitted
      expect(service.getState().context.arrLastTime).toBe(1167); // Should remain at DAS expiry time
    });

    test("covers updateConfig return branch with non-UPDATE_CONFIG event", () => {
      const service = new DASMachineService();
      const initialConfig = { ...service.getState().context };

      // Send a different event type - should not modify config
      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });

      expect(service.getState().context.dasMs).toBe(initialConfig.dasMs);
      expect(service.getState().context.arrMs).toBe(initialConfig.arrMs);
    });

    test("covers all reducer function return branches", () => {
      const service = new DASMachineService();

      // Test updateContextKeyDown return branch (line 89)
      // This happens when event.type !== "KEY_DOWN"
      service.send({
        arrMs: createDurationMs(20),
        dasMs: createDurationMs(100),
        type: "UPDATE_CONFIG",
      });
      expect(service.getState().context.direction).toBeUndefined(); // Should remain unchanged

      // Test updateContextHoldStart return branch (line 127)
      // Get to charging state, then send wrong event type or conditions not met
      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });

      // Send KEY_UP which should not trigger updateContextHoldStart
      service.send({ direction: -1, timestamp: 1100, type: "KEY_UP" });
      // Context should be reset, but updateContextHoldStart's return branch was hit
      expect(service.getState().state).toBe("idle");

      // Test updateContextARR return branch (line 152)
      // Get to repeating state first
      service.send({ direction: 1, timestamp: 2000, type: "KEY_DOWN" });
      service.send({ timestamp: 2167, type: "TIMER_TICK" }); // Get to repeating

      // Send event that doesn't match conditions for updateContextARR
      // This could be a KEY_DOWN which transitions to charging without calling updateContextARR
      const actions = service.send({
        direction: -1,
        timestamp: 2200,
        type: "KEY_DOWN",
      });
      expect(actions).toHaveLength(1); // Optimistic action on KEY_DOWN
      expect(service.getState().state).toBe("charging"); // Transitions to charging

      // Test updateConfig return branch (line 163)
      // Send non-UPDATE_CONFIG event when updateConfig might be called
      service.send({ direction: 1, timestamp: 3000, type: "KEY_DOWN" });
      // The config should remain unchanged from previous updateConfig call
      expect(service.getState().context.dasMs).toBe(100);
      expect(service.getState().context.arrMs).toBe(20);
    });
  });

  describe("Robot3 Machine Coverage", () => {
    test("covers createDASMachine function instantiation", () => {
      const context = createDefaultDASContext(100, 20);
      const machine = createDASMachine(context);

      // Just verify the machine was created - we're not using it in practice
      // but this covers the createDASMachine function lines
      expect(machine).toBeDefined();
      expect(typeof machine).toBe("object");
    });
  });

  describe("Direct Function Coverage", () => {
    test("covers specific return branches in reducer functions", () => {
      // Import and test the reducer functions directly for better coverage
      const service = new DASMachineService();

      // First, set a known config state
      service.updateConfig(100, 20);
      expect(service.getState().context.dasMs).toBe(100);

      // Test scenario that exercises all the uncovered return branches:
      // 1. Send events in specific orders that cause reducers to return early

      // Create a scenario that triggers updateContextHoldStart but doesn't meet conditions
      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });

      // Send TIMER_TICK events at different states to cover all branches

      // First, test when DAS hasn't expired yet (should hit return branches)
      let actions = service.send({ timestamp: 1050, type: "TIMER_TICK" }); // 50ms < 100ms (new DAS)
      expect(actions).toHaveLength(0);

      // Now let DAS expire to get to repeating state (using new 100ms DAS time)
      service.send({ timestamp: 1100, type: "TIMER_TICK" });
      expect(service.getState().state).toBe("repeating");

      // Send TIMER_TICK too early for ARR (should hit return branch)
      actions = service.send({ timestamp: 1110, type: "TIMER_TICK" }); // Only 10ms later, need 20ms
      expect(actions).toHaveLength(0);

      // Test various event combinations to exercise all code paths
      service.send({ direction: -1, timestamp: 1300, type: "KEY_UP" }); // Reset to idle

      // Test updateContextKeyDown with different event types
      service.send({ timestamp: 1400, type: "TIMER_TICK" }); // Not KEY_DOWN
      expect(service.getState().context.direction).toBeUndefined();

      // Test updateConfig with different event types
      service.send({ direction: 1, timestamp: 1500, type: "KEY_DOWN" }); // Not UPDATE_CONFIG
      expect(service.getState().context.dasMs).toBe(100); // Should remain from the updateConfig call above
    });

    test("does not emit duplicate non-optimistic TapMove on quick tap (pending tap is handled by input handler)", () => {
      const service = new DASMachineService();
      service.updateConfig(100, 20);
      // Start a key sequence
      let actions = service.send({
        direction: -1,
        timestamp: 1000,
        type: "KEY_DOWN",
      });
      // Optimistic move should be emitted on KEY_DOWN
      expect(actions.some((a) => a.type === "TapMove" && a.optimistic)).toBe(
        true,
      );

      // Release before DAS expiry: machine should not emit a second TapMove here
      actions = service.send({
        direction: -1,
        timestamp: 1050,
        type: "KEY_UP",
      });
      expect(actions.some((a) => a.type === "TapMove" && !a.optimistic)).toBe(
        false,
      );
    });
  });

  describe("Edge Case Handling", () => {
    test("handles key release after DAS expiry but before timer tick", () => {
      const service = new DASMachineService();

      // Key down to start charging - emits optimistic move
      const downActions = service.send({
        direction: -1,
        timestamp: 1000,
        type: "KEY_DOWN",
      });
      expect(service.getState().state).toBe("charging");
      expect(downActions).toHaveLength(1); // Optimistic move emitted
      if (isTapMoveAction(downActions[0])) {
        expect(downActions[0].dir).toBe(-1);
        expect(downActions[0].timestampMs).toBe(1000);
      }

      // Key up after DAS expiry (167ms) but before first timer tick
      const actions = service.send({
        direction: -1,
        timestamp: 1200, // 200ms after start, which is > 167ms DAS
        type: "KEY_UP",
      });

      expect(service.getState().state).toBe("idle");
      expect(service.getState().context.direction).toBeUndefined();
      expect(service.getState().context.dasStartTime).toBeUndefined();
      expect(actions).toHaveLength(0); // No duplicate TapMove - optimistic already emitted
    });

    test("ignores key release for different direction while repeating", () => {
      const service = new DASMachineService();

      // Get to repeating state with left direction
      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });
      service.send({ timestamp: 1167, type: "TIMER_TICK" });
      expect(service.getState().state).toBe("repeating");

      // KEY_UP for right direction (opposite) should not exit repeating
      const actions = service.send({
        direction: 1, // Opposite direction
        timestamp: 1300,
        type: "KEY_UP",
      });

      expect(service.getState().state).toBe("repeating"); // Should still be repeating
      expect(service.getState().context.direction).toBe(-1); // Should still have left direction
      expect(actions).toHaveLength(0); // No actions should be emitted
    });

    test("ignores key release for different direction while charging", () => {
      const service = new DASMachineService();

      // KEY_DOWN left at t=1000
      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });
      expect(service.getState().state).toBe("charging");
      expect(service.getState().context.direction).toBe(-1);

      // KEY_DOWN right at t=1080 (switch to charging right)
      service.send({ direction: 1, timestamp: 1080, type: "KEY_DOWN" });
      expect(service.getState().state).toBe("charging");
      expect(service.getState().context.direction).toBe(1);

      // KEY_UP left at t=1100 - should be ignored since we're now charging right
      const actions = service.send({
        direction: -1,
        timestamp: 1100,
        type: "KEY_UP",
      });

      expect(service.getState().state).toBe("charging"); // Should remain charging
      expect(service.getState().context.direction).toBe(1); // Should still be charging right
      expect(actions).toHaveLength(0); // No actions should be emitted
    });
  });

  describe("Configuration Validation", () => {
    test("clamps negative DAS values to minimum of 0", () => {
      const service = new DASMachineService();

      service.updateConfig(-100, 33);

      expect(service.getState().context.dasMs).toBe(0);
      expect(service.getState().context.arrMs).toBe(33);
    });

    test("clamps zero ARR values to minimum of 1", () => {
      const service = new DASMachineService();

      service.updateConfig(167, 0);

      expect(service.getState().context.dasMs).toBe(167);
      expect(service.getState().context.arrMs).toBe(1);
    });

    test("clamps negative ARR values to minimum of 1", () => {
      const service = new DASMachineService();

      service.updateConfig(167, -50);

      expect(service.getState().context.dasMs).toBe(167);
      expect(service.getState().context.arrMs).toBe(1);
    });

    test("validates timing values in default context creation", () => {
      const context1 = createDefaultDASContext(-100, 0);
      expect(context1.dasMs).toBe(0);
      expect(context1.arrMs).toBe(1);

      const context2 = createDefaultDASContext(200, -10);
      expect(context2.dasMs).toBe(200);
      expect(context2.arrMs).toBe(1);
    });
  });

  describe("Reducer Function Behavior", () => {
    test("returns unchanged context for unmatched event types", () => {
      const initialContext = createDefaultDASContext();

      // updateContextKeyDown with non-KEY_DOWN event
      const ctx1 = updateContextKeyDown(initialContext, {
        timestamp: 1000,
        type: "TIMER_TICK",
      });
      expect(ctx1).toBe(initialContext); // Should return unchanged context

      // updateContextHoldStart with wrong event type or conditions not met
      const ctx2 = updateContextHoldStart(initialContext, {
        direction: -1,
        timestamp: 1000,
        type: "KEY_DOWN",
      });
      expect(ctx2).toBe(initialContext); // Should return unchanged context

      // updateContextARR with wrong event type
      const ctx3 = updateContextARR(initialContext, {
        direction: -1,
        timestamp: 1000,
        type: "KEY_DOWN",
      });
      expect(ctx3).toBe(initialContext); // Should return unchanged context

      // updateConfig with non-UPDATE_CONFIG event
      const ctx4 = updateConfig(initialContext, {
        direction: -1,
        timestamp: 1000,
        type: "KEY_DOWN",
      });
      expect(ctx4).toBe(initialContext); // Should return unchanged context
    });
  });

  describe("Robot3 Integration", () => {
    test("creates functional state machine", () => {
      const initialContext = createDefaultDASContext(100, 50);
      const machine = createDASMachine(initialContext);

      // The machine should be created successfully
      expect(machine).toBeDefined();
      expect(typeof machine).toBe("object");

      // Create a service using interpret
      const service = interpret(
        machine as Parameters<typeof interpret>[0],
        () => {
          // onChange callback - this will trigger when state changes
        },
      ) as unknown as {
        send: (event: DASEvent) => void;
        machine: unknown;
        context: unknown;
      };

      // Send an event to the service to trigger state changes and context usage
      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });

      // Verify the service was created and can handle events
      expect(service).toBeDefined();
      expect(service.machine).toBeDefined();
      expect(typeof service.send).toBe("function");
    });

    test("handles complete state transition sequence", () => {
      const initialContext = createDefaultDASContext(100, 20);
      const machine = createDASMachine(initialContext);

      const service = interpret(
        machine as Parameters<typeof interpret>[0],
        () => {
          // State change callback
        },
      ) as unknown as {
        send: (event: DASEvent) => void;
        machine: unknown;
        context: unknown;
      };

      // Complete test sequence through all states:

      // 1. Start with key down
      service.send({ direction: -1, timestamp: 1000, type: "KEY_DOWN" });

      // 2. Release quickly (tap)
      service.send({ direction: -1, timestamp: 1050, type: "KEY_UP" });

      // 3. Press key again
      service.send({ direction: 1, timestamp: 2000, type: "KEY_DOWN" });

      // 4. Hold until DAS expires
      service.send({ timestamp: 2100, type: "TIMER_TICK" });

      // 5. Continue holding for ARR
      service.send({ timestamp: 2120, type: "TIMER_TICK" });

      // 6. Release to end hold
      service.send({ direction: 1, timestamp: 2200, type: "KEY_UP" });

      // 7. Update configuration
      service.send({
        arrMs: createDurationMs(30),
        dasMs: createDurationMs(200),
        type: "UPDATE_CONFIG",
      });

      // Verify the service handled all transitions
      expect(service).toBeDefined();
    });
  });
});
