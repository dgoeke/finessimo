You are a senior TypeScript engineer. Implement Chapter 1 exactly as specified in `plans/OPENER_1.md`.

GOAL
Ship a pure policy API with TKI/base, PCO/standard, and Neither/safe, including hazards, hysteresis, and margin-based confidence. One placement only; no grouping.

CONSTRAINTS

- Keep preconditions O(1)/O(width). No brute-force or deep rollout.
- Do not add new domain types beyond those in src/types/\* (reuse GridCoord, Rot, DurationMs, Seed, Timestamp).
- Keep template count minimal (TKI/base, PCO/standard, Neither/safe).
- Enforce hysteresis: SWITCH_MARGIN=0.20, MIN_PLAN_AGE=2, LOW_CONF=0.40, ACCEPT_MIN_CONF=0.35.
- Memoize within-spawn computations; no global state.
- Keep repo compiling and tests green at end.

OUTPUT

1. PR with files listed in the spec and passing tests/bench.
2. A short CHANGELOG entry describing behavior and perf.

NOW
First, produce a step-by-step task list with file paths, then start implementing and testing phase-by-phase within this Chapter 1 scope.
