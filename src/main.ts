import { FinessimoApp } from "./app";
import { createGame } from "./presentation/phaser/Game";
import { SCENE_KEYS } from "./presentation/phaser/scenes";
import { getFinessimoShell } from "./ui/utils/dom";

// UI components are dynamically imported in DOM branch only

function shouldUsePhaser(): boolean {
  return new URLSearchParams(location.search).get("ui") === "phaser";
}

// Main entry point
async function main(): Promise<void> {
  // Starting Finessimo - Tetris Finesse Trainer

  if (shouldUsePhaser()) {
    const root = document.getElementById("app") ?? document.body;
    const game = createGame(root, innerWidth, innerHeight);
    // Scenes are registered in Game.ts; start Boot
    game.scene.start(SCENE_KEYS.Boot);
    return;
  }

  // Create the application instance (DOM/Lit UI is default)
  const app = new FinessimoApp();

  // Dynamically import UI components to avoid loading Lit in Phaser mode
  await Promise.all([
    import("./ui/components/finessimo-shell.tsx"),
    import("./ui/components/game-board.tsx"),
    import("./ui/components/finesse-overlay.tsx"),
    import("./ui/components/piece-hold.tsx"),
    import("./ui/components/piece-preview.tsx"),
    import("./ui/components/stats-panel.tsx"),
    import("./ui/components/settings-modal.tsx"),
  ]);

  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => void initializeApp(app),
    );
  } else {
    void initializeApp(app);
  }
}

async function initializeApp(app: FinessimoApp): Promise<void> {
  // Wait for the finessimo-shell custom element to render its content
  const shell = getFinessimoShell();
  if (shell && "updateComplete" in shell) {
    await (shell as { updateComplete: Promise<boolean> }).updateComplete;
  }

  // Initialize and start the application
  try {
    app.initialize();
    app.start();

    // Expose app globally for debugging
    window.finessimoApp = app;

    // Finessimo application is running
  } catch (error) {
    console.error("Failed to initialize Finessimo application:", error);
  }
}

// Handle page unload
window.addEventListener("beforeunload", () => {
  const app = window.finessimoApp;
  if (app) {
    app.destroy();
  }
});

// Start the application
void main();
