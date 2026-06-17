---
name: verify-e2e
description: Reset and seed the local Supabase stack, then run the Playwright E2E suite (or a single spec) and summarize failures. Use when asked to verify end-to-end behavior.
---

# /verify-e2e

Run the E2E suite against a fresh seeded stack.

1. **Reset the stack** — `pnpm supabase:reset` (clean DB reset + seed), then `pnpm setup:local`.
2. **Run** — `pnpm test:e2e` for the full suite, or `pnpm test:e2e e2e/<name>.spec.ts` for a single
   spec if the user named one.
3. **On failure** — summarize which specs failed and the likely cause. Because E2E hits the real
   backend (no MSW), a failure usually points at a real route/seed/migration bug or a
   seed↔fixture drift (`supabase/seed.sql` ↔ `e2e/fixtures` ↔ `e2e/helpers.ts`).
4. **Report** the Playwright report path (`playwright-report/`) and a concise pass/fail summary.
   Suggest `pnpm test:e2e:ui` for interactive debugging if specs are flaky.
