// Phase 7: Results scene — animated counters & actions (no Phaser import)
import { SCENE_KEYS, type SceneController } from "./types";

// Summary data projected from GameState.stats by the caller.
// Keep it framework-agnostic; presentation decides how to show it.
export type ResultsSummary = Readonly<{
  linesCleared: number;
  piecesPlaced: number;
  accuracyPercentage: number; // 0..100
  timePlayedMs: number; // raw milliseconds
}>;

// Thin UI adapter for tweened counters, celebratory particles, and buttons.
// Real Phaser scene would implement this via rexUI + ParticleEmitter + Tweens.
export type ResultsUiAdapter = Readonly<{
  animateCounter(
    label: "lines" | "pieces" | "accuracy" | "timeSec",
    to: number,
    durationMs: number,
  ): void;
  emitParticles(kind: "celebration" | "subtle"): void;
  bindRetry(handler: () => void): void;
  bindMenu(handler: () => void): void;
}>;

export class Results /* extends Phaser.Scene */ {
  public scene: SceneController = { start: () => void 0 };

  create(): void {
    // Intentionally empty in headless phase
  }

  // Display results using provided UI adapter. Pure coordination here; adapters perform side-effects.
  show(summary: ResultsSummary, ui: ResultsUiAdapter): void {
    // Bind buttons to scene transitions
    ui.bindRetry(() => this.retry());
    ui.bindMenu(() => this.backToMenu());

    // Animate counters (simple, deterministic ordering). Durations chosen for readability.
    const D = 800; // ms per counter animation
    const timeSec = Math.max(0, Math.floor(summary.timePlayedMs / 1000));
    ui.animateCounter("lines", Math.max(0, summary.linesCleared | 0), D);
    ui.animateCounter("pieces", Math.max(0, summary.piecesPlaced | 0), D);
    ui.animateCounter(
      "accuracy",
      Math.max(0, Math.min(100, Math.round(summary.accuracyPercentage))),
      D,
    );
    ui.animateCounter("timeSec", timeSec, D);

    // Tasteful celebration on show
    ui.emitParticles("celebration");
  }

  retry(): void {
    this.scene.start(SCENE_KEYS.Gameplay);
  }

  backToMenu(): void {
    this.scene.start(SCENE_KEYS.MainMenu);
  }
}
