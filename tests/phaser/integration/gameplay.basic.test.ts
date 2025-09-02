/**
 * Basic gameplay integration tests for Phaser Gameplay scene
 * 
 * Tests core mechanics: spawn, movement, rotation, hard drop, hold, and finesse logging
 */

import { createGameplayHarness } from "../helpers/GameplayHarness";
import { assertActivePiece } from "../../test-helpers";

import type { GameplayHarness } from "../helpers/GameplayHarness";

describe("Basic Gameplay Flow", () => {
  let harness: GameplayHarness;

  beforeEach(() => {
    harness = createGameplayHarness();
  });

  describe("Auto-spawn behavior", () => {
    it("should spawn a piece on first tick when no active piece exists", () => {
      const state = harness.getState();
      expect(state).not.toBeNull();
      expect(state!.active).toBeUndefined();
      
      // Advance one tick
      harness.step();
      
      const newState = harness.getState();
      expect(newState).not.toBeNull();
      expect(newState!.active).toBeDefined();
    });

    it("should not auto-spawn if active piece already exists", () => {
      // First spawn a piece
      harness.spawn("T");
      harness.step();
      
      const state = harness.getState();
      assertActivePiece(state!);
      const initialActive = state.active;
      
      // Advance another tick
      harness.step();
      
      const newState = harness.getState();
      assertActivePiece(newState!);
      expect(newState.active).toBe(initialActive); // Same piece, no new spawn
    });
  });

  describe("Movement controls", () => {
    beforeEach(() => {
      harness.spawn("T");
      harness.step();
    });

    it("should move piece left on MoveLeft input", () => {
      const initialState = harness.getState();
      assertActivePiece(initialState!);
      const initialX = initialState.active.x;

      // Send MoveLeft action
      harness.input.tap(-1);
      harness.step();

      const newState = harness.getState();
      assertActivePiece(newState!);
      expect(newState.active.x).toBe(initialX - 1);
    });

    it("should move piece right on MoveRight input", () => {
      const initialState = harness.getState();
      assertActivePiece(initialState!);  
      const initialX = initialState.active.x;

      // Send MoveRight action
      harness.input.tap(1);
      harness.step();

      const newState = harness.getState();
      assertActivePiece(newState!);
      expect(newState.active.x).toBe(initialX + 1);
    });

    it("should not move outside board boundaries", () => {
      const initialState = harness.getState();
      assertActivePiece(initialState!);
      
      // Try to move far left beyond boundary
      for (let i = 0; i < 20; i++) {
        harness.input.tap(-1);
        harness.step();
      }

      const leftState = harness.getState();
      assertActivePiece(leftState!);
      expect(leftState.active.x).toBeGreaterThanOrEqual(0);

      // Try to move far right beyond boundary
      for (let i = 0; i < 20; i++) {
        harness.input.tap(1);
        harness.step();
      }

      const rightState = harness.getState();
      assertActivePiece(rightState!);
      expect(rightState.active.x).toBeLessThan(10); // Board width is 10
    });
  });

  describe("Rotation controls", () => {
    beforeEach(() => {
      harness.spawn("T");
      harness.step();
    });

    it("should rotate piece clockwise on RotateCW input", () => {
      const initialState = harness.getState();
      assertActivePiece(initialState!);
      const initialRotation = initialState.active.rot;

      harness.input.rotateCW();
      harness.step();

      const newState = harness.getState();
      assertActivePiece(newState!);
      // T pieces can rotate, so rotation should change unless blocked
      expect(newState.active.rot).not.toBe(initialRotation);
    });

    it("should rotate piece counter-clockwise on RotateCCW input", () => {
      const initialState = harness.getState();
      assertActivePiece(initialState!);
      const initialRotation = initialState.active.rot;

      harness.input.rotateCCW();
      harness.step();

      const newState = harness.getState();
      assertActivePiece(newState!);
      expect(newState.active.rot).not.toBe(initialRotation);
    });
  });

  describe("Hard drop behavior", () => {
    beforeEach(() => {
      harness.spawn("T");
      harness.step();
    });

    it("should lock piece and spawn new piece on hard drop", () => {
      const initialState = harness.getState();
      assertActivePiece(initialState!);
      const initialActive = initialState.active;

      harness.input.hardDrop();
      harness.step();

      const newState = harness.getState();
      
      // Piece should be locked (no longer active) and a new piece should spawn
      if (newState!.active) {
        // New piece spawned
        expect(newState!.active).not.toBe(initialActive);
      } else {
        // Piece locked but new one not spawned yet (may need another step)
        harness.step(); 
        const finalState = harness.getState();
        expect(finalState).not.toBeNull();
        expect(finalState!.active).toBeDefined();
      }
    });

    it("should include HardDrop in finesse log and clear after lock", () => {
      harness.input.hardDrop();
      harness.step();
      
      // Allow time for processing and auto-spawn
      harness.stepN(3);

      const state = harness.getState();
      
      // After lock, processed input log should be cleared
      expect(state!.processedInputLog.length).toBe(0);
    });
  });

  describe("Hold piece functionality", () => {
    it("should hold active piece when no piece is held", () => {
      harness.spawn("T");
      harness.step();
      
      const initialState = harness.getState();
      assertActivePiece(initialState!);
      expect(initialState.hold).toBeUndefined();

      // Hold the piece
      harness.input.pushAction({
        type: "Hold"
      });
      harness.step();

      const newState = harness.getState();
      expect(newState).not.toBeNull();
      expect(newState!.hold).toBe("T");
      expect(newState!.active).toBeDefined(); // Should spawn a new piece
    });

    it("should swap active piece with held piece when both exist", () => {
      // First, hold a T piece
      harness.spawn("T");
      harness.step();
      
      harness.input.pushAction({
        type: "Hold"
      });
      harness.step();
      
      const stateAfterFirstHold = harness.getState();
      expect(stateAfterFirstHold!.hold).toBe("T");
      assertActivePiece(stateAfterFirstHold!);

      // Lock the current piece to reset canHold
      harness.input.hardDrop();
      harness.step();
      
      // Wait for auto-spawn
      harness.stepN(3);
      
      const stateAfterLock = harness.getState();
      expect(stateAfterLock!.hold).toBe("T"); // Hold should persist
      assertActivePiece(stateAfterLock!);
      expect(stateAfterLock!.canHold).toBe(true); // Should be able to hold again

      // Hold again to swap
      harness.input.pushAction({
        type: "Hold"
      });
      harness.step();

      const finalState = harness.getState();
      expect(finalState!.hold).toBe(stateAfterLock.active.id); // New piece is now held
      assertActivePiece(finalState!);
      expect(finalState.active.id).toBe("T"); // T piece is now active
    });

    it("should not allow holding when canHold is false", () => {
      harness.spawn("T");
      harness.step();
      
      let state = harness.getState()!;
      
      // Hold once (should work)
      harness.input.pushAction({
        type: "Hold"
      });
      harness.step();
      
      state = harness.getState()!;
      expect(state.hold).toBe("T");
      
      // Try to hold again immediately (should not work due to canHold = false)
      const newPiece = state.active?.id;
      harness.input.pushAction({
        type: "Hold"
      });
      harness.step();
      
      const finalState = harness.getState()!;
      expect(finalState.hold).toBe("T"); // Should remain T
      if (finalState.active) {
        expect(finalState.active.id).toBe(newPiece); // Active piece should not change
      }
    });
  });

  describe("Initial state verification", () => {
    it("should start with proper initial configuration", () => {
      const state = harness.getState();
      expect(state).not.toBeNull();
      expect(state!.status).toBe("playing");
      expect(state!.currentMode).toBe("freePlay");
      expect(state!.nextQueue.length).toBeGreaterThan(0);
      expect(state!.tick).toBe(0);
    });

    it("should have empty board initially", () => {
      const state = harness.getState()!;
      
      // Check that board is empty (all cells are 0)
      for (let i = 0; i < state.board.cells.length; i++) {
        expect(state.board.cells[i]).toBe(0);
      }
    });

    it("should have valid timing configuration", () => {
      const state = harness.getState()!;
      
      expect(state.timing.dasMs).toBeDefined();
      expect(state.timing.arrMs).toBeDefined();
      expect(state.timing.lockDelayMs).toBeDefined();
      expect(state.timing.gravityMs).toBeDefined();
      expect(typeof state.timing.gravityEnabled).toBe("boolean");
    });
  });
});