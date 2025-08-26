import { describe, test, expect, jest, beforeEach } from "@jest/globals";

import { KeyBindingManager } from "../../src/input/utils/key-binding-manager";

// Mock HTMLElement for testing
type MockElement = {
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
};

describe("KeyBindingManager", () => {
  let manager: KeyBindingManager;
  let mockElement: MockElement;
  let handler1: jest.Mock;
  let handler2: jest.Mock;
  let handler3: jest.Mock;

  beforeEach(() => {
    manager = new KeyBindingManager();
    mockElement = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    handler1 = jest.fn();
    handler2 = jest.fn();
    handler3 = jest.fn();
  });

  describe("bind()", () => {
    test("creates event listener on first binding", () => {
      const unsubscribe = manager.bind(
        mockElement as unknown as HTMLElement,
        { KeyA: handler1 },
        { event: "keydown" },
      );

      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
      );
      expect(mockElement.addEventListener).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    test("reuses existing listener for same event type", () => {
      const unsubscribe1 = manager.bind(
        mockElement as unknown as HTMLElement,
        { KeyA: handler1 },
        { event: "keydown" },
      );

      const unsubscribe2 = manager.bind(
        mockElement as unknown as HTMLElement,
        { KeyB: handler2 },
        { event: "keydown" },
      );

      // Should only create one listener
      expect(mockElement.addEventListener).toHaveBeenCalledTimes(1);

      unsubscribe1();
      unsubscribe2();
    });

    test("creates separate listeners for keydown and keyup", () => {
      const unsubscribe1 = manager.bind(
        mockElement as unknown as HTMLElement,
        { KeyA: handler1 },
        { event: "keydown" },
      );

      const unsubscribe2 = manager.bind(
        mockElement as unknown as HTMLElement,
        { KeyB: handler2 },
        { event: "keyup" },
      );

      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
      );
      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        "keyup",
        expect.any(Function),
      );
      expect(mockElement.addEventListener).toHaveBeenCalledTimes(2);

      unsubscribe1();
      unsubscribe2();
    });

    test("defaults to keydown when no event type specified", () => {
      const unsubscribe = manager.bind(mockElement as unknown as HTMLElement, {
        KeyA: handler1,
      });

      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
      );

      unsubscribe();
    });

    test("can bind multiple handlers to same key", () => {
      const unsubscribe1 = manager.bind(mockElement as unknown as HTMLElement, {
        KeyA: handler1,
      });

      const unsubscribe2 = manager.bind(mockElement as unknown as HTMLElement, {
        KeyA: handler2,
      });

      // Should still only create one listener
      expect(mockElement.addEventListener).toHaveBeenCalledTimes(1);

      // Get the listener function that was registered
      const listener = mockElement.addEventListener.mock.calls[0]?.[1] as (
        event: Event,
      ) => void;

      // Simulate KeyA event
      const mockEvent = {
        code: "KeyA",
      } as KeyboardEvent;

      listener(mockEvent);

      // Both handlers should be called
      expect(handler1).toHaveBeenCalledWith(mockEvent);
      expect(handler2).toHaveBeenCalledWith(mockEvent);

      unsubscribe1();
      unsubscribe2();
    });

    test("can bind multiple keys in single call", () => {
      const unsubscribe = manager.bind(mockElement as unknown as HTMLElement, {
        KeyA: handler1,
        KeyB: handler2,
        ShiftLeft: handler3,
      });

      expect(mockElement.addEventListener).toHaveBeenCalledTimes(1);

      // Get the listener
      const listener = mockElement.addEventListener.mock.calls[0]?.[1] as (
        event: Event,
      ) => void;

      // Test different keys
      listener({ code: "KeyA" } as KeyboardEvent);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled();

      listener({ code: "KeyB" } as KeyboardEvent);
      expect(handler2).toHaveBeenCalledTimes(1);

      listener({ code: "ShiftLeft" } as KeyboardEvent);
      expect(handler3).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    test("handles empty bindings object", () => {
      const unsubscribe = manager.bind(
        mockElement as unknown as HTMLElement,
        {},
      );

      // Currently creates listener even with no bindings (minor inefficiency but harmless)
      expect(mockElement.addEventListener).toHaveBeenCalledTimes(1);

      // Should clean up properly
      unsubscribe();
      expect(mockElement.removeEventListener).toHaveBeenCalledTimes(1);
    });
  });

  describe("cleanup/unsubscribe", () => {
    test("removes specific handlers when unsubscribed", () => {
      const unsubscribe1 = manager.bind(mockElement as unknown as HTMLElement, {
        KeyA: handler1,
      });

      const unsubscribe2 = manager.bind(mockElement as unknown as HTMLElement, {
        KeyA: handler2,
      });

      // Get the listener
      const listener = mockElement.addEventListener.mock.calls[0]?.[1] as (
        event: Event,
      ) => void;

      // Both handlers should work initially
      listener({ code: "KeyA" } as KeyboardEvent);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      // Unsubscribe first handler
      unsubscribe1();

      // Reset mocks
      handler1.mockClear();
      handler2.mockClear();

      // Only second handler should work now
      listener({ code: "KeyA" } as KeyboardEvent);
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);

      unsubscribe2();
    });

    test("removes event listener when all handlers are gone", () => {
      const unsubscribe1 = manager.bind(mockElement as unknown as HTMLElement, {
        KeyA: handler1,
      });

      const unsubscribe2 = manager.bind(mockElement as unknown as HTMLElement, {
        KeyB: handler2,
      });

      // Listener should be created
      expect(mockElement.addEventListener).toHaveBeenCalledTimes(1);

      // Remove first binding
      unsubscribe1();

      // Listener should still exist (KeyB handler remains)
      expect(mockElement.removeEventListener).not.toHaveBeenCalled();

      // Remove second binding
      unsubscribe2();

      // Now listener should be removed
      expect(mockElement.removeEventListener).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
      );
      expect(mockElement.removeEventListener).toHaveBeenCalledTimes(1);
    });

    test("keeps separate keydown/keyup listeners independent", () => {
      const unsubscribe1 = manager.bind(
        mockElement as unknown as HTMLElement,
        { KeyA: handler1 },
        { event: "keydown" },
      );

      const unsubscribe2 = manager.bind(
        mockElement as unknown as HTMLElement,
        { KeyB: handler2 },
        { event: "keyup" },
      );

      // Should have both listeners
      expect(mockElement.addEventListener).toHaveBeenCalledTimes(2);

      // Remove keydown binding
      unsubscribe1();

      // Should remove keydown listener but keep keyup
      expect(mockElement.removeEventListener).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
      );
      expect(mockElement.removeEventListener).toHaveBeenCalledTimes(1);

      // Remove keyup binding
      unsubscribe2();

      // Should now remove keyup listener too
      expect(mockElement.removeEventListener).toHaveBeenCalledWith(
        "keyup",
        expect.any(Function),
      );
      expect(mockElement.removeEventListener).toHaveBeenCalledTimes(2);
    });

    test("handles double cleanup gracefully", () => {
      const unsubscribe = manager.bind(mockElement as unknown as HTMLElement, {
        KeyA: handler1,
      });

      // First cleanup
      unsubscribe();
      expect(mockElement.removeEventListener).toHaveBeenCalledTimes(1);

      // Second cleanup should not break or call removeEventListener again
      expect(() => unsubscribe()).not.toThrow();
      expect(mockElement.removeEventListener).toHaveBeenCalledTimes(1);
    });

    test("cleans up handlers for multiple keys correctly", () => {
      const unsubscribe = manager.bind(mockElement as unknown as HTMLElement, {
        KeyA: handler1,
        KeyB: handler1, // Same handler for multiple keys
        KeyC: handler2,
      });

      const listener = mockElement.addEventListener.mock.calls[0]?.[1] as (
        event: Event,
      ) => void;

      // All keys should work
      listener({ code: "KeyA" } as KeyboardEvent);
      listener({ code: "KeyB" } as KeyboardEvent);
      listener({ code: "KeyC" } as KeyboardEvent);

      expect(handler1).toHaveBeenCalledTimes(2); // KeyA + KeyB
      expect(handler2).toHaveBeenCalledTimes(1); // KeyC

      // Cleanup should remove all
      unsubscribe();

      handler1.mockClear();
      handler2.mockClear();

      // Nothing should work after cleanup
      listener({ code: "KeyA" } as KeyboardEvent);
      listener({ code: "KeyB" } as KeyboardEvent);
      listener({ code: "KeyC" } as KeyboardEvent);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    test("ignores unknown key codes", () => {
      const unsubscribe = manager.bind(mockElement as unknown as HTMLElement, {
        KeyA: handler1,
      });

      const listener = mockElement.addEventListener.mock.calls[0]?.[1] as (
        event: Event,
      ) => void;

      // Simulate unknown key
      listener({ code: "KeyZ" } as KeyboardEvent);

      // Handler should not be called
      expect(handler1).not.toHaveBeenCalled();

      unsubscribe();
    });

    test("works with modifier keys", () => {
      const unsubscribe = manager.bind(mockElement as unknown as HTMLElement, {
        AltLeft: handler3,
        ControlLeft: handler2,
        ShiftLeft: handler1,
      });

      const listener = mockElement.addEventListener.mock.calls[0]?.[1] as (
        event: Event,
      ) => void;

      // Test modifier keys work as standalone bindings
      listener({ code: "ShiftLeft" } as KeyboardEvent);
      expect(handler1).toHaveBeenCalledTimes(1);

      listener({ code: "ControlLeft" } as KeyboardEvent);
      expect(handler2).toHaveBeenCalledTimes(1);

      listener({ code: "AltLeft" } as KeyboardEvent);
      expect(handler3).toHaveBeenCalledTimes(1);

      unsubscribe();
    });
  });
});
