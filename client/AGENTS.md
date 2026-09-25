# client/ — React frontend

React 18 + Vite 7 + Tailwind 4 + shadcn/ui + TanStack Query + React Router + react-hook-form.
Package: `@member-manager/client`.

## Module map

- `src/features/<domain>/` — one folder per domain. Target layout (the convention to grow
  toward — several older features still keep components/utils loose at the root). Inside:
  - `*Page.tsx` — thin route component (~90 lines, default export allowed here). Pulls everything
    from its hook, renders sections. Exemplar: `features/tools/TumaiDaysPage.tsx`.
  - `<domain>Types.ts` / `<domain>Utils.ts` — feature-local types and pure helpers (+ their
    `.test.ts`). Exemplars: `features/tools/tumaiDaysTypes.ts`, `tumaiDaysUtils.ts`.
  - `hooks/use*.ts` — all state/data/handlers: TanStack Query `useQuery`/`useMutation`, `useState`,
    toasts via `contexts/ToastContext` (`useToast()`). Exemplar: `features/tools/hooks/useTumaiDays.ts`.
  - `components/*.tsx` — presentational sections (`*Section`/`*Panel`/`*Form`/`*Card`), prop-driven.
    A feature-level shell/layout wrapper may sit at the root (e.g. `features/tools/ToolPageShell.tsx`),
    but individual sections belong in `components/`, not loose at the feature root.
  - Cross-feature shared code goes in `src/lib`, `src/hooks`, or `src/components`, not here.
- `src/components/ui/` — shadcn/radix primitives (exempt from size + default-export rules). Don't hand-roll.
- `src/components/layout/` — app shell. `src/components/foundations/` — design-token stories.
- `src/lib/apiClient.ts` — the only way to call the backend. `src/lib/queryClient.ts` — query client.
- `src/lib/schemas.ts` — form schemas; re-exports the shared ones (e.g. `sepaSchema`).
- `src/contexts/` — `ToastContext` (`useToast`), etc.
- `src/test/` — `setup.ts`, `mswServer.ts` (MSW), `renderWithClient.tsx` (RTL helper).

## Invariants

- **Page → hook → sections.** Logic lives in the hook, not the page or the sections.
- **File size** — `src/features/**/*.tsx` and `src/components/layout/**/*.tsx` HARD-fail >700,
  SOFT-warn >400 lines (`scripts/check-file-size.mjs`). Split before you grow.
- **Imports** — use `@/…` for everything outside the current folder, including files in your own
  feature (`@/features/tools/hooks/useTumaiDays`). Biome rejects every `../` import in `src/`.
- **Default exports** — only where `biome.json` allows them: `features/**/*Page.tsx`, `*.stories.tsx`,
  `App.tsx`, `main.tsx`, config files, `.storybook/**`.
- **Data layer** — fetch through `lib/apiClient`; co-locate query keys; invalidate on mutation success.
- **Forms** — react-hook-form + Zod. When `@member-manager/shared` has the schema, use it (API
  contract schemas are never redefined here). UI-only form schemas go in `src/lib/schemas.ts`.
- **UI** — shadcn/ui + radix primitives; Tailwind utility classes. Don't hand-roll dialogs, menus,
  or tooltips.
- **Responsive + dark mode are product requirements.** Mobile-first (`grid-cols-1 md:grid-cols-12`),
  dark-mode parity via next-themes. Not optional polish.

## Styling and theme

- Tokens live in `src/index.css`, which is the source of truth for colors. The base is shadcn
  `neutral`: `--primary` is near-black (near-white in dark mode). The TUM.ai purple (`#9a64d9`,
  lighter in dark mode) is an **accent**, used via `--brand` (links, active nav, brand badges),
  `--ring` (focus), `--accent` (lavender hover/selected tint), and the sidebar active item.
- Use semantic tokens (`bg-background`, `text-muted-foreground`, `bg-brand`), never raw
  `bg-white`/`text-black` or ad-hoc hex values. Font is Manrope. Logos and brand assets: the
  `tumai-ci` skill.
- Add shadcn components with `pnpm dlx shadcn@latest add <component> --cwd "$(pwd)"` from `client/`
  (the interactive `init` is flaky in this monorepo; the project is already initialized). Compose
  classes with `cn()` from `@/lib/utils`.

## Tests

- Every hook/util gets a Vitest test (jsdom + RTL; MSW with `onUnhandledRequest: "error"`, so every
  request needs a handler). Render through `src/test/renderWithClient.tsx`.
- Interactive components get a Storybook story with a play function. The a11y addon runs on every
  story and fails `test:storybook` on any violation (`a11y: { test: "error" }` in
  `.storybook/preview.tsx`). Co-locate `<component>.stories.tsx`; `components/ui/button.stories.tsx`
  is the reference.
- **New feature = both test layers.** Vitest for its hooks/utils/components **and** a Playwright E2E
  spec for its primary flow (`e2e/AGENTS.md`) before merging.
- **Any functionality change ships with test changes** covering the new behaviour, in the same PR.
- **Every bug fix adds a regression test** that fails before the fix and passes after.
- Storybook quirks:
  - axe can't compute backgrounds across d3's `foreignObject`, so `OrgChartDiagram.stories.tsx`
    disables `color-contrast` on purpose.
  - A play function that clicks a disabled button needs
    `userEvent.click(button, { pointerEventsCheck: 0 })`, or the click throws.
  - Markdown fixtures render `##` as `<h4>`; keep heading levels valid under the component's own
    heading, because `heading-order` runs on them too (#235). Fix the fixture, don't disable the rule.

## Commands

- `pnpm --filter @member-manager/client dev`
- `pnpm --filter @member-manager/client test` (Vitest + jsdom + RTL + MSW)
- `pnpm --filter @member-manager/client test:storybook` (needs Playwright Chromium)
- `pnpm --filter @member-manager/client storybook`

Coverage thresholds live in `client/vite.config.ts` and **ratchet up only** — never lower them.
