# e2e/ — Playwright end-to-end

`*.spec.ts` specs driven by Playwright. Runs against the **real** local stack (client + server +
seeded Supabase), not mocks.

## Layout

- `*.spec.ts` — specs (`auth`, `dashboard`, `contract-sign`, `profile-edit`,
  `reimbursement-submit-review`, …).
- `global-setup.ts` — resets + seeds Supabase before the run. The whole suite depends on this state.
- `helpers.ts` — shared fixtures/login helpers. **Depends on seed tokens** defined in `seed.sql` —
  if a token/user changes there, update helpers and fixtures together.
- `fixtures/` — static fixture data.

## Running

- Full suite: `pnpm test:e2e` (ensure the stack is up: `pnpm supabase:reset` + `pnpm setup:local`).
- One spec: `pnpm test:e2e e2e/auth.spec.ts` (or `pnpm exec playwright test e2e/auth.spec.ts`).
- Debug UI: `pnpm test:e2e:ui`.
- Report path is printed on failure (`playwright-report/`).

## Notes

- Because MSW is **not** used here, every assertion reflects real backend behavior — a failing spec
  often means a real route/seed/migration bug, not a flaky mock.
- **Seed ↔ fixture parity** is the most common breakage. Keep `supabase/seed.sql`,
  `e2e/fixtures`, and `helpers.ts` consistent.
- When testing responsiveness, add a **mobile-viewport project** (e.g. Pixel/iPhone device preset)
  in the Playwright config rather than hard-coding `setViewportSize` per spec.
