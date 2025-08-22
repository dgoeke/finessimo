import { GameState, Action } from '../state/types';

export interface HudRenderer {
  initialize(container: HTMLElement): void;
  render(gameState: GameState): void;
  destroy(): void;
}

export class BasicHudRenderer implements HudRenderer {
  private container: HTMLElement | undefined;
  private elements: { [key: string]: HTMLElement } = {};
  
  initialize(container: HTMLElement): void {
    this.container = container;
    this.createElements();
    console.log('BasicHudRenderer initialized');
  }

  render(gameState: GameState): void {
    if (!this.container) {
      console.error('HUD not initialized');
      return;
    }

    // Update status
    const statusEl = this.elements.status;
    if (statusEl) statusEl.textContent = `Status: ${gameState.status}`;
    
    // Update tick
    const tickEl = this.elements.tick;
    if (tickEl) tickEl.textContent = `Tick: ${gameState.tick}`;
    
    // Update active piece
    const activePieceEl = this.elements.activePiece;
    if (activePieceEl) {
      activePieceEl.textContent = gameState.active 
        ? `Active: ${gameState.active.id} (${gameState.active.x}, ${gameState.active.y}, ${gameState.active.rot})`
        : 'Active: None';
    }
    
    // Update hold piece
    const holdPieceEl = this.elements.holdPiece;
    if (holdPieceEl) {
      holdPieceEl.textContent = gameState.hold 
        ? `Hold: ${gameState.hold}` 
        : 'Hold: None';
    }
    
    // Update can hold
    const canHoldEl = this.elements.canHold;
    if (canHoldEl) canHoldEl.textContent = `Can Hold: ${gameState.canHold}`;
    
    // Update next queue
    const nextQueueEl = this.elements.nextQueue;
    if (nextQueueEl) nextQueueEl.textContent = `Next: ${gameState.nextQueue.join(', ')}`;
    
    // Update input log
    const recentInputs = gameState.inputLog.slice(-5); // Show last 5 inputs
    const inputLogEl = this.elements.inputLog;
    if (inputLogEl) inputLogEl.textContent = `Recent Inputs: ${recentInputs.map(e => e.action).join(', ')}`;
    
    // Update config
    const configEl = this.elements.config;
    if (configEl) {
      configEl.textContent = 
        `180° Rotation: ${gameState.gameplay.allow180Rotation}, ` +
        `Cancel Window: ${gameState.gameplay.finesseCancelMs}ms`;
    }
  }

  private createElements(): void {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <div class="hud-panel">
        <h2>Game State</h2>
        <div id="status" class="hud-item">Status: -</div>
        <div id="tick" class="hud-item">Tick: -</div>
        <div id="activePiece" class="hud-item">Active: -</div>
        <div id="holdPiece" class="hud-item">Hold: -</div>
        <div id="canHold" class="hud-item">Can Hold: -</div>
        <div id="nextQueue" class="hud-item">Next: -</div>
        <div id="inputLog" class="hud-item">Recent Inputs: -</div>
        <div id="config" class="hud-item">Config: -</div>
        
        <h3>Action Log</h3>
        <div id="actionLog" class="action-log"></div>
        
        <h3>Test Controls</h3>
        <div class="test-controls">
          <button id="testLock">Test Lock Action</button>
          <button id="testTick">Test Tick Action</button>
          <button id="testInit">Test Init Action</button>
        </div>
      </div>
      
      <style>
        .hud-panel {
          font-family: monospace;
          background: #2a2a2a;
          color: #ffffff;
          padding: 15px;
          border: 1px solid #4CAF50;
          border-radius: 5px;
          max-width: 400px;
        }
        
        .hud-panel h2 {
          color: #4CAF50;
          margin-top: 0;
          font-size: 16px;
          border-bottom: 1px solid #4CAF50;
          padding-bottom: 5px;
        }
        
        .hud-panel h3 {
          color: #4CAF50;
          font-size: 14px;
          margin: 15px 0 5px 0;
        }
        
        .hud-item {
          margin: 6px 0;
          font-size: 13px;
          color: #e0e0e0;
          background: #1a1a1a;
          padding: 4px 8px;
          border-radius: 3px;
          border-left: 3px solid #4CAF50;
        }
        
        .action-log {
          background: #1a1a1a;
          border: 1px solid #4CAF50;
          color: #e0e0e0;
          padding: 8px;
          height: 150px;
          overflow-y: auto;
          font-size: 11px;
          margin: 8px 0;
          border-radius: 3px;
        }
        
        .test-controls button {
          margin: 4px;
          padding: 6px 12px;
          font-size: 12px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-family: monospace;
        }
        
        .test-controls button:hover {
          background: #45a049;
        }
        
        .action-entry {
          margin: 2px 0;
          padding: 3px;
          border-bottom: 1px solid #333;
          font-size: 10px;
        }
      </style>
    `;
    
    // Store references to elements
    this.elements.status = this.container.querySelector('#status')!;
    this.elements.tick = this.container.querySelector('#tick')!;
    this.elements.activePiece = this.container.querySelector('#activePiece')!;
    this.elements.holdPiece = this.container.querySelector('#holdPiece')!;
    this.elements.canHold = this.container.querySelector('#canHold')!;
    this.elements.nextQueue = this.container.querySelector('#nextQueue')!;
    this.elements.inputLog = this.container.querySelector('#inputLog')!;
    this.elements.config = this.container.querySelector('#config')!;
    this.elements.actionLog = this.container.querySelector('#actionLog')!;
  }
  
  // Method to log actions for debugging
  logAction(action: Action): void {
    if (!this.elements.actionLog) return;
    
    const actionEntry = document.createElement('div');
    actionEntry.className = 'action-entry';
    actionEntry.textContent = `${new Date().toLocaleTimeString()}: ${JSON.stringify(action)}`;
    
    this.elements.actionLog.appendChild(actionEntry);
    this.elements.actionLog.scrollTop = this.elements.actionLog.scrollHeight;
    
    // Keep only last 50 entries
    while (this.elements.actionLog.children.length > 50) {
      this.elements.actionLog.removeChild(this.elements.actionLog.firstChild!);
    }
  }
  
  // Method to setup test button handlers
  setupTestControls(dispatch: (action: Action) => void): void {
    const testLock = this.container?.querySelector('#testLock');
    const testTick = this.container?.querySelector('#testTick');
    const testInit = this.container?.querySelector('#testInit');
    
    testLock?.addEventListener('click', () => {
      dispatch({ type: 'Lock' });
    });
    
    testTick?.addEventListener('click', () => {
      dispatch({ type: 'Tick' });
    });
    
    testInit?.addEventListener('click', () => {
      dispatch({ type: 'Init', seed: `test-${Date.now()}` });
    });
  }

  destroy(): void {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = undefined;
    this.elements = {};
    console.log('BasicHudRenderer destroyed');
  }
}