AGENTS.md
===========

Purpose
- Guidance for autonomous agents operating at the repository root level.
- This file contains workspace-level commands, git & CI safety rules and pointers to package-specific agent files.

Monorepo overview
- Managed with `pnpm` workspaces. Packages:
  - `client/` — frontend (React + Vite)
  - `server/` — backend (Fastify + Node)
- Package-specific rules live in `client/AGENTS.md` and `server/AGENTS.md`.

Workspace commands (root)
- Install: `pnpm install`
- Run both dev servers in parallel: `pnpm dev` (runs `pnpm -r --parallel run dev`)
- Build all packages: `pnpm build` (runs `pnpm -r run build`)
- Run all package lint scripts: `pnpm lint` (runs `pnpm -r run lint`)
- Apply lint/format fixes across packages: `pnpm lint:apply` (runs `pnpm -r --parallel run lint:apply`)
- Run all package tests: `pnpm test` (runs `pnpm -r run test` when packages define `test`)

Targeting a single package
- Preferred: use `--filter` to avoid `cd`:
  - Example: `pnpm --filter client run dev` or `pnpm --filter server run dev`
- Alternatively `cd` into the package and run package scripts.

Git & commit safety
- Commit messages: short imperative verb phrase (e.g. `Add input validation`).
- Never force-push to protected branches. Avoid `git push --force`.
- **Refactoring Migration**: When switching from direct exports to getters (e.g., `getSupabase()`), maintain the old export for backwards compatibility until all references are updated.
- Do not commit secrets or `.env` files. If a secret is accidentally committed, notify maintainers immediately.
- Do not try to continue rebases, e.g. `git rebase --continue`.
- Lockfiles: use `pnpm-lock.yaml` only; do not add `package-lock.json` or `yarn.lock`.
- Do not push changes unless explicitly requested.

Agent behavior and constraints
- Scope changes to the package being worked on unless the task explicitly requires cross-package edits.
- Prefer small, incremental PRs. Run tests and lint locally before creating PRs.
- Avoid destructive git operations (`git reset --hard`, `git rebase --interactive`) unless explicitly requested.
- If modifying configuration files (`tsconfig.json`, `pnpm-workspace.yaml`, CI config), add a clear explanation in the commit/PR.

Formatting and linting
- Biome is centralized at the repo root via `biome.json`.
- Prefer running lint/format via package scripts (`pnpm lint`, `pnpm lint:apply`) instead of invoking Biome directly.
- Do not write comments that disable lint rules.
- Do not modify `biome.json` without explicit instructions.
- Do not write extra comments that a human wouldn't add or is inconsistent with the rest of the file (including unnecessary emoji usage).
- Do not write self-explanatory comments for obvious code, rather focus on
  explaining intent or non-trivial logic.
- Do not use any other style that is inconsistent with the file.
- Do not use casts to any to get around type issues.

CI and reproducibility
- Use explicit package targeting in CI to keep builds fast and deterministic (e.g. `pnpm --filter client run build`).
- Make sure the repo builds from a clean checkout: `pnpm install && pnpm build`.

GitHub Actions CI
- pnpm lockfile version (9.0) doesn't match pnpm major version (10.x) — both pnpm 9 and 10 use lockfileVersion 9.0.
- pnpm/action-setup@v2 uses `version` parameter (not `pnpm-version` or `node-version`). Use separate actions/setup-node@v4 for Node.js.
- Setup order matters: pnpm first, then Node.js with `cache: 'pnpm'` (simpler than manual cache configuration).

Where to find package rules
- `client/AGENTS.md` — frontend-specific build, test and style rules.
- `server/AGENTS.md` — backend-specific API, error-handling and deployment rules.
- `supabase/AGENTS.md` — database migrations, seeding, and local development rules.

If you need changes
- Update this file and create a small PR. Run `pnpm lint:apply` and `pnpm build` before pushing.
