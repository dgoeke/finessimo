# Finessimo - Tetris Finesse Trainer

A web-based training application to learn "2-step finesse" - placing any Tetris piece with minimum inputs.

## Architecture Overview

Finessimo follows a **functional architecture** with strict **unidirectional data flow**:

```
UI → Input Handler → Reducer → State → UI
```

### Core Principles

1. **Functional Architecture**: Immutable state and pure reducer functions
2. **Unidirectional Data Flow**: All state changes flow through a central reducer
3. **Separation of Concerns**: Stateful, side-effect logic isolated to the Input Handler
4. **Pure Core Logic**: Game logic remains deterministic and testable

### Data Flow

1. **User Input** → Captured by stateful `Input Handler`
2. **Input Handler** → Dispatches normalized `Action` objects  
3. **Reducer** → Pure function: `(currentState, action) => newState`
4. **State Change** → Triggers UI re-render
5. **UI** → Renders the new immutable state

## Key Conventions

### Coordinate System
- **Board**: 10×20 grid, origin (0,0) at top-left
- **X-axis**: Increases rightward (0-9)
- **Y-axis**: Increases downward (0-19)
- **Active pieces**: May occupy negative Y values while spawning above board

### Rotation Names
- `spawn`: Initial rotation (0°)
- `right`: Clockwise rotation (90°)
- `left`: Counter-clockwise rotation (270°)

## Project Structure

```
src/
  core/           # Pure game logic
    pieces.ts     # Tetromino definitions
    srs.ts        # SRS rotation system
    board.ts      # Board operations
    rng.ts        # 7-bag randomizer
  state/          # State management
    types.ts      # TypeScript interfaces
    reducer.ts    # Pure state transitions
  input/          # Input handling
    handler.ts    # Stateful keyboard/DAS/ARR logic
  finesse/        # Finesse calculation
    calculator.ts # BFS optimal path finder (stub)
  modes/          # Game modes (future)
  ui/             # User interface
    canvas.ts     # Board renderer
    hud.ts        # Debug/info display
  app.ts          # Main application
  main.ts         # Entry point

tests/
  unit/           # Unit tests
  integration/    # Integration tests (future)
  fixtures/       # Test data (future)
```

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Development

```bash
# Start development server with HMR
npm run dev

# Run tests in watch mode
npm test:watch

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix
```

## Current Status: Iteration 3 (Game Modes & Feedback)

This implementation now includes Guided and Free-play modes, finesse analysis wiring, and UI feedback:

### ✅ Completed Features

- Architecture skeleton and unidirectional data flow
- Types & Reducer: pure state transitions and immutability
- Input handling: DOM + mock handlers, DAS/ARR timing, normalization tests
- Core logic: SRS rotation, movement/collision, line clear utils
- Finesse calculator: BFS minimality on empty board
- Finesse service: analyzes from spawn state; applies 50ms cancellation window; mode-aware faults
- Modes: Free-play and Guided with drill prompts and progression
- UI: Canvas board and HUD with feedback and prompts
- Tests: Broad unit coverage plus golden fixtures

### 🎯 Validation Points

- ✅ **Unidirectional Data Flow**: UI → Input → Reducer → State → UI
- ✅ **Pure Functions**: Reducer never mutates input state
- ✅ **Separation of Concerns**: Stateful logic isolated to Input Handler
- ✅ **Contract Compliance**: Input Handler dispatches valid Actions only
- ✅ **Immutable State**: All state changes create new objects

### 🎮 Try It Out

1. Start the dev server: `npm run dev`
2. Open `http://localhost:3000` (auto-opens)
3. Use debug commands in browser console:
   ```javascript
   // Test the reducer
   finessimoApp.simulateInput("lock")
   
   // Inspect current state
   finessimoApp.getState()
   ```
4. Use the test buttons in the UI to trigger actions
5. Watch the action log to see the data flow

## Testing

### Running Tests

```bash
# All tests
npm test

# With coverage
npm test:coverage

# Watch mode
npm test:watch
```

### Test Coverage

- Reducer: immutability, branches, new mode/feedback actions
- Input handler: contracts, DOM mapping, DAS/ARR
- Core: board ops, SRS, RNG
- Finesse: BFS optimality, normalization, golden fixtures, service integration

## Next Iterations

### Iteration 1: Core Logic & Input
- Implement real input normalization with 50ms cancellation window
- Add SRS movement and rotation with wall kicks
- Complete DAS/ARR timing in input handler

### Iteration 2: Finesse Calculation  
- Implement BFS algorithm for optimal path finding
- Create test cases with known optimal solutions

### Iteration 3: Game Modes & Feedback
- Completed basic Guided/Free-play with feedback; next add piece lifecycle (spawn/queue/hold)

## Contributing

This is an AI-assisted implementation following strict architectural principles. All changes should:

1. Maintain functional architecture patterns
2. Preserve unidirectional data flow
3. Keep core logic pure and testable
4. Follow existing TypeScript conventions

## License

MIT
