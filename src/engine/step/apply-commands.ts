import {
  tryMoveLeft,
  tryMoveRight,
  tryRotateCW,
  tryRotateCCW,
  tryHold,
  tryHardDrop,
  tryShiftToWall,
} from "../gameplay/movement";

import type { Command } from "../commands";
import type { DomainEvent } from "../events";
import type { GameState, PieceId } from "../types";

export type CommandSideEffects = {
  lockResetEligible: boolean;
  lockResetReason?: "move" | "rotate" | undefined;
  hardDropped: boolean;
  spawnOverride?: PieceId;
};

type CommandResult = {
  state: GameState;
  events: ReadonlyArray<DomainEvent>;
  lockResetEligible: boolean;
  lockResetReason?: "move" | "rotate" | undefined;
  hardDropped: boolean;
  spawnOverride?: PieceId;
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
  spawnOverride?: PieceId;
}): CommandResult {
  const result: CommandResult = {
    events: opts.events ?? [],
    hardDropped: opts.hardDropped ?? false,
    lockResetEligible: opts.lockResetEligible ?? false,
    lockResetReason: opts.lockResetReason,
    state: opts.state,
  };

  if (opts.spawnOverride !== undefined) {
    result.spawnOverride = opts.spawnOverride;
  }

  return result;
}

/**
 * Handles MoveLeft command
 */
function handleMoveLeft(state: GameState): CommandResult {
  const r = tryMoveLeft(state);
  if (r.moved) {
    return createCommandResult({
      events: [
        { fromX: r.fromX, kind: "MovedLeft", tick: state.tick, toX: r.toX },
      ],
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
function handleMoveRight(state: GameState): CommandResult {
  const r = tryMoveRight(state);
  if (r.moved) {
    return createCommandResult({
      events: [
        { fromX: r.fromX, kind: "MovedRight", tick: state.tick, toX: r.toX },
      ],
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
  direction: "Left" | "Right",
): CommandResult {
  const r = tryShiftToWall(state, direction);
  if (r.moved) {
    const eventKind = direction === "Left" ? "MovedLeft" : "MovedRight";
    return createCommandResult({
      events: [
        { fromX: r.fromX, kind: eventKind, tick: state.tick, toX: r.toX },
      ],
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
  direction: "CW" | "CCW",
): CommandResult {
  const r = direction === "CW" ? tryRotateCW(state) : tryRotateCCW(state);
  if (r.rotated) {
    return createCommandResult({
      events: [
        { dir: direction, kick: r.kick, kind: "Rotated", tick: state.tick },
      ],
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
function handleSoftDrop(state: GameState, on: boolean): CommandResult {
  if (state.physics.softDropOn !== on) {
    return createCommandResult({
      events: [{ kind: "SoftDropToggled", on, tick: state.tick }],
      state: { ...state, physics: { ...state.physics, softDropOn: on } },
    });
  }
  return createCommandResult({ state });
}

/**
 * Handles hard drop command
 */
function handleHardDrop(state: GameState): CommandResult {
  const r = tryHardDrop(state);
  return createCommandResult({
    hardDropped: r.hardDropped,
    state: r.state,
  });
}

/**
 * Handles hold command
 */
function handleHold(state: GameState): CommandResult {
  const r = tryHold(state);

  if (!r.emitted) {
    // Hold was not allowed or not possible
    return createCommandResult({ state: r.state });
  }

  const events: Array<DomainEvent> = [
    { kind: "Held", swapped: r.swapped, tick: state.tick },
  ];

  const result: CommandResult = {
    events,
    hardDropped: false,
    lockResetEligible: false,
    state: r.state,
  };

  if (r.pieceToSpawn !== null) {
    result.spawnOverride = r.pieceToSpawn;
  }

  return result;
}

/**
 * Maps commands to their appropriate handlers
 */
function getCommandHandler(cmd: Command, state: GameState): CommandResult {
  switch (cmd.kind) {
    case "MoveLeft":
      return handleMoveLeft(state);
    case "MoveRight":
      return handleMoveRight(state);
    case "ShiftToWallLeft":
      return handleShiftToWall(state, "Left");
    case "ShiftToWallRight":
      return handleShiftToWall(state, "Right");
    case "RotateCW":
      return handleRotation(state, "CW");
    case "RotateCCW":
      return handleRotation(state, "CCW");
    case "SoftDropOn":
      return handleSoftDrop(state, true);
    case "SoftDropOff":
      return handleSoftDrop(state, false);
    case "HardDrop":
      return handleHardDrop(state);
    case "Hold":
      return handleHold(state);
  }
}

export function applyCommands(
  state: GameState,
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
  let spawnOverride: PieceId | undefined;

  for (const cmd of cmds) {
    const result = getCommandHandler(cmd, s);
    s = result.state;
    events.push(...result.events);
    lockResetEligible = lockResetEligible || result.lockResetEligible;
    // Take the first reset reason we find (since there should only be one per tick)
    if (lockResetReason === undefined && result.lockResetReason !== undefined) {
      lockResetReason = result.lockResetReason;
    }
    hardDropped = hardDropped || result.hardDropped;
    // Take the first spawn override we find (there should only be one per tick)
    if (spawnOverride === undefined && result.spawnOverride !== undefined) {
      spawnOverride = result.spawnOverride;
    }
  }

  return {
    events,
    sideEffects: {
      hardDropped,
      lockResetEligible,
      lockResetReason,
      ...(spawnOverride !== undefined && { spawnOverride }),
    },
    state: s,
  };
}
