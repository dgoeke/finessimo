import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html } from "lit";
import { customElement, state, query } from "lit/decorators.js";

import { getActionIcon } from "../../finesse/constants";
import { gameStateSignal } from "../../state/signals";
import { playBoop } from "../audio";

import type { GameState, FinesseAction } from "../../state/types";

@customElement("finesse-overlay")
export class FinesseOverlay extends SignalWatcher(LitElement) {
  @state() private lastFeedback: string | null = null;
  // Tracks serialized last feedback to detect changes and avoid duplicate boops
  @state() private isShowing = false;
  private hideTimerId: ReturnType<typeof setTimeout> | null = null;
  private static readonly HIDE_AFTER_MS = 1500;

  @query(".finesse-feedback-overlay") private feedbackEl?: HTMLElement;
  private onTransitionEnd: ((ev: TransitionEvent) => void) | null = null;

  // Use light DOM for consistent styling
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
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

  // disconnectedCallback is implemented at the end to also remove listeners

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
    const seq = fb?.kind === "faulty" ? fb.optimalSequences[0] : undefined;
    const hasSeq = Array.isArray(seq) && seq.length > 0;

    if (!hasSeq || !fb) {
      this.handleNoFeedback(feedbackEl);
      return;
    }

    this.handleActiveFeedback(gameState, feedbackEl, fb, seq);
  }

  private handleNoFeedback(feedbackEl: HTMLElement): void {
    this.clearHideTimer();
    this.hideFinesseFeedback(feedbackEl, true);
  }

  private handleActiveFeedback(
    gameState: GameState,
    feedbackEl: HTMLElement,
    fb: NonNullable<GameState["finesseFeedback"]>,
    seq: Array<FinesseAction>,
  ): void {
    const currentFeedback = JSON.stringify(fb);
    const isNewFeedback = this.lastFeedback !== currentFeedback;

    this.maybeBoop(
      isNewFeedback,
      gameState.gameplay.finesseBoopEnabled ?? false,
    );

    if (isNewFeedback) {
      this.lastFeedback = currentFeedback;
    }

    const feedbackEnabled = gameState.gameplay.finesseFeedbackEnabled ?? true;
    if (feedbackEnabled) {
      // Only show when feedback is new OR we are currently showing; avoid
      // re-showing the same feedback after auto-hide.
      if (isNewFeedback || this.isShowing) {
        this.showFinesseFeedback(feedbackEl, fb, seq, isNewFeedback);
      }
      if (isNewFeedback) {
        this.scheduleAutoHide(feedbackEl);
      }
    } else {
      this.clearHideTimer();
      this.hideFinesseFeedback(feedbackEl, false);
    }
  }

  private maybeBoop(isNewFeedback: boolean, boopEnabled: boolean): void {
    if (isNewFeedback && boopEnabled) {
      playBoop();
    }
  }

  // Removed: boop handled directly in updateFinesseFeedback to keep it independent

  private showFinesseFeedback(
    finesseFeedbackEl: HTMLElement,
    _fb: NonNullable<GameState["finesseFeedback"]>,
    seq: Array<FinesseAction>,
    isNewFeedback: boolean,
  ): void {
    const readableActions: Array<string> = [];
    for (const action of seq) {
      readableActions.push(this.getReadableAction(action));
    }

    this.handleFeedbackAnimation(
      finesseFeedbackEl,
      true, // Always show when feedback is enabled
      isNewFeedback,
    );

    finesseFeedbackEl.setAttribute(
      "aria-label",
      `Suggested finesse: ${readableActions.join(", ")}`,
    );
  }

  private handleFeedbackAnimation(
    finesseFeedbackEl: HTMLElement,
    shouldShow: boolean,
    isNewFeedback: boolean,
  ): void {
    if (shouldShow && (isNewFeedback || !this.isShowing)) {
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
    resetState: boolean,
  ): void {
    if (resetState) {
      this.lastFeedback = null;
    }
    finesseFeedbackEl.classList.remove("show");
    finesseFeedbackEl.classList.add("hide");
    finesseFeedbackEl.removeAttribute("aria-label");
    this.isShowing = false;
  }

  private scheduleAutoHide(feedbackEl: HTMLElement): void {
    this.clearHideTimer();
    // Use window.setTimeout to ensure numeric handle under DOM typings
    this.hideTimerId = setTimeout(() => {
      // Only hide if still showing the same feedback
      if (this.isShowing) {
        this.hideFinesseFeedback(feedbackEl, false);
      }
      this.hideTimerId = null;
    }, FinesseOverlay.HIDE_AFTER_MS);
  }

  private clearHideTimer(): void {
    if (this.hideTimerId !== null) {
      clearTimeout(this.hideTimerId);
      this.hideTimerId = null;
    }
  }

  private renderFinesseIcons(sequence: Array<FinesseAction>): Array<unknown> {
    return sequence.map(
      (action) => html`
        <span
          class="finesse-icon"
          title="${this.getReadableAction(action)}"
          aria-hidden="true"
        >
          ${getActionIcon(action)}
        </span>
      `,
    );
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
    const seq = fb?.kind === "faulty" ? fb.optimalSequences[0] : undefined;
    const hasSeq =
      fb !== null &&
      fb.kind === "faulty" &&
      Array.isArray(seq) &&
      seq.length > 0;

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

    return html` ${this.renderFinesseFeedback(gameState)} `;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.clearHideTimer();
    const feedbackEl = this.feedbackEl;
    if (feedbackEl && this.onTransitionEnd) {
      feedbackEl.removeEventListener("transitionend", this.onTransitionEnd);
    }
    this.onTransitionEnd = null;
    this.lastFeedback = null;
    this.isShowing = false;
  }
}
