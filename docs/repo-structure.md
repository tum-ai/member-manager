# Repository Structure

This document describes the source-of-truth layout of the `member-manager` monorepo.

## Top Level

```text
member-manager/
├── .agents/                  # Repo-local Codex skills and instructions
├── .github/                  # GitHub Actions workflows and repo automation
├── client/                   # React/Vite member portal
├── docs/                     # Project documentation and vendored brand material
├── server/                   # Fastify API
├── supabase/                 # Local Supabase config, migrations, and seed data
├── package.json              # Workspace-level scripts
├── pnpm-workspace.yaml       # pnpm workspace definition
└── ROADMAP.md                # Product and technical roadmap
```

Generated folders such as `client/dist`, `server/dist`, `node_modules`, and `supabase/.temp` are build or local-runtime artifacts, not primary source code.

## Workspace Responsibilities

### `client/`

The frontend application for authenticated members.

Key paths:

```text
client/
├── public/
│   ├── fonts/               # Bundled UI fonts
│   └── img/                 # Logos and static images
├── src/
│   ├── components/
│   │   ├── layout/          # Shell and navigation
│   │   └── ui/              # Shared UI building blocks
│   ├── contexts/            # React context providers
│   ├── features/            # Route-level and domain features
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── certificate/
│   │   ├── legal/
│   │   ├── members/
│   │   ├── profile/
│   │   └── sepa/
│   ├── hooks/               # React Query and feature hooks
│   ├── lib/                 # API client, schemas, query client, Supabase client, PDF helpers
│   ├── theme/               # MUI theme and animations
│   ├── types/               # Shared client-side types
│   ├── App.tsx              # Auth gate, routes, theme mode wiring
│   ├── index.css            # Global styles and font loading
│   └── main.tsx             # App bootstrap
└── package.json             # Client scripts and dependencies
```

Current route ownership:

- `/` renders the authenticated profile page
- `/members` renders the authenticated member directory
- `/engagement-certificate` renders the certificate flow
- unauthenticated users see the auth screen

### `server/`

The Fastify API used by the client.

Key paths:

```text
server/
├── src/
│   ├── index.ts             # Process entrypoint
│   ├── app.ts               # Fastify app builder
│   ├── lib/                 # Auth helpers, errors, encryption, Supabase adapter
│   ├── middleware/          # Authentication and request guards
│   ├── plugins/             # Fastify plugins such as error handling
│   ├── routes/              # API route modules
│   │   ├── admin.ts
│   │   ├── members.ts
│   │   └── sepa.ts
│   ├── scripts/             # One-off operational scripts
│   └── types/               # Shared server-side types
├── test/
│   ├── mocks/               # Supabase and request test doubles
│   ├── routes/              # Route integration tests
│   ├── unit/                # Focused unit tests
│   └── helpers.ts           # Shared test helpers
└── package.json             # Server scripts and dependencies
```

Route responsibilities:

- `members.ts` handles private member profile creation, reading, updating, and authenticated directory listing
- `sepa.ts` handles internal banking and consent data
- `admin.ts` handles admin-only list and status management

Sensitive fields are encrypted in the server layer before being persisted to Supabase.

### `supabase/`

Local database and auth environment for development.

```text
supabase/
├── config.toml              # Supabase local project configuration
├── migrations/              # SQL schema migrations
└── seed.sql                 # Local seed data for test accounts and fixtures
```

Use the workspace scripts from the repo root to manage this environment:

- `pnpm supabase:start`
- `pnpm supabase:status`
- `pnpm supabase:reset`
- `pnpm supabase:stop`

### `docs/`

Human-facing project documentation and repo-local reference material.

```text
docs/
├── brand/
│   └── source/              # Vendored TUM.ai brand assets and extracted reference files
└── repo-structure.md        # This document
```

The brand source bundle exists so UI work can reference stable, committed files inside this repository instead of external paths.

### `.agents/`

Repo-local Codex skill definitions.

```text
.agents/
└── skills/
    └── tumai-ci/            # TUM.ai brand skill for frontend and design work
```

The `tumai-ci` skill points at `docs/brand/source/` so future UI changes can stay consistent with the committed TUM.ai corporate identity material.

## How To Navigate Changes

Use this map when deciding where a change belongs:

- Authentication, routing, theme, member-facing UI: `client/src/`
- Request validation, authorization, encryption, API behavior: `server/src/`
- Database schema or seed data: `supabase/migrations/` and `supabase/seed.sql`
- Product docs and internal references: `docs/`
- Repo-local agent guidance for brand/UI work: `.agents/skills/`

## Practical Conventions

- Prefer editing source files, not generated output in `dist/`
- Keep frontend changes feature-scoped under `client/src/features/` when possible
- Keep server behavior in route modules thin and move reusable logic into `server/src/lib/`
- Treat Supabase migrations as append-only history
- Keep external reference material vendored under `docs/` if the repo should stay self-contained
