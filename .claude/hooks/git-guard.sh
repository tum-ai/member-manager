#!/usr/bin/env bash
# PreToolUse(Bash): block destructive/irreversible commands; warn on off-convention commits.
# Exit 2 + stderr blocks the tool call. Exit 0 allows it.
set -uo pipefail

payload="$(cat)"
cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')"

[ -z "$cmd" ] && exit 0

block() {
	printf 'git-guard: blocked — %s\n' "$1" >&2
	exit 2
}

# Hard blocks (irreversible / prod-affecting).
case "$cmd" in
	*"git push --force"* | *"git push -f"*) block "force push" ;;
	*"git reset --hard"*) block "git reset --hard discards work" ;;
	*"git clean -fd"* | *"git clean -df"*) block "git clean -fd deletes untracked files" ;;
	*"rm -rf"*) block "rm -rf" ;;
	*"supabase db push"*) block "prod migrations apply via CI on push to main, not locally" ;;
	*"supabase link"*) block "do not link to remote Supabase locally" ;;
esac

# Block direct pushes to main (push to a branch + open a PR instead).
if printf '%s' "$cmd" | grep -Eq 'git push[^|&;]*\b(origin[[:space:]]+)?(HEAD:)?main\b'; then
	block "direct push to main — open a PR from a branch"
fi

# Warn (non-blocking) if a commit message doesn't look like conventional commits.
if printf '%s' "$cmd" | grep -Eq 'git commit\b'; then
	msg="$(printf '%s' "$cmd" | grep -oE -- '-m[[:space:]]*"[^"]*"' | head -n1 | sed -E 's/^-m[[:space:]]*"//; s/"$//')"
	if [ -n "$msg" ] && ! printf '%s' "$msg" | grep -Eq '^(feat|fix|refactor|test|ci|docs|style|chore|perf|build|revert)(\([^)]+\))?!?:'; then
		printf 'git-guard: warning — commit message is not conventional-commit style (feat(scope): …)\n' >&2
	fi
fi

exit 0
