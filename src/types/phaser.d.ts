declare module "phaser" {
  namespace Phaser {
    const AUTO: number;
    namespace Scale {
      const CENTER_BOTH: number;
      const FIT: number;
    }
    namespace Input {
      namespace Keyboard {
        class Key {
          isDown: boolean;
        }
        const KeyCodes: {
          LEFT: number;
          RIGHT: number;
          UP: number;
          DOWN: number;
          SPACE: number;
          SHIFT: number;
          Z: number;
        };
        function JustDown(key: Key): boolean;
        function JustUp(key: Key): boolean;
      }
    }
    namespace Types {
      namespace Scenes {
        type SceneType = new () => Scene;
      }
      namespace Core {
        interface GameConfig {
          type: number;
          parent: HTMLElement;
          width: number;
          height: number;
          scene: Array<Scenes.SceneType>;
          backgroundColor?: string;
          plugins?: unknown;
          scale?: unknown;
          pixelArt?: boolean;
          roundPixels?: boolean;
        }
      }
    }
    export namespace GameObjects {
      interface GameObject {
        readonly __brand?: unknown;
      }
      interface Text extends GameObject {
        readonly __textBrand?: unknown;
      }
    }
    class Game {
      constructor(config: Types.Core.GameConfig);
      scene: {
        add(key: string, scene: Scene, start?: boolean): void;
        start(key: string): void;
      };
    }
    class Scene {
      constructor(config?: unknown);
      add: {
        text(
          x: number,
          y: number,
          t: string,
          s?: unknown,
        ): { setOrigin(x: number, y: number): void; setText(t: string): void };
        blitter(
          x: number,
          y: number,
          key: string,
        ): {
          create(
            x: number,
            y: number,
            frame: number,
          ): {
            reset(x: number, y: number, frame?: number): void;
            setVisible(v: boolean): void;
          };
        };
        container(): { setPosition(x: number, y: number): void };
      };
      load: { on(e: string, cb: (...a: Array<unknown>) => void): void };
      input: {
        keyboard: { addKey(code: string): Keyboard.Key } | null;
      };
      scene: { start(key: string): void };
      sound: { play(key: string): void };
      scale: { width: number; height: number };
      cameras: {
        main: {
          fadeIn(ms: number): void;
          fadeOut(ms: number): void;
          shake(ms: number, magnitude?: number): void;
          zoomTo(z: number, ms: number): void;
        };
      };
      rexUI: unknown;
    }
  }
  export { Phaser };
}
