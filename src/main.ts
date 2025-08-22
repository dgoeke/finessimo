import { FinessimoApp } from './app';

// Main entry point
function main(): void {
  console.log('Starting Finessimo - Tetris Finesse Trainer');
  
  // Create the application instance
  const app = new FinessimoApp();
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeApp(app));
  } else {
    initializeApp(app);
  }
}

function initializeApp(app: FinessimoApp): void {
  // Get canvas element
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element with id "game-canvas" not found');
    return;
  }
  
  // Get HUD element
  const hud = document.getElementById('game-hud') as HTMLElement;
  if (!hud) {
    console.error('HUD element with id "game-hud" not found');
    return;
  }
  
  // Initialize and start the application
  try {
    app.initialize(canvas, hud);
    app.start();
    
    // Expose app globally for debugging
    (window as any).finessimoApp = app;
    
    console.log('Finessimo application is running!');
    console.log('Use finessimoApp.simulateInput("lock") to test the reducer');
    
  } catch (error) {
    console.error('Failed to initialize Finessimo application:', error);
  }
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  const app = (window as any).finessimoApp;
  if (app) {
    app.destroy();
  }
});

// Start the application
main();