# TUM.ai Member Manager Roadmap

## Product Goal

Build a member system with two clearly separated surfaces:

1. A private member portal where members authenticate, review pre-populated data, and maintain their own profile.
2. A public network explorer that visualizes the TUM.ai community through structured member metadata.

The current repository is the foundation for the private portal and the member-data model that will later power the public graph.

## Product Principles

- Private by default: internal and sensitive data never leaks into the public experience.
- Structured data over free text: the graph only becomes useful when member attributes are normalized.
- Member-owned updates: authenticated users should be able to claim and maintain their profile.
- Progressive disclosure: the MVP should solve member data quality before taking on graph complexity.

## Scope Split

### Internal / Private

- Authentication
- Member profile editing
- Banking details
- Privacy-policy and mandate workflows
- Admin review and member operations

### Public

- Searchable member graph
- Grouping by university first
- Additional groupings later, such as field of study, graduation path, current role, and company

## Phase Plan

### Phase 0: Current Baseline

Status: in progress

- Authenticated member portal exists
- Members can edit their profile
- Members directory exists for authenticated users
- Internal/private data handling and encryption are already part of the backend

### Phase 1: MVP Data Foundation

Goal: make member information complete, structured, and usable.

User-facing outcomes:

- Members log in with Slack or email and land on their profile
- Profiles are pre-populated where possible
- Members can edit and save their public-facing information
- Authenticated users can browse the member directory
- Members can be grouped by university in the directory or downstream graph views

Required product work:

- Define the minimum public member profile schema
- Separate public profile fields from internal-only fields
- Decide which profile fields are editable by members
- Decide which fields are required before a profile is considered complete
- Add completeness indicators for members and admins

Required data fields for MVP:

- Full name
- University
- Degree / course of study
- Current status or role
- Batch / cohort
- Optional profile image
- Optional skills / tags

Success criteria:

- A large majority of active members have complete university data
- Authenticated users can search and browse members reliably
- Internal/private data remains separate from public-profile data

### Phase 2: Public Directory

Goal: expose a safe public listing before building the graph.

User-facing outcomes:

- Public visitors can browse the network without logging in
- The default grouping is by university
- Public profile cards show only explicitly public information

Required product work:

- Add a publication flag or public-profile projection
- Add moderation/admin controls for public visibility
- Define a public route and API shape independent of private member APIs

Success criteria:

- Public directory uses only approved public fields
- Private portal continues to function independently

### Phase 3: Public Graph

Goal: launch the CDTМ-style network view on top of clean member data.

User-facing outcomes:

- Public graph of members and groups
- First grouping: university
- Additional groupings later: studies, current work, role, company, location

Required product work:

- Choose graph interaction model: force graph, clustered graph, or grouped explorer
- Add drill-down from group to members
- Add search, filters, and detail panels
- Decide what is shown for members with incomplete data

Success criteria:

- Graph remains understandable with real data volume
- Public graph performance is acceptable on mobile and desktop

## Technical Roadmap

### 1. Introduce a Public Profile Model

Current risk:

- The `members` table mixes internal operational data with data that could become public-facing.

Target:

- Explicit separation between internal member data and public-profile data.

Recommended approach:

- Keep sensitive and operational data private
- Add a public-profile projection, either:
  - in the same table with clearly scoped public fields and a `is_public` flag, or
  - in a dedicated `public_member_profiles` table/view

Preferred direction:

- A dedicated public projection is safer and easier to reason about than reusing the full member record.

### 2. Normalize Grouping Dimensions

Current risk:

- University, degree, and similar dimensions will fragment if they stay as uncontrolled free text.

Target:

- Stable grouping values for public exploration and analytics.

Recommended approach:

- Introduce controlled vocabularies for:
  - university
  - degree type
  - field of study
  - current role category
- Use display label plus stable internal key

### 3. Improve Profile Completion Workflow

Target:

- Members should see what information is still missing and why it matters.

Recommended implementation:

- Add profile completeness calculation on the server or client
- Show missing required public fields on the profile page
- Optionally block public visibility until required fields are complete

### 4. Add Public APIs

Target:

- Public graph and public directory should not consume authenticated private APIs.

Recommended endpoints:

- `GET /api/public/members`
- `GET /api/public/groups/universities`
- `GET /api/public/graph`

Design rules:

- Return only public data
- No banking, mandate, agreement, address, birthdate, or admin-only metadata
- Cache-friendly responses

### 5. Prepare Frontend Architecture for Two Surfaces

Target:

- One codebase can serve both private portal and public explorer without entangling them.

Recommended approach:

- Keep authenticated app routes separate from public routes
- Create dedicated public components and query hooks
- Avoid reusing private profile components for public rendering unless the data contracts match exactly

### 6. Graph Readiness

The graph should only start after:

- public profile fields are defined
- university data is normalized
- enough member profiles are complete
- public APIs exist

Before that, a grouped directory is the correct intermediate step.

## Suggested Backlog

### Immediate

- Define MVP public member fields
- Add university as a first-class member field if needed
- Add profile completeness status
- Keep authenticated default route on profile
- Keep member directory as explicit secondary navigation

### Near Term

- Add public/private field classification in code and docs
- Add public-profile API contract
- Add admin tooling for profile completeness and publication state
- Add grouped member directory by university

### Later

- Build public directory
- Build graph API
- Build public graph UI
- Add richer grouping dimensions

## Open Questions

- Should every authenticated member automatically have a public profile, or must they opt in?
- Which fields are mandatory for public visibility?
- Will Slack be the primary identity provider, with email/password as fallback, or will both stay first-class?
- Should university be a single value in the MVP, even if some members have multiple affiliations?
- Who owns data moderation for incorrect or outdated public profiles?
