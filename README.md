# Member Manager

A member management app for the TUM.ai network built with **React**, **Supabase**, **Fastify**, and **Vite**.

## Product Scope

### Current MVP

The current repository is focused on the authenticated member portal:

- Members sign in and land on **My Profile**
- Members can edit their own information
- Members can switch to **All Members** to browse the active network
- Banking details and privacy-policy agreement handling remain internal/private
- Admin APIs exist for internal member operations

### Future Direction

The longer-term direction is a public-facing network overview:

- A graph view of the TUM.ai network
- Grouping by structured member attributes such as university, studies, and current work
- Public exploration without exposing internal-only data

That public graph is out of scope for the current MVP. This repo should be treated as the member-data and authentication foundation for that future experience.

## Current User Experience

### Authentication

- Email/password sign-in and registration are supported
- Slack OAuth sign-in is supported through Supabase OIDC
- After login, users are routed to **My Profile**

### Authenticated Navigation

- `/` -> My Profile
- `/members` -> All Members directory
- `/engagement-certificate` -> Engagement certificate flow
- `/profile` -> legacy alias that redirects to `/`

### Data Visibility

- The authenticated directory exposes lightweight member information for browsing and search
- Full member profiles are only visible to the member themself or an admin
- SEPA data and agreement state are private/internal
- Sensitive fields are encrypted server-side before storage
- A future public graph should use an explicit publication model instead of exposing private profile data directly

## Features

- Authenticated profile editing
- Searchable authenticated member directory
- SEPA mandate and privacy-policy flows
- Membership and engagement certificate generation
- Encrypted handling of sensitive personal and banking data
- Local Supabase development setup

## Tech Stack

- Client: React 18, Vite, MUI, React Query
- Server: Fastify, Zod
- Database/Auth: Supabase
- Tooling: pnpm, TypeScript, Biome, Vitest, Node test runner
- PDF: jsPDF

## Getting Started

### 1. Clone the Repo

```bash
git clone https://github.com/tum-ai/member-manager.git
cd member-manager
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Local Database (Recommended)

This project supports local Supabase development so you don't need to connect to the production database during development.

#### Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) - Required for running Supabase locally
- [Supabase CLI](https://supabase.com/docs/guides/cli) - Install via `brew install supabase/tap/supabase`

#### Start Local Supabase

```bash
# Start Supabase (runs PostgreSQL, Auth, Storage, etc. in Docker)
pnpm supabase:start
```

The first run will take a few minutes to download Docker images. Once complete, you'll see output with local credentials:

```
Started supabase local development setup.

         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
  S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Create Environment Files for Local Development

Create `.env.local` files in both `client/` and `server/` directories using the credentials from `supabase status`:

**server/.env.local:**
```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase status>
FIELD_ENCRYPTION_KEY=<long random secret used for field encryption>
PORT=3000
```

**client/.env.local:**
```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase status>
# Optional: only needed when Slack OAuth is enabled locally
VITE_SLACK_CALLBACK_URL=http://localhost:5173/
```

#### Run Development with Local Database

```bash
# Start both client and server using local Supabase
pnpm dev:local
```

This uses the `.env.local` files you created above.

#### Other Supabase Commands

```bash
# Check status of local Supabase
pnpm supabase:status

# Reset database (re-runs migrations and seeds)
pnpm supabase:reset

# Stop local Supabase
pnpm supabase:stop
```

#### Local Development URLs

- **App**: http://localhost:5173
- **API**: http://localhost:3000
- **Supabase Studio**: http://127.0.0.1:54323 (database admin UI)
- **Inbucket**: http://127.0.0.1:54324 (email testing - view confirmation emails)

#### Test Accounts (Local Only)

The local database is seeded with test accounts:

| Email | Password | Role |
|-------|----------|------|
| admin@example.com | password123 | admin |
| user@example.com | password123 | user |

### 4. Run Against Production (Alternative)

If you need to connect to the production Supabase instance:

1. Copy environment files:
   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

2. Fill in the production Supabase credentials in both `.env` files

3. Run development servers:
   ```bash
   pnpm dev
   ```

Then open `http://localhost:5173` in your browser.

### Sensitive Data Encryption

The server now encrypts sensitive member data before it is stored in Supabase and decrypts it only when serving authorized API responses.

- Encrypted member fields: `date_of_birth`, `street`, `number`, `postal_code`, `city`, `country`, `phone`
- Encrypted SEPA fields: `iban`, `bic`, `bank_name`
- Transport enforcement: production Supabase URLs must use `https://`, and the browser app refuses to call the API over plain HTTP in production

To enable this, set `FIELD_ENCRYPTION_KEY` in every server environment to a long random secret and keep it outside git.

If you already have plaintext data in Supabase, run the one-time backfill after deploying the new server code:

```bash
pnpm --filter @member-manager/server backfill:encryption
```

## Project Structure

```
member-manager/
├── client/              # React frontend (member portal)
├── server/              # Fastify API
├── supabase/            # Supabase config, migrations, seed data
│   ├── config.toml      # Local Supabase configuration
│   ├── migrations/      # SQL migration files
│   └── seed.sql         # Local test data
├── package.json         # Workspace scripts
├── pnpm-workspace.yaml  # pnpm workspace definition
└── README.md            # Repo overview and setup guide
```

## Repository Architecture

### Client

The client in `client/` handles:

- authentication UI
- profile editing
- the authenticated member directory
- certificate-related user flows

### Server

The Fastify API in `server/` handles:

- authenticated member CRUD
- SEPA and agreement data
- admin-only endpoints
- encryption and decryption of sensitive fields

### Supabase

The `supabase/` directory contains the schema, migrations, seed data, and local development configuration.

## API Overview

### Member APIs

- `POST /api/members` creates the caller's member record if it does not exist
- `GET /api/members` returns the authenticated member directory
- `GET /api/members/:userId` returns the full member profile for the owner or an admin
- `PUT /api/members/:userId` updates the member profile for the owner or an admin

### SEPA APIs

- `POST /api/sepa`
- `GET /api/sepa/:userId`
- `PUT /api/sepa/:userId`

These are authenticated and intended for internal/private use.

### Admin APIs

- `GET /api/admin/members`
- `PATCH /api/admin/members/:userId/status`

These require an admin role.

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run client and server (uses `.env` files) |
| `pnpm dev:local` | Run with local Supabase (uses `.env.local` files) |
| `pnpm build` | Build all packages |
| `pnpm lint` | Run linting on all packages |
| `pnpm lint:apply` | Fix lint issues |
| `pnpm test` | Run tests |
| `pnpm supabase:start` | Start local Supabase |
| `pnpm supabase:stop` | Stop local Supabase |
| `pnpm supabase:status` | Show local Supabase status |
| `pnpm supabase:reset` | Reset database with migrations and seeds |

## Roadmap Notes

- The current MVP is centered on member information and the authenticated directory
- University-based grouping is the first intended grouping dimension once richer member data is available
- The future public graph should complement the internal/private portal, not replace it
- Banking details and privacy workflows should remain internal-only even after the public graph launches

A more concrete product and technical roadmap lives in `ROADMAP.md`.
