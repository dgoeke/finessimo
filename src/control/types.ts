import type { Command } from "../engine/commands";
import type { Tick, TickDelta } from "../engine/types";

export type Key =
  | "Left"
  | "Right"
  | "CW"
  | "CCW"
  | "HardDrop"
  | "SoftDrop"
  | "Hold";
export type KeyEdge = { key: Key; type: "down" | "up" };

export type ControlConfig = Readonly<{
  dasTicks: TickDelta;
  arrTicks: TickDelta;
}>;

export type ControlState = {
  leftDown: boolean;
  rightDown: boolean;
  softDropDown: boolean;
  activeDir: "Left" | "Right" | null;
  dasDeadlineTick: Tick | null;
  nextRepeatTick: Tick | null;
  cfg: ControlConfig;
};

export type ControlResult = {
  next: ControlState;
  commands: ReadonlyArray<Command>;
};
