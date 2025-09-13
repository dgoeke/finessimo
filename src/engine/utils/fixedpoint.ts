import type { Q16_16 } from "../types";

export function toQ(n: number): Q16_16 {
  return (n * 65536) as Q16_16;
}
export function addQ(a: Q16_16, b: Q16_16): Q16_16 {
  return (a + b) as Q16_16;
}
export function floorQ(a: Q16_16): number {
  return a >> 16;
}
export function fracQ(a: Q16_16): Q16_16 {
  return (a & 0xffff) as Q16_16;
}
