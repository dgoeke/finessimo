import { type GameState, type FinesseAction } from "../state/types";

export type FinesseRenderer = {
  initialize(container: HTMLElement): void;
  render(gameState: GameState): void;
  destroy(): void;
};

export class BasicFinesseRenderer implements FinesseRenderer {
  private container: HTMLElement | undefined;
  private elements: {
    finesseFeedback?: HTMLElement | undefined;
    modePrompt?: HTMLElement | undefined;
  } = {};
  private lastFeedbackTimestamp: number | null = null;
  private isShowing = false;
  private onTransitionEnd: ((ev: TransitionEvent) => void) | null = null;

  private static readonly ICON_MAP: Record<FinesseAction, string> = {
    DASLeft: "⇤",
    DASRight: "⇥",
    HardDrop: "⤓",
    MoveLeft: "←",
    MoveRight: "→",
    RotateCCW: "↺",
    RotateCW: "↻",
    SoftDrop: "⇩",
  };

  private getActionIcon(action: FinesseAction): string {
    return BasicFinesseRenderer.ICON_MAP[action];
  }

  initialize(container: HTMLElement): void {
    this.container = container;
    this.createElements();
  }

  render(gameState: GameState): void {
    if (!this.container) {
      console.error("Finesse renderer not initialized");
      return;
    }

    this.updateModePrompt(gameState);
    this.updateFinesseFeedback(gameState);
  }

  private updateModePrompt(gameState: GameState): void {
    const modePromptEl = this.elements.modePrompt;
    if (!modePromptEl) return;

    const promptTextEl = modePromptEl.querySelector(".prompt-text");
    if (promptTextEl) {
      const label = gameState.guidance?.label ?? gameState.modePrompt;
      promptTextEl.textContent = label ?? "No active prompt";
    }

    const show = gameState.guidance?.label ?? gameState.modePrompt;
    modePromptEl.style.display =
      show !== null && show !== "" ? "block" : "none";
  }

  private updateFinesseFeedback(gameState: GameState): void {
    const finesseFeedbackEl = this.elements.finesseFeedback;
    if (!finesseFeedbackEl) return;

    const fb = gameState.finesseFeedback;
    const seq = fb?.optimalSequence;
    const hasSeq =
      fb !== null && !fb.isOptimal && Array.isArray(seq) && seq.length > 0;

    if (hasSeq) {
      this.showFinesseFeedback(finesseFeedbackEl, fb, seq);
    } else {
      this.hideFinesseFeedback(finesseFeedbackEl);
    }
  }

  private showFinesseFeedback(
    finesseFeedbackEl: HTMLElement,
    fb: NonNullable<GameState["finesseFeedback"]>,
    seq: Array<FinesseAction>,
  ): void {
    const currentTimestamp = fb.timestamp;
    const now = performance.now();
    const shouldShow = now - currentTimestamp < 1000;
    const isNewTimestamp =
      this.lastFeedbackTimestamp === null ||
      currentTimestamp !== this.lastFeedbackTimestamp;

    const { frag, readableActions } = this.buildFeedbackIcons(seq);
    finesseFeedbackEl.replaceChildren(frag);
    finesseFeedbackEl.classList.add("finesse-feedback-overlay");

    this.handleFeedbackAnimation(
      finesseFeedbackEl,
      shouldShow,
      isNewTimestamp,
      currentTimestamp,
    );

    finesseFeedbackEl.setAttribute(
      "aria-label",
      `Suggested finesse: ${readableActions.join(", ")}`,
    );
  }

  private buildFeedbackIcons(seq: Array<FinesseAction>): {
    frag: DocumentFragment;
    readableActions: Array<string>;
  } {
    const frag = document.createDocumentFragment();
    const readableActions: Array<string> = [];

    for (const action of seq) {
      const span = document.createElement("span");
      span.classList.add("finesse-icon");
      span.textContent = this.getActionIcon(action);
      const readable = this.getReadableAction(action);
      span.title = readable;
      span.setAttribute("aria-hidden", "true");
      frag.appendChild(span);
      readableActions.push(readable);
    }

    return { frag, readableActions };
  }

  private handleFeedbackAnimation(
    finesseFeedbackEl: HTMLElement,
    shouldShow: boolean,
    isNewTimestamp: boolean,
    currentTimestamp: number,
  ): void {
    if (shouldShow && (isNewTimestamp || !this.isShowing)) {
      this.lastFeedbackTimestamp = currentTimestamp;
      finesseFeedbackEl.classList.remove("show");
      finesseFeedbackEl.classList.remove("hide");
      void finesseFeedbackEl.offsetHeight;
      finesseFeedbackEl.style.removeProperty("visibility");
      finesseFeedbackEl.classList.add("show");
      this.isShowing = true;
    } else if (!shouldShow && this.isShowing) {
      finesseFeedbackEl.classList.remove("show");
      finesseFeedbackEl.classList.add("hide");
      this.isShowing = false;
    }
  }

  private hideFinesseFeedback(finesseFeedbackEl: HTMLElement): void {
    this.lastFeedbackTimestamp = null;
    finesseFeedbackEl.classList.remove("show");
    finesseFeedbackEl.classList.add("hide");
    finesseFeedbackEl.removeAttribute("aria-label");
    this.isShowing = false;
  }

  // Human-readable labels for accessibility
  private getReadableAction(action: FinesseAction): string {
    switch (action) {
      case "MoveLeft":
        return "Move Left";
      case "MoveRight":
        return "Move Right";
      case "DASLeft":
        return "DAS Left";
      case "DASRight":
        return "DAS Right";
      case "RotateCW":
        return "Rotate Clockwise";
      case "RotateCCW":
        return "Rotate Counter-Clockwise";
      case "HardDrop":
        return "Hard Drop";
      case "SoftDrop":
        return "Soft Drop";

      default: {
        const _exhaustiveCheck: never = action;
        return _exhaustiveCheck;
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
      
      <div id="finesseFeedback" class="finesse-feedback-overlay">
        Finesse feedback will appear here
      </div>
    `;

    // Store references to elements
    this.elements.modePrompt =
      this.container.querySelector<HTMLElement>("#modePrompt") ?? undefined;
    this.elements.finesseFeedback =
      this.container.querySelector<HTMLElement>("#finesseFeedback") ??
      undefined;

    // Setup transition end handler to finalize visibility after fade-out
    const el = this.elements.finesseFeedback;
    if (el !== undefined) {
      this.onTransitionEnd = (ev: TransitionEvent): void => {
        if (ev.propertyName === "opacity" && el.classList.contains("hide")) {
          el.style.visibility = "hidden";
        }
      };
      el.addEventListener("transitionend", this.onTransitionEnd);
    }
  }

  destroy(): void {
    const el = this.elements.finesseFeedback;
    if (el && this.onTransitionEnd) {
      el.removeEventListener("transitionend", this.onTransitionEnd);
    }
    if (this.container) {
      this.container.innerHTML = "";
    }
    this.container = undefined;
    this.elements = {};
    this.onTransitionEnd = null;
    this.lastFeedbackTimestamp = null;
    this.isShowing = false;
  }
}
