---
name: commit
description: Stage the intended changes only, derive a scoped conventional-commit message, branch first if on main, run the staged lint check, and commit. Use when the user asks to commit work.
---

# /commit

Commit the current work cleanly.

1. **Inspect** — `git status` and `git diff` (and `git diff --staged`). Identify *only* the changes
   that belong to this unit of work. Do not blindly `git add -A` unrelated files.
2. **Branch if on `main`** — `git branch --show-current`. If it's `main`, create a topic branch first
   (`git switch -c <type>/<short-slug>`); never commit straight to `main`.
3. **Stage** the intended files explicitly (`git add <paths>`).
4. **Lint staged** — `pnpm lint:staged`. Fix anything it flags before committing.
5. **Message** — conventional commit, scoped: `type(scope): summary` where type ∈
   feat|fix|refactor|test|ci|docs|style|chore|perf|build. Keep the subject imperative and concise.
6. **Commit** — keep the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
   (The git-guard hook warns on non-conventional messages.)
7. Report the branch + short SHA. Don't push unless asked.
