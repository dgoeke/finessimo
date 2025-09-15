import type { Command } from "@/engine/commands";
import type { DomainEvent } from "@/engine/events";
import type { EngineOp } from "@/engine/ops";
import type { GameState } from "@/engine/types";
import type { ModeEffect } from "@/ui/effects";

export type CommandFilter = (c: Command) => boolean;

export type CommandPlan = Readonly<{
  /** Commands to prepend before filtered control commands (same tick). */
  prepend?: ReadonlyArray<Command>;
  /** Optional filter to drop unwanted control commands (training, locks, etc.). */
  filter?: CommandFilter;
  /** Commands to append after filtered control commands (same tick). */
  append?: ReadonlyArray<Command>;
}>;

export type ModeStepArgs = Readonly<{
  engine: GameState;
  lastEvents: ReadonlyArray<DomainEvent>;
  controlCommands: ReadonlyArray<Command>;
}>;

export type ModeStepResult<S> = Readonly<{
  state: S;
  /** Optional pure state transforms to apply to engine BEFORE next step. */
  engineOps?: ReadonlyArray<EngineOp>;
  /** How to shape the commands that hit the engine this tick. */
  plan?: CommandPlan;
  /** Effects for the UI layer (messages/prompts/hints). */
  effects?: ReadonlyArray<ModeEffect>;
}>;

/**
 * Pure game-mode interface.
 * It's a state machine that consumes engine events and control commands
 * and produces (engine transforms + a plan for this tick's commands + UI effects).
 */
export type Mode<S, C = unknown> = {
  /** Initialize mode state using current engine state and mode config. */
  init(config: C, engine: GameState): ModeStepResult<S>;

  /** One pure tick of mode logic. */
  step(state: S, args: ModeStepArgs): ModeStepResult<S>;
};
