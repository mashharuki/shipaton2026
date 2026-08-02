#!/usr/bin/env bash
# Codex PreToolUse hook: enforce the same command safety policy as Claude.
set -euo pipefail

input=$(cat)
command=$(jq -r '.tool_input.command // empty' <<<"$input")
[[ -z "$command" ]] && exit 0

block() {
  jq -n --arg reason "$1" '{decision: "block", reason: $reason}'
  exit 0
}

if grep -qE 'rm[[:space:]]+-(r|f|rf|fr)[[:space:]]' <<<"$command"; then
  block "Blocked: recursive or force delete is not allowed. Use targeted deletes instead."
fi
if grep -qiE '(password|secret|token|api[_-]?key|private[_-]?key)[[:space:]]*=' <<<"$command"; then
  block "Blocked: command appears to contain secrets. Use environment variables instead."
fi
if grep -qiE '(DROP[[:space:]]+(TABLE|DATABASE|INDEX)|TRUNCATE[[:space:]]+TABLE|DELETE[[:space:]]+FROM[[:space:]]+[[:alnum:]_]+[[:space:]]*$)' <<<"$command"; then
  block "Blocked: destructive SQL operation detected. Review and execute it manually."
fi
if grep -qE '>[[:space:]]*/(etc|usr|var)/' <<<"$command"; then
  block "Blocked: writing to system directories is not allowed."
fi
if grep -qE '(unset[[:space:]]+(PATH|HOME|USER)|export[[:space:]]+PATH=)' <<<"$command"; then
  block "Blocked: modifying critical environment variables is not allowed."
fi
