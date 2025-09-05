import {
  mapKeyToBinding,
  defaultKeyBindings,
  loadBindingsFromStorage,
  saveBindingsToStorage,
  type KeyBindings,
} from "../../../src/input/keyboard/bindings";
import { StateMachineInputHandler } from "../../../src/input/keyboard/handler";
import { type Action, type GameState } from "../../../src/state/types";
import { createDurationMs } from "../../../src/types/brands";

// Mock localStorage
const mockLocalStorage = {
  clear: jest.fn(),
  getItem: jest.fn(),
  setItem: jest.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

// KeyBindingManager is mocked above to isolate from real DOM listeners

describe("StateMachineInputHandler", () => {
  let handler: StateMachineInputHandler;
  let mockDispatch: jest.Mock<undefined, [Action]>;

  beforeEach(() => {
    handler = new StateMachineInputHandler();
    mockDispatch = jest.fn<undefined, [Action]>();

    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    // no-op: rely on handler lifecycle for isolation

    handler.init(mockDispatch);
  });

  afterEach(() => {
    handler.stop();
  });

  describe("initialization and lifecycle", () => {
    it("should initialize without crashing", () => {
      expect(handler).toBeDefined();
    });

    it("start/stop should be callable without errors", () => {
      expect(() => handler.start()).not.toThrow();
      expect(() => handler.stop()).not.toThrow();
    });
  });

  describe("key binding functionality", () => {
    it("should return default key bindings initially", () => {
      const bindings = handler.getKeyBindings();
      expect(bindings.MoveLeft).toEqual(["ArrowLeft", "KeyA"]);
      expect(bindings.MoveRight).toEqual(["ArrowRight", "KeyD"]);
      expect(bindings.SoftDrop).toEqual(["ArrowDown", "KeyS"]);
    });

    it("should update key bindings", () => {
      const newBindings: KeyBindings = {
        ...defaultKeyBindings(),
        MoveLeft: ["KeyQ"],
      };

      handler.setKeyBindings(newBindings);
      const result = handler.getKeyBindings();
      expect(result.MoveLeft).toEqual(["KeyQ"]);
    });

    it("should save bindings to storage when updated", () => {
      const newBindings: KeyBindings = {
        ...defaultKeyBindings(),
        MoveRight: ["KeyE"],
      };

      handler.setKeyBindings(newBindings);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });

  describe("input event handling", () => {
    beforeEach(() => {
      // Provide GameState for StateMachineInputHandler - it needs status: 'playing' to dispatch inputs
      const mockGameState = {
        status: "playing",
        timing: {
          arrMs: createDurationMs(30),
          dasMs: createDurationMs(100),
          softDrop: 10,
        },
      } as GameState;
      handler.update(mockGameState, 1000);
    });

    it("should dispatch input event immediately on key down (optimistic movement)", () => {
      handler.start();
      // Simulate via public API (independent of KeyBindingManager mock)
      handler.handleMovement("LeftDown", 1000);
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ dir: -1, type: "TapMove" }),
      ); // Optimistic movement emitted immediately

      // KEY_UP should not emit additional action
      mockDispatch.mockClear();
      handler.handleMovement("LeftUp", 1050);
      expect(mockDispatch).not.toHaveBeenCalled(); // No duplicate movement
    });

    it("should dispatch input event on key up", () => {
      handler.start();

      handler.handleMovement("LeftUp", 1000);

      // Key up events don't dispatch actions in the new DAS system
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it("should ignore repeated key down events for the same direction", () => {
      handler.start();

      // First down emits optimistic move
      handler.handleMovement("LeftDown", 1000);
      expect(mockDispatch).toHaveBeenCalledTimes(1); // Optimistic move emitted

      // Simulate repeated down (browser key repeat behavior); should be ignored for same direction
      mockDispatch.mockClear();
      handler.handleMovement("LeftDown", 1010);
      expect(mockDispatch).not.toHaveBeenCalled(); // No duplicate optimistic move for same direction
    });

    it("should ignore inputs when settings are open", () => {
      document.body.classList.add("settings-open");
      handler.start();

      handler.handleMovement("LeftDown", 1000);

      expect(mockDispatch).not.toHaveBeenCalled();

      document.body.classList.remove("settings-open");
    });
  });
});

describe("mapKeyToBinding", () => {
  const bindings = defaultKeyBindings();

  it("should map arrow keys to correct bindings", () => {
    expect(mapKeyToBinding("ArrowLeft", bindings)).toBe("MoveLeft");
    expect(mapKeyToBinding("ArrowRight", bindings)).toBe("MoveRight");
    expect(mapKeyToBinding("ArrowDown", bindings)).toBe("SoftDrop");
    expect(mapKeyToBinding("ArrowUp", bindings)).toBe("RotateCW");
  });

  it("should map WASD keys to correct bindings", () => {
    expect(mapKeyToBinding("KeyA", bindings)).toBe("MoveLeft");
    expect(mapKeyToBinding("KeyD", bindings)).toBe("MoveRight");
    expect(mapKeyToBinding("KeyS", bindings)).toBe("SoftDrop");
  });

  it("should return null for unmapped keys", () => {
    expect(mapKeyToBinding("KeyF", bindings)).toBeNull();
    expect(mapKeyToBinding("Enter", bindings)).toBeNull();
  });

  it("should handle custom bindings", () => {
    const customBindings: KeyBindings = {
      ...bindings,
      MoveLeft: ["KeyQ"],
      MoveRight: ["KeyE"],
    };

    expect(mapKeyToBinding("KeyQ", customBindings)).toBe("MoveLeft");
    expect(mapKeyToBinding("KeyE", customBindings)).toBe("MoveRight");
    expect(mapKeyToBinding("ArrowLeft", customBindings)).toBeNull();
  });
});

describe("storage functions", () => {
  beforeEach(() => {
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
  });

  describe("loadBindingsFromStorage", () => {
    it("should return default bindings when no storage", () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      const result = loadBindingsFromStorage();
      expect(result).toEqual(defaultKeyBindings());
    });

    it("should load from consolidated store", () => {
      const storedBindings = { MoveLeft: ["KeyQ"] };
      const store = { keyBindings: storedBindings };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(store));

      const result = loadBindingsFromStorage();
      expect(result.MoveLeft).toEqual(["KeyQ"]);
    });

    it("should fallback to legacy key", () => {
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === "finessimo") return null;
        if (key === "finessimo-keybindings")
          return JSON.stringify({ MoveRight: ["KeyE"] });
        return null;
      });

      const result = loadBindingsFromStorage();
      expect(result.MoveRight).toEqual(["KeyE"]);
    });

    it("should handle parse errors gracefully", () => {
      mockLocalStorage.getItem.mockReturnValue("invalid json");
      const result = loadBindingsFromStorage();
      expect(result).toEqual(defaultKeyBindings());
    });
  });

  describe("saveBindingsToStorage", () => {
    it("should save bindings to consolidated store", () => {
      const bindings: KeyBindings = {
        ...defaultKeyBindings(),
        MoveLeft: ["KeyQ"],
      };

      saveBindingsToStorage(bindings);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "finessimo",
        expect.stringContaining('"keyBindings"'),
      );
    });

    it("should preserve existing store data", () => {
      const existingStore = { someOtherSetting: "value" };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingStore));

      const bindings = defaultKeyBindings();
      saveBindingsToStorage(bindings);

      const setItemCall = mockLocalStorage.setItem.mock.calls[0] as
        | [string, string]
        | undefined;
      if (!setItemCall || typeof setItemCall[1] !== "string") {
        throw new Error("setItem call not found or invalid");
      }
      const savedDataStr = setItemCall[1];
      const savedData = JSON.parse(savedDataStr) as {
        someOtherSetting: string;
        keyBindings: KeyBindings;
      };
      expect(savedData.someOtherSetting).toBe("value");
      expect(savedData.keyBindings).toEqual(bindings);
    });

    it("should handle storage errors gracefully", () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error("Storage full");
      });

      const bindings = defaultKeyBindings();
      expect(() => saveBindingsToStorage(bindings)).not.toThrow();
    });
  });
});
