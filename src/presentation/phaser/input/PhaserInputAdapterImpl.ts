import Phaser from "phaser";

import {
  defaultKeyBindings,
  mapKeyToBinding,
  type KeyBindings,
} from "../../../input/keyboard";
import { fromNow } from "../../../types/timestamp";

import { type PhaserInputAdapter, type InputEvent } from "./PhaserInputAdapter";

import type { DASEvent } from "../../../input/machines/das";
import type { Ms } from "../presenter/types";

/**
 * Phaser keyboard adapter translating raw key presses into DAS events
 * and immediate actions. Timing logic (DAS/ARR) lives in DASMachineService;
 * this layer merely reports key transitions for a higher layer to handle.
 */
export class PhaserInputAdapterImpl implements PhaserInputAdapter {
  private readonly queue: Array<InputEvent> = [];

  constructor(
    scene: Phaser.Scene,
    bindings: KeyBindings = defaultKeyBindings(),
  ) {
    const kb = scene.input.keyboard;
    if (!kb) return; // narrow for strict types; keyboard plugin should exist in real runtime
    // Capture common control keys to prevent browser scrolling etc.
    kb.addCapture([
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    ]);

    // Event-driven keyboard handling based on KeyboardEvent.code
    kb.on("keydown", (ev: KeyboardEvent) => {
      const a = mapKeyToBinding(ev.code, bindings);
      const now = fromNow() as number;
      switch (a) {
        case null:
          break;
        case "MoveLeft":
          this.queue.push({ direction: -1, timestamp: now, type: "KEY_DOWN" });
          break;
        case "MoveRight":
          this.queue.push({ direction: 1, timestamp: now, type: "KEY_DOWN" });
          break;
        case "RotateCW":
          this.queue.push({
            dir: "CW",
            timestampMs: fromNow(),
            type: "Rotate",
          });
          break;
        case "RotateCCW":
          this.queue.push({
            dir: "CCW",
            timestampMs: fromNow(),
            type: "Rotate",
          });
          break;
        case "HardDrop":
          this.queue.push({ timestampMs: fromNow(), type: "HardDrop" });
          break;
        case "Hold":
          this.queue.push({ type: "Hold" });
          break;
        case "SoftDrop":
          this.queue.push({
            on: true,
            timestampMs: fromNow(),
            type: "SoftDrop",
          });
          break;
      }
    });

    kb.on("keyup", (ev: KeyboardEvent) => {
      const a = mapKeyToBinding(ev.code, bindings);
      const now = fromNow() as number;
      switch (a) {
        case null:
        case "HardDrop":
        case "Hold":
        case "RotateCW":
        case "RotateCCW":
          // no-op on keyup
          break;
        case "MoveLeft":
          this.queue.push({ direction: -1, timestamp: now, type: "KEY_UP" });
          break;
        case "MoveRight":
          this.queue.push({ direction: 1, timestamp: now, type: "KEY_UP" });
          break;
        case "SoftDrop":
          this.queue.push({
            on: false,
            timestampMs: fromNow(),
            type: "SoftDrop",
          });
          break;
      }
    });
  }

  drainEvents(_dt: Ms): ReadonlyArray<InputEvent> {
    const now = fromNow() as number;
    // Let higher layer drive DAS timing by emitting a timer tick each step
    const tick: DASEvent = { timestamp: now, type: "TIMER_TICK" };
    // Drain buffered events in FIFO order and append tick
    const out = this.queue.splice(0, this.queue.length);
    out.push(tick);
    return out;
  }
}
