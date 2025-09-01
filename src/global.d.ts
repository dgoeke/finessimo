import type { FinessimoApp } from "./app";

declare global {
  interface Window {
    finessimoApp?: FinessimoApp;
  }
}

export {};

// (No jest typings augmentation; tests should avoid unsafe casts.)

// Minimal rexUI plugin typings used by the presentation layer.
// We declare only the subset actually consumed by our scenes to keep types tight.
declare global {
  namespace RexUIInternal {
    type Padding =
      | number
      | { left?: number; right?: number; top?: number; bottom?: number };

    type Base = {
      layout(): void;
      setOrigin(x: number, y: number): this;
      setPosition(x: number, y: number): this;
      on(event: string, cb: (...args: Array<unknown>) => void): this;
    };

    type Sizer = Base & {
      add(
        child: unknown,
        config?: {
          align?: string;
          expand?: boolean;
          proportion?: number;
          padding?: Padding;
        },
      ): Sizer;
    };

    type Slider = Base & {
      value: number;
      setValue(v: number): this;
      on(
        event: "valuechange",
        cb: (value: number, slider: Slider) => void,
      ): this;
    };

    type Checkbox = Base & {
      setChecked(checked: boolean): this;
      on(
        event: "valuechange",
        cb: (checked: boolean, checkbox: Checkbox) => void,
      ): this;
    };

    type Add = {
      sizer(config: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        orientation?: number; // 0=h,1=v
        space?: {
          item?: number;
          left?: number;
          right?: number;
          top?: number;
          bottom?: number;
        };
      }): Sizer;
      label(config: {
        background?: Phaser.GameObjects.GameObject;
        text?: Phaser.GameObjects.Text | string;
        space?: {
          left?: number;
          right?: number;
          top?: number;
          bottom?: number;
        };
      }): Label;
      slider(config: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        value?: number; // 0..1
        track?: Phaser.GameObjects.GameObject;
        indicator?: Phaser.GameObjects.GameObject;
        thumb?: Phaser.GameObjects.GameObject;
      }): Slider;
      checkbox(config: {
        size?: number;
        color?: number;
        uncheckedColor?: number;
      }): Checkbox;
      roundRectangle(
        x: number,
        y: number,
        width: number,
        height: number,
        radius: number,
        color: number,
      ): Phaser.GameObjects.Rectangle;
    };

    type Plugin = { add: Add };
  }

  // Augment Phaser.Scene to expose rexUI when the plugin is installed
  namespace Phaser {
    interface Scene {
      rexUI: RexUIInternal.Plugin;
    }
  }
}
