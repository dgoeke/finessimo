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

    return html`
      ${this.renderPerformanceSection(stats)}
      ${this.renderAccuracySection(stats)} ${this.renderPlacementSection(stats)}
      ${this.renderLineClearSection(stats)}
    `;
  }

  private renderPerformanceSection(stats: GameState["stats"]): unknown {
    return html`
      <div class="stat-section performance">
        <h4>Performance</h4>
        <div class="stat-row">
          <span class="stat-label">PPM:</span>
          <span class="stat-value ppm-value"
            >${this.formatRate(stats.piecesPerMinute)}</span
          >
        </div>
        <div class="stat-row">
          <span class="stat-label">LPM:</span>
          <span class="stat-value lpm-value"
            >${this.formatRate(stats.linesPerMinute)}</span
          >
        </div>
        <div class="stat-row">
          <span class="stat-label">Avg Inputs/Piece:</span>
          <span class="stat-value aip-value"
            >${this.formatDecimal(stats.averageInputsPerPiece)}</span
          >
        </div>
      </div>
    `;
  }

  private renderAccuracySection(stats: GameState["stats"]): unknown {
    return html`
      <div class="stat-section accuracy">
        <h4>Accuracy</h4>
        <div class="stat-row">
          <span class="stat-label">Overall:</span>
          <span
            class="stat-value accuracy-value ${this.getAccuracyClass(
              stats.accuracyPercentage,
            )}"
          >
            ${this.formatPercentage(stats.accuracyPercentage)}
          </span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Finesse:</span>
          <span
            class="stat-value finesse-value ${this.getAccuracyClass(
              stats.finesseAccuracy,
            )}"
          >
            ${this.formatPercentage(stats.finesseAccuracy)}
          </span>
        </div>
      </div>
    `;
  }

  private renderPlacementSection(stats: GameState["stats"]): unknown {
    return html`
      <div class="stat-section placement">
        <h4>Placements</h4>
        <div class="stat-row">
          <span class="stat-label">Pieces:</span>
          <span class="stat-value placed-value">${stats.piecesPlaced}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Lines:</span>
          <span class="stat-value cleared-value">${stats.linesCleared}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Optimal:</span>
          <span class="stat-value optimal-value success"
            >${stats.optimalPlacements}</span
          >
        </div>
        <div class="stat-row">
          <span class="stat-label">Incorrect:</span>
          <span class="stat-value incorrect-value error"
            >${stats.incorrectPlacements}</span
          >
        </div>
      </div>
    `;
  }

  private renderLineClearSection(stats: GameState["stats"]): unknown {
    return html`
      <div class="stat-section line-clears">
        <h4>Line Clears</h4>
        <div class="stat-row">
          <span class="stat-label">Singles:</span>
          <span class="stat-value single-value">${stats.singleLines}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Doubles:</span>
          <span class="stat-value double-value">${stats.doubleLines}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Triples:</span>
          <span class="stat-value triple-value">${stats.tripleLines}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Quads:</span>
          <span class="stat-value tetris-value">${stats.tetrisLines}</span>
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
