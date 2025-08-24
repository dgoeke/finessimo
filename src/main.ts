import { FinessimoApp } from "./app";

// Main entry point
function main(): void {
  // Starting Finessimo - Tetris Finesse Trainer

  // Create the application instance
  const app = new FinessimoApp();

  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initializeApp(app));
  } else {
    initializeApp(app);
  }
}

function initializeApp(app: FinessimoApp): void {
  // Get canvas element
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element with id "game-canvas" not found');
    return;
  }

  // Get finesse feedback panel element
  const finesseFeedbackPanel = document.getElementById(
    "finesse-feedback-panel",
  )!;
  if (!finesseFeedbackPanel) {
    console.error(
      'Finesse feedback panel element with id "finesse-feedback-panel" not found',
    );
    return;
  }

  // Initialize and start the application
  try {
    app.initialize(canvas, finesseFeedbackPanel);
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
