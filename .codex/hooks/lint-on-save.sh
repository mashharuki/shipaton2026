#!/usr/bin/env bash
# Codex PostToolUse hook: lint JavaScript and TypeScript files touched by apply_patch.
set -euo pipefail

root=$(git rev-parse --show-toplevel)
patch=$(jq -r '.tool_input.command // empty' | cat)
[[ -z "$patch" ]] && exit 0
command -v npx >/dev/null 2>&1 || exit 0

printf '%s\n' "$patch" | sed -nE 's/^\*\*\* (Update|Add) File: (.*)$/\2/p' | while IFS= read -r path; do
  case "$path" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
      [[ -f "$root/$path" ]] && npx eslint --fix "$root/$path"
      ;;
  esac
done
