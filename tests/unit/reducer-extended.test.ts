import {
  type GameState,
  type Action,
  type Board,
  idx,
} from "../../src/state/types";
import { createTimestamp } from "../../src/types/timestamp";
import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";
import { type InvalidGameState } from "../test-types";

describe("Reducer - Extended Coverage", () => {
  let initialState: GameState;

  beforeEach(() => {
    initialState = reducer(undefined, { seed: "test", type: "Init" });
  });

  describe("Action type coverage", () => {
    it("should handle all defined action types without errors", () => {
      const actions: Array<Action> = [
        { timestampMs: createTimestamp(1), type: "Tick" },
        { type: "Spawn" },
        { dir: -1, optimistic: false, type: "TapMove" },
        { dir: 1, type: "HoldMove" },
        { on: true, type: "SoftDrop" },
        { on: false, type: "SoftDrop" },
        { dir: "CW", type: "Rotate" },
        { dir: "CCW", type: "Rotate" },
        { timestampMs: createTimestamp(1000), type: "HardDrop" },
        { type: "Hold" },
        { timestampMs: createTimestamp(performance.now()), type: "Lock" },
        { lines: [19], type: "ClearLines" },
        { dir: 1, optimistic: false, type: "TapMove" },
        {
          gameplay: { finesseBoopEnabled: true, finesseFeedbackEnabled: false },
          type: "UpdateGameplay",
        },
      ];

      actions.forEach((action) => {
        expect(() => reducer(initialState, action)).not.toThrow();
      });
    });

    it("should return original state for unimplemented actions (no-op)", () => {
      // Spawn is now implemented, so we test with truly unimplemented actions
      const unimplementedActions: Array<Action> = [
        // All actions are now implemented, so this test is no longer relevant
        // Keeping test but with no actions to test
      ];

      unimplementedActions.forEach((action) => {
        const result = reducer(initialState, action);
        expect(result).toBe(initialState); // Should return exact same reference
      });

      // Test that Spawn actually works now
      const spawnResult = reducer(initialState, { type: "Spawn" });
      expect(spawnResult).not.toBe(initialState); // Should create new state
      expect(spawnResult.active).toBeDefined(); // Should spawn a piece
    });
  });

  describe("Init action comprehensive testing", () => {
    it("should create completely fresh state each time", () => {
      const state1 = reducer(undefined, { seed: "test", type: "Init" });
      const state2 = reducer(undefined, { seed: "test", type: "Init" });

      expect(state1).not.toBe(state2); // Different objects
      expect(state1.board.cells).not.toBe(state2.board.cells); // Different arrays

      // Content should be the same except for timestamp fields
      expect(state1.tick).toEqual(state2.tick);
      expect(state1.status).toEqual(state2.status);
      expect(state1.board.width).toEqual(state2.board.width);
      expect(state1.board.height).toEqual(state2.board.height);
      expect(state1.stats.piecesPlaced).toEqual(state2.stats.piecesPlaced);
      expect(state1.stats.totalSessions).toEqual(state2.stats.totalSessions);
      // startedAtMs is now initialized to 0 and set on first Tick
      expect(typeof state1.stats.startedAtMs).toBe("number");
      expect(typeof state2.stats.startedAtMs).toBe("number");
      expect(state1.stats.startedAtMs).toBe(0);
      expect(state2.stats.startedAtMs).toBe(0);
    });

    it("should create empty board with all zeros", () => {
      const state = reducer(undefined, { seed: "test", type: "Init" });

      for (const cell of state.board.cells) {
        expect(cell).toBe(0);
      }
    });

    it("should merge partial timing config correctly", () => {
      const partialTiming = { dasMs: 100 };
      const state = reducer(undefined, {
        seed: "test",
        timing: partialTiming,
        type: "Init",
      });

      expect(state.timing.dasMs).toBe(100); // Overridden
      expect(state.timing.arrMs).toBe(2); // Default
      expect(state.timing.tickHz).toBe(60); // Default
      expect(state.timing.lockDelayMs).toBe(500); // Default
    });

    it("should merge partial gameplay config correctly", () => {
      const partialGameplay = { finesseCancelMs: 75 };
      const state = reducer(undefined, {
        gameplay: partialGameplay,
        seed: "test",
        type: "Init",
      });

      expect(state.gameplay.finesseCancelMs).toBe(75); // Overridden
    });

    it("should handle empty partial configs", () => {
      const state = reducer(undefined, {
        gameplay: {},
        seed: "test",
        timing: {},
        type: "Init",
      });

      // Should use all defaults
      expect(state.timing.dasMs).toBe(133);
      expect(state.timing.arrMs).toBe(2);
      expect(state.gameplay.finesseCancelMs).toBe(50);
    });

    it("should create valid RNG state", () => {
      const state1 = reducer(undefined, { seed: "test", type: "Init" });
      const state2 = reducer(undefined, { seed: "custom", type: "Init" });

      // Check that RNG states are different (based on different seeds)
      expect(state1.rng).toBeDefined();
      expect(state2.rng).toBeDefined();
      expect(state1.rng).not.toBe(state2.rng);

      // Should also generate pieces in queue
      expect(state1.nextQueue).toHaveLength(5);
      expect(state2.nextQueue).toHaveLength(5);
    });
  });

  describe("Tick action detailed testing", () => {
    it("should increment tick from any starting value", () => {
      const stateWithTicks = { ...initialState, tick: 42 };
      const result = reducer(stateWithTicks, {
        timestampMs: createTimestamp(1),
        type: "Tick",
      });

      expect(result.tick).toBe(43);
      expect(result).not.toBe(stateWithTicks); // New object
    });

    it("should preserve all other state when ticking", () => {
      const complexState: GameState = {
        ...initialState,
        active: { id: "T", rot: "spawn", x: 4, y: 0 },
        canHold: false,
        hold: "I",
        nextQueue: ["T", "S", "Z"],
        processedInputLog: [{ dir: "CW", type: "Rotate" }],
        status: "lineClear",
        tick: 10,
      };

      const result = reducer(complexState, {
        timestampMs: createTimestamp(1),
        type: "Tick",
      });

      expect(result.tick).toBe(11);
      expect(result.active).toEqual(complexState.active);
      expect(result.hold).toBe(complexState.hold);
      expect(result.canHold).toBe(complexState.canHold);
      expect(result.nextQueue).toEqual(complexState.nextQueue);
      expect(result.processedInputLog).toEqual(complexState.processedInputLog);
      expect(result.status).toBe(complexState.status);
    });
  });

  describe("Lock action detailed testing", () => {
    it("should reset piece-related state", () => {
      const stateWithPiece: GameState = {
        ...initialState,
        active: { id: "T", rot: "right", x: 5, y: 10 },
        canHold: false,
        processedInputLog: [
          { dir: "CW", type: "Rotate" },
          { dir: 1, optimistic: false, type: "TapMove" },
        ],
        tick: 42,
      };

      const result = reducer(stateWithPiece, {
        timestampMs: createTimestamp(performance.now()),
        type: "Lock",
      });

      expect(result.active).toBeUndefined();
      expect(result.canHold).toBe(true);
      // Lock resolution pipeline performs finesse analysis then clears the input log
      expect(result.processedInputLog).toEqual([]);
      expect(result.tick).toBe(43); // Incremented
    });

    it("should preserve board and other state during lock", () => {
      const modifiedBoard: Board = {
        cells: new Uint8Array(200),
        height: 20,
        width: 10,
      };
      modifiedBoard.cells[idx(5, 19)] = 1; // Add a block

      const stateWithBoard: GameState = {
        ...initialState,
        board: modifiedBoard,
        hold: "S",
        nextQueue: ["I", "O", "T"],
        status: "playing",
      };

      const result = reducer(stateWithBoard, {
        timestampMs: createTimestamp(performance.now()),
        type: "Lock",
      });

      expect(result.board).toBe(modifiedBoard); // Should preserve board reference
      expect(result.nextQueue).toEqual(["I", "O", "T"]);
      expect(result.hold).toBe("S");
      expect(result.status).toBe("playing");
    });

    it("should work when no active piece exists", () => {
      const stateNoPiece = { ...initialState, active: undefined };
      const result = reducer(stateNoPiece, {
        timestampMs: createTimestamp(performance.now()),
        type: "Lock",
      });

      expect(result.active).toBeUndefined();
      expect(result.canHold).toBe(true);
      expect(result.processedInputLog).toEqual([]);
    });
  });

  describe("Action processing and state updates", () => {
    it("should append move actions to processedInputLog when there's an active piece", () => {
      const existingActions: Array<Action> = [
        { dir: -1, optimistic: false, type: "TapMove" },
        { dir: "CW", type: "Rotate" },
      ];

      const stateWithActions = {
        ...initialState,
        active: { id: "T" as const, rot: "spawn" as const, x: 4, y: 0 },
        processedInputLog: existingActions,
      };
      const newAction: Action = { dir: 1, optimistic: false, type: "TapMove" };

      const result = reducer(stateWithActions, newAction);

      expect(result.processedInputLog).toHaveLength(3);
      expect(result.processedInputLog[0]).toEqual(existingActions[0]);
      expect(result.processedInputLog[1]).toEqual(existingActions[1]);
      expect(result.processedInputLog[2]).toEqual(newAction);
    });

    it("should handle all movement action types", () => {
      const moveActions: Array<Action> = [
        { dir: -1, optimistic: false, type: "TapMove" },
        { dir: 1, optimistic: false, type: "TapMove" },
        { dir: -1, type: "HoldMove" },
        { dir: 1, type: "HoldMove" },
        { dir: -1, type: "RepeatMove" },
        { dir: 1, type: "RepeatMove" },
      ];

      let currentState: GameState = {
        ...initialState,
        active: { id: "T" as const, rot: "spawn" as const, x: 4, y: 0 },
      };

      moveActions.forEach((action) => {
        currentState = reducer(currentState, action);
      });

      expect(currentState.processedInputLog).toHaveLength(moveActions.length);
      moveActions.forEach((action, index) => {
        expect(currentState.processedInputLog[index]).toEqual(action);
      });
    });

    it("should preserve exact Action structure in processedInputLog", () => {
      const complexAction: Action = {
        dir: -1,
        type: "HoldMove",
      };

      const stateWithPiece = {
        ...initialState,
        active: { id: "T" as const, rot: "spawn" as const, x: 4, y: 0 },
      };
      const result = reducer(stateWithPiece, complexAction);

      expect(result.processedInputLog).toHaveLength(1);
      expect(result.processedInputLog[0]).toEqual(complexAction);
      // Actions are not deep copied in the reducer, they're passed by reference
      expect(result.processedInputLog[0]).toBe(complexAction);
    });
  });

  describe("State immutability comprehensive testing", () => {
    it("should never modify input state object", () => {
      const originalState = { ...initialState };
      const originalTick = originalState.tick;
      const originalInputLogLength = originalState.processedInputLog.length;
      const originalCanHold = originalState.canHold;

      // Try all actions that modify state
      reducer(originalState, {
        timestampMs: createTimestamp(1),
        type: "Tick",
      });
      reducer(originalState, {
        timestampMs: createTimestamp(performance.now()),
        type: "Lock",
      });
      const stateWithPiece = {
        ...originalState,
        active: { id: "T" as const, rot: "spawn" as const, x: 4, y: 0 },
      };
      reducer(stateWithPiece, {
        dir: -1,
        optimistic: false,
        type: "TapMove",
      });

      // Check that the original state object wasn't modified
      expect(originalState.tick).toBe(originalTick);
      expect(originalState.processedInputLog.length).toBe(
        originalInputLogLength,
      );
      expect(originalState.canHold).toBe(originalCanHold);
    });

    it("should create new objects for nested state changes", () => {
      const stateWithPiece = {
        ...initialState,
        active: { id: "T" as const, rot: "spawn" as const, x: 4, y: 0 },
      };
      const result = reducer(stateWithPiece, {
        dir: -1,
        optimistic: false,
        type: "TapMove",
      });

      expect(result).not.toBe(stateWithPiece);
      expect(result.processedInputLog).not.toBe(
        stateWithPiece.processedInputLog,
      );
      expect(result.board).toBe(stateWithPiece.board); // Board unchanged, can share reference
    });

    it("should handle rapid state changes without corruption", () => {
      let state = initialState;
      let tickCount = 0;

      // Simulate rapid input sequence
      for (let i = 0; i < 100; i++) {
        state = reducer(state, {
          timestampMs: createTimestamp(i + 1),
          type: "Tick",
        });
        tickCount++;

        if (i % 10 === 0) {
          // Add an active piece before attempting to move
          state = {
            ...state,
            active: { id: "T" as const, rot: "spawn" as const, x: 4, y: 0 },
          };
          state = reducer(state, {
            dir: -1,
            optimistic: false,
            type: "TapMove",
          });
        }
        if (i % 20 === 0) {
          // Add an active piece before attempting to lock
          state = {
            ...state,
            active: { id: "T" as const, rot: "spawn" as const, x: 4, y: 0 },
          };
          state = reducer(state, {
            timestampMs: createTimestamp(performance.now()),
            type: "Lock",
          });
          tickCount++; // Lock also increments tick
        }
      }

      expect(state.tick).toBe(tickCount);
      // Lock resolution pipeline clears the input log after analysis
      expect(state.processedInputLog.length).toBe(0);
      expect(state.canHold).toBe(true);
    });
  });

  describe("Error handling and edge cases", () => {
    it("should throw for malformed actions with functional pattern", () => {
      const malformedActions = [
        {},
        { type: "InvalidAction" },
        { type: "Move" }, // Missing dir/source
      ];

      malformedActions.forEach((action) => {
        // With the new functional pattern, malformed actions should throw
        expect(() =>
          reducer(initialState, action as unknown as Action),
        ).toThrow();
      });
    });

    it("should handle TapMove with invalid direction", () => {
      const malformedAction = {
        dir: "invalid",
        optimistic: false,
        type: "TapMove",
      }; // Invalid direction

      expect(() =>
        reducer(initialState, malformedAction as unknown as Action),
      ).not.toThrow();
      const result = reducer(
        initialState,
        malformedAction as unknown as Action,
      );

      // Should return original state unchanged when no active piece or invalid direction
      expect(result).toBe(initialState);
      expect(result.processedInputLog.length).toBe(0);
    });

    it("should handle some corrupt state gracefully", () => {
      // Test only cases that should be handled gracefully
      const handledCorruptStates = [{}];

      handledCorruptStates.forEach((state) => {
        expect(() =>
          reducer(state as InvalidGameState as GameState, {
            timestampMs: createTimestamp(1),
            type: "Tick",
          }),
        ).not.toThrow();
      });
    });

    it("should handle invalid state defensively", () => {
      const invalidStates = [{}, { tick: "not-a-number" }, { tick: null }];

      invalidStates.forEach((invalidState) => {
        // Should not throw
        expect(() =>
          reducer(invalidState as InvalidGameState as GameState, {
            timestampMs: createTimestamp(1),
            type: "Tick",
          }),
        ).not.toThrow();

        // Should return the invalid state unchanged (defensive behavior)
        const result = reducer(invalidState as InvalidGameState as GameState, {
          timestampMs: createTimestamp(1),
          type: "Tick",
        });
        expect(result).toBe(invalidState);
      });
    });

    it("should handle invalid TapMove defensively", () => {
      const invalidStates = [
        {},
        { processedInputLog: "not-an-array" },
        { processedInputLog: null },
      ];

      invalidStates.forEach((invalidState) => {
        expect(() =>
          reducer(invalidState as InvalidGameState as GameState, {
            dir: -1,
            optimistic: false,
            type: "TapMove",
          }),
        ).not.toThrow();

        const result = reducer(invalidState as InvalidGameState as GameState, {
          dir: -1,
          optimistic: false,
          type: "TapMove",
        });
        expect(result).toBe(invalidState);
      });
    });
  });

  describe("UpdateGameplay action", () => {
    it("should update gameplay config with finesse settings", () => {
      const result = reducer(initialState, {
        gameplay: {
          finesseBoopEnabled: true,
          finesseFeedbackEnabled: false,
          ghostPieceEnabled: false,
        },
        type: "UpdateGameplay",
      });

      expect(result.gameplay.finesseFeedbackEnabled).toBe(false);
      expect(result.gameplay.finesseBoopEnabled).toBe(true);
      expect(result.gameplay.ghostPieceEnabled).toBe(false);
      // Preserve existing values
      expect(result.gameplay.finesseCancelMs).toBe(
        initialState.gameplay.finesseCancelMs,
      );
    });

    it("should partially update gameplay config", () => {
      const result = reducer(initialState, {
        gameplay: {
          finesseFeedbackEnabled: false,
        },
        type: "UpdateGameplay",
      });

      expect(result.gameplay.finesseFeedbackEnabled).toBe(false);
      // Other values should remain unchanged
      expect(result.gameplay.finesseBoopEnabled).toBe(
        initialState.gameplay.finesseBoopEnabled,
      );
      expect(result.gameplay.finesseCancelMs).toBe(
        initialState.gameplay.finesseCancelMs,
      );
    });
  });
});
