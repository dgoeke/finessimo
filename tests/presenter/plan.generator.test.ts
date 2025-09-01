import { describe, expect, it } from "@jest/globals";

import { BoardPresenter } from "../../src/presentation/phaser/presenter/BoardPresenter";

import type {
  BlitterLike,
  BobLike,
  ContainerLike,
} from "../../src/presentation/phaser/presenter/BoardPresenter";
import type {
  ViewModel,
  Col,
  Row,
} from "../../src/presentation/phaser/presenter/types";

function asCol(n: number): Col {
  return (n | 0) as Col;
}
function asRow(n: number): Row {
  return (n | 0) as Row;
}

function makeVM(
  board: Array<Array<number>>,
  opts?: {
    active?: {
      cells: Array<{ col: Col; row: Row }>;
      kind: NonNullable<ViewModel["active"]>["kind"];
    };
    ghost?: { cells: Array<{ col: Col; row: Row }> };
    topOut?: boolean;
  },
): ViewModel {
  const vm: ViewModel = {
    board,
    hud: { lines: 0, mode: "test", score: 0 },
    topOut: opts?.topOut ?? false,
    ...(opts?.active
      ? { active: { cells: opts.active.cells, kind: opts.active.kind } }
      : {}),
    ...(opts?.ghost ? { ghost: { cells: opts.ghost.cells } } : {}),
  } as const;
  return vm;
}

describe("BoardPresenter.computePlan (Phase 3)", () => {
  class TestBob implements BobLike {
    public visible = true;
    public resets: Array<{ x: number; y: number; frame?: number }> = [];
    reset(x: number, y: number, frame?: number): void {
      if (frame !== undefined) this.resets.push({ frame, x, y });
      else this.resets.push({ x, y });
    }
    setVisible(v: boolean): void {
      this.visible = v;
    }
  }
  class TestBlitter implements BlitterLike {
    create(_x: number, _y: number, _frame: number): BobLike {
      return new TestBob();
    }
  }
  class TestContainer implements ContainerLike {
    setPosition(_x: number, _y: number): void {
      // non-empty noop to satisfy lint
      if (Number.isNaN(_x) && Number.isNaN(_y)) throw new Error("noop");
    }
  }

  const presenter = new BoardPresenter({
    activeContainer: new TestContainer(),
    blitter: new TestBlitter(),
    ghostContainer: new TestContainer(),
    originXPx: 0,
    originYPx: 0,
    tileSizePx: 10,
  });

  const isTileDiff = (
    p: ReturnType<typeof presenter.computePlan>[number],
  ): p is Extract<
    ReturnType<typeof presenter.computePlan>[number],
    { t: "TileDiff" }
  > => p.t === "TileDiff";

  it("produces TileDiff puts when cells become non-zero", () => {
    const prev: ViewModel | null = null;
    const next = makeVM([
      [0, 1, 0],
      [0, 0, 0],
      [2, 0, 3],
    ]);
    const plan = presenter.computePlan(prev, next);
    const diff = plan.find(isTileDiff);
    expect(diff).toBeDefined();
    if (!diff) return;
    expect(diff.t).toBe("TileDiff");
    expect(diff.puts).toEqual(
      expect.arrayContaining([
        { col: asCol(1), frame: 1, row: asRow(0) },
        { col: asCol(0), frame: 2, row: asRow(2) },
        { col: asCol(2), frame: 3, row: asRow(2) },
      ]),
    );
    expect(diff.dels.length).toBe(0);
  });

  it("produces dels when cells become zero", () => {
    const prev = makeVM([
      [0, 4, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    const next = makeVM([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    const plan = presenter.computePlan(prev, next);
    const diff = plan.find(isTileDiff);
    expect(diff).toBeDefined();
    if (!diff) return;
    expect(diff.t).toBe("TileDiff");
    expect(diff.dels).toEqual(
      expect.arrayContaining([{ col: asCol(1), row: asRow(0) }]),
    );
    expect(diff.puts.length).toBe(0);
  });

  it("emits PiecePos for active/ghost min cell change and FX/Sound on topOut", () => {
    const prev = makeVM(
      [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
      {
        active: { cells: [{ col: asCol(2), row: asRow(2) }], kind: "T" },
        ghost: { cells: [{ col: asCol(2), row: asRow(0) }] },
        topOut: false,
      },
    );
    const next = makeVM(
      [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ],
      {
        active: { cells: [{ col: asCol(1), row: asRow(1) }], kind: "T" },
        ghost: { cells: [{ col: asCol(1), row: asRow(0) }] },
        topOut: true,
      },
    );
    const plan = presenter.computePlan(prev, next);
    // One active move, one ghost move, and FX + Sound for topOut
    const pieceMoves = plan.filter((p) => p.t === "PiecePos");
    expect(pieceMoves.length).toBe(2);
    expect(plan.some((p) => p.t === "CameraFx")).toBe(true);
    expect(plan.some((p) => p.t === "SoundCue" && p.name === "topout")).toBe(
      true,
    );
  });
});
