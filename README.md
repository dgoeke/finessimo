# Finessimo - Finesse Trainer

A web-based training application to learn "2-step finesse" - placing any tetromino piece with minimum inputs.

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

## Architecture

Finessimo follows a functional, unidirectional data flow:

- UI → Input Handler → Reducer → State → UI
- UI (Canvas + HUD) renders the immutable `GameState`.
- Input Handlers are stateful and own all device timing (DAS/ARR, soft-drop repeats). They dispatch pure `Action`s only.
- The reducer is pure/deterministic and creates new state snapshots for every action.
- Core logic (movement, rotation via SRS, collision, line clears, 7‑bag RNG) lives under `src/core`.
- Finesse analysis runs after a piece locks; the service compares the player’s normalized inputs against minimal BFS sequences.

### Mode System (Mode-Agnostic Hooks)

Game modes are self-contained policies exposed via hooks; the engine never branches on a mode name.

- `initialConfig?()` applies timing/gameplay overrides when a mode activates.
- `initModeData?()` initializes `GameState.modeData` (opaque per-mode substate).
- `onBeforeSpawn?(state)` can override the next piece.
- `getGuidance?(state)` emits `ModeGuidance` (target/prompt/visual flags). The app stores this in `state.guidance`, and UI renders it.

Guided mode uses `modeData` to track drill index/attempts; on each lock it returns updated `modeData` and feedback. Free Play supplies no guidance or spawn overrides.

### Input

- Keyboard (DOM): DAS/ARR and soft drop repeats are implemented, with keyup suppression for rotation keys.
- Touch: Quick downward swipe triggers Hard Drop; sustained downward movement engages Soft Drop (released on touch end).

### Settings

- Timing: DAS/ARR, soft-drop speed, lock delay, line clear delay, gravity on/off and speed.
- Gameplay: finesse cancel window (ms).
- Visual: ghost piece toggle, next preview count, UI scale.

Settings are applied by dispatching `UpdateTiming`/`UpdateGameplay` actions. The canvas respects `ghostPieceEnabled`; the preview shows up to `nextPieceCount` items.

### ✅ Completed Features

- Architecture skeleton and unidirectional data flow
- Types & Reducer: pure state transitions and immutability
- Input handling: DOM + mock handlers, DAS/ARR timing, normalization tests
- Core logic: SRS rotation, movement/collision, line clear utils
- Finesse calculator: BFS minimality on empty board
- Finesse service: analyzes from spawn state; applies 50ms cancellation window; mode-aware faults
- Modes: Free-play and Guided with drill prompts, progression, guidance, and spawn policy hooks
- UI: Canvas board and HUD with feedback and prompts
- Tests: Broad unit coverage plus golden fixtures

### 🎮 Try It Out

1. Start the dev server: `npm run dev`
2. Open `http://localhost:3000` (auto-opens)

## Testing

### Running Tests

```bash
npm test
npm run typecheck
npm test:coverage
npm test:watch
```

## Design Reference

See `DESIGN.md` for detailed contracts (types, actions, and mode hooks).

## Contributing

This is an AI-assisted implementation following strict architectural principles. All changes should:

1. Maintain functional architecture patterns
2. Preserve unidirectional data flow
3. Keep core logic pure and testable
4. Follow existing TypeScript conventions

## License

MIT
