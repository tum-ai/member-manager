# Deployment Guide

Production lives on **Vercel**, backed by the hosted **Supabase** project. After the private-repository cutover, production deploys are owned by the trusted GitHub Actions workflow described below. A push to `main` is eligible only after the complete CI workflow, including migrations, succeeds.

## Architecture

```
Browser
   │
   ▼
Vercel static hosting (client/dist)  ◄── uploaded as a prebuilt artifact by GitHub Actions
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

GitHub Actions
   │
   ├── CI (lint, typecheck, test, build, migrations)
   ├── Vercel Production (successful `main` push, exact CI SHA)
   └── Vercel Preview (maintainer/admin `/deploy-preview` comment, exact PR SHA)
```

Key consequence: `api/[...path].ts` imports `server/dist/*`, so **the Actions toolchain setup and `vercel build` must run before any deploy**. The deployment workflows upload the resulting `.vercel/output` directory with `vercel deploy --prebuilt`; Vercel's Git integration must not also deploy the same commit.

## Pre-deploy checklist

Do this once per environment (production, preview). Everything on this list has bitten us at least once.

### 1. Vercel environment variables

Settings → Environment Variables. Set for Production (and Preview if you want OAuth working on preview deploys). The source-of-truth key lists are [server/.env.example](../server/.env.example) and [client/.env.example](../client/.env.example); this section adds deployment-specific notes.

**Server runtime** (read by the Vercel function):

| Key | Value | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` | must use `https://` (enforced by `assertSecureRemoteUrl`) |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase dashboard | never expose to client |
| `FIELD_ENCRYPTION_KEY` | 32+ char strong random | current encryption key; see rotation procedure below |
| `FIELD_ENCRYPTION_KEY_FALLBACKS` | JSON array of old 32+ char keys | normally `[]`; temporarily populated during rotation |
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
| `CRON_SECRET` | strong random bearer secret | required for Vercel Cron calls, including contract render jobs |
| `RSVP_TARGET_EMAILS` | comma-separated target emails | required before scheduled TUM.ai Days Slack DMs are sent; `TEST_RSVP_EMAIL` can restrict to one test recipient |
| `RESEND_API_KEY` | Resend API key | required to send partner contract signing-link emails |
| `CONTRACT_EMAIL_FROM` | verified sender, e.g. `contracts@tum-ai.com` | required with `RESEND_API_KEY`; must be accepted by Resend |
| `CONTRACT_DOCX_CONVERTER_MODE` | `sandbox` | required for the production DOCX workflow; `fake` is rejected in production |
| `CONTRACT_LIBREOFFICE_SANDBOX_IMAGE` | immutable VCR image digest | required for DOCX to PDF conversion; use the pushed VCR image reference ending in `@sha256:<64 hex characters>` |
| `OPENSIGN_API_TOKEN` | OpenSign API token | required to send reviewed contracts through hosted OpenSign |
| `OPENSIGN_BASE_URL` | `https://eu-app.opensignlabs.com/api/v1.2` | optional override; set explicitly if the OpenSign account uses a different host |
| `OPENSIGN_WEBHOOK_SECRET` | strong random shared secret | required for `/api/webhooks/opensign`; must match the webhook secret configured in OpenSign |
| `OPENSIGN_WIDGETS_JSON` | JSON widget array | optional; leave unset for default signature/date placement until final template positions are verified |
| `OPENSIGN_FILE_HOSTS` | comma separated hostnames | optional; only needed when a self hosted OpenSign stores signed PDFs outside its API hostname |
| `PARTNER_PORTAL_JOBS_API_URL` | Partner Portal `/api/public/v1/jobs` URL, e.g. `https://partners.tum-ai.com/api/public/v1/jobs` | optional; enables Partner Portal jobs on the member job board and pending Partner Portal requests in the admin job queue |
| `PARTNER_PORTAL_JOBS_API_TOKEN` | shared Member Manager jobs API token | optional with the URL; must match Partner Portal `MM_API_TOKEN` for both approved-job reads and pending-request review; this is separate from `PARTNER_EXPORT_TOKEN` |
| `PARTNER_PORTAL_API_URL` | Partner Portal origin, e.g. `https://partners.tum-ai.com` | optional preferred base URL for partner management; falls back to the origin of `PARTNER_PORTAL_JOBS_API_URL` |
| `PARTNER_PORTAL_API_TOKEN` | shared Partner Portal `MM_API_TOKEN` | optional preferred partner-management token; falls back to `PARTNER_PORTAL_JOBS_API_TOKEN` |
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

### 5. Vercel Git integration and deployment ownership

Before the private-repository cutover, Vercel's Git integration may still create automatic deployments. The intended post-cutover ownership is:

- `Vercel Production` runs only after the trusted `CI` workflow succeeds for a push to `main`. It checks out `github.event.workflow_run.head_sha`, builds locally, and uploads a prebuilt production artifact.
- Immediately before the production deploy, the workflow reads the current `main` tip through the GitHub API and compares it with the CI SHA. If `main` advanced while the run was queued or building, the deployment is skipped and the Actions summary records both SHAs.
- `Vercel Preview` runs only for a newly created issue comment whose trimmed body is exactly `/deploy-preview`. The commenter must have the GitHub API `role_name` `maintain` or `admin`, the PR must be open, and the PR head repository must be `tum-ai/member-manager`. It checks out and reports the exact PR head SHA.
- Preview deployment is split across four trust boundaries: authorization resolves the PR head, a default-branch job pulls the branch-specific preview settings and uploads only `.vercel/project.json` plus `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SLACK_CALLBACK_URL`, the PR build receives that sanitized context without `VERCEL_TOKEN` or other secrets, and a final job deploys only the uploaded `.vercel/output` without checking out or executing PR code. Only these public `VITE_` values reach a preview build. The IDs in `project.json` identify the Vercel project but are not deployment credentials.
- A new PR SHA needs a new `/deploy-preview` comment. Preview deployments are not triggered by arbitrary pushes or by `pull_request_target`.
- Both workflows serialize deployments and never cancel an active deployment. Their workflow files run from the default branch, while only the authorized commit is checked out for the build.

After the Actions workflows have been verified, disconnect the project's Vercel Git integration immediately before merging the cutover change. This prevents duplicate Git-triggered builds and leaves GitHub Actions as the only production deployment path. Keep the Vercel project and domains in place.

### 6. GitHub Actions secrets (Turborepo remote cache)

CI runs `build`/`typecheck`/`lint`/`test` through Turborepo and uses Vercel's remote cache so unchanged packages are restored instead of rebuilt. The deployment workflows also require three repository secrets (**Settings → Secrets and variables → Actions**):

| Secret | Value | How to get it |
| --- | --- | --- |
| `VERCEL_TOKEN` | least-privilege Vercel deployment token | Vercel account/team token settings; rotate on expiry or suspected exposure |
| `VERCEL_ORG_ID` | Vercel team/organization ID | Vercel project link metadata (`.vercel/project.json`) |
| `VERCEL_PROJECT_ID` | Vercel project ID | Vercel project link metadata (`.vercel/project.json`) |

The workflows fail closed when any of these values is missing and never print their values. `VERCEL_TOKEN` is used only by the Vercel pull, build, and deploy steps. Keep the deployment token separate from the Turborepo cache credential.

For the optional remote cache, add two more repository secrets:

| Secret | Value | How to get it |
| --- | --- | --- |
| `TURBO_TOKEN` | a separate, expiring Vercel team access token | <https://vercel.com/account/tokens> → Create Token, **scoped to the `tum-ai` team**, with an expiry (rotate it) |
| `TURBO_TEAM` | `tum-ai` | the team's URL slug (Team Settings → General → Team URL — the `vercel.com/<slug>` part, not the display name) |

`TURBO_TOKEN` must never be reused as `VERCEL_TOKEN`, and `VERCEL_TOKEN` must never be reused as `TURBO_TOKEN`. Until the cache secrets exist, CI still runs — it simply skips remote caching.

Or via CLI:

```bash
gh secret set TURBO_TOKEN --repo tum-ai/member-manager   # paste the separate expiring team token when prompted
gh secret set TURBO_TEAM  --repo tum-ai/member-manager --body "tum-ai"
```

Safety: only pushes to `main` may **write** the shared cache (`TURBO_CACHE=remote:rw` in `ci.yml`); every PR is read-only (`remote:r`), so a branch can't poison the cache that later runs trust. Fork PRs receive no secrets and run without the cache. Scope the cache token to the team and give it an expiry — if leaked it grants Vercel team API access.

Optional — let local builds share the same cache:

```bash
pnpm exec turbo login
pnpm exec turbo link   # select the TUM-ai team
```

### Private-repository cutover

Use this sequence so the deployment owner changes without a duplicate build or a migration race:

1. Add and verify `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` in the repository Actions secrets. Add the separate `TURBO_TOKEN` and `TURBO_TEAM` only if remote caching is wanted. Confirm the token values are current, scoped to the intended team/project, and have an expiry policy.
2. Confirm the pull request's CI checks are green and review the deployment workflows. Do not merge yet.
3. Immediately before merging, disconnect the Vercel project's Git integration. This is the narrow cutover window in which no Git-triggered Vercel deployment should be allowed to race the Actions deployment.
4. Merge the cutover change into `main`. Wait for `CI` to complete successfully, then verify `Vercel Production` reports the exact `workflow_run.head_sha` and a production URL.
5. Run the post-deploy smoke checks below against the production domain. Confirm the migration parity check and the app/auth probes before treating the cutover as complete.
6. Change the GitHub repository visibility to private. GitHub Free provides only 2,000 shared Actions minutes per month, does not provide private-environment secrets, and skips CodeQL/dependency review for private repositories without paid Code Security. The Vercel deployment secrets remain repository Actions secrets, so validate them again after the visibility change.

Rollback: if the Actions deployment or smoke checks fail before the cutover is accepted, reconnect the Vercel Git integration to restore the prior deployment path, then investigate the failed SHA. Preserve migration ordering and do not treat a Vercel build as proof that the database migration or runtime probes succeeded. After recovery, repeat the cutover with fresh secret and workflow evidence.

## Field encryption and rotation

These secrets encrypt sensitive member, SEPA, and reimbursement fields before
they hit Supabase. Losing every key capable of decrypting a row makes that row
unrecoverable.

- Generate once, store in your password manager, paste into Vercel.
- Never commit it (it's gitignored via `.env` rules but double-check).
- Never use the local dev placeholder (`local-dev-only-...`) in prod.

The first enforcement migration blocks new plaintext writes while allowing
unrelated updates to legacy rows. After deploying it, backfill any legacy
plaintext:

```bash
pnpm --filter @member-manager/server backfill:encryption
```

The command performs a post-write verification across the configured keyring.
Its `plaintextBefore` count reports how many rows required cleanup, not the
remaining count. A later migration can then replace the column-specific
triggers with validated check constraints.

Rotate without downtime:

1. Generate a new 32+ character random key.
2. Set `FIELD_ENCRYPTION_KEY` to the new key and
   `FIELD_ENCRYPTION_KEY_FALLBACKS` to a JSON array containing the old key.
3. Deploy and verify existing profiles and reimbursement records still load.
4. Run `pnpm --filter @member-manager/server rotate:encryption` with the same
   environment and inspect the value-free dry-run counts.
5. Run
   `pnpm --filter @member-manager/server rotate:encryption --apply`. This
   paginates through all sensitive rows, uses compare-and-swap updates, and
   verifies the result.
6. Verify reads again, set `FIELD_ENCRYPTION_KEY_FALLBACKS=[]`, and redeploy.

## Deploying

Push to `main`. GitHub Actions first runs the complete `CI` workflow, including the `Production Supabase Migrations` job. Only a successful push-triggered CI run can start `Vercel Production`, which runs from the default-branch workflow and deploys the exact `workflow_run.head_sha`:

```bash
pnpm install                         # performed by ./.github/actions/setup
pnpm build:shared                    # performed by ./.github/actions/setup
vercel pull --yes --environment=production
vercel build --prod --token=$VERCEL_TOKEN
vercel deploy --prebuilt --prod --yes
```

The workflow pins the Vercel CLI to `59.11.2`, validates all three Vercel repository secrets, serializes production deployments, and records the target, exact SHA, and URL in the Actions summary. Keep app and schema changes backward compatible anyway. A maintainer or administrator can request a preview by adding a new `/deploy-preview` comment to an open same-repository PR; that workflow also builds and deploys a prebuilt artifact and comments the URL plus exact PR SHA.

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
