import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

import { gameStateSignal, stateSelectors } from "../../state/signals";

import type { GameState } from "../../state/types";

@customElement("stats-panel")
export class StatsPanel extends LitElement {
  private updateTimer: number | undefined;
  private readonly UPDATE_INTERVAL_MS = 500; // 2Hz update rate

  // Use light DOM for consistent styling
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Start periodic updates when component is connected
    this.updateTimer = window.setInterval(() => {
      this.requestUpdate();
    }, this.UPDATE_INTERVAL_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Clean up timer when component is disconnected
    if (this.updateTimer !== undefined) {
      window.clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }
  }

  protected render(): unknown {
    // Read current state from signal (updated via timer, not reactive)
    const state = gameStateSignal.get();
    const { stats } = stateSelectors.getStatsState(state);

    return html` ${this.renderPerformanceSection(stats)} `;
  }

  private renderPerformanceSection(stats: GameState["stats"]): unknown {
    return html`
      <div class="stat-section performance">
        <div class="stat-row">
          <span class="stat-label">Accuracy:</span>
          <span
            class="stat-value accuracy-value ${this.getAccuracyClass(
              stats.accuracyPercentage,
            )}"
          >
            ${this.formatPercentage(stats.accuracyPercentage)}
          </span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Inputs/Piece:</span>
          <span class="stat-value aip-value"
            >${this.formatDecimal(stats.averageInputsPerPiece)}</span
          >
        </div>
        <div class="stat-row">
          <span class="stat-label">PPM:</span>
          <span class="stat-value ppm-value"
            >${this.formatRate(stats.piecesPerMinute)}</span
          >
        </div>
      </div>
    `;
  }

  private formatPercentage(value: number): string {
    return `${String(Math.round(value))}%`;
  }

  private formatRate(value: number): string {
    return value.toFixed(1);
  }

  private formatDecimal(value: number): string {
    return value.toFixed(1);
  }

  private getAccuracyClass(percentage: number): string {
    if (percentage >= 90) return "excellent";
    if (percentage >= 80) return "good";
    if (percentage >= 70) return "average";
    return "poor";
  }
}
