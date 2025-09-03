// Import keyboard types for keybinding support
import { defaultKeyBindings } from "../../input/keyboard";

import type { BindableAction, KeyBindings } from "../../input/keyboard";

// Brand utility for creating nominally typed values
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

// Branded types for settings values to prevent mixing different units/scales
export type DASValue = Brand<number, "DASValue">; // milliseconds
export type ARRValue = Brand<number, "ARRValue">; // milliseconds
export type SDFValue = Brand<number, "SDFValue">; // multiplier, use Infinity for infinite
export type LockDelayValue = Brand<number, "LockDelayValue">; // milliseconds
export type LineClearDelayValue = Brand<number, "LineClearDelayValue">; // milliseconds
export type GravitySpeedValue = Brand<number, "GravitySpeedValue">; // milliseconds
export type PreviewCountValue = Brand<number, "PreviewCountValue">; // piece count
export type CancelWindowValue = Brand<number, "CancelWindowValue">; // milliseconds

// Re-export keyboard types for convenience
export type { BindableAction, KeyBindings };

// Constructors with validation
export const asDASValue = (ms: number): DASValue => {
  if (ms < 0 || ms > 1000) throw new Error("DAS must be 0-1000ms");
  return ms as DASValue;
};

export const asARRValue = (ms: number): ARRValue => {
  if (ms < 0 || ms > 500) throw new Error("ARR must be 0-500ms");
  return ms as ARRValue;
};

const createSDFNumber = (multiplier: number): Brand<number, "SDFValue"> => {
  return multiplier as Brand<number, "SDFValue">;
};

export const asSDFValue = (multiplier: number): SDFValue => {
  if (multiplier < 1 || multiplier > 41) throw new Error("SDF must be 1-41x");
  if (multiplier === 41) {
    return Number.POSITIVE_INFINITY as SDFValue;
  }
  return createSDFNumber(multiplier);
};

export const asLockDelayValue = (ms: number): LockDelayValue => {
  if (ms < 0 || ms > 5000) throw new Error("Lock delay must be 0-5000ms");
  return ms as LockDelayValue;
};

export const asLineClearDelayValue = (ms: number): LineClearDelayValue => {
  if (ms < 0 || ms > 1000) throw new Error("Line clear delay must be 0-1000ms");
  return ms as LineClearDelayValue;
};

export const asGravitySpeedValue = (ms: number): GravitySpeedValue => {
  if (ms < 10 || ms > 5000) throw new Error("Gravity speed must be 10-5000ms");
  return ms as GravitySpeedValue;
};

export const asPreviewCountValue = (count: number): PreviewCountValue => {
  if (count < 0 || count > 7)
    throw new Error("Preview count must be 0-7 (0 = unlimited)");
  return count as PreviewCountValue;
};

export const asCancelWindowValue = (ms: number): CancelWindowValue => {
  if (ms < 0 || ms > 100)
    throw new Error("Cancel window must be 0-100ms (0 = disabled)");
  return ms as CancelWindowValue;
};

// Game mode discriminated union
export type GameMode = "freeplay" | "guided";

// Settings data structure with branded types
export type GameSettingsData = {
  // Game Mode Settings
  readonly gameMode: GameMode;
  readonly ghostPiecesEnabled: boolean; // freeplay only
  readonly finessePopupEnabled: boolean; // freeplay only
  readonly columnHighlightEnabled: boolean; // guided only

  // Gameplay Settings
  readonly gravityEnabled: boolean;
  readonly gravitySpeed: GravitySpeedValue;
  readonly soundOnMissEnabled: boolean;
  readonly retryOnMissEnabled: boolean;
  readonly previewCount: PreviewCountValue; // 0 = unlimited, 1-7 = limited
  readonly cancelWindow: CancelWindowValue; // 0 = disabled, 1-100ms = enabled

  // Handling Settings
  readonly das: DASValue;
  readonly arr: ARRValue;
  readonly sdf: SDFValue;
  readonly lockDelay: LockDelayValue;
  readonly lineClearDelay: LineClearDelayValue;

  // Keybindings
  readonly keyBindings: KeyBindings;
};

// Default settings factory
export function createDefaultSettings(): GameSettingsData {
  return {
    arr: asARRValue(33),
    cancelWindow: asCancelWindowValue(50), // enabled by default
    columnHighlightEnabled: true,

    das: asDASValue(167),
    finessePopupEnabled: true,
    gameMode: "guided",
    ghostPiecesEnabled: true,
    gravityEnabled: true,
    gravitySpeed: asGravitySpeedValue(750),
    keyBindings: defaultKeyBindings(),
    lineClearDelay: asLineClearDelayValue(125),
    lockDelay: asLockDelayValue(500),

    previewCount: asPreviewCountValue(0), // 0 = unlimited
    retryOnMissEnabled: false,
    sdf: asSDFValue(20),
    soundOnMissEnabled: false,
  } as const;
}

// Tab state
export type TabId = "stats" | "settings";

export type TabState = {
  readonly activeTab: TabId;
};

// Settings actions for the reducer
export type SettingsAction =
  | { type: "SetGameMode"; gameMode: GameMode }
  | { type: "ToggleGhostPieces"; enabled: boolean }
  | { type: "ToggleFinessePopup"; enabled: boolean }
  | { type: "ToggleColumnHighlight"; enabled: boolean }
  | { type: "ToggleGravity"; enabled: boolean }
  | { type: "SetGravitySpeed"; speed: GravitySpeedValue }
  | { type: "ToggleSoundOnMiss"; enabled: boolean }
  | { type: "ToggleRetryOnMiss"; enabled: boolean }
  | { type: "SetPreviewCount"; count: PreviewCountValue }
  | { type: "SetCancelWindow"; window: CancelWindowValue }
  | { type: "SetDAS"; das: DASValue }
  | { type: "SetARR"; arr: ARRValue }
  | { type: "SetSDF"; sdf: SDFValue }
  | { type: "SetLockDelay"; delay: LockDelayValue }
  | { type: "SetLineClearDelay"; delay: LineClearDelayValue }
  | { type: "SetKeyBindings"; keyBindings: KeyBindings }
  | { type: "ResetToDefaults" }
  | { type: "SwitchTab"; tab: TabId };

// Type guards for validation
export function isGameMode(value: string): value is GameMode {
  return value === "freeplay" || value === "guided";
}

export function isTabId(value: string): value is TabId {
  return value === "stats" || value === "settings";
}
