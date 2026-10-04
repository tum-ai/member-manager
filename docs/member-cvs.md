# Member CVs and Partner Export

How Member Manager stores member CVs, lets members keep them current, and
exposes them to the Partner Portal.

## Principle and boundary

- **Member Manager (this repo) is the source of truth for "what is this
  member's current CV right now".** It owns CV files and versions. Partner-
  sharing consent is not a CV-specific flag; it is the partner-sharing purpose
  of the member's Data Privacy Notice consents (see [Consent](#consent)).
- **Partner Portal is a separate product.** It owns partner accounts, payment
  plans, and **semester snapshots**. It consumes a server-to-server export from
  Member Manager, downloads each CV once into its own private storage, and
  freezes a snapshot. It never reads Member Manager storage live.

This keeps member UX in Member Manager, keeps partner access/billing in Partner
Portal, and avoids cross-app authorization coupling.

## Storage model

CV files live in a **private** Supabase Storage bucket `member-cvs`, PDF-only,
10 MB max. Files are **immutable and never overwritten**:

- Object path: `member-cvs/{user_id}/{cv_id}.pdf`.
- Metadata rows live in `public.member_cvs` (one immutable row per version).
- Exactly **one current CV per member** (partial unique index on
  `(user_id) WHERE is_current`).
- A new upload inserts version `N+1`, sets it current, and flips the previous
  row's `is_current` to `false`. The old object is kept.
- The version flip is performed atomically by the `insert_member_cv_version`
  RPC, which takes a per-`user_id` advisory lock. The server uploads the object
  first, then calls the RPC; concurrent uploads for the same member are
  serialized and a failed insert rolls back without losing the current CV.

`member_cvs` columns of note: `version`, `is_current`, `source`
(`application | member_upload | admin_upload`), `sha256`, `size_bytes`,
`supersedes_cv_id`, `revoked_at`.

Version 1 of most current members was backfilled from their application CV (see
[member-cv-download.md](./member-cv-download.md)).

## Consent

Partner sharing is **opt-in**. The Data Privacy Notice asks consent for three
purposes, each stored separately in `member_agreements`:
`website_profile_consent`, `event_photos_consent` and
`partner_sharing_consent`. Only `partner_sharing_consent` matters for CVs.
`consents_decided_at` is null until the member has saved a decision.

Members set the three purposes individually on `/welcome` (via
`PUT /api/members/:userId/consents`; undecided members are sent there after
login). The profile's Data Privacy Notice checkbox still accepts or revokes all
three at once. `data_privacy_notice_agreed` is kept as the "all three granted"
summary by the DB trigger `sync_member_agreement_consents`, so writers that only
know the summary keep working. The CV routes have no consent setter;
`GET …/cv/consent` is read-only and returns `{ consent: partner_sharing_consent }`.

A member only appears in the partner export if **all** of:

- `members.member_status = 'active'`
- `member_agreements.partner_sharing_consent = true`
- they have a current, non-revoked CV

## Member-facing APIs (authenticated)

Owner or admin only. Base64 JSON transport (consistent with the reimbursement
receipt flow); PDF-only; 10 MB max.

```txt
GET   /api/members/:userId/cv                 -> current CV metadata (no bytes)
POST  /api/members/:userId/cv                 -> upload new current version
GET   /api/members/:userId/cv/current/download -> PDF bytes (Content-Disposition)
GET   /api/members/:userId/cv/consent         -> { consent: boolean } (read-only, partner purpose)
GET   /api/members/:userId/consents           -> all per-purpose consents + consents_decided_at
PUT   /api/members/:userId/consents           -> save a full decision (owner only, never an admin)
```

The CV routes have no consent setter; consent is saved through
`/api/members/:userId/consents` or the profile's Data Privacy Notice.

`POST` body:

```json
{ "filename": "my_cv.pdf", "cv_base64": "<base64 PDF, optional data URL prefix>" }
```

## Partner Portal export contract

Server-to-server. **Not** behind the member JWT; authenticated with a static
bearer token (`PARTNER_EXPORT_TOKEN`, compared in constant time).

```txt
GET /api/internal/partner-portal/cv-export?semester=SS26
Authorization: Bearer <PARTNER_EXPORT_TOKEN>
```

> **`PARTNER_EXPORT_TOKEN` is an internal integration secret, not a partner
> credential.** Partners (paying companies) never see or use it. It is shared
> only between two TUM.ai-operated backends: Member Manager validates it, and
> the Partner Portal backend presents it. A TUM.ai admin sets the same secret
> string as an env var in both deployments (like a DB password) — it is never
> in client code, emailed to a company, or exposed in a browser. Partners
> authenticate to the **Partner Portal** with their own login + payment plan;
> the Portal then serves CVs from its own frozen snapshot. Revoking a company's
> access happens in the Partner Portal (cancel their plan), not by rotating
> this token.

- `semester` is **informational only** (echoed back, used by Partner Portal to
  label its snapshot). The export always returns the full set of currently
  active, consented members with a current CV. Batch is not a filter.
- Download URLs are **short-lived signed URLs (10 min)**. Partner Portal must
  download and store each PDF at snapshot time; it must not persist or re-use
  the signed URLs.

Response:

```json
{
  "semester": "SS26",
  "generated_at": "2026-05-28T18:30:00.000Z",
  "members": [
    {
      "member_manager_user_id": "uuid",
      "given_name": "Ada",
      "surname": "Lovelace",
      "email": "ada@example.com",
      "batch": "SS26",
      "department": "Engineering",
      "linkedin_profile_url": "https://www.linkedin.com/in/...",
      "cv": {
        "id": "uuid",
        "version": 3,
        "sha256": "hex",
        "filename": "ada_lovelace.pdf",
        "size_bytes": 482311,
        "mime_type": "application/pdf",
        "download_url": "https://.../sign/member-cvs/...?token=...",
        "uploaded_at": "2026-05-20T09:00:00.000Z"
      }
    }
  ],
  "revoked": [
    { "member_manager_user_id": "uuid", "reason": "cv_revoked" }
  ]
}
```

### Snapshot semantics (Partner Portal side)

- Partner Portal calls the export when an admin freezes a semester snapshot,
  copies every PDF into its own bucket, and records `sha256` + `version` so it
  can detect changes next semester.
- **Member uploads after a freeze do not change that frozen snapshot.** They
  surface in the next export, so the next semester's snapshot picks up the
  updated CV (a partner who paid for the year gets the refreshed versions of
  members they already had).

### Revocation

There are two revocation paths, handled differently to keep the export quiet:

- **Consent withdrawn**: member withdraws the partner-sharing purpose
  (`partner_sharing_consent = false`). They simply **drop out of `members[]`**.
  Partner Portal detects withdrawal by diffing its snapshot against `members[]`
  (in snapshot, absent from export = withdrawn). The export does **not**
  enumerate every non-consenting member (that would be noise on every call).
- **CV revoked / legal deletion**: a consenting member's current CV row gets
  `revoked_at` (so they have no current shareable CV). They appear in
  `revoked[]` with `reason: "cv_revoked"` as a positive signal.

Partner Portal should, on each export: (1) reconcile `revoked[]` against its
snapshots and delete matching copies, and (2) treat any snapshot member absent
from both `members[]` and `revoked[]` as consent-withdrawn.

## Operational notes

- All CV object reads/writes and signed-URL minting happen server-side with the
  Supabase service role. The bucket has no public or authenticated object
  policies.
- `PARTNER_EXPORT_TOKEN` must be a strong random secret, set in deployed envs.
- `data/` (local CV downloads) is gitignored; never commit CV files.
