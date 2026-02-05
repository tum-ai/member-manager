# Client/AGENTS.md

Purpose
- Package-specific guidance for the frontend client (`client/`). Intended for agentic tools and contributors working only on the client.

Quick facts
- Tech: React 18 + Vite + TypeScript
- Test runner: Vitest + Testing Library
- Formatter/linter: Biome (config in repo root `biome.json`)

Commands (preferred via root with `--filter`)
- Install: `pnpm install` (root)
- Dev: `pnpm --filter client run dev` or from `client/`: `pnpm dev`
- Build: `pnpm --filter client run build` or `pnpm build`
- Preview: `pnpm --filter client run preview`
- Lint (check): `pnpm --filter client run lint` (runs `biome check src`)
- Lint (apply fixes): `pnpm --filter client run lint:apply` (runs `biome check src --write`)

Testing (Vitest)
- Run all tests: `pnpm --filter client exec vitest` or from `client/`: `pnpm vitest`
- Run a single test by name: `pnpm --filter client exec vitest -t "TestNamePattern"`
  - Example: `pnpm --filter client exec vitest -t "MemberForm"`
- Run a single test file: pass the path to Vitest:
  - Example: `pnpm --filter client exec vitest client/src/features/members/__tests__/MemberForm.test.tsx`
- Watch mode: `pnpm --filter client exec vitest --watch`
- Test environment setup:
  - Environment variables are configured in `vite.config.ts` under `test.env` (not in setup files).
  - `import.meta.env` is read-only; do not attempt assignments in test setup.
  - Components using context providers (e.g. ToastProvider) must wrap test renders with those providers.

Code style & conventions (client)
- Formatting: use Biome. Run `biome check src --write` to apply fixes.
- Imports:
  1. External packages (React, MUI, utilities)
  2. Absolute/internal aliases (if configured)
  3. Relative imports from the same package
  - Keep groups separated by a single blank line.
- Components:
  - File and component names: `PascalCase` for React components (e.g. `MemberForm.tsx`).
  - Functional components only; prefer small, focused components.
  - Props: define an explicit `interface Props {}`. Avoid `React.FC` unless necessary.
- Hooks:
  - Custom hooks live in `src/hooks/` and must be prefixed with `use` (e.g. `useMemberData`).
- Types:
  - Prefer `type` / `interface` with `PascalCase` names.
  - Avoid `any`. Use `unknown` for external data and narrow it with zod or type guards.
- Styling:
  - Prefer Tailwind utility classes for layout/style.
  - Use Emotion/MUI `sx` sparingly for component-specific overrides.
- Testing guidelines:
  - Prefer user-centric queries from Testing Library (`getByRole`, `getByLabelText`).
  - Mock external clients (Supabase) and network requests.
  - Keep tests small and deterministic.

Error handling (client)
- Use `try/catch` for async code paths and surface user-friendly messages via `ToastContext`.
- Validate server responses with zod schemas found in `src/lib/schemas.ts` before using them.
- Only log detailed errors in development (`if (import.meta.env.DEV) console.error(...)`).

Cursor / Copilot rules
- No `.cursor` rules or `.github/copilot-instructions.md` were found at the time this file was created. If you add them, copy relevant excerpts into this AGENTS.md.

Where to look
- Main entry: `client/src/main.tsx`
- Shared client utilities: `client/src/lib/`
- Tests: `client/src/**/*.test.ts[x]`

If you need changes
- Update this file and create a small PR. Run `pnpm --filter client run lint:apply` and `pnpm --filter client exec vitest` before pushing.
