# member-manager — agent entry index

TUM.ai member portal. pnpm workspace monorepo (Turborepo), Node 24:

- **`shared/`** — framework-free TypeScript types + Zod schemas. The client↔server
  contract. No React/Fastify imports. Built with `tsc` to `dist/`.
- **`client/`** — React 18 + Vite 7 + Tailwind 4 + shadcn/ui + TanStack Query +
  React Router + react-hook-form.
- **`server/`** — Fastify 5 + Zod + Supabase JS.
- **`api/[...path].ts`** — the Vercel function; it wraps the built server (`server/dist`).

Data flow: client component → `lib/apiClient` → `/api/*` → Fastify route plugin →
Supabase. Auth via Supabase (Slack OIDC in production); sensitive DB fields are encrypted at rest.
The repository is **public**.

## Read These First

Start with this file, then read the matching guide for the area you are editing. Cross-cutting
rules live in `.agents/rules/`: Claude Code loads them by path automatically, other agents should
open the file named in the table.

| You are editing...                                                   | Read                                           |
| -------------------------------------------------------------------- | ---------------------------------------------- |
| `client/**`                                                          | `client/AGENTS.md`                             |
| `server/**`, `api/**`                                                | `server/AGENTS.md`                             |
| `shared/**`                                                          | `shared/AGENTS.md`                             |
| `supabase/**`                                                        | `supabase/AGENTS.md`                           |
| `e2e/**`, `playwright.config.ts`                                     | `e2e/AGENTS.md`                                |
| any test or story (`*.test.ts(x)`, `*.stories.tsx`)                  | `.agents/rules/testing.md` + the package guide |
| `.github/**`, `scripts/**`, `biome.json`, `turbo.json`, `vercel.json` | `.agents/rules/ci.md`                          |
| SEPA bank details, IBANs, reimbursement payment fields               | `.agents/rules/bank-details.md`                |
| human-facing docs                                                    | `docs/README.md` (index)                       |

## Agent Configuration

`.agents/` and the `AGENTS.md` files are the single source of truth. Claude Code does not read
`.agents/`, so `.claude/` is a thin adapter over it:

- `.claude/rules`, `.claude/agents`, `.claude/skills` are **symlinks** to `.agents/rules`,
  `.agents/agents`, `.agents/skills`. Add or edit files only under `.agents/`; they show up for
  Claude automatically. Never replace these links with real directories.
- Claude Code (v2.1.277+) reads `AGENTS.md` files directly, so there are no `CLAUDE.md` files.
  Don't add one: any `CLAUDE.md` (or a personal `CLAUDE.local.md`) makes Claude skip `AGENTS.md`.
- Package guidance lives in the nested `AGENTS.md` files, which every agent reads. `.agents/rules/`
  holds only cross-cutting, path-scoped rules; don't add a per-package rule that repeats a guide.
- `.claude/settings.json` (permissions + deny list) and `.claude/hooks/` (git guard, Biome
  format-on-save) are real, Claude-only files. Keep them when reorganizing agent docs.
- The git-guard hook matches blocked phrases (`supabase db push`, `rm -rf`, force pushes, …)
  anywhere in a command, so a PR body that merely mentions one is blocked too. Write such text to a
  file and pass it with `--body-file`.
- `.codex/` is a personal, gitignored Codex adapter; nothing in the repo depends on it.
- `scripts/check-agent-config.test.mjs` (part of `pnpm test`) fails if these links break or a
  `CLAUDE.md` is committed.

## Key commands

- `pnpm gate` — `lint && typecheck && test && build`. **The pre-push gate.** Run it before pushing.
- `pnpm build:shared` — rebuild `shared/dist`. Turbo builds it before `typecheck`/`test`/`build`
  (`^build`), but editors and one-off `tsx` runs keep reading a stale `dist/` until you rebuild.
- `pnpm dev` — full local stack (builds shared, starts Supabase, seeds, runs client+server).
- `pnpm test` / `pnpm test:coverage` — all unit/integration tests (+ coverage floors).
- `pnpm test:e2e` — Playwright E2E (needs a seeded Supabase; see `e2e/AGENTS.md`).
- `pnpm supabase:start | reset | status | stop`, `pnpm setup:local`, `pnpm doctor` (checks the
  local toolchain).
- Node 24 is required (`engines.node: 24.x`, `.nvmrc`).

### A green gate is not a green CI

CI (`docs/ci.md`) also runs checks that `pnpm gate` skips:

- **Coverage floors** — CI runs `pnpm test:coverage`, not `pnpm test`. Deleting tested code can drop
  a package below its floor (#321).
- **Spell check** — `typos` with `_typos.toml`. German UI strings and names are the usual hits; run
  `typos` locally if it is installed.
- **Storybook interaction + a11y tests** — `pnpm --filter @member-manager/client test:storybook`
  (needs Playwright Chromium).
- **E2E + RLS integration tests** (`e2e.yml`) and a clean `supabase db reset` when `supabase/`
  changed (both need Docker).

Before pushing a risky change, run `pnpm test:coverage` and `typos` in addition to the gate.

## Non-negotiables

1. **Feature-scoped architecture** — thin `*Page.tsx` → one `hooks/use*.ts` → presentational
   `*Section`/`*Panel` components. Exemplar: `client/src/features/tools/`.
2. **Never lower coverage thresholds.** They ratchet **up only** (`client/vite.config.ts`,
   server c8 floors in `server/package.json`). New code ships with tests.
3. **Never log, return, or seed plaintext sensitive fields** (IBAN/BIC/bank name/address/DOB/phone).
   They are encrypted via `server/src/lib/sensitiveData.ts`. Security-critical.
4. **Never edit a merged migration.** `supabase/migrations/*` is immutable once on `main`. Add a new
   timestamped migration instead.
5. **Biome is law** — tabs, double quotes, named exports (`noDefaultExport`; the exceptions are the
   overrides in `biome.json`), `import type` / `export type`, no non-null `!`. Fix the code, don't
   relax `biome.json`. Let the format-on-save hook run.
6. **File-size limits** — `client/src/features/**/*.tsx` and `client/src/components/layout/**/*.tsx`
   HARD-fail >700 lines, SOFT-warn >400 (`scripts/check-file-size.mjs`). The allowlist is empty;
   split into sections instead of adding to it.
7. **`@/` imports in the client.** Biome rejects every parent-relative (`../`) import under
   `client/src`. Same-folder `./` imports are fine.
8. **No real member data in git.** The repo is public and every pushed branch is readable by
   anyone. Never commit member exports, dumps, or scraped profiles (`/data` is gitignored), not even
   to a throwaway branch.
9. **Never write to the hosted Supabase project.** Production migrations apply via CI on push to
   `main`; `supabase db push` and `supabase link` are denied locally.

## Production-only traps (Vercel)

Local dev and E2E run the server directly, so these only fail after deploy. Details in
`server/AGENTS.md`.

- The `/api/:path*` rewrite adds a `path` query parameter to every request. Never `.strict()` a
  query-string schema (#309, #322).
- Packages loaded through a dynamic or optional `require()` (native addons) are not traced into the
  function bundle (#350).
- Function request and response bodies are capped at 4.5 MB. Large files go through Supabase
  Storage signed upload URLs (#246, #326).
- `api/[...path].ts` imports `server/dist` built by `tsc`, which is stricter than `tsx` in dev.

## Git and worktrees

- `main` accepts squash merges only. Before saying whether something landed, `git fetch` and check
  `origin/main`: `git log main..branch` keeps listing commits a squash already merged.
- Commits and PR titles use Conventional Commits (`pr-title.yml` checks the PR title).
- A fresh worktree needs `pnpm install`. Its `prepare` step cannot install git hooks from a worktree
  (ENOTDIR); hooks live in the main checkout's `.git/hooks` (`pnpm hooks:install` there). Without
  them, run `pnpm lint:staged` and the gate yourself.

## Helpers

Subagents in `.agents/agents/`: `frontend-engineer`, `backend-engineer`, `db-migration-expert`,
`a11y-responsive-specialist`, `shared-types-guardian`, and the read-only `code-reviewer`.
Skills in `.agents/skills/`: `gate`, `commit`, `new-feature`, `pr-review`, `verify-e2e`, `tumai-ci`.
Each file says when to use it.

## Learnings

<!-- Durable, non-obvious lessons that have no better home. Prefer the nested AGENTS.md or rule
     for the area the lesson is about; add a bullet here only for repo-wide lessons. -->
