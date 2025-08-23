export function assertDefined<T>(value: T | undefined | null, msg?: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(msg ?? 'Expected value to be defined');
  }
}

