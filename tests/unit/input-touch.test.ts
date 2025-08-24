import { TouchInputHandler } from "../../src/input/touch";
import { Action, GameState, KeyAction } from "../../src/state/types";
import type { InputHandlerState } from "../../src/input/handler";
import { createRng } from "../../src/core/rng";
import { assertDefined } from "../helpers/assert";

function makeState(): GameState {
  // Build a minimal valid GameState by initializing the app reducer indirectly would be complex here.
  // For our input handler update tests, we only use `timing` fields.
  return {
    board: { width: 10, height: 20, cells: new Uint8Array(200) },
    active: undefined,
    hold: undefined,
    canHold: true,
    nextQueue: [],
    rng: createRng("touch"),
    timing: {
      tickHz: 60,
      dasMs: 133,
      arrMs: 2,
      softDrop: 10,
      lockDelayMs: 500,
      lineClearDelayMs: 0,
      gravityEnabled: false,
      gravityMs: 1000,
    },
    gameplay: { finesseCancelMs: 50 },
    tick: 0,
    status: "playing",
    stats: {
      piecesPlaced: 0,
      linesCleared: 0,
      optimalPlacements: 0,
      incorrectPlacements: 0,
      attempts: 0,
      startedAtMs: 0,
      timePlayedMs: 0,
      sessionPiecesPlaced: 0,
      sessionLinesCleared: 0,
      accuracyPercentage: 0,
      finesseAccuracy: 0,
      averageInputsPerPiece: 0,
      sessionStartMs: 0,
      totalSessions: 1,
      longestSessionMs: 0,
      piecesPerMinute: 0,
      linesPerMinute: 0,
      totalInputs: 0,
      optimalInputs: 0,
      totalFaults: 0,
      faultsByType: {},
      singleLines: 0,
      doubleLines: 0,
      tripleLines: 0,
      tetrisLines: 0,
    },
    physics: {
      lastGravityTime: 0,
      lockDelayStartTime: null,
      isSoftDropping: false,
      lineClearStartTime: null,
      lineClearLines: [],
    },
    inputLog: [],
    currentMode: "freePlay",
    modeData: null,
    finesseFeedback: null,
    modePrompt: null,
  };
}

describe("TouchInputHandler", () => {
  let handler: TouchInputHandler;
  let dispatched: Action[];
  interface Testable {
    state: InputHandlerState;
    triggerAction: (a: KeyAction, p: "down" | "up") => void;
  }

  beforeEach(() => {
    // Provide a board-frame container like the app layout
    document.body.innerHTML = '<div class="board-frame"></div>';
    handler = new TouchInputHandler();
    dispatched = [];
    handler.init((a: Action) => dispatched.push(a));
  });

  afterEach(() => {
    handler.stop();
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  test("start creates overlay inside board-frame and stop removes it", () => {
    handler.start();
    const overlay = document.querySelector("#touch-controls");
    expect(overlay).toBeTruthy();

    handler.stop();
    const overlayAfter = document.querySelector("#touch-controls");
    expect(overlayAfter).toBeFalsy();
  });

  test("update with DAS/ARR repeats movement when direction held", () => {
    handler.start();
    const state = makeState();

    // Force internal state to simulate holding Right long enough to surpass DAS
    const now = 1_000_000;
    const h = handler as unknown as Testable;
    h.state.currentDirection = 1;
    h.state.dasStartTime = now - state.timing.dasMs;
    h.state.arrLastTime = undefined;

    handler.update(state, now);
    expect(
      dispatched.some(
        (a) => a.type === "Move" && a.dir === 1 && a.source === "das",
      ),
    ).toBe(true);

    // Next ARR pulse after arrMs
    handler.update(state, now + state.timing.arrMs);
    // Should dispatch another repeat
    const moveCount = dispatched.filter(
      (a) => a.type === "Move" && a.dir === 1 && a.source === "das",
    ).length;
    expect(moveCount).toBeGreaterThanOrEqual(2);
  });

  test("soft drop pulses while engaged and stops on release", () => {
    handler.start();
    const state = makeState();
    const base = 2_000_000;

    // Engage soft drop
    (handler as unknown as Testable).triggerAction("SoftDropDown", "down");
    expect(
      dispatched.find((a) => a.type === "SoftDrop" && a.on === true),
    ).toBeTruthy();
    // Align last pulse time to base to avoid relying on Date.now in trigger
    (handler as unknown as Testable).state.softDropLastTime = base;

    // Advance time beyond interval to trigger repeat
    const sd = state.timing.softDrop === "infinite" ? 1 : state.timing.softDrop;
    const interval = Math.max(
      1,
      Math.floor(state.timing.gravityMs / Math.max(1, sd)),
    );
    handler.update(state, base + interval);
    const softCount = dispatched.filter(
      (a) => a.type === "SoftDrop" && a.on === true,
    ).length;
    expect(softCount).toBeGreaterThanOrEqual(2);

    // Release
    (handler as unknown as Testable).triggerAction("SoftDropDown", "up");
    expect(
      dispatched.find((a) => a.type === "SoftDrop" && a.on === false),
    ).toBeTruthy();
  });

  test("movement hold logs Down once and Up on release", () => {
    handler.start();

    // Press and release Left
    (handler as unknown as Testable).triggerAction("LeftDown", "down");
    (handler as unknown as Testable).triggerAction("LeftDown", "up");

    // Extract EnqueueInput actions only
    const enqueues = dispatched.filter(
      (a): a is Extract<Action, { type: "EnqueueInput" }> =>
        a.type === "EnqueueInput",
    );

    // Expect two log entries: LeftDown then LeftUp
    expect(enqueues.length).toBeGreaterThanOrEqual(2);
    const lastTwo = enqueues.slice(-2);
    assertDefined(lastTwo[0]);
    assertDefined(lastTwo[1]);
    expect(lastTwo[0].event.action).toBe("LeftDown");
    expect(lastTwo[1].event.action).toBe("LeftUp");
  });

  test("start/stop does not double-bind touch listeners", () => {
    // Capture add/remove calls with their targets to verify idempotency
    const addRecorded: {
      target: EventTarget;
      type: string;
      listener: EventListenerOrEventListenerObject | null;
      options?: boolean | AddEventListenerOptions;
    }[] = [];
    const removeRecorded: {
      target: EventTarget;
      type: string;
      listener: EventListenerOrEventListenerObject | null;
      options?: boolean | EventListenerOptions;
    }[] = [];

    const addSpy = jest
      .spyOn(EventTarget.prototype, "addEventListener")
      .mockImplementation(function (
        this: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
      ) {
        addRecorded.push({ target: this, type, listener, options });
        // Do not call the original to avoid recursion; we only need to record
        return;
      });

    const removeSpy = jest
      .spyOn(EventTarget.prototype, "removeEventListener")
      .mockImplementation(function (
        this: EventTarget,
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | EventListenerOptions,
      ) {
        removeRecorded.push({ target: this, type, listener, options });
        // Do not call original; just record
        return;
      });

    handler.start();
    const overlay = document.getElementById("touch-controls");
    assertDefined(overlay);

    const isOverlay = (r: { target: EventTarget }) =>
      r.target instanceof Element && r.target.id === "touch-controls";
    const isTouch = (r: { type: string }) =>
      r.type === "touchstart" ||
      r.type === "touchmove" ||
      r.type === "touchend" ||
      r.type === "touchcancel";

    const addedFirst = addRecorded.filter((r) => isOverlay(r) && isTouch(r));
    expect(addedFirst.length).toBe(4);

    // Calling start() again should not add more listeners
    handler.start();
    const addedSecond = addRecorded.filter((r) => isOverlay(r) && isTouch(r));
    expect(addedSecond.length).toBe(4);

    // Stop once should remove the four listeners
    handler.stop();
    const removedFirst = removeRecorded.filter(
      (r) => isOverlay(r) && isTouch(r),
    );
    expect(removedFirst.length).toBe(4);

    // Stop again should not remove additional listeners
    handler.stop();
    const removedSecond = removeRecorded.filter(
      (r) => isOverlay(r) && isTouch(r),
    );
    expect(removedSecond.length).toBe(4);

    // Starting again should add four more listeners (total 8)
    handler.start();
    const addedThird = addRecorded.filter((r) => isOverlay(r) && isTouch(r));
    expect(addedThird.length).toBe(8);

    // Cleanup spies
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
