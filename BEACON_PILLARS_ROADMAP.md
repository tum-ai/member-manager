# Beacon — Pillars and Tools Roadmap

Beacon's assistant is one tool-calling loop backed by independently registered pillars. This file
tracks the useful capability boundary, not a promise that every possible portal action belongs in
the assistant.

## Implemented pillars

### Members

Tools: `search_members`, `find_people_by`, `get_member_profile`, and `resolve_person`.

This is the canonical people-discovery surface. It can use confirmed and unverified claims, but it
must exclude rejected claims, inactive members, and opted-out members.

### Organization

Tools: `list_departments`, `people_in_department`, `people_in_batch`, and
`find_role_holders`.

This pillar answers structural questions from current member data. It follows the same visibility
policy as search and must not reintroduce alumni through an optional filter.

### Expertise graph

Tools: `expertise_landscape`, `find_collaborators`, and `compare_members`.

This pillar summarizes skills and working relationships from Beacon claims. Unverified facts may
participate when explicitly labeled; opted-out and inactive members are excluded at the lookup
boundary.

## Candidate read-only pillars

1. Jobs: browse approved internal and partner opportunities.
2. Events and education: answer questions about scheduled programs and participation.
3. Internal knowledge: retrieve approved member-facing documentation with source links.
4. Self-service concierge: explain portal workflows without mutating records.

Implement a candidate only when its source has a stable authorization model, a bounded shared
contract, and deterministic tests. Prefer a small, composable tool over a broad endpoint that
returns raw tables.

## Write boundary

No registered pillar currently performs user-facing writes. A future write tool requires both:

1. a preview response that describes the exact mutation and affected record; and
2. a separate, explicit confirmation request that revalidates authorization and current state.

Never execute a write merely because a conversational turn sounds affirmative. Sensitive fields
must use the repository's encryption helpers and must not appear in tool output or traces.

## Definition of done for a new pillar

- Shared Zod schemas cover every new public payload.
- Lookup code applies active-member and opt-out visibility before aggregation.
- The tool has bounded inputs, typed errors, sanitized summaries, and unit tests.
- JSON and SSE assistant flows can call it without changing the orchestrator.
- Client presentation supports loading, empty, error, keyboard, mobile, and dark-mode states.
- Coverage and the full repository gate pass.
