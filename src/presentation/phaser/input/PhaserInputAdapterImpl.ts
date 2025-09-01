import { Phaser } from "phaser";

import {
  defaultKeyBindings,
  type KeyBindings,
  type BindableAction,
} from "../../../input/keyboard";
import { fromNow } from "../../../types/timestamp";

import { type PhaserInputAdapter, type InputEvent } from "./PhaserInputAdapter";

import type { DASEvent } from "../../../input/machines/das";
import type { Action } from "../../../state/types";
import type { Ms } from "../presenter/types";

/**
 * Phaser keyboard adapter translating raw key presses into DAS events
 * and immediate actions. Timing logic (DAS/ARR) lives in DASMachineService;
 * this layer merely reports key transitions for a higher layer to handle.
 */
export class PhaserInputAdapterImpl implements PhaserInputAdapter {
  private readonly keys: Partial<
    Record<BindableAction, Phaser.Input.Keyboard.Key>
  >;
  private readonly queue: Array<InputEvent> = [];

  constructor(
    scene: Phaser.Scene,
    bindings: KeyBindings = defaultKeyBindings(),
  ) {
    const plugin = scene.input.keyboard as {
      addKey(code: string): Phaser.Input.Keyboard.Key;
    } | null;
    this.keys = {};
    if (plugin) {
      for (const action of Object.keys(bindings) as Array<BindableAction>) {
        const code = bindings[action][0];
        if (code !== undefined) {
          // Use Phaser's ability to bind by KeyboardEvent.code to support modifiers
          this.keys[action] = plugin.addKey(code);
        }
      }
    }
  }

  drainEvents(_dt: Ms): ReadonlyArray<InputEvent> {
    const now = fromNow() as number;
    this.queue.length = 0;

    this.handleMovement("MoveLeft", -1, now);
    this.handleMovement("MoveRight", 1, now);

    this.handleInstant("RotateCW", {
      dir: "CW",
      timestampMs: fromNow(),
      type: "Rotate",
    });
    this.handleInstant("RotateCCW", {
      dir: "CCW",
      timestampMs: fromNow(),
      type: "Rotate",
    });
    this.handleInstant("HardDrop", {
      timestampMs: fromNow(),
      type: "HardDrop",
    });
    this.handleInstant("Hold", { type: "Hold" });

    const sd = this.keys.SoftDrop;
    if (sd) {
      if (Phaser.Input.Keyboard.JustDown(sd)) {
        this.queue.push({ on: true, timestampMs: fromNow(), type: "SoftDrop" });
      } else if (Phaser.Input.Keyboard.JustUp(sd)) {
        this.queue.push({
          on: false,
          timestampMs: fromNow(),
          type: "SoftDrop",
        });
      }
    }

    // Let higher layer drive DAS timing by emitting a timer tick each step
    const tick: DASEvent = { timestamp: now, type: "TIMER_TICK" };
    this.queue.push(tick);

    return [...this.queue];
  }

  private handleMovement(
    action: BindableAction,
    dir: -1 | 1,
    now: number,
  ): void {
    const key = this.keys[action];
    if (!key) return;
    if (Phaser.Input.Keyboard.JustDown(key)) {
      this.queue.push({
        direction: dir,
        timestamp: now,
        type: "KEY_DOWN",
      } as DASEvent);
    }
    if (Phaser.Input.Keyboard.JustUp(key)) {
      this.queue.push({
        direction: dir,
        timestamp: now,
        type: "KEY_UP",
      } as DASEvent);
    }
  }

  private handleInstant(action: BindableAction, act: Action): void {
    const key = this.keys[action];
    if (key && Phaser.Input.Keyboard.JustDown(key)) {
      this.queue.push(act);
    }
  }
}
