# Member CV download

Bulk-download member CV files from TUM.ai membership-application exports.

## Goal

Get the CV PDFs of members into a local folder for offline review. CVs only
exist in the Tally application exports; the script resolves and downloads the
CV links from those CSVs.

There are two modes:

- **All completed submissions** — download a CV for every (non-test) row in a
  single CSV.
- **Active members only** — read the active-member roster from the prod
  Supabase `members` table (`member_status = 'active'`) and download only the
  CVs of members that appear in the provided CSV(s).

## Getting the source CSV from Tally

1. Open the membership-application form in Tally and go to the
   submissions/responses view.
2. Filter/select the **completed submissions** you want.
3. Export as CSV. The export contains a `CV (preferably without picture)`
   column with one storage link per submission.

> **Tally links expire.** The CV column holds signed Tally storage URLs with
> short-lived access tokens (a JWT in the `accessToken` query param). Tokens are
> regenerated on each export, so always run against a **freshly exported** CSV.
> If downloads fail with `HTTP 401/403`, re-export from Tally.

## Mode 1: all completed submissions

```bash
node scripts/download-member-cvs.mjs "<path/to/submissions.csv>"
```

- Output defaults to `data/cvs/`, named `FirstName_LastName.<ext>`.
- Skips obvious test rows and rows without a CV.
- Most uploads are `.pdf`; a few are other formats (`.docx`, images) — these
  are downloaded and reported for review.
- Override the output dir with `--out <dir>`; re-download existing files with
  `--force`.

## Mode 2: active members only

This is the usual ask: "CVs of all **active** members." Active membership is
defined in the DB, not in the application CSV.

```bash
node scripts/download-member-cvs.mjs "<csv>" --active-members
```

What it does:

1. Reads active members from prod Supabase (`members.member_status = 'active'`)
   using the service role in `server/.env`. Emails live on `auth.users`, so the
   script maps `user_id -> email` via the auth admin API.
2. Matches each active member to a CSV row by **email first**, then by
   normalized full name.
3. Downloads matched members' CVs into `data/cvs-active-members/`, named
   `FirstName_LastName.pdf`.
4. Is **PDF-only**: non-PDF uploads (stray images/docs) are skipped and
   reported.
5. Prints active members with **no matching CSV row** so you know who is still
   missing.

### Important: one CSV usually isn't enough

Each Tally export only covers the submissions of **that** application round. A
current active member who joined in an earlier semester and did not re-apply
will **not** be in a single semester's CSV. Expect most active members to be
unmatched from any one export.

To get full coverage, run with **multiple semester exports**. The script pools
rows across all CSVs (deduping by email; later CSV wins) and matches active
members against the combined pool:

```bash
node scripts/download-member-cvs.mjs \
  "<ss26.csv>" "<ws25.csv>" "<ss25.csv>" \
  --active-members
```

### Accumulating one export at a time

`data/cvs-active-members/` is additive: existing files are skipped, so you can
drop one new semester export, re-run, and only the newly-matched members are
fetched. Repeat with older exports until the "no matching CSV row" list is
empty (or only contains members who never submitted a CV).

```bash
# round 1
node scripts/download-member-cvs.mjs "<ss26.csv>" --active-members
# later, after exporting an older round
node scripts/download-member-cvs.mjs "<ws25.csv>" --active-members
```

## Flags

- `--active-members` — active-members mode (DB-driven matching).
- `--out <dir>` — output directory (defaults per mode above).
- `--force` — re-download files that already exist.

## Notes

- `data/` is gitignored. Downloaded CVs are personal member data and must
  **not** be committed.
- `@supabase/supabase-js` is a `server/` workspace dependency; the script
  resolves it from there, so run `pnpm install` first if active-members mode
  cannot load it.
- Prod reads are read-only. The script never writes to Supabase.
- Some active members have blank `given_name`/`surname` in the DB (unfilled
  profiles). Email matching still resolves them; their file is named from the
  CSV's name fields.
