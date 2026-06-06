# Sanity Draft Staging

This repo does not currently fetch content from Sanity. When Sanity-backed pages
are added, use this deployment shape so editors can review drafts before publish
without exposing unpublished content in production.

## Recommended Shape

Use a dedicated Vercel Preview or staging deployment for draft preview:

| Environment | Sanity dataset | Perspective | Token | Cache |
| --- | --- | --- | --- | --- |
| Production | `production` | `published` | none for public content | normal production cache |
| Staging / Preview | `production` | `drafts` | server-only read token | `no-store` / live updates |

The important bit is that the staging app reads the same dataset as production
with Sanity's draft perspective. A separate `staging` dataset is useful for
testing schema changes or content migrations, but it will not show editors'
in-progress production drafts unless someone continuously copies data between
datasets.

## Runtime Contract

When adding Sanity fetching code:

- Keep production queries on the `published` perspective.
- Serve draft queries from the server/API layer, not directly from the Vite
  client bundle.
- Store the draft read token in a non-`VITE_` env var, for example
  `SANITY_READ_TOKEN`, so it is never baked into browser JavaScript.
- Require a preview secret or authenticated editor session before enabling draft
  preview.
- Send `Cache-Control: no-store` for draft preview responses and disable Sanity's
  CDN for those requests.
- Keep any visual editing overlays disabled in production.

Suggested env names once code exists:

```bash
# Shared Sanity config
VITE_SANITY_PROJECT_ID=
VITE_SANITY_DATASET=production
VITE_SANITY_API_VERSION=2026-06-06

# Server-only draft preview config
SANITY_READ_TOKEN=
SANITY_PREVIEW_SECRET=
SANITY_PERSPECTIVE=published # production
SANITY_STUDIO_URL=
```

For a Vercel Preview/staging environment, set `SANITY_PERSPECTIVE=drafts` and
configure `SANITY_READ_TOKEN`. For Production, keep `SANITY_PERSPECTIVE` unset
or set to `published`, and do not configure a draft token unless a server-only
editor preview endpoint explicitly needs it.

## Deployment Checklist

1. Create a Sanity read token with the minimum role needed for draft preview.
2. Add the token only to the Vercel Preview/staging environment.
3. Configure the preview/staging domain in Sanity CORS if browser-side live
   update tooling needs authenticated requests from that origin.
4. Point Sanity Studio's preview or Presentation Tool URL at the staging
   deployment.
5. Smoke-test a draft-only change in staging, then confirm the same change is not
   visible in production until publish.

## When To Use A Separate Dataset

Create a separate `staging` Sanity dataset only when the goal is isolated schema,
migration, or destructive content testing. Treat it as a sandbox, not as the
editor draft-preview environment.
