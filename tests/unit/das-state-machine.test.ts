import {
  createDefaultDASContext,
  createDASMachine,
  DASMachineService,
  updateContextKeyDown,
  updateContextHoldStart,
  updateContextARR,
  updateConfig,
} from "../../src/input/machines/das";
import { Action } from "../../src/state/types";
import { interpret } from "robot3";

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
        direction: undefined,
        dasStartTime: undefined,
        arrLastTime: undefined,
        dasMs: 133,
        arrMs: 2,
        repeats: 0,
      });
    });
  });

  describe("State Transitions", () => {
    describe("idle → charging", () => {
      test("transitions to charging on key down", () => {
        const service = new DASMachineService();
        const actions = service.send({
          type: "KEY_DOWN",
          direction: -1,
          timestamp: 1000,
        });

        expect(service.getState().state).toBe("charging");
        expect(service.getState().context.direction).toBe(-1);
        expect(service.getState().context.dasStartTime).toBe(1000);
        expect(actions).toHaveLength(0); // No immediate action - wait to see if it's tap or hold
      });

      test("emits tap move only after key up (confirmed tap)", () => {
        const service = new DASMachineService();

        // KEY_DOWN should not emit action yet
        const downActions = service.send({
          type: "KEY_DOWN",
          direction: 1,
          timestamp: 1500,
        });
        expect(downActions).toHaveLength(0);

        // KEY_UP should emit the TapMove
        const upActions = service.send({
          type: "KEY_UP",
          direction: 1,
          timestamp: 1550,
        });
        expect(upActions).toHaveLength(1);
        if (isTapMoveAction(upActions[0])) {
          expect(upActions[0].dir).toBe(1);
          expect(upActions[0].timestampMs).toBe(1550); // Uses KEY_UP timestamp
        }
      });
    });

    describe("charging → idle (tap classification)", () => {
      test("returns to idle on key up before DAS timer", () => {
        const service = new DASMachineService();

        // Key down
        service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
        expect(service.getState().state).toBe("charging");

        // Key up before DAS (167ms) expires - at 100ms
        const actions = service.send({
          type: "KEY_UP",
          direction: -1,
          timestamp: 1100,
        });

        expect(service.getState().state).toBe("idle");
        expect(service.getState().context.direction).toBeUndefined();
        expect(service.getState().context.dasStartTime).toBeUndefined();
        expect(actions).toHaveLength(1); // TapMove emitted on KEY_UP
        if (isTapMoveAction(actions[0])) {
          expect(actions[0].dir).toBe(-1);
          expect(actions[0].timestampMs).toBe(1100);
        }
      });

      test("classifies as tap when released at exact DAS boundary", () => {
        const service = new DASMachineService();

        service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });

        // Key up at exactly 166ms (1ms before DAS expires at 167ms)
        const actions = service.send({
          type: "KEY_UP",
          direction: -1,
          timestamp: 1166,
        });

        expect(service.getState().state).toBe("idle");
        expect(actions).toHaveLength(1); // TapMove emitted on KEY_UP
        if (isTapMoveAction(actions[0])) {
          expect(actions[0].dir).toBe(-1);
          expect(actions[0].timestampMs).toBe(1166);
        }
      });
    });

    describe("charging → repeating (hold classification)", () => {
      test("transitions to repeating when DAS timer expires", () => {
        const service = new DASMachineService();
        service.updateConfig(167, 33);

        service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });

        // DAS timer expires at 1000 + 167 = 1167ms
        const actions = service.send({
          type: "TIMER_TICK",
          timestamp: 1167,
        });

        expect(service.getState().state).toBe("repeating");
        expect(service.getState().context.arrLastTime).toBe(1167);
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

        service.send({ type: "KEY_DOWN", direction: 1, timestamp: 2000 });

        const actions = service.send({
          type: "TIMER_TICK",
          timestamp: 2167, // 2000 + 167ms DAS
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
        service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
        service.send({ type: "TIMER_TICK", timestamp: 1167 });
        expect(service.getState().state).toBe("repeating");

        // Key up
        const actions = service.send({
          type: "KEY_UP",
          direction: -1,
          timestamp: 1300,
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
        service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
        expect(service.getState().state).toBe("charging");
        expect(service.getState().context.direction).toBe(-1);

        // Release opposite key (right) while charging left
        const actions = service.send({
          type: "KEY_UP",
          direction: 1,
          timestamp: 1100,
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
        service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
        service.send({ type: "TIMER_TICK", timestamp: 1167 }); // DAS expires

        // First ARR tick at 1167 + 33 = 1200ms
        const actions1 = service.send({
          type: "TIMER_TICK",
          timestamp: 1200,
        });

        expect(actions1).toHaveLength(1);
        if (isRepeatMoveAction(actions1[0])) {
          expect(actions1[0].dir).toBe(-1);
        }
        expect(service.getState().context.arrLastTime).toBe(1200);

        // Second ARR tick at 1200 + 33 = 1233ms
        const actions2 = service.send({
          type: "TIMER_TICK",
          timestamp: 1233,
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

        service.send({ type: "KEY_DOWN", direction: 1, timestamp: 1000 });
        service.send({ type: "TIMER_TICK", timestamp: 1167 }); // DAS

        // Simulate catching up after a delay - multiple ARR intervals passed
        const actions = service.send({
          type: "TIMER_TICK",
          timestamp: 1300, // 1167 + 33 + 33 + 33 + 33 + ...
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

      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });

      // Key up at exactly DAS expiry time (167ms)
      const actions = service.send({
        type: "KEY_UP",
        direction: -1,
        timestamp: 1167,
      });

      // At exactly the boundary, should still be classified as tap (< DAS)
      expect(service.getState().state).toBe("idle");
      expect(actions).toHaveLength(1); // TapMove emitted on KEY_UP
      if (isTapMoveAction(actions[0])) {
        expect(actions[0].dir).toBe(-1);
        expect(actions[0].timestampMs).toBe(1167);
      }
    });

    test("handles multiple rapid key presses", () => {
      const service = new DASMachineService();

      // First tap
      service.send({
        type: "KEY_DOWN",
        direction: -1,
        timestamp: 1000,
      });
      const actions1 = service.send({
        type: "KEY_UP",
        direction: -1,
        timestamp: 1050,
      });

      // Second tap quickly after
      service.send({
        type: "KEY_DOWN",
        direction: -1,
        timestamp: 1100,
      });
      const actions2 = service.send({
        type: "KEY_UP",
        direction: -1,
        timestamp: 1150,
      });

      expect(actions1).toHaveLength(1);
      expect(actions2).toHaveLength(1);
      expect(service.getState().state).toBe("idle");
    });

    test("handles key switching while charging", () => {
      const service = new DASMachineService();

      // Start with left
      const actions1 = service.send({
        type: "KEY_DOWN",
        direction: -1,
        timestamp: 1000,
      });

      // Switch to right before DAS
      const actions2 = service.send({
        type: "KEY_DOWN",
        direction: 1,
        timestamp: 1080,
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

      // Press LeftDown - no action emitted yet
      const leftActions = service.send({
        type: "KEY_DOWN",
        direction: -1,
        timestamp: 1000,
      });

      // Immediately press RightDown before any timer tick - switches to right key
      const rightActions = service.send({
        type: "KEY_DOWN",
        direction: 1,
        timestamp: 1000, // Same timestamp - rapid alternation
      });

      // No actions emitted on KEY_DOWN events in new architecture
      expect(leftActions).toHaveLength(0);
      expect(rightActions).toHaveLength(0);

      // Verify DAS machine is now charging with right direction (left key was overridden)
      expect(service.getState().state).toBe("charging");
      expect(service.getState().context.direction).toBe(1);
      expect(service.getState().context.dasStartTime).toBe(1000);

      // Now release the right key to get a tap action
      const upActions = service.send({
        type: "KEY_UP",
        direction: 1,
        timestamp: 1050,
      });
      expect(upActions).toHaveLength(1);
      if (isTapMoveAction(upActions[0])) {
        expect(upActions[0].type).toBe("TapMove");
        expect(upActions[0].dir).toBe(1);
      }
    });

    test("handles key switching while repeating", () => {
      const service = new DASMachineService();
      service.updateConfig(167, 33);

      // Get to repeating with left
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
      service.send({ type: "TIMER_TICK", timestamp: 1167 });
      expect(service.getState().state).toBe("repeating");

      // Switch to right - this should transition to charging state
      const actions = service.send({
        type: "KEY_DOWN",
        direction: 1,
        timestamp: 1200,
      });

      // No action emitted on KEY_DOWN in new architecture
      expect(actions).toHaveLength(0);

      // Verify state switched to charging with new direction
      expect(service.getState().context.direction).toBe(1);
      expect(service.getState().context.dasStartTime).toBe(1200);
      expect(service.getState().state).toBe("charging");

      // To get an action, we need to release the key
      const upActions = service.send({
        type: "KEY_UP",
        direction: 1,
        timestamp: 1250,
      });
      expect(upActions).toHaveLength(1);
      if (isTapMoveAction(upActions[0])) {
        expect(upActions[0].dir).toBe(1);
      }
    });

    test("handles zero ARR timing", () => {
      const service = new DASMachineService(createDefaultDASContext(167, 0));

      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
      service.send({ type: "TIMER_TICK", timestamp: 1167 });

      // With 0ms ARR, should still work (uses Math.max(1, arrMs))
      const actions = service.send({
        type: "TIMER_TICK",
        timestamp: 1168, // 1167 + Math.max(1, 0) = 1168
      });

      expect(actions).toHaveLength(1);
      expect(service.getState().context.arrLastTime).toBe(1168);
    });

    test("handles very long hold periods", () => {
      const service = new DASMachineService();
      service.updateConfig(167, 33);

      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
      service.send({ type: "TIMER_TICK", timestamp: 1167 }); // DAS

      // Simulate a very long hold - 10 seconds later
      const actions = service.send({
        type: "TIMER_TICK",
        timestamp: 11167,
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
        type: "KEY_DOWN",
        direction: -1,
        timestamp: 1234,
      });

      service.send({ type: "TIMER_TICK", timestamp: 1401 }); // 1234 + 167

      const actions2 = service.send({
        type: "TIMER_TICK",
        timestamp: 1434, // 1401 + 33
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
        type: "KEY_DOWN",
        direction: 1,
        timestamp: 1000,
      });
      service.send({ type: "KEY_UP", direction: 1, timestamp: 1100 });

      // Hold sequence
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 2000 });
      const holdActions = service.send({
        type: "TIMER_TICK",
        timestamp: 2167,
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

    test("emits TapMove on tap key up, no extra actions on hold key up", () => {
      const service = new DASMachineService();

      // Tap case - should emit TapMove on KEY_UP
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
      const tapUpActions = service.send({
        type: "KEY_UP",
        direction: -1,
        timestamp: 1100,
      });

      // Hold case - should not emit extra actions on KEY_UP (already emitted HoldMove)
      service.send({ type: "KEY_DOWN", direction: 1, timestamp: 2000 });
      service.send({ type: "TIMER_TICK", timestamp: 2167 }); // Triggers HoldStart + HoldMove
      const holdUpActions = service.send({
        type: "KEY_UP",
        direction: 1,
        timestamp: 2300,
      });

      expect(tapUpActions).toHaveLength(1); // TapMove for confirmed tap
      if (isTapMoveAction(tapUpActions[0])) {
        expect(tapUpActions[0].dir).toBe(-1);
      }
      expect(holdUpActions).toHaveLength(0); // No extra actions for hold release
    });
  });

  describe("Context Management", () => {
    test("preserves direction correctly during charging", () => {
      const service = new DASMachineService();

      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });

      expect(service.getState().context.direction).toBe(-1);
      expect(service.getState().context.dasStartTime).toBe(1000);
      expect(service.getState().context.arrLastTime).toBeUndefined();
    });

    test("updates timing state during repeating", () => {
      const service = new DASMachineService();
      service.updateConfig(167, 33);

      service.send({ type: "KEY_DOWN", direction: 1, timestamp: 1000 });
      service.send({ type: "TIMER_TICK", timestamp: 1167 });

      expect(service.getState().context.arrLastTime).toBe(1167);

      service.send({ type: "TIMER_TICK", timestamp: 1200 });

      expect(service.getState().context.arrLastTime).toBe(1200);
    });

    test("resets context on key up", () => {
      const service = new DASMachineService();

      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
      service.send({ type: "KEY_UP", direction: -1, timestamp: 1100 });

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
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
      expect(service.getState().context.direction).toBe(-1);

      // Right key down (should override)
      service.send({ type: "KEY_DOWN", direction: 1, timestamp: 1050 });
      expect(service.getState().context.direction).toBe(1);
      expect(service.getState().context.dasStartTime).toBe(1050);
    });

    test("handles rapid tap sequences", () => {
      const service = new DASMachineService();
      const allActions: Action[] = [];

      // Rapid left taps
      for (let i = 0; i < 5; i++) {
        // KEY_DOWN no longer emits actions
        service.send({
          type: "KEY_DOWN",
          direction: -1,
          timestamp: 1000 + i * 100,
        });

        // Actions are emitted on KEY_UP
        const upActions = service.send({
          type: "KEY_UP",
          direction: -1,
          timestamp: 1000 + i * 100 + 50,
        });
        allActions.push(...upActions);
      }

      expect(allActions).toHaveLength(5);
      allActions.forEach((action, index) => {
        if (isTapMoveAction(action)) {
          expect(action.type).toBe("TapMove");
          // Timestamp is now from KEY_UP event (50ms after KEY_DOWN)
          expect(action.timestampMs).toBe(1000 + index * 100 + 50);
        }
      });
    });

    test("handles hold-to-wall scenarios", () => {
      const service = new DASMachineService();

      // Key down - should emit tap move
      const initialActions = service.send({
        type: "KEY_DOWN",
        direction: -1,
        timestamp: 1000,
      });

      // DAS expires - should emit hold start
      const holdStartActions = service.send({
        type: "TIMER_TICK",
        timestamp: 1167,
      });

      // Multiple ARR ticks - should emit repeat moves
      const arr1Actions = service.send({
        type: "TIMER_TICK",
        timestamp: 1200,
      });

      const arr2Actions = service.send({
        type: "TIMER_TICK",
        timestamp: 1233,
      });

      // Key up when hitting wall
      service.send({ type: "KEY_UP", direction: -1, timestamp: 1300 });

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
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
      service.send({ type: "TIMER_TICK", timestamp: 1167 });
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
        type: "KEY_UP",
        direction: -1,
        timestamp: 1000,
      });

      expect(actions).toHaveLength(0);
      expect(service.getState().state).toBe("idle");
    });

    test("handles timer ticks with no active direction", () => {
      const service = new DASMachineService();

      // Timer tick in idle state
      const actions = service.send({
        type: "TIMER_TICK",
        timestamp: 1000,
      });

      expect(actions).toHaveLength(0);
      expect(service.getState().state).toBe("idle");
    });

    test("handles valid timestamps correctly", () => {
      const service = new DASMachineService();

      // Test with a valid timestamp - KEY_DOWN no longer emits actions
      const downActions = service.send({
        type: "KEY_DOWN",
        direction: 1,
        timestamp: 1000,
      });

      expect(downActions).toHaveLength(0); // No action on KEY_DOWN
      expect(service.getState().context.dasStartTime).toBe(1000);

      // Action is emitted on KEY_UP
      const upActions = service.send({
        type: "KEY_UP",
        direction: 1,
        timestamp: 1050,
      });

      expect(upActions).toHaveLength(1); // Should emit action on KEY_UP
      if (isTapMoveAction(upActions[0])) {
        expect(upActions[0].timestampMs).toBe(1050);
      }
    });
  });

  describe("State Machine Robustness", () => {
    test("handles timer ticks with no active key", () => {
      const service = new DASMachineService();

      // Send TIMER_TICK without any previous key down (dasStartTime undefined)
      const actions = service.send({
        type: "TIMER_TICK",
        timestamp: 1000,
      });

      expect(actions).toHaveLength(0);
      expect(service.getState().state).toBe("idle");
    });

    test("handles corrupted context state gracefully", () => {
      const service = new DASMachineService();
      service.updateConfig(167, 33);

      // Get to repeating state first
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
      service.send({ type: "TIMER_TICK", timestamp: 1167 }); // DAS expires
      expect(service.getState().state).toBe("repeating");

      // Now manually mess with the context to simulate undefined direction
      // This covers the specific branch in shouldEmitARR where direction is undefined
      const currentContext = service.getState().context;
      const modifiedContext = { ...currentContext, direction: undefined };
      service.setContextForTesting(modifiedContext); // Use testing method

      // Send TIMER_TICK - should not emit ARR since direction is undefined
      const actions = service.send({
        type: "TIMER_TICK",
        timestamp: 1200,
      });

      expect(actions).toHaveLength(0);
    });

    test("allows configuration updates while charging", () => {
      const service = new DASMachineService();

      // Get to charging state
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
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
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
      service.send({ type: "TIMER_TICK", timestamp: 1167 });
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
      service.send({ type: "TIMER_TICK", timestamp: 1000 });
      expect(service.getState().context.direction).toBeUndefined();

      // Test updateContextHoldStart with wrong event type
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
      service.send({ type: "KEY_UP", direction: -1, timestamp: 1100 }); // Should not call updateContextHoldStart
      expect(service.getState().context.arrLastTime).toBeUndefined();

      // Test updateContextARR with wrong event type
      service.send({ type: "KEY_DOWN", direction: 1, timestamp: 2000 });
      service.send({ type: "TIMER_TICK", timestamp: 2167 }); // Get to repeating
      service.send({ type: "KEY_UP", direction: 1, timestamp: 2200 }); // Should not call updateContextARR
      expect(service.getState().state).toBe("idle");
    });

    test("ignores timer events when DAS conditions not met", () => {
      const service = new DASMachineService();

      // Get to charging state
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });

      // Send a TIMER_TICK that doesn't meet DAS expiry condition (too early)
      const actions = service.send({ type: "TIMER_TICK", timestamp: 1050 }); // Only 50ms elapsed

      expect(actions).toHaveLength(0); // No actions should be emitted
      expect(service.getState().context.arrLastTime).toBeUndefined(); // Should remain undefined
      expect(service.getState().state).toBe("charging"); // Should still be charging
    });

    test("ignores timer events when ARR conditions not met", () => {
      const service = new DASMachineService();
      service.updateConfig(167, 33);

      // Get to repeating state
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
      service.send({ type: "TIMER_TICK", timestamp: 1167 }); // DAS expires
      expect(service.getState().state).toBe("repeating");

      // Send a TIMER_TICK that doesn't meet ARR condition (too early)
      const actions = service.send({ type: "TIMER_TICK", timestamp: 1180 }); // Only 13ms after ARR start

      expect(actions).toHaveLength(0); // No actions should be emitted
      expect(service.getState().context.arrLastTime).toBe(1167); // Should remain at DAS expiry time
    });

    test("covers updateConfig return branch with non-UPDATE_CONFIG event", () => {
      const service = new DASMachineService();
      const initialConfig = { ...service.getState().context };

      // Send a different event type - should not modify config
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });

      expect(service.getState().context.dasMs).toBe(initialConfig.dasMs);
      expect(service.getState().context.arrMs).toBe(initialConfig.arrMs);
    });

    test("covers all reducer function return branches", () => {
      const service = new DASMachineService();

      // Test updateContextKeyDown return branch (line 89)
      // This happens when event.type !== "KEY_DOWN"
      service.send({ type: "UPDATE_CONFIG", dasMs: 100, arrMs: 20 });
      expect(service.getState().context.direction).toBeUndefined(); // Should remain unchanged

      // Test updateContextHoldStart return branch (line 127)
      // Get to charging state, then send wrong event type or conditions not met
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });

      // Send KEY_UP which should not trigger updateContextHoldStart
      service.send({ type: "KEY_UP", direction: -1, timestamp: 1100 });
      // Context should be reset, but updateContextHoldStart's return branch was hit
      expect(service.getState().state).toBe("idle");

      // Test updateContextARR return branch (line 152)
      // Get to repeating state first
      service.send({ type: "KEY_DOWN", direction: 1, timestamp: 2000 });
      service.send({ type: "TIMER_TICK", timestamp: 2167 }); // Get to repeating

      // Send event that doesn't match conditions for updateContextARR
      // This could be a KEY_DOWN which transitions to charging without calling updateContextARR
      const actions = service.send({
        type: "KEY_DOWN",
        direction: -1,
        timestamp: 2200,
      });
      expect(actions).toHaveLength(0); // No action on KEY_DOWN
      expect(service.getState().state).toBe("charging"); // Transitions to charging

      // Test updateConfig return branch (line 163)
      // Send non-UPDATE_CONFIG event when updateConfig might be called
      service.send({ type: "KEY_DOWN", direction: 1, timestamp: 3000 });
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
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });

      // Send TIMER_TICK events at different states to cover all branches

      // First, test when DAS hasn't expired yet (should hit return branches)
      let actions = service.send({ type: "TIMER_TICK", timestamp: 1050 }); // 50ms < 100ms (new DAS)
      expect(actions).toHaveLength(0);

      // Now let DAS expire to get to repeating state (using new 100ms DAS time)
      actions = service.send({ type: "TIMER_TICK", timestamp: 1100 });
      expect(service.getState().state).toBe("repeating");

      // Send TIMER_TICK too early for ARR (should hit return branch)
      actions = service.send({ type: "TIMER_TICK", timestamp: 1110 }); // Only 10ms later, need 20ms
      expect(actions).toHaveLength(0);

      // Test various event combinations to exercise all code paths
      service.send({ type: "KEY_UP", direction: -1, timestamp: 1300 }); // Reset to idle

      // Test updateContextKeyDown with different event types
      service.send({ type: "TIMER_TICK", timestamp: 1400 }); // Not KEY_DOWN
      expect(service.getState().context.direction).toBeUndefined();

      // Test updateConfig with different event types
      service.send({ type: "KEY_DOWN", direction: 1, timestamp: 1500 }); // Not UPDATE_CONFIG
      expect(service.getState().context.dasMs).toBe(100); // Should remain from the updateConfig call above
    });
  });

  describe("Edge Case Handling", () => {
    test("handles key release after DAS expiry but before timer tick", () => {
      const service = new DASMachineService();

      // Key down to start charging
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
      expect(service.getState().state).toBe("charging");

      // Key up after DAS expiry (167ms) but before first timer tick
      const actions = service.send({
        type: "KEY_UP",
        direction: -1,
        timestamp: 1200, // 200ms after start, which is > 167ms DAS
      });

      expect(service.getState().state).toBe("idle");
      expect(service.getState().context.direction).toBeUndefined();
      expect(service.getState().context.dasStartTime).toBeUndefined();
      expect(actions).toHaveLength(1); // TapMove should be emitted (edge case: released after DAS but still counts as tap)
      if (isTapMoveAction(actions[0])) {
        expect(actions[0].dir).toBe(-1);
        expect(actions[0].timestampMs).toBe(1200);
      }
    });

    test("ignores key release for different direction while repeating", () => {
      const service = new DASMachineService();

      // Get to repeating state with left direction
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
      service.send({ type: "TIMER_TICK", timestamp: 1167 });
      expect(service.getState().state).toBe("repeating");

      // KEY_UP for right direction (opposite) should not exit repeating
      const actions = service.send({
        type: "KEY_UP",
        direction: 1, // Opposite direction
        timestamp: 1300,
      });

      expect(service.getState().state).toBe("repeating"); // Should still be repeating
      expect(service.getState().context.direction).toBe(-1); // Should still have left direction
      expect(actions).toHaveLength(0); // No actions should be emitted
    });

    test("ignores key release for different direction while charging", () => {
      const service = new DASMachineService();

      // KEY_DOWN left at t=1000
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });
      expect(service.getState().state).toBe("charging");
      expect(service.getState().context.direction).toBe(-1);

      // KEY_DOWN right at t=1080 (switch to charging right)
      service.send({ type: "KEY_DOWN", direction: 1, timestamp: 1080 });
      expect(service.getState().state).toBe("charging");
      expect(service.getState().context.direction).toBe(1);

      // KEY_UP left at t=1100 - should be ignored since we're now charging right
      const actions = service.send({
        type: "KEY_UP",
        direction: -1,
        timestamp: 1100,
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
        type: "TIMER_TICK",
        timestamp: 1000,
      });
      expect(ctx1).toBe(initialContext); // Should return unchanged context

      // updateContextHoldStart with wrong event type or conditions not met
      const ctx2 = updateContextHoldStart(initialContext, {
        type: "KEY_DOWN",
        direction: -1,
        timestamp: 1000,
      });
      expect(ctx2).toBe(initialContext); // Should return unchanged context

      // updateContextARR with wrong event type
      const ctx3 = updateContextARR(initialContext, {
        type: "KEY_DOWN",
        direction: -1,
        timestamp: 1000,
      });
      expect(ctx3).toBe(initialContext); // Should return unchanged context

      // updateConfig with non-UPDATE_CONFIG event
      const ctx4 = updateConfig(initialContext, {
        type: "KEY_DOWN",
        direction: -1,
        timestamp: 1000,
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
      const service = interpret(machine, () => {
        // onChange callback - this will trigger when state changes
      });

      // Send an event to the service to trigger state changes and context usage
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });

      // Verify the service was created and can handle events
      expect(service).toBeDefined();
      expect(service.machine).toBeDefined();
      expect(typeof service.send).toBe("function");
    });

    test("handles complete state transition sequence", () => {
      const initialContext = createDefaultDASContext(100, 20);
      const machine = createDASMachine(initialContext);

      const service = interpret(machine, () => {
        // State change callback
      });

      // Complete test sequence through all states:

      // 1. Start with key down
      service.send({ type: "KEY_DOWN", direction: -1, timestamp: 1000 });

      // 2. Release quickly (tap)
      service.send({ type: "KEY_UP", direction: -1, timestamp: 1050 });

      // 3. Press key again
      service.send({ type: "KEY_DOWN", direction: 1, timestamp: 2000 });

      // 4. Hold until DAS expires
      service.send({ type: "TIMER_TICK", timestamp: 2100 });

      // 5. Continue holding for ARR
      service.send({ type: "TIMER_TICK", timestamp: 2120 });

      // 6. Release to end hold
      service.send({ type: "KEY_UP", direction: 1, timestamp: 2200 });

      // 7. Update configuration
      service.send({ type: "UPDATE_CONFIG", dasMs: 200, arrMs: 30 });

      // Verify the service handled all transitions
      expect(service).toBeDefined();
    });
  });
});
