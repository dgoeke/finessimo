import type { GameState, ActivePiece, PieceId } from "../src/state/types";
import type { SevenBagRng } from "../src/core/rng";

// Assertion helper that provides runtime type narrowing
export function assertDefined<T>(
  value: T | undefined | null,
  message?: string,
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message ?? "Expected value to be defined");
  }
}

// Assert that a game state has an active piece
export function assertActivePiece(
  state: GameState,
  message?: string,
): asserts state is GameState & { active: ActivePiece } {
  if (!state.active) {
    throw new Error(message ?? "Expected state to have an active piece");
  }
}

// Assert that a game state has a held piece
export function assertHasPiece(
  state: GameState,
  message?: string,
): asserts state is GameState & { hold: PieceId } {
  if (!state.hold) {
    throw new Error(message ?? "Expected state to have a held piece");
  }
}

// Assert that RNG has a valid current bag
export function assertValidBag(
  rng: SevenBagRng,
  message?: string,
): asserts rng is SevenBagRng & { currentBag: PieceId[] } {
  if (!rng.currentBag || rng.currentBag.length === 0) {
    throw new Error(message ?? "Expected RNG to have a valid bag");
  }
  for (const piece of rng.currentBag) {
    if (!piece || !["I", "O", "T", "S", "Z", "J", "L"].includes(piece)) {
      throw new Error(message ?? `Invalid piece in bag: ${piece}`);
    }
  }
}

// Safe property access with default value
export function getOrDefault<T, K extends keyof T>(
  obj: T | undefined | null,
  key: K,
  defaultValue: T[K],
): T[K] {
  if (!obj) return defaultValue;
  return obj[key] ?? defaultValue;
}

// Safe array access with bounds checking
export function safeArrayAccess<T>(
  arr: T[] | undefined | null,
  index: number,
  defaultValue: T,
): T {
  if (!arr || index < 0 || index >= arr.length) {
    return defaultValue;
  }
  return arr[index] ?? defaultValue;
}

// Type-safe property existence check
export function hasProperty<T extends object, K extends PropertyKey>(
  obj: T,
  key: K,
): obj is T & Record<K, unknown> {
  return key in obj;
}

// Assert a value is not null or undefined with custom error
export function assertNotNull<T>(
  value: T | null | undefined,
  name: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`${name} should not be null or undefined`);
  }
}

// Assert array has minimum length
export function assertArrayLength<T>(
  arr: T[] | undefined | null,
  minLength: number,
  message?: string,
): asserts arr is T[] {
  if (!arr || arr.length < minLength) {
    throw new Error(
      message ??
        `Expected array to have at least ${minLength} elements, got ${arr?.length ?? 0}`,
    );
  }
}

// Type guard for checking if value is a number
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

// Type guard for checking if value is a valid tick
export function isValidTick(value: unknown): value is number {
  return isNumber(value) && value >= 0 && Number.isInteger(value);
}

// Assert that a value matches an expected type with a custom validator
export function assertType<T>(
  value: unknown,
  validator: (v: unknown) => v is T,
  message?: string,
): asserts value is T {
  if (!validator(value)) {
    throw new Error(message ?? "Value does not match expected type");
  }
}
