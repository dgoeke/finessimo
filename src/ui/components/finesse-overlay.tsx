import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html } from "lit";
import { customElement, state, query } from "lit/decorators.js";

import { gameStateSignal } from "../../state/signals";
import { playBoop } from "../audio";

import type { GameState, FinesseAction } from "../../state/types";

@customElement("finesse-overlay")
export class FinesseOverlay extends SignalWatcher(LitElement) {
  @state() private lastFeedbackTimestamp: number | null = null;
  // Tracks last shown feedback timestamp to avoid duplicate boops
  @state() private lastBoopTimestamp: number | null = null;
  @state() private isShowing = false;

  @query(".finesse-feedback-overlay") private feedbackEl?: HTMLElement;
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

  // Use light DOM for consistent styling
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private getActionIcon(action: FinesseAction): string {
    return FinesseOverlay.ICON_MAP[action];
  }

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

  firstUpdated(): void {
    // Setup transition end handler
    const feedbackEl = this.feedbackEl;
    if (feedbackEl) {
      this.onTransitionEnd = (ev: TransitionEvent): void => {
        if (
          ev.propertyName === "opacity" &&
          feedbackEl.classList.contains("hide")
        ) {
          feedbackEl.style.visibility = "hidden";
        }
      };
      feedbackEl.addEventListener("transitionend", this.onTransitionEnd);
    }
  }

  updated(): void {
    const gameState = gameStateSignal.get();
    // Use requestAnimationFrame to defer state updates after render cycle
    requestAnimationFrame(() => {
      this.updateFinesseFeedback(gameState);
    });
  }

  private updateFinesseFeedback(gameState: GameState): void {
    const feedbackEl = this.feedbackEl;
    if (!feedbackEl) return;

    const fb = gameState.finesseFeedback;
    const seq = fb?.optimalSequence;
    const hasSeq =
      fb !== null && !fb.isOptimal && Array.isArray(seq) && seq.length > 0;

    if (!hasSeq) {
      // No active feedback: hide and reset timestamps
      this.hideFinesseFeedback(feedbackEl, true);
      return;
    }

    // Check if this is new feedback
    const currentTimestamp = fb.timestamp;
    this.maybeBoop(
      currentTimestamp,
      gameState.gameplay.finesseBoopEnabled ?? false,
    );

    // Update feedback timestamp for popup logic
    const isNewFeedback =
      this.lastFeedbackTimestamp === null ||
      currentTimestamp !== this.lastFeedbackTimestamp;
    if (isNewFeedback) {
      this.lastFeedbackTimestamp = currentTimestamp;
    }

    // Handle popup display separately
    const feedbackEnabled = gameState.gameplay.finesseFeedbackEnabled ?? true;
    if (feedbackEnabled) {
      this.showFinesseFeedback(feedbackEl, fb, seq, isNewFeedback);
    } else {
      // Hide visually but preserve timestamps so boop doesn't retrigger
      this.hideFinesseFeedback(feedbackEl, false);
    }
  }

  private maybeBoop(currentTimestamp: number, boopEnabled: boolean): void {
    const isNewBoop =
      this.lastBoopTimestamp === null ||
      currentTimestamp !== this.lastBoopTimestamp;
    if (isNewBoop) {
      this.lastBoopTimestamp = currentTimestamp;
      if (boopEnabled) playBoop();
    }
  }

  // Removed: boop handled directly in updateFinesseFeedback to keep it independent

  private showFinesseFeedback(
    finesseFeedbackEl: HTMLElement,
    fb: NonNullable<GameState["finesseFeedback"]>,
    seq: Array<FinesseAction>,
    isNewTimestamp: boolean,
  ): void {
    const currentTimestamp = fb.timestamp;
    const now = performance.now();
    const shouldShow = now - currentTimestamp < 1500;

    const readableActions: Array<string> = [];
    for (const action of seq) {
      readableActions.push(this.getReadableAction(action));
    }

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
      void finesseFeedbackEl.offsetHeight; // Force reflow
      finesseFeedbackEl.style.removeProperty("visibility");
      finesseFeedbackEl.classList.add("show");
      this.isShowing = true;
    } else if (!shouldShow && this.isShowing) {
      finesseFeedbackEl.classList.remove("show");
      finesseFeedbackEl.classList.add("hide");
      this.isShowing = false;
    }
  }

  private hideFinesseFeedback(
    finesseFeedbackEl: HTMLElement,
    resetTimestamps: boolean,
  ): void {
    if (resetTimestamps) {
      this.lastFeedbackTimestamp = null;
      this.lastBoopTimestamp = null;
    }
    finesseFeedbackEl.classList.remove("show");
    finesseFeedbackEl.classList.add("hide");
    finesseFeedbackEl.removeAttribute("aria-label");
    this.isShowing = false;
  }

  private renderFinesseIcons(sequence: Array<FinesseAction>): Array<unknown> {
    return sequence.map(
      (action) => html`
        <span
          class="finesse-icon"
          title="${this.getReadableAction(action)}"
          aria-hidden="true"
        >
          ${this.getActionIcon(action)}
        </span>
      `,
    );
  }

  private renderModePrompt(gameState: GameState): unknown {
    const label = gameState.guidance?.label ?? gameState.modePrompt;
    const show = Boolean(label);

    if (!show) {
      return null;
    }

    return html`
      <div class="mode-prompt">
        <h3>Current Challenge</h3>
        <div class="prompt-text">${label ?? "No active prompt"}</div>
      </div>
    `;
  }

  private renderFinesseFeedback(gameState: GameState): unknown {
    // Check if finesse feedback is enabled
    const feedbackEnabled = gameState.gameplay.finesseFeedbackEnabled ?? true;
    if (!feedbackEnabled) {
      return html`
        <div class="finesse-feedback-overlay">Finesse feedback disabled</div>
      `;
    }

    const fb = gameState.finesseFeedback;
    const seq = fb?.optimalSequence;
    const hasSeq =
      fb !== null && !fb.isOptimal && Array.isArray(seq) && seq.length > 0;

    if (!hasSeq) {
      return html`
        <div class="finesse-feedback-overlay">
          Finesse feedback will appear here
        </div>
      `;
    }

    return html`
      <div class="finesse-feedback-overlay">
        ${this.renderFinesseIcons(seq)}
      </div>
    `;
  }

  protected render(): unknown {
    const gameState = gameStateSignal.get();

    return html`
      ${this.renderModePrompt(gameState)}
      ${this.renderFinesseFeedback(gameState)}
    `;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    const feedbackEl = this.feedbackEl;
    if (feedbackEl && this.onTransitionEnd) {
      feedbackEl.removeEventListener("transitionend", this.onTransitionEnd);
    }
    this.onTransitionEnd = null;
    this.lastFeedbackTimestamp = null;
    this.lastBoopTimestamp = null;
    this.isShowing = false;
  }
}
