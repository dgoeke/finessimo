import { Phaser } from "phaser";

import { reducer as coreReducer } from "../../../state/reducer";
import { getCurrentState } from "../../../state/signals";
import { createTimestamp } from "../../../types/timestamp";
import { PhaserInputAdapterImpl } from "../input/PhaserInputAdapterImpl";
import { BoardPresenter } from "../presenter/BoardPresenter";
import { mapGameStateToViewModel } from "../presenter/viewModel";

import { SimulatedClock } from "./clock";
import { SCENE_KEYS } from "./types";

import type { Clock } from "./clock";
import type { GameState, Action } from "../../../state/types";
import type { PhaserInputAdapter } from "../input/PhaserInputAdapter";
import type { AudioBus } from "../presenter/AudioBus";
import type { CameraFxAdapter } from "../presenter/Effects";
import type { Presenter, Ms, ViewModel } from "../presenter/types";

export class Gameplay extends Phaser.Scene {
  private _accumulator = 0;
  private _fixedDt: Ms = (1000 / 60) as Ms;
  private _clock: Clock = new SimulatedClock();
  private _state: GameState | null = null;
  private _presenter: Presenter | null = null;
  private _input: PhaserInputAdapter | null = null;
  private _vmPrev: ViewModel | null = null;
  private _reduce: (s: Readonly<GameState>, a: Action) => GameState =
    coreReducer;

  constructor() {
    super({ key: SCENE_KEYS.Gameplay });
  }

  create(): void {
    const ox = 0;
    const oy = 0;
    const blitter = this.add.blitter(ox, oy, "tiles");
    const active = this.add.container();
    const ghost = this.add.container();

    const fx: CameraFxAdapter = {
      fadeIn: (ms) => this.cameras.main.fadeIn(ms as unknown as number),
      fadeOut: (ms) => this.cameras.main.fadeOut(ms as unknown as number),
      shake: (ms, mag) =>
        this.cameras.main.shake(ms as unknown as number, mag ?? 0.005),
      zoomTo: (ms, z) => this.cameras.main.zoomTo(z, ms as unknown as number),
    };
    const audio: AudioBus = {
      play: (name) => this.sound.play(name),
    };

    this._presenter = new BoardPresenter({
      activeContainer: active,
      audio,
      blitter,
      fx,
      ghostContainer: ghost,
      originXPx: ox,
      originYPx: oy,
      tileSizePx: 16,
    });
    this._input = new PhaserInputAdapterImpl(this);
    this._state = getCurrentState();
    this._vmPrev = null;
    this._accumulator = 0;
  }

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

  update(_time: number, delta: number): void {
    if (!this._state || !this._presenter || !this._input) return;
    this._accumulator += delta;
    while (this._accumulator >= (this._fixedDt as unknown as number)) {
      const actions = this._input.drainActions(this._fixedDt);
      for (const a of actions) {
        this._state = this._reduce(this._state, a);
      }
      this._clock.tick(this._fixedDt);
      this._state = this._reduce(this._state, {
        timestampMs: createTimestamp(this._clock.nowMs() as unknown as number),
        type: "Tick",
      });

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
