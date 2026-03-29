# Member Manager

A lightweight member management app built with **React**, **Supabase**, **Vite**, and **TailwindCSS**. It features authentication (login/register), email confirmation, and PDF generation using jsPDF.

## Features

- Email/Password Authentication via Supabase
- Email confirmation flow for registration
- TailwindCSS styling
- PDF export support using jsPDF
- Fast development with Vite

## Tech Stack

- React 18
- Supabase v2
- TailwindCSS
- Vite
- jsPDF

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
VITE_API_URL=http://localhost:3000
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

Then open [http://localhost:5173](http://localhost:5173) in your browser.

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
├── client/          # React frontend (Vite)
├── server/          # Fastify backend
├── supabase/        # Database migrations and config
│   ├── config.toml  # Local Supabase configuration
│   ├── migrations/  # SQL migration files
│   └── seed.sql     # Test data for local development
└── package.json     # Root workspace config
```

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
