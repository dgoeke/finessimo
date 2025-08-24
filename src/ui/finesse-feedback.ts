import { GameState } from "../state/types";

export interface FinesseRenderer {
  initialize(container: HTMLElement): void;
  render(gameState: GameState): void;
  destroy(): void;
}

export class BasicFinesseRenderer implements FinesseRenderer {
  private container: HTMLElement | undefined;
  private elements: {
    finesseFeedback?: HTMLElement;
    modePrompt?: HTMLElement;
  } = {};

  initialize(container: HTMLElement): void {
    this.container = container;
    this.createElements();
  }

  render(gameState: GameState): void {
    if (!this.container) {
      console.error("Finesse renderer not initialized");
      return;
    }

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

    // Update finesse feedback
    const finesseFeedbackEl = this.elements.finesseFeedback;
    if (finesseFeedbackEl) {
      if (
        gameState.finesseFeedback &&
        gameState.finesseFeedback.isOptimal === false
      ) {
        finesseFeedbackEl.textContent = gameState.finesseFeedback.message;
        finesseFeedbackEl.className = "finesse-feedback suboptimal";
        finesseFeedbackEl.style.display = "block";
      } else {
        finesseFeedbackEl.style.display = "none";
      }
    }
  }

  private createElements(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div id="modePrompt" class="mode-prompt" style="display: none;">
        <h3>Current Challenge</h3>
        <div class="prompt-text">No active prompt</div>
      </div>
      
      <div id="finesseFeedback" class="finesse-feedback" style="display: none;">
        Finesse feedback will appear here
      </div>
    `;

    // Store references to elements
    this.elements.modePrompt =
      this.container.querySelector("#modePrompt") ?? undefined;
    this.elements.finesseFeedback =
      this.container.querySelector("#finesseFeedback") ?? undefined;
  }

  destroy(): void {
    if (this.container) {
      this.container.innerHTML = "";
    }
    this.container = undefined;
    this.elements = {};
  }
}
