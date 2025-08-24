import { reducer } from "../../src/state/reducer";
import {
  GameState,
  Action,
  InputEvent,
  Board,
  idx,
} from "../../src/state/types";
import { SevenBagRng } from "../../src/core/rng";
import { InvalidGameState } from "../test-types";
import { assertDefined } from "../test-helpers";

describe("Reducer - Extended Coverage", () => {
  let initialState: GameState;

  beforeEach(() => {
    initialState = reducer(undefined, { type: "Init" });
  });

  describe("Action type coverage", () => {
    it("should handle all defined action types without errors", () => {
      const actions: Action[] = [
        { type: "Tick", timestampMs: 0 },
        { type: "Spawn" },
        { type: "Move", dir: -1, source: "tap" },
        { type: "Move", dir: 1, source: "das" },
        { type: "SoftDrop", on: true },
        { type: "SoftDrop", on: false },
        { type: "Rotate", dir: "CW" },
        { type: "Rotate", dir: "CCW" },
        { type: "HardDrop", timestampMs: 1000 },
        { type: "Hold" },
        { type: "Lock", timestampMs: Date.now() },
        { type: "ClearLines", lines: [19] },
        {
          type: "EnqueueInput",
          event: { tMs: 1000, frame: 60, action: "HardDrop" },
        },
      ];

      actions.forEach((action) => {
        expect(() => reducer(initialState, action)).not.toThrow();
      });
    });

    it("should return original state for unimplemented actions (no-op)", () => {
      // Spawn is now implemented, so we test with truly unimplemented actions
      const unimplementedActions: Action[] = [
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
      const state1 = reducer(undefined, { type: "Init" });
      const state2 = reducer(undefined, { type: "Init" });

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
      const state = reducer(undefined, { type: "Init" });

      for (const cell of state.board.cells) {
        expect(cell).toBe(0);
      }
    });

    it("should merge partial timing config correctly", () => {
      const partialTiming = { dasMs: 100 };
      const state = reducer(undefined, { type: "Init", timing: partialTiming });

      expect(state.timing.dasMs).toBe(100); // Overridden
      expect(state.timing.arrMs).toBe(2); // Default
      expect(state.timing.tickHz).toBe(60); // Default
      expect(state.timing.lockDelayMs).toBe(500); // Default
    });

    it("should merge partial gameplay config correctly", () => {
      const partialGameplay = { finesseCancelMs: 75 };
      const state = reducer(undefined, {
        type: "Init",
        gameplay: partialGameplay,
      });

      expect(state.gameplay.finesseCancelMs).toBe(75); // Overridden
    });

    it("should handle empty partial configs", () => {
      const state = reducer(undefined, {
        type: "Init",
        timing: {},
        gameplay: {},
      });

      // Should use all defaults
      expect(state.timing.dasMs).toBe(133);
      expect(state.timing.arrMs).toBe(2);
      expect(state.gameplay.finesseCancelMs).toBe(50);
    });

    it("should create valid RNG state", () => {
      const state1 = reducer(undefined, { type: "Init" });
      const state2 = reducer(undefined, { type: "Init", seed: "custom" });

      // New system creates full RNG state, just check seed property
      expect((state1.rng as SevenBagRng & { seed: string }).seed).toBe(
        "default",
      );
      expect((state2.rng as SevenBagRng & { seed: string }).seed).toBe(
        "custom",
      );

      // Should also generate pieces in queue
      expect(state1.nextQueue).toHaveLength(5);
      expect(state2.nextQueue).toHaveLength(5);
    });
  });

  describe("Tick action detailed testing", () => {
    it("should increment tick from any starting value", () => {
      const stateWithTicks = { ...initialState, tick: 42 };
      const result = reducer(stateWithTicks, { type: "Tick", timestampMs: 0 });

      expect(result.tick).toBe(43);
      expect(result).not.toBe(stateWithTicks); // New object
    });

    it("should preserve all other state when ticking", () => {
      const complexState: GameState = {
        ...initialState,
        tick: 10,
        active: { id: "T", rot: "spawn", x: 4, y: 0 },
        hold: "I",
        canHold: false,
        nextQueue: ["T", "S", "Z"],
        inputLog: [{ tMs: 1000, frame: 60, action: "RotateCW" }],
        status: "lineClear",
      };

      const result = reducer(complexState, { type: "Tick", timestampMs: 0 });

      expect(result.tick).toBe(11);
      expect(result.active).toEqual(complexState.active);
      expect(result.hold).toBe(complexState.hold);
      expect(result.canHold).toBe(complexState.canHold);
      expect(result.nextQueue).toEqual(complexState.nextQueue);
      expect(result.inputLog).toEqual(complexState.inputLog);
      expect(result.status).toBe(complexState.status);
    });
  });

  describe("Lock action detailed testing", () => {
    it("should reset piece-related state", () => {
      const stateWithPiece: GameState = {
        ...initialState,
        active: { id: "T", rot: "right", x: 5, y: 10 },
        canHold: false,
        inputLog: [
          { tMs: 1000, frame: 60, action: "RotateCW" },
          { tMs: 1100, frame: 66, action: "RightDown" },
        ],
        tick: 42,
      };

      const result = reducer(stateWithPiece, {
        type: "Lock",
        timestampMs: Date.now(),
      });

      expect(result.active).toBeUndefined();
      expect(result.canHold).toBe(true);
      expect(result.inputLog).toEqual(stateWithPiece.inputLog); // inputLog is preserved until ClearInputLog action
      expect(result.tick).toBe(43); // Incremented
    });

    it("should preserve board and other state during lock", () => {
      const modifiedBoard: Board = {
        width: 10,
        height: 20,
        cells: new Uint8Array(200),
      };
      modifiedBoard.cells[idx(5, 19)] = 1; // Add a block

      const stateWithBoard: GameState = {
        ...initialState,
        board: modifiedBoard,
        nextQueue: ["I", "O", "T"],
        hold: "S",
        status: "playing",
      };

      const result = reducer(stateWithBoard, {
        type: "Lock",
        timestampMs: Date.now(),
      });

      expect(result.board).toBe(modifiedBoard); // Should preserve board reference
      expect(result.nextQueue).toEqual(["I", "O", "T"]);
      expect(result.hold).toBe("S");
      expect(result.status).toBe("playing");
    });

    it("should work when no active piece exists", () => {
      const stateNoPiece = { ...initialState, active: undefined };
      const result = reducer(stateNoPiece, {
        type: "Lock",
        timestampMs: Date.now(),
      });

      expect(result.active).toBeUndefined();
      expect(result.canHold).toBe(true);
      expect(result.inputLog).toEqual([]);
    });
  });

  describe("EnqueueInput action detailed testing", () => {
    it("should append inputs to existing log", () => {
      const existingEvents: InputEvent[] = [
        { tMs: 1000, frame: 60, action: "LeftDown" },
        { tMs: 1100, frame: 66, action: "RotateCW" },
      ];

      const stateWithInputs = { ...initialState, inputLog: existingEvents };
      const newEvent: InputEvent = { tMs: 1200, frame: 72, action: "HardDrop" };

      const result = reducer(stateWithInputs, {
        type: "EnqueueInput",
        event: newEvent,
      });

      expect(result.inputLog).toHaveLength(3);
      expect(result.inputLog[0]).toEqual(existingEvents[0]);
      expect(result.inputLog[1]).toEqual(existingEvents[1]);
      expect(result.inputLog[2]).toEqual(newEvent);
    });

    it("should handle all KeyAction types", () => {
      const keyActions = [
        "LeftDown",
        "LeftUp",
        "RightDown",
        "RightUp",
        "SoftDropDown",
        "SoftDropUp",
        "HardDrop",
        "RotateCW",
        "RotateCCW",
        "Hold",
      ] as const;

      let currentState = initialState;

      keyActions.forEach((action, index) => {
        const event: InputEvent = {
          tMs: 1000 + index * 100,
          frame: 60 + index * 6,
          action,
        };
        currentState = reducer(currentState, { type: "EnqueueInput", event });
      });

      expect(currentState.inputLog).toHaveLength(keyActions.length);
      keyActions.forEach((action, index) => {
        assertDefined(currentState.inputLog[index]);
        expect(currentState.inputLog[index].action).toBe(action);
      });
    });

    it("should preserve exact InputEvent structure", () => {
      const complexEvent: InputEvent = {
        tMs: 1234.56789,
        frame: 12345,
        action: "RotateCCW",
      };

      const result = reducer(initialState, {
        type: "EnqueueInput",
        event: complexEvent,
      });

      expect(result.inputLog[0]).toEqual(complexEvent);
      expect(result.inputLog[0]).not.toBe(complexEvent); // Should be copied
    });
  });

  describe("State immutability comprehensive testing", () => {
    it("should never modify input state object", () => {
      const originalState = { ...initialState };
      const originalTick = originalState.tick;
      const originalInputLogLength = originalState.inputLog.length;
      const originalCanHold = originalState.canHold;

      // Try all actions that modify state
      reducer(originalState, { type: "Tick", timestampMs: 0 });
      reducer(originalState, { type: "Lock", timestampMs: Date.now() });
      reducer(originalState, {
        type: "EnqueueInput",
        event: { tMs: 1000, frame: 60, action: "HardDrop" },
      });

      // Check that the original state object wasn't modified
      expect(originalState.tick).toBe(originalTick);
      expect(originalState.inputLog.length).toBe(originalInputLogLength);
      expect(originalState.canHold).toBe(originalCanHold);
    });

    it("should create new objects for nested state changes", () => {
      const event: InputEvent = { tMs: 1000, frame: 60, action: "LeftDown" };
      const result = reducer(initialState, { type: "EnqueueInput", event });

      expect(result).not.toBe(initialState);
      expect(result.inputLog).not.toBe(initialState.inputLog);
      expect(result.board).toBe(initialState.board); // Board unchanged, can share reference
    });

    it("should handle rapid state changes without corruption", () => {
      let state = initialState;
      let tickCount = 0;

      // Simulate rapid input sequence
      for (let i = 0; i < 100; i++) {
        state = reducer(state, { type: "Tick", timestampMs: i });
        tickCount++;

        if (i % 10 === 0) {
          state = reducer(state, {
            type: "EnqueueInput",
            event: { tMs: i * 100, frame: i * 6, action: "LeftDown" },
          });
        }
        if (i % 20 === 0) {
          // Add an active piece before attempting to lock
          state = {
            ...state,
            active: { id: "T" as const, rot: "spawn" as const, x: 4, y: 0 },
          };
          state = reducer(state, { type: "Lock", timestampMs: Date.now() });
          tickCount++; // Lock also increments tick
        }
      }

      expect(state.tick).toBe(tickCount);
      // inputLog is no longer cleared on Lock, so it accumulates during rapid inputs
      expect(state.inputLog.length).toBeGreaterThan(0);
      expect(state.canHold).toBe(true);
    });
  });

  describe("Error handling and edge cases", () => {
    it("should handle malformed actions gracefully", () => {
      const malformedActions = [
        null,
        undefined,
        {},
        { type: "InvalidAction" },
        { type: "Move" }, // Missing dir/source
      ];

      malformedActions.forEach((action) => {
        expect(() =>
          reducer(initialState, action as unknown as Action),
        ).not.toThrow();
        const result = reducer(initialState, action as unknown as Action);
        expect(result).toBe(initialState); // Should return unchanged state
      });
    });

    it("should handle EnqueueInput with missing event", () => {
      const malformedAction = { type: "EnqueueInput" }; // Missing event

      expect(() =>
        reducer(initialState, malformedAction as unknown as Action),
      ).not.toThrow();
      const result = reducer(
        initialState,
        malformedAction as unknown as Action,
      );

      // Should return original state unchanged when event is missing
      expect(result).toBe(initialState);
      expect(result.inputLog.length).toBe(0);
    });

    it("should handle some corrupt state gracefully", () => {
      // Test only cases that should be handled gracefully
      const handledCorruptStates = [{}];

      handledCorruptStates.forEach((state) => {
        expect(() =>
          reducer(state as InvalidGameState as GameState, {
            type: "Tick",
            timestampMs: 0,
          }),
        ).not.toThrow();
      });
    });

    it("should handle invalid state defensively", () => {
      const invalidStates = [
        null,
        undefined,
        {},
        { tick: "not-a-number" },
        { tick: null },
        "not-an-object",
      ];

      invalidStates.forEach((invalidState) => {
        // Should not throw
        expect(() =>
          reducer(invalidState as InvalidGameState as GameState, {
            type: "Tick",
            timestampMs: 0,
          }),
        ).not.toThrow();

        // Should return the invalid state unchanged (defensive behavior)
        const result = reducer(invalidState as InvalidGameState as GameState, {
          type: "Tick",
          timestampMs: 0,
        });
        expect(result).toBe(invalidState);
      });
    });

    it("should handle invalid EnqueueInput defensively", () => {
      const invalidStates = [
        null,
        {},
        { inputLog: "not-an-array" },
        { inputLog: null },
      ];

      invalidStates.forEach((invalidState) => {
        expect(() =>
          reducer(invalidState as InvalidGameState as GameState, {
            type: "EnqueueInput",
            event: { tMs: 1000, frame: 60, action: "HardDrop" },
          }),
        ).not.toThrow();

        const result = reducer(invalidState as InvalidGameState as GameState, {
          type: "EnqueueInput",
          event: { tMs: 1000, frame: 60, action: "HardDrop" },
        });
        expect(result).toBe(invalidState);
      });
    });
  });
});
