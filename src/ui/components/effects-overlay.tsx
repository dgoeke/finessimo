import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

import { gameStateSignal } from "../../state/signals";

import type { UiEffect } from "../../state/types";

@customElement("effects-overlay")
export class EffectsOverlay extends SignalWatcher(LitElement) {
  // Light DOM so it inherits board-frame positioning and global styles
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
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
          drift,
        )}px; --fx-scale-from: ${String(scaleFrom)}; --fx-scale-to: ${String(
          scaleTo,
        )};"
      >
        <div
          class="fx-floating-text"
          style="color: ${e.color}; font-size: ${String(
            e.fontPx,
          )}px; font-weight: ${String(e.fontWeight ?? 800)};"
        >
          ${e.text}
        </div>
      </div>
    `;
  }

  protected render(): unknown {
    const state = gameStateSignal.get();
    const effects = state.uiEffects;
    if (effects.length === 0) {
      return html``;
    }

    return html`
      <div class="effects-overlay">
        ${effects.map((e) => this.renderEffect(e))}
      </div>
    `;
  }
}
