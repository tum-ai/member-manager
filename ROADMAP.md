# TUM.ai Member Manager Roadmap

## Product Direction

Build two clearly separated surfaces:

1. A private member portal where members authenticate, review or correct pre-populated data, and manage their own profile.
2. A public network explorer where the community can be browsed by structured member metadata, starting with university.

The current implementation is still focused on the private portal. The public explorer and eventual graph remain future work.

## Product Principles

- Private by default: banking, agreements, admin state, and sensitive personal data never flow into the public surface.
- Structured data before visualization: grouping only works if fields like university and degree are normalized.
- Member-owned updates: members should be able to maintain their own record after signing in.
- Public exposure must be explicit: public routes should consume a dedicated public data model, not private profile payloads.
- Simplicity first: a grouped directory comes before a graph.

## Current Baseline

Today the repo already supports:

- authenticated sign-in via email/password and Slack OAuth
- default landing on `My Profile`
- an authenticated `All Members` browse view
- private SEPA and agreement handling
- admin-only list and status operations
- server-side encryption for sensitive fields

This means the current MVP is not starting from zero. The main gap is data quality and separation between private and eventually public member information.

## Scope Split

### Private Portal

- authentication
- profile editing
- member directory for logged-in users
- certificate flow
- banking and consent workflows
- admin operations

### Public Explorer

- public directory
- grouping by university first
- later grouping by degree, field of study, current role, company, or location
- eventual graph visualization

## Roadmap Phases

### Phase 1: Data Model and Profile Quality

Goal: make member records usable, structured, and safe to project into a public view later.

User-facing outcomes:

- members log in and land on their own profile
- profile data can be reviewed and corrected
- key attributes needed for browsing are captured consistently
- authenticated members can already browse other members internally

Product work:

- define the minimum public-safe member profile
- classify fields as private, internal-only, or public-safe
- normalize core grouping dimensions, especially university
- support pre-population and cleanup of missing member data

Near-term schema priorities:

- name
- university
- degree or course of study
- TUM.ai role
- batch or cohort
- current role or current organization when available

Success criteria:

- university data is present and normalized for most active members
- authenticated browsing is useful without exposing internal-only data
- the repo has a clear distinction between private workflows and future public fields

### Phase 2: Grouped Authenticated Directory

Goal: improve the internal browse experience before opening anything publicly.

User-facing outcomes:

- authenticated users can browse members grouped by university
- search and filtering work on structured fields
- the directory acts as the proving ground for the future public explorer

Product work:

- add grouping by university to the member browse view
- improve search/filter UX around normalized member attributes
- define empty and incomplete-data states

Success criteria:

- grouped browsing is stable and understandable
- the internal UI validates the chosen public-safe fields and grouping model

### Phase 3: Public Directory

Goal: ship a safe public read-only surface before attempting a graph.

User-facing outcomes:

- public visitors can browse the network without authentication
- university is the default grouping
- only explicitly public member fields are shown

Product work:

- introduce a public projection or public-profile table/view
- define publication and moderation rules
- build public routes and public APIs separate from private APIs

Success criteria:

- no private fields are exposed through public routes
- the public directory can evolve independently from the private portal

### Phase 4: Public Graph

Goal: build the visual network explorer once the underlying data is clean enough.

User-facing outcomes:

- public graph or grouped network explorer
- drill-down from university groups to member cards
- later filters for studies, role, current work, or company

Product work:

- choose the graph model only after real data quality is known
- add search, filters, and detail panels
- define how to handle incomplete or ambiguous member data

Success criteria:

- the graph stays understandable at real community scale
- performance is acceptable on desktop and mobile

## Technical Tracks

### 1. Public Profile Projection

Current risk:

- the `members` table currently carries both operational/private data and fields that may later become public-facing.

Direction:

- create an explicit public projection instead of serving the raw private member record.

Preferred approach:

- dedicated `public_member_profiles` table or view
- publication state controlled separately from private member editing

### 2. Controlled Vocabularies

Current risk:

- free-text values for university, degree, or role will fragment grouping.

Direction:

- introduce stable keys and display labels for the first grouping dimensions.

Initial focus:

- university
- degree type
- field of study
- current role category

### 3. Public API Boundary

Direction:

- public explorer features must use dedicated public endpoints.

Candidate endpoints:

- `GET /api/public/members`
- `GET /api/public/groups/universities`
- `GET /api/public/graph`

Rules:

- no banking data
- no agreement state
- no private address or birthdate data
- no admin metadata

### 4. Frontend Separation

Direction:

- keep authenticated member flows and public explorer flows separate inside the client architecture.

Guidelines:

- private routes stay under the authenticated app shell
- public explorer gets dedicated components and data hooks
- do not reuse private profile components blindly for public rendering

### 5. Data Onboarding and Cleanup

Direction:

- support pre-populated member records and a predictable cleanup path.

Needed capabilities:

- import or sync initial member data
- admin review for incorrect records
- normalization tooling for grouped dimensions

## Immediate Backlog

- document private vs public-safe member fields
- make university the first-class grouping field across docs and UI
- group the authenticated directory by university
- define the public-profile projection strategy
- keep internal workflows separate from public-facing features

## Later Backlog

- add public directory routes and APIs
- build moderation and publication controls
- add richer grouping dimensions
- build the graph UI only after grouped browsing is validated

## Open Questions

- should public visibility be opt-in per member or managed centrally by admins?
- which fields are mandatory before a member can appear publicly?
- is Slack the primary long-term identity provider, with email/password as fallback?
- should university remain single-valued for the MVP?
- who owns data moderation for outdated or incorrect public-facing member records?
