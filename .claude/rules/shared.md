---
paths: ["shared/**"]
---

# Shared rules (the client↔server contract)

- **Framework-free.** No `react`, `fastify`, or `@supabase/*` imports anywhere in `shared/src/**`.
  Pure TypeScript types + Zod schemas only.
- **Single source of truth.** Contract types/schemas live here and are imported by both client and
  server via `@member-manager/shared`. Never redefine them in `client/src/lib` or `server/src`.
- **Named exports + `export type`** (Biome `noDefaultExport`/`useExportType`); re-export from
  `src/index.ts`.
- **Rebuild after every change** — `pnpm build:shared`. Consumers read `dist/`; a stale build silently
  breaks client/server typechecks.
- Keep Zod schemas in parity with DB columns; update both consumers in the same change.
