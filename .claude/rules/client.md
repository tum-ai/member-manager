---
paths: ["client/**"]
---

# Client rules (React)

- **Page → hook → sections.** `features/<domain>/*Page.tsx` is thin (~90 lines, default export OK
  here) and delegates to one `hooks/use*.ts`; presentational `components/*Section.tsx` are prop-driven.
  Exemplar: `client/src/features/tools/`.
- **Feature folder layout** (target — older features still drift). Feature root: `*Page.tsx`,
  `<domain>Types.ts`, `<domain>Utils.ts`, and optionally one feature-level shell/layout wrapper
  (e.g. `features/tools/ToolPageShell.tsx`). Presentational sections → `components/`; logic →
  `hooks/`. Shared code → `src/lib`/`src/hooks`/`src/components` via `@/`.
- **File size**: `features/**/*.tsx` HARD-fails >700 lines, SOFT-warns >400 (`scripts/check-file-size.mjs`).
  Split into sections instead of growing a page.
- **`@/` alias** to import across feature boundaries; relative imports only within one feature.
- **Data**: call the backend only via `src/lib/apiClient`; co-locate TanStack Query keys; invalidate
  on mutation success. State/queries/handlers live in the hook, not the page or sections.
- **Forms**: react-hook-form + the **shared** Zod schema (`@member-manager/shared`); don't redefine
  validation client-side.
- **UI**: shadcn/ui + radix primitives (`src/components/ui/`); don't hand-roll dialogs/menus/tooltips.
- **Responsive + dark mode** are requirements: mobile-first (`grid-cols-1 md:grid-cols-12`),
  dark-mode parity via next-themes.
- **Biome**: tabs, double quotes, named exports (default only on `*Page.tsx`), `import type`/
  `export type`, no non-null `!`.
- **Tests**: hooks/utils → Vitest (jsdom + RTL + MSW `onUnhandledRequest:"error"`); interactive
  components → Storybook play + a11y story. Coverage in `vite.config.ts` ratchets up only.
- **Always verify a new feature with both layers before merging**: Vitest unit/integration tests
  for its hooks/utils/components, **and** a Playwright E2E spec covering the primary user flow
  (`pnpm test:e2e`, see `e2e/CLAUDE.md`). A feature is not "done" until both pass green.
