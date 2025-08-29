import type { FinessimoApp } from "./app";

declare global {
  interface Window {
    finessimoApp?: FinessimoApp;
  }
}

export {};

// (No jest typings augmentation; tests should avoid unsafe casts.)
