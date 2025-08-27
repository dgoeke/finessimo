# Design: Migrate UI to Lit

### Observations

I've analyzed the current Finessimo codebase - a Tetris finesse trainer with a clean separation between game logic and UI. The current architecture uses imperative DOM manipulation through individual renderer classes (BasicCanvasRenderer, BasicSettingsRenderer, etc.) managed by a central FinessimoApp class. The UI components handle canvas rendering, finesse feedback with animations, statistics display, settings modal with key binding, and piece preview/hold displays. The game runs at 60fps with a target of 120fps for UI updates. The current bundle is minimal with only robot3 and tinykeys dependencies.

### Approach

The refactoring will replace imperative DOM renderers with Lit web components while preserving the exact visual appearance and game engine separation. We'll use Lit 3.x with signals for reactive state management and JSX syntax for component authoring. Each current renderer becomes a Lit component that wraps existing logic where beneficial (like canvas operations). The FinessimoApp will manage a global game state signal, and components will reactively update only when their relevant state changes. This maintains the 120fps UI target while providing better maintainability and cleaner separation of concerns.

### Reasoning

I explored the codebase structure starting with package.json and main entry points, then examined the current UI architecture including all renderer classes (canvas, settings, finesse-feedback, hold, preview, statistics). I analyzed the complex settings component with its key binding functionality, the finesse feedback system with animations, and the input handling system. I also reviewed the build configuration and CSS styling approach to understand the current toolchain and responsive design patterns.

## Mermaid Diagram

sequenceDiagram
    participant App as FinessimoApp
    participant Signal as gameStateSignal
    participant Shell as finessimo-shell
    participant Board as game-board
    participant Stats as stats-panel
    participant Settings as settings-modal

    App->>Signal: dispatch(action)
    Signal->>Signal: reducer(state, action)
    Signal-->>Shell: state change notification
    Shell-->>Board: reactive update
    Shell-->>Stats: reactive update

    Settings->>Settings: user interaction
    Settings->>App: custom event (settings-change)
    App->>Signal: dispatch(UpdateSettings)

    App->>App: game loop (60fps)
    App->>Signal: dispatch(Tick)
    Signal-->>Board: canvas render (120fps max)

    Note over Signal,Board: Only changed components re-render
    Note over App,Settings: UI events bubble up, state flows down

## Proposed File Changes

### package.json(MODIFY)

Add Lit framework dependencies to enable modern web component development:
- Add `lit@^3.0.0` for the core web components framework
- Add `@lit-labs/signals@^1.0.0` for reactive state management
- Add `@chnicoloso/lit-jsx@^1.0.0` for JSX syntax support in Lit components
- Add `vite-plugin-lit-jsx@^1.0.0` as dev dependency for Vite JSX processing

These additions will enable the transition from imperative DOM manipulation to declarative Lit components while maintaining the small bundle size requirement.

### vite.config.ts(MODIFY)

Update Vite configuration to support Lit JSX components:
- Import and configure the `vite-plugin-lit-jsx` plugin
- Add JSX file extensions (`.jsx`, `.tsx`) to the resolve.extensions array
- Ensure proper handling of Lit web components during build process
- Maintain existing build targets and sourcemap configuration

This enables Vite to properly process JSX syntax in Lit components while preserving the current build pipeline.

### tsconfig.json(MODIFY)

Configure TypeScript for JSX and Lit development:
- Add `"jsx": "react-jsx"` to enable JSX syntax processing
- Add `"jsxImportSource": "@chnicoloso/lit-jsx"` to use Lit JSX transformer
- Add `"experimentalDecorators": true` to support Lit decorators
- Include `.tsx` and `.jsx` file extensions in the include patterns
- Ensure DOM types are available for web component development

These changes enable TypeScript to properly type-check and compile Lit components written in JSX syntax.

### src/state/signals.ts(NEW)

References:

- src/state/reducer.ts
- src/state/types.ts

Create a global reactive state management system using Lit signals:
- Export a `gameStateSignal` using `signal<GameState>()` from `@lit-labs/signals`
- Create a `dispatch` function that wraps the existing `reducer` from `src/state/reducer.ts`
- The dispatch function should update the signal value: `gameStateSignal.value = reducer(gameStateSignal.value, action)`
- Export helper functions for components to subscribe to specific state slices
- Maintain immutability by ensuring the reducer pattern is preserved
- Add TypeScript types for signal-based state management

This provides a reactive foundation that Lit components can subscribe to for efficient re-rendering only when relevant state changes.

### src/ui/components(NEW)

Create a directory to house all Lit web components that will replace the current renderer classes. This directory will contain the new component architecture organized by functionality.

### src/ui/components/game-board.tsx(NEW)

References:

- src/ui/canvas.ts
- src/state/signals.ts(NEW)

Create a Lit component that wraps the existing canvas rendering logic:
- Extend `LitElement` and use `@customElement('game-board')` decorator
- Subscribe to `gameStateSignal` from `src/state/signals.ts` for reactive updates
- In `firstUpdated()`, create and initialize a `BasicCanvasRenderer` instance from `src/ui/canvas.ts`
- Create a canvas element in the shadow DOM and pass it to the renderer
- In `updated()`, call `renderer.render(gameState)` only when game state changes
- Implement `disconnectedCallback()` to call `renderer.destroy()`
- Use JSX syntax for the template with a single canvas element
- Apply existing canvas styles using CSS custom properties

This component maintains the existing canvas rendering performance while providing reactive updates through Lit's efficient change detection.

### src/ui/components/finesse-overlay.tsx(NEW)

References:

- src/ui/finesse-feedback.ts
- src/state/signals.ts(NEW)

Create a Lit component for finesse feedback display:
- Extend `LitElement` with `@customElement('finesse-overlay')` decorator
- Subscribe to finesse-related state from `gameStateSignal` (finesseFeedback, guidance, modePrompt)
- Implement the animation logic from `src/ui/finesse-feedback.ts` using Lit's lifecycle methods
- Use JSX to render the mode prompt and finesse feedback elements
- Implement the icon mapping and transition animations using CSS classes and Lit's `updated()` lifecycle
- Handle the transition end events for proper visibility management
- Maintain the existing accessibility features (aria-label, screen reader support)
- Use CSS-in-JS or adoptedStyleSheets for component-scoped styling

This component provides reactive finesse feedback with minimal re-renders, updating only when finesse state changes.

### src/ui/components/piece-hold.tsx(NEW)

References:

- src/ui/hold.ts
- src/state/signals.ts(NEW)

Create a Lit component for the hold piece display:
- Extend `LitElement` with `@customElement('piece-hold')` decorator
- Subscribe to hold-related state from `gameStateSignal` (hold piece, canHold flag)
- Wrap the existing `BasicHoldRenderer` from `src/ui/hold.ts` for canvas operations
- Use JSX to render the hold section structure with title and canvas container
- Initialize the hold renderer in `firstUpdated()` and update in `updated()` lifecycle
- Implement the disabled state visualization (diagonal slash) when hold is not available
- Maintain the existing piece centering and rendering logic
- Apply component-scoped styles for the hold section layout

This component efficiently updates only when the hold piece or hold availability changes.

### src/ui/components/piece-preview.tsx(NEW)

References:

- src/ui/preview.ts
- src/state/signals.ts(NEW)

Create a Lit component for the next pieces preview:
- Extend `LitElement` with `@customElement('piece-preview')` decorator
- Subscribe to preview-related state from `gameStateSignal` (nextQueue, gameplay.nextPieceCount)
- Wrap the existing `BasicPreviewRenderer` from `src/ui/preview.ts` for canvas operations
- Use JSX to render the preview container with title and multiple preview slots
- Initialize the preview renderer in `firstUpdated()` and update when queue changes
- Implement dynamic preview count based on gameplay configuration
- Maintain the existing piece centering and multi-canvas rendering logic
- Apply responsive styling for the preview column layout

This component updates efficiently when the next piece queue changes, avoiding unnecessary re-renders.

### src/ui/components/stats-panel.tsx(NEW)

References:

- src/ui/statistics.ts
- src/state/signals.ts(NEW)

Create a Lit component for the statistics display:
- Extend `LitElement` with `@customElement('stats-panel')` decorator
- Subscribe to statistics state from `gameStateSignal.stats`
- Convert the imperative DOM updates from `src/ui/statistics.ts` to reactive JSX rendering
- Use JSX to render all stat sections (performance, accuracy, session, placement, line clears, faults)
- Implement the formatting helper functions (formatDuration, formatPercentage, etc.) as class methods
- Apply conditional CSS classes for accuracy ratings (excellent, good, average, poor)
- Render fault breakdown dynamically based on faultsByType data
- Maintain the existing panel styling and responsive layout

This component provides efficient statistics updates, re-rendering only when stats change.

### src/ui/components/settings-modal.tsx(NEW)

References:

- src/ui/settings.ts
- src/input/keyboard.ts
- src/state/signals.ts(NEW)

Create a comprehensive Lit component for the settings modal:
- Extend `LitElement` with `@customElement('settings-modal')` decorator
- Port the complex settings logic from `src/ui/settings.ts` to reactive JSX
- Implement tab switching, form controls, and key binding capture using Lit event handling
- Use `@state()` decorator for internal component state (current tab, rebinding mode)
- Emit custom events for settings changes that the app can listen to
- Implement the key binding capture functionality using global event listeners
- Convert all the HTML template strings to JSX with proper event handlers
- Maintain localStorage integration for settings persistence
- Apply modal overlay styling and responsive behavior
- Handle the complex form validation and settings coercion logic

This component encapsulates all settings functionality while providing a clean event-based interface to the app.

### src/ui/components/finessimo-shell.tsx(NEW)

References:

- src/ui/styles.css(MODIFY)

Create the main application shell component that orchestrates all other components:
- Extend `LitElement` with `@customElement('finessimo-shell')` decorator
- Provide the signals context to child components
- Use JSX to render the three-column layout structure from `index.html`
- Include all child components: `<game-board>`, `<finesse-overlay>`, `<piece-hold>`, `<piece-preview>`, `<stats-panel>`
- Handle the settings modal visibility and event delegation
- Implement responsive layout switching between desktop and mobile views
- Apply the existing CSS grid layout and responsive design patterns
- Manage global event listeners for settings and input handling
- Provide a clean interface for the `FinessimoApp` to interact with the UI

This component serves as the root of the Lit component tree and manages the overall application layout.

### index.html(MODIFY)

References:

- src/ui/components/finessimo-shell.tsx(NEW)

Simplify the HTML structure to use the new Lit component architecture:
- Replace the entire `<main class="app shell">` section with a single `<finessimo-shell></finessimo-shell>` element
- Keep the existing `<header>` structure unchanged to maintain the brand and navigation
- Maintain all existing meta tags, font imports, and CSS links
- Ensure the script tag for `src/main.ts` remains to bootstrap the application
- Remove the individual container divs (hold-container, game-canvas, etc.) as these will be managed by Lit components

This creates a clean separation where the header remains static HTML and the entire game interface is managed by Lit components.

### src/app.ts(MODIFY)

References:

- src/state/signals.ts(NEW)
- src/ui/components/finessimo-shell.tsx(NEW)

Refactor FinessimoApp to work with Lit components and signals:
- Remove all renderer class instances (canvasRenderer, finesseRenderer, etc.) as these are now managed by Lit components
- Replace the `gameState` field with integration to the `gameStateSignal` from `src/state/signals.ts`
- Modify the `dispatch` method to use the signal-based dispatch function
- Update `initialize()` to find and configure the `<finessimo-shell>` element instead of individual containers
- Remove direct DOM element queries and renderer initialization
- Keep the input handlers (KeyboardInputHandler, TouchInputHandler) as they interface with the game engine
- Maintain the game loop and update logic, but use signal dispatch instead of direct state mutation
- Add event listeners for settings changes from the settings modal component
- Preserve all existing public methods for testing and debugging

This transforms FinessimoApp into a lightweight coordinator between the game engine and the Lit UI components.

### src/main.ts(MODIFY)

References:

- src/app.ts(MODIFY)
- src/state/signals.ts(NEW)
- src/ui/components/finessimo-shell.tsx(NEW)

Update the main entry point to register Lit components and initialize the signal-based architecture:
- Import and register all custom elements before creating the FinessimoApp
- Initialize the `gameStateSignal` from `src/state/signals.ts` with the initial state
- Modify the `initializeApp` function to work with the `<finessimo-shell>` element instead of individual canvas and panel elements
- Ensure proper error handling for missing custom elements
- Maintain the existing DOM ready detection and app lifecycle management
- Add any necessary polyfills for web components if targeting older browsers

This ensures all Lit components are properly registered before the application starts and the signal system is initialized.

### src/ui/styles.css(MODIFY)

References:

- src/ui/components/finessimo-shell.tsx(NEW)

Update CSS to work with Lit component shadow DOM and maintain visual consistency:
- Add `:host` selectors for Lit components to ensure proper styling encapsulation
- Ensure CSS custom properties (--bg, --primary, etc.) are properly inherited in shadow DOM
- Add any necessary `::part()` selectors for styling component internals from the global scope
- Maintain all existing responsive design patterns and media queries
- Ensure the three-column grid layout works with the new `<finessimo-shell>` component
- Add any component-specific styles that need global scope (like modal overlays)
- Preserve all existing visual design tokens and color schemes

This ensures the visual appearance remains identical after the Lit refactoring while properly supporting component encapsulation.
