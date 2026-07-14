# Member Manager

TUM.ai's member-management monorepo, built with React, Fastify, and Supabase.

## Current Product Scope

The current product is the private member portal:

- members authenticate with email/password or Slack OAuth
- authenticated users land on `My Profile`
- `All Members` is a secondary authenticated directory view
- SEPA, privacy, data privacy notice, and admin workflows stay internal
- contract generation covers PnS draft creation, Legal & Finance review,
  partner comments/signature, board signature, and final PDF generation
- sensitive fields are encrypted server-side before storage

The public network explorer and graph are not part of the current implementation yet. That work is tracked in [ROADMAP.md](./ROADMAP.md).

## Monorepo Overview

At a glance:

- `client/`: React + Vite member portal
- `server/`: Fastify API and authorization/encryption logic
- `supabase/`: local Supabase config, SQL migrations, and seed data
- `docs/`: project docs and vendored TUM.ai brand reference material
- `.agents/`: repo-local agent prompts, rules, and skills, including the TUM.ai CI skill

More reading:

- [CONTRIBUTING.md](./CONTRIBUTING.md) — new-contributor quickstart: prerequisites, first run, `pnpm doctor`, gate, and PR conventions
- [docs/repo-structure.md](./docs/repo-structure.md) — full directory breakdown
- [docs/development.md](./docs/development.md) — env precedence, dev modes, Slack OIDC, DNS quirks, testing, common failure modes
- [docs/deployment.md](./docs/deployment.md) — Vercel env vars, Supabase dashboard config, Slack prod config, `FIELD_ENCRYPTION_KEY` warning
- [docs/contracts.md](./docs/contracts.md) — contract generator workflow, seeded templates, statuses, and production migration notes

## Current App Flow

Authenticated routes:

- `/`: My Profile
- `/members`: authenticated member directory
- `/engagement-certificate`: certificate flow; each engagement records department, weekly hours, responsibilities, plus optional team-lead or board/executive special role
- `/contracts`: create contract drafts from active templates
- `/contracts/submissions`: Legal & Finance review queue for generated contracts
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

Default development uses the Dockerized local Supabase stack.

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

`pnpm dev` / `pnpm dev:local` also run this step automatically, so most of the time you can skip straight to step 4.

**Optional — "Continue with Slack" login locally:**

To exercise Slack OIDC against the local stack, copy `supabase/.env.example` to `supabase/.env.local` and fill in the Slack app's client ID and secret. `pnpm supabase:start` (invoked via `scripts/supabase-start.mjs`) loads this file into the CLI's environment before spawning so the `env(...)` refs in `supabase/config.toml` resolve. You also need to add `http://127.0.0.1:54321/auth/v1/callback` to the Slack app's allowed redirect URLs.

### 4. Run the app

```bash
pnpm dev
```

`pnpm dev` is the Docker-local default. It boots local Supabase, refreshes the `.env.local` files, and starts the client (`vite`) and server (`tsx watch`) in parallel against the local stack. `pnpm dev:local` is kept as an explicit alias for the same mode.

Local URLs:

- app: `http://localhost:5173`
- API: `http://localhost:8787`
- Supabase Studio: `http://127.0.0.1:54323`
- Inbucket: `http://127.0.0.1:54324`

Seeded local accounts all use password `password123`.

| Email | Role / fixture purpose |
| --- | --- |
| `admin@example.com` | admin |
| `legal-finance-lead@example.com` | finance reviewer with SEPA data |
| `board-lead@example.com` | board/team-lead fixture with approved certificate request |
| `regular-member@example.com` | user with admin-managed profile fields unset |
| `user@example.com` | regular active member with SEPA data and pending requests |
| `research-member@example.com` | alumni/research fixture |
| `venture-member@example.com` | inactive fixture |

Additional department/team-lead accounts are seeded for member-list, org-chart, admin, reimbursement, and certificate review flows.

### 5. Useful workspace commands

```bash
pnpm dev              # Docker-local default
pnpm dev:local        # explicit Docker-local mode
pnpm build
pnpm test
pnpm lint
pnpm supabase:status
pnpm supabase:reset
pnpm supabase:stop
```

## Sensitive Data Handling

The shared client/server schema normalizes IBANs and validates their country
format and checksum. The server encrypts sensitive member, SEPA, and
reimbursement data before persisting it to Supabase and decrypts it only for
authorized responses.

- encrypted member fields include `date_of_birth`, `street`, `number`, `postal_code`, `city`, and `country`
- encrypted SEPA fields include `iban`, `bic`, and `bank_name`
- encrypted reimbursement fields include `payment_iban` and `payment_bic`
- production Supabase URLs must use `https://`
- database write guards reject plaintext sensitive fields, including direct Supabase writes

If older environments contain plaintext data, run the one-time backfill:

```bash
pnpm --filter @member-manager/server backfill:encryption
```

To rotate the encryption key without downtime, deploy the new
`FIELD_ENCRYPTION_KEY` with the old key in
`FIELD_ENCRYPTION_KEY_FALLBACKS`, run
`pnpm --filter @member-manager/server rotate:encryption` for a dry run followed
by `pnpm --filter @member-manager/server rotate:encryption --apply`, then
remove the fallback after verification.

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

Private reimbursement APIs:

- `GET /api/reimbursements`
- `POST /api/reimbursements`
- `POST /api/reimbursements/receipt-upload-url`
- `POST /api/reimbursements/parse-receipt`
- `POST /api/reimbursements/process-receipt`
- `GET /api/reimbursements/review`
- `GET /api/reimbursements/summary`
- `GET /api/reimbursements/review/:requestId/receipt`
- `POST /api/reimbursements/review/receipts/bulk-download`
- `PATCH /api/reimbursements/review/:requestId`

Admin APIs:

- `GET /api/admin/members`
- `PATCH /api/admin/members/:userId/status`

These are authenticated and intended for internal/private use.

## Production Deployment

Production is deployed on Vercel. The static client is served from `client/dist`, and `api/[...path].ts` exposes the Fastify server as a Vercel Node.js function for same-origin `/api/*` requests.

See [docs/deployment.md](./docs/deployment.md) for the full checklist (Vercel env vars, Supabase dashboard config, Slack app redirect URLs, `FIELD_ENCRYPTION_KEY` rotation warning, post-deploy smoke tests).
