You are a senior TypeScript engineer. Implement Chapter 2 exactly as specified in `plans/OPENER_2.md`.

GOAL
Introduce ScenarioCards + deterministic generators + SRS scheduler, add a minimal coaching overlay, and 1–2 template variants via extendTemplate.

CONSTRAINTS

- Deterministic outputs given Seed brand.
- Keep all new logic pure; no network/IO.
- Keep preconditions O(1)/O(width). Do not change Chapter 1 API.
- HUD is minimal and optional; no grouping UI yet.

OUTPUT

- New files as specified; tests proving determinism and SRS monotonicity.
- Update golden tests to also run from ScenarioCards.

NOW
First, produce a plan with a step-by-step task list with file paths, then start implementing and testing phase-by-phase within this Chapter 2 scope.
