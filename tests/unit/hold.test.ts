import { describe, it, expect } from "@jest/globals";

import { type GameState } from "../../src/state/types";
import { createSeed } from "../../src/types/brands";
import { createTimestamp, fromNow } from "../../src/types/timestamp";
import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";
import { assertActivePiece } from "../test-helpers";

// Helper to create a test game state
function createTestState(): GameState {
  return reducer(undefined, {
    seed: createSeed("test"),
    timestampMs: fromNow(),
    type: "Init",
  });
}

// Helper to create state with active piece and next queue
function createStateWithPiece(): GameState {
  const state = createTestState();
  return reducer(state, { piece: "T", type: "Spawn" });
}

describe("hold system", () => {
  describe("first hold (no piece in hold slot)", () => {
    it("should hold current piece and spawn next from queue", () => {
      const state = createStateWithPiece();
      expect(state.active?.id).toBe("T");
      expect(state.hold).toBeUndefined();
      expect(state.canHold).toBe(true);
      expect(state.nextQueue.length).toBe(5);

      const nextPiece = state.nextQueue[0];
      const newState = reducer(state, { type: "Hold" });

      expect(newState.hold).toBe("T");
      expect(newState.active?.id).toBe(nextPiece);
      expect(newState.canHold).toBe(false);
      expect(newState.nextQueue.length).toBe(5); // Refilled
      expect(newState.nextQueue[0]).not.toBe(nextPiece); // Queue shifted
    });

    it("should refill next queue when holding", () => {
      const state = createStateWithPiece();
      const originalQueueLength = state.nextQueue.length;

      const newState = reducer(state, { type: "Hold" });

      expect(newState.nextQueue.length).toBe(originalQueueLength);
    });

    it("should reset lock delay and gravity timer on hold", () => {
      let state = createStateWithPiece();
      state = {
        ...state,
        physics: {
          ...state.physics,
          lastGravityTime: createTimestamp(500),
          lockDelayStartTime: createTimestamp(1000),
        },
      };

      const newState = reducer(state, { type: "Hold" });

      expect(newState.physics.lockDelayStartTime).toBeNull();
      // Hold action should preserve lastGravityTime since reducer is now pure
      expect(newState.physics.lastGravityTime).toBe(
        state.physics.lastGravityTime,
      );
    });
  });

  describe("hold swap (piece already in hold slot)", () => {
    it("should swap current piece with held piece", () => {
      let state = createStateWithPiece();
      const originalFirstInQueue = state.nextQueue[0]; // First piece in queue

      // First hold - should swap T with next piece from queue
      state = reducer(state, { type: "Hold" });
      expect(state.hold).toBe("T");
      assertActivePiece(state);
      expect(state.active.id).toBe(originalFirstInQueue); // Next piece spawned

      // Enable hold and do second hold - should swap current with held T
      state = { ...state, canHold: true };
      const currentPieceId = state.active?.id;
      const newState = reducer(state, { type: "Hold" });

      expect(newState.hold).toBe(currentPieceId);
      assertActivePiece(newState);
      expect(newState.active.id).toBe("T"); // Original piece swapped back
      expect(newState.canHold).toBe(false);
    });

    it("should not affect next queue on swap", () => {
      let state = createStateWithPiece();

      // First hold
      state = reducer(state, { type: "Hold" });
      const queueAfterFirstHold = [...state.nextQueue];

      // Enable hold and swap
      state = { ...state, canHold: true };
      const newState = reducer(state, { type: "Hold" });

      expect(newState.nextQueue).toEqual(queueAfterFirstHold);
    });
  });

  describe("hold restrictions", () => {
    it("should not allow hold when canHold is false", () => {
      let state = createStateWithPiece();
      state = { ...state, canHold: false };

      const newState = reducer(state, { type: "Hold" });

      expect(newState).toBe(state); // No change
    });

    it("should not allow hold when no active piece", () => {
      const state = createTestState();
      expect(state.active).toBeUndefined();

      const newState = reducer(state, { type: "Hold" });

      expect(newState).toBe(state); // No change
    });

    it("should enable hold after piece locks", () => {
      let state = createStateWithPiece();

      // Use hold (disables it)
      state = reducer(state, { type: "Hold" });
      expect(state.canHold).toBe(false);

      // Lock piece (should re-enable hold)
      const newState = reducer(state, {
        timestampMs: createTimestamp(performance.now()),
        type: "Lock",
      });
      expect(newState.canHold).toBe(true);
    });

    it("should enable hold after hard drop", () => {
      let state = createStateWithPiece();

      // Use hold (disables it)
      state = reducer(state, { type: "Hold" });
      expect(state.canHold).toBe(false);

      // Hard drop (should re-enable hold)
      const newState = reducer(state, {
        timestampMs: createTimestamp(1000),
        type: "HardDrop",
      });
      expect(newState.canHold).toBe(true);
    });
  });

  describe("hold with top-out", () => {
    it("should work normally with held piece", () => {
      let state = createStateWithPiece();

      state = {
        ...state,
        hold: "S", // Hold an S piece
      };

      const newState = reducer(state, { type: "Hold" });

      // Should swap successfully
      expect(newState.status).toBe("playing");
      expect(newState.hold).toBe("T"); // Original T piece now held
      expect(newState.active?.id).toBe("S"); // S piece now active
    });

    it("should work normally on first hold", () => {
      const state = createStateWithPiece();

      const newState = reducer(state, { type: "Hold" });

      // Should hold current piece and spawn next from queue
      expect(newState.status).toBe("playing");
      expect(newState.hold).toBe("T"); // T piece held
      expect(newState.active).toBeDefined(); // Next piece spawned
      expect(newState.active?.id).toBe(state.nextQueue[0]); // First from queue
    });
  });

  describe("hold queue management", () => {
    it("should maintain queue size after multiple holds", () => {
      let state = createStateWithPiece();
      const originalQueueSize = state.nextQueue.length;

      // Multiple holds
      state = reducer(state, { type: "Hold" });
      state = { ...state, canHold: true };
      state = reducer(state, { type: "Hold" });
      state = { ...state, canHold: true };
      state = reducer(state, { type: "Hold" });

      expect(state.nextQueue.length).toBe(originalQueueSize);
    });

    it("should ensure 7-bag randomizer continues working after holds", () => {
      let state = createStateWithPiece();
      const pieceCounts = new Map<string, number>();

      // Track pieces while ensuring the queue advances each iteration
      for (let i = 0; i < 20; i++) {
        // Count current active and all pieces in the preview queue
        if (state.active) {
          const piece = state.active.id;
          pieceCounts.set(piece, (pieceCounts.get(piece) ?? 0) + 1);
        }

        for (const queuePiece of state.nextQueue) {
          pieceCounts.set(queuePiece, (pieceCounts.get(queuePiece) ?? 0) + 1);
        }

        // Use hold to exercise hold path
        state = reducer(state, { type: "Hold" });
        // Re-enable hold for the next loop iteration
        state = { ...state, canHold: true };

        // Progress the bag/queue deterministically by locking and spawning
        state = reducer(state, {
          timestampMs: createTimestamp(1000 + i),
          type: "HardDrop",
        });
        state = reducer(state, { type: "Spawn" });
      }

      // With queue progression, all seven piece types should appear
      const pieceTypes = ["I", "O", "T", "S", "Z", "J", "L"];
      for (const piece of pieceTypes) {
        expect(pieceCounts.get(piece) ?? 0).toBeGreaterThanOrEqual(1);
      }

      // We should have counts for all seven unique types
      expect(pieceCounts.size).toBe(7);
    });
  });
});
