# Deployment Guide

Production lives on **Vercel**, backed by the hosted **Supabase** project. Since #337 (2026-09-06), GitHub Actions owns every deployment: a push to `main` deploys only after the complete CI workflow, including migrations, succeeds, and PR previews deploy only on a maintainer's `/deploy-preview` comment. Vercel's Git integration no longer deploys. CI itself is described in [ci.md](./ci.md).

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
| `BUG_REPORT_GITHUB_REPOSITORY` | `tum-ai/member-manager` | optional; target repo for footer bug-report issues (or set `BUG_REPORT_GITHUB_OWNER` + `BUG_REPORT_GITHUB_REPO`) |
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
| `CONTRACT_LEGAL_EMAIL` | legal team address | optional; receives contract status-change notifications. When unset, only the contract creator is notified |
| `CONTRACT_DOCX_CONVERTER_MODE` | `sandbox` | required for the production DOCX workflow; `fake` is rejected in production |
| `CONTRACT_LIBREOFFICE_SANDBOX_IMAGE` | immutable VCR image digest | required for DOCX to PDF conversion; use the pushed VCR image reference ending in `@sha256:<64 hex characters>` |
| `CONTRACT_LIBREOFFICE_SANDBOX_SNAPSHOT_ID` | Vercel Sandbox snapshot ID | optional; **takes precedence over the image** and skips the digest check, so leave unset unless you deliberately run from a snapshot (see [infra/libreoffice](../infra/libreoffice/README.md)) |
| `OPENSIGN_API_TOKEN` | OpenSign API token | required to send reviewed contracts through hosted OpenSign |
| `OPENSIGN_BASE_URL` | `https://eu-app.opensignlabs.com/api/v1.2` | optional override; set explicitly if the OpenSign account uses a different host |
| `OPENSIGN_WEBHOOK_SECRET` | strong random shared secret | required for `/api/webhooks/opensign`; must match the webhook secret configured in OpenSign |
| `OPENSIGN_WIDGETS_JSON` | JSON widget array | optional; leave unset for default signature/date placement until final template positions are verified |
| `OPENSIGN_FILE_HOSTS` | comma separated hostnames | optional; only needed when a self hosted OpenSign stores signed PDFs outside its API hostname |
| `PARTNER_PORTAL_JOBS_API_URL` | Partner Portal `/api/public/v1/jobs` URL, e.g. `https://partners.tum-ai.com/api/public/v1/jobs` | optional; enables Partner Portal jobs on the member job board and pending Partner Portal requests in the admin job queue |
| `PARTNER_PORTAL_JOBS_API_TOKEN` | shared Member Manager jobs API token | optional with the URL; must match Partner Portal `MM_API_TOKEN` for both approved-job reads and pending-request review; this is separate from `PARTNER_EXPORT_TOKEN` |
| `PARTNER_PORTAL_API_URL` | Partner Portal origin, e.g. `https://partners.tum-ai.com` | optional preferred base URL for partner management; falls back to the origin of `PARTNER_PORTAL_JOBS_API_URL` |
| `PARTNER_PORTAL_API_TOKEN` | shared Partner Portal `MM_API_TOKEN` | optional preferred partner-management token; falls back to `PARTNER_PORTAL_JOBS_API_TOKEN` |
| `PARTNER_EXPORT_TOKEN` | strong random bearer secret | authorizes the internal CV export endpoint the Partner Portal calls; separate from the jobs token |
| `DEV_MCP_SERVICE_TOKEN` | strong random bearer secret (`openssl rand -base64 48`) | shared with dev-mcp in both directions: dev-mcp presents it to `/api/internal/dev-mcp/*`, member-manager sends it to dev-mcp's `/service/catalog`. Unset, the service API answers 401 and the Dev tab can't approve. See [Dev MCP access](#dev-mcp-access) |
| `DEV_MCP_URL` | dev-mcp's base URL, e.g. `https://tumai-dev-mcp.vercel.app` | where the tool catalog for the Dev tab of `/admin/mcp-access` comes from |
| `BUCHHALTUNGSBUTLER_SYNC_ENABLED` | `true` | required to enable live BuchhaltungsButler sync |
| `BUCHHALTUNGSBUTLER_API_CLIENT` | BuchhaltungsButler API client | required with sync enabled |
| `BUCHHALTUNGSBUTLER_API_SECRET` | BuchhaltungsButler API secret | required with sync enabled |
| `BUCHHALTUNGSBUTLER_API_KEY` | BuchhaltungsButler customer API key | required with sync enabled; ties sync to the BB account |
| `BUCHHALTUNGSBUTLER_API_BASE_URL` | `https://webapp.buchhaltungsbutler.de/api/v1` | optional override |
| `BUCHHALTUNGSBUTLER_POSTINGS_USE_REAL_API` | `true` | required in production for the read-only finance postings route; without it the route fails closed |
| `WEBSITE_RESEARCH_API_URL` | `https://www.tum-ai.com/api/getResearch` | optional override for research-project metadata; defaults to production website API |

**Never set in production:** `ENABLE_LOCAL_ADMIN_BOOTSTRAP` and `LOCAL_ADMIN_EMAILS` enable the local-only admin bootstrap and the local bug-report stubs.

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

**Authentication → OAuth Server (nomcp, dev-mcp):** see [OAuth server (MCP servers)](#oauth-server-mcp-servers)
below. It stays off until its migration is live.

### 3. Slack app configuration

In the TUM.ai Slack app → OAuth & Permissions → Redirect URLs:

- Production: `https://<project-ref>.supabase.co/auth/v1/callback`
- Local (optional, if you want to test Slack login locally): `http://127.0.0.1:54321/auth/v1/callback`

Both can coexist. Preview deployments do **not** need their own Slack redirect URL when they share the same Supabase project; Slack always returns to the Supabase callback first, and Supabase then redirects the browser to the preview deployment.

### 4. Database migrations

Migrations in `supabase/migrations/` apply locally via `pnpm supabase:reset`. For the hosted project, the `Production Supabase Migrations` GitHub Actions job runs on pushes to `main`, applies unapplied migrations with `supabase db push`, and then asserts migration parity.

If local and hosted schemas drift, `/api/members` and friends will 500 in prod with DB errors. Keep schema changes in migrations and do not hand-edit production tables in Supabase Studio.

### 5. Deployment ownership (GitHub Actions)

GitHub Actions owns both deployment paths:

- `Vercel Production` runs only after the trusted `CI` workflow succeeds for a push to `main`. It checks out `github.event.workflow_run.head_sha`, builds locally, and uploads a prebuilt production artifact.
- Immediately before the production deploy, the workflow reads the current `main` tip through the GitHub API and compares it with the CI SHA. If `main` advanced while the run was queued or building, the deployment is skipped and the Actions summary records both SHAs.
- `Vercel Preview` runs only for a newly created issue comment whose trimmed body is exactly `/deploy-preview`. The commenter must have the GitHub API `role_name` `maintain` or `admin`, the PR must be open, and the PR head repository must be `tum-ai/member-manager`. It checks out and reports the exact PR head SHA.
- Preview deployment is split across four trust boundaries: authorization resolves the PR head, a default-branch job pulls the branch-specific preview settings and uploads only `.vercel/project.json` plus `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SLACK_CALLBACK_URL`, the PR build receives that sanitized context without `VERCEL_TOKEN` or other secrets, and a final job deploys only the uploaded `.vercel/output` without checking out or executing PR code. Only these public `VITE_` values reach a preview build. The IDs in `project.json` identify the Vercel project but are not deployment credentials.
- A new PR SHA needs a new `/deploy-preview` comment. Preview deployments are not triggered by arbitrary pushes or by `pull_request_target`.
- Both workflows serialize deployments and never cancel an active deployment. Their workflow files run from the default branch, while only the authorized commit is checked out for the build.

The project's Vercel Git integration is disconnected (its last Git-triggered deployment was on 2026-09-02). Keep it that way: a reconnected integration would build every push in parallel with, and possibly ahead of, the CI-gated Actions deploy. The Vercel project and domains stay in place.

To see which commit is live: `gh run list --workflow "Vercel Production" --limit 1`.

### 6. GitHub Actions secrets

The production migration jobs in `ci.yml` need `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, and `SUPABASE_PROJECT_REF` for the hosted project. CI runs `build`/`typecheck`/`lint`/`test` through Turborepo and can use Vercel's remote cache so unchanged packages are restored instead of rebuilt. The deployment workflows require three repository secrets (**Settings → Secrets and variables → Actions**):

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

**Status (2026-09-25):** steps 1–5 are done (#337; Actions has deployed production since). Step 6 is still open: the repository is **public**. Until it changes, treat every pushed branch as public.

The original sequence, kept for reference and for step 6:

1. Add and verify `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` in the repository Actions secrets. Add the separate `TURBO_TOKEN` and `TURBO_TEAM` only if remote caching is wanted. Confirm the token values are current, scoped to the intended team/project, and have an expiry policy.
2. Confirm the pull request's CI checks are green and review the deployment workflows. Do not merge yet.
3. Immediately before merging, disconnect the Vercel project's Git integration. This is the narrow cutover window in which no Git-triggered Vercel deployment should be allowed to race the Actions deployment.
4. Merge the cutover change into `main`. Wait for `CI` to complete successfully, then verify `Vercel Production` reports the exact `workflow_run.head_sha` and a production URL.
5. Run the post-deploy smoke checks below against the production domain. Confirm the migration parity check and the app/auth probes before treating the cutover as complete.
6. Change the GitHub repository visibility to private. GitHub Free provides only 2,000 shared Actions minutes per month, does not provide private-environment secrets, and skips CodeQL/dependency review for private repositories without paid Code Security. The Vercel deployment secrets remain repository Actions secrets, so validate them again after the visibility change.

Rollback: if the Actions deployment or smoke checks fail before the cutover is accepted, reconnect the Vercel Git integration to restore the prior deployment path, then investigate the failed SHA. Preserve migration ordering and do not treat a Vercel build as proof that the database migration or runtime probes succeeded. After recovery, repeat the cutover with fresh secret and workflow evidence.

## OAuth server (MCP servers)

Members connect their AI agents (claude.ai, ChatGPT, Claude Code, Cursor) to two TUM.ai MCP
servers, and sign in to both with their member-manager account:

- **nomcp** (the private repo `tum-ai/nomcp`), the TUM.ai Notion MCP gateway;
- **dev-mcp** (`tum-ai/dev-mcp`), Dev Claude's tools (mailboxes, GitHub invites, Notion pages).
  Dev Claude itself keeps using its own run tokens; see [Dev MCP access](#dev-mcp-access).

Supabase Auth's OAuth 2.1 server (beta) is the authorization server, and member-manager's
`/oauth/consent` page is where a member approves an app. Members see and disconnect approved apps
under `/connected-apps` (account menu → Connected apps).

A token Supabase issues to an app is a normal member JWT with an extra `client_id` claim.
member-manager refuses such tokens: the `oauth_clients_blocked` RLS policies hide every row from
them, and `authenticate` answers 401. The only things they can call are `rpc/mcp_principal`, which
nomcp calls to learn who the member is, and `rpc/dev_mcp_principal`, its dev-mcp counterpart. All
of this comes from migration `20261102120000_mcp_oauth.sql` and the matching API change, so the
order below matters.

1. **Wait until the migration is live in production.** The `Production Supabase Migrations` job on
   `main` must have applied `20261102120000`. Until then, an app token could read member data as
   the member.
2. **Turn off password sign-in.** Authentication → Providers → Email: disable it (production
   sign-in is Slack only). An app token can call `PUT /auth/v1/user` and set the member's password;
   with email sign-in enabled, that password then opens a full session as the member. This was
   checked against the local auth server. It stays a prerequisite: the client allowlist below
   doesn't change it.
3. **Authentication → OAuth Server:**
   - Enable the OAuth server.
   - Authorization Path: `/oauth/consent`. Supabase sends members to `Site URL` + this path, so
     `Site URL` must be the production domain.
   - Allow dynamic client registration: on. MCP clients register themselves; the consent page
     only lets members approve the clients on the allowlist below.
4. **Check discovery:**
   `curl https://<project-ref>.supabase.co/auth/v1/.well-known/oauth-authorization-server` returns
   the issuer, `registration_endpoint` and `code_challenge_methods_supported: ["S256", …]`.

Asymmetric JWT signing keys (JWT Keys → ES256/RS256) are only needed for the `openid` scope (ID
tokens). nomcp uses access tokens only.

To switch it off, disable the OAuth server. Tokens it already issued stay valid until they expire
(`jwt_expiry`, 1 h), so revoke an app from `/connected-apps` (or delete its sessions) if it must
lose access at once.

### Approved MCP clients

The consent page only lets a member approve an app whose redirect URI belongs to a supported MCP
client. For every other app it shows "This app isn't an approved TUM.ai MCP client" with only a
Deny button. It records the denial without sending the member to that address. It also refuses to
follow a redirect that Supabase auto-approved from an earlier consent to an unapproved address.

| Allowed redirect | For |
| --- | --- |
| `https://` on `claude.ai`, `claude.com`, `chatgpt.com`, `openai.com` (subdomains included) | claude.ai and Claude Desktop, ChatGPT |
| `http://` or `https://` on `localhost`, `127.0.0.1`, `[::1]`, any port | Claude Code, the MCP Inspector, other CLI clients |
| `cursor://`, `vscode://`, `vscode-insiders://`, `windsurf://` | Cursor, VS Code, Windsurf |

**Why it exists.** Supabase's access tokens carry `aud: "authenticated"` and no resource
indicator, so nomcp can't tell whether a token was meant for it. Dynamic client registration is
open, so anyone can register an app under a trusted-sounding name ("TUM.ai Event RSVP") with their
own redirect URI. If a member approved it, the code, and with it an access and refresh token,
would go to that site, which could replay them at nomcp and edit TUM.ai's Notion as the member.
The app's name is the attacker's choice, but the redirect URI is not: the code only ever goes
there. So the consent page shows the address first and checks it against the list. Supabase has no
server-side setting for this: the auth server's OAuth options are only `enabled`, the authorization
path, dynamic registration, and the default scope (checked in gotrue v2.197.0 and the CLI).

**Adding a client.** Edit `APPROVED_MCP_CLIENT_REDIRECTS` in
`client/src/features/oauth/oauthUtils.ts`, add cases to `oauthUtils.test.ts`, and update the table
above. Only add an https domain the client's vendor controls end to end, or the client's own URL
scheme, never a site where other people can publish content. Check the redirect URI the client
actually uses first, e.g. with the MCP Inspector or by reading the authorize URL it opens.
Example: VS Code may use `https://vscode.dev/redirect`, which isn't on the list.

**Server-side option (not built).** Turning dynamic registration off and registering each
supported client by hand would enforce the same rule in Supabase. Not every MCP client can use a
pre-registered client ID, though.

### One server per app (token binding)

Supabase's tokens name no audience, so without more, a token a member's app got for nomcp would
also work at dev-mcp. MCP clients send the server they connect to as the RFC 8707 `resource`
parameter. GoTrue validates it and stores it in `auth.oauth_authorizations.resource`, but doesn't
show it to the consent page, doesn't put it in the token, and deletes the row once the code is
exchanged (checked on 2026-11-09). So member-manager binds each OAuth client to one resource:

- Before approving, and before following the redirect of an app the member approved earlier, the
  consent page calls `rpc/bind_oauth_authorization` with the authorization ID (the member's browser
  session, never an app token). The function reads the client and resource of that member's
  authorization from GoTrue's table and records `client_id → resource` in
  `public.mcp_client_resources`. Binding the same client to the same resource again is fine.
- If the client is already bound to another resource, it raises an error. The page shows it ("This
  app is already connected to another TUM.ai server. Add it again in your AI app for this one.")
  and neither approves nor redirects. MCP clients register one client per server, so adding the
  server again gives a fresh client.
- An authorization without a `resource` (a client older than the June 2025 MCP spec) binds
  nothing and doesn't fail, so such a client keeps working with nomcp. dev-mcp refuses it.
- `dev_mcp_principal()` answers only for a client bound to dev-mcp's resource URL
  (`public.mcp_resource_settings`, key `dev_mcp`; the migration seeds
  `https://tumai-dev-mcp.vercel.app/mcp`, `supabase/seed.sql` sets `http://localhost:3000/mcp`). Change
  it in SQL only, and only together with dev-mcp's `PUBLIC_BASE_URL`; the value must equal the
  `resource` in dev-mcp's RFC 9728 metadata, character for character.
- nomcp doesn't check the binding yet, so a dev-mcp token still works at nomcp (the lower-risk
  direction). Enforcing it there is a change to nomcp's contract.

Clients connected before the binding existed have none, so dev-mcp refuses them until they
connect again; nomcp is unaffected. A client that sends no `resource` can't be approved at all
any more, for either server.

### Access approval

Members don't get nomcp access automatically: an admin approves each one, as a `reader` (search
and read) or an `editor` (also create, edit and comment).

- **Where:** Administration → MCP Access (`/admin/mcp-access`), Notion tab. Pending requests come
  first (approve as reader or editor, or deny), then approved members (change the role, or
  revoke), then declined ones (approve again). Denying and revoking ask for confirmation and take
  an optional note that only admins see. Each entry shows when the member last used nomcp and with
  which app.
- **How a request appears:** the first time an active member of the TUM.ai Slack workspace
  connects an AI app, nomcp calls `mcp_principal()`, which files a `pending` row in
  `public.mcp_access`. Inactive members, alumni and other workspaces get no row; nomcp refuses
  them anyway.
- **What members see:** `/connected-apps` shows "Notion MCP access: waiting for approval",
  "approved as editor" (or reader), "declined", or "not requested yet".
- **When a decision takes effect:** nomcp caches `mcp_principal()` per token for about a minute,
  so approvals, role changes and revocations apply within a minute.
- **Admins:** everyone who was an admin when migration `20261102180000_nomcp_access_approval.sql`
  ran was approved as an editor. New admins file a request like anyone else and can approve
  themselves.

**Release order.** `mcp_principal()` contract v2 adds `access_status` (`pending`, `approved` or
`denied`) and `access_role` (`reader` or `editor` while approved, otherwise `null`). The migration
must be live in production before the nomcp release that reads these fields; the old function
doesn't return them. The function is now `VOLATILE` because it writes (the pending row, and
`last_seen_at` with the last client at most once a minute), so PostgREST runs
`POST /rest/v1/rpc/mcp_principal` read-write. Change the contract only together with nomcp.

## Dev MCP access

dev-mcp (`tum-ai/dev-mcp`) is the MCP server behind Dev Claude. It keeps enforcing everything
(roles, its code policy `src/access/policy.ts`, confirmations and approval requests in Slack); only
the data behind "who may use it, with which role and tools" lives here, in
`public.dev_mcp_access`, `public.dev_mcp_tool_grants` and the append-only
`public.dev_mcp_access_events` (migration `20261109120000_dev_mcp_access.sql`). Runtime tool
switches (`tool_settings`, a kill switch per tool for everyone) stay in dev-mcp.

- **Where:** Administration → MCP Access, Dev tab (`/admin/mcp-access?tab=dev`). Requests can be
  approved as member, lead or admin, which grants that role's preset: every tool the role may run,
  except destructive ones. Active members can change role (a demotion drops grants the new role
  doesn't allow), have their tools edited (only tools the role allows; destructive ones are flagged)
  or be suspended. Suspended and declined members can be approved again. Suspending and denying ask
  for confirmation and take an admin-only note. Nobody can remove the last active admin.
- **The tool catalog** comes from dev-mcp (`GET <DEV_MCP_URL>/service/catalog`, Bearer
  `DEV_MCP_SERVICE_TOKEN`), cached for a minute. While dev-mcp can't be reached the tab says so;
  approving and changing roles or tools need it, suspending and denying don't.
- **How a request appears:** Dev Claude's "request access" calls the service API below, and the
  first OAuth use by an active member of the TUM.ai Slack workspace files one through
  `dev_mcp_principal()`.
- **What members see:** `/connected-apps` shows "Dev MCP access: …" next to the Notion status.
- **When a change applies:** dev-mcp caches answers for up to a minute.

Every change goes through `dev_mcp_apply_change` or `dev_mcp_file_request` (service role only),
which write the event row in the same transaction and re-check the status, the role and the
last-admin rule under a lock.

### Contract with dev-mcp

Members are identified by their TUM.ai Slack user ID, `public.member_slack_user_id(user_id)`: the
`slack_oidc` identity of team `T01288YLP16`,
`coalesce(identity_data->'custom_claims'->>'https://slack.com/user_id', identity_data->>'sub')`,
only if it matches `^[UW][A-Z0-9]{2,20}$`.

The **access record** (`public.dev_mcp_access_for(slack_user_id)`, the same shape everywhere):

```json
{ "user_id": "<uuid>", "slack_user_id": "U…", "display_name": "…",
  "member_status": "active", "slack_team_ok": true,
  "status": "requested | active | suspended | denied | none",
  "role": "member | lead | admin | null",
  "tools": ["create_notion_page"] }
```

`status: "none"`: no row. `role` is set and `tools` non-empty only while `active`.

**Service API** (dev-mcp → member-manager), `Authorization: Bearer <DEV_MCP_SERVICE_TOKEN>`,
compared in constant time; 401 without it:

- `GET /api/internal/dev-mcp/access/:slackUserId` → `200 { access }`, or
  `404 { "error": "not_found" }` when no member-manager account has that Slack ID.
- `POST /api/internal/dev-mcp/access/:slackUserId/request`, body `{ "display_name"?: string }`:
  creates a `requested` row or moves `denied` back to `requested` → `201 { access, created: true }`;
  otherwise `200 { access, created: false }`; 404 as above.

**RPC** `POST <SUPABASE_URL>/rest/v1/rpc/dev_mcp_principal` with the member's OAuth token returns
the access record or `null`: no `client_id`, a revoked session, no member row, no TUM.ai Slack ID,
or a client not bound to dev-mcp's resource (see [token binding](#one-server-per-app-token-binding)).
It files a `requested` row on first use by an active TUM.ai Slack member and refreshes
`last_seen_at` and the last client at most once a minute. Executable by `authenticated` only.

**Role presets** must match `presetTools` in dev-mcp's `src/access/resolver.ts`: every catalog
tool whose `minRole` the role meets (member < lead < admin), except destructive ones.

### Importing dev-mcp's access list

`pnpm --filter @member-manager/server import:dev-mcp-access <export.json> [--apply] [--overwrite]`
copies dev-mcp's `members` and `member_tools` into the new tables, matching Slack IDs to
member-manager accounts. It runs dry by default, skips members who already have a row unless
`--overwrite`, and always lists the Slack IDs it can't map (people with dev-mcp access but no
member-manager account with that Slack identity). The export command is in the script's header;
keep the file under `/data` (gitignored). `BOOTSTRAP_ADMIN_SLACK_IDS` stay in dev-mcp's env and
need no import.

### Rollout order

1. Merge member-manager and wait for `Production Supabase Migrations`. Set `DEV_MCP_SERVICE_TOKEN`
   and `DEV_MCP_URL` in Vercel (the same token as dev-mcp's `MEMBER_MANAGER_SERVICE_TOKEN`) and
   redeploy.
2. Run the import dry against production, review the unmapped Slack IDs (each must sign in to
   member-manager with Slack first, or be accepted as losing access), then run it with `--apply`.
3. Deploy dev-mcp with the remote access source configured. This is the cutover: from then on
   access comes from member-manager.
4. Deploy dev-claude with the "Review in member manager" links.
5. Announce how to connect directly: `claude mcp add --transport http tumai-dev https://tumai-dev-mcp.vercel.app/mcp`.

The OAuth server must already be enabled ([above](#oauth-server-mcp-servers)) for step 5; Dev
Claude runs don't depend on it.

## Field encryption and rotation

These secrets encrypt sensitive member, SEPA, reimbursement, and door PIN
fields before they hit Supabase. Losing every key capable of decrypting a row makes that row
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
