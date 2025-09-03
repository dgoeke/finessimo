import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("settings-checkbox")
export class SettingsCheckbox extends LitElement {
  @property({ type: String }) label = "";
  @property({ type: Boolean }) checked = false;
  @property({ type: Boolean }) disabled = false;

  // Use light DOM for consistent styling
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  private handleChange = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    this.dispatchEvent(
      new CustomEvent("checkbox-change", {
        bubbles: true,
        composed: true,
        detail: { checked: target.checked },
      }),
    );
  };

  protected render(): unknown {
    return html`
      <label class="settings-checkbox ${this.checked ? "checked" : ""}">
        <input
          type="checkbox"
          .checked=${this.checked}
          .disabled=${this.disabled}
          @change=${this.handleChange}
        />
        <span class="checkbox-indicator"></span>
        <span class="checkbox-label">${this.label}</span>
      </label>
    `;
  }
}
