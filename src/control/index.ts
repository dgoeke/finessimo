import { addTicks, isTickAfterOrEqual } from "../engine/utils/tick";

import type { ControlState, ControlResult, KeyEdge, Key } from "./types";
import type { Command } from "../engine/commands";
import type { Tick } from "../engine/types";

/**
 * Processes Left key edge
 *
 * Left/Right contention semantics: "Last-pressed wins"
 * - When Left is pressed while Right is active: Left becomes active
 * - When Left is released while active: Right becomes active if still held, else null
 * - This allows for quick direction changes without releasing both keys
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
    state.activeDir = "Left"; // Last-pressed wins
    state.nextRepeatTick =
      state.cfg.arrTicks > 0 ? addTicks(tick, state.cfg.dasTicks) : null;
  } else if (state.activeDir === "Left") {
    // Release-to-reverse: if Right is still held, switch to Right
    state.activeDir = state.rightDown ? "Right" : null;
    updateDasArrTiming(state, tick);
  }
}

/**
 * Processes Right key edge
 *
 * Left/Right contention semantics: "Last-pressed wins"
 * - When Right is pressed while Left is active: Right becomes active
 * - When Right is released while active: Left becomes active if still held, else null
 * - This allows for quick direction changes without releasing both keys
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
    state.activeDir = "Right"; // Last-pressed wins
    state.nextRepeatTick =
      state.cfg.arrTicks > 0 ? addTicks(tick, state.cfg.dasTicks) : null;
  } else if (state.activeDir === "Right") {
    // Release-to-reverse: if Left is still held, switch to Left
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
 *
 * ARR=0 behavior: After DAS delay, emits ONE ShiftToWall command and stops.
 * This provides "sonic" movement that instantly moves piece to wall.
 * No repeats are generated when ARR=0 to prevent continuous wall-shifting.
 */
function generateDasArrCommands(
  state: ControlState,
  tick: Tick,
  commands: Array<Command>,
): void {
  if (state.activeDir === null) return;

  if (state.cfg.arrTicks === 0) {
    // ARR=0: Sonic behavior - shift to wall once after DAS, then stop
    if (
      state.dasDeadlineTick !== null &&
      isTickAfterOrEqual(tick, state.dasDeadlineTick)
    ) {
      commands.push({
        kind:
          state.activeDir === "Left" ? "ShiftToWallLeft" : "ShiftToWallRight",
      });
      // Clear deadline to prevent repeat firing
      state.dasDeadlineTick = null;
    }
  } else {
    // ARR>0: Normal repeating behavior
    if (
      state.nextRepeatTick !== null &&
      isTickAfterOrEqual(tick, state.nextRepeatTick)
    ) {
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
