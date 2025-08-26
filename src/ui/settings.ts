import {
  type KeyBindings,
  defaultKeyBindings,
  type BindableAction,
} from "../input/keyboard";
import { type GameState } from "../state/types";

export type GameSettings = {
  // Timing settings
  dasMs: number;
  arrMs: number;
  // Soft drop: number = multiplier of gravity, or 'infinite' (teleport without lock)
  softDrop?: number | "infinite";
  // No CPS value here; engine derives behavior from softDrop
  lockDelayMs: number;
  lineClearDelayMs: number;

  // Gameplay settings
  gravityEnabled: boolean;
  gravityMs: number;
  finesseCancelMs: number;
  ghostPieceEnabled: boolean;
  nextPieceCount: number;

  // Visual settings
  boardTheme: string;
  showGrid: boolean;
  uiScale: number;
  // Controls
  keyBindings?: KeyBindings;
};

export type SettingsRenderer = {
  initialize(container: HTMLElement): void;
  render(gameState: GameState): void;
  show(): void;
  hide(): void;
  destroy(): void;
  onSettingsChange(callback: (settings: Partial<GameSettings>) => void): void;
};

export class BasicSettingsRenderer implements SettingsRenderer {
  private container: HTMLElement | undefined;
  private settingsPanel: HTMLElement | undefined;
  private settingsChangeCallback?: (settings: Partial<GameSettings>) => void;
  private currentSettings: GameSettings;
  private currentKeyBindings: KeyBindings;
  private rebindingAction?: BindableAction | undefined;
  private boundCaptureHandler?: (e: KeyboardEvent) => void;

  // Type guards and coercers for robust store parsing
  private isRecord(x: unknown): x is Record<string, unknown> {
    return typeof x === "object" && x !== null;
  }
  private isStringArray(a: unknown): a is Array<string> {
    return Array.isArray(a) && a.every((s) => typeof s === "string");
  }
  private readonly BINDABLE_ACTIONS: ReadonlyArray<BindableAction> = [
    "MoveLeft",
    "MoveRight",
    "SoftDrop",
    "HardDrop",
    "RotateCW",
    "RotateCCW",
    "Hold",
  ];
  private coerceKeyBindings(maybe: unknown): KeyBindings {
    const fb = defaultKeyBindings();
    if (!this.isRecord(maybe)) return fb;
    const out: KeyBindings = { ...fb };
    const rec: Record<string, unknown> = maybe;
    for (const action of this.BINDABLE_ACTIONS) {
      const v = rec[action];
      out[action] = this.isStringArray(v) ? [...v] : [...fb[action]];
    }
    return out;
  }
  private coerceSettings(maybe: unknown): Partial<GameSettings> {
    if (!this.isRecord(maybe)) return {};
    const s = maybe;
    const out: Partial<GameSettings> = {};
    const isNum = (v: unknown): v is number => typeof v === "number";
    const isBool = (v: unknown): v is boolean => typeof v === "boolean";
    const isStr = (v: unknown): v is string => typeof v === "string";

    this.coerceTimingSettings(s, out, isNum);
    this.coerceGameplaySettings(s, out, isNum, isBool);
    this.coerceVisualSettings(s, out, isStr, isBool, isNum);

    return out;
  }

  private coerceTimingSettings(
    s: Record<string, unknown>,
    out: Partial<GameSettings>,
    isNum: (v: unknown) => v is number,
  ): void {
    if (isNum(s["dasMs"])) out.dasMs = s["dasMs"];
    if (isNum(s["arrMs"])) out.arrMs = s["arrMs"];
    if (isNum(s["lockDelayMs"])) out.lockDelayMs = s["lockDelayMs"];
    if (isNum(s["lineClearDelayMs"]))
      out.lineClearDelayMs = s["lineClearDelayMs"];
  }

  private coerceGameplaySettings(
    s: Record<string, unknown>,
    out: Partial<GameSettings>,
    isNum: (v: unknown) => v is number,
    isBool: (v: unknown) => v is boolean,
  ): void {
    if (isBool(s["gravityEnabled"])) out.gravityEnabled = s["gravityEnabled"];
    if (isNum(s["gravityMs"])) out.gravityMs = s["gravityMs"];
    if (isNum(s["finesseCancelMs"])) out.finesseCancelMs = s["finesseCancelMs"];
    if (isBool(s["ghostPieceEnabled"]))
      out.ghostPieceEnabled = s["ghostPieceEnabled"];
    if (isNum(s["nextPieceCount"])) out.nextPieceCount = s["nextPieceCount"];
  }

  private coerceVisualSettings(
    s: Record<string, unknown>,
    out: Partial<GameSettings>,
    isStr: (v: unknown) => v is string,
    isBool: (v: unknown) => v is boolean,
    isNum: (v: unknown) => v is number,
  ): void {
    if (isStr(s["boardTheme"])) out.boardTheme = s["boardTheme"];
    if (isBool(s["showGrid"])) out.showGrid = s["showGrid"];
    if (isNum(s["uiScale"])) out.uiScale = s["uiScale"];
  }

  constructor() {
    this.currentSettings = this.getDefaultSettings();
    const { keyBindings, settings } = this.loadStoreFromStorage();
    this.currentSettings = { ...this.currentSettings, ...settings };
    this.currentKeyBindings = keyBindings;
  }

  initialize(container: HTMLElement): void {
    this.container = container;
    this.createSettingsPanel();
    this.bindEvents();
  }

  render(gameState: GameState): void {
    // Update settings UI to reflect current game state
    this.syncSettingsFromGameState(gameState);
  }

  show(): void {
    if (this.settingsPanel) {
      this.settingsPanel.style.display = "block";
      document.body.classList.add("settings-open");
    }
  }

  hide(): void {
    if (this.settingsPanel) {
      this.stopRebinding();
      this.settingsPanel.style.display = "none";
      document.body.classList.remove("settings-open");
    }
  }

  onSettingsChange(callback: (settings: Partial<GameSettings>) => void): void {
    this.settingsChangeCallback = callback;
  }

  // Expose current snapshots so the app can apply persisted settings on init
  getCurrentSettings(): GameSettings {
    return { ...this.currentSettings };
  }
  getCurrentKeyBindings(): KeyBindings {
    return {
      HardDrop: [...this.currentKeyBindings.HardDrop],
      Hold: [...this.currentKeyBindings.Hold],
      MoveLeft: [...this.currentKeyBindings.MoveLeft],
      MoveRight: [...this.currentKeyBindings.MoveRight],
      RotateCCW: [...this.currentKeyBindings.RotateCCW],
      RotateCW: [...this.currentKeyBindings.RotateCW],
      SoftDrop: [...this.currentKeyBindings.SoftDrop],
    };
  }

  private getDefaultSettings(): GameSettings {
    return {
      arrMs: 2,
      // Visual settings
      boardTheme: "default",
      // Timing settings (matching default TimingConfig)
      dasMs: 133,
      finesseCancelMs: 50, // 50ms cancellation window
      ghostPieceEnabled: true,

      // Gameplay settings
      gravityEnabled: false, // Disabled by default for trainer
      gravityMs: 1000, // 1 second per cell
      lineClearDelayMs: 0,
      lockDelayMs: 500, // 0.5 seconds
      nextPieceCount: 5,

      showGrid: true,
      softDrop: 10, // UI multiplier (× gravity); 41 => infinite in UI
      uiScale: 1.0,
    };
  }

  private readonly STORAGE_KEY = "finessimo";

  private loadStoreFromStorage(): {
    settings: Partial<GameSettings>;
    keyBindings: KeyBindings;
  } {
    // Consolidated store: { settings?: GameSettings, keyBindings?: KeyBindings }
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw !== null && raw !== "") {
        const parsed: unknown = JSON.parse(raw);
        if (this.isRecord(parsed)) {
          const kb =
            "keyBindings" in parsed
              ? this.coerceKeyBindings(parsed["keyBindings"])
              : defaultKeyBindings();
          const s =
            "settings" in parsed ? this.coerceSettings(parsed["settings"]) : {};
          return { keyBindings: kb, settings: s };
        }
      }
      // Legacy migration: read old keys if present
      const legacySettingsRaw = localStorage.getItem("finessimo-settings");
      const legacyKbRaw = localStorage.getItem("finessimo-keybindings");
      const settings = this.coerceSettings(
        legacySettingsRaw !== null && legacySettingsRaw !== ""
          ? JSON.parse(legacySettingsRaw)
          : undefined,
      );
      const keyBindings = this.coerceKeyBindings(
        legacyKbRaw !== null && legacyKbRaw !== ""
          ? JSON.parse(legacyKbRaw)
          : undefined,
      );
      // Save consolidated for future
      this.saveStoreToStorage(settings, keyBindings);
      return { keyBindings, settings };
    } catch (error) {
      console.warn("Failed to load store from localStorage:", error);
      return { keyBindings: defaultKeyBindings(), settings: {} };
    }
  }

  private saveStoreToStorage(
    settings: Partial<GameSettings>,
    keyBindings: KeyBindings,
  ): void {
    try {
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({ keyBindings, settings }),
      );
    } catch (error) {
      console.warn("Failed to save store to localStorage:", error);
    }
  }

  // Deprecated; kept for API compatibility in tests if referenced indirectly

  // Removed in favor of coerceKeyBindings; kept to avoid breaking API, but unused.
  // private validateKeyBindings(_maybe: unknown): KeyBindings { return this.coerceKeyBindings(_maybe); }

  private createTimingPanel(): string {
    const sdfValue =
      this.currentSettings.softDrop === "infinite"
        ? 41
        : typeof this.currentSettings.softDrop === "number"
          ? this.currentSettings.softDrop
          : 10;
    const clampedSdf = Math.max(5, Math.min(41, sdfValue));
    const sdfDisplay = clampedSdf === 41 ? "∞" : `${String(clampedSdf)}x`;

    return `
      <div class="settings-panel active" id="timing-panel">
        <div class="setting-group">
          <label>DAS - Delayed Auto Shift (ms)</label>
          <input type="range" id="das-delay" min="50" max="300" step="1" value="${String(this.currentSettings.dasMs)}">
          <span class="value-display">${String(this.currentSettings.dasMs)}ms</span>
        </div>
        
        <div class="setting-group">
          <label>ARR - Automatic Repeat Rate (ms)</label>
          <input type="range" id="arr-rate" min="0" max="100" step="1" value="${String(this.currentSettings.arrMs)}">
          <span class="value-display">${String(this.currentSettings.arrMs)}ms</span>
        </div>
        
        <div class="setting-group">
          <label>SDF - Soft Drop Factor (× Gravity)</label>
          <input type="range" id="soft-drop-speed" min="5" max="41" step="1" value="${String(clampedSdf)}">
          <span class="value-display">${sdfDisplay}</span>
        </div>
        
        <div class="setting-group">
          <label>Lock Delay (ms)</label>
          <input type="range" id="lock-delay" min="100" max="1000" step="10" value="${String(this.currentSettings.lockDelayMs)}">
          <span class="value-display">${String(this.currentSettings.lockDelayMs)}ms</span>
        </div>
        
        <div class="setting-group">
          <label>Line Clear Delay (ms)</label>
          <input type="range" id="line-clear-delay" min="0" max="500" step="10" value="${String(this.currentSettings.lineClearDelayMs)}">
          <span class="value-display">${String(this.currentSettings.lineClearDelayMs)}ms</span>
        </div>
      </div>
    `;
  }

  private createGameplayPanel(): string {
    return `
      <div class="settings-panel" id="gameplay-panel">
        <div class="setting-group">
          <label>
            <input type="checkbox" id="gravity-enabled" ${this.currentSettings.gravityEnabled ? "checked" : ""}>
            Enable Gravity
          </label>
        </div>
        
        <div class="setting-group">
          <label>Gravity Speed (ms per cell)</label>
          <input type="range" id="gravity-speed" min="50" max="2000" step="50" value="${String(this.currentSettings.gravityMs)}">
          <span class="value-display">${String(this.currentSettings.gravityMs)}ms</span>
        </div>
        
        <div class="setting-group">
          <label>Finesse Cancel Window (ms)</label>
          <input type="range" id="finesse-cancel" min="0" max="100" step="5" value="${String(this.currentSettings.finesseCancelMs)}">
          <span class="value-display">${String(this.currentSettings.finesseCancelMs)}ms</span>
        </div>
        
        <div class="setting-group">
          <label>
            <input type="checkbox" id="ghost-piece" ${this.currentSettings.ghostPieceEnabled ? "checked" : ""}>
            Show Ghost Piece
          </label>
        </div>
        
        <div class="setting-group">
          <label>Next Pieces to Show</label>
          <input type="range" id="next-count" min="1" max="7" step="1" value="${String(this.currentSettings.nextPieceCount)}">
          <span class="value-display">${String(this.currentSettings.nextPieceCount)}</span>
        </div>
      </div>
    `;
  }

  private createVisualPanel(): string {
    return `
      <div class="settings-panel" id="visual-panel">
        <div class="setting-group">
          <label>Board Theme</label>
          <select id="board-theme">
            <option value="default" ${this.currentSettings.boardTheme === "default" ? "selected" : ""}>Default</option>
            <option value="classic" ${this.currentSettings.boardTheme === "classic" ? "selected" : ""}>Classic</option>
            <option value="minimal" ${this.currentSettings.boardTheme === "minimal" ? "selected" : ""}>Minimal</option>
          </select>
        </div>
        
        <div class="setting-group">
          <label>
            <input type="checkbox" id="show-grid" ${this.currentSettings.showGrid ? "checked" : ""}>
            Show Grid Lines
          </label>
        </div>
        
        <div class="setting-group">
          <label>UI Scale</label>
          <input type="range" id="ui-scale" min="0.8" max="1.5" step="0.1" value="${String(this.currentSettings.uiScale)}">
          <span class="value-display">${String(this.currentSettings.uiScale)}x</span>
        </div>
      </div>
    `;
  }

  private createControlsPanel(): string {
    return `
      <div class="settings-panel" id="controls-panel">
        <div class="setting-group">
          <p>Click a keybind, then press any key to rebind.</p>
        </div>
        <div class="keybinds-list">
          ${this.renderKeybindRow("Move Left", "MoveLeft")}
          ${this.renderKeybindRow("Move Right", "MoveRight")}
          ${this.renderKeybindRow("Rotate CCW", "RotateCCW")}
          ${this.renderKeybindRow("Rotate CW", "RotateCW")}
          ${this.renderKeybindRow("Soft Drop", "SoftDrop")}
          ${this.renderKeybindRow("Hard Drop", "HardDrop")}
          ${this.renderKeybindRow("Hold", "Hold")}
        </div>
      </div>
    `;
  }

  private createSettingsHeader(): string {
    return `
      <div class="settings-header">
        <h2>Settings</h2>
        <button class="close-button" id="close-settings">×</button>
      </div>
    `;
  }

  private createSettingsTabs(): string {
    return `
      <div class="settings-tabs">
        <button class="tab-button active" data-tab="timing">Timing</button>
        <button class="tab-button" data-tab="gameplay">Gameplay</button>
        <button class="tab-button" data-tab="visual">Visual</button>
        <button class="tab-button" data-tab="controls">Controls</button>
      </div>
    `;
  }

  private createSettingsFooter(): string {
    return `
      <div class="settings-footer">
        <button class="button secondary" id="reset-settings">Reset to Defaults</button>
        <button class="button primary" id="apply-settings">Apply</button>
      </div>
    `;
  }

  private createSettingsPanel(): void {
    if (!this.container) return;

    const overlay = document.createElement("div");
    overlay.className = "settings-overlay";
    overlay.innerHTML = `
      <div class="settings-modal">
        ${this.createSettingsHeader()}
        
        <div class="settings-content">
          ${this.createSettingsTabs()}
          
          <div class="settings-panels">
            ${this.createTimingPanel()}
            ${this.createGameplayPanel()}
            ${this.createVisualPanel()}
            ${this.createControlsPanel()}
          </div>
        </div>
        
        ${this.createSettingsFooter()}
      </div>
    `;

    this.settingsPanel = overlay;
    document.body.appendChild(overlay);
    this.hide();
  }

  private bindEvents(): void {
    if (!this.settingsPanel) return;

    // Close button
    const closeButton = this.settingsPanel.querySelector("#close-settings");
    closeButton?.addEventListener("click", () => this.hide());

    // Close on overlay click
    this.settingsPanel.addEventListener("click", (e) => {
      if (e.target === this.settingsPanel) {
        this.hide();
      }
    });

    // Tab switching
    const tabButtons =
      this.settingsPanel.querySelectorAll<HTMLButtonElement>(".tab-button");
    tabButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        const target = e.target as Element | null;
        const tabName = target?.getAttribute("data-tab");
        if (tabName !== null && tabName !== undefined && tabName !== "")
          this.switchTab(tabName);
      });
    });

    // Settings controls
    this.bindSettingControls();

    // Action buttons
    const resetButton =
      this.settingsPanel.querySelector<HTMLButtonElement>("#reset-settings");
    resetButton?.addEventListener("click", () => this.resetToDefaults());

    const applyButton =
      this.settingsPanel.querySelector<HTMLButtonElement>("#apply-settings");
    applyButton?.addEventListener("click", () => this.applySettings());
  }

  private bindSettingControls(): void {
    if (!this.settingsPanel) return;

    this.bindRangeInputs();
    this.bindKeybindingButtons();
  }

  private bindRangeInputs(): void {
    if (!this.settingsPanel) return;

    const rangeInputs = this.settingsPanel.querySelectorAll<HTMLInputElement>(
      'input[type="range"]',
    );
    rangeInputs.forEach((input) => {
      const valueDisplay =
        input.parentElement?.querySelector<HTMLElement>(".value-display");

      input.addEventListener("input", () => {
        if (valueDisplay) {
          const suffix = this.getSuffixForInput(input.id);
          const display = this.formatInputValue(input.value, input.id, suffix);
          valueDisplay.textContent = display;
        }
      });
    });
  }

  private formatInputValue(
    value: string,
    inputId: string,
    suffix: string,
  ): string {
    if (inputId === "soft-drop-speed" && value === "41") return "∞";
    return `${value}${suffix}`;
  }

  private bindKeybindingButtons(): void {
    if (!this.settingsPanel) return;

    const bindButtons = this.settingsPanel.querySelectorAll<HTMLElement>(
      "[data-keybind-action]",
    );
    bindButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.currentTarget;
        if (!(target instanceof HTMLElement)) return;
        const action = target.getAttribute(
          "data-keybind-action",
        ) as BindableAction | null;
        if (action !== null) {
          this.startRebinding(action, target);
        }
      });
    });
  }

  private switchTab(tabName: string): void {
    if (!this.settingsPanel) return;

    // Update tab buttons
    const tabButtons = this.settingsPanel.querySelectorAll(".tab-button");
    tabButtons.forEach((button) => {
      button.classList.remove("active");
      if (button.getAttribute("data-tab") === tabName) {
        button.classList.add("active");
      }
    });

    // Update panels
    const panels = this.settingsPanel.querySelectorAll(".settings-panel");
    panels.forEach((panel) => {
      panel.classList.remove("active");
      if (panel.id === `${tabName}-panel`) {
        panel.classList.add("active");
      }
    });
  }

  private syncSettingsFromGameState(gameState: GameState): void {
    // Update current settings to match game state
    this.currentSettings = {
      ...this.currentSettings,
      arrMs: gameState.timing.arrMs,
      dasMs: gameState.timing.dasMs,
      finesseCancelMs: gameState.gameplay.finesseCancelMs,
      gravityMs: gameState.timing.gravityMs,
      lineClearDelayMs: gameState.timing.lineClearDelayMs,
      lockDelayMs: gameState.timing.lockDelayMs,
      softDrop: gameState.timing.softDrop,
    };
  }

  private applySettings(): void {
    if (!this.settingsPanel) return;

    const newSettings: Partial<GameSettings> = {};

    this.collectTimingSettings(newSettings);
    this.collectGameplaySettings(newSettings);
    this.collectVisualSettings(newSettings);

    // Update internal settings
    this.currentSettings = { ...this.currentSettings, ...newSettings };

    // Save to storage
    this.saveStoreToStorage(this.currentSettings, this.currentKeyBindings);

    // Notify callback
    if (this.settingsChangeCallback) {
      // Include keybindings with settings change so input handler can update
      this.settingsChangeCallback({
        ...newSettings,
        keyBindings: this.currentKeyBindings,
      });
    }

    // Hide panel
    this.hide();
  }

  private collectTimingSettings(newSettings: Partial<GameSettings>): void {
    if (!this.settingsPanel) return;

    const dasInput =
      this.settingsPanel.querySelector<HTMLInputElement>("#das-delay");
    if (dasInput) newSettings.dasMs = parseInt(dasInput.value);

    const arrInput =
      this.settingsPanel.querySelector<HTMLInputElement>("#arr-rate");
    if (arrInput) newSettings.arrMs = parseInt(arrInput.value);

    // Soft drop multiplier UI: 41 => infinite, otherwise finite multiplier
    const softDropInput =
      this.settingsPanel.querySelector<HTMLInputElement>("#soft-drop-speed");
    if (softDropInput) {
      const multiplier = parseInt(softDropInput.value);
      newSettings.softDrop = multiplier >= 41 ? "infinite" : multiplier;
    }

    const lockDelayInput =
      this.settingsPanel.querySelector<HTMLInputElement>("#lock-delay");
    if (lockDelayInput)
      newSettings.lockDelayMs = parseInt(lockDelayInput.value);

    const lineClearDelayInput =
      this.settingsPanel.querySelector<HTMLInputElement>("#line-clear-delay");
    if (lineClearDelayInput)
      newSettings.lineClearDelayMs = parseInt(lineClearDelayInput.value);
  }

  private collectGameplaySettings(newSettings: Partial<GameSettings>): void {
    if (!this.settingsPanel) return;

    const gravityEnabledInput =
      this.settingsPanel.querySelector<HTMLInputElement>("#gravity-enabled");
    if (gravityEnabledInput)
      newSettings.gravityEnabled = gravityEnabledInput.checked;

    const gravitySpeedInput =
      this.settingsPanel.querySelector<HTMLInputElement>("#gravity-speed");
    if (gravitySpeedInput)
      newSettings.gravityMs = parseInt(gravitySpeedInput.value);

    const finesseCancelInput =
      this.settingsPanel.querySelector<HTMLInputElement>("#finesse-cancel");
    if (finesseCancelInput)
      newSettings.finesseCancelMs = parseInt(finesseCancelInput.value);

    const ghostPieceInput =
      this.settingsPanel.querySelector<HTMLInputElement>("#ghost-piece");
    if (ghostPieceInput)
      newSettings.ghostPieceEnabled = ghostPieceInput.checked;

    const nextCountInput =
      this.settingsPanel.querySelector<HTMLInputElement>("#next-count");
    if (nextCountInput)
      newSettings.nextPieceCount = parseInt(nextCountInput.value);
  }

  private collectVisualSettings(newSettings: Partial<GameSettings>): void {
    if (!this.settingsPanel) return;

    const themeSelect =
      this.settingsPanel.querySelector<HTMLSelectElement>("#board-theme");
    if (themeSelect) newSettings.boardTheme = themeSelect.value;

    const showGridInput =
      this.settingsPanel.querySelector<HTMLInputElement>("#show-grid");
    if (showGridInput) newSettings.showGrid = showGridInput.checked;

    const uiScaleInput =
      this.settingsPanel.querySelector<HTMLInputElement>("#ui-scale");
    if (uiScaleInput) newSettings.uiScale = parseFloat(uiScaleInput.value);
  }

  private resetToDefaults(): void {
    // Reset internal models
    this.currentSettings = this.getDefaultSettings();
    this.currentKeyBindings = defaultKeyBindings();
    this.saveStoreToStorage(this.currentSettings, this.currentKeyBindings);

    // Update UI controls in-place (do not close dialog)
    this.updateInputsFromSettings();
    this.updateKeybindButtons();
    this.stopRebinding();

    // Notify listeners for live update
    if (this.settingsChangeCallback) {
      this.settingsChangeCallback({
        ...this.currentSettings,
        keyBindings: this.currentKeyBindings,
      });
    }
  }

  destroy(): void {
    if (this.settingsPanel?.parentNode) {
      this.settingsPanel.parentNode.removeChild(this.settingsPanel);
    }
    this.container = undefined;
    this.settingsPanel = undefined;
  }

  // --- Keybindings helpers ---
  private renderKeybindRow(label: string, action: BindableAction): string {
    const code = this.currentKeyBindings[action][0] ?? "";
    const keyLabel = this.formatKey(code);
    return `
      <div class="keybind-row">
        <div class="keybind-label">${label}</div>
        <button class="keybind-button" data-keybind-action="${action}" aria-label="Rebind ${label}">${keyLabel}</button>
        <span class="keybind-hint" data-hint-for="${action}" style="display:none;">Press any key…</span>
        <button class="keybind-cancel" data-cancel-for="${action}" style="display:none;">Cancel</button>
      </div>
    `;
  }

  private startRebinding(action: BindableAction, buttonEl: HTMLElement): void {
    if (!this.settingsPanel) return;
    // Indicate listening
    this.stopRebinding();
    this.rebindingAction = action;
    const hint = this.settingsPanel.querySelector<HTMLElement>(
      `[data-hint-for="${action}"]`,
    );
    if (hint) hint.style.display = "inline";
    buttonEl.classList.add("listening");

    this.boundCaptureHandler = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopImmediatePropagation();
      // Update binding to single key for this action
      const updated: KeyBindings = {
        ...this.currentKeyBindings,
        [action]: [e.code],
      };
      this.currentKeyBindings = updated;
      this.saveStoreToStorage(this.currentSettings, this.currentKeyBindings);

      // Update UI label
      buttonEl.textContent = this.formatKey(e.code);

      // Notify immediately for live update
      if (this.settingsChangeCallback) {
        this.settingsChangeCallback({ keyBindings: this.currentKeyBindings });
      }

      // Done
      this.stopRebinding();
    };

    window.addEventListener("keydown", this.boundCaptureHandler, {
      capture: true,
      once: true,
    });

    // Show cancel button and wire it
    const cancelBtn = this.settingsPanel.querySelector<HTMLButtonElement>(
      `[data-cancel-for="${action}"]`,
    );
    if (cancelBtn) {
      cancelBtn.style.display = "inline-block";
      const cancelHandler = (ev: Event): void => {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        this.stopRebinding();
        cancelBtn.removeEventListener("click", cancelHandler);
      };
      cancelBtn.addEventListener("click", cancelHandler);
    }
  }

  private stopRebinding(): void {
    if (!this.settingsPanel) return;
    if (this.rebindingAction !== undefined) {
      const hint = this.settingsPanel.querySelector<HTMLElement>(
        `[data-hint-for='${this.rebindingAction}']`,
      );
      if (hint) hint.style.display = "none";
      const btn = this.settingsPanel.querySelector<HTMLElement>(
        `[data-keybind-action='${this.rebindingAction}']`,
      );
      btn?.classList.remove("listening");
      const cancel = this.settingsPanel.querySelector<HTMLElement>(
        `[data-cancel-for='${this.rebindingAction}']`,
      );
      if (cancel) cancel.style.display = "none";
    }
    if (this.boundCaptureHandler) {
      // Remove pending listener if still attached
      window.removeEventListener("keydown", this.boundCaptureHandler, true);
    }
    this.rebindingAction = undefined;
  }

  private setElementValue(el: Element, val: string | number | boolean): void {
    if (el instanceof HTMLInputElement) {
      if (el.type === "checkbox") {
        el.checked = Boolean(val);
      } else {
        el.value = String(val);
      }
    } else if (el instanceof HTMLSelectElement) {
      el.value = String(val);
    }
  }

  private updateValueDisplay(el: Element): void {
    const display =
      el.parentElement?.querySelector<HTMLElement>(".value-display");
    if (!display || !(el instanceof HTMLInputElement)) return;

    const id = el.id;
    const suffix = this.getSuffixForInput(id);
    const valStr = el.value;

    display.textContent =
      id === "soft-drop-speed" && valStr === "41" ? "∞" : `${valStr}${suffix}`;
  }

  private getSuffixForInput(id: string): string {
    if (id === "soft-drop-speed" || id === "ui-scale") return "x";
    if (
      id === "arr-rate" ||
      id === "das-delay" ||
      id.includes("delay") ||
      id.includes("cancel") ||
      id === "gravity-speed"
    )
      return "ms";
    return "";
  }

  private updateInputsFromSettings(): void {
    if (!this.settingsPanel) return;
    const panel = this.settingsPanel;
    const setVal = (sel: string, val: string | number | boolean): void => {
      const el = panel.querySelector(sel);
      if (!el) return;

      this.setElementValue(el, val);
      this.updateValueDisplay(el);
    };
    // Timing
    setVal("#das-delay", this.currentSettings.dasMs);
    setVal("#arr-rate", this.currentSettings.arrMs);
    {
      const m =
        this.currentSettings.softDrop === "infinite"
          ? 41
          : Math.max(
              5,
              Math.min(
                41,
                typeof this.currentSettings.softDrop === "string"
                  ? Number(this.currentSettings.softDrop)
                  : (this.currentSettings.softDrop ?? 10),
              ),
            );
      const val = Math.max(5, Math.min(41, m));
      setVal("#soft-drop-speed", val);
      // Fix display suffix to 'x' or ∞ for soft drop
      const el =
        this.settingsPanel.querySelector<HTMLInputElement>("#soft-drop-speed");
      const display =
        el?.parentElement?.querySelector<HTMLElement>(".value-display");
      if (el && display)
        display.textContent = val === 41 ? "∞" : `${el.value}x`;
    }
    setVal("#lock-delay", this.currentSettings.lockDelayMs);
    setVal("#line-clear-delay", this.currentSettings.lineClearDelayMs);
    // Gameplay
    setVal("#gravity-enabled", this.currentSettings.gravityEnabled);
    setVal("#gravity-speed", this.currentSettings.gravityMs);
    setVal("#finesse-cancel", this.currentSettings.finesseCancelMs);
    setVal("#ghost-piece", this.currentSettings.ghostPieceEnabled);
    setVal("#next-count", this.currentSettings.nextPieceCount);
    // Visual
    setVal("#board-theme", this.currentSettings.boardTheme);
    setVal("#show-grid", this.currentSettings.showGrid);
    setVal("#ui-scale", this.currentSettings.uiScale);
  }

  private updateKeybindButtons(): void {
    if (!this.settingsPanel) return;
    const all: Array<[BindableAction, string]> = [
      ["MoveLeft", "Move Left"],
      ["MoveRight", "Move Right"],
      ["SoftDrop", "Soft Drop"],
      ["HardDrop", "Hard Drop"],
      ["RotateCW", "Rotate CW"],
      ["RotateCCW", "Rotate CCW"],
      ["Hold", "Hold"],
    ];
    for (const [action] of all) {
      const code = this.currentKeyBindings[action][0] ?? "";
      const label = this.formatKey(code);
      const btn = this.settingsPanel.querySelector<HTMLElement>(
        `[data-keybind-action="${action}"]`,
      );
      const hint = this.settingsPanel.querySelector<HTMLElement>(
        `[data-hint-for="${action}"]`,
      );
      const cancel = this.settingsPanel.querySelector<HTMLElement>(
        `[data-cancel-for="${action}"]`,
      );
      if (btn) btn.textContent = label;
      if (hint) hint.style.display = "none";
      if (cancel) cancel.style.display = "none";
      btn?.classList.remove("listening");
    }
  }

  // Deprecated individual keybinding save now uses consolidated store

  private formatKey(code: string): string {
    const map: Record<string, string> = {
      AltLeft: "LAlt",
      AltRight: "RAlt",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",
      ArrowUp: "↑",
      Backquote: "`",
      Backslash: "\\",
      Backspace: "Backspace",
      BracketLeft: "[",
      BracketRight: "]",
      CapsLock: "Caps",
      Comma: ",",
      ControlLeft: "LCtrl",
      ControlRight: "RCtrl",
      Enter: "Enter",
      Equal: "=",
      Escape: "Esc",
      MetaLeft: "LCmd",
      MetaRight: "RCmd",
      Minus: "-",
      Period: ".",
      Quote: "'",
      Semicolon: ";",
      ShiftLeft: "LShift",
      ShiftRight: "RShift",
      Slash: "/",
      Space: "Space",
      Tab: "Tab",
    };
    if (code === "") return "";
    if (map[code] !== undefined) return map[code];
    if (code.startsWith("Key") && code.length === 4) return code.slice(3);
    if (code.startsWith("Digit") && code.length === 6) return code.slice(5);
    return code;
  }
}
