# Contributing

Start here if you are new to the repo. This page is the short path; it links out
to the deeper guides rather than repeating them.

## Prerequisites

- **Node 24** (matches `.nvmrc` — run `nvm use`)
- **pnpm** (version pinned by `packageManager` in `package.json`)
- **Docker** and the **Supabase CLI** (for the local stack)

## First run

```bash
pnpm install          # install workspace dependencies
pnpm supabase:start   # start the local Supabase stack (Docker)
pnpm dev              # generate .env.local, then run client + server
```

`pnpm dev` runs `pnpm setup:local` for you, so you normally do not call it
separately. Local URLs are in the [README](./README.md#quickstart); the seeded test
accounts are in [docs/development.md](./docs/development.md#seed-data).

Stuck? Run the environment health check:

```bash
pnpm doctor           # checks Node version, .env.local files, Supabase reachability
```

It is read-only and prints the exact command to fix anything it flags. For env
precedence, dev modes, Slack OIDC, and common failure modes see
[docs/development.md](./docs/development.md).

## Project layout

`client/` (React + Vite), `server/` (Fastify), `shared/` (the client/server type
contract), `supabase/` (migrations + seed), `e2e/` (Playwright). See
[docs/repo-structure.md](./docs/repo-structure.md) for the full breakdown, and the
root and package-level `AGENTS.md` files for the conventions that apply when you
edit each area.

## Before you push

```bash
pnpm gate             # lint + typecheck + test + build
```

The gate is a subset of CI. When your change touches those areas, also run:

- `pnpm test:coverage` — CI enforces coverage floors; `pnpm test` doesn't
- `typos` — CI spell-checks everything (German labels go in `_typos.toml`)
- `pnpm --filter @member-manager/client test:storybook` — story play functions and a11y checks
- `pnpm test:e2e` — end-to-end flows against the local stack

[docs/ci.md](./docs/ci.md) lists every CI job and which ones are required.

## Commit and PR conventions

- **PR titles** must follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`, `style:`,
  `ci:`, `build:`, `revert:`). This is enforced in CI; keep commit messages in the
  same style.
- Keep changes feature-scoped and respect the repo invariants documented in the
  root [AGENTS.md](./AGENTS.md) (file-size limits, coverage ratchet, encrypted
  sensitive fields, immutable migrations).
- PRs are squash-merged, so the PR title becomes the commit on `main`. `main`
  needs one approving review and the required checks.
- The repository is public. Never commit real member data, exports, or secrets,
  not even on a short-lived branch.

## Preview deployments

PRs don't deploy automatically. A maintainer or admin can deploy a preview of
an open PR from this repository by commenting exactly `/deploy-preview`; the
workflow comments back with the URL and the PR SHA it deployed. Push a new
commit and you need a new comment. Production deploys from `main` after CI
passes ([docs/deployment.md](./docs/deployment.md)).
