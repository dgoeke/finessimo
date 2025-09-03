import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("settings-button")
export class SettingsButton extends LitElement {
  @property({ type: String }) label = "";
  @property({ type: Boolean }) disabled = false;
  @property({ type: String }) variant: "default" | "primary" | "danger" =
    "default";

  // Use light DOM for consistent styling
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private handleClick = (): void => {
    if (!this.disabled) {
      this.dispatchEvent(
        new CustomEvent("button-click", {
          bubbles: true,
          composed: true,
          detail: { label: this.label },
        }),
      );
    }
  };

  protected render(): unknown {
    return html`
      <button
        class="settings-button ${this.variant} ${this.disabled
          ? "disabled"
          : ""}"
        .disabled=${this.disabled}
        @click=${this.handleClick}
      >
        ${this.label}
      </button>
    `;
  }
}
