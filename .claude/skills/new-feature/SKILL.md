---
name: new-feature
description: Scaffold a new client feature folder following the Page→hook→sections pattern, using features/tools as the template. Use when starting a new client feature.
---

# /new-feature

Scaffold `client/src/features/<domain>/` in the house style. Template to mirror:
`client/src/features/tools/` (`TumaiDaysPage.tsx`, `hooks/useTumaiDays.ts`, `components/`,
`hooks/useTumaiDays.test.tsx`).

Ask for the feature name/domain if not given, then create:

1. **`<Name>Page.tsx`** — thin route component (default export OK here). Calls one hook, renders
   sections inside a layout shell (`grid grid-cols-1 gap-5 md:grid-cols-12`). Keep it well under 400
   lines.
2. **`hooks/use<Name>.ts`** — TanStack Query `useQuery`/`useMutation`, `useState`, `useToast()` from
   `contexts/ToastContext`, all handlers. Data via `lib/apiClient`. Validation via shared Zod schema.
3. **`components/<Name>Section.tsx`** (and `*Panel`/`*Form` as needed) — presentational, prop-driven.
4. **`hooks/use<Name>.test.tsx`** — Vitest test stub (RTL + MSW handler with
   `onUnhandledRequest:"error"`), via `src/test/renderWithClient.tsx`.
5. **`components/<Name>Section.stories.tsx`** — Storybook story stub with a play + a11y check for
   interactive components.

Then: wire the route (React Router), run `pnpm --filter @member-manager/client lint && ... typecheck`.
Use `@/` for any cross-feature imports; mobile-first + dark-mode from the start.
