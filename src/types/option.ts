// Functional Option patterns for null safety

export type Option<T> = T | null | undefined;

/**
 * Maps over an Option value with a transformation function.
 * If the value is null/undefined, returns the default value.
 */
export const mapOption = <T, U>(
  opt: Option<T>,
  fn: (value: T) => U,
  defaultValue: U,
): U => (opt != null ? fn(opt) : defaultValue);

/**
 * Chains Option computations together.
 * If any step in the chain is null/undefined, the whole chain returns null.
 */
export const flatMapOption = <T, U>(
  opt: Option<T>,
  fn: (value: T) => Option<U>,
): Option<U> => (opt != null ? fn(opt) : null);

/**
 * Returns the value if present, otherwise returns the default.
 */
export const getOrElse = <T>(opt: Option<T>, defaultValue: T): T =>
  opt ?? defaultValue;

/**
 * Filters an Option based on a predicate.
 * Returns null if the value doesn't match the predicate.
 */
export const filterOption = <T>(
  opt: Option<T>,
  predicate: (value: T) => boolean,
): Option<T> => (opt != null && predicate(opt) ? opt : null);

/**
 * Type guard to check if an Option has a value.
 */
export const isSome = <T>(opt: Option<T>): opt is T => opt != null;

/**
 * Type guard to check if an Option is empty.
 */
export const isNone = <T>(opt: Option<T>): opt is null | undefined =>
  opt == null;
