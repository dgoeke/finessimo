import type { FinessimoApp } from "./app";

declare global {
  interface Window {
    finessimoApp?: FinessimoApp;
  }
}

export {};
