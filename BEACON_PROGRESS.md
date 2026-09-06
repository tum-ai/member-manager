# Beacon — Current Implementation Status

Beacon adds member-owned expertise profiles, searchable claims, organization and expertise
analytics, and a conversational assistant to member-manager. This branch is based on current
`main`; contracts, finance, education, jobs, encryption, RBAC, and canonical agent documentation
from `main` remain authoritative.

## Implemented

- Rich Beacon profiles with employment, education, skill, project, and capability claims.
- Confirm/reject/edit/delete review flows with pending facts labeled `Unverified`.
- Member search, mention suggestions, organization queries, expertise landscape, collaborator
  lookup, and member comparison.
- Primary conversational `POST /api/expertise/assistant` endpoint with JSON and SSE transports;
  `/api/expertise/search` remains a compatibility fallback.
- Shared Zod contracts consumed by both client and server.
- Feature-local client hooks and sections, centralized query keys, embedded profile support,
  mutation pending/error states, and keyboard-accessible member mentions.
- Contextual application headers plus reusable `EmptyState`, `SectionCard`, status-tone,
  motion, and elevation foundations across the latest decomposed pages.
- Responsive and dark-mode treatment for Beacon and the refreshed page foundations.

## Visibility and data rules

- Inactive and opted-out members are excluded from search, organization results, analytics,
  collaborator lookup, public profiles, and reindexing.
- Confirmed and pending claims are searchable; pending facts are always presented as unverified.
- Rejected facts are not searchable.
- Agent traces are redacted and bounded before persistence.
- Main's encrypted seed remains unchanged and authoritative.

## Migration set

The unmerged June migration names were replaced by this ordered set:

1. `20260826100000_beacon_linkedin_columns.sql`
2. `20260826100100_beacon_schema.sql`
3. `20260826100200_beacon_seed_vocabularies.sql`
4. `20260826100300_beacon_search.sql`
5. `20260826100400_beacon_agent_log.sql`
6. `20260826100500_preserve_beacon_on_member_merge.sql`

Security-definer functions use fixed search paths and explicit grants. Hybrid search is restricted
to the service role, RLS enforces opt-out, and the schema includes the missing foreign-key and log
indexes. Duplicate-member merging migrates and deduplicates Beacon data before deleting the source:
target values win, missing values may be filled from the source, and opt-out remains enabled if
either record opted out.

## Verification boundary

Run with Node 24 and the repository-pinned pnpm version. Required checks are shared build, focused
Beacon/client/server tests, Storybook interaction/a11y, coverage, full `pnpm gate`, and isolated CI
migration-reset plus E2E jobs.

The developer's local Supabase database contains ingested data. Do not reset, link, backfill,
enrich, or push it. Local runtime validation may only use non-destructive authenticated reads and
must be skipped if the stack cannot be started without risking that data. Clean migration and E2E
validation belongs in isolated CI.

## Local-only artifacts

Do not commit `.codex/` adapters, generated Vite JavaScript/declaration files, the partner portal
stub, or verification screenshots. Preserve the recoverable pre-rebase stash until the refreshed
branch and remote PR have been verified.

## Release checklist

- Run coverage, full Storybook, browser layout/theme checks, and `pnpm gate` after the final code
  change; record the exact evidence in PR #181.
- Run the Beacon member-merge integration regression only in isolated CI after its clean Supabase
  reset. Never opt the developer's ingested local database into that test.
- Keep PR #181 draft until its migration reset, Beacon merge regression, and E2E checks pass.
- Preserve the recoverable pre-rebase stash until the refreshed remote branch and PR are verified.

PR #255 is a separate expertise-graph implementation and must remain untouched. PR #181 stays
draft and must not be merged as part of this refresh.
