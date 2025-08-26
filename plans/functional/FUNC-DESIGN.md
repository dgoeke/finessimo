# Migration: Align on Functional Style

### Observations

After examining the codebase, I can see clear patterns of inconsistency. The **excellent examples** (`das.ts`, `reducer.ts`) demonstrate pure functional programming with strong typing, immutable patterns, and exhaustive type checking. However, many files show **problematic patterns**: defensive null checks (`if (!ctx) return;`), optional chaining with fallbacks (`gameState.gameplay.ghostPieceEnabled ?? true`), type casting (`as unknown as`), and mutable class state.

The TypeScript configuration is already strict with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, providing a solid foundation. The architecture has clear boundaries between pure core engine and effectful edges (UI/input), which aligns perfectly with the goal.

### Approach

This migration will systematically eliminate defensive programming patterns and replace them with strongly-typed functional constructs. The strategy is to:

1. **Establish type-safe boundaries** - Create branded types and Option/Result patterns to make invalid states unrepresentable
2. **Migrate layer by layer** - Start with core engine (already mostly clean), then state management, input handling, and finally UI
3. **Preserve behavior** - Use the extensive test suite to ensure no regressions during refactoring
4. **Follow the gold standard** - Use `das.ts` and `reducer.ts` as style guides for all new code

The migration will maintain the clean architectural separation while making the type system enforce correctness at compile time rather than relying on runtime checks.

### Reasoning

I explored the codebase structure and identified the architectural patterns. I examined the exemplary files (`das.ts`, `reducer.ts`) that demonstrate the desired functional immutable style, then reviewed problematic files showing inconsistent patterns. I analyzed the TypeScript configuration, dependencies, main application flow, core engine files, and test patterns to understand the complete scope and ensure the migration plan preserves all existing functionality while achieving the style consistency goals.

## Mermaid Diagram

sequenceDiagram
    participant Dev as Developer
    participant Types as src/types/util.ts
    participant Core as Core Modules
    participant State as State Management
    participant Input as Input Handling
    participant UI as UI Components
    participant Tests as Test Suite

    Dev->>Types: 1. Create Option/Result/NonEmptyArray types
    Types-->>Core: Provide functional primitives

    Dev->>Core: 2. Refactor board.ts, srs.ts, rng.ts
    Core->>Core: Replace null checks with Option types
    Core->>Core: Use NonEmptyArray for collections
    Core-->>State: Provide strengthened types

    Dev->>State: 3. Update reducer.ts
    State->>State: Handle new Option/Result types
    State->>State: Maintain pure functional style
    State-->>Input: Provide type-safe interfaces

    Dev->>Input: 4. Refactor input handlers
    Input->>Input: Replace mutable classes with pure functions
    Input->>Input: Use functional state management
    Input-->>UI: Provide clean input events

    Dev->>UI: 5. Separate pure calculations from effects
    UI->>UI: Extract render-calculations.ts
    UI->>UI: Keep only DOM effects in classes
    UI-->>Tests: Maintain existing behavior

    Dev->>Tests: 6. Run test suite after each step
    Tests->>Tests: Verify no behavioral regressions
    Tests-->>Dev: Confirm migration success

## Proposed File Changes

### src/types/util.ts(NEW)

References:

- src/input/machines/das.ts
- src/state/reducer.ts(MODIFY)

Create a new utility types module to establish functional programming primitives that will replace null/undefined patterns throughout the codebase.

Define `Option<T>` type as a discriminated union with `Some<T>` and `None` variants, providing type-safe alternatives to nullable values. Include helper functions like `some()`, `none()`, `isSome()`, `isNone()`, `map()`, `flatMap()`, and `getOrElse()` for functional composition.

Define `Result<T, E>` type for error handling with `Ok<T>` and `Err<E>` variants, replacing try-catch patterns with explicit error types. Include helper functions like `ok()`, `err()`, `isOk()`, `isErr()`, `map()`, `mapErr()`, and `match()`.

Create `NonEmptyArray<T>` branded type to eliminate array bounds checking in core algorithms. Include constructor function `fromArray()` that returns `Option<NonEmptyArray<T>>` and utility functions like `head()`, `tail()`, `length()`.

Define `Branded<T, Brand>` utility type for creating domain-specific types like `PositiveNumber`, `ValidPieceId`, etc. that prevent invalid values at the type level.

All functions should be pure with no side effects, following the patterns established in `src/input/machines/das.ts`.

### src/core/board.ts(MODIFY)

References:

- src/types/util.ts(NEW)
- src/state/types.ts

Refactor to eliminate defensive null checks and strengthen type safety using the new utility types from `src/types/util.ts`.

Replace the `getPieceValue()` function's Record lookup with a branded type approach. Create a `CellValue` branded type that ensures only valid piece values (1-7) can be stored in board cells.

Modify `lockPiece()` to use the new `CellValue` type and eliminate the bounds checking in the loop by using a validated coordinate type. The function should assume all inputs are valid since validation happens at the boundaries.

Update `getCompletedLines()` to return `Option<NonEmptyArray<number>>` instead of potentially empty arrays, making the "no completed lines" case explicit in the type system.

Refactor `clearLines()` to accept `NonEmptyArray<number>` as input, eliminating the early return check. The function signature should make it impossible to call with empty arrays.

Update `tryMove()` to return `Option<ActivePiece>` instead of `ActivePiece | null`, providing a more functional interface that composes better with other operations.

All functions should maintain their pure, immutable nature while leveraging stronger types to eliminate runtime checks.

### src/core/srs.ts(MODIFY)

References:

- src/types/util.ts(NEW)
- src/state/types.ts

Strengthen type safety and eliminate defensive patterns using functional programming constructs from `src/types/util.ts`.

Replace the `getKickTable()` function's string-based lookup with a more type-safe approach using discriminated unions. Create specific types for `IPieceKicks` and `StandardPieceKicks` that make the kick table selection explicit.

Modify `tryRotate()` to return `Option<ActivePiece>` instead of `ActivePiece | null`, following the functional pattern established in the utility types.

Update `canRotate()` to use the same type-safe kick table lookup, eliminating the `if (!kicks)` check by making invalid kick combinations unrepresentable at the type level.

Refactor the kick key generation to use a more type-safe approach with template literal types or discriminated unions instead of string concatenation.

Ensure all rotation state transitions are validated at compile time using the existing `Rot` type, making invalid rotations impossible to represent.

Maintain the pure functional nature of all operations while leveraging the type system to prevent invalid states.

### src/core/rng.ts(MODIFY)

References:

- src/types/util.ts(NEW)

Eliminate the defensive error throwing and strengthen type safety using functional programming patterns from `src/types/util.ts`.

Replace the `throw new Error("Bag is empty or corrupted")` in `getNextPiece()` with a type-safe approach. Modify the function to return `Result<{piece: PieceId, newRng: SevenBagRng}, RngError>` where `RngError` is a specific error type.

Update the bag management logic to use `NonEmptyArray<PieceId>` for the shuffled bag, making it impossible to have an empty bag at the type level.

Modify `getNextPieces()` to handle the new Result type from `getNextPiece()`, using functional composition to accumulate pieces or propagate errors.

Strengthen the `shuffle()` function to guarantee it returns a non-empty array when given a non-empty input, using the `NonEmptyArray` type.

Ensure all array access operations are safe by construction rather than defensive checks, leveraging the type system to prevent out-of-bounds access.

Maintain the deterministic, pure nature of the RNG while making error states explicit in the type system.

### src/core/spawning.ts(MODIFY)

References:

- src/types/util.ts(NEW)
- src/core/board.ts(MODIFY)
- src/state/types.ts

Examine and refactor this core file to follow the same functional immutable patterns as the other core modules.

Replace any null/undefined checks with Option types from `src/types/util.ts`. If the file contains functions that return nullable values, update them to return `Option<T>` instead.

Ensure all piece spawning logic uses strongly typed coordinates and piece positions, eliminating any defensive bounds checking by making invalid positions unrepresentable.

If there are any mutable operations or side effects, refactor them to pure functions that return new state objects.

Update function signatures to use branded types for coordinates and piece IDs where appropriate, following the patterns established in the other core modules.

Maintain the existing behavior while strengthening the type safety and eliminating runtime checks.

### src/state/reducer.ts(MODIFY)

References:

- src/types/util.ts(NEW)
- src/core/board.ts(MODIFY)
- src/core/rng.ts(MODIFY)
- src/core/srs.ts(MODIFY)

Update the reducer to work with the new functional types from the core modules while maintaining its excellent functional immutable style.

Modify action handlers that interact with board operations to handle the new `Option` and `Result` types from the updated core functions. For example, update handlers that call `tryMove()` to work with `Option<ActivePiece>` instead of `ActivePiece | null`.

Update the `getNextPieceFromQueue()` helper to return `Option<{newActive: ActivePiece, newPiece: PieceId, newRng: SevenBagRng}>` instead of nullable values, making the "no pieces available" case explicit.

Modify line clearing logic to work with the updated `getCompletedLines()` function that returns `Option<NonEmptyArray<number>>`.

Ensure all error handling uses the new `Result` types where appropriate, particularly for operations that can fail.

Maintain the existing exhaustive action handling pattern and pure functional style while integrating with the strengthened core module types.

Update any remaining defensive null checks to use the functional patterns, ensuring the reducer remains a pure function with no side effects.

### src/input/handler.ts(MODIFY)

References:

- src/input/machines/das.ts
- src/types/util.ts(NEW)
- src/state/types.ts

Refactor the input handling to follow functional immutable patterns similar to `src/input/machines/das.ts`.

Replace the `MockInputHandler` class with a functional approach. Create pure functions for input processing that take immutable state and return new state, eliminating the mutable `currentState` field.

Update the `InputHandler` interface to use functional patterns. Replace methods that mutate internal state with pure functions that accept and return immutable state objects.

Modify `normalizeInputSequence()` to use `NonEmptyArray` types where appropriate and eliminate defensive null checks in the helper functions by using Option types.

Replace the array iteration patterns in `findCancellationPairs()` and `buildResultArray()` with functional approaches that don't require null checks on array elements.

Update `InputHandlerState` to use branded types for timing values and directions, making invalid states unrepresentable.

Ensure all functions are pure with no side effects, following the patterns established in the DAS state machine implementation.

### src/input/keyboard.ts(MODIFY)

References:

- src/input/machines/das.ts
- src/types/util.ts(NEW)
- src/input/handler.ts(MODIFY)

Examine and refactor the keyboard input handler to eliminate mutable state and defensive programming patterns.

Replace any class-based mutable state with functional approaches that pass immutable state through function calls.

Update key binding management to use immutable data structures and pure functions for key mapping operations.

Eliminate any null/undefined checks by using Option types from `src/types/util.ts` for optional key bindings or event data.

Ensure all DOM event handling is isolated to the edges while keeping the core input processing logic pure and functional.

Update the integration with the DAS state machine to maintain the clean functional interface established in `src/input/machines/das.ts`.

Maintain the existing behavior while strengthening type safety and eliminating runtime defensive checks.

### src/input/touch.ts(MODIFY)

References:

- src/input/keyboard.ts(MODIFY)
- src/input/machines/das.ts
- src/types/util.ts(NEW)

Refactor the touch input handler to follow the same functional immutable patterns as the keyboard handler.

Replace any mutable class state with functional approaches that use immutable state objects passed through function calls.

Eliminate defensive null/undefined checks by using Option types for touch event data and coordinates.

Update touch gesture recognition to use pure functions that take touch state and return new state objects.

Ensure DOM touch event handling remains at the edges while keeping gesture processing logic pure and functional.

Maintain integration with the shared DAS state machine while following the functional patterns established in other input modules.

Strengthen type safety for touch coordinates and gesture states using branded types where appropriate.

### src/finesse/calculator.ts(MODIFY)

References:

- src/types/util.ts(NEW)
- src/state/types.ts

Strengthen type safety and eliminate defensive patterns while maintaining the BFS algorithm's correctness.

Replace the `if (!shifted) break;` check in `performBfsSearch()` with a type-safe queue implementation using `NonEmptyArray` or Option types that make empty queue states explicit.

Update `calculateOptimal()` to return `Option<NonEmptyArray<Array<FinesseAction>>>` instead of potentially empty arrays, making the "no solution found" case explicit in the type system.

Modify the BFS queue operations to use functional data structures that guarantee type safety without runtime checks.

Update `analyze()` to handle the new Option types from `calculateOptimal()` using functional composition rather than defensive checks.

Replace the array reduce operation with explicit handling of empty arrays using the NonEmptyArray type, eliminating the `Number.POSITIVE_INFINITY` fallback.

Ensure all finesse action conversions use exhaustive pattern matching rather than undefined returns, making invalid action types unrepresentable.

Maintain the pure functional nature of the BFS algorithm while leveraging stronger types to eliminate runtime checks.

### src/finesse/service.ts(MODIFY)

References:

- src/finesse/calculator.ts(MODIFY)
- src/types/util.ts(NEW)
- src/state/types.ts

Examine and refactor the finesse service to follow functional immutable patterns and eliminate any defensive programming.

Replace any mutable state or class-based patterns with pure functions that take immutable inputs and return new state objects.

Update integration with the finesse calculator to handle the new Option and Result types, using functional composition rather than null checks.

Ensure all piece analysis operations use the strengthened types from the calculator and core modules.

Eliminate any defensive null/undefined checks by using Option types for optional finesse data.

Maintain the existing service interface while strengthening type safety and following the functional patterns established in other modules.

### src/ui/canvas.ts(MODIFY)

References:

- src/state/types.ts
- src/types/util.ts(NEW)

Refactor to separate pure rendering calculations from effectful DOM operations, following the "effects at the edges" principle.

Extract all pure calculations (color mapping, coordinate transformations, visibility checks) into a separate pure module `src/ui/render-calculations.ts`. These functions should take game state and return rendering data structures with no DOM dependencies.

Update the `BasicCanvasRenderer` class to use the pure calculation functions, keeping only the effectful `ctx.fillRect()` and DOM manipulation in the class methods.

Replace defensive checks like `if (!this.ctx) return;` with proper initialization validation at the class boundary. Use Option types to represent the initialized/uninitialized state explicitly.

Eliminate null coalescing patterns like `gameState.gameplay.ghostPieceEnabled ?? true` by ensuring the game state types guarantee these values are always present.

Update color lookup to use a type-safe mapping that makes invalid cell values unrepresentable, eliminating the `?? "#ffffff"` fallback.

Maintain the existing rendering behavior while clearly separating pure calculations from DOM effects.

### src/ui/render-calculations.ts(NEW)

References:

- src/ui/canvas.ts(MODIFY)
- src/types/util.ts(NEW)
- src/state/types.ts

Create a pure module containing all rendering calculations extracted from `src/ui/canvas.ts` and other UI components.

Define types for rendering data structures like `RenderCell`, `RenderPiece`, `RenderBoard` that represent the pure data needed for drawing without any DOM dependencies.

Implement pure functions for:
- `calculateBoardCells()` - converts board state to renderable cell data
- `calculatePieceCells()` - converts active piece to renderable cell positions
- `calculateGhostPiece()` - determines ghost piece rendering data
- `calculateGridLines()` - computes grid line positions
- `mapCellToColor()` - type-safe color mapping using branded cell value types

All functions should be pure with no side effects, taking immutable game state as input and returning immutable rendering data structures.

Use the utility types from `src/types/util.ts` to eliminate any null/undefined handling, making invalid rendering states unrepresentable.

Ensure all coordinate calculations use branded types for type safety and eliminate bounds checking through proper type design.

### src/ui/finesse-feedback.ts(MODIFY)

References:

- src/ui/render-calculations.ts(NEW)
- src/finesse/service.ts(MODIFY)
- src/types/util.ts(NEW)

Examine and refactor the finesse feedback UI component to follow functional patterns and eliminate defensive programming.

Extract pure finesse visualization calculations into the `src/ui/render-calculations.ts` module, separating data processing from DOM manipulation.

Replace any mutable class state with functional approaches that compute rendering data from immutable game state.

Eliminate null/undefined checks by using Option types for optional finesse feedback data.

Update integration with the finesse service to handle the new functional types, using composition rather than defensive checks.

Ensure all finesse visualization logic is pure and testable, keeping only DOM manipulation in the UI class.

Maintain the existing feedback display behavior while strengthening type safety.

### src/ui/settings.ts(MODIFY)

References:

- src/types/util.ts(NEW)
- src/state/types.ts

Refactor the settings UI to eliminate defensive programming and strengthen type safety.

Replace any mutable state management with functional approaches that compute settings data from immutable configuration objects.

Eliminate null/undefined checks for DOM elements by using proper initialization validation and Option types.

Update settings validation to use branded types for numeric ranges (e.g., `DASMilliseconds`, `ARRMilliseconds`) that prevent invalid values at the type level.

Ensure all settings transformations are pure functions that take current settings and return new settings objects.

Maintain the existing settings persistence and UI behavior while following functional patterns.

Use exhaustive pattern matching for settings categories rather than string-based lookups.

### src/ui/statistics.ts(MODIFY)

References:

- src/ui/render-calculations.ts(NEW)
- src/types/util.ts(NEW)
- src/state/types.ts

Refactor the statistics UI component to follow functional patterns and eliminate defensive programming.

Extract pure statistics calculations into the `src/ui/render-calculations.ts` module, separating data processing from DOM rendering.

Replace any mutable state with functional approaches that compute display data from immutable game statistics.

Eliminate null/undefined checks by using Option types for optional statistics data and proper initialization validation.

Update statistics formatting and calculation to use pure functions that take game state and return formatted display data.

Ensure all rate calculations and percentage computations are pure and handle edge cases (like division by zero) through type design rather than runtime checks.

Maintain the existing statistics display behavior while strengthening type safety.

### src/ui/preview.ts(MODIFY)

References:

- src/ui/render-calculations.ts(NEW)
- src/types/util.ts(NEW)
- src/state/types.ts

Examine and refactor the preview UI component to follow functional patterns.

Extract pure preview piece calculations into the `src/ui/render-calculations.ts` module.

Replace any mutable state with functional approaches that compute preview data from the immutable next queue.

Eliminate defensive checks by using NonEmptyArray types for the piece queue and Option types for optional preview data.

Ensure all preview rendering logic is pure and separated from DOM manipulation.

Maintain the existing preview display behavior while strengthening type safety.

### src/ui/hold.ts(MODIFY)

References:

- src/ui/render-calculations.ts(NEW)
- src/types/util.ts(NEW)
- src/state/types.ts

Examine and refactor the hold UI component to follow functional patterns.

Extract pure hold piece calculations into the `src/ui/render-calculations.ts` module.

Replace any mutable state with functional approaches that compute hold display data from immutable game state.

Eliminate defensive checks by using Option types for the optional hold piece.

Ensure all hold rendering logic is pure and separated from DOM manipulation.

Maintain the existing hold display behavior while strengthening type safety.

### src/ui/finesse.ts(MODIFY)

References:

- src/ui/render-calculations.ts(NEW)
- src/types/util.ts(NEW)
- src/state/types.ts

Examine and refactor this finesse UI component to follow functional patterns and eliminate any defensive programming.

Extract pure finesse visualization calculations into the `src/ui/render-calculations.ts` module.

Replace any mutable state with functional approaches that compute finesse display data from immutable game state.

Eliminate null/undefined checks by using Option types for optional finesse data.

Ensure all finesse rendering logic is pure and separated from DOM manipulation.

Maintain the existing finesse display behavior while strengthening type safety.

### src/modes/freePlay.ts(MODIFY)

References:

- src/state/reducer.ts(MODIFY)
- src/types/util.ts(NEW)
- src/state/types.ts

Examine and refactor the free play game mode to follow functional immutable patterns.

Replace any mutable state or class-based patterns with pure functions that take immutable game state and return mode-specific data.

Eliminate any defensive null/undefined checks by using Option types for optional mode data.

Ensure all mode logic is pure and follows the patterns established in the core modules.

Update integration with the game state to use the strengthened types from the reducer and core modules.

Maintain the existing free play behavior while following functional patterns.

### src/modes/guided.ts(MODIFY)

References:

- src/modes/freePlay.ts(MODIFY)
- src/finesse/calculator.ts(MODIFY)
- src/types/util.ts(NEW)

Examine and refactor the guided game mode to follow functional immutable patterns.

Replace any mutable state or class-based patterns with pure functions that take immutable game state and return guidance data.

Eliminate any defensive null/undefined checks by using Option types for optional guidance data.

Ensure all guidance logic is pure and follows the patterns established in the core modules.

Update integration with the finesse system to use the strengthened types from the finesse calculator.

Maintain the existing guided mode behavior while following functional patterns.

### src/modes/index.ts(MODIFY)

References:

- src/modes/freePlay.ts(MODIFY)
- src/modes/guided.ts(MODIFY)
- src/types/util.ts(NEW)

Examine and refactor the game mode registry to follow functional patterns.

Replace any mutable registry state with functional approaches that use immutable mode definitions.

Eliminate defensive checks by using proper type definitions for mode registration and lookup.

Ensure all mode management operations are pure and type-safe.

Update integration with the refactored mode implementations to maintain consistency.

Maintain the existing mode registry behavior while strengthening type safety.

### src/app.ts(MODIFY)

References:

- src/input/handler.ts(MODIFY)
- src/ui/canvas.ts(MODIFY)
- src/state/reducer.ts(MODIFY)
- src/types/util.ts(NEW)

Update the main application class to work with the refactored functional modules while maintaining its role as the effectful boundary.

Update integration with the refactored input handlers, ensuring proper handling of the new functional interfaces.

Modify renderer initialization to work with the separated pure calculation modules and effectful rendering classes.

Update game state management to handle the new Option and Result types from the core modules, using functional composition rather than defensive checks.

Ensure the application class remains the primary location for side effects (DOM manipulation, timing, etc.) while delegating pure calculations to the functional modules.

Maintain the existing application behavior and game loop while integrating with the strengthened type system.

Update error handling to use the new Result types where appropriate, particularly for initialization and configuration operations.

### src/main.ts(MODIFY)

References:

- src/app.ts(MODIFY)
- src/types/util.ts(NEW)

Update the main entry point to handle the new functional interfaces from the application class.

Replace defensive DOM element checks with proper initialization validation using Option types.

Update error handling to use the new Result types for application initialization.

Ensure the main function remains the primary entry point for side effects while delegating pure logic to the application class.

Maintain the existing application startup behavior while integrating with the strengthened type system.

### .eslintrc-functional.js(NEW)

References:

- eslint.config.js(MODIFY)

Create a specialized ESLint configuration to enforce the functional immutable coding style throughout the codebase.

Configure rules to forbid:
- `as unknown as` type casting in core/ and state/ directories
- Naked `!` non-null assertions
- Direct null/undefined checks like `if (x == null)` in favor of Option types
- Mutable array methods like `push()`, `pop()`, `splice()` in core modules
- Class-based state management in core/ and state/ directories

Enable rules to enforce:
- Exhaustive switch statements for discriminated unions
- Immutable array operations using spread syntax
- Functional composition patterns
- Proper use of readonly modifiers

Configure different rule sets for different directories:
- Strictest rules for src/core/ and src/state/
- Moderate rules for src/input/ and src/finesse/
- Relaxed rules for src/ui/ (allowing necessary DOM side effects)

Integrate with the existing ESLint configuration to maintain current code quality standards while adding functional programming enforcement.

### eslint.config.js(MODIFY)

References:

- .eslintrc-functional.js(NEW)

Update the main ESLint configuration to include the new functional programming rules from `.eslintrc-functional.js`.

Add directory-specific overrides that apply the functional rules to core/, state/, input/, and finesse/ directories while allowing necessary side effects in ui/ and main application files.

Ensure the functional rules are integrated with the existing TypeScript and import rules.

Maintain all existing linting standards while adding the new functional programming enforcement.

Configure the rules to work with the new utility types and functional patterns being introduced.
