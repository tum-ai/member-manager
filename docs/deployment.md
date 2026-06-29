# Deployment Guide

Production lives on **Vercel**, backed by the hosted **Supabase** project. There is no bespoke infra — deployment is a `git push` to `main` once the pieces below are in place.

## Architecture

```
Browser
   │
   ▼
Vercel static hosting (client/dist)  ◄── built by `pnpm build` in the Vercel build step
   │
   │ same-origin /api/* (rewrite in vercel.json)
   ▼
Vercel Node function  (api/[...path].ts)
   │
   │ imports server/dist/app.js (Fastify)
   ▼
Hosted Supabase  (Auth, Postgres, Storage)
   ▲
   │ OAuth callback
   │
Slack app
```

Key consequence: `api/[...path].ts` imports `server/dist/*`, so **`pnpm build` must run before any deploy**. Vercel does this automatically via the workspace `build` script; don't break that.

## Pre-deploy checklist

Do this once per environment (production, preview). Everything on this list has bitten us at least once.

### 1. Vercel environment variables

Settings → Environment Variables. Set for Production (and Preview if you want OAuth working on preview deploys). The source-of-truth key lists are [server/.env.example](../server/.env.example) and [client/.env.example](../client/.env.example); this section adds deployment-specific notes.

**Server runtime** (read by the Vercel function):

| Key | Value | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` | must use `https://` (enforced by `assertSecureRemoteUrl`) |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase dashboard | never expose to client |
| `FIELD_ENCRYPTION_KEY` | 32+ char strong random | **see warning below** |
| `OPENAI_API_KEY` | OpenAI project key | optional; enables reimbursement receipt field extraction |
| `GITHUB_APP_ID` | GitHub App ID | required for in-app bug reports; app needs Issues read/write access |
| `GITHUB_APP_INSTALLATION_ID` | GitHub App installation ID | required for in-app bug reports; install the app on `tum-ai/member-manager` |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private key PEM | required unless `GITHUB_APP_PRIVATE_KEY_BASE64` is set; escaped `\\n` newlines are supported |
| `GITHUB_APP_PRIVATE_KEY_BASE64` | base64-encoded GitHub App private key PEM | optional alternative to `GITHUB_APP_PRIVATE_KEY` for hosts that dislike multiline secrets |
| `BUG_REPORT_GITHUB_REPOSITORY` | `tum-ai/member-manager` | optional; target repo for footer bug-report issues |
| `BUG_REPORT_GITHUB_LABELS` | e.g. `bug,reported-via-app` | optional; set only if these labels already exist in the repo |
| `SLACK_BOT_TOKEN` | Slack bot token | optional for workflow DMs; required for bug-report Slack notifications; app also needs channel member-read access (`channels:read` for public channels) |
| `BUG_REPORT_SLACK_CHANNEL_ID` | `C0B3YGL3XS5` | Slack channel receiving footer bug-report issue notifications; code defaults to this channel, but set explicitly in Vercel and invite the bot to the channel |
| `CORS_ORIGIN` | `https://<prod-domain>` | comma-separate if multiple; required for production, previews derive their Vercel URL automatically if unset |
| `APP_BASE_URL` | `https://<prod-domain>` | canonical app URL for Slack actions and contract signing/final PDF links |
| `SLACK_SIGNING_SECRET` | Slack signing secret | required for Slack approve / approve-and-sync interactions |
| `CRON_SECRET` | strong random bearer secret | required for Vercel Cron calls to `/api/tum-ai-days/send-pending` |
| `RSVP_TARGET_EMAILS` | comma-separated target emails | required before scheduled TUM.ai Days Slack DMs are sent; `TEST_RSVP_EMAIL` can restrict to one test recipient |
| `RESEND_API_KEY` | Resend API key | required to send partner contract signing-link emails |
| `CONTRACT_EMAIL_FROM` | verified sender, e.g. `contracts@tum-ai.com` | required with `RESEND_API_KEY`; must be accepted by Resend |
| `OPENSIGN_API_TOKEN` | OpenSign API token | required to send reviewed contracts through hosted OpenSign |
| `OPENSIGN_BASE_URL` | `https://eu-app.opensignlabs.com/api/v1.2` | optional override; set explicitly if the OpenSign account uses a different host |
| `OPENSIGN_WEBHOOK_SECRET` | strong random shared secret | required for `/api/webhooks/opensign`; must match the webhook secret configured in OpenSign |
| `OPENSIGN_WIDGETS_JSON` | JSON widget array | optional; leave unset for default signature/date placement until final template positions are verified |
| `PARTNER_PORTAL_JOBS_API_URL` | Partner Portal `/api/public/v1/jobs` URL, e.g. `https://partners.tum-ai.com/api/public/v1/jobs` | optional; enables Partner Portal jobs on the member job board and pending Partner Portal requests in the admin job queue |
| `PARTNER_PORTAL_JOBS_API_TOKEN` | shared Member Manager jobs API token | optional with the URL; must match Partner Portal `MM_API_TOKEN` for both approved-job reads and pending-request review; this is separate from `PARTNER_EXPORT_TOKEN` |
| `BUCHHALTUNGSBUTLER_SYNC_ENABLED` | `true` | required to enable live BuchhaltungsButler sync |
| `BUCHHALTUNGSBUTLER_API_CLIENT` | BuchhaltungsButler API client | required with sync enabled |
| `BUCHHALTUNGSBUTLER_API_SECRET` | BuchhaltungsButler API secret | required with sync enabled |
| `BUCHHALTUNGSBUTLER_API_KEY` | BuchhaltungsButler customer API key | required with sync enabled; ties sync to the BB account |
| `BUCHHALTUNGSBUTLER_API_BASE_URL` | `https://webapp.buchhaltungsbutler.de/api/v1` | optional override |
| `WEBSITE_RESEARCH_API_URL` | `https://www.tum-ai.com/api/getResearch` | optional override for research-project metadata; defaults to production website API |

**Client build-time** (baked into the JS bundle by `vite build`; `VITE_` prefix required):

| Key | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon key from Supabase dashboard |
| `VITE_SLACK_CALLBACK_URL` | optional fallback override; usually `https://<prod-domain>/` |

> Preview deploys get their own domain (`*.vercel.app`). The client now redirects OAuth back to `window.location.origin`, so previews return to the preview deployment automatically. For that to work, Supabase must allow the preview hostname pattern in its Redirect URLs list.

### 2. Supabase dashboard

**Authentication → URL Configuration:**

- `Site URL`: `https://<prod-domain>`
- `Redirect URLs` (allow-list): add the prod domain plus a wildcard for Vercel previews:

    ```
    https://<prod-domain>
    https://<prod-domain>/
    https://*-tum-ai.vercel.app/**
    ```

  `https://*-tum-ai.vercel.app/**` matches preview deployments like `https://member-manager-1g1lmdm6b-tum-ai.vercel.app/`.

  If the requested `redirect_to` isn't on this list, Supabase falls back to `Site URL`, which is why preview Slack logins end up on production.

**Authentication → Providers → Slack (OIDC):**

- Enabled
- Client ID / Secret from the Slack app
- Supabase shows a callback URL: `https://<project-ref>.supabase.co/auth/v1/callback` — copy it for step 3.

### 3. Slack app configuration

In the TUM.ai Slack app → OAuth & Permissions → Redirect URLs:

- Production: `https://<project-ref>.supabase.co/auth/v1/callback`
- Local (optional, if you want to test Slack login locally): `http://127.0.0.1:54321/auth/v1/callback`

Both can coexist. Preview deployments do **not** need their own Slack redirect URL when they share the same Supabase project; Slack always returns to the Supabase callback first, and Supabase then redirects the browser to the preview deployment.

### 4. Database migrations

Migrations in `supabase/migrations/` apply locally via `pnpm supabase:reset`. For the hosted project, the `Production Supabase Migrations` GitHub Actions job runs on pushes to `main`, applies unapplied migrations with `supabase db push`, and then asserts migration parity.

If local and hosted schemas drift, `/api/members` and friends will 500 in prod with DB errors. Keep schema changes in migrations and do not hand-edit production tables in Supabase Studio.

### 5. Vercel deployment checks

Vercel auto-deploys GitHub pushes: PRs become preview deployments, and pushes to `main` become production deployments. To keep production from going live before migrations finish, configure a Vercel Deployment Check:

1. In Vercel, open this project's **Settings -> Build and Deployment -> Deployment Checks**.
2. Add a **GitHub** check for the GitHub Actions check named `Production Supabase Migrations`.
3. Keep automatic production aliasing enabled.

With that check selected, Vercel may still build the production deployment immediately after the `main` push, but it will not assign it to the production domain until `Production Supabase Migrations` passes.

### 6. GitHub Actions secrets (Turborepo remote cache)

CI runs `build`/`typecheck`/`lint`/`test` through Turborepo and uses Vercel's remote cache so unchanged packages are restored instead of rebuilt. Add two repo secrets (**Settings → Secrets and variables → Actions**). Until they exist, CI still runs — it just skips remote caching, so this is optional but recommended.

| Secret | Value | How to get it |
| --- | --- | --- |
| `TURBO_TOKEN` | a Vercel access token | <https://vercel.com/account/tokens> → Create Token, **scoped to the `tum-ai` team**, with an expiry (rotate it) |
| `TURBO_TEAM` | `tum-ai` | the team's URL slug (Team Settings → General → Team URL — the `vercel.com/<slug>` part, not the display name) |

Or via CLI:

```bash
gh secret set TURBO_TOKEN --repo tum-ai/member-manager   # paste the token when prompted
gh secret set TURBO_TEAM  --repo tum-ai/member-manager --body "tum-ai"
```

Safety: only pushes to `main` may **write** the shared cache (`TURBO_CACHE=remote:rw` in `ci.yml`); every PR is read-only (`remote:r`), so a branch can't poison the cache that later runs trust. Fork PRs receive no secrets and run without the cache. Scope the token to the team and give it an expiry — if leaked it grants Vercel team API access.

Optional — let local builds share the same cache:

```bash
pnpm exec turbo login
pnpm exec turbo link   # select the TUM-ai team
```

## The `FIELD_ENCRYPTION_KEY` warning

This secret encrypts sensitive member and SEPA fields before they hit Supabase. **Rotating or losing it makes existing rows undecryptable.**

- Generate once, store in your password manager, paste into Vercel.
- Never commit it (it's gitignored via `.env` rules but double-check).
- If you suspect compromise: you need to decrypt everything with the old key, then re-encrypt with the new key. There is no automatic rotation script. Plan downtime.
- Never use the local dev placeholder (`local-dev-only-...`) in prod.

## Deploying

Push to `main`. GitHub Actions applies pending Supabase migrations in the `Production Supabase Migrations` job, while Vercel runs:

```bash
pnpm install
pnpm build        # builds client/dist AND server/dist
# then deploys client/dist as static + api/[...path].ts as a Node function
```

The Vercel Deployment Check above is required for correct production ordering. Keep app and schema changes backward compatible anyway; preview deployments still use their own Vercel URLs and may run before production migrations have landed.

For a dry run of the prod request path locally:

```bash
pnpm build
vercel dev        # exercises api/[...path].ts end-to-end
```

## Post-deploy verification

Smoke tests after each prod deploy:

```bash
# 1. Static client served
curl -sS -o /dev/null -w "%{http_code}\n" https://<prod-domain>/
# 200

# 2. Fastify function reachable + auth middleware wired
#    Proves: vercel.json rewrite + api/[...path].ts + server/dist + Supabase env all OK
curl -sS https://<prod-domain>/api/members
# {"error":"Missing Authorization header"}

# 3. Slack OIDC authorize redirects to slack.com (NOT back to the site)
curl -sSI "https://<project-ref>.supabase.co/auth/v1/authorize?provider=slack_oidc&redirect_to=https%3A%2F%2F<prod-domain>%2F" | grep -i ^location
# location: https://slack.com/openid/connect/authorize?...
```

Notes:

- There is no `/api/health` endpoint. Fastify registers `/health` at the server root, but `vercel.json` only rewrites `/api/*` to the function, so `/health` isn't exposed publicly. The `/api/members` 401 is the canonical liveness probe instead.
- If #3 redirects back to `<prod-domain>` instead of `slack.com`, the requested `redirect_to` isn't whitelisted in Supabase — fix it in step 2 of the pre-deploy checklist above.

## What's intentionally not production-bound

To avoid confusion: these files are **local-only** and have no production effect, even though they ship in the git bundle.

- `supabase/config.toml` — only read by the `supabase` CLI (local)
- `supabase/seed.sql` — only run by `supabase db reset` (local)
- `scripts/*` — dev utilities, never invoked by Vercel
- `client/vite.config.ts` `server.host: true` — Vite dev-server option; the prod build is static
- `client/.env.local`, `server/.env.local`, `supabase/.env.local` — gitignored, not in the Vercel bundle
