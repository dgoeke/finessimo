import type { Tick, PieceId } from "./types";

export type DomainEvent =
  | { kind: "PieceSpawned"; pieceId: PieceId; tick: Tick }
  | { kind: "MovedLeft"; fromX: number; toX: number; tick: Tick }
  | { kind: "MovedRight"; fromX: number; toX: number; tick: Tick }
  | {
      kind: "Rotated";
      dir: "CW" | "CCW";
      kick: "none" | "wall" | "floor";
      tick: Tick;
    }
  | { kind: "SoftDropToggled"; on: boolean; tick: Tick }
  | { kind: "LockStarted"; tick: Tick }
  | { kind: "LockReset"; reason: "move" | "rotate"; tick: Tick }
  | {
      kind: "Locked";
      source: "ground" | "hardDrop";
      pieceId: PieceId;
      tick: Tick;
    }
  | { kind: "LinesCleared"; rows: Array<number>; tick: Tick }
  | { kind: "Held"; swapped: boolean; tick: Tick }
  | { kind: "TopOut"; tick: Tick };
