// Mock implementation of TinyKeys for testing

export type TinyKeysHandler = (event: KeyboardEvent) => void;
export type TinyKeysBindings = Record<string, TinyKeysHandler>;
export type TinyKeysUnsubscribe = () => void;
export type TinyKeysOptions = {
  event?: "keydown" | "keyup";
};

// Mock function to track registered bindings and simulate keyboard events
let mockKeydownBindings: TinyKeysBindings = {};
let mockKeyupBindings: TinyKeysBindings = {};
let mockUnsubscribeFns: jest.Mock[] = [];

// Mock implementation of tinykeys function
const tinykeys = jest.fn(
  (
    _target: Element | Document | Window,
    bindings: TinyKeysBindings,
    options?: TinyKeysOptions,
  ): TinyKeysUnsubscribe => {
    const eventType = options?.event || "keydown";

    // Store bindings for test access based on event type
    if (eventType === "keyup") {
      mockKeyupBindings = { ...mockKeyupBindings, ...bindings };
    } else {
      mockKeydownBindings = { ...mockKeydownBindings, ...bindings };
    }

    // Return mock unsubscribe function
    const mockUnsubscribeFn = jest.fn(() => {
      if (eventType === "keyup") {
        mockKeyupBindings = {};
      } else {
        mockKeydownBindings = {};
      }
    });

    mockUnsubscribeFns.push(mockUnsubscribeFn);
    return mockUnsubscribeFn;
  },
);

// Attach helper object to the default export for flexible access in tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(tinykeys as any).__mockTinyKeys = {
  getKeydownBindings: (): TinyKeysBindings => mockKeydownBindings,
  getKeyupBindings: (): TinyKeysBindings => mockKeyupBindings,
  getBindings: (): TinyKeysBindings => mockKeydownBindings,
  simulateKeyEvent: (
    keyPattern: string,
    eventType: "keydown" | "keyup" = "keydown",
    eventInit: KeyboardEventInit = {},
  ): void => {
    const bindings =
      eventType === "keyup" ? mockKeyupBindings : mockKeydownBindings;
    const handler = bindings[keyPattern];
    if (handler) {
      const event = new KeyboardEvent(eventType, {
        code: eventInit.code,
        key: eventInit.key,
        repeat: eventInit.repeat || false,
        ...eventInit,
      });
      Object.defineProperty(event, "preventDefault", {
        value: jest.fn(),
        writable: true,
      });
      handler(event);
    }
  },
  getUnsubscribeFunctions: (): jest.Mock[] => mockUnsubscribeFns,
  getUnsubscribe: (): jest.Mock => mockUnsubscribeFns[0] || jest.fn(),
  clear: (): void => {
    mockKeydownBindings = {};
    mockKeyupBindings = {};
    mockUnsubscribeFns = [];
  },
};

// Helper functions for tests to access and control the mock
export const __mockTinyKeys = {
  // Get currently registered bindings for keydown
  getKeydownBindings: (): TinyKeysBindings => mockKeydownBindings,

  // Get currently registered bindings for keyup
  getKeyupBindings: (): TinyKeysBindings => mockKeyupBindings,

  // Legacy method - returns keydown bindings for backward compatibility
  getBindings: (): TinyKeysBindings => mockKeydownBindings,

  // Simulate a keyboard event by calling the appropriate handler
  simulateKeyEvent: (
    keyPattern: string,
    eventType: "keydown" | "keyup" = "keydown",
    eventInit: KeyboardEventInit = {},
  ): void => {
    const bindings =
      eventType === "keyup" ? mockKeyupBindings : mockKeydownBindings;
    const handler = bindings[keyPattern];

    if (handler) {
      // Create a mock KeyboardEvent with the provided properties
      const event = new KeyboardEvent(eventType, {
        code: eventInit.code,
        key: eventInit.key,
        repeat: eventInit.repeat || false,
        ...eventInit,
      });

      // Add preventDefault method
      Object.defineProperty(event, "preventDefault", {
        value: jest.fn(),
        writable: true,
      });

      handler(event);
    }
  },

  // Get all unsubscribe functions for testing cleanup
  getUnsubscribeFunctions: (): jest.Mock[] => mockUnsubscribeFns,

  // Legacy method - returns first unsubscribe function for backward compatibility
  getUnsubscribe: (): jest.Mock => mockUnsubscribeFns[0] || jest.fn(),

  // Clear all mock data
  clear: (): void => {
    mockKeydownBindings = {};
    mockKeyupBindings = {};
    mockUnsubscribeFns = [];
  },
};

// Default export for ESM compatibility
export default tinykeys;

// Also expose on globalThis for cases where module resolution differs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__mockTinyKeysGlobal = __mockTinyKeys;
