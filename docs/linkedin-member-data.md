# LinkedIn member data integration notes

## Goal

Populate member profiles with the reliable LinkedIn data we currently have:

- LinkedIn profile URL
- current company / organisation
- public location

Earlier iterations also tried to use LinkedIn education and experience data. We dropped that scope because the available export is not complete enough for those fields.

## Current branch state

Work happened on `chore/linkedin-seed-preview`, created from the rebased LinkedIn feature branch.

Relevant commits:

- `30b55b9 refactor(profile): align LinkedIn profile fields`
- `fc7ad9b refactor(profile): limit LinkedIn fields`
- `55c201f chore(data): add LinkedIn member export`
- `9438268 chore(data): flag non-Munich LinkedIn matches`
- `6df5d90 chore(data): allow expected LinkedIn locations`

The app/schema now only uses these LinkedIn-derived member fields:

- `linkedin_profile_url`
- `public_location`
- `current_company`

Removed from the app/schema scope:

- `linkedin_profile_id`
- `current_position`
- `professional_experience`
- LinkedIn education import into `degree` / `school`

## Source data

Original file supplied from WhatsApp temp storage:

```text
/Users/jakobfriedrich/Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents/5DEF83E9-3B23-4C80-868C-C87AEE88D999/members.jsonl
```

Committed copy:

```text
data/linkedin-members/members.raw.jsonl
```

Raw file stats from inspection:

- JSONL rows: 429
- usable LinkedIn profiles: 368
- rows with current company: 332
- rows with public location: 261
- rows with non-empty education array: 301
- rows with at least one named education institution: 262
- rows with non-empty experience: 1

## Why education and experience were dropped

### Education

The UI already supports multiple education entries via newline-aligned `members.degree` and `members.school` values. However, the LinkedIn JSONL export is not rich enough to populate this well.

For every profile with usable education, only one education entry has a named institution (`education[].title`). The remaining entries usually only have dates and no school/title/degree/field.

Observed histogram for named education institutions per usable profile:

```text
1 named institution: 262 profiles
2+ named institutions: 0 profiles
```

So importing LinkedIn education would mostly add a single school and no degree/program, which is not useful enough and risks overwriting better member-entered education data.

### Experience

Only one JSONL profile has a populated `experience` array. This is not enough to support the original “past stations” goal.

## Matching against prod members

Prod database was read with the Supabase service role from local `server/.env`. No writes were made to prod.

Minimal prod fields pulled for matching/local preview:

- `user_id`
- `given_name`
- `surname`
- `batch`
- `department`
- `member_role`
- `board_role`
- `degree`
- `school`
- `active`
- `member_status`

Matching logic:

- normalize prod full name: `given_name + surname`
- normalize LinkedIn JSONL name: `name` or `first_name + last_name`
- normalization: lowercase, strip diacritics, collapse non-alphanumeric separators
- exact normalized full-name match only
- ambiguous matches are not used

Match results:

- prod members: 459
- usable JSONL LinkedIn profiles: 368
- exact overlaps: 337
- ambiguous matches: 0
- unmatched prod members: 122

The overlap file is committed here:

```text
data/linkedin-members/prod-overlap.local.jsonl
```

Each overlap row includes:

- `user_id`
- `prod_name`
- `source_name`
- `linkedin_profile_url`
- `public_location`
- `current_company`
- location review fields (see below)

## Local dev database preview

The local dev DB was populated with prod-shaped member rows and LinkedIn data only for exact overlaps.

Local-only preview result:

- local prod rows upserted: 459
- local prod rows populated with LinkedIn data: 337
- visible members after import: 481
- visible with LinkedIn URL: 337
- visible with company: 308
- visible with location: 239

LinkedIn-only rows that existed in an earlier preview were removed from local DB. We only kept rows corresponding to prod members.

## Location review flags

Concern: some LinkedIn links may be wrong when the LinkedIn location looks implausible.

A review pass flags matched rows by `public_location`.

Committed files:

```text
data/linkedin-members/location-review-summary.local.json
data/linkedin-members/non-munich-review.local.jsonl
```

Accepted / non-flagged location rules currently include:

- Munich
- München
- Muenchen
- San Francisco
- Berlin
- Zurich
- Garching
- Freising

Current review/import counts after manual review:

- overlap rows: 337
- accepted location: 163
- manually approved non-Munich rows: 31
- manually rejected non-Munich rows: 45
- missing location: 98
- import candidates: 292

Each `prod-overlap.local.jsonl` row has:

- `location_review_status`: `accepted_location`, `manual_approved`, `manual_rejected`, or `missing_location`
- `needs_location_review`: boolean
- `manual_review`: present for manually reviewed non-Munich rows
- `exclude_from_import`: true for manually rejected rows

Review/import files:

- `data/linkedin-members/non-munich-review-links.md` — Markdown link checklist that was manually filtered
- `data/linkedin-members/non-munich-approved.local.jsonl` — 31 manually approved non-Munich matches
- `data/linkedin-members/non-munich-rejected.local.jsonl` — 45 manually rejected non-Munich matches
- `data/linkedin-members/prod-import-candidates.local.jsonl` — 292 rows currently eligible for import

## Current implementation behavior

### Profile page

Members can edit:

- LinkedIn profile URL
- public location
- current company / organisation

LinkedIn URL is validated client-side as a LinkedIn profile URL:

```text
https://linkedin.com/in/...
https://www.linkedin.com/in/...
```

### Members page

Member cards show:

- LinkedIn icon/link when URL is valid
- current company
- public location

Search includes:

- name
- department / role / batch / status
- existing degree / school fields
- public location
- current company

### Admin page

Admin table/editor/export includes:

- LinkedIn URL
- public location
- current company

Server-side validation also restricts LinkedIn URLs to LinkedIn profile URLs.

## Verification already run

After limiting the scope to the three reliable fields:

```text
pnpm lint
pnpm test
pnpm build
```

All passed.

## Important cautions

- The committed data is public LinkedIn-derived data, but it is still member-associated data.
- Prod has not been updated.
- The overlap file should be reviewed before any prod import.
- Rows with `needs_location_review: true` should not be imported blindly.
- Rows with missing location are not flagged as suspicious by the current rule, but they also give less confidence.

## Suggested next step

Build a small one-off import script that reads `data/linkedin-members/prod-import-candidates.local.jsonl` and updates only the three approved fields:

- `linkedin_profile_url`
- `public_location`
- `current_company`

Potential dry-run output:

- number of rows to update (currently 292)
- number skipped due to manual rejection (currently 45)
- sample of updates

Only after final approval should the script be pointed at prod.
