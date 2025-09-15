import {
  withBoard,
  withQueue,
  forceActive,
  clearHold,
  type EngineOp,
} from "@/engine/ops";

import type { Mode, ModeStepArgs, ModeStepResult } from "./base";
import type { Command } from "@/engine/commands";
import type { BoardCells, GameState, PieceId } from "@/engine/types";
import type { ModeEffect } from "@/ui/effects";

/** A single finesse scenario: fixed board, target placement, and the expected command sequence. */
export type FinesseScenario = Readonly<{
  name: string;
  board: BoardCells;
  active: PieceId;
  /** Expected command kinds to reach target (one-per-tap/repeat; ignores ARR=0 sonic wall shift details). */
  expected: ReadonlyArray<Command["kind"]>;
  /** Optional: target x/rot to validate after lock. */
  target?: { x: number; rot: 0 | 1 | 2 | 3 };
}>;

export type FinesseTrainerConfig = Readonly<{
  scenarios: ReadonlyArray<FinesseScenario>;
  loop?: boolean; // whether to loop scenarios
}>;

export type FinesseTrainerState = Readonly<{
  index: number; // which scenario we are on
  progress: number; // how many commands matched so far
  failed: boolean; // whether the attempt failed
}>;

const finesseTrainerImpl = {
  _advanceOps(_engine: GameState, _nextIndex: number): ReadonlyArray<EngineOp> {
    const scenario = {} as FinesseScenario;
    return scenarioOps(scenario);
  },

  // Helpers bound as "static" methods on the object (TS happy)
  _expected(
    _engine: GameState,
    _index: number,
  ): ReadonlyArray<Command["kind"]> {
    return [] as ReadonlyArray<Command["kind"]>;
  },

  _resetOps(_engine: GameState, _index: number): ReadonlyArray<EngineOp> {
    const scenario = {} as FinesseScenario;
    return scenarioOps(scenario);
  },

  init(
    config: FinesseTrainerConfig,
    _engine: GameState,
  ): ModeStepResult<FinesseTrainerState> {
    const st: FinesseTrainerState = { failed: false, index: 0, progress: 0 };
    const first = config.scenarios[0];
    const effects: Array<ModeEffect> = [
      {
        kind: "Message",
        level: "info",
        text: `Scenario: ${first?.name ?? "(no scenarios)"}`,
      },
    ];
    if (first) {
      const ops = scenarioOps(first);
      return { effects, engineOps: ops, state: st };
    }
    return { effects, state: st };
  },

  step(
    state: FinesseTrainerState,
    { controlCommands, engine, lastEvents }: ModeStepArgs,
  ): ModeStepResult<FinesseTrainerState> {
    const { failed, index, progress } = state;
    const expected = this._expected(engine, index);
    let nextProgress = progress;
    let nextFailed = failed;
    const effects: Array<ModeEffect> = [];

    // Compare control commands against expected sequence
    const filtered = controlCommands.filter((c) => {
      const want = expected[nextProgress];
      if (want === undefined) return false; // no more inputs needed
      if (c.kind === want) {
        nextProgress += 1;
        return true;
      }
      // Wrong input → reject and mark failed
      nextFailed = true;
      effects.push({
        kind: "Message",
        level: "error",
        text: `Expected ${want}, got ${c.kind}`,
      });
      return false;
    });

    // On lock, validate target (optional) and advance/reset scenario
    for (const ev of lastEvents) {
      if (ev.kind === "Locked") {
        if (!nextFailed && nextProgress >= expected.length) {
          effects.push({
            kind: "Message",
            level: "success",
            text: "Correct finesse!",
          });
          effects.push({ kind: "PlaySound", name: "success" });
          // Advance scenario (loop if configured)
          const nextIndex = index + 1;
          const ops = this._advanceOps(engine, nextIndex);
          return {
            effects: [
              ...effects,
              { index: nextIndex, kind: "ScenarioAdvanced" },
            ],
            engineOps: ops,
            state: { failed: false, index: nextIndex, progress: 0 },
          };
        } else {
          effects.push({
            kind: "Message",
            level: "warning",
            text: "Try again.",
          });
          const ops = this._resetOps(engine, index);
          return {
            effects,
            engineOps: ops,
            state: { failed: false, index, progress: 0 },
          };
        }
      }
    }

    return {
      effects,
      plan: { filter: (c) => filtered.includes(c) }, // allow only matched prefix
      state: { failed: nextFailed, index, progress: nextProgress },
    };
  },
} as const;

export const FinesseTrainer: Mode<FinesseTrainerState, FinesseTrainerConfig> =
  finesseTrainerImpl;

// Build engine ops to load a scenario
function scenarioOps(sc: FinesseScenario): ReadonlyArray<EngineOp> {
  return [
    withBoard(sc.board),
    clearHold(),
    withQueue([sc.active]), // ensure next is correct piece
    forceActive(sc.active), // and force active if already spawned
  ];
}
