// Phase 4: Deterministic fixed-step loop
import Phaser from "phaser";

import { PIECES } from "../../../core/pieces";
import { selectDerivedOverlays } from "../../../engine/selectors/overlays";
import {
  createProcessedHardDrop,
  createProcessedHoldMove,
  createProcessedRotate,
  createProcessedSoftDrop,
  createProcessedTapMove,
} from "../../../finesse/log";
import { finesseService } from "../../../finesse/service";
import { DASMachineService } from "../../../input/machines/das";
import { gameModeRegistry } from "../../../modes";
import { freePlayUi } from "../../../modes/freePlay/ui";
import { guidedUi } from "../../../modes/guided/ui";
import { runLockPipeline } from "../../../modes/lock-pipeline";
import { getActiveRng, planPreviewRefill } from "../../../modes/spawn-service";
import { reducer as coreReducer } from "../../../state/reducer";
import { getCurrentState, dispatch } from "../../../state/signals";
import { createSeed, createDurationMs } from "../../../types/brands";
import { createTimestamp, fromNow } from "../../../types/timestamp";
import { PhaserInputAdapterImpl } from "../input/PhaserInputAdapterImpl";
import { BoardPresenter } from "../presenter/BoardPresenter";
import { mapGameStateToViewModel } from "../presenter/viewModel";

import { SimulatedClock } from "./clock";
import { SCENE_KEYS } from "./types";

import type { Clock } from "./clock";
import type { RenderOverlay } from "../../../engine/ui/overlays";
import type { FinesseResult } from "../../../finesse/calculator";
import type { DASEvent } from "../../../input/machines/das";
import type { GameMode as IGameMode } from "../../../modes";
import type { ModeUiAdapter } from "../../../modes/types";
import type { GameState, Action } from "../../../state/types";
import type { Seed } from "../../../types/brands";
import type {
  PhaserInputAdapter,
  InputEvent,
} from "../input/PhaserInputAdapter";
import type { AudioBus } from "../presenter/AudioBus";
import type { CameraFxAdapter } from "../presenter/Effects";
import type { Presenter, Ms, ViewModel } from "../presenter/types";

type TetrominoPieceId = "I" | "J" | "L" | "O" | "S" | "T" | "Z";

// Preview layout constants
const PREVIEW_CELL_PX = 12;
const PREVIEW_BOX_COLS = 4;
const PREVIEW_BOX_ROWS = 3;
// Board layout constants
const BOARD_TILE_PX = 16;
const SPAWN_EXTRA_ROWS = 3; // allow rendering above board by up to 3 rows
const BOTTOM_EXTRA_ROWS = 1; // add ~1 grid row margin below the board

// Exported for testing and clarity; encapsulates when line clear should complete
function shouldCompleteLineClear(state: GameState, nowMs: number): boolean {
  if (state.status !== "lineClear") return false;
  if (state.timing.lineClearDelayMs === 0) return false; // Immediate clearing handled in reducer
  const start = state.physics.lineClearStartTime;
  if (start === null) return false; // not started
  return nowMs - start >= state.timing.lineClearDelayMs;
}

// Simple equality check that handles null values and falls back to JSON comparison for complex objects
function simpleEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

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
  private _pendingTap: {
    dir: -1 | 1;
    t: ReturnType<typeof createTimestamp>;
  } | null = null;
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

  private renderFloatingText(
    effect: Extract<
      NonNullable<GameState>["uiEffects"][number],
      { kind: "floatingText" }
    >,
    now: number,
    seen: Set<number>,
    toNum: (n: unknown) => number,
  ): void {
    const id = toNum(effect.id as unknown as number);
    seen.add(id);
    if (!this._effectsStart.has(id)) this._effectsStart.set(id, now);
    const start = this._effectsStart.get(id) ?? now;
    let ttl = toNum(effect.ttlMs as unknown as number);
    if (ttl <= 0) ttl = 1;
    const p = Math.max(0, Math.min(1, (now - start) / ttl));
    const alpha = 1 - p;
    const scaleFrom = effect.scaleFrom ?? 1;
    const scaleTo = effect.scaleTo ?? 1;
    const scale = scaleFrom + (scaleTo - scaleFrom) * p;
    const t = this.ensureEffectText(
      id,
      effect.text,
      effect.color,
      effect.fontPx,
      effect.fontWeight,
    );
    const pos = this.computeEffectBoardPos(
      effect.anchor,
      toNum(effect.offsetX as unknown as number),
      toNum(effect.offsetY as unknown as number),
      toNum(effect.driftYPx as unknown as number),
      p,
    );
    t.setOrigin(pos.ox, pos.oy);
    t.setPosition(pos.x, pos.y);
    t.setAlpha(alpha);
    t.setScale(scale);
  }

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
    this.setupPreviewsAndHold(boardWidthPx, ox, oy);

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
      fadeIn: (ms) => this.cameras.main.fadeIn(ms as unknown as number),
      fadeOut: (ms) => this.cameras.main.fadeOut(ms as unknown as number),
      shake: (ms, mag) =>
        this.cameras.main.shake(ms as unknown as number, mag ?? 0.005),
      zoomTo: (ms, z) => this.cameras.main.zoomTo(z, ms as unknown as number),
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
        const vm = mapGameStateToViewModel(this._state);
        const plan = this._presenter.computePlan(null, vm);
        this._presenter.apply(plan);
        this._vmPrev = vm;

        // Update previews after initial setup
        this.updateNextPreviews(
          this._nextPreviewContainers,
          this._state.nextQueue,
        );
        this.updateHoldPreview(this._holdContainer, this._state.hold ?? null);
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

  private setupPreviewsAndHold(
    boardWidthPx: number,
    ox: number,
    oy: number,
  ): void {
    // Add next piece preview area (centered above preview column)
    const nextScale = 0.65;
    const nextColumnX = boardWidthPx + ox + 20;
    // Center label based on preview grid spacing (12px per cell),
    // which matches how preview sprites are positioned inside the container.
    const nextCenterX = nextColumnX + (PREVIEW_CELL_PX * PREVIEW_BOX_COLS) / 2;
    this.add
      .text(nextCenterX, oy, "Next", {
        color: "#ffffff",
        fontFamily: "monospace",
        fontSize: "14px",
        resolution: Math.max(2, window.devicePixelRatio),
      })
      .setOrigin(0.5, 0);

    // Create containers for next piece previews (show up to 5)
    this._nextPreviewContainers = [];
    for (let i = 0; i < 5; i++) {
      const container = this.add.container(
        boardWidthPx + ox + 20,
        oy + 25 + i * 35, // Slightly tighter spacing for 5 pieces
      );
      this._nextPreviewContainers.push(container);

      // Add 4 sprites to each container (max tetromino size)
      for (let j = 0; j < 4; j++) {
        const sprite = this.add.sprite(0, 0, "tiles", 1);
        sprite.setOrigin(0, 0); // Align previews to container top-left
        sprite.setVisible(false);
        sprite.setScale(nextScale); // Smaller scale for 5 pieces
        container.add(sprite);
      }
    }

    // Create Hold area on the LEFT side of the board, aligned vertically
    const previewBoxWidthPx = PREVIEW_CELL_PX * PREVIEW_BOX_COLS; // 4 cells wide
    const holdScale = 0.75;
    const holdX = ox - 20 - previewBoxWidthPx; // mirror right-side margin (20px)
    const holdCenterX = holdX + (16 * PREVIEW_BOX_COLS * holdScale) / 2;
    this.add
      .text(holdCenterX, oy, "Hold", {
        color: "#ffffff",
        fontFamily: "monospace",
        fontSize: "14px",
        resolution: Math.max(2, window.devicePixelRatio),
      })
      .setOrigin(0.5, 0);

    // Create container for hold piece preview, vertically aligned with first next item
    this._holdContainer = this.add.container(holdX, oy + 25);
    for (let i = 0; i < 4; i++) {
      const sprite = this.add.sprite(0, 0, "tiles", 1);
      sprite.setOrigin(0, 0); // Align hold piece to container top-left
      sprite.setVisible(false);
      sprite.setScale(holdScale); // Smaller for preview
      this._holdContainer.add(sprite);
    }
  }

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
    this._accumulator += delta;
    while (this._accumulator >= (this._fixedDt as unknown as number)) {
      this.processFixedTimeStep();
      this._accumulator -= this._fixedDt as unknown as number;
    }
  }

  private processFixedTimeStep(): void {
    this.processInputActions();
    this.processTickAction();

    if (this.handleAutoRestartIfTopOut()) return;

    this.updateModeUi();
    this.updatePresentation();
    this.checkGameOverState();
    this.handleAutoSpawn();
  }

  private processInputActions(): void {
    if (!this._input || !this._state) return;
    const events = this._input.drainEvents(this._fixedDt);
    const actions: Array<Action> = [];
    for (const e of events) {
      if (this.isDasEvent(e)) {
        actions.push(...this.processDasEvent(e));
      } else {
        actions.push(e);
      }
    }
    for (const a of actions) {
      const pair = this.withProcessedIfNeeded(a);
      for (const step of pair) {
        this._state = this.processActionWithLockPipeline(this._state, step);
      }
    }
  }

  private processDasEvent(e: DASEvent): Array<Action> {
    const out: Array<Action> = [];
    if (e.type === "KEY_DOWN") {
      const ctxDir = this._das.getState().context.direction;
      if (ctxDir !== undefined && ctxDir !== e.direction) {
        const upActions = this._das.send({
          direction: ctxDir,
          timestamp: e.timestamp,
          type: "KEY_UP",
        });
        out.push(...upActions);
      }
    }
    const dasActions = this._das.send(e);
    for (const a of dasActions) {
      if (
        a.type === "TapMove" &&
        (a as { optimistic?: boolean }).optimistic === true
      ) {
        this._pendingTap = { dir: a.dir, t: a.timestampMs };
      }
      if (a.type === "HoldStart") this._pendingTap = null;
    }
    if (e.type === "KEY_UP") {
      const p = this._pendingTap;
      if (p !== null && p.dir === e.direction) {
        const entry = createProcessedTapMove(p.dir, p.t);
        out.push({ entry, type: "AppendProcessed" });
        this._pendingTap = null;
      }
    }
    out.push(...dasActions);
    return out;
  }

  private withProcessedIfNeeded(action: Action): ReadonlyArray<Action> {
    // Only log finesse actions during active gameplay
    if (
      !this._state ||
      this._state.status !== "playing" ||
      !this._state.active
    ) {
      return [action];
    }
    if (action.type === "TapMove") {
      if (action.optimistic) return [action];
      const entry = createProcessedTapMove(action.dir, action.timestampMs);
      return [{ entry, type: "AppendProcessed" }, action];
    }
    if (action.type === "HoldStart") {
      const entry = createProcessedHoldMove(action.dir, action.timestampMs);
      return [{ entry, type: "AppendProcessed" }, action];
    }
    if (action.type === "Rotate") {
      const entry = createProcessedRotate(action.dir, action.timestampMs);
      return [{ entry, type: "AppendProcessed" }, action];
    }
    if (action.type === "HardDrop") {
      const entry = createProcessedHardDrop(action.timestampMs);
      return [{ entry, type: "AppendProcessed" }, action];
    }
    if (action.type === "SoftDrop") {
      if (action.on === this._softDropOn) return [action];
      this._softDropOn = action.on;
      const entry = createProcessedSoftDrop(action.on, action.timestampMs);
      return [{ entry, type: "AppendProcessed" }, action];
    }
    return [action];
  }

  private processTickAction(): void {
    if (!this._state) return;
    this._clock.tick(this._fixedDt);
    const currentTime = this._clock.nowMs() as unknown as number;

    // Always dispatch Tick with timestamp; physics/LD depend on deterministic timing
    this._state = this.processActionWithLockPipeline(this._state, {
      timestampMs: createTimestamp(currentTime),
      type: "Tick",
    });

    // Check if line clear delay has completed
    if (shouldCompleteLineClear(this._state, currentTime)) {
      this._state = this.processActionWithLockPipeline(this._state, {
        type: "CompleteLineClear",
      });
    }
  }

  private updatePresentation(): void {
    if (!this._state || !this._presenter) return;
    const vm = mapGameStateToViewModel(this._state);
    const plan = this._presenter.computePlan(this._vmPrev, vm);
    this._presenter.apply(plan);
    this._vmPrev = vm;

    // Update next piece previews immediately after state changes
    this.updateNextPreviews(this._nextPreviewContainers, this._state.nextQueue);

    // Update hold piece preview immediately after state changes
    this.updateHoldPreview(this._holdContainer, this._state.hold ?? null);

    // Draw guided overlays (column highlight + target)
    this.drawOverlays();
    this.drawUiEffects();
  }

  private drawOverlays(): void {
    if (!this._state) return;
    const overlays: ReadonlyArray<RenderOverlay> = selectDerivedOverlays(
      this._state,
    );
    // Clear layers
    this._overlayColumns?.clear();
    this._overlayTargets?.clear();

    // Draw column highlights first (background overlay)
    this.drawColumnHighlights(overlays);
    // Draw targets (foreground overlay)
    this.drawTargets(overlays);
  }

  private drawColumnHighlights(overlays: ReadonlyArray<RenderOverlay>): void {
    const g = this._overlayColumns;
    if (!g) return;
    for (const ov of overlays) {
      if (ov.kind !== "column-highlight") continue;
      const colorStr = ov.color ?? "#ffffff";
      const color = this.hexToNumber(colorStr);
      const alpha = ov.intensity ?? 0.08;
      g.fillStyle(color, alpha);
      for (const col of ov.columns) {
        const x = this._originX + col * this._tileSize;
        const y = this._originY;
        g.fillRect(x, y, this._tileSize, this._boardHeightPx);
      }
    }
  }

  private drawTargets(overlays: ReadonlyArray<RenderOverlay>): void {
    const g = this._overlayTargets;
    if (!g) return;
    for (const ov of overlays) {
      if (ov.kind !== "target") continue;
      const color = this.hexToNumber(ov.color ?? "#60a5fa");
      const alpha = ov.alpha ?? 0.6;
      g.lineStyle(2, color, alpha);
      for (const [cx, cy] of ov.cells) {
        const x = this._originX + (cx as unknown as number) * this._tileSize;
        const y = this._originY + (cy as unknown as number) * this._tileSize;
        g.strokeRect(x, y, this._tileSize, this._tileSize);
      }
    }
  }

  private drawUiEffects(): void {
    if (!this._state) return;
    const now = this._clock.nowMs() as unknown as number;
    const seen = new Set<number>();
    // screen-space dimensions are accessed via this.scale in helpers

    const toNum = (n: unknown): number =>
      Number.isFinite(n as number) ? (n as number) : 0;

    for (const effect of this._state.uiEffects) {
      if (effect.kind !== "floatingText") continue;
      this.renderFloatingText(effect, now, seen, toNum);
    }

    // Cleanup texts for effects no longer present
    for (const [id, obj] of this._effectsTexts) {
      if (!seen.has(id)) {
        obj.destroy();
        this._effectsTexts.delete(id);
        this._effectsStart.delete(id);
      }
    }
  }

  private ensureEffectText(
    id: number,
    text: string,
    color: string,
    fontPx: number,
    fontWeight?: number | string,
  ): Phaser.GameObjects.Text {
    let t = this._effectsTexts.get(id);
    if (t) return t;
    t = this.add.text(0, 0, text, {
      color,
      fontFamily: "monospace",
      fontSize: `${String(fontPx)}px`,
      fontStyle: String(fontWeight ?? 800),
    });
    t.setDepth(1000);
    // World-anchored so it moves with the board/camera
    t.setScrollFactor(1);
    this._effectsTexts.set(id, t);
    return t;
  }

  private computeEffectBoardPos(
    anchor: "topLeft" | "topRight" | "bottomLeft" | "bottomRight",
    offX: number,
    offY: number,
    driftYPx: number,
    p: number,
  ): { x: number; y: number; ox: number; oy: number } {
    const drift = driftYPx;
    const boardW = 10 * this._tileSize;
    const boardH = this._boardHeightPx;
    const x0 = this._originX;
    const y0 = this._originY;
    const mx = Math.max(0, Math.floor(this._tileSize * 0.5));
    const my = Math.max(0, Math.floor(this._tileSize * 0.5));
    switch (anchor) {
      case "topLeft":
        return {
          ox: 0,
          oy: 0,
          x: x0 + mx + offX,
          y: y0 + my + offY - drift * p,
        };
      case "topRight":
        return {
          ox: 1,
          oy: 0,
          x: x0 + boardW - mx - offX,
          y: y0 + my + offY - drift * p,
        };
      case "bottomLeft":
        return {
          ox: 0,
          oy: 1,
          x: x0 + mx + offX,
          y: y0 + boardH - my - offY - drift * p,
        };
      case "bottomRight":
      default:
        return {
          ox: 1,
          oy: 1,
          x: x0 + boardW - mx - offX,
          y: y0 + boardH - my - offY - drift * p,
        };
    }
  }

  private hexToNumber(hex: string): number {
    const s = hex.startsWith("#") ? hex.slice(1) : hex;
    const n = Number.parseInt(s, 16);
    return Number.isFinite(n) ? n : 0xffffff;
  }

  private checkGameOverState(): void {
    if (!this._state) return;
    if (this._state.status === "topOut") {
      this.time.delayedCall(1000, () => this.toResults());
    }
  }

  private handleAutoSpawn(): void {
    if (!this._state || this._state.active || this._state.status !== "playing")
      return;
    this.spawnNextPiece();
  }

  private handleAutoRestartIfTopOut(): boolean {
    if (!this._state || this._state.status !== "topOut") return false;
    const { currentMode, gameplay, timing } = this._state;

    // Reinitialize with retained stats
    this._state = this._reduce(this._state, {
      gameplay,
      mode: currentMode,
      retainStats: true,
      seed: this.randomSeed(),
      timestampMs: fromNow(),
      timing,
      type: "Init",
    });

    // Dispatch to global state
    this.safeDispatch({
      gameplay,
      mode: currentMode,
      retainStats: true,
      seed: this.randomSeed(),
      timestampMs: fromNow(),
      timing,
      type: "Init",
    });

    // Spawn the first piece for the restarted game
    this.spawnNextPiece();
    return true;
  }

  private updateModeUi(): void {
    if (!this._state) return;
    const mode = gameModeRegistry.get(this._state.currentMode);
    if (!mode) return;

    this.updateModeGuidance(mode);
    this.updateModeAdapterData();
    this.updateBoardDecorations(mode);
  }

  private updateModeGuidance(mode: IGameMode): void {
    if (!this._state) return;
    if (typeof mode.getGuidance === "function") {
      const guidance = mode.getGuidance(this._state) ?? null;
      const prev = this._state.guidance ?? null;
      if (!simpleEqual(guidance, prev)) {
        // Update local state and dispatch to global state
        this._state = this._reduce(this._state, {
          guidance,
          type: "UpdateGuidance",
        });
        this.safeDispatch({ guidance, type: "UpdateGuidance" });
      }
    }
  }

  private updateModeAdapterData(): void {
    if (!this._state) return;
    const modeName = this._state
      .currentMode as keyof typeof this._modeUiAdapterRegistry;
    const adapter = this._modeUiAdapterRegistry[modeName];
    const derivedUi = adapter.computeDerivedUi(this._state);
    if (derivedUi === null) return;

    const currentModeData =
      typeof this._state.modeData === "object" && this._state.modeData !== null
        ? (this._state.modeData as Record<string, unknown>)
        : {};
    const mergedModeData = { ...currentModeData, ...derivedUi };

    if (!this.shallowEqual(mergedModeData, currentModeData)) {
      this._state = this._reduce(this._state, {
        data: mergedModeData,
        type: "UpdateModeData",
      });
      this.safeDispatch({ data: mergedModeData, type: "UpdateModeData" });
    }
  }

  private shallowEqual(
    a: Record<string, unknown>,
    b: Record<string, unknown>,
  ): boolean {
    if (a === b) return true;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const k of aKeys) {
      if (a[k] !== b[k]) return false;
    }
    return true;
  }

  private updateBoardDecorations(mode: IGameMode): void {
    if (!this._state) return;
    if (typeof mode.getBoardDecorations === "function") {
      const decorations = mode.getBoardDecorations(this._state) ?? null;
      const prev = this._state.boardDecorations ?? null;
      if (!simpleEqual(decorations, prev)) {
        // Update local state and dispatch to global state
        this._state = this._reduce(this._state, {
          decorations,
          type: "UpdateBoardDecorations",
        });
        this.safeDispatch({ decorations, type: "UpdateBoardDecorations" });
      }
    }
  }

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
    const timePlayedMs = stats.timePlayedMs as unknown as number;

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
    const mode = gameModeRegistry.get(modeName);
    if (!mode || !this._state) return;

    // Get mode's initial config before reinitialization to avoid race condition
    const modeConfig =
      typeof mode.initialConfig === "function" ? mode.initialConfig() : {};

    // Merge current settings with mode-provided defaults to smooth transitions
    const { gameplay, timing } = this._state;
    const mergedGameplay = { ...gameplay, ...modeConfig.gameplay };
    const mergedTiming = { ...timing, ...modeConfig.timing };

    // Reinitialize with correct merged config
    this._state = this._reduce(this._state, {
      gameplay: mergedGameplay,
      mode: modeName,
      retainStats: true, // Keep stats across mode switches
      seed: this.randomSeed(),
      timestampMs: fromNow(),
      timing: mergedTiming,
      type: "Init",
    });

    // Dispatch to global state
    this.safeDispatch({
      gameplay: mergedGameplay,
      mode: modeName,
      retainStats: true,
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

  // Initialize a game mode with its configuration and activation hooks
  private initializeMode(modeName: string): void {
    const mode = gameModeRegistry.get(modeName);
    if (!mode) return;

    this.applyModeInitialConfig(mode);
    this.applyModePrompt(mode);
    this.runModeActivationHook(mode);
    this.setupModeRng(mode);
  }

  private applyModeInitialConfig(mode: IGameMode): void {
    if (!this._state || typeof mode.initialConfig !== "function") return;

    const modeConfig = mode.initialConfig();
    const { gameplay, timing } = this._state;

    // Merge current settings with mode-provided defaults
    const mergedGameplay = { ...gameplay, ...modeConfig.gameplay };
    const mergedTiming = { ...timing, ...modeConfig.timing };

    // Apply timing updates
    if (modeConfig.timing) {
      this._state = this._reduce(this._state, {
        timing: mergedTiming,
        type: "UpdateTiming",
      });
      this.safeDispatch({ timing: mergedTiming, type: "UpdateTiming" });
    }

    // Apply gameplay updates
    if (modeConfig.gameplay) {
      this._state = this._reduce(this._state, {
        gameplay: mergedGameplay,
        type: "UpdateGameplay",
      });
      this.safeDispatch({ gameplay: mergedGameplay, type: "UpdateGameplay" });
    }
  }

  private applyModePrompt(mode: IGameMode): void {
    if (!this._state || !mode.shouldPromptNext(this._state)) return;
    const prompt = mode.getNextPrompt(this._state);
    if (prompt !== null) {
      this._state = this._reduce(this._state, {
        prompt,
        type: "UpdateModePrompt",
      });
      this.safeDispatch({ prompt, type: "UpdateModePrompt" });
    }
  }

  private runModeActivationHook(mode: IGameMode): void {
    if (!this._state || typeof mode.onActivated !== "function") return;
    const activation = mode.onActivated(this._state);
    if (activation.modeData !== undefined) {
      this._state = this._reduce(this._state, {
        data: activation.modeData,
        type: "UpdateModeData",
      });
      this.safeDispatch({ data: activation.modeData, type: "UpdateModeData" });
    }
    if (Array.isArray(activation.postActions)) {
      const acts = activation.postActions as ReadonlyArray<Action>;
      for (const act of acts) {
        this._state = this.processActionWithLockPipeline(this._state, act);
        this.safeDispatch(act);
      }
    }
  }

  private setupModeRng(mode: IGameMode): void {
    if (!this._state) return;

    const desired = Math.max(5, this._state.gameplay.nextPieceCount ?? 5);
    const seededRng = getActiveRng(mode, this.randomSeed(), this._state.rng);
    const { newRng, pieces } =
      typeof mode.getPreview === "function"
        ? mode.getPreview(this._state, seededRng, desired)
        : seededRng.getNextPieces(desired);

    this._state = this._reduce(this._state, {
      pieces,
      rng: newRng,
      type: "ReplacePreview",
    });
    this.safeDispatch({ pieces, rng: newRng, type: "ReplacePreview" });
    // Ensure we have enough pieces after initial setup
    this._state = this.ensurePreviewFilled(this._state);
  }

  private randomSeed(): Seed {
    // Use cryptographically-strong randomness for seed generation
    const rnd = new Uint32Array(2);
    crypto.getRandomValues(rnd);
    const [a, b] = Array.from(rnd) as [number, number];
    return createSeed(`${a.toString(36)}-${b.toString(36)}`);
  }

  private ensurePreviewFilled(state: GameState): GameState {
    const mode = gameModeRegistry.get(state.currentMode);
    const desired = Math.max(5, state.gameplay.nextPieceCount ?? 5);
    const refill = planPreviewRefill(state, mode, desired);
    if (!refill || refill.pieces.length === 0) return state;

    const refillAction = {
      pieces: refill.pieces,
      rng: refill.newRng,
      type: "RefillPreview" as const,
    };

    const reduced = this._reduce(state, refillAction);
    this.safeDispatch(refillAction);
    return reduced;
  }

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
    // Apply the action through the reducer
    const prevQueueLen = state.nextQueue.length;
    let newState = this._reduce(state, action);

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
          newState = this._reduce(newState, pipelineAction);
        },
        this.createFinesseAnalyzer(),
        fromNow(),
      );
    }

    // If preview shrank, top it up once using the active mode policy
    if (newState.nextQueue.length < prevQueueLen) {
      newState = this.ensurePreviewFilled(newState);
    }

    return newState;
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

  private isDasEvent(e: InputEvent): e is DASEvent {
    return (
      e.type === "KEY_DOWN" ||
      e.type === "KEY_UP" ||
      e.type === "TIMER_TICK" ||
      e.type === "UPDATE_CONFIG"
    );
  }

  private pieceKindToFrame(kind?: TetrominoPieceId): number {
    switch (kind) {
      case "I":
        return 1; // Cyan
      case "J":
        return 2; // Blue
      case "L":
        return 3; // Orange
      case "O":
        return 4; // Yellow
      case "S":
        return 5; // Green
      case "T":
        return 6; // Purple
      case "Z":
        return 7; // Red
      case undefined:
        return 1; // Default to cyan if no kind specified
      default:
        return 1; // Should never reach here
    }
  }

  private updateNextPreviews(
    containers: Array<Phaser.GameObjects.Container>,
    nextQueue: ReadonlyArray<string>,
  ): void {
    // Hide all sprites first
    containers.forEach((container) => {
      container.list.forEach((sprite) => {
        if (sprite instanceof Phaser.GameObjects.Sprite) {
          sprite.setVisible(false);
        }
      });
    });

    // Show pieces for each position in queue (up to 5)
    for (let i = 0; i < Math.min(containers.length, nextQueue.length); i++) {
      const pieceId = nextQueue[i] as TetrominoPieceId | undefined;
      const container = containers[i];
      if (
        pieceId !== undefined &&
        container !== undefined &&
        pieceId in PIECES
      ) {
        this.renderPieceInContainer(container, pieceId, true);
      }
    }
  }

  private updateHoldPreview(
    container: Phaser.GameObjects.Container | null,
    holdPiece: string | null,
  ): void {
    if (!container) return;

    // Hide all sprites first
    container.list.forEach((sprite) => {
      if (sprite instanceof Phaser.GameObjects.Sprite) {
        sprite.setVisible(false);
      }
    });

    // Show hold piece if one exists
    if (holdPiece !== null && holdPiece in PIECES) {
      this.renderPieceInContainer(
        container,
        holdPiece as TetrominoPieceId,
        false,
      );
    }
  }

  private renderPieceInContainer(
    container: Phaser.GameObjects.Container,
    pieceId: TetrominoPieceId,
    center: boolean,
  ): void {
    const piece = PIECES[pieceId];
    const spawnCells = piece.cells.spawn; // Use spawn rotation for preview
    // Compute bounding box to normalize and optionally center inside a 4x3 box
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const [cx, cy] of spawnCells) {
      if (cx < minX) minX = cx;
      if (cy < minY) minY = cy;
      if (cx > maxX) maxX = cx;
      if (cy > maxY) maxY = cy;
    }
    const widthCells = maxX - minX + 1;
    const heightCells = maxY - minY + 1;
    const offsetCellsX = center ? (PREVIEW_BOX_COLS - widthCells) / 2 : 0;
    const offsetCellsY = center ? (PREVIEW_BOX_ROWS - heightCells) / 2 : 0;
    const frame = this.pieceKindToFrame(pieceId);
    const sprites = container.list.filter(
      (obj) => obj instanceof Phaser.GameObjects.Sprite,
    );

    // Position sprites based on piece shape
    for (let i = 0; i < Math.min(spawnCells.length, sprites.length); i++) {
      const cell = spawnCells[i];
      const sprite = sprites[i];
      if (cell && sprite) {
        // Position relative to container origin, scaled and optionally centered
        const relX = (cell[0] - minX + offsetCellsX) * PREVIEW_CELL_PX;
        const relY = (cell[1] - minY + offsetCellsY) * PREVIEW_CELL_PX;
        sprite.setPosition(relX, relY);
        sprite.setFrame(frame);
        sprite.setVisible(true);
      }
    }
  }
}
