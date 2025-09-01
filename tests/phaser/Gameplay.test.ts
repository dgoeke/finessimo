import { createInitialState } from "../../src/engine/init";
import { type PhaserInputAdapter } from "../../src/presentation/phaser/input/PhaserInputAdapter";
import { type Presenter } from "../../src/presentation/phaser/presenter/types";
import { Gameplay } from "../../src/presentation/phaser/scenes/Gameplay";
import { createSeed } from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";

class TestPresenter implements Presenter {
  computePlan() {
    return [] as const;
  }
  apply(): void {
    // no-op
  }
}

class NoopInput implements PhaserInputAdapter {
  drainEvents() {
    return [] as const;
  }
}

const FIXED_DT = 1000 / 60; // 60 fps

describe("Phaser Gameplay scene", () => {
  test("refills preview after spawn (keeps at least 5)", () => {
    const seed = createSeed("test-seed-1");
    const initial = createInitialState(seed, createTimestamp(1));

    // Sanity of initial queue
    expect(initial.nextQueue.length).toBe(5);
    expect(initial.active).toBeUndefined();

    const scene = new Gameplay();
    scene.attachLoop({
      initialState: initial,
      input: new NoopInput(),
      presenter: new TestPresenter(),
    });

    // One fixed step triggers auto-spawn
    scene.update(0, FIXED_DT);
    const s = scene.getState();
    expect(s).not.toBeNull();
    if (!s) return; // type guard for TS

    // Active piece spawned and preview topped back up
    expect(s.active).toBeDefined();
    expect(s.nextQueue.length).toBeGreaterThanOrEqual(5);
    expect(s.nextQueue.length).toBe(5);
  });

  test("respects gameplay.nextPieceCount when refilling (e.g., 7)", () => {
    const seed = createSeed("test-seed-2");
    const initial = createInitialState(seed, createTimestamp(1), {
      gameplay: { nextPieceCount: 7 },
    });

    expect(initial.nextQueue.length).toBe(5); // engine init seeds 5 by default

    const scene = new Gameplay();
    scene.attachLoop({
      initialState: initial,
      input: new NoopInput(),
      presenter: new TestPresenter(),
    });

    scene.update(0, FIXED_DT); // spawn, then refill to desired (7)
    const s = scene.getState();
    expect(s).not.toBeNull();
    if (!s) return;
    expect(s.active).toBeDefined();
    expect(s.nextQueue.length).toBe(7);
  });
});
