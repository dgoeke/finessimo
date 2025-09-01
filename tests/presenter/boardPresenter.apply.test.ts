import { describe, expect, it } from "@jest/globals";

import { BoardPresenter } from "../../src/presentation/phaser/presenter/BoardPresenter";
import { toPx } from "../../src/presentation/phaser/presenter/viewModel";

import type {
  BlitterLike,
  BobLike,
  ContainerLike,
} from "../../src/presentation/phaser/presenter/BoardPresenter";
import type { Col, Row } from "../../src/presentation/phaser/presenter/types";

function asCol(n: number): Col {
  return (n | 0) as Col;
}
function asRow(n: number): Row {
  return (n | 0) as Row;
}

class FakeBob implements BobLike {
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

class FakeBlitter implements BlitterLike {
  public creates: Array<{ x: number; y: number; frame: number; bob: FakeBob }> =
    [];
  create(x: number, y: number, frame: number): BobLike {
    const bob = new FakeBob();
    this.creates.push({ bob, frame, x, y });
    return bob;
  }
}

class FakeContainer implements ContainerLike {
  public sets: Array<{ x: number; y: number }> = [];
  setPosition(x: number, y: number): void {
    this.sets.push({ x, y });
  }
}

describe("BoardPresenter.apply (Phase 3)", () => {
  it("puts and deletes Bobs via Blitter and sets piece positions", () => {
    const blitter = new FakeBlitter();
    const active = new FakeContainer();
    const ghost = new FakeContainer();
    const presenter = new BoardPresenter({
      activeContainer: active,
      blitter,
      ghostContainer: ghost,
      originXPx: 0,
      originYPx: 0,
      tileSizePx: 10,
    });

    // 1) Put one tile at (1,2) with frame 3
    presenter.apply([
      {
        dels: [],
        puts: [{ col: asCol(1), frame: 3, row: asRow(2) }],
        t: "TileDiff",
      },
    ]);
    expect(blitter.creates.length).toBe(1);
    expect(blitter.creates[0]).toMatchObject({ frame: 3, x: 10, y: 20 });
    const createdEntry = blitter.creates[0];
    expect(createdEntry).toBeDefined();
    if (!createdEntry) throw new Error("expected created entry");
    expect(createdEntry.bob.visible).toBe(true);

    // 2) Move active and ghost containers
    presenter.apply([
      { id: "active", t: "PiecePos", xPx: toPx(30), yPx: toPx(40) },
      { id: "ghost", t: "PiecePos", xPx: toPx(50), yPx: toPx(60) },
    ]);
    expect(active.sets[active.sets.length - 1]).toEqual({ x: 30, y: 40 });
    expect(ghost.sets[ghost.sets.length - 1]).toEqual({ x: 50, y: 60 });

    // 3) Delete the tile; bob should be hidden
    presenter.apply([
      { dels: [{ col: asCol(1), row: asRow(2) }], puts: [], t: "TileDiff" },
    ]);
    expect(createdEntry.bob.visible).toBe(false);
  });
});
