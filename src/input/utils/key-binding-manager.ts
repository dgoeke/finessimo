/**
 * Simple key binding manager that maps keyboard events directly to handlers.
 * Supports all keys including modifier keys as standalone bindings.
 */

export class KeyBindingManager {
  private keydownHandlers = new Map<
    string,
    Set<(event: KeyboardEvent) => void>
  >();
  private keyupHandlers = new Map<
    string,
    Set<(event: KeyboardEvent) => void>
  >();
  private keydownListener: ((e: Event) => void) | undefined = undefined;
  private keyupListener: ((e: Event) => void) | undefined = undefined;

  /**
   * Bind key handlers to a target element
   * @param target - Window or HTMLElement to attach listeners to
   * @param bindings - Map of key codes to event handlers
   * @param options - Event type to bind ('keydown' or 'keyup')
   * @returns Cleanup function to remove all bindings
   */
  bind(
    target: Window | HTMLElement,
    bindings: Record<string, (event: KeyboardEvent) => void>,
    options?: { event?: "keydown" | "keyup" },
  ): () => void {
    const eventType = options?.event ?? "keydown";
    const handlers =
      eventType === "keydown" ? this.keydownHandlers : this.keyupHandlers;

    // Store handlers for each key
    for (const [key, handler] of Object.entries(bindings)) {
      if (!handlers.has(key)) {
        handlers.set(key, new Set());
      }
      const keyHandlers = handlers.get(key);
      if (keyHandlers) {
        keyHandlers.add(handler);
      }
    }

    // Create or get existing listener
    if (eventType === "keydown" && this.keydownListener === undefined) {
      this.keydownListener = (event: Event): void => {
        const keyEvent = event as KeyboardEvent;
        const keyHandlers = this.keydownHandlers.get(keyEvent.code);
        keyHandlers?.forEach((handler) => handler(keyEvent));
      };
      target.addEventListener("keydown", this.keydownListener);
    } else if (eventType === "keyup" && this.keyupListener === undefined) {
      this.keyupListener = (event: Event): void => {
        const keyEvent = event as KeyboardEvent;
        const keyHandlers = this.keyupHandlers.get(keyEvent.code);
        keyHandlers?.forEach((handler) => handler(keyEvent));
      };
      target.addEventListener("keyup", this.keyupListener);
    }

    // Return cleanup function
    return () => {
      for (const [key, handler] of Object.entries(bindings)) {
        handlers.get(key)?.delete(handler);
        if (handlers.get(key)?.size === 0) {
          handlers.delete(key);
        }
      }

      // Clean up listeners if no handlers remain
      if (
        this.keydownHandlers.size === 0 &&
        this.keydownListener !== undefined
      ) {
        target.removeEventListener("keydown", this.keydownListener);
        this.keydownListener = undefined;
      }
      if (this.keyupHandlers.size === 0 && this.keyupListener !== undefined) {
        target.removeEventListener("keyup", this.keyupListener);
        this.keyupListener = undefined;
      }
    };
  }
}

/**
 * Global instance for convenience
 */
export const keyBindingManager = new KeyBindingManager();
