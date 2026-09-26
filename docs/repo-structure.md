# Repository Structure

The source-of-truth layout of the `member-manager` monorepo. This page stays at the level of
top-level folders and entry points; each package's `AGENTS.md` has its own module map, and the
code is the reference below that.

## Top level

```text
member-manager/
├── .agents/            # Agent rules, subagents, and skills (canonical; see "Agent configuration")
├── .claude/            # Claude Code adapter: symlinks into .agents/ + settings and hooks
├── .github/            # Workflows (docs/ci.md), Dependabot, the shared setup action
├── api/                # Vercel function entry: api/[...path].ts wraps server/dist
├── client/             # React/Vite member portal            → client/AGENTS.md
├── docs/               # Human docs (index: docs/README.md) and vendored brand material
├── e2e/                # Playwright specs and helpers        → e2e/AGENTS.md
├── infra/              # Infrastructure images (LibreOffice sandbox for contract rendering)
├── scripts/            # Dev/CI scripts and their node --test suites
├── server/             # Fastify API                         → server/AGENTS.md
├── shared/             # Client↔server types + Zod schemas   → shared/AGENTS.md
├── supabase/           # Local stack config, migrations, seed → supabase/AGENTS.md
├── AGENTS.md           # Repo rules for humans and agents
├── biome.json          # Lint + format rules
├── package.json        # Workspace scripts (gate, dev, test, supabase:*)
├── playwright.config.ts
├── pnpm-workspace.yaml # Workspace packages: client, server, shared
├── turbo.json          # Task graph for build/typecheck/lint/test
├── vercel.json         # Output dir, function config, rewrites, crons
└── _typos.toml         # Spell-check allowlist
```

Generated folders such as `*/dist`, `node_modules`, `coverage`, `playwright-report`, and
`supabase/.temp` are build or local-runtime artifacts, not source.

## Entry points

| Package | Entry points |
| --- | --- |
| `client/` | `src/main.tsx` (bootstrap), `src/App.tsx` (auth gate + routes), `src/features/<domain>/` (one folder per feature), `src/components/ui/` (shadcn primitives), `src/index.css` (design tokens) |
| `server/` | `src/index.ts` (process), `src/app.ts` (Fastify app + route registration), `src/routes/` (one plugin per domain), `src/lib/` (integrations, encryption, auth helpers) |
| `shared/` | `src/index.ts` (barrel), one module per domain |
| `supabase/` | `migrations/` (append-only), `seed.sql`, `config.toml` |
| `api/` | `[...path].ts`: imports `server/dist/app.js`, so production runs the `tsc` build |

## Where a change belongs

- Member-facing UI, routing, theme: `client/src/`
- Request validation, authorization, encryption, integrations: `server/src/`
- A shape both sides use: `shared/src/` first, then both consumers
- Database schema or seed data: `supabase/migrations/` and `supabase/seed.sql`
- End-to-end flows: `e2e/`
- CI and repo tooling: `.github/`, `scripts/`
- Human docs: `docs/`; rules for code: the nearest `AGENTS.md`
- Agent guidance, subagents, and skills: `.agents/` (never directly in `.claude/`)

## Agent configuration

```text
.agents/
├── agents/     # subagent prompts (frontend-engineer, backend-engineer, db-migration-expert,
│               #   a11y-responsive-specialist, shared-types-guardian, code-reviewer)
├── rules/      # cross-cutting, path-scoped rules (ci, testing, bank-details)
└── skills/     # commit, gate, new-feature, pr-review, tumai-ci, verify-e2e

.claude/
├── agents -> ../.agents/agents   # symlink
├── rules  -> ../.agents/rules    # symlink
├── skills -> ../.agents/skills   # symlink
├── hooks/                        # Claude-only: git guard (PreToolUse), Biome format (PostToolUse)
└── settings.json                 # Claude-only: permissions, deny list, hook wiring
```

The root and package-level `AGENTS.md` files are the source of truth for repo instructions. Claude
Code reads them directly, so the repo has no `CLAUDE.md` files, and it doesn't read `.agents/`, hence
the symlinks. `scripts/check-agent-config.test.mjs` fails `pnpm test` if the symlinks are replaced
with real directories or a `CLAUDE.md` is committed; `scripts/check-git-guard.test.mjs` pins the
git-guard policy. A `.codex/` directory, if present, is a personal Codex adapter and is gitignored.

## Practical conventions

- Edit source files, not generated output in `dist/`.
- Keep frontend changes feature-scoped under `client/src/features/`.
- Keep route modules thin and move reusable logic into `server/src/lib/`.
- Treat Supabase migrations as append-only history.
- Keep external reference material vendored under `docs/` so the repo stays self-contained.
