# supabase/ — database

- `migrations/<YYYYMMDDHHMMSS>_*.sql` — schema migrations (timestamp-ordered).
- `seed.sql` — local/test seed data.
- `config.toml` — local Supabase stack config.

## Invariants

- **Migrations are immutable once merged.** Never edit or delete a migration that has landed on
  `main`. To change schema, add a **new** migration with a fresh `YYYYMMDDHHMMSS` timestamp prefix.
- **Local vs prod.** Locally, `pnpm supabase:reset` runs a clean `supabase db reset` (drops + replays
  all migrations + seed). Prod migrations apply **via CI on push to `main`** — never run
  `supabase db push` / `supabase link` locally (denied by hooks).
- **No public-exposed crypto functions.** Encryption happens in the app layer
  (`server/src/lib/sensitiveData.ts`), not via DB-exposed functions.
- **Encrypted-only sensitive data.** Seeds and migrations must not insert plaintext
  IBAN/BIC/address/DOB/phone. Sensitive columns hold `enc-v1:` ciphertext.
- **Seed ↔ E2E parity.** `seed.sql` must stay in sync with `e2e/fixtures` + the seed tokens E2E
  helpers depend on. Changing one usually means changing the other.

## Verify

- `pnpm supabase:reset` — clean reset must succeed (this is what CI does).
- After a schema change, run the relevant server tests + an E2E smoke if fixtures are affected.
