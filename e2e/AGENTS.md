# e2e/ — Playwright end-to-end

`*.spec.ts` specs driven by Playwright (config: root `playwright.config.ts`). Runs against the
**real** local stack (client + server + seeded Supabase), not mocks.

## Layout

- `*.spec.ts` — specs (`auth`, `dashboard`, `contract-sign`, `profile-edit`,
  `reimbursement-submit-review`, …). `*mobile.spec.ts` files run only in the `mobile` project
  (Pixel 7); everything else runs in `chromium`.
- `global-setup.ts` — does **not** reset anything. It refuses to run against a non-local Supabase
  URL and fails fast if the seed isn't loaded (then run `pnpm supabase:reset`).
- `helpers.ts` — login helpers and the seeded fixtures (`SEED_*` accounts, contract signing token).
  They must match `supabase/seed.sql`; `scripts/check-seed-fixture-parity.test.mjs` checks this.
- `fixtures/` — static upload files (PDFs).
- `partner-portal-stub.mjs` — local stand-in for the partner portal API, started by the config.

## Running

- Full suite: `pnpm test:e2e`. The stack must be up and freshly seeded: `pnpm supabase:reset` +
  `pnpm setup:local`. The suite mutates the database, so don't point it at a local database that
  holds anything you want to keep.
- One spec: `pnpm test:e2e e2e/auth.spec.ts`. Debug UI: `pnpm test:e2e:ui`.
- `pnpm test:e2e:finance-live` calls the real BuchhaltungsButler API. Only run it when asked.
- CI (`e2e.yml`) resets the database, runs the RLS integration tests, then the suite. It isn't a
  required status check on `main`; treat a red run as a real failure anyway.
- Report path is printed on failure (`playwright-report/`).

## Writing stable specs

- **Shared seeded rows.** Specs sign in as the same seeded users and mutate the same rows, so the
  suite runs with one worker. CI retries once; a retry runs against the already-mutated database,
  so it masks real breakage more often than it recovers. Don't raise `retries` or `workers`.
- **Wait by role, not text.** A closing Radix Select marks the whole app `aria-hidden`, and role
  queries come back empty for that moment while text queries still match. Before a loop that acts
  on role queries, assert a role-based locator is visible (`e2e/finance-analytics.spec.ts`).
- **Re-query live lists.** Expanding a row can renumber the list; re-query each iteration instead of
  indexing into a stale locator.
- **Exact names.** Use `{ exact: true }` for short labels ("Approve", "IBAN"), which otherwise match
  longer text.
- **Dates.** Anything near a month boundary depends on the day CI runs; fake the system time in the
  unit or Storybook test that covers it.
- Because MSW is **not** used here, a failing spec usually means a real route, seed, or migration
  bug, not a flaky mock.
