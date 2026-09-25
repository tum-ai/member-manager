---
name: new-feature
description: Scaffold a new client feature folder following the Page→hook→sections pattern, using features/tools as the template. Use when starting a new client feature.
---

# /new-feature

Scaffold `client/src/features/<domain>/` in the house style (`client/AGENTS.md`). Template to
mirror: `client/src/features/tools/` (`TumaiDaysPage.tsx`, `hooks/useTumaiDays.ts`, `components/`,
`hooks/useTumaiDays.test.tsx`).

Ask for the feature name/domain if not given, then create:

1. **`<Name>Page.tsx`** — thin route component (default export OK here). Calls one hook, renders
   sections inside a layout shell (`grid grid-cols-1 gap-5 md:grid-cols-12`). Keep it well under 400
   lines.
2. **`hooks/use<Name>.ts`** — TanStack Query `useQuery`/`useMutation`, `useState`, `useToast()` from
   `@/contexts/ToastContext`, all handlers. Data via `@/lib/apiClient`. Validation via the shared Zod
   schema when one exists.
3. **`components/<Name>Section.tsx`** (and `*Panel`/`*Form` as needed) — presentational, prop-driven.
4. **`hooks/use<Name>.test.tsx`** — Vitest test (RTL + an MSW handler for every request), via
   `@/test/renderWithClient`.
5. **`components/<Name>Section.stories.tsx`** — Storybook story with a play function for
   interactive components (the a11y check runs automatically).
6. **`e2e/<name>.spec.ts`** — a Playwright spec for the primary user flow, using the seeded
   accounts in `e2e/helpers.ts`.

Then: wire the route (React Router), run `pnpm --filter @member-manager/client lint && ... typecheck
&& ... test`. Import with `@/…` everywhere (Biome rejects `../`); build mobile-first with dark mode
from the start.
