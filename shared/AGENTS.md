# shared/ — the client↔server contract

Framework-free TypeScript types + Zod schemas consumed by **both** client and server.
Package: `@member-manager/shared`. Source in `src/`, built with `tsc` to `dist/`
(`main: dist/index.js`). Import everything via `@member-manager/shared`.

## What lives here

| Module | Contents |
| --- | --- |
| `src/member.ts` | member domain: roles, statuses, `isActiveMember` and related helpers |
| `src/permissions.ts` | department-scoped RBAC: `Permission` union + helpers |
| `src/finance.ts` | finance tool + BuchhaltungsButler schemas (the largest module) |
| `src/reimbursements.ts` | reimbursement submission types, statuses, request shapes |
| `src/sepa.ts`, `src/iban.ts` | SEPA bank-detail schema; `ibanSchema`, `normalizeIban`, `isValidIban` |
| `src/contracts.ts` | legal-contract catalog: variable/condition types, workflow + review statuses |
| `src/contractSchemas.ts` | Zod schemas for the contract routes (templates, documents, submissions) |
| `src/cv.ts` | member CV types and the size cap |
| `src/jobs.ts`, `src/partners.ts` | job postings and partner management |
| `src/educationCourses.ts` | educational course roles, statuses, date helpers |
| `src/index.ts` | barrel re-export of all of the above |

Tests live in `shared/test/` and run with `node --test` against the built `dist/`.

## Invariants

- **Framework-free.** No `react`, no `fastify`, no `@supabase/*` imports. Pure types + Zod only.
- **Single source of truth.** Client and server must consume these schemas, not redefine them.
  A Zod schema that exists here must not be duplicated in `client/src/lib` or `server/src`.
- **Named exports + `export type`** (Biome `noDefaultExport`/`useExportType`); re-export new
  modules from `src/index.ts`.
- **Rebuild after every change** — `pnpm build:shared`. Consumers read `dist/`; a stale build makes
  editors and one-off `tsx` runs disagree with CI.
- When a schema changes, update **both** consumers in the same change and keep DB columns in parity.
- IBAN/SEPA/reimbursement payment fields have extra rules: `.agents/rules/bank-details.md`.

## Commands

- `pnpm build:shared` (alias for `pnpm --filter @member-manager/shared run build`)
- `pnpm --filter @member-manager/shared test` (builds, then `node --test`)
- `pnpm --filter @member-manager/shared typecheck`
