# Product Analytics (PostHog)

Client-side product analytics. **Off unless `VITE_POSTHOG_KEY` is set** — with no key
the `posthog-js` chunk is never downloaded and every analytics call is a no-op, so
local dev, CI, Vitest, Storybook and any deployment that doesn't want it are unaffected.

## Setup checklist

### 1. Create the PostHog project

1. Sign up at <https://eu.posthog.com> (**EU cloud** — the members' data is EU personal
   data and TUM.ai is a German organisation; US cloud means a third-country transfer).
2. Create a project, e.g. `member-manager`.
3. **Project settings → Project ID/API key** → copy the **Project API key**. It starts
   with `phc_` and is public by design (it's compiled into the JS bundle).

> Never use a `phx_` (personal) or `phs_` (secret) key here. The app refuses to
> initialise with one and logs an error instead, because those keys can read and
> write the whole PostHog project.

### 2. Local development

Add to `client/.env.local` (see `client/.env.example` for all keys):

```bash
VITE_POSTHOG_KEY=phc_your_project_key
```

Restart Vite. `pnpm setup:local` preserves the `VITE_POSTHOG_*` keys, so re-running it
after a Supabase restart won't wipe them.

Prefer keeping analytics **off** locally (leave `VITE_POSTHOG_KEY` empty) unless you're
actively working on tracking — otherwise your dev clicking shows up in the same project
as real usage. If you do enable it locally, either use a separate PostHog project or
filter your own `distinct_id` out in PostHog.

### 3. Vercel

**Settings → Environment Variables**, for Production (and Preview if you want preview
traffic tracked — usually you don't):

| Key | Value | Notes |
| --- | --- | --- |
| `VITE_POSTHOG_KEY` | `phc_…` | required; everything else is optional |
| `VITE_POSTHOG_HOST` | `/ingest` | recommended — same-origin proxy, see below |
| `VITE_POSTHOG_UI_HOST` | `https://eu.posthog.com` | needed when `VITE_POSTHOG_HOST` is a proxy path, so toolbar links point at PostHog |

These are **build-time** variables (Vite inlines `VITE_*` into the bundle), so a change
only takes effect after a redeploy. Changing them in Vercel does *not* affect the
already-deployed bundle — trigger a new deployment.

### 4. Verify

After deploying, open the app and check:

```
PostHog → Activity  (live events should appear within seconds)
```

If nothing arrives, open devtools → Network and look for requests to `/ingest/*` (or
`eu.i.posthog.com`). No requests at all means the key wasn't in the bundle at build
time; blocked requests mean an ad blocker (fix: use the `/ingest` proxy).

## The `/ingest` reverse proxy

Ad blockers and privacy extensions block requests to `*.posthog.com`, which silently
drops a large share of events. `vercel.json` therefore rewrites two same-origin paths
straight through to PostHog:

```
/ingest/static/:path*  →  https://eu-assets.i.posthog.com/static/:path*
/ingest/:path*         →  https://eu.i.posthog.com/:path*
```

Setting `VITE_POSTHOG_HOST=/ingest` makes the browser talk to your own domain instead.
`client/vite.config.ts` mirrors the same two rules in the dev-server proxy, so `/ingest`
behaves identically locally (override the upstream with `VITE_POSTHOG_PROXY_TARGET`).

**These rewrites must stay above the SPA catch-all in `vercel.json`** — Vercel stops at
the first matching rewrite, so if the catch-all came first, `/ingest/*` would be served
`index.html` and analytics would break with no obvious error.
`scripts/vercel-config.test.mjs` asserts that ordering.

## What gets captured

Enabled by default:

- **Pageviews** — one `$pageview` per React Router navigation, plus `$pageleave`.
  Captured by `client/src/components/analytics/AnalyticsTracker.tsx`, which sits inside
  `BrowserRouter` and *above* the auth gate, so the public contract-signing pages count too.
- **Identity** — on login, `posthog.identify(<supabase user id>)`. On logout,
  `posthog.reset()` so the next person on that browser isn't attributed to the previous member.
- **Person properties** — `department`, `is_admin`, `is_board_member`, written from
  `AuthenticatedApp` once `useToolAccess` / `useIsAdmin` resolve. These are the useful
  segmentation dimensions ("which departments use which tools").
- **Feature flags** — available through `useFeatureFlag()`.

Disabled by default, opt in per deployment:

| Variable | Default | Why it's off |
| --- | --- | --- |
| `VITE_POSTHOG_AUTOCAPTURE` | `false` | Autocapture records the text of clicked elements, which in this app includes member names, IBANs and reimbursement details. |
| `VITE_POSTHOG_SESSION_RECORDING` | `false` | Session replay records the DOM. Inputs are masked (`maskAllInputs`), but rendered values are not. Don't turn this on without a DPIA-level conversation first. |
| `VITE_POSTHOG_IDENTIFY_EMAIL` | `false` | Sends the member's email as a person property. The Supabase user id is enough to segment; the email only helps for individual support lookups. |
| `VITE_POSTHOG_DEBUG` | `false` | Verbose posthog-js console logging. |

## Privacy guarantees in code

`client/src/lib/analytics.ts` installs a `before_send` hook that rewrites **every**
outgoing event — ours, autocaptured ones, `$pageleave`, web vitals — so redaction can't
be forgotten at a call site:

- **Query strings and URL fragments are dropped entirely** from `$current_url`,
  `$referrer` and friends. This matters: Supabase returns OAuth sessions as
  `#access_token=…`, and a naive integration ships that access token to PostHog.
- **Secret path segments are collapsed to route templates.**
  `/contracts/sign/<token>` → `/contracts/sign/:token` (that token grants contract
  access to anyone holding it), same for `/contracts/board-sign/<token>`,
  `/contracts/drafts/<id>` and `/contracts/submissions/<id>`.
- **Unknown routes get generic redaction** — any UUID or 20+ character opaque segment
  becomes `:redacted`, so a route added later is safe by default instead of leaking
  until someone remembers to add a rule.
- `person_profiles: "identified_only"` — anonymous visitors on the public signing pages
  never get a person profile.

`client/src/lib/analytics.test.ts` covers all of the above. **If you add a route with a
secret or an id in the path, add a rule to `PATH_TEMPLATES` and a test.**

### GDPR notes

This is an internal tool for logged-in members, tracked on the legal basis of operating
the members' association's own systems, with data staying in the EU. Two things are
deliberately left to a decision by whoever owns data protection at TUM.ai:

- **No consent banner.** With autocapture and replay off, and URLs redacted, what's
  collected is essentially server-log-equivalent. If you enable replay or autocapture,
  revisit this — `posthog.opt_out_capturing()` / `opt_in_capturing()` exist for wiring a
  banner, and `opt_out_capturing_by_default` can flip the default in `analytics.ts`.
- **Mention PostHog in the privacy notice** before enabling this in production.

## Adding events

Capture from the feature's hook (not from a component), matching the repo's
Page → hook → sections split:

```ts
import { useAnalytics } from "@/hooks/useAnalytics";

export function useReimbursements() {
	const { capture } = useAnalytics();

	const submit = useMutation({
		mutationFn: createReimbursement,
		onSuccess: (created) => {
			capture("reimbursement_submitted", { amount_cents: created.amount_cents });
		},
	});
}
```

Conventions:

- Name events `noun_verbed`, past tense, snake_case: `reimbursement_submitted`,
  `contract_sent_for_signature`, `cv_downloaded`.
- **Properties are dimensions, not payloads.** Amounts, counts, enum values and booleans
  are fine. Names, emails, IBANs, addresses, dates of birth, free-text and file contents
  are not — the same rule as `server/src/lib/sensitiveData.ts`.
- `capture()` is safe when analytics is off; no need to guard call sites.

## Feature flags

```tsx
import { useFeatureFlag } from "@/hooks/useAnalytics";

const showNewFinanceView = useFeatureFlag("new-finance-view");
```

Returns `false` while flags are loading and whenever analytics is disabled, so a
flag-gated feature stays hidden unless PostHog explicitly enables it. It re-renders when
PostHog refreshes flags.

## Bundle cost

`posthog-js` is loaded with a dynamic `import()` from the **slim** build
(`posthog-js/dist/module.slim`), which leaves out the bundled surveys / product-tours UI
this config never turns on. That's ~47 kB gzipped in its own chunk, never in the main
bundle and never fetched when `VITE_POSTHOG_KEY` is unset. Session replay's recorder, if
you enable it, is fetched from the asset host at runtime (hence the `/ingest/static`
proxy rule).

`scripts/check-bundle-size.mjs` counts every emitted chunk, so the analytics chunk does
consume budget there even though users never download it unless analytics is on.

## Server-side events (not implemented)

Only the browser sends events today. If backend events are ever needed (`posthog-node`),
note that the Fastify app runs as a Vercel function: the Node SDK batches in the
background, and a serverless invocation can be frozen before the batch flushes. Any
server-side capture must `await posthog.flush()` (or configure `flushAt: 1`) before the
handler returns, or events will be lost non-deterministically.

## Files

| Path | Role |
| --- | --- |
| `client/src/lib/analytics.ts` | config parsing, lazy init, redaction, capture/identify/reset |
| `client/src/hooks/useAnalytics.ts` | `useAnalytics()`, `useFeatureFlag()`, `useAnalyticsPersonProperties()` |
| `client/src/components/analytics/AnalyticsTracker.tsx` | pageviews + identity, mounted in `App.tsx` |
| `client/src/main.tsx` | fire-and-forget `initAnalytics()` at startup |
| `vercel.json`, `client/vite.config.ts` | the `/ingest` reverse proxy |
