import { addTicks, isTickAfterOrEqual } from "@/engine/utils/tick";

import type {
  ControlState,
  ControlResult,
  ControlEvent,
  KeyEdge,
  Key,
} from "@/control/types";
import type { Command } from "@/engine/commands";
import type { Tick } from "@/engine/types";

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
  telemetry: Array<ControlEvent>,
): void {
  state.leftDown = type === "down";

  // Always emit key edge telemetry
  telemetry.push({
    key: "Left",
    kind: type === "down" ? "KeyDown" : "KeyUp",
    tick,
  });

  if (type === "down") {
    commands.push({ kind: "MoveLeft", source: "tap" });
    telemetry.push({ dir: "Left", kind: "Tap", tick });
    telemetry.push({ dir: "Left", kind: "DasStart", tick });
    state.dasDeadlineTick = addTicks(tick, state.cfg.dasTicks);
    state.activeDir = "Left"; // Last-pressed wins
    state.nextRepeatTick =
      state.cfg.arrTicks > 0 ? addTicks(tick, state.cfg.dasTicks) : null;
  } else if (state.activeDir === "Left") {
    // Release-to-reverse: if Right is still held, switch to Right
    if (state.rightDown) {
      state.activeDir = "Right";
      telemetry.push({ dir: "Right", kind: "DasStart", tick });
    } else {
      state.activeDir = null;
    }
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
  telemetry: Array<ControlEvent>,
): void {
  state.rightDown = type === "down";

  // Always emit key edge telemetry
  telemetry.push({
    key: "Right",
    kind: type === "down" ? "KeyDown" : "KeyUp",
    tick,
  });

  if (type === "down") {
    commands.push({ kind: "MoveRight", source: "tap" });
    telemetry.push({ dir: "Right", kind: "Tap", tick });
    telemetry.push({ dir: "Right", kind: "DasStart", tick });
    state.dasDeadlineTick = addTicks(tick, state.cfg.dasTicks);
    state.activeDir = "Right"; // Last-pressed wins
    state.nextRepeatTick =
      state.cfg.arrTicks > 0 ? addTicks(tick, state.cfg.dasTicks) : null;
  } else if (state.activeDir === "Right") {
    // Release-to-reverse: if Left is still held, switch to Left
    if (state.leftDown) {
      state.activeDir = "Left";
      telemetry.push({ dir: "Left", kind: "DasStart", tick });
    } else {
      state.activeDir = null;
    }
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
  tick: Tick,
  commands: Array<Command>,
  telemetry: Array<ControlEvent>,
): void {
  // Always emit key edge telemetry
  telemetry.push({ key, kind: type === "down" ? "KeyDown" : "KeyUp", tick });

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
 * Handles ARR=0 sonic behavior: shift to wall once after DAS, then stop
 */
function handleSonicBehavior(
  state: ControlState,
  tick: Tick,
  commands: Array<Command>,
  telemetry: Array<ControlEvent>,
): void {
  if (
    state.dasDeadlineTick !== null &&
    state.activeDir !== null &&
    isTickAfterOrEqual(tick, state.dasDeadlineTick)
  ) {
    telemetry.push({ dir: state.activeDir, kind: "DasMature", tick });
    telemetry.push({ dir: state.activeDir, kind: "SonicShift", tick });
    commands.push({
      kind: state.activeDir === "Left" ? "ShiftToWallLeft" : "ShiftToWallRight",
    });
    // Clear deadline to prevent repeat firing
    state.dasDeadlineTick = null;
  }
}

/**
 * Handles ARR>0 repeating behavior: emit repeats every arrTicks after DAS
 */
function handleRepeatingBehavior(
  state: ControlState,
  tick: Tick,
  commands: Array<Command>,
  telemetry: Array<ControlEvent>,
): void {
  if (
    state.nextRepeatTick !== null &&
    state.activeDir !== null &&
    isTickAfterOrEqual(tick, state.nextRepeatTick)
  ) {
    // On first repeat (when nextRepeatTick == dasDeadlineTick), emit DasMature
    if (
      state.dasDeadlineTick !== null &&
      state.nextRepeatTick === state.dasDeadlineTick
    ) {
      telemetry.push({ dir: state.activeDir, kind: "DasMature", tick });
    }
    telemetry.push({ dir: state.activeDir, kind: "ArrRepeat", tick });
    commands.push({
      kind: state.activeDir === "Left" ? "MoveLeft" : "MoveRight",
      source: "repeat",
    });
    state.nextRepeatTick = addTicks(tick, state.cfg.arrTicks);
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
  telemetry: Array<ControlEvent>,
): void {
  if (state.activeDir === null) return;

  if (state.cfg.arrTicks === 0) {
    handleSonicBehavior(state, tick, commands, telemetry);
  } else {
    handleRepeatingBehavior(state, tick, commands, telemetry);
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
  const telemetry: Array<ControlEvent> = [];

  // Process all key edges
  for (const edge of edges) {
    switch (edge.key) {
      case "Left":
        processLeftKey(s, edge.type, tick, cmds, telemetry);
        break;
      case "Right":
        processRightKey(s, edge.type, tick, cmds, telemetry);
        break;
      case "SoftDrop":
      case "HardDrop":
      case "CW":
      case "CCW":
      case "Hold":
        processActionKey(edge.key, edge.type, tick, cmds, telemetry);
        break;
    }
  }

  // Generate DAS/ARR commands
  generateDasArrCommands(s, tick, cmds, telemetry);

  return { commands: cmds, next: s, telemetry };
}
