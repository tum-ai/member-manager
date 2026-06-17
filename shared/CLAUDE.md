# shared/ — the client↔server contract

Framework-free TypeScript types + Zod schemas consumed by **both** client and server.
Package: `@member-manager/shared`. Source in `src/`, built with `tsc` to `dist/`
(`main: dist/index.js`).

## What lives here

- `src/contracts.ts` — request/response shapes for the API.
- `src/member.ts` — member types + `isActiveMember` and related helpers.
- `src/cv.ts` — CV types.
- `src/permissions.ts` — `Permission` union + permission helpers.
- `src/index.ts` — barrel re-export. Import via `@member-manager/shared`.

## Invariants

- **Framework-free.** No `react`, no `fastify`, no `@supabase/*` imports. Pure types + Zod only.
- **Single source of truth.** Client and server must consume these schemas, not redefine them.
  A Zod schema that exists here must not be duplicated in `client/src/lib` or `server/src`.
- **Named exports + `export type`** (Biome `noDefaultExport`/`useExportType`).
- **Rebuild after every change** — `pnpm build:shared`. A stale `dist/` silently breaks client and
  server typechecks. (`pnpm typecheck`/`test` rebuild it for you, but editors read `dist/`.)
- When a schema changes, update **both** consumers in the same change and keep DB columns in parity.

## Commands

- `pnpm build:shared` (alias for `pnpm --filter @member-manager/shared run build`)
- `pnpm --filter @member-manager/shared typecheck`
