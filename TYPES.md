# `types.ts` Review – Finessimo Tetris Simulator

This document evaluates the `types.ts` file from the [finessimo](https://github.com/dgoeke/finessimo) project.
It highlights **potential mistakes**, **cleanup opportunities**, and **general best practices**.
Each section is grouped by theme for clarity and future iteration.

---

## 🔴 High-Impact Fixes

### 1. `isCellBlocked` width bug

- **Issue**: `idx(x, y)` defaults to `width = 10`, ignoring `board.width`.
- **Fix**: Pass `board.width` explicitly.

```ts
export const idx = (x: number, y: number, width: number): number =>
  y * width + x;

export function isCellBlocked(board: Board, x: number, y: number): boolean {
  if (x < 0 || x >= board.width) return true;
  if (y >= board.height) return true;
  if (y < 0) return false;
  return board.cells[idx(x, y, board.width)] !== 0;
}
```

---

### 2. Garbage value inconsistency

- **Issue**: `Board.cells` comment says `0..7`, but `CreateGarbageRow` uses `8 = garbage`.
- **Fix**: Decide if `8` is valid. Update **both** type docs and runtime logic accordingly.

---

## 🟡 Type Safety Improvements

### 3. Encode `pendingLock` invariant

- **Issue**: Comment says `pendingLock` must be non-null only when `status === "resolvingLock"`. Not enforced by type system.
- **Fix**: Use a discriminated union:

```ts
type PlayingState = {
  status: "playing" | "lineClear" | "topOut";
  pendingLock: null;
};

type ResolvingLockState = {
  status: "resolvingLock";
  pendingLock: PendingLock;
};

export type GameStatus = PlayingState | ResolvingLockState;

export type GameState = GameStatus & {
  // … other shared fields
};
```

---

### 4. `processedInputLog` type mismatch

- **Issue**: Comment says it’s a log of _processed input actions_, but type is `Action[]` (engine actions).
- **Fix**: Define a dedicated type:

```ts
export type ProcessedAction =
  | { kind: "TapMove"; dir: -1 | 1; t: Timestamp }
  | { kind: "HoldMove"; dir: -1 | 1; t: Timestamp }
  | { kind: "RepeatMove"; dir: -1 | 1; t: Timestamp }
  | { kind: "Rotate"; dir: "CW" | "CCW"; t: Timestamp }
  | { kind: "SoftDrop"; on: boolean; t: Timestamp }
  | { kind: "HardDrop"; t: Timestamp };

processedInputLog: ProcessedAction[];
```

---

### 5. Consistent `Timestamp` usage

- **Issue**: Some fields use plain `number`, others use `Timestamp`.
- **Fix**: Standardize. Consider introducing a `DurationMs` brand to distinguish instants vs. durations.

Examples:

```ts
export type PhysicsState = {
  lastGravityTime: Timestamp;
  lockDelayStartTime: Timestamp | null;
  lineClearStartTime: Timestamp | null;
};

export type InputEvent = {
  tMs: Timestamp;
  frame: number;
  action: KeyAction;
};
```

---

### 6. `TimingConfig.tickHz` as literal

- **Issue**: Declared as `60` literal → only accepts `60`.
- **Fix**: Make it `number` with docstring:

```ts
export type TimingConfig = {
  tickHz: number; // default 60
  dasMs: number;
  arrMs: number;
  // …
};
```

---

### 7. Enforce board size in type

- **Improvement**: Encode constraints in the type system.

```ts
export type Board = {
  readonly width: 10;
  readonly height: 20;
  readonly cells: Uint8Array & { readonly length: 200 };
};
```

---

### 8. Use `readonly` for arrays where mutation is not expected

Examples:

- `nextQueue: readonly PieceId[]`
- `completedLines: readonly number[]`
- `lineClearLines: readonly number[]`
- `optimalSequences: readonly FinesseAction[][]`
- Action payloads like `ClearLines`, `StartLineClear`, etc.

---

## 🟢 Style / Cleanliness

### 9. Coordinate branding

- **Improvement**: Brand `x`/`y` as integer grid coordinates.

```ts
type GridCoord = number & { readonly __brand: "GridCoord" };
export type ActivePiece = { id: PieceId; rot: Rot; x: GridCoord; y: GridCoord };
```

---

### 10. Stats: derived vs stored

- **Observation**: Many `Stats` fields are computable (`accuracyPercentage`, `piecesPerMinute`, etc.).
- **Decision**: Either:
  - Store raw counts only and compute derived values on demand, or
  - Keep both but enforce consistency centrally.

---

### 11. Fault representation

- **Issue**: `RecordPieceLock` includes both `isOptimal` and `faults`.
- **Suggestion**: Use one source of truth:
  - `faults.length === 0` ⇒ optimal
  - Or pass the whole `FinesseResult`.

---

### 12. Enums vs. string unions

- Current: `"status" | "LockSource" | "KeyAction" | "Rot"` are unions.
- Suggestion: Keep unions for flexibility, unless you want runtime stability (then `const enum` or string enum).

---

## ✅ Summary of Next Actions

1. Fix `idx` width bug.
2. Resolve garbage value inconsistency (0..7 vs 0..8).
3. Encode `pendingLock` invariant in type.
4. Split `processedInputLog` into a dedicated type.
5. Standardize timestamp usage (consider `Timestamp` vs `DurationMs`).
6. General cleanup: `tickHz`, board constraints, `readonly` usage.
7. Style decisions: grid coordinate branding, stats derivation, `isOptimal` redundancy, unions vs enums.
