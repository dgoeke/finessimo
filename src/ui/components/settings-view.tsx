import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";

import {
  type GameSettingsData,
  type KeyBindings,
  createDefaultSettings,
  asDASValue,
  asARRValue,
  asSDFValue,
  asLockDelayValue,
  asLineClearDelayValue,
  asGravitySpeedValue,
  asPreviewCountValue,
  asCancelWindowValue,
  isGameMode,
} from "../types/settings";

import "./settings/checkbox";
import "./settings/dropdown";
import "./settings/slider";
import "./settings/button";
import "./keybinding-modal";

import type { DropdownOption } from "./settings/dropdown";
// Define type for keybinding modal
type KeybindingModalElement = HTMLElement & {
  keyBindings: KeyBindings;
  show(): void;
};

@customElement("settings-view")
export class SettingsView extends LitElement {
  @state() private settings: GameSettingsData = createDefaultSettings();

  // Use light DOM for consistent styling
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.loadSettings();
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

  private loadSettings(): void {
    // For now, use defaults - will implement localStorage loading later
    this.settings = createDefaultSettings();
  }

  private handleGameModeChange = (
    event: CustomEvent<{ value: string }>,
  ): void => {
    const { value } = event.detail;
    if (isGameMode(value)) {
      this.updateSetting({ gameMode: value });
    }
  };

  private handleGhostPiecesChange = (
    event: CustomEvent<{ checked: boolean }>,
  ): void => {
    this.updateSetting({ ghostPiecesEnabled: event.detail.checked });
  };

  private handleFinessePopupChange = (
    event: CustomEvent<{ checked: boolean }>,
  ): void => {
    this.updateSetting({ finessePopupEnabled: event.detail.checked });
  };

  private handleColumnHighlightChange = (
    event: CustomEvent<{ checked: boolean }>,
  ): void => {
    this.updateSetting({ columnHighlightEnabled: event.detail.checked });
  };

  private handleGravityToggle = (
    event: CustomEvent<{ checked: boolean }>,
  ): void => {
    this.updateSetting({ gravityEnabled: event.detail.checked });
  };

  private handleGravitySpeedChange = (
    event: CustomEvent<{ value: number }>,
  ): void => {
    try {
      this.updateSetting({
        gravitySpeed: asGravitySpeedValue(event.detail.value),
      });
    } catch (error) {
      console.warn("Invalid gravity speed:", error);
    }
  };

  private handleSoundOnMissChange = (
    event: CustomEvent<{ checked: boolean }>,
  ): void => {
    this.updateSetting({ soundOnMissEnabled: event.detail.checked });
  };

  private handleRetryOnMissChange = (
    event: CustomEvent<{ checked: boolean }>,
  ): void => {
    this.updateSetting({ retryOnMissEnabled: event.detail.checked });
  };

  private handlePreviewCountChange = (
    event: CustomEvent<{ value: number }>,
  ): void => {
    try {
      this.updateSetting({
        previewCount: asPreviewCountValue(event.detail.value),
      });
    } catch (error) {
      console.warn("Invalid preview count:", error);
    }
  };

  private handleCancelWindowChange = (
    event: CustomEvent<{ value: number }>,
  ): void => {
    try {
      this.updateSetting({
        cancelWindow: asCancelWindowValue(event.detail.value),
      });
    } catch (error) {
      console.warn("Invalid cancel window:", error);
    }
  };

  private handleDASChange = (event: CustomEvent<{ value: number }>): void => {
    try {
      this.updateSetting({ das: asDASValue(event.detail.value) });
    } catch (error) {
      console.warn("Invalid DAS value:", error);
    }
  };

  private handleARRChange = (event: CustomEvent<{ value: number }>): void => {
    try {
      this.updateSetting({ arr: asARRValue(event.detail.value) });
    } catch (error) {
      console.warn("Invalid ARR value:", error);
    }
  };

  private handleSDFChange = (event: CustomEvent<{ value: number }>): void => {
    try {
      this.updateSetting({ sdf: asSDFValue(event.detail.value) });
    } catch (error) {
      console.warn("Invalid SDF value:", error);
    }
  };

  private handleLockDelayChange = (
    event: CustomEvent<{ value: number }>,
  ): void => {
    try {
      this.updateSetting({ lockDelay: asLockDelayValue(event.detail.value) });
    } catch (error) {
      console.warn("Invalid lock delay:", error);
    }
  };

  private handleLineClearDelayChange = (
    event: CustomEvent<{ value: number }>,
  ): void => {
    try {
      this.updateSetting({
        lineClearDelay: asLineClearDelayValue(event.detail.value),
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
    this.settings = createDefaultSettings();
    this.persistSettings();
    this.requestUpdate();
  };

  private updateSetting(partialSettings: Partial<GameSettingsData>): void {
    this.settings = { ...this.settings, ...partialSettings };
    this.persistSettings();
    this.requestUpdate();
  }

  private persistSettings(): void {
    console.warn(
      "Settings updated:",
      this.settings,
      "- persistence not implemented yet",
    );
  }

  private getGameModeOptions(): ReadonlyArray<DropdownOption> {
    return [
      { label: "Guided Mode", value: "guided" },
      { label: "Freeplay Mode", value: "freeplay" },
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
          .value=${this.settings.gameMode}
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
            .checked=${this.settings.gravityEnabled}
            @checkbox-change=${this.handleGravityToggle}
          ></settings-checkbox>
          ${this.settings.gravityEnabled
            ? html`
                <settings-slider
                  label=""
                  .value=${this.settings.gravitySpeed}
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
          .checked=${this.settings.soundOnMissEnabled}
          @checkbox-change=${this.handleSoundOnMissChange}
        ></settings-checkbox>
        <settings-checkbox
          label="Retry on miss"
          .checked=${this.settings.retryOnMissEnabled}
          @checkbox-change=${this.handleRetryOnMissChange}
        ></settings-checkbox>
        <settings-slider
          label="Move Cancel"
          .value=${this.settings.cancelWindow}
          .min=${0}
          .max=${100}
          .step=${5}
          unit="ms"
          @slider-change=${this.handleCancelWindowChange}
        ></settings-slider>
        <settings-slider
          label="# Next Pieces"
          .value=${this.settings.previewCount}
          .min=${0}
          .max=${7}
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
          .value=${this.settings.das}
          .min=${0}
          .max=${1000}
          .step=${1}
          unit="ms"
          @slider-change=${this.handleDASChange}
        ></settings-slider>
        <settings-slider
          label="ARR"
          .value=${this.settings.arr}
          .min=${0}
          .max=${500}
          .step=${1}
          unit="ms"
          @slider-change=${this.handleARRChange}
        ></settings-slider>
        <settings-slider
          label="SDF"
          .value=${this.settings.sdf === Number.POSITIVE_INFINITY
            ? 41
            : this.settings.sdf}
          .min=${1}
          .max=${41}
          .step=${1}
          unit="x"
          .formatValue=${(value: number, unit: string): string =>
            asSDFValue(value) === Number.POSITIVE_INFINITY
              ? "∞"
              : `${String(value)}${unit}`}
          @slider-change=${this.handleSDFChange}
        ></settings-slider>
        <settings-slider
          label="Lock Delay"
          .value=${this.settings.lockDelay}
          .min=${0}
          .max=${5000}
          .step=${10}
          unit="ms"
          @slider-change=${this.handleLockDelayChange}
        ></settings-slider>
        <settings-slider
          label="Clear Delay"
          .value=${this.settings.lineClearDelay}
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
    switch (this.settings.gameMode) {
      case "freeplay": {
        return html`
          <settings-checkbox
            label="Ghost Pieces"
            .checked=${this.settings.ghostPiecesEnabled}
            @checkbox-change=${this.handleGhostPiecesChange}
          ></settings-checkbox>
          <settings-checkbox
            label="Finesse popup"
            .checked=${this.settings.finessePopupEnabled}
            @checkbox-change=${this.handleFinessePopupChange}
          ></settings-checkbox>
        `;
      }
      case "guided": {
        return html`
          <settings-checkbox
            label="Column highlight"
            .checked=${this.settings.columnHighlightEnabled}
            @checkbox-change=${this.handleColumnHighlightChange}
          ></settings-checkbox>
        `;
      }
      default: {
        // Exhaustiveness check
        const _never: never = this.settings.gameMode;
        return html`<div>Unknown mode: ${String(_never)}</div>`;
      }
    }
  }
}
