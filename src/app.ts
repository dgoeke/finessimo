import { type FinesseResult } from "./finesse/calculator";
import { finesseService } from "./finesse/service";
import { KeyboardInputHandler, type KeyBindings } from "./input/keyboard";
import { loadBindingsFromStorage } from "./input/keyboard";
import { TouchInputHandler } from "./input/touch";
import { gameModeRegistry } from "./modes";
import { freePlayUi } from "./modes/freePlay/ui";
import { guidedUi } from "./modes/guided/ui";
import { runLockPipeline } from "./modes/lock-pipeline";
import { getActiveRng, planPreviewRefill } from "./modes/spawn-service";
import { loadSettings, saveSettings } from "./persistence/settings";
import { reducer } from "./state/reducer";
import { gameStateSignal } from "./state/signals";
import {
  type GameState,
  type Action,
  type TimingConfig,
  type GameplayConfig,
} from "./state/types";
import { createSeed, createDurationMs, type Seed } from "./types/brands";
import { createTimestamp, fromNow } from "./types/timestamp";
import { getSettingsView } from "./ui/utils/dom";

import type { GameMode as IGameMode } from "./modes";
import type { ModeUiAdapter } from "./modes/types";
import type { GameSettings } from "./ui/types/settings";

// Type-safe mode names - must include all supported modes
// Keep in sync with registered modes in gameModeRegistry
type ModeName = "freePlay" | "guided";

// Efficient shallow equality for object comparisons
function shallowEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  if (a === b) return true;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

// Simple equality check that handles null values and falls back to JSON comparison for complex objects
function simpleEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  // For complex objects, fall back to JSON comparison (less optimal but more reliable)
  return JSON.stringify(a) === JSON.stringify(b);
}

// Type-safe registry mapping mode names to their UI adapters
const modeUiAdapterRegistry: Record<ModeName, ModeUiAdapter> = {
  freePlay: freePlayUi,
  guided: guidedUi,
};

export class FinessimoApp {
  private gameState: GameState;
  private keyboardInputHandler: KeyboardInputHandler;
  private touchInputHandler?: TouchInputHandler;
  private settingsView: Element | null = null;
  private bootSettings: Partial<GameSettings> | null = null;
  private isRunning = false;
  private isActive = true;
  private rafId: number | null = null;
  private watchdogId: number | null = null;
  private lastFrameTime = 0;
  private readonly targetFrameTime = 1000 / 60; // 60 FPS
  private readonly INACTIVE_POLL_MS = 500;
  private pendingModeChange: string | null = null;

  // Compute if the game should be actively running
  private computeActive(): boolean {
    // Run only when tab is visible and window focused (legacy modal gating removed)
    return document.visibilityState === "visible" && document.hasFocus();
  }

  // Event handlers for visibility and focus changes
  private handleVisibilityChange = (): void => {
    this.updateActive();
  };

  private handleWindowFocus = (): void => {
    this.updateActive();
  };

  private handleWindowBlur = (): void => {
    this.updateActive();
  };

  private handlePageShow = (): void => {
    this.updateActive();
  };

  private handlePageHide = (): void => {
    this.stopLoop();
    this.ensureWatchdogRunning();
  };

  // Start the game loop
  private startLoop(): void {
    if (this.rafId !== null) return;

    const tick = (): void => {
      if (!this.isRunning || !this.isActive) return;

      const currentTime = fromNow();
      const deltaTime = currentTime - this.lastFrameTime;

      // Fixed time step for game logic (60 Hz)
      if (deltaTime >= this.targetFrameTime) {
        this.update();
        this.render();
        this.lastFrameTime = currentTime;
      }

      // Schedule next frame only while active
      this.rafId = requestAnimationFrame(tick);
    };

    this.lastFrameTime = fromNow();
    this.rafId = requestAnimationFrame(tick);
  }

  // Stop the game loop
  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // Low-cost recovery for missed focus events (covers browser/OS edge cases)
  private ensureWatchdogRunning(): void {
    if (this.watchdogId !== null) return;

    this.watchdogId = window.setInterval(() => {
      const nowActive = this.computeActive();
      if (nowActive !== this.isActive) {
        this.updateActive();
      }
    }, this.INACTIVE_POLL_MS);
  }

  private stopWatchdog(): void {
    if (this.watchdogId !== null) {
      clearInterval(this.watchdogId);
      this.watchdogId = null;
    }
  }

  // Switch loop/watchdog based on activity; minimizes hidden-tab work
  private updateActive(): void {
    const next = this.computeActive();
    if (next === this.isActive) return;

    this.isActive = next;

    if (this.isActive) {
      this.stopWatchdog();
      if (this.isRunning) this.startLoop();
    } else {
      this.stopLoop();
      this.ensureWatchdogRunning();
    }
  }

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

  private randomSeed(): Seed {
    // Use cryptographically-strong randomness for seed generation
    const rnd = new Uint32Array(2);
    crypto.getRandomValues(rnd);
    const [a, b] = Array.from(rnd) as [number, number];
    return createSeed(`${a.toString(36)}-${b.toString(36)}`);
  }

  private initializeState(): GameState {
    const seed = this.randomSeed();
    const defaultMode = gameModeRegistry.get("freePlay");
    // If the mode provides RNG, supply it on init
    const rng = defaultMode ? getActiveRng(defaultMode, seed) : undefined;
    let initAction: Extract<Action, { type: "Init" }> = {
      mode: defaultMode?.name ?? "freePlay",
      seed,
      timestampMs: fromNow(),
      type: "Init",
    };
    if (rng) {
      initAction = { ...initAction, rng };
    }
    return reducer(undefined, initAction);
  }

  initialize(): void {
    // Rendering is handled by Lit components via signals; no manual draw calls here

    // Initialize input handlers
    this.keyboardInputHandler.init(this.dispatch.bind(this));
    // Load persisted keybindings before starting handlers
    const persistedBindings = loadBindingsFromStorage();
    this.keyboardInputHandler.setKeyBindings(persistedBindings);
    this.keyboardInputHandler.start();

    if (this.touchInputHandler) {
      this.touchInputHandler.init(this.dispatch.bind(this));
      // Set reference to keyboard handler for proper timestamp propagation
      this.touchInputHandler.setStateMachineInputHandler(
        this.keyboardInputHandler.getStateMachineInputHandler(),
      );
      this.touchInputHandler.setKeyBindings(persistedBindings);
      this.touchInputHandler.start();
    }

    // Initialize settings-view listeners if available
    this.initializeSettingsUi();

    // Load persisted settings and apply to engine
    const persisted = loadSettings();
    this.bootSettings = { ...persisted, keyBindings: persistedBindings };
    if (Object.keys(persisted).length > 0) {
      this.handleSettingsChange(persisted);
    }
    // Push settings to settings-view if already connected
    this.pushSettingsToSettingsView();

    // Robust focus/visibility detection ensures gameplay pauses predictably
    this.setupVisibilityListeners();

    // Spawn initial piece
    this.spawnNextPiece();

    // Initial render primes UI; subsequent renders are signal-driven
    this.render();
  }

  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.isActive = this.computeActive();

    if (this.isActive) {
      this.startLoop();
    } else {
      this.ensureWatchdogRunning();
    }
  }

  stop(): void {
    this.isRunning = false;
    this.stopLoop();
    this.stopWatchdog();
    this.keyboardInputHandler.stop();
    if (this.touchInputHandler) {
      this.touchInputHandler.stop();
    }
  }

  destroy(): void {
    this.stop();
    // Remove settings-view event listeners
    this.removeSettingsViewListeners();

    // Remove settings-view-connected listener if still active
    document.removeEventListener(
      "settings-view-connected",
      this.handleSettingsViewConnected as EventListener,
    );

    // Remove visibility and focus event listeners to prevent leaks
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    window.removeEventListener("focus", this.handleWindowFocus);
    window.removeEventListener("blur", this.handleWindowBlur);
    window.removeEventListener("pageshow", this.handlePageShow);
    window.removeEventListener("pagehide", this.handlePageHide);
  }

  private update(): void {
    const currentTime = fromNow();
    this.updateInputs(currentTime);
    this.handleTickAndPhysics(currentTime);

    if (this.handleAutoRestartIfTopOut()) return;

    this.handleAutoSpawn();
    this.updateModeUi();

    // Queue refill happens in dispatch when preview shrinks (single responsibility)
  }

  private updateInputs(currentTime: number): void {
    // Update input handlers using the same timestamp used for Tick/physics
    // Only the keyboard handler calls the shared state machine update to avoid double-calls
    this.keyboardInputHandler.update(this.gameState, currentTime);
    if (this.touchInputHandler) {
      // Touch handler only updates its frame counter, not the shared state machine
      this.touchInputHandler.update(this.gameState, currentTime, true);
    }
  }

  private handleTickAndPhysics(currentTime: number): void {
    // Always dispatch Tick with timestamp; physics/LD depend on deterministic timing
    this.dispatch({ timestampMs: createTimestamp(currentTime), type: "Tick" });
    if (shouldCompleteLineClear(this.gameState, currentTime)) {
      this.dispatch({ type: "CompleteLineClear" });
    }
  }

  private handleAutoSpawn(): void {
    if (!this.gameState.active && this.gameState.status === "playing") {
      this.spawnNextPiece();
    }
  }

  private handleAutoRestartIfTopOut(): boolean {
    if (this.gameState.status !== "topOut") return false;
    const { currentMode, gameplay, timing } = this.gameState;
    this.dispatch({
      gameplay,
      mode: currentMode,
      retainStats: true,
      seed: this.randomSeed(),
      timestampMs: fromNow(),
      timing,
      type: "Init",
    });
    this.spawnNextPiece();
    return true;
  }

  private updateModeUi(): void {
    const mode = gameModeRegistry.get(this.gameState.currentMode);
    if (!mode) return;

    this.updateModeGuidance(mode);
    this.updateModeAdapterData();
    this.updateBoardDecorations(mode);
  }

  private updateModeGuidance(mode: IGameMode): void {
    if (typeof mode.getGuidance === "function") {
      const guidance = mode.getGuidance(this.gameState) ?? null;
      const prev = this.gameState.guidance ?? null;
      if (!simpleEqual(guidance, prev)) {
        this.dispatch({ guidance, type: "UpdateGuidance" });
      }
    }
  }

  private updateModeAdapterData(): void {
    const adapter =
      modeUiAdapterRegistry[this.gameState.currentMode as ModeName];
    const derivedUi = adapter.computeDerivedUi(this.gameState);
    if (derivedUi === null) return;

    // Merge with existing modeData to avoid overwriting other mode state
    const currentModeData =
      typeof this.gameState.modeData === "object" &&
      this.gameState.modeData !== null
        ? (this.gameState.modeData as Record<string, unknown>)
        : {};
    const mergedModeData = { ...currentModeData, ...derivedUi };

    // Only dispatch if data actually changed
    if (!shallowEqual(mergedModeData, currentModeData)) {
      this.dispatch({ data: mergedModeData, type: "UpdateModeData" });
    }
  }

  private updateBoardDecorations(mode: IGameMode): void {
    // LEGACY: Keep existing board decorations for backward compatibility during transition
    if (typeof mode.getBoardDecorations === "function") {
      const decorations = mode.getBoardDecorations(this.gameState) ?? null;
      const prev = this.gameState.boardDecorations ?? null;
      if (!simpleEqual(decorations, prev)) {
        this.dispatch({ decorations, type: "UpdateBoardDecorations" });
      }
    }
  }

  private render(): void {
    // Rendering handled by Lit signals; method remains for future debug hooks
  }

  private dispatch(action: Action): void {
    const wasResolvingLock = this.gameState.status === "resolvingLock";

    // Apply the action through the reducer
    let newState = reducer(this.gameState, action);

    // Lock resolution happens outside the reducer to keep core pure and pluggable
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
        fromNow(),
      );
      // Zero-delay line clears are handled in reducer for synchronous flow
    }

    const prevQueueLen = this.gameState.nextQueue.length;
    this.gameState = newState;
    gameStateSignal.set(newState);

    // If preview shrank, top it up once using the active mode policy
    if (newState.nextQueue.length < prevQueueLen) {
      this.ensurePreviewFilled(newState);
    }

    // Process any pending mode change after lock resolution completes
    if (
      wasResolvingLock &&
      newState.status !== "resolvingLock" &&
      this.pendingModeChange !== null
    ) {
      const pendingMode = this.pendingModeChange;
      this.pendingModeChange = null;
      this.applyModeChange(pendingMode);
    }
  }

  // Public method to get current state (for debugging)
  getState(): GameState {
    return this.gameState;
  }

  // Public method to change game mode
  setGameMode(modeName: string): void {
    const mode = gameModeRegistry.get(modeName);
    if (!mode) return;

    // If the game is currently resolving a lock, defer the mode change
    // to avoid race conditions with the lock pipeline
    if (this.gameState.status === "resolvingLock") {
      this.pendingModeChange = modeName;
      return;
    }

    this.applyModeChange(modeName);
  }

  // Internal method to actually apply the mode change
  private applyModeChange(modeName: string): void {
    const mode = gameModeRegistry.get(modeName);
    if (!mode) return;

    // Get mode's initial config before reinitialization to avoid race condition
    const modeConfig =
      typeof mode.initialConfig === "function" ? mode.initialConfig() : {};

    // Merge current settings with mode-provided defaults to smooth transitions
    const { gameplay, timing } = this.gameState;
    const mergedGameplay = { ...gameplay, ...modeConfig.gameplay };
    const mergedTiming = { ...timing, ...modeConfig.timing };

    // Reinitialize with correct merged config
    this.dispatch({
      gameplay: mergedGameplay,
      mode: modeName,
      retainStats: true, // Keep stats across mode switches
      seed: this.randomSeed(),
      timestampMs: fromNow(),
      timing: mergedTiming,
      type: "Init",
    });

    // Apply remaining mode-specific activation (prompt, hooks, RNG)
    // Skip applyModeInitialConfig since we already applied it during Init
    this.applyModePrompt(mode);
    this.runModeActivationHook(mode);
    this.setupModeRng(mode);

    // Spawn the first piece for the new mode
    this.spawnNextPiece();
  }

  private applyModePrompt(mode: IGameMode): void {
    if (!mode.shouldPromptNext(this.gameState)) return;
    const prompt = mode.getNextPrompt(this.gameState);
    if (prompt !== null) {
      this.dispatch({ prompt, type: "UpdateModePrompt" });
    }
  }

  private runModeActivationHook(mode: IGameMode): void {
    if (typeof mode.onActivated !== "function") return;
    const activation = mode.onActivated(this.gameState);
    if (activation.modeData !== undefined) {
      this.dispatch({ data: activation.modeData, type: "UpdateModeData" });
    }
    if (Array.isArray(activation.postActions)) {
      const acts = activation.postActions as ReadonlyArray<Action>;
      for (const act of acts) this.dispatch(act);
    }
  }

  private setupModeRng(mode: IGameMode): void {
    if (typeof mode.createRng !== "function") return;
    const desired = Math.max(5, this.gameState.gameplay.nextPieceCount ?? 5);
    const seededRng = getActiveRng(mode, this.randomSeed(), this.gameState.rng);
    const { newRng, pieces } =
      typeof mode.getPreview === "function"
        ? mode.getPreview(this.gameState, seededRng, desired)
        : seededRng.getNextPieces(desired);
    this.dispatch({ pieces, rng: newRng, type: "ReplacePreview" });
  }

  // Public method to get available game modes
  getAvailableModes(): Array<string> {
    return gameModeRegistry.list();
  }

  // Legacy pause methods (kept for external compatibility if needed)
  pause(): void {
    this.updateActive();
  }

  unpause(): void {
    this.updateActive();
  }

  // Initialize settings-view event handling
  private initializeSettingsUi(): void {
    // Initialize settings-view integration - listen for when it becomes available
    this.settingsView = getSettingsView();
    if (this.settingsView) {
      this.setupSettingsViewListeners();
    } else {
      // Listen for settings-view to become available
      document.addEventListener(
        "settings-view-connected",
        this.handleSettingsViewConnected as EventListener,
      );
    }
  }

  private setupSettingsViewListeners(): void {
    if (!this.settingsView) return;

    this.settingsView.addEventListener(
      "update-timing",
      this.handleUpdateTiming as EventListener,
    );
    this.settingsView.addEventListener(
      "update-gameplay",
      this.handleUpdateGameplay as EventListener,
    );
    this.settingsView.addEventListener(
      "set-mode",
      this.handleSetMode as EventListener,
    );
    this.settingsView.addEventListener(
      "update-keybindings",
      this.handleUpdateKeybindings as EventListener,
    );

    // Send initial settings snapshot to the settings view for UI consistency
    this.pushSettingsToSettingsView();
  }

  private removeSettingsViewListeners(): void {
    if (!this.settingsView) return;

    this.settingsView.removeEventListener(
      "update-timing",
      this.handleUpdateTiming as EventListener,
    );
    this.settingsView.removeEventListener(
      "update-gameplay",
      this.handleUpdateGameplay as EventListener,
    );
    this.settingsView.removeEventListener(
      "set-mode",
      this.handleSetMode as EventListener,
    );
    this.settingsView.removeEventListener(
      "update-keybindings",
      this.handleUpdateKeybindings as EventListener,
    );
  }

  // Setup focus and visibility change listeners
  private setupVisibilityListeners(): void {
    // Initialize the state based on current activity
    this.isActive = this.computeActive();

    // Add all the event listeners for robust focus detection
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("focus", this.handleWindowFocus);
    window.addEventListener("blur", this.handleWindowBlur);
    window.addEventListener("pageshow", this.handlePageShow);
    window.addEventListener("pagehide", this.handlePageHide);
  }

  // settings-modal removed; no generic settings-change handler needed

  // Event handlers for settings-view direct game engine events
  private handleUpdateTiming = (
    event: CustomEvent<Partial<TimingConfig>>,
  ): void => {
    // Debug: console.log("App received update-timing:", event.detail);
    this.dispatch({ timing: event.detail, type: "UpdateTiming" });
    this.persistAllSettings();
  };

  private handleUpdateGameplay = (
    event: CustomEvent<Partial<GameplayConfig>>,
  ): void => {
    // Debug: console.log("App received update-gameplay:", event.detail);
    this.dispatch({ gameplay: event.detail, type: "UpdateGameplay" });
    this.persistAllSettings();
  };

  private handleSetMode = (event: CustomEvent<string>): void => {
    // Debug: console.log("App received set-mode:", event.detail);
    this.setGameMode(event.detail);
    this.persistAllSettings();
  };

  private handleUpdateKeybindings = (event: CustomEvent<KeyBindings>): void => {
    // Debug: console.log("App received update-keybindings:", event.detail);
    this.keyboardInputHandler.setKeyBindings(event.detail);
    if (this.touchInputHandler) {
      this.touchInputHandler.setKeyBindings(event.detail);
    }
    this.persistAllSettings();
  };

  private handleSettingsViewConnected = (
    event: CustomEvent<{ settingsView?: Element }>,
  ): void => {
    const settingsView = event.detail.settingsView;
    if (settingsView) {
      this.settingsView = settingsView;
      this.setupSettingsViewListeners();
      // Remove the listener since we found the settings-view
      document.removeEventListener(
        "settings-view-connected",
        this.handleSettingsViewConnected as EventListener,
      );
      // Push initial settings after connecting
      this.pushSettingsToSettingsView();
    }
  };

  // Helper method to spawn the appropriate piece based on current mode
  private spawnNextPiece(): void {
    const mode = gameModeRegistry.get(this.gameState.currentMode);
    const override =
      mode && typeof mode.onBeforeSpawn === "function"
        ? mode.onBeforeSpawn(this.gameState)
        : null;
    const now = fromNow();
    if (override?.piece !== undefined) {
      this.dispatch({ piece: override.piece, timestampMs: now, type: "Spawn" });
      return;
    }
    this.dispatch({ timestampMs: now, type: "Spawn" });
  }

  private pushSettingsToSettingsView(): void {
    if (!this.settingsView || !this.bootSettings) return;
    const target = this.settingsView as unknown as {
      applySettings?: (s: Partial<GameSettings>) => void;
    };
    if (typeof target.applySettings === "function") {
      target.applySettings(this.bootSettings);
    }
  }

  private persistAllSettings(): void {
    try {
      const bindings = this.keyboardInputHandler.getKeyBindings();
      saveSettings(this.gameState, bindings);
    } catch {
      // ignore persistence errors
    }
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
  handleSettingsChange(newSettings: Partial<GameSettings>): void {
    this.updateTimingSettings(newSettings);
    this.updateGameplaySettings(newSettings);
    this.updateKeyBindings(newSettings);
    // Mode switch: only re-init if mode actually changed
    if (
      (newSettings.mode === "freePlay" || newSettings.mode === "guided") &&
      newSettings.mode !== this.gameState.currentMode
    ) {
      this.setGameMode(newSettings.mode);
    }
  }

  private updateTimingSettings(newSettings: Partial<GameSettings>): void {
    const timing: Partial<TimingConfig> = {};
    if (newSettings.dasMs !== undefined)
      timing.dasMs = createDurationMs(newSettings.dasMs);
    if (newSettings.arrMs !== undefined)
      timing.arrMs = createDurationMs(newSettings.arrMs);
    if (newSettings.softDrop !== undefined)
      timing.softDrop = newSettings.softDrop as TimingConfig["softDrop"];
    if (newSettings.lockDelayMs !== undefined)
      timing.lockDelayMs = createDurationMs(newSettings.lockDelayMs);
    if (newSettings.lineClearDelayMs !== undefined)
      timing.lineClearDelayMs = createDurationMs(newSettings.lineClearDelayMs);
    if (newSettings.gravityMs !== undefined)
      timing.gravityMs = createDurationMs(newSettings.gravityMs);
    if (newSettings.gravityEnabled !== undefined)
      timing.gravityEnabled = newSettings.gravityEnabled;

    if (Object.keys(timing).length > 0) {
      this.dispatch({ timing, type: "UpdateTiming" });
    }
  }

  private updateGameplaySettings(newSettings: Partial<GameSettings>): void {
    const gameplay: Partial<GameplayConfig> = {};
    if (newSettings.finesseCancelMs !== undefined)
      gameplay.finesseCancelMs = createDurationMs(newSettings.finesseCancelMs);
    if (newSettings.ghostPieceEnabled !== undefined)
      gameplay.ghostPieceEnabled = newSettings.ghostPieceEnabled;
    if (newSettings.guidedColumnHighlightEnabled !== undefined)
      gameplay.guidedColumnHighlightEnabled =
        newSettings.guidedColumnHighlightEnabled;
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
