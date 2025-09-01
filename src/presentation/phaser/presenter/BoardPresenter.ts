import { toPx } from "./viewModel";

import type {
  Presenter,
  RenderPlan,
  ViewModel,
  Col,
  Row,
  Px,
  Ms,
} from "./types";

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
};

export type BoardPresenterOptions = Readonly<{
  tileSizePx: number;
  originXPx: number;
  originYPx: number;
  blitter: BlitterLike;
  activeContainer: ContainerLike;
  ghostContainer: ContainerLike;
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
    return [
      ...this.piecePlanFor(
        prev?.active?.cells ?? null,
        next.active?.cells ?? null,
        "active",
      ),
      ...this.piecePlanFor(
        prev?.ghost?.cells ?? null,
        next.ghost?.cells ?? null,
        "ghost",
      ),
    ] as const satisfies ReadonlyArray<RenderPlan>;
  }

  private piecePlanFor(
    prevCells: ReadonlyArray<{ col: Col; row: Row }> | null,
    nextCells: ReadonlyArray<{ col: Col; row: Row }> | null,
    id: "active" | "ghost",
  ): ReadonlyArray<RenderPlan> {
    if (!nextCells || nextCells.length === 0) return [] as const;
    const nextMin = minColRow(nextCells);
    const prevMin =
      prevCells && prevCells.length > 0 ? minColRow(prevCells) : null;
    const moved =
      !prevMin || prevMin.col !== nextMin.col || prevMin.row !== nextMin.row;
    if (!moved) return [] as const;
    const { originXPx: ox, originYPx: oy, tileSizePx: tile } = this.opts;
    const { xPx, yPx } = pxFromColRow(nextMin.col, nextMin.row, tile, ox, oy);
    return [{ id, t: "PiecePos", xPx, yPx }];
  }

  private fxAndSoundPlans(
    prev: ViewModel | null,
    next: ViewModel,
  ): ReadonlyArray<RenderPlan> {
    const out: Array<RenderPlan> = [];
    const wasTopOut = prev?.topOut ?? false;
    const isTopOut = next.topOut;
    if (!wasTopOut && isTopOut) {
      out.push({
        kind: "shake",
        magnitude: 0.005,
        ms: 400 as number as Ms,
        t: "CameraFx",
      });
      out.push({ name: "topout", t: "SoundCue" });
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
        case "SoundCue":
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
  }

  private assertNever(_x: never): void {
    // no-op, used for compile-time exhaustiveness
  }
}
