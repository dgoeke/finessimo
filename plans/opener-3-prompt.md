You are a senior TypeScript engineer. Implement Chapter 3 exactly as specified in `plans/OPENER_3.md`.

GOAL
Add branching and graceful fallback, plus a 1-ply tie-break rollout. Expand hazard severities and silhouette scoring.

CONSTRAINTS

- Keep rollout to 1 ply by default; 2 ply only behind a constant.
- No API changes; keep recommendMove pure and context-immutable.
- Maintain perf budget: planner mean ≤ 0.3 ms.

OUTPUT

- Modified and new files; tests proving branching/fallback and tie-breaks; perf bench updated.

NOW
First, produce a plan with a step-by-step task list with file paths, then start implementing and testing phase-by-phase within this Chapter 3 scope.
