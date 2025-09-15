import { advancePhysics } from "@/engine/step/advance-physics";
import { applyCommands } from "@/engine/step/apply-commands";
import { resolveTransitions } from "@/engine/step/resolve-transitions";
import { mkInitialState } from "@/engine/types";
import { incrementTick } from "@/engine/utils/tick";

import type { Command } from "@/engine/commands";
import type { DomainEvent } from "@/engine/events";
import type { Tick, EngineConfig, GameState } from "@/engine/types";

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
 * Engine owns time - uses state.tick internally and increments it.
 */
export function step(
  state: GameState,
  cmds: ReadonlyArray<Command>,
): { state: GameState; events: ReadonlyArray<DomainEvent> } {
  const a = applyCommands(state, cmds);
  const b = advancePhysics(a.state, a.sideEffects);
  const c = resolveTransitions(b.state, b.sideEffects);
  const events = [...a.events, ...b.events, ...c.events];

  // Increment tick at the end of the step
  const finalState = { ...c.state, tick: incrementTick(c.state.tick) };

  return { events, state: finalState };
}

/**
 * Advance multiple ticks with per-tick command buckets.
 * Uses state.tick for time tracking - no external tick management needed.
 */
export function stepN(
  state: GameState,
  byTick: ReadonlyArray<ReadonlyArray<Command>>,
): { state: GameState; events: ReadonlyArray<DomainEvent> } {
  let s = state;
  const all: Array<DomainEvent> = [];
  for (const cmds of byTick) {
    const r = step(s, cmds);
    s = r.state;
    all.push(...r.events);
  }
  return { events: all, state: s };
}
