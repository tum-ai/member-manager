# Pull remote data into local Supabase (`pnpm db:pull`)

Develop against **real members** locally without disturbing production.
`pnpm db:pull` reads a snapshot of the remote project over the **service-role
API** (no database password needed) and reconstructs it in your local Supabase
Docker stack.

> The remote/production project is **only ever read** — see [Safety](#safety).

## TL;DR

```bash
# 1. Local stack must be running
pnpm supabase:start

# 2. Remote project URL + service-role key (read-only use); never commit these
export BEACON_REMOTE_SUPABASE_URL='https://<ref>.supabase.co'
export BEACON_REMOTE_SERVICE_ROLE_KEY='<service_role / secret key>'

# 3. Pull
pnpm db:pull            # asks for confirmation
# pnpm db:pull --yes    # non-interactive

# 4. Run the app
pnpm dev:local          # log in as admin@example.com / password123,
                        # or any real member's email / password123
```

Get both values from **Supabase Dashboard → Project Settings → API**:
`Project URL` and the `service_role` key (a.k.a. the Secret key). Copying a key
is a read — it changes nothing on the remote.

## Why the API (no password)

`supabase db dump` / `pg_dump` connect straight to Postgres and need the
database password (the write-only `SUPABASE_DB_PASSWORD` CI secret). The
service-role key instead authorizes the **REST** and **Auth Admin** APIs, which
is enough to read members and auth users/identities — and requires **no remote
change** (no password reset, no link).

## What it does

1. Reads remote **members** (REST) and **auth users + identities**
   (`auth.admin.listUsers`, which includes each `provider_id` — the Slack ID for
   Slack logins). Reads only.
2. Generates a **local** load SQL that mirrors
   [`supabase/seed.sql`](../supabase/seed.sql), so real `user_id`s are preserved
   and every pulled user gets the dev password `password123` (you can log in as
   a real member).
3. `supabase db reset` rebuilds the local schema from migrations.
4. Truncates `auth.users` (cascades to members/identities) and loads the
   snapshot into local (`127.0.0.1:54322`).
5. [`prepareLocalDb`](../server/src/scripts/prepareLocalDb.ts): re-encrypts the
   encrypted columns (DOB, address, phone, IBAN/BIC/bank name, reimbursement
   IBAN/BIC) with **placeholders** under your local key — so no real sensitive
   data rests on your machine — and recreates the `admin@example.com` /
   `user@example.com` login users for the local-admin bootstrap.
6. Deletes the generated SQL (holds real data) unless `--keep-dumps`.

### Flags

| Flag | Effect |
|------|--------|
| `--yes` | Skip the confirmation prompt. |
| `--skip-reset` | Don't run `supabase db reset` (schema already current). |
| `--keep-dumps` | Keep `supabase/.remote/load.sql` (gitignored) for debugging. |

## Safety

Production is **never written to**:

- The remote client issues **reads only** (`.select()`,
  `auth.admin.listUsers()`) — no write/RPC/delete calls, and no project setting
  is changed.
- The script **refuses to start** unless `BEACON_REMOTE_SUPABASE_URL` is a
  remote `https` host, and **refuses every destructive step** unless
  `LOCAL_DB_URL` is loopback on port `54322`.
- `prepareLocalDb` independently **refuses to run** unless `SUPABASE_URL` is a
  loopback host.

## Schema drift (prod-only columns)

If prod's `members` table has columns this branch's migrations don't (e.g.
`linkedin_id`, added to prod out-of-band), the pull **adds them to the local
table** with a type inferred from the data and keeps their values — nothing is
dropped. These are added during the load, not as a committed migration, so a
plain `supabase db reset` (without a pull) won't have them; they'll be
formalized into a Beacon migration in a later phase.

## What is NOT pulled

- Only `members` + `auth.users`/`auth.identities` are pulled. Other tables
  (SEPA, reimbursements, contracts, …) are reset to empty/synthetic — enough to
  browse real people; extend the table list in `scripts/pull-remote-db.mjs` if
  needed.
- **Storage objects** (CV PDFs, avatars, bug-report images) — `avatar_url` /
  CV links may 404 locally.
- Real passwords (pulled users all use `password123`) and real values of
  encrypted fields (replaced with placeholders).

## Requirements

`supabase` CLI, `psql` (`brew install libpq`), `pnpm`, a running local stack
(`pnpm supabase:start`), and `pnpm install` done (provides `@supabase/supabase-js`).

## Troubleshooting

- **"Local Supabase does not appear to be running"** → `pnpm supabase:start`.
- **`psql: command not found`** → install the Postgres client, add to PATH.
- **`listUsers`/members read fails (401/permission)** → confirm
  `BEACON_REMOTE_SERVICE_ROLE_KEY` is the **service_role / secret** key (not the
  anon/publishable key).
- **`setup:local` reports missing `ANON_KEY`/`SERVICE_ROLE_KEY`** → your newer
  CLI dropped legacy keys from `supabase status -o env`; tell me and I'll adjust.
