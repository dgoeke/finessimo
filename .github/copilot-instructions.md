# Finessimo — GitHub Copilot Developer Instructions

**ALWAYS reference these instructions first and fallback to additional search or context gathering only when the information here is incomplete or found to be in error.**

Finessimo is a TypeScript-based Tetris finesse trainer built with Vite, Lit components, and Jest. It teaches players optimal 2-step piece placement techniques with functional architecture, immutable state, and strong type safety.

## Quick Start

```bash
# Install dependencies (takes ~30 seconds)
npm install

# Start development server (opens http://localhost:3000)
npm run dev

# Run all quality checks before committing
npm run check
```

## Build & Development Commands

**CRITICAL TIMING NOTES**: NEVER CANCEL long-running commands. All timeouts below include safety margins.

### Essential Commands (Validated & Working)

```bash
# Dependencies - NEVER CANCEL: Takes 30 seconds, set timeout: 120+ seconds
npm install

# Development server - Opens http://localhost:3000 automatically
npm run dev

# TypeScript type checking only - Takes 5 seconds, set timeout: 60+ seconds
npm run typecheck

# Lint with auto-fix - Takes 15 seconds, set timeout: 60+ seconds
npm run lint

# Run all tests - NEVER CANCEL: Takes 15 seconds, set timeout: 120+ seconds
npm run test

# Production build - Takes 2 seconds, set timeout: 60+ seconds
npm run build

# Full check pipeline - NEVER CANCEL: Takes 45 seconds, set timeout: 180+ seconds
# Runs: clean → typecheck → lint:fix → test → format
npm run check
```

### Additional Commands

```bash
# Format code
npm run format

# Lint without fixing
npm run lint

# Preview production build
npm run preview
```

## Validation & Testing

### Manual Validation Scenarios

After making changes, ALWAYS test these user scenarios:

1. **Game Startup**:
   - Run `npm run dev`
   - Verify game loads at http://localhost:3000/
   - Check that Tetris board, hold piece, and next pieces display correctly

2. **Basic Gameplay**:
   - Press `Space` (hard drop) to place pieces
   - Verify statistics update (PPM, pieces placed, accuracy)
   - Check that new pieces spawn automatically
   - Confirm piece rotation with arrow keys works

3. **Settings Modal**:
   - Click the settings gear icon
   - Verify modal opens with timing, gameplay, finesse, and controls tabs
   - Test changing keybindings and settings persistence

4. **Finesse Feedback**:
   - Place pieces with different movement patterns
   - Verify finesse feedback appears ("optimal", "miss!", etc.)
   - Check that finesse overlay shows appropriate guidance

### Quality Gate Validation

ALWAYS run this sequence before considering any change complete:

```bash
npm run check
```

This ensures your changes pass:

- TypeScript compilation
- ESLint rules (with auto-fixes applied)
- All 654 unit tests
- Code formatting standards

## Project Structure & Navigation

### Key Documentation Files (READ THESE FIRST)

- `README.md` - Project overview and getting started
- `DESIGN.md` - Architecture deep dive and design principles
- `FILES.md` - Complete file-by-file map of src/ directory
- `AGENTS.md` / `CLAUDE.md` - AI coding assistant guidelines

### Core Architecture (`src/`)

```
src/
├── app.ts                    # Main app orchestrator & game loop
├── main.ts                   # Browser entrypoint
├── state/
│   ├── types.ts             # GameState unions, Action types, brands
│   ├── reducer.ts           # Pure state reducer
│   └── signals.ts           # Reactive state management (Lit signals)
├── core/                    # Game mechanics (board, SRS, RNG)
├── input/                   # Keyboard/touch handlers with DAS/ARR
├── finesse/                 # BFS finesse calculator & analysis
├── modes/                   # Game modes (FreePlay, Guided)
├── ui/                      # Lit components & canvas rendering
├── types/                   # Branded primitives & utilities
└── engine/                  # Physics, scoring, selectors
```

### Build Configuration

- `package.json` - NPM scripts and dependencies
- `vite.config.ts` - Vite build configuration (dev server, bundling)
- `tsconfig.json` - TypeScript compiler settings (strict mode enabled)
- `jest.config.js` - Test configuration with coverage thresholds
- `eslint.config.js` - Comprehensive linting rules

### CI/CD

- `.github/workflows/ci.yml` - Runs `npm run pre-commit` on PRs
- `.github/workflows/deploy_pages.yaml` - Deploys to GitHub Pages

## Development Workflow

1. **Start here**: Read `FILES.md` to understand file locations
2. **Types first**: Use branded primitives and discriminated unions
3. **Pure functions**: Keep side effects at edges (input, DOM, storage)
4. **Immutable updates**: Never mutate state, always return new objects
5. **Quality gates**: Run `npm run pre-commit` before committing
6. **Update docs**: Keep `FILES.md` current when adding/moving files

### Type Safety Rules

- NO TypeScript suppressions (`@ts-ignore`, `@ts-expect-error`)
- NO ESLint disables (`eslint-disable-line`, `eslint-disable-next-line`)
- Fix root causes instead of suppressing errors
- Use `assertNever()` for exhaustive union handling

### Testing Approach

- Unit tests in `tests/unit/` - Test individual functions/modules
- Integration tests in `tests/integration/` - Test app-level scenarios
- Type tests in `tests/types/` - Compile-time type validation
- 654 tests total with high coverage requirements

## Common Tasks & Troubleshooting

### Add New Feature

1. Design types first (in `src/types/` or relevant module)
2. Implement pure logic (reducer, core mechanics)
3. Add UI components (in `src/ui/components/`)
4. Write tests covering new functionality
5. Update `FILES.md` with new files/modules
6. Run `npm run pre-commit`

### Debug Build Issues

```bash
# Clear build artifacts
npm run clean

# Check TypeScript errors
npm run typecheck

# Fix linting issues
npm run lint

# Full rebuild
npm run build
```

### Debug Test Failures

```bash
# Run specific test file
npm test -- tests/unit/your-test.test.ts
```

### Development Server Issues

- Server runs on http://localhost:3000/
- Hot reloading enabled via Vite
- Browser should open automatically
- Check console for Lit dev mode warnings (expected in development)

### Performance Notes

- Build time: ~2 seconds (very fast)
- Test suite: ~15 seconds for 654 tests
- TypeScript compilation: ~5 seconds
- Full pre-commit: ~45 seconds
- Clean npm install: ~30 seconds

## Node.js Requirements

- **Node.js**: 18+ (tested with 20.19.4)
- **npm**: 10+ (tested with 10.8.2)
- Browser: Modern browsers with ES2020 support

## Architecture Principles

### Functional Core

- Immutable state with pure reducers
- Unidirectional data flow: UI → Input → Reducer → State → UI
- Side effects only at edges (input devices, DOM, timing, storage)

### Type-Driven Design

- Branded primitives prevent mixing similar types
- Discriminated unions with exhaustive pattern matching
- Runtime type guards at boundaries, compile-time safety in core

### Deterministic Behavior

- Seeded RNG for reproducible gameplay
- Physics based on timestamps, not frame counts
- Input timing managed by state machines

### Reactive UI

- Lit components with `@lit-labs/signals`
- Single `gameStateSignal` with computed selectors
- Canvas rendering within component boundaries

Remember: ALWAYS follow these instructions first, and use `npm run check` before committing any changes.
