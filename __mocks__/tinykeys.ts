// Mock implementation of TinyKeys for testing

export type TinyKeysHandler = (event: KeyboardEvent) => void;
export type TinyKeysBindings = Record<string, TinyKeysHandler>;
export type TinyKeysUnsubscribe = () => void;

// Mock function to track registered bindings and simulate keyboard events
let mockBindings: TinyKeysBindings = {};
let mockUnsubscribeFn: jest.Mock;

// Mock implementation of tinykeys function
const tinykeys = jest.fn(
  (target: Element | Document | Window, bindings: TinyKeysBindings): TinyKeysUnsubscribe => {
    // Store bindings for test access
    mockBindings = { ...bindings };
    
    // Return mock unsubscribe function
    mockUnsubscribeFn = jest.fn(() => {
      mockBindings = {};
    });
    
    return mockUnsubscribeFn;
  }
);

// Helper functions for tests to access and control the mock
export const __mockTinyKeys = {
  // Get currently registered bindings
  getBindings: (): TinyKeysBindings => mockBindings,
  
  // Simulate a keyboard event by calling the appropriate handler
  simulateKeyEvent: (keyPattern: string, eventInit: KeyboardEventInit = {}): void => {
    const handler = mockBindings[keyPattern];
    if (handler) {
      // Create a mock KeyboardEvent with the provided properties
      const event = new KeyboardEvent(eventInit.type || 'keydown', {
        code: eventInit.code,
        key: eventInit.key,
        repeat: eventInit.repeat || false,
        ...eventInit
      });
      
      // Add preventDefault method
      Object.defineProperty(event, 'preventDefault', {
        value: jest.fn(),
        writable: true
      });
      
      handler(event);
    }
  },
  
  // Get the unsubscribe function for testing cleanup
  getUnsubscribe: (): jest.Mock => mockUnsubscribeFn,
  
  // Clear all mock data
  clear: (): void => {
    mockBindings = {};
    mockUnsubscribeFn = jest.fn();
  }
};

export default tinykeys;