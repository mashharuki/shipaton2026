#!/usr/bin/env bash
# Codex SessionStart hook: retain a compact local audit trail.
set -euo pipefail

input=$(cat)
root=$(git rev-parse --show-toplevel)
session_id=$(jq -r '.session_id // "unknown"' <<<"$input")
source=$(jq -r '.source // "unknown"' <<<"$input")
log_dir="$root/.codex/logs"
log_file="$log_dir/sessions.log"

mkdir -p "$log_dir"
printf '%s | %s | %s | %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$source" "$session_id" "$(git branch --show-current 2>/dev/null || printf 'no-branch')" >> "$log_file"
if [[ $(wc -l < "$log_file") -gt 500 ]]; then
  tail -500 "$log_file" > "$log_file.tmp"
  mv "$log_file.tmp" "$log_file"
fi
