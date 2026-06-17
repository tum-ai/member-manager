# client/ — React frontend

React 18 + Vite 7 + Tailwind 4 + shadcn/ui + TanStack Query + React Router + react-hook-form.
Package: `@member-manager/client`.

## Module map

- `src/features/<domain>/` — one folder per domain. Inside:
  - `*Page.tsx` — thin route component (~90 lines, default export allowed here). Pulls everything
    from its hook, renders sections. Exemplar: `features/tools/TumaiDaysPage.tsx`.
  - `hooks/use*.ts` — all state/data/handlers: TanStack Query `useQuery`/`useMutation`, `useState`,
    toasts via `contexts/ToastContext` (`useToast()`). Exemplar: `features/tools/hooks/useTumaiDays.ts`.
  - `components/*Section.tsx` / `*Panel.tsx` / `*Form.tsx` — presentational, prop-driven.
- `src/components/ui/` — shadcn/radix primitives (exempt from size + default-export rules). Don't hand-roll.
- `src/components/layout/`, `src/components/foundations/` — shell + design primitives.
- `src/lib/apiClient.ts` — the only way to call the backend. `src/lib/queryClient.ts` — query client.
- `src/contexts/` — `ToastContext` (`useToast`), etc.
- `src/test/` — `setup.ts`, `mswServer.ts` (MSW), `renderWithClient.tsx` (RTL helper).

## Invariants

- **Page → hook → sections.** Logic lives in the hook, not the page or the sections.
- **File size** — `features/**/*.tsx` HARD-fail >700, SOFT-warn >400 lines. Split before you grow.
- **`@/` alias to cross feature boundaries**; relative imports only within one feature.
- **MSW** runs with `onUnhandledRequest: "error"` — every network call in a test needs a handler.
- **Data layer** — fetch through `lib/apiClient`; co-locate query keys; invalidate on mutation success.
- **Forms** — react-hook-form + the shared Zod schema (don't redefine validation client-side).
- **UI** — shadcn/ui + radix primitives; Tailwind utility classes.
- **Responsive + dark mode are product requirements.** Mobile-first (`grid-cols-1 md:grid-cols-12`),
  dark-mode parity via next-themes. Not optional polish.
- **Tests** — every hook/util gets a Vitest test; interactive components get a Storybook play + a11y story.

## Commands

- `pnpm --filter @member-manager/client dev`
- `pnpm --filter @member-manager/client test` (Vitest + jsdom + RTL + MSW)
- `pnpm --filter @member-manager/client test:storybook`
- `pnpm --filter @member-manager/client storybook`

Coverage thresholds live in `client/vite.config.ts` and **ratchet up only** — never lower them.
