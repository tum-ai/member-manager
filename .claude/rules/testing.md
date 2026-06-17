---
paths: ["**/*.test.ts", "**/*.test.tsx", "**/*.stories.tsx", "client/src/test/**", "server/test/**", "e2e/**"]
---

# Testing rules

Three runners — pick by location:

- **Client → Vitest** (jsdom + RTL + MSW). MSW runs with `onUnhandledRequest: "error"`, so every
  network call in a test needs a handler. Use `client/src/test/renderWithClient.tsx`. Coverage
  thresholds in `client/vite.config.ts` **ratchet up only — never lower them.**
- **Server → `node --test`** + c8. Floors: lines/funcs/stmts ≥ 70, branches ≥ 50. Never lower.
- **E2E → Playwright** (`e2e/*.spec.ts`). Runs against the real seeded stack: `global-setup.ts`
  resets+seeds Supabase; `e2e/helpers.ts` depends on seed tokens. Keep `seed.sql` ↔ `e2e/fixtures`
  in parity. One spec: `pnpm test:e2e e2e/<name>.spec.ts`.
- **Storybook** → interactive components get a play function + a11y story (addon-vitest);
  `pnpm --filter @member-manager/client test:storybook`.

**New code ships with tests.** Don't disable, skip, or loosen existing tests/thresholds to make a
change pass.
