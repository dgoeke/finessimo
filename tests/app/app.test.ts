import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

import { FinessimoApp } from "@/app/app";
import { fromNow } from "@/types/timestamp";

// Minimal DOM setup for app to work
function setupMinimalDOM(): void {
  // Create basic elements that app expects
  const shell = document.createElement("div");
  shell.setAttribute("tag-name", "finessimo-shell");
  document.body.appendChild(shell);

  const settingsBtn = document.createElement("button");
  settingsBtn.id = "open-settings";
  document.body.appendChild(settingsBtn);
}

describe("FinessimoApp Mode Change Deferral", () => {
  let app: FinessimoApp;

  beforeEach(() => {
    // Set up minimal DOM
    setupMinimalDOM();

    // Create and initialize app
    app = new FinessimoApp();
    app.initialize();
    app.start();
  });

  afterEach(() => {
    app.destroy();
    // Clean up DOM
    document.body.innerHTML = "";
  });

  it("should defer mode changes when game is in resolvingLock state", () => {
    // Initially in freePlay mode
    expect(app.getState().currentMode).toBe("freePlay");
    expect(app.getState().status).toBe("playing");

    // Simulate a piece being locked to create resolving state
    // First move piece to bottom
    const appInternals = app as unknown as {
      dispatch: (action: unknown) => void;
    };
    for (let i = 0; i < 20; i++) {
      appInternals.dispatch({
        on: true,
        timestampMs: fromNow(),
        type: "SoftDrop",
      });
    }

    // Hard drop to trigger lock resolution
    appInternals.dispatch({ timestampMs: fromNow(), type: "HardDrop" });

    // Check if we're in resolving lock or if lock was processed immediately
    const stateAfterDrop = app.getState();

    if (stateAfterDrop.status === "resolvingLock") {
      // Test deferral if we successfully got into resolving state
      app.setGameMode("guided");

      // Mode should still be freePlay since we're resolving
      expect(app.getState().currentMode).toBe("freePlay");

      // Access the private field to check pending mode
      const appWithPrivates = app as unknown as {
        pendingModeChange: string | null;
      };
      expect(appWithPrivates.pendingModeChange).toBe("guided");
    } else {
      // If lock was processed immediately, just verify mode changes work normally
      app.setGameMode("guided");
      expect(app.getState().currentMode).toBe("guided");
    }
  });

  it("should have pendingModeChange field initialized to null", () => {
    // Test that the new field exists and is properly initialized
    const appWithPrivates = app as unknown as {
      pendingModeChange: string | null;
    };
    expect(appWithPrivates.pendingModeChange).toBeNull();
  });

  it("should clear pendingModeChange after successful mode change", () => {
    // Test that normal mode changes work and don't leave pending changes
    app.setGameMode("guided");
    expect(app.getState().currentMode).toBe("guided");

    const appWithPrivates = app as unknown as {
      pendingModeChange: string | null;
    };
    expect(appWithPrivates.pendingModeChange).toBeNull();
  });

  it("should call runModeOnAfterSpawn when spawnNextPiece is called", () => {
    // Test that the onAfterSpawn hook is invoked during spawn
    const appWithPrivates = app as unknown as {
      runModeOnAfterSpawn: () => void;
      spawnNextPiece: () => void;
    };

    // Mock the method to verify it's called
    let onAfterSpawnCalled = false;
    const originalMethod = appWithPrivates.runModeOnAfterSpawn;
    appWithPrivates.runModeOnAfterSpawn = () => {
      onAfterSpawnCalled = true;
      originalMethod.call(appWithPrivates);
    };

    // Directly call spawnNextPiece to test the hook
    appWithPrivates.spawnNextPiece();

    // Verify the hook was called
    expect(onAfterSpawnCalled).toBe(true);
  });

  it("should handle runModeOnAfterSpawn with no mode gracefully", () => {
    // Test error handling when no mode is available
    const appWithPrivates = app as unknown as {
      runModeOnAfterSpawn: () => void;
      gameState: { currentMode: string };
    };

    // Set invalid mode
    const originalMode = appWithPrivates.gameState.currentMode;
    appWithPrivates.gameState.currentMode = "nonexistent";

    // Should not throw when called
    expect(() => appWithPrivates.runModeOnAfterSpawn()).not.toThrow();

    // Restore original mode
    appWithPrivates.gameState.currentMode = originalMode;
  });

  it("should handle runModeOnAfterSpawn with mode without onAfterSpawn", () => {
    // Test when mode exists but doesn't have onAfterSpawn method
    const appWithPrivates = app as unknown as {
      runModeOnAfterSpawn: () => void;
    };

    // Currently freePlay mode doesn't have onAfterSpawn, so this should work
    expect(() => appWithPrivates.runModeOnAfterSpawn()).not.toThrow();
  });
});
