# UI migration: MUI → shadcn/ui

We are incrementally moving the client off **MUI v7** onto **shadcn/ui** (Tailwind
v4 + Radix). New and reworked components should be built the shadcn way and
documented in Storybook. MUI stays in place until a component is ported.

## Stack

- **Tailwind v4** — configured via the `@tailwindcss/vite` plugin (`vite.config.ts`);
  there is no `tailwind.config.js`. Tokens live in `src/index.css`.
- **shadcn/ui** — config in `components.json` (style `new-york`, base color
  `neutral`, Radix primitives). The brand accent (`--primary`, `--ring`) is set to
  the TUM.ai purple from `src/theme/index.ts`.
- **Storybook 10** (`@storybook/react-vite`) — every story is wrapped in the MUI
  `ThemeProvider` (see `.storybook/preview.tsx`) so MUI and shadcn components both
  render during the transition.

## Adding a shadcn component

```bash
# run from client/
pnpm dlx shadcn@latest add <component> --cwd "$(pwd)"
```

Components land in `src/components/ui/<component>.tsx`. Compose classes with the
`cn()` helper from `@/lib/utils` and use the `@/` alias for imports.

> Note: the shadcn CLI's interactive `init` is flaky in this monorepo, so the
> project is already initialized (`components.json`, `src/lib/utils.ts`, the CSS
> tokens). Only use `add` going forward, and always pass `--cwd`.

## Writing a story

Co-locate stories next to the component as `<component>.stories.tsx`. Use
`src/components/ui/button.stories.tsx` as the reference: a `Meta` with `argTypes`
for the variants plus a few showcase stories. Run Storybook with:

```bash
pnpm run storybook        # dev server on :6006
pnpm run build-storybook  # static build
```

## MUI coexistence rule

Tailwind's **Preflight** (its base CSS reset) is intentionally **not** imported in
`src/index.css` — it would clobber MUI's `CssBaseline`. Once MUI is fully removed,
re-enable it (see the comment at the top of `src/index.css`). Until then, prefer
shadcn primitives for new UI and port existing MUI components one at a time.
