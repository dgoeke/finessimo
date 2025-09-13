import { advancePhysics } from "./step/advance-physics.js";
import { applyCommands } from "./step/apply-commands.js";
import { resolveTransitions } from "./step/resolve-transitions.js";
import { mkInitialState } from "./types.js";

import type { Command } from "./commands.js";
import type { DomainEvent } from "./events.js";
import type { Tick, EngineConfig, GameState } from "./types.js";

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
  return { events, state: c.state };
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
    // @ts-ignore - arithmetic on branded type is OK at boundary
    t = (t + 1) as Tick;
  }
  return { events: all, state: s };
}
