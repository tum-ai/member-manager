# Docs index

Code rules for humans and agents live in [`AGENTS.md`](../AGENTS.md) and the package guides it
links to. This folder holds everything else.

## Guides

| Doc | What it covers |
| --- | --- |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | First run, the gate, commit and PR conventions, preview deploys |
| [development.md](./development.md) | Env precedence, local stack, Slack OIDC, optional integrations, seed data, test runners, common failures |
| [ci.md](./ci.md) | Every workflow and job, required checks, secrets, what the local gate misses |
| [deployment.md](./deployment.md) | Vercel env vars, Supabase and Slack config, Actions deploys, encryption key rotation, smoke tests |
| [repo-structure.md](./repo-structure.md) | Top-level layout, entry points, where a change belongs, agent configuration |

## Features

| Doc | What it covers |
| --- | --- |
| [contracts.md](./contracts.md) | Contract generator: DOCX templates, review statuses, signing, OpenSign, finalization |
| [member-cvs.md](./member-cvs.md) | Member CV storage, updates, and the Partner Portal export |
| [finance-cost-location-mapping.md](./finance-cost-location-mapping.md) | Decoding BuchhaltungsButler cost-location codes into departments and categories |

## Runbooks

| Doc | What it covers |
| --- | --- |
| [member-cv-download.md](./member-cv-download.md) | Bulk-downloading CVs from membership-application exports |
| [../infra/libreoffice/README.md](../infra/libreoffice/README.md) | Building and pinning the LibreOffice sandbox image for contract rendering |

## Archive

Finished design docs and one-off notes, kept for history. Each starts with a status banner; don't
treat them as current.

| Doc | What it was |
| --- | --- |
| [archive/finance-analytics-roadmap.md](./archive/finance-analytics-roadmap.md) | Finance tool requirements (FR-A…) and phase plan |
| [archive/buchhaltungsbutler-sync.md](./archive/buchhaltungsbutler-sync.md) | BuchhaltungsButler API research for the receipt sync |
| [archive/linkedin-member-data.md](./archive/linkedin-member-data.md) | One-off LinkedIn profile-link import |
| [archive/shadcn-migration.md](./archive/shadcn-migration.md) | MUI → shadcn/ui migration notes |

## Other folders

- `brand/source/` — vendored TUM.ai brand material (guidelines, palette, logos, Manrope). The
  `tumai-ci` skill explains how the app uses it.
- `pr/` — screenshots committed with pull requests (e.g. #340's vivid reimbursement UI).
