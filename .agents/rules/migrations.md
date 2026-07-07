---
paths: ["supabase/**"]
---

# Migration rules

- **Immutable once merged.** Never edit or delete a migration that has landed on `main`. Schema
  changes go in a **new** `migrations/<YYYYMMDDHHMMSS>_<name>.sql` with a fresh timestamp prefix.
- **Clean reset / prod push.** Locally `pnpm supabase:reset` does a clean `supabase db reset` (this is
  what CI runs — your migration must replay from scratch). Prod applies via **CI on push to `main`**;
  never run `supabase db push`/`supabase link` locally (blocked by hooks).
- **No public-exposed crypto functions.** Encryption is app-layer (`server/src/lib/sensitiveData.ts`).
- **Encrypted-only sensitive data.** No plaintext IBAN/BIC/address/DOB/phone in migrations or
  `seed.sql` — only `enc-v1:` ciphertext.
- **Seed ↔ E2E parity.** `seed.sql` must stay in sync with `e2e/fixtures` and the seed tokens
  `e2e/helpers.ts` relies on. Verify with `pnpm supabase:reset`.
