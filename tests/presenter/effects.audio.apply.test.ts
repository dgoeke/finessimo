import { describe, expect, it } from "@jest/globals";

import { BoardPresenter } from "../../src/presentation/phaser/presenter/BoardPresenter";
import { toPx } from "../../src/presentation/phaser/presenter/viewModel";

import type {
  BlitterLike,
  BobLike,
  ContainerLike,
} from "../../src/presentation/phaser/presenter/BoardPresenter";
import type { Ms } from "../../src/presentation/phaser/presenter/types";

class NopBob implements BobLike {
  reset(x?: number, y?: number, frame?: number): void {
    // Reference args to satisfy lint about empty bodies
    if (typeof x === "number" && typeof y === "number") {
      const _n = x + y + (typeof frame === "number" ? frame : 0);
      if (_n === Number.MIN_VALUE) throw new Error("noop");
    }
  }
  setVisible(v?: boolean): void {
    if (typeof v === "boolean") {
      // touch value to avoid empty body
      const _n = v ? 1 : 0;
      if (_n === Number.MAX_SAFE_INTEGER) throw new Error("noop");
    }
  }
}
class NopBlitter implements BlitterLike {
  create(): BobLike {
    return new NopBob();
  }
}
class NopContainer implements ContainerLike {
  setPosition(x?: number, y?: number): void {
    if ((x ?? 0) + (y ?? 0) === Number.NEGATIVE_INFINITY) {
      throw new Error("noop");
    }
  }
}

describe("BoardPresenter.apply — CameraFx & Audio (Phase 5)", () => {
  it("invokes fx and audio adapters for CameraFx and SoundCue", () => {
    const calls: Array<string> = [];
    const fx = {
      fadeIn: (ms: Ms) =>
        calls.push(`fadeIn:${String(ms as unknown as number)}`),
      fadeOut: (ms: Ms) =>
        calls.push(`fadeOut:${String(ms as unknown as number)}`),
      shake: (ms: Ms, mag?: number) =>
        calls.push(
          `shake:${String(ms as unknown as number)}:${String(mag ?? "")}`,
        ),
      zoomTo: (ms: Ms, z: number) =>
        calls.push(`zoomTo:${String(ms as unknown as number)}:${String(z)}`),
    } as const;

    type SoundName = "spawn" | "lock" | "line" | "topout";
    const audio = {
      play: (name: SoundName) => calls.push(`play:${name}`),
    } as const;

    const presenter = new BoardPresenter({
      activeContainer: new NopContainer(),
      audio,
      blitter: new NopBlitter(),
      fx,
      ghostContainer: new NopContainer(),
      originXPx: 0,
      originYPx: 0,
      tileSizePx: 10,
    });

    presenter.apply([
      { kind: "fadeIn", ms: 200 as number as Ms, t: "CameraFx" },
      { kind: "fadeOut", ms: 150 as number as Ms, t: "CameraFx" },
      {
        kind: "shake",
        magnitude: 0.01,
        ms: 300 as number as Ms,
        t: "CameraFx",
      },
      {
        kind: "zoomTo",
        magnitude: 1.5,
        ms: 400 as number as Ms,
        t: "CameraFx",
      },
      { name: "topout", t: "SoundCue" },
      { name: "spawn", t: "SoundCue" },
      { id: "active", t: "PiecePos", xPx: toPx(0), yPx: toPx(0) }, // unrelated to fx/audio
    ]);

    expect(calls).toEqual(
      expect.arrayContaining([
        "fadeIn:200",
        "fadeOut:150",
        "shake:300:0.01",
        "zoomTo:400:1.5",
        "play:topout",
        "play:spawn",
      ]),
    );
  });

  it("triggers spawn sound and zoom effect when justSpawned is true", () => {
    const calls: Array<string> = [];
    const fx = {
      fadeIn: (ms: Ms) =>
        calls.push(`fadeIn:${String(ms as unknown as number)}`),
      fadeOut: (ms: Ms) =>
        calls.push(`fadeOut:${String(ms as unknown as number)}`),
      shake: (ms: Ms, mag?: number) =>
        calls.push(
          `shake:${String(ms as unknown as number)}:${String(mag ?? "")}`,
        ),
      zoomTo: (ms: Ms, z: number) =>
        calls.push(`zoomTo:${String(ms as unknown as number)}:${String(z)}`),
    } as const;
    type SoundName = "spawn" | "lock" | "line" | "topout";
    const audio = {
      play: (name: SoundName) => calls.push(`play:${name}`),
    } as const;

    const presenter = new BoardPresenter({
      activeContainer: new NopContainer(),
      audio,
      blitter: new NopBlitter(),
      fx,
      ghostContainer: new NopContainer(),
      originXPx: 0,
      originYPx: 0,
      tileSizePx: 10,
    });

    const prevVm = {
      board: [[]],
      hud: { lines: 0, mode: "test", score: 0 },
      justLocked: false,
      justSpawned: false,
      linesJustCleared: 0,
      topOut: false,
    } as const;

    const nextVm = {
      board: [[]],
      hud: { lines: 0, mode: "test", score: 0 },
      justLocked: false,
      justSpawned: true,
      linesJustCleared: 0,
      topOut: false,
    } as const;

    const plan = presenter.computePlan(prevVm, nextVm);
    presenter.apply(plan);

    expect(calls).toEqual(
      expect.arrayContaining(["play:spawn", "zoomTo:150:1.05"]),
    );
  });

  it("triggers lock sound and shake effect when justLocked is true", () => {
    const calls: Array<string> = [];
    const fx = {
      fadeIn: (ms: Ms) =>
        calls.push(`fadeIn:${String(ms as unknown as number)}`),
      fadeOut: (ms: Ms) =>
        calls.push(`fadeOut:${String(ms as unknown as number)}`),
      shake: (ms: Ms, mag?: number) =>
        calls.push(
          `shake:${String(ms as unknown as number)}:${String(mag ?? "")}`,
        ),
      zoomTo: (ms: Ms, z: number) =>
        calls.push(`zoomTo:${String(ms as unknown as number)}:${String(z)}`),
    } as const;
    type SoundName = "spawn" | "lock" | "line" | "topout";
    const audio = {
      play: (name: SoundName) => calls.push(`play:${name}`),
    } as const;

    const presenter = new BoardPresenter({
      activeContainer: new NopContainer(),
      audio,
      blitter: new NopBlitter(),
      fx,
      ghostContainer: new NopContainer(),
      originXPx: 0,
      originYPx: 0,
      tileSizePx: 10,
    });

    const prevVm = {
      board: [[]],
      hud: { lines: 0, mode: "test", score: 0 },
      justLocked: false,
      justSpawned: false,
      linesJustCleared: 0,
      topOut: false,
    } as const;

    const nextVm = {
      board: [[]],
      hud: { lines: 0, mode: "test", score: 0 },
      justLocked: true,
      justSpawned: false,
      linesJustCleared: 0,
      topOut: false,
    } as const;

    const plan = presenter.computePlan(prevVm, nextVm);
    presenter.apply(plan);

    expect(calls).toEqual(
      expect.arrayContaining(["play:lock", "shake:100:0.003"]),
    );
  });

  it("triggers line clear sound and scaled shake effect when lines are cleared", () => {
    const calls: Array<string> = [];
    const fx = {
      fadeIn: (ms: Ms) =>
        calls.push(`fadeIn:${String(ms as unknown as number)}`),
      fadeOut: (ms: Ms) =>
        calls.push(`fadeOut:${String(ms as unknown as number)}`),
      shake: (ms: Ms, mag?: number) =>
        calls.push(
          `shake:${String(ms as unknown as number)}:${String(mag ?? "")}`,
        ),
      zoomTo: (ms: Ms, z: number) =>
        calls.push(`zoomTo:${String(ms as unknown as number)}:${String(z)}`),
    } as const;
    type SoundName = "spawn" | "lock" | "line" | "topout";
    const audio = {
      play: (name: SoundName) => calls.push(`play:${name}`),
    } as const;

    const presenter = new BoardPresenter({
      activeContainer: new NopContainer(),
      audio,
      blitter: new NopBlitter(),
      fx,
      ghostContainer: new NopContainer(),
      originXPx: 0,
      originYPx: 0,
      tileSizePx: 10,
    });

    // Test single line clear
    const prevVm1 = {
      board: [[]],
      hud: { lines: 0, mode: "test", score: 0 },
      justLocked: false,
      justSpawned: false,
      linesJustCleared: 0,
      topOut: false,
    } as const;

    const nextVm1 = {
      board: [[]],
      hud: { lines: 0, mode: "test", score: 0 },
      justLocked: false,
      justSpawned: false,
      linesJustCleared: 1,
      topOut: false,
    } as const;

    const plan1 = presenter.computePlan(prevVm1, nextVm1);
    presenter.apply(plan1);

    expect(calls).toEqual(
      expect.arrayContaining([
        "play:line",
        "shake:200:0.004", // Base intensity for 1 line
      ]),
    );

    // Test double line clear (higher intensity)
    calls.length = 0; // Reset calls
    const nextVm2 = {
      board: [[]],
      hud: { lines: 0, mode: "test", score: 0 },
      justLocked: false,
      justSpawned: false,
      linesJustCleared: 2,
      topOut: false,
    } as const;

    const plan2 = presenter.computePlan(prevVm1, nextVm2);
    presenter.apply(plan2);

    expect(calls).toEqual(
      expect.arrayContaining([
        "play:line",
        "shake:200:0.006", // Increased intensity for 2 lines (0.004 + 1*0.002)
      ]),
    );
  });
});
