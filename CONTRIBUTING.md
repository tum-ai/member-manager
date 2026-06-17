# Contributing

Start here if you are new to the repo. This page is the short path; it links out
to the deeper guides rather than repeating them.

## Prerequisites

- **Node 24** (matches `.nvmrc` — run `nvm use`)
- **pnpm** (the repo pins pnpm 10 in CI)
- **Docker** and the **Supabase CLI** (for the local stack)

## First run

```bash
pnpm install          # install workspace dependencies
pnpm supabase:start   # start the local Supabase stack (Docker)
pnpm dev              # generate .env.local, then run client + server
```

`pnpm dev` runs `pnpm setup:local` for you, so you normally do not call it
separately. Local URLs and the seeded test accounts are listed in the
[README](./README.md#4-run-the-app).

Stuck? Run the environment health check:

```bash
pnpm doctor           # checks Node version, .env.local files, Supabase + seed
```

It is read-only and prints the exact command to fix anything it flags. For env
precedence, dev modes, Slack OIDC, and common failure modes see
[docs/development.md](./docs/development.md).

## Project layout

`client/` (React + Vite), `server/` (Fastify), `shared/` (the client/server type
contract), `supabase/` (migrations + seed). See
[docs/repo-structure.md](./docs/repo-structure.md) for the full breakdown, and the
package-level `CLAUDE.md` files plus `.claude/rules/*.md` for the conventions that
apply when you edit each area.

## Before you push

```bash
pnpm gate             # lint + typecheck + test + build (mirrors required CI)
```

If `pnpm gate` is green locally, the core CI jobs should be too.

## Commit and PR conventions

- **PR titles** must follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`, `style:`,
  `ci:`, `build:`, `revert:`). This is enforced in CI; keep commit messages in the
  same style.
- Keep changes feature-scoped and respect the repo invariants documented in the
  root [CLAUDE.md](./CLAUDE.md) (file-size limits, coverage ratchet, encrypted
  sensitive fields, immutable migrations).
