/**
 * Type-safe helpers for end-to-end integration tests
 */

import { type FinessimoApp } from "@/app/app";
import { type Action, type GameState } from "@/state/types";

// Interface for internal app methods we need for testing
type AppInternals = {
  dispatch: (action: Action) => void;
  handleSettingsChange: (settings: Record<string, unknown>) => void;
};

// Type-safe wrapper for internal app methods
export class AppTestWrapper {
  private internals: AppInternals;

  constructor(private app: FinessimoApp) {
    // Cast once in constructor to avoid repeated unsafe casts
    this.internals = app as unknown as AppInternals;
  }

  dispatch(action: Action): void {
    this.internals.dispatch(action);
  }

  handleSettingsChange(settings: Record<string, unknown>): void {
    this.internals.handleSettingsChange(settings);
  }

  getState(): GameState {
    return this.app.getState();
  }

  initialize(): void {
    this.app.initialize();
  }

  start(): void {
    this.app.start();
  }

  destroy(): void {
    this.app.destroy();
  }

  setGameMode(mode: string): void {
    this.app.setGameMode(mode);
  }
}

// Interface for settings modal methods we need to mock
type MockSettingsModal = {
  getCurrentSettings: () => Record<string, unknown>;
  getCurrentKeyBindings: () => Record<string, Array<string>>;
  show: () => void;
};

// Test utilities for DOM setup
export function createMockSettingsModal(): HTMLElement {
  // Create a settings-modal element to match app queries without overriding DOM APIs
  const settingsModal = document.createElement("settings-modal");
  settingsModal.className = "settings-modal-mock";

  // Cast once to avoid repeated unsafe casts
  const mockElement = settingsModal as unknown as MockSettingsModal;
  mockElement.getCurrentSettings = (): Record<string, unknown> => ({});
  mockElement.getCurrentKeyBindings = (): Record<string, Array<string>> => ({
    HardDrop: ["Space"],
    Hold: ["KeyC"],
    MoveLeft: ["ArrowLeft"],
    MoveRight: ["ArrowRight"],
    RotateCCW: ["KeyZ"],
    RotateCW: ["ArrowUp"],
    SoftDrop: ["ArrowDown"],
  });
  mockElement.show = jest.fn() as () => void;

  return settingsModal;
}

// Frame time management
export class TimeManager {
  private _currentTime: number;

  constructor(initialTime = 1000) {
    this._currentTime = initialTime;
  }

  get currentTime(): number {
    return this._currentTime;
  }

  advance(deltaMs: number): void {
    this._currentTime += deltaMs;
  }

  getMockPerformanceNow(): () => number {
    return (): number => this._currentTime;
  }
}
