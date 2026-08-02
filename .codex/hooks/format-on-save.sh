#!/usr/bin/env bash
# Codex PostToolUse hook: format files touched by apply_patch when Prettier is configured.
set -euo pipefail

root=$(git rev-parse --show-toplevel)
patch=$(jq -r '.tool_input.command // empty' | cat)
[[ -z "$patch" ]] && exit 0
command -v npx >/dev/null 2>&1 || exit 0

if [[ ! -f "$root/.prettierrc" && ! -f "$root/.prettierrc.json" && ! -f "$root/.prettierrc.js" && ! -f "$root/prettier.config.js" ]]; then
  exit 0
fi

printf '%s\n' "$patch" | sed -nE 's/^\*\*\* (Update|Add) File: (.*)$/\2/p' | while IFS= read -r path; do
  case "$path" in
    *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.scss|*.md|*.yaml|*.yml|*.html)
      [[ -f "$root/$path" ]] && npx prettier --write "$root/$path"
      ;;
  esac
done
