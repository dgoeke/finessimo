/**
 * Settings integration tests for Phaser Gameplay scene
 * 
 * Tests configuration updates for timing, gameplay settings, and their integration
 */

import { createGameplayHarness } from "../helpers/GameplayHarness";
import { assertActivePiece } from "../../test-helpers";
import { createDurationMs } from "../../../src/types/brands";

import type { GameplayHarness } from "../helpers/GameplayHarness";

describe("Settings Integration", () => {
  let harness: GameplayHarness;

  beforeEach(() => {
    harness = createGameplayHarness();
  });

  describe("Timing settings updates", () => {
    it("should update DAS and ARR timing", () => {
      const initialState = harness.getState();
      expect(initialState!.timing.dasMs).toBeDefined();
      expect(initialState!.timing.arrMs).toBeDefined();

      // Update timing settings
      harness.updateTiming({
        dasMs: 100,
        arrMs: 20
      });

      const updatedState = harness.getState();
      expect(updatedState!.timing.dasMs).toEqual(createDurationMs(100));
      expect(updatedState!.timing.arrMs).toEqual(createDurationMs(20));
    });

    it("should update gravity settings", () => {
      const initialState = harness.getState();
      expect(initialState!.timing.gravityEnabled).toBe(false); // Default is false
      expect(initialState!.timing.gravityMs).toBeDefined();

      // Update gravity settings
      harness.updateTiming({
        gravityEnabled: true,
        gravityMs: 1000
      });

      const updatedState = harness.getState();
      expect(updatedState!.timing.gravityEnabled).toBe(true);
      expect(updatedState!.timing.gravityMs).toEqual(createDurationMs(1000));
    });

    it("should update lock delay settings", () => {
      const initialState = harness.getState();
      expect(initialState!.timing.lockDelayMs).toBeDefined();

      // Update lock delay
      harness.updateTiming({
        lockDelayMs: 750
      });

      const updatedState = harness.getState();
      expect(updatedState!.timing.lockDelayMs).toEqual(createDurationMs(750));
    });

    it("should update line clear delay settings", () => {
      const initialState = harness.getState();
      expect(initialState!.timing.lineClearDelayMs).toBeDefined();

      // Update line clear delay
      harness.updateTiming({
        lineClearDelayMs: 100
      });

      const updatedState = harness.getState();
      expect(updatedState!.timing.lineClearDelayMs).toEqual(createDurationMs(100));
    });

    it("should update soft drop settings", () => {
      const initialState = harness.getState();
      expect(initialState!.timing.softDrop).toBeDefined();

      // Update soft drop to numeric value
      harness.updateTiming({
        softDrop: 15
      });

      let updatedState = harness.getState();
      expect(updatedState!.timing.softDrop).toBe(15);

      // Update soft drop to "infinite"
      harness.updateTiming({
        softDrop: "infinite"
      });

      updatedState = harness.getState();
      expect(updatedState!.timing.softDrop).toBe("infinite");
    });

    it("should handle partial timing updates", () => {
      const initialState = harness.getState();
      const originalArr = initialState!.timing.arrMs;
      const originalGravity = initialState!.timing.gravityMs;

      // Update only DAS
      harness.updateTiming({
        dasMs: 200
      });

      const updatedState = harness.getState();
      expect(updatedState!.timing.dasMs).toEqual(createDurationMs(200));
      expect(updatedState!.timing.arrMs).toEqual(originalArr); // Should remain unchanged
      expect(updatedState!.timing.gravityMs).toEqual(originalGravity); // Should remain unchanged
    });
  });

  describe("Gameplay settings updates", () => {
    it("should update finesse settings", () => {
      const initialState = harness.getState();
      expect(initialState!.gameplay.finesseFeedbackEnabled).toBeDefined();
      expect(initialState!.gameplay.finesseBoopEnabled).toBeDefined();
      expect(initialState!.gameplay.finesseCancelMs).toBeDefined();

      // Update finesse settings
      harness.updateGameplay({
        finesseFeedbackEnabled: false,
        finesseBoopEnabled: true,
        finesseCancelMs: 75
      });

      const updatedState = harness.getState();
      expect(updatedState!.gameplay.finesseFeedbackEnabled).toBe(false);
      expect(updatedState!.gameplay.finesseBoopEnabled).toBe(true);
      expect(updatedState!.gameplay.finesseCancelMs).toEqual(createDurationMs(75));
    });

    it("should update piece display settings", () => {
      const initialState = harness.getState();
      expect(initialState!.gameplay.ghostPieceEnabled).toBeDefined();
      expect(initialState!.gameplay.nextPieceCount).toBeDefined();

      // Update display settings
      harness.updateGameplay({
        ghostPieceEnabled: false,
        nextPieceCount: 3
      });

      const updatedState = harness.getState();
      expect(updatedState!.gameplay.ghostPieceEnabled).toBe(false);
      expect(updatedState!.gameplay.nextPieceCount).toBe(3);
    });

    it("should update hold settings", () => {
      const initialState = harness.getState();
      expect(initialState!.gameplay.holdEnabled).toBeDefined();

      // Disable hold
      harness.updateGameplay({
        holdEnabled: false
      });

      const updatedState = harness.getState();
      expect(updatedState!.gameplay.holdEnabled).toBe(false);
      // Note: canHold may not immediately reflect holdEnabled - it's managed by game logic
    });

    it("should update retry on finesse error setting", () => {
      const initialState = harness.getState();
      expect(initialState!.gameplay.retryOnFinesseError).toBeDefined();

      // Enable retry on finesse error
      harness.updateGameplay({
        retryOnFinesseError: true
      });

      const updatedState = harness.getState();
      expect(updatedState!.gameplay.retryOnFinesseError).toBe(true);
    });

    it("should handle partial gameplay updates", () => {
      const initialState = harness.getState();
      const originalNextCount = initialState!.gameplay.nextPieceCount;
      const originalHoldEnabled = initialState!.gameplay.holdEnabled;

      // Update only ghost piece
      harness.updateGameplay({
        ghostPieceEnabled: false
      });

      const updatedState = harness.getState();
      expect(updatedState!.gameplay.ghostPieceEnabled).toBe(false);
      expect(updatedState!.gameplay.nextPieceCount).toBe(originalNextCount); // Should remain unchanged
      expect(updatedState!.gameplay.holdEnabled).toBe(originalHoldEnabled); // Should remain unchanged
    });
  });

  describe("Settings interaction with gameplay", () => {
    it("should affect hold functionality when holdEnabled changes", () => {
      // Spawn a piece and verify hold works
      harness.spawn("T");
      harness.step();
      
      const initialState = harness.getState();
      assertActivePiece(initialState!);
      expect(initialState.canHold).toBe(true);

      // Hold the piece
      harness.input.pushAction({ type: "Hold" });
      harness.step();

      const afterHoldState = harness.getState();
      expect(afterHoldState!.hold).toBe("T");

      // Disable hold
      harness.updateGameplay({
        holdEnabled: false
      });

      const afterDisableState = harness.getState();
      expect(afterDisableState!.gameplay.holdEnabled).toBe(false);
      expect(afterDisableState!.canHold).toBe(false);

      // Try to hold again - should not work
      assertActivePiece(afterDisableState!);
      const currentPiece = afterDisableState.active.id;
      
      harness.input.pushAction({ type: "Hold" });
      harness.step();

      const finalState = harness.getState();
      expect(finalState).not.toBeNull();
      expect(finalState!.hold).toBe("T"); // Should remain T, not change
      if (finalState!.active) {
        expect(finalState!.active.id).toBe(currentPiece); // Active piece should not change
      }
    });

    it("should affect ghost piece display when ghostPieceEnabled changes", () => {
      // This is a behavioral test - the ghost piece setting affects presentation
      // Since we have a test presenter, we can verify the setting is stored correctly
      harness.updateGameplay({
        ghostPieceEnabled: false
      });

      const state = harness.getState();
      expect(state!.gameplay.ghostPieceEnabled).toBe(false);

      harness.updateGameplay({
        ghostPieceEnabled: true
      });

      const updatedState = harness.getState();
      expect(updatedState!.gameplay.ghostPieceEnabled).toBe(true);
    });

    it("should handle invalid settings gracefully", () => {
      const initialState = harness.getState();
      
      // Try updating with no settings - should not crash
      harness.updateTiming({});
      harness.updateGameplay({});

      const afterEmptyUpdate = harness.getState();
      expect(afterEmptyUpdate).toBeDefined();
      expect(afterEmptyUpdate!.timing).toEqual(initialState!.timing);
      expect(afterEmptyUpdate!.gameplay).toEqual(initialState!.gameplay);
    });
  });

  describe("Settings state persistence", () => {
    it("should maintain settings across piece spawns and locks", () => {
      // Set custom settings
      harness.updateTiming({
        dasMs: 50,
        arrMs: 10
      });

      harness.updateGameplay({
        nextPieceCount: 3,
        ghostPieceEnabled: false
      });

      const settingsState = harness.getState();
      expect(settingsState!.timing.dasMs).toEqual(createDurationMs(50));
      expect(settingsState!.timing.arrMs).toEqual(createDurationMs(10));
      expect(settingsState!.gameplay.nextPieceCount).toBe(3);
      expect(settingsState!.gameplay.ghostPieceEnabled).toBe(false);

      // Spawn and lock a piece
      harness.spawn("T");
      harness.step();
      harness.input.hardDrop();
      harness.step();
      
      // Wait for auto-spawn
      harness.stepN(3);

      // Settings should persist
      const afterLockState = harness.getState();
      expect(afterLockState!.timing.dasMs).toEqual(createDurationMs(50));
      expect(afterLockState!.timing.arrMs).toEqual(createDurationMs(10));
      expect(afterLockState!.gameplay.nextPieceCount).toBe(3);
      expect(afterLockState!.gameplay.ghostPieceEnabled).toBe(false);
    });

    it("should maintain settings across multiple frames", () => {
      // Set custom settings
      harness.updateGameplay({
        finesseFeedbackEnabled: false,
        retryOnFinesseError: true
      });

      const initialSettingsState = harness.getState();
      expect(initialSettingsState!.gameplay.finesseFeedbackEnabled).toBe(false);
      expect(initialSettingsState!.gameplay.retryOnFinesseError).toBe(true);

      // Run many frames
      harness.stepN(50);

      // Settings should still be the same
      const afterManyFrames = harness.getState();
      expect(afterManyFrames!.gameplay.finesseFeedbackEnabled).toBe(false);
      expect(afterManyFrames!.gameplay.retryOnFinesseError).toBe(true);
    });
  });

  describe("Initial configuration", () => {
    it("should have correct default timing settings", () => {
      const state = harness.getState();
      const timing = state!.timing;

      // Check that defaults match expected values (from DESIGN.md and init.ts)
      expect(timing.gravityEnabled).toBe(false); // Default OFF per DESIGN.md
      expect(timing.tickHz).toBe(60);
      
      // DAS/ARR should have reasonable defaults
      expect(timing.dasMs).toBeDefined();
      expect(timing.arrMs).toBeDefined();
      expect(timing.lockDelayMs).toBeDefined();
      expect(timing.lineClearDelayMs).toBeDefined();
      expect(timing.gravityMs).toBeDefined();
    });

    it("should have correct default gameplay settings", () => {
      const state = harness.getState();
      const gameplay = state!.gameplay;

      // Check that defaults match expected values
      expect(gameplay.finesseFeedbackEnabled).toBe(true); // Should be enabled by default
      expect(gameplay.ghostPieceEnabled).toBe(true); // Should be enabled by default
      expect(gameplay.holdEnabled).toBe(true); // Should be enabled by default
      expect(gameplay.finesseBoopEnabled).toBe(false); // Should be disabled by default
      expect(gameplay.retryOnFinesseError).toBe(false); // Should be disabled by default
      
      expect(gameplay.nextPieceCount).toBeGreaterThan(0); // Should have some previews
      expect(gameplay.finesseCancelMs).toBeDefined();
    });
  });
});