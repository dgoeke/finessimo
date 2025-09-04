import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";

// Game engine types
import { defaultKeyBindings } from "../../input/keyboard";
import { createDurationMs } from "../../types/brands";

import type { DropdownOption } from "./settings/dropdown";
import type { KeyBindings } from "../../input/keyboard";
import type { TimingConfig, GameplayConfig } from "../../state/types";
import type { GameSettings } from "../types/settings";

import "./settings/checkbox";
import "./settings/dropdown";
import "./settings/slider";
import "./settings/button";
import "./keybinding-modal";

// Settings state using game engine types directly
type SettingsState = {
  timing: Partial<TimingConfig>;
  gameplay: Partial<GameplayConfig>;
  mode: string; // "freePlay" or "guided"
  keyBindings: KeyBindings;
};

// Define type for keybinding modal
type KeybindingModalElement = HTMLElement & {
  keyBindings: KeyBindings;
  show(): void;
};

@customElement("settings-view")
export class SettingsView extends LitElement {
  @state() private settings = this.createDefaultSettings();

  // Use light DOM for consistent styling
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();

    // Notify the app that settings-view is now available
    document.dispatchEvent(
      new CustomEvent("settings-view-connected", {
        bubbles: true,
        detail: { settingsView: this },
      }),
    );
    // Listen for keybinding changes
    document.addEventListener(
      "keybinding-change",
      this.handleKeybindingChange as EventListener,
    );
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener(
      "keybinding-change",
      this.handleKeybindingChange as EventListener,
    );
  }

  // Public API for app to inject current settings (no re-emit)
  applySettings(newSettings: Partial<GameSettings>): void {
    const timing = this.mergeTimingFromGameSettings(
      this.settings.timing,
      newSettings,
    );
    const gameplay = this.mergeGameplayFromGameSettings(
      this.settings.gameplay,
      newSettings,
    );
    const mode = newSettings.mode ?? this.settings.mode;
    const keyBindings = newSettings.keyBindings ?? this.settings.keyBindings;
    this.settings = { gameplay, keyBindings, mode, timing };
    this.requestUpdate();
  }

  private mergeTimingFromGameSettings(
    base: Partial<TimingConfig>,
    s: Partial<GameSettings>,
  ): Partial<TimingConfig> {
    const next: Partial<TimingConfig> = { ...base };
    if (s.dasMs !== undefined) next.dasMs = createDurationMs(s.dasMs);
    if (s.arrMs !== undefined) next.arrMs = createDurationMs(s.arrMs);
    if (s.softDrop !== undefined)
      next.softDrop = s.softDrop as TimingConfig["softDrop"];
    if (s.lockDelayMs !== undefined)
      next.lockDelayMs = createDurationMs(s.lockDelayMs);
    if (s.lineClearDelayMs !== undefined)
      next.lineClearDelayMs = createDurationMs(s.lineClearDelayMs);
    if (s.gravityEnabled !== undefined) next.gravityEnabled = s.gravityEnabled;
    if (s.gravityMs !== undefined)
      next.gravityMs = createDurationMs(s.gravityMs);
    return next;
  }

  private mergeGameplayFromGameSettings(
    base: Partial<GameplayConfig>,
    s: Partial<GameSettings>,
  ): Partial<GameplayConfig> {
    const next: Partial<GameplayConfig> = { ...base };
    if (s.finesseCancelMs !== undefined)
      next.finesseCancelMs = createDurationMs(s.finesseCancelMs);
    if (s.ghostPieceEnabled !== undefined)
      next.ghostPieceEnabled = s.ghostPieceEnabled;
    if (s.guidedColumnHighlightEnabled !== undefined)
      next.guidedColumnHighlightEnabled = s.guidedColumnHighlightEnabled;
    if (s.nextPieceCount !== undefined) next.nextPieceCount = s.nextPieceCount;
    if (s.finesseFeedbackEnabled !== undefined)
      next.finesseFeedbackEnabled = s.finesseFeedbackEnabled;
    if (s.finesseBoopEnabled !== undefined)
      next.finesseBoopEnabled = s.finesseBoopEnabled;
    if (s.retryOnFinesseError !== undefined)
      next.retryOnFinesseError = s.retryOnFinesseError;
    return next;
  }

  private createDefaultSettings(): SettingsState {
    return {
      gameplay: {
        finesseBoopEnabled: false,
        finesseCancelMs: createDurationMs(50),
        finesseFeedbackEnabled: true,
        ghostPieceEnabled: true,
        guidedColumnHighlightEnabled: true,
        nextPieceCount: 5,
        retryOnFinesseError: false,
      },
      keyBindings: defaultKeyBindings(),
      mode: "guided",
      timing: {
        arrMs: createDurationMs(33),
        dasMs: createDurationMs(167),
        gravityEnabled: true,
        gravityMs: createDurationMs(750),
        lineClearDelayMs: createDurationMs(125),
        lockDelayMs: createDurationMs(500),
        softDrop: 20,
      },
    };
  }

  // No local validation needed; app provides validated settings snapshot

  private isValidGameMode(mode: string): mode is "freePlay" | "guided" {
    return mode === "freePlay" || mode === "guided";
  }

  private handleGameModeChange = (
    event: CustomEvent<{ value: string }>,
  ): void => {
    const { value } = event.detail;
    if (this.isValidGameMode(value)) {
      this.updateSetting({ mode: value });
    }
  };

  private handleGhostPiecesChange = (
    event: CustomEvent<{ checked: boolean }>,
  ): void => {
    this.updateSetting({
      gameplay: {
        ...this.settings.gameplay,
        ghostPieceEnabled: event.detail.checked,
      },
    });
  };

  private handleFinessePopupChange = (
    event: CustomEvent<{ checked: boolean }>,
  ): void => {
    this.updateSetting({
      gameplay: {
        ...this.settings.gameplay,
        finesseFeedbackEnabled: event.detail.checked,
      },
    });
  };

  private handleColumnHighlightChange = (
    event: CustomEvent<{ checked: boolean }>,
  ): void => {
    this.updateSetting({
      gameplay: {
        ...this.settings.gameplay,
        guidedColumnHighlightEnabled: event.detail.checked,
      },
    });
  };

  private handleGravityToggle = (
    event: CustomEvent<{ checked: boolean }>,
  ): void => {
    this.updateSetting({
      timing: { ...this.settings.timing, gravityEnabled: event.detail.checked },
    });
  };

  private handleGravitySpeedChange = (
    event: CustomEvent<{ value: number }>,
  ): void => {
    try {
      this.updateSetting({
        timing: {
          ...this.settings.timing,
          gravityMs: createDurationMs(event.detail.value),
        },
      });
    } catch (error) {
      console.warn("Invalid gravity speed:", error);
    }
  };

  private handleSoundOnMissChange = (
    event: CustomEvent<{ checked: boolean }>,
  ): void => {
    this.updateSetting({
      gameplay: {
        ...this.settings.gameplay,
        finesseBoopEnabled: event.detail.checked,
      },
    });
  };

  private handleRetryOnMissChange = (
    event: CustomEvent<{ checked: boolean }>,
  ): void => {
    this.updateSetting({
      gameplay: {
        ...this.settings.gameplay,
        retryOnFinesseError: event.detail.checked,
      },
    });
  };

  private handlePreviewCountChange = (
    event: CustomEvent<{ value: number }>,
  ): void => {
    const { value } = event.detail;
    if (value >= 0 && value <= 7) {
      this.updateSetting({
        gameplay: { ...this.settings.gameplay, nextPieceCount: value },
      });
    } else {
      console.warn("Invalid preview count:", value);
    }
  };

  private handleCancelWindowChange = (
    event: CustomEvent<{ value: number }>,
  ): void => {
    try {
      this.updateSetting({
        gameplay: {
          ...this.settings.gameplay,
          finesseCancelMs: createDurationMs(event.detail.value),
        },
      });
    } catch (error) {
      console.warn("Invalid cancel window:", error);
    }
  };

  private handleDASChange = (event: CustomEvent<{ value: number }>): void => {
    try {
      this.updateSetting({
        timing: {
          ...this.settings.timing,
          dasMs: createDurationMs(event.detail.value),
        },
      });
    } catch (error) {
      console.warn("Invalid DAS value:", error);
    }
  };

  private handleARRChange = (event: CustomEvent<{ value: number }>): void => {
    try {
      this.updateSetting({
        timing: {
          ...this.settings.timing,
          arrMs: createDurationMs(event.detail.value),
        },
      });
    } catch (error) {
      console.warn("Invalid ARR value:", error);
    }
  };

  private handleSDFChange = (event: CustomEvent<{ value: number }>): void => {
    const { value } = event.detail;
    const softDrop = value === 41 ? "infinite" : value;
    this.updateSetting({
      timing: { ...this.settings.timing, softDrop },
    });
  };

  private handleLockDelayChange = (
    event: CustomEvent<{ value: number }>,
  ): void => {
    try {
      this.updateSetting({
        timing: {
          ...this.settings.timing,
          lockDelayMs: createDurationMs(event.detail.value),
        },
      });
    } catch (error) {
      console.warn("Invalid lock delay:", error);
    }
  };

  private handleLineClearDelayChange = (
    event: CustomEvent<{ value: number }>,
  ): void => {
    try {
      this.updateSetting({
        timing: {
          ...this.settings.timing,
          lineClearDelayMs: createDurationMs(event.detail.value),
        },
      });
    } catch (error) {
      console.warn("Invalid line clear delay:", error);
    }
  };

  private handleControlsClick = (): void => {
    const modal = document.querySelector("keybinding-modal");
    if (modal != null) {
      (modal as KeybindingModalElement).keyBindings = this.settings.keyBindings;
      (modal as KeybindingModalElement).show();
    }
  };

  private handleKeybindingChange = (
    event: CustomEvent<{ keyBindings: KeyBindings }>,
  ): void => {
    this.updateSetting({ keyBindings: event.detail.keyBindings });
  };

  private handleResetClick = (): void => {
    this.settings = this.createDefaultSettings();
    // Tell app to apply defaults (it will persist)
    this.emitAllSettings();
    this.requestUpdate();
  };

  private updateSetting(partialSettings: Partial<SettingsState>): void {
    this.settings = { ...this.settings, ...partialSettings };
    this.emitGameEngineEvents(partialSettings);
    this.requestUpdate();
  }

  private emitGameEngineEvents(changes: Partial<SettingsState>): void {
    // Emit timing changes only if timing was changed
    if (changes.timing) {
      this.dispatchEvent(
        new CustomEvent("update-timing", {
          bubbles: true,
          composed: true,
          detail: changes.timing,
        }),
      );
    }

    // Emit gameplay changes only if gameplay was changed
    if (changes.gameplay) {
      this.dispatchEvent(
        new CustomEvent("update-gameplay", {
          bubbles: true,
          composed: true,
          detail: changes.gameplay,
        }),
      );
    }

    // Emit mode changes only if mode was changed
    if (changes.mode !== undefined) {
      this.dispatchEvent(
        new CustomEvent("set-mode", {
          bubbles: true,
          composed: true,
          detail: changes.mode,
        }),
      );
    }

    // Emit keybinding changes only if keyBindings was changed
    if (changes.keyBindings) {
      this.dispatchEvent(
        new CustomEvent("update-keybindings", {
          bubbles: true,
          composed: true,
          detail: changes.keyBindings,
        }),
      );
    }
  }

  private emitAllSettings(): void {
    // Emit all current settings on initialization
    if (Object.keys(this.settings.timing).length > 0) {
      this.dispatchEvent(
        new CustomEvent("update-timing", {
          bubbles: true,
          composed: true,
          detail: this.settings.timing,
        }),
      );
    }

    if (Object.keys(this.settings.gameplay).length > 0) {
      this.dispatchEvent(
        new CustomEvent("update-gameplay", {
          bubbles: true,
          composed: true,
          detail: this.settings.gameplay,
        }),
      );
    }

    this.dispatchEvent(
      new CustomEvent("set-mode", {
        bubbles: true,
        composed: true,
        detail: this.settings.mode,
      }),
    );

    this.dispatchEvent(
      new CustomEvent("update-keybindings", {
        bubbles: true,
        composed: true,
        detail: this.settings.keyBindings,
      }),
    );
  }

  private getGameModeOptions(): ReadonlyArray<DropdownOption> {
    return [
      { label: "Guided Mode", value: "guided" },
      { label: "Free Play", value: "freePlay" },
    ] as const;
  }

  protected render(): unknown {
    return html`
      <div class="settings-view">
        ${this.renderGameModeSection()} ${this.renderGameplaySection()}
        ${this.renderHandlingSection()}
      </div>
    `;
  }

  private renderGameModeSection(): unknown {
    return html`
      <div class="settings-section">
        <settings-dropdown
          .options=${this.getGameModeOptions()}
          .value=${this.settings.mode}
          @dropdown-change=${this.handleGameModeChange}
        ></settings-dropdown>
        ${this.renderGameModeSpecificSettings()}
      </div>
    `;
  }

  private renderGameplaySection(): unknown {
    return html`
      <div class="settings-section">
        <h4 class="settings-section-title">Gameplay</h4>
        <div class="settings-row">
          <settings-checkbox
            label="Gravity"
            .checked=${this.settings.timing.gravityEnabled ?? true}
            @checkbox-change=${this.handleGravityToggle}
          ></settings-checkbox>
          ${this.settings.timing.gravityEnabled === true
            ? html`
                <settings-slider
                  label=""
                  .value=${this.settings.timing.gravityMs ?? 750}
                  .min=${10}
                  .max=${5000}
                  .step=${10}
                  unit="ms"
                  @slider-change=${this.handleGravitySpeedChange}
                ></settings-slider>
              `
            : ""}
        </div>
        <settings-checkbox
          label="Sound on miss"
          .checked=${this.settings.gameplay.finesseBoopEnabled ?? false}
          @checkbox-change=${this.handleSoundOnMissChange}
        ></settings-checkbox>
        <settings-slider
          label="Move Cancel"
          .value=${this.settings.gameplay.finesseCancelMs ?? 50}
          .min=${0}
          .max=${100}
          .step=${5}
          unit="ms"
          @slider-change=${this.handleCancelWindowChange}
        ></settings-slider>
        <settings-slider
          label="# Next Pieces"
          .value=${this.settings.gameplay.nextPieceCount ?? 5}
          .min=${0}
          .max=${5}
          .step=${1}
          unit=""
          @slider-change=${this.handlePreviewCountChange}
        ></settings-slider>
      </div>
    `;
  }

  private renderHandlingSection(): unknown {
    return html`
      <div class="settings-section">
        <h4 class="settings-section-title">Handling</h4>
        <settings-slider
          label="DAS"
          .value=${this.settings.timing.dasMs ?? 167}
          .min=${0}
          .max=${1000}
          .step=${1}
          unit="ms"
          @slider-change=${this.handleDASChange}
        ></settings-slider>
        <settings-slider
          label="ARR"
          .value=${this.settings.timing.arrMs ?? 33}
          .min=${0}
          .max=${500}
          .step=${1}
          unit="ms"
          @slider-change=${this.handleARRChange}
        ></settings-slider>
        <settings-slider
          label="SDF"
          .value=${this.settings.timing.softDrop === "infinite"
            ? 41
            : (this.settings.timing.softDrop ?? 20)}
          .min=${1}
          .max=${41}
          .step=${1}
          unit="x"
          .formatValue=${(value: number, unit: string): string =>
            value === 41 ? "∞" : `${String(value)}${unit}`}
          @slider-change=${this.handleSDFChange}
        ></settings-slider>
        <settings-slider
          label="Lock Delay"
          .value=${this.settings.timing.lockDelayMs ?? 500}
          .min=${0}
          .max=${5000}
          .step=${10}
          unit="ms"
          @slider-change=${this.handleLockDelayChange}
        ></settings-slider>
        <settings-slider
          label="Clear Delay"
          .value=${this.settings.timing.lineClearDelayMs ?? 125}
          .min=${0}
          .max=${1000}
          .step=${5}
          unit="ms"
          @slider-change=${this.handleLineClearDelayChange}
        ></settings-slider>
        <div class="settings-buttons">
          <settings-button
            label="Controls"
            @button-click=${this.handleControlsClick}
          ></settings-button>
          <settings-button
            label="Reset to defaults"
            variant="warning"
            @button-click=${this.handleResetClick}
          ></settings-button>
        </div>
      </div>
    `;
  }

  private renderGameModeSpecificSettings(): unknown {
    switch (this.settings.mode) {
      case "freePlay": {
        return html`
          <settings-checkbox
            label="Ghost Pieces"
            .checked=${this.settings.gameplay.ghostPieceEnabled ?? true}
            @checkbox-change=${this.handleGhostPiecesChange}
          ></settings-checkbox>
          <settings-checkbox
            label="Finesse popup"
            .checked=${this.settings.gameplay.finesseFeedbackEnabled ?? true}
            @checkbox-change=${this.handleFinessePopupChange}
          ></settings-checkbox>
          <settings-checkbox
            label="Retry on miss"
            .checked=${this.settings.gameplay.retryOnFinesseError ?? false}
            @checkbox-change=${this.handleRetryOnMissChange}
          ></settings-checkbox>
        `;
      }
      case "guided": {
        return html`
          <settings-checkbox
            label="Column highlight"
            .checked=${this.settings.gameplay.guidedColumnHighlightEnabled ??
            true}
            @checkbox-change=${this.handleColumnHighlightChange}
          ></settings-checkbox>
        `;
      }
      default: {
        // Exhaustiveness check - TypeScript will catch if we miss a mode
        return html`<div>Unknown mode: ${this.settings.mode}</div>`;
      }
    }
  }
}
