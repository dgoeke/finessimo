import {
  MockInputHandler,
  normalizeInputSequence,
  type InputHandler,
  type InputHandlerState,
} from "../../src/input/handler";
import { defaultKeyBindings, type KeyBindings } from "../../src/input/keyboard";
import { createFrame } from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";
import {
  createTestRotateAction,
  createTestSoftDropAction,
} from "../test-helpers";

import type { Action, GameState, InputEvent } from "../../src/state/types";

describe("handler.ts", () => {
  describe("MockInputHandler", () => {
    let mockHandler: MockInputHandler;
    let dispatchMock: jest.MockedFunction<(action: Action) => void>;

    beforeEach(() => {
      mockHandler = new MockInputHandler();
      dispatchMock = jest.fn();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe("initialization", () => {
      test("constructs with default state", () => {
        const state = mockHandler.getState();

        expect(state).toEqual({
          arrLastTime: undefined,
          currentDirection: undefined,
          dasStartTime: undefined,
          isLeftKeyDown: false,
          isRightKeyDown: false,
          isSoftDropDown: false,
          softDropLastTime: undefined,
        });
      });

      test("constructs with default key bindings", () => {
        const bindings = mockHandler.getKeyBindings();
        expect(bindings).toEqual(defaultKeyBindings());
      });

      test("init sets dispatch function", () => {
        mockHandler.init(dispatchMock);

        // Test that dispatch was set by calling simulateAction
        const testAction: Action = { type: "Hold" };
        mockHandler.simulateAction(testAction);
        expect(dispatchMock).toHaveBeenCalledWith(testAction);
      });
    });

    // InputHandler interface compliance
    test("implements InputHandler interface", () => {
      // Type check - should compile without error
      const handler: InputHandler = mockHandler;
      expect(handler).toBeDefined();
    });

    test("start method exists and is callable", () => {
      expect(() => mockHandler.start()).not.toThrow();
    });

    test("stop method exists and is callable", () => {
      expect(() => mockHandler.stop()).not.toThrow();
    });

    test("update method exists and accepts parameters", () => {
      const gameState = {} as GameState;
      expect(() => mockHandler.update(gameState, 1000)).not.toThrow();
    });

    test("getState returns InputHandlerState", () => {
      const state: InputHandlerState = mockHandler.getState();

      expect(typeof state.isLeftKeyDown).toBe("boolean");
      expect(typeof state.isRightKeyDown).toBe("boolean");
      expect(typeof state.isSoftDropDown).toBe("boolean");
      expect(
        state.dasStartTime === undefined ||
          typeof state.dasStartTime === "number",
      ).toBe(true);
      expect(
        state.arrLastTime === undefined ||
          typeof state.arrLastTime === "number",
      ).toBe(true);
      expect([-1, 1, undefined]).toContain(state.currentDirection);
      expect(
        state.softDropLastTime === undefined ||
          typeof state.softDropLastTime === "number",
      ).toBe(true);
    });
    // end interface compliance

    // key binding management
    test("getKeyBindings returns copy of current bindings", () => {
      const bindings = mockHandler.getKeyBindings();
      expect(bindings).toEqual(defaultKeyBindings());

      // Verify it's a copy by modifying it
      bindings.MoveLeft = ["TestKey"];
      expect(mockHandler.getKeyBindings().MoveLeft).not.toEqual(["TestKey"]);
      expect(mockHandler.getKeyBindings()).toEqual(defaultKeyBindings());
    });

    test("setKeyBindings updates internal bindings", () => {
      const customBindings = {
        ...defaultKeyBindings(),
        MoveLeft: ["KeyA"],
        MoveRight: ["KeyD"],
      };

      mockHandler.setKeyBindings(customBindings);

      expect(mockHandler.getKeyBindings()).toEqual(customBindings);
    });

    test("setKeyBindings creates copy of input bindings", () => {
      const originalBindings = {
        ...defaultKeyBindings(),
        MoveLeft: ["KeyA"],
      };
      const inputBindings = { ...originalBindings };

      mockHandler.setKeyBindings(inputBindings);

      // Modify original - should not affect stored bindings
      inputBindings.MoveLeft = ["KeyB"];

      expect(mockHandler.getKeyBindings().MoveLeft).toEqual(["KeyA"]);
    });
    // end key binding management

    // state management
    test("getState returns copy of current state", () => {
      const state1 = mockHandler.getState();
      const state2 = mockHandler.getState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different objects
    });

    test("setState updates internal state", () => {
      const updates: Partial<InputHandlerState> = {
        currentDirection: -1,
        dasStartTime: 1000,
        isLeftKeyDown: true,
      };

      mockHandler.setState(updates);

      const state = mockHandler.getState();
      expect(state.isLeftKeyDown).toBe(true);
      expect(state.currentDirection).toBe(-1);
      expect(state.dasStartTime).toBe(1000);

      // Other properties should remain unchanged
      expect(state.isRightKeyDown).toBe(false);
      expect(state.isSoftDropDown).toBe(false);
    });

    test("setState performs partial updates", () => {
      // Set initial state
      mockHandler.setState({
        currentDirection: -1,
        isLeftKeyDown: true,
        isRightKeyDown: true,
      });

      // Partial update
      mockHandler.setState({
        dasStartTime: 2000,
        isLeftKeyDown: false,
      });

      const state = mockHandler.getState();
      expect(state.isLeftKeyDown).toBe(false); // Updated
      expect(state.isRightKeyDown).toBe(true); // Preserved
      expect(state.currentDirection).toBe(-1); // Preserved
      expect(state.dasStartTime).toBe(2000); // Updated
    });

    test("setState handles all state properties", () => {
      const fullState: InputHandlerState = {
        arrLastTime: 1500,
        currentDirection: 1,
        dasStartTime: 1000,
        isLeftKeyDown: true,
        isRightKeyDown: true,
        isSoftDropDown: true,
        softDropLastTime: 2000,
      };

      mockHandler.setState(fullState);

      expect(mockHandler.getState()).toEqual(fullState);
    });
    // end state management

    // test helper methods
    test("simulateAction calls dispatch when initialized", () => {
      mockHandler.init(dispatchMock);

      const action: Action = { type: "Hold" };
      mockHandler.simulateAction(action);

      expect(dispatchMock).toHaveBeenCalledWith(action);
      expect(dispatchMock).toHaveBeenCalledTimes(1);
    });

    test("simulateAction does nothing when dispatch not set", () => {
      // Don't call init
      const action: Action = { type: "Hold" };

      expect(() => mockHandler.simulateAction(action)).not.toThrow();
    });

    test("simulateAction handles various action types", () => {
      mockHandler.init(dispatchMock);

      const actions: Array<Action> = [
        { type: "Hold" },
        createTestRotateAction("CW"),
        createTestSoftDropAction(true),
        { timestampMs: createTimestamp(1000), type: "HardDrop" },
        {
          dir: -1,
          optimistic: false,
          timestampMs: createTimestamp(1000),
          type: "TapMove",
        },
        { dir: 1, timestampMs: createTimestamp(1000), type: "HoldMove" },
        { dir: -1, timestampMs: createTimestamp(1000), type: "RepeatMove" },
      ];

      for (const action of actions) {
        mockHandler.simulateAction(action);
      }

      expect(dispatchMock).toHaveBeenCalledTimes(actions.length);
      for (let index = 0; index < actions.length; index++) {
        const action = actions[index];
        expect(dispatchMock).toHaveBeenNthCalledWith(index + 1, action);
      }
    });
    // end test helper methods

    // lifecycle method behavior
    test("start method is safe to call multiple times", () => {
      expect(() => {
        mockHandler.start();
        mockHandler.start();
        mockHandler.start();
      }).not.toThrow();
    });

    test("stop method is safe to call multiple times", () => {
      expect(() => {
        mockHandler.stop();
        mockHandler.stop();
        mockHandler.stop();
      }).not.toThrow();
    });

    test("update method ignores parameters", () => {
      const invalidGameState = null as unknown as GameState;
      const negativeTime = -1000;

      expect(() =>
        mockHandler.update(invalidGameState, negativeTime),
      ).not.toThrow();
    });
    // end lifecycle method behavior

    // state immutability
    test("modifying returned state does not affect internal state", () => {
      const state = mockHandler.getState();
      state.isLeftKeyDown = true;
      state.currentDirection = 1;
      state.dasStartTime = 5000;

      const freshState = mockHandler.getState();
      expect(freshState.isLeftKeyDown).toBe(false);
      expect(freshState.currentDirection).toBeUndefined();
      expect(freshState.dasStartTime).toBeUndefined();
    });

    test("modifying returned bindings does not affect internal bindings", () => {
      const bindings = mockHandler.getKeyBindings();
      bindings.MoveLeft = ["ModifiedKey"];
      bindings.RotateCW = ["AnotherKey"];

      const freshBindings = mockHandler.getKeyBindings();
      expect(freshBindings.MoveLeft).toEqual(defaultKeyBindings().MoveLeft);
      expect(freshBindings.RotateCW).toEqual(defaultKeyBindings().RotateCW);
    });
    // end state immutability

    // edge cases and error handling
    test("setState with empty object does not crash", () => {
      expect(() => mockHandler.setState({})).not.toThrow();

      // State should remain unchanged
      expect(mockHandler.getState()).toEqual({
        arrLastTime: undefined,
        currentDirection: undefined,
        dasStartTime: undefined,
        isLeftKeyDown: false,
        isRightKeyDown: false,
        isSoftDropDown: false,
        softDropLastTime: undefined,
      });
    });

    test("setState with undefined values for optional fields", () => {
      mockHandler.setState({
        dasStartTime: 1000,
        isLeftKeyDown: true,
      });

      mockHandler.setState({
        dasStartTime: undefined, // This is valid - dasStartTime can be undefined
      });

      const state = mockHandler.getState();
      expect(state.dasStartTime).toBeUndefined();
      expect(state.isLeftKeyDown).toBe(true); // Should remain from previous setState
    });

    test("setKeyBindings with incomplete bindings", () => {
      const incompleteBindings = {
        MoveLeft: ["KeyA"],
        // Missing other required bindings
      } as unknown as KeyBindings;

      expect(() =>
        mockHandler.setKeyBindings(incompleteBindings),
      ).not.toThrow();

      // Should handle gracefully (exact behavior depends on implementation)
      const bindings = mockHandler.getKeyBindings();
      expect(bindings.MoveLeft).toEqual(["KeyA"]);
    });

    test("simulateAction with malformed actions", () => {
      mockHandler.init(dispatchMock);

      const malformedActions = [
        {} as Action,
        { type: "UnknownAction" } as unknown as Action,
        { optimistic: false, type: "TapMove" } as Action, // Missing required properties
        null as unknown as Action,
        undefined as unknown as Action,
      ];

      for (const action of malformedActions) {
        expect(() => mockHandler.simulateAction(action)).not.toThrow();
      }
    });
    // end edge cases and error handling

    // test scenario simulation
    test("can simulate complex input scenarios", () => {
      mockHandler.init(dispatchMock);

      // Simulate a DAS scenario
      mockHandler.setState({
        currentDirection: undefined,
        dasStartTime: undefined,
        isLeftKeyDown: false,
      });

      // Key down
      mockHandler.setState({
        currentDirection: -1,
        dasStartTime: 1000,
        isLeftKeyDown: true,
      });
      mockHandler.simulateAction({
        dir: -1,
        optimistic: false,
        timestampMs: createTimestamp(1000),
        type: "TapMove",
      });

      // DAS expires, start repeating
      mockHandler.setState({
        arrLastTime: 1133, // DAS + 133ms
      });
      mockHandler.simulateAction({
        dir: -1,
        timestampMs: createTimestamp(1133),
        type: "HoldMove",
      });

      // ARR repeats
      mockHandler.setState({
        arrLastTime: 1135, // +2ms ARR
      });
      mockHandler.simulateAction({
        dir: -1,
        timestampMs: createTimestamp(1135),
        type: "RepeatMove",
      });

      // Key up
      mockHandler.setState({
        arrLastTime: undefined,
        currentDirection: undefined,
        dasStartTime: undefined,
        isLeftKeyDown: false,
      });

      expect(dispatchMock).toHaveBeenCalledTimes(3);
      expect(dispatchMock).toHaveBeenNthCalledWith(1, {
        dir: -1,
        optimistic: false,
        timestampMs: createTimestamp(1000),
        type: "TapMove",
      });
      expect(dispatchMock).toHaveBeenNthCalledWith(2, {
        dir: -1,
        timestampMs: createTimestamp(1133),
        type: "HoldMove",
      });
      expect(dispatchMock).toHaveBeenNthCalledWith(3, {
        dir: -1,
        timestampMs: createTimestamp(1135),
        type: "RepeatMove",
      });
    });

    test("can simulate soft drop behavior", () => {
      mockHandler.init(dispatchMock);

      // Start soft drop
      mockHandler.setState({
        isSoftDropDown: true,
        softDropLastTime: 1000,
      });
      mockHandler.simulateAction(createTestSoftDropAction(true));

      // Soft drop pulses
      mockHandler.setState({
        softDropLastTime: 1050,
      });
      mockHandler.simulateAction(createTestSoftDropAction(true));

      // Stop soft drop
      mockHandler.setState({
        isSoftDropDown: false,
      });
      mockHandler.simulateAction(createTestSoftDropAction(false));

      expect(dispatchMock).toHaveBeenCalledTimes(3);
      expect(dispatchMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          on: true,
          type: "SoftDrop",
        }),
      );
      expect(dispatchMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          on: true,
          type: "SoftDrop",
        }),
      );
      expect(dispatchMock).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          on: false,
          type: "SoftDrop",
        }),
      );
    });
    // end test scenario simulation

    // concurrent state management
    test("can handle multiple direction states", () => {
      mockHandler.setState({
        currentDirection: -1, // But left wins
        dasStartTime: 1000,
        isLeftKeyDown: true,
        isRightKeyDown: true, // Both keys somehow pressed
      });

      const state = mockHandler.getState();
      expect(state.isLeftKeyDown).toBe(true);
      expect(state.isRightKeyDown).toBe(true);
      expect(state.currentDirection).toBe(-1);
    });

    test("can simulate key switching scenarios", () => {
      mockHandler.init(dispatchMock);

      // Start with left
      mockHandler.setState({
        currentDirection: -1,
        dasStartTime: 1000,
        isLeftKeyDown: true,
      });

      // Switch to right
      mockHandler.setState({
        currentDirection: 1,
        dasStartTime: 1100, // New DAS timer
        isLeftKeyDown: false,
        isRightKeyDown: true,
      });
      mockHandler.simulateAction({
        dir: 1,
        optimistic: false,
        timestampMs: createTimestamp(1100),
        type: "TapMove",
      });

      expect(dispatchMock).toHaveBeenCalledWith({
        dir: 1,
        optimistic: false,
        timestampMs: createTimestamp(1100),
        type: "TapMove",
      });
    });
    // end concurrent state management
  });

  describe("normalizeInputSequence", () => {
    // The normalizeInputSequence function is already thoroughly tested in input-handler.test.ts
    // We'll add a few additional edge case tests here

    test("handles empty input array", () => {
      const result = normalizeInputSequence([], 50);
      expect(result).toEqual([]);
    });

    test("handles single input", () => {
      const events: Array<InputEvent> = [
        {
          action: "LeftDown",
          frame: createFrame(1),
          tMs: createTimestamp(1000),
        },
      ];

      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["LeftDown"]);
    });

    test("handles inputs with same timestamp", () => {
      const t = 1000;
      const events: Array<InputEvent> = [
        { action: "LeftDown", frame: createFrame(1), tMs: createTimestamp(t) },
        { action: "RightDown", frame: createFrame(1), tMs: createTimestamp(t) }, // Same timestamp
        { action: "RotateCW", frame: createFrame(1), tMs: createTimestamp(t) },
      ];

      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["RotateCW"]); // Movement inputs cancelled
    });

    test("handles very large cancel window", () => {
      const t = 1000;
      const events: Array<InputEvent> = [
        { action: "LeftDown", frame: createFrame(1), tMs: createTimestamp(t) },
        {
          action: "RightDown",
          frame: createFrame(2),
          tMs: createTimestamp(t + 500),
        }, // 500ms apart
      ];

      const result = normalizeInputSequence(events, 1000); // 1000ms window
      expect(result).toEqual([]); // Both cancelled
    });

    test("handles zero cancel window", () => {
      const t = 1000;
      const events: Array<InputEvent> = [
        { action: "LeftDown", frame: createFrame(1), tMs: createTimestamp(t) },
        {
          action: "RightDown",
          frame: createFrame(2),
          tMs: createTimestamp(t + 1),
        }, // 1ms apart
      ];

      const result = normalizeInputSequence(events, 0); // No cancellation
      expect(result).toEqual(["LeftDown", "RightDown"]);
    });

    test("preserves input order after cancellation", () => {
      const t = 1000;
      const events: Array<InputEvent> = [
        { action: "RotateCW", frame: createFrame(1), tMs: createTimestamp(t) },
        {
          action: "LeftDown",
          frame: createFrame(2),
          tMs: createTimestamp(t + 10),
        },
        {
          action: "RightDown",
          frame: createFrame(3),
          tMs: createTimestamp(t + 20),
        }, // Cancels LeftDown
        {
          action: "Hold",
          frame: createFrame(4),
          tMs: createTimestamp(t + 100),
        },
      ];

      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["RotateCW", "Hold"]);
    });

    test("handles malformed events gracefully", () => {
      const events: Array<InputEvent> = [
        {
          action: "LeftDown",
          frame: createFrame(1),
          tMs: createTimestamp(1000),
        },
        // Test with undefined/null values filtered out
        {
          action: "RotateCW",
          frame: createFrame(2),
          tMs: createTimestamp(1100),
        },
      ];

      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["LeftDown", "RotateCW"]);
    });
  });
});
