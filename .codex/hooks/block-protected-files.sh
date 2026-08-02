#!/usr/bin/env bash
# Codex PreToolUse hook: prevent manual edits to protected files.
set -euo pipefail

patch=$(jq -r '.tool_input.command // empty' | cat)
[[ -z "$patch" ]] && exit 0

block() {
  jq -n --arg reason "$1" '{decision: "block", reason: $reason}'
  exit 0
}

paths=$(printf '%s\n' "$patch" | sed -nE \
  -e 's/^\*\*\* (Update|Add|Delete) File: (.*)$/\2/p' \
  -e 's/^--- [ab]\/(.*)$/\1/p' \
  -e 's/^\+\+\+ [ab]\/(.*)$/\1/p')

while IFS= read -r path; do
  [[ -z "$path" || "$path" == "/dev/null" ]] && continue
  case "$path" in
    */pnpm-lock.yaml|*/package-lock.json|*/yarn.lock|*/Gemfile.lock|*/poetry.lock|*/Cargo.lock|pnpm-lock.yaml|package-lock.json|yarn.lock|Gemfile.lock|poetry.lock|Cargo.lock)
      block "Blocked: lock files should be managed by the package manager, not edited manually."
      ;;
    */generated/*|*/.generated.*|*/dist/*|*/build/*|generated/*|.generated.*|dist/*|build/*)
      block "Blocked: this is a generated file. Edit its source instead."
      ;;
  esac
  if grep -qE '(^|/)migrations/[0-9]{4}.*\.(sql|ts|js)$' <<<"$path"; then
    block "Blocked: do not edit existing migrations. Create a new migration instead."
  fi
done <<<"$paths"
