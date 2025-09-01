// Phase 4: Deterministic fixed-step loop (still no Phaser import)
import { reducer as coreReducer } from "../../../state/reducer";
import { createTimestamp } from "../../../types/timestamp";
import { mapGameStateToViewModel } from "../presenter/viewModel";

import { SimulatedClock } from "./clock";
import { SCENE_KEYS, type SceneController } from "./types";

import type { Clock } from "./clock";
import type { GameState, Action } from "../../../state/types";
import type { PhaserInputAdapter } from "../input/PhaserInputAdapter";
import type { Presenter, Ms, ViewModel } from "../presenter/types";

export class Gameplay /* extends Phaser.Scene */ {
  public scene: SceneController = { start: () => void 0 };

  // Fixed-step loop internals
  private _accumulator = 0;
  private _fixedDt: Ms = (1000 / 60) as Ms; // 60Hz
  private _clock: Clock = new SimulatedClock();
  private _state: GameState | null = null;
  private _presenter: Presenter | null = null;
  private _input: PhaserInputAdapter | null = null;
  private _vmPrev: ViewModel | null = null;
  private _reduce: (s: Readonly<GameState>, a: Action) => GameState =
    coreReducer;

  create(): void {
    // Intentionally empty
  }

  // Dependency injection for tests and non-Phaser harness
  attachLoop(deps: {
    presenter: Presenter;
    input: PhaserInputAdapter;
    initialState: GameState;
    fixedDt?: Ms;
    clock?: Clock;
    reduce?: (s: Readonly<GameState>, a: Action) => GameState;
  }): void {
    this._presenter = deps.presenter;
    this._input = deps.input;
    this._state = deps.initialState;
    if (deps.fixedDt) this._fixedDt = deps.fixedDt;
    if (deps.clock) this._clock = deps.clock;
    if (deps.reduce) this._reduce = deps.reduce;
    this._accumulator = 0;
    this._vmPrev = null;
  }

  // Matches Phaser signature for easy integration later
  update(_time: number, delta: number): void {
    if (!this._state || !this._presenter || !this._input) return;
    this._accumulator += delta;
    while (this._accumulator >= (this._fixedDt as unknown as number)) {
      // 1) Drain input actions for this fixed step
      const actions = this._input.drainActions(this._fixedDt);
      for (const a of actions) {
        this._state = this._reduce(this._state, a);
      }
      // 2) Advance time deterministically via Tick
      this._clock.tick(this._fixedDt);
      this._state = this._reduce(this._state, {
        timestampMs: createTimestamp(this._clock.nowMs() as unknown as number),
        type: "Tick",
      });

      // 3) Project → Plan → Apply
      const vm = mapGameStateToViewModel(this._state);
      const plan = this._presenter.computePlan(this._vmPrev, vm);
      this._presenter.apply(plan);
      this._vmPrev = vm;

      this._accumulator -= this._fixedDt as unknown as number;
    }
  }

  toResults(): void {
    this.scene.start(SCENE_KEYS.Results);
  }

  backToMenu(): void {
    this.scene.start(SCENE_KEYS.MainMenu);
  }
}
