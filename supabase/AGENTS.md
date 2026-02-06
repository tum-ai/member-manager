# Supabase/AGENTS.md

Purpose
- Package-specific guidance for Supabase configuration, migrations, and local development.

Quick facts
- Config: `supabase/config.toml`
- Migrations: `supabase/migrations/` (timestamped SQL files)
- Seed data: `supabase/seed.sql`

Commands (root)
- Start local: `pnpm supabase:start`
- Stop local: `pnpm supabase:stop`
- Reset DB: `pnpm supabase:reset` (wipes DB, applies migrations and seed)
- Sync with prod: `supabase link` then `supabase db pull`

Migration & Schema Rules
- **System Triggers**: `supabase db pull` sometimes captures internal storage triggers (e.g., `storage.delete_prefix_hierarchy_trigger`) that fail locally. Remove these from migration files if they cause errors.
- **RLS Policies**: Always include RLS policies. Soft-delete via `active` boolean is preferred over hard deletes.
- **Production Sync**: To reflect prod state, rename/backup existing migrations and run `supabase db pull`.

Seeding Rules
- **Search Path**: `seed.sql` runs with a restricted `search_path`.
  - ALWAYS fully qualify extension functions: use `extensions.crypt()` and `extensions.gen_salt()` instead of just `crypt()`.
  - ALWAYS fully qualify table names: `public.members`, `auth.users`.

Local Development
- **Environment**: `.env.local` files are NOT committed. They must be manually created using credentials from `pnpm supabase:status` (or `start` output).
- **Docker**: Requires Docker to be running.
