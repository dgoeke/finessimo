/**
 * DAS (Delayed Auto Shift) and ARR (Auto Repeat Rate) integration tests
 * 
 * Tests the input mechanics for holding movement keys and auto-repeat behavior
 */

import { createGameplayHarness } from "../helpers/GameplayHarness";
import { assertActivePiece } from "../../test-helpers";

import type { GameplayHarness } from "../helpers/GameplayHarness";

describe("DAS/ARR Behavior", () => {
  let harness: GameplayHarness;

  beforeEach(() => {
    harness = createGameplayHarness();
    // Spawn a piece for testing
    harness.spawn("T");
    harness.step();
  });

  describe("DAS charging behavior", () => {
    it("should charge DAS and begin auto-repeat after DAS delay", () => {
      const initialState = harness.getState();
      assertActivePiece(initialState!);
      const initialX = initialState.active.x;

      // Start holding left
      harness.input.hold(-1);
      
      // Step once - piece should move immediately on initial press
      harness.step();
      
      let currentState = harness.getState();
      assertActivePiece(currentState!);
      expect(currentState.active.x).toBe(initialX - 1);
      const xAfterFirstMove = currentState.active.x;

      // Step many frames to exceed DAS delay (default 133ms)
      // At 16.67ms per frame: 133ms / 16.67ms = ~8 frames
      harness.stepN(10);
      
      // Should now be auto-repeating, so x should be much lower than after first move
      const finalState = harness.getState();
      assertActivePiece(finalState!);
      expect(finalState.active.x).toBeLessThan(xAfterFirstMove);
    });

    it("should respect ARR timing during auto-repeat", () => {
      // Set custom DAS/ARR values for precise testing
      harness.updateTiming({
        dasMs: 50,  // 50ms DAS (3 frames at 16.67ms)
        arrMs: 16   // 16ms ARR (1 frame at 16.67ms) 
      });

      const initialState = harness.getState();
      assertActivePiece(initialState!);
      const initialX = initialState.active.x;

      // Start holding left
      harness.input.hold(-1);
      
      // Step once for initial movement
      harness.step();
      
      let currentState = harness.getState();
      assertActivePiece(currentState!);
      expect(currentState.active.x).toBe(initialX - 1);
      const xAfterFirstMove = currentState.active.x;

      // Step to exceed DAS (3 frames)
      harness.stepN(3);
      
      // Should now be auto-repeating every frame due to 16ms ARR
      const xAfterDAS = harness.getState()!.active!.x;
      expect(xAfterDAS).toBeLessThan(xAfterFirstMove);
      
      // Step one more frame - should move again due to ARR
      harness.step();
      const finalState = harness.getState();
      assertActivePiece(finalState!);
      expect(finalState.active.x).toBeLessThan(xAfterDAS);
    });

    it("should cancel DAS when releasing key", () => {
      const initialState = harness.getState();
      assertActivePiece(initialState!);
      const initialX = initialState.active.x;

      // Start holding left
      harness.input.hold(-1);
      
      // Step once for initial movement
      harness.step();
      
      let currentState = harness.getState();
      assertActivePiece(currentState!);
      expect(currentState.active.x).toBe(initialX - 1);
      const xAfterFirstMove = currentState.active.x;

      // Release the key before DAS completes
      harness.input.release(-1);
      harness.step();
      
      // Step many frames - piece should not move further
      harness.stepN(10);
      
      const finalState = harness.getState();
      assertActivePiece(finalState!);
      expect(finalState.active.x).toBe(xAfterFirstMove); // Should not have moved
    });

    it("should switch DAS direction immediately when pressing opposite key", () => {
      const initialState = harness.getState();
      assertActivePiece(initialState!);
      const initialX = initialState.active.x;

      // Start holding left
      harness.input.hold(-1);
      harness.step();
      
      let currentState = harness.getState();
      assertActivePiece(currentState!);
      expect(currentState.active.x).toBe(initialX - 1);
      const xAfterLeft = currentState.active.x;

      // Immediately press right (should switch direction)
      harness.input.release(-1);
      harness.input.hold(1);
      harness.step();
      
      // Should move right immediately
      const finalState = harness.getState();
      assertActivePiece(finalState!);
      expect(finalState.active.x).toBe(xAfterLeft + 1);
    });
  });

  describe("DAS/ARR settings integration", () => {
    it("should update DAS timing when settings change", () => {
      const initialState = harness.getState();
      assertActivePiece(initialState!);
      const initialX = initialState.active.x;

      // Set a very long DAS delay
      harness.updateTiming({
        dasMs: 500  // 500ms = 30 frames at 16.67ms
      });

      // Start holding left
      harness.input.hold(-1);
      harness.step(); // Initial move
      
      let currentState = harness.getState();
      assertActivePiece(currentState!);
      expect(currentState.active.x).toBe(initialX - 1);
      const xAfterFirstMove = currentState.active.x;

      // Step many frames, but not enough to exceed 500ms DAS
      harness.stepN(20); // 20 frames = ~333ms, still less than 500ms
      
      const midState = harness.getState();
      assertActivePiece(midState!);
      // Should not have started auto-repeat yet
      expect(midState.active.x).toBe(xAfterFirstMove);
    });

    it("should update ARR timing when settings change", () => {
      // Set slow ARR for testing
      harness.updateTiming({
        dasMs: 50,  // Short DAS
        arrMs: 100  // Slow ARR (100ms = 6 frames)
      });

      const initialState = harness.getState();
      assertActivePiece(initialState!);
      const initialX = initialState.active.x;

      // Start holding left
      harness.input.hold(-1);
      harness.step(); // Initial move
      
      let currentState = harness.getState();
      assertActivePiece(currentState!);
      expect(currentState.active.x).toBe(initialX - 1);

      // Step to exceed DAS
      harness.stepN(4); // Should trigger auto-repeat
      
      const xAfterDAS = harness.getState()!.active!.x;
      expect(xAfterDAS).toBeLessThan(initialX - 1);
      
      // Step fewer frames than ARR - should not move again yet
      harness.stepN(3); // 3 frames < 6 frame ARR
      
      const midState = harness.getState();
      assertActivePiece(midState!);
      expect(midState.active.x).toBe(xAfterDAS); // Should not have moved again
      
      // Step to complete ARR cycle
      harness.stepN(4); // Complete the ARR cycle
      
      const finalState = harness.getState();
      assertActivePiece(finalState!);
      expect(finalState.active.x).toBeLessThan(xAfterDAS); // Should have moved again
    });
  });

  describe("DAS behavior at boundaries", () => {
    it("should stop auto-repeat when hitting board boundary", () => {
      const initialState = harness.getState();
      assertActivePiece(initialState!);

      // Start holding left to move to left boundary
      harness.input.hold(-1);
      
      // Move many times to hit the left wall
      for (let i = 0; i < 20; i++) {
        harness.step();
      }
      
      const boundaryState = harness.getState();
      assertActivePiece(boundaryState!);
      expect(boundaryState.active.x).toBe(0); // Should be at left boundary
      
      // Continue stepping - piece should stay at boundary
      harness.stepN(5);
      
      const finalState = harness.getState();
      assertActivePiece(finalState!);
      expect(finalState.active.x).toBe(0); // Should remain at boundary
    });

    it("should resume auto-repeat if piece is moved away from boundary", () => {
      const initialState = harness.getState();
      assertActivePiece(initialState!);

      // Move to left boundary
      harness.input.hold(-1);
      for (let i = 0; i < 20; i++) {
        harness.step();
      }
      
      let currentState = harness.getState();
      assertActivePiece(currentState!);
      expect(currentState.active.x).toBe(0);

      // Stop holding left and move right
      harness.input.release(-1);
      harness.input.tap(1); // Move right once
      harness.step();
      
      currentState = harness.getState();
      assertActivePiece(currentState!);
      expect(currentState.active.x).toBe(1);

      // Start holding left again - should be able to move
      harness.input.hold(-1);
      harness.step();
      
      const finalState = harness.getState();
      assertActivePiece(finalState!);
      expect(finalState.active.x).toBe(0); // Should move back to boundary
    });
  });

  describe("DAS interaction with other actions", () => {
    it("should not affect DAS when rotating piece", () => {
      const initialState = harness.getState();
      assertActivePiece(initialState!);
      const initialX = initialState.active.x;

      // Start holding left
      harness.input.hold(-1);
      harness.step(); // Initial move
      
      let currentState = harness.getState();
      assertActivePiece(currentState!);
      expect(currentState.active.x).toBe(initialX - 1);

      // Rotate while holding
      harness.input.rotateCW();
      harness.step();
      
      // DAS should continue - step to exceed DAS delay
      harness.stepN(10);
      
      const finalState = harness.getState();
      assertActivePiece(finalState!);
      expect(finalState.active.x).toBeLessThan(initialX - 1); // Should continue moving left
    });

    it("should reset DAS when piece locks", () => {
      const initialState = harness.getState();
      assertActivePiece(initialState!);

      // Start DAS
      harness.input.hold(-1);
      harness.step(); // Initial move
      harness.stepN(5); // Charge DAS
      
      // Hard drop to lock piece
      harness.input.hardDrop();
      harness.step();
      
      // Wait for auto-spawn
      harness.stepN(3);
      
      const newState = harness.getState();
      assertActivePiece(newState!);
      const newInitialX = newState.active.x;

      // DAS should be reset for new piece
      // If still holding, should only move on next frame (no accumulated charge)
      harness.step();
      
      const afterStepState = harness.getState();
      assertActivePiece(afterStepState!);
      
      // Should move, but not be in rapid auto-repeat yet
      expect(afterStepState.active.x).toBe(newInitialX - 1);
    });
  });
});