import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import {
  type KeyBindings,
  defaultKeyBindings,
  type BindableAction,
} from "../../input/keyboard";
import { gameStateSignal } from "../../state/signals";

import type { GameState } from "../../state/types";

export type GameSettings = {
  // Timing settings
  dasMs: number;
  arrMs: number;
  softDrop?: number | "infinite";
  lockDelayMs: number;
  lineClearDelayMs: number;

  // Gameplay settings
  gravityEnabled: boolean;
  gravityMs: number;
  finesseCancelMs: number;
  ghostPieceEnabled: boolean;
  nextPieceCount: number;

  // Finesse settings
  finesseFeedbackEnabled: boolean;
  finesseBoopEnabled: boolean;
  retryOnFinesseError: boolean;

  // Controls
  keyBindings?: KeyBindings;
  // Minimal playtest toggle
  mode?: "freePlay" | "guided";
};

@customElement("settings-modal")
export class SettingsModal extends LitElement {
  @property({ reflect: true, type: Boolean }) visible = false;

  @state() private currentTab = "timing";
  @state() private rebindingAction: BindableAction | undefined = undefined;

  private currentSettings: GameSettings;
  private currentKeyBindings: KeyBindings;
  private settingsSnapshot?: GameSettings;
  private keyBindingsSnapshot?: KeyBindings;
  private changesApplied = false;
  private boundCaptureHandler?: (e: KeyboardEvent) => void;
  private boundBlockHandler?: (e: KeyboardEvent) => void;

  // Use light DOM so existing styles work
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  static styles = css`
    :host {
      display: none;
    }

    :host([visible]) {
      display: block;
    }

    .settings-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    }

    .settings-modal {
      background: var(--panel-bg, #1a1d23);
      border: 2px solid var(--border, #333);
      border-radius: 8px;
      width: 90%;
      max-width: 600px;
      max-height: 90vh;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }

    .settings-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border, #333);
      background: var(--header-bg, #0d0f12);
    }

    .settings-header h2 {
      margin: 0;
      color: var(--text, #e7eaf0);
      font-size: 1.25rem;
    }

    .close-button {
      background: none;
      border: none;
      color: var(--text-dim, #9aa3b2);
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .close-button:hover {
      background: var(--hover-bg, #374151);
      color: var(--text, #e7eaf0);
    }

    .settings-content {
      display: flex;
      flex-direction: column;
      height: calc(100% - 140px);
      min-height: 400px;
    }

    .settings-tabs {
      display: flex;
      border-bottom: 1px solid var(--border, #333);
      background: var(--tab-bg, #0f1419);
    }

    .tab-button {
      flex: 1;
      padding: 0.75rem 1rem;
      background: none;
      border: none;
      color: var(--text-dim, #9aa3b2);
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .tab-button:hover {
      background: var(--hover-bg, #1a1f26);
      color: var(--text, #e7eaf0);
    }

    .tab-button.active {
      background: var(--panel-bg, #1a1d23);
      color: var(--accent, #22d3ee);
      border-bottom: 2px solid var(--accent, #22d3ee);
    }

    .settings-panels {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
    }

    .settings-panel {
      display: none;
    }

    .settings-panel.active {
      display: block;
    }

    .setting-group {
      margin-bottom: 1.5rem;
    }

    .setting-group:last-child {
      margin-bottom: 0;
    }

    .setting-group label {
      display: block;
      color: var(--text, #e7eaf0);
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }

    .setting-group input[type="range"] {
      width: 100%;
      margin: 0.5rem 0;
    }

    .setting-group input[type="checkbox"] {
      margin-right: 0.5rem;
    }

    .setting-group select {
      width: 100%;
      padding: 0.5rem;
      background: var(--input-bg, #0d0f12);
      border: 1px solid var(--border, #333);
      border-radius: 4px;
      color: var(--text, #e7eaf0);
    }

    .value-display {
      color: var(--accent, #22d3ee);
      font-family: "JetBrains Mono", monospace;
      font-size: 0.875rem;
      float: right;
    }

    .keybinds-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .keybind-row {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .keybind-label {
      flex: 1;
      color: var(--text, #e7eaf0);
      font-size: 0.875rem;
    }

    .keybind-button {
      min-width: 100px;
      padding: 0.5rem 1rem;
      background: var(--input-bg, #0d0f12);
      border: 1px solid var(--border, #333);
      border-radius: 4px;
      color: var(--text, #e7eaf0);
      cursor: pointer;
      font-family: "JetBrains Mono", monospace;
      transition: all 0.2s;
    }

    .keybind-button:hover {
      border-color: var(--accent, #22d3ee);
    }

    .keybind-button.listening {
      border-color: var(--accent, #22d3ee);
      background: var(--accent-dim, rgba(34, 211, 238, 0.1));
    }

    .keybind-hint {
      color: var(--accent, #22d3ee);
      font-size: 0.75rem;
      font-style: italic;
    }

    .keybind-cancel {
      padding: 0.25rem 0.5rem;
      background: var(--danger, #ef4444);
      border: none;
      border-radius: 4px;
      color: white;
      cursor: pointer;
      font-size: 0.75rem;
    }

    .settings-footer {
      display: flex;
      justify-content: flex-end;
      gap: 1rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border, #333);
      background: var(--header-bg, #0d0f12);
    }

    .button {
      padding: 0.5rem 1.5rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;
    }

    .button.primary {
      background: var(--accent, #22d3ee);
      color: var(--bg, #0a0a0b);
    }

    .button.primary:hover {
      background: var(--accent-bright, #06b6d4);
    }

    .button.secondary {
      background: var(--panel-bg, #374151);
      color: var(--text, #e7eaf0);
      border: 1px solid var(--border, #333);
    }

    .button.secondary:hover {
      background: var(--hover-bg, #4b5563);
    }

    .mode-option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .help-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border: 1px solid var(--text-dim, #9aa3b2);
      border-radius: 50%;
      font-size: 11px;
      font-weight: bold;
      color: var(--text-dim, #9aa3b2);
      cursor: help;
      position: relative;
    }

    .help-icon:hover {
      border-color: var(--accent, #22d3ee);
      color: var(--accent, #22d3ee);
    }
  `;

  constructor() {
    super();
    this.currentSettings = this.getDefaultSettings();
    const { keyBindings, settings } = this.loadStoreFromStorage();
    this.currentSettings = { ...this.currentSettings, ...settings };
    this.currentKeyBindings = keyBindings;
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopRebinding();
  }

  show(): void {
    // Sync settings from current game state when opening the modal
    // so the UI reflects any live changes applied while playing
    const gameState = gameStateSignal.get();
    this.syncSettingsFromGameState(gameState);

    // Create snapshots for cancel functionality
    this.settingsSnapshot = { ...this.currentSettings };
    this.keyBindingsSnapshot = this.deepCopyKeyBindings(
      this.currentKeyBindings,
    );
    this.changesApplied = false;

    this.visible = true;
    document.body.classList.add("settings-open");
    // Emit event to pause game
    this.dispatchEvent(
      new CustomEvent("settings-opened", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  hide(): void {
    // If changes weren't applied, restore from snapshots
    if (
      !this.changesApplied &&
      this.settingsSnapshot &&
      this.keyBindingsSnapshot
    ) {
      this.currentSettings = { ...this.settingsSnapshot };
      this.currentKeyBindings = this.deepCopyKeyBindings(
        this.keyBindingsSnapshot,
      );
      // Force re-render to update UI controls
      this.requestUpdate();
    }

    this.visible = false;
    document.body.classList.remove("settings-open");
    this.stopRebinding();
    // Emit event to unpause game
    this.dispatchEvent(
      new CustomEvent("settings-closed", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  // Expose current settings for app initialization
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

  protected render(): unknown {
    if (!this.visible) return html``;

    return html`
      <div
        class="settings-overlay"
        @click=${(e: Event): void => this.handleOverlayClick(e)}
      >
        <div class="settings-modal">
          ${this.renderHeader()}
          <div class="settings-content">
            ${this.renderTabs()}
            <div class="settings-panels">
              ${this.renderTimingPanel()} ${this.renderGameplayPanel()}
              ${this.renderFinessePanel()} ${this.renderControlsPanel()}
            </div>
          </div>
          ${this.renderFooter()}
        </div>
      </div>
    `;
  }

  private renderHeader(): unknown {
    return html`
      <div class="settings-header">
        <h2>Settings</h2>
        <button class="close-button" @click=${(): void => this.hide()}>
          ×
        </button>
      </div>
    `;
  }

  private renderTabs(): unknown {
    const tabs = [
      { id: "timing", label: "Handling" },
      { id: "gameplay", label: "Gameplay" },
      { id: "finesse", label: "Finesse" },
      { id: "controls", label: "Controls" },
    ];

    return html`
      <div class="settings-tabs">
        ${tabs.map(
          (tab) => html`
            <button
              class="tab-button ${this.currentTab === tab.id ? "active" : ""}"
              @click=${(): void => this.switchTab(tab.id)}
            >
              ${tab.label}
            </button>
          `,
        )}
      </div>
    `;
  }

  private renderModeSelection(): unknown {
    return html`
      <div class="setting-group">
        <label>Game Mode</label>
        <div>
          <label style="margin-right: 1rem;">
            <div class="mode-option">
              <input
                type="radio"
                name="mode-select"
                value="freePlay"
                .checked=${this.currentSettings.mode === "freePlay"}
                @change=${(): void => {
                  this.currentSettings.mode = "freePlay";
                }}
              />
              Free Play
              <span class="help-icon">
                i
                <div class="finessimo-tooltip">
                  Play a standard game using your favorite settings
                </div>
              </span>
            </div>
          </label>
          <label>
            <div class="mode-option">
              <input
                type="radio"
                name="mode-select"
                value="guided"
                .checked=${this.currentSettings.mode === "guided"}
                @change=${(): void => {
                  this.currentSettings.mode = "guided";
                }}
              />
              Guided (SRS)
              <span class="help-icon">
                i
                <div class="finessimo-tooltip">
                  Used a spaced repetitions system to learn<br />
                  the optimal moves to reach your target.
                </div>
              </span>
            </div>
          </label>
        </div>
      </div>
    `;
  }

  private renderTimingPanel(): unknown {
    const sdfValue =
      this.currentSettings.softDrop === "infinite"
        ? 41
        : typeof this.currentSettings.softDrop === "number"
          ? this.currentSettings.softDrop
          : 10;
    const clampedSdf = Math.max(5, Math.min(41, sdfValue));
    const sdfDisplay = clampedSdf === 41 ? "∞" : `${String(clampedSdf)}x`;

    return html`
      <div
        class="settings-panel ${this.currentTab === "timing" ? "active" : ""}"
      >
        ${this.renderModeSelection()}

        <div class="setting-group">
          <label>DAS - Delayed Auto Shift (ms)</label>
          <input
            type="range"
            id="das-delay"
            min="50"
            max="300"
            step="1"
            .value=${String(this.currentSettings.dasMs)}
            @input=${(e: Event): void => this.handleRangeInput(e)}
          />
          <span class="value-display"
            >${String(this.currentSettings.dasMs)}ms</span
          >
        </div>

        <div class="setting-group">
          <label>ARR - Automatic Repeat Rate (ms)</label>
          <input
            type="range"
            id="arr-rate"
            min="0"
            max="100"
            step="1"
            .value=${String(this.currentSettings.arrMs)}
            @input=${(e: Event): void => this.handleRangeInput(e)}
          />
          <span class="value-display"
            >${String(this.currentSettings.arrMs)}ms</span
          >
        </div>

        <div class="setting-group">
          <label>SDF - Soft Drop Factor (× Gravity)</label>
          <input
            type="range"
            id="soft-drop-speed"
            min="5"
            max="41"
            step="1"
            .value=${String(clampedSdf)}
            @input=${(e: Event): void => this.handleRangeInput(e)}
          />
          <span class="value-display">${sdfDisplay}</span>
        </div>

        <div class="setting-group">
          <label>Lock Delay (ms)</label>
          <input
            type="range"
            id="lock-delay"
            min="100"
            max="1000"
            step="10"
            .value=${String(this.currentSettings.lockDelayMs)}
            @input=${(e: Event): void => this.handleRangeInput(e)}
          />
          <span class="value-display"
            >${String(this.currentSettings.lockDelayMs)}ms</span
          >
        </div>

        <div class="setting-group">
          <label>Line Clear Delay (ms)</label>
          <input
            type="range"
            id="line-clear-delay"
            min="0"
            max="1000"
            step="10"
            .value=${String(this.currentSettings.lineClearDelayMs)}
            @input=${(e: Event): void => this.handleRangeInput(e)}
          />
          <span class="value-display"
            >${String(this.currentSettings.lineClearDelayMs)}ms</span
          >
        </div>
      </div>
    `;
  }

  private renderGameplayPanel(): unknown {
    return html`
      <div
        class="settings-panel ${this.currentTab === "gameplay" ? "active" : ""}"
      >
        <div class="setting-group">
          <label>
            <input
              type="checkbox"
              id="gravity-enabled"
              .checked=${this.currentSettings.gravityEnabled}
            />
            Enable Gravity
          </label>
        </div>

        <div class="setting-group">
          <label>Gravity Speed (ms per cell)</label>
          <input
            type="range"
            id="gravity-speed"
            min="50"
            max="2000"
            step="50"
            .value=${String(this.currentSettings.gravityMs)}
            @input=${(e: Event): void => this.handleRangeInput(e)}
          />
          <span class="value-display"
            >${String(this.currentSettings.gravityMs)}ms</span
          >
        </div>

        <div class="setting-group">
          <label>Finesse Cancel Window (ms)</label>
          <input
            type="range"
            id="finesse-cancel"
            min="0"
            max="100"
            step="5"
            .value=${String(this.currentSettings.finesseCancelMs)}
            @input=${(e: Event): void => this.handleRangeInput(e)}
          />
          <span class="value-display"
            >${String(this.currentSettings.finesseCancelMs)}ms</span
          >
        </div>

        <div class="setting-group">
          <label>
            <input
              type="checkbox"
              id="ghost-piece"
              .checked=${this.currentSettings.ghostPieceEnabled}
            />
            Show Ghost Piece
          </label>
        </div>

        <div class="setting-group">
          <label>Next Pieces to Show</label>
          <input
            type="range"
            id="next-count"
            min="1"
            max="7"
            step="1"
            .value=${String(this.currentSettings.nextPieceCount)}
            @input=${(e: Event): void => this.handleRangeInput(e)}
          />
          <span class="value-display"
            >${String(this.currentSettings.nextPieceCount)}</span
          >
        </div>
      </div>
    `;
  }

  private renderFinessePanel(): unknown {
    return html`
      <div
        class="settings-panel ${this.currentTab === "finesse" ? "active" : ""}"
      >
        <div class="setting-group">
          <label>
            <input
              type="checkbox"
              id="finesse-feedback-enabled"
              .checked=${this.currentSettings.finesseFeedbackEnabled}
            />
            Show popup for finesse feedback
          </label>
        </div>

        <div class="setting-group">
          <label>
            <input
              type="checkbox"
              id="finesse-boop-enabled"
              .checked=${this.currentSettings.finesseBoopEnabled}
            />
            Boop sound on finesse feedback
          </label>
        </div>

        <div class="setting-group">
          <label>
            <input
              type="checkbox"
              id="retry-on-finesse-error"
              .checked=${this.currentSettings.retryOnFinesseError}
            />
            Retry piece on finesse errors (hard drop only)
          </label>
        </div>
      </div>
    `;
  }

  private renderControlsPanel(): unknown {
    const actions: Array<[BindableAction, string]> = [
      ["MoveLeft", "Move Left"],
      ["MoveRight", "Move Right"],
      ["RotateCCW", "Rotate CCW"],
      ["RotateCW", "Rotate CW"],
      ["SoftDrop", "Soft Drop"],
      ["HardDrop", "Hard Drop"],
      ["Hold", "Hold"],
    ];

    return html`
      <div
        class="settings-panel ${this.currentTab === "controls" ? "active" : ""}"
      >
        <div class="setting-group">
          <p>Click a keybind, then press any key to rebind.</p>
        </div>
        <div class="keybinds-list">
          ${actions.map(([action, label]) =>
            this.renderKeybindRow(label, action),
          )}
        </div>
      </div>
    `;
  }

  private renderKeybindRow(label: string, action: BindableAction): unknown {
    const code = this.currentKeyBindings[action][0] ?? "";
    const keyLabel = this.formatKey(code);
    const isRebinding = this.rebindingAction === action;

    return html`
      <div class="keybind-row">
        <div class="keybind-label">${label}</div>
        <button
          class="keybind-button ${isRebinding ? "listening" : ""}"
          @click=${(): void => this.startRebinding(action)}
        >
          ${keyLabel}
        </button>
        <span
          class="keybind-hint"
          style="display: ${isRebinding ? "inline" : "none"}"
        >
          Press any key…
        </span>
        <button
          class="keybind-cancel"
          style="display: ${isRebinding ? "inline-block" : "none"}"
          @click=${(): void => this.stopRebinding()}
        >
          Cancel
        </button>
      </div>
    `;
  }

  private renderFooter(): unknown {
    return html`
      <div class="settings-footer">
        <button
          class="button secondary"
          @click=${(): void => this.resetToDefaults()}
        >
          Reset to Defaults
        </button>
        <button
          class="button primary"
          @click=${(): void => this.applySettings()}
        >
          Apply
        </button>
      </div>
    `;
  }

  private handleOverlayClick(e: Event): void {
    if (e.target === e.currentTarget) {
      this.hide();
    }
  }

  private switchTab(tabId: string): void {
    this.currentTab = tabId;
  }

  private handleRangeInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    const valueDisplay =
      input.parentElement?.querySelector<HTMLElement>(".value-display");

    if (valueDisplay) {
      const suffix = this.getSuffixForInput(input.id);
      const display = this.formatInputValue(input.value, input.id, suffix);
      valueDisplay.textContent = display;
    }
  }

  private formatInputValue(
    value: string,
    inputId: string,
    suffix: string,
  ): string {
    if (inputId === "soft-drop-speed" && value === "41") return "∞";
    return `${value}${suffix}`;
  }

  private getSuffixForInput(id: string): string {
    if (id === "soft-drop-speed") return "x";
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

  private startRebinding(action: BindableAction): void {
    this.stopRebinding();
    this.rebindingAction = action;

    // Handler that captures the key for rebinding
    this.boundCaptureHandler = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopImmediatePropagation();

      // Update binding to single key for this action
      const updated: KeyBindings = {
        ...this.currentKeyBindings,
        [action]: [e.code],
      };
      this.currentKeyBindings = updated;

      // Done
      this.stopRebinding();
    };

    // Handler that blocks all other keyboard events during rebinding
    this.boundBlockHandler = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    // Capture the first keydown for rebinding
    window.addEventListener("keydown", this.boundCaptureHandler, {
      capture: true,
      once: true,
    });

    // Block all keyup and keypress events during rebinding to prevent game interference
    window.addEventListener("keyup", this.boundBlockHandler, {
      capture: true,
    });
    window.addEventListener("keypress", this.boundBlockHandler, {
      capture: true,
    });
  }

  private stopRebinding(): void {
    if (this.boundCaptureHandler) {
      window.removeEventListener("keydown", this.boundCaptureHandler, true);
    }
    if (this.boundBlockHandler) {
      window.removeEventListener("keyup", this.boundBlockHandler, true);
      window.removeEventListener("keypress", this.boundBlockHandler, true);
    }
    this.rebindingAction = undefined;
  }

  private applySettings(): void {
    const newSettings: Partial<GameSettings> = {};

    this.collectTimingSettings(newSettings);
    this.collectGameplaySettings(newSettings);
    this.collectFinesseSettings(newSettings);

    // Update internal settings
    this.currentSettings = { ...this.currentSettings, ...newSettings };

    // Save to storage
    this.saveStoreToStorage(this.currentSettings, this.currentKeyBindings);

    // Mark changes as applied so they won't be reverted on close
    this.changesApplied = true;

    // Emit settings change event
    this.emitSettingsChange({
      ...newSettings,
      keyBindings: this.currentKeyBindings,
    });

    // Hide modal
    this.hide();
  }

  private collectTimingSettings(newSettings: Partial<GameSettings>): void {
    const dasInput = this.querySelector<HTMLInputElement>("#das-delay");
    if (dasInput) newSettings.dasMs = parseInt(dasInput.value);

    const arrInput = this.querySelector<HTMLInputElement>("#arr-rate");
    if (arrInput) newSettings.arrMs = parseInt(arrInput.value);

    const softDropInput =
      this.querySelector<HTMLInputElement>("#soft-drop-speed");
    if (softDropInput) {
      const multiplier = parseInt(softDropInput.value);
      newSettings.softDrop = multiplier >= 41 ? "infinite" : multiplier;
    }

    const lockDelayInput = this.querySelector<HTMLInputElement>("#lock-delay");
    if (lockDelayInput)
      newSettings.lockDelayMs = parseInt(lockDelayInput.value);

    const lineClearDelayInput =
      this.querySelector<HTMLInputElement>("#line-clear-delay");
    if (lineClearDelayInput)
      newSettings.lineClearDelayMs = parseInt(lineClearDelayInput.value);
  }

  private collectGameplaySettings(newSettings: Partial<GameSettings>): void {
    const gravityEnabledInput =
      this.querySelector<HTMLInputElement>("#gravity-enabled");
    if (gravityEnabledInput)
      newSettings.gravityEnabled = gravityEnabledInput.checked;

    const gravitySpeedInput =
      this.querySelector<HTMLInputElement>("#gravity-speed");
    if (gravitySpeedInput)
      newSettings.gravityMs = parseInt(gravitySpeedInput.value);

    const finesseCancelInput =
      this.querySelector<HTMLInputElement>("#finesse-cancel");
    if (finesseCancelInput)
      newSettings.finesseCancelMs = parseInt(finesseCancelInput.value);

    const ghostPieceInput =
      this.querySelector<HTMLInputElement>("#ghost-piece");
    if (ghostPieceInput)
      newSettings.ghostPieceEnabled = ghostPieceInput.checked;

    const nextCountInput = this.querySelector<HTMLInputElement>("#next-count");
    if (nextCountInput)
      newSettings.nextPieceCount = parseInt(nextCountInput.value);

    // Read mode from radio buttons in DOM
    const freePlayRadio = this.querySelector<HTMLInputElement>(
      'input[name="mode-select"][value="freePlay"]',
    );
    const guidedRadio = this.querySelector<HTMLInputElement>(
      'input[name="mode-select"][value="guided"]',
    );
    if (freePlayRadio?.checked === true) {
      newSettings.mode = "freePlay";
    } else if (guidedRadio?.checked === true) {
      newSettings.mode = "guided";
    }
  }

  private collectFinesseSettings(newSettings: Partial<GameSettings>): void {
    const finesseFeedbackInput = this.querySelector<HTMLInputElement>(
      "#finesse-feedback-enabled",
    );
    if (finesseFeedbackInput)
      newSettings.finesseFeedbackEnabled = finesseFeedbackInput.checked;

    const finesseBoopInput = this.querySelector<HTMLInputElement>(
      "#finesse-boop-enabled",
    );
    if (finesseBoopInput)
      newSettings.finesseBoopEnabled = finesseBoopInput.checked;

    const retryOnFinesseErrorInput = this.querySelector<HTMLInputElement>(
      "#retry-on-finesse-error",
    );
    if (retryOnFinesseErrorInput)
      newSettings.retryOnFinesseError = retryOnFinesseErrorInput.checked;
  }

  private resetToDefaults(): void {
    // Reset internal models but don't save or apply yet
    this.currentSettings = this.getDefaultSettings();
    this.currentKeyBindings = defaultKeyBindings();
    this.stopRebinding();

    // Don't mark as applied - user still needs to click Apply
    // Don't save to storage or emit changes - wait for Apply button

    // Force re-render to update UI controls
    this.requestUpdate();
  }

  private emitSettingsChange(settings: Partial<GameSettings>): void {
    this.dispatchEvent(
      new CustomEvent("settings-change", {
        bubbles: true,
        composed: true,
        detail: settings,
      }),
    );
  }

  // Settings persistence and defaults
  private getDefaultSettings(): GameSettings {
    return {
      arrMs: 33,
      dasMs: 167,
      finesseBoopEnabled: false,
      finesseCancelMs: 50,
      finesseFeedbackEnabled: true,
      ghostPieceEnabled: true,
      gravityEnabled: true,
      gravityMs: 750,
      lineClearDelayMs: 125,
      lockDelayMs: 500,
      mode: "guided",
      nextPieceCount: 5,
      retryOnFinesseError: false,
      softDrop: 20,
    };
  }

  private readonly STORAGE_KEY = "finessimo";

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

  // Type-safe schema that maps 1:1 with GameSettings to prevent missing fields
  private readonly GameSettingsSchema = {
    arrMs: (v: unknown): v is number => typeof v === "number" && v >= 0,
    // Timing settings
    dasMs: (v: unknown): v is number => typeof v === "number" && v >= 0,
    finesseBoopEnabled: (v: unknown): v is boolean => typeof v === "boolean",
    finesseCancelMs: (v: unknown): v is number =>
      typeof v === "number" && v >= 0,
    // Finesse settings
    finesseFeedbackEnabled: (v: unknown): v is boolean =>
      typeof v === "boolean",

    ghostPieceEnabled: (v: unknown): v is boolean => typeof v === "boolean",
    // Gameplay settings
    gravityEnabled: (v: unknown): v is boolean => typeof v === "boolean",
    gravityMs: (v: unknown): v is number => typeof v === "number" && v >= 0,
    // Controls (handled separately in loadStoreFromStorage)
    keyBindings: (_v: unknown): _v is never => false, // Skip - handled separately
    lineClearDelayMs: (v: unknown): v is number =>
      typeof v === "number" && v >= 0,

    lockDelayMs: (v: unknown): v is number => typeof v === "number" && v >= 0,
    // Mode setting
    mode: (v: unknown): v is GameSettings["mode"] =>
      v === "freePlay" || v === "guided",
    nextPieceCount: (v: unknown): v is number =>
      typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 10,

    retryOnFinesseError: (v: unknown): v is boolean => typeof v === "boolean",

    softDrop: (v: unknown): v is number | "infinite" =>
      (typeof v === "number" && v >= 5) || v === "infinite",
  } as const satisfies Record<keyof GameSettings, (v: unknown) => boolean>;

  private coerceSettings(maybe: unknown): Partial<GameSettings> {
    if (!this.isRecord(maybe)) return {};
    const s = maybe;
    const out: Partial<GameSettings> = {};

    // Use schema-based validation to ensure all fields are handled
    for (const [key, validator] of Object.entries(this.GameSettingsSchema)) {
      const fieldKey = key as keyof GameSettings;

      // Skip keyBindings as it's handled separately in loadStoreFromStorage
      if (fieldKey === "keyBindings") continue;

      const value = s[fieldKey];
      if (validator(value)) {
        // Type assertion is safe here because validator confirms the type
        (out as Record<string, unknown>)[fieldKey] = value;
      }
    }

    return out;
  }

  private loadStoreFromStorage(): {
    settings: Partial<GameSettings>;
    keyBindings: KeyBindings;
  } {
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
      return { keyBindings: defaultKeyBindings(), settings: {} };
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

  private syncSettingsFromGameState(gameState: GameState): void {
    // Update current settings to match game state
    const maybeMode =
      gameState.currentMode === "guided"
        ? "guided"
        : gameState.currentMode === "freePlay"
          ? "freePlay"
          : undefined;
    const next = {
      ...this.currentSettings,
      arrMs: gameState.timing.arrMs,
      dasMs: gameState.timing.dasMs,
      finesseBoopEnabled: gameState.gameplay.finesseBoopEnabled ?? false,
      finesseCancelMs: gameState.gameplay.finesseCancelMs,
      finesseFeedbackEnabled: gameState.gameplay.finesseFeedbackEnabled ?? true,
      ghostPieceEnabled: gameState.gameplay.ghostPieceEnabled ?? true,
      gravityEnabled: gameState.timing.gravityEnabled,
      gravityMs: gameState.timing.gravityMs,
      lineClearDelayMs: gameState.timing.lineClearDelayMs,
      lockDelayMs: gameState.timing.lockDelayMs,
      mode: maybeMode,
      nextPieceCount: gameState.gameplay.nextPieceCount ?? 5,
      retryOnFinesseError: gameState.gameplay.retryOnFinesseError ?? false,
      softDrop: gameState.timing.softDrop,
    } as GameSettings;
    this.currentSettings = next;
  }

  private deepCopyKeyBindings(bindings: KeyBindings): KeyBindings {
    return {
      HardDrop: [...bindings.HardDrop],
      Hold: [...bindings.Hold],
      MoveLeft: [...bindings.MoveLeft],
      MoveRight: [...bindings.MoveRight],
      RotateCCW: [...bindings.RotateCCW],
      RotateCW: [...bindings.RotateCW],
      SoftDrop: [...bindings.SoftDrop],
    };
  }

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
