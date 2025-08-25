import type { Action, GameState } from "../state/types";
import type { InputHandler, InputHandlerState } from "./handler";
import type { KeyBindings, BindableAction } from "./keyboard";
import {
  defaultKeyBindings,
  loadBindingsFromStorage,
  saveBindingsToStorage,
} from "./keyboard";
import { DASMachineService } from "./machines/das";
import { fromNow, createTimestamp } from "../types/timestamp";
import tinykeys from "tinykeys";

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

  // TinyKeys unsubscribe functions
  private tinyKeysUnsubDown?: () => void;
  private tinyKeysUnsubUp?: () => void;
  
  // Bound event handlers for cleanup
  private resetAllInputsBound = this.resetAllInputs.bind(this);
  private onVisibilityChangeBound = this.onVisibilityChange.bind(this);

  constructor(dasMs = 133, arrMs = 2) {
    this.dasService = new DASMachineService({
      direction: undefined,
      dasStartTime: undefined,
      arrLastTime: undefined,
      dasMs,
      arrMs,
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

    // Register TinyKeys bindings
    const downBindings = this.buildDownBindings();
    const upBindings = this.buildUpBindings();
    this.tinyKeysUnsubDown = tinykeys(window, downBindings);
    this.tinyKeysUnsubUp = tinykeys(window, upBindings, { event: 'keyup' });
    
    // Add safety event listeners for focus loss
    window.addEventListener('blur', this.resetAllInputsBound);
    document.addEventListener('visibilitychange', this.onVisibilityChangeBound);
  }

  stop(): void {
    this.tinyKeysUnsubDown?.();
    this.tinyKeysUnsubUp?.();
    this.tinyKeysUnsubDown = this.tinyKeysUnsubUp = undefined;
    
    // Remove safety event listeners
    window.removeEventListener('blur', this.resetAllInputsBound);
    document.removeEventListener('visibilitychange', this.onVisibilityChangeBound);
    
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
    if (gameState.timing) {
      const { dasMs, arrMs } = gameState.timing;
      if (this.lastDasMs !== dasMs || this.lastArrMs !== arrMs) {
        this.dasService.updateConfig(dasMs, arrMs);
        this.lastDasMs = dasMs;
        this.lastArrMs = arrMs;
      }
    }

    // Send timer tick to DAS machine if a direction is active
    if (this.dasService.getState().context.direction !== undefined) {
      const actions = this.dasService.send({
        type: "TIMER_TICK",
        timestamp: nowMs,
      });

      this.processActions(actions);
    }

    // Handle soft drop repeat pulses
    if (this.isSoftDropDown && gameState.timing?.softDrop !== "infinite") {
      const gravityMs = gameState.timing?.gravityMs || 1000;
      const softDropMultiplier =
        typeof gameState.timing?.softDrop === "number"
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
        this.dispatch({ type: "SoftDrop", on: true });

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
      isLeftKeyDown: state.direction === -1,
      isRightKeyDown: state.direction === 1,
      isSoftDropDown: this.isSoftDropDown,
      dasStartTime: state.dasStartTime,
      arrLastTime: state.arrLastTime,
      currentDirection: state.direction,
      softDropLastTime: this.softDropLastTime,
    };
  }

  setKeyBindings(bindings: KeyBindings): void {
    this.bindings = { ...bindings };
    saveBindingsToStorage(bindings);
    
    // Clear key states to prevent stale state from old bindings
    this.keyStates.clear();
    
    // Rebuild TinyKeys bindings if currently active
    if (this.tinyKeysUnsubDown || this.tinyKeysUnsubUp) {
      this.tinyKeysUnsubDown?.();
      this.tinyKeysUnsubUp?.();
      const downBindings = this.buildDownBindings();
      const upBindings = this.buildUpBindings();
      this.tinyKeysUnsubDown = tinykeys(window, downBindings);
      this.tinyKeysUnsubUp = tinykeys(window, upBindings, { event: 'keyup' });
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
      this.dispatch({ type: "SoftDrop", on: true });
    } else {
      this.dispatch({ type: "SoftDrop", on: false });
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

    // Guard against repeated KEY_DOWN for same direction
    if (this.dasService.getState().context.direction === direction) {
      return;
    }

    // For keyboard events, check for multiple keys bound to same action
    const codes = this.bindings[keyBinding];
    const anotherDown = codes.some((c) => this.keyStates.get(c));

    if (
      this.dasService.getState().context.direction === direction &&
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
    
    for (const [action, keyCodes] of Object.entries(this.bindings) as [BindableAction, string[]][]) {
      for (const keyCode of keyCodes) {
        bindings[keyCode] = (event: KeyboardEvent) => {
          this.handleKeyEvent(action, 'down', event);
        };
      }
    }
    
    return bindings;
  }
  
  private buildUpBindings(): Record<string, (event: KeyboardEvent) => void> {
    const bindings: Record<string, (event: KeyboardEvent) => void> = {};
    
    // Only bind keyup for actions that need release handling
    const upActions: BindableAction[] = ['MoveLeft', 'MoveRight', 'SoftDrop'];
    
    for (const [action, keyCodes] of Object.entries(this.bindings) as [BindableAction, string[]][]) {
      if (upActions.includes(action)) {
        for (const keyCode of keyCodes) {
          bindings[keyCode] = (event: KeyboardEvent) => {
            this.handleKeyEvent(action, 'up', event);
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
      this.dasService.send({ type: 'KEY_UP', direction: dir, timestamp: t });
    }
    
    // Clear soft drop
    if (this.isSoftDropDown) {
      this.dispatch?.({ type: 'SoftDrop', on: false });
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

  private handleKeyEvent(binding: BindableAction, phase: 'down' | 'up', event: KeyboardEvent): void {
    if (!this.dispatch) return;

    // Check if gameplay is blocked
    const blocked = document.body.classList.contains('settings-open') ||
                    (this.currentGameState && this.currentGameState.status !== 'playing');
    
    if (blocked) {
      // Always process releases even when blocked to prevent stuck inputs
      if (phase === 'up') {
        this.keyStates.delete(event.code);
        const t = fromNow() as number;
        if (binding === 'MoveLeft' || binding === 'MoveRight') {
          this.handleMovementUp(binding, t);
        }
        if (binding === 'SoftDrop') {
          this.dispatch?.({ type: 'SoftDrop', on: false });
          this.isSoftDropDown = false;
        }
      }
      return;
    }

    event.preventDefault();

    const timestamp = fromNow() as number;

    if (phase === 'down') {
      // Ignore repeats
      if (event.repeat) return;
      if (this.keyStates.get(event.code)) return;

      this.keyStates.set(event.code, true);

      // Handle different key types
      switch (binding) {
        case "MoveLeft": {
          this.handleMovementDown(binding, timestamp);
          break;
        }

        case "MoveRight": {
          this.handleMovementDown(binding, timestamp);
          break;
        }

        case "RotateCW":
          this.dispatch({ type: "Rotate", dir: "CW" });
          break;

        case "RotateCCW":
          this.dispatch({ type: "Rotate", dir: "CCW" });
          break;

        case "HardDrop":
          this.dispatch({
            type: "HardDrop",
            timestampMs: createTimestamp(timestamp),
          });
          break;

        case "Hold":
          this.dispatch({ type: "Hold" });
          break;

        case "SoftDrop":
          this.dispatch({ type: "SoftDrop", on: true });
          this.isSoftDropDown = true;
          this.softDropLastTime = timestamp;
          break;
      }
    } else {
      // Handle key releases
      this.keyStates.delete(event.code);

      switch (binding) {
        case "MoveLeft":
          this.handleMovementUp(binding, timestamp);
          break;

        case "MoveRight":
          this.handleMovementUp(binding, timestamp);
          break;

        case "SoftDrop":
          this.dispatch({ type: "SoftDrop", on: false });
          this.isSoftDropDown = false;
          break;
      }
    }
  }

  private handleMovementKeyDown(dir: -1 | 1, timestamp?: number): void {
    const tMs = timestamp ?? (fromNow() as number);
    const currentDirection = this.dasService.getState().context.direction;

    // If opposite direction is held, stop current direction
    if (currentDirection !== undefined && currentDirection !== dir) {
      const actions = this.dasService.send({
        type: "KEY_UP",
        direction: currentDirection,
        timestamp: tMs,
      });
      this.processActions(actions);
    }

    // Start new direction
    const actions = this.dasService.send({
      type: "KEY_DOWN",
      direction: dir,
      timestamp: tMs,
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
      const remainingPressed = this.bindings[currentBinding].some((code) =>
        this.keyStates.get(code),
      );

      // Only send KEY_UP if all codes for this direction are released
      if (!remainingPressed) {
        const actions = this.dasService.send({
          type: "KEY_UP",
          direction: dir,
          timestamp: tMs,
        });
        this.processActions(actions);

        // Check if opposite key is still held
        const oppositeDir: -1 | 1 = dir === -1 ? 1 : -1;
        const oppositeBinding: BindableAction =
          oppositeDir === -1 ? "MoveLeft" : "MoveRight";

        // Check all codes for the opposite binding
        for (const code of this.bindings[oppositeBinding]) {
          if (this.keyStates.get(code)) {
            const newActions = this.dasService.send({
              type: "KEY_DOWN",
              direction: oppositeDir,
              timestamp: tMs,
            });
            this.processActions(newActions);
            break;
          }
        }
      }
    }
  }

  private processActions(actions: Action[]): void {
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
