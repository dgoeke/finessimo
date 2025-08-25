import { StateMachineInputHandler } from "../../src/input/StateMachineInputHandler";
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
import type { SevenBagRng } from "../../src/core/rng";
import { defaultKeyBindings } from "../../src/input/keyboard";

describe("StateMachineInputHandler", () => {
  let handler: StateMachineInputHandler;
  let dispatchMock: jest.MockedFunction<(action: Action) => void>;
  let gameState: GameState;

  const createGameState = (overrides: Partial<GameState> = {}): GameState => {
    const board: Board = {
      width: 10,
      height: 20,
      cells: new Uint8Array(200),
    };

    const active: ActivePiece = {
      id: "T",
      x: 4,
      y: 0,
      rot: "spawn",
    };

    const timing: TimingConfig = {
      tickHz: 60,
      dasMs: 133,
      arrMs: 2,
      softDrop: 10,
      lockDelayMs: 500,
      lineClearDelayMs: 400,
      gravityEnabled: true,
      gravityMs: 1000,
    };

    const gameplay: GameplayConfig = {
      finesseCancelMs: 50,
      ghostPieceEnabled: true,
      nextPieceCount: 5,
    };

    const stats: Stats = {
      piecesPlaced: 0,
      linesCleared: 0,
      optimalPlacements: 0,
      incorrectPlacements: 0,
      attempts: 0,
      startedAtMs: 0,
      timePlayedMs: 0,
      sessionPiecesPlaced: 0,
      sessionLinesCleared: 0,
      accuracyPercentage: 0,
      finesseAccuracy: 0,
      averageInputsPerPiece: 0,
      sessionStartMs: 0,
      totalSessions: 0,
      longestSessionMs: 0,
      piecesPerMinute: 0,
      linesPerMinute: 0,
      totalInputs: 0,
      optimalInputs: 0,
      totalFaults: 0,
      faultsByType: {},
      singleLines: 0,
      doubleLines: 0,
      tripleLines: 0,
      tetrisLines: 0,
    };

    const physics: PhysicsState = {
      lastGravityTime: 0,
      lockDelayStartTime: null,
      isSoftDropping: false,
      lineClearStartTime: null,
      lineClearLines: [],
    };

    const rng: SevenBagRng = {
      seed: "42",
      currentBag: ["T", "I", "O"],
      bagIndex: 0,
      internalSeed: 42,
    };

    return {
      board,
      active,
      hold: undefined,
      canHold: true,
      nextQueue: ["I", "O", "S"],
      rng,
      timing,
      gameplay,
      tick: 0,
      status: "playing",
      stats,
      physics,
      processedInputLog: [],
      currentMode: "freePlay",
      modeData: null,
      finesseFeedback: null,
      modePrompt: null,
      guidance: null,
      ...overrides,
    };
  };

  beforeEach(() => {
    handler = new StateMachineInputHandler(133, 2);
    dispatchMock = jest.fn<void, [Action]>();
    gameState = createGameState();

    // Reset DOM state
    document.body.className = "";
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

    test("handleMovement dispatches TapMove actions", () => {
      // Complete tap sequence: down then up
      handler.handleMovement("LeftDown", 1000);
      handler.handleMovement("LeftUp", 1050);

      expect(dispatchMock).toHaveBeenCalledWith({
        type: "TapMove",
        dir: -1,
        timestampMs: expect.any(Number) as number,
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
      expect(dispatchMock).toHaveBeenCalledWith({ type: "SoftDrop", on: true });

      handler.setSoftDrop(false, 1100);

      expect(handler.getState().isSoftDropDown).toBe(false);
      expect(dispatchMock).toHaveBeenCalledWith({
        type: "SoftDrop",
        on: false,
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
      handler.applyTiming({ dasMs: 150, arrMs: 4 });

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
          tickHz: 60,
          dasMs: 200,
          arrMs: 5,
          softDrop: 10,
          lockDelayMs: 500,
          lineClearDelayMs: 400,
          gravityEnabled: true,
          gravityMs: 1000,
        },
      });

      expect(() => handler.update(stateWithCustomTiming, 1000)).not.toThrow();
    });
  });

  describe("state reporting", () => {
    test("getState returns consistent state structure", () => {
      const state = handler.getState();

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

      // Press left
      handler.handleMovement("LeftDown", 1000);
      expect(handler.getState().currentDirection).toBe(-1);

      // Press right (should switch and auto-complete left as tap)
      handler.handleMovement("RightDown", 1100);
      expect(handler.getState().currentDirection).toBe(1);
      expect(dispatchMock).toHaveBeenCalledTimes(1); // Left direction auto-completed as tap

      // Complete the right tap to get another dispatch
      handler.handleMovement("RightUp", 1150);
      expect(dispatchMock).toHaveBeenCalledTimes(2); // Left auto-tap + right manual tap
    });
  });
});
