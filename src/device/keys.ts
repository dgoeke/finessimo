import type { Tick } from "@/engine/types";

export type { Tick };

export type Device = "keyboard" | "gamepad" | "touch" | "mouse";

// Physical input codes (what user actually presses)
// Examples: "ArrowUp", "Space", "KeyZ", "gp:button:0", etc.
// (Using string directly as PhysicalInput would be redundant)

// Logical input actions (what those inputs mean)
export type InputAction = GameAction | UIAction;

// Game-related actions
export type GameAction =
  | "MoveLeft"
  | "MoveRight"
  | "RotateCW"
  | "RotateCCW"
  | "SoftDrop"
  | "HardDrop"
  | "Hold";

// UI navigation actions
export type UIAction =
  | "NavigateUp"
  | "NavigateDown"
  | "NavigateLeft"
  | "NavigateRight"
  | "Select"
  | "Back";

export type InputEdge = Readonly<{
  device: Device;
  action: InputAction;
  type: "down" | "up";
  tick: Tick;
}>;

// Keymap maps physical inputs to logical actions
export type Keymap = Readonly<Map<string, ReadonlyArray<InputAction>>>;
