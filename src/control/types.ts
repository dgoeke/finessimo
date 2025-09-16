import type { Command } from "@/engine/commands";
import type { Tick, TickDelta } from "@/engine/types";

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

/**
 * Control telemetry events that describe input semantics.
 * These events provide insight into how moves are happening (tap vs DAS/ARR vs sonic).
 */
export type ControlEvent =
  | { kind: "KeyDown"; key: Key; tick: Tick }
  | { kind: "KeyUp"; key: Key; tick: Tick }
  | { kind: "Tap"; dir: "Left" | "Right"; tick: Tick }
  | { kind: "DasStart"; dir: "Left" | "Right"; tick: Tick }
  | { kind: "DasMature"; dir: "Left" | "Right"; tick: Tick }
  | { kind: "ArrRepeat"; dir: "Left" | "Right"; tick: Tick }
  | { kind: "SonicShift"; dir: "Left" | "Right"; tick: Tick };

export type ControlResult = {
  next: ControlState;
  commands: ReadonlyArray<Command>;
  telemetry: ReadonlyArray<ControlEvent>;
};
