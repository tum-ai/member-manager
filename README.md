# Member Manager

TUM.ai's member-management monorepo, built with React, Fastify, and Supabase.

## Current Product Scope

The current product is the private member portal:

- members authenticate with email/password or Slack OAuth
- authenticated users land on `My Profile`
- `All Members` is a secondary authenticated directory view
- SEPA, privacy, and admin workflows stay internal
- sensitive fields are encrypted server-side before storage

The public network explorer and graph are not part of the current implementation yet. That work is tracked in [ROADMAP.md](./ROADMAP.md).

## Monorepo Overview

At a glance:

- `client/`: React + Vite member portal
- `server/`: Fastify API and authorization/encryption logic
- `supabase/`: local Supabase config, SQL migrations, and seed data
- `docs/`: project docs and vendored TUM.ai brand reference material
- `.agents/skills/`: repo-local Codex skills, including the TUM.ai CI skill

For a full breakdown of directories and responsibilities, see [docs/repo-structure.md](./docs/repo-structure.md).

## Current App Flow

Authenticated routes:

- `/`: My Profile
- `/members`: authenticated member directory
- `/engagement-certificate`: certificate flow
- `/profile`: legacy alias redirected to `/`

Data visibility:

- `GET /api/members` returns a lightweight authenticated directory
- `GET /api/members/:userId` returns the full profile for the owner or an admin
- SEPA and agreement data remain private/internal
- future public browsing should use dedicated public APIs, not the private member routes

## Tech Stack

- client: React 18, Vite, MUI, React Query
- server: Fastify, Zod, TypeScript
- database/auth: Supabase
- tooling: pnpm, Biome, Vitest, Node test runner
- PDF generation: jsPDF

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start local Supabase

Prerequisites:

- Docker
- Supabase CLI

```bash
pnpm supabase:start
```

The local Supabase status output gives you the credentials for the next step.

### 3. Create local environment files

Generate `client/.env.local` and `server/.env.local` from the running Supabase stack:

```bash
pnpm setup:local
```

This shells out to `supabase status -o env`, parses the current anon / service-role keys, and writes both `.env.local` files. It is idempotent and preserves any `FIELD_ENCRYPTION_KEY` you have already set locally.

`pnpm dev:local` also runs this step automatically, so most of the time you can skip straight to step 4.

**Optional — "Continue with Slack" login locally:**

To exercise Slack OIDC against the local stack, copy `supabase/.env.example` to `supabase/.env.local` and fill in the Slack app's client ID and secret. `pnpm supabase:start` (invoked via `scripts/supabase-start.mjs`) loads this file into the CLI's environment before spawning so the `env(...)` refs in `supabase/config.toml` resolve. You also need to add `http://127.0.0.1:54321/auth/v1/callback` to the Slack app's allowed redirect URLs.

### 4. Run the app

```bash
pnpm dev:local
```

This boots local Supabase, refreshes the `.env.local` files, and starts the client (`vite`) and server (`tsx watch`) in parallel against the local stack.

Local URLs:

- app: `http://localhost:5173`
- API: `http://localhost:3000`
- Supabase Studio: `http://127.0.0.1:54323`
- Inbucket: `http://127.0.0.1:54324`

Seeded local accounts:

| Email | Password | Role |
| --- | --- | --- |
| `admin@example.com` | `password123` | admin |
| `user@example.com` | `password123` | user |

### 5. Useful workspace commands

```bash
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm supabase:status
pnpm supabase:reset
pnpm supabase:stop
```

## Sensitive Data Handling

The server encrypts sensitive member and SEPA data before persisting it to Supabase and decrypts it only for authorized responses.

- encrypted member fields include `date_of_birth`, `street`, `number`, `postal_code`, `city`, and `country`
- encrypted SEPA fields include `iban`, `bic`, and `bank_name`
- production Supabase URLs must use `https://`

If older environments contain plaintext data, run the one-time backfill:

```bash
pnpm --filter @member-manager/server backfill:encryption
```

## API Summary

Private member APIs:

- `POST /api/members`
- `GET /api/members`
- `GET /api/members/:userId`
- `PUT /api/members/:userId`

Private SEPA APIs:

- `POST /api/sepa`
- `GET /api/sepa/:userId`
- `PUT /api/sepa/:userId`

Admin APIs:

- `GET /api/admin/members`
- `PATCH /api/admin/members/:userId/status`

These are authenticated and intended for internal/private use.

## Production Deployment

Production is deployed on Vercel. The static client is served from `client/dist`, and `api/[...path].ts` exposes the Fastify server as a Vercel Node.js function for same-origin `/api/*` requests.
