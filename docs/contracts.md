# Contract Generator

The contract generator turns Legal & Finance contract templates into a guided workflow:

1. PnS creates a contract draft from an active DOCX template.
2. Legal & Finance reviews the generated DOCX and stored PDF.
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

Signature anchors are invisible images placed in the Word source document. The
server requires exactly one partner anchor and one board anchor.

The package and tier catalog is shared by client and server in `shared/src/contracts.ts`, so DOCX form data uses the same package labels, prices, and benefit lists.
The same shared catalog now owns the selectable a-la-carte add-ons. Templates
use the `selected_addons` multi-select field; rendering expands it into
`addon_terms`, fixed add-on totals, and an overall `total_amount_label`.

The current seeded template wording is converted from the real DOCX sources:

- `Sponsoringvertrag - TUM.ai e.V - Template - FF Entwurf (09. Februar 2026).docx`
- `Hackathon_Sponsoringvorlage.docx`
- `AI E-Lab_Sponsoringvorlage.docx`
- `Einzelevents_Sponsoringvorlage.docx`
- `Makeathon_Sponsoringvorlage.docx`

## Word Document Workflow

Legal uploads a `.docx` version for each active template. The server accepts
only these commands inside the Word document:

- `{{variable_name}}` for a variable configured on that template
- `{{IMAGE partner_signature_anchor}}` exactly once
- `{{IMAGE board_signature_anchor}}` exactly once

Every required template variable must appear in the Word document. Macros,
embedded files, active Word fields, external relationships, unknown commands,
and malformed placeholders are rejected.

The server fills the document, creates the two invisible signature images,
converts it with LibreOffice in a temporary Vercel Sandbox, and stores the DOCX
and PDF artifacts in private Supabase buckets. The stored PDF is the source
for preview and signing. Partner and board signatures replace the matching
invisible image positions.

The first ready document version becomes active when a template has no active
Word version yet. Replacement versions require Legal to review the stored PDF
preview and activate them explicitly. New submissions always use the active
DOCX version.

## Document Rendering

The server fills the uploaded Word document, starts a temporary Vercel Sandbox,
runs LibreOffice, and stores the DOCX and PDF artifacts in private Supabase
buckets. The stored PDF is used for preview and signing. Artifacts are stored as
they are, not encrypted: they reach the browser through short-lived signed URLs,
which have to serve bytes the browser can open. Reads still detect the encrypted
format written by earlier builds. `form_data_encrypted` and the render job
payloads remain encrypted.

Anchor detection runs pdf.js in Node, which needs a `DOMMatrix` the runtime does
not provide. pdf.js borrows one from `@napi-rs/canvas`, an optional dependency
loaded through a `require()` that Vercel file tracing cannot follow, so it is
absent from the deployed function. `lib/contracts/domMatrix.ts` installs a
pure-JS implementation before pdf.js loads, and the pdf.js worker is imported by
its literal path for the same reason — its own loader resolves the worker from a
runtime variable that cannot be traced either.

Submissions keep immutable rendered snapshots in `contract_document_versions`:

- draft/generated version when the submission is created
- legal-review version when Legal uploads an edited Word file
- sent version when Legal sends the one-time partner link
- final version when Legal finalizes after board signature

Historical text columns remain in the database so old records can still be
read, but the application no longer creates or edits text-engine documents.

### Render failures and recovery

A render job retries with backoff up to five times. The failure is logged and
kept on the row while it waits for the next attempt, so a document that reads
`Queued` with an error message is between attempts, not waiting its turn — the
template list shows that as **Retrying**. Only an exhausted or deterministic
failure ends as `Failed`.

An attempt is consumed when a job is claimed, so a worker killed mid-render
burns one without recording an error. `expire_contract_render_jobs()` runs on
every claim and fails such a job terminally once no attempts remain, instead of
leaving it `processing` forever. Leases are 120 seconds, below the 300 second
function limit.

Retry is available from the template list for a document that is `queued` or
`failed`, and `POST /api/contracts/submissions/:id/render/retry` does the same
for a submission's active document version. A job still holding a live lease is
left alone. Submission retries revive the existing job rather than enqueueing a
new one, because its stored payload is the only pointer to the DOCX Legal
uploaded.

## Partner Comments

Partner comments submitted from the public signing link are stored in
`contract_partner_comments` and mirrored into the historical `partner_comment`
column so older views keep working. Legal & Finance can add internal replies
from the submission detail page. When a contract is sent again, the public
signing page includes the full ordered thread.

## Statuses

Contract submissions move through these workflow statuses (`CONTRACT_WORKFLOW_STATUSES` in `shared/src/contracts.ts`):

- `draft`
- `legal_review`
- review outcomes set by Legal & Finance: `approved`, `rejected`, `inquiry`
- `sent_to_partner`
- `partner_comments`
- `partner_signed`
- `board_signed`
- `completed`

The legacy statuses `submitted`, `in_review`, and `signed` remain accepted for existing rows and review tooling; a new submission goes straight to `legal_review`.

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

Deployments that include contract workflow code require all contract migrations to land in `supabase/migrations/`. GitHub Actions applies pending production migrations on pushes to `main` and then checks migration parity with `pnpm supabase:migrations:check`. That check needs a linked project, and the repo never links to production locally, so read the results in the `Production Supabase Migration Drift` (PRs) and `Production Supabase Migrations` (`main`) jobs.

The app uses the server-side service-role Supabase client for public signing, board signing, and final PDF generation. Partner signing links and final PDF links are token-based and do not require partner authentication. Legal & Finance either shares the final PDF link with the partner manually or lets auto-finalization email it (see [Finalization](#finalization)).

Partner signing-link emails use Resend when `RESEND_API_KEY`,
`CONTRACT_EMAIL_FROM`, and a usable app base URL are configured. `APP_BASE_URL`
is preferred for link generation; if it is absent, the request origin is used.
Email delivery metadata is stored on the submission so Legal & Finance can see
the last recipient, sent timestamp, or delivery error.

## OpenSign

OpenSign is supported as the external partner signature provider while Member
Manager remains the place where Legal & Finance renders, reviews, and edits the
contract. Sending with OpenSign uploads the PDF of the sent DOCX document
version, places the signature widgets at the signature anchors detected in that
PDF, asks hosted OpenSign to email the partner, and still creates the in-app
signing token as a fallback.

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

Widget positions normally come from the anchors in the rendered PDF.
`OPENSIGN_WIDGETS_JSON` (a JSON widget array) and the built-in first-page
signature/date default only apply when a send passes no anchor-derived widgets.
