# Development Guide

Things that aren't obvious from reading the code. Read this before your first bug.

## Environment file precedence

The server and client both use a **Vite-style dotenv chain**:

| Layer | File | Overrides process env? | Git tracked? |
| --- | --- | --- | --- |
| 1 (lowest) | platform env (Vercel, your shell) | — | — |
| 2 | `.env` | no (fills gaps only) | no (gitignored) |
| 3 (highest) | `.env.local` | yes | no (gitignored) |
| override | `DOTENV_CONFIG_PATH=<path>` | yes, replaces the chain | — |

Implications:

- In dev with local Supabase running, `.env.local` wins → `pnpm setup:local` is the source of truth.
- In dev with the hosted Supabase project, leave `.env.local` absent; `.env` fills the blanks.
- In prod on Vercel, the `.env*` files don't exist in the bundle (gitignored, not deployed), so platform env vars win unconditionally. This is intentional prod-safety — do **not** commit `.env`.

Server-side loader lives at `server/src/lib/loadEnv.ts`. The client side uses Vite's built-in behavior (same precedence).

## Optional receipt extraction

The reimbursement tool can pre-fill amount, date, description, IBAN, and BIC from an uploaded receipt. Set `OPENAI_API_KEY` in `server/.env.local` or `server/.env` to enable it locally.

If `OPENAI_API_KEY` is absent, uploads still work: the receipt stays attached and the user fills the editable fields manually.

`POST /api/reimbursements/process-receipt` normalizes uploaded receipt payloads before submission. PDFs are returned as raw base64; JPG/PNG images are wrapped into a single-page PDF; filenames follow `DDMMYY_Name_Identifier.pdf` with `Expense` as the no-OpenAI fallback identifier.

Submitted reimbursement and invoice requests appear in the Finance Review queue for active Legal & Finance members and admins. If `SLACK_BOT_TOKEN` is set, those reviewers also receive a Slack DM. Approval, rejection, and paid status changes DM the requester by their Supabase auth email. Without Slack configuration, the queues and in-app statuses remain the source of truth.

The subtle footer "Report a bug" action posts authenticated bug reports to Slack via `POST /api/bug-reports`. Set `SLACK_BOT_TOKEN` and, optionally, `BUG_REPORT_SLACK_CHANNEL_ID` to override the default Member Manager bug-report channel (`C0B3YGL3XS5`). The Slack bot must be invited to that channel. The report includes the signed-in user, current page, browser user agent, and the user's note.

Finance review responses include receipt view/download URLs but never the raw `receipt_base64` payload. Reviewers can open `GET /api/reimbursements/review/:requestId/receipt` inline or add `?download=1` for an attachment response.

Finance reviewers can also call `GET /api/reimbursements/summary` for dashboard essentials: total requests, total amount, pending approvals, approved-but-unpaid count, and paid amount for the current month.

## BuchhaltungsButler sync

Approved reimbursement and invoice requests can be synced to BuchhaltungsButler from Finance Review. The sync uploads the stored receipt to `POST /receipts/upload` as `invoice inbound`, sends amount/date/currency metadata, stores BuchhaltungsButler's `id_by_customer`, and adds a traceability comment with the Member Manager request ID. It does not create BuchhaltungsButler transactions by default to avoid duplicate bank-import entries.

Set these server env vars to enable live sync:

```bash
BUCHHALTUNGSBUTLER_SYNC_ENABLED=true
BUCHHALTUNGSBUTLER_API_CLIENT=
BUCHHALTUNGSBUTLER_API_SECRET=
BUCHHALTUNGSBUTLER_API_KEY=
# optional; defaults to https://webapp.buchhaltungsbutler.de/api/v1
BUCHHALTUNGSBUTLER_API_BASE_URL=
```

Slack reimbursement notifications use Block Kit buttons when `APP_BASE_URL` is set, `SLACK_BOT_TOKEN` is available, and the Slack app has `chat:write`, `users:read`, `users:read.email`, and `im:write` scopes. Configure Slack interactivity to post to `/api/slack/interactions` and set `SLACK_SIGNING_SECRET` so the server can verify `X-Slack-Signature` before accepting approve / approve-and-sync button clicks.

See `docs/buchhaltungsbutler-sync.md` for the API research and design notes.

## `pnpm dev` vs `pnpm dev:local`

Same dev server, different Supabase backend:

| Command | Supabase | How env is wired |
| --- | --- | --- |
| `pnpm dev` | whichever `SUPABASE_URL` resolves (usually the **hosted** project from `.env`) | `.env` fills gaps; `.env.local` overrides if present |
| `pnpm dev:local` | **local** Dockerized Supabase at `http://127.0.0.1:54321` | runs `supabase start` + `setup:local` first, then starts dev servers reading freshly written `.env.local` files |

Rule of thumb: use `pnpm dev:local` unless you have a specific reason to hit the shared hosted project (e.g. reproducing a prod-data bug). If you hit "Invalid token" on `/api/*`, you probably have the wrong `SUPABASE_URL` on the server side — the JWT has to be validated against the same Supabase instance that issued it.

The local API defaults to `http://127.0.0.1:8787` and Vite proxies `/api` there through `VITE_API_PROXY_TARGET`. Ports `3000` and `3001` are intentionally avoided because they are commonly occupied by other local apps; if `/api/*` returns a Next.js 404, restart with `pnpm dev:local` so the generated `.env.local` files point Vite at the member-manager API.

## Slack OIDC locally

Local Slack login is **optional**. Skip this section if email/password is enough.

1. Copy `supabase/.env.example` → `supabase/.env.local`, fill in Slack Client ID and Secret from the TUM.ai Slack app.
2. In the Slack app's "Redirect URLs", ensure `http://127.0.0.1:54321/auth/v1/callback` is present.
3. Restart the stack: `pnpm supabase:stop && pnpm supabase:start`.

The wrapper script `scripts/supabase-start.mjs` loads `supabase/.env.local` into the CLI's environment before spawning, so the `env(...)` refs in `supabase/config.toml` resolve. The raw `supabase start` CLI does **not** do this — always go through the pnpm script.

**The redirect-URL trailing-slash trap (GoTrue):** `additional_redirect_urls` in `supabase/config.toml` is matched *exactly*, including trailing slash. The app asks for `http://localhost:5173/` but with only `http://localhost:5173` whitelisted, GoTrue silently falls back to `site_url` and you get mysterious redirects. The committed `config.toml` already lists all four variants (`localhost`/`127.0.0.1`, with/without `/`) — keep it that way if you touch it.

## macOS DNS cache + paused Supabase projects

Symptom: `curl`, Firefox, and Node hang or return "Server Not Found" for `<project>.supabase.co`, but `dig <project>.supabase.co` resolves fine.

Cause: `mDNSResponder` cached a negative result while the project was paused.

Fix:

```bash
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
# Firefox also has its own DNS cache: about:networking#dns → "Clear DNS Cache"
```

## Seed data quirks

`supabase/seed.sql` inserts `auth.users` rows with explicit empty strings for `confirmation_token`, `recovery_token`, `email_change_token_new`, `email_change`. **Don't "clean that up"** — GoTrue's Go driver scans these nullable VARCHAR columns as plain strings and crashes with `converting NULL to string is unsupported` on login. There are also matching `auth.identities` rows, which newer GoTrue versions require for email auth to find the user.

Re-apply after edits: `pnpm supabase:reset`.

## Testing layout

Three test runners, each in its natural place:

| Runner | Where | What |
| --- | --- | --- |
| `node --test` | `scripts/*.test.mjs` | Plain JS dev scripts (env generator, supabase-start wrapper) |
| `tsx --test` | `server/test/**/*.test.ts` | Fastify routes, middleware, encryption, unit helpers |
| Vitest | `client/src/**/__tests__/*` | React components and hooks |

Run all: `pnpm test`. Run one workspace: `pnpm --filter @member-manager/server test` or `pnpm --filter @member-manager/client test`.

Verification tests that hit a running local stack live in `scripts/verify-*.test.mjs`. They skip silently if Supabase isn't reachable, so they're safe to run by default.

## Local hooks and full gate

Install the repo-managed Git hook once:

```bash
pnpm hooks:install
```

This writes `.git/hooks/pre-commit`, which runs a fast staged-file Biome check:

```bash
pnpm lint:staged
```

The installer is intentionally conservative: it refuses to overwrite a custom existing `pre-commit` hook. If it finds the previous repo-managed full-gate `pre-push` hook, it disables it by moving it to `.git/hooks/pre-push.member-manager-full-gate.disabled`; custom `pre-push` hooks are left untouched.

The full merge gate remains:

```bash
pnpm gate
```

That expands to:

```bash
pnpm lint && pnpm test && pnpm build
```

Run `pnpm gate` manually before PRs, deploys, or risky changes. CI runs the full gate for pull requests and pushes to `main`.

## Schema migrations

- Local: add SQL files to `supabase/migrations/` (timestamp-prefixed), then `pnpm supabase:reset` to re-apply the full chain against a fresh DB.
- Hosted: apply migrations to the production project with `supabase db push` against the linked project. Do **not** hand-edit tables in Studio — migrations are append-only history and must round-trip.

## Sensitive-data fields

The server encrypts certain columns before insert (`server/src/lib/sensitiveData.ts` has the full list). Relevant consequences:

- You can't SELECT decrypted values directly in Studio — they look like hex.
- Changing `FIELD_ENCRYPTION_KEY` orphans all existing rows. See the deployment guide for rotation warnings.
- If an older environment still has plaintext rows, run `pnpm --filter @member-manager/server backfill:encryption` once.

## The Vercel function wrapper

`api/[...path].ts` is the Vercel entry point. It imports from `server/dist/app.js` (the built output), **not** `server/src/app.ts`. So:

- Always run `pnpm build` before `vercel deploy` or before debugging the prod function locally with `vercel dev`.
- Changes to server code require a rebuild to show up via the Vercel function path. (Plain `pnpm dev:local` bypasses this and uses `tsx watch` directly.)

## Common failure modes (and first thing to check)

| Symptom | First suspect |
| --- | --- |
| `Invalid token` on `/api/*` | Server `SUPABASE_URL` mismatched with the issuer of the JWT (wrong dev mode?) |
| Client hangs minutes on boot | `SUPABASE_URL` unreachable; check `.env` files and DNS cache |
| Slack login redirects back to site instead of Slack | `additional_redirect_urls` missing the exact URL (trailing-slash trap) |
| `MemberList` stuck on spinner / error card | `/api/members` 401 or 500 — curl it with a Bearer token, check server logs |
| `converting NULL to string is unsupported` in GoTrue | Don't touch the empty-string columns in `seed.sql` |
| Vercel deploy 500s but local works | Forgot `pnpm build`, or Vercel env vars missing/wrong |
