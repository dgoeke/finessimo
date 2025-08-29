import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

import "./finesse-overlay";
import "./game-board";
import "./effects-overlay";
import "./piece-hold";
import "./piece-preview";
import "./stats-panel";
import "./settings-modal";

@customElement("finessimo-shell")
export class FinessimoShell extends LitElement {
  // Use light DOM so existing getElementById calls work and styles apply
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  protected render(): unknown {
    return html`
      <main class="app shell">
        <section class="hold-column">
          <piece-hold></piece-hold>
        </section>

        <section class="board-column">
          <div class="board-frame">
            <game-board></game-board>
            <effects-overlay></effects-overlay>
          </div>
        </section>

        <section class="preview-column">
          <div class="preview-stats-row">
            <piece-preview></piece-preview>
            <div class="stats-panel-container panel">
              <stats-panel></stats-panel>
            </div>
          </div>
        </section>
      </main>

      <!-- Finesse overlay positioned as fixed overlay -->
      <finesse-overlay></finesse-overlay>

      <!-- Settings modal overlay -->
      <settings-modal></settings-modal>
    `;
  }
}
