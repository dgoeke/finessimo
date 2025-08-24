import { Action, KeyAction, InputEvent, GameState } from "../state/types";
import { fromNow } from "../types/timestamp";
import { InputHandler, InputHandlerState, InputProcessor } from "./handler";

// Public type for configurable key bindings
export type BindableAction =
  | "MoveLeft"
  | "MoveRight"
  | "SoftDrop"
  | "HardDrop"
  | "RotateCW"
  | "RotateCCW"
  | "Hold";

export type KeyBindings = Record<BindableAction, string[]>; // KeyboardEvent.code values

export function defaultKeyBindings(): KeyBindings {
  return {
    MoveLeft: ["ArrowLeft", "KeyA"],
    MoveRight: ["ArrowRight", "KeyD"],
    SoftDrop: ["ArrowDown", "KeyS"],
    HardDrop: ["Space"],
    RotateCW: ["ArrowUp", "KeyX"],
    RotateCCW: ["LCtrl", "KeyZ"],
    Hold: ["KeyC"],
  };
}

const STORAGE_KEY = "finessimo";
const LEGACY_BINDINGS_KEY = "finessimo-keybindings";

const BINDABLE_ACTIONS: readonly BindableAction[] = [
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

function isStringArray(a: unknown): a is string[] {
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
  const inList = (codes: string[]): boolean => codes.includes(code);
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
    if (storeRaw) {
      const store: unknown = JSON.parse(storeRaw);
      if (isRecord(store) && hasKey(store, "keyBindings")) {
        return coerceKeyBindings(store.keyBindings);
      }
    }

    // Fallback to legacy key
    const legacyRaw = localStorage.getItem(LEGACY_BINDINGS_KEY);
    if (legacyRaw) {
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
    const storeRaw = localStorage.getItem(STORAGE_KEY);
    let store: Record<string, unknown> = {};
    if (storeRaw) {
      try {
        const parsed: unknown = JSON.parse(storeRaw);
        if (isRecord(parsed)) store = parsed;
      } catch {
        // ignore parse errors, use empty store
      }
    }
    store.keyBindings = bindings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage errors
  }
}

// KeyboardInputHandler class - handles DOM events and delegates to pure functions
export class KeyboardInputHandler implements InputHandler {
  private dispatch?: (action: Action) => void;
  private processor = new InputProcessor();
  private keyBindings: KeyBindings = defaultKeyBindings();
  private frameCounter = 0;
  private latestGameState?: GameState;

  // Pre-bound handlers to ensure removeEventListener works correctly
  private boundKeyDownHandler = this.handleKeyDown.bind(this);
  private boundKeyUpHandler = this.handleKeyUp.bind(this);

  init(dispatch: (action: Action) => void): void {
    this.dispatch = dispatch;
    this.processor.init(dispatch);
    this.keyBindings = loadBindingsFromStorage();
  }

  start(): void {
    document.addEventListener("keydown", this.boundKeyDownHandler);
    document.addEventListener("keyup", this.boundKeyUpHandler);
  }

  stop(): void {
    document.removeEventListener("keydown", this.boundKeyDownHandler);
    document.removeEventListener("keyup", this.boundKeyUpHandler);
  }

  update(gameState: GameState, nowMs: number): void {
    if (!this.dispatch) return;
    this.frameCounter++;
    this.latestGameState = gameState; // Store for key event handlers
    this.processor.update(gameState, nowMs);
  }

  getState(): InputHandlerState {
    return this.processor.getState();
  }

  setKeyBindings(bindings: KeyBindings): void {
    this.keyBindings = bindings;
    saveBindingsToStorage(bindings);
  }

  getKeyBindings(): KeyBindings {
    return { ...this.keyBindings };
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.dispatch) return;

    // Ignore inputs when settings overlay is open to allow rebinding
    if (document.body.classList.contains("settings-open")) return;

    const keyBinding = mapKeyToBinding(event.code, this.keyBindings);
    if (!keyBinding) return;

    event.preventDefault();

    // Prevent key repeat
    if (event.repeat) return;

    const currentTime = fromNow();
    const currentTimeMs = currentTime as number;

    // Create InputEvent and process through InputProcessor
    let keyAction: KeyAction;
    switch (keyBinding) {
      case "MoveLeft":
        keyAction = "LeftDown";
        break;
      case "MoveRight":
        keyAction = "RightDown";
        break;
      case "RotateCW":
        keyAction = "RotateCW";
        break;
      case "RotateCCW":
        keyAction = "RotateCCW";
        break;
      case "HardDrop":
        keyAction = "HardDrop";
        break;
      case "Hold":
        keyAction = "Hold";
        break;
      case "SoftDrop":
        keyAction = "SoftDropDown";
        break;
      default:
        return;
    }

    const inputEvent: InputEvent = {
      tMs: currentTimeMs,
      frame: this.frameCounter,
      action: keyAction,
    };

    // Log the raw input event
    this.dispatch({ type: "EnqueueInput", event: inputEvent });

    // Process through InputProcessor (creates ProcessedActions automatically)
    if (this.latestGameState) {
      this.processor.processEvent(inputEvent, this.latestGameState);
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (!this.dispatch) return;

    // Ignore inputs when settings overlay is open to allow rebinding
    if (document.body.classList.contains("settings-open")) return;

    const keyBinding = mapKeyToBinding(event.code, this.keyBindings);
    if (!keyBinding) return;

    event.preventDefault();
    const currentTime = fromNow();
    const currentTimeMs = currentTime as number;

    // Create InputEvent for key releases and process through InputProcessor
    let keyAction: KeyAction;
    switch (keyBinding) {
      case "MoveLeft":
        keyAction = "LeftUp";
        break;
      case "MoveRight":
        keyAction = "RightUp";
        break;
      case "SoftDrop":
        keyAction = "SoftDropUp";
        break;
      // Other keys don't need key-up handling
      default:
        return;
    }

    const inputEvent: InputEvent = {
      tMs: currentTimeMs,
      frame: this.frameCounter,
      action: keyAction,
    };

    // Log the raw input event
    this.dispatch({ type: "EnqueueInput", event: inputEvent });

    // Process through InputProcessor
    if (this.latestGameState) {
      this.processor.processEvent(inputEvent, this.latestGameState);
    }
  }
}
