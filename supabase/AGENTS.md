# supabase/ — database

- `migrations/<YYYYMMDDHHMMSS>_*.sql` — schema migrations (timestamp-ordered).
- `seed.sql` — local/test seed data.
- `config.toml` — local Supabase stack config.

## Invariants

- **Migrations are immutable once merged.** Never edit or delete a migration that has landed on
  `main`. To change schema, add a **new** migration with a fresh `YYYYMMDDHHMMSS` timestamp prefix.
- **Timestamps must sort after production.** `supabase db push` refuses a migration timestamped
  before the newest one already applied (#163). Before merging a long-lived branch, rename its
  unmerged migrations so they sort after the newest migration on `main`.
- **Local vs prod.** Locally, `pnpm supabase:reset` runs a clean `supabase db reset` (drops + replays
  all migrations + seed). Prod migrations apply **via CI on push to `main`** — never run
  `supabase db push` / `supabase link` locally (denied by settings and hooks).
  `pnpm supabase:migrations:check` needs a linked project, so it only works in CI.
- **No public-exposed crypto functions.** Encryption happens in the app layer
  (`server/src/lib/sensitiveData.ts`), not via DB-exposed functions.
- **Encrypted-only sensitive data.** Seeds and migrations must not insert plaintext
  IBAN/BIC/bank name/address/DOB/phone. Sensitive columns hold `enc-v1:` ciphertext
  (`scripts/check-sensitive-seed.test.mjs` checks the seed). The seeded ciphertext is encrypted with
  the default local key; a custom local `FIELD_ENCRYPTION_KEY` must keep that key in
  `FIELD_ENCRYPTION_KEY_FALLBACKS`.
- **Seed ↔ E2E parity.** `e2e/helpers.ts` hard-codes seeded accounts and the contract signing token
  (`SEED_*` constants). Change them together with `seed.sql`;
  `scripts/check-seed-fixture-parity.test.mjs` compares the two offline.
- **Declare foreign keys you embed.** PostgREST can only embed a related table (`select("*, sepa(*)")`)
  through a declared FK. Without one, Supabase returns PGRST200 and the API answers with a generic 500.
  A `not valid` FK is enough for the embed.
- **Every new table: RLS on, plus the OAuth block.** Supabase's OAuth server issues apps (nomcp,
  the TUM.ai Notion MCP) member JWTs with a `client_id` claim, which RLS treats like the member.
  `20261102120000_mcp_oauth.sql` gave every existing RLS table this policy; a new public table
  needs it too, in the same migration that creates it:

  ```sql
  create policy "oauth_clients_blocked" on "public"."<table>" as restrictive for all to authenticated
      using ((select auth.jwt() ->> 'client_id') is null)
      with check ((select auth.jwt() ->> 'client_id') is null);
  ```

  `server/test/migrations/mcpOauthMigration.test.ts` fails otherwise (offline for later migrations,
  against the catalog with `RUN_LOCAL_SUPABASE_RLS_TESTS`). It also fails on a public table without
  RLS. App tokens may only call `public.mcp_principal()` and `public.dev_mcp_principal()`; don't
  grant them anything else.
- **`mcp_principal()` is nomcp's contract.** Its result (v2: `user_id`, `display_name`, `email`,
  `member_status`, `slack_team_ok`, `access_status`, `access_role`) and its null cases are what
  nomcp decides on. A migration that redefines it must keep them, or ship with the matching nomcp
  release. It writes (`mcp_access` requests and `last_seen_at`), so it stays `VOLATILE`.
- **dev-mcp's contract** (migration `20261109120000_dev_mcp_access.sql`, `docs/deployment.md`,
  "Dev MCP access"): `member_slack_user_id(user_id)` (the TUM.ai Slack ID), the access record of
  `dev_mcp_access_for(slack_user_id)` / `dev_mcp_access_record(user_id)` (`user_id`,
  `slack_user_id`, `display_name`, `member_status`, `slack_team_ok`, `status`, `role`, `tools`),
  and `dev_mcp_principal()` with its null cases. Change them only together with dev-mcp.
  `dev_mcp_principal()` writes (requests, `last_seen_at`), so it stays `VOLATILE`.
- **dev-mcp access changes go through `dev_mcp_apply_change` / `dev_mcp_file_request`** (service
  role only), which write the `dev_mcp_access_events` row in the same transaction and enforce the
  last-admin rule. Don't write `dev_mcp_access` or `dev_mcp_tool_grants` directly from the API.
- **OAuth token binding.** `bind_oauth_authorization(authorization_id)` (browser sessions only)
  binds an OAuth client to the RFC 8707 resource of its authorization in `mcp_client_resources`;
  `mcp_resource_settings` holds each server's resource URL (`dev_mcp`; the seed overrides it to
  `http://localhost:3000/mcp`). It reads GoTrue's `auth.oauth_authorizations`, whose columns
  belong to the auth server: re-check them when upgrading Supabase.

## RLS and migration tests

`server/test/migrations/*` run against a local stack only when `RUN_LOCAL_SUPABASE_RLS_TESTS=true`.
`localDatabase.ts` there has the psql helpers (`runInRollback`, `asRequest`); set
`SUPABASE_TEST_PROJECT_DIR` to run them against a stack started from another directory.
CI runs them in `e2e.yml` by listing each file explicitly, so a **new** RLS test file must also be
added to that command or it never runs in CI.

## Verify

- `pnpm supabase:reset` — clean reset must succeed (CI does the same when `supabase/` changes). It
  wipes all local data; if the local database holds anything beyond the seed, ask before resetting.
- After a schema change, run the relevant server tests + an E2E smoke if seeded fixtures changed.
