---
name: pr-review
description: Review a pull request against member-manager's invariants and report severity-ranked findings; posts to GitHub only when the user explicitly asks. Use when asked to review a PR.
---

# /pr-review

Review a PR (current branch's PR, or one passed as an argument).

1. **Fetch the change** — `gh pr view <n>` for context and `gh pr diff <n>` for the diff. Check out
   the PR head in a separate worktree if tests need to run; leave the user's checkout alone.
2. **Delegate** to the `code-reviewer` agent with the diff, the PR description, and the list of
   touched areas. It reads the matching `AGENTS.md`/rules, verifies by running lint, typecheck and
   the relevant tests, and returns findings ranked `[BLOCKER|MAJOR|MINOR|NIT]`.
3. **Check scope** — does the PR do exactly what its description (and linked issue) says? Flag
   unrelated changes and missing pieces.
4. **Report** to the user: a verdict (approve / changes needed), then the findings with `path:line`,
   reproduction, and suggested fix.
5. **Post only on request.** Publishing is outward-facing. If the user asks to post, use
   `gh pr review <n> --comment --body-file <file>` for the summary; inline comments need
   `gh api repos/{owner}/{repo}/pulls/<n>/reviews` with a `comments` array. Don't request
   reviewers or @-mention anyone unless asked. Never push to the PR branch.
