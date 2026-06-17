# member-manager — Claude entry index

TUM.ai member portal. pnpm workspace monorepo, Node 24, three packages:

- **`shared/`** — framework-free TypeScript types + Zod schemas. The client↔server
  contract. No React/Fastify imports. Built with `tsc` to `dist/`.
- **`client/`** — React 18 + Vite 7 + Tailwind 4 + shadcn/ui + TanStack Query +
  React Router + react-hook-form.
- **`server/`** — Fastify 5 + Zod + Supabase JS.

Data flow: client component → `lib/apiClient` → `/api/*` → Fastify route plugin →
Supabase. Auth via Supabase; sensitive DB fields are encrypted at rest.

## Read these first

When touching files under a glob, the matching `.claude/rules/*.md` auto-loads. Quick map:

| You are editing…                          | Rule / nested guide                  |
| ----------------------------------------- | ------------------------------------ |
| `client/**`                               | `.claude/rules/client.md`, `client/CLAUDE.md` |
| `server/**`                               | `.claude/rules/server.md`, `server/CLAUDE.md` |
| `shared/**`                               | `.claude/rules/shared.md`, `shared/CLAUDE.md` |
| `supabase/**`                             | `.claude/rules/migrations.md`, `supabase/CLAUDE.md` |
| `e2e/**`                                  | `.claude/rules/testing.md`, `e2e/CLAUDE.md` |
| `**/*.test.ts(x)`, `**/*.stories.tsx`     | `.claude/rules/testing.md`           |
| `.github/workflows/**`, `scripts/**`, `biome.json` | `.claude/rules/ci.md`       |

## Key commands

- `pnpm gate` — `lint && typecheck && test && build`. **The pre-push gate.** Run it before pushing.
- `pnpm build:shared` — rebuild `shared/`. **Required before typecheck/test** when `shared/` changed
  (`typecheck` and `test` already prefix this, but a stale `dist/` breaks editor/types otherwise).
- `pnpm dev` — full local stack (builds shared, starts Supabase, seeds, runs client+server).
- `pnpm test` / `pnpm test:coverage` — all unit/integration tests (+ coverage).
- `pnpm test:e2e` — Playwright E2E (needs a seeded Supabase; see `e2e/CLAUDE.md`).
- `pnpm supabase:start | reset | status | stop`, `pnpm setup:local`.
- Node 24 is required (`engines.node: 24.x`).

## Non-negotiables

1. **Feature-scoped architecture** — thin `*Page.tsx` → one `hooks/use*.ts` → presentational
   `*Section`/`*Panel` components. Exemplar: `client/src/features/tools/`.
2. **Never lower coverage thresholds.** They ratchet **up only** (`client/vite.config.ts`,
   server c8 floors). New code ships with tests.
3. **Never log, return, or seed plaintext sensitive fields** (IBAN/BIC/address/DOB/phone). They are
   encrypted via `server/src/lib/sensitiveData.ts`. Security-critical.
4. **Never edit a merged migration.** `supabase/migrations/*` is immutable once on `main`. Add a new
   timestamped migration instead.
5. **Biome is law** — tabs, double quotes, named exports (`noDefaultExport`), `import type` /
   `export type`, no non-null `!`. Let the format-on-save hook run; don't fight it.
6. **File-size limits** — `client/src/features/**/*.tsx` and `components/layout/**/*.tsx` HARD-fail
   >700 lines, SOFT-warn >400 (`scripts/check-file-size.mjs`). Split into sections instead.
7. **`@/` alias across feature boundaries.** Relative imports only within one feature.

## Agents

Delegate to a subagent when its scope matches:

- **frontend-engineer** — client features/components/hooks (Page→hook→sections, responsive, dark mode).
- **backend-engineer** — Fastify routes, server lib, encryption, authZ.
- **db-migration-expert** — new migrations, seed parity.
- **a11y-responsive-specialist** — responsive/keyboard/ARIA/dark-mode audits + fixes.
- **shared-types-guardian** — changes to `shared/` contracts; client/server drift.
- **code-reviewer** — read-only review of a diff/PR against repo invariants (never edits).

## Workflows

- **Implement a client feature** → `/new-feature`, then frontend-engineer. Page→hook→sections;
  add Vitest tests for hooks/utils + Storybook play/a11y stories for interactive components.
- **Add a server route** → backend-engineer. If the shape changes, edit `shared/` first &
  `pnpm build:shared`. Zod-validate input, typed errors, encrypt sensitive fields, add `node --test`.
- **Add a migration** → db-migration-expert. New timestamped file, keep `seed.sql` in parity with
  E2E fixtures, verify `pnpm supabase:reset`.
- **Before pushing** → `/gate` (or `pnpm gate`). Fix every stage.
- **Open a PR** → `/commit`, push branch, `gh pr create`. Review with `/pr-review`.

## Learnings

<!-- Append durable, non-obvious lessons here as you discover them. One bullet each. -->
