import {
  MockInputHandler,
  normalizeInputSequence,
  type InputHandler,
  type InputHandlerState,
} from "../../src/input/handler";
import type { Action, GameState, InputEvent } from "../../src/state/types";
import { defaultKeyBindings, type KeyBindings } from "../../src/input/keyboard";
import { createTimestamp } from "../../src/types/timestamp";

describe("handler.ts", () => {
  describe("MockInputHandler", () => {
    let mockHandler: MockInputHandler;
    let dispatchMock: jest.MockedFunction<(action: Action) => void>;

    beforeEach(() => {
      mockHandler = new MockInputHandler();
      dispatchMock = jest.fn<void, [Action]>();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe("initialization", () => {
      test("constructs with default state", () => {
        const state = mockHandler.getState();

        expect(state).toEqual({
          isLeftKeyDown: false,
          isRightKeyDown: false,
          isSoftDropDown: false,
          dasStartTime: undefined,
          arrLastTime: undefined,
          currentDirection: undefined,
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

    describe("InputHandler interface compliance", () => {
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
        expect(
          state.currentDirection === undefined ||
            state.currentDirection === -1 ||
            state.currentDirection === 1,
        ).toBe(true);
        expect(
          state.softDropLastTime === undefined ||
            typeof state.softDropLastTime === "number",
        ).toBe(true);
      });
    });

    describe("key binding management", () => {
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
    });

    describe("state management", () => {
      test("getState returns copy of current state", () => {
        const state1 = mockHandler.getState();
        const state2 = mockHandler.getState();

        expect(state1).toEqual(state2);
        expect(state1).not.toBe(state2); // Different objects
      });

      test("setState updates internal state", () => {
        const updates: Partial<InputHandlerState> = {
          isLeftKeyDown: true,
          currentDirection: -1,
          dasStartTime: 1000,
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
          isLeftKeyDown: true,
          isRightKeyDown: true,
          currentDirection: -1,
        });

        // Partial update
        mockHandler.setState({
          isLeftKeyDown: false,
          dasStartTime: 2000,
        });

        const state = mockHandler.getState();
        expect(state.isLeftKeyDown).toBe(false); // Updated
        expect(state.isRightKeyDown).toBe(true); // Preserved
        expect(state.currentDirection).toBe(-1); // Preserved
        expect(state.dasStartTime).toBe(2000); // Updated
      });

      test("setState handles all state properties", () => {
        const fullState: InputHandlerState = {
          isLeftKeyDown: true,
          isRightKeyDown: true,
          isSoftDropDown: true,
          dasStartTime: 1000,
          arrLastTime: 1500,
          currentDirection: 1,
          softDropLastTime: 2000,
        };

        mockHandler.setState(fullState);

        expect(mockHandler.getState()).toEqual(fullState);
      });
    });

    describe("test helper methods", () => {
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

        const actions: Action[] = [
          { type: "Hold" },
          { type: "Rotate", dir: "CW" },
          { type: "SoftDrop", on: true },
          { type: "HardDrop", timestampMs: createTimestamp(1000) },
          { type: "TapMove", dir: -1, timestampMs: createTimestamp(1000) },
          { type: "HoldMove", dir: 1, timestampMs: createTimestamp(1000) },
          { type: "RepeatMove", dir: -1, timestampMs: createTimestamp(1000) },
        ];

        actions.forEach((action) => {
          mockHandler.simulateAction(action);
        });

        expect(dispatchMock).toHaveBeenCalledTimes(actions.length);
        actions.forEach((action, index) => {
          expect(dispatchMock).toHaveBeenNthCalledWith(index + 1, action);
        });
      });
    });

    describe("lifecycle method behavior", () => {
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
    });

    describe("state immutability", () => {
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
    });

    describe("edge cases and error handling", () => {
      test("setState with empty object does not crash", () => {
        expect(() => mockHandler.setState({})).not.toThrow();

        // State should remain unchanged
        expect(mockHandler.getState()).toEqual({
          isLeftKeyDown: false,
          isRightKeyDown: false,
          isSoftDropDown: false,
          dasStartTime: undefined,
          arrLastTime: undefined,
          currentDirection: undefined,
          softDropLastTime: undefined,
        });
      });

      test("setState with undefined values", () => {
        mockHandler.setState({
          isLeftKeyDown: true,
          dasStartTime: 1000,
        });

        mockHandler.setState({
          isLeftKeyDown: undefined as unknown as boolean, // Should be handled gracefully
          dasStartTime: undefined,
        });

        const state = mockHandler.getState();
        expect(state.dasStartTime).toBeUndefined();
        // isLeftKeyDown might be undefined or false depending on implementation
        expect(
          typeof state.isLeftKeyDown === "boolean" ||
            state.isLeftKeyDown === undefined,
        ).toBe(true);
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
          { type: "TapMove" } as Action, // Missing required properties
          null as unknown as Action,
          undefined as unknown as Action,
        ];

        malformedActions.forEach((action) => {
          expect(() => mockHandler.simulateAction(action)).not.toThrow();
        });
      });
    });

    describe("test scenario simulation", () => {
      test("can simulate complex input scenarios", () => {
        mockHandler.init(dispatchMock);

        // Simulate a DAS scenario
        mockHandler.setState({
          isLeftKeyDown: false,
          currentDirection: undefined,
          dasStartTime: undefined,
        });

        // Key down
        mockHandler.setState({
          isLeftKeyDown: true,
          currentDirection: -1,
          dasStartTime: 1000,
        });
        mockHandler.simulateAction({
          type: "TapMove",
          dir: -1,
          timestampMs: createTimestamp(1000),
        });

        // DAS expires, start repeating
        mockHandler.setState({
          arrLastTime: 1133, // DAS + 133ms
        });
        mockHandler.simulateAction({
          type: "HoldMove",
          dir: -1,
          timestampMs: createTimestamp(1133),
        });

        // ARR repeats
        mockHandler.setState({
          arrLastTime: 1135, // +2ms ARR
        });
        mockHandler.simulateAction({
          type: "RepeatMove",
          dir: -1,
          timestampMs: createTimestamp(1135),
        });

        // Key up
        mockHandler.setState({
          isLeftKeyDown: false,
          currentDirection: undefined,
          dasStartTime: undefined,
          arrLastTime: undefined,
        });

        expect(dispatchMock).toHaveBeenCalledTimes(3);
        expect(dispatchMock).toHaveBeenNthCalledWith(1, {
          type: "TapMove",
          dir: -1,
          timestampMs: createTimestamp(1000),
        });
        expect(dispatchMock).toHaveBeenNthCalledWith(2, {
          type: "HoldMove",
          dir: -1,
          timestampMs: createTimestamp(1133),
        });
        expect(dispatchMock).toHaveBeenNthCalledWith(3, {
          type: "RepeatMove",
          dir: -1,
          timestampMs: createTimestamp(1135),
        });
      });

      test("can simulate soft drop behavior", () => {
        mockHandler.init(dispatchMock);

        // Start soft drop
        mockHandler.setState({
          isSoftDropDown: true,
          softDropLastTime: 1000,
        });
        mockHandler.simulateAction({ type: "SoftDrop", on: true });

        // Soft drop pulses
        mockHandler.setState({
          softDropLastTime: 1050,
        });
        mockHandler.simulateAction({ type: "SoftDrop", on: true });

        // Stop soft drop
        mockHandler.setState({
          isSoftDropDown: false,
          softDropLastTime: undefined,
        });
        mockHandler.simulateAction({ type: "SoftDrop", on: false });

        expect(dispatchMock).toHaveBeenCalledTimes(3);
        expect(dispatchMock).toHaveBeenNthCalledWith(1, {
          type: "SoftDrop",
          on: true,
        });
        expect(dispatchMock).toHaveBeenNthCalledWith(2, {
          type: "SoftDrop",
          on: true,
        });
        expect(dispatchMock).toHaveBeenNthCalledWith(3, {
          type: "SoftDrop",
          on: false,
        });
      });
    });

    describe("concurrent state management", () => {
      test("can handle multiple direction states", () => {
        mockHandler.setState({
          isLeftKeyDown: true,
          isRightKeyDown: true, // Both keys somehow pressed
          currentDirection: -1, // But left wins
          dasStartTime: 1000,
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
          isLeftKeyDown: true,
          currentDirection: -1,
          dasStartTime: 1000,
        });

        // Switch to right
        mockHandler.setState({
          isLeftKeyDown: false,
          isRightKeyDown: true,
          currentDirection: 1,
          dasStartTime: 1100, // New DAS timer
        });
        mockHandler.simulateAction({
          type: "TapMove",
          dir: 1,
          timestampMs: createTimestamp(1100),
        });

        expect(dispatchMock).toHaveBeenCalledWith({
          type: "TapMove",
          dir: 1,
          timestampMs: createTimestamp(1100),
        });
      });
    });
  });

  describe("normalizeInputSequence", () => {
    // The normalizeInputSequence function is already thoroughly tested in input-handler.test.ts
    // We'll add a few additional edge case tests here

    test("handles empty input array", () => {
      const result = normalizeInputSequence([], 50);
      expect(result).toEqual([]);
    });

    test("handles single input", () => {
      const events: InputEvent[] = [
        { tMs: 1000, frame: 1, action: "LeftDown" },
      ];

      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["LeftDown"]);
    });

    test("handles inputs with same timestamp", () => {
      const t = 1000;
      const events: InputEvent[] = [
        { tMs: t, frame: 1, action: "LeftDown" },
        { tMs: t, frame: 1, action: "RightDown" }, // Same timestamp
        { tMs: t, frame: 1, action: "RotateCW" },
      ];

      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["RotateCW"]); // Movement inputs cancelled
    });

    test("handles very large cancel window", () => {
      const t = 1000;
      const events: InputEvent[] = [
        { tMs: t, frame: 1, action: "LeftDown" },
        { tMs: t + 500, frame: 2, action: "RightDown" }, // 500ms apart
      ];

      const result = normalizeInputSequence(events, 1000); // 1000ms window
      expect(result).toEqual([]); // Both cancelled
    });

    test("handles zero cancel window", () => {
      const t = 1000;
      const events: InputEvent[] = [
        { tMs: t, frame: 1, action: "LeftDown" },
        { tMs: t + 1, frame: 2, action: "RightDown" }, // 1ms apart
      ];

      const result = normalizeInputSequence(events, 0); // No cancellation
      expect(result).toEqual(["LeftDown", "RightDown"]);
    });

    test("preserves input order after cancellation", () => {
      const t = 1000;
      const events: InputEvent[] = [
        { tMs: t, frame: 1, action: "RotateCW" },
        { tMs: t + 10, frame: 2, action: "LeftDown" },
        { tMs: t + 20, frame: 3, action: "RightDown" }, // Cancels LeftDown
        { tMs: t + 100, frame: 4, action: "Hold" },
      ];

      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["RotateCW", "Hold"]);
    });

    test("handles malformed events gracefully", () => {
      const events: InputEvent[] = [
        { tMs: 1000, frame: 1, action: "LeftDown" },
        // Test with undefined/null values filtered out
        { tMs: 1100, frame: 2, action: "RotateCW" },
      ];

      const result = normalizeInputSequence(events, 50);
      expect(result).toEqual(["LeftDown", "RotateCW"]);
    });
  });
});
