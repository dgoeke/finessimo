import { type Action } from "../../src/state/types";
import { type Timestamp } from "../../src/types/timestamp";
import { createTimestamp } from "../../src/types/timestamp";

/**
 * Test helpers for creating Action objects with sensible defaults
 */

type TapMoveOverrides = {
  optimistic?: boolean;
  timestampMs?: Timestamp;
};

type HoldMoveOverrides = {
  timestampMs?: Timestamp;
};

type HoldStartOverrides = {
  timestampMs?: Timestamp;
};

type RepeatMoveOverrides = {
  timestampMs?: Timestamp;
};

export function MoveLeft(overrides: TapMoveOverrides = {}): Action {
  return {
    dir: -1,
    optimistic: false, // Default to non-optimistic
    timestampMs: createTimestamp(1000), // Default timestamp
    type: "TapMove",
    ...overrides,
  };
}

export function MoveRight(overrides: TapMoveOverrides = {}): Action {
  return {
    dir: 1,
    optimistic: false, // Default to non-optimistic
    timestampMs: createTimestamp(1000), // Default timestamp
    type: "TapMove",
    ...overrides,
  };
}

export function HoldMoveLeft(overrides: HoldMoveOverrides = {}): Action {
  return {
    dir: -1,
    timestampMs: createTimestamp(1167), // Default DAS + delay
    type: "HoldMove",
    ...overrides,
  };
}

export function HoldMoveRight(overrides: HoldMoveOverrides = {}): Action {
  return {
    dir: 1,
    timestampMs: createTimestamp(1167), // Default DAS + delay
    type: "HoldMove",
    ...overrides,
  };
}

export function HoldStartLeft(overrides: HoldStartOverrides = {}): Action {
  return {
    dir: -1,
    timestampMs: createTimestamp(1167), // Default DAS delay
    type: "HoldStart",
    ...overrides,
  };
}

export function HoldStartRight(overrides: HoldStartOverrides = {}): Action {
  return {
    dir: 1,
    timestampMs: createTimestamp(1167), // Default DAS delay
    type: "HoldStart",
    ...overrides,
  };
}

export function RepeatMoveLeft(overrides: RepeatMoveOverrides = {}): Action {
  return {
    dir: -1,
    timestampMs: createTimestamp(1200), // Default ARR repeat
    type: "RepeatMove",
    ...overrides,
  };
}

export function RepeatMoveRight(overrides: RepeatMoveOverrides = {}): Action {
  return {
    dir: 1,
    timestampMs: createTimestamp(1200), // Default ARR repeat
    type: "RepeatMove",
    ...overrides,
  };
}

export function RotateCW(
  timestampMs: Timestamp = createTimestamp(1000),
): Action {
  return {
    dir: "CW",
    timestampMs,
    type: "Rotate",
  };
}

export function RotateCCW(
  timestampMs: Timestamp = createTimestamp(1000),
): Action {
  return {
    dir: "CCW",
    timestampMs,
    type: "Rotate",
  };
}

export function HardDrop(
  timestampMs: Timestamp = createTimestamp(1000),
): Action {
  return {
    timestampMs,
    type: "HardDrop",
  };
}

export function SoftDropOn(
  timestampMs: Timestamp = createTimestamp(1000),
): Action {
  return {
    on: true,
    timestampMs,
    type: "SoftDrop",
  };
}

export function SoftDropOff(
  timestampMs: Timestamp = createTimestamp(1000),
): Action {
  return {
    on: false,
    timestampMs,
    type: "SoftDrop",
  };
}

export function Hold(): Action {
  return {
    type: "Hold",
  };
}
