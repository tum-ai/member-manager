# Profile saving

How the profile page (`/`) reads and writes a member's data. Code rules live in
[`client/AGENTS.md`](../client/AGENTS.md) and [`server/AGENTS.md`](../server/AGENTS.md); this page
explains the design and why it looks like this (#397).

## One contract

`shared/src/profile.ts` is the only definition both sides use.

| Piece | Purpose |
| --- | --- |
| `GET /api/profile/:userId` → `ProfileResponse` | Member row, bank details and agreements, the profile `version`, and the `completeness` the server computed from stored data |
| `PUT /api/profile/:userId` ← `ProfileUpdate` | One atomic save of member row, bank details and agreements. Sends the `version` the client read |
| `profileMemberInputSchema` | Member fields of a save. Omitted keys stay as stored (merge), `""`/`null` clear |
| `computeProfileCompleteness` | Completeness. Counts stored values only: a Slack name or current batch merely suggested by the form never counts until saved |

The old `GET/PUT /api/members/:id` and `/api/sepa/:id` stay for admin and reimbursement use.

## Atomic and versioned

- `public.save_member_profile()` (migration `20261120120000`) writes `members`, `sepa` and
  `member_agreements` in one transaction. A failure leaves nothing behind.
- `members.version` is an opaque, increasing number. Triggers bump it on every write to the member,
  `sepa` or `member_agreements` row, whoever writes. A save with a stale `version` is rejected with
  **412** and the current profile in the body (`code: "profile_version_conflict"`); the client never
  retries on its own.
- Rules: members cannot write `member_role`/`department` (`lib/profile/memberUpdatePolicy.ts`), saved
  bank details cannot be cleared, and `data_privacy_notice_agreed` is only written when answered
  (see [`.agents/rules/bank-details.md`](../.agents/rules/bank-details.md)).

## Client

- `useProfileQuery` + `useSaveProfile` talk to the contract; the save response replaces the cached
  profile.
- The form is **one flat react-hook-form** (`profileFormModel.ts`) hydrated by
  `hooks/useServerBackedForm`: server data updates fields the member has not touched and never
  overwrites edited ones. `markSaved` / `resetTo` re-baseline it.
- A 412 shows `ProfileConflictBanner`: the member's edits stay in the form, and they choose "Keep my
  changes" (review on top of the latest version, then save again) or "Discard my changes and reload".

## Why this exists (#397)

Members saw Batch and Salutation empty and a lower completeness after switching away and back.
Three causes, all fixed:

1. The form was re-hydrated with `reset()` whenever query data or the auth `user` object changed.
   Window-focus refetches and supabase-js re-emitting `SIGNED_IN` (a new user object on every tab
   refocus) therefore wiped unsaved input.
2. Controlled Radix selects read their value with `form.watch()`. When the form is hydrated from the
   query cache (coming back to the page), the reset runs after the first render and `watch()` kept
   returning the empty defaults, so saved Batch and Salutation showed as "None". Use `useWatch`.
3. The form displayed defaults (current batch, Slack name) that were never saved and counted them
   toward completeness. They are now explicit "Suggested for you" values.

Regression tests: `useServerBackedForm.test.tsx`, `useProfileForm.test.tsx`,
`ProfilePageRender.test.tsx` ("already cached"), `server/test/routes/profile.test.ts`,
`server/test/migrations/memberProfileMigration.test.ts` and `e2e/profile-unsaved-edits.spec.ts`.
