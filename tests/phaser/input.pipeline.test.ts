import { createInitialState } from "../../src/engine/init";
import {
  type PhaserInputAdapter,
  type InputEvent,
} from "../../src/presentation/phaser/input/PhaserInputAdapter";
import { type Presenter } from "../../src/presentation/phaser/presenter/types";
import { Gameplay } from "../../src/presentation/phaser/scenes/Gameplay";
import { createSeed } from "../../src/types/brands";
import { createTimestamp } from "../../src/types/timestamp";

class TestPresenter implements Presenter {
  computePlan() {
    return [] as const;
  }
  apply(): void {
    /* no-op */
  }
}

class QueueInput implements PhaserInputAdapter {
  private i = 0;
  constructor(private frames: Array<ReadonlyArray<InputEvent>>) {}
  drainEvents(): ReadonlyArray<InputEvent> {
    const out = this.frames[this.i] ?? [];
    this.i += 1;
    return out;
  }
}

function dasDown(dir: -1 | 1, t: number): InputEvent {
  return { direction: dir, timestamp: t, type: "KEY_DOWN" };
}
function dasUp(dir: -1 | 1, t: number): InputEvent {
  return { direction: dir, timestamp: t, type: "KEY_UP" };
}
function soft(on: boolean, t: number): InputEvent {
  return {
    on,
    timestampMs: createTimestamp(t),
    type: "SoftDrop",
  } as unknown as InputEvent;
}

describe("Phaser input pipeline parity", () => {
  test("finalizes pending tap on key up (AppendProcessed TapMove)", () => {
    const seed = createSeed("tap-seed");
    const s0 = createInitialState(seed, createTimestamp(1));
    const t0 = 100;
    const input = new QueueInput([
      [dasDown(-1, t0)], // frame 1: left down
      [dasUp(-1, t0 + 30)], // frame 2: left up within DAS
    ]);
    const game = new Gameplay();
    game.attachLoop({
      initialState: s0,
      input,
      presenter: new TestPresenter(),
    });

    // two ticks to consume events
    game.update(0, 1000 / 60);
    game.update(0, 1000 / 60);
    const st = game.getState();
    expect(st).not.toBeNull();
    if (!st) return;
    const log = st.processedInputLog;
    expect(log.some((e) => e.kind === "TapMove")).toBe(true);
  });

  test("soft drop processed entries are deduped on repeated on events", () => {
    const seed = createSeed("soft-seed");
    const s0 = createInitialState(seed, createTimestamp(1));
    const t0 = 200;
    const input = new QueueInput([
      [soft(true, t0)],
      [soft(true, t0 + 5)], // duplicate state, should not log twice
      [soft(false, t0 + 10)],
    ]);
    const game = new Gameplay();
    game.attachLoop({
      initialState: s0,
      input,
      presenter: new TestPresenter(),
    });
    game.update(0, 1000 / 60);
    game.update(0, 1000 / 60);
    game.update(0, 1000 / 60);
    const st = game.getState();
    expect(st).not.toBeNull();
    if (!st) return;
    const log2 = st.processedInputLog;
    const softs = log2.filter((e) => e.kind === "SoftDrop");
    // Expect two logs: one for on(true) and a second for off(false)
    expect(softs.length).toBe(2);
    expect(softs[0]?.on).toBe(true);
    expect(softs[1]?.on).toBe(false);
  });
});
