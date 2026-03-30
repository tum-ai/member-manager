---
name: tumai-ci
description: Use when changing UI, styling, theming, logos, imagery, or visual copy in this repo so the result follows the TUM.ai corporate identity. Apply the vendored brand guide, color system, typography, button treatment, and dark/light mode rules before shipping frontend work.
---

# TUM.ai CI

Use this skill for any frontend or brand-facing change in this repo.

## Read first

Read [references/brand-tokens.md](references/brand-tokens.md) before making visual changes.

If the task needs the raw source material, use these vendored files from this repo:

- `docs/brand/source/brand-guidelines.pdf`
- `docs/brand/source/colors.jpeg`
- `docs/brand/source/website-styles.css`
- `docs/brand/source/website-button.tsx`
- `docs/brand/source/tum_ai_logo_new.svg`
- `docs/brand/source/logo_new_white_standard.png`
- `docs/brand/source/Manrope.ttf`

## Workflow

1. Start from the vendored brand tokens and logo/font assets, not memory.
2. Keep the primary violet stable across modes.
3. Keep layouts minimal and precise. Prefer spacing, shadows, and contrast over visible black borders.
4. In dark mode, stay inside the same purple/indigo family as the brand background. Do not drift into neutral gray UI.
5. Reuse the provided logos and Manrope font. Do not invent alternate marks, crops, or colorways unless the task explicitly requires it.
6. When changing buttons or interactive states, match the website treatment from `docs/brand/source/website-button.tsx`.
7. Verify both light and dark mode before finishing.

## Finish check

Before closing a UI task, confirm:

- Typography uses Manrope or an already-established approved exception.
- Primary actions use the TUM.ai violet and dark-purple hover.
- Surfaces remain minimal, not heavily outlined.
- Dark mode still feels like TUM.ai, not like a generic dark theme.
- No random accent colors were introduced.
