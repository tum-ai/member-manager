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

## RLS and migration tests

`server/test/migrations/*` run against a local stack only when `RUN_LOCAL_SUPABASE_RLS_TESTS=true`.
CI runs them in `e2e.yml` by listing each file explicitly, so a **new** RLS test file must also be
added to that command or it never runs in CI.

## Verify

- `pnpm supabase:reset` — clean reset must succeed (CI does the same when `supabase/` changes). It
  wipes all local data; if the local database holds anything beyond the seed, ask before resetting.
- After a schema change, run the relevant server tests + an E2E smoke if seeded fixtures changed.
