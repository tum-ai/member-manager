---
name: tumai-ci
description: Use when changing UI, styling, theming, logos, imagery, or visual copy in this repo so the result follows the TUM.ai corporate identity as the app implements it. Covers the design tokens in client/src/index.css, the purple-as-accent rule, typography, logos, and light/dark mode checks.
---

# TUM.ai CI

Use this skill for any frontend or brand-facing change in this repo.

## Source of truth

1. **`client/src/index.css`** — the app's design tokens. It wins over everything below.
2. [references/brand-tokens.md](references/brand-tokens.md) — the official palette and how the app
   maps it onto tokens.
3. Vendored raw material, only when a task needs it: `docs/brand/source/` (`brand-guidelines.pdf`,
   `colors.jpeg`, `website-styles.css`, `website-button.tsx`, `tum_ai_logo_new.svg`,
   `logo_new_white_standard.png`, `Manrope.ttf`).

## The design direction

The app is a **clean neutral interface with TUM.ai purple as an accent** (since #171):

- `--primary` (primary buttons, key CTAs) is neutral near-black in light mode and near-white in dark
  mode. Don't make primary buttons purple.
- Purple `#9a64d9` (lightened to `#b98ee6` in dark mode) appears through `--brand` (links, active
  nav, brand badges), `--ring` (focus), `--accent` (soft lavender hover/selected tint) and the
  sidebar's active item.
- Dark mode is a neutral dark theme with the same purple accent, not a purple/indigo background.
- Typography is Manrope (`--font-sans`). Hierarchy comes from size and weight, not decoration.

## Workflow

1. Use semantic Tailwind tokens (`bg-background`, `bg-card`, `text-muted-foreground`, `bg-brand`,
   `text-brand`, `ring-ring`). Never hard-code hex values or `bg-white`/`text-black` in components.
2. Reach for the existing shadcn primitives in `client/src/components/ui/` before styling anything
   by hand.
3. Keep layouts minimal and precise: spacing, soft shadows and contrast over heavy borders.
4. Use the provided logos as-is. Don't redraw, recolor or crop them, and use the white variant only
   on dark enough backgrounds.
5. Changing a token affects the whole app. Change `index.css` only when the task is about the theme
   itself, and check the Storybook foundation stories (`src/components/foundations/`).
6. Verify light and dark mode before finishing.

## Finish check

- Primary actions are neutral; purple only marks brand, focus, links, and active/selected states.
- No raw colors or new one-off accent colors.
- Manrope everywhere; logos unmodified.
- Both themes checked, including contrast (the Storybook a11y test enforces it for stories).
