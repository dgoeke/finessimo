// timestamp.ts
declare const TimestampBrand: unique symbol;

export type Timestamp = number & { readonly [TimestampBrand]: true };

// Constructors / guards
export function createTimestamp(value: number): Timestamp {
  if (value <= 0 || !Number.isFinite(value)) {
    throw new Error("Timestamp must be a finite, non-zero number.");
  }
  return value as Timestamp;
}

export function fromNow(): Timestamp {
  return createTimestamp(performance.now());
}

export function isTimestamp(n: unknown): n is Timestamp {
  return typeof n === "number" && n !== 0 && Number.isFinite(n);
}

export function assertTimestamp(n: unknown): asserts n is Timestamp {
  if (!isTimestamp(n)) throw new Error("Not a Timestamp.");
}

// Helpers for interop
export const asNumber = (t: Timestamp) => t as number;
