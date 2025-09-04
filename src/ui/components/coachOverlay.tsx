import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html } from "lit";
import { customElement, state, query } from "lit/decorators.js";

import { gameStateSignal } from "../../state/signals";

import type { PolicyOutput } from "../../policy/types";
import type { GameState } from "../../state/types";

@customElement("coach-overlay")
export class CoachOverlay extends SignalWatcher(LitElement) {
  @state() private lastSuggestion: string | null = null;
  // Tracks serialized last suggestion to detect changes and avoid duplicate displays
  @state() private isShowing = false;
  private hideTimerId: ReturnType<typeof setTimeout> | null = null;
  private static readonly HIDE_AFTER_MS = 2000;

  @query(".coach-feedback-overlay") private feedbackEl?: HTMLElement;
  private onTransitionEnd: ((ev: TransitionEvent) => void) | null = null;

  // Use light DOM for consistent styling
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
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
      this.updateCoachFeedback(gameState);
    });
  }

  private updateCoachFeedback(gameState: GameState): void {
    const feedbackEl = this.feedbackEl;
    if (!feedbackEl) return;

    // Extract policy output from game state
    // Note: This assumes policy output will be available in game state
    // The actual integration may store it differently
    const policyOutput = this.extractPolicyOutput(gameState);
    const suggestion = policyOutput?.suggestion;
    const rationale = suggestion?.rationale;

    if (rationale === undefined || rationale.trim().length === 0) {
      this.handleNoSuggestion(feedbackEl);
      return;
    }

    this.handleActiveSuggestion(feedbackEl, rationale);
  }

  private extractPolicyOutput(gameState: GameState): PolicyOutput | null {
    // Policy integration is handled by accessing modeData or a future dedicated field
    // For now, check if modeData contains policy output
    const modeData = gameState.modeData;

    if (
      modeData !== null &&
      typeof modeData === "object" &&
      "policyOutput" in modeData
    ) {
      return (modeData as Record<string, unknown>)[
        "policyOutput"
      ] as PolicyOutput;
    }

    // Check if there's a policyOutput field directly on the game state
    if ("policyOutput" in gameState) {
      return (gameState as GameState & { policyOutput: PolicyOutput })
        .policyOutput;
    }

    return null;
  }

  private handleNoSuggestion(feedbackEl: HTMLElement): void {
    this.clearHideTimer();
    this.hideCoachFeedback(feedbackEl, true);
  }

  private handleActiveSuggestion(
    feedbackEl: HTMLElement,
    rationale: string,
  ): void {
    const currentSuggestion = rationale;
    const isNewSuggestion = this.lastSuggestion !== currentSuggestion;

    if (isNewSuggestion) {
      this.lastSuggestion = currentSuggestion;
    }

    // Show coaching overlay for new suggestions or while currently showing
    if (isNewSuggestion || this.isShowing) {
      this.showCoachFeedback(feedbackEl, rationale, isNewSuggestion);
    }

    if (isNewSuggestion) {
      this.scheduleAutoHide(feedbackEl);
    }
  }

  private showCoachFeedback(
    feedbackEl: HTMLElement,
    rationale: string,
    isNewSuggestion: boolean,
  ): void {
    this.showFeedbackAnimation(feedbackEl, isNewSuggestion);

    feedbackEl.setAttribute("aria-label", `Coaching suggestion: ${rationale}`);
  }

  private showFeedbackAnimation(
    feedbackEl: HTMLElement,
    isNewSuggestion: boolean,
  ): void {
    if (isNewSuggestion || !this.isShowing) {
      feedbackEl.classList.remove("show");
      feedbackEl.classList.remove("hide");
      // Force reflow by reading layout property; store in dataset to mark usage
      feedbackEl.dataset["reflow"] = String(feedbackEl.offsetHeight);
      feedbackEl.style.removeProperty("visibility");
      feedbackEl.classList.add("show");
      this.isShowing = true;
    }
  }

  private hideFeedbackAnimation(feedbackEl: HTMLElement): void {
    if (this.isShowing) {
      feedbackEl.classList.remove("show");
      feedbackEl.classList.add("hide");
      this.isShowing = false;
    }
  }

  private hideCoachFeedback(
    feedbackEl: HTMLElement,
    resetState: boolean,
  ): void {
    if (resetState) {
      this.lastSuggestion = null;
    }
    this.hideFeedbackAnimation(feedbackEl);
    feedbackEl.removeAttribute("aria-label");
  }

  private scheduleAutoHide(feedbackEl: HTMLElement): void {
    this.clearHideTimer();
    // Use window.setTimeout to ensure numeric handle under DOM typings
    this.hideTimerId = setTimeout(() => {
      // Only hide if still showing the same suggestion
      if (this.isShowing) {
        this.hideCoachFeedback(feedbackEl, false);
      }
      this.hideTimerId = null;
    }, CoachOverlay.HIDE_AFTER_MS);
  }

  private clearHideTimer(): void {
    if (this.hideTimerId !== null) {
      clearTimeout(this.hideTimerId);
      this.hideTimerId = null;
    }
  }

  private renderCoachFeedback(gameState: GameState): unknown {
    const policyOutput = this.extractPolicyOutput(gameState);
    const suggestion = policyOutput?.suggestion;
    const rationale = suggestion?.rationale;

    if (rationale === undefined || rationale.trim().length === 0) {
      return html`
        <div class="coach-feedback-overlay">
          Coaching suggestions will appear here
        </div>
      `;
    }

    return html`
      <div class="coach-feedback-overlay">
        <div class="coach-rationale">${rationale}</div>
      </div>
    `;
  }

  protected render(): unknown {
    const gameState = gameStateSignal.get();

    return html` ${this.renderCoachFeedback(gameState)} `;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.clearHideTimer();
    const feedbackEl = this.feedbackEl;
    if (feedbackEl && this.onTransitionEnd) {
      feedbackEl.removeEventListener("transitionend", this.onTransitionEnd);
    }
    this.onTransitionEnd = null;
    this.lastSuggestion = null;
    this.isShowing = false;
  }
}
