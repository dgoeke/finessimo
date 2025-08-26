import { fromNow, createTimestamp } from "../types/timestamp";

import {
  defaultKeyBindings,
  loadBindingsFromStorage,
  saveBindingsToStorage,
} from "./keyboard";
import { DASMachineService } from "./machines/das";
import { keyBindingManager } from "./utils/key-binding-manager";

import type { InputHandler, InputHandlerState } from "./handler";
import type { KeyBindings, BindableAction } from "./keyboard";
import type { Action, GameState } from "../state/types";

export class StateMachineInputHandler implements InputHandler {
  private dispatch: ((action: Action) => void) | null = null;
  private bindings: KeyBindings = defaultKeyBindings();
  private keyStates = new Map<string, boolean>();
  private dasService: DASMachineService;
  private isSoftDropDown = false;
  private softDropLastTime: number | undefined;
  private currentGameState?: GameState;
  private lastDasMs?: number;
  private lastArrMs?: number;

  // KeyBindingManager unsubscribe functions
  private keyBindingsUnsubDown?: (() => void) | undefined;
  private keyBindingsUnsubUp?: (() => void) | undefined;

  // Bound event handlers for cleanup
  private resetAllInputsBound = (): void => this.resetAllInputs();
  private onVisibilityChangeBound = (): void => this.onVisibilityChange();

  constructor(dasMs = 133, arrMs = 2) {
    this.dasService = new DASMachineService({
      arrLastTime: undefined,
      arrMs,
      dasMs,
      dasStartTime: undefined,
      direction: undefined,
      repeats: 0,
    });
  }

  init(dispatch: (action: Action) => void): void {
    this.dispatch = dispatch;
    this.bindings = loadBindingsFromStorage();
  }

  start(): void {
    this.keyStates.clear();
    this.isSoftDropDown = false;
    this.softDropLastTime = undefined;
    this.dasService.reset();

    // Register key bindings
    const downBindings = this.buildDownBindings();
    const upBindings = this.buildUpBindings();
    this.keyBindingsUnsubDown = keyBindingManager.bind(window, downBindings, {
      event: "keydown",
    });
    this.keyBindingsUnsubUp = keyBindingManager.bind(window, upBindings, {
      event: "keyup",
    });

    // Add safety event listeners for focus loss
    window.addEventListener("blur", this.resetAllInputsBound);
    document.addEventListener("visibilitychange", this.onVisibilityChangeBound);
  }

  stop(): void {
    this.keyBindingsUnsubDown?.();
    this.keyBindingsUnsubUp?.();
    this.keyBindingsUnsubDown = this.keyBindingsUnsubUp = undefined;

    // Remove safety event listeners
    window.removeEventListener("blur", this.resetAllInputsBound);
    document.removeEventListener(
      "visibilitychange",
      this.onVisibilityChangeBound,
    );

    this.dasService.reset();
  }

  update(gameState: GameState, nowMs: number): void {
    if (!this.dispatch) return;

    // Store current game state for use in key handlers
    this.currentGameState = gameState;

    if (gameState.status !== "playing") {
      return;
    }

    // Update DAS timing from game state - only when it changes
    const { arrMs, dasMs } = gameState.timing;
    if (this.lastDasMs !== dasMs || this.lastArrMs !== arrMs) {
      this.dasService.updateConfig(dasMs, arrMs);
      this.lastDasMs = dasMs;
      this.lastArrMs = arrMs;
    }

    // Send timer tick to DAS machine if a direction is active
    if (this.dasService.getState().context.direction !== undefined) {
      const actions = this.dasService.send({
        timestamp: nowMs,
        type: "TIMER_TICK",
      });

      this.processActions(actions);
    }

    // Handle soft drop repeat pulses
    if (this.isSoftDropDown && gameState.timing.softDrop !== "infinite") {
      const gravityMs = gameState.timing.gravityMs;
      const softDropMultiplier =
        typeof gameState.timing.softDrop === "number"
          ? gameState.timing.softDrop
          : 1;

      const interval = Math.max(
        1,
        Math.floor(gravityMs / Math.max(1, softDropMultiplier)),
      );

      let nextTime =
        this.softDropLastTime !== undefined
          ? this.softDropLastTime + interval
          : nowMs;

      let pulses = 0;
      const MAX_PULSES_PER_UPDATE = 200;

      while (nextTime <= nowMs && pulses < MAX_PULSES_PER_UPDATE) {
        this.dispatch({ on: true, type: "SoftDrop" });

        this.softDropLastTime = nextTime;
        nextTime += interval;
        pulses++;
      }
    }
  }

  getState(): InputHandlerState {
    const dasState = this.dasService.getState();
    const state = dasState.context;

    return {
      arrLastTime: state.arrLastTime,
      currentDirection: state.direction,
      dasStartTime: state.dasStartTime,
      isLeftKeyDown: state.direction === -1,
      isRightKeyDown: state.direction === 1,
      isSoftDropDown: this.isSoftDropDown,
      ...(this.softDropLastTime !== undefined
        ? { softDropLastTime: this.softDropLastTime }
        : {}),
    };
  }

  setKeyBindings(bindings: KeyBindings): void {
    // Check for duplicate key codes across actions
    const usedKeyCodes = new Set<string>();
    const duplicates: Array<string> = [];

    for (const action of Object.keys(bindings) as Array<BindableAction>) {
      const keyCodes = bindings[action];
      for (const keyCode of keyCodes) {
        // Check raw key code duplicates
        if (usedKeyCodes.has(keyCode)) {
          duplicates.push(keyCode);
        }
        usedKeyCodes.add(keyCode);
      }
    }

    if (duplicates.length > 0) {
      console.warn(
        `Duplicate key bindings detected: ${duplicates.join(", ")}. Some bindings may be overwritten.`,
      );
    }

    this.bindings = { ...bindings };
    saveBindingsToStorage(bindings);

    // Clear key states to prevent stale state from old bindings
    this.keyStates.clear();

    // Rebuild key bindings if currently active
    if (this.keyBindingsUnsubDown || this.keyBindingsUnsubUp) {
      this.keyBindingsUnsubDown?.();
      this.keyBindingsUnsubUp?.();
      const downBindings = this.buildDownBindings();
      const upBindings = this.buildUpBindings();
      this.keyBindingsUnsubDown = keyBindingManager.bind(window, downBindings, {
        event: "keydown",
      });
      this.keyBindingsUnsubUp = keyBindingManager.bind(window, upBindings, {
        event: "keyup",
      });
    }
  }

  getKeyBindings(): KeyBindings {
    return { ...this.bindings };
  }

  // Apply timing immediately to DAS machine to avoid startup mismatch
  applyTiming(
    dasMsOrTiming: number | { dasMs: number; arrMs: number },
    maybeArrMs?: number,
  ): void {
    if (typeof dasMsOrTiming === "number") {
      const arrMs = maybeArrMs ?? this.dasService.getState().context.arrMs;
      this.dasService.updateConfig(dasMsOrTiming, arrMs);
    } else {
      this.dasService.updateConfig(dasMsOrTiming.dasMs, dasMsOrTiming.arrMs);
    }
  }

  // Public method to handle soft drop state from touch with proper timestamp
  setSoftDrop(isDown: boolean, tMs: number): void {
    if (!this.dispatch) return;

    this.isSoftDropDown = isDown;
    if (isDown) {
      this.softDropLastTime = tMs;
      this.dispatch({ on: true, type: "SoftDrop" });
    } else {
      this.dispatch({ on: false, type: "SoftDrop" });
    }
  }

  // Public method to handle movement from touch with proper timestamp
  handleMovement(
    action: "LeftDown" | "LeftUp" | "RightDown" | "RightUp",
    tMs: number,
  ): void {
    if (!this.dispatch) return;

    // Ignore inputs when settings overlay is open
    if (document.body.classList.contains("settings-open")) return;

    // Ignore movement when game is not playing
    if (this.currentGameState && this.currentGameState.status !== "playing")
      return;

    const keyBinding = action.includes("Left") ? "MoveLeft" : "MoveRight";
    const isDown = action.includes("Down");

    if (isDown) {
      this.handleMovementDown(keyBinding, tMs);
    } else {
      this.handleMovementUp(keyBinding, tMs);
    }
  }

  private handleMovementDown(
    keyBinding: "MoveLeft" | "MoveRight",
    timestamp: number,
  ): void {
    if (!this.dispatch) return;

    const direction: -1 | 1 = keyBinding === "MoveLeft" ? -1 : 1;

    // For keyboard events, check for multiple keys bound to same action
    const codes = this.bindings[keyBinding];
    const anotherDown = codes.some((c) => this.keyStates.get(c) === true);

    // Guard against repeated KEY_DOWN for same direction or multiple keys for same action
    if (
      this.dasService.getState().context.direction === direction ||
      anotherDown
    ) {
      return;
    }

    this.handleMovementKeyDown(direction, timestamp);
  }

  private handleMovementUp(
    keyBinding: "MoveLeft" | "MoveRight",
    timestamp: number,
  ): void {
    if (!this.dispatch) return;

    const direction: -1 | 1 = keyBinding === "MoveLeft" ? -1 : 1;

    this.handleMovementKeyUp(direction, timestamp);
  }

  private buildDownBindings(): Record<string, (event: KeyboardEvent) => void> {
    const bindings: Record<string, (event: KeyboardEvent) => void> = {};

    for (const [action, keyCodes] of Object.entries(this.bindings) as Array<
      [BindableAction, Array<string>]
    >) {
      for (const keyCode of keyCodes) {
        bindings[keyCode] = (event: KeyboardEvent): void => {
          this.handleKeyEvent(action, "down", event);
        };
      }
    }

    return bindings;
  }

  private buildUpBindings(): Record<string, (event: KeyboardEvent) => void> {
    const bindings: Record<string, (event: KeyboardEvent) => void> = {};

    // Only bind keyup for actions that need release handling
    const upActions: Array<BindableAction> = [
      "MoveLeft",
      "MoveRight",
      "SoftDrop",
    ];

    for (const [action, keyCodes] of Object.entries(this.bindings) as Array<
      [BindableAction, Array<string>]
    >) {
      if (upActions.includes(action)) {
        for (const keyCode of keyCodes) {
          bindings[keyCode] = (event: KeyboardEvent): void => {
            this.handleKeyEvent(action, "up", event);
          };
        }
      }
    }

    return bindings;
  }

  private resetAllInputs(t = fromNow() as number): void {
    // Release DAS direction if any
    const dir = this.dasService.getState().context.direction;
    if (dir !== undefined) {
      this.dasService.send({ direction: dir, timestamp: t, type: "KEY_UP" });
    }

    // Clear soft drop
    if (this.isSoftDropDown) {
      this.dispatch?.({ on: false, type: "SoftDrop" });
      this.isSoftDropDown = false;
    }
    this.softDropLastTime = undefined;

    // Clear keyboard state
    this.keyStates.clear();
  }

  private onVisibilityChange(): void {
    if (document.hidden) {
      this.resetAllInputs();
    }
  }

  private isGameplayBlocked(): boolean {
    return (
      document.body.classList.contains("settings-open") ||
      (this.currentGameState !== undefined &&
        this.currentGameState.status !== "playing")
    );
  }

  private isStatefulAction(binding: BindableAction): boolean {
    return (
      binding === "MoveLeft" ||
      binding === "MoveRight" ||
      binding === "SoftDrop"
    );
  }

  private handleBlockedKeyRelease(
    binding: BindableAction,
    event: KeyboardEvent,
  ): void {
    if (this.isStatefulAction(binding)) {
      this.keyStates.delete(event.code);
    }
    const timestamp = fromNow() as number;
    if (binding === "MoveLeft" || binding === "MoveRight") {
      this.handleMovementUp(binding, timestamp);
    }
    if (binding === "SoftDrop" && this.dispatch) {
      this.dispatch({ on: false, type: "SoftDrop" });
      this.isSoftDropDown = false;
    }
  }

  private handleKeyDownAction(
    binding: BindableAction,
    event: KeyboardEvent,
    timestamp: number,
  ): void {
    if (!this.dispatch) return;

    switch (binding) {
      case "MoveLeft": {
        this.handleMovementDown(binding, timestamp);
        this.keyStates.set(event.code, true);
        break;
      }
      case "MoveRight": {
        this.handleMovementDown(binding, timestamp);
        this.keyStates.set(event.code, true);
        break;
      }
      case "RotateCW":
        this.dispatch({ dir: "CW", type: "Rotate" });
        break;
      case "RotateCCW":
        this.dispatch({ dir: "CCW", type: "Rotate" });
        break;
      case "HardDrop":
        this.dispatch({
          timestampMs: createTimestamp(timestamp),
          type: "HardDrop",
        });
        break;
      case "Hold":
        this.dispatch({ type: "Hold" });
        break;
      case "SoftDrop":
        this.dispatch({ on: true, type: "SoftDrop" });
        this.isSoftDropDown = true;
        this.softDropLastTime = timestamp;
        this.keyStates.set(event.code, true);
        break;

      default: {
        const _exhaustiveCheck: never = binding;
        return _exhaustiveCheck;
      }
    }
  }

  private handleKeyUpAction(binding: BindableAction, timestamp: number): void {
    switch (binding) {
      case "MoveLeft":
        this.handleMovementUp(binding, timestamp);
        break;
      case "MoveRight":
        this.handleMovementUp(binding, timestamp);
        break;
      case "SoftDrop":
        if (this.dispatch) {
          this.dispatch({ on: false, type: "SoftDrop" });
          this.isSoftDropDown = false;
        }
        break;

      case "RotateCW":
      case "RotateCCW":
      case "HardDrop":
      case "Hold":
        // These actions don't need key-up handling
        break;

      default: {
        const _exhaustiveCheck: never = binding;
        return _exhaustiveCheck;
      }
    }
  }

  private handleKeyEvent(
    binding: BindableAction,
    phase: "down" | "up",
    event: KeyboardEvent,
  ): void {
    if (!this.dispatch) return;

    // Always prevent default behavior for game keys to avoid browser shortcuts
    event.preventDefault();

    const blocked = this.isGameplayBlocked();

    if (blocked) {
      if (phase === "up") {
        this.handleBlockedKeyRelease(binding, event);
      }
      return;
    }
    const timestamp = fromNow() as number;

    if (phase === "down") {
      if (event.repeat) return;

      const isStateful = this.isStatefulAction(binding);
      if (isStateful && this.keyStates.get(event.code) === true) {
        return;
      }

      this.handleKeyDownAction(binding, event, timestamp);
    } else {
      if (this.isStatefulAction(binding)) {
        this.keyStates.delete(event.code);
      }
      this.handleKeyUpAction(binding, timestamp);
    }
  }

  private handleMovementKeyDown(dir: -1 | 1, timestamp?: number): void {
    const tMs = timestamp ?? (fromNow() as number);
    const currentDirection = this.dasService.getState().context.direction;

    // If opposite direction is held, stop current direction
    if (currentDirection !== undefined && currentDirection !== dir) {
      const actions = this.dasService.send({
        direction: currentDirection,
        timestamp: tMs,
        type: "KEY_UP",
      });
      this.processActions(actions);
    }

    // Start new direction
    const actions = this.dasService.send({
      direction: dir,
      timestamp: tMs,
      type: "KEY_DOWN",
    });
    this.processActions(actions);
  }

  private handleMovementKeyUp(dir: -1 | 1, timestamp?: number): void {
    const tMs = timestamp ?? (fromNow() as number);
    const currentDirection = this.dasService.getState().context.direction;

    if (currentDirection === dir) {
      // Check if any codes for the same binding remain pressed
      const currentBinding: BindableAction =
        dir === -1 ? "MoveLeft" : "MoveRight";
      const remainingPressed = this.bindings[currentBinding].some(
        (code) => this.keyStates.get(code) === true,
      );

      // Only send KEY_UP if all codes for this direction are released
      if (!remainingPressed) {
        const actions = this.dasService.send({
          direction: dir,
          timestamp: tMs,
          type: "KEY_UP",
        });
        this.processActions(actions);

        // Check if opposite key is still held and handle it
        this.checkAndHandleOppositeKey(dir, tMs);
      }
    }
  }

  private checkAndHandleOppositeKey(dir: -1 | 1, tMs: number): void {
    const oppositeDir: -1 | 1 = dir === -1 ? 1 : -1;
    const oppositeBinding: BindableAction =
      oppositeDir === -1 ? "MoveLeft" : "MoveRight";

    // Check all codes for the opposite binding
    for (const code of this.bindings[oppositeBinding]) {
      if (this.keyStates.get(code) === true) {
        const newActions = this.dasService.send({
          direction: oppositeDir,
          timestamp: tMs,
          type: "KEY_DOWN",
        });
        this.processActions(newActions);
        break;
      }
    }
  }

  private processActions(actions: Array<Action>): void {
    if (!this.dispatch) return;

    for (const action of actions) {
      // For TapMove/HoldMove/RepeatMove: dispatch directly
      if (
        action.type === "TapMove" ||
        action.type === "HoldMove" ||
        action.type === "RepeatMove"
      ) {
        // Actions already have timestamps from DAS machine
        this.dispatch(action);
      } else if (action.type === "HoldStart") {
        // HoldStart is currently ignored and will be handled in a future phase
      } else {
        // Dispatch other actions directly
        this.dispatch(action);
      }
    }
  }
}
