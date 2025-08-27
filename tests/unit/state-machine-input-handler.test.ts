import { createSevenBagRng } from "../../src/core/rng";
import { defaultKeyBindings } from "../../src/input/keyboard";
import { StateMachineInputHandler } from "../../src/input/StateMachineInputHandler";

import type { PieceRandomGenerator } from "../../src/core/rng-interface";
import type {
  Action,
  GameState,
  Board,
  ActivePiece,
  TimingConfig,
  GameplayConfig,
  Stats,
  PhysicsState,
} from "../../src/state/types";

// Use the active TinyKeys mock via Jest to share state with the module under test
jest.mock("tinykeys");

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

// TinyKeys is mocked above; __mockTinyKeys references the same instance used by handler

describe("StateMachineInputHandler", () => {
  let handler: StateMachineInputHandler;
  let dispatchMock: jest.MockedFunction<(action: Action) => void>;
  let gameState: GameState;

  const createGameState = (overrides: Partial<GameState> = {}): GameState => {
    const board: Board = {
      cells: new Uint8Array(200),
      height: 20,
      width: 10,
    };

    const active: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: 4,
      y: 0,
    };

    const timing: TimingConfig = {
      arrMs: 2,
      dasMs: 133,
      gravityEnabled: true,
      gravityMs: 1000,
      lineClearDelayMs: 400,
      lockDelayMs: 500,
      softDrop: 10,
      tickHz: 60,
    };

    const gameplay: GameplayConfig = {
      finesseCancelMs: 50,
      ghostPieceEnabled: true,
      nextPieceCount: 5,
    };

    const stats: Stats = {
      accuracyPercentage: 0,
      attempts: 0,
      averageInputsPerPiece: 0,
      doubleLines: 0,
      faultsByType: {},
      finesseAccuracy: 0,
      incorrectPlacements: 0,
      linesCleared: 0,
      linesPerMinute: 0,
      longestSessionMs: 0,
      optimalInputs: 0,
      optimalPlacements: 0,
      piecesPerMinute: 0,
      piecesPlaced: 0,
      sessionLinesCleared: 0,
      sessionPiecesPlaced: 0,
      sessionStartMs: 0,
      singleLines: 0,
      startedAtMs: 0,
      tetrisLines: 0,
      timePlayedMs: 0,
      totalFaults: 0,
      totalInputs: 0,
      totalSessions: 0,
      tripleLines: 0,
    };

    const physics: PhysicsState = {
      isSoftDropping: false,
      lastGravityTime: 0,
      lineClearLines: [],
      lineClearStartTime: null,
      lockDelayStartTime: null,
    };

    const rng: PieceRandomGenerator = createSevenBagRng("42");

    return {
      active,
      board,
      canHold: true,
      currentMode: "freePlay",
      finesseFeedback: null,
      gameplay,
      guidance: null,
      hold: undefined,
      modeData: null,
      modePrompt: null,
      nextQueue: ["I", "O", "S"],
      physics,
      processedInputLog: [],
      rng,
      stats,
      status: "playing",
      tick: 0,
      timing,
      ...overrides,
    };
  };

  beforeEach(() => {
    handler = new StateMachineInputHandler(133, 2);
    dispatchMock = jest.fn();
    gameState = createGameState();

    // Reset DOM state
    document.body.className = "";

    // Clear mocks
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    handler.stop();
    jest.clearAllMocks();
  });

  describe("initialization", () => {
    test("constructs with default DAS/ARR values", () => {
      const newHandler = new StateMachineInputHandler();
      const state = newHandler.getState();
      expect(state.currentDirection).toBeUndefined();
      expect(state.dasStartTime).toBeUndefined();
      expect(state.isLeftKeyDown).toBe(false);
      expect(state.isRightKeyDown).toBe(false);
    });

    test("constructs with custom DAS/ARR values", () => {
      const customHandler = new StateMachineInputHandler(100, 5);
      const state = customHandler.getState();
      expect(state.currentDirection).toBeUndefined();
      expect(state.dasStartTime).toBeUndefined();
    });

    test("init sets up handler for dispatching actions", () => {
      handler.init(dispatchMock);

      // Test that the handler is initialized by trying a public method
      // Complete a tap sequence to trigger dispatch
      handler.handleMovement("LeftDown", 1000);
      handler.handleMovement("LeftUp", 1050);
      expect(dispatchMock).toHaveBeenCalled();
    });
  });

  describe("lifecycle methods", () => {
    test("start and stop methods exist and are callable", () => {
      expect(() => handler.start()).not.toThrow();
      expect(() => handler.stop()).not.toThrow();
    });

    test("start resets state", () => {
      handler.start();

      const state = handler.getState();
      expect(state.currentDirection).toBeUndefined();
      expect(state.isSoftDropDown).toBe(false);
    });
  });

  describe("public API functionality", () => {
    beforeEach(() => {
      handler.init(dispatchMock);
    });

    test("handleMovement dispatches TapMove actions immediately on key down", () => {
      // Optimistic movement: TapMove dispatched immediately on key down
      handler.handleMovement("LeftDown", 1000);

      expect(dispatchMock).toHaveBeenCalledWith({
        dir: -1,
        optimistic: true,
        timestampMs: expect.any(Number) as number,
        type: "TapMove",
      });

      // Key up should not dispatch additional TapMove
      dispatchMock.mockClear();
      handler.handleMovement("LeftUp", 1050);

      expect(dispatchMock).not.toHaveBeenCalledWith({
        dir: -1,
        optimistic: expect.any(Boolean) as boolean,
        timestampMs: expect.any(Number) as number,
        type: "TapMove",
      });
    });

    test("handleMovement updates state correctly", () => {
      handler.handleMovement("LeftDown", 1000);

      const state = handler.getState();
      expect(state.isLeftKeyDown).toBe(true);
      expect(state.currentDirection).toBe(-1);
      expect(state.dasStartTime).toBeDefined();
    });

    test("handleMovement processes right movement", () => {
      handler.handleMovement("RightDown", 1000);

      const state = handler.getState();
      expect(state.isRightKeyDown).toBe(true);
      expect(state.currentDirection).toBe(1);
    });

    test("handleMovement processes key up events", () => {
      // Press key first
      handler.handleMovement("LeftDown", 1000);
      expect(handler.getState().isLeftKeyDown).toBe(true);

      // Release key
      handler.handleMovement("LeftUp", 1050);

      const state = handler.getState();
      expect(state.isLeftKeyDown).toBe(false);
      expect(state.currentDirection).toBeUndefined();
    });

    test("setSoftDrop controls soft drop state", () => {
      handler.setSoftDrop(true, 1000);

      expect(handler.getState().isSoftDropDown).toBe(true);
      expect(dispatchMock).toHaveBeenCalledWith({ on: true, type: "SoftDrop" });

      handler.setSoftDrop(false, 1100);

      expect(handler.getState().isSoftDropDown).toBe(false);
      expect(dispatchMock).toHaveBeenCalledWith({
        on: false,
        type: "SoftDrop",
      });
    });
  });

  describe("key bindings management", () => {
    test("getKeyBindings returns default bindings initially", () => {
      const bindings = handler.getKeyBindings();
      expect(bindings).toEqual(defaultKeyBindings());
    });

    test("setKeyBindings updates bindings", () => {
      const customBindings = {
        ...defaultKeyBindings(),
        MoveLeft: ["KeyA"],
        MoveRight: ["KeyD"],
      };

      handler.setKeyBindings(customBindings);

      expect(handler.getKeyBindings()).toEqual(customBindings);
    });

    test("key bindings are isolated from external modifications", () => {
      const bindings = handler.getKeyBindings();
      bindings.MoveLeft = ["TestKey"];

      // Internal bindings should be unchanged
      expect(handler.getKeyBindings().MoveLeft).not.toEqual(["TestKey"]);
    });
  });

  describe("timing configuration", () => {
    test("applyTiming with number parameters", () => {
      handler.applyTiming(100, 3);

      // Test by observing behavior rather than internal state
      handler.init(dispatchMock);
      handler.handleMovement("LeftDown", 1000);
      handler.handleMovement("LeftUp", 1050);

      expect(dispatchMock).toHaveBeenCalled();
    });

    test("applyTiming with timing object", () => {
      handler.applyTiming({ arrMs: 4, dasMs: 150 });

      // Test by observing behavior rather than internal state
      handler.init(dispatchMock);
      handler.handleMovement("LeftDown", 1000);
      handler.handleMovement("LeftUp", 1050);

      expect(dispatchMock).toHaveBeenCalled();
    });
  });

  describe("update method behavior", () => {
    beforeEach(() => {
      handler.init(dispatchMock);
    });

    test("update processes game state", () => {
      expect(() => handler.update(gameState, 1000)).not.toThrow();
    });

    test("update handles different game statuses", () => {
      const topOutState = createGameState({ status: "topOut" });
      expect(() => handler.update(topOutState, 1000)).not.toThrow();
    });

    test("update applies timing from game state", () => {
      const stateWithCustomTiming = createGameState({
        timing: {
          arrMs: 5,
          dasMs: 200,
          gravityEnabled: true,
          gravityMs: 1000,
          lineClearDelayMs: 400,
          lockDelayMs: 500,
          softDrop: 10,
          tickHz: 60,
        },
      });

      expect(() => handler.update(stateWithCustomTiming, 1000)).not.toThrow();
    });
  });

  describe("state reporting", () => {
    test("getState returns consistent state structure", () => {
      const state = handler.getState();

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

    test("getState reflects movement state changes", () => {
      handler.init(dispatchMock);

      handler.handleMovement("LeftDown", 1000);
      const leftState = handler.getState();
      expect(leftState.isLeftKeyDown).toBe(true);
      expect(leftState.currentDirection).toBe(-1);

      handler.handleMovement("LeftUp", 1100);
      const upState = handler.getState();
      expect(upState.isLeftKeyDown).toBe(false);
      expect(upState.currentDirection).toBeUndefined();
    });

    test("getState reflects soft drop state changes", () => {
      handler.init(dispatchMock);

      handler.setSoftDrop(true, 1000);
      expect(handler.getState().isSoftDropDown).toBe(true);

      handler.setSoftDrop(false, 1100);
      expect(handler.getState().isSoftDropDown).toBe(false);
    });
  });

  describe("error handling", () => {
    test("methods handle uninitialized state gracefully", () => {
      const uninitHandler = new StateMachineInputHandler();

      expect(() =>
        uninitHandler.handleMovement("LeftDown", 1000),
      ).not.toThrow();
      expect(() => uninitHandler.setSoftDrop(true, 1000)).not.toThrow();
      expect(() => uninitHandler.update(gameState, 1000)).not.toThrow();
    });

    test("handles direction switching", () => {
      handler.init(dispatchMock);

      // Press left - emits optimistic move
      handler.handleMovement("LeftDown", 1000);
      expect(handler.getState().currentDirection).toBe(-1);
      expect(dispatchMock).toHaveBeenCalledTimes(1); // Optimistic left move

      // Press right (should switch and emit optimistic move)
      handler.handleMovement("RightDown", 1100);
      expect(handler.getState().currentDirection).toBe(1);
      expect(dispatchMock).toHaveBeenCalledTimes(2); // Left optimistic + right optimistic

      // Complete the right tap - no additional dispatch (optimistic already emitted)
      handler.handleMovement("RightUp", 1150);
      expect(dispatchMock).toHaveBeenCalledTimes(2); // Still just the 2 optimistic moves
    });
  });

  describe("modifier key bindings with TinyKeys", () => {
    beforeEach(() => {
      handler.init(dispatchMock);
    });

    afterEach(() => {
      handler.stop();
    });

    test("modifier key normalization is applied correctly", () => {
      // Bind actions to various modifier keys
      const bindings = {
        ...defaultKeyBindings(),
        MoveLeft: ["ShiftLeft"],
        MoveRight: ["ControlRight"],
        RotateCCW: ["MetaRight"],
        RotateCW: ["AltLeft"],
      };

      // This should not throw an error and should work correctly
      expect(() => {
        handler.setKeyBindings(bindings);
        handler.start();
        handler.stop();
      }).not.toThrow();

      // Verify bindings were stored correctly
      const storedBindings = handler.getKeyBindings();
      expect(storedBindings.MoveLeft).toEqual(["ShiftLeft"]);
      expect(storedBindings.MoveRight).toEqual(["ControlRight"]);
      expect(storedBindings.RotateCW).toEqual(["AltLeft"]);
      expect(storedBindings.RotateCCW).toEqual(["MetaRight"]);
    });

    test("left/right modifier variants work as separate keys", () => {
      // Bind different actions to left and right shift variants
      const bindings = {
        ...defaultKeyBindings(),
        MoveLeft: ["ShiftLeft"],
        MoveRight: ["ShiftRight"],
      };

      // Should NOT warn about collisions since they're treated as separate keys now
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
      handler.setKeyBindings(bindings);

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("collision"),
      );

      // Handler should work without issues
      expect(() => {
        handler.start();
        handler.stop();
      }).not.toThrow();

      // Bindings should be stored as provided
      const storedBindings = handler.getKeyBindings();
      expect(storedBindings.MoveLeft).toEqual(["ShiftLeft"]);
      expect(storedBindings.MoveRight).toEqual(["ShiftRight"]);

      consoleSpy.mockRestore();
    });

    test("combo patterns can be set and retrieved", () => {
      // Bind an action to a combo pattern
      const bindings = {
        ...defaultKeyBindings(),
        RotateCCW: ["Control+KeyZ"],
      };

      expect(() => {
        handler.setKeyBindings(bindings);
        handler.start();
        handler.stop();
      }).not.toThrow();

      // Combo should be stored correctly
      const storedBindings = handler.getKeyBindings();
      expect(storedBindings.RotateCCW).toEqual(["Control+KeyZ"]);
    });

    test("mixed modifier and non-modifier bindings work", () => {
      const bindings = {
        ...defaultKeyBindings(),
        MoveLeft: ["ShiftLeft"], // Modifier key
        MoveRight: ["ControlLeft"], // Modifier key
        RotateCCW: ["Control+KeyX"], // Combo pattern
        RotateCW: ["KeyZ"], // Non-modifier key
      };

      expect(() => {
        handler.setKeyBindings(bindings);
        handler.start();
        handler.stop();
      }).not.toThrow();

      // All bindings should be stored correctly
      const storedBindings = handler.getKeyBindings();
      expect(storedBindings.MoveLeft).toEqual(["ShiftLeft"]);
      expect(storedBindings.MoveRight).toEqual(["ControlLeft"]);
      expect(storedBindings.RotateCW).toEqual(["KeyZ"]);
      expect(storedBindings.RotateCCW).toEqual(["Control+KeyX"]);
    });
  });
});
