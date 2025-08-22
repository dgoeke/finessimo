import { GameState, Action } from './state/types';
import { reducer } from './state/reducer';
import { MockInputHandler } from './input/handler';
import { BasicCanvasRenderer } from './ui/canvas';
import { BasicHudRenderer } from './ui/hud';

export class FinessimoApp {
  private gameState: GameState;
  private inputHandler: MockInputHandler;
  private canvasRenderer: BasicCanvasRenderer;
  private hudRenderer: BasicHudRenderer;
  private isRunning = false;
  private lastFrameTime = 0;
  private readonly targetFrameTime = 1000 / 60; // 60 FPS

  constructor() {
    this.gameState = this.initializeState();
    this.inputHandler = new MockInputHandler();
    this.canvasRenderer = new BasicCanvasRenderer();
    this.hudRenderer = new BasicHudRenderer();
  }

  private initializeState(): GameState {
    return reducer(undefined as any, { type: 'Init' });
  }

  initialize(canvasElement: HTMLCanvasElement, hudElement: HTMLElement): void {
    console.log('Initializing Finessimo application...');
    
    // Initialize renderers
    this.canvasRenderer.initialize(canvasElement);
    this.hudRenderer.initialize(hudElement);
    
    // Initialize input handler
    this.inputHandler.init(this.dispatch.bind(this));
    this.inputHandler.start();
    
    // Setup test controls
    this.hudRenderer.setupTestControls(this.dispatch.bind(this));
    
    // Render initial state
    this.render();
    
    console.log('Finessimo application initialized');
  }

  start(): void {
    if (this.isRunning) {
      console.warn('Application is already running');
      return;
    }
    
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.gameLoop();
    
    console.log('Finessimo application started');
  }

  stop(): void {
    this.isRunning = false;
    this.inputHandler.stop();
    console.log('Finessimo application stopped');
  }

  destroy(): void {
    this.stop();
    this.canvasRenderer.destroy();
    this.hudRenderer.destroy();
    console.log('Finessimo application destroyed');
  }

  private gameLoop(): void {
    if (!this.isRunning) return;
    
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    
    // Fixed time step for game logic (60 Hz)
    if (deltaTime >= this.targetFrameTime) {
      this.update();
      this.render();
      this.lastFrameTime = currentTime;
    }
    
    // Continue the loop
    requestAnimationFrame(() => this.gameLoop());
  }

  private update(): void {
    // Update input handler
    this.inputHandler.update(this.gameState);
    
    // Process any pending game logic updates here
    // For now, we'll just dispatch a Tick action periodically
    if (this.gameState.tick % 60 === 0) { // Every second
      this.dispatch({ type: 'Tick' });
    }
  }

  private render(): void {
    this.canvasRenderer.render(this.gameState);
    this.hudRenderer.render(this.gameState);
  }

  private dispatch(action: Action): void {
    console.log('Dispatching action:', action);
    
    // Log action in HUD for debugging
    this.hudRenderer.logAction(action);
    
    // Apply the action through the reducer
    const newState = reducer(this.gameState, action);
    
    // Check if state actually changed (for debugging)
    if (newState !== this.gameState) {
      console.log('State changed:', {
        oldTick: this.gameState.tick,
        newTick: newState.tick,
        action: action.type
      });
    }
    
    this.gameState = newState;
  }

  // Public method to get current state (for debugging)
  getState(): GameState {
    return this.gameState;
  }

  // Public method to simulate input (for testing)
  simulateInput(action: string): void {
    console.log('Simulating input:', action);
    // This is a simple test method - in a real implementation,
    // input would come from the keyboard/touch handlers
    if (action === 'lock') {
      this.dispatch({ type: 'Lock' });
    }
  }
}