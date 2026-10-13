# Door PINs

Every member can have one PIN for the TUM.ai office key cabinet (Traka21). The cabinet is the source
of truth; the portal mirrors its PINs so members can look theirs up.

## What members see

The profile has a **Door PIN** card, masked until the member clicks "Show PIN". The server only
hands a member their own PIN once they have saved a decision on `/welcome`
(`member_agreements.consents_decided_at`). Until then the card links to `/welcome`. Members without
a PIN are told to ask the board.

## Storage and access

- `public.member_door_pins`: one row per member (`user_id` → `members`), `pin` as `enc-v1:`
  ciphertext (`SENSITIVE_DOOR_PIN_FIELDS` in `server/src/lib/sensitiveData.ts`). A trigger refuses
  plaintext, and `anon`/`authenticated` have no access. Everything goes through the API.
- `GET /api/members/:userId/door-pin` serves the owner (with the `/welcome` gate) or an admin.
  `PUT`/`DELETE /api/admin/members/:userId/door-pin` and `POST /api/admin/door-pins/import` are
  admin only. Responses are `Cache-Control: private, no-store`, and logs carry ids only, never a
  PIN.
- PINs are unique, as Traka21 requires. Setting or importing a PIN that another member holds is
  refused.
- Merging duplicate members keeps the target's PIN, or moves the source's when the target has none.
- Key rotation (`rotate:encryption`) covers the table.

## Importing the cabinet sheet

1. Export the user sheet from the cabinet ("Traka21 Benutzer & Schlüssel", `.xlsx`), or use the
   filled sheet you are about to load into it. The importer reads the header row (Vorname,
   Nachname, Kontakt, PIN, Admin, Löschen) and matches **Kontakt** (email) to the members' login
   email, ignoring case.
2. Admin → Members → **Import door PINs**, then pick the file. The sheet is parsed in the browser,
   and the server runs a dry run that stores nothing:
   - **added / changed / already up to date**: what applying will do;
   - **no member account with this email**: the sheet email differs from the member's Slack login,
     or they have no account yet;
   - **rejected**: an invalid email or PIN, a repeated email or PIN in the sheet, or a PIN another
     member keeps;
   - **skipped**: the cabinet admin, rows marked Löschen, rows without an email or PIN;
   - **active members still without a PIN**.
3. **Apply** stores the added and changed PINs. Members not in the sheet keep their PIN.
4. Fix the leftovers by hand: Admin → Members → edit the member → **Door PIN** (show, set, or clear).
   Keep the cabinet in sync; the portal doesn't write back to it.

The sheet holds every member's PIN. Don't commit it or post it in Slack; delete local copies once
it's imported. `e2e/fixtures/door-pins-traka.xlsx` is a synthetic sheet with fake PINs.
