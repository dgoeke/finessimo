import { animate } from "@lit-labs/motion";
import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";

import { getActionIcon } from "../../engine/finesse/constants";
import { isGuidedStackData } from "../../modes/guided/cards";
import { gameStateSignal } from "../../state/signals";
import {
  createMiniCanvasElement,
  renderMiniBoard,
} from "../renderers/mini-board";

import type { GuidedCardVM } from "../../modes/guided/cards";
import type { GameState, FinesseAction } from "../../state/types";

@customElement("guided-result-stack")
export class GuidedResultStack extends SignalWatcher(LitElement) {
  // --- stamp state ---
  private stamped = new Set<number>(); // attemptIds already stamped (persist)
  private pendingStamp = new Set<number>(); // attemptIds that will stamp when rating appears

  // --- previous occupants (to link motion across id churn) ---
  private _prevActiveId: number | null = null;
  private _prevSecondId: number | null = null;
  private _prevThirdId: number | null = null;

  // previous visible VM snapshot (so we can render a 1-frame "leaving ghost")
  private _prevVMs = new Map<number, GuidedCardVM>();

  // leaving ghost bookkeeping
  private _leavingId: number | null = null;
  private _leaveTimer: number | null = null;

  // layout measurement (row height = card height + gap)
  private row = 0;
  private readonly GAP = 8; // keep in sync with CSS

  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private formatSeq(seq: ReadonlyArray<FinesseAction>): string {
    return seq.map((a) => getActionIcon(a)).join("");
  }

  private measureRow(): number {
    const el = this.querySelector<HTMLElement>(
      ".guided-result-stack .finesse-result-card",
    );
    if (!el) return this.row !== 0 ? this.row : 120;
    const h = Math.round(el.getBoundingClientRect().height);
    return h + this.GAP;
  }

  private getNewTopKeyframes(): Array<Keyframe> {
    return [
      {
        offset: 0,
        opacity: 0,
        transform: "translateY(-16px)",
        visibility: "visible",
      },
      {
        offset: 0.15,
        opacity: 0,
        transform: "translateY(-16px)",
        visibility: "visible",
      },
      { offset: 1, opacity: 1, transform: "none", visibility: "visible" },
    ];
  }

  private getDefaultInKeyframes(): Array<Keyframe> {
    return [
      { opacity: 0, transform: "translateY(-16px)" },
      { opacity: 1, transform: "none" },
    ];
  }

  private getLinkFromPrevActiveForInactiveCard(
    position: number,
    attemptId: number,
  ): string | undefined {
    return position === 1 &&
      this._prevActiveId != null &&
      attemptId !== this._prevActiveId
      ? `card-${this._prevActiveId.toString()}`
      : undefined;
  }

  private getLinkFromPrevSecondForInactiveCard(
    position: number,
    attemptId: number,
  ): string | undefined {
    return position === 2 &&
      this._prevSecondId != null &&
      attemptId !== this._prevSecondId
      ? `card-${this._prevSecondId.toString()}`
      : undefined;
  }

  private calculateLinkIds(
    isActive: boolean,
    position: number,
    attemptId: number,
    opts?: { leaving?: boolean },
  ): { inId: string | undefined; motionId: string } {
    const idAttr = `card-${attemptId.toString()}`;

    let linkFromPrevActive: string | undefined;
    let linkFromPrevSecond: string | undefined;

    if (!isActive) {
      linkFromPrevActive = this.getLinkFromPrevActiveForInactiveCard(
        position,
        attemptId,
      );
      linkFromPrevSecond = this.getLinkFromPrevSecondForInactiveCard(
        position,
        attemptId,
      );
    }

    const linkFromSelf = opts?.leaving === true ? idAttr : undefined;

    const inId = linkFromSelf ?? linkFromPrevActive ?? linkFromPrevSecond;
    const motionId =
      opts?.leaving === true ? `ghost-${attemptId.toString()}` : idAttr;

    return { inId, motionId };
  }

  private calculateStampProperties(
    attemptId: number,
    position: number,
    isActive: boolean,
    card: GuidedCardVM,
  ): {
    showStamp: boolean;
    persistClass: string;
    ratingClass: string;
    stampAnimateAttr: string;
    ratingText: string;
  } {
    // ---- stamp: animate once when a card first occupies slot #2 (or when its rating appears) ----
    let animateStamp = false;
    if (position === 1 && !isActive) {
      if (this.pendingStamp.has(attemptId) && card.rating !== undefined) {
        this.pendingStamp.delete(attemptId);
        this.stamped.add(attemptId);
        animateStamp = true;
      }
    }
    const showStamp =
      (this.stamped.has(attemptId) || animateStamp) &&
      card.rating !== undefined;

    // Extract nested ternary operations
    const persistClass = this.stamped.has(attemptId) ? "persist" : "";
    const ratingClass =
      card.rating !== undefined ? `rating-stamp--${card.rating}` : "";
    const stampAnimateAttr = animateStamp ? "1" : "0";
    const ratingText =
      card.rating !== undefined ? card.rating.toUpperCase() : "";

    return {
      persistClass,
      ratingClass,
      ratingText,
      showStamp,
      stampAnimateAttr,
    };
  }

  private createStampOverlay(stampProps: {
    showStamp: boolean;
    persistClass: string;
    ratingClass: string;
    stampAnimateAttr: string;
    ratingText: string;
  }): ReturnType<typeof html> | null {
    const {
      persistClass,
      ratingClass,
      ratingText,
      showStamp,
      stampAnimateAttr,
    } = stampProps;

    return showStamp
      ? html`<div
          class="rating-stamp ${persistClass} ${ratingClass}"
          data-stamp-animate=${stampAnimateAttr}
        >
          ${ratingText}
        </div>`
      : null;
  }

  private renderCard(
    state: GameState,
    card: GuidedCardVM,
    isActive: boolean,
    position: number,
    opts?: { leaving?: boolean },
  ): ReturnType<typeof html> {
    // compose mini-board
    const canvas = createMiniCanvasElement();
    const ctx = canvas.getContext("2d");
    if (ctx) renderMiniBoard(ctx, state.board, card.targetPiece);

    const optimal = card.optimalSequences[0] ?? [];
    const yours = card.playerSequence;
    const attemptId = card.attemptId;

    // final layout target; FLIP will animate via transform
    const topPosition = (this.row !== 0 ? this.row : 120) * position;

    // Calculate link IDs for FLIP animation
    const { inId, motionId } = this.calculateLinkIds(
      isActive,
      position,
      attemptId,
      opts,
    );

    // ---- new-top reveal hold (avoid "popping" before old #0 moves) ----
    const isNewTop =
      isActive && position === 0 && attemptId !== this._prevActiveId;

    // Calculate stamp properties
    const stampProps = this.calculateStampProperties(
      attemptId,
      position,
      isActive,
      card,
    );
    const stampOverlay = this.createStampOverlay(stampProps);

    // ---- animate() options ----
    const ANIMATION_DURATION = 320;
    const keyframeOptions: KeyframeAnimationOptions = {
      duration: ANIMATION_DURATION,
      easing: "ease-out",
      fill: "both", // keep final state so we can safely hide/reveal
    };

    // Select keyframes based on card state
    let inKeyframes: Array<Keyframe>;
    if (opts?.leaving === true) {
      inKeyframes = [{ opacity: 1 }, { opacity: 0 }];
    } else if (isNewTop) {
      inKeyframes = this.getNewTopKeyframes();
    } else {
      inKeyframes = this.getDefaultInKeyframes();
    }

    const outKeyframes = [
      { opacity: 1, transform: "none" },
      { opacity: 0, transform: "translateY(8px)" },
    ];

    return html`
      <div
        class="finesse-result-card ${opts?.leaving === true ? "leaving" : ""}"
        style="top:${topPosition.toString()}px; --card-z:${(
          3 - position
        ).toString()};"
        data-attempt-id="${attemptId.toString()}"
        data-position="${position.toString()}"
        ${isNewTop ? 'data-new-top="1"' : ""}
        ${animate({
          id: motionId,
          in: inKeyframes,
          inId,
          keyframeOptions,
          out: outKeyframes,
        })}
      >
        <div class="mini-board-container">
          <div class="mini-board">${canvas}</div>
        </div>
        <div class="finesse-sequences">
          <div class="sequence-row">
            <span class="sequence-label">Optimal:</span>
            <span class="sequence-icons optimal"
              >${this.formatSeq(optimal)}</span
            >
          </div>
          <div class="sequence-row">
            <span class="sequence-label">Yours:</span>
            <span class="sequence-icons player">${this.formatSeq(yours)}</span>
          </div>
        </div>
        ${stampOverlay}
      </div>
    `;
  }

  private buildCardItems(md: {
    activeCard?: GuidedCardVM;
    cards: ReadonlyArray<GuidedCardVM>;
  }): Array<{ c: GuidedCardVM; active: boolean }> {
    const items: Array<{ c: GuidedCardVM; active: boolean }> = [];
    if (md.activeCard !== undefined) {
      items.push({ active: true, c: md.activeCard });
    }
    for (const c of md.cards) {
      items.push({ active: false, c });
    }
    return items;
  }

  private handleStampScheduling(
    visible: Array<{ c: GuidedCardVM; active: boolean }>,
  ): void {
    const currentSecondId = visible[1]?.c.attemptId ?? null;
    if (
      currentSecondId !== this._prevSecondId &&
      currentSecondId != null &&
      !this.stamped.has(currentSecondId)
    ) {
      this.pendingStamp.add(currentSecondId);
    }
  }

  private calculateLeavingVM(
    visible: Array<{ c: GuidedCardVM; active: boolean }>,
  ): GuidedCardVM | null {
    if (
      this._prevThirdId != null &&
      !visible.some((v) => v.c.attemptId === this._prevThirdId)
    ) {
      const leavingVM = this._prevVMs.get(this._prevThirdId) ?? null;
      this._leavingId = leavingVM?.attemptId ?? null;
      return leavingVM;
    } else {
      this._leavingId = null;
      return null;
    }
  }

  protected render(): ReturnType<typeof html> {
    const state = gameStateSignal.get();
    if (state.currentMode !== "guided") return html``;

    const md = state.modeData;
    if (!isGuidedStackData(md)) return html``;

    const items = this.buildCardItems(md);
    if (items.length === 0) return html``;

    const visible = items.slice(0, 3);
    this.handleStampScheduling(visible);
    const leavingVM = this.calculateLeavingVM(visible);

    const row = this.row > 0 ? this.row : 120;

    return html`
      <div
        class="guided-result-stack"
        style="--stack-row:${row.toString()}px; --stack-gap:${this.GAP.toString()}px;"
        aria-label="Guided finesse result cards"
      >
        ${repeat(
          visible,
          (t) => t.c.attemptId,
          (item, index) => this.renderCard(state, item.c, item.active, index),
        )}
        ${leavingVM
          ? this.renderCard(
              state,
              leavingVM,
              /*isActive*/ false,
              /*position*/ 3,
              { leaving: true },
            )
          : null}
      </div>
    `;
  }

  private handleNewTopElements(): void {
    const newTops = this.querySelectorAll<HTMLElement>(
      '.guided-result-stack .finesse-result-card[data-new-top="1"]',
    );
    newTops.forEach((el) => {
      el.removeAttribute("data-new-top");
      el.style.visibility = "visible"; // Restore visibility
    });
  }

  private handleStampAnimations(): void {
    const stamps = this.querySelectorAll<HTMLElement>(
      '.rating-stamp[data-stamp-animate="1"]',
    );
    stamps.forEach((el) => {
      el.removeAttribute("data-stamp-animate");
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (prefersReducedMotion) {
        el.style.transform = "rotate(-12deg) scale(1.0)";
        el.style.opacity = "0.8";
      } else {
        el.animate(
          [
            { opacity: 0, transform: "rotate(-12deg) scale(1.8)" },
            {
              offset: 0.6,
              opacity: 0.85,
              transform: "rotate(-12deg) scale(1.02)",
            },
            { opacity: 0.8, transform: "rotate(-12deg) scale(1.0)" },
          ],
          { duration: 140, easing: "ease-out", fill: "both" },
        );
      }
    });
  }

  private scheduleGhostRemoval(animationDuration: number): void {
    if (this._leavingId !== null) {
      if (this._leaveTimer !== null) {
        clearTimeout(this._leaveTimer);
        this._leaveTimer = null;
      }
      this._leaveTimer = window.setTimeout(() => {
        this._leavingId = null;
        this.requestUpdate();
      }, animationDuration + 20); // 20ms buffer after animation completes
    }
  }

  private updatePreviousState(): void {
    const state = gameStateSignal.get();
    if (state.currentMode === "guided" && isGuidedStackData(state.modeData)) {
      this._prevActiveId = state.modeData.activeCard?.attemptId ?? null;
      this._prevSecondId = state.modeData.cards[0]?.attemptId ?? null;
      this._prevThirdId = state.modeData.cards[1]?.attemptId ?? null;

      const items = this.buildCardItems(state.modeData);
      const visible = items.slice(0, 3);
      this._prevVMs = new Map(visible.map((v) => [v.c.attemptId, v.c]));
    }
  }

  protected updated(): void {
    const ANIMATION_DURATION = 320;

    // Measure row height (card height + gap)
    const measured = this.measureRow();
    if (measured !== this.row) {
      this.row = measured;
      this.requestUpdate();
    }

    // Batch all DOM operations in a single RAF to prevent race conditions
    requestAnimationFrame(() => {
      this.handleNewTopElements();
      this.handleStampAnimations();
    });

    this.scheduleGhostRemoval(ANIMATION_DURATION);
    this.updatePreviousState();
  }
}
