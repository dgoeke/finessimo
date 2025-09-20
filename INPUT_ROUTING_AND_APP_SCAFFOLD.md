# Input Routing & App Scaffolding — Prompts for an AI Coding Assistant

**Goal:** Add the `input‑device‑handler` library and wire a **single normalized input stream** into two **pure transducers** (UI and Game), an **Input Router**, and **pure app routes** (Main Menu, Settings, Keybindings, Playing/Freeplay, Game Over).  
Everything except the outermost device listener remains **pure & strongly typed** with **100% unit test coverage** for pure modules. No UX yet—only data flow and reducers.

---

## Global Context (do not change)

- **Engine core** is pure and already implemented:
  ```ts
  // engine/index.ts
  export function step(
    state: GameState,
    cmds: ReadonlyArray<Command>
  ): { state: GameState; events: ReadonlyArray<DomainEvent> };
  ```
- **Game control** (DAS/ARR) transducer exists (or will be used):
  - `(ControlState, KeyEdges, tick) -> { next, commands, telemetry }` (pure)
- **Runtime orchestrator** exists (or will be used):
  - `runtimeStep(state, keyEdgesThisTick, mode)` → `{ state', out }`
- Project uses **TypeScript** with `"strict": true`.
- **Quality gate**: `npm run check` must pass (typecheck + lint + tests + format).

> If any file path differs in this repo, **adapt the path**, but **preserve the interfaces** below.

---

# Phase 1 — Install `input‑device‑handler` and Create a Thin Adapter

> We will **wrap** the library behind a small interface so the rest of the app stays pure and testable. The adapter is the only impure part (subscribe/unsubscribe).

### 1.1 Install library

```sh
npm i input-device-handler
```

### 1.2 Define normalized keys and edges

- `src/device/keys.ts`

```ts
export type Device = "keyboard" | "gamepad" | "touch" | "mouse";
export type Tick = number & { readonly brand: "Tick" };

// Superset of UI+Game keys; menus use Up/Down/Left/Right/Confirm/Back.
export type Key =
  | "Up"
  | "Down"
  | "Left"
  | "Right"
  | "Confirm"
  | "Back"
  | "SoftDrop"
  | "HardDrop"
  | "CW"
  | "CCW"
  | "Hold";

export type KeyEdge = Readonly<{
  device: Device;
  key: Key;
  type: "down" | "up";
  tick: Tick;
  // Optional original timestamp for audit
  tMs?: number;
}>;
```

### 1.3 Adapter interface (impure boundary)

- `src/device/adapter.ts`

```ts
import type { Device, Key, KeyEdge, Tick } from "./keys";

export type DeviceDriver = {
  /** Begin listening to physical devices (impure). */
  start: () => void;
  /** Stop listening / release resources (impure). */
  stop: () => void;
  /**
   * Drain buffered edges for the current app tick.
   * The adapter is responsible for quantizing timestamps → ticks.
   * This is the ONLY function called from the pure loop boundary.
   */
  drainKeyEdges: (tick: Tick) => readonly KeyEdge[];
};

export type Keymap = Readonly<Map<string, Key>>; // raw code/btn → Key

export type Quantizer = (tMs: number) => Tick;

/** Factory to create a driver using input‑device‑handler. */
export function makeDeviceDriver(opts: {
  keyboardMap: Keymap;
  gamepadMap: Keymap;
  quantize: Quantizer;
}): DeviceDriver {
  // TODO: implement with the real input‑device‑handler API:
  // - subscribe to keydown/keyup with event.code
  // - subscribe to gamepad buttons/axes → synthesize down/up
  // - push normalized KeyEdge into a ring buffer
  // - implement drainKeyEdges(tick) to return and clear buffered edges
  throw new Error("Not implemented yet");
}
```

### 1.4 Default keymaps

- `src/device/default-keymaps.ts`

```ts
import type { Keymap } from "./adapter";

// Browser KeyboardEvent.code → Key
export const DEFAULT_KBD_MAP: Keymap = new Map([
  ["ArrowUp", "Up"],
  ["ArrowDown", "Down"],
  ["ArrowLeft", "Left"],
  ["ArrowRight", "Right"],
  ["Enter", "Confirm"],
  ["Space", "Confirm"],
  ["Escape", "Back"],

  // Gameplay
  ["KeyZ", "CCW"],
  ["KeyX", "CW"],
  ["KeyC", "Hold"],
  ["ShiftLeft", "SoftDrop"],
  ["ShiftRight", "SoftDrop"],
  ["ArrowUp", "HardDrop"],
]);

// Gamepad mapping (example; adapt as needed)
export const DEFAULT_PAD_MAP: Keymap = new Map([
  ["gp:button:0", "Confirm"], // A / Cross
  ["gp:button:1", "Back"], // B / Circle
  ["gp:button:12", "Up"],
  ["gp:button:13", "Down"],
  ["gp:button:14", "Left"],
  ["gp:button:15", "Right"],
  ["gp:button:4", "Hold"], // LB
  ["gp:button:5", "CW"], // RB
  ["gp:button:2", "CCW"], // X / Square
  ["gp:button:3", "HardDrop"], // Y / Triangle
  ["gp:axis:0:-", "Left"],
  ["gp:axis:0:+", "Right"],
  ["gp:axis:1:+", "Down"], // could map to SoftDrop depending on UI
]);
```

### 1.5 Unit tests (adapter mapping)

- `src/device/adapter.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { makeDeviceDriver } from "./adapter";
import { DEFAULT_KBD_MAP, DEFAULT_PAD_MAP } from "./default-keymaps";
import type { Tick } from "./keys";

const quantize = (ms: number) => Math.ceil(ms / 16) as unknown as Tick;

describe("Device adapter", () => {
  it("maps keyboard codes to KeyEdge", () => {
    // Use a fake adapter implementation for tests (no real DOM).
    // Assistant: implement a test double of input-device-handler inside makeDeviceDriver
    // when process.env.NODE_ENV === 'test', exposing a controllable event emitter.
    expect(typeof makeDeviceDriver).toBe("function");
  });

  it("quantizes ms to ticks using provided quantizer", () => {
    // Simulate keydown at 17ms → expect tick=2
  });

  it("separates frames with drainKeyEdges", () => {
    // push events for two different ms buckets and assert only current tick is drained
  });
});
```

> **Assistant:** Implement a **test double** path in `makeDeviceDriver` so unit tests can inject fake device events. Keep production code using the real library.

---

# Phase 2 — UI Control Transducer (pure)

Translates `KeyEdge[]` → `UiMsg[]` and returns which edges were “consumed”.

### 2.1 Types

- `src/ui/control/types.ts`

```ts
import type { KeyEdge } from "../../device/keys";

export type UiMsg =
  | { type: "Menu/MoveFocus"; dir: "Up" | "Down" | "Left" | "Right" }
  | { type: "Menu/Select" }
  | { type: "Nav/Back" }
  | { type: "Settings/Change"; key: string; value: unknown }
  | { type: "Overlay/Close" };

export type UiCtrlState = Readonly<{
  // add focus repeat logic if needed later
}>;

export type UiCtrlResult = Readonly<{
  next: UiCtrlState;
  msgs: readonly UiMsg[];
  consumed: ReadonlySet<KeyEdge>;
}>;

export type RouteKind =
  | "MainMenu"
  | "Settings"
  | "Keybindings"
  | "Playing"
  | "GameOver"
  | "HighScores";
```

### 2.2 Implementation

- `src/ui/control/index.ts`

```ts
import type { KeyEdge } from "../../device/keys";
import type { UiCtrlState, UiCtrlResult, RouteKind, UiMsg } from "./types";

function routeKeymap(route: RouteKind): ReadonlyMap<string, UiMsg> {
  switch (route) {
    case "MainMenu":
      return new Map([
        ["Up", { type: "Menu/MoveFocus", dir: "Up" }],
        ["Down", { type: "Menu/MoveFocus", dir: "Down" }],
        ["Left", { type: "Menu/MoveFocus", dir: "Left" }],
        ["Right", { type: "Menu/MoveFocus", dir: "Right" }],
        ["Confirm", { type: "Menu/Select" }],
        ["Back", { type: "Nav/Back" }],
      ]);
    case "Settings":
    case "Keybindings":
    case "HighScores":
    case "GameOver":
      return new Map([
        ["Up", { type: "Menu/MoveFocus", dir: "Up" }],
        ["Down", { type: "Menu/MoveFocus", dir: "Down" }],
        ["Confirm", { type: "Menu/Select" }],
        ["Back", { type: "Nav/Back" }],
      ]);
    case "Playing":
      return new Map([
        ["Back", { type: "Nav/Back" }], // pause/back
      ]);
  }
}

export function uiControlStep(
  s: UiCtrlState,
  edges: readonly KeyEdge[],
  ctx: { route: RouteKind; overlayOpen: boolean }
): UiCtrlResult {
  const map = routeKeymap(ctx.route);
  const msgs: UiMsg[] = [];
  const consumed = new Set<KeyEdge>();

  for (const e of edges) {
    if (e.type !== "down") continue;
    const m = map.get(e.key);
    if (m) {
      msgs.push(m);
      consumed.add(e);
    }
  }
  return { next: s, msgs, consumed };
}
```

### 2.3 Unit tests

- `src/ui/control/index.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { uiControlStep } from "./index";
import type { KeyEdge, Tick } from "../../device/keys";

const tick = (n: number) => n as unknown as Tick;

describe("uiControlStep", () => {
  it("produces UiMsg for menu navigation and consumes edges", () => {
    const edges: KeyEdge[] = [
      { device: "keyboard", key: "Down", type: "down", tick: tick(1) },
      { device: "keyboard", key: "Confirm", type: "down", tick: tick(1) },
    ];
    const r = uiControlStep({}, edges, {
      route: "MainMenu",
      overlayOpen: false,
    });
    expect(r.msgs.map((m) => m.type)).toEqual([
      "Menu/MoveFocus",
      "Menu/Select",
    ]);
    expect(r.consumed.size).toBe(2);
  });

  it("only maps Back in Playing route", () => {
    const edges: KeyEdge[] = [
      { device: "keyboard", key: "Down", type: "down", tick: tick(1) },
      { device: "keyboard", key: "Back", type: "down", tick: tick(1) },
    ];
    const r = uiControlStep({}, edges, {
      route: "Playing",
      overlayOpen: false,
    });
    expect(r.msgs.map((m) => m.type)).toEqual(["Nav/Back"]);
    expect(r.consumed.size).toBe(1);
  });
});
```

---

# Phase 3 — Game Control Integration (pure; DAS/ARR)

Ensure the existing game control transducer returns `consumed` (optional) and is imported as `gameControlStep`.

### 3.1 Type (if missing)

```ts
export type GameCtrlResult = Readonly<{
  next: ControlState;
  commands: readonly Command[];
  telemetry: readonly ControlEvent[];
  consumed: ReadonlySet<KeyEdge>;
}>;
```

### 3.2 Unit tests (behavioral)

- `src/control/index.test.ts`

```ts
import { describe, it, expect } from "vitest";
// Arrange: hold Right across DAS maturity and expect ArrRepeat or SonicShift
// Verify commands & telemetry sequences for ARR>0 and ARR=0, and that opposite direction resets charge.
describe("gameControlStep (DAS/ARR)", () => {
  it("tap then repeats after DAS when ARR>0", () => {
    /* ... */
  });
  it("sonic shift when ARR=0 at maturity", () => {
    /* ... */
  });
  it("direction switch resets DAS (last-pressed wins)", () => {
    /* ... */
  });
});
```

---

# Phase 4 — Input Router (pure)

Priority: **Overlay → Route UI → Game**. Each stage can **consume** edges; pass the rest down.

- `src/input/router.ts`

```ts
import type { KeyEdge, Tick } from "../device/keys";
import { uiControlStep } from "../ui/control";
import { controlStep as gameControlStep } from "../control";
import type { UiCtrlState, UiMsg, RouteKind } from "../ui/control/types";
import type { ControlState } from "../control/types";
import type { Command } from "../engine/commands";
import type { ControlEvent } from "../control/types";

export type RoutedInput = Readonly<{
  uiMsgs: readonly UiMsg[];
  game: Readonly<{
    commands: readonly Command[];
    telemetry: readonly ControlEvent[];
  }>;
  nextUi: UiCtrlState;
  nextGame: ControlState;
}>;

export function routeInputs(
  route: RouteKind,
  overlayOpen: boolean,
  uiS: UiCtrlState,
  gameS: ControlState,
  edges: readonly KeyEdge[],
  tick: Tick
): RoutedInput {
  // 1) Overlay (if open, treat as route with its own mapping)
  const overlay = overlayOpen
    ? uiControlStep(uiS, edges, { route, overlayOpen: true })
    : null;
  const edges1 = overlay
    ? edges.filter((e) => !overlay.consumed.has(e))
    : edges;
  const msgs1 = overlay ? overlay.msgs : [];

  // 2) Route UI
  const ui = uiControlStep(overlay ? overlay.next : uiS, edges1, {
    route,
    overlayOpen,
  });
  const edges2 = edges1.filter((e) => !ui.consumed.has(e));
  const msgs2 = ui.msgs;

  // 3) Game (only in Playing route and if no overlay)
  const isPlaying = route === "Playing" && !overlayOpen;
  const game = isPlaying
    ? gameControlStep(gameS, edges2, tick)
    : {
        next: gameS,
        commands: [] as Command[],
        telemetry: [] as ControlEvent[],
        consumed: new Set<KeyEdge>(),
      };

  return {
    uiMsgs: [...msgs1, ...msgs2],
    game: { commands: game.commands, telemetry: game.telemetry },
    nextUi: ui.next,
    nextGame: game.next,
  };
}
```

### Tests

- `src/input/router.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { routeInputs } from "./router";
import type { KeyEdge, Tick } from "../device/keys";

const tick = (n: number) => n as unknown as Tick;

describe("routeInputs", () => {
  it("overlay swallows all edges", () => {
    /* ... */
  });
  it("menus produce UiMsgs; game receives remainder only in Playing", () => {
    /* ... */
  });
});
```

---

# Phase 5 — App State & Reducers (routes only, pure; no UI)

We scaffold **MainMenu**, **Settings**, **Keybindings**, **Playing** (runtime holder), **GameOver**, and **HighScores**.

### 5.1 Types

- `src/app/types.ts`

```ts
import type { RuntimeState } from "../runtime/loop";

export type Preferences = Readonly<{
  tps: number;
  dasTicks: number;
  arrTicks: number;
  // keymaps will be added in Phase 7
}>;

export type MainMenuState = Readonly<{
  items: readonly string[];
  focusedIndex: number;
}>;
export type SettingsState = Readonly<{ draft: Preferences }>;
export type KeybindingsState = Readonly<{
  /* editing buffer */
}>;
export type PlayingState = Readonly<{
  runtime: RuntimeState<unknown>;
  paused: boolean;
}>;
export type GameOverState = Readonly<{
  score: number;
  lines: number;
  timeMs: number;
}>;
export type HighScoresState = Readonly<{
  loading: boolean;
  scores: readonly { name: string; score: number }[];
}>;

export type Route =
  | { kind: "MainMenu"; state: MainMenuState }
  | { kind: "Settings"; state: SettingsState }
  | { kind: "Keybindings"; state: KeybindingsState }
  | { kind: "Playing"; state: PlayingState }
  | { kind: "GameOver"; state: GameOverState }
  | { kind: "HighScores"; state: HighScoresState };

export type AppState = Readonly<{
  route: Route;
  overlay: null | { kind: "Pause" | "ConfirmQuit" };
  toasts: readonly { id: string; text: string }[];
  prefs: Preferences;
}>;

export type AppMsg =
  | { type: "Menu/MoveFocus"; dir: "Up" | "Down" | "Left" | "Right" }
  | { type: "Menu/Select" }
  | { type: "Nav/Back" }
  | { type: "Settings/Change"; patch: Partial<Preferences> }
  | { type: "Settings/Back" }
  | { type: "Game/StartFreeplay" }
  | { type: "Game/Ended"; score: number }
  | { type: "Scores/Load" }
  | {
      type: "Scores/Loaded";
      scores: readonly { name: string; score: number }[];
    };
```

### 5.2 Reducer

- `src/app/update.ts`

```ts
import type { AppMsg, AppState, Route } from "./types";

export type AppEffect =
  | { eff: "storage.savePrefs" }
  | { eff: "scores.fetch" }
  | {
      eff: "sound.play";
      name: "ui-confirm" | "ui-back" | "tick" | "fail" | "success";
    }
  | {
      eff: "scene.change";
      scene:
        | "menu"
        | "settings"
        | "keybindings"
        | "game"
        | "gameover"
        | "scores";
    }
  | { eff: "noop" };

export type UpdateResult = Readonly<{
  state: AppState;
  effects: readonly AppEffect[];
}>;

export function appUpdate(state: AppState, msg: AppMsg): UpdateResult {
  switch (state.route.kind) {
    case "MainMenu":
      return updateMainMenu(state, msg);
    case "Settings":
      return updateSettings(state, msg);
    case "Keybindings":
      return updateKeybindings(state, msg);
    case "Playing":
      return updatePlaying(state, msg);
    case "GameOver":
      return updateGameOver(state, msg);
    case "HighScores":
      return updateHighScores(state, msg);
  }
}

// Implement update* with pure state changes and AppEffects
function updateMainMenu(app: AppState, msg: AppMsg): UpdateResult {
  const s = app.route.state;
  switch (msg.type) {
    case "Menu/MoveFocus": {
      const n =
        (s.focusedIndex + (msg.dir === "Down" ? 1 : -1) + s.items.length) %
        s.items.length;
      return {
        state: {
          ...app,
          route: { kind: "MainMenu", state: { ...s, focusedIndex: n } },
        },
        effects: [{ eff: "sound.play", name: "tick" }],
      };
    }
    case "Menu/Select": {
      // Default: Start freeplay
      return { state: app, effects: [{ eff: "scene.change", scene: "game" }] };
    }
    default:
      return { state: app, effects: [] };
  }
}

// TODO: implement updateSettings, updateKeybindings, updatePlaying, updateGameOver, updateHighScores
```

### 5.3 Unit tests

- `src/app/update.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { appUpdate } from "./update";
import type { AppState } from "./types";

const mkState = (): AppState => ({
  route: {
    kind: "MainMenu",
    state: { items: ["Play", "Settings", "Quit"], focusedIndex: 0 },
  },
  overlay: null,
  toasts: [],
  prefs: { tps: 120, dasTicks: 10, arrTicks: 2 },
});

describe("appUpdate", () => {
  it("moves focus in main menu", () => {
    const s0 = mkState();
    const r = appUpdate(s0, { type: "Menu/MoveFocus", dir: "Down" });
    expect((r.state.route.state as any).focusedIndex).toBe(1);
  });

  it("select triggers scene change effect", () => {
    const s0 = mkState();
    const r = appUpdate(s0, { type: "Menu/Select" });
    expect(r.effects).toEqual([{ eff: "scene.change", scene: "game" }]);
  });
});
```

---

# Phase 6 — Driver: Wire Device → Router → App → Runtime (thin shell)

This is the only place with side-effects: start/stop device listeners and a tick loop. No rendering yet.

- `src/driver/loop.ts`

```ts
import { makeDeviceDriver } from "../device/adapter";
import { DEFAULT_KBD_MAP, DEFAULT_PAD_MAP } from "../device/default-keymaps";
import type { Tick } from "../device/keys";
import { routeInputs } from "../input/router";
import { appUpdate } from "../app/update";
import type { AppState } from "../app/types";
import { runtimeStep } from "../runtime/loop";

jest.mock("input-device-handler", () => {
  class FakeIDH {
    constructor(_: any) {}
    readAllDevices() {
      return { keyboard: new Set(), gamepads: [] };
    }
    // add only what the adapter touches in unit tests
  }
  return { InputDeviceHandler: FakeIDH };
});

export function startAppLoop(
  initial: AppState,
  quantize: (ms: number) => Tick
) {
  const driver = makeDeviceDriver({
    keyboardMap: DEFAULT_KBD_MAP,
    gamepadMap: DEFAULT_PAD_MAP,
    quantize,
  });
  driver.start();

  let app = initial;
  let uiCtrl = {};
  let gameCtrl = {} as any; // existing ControlState init
  let tick = 0 as unknown as Tick;

  function frame(nowMs: number) {
    const edges = driver.drainKeyEdges(quantize(nowMs));
    const route = app.route.kind as any;
    const overlayOpen = app.overlay !== null;

    const routed = routeInputs(
      route,
      overlayOpen,
      uiCtrl as any,
      gameCtrl as any,
      edges,
      tick
    );
    const upd = appUpdate(
      app,
      /* fold UiMsgs into a single message per test or iterate */ routed
        .uiMsgs[0] ?? ({ type: "noop" } as any)
    );
    app = upd.state;
    uiCtrl = routed.nextUi;
    gameCtrl = routed.nextGame;

    if (route === "Playing" && !overlayOpen) {
      const playing = app.route.state as any;
      const rt = runtimeStep(playing.runtime, edges, {} as any); // supply current Mode
      playing.runtime = rt.state; // immutable copy in real code
      // app can receive engine events as messages if desired
    }

    // increment tick
    // @ts-ignore branded
    tick = (tick + 1) as Tick;
    // schedule next frame (outer UI will do this)
  }

  return { frame, stop: () => driver.stop(), getState: () => app };
}
```

### Tests (driver is hard to unit test; test the pure pieces instead)

- Ensure `routeInputs`, `appUpdate`, and `runtimeStep` unit tests reach 100% coverage.

---

# Phase 7 — Keybindings Menu (pure; affects keymaps)

Add a route that edits and saves the keybindings as preferences. The device adapter should consume keymaps from `prefs`.

### 7.1 Extend Preferences

```ts
export type Preferences = Readonly<{
  tps: number;
  dasTicks: number;
  arrTicks: number;
  keymapKeyboard: Record<string, string>; // code → Key
  keymapGamepad: Record<string, string>; // 'gp:*' → Key
}>;
```

### 7.2 Keybindings Reducer

- `src/app/update.ts` → `updateKeybindings`: on `Menu/Select` in “listening” state, the next `KeyDown` UiMsg updates the draft map; on `Settings/Back`, save via effect `{ eff: 'storage.savePrefs' }`.

### 7.3 Tests

- Simulate “rebind Left to KeyA” and assert `prefs.keymapKeyboard['KeyA'] === 'Left'` after save.

---

# Phase 8 — Game Over (pure transition)

### 8.1 In `Playing` reducer

- On engine events (e.g., contains `TopOut`), issue `AppMsg: Game/Ended` with score.

### 8.2 In `GameOver` reducer

- Handle `Menu/Select`: return to main menu; emit `scene.change: 'menu'`.

### 8.3 Tests

- Inject a fake engine event sequence including `TopOut`; assert route switches to `GameOver`.

---

# Best Practices

- **Keep adapter thin** and **wrap the library**; the rest of the app consumes only our normalized `KeyEdge`.
- **Never read real time inside pure code**; only the driver quantizes ms → ticks.
- **Exhaustive switch** on discriminated unions with `never` checks.
- **100% coverage** on all pure modules (Vitest thresholds enforce this).
- **Deterministic tests**: simulate edges as arrays with explicit ticks; assert outputs exactly.

---

# Acceptance Criteria

- `npm run check` passes.
- All new pure modules have **100% coverage** and strong types.
- Device adapter compiles; tests use a test double (no DOM/Gamepad needed).
- Input Router enforces **Overlay → Route UI → Game** priority.
- App routes are pure; Playing holds runtime; GameOver transition works.
- No rendering/UI; only pure data & effects.
