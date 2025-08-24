import { GameState } from "../state/types";

export interface StatisticsRenderer {
  initialize(container: HTMLElement): void;
  render(gameState: GameState): void;
  destroy(): void;
}

export class BasicStatisticsRenderer implements StatisticsRenderer {
  private container: HTMLElement | undefined;
  private elements: {
    performance?: HTMLElement;
    accuracy?: HTMLElement;
    session?: HTMLElement;
    placement?: HTMLElement;
    lineClears?: HTMLElement;
    faults?: HTMLElement;
  } = {};

  initialize(container: HTMLElement): void {
    this.container = container;
    this.createElements();
  }

  render(gameState: GameState): void {
    if (!this.container) {
      // Gracefully handle cases where renderer was never initialized (mobile)
      return;
    }

    const { stats } = gameState;

    // Update performance metrics
    const performanceEl = this.elements.performance;
    if (performanceEl) {
      const ppmEl = performanceEl.querySelector(".ppm-value");
      const lpmEl = performanceEl.querySelector(".lpm-value");
      const aipEl = performanceEl.querySelector(".aip-value");

      if (ppmEl) ppmEl.textContent = this.formatRate(stats.piecesPerMinute);
      if (lpmEl) lpmEl.textContent = this.formatRate(stats.linesPerMinute);
      if (aipEl)
        aipEl.textContent = this.formatDecimal(stats.averageInputsPerPiece);
    }

    // Update accuracy data
    const accuracyEl = this.elements.accuracy;
    if (accuracyEl) {
      const accEl = accuracyEl.querySelector(".accuracy-value");
      const finesseEl = accuracyEl.querySelector(".finesse-value");

      if (accEl) {
        accEl.textContent = this.formatPercentage(stats.accuracyPercentage);
        accEl.className = `accuracy-value ${this.getAccuracyClass(stats.accuracyPercentage)}`;
      }
      if (finesseEl) {
        finesseEl.textContent = this.formatPercentage(stats.finesseAccuracy);
        finesseEl.className = `finesse-value ${this.getAccuracyClass(stats.finesseAccuracy)}`;
      }
    }

    // Update session information
    const sessionEl = this.elements.session;
    if (sessionEl) {
      const timeEl = sessionEl.querySelector(".time-value");
      const sessionsEl = sessionEl.querySelector(".sessions-value");
      const longestEl = sessionEl.querySelector(".longest-value");

      if (timeEl) timeEl.textContent = this.formatDuration(stats.timePlayedMs);
      if (sessionsEl) sessionsEl.textContent = stats.totalSessions.toString();
      if (longestEl)
        longestEl.textContent = this.formatDuration(stats.longestSessionMs);
    }

    // Update placement statistics
    const placementEl = this.elements.placement;
    if (placementEl) {
      const placedEl = placementEl.querySelector(".placed-value");
      const clearedEl = placementEl.querySelector(".cleared-value");
      const optimalEl = placementEl.querySelector(".optimal-value");
      const incorrectEl = placementEl.querySelector(".incorrect-value");

      if (placedEl) placedEl.textContent = stats.piecesPlaced.toString();
      if (clearedEl) clearedEl.textContent = stats.linesCleared.toString();
      if (optimalEl) optimalEl.textContent = stats.optimalPlacements.toString();
      if (incorrectEl)
        incorrectEl.textContent = stats.incorrectPlacements.toString();
    }

    // Update line clear breakdown
    const lineClearsEl = this.elements.lineClears;
    if (lineClearsEl) {
      const singleEl = lineClearsEl.querySelector(".single-value");
      const doubleEl = lineClearsEl.querySelector(".double-value");
      const tripleEl = lineClearsEl.querySelector(".triple-value");
      const tetrisEl = lineClearsEl.querySelector(".tetris-value");

      if (singleEl) singleEl.textContent = stats.singleLines.toString();
      if (doubleEl) doubleEl.textContent = stats.doubleLines.toString();
      if (tripleEl) tripleEl.textContent = stats.tripleLines.toString();
      if (tetrisEl) tetrisEl.textContent = stats.tetrisLines.toString();
    }

    // Update fault analysis
    const faultsEl = this.elements.faults;
    if (faultsEl) {
      const totalEl = faultsEl.querySelector(".total-faults");
      const breakdownEl = faultsEl.querySelector(".fault-breakdown");

      if (totalEl) totalEl.textContent = stats.totalFaults.toString();
      if (breakdownEl) {
        breakdownEl.innerHTML = this.formatFaultBreakdown(stats.faultsByType);
      }
    }
  }

  private createElements(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="stat-section performance" id="performance">
          <h4>Performance</h4>
          <div class="stat-row">
            <span class="stat-label">PPM:</span>
            <span class="ppm-value stat-value">0.0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">LPM:</span>
            <span class="lpm-value stat-value">0.0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Avg Inputs/Piece:</span>
            <span class="aip-value stat-value">0.0</span>
          </div>
        </div>

        <div class="stat-section accuracy" id="accuracy">
          <h4>Accuracy</h4>
          <div class="stat-row">
            <span class="stat-label">Overall:</span>
            <span class="accuracy-value stat-value">0%</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Finesse:</span>
            <span class="finesse-value stat-value">0%</span>
          </div>
        </div>

        <div class="stat-section session" id="session">
          <h4>Session</h4>
          <div class="stat-row">
            <span class="stat-label">Time Played:</span>
            <span class="time-value stat-value">0:00</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Total Sessions:</span>
            <span class="sessions-value stat-value">0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Longest Session:</span>
            <span class="longest-value stat-value">0:00</span>
          </div>
        </div>

        <div class="stat-section placement" id="placement">
          <h4>Placements</h4>
          <div class="stat-row">
            <span class="stat-label">Pieces:</span>
            <span class="placed-value stat-value">0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Lines:</span>
            <span class="cleared-value stat-value">0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Optimal:</span>
            <span class="optimal-value stat-value success">0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Incorrect:</span>
            <span class="incorrect-value stat-value error">0</span>
          </div>
        </div>

        <div class="stat-section line-clears" id="lineClears">
          <h4>Line Clears</h4>
          <div class="stat-row">
            <span class="stat-label">Singles:</span>
            <span class="single-value stat-value">0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Doubles:</span>
            <span class="double-value stat-value">0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Triples:</span>
            <span class="triple-value stat-value">0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Tetrises:</span>
            <span class="tetris-value stat-value">0</span>
          </div>
        </div>

        <div class="stat-section faults" id="faults">
          <h4>Faults</h4>
          <div class="stat-row">
            <span class="stat-label">Total:</span>
            <span class="total-faults stat-value">0</span>
          </div>
          <div class="fault-breakdown"></div>
        </div>
    `;

    // Store references to elements
    this.elements.performance =
      this.container.querySelector("#performance") ?? undefined;
    this.elements.accuracy =
      this.container.querySelector("#accuracy") ?? undefined;
    this.elements.session =
      this.container.querySelector("#session") ?? undefined;
    this.elements.placement =
      this.container.querySelector("#placement") ?? undefined;
    this.elements.lineClears =
      this.container.querySelector("#lineClears") ?? undefined;
    this.elements.faults = this.container.querySelector("#faults") ?? undefined;
  }

  destroy(): void {
    if (this.container) {
      this.container.innerHTML = "";
    }
    this.container = undefined;
    this.elements = {};
  }

  // Helper functions for formatting
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
  }

  private formatPercentage(value: number): string {
    return `${Math.round(value)}%`;
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

  private formatFaultBreakdown(
    faultsByType: Partial<Record<string, number>>,
  ): string {
    const entries = Object.entries(faultsByType);
    if (entries.length === 0) {
      return '<div class="stat-row"><span class="stat-label">None</span></div>';
    }

    return entries
      .map(
        ([type, count]) =>
          `<div class="stat-row">
          <span class="stat-label">${type}:</span>
          <span class="stat-value">${count}</span>
        </div>`,
      )
      .join("");
  }
}
