import { advancePhysics } from "./step/advance-physics";
import { applyCommands } from "./step/apply-commands";
import { resolveTransitions } from "./step/resolve-transitions";
import { mkInitialState } from "./types";
import { incrementTick } from "./utils/tick";

import type { Command } from "./commands";
import type { DomainEvent } from "./events";
import type { Tick, EngineConfig, GameState } from "./types";

/**
 * Initialize engine with deterministic seed and starting tick.
 */
export function init(
  cfg: EngineConfig,
  startTick: Tick,
): { state: GameState; events: ReadonlyArray<DomainEvent> } {
  const state = mkInitialState(cfg, startTick);
  // Emit initial spawn here or in first step—your choice.
  // TODO: consider emitting PieceSpawned if you spawn on init.
  return { events: [], state };
}

/**
 * One deterministic tick. Applies commands, advances physics, resolves transitions.
 */
export function step(
  state: GameState,
  tick: Tick,
  cmds: ReadonlyArray<Command>,
): { state: GameState; events: ReadonlyArray<DomainEvent> } {
  const a = applyCommands(state, tick, cmds);
  const b = advancePhysics(a.state, tick, a.sideEffects);
  const c = resolveTransitions(b.state, tick, b.sideEffects);
  const events = [...a.events, ...b.events, ...c.events];

  // Increment tick at the end of the step
  const finalState = { ...c.state, tick: incrementTick(c.state.tick) };

  return { events, state: finalState };
}

/**
 * Advance multiple ticks with per-tick command buckets.
 */
export function stepN(
  state: GameState,
  startTick: Tick,
  byTick: ReadonlyArray<ReadonlyArray<Command>>,
): { state: GameState; events: ReadonlyArray<DomainEvent> } {
  let s = state;
  let t = startTick;
  const all: Array<DomainEvent> = [];
  for (const cmds of byTick) {
    const r = step(s, t, cmds);
    s = r.state;
    all.push(...r.events);
    t = incrementTick(t);
  }
  return { events: all, state: s };
}
