# server/ — Fastify backend

Fastify 5 + Zod + Supabase JS. Package: `@member-manager/server`. ESM (`.js` import specifiers).

## Module map

- `src/routes/*.ts` — one Fastify plugin per domain, e.g. `export async function tumaiDaysRoutes(server)`.
  Registered in `src/app.ts`. Exemplar: `routes/tumaiDays.ts`.
- `src/lib/`
  - `auth.ts` — `checkAdminRole`, `checkDepartmentPermission` (department-scoped RBAC).
  - `departmentPermissions.ts` — department→permission mapping.
  - `sensitiveData.ts` — **field-level encryption** (`enc-v1:` AES-GCM). `SENSITIVE_MEMBER_FIELDS`,
    `SENSITIVE_SEPA_FIELDS`, `SENSITIVE_REIMBURSEMENT_FIELDS`. Key rotation uses
    `FIELD_ENCRYPTION_KEY_FALLBACKS` plus `rotate:encryption`.
  - `errors.ts` — typed errors (`AppError`, `ValidationError`, `NotFoundError`, `ForbiddenError`,
    `UnauthorizedError`, `ConflictError`, `DatabaseError`, `isNotFoundError`).
  - `supabase.ts` — `getSupabase()` (service client). The only Supabase entry point.
- `src/plugins/errorHandler.ts` — central handler mapping typed errors → HTTP responses.
- `src/middleware/auth.ts` — `authenticate` + `require*` preHandlers.
- `src/scripts/` — one-off maintenance (`rotateSensitiveData.ts`, `backfillMemberCvs.ts`).
- `src/test/` — `node --test` suites + c8 coverage.

## Invariants

- **Zod-validate every input** (`safeParse` body/params/query) before use.
- **Encrypt sensitive fields via `sensitiveData.ts`.** Never log, return, or seed plaintext
  IBAN/BIC/address/DOB/phone. Security-critical — treat a plaintext leak as a bug to block.
- **AuthZ on every route** — `authenticate` + the right `require*`/`checkDepartmentPermission`.
- **Throw typed errors** from `lib/errors.ts`; let `plugins/errorHandler.ts` shape the response.
  Don't hand-build 500s in routes beyond the existing `safeParse` 400 pattern.
- **Supabase only via `getSupabase()`** from `lib/supabase.ts`.
- **Consume `shared/` schemas** — don't redefine the contract. Change `shared/` first, then
  `pnpm build:shared`, then update server.
- **Tests** — `node --test` + c8 floors (lines/funcs/stmts ≥ 70, branches ≥ 50). New code ships tested.

## Commands

- `pnpm --filter @member-manager/server dev`
- `pnpm --filter @member-manager/server test` (`node --test` + c8)
- `pnpm --filter @member-manager/server typecheck`
