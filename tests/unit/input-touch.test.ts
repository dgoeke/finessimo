import { TouchInputHandler } from "../../src/input/touch";
import { type Action, type KeyAction } from "../../src/state/types";

// Mock DOM APIs for touch support
Object.defineProperty(window, "ontouchstart", {
  value: {},
  writable: true,
});

// Interface for accessing private methods in tests
type TouchInputHandlerTestable = {
  triggerAction(action: KeyAction, phase: "down" | "up"): void;
};

describe("TouchInputHandler", () => {
  let handler: TouchInputHandler;
  let mockDispatch: jest.Mock<void, [Action]>;

  beforeEach(() => {
    // Provide a board-frame container like the app layout
    document.body.innerHTML = '<div class="board-frame"></div>';

    handler = new TouchInputHandler();
    mockDispatch = jest.fn<undefined, [Action]>();
    handler.init(mockDispatch);

    // TouchInputHandler update method now requires gameState and timestamp
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
    test("should dispatch InputEvent for non-movement actions", () => {
      handler.start();

      // Access private method for testing via type assertion
      const testableHandler = handler as unknown as TouchInputHandlerTestable;
      testableHandler.triggerAction("RotateCW", "down");

      // Should dispatch Rotate action for non-movement actions
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          dir: "CW",
          type: "Rotate",
        }),
      );
    });

    test("should not dispatch EnqueueInput for movement actions directly", () => {
      handler.start();

      const testableHandler = handler as unknown as TouchInputHandlerTestable;
      testableHandler.triggerAction("LeftDown", "down");

      // Movement actions should be handled by the StateMachineInputHandler
      // and not dispatch any actions directly from touch handler
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    test("should dispatch up events for soft drop actions", () => {
      handler.start();

      const testableHandler = handler as unknown as TouchInputHandlerTestable;
      testableHandler.triggerAction("SoftDropDown", "up");

      // Should dispatch SoftDrop action with on: false
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          on: false,
          type: "SoftDrop",
        }),
      );
    });
  });

  describe("key bindings interface", () => {
    test("should return default key bindings from state machine handler", () => {
      const bindings = handler.getKeyBindings();
      expect(bindings.MoveLeft).toEqual(["ArrowLeft", "KeyA"]);
      expect(bindings.MoveRight).toEqual(["ArrowRight", "KeyD"]);
      expect(bindings.SoftDrop).toEqual(["ArrowDown", "KeyS"]);
    });

    test("setKeyBindings should update state machine handler bindings", () => {
      const customBindings = {
        HardDrop: ["Space"],
        Hold: ["KeyC"],
        MoveLeft: ["KeyA"],
        MoveRight: ["KeyD"],
        RotateCCW: ["KeyZ"],
        RotateCW: ["KeyX"],
        SoftDrop: ["KeyS"],
      };

      handler.setKeyBindings(customBindings);
      const updatedBindings = handler.getKeyBindings();

      expect(updatedBindings.MoveLeft).toEqual(["KeyA"]);
      expect(updatedBindings.MoveRight).toEqual(["KeyD"]);
      expect(updatedBindings.SoftDrop).toEqual(["KeyS"]);
      expect(updatedBindings.HardDrop).toEqual(["Space"]);
      expect(updatedBindings.RotateCW).toEqual(["KeyX"]);
      expect(updatedBindings.RotateCCW).toEqual(["KeyZ"]);
      expect(updatedBindings.Hold).toEqual(["KeyC"]);
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
