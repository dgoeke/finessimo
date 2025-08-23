You are an expert TypeScript developer implementing the **Finessimo** project, a Tetris Finesse Trainer.

Your primary source of truth is the `DESIGN.md` file. Adhere strictly to its specifications, architecture, and type definitions. Build iteratively with thin, testable slices.

### Core Principles

- **Functional Architecture**: Use immutable state and pure reducer functions.
- **Unidirectional Data Flow**: Strictly follow the `UI → Input Handler → Reducer → State → UI` pipeline.
- **Separation of Concerns**: Isolate all stateful, side-effect-driven logic (timers, device I/O) exclusively within the `Input Handler`. The core game logic and reducers must remain pure and deterministic.

### Key Conventions (from DESIGN.md)

- **Directory Structure**:
  `src/
  core/ state/ input/ finesse/ modes/ ui/
tests/
  unit/ integration/ fixtures/`
- **Coordinate System**: 10x20 board, origin `(0,0)` is top-left.
- **Rotation Names**: Use the exact names: `spawn`, `right` (CW), `left` (CCW), `reverse` (180°).

### Iteration 0: End-to-End Skeleton (Complete)

**Goal**: Implement a minimal, end-to-end skeleton that validates the core architecture and data flow.

**Implementation Steps**:

1.  **Scaffold Directories**: Create the directory structure specified above.
2.  **Define State**: In `src/state/types.ts`, define the core interfaces from `DESIGN.md` (`GameState`, `Board`, `ActivePiece`, etc.).
3.  **Implement Reducer**: In `src/state/reducer.ts`, create a pure reducer function. Implement a no-op `default` case and a stub for a `Lock` action that demonstrates a state change.
4.  **Implement Input Handler**: In `src/input/handler.ts`, define the `Input Handler` interface. Create a mock implementation that can dispatch actions to the reducer. Keep it stateful and isolated.
5.  **Implement Core Stubs**: In `src/core/`, create placeholder functions for movement/rotation legality checks.
6.  **Implement Finesse Stub**: In `src/finesse/calculator.ts`, define the `Finesse Calculator` interface and a stub implementation that returns a minimal, empty result.
7.  **Implement UI View**: In `src/ui/`, create a minimal web-based view that subscribes to state changes and renders the current board and active piece. Log all dispatched actions to the console.

**Testing Requirements**:

- Write unit tests for the pure reducer, confirming it produces the expected new state without mutating the original.
- Create snapshot tests for the `GameState` after a `Lock` action.
- Write contract tests to ensure the `Input Handler` dispatches valid `Action` objects and does not directly mutate `GameState`.

**Deliverables for This Run**:

- All source code for the skeleton application.
- All passing tests.
- A `README.md` file that documents:
  - The core architecture and unidirectional data flow.
  - The key conventions (coordinates, rotation names).
  - Instructions on how to build the project and run the tests.

---

### Iteration 1: Core Logic & Input (Current Task)

- **TODO**: Implement the input normalization logic in `src/input/handler.ts`, including the 50ms cancellation window.
- **TODO**: Implement the core movement and rotation logic in `src/core/`, using the SRS kick data from `DESIGN.md`.
- **TODO**: Write comprehensive unit tests for all movement, rotation, and collision functions.

### Iteration 2: Finesse Calculation (Next Steps)

- **TODO**: Implement the BFS minimality algorithm in `src/finesse/calculator.ts`.
- **TODO**: Ensure the algorithm correctly enables/disables 180° rotation paths based on the `allow180Rotation` config flag.
- **TODO**: Create golden test cases with known optimal paths for simple piece placements.

### Iteration 3: Game Modes & UI Feedback (Next Steps)

- **TODO**: Implement the `Guided` and `Free-play` modes.
- **TODO**: Connect the `FinesseResult` to the UI to display feedback after a piece is locked.
