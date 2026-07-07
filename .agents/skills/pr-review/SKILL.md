---
name: pr-review
description: Review a pull request against member-manager's invariants and post inline comments. Use when asked to review a PR.
---

# /pr-review

Review a PR (current branch's PR, or one passed as an argument).

1. **Fetch the diff** — `gh pr view` for context + `gh pr diff` for the change. Note the PR number.
2. **Delegate** to the `code-reviewer` agent with the diff and the repo checklist:
   - Security: no plaintext sensitive fields; encryption via `sensitiveData.ts`; authZ on every route;
     no secrets; no public DB crypto functions.
   - Architecture: Page→hook→sections; `@/` across features; file-size limits.
   - Contract: shared schemas not duplicated; `shared/` framework-free; DB parity.
   - Migrations: no edits to merged ones; seed↔E2E parity.
   - Tests: new code tested; coverage not lowered; MSW handlers present.
   - Style: Biome clean.
   The reviewer **verifies** by running `pnpm lint`/`typecheck`/relevant tests, not by trusting the diff.
3. **Post findings** as inline PR comments via `gh` (review comments on the diff lines), severity-tagged
   `[BLOCKER|MAJOR|MINOR|NIT]`. Summarize the verdict in a top-level comment.
4. Recommend only — never push edits to the PR branch.
