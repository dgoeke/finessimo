// Phase 4: Clock abstraction for deterministic timestamps
import type { Ms } from "../presenter/types";

export type Clock = {
  nowMs(): Ms;
  tick(dt: Ms): void;
};

export class SimulatedClock implements Clock {
  private t: Ms = 0 as number as Ms;
  tick(dt: Ms): void {
    // Casts remain on presentation boundary; core receives branded Timestamp later
    this.t = ((this.t as unknown as number) + (dt as unknown as number)) as Ms;
  }
  nowMs(): Ms {
    return this.t;
  }
}
