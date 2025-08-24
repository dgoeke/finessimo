import { TouchInputHandler } from "../../src/input/touch";
import { Action, GameState, KeyAction } from "../../src/state/types";

// Mock DOM APIs for touch support
Object.defineProperty(window, "ontouchstart", {
  value: {},
  writable: true,
});

// Interface for accessing private methods in tests
interface TouchInputHandlerTestable {
  triggerAction(action: KeyAction, phase: "down" | "up"): void;
}

describe("TouchInputHandler", () => {
  let handler: TouchInputHandler;
  let mockDispatch: jest.Mock<void, [Action]>;

  beforeEach(() => {
    // Provide a board-frame container like the app layout
    document.body.innerHTML = '<div class="board-frame"></div>';

    handler = new TouchInputHandler();
    mockDispatch = jest.fn<void, [Action]>();
    handler.init(mockDispatch);

    // Provide GameState for InputProcessor
    const mockGameState = {
      timing: { dasMs: 100, arrMs: 30, softDrop: 10 },
    } as GameState;
    handler.update(mockGameState, 1000);
  });

  afterEach(() => {
    handler.stop();
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  describe("initialization and lifecycle", () => {
    test("should initialize without crashing", () => {
      expect(handler).toBeDefined();
    });

    test("start creates touch controls overlay", () => {
      handler.start();
      const overlay = document.querySelector("#touch-controls");
      expect(overlay).toBeTruthy();
      expect(overlay?.classList.contains("touch-controls-overlay")).toBe(true);
    });

    test("stop removes touch controls overlay", () => {
      handler.start();
      const overlay = document.querySelector("#touch-controls");
      expect(overlay).toBeTruthy();

      handler.stop();
      const overlayAfter = document.querySelector("#touch-controls");
      expect(overlayAfter).toBeFalsy();
    });

    test("should not create controls if no touch support", () => {
      // Remove touch support by deleting the property
      const windowWithTouch = window as Window & { ontouchstart?: unknown };
      delete windowWithTouch.ontouchstart;

      const handlerNoTouch = new TouchInputHandler();
      handlerNoTouch.init(mockDispatch);
      handlerNoTouch.start();

      const overlay = document.querySelector("#touch-controls");
      expect(overlay).toBeFalsy();

      handlerNoTouch.stop();

      // Restore touch support for other tests
      Object.defineProperty(window, "ontouchstart", {
        value: {},
        writable: true,
      });
    });
  });

  describe("touch zone creation", () => {
    test("should create all expected touch zones", () => {
      handler.start();

      const zones = document.querySelectorAll("[data-action]");
      expect(zones.length).toBeGreaterThan(0);

      // Check for key zones
      expect(document.querySelector('[data-action="LeftDown"]')).toBeTruthy();
      expect(document.querySelector('[data-action="RightDown"]')).toBeTruthy();
      expect(
        document.querySelector('[data-action="SoftDropDown"]'),
      ).toBeTruthy();
      expect(document.querySelector('[data-action="HardDrop"]')).toBeTruthy();
      expect(document.querySelector('[data-action="RotateCW"]')).toBeTruthy();
      expect(document.querySelector('[data-action="RotateCCW"]')).toBeTruthy();
      expect(document.querySelector('[data-action="Hold"]')).toBeTruthy();
    });
  });

  describe("input event dispatching", () => {
    test("should dispatch InputEvent when triggerAction is called", () => {
      handler.start();

      // Access private method for testing via type assertion
      const testableHandler = handler as unknown as TouchInputHandlerTestable;
      testableHandler.triggerAction("LeftDown", "down");

      // Should dispatch EnqueueInput for logging
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "EnqueueInput",
        event: {
          action: "LeftDown",
          frame: expect.anything() as number,
          tMs: expect.anything() as number,
        },
      });
    });

    test("should dispatch up events for movement actions", () => {
      handler.start();

      const testableHandler = handler as unknown as TouchInputHandlerTestable;
      testableHandler.triggerAction("LeftDown", "up");

      // Should dispatch EnqueueInput with LeftUp action
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "EnqueueInput",
        event: {
          action: "LeftUp",
          frame: expect.anything() as number,
          tMs: expect.anything() as number,
        },
      });
    });

    test("should dispatch up events for soft drop actions", () => {
      handler.start();

      const testableHandler = handler as unknown as TouchInputHandlerTestable;
      testableHandler.triggerAction("SoftDropDown", "up");

      // Should dispatch EnqueueInput with SoftDropUp action
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "EnqueueInput",
        event: {
          action: "SoftDropUp",
          frame: expect.anything() as number,
          tMs: expect.anything() as number,
        },
      });
    });
  });

  describe("key bindings interface", () => {
    test("should return empty key bindings (not applicable for touch)", () => {
      const bindings = handler.getKeyBindings();
      expect(bindings.MoveLeft).toEqual([]);
      expect(bindings.MoveRight).toEqual([]);
      expect(bindings.SoftDrop).toEqual([]);
    });

    test("setKeyBindings should be a no-op", () => {
      const emptyBindings = handler.getKeyBindings();
      handler.setKeyBindings({
        MoveLeft: ["KeyA"],
        MoveRight: ["KeyD"],
        SoftDrop: ["KeyS"],
        HardDrop: ["Space"],
        RotateCW: ["KeyX"],
        RotateCCW: ["KeyZ"],
        Hold: ["KeyC"],
      });
      // Should still return empty bindings
      expect(handler.getKeyBindings()).toEqual(emptyBindings);
    });
  });

  describe("event listener management", () => {
    test("should not double-bind listeners on multiple start calls", () => {
      const addSpy = jest.spyOn(EventTarget.prototype, "addEventListener");

      handler.start();
      const firstCallCount = addSpy.mock.calls.length;

      handler.start(); // Second start call
      const secondCallCount = addSpy.mock.calls.length;

      // Should not have added more listeners
      expect(secondCallCount).toBe(firstCallCount);

      addSpy.mockRestore();
    });
  });
});
