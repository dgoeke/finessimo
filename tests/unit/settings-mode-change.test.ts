import { describe, expect, test } from "@jest/globals";

import { FinessimoApp } from "../../src/app";
import { fromNow } from "../../src/types/timestamp";

import type { Action } from "../../src/state/types";

describe("Settings mode change behavior", () => {
  test("changing mode via setGameMode preserves stats and game progress", () => {
    const app = new FinessimoApp();
    app.initialize();

    // Manually place a piece and progress the game
    (app as unknown as { dispatch: (action: Action) => void }).dispatch({
      timestampMs: fromNow(),
      type: "HardDrop",
    });
    (app as unknown as { dispatch: (action: Action) => void }).dispatch({
      timestampMs: fromNow(),
      type: "Lock",
    });

    // Get state after gameplay
    const gameplayState = app.getState();
    expect(gameplayState.stats.attempts).toBeGreaterThan(0); // Should have some progress

    // Store board state to verify it gets reset
    const gameplayBoard = gameplayState.board.cells;

    // Use setGameMode (this reinitializes but preserves stats)
    app.setGameMode("guided");

    const finalState = app.getState();

    // Mode should change
    expect(finalState.currentMode).toBe("guided");

    // Stats should be preserved due to retainStats: true
    expect(finalState.stats.attempts).toBe(gameplayState.stats.attempts);

    // Board gets reset due to Init action, but that's expected for setGameMode
    expect(finalState.board.cells).not.toEqual(gameplayBoard);
  });

  test("changing mode via settings should only change mode without resetting anything else", () => {
    const app = new FinessimoApp();
    app.initialize();

    // Start in freePlay mode
    expect(app.getState().currentMode).toBe("freePlay");

    // Manually place a piece and progress the game
    (app as unknown as { dispatch: (action: Action) => void }).dispatch({
      timestampMs: fromNow(),
      type: "HardDrop",
    });
    (app as unknown as { dispatch: (action: Action) => void }).dispatch({
      timestampMs: fromNow(),
      type: "Lock",
    });

    // Get state after gameplay
    const gameplayState = app.getState();
    const initialAttempts = gameplayState.stats.attempts;
    expect(initialAttempts).toBeGreaterThan(0); // Should have some progress

    // Store values that should NOT be reset
    const gameplayBoard = gameplayState.board.cells;
    const gameplayActive = gameplayState.active;
    const gameplayHold = gameplayState.hold;
    const gameplayQueue = gameplayState.nextQueue;

    // Use handleSettingsChange with mode change
    // This should now use SetMode instead of full reinitialization

    (
      app as unknown as { handleSettingsChange: (settings: unknown) => void }
    ).handleSettingsChange({
      arrMs: 33,
      dasMs: 167,
      mode: "guided" as const,
    });

    const finalState = app.getState();

    // Mode should change
    expect(finalState.currentMode).toBe("guided");

    // Settings should be updated
    expect(finalState.timing.dasMs).toBe(167);
    expect(finalState.timing.arrMs).toBe(33);

    // Stats should be preserved
    expect(finalState.stats.attempts).toBe(initialAttempts);

    // Game field should NOT be reset when changing settings (this is the fix)
    expect(finalState.board.cells).toEqual(gameplayBoard);
    expect(finalState.active).toEqual(gameplayActive);
    expect(finalState.hold).toEqual(gameplayHold);
    expect(finalState.nextQueue).toEqual(gameplayQueue);
  });

  test("changing non-mode settings should not reset anything", () => {
    const app = new FinessimoApp();
    app.initialize();

    // Get initial state
    const initialMode = app.getState().currentMode;

    // Manually place a piece and progress the game
    (app as unknown as { dispatch: (action: Action) => void }).dispatch({
      timestampMs: fromNow(),
      type: "HardDrop",
    });
    (app as unknown as { dispatch: (action: Action) => void }).dispatch({
      timestampMs: fromNow(),
      type: "Lock",
    });

    const gameplayState = app.getState();
    const initialAttempts = gameplayState.stats.attempts;
    expect(initialAttempts).toBeGreaterThan(0);

    // Store values that should NOT be reset
    const gameplayBoard = gameplayState.board.cells;
    const gameplayActive = gameplayState.active;
    const gameplayHold = gameplayState.hold;
    const gameplayQueue = gameplayState.nextQueue;

    // Change only timing settings (no mode change)

    (
      app as unknown as { handleSettingsChange: (settings: unknown) => void }
    ).handleSettingsChange({
      arrMs: 50,
      dasMs: 100,
      ghostPieceEnabled: false,
    });

    const finalState = app.getState();

    // Mode should stay the same
    expect(finalState.currentMode).toBe(initialMode);

    // Game state should not be reset
    expect(finalState.stats.attempts).toBe(initialAttempts);
    expect(finalState.board.cells).toEqual(gameplayBoard);
    expect(finalState.active).toEqual(gameplayActive);
    expect(finalState.hold).toEqual(gameplayHold);
    expect(finalState.nextQueue).toEqual(gameplayQueue);

    // Settings should be updated
    expect(finalState.timing.dasMs).toBe(100);
    expect(finalState.timing.arrMs).toBe(50);
    expect(finalState.gameplay.ghostPieceEnabled).toBe(false);
  });
});
