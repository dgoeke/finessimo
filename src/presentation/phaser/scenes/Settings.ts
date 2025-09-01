// PR4: Real Phaser Settings scene — maps rexUI (or simple) controls to store actions
import Phaser from "phaser";

import { dispatch } from "../../../state/signals";
import { createDurationMs } from "../../../types/brands";

import { SCENE_KEYS } from "./types";

import type { GameplayConfig, TimingConfig } from "../../../state/types";

// Local action type for ports (avoids leaking broad Action union here)
type SettingsAction =
  | { type: "UpdateTiming"; timing: Partial<TimingConfig> }
  | { type: "UpdateGameplay"; gameplay: Partial<GameplayConfig> };

type PartialTiming = Parameters<Settings["updateTimingMs"]>[0];
type PartialGameplay = Parameters<Settings["updateGameplay"]>[0];

type SettingsPorts = {
  dispatch: (a: SettingsAction) => void;
  load: () => { timing?: PartialTiming; gameplay?: PartialGameplay } | null;
  save: (fragment: {
    timing?: PartialTiming;
    gameplay?: PartialGameplay;
  }) => void;
};

/**
 * Settings scene: minimal visual shell plus mapping helpers.
 * UI may be implemented with rexUI; helpers remain pure-call sites for store updates.
 */
export class Settings extends Phaser.Scene {
  private readonly STORAGE_KEY = "finessimo";
  private _ports: SettingsPorts;

  constructor() {
    super({ key: SCENE_KEYS.Settings });
    this._ports = this.defaultPorts();
  }

  create(): void {
    // Load from storage and apply without dispatching (edge)
    const initial = this._ports.load();
    if (initial) this.applySettings(initial);
    // Build rexUI-only controls
    this.buildRexUiControls(initial);
  }

  backToMenu(): void {
    this.scene.start(SCENE_KEYS.MainMenu);
  }

  // Build rexUI-based settings column
  private buildRexUiControls(
    initial: {
      timing?: PartialTiming;
      gameplay?: PartialGameplay;
    } | null,
  ): void {
    const w = this.scale.width;
    const header = this.add.text(0, 0, "Settings", {
      color: "#ffffff",
      fontFamily: "monospace",
      fontSize: "18px",
    });
    header.setOrigin(0.5, 0.5);

    const column = this.rexUI.add.sizer({
      orientation: 1,
      space: { item: 10 },
      x: w / 2,
      y: 60,
    });
    column.add(header, { align: "center" });

    const t = initial?.timing ?? {};
    const g = initial?.gameplay ?? {};
    this.buildTimingControls(column, t);
    this.buildGameplayControls(column, g);

    const backBg = this.rexUI.add.roundRectangle(0, 0, 120, 32, 6, 0x223344);
    const backTxt = this.add.text(0, 0, "< Back", {
      color: "#a0e7ff",
      fontFamily: "monospace",
      fontSize: "14px",
    });
    const back = this.rexUI.add.label({
      background: backBg,
      text: backTxt,
    }) as RexUIInternal.Base;
    backBg.setInteractive();
    backBg.on("pointerdown", () => this.backToMenu());
    column.add(back, { align: "center" });

    column.layout();
  }

  private createLabeledSlider(opts: {
    label: string;
    min: number;
    max: number;
    initial: number;
    onValue: (v: number) => void;
  }): RexUIInternal.Sizer {
    const row = this.rexUI.add.sizer({ orientation: 0, space: { item: 6 } });
    const lbl = this.add.text(0, 0, opts.label, {
      color: "#ffffff",
      fontFamily: "monospace",
      fontSize: "14px",
    });
    const track = this.rexUI.add.roundRectangle(0, 0, 200, 8, 4, 0x334455);
    const thumb = this.rexUI.add.roundRectangle(0, 0, 16, 16, 8, 0xaad4ff);
    const slider = this.rexUI.add.slider({
      thumb,
      track,
      value: (opts.initial - opts.min) / (opts.max - opts.min),
      width: 220,
    });
    slider.on("valuechange", (value) => {
      const v = opts.min + value * (opts.max - opts.min);
      opts.onValue(v);
    });
    row.add(lbl);
    row.add(slider, { expand: true, proportion: 1 });
    return row;
  }

  private buildTimingControls(
    column: RexUIInternal.Sizer,
    t: PartialTiming,
  ): void {
    const getNum = (n: unknown, def: number): number =>
      typeof n === "number" && Number.isFinite(n) ? n : def;

    column.add(
      this.createLabeledSlider({
        initial: getNum(t.dasMs, 133),
        label: "DAS (ms)",
        max: 400,
        min: 0,
        onValue: (v) => this.updateTimingMs({ dasMs: Math.round(v) }),
      }),
    );
    column.add(
      this.createLabeledSlider({
        initial: getNum(t.arrMs, 2),
        label: "ARR (ms)",
        max: 400,
        min: 0,
        onValue: (v) => this.updateTimingMs({ arrMs: Math.round(v) }),
      }),
    );
    column.add(
      this.createLabeledSlider({
        initial: getNum(t.lockDelayMs, 500),
        label: "Lock Delay (ms)",
        max: 1000,
        min: 0,
        onValue: (v) => this.updateTimingMs({ lockDelayMs: Math.round(v) }),
      }),
    );
    column.add(
      this.createLabeledSlider({
        initial: getNum(t.lineClearDelayMs, 0),
        label: "Line Clear Delay (ms)",
        max: 1000,
        min: 0,
        onValue: (v) =>
          this.updateTimingMs({ lineClearDelayMs: Math.round(v) }),
      }),
    );
    column.add(
      this.createLabeledSlider({
        initial: getNum(t.gravityMs, 500),
        label: "Gravity (ms)",
        max: 2000,
        min: 50,
        onValue: (v) => this.updateTimingMs({ gravityMs: Math.round(v) }),
      }),
    );

    // Gravity enabled toggle
    column.add(
      this.createCheckboxRow(
        "Gravity Enabled",
        typeof t.gravityEnabled === "boolean" ? t.gravityEnabled : false,
        (on) => this.updateTimingMs({ gravityEnabled: on }),
      ),
    );
  }

  private buildGameplayControls(
    column: RexUIInternal.Sizer,
    g: PartialGameplay,
  ): void {
    const getBool = (b: unknown, def: boolean): boolean =>
      typeof b === "boolean" ? b : def;
    column.add(
      this.createCheckboxRow(
        "Ghost Piece",
        getBool(g.ghostPieceEnabled, true),
        (on) => this.updateGameplay({ ghostPieceEnabled: on }),
      ),
    );
    column.add(
      this.createCheckboxRow(
        "Hold Enabled",
        getBool(g.holdEnabled, true),
        (on) => this.updateGameplay({ holdEnabled: on }),
      ),
    );
    column.add(
      this.createCheckboxRow(
        "Finesse Feedback",
        getBool(g.finesseFeedbackEnabled, true),
        (on) => this.updateGameplay({ finesseFeedbackEnabled: on }),
      ),
    );
    column.add(
      this.createCheckboxRow(
        "Finesse Boop",
        getBool(g.finesseBoopEnabled, false),
        (on) => this.updateGameplay({ finesseBoopEnabled: on }),
      ),
    );
    column.add(
      this.createCheckboxRow(
        "Retry on Finesse Error",
        getBool(g.retryOnFinesseError, false),
        (on) => this.updateGameplay({ retryOnFinesseError: on }),
      ),
    );
  }
  private createCheckboxRow(
    label: string,
    initial: boolean,
    onToggle: (on: boolean) => void,
  ): RexUIInternal.Sizer {
    const row = this.rexUI.add.sizer({ orientation: 0, space: { item: 6 } });
    const lbl = this.add.text(0, 0, label, {
      color: "#ffffff",
      fontFamily: "monospace",
      fontSize: "14px",
    });
    const checkbox = this.rexUI.add.checkbox({ color: 0x88cc88, size: 18 });
    checkbox.setChecked(initial);
    checkbox.on("valuechange", (checked: boolean) => onToggle(checked));
    row.add(lbl);
    row.add(checkbox);
    return row;
  }

  // --- Ports / DI for functional edges ---
  attachPorts(ports: SettingsPorts): void {
    this._ports = ports;
  }

  private defaultPorts(): SettingsPorts {
    return {
      dispatch: (a) => dispatch(a),
      load: () => this.loadSettingsFromStorage(),
      save: (f) => this.saveSettingsToStorage(f),
    };
  }

  // --- Settings mapping helpers (UI → Actions) ---

  /**
   * Update timing settings from numbers/flags (boundary conversion to brands).
   * Accepts a narrow subset that menus commonly modify; safe to call with partials.
   */
  updateTimingMs(
    partial: Partial<{
      arrMs: number;
      dasMs: number;
      gravityEnabled: boolean;
      gravityMs: number;
      lineClearDelayMs: number;
      lockDelayMs: number;
      softDrop: TimingConfig["softDrop"];
    }>,
  ): void {
    const timing: Partial<TimingConfig> = {};
    if (partial.arrMs !== undefined)
      timing.arrMs = createDurationMs(partial.arrMs);
    if (partial.dasMs !== undefined)
      timing.dasMs = createDurationMs(partial.dasMs);
    if (partial.gravityEnabled !== undefined)
      timing.gravityEnabled = partial.gravityEnabled;
    if (partial.gravityMs !== undefined)
      timing.gravityMs = createDurationMs(partial.gravityMs);
    if (partial.lineClearDelayMs !== undefined)
      timing.lineClearDelayMs = createDurationMs(partial.lineClearDelayMs);
    if (partial.lockDelayMs !== undefined)
      timing.lockDelayMs = createDurationMs(partial.lockDelayMs);
    if (partial.softDrop !== undefined) timing.softDrop = partial.softDrop;

    if (Object.keys(timing).length > 0) {
      this._ports.dispatch({ timing, type: "UpdateTiming" });
      // Persist partial settings
      this._ports.save({ timing: partial });
    }
  }

  /**
   * Update gameplay toggles and durations from primitives; converts numbers to brands.
   */
  updateGameplay(
    partial: Partial<{
      finesseCancelMs: number;
      ghostPieceEnabled: boolean;
      nextPieceCount: number;
      holdEnabled: boolean;
      finesseFeedbackEnabled: boolean;
      finesseBoopEnabled: boolean;
      retryOnFinesseError: boolean;
    }>,
  ): void {
    const gameplay: Partial<GameplayConfig> = {};
    if (partial.finesseCancelMs !== undefined)
      gameplay.finesseCancelMs = createDurationMs(partial.finesseCancelMs);
    if (partial.ghostPieceEnabled !== undefined)
      gameplay.ghostPieceEnabled = partial.ghostPieceEnabled;
    if (partial.nextPieceCount !== undefined)
      gameplay.nextPieceCount = partial.nextPieceCount;
    if (partial.holdEnabled !== undefined)
      gameplay.holdEnabled = partial.holdEnabled;
    if (partial.finesseFeedbackEnabled !== undefined)
      gameplay.finesseFeedbackEnabled = partial.finesseFeedbackEnabled;
    if (partial.finesseBoopEnabled !== undefined)
      gameplay.finesseBoopEnabled = partial.finesseBoopEnabled;
    if (partial.retryOnFinesseError !== undefined)
      gameplay.retryOnFinesseError = partial.retryOnFinesseError;

    if (Object.keys(gameplay).length > 0) {
      this._ports.dispatch({ gameplay, type: "UpdateGameplay" });
      // Persist partial settings
      this._ports.save({ gameplay: partial });
    }
  }

  /** Convenience: set both timing and gameplay in one call */
  applySettings(opts: {
    timing?: Parameters<Settings["updateTimingMs"]>[0];
    gameplay?: Parameters<Settings["updateGameplay"]>[0];
  }): void {
    if (opts.timing) this.updateTimingMs(opts.timing);
    if (opts.gameplay) this.updateGameplay(opts.gameplay);
  }

  // --- Persistence (edge only) ---

  /** Load just the settings portion from shared storage key if present. */
  private loadSettingsFromStorage(): {
    timing?: Parameters<Settings["updateTimingMs"]>[0];
    gameplay?: Parameters<Settings["updateGameplay"]>[0];
  } | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw === null || raw === "") return null;
      const parsed: unknown = JSON.parse(raw);
      if (!(typeof parsed === "object" && parsed !== null)) return null;

      const settingsRaw = (parsed as Record<string, unknown>)["settings"];
      if (!(typeof settingsRaw === "object" && settingsRaw !== null))
        return null;

      const rec = settingsRaw as Record<string, unknown>;
      const maybeTiming = this.pickTimingPartial(rec);
      const maybeGameplay = this.pickGameplayPartial(rec);
      const out: {
        timing?: Parameters<Settings["updateTimingMs"]>[0];
        gameplay?: Parameters<Settings["updateGameplay"]>[0];
      } = {};
      if (Object.keys(maybeTiming).length > 0) out.timing = maybeTiming;
      if (Object.keys(maybeGameplay).length > 0) out.gameplay = maybeGameplay;
      return out;
    } catch {
      return null;
    }
  }

  /** Merge and persist a settings fragment under the shared key. */
  private saveSettingsToStorage(fragment: {
    timing?: Parameters<Settings["updateTimingMs"]>[0];
    gameplay?: Parameters<Settings["updateGameplay"]>[0];
  }): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      const base: Record<string, unknown> =
        raw !== null && raw !== ""
          ? (JSON.parse(raw) as Record<string, unknown>)
          : {};
      const prevSettingsRaw = base["settings"];
      const prevSettings: Record<string, unknown> =
        typeof prevSettingsRaw === "object" && prevSettingsRaw !== null
          ? (prevSettingsRaw as Record<string, unknown>)
          : {};
      const nextSettings = {
        ...prevSettings,
        ...(fragment.timing ?? {}),
        ...(fragment.gameplay ?? {}),
      };
      const out = { ...base, settings: nextSettings };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(out));
    } catch {
      // ignore storage errors in non-browser or private mode
    }
  }

  // --- narrowers and pickers to keep complexity low ---
  private isNumber(u: unknown): u is number {
    return typeof u === "number" && Number.isFinite(u);
  }

  private isBoolean(u: unknown): u is boolean {
    return typeof u === "boolean";
  }

  private pickTimingPartial(
    rec: Record<string, unknown>,
  ): Parameters<Settings["updateTimingMs"]>[0] {
    const t: Parameters<Settings["updateTimingMs"]>[0] = {};
    if (this.isNumber(rec["arrMs"])) t.arrMs = rec["arrMs"];
    if (this.isNumber(rec["dasMs"])) t.dasMs = rec["dasMs"];
    if (this.isBoolean(rec["gravityEnabled"]))
      t.gravityEnabled = rec["gravityEnabled"];
    if (this.isNumber(rec["gravityMs"])) t.gravityMs = rec["gravityMs"];
    if (this.isNumber(rec["lineClearDelayMs"]))
      t.lineClearDelayMs = rec["lineClearDelayMs"];
    if (this.isNumber(rec["lockDelayMs"])) t.lockDelayMs = rec["lockDelayMs"];
    const sd = rec["softDrop"];
    if (sd === "infinite" || this.isNumber(sd))
      t.softDrop = sd as TimingConfig["softDrop"];
    return t;
  }

  private pickGameplayPartial(
    rec: Record<string, unknown>,
  ): Parameters<Settings["updateGameplay"]>[0] {
    const g: Parameters<Settings["updateGameplay"]>[0] = {};
    if (this.isNumber(rec["finesseCancelMs"]))
      g.finesseCancelMs = rec["finesseCancelMs"];
    if (this.isBoolean(rec["ghostPieceEnabled"]))
      g.ghostPieceEnabled = rec["ghostPieceEnabled"];
    if (this.isNumber(rec["nextPieceCount"]))
      g.nextPieceCount = rec["nextPieceCount"];
    if (this.isBoolean(rec["holdEnabled"])) g.holdEnabled = rec["holdEnabled"];
    if (this.isBoolean(rec["finesseFeedbackEnabled"]))
      g.finesseFeedbackEnabled = rec["finesseFeedbackEnabled"];
    if (this.isBoolean(rec["finesseBoopEnabled"]))
      g.finesseBoopEnabled = rec["finesseBoopEnabled"];
    if (this.isBoolean(rec["retryOnFinesseError"]))
      g.retryOnFinesseError = rec["retryOnFinesseError"];
    return g;
  }
}
