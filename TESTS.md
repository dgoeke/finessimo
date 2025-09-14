# Todo Tests Implementation Plan

This document organizes all the `test.todo` items in the project, grouped by namespace and ordered from most foundational to higher-level components.

## Core Foundation (Types & Utilities)

### `/engine/types` - Runtime type invariants ✅

- [x] `mkInitialState()`: fills preview queue to cfg.previews and seeds rng; physics.lock.deadlineTick is null
- [x] Constants: BOARD_WIDTH=10, VISIBLE_HEIGHT=20, VANISH_ROWS=3, TOTAL_HEIGHT=23
- [x] GridCoord/CellValue/BoardCells behave correctly at runtime: idx()/idxSafe() mapping accounts for vanish rows (y=-3 maps to storage row 0)

### `/engine/utils/fixedpoint` - Q16.16 fixed-point math ✅

- [x] `toQ(n)` encodes n \* 65536; floorQ(toQ(1.75)) === 1
- [x] `addQ` maintains associativity for small integers and preserves fractional parts
- [x] `fracQ(toQ(1.75))` encodes only the fractional remainder; addQ(fracQ(a), fracQ(b)) may carry into an extra cell when crossing 1.0 boundary

### `/engine/utils/tick` - Branded time math ✅

- [x] `incrementTick(t)` returns t+1 as Tick; addTicks(base, delta) adds a TickDelta safely
- [x] `isTickAfterOrEqual(a,b)` and `isTickBefore(a,b)` behave consistently across equal and adjacent ticks
- [x] `framesAt60ToTicks`: with TPS=60, identity mapping; with TPS=120, doubles frames; uses Math.ceil
- [x] `msToTicks` uses Math.ceil and TPS to quantize input streams deterministically

## Core Game Components

### `/engine/core/pieces` - Shape definitions ✅

- [x] Each piece has four rotations (spawn/right/two/left) with exactly 4 cells
- [x] O-piece rotations are identical sets; I/J/L/S/T/Z follow SRS footprint expectations
- [x] spawnTopLeft values position spawn boxes correctly relative to SRS

### `/engine/core/board` - Game board geometry & line clearing ✅

- [x] `idx()`: y=-3 maps to storage row 0; y=0 maps to storage row vanishRows; dimensions totalHeight=23, width=10
- [x] `canPlacePiece()`: false when any cell is out of bounds or collides with non-zero cell; vanish rows count as collidable
- [x] `tryMove()`: moves piece by (dx,dy) only if all target cells are free; otherwise returns original
- [x] `moveToWall()`: slides piece left/right until next move would collide; returns final x
- [x] `isAtBottom()`: true when cannot move down by one; false otherwise
- [x] `dropToBottom()`: returns piece at the lowest legal y
- [x] `lockPiece()`: merges active piece cells into board
- [x] `getCompletedLines()`: returns visible row indices fully filled (0..19), ignores vanish rows
- [x] `clearLines()`: compacts board, removes given rows, preserves vanish rows as-is

### `/engine/core/srs` - Super Rotation System ✅

- [x] Rotating JLSTZ at an open center uses kick index 0 (no kick)
- [x] Rotating against a wall uses one of indices 1..4 (wall kicks); ensure resulting position is placeable
- [x] I-piece uses I-specific kick table (catch cases where JLSTZ table was applied incorrectly)
- [x] When kickOffset is exposed by tryRotateWithKickInfo, classify 'floor' kicks when Y offset is negative (upward)
- [x] Two sequential 90° rotations simulate a 180° turn; no direct opposite-rotation transition is allowed

### `/engine/core/spawning` - Piece creation & top-out detection

- [x] `createActivePiece()`: returns branded ActivePiece at spawn orientation and top-left; coordinates branded as GridCoord
- [x] `isTopOut()`: returns true when spawn piece collides in visible area; returns false when only vanish rows are occupied

### `/engine/core/rng` - Random number generation ✅

#### `/engine/core/rng/seeded` - Seven-bag deterministic RNG ✅

- [x] `createSevenBagRng('seedA')`: first 7 pieces are a permutation of I,O,T,S,Z,J,L (no repeats until bag exhausted)
- [x] Different seeds yield different first-bag permutations more often than not (non-cryptographic)
- [x] `getNextPieces(n)` returns same sequence as n calls to `getNextPiece()`

#### `/engine/core/rng/sequence` - Cycling sequence RNG ✅

- [x] Throws on empty sequence
- [x] Yields the sequence in order, then wraps around
- [x] `getNextPieces(n)` returns n consecutive items with wrap-around at sequence length

#### `/engine/core/rng/one-piece` - Constant piece RNG ✅

- [x] `getNextPiece()` always returns the configured piece and same RNG instance
- [x] `getNextPieces(k)` returns k copies of the configured piece

## Physics & Game Mechanics

### `/engine/physics/gravity` - Fixed-point descent ✅

- [x] With gravity32 = 0.5 (Q16.16), two ticks should move the piece down by one cell (absent collision)
- [x] Accumulation carries over fractional remainder across ticks (fracQ)
- [x] Collision halts descent exactly at floor/stack; no overshoot

### `/engine/physics/lock-delay` - Lock timing mechanics ✅

- [x] Starts lock when grounded; sets deadlineTick = now + cfg.lockDelayTicks; emits LockStarted once per ground-touch
- [x] Extends deadline on eligible move/rotate while grounded until maxLockResets is reached
- [x] Past maxLockResets, further eligible inputs do NOT extend deadline or emit LockReset
- [x] At or after deadlineTick, lockNow=true; next ResolveTransitions should lock piece

## Gameplay Actions

### `/engine/gameplay/movement` - Move/rotate/hold/drop operations ✅

- [x] `tryMoveLeft/Right`: returns moved=true and updates x by ±1 when legal; lockResetEligible computed from pre-move grounded state
- [x] `tryShiftToWall`: moves to the farthest legal x in the requested direction; moved=false when already at wall
- [x] `tryRotateCW/CCW`: returns moved=true when placement succeeds via SRS; exposes kickIndex (and later kickOffset)
- [x] `tryHardDrop`: returns state with piece at bottom and hardDropped=true side-effect; no lock here
- [x] `tryHold`: no-op if hold.usedThisTurn=true; emits swapped=false when moving current piece to empty hold; emits swapped=true when pulling from occupied hold

### `/engine/gameplay/spawn` - Locking & spawning

- [ ] `placeActivePiece()`: merges current piece into the board and returns pieceId; returns null pieceId if no active piece
- [ ] `spawnPiece()`: pulls next from queue (refilling via rng) unless spawnOverride provided; resets physics (gravityAccum32=0, lock.resetCount=0, deadlineTick=null, hold.usedThisTurn=false)
- [ ] `spawnPiece()`: top-out when placement fails; PieceSpawned not emitted; subsequent steps should not try to spawn again unless game resets

## Command System

### `/engine/commands` - Command dispatch coverage

- [ ] Each Command.kind is handled by apply-commands (MoveLeft/Right, ShiftToWall*, Rotate*, SoftDropOn/Off, HardDrop, Hold)
- [ ] ShiftToWall\* is only produced by Control (ARR=0 case) but engine handler still moves piece to wall when possible

## Engine Step Pipeline

### `/engine/step/apply-commands` - Command handling

- [ ] MoveLeft: attempts left shift; on success emits MovedLeft and sets sideEffects.lockResetEligible if previously grounded
- [ ] MoveRight: same as MoveLeft but to the right; lockResetEligible reflects pre-move grounded state
- [ ] RotateCW/RotateCCW: emits Rotated with kick classification; set lockResetEligible when rotation performed while grounded
- [ ] ShiftToWallLeft/Right: piece moves to wall; emits Moved\* once with fromX/toX distance; lockResetEligible if grounded before shift
- [ ] SoftDropOn/Off: emits SoftDropToggled and updates physics.softDropOn; no immediate vertical move here
- [ ] HardDrop: sets sideEffects.hardDropped=true and places piece at bottom in state (actual lock handled by AdvancePhysics/ResolveTransitions)
- [ ] Hold: when hold unused this turn, emits Held; if hold occupied, sets spawnOverride to swap in held piece; if empty, stores current piece and spawns next

### `/engine/step/advance-physics` - Gravity and lock-delay

- [ ] gravityStep: accumulates Q16.16 gravity; floorQ(accum) cells moved, fracQ(accum) stored for next tick
- [ ] gravityStep: with softDropOn=true, use cfg.softDrop32 (or multiplier once implemented); piece descends faster
- [ ] updateLock: when piece grounded and no deadline set, start lock (emit LockStarted) with deadlineTick = now + cfg.lockDelayTicks
- [ ] updateLock: lock resets extend deadline and increment resetCount only while resetCount < maxLockResets
- [ ] updateLock: when tick >= deadlineTick, lockNow=true (unless already hardDropped), emit no reset
- [ ] hardDropped side-effect: forces lockNow=true regardless of deadline state; do not extend deadline on that tick

### `/engine/step/resolve-transitions` - Place/clear/spawn

- [ ] When lockNow=true: placeActivePiece() merges into board, emits Locked before any LinesCleared/PieceSpawned
- [ ] If one or more lines complete: emit LinesCleared with correct row indices and compact the board
- [ ] Spawn path: if spawnOverride is present (from Hold), that pieceId is used; otherwise pop from queue (refilling from rng as needed)
- [ ] Top-out: if new piece cannot be placed (collision even in vanish rows), emit TopOut and do not set an active piece

## Events System

### `/engine/events` - Event payloads & invariants

- [ ] PieceSpawned: includes pieceId and tick; should appear once per spawn
- [ ] MovedLeft/Right: include fromX/toX and tick; toX-fromX === ±1 for single-step moves
- [ ] Rotated: includes dir and kick classification ('none'|'wall'|'floor'); when kickOffset is exposed, ensure 'floor' is emitted on upward offsets
- [ ] SoftDropToggled: on/off flip emits with the correct current tick; affects gravity only, not immediate vertical move
- [ ] LockStarted/LockReset: LockStarted only once per ground-touch; LockReset not emitted past cap; reasons are 'move' or 'rotate'
- [ ] Locked: includes source 'ground'|'hardDrop' and pieceId; occurs before LinesCleared and before next PieceSpawned on the same tick
- [ ] LinesCleared: rows are 0-indexed visible rows; vanish rows (-3..-1) are never included
- [ ] Held: swapped=true when swapping with an existing hold, false when moving current piece into empty hold
- [ ] TopOut: emitted when spawn placement fails due to collision in visible or vanish rows

## Engine Integration

### `/engine/index` - Step pipeline integration

- [ ] `init()`: returns initial state at the given startTick and zero events
- [ ] `step()`: with no commands, first call should spawn a piece (emits DomainEvent: PieceSpawned)
- [ ] `step()`: increments state.tick by +1 on each call
- [ ] `step()`: event order is applyCommands → advancePhysics → resolveTransitions (verify by scenario producing multiple events)
- [ ] `step()`: hard drop emits Locked{source:'hardDrop'} on the same tick, then either LinesCleared and/or PieceSpawned
- [ ] `stepN()`: deterministic sequence for a fixed seed and fixed per-tick command buckets (replay the same inputs twice and compare events)

### `/engine/integration/state-machine` - High-level scenarios

- [ ] Spawn → move → rotate → soft drop → lock by timeout → clear lines → spawn next — events occur in canonical order on specific ticks
- [ ] Hard drop T-spin single: rotation classification should be 'floor' once kickOffset is available; emits Locked{hardDrop} and LinesCleared[<row>]
- [ ] Hold on first active piece: only allowed once per piece; subsequent Hold is ignored until next spawn
- [ ] Top-out path: fill the spawn area, step once, expect TopOut event and no active piece

## Implementation Priority

1. **Start with Core Foundation**: types, utilities (fixedpoint, tick)
2. **Build Core Components**: pieces, board, srs, spawning
3. **Add RNG Systems**: seeded, sequence, one-piece
4. **Implement Physics**: gravity, lock-delay
5. **Add Gameplay Actions**: movement, spawn
6. **Build Command System**: commands
7. **Implement Step Pipeline**: apply-commands, advance-physics, resolve-transitions
8. **Add Events System**: events
9. **Complete Engine Integration**: index, state-machine integration tests

Each namespace should be implemented completely before moving to the next level, as higher-level components depend on the foundational ones being correct.
