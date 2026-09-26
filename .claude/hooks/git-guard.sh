#!/usr/bin/env bash
# PreToolUse(Bash): block destructive/irreversible commands; warn on off-convention commits.
# Exit 2 + stderr blocks the tool call. Exit 0 allows it.
# Matching is textual, so blocked phrases inside quoted text (e.g. a PR body) block too;
# pass such text via a file (`--body-file`). Tests: scripts/check-git-guard.test.mjs.
set -uo pipefail

block() {
	printf 'git-guard: blocked — %s\n' "$1" >&2
	exit 2
}

payload="$(cat)"
if command -v jq >/dev/null 2>&1; then
	cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')"
elif command -v node >/dev/null 2>&1; then
	cmd="$(printf '%s' "$payload" | node -e '
		let s = "";
		process.stdin.on("data", (d) => (s += d)).on("end", () => {
			try { process.stdout.write(JSON.parse(s)?.tool_input?.command ?? ""); } catch {}
		});')"
else
	block "cannot parse the hook payload: install jq or node"
fi

[ -z "$cmd" ] && exit 0

# Hard blocks (irreversible / prod-affecting).
case "$cmd" in
	*"git reset --hard"*) block "git reset --hard discards work" ;;
	*"git clean -fd"* | *"git clean -df"*) block "git clean -fd deletes untracked files" ;;
	*"rm -rf"*) block "rm -rf" ;;
	*"supabase db push"*) block "prod migrations apply via CI on push to main, not locally" ;;
	*"supabase link"*) block "do not link to remote Supabase locally" ;;
esac

# Inspect every `git [-C <dir>] push …` segment: no force pushes, no pushes to main.
check_push() {
	local rest="${1#*push}"
	local -a args=()
	local -a positional=()
	read -r -a args <<<"$rest"
	local arg
	for arg in ${args[@]+"${args[@]}"}; do
		arg="${arg//\"/}"
		arg="${arg//\'/}"
		case "$arg" in
			--force | --force=* | --force-with-lease | --force-with-lease=* | --force-if-includes)
				block "force push" ;;
			--*) ;;
			-*f*) block "force push" ;;
			-*) ;;
			+*) block "force push (+refspec)" ;;
			*) positional+=("$arg") ;;
		esac
	done

	# positional[0] is the remote; everything after it is a refspec. Without a refspec,
	# or with HEAD, git pushes the current branch.
	local on_main=false
	if [ "$(git branch --show-current 2>/dev/null)" = "main" ]; then
		on_main=true
	fi
	if [ "${#positional[@]}" -le 1 ]; then
		if [ "$on_main" = true ]; then
			block "push from main — open a PR from a branch"
		fi
		return
	fi
	local refspec destination
	for refspec in "${positional[@]:1}"; do
		destination="${refspec##*:}"
		destination="${destination#refs/heads/}"
		if [ "$destination" = "main" ]; then
			block "direct push to main — open a PR from a branch"
		fi
		if [ "$on_main" = true ] && { [ "$destination" = "HEAD" ] || [ "$destination" = "@" ]; }; then
			block "push from main — open a PR from a branch"
		fi
	done
}

while IFS= read -r segment; do
	[ -n "$segment" ] && check_push "$segment"
done < <(printf '%s\n' "$cmd" | grep -oE 'git([[:space:]]+-C[[:space:]]+[^[:space:];&|]+)*[[:space:]]+push([[:space:]][^;&|]*)?')

# Warn (non-blocking) if a commit message doesn't look like conventional commits.
if printf '%s' "$cmd" | grep -Eq 'git commit\b'; then
	msg="$(printf '%s' "$cmd" | grep -oE -- '-m[[:space:]]*"[^"]*"' | head -n1 | sed -E 's/^-m[[:space:]]*"//; s/"$//')"
	if [ -n "$msg" ] && ! printf '%s' "$msg" | grep -Eq '^(feat|fix|refactor|test|ci|docs|style|chore|perf|build|revert)(\([^)]+\))?!?:'; then
		printf 'git-guard: warning — commit message is not conventional-commit style (feat(scope): …)\n' >&2
	fi
fi

exit 0
