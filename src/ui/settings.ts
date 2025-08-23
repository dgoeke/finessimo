import { GameState } from '../state/types';

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
  private isVisible = false;
  private settingsChangeCallback?: (settings: Partial<GameSettings>) => void;
  private currentSettings: GameSettings;

  constructor() {
    this.currentSettings = this.getDefaultSettings();
    this.loadSettingsFromStorage();
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
      this.isVisible = true;
      document.body.classList.add('settings-open');
    }
  }

  hide(): void {
    if (this.settingsPanel) {
      this.settingsPanel.style.display = 'none';
      this.isVisible = false;
      document.body.classList.remove('settings-open');
    }
  }

  onSettingsChange(callback: (settings: Partial<GameSettings>) => void): void {
    this.settingsChangeCallback = callback;
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

  private loadSettingsFromStorage(): void {
    try {
      const saved = localStorage.getItem('finessimo-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.currentSettings = { ...this.currentSettings, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load settings from localStorage:', error);
    }
  }

  private saveSettingsToStorage(): void {
    try {
      localStorage.setItem('finessimo-settings', JSON.stringify(this.currentSettings));
    } catch (error) {
      console.warn('Failed to save settings to localStorage:', error);
    }
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
    this.saveSettingsToStorage();

    // Notify callback
    if (this.settingsChangeCallback) {
      this.settingsChangeCallback(newSettings);
    }

    // Hide panel
    this.hide();
  }

  private resetToDefaults(): void {
    this.currentSettings = this.getDefaultSettings();
    this.saveSettingsToStorage();
    
    if (this.settingsChangeCallback) {
      this.settingsChangeCallback(this.currentSettings);
    }
    
    // Recreate the panel with default values
    if (this.settingsPanel && this.settingsPanel.parentNode) {
      this.settingsPanel.parentNode.removeChild(this.settingsPanel);
    }
    this.createSettingsPanel();
    this.bindEvents();
    
    if (this.isVisible) {
      this.show();
    }
  }

  destroy(): void {
    if (this.settingsPanel && this.settingsPanel.parentNode) {
      this.settingsPanel.parentNode.removeChild(this.settingsPanel);
    }
    this.container = undefined;
    this.settingsPanel = undefined;
  }
}