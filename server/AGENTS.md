# server/ — Fastify backend

Fastify 5 + Zod + Supabase JS. Package: `@member-manager/server`. ESM (`.js` import specifiers).
In production it runs as one Vercel function (`api/[...path].ts` imports `server/dist/app.js`).

## Module map

- `src/routes/*.ts` — one Fastify plugin per domain, e.g. `export async function tumaiDaysRoutes(server)`.
  Registered in `src/app.ts`. Exemplar: `routes/tumaiDays.ts`. Contracts are split into
  `routes/contracts.ts` + `routes/contracts/`.
- `src/lib/`
  - `auth.ts` — `checkAdminRole`, `checkDepartmentPermission` (department-scoped RBAC).
  - `departmentPermissions.ts` — department→permission mapping.
  - `sensitiveData.ts` — **field-level encryption** (`enc-v1:` AES-GCM). `SENSITIVE_MEMBER_FIELDS`,
    `SENSITIVE_SEPA_FIELDS`, `SENSITIVE_REIMBURSEMENT_FIELDS`. Key rotation uses
    `FIELD_ENCRYPTION_KEY_FALLBACKS` plus `rotate:encryption` (runbook: `docs/deployment.md`).
  - `errors.ts` — typed errors: `AppError`, `ValidationError`, `NotFoundError`, `ForbiddenError`,
    `UnauthorizedError`, `ConflictError`, `DatabaseError`, `BadGatewayError`,
    `ServiceUnavailableError`, plus `isNotFoundError`.
  - `supabase.ts` — `getSupabase()` (service client). The only Supabase entry point.
- `src/plugins/errorHandler.ts` — central handler mapping typed errors → HTTP responses.
- `src/middleware/auth.ts` — `authenticate` + `require*` preHandlers (`requireAdmin`,
  `requireFinanceViewer`, `requireCronOrTumaiDaysManager`, …).
- `src/scripts/` — maintenance scripts (`rotate:encryption`, `backfill:encryption`,
  `backfill:member-cvs`).
- `test/` — `tsx --test` suites (`routes/`, `lib/`, `unit/`, `migrations/`, `mocks/`); `test/setup.ts`
  fills in test env defaults.

## Integrations

| Area | Code | Notes |
| --- | --- | --- |
| Finance / BuchhaltungsButler | `lib/buchhaltungsbutler*.ts`, `lib/finance*.ts`, `routes/finance*.ts` | `docs/finance-cost-location-mapping.md` |
| Contracts | `routes/contracts*`, `lib/contracts/`, `lib/openSign.ts`, `lib/contractEmails.ts` (Resend) | DOCX → PDF via the LibreOffice sandbox (`infra/libreoffice/`); `docs/contracts.md` |
| Slack | `lib/slackNotifier.ts`, `routes/slackInteractions.ts` | DMs and interactive buttons |
| Bug reports | `lib/githubIssues.ts`, `routes/bugReports.ts` | GitHub App creates issues |
| Receipts | `lib/receiptProcessing.ts`, `lib/reimbursementReceipts.ts` | OpenAI extraction; files in Supabase Storage |
| Partner portal / jobs | `lib/partnerPortal.ts`, `routes/partners.ts`, `routes/jobs.ts` | CV export for partners |
| Crons | `vercel.json` `crons` | `/api/tum-ai-days/send-pending` (10 min), `/api/contracts/render-jobs` (1 min); authorized by `CRON_SECRET` |

**Mock vs live.** Local and E2E runs must not reach real services. The local stack stubs bug-report
issues and their Slack post (`installLocalBugReportStub`, `installLocalBugReportSlackStub`), E2E
sets `CONTRACT_DOCX_CONVERTER_MODE=fake` (forbidden in production) and uses
`e2e/partner-portal-stub.mjs`. `pnpm test:e2e:finance-live` calls the real BuchhaltungsButler API;
only run it when asked.

## Invariants

- **Zod-validate every input** (`safeParse` body/params/query) before use.
- **Encrypt sensitive fields via `sensitiveData.ts`.** Encrypt on write; decrypt only for callers
  allowed to see the value. Never log, return, or seed plaintext IBAN/BIC/bank name/address/DOB/phone.
  Security-critical — treat a plaintext leak as a bug to block.
- **AuthZ on every route** — `authenticate` + the right `require*`/`checkDepartmentPermission`.
- **Throw typed errors** from `lib/errors.ts`; let `plugins/errorHandler.ts` shape the response.
  Don't hand-build 500s in routes beyond the existing `safeParse` 400 pattern.
- **Supabase only via `getSupabase()`** from `lib/supabase.ts`.
- **Consume `shared/` schemas** — don't redefine the contract. Change `shared/` first, then
  `pnpm build:shared`, then update server.
- **Updates merge, they don't replace.** A PATCH handler or update RPC that rebuilds the whole row
  wipes every field the caller didn't send (#317, #318, #319). Read the stored row, merge the
  change, and treat "omitted" differently from `null`. Add a test that an unrelated edit keeps the
  other fields.
- **Background work fails loudly.** Cron handlers and render jobs must log failures, not only store
  them in a table (#350 went unnoticed for three weeks). Don't swallow errors with
  `.catch(() => undefined)` outside best-effort cleanup. Call logger methods on the logger object
  (`request.log.error(...)`); a detached `log.error` loses its `this`. Check retry eligibility and
  reset a job in the same locked transaction.
- **Slack messages** — when a message has both `text` and `blocks`, Slack shows only the blocks.
  Build both from one helper and escape user-supplied text (#352).
- **Caching** — an endpoint that always serves the latest version of something (e.g. the current CV
  download) sends `Cache-Control: private, no-store` (#353).
- **Large route files** — `routes/reimbursements.ts` and `routes/admin.ts` are already far past the
  client size limits. Put new logic in `lib/` modules instead of growing them.

## Production-only traps (Vercel)

- **Rewrite `path` param.** `vercel.json` maps `/api/:path*` onto `/api/[...path]` and forwards the
  segment as a `path` query parameter, so every deployed request carries a key the client never
  sent. Never `.strict()` a query-string schema; params schemas are fine (#309, #322).
- **Untraceable requires.** Vercel file tracing can't follow `createRequire`, platform-conditional,
  or `import(variable)` lookups, so those packages are missing from the bundle while dev and CI stay
  green. pdf.js needs `DOMMatrix`, so we install a pure-JS one before it loads, and import its worker
  by literal path (#350). Prefer pure-JS dependencies and test the "package absent" case.
- **4.5 MB body cap** on function requests and responses. Files go straight to Supabase Storage via a
  server-minted signed upload URL; only `{storage_path, filename}` crosses `/api/*`, and downloads
  redirect to a short-lived signed URL (`lib/reimbursementReceipts.ts`, #326).
- **`tsc` builds the function.** Dev runs `tsx`, which doesn't typecheck; `pnpm build` must pass.
- **Duration** — the function has `maxDuration: 300`; long work belongs in a cron-driven job.

## Tests

- `pnpm --filter @member-manager/server test` runs `tsx --test` with **no coverage**.
  `test:coverage` adds c8 with floors lines/funcs/stmts ≥ 70, branches ≥ 50; CI runs that one.
  Never lower the floors.
- One file: `pnpm --filter @member-manager/server exec tsx --test test/routes/cv.test.ts`.
  `test/error-handling.test.ts` currently fails when run alone (it depends on state from other
  files), so confirm a failure there with the full suite.
- Don't mutate `process.env` inside a test; inject the value (a parameter or gate function) instead.
- RLS/migration tests in `test/migrations/` only run with `RUN_LOCAL_SUPABASE_RLS_TESTS=true` against
  a local stack; see `supabase/AGENTS.md`.

## Commands

- `pnpm --filter @member-manager/server dev`
- `pnpm --filter @member-manager/server test` / `test:coverage`
- `pnpm --filter @member-manager/server typecheck`
