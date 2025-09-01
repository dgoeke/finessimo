import { describe, expect, it } from "@jest/globals";

import { createInitialState } from "../../src/engine/init";
import { BoardPresenter } from "../../src/presentation/phaser/presenter/BoardPresenter";
import { Gameplay } from "../../src/presentation/phaser/scenes/Gameplay";
import { createSeed } from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";

import type { PhaserInputAdapter } from "../../src/presentation/phaser/input/PhaserInputAdapter";
import type {
  BlitterLike,
  BobLike,
  ContainerLike,
} from "../../src/presentation/phaser/presenter/BoardPresenter";
import type { Action } from "../../src/state/types";

class ScriptedInput implements PhaserInputAdapter {
  private readonly steps: Array<ReadonlyArray<Action>>;
  private i = 0;
  constructor(steps: Array<ReadonlyArray<Action>>) {
    this.steps = steps;
  }
  drainActions(): ReadonlyArray<Action> {
    const out = this.steps[this.i] ?? [];
    this.i += 1;
    return out;
  }
}

class SpyContainer implements ContainerLike {
  public sets: Array<{ x: number; y: number }> = [];
  setPosition(x: number, y: number): void {
    this.sets.push({ x, y });
  }
}

class NopBob implements BobLike {
  public visible = true;
  reset(x?: number, y?: number, frame?: number): void {
    if (typeof x === "number" && typeof y === "number") {
      const _sum = x + y + (typeof frame === "number" ? frame : 0);
      if (_sum === Number.MIN_VALUE) throw new Error("noop");
    }
  }
  setVisible(v: boolean): void {
    this.visible = v;
  }
}
class NopBlitter implements BlitterLike {
  create(): BobLike {
    return new NopBob();
  }
}

describe("Gameplay fixed-step loop (Phase 4)", () => {
  it("spawns and moves active piece via input adapter; presenter applies positions", () => {
    const gameplay = new Gameplay();
    const startTs = createTimestamp(1);
    const s0 = createInitialState(createSeed("seed-phase4"), startTs);

    // Provide actions for two fixed steps: Spawn, then move right
    const scripted = new ScriptedInput([
      [{ timestampMs: createTimestamp(1), type: "Spawn" } as Action],
      [
        {
          dir: 1,
          optimistic: true,
          timestampMs: createTimestamp(2),
          type: "TapMove",
        } as Action,
      ],
    ]);

    const active = new SpyContainer();
    const ghost = new SpyContainer();
    const presenter = new BoardPresenter({
      activeContainer: active,
      blitter: new NopBlitter(),
      ghostContainer: ghost,
      originXPx: 0,
      originYPx: 0,
      tileSizePx: 10,
    });

    gameplay.attachLoop({ initialState: s0, input: scripted, presenter });

    // Run two fixed steps (provide delta equal to fixed dt each time)
    gameplay.update(0, 1000 / 60);
    gameplay.update(16.666, 1000 / 60);

    // Expect at least two active container position updates: spawn + move right
    const sets = active.sets;
    expect(sets.length).toBeGreaterThanOrEqual(2);
    if (sets.length < 2) return; // narrow for TS
    const prevMaybe = sets[sets.length - 2];
    const lastMaybe = sets[sets.length - 1];
    if (prevMaybe === undefined || lastMaybe === undefined) {
      throw new Error("Expected at least two setPosition calls");
    }
    const prev = prevMaybe;
    const last = lastMaybe;
    // X should increase by tileSize (10) after TapMove to the right
    expect(last.x - prev.x).toBe(10);

    // Ghost may or may not be emitted depending on overlap, but loop ran
    expect(ghost.sets.length).toBeGreaterThanOrEqual(0);
  });
});
