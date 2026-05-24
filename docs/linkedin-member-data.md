# LinkedIn member data integration notes

## Goal

Add reliable LinkedIn profile links to member profiles, plus an optional public location field.

The application/schema now supports:

- `linkedin_profile_url`
- `public_location`

For the one-off prod import, we decided to write **only**:

- `linkedin_profile_url`

`public_location` remains useful for review and can be edited manually later, but it is not planned for prod import from the static scrape.

## Why scope was reduced

The original idea was to show what members currently do and which stations they went through. The supplied LinkedIn JSONL export does not support that reliably:

- Experience data is almost entirely missing.
- Education data is too sparse for multi-station profile population.
- Current company is a static snapshot and can become stale quickly.

Therefore the safe import target is LinkedIn URL only. Members can click through for current information.

## Source data

Original file was supplied as an exported LinkedIn JSONL file from local temporary storage.

Local working copy, intentionally ignored by git:

```text
data/linkedin-members/members.raw.jsonl
```

`/data` is gitignored. The member data files are local working artifacts for this one-off import and should not live in the repository history going forward.

Raw file stats from inspection:

- JSONL rows: 429
- usable LinkedIn profiles: 368
- rows with current company: 332
- rows with public location: 261
- rows with non-empty education array: 301
- rows with at least one named education institution: 262
- rows with non-empty experience: 1

## Why education, experience, and current company were dropped

### Education

The app supports multiple education entries via newline-aligned `members.degree` and `members.school` values. However, the LinkedIn export has only one named education institution per usable profile.

Observed histogram for named education institutions per usable profile:

```text
1 named institution: 262 profiles
2+ named institutions: 0 profiles
```

Most additional LinkedIn education entries contain only dates and no school/title/degree/field, so importing them would either do nothing useful or overwrite better member-entered education data.

### Experience

Only one JSONL profile has a populated `experience` array. This is not enough to support the “past stations” goal.

### Current company

Current company is useful as a review signal, but it is a static snapshot and can drift quickly without a LinkedIn refresh pipeline. We decided not to keep/import it as an app field for now.

## Matching against prod members

Prod was read with the Supabase service role from local `server/.env`. No writes were made to prod during review.

Minimal prod fields pulled for local matching:

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

Local overlap/review files, ignored by git:

```text
data/linkedin-members/prod-overlap.local.jsonl
data/linkedin-members/prod-import-candidates.local.jsonl
data/linkedin-members/prod-linkedin-url-import-candidates.local.jsonl
```

## Review and filtering rules

We filtered aggressively because wrong LinkedIn links are worse than missing links.

Excluded from import:

- manually identified wrong profiles from `data/linkedin-members/wrongmembers.md`
- rows with neither `public_location` nor current-company review metadata
- rows whose LinkedIn `/in/...` slug contains digits
- manually rejected non-Munich / missing-location rows

Accepted/reviewed signals used before the numeric-slug exclusion:

- Munich/München/Muenchen and accepted locations were low-risk.
- Some non-Munich matches were manually approved.
- Missing-location rows were prefiltered using profile slug/name consistency and high-signal current-company review metadata, then remaining ambiguous rows were manually reviewed.

Final current candidate set:

- overlap rows: 337
- import candidates: 196
- excluded from import: 141
- pending manual review: 0

The URL-only import artifact is local-only:

```text
data/linkedin-members/prod-linkedin-url-import-candidates.local.jsonl
```

Shape:

```json
{"user_id":"...","prod_name":"...","linkedin_profile_url":"https://www.linkedin.com/in/..."}
```

Only `user_id` and `linkedin_profile_url` should be used by an import script. `prod_name` is audit/readability only.

## Local dev database preview

The local dev DB was populated with only the approved candidate rows visible.

Current local preview after final filtering:

- visible members: 196
- with LinkedIn URL: 196
- with public location review metadata: 149

Other seed/prod preview rows were hidden locally via `active=false` / `member_status=inactive`.

## Current app behavior

### Profile page

Members can edit:

- LinkedIn profile URL
- public location

LinkedIn URL is validated client-side as a LinkedIn profile URL:

```text
https://linkedin.com/in/...
https://www.linkedin.com/in/...
```

### Members page

Member cards show:

- LinkedIn icon/link when URL is valid
- public location

Search includes:

- name
- department / role / batch / status
- existing degree / school fields
- public location

### Admin page

Admin table/editor/export includes:

- LinkedIn URL
- public location

Server-side validation also restricts LinkedIn URLs to LinkedIn profile URLs.

## Verification already run

After limiting the scope and review data handling:

```text
pnpm lint
pnpm test
pnpm build
```

All passed at the time of implementation. Later docs/data changes ran `pnpm lint`.

## Suggested next step

Build a small one-off import script that reads the local ignored file:

```text
data/linkedin-members/prod-linkedin-url-import-candidates.local.jsonl
```

and updates only:

- `members.linkedin_profile_url`

Potential dry-run output:

- number of rows to update: 196
- number skipped by filtering: 141
- sample of updates

After the one-off prod import is done, the local data files can be archived or removed. They should not be needed as part of normal development.
