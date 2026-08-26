# TUM.ai — Software Development Team


## What the Software Development team does

The Software Development team (also called the Dev / Tech team) builds and maintains
TUM.ai's internal software — most importantly the **Member Manager**, the web app where
members manage their membership — and **administers TUM.ai's core IT platforms**
(GitHub, Slack, Notion, and Google Workspace). The team handles product, engineering,
testing, operations, and platform/account administration.

Mission: give every TUMai member self-service tools for the administrative side of
membership (profiles, reimbursements, contracts, certificates, jobs) and keep the
initiative's IT platforms running, secure, and well-organized.

What we are responsible for:
- The Member Manager (features below) and its backend/API.
- Administering the initiative's core platforms — GitHub, Slack, Notion, and Google
  Workspace: accounts, access/permissions, configuration, and integrations.
- Reliability, security, and data protection of member data.
- Reviewing feature requests and fixing bugs reported by members and other teams.

## The Member Manager — what members can do

The Member Manager is the central web app for TUM.ai members. Access: https://member-manager.tum-ai.com/. Sign in with your TUM.ai account (Slack login).

Main features:
- **Profile** — view and edit your personal info, CV/LinkedIn, and membership
  agreements; submit role-change requests.
- **Members directory** — browse active members, the org chart, and innovation/research
  groupings.
- **Beacon (in development)** — maintain an expertise profile and find active,
  opted-in members by skills, experience, organization, or collaboration fit. Facts
  awaiting member confirmation are shown as unverified.
- **Engagement certificates** — record your weekly engagement (hours, department,
  responsibilities) and request an official engagement certificate.
- **Reimbursements** — submit reimbursement requests with receipts; finance/legal
  reviews and approves them. (See the LnF team's reimbursement docs for the process.)
- **Contracts** — draft contracts from templates and run them through legal/finance
  review, partner signature, and board signature to a final PDF.
- **Jobs** — browse job and opportunity postings shared within TUM.ai.
- **Payment data (SEPA)** — store your bank details securely for reimbursements; this
  data is encrypted and only used for payouts.

Access depends on your role: regular members see their own data and the directory;
finance/legal leads and admins have extra review/approval views.

## Tech stack (high level)

For members interested in how it's built or in joining the team:
- **Monorepo** managed with pnpm (Node.js 24), split into three packages: a shared
  types layer, the client (frontend), and the server (backend).
- **Frontend**: React + TypeScript, built with Vite, styled with Tailwind CSS and
  shadcn/ui; React Router for navigation, TanStack Query for data, react-hook-form for
  forms. Supports dark mode and responsive/mobile layouts.
- **Backend**: Supabase, Fastify (Node.js) + TypeScript, input validation with Zod.
- **Database & auth**: Supabase (PostgreSQL + authentication).
- **Hosting**: Vercel.
- **Quality**: automated tests (Vitest, Playwright end-to-end, Storybook), Biome for
  linting/formatting, and CI checks that must pass before any change ships. Sensitive
  member data is encrypted at rest.

## Platforms the dev team administers

The dev team is the administrator for TUM.ai's core IT platforms. If you need access,
an account, a new channel/space, or a permission change on any of these, the dev team
handles it.

- **GitHub** — code hosting and the org's repositories. The team manages org
  membership, teams, and repository access.
- **Slack** — the initiative's main chat. The team administers the workspace: user
  accounts, channels, app/integration approvals, and the Slack login used by the Member
  Manager.
- **Notion** — docs and planning. The team manages workspace membership, teamspaces,
  and permissions.
- **Google Workspace** — TUM.ai email and shared Drive/Docs/Calendar. The team handles
  account provisioning, group memberships, shared-drive access, and admin settings.

### How to get help, report a bug, request a feature, or request access
- For anything — help, bugs, feature requests, or access requests — contact the dev team.
- For bugs, include: what you did, what you expected, what happened, and a screenshot.
- For feature requests, describe the problem you're trying to solve.
- For platform access (GitHub, Slack, Notion, Google Workspace), say which platform and
  what you need.

## FAQ

**Q: What is the Member Manager?**
A: TUM.ai's internal web app where members manage their profile, reimbursements,
contracts, engagement certificates, and jobs. It's at https://member-manager.tum-ai.com/.

**Q: How do I log in?**
A: Go to https://member-manager.tum-ai.com/ and sign in with Slack.

**Q: I found a bug / something is broken. What do I do?**
A: Contact the dev team. Include steps to reproduce and a screenshot.

**Q: Can I request a new feature?**
A: Yes — contact the dev team and describe the problem you're trying to solve.

**Q: How do I submit a reimbursement?**
A: In the Member Manager under Reimbursements; upload your receipts and submit. Finance/
legal reviews it. See the LnF reimbursement docs for details on the process.

**Q: Is my personal/bank data safe?**
A: Yes — sensitive fields (e.g. bank details, address) are encrypted at rest and only
used for their stated purpose.


**Q: Who do I contact about the Member Manager or dev team?**
A: Slack to @Jakob Friedrich or @Justin Lanfermann.

**Q: How do I get access to GitHub / Slack / Notion / Google Workspace?**
A: The dev team administers these. Contact the dev team, saying which platform and what
you need.
