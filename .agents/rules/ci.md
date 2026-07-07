---
paths: [".github/workflows/**", "scripts/**", "biome.json", "*.config.ts"]
---

# CI / tooling rules

- **`pnpm gate` mirrors CI** — `lint && typecheck && test && build`. Run it before pushing; if it's
  green locally, CI's core jobs should be too.
- **Required CI jobs** (`.github/workflows/ci.yml`): Lint, Typecheck, Build, Test (+ Codecov upload),
  Storybook Test, plus actionlint + zizmor (workflow hardening), typos spellcheck (`_typos.toml`), and
  a Supabase migration reset / prod-drift check. E2E runs in `e2e.yml`.
- **Don't lower the bar**: coverage thresholds ratchet up only; don't relax Biome rules in `biome.json`
  to make code pass; don't add files to the file-size allowlist (`scripts/check-file-size.mjs`,
  tracked in #189) — split the file instead.
- **Spellcheck**: new identifiers/words flagged by typos go in `_typos.toml` only if genuinely correct.
- **Workflows** must stay actionlint- and zizmor-clean (pinned actions, least-privilege tokens).
- `scripts/*.mjs` have their own `node --test` suites (`pnpm test:scripts`) — keep them green.
- **Turborepo drives the gate**: root `build`/`typecheck`/`lint`/`test` run via `turbo run …` (graph
  in `turbo.json`). CI uses the Vercel remote cache — `main` writes, PRs are read-only via `TURBO_CACHE`
  in `ci.yml`; token setup is in `docs/deployment.md`. Don't reintroduce recursive `pnpm -r` root
  scripts for these tasks (Turbo resolves the dependency graph, incl. `^build` of `shared`).
- **Other guards**: bundle size (`check-bundle-size.mjs`, advisory budget), seed↔fixture parity
  (`check-seed-fixture-parity.test.mjs`, offline), and git hooks auto-installed on `pnpm install`
  (`prepare` → pre-commit + enforcing pre-push). Heavy jobs (E2E/Storybook/migrations/bundle) are
  path-gated to skip docs-only PRs.
