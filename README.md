# Member Manager

TUM.ai's private member portal: a pnpm monorepo with a React client, a Fastify API, and Supabase.

## What it does

Members sign in with Slack and land on their profile. From there the portal covers:

- **Profile and directory** — member profiles, CVs, SEPA bank details and agreements, the member
  directory, org chart, and research/innovation projects
- **Engagement certificates** and **member change requests**, with admin review queues
- **Reimbursements and invoices** — receipt upload with optional OpenAI extraction, Legal & Finance
  review, Slack notifications, and BuchhaltungsButler sync
- **Finance tool** — BuchhaltungsButler postings, T-Konto view, budgets and analytics
- **Contracts** — DOCX templates, Legal & Finance review, partner and board signing (in-app or
  OpenSign), final PDFs
- **Jobs and partners** — job board, job approvals, and Partner Portal management
- **Tools** — TUM.ai Days RSVPs, educational courses, and admin utilities

Sensitive fields (address, date of birth, IBAN/BIC, bank name) are encrypted server-side before they
reach the database.

## Monorepo

- `client/` — React 18 + Vite + Tailwind 4 + shadcn/ui member portal
- `server/` — Fastify API: authorization, encryption, integrations
- `shared/` — types and Zod schemas shared by client and server
- `supabase/` — local stack config, migrations, seed data
- `e2e/` — Playwright end-to-end tests
- `api/` — the Vercel function that serves the API in production
- `scripts/`, `infra/`, `docs/`, `.agents/` — tooling, infrastructure images, docs, agent config

Details: [docs/repo-structure.md](./docs/repo-structure.md).

## Quickstart

Prerequisites: Node 24, pnpm, Docker, and the Supabase CLI.

```bash
pnpm install
pnpm dev        # starts local Supabase, writes .env.local files, runs client + server
```

- app: `http://localhost:5173` · API: `http://localhost:8787` · Supabase Studio: `http://127.0.0.1:54323`
- Seeded accounts use password `password123` (e.g. `admin@example.com`, `user@example.com`); the
  login screen offers local sign-in buttons in dev mode. Full list: [docs/development.md](./docs/development.md#seed-data).
- `pnpm doctor` checks your local setup; `pnpm gate` runs lint, typecheck, tests, and build.

New here? Start with [CONTRIBUTING.md](./CONTRIBUTING.md).

## Documentation

- [CONTRIBUTING.md](./CONTRIBUTING.md) — first run, gate, commits, PRs, preview deploys
- [AGENTS.md](./AGENTS.md) — code rules for humans and AI agents, with per-package guides
- [docs/README.md](./docs/README.md) — index of guides, feature docs, runbooks, and archive

## Deployment

Production runs on Vercel: the static client from `client/dist`, and `api/[...path].ts` exposing the
Fastify server as a Node function for same-origin `/api/*` requests. GitHub Actions deploys `main`
after CI passes; a maintainer can deploy a PR preview by commenting `/deploy-preview`. Database
migrations apply to the hosted Supabase project from CI. See
[docs/deployment.md](./docs/deployment.md).
