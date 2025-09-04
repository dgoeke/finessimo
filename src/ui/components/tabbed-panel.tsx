import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";

import type { TabId } from "../types/settings";

import "./stats-panel";
import "./settings-view";

@customElement("tabbed-panel")
export class TabbedPanel extends LitElement {
  @state() private activeTab: TabId = "stats";

  // Use light DOM for consistent styling
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private handleTabClick(tabId: TabId): void {
    this.activeTab = tabId;
  }

  protected render(): unknown {
    return html`
      <div class="tabbed-panel">
        <div class="tab-header">
          <button
            class="tab-button ${this.activeTab === "stats" ? "active" : ""}"
            @click=${(): void => this.handleTabClick("stats")}
            aria-label="Stats"
            title="Stats"
          >
            ▦
          </button>
          <button
            class="tab-button ${this.activeTab === "settings" ? "active" : ""}"
            @click=${(): void => this.handleTabClick("settings")}
            aria-label="Settings"
            title="Settings"
          >
            ⊙
          </button>
        </div>

        <div class="tab-content">${this.renderActiveTabContent()}</div>
      </div>
    `;
  }

  private renderActiveTabContent(): unknown {
    switch (this.activeTab) {
      case "stats": {
        return html`<stats-panel></stats-panel>`;
      }
      case "settings": {
        return html`<settings-view></settings-view>`;
      }
      default: {
        // Exhaustiveness check
        const _never: never = this.activeTab;
        return html`<div>Unknown tab: ${String(_never)}</div>`;
      }
    }
  }
}
