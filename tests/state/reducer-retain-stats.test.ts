import { createSeed } from "../../src/types/brands";
import { fromNow } from "../../src/types/timestamp";
import { reducerWithPipeline as reducer } from "../helpers/reducer-with-pipeline";

describe("Reducer Init retainStats behavior", () => {
  it("increments totalSessions when retainStats is true", () => {
    const s1 = reducer(undefined, {
      seed: createSeed("init-1"),
      timestampMs: fromNow(),
      type: "Init",
    });
    expect(s1.stats.totalSessions).toBe(1);

    const s2 = reducer(s1, {
      retainStats: true,
      seed: createSeed("init-2"),
      timestampMs: fromNow(),
      type: "Init",
    });

    expect(s2.stats.totalSessions).toBe(s1.stats.totalSessions + 1);
  });

  it("resets totalSessions to 1 when retainStats is not set", () => {
    const s1 = reducer(undefined, {
      seed: createSeed("init-a"),
      timestampMs: fromNow(),
      type: "Init",
    });
    expect(s1.stats.totalSessions).toBe(1);

    const s2 = reducer(s1, {
      // retainStats omitted
      seed: createSeed("init-b"),
      timestampMs: fromNow(),
      type: "Init",
    });

    expect(s2.stats.totalSessions).toBe(1);
  });
});
