import {
  type GameState,
  type TimingConfig,
  type GameplayConfig,
  type Action,
} from "../../src/state/types";
import { createTimestamp } from "../../src/types/timestamp";
import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";
import { assertActivePiece } from "../test-helpers";

describe("Reducer", () => {
  let initialState: GameState;

  beforeEach(() => {
    initialState = reducer(undefined, { seed: "test", type: "Init" });
  });

  describe("Init action", () => {
    it("should create initial state with default values", () => {
      const state = reducer(undefined, { seed: "test", type: "Init" });

      expect(state.board).toBeDefined();
      expect(state.board.width).toBe(10);
      expect(state.board.height).toBe(20);
      expect(state.board.cells).toBeInstanceOf(Uint8Array);
      expect(state.board.cells.length).toBe(200);
      expect(state.active).toBeUndefined();
      expect(state.hold).toBeUndefined();
      expect(state.canHold).toBe(true);
      expect(state.nextQueue).toHaveLength(5); // New system pre-fills queue
      expect(state.tick).toBe(0);
      expect(state.status).toBe("playing");
      expect(state.processedInputLog).toEqual([]);
    });

    it("should accept custom seed", () => {
      const customSeed = "test-seed-123";
      const state = reducer(undefined, { seed: customSeed, type: "Init" });

      // Check that RNG state is created
      expect(state.rng).toBeDefined();
      expect(state.nextQueue).toHaveLength(5); // Should generate queue
    });

    it("should accept custom timing config", () => {
      const customTiming: Partial<TimingConfig> = {
        arrMs: 5,
        dasMs: 200,
      };
      const state = reducer(undefined, {
        seed: "test",
        timing: customTiming,
        type: "Init",
      });

      expect(state.timing.dasMs).toBe(200);
      expect(state.timing.arrMs).toBe(5);
      expect(state.timing.tickHz).toBe(60); // Should keep default
    });

    it("should accept custom gameplay config", () => {
      const customGameplay: Partial<GameplayConfig> = {
        finesseCancelMs: 100,
      };
      const state = reducer(undefined, {
        gameplay: customGameplay,
        seed: "test",
        type: "Init",
      });

      expect(state.gameplay.finesseCancelMs).toBe(100);
    });
  });

  describe("Lock action", () => {
    it("should clear active piece and reset hold capability", () => {
      // Set up state with an active piece and used hold
      const stateWithActivePiece: GameState = {
        ...initialState,
        active: { id: "T", rot: "spawn", x: 4, y: 0 },
        canHold: false,
        processedInputLog: [
          { dir: "CW", type: "Rotate" },
          { timestampMs: createTimestamp(1100), type: "HardDrop" },
        ],
      };

      const newState = reducer(stateWithActivePiece, {
        timestampMs: createTimestamp(performance.now()),
        type: "Lock",
      });

      expect(newState.active).toBeUndefined();
      expect(newState.canHold).toBe(true);
      // Lock resolution pipeline performs finesse analysis then clears the input log
      expect(newState.processedInputLog).toEqual([]);
      expect(newState.tick).toBe(stateWithActivePiece.tick + 1);
    });

    it("should not mutate the original state", () => {
      const originalState = {
        ...initialState,
        active: { id: "T" as const, rot: "spawn" as const, x: 4, y: 0 },
        tick: 5,
      };
      const newState = reducer(originalState, {
        timestampMs: createTimestamp(performance.now()),
        type: "Lock",
      });

      expect(originalState.tick).toBe(5);
      expect(newState.tick).toBe(6);
      expect(originalState).not.toBe(newState);
    });

    it("should preserve other state properties", () => {
      const stateWithData: GameState = {
        ...initialState,
        hold: "I",
        nextQueue: ["T", "S", "Z"],
        status: "playing",
      };

      const newState = reducer(stateWithData, {
        timestampMs: createTimestamp(performance.now()),
        type: "Lock",
      });

      expect(newState.hold).toBe("I");
      expect(newState.nextQueue).toEqual(["T", "S", "Z"]);
      expect(newState.status).toBe("playing");
    });
  });

  describe("Tick action", () => {
    it("should increment tick counter", () => {
      const state1 = reducer(initialState, {
        timestampMs: createTimestamp(1),
        type: "Tick",
      });
      expect(state1.tick).toBe(1);

      const state2 = reducer(state1, {
        timestampMs: createTimestamp(1),
        type: "Tick",
      });
      expect(state2.tick).toBe(2);
    });

    it("should not mutate original state", () => {
      const originalTick = initialState.tick;
      const newState = reducer(initialState, {
        timestampMs: createTimestamp(1),
        type: "Tick",
      });

      expect(initialState.tick).toBe(originalTick);
      expect(newState.tick).toBe(originalTick + 1);
      expect(initialState).not.toBe(newState);
    });

    it("should preserve most properties but may move active piece with gravity", () => {
      const stateWithData: GameState = {
        ...initialState,
        active: { id: "T", rot: "spawn", x: 4, y: 0 },
        canHold: false,
        hold: "I",
      };

      const newState = reducer(stateWithData, {
        timestampMs: createTimestamp(performance.now()),
        type: "Tick",
      });

      // Active piece may move due to gravity, but other properties should be preserved
      assertActivePiece(newState);
      assertActivePiece(stateWithData);
      expect(newState.active.id).toBe(stateWithData.active.id);
      expect(newState.active.rot).toBe(stateWithData.active.rot);
      expect(newState.active.x).toBe(stateWithData.active.x);
      // Y may change due to gravity, so we don't test it
      expect(newState.hold).toBe(stateWithData.hold);
      expect(newState.canHold).toBe(stateWithData.canHold);
    });
  });

  describe("Default case (invalid actions)", () => {
    it("should throw for unknown action type due to compile-time exhaustiveness", () => {
      const unknownAction = { type: "UnknownAction" } as unknown as Action;

      // With the new functional pattern, unknown actions are caught at compile-time
      // and should throw at runtime if they somehow get through
      expect(() => reducer(initialState, unknownAction)).toThrow();
    });
  });

  describe("State immutability", () => {
    it("should never mutate the board cells array", () => {
      const originalCells = new Uint8Array(initialState.board.cells);

      // Try various actions that might mutate state
      const stateWithActive = {
        ...initialState,
        active: { id: "T" as const, rot: "spawn" as const, x: 4, y: 0 },
      };
      reducer(stateWithActive, {
        timestampMs: createTimestamp(performance.now()),
        type: "Lock",
      });
      reducer(initialState, {
        timestampMs: createTimestamp(1),
        type: "Tick",
      });
      reducer(initialState, {
        dir: 1,
        optimistic: false,
        type: "TapMove",
      });

      expect(initialState.board.cells).toEqual(originalCells);
    });

    it("should create new state objects for state changes", () => {
      const newState1 = reducer(initialState, {
        timestampMs: createTimestamp(1),
        type: "Tick",
      });
      const stateWithActive = {
        ...newState1,
        active: { id: "T" as const, rot: "spawn" as const, x: 4, y: 0 },
      };
      const newState2 = reducer(stateWithActive, {
        timestampMs: createTimestamp(performance.now()),
        type: "Lock",
      });

      expect(newState1).not.toBe(initialState);
      expect(newState2).not.toBe(stateWithActive);
      expect(newState2).not.toBe(initialState);
    });
  });

  describe("processedInputLog", () => {
    it("should append TapMove, HoldMove, RepeatMove actions to processedInputLog", () => {
      const timestamp = createTimestamp(1000);

      // Start with empty log
      expect(initialState.processedInputLog).toEqual([]);

      // Add an active piece first
      const stateWithPiece = {
        ...initialState,
        active: { id: "T" as const, rot: "spawn" as const, x: 4, y: 0 },
      };

      // Dispatch TapMove action
      const stateAfterTap = reducer(stateWithPiece, {
        dir: -1,
        optimistic: false,
        timestampMs: timestamp,
        type: "TapMove",
      });

      expect(stateAfterTap.processedInputLog).toHaveLength(1);
      expect(stateAfterTap.processedInputLog[0]).toEqual({
        dir: -1,
        optimistic: false,
        timestampMs: timestamp,
        type: "TapMove",
      });

      // Dispatch RepeatMove action
      const stateAfterRepeat = reducer(stateAfterTap, {
        dir: 1,
        timestampMs: timestamp,
        type: "RepeatMove",
      });

      expect(stateAfterRepeat.processedInputLog).toHaveLength(2);
      expect(stateAfterRepeat.processedInputLog[1]).toEqual({
        dir: 1,
        timestampMs: timestamp,
        type: "RepeatMove",
      });

      // Dispatch HoldMove action
      const stateAfterHold = reducer(stateAfterRepeat, {
        dir: -1,
        timestampMs: timestamp,
        type: "HoldMove",
      });

      expect(stateAfterHold.processedInputLog).toHaveLength(3);
      expect(stateAfterHold.processedInputLog[2]).toEqual({
        dir: -1,
        timestampMs: timestamp,
        type: "HoldMove",
      });
    });

    it("should preserve timestamps in processedInputLog", () => {
      const timestamp1 = createTimestamp(1000);
      const timestamp2 = createTimestamp(2000);

      // Add an active piece first
      let state: GameState = {
        ...initialState,
        active: { id: "T" as const, rot: "spawn" as const, x: 4, y: 0 },
      };

      // Dispatch actions with different timestamps
      state = reducer(state, {
        dir: -1,
        optimistic: false,
        timestampMs: timestamp1,
        type: "TapMove",
      });

      state = reducer(state, {
        dir: 1,
        timestampMs: timestamp2,
        type: "RepeatMove",
      });

      expect(state.processedInputLog).toHaveLength(2);
      const firstAction = state.processedInputLog[0];
      const secondAction = state.processedInputLog[1];
      if (firstAction?.type === "TapMove") {
        expect(firstAction.timestampMs).toBe(timestamp1);
      }
      if (secondAction?.type === "RepeatMove") {
        expect(secondAction.timestampMs).toBe(timestamp2);
      }
    });
  });
});
