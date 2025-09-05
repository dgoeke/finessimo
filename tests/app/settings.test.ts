import { loadSettings, saveSettings } from "../../src/app/settings";
import {
  defaultKeyBindings,
  type KeyBindings,
} from "../../src/input/keyboard/bindings";
import { createDurationMs } from "../../src/types/brands";

import type { GameState } from "../../src/state/types";

// Mock localStorage
const mockLocalStorage = {
  clear: jest.fn(),
  getItem: jest.fn(),
  setItem: jest.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

describe("settings persistence", () => {
  beforeEach(() => {
    mockLocalStorage.getItem.mockReset();
    mockLocalStorage.setItem.mockReset();
  });

  it("loadSettings flattens nested store", () => {
    const store = {
      gameplay: {
        finesseBoopEnabled: false,
        finesseCancelMs: 50,
        finesseFeedbackEnabled: true,
        ghostPieceEnabled: true,
        guidedColumnHighlightEnabled: true,
        nextPieceCount: 5,
        retryOnFinesseError: false,
      },
      mode: "freeplay", // legacy lowercase tolerated
      timing: {
        arrMs: 33,
        dasMs: 167,
        gravityEnabled: true,
        gravityMs: 750,
        lineClearDelayMs: 125,
        lockDelayMs: 500,
        softDrop: 20,
      },
    };
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(store));

    const s = loadSettings();
    expect(s.mode).toBe("freePlay");
    expect(s.dasMs).toBe(167);
    expect(s.arrMs).toBe(33);
    expect(s.softDrop).toBe(20);
    expect(s.lockDelayMs).toBe(500);
    expect(s.lineClearDelayMs).toBe(125);
    expect(s.gravityEnabled).toBe(true);
    expect(s.gravityMs).toBe(750);
    expect(s.finesseCancelMs).toBe(50);
    expect(s.ghostPieceEnabled).toBe(true);
    expect(s.guidedColumnHighlightEnabled).toBe(true);
    expect(s.nextPieceCount).toBe(5);
    expect(s.finesseFeedbackEnabled).toBe(true);
    expect(s.finesseBoopEnabled).toBe(false);
    expect(s.retryOnFinesseError).toBe(false);
  });

  it("saveSettings merges snapshot into consolidated store", () => {
    const existing = { someOther: "keep" };
    mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(existing));

    const state = {
      currentMode: "freePlay",
      gameplay: {
        finesseBoopEnabled: false,
        finesseCancelMs: createDurationMs(50),
        finesseFeedbackEnabled: true,
        ghostPieceEnabled: true,
        guidedColumnHighlightEnabled: true,
        holdEnabled: true,
        nextPieceCount: 5,
        retryOnFinesseError: false,
      },
      timing: {
        arrMs: createDurationMs(30),
        dasMs: createDurationMs(150),
        gravityEnabled: true,
        gravityMs: createDurationMs(700),
        lineClearDelayMs: createDurationMs(100),
        lockDelayMaxResets: 15,
        lockDelayMs: createDurationMs(500),
        softDrop: 20,
        tickHz: 60 as const,
      },
    } as unknown as GameState;

    const kb: KeyBindings = defaultKeyBindings();

    saveSettings(state, kb);

    expect(mockLocalStorage.setItem).toHaveBeenCalled();
    const call = mockLocalStorage.setItem.mock.calls[0] as [string, string];
    expect(call[0]).toBe("finessimo");
    const saved = JSON.parse(call[1]) as Record<string, unknown>;
    expect(saved["someOther"]).toBe("keep");
    expect(saved["mode"]).toBe("freePlay");
    expect(saved["keyBindings"]).toBeDefined();
    const t = saved["timing"] as Record<string, unknown>;
    const g = saved["gameplay"] as Record<string, unknown>;
    expect(t["dasMs"]).toBe(150);
    expect(t["arrMs"]).toBe(30);
    expect(t["lockDelayMs"]).toBe(500);
    expect(t["lineClearDelayMs"]).toBe(100);
    expect(t["gravityEnabled"]).toBe(true);
    expect(t["gravityMs"]).toBe(700);
    expect(g["finesseCancelMs"]).toBe(50);
    expect(g["nextPieceCount"]).toBe(5);
  });
});
