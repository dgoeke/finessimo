import { controlStep } from "@/control/index.js";
import { step as engineStep } from "@/engine/index.js";

import type { ControlState, KeyEdge } from "@/control/types.js";
import type { Command } from "@/engine/commands.js";
import type { DomainEvent } from "@/engine/events.js";
import type { EngineOp } from "@/engine/ops.js";
import type { GameState } from "@/engine/types.js";
import type { Mode } from "@/modes/base.js";
import type { ModeEffect } from "@/ui/effects.js";

/** Aggregate runtime state the app will hold between ticks. */
export type RuntimeState<MState> = Readonly<{
  engine: GameState;
  control: ControlState;
  mode: MState;
  lastEvents: ReadonlyArray<DomainEvent>;
}>;

export type RuntimeTickOutput = Readonly<{
  /** Engine domain events produced this tick. */
  events: ReadonlyArray<DomainEvent>;
  /** Mode-driven UI effects (prompts, hints, etc.). */
  effects: ReadonlyArray<ModeEffect>;
  /** Commands that actually hit the engine this tick (for debugging/recording). */
  commands: ReadonlyArray<Command>;
}>;

/** Helper to apply pure engine operations in sequence. */
function applyEngineOps(
  s: GameState,
  ops?: ReadonlyArray<EngineOp>,
): GameState {
  let cur = s;
  if (!ops) return cur;
  for (const op of ops) cur = op(cur);
  return cur;
}

/** Compute final command list based on a mode's CommandPlan. */
function planCommands(
  controlCmds: ReadonlyArray<Command>,
  plan?: {
    prepend?: ReadonlyArray<Command>;
    filter?: (c: Command) => boolean;
    append?: ReadonlyArray<Command>;
  },
): ReadonlyArray<Command> {
  const pre = plan?.prepend ?? [];
  const post = plan?.append ?? [];
  const body = plan?.filter ? controlCmds.filter(plan.filter) : controlCmds;
  return [...pre, ...body, ...post];
}

/**
 * One pure runtime tick:
 *  - consumes device key edges,
 *  - runs control transducer to get Commands,
 *  - lets the Mode transform/augment/deny Commands and apply pure engine Ops,
 *  - steps the engine,
 *  - returns new RuntimeState and outputs.
 */
export function runtimeStep<MState, MConfig>(
  rs: RuntimeState<MState>,
  keyEdgesThisTick: ReadonlyArray<KeyEdge>,
  mode: Mode<MState, MConfig>,
): { state: RuntimeState<MState>; out: RuntimeTickOutput } {
  // 1) Control transducer
  const c = controlStep(rs.control, rs.engine.tick, keyEdgesThisTick);
  // 2) Mode logic
  const m = mode.step(rs.mode, {
    controlCommands: c.commands,
    controlTelemetry: c.telemetry,
    engine: rs.engine,
    lastEvents: rs.lastEvents,
  });
  // 3) Apply engine ops (pre-step transforms)
  const engine0 = applyEngineOps(rs.engine, m.engineOps);
  // 4) Final commands
  const cmds = planCommands(c.commands, m.plan);
  // 5) Engine step
  const r = engineStep(engine0, cmds);
  // 6) Next runtime state
  const next: RuntimeState<MState> = {
    control: c.next,
    engine: r.state,
    lastEvents: r.events,
    mode: m.state,
  };
  const out: RuntimeTickOutput = {
    commands: cmds,
    effects: m.effects ?? [],
    events: r.events,
  };
  return { out, state: next };
}
