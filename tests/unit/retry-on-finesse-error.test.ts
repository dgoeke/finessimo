import { gameModeRegistry } from "../../src/modes";
import { runLockPipeline } from "../../src/modes/lock-pipeline";
import { reducer } from "../../src/state/reducer";
import {
  createSeed,
  createGridCoord,
  createDurationMs,
} from "../../src/types/brands";
import { createTimestamp, fromNow } from "../../src/types/timestamp";
import {
  createTestRetryAction,
  createTestSoftDropAction,
  createTestSpawnAction,
} from "../test-helpers";

import type { FinesseResult } from "../../src/finesse/calculator";
import type { GameState, Action } from "../../src/state/types";

describe("Retry on finesse error", () => {
  let initialState: GameState;

  beforeEach(() => {
    initialState = reducer(undefined, {
      gameplay: {
        finesseCancelMs: createDurationMs(50),
        retryOnFinesseError: true, // Enable retry functionality
      },
      mode: "freePlay",
      seed: createSeed("test-seed-retry"),
      timestampMs: fromNow(),
      type: "Init",
    });
  });

  describe("Lock Pipeline", () => {
    it("should commit when retryOnFinesseError is disabled", () => {
      // Setup state with retry disabled
      const state = reducer(initialState, {
        gameplay: { retryOnFinesseError: false },
        type: "UpdateGameplay",
      });

      // Spawn piece and perform hard drop to create pending lock
      const withPiece = reducer(state, createTestSpawnAction("T"));
      const hardDropState = reducer(withPiece, {
        timestampMs: createTimestamp(100),
        type: "HardDrop",
      });

      expect(hardDropState.status).toBe("resolvingLock");
      expect(hardDropState.pendingLock).toBeTruthy();

      let resultState = hardDropState;
      const mockAnalyzer = (_state: GameState) => ({
        actions: [
          {
            feedback: {
              faults: [],
              kind: "faulty",
              optimalSequences: [["MoveLeft", "HardDrop"]],
              playerSequence: [],
            },
            type: "UpdateFinesseFeedback",
          },
        ] as Array<Action>,
        result: {
          faults: [],
          kind: "faulty",
          optimalSequences: [["MoveLeft", "HardDrop"]], // Simulate suboptimal play
          playerSequence: ["HardDrop"],
        } as FinesseResult,
      });

      // Run pipeline - should commit despite suboptimal play
      runLockPipeline(
        resultState,
        (action) => {
          resultState = reducer(resultState, action);
        },
        mockAnalyzer,
        createTimestamp(100),
      );

      // Should be committed, not retried
      expect(resultState.status).toBe("playing");
      expect(resultState.pendingLock).toBeNull();
      expect(resultState.active).toBeUndefined(); // No active piece after commit
    });

    it("should retry when retryOnFinesseError is enabled and hard drop is suboptimal", () => {
      // Spawn piece and perform hard drop to create pending lock
      const withPiece = reducer(initialState, createTestSpawnAction("T"));
      const hardDropState = reducer(withPiece, {
        timestampMs: createTimestamp(100),
        type: "HardDrop",
      });

      expect(hardDropState.status).toBe("resolvingLock");
      expect(hardDropState.pendingLock).toBeTruthy();
      expect(hardDropState.pendingLock?.source).toBe("hardDrop");

      let resultState = hardDropState;
      const mockAnalyzer = (_state: GameState) => ({
        actions: [
          {
            feedback: {
              faults: [],
              kind: "faulty",
              optimalSequences: [["MoveLeft", "HardDrop"]],
              playerSequence: [],
            },
            type: "UpdateFinesseFeedback",
          },
        ] as Array<Action>,
        result: {
          faults: [],
          kind: "faulty",
          optimalSequences: [["MoveLeft", "HardDrop"]], // Simulate suboptimal play
          playerSequence: ["HardDrop"],
        } as FinesseResult,
      });

      // Run pipeline - should retry due to suboptimal play
      runLockPipeline(
        resultState,
        (action) => {
          resultState = reducer(resultState, action);
        },
        mockAnalyzer,
        createTimestamp(100),
      );

      // Should be retried - piece back at spawn position
      expect(resultState.status).toBe("playing");
      expect(resultState.pendingLock).toBeNull();
      expect(resultState.active).toBeTruthy();
      expect(resultState.active?.id).toBe("T");
      expect(resultState.active?.x).toBe(3); // T piece spawn X position
      expect(resultState.active?.y).toBe(-2); // T piece spawn Y position
      expect(resultState.canHold).toBe(true); // Hold should be unlocked
    });

    it("should commit when hard drop is optimal, even with retry enabled", () => {
      // Spawn piece and perform hard drop to create pending lock
      const withPiece = reducer(initialState, createTestSpawnAction("T"));
      const hardDropState = reducer(withPiece, {
        timestampMs: createTimestamp(100),
        type: "HardDrop",
      });

      let resultState = hardDropState;
      const mockAnalyzer = (_state: GameState) => ({
        actions: [
          {
            feedback: {
              kind: "optimal",
              optimalSequences: [["HardDrop"]],
              playerSequence: [],
            },
            type: "UpdateFinesseFeedback",
          },
        ] as Array<Action>,
        result: {
          kind: "optimal",
          optimalSequences: [["HardDrop"]],
          playerSequence: ["HardDrop"],
        } as FinesseResult,
      });

      // Run pipeline - should commit due to optimal play
      runLockPipeline(
        resultState,
        (action) => {
          resultState = reducer(resultState, action);
        },
        mockAnalyzer,
        createTimestamp(100),
      );

      // Should be committed, not retried
      expect(resultState.status).toBe("playing");
      expect(resultState.pendingLock).toBeNull();
      expect(resultState.active).toBeUndefined(); // No active piece after commit
    });

    it("should commit for non-hard-drop locks even with retry enabled and suboptimal play", () => {
      // Spawn piece
      let state = reducer(initialState, createTestSpawnAction("T"));

      // Move piece down to a lockable position
      for (let i = 0; i < 22; i++) {
        const moved = reducer(state, createTestSoftDropAction(true));
        if (moved.active) {
          state = moved;
        } else {
          break;
        }
      }

      // Turn off soft drop
      state = reducer(state, createTestSoftDropAction(false));

      // Create a gravity lock (not hard drop)
      const lockState = reducer(state, {
        timestampMs: createTimestamp(100),
        type: "Lock",
      });

      expect(lockState.status).toBe("resolvingLock");
      expect(lockState.pendingLock?.source).toBe("gravity"); // Not hard drop

      let resultState = lockState;
      const mockAnalyzer = (_state: GameState) => ({
        actions: [
          {
            feedback: {
              faults: [],
              kind: "faulty",
              optimalSequences: [["MoveLeft", "SoftDrop"]],
              playerSequence: [],
            },
            type: "UpdateFinesseFeedback",
          },
        ] as Array<Action>,
        result: {
          faults: [],
          kind: "faulty",
          optimalSequences: [["MoveLeft", "SoftDrop"]],
          playerSequence: ["SoftDrop"],
        } as FinesseResult,
      });

      // Run pipeline - should commit because it's not a hard drop
      runLockPipeline(
        resultState,
        (action) => {
          resultState = reducer(resultState, action);
        },
        mockAnalyzer,
        createTimestamp(100),
      );

      // Should be committed, not retried
      expect(resultState.status).toBe("playing");
      expect(resultState.pendingLock).toBeNull();
      expect(resultState.active).toBeUndefined(); // No active piece after commit
    });

    it("should handle finesse feedback actions correctly during retry", () => {
      // Spawn piece and perform hard drop to create pending lock
      const withPiece = reducer(initialState, createTestSpawnAction("T"));
      const hardDropState = reducer(withPiece, {
        timestampMs: createTimestamp(100),
        type: "HardDrop",
      });

      let resultState = hardDropState;
      const dispatchedActions: Array<Action> = [];

      const mockAnalyzer = (_state: GameState) => ({
        actions: [
          {
            feedback: {
              faults: [],
              kind: "faulty",
              optimalSequences: [["MoveLeft", "HardDrop"]],
              playerSequence: [],
            },
            type: "UpdateFinesseFeedback",
          },
          {
            faults: [],
            inputCount: 1,
            kind: "faulty",
            optimalInputCount: 2,
            type: "RecordPieceLock",
          },
          {
            type: "ClearInputLog",
          },
        ] as Array<Action>,
        result: {
          faults: [],
          kind: "faulty",
          optimalSequences: [["MoveLeft", "HardDrop"]],
          playerSequence: ["HardDrop"],
        } as FinesseResult,
      });

      // Run pipeline - should dispatch finesse actions and then retry
      runLockPipeline(
        resultState,
        (action) => {
          dispatchedActions.push(action);
          resultState = reducer(resultState, action);
        },
        mockAnalyzer,
        createTimestamp(100),
      );

      // Check that finesse actions were dispatched before retry
      expect(dispatchedActions).toHaveLength(4); // finesse actions (including ClearInputLog) + retry action
      expect(dispatchedActions[0]?.type).toBe("UpdateFinesseFeedback");
      expect(dispatchedActions[1]?.type).toBe("RecordPieceLock");
      expect(dispatchedActions[2]?.type).toBe("ClearInputLog");
      expect(dispatchedActions[3]?.type).toBe("RetryPendingLock");

      // Final state should be retried
      expect(resultState.status).toBe("playing");
      expect(resultState.active?.id).toBe("T");
    });
  });

  describe("RetryPendingLock Reducer", () => {
    it("should properly restore piece to spawn position", () => {
      // Create a pending lock state
      const withPiece = reducer(initialState, createTestSpawnAction("I"));
      const hardDropState = reducer(withPiece, {
        timestampMs: createTimestamp(100),
        type: "HardDrop",
      });

      // Manually retry the pending lock
      const retriedState = reducer(hardDropState, createTestRetryAction());

      expect(retriedState.status).toBe("playing");
      expect(retriedState.pendingLock).toBeNull();
      expect(retriedState.active).toBeTruthy();
      expect(retriedState.active?.id).toBe("I");
      expect(retriedState.active?.x).toBe(3); // I piece spawn X
      expect(retriedState.active?.y).toBe(-1); // I piece spawn Y
      expect(retriedState.canHold).toBe(true);
      expect(retriedState.physics.lockDelayStartTime).toBeNull();
      expect(retriedState.physics.lineClearLines).toHaveLength(0);
      expect(retriedState.physics.lineClearStartTime).toBeNull();
    });

    it("should not retry when not in resolvingLock status", () => {
      const normalState = reducer(initialState, createTestSpawnAction("T"));
      const result = reducer(normalState, createTestRetryAction());

      // Should be unchanged
      expect(result).toBe(normalState);
    });

    it("should not retry when in playing state (pendingLock is null)", () => {
      const stateWithoutPending = {
        ...initialState,
        pendingLock: null,
        status: "playing" as const,
      } as GameState;

      const result = reducer(stateWithoutPending, createTestRetryAction());

      // Should be unchanged since not in resolvingLock state
      expect(result).toBe(stateWithoutPending);
    });
  });

  describe("Integration with FreePlay Mode", () => {
    it("should use FreePlay mode's onResolveLock decision", () => {
      const mode = gameModeRegistry.get("freePlay");
      expect(mode).toBeTruthy();
      expect(typeof mode?.onResolveLock).toBe("function");

      if (!mode?.onResolveLock) {
        throw new Error("FreePlay mode should have onResolveLock method");
      }

      const testContext = {
        finesse: {
          faults: [],
          kind: "faulty" as const,
          optimalSequences: [["MoveLeft" as const, "HardDrop" as const]],
          playerSequence: ["HardDrop" as const],
        },
        pending: {
          completedLines: [],
          finalPos: {
            id: "T" as const,
            rot: "spawn" as const,
            x: createGridCoord(3),
            y: createGridCoord(18),
          },
          pieceId: "T" as const,
          source: "hardDrop" as const,
          timestampMs: createTimestamp(100),
        },
      };

      // Test commit decision
      const commitDecision = mode.onResolveLock({
        ...testContext,
        state: {
          ...initialState,
          gameplay: { ...initialState.gameplay, retryOnFinesseError: false },
        },
      });

      expect(commitDecision.action).toBe("commit");

      // Test retry decision
      const retryDecision = mode.onResolveLock({
        ...testContext,
        state: {
          ...initialState,
          gameplay: { ...initialState.gameplay, retryOnFinesseError: true },
        },
      });

      expect(retryDecision.action).toBe("retry");
    });
  });
});
