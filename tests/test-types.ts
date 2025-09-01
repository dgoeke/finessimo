import type { SevenBagRng } from "../src/core/rng";
import type {
  GameState,
  Action,
  PieceId,
  ActivePiece,
  Board,
  Rot,
} from "../src/state/types";

// Deep partial type for testing invalid/partial states
export type DeepPartial<T> =
  T extends Record<string, unknown>
    ? {
        [P in keyof T]?: DeepPartial<T[P]>;
      }
    : T;

// Invalid game state for testing error handling
export type InvalidGameState = DeepPartial<GameState>;

// Malformed action types for testing invalid actions
export type MalformedAction =
  | {
      type: "Init";
      seed?: unknown;
      timing?: unknown;
      gameplay?: unknown;
      mode?: unknown;
    }
  | { type: "Tick"; timestampMs: unknown }
  | { type: "Spawn"; piece?: unknown; timestampMs?: unknown }
  | { type: "Move"; dir: unknown; source: unknown }
  | { type: "SoftDrop"; on: unknown }
  | { type: "Rotate"; dir: unknown }
  | { type: "StartLockDelay"; timestampMs: unknown }
  | { type: "StartLineClear"; lines: unknown; timestampMs: unknown }
  | { type: "ClearLines"; lines: unknown }
  | { type: "EnqueueInput"; event: unknown }
  | { type: unknown; [key: string]: unknown };

// Corrupted RNG for testing RNG error handling
export type CorruptedRng = {
  currentBag: Array<PieceId | undefined | null>;
} & Omit<SevenBagRng, "currentBag">;

// Invalid piece for testing
export type InvalidPiece =
  | Partial<ActivePiece>
  | {
      id: unknown;
      rot: unknown;
      x: unknown;
      y: unknown;
    };

// Corrupted board for testing
export type CorruptedBoard = {
  cells: unknown;
} & Omit<Board, "cells">;

// Type guards
export function isValidGameState(state: unknown): state is GameState {
  if (state === undefined || state === null || typeof state !== "object")
    return false;
  const s = state as Record<string, unknown>;
  return (
    s["board"] !== undefined &&
    s["tick"] !== undefined &&
    s["status"] !== undefined &&
    s["rng"] !== undefined &&
    s["timing"] !== undefined &&
    s["gameplay"] !== undefined &&
    s["physics"] !== undefined &&
    s["inputLog"] !== undefined &&
    s["stats"] !== undefined
  );
}

export function isValidAction(action: unknown): action is Action {
  if (action === undefined || action === null || typeof action !== "object")
    return false;
  const a = action as Record<string, unknown>;
  return (
    typeof a["type"] === "string" &&
    [
      "Init",
      "Tick",
      "Spawn",
      "Move",
      "SoftDrop",
      "Rotate",
      "HardDrop",
      "Hold",
      "Lock",
      "StartLockDelay",
      "CancelLockDelay",
      "StartLineClear",
      "CompleteLineClear",
      "ClearLines",
      "EnqueueInput",
    ].includes(a["type"])
  );
}

export function isValidPieceId(id: unknown): id is PieceId {
  return (
    typeof id === "string" && ["I", "O", "T", "S", "Z", "J", "L"].includes(id)
  );
}

export function isValidRot(rot: unknown): rot is Rot {
  return (
    typeof rot === "string" && ["spawn", "right", "two", "left"].includes(rot)
  );
}

// Test-specific invalid action creators
export function createInvalidAction(
  overrides: Partial<MalformedAction>,
): MalformedAction {
  return {
    type: "InvalidAction",
    ...overrides,
  } as MalformedAction;
}

export function createPartialGameState(
  overrides: InvalidGameState,
): InvalidGameState {
  return overrides;
}

export function createCorruptedRng(
  seed: string,
  corruption: "empty" | "undefined" | "null" = "undefined",
): CorruptedRng {
  let bag: Array<PieceId | undefined | null>;
  if (corruption === "empty") bag = [];
  else if (corruption === "undefined") bag = [undefined];
  else bag = [null];

  return {
    bagIndex: 0,
    currentBag: bag,
    internalSeed: 12345,
    seed,
  };
}
