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

Settings → Environment Variables. Set for Production (and Preview if you want OAuth working on preview deploys).

**Server runtime** (read by the Vercel function):

| Key | Value | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` | must use `https://` (enforced by `assertSecureRemoteUrl`) |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase dashboard | never expose to client |
| `FIELD_ENCRYPTION_KEY` | 32+ char strong random | **see warning below** |
| `CORS_ORIGIN` | `https://<prod-domain>` | comma-separate if multiple |

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

Migrations in `supabase/migrations/` only apply locally via `pnpm supabase:reset`. For the hosted project:

```bash
supabase link --project-ref <project-ref>   # one-time
supabase db push                            # applies any un-applied migrations
```

If local and hosted schemas drift, `/api/members` and friends will 500 in prod with DB errors. Keep them in sync.

## The `FIELD_ENCRYPTION_KEY` warning

This secret encrypts sensitive member and SEPA fields before they hit Supabase. **Rotating or losing it makes existing rows undecryptable.**

- Generate once, store in your password manager, paste into Vercel.
- Never commit it (it's gitignored via `.env` rules but double-check).
- If you suspect compromise: you need to decrypt everything with the old key, then re-encrypt with the new key. There is no automatic rotation script. Plan downtime.
- Never use the local dev placeholder (`local-dev-only-...`) in prod.

## Deploying

Push to `main`. Vercel runs:

```bash
pnpm install
pnpm build        # builds client/dist AND server/dist
# then deploys client/dist as static + api/[...path].ts as a Node function
```

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
