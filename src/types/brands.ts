// Branded primitive types for type safety and domain modeling

// Duration in milliseconds - for time intervals/deltas
declare const DurationMsBrand: unique symbol;
export type DurationMs = number & { readonly [DurationMsBrand]: true };

// Grid coordinates - for board positions (must be integers)
declare const GridCoordBrand: unique symbol;
export type GridCoord = number & { readonly [GridCoordBrand]: true };

// Cell values - 0=empty, 1-7=tetrominos, 8=garbage
declare const CellValueBrand: unique symbol;
export type CellValue = (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) & {
  readonly [CellValueBrand]: true;
};

// Frame counter - for frame-based timing if needed
declare const FrameBrand: unique symbol;
export type Frame = number & { readonly [FrameBrand]: true };

// RNG seed - for random number generator seeding
declare const SeedBrand: unique symbol;
export type Seed = string & { readonly [SeedBrand]: true };

// DurationMs constructors and guards
export function createDurationMs(value: number): DurationMs {
  if (value < 0 || !Number.isFinite(value)) {
    throw new Error("DurationMs must be a non-negative finite number");
  }
  return value as DurationMs;
}

export function isDurationMs(n: unknown): n is DurationMs {
  return typeof n === "number" && n >= 0 && Number.isFinite(n);
}

export function assertDurationMs(n: unknown): asserts n is DurationMs {
  if (!isDurationMs(n)) throw new Error("Not a valid DurationMs");
}

// GridCoord constructors and guards
export function createGridCoord(value: number): GridCoord {
  if (!Number.isInteger(value)) {
    throw new Error("GridCoord must be an integer");
  }
  return value as GridCoord;
}

export function isGridCoord(n: unknown): n is GridCoord {
  return typeof n === "number" && Number.isInteger(n);
}

export function assertGridCoord(n: unknown): asserts n is GridCoord {
  if (!isGridCoord(n)) throw new Error("Not a valid GridCoord");
}

// CellValue constructors and guards
export function createCellValue(value: number): CellValue {
  if (!Number.isInteger(value) || value < 0 || value > 8) {
    throw new Error("CellValue must be an integer from 0 to 8");
  }
  return value as CellValue;
}

export function isCellValue(n: unknown): n is CellValue {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 8;
}

export function assertCellValue(n: unknown): asserts n is CellValue {
  if (!isCellValue(n)) throw new Error("Not a valid CellValue");
}

// Frame constructors and guards
export function createFrame(value: number): Frame {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Frame must be a non-negative integer");
  }
  return value as Frame;
}

export function isFrame(n: unknown): n is Frame {
  return typeof n === "number" && Number.isInteger(n) && n >= 0;
}

export function assertFrame(n: unknown): asserts n is Frame {
  if (!isFrame(n)) throw new Error("Not a valid Frame");
}

// Seed constructors and guards
export function createSeed(value: string): Seed {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Seed must be a non-empty string");
  }
  return value as Seed;
}

export function isSeed(s: unknown): s is Seed {
  return typeof s === "string" && s.length > 0;
}

export function assertSeed(s: unknown): asserts s is Seed {
  if (!isSeed(s)) throw new Error("Not a valid Seed");
}

// Conversion helpers for interop at boundaries
export const durationMsAsNumber = (d: DurationMs): number => d as number;
export const gridCoordAsNumber = (g: GridCoord): number => g as number;
export const cellValueAsNumber = (c: CellValue): number => c as number;
export const frameAsNumber = (f: Frame): number => f as number;
export const seedAsString = (s: Seed): string => s as string;

// Safe conversion from unbranded values (with validation)
export function numberToDurationMs(n: number): DurationMs {
  return createDurationMs(n);
}

export function numberToGridCoord(n: number): GridCoord {
  return createGridCoord(n);
}

export function numberToCellValue(n: number): CellValue {
  return createCellValue(n);
}

export function numberToFrame(n: number): Frame {
  return createFrame(n);
}

export function stringToSeed(s: string): Seed {
  return createSeed(s);
}
