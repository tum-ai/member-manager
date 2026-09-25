---
name: verify-e2e
description: Reset and seed the local Supabase stack, then run the Playwright E2E suite (or a single spec) and summarize failures. Use when asked to verify end-to-end behavior.
---

# /verify-e2e

Run the E2E suite against a freshly seeded local stack. Background: `e2e/AGENTS.md`.

1. **Check the database first** — `pnpm supabase:reset` wipes the local database. If it may hold
   data beyond the seed (e.g. imported member data), ask before resetting.
2. **Reset the stack** — `pnpm supabase:reset`, then `pnpm setup:local`. Docker must be running.
3. **Run** — `pnpm test:e2e` for the full suite, or `pnpm test:e2e e2e/<name>.spec.ts` for one
   spec. Never run `pnpm test:e2e:finance-live` unless asked (it calls the real BuchhaltungsButler API).
4. **On failure** — summarize which specs failed and the likely cause. E2E hits the real backend,
   so a failure usually means a route, seed or migration bug, or drift between `supabase/seed.sql`
   and the `SEED_*` constants in `e2e/helpers.ts`.
5. **Report** the Playwright report path (`playwright-report/`) and a concise pass/fail summary.
   Suggest `pnpm test:e2e:ui` for interactive debugging.
