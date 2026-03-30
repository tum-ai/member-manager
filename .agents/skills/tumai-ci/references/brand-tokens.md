# TUM.ai Brand CI

This summary is based on the vendored brand material in `docs/brand/source/`.

## Source bundle

- `docs/brand/source/brand-guidelines.pdf`
- `docs/brand/source/colors.jpeg`
- `docs/brand/source/website-styles.css`
- `docs/brand/source/website-button.tsx`
- `docs/brand/source/tum_ai_logo_new.svg`
- `docs/brand/source/logo_new_white_standard.png`
- `docs/brand/source/Manrope.ttf`

## Identity

The brand guide frames TUM.ai as the hub where academic rigor meets a make-it-happen builder mindset.

Mission:
"To bridge the gap between theory and practice by empowering students to build the future of AI."

Vision:
"To be the defining hub for AI talent in Europe, a community where technical precision meets human creativity."

When designing UI, that means:

- clean and technically precise, not noisy
- confident and modern, not playful or random
- community-oriented, but still restrained

## Color system

Confirmed directly from `docs/brand/source/colors.jpeg` and `docs/brand/source/website-styles.css`.

- White: `#FFFFFF`
- Minimal Grey: `#EFEFEF`
- Lavender Tint: `#F5EFFF`
- Electric Lavender / TUM.ai violet: `#9A64D9`
- Dark Purple: `#523573`
- Dark Indigo: `#1B0049`
- Black: `#0D0214`
- Electric Fade gradient: `#9A64D9 -> #523573`

Usage rules:

- Keep `#9A64D9` as the main brand accent and primary action color.
- Use `#523573` for stronger hover or pressed states.
- Use `#F5EFFF` sparingly for tinted backgrounds and highlights.
- In dark mode, backgrounds and surfaces should stay in the `#0D0214`, `#1B0049`, `#523573` family.
- Avoid random per-item accent colors.
- Avoid old or alternate purples from exploratory palettes unless a task explicitly asks for a legacy look.

## Typography

The brand guide embeds `Manrope` and the vendored source includes `docs/brand/source/Manrope.ttf`.

Available weights observed in the PDF:

- Light
- Regular
- SemiBold
- Bold

Usage rules:

- Use Manrope for UI typography.
- Favor clear hierarchy through size and weight, not decorative styling.
- Keep copy crisp and minimal.

## Logos

The brand guide includes sections for:

- Primary Logo
- Logomark
- Secondary Logo

Vendored assets available in this repo:

- `docs/brand/source/tum_ai_logo_new.svg`
- `docs/brand/source/logo_new_white_standard.png`

Usage rules:

- Prefer the provided exported assets.
- Do not redraw, recolor, crop, or rebuild the logo manually.
- Use the white logo variant only on dark enough backgrounds.

## Buttons and interaction

The website implementation source is vendored in `docs/brand/source/website-button.tsx`.

Current brand-consistent behavior:

- Primary button fill: brand violet
- Primary button text: white or minimal gray depending on context
- Primary hover: dark purple
- Outline buttons: restrained border, subtle tinted hover
- Interaction should feel crisp and confident, not bouncy or playful

## UI direction for this repo

For this member-manager repo specifically:

- Light mode should stay bright, minimal, and quiet.
- Dark mode should keep the branded purple/indigo background and use muted dark surfaces on top.
- Cards should rely on soft separation, not black outlines.
- Avatars, chips, and stat boxes should stay minimal and uniform.
- If a design choice looks more generic SaaS than TUM.ai, simplify it.
