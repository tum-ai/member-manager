# CI

GitHub Actions workflows in `.github/workflows/`. The toolchain setup (pnpm from `packageManager`,
Node from `.nvmrc`, `pnpm install --frozen-lockfile`, `pnpm build:shared`) is shared through the
`./.github/actions/setup` composite action. `build`/`typecheck`/`lint`/`test` run through Turborepo
with the Vercel remote cache (`TURBO_CACHE`: `main` reads and writes, PRs only read).

## Branch protection

`main` accepts squash merges only, needs one approving review, and requires these status checks:

- **Lint / Build / Test** — the `required-checks` job in `ci.yml`, which fails if any of Lint,
  Typecheck, Build, Test or Storybook Test failed or was cancelled.
- **Supabase Migration Reset**
- **Production Supabase Migration Drift**

The job names are what branch protection matches; renaming a job silently drops the requirement.
Everything else below is informational, even when it runs on every PR.

## Workflows and jobs

| Workflow | Job | Runs | What it does |
| --- | --- | --- | --- |
| CI (`ci.yml`) | Detect changes | PR + push to `main` | paths filter: `code` (anything but `**/*.md`, `docs/**`), `supabase` |
| | Lint | always | `pnpm lint` — Biome + `check-file-size.mjs` |
| | Typecheck | always | `pnpm typecheck` |
| | Build | always | `pnpm build` |
| | Test | always | `pnpm test:coverage` — coverage floors + `test:scripts`; uploads to Codecov (non-blocking) |
| | Storybook Test | steps skip without `code` changes | `test:storybook` in Chromium: play functions + a11y |
| | Bundle Size | steps skip without `code` changes | `scripts/check-bundle-size.mjs` against a gzip budget (advisory) |
| | Workflow Lint | always | actionlint (blocking) + zizmor (advisory, `\|\| true`) |
| | Spell Check | always | `crate-ci/typos` with `_typos.toml` |
| | Supabase Migration Reset | steps skip without `supabase` changes | `supabase db start` + `supabase db reset` from scratch |
| | Production Supabase Migration Drift | same-repo PRs, not Dependabot | links the hosted project and runs `check-supabase-migrations.mjs --allow-pending-production` |
| | Production Supabase Migrations | push to `main` | `supabase db push` to the hosted project, then asserts parity |
| E2E (`e2e.yml`) | Playwright E2E | steps skip without `code` changes | `supabase start` + `db reset`, `pnpm setup:local`, finance RLS tests, `pnpm test:e2e` |
| Vercel Production (`vercel-production.yml`) | Deploy production | after CI succeeds on a push to `main` | builds and deploys the CI-validated SHA; skips if `main` moved on |
| Vercel Preview (`vercel-preview.yml`) | 4 jobs | a `/deploy-preview` PR comment by a maintainer | see [deployment.md](./deployment.md#5-deployment-ownership-github-actions) |
| PR Title (`pr-title.yml`) | Semantic PR Title | PR events | Conventional Commit PR title (the squash commit message) |
| CodeQL (`codeql.yml`) | Analyze | PR, push, weekly | JS/TS security scan |
| Dependency Review (`dependency-review.yml`) | Dependency Review | PR | fails on high-severity advisories |
| Dependabot Auto-Merge | Approve and enable auto-merge | Dependabot PRs | auto-merges non-major updates once checks pass |

CodeQL and Dependency Review skip themselves when the repository is private (GitHub Free has no
Code Security for private repositories); they run today because the repository is public.

Heavy jobs are path-gated at the **step** level, so on a docs-only PR they still report success and
branch protection stays satisfied.

## Secrets

| Secret | Used by |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` | the two production migration jobs |
| `TURBO_TOKEN`, `TURBO_TEAM` | optional Turborepo remote cache ([deployment.md](./deployment.md#6-github-actions-secrets)) |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | the Vercel deploy workflows |

Fork PRs receive no secrets: they run without the remote cache, and the production drift check is
skipped.

## What the local gate doesn't cover

`pnpm gate` (`lint && typecheck && test && build`) is a subset of CI. It doesn't check coverage
floors (`pnpm test:coverage`), spelling (`typos`), Storybook tests
(`pnpm --filter @member-manager/client test:storybook`), E2E (`pnpm test:e2e`), the finance RLS
tests, or a clean migration replay (`pnpm supabase:reset`). Run the relevant ones before pushing a
change that touches those areas.

## Ratchets

Two gates tighten over time and never loosen:

- **Coverage floors.** Thresholds live in `client/vite.config.ts` (`test.coverage.thresholds`) and
  the server `test:coverage` script (`c8 --lines/--functions/--branches/--statements`). They sit just
  below current coverage so CI fails on a regression. When coverage rises, raise the numbers in the
  same PR. Never lower them to make a build pass — add tests instead.
- **Biome rules.** `biome.json` enables `recommended` plus a set of stricter, already-clean rules.
  To tighten further, probe a candidate rule
  (`pnpm exec biome lint --only=<group>/<rule> client/src server/src shared/src`), and if it is
  clean (or auto-fixable with `pnpm lint:apply`), promote it to `"error"`. Fix violations; don't
  disable rules.

The file-size allowlist in `scripts/check-file-size.mjs` is empty. Keep it that way: split a file
that crosses 700 lines instead of allowlisting it.

## Gotchas

- Pin pnpm only via `packageManager`; also pinning it in `pnpm/action-setup` fails the job.
- `supabase/setup-cli` needs `github-token` for its release lookup.
- In `biome.json` overrides, use positive globs only. A negated glob in `includes` re-broadens the
  file set and pulls ignored paths such as `shared/dist` into the lint.
- A per-test timeout passed to `it()` overrides the Vitest `testTimeout`, and coverage
  instrumentation slows tests down in CI. Don't set one below the config value.
- A new RLS test file in `server/test/migrations/` must be added to the explicit file list in the
  `e2e.yml` RLS step, or CI never runs it.
