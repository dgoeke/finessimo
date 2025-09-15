import { withQueue, clearHold } from "@/engine/ops.js";

import type { Mode, ModeStepArgs, ModeStepResult } from "./base.js";
import type { EngineOp } from "@/engine/ops.js";
import type { PieceId } from "@/engine/types.js";
import type { ModeEffect } from "@/ui/effects.js";

export type OpeningPlan = Readonly<{
  name: string;
  sequence: ReadonlyArray<PieceId>; // forced queue for the opener
  hints?: ReadonlyArray<string>; // optional textual hints per step
}>;

export type OpeningTrainerConfig = Readonly<{
  plans: ReadonlyArray<OpeningPlan>;
}>;

export type OpeningTrainerState = Readonly<{
  planIndex: number;
  stepIndex: number;
}>;

export const OpeningTrainer: Mode<OpeningTrainerState, OpeningTrainerConfig> = {
  init(
    config: OpeningTrainerConfig,
    _engine,
  ): ModeStepResult<OpeningTrainerState> {
    const first = config.plans[0];
    const effects: Array<ModeEffect> = [
      {
        kind: "Message",
        level: "info",
        text: `Opener: ${first?.name ?? "(no plans)"}`,
      },
    ];

    if (first) {
      const ops: Array<EngineOp> = [clearHold(), withQueue(first.sequence)];
      return {
        effects,
        engineOps: ops,
        state: { planIndex: 0, stepIndex: 0 },
      };
    }

    return {
      effects,
      state: { planIndex: 0, stepIndex: 0 },
    };
  },

  step(
    state: OpeningTrainerState,
    _args: ModeStepArgs,
  ): ModeStepResult<OpeningTrainerState> {
    // TODO: check engine events to see if the expected piece in the sequence was placed correctly.
    // Provide hints and advance stepIndex when the piece is locked.
    return { effects: [], plan: {}, state };
  },
};
