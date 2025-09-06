import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

import { getActionIcon } from "../../engine/finesse/constants";
import { gameStateSignal } from "../../state/signals";
import {
  createMiniCanvasElement,
  renderMiniBoard,
} from "../renderers/mini-board";

import type { UiEffect, FinesseResultCardEffect } from "../../state/types";

@customElement("effects-overlay")
export class EffectsOverlay extends SignalWatcher(LitElement) {
  // Light DOM so it inherits board-frame positioning and global styles
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }
  private renderResultCard(e: FinesseResultCardEffect): unknown {
    const state = gameStateSignal.get();

    // Create mini board canvas
    const canvas = createMiniCanvasElement();
    const ctx = canvas.getContext("2d");
    if (ctx) {
      renderMiniBoard(ctx, state.board, e.targetPiece);
    }

    // Format sequences as icon strings
    const optimalSequenceText = e.optimalSequences[0]
      ? e.optimalSequences[0].map((action) => getActionIcon(action)).join("")
      : "";
    const playerSequenceText =
      e.playerSequence.length > 0
        ? e.playerSequence.map((action) => getActionIcon(action)).join("")
        : "";

    // Get rating color for accent/border
    const ratingColors = {
      again: "#ef4444",
      easy: "#60a5fa",
      good: "#10b981",
      hard: "#f59e0b",
    } as const;
    const ratingClass = e.rating ? `rating-${e.rating}` : "";
    const accentColor = e.rating ? ratingColors[e.rating] : "#666666";

    return html`
      <div
        class="finesse-result-card ${ratingClass}"
        style="--border-color: ${accentColor}; --rating-color: ${accentColor}"
      >
        <div class="mini-board-container">${canvas}</div>

        <div class="finesse-sequences">
          <div class="sequence-row">
            <span class="sequence-label">Optimal:</span>
            <span class="sequence-icons optimal">${optimalSequenceText}</span>
          </div>
          <div class="sequence-row">
            <span class="sequence-label">Yours:</span>
            <span class="sequence-icons player">${playerSequenceText}</span>
          </div>
        </div>
      </div>
    `;
  }
  private renderEffect(e: UiEffect): unknown {
    // Only render FloatingTextEffect - other effects are handled by overlay system
    if (e.kind !== "floatingText") {
      return html``;
    }

    // Anchor class and absolute offsets
    const anchorClass = `anchor-${e.anchor}`;
    let posStyle: string;
    if (e.anchor === "topLeft") {
      posStyle = `left: ${String(e.offsetX)}px; top: ${String(e.offsetY)}px;`;
    } else if (e.anchor === "topRight") {
      posStyle = `right: ${String(e.offsetX)}px; top: ${String(e.offsetY)}px;`;
    } else if (e.anchor === "bottomLeft") {
      posStyle = `left: ${String(e.offsetX)}px; bottom: ${String(e.offsetY)}px;`;
    } else {
      posStyle = `right: ${String(e.offsetX)}px; bottom: ${String(e.offsetY)}px;`;
    }

    const durMs =
      (e.ttlMs as unknown as number) !== 0
        ? (e.ttlMs as unknown as number)
        : 1200;
    const drift = e.driftYPx;
    const scaleFrom = e.scaleFrom ?? 1;
    const scaleTo = e.scaleTo ?? 0.9;

    return html`
      <div
        class="fx-item ${anchorClass}"
        style="${posStyle} --fx-dur: ${String(durMs)}ms; --fx-drift-y: ${String(
          drift
        )}px; --fx-scale-from: ${String(scaleFrom)}; --fx-scale-to: ${String(
          scaleTo
        )};"
      >
        <div
          class="fx-floating-text"
          style="color: ${e.color}; font-size: ${String(
            e.fontPx
          )}px; font-weight: ${String(e.fontWeight ?? 800)};"
        >
          ${e.text}
        </div>
      </div>
    `;
  }

  private getLatestResultCardEffect(
    effects: ReadonlyArray<UiEffect>
  ): FinesseResultCardEffect | null {
    let latest: FinesseResultCardEffect | null = null;
    for (const e of effects) {
      if (e.kind === "finesseResultCard") latest = e;
    }
    return latest;
  }

  protected render(): unknown {
    const state = gameStateSignal.get();
    const effects = state.uiEffects;

    // Derive the current result card from effects; no animations
    const currentEffect = this.getLatestResultCardEffect(effects);

    // Filter out result-card effects since they're managed separately
    const nonResultCardEffects = effects.filter(
      (e) =>
        e.kind !== "finesseResultCard" && e.kind !== "finesseResultCardClear"
    );

    const hasEffectsToRender =
      nonResultCardEffects.length > 0 || currentEffect !== null;

    if (!hasEffectsToRender) {
      return html``;
    }

    return html`
      <div class="effects-overlay">
        ${nonResultCardEffects.map((e) => this.renderEffect(e))}
        ${currentEffect ? this.renderResultCard(currentEffect) : ""}
      </div>
    `;
  }
}
