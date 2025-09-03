import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { KeyBindings, BindableAction } from "../../input/keyboard";

@customElement("keybinding-modal")
export class KeybindingModal extends LitElement {
  @property({ type: Object }) keyBindings: KeyBindings = {
    HardDrop: ["Space"],
    Hold: ["KeyC"],
    MoveLeft: ["ArrowLeft", "KeyA"],
    MoveRight: ["ArrowRight", "KeyD"],
    RotateCCW: ["KeyZ"],
    RotateCW: ["ArrowUp", "KeyW"],
    SoftDrop: ["ArrowDown", "KeyS"],
  };

  @property({ reflect: true, type: Boolean }) visible = false;

  @state() private rebindingAction: BindableAction | undefined = undefined;

  private boundCaptureHandler?: (e: KeyboardEvent) => void;
  private boundBlockHandler?: (e: KeyboardEvent) => void;

  // Use light DOM so existing styles work
  protected createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Listen for escape key to close modal
    document.addEventListener("keydown", this.handleDocumentKeydown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleDocumentKeydown);
    this.stopRebinding();
  }

  private handleDocumentKeydown = (e: KeyboardEvent): void => {
    if (!this.visible) return;
    if (e.code === "Escape" && this.rebindingAction == null) {
      this.hide();
    }
  };

  show(): void {
    this.visible = true;
    document.body.classList.add("keybinding-modal-open");
    // Dispatch event to pause game
    this.dispatchEvent(
      new CustomEvent("keybinding-modal-opened", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  hide(): void {
    this.visible = false;
    document.body.classList.remove("keybinding-modal-open");
    this.stopRebinding();
    // Dispatch event to unpause game
    this.dispatchEvent(
      new CustomEvent("keybinding-modal-closed", {
        bubbles: true,
        composed: true,
      }),
    );
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
            <div class="settings-panels">${this.renderContent()}</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderHeader(): unknown {
    return html`
      <div class="settings-header">
        <h2>Controls</h2>
        <button class="close-button" @click=${(): void => this.hide()}>
          ×
        </button>
      </div>
    `;
  }

  private renderContent(): unknown {
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
      <div class="settings-panel active">
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
    const code = this.keyBindings[action][0] ?? "";
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

  private handleOverlayClick(e: Event): void {
    if (e.target === e.currentTarget && this.rebindingAction == null) {
      this.hide();
    }
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
        ...this.keyBindings,
        [action]: [e.code],
      };
      this.keyBindings = updated;

      // Emit change event
      this.dispatchEvent(
        new CustomEvent("keybinding-change", {
          bubbles: true,
          composed: true,
          detail: { keyBindings: updated },
        }),
      );

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
    if (map[code] != null) return map[code];
    if (code.startsWith("Key") && code.length === 4) return code.slice(3);
    if (code.startsWith("Digit") && code.length === 6) return code.slice(5);
    return code;
  }
}
