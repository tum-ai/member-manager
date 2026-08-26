# Beacon Assistant — Engineering Handoff

Beacon is the member-manager's conversational expertise assistant. The primary endpoint is
`POST /api/expertise/assistant`; `POST /api/expertise/search` remains only as a compatibility
fallback for older clients.

## Current architecture

- Shared request, response, mention, profile, claim, search, and SSE event schemas live in
  `shared/src/beacon.ts`. Client and server parse external data with these schemas.
- `server/src/routes/assistant.ts` validates requests with `safeParse`, retains the most recent
  eight history messages, and serves either JSON or Server-Sent Events depending on `Accept`.
- `server/src/lib/agent/orchestrator.ts` runs the Responses API tool loop. With no usable OpenAI
  configuration it degrades to the deterministic member-search pipeline.
- The registered pillars are `members`, `org`, and `expertise-graph`. Pillars own their tools;
  the orchestrator is domain-agnostic.
- The client consumes the SSE stream in `client/src/features/expertise/hooks/`, centralizes cache
  keys in `expertiseQueryKeys.ts`, and renders assistant mentions as links to member profiles.

## Safety and visibility invariants

1. Inactive or opted-out members must never be returned by member search, structured lookup,
   organization tools, expertise analytics, collaborator lookup, or public profile reads.
2. Confirmed and pending claims are searchable. Pending claims must be labeled `Unverified` in
   every user-facing result; rejected claims are not searchable.
3. The server may only emit member mention tokens for people returned by a tool in the current
   turn. Tool-call syntax and raw arguments are removed from final prose.
4. SSE errors are generic. Internal exception details stay in server logs.
5. Persisted agent traces pass through `sanitizeAgentTrace`: sensitive member fields are redacted,
   nested content and arrays are capped, long strings are truncated, and the serialized trace is
   bounded before insertion.
6. Authentication, RBAC, and field-encryption startup checks from `main` are authoritative and
   must remain intact when the assistant changes.

## Request and transport contract

The assistant accepts the current user text, optional resolved mentions, recent conversation
messages, already-loaded pillar ids, and optional UUID chat/turn ids. JSON callers receive the
answer, people, steps, and loaded pillars. SSE callers receive validated `pillar_loaded`,
`tool_call`, `tool_result`, `people`, `answer`, `error`, and terminal `done` events.

The stream must always terminate. Malformed internal events are logged and dropped rather than
sent to the client.

## Extending Beacon

Add a pillar descriptor under `server/src/lib/agent/pillars/`, unit-test its lookup and visibility
rules, and register it in `pillars/index.ts`. Avoid adding domain branches to the orchestrator.
Any new client/server payload must be modeled in `shared/` first and exported from
`shared/src/index.ts`.

Write-capable tools are intentionally out of scope. If introduced later, they require an explicit
preview plus a separate user confirmation request; read authorization does not imply write
authorization.

## Verification checklist

- Shared schemas reject malformed UUIDs, oversized queries, and invalid SSE events.
- JSON and SSE assistant paths return equivalent people/answer results and SSE ends with `done`.
- Search, org, graph analytics, collaborators, profiles, and reindexing exclude inactive and
  opted-out members.
- Pending facts remain discoverable and render as `Unverified`.
- Claim changes reindex the affected member without exposing rejected or opted-out data.
- Trace tests prove sensitive keys and oversized tool output cannot be persisted.
- Composer mention lookup reports failures, supports arrow keys plus Enter/Tab, and is usable by
  keyboard and screen-reader users.

Do not validate migrations by resetting the developer's ingested local database. Use isolated CI
for clean migration-reset and E2E coverage; local checks must be non-destructive.
