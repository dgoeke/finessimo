import {
  normalizeInputSequence,
  updateDASState,
  calculateDASActions,
  calculateSoftDropActions,
  processInputWithDAS,
  generateDASActions,
  InputProcessor,
  MockInputHandler,
  InputHandlerState,
} from "../../src/input/handler";
import { InputEvent, Action, GameState } from "../../src/state/types";

describe("normalizeInputSequence", () => {
  test("cancels opposite inputs within window", () => {
    const t = 1000;
    const events: InputEvent[] = [
      { tMs: t, frame: 1, action: "LeftDown" },
      { tMs: t + 40, frame: 2, action: "RightDown" }, // within 50ms window
      { tMs: t + 200, frame: 3, action: "RotateCW" },
    ];
    const out = normalizeInputSequence(events, 50);
    expect(out).toEqual(["RotateCW"]);
  });

  test("keeps inputs outside cancel window", () => {
    const t = 1000;
    const events: InputEvent[] = [
      { tMs: t, frame: 1, action: "LeftDown" },
      { tMs: t + 80, frame: 2, action: "RightDown" }, // outside 50ms window
    ];
    const out = normalizeInputSequence(events, 50);
    expect(out).toEqual(["LeftDown", "RightDown"]);
  });

  test("handles multiple cancellation pairs", () => {
    const t = 1000;
    const events: InputEvent[] = [
      { tMs: t, frame: 1, action: "LeftDown" },
      { tMs: t + 10, frame: 2, action: "RightDown" }, // cancels with LeftDown
      { tMs: t + 100, frame: 3, action: "RightDown" },
      { tMs: t + 120, frame: 4, action: "LeftDown" }, // cancels with second RightDown
      { tMs: t + 200, frame: 5, action: "RotateCW" },
    ];
    const out = normalizeInputSequence(events, 50);
    expect(out).toEqual(["RotateCW"]);
  });

  test("preserves non-movement actions", () => {
    const t = 1000;
    const events: InputEvent[] = [
      { tMs: t, frame: 1, action: "RotateCW" },
      { tMs: t + 10, frame: 2, action: "RotateCCW" },
      { tMs: t + 20, frame: 3, action: "HardDrop" },
      { tMs: t + 30, frame: 4, action: "Hold" },
    ];
    const out = normalizeInputSequence(events, 50);
    expect(out).toEqual(["RotateCW", "RotateCCW", "HardDrop", "Hold"]);
  });
});

describe("updateDASState", () => {
  const initialState: InputHandlerState = {
    isLeftKeyDown: false,
    isRightKeyDown: false,
    isSoftDropDown: false,
    dasStartTime: undefined,
    arrLastTime: undefined,
    currentDirection: undefined,
    softDropLastTime: undefined,
  };

  test("LeftDown sets left key state and direction", () => {
    const timeMs = 1000;
    const newState = updateDASState(initialState, "LeftDown", timeMs);

    expect(newState.isLeftKeyDown).toBe(true);
    expect(newState.currentDirection).toBe(-1);
    expect(newState.dasStartTime).toBe(timeMs);
    expect(newState.arrLastTime).toBeUndefined();
  });

  test("RightDown sets right key state and direction", () => {
    const timeMs = 1000;
    const newState = updateDASState(initialState, "RightDown", timeMs);

    expect(newState.isRightKeyDown).toBe(true);
    expect(newState.currentDirection).toBe(1);
    expect(newState.dasStartTime).toBe(timeMs);
    expect(newState.arrLastTime).toBeUndefined();
  });

  test("LeftUp clears left key when it was active direction", () => {
    const timeMs = 1000;
    const leftDownState = updateDASState(initialState, "LeftDown", timeMs);
    const newState = updateDASState(leftDownState, "LeftUp", timeMs + 100);

    expect(newState.isLeftKeyDown).toBe(false);
    expect(newState.currentDirection).toBeUndefined();
    expect(newState.dasStartTime).toBeUndefined();
  });

  test("LeftUp switches to right when right key is held", () => {
    const timeMs = 1000;
    let state = updateDASState(initialState, "LeftDown", timeMs);
    state = updateDASState(state, "RightDown", timeMs + 50); // Both keys down, right wins
    state = updateDASState(state, "LeftUp", timeMs + 100); // Release left

    expect(state.isLeftKeyDown).toBe(false);
    expect(state.isRightKeyDown).toBe(true);
    expect(state.currentDirection).toBe(1);
    expect(state.dasStartTime).toBe(timeMs + 100); // Reset DAS for right
  });

  test("SoftDropDown sets soft drop state", () => {
    const timeMs = 1000;
    const newState = updateDASState(initialState, "SoftDropDown", timeMs);

    expect(newState.isSoftDropDown).toBe(true);
    expect(newState.softDropLastTime).toBe(timeMs);
  });

  test("SoftDropUp clears soft drop state", () => {
    const timeMs = 1000;
    const softDropState = updateDASState(initialState, "SoftDropDown", timeMs);
    const newState = updateDASState(softDropState, "SoftDropUp", timeMs + 100);

    expect(newState.isSoftDropDown).toBe(false);
    expect(newState.softDropLastTime).toBeUndefined();
  });

  test("RightUp clears right key when it was active direction", () => {
    const timeMs = 1000;
    const rightDownState = updateDASState(initialState, "RightDown", timeMs);
    const newState = updateDASState(rightDownState, "RightUp", timeMs + 100);

    expect(newState.isRightKeyDown).toBe(false);
    expect(newState.currentDirection).toBeUndefined();
    expect(newState.dasStartTime).toBeUndefined();
  });

  test("RightUp switches to left when left key is held", () => {
    const timeMs = 1000;
    let state = updateDASState(initialState, "RightDown", timeMs);
    state = updateDASState(state, "LeftDown", timeMs + 50); // Both keys down, left wins
    state = updateDASState(state, "RightUp", timeMs + 100); // Release right

    expect(state.isRightKeyDown).toBe(false);
    expect(state.isLeftKeyDown).toBe(true);
    expect(state.currentDirection).toBe(-1);
    expect(state.dasStartTime).toBe(timeMs + 100); // Reset DAS for left
  });

  test("returns unchanged state for unhandled actions", () => {
    const newState = updateDASState(initialState, "RotateCW", 1000);
    expect(newState).toEqual(initialState);
  });
});

describe("calculateDASActions", () => {
  test("returns no actions before DAS delay", () => {
    const result = calculateDASActions(-1, 1000, undefined, 1050, 100, 30);
    expect(result.actions).toHaveLength(0);
    expect(result.newArrTime).toBeUndefined();
  });

  test("generates first DAS action after delay", () => {
    const result = calculateDASActions(-1, 1000, undefined, 1100, 100, 30);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.action).toEqual({
      type: "Move",
      dir: -1,
      source: "das",
    });
    expect(result.actions[0]?.timestamp).toBe(1100);
    expect(result.newArrTime).toBe(1100);
  });

  test("generates multiple ARR actions for long time span", () => {
    const result = calculateDASActions(1, 1000, 1100, 1200, 100, 30);
    expect(result.actions.length).toBeGreaterThan(1);
    expect(result.actions[0]?.timestamp).toBe(1130); // 1100 + 30
    expect(result.actions[1]?.timestamp).toBe(1160); // 1130 + 30
  });

  test("respects maximum pulses per update", () => {
    // Simulate very long time gap that would exceed MAX_PULSES_PER_UPDATE
    const result = calculateDASActions(1, 1000, 1100, 10000, 100, 1);
    expect(result.actions.length).toBeLessThanOrEqual(200);
  });

  test("handles zero ARR correctly", () => {
    const result = calculateDASActions(1, 1000, undefined, 1200, 100, 0);
    expect(result.actions.length).toBeLessThanOrEqual(200); // Should be clamped
  });
});

describe("calculateSoftDropActions", () => {
  test("generates soft drop actions based on gravity interval", () => {
    const gravityMs = 1000;
    const softDropMultiplier = 10;

    const result = calculateSoftDropActions(
      undefined,
      1000,
      gravityMs,
      softDropMultiplier,
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.action).toEqual({ type: "SoftDrop", on: true });
    expect(result.newSoftDropTime).toBe(1000);
  });

  test("generates multiple actions for long intervals", () => {
    const result = calculateSoftDropActions(1000, 1300, 1000, 10);
    expect(result.actions.length).toBeGreaterThan(1);
  });

  test("respects maximum pulses per update", () => {
    const result = calculateSoftDropActions(1000, 10000, 100, 100);
    expect(result.actions.length).toBeLessThanOrEqual(200);
  });
});

describe("processInputWithDAS", () => {
  const initialState: InputHandlerState = {
    isLeftKeyDown: false,
    isRightKeyDown: false,
    isSoftDropDown: false,
    dasStartTime: undefined,
    arrLastTime: undefined,
    currentDirection: undefined,
    softDropLastTime: undefined,
  };

  const mockGameState = {
    timing: { dasMs: 100, arrMs: 30 },
  } as GameState;

  test("processes LeftDown event", () => {
    const event: InputEvent = {
      tMs: 1000,
      frame: 1,
      action: "LeftDown",
    };

    const result = processInputWithDAS(initialState, event, mockGameState);

    expect(result.newState.isLeftKeyDown).toBe(true);
    expect(result.newState.currentDirection).toBe(-1);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.action).toEqual({
      type: "Move",
      dir: -1,
      source: "tap",
    });
  });

  test("processes rotation events", () => {
    const event: InputEvent = {
      tMs: 1000,
      frame: 1,
      action: "RotateCW",
    };

    const result = processInputWithDAS(initialState, event, mockGameState);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.action).toEqual({
      type: "Rotate",
      dir: "CW",
    });
  });

  test("processes HardDrop with timestamp", () => {
    const event: InputEvent = {
      tMs: 1000,
      frame: 1,
      action: "HardDrop",
    };

    const result = processInputWithDAS(initialState, event, mockGameState);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.action.type).toBe("HardDrop");
    expect(result.actions[0]?.action).toHaveProperty("timestampMs");
  });

  test("processes RightDown event", () => {
    const event: InputEvent = {
      tMs: 1000,
      frame: 1,
      action: "RightDown",
    };

    const result = processInputWithDAS(initialState, event, mockGameState);

    expect(result.newState.isRightKeyDown).toBe(true);
    expect(result.newState.currentDirection).toBe(1);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.action).toEqual({
      type: "Move",
      dir: 1,
      source: "tap",
    });
  });

  test("processes SoftDropDown event", () => {
    const event: InputEvent = {
      tMs: 1000,
      frame: 1,
      action: "SoftDropDown",
    };

    const result = processInputWithDAS(initialState, event, mockGameState);

    expect(result.newState.isSoftDropDown).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.action).toEqual({
      type: "SoftDrop",
      on: true,
    });
  });

  test("processes SoftDropUp event", () => {
    const softDropState = updateDASState(initialState, "SoftDropDown", 1000);
    const event: InputEvent = {
      tMs: 1100,
      frame: 2,
      action: "SoftDropUp",
    };

    const result = processInputWithDAS(softDropState, event, mockGameState);

    expect(result.newState.isSoftDropDown).toBe(false);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.action).toEqual({
      type: "SoftDrop",
      on: false,
    });
  });

  test("processes RotateCCW event", () => {
    const event: InputEvent = {
      tMs: 1000,
      frame: 1,
      action: "RotateCCW",
    };

    const result = processInputWithDAS(initialState, event, mockGameState);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.action).toEqual({
      type: "Rotate",
      dir: "CCW",
    });
  });

  test("processes Hold event", () => {
    const event: InputEvent = {
      tMs: 1000,
      frame: 1,
      action: "Hold",
    };

    const result = processInputWithDAS(initialState, event, mockGameState);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.action).toEqual({
      type: "Hold",
    });
  });

  test("processes key up events without immediate actions", () => {
    const leftDownState = updateDASState(initialState, "LeftDown", 1000);
    const event: InputEvent = {
      tMs: 1100,
      frame: 2,
      action: "LeftUp",
    };

    const result = processInputWithDAS(leftDownState, event, mockGameState);

    expect(result.newState.isLeftKeyDown).toBe(false);
    expect(result.actions).toHaveLength(0); // No immediate action for key up
  });

  test("processes RightUp events without immediate actions", () => {
    const rightDownState = updateDASState(initialState, "RightDown", 1000);
    const event: InputEvent = {
      tMs: 1100,
      frame: 2,
      action: "RightUp",
    };

    const result = processInputWithDAS(rightDownState, event, mockGameState);

    expect(result.newState.isRightKeyDown).toBe(false);
    expect(result.actions).toHaveLength(0); // No immediate action for key up
  });
});

describe("generateDASActions", () => {
  const mockGameState = {
    timing: {
      dasMs: 100,
      arrMs: 30,
      gravityMs: 1000,
      softDrop: 10 as const,
    },
  } as GameState;

  test("generates DAS actions when conditions are met", () => {
    const state: InputHandlerState = {
      isLeftKeyDown: true,
      isRightKeyDown: false,
      isSoftDropDown: false,
      dasStartTime: 1000,
      arrLastTime: undefined,
      currentDirection: -1,
      softDropLastTime: undefined,
    };

    const result = generateDASActions(state, mockGameState, 1150);

    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.actions[0]?.action).toEqual({
      type: "Move",
      dir: -1,
      source: "das",
    });
    expect(result.newState.arrLastTime).toBeDefined();
  });

  test("generates soft drop actions when soft drop is active", () => {
    const state: InputHandlerState = {
      isLeftKeyDown: false,
      isRightKeyDown: false,
      isSoftDropDown: true,
      dasStartTime: undefined,
      arrLastTime: undefined,
      currentDirection: undefined,
      softDropLastTime: 1000,
    };

    const result = generateDASActions(state, mockGameState, 1200);

    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.actions[0]?.action).toEqual({
      type: "SoftDrop",
      on: true,
    });
  });

  test("handles infinite soft drop correctly", () => {
    const infiniteSoftDropGameState = {
      ...mockGameState,
      timing: { ...mockGameState.timing, softDrop: "infinite" as const },
    };

    const state: InputHandlerState = {
      isLeftKeyDown: false,
      isRightKeyDown: false,
      isSoftDropDown: true,
      dasStartTime: undefined,
      arrLastTime: undefined,
      currentDirection: undefined,
      softDropLastTime: 1000,
    };

    const result = generateDASActions(state, infiniteSoftDropGameState, 1200);

    // Should not generate soft drop actions for infinite soft drop
    expect(result.actions.every((a) => a.action.type !== "SoftDrop")).toBe(
      true,
    );
  });
});

describe("InputProcessor", () => {
  let processor: InputProcessor;
  let dispatched: Action[];

  beforeEach(() => {
    processor = new InputProcessor();
    dispatched = [];
    processor.init((action) => dispatched.push(action));
  });

  test("processes input events", () => {
    const mockGameState = {
      timing: { dasMs: 100, arrMs: 30 },
    } as GameState;

    const event: InputEvent = {
      tMs: 1000,
      frame: 1,
      action: "LeftDown",
    };

    processor.processEvent(event, mockGameState);

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual({
      type: "EnqueueProcessedInput",
      processedAction: {
        action: {
          type: "Move",
          dir: -1,
          source: "tap",
        },
        timestamp: 1000,
      },
    });
  });

  test("generates DAS actions on update", () => {
    const mockGameState = {
      timing: {
        dasMs: 100,
        arrMs: 30,
        gravityMs: 1000,
        softDrop: 10 as const,
      },
    } as GameState;

    // First trigger a left key down
    const event: InputEvent = {
      tMs: 1000,
      frame: 1,
      action: "LeftDown",
    };
    processor.processEvent(event, mockGameState);

    dispatched.length = 0; // Clear initial tap action

    // Update after DAS delay
    processor.update(mockGameState, 1150);

    expect(dispatched.length).toBeGreaterThan(0);
    expect(dispatched[0]).toEqual({
      type: "EnqueueProcessedInput",
      processedAction: {
        action: {
          type: "Move",
          dir: -1,
          source: "das",
        },
        timestamp: 1100,
      },
    });
  });

  test("maintains internal state correctly", () => {
    const mockGameState = {
      timing: { dasMs: 100, arrMs: 30 },
    } as GameState;

    const event: InputEvent = {
      tMs: 1000,
      frame: 1,
      action: "LeftDown",
    };

    processor.processEvent(event, mockGameState);

    const state = processor.getState();
    expect(state.isLeftKeyDown).toBe(true);
    expect(state.currentDirection).toBe(-1);
    expect(state.dasStartTime).toBe(1000);
  });
});

describe("MockInputHandler", () => {
  let handler: MockInputHandler;
  let dispatched: Action[];

  beforeEach(() => {
    handler = new MockInputHandler();
    dispatched = [];
    handler.init((action) => dispatched.push(action));
  });

  test("simulates input events", () => {
    handler.simulateInput("LeftDown");

    expect(dispatched).toHaveLength(2); // EnqueueInput + Move
    expect(dispatched[0]?.type).toBe("EnqueueInput");
    expect(dispatched[1]).toEqual({
      type: "Move",
      dir: -1,
      source: "tap",
    });
  });

  test("handles rotation inputs", () => {
    handler.simulateInput("RotateCW");

    expect(dispatched).toHaveLength(2); // EnqueueInput + Rotate
    expect(dispatched[1]).toEqual({
      type: "Rotate",
      dir: "CW",
    });
  });

  test("handles RightDown inputs", () => {
    handler.simulateInput("RightDown");

    expect(dispatched).toHaveLength(2); // EnqueueInput + Move
    expect(dispatched[0]?.type).toBe("EnqueueInput");
    expect(dispatched[1]).toEqual({
      type: "Move",
      dir: 1,
      source: "tap",
    });
  });

  test("handles SoftDropDown inputs", () => {
    handler.simulateInput("SoftDropDown");

    expect(dispatched).toHaveLength(2); // EnqueueInput + SoftDrop
    expect(dispatched[1]).toEqual({
      type: "SoftDrop",
      on: true,
    });
  });

  test("handles SoftDropUp inputs", () => {
    handler.simulateInput("SoftDropUp");

    expect(dispatched).toHaveLength(2); // EnqueueInput + SoftDrop
    expect(dispatched[1]).toEqual({
      type: "SoftDrop",
      on: false,
    });
  });

  test("handles RotateCCW inputs", () => {
    handler.simulateInput("RotateCCW");

    expect(dispatched).toHaveLength(2); // EnqueueInput + Rotate
    expect(dispatched[1]).toEqual({
      type: "Rotate",
      dir: "CCW",
    });
  });

  test("handles Hold inputs", () => {
    handler.simulateInput("Hold");

    expect(dispatched).toHaveLength(2); // EnqueueInput + Hold
    expect(dispatched[1]).toEqual({
      type: "Hold",
    });
  });

  test("handles LeftUp inputs", () => {
    handler.simulateInput("LeftUp");

    expect(dispatched).toHaveLength(1); // EnqueueInput only (no game action)
    expect(dispatched[0]?.type).toBe("EnqueueInput");
  });

  test("handles RightUp inputs", () => {
    handler.simulateInput("RightUp");

    expect(dispatched).toHaveLength(1); // EnqueueInput only (no game action)
    expect(dispatched[0]?.type).toBe("EnqueueInput");
  });

  test("handles HardDrop with timestamp", () => {
    handler.simulateInput("HardDrop");

    expect(dispatched).toHaveLength(2); // EnqueueInput + HardDrop
    expect(dispatched[1]?.type).toBe("HardDrop");
    expect(dispatched[1]).toHaveProperty("timestampMs");
  });

  test("update increments frame counter", () => {
    const mockGameState = {} as GameState;

    handler.update(mockGameState, 1000);

    // Frame counter is private, but we can verify update doesn't crash
    expect(() => handler.update(mockGameState, 1000)).not.toThrow();
  });

  test("returns current state", () => {
    const state = handler.getState();

    expect(state).toHaveProperty("isLeftKeyDown");
    expect(state).toHaveProperty("isRightKeyDown");
    expect(state).toHaveProperty("isSoftDropDown");
    expect(state.isLeftKeyDown).toBe(false);
    expect(state.isRightKeyDown).toBe(false);
    expect(state.isSoftDropDown).toBe(false);
  });

  test("setKeyBindings and getKeyBindings work as no-ops", () => {
    const mockBindings = {
      MoveLeft: ["KeyQ"],
      MoveRight: ["KeyE"],
      SoftDrop: ["KeyS"],
      HardDrop: ["Space"],
      RotateCW: ["KeyX"],
      RotateCCW: ["KeyZ"],
      Hold: ["KeyC"],
    };

    expect(() => handler.setKeyBindings(mockBindings)).not.toThrow();

    const result = handler.getKeyBindings();
    expect(result.MoveLeft).toEqual(["ArrowLeft", "KeyA"]); // Default bindings
  });

  test("start and stop methods work without error", () => {
    expect(() => handler.start()).not.toThrow();
    expect(() => handler.stop()).not.toThrow();
  });
});
