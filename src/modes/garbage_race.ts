import { addGarbage, clearHold } from "@/engine/ops.js";

import type { Mode, ModeStepArgs, ModeStepResult } from "./base.js";
import type { EngineOp } from "@/engine/ops.js";
import type { GameState } from "@/engine/types.js";
import type { ModeEffect } from "@/ui/effects.js";

export type GarbageRaceConfig = Readonly<{
  rows: number; // number of garbage rows
  holes: ReadonlyArray<number>; // hole positions for each row (cycled if shorter)
}>;

export type GarbageRaceState = Readonly<{
  started: boolean;
  clearedRows: number;
}>;

export const GarbageRace: Mode<GarbageRaceState, GarbageRaceConfig> = {
  init(
    config: GarbageRaceConfig,
    _engine: GameState,
  ): ModeStepResult<GarbageRaceState> {
    const holesLen = config.holes.length;
    const holeSeq: ReadonlyArray<number> = new Array(config.rows)
      .fill(0)
      .map((_, i) => (holesLen > 0 ? config.holes[i % holesLen] : 0) ?? 0);

    const ops: Array<EngineOp> = [clearHold(), addGarbage(holeSeq)];
    const effects: Array<ModeEffect> = [
      {
        kind: "Message",
        level: "info",
        text: `Garbage race: ${String(config.rows)} rows`,
      },
    ];
    return {
      effects,
      engineOps: ops,
      state: { clearedRows: 0, started: false },
    };
  },

  step(
    state: GarbageRaceState,
    {
      controlTelemetry: _controlTelemetry,
      engine: _engine,
      lastEvents,
    }: ModeStepArgs,
  ): ModeStepResult<GarbageRaceState> {
    let cleared = state.clearedRows;
    for (const ev of lastEvents) {
      if (ev.kind === "LinesCleared") {
        cleared += ev.rows.length;
      }
    }
    const effects: Array<ModeEffect> =
      cleared !== state.clearedRows
        ? [
            {
              kind: "Message",
              level: "info",
              text: `Cleared: ${String(cleared)}`,
            },
          ]
        : [];
    return {
      effects,
      state: { ...state, clearedRows: cleared, started: true },
    };
  },
};
