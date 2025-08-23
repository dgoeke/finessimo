import { GameState, Action } from './state/types';
import { reducer } from './state/reducer';
import { DOMInputHandler } from './input/handler';
import { BasicCanvasRenderer } from './ui/canvas';
import { BasicHudRenderer } from './ui/hud';
import { gameModeRegistry } from './modes';
import { finesseService } from './finesse/service';

export class FinessimoApp {
  private gameState: GameState;
  private inputHandler: DOMInputHandler;
  private canvasRenderer: BasicCanvasRenderer;
  private hudRenderer: BasicHudRenderer;
  private isRunning = false;
  private lastFrameTime = 0;
  private readonly targetFrameTime = 1000 / 60; // 60 FPS

  constructor() {
    this.gameState = this.initializeState();
    this.inputHandler = new DOMInputHandler();
    this.canvasRenderer = new BasicCanvasRenderer();
    this.hudRenderer = new BasicHudRenderer();
  }

  private initializeState(): GameState {
    return reducer(undefined as any, { type: 'Init' });
  }

  initialize(canvasElement: HTMLCanvasElement, hudElement: HTMLElement): void {
    
    // Initialize renderers
    this.canvasRenderer.initialize(canvasElement);
    this.hudRenderer.initialize(hudElement);
    
    // Initialize input handler
    this.inputHandler.init(this.dispatch.bind(this));
    this.inputHandler.start();
    
    // Setup test controls
    this.hudRenderer.setupTestControls(this.dispatch.bind(this), this.setGameMode.bind(this));
    
    // Spawn initial piece
    this.dispatch({ type: 'Spawn' });
    
    // Render initial state
    this.render();
    
  }

  start(): void {
    if (this.isRunning) {
      console.warn('Application is already running');
      return;
    }
    
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.gameLoop();
    
  }

  stop(): void {
    this.isRunning = false;
    this.inputHandler.stop();
  }

  destroy(): void {
    this.stop();
    this.canvasRenderer.destroy();
    this.hudRenderer.destroy();
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
    const currentTime = performance.now();
    
    // Update input handler
    this.inputHandler.update(this.gameState);
    
    // Always dispatch Tick with timestamp for physics calculations
    this.dispatch({ type: 'Tick', timestampMs: currentTime });
    
    // Handle line clear completion
    if (this.gameState.status === 'lineClear' && 
        this.gameState.physics.lineClearStartTime && 
        this.gameState.timing.lineClearDelayMs > 0) {
      const timeSinceStart = currentTime - this.gameState.physics.lineClearStartTime;
      if (timeSinceStart >= this.gameState.timing.lineClearDelayMs) {
        this.dispatch({ type: 'CompleteLineClear' });
      }
    }
    
    // Auto-spawn piece if no active piece and game is playing
    if (!this.gameState.active && this.gameState.status === 'playing') {
      this.dispatch({ type: 'Spawn' });
    }
  }

  private render(): void {
    this.canvasRenderer.render(this.gameState);
    this.hudRenderer.render(this.gameState);
  }

  private dispatch(action: Action): void {
    
    // Log action in HUD for debugging
    this.hudRenderer.logAction(action);
    
    // Store previous state for finesse analysis
    const prevState = this.gameState;
    
    // Apply the action through the reducer
    const newState = reducer(this.gameState, action);
    
    // Check if state actually changed (for debugging)
    if (newState !== this.gameState) {
      // State changed; no console logging in production
    }
    
    this.gameState = newState;
    
    // Handle finesse analysis on piece lock for any lock source
    if (prevState.active && !newState.active) {
      this.handlePieceLock(prevState);
    }
  }
  
  private handlePieceLock(prevState: GameState): void {
    if (!prevState.active) return;
    
    const currentMode = gameModeRegistry.get(prevState.currentMode);
    if (!currentMode) return;
    
    const finesseActions = finesseService.analyzePieceLock(
      prevState,
      prevState.active,
      currentMode
    );
    
    for (const action of finesseActions) {
      this.gameState = reducer(this.gameState, action);
    }
  }

  // Public method to get current state (for debugging)
  getState(): GameState {
    return this.gameState;
  }

  // Public method to simulate input (for testing)
  simulateInput(action: string): void {
    // Simulating input (no console logging)
    // This is a simple test method - in a real implementation,
    // input would come from the keyboard/touch handlers
    if (action === 'lock') {
      this.dispatch({ type: 'Lock' });
    }
  }
  
  // Public method to change game mode
  setGameMode(modeName: string): void {
    const mode = gameModeRegistry.get(modeName);
    if (mode) {
      this.dispatch({ type: 'SetMode', mode: modeName });
      
      if (mode.shouldPromptNext(this.gameState)) {
        const prompt = mode.getNextPrompt(this.gameState);
        if (prompt) {
          this.dispatch({ type: 'UpdateModePrompt', prompt });
        }
      }
    }
  }
  
  // Public method to get available game modes
  getAvailableModes(): string[] {
    return gameModeRegistry.list();
  }
}
