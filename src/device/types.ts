/**
 * Unified device input representation. The device adapters (keyboard, mouse, touch)
 * should normalize concrete events into KeyEdges per tick.
 */
export type Device = "keyboard" | "mouse" | "touch" | "gamepad";
export type Key =
  | "Left"
  | "Right"
  | "CW"
  | "CCW"
  | "HardDrop"
  | "SoftDrop"
  | "Hold";

export type KeyEdge = Readonly<{
  device: Device;
  key: Key;
  type: "down" | "up";
}>;
