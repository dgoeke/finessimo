import {
  shouldProcessInCurrentState,
  shouldProcessRotate,
  shouldProcessHardDrop,
  shouldProcessSoftDrop,
  createSoftDropState,
  createProcessedRotate,
  createProcessedHardDrop,
  createProcessedSoftDrop,
  type SoftDropState,
} from "../finesse/log";
import {
  type Action,
  type KeyAction,
  type InputEvent,
  type GameState,
  type ProcessedAction,
} from "../state/types";
import { createFrame } from "../types/brands";
import { fromNow, createTimestamp, type Timestamp } from "../types/timestamp";
import { getBoardFrame } from "../ui/utils/dom";

import { type InputHandler, type InputHandlerState } from "./handler";
import { type KeyBindings, defaultKeyBindings } from "./keyboard";
import { type StateMachineInputHandler } from "./StateMachineInputHandler";

type TouchZone = {
  element: HTMLElement;
  action: KeyAction;
  type: "tap" | "hold" | "swipe";
};

export class TouchInputHandler implements InputHandler {
  private dispatch?: (action: Action) => void;
  private frameCounter = 0;
  private touchZones: Array<TouchZone> = [];
  private container?: HTMLElement | undefined;
  private started = false;
  private keyBindings: KeyBindings = defaultKeyBindings();
  private stateMachineInputHandler?: StateMachineInputHandler;
  private currentGameState?: GameState;
  private softDropState: SoftDropState = createSoftDropState();

  // Pre-bound DOM handlers to ensure removeEventListener works reliably
  private onTouchStart = (e: TouchEvent): void => this.handleTouchStart(e);
  private onTouchMove = (e: TouchEvent): void => this.handleTouchMove(e);
  private onTouchEnd = (e: TouchEvent): void => this.handleTouchEnd(e);

  // Touch gesture detection
  private activeTouches = new Map<
    number,
    {
      startX: number;
      startY: number;
      startTime: number;
      zone: TouchZone | null;
      hasTriggeredHardDrop?: boolean;
      softDropEngaged?: boolean;
    }
  >();

  private readonly minSwipeDistance = 30; // px
  private readonly quickSwipeTimeMs = 300; // ms threshold for hard drop swipe
  private readonly quickSwipeDistance = 50; // px for hard drop swipe
  private readonly maxTapTime = 200; // ms

  init(dispatch: (action: Action) => void): void {
    this.dispatch = dispatch;
  }

  start(): void {
    if (this.started) return;
    this.createTouchControls();
    this.bindTouchEvents();
    this.started = true;
  }

  stop(): void {
    if (!this.started) return;
    // Unbind before removing the node so we have a container reference
    this.unbindTouchEvents();
    this.removeTouchControls();
    this.started = false;
  }

  update(
    gameState: GameState,
    nowMs: number,
    skipStateMachineUpdate = false,
  ): void {
    if (!this.dispatch) return;
    this.frameCounter++;

    // Store current game state for use in handlers
    this.currentGameState = gameState;

    // Call state machine handler update for timing-based actions like DAS/ARR and soft drop pulses
    // Skip if keyboard handler is also present to avoid double-calls
    if (this.stateMachineInputHandler && !skipStateMachineUpdate) {
      this.stateMachineInputHandler.update(gameState, nowMs);
    }
  }

  /**
   * Helper to conditionally emit ProcessedAction alongside engine action
   */
  private dispatchWithOptionalProcessed(
    action: Action,
    timestampMs?: Timestamp,
  ): void {
    if (!this.dispatch) {
      return;
    }

    // Emit processed input BEFORE engine action to avoid races with lock pipeline
    if (this.shouldEmitProcessedAction(action, timestampMs)) {
      const processedAction = this.createProcessedActionFromEngineAction(
        action,
        timestampMs,
      );
      if (processedAction) {
        this.dispatch({ entry: processedAction, type: "AppendProcessed" });
      }
    }

    // Now dispatch the engine action
    this.dispatch(action);
  }

  private shouldEmitProcessedAction(
    action: Action,
    _timestampMs?: Timestamp,
  ): boolean {
    // Only emit if we have current game state
    if (!this.currentGameState) {
      return false;
    }

    // Only emit when there's an active piece and status is "playing"
    const hasActivePiece = Boolean(this.currentGameState.active);
    const status = this.currentGameState.status;

    if (!shouldProcessInCurrentState(hasActivePiece, status)) {
      return false;
    }

    if (action.type === "Rotate") return shouldProcessRotate();
    if (action.type === "HardDrop") return shouldProcessHardDrop();
    if (action.type === "SoftDrop") {
      const [shouldProcess, newState] = shouldProcessSoftDrop(
        action.on,
        this.softDropState,
      );
      this.softDropState = newState;
      return shouldProcess;
    }
    return false;
  }

  private createProcessedActionFromEngineAction(
    action: Action,
    timestampMs?: Timestamp,
  ): ProcessedAction | null {
    const timestamp = timestampMs ?? fromNow();
    if (action.type === "Rotate")
      return createProcessedRotate(action.dir, timestamp);
    if (action.type === "HardDrop") return createProcessedHardDrop(timestamp);
    if (action.type === "SoftDrop")
      return createProcessedSoftDrop(action.on, timestamp);
    return null;
  }

  getState(): InputHandlerState {
    // Always delegate to state machine handler (required to be present)
    if (!this.stateMachineInputHandler) {
      throw new Error("StateMachineInputHandler is required but not set");
    }
    return this.stateMachineInputHandler.getState();
  }

  setKeyBindings(bindings: KeyBindings): void {
    this.keyBindings = { ...bindings };
    // Propagate key bindings to the shared state machine handler
    if (this.stateMachineInputHandler) {
      this.stateMachineInputHandler.setKeyBindings(bindings);
    }
  }

  getKeyBindings(): KeyBindings {
    return { ...this.keyBindings };
  }

  setStateMachineInputHandler(handler: StateMachineInputHandler): void {
    this.stateMachineInputHandler = handler;
  }

  private createTouchControls(): void {
    // Check if touch is supported
    if (!("ontouchstart" in window)) {
      return; // No touch support
    }

    // Create touch control overlay; scope it to the board frame on mobile
    const overlay = document.createElement("div");
    overlay.id = "touch-controls";
    overlay.className = "touch-controls-overlay scoped";
    overlay.innerHTML = `
      <div class="touch-zones">
        <!-- Top row: Rotate buttons -->
        <div class="touch-zone rotate-zone rotate-ccw" data-action="RotateCCW">
          <span class="touch-label">↶</span>
        </div>
        <div class="touch-zone rotate-zone rotate-cw" data-action="RotateCW">
          <span class="touch-label">↷</span>
        </div>
        
        <!-- Middle row: Movement zones -->
        <div class="touch-zone move-zone move-left" data-action="LeftDown">
          <span class="touch-label">←</span>
        </div>
        <div class="touch-zone move-zone move-right" data-action="RightDown">
          <span class="touch-label">→</span>
        </div>
        
        <!-- Third row: Soft drop -->
        <div class="touch-zone drop-zone soft-drop" data-action="SoftDropDown">
          <span class="touch-label">↓</span>
        </div>
        
        <!-- Bottom row: Hold and Hard Drop as transparent zones -->
        <div class="touch-zone hold" data-action="Hold">
          <span class="touch-label">H</span>
        </div>
        <div class="touch-zone hard-drop" data-action="HardDrop">
          <span class="touch-label">⤓</span>
        </div>
      </div>
    `;

    // Attach to the game board frame so it doesn't cover header or other UI
    const boardFrame = getBoardFrame();
    this.container = overlay;
    if (boardFrame) {
      boardFrame.appendChild(overlay);
    } else {
      // Fallback: attach to body (unlikely on current layout)
      document.body.appendChild(overlay);
    }

    // Initialize touch zones
    this.initializeTouchZones();
  }

  private initializeTouchZones(): void {
    if (!this.container) return;

    this.touchZones = [];
    const zones = this.container.querySelectorAll("[data-action]");

    zones.forEach((element) => {
      const action = element.getAttribute("data-action") as KeyAction;
      const type =
        element.classList.contains("move-zone") ||
        element.classList.contains("drop-zone")
          ? ("hold" as const)
          : ("tap" as const);

      this.touchZones.push({
        action,
        element: element as HTMLElement,
        type,
      });
    });
  }

  private removeTouchControls(): void {
    if (this.container?.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = undefined;
    this.touchZones = [];
  }

  private bindTouchEvents(): void {
    if (!this.container) return;

    this.container.addEventListener("touchstart", this.onTouchStart, {
      passive: true,
    });
    this.container.addEventListener("touchmove", this.onTouchMove, {
      passive: true,
    });
    this.container.addEventListener("touchend", this.onTouchEnd, {
      passive: true,
    });
    this.container.addEventListener("touchcancel", this.onTouchEnd, {
      passive: true,
    });
  }

  private unbindTouchEvents(): void {
    if (!this.container) return;

    // Only capture flag needs to match; pass false
    this.container.removeEventListener("touchstart", this.onTouchStart, false);
    this.container.removeEventListener("touchmove", this.onTouchMove, false);
    this.container.removeEventListener("touchend", this.onTouchEnd, false);
    this.container.removeEventListener("touchcancel", this.onTouchEnd, false);
  }

  private handleTouchStart(event: TouchEvent): void {
    // Ignore inputs when settings overlay is open
    if (document.body.classList.contains("settings-open")) return;

    for (const touch of Array.from(event.changedTouches)) {
      const element = document.elementFromPoint(
        touch.clientX,
        touch.clientY,
      ) as HTMLElement;
      const zone = this.findTouchZone(element);

      this.activeTouches.set(touch.identifier, {
        startTime: Date.now(),
        startX: touch.clientX,
        startY: touch.clientY,
        zone,
      });

      if (zone) {
        // Prevent default touch behavior (including double-tap zoom) on control zones
        event.preventDefault();

        // Add visual feedback
        zone.element.classList.add("active");

        // Handle immediate actions
        if (zone.type === "tap" || zone.type === "hold") {
          this.triggerAction(zone.action, "down");
        }
      }
    }
  }

  private handleTouchMove(event: TouchEvent): void {
    // Ignore inputs when settings overlay is open
    if (document.body.classList.contains("settings-open")) return;

    for (const touch of Array.from(event.changedTouches)) {
      const touchData = this.activeTouches.get(touch.identifier);
      if (touchData?.zone) {
        // Prevent default touch behavior on control zones
        event.preventDefault();
        this.processSwipeGesture(touch, touchData);
      }
    }
  }

  private processSwipeGesture(
    touch: Touch,
    touchData: {
      startX: number;
      startY: number;
      startTime: number;
      zone: TouchZone | null;
      hasTriggeredHardDrop?: boolean;
      softDropEngaged?: boolean;
    },
  ): void {
    const deltaX = touch.clientX - touchData.startX;
    const deltaY = touch.clientY - touchData.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance <= this.minSwipeDistance) return;
    if (Math.abs(deltaY) <= Math.abs(deltaX)) return;
    if (deltaY <= 0) return;

    const elapsed = Date.now() - touchData.startTime;
    this.handleVerticalSwipe(deltaY, elapsed, touchData);
  }

  private handleVerticalSwipe(
    deltaY: number,
    elapsed: number,
    touchData: {
      startX: number;
      startY: number;
      startTime: number;
      zone: TouchZone | null;
      hasTriggeredHardDrop?: boolean;
      softDropEngaged?: boolean;
    },
  ): void {
    const isQuickSwipe =
      elapsed < this.quickSwipeTimeMs && deltaY > this.quickSwipeDistance;

    if (isQuickSwipe && touchData.hasTriggeredHardDrop !== true) {
      this.triggerAction("HardDrop", "down");
      touchData.hasTriggeredHardDrop = true;
    } else if (
      touchData.softDropEngaged !== true &&
      touchData.hasTriggeredHardDrop !== true
    ) {
      this.engageSoftDrop(touchData);
    }
  }

  private engageSoftDrop(touchData: {
    startX: number;
    startY: number;
    startTime: number;
    zone: TouchZone | null;
    hasTriggeredHardDrop?: boolean;
    softDropEngaged?: boolean;
  }): void {
    if (this.stateMachineInputHandler && this.dispatch) {
      const timestamp = fromNow() as number;
      this.stateMachineInputHandler.setSoftDrop(true, timestamp);
    } else {
      this.triggerAction("SoftDropDown", "down");
    }
    touchData.softDropEngaged = true;
  }

  private handleTouchEnd(event: TouchEvent): void {
    // Ignore inputs when settings overlay is open
    if (document.body.classList.contains("settings-open")) return;

    for (const touch of Array.from(event.changedTouches)) {
      const touchData = this.activeTouches.get(touch.identifier);

      if (touchData?.zone) {
        // Prevent default touch behavior on control zones
        event.preventDefault();

        const zone = touchData.zone;
        zone.element.classList.remove("active");

        const duration = Date.now() - touchData.startTime;
        const deltaX = touch.clientX - touchData.startX;
        const deltaY = touch.clientY - touchData.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Handle touch end actions
        if (
          zone.type === "tap" &&
          duration < this.maxTapTime &&
          distance < 20
        ) {
          // Already triggered on touch start for immediate response
        } else if (zone.type === "hold") {
          // Handle release of hold actions
          this.triggerAction(zone.action, "up");
        }

        // If soft drop was engaged via swipe, turn it off on touch end
        if (touchData.softDropEngaged === true) {
          if (this.stateMachineInputHandler && this.dispatch) {
            const timestamp = fromNow() as number;
            this.stateMachineInputHandler.setSoftDrop(false, timestamp);
          } else {
            this.triggerAction("SoftDropDown", "up");
          }
        }
      }

      this.activeTouches.delete(touch.identifier);
    }
  }

  private findTouchZone(element: HTMLElement | null): TouchZone | null {
    if (!element) return null;

    // Check if element itself is a touch zone
    let current: HTMLElement | null = element;
    while (current && current !== this.container) {
      const zone = this.touchZones.find((z) => z.element === current);
      if (zone) return zone;
      current = current.parentElement;
    }

    return null;
  }

  private triggerAction(action: KeyAction, phase: "down" | "up"): void {
    if (!this.dispatch) return;
    if (document.body.classList.contains("settings-open")) return;

    const eventAction = this.mapToEventAction(action, phase);

    if (this.isMovementAction(eventAction)) {
      this.handleMovementAction(eventAction);
      return;
    }

    this.handleNonMovementAction(eventAction);
  }

  private mapToEventAction(action: KeyAction, phase: "down" | "up"): KeyAction {
    if (phase === "down") return action;

    // Map held inputs to their corresponding release actions
    const upMapping: Record<string, KeyAction> = {
      LeftDown: "LeftUp",
      RightDown: "RightUp",
      SoftDropDown: "SoftDropUp",
    };
    return upMapping[action] ?? action;
  }

  private isMovementAction(action: KeyAction): boolean {
    return ["LeftDown", "LeftUp", "RightDown", "RightUp"].includes(action);
  }

  private handleMovementAction(eventAction: KeyAction): void {
    if (this.stateMachineInputHandler) {
      const timestamp = fromNow() as number;
      // Only call handleMovement for actual movement actions
      if (
        eventAction === "LeftDown" ||
        eventAction === "LeftUp" ||
        eventAction === "RightDown" ||
        eventAction === "RightUp"
      ) {
        this.stateMachineInputHandler.handleMovement(eventAction, timestamp);
      }
    }
  }

  private handleNonMovementAction(eventAction: KeyAction): void {
    const inputEvent: InputEvent = {
      action: eventAction,
      frame: createFrame(this.frameCounter),
      tMs: fromNow(),
    };

    this.dispatchGameplayAction(eventAction, inputEvent);
  }

  private dispatchGameplayAction(
    eventAction: KeyAction,
    inputEvent: InputEvent,
  ): void {
    if (!this.dispatch) return;

    switch (eventAction) {
      case "RotateCW":
        this.dispatchWithOptionalProcessed({ dir: "CW", type: "Rotate" });
        break;
      case "RotateCCW":
        this.dispatchWithOptionalProcessed({ dir: "CCW", type: "Rotate" });
        break;
      case "HardDrop":
        this.dispatchWithOptionalProcessed(
          {
            timestampMs: createTimestamp(inputEvent.tMs),
            type: "HardDrop",
          },
          createTimestamp(inputEvent.tMs),
        );
        break;
      case "Hold":
        this.dispatch({ type: "Hold" });
        break;
      case "SoftDropDown":
        this.handleSoftDropAction(true, inputEvent.tMs);
        break;
      case "SoftDropUp":
        this.handleSoftDropAction(false, inputEvent.tMs);
        break;

      case "LeftDown":
      case "LeftUp":
      case "RightDown":
      case "RightUp":
        // Movement actions are handled by handleMovementAction, not here
        break;

      default: {
        const _exhaustiveCheck: never = eventAction;
        return _exhaustiveCheck;
      }
    }
  }

  private handleSoftDropAction(on: boolean, timestamp: number): void {
    if (this.stateMachineInputHandler) {
      this.stateMachineInputHandler.setSoftDrop(on, timestamp);
    } else if (this.dispatch) {
      this.dispatchWithOptionalProcessed({ on, type: "SoftDrop" });
    }
  }
}
