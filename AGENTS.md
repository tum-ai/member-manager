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
- Run all package tests: `pnpm test` (runs `pnpm -r run test` when packages define `test`)

Targeting a single package
- Preferred: use `--filter` to avoid `cd`:
  - Example: `pnpm --filter client run dev` or `pnpm --filter server run dev`
- Alternatively `cd` into the package and run package scripts.

Git & commit safety
- Commit messages: short imperative verb phrase (e.g. `Add input validation`).
- Never force-push to protected branches. Avoid `git push --force`.
- Do not commit secrets or `.env` files. If a secret is accidentally committed, notify maintainers immediately.

Agent behavior and constraints
- Scope changes to the package being worked on unless the task explicitly requires cross-package edits.
- Prefer small, incremental PRs. Run tests and lint locally before creating PRs.
- Avoid destructive git operations (`git reset --hard`, `git rebase --interactive`) unless explicitly requested.
- If modifying configuration files (`tsconfig.json`, `pnpm-workspace.yaml`, CI config), add a clear explanation in the commit/PR.

CI and reproducibility
- Use explicit package targeting in CI to keep builds fast and deterministic (e.g. `pnpm --filter client run build`).
- Make sure the repo builds from a clean checkout: `pnpm install && pnpm build`.

Where to find package rules
- `client/AGENTS.md` — frontend-specific build, test and style rules.
- `server/AGENTS.md` — backend-specific API, error-handling and deployment rules.

If you need changes
- Update this file and create a small PR. Run `pnpm lint:apply` and `pnpm build` before pushing.
