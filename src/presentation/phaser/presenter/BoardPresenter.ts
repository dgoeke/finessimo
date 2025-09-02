import { toPx } from "./viewModel";

import type { AudioBus } from "./AudioBus";
import type { CameraFxAdapter } from "./Effects";
import type {
  Presenter,
  RenderPlan,
  ViewModel,
  Col,
  Row,
  Px,
  Ms,
} from "./types";

// Effect magnitude constants for consistent behavior
const EFFECT_MAGNITUDES = {
  LINE_BASE_SHAKE: 0.004,
  LINE_SCALE_FACTOR: 0.002,
  LOCK_SHAKE: 0.003,
  SPAWN_ZOOM: 1.05,
  TOPOUT_SHAKE: 0.005,
} as const;

// Effect duration constants (in milliseconds)
const EFFECT_DURATIONS = {
  LINE_CLEAR_SHAKE_MS: 200,
  LOCK_SHAKE_MS: 100,
  SPAWN_ZOOM_MS: 150,
  TOPOUT_SHAKE_MS: 400,
} as const;

// Effect builder functions for consistent effect creation
const createShakeEffect = (ms: number, magnitude: number): RenderPlan => ({
  kind: "shake",
  magnitude,
  ms: ms as Ms,
  t: "CameraFx",
});

const createZoomEffect = (ms: number, zoom: number): RenderPlan => ({
  kind: "zoomTo",
  magnitude: zoom,
  ms: ms as Ms,
  t: "CameraFx",
});

const createSoundEffect = (
  name: "spawn" | "lock" | "line" | "topout",
): RenderPlan => ({
  name,
  t: "SoundCue",
});

// Minimal Phaser-like surface abstractions (for tests, no Phaser import)
export type BobLike = {
  reset(x: number, y: number, frame?: number): void;
  setVisible(v: boolean): void;
};

export type BlitterLike = {
  create(x: number, y: number, frame: number): BobLike;
};

export type ContainerLike = {
  setPosition(x: number, y: number): void;
  list?: Array<unknown>;
};

export type BoardPresenterOptions = Readonly<{
  tileSizePx: number;
  originXPx: number;
  originYPx: number;
  blitter: BlitterLike;
  activeContainer: ContainerLike;
  ghostContainer: ContainerLike;
  fx?: CameraFxAdapter;
  audio?: AudioBus;
}>;

function key(col: Col, row: Row): string {
  const c = (col as unknown as number) | 0;
  const r = (row as unknown as number) | 0;
  return `${String(c)},${String(r)}`;
}

function minColRow(cells: ReadonlyArray<Readonly<{ col: Col; row: Row }>>): {
  col: Col;
  row: Row;
} {
  let minC = Number.POSITIVE_INFINITY;
  let minR = Number.POSITIVE_INFINITY;
  for (const c of cells) {
    const cc = c.col as unknown as number;
    const rr = c.row as unknown as number;
    if (cc < minC) minC = cc;
    if (rr < minR) minR = rr;
  }
  return { col: (minC | 0) as Col, row: (minR | 0) as Row };
}

function pxFromColRow(
  col: Col,
  row: Row,
  tile: number,
  originX: number,
  originY: number,
): { xPx: Px; yPx: Px } {
  const x = originX + (col as unknown as number) * tile;
  const y = originY + (row as unknown as number) * tile;
  return { xPx: toPx(x), yPx: toPx(y) };
}

function pieceKindToFrame(
  kind?: "I" | "J" | "L" | "O" | "S" | "T" | "Z",
): number {
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

function forEachBoardCell(
  prev: ViewModel | null,
  next: ViewModel,
  cb: (x: number, y: number, prevVal: number, nextVal: number) => void,
): void {
  const h = next.board.length;
  const w = (next.board[0]?.length ?? 0) | 0;
  for (let y = 0; y < h; y++) {
    const rowNext = next.board[y] ?? [];
    const rowPrev = prev?.board[y] ?? [];
    for (let x = 0; x < w; x++) {
      const vPrev = rowPrev[x] ?? 0;
      const vNext = rowNext[x] ?? 0;
      cb(x, y, vPrev, vNext);
    }
  }
}

/**
 * BoardPresenter implements the RenderPlan generator (pure) and a thin
 * imperative apply() that targets a Phaser-like surface via injected adapters.
 */
export class BoardPresenter implements Presenter {
  private readonly opts: BoardPresenterOptions;
  // Track locked-cell bobs by grid coordinate
  private readonly bobs = new Map<string, BobLike>();

  constructor(opts: BoardPresenterOptions) {
    this.opts = opts;
  }

  computePlan(
    prev: ViewModel | null,
    next: ViewModel,
  ): ReadonlyArray<RenderPlan> {
    const plan: Array<RenderPlan> = [];
    const diff = this.diffBoard(prev, next);
    if (diff) plan.push(diff);
    plan.push(...this.piecePosPlans(prev, next));
    plan.push(...this.fxAndSoundPlans(prev, next));
    return plan as ReadonlyArray<RenderPlan>;
  }

  private diffBoard(
    prev: ViewModel | null,
    next: ViewModel,
  ): RenderPlan | null {
    const puts: Array<{ col: Col; row: Row; frame: number }> = [];
    const dels: Array<{ col: Col; row: Row }> = [];
    forEachBoardCell(prev, next, (x, y, vPrev, vNext) => {
      if (vPrev === vNext) return;
      if (vNext === 0) dels.push({ col: (x | 0) as Col, row: (y | 0) as Row });
      else
        puts.push({
          col: (x | 0) as Col,
          frame: vNext | 0,
          row: (y | 0) as Row,
        });
    });
    return puts.length > 0 || dels.length > 0
      ? { dels, puts, t: "TileDiff" }
      : null;
  }

  private piecePosPlans(
    prev: ViewModel | null,
    next: ViewModel,
  ): ReadonlyArray<RenderPlan> {
    const prevActiveCells = prev?.active?.cells ?? null;
    const nextActiveCells = next.active?.cells ?? null;
    const prevGhostCells = prev?.ghost?.cells ?? null;
    const nextGhostCells = next.ghost?.cells ?? null;
    const pieceKind = next.active?.kind;

    return [
      ...this.piecePlanFor(
        prevActiveCells,
        nextActiveCells,
        "active",
        pieceKind,
      ),
      ...this.piecePlanFor(prevGhostCells, nextGhostCells, "ghost", pieceKind),
    ] as const satisfies ReadonlyArray<RenderPlan>;
  }

  private piecePlanFor(
    prevCells: ReadonlyArray<{ col: Col; row: Row }> | null,
    nextCells: ReadonlyArray<{ col: Col; row: Row }> | null,
    id: "active" | "ghost",
    kind?: "I" | "J" | "L" | "O" | "S" | "T" | "Z",
  ): ReadonlyArray<RenderPlan> {
    // Always generate a plan when cells change (for visibility and positioning)
    const cellsChanged = !this.cellsEqual(prevCells, nextCells);
    if (!cellsChanged) return [] as const;

    if (!nextCells || nextCells.length === 0) {
      // Hide the piece
      const plan: RenderPlan = {
        cells: [],
        id,
        t: "PiecePos",
        xPx: toPx(0),
        yPx: toPx(0),
      };
      if (kind !== undefined) {
        return [{ ...plan, kind }];
      }
      return [plan];
    }

    const nextMin = minColRow(nextCells);
    const { originXPx: ox, originYPx: oy, tileSizePx: tile } = this.opts;
    const { xPx, yPx } = pxFromColRow(nextMin.col, nextMin.row, tile, ox, oy);

    // Convert cells to relative positions within the container
    const cells = nextCells.map((cell) => ({
      col: (cell.col as unknown as number) - (nextMin.col as unknown as number),
      row: (cell.row as unknown as number) - (nextMin.row as unknown as number),
    }));

    const plan: RenderPlan = { cells, id, t: "PiecePos", xPx, yPx };
    if (kind !== undefined) {
      return [{ ...plan, kind }];
    }
    return [plan];
  }

  private cellsEqual(
    a: ReadonlyArray<{ col: Col; row: Row }> | null,
    b: ReadonlyArray<{ col: Col; row: Row }> | null,
  ): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i]?.col !== b[i]?.col || a[i]?.row !== b[i]?.row) return false;
    }
    return true;
  }

  private fxAndSoundPlans(
    prev: ViewModel | null,
    next: ViewModel,
  ): ReadonlyArray<RenderPlan> {
    const out: Array<RenderPlan> = [];

    // Top-out effects (existing)
    const wasTopOut = prev?.topOut ?? false;
    const isTopOut = next.topOut;
    if (!wasTopOut && isTopOut) {
      out.push(
        createShakeEffect(
          EFFECT_DURATIONS.TOPOUT_SHAKE_MS,
          EFFECT_MAGNITUDES.TOPOUT_SHAKE,
        ),
      );
      out.push(createSoundEffect("topout"));
    }

    // Spawn effects
    if (next.justSpawned) {
      out.push(createSoundEffect("spawn"));
      // Subtle zoom effect on spawn
      out.push(
        createZoomEffect(
          EFFECT_DURATIONS.SPAWN_ZOOM_MS,
          EFFECT_MAGNITUDES.SPAWN_ZOOM,
        ),
      );
    }

    // Lock effects
    if (next.justLocked) {
      out.push(createSoundEffect("lock"));
      // Small shake on piece lock
      out.push(
        createShakeEffect(
          EFFECT_DURATIONS.LOCK_SHAKE_MS,
          EFFECT_MAGNITUDES.LOCK_SHAKE,
        ),
      );
    }

    // Line clear effects
    if (next.linesJustCleared > 0) {
      out.push(createSoundEffect("line"));
      // Scale shake intensity with number of lines cleared
      const intensity =
        EFFECT_MAGNITUDES.LINE_BASE_SHAKE +
        (next.linesJustCleared - 1) * EFFECT_MAGNITUDES.LINE_SCALE_FACTOR;
      out.push(
        createShakeEffect(EFFECT_DURATIONS.LINE_CLEAR_SHAKE_MS, intensity),
      );
    }

    return out as ReadonlyArray<RenderPlan>;
  }

  apply(plan: ReadonlyArray<RenderPlan>): void {
    for (const p of plan) {
      switch (p.t) {
        case "TileDiff":
          this.applyTileDiff(p);
          break;
        case "PiecePos":
          this.applyPiecePos(p);
          break;
        case "CameraFx":
          this.applyCameraFx(p);
          break;
        case "SoundCue":
          this.applySoundCue(p);
          break;
        case "UiHint":
        case "Noop":
          // Handled by other adapters in later phases; no-op for now
          break;
        default:
          this.assertNever(p);
      }
    }
  }

  private applyTileDiff(p: Extract<RenderPlan, { t: "TileDiff" }>): void {
    const { originXPx: ox, originYPx: oy, tileSizePx: tile } = this.opts;
    // Deletes first to prevent flicker if a cell is changed frame within same tick
    for (const d of p.dels) {
      const k = key(d.col, d.row);
      const bob = this.bobs.get(k);
      if (bob) {
        bob.setVisible(false);
        this.bobs.delete(k);
      }
    }
    for (const put of p.puts) {
      const k = key(put.col, put.row);
      const px = ox + (put.col as unknown as number) * tile;
      const py = oy + (put.row as unknown as number) * tile;
      const existing = this.bobs.get(k);
      if (existing) {
        existing.reset(px, py, put.frame);
        existing.setVisible(true);
      } else {
        const bob = this.opts.blitter.create(px, py, put.frame);
        this.bobs.set(k, bob);
      }
    }
  }

  private applyPiecePos(p: Extract<RenderPlan, { t: "PiecePos" }>): void {
    const target =
      p.id === "active" ? this.opts.activeContainer : this.opts.ghostContainer;
    target.setPosition(p.xPx as unknown as number, p.yPx as unknown as number);

    // Update sprites within the container if we have pooled sprites and cell data
    if (target.list && p.cells) {
      const sprites = target.list as Array<{
        setVisible(visible: boolean): void;
        setPosition(x: number, y: number): void;
        setFrame?(frame: number): void;
      }>;
      const { tileSizePx } = this.opts;

      // Hide all sprites first
      for (const sprite of sprites) {
        sprite.setVisible(false);
      }

      // Show and position sprites for each cell
      const frame = pieceKindToFrame(p.kind);
      for (let i = 0; i < Math.min(p.cells.length, sprites.length); i++) {
        const cell = p.cells[i];
        const sprite = sprites[i];
        if (cell && sprite) {
          sprite.setPosition(cell.col * tileSizePx, cell.row * tileSizePx);
          sprite.setVisible(true);
          sprite.setFrame?.(frame);
        }
      }
    }
  }

  private applyCameraFx(p: Extract<RenderPlan, { t: "CameraFx" }>): void {
    const fx = this.opts.fx;
    if (!fx) return;
    switch (p.kind) {
      case "fadeIn":
        fx.fadeIn(p.ms);
        return;
      case "fadeOut":
        fx.fadeOut(p.ms);
        return;
      case "shake":
        fx.shake(p.ms, p.magnitude);
        return;
      case "zoomTo":
        fx.zoomTo(p.ms, typeof p.magnitude === "number" ? p.magnitude : 1);
        return;
      default:
        this.assertNever(p.kind);
    }
  }

  private applySoundCue(p: Extract<RenderPlan, { t: "SoundCue" }>): void {
    const audio = this.opts.audio;
    if (!audio) return;
    audio.play(p.name);
  }

  private assertNever(_x: never): void {
    // no-op, used for compile-time exhaustiveness
  }
}
