import { reducer } from "../../src/state/reducer";
import {
  GameState,
  TimingConfig,
  GameplayConfig,
  Action,
} from "../../src/state/types";
import { createTimestamp } from "../../src/types/timestamp";
import { SevenBagRng } from "../../src/core/rng";
import { assertActivePiece } from "../test-helpers";

describe("Reducer", () => {
  let initialState: GameState;

  beforeEach(() => {
    initialState = reducer(undefined, { type: "Init" });
  });

  describe("Init action", () => {
    it("should create initial state with default values", () => {
      const state = reducer(undefined, { type: "Init" });

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
      const state = reducer(undefined, { type: "Init", seed: customSeed });

      // New system has full RNG state, just check seed property
      expect((state.rng as SevenBagRng & { seed: string }).seed).toBe(
        customSeed,
      );
      expect(state.nextQueue).toHaveLength(5); // Should generate queue
    });

    it("should accept custom timing config", () => {
      const customTiming: Partial<TimingConfig> = {
        dasMs: 200,
        arrMs: 5,
      };
      const state = reducer(undefined, { type: "Init", timing: customTiming });

      expect(state.timing.dasMs).toBe(200);
      expect(state.timing.arrMs).toBe(5);
      expect(state.timing.tickHz).toBe(60); // Should keep default
    });

    it("should accept custom gameplay config", () => {
      const customGameplay: Partial<GameplayConfig> = {
        finesseCancelMs: 100,
      };
      const state = reducer(undefined, {
        type: "Init",
        gameplay: customGameplay,
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
          { type: "Rotate", dir: "CW" },
          { type: "HardDrop", timestampMs: createTimestamp(1100) },
        ],
      };

      const newState = reducer(stateWithActivePiece, {
        type: "Lock",
        timestampMs: createTimestamp(performance.now()),
      });

      expect(newState.active).toBeUndefined();
      expect(newState.canHold).toBe(true);
      expect(newState.processedInputLog).toEqual(
        stateWithActivePiece.processedInputLog,
      ); // processedInputLog is preserved
      expect(newState.tick).toBe(stateWithActivePiece.tick + 1);
    });

    it("should not mutate the original state", () => {
      const originalState = {
        ...initialState,
        tick: 5,
        active: { id: "T" as const, rot: "spawn" as const, x: 4, y: 0 },
      };
      const newState = reducer(originalState, {
        type: "Lock",
        timestampMs: createTimestamp(performance.now()),
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
        type: "Lock",
        timestampMs: createTimestamp(performance.now()),
      });

      expect(newState.hold).toBe("I");
      expect(newState.nextQueue).toEqual(["T", "S", "Z"]);
      expect(newState.status).toBe("playing");
    });
  });

  describe("Tick action", () => {
    it("should increment tick counter", () => {
      const state1 = reducer(initialState, {
        type: "Tick",
        timestampMs: createTimestamp(1),
      });
      expect(state1.tick).toBe(1);

      const state2 = reducer(state1, {
        type: "Tick",
        timestampMs: createTimestamp(1),
      });
      expect(state2.tick).toBe(2);
    });

    it("should not mutate original state", () => {
      const originalTick = initialState.tick;
      const newState = reducer(initialState, {
        type: "Tick",
        timestampMs: createTimestamp(1),
      });

      expect(initialState.tick).toBe(originalTick);
      expect(newState.tick).toBe(originalTick + 1);
      expect(initialState).not.toBe(newState);
    });

    it("should preserve most properties but may move active piece with gravity", () => {
      const stateWithData: GameState = {
        ...initialState,
        active: { id: "T", rot: "spawn", x: 4, y: 0 },
        hold: "I",
        canHold: false,
      };

      const newState = reducer(stateWithData, {
        type: "Tick",
        timestampMs: createTimestamp(performance.now()),
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

  describe("Default case (unknown actions)", () => {
    it("should return state unchanged for unknown action", () => {
      const unknownAction = { type: "UnknownAction" } as unknown as Action;
      const newState = reducer(initialState, unknownAction);

      expect(newState).toBe(initialState); // Should return exact same reference
    });

    it("should handle undefined action gracefully", () => {
      const newState = reducer(initialState, undefined as unknown as Action);

      expect(newState).toBe(initialState);
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
        type: "Lock",
        timestampMs: createTimestamp(performance.now()),
      });
      reducer(initialState, {
        type: "Tick",
        timestampMs: createTimestamp(1),
      });
      reducer(initialState, {
        type: "TapMove",
        dir: 1,
      });

      expect(initialState.board.cells).toEqual(originalCells);
    });

    it("should create new state objects for state changes", () => {
      const newState1 = reducer(initialState, {
        type: "Tick",
        timestampMs: createTimestamp(1),
      });
      const stateWithActive = {
        ...newState1,
        active: { id: "T" as const, rot: "spawn" as const, x: 4, y: 0 },
      };
      const newState2 = reducer(stateWithActive, {
        type: "Lock",
        timestampMs: createTimestamp(performance.now()),
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
        type: "TapMove",
        dir: -1,
        timestampMs: timestamp,
      });

      expect(stateAfterTap.processedInputLog).toHaveLength(1);
      expect(stateAfterTap.processedInputLog[0]).toEqual({
        type: "TapMove",
        dir: -1,
        timestampMs: timestamp,
      });

      // Dispatch RepeatMove action
      const stateAfterRepeat = reducer(stateAfterTap, {
        type: "RepeatMove",
        dir: 1,
        timestampMs: timestamp,
      });

      expect(stateAfterRepeat.processedInputLog).toHaveLength(2);
      expect(stateAfterRepeat.processedInputLog[1]).toEqual({
        type: "RepeatMove",
        dir: 1,
        timestampMs: timestamp,
      });

      // Dispatch HoldMove action
      const stateAfterHold = reducer(stateAfterRepeat, {
        type: "HoldMove",
        dir: -1,
        timestampMs: timestamp,
      });

      expect(stateAfterHold.processedInputLog).toHaveLength(3);
      expect(stateAfterHold.processedInputLog[2]).toEqual({
        type: "HoldMove",
        dir: -1,
        timestampMs: timestamp,
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
        type: "TapMove",
        dir: -1,
        timestampMs: timestamp1,
      });

      state = reducer(state, {
        type: "RepeatMove",
        dir: 1,
        timestampMs: timestamp2,
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
