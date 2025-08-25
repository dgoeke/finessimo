# CLAUDE: Finessimo

# Shared partial used by assistant-specific templates

You are an expert TypeScript developer working on **Finessimo** — Tetris 2-step finesse trainer.

**Source of truth docs:**

- `DESIGN.md`
- `FILES.md`

**Core principles**

- Functional architecture: immutable state + pure reducers
- Unidirectional data flow: UI → Input Handler → Reducer → State → UI
- Side-effects live only in Input Handler; core logic is pure

**Build & quality gate**

- Always run `npm run pre-commit` before considering any change done.
- Do **not** introduce TypeScript/ESLint suppressions (e.g., `// @ts-ignore`, `// eslint-disable-next-line`). Fix root causes instead.

**When test failures surface correctness improvements**

- Update tests to match correct behavior; don’t reintroduce unsafe patterns.
- Preserve behavior only when tests cover legitimate, correct functionality.

**Workflow**

1. Start by reading `FILES.md` to locate code; finish by ensuring it stays accurate.
2. Implement thin, testable slices.
3. Keep reducers/core logic deterministic; put timers & device I/O only in Input Handler.

**Typescript and Lint Suppressions**
**You are **not allowed\*\* to add new TypeScript or ESLint suppressions.

Forbidden examples:

- `// @ts-ignore`
- `// @ts-expect-error`
- `// @ts-nocheck`
- `/* @ts-ignore */`
- `// eslint-disable`
- `// eslint-disable-line`
- `// eslint-disable-next-line`
- `/* eslint-disable */`

Instead: fix the underlying error properly.

**Example of updating tests correctly**

```ts
// ❌ Old test assuming invalid state
expect(gameReducer(stateWithoutActivePiece, lockAction)).toBeTruthy();

// ✅ Updated test with valid state
expect(gameReducer(stateWithActivePiece, lockAction)).toBeTruthy();
```

```ts
// ❌ Old test expected unsafe array mutation
expect(() => reducer(state, action)).not.toThrow();

// ✅ Updated test expects correct immutable update
const newState = reducer(state, action);
expect(newState).not.toBe(state);
```

```ts
// ❌ Don’t do this
// @ts-ignore
const score: number = "100";

// ✅ Do this
const score = Number.parseInt("100", 10);
```

```ts
// ❌ Don’t mutate state directly
state.level++;

// ✅ Always return a new state
return { ...state, level: state.level + 1 };
```

```
// ❌ FILES.md not updated
src/modes/newMode.ts   (missing from FILES.md)

// ✅ FILES.md updated
- src/modes/newMode.ts — Implements the new "Practice Mode"
```

```bash
# ❌ Don’t skip
git commit -m "fix bug"

# ✅ Always run
npm run pre-commit
git commit -m "fix bug"
```

**Claude-specific notes**

- concise, example-driven; propose diffs; never add lint/TS suppressions
- Claude Code
- If tests fail because you improved correctness or safety, update tests rather than weakening code. Preserve existing behavior only when it’s legitimately correct.
