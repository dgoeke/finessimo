import {
  tryMoveLeft,
  tryMoveRight,
  tryRotateCW,
  tryRotateCCW,
  tryHold,
  tryHardDrop,
  tryShiftToWall,
} from "../gameplay/movement.js";

import type { Command } from "../commands.js";
import type { DomainEvent } from "../events.js";
import type { Tick, GameState } from "../types.js";

export type CommandSideEffects = {
  lockResetEligible: boolean;
  lockResetReason?: "move" | "rotate" | undefined;
  hardDropped: boolean;
};

type CommandResult = {
  state: GameState;
  events: ReadonlyArray<DomainEvent>;
  lockResetEligible: boolean;
  lockResetReason?: "move" | "rotate" | undefined;
  hardDropped: boolean;
};

/**
 * Helper function to create CommandResult objects more ergonomically
 */
function createCommandResult(opts: {
  state: GameState;
  events?: ReadonlyArray<DomainEvent>;
  lockResetEligible?: boolean;
  lockResetReason?: "move" | "rotate";
  hardDropped?: boolean;
}): CommandResult {
  return {
    events: opts.events ?? [],
    hardDropped: opts.hardDropped ?? false,
    lockResetEligible: opts.lockResetEligible ?? false,
    lockResetReason: opts.lockResetReason,
    state: opts.state,
  };
}

/**
 * Handles MoveLeft command
 */
function handleMoveLeft(state: GameState, tick: Tick): CommandResult {
  const r = tryMoveLeft(state);
  if (r.moved) {
    return createCommandResult({
      events: [{ fromX: r.fromX, kind: "MovedLeft", tick, toX: r.toX }],
      lockResetEligible: r.lockResetEligible,
      ...(r.lockResetEligible && { lockResetReason: "move" as const }),
      state: r.state,
    });
  }
  return createCommandResult({ state });
}

/**
 * Handles MoveRight command
 */
function handleMoveRight(state: GameState, tick: Tick): CommandResult {
  const r = tryMoveRight(state);
  if (r.moved) {
    return createCommandResult({
      events: [{ fromX: r.fromX, kind: "MovedRight", tick, toX: r.toX }],
      lockResetEligible: r.lockResetEligible,
      ...(r.lockResetEligible && { lockResetReason: "move" as const }),
      state: r.state,
    });
  }
  return createCommandResult({ state });
}

/**
 * Handles ShiftToWall commands
 */
function handleShiftToWall(
  state: GameState,
  tick: Tick,
  direction: "Left" | "Right",
): CommandResult {
  const r = tryShiftToWall(state, direction);
  if (r.moved) {
    const eventKind = direction === "Left" ? "MovedLeft" : "MovedRight";
    return createCommandResult({
      events: [{ fromX: r.fromX, kind: eventKind, tick, toX: r.toX }],
      lockResetEligible: r.lockResetEligible,
      ...(r.lockResetEligible && { lockResetReason: "move" as const }),
      state: r.state,
    });
  }
  return createCommandResult({ state });
}

/**
 * Handles rotation commands
 */
function handleRotation(
  state: GameState,
  tick: Tick,
  direction: "CW" | "CCW",
): CommandResult {
  const r = direction === "CW" ? tryRotateCW(state) : tryRotateCCW(state);
  if (r.rotated) {
    return createCommandResult({
      events: [{ dir: direction, kick: r.kick, kind: "Rotated", tick }],
      lockResetEligible: r.lockResetEligible,
      ...(r.lockResetEligible && { lockResetReason: "rotate" as const }),
      state: r.state,
    });
  }
  return createCommandResult({ state });
}

/**
 * Handles soft drop commands
 */
function handleSoftDrop(
  state: GameState,
  tick: Tick,
  on: boolean,
): CommandResult {
  if (state.physics.softDropOn !== on) {
    return createCommandResult({
      events: [{ kind: "SoftDropToggled", on, tick }],
      state: { ...state, physics: { ...state.physics, softDropOn: on } },
    });
  }
  return createCommandResult({ state });
}

/**
 * Handles hard drop command
 */
function handleHardDrop(state: GameState, tick: Tick): CommandResult {
  const r = tryHardDrop(state, tick);
  return createCommandResult({
    hardDropped: r.hardDropped,
    state: r.state,
  });
}

/**
 * Handles hold command
 */
function handleHold(state: GameState, tick: Tick): CommandResult {
  const r = tryHold(state);
  return createCommandResult({
    events: r.emitted ? [{ kind: "Held", swapped: r.swapped, tick }] : [],
    state: r.state,
  });
}

/**
 * Maps commands to their appropriate handlers
 */
function getCommandHandler(
  cmd: Command,
  state: GameState,
  tick: Tick,
): CommandResult {
  switch (cmd.kind) {
    case "MoveLeft":
      return handleMoveLeft(state, tick);
    case "MoveRight":
      return handleMoveRight(state, tick);
    case "ShiftToWallLeft":
      return handleShiftToWall(state, tick, "Left");
    case "ShiftToWallRight":
      return handleShiftToWall(state, tick, "Right");
    case "RotateCW":
      return handleRotation(state, tick, "CW");
    case "RotateCCW":
      return handleRotation(state, tick, "CCW");
    case "SoftDropOn":
      return handleSoftDrop(state, tick, true);
    case "SoftDropOff":
      return handleSoftDrop(state, tick, false);
    case "HardDrop":
      return handleHardDrop(state, tick);
    case "Hold":
      return handleHold(state, tick);
  }
}

export function applyCommands(
  state: GameState,
  tick: Tick,
  cmds: ReadonlyArray<Command>,
): {
  state: GameState;
  events: ReadonlyArray<DomainEvent>;
  sideEffects: CommandSideEffects;
} {
  let s = state;
  const events: Array<DomainEvent> = [];
  let lockResetEligible = false;
  let lockResetReason: "move" | "rotate" | undefined;
  let hardDropped = false;

  for (const cmd of cmds) {
    const result = getCommandHandler(cmd, s, tick);
    s = result.state;
    events.push(...result.events);
    lockResetEligible = lockResetEligible || result.lockResetEligible;
    // Take the first reset reason we find (since there should only be one per tick)
    if (lockResetReason === undefined && result.lockResetReason !== undefined) {
      lockResetReason = result.lockResetReason;
    }
    hardDropped = hardDropped || result.hardDropped;
  }

  return {
    events,
    sideEffects: { hardDropped, lockResetEligible, lockResetReason },
    state: s,
  };
}
