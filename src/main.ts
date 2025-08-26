import { FinessimoApp } from "./app";

// Import components to register them
import "./ui/components/finessimo-shell.tsx";
import "./ui/components/game-board.tsx";
import "./ui/components/finesse-overlay.tsx";
import "./ui/components/piece-hold.tsx";
import "./ui/components/piece-preview.tsx";
import "./ui/components/stats-panel.tsx";
import "./ui/components/settings-modal.tsx";

// Main entry point
function main(): void {
  // Starting Finessimo - Tetris Finesse Trainer

  // Create the application instance
  const app = new FinessimoApp();

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
  const shell = document.querySelector("finessimo-shell");
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
main();
