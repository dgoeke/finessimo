import { GameState } from '../state/types';
import { KeyBindings, defaultKeyBindings, BindableAction } from '../input/handler';

export interface GameSettings {
  // Timing settings
  dasMs: number;
  arrMs: number;
  softDropCps: number;
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
}

export interface SettingsRenderer {
  initialize(container: HTMLElement): void;
  render(gameState: GameState): void;
  show(): void;
  hide(): void;
  destroy(): void;
  onSettingsChange(callback: (settings: Partial<GameSettings>) => void): void;
}

export class BasicSettingsRenderer implements SettingsRenderer {
  private container: HTMLElement | undefined;
  private settingsPanel: HTMLElement | undefined;
  private settingsChangeCallback?: (settings: Partial<GameSettings>) => void;
  private currentSettings: GameSettings;
  private currentKeyBindings: KeyBindings;
  private rebindingAction?: BindableAction;
  private boundCaptureHandler?: (e: KeyboardEvent) => void;

  constructor() {
    this.currentSettings = this.getDefaultSettings();
    const { settings, keyBindings } = this.loadStoreFromStorage();
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
      this.settingsPanel.style.display = 'block';
      document.body.classList.add('settings-open');
    }
  }

  hide(): void {
    if (this.settingsPanel) {
      this.stopRebinding();
      this.settingsPanel.style.display = 'none';
      document.body.classList.remove('settings-open');
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
    return JSON.parse(JSON.stringify(this.currentKeyBindings));
  }

  private getDefaultSettings(): GameSettings {
    return {
      // Timing settings (matching default TimingConfig)
      dasMs: 167,           // ~10 frames at 60fps
      arrMs: 33,            // ~2 frames at 60fps
      softDropCps: 20,      // 20 cells per second
      lockDelayMs: 500,     // 0.5 seconds
      lineClearDelayMs: 300, // 0.3 seconds
      
      // Gameplay settings
      gravityEnabled: false, // Disabled by default for trainer
      gravityMs: 1000,      // 1 second per cell
      finesseCancelMs: 50,  // 50ms cancellation window
      ghostPieceEnabled: true,
      nextPieceCount: 5,
      
      // Visual settings
      boardTheme: 'default',
      showGrid: true,
      uiScale: 1.0
    };
  }

  private readonly STORAGE_KEY = 'finessimo';

  private loadStoreFromStorage(): { settings: Partial<GameSettings>; keyBindings: KeyBindings } {
    // Consolidated store: { settings?: GameSettings, keyBindings?: KeyBindings }
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) || {};
        const kb = this.validateKeyBindings(parsed.keyBindings);
        const s = typeof parsed.settings === 'object' && parsed.settings ? parsed.settings : {};
        return { settings: s, keyBindings: kb };
      }
      // Legacy migration: read old keys if present
      const legacySettingsRaw = localStorage.getItem('finessimo-settings');
      const legacyKbRaw = localStorage.getItem('finessimo-keybindings');
      const settings = legacySettingsRaw ? JSON.parse(legacySettingsRaw) : {};
      const keyBindings = this.validateKeyBindings(legacyKbRaw ? JSON.parse(legacyKbRaw) : undefined);
      // Save consolidated for future
      this.saveStoreToStorage(settings, keyBindings);
      return { settings, keyBindings };
    } catch (error) {
      console.warn('Failed to load store from localStorage:', error);
      return { settings: {}, keyBindings: defaultKeyBindings() };
    }
  }

  private saveStoreToStorage(settings: Partial<GameSettings>, keyBindings: KeyBindings): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ settings, keyBindings }));
    } catch (error) {
      console.warn('Failed to save store to localStorage:', error);
    }
  }

  private validateKeyBindings(maybe: any): KeyBindings {
    const fallback = defaultKeyBindings();
    if (!maybe || typeof maybe !== 'object') return fallback;
    const merged: KeyBindings = { ...fallback, ...maybe };
    (Object.keys(fallback) as (keyof KeyBindings)[]).forEach(k => {
      if (!Array.isArray((merged as any)[k])) (merged as any)[k] = (fallback as any)[k];
    });
    return merged;
  }

  private createSettingsPanel(): void {
    if (!this.container) return;

    const overlay = document.createElement('div');
    overlay.className = 'settings-overlay';
    overlay.innerHTML = `
      <div class="settings-modal">
        <div class="settings-header">
          <h2>Settings</h2>
          <button class="close-button" id="close-settings">×</button>
        </div>
        
        <div class="settings-content">
          <div class="settings-tabs">
            <button class="tab-button active" data-tab="timing">Timing</button>
            <button class="tab-button" data-tab="gameplay">Gameplay</button>
            <button class="tab-button" data-tab="visual">Visual</button>
            <button class="tab-button" data-tab="controls">Controls</button>
          </div>
          
          <div class="settings-panels">
            <!-- Timing Settings -->
            <div class="settings-panel active" id="timing-panel">
              <div class="setting-group">
                <label>DAS Delay (ms)</label>
                <input type="range" id="das-delay" min="50" max="300" step="1" value="${this.currentSettings.dasMs}">
                <span class="value-display">${this.currentSettings.dasMs}ms</span>
              </div>
              
              <div class="setting-group">
                <label>ARR Rate (ms)</label>
                <input type="range" id="arr-rate" min="0" max="100" step="1" value="${this.currentSettings.arrMs}">
                <span class="value-display">${this.currentSettings.arrMs}ms</span>
              </div>
              
              <div class="setting-group">
                <label>Soft Drop Speed (cells/sec)</label>
                <input type="range" id="soft-drop-speed" min="1" max="60" step="1" value="${this.currentSettings.softDropCps}">
                <span class="value-display">${this.currentSettings.softDropCps}</span>
              </div>
              
              <div class="setting-group">
                <label>Lock Delay (ms)</label>
                <input type="range" id="lock-delay" min="100" max="1000" step="10" value="${this.currentSettings.lockDelayMs}">
                <span class="value-display">${this.currentSettings.lockDelayMs}ms</span>
              </div>
              
              <div class="setting-group">
                <label>Line Clear Delay (ms)</label>
                <input type="range" id="line-clear-delay" min="0" max="500" step="10" value="${this.currentSettings.lineClearDelayMs}">
                <span class="value-display">${this.currentSettings.lineClearDelayMs}ms</span>
              </div>
            </div>
            
            <!-- Gameplay Settings -->
            <div class="settings-panel" id="gameplay-panel">
              <div class="setting-group">
                <label>
                  <input type="checkbox" id="gravity-enabled" ${this.currentSettings.gravityEnabled ? 'checked' : ''}>
                  Enable Gravity
                </label>
              </div>
              
              <div class="setting-group">
                <label>Gravity Speed (ms per cell)</label>
                <input type="range" id="gravity-speed" min="50" max="2000" step="50" value="${this.currentSettings.gravityMs}">
                <span class="value-display">${this.currentSettings.gravityMs}ms</span>
              </div>
              
              <div class="setting-group">
                <label>Finesse Cancel Window (ms)</label>
                <input type="range" id="finesse-cancel" min="0" max="100" step="5" value="${this.currentSettings.finesseCancelMs}">
                <span class="value-display">${this.currentSettings.finesseCancelMs}ms</span>
              </div>
              
              <div class="setting-group">
                <label>
                  <input type="checkbox" id="ghost-piece" ${this.currentSettings.ghostPieceEnabled ? 'checked' : ''}>
                  Show Ghost Piece
                </label>
              </div>
              
              <div class="setting-group">
                <label>Next Pieces to Show</label>
                <input type="range" id="next-count" min="1" max="7" step="1" value="${this.currentSettings.nextPieceCount}">
                <span class="value-display">${this.currentSettings.nextPieceCount}</span>
              </div>
            </div>
            
            <!-- Visual Settings -->
            <div class="settings-panel" id="visual-panel">
              <div class="setting-group">
                <label>Board Theme</label>
                <select id="board-theme">
                  <option value="default" ${this.currentSettings.boardTheme === 'default' ? 'selected' : ''}>Default</option>
                  <option value="classic" ${this.currentSettings.boardTheme === 'classic' ? 'selected' : ''}>Classic</option>
                  <option value="minimal" ${this.currentSettings.boardTheme === 'minimal' ? 'selected' : ''}>Minimal</option>
                </select>
              </div>
              
              <div class="setting-group">
                <label>
                  <input type="checkbox" id="show-grid" ${this.currentSettings.showGrid ? 'checked' : ''}>
                  Show Grid Lines
                </label>
              </div>
              
              <div class="setting-group">
                <label>UI Scale</label>
                <input type="range" id="ui-scale" min="0.8" max="1.5" step="0.1" value="${this.currentSettings.uiScale}">
                <span class="value-display">${this.currentSettings.uiScale}x</span>
              </div>
            </div>

            <!-- Controls / Keybindings -->
            <div class="settings-panel" id="controls-panel">
              <div class="setting-group">
                <p>Click a keybind, then press any key to rebind.</p>
              </div>
              <div class="keybinds-list">
                ${this.renderKeybindRow('Move Left', 'MoveLeft')}
                ${this.renderKeybindRow('Move Right', 'MoveRight')}
                ${this.renderKeybindRow('Soft Drop', 'SoftDrop')}
                ${this.renderKeybindRow('Hard Drop', 'HardDrop')}
                ${this.renderKeybindRow('Rotate CW', 'RotateCW')}
                ${this.renderKeybindRow('Rotate CCW', 'RotateCCW')}
                ${this.renderKeybindRow('Hold', 'Hold')}
              </div>
            </div>
          </div>
        </div>
        
        <div class="settings-footer">
          <button class="button secondary" id="reset-settings">Reset to Defaults</button>
          <button class="button primary" id="apply-settings">Apply</button>
        </div>
      </div>
    `;

    this.settingsPanel = overlay;
    document.body.appendChild(overlay);
    
    // Initially hidden
    this.hide();
  }

  private bindEvents(): void {
    if (!this.settingsPanel) return;

    // Close button
    const closeButton = this.settingsPanel.querySelector('#close-settings');
    closeButton?.addEventListener('click', () => this.hide());
    
    // Close on overlay click
    this.settingsPanel.addEventListener('click', (e) => {
      if (e.target === this.settingsPanel) {
        this.hide();
      }
    });

    // Tab switching
    const tabButtons = this.settingsPanel.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const tabName = target.getAttribute('data-tab');
        if (tabName) {
          this.switchTab(tabName);
        }
      });
    });

    // Settings controls
    this.bindSettingControls();

    // Action buttons
    const resetButton = this.settingsPanel.querySelector('#reset-settings');
    resetButton?.addEventListener('click', () => this.resetToDefaults());
    
    const applyButton = this.settingsPanel.querySelector('#apply-settings');
    applyButton?.addEventListener('click', () => this.applySettings());
  }

  private bindSettingControls(): void {
    if (!this.settingsPanel) return;

    // Range inputs
    const rangeInputs = this.settingsPanel.querySelectorAll('input[type="range"]');
    rangeInputs.forEach(input => {
      const rangeInput = input as HTMLInputElement;
      const valueDisplay = rangeInput.parentElement?.querySelector('.value-display');
      
      rangeInput.addEventListener('input', () => {
        const value = rangeInput.value;
        const suffix = rangeInput.id.includes('delay') || rangeInput.id.includes('cancel') || rangeInput.id.includes('speed') || rangeInput.id === 'arr-rate' || rangeInput.id === 'das-delay' ? 'ms' : 
                      rangeInput.id === 'ui-scale' ? 'x' : '';
        if (valueDisplay) {
          valueDisplay.textContent = `${value}${suffix}`;
        }
      });
    });

    // Bind keybinding buttons
    const bindButtons = this.settingsPanel.querySelectorAll('[data-keybind-action]');
    bindButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const action = target.getAttribute('data-keybind-action') as BindableAction | null;
        if (!action) return;
        this.startRebinding(action, target);
      });
    });
  }

  private switchTab(tabName: string): void {
    if (!this.settingsPanel) return;

    // Update tab buttons
    const tabButtons = this.settingsPanel.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.classList.remove('active');
      if (button.getAttribute('data-tab') === tabName) {
        button.classList.add('active');
      }
    });

    // Update panels
    const panels = this.settingsPanel.querySelectorAll('.settings-panel');
    panels.forEach(panel => {
      panel.classList.remove('active');
      if (panel.id === `${tabName}-panel`) {
        panel.classList.add('active');
      }
    });
  }

  private syncSettingsFromGameState(gameState: GameState): void {
    // Update current settings to match game state
    this.currentSettings = {
      ...this.currentSettings,
      dasMs: gameState.timing.dasMs,
      arrMs: gameState.timing.arrMs,
      softDropCps: gameState.timing.softDropCps,
      lockDelayMs: gameState.timing.lockDelayMs,
      lineClearDelayMs: gameState.timing.lineClearDelayMs,
      gravityMs: gameState.timing.gravityMs,
      finesseCancelMs: gameState.gameplay.finesseCancelMs
    };
  }

  private applySettings(): void {
    if (!this.settingsPanel) return;

    // Collect all settings from UI
    const newSettings: Partial<GameSettings> = {};

    // Timing settings
    const dasInput = this.settingsPanel.querySelector('#das-delay') as HTMLInputElement;
    if (dasInput) newSettings.dasMs = parseInt(dasInput.value);

    const arrInput = this.settingsPanel.querySelector('#arr-rate') as HTMLInputElement;
    if (arrInput) newSettings.arrMs = parseInt(arrInput.value);

    const softDropInput = this.settingsPanel.querySelector('#soft-drop-speed') as HTMLInputElement;
    if (softDropInput) newSettings.softDropCps = parseInt(softDropInput.value);

    const lockDelayInput = this.settingsPanel.querySelector('#lock-delay') as HTMLInputElement;
    if (lockDelayInput) newSettings.lockDelayMs = parseInt(lockDelayInput.value);

    const lineClearDelayInput = this.settingsPanel.querySelector('#line-clear-delay') as HTMLInputElement;
    if (lineClearDelayInput) newSettings.lineClearDelayMs = parseInt(lineClearDelayInput.value);

    // Gameplay settings
    const gravityEnabledInput = this.settingsPanel.querySelector('#gravity-enabled') as HTMLInputElement;
    if (gravityEnabledInput) newSettings.gravityEnabled = gravityEnabledInput.checked;

    const gravitySpeedInput = this.settingsPanel.querySelector('#gravity-speed') as HTMLInputElement;
    if (gravitySpeedInput) newSettings.gravityMs = parseInt(gravitySpeedInput.value);

    const finesseCancelInput = this.settingsPanel.querySelector('#finesse-cancel') as HTMLInputElement;
    if (finesseCancelInput) newSettings.finesseCancelMs = parseInt(finesseCancelInput.value);

    const ghostPieceInput = this.settingsPanel.querySelector('#ghost-piece') as HTMLInputElement;
    if (ghostPieceInput) newSettings.ghostPieceEnabled = ghostPieceInput.checked;

    const nextCountInput = this.settingsPanel.querySelector('#next-count') as HTMLInputElement;
    if (nextCountInput) newSettings.nextPieceCount = parseInt(nextCountInput.value);

    // Visual settings
    const themeSelect = this.settingsPanel.querySelector('#board-theme') as HTMLSelectElement;
    if (themeSelect) newSettings.boardTheme = themeSelect.value;

    const showGridInput = this.settingsPanel.querySelector('#show-grid') as HTMLInputElement;
    if (showGridInput) newSettings.showGrid = showGridInput.checked;

    const uiScaleInput = this.settingsPanel.querySelector('#ui-scale') as HTMLInputElement;
    if (uiScaleInput) newSettings.uiScale = parseFloat(uiScaleInput.value);

    // Update internal settings
    this.currentSettings = { ...this.currentSettings, ...newSettings };
    
    // Save to storage
    this.saveStoreToStorage(this.currentSettings, this.currentKeyBindings);

    // Notify callback
    if (this.settingsChangeCallback) {
      // Include keybindings with settings change so input handler can update
      this.settingsChangeCallback({ ...newSettings, keyBindings: this.currentKeyBindings });
    }

    // Hide panel
    this.hide();
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
      this.settingsChangeCallback({ ...this.currentSettings, keyBindings: this.currentKeyBindings });
    }
  }

  destroy(): void {
    if (this.settingsPanel && this.settingsPanel.parentNode) {
      this.settingsPanel.parentNode.removeChild(this.settingsPanel);
    }
    this.container = undefined;
    this.settingsPanel = undefined;
  }

  // --- Keybindings helpers ---
  private renderKeybindRow(label: string, action: BindableAction): string {
    const code = this.currentKeyBindings[action]?.[0] || '';
    const keyLabel = this.formatKey(code) || 'Unbound';
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
    const hint = this.settingsPanel.querySelector(`[data-hint-for="${action}"]`) as HTMLElement | null;
    if (hint) hint.style.display = 'inline';
    buttonEl.classList.add('listening');

    this.boundCaptureHandler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      // Update binding to single key for this action
      const updated: KeyBindings = { ...this.currentKeyBindings, [action]: [e.code] };
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

    window.addEventListener('keydown', this.boundCaptureHandler, { capture: true, once: true });

    // Show cancel button and wire it
    const cancelBtn = this.settingsPanel.querySelector(`[data-cancel-for="${action}"]`) as HTMLButtonElement | null;
    if (cancelBtn) {
      cancelBtn.style.display = 'inline-block';
      const cancelHandler = (ev: Event) => {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        this.stopRebinding();
        cancelBtn.removeEventListener('click', cancelHandler);
      };
      cancelBtn.addEventListener('click', cancelHandler);
    }
  }

  private stopRebinding(): void {
    if (!this.settingsPanel) return;
    if (this.rebindingAction) {
      const hint = this.settingsPanel.querySelector(`[data-hint-for="${this.rebindingAction}"]`) as HTMLElement | null;
      if (hint) hint.style.display = 'none';
      const btn = this.settingsPanel.querySelector(`[data-keybind-action="${this.rebindingAction}"]`) as HTMLElement | null;
      btn?.classList.remove('listening');
      const cancel = this.settingsPanel.querySelector(`[data-cancel-for="${this.rebindingAction}"]`) as HTMLElement | null;
      if (cancel) cancel.style.display = 'none';
    }
    if (this.boundCaptureHandler) {
      // Remove pending listener if still attached
      window.removeEventListener('keydown', this.boundCaptureHandler, true);
    }
    this.rebindingAction = undefined;
  }

  private updateInputsFromSettings(): void {
    if (!this.settingsPanel) return;
    const setVal = (sel: string, val: string | number | boolean) => {
      const el = this.settingsPanel!.querySelector(sel) as HTMLInputElement | HTMLSelectElement | null;
      if (!el) return;
      if (el instanceof HTMLInputElement && (el.type === 'checkbox')) {
        (el as HTMLInputElement).checked = Boolean(val);
      } else {
        (el as HTMLInputElement | HTMLSelectElement).value = String(val);
      }
      // Update inline value display if present
      const display = el.parentElement?.querySelector('.value-display');
      if (display) {
        const id = (el as HTMLInputElement).id;
        const suffix = id.includes('delay') || id.includes('cancel') || id.includes('speed') || id === 'arr-rate' || id === 'das-delay' ? 'ms' : id === 'ui-scale' ? 'x' : '';
        display.textContent = `${(el as HTMLInputElement | HTMLSelectElement).value}${suffix}`;
      }
    };
    // Timing
    setVal('#das-delay', this.currentSettings.dasMs);
    setVal('#arr-rate', this.currentSettings.arrMs);
    setVal('#soft-drop-speed', this.currentSettings.softDropCps);
    setVal('#lock-delay', this.currentSettings.lockDelayMs);
    setVal('#line-clear-delay', this.currentSettings.lineClearDelayMs);
    // Gameplay
    setVal('#gravity-enabled', this.currentSettings.gravityEnabled);
    setVal('#gravity-speed', this.currentSettings.gravityMs);
    setVal('#finesse-cancel', this.currentSettings.finesseCancelMs);
    setVal('#ghost-piece', this.currentSettings.ghostPieceEnabled);
    setVal('#next-count', this.currentSettings.nextPieceCount);
    // Visual
    setVal('#board-theme', this.currentSettings.boardTheme);
    setVal('#show-grid', this.currentSettings.showGrid);
    setVal('#ui-scale', this.currentSettings.uiScale);
  }

  private updateKeybindButtons(): void {
    if (!this.settingsPanel) return;
    const all: Array<[BindableAction, string]> = [
      ['MoveLeft', 'Move Left'],
      ['MoveRight', 'Move Right'],
      ['SoftDrop', 'Soft Drop'],
      ['HardDrop', 'Hard Drop'],
      ['RotateCW', 'Rotate CW'],
      ['RotateCCW', 'Rotate CCW'],
      ['Hold', 'Hold']
    ];
    for (const [action] of all) {
      const code = this.currentKeyBindings[action]?.[0] || '';
      const label = this.formatKey(code) || 'Unbound';
      const btn = this.settingsPanel.querySelector(`[data-keybind-action="${action}"]`) as HTMLElement | null;
      const hint = this.settingsPanel.querySelector(`[data-hint-for="${action}"]`) as HTMLElement | null;
      const cancel = this.settingsPanel.querySelector(`[data-cancel-for="${action}"]`) as HTMLElement | null;
      if (btn) btn.textContent = label;
      if (hint) hint.style.display = 'none';
      if (cancel) cancel.style.display = 'none';
      btn?.classList.remove('listening');
    }
  }

  // Deprecated individual keybinding save now uses consolidated store

  private formatKey(code: string): string {
    const map: Record<string, string> = {
      ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
      Space: 'Space', Escape: 'Esc', Backspace: 'Backspace', Enter: 'Enter', Tab: 'Tab',
      ShiftLeft: 'LShift', ShiftRight: 'RShift', ControlLeft: 'LCtrl', ControlRight: 'RCtrl',
      AltLeft: 'LAlt', AltRight: 'RAlt', MetaLeft: 'LCmd', MetaRight: 'RCmd', CapsLock: 'Caps',
      Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
      Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backquote: '`'
    };
    if (!code) return '';
    if (map[code]) return map[code];
    if (code.startsWith('Key') && code.length === 4) return code.slice(3);
    if (code.startsWith('Digit') && code.length === 6) return code.slice(5);
    return code;
  }
}
