---
paths: ["server/**"]
---

# Server rules (Fastify)

- **Route shape**: one Fastify plugin per domain in `routes/*.ts`
  (`export async function <domain>Routes(server)`), registered in `app.ts`. Exemplar:
  `server/src/routes/tumaiDays.ts`.
- **Validate every input** with Zod (`safeParse` body/params/query) before use; 400 + flattened error
  on failure.
- **Encryption is security-critical.** Sensitive fields (IBAN/BIC/address/DOB/phone) are encrypted via
  `lib/sensitiveData.ts`. **Never log, return, or seed plaintext.** Encrypt on write; decrypt only for
  authorized callers.
- **AuthZ on every route** — `authenticate` + the right `require*` (`middleware/auth.ts`) or
  `checkDepartmentPermission`/`checkAdminRole` (`lib/auth.ts`).
- **Typed errors**: throw `AppError` subclasses from `lib/errors.ts`; the central
  `plugins/errorHandler.ts` maps them to HTTP. Don't hand-build 500s.
- **Supabase** only via `getSupabase()` from `lib/supabase.ts`.
- **Shared contract**: consume `@member-manager/shared` schemas; change `shared/` first +
  `pnpm build:shared` when shapes change.
- **Biome**: tabs, double quotes, named exports, `import type`, no non-null `!`, `throw new Error`.
- **Tests**: `node --test` + c8 floors (lines/funcs/stmts ≥ 70, branches ≥ 50); never lower them.
