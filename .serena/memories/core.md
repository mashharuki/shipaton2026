# shipaton2026 — Core Map

pnpm workspace monorepo for a RevenueCat "Shipaton" hackathon entry. `pnpm-workspace.yaml` now
defines real globs (`apps/*`, `packages/*`) — `pnpm --filter <name> <cmd>` / `pnpm -F` work
(confirmed by `.github/workflows/ci.yaml`, which uses `pnpm --filter ${{ matrix.workspace }}`).
This supersedes any earlier note that workspace filtering didn't work.

Product: **SeatSignal** (通勤電車の着座快適性予測アプリ) — approved spec lives at
`.kiro/specs/seat-signal/` (requirements.md, design.md, tasks.md, research.md; `spec.json` phase
`tasks-generated`, all three approvals true, `ready_for_implementation: true`). Full concept doc
is `docs/memo.md` (~3400 lines — no longer an empty scratch file). A red-team/pre-mortem review
lives at `docs/pm/review-seatsignal-idea-2026-08-04.md` (verdict: Conditional Go, with numbered
kill-criteria — read before making product-scope decisions). See `mem:product` for the condensed
product facts and current implementation phase.

`.kiro/steering/{product,tech,structure}.md` still describe the repo at pre-SeatSignal scaffold
stage (empty `packages/`, "no PRD exists yet") — those files are stale as of this writing; treat
Serena's memories and `.kiro/specs/seat-signal/` as authoritative until steering is refreshed
(the `kiro-steering` skill can regenerate them).

Layout:
- `apps/frontend/` — Expo React Native app (iOS/Android/Web). See `mem:frontend/core`.
- `apps/backend/` — Cloudflare Workers API using Hono. See `mem:backend/core`.
- `packages/shared/` — shared TS domain package (`name: "shared"`, consumed as
  `"shared": "workspace:*"` by both apps). Result type, app-error/error-code helpers, prediction
  scoring pure functions, zod schemas for API/dataset/analytics-events, plan-limit constants. Has
  its own vitest suite (`packages/shared/test/`). See `mem:product` for what these model.
- `docs/` — `memo.md` (full product spec), `pm/` (strategy reviews), `mockup.html` (see
  root-level auto-memory `mockup-html-extraction.md` for its extraction procedure).
- Root tooling: Biome (lint+format, see `mem:conventions`), Knip (unused code/deps), pnpm.
- `.github/workflows/ci.yaml` — CI now exists: Biome check, typecheck matrix
  (shared/backend/frontend), vitest matrix with `--if-present` (auto-covers backend/frontend once
  they gain a `test` script).

Extensive `.claude/rules/*.md` govern agent behavior in this repo (code-style, git-workflow,
testing, security, argent mobile-device MCP tooling, dev/browser-tool priorities, learning-loop
memory policy). Those are process rules, not project facts — read them directly rather than via
Serena memory when relevant to the current task.

For commands: `mem:suggested_commands`. For completion checks: `mem:task_completion`. For product
facts and implementation phase: `mem:product`.
