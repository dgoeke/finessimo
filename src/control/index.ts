import type { ControlState, ControlResult, KeyEdge, Key } from "./types.js";
import type { Command } from "../engine/commands.js";
import type { Tick } from "../engine/types.js";

/**
 * Safely adds ticks to a branded Tick type at system boundaries
 */
function addTicks(baseTick: Tick, deltaTicks: number): Tick {
  return (baseTick + deltaTicks) as Tick;
}

/**
 * Processes Left key edge
 */
function processLeftKey(
  state: ControlState,
  type: "down" | "up",
  tick: Tick,
  commands: Array<Command>,
): void {
  state.leftDown = type === "down";

  if (type === "down") {
    commands.push({ kind: "MoveLeft", source: "tap" });
    state.dasDeadlineTick = addTicks(tick, state.cfg.dasTicks);
    state.activeDir = "Left";
    state.nextRepeatTick =
      state.cfg.arrTicks > 0 ? addTicks(tick, state.cfg.dasTicks) : null;
  } else if (state.activeDir === "Left") {
    state.activeDir = state.rightDown ? "Right" : null;
    updateDasArrTiming(state, tick);
  }
}

/**
 * Processes Right key edge
 */
function processRightKey(
  state: ControlState,
  type: "down" | "up",
  tick: Tick,
  commands: Array<Command>,
): void {
  state.rightDown = type === "down";

  if (type === "down") {
    commands.push({ kind: "MoveRight", source: "tap" });
    state.dasDeadlineTick = addTicks(tick, state.cfg.dasTicks);
    state.activeDir = "Right";
    state.nextRepeatTick =
      state.cfg.arrTicks > 0 ? addTicks(tick, state.cfg.dasTicks) : null;
  } else if (state.activeDir === "Right") {
    state.activeDir = state.leftDown ? "Left" : null;
    updateDasArrTiming(state, tick);
  }
}

/**
 * Updates DAS/ARR timing based on current active direction
 */
function updateDasArrTiming(state: ControlState, tick: Tick): void {
  if (state.activeDir !== null) {
    state.dasDeadlineTick = addTicks(tick, state.cfg.dasTicks);
    state.nextRepeatTick =
      state.cfg.arrTicks > 0 ? addTicks(tick, state.cfg.dasTicks) : null;
  } else {
    state.dasDeadlineTick = null;
    state.nextRepeatTick = null;
  }
}

/**
 * Processes action key edges (non-movement keys)
 */
function processActionKey(
  key: Exclude<Key, "Left" | "Right">,
  type: "down" | "up",
  commands: Array<Command>,
): void {
  switch (key) {
    case "SoftDrop":
      commands.push({ kind: type === "down" ? "SoftDropOn" : "SoftDropOff" });
      break;
    case "HardDrop":
      if (type === "down") commands.push({ kind: "HardDrop" });
      break;
    case "CW":
      if (type === "down") commands.push({ kind: "RotateCW" });
      break;
    case "CCW":
      if (type === "down") commands.push({ kind: "RotateCCW" });
      break;
    case "Hold":
      if (type === "down") commands.push({ kind: "Hold" });
      break;
  }
}

/**
 * Generates DAS/ARR commands based on current timing state
 */
function generateDasArrCommands(
  state: ControlState,
  tick: Tick,
  commands: Array<Command>,
): void {
  if (state.activeDir === null) return;

  if (state.cfg.arrTicks === 0) {
    // Sonic at DAS deadline
    if (state.dasDeadlineTick !== null && tick >= state.dasDeadlineTick) {
      commands.push({
        kind:
          state.activeDir === "Left" ? "ShiftToWallLeft" : "ShiftToWallRight",
      });
      state.dasDeadlineTick = null;
    }
  } else {
    // Repeats
    if (state.nextRepeatTick !== null && tick >= state.nextRepeatTick) {
      commands.push({
        kind: state.activeDir === "Left" ? "MoveLeft" : "MoveRight",
        source: "repeat",
      });
      state.nextRepeatTick = addTicks(tick, state.cfg.arrTicks);
    }
  }
}

/**
 * Pure DAS/ARR transducer.
 * - Emits immediate MoveLeft/MoveRight on new down.
 * - Starts DAS timer; after DAS: if ARR=0 emits ShiftToWall..., else emits repeats every arrTicks.
 * - Emits SoftDropOn/Off and other commands on edges.
 */
export function controlStep(
  state: ControlState,
  tick: Tick,
  edges: ReadonlyArray<KeyEdge>,
): ControlResult {
  const s = { ...state };
  const cmds: Array<Command> = [];

  // Process all key edges
  for (const edge of edges) {
    switch (edge.key) {
      case "Left":
        processLeftKey(s, edge.type, tick, cmds);
        break;
      case "Right":
        processRightKey(s, edge.type, tick, cmds);
        break;
      case "SoftDrop":
      case "HardDrop":
      case "CW":
      case "CCW":
      case "Hold":
        processActionKey(edge.key, edge.type, cmds);
        break;
    }
  }

  // Generate DAS/ARR commands
  generateDasArrCommands(s, tick, cmds);

  return { commands: cmds, next: s };
}
