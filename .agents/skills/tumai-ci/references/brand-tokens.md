# TUM.ai brand tokens

Summary of the vendored brand material in `docs/brand/source/`, and how member-manager uses it.
When this file and `client/src/index.css` disagree, `index.css` wins.

## Official palette

From `docs/brand/source/colors.jpeg` and `docs/brand/source/website-styles.css`:

| Name | Hex | Use in member-manager |
| --- | --- | --- |
| White | `#FFFFFF` | light-mode background/cards |
| Minimal Grey | `#EFEFEF` | — (the app uses shadcn `neutral` greys) |
| Lavender Tint | `#F5EFFF` | inspiration for `--accent` (hover/selected tint) |
| Electric Lavender (TUM.ai violet) | `#9A64D9` | `--brand`, `--ring`, sidebar active item (light mode) |
| Dark Purple | `#523573` | — |
| Dark Indigo | `#1B0049` | — |
| Black | `#0D0214` | — |
| Electric Fade gradient | `#9A64D9 → #523573` | marketing surfaces only |

Dark mode uses a lightened violet (`#b98ee6`) for `--brand`/`--ring` so the purple stays legible on
neutral dark surfaces.

The public website uses violet primary buttons (`website-button.tsx`). The member portal
deliberately doesn't: primary buttons are neutral, and purple is the accent.

## Typography

Manrope (vendored as `docs/brand/source/Manrope.ttf`, served from `client/public/fonts/`). The brand
guide uses Light, Regular, SemiBold and Bold. Keep copy crisp and minimal.

## Logos

Primary logo `docs/brand/source/tum_ai_logo_new.svg`; white variant
`docs/brand/source/logo_new_white_standard.png` for dark backgrounds. Use the exported assets
unmodified.

## Tone

Clean and technically precise, confident and modern, restrained. If a design choice looks like
generic SaaS decoration, simplify it.
