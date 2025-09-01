import type { Ms } from "../presenter/types";

// Centralized unbranding helpers for presentation-layer branded primitives
export const ms = (x: Ms): number => x as number;
