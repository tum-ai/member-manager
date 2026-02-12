# Server/AGENTS.md

Purpose
- Package-specific guidance for the backend server (`server/`). This file is intended for agentic tools and contributors working on the server package.

Quick facts
- Tech: Node.js + Fastify + TypeScript
- Validation: Zod
- Error helpers: `server/src/lib/errors.ts`

Commands (preferred via root with `--filter`)
- Install: `pnpm install` (root)
- Dev: `pnpm --filter server run dev` or from `server/`: `pnpm dev` (`tsx watch src/index.ts`)
- Build: `pnpm --filter server run build` or `pnpm build` (runs `tsc`)
- Start (production): `pnpm --filter server run start` or `pnpm start` (runs `node dist/index.js`)
- Lint (check): `pnpm --filter server run lint` (runs `biome check .`)
- Lint (apply fixes): `pnpm --filter server run lint:apply` (runs `biome check . --write`)

Code style & conventions (server)
- Formatting: use Biome (config in repo root `biome.json`).
- Project structure:
  - `src/index.ts` — server entry
  - `src/routes/` — route definitions
  - `src/lib/` — utilities, clients, errors
  - `src/middleware/` — fastify plugins / auth middleware
- TypeScript:
  - Keep `strict` checks enabled. Prefer explicit return types on public functions.
  - Avoid `any`. Use `unknown` for external inputs and narrow it with zod or type guards.
- Imports:
  - External packages first, then local libs, then relative paths.

Error handling
- Throw domain-specific errors using `AppError` subclasses in `src/lib/errors.ts`.
  - `ValidationError` for 400s with optional `details`
  - `NotFoundError`, `ForbiddenError`, `UnauthorizedError`, `ConflictError`
- Global plugin `plugins/errorHandler.ts` will convert AppErrors to HTTP responses. Do not swallow errors; rethrow or wrap non-operational errors.
- Supabase / DB errors: use helper `isNotFoundError(error)` to detect PGRST116 and map to `NotFoundError`.

Security
- Never commit `.env` files. Use environment variables for secrets.
- Validate all incoming data server-side using Zod.
- Do not leak stack traces or internal messages to clients in production responses. Log them server-side.

Testing & Debugging
- Tests use the native `node:test` runner.
- Run tests: `pnpm --filter server run test` (maps to `tsx --test test/**/*.test.ts`).
- Use `tsx watch` for rapid iteration in dev. Use `node dist/index.js` only for production run.
- **Dependency Injection**: Use `getSupabase()` instead of direct `supabase` imports. In tests, use `setSupabaseClient(mockClient)` to inject mocks.
- **Mock State**: `server/test/mocks/supabase.ts` uses shared mutable state (`mockDatabase`). Always call `resetMockDatabase()` in `beforeEach`.
- **Mock Query Builder**: The mock uses a Proxy to handle `.then()` chains (e.g., `.from().select()`), enabling `await` support without implementing every method.
- Test environment setup:
  - Environment variables must be set before any module imports (especially Supabase client).
  - Create `test/setup.ts` with env defaults, import it first in test files (before other imports).
  - `dotenv.config()` in individual test files runs too late if modules import Supabase client at top level.

If you need changes
- Update this file and open a PR describing why. Run type checks (`pnpm --filter server run build`) before pushing.

OS Compatibility
- Use `cross-env` for scripts that set environment variables (e.g. `DOTENV_CONFIG_PATH`) to ensure Windows compatibility.
  - Bad: `VAR=val cmd`
  - Good: `cross-env VAR=val cmd`

