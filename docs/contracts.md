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
