import { Phaser } from "phaser";

import { fromNow, type Timestamp } from "../../../types/timestamp";

import { type PhaserInputAdapter } from "./PhaserInputAdapter";

import type { Action } from "../../../state/types";
import type { Ms } from "../presenter/types";

type Dir = -1 | 1;

type MoveState = {
  readonly dir: Dir;
  isDown: boolean;
  dasLeft: number;
  arrLeft: number;
  hadHold: boolean;
};

/**
 * Phaser keyboard adapter implementing DAS/ARR timing.
 * Collects key events and exposes a pure drainActions interface
 * for the fixed-step gameplay loop.
 */
export class PhaserInputAdapterImpl implements PhaserInputAdapter {
  private readonly keys: Record<
    "left" | "right" | "up" | "down" | "space" | "shift" | "z",
    Phaser.Input.Keyboard.Key
  >;
  private readonly moveLeft: MoveState;
  private readonly moveRight: MoveState;
  private readonly queue: Array<Action> = [];
  private readonly dasMs: number;
  private readonly arrMs: number;

  constructor(scene: Phaser.Scene, opts?: { dasMs?: number; arrMs?: number }) {
    this.dasMs = opts?.dasMs ?? 133;
    this.arrMs = opts?.arrMs ?? 2;
    const KC = Phaser.Input.Keyboard.KeyCodes;
    this.keys = scene.input.keyboard.addKeys({
      down: KC.DOWN,
      left: KC.LEFT,
      right: KC.RIGHT,
      shift: KC.SHIFT,
      space: KC.SPACE,
      up: KC.UP,
      z: KC.Z,
    }) as Record<
      "left" | "right" | "up" | "down" | "space" | "shift" | "z",
      Phaser.Input.Keyboard.Key
    >;

    this.moveLeft = {
      arrLeft: 0,
      dasLeft: 0,
      dir: -1,
      hadHold: false,
      isDown: false,
    };
    this.moveRight = {
      arrLeft: 0,
      dasLeft: 0,
      dir: 1,
      hadHold: false,
      isDown: false,
    };
  }

  drainActions(dt: Ms): ReadonlyArray<Action> {
    const now = fromNow();
    const dtNum = dt as unknown as number;
    this.queue.length = 0;

    this.processMove(this.moveLeft, this.keys.left, dtNum, now);
    this.processMove(this.moveRight, this.keys.right, dtNum, now);

    this.processInstant(this.keys.up, {
      dir: "CW",
      timestampMs: now,
      type: "Rotate",
    });
    this.processInstant(this.keys.z, {
      dir: "CCW",
      timestampMs: now,
      type: "Rotate",
    });
    this.processInstant(this.keys.space, {
      timestampMs: now,
      type: "HardDrop",
    });

    if (Phaser.Input.Keyboard.JustDown(this.keys.shift)) {
      this.queue.push({ type: "Hold" });
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.down)) {
      this.queue.push({ on: true, timestampMs: now, type: "SoftDrop" });
    } else if (Phaser.Input.Keyboard.JustUp(this.keys.down)) {
      this.queue.push({ on: false, timestampMs: now, type: "SoftDrop" });
    }

    return [...this.queue];
  }

  private processMove(
    state: MoveState,
    key: Phaser.Input.Keyboard.Key,
    dt: number,
    now: Timestamp,
  ): void {
    if (Phaser.Input.Keyboard.JustDown(key)) {
      this.queue.push({
        dir: state.dir,
        optimistic: true,
        timestampMs: now,
        type: "TapMove",
      });
      state.isDown = true;
      state.hadHold = false;
      state.dasLeft = this.dasMs;
      state.arrLeft = this.arrMs;
      return;
    }

    if (state.isDown && key.isDown) {
      if (state.dasLeft > 0) {
        state.dasLeft -= dt;
        if (state.dasLeft <= 0) {
          this.queue.push({
            dir: state.dir,
            timestampMs: now,
            type: "HoldStart",
          });
          this.queue.push({
            dir: state.dir,
            timestampMs: now,
            type: "HoldMove",
          });
          state.arrLeft = this.arrMs;
          state.hadHold = true;
        }
      } else {
        state.arrLeft -= dt;
        if (state.arrLeft <= 0) {
          this.queue.push({
            dir: state.dir,
            timestampMs: now,
            type: "RepeatMove",
          });
          state.arrLeft = this.arrMs;
        }
      }
    }

    if (Phaser.Input.Keyboard.JustUp(key)) {
      if (!state.hadHold) {
        this.queue.push({
          dir: state.dir,
          optimistic: false,
          timestampMs: now,
          type: "TapMove",
        });
      }
      state.isDown = false;
    }
  }

  private processInstant(key: Phaser.Input.Keyboard.Key, action: Action): void {
    if (Phaser.Input.Keyboard.JustDown(key)) {
      this.queue.push(action);
    }
  }
}
