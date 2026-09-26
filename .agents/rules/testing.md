---
paths: ["**/*.test.ts", "**/*.test.tsx", "**/*.test.mjs", "**/*.stories.tsx", "client/src/test/**", "server/test/**", "shared/test/**", "e2e/**"]
---

# Testing rules

Pick the runner by location:

| Where | Runner | Coverage |
| --- | --- | --- |
| `client/src/**/*.test.ts(x)` | Vitest `unit` project (jsdom + RTL + MSW) | floors in `client/vite.config.ts` via `test:coverage` |
| `client/src/**/*.stories.tsx` | Vitest `storybook` project (browser, `test:storybook`) | play functions + a11y checks |
| `server/test/**` | `tsx --test` | c8 floors in `server/package.json` via `test:coverage` |
| `shared/test/**` | `node --test` against the built `dist/` | — |
| `scripts/*.test.mjs` | `node --test` (`pnpm test:scripts`) | — |
| `e2e/*.spec.ts` | Playwright against the real seeded stack | — |

- **Client**: MSW runs with `onUnhandledRequest: "error"`, so every network call in a test needs a
  handler. Render through `client/src/test/renderWithClient.tsx`.
- **Server**: one file with `pnpm --filter @member-manager/server exec tsx --test <file>`. Don't
  mutate `process.env` in tests; inject the value.
- **E2E**: `global-setup.ts` only verifies the seed, it doesn't reset. `e2e/helpers.ts` hard-codes
  seeded accounts; keep it in parity with `supabase/seed.sql`. One spec:
  `pnpm test:e2e e2e/<name>.spec.ts`. Details: `e2e/AGENTS.md`.
- **Coverage runs only in `test:coverage`**, which is what CI runs. `pnpm test` (and the gate) don't
  check the floors, so run `pnpm test:coverage` when you delete or move tested code. Floors ratchet
  **up only — never lower them.**

**New code ships with tests; every bug fix adds a regression test.** Don't disable, skip, or loosen
existing tests/thresholds to make a change pass.
