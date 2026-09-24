#!/usr/bin/env bash
# PostToolUse(Edit|Write): best-effort format + organize imports on the edited file.
# Reads the hook payload from stdin; never blocks the edit (always exits 0).
set -uo pipefail

payload="$(cat)"
path="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty')"

[ -z "$path" ] && exit 0
[ -f "$path" ] || exit 0

case "$path" in
	*/dist/* | */node_modules/*) exit 0 ;;
esac

case "$path" in
	*.ts | *.tsx | *.mjs | *.json)
		npx @biomejs/biome check --write "$path" >/dev/null 2>&1 || true
		;;
esac

exit 0
