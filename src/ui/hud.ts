import { GameState, Action } from "../state/types";

export interface HudRenderer {
  initialize(container: HTMLElement): void;
  render(gameState: GameState): void;
  destroy(): void;
}

export class BasicHudRenderer implements HudRenderer {
  private container: HTMLElement | undefined;
  private elements: {
    status?: HTMLElement;
    tick?: HTMLElement;
    activePiece?: HTMLElement;
    holdPiece?: HTMLElement;
    canHold?: HTMLElement;
    nextQueue?: HTMLElement;
    inputLog?: HTMLElement;
    config?: HTMLElement;
    gameMode?: HTMLElement;
    modePrompt?: HTMLElement;
  } = {};

  initialize(container: HTMLElement): void {
    this.container = container;
    this.createElements();
    // HUD renderer initialized
  }

  render(gameState: GameState): void {
    if (!this.container) {
      console.error("HUD not initialized");
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
        : "Active: None";
    }

    // Update hold piece
    const holdPieceEl = this.elements.holdPiece;
    if (holdPieceEl) {
      holdPieceEl.textContent = gameState.hold
        ? `Hold: ${gameState.hold}`
        : "Hold: None";
    }

    // Update can hold
    const canHoldEl = this.elements.canHold;
    if (canHoldEl) canHoldEl.textContent = `Can Hold: ${gameState.canHold}`;

    // Update next queue
    const nextQueueEl = this.elements.nextQueue;
    if (nextQueueEl)
      nextQueueEl.textContent = `Next: ${gameState.nextQueue.join(", ")}`;

    // Update input log (compact, recent 5)
    const recentInputs = gameState.processedInputLog.slice(-5);
    const inputLogEl = this.elements.inputLog;
    if (inputLogEl)
      inputLogEl.textContent = `Recent Inputs: ${recentInputs.map((a) => a.type).join(", ")}`;

    // Update config
    const configEl = this.elements.config;
    if (configEl) {
      configEl.textContent = `Cancel Window: ${gameState.gameplay.finesseCancelMs}ms`;
    }

    // Update game mode
    const gameModeEl = this.elements.gameMode;
    if (gameModeEl) gameModeEl.textContent = `Mode: ${gameState.currentMode}`;

    // Update mode prompt (prefer guidance label if present)
    const modePromptEl = this.elements.modePrompt;
    if (modePromptEl) {
      const promptTextEl = modePromptEl.querySelector(".prompt-text");
      if (promptTextEl) {
        const label = gameState.guidance?.label ?? gameState.modePrompt;
        promptTextEl.textContent = label ?? "No active prompt";
      }
      const show = gameState.guidance?.label ?? gameState.modePrompt;
      modePromptEl.style.display = show ? "block" : "none";
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
        <div id="gameMode" class="hud-item">Mode: -</div>
        
        <div id="modePrompt" class="mode-prompt" style="display: none;">
          <h3>Current Challenge</h3>
          <div class="prompt-text">No active prompt</div>
        </div>
        
        <h3>Game Modes</h3>
        <div class="test-controls">
          <button id="setFreePlay">Free Play Mode</button>
          <button id="setGuided">Guided Mode</button>
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
        
        .mode-prompt {
          background: #1a1a1a;
          border: 2px solid #f0a000;
          color: #f0a000;
          padding: 10px;
          margin: 10px 0;
          border-radius: 5px;
        }
        
        .mode-prompt h3 {
          margin: 0 0 8px 0;
          color: #f0a000;
          font-size: 14px;
        }
        
        .finesse-feedback {
          padding: 8px 12px;
          margin: 8px 0;
          border-radius: 4px;
          font-weight: bold;
          font-size: 13px;
        }
        
        .finesse-feedback.optimal {
          background: #1e4d1e;
          border: 1px solid #4CAF50;
          color: #4CAF50;
        }
        
        .finesse-feedback.suboptimal {
          background: #4d1e1e;
          border: 1px solid #f44336;
          color: #f44336;
        }
      </style>
    `;

    // Store references to elements
    this.elements.status = this.container.querySelector("#status") ?? undefined;
    this.elements.tick = this.container.querySelector("#tick") ?? undefined;
    this.elements.activePiece =
      this.container.querySelector("#activePiece") ?? undefined;
    this.elements.holdPiece =
      this.container.querySelector("#holdPiece") ?? undefined;
    this.elements.canHold =
      this.container.querySelector("#canHold") ?? undefined;
    this.elements.nextQueue =
      this.container.querySelector("#nextQueue") ?? undefined;
    this.elements.inputLog =
      this.container.querySelector("#inputLog") ?? undefined;
    this.elements.config = this.container.querySelector("#config") ?? undefined;
    this.elements.gameMode =
      this.container.querySelector("#gameMode") ?? undefined;
    this.elements.modePrompt =
      this.container.querySelector("#modePrompt") ?? undefined;
    // No action log; minimal HUD
  }

  // Method to setup game mode controls
  setupTestControls(
    dispatch: (action: Action) => void,
    setGameMode?: (mode: string) => void,
  ): void {
    const setFreePlay = this.container?.querySelector("#setFreePlay");
    const setGuided = this.container?.querySelector("#setGuided");

    setFreePlay?.addEventListener("click", () => {
      if (setGameMode) {
        setGameMode("freePlay");
      } else {
        dispatch({ type: "SetMode", mode: "freePlay" });
      }
    });

    setGuided?.addEventListener("click", () => {
      if (setGameMode) {
        setGameMode("guided");
      } else {
        dispatch({ type: "SetMode", mode: "guided" });
      }
    });
  }

  destroy(): void {
    if (this.container) {
      this.container.innerHTML = "";
    }
    this.container = undefined;
    this.elements = {};
    // HUD renderer destroyed
  }
}
