---
paths: [".github/**", "scripts/**", "biome.json", "turbo.json", "vercel.json", "_typos.toml", "*.config.ts", "package.json"]
---

# CI / tooling rules

Full workflow reference: `docs/ci.md`.

- **The gate is a subset of CI.** `pnpm gate` = `lint && typecheck && test && build`. CI also runs
  `pnpm test:coverage` (coverage floors), `typos`, Storybook interaction + a11y tests, bundle size,
  E2E + RLS tests, and `supabase db reset` when `supabase/` changed.
- **Required checks on `main`**: `Lint / Build / Test` (the `required-checks` aggregator over
  lint, typecheck, build, test, storybook-test), `Supabase Migration Reset`, and
  `Production Supabase Migration Drift`. Branch protection matches these names; don't rename the jobs.
  Heavy jobs gate their steps on a paths filter, so they still report on docs-only PRs.
- **Don't lower the bar**: coverage thresholds ratchet up only; don't relax Biome rules in
  `biome.json` to make code pass; the file-size allowlist in `scripts/check-file-size.mjs` is empty
  and stays that way — split the file instead.
- **Spellcheck**: add a word to `_typos.toml` only if it is genuinely correct (German UI labels and
  names are the usual cases). Otherwise fix the spelling.
- **Workflows** must stay actionlint-clean. zizmor runs advisory (`|| true`) until the baseline is
  pinned; don't add new findings.
- **Toolchain**: the pnpm version comes only from `packageManager` in `package.json` (pinning it in
  `pnpm/action-setup` too fails the job). `supabase/setup-cli` needs `github-token` for its release
  lookup (#300).
- **Biome overrides**: use positive globs in an override's `includes`. A negated glob re-broadens
  the file set and pulls ignored paths such as `shared/dist` into the lint.
- **Test timeouts**: an explicit per-test timeout (third `it()` argument) overrides the config
  `testTimeout`, and coverage instrumentation makes tests slower in CI. Don't set per-test
  timeouts below the config floor.
- **Turborepo drives the gate**: root `build`/`typecheck`/`lint`/`test` run via `turbo run …` (graph
  in `turbo.json`, `^build` builds `shared` first). CI uses the Vercel remote cache — `main` writes,
  PRs are read-only via `TURBO_CACHE` in `ci.yml`; token setup is in `docs/deployment.md`. Don't
  reintroduce recursive `pnpm -r` root scripts for these tasks.
- `scripts/*.mjs` have their own `node --test` suites (`pnpm test:scripts`, part of `pnpm test`):
  seed parity, sensitive-seed, migrations, Vercel config, agent config, git hooks. Keep them green
  and offline; tests that need a running stack skip themselves.
- **Deploys** run in GitHub Actions: `vercel-production.yml` after CI succeeds on `main`,
  `vercel-preview.yml` on a maintainer's `/deploy-preview` PR comment. See `docs/deployment.md`.
