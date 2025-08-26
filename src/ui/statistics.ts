import { type GameState, type Stats } from "../state/types";

export type StatisticsRenderer = {
  initialize(container: HTMLElement): void;
  render(gameState: GameState): void;
  destroy(): void;
};

export class BasicStatisticsRenderer implements StatisticsRenderer {
  private container: HTMLElement | undefined;
  private elements: {
    performance?: HTMLElement | undefined;
    accuracy?: HTMLElement | undefined;
    session?: HTMLElement | undefined;
    placement?: HTMLElement | undefined;
    lineClears?: HTMLElement | undefined;
    faults?: HTMLElement | undefined;
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

    this.updatePerformanceMetrics(stats);
    this.updateAccuracyData(stats);
    this.updateSessionInformation(stats);
    this.updatePlacementStatistics(stats);
    this.updateLineClearBreakdown(stats);
    this.updateFaultAnalysis(stats);
  }

  private updatePerformanceMetrics(stats: Stats): void {
    const performanceEl = this.elements.performance;
    if (!performanceEl) return;

    const ppmEl = performanceEl.querySelector(".ppm-value");
    const lpmEl = performanceEl.querySelector(".lpm-value");
    const aipEl = performanceEl.querySelector(".aip-value");

    if (ppmEl) ppmEl.textContent = this.formatRate(stats.piecesPerMinute);
    if (lpmEl) lpmEl.textContent = this.formatRate(stats.linesPerMinute);
    if (aipEl)
      aipEl.textContent = this.formatDecimal(stats.averageInputsPerPiece);
  }

  private updateAccuracyData(stats: Stats): void {
    const accuracyEl = this.elements.accuracy;
    if (!accuracyEl) return;

    const accEl = accuracyEl.querySelector(".accuracy-value");
    const finesseEl = accuracyEl.querySelector(".finesse-value");

    if (accEl) {
      accEl.textContent = this.formatPercentage(stats.accuracyPercentage);
      const accClass = this.getAccuracyClass(stats.accuracyPercentage);
      accEl.classList.remove("excellent", "good", "average", "poor");
      accEl.classList.add("stat-value", "accuracy-value", accClass);
    }
    if (finesseEl) {
      finesseEl.textContent = this.formatPercentage(stats.finesseAccuracy);
      const finesseClass = this.getAccuracyClass(stats.finesseAccuracy);
      finesseEl.classList.remove("excellent", "good", "average", "poor");
      finesseEl.classList.add("stat-value", "finesse-value", finesseClass);
    }
  }

  private updateSessionInformation(stats: Stats): void {
    const sessionEl = this.elements.session;
    if (!sessionEl) return;

    const timeEl = sessionEl.querySelector(".time-value");
    const sessionsEl = sessionEl.querySelector(".sessions-value");
    const longestEl = sessionEl.querySelector(".longest-value");

    if (timeEl) timeEl.textContent = this.formatDuration(stats.timePlayedMs);
    if (sessionsEl) sessionsEl.textContent = stats.totalSessions.toString();
    if (longestEl)
      longestEl.textContent = this.formatDuration(stats.longestSessionMs);
  }

  private updatePlacementStatistics(stats: Stats): void {
    const placementEl = this.elements.placement;
    if (!placementEl) return;

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

  private updateLineClearBreakdown(stats: Stats): void {
    const lineClearsEl = this.elements.lineClears;
    if (!lineClearsEl) return;

    const singleEl = lineClearsEl.querySelector(".single-value");
    const doubleEl = lineClearsEl.querySelector(".double-value");
    const tripleEl = lineClearsEl.querySelector(".triple-value");
    const tetrisEl = lineClearsEl.querySelector(".tetris-value");

    if (singleEl) singleEl.textContent = stats.singleLines.toString();
    if (doubleEl) doubleEl.textContent = stats.doubleLines.toString();
    if (tripleEl) tripleEl.textContent = stats.tripleLines.toString();
    if (tetrisEl) tetrisEl.textContent = stats.tetrisLines.toString();
  }

  private updateFaultAnalysis(stats: Stats): void {
    const faultsEl = this.elements.faults;
    if (!faultsEl) return;

    const totalEl = faultsEl.querySelector(".total-faults");
    const breakdownEl = faultsEl.querySelector(".fault-breakdown");

    if (totalEl) totalEl.textContent = stats.totalFaults.toString();
    if (breakdownEl) {
      breakdownEl.innerHTML = this.formatFaultBreakdown(stats.faultsByType);
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
      this.container.querySelector<HTMLElement>("#performance") ?? undefined;
    this.elements.accuracy =
      this.container.querySelector<HTMLElement>("#accuracy") ?? undefined;
    this.elements.session =
      this.container.querySelector<HTMLElement>("#session") ?? undefined;
    this.elements.placement =
      this.container.querySelector<HTMLElement>("#placement") ?? undefined;
    this.elements.lineClears =
      this.container.querySelector<HTMLElement>("#lineClears") ?? undefined;
    this.elements.faults =
      this.container.querySelector<HTMLElement>("#faults") ?? undefined;
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
      return `${String(hours)}:${String(minutes % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    }
    return `${String(minutes)}:${String(seconds % 60).padStart(2, "0")}`;
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

  private formatFaultBreakdown(
    faultsByType: GameState["stats"]["faultsByType"],
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
          <span class="stat-value">${String(count)}</span>
        </div>`,
      )
      .join("");
  }
}
