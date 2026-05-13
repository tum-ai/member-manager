# BuchhaltungsButler sync + Slack finance workflow

Research date: 2026-05-12  
Worktree: `../member-manager-bb-sync`  
Branch: `feat/buchhaltungsbutler-sync`

## Sources checked

### BuchhaltungsButler

- Official API setup/help: https://wissen.buchhaltungsbutler.de/hc/de/articles/11468075328797-Einrichtung-der-API-Schnittstelle
- Official API reference shell: https://app.buchhaltungsbutler.de/docs/api/v1/
- Official Swagger/OpenAPI JSON: https://app.buchhaltungsbutler.de/docs/api/v1.de.json
- Receipt upload workflow help: https://wissen.buchhaltungsbutler.de/hc/de/articles/11443147763101-Belege-hochladen-und-verarbeiten
- Receipt accounting/payment assignment: https://wissen.buchhaltungsbutler.de/hc/de/articles/16331531911837-Buchhaltung-und-Zahlungszuordnung-am-Beleg
- Receipt matching: https://wissen.buchhaltungsbutler.de/hc/de/articles/11443781087389-Belegmatching-verstehen-und-optimieren

### Slack

- Verify Slack requests: https://api.slack.com/docs/verifying-requests-from-slack
- Handle interactions / 3-second ACK: https://docs.slack.dev/interactivity/handling-user-interaction/
- Block actions payloads: https://docs.slack.dev/reference/interaction-payloads/block_actions-payload
- Button element: https://docs.slack.dev/reference/block-kit/block-elements/button-element/
- Confirmation dialogs: https://docs.slack.dev/reference/block-kit/composition-objects/confirmation-dialog-object/
- Actions block: https://docs.slack.dev/reference/block-kit/blocks/actions-block/
- DMs: https://docs.slack.dev/reference/methods/conversations.open/
- Message send: https://docs.slack.dev/reference/methods/chat.postMessage/
- Email lookup: https://docs.slack.dev/reference/methods/users.lookupByEmail/

## Current app state

Member Manager currently handles:

1. Member submits reimbursement/vendor invoice with receipt.
2. Legal & Finance/admin reviews.
3. Reviewer approves/rejects.
4. Reviewer marks approved requests as paid.
5. Slack optionally sends plain-text DMs for new requests and status changes.

There is no BuchhaltungsButler state, API client, export, or reconciliation today. The only BuchhaltungsButler mention is in the privacy policy.

## BuchhaltungsButler API findings

### Auth

The API uses Basic Auth, not OAuth.

Required credentials:

- API Client
- API Secret
- customer `api_key`

Requests use HTTP Basic Auth with `API Client:API Secret`, plus the target customer `api_key` as a request form field.

### Base URL / reference

Swagger version: `1.9.1`  
Host from Swagger: `webapp.buchhaltungsbutler.de`  
API path: `https://webapp.buchhaltungsbutler.de/api/v1`

### Limits

The official docs page states a general limit of **100 requests per customer per minute**.

`/receipts/upload` additionally states: **max 10 requests per minute**.

### Relevant endpoint families

From the official Swagger JSON:

- Receipts
  - `POST /receipts/upload` — upload receipt file and metadata
  - `POST /receipts/add` — add receipt metadata without file
  - `POST /receipts/get` — list receipts
  - `POST /receipts/get/id_by_customer` — fetch one receipt, optionally with base64 file
- Transactions
  - `POST /transactions/add` — add payment transaction
  - `POST /transactions/assign/receipt` — assign receipt to transaction
- Postings
  - `POST /postings/add/receipt` — add receipt posting
  - requires creditor/debtor posting to be active
- Comments
  - `POST /comments/add` — comment on receipt or transaction
- Accounts/settings/cost locations
  - useful for configuration validation and future account mappings

### Best receipt upload target

Use `POST /receipts/upload` with base64 receipt data.

Important parameters:

- `api_key` — required
- `file` — required; real upload or base64 string
- `file_name` — required when `file` is base64
- `type` — required; for our use case: `invoice inbound`
- Optional metadata:
  - `account`
  - `creditor_debtor`
  - `counterparty`
  - `invoice_number`
  - `date`
  - `amount`
  - `currency` (`EUR`)
  - `vat_rate`
  - `date_delivery`
  - `date_payment_due`
  - `link_to_receipt_id_by_customer`

Successful response includes:

- `success: true`
- `id_by_customer`
- `filename` (internal filename without extension)

### Mapping for Member Manager

For both current `submission_type` values, upload as:

- `type = invoice inbound`
- `file = reimbursements.receipt_base64`
- `file_name = reimbursements.receipt_filename`
- `date = reimbursements.date`
- `amount = reimbursements.amount`
- `currency = EUR`

Do **not** initially send `counterparty`, `invoice_number`, or `vat_rate` unless we add explicit fields/extraction. Current `description` is not reliable enough to be an accounting counterparty. Let BuchhaltungsButler process/OCR the document, then finance can correct there.

Use `/comments/add` after upload for traceability:

```text
Member Manager request <uuid>; type=<reimbursement|invoice>; requester=<name/email>; department=<department>
```

### Payment/transaction sync caution

`POST /transactions/add` can create transactions, and `/transactions/assign/receipt` can attach a receipt to a transaction. However, adding transactions can duplicate real bank-imported transactions if BuchhaltungsButler already imports bank movements.

Recommendation:

- Phase 1: only sync approved receipts to BuchhaltungsButler and add a comment.
- Keep `mark_paid` in Member Manager as the source of payout status.
- Do not create BuchhaltungsButler transactions by default.
- Add optional transaction creation later only if Legal & Finance confirms no duplicate bank-import risk and provides a configured payment account.

## Slack API findings

### Current code

`server/src/lib/slackNotifier.ts` already:

- looks up Slack user IDs by auth email via `users.lookupByEmail`
- sends plain text DMs using `chat.postMessage`

### Recommended Slack changes

Use Block Kit DMs for finance reviewers:

- new request message with summary fields
- `Open review` URL button
- `Approve` button with confirmation dialog
- `Approve & sync BB` button with confirmation dialog
- `Reject` should link to Member Manager review, because rejection needs a reason; implementing a Slack modal is a larger second step

Incoming Slack actions use:

- endpoint: `POST /api/slack/interactions`
- `X-Slack-Signature` and `X-Slack-Request-Timestamp` verification via `SLACK_SIGNING_SECRET`
- `application/x-www-form-urlencoded` payload parsing
- fast HTTP 200 responses with ephemeral result text
- Slack user ID → `users.info` email → Supabase auth user mapping
- finance reviewer/admin authorization before approve or approve-and-sync actions

DM best practice:

1. Use `users.lookupByEmail` when starting from email.
2. Use `conversations.open` with user ID to get the app DM channel.
3. Use `chat.postMessage` to that DM channel.

Scopes needed:

- `chat:write`
- `users:read.email`
- `users:read` if using `users.info` for incoming-action identity
- `im:write` for `conversations.open`

## Recommended product flow

### Submit

No BuchhaltungsButler sync on member submission. Requests may still be rejected or edited.

### Approve

Approving keeps current state behavior and unlocks sync.

Optional later: `BB_AUTO_SYNC_ON_APPROVE=true`, but default should be manual.

### Sync to BuchhaltungsButler

Reviewer clicks `Sync to BuchhaltungsButler` in Member Manager or Slack.

Backend checks:

- requester is finance reviewer/admin
- request exists
- request is approved
- receipt exists
- request has no existing `bb_receipt_id_by_customer` unless forced

Backend then:

1. Calls `/receipts/upload`.
2. Stores returned `id_by_customer` and `filename`.
3. Adds `/comments/add` traceability comment.
4. Updates sync state to `synced` or `failed`.
5. Notifies finance in Slack.

### Mark paid

Reviewer marks paid as today.

Recommended Phase 1 behavior:

- update Member Manager `payment_status/status`
- DM requester
- optionally add a BuchhaltungsButler comment if already synced
- do not create BB transaction unless explicitly configured later

## Data model recommendation

Add fields to `reimbursements`:

```sql
bb_sync_status text not null default 'not_synced'
  check in ('not_synced', 'pending', 'synced', 'failed')
bb_receipt_id_by_customer text
bb_receipt_filename text
bb_synced_at timestamptz
bb_sync_error text
bb_sync_attempts integer not null default 0
bb_last_sync_attempt_at timestamptz
bb_synced_by uuid references public.members(user_id)
```

Optional later:

```sql
bb_transaction_id_by_customer text
bb_posting_status text
bb_last_comment_at timestamptz
```

## Environment variables

Required for BB sync:

```bash
BUCHHALTUNGSBUTLER_API_CLIENT=
BUCHHALTUNGSBUTLER_API_SECRET=
BUCHHALTUNGSBUTLER_API_KEY=
BUCHHALTUNGSBUTLER_API_BASE_URL=https://webapp.buchhaltungsbutler.de/api/v1
```

Optional behavior flags:

```bash
BUCHHALTUNGSBUTLER_SYNC_ENABLED=true
BUCHHALTUNGSBUTLER_AUTO_SYNC_ON_APPROVE=false
```

Required for interactive Slack actions:

```bash
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
```

The Slack app must enable interactivity with request URL `<APP_BASE_URL>/api/slack/interactions` and include `chat:write`, `users:read`, `users:read.email`, and `im:write` scopes.

## Implementation plan

1. Add DB migration for BuchhaltungsButler sync state.
2. Add `server/src/lib/buchhaltungsbutler.ts`:
   - credential loading
   - form request helper
   - `/receipts/upload`
   - `/comments/add`
   - typed errors
3. Add service function around reimbursements:
   - `syncApprovedReimbursementToBuchhaltungsButler(requestId, reviewerUserId, force?)`
   - idempotent; stores state; never leaks secrets.
4. Add route:
   - `POST /api/reimbursements/review/:requestId/buchhaltungsbutler-sync`
   - auth: finance reviewer/admin
5. Update Finance Review UI:
   - show BB sync chip/status
   - add sync button for approved not-yet-synced requests
   - show error text for failed sync
6. Upgrade Slack notifier:
   - Block Kit DMs
   - `Open review` button
   - `Approve` and `Approve & sync BB` buttons
7. Add Slack interactions route:
   - raw form body parser
   - signature verification
   - reviewer authorization
   - handle actions:
     - `reimbursement_approve`
     - `reimbursement_approve_sync_bb`
     - `open_reimbursement_review` as URL button only
8. Tests:
   - BB client success/failure parsing
   - reimbursement sync idempotency and status transitions
   - route auth
   - Slack signature verification
   - Slack action authorization

## Open decisions

1. Should sync be manual only, or automatic after approve?
   - Recommendation: manual first.
2. Should mark-paid create BuchhaltungsButler transactions?
   - Recommendation: no by default; too much duplicate-risk with bank import.
3. Do we want explicit accounting metadata fields now?
   - Recommendation: not required for Phase 1; upload receipt + amount/date/currency and let BB OCR/accounting workflow handle counterparty/vat.
4. Should Slack approve be enabled immediately?
   - Recommendation: yes for approve with confirmation; no for reject until we add a modal/reason flow.
