import { type Action, type GameState } from "../state/types";

import { type InputHandler, type InputHandlerState } from "./handler";
import { StateMachineInputHandler } from "./StateMachineInputHandler";

// Public type for configurable key bindings
export type BindableAction =
  | "MoveLeft"
  | "MoveRight"
  | "SoftDrop"
  | "HardDrop"
  | "RotateCW"
  | "RotateCCW"
  | "Hold";

export type KeyBindings = Record<BindableAction, Array<string>>; // KeyboardEvent.code values

export function defaultKeyBindings(): KeyBindings {
  return {
    HardDrop: ["Space"],
    Hold: ["KeyC"],
    MoveLeft: ["ArrowLeft", "KeyA"],
    MoveRight: ["ArrowRight", "KeyD"],
    RotateCCW: ["KeyZ"],
    RotateCW: ["ArrowUp", "KeyW"],
    SoftDrop: ["ArrowDown", "KeyS"],
  };
}

const STORAGE_KEY = "finessimo";
const LEGACY_BINDINGS_KEY = "finessimo-keybindings";

const BINDABLE_ACTIONS: ReadonlyArray<BindableAction> = [
  "MoveLeft",
  "MoveRight",
  "SoftDrop",
  "HardDrop",
  "RotateCW",
  "RotateCCW",
  "Hold",
];

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function hasKey<K extends string>(
  o: Record<string, unknown>,
  k: K,
): o is Record<K, unknown> {
  return k in o;
}

function isStringArray(a: unknown): a is Array<string> {
  return Array.isArray(a) && a.every((s) => typeof s === "string");
}

function coerceKeyBindings(maybe: unknown): KeyBindings {
  const fallback = defaultKeyBindings();
  if (!isRecord(maybe)) return fallback;
  const result: KeyBindings = { ...fallback };
  for (const action of BINDABLE_ACTIONS) {
    const v = (maybe as Record<BindableAction, unknown>)[action];
    result[action] = isStringArray(v) ? [...v] : [...fallback[action]];
  }
  return result;
}

// Pure function to map key code to binding action
export function mapKeyToBinding(
  code: string,
  bindings: KeyBindings,
): BindableAction | null {
  const inList = (codes: Array<string>): boolean => codes.includes(code);
  if (inList(bindings.MoveLeft)) return "MoveLeft";
  if (inList(bindings.MoveRight)) return "MoveRight";
  if (inList(bindings.SoftDrop)) return "SoftDrop";
  if (inList(bindings.RotateCW)) return "RotateCW";
  if (inList(bindings.RotateCCW)) return "RotateCCW";
  if (inList(bindings.HardDrop)) return "HardDrop";
  if (inList(bindings.Hold)) return "Hold";
  return null;
}

// Pure function to load bindings from storage
export function loadBindingsFromStorage(): KeyBindings {
  try {
    // Prefer consolidated store
    const storeRaw = localStorage.getItem(STORAGE_KEY);
    if (storeRaw !== null) {
      const store: unknown = JSON.parse(storeRaw);
      if (isRecord(store) && hasKey(store, "keyBindings")) {
        return coerceKeyBindings(store["keyBindings"]);
      }
    }

    // Fallback to legacy key
    const legacyRaw = localStorage.getItem(LEGACY_BINDINGS_KEY);
    if (legacyRaw !== null) {
      const legacy: unknown = JSON.parse(legacyRaw);
      const merged = { ...defaultKeyBindings(), ...coerceKeyBindings(legacy) };
      return merged;
    }
    return defaultKeyBindings();
  } catch {
    return defaultKeyBindings();
  }
}

// Pure function to save bindings to storage (with side effect)
export function saveBindingsToStorage(bindings: KeyBindings): void {
  try {
    // Try to preserve other settings in consolidated store
    const store = getExistingStoreOrEmpty();
    store["keyBindings"] = bindings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage errors
  }
}

function getExistingStoreOrEmpty(): Record<string, unknown> {
  const storeRaw = localStorage.getItem(STORAGE_KEY);
  if (storeRaw === null) return {};

  try {
    const parsed: unknown = JSON.parse(storeRaw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {}; // ignore parse errors, use empty store
  }
}

// KeyboardInputHandler class - handles DOM events and delegates to pure functions
export class KeyboardInputHandler implements InputHandler {
  private dispatch?: (action: Action) => void;
  private stateMachineHandler: StateMachineInputHandler;

  constructor() {
    this.stateMachineHandler = new StateMachineInputHandler();
  }

  init(dispatch: (action: Action) => void): void {
    this.dispatch = dispatch;
    this.stateMachineHandler.init(dispatch);
  }

  start(): void {
    this.stateMachineHandler.start();
  }

  stop(): void {
    this.stateMachineHandler.stop();
  }

  update(gameState: GameState, nowMs: number): void {
    if (!this.dispatch) return;
    this.stateMachineHandler.update(gameState, nowMs);
  }

  getState(): InputHandlerState {
    return this.stateMachineHandler.getState();
  }

  setKeyBindings(bindings: KeyBindings): void {
    this.stateMachineHandler.setKeyBindings(bindings);
  }

  getKeyBindings(): KeyBindings {
    return this.stateMachineHandler.getKeyBindings();
  }

  getStateMachineInputHandler(): StateMachineInputHandler {
    return this.stateMachineHandler;
  }

  // Prime timing on the state-machine to avoid first-frame mismatch
  applyTiming(timing: { dasMs: number; arrMs: number }): void {
    this.stateMachineHandler.applyTiming(timing);
  }
}
