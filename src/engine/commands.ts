export type Command =
  | { kind: "MoveLeft"; source?: "tap" | "repeat" }
  | { kind: "MoveRight"; source?: "tap" | "repeat" }
  | { kind: "ShiftToWallLeft" }
  | { kind: "ShiftToWallRight" }
  | { kind: "RotateCW" }
  | { kind: "RotateCCW" }
  | { kind: "SoftDropOn" }
  | { kind: "SoftDropOff" }
  | { kind: "HardDrop" }
  | { kind: "Hold" };
