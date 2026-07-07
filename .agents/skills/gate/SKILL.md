---
name: gate
description: Run the full pre-push gate (lint, typecheck, test, build) and triage any failures by stage. Use before pushing or when asked to verify the repo is green.
---

# /gate

Run the pre-push gate and explain failures.

1. **Run** — `pnpm gate` (= `lint && typecheck && test && build`). It stops at the first failing stage.
2. **Triage by stage**:
   - **lint** — Biome / file-size (`scripts/check-file-size.mjs`) / cross-feature import warnings.
     Fix the rule, don't disable it. Don't add to the size allowlist — split the file.
   - **typecheck** — often a stale `shared/` build; `pnpm build:shared` then retry. Otherwise a real
     type error or shared-contract drift.
   - **test** — Vitest (client) / `node --test` + c8 (server) / scripts. Fix the code or the test;
     never lower coverage thresholds.
   - **build** — Vite / tsc build break.
3. **Report** the failing stage, the root cause, and the minimal fix. Re-run `pnpm gate` to confirm
   green before declaring done.
