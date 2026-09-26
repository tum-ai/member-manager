---
name: gate
description: Run the full pre-push gate (lint, typecheck, test, build) and triage any failures by stage. Use before pushing or when asked to verify the repo is green.
---

# /gate

Run the pre-push gate and explain failures.

1. **Run** — `pnpm gate` (= `lint && typecheck && test && build`). It stops at the first failing stage.
2. **Triage by stage**:
   - **lint** — Biome (including the `../` import ban in `client/src`) and file size
     (`scripts/check-file-size.mjs`). Fix the code, don't disable the rule; the size allowlist stays
     empty, so split the file.
   - **typecheck** — often a stale `shared/` build: `pnpm build:shared`, then retry. Otherwise a real
     type error or shared-contract drift.
   - **test** — `scripts/*.test.mjs`, client Vitest, server `tsx --test`, shared `node --test`. No
     coverage here. Fix the code or the test; never skip or loosen a test.
   - **build** — Vite / `tsc` build break. `tsc` is stricter than the `tsx` dev server.
3. **Close the CI gap** when the change warrants it. The gate skips what CI also runs:
   - `pnpm test:coverage` — coverage floors; run it when tested code was removed or moved.
   - `typos` — spell check, if the CLI is installed.
   - `pnpm --filter @member-manager/client test:storybook` — when stories or interactive components
     changed (needs Playwright Chromium).
   - E2E (`verify-e2e` skill) — when a user flow changed.
4. **Report** the failing stage, the root cause, and the minimal fix, plus which extra checks you
   ran or skipped. Re-run until green before declaring done.
