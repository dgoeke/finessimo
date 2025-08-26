declare module "tinykeys" {
  type KeyBindingMap = Record<string, (event: KeyboardEvent) => void>;

  type TinyKeysOptions = {
    event?: "keydown" | "keyup";
  };

  function tinykeys(
    target: EventTarget,
    bindings: KeyBindingMap,
    options?: TinyKeysOptions,
  ): () => void;

  export = tinykeys;
}
