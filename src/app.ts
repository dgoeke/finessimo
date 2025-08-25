import { GameState, Action, TimingConfig, GameplayConfig } from "./state/types";
import { createTimestamp, fromNow } from "./types/timestamp";
import { reducer } from "./state/reducer";
import { KeyboardInputHandler } from "./input/keyboard";
import { TouchInputHandler } from "./input/touch";
import { BasicCanvasRenderer } from "./ui/canvas";
import { BasicFinesseRenderer } from "./ui/finesse-feedback";
import { BasicPreviewRenderer } from "./ui/preview";
import { BasicHoldRenderer } from "./ui/hold";
import { BasicSettingsRenderer, GameSettings } from "./ui/settings";
import { BasicStatisticsRenderer } from "./ui/statistics";
import { gameModeRegistry } from "./modes";
import { finesseService } from "./finesse/service";

export class FinessimoApp {
  private gameState: GameState;
  private keyboardInputHandler: KeyboardInputHandler;
  private touchInputHandler?: TouchInputHandler;
  private canvasRenderer: BasicCanvasRenderer;
  private finesseRenderer: BasicFinesseRenderer;
  private previewRenderer: BasicPreviewRenderer;
  private holdRenderer: BasicHoldRenderer;
  private settingsRenderer: BasicSettingsRenderer;
  private statisticsRenderer: BasicStatisticsRenderer;
  private isRunning = false;
  private lastFrameTime = 0;
  private readonly targetFrameTime = 1000 / 60; // 60 FPS

  constructor() {
    this.gameState = this.initializeState();
    this.keyboardInputHandler = new KeyboardInputHandler();
    this.canvasRenderer = new BasicCanvasRenderer();
    this.finesseRenderer = new BasicFinesseRenderer();
    this.previewRenderer = new BasicPreviewRenderer();
    this.holdRenderer = new BasicHoldRenderer();
    this.settingsRenderer = new BasicSettingsRenderer();
    this.statisticsRenderer = new BasicStatisticsRenderer();

    // Initialize touch input if touch is supported
    if ("ontouchstart" in window) {
      this.touchInputHandler = new TouchInputHandler();
    }
  }

  private initializeState(): GameState {
    return reducer(undefined, { type: "Init" });
  }

  initialize(
    canvasElement: HTMLCanvasElement,
    finesseFeedbackElement: HTMLElement,
  ): void {
    // Initialize renderers
    this.canvasRenderer.initialize(canvasElement);
    this.finesseRenderer.initialize(finesseFeedbackElement);

    // Initialize unified layout components
    const holdElement = document.getElementById("hold-container");
    const previewElement = document.getElementById("preview-container");
    const statisticsElement = document.getElementById("statistics-panel");

    if (holdElement) {
      this.holdRenderer.initialize(holdElement);
    }
    if (previewElement) {
      this.previewRenderer.initialize(previewElement);
    }
    if (statisticsElement) {
      this.statisticsRenderer.initialize(statisticsElement);
    }

    // Initialize input handlers
    this.keyboardInputHandler.init(this.dispatch.bind(this));
    this.keyboardInputHandler.start();

    if (this.touchInputHandler) {
      this.touchInputHandler.init(this.dispatch.bind(this));
      // Set reference to keyboard handler for proper timestamp propagation
      this.touchInputHandler.setStateMachineInputHandler(
        this.keyboardInputHandler.getStateMachineInputHandler(),
      );
      this.touchInputHandler.start();
    }

    // Initialize settings renderer
    this.settingsRenderer.initialize(document.body);
    this.settingsRenderer.onSettingsChange(
      this.handleSettingsChange.bind(this),
    );

    // No on-page controls list; users can view in Settings

    // Setup settings button
    this.setupSettingsButton();

    // Apply persisted settings on init (if present)
    try {
      const initialSettings = this.settingsRenderer.getCurrentSettings();
      const initialKeyBindings = this.settingsRenderer.getCurrentKeyBindings();
      const toApply: Partial<GameSettings> = {
        ...initialSettings,
        keyBindings: initialKeyBindings,
      };
      this.handleSettingsChange(toApply);
      // Prime the input handler timing with the current game state's timing
      this.keyboardInputHandler.applyTiming(this.gameState.timing);
    } catch {
      /* ignore persisted settings errors */
    }

    // Spawn initial piece
    this.spawnNextPiece();

    // Render initial state
    this.render();
  }

  start(): void {
    if (this.isRunning) {
      console.warn("Application is already running");
      return;
    }

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.gameLoop();
  }

  stop(): void {
    this.isRunning = false;
    this.keyboardInputHandler.stop();
    if (this.touchInputHandler) {
      this.touchInputHandler.stop();
    }
  }

  destroy(): void {
    this.stop();
    this.canvasRenderer.destroy();
    this.finesseRenderer.destroy();
    this.previewRenderer.destroy();
    this.holdRenderer.destroy();
    this.settingsRenderer.destroy();
    this.statisticsRenderer.destroy();
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

    // Update input handlers using the same timestamp used for Tick/physics
    // Only the keyboard handler calls the shared state machine update to avoid double-calls
    this.keyboardInputHandler.update(this.gameState, currentTime);
    if (this.touchInputHandler) {
      // Touch handler only updates its frame counter, not the shared state machine
      this.touchInputHandler.update(this.gameState, currentTime, true);
    }

    // Always dispatch Tick with timestamp for physics calculations
    this.dispatch({
      type: "Tick",
      timestampMs: createTimestamp(currentTime),
    });

    // Handle line clear completion
    if (shouldCompleteLineClear(this.gameState, currentTime)) {
      this.dispatch({ type: "CompleteLineClear" });
    }

    // Auto-spawn piece if no active piece and game is playing
    if (!this.gameState.active && this.gameState.status === "playing") {
      this.spawnNextPiece();
    }

    // Auto-restart on top-out: treat as game over and immediately restart
    if (this.gameState.status === "topOut") {
      const { timing, gameplay, currentMode } = this.gameState;
      // Reinitialize with existing settings and mode, retaining stats across sessions
      this.dispatch({
        type: "Init",
        timing,
        gameplay,
        mode: currentMode,
        retainStats: true,
      });
      this.spawnNextPiece();
      return;
    }

    // Update guidance from current mode (only when changed)
    const mode = gameModeRegistry.get(this.gameState.currentMode);
    if (mode && typeof mode.getGuidance === "function") {
      const guidance = mode.getGuidance(this.gameState) ?? null;
      const prev = this.gameState.guidance ?? null;
      if (JSON.stringify(guidance) !== JSON.stringify(prev)) {
        this.dispatch({ type: "UpdateGuidance", guidance });
      }
    }
  }

  private render(): void {
    this.canvasRenderer.render(this.gameState);
    this.finesseRenderer.render(this.gameState);
    // Determine preview count from gameplay config (fallback to 5)
    const previewCount = this.gameState.gameplay.nextPieceCount ?? 5;
    this.previewRenderer.render(this.gameState.nextQueue, previewCount);

    // Render hold piece
    this.holdRenderer.render(this.gameState.hold, this.gameState.canHold);

    // Render statistics
    this.statisticsRenderer.render(this.gameState);
  }

  private dispatch(action: Action): void {
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
      // Extract timestamp from Lock action, if available
      const lockTimestamp =
        action.type === "Lock" ? action.timestampMs : undefined;
      this.handlePieceLock(prevState, lockTimestamp);
    }
  }

  private handlePieceLock(prevState: GameState, timestampMs?: number): void {
    if (!prevState.active) return;

    const currentMode = gameModeRegistry.get(prevState.currentMode);
    if (!currentMode) return;

    const finesseActions = finesseService.analyzePieceLock(
      this.gameState, // Use current state which has the processed input log
      prevState.active,
      currentMode,
      timestampMs,
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
    if (action === "lock") {
      this.dispatch({ type: "Lock", timestampMs: fromNow() });
    }
  }

  // Public method to change game mode
  setGameMode(modeName: string): void {
    const mode = gameModeRegistry.get(modeName);
    if (mode) {
      this.dispatch({ type: "SetMode", mode: modeName });
      // Apply optional initial config from mode
      if (typeof mode.initialConfig === "function") {
        const cfg = mode.initialConfig();
        if (cfg.timing)
          this.dispatch({ type: "UpdateTiming", timing: cfg.timing });
        if (cfg.gameplay)
          this.dispatch({ type: "UpdateGameplay", gameplay: cfg.gameplay });
      }

      if (mode.shouldPromptNext(this.gameState)) {
        const prompt = mode.getNextPrompt(this.gameState);
        if (prompt) {
          this.dispatch({ type: "UpdateModePrompt", prompt });
        }
      }
    }
  }

  // Public method to get available game modes
  getAvailableModes(): string[] {
    return gameModeRegistry.list();
  }

  // Setup settings button handler
  private setupSettingsButton(): void {
    const settingsButton = document.getElementById("open-settings");
    if (settingsButton) {
      settingsButton.addEventListener("click", () => {
        this.settingsRenderer.show();
      });
    }
  }

  // Helper method to spawn the appropriate piece based on current mode
  private spawnNextPiece(): void {
    const mode = gameModeRegistry.get(this.gameState.currentMode);
    const override =
      mode && typeof mode.onBeforeSpawn === "function"
        ? mode.onBeforeSpawn(this.gameState)
        : null;
    if (override?.piece) {
      this.dispatch({ type: "Spawn", piece: override.piece });
      return;
    }
    this.dispatch({ type: "Spawn" });
  }

  // Handle settings changes
  private handleSettingsChange(newSettings: Partial<GameSettings>): void {
    // Dispatch timing changes
    const timing: Partial<TimingConfig> = {};
    if (newSettings.dasMs !== undefined) timing.dasMs = newSettings.dasMs;
    if (newSettings.arrMs !== undefined) timing.arrMs = newSettings.arrMs;
    if (newSettings.softDrop !== undefined)
      timing.softDrop = newSettings.softDrop as TimingConfig["softDrop"];
    if (newSettings.lockDelayMs !== undefined)
      timing.lockDelayMs = newSettings.lockDelayMs;
    if (newSettings.lineClearDelayMs !== undefined)
      timing.lineClearDelayMs = newSettings.lineClearDelayMs;
    if (newSettings.gravityMs !== undefined)
      timing.gravityMs = newSettings.gravityMs;
    if (newSettings.gravityEnabled !== undefined)
      timing.gravityEnabled = newSettings.gravityEnabled;
    if (Object.keys(timing).length > 0) {
      this.dispatch({ type: "UpdateTiming", timing });
    }

    // Dispatch gameplay/visual toggles that affect renderers
    const gameplay: Partial<GameplayConfig> = {};
    if (newSettings.finesseCancelMs !== undefined)
      gameplay.finesseCancelMs = newSettings.finesseCancelMs;
    if (newSettings.ghostPieceEnabled !== undefined)
      gameplay.ghostPieceEnabled = newSettings.ghostPieceEnabled;
    if (newSettings.nextPieceCount !== undefined)
      gameplay.nextPieceCount = newSettings.nextPieceCount;
    if (Object.keys(gameplay).length > 0) {
      this.dispatch({ type: "UpdateGameplay", gameplay });
    }

    // Keybindings: update input handler and controls UI immediately
    if (newSettings.keyBindings) {
      this.keyboardInputHandler.setKeyBindings(newSettings.keyBindings);
      if (this.touchInputHandler) {
        this.touchInputHandler.setKeyBindings(newSettings.keyBindings);
      }
    }

    // Apply UI scale directly to document root
    if (newSettings.uiScale !== undefined) {
      document.documentElement.style.setProperty(
        "--ui-scale",
        newSettings.uiScale.toString(),
      );
    }

    // Other visual settings like themes can be applied here as needed
  }
}

// Exported for testing and clarity; encapsulates when line clear should complete
export function shouldCompleteLineClear(
  state: GameState,
  nowMs: number,
): boolean {
  if (state.status !== "lineClear") return false;
  if (state.timing.lineClearDelayMs === 0) return false; // Immediate clearing handled in reducer
  const start = state.physics.lineClearStartTime;
  if (start === null) return false; // not started
  return nowMs - start >= state.timing.lineClearDelayMs;
}
