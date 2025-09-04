// Performance benchmark for policy planner
// Target: Mean execution time ≤ 0.3ms per spawn

import { createInitialState } from "../src/engine/init";
import { createSeed } from "../src/types/brands";
import { createTimestamp } from "../src/types/timestamp";
import { createEmptyBoard } from "../src/core/board";
import { createGridCoord } from "../src/types/brands";
import type { GameState, ActivePiece, PieceId } from "../src/state/types";

import { recommendMove } from "../src/policy/index";

// Benchmark configuration
const WARMUP_RUNS = 200;
const MEASUREMENT_RUNS = 1000;
const TARGET_MEAN_MS = 0.3;

// Test scenarios for benchmarking
const BENCHMARK_SCENARIOS = [
  {
    name: "TKI Favorable",
    pieces: ["I", "T", "S", "Z", "O", "L", "J"] as PieceId[],
    description: "I first, should favor TKI",
  },
  {
    name: "PCO Favorable", 
    pieces: ["L", "I", "J", "S", "Z", "O", "T"] as PieceId[],
    description: "Flat field with I available",
  },
  {
    name: "Neither Fallback",
    pieces: ["S", "Z", "O", "L", "J", "S", "Z"] as PieceId[],
    description: "No I or T early, should use Neither",
  },
  {
    name: "Mixed Queue",
    pieces: ["T", "I", "O", "S", "L", "Z", "J"] as PieceId[],
    description: "Balanced piece distribution",
  },
] as const;

// Helper to create benchmark state
function createBenchmarkState(scenario: typeof BENCHMARK_SCENARIOS[0]): GameState {
  const baseState = createInitialState(
    createSeed(`bench-${scenario.name}`),
    createTimestamp(Date.now())
  );

  return {
    ...baseState,
    board: createEmptyBoard(), // Use clean board for consistent timing
    nextQueue: scenario.pieces,
    active: {
      id: scenario.pieces[0],
      rot: "spawn",
      x: createGridCoord(4),
      y: createGridCoord(0),
    } as ActivePiece,
  };
}

// High-precision timer
function getHighResTime(): number {
  if (typeof performance !== "undefined" && performance.now) {
    return performance.now();
  }
  return Date.now();
}

// Run benchmark for a single scenario
function benchmarkScenario(scenario: typeof BENCHMARK_SCENARIOS[0]): {
  name: string;
  meanMs: number;
  medianMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  samples: number;
} {
  const state = createBenchmarkState(scenario);
  
  console.log(`Benchmarking: ${scenario.name}`);
  console.log(`Description: ${scenario.description}`);
  
  // Warmup phase
  console.log(`Warming up (${WARMUP_RUNS} runs)...`);
  for (let i = 0; i < WARMUP_RUNS; i++) {
    recommendMove(state);
  }
  
  // Measurement phase
  console.log(`Measuring (${MEASUREMENT_RUNS} runs)...`);
  const timings: number[] = [];
  
  for (let i = 0; i < MEASUREMENT_RUNS; i++) {
    const start = getHighResTime();
    recommendMove(state);
    const end = getHighResTime();
    
    timings.push(end - start);
  }
  
  // Calculate statistics
  timings.sort((a, b) => a - b);
  
  const meanMs = timings.reduce((sum, t) => sum + t, 0) / timings.length;
  const medianMs = timings[Math.floor(timings.length / 2)];
  const p95Ms = timings[Math.floor(timings.length * 0.95)];
  const minMs = timings[0];
  const maxMs = timings[timings.length - 1];
  
  return {
    name: scenario.name,
    meanMs,
    medianMs,
    p95Ms,
    minMs,
    maxMs,
    samples: timings.length,
  };
}

// Run all benchmarks
function runAllBenchmarks(): void {
  console.log("=".repeat(60));
  console.log("Policy Planner Performance Benchmark");
  console.log("=".repeat(60));
  console.log(`Target: Mean ≤ ${TARGET_MEAN_MS}ms per recommendMove() call`);
  console.log();
  
  const results = BENCHMARK_SCENARIOS.map(scenario => benchmarkScenario(scenario));
  
  // Print results
  console.log();
  console.log("Results Summary:");
  console.log("-".repeat(60));
  console.log("Scenario".padEnd(20) + "Mean(ms)".padEnd(12) + "Med(ms)".padEnd(12) + "P95(ms)".padEnd(12) + "Status");
  console.log("-".repeat(60));
  
  let allPassed = true;
  
  results.forEach(result => {
    const status = result.meanMs <= TARGET_MEAN_MS ? "✓ PASS" : "✗ FAIL";
    if (result.meanMs > TARGET_MEAN_MS) {
      allPassed = false;
    }
    
    console.log(
      result.name.padEnd(20) +
      result.meanMs.toFixed(3).padEnd(12) +
      result.medianMs.toFixed(3).padEnd(12) +
      result.p95Ms.toFixed(3).padEnd(12) +
      status
    );
  });
  
  console.log("-".repeat(60));
  
  // Detailed statistics
  console.log();
  console.log("Detailed Statistics:");
  console.log("-".repeat(40));
  
  results.forEach(result => {
    console.log(`${result.name}:`);
    console.log(`  Mean:     ${result.meanMs.toFixed(3)}ms`);
    console.log(`  Median:   ${result.medianMs.toFixed(3)}ms`);
    console.log(`  P95:      ${result.p95Ms.toFixed(3)}ms`);
    console.log(`  Min:      ${result.minMs.toFixed(3)}ms`);
    console.log(`  Max:      ${result.maxMs.toFixed(3)}ms`);
    console.log(`  Samples:  ${result.samples}`);
    console.log();
  });
  
  // Overall summary
  const overallMean = results.reduce((sum, r) => sum + r.meanMs, 0) / results.length;
  const maxMean = Math.max(...results.map(r => r.meanMs));
  
  console.log("Overall Performance:");
  console.log(`  Average Mean: ${overallMean.toFixed(3)}ms`);
  console.log(`  Worst Case:   ${maxMean.toFixed(3)}ms`);
  console.log(`  Target:       ${TARGET_MEAN_MS}ms`);
  console.log();
  
  if (allPassed) {
    console.log("🎉 All benchmarks PASSED!");
    console.log("Policy planner meets performance requirements.");
  } else {
    console.log("❌ Some benchmarks FAILED!");
    console.log("Policy planner needs optimization.");
    process.exit(1);
  }
}

// Run benchmarks if this file is executed directly
// Check if this is the main module (ESM compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllBenchmarks();
}

// Export for use in tests
export { runAllBenchmarks, benchmarkScenario, BENCHMARK_SCENARIOS, TARGET_MEAN_MS };