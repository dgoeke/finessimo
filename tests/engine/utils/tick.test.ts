// Comprehensive tests for @/engine/utils/tick.ts
import {
  addTicks,
  incrementTick,
  asTick,
  asTickDelta,
  tickDelta,
  isTickAfter,
  isTickAfterOrEqual,
  compareTicks,
  framesAt60ToTicks,
  msToTicks,
} from "@/engine/utils/tick";

describe("@/engine/utils/tick — branded time math", () => {
  describe("Tick arithmetic", () => {
    test("incrementTick(t) returns t+1 as Tick", () => {
      const tick = asTick(100);
      const result = incrementTick(tick);

      expect(result).toBe(101);
      // Type-level guarantee: result is branded as Tick
      expect(typeof result).toBe("number");
    });

    test("addTicks(base, delta) adds a TickDelta safely", () => {
      const baseTick = asTick(100);
      const deltaTicks = asTickDelta(50);
      const result = addTicks(baseTick, deltaTicks);

      expect(result).toBe(150);
      // Type-level guarantee: result is branded as Tick
      expect(typeof result).toBe("number");
    });

    test("addTicks handles zero delta", () => {
      const baseTick = asTick(100);
      const zeroDelta = asTickDelta(0);
      const result = addTicks(baseTick, zeroDelta);

      expect(result).toBe(100);
    });

    test("addTicks handles negative delta", () => {
      const baseTick = asTick(100);
      const negativeDelta = asTickDelta(-25);
      const result = addTicks(baseTick, negativeDelta);

      expect(result).toBe(75);
    });
  });

  describe("Tick comparison functions", () => {
    test("compareTicks returns correct ordering", () => {
      const tick1 = asTick(100);
      const tick2 = asTick(150);
      const tick3 = asTick(100);

      expect(compareTicks(tick1, tick2)).toBe(-1); // 100 < 150
      expect(compareTicks(tick2, tick1)).toBe(1); // 150 > 100
      expect(compareTicks(tick1, tick3)).toBe(0); // 100 === 100
    });

    test("isTickAfter behaves correctly", () => {
      const earlier = asTick(100);
      const later = asTick(101);
      const same = asTick(100);

      expect(isTickAfter(later, earlier)).toBe(true); // 101 > 100
      expect(isTickAfter(earlier, later)).toBe(false); // 100 < 101
      expect(isTickAfter(same, earlier)).toBe(false); // 100 === 100
    });

    test("isTickAfterOrEqual behaves correctly", () => {
      const earlier = asTick(100);
      const later = asTick(101);
      const same = asTick(100);

      expect(isTickAfterOrEqual(later, earlier)).toBe(true); // 101 >= 100
      expect(isTickAfterOrEqual(same, earlier)).toBe(true); // 100 >= 100
      expect(isTickAfterOrEqual(earlier, later)).toBe(false); // 100 < 101
    });

    test("comparison functions are consistent across equal and adjacent ticks", () => {
      const tick = asTick(100);
      const sameTick = asTick(100);
      const nextTick = asTick(101);
      const prevTick = asTick(99);

      // Equal ticks
      expect(compareTicks(tick, sameTick)).toBe(0);
      expect(isTickAfter(tick, sameTick)).toBe(false);
      expect(isTickAfterOrEqual(tick, sameTick)).toBe(true);

      // Adjacent ticks (next)
      expect(compareTicks(nextTick, tick)).toBe(1);
      expect(isTickAfter(nextTick, tick)).toBe(true);
      expect(isTickAfterOrEqual(nextTick, tick)).toBe(true);

      // Adjacent ticks (prev)
      expect(compareTicks(prevTick, tick)).toBe(-1);
      expect(isTickAfter(prevTick, tick)).toBe(false);
      expect(isTickAfterOrEqual(prevTick, tick)).toBe(false);
    });
  });

  describe("Tick delta operations", () => {
    test("tickDelta calculates difference correctly", () => {
      const earlier = asTick(100);
      const later = asTick(150);
      const delta = tickDelta(later, earlier);

      expect(delta).toBe(50);
      // Type-level guarantee: result is branded as TickDelta
      expect(typeof delta).toBe("number");
    });

    test("tickDelta handles same ticks", () => {
      const tick = asTick(100);
      const delta = tickDelta(tick, tick);

      expect(delta).toBe(0);
    });

    test("tickDelta can produce negative deltas", () => {
      const tick1 = asTick(100);
      const tick2 = asTick(150);
      const delta = tickDelta(tick1, tick2); // later - earlier = 100 - 150 = -50

      expect(delta).toBe(-50);
    });
  });

  describe("Type constructors", () => {
    test("asTick creates branded Tick from number", () => {
      const tick = asTick(123);
      expect(tick).toBe(123);
      expect(typeof tick).toBe("number");
    });

    test("asTickDelta creates branded TickDelta from number", () => {
      const delta = asTickDelta(456);
      expect(delta).toBe(456);
      expect(typeof delta).toBe("number");
    });
  });

  describe("Frame conversion", () => {
    test("framesAt60ToTicks: with TPS=60, identity mapping", () => {
      const TPS = 60;

      expect(framesAt60ToTicks(1, TPS)).toBe(1);
      expect(framesAt60ToTicks(10, TPS)).toBe(10);
      expect(framesAt60ToTicks(60, TPS)).toBe(60);
      expect(framesAt60ToTicks(0, TPS)).toBe(0);
    });

    test("framesAt60ToTicks: with TPS=120, doubles frames", () => {
      const TPS = 120;

      expect(framesAt60ToTicks(1, TPS)).toBe(2); // 1 * (120/60) = 2
      expect(framesAt60ToTicks(10, TPS)).toBe(20); // 10 * (120/60) = 20
      expect(framesAt60ToTicks(30, TPS)).toBe(60); // 30 * (120/60) = 60
      expect(framesAt60ToTicks(0, TPS)).toBe(0);
    });

    test("framesAt60ToTicks: with TPS=30, halves frames", () => {
      const TPS = 30;

      expect(framesAt60ToTicks(2, TPS)).toBe(1); // 2 * (30/60) = 1
      expect(framesAt60ToTicks(20, TPS)).toBe(10); // 20 * (30/60) = 10
      expect(framesAt60ToTicks(60, TPS)).toBe(30); // 60 * (30/60) = 30
      expect(framesAt60ToTicks(0, TPS)).toBe(0);
    });

    test("framesAt60ToTicks uses Math.ceil for fractional results", () => {
      const TPS = 50;

      // 1 * (50/60) = 0.833... -> Math.ceil = 1
      expect(framesAt60ToTicks(1, TPS)).toBe(1);

      // 3 * (50/60) = 2.5 -> Math.ceil = 3
      expect(framesAt60ToTicks(3, TPS)).toBe(3);

      // 7 * (50/60) = 5.833... -> Math.ceil = 6
      expect(framesAt60ToTicks(7, TPS)).toBe(6);
    });

    test("framesAt60ToTicks handles fractional frame inputs", () => {
      const TPS = 120;

      // 1.5 * (120/60) = 3
      expect(framesAt60ToTicks(1.5, TPS)).toBe(3);

      // 2.3 * (120/60) = 4.6 -> Math.ceil = 5
      expect(framesAt60ToTicks(2.3, TPS)).toBe(5);
    });
  });

  describe("Millisecond conversion", () => {
    test("msToTicks uses Math.ceil and TPS to quantize input streams deterministically", () => {
      const TPS = 60;

      // 1000ms = 1s * 60 TPS = 60 ticks
      expect(msToTicks(1000, TPS)).toBe(60);

      // 500ms = 0.5s * 60 TPS = 30 ticks
      expect(msToTicks(500, TPS)).toBe(30);

      // 16.666...ms = 1/60s * 60 TPS = 1 tick (exact)
      expect(msToTicks(16.666666666666668, TPS)).toBe(1);

      // 0ms = 0 ticks
      expect(msToTicks(0, TPS)).toBe(0);
    });

    test("msToTicks uses Math.ceil for fractional tick results", () => {
      const TPS = 60;

      // 1ms = 0.001s * 60 TPS = 0.06 ticks -> Math.ceil = 1 tick
      expect(msToTicks(1, TPS)).toBe(1);

      // 10ms = 0.01s * 60 TPS = 0.6 ticks -> Math.ceil = 1 tick
      expect(msToTicks(10, TPS)).toBe(1);

      // 17ms = 0.017s * 60 TPS = 1.02 ticks -> Math.ceil = 2 ticks
      expect(msToTicks(17, TPS)).toBe(2);
    });

    test("msToTicks works with different TPS values", () => {
      // TPS = 120 (double speed)
      expect(msToTicks(1000, 120)).toBe(120);
      expect(msToTicks(500, 120)).toBe(60);
      expect(msToTicks(1, 120)).toBe(1); // 0.001 * 120 = 0.12 -> Math.ceil = 1

      // TPS = 30 (half speed)
      expect(msToTicks(1000, 30)).toBe(30);
      expect(msToTicks(500, 30)).toBe(15);
      expect(msToTicks(1, 30)).toBe(1); // 0.001 * 30 = 0.03 -> Math.ceil = 1
    });

    test("msToTicks deterministic quantization", () => {
      const TPS = 60;

      // Same inputs should always produce same outputs
      const input1 = 123.456;
      const input2 = 123.456;

      expect(msToTicks(input1, TPS)).toBe(msToTicks(input2, TPS));

      // Very close inputs might quantize differently due to Math.ceil
      const closeInput1 = 16.66; // Should be < 1 tick
      const closeInput2 = 16.67; // Should be > 1 tick

      const result1 = msToTicks(closeInput1, TPS);
      const result2 = msToTicks(closeInput2, TPS);

      // Both should be 1 due to Math.ceil, demonstrating deterministic quantization
      expect(result1).toBe(1);
      expect(result2).toBe(2);
    });
  });

  describe("Edge cases and boundary conditions", () => {
    test("handles zero values correctly", () => {
      expect(incrementTick(asTick(0))).toBe(1);
      expect(addTicks(asTick(0), asTickDelta(0))).toBe(0);
      expect(tickDelta(asTick(0), asTick(0))).toBe(0);
      expect(framesAt60ToTicks(0, 60)).toBe(0);
      expect(msToTicks(0, 60)).toBe(0);
    });

    test("handles negative tick values", () => {
      const negativeTick = asTick(-10);

      expect(incrementTick(negativeTick)).toBe(-9);
      expect(addTicks(negativeTick, asTickDelta(5))).toBe(-5);
      expect(tickDelta(asTick(0), negativeTick)).toBe(10);

      expect(isTickAfter(asTick(-5), negativeTick)).toBe(true); // -5 > -10
      expect(isTickAfterOrEqual(negativeTick, negativeTick)).toBe(true);
    });

    test("handles large tick values", () => {
      const largeTick = asTick(1000000);
      const largeDelta = asTickDelta(500000);

      expect(incrementTick(largeTick)).toBe(1000001);
      expect(addTicks(largeTick, largeDelta)).toBe(1500000);
      expect(tickDelta(largeTick, asTick(0))).toBe(1000000);
    });

    test("conversion functions handle edge cases", () => {
      // Very small positive values should still produce at least 1 tick due to Math.ceil
      expect(framesAt60ToTicks(0.001, 60)).toBe(1);
      expect(msToTicks(0.001, 60)).toBe(1);

      // Large values should work correctly
      expect(framesAt60ToTicks(3600, 60)).toBe(3600); // 1 minute at 60fps
      expect(msToTicks(60000, 60)).toBe(3600); // 1 minute in ms at 60 TPS
    });
  });
});
