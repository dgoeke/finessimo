import type { Action, GameState } from "../state/types";
import type {
  InputHandler,
  InputHandlerState,
  ProcessedAction,
} from "./handler";
import type { KeyBindings, BindableAction } from "./keyboard";
import {
  defaultKeyBindings,
  mapKeyToBinding,
  loadBindingsFromStorage,
  saveBindingsToStorage,
} from "./keyboard";
import { DASMachineService } from "./machines/das";
import { fromNow, createTimestamp } from "../types/timestamp";

export class StateMachineInputHandler implements InputHandler {
  private dispatch: ((action: Action) => void) | null = null;
  private bindings: KeyBindings = defaultKeyBindings();
  private keyStates = new Map<string, boolean>();
  private dasService: DASMachineService;
  private frameCount = 0;
  private isSoftDropDown = false;
  private softDropLastTime: number | undefined;

  // Pre-bound handlers for event listeners
  private boundKeyDownHandler = this.handleKeyDown.bind(this);
  private boundKeyUpHandler = this.handleKeyUp.bind(this);

  constructor(dasMs = 150, arrMs = 30) {
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
    this.frameCount = 0;
    this.keyStates.clear();
    this.isSoftDropDown = false;
    this.softDropLastTime = undefined;
    this.dasService.reset();

    document.addEventListener("keydown", this.boundKeyDownHandler);
    document.addEventListener("keyup", this.boundKeyUpHandler);
  }

  stop(): void {
    document.removeEventListener("keydown", this.boundKeyDownHandler);
    document.removeEventListener("keyup", this.boundKeyUpHandler);
    this.dasService.reset();
  }

  update(gameState: GameState, nowMs: number): void {
    if (!this.dispatch) return;

    if (gameState.status !== "playing") {
      return;
    }

    this.frameCount++;

    // Update DAS timing from game state
    if (gameState.timing) {
      this.dasService.updateConfig(
        gameState.timing.dasMs,
        gameState.timing.arrMs,
      );
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
        this.logProcessedAction({
          action: { type: "SoftDrop", on: true },
          timestamp: nextTime,
        });

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
  }

  getKeyBindings(): KeyBindings {
    return { ...this.bindings };
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.dispatch) return;

    // Ignore inputs when settings overlay is open
    if (document.body.classList.contains("settings-open")) return;

    const keyBinding = mapKeyToBinding(event.code, this.bindings);
    if (!keyBinding) return;

    event.preventDefault();

    // Ignore repeats
    if (event.repeat) return;
    if (this.keyStates.get(event.code)) return;

    this.keyStates.set(event.code, true);

    const timestamp = fromNow() as number;

    // Handle different key types
    switch (keyBinding) {
      case "MoveLeft": {
        this.dispatch({
          type: "EnqueueInput",
          event: { tMs: timestamp, frame: this.frameCount, action: "LeftDown" },
        });
        const leftCodes = this.bindings[keyBinding];
        const leftAnotherDown = leftCodes.some(
          (c) => c !== event.code && this.keyStates.get(c),
        );
        if (
          this.dasService.getState().context.direction === -1 &&
          leftAnotherDown
        )
          return;
        this.handleMovementKeyDown(-1);
        break;
      }

      case "MoveRight": {
        this.dispatch({
          type: "EnqueueInput",
          event: {
            tMs: timestamp,
            frame: this.frameCount,
            action: "RightDown",
          },
        });
        const rightCodes = this.bindings[keyBinding];
        const rightAnotherDown = rightCodes.some(
          (c) => c !== event.code && this.keyStates.get(c),
        );
        if (
          this.dasService.getState().context.direction === 1 &&
          rightAnotherDown
        )
          return;
        this.handleMovementKeyDown(1);
        break;
      }

      case "RotateCW":
        this.dispatch({
          type: "EnqueueInput",
          event: { tMs: timestamp, frame: this.frameCount, action: "RotateCW" },
        });
        this.logProcessedAction({
          action: { type: "Rotate", dir: "CW" },
          timestamp,
        });
        break;

      case "RotateCCW":
        this.dispatch({
          type: "EnqueueInput",
          event: {
            tMs: timestamp,
            frame: this.frameCount,
            action: "RotateCCW",
          },
        });
        this.logProcessedAction({
          action: { type: "Rotate", dir: "CCW" },
          timestamp,
        });
        break;

      case "HardDrop":
        this.dispatch({
          type: "EnqueueInput",
          event: { tMs: timestamp, frame: this.frameCount, action: "HardDrop" },
        });
        this.logProcessedAction({
          action: { type: "HardDrop", timestampMs: createTimestamp(timestamp) },
          timestamp,
        });
        break;

      case "Hold":
        this.dispatch({
          type: "EnqueueInput",
          event: { tMs: timestamp, frame: this.frameCount, action: "Hold" },
        });
        this.logProcessedAction({
          action: { type: "Hold" },
          timestamp,
        });
        break;

      case "SoftDrop":
        this.dispatch({
          type: "EnqueueInput",
          event: {
            tMs: timestamp,
            frame: this.frameCount,
            action: "SoftDropDown",
          },
        });
        this.dispatch({ type: "SoftDrop", on: true });
        this.logProcessedAction({
          action: { type: "SoftDrop", on: true },
          timestamp,
        });
        this.isSoftDropDown = true;
        this.softDropLastTime = timestamp;
        break;
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (!this.dispatch) return;

    // Ignore inputs when settings overlay is open
    if (document.body.classList.contains("settings-open")) return;

    const keyBinding = mapKeyToBinding(event.code, this.bindings);
    if (!keyBinding) return;

    event.preventDefault();
    this.keyStates.delete(event.code);

    const timestamp = fromNow() as number;

    // Handle key releases
    switch (keyBinding) {
      case "MoveLeft":
        this.dispatch({
          type: "EnqueueInput",
          event: { tMs: timestamp, frame: this.frameCount, action: "LeftUp" },
        });
        this.handleMovementKeyUp(-1);
        break;

      case "MoveRight":
        this.dispatch({
          type: "EnqueueInput",
          event: { tMs: timestamp, frame: this.frameCount, action: "RightUp" },
        });
        this.handleMovementKeyUp(1);
        break;

      case "SoftDrop":
        this.dispatch({
          type: "EnqueueInput",
          event: {
            tMs: timestamp,
            frame: this.frameCount,
            action: "SoftDropUp",
          },
        });
        this.dispatch({ type: "SoftDrop", on: false });
        this.logProcessedAction({
          action: { type: "SoftDrop", on: false },
          timestamp,
        });
        this.isSoftDropDown = false;
        break;
    }
  }

  private handleMovementKeyDown(dir: -1 | 1): void {
    const timestamp = fromNow() as number;
    const currentDirection = this.dasService.getState().context.direction;

    // If opposite direction is held, stop current direction
    if (currentDirection !== undefined && currentDirection !== dir) {
      const actions = this.dasService.send({
        type: "KEY_UP",
        direction: currentDirection,
        timestamp,
      });
      this.processActions(actions);
    }

    // Start new direction
    const actions = this.dasService.send({
      type: "KEY_DOWN",
      direction: dir,
      timestamp,
    });
    this.processActions(actions);
  }

  private handleMovementKeyUp(dir: -1 | 1): void {
    const timestamp = fromNow() as number;
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
          timestamp,
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
              timestamp,
            });
            this.processActions(newActions);
            break;
          }
        }
      }
    }
  }

  private processActions(actions: ProcessedAction[]): void {
    if (!this.dispatch) return;

    for (const processedAction of actions) {
      // The DAS machine now emits the specific action types directly
      const action = processedAction.action;

      // For TapMove/HoldMove/RepeatMove: log the original classified action first, then legacy mirror
      if (
        action.type === "TapMove" ||
        action.type === "HoldMove" ||
        action.type === "RepeatMove"
      ) {
        // Log the original classified processed action
        this.logProcessedAction(processedAction);

        const source = action.type === "TapMove" ? "tap" : "das";

        // Log the legacy mirror ProcessedAction for backward compatibility
        this.logProcessedAction({
          action: {
            type: "Move",
            dir: action.dir,
            source,
          },
          timestamp: processedAction.timestamp,
        });
      } else if (action.type === "HoldStart") {
        // HoldStart is only logged for analytics, not dispatched to reducer
        this.logProcessedAction(processedAction);
      } else {
        // Dispatch non-move actions directly
        this.dispatch(action);
      }
    }
  }

  private logProcessedAction(action: ProcessedAction): void {
    if (!this.dispatch) return;

    this.dispatch({
      type: "EnqueueProcessedInput",
      processedAction: action,
    });
  }
}
