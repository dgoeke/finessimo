import { type FinesseResult } from "./finesse/calculator";
import { finesseService } from "./finesse/service";
import { KeyboardInputHandler } from "./input/keyboard";
import { TouchInputHandler } from "./input/touch";
import { gameModeRegistry } from "./modes";
import { runLockPipeline } from "./modes/lock-pipeline";
import { getActiveRng, planPreviewRefill } from "./modes/spawn-service";
import { reducer } from "./state/reducer";
import { gameStateSignal } from "./state/signals";
import {
  type GameState,
  type Action,
  type TimingConfig,
  type GameplayConfig,
} from "./state/types";
import { createTimestamp } from "./types/timestamp";

import type {
  GameSettings,
  SettingsModal,
} from "./ui/components/settings-modal";

export class FinessimoApp {
  private gameState: GameState;
  private keyboardInputHandler: KeyboardInputHandler;
  private touchInputHandler?: TouchInputHandler;
  private settingsModal: SettingsModal | null = null;
  private isRunning = false;
  private isPaused = false;
  private lastFrameTime = 0;
  private readonly targetFrameTime = 1000 / 60; // 60 FPS

  // Event handlers for settings modal
  private handleSettingsOpened = (): void => {
    this.pause();
  };

  private handleSettingsClosed = (): void => {
    this.unpause();
  };

  private createFinesseAnalyzer(): (state: GameState) => {
    result: FinesseResult;
    actions: Array<Action>;
  } {
    // Type guard for UpdateFinesseFeedback action
    const isFinesseUpdateAction = (
      action: Action,
    ): action is Extract<Action, { type: "UpdateFinesseFeedback" }> => {
      return action.type === "UpdateFinesseFeedback";
    };

    return (state: GameState) => {
      const currentMode = gameModeRegistry.get(state.currentMode);
      if (!currentMode || !state.pendingLock) {
        return {
          actions: [],
          result: {
            kind: "optimal",
            optimalSequences: [],
            playerSequence: [],
          },
        };
      }

      // Get the analysis actions from the service
      const activePiece = state.pendingLock.finalPos;
      const actions = finesseService.analyzePieceLock(
        state,
        activePiece,
        currentMode,
        state.pendingLock.timestampMs,
      );

      // Extract FinesseResult from the analysis actions with type safety
      const finesseUpdateAction = actions.find(isFinesseUpdateAction);
      const result: FinesseResult = finesseUpdateAction?.feedback ?? {
        kind: "optimal",
        optimalSequences: [],
        playerSequence: [],
      };

      return { actions, result };
    };
  }

  constructor() {
    this.gameState = this.initializeState();

    // Initialize the signal with the same state
    gameStateSignal.set(this.gameState);

    this.keyboardInputHandler = new KeyboardInputHandler();

    // Initialize touch input if touch is supported
    if ("ontouchstart" in window) {
      this.touchInputHandler = new TouchInputHandler();
    }
  }

  private randomSeed(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  private initializeState(): GameState {
    const seed = this.randomSeed();
    const defaultMode = gameModeRegistry.get("freePlay");
    // If the mode provides RNG, supply it on init
    const rng = defaultMode ? getActiveRng(defaultMode, seed) : undefined;
    let initAction: Extract<Action, { type: "Init" }> = {
      mode: defaultMode?.name ?? "freePlay",
      seed,
      type: "Init",
    };
    if (rng) {
      initAction = { ...initAction, rng };
    }
    return reducer(undefined, initAction);
  }

  initialize(): void {
    // All rendering is handled by Lit components

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

    // Find and initialize settings modal
    this.initializeSettingsModal();

    // Apply persisted settings on startup
    this.applyPersistedSettings();

    // Setup settings button
    this.setupSettingsButton();

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
    // Remove settings event listeners if modal exists
    if (this.settingsModal) {
      this.settingsModal.removeEventListener(
        "settings-change",
        this.handleSettingsChangeEvent,
      );
      this.settingsModal.removeEventListener(
        "settings-opened",
        this.handleSettingsOpened,
      );
      this.settingsModal.removeEventListener(
        "settings-closed",
        this.handleSettingsClosed,
      );
    }
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
    // Skip game updates when paused (settings modal open)
    if (this.isPaused) {
      return;
    }

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
      timestampMs: createTimestamp(currentTime),
      type: "Tick",
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
      const { currentMode, gameplay, timing } = this.gameState;
      // Reinitialize with existing settings and mode, retaining stats across sessions
      this.dispatch({
        gameplay,
        mode: currentMode,
        retainStats: true,
        seed: this.randomSeed(),
        timing,
        type: "Init",
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
        this.dispatch({ guidance, type: "UpdateGuidance" });
      }
    }

    // Preview refill is handled in dispatch when queue shrinks
  }

  private render(): void {
    // All rendering now handled by Lit components via signals - no direct rendering needed
  }

  private dispatch(action: Action): void {
    // Apply the action through the reducer
    let newState = reducer(this.gameState, action);

    // Handle lock resolution through pipeline
    if (
      newState.status === "resolvingLock" &&
      action.type !== "CommitLock" &&
      action.type !== "RetryPendingLock"
    ) {
      // Run the lock pipeline to make commit/retry decision
      runLockPipeline(
        newState,
        (pipelineAction) => {
          newState = reducer(newState, pipelineAction);
        },
        this.createFinesseAnalyzer(),
      );
      // Note: Zero-delay line clears are handled automatically by the reducer
    }

    const prevQueueLen = this.gameState.nextQueue.length;
    this.gameState = newState;
    gameStateSignal.set(newState);

    // If preview queue shrank, top it up once according to mode policy
    if (newState.nextQueue.length < prevQueueLen) {
      this.ensurePreviewFilled(newState);
    }
  }

  // Public method to get current state (for debugging)
  getState(): GameState {
    return this.gameState;
  }

  // Public method to change game mode
  setGameMode(modeName: string): void {
    const mode = gameModeRegistry.get(modeName);
    if (mode) {
      this.dispatch({ mode: modeName, type: "SetMode" });
      // Apply optional initial config from mode
      if (typeof mode.initialConfig === "function") {
        const cfg = mode.initialConfig();
        if (cfg.timing)
          this.dispatch({ timing: cfg.timing, type: "UpdateTiming" });
        if (cfg.gameplay)
          this.dispatch({ gameplay: cfg.gameplay, type: "UpdateGameplay" });
      }

      if (mode.shouldPromptNext(this.gameState)) {
        const prompt = mode.getNextPrompt(this.gameState);
        if (prompt !== null) {
          this.dispatch({ prompt, type: "UpdateModePrompt" });
        }
      }

      // Initialize RNG/preview for the mode immediately on switch
      if (typeof mode.createRng === "function") {
        const desired = Math.max(
          5,
          this.gameState.gameplay.nextPieceCount ?? 5,
        );
        const seededRng = getActiveRng(
          mode,
          this.randomSeed(),
          this.gameState.rng,
        );
        const { newRng, pieces } =
          typeof mode.getPreview === "function"
            ? mode.getPreview(this.gameState, seededRng, desired)
            : seededRng.getNextPieces(desired);
        this.dispatch({ pieces, rng: newRng, type: "ReplacePreview" });
      }
    }
  }

  // Public method to get available game modes
  getAvailableModes(): Array<string> {
    return gameModeRegistry.list();
  }

  // Pause and unpause game methods
  pause(): void {
    this.isPaused = true;
  }

  unpause(): void {
    this.isPaused = false;
    // Reset frame time to avoid large time jumps
    this.lastFrameTime = performance.now();
  }

  // Initialize settings modal and event handling
  private initializeSettingsModal(): void {
    this.settingsModal = document.querySelector("settings-modal");
    if (this.settingsModal) {
      this.settingsModal.addEventListener(
        "settings-change",
        this.handleSettingsChangeEvent,
      );
      this.settingsModal.addEventListener(
        "settings-opened",
        this.handleSettingsOpened,
      );
      this.settingsModal.addEventListener(
        "settings-closed",
        this.handleSettingsClosed,
      );
    }
  }

  // Apply persisted settings on startup
  private applyPersistedSettings(): void {
    if (!this.settingsModal) return;

    try {
      const initialSettings = this.settingsModal.getCurrentSettings();
      const initialKeyBindings = this.settingsModal.getCurrentKeyBindings();
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
  }

  // Setup settings button handler
  private setupSettingsButton(): void {
    const settingsButton = document.getElementById("open-settings");
    if (settingsButton) {
      settingsButton.addEventListener("click", () => {
        if (this.settingsModal) {
          this.settingsModal.show();
        }
      });
    }
  }

  // Event handler for settings-change events from the Lit component
  private handleSettingsChangeEvent = (event: Event): void => {
    const customEvent = event as CustomEvent<Partial<GameSettings>>;
    this.handleSettingsChange(customEvent.detail);
  };

  // Helper method to spawn the appropriate piece based on current mode
  private spawnNextPiece(): void {
    const mode = gameModeRegistry.get(this.gameState.currentMode);
    const override =
      mode && typeof mode.onBeforeSpawn === "function"
        ? mode.onBeforeSpawn(this.gameState)
        : null;
    if (override?.piece !== undefined) {
      this.dispatch({ piece: override.piece, type: "Spawn" });
      return;
    }
    this.dispatch({ type: "Spawn" });
  }

  // Maintain preview queue length using mode-owned RNG
  private ensurePreviewFilled(state: GameState = this.gameState): void {
    const mode = gameModeRegistry.get(state.currentMode);
    const desired = Math.max(5, state.gameplay.nextPieceCount ?? 5);
    const refill = planPreviewRefill(state, mode, desired);
    if (refill && refill.pieces.length > 0) {
      this.dispatch({
        pieces: refill.pieces,
        rng: refill.newRng,
        type: "RefillPreview",
      });
    }
  }

  // Handle settings changes
  private handleSettingsChange(newSettings: Partial<GameSettings>): void {
    this.updateTimingSettings(newSettings);
    this.updateGameplaySettings(newSettings);
    this.updateKeyBindings(newSettings);
  }

  private updateTimingSettings(newSettings: Partial<GameSettings>): void {
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
      this.dispatch({ timing, type: "UpdateTiming" });
    }
  }

  private updateGameplaySettings(newSettings: Partial<GameSettings>): void {
    const gameplay: Partial<GameplayConfig> = {};
    if (newSettings.finesseCancelMs !== undefined)
      gameplay.finesseCancelMs = newSettings.finesseCancelMs;
    if (newSettings.ghostPieceEnabled !== undefined)
      gameplay.ghostPieceEnabled = newSettings.ghostPieceEnabled;
    if (newSettings.nextPieceCount !== undefined)
      gameplay.nextPieceCount = newSettings.nextPieceCount;
    if (newSettings.finesseFeedbackEnabled !== undefined)
      gameplay.finesseFeedbackEnabled = newSettings.finesseFeedbackEnabled;
    if (newSettings.finesseBoopEnabled !== undefined)
      gameplay.finesseBoopEnabled = newSettings.finesseBoopEnabled;
    if (newSettings.retryOnFinesseError !== undefined)
      gameplay.retryOnFinesseError = newSettings.retryOnFinesseError;

    if (Object.keys(gameplay).length > 0) {
      this.dispatch({ gameplay, type: "UpdateGameplay" });
    }
  }

  private updateKeyBindings(newSettings: Partial<GameSettings>): void {
    if (newSettings.keyBindings) {
      this.keyboardInputHandler.setKeyBindings(newSettings.keyBindings);
      if (this.touchInputHandler) {
        this.touchInputHandler.setKeyBindings(newSettings.keyBindings);
      }
    }
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
