/**
 * Test harness for deterministic Gameplay scene testing
 * 
 * Provides isolated testing of the Gameplay scene using attachLoop() for
 * deterministic execution without a real Phaser.Game instance.
 */

import { Gameplay } from "../../../src/presentation/phaser/scenes/Gameplay";
import { SimulatedClock } from "../../../src/presentation/phaser/scenes/clock";
import { createInitialState } from "../../../src/engine/init";
import { createSeed, createDurationMs } from "../../../src/types/brands";
import { fromNow } from "../../../src/types/timestamp";
import { createTestSpawnAction } from "../../test-helpers";
import { reducer as coreReducer } from "../../../src/state/reducer";

import type { PhaserInputAdapter, InputEvent } from "../../../src/presentation/phaser/input/PhaserInputAdapter";
import type { Presenter, Ms, ViewModel, RenderPlan } from "../../../src/presentation/phaser/presenter/types";
import type { GameState, Action, PieceId } from "../../../src/state/types";
import type { DASEvent } from "../../../src/input/machines/das";
import type { Seed } from "../../../src/types/brands";
import type { Timestamp } from "../../../src/types/timestamp";

/**
 * Test double for PhaserInputAdapter that allows queuing events
 */
export class TestInputAdapter implements PhaserInputAdapter {
  private eventQueue: Array<InputEvent> = [];
  private clock: TestClock;

  constructor(clock: TestClock) {
    this.clock = clock;
  }

  private now(): Timestamp {
    // Use test clock instead of performance.now()
    const ms = this.clock.nowMs() as number;
    return ms as Timestamp;
  }

  pushDas(event: DASEvent): void {
    this.eventQueue.push(event);
  }

  pushAction(action: Action): void {
    this.eventQueue.push(action);
  }

  tap(dir: -1 | 1): void {
    const now = this.now();
    this.pushAction({
      type: "TapMove",
      dir,
      optimistic: false,
      timestampMs: now
    });
  }

  hold(dir: -1 | 1): void {
    const now = this.clock.nowMs() as number;
    this.pushDas({
      type: "KEY_DOWN",
      direction: dir,
      timestamp: now
    });
  }

  release(dir: -1 | 1): void {
    const now = this.clock.nowMs() as number;
    this.pushDas({
      type: "KEY_UP", 
      direction: dir,
      timestamp: now
    });
  }

  rotateCW(): void {
    this.pushAction({
      type: "Rotate",
      dir: "CW",
      timestampMs: this.now()
    });
  }

  rotateCCW(): void {
    this.pushAction({
      type: "Rotate",
      dir: "CCW",
      timestampMs: this.now()
    });
  }

  hardDrop(): void {
    this.pushAction({
      type: "HardDrop",
      timestampMs: this.now()
    });
  }

  softDrop(on: boolean): void {
    this.pushAction({
      type: "SoftDrop",
      on,
      timestampMs: this.now()
    });
  }

  drainEvents(_dt: Ms): ReadonlyArray<InputEvent> {
    const now = this.clock.nowMs() as number;
    // Mimic PhaserInputAdapterImpl - always add TIMER_TICK for DAS progression
    const tick: DASEvent = { timestamp: now, type: "TIMER_TICK" };
    
    // Drain buffered events and append tick
    const events = [...this.eventQueue];
    this.eventQueue.length = 0;
    events.push(tick);
    return events;
  }
}

/**
 * Test double for Presenter that records applied ViewModels and plans
 */
export class TestPresenter implements Presenter {
  public lastViewModel: ViewModel | null = null;
  public appliedPlans: Array<unknown> = [];

  computePlan(_prev: ViewModel | null, _next: ViewModel): readonly RenderPlan[] {
    // Simple diff-based plan for testing
    return [{ t: "TileDiff", puts: [], dels: [] }] as readonly RenderPlan[];
  }

  apply(plan: readonly RenderPlan[]): void {
    this.appliedPlans.push(plan);
    // For test purposes, we don't need to track the ViewModel from plan
    // since the test harness can get it directly from the scene
  }
}

/**
 * Enhanced clock with step helpers for testing
 */
export class TestClock extends SimulatedClock {
  constructor() {
    super();
    // Start with a valid timestamp to avoid DAS machine errors
    this.tick(1000 as Ms); // Start at 1000ms
  }

  step(dt: Ms = (1000/60) as Ms): void {
    this.tick(dt);
  }

  stepN(n: number, dt: Ms = (1000/60) as Ms): void {
    for (let i = 0; i < n; i++) {
      this.tick(dt);
    }
  }

  advanceMs(ms: number): void {
    this.tick(ms as Ms);
  }
}

/**
 * Configuration options for creating the test harness
 */
export type GameplayHarnessConfig = {
  seed?: Seed;
  fixedDt?: Ms;
  initialOverrides?: Partial<GameState>;
};

/**
 * Complete test harness with all necessary components
 */
export type GameplayHarness = {
  scene: Gameplay;
  input: TestInputAdapter;
  presenter: TestPresenter;
  clock: TestClock;
  
  // State access
  getState(): GameState | null;
  
  // Action helpers
  spawn(piece?: PieceId): void;
  applyGarbage(rows: Array<readonly [number, number, number, number, number, number, number, number, number, number]>): void;
  
  // Settings helpers
  updateTiming(settings: Parameters<Gameplay['updateTimingSettings']>[0]): void;
  updateGameplay(settings: Parameters<Gameplay['updateGameplaySettings']>[0]): void;
  setMode(name: string): void;
  
  // Time control helpers
  step(dt?: Ms): void;
  stepN(n: number, dt?: Ms): void;
  advanceMs(ms: number): void;
};

/**
 * Creates a complete test harness for the Gameplay scene
 */
export function createGameplayHarness(config: GameplayHarnessConfig = {}): GameplayHarness {
  const seed = config.seed ?? createSeed("test-seed");
  const fixedDt = config.fixedDt ?? (createDurationMs(1000/60) as unknown as Ms);
  const now = fromNow();
  
  // Create initial state with overrides
  const initialState = createInitialState(seed, now, config.initialOverrides);
  
  // Create test doubles
  const clock = new TestClock();
  const input = new TestInputAdapter(clock);
  const presenter = new TestPresenter();
  
  // Create scene and attach loop in isolated mode
  const scene = new Gameplay();
  scene.attachLoop({
    presenter,
    input,
    initialState,
    fixedDt,
    clock,
    reduce: coreReducer
  });

  return {
    scene,
    input,
    presenter,
    clock,
    
    getState(): GameState | null {
      return scene.getState();
    },
    
    spawn(piece?: PieceId): void {
      const spawnAction = piece 
        ? createTestSpawnAction(piece, clock.nowMs() as number)
        : { type: "Spawn" as const, timestampMs: clock.nowMs() as number as Timestamp };
      input.pushAction(spawnAction);
    },
    
    applyGarbage(rows: Array<readonly [number, number, number, number, number, number, number, number, number, number]>): void {
      for (const row of rows) {
        input.pushAction({
          type: "CreateGarbageRow",
          row: row as readonly [number, number, number, number, number, number, number, number, number, number]
        });
      }
    },
    
    updateTiming(settings: Parameters<Gameplay['updateTimingSettings']>[0]): void {
      scene.updateTimingSettings(settings);
    },
    
    updateGameplay(settings: Parameters<Gameplay['updateGameplaySettings']>[0]): void {
      scene.updateGameplaySettings(settings);
    },
    
    setMode(name: string): void {
      scene.setGameMode(name);
    },
    
    step(dt: Ms = (1000/60) as Ms): void {
      // The scene.update() method will call clock.tick() internally,
      // so we don't need to call clock.step() here
      scene.update(clock.nowMs() as number, dt as number);
    },
    
    stepN(n: number, dt: Ms = (1000/60) as Ms): void {
      for (let i = 0; i < n; i++) {
        this.step(dt);
      }
    },
    
    advanceMs(ms: number): void {
      // Scene.update() will handle the time advancement internally
      scene.update(clock.nowMs() as number, ms);
    }
  };
}