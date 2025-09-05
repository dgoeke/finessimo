import { createSevenBagRng } from "../../../src/core/rng/seeded";
import { Airborne } from "../../../src/engine/physics/lock-delay.machine";
import { defaultKeyBindings } from "../../../src/input/keyboard/bindings";
import { StateMachineInputHandler } from "../../../src/input/keyboard/handler";
import { createBoardCells } from "../../../src/state/types";
import { createGridCoord, createDurationMs } from "../../../src/types/brands";
import { createTimestamp } from "../../../src/types/timestamp";
import {
  createTestPhysicsState,
  createTestTimingConfig,
} from "../../test-helpers";

import type { PieceRandomGenerator } from "../../../src/core/rng/interface";
import type {
  Action,
  GameState,
  Board,
  ActivePiece,
  TimingConfig,
  GameplayConfig,
  Stats,
  PhysicsState,
} from "../../../src/state/types";

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

describe("StateMachineInputHandler", () => {
  let handler: StateMachineInputHandler;
  let dispatchMock: jest.MockedFunction<(action: Action) => void>;
  let gameState: GameState;

  const createGameState = (overrides: Partial<GameState> = {}): GameState => {
    const board: Board = {
      cells: createBoardCells(),
      height: 20,
      totalHeight: 23,
      vanishRows: 3,
      width: 10,
    };

    const active: ActivePiece = {
      id: "T",
      rot: "spawn",
      x: createGridCoord(4),
      y: createGridCoord(0),
    };

    const timing: TimingConfig = createTestTimingConfig({
      gravityEnabled: true,
      gravityMs: createDurationMs(1000),
      lineClearDelayMs: createDurationMs(400),
    });

    const gameplay: GameplayConfig = {
      finesseCancelMs: createDurationMs(50),
      ghostPieceEnabled: true,
      holdEnabled: true,
      nextPieceCount: 5,
    };

    const stats: Stats = {
      accuracyPercentage: 0,
      attempts: 0,
      averageInputsPerPiece: 0,
      doubleLines: 0,
      faultsByType: {},
      finesseAccuracy: createGridCoord(0),
      incorrectPlacements: 0,
      linesCleared: 0,
      linesPerMinute: 0,
      longestSessionMs: createDurationMs(0),
      optimalInputs: 0,
      optimalPlacements: 0,
      piecesPerMinute: 0,
      piecesPlaced: 0,
      sessionLinesCleared: 0,
      sessionPiecesPlaced: 0,
      sessionStartMs: createTimestamp(1000),
      singleLines: 0,
      startedAtMs: createTimestamp(1000),
      tetrisLines: 0,
      timePlayedMs: createDurationMs(0),
      totalFaults: 0,
      totalInputs: 0,
      totalSessions: 0,
      tripleLines: 0,
    };

    const physics: PhysicsState = createTestPhysicsState({
      isSoftDropping: false,
      lastGravityTime: createTimestamp(1000),
      lineClearLines: [],
      lineClearStartTime: null,
      lockDelay: Airborne(),
    });

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
      pendingLock: null,
      physics,
      processedInputLog: [],
      rng,
      stats,
      status: "playing",
      tick: 0,
      timing,
      ...overrides,
    } as GameState;
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

  describe("safety events", () => {
    test("blur event resets inputs and clears soft drop", () => {
      handler.init(dispatchMock);
      handler.start();
      handler.update(gameState, 1000);

      // Enable soft drop and a direction
      handler.setSoftDrop(true, 1000);
      handler.handleMovement("LeftDown", 1000);

      // Trigger blur (focus loss)
      dispatchMock.mockClear();
      window.dispatchEvent(new Event("blur"));

      const state = handler.getState();
      expect(state.currentDirection).toBeUndefined();
      expect(state.isSoftDropDown).toBe(false);
      // Soft drop release should have been dispatched
      expect(dispatchMock).toHaveBeenCalledWith(
        expect.objectContaining({ on: false, type: "SoftDrop" }),
      );
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
      expect(dispatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          on: true,
          type: "SoftDrop",
        }),
      );

      handler.setSoftDrop(false, 1100);

      expect(handler.getState().isSoftDropDown).toBe(false);
      expect(dispatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          on: false,
          type: "SoftDrop",
        }),
      );
    });

    test("ignores movement when settings overlay is open", () => {
      // Simulate settings overlay open
      document.body.classList.add("settings-open");

      // Ensure handler has dispatch and game state context
      handler.update(gameState, 1000);

      // Attempt a movement; should be ignored
      dispatchMock.mockClear();
      handler.handleMovement("LeftDown", 1000);

      expect(dispatchMock).not.toHaveBeenCalled();
      // State should remain unchanged
      const state = handler.getState();
      expect(state.currentDirection).toBeUndefined();
      expect(state.isLeftKeyDown).toBe(false);
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
      handler.applyTiming({
        arrMs: createDurationMs(4),
        dasMs: createDurationMs(150),
      });

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
        timing: createTestTimingConfig({
          arrMs: createDurationMs(5),
          dasMs: createDurationMs(200),
          gravityEnabled: true,
          gravityMs: createDurationMs(1000),
          lineClearDelayMs: createDurationMs(400),
          lockDelayMs: createDurationMs(500),
          softDrop: 10,
        }),
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

  describe("modifier key bindings", () => {
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
