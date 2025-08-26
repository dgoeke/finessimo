// Mock implementation of @lit-labs/signals for Jest tests
// This allows tests to run without breaking, while the actual signal functionality
// works in the browser environment

export interface Signal<T> {
  get(): T;
  set(value: T): void;
}

class MockSignal<T> implements Signal<T> {
  private _value: T;

  constructor(initialValue: T) {
    this._value = initialValue;
  }

  get(): T {
    return this._value;
  }

  set(value: T): void {
    this._value = value;
  }
}

export function signal<T>(initialValue: T): Signal<T> {
  return new MockSignal(initialValue);
}

// Export additional items that might be used in the future
export const SignalWatcher = (base: any) => base;
export const watch = (signal: Signal<any>) => signal.get();
export const html = () => '';
export const svg = () => '';
export const withWatch = () => '';