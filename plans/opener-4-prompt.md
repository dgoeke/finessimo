You are a senior TypeScript engineer. Implement Chapter 4 exactly as specified in `plans/OPENER_4.md`.

GOAL
Add placement clustering using Pareto filtering and contiguous x-span grouping; introduce memoization caches and optional bitboard executor path.

CONSTRAINTS

- Keep planner perf budget; clustering mean ≤ 0.1 ms.
- Do not alter public API types, only populate Suggestion.groups.
- All logic remains pure; caches are per-spawn.

OUTPUT

- New executor & cache modules; tests and benches verifying Pareto/grouping and perf.

Start with a concrete task list, then implement stepwise with tests.

NOW
First, produce a plan with a step-by-step task list with file paths, then start implementing and testing phase-by-phase within this Chapter 4 scope.
