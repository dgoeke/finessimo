import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("settings-slider")
export class SettingsSlider extends LitElement {
  @property({ type: String }) label = "";
  @property({ type: Number }) value = 0;
  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Number }) step = 1;
  @property({ type: String }) unit = "";
  @property({ type: Boolean }) disabled = false;
  @property({ attribute: false }) formatValue?: (
    value: number,
    unit: string,
  ) => string;

  @state() private isEditing = false;
  @state() private editValue = "";
  @state() private isDragging = false;
  @state() private dragStartValue = 0;
  @state() private dragStartX = 0;
  @state() private dragStartY = 0;

  // Use light DOM for consistent styling
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("mousemove", this.handleMouseMove);
    document.addEventListener("mouseup", this.handleMouseUp);
    document.addEventListener("click", this.handleDocumentClick);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("mouseup", this.handleMouseUp);
    document.removeEventListener("click", this.handleDocumentClick);
  }

  private handleDocumentClick = (event: Event): void => {
    if (this.isEditing && !this.contains(event.target as Node)) {
      this.exitEditMode();
    }
  };

  private handleValueDoubleClick = (): void => {
    if (!this.disabled) {
      this.isEditing = true;
      this.editValue = String(this.value);
      this.requestUpdate();
      // Focus the input after render
      setTimeout(() => {
        const input = this.querySelector<HTMLInputElement>(".slider-input");
        input?.focus();
        input?.select();
      }, 0);
    }
  };

  private handleValueMouseDown = (event: MouseEvent): void => {
    if (!this.disabled) {
      this.isDragging = true;
      this.dragStartValue = this.value;
      this.dragStartX = event.clientX;
      this.dragStartY = event.clientY;
      event.preventDefault();
    }
  };

  private handleMouseMove = (event: MouseEvent): void => {
    if (!this.isDragging) return;

    const deltaX = event.clientX - this.dragStartX;
    const deltaY = event.clientY - this.dragStartY;

    // Use both X and Y movement for drag sensitivity
    // Right/up increases, left/down decreases
    const delta = deltaX - deltaY;
    const sensitivity = (this.max - this.min) / 200; // 200px for full range
    const rawValue = this.dragStartValue + delta * sensitivity;

    const newValue =
      Math.round(Math.max(this.min, Math.min(this.max, rawValue)) / this.step) *
      this.step;

    if (newValue !== this.value) {
      this.emitChange(newValue);
    }
  };

  private handleMouseUp = (): void => {
    this.isDragging = false;
  };

  private handleInputChange = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    this.editValue = target.value;
  };

  private handleInputKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Enter") {
      this.commitEditValue();
    } else if (event.key === "Escape") {
      this.exitEditMode();
    }
  };

  private commitEditValue = (): void => {
    const numValue = parseFloat(this.editValue);
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(this.min, Math.min(this.max, numValue));
      const steppedValue = Math.round(clampedValue / this.step) * this.step;
      this.emitChange(steppedValue);
    }
    this.exitEditMode();
  };

  private exitEditMode(): void {
    this.isEditing = false;
    this.editValue = "";
  }

  private emitChange(newValue: number): void {
    this.dispatchEvent(
      new CustomEvent("slider-change", {
        bubbles: true,
        composed: true,
        detail: { value: newValue },
      }),
    );
  }

  protected render(): unknown {
    let displayValue: string;
    if (this.formatValue) {
      displayValue = this.formatValue(this.value, this.unit);
    } else if (this.unit.length > 0) {
      displayValue = `${String(this.value)}${this.unit}`;
    } else {
      displayValue = String(this.value);
    }

    return html`
      <div
        class="settings-slider ${this.disabled ? "disabled" : ""} ${this
          .isDragging
          ? "dragging"
          : ""} ${this.label.length === 0 ? "no-label" : ""}"
      >
        <span class="slider-label">${this.label}</span>
        <div class="slider-value-container">
          ${this.isEditing
            ? html`
                <input
                  class="slider-input"
                  type="number"
                  .value=${this.editValue}
                  .min=${String(this.min)}
                  .max=${String(this.max)}
                  .step=${String(this.step)}
                  @input=${this.handleInputChange}
                  @keydown=${this.handleInputKeydown}
                  @blur=${this.commitEditValue}
                />
              `
            : html`
                <span
                  class="slider-value"
                  @dblclick=${this.handleValueDoubleClick}
                  @mousedown=${this.handleValueMouseDown}
                >
                  ${displayValue}
                </span>
              `}
        </div>
      </div>
    `;
  }
}
