/**
 * Typed DOM query utilities to centralize and type-safe DOM access
 */

/**
 * Type-safe querySelector for custom elements with known types
 */
export function queryCustomElement(selector: string): Element | null {
  return document.querySelector(selector);
}

/**
 * Get settings view element with proper typing
 */
export function getSettingsView(): Element | null {
  return document.querySelector("settings-view");
}

/**
 * Get finessimo shell element with proper typing
 */
export function getFinessimoShell(): Element | null {
  return document.querySelector("finessimo-shell");
}

/**
 * Get board frame element for overlay attachment
 */
export function getBoardFrame(): Element | null {
  return document.querySelector(".board-frame");
}

/**
 * Type-safe querySelector with assertion for required elements
 */
export function requireElement(selector: string, context = "DOM"): Element {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Required element "${selector}" not found in ${context}`);
  }
  return element;
}
