# GitHub Branch Protection Setup

This repository includes CI workflows to ensure code quality. To enforce that all PRs pass the quality checks before merging, follow these steps to enable branch protection:

## Enable Branch Protection Rules

1. Go to the repository Settings > Branches
2. Click "Add rule" 
3. Configure the following:
   - **Branch name pattern**: `main`
   - **✅ Require a pull request before merging**
     - ✅ Require approvals: 1 (recommended)
     - ✅ Dismiss stale reviews when new commits are pushed
   - **✅ Require status checks to pass before merging**
     - ✅ Require branches to be up to date before merging
     - **Required status checks**: `ci / Quality Checks`
   - **✅ Require conversation resolution before merging** (recommended)
   - **✅ Include administrators** (recommended)

## What This Achieves

With these settings enabled:

- **All PRs** must pass the `npm run pre-commit` checks (typecheck, lint, test, format) before merging
- **GitHub Pages deployments** will run the same quality checks before deploying
- Code cannot be pushed directly to `main` - it must go through a PR
- PRs must be up-to-date with `main` before merging

## CI Workflow Details

The CI workflow (`.github/workflows/ci.yml`) runs on:
- Every push to `main` 
- Every pull request targeting `main`

It executes: `npm run pre-commit` which includes:
1. `clean` - Remove build artifacts
2. `typecheck` - TypeScript type checking
3. `lint:fix` - ESLint with auto-fixing
4. `test` - Jest unit tests
5. `format` - Prettier code formatting

The GitHub Pages deployment workflow also runs these same checks before building and deploying.