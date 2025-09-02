// Phase 4: Deterministic fixed-step loop
import Phaser from "phaser";

import { DASMachineService } from "../../../input/machines/das";
import { gameModeRegistry } from "../../../modes";
import { freePlayUi } from "../../../modes/freePlay/ui";
import { guidedUi } from "../../../modes/guided/ui";
import { reducer as coreReducer } from "../../../state/reducer";
import { getCurrentState, dispatch } from "../../../state/signals";
import {
  createSeed,
  createDurationMs,
  durationMsAsNumber,
} from "../../../types/brands";
import { fromNow } from "../../../types/timestamp";
import { PhaserInputAdapterImpl } from "../input/PhaserInputAdapterImpl";
import { BoardPresenter } from "../presenter/BoardPresenter";
import { mapGameStateToViewModel } from "../presenter/viewModel";
import { ms as unbrandMs } from "../utils/unbrand";

import { SimulatedClock } from "./clock";
import { processActionWithLockPipeline as pipeline_processActionWithLockPipeline } from "./gameplay/lockPipeline";
import { processFixedTimeStep as loop_processFixedTimeStep } from "./gameplay/loop";
import {
  initializeMode as mode_initializeMode,
  setGameMode as mode_setGameMode,
} from "./gameplay/mode";
import {
  PREVIEW_BOX_COLS,
  PREVIEW_CELL_PX,
  setupPreviewsAndHold as prev_setupPreviewsAndHold,
  updateNextPreviews as prev_updateNextPreviews,
  updateHoldPreview as prev_updateHoldPreview,
} from "./gameplay/previews";
import { SCENE_KEYS } from "./types";

import type { Clock } from "./clock";
// type-only imports kept minimal; concrete types come from modules
import type { ModeUiAdapter } from "../../../modes/types";
import type { GameState, Action } from "../../../state/types";
import type { Seed } from "../../../types/brands";
import type { PhaserInputAdapter } from "../input/PhaserInputAdapter";
import type { AudioBus } from "../presenter/AudioBus";
import type { CameraFxAdapter } from "../presenter/Effects";
import type { Presenter, Ms, ViewModel } from "../presenter/types";
import type { SceneCtx } from "./gameplay/types";
import type { Timestamp } from "../../../types/timestamp";
// no direct util imports needed here; handled within modules

// Preview layout constants come from previews module to avoid drift
// Board layout constants
const BOARD_TILE_PX = 16;
const SPAWN_EXTRA_ROWS = 3; // allow rendering above board by up to 3 rows
const BOTTOM_EXTRA_ROWS = 1; // add ~1 grid row margin below the board

// Utility shims for in-file references to moved helpers
// Utility aliases not needed inside class after refactor

export class Gameplay extends Phaser.Scene {
  // Expose state for tests in isolated mode; mirrors app.ts getState()
  getState(): GameState | null {
    return this._state;
  }
  // Helper method to safely dispatch to global state (only in actual scene, not in tests)
  private safeDispatch(action: Action): void {
    if (!this._isolatedMode) {
      dispatch(action);
    }
  }
  private _accumulator = 0;
  private _isolatedMode = false;
  private _fixedDt: Ms = (1000 / 60) as Ms;
  private _clock: Clock = new SimulatedClock();
  private _state: GameState | null = null;
  private _presenter: Presenter | null = null;
  private _input: PhaserInputAdapter | null = null;
  private _das = new DASMachineService();
  private _vmPrev: ViewModel | null = null;
  private _reduce: (s: Readonly<GameState>, a: Action) => GameState =
    coreReducer;
  private _nextPreviewContainers: Array<Phaser.GameObjects.Container> = [];
  private _holdContainer: Phaser.GameObjects.Container | null = null;
  private _overlayColumns: Phaser.GameObjects.Graphics | null = null;
  private _overlayTargets: Phaser.GameObjects.Graphics | null = null;
  private _originX = 0;
  private _originY = 0;
  private _tileSize = 16;
  private _boardHeightPx = 20 * 16;
  private _effectsTexts = new Map<number, Phaser.GameObjects.Text>();
  private _effectsStart = new Map<number, number>();
  private _pendingTap: { dir: -1 | 1; t: Timestamp } | null = null;
  private _softDropOn = false;

  // Type-safe mode names - must include all supported modes
  // Keep in sync with registered modes in gameModeRegistry
  private readonly _modeUiAdapterRegistry: Record<
    "freePlay" | "guided",
    ModeUiAdapter
  > = {
    freePlay: freePlayUi,
    guided: guidedUi,
  } as const;
  private _contentBounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null = null;
  private _onResize = (): void => {
    if (this._contentBounds) {
      this.fitCameraToContent(this._contentBounds);
    }
  };

  constructor() {
    super({ key: SCENE_KEYS.Gameplay });
  }

  private get ctx(): SceneCtx {
    if (!this._state || !this._presenter || !this._input) {
      throw new Error("Scene context not ready");
    }
    const ctx: SceneCtx = {
      boardHeightPx: this._boardHeightPx,
      clock: this._clock,
      das: this._das,
      effectsStart: this._effectsStart,
      effectsTexts: this._effectsTexts,
      fixedDt: this._fixedDt,
      getState: (): GameState => {
        if (this._state === null) throw new Error("Scene context not ready");
        return this._state;
      },
      holdContainer: this._holdContainer,
      input: this._input,
      modeUiAdapters: this._modeUiAdapterRegistry,
      nextPreviewContainers: this._nextPreviewContainers,
      originX: this._originX,
      originY: this._originY,
      overlayColumns: this._overlayColumns,
      overlayTargets: this._overlayTargets,
      pendingTap: this._pendingTap,
      presenter: this._presenter,
      randomSeed: (): Seed => this.randomSeed(),
      reduce: this._reduce,
      safeDispatch: (a: Action): void => this.safeDispatch(a),
      scene: this,
      setPendingTap: (v: { dir: -1 | 1; t: Timestamp } | null): void => {
        this._pendingTap = v;
      },
      setSoftDropOn: (on: boolean): void => {
        this._softDropOn = on;
      },
      setState: (s: GameState): void => {
        this._state = s;
      },
      setVmPrev: (vm: ViewModel | null): void => {
        this._vmPrev = vm;
      },
      softDropOn: this._softDropOn,
      spawnNextPiece: (): void => this.spawnNextPiece(),
      state: this._state,
      tileSize: this._tileSize,
      vmPrev: this._vmPrev,
    };
    Object.defineProperty(ctx, "vmPrev", {
      configurable: false,
      enumerable: true,
      get: (): ViewModel | null => this._vmPrev,
      set: (vm: ViewModel | null): void => {
        this._vmPrev = vm;
      },
    });
    Object.defineProperty(ctx, "softDropOn", {
      configurable: false,
      enumerable: true,
      get: (): boolean => this._softDropOn,
      set: (v: boolean): void => {
        this._softDropOn = v;
      },
    });
    Object.defineProperty(ctx, "pendingTap", {
      configurable: false,
      enumerable: true,
      get: (): { dir: -1 | 1; t: Timestamp } | null => this._pendingTap,
      set: (v: { dir: -1 | 1; t: Timestamp } | null): void => {
        this._pendingTap = v;
      },
    });
    Object.defineProperty(ctx, "state", {
      configurable: false,
      enumerable: true,
      get: (): GameState => {
        if (this._state === null) throw new Error("Scene context not ready");
        return this._state;
      },
      set: (s: GameState): void => {
        this._state = s;
      },
    });
    return ctx;
  }

  // Floating text rendering moved to effects module

  create(): void {
    // Center the board on screen
    const boardWidthPx = 10 * 16; // 10 columns * 16px tiles
    const boardHeightPx = 20 * 16; // 20 rows * 16px tiles
    const ox = (this.scale.width - boardWidthPx) / 2;
    const oy = (this.scale.height - boardHeightPx) / 2;

    // Add some debug info
    this.add.text(10, 10, "Finessimo - Phaser UI", {
      color: "#ffffff",
      fontFamily: "monospace",
      fontSize: "16px",
    });

    // Debug: Show current game state
    const stateText = this.add.text(10, 35, "", {
      color: "#cccccc",
      fontFamily: "monospace",
      fontSize: "12px",
    });

    // Build Next/Hold UI groups
    {
      const { holdContainer, nextPreviewContainers } =
        prev_setupPreviewsAndHold(this, boardWidthPx, ox, oy);
      this._nextPreviewContainers = nextPreviewContainers;
      this._holdContainer = holdContainer;
    }

    // Update debug text periodically (previews are updated immediately in the game loop)
    this.time.addEvent({
      callback: () => {
        if (this._state) {
          stateText.setText(
            `Status: ${this._state.status} | Active: ${this._state.active ? "YES" : "NO"}`,
          );
        }
      },
      delay: 500, // Less frequent for debug text only
      loop: true,
    });

    // Add border around game area for visibility
    const border = this.add.rectangle(
      ox + boardWidthPx / 2,
      oy + boardHeightPx / 2,
      boardWidthPx + 4,
      boardHeightPx + 4,
    );
    border.setStrokeStyle(2, 0x333333);

    // Overlay layers (column highlight below board, targets above)
    this._overlayColumns = this.add.graphics();
    this._overlayColumns.setDepth(-1);

    const blitter = this.add.blitter(0, 0, "tiles");
    const active = this.add.container();
    const ghost = this.add.container();

    this._overlayTargets = this.add.graphics();
    this._overlayTargets.setDepth(10);

    // Create pooled sprites (4 each) for active and ghost pieces
    // These sprites will be positioned and made visible/invisible as needed
    for (let i = 0; i < 4; i++) {
      // Active piece sprites (top-left anchored to align to grid)
      const activeSprite = this.add.sprite(0, 0, "tiles", 1);
      activeSprite.setOrigin(0, 0);
      activeSprite.setVisible(false); // Start hidden
      active.add(activeSprite);

      // Ghost piece sprites (top-left anchored + semi-transparent)
      const ghostSprite = this.add.sprite(0, 0, "tiles", 1);
      ghostSprite.setOrigin(0, 0);
      ghostSprite.setVisible(false); // Start hidden
      ghostSprite.setAlpha(0.5); // Semi-transparent for ghost effect
      ghost.add(ghostSprite);
    }

    const fx: CameraFxAdapter = {
      fadeIn: (ms) => this.cameras.main.fadeIn(unbrandMs(ms)),
      fadeOut: (ms) => this.cameras.main.fadeOut(unbrandMs(ms)),
      shake: (ms, mag) => this.cameras.main.shake(unbrandMs(ms), mag ?? 0.005),
      zoomTo: (ms, z) => this.cameras.main.zoomTo(z, unbrandMs(ms)),
    };
    const audio: AudioBus = {
      play: (name) => this.sound.play(name),
    };

    this._presenter = new BoardPresenter({
      activeContainer: active,
      audio,
      blitter,
      fx,
      ghostContainer: ghost,
      originXPx: ox,
      originYPx: oy,
      tileSizePx: 16,
    });
    this._originX = ox;
    this._originY = oy;
    this._tileSize = 16;
    this._boardHeightPx = boardHeightPx;
    this._input = new PhaserInputAdapterImpl(this);
    this._state = getCurrentState();
    this._vmPrev = null;
    this._accumulator = 0;

    // Initialize the current game mode
    this.initializeMode(this._state.currentMode);

    // Ensure an initial active piece exists for immediate gameplay.
    // The DOM app spawns on initialize(); mirror that here for Phaser.
    {
      const s = this._state; // getCurrentState() is non-null
      if (s.active === undefined && s.status === "playing") {
        this.spawnNextPiece();

        // Trigger initial render to show the spawned piece
        const vm = mapGameStateToViewModel(this._state, this._vmPrev);
        const plan = this._presenter.computePlan(null, vm);
        this._presenter.apply(plan);
        this._vmPrev = vm;

        // Update previews after initial setup
        prev_updateNextPreviews(
          this._nextPreviewContainers,
          this._state.nextQueue,
        );
        prev_updateHoldPreview(this._holdContainer, this._state.hold ?? null);
      }
    }
    // Compute content bounds (hold + board + next) and fit camera with padding
    const previewBoxWidthPx = PREVIEW_CELL_PX * PREVIEW_BOX_COLS;
    const leftX = ox - 20 - previewBoxWidthPx; // holdX matches setupPreviewsAndHold
    const rightX = boardWidthPx + ox + 20 + previewBoxWidthPx; // end of next area
    // Include extra rows above the board for spawn rendering and bottom border stroke
    const topY = oy - SPAWN_EXTRA_ROWS * BOARD_TILE_PX - 2;
    const bottomY = oy + boardHeightPx + 2 + BOTTOM_EXTRA_ROWS * BOARD_TILE_PX;
    this._contentBounds = {
      height: bottomY - topY,
      left: leftX,
      top: topY,
      width: rightX - leftX,
    };
    this.fitCameraToContent(this._contentBounds);
    this.scale.on("resize", this._onResize, this);
    this.events.once("shutdown", () => {
      this.scale.off("resize", this._onResize, this);
    });
  }

  // Previews/hold now live in previews.ts and are wired in create()

  private fitCameraToContent(bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  }): void {
    // Compute max zoom that fits content inside viewport with padding
    const vw = this.scale.width;
    const vh = this.scale.height;
    const pad = 8; // smaller margin around edges (~0.5 grid cell)
    const availW = Math.max(1, vw - pad * 2);
    const availH = Math.max(1, vh - pad * 2);
    const zoomX = availW / bounds.width;
    const zoomY = availH / bounds.height;
    const zoom = Math.min(zoomX, zoomY);
    this.cameras.main.setZoom(zoom);
    // Center camera on content bounds center
    const cx = bounds.left + bounds.width / 2;
    const cy = bounds.top + bounds.height / 2;
    this.cameras.main.centerOn(cx, cy);
  }

  attachLoop(deps: {
    presenter: Presenter;
    input: PhaserInputAdapter;
    initialState: GameState;
    fixedDt?: Ms;
    clock?: Clock;
    reduce?: (s: Readonly<GameState>, a: Action) => GameState;
  }): void {
    this._isolatedMode = true; // Tests use attachLoop, real scenes don't
    this._presenter = deps.presenter;
    this._input = deps.input;
    this._state = deps.initialState;
    if (deps.fixedDt) this._fixedDt = deps.fixedDt;
    if (deps.clock) this._clock = deps.clock;
    if (deps.reduce) this._reduce = deps.reduce;
    this._accumulator = 0;
    this._vmPrev = null;
  }

  update(_time: number, delta: number): void {
    if (!this._state || !this._presenter || !this._input) return;
    const dt = unbrandMs(this._fixedDt);
    // Spiral-of-death guard: cap backlog to 10 fixed steps
    this._accumulator = Math.min(this._accumulator + delta, 10 * dt);
    while (this._accumulator >= dt) {
      this.processFixedTimeStep();
      this._accumulator -= dt;
    }
  }

  private processFixedTimeStep(): void {
    loop_processFixedTimeStep(this.ctx);
    this.checkGameOverState();
  }

  // Input handling moved to gameplay/input

  // Tick handling moved to gameplay/loop

  // Presentation updates moved to gameplay/presentation

  // Overlay drawing moved to gameplay/presentation

  // Overlay column highlights moved to gameplay/presentation

  // Overlay target drawing moved to gameplay/presentation

  // UI effects moved to gameplay/effects

  // effect text helpers moved to effects.ts

  private checkGameOverState(): void {
    if (!this._state) return;
    if (this._state.status === "topOut") {
      this.time.delayedCall(1000, () => this.toResults());
    }
  }

  // Auto-spawn moved to gameplay/loop

  // Auto-restart moved to gameplay/loop

  // Mode UI update moved to gameplay/mode

  // Mode guidance moved to gameplay/mode

  // Mode adapter data update moved to gameplay/mode

  // shallowEqual moved to gameplay/utils

  // Board decorations moved to gameplay/mode

  toResults(): void {
    // Compute summary from current game state
    const summary = this.computeResultsSummary();
    this.scene.start(SCENE_KEYS.Results, { summary });
  }

  private computeResultsSummary(): {
    linesCleared: number;
    piecesPlaced: number;
    accuracyPercentage: number;
    timePlayedMs: number;
  } {
    if (!this._state) {
      return {
        accuracyPercentage: 0,
        linesCleared: 0,
        piecesPlaced: 0,
        timePlayedMs: 0,
      };
    }

    const stats = this._state.stats;
    const linesCleared = stats.linesCleared;
    const piecesPlaced = stats.piecesPlaced;
    const timePlayedMs = durationMsAsNumber(stats.timePlayedMs);

    // Use the pre-calculated accuracy percentage from stats
    const accuracyPercentage = Math.round(stats.accuracyPercentage);

    return {
      accuracyPercentage,
      linesCleared,
      piecesPlaced,
      timePlayedMs,
    };
  }

  backToMenu(): void {
    this.scene.start(SCENE_KEYS.MainMenu);
  }

  // Public method to change game mode
  setGameMode(modeName: string): void {
    mode_setGameMode(this.ctx, modeName);
  }

  // Initialize a game mode with its configuration and activation hooks
  private initializeMode(modeName: string): void {
    mode_initializeMode(this.ctx, modeName);
  }

  // Mode helpers delegated to gameplay/mode; wrappers removed as unused

  private randomSeed(): Seed {
    // Use cryptographically-strong randomness for seed generation
    const rnd = new Uint32Array(2);
    crypto.getRandomValues(rnd);
    const [a, b] = Array.from(rnd) as [number, number];
    return createSeed(`${a.toString(36)}-${b.toString(36)}`);
  }

  // Preview refill handled inside lock pipeline and mode.setupModeRng

  // Settings update methods for future Settings scene integration
  updateTimingSettings(
    newSettings: Partial<{
      dasMs: number;
      arrMs: number;
      softDrop: number | "infinite";
      lockDelayMs: number;
      lineClearDelayMs: number;
      gravityMs: number;
      gravityEnabled: boolean;
    }>,
  ): void {
    if (!this._state) return;

    const timing: Partial<typeof this._state.timing> = {};
    if (newSettings.dasMs !== undefined)
      timing.dasMs = createDurationMs(newSettings.dasMs);
    if (newSettings.arrMs !== undefined)
      timing.arrMs = createDurationMs(newSettings.arrMs);
    if (newSettings.softDrop !== undefined)
      timing.softDrop = newSettings.softDrop;
    if (newSettings.lockDelayMs !== undefined)
      timing.lockDelayMs = createDurationMs(newSettings.lockDelayMs);
    if (newSettings.lineClearDelayMs !== undefined)
      timing.lineClearDelayMs = createDurationMs(newSettings.lineClearDelayMs);
    if (newSettings.gravityMs !== undefined)
      timing.gravityMs = createDurationMs(newSettings.gravityMs);
    if (newSettings.gravityEnabled !== undefined)
      timing.gravityEnabled = newSettings.gravityEnabled;

    if (Object.keys(timing).length > 0) {
      this._state = this._reduce(this._state, { timing, type: "UpdateTiming" });
      this.safeDispatch({ timing, type: "UpdateTiming" });
    }
  }

  updateGameplaySettings(
    newSettings: Partial<{
      finesseCancelMs: number;
      ghostPieceEnabled: boolean;
      nextPieceCount: number;
      finesseFeedbackEnabled: boolean;
      finesseBoopEnabled: boolean;
      retryOnFinesseError: boolean;
      holdEnabled: boolean;
    }>,
  ): void {
    if (!this._state) return;

    const gameplay: Partial<typeof this._state.gameplay> = {};
    if (newSettings.finesseCancelMs !== undefined)
      gameplay.finesseCancelMs = createDurationMs(newSettings.finesseCancelMs);
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
    if (newSettings.holdEnabled !== undefined)
      gameplay.holdEnabled = newSettings.holdEnabled;

    if (Object.keys(gameplay).length > 0) {
      this._state = this._reduce(this._state, {
        gameplay,
        type: "UpdateGameplay",
      });
      this.safeDispatch({ gameplay, type: "UpdateGameplay" });
    }
  }

  private spawnNextPiece(): void {
    if (!this._state) return;

    const mode = gameModeRegistry.get(this._state.currentMode);
    const override =
      mode && typeof mode.onBeforeSpawn === "function"
        ? mode.onBeforeSpawn(this._state)
        : null;
    const now = fromNow();
    let spawnAction: Extract<Action, { type: "Spawn" }>;

    if (override?.piece !== undefined) {
      spawnAction = { piece: override.piece, timestampMs: now, type: "Spawn" };
    } else {
      spawnAction = { timestampMs: now, type: "Spawn" };
    }

    // IMPORTANT: Mirror app.ts dispatch semantics so preview refills trigger.
    // Process locally via the pipeline (which handles refill when queue shrinks),
    // then dispatch the Spawn outward to keep global state in sync.
    this._state = this.processActionWithLockPipeline(this._state, spawnAction);
    this.safeDispatch(spawnAction);
  }

  private processActionWithLockPipeline(
    state: GameState,
    action: Action,
  ): GameState {
    return pipeline_processActionWithLockPipeline(this.ctx, state, action);
  }
}
