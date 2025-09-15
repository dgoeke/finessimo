import type { Mode, ModeStepResult } from "./base.js";
import type { GameState, Tick } from "@/engine/types.js";

/** Pass-through mode: all control commands go to the engine, no engineOps. */
export type FreeplayState = { startedAtTick: Tick };

export type FreeplayConfig = Record<string, never>;

export const Freeplay: Mode<FreeplayState, FreeplayConfig> = {
  init(
    config: FreeplayConfig,
    engine: GameState,
  ): ModeStepResult<FreeplayState> {
    return {
      plan: {},
      state: { startedAtTick: engine.tick },
    };
  },

  step(state, _args) {
    return {
      effects: [],
      plan: {
        /* no filter, no extras → pass-through */
      },
      state,
    };
  },
};
