import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export type DropdownOption = {
  readonly value: string;
  readonly label: string;
};

@customElement("settings-dropdown")
export class SettingsDropdown extends LitElement {
  @property({ type: Array }) options: ReadonlyArray<DropdownOption> = [];
  @property({ type: String }) value = "";
  @property({ type: Boolean }) disabled = false;

  @state() private isOpen = false;

  // Use light DOM for consistent styling
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Close dropdown when clicking outside
    document.addEventListener("click", this.handleDocumentClick);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("click", this.handleDocumentClick);
  }

  private handleDocumentClick = (event: Event): void => {
    if (!this.contains(event.target as Node)) {
      this.isOpen = false;
    }
  };

  private toggleDropdown = (): void => {
    if (!this.disabled) {
      this.isOpen = !this.isOpen;
    }
  };

  private selectOption(value: string): void {
    this.isOpen = false;
    if (value !== this.value) {
      this.dispatchEvent(
        new CustomEvent("dropdown-change", {
          bubbles: true,
          composed: true,
          detail: { value },
        }),
      );
    }
  }

  private getCurrentLabel(): string {
    const option = this.options.find((opt) => opt.value === this.value);
    return option?.label ?? this.value;
  }

  protected render(): unknown {
    return html`
      <div
        class="settings-dropdown ${this.isOpen ? "open" : ""} ${this.disabled
          ? "disabled"
          : ""}"
      >
        <button
          class="dropdown-trigger"
          @click=${this.toggleDropdown}
          .disabled=${this.disabled}
        >
          <span class="dropdown-value">${this.getCurrentLabel()}</span>
          <span class="dropdown-arrow">▼</span>
        </button>

        ${this.isOpen
          ? html`
              <div class="dropdown-menu">
                ${this.options.map(
                  (option) => html`
                    <button
                      class="dropdown-option ${option.value === this.value
                        ? "selected"
                        : ""}"
                      @click=${(): void => this.selectOption(option.value)}
                    >
                      ${option.label}
                    </button>
                  `,
                )}
              </div>
            `
          : ""}
      </div>
    `;
  }
}
