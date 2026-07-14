# Contract Generator

The contract generator turns Legal & Finance contract templates into a guided workflow:

1. PnS creates a contract draft from an active template.
2. Legal & Finance reviews and edits the generated contract text.
3. Legal & Finance sends the contract to the partner through a one-time signing link or configured email.
4. The partner either signs or sends comments.
5. Comments return the submission to Legal & Finance for revision and resend.
6. After partner signature, a board member signs internally.
7. Legal & Finance finalizes the contract and gets a final PDF link to share with the partner.

Internal contract tools are available only to active members whose department
has the `contracts.admin` permission. The default migration grants this to
Legal & Finance and Partners & Sponsors; admins inherit all permissions.
Partner signing and final PDF links remain token-based public routes.

## Templates

Template source DOCX files are kept locally in `data/contracts/` and are intentionally ignored because `data/` can contain private or operational data. The seeded production templates live in Supabase migrations:

- `Long-Term Partnership`
- `EHL Hackathon Pass`
- `E-Lab Jury Seat`
- `Single Event Sponsorship`
- `Makeathon Sponsorship`

Template variables support the data types `TEXT`, `TEXTAREA`, `NUMBER`, `DATE`,
`BOOLEAN`, `SELECT`, `FILE`, and `EMAIL`. `EMAIL` behaves like `TEXT` but is
format-validated in the form and again on the server before a submission is
persisted.

Besides `{{variable}}` placeholders, the reserved tokens `{{partner_signature}}`
and `{{board_signature}}` can be placed anywhere in the contract text. They are
never substituted from form data; instead the PDF renderer draws the matching
signature image inline at that position once the party has signed (an
underscore placeholder line until then). Signatures without a matching token in
the text keep rendering on a trailing "Signaturen" page. The template editor
lists these tokens with copy buttons.

The package and tier catalog is shared by client and server in `shared/src/contracts.ts`, so preview rendering and server rendering use the same package labels, prices, and benefit lists.
The same shared catalog now owns the selectable a-la-carte add-ons. Templates
use the `selected_addons` multi-select field; rendering expands it into
`addon_terms`, fixed add-on totals, and an overall `total_amount_label`.

The current seeded template wording is converted from the real DOCX sources:

- `Sponsoringvertrag - TUM.ai e.V - Template - FF Entwurf (09. Februar 2026).docx`
- `Hackathon_Sponsoringvorlage.docx`
- `AI E-Lab_Sponsoringvorlage.docx`
- `Einzelevents_Sponsoringvorlage.docx`
- `Makeathon_Sponsoringvorlage.docx`

## Document Rendering

Preview rendering now happens on the server via `POST /api/contracts/templates/:id/preview`. The response contains canonical text plus escaped, page-oriented HTML used by the client for an A4/PDF-like preview.

Legal review uses the same page renderer for edited text via `POST /api/contracts/submissions/:id/preview`.

The document renderer mirrors the source Word templates' baseline page style:
A4 pages, approximately 2.5 cm side/top margins, 11 pt Arial-like body text,
1.5 line spacing, justified paragraphs, and centered contract titles.

Submissions keep immutable rendered snapshots in `contract_document_versions`:

- draft/generated version when the submission is created
- legal-review version when Legal saves edited text
- sent version when Legal sends the one-time partner link
- final version when Legal finalizes after board signature

The legacy `generated_contract_text` and `admin_edited_text` columns are retained for compatibility, but public signing and final PDF generation prefer the relevant immutable document version.

## Partner Comments

Partner comments submitted from the public signing link are stored in
`contract_partner_comments` and mirrored into the legacy `partner_comment`
column so older views keep working. Legal & Finance can add internal replies
from the submission detail page. When a contract is sent again, the public
signing page includes the full ordered thread.

## Statuses

Contract submissions use these workflow statuses:

- `draft`
- `legal_review`
- `sent_to_partner`
- `partner_comments`
- `partner_signed`
- `board_signed`
- `completed`

Legacy review statuses such as `submitted`, `in_review`, `approved`, `rejected`, `inquiry`, and `signed` remain accepted for existing rows and review tooling.

When Legal & Finance uses **Request Clarification**, the submission status is
set to `inquiry`. If contract email sending is configured, Member Manager emails
the original internal submitter with the clarification message and a link back
to the submission. Clarification is only available before approval.

Every status transition is recorded in `contract_status_events` and shown as a
timeline on the submission detail page, starting with the initial submission.
If email is configured, status changes also notify the legal mailbox
(`CONTRACT_LEGAL_EMAIL`) and the submitter.

Contracts admins can set the status directly via a dropdown on the detail page.
Manual overrides are restricted to the review statuses (`submitted`,
`legal_review`, `in_review`, `inquiry`, `approved`) on both ends — the server
rejects anything else — and are tagged "Manual override" in the timeline.
Partner/board signing and completion always go through their dedicated flows.

Sending to the partner requires an explicit approval first. A contract already
at `sent_to_partner` can be re-sent through a different channel (link, email,
OpenSign) after an explicit confirmation dialog.

## Finalization

After the board signature, Legal & Finance generates the final PDF link
manually, or the submission auto-finalizes when its opt-in
"Auto-send to partner after board signs" flag is set: the final document
version is created and the partner is emailed a "View signed contract" link.
The submission is only marked `completed` after that email succeeds; on
failure it stays at `board_signed` with the error stored on the submission, and
the manual finalize flow serves as the retry. Regenerating the final PDF always
rebuilds from the latest non-final document version and issues a fresh token,
invalidating any previously shared final-PDF link.

## Production

Deployments that include contract workflow code require all contract migrations to land in `supabase/migrations/`. GitHub Actions applies pending production migrations on pushes to `main` and then checks migration parity. To inspect the linked project manually:

```bash
pnpm supabase:migrations:check
```

The app uses the server-side service-role Supabase client for public signing, board signing, and final PDF generation. Partner signing links and final PDF links are token-based and do not require partner authentication. The current product generates the final PDF link; Legal & Finance shares that link with the partner.

Partner signing-link emails use Resend when `RESEND_API_KEY`,
`CONTRACT_EMAIL_FROM`, and a usable app base URL are configured. `APP_BASE_URL`
is preferred for link generation; if it is absent, the request origin is used.
Email delivery metadata is stored on the submission so Legal & Finance can see
the last recipient, sent timestamp, or delivery error.

## OpenSign

OpenSign is supported as the external partner signature provider while Member
Manager remains the place where Legal & Finance renders, reviews, and edits the
contract. Sending with OpenSign generates the reviewed PDF from the current
Member Manager text, asks hosted OpenSign to email the partner, and still
creates the in-app signing token as a fallback.

Required server configuration:

```env
OPENSIGN_API_TOKEN=...
OPENSIGN_BASE_URL=https://eu-app.opensignlabs.com/api/v1.2
OPENSIGN_WEBHOOK_SECRET=...
```

`OPENSIGN_API_TOKEN` comes from the hosted OpenSign account. `OPENSIGN_BASE_URL`
can be changed if the account is not on the EU host. `OPENSIGN_WEBHOOK_SECRET`
must match the secret configured in OpenSign for the webhook that points to:

```text
https://<member-manager-host>/api/webhooks/opensign
```

The webhook marks the submission as `partner_signed` once OpenSign reports a
completed document and stores the signed file/certificate URLs when OpenSign
sends them. If webhooks are not enabled in the OpenSign plan yet, Legal &
Finance can still send via OpenSign, but completion will need manual follow-up
or the in-app fallback signature link.

OpenSign signature field positions are configurable with
`OPENSIGN_WIDGETS_JSON`. Leave it empty for the default first-page signature and
date widgets; set it to the JSON widget array exported/tested from OpenSign if
Legal needs exact placement for the final contract template.
