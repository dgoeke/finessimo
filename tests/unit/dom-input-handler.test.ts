import { DOMInputHandler } from "../../src/input/handler";
import { Action, GameState } from "../../src/state/types";
import { reducer } from "../../src/state/reducer";

// Mock DOM APIs
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

Object.defineProperty(document, "addEventListener", {
  writable: true,
  value: mockAddEventListener,
});

Object.defineProperty(document, "removeEventListener", {
  writable: true,
  value: mockRemoveEventListener,
});

describe("DOMInputHandler", () => {
  let handler: DOMInputHandler;
  let mockDispatch: jest.Mock<void, [Action]>;
  let gameState: GameState;
  let mockKeyDownHandler: (event: KeyboardEvent) => void;
  let mockKeyUpHandler: (event: KeyboardEvent) => void;

  beforeEach(() => {
    handler = new DOMInputHandler();
    mockDispatch = jest.fn<void, [Action]>();
    mockAddEventListener.mockClear();
    mockRemoveEventListener.mockClear();

    gameState = reducer(undefined, { type: "Init" });
  });

  afterEach(() => {
    handler.stop();
  });

  describe("Initialization", () => {
    it("should initialize with default state", () => {
      const state = handler.getState();
      expect(state.isLeftKeyDown).toBe(false);
      expect(state.isRightKeyDown).toBe(false);
      expect(state.isSoftDropDown).toBe(false);
      expect(state.currentDirection).toBeUndefined();
      expect(state.dasStartTime).toBeUndefined();
      expect(state.arrLastTime).toBeUndefined();
    });

    it("should store dispatch function on init", () => {
      handler.init(mockDispatch);
      expect(() => handler.update(gameState, 0)).not.toThrow();
    });
  });

  describe("Event Listeners", () => {
    beforeEach(() => {
      handler.init(mockDispatch);
    });

    it("should add event listeners on start", () => {
      handler.start();

      expect(mockAddEventListener).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
      );
      expect(mockAddEventListener).toHaveBeenCalledWith(
        "keyup",
        expect.any(Function),
      );
    });

    it("should remove event listeners on stop", () => {
      handler.start();
      handler.stop();

      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
      );
      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        "keyup",
        expect.any(Function),
      );
    });
  });

  describe("Key Handling Integration", () => {
    beforeEach(() => {
      handler.init(mockDispatch);
      handler.start();

      // Capture the actual event handlers
      const calls = mockAddEventListener.mock.calls as [
        string,
        (e: KeyboardEvent) => void,
      ][];
      const kd = calls.find((c) => c[0] === "keydown")?.[1];
      const ku = calls.find((c) => c[0] === "keyup")?.[1];
      if (!kd || !ku) throw new Error("Keyboard handlers not registered");
      mockKeyDownHandler = kd;
      mockKeyUpHandler = ku;
    });

    it("should handle left movement keys", () => {
      const leftArrowEvent = new KeyboardEvent("keydown", {
        code: "ArrowLeft",
      });
      const pd = jest.spyOn(leftArrowEvent, "preventDefault");

      mockKeyDownHandler(leftArrowEvent);

      // Verify via captured call rather than any-based matcher
      const calls = mockDispatch.mock.calls;
      type Enqueue = Extract<Action, { type: "EnqueueInput" }>;
      const found = calls.find(([a]) => a.type === "EnqueueInput");
      let enqueue: Enqueue | undefined;
      if (found && found[0].type === "EnqueueInput") {
        enqueue = found[0];
      }
      expect(enqueue).toBeDefined();
      if (enqueue) {
        expect(enqueue.type).toBe("EnqueueInput");
        expect(enqueue.event.action).toBe("LeftDown");
      }
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "Move",
        dir: -1,
        source: "tap",
      });
      expect(pd).toHaveBeenCalled();
    });

    it("should handle right movement keys", () => {
      const rightArrowEvent = new KeyboardEvent("keydown", {
        code: "ArrowRight",
      });
      mockKeyDownHandler(rightArrowEvent);

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "Move",
        dir: 1,
        source: "tap",
      });
    });

    it("should handle rotation keys", () => {
      const rotCWEvent = new KeyboardEvent("keydown", { code: "ArrowUp" });
      const rotCCWEvent = new KeyboardEvent("keydown", { code: "KeyZ" });

      mockKeyDownHandler(rotCWEvent);
      mockKeyDownHandler(rotCCWEvent);

      expect(mockDispatch).toHaveBeenCalledWith({ type: "Rotate", dir: "CW" });
      expect(mockDispatch).toHaveBeenCalledWith({ type: "Rotate", dir: "CCW" });
    });

    it("should handle soft drop and key up", () => {
      const downEvent = new KeyboardEvent("keydown", { code: "ArrowDown" });
      const upEvent = new KeyboardEvent("keyup", { code: "ArrowDown" });

      mockKeyDownHandler(downEvent);
      expect(mockDispatch).toHaveBeenCalledWith({ type: "SoftDrop", on: true });

      mockKeyUpHandler(upEvent);
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "SoftDrop",
        on: false,
      });
    });

    it("should handle hard drop and hold keys", () => {
      const spaceEvent = new KeyboardEvent("keydown", { code: "Space" });
      const keyCEvent = new KeyboardEvent("keydown", { code: "KeyC" });

      mockKeyDownHandler(spaceEvent);
      mockKeyDownHandler(keyCEvent);

      expect(mockDispatch).toHaveBeenCalledWith({ type: "HardDrop" });
      expect(mockDispatch).toHaveBeenCalledWith({ type: "Hold" });
    });

    it("should ignore unmapped keys", () => {
      const unmappedEvent = new KeyboardEvent("keydown", { code: "KeyQ" });
      const pd2 = jest.spyOn(unmappedEvent, "preventDefault");

      mockKeyDownHandler(unmappedEvent);

      expect(mockDispatch).not.toHaveBeenCalled();
      expect(pd2).not.toHaveBeenCalled();
    });

    it("should update internal state on key press", () => {
      const leftDownEvent = new KeyboardEvent("keydown", { code: "ArrowLeft" });
      mockKeyDownHandler(leftDownEvent);

      const state = handler.getState();
      expect(state.isLeftKeyDown).toBe(true);
      expect(state.currentDirection).toBe(-1);
      expect(state.dasStartTime).toBeGreaterThan(0);
    });

    it("should handle key up events", () => {
      const leftDownEvent = new KeyboardEvent("keydown", { code: "ArrowLeft" });
      const leftUpEvent = new KeyboardEvent("keyup", { code: "ArrowLeft" });

      mockKeyDownHandler(leftDownEvent);
      mockKeyUpHandler(leftUpEvent);

      const state = handler.getState();
      expect(state.isLeftKeyDown).toBe(false);
      expect(state.currentDirection).toBeUndefined();
    });

    it("should prevent key repeat events", () => {
      const repeatEvent = new KeyboardEvent("keydown", {
        code: "ArrowLeft",
        repeat: true,
      });
      const pd3 = jest.spyOn(repeatEvent, "preventDefault");

      mockKeyDownHandler(repeatEvent);

      expect(pd3).toHaveBeenCalled();
      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });

  describe("DAS/ARR Timing", () => {
    beforeEach(() => {
      handler.init(mockDispatch);
      handler.start();
      jest.useFakeTimers();

      const calls = mockAddEventListener.mock.calls as [
        string,
        (e: KeyboardEvent) => void,
      ][];
      const keyDown = calls.find((c) => c[0] === "keydown");
      if (!keyDown) throw new Error("keydown not registered");
      mockKeyDownHandler = keyDown[1];
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should not trigger DAS immediately", () => {
      const leftDownEvent = new KeyboardEvent("keydown", { code: "ArrowLeft" });
      mockKeyDownHandler(leftDownEvent);

      mockDispatch.mockClear();
      const press = handler.getState().dasStartTime!;
      handler.update(gameState, press + gameState.timing.dasMs - 1);

      expect(mockDispatch).not.toHaveBeenCalledWith({
        type: "Move",
        dir: -1,
        source: "das",
      });
    });

    it("should trigger DAS after delay", () => {
      const leftDownEvent = new KeyboardEvent("keydown", { code: "ArrowLeft" });
      mockKeyDownHandler(leftDownEvent);

      mockDispatch.mockClear();
      const press = handler.getState().dasStartTime!;
      handler.update(gameState, press + gameState.timing.dasMs + 1);

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "Move",
        dir: -1,
        source: "das",
      });
    });

    it("should trigger ARR after initial DAS", () => {
      const leftDownEvent = new KeyboardEvent("keydown", { code: "ArrowLeft" });
      mockKeyDownHandler(leftDownEvent);

      mockDispatch.mockClear();
      // Trigger initial DAS
      const press = handler.getState().dasStartTime!;
      handler.update(gameState, press + gameState.timing.dasMs + 1);

      mockDispatch.mockClear();

      // Trigger ARR
      const arrStart = handler.getState().arrLastTime!;
      handler.update(gameState, arrStart + gameState.timing.arrMs);
      const afterArr = arrStart + gameState.timing.arrMs + 1;
      handler.update(gameState, afterArr);

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "Move",
        dir: -1,
        source: "das",
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle update without dispatch initialized", () => {
      const uninitializedHandler = new DOMInputHandler();
      expect(() => uninitializedHandler.update(gameState, 0)).not.toThrow();
    });

    it("should handle key events without dispatch initialized", () => {
      const uninitializedHandler = new DOMInputHandler();
      uninitializedHandler.start();

      const calls = mockAddEventListener.mock.calls as [
        string,
        (e: KeyboardEvent) => void,
      ][];
      const keyDown = calls.find((c) => c[0] === "keydown");
      const handler = keyDown ? keyDown[1] : undefined;

      const keyEvent = new KeyboardEvent("keydown", { code: "ArrowLeft" });
      expect(() => handler?.(keyEvent)).not.toThrow();
    });

    it("should handle multiple key directions", () => {
      handler.init(mockDispatch);
      handler.start();

      const calls2 = mockAddEventListener.mock.calls as [
        string,
        (e: KeyboardEvent) => void,
      ][];
      const keyDownHandler = calls2.find((c) => c[0] === "keydown")?.[1] as
        | ((e: KeyboardEvent) => void)
        | undefined;
      const keyUpHandler = calls2.find((c) => c[0] === "keyup")?.[1] as
        | ((e: KeyboardEvent) => void)
        | undefined;

      // Press left, then right (right should take priority)
      const leftDownEvent = new KeyboardEvent("keydown", { code: "ArrowLeft" });
      const rightDownEvent = new KeyboardEvent("keydown", {
        code: "ArrowRight",
      });

      keyDownHandler?.(leftDownEvent);
      keyDownHandler?.(rightDownEvent);

      const state = handler.getState();
      expect(state.isLeftKeyDown).toBe(true);
      expect(state.isRightKeyDown).toBe(true);
      expect(state.currentDirection).toBe(1); // Right takes priority

      // Release left - should maintain right direction
      const leftUpEvent = new KeyboardEvent("keyup", { code: "ArrowLeft" });
      keyUpHandler?.(leftUpEvent);

      const stateAfterLeftUp = handler.getState();
      expect(stateAfterLeftUp.currentDirection).toBe(1); // Still right
      expect(stateAfterLeftUp.isLeftKeyDown).toBe(false);

      // Release right - should clear direction
      const rightUpEvent = new KeyboardEvent("keyup", { code: "ArrowRight" });
      keyUpHandler?.(rightUpEvent);

      const finalState = handler.getState();
      expect(finalState.currentDirection).toBeUndefined();
    });
  });
});
