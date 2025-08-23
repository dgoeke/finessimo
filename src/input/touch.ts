import { Action, KeyAction, InputEvent, GameState } from '../state/types';
import { InputHandler, InputHandlerState, KeyBindings } from './handler';

interface TouchZone {
  element: HTMLElement;
  action: KeyAction;
  type: 'tap' | 'hold' | 'swipe';
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
    softDropLastTime: undefined
  };
  private frameCounter = 0;
  private touchZones: TouchZone[] = [];
  private container?: HTMLElement;
  
  // Touch gesture detection
  private activeTouches: Map<number, {
    startX: number;
    startY: number;
    startTime: number;
    zone: TouchZone | null;
    hasTriggeredHardDrop?: boolean;
    softDropEngaged?: boolean;
  }> = new Map();
  
  private readonly minSwipeDistance = 30; // px
  private readonly quickSwipeTimeMs = 300; // ms threshold for hard drop swipe
  private readonly quickSwipeDistance = 50; // px for hard drop swipe
  private readonly maxTapTime = 200; // ms

  init(dispatch: (action: Action) => void): void {
    this.dispatch = dispatch;
  }

  start(): void {
    this.createTouchControls();
    this.bindTouchEvents();
  }

  stop(): void {
    this.removeTouchControls();
    this.unbindTouchEvents();
  }

  update(gameState: GameState, nowMs: number): void {
    this.frameCounter++;
    const currentTime = nowMs;

    // Handle DAS/ARR timing same as keyboard handler
    if (this.state.currentDirection !== undefined && this.state.dasStartTime !== undefined) {
      const dasElapsed = currentTime - this.state.dasStartTime;
      
      if (dasElapsed >= gameState.timing.dasMs) {
        if (this.state.arrLastTime === undefined) {
          this.dispatch!({ type: 'Move', dir: this.state.currentDirection, source: 'das' });
          this.state.arrLastTime = currentTime;
        } else {
          const arrElapsed = currentTime - this.state.arrLastTime;
          if (arrElapsed >= gameState.timing.arrMs) {
            this.dispatch!({ type: 'Move', dir: this.state.currentDirection, source: 'das' });
            this.state.arrLastTime = currentTime;
          }
        }
      }
    }

    // Handle soft drop repeat
    if (this.state.isSoftDropDown) {
      const interval = Math.max(1, Math.floor(1000 / Math.max(1, gameState.timing.softDropCps)));
      if (
        this.state.softDropLastTime === undefined ||
        currentTime - this.state.softDropLastTime >= interval
      ) {
        this.dispatch!({ type: 'SoftDrop', on: true });
        this.state.softDropLastTime = currentTime;
      }
    }
  }

  getState(): InputHandlerState {
    return { ...this.state };
  }

  // Touch handler ignores keyboard bindings but must satisfy interface
  setKeyBindings(_bindings: KeyBindings): void {
    // no-op for touch
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
      Hold: []
    };
  }

  private createTouchControls(): void {
    // Check if touch is supported
    if (!('ontouchstart' in window)) {
      return; // No touch support
    }

    // Create touch control overlay; scope it to the board frame on mobile
    const overlay = document.createElement('div');
    overlay.id = 'touch-controls';
    overlay.className = 'touch-controls-overlay scoped';
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
    const boardFrame = document.querySelector('.board-frame');
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
    const zones = this.container.querySelectorAll('[data-action]');
    
    zones.forEach(element => {
      const action = element.getAttribute('data-action') as KeyAction;
      const type = element.classList.contains('move-zone') || element.classList.contains('drop-zone')
        ? 'hold' as const
        : 'tap' as const;
      
      this.touchZones.push({
        element: element as HTMLElement,
        action,
        type
      });
    });
  }

  private removeTouchControls(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = undefined;
    this.touchZones = [];
  }

  private bindTouchEvents(): void {
    if (!this.container) return;

    this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.container.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.container.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });
  }

  private unbindTouchEvents(): void {
    if (!this.container) return;

    this.container.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    this.container.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    this.container.removeEventListener('touchend', this.handleTouchEnd.bind(this));
    this.container.removeEventListener('touchcancel', this.handleTouchEnd.bind(this));
  }

  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      if (!touch) continue;
      
      const element = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement;
      const zone = this.findTouchZone(element);
      
      this.activeTouches.set(touch.identifier, {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        zone
      });

      if (zone) {
        // Add visual feedback
        zone.element.classList.add('active');
        
        // Handle immediate actions
        if (zone.type === 'tap' || zone.type === 'hold') {
          this.triggerAction(zone.action, 'down');
        }
      }
    }
  }

  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      if (!touch) continue;
      
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
              const isQuickSwipe = elapsed < this.quickSwipeTimeMs && deltaY > this.quickSwipeDistance;
              if (isQuickSwipe && !touchData.hasTriggeredHardDrop) {
                // Quick downward swipe → Hard Drop (once)
                this.triggerAction('HardDrop', 'down');
                touchData.hasTriggeredHardDrop = true;
              } else if (!touchData.softDropEngaged && !touchData.hasTriggeredHardDrop) {
                // Sustained downward movement → engage Soft Drop
                this.triggerAction('SoftDropDown', 'down');
                touchData.softDropEngaged = true;
              }
            }
          }
        }
      }
    }
  }

  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      if (!touch) continue;
      
      const touchData = this.activeTouches.get(touch.identifier);
      
      if (touchData && touchData.zone) {
        const zone = touchData.zone;
        zone.element.classList.remove('active');
        
        const duration = Date.now() - touchData.startTime;
        const deltaX = touch.clientX - touchData.startX;
        const deltaY = touch.clientY - touchData.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Handle touch end actions
        if (zone.type === 'tap' && duration < this.maxTapTime && distance < 20) {
          // Already triggered on touch start for immediate response
        } else if (zone.type === 'hold') {
          // Handle release of hold actions
          this.triggerAction(zone.action, 'up');
        }

        // If soft drop was engaged via swipe, turn it off on touch end
        if (touchData.softDropEngaged) {
          this.triggerAction('SoftDropDown', 'up');
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
      const zone = this.touchZones.find(z => z.element === current);
      if (zone) return zone;
      current = current.parentElement;
    }
    
    return null;
  }

  private triggerAction(action: KeyAction, phase: 'down' | 'up'): void {
    if (!this.dispatch) return;

    const inputEvent: InputEvent = {
      tMs: Date.now(),
      frame: this.frameCounter,
      action
    };

    this.dispatch({ type: 'EnqueueInput', event: inputEvent });
    this.updateInternalState(action);

    // Dispatch game actions
    if (phase === 'down') {
      switch (action) {
        case 'LeftDown':
          this.dispatch({ type: 'Move', dir: -1, source: 'tap' });
          break;
        case 'RightDown':
          this.dispatch({ type: 'Move', dir: 1, source: 'tap' });
          break;
        case 'RotateCW':
          this.dispatch({ type: 'Rotate', dir: 'CW' });
          break;
        case 'RotateCCW':
          this.dispatch({ type: 'Rotate', dir: 'CCW' });
          break;
        case 'HardDrop':
          this.dispatch({ type: 'HardDrop' });
          break;
        case 'Hold':
          this.dispatch({ type: 'Hold' });
          break;
        case 'SoftDropDown':
          this.dispatch({ type: 'SoftDrop', on: true });
          break;
      }
    } else if (phase === 'up') {
      switch (action) {
        case 'LeftDown':
          this.updateInternalState('LeftUp');
          break;
        case 'RightDown':
          this.updateInternalState('RightUp');
          break;
        case 'SoftDropDown':
          this.dispatch({ type: 'SoftDrop', on: false });
          this.updateInternalState('SoftDropUp');
          break;
      }
    }
  }

  private updateInternalState(action: KeyAction): void {
    const currentTime = Date.now();

    switch (action) {
      case 'LeftDown':
        this.state.isLeftKeyDown = true;
        this.state.currentDirection = -1;
        this.state.dasStartTime = currentTime;
        this.state.arrLastTime = undefined;
        break;
      case 'LeftUp':
        this.state.isLeftKeyDown = false;
        if (this.state.currentDirection === -1) {
          this.state.currentDirection = this.state.isRightKeyDown ? 1 : undefined;
          if (this.state.currentDirection === 1) {
            this.state.dasStartTime = currentTime;
          } else {
            this.state.dasStartTime = undefined;
          }
          this.state.arrLastTime = undefined;
        }
        break;
      case 'RightDown':
        this.state.isRightKeyDown = true;
        this.state.currentDirection = 1;
        this.state.dasStartTime = currentTime;
        this.state.arrLastTime = undefined;
        break;
      case 'RightUp':
        this.state.isRightKeyDown = false;
        if (this.state.currentDirection === 1) {
          this.state.currentDirection = this.state.isLeftKeyDown ? -1 : undefined;
          if (this.state.currentDirection === -1) {
            this.state.dasStartTime = currentTime;
          } else {
            this.state.dasStartTime = undefined;
          }
          this.state.arrLastTime = undefined;
        }
        break;
      case 'SoftDropDown':
        this.state.isSoftDropDown = true;
        this.state.softDropLastTime = currentTime;
        break;
      case 'SoftDropUp':
        this.state.isSoftDropDown = false;
        this.state.softDropLastTime = undefined;
        break;
    }
  }
}
