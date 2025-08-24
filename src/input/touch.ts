import { Action, KeyAction, InputEvent, GameState } from "../state/types";
import { InputHandler, InputHandlerState, KeyBindings } from "./handler";
import { fromNow } from "../types/timestamp";

interface TouchZone {
  element: HTMLElement;
  action: KeyAction;
  type: "tap" | "hold" | "swipe";
}

export class TouchInputHandler implements InputHandler {
  private dispatch?: (action: Action) => void;
  private state: InputHandlerState = {
    isLeftKeyDown: false,
    isRightKeyDown: false,
    isSoftDropDown: false,
    dasStartTime: undefined,
    arrLastTime: undefined,
    currentDirection: undefined,
    softDropLastTime: undefined,
  };
  private frameCounter = 0;
  private touchZones: TouchZone[] = [];
  private container?: HTMLElement;
  private started = false;

  // Pre-bound DOM handlers to ensure removeEventListener works reliably
  private onTouchStart = (e: TouchEvent) => this.handleTouchStart(e);
  private onTouchMove = (e: TouchEvent) => this.handleTouchMove(e);
  private onTouchEnd = (e: TouchEvent) => this.handleTouchEnd(e);

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

  update(gameState: GameState, nowMs: number): void {
    const dispatch = this.dispatch;
    if (!dispatch) return;
    this.frameCounter++;
    const currentTime = nowMs;

    // Handle DAS/ARR timing same as keyboard handler
    if (
      this.state.currentDirection !== undefined &&
      this.state.dasStartTime !== undefined
    ) {
      const dasElapsed = currentTime - this.state.dasStartTime;

      if (dasElapsed >= gameState.timing.dasMs) {
        const arrMs = Math.max(1, gameState.timing.arrMs);
        let nextTime =
          this.state.arrLastTime !== undefined
            ? this.state.arrLastTime + arrMs
            : this.state.dasStartTime + gameState.timing.dasMs;
        let pulses = 0;
        const MAX_PULSES_PER_UPDATE = 200;
        while (nextTime <= currentTime && pulses < MAX_PULSES_PER_UPDATE) {
          dispatch({
            type: "Move",
            dir: this.state.currentDirection,
            source: "das",
          });
          this.state.arrLastTime = nextTime;
          nextTime += arrMs;
          pulses++;
        }
      }
    }

    // Handle soft drop repeat (finite speeds only) with catch-up pulses
    if (this.state.isSoftDropDown) {
      if (gameState.timing.softDrop !== "infinite") {
        const interval = Math.max(
          1,
          Math.floor(
            gameState.timing.gravityMs / Math.max(1, gameState.timing.softDrop),
          ),
        );
        let nextTime =
          this.state.softDropLastTime !== undefined
            ? this.state.softDropLastTime + interval
            : currentTime;
        let pulses = 0;
        const MAX_PULSES_PER_UPDATE = 200;
        while (nextTime <= currentTime && pulses < MAX_PULSES_PER_UPDATE) {
          dispatch({ type: "SoftDrop", on: true });
          this.state.softDropLastTime = nextTime;
          nextTime += interval;
          pulses++;
        }
      }
    }
  }

  getState(): InputHandlerState {
    return { ...this.state };
  }

  // Touch handler ignores keyboard bindings but must satisfy interface
  setKeyBindings(_bindings: KeyBindings): void {
    // no-op for touch
    void _bindings;
  }
  getKeyBindings(): KeyBindings {
    // Not applicable; return empty bindings
    return {
      MoveLeft: [],
      MoveRight: [],
      SoftDrop: [],
      HardDrop: [],
      RotateCW: [],
      RotateCCW: [],
      Hold: [],
    };
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
    const boardFrame = document.querySelector(".board-frame");
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
        element: element as HTMLElement,
        action,
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
    for (const touch of Array.from(event.changedTouches)) {
      const element = document.elementFromPoint(
        touch.clientX,
        touch.clientY,
      ) as HTMLElement;
      const zone = this.findTouchZone(element);

      this.activeTouches.set(touch.identifier, {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        zone,
      });

      if (zone) {
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
    for (const touch of Array.from(event.changedTouches)) {
      const touchData = this.activeTouches.get(touch.identifier);

      if (touchData) {
        const deltaX = touch.clientX - touchData.startX;
        const deltaY = touch.clientY - touchData.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // Check for swipe gestures
        if (distance > this.minSwipeDistance) {
          // Treat vertical swipes anywhere on overlay
          if (Math.abs(deltaY) > Math.abs(deltaX)) {
            if (deltaY > 0) {
              const elapsed = Date.now() - touchData.startTime;
              const isQuickSwipe =
                elapsed < this.quickSwipeTimeMs &&
                deltaY > this.quickSwipeDistance;
              if (isQuickSwipe && !touchData.hasTriggeredHardDrop) {
                // Quick downward swipe → Hard Drop (once)
                this.triggerAction("HardDrop", "down");
                touchData.hasTriggeredHardDrop = true;
              } else if (
                !touchData.softDropEngaged &&
                !touchData.hasTriggeredHardDrop
              ) {
                // Sustained downward movement → engage Soft Drop
                this.triggerAction("SoftDropDown", "down");
                touchData.softDropEngaged = true;
              }
            }
          }
        }
      }
    }
  }

  private handleTouchEnd(event: TouchEvent): void {
    for (const touch of Array.from(event.changedTouches)) {
      const touchData = this.activeTouches.get(touch.identifier);

      if (touchData?.zone) {
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
        if (touchData.softDropEngaged) {
          this.triggerAction("SoftDropDown", "up");
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

    // Determine the logical input to record and state transition to apply
    let eventAction: KeyAction = action;
    let stateAction: KeyAction = action;

    if (phase === "up") {
      // Map held inputs to their corresponding release actions
      if (action === "LeftDown") {
        eventAction = "LeftUp";
        stateAction = "LeftUp";
      } else if (action === "RightDown") {
        eventAction = "RightUp";
        stateAction = "RightUp";
      } else if (action === "SoftDropDown") {
        eventAction = "SoftDropUp";
        stateAction = "SoftDropUp";
      }
    }

    const inputEvent: InputEvent = {
      tMs: performance.now(),
      frame: this.frameCounter,
      action: eventAction,
    };

    this.dispatch({ type: "EnqueueInput", event: inputEvent });
    this.updateInternalState(stateAction);

    // Dispatch game actions on press and releases that affect physics
    if (phase === "down") {
      switch (action) {
        case "LeftDown":
          this.dispatch({ type: "Move", dir: -1, source: "tap" });
          break;
        case "RightDown":
          this.dispatch({ type: "Move", dir: 1, source: "tap" });
          break;
        case "RotateCW":
          this.dispatch({ type: "Rotate", dir: "CW" });
          break;
        case "RotateCCW":
          this.dispatch({ type: "Rotate", dir: "CCW" });
          break;
        case "HardDrop":
          // Use currentTimestamp() for game timing consistency
          this.dispatch({ type: "HardDrop", timestampMs: fromNow() });
          break;
        case "Hold":
          this.dispatch({ type: "Hold" });
          break;
        case "SoftDropDown":
          this.dispatch({ type: "SoftDrop", on: true });
          break;
      }
    } else if (phase === "up") {
      switch (eventAction) {
        case "SoftDropUp":
          this.dispatch({ type: "SoftDrop", on: false });
          break;
        // LeftUp/RightUp only change internal DAS state; no immediate action
      }
    }
  }

  private updateInternalState(action: KeyAction): void {
    // Use performance.now() to match the timebase used in update(nowMs)
    const currentTime = performance.now();

    switch (action) {
      case "LeftDown":
        this.state.isLeftKeyDown = true;
        this.state.currentDirection = -1;
        this.state.dasStartTime = currentTime;
        this.state.arrLastTime = undefined;
        break;
      case "LeftUp":
        this.state.isLeftKeyDown = false;
        if (this.state.currentDirection === -1) {
          this.state.currentDirection = this.state.isRightKeyDown
            ? 1
            : undefined;
          if (this.state.currentDirection === 1) {
            this.state.dasStartTime = currentTime;
          } else {
            this.state.dasStartTime = undefined;
          }
          this.state.arrLastTime = undefined;
        }
        break;
      case "RightDown":
        this.state.isRightKeyDown = true;
        this.state.currentDirection = 1;
        this.state.dasStartTime = currentTime;
        this.state.arrLastTime = undefined;
        break;
      case "RightUp":
        this.state.isRightKeyDown = false;
        if (this.state.currentDirection === 1) {
          this.state.currentDirection = this.state.isLeftKeyDown
            ? -1
            : undefined;
          if (this.state.currentDirection === -1) {
            this.state.dasStartTime = currentTime;
          } else {
            this.state.dasStartTime = undefined;
          }
          this.state.arrLastTime = undefined;
        }
        break;
      case "SoftDropDown":
        this.state.isSoftDropDown = true;
        this.state.softDropLastTime = currentTime;
        break;
      case "SoftDropUp":
        this.state.isSoftDropDown = false;
        this.state.softDropLastTime = undefined;
        break;
    }
  }
}
